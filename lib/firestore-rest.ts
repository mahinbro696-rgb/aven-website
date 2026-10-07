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
  constructor(
    message: string,
    public status: number,
    public alreadyExists = false,
    public conflict = false
  ) {
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

function documentName(collection: string, id: string) {
  return `projects/${firebaseConfig.projectId}/databases/(default)/documents/${collection}/${id}`;
}

async function readFingerprint(requestId: string): Promise<string | null> {
  const url = new URL(
    `https://firestore.googleapis.com/v1/${documentName("order_requests", requestId)}`
  );
  url.searchParams.set("key", firebaseConfig.apiKey);
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return null;
  const body = await response.json() as {
    fields?: { fingerprint?: { stringValue?: string } };
  };
  return body.fields?.fingerprint?.stringValue || null;
}

/**
 * Atomically creates a private order document plus a tiny public-readable
 * idempotency record containing only the request fingerprint and order id.
 * Existing orders are never read through the public client.
 */
export async function createPublicOrderDocument(
  documentId: string,
  data: Record<string, unknown>,
  fingerprint: string
): Promise<{ duplicate: boolean }> {
  const match = /^AVEN-([0-9a-f-]{36})$/i.exec(documentId);
  if (!match || !/^[0-9a-f]{64}$/i.test(fingerprint)) throw new Error("Invalid order identity");
  const requestId = match[1];

  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:commit`
  );
  url.searchParams.set("key", firebaseConfig.apiKey);

  const writes = [
    {
      update: {
        name: documentName("orders", documentId),
        fields: encodeFields(data),
      },
      currentDocument: { exists: false },
    },
    {
      update: {
        name: documentName("order_requests", requestId),
        fields: encodeFields({
          fingerprint,
          orderId: documentId,
          createdAt: new Date(),
        }),
      },
      currentDocument: { exists: false },
    },
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({ writes }),
  });

  if (response.ok) return { duplicate: false };

  let status = "";
  try {
    const body = await response.json() as { error?: { status?: string } };
    status = body.error?.status || "";
  } catch {
    // Never echo Firestore response bodies or customer data.
  }

  if (
    response.status === 409 ||
    status === "ALREADY_EXISTS" ||
    status === "FAILED_PRECONDITION"
  ) {
    const existing = await readFingerprint(requestId);
    if (existing === fingerprint) return { duplicate: true };
    if (existing) throw new FirestoreCreateError("Request payload conflict", 409, true, true);
  }

  console.error("AVEN_ORDER_CREATE_FAILED", response.status, status);
  throw new FirestoreCreateError("Order create failed", response.status);
}
