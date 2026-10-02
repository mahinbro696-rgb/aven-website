import { firebaseConfig } from "@/lib/firebase";

type FirestoreValue =
  | { nullValue: null }
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export class FirestoreCreateError extends Error {
  constructor(message: string, public status: number, public alreadyExists = false) {
    super(message);
  }
}

function encode(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite Firestore number");
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return {
    arrayValue: value.length ? { values: value.map(encode) } : {},
  };
  if (typeof value === "object") {
    const fields = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, encode(item)])
    );
    return { mapValue: Object.keys(fields).length ? { fields } : {} };
  }
  throw new Error("Unsupported Firestore value");
}

function encodeFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encode(value)])
  );
}

/**
 * Create one Firestore document with an exact document id.
 * Firestore's createDocument endpoint is create-only: an existing id returns 409
 * and can never be overwritten by this helper.
 */
export async function createPublicOrderDocument(
  documentId: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!/^AVEN-[0-9a-f-]{36}$/i.test(documentId)) throw new Error("Invalid order id");
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/orders`
  );
  url.searchParams.set("documentId", documentId);
  url.searchParams.set("key", firebaseConfig.apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({ fields: encodeFields(data) }),
  });

  if (response.ok) return;
  if (response.status === 409) throw new FirestoreCreateError("Order already exists", 409, true);

  let detail = "";
  try {
    const body = await response.json() as { error?: { status?: string } };
    detail = body.error?.status || "";
  } catch {
    // Never echo Firestore response bodies or customer data.
  }
  console.error("AVEN_ORDER_CREATE_FAILED", response.status, detail);
  throw new FirestoreCreateError("Order create failed", response.status);
}
