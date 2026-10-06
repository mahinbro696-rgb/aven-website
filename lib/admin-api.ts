import { firebaseConfig } from "./firebase-config";
import { ADMIN_SESSION_MS } from "./admin-security";

export class AdminApiError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export type AdminContext = { uid: string; token: string };
const attempts = new Map<string, { count: number; until: number }>();

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new AdminApiError("CROSS_ORIGIN", "এই অ্যাডমিন প্যানেল থেকেই অনুরোধ করুন।", 403);
  if (!origin) return; // Non-browser clients must still provide a verified bearer token.
  try {
    const target = new URL(request.url);
    const host = request.headers.get("host") || target.host;
    if (/[\s,/\\@?#%]/.test(host) || new URL(origin).origin !== origin || origin !== new URL(`${target.protocol}//${host}`).origin) throw new Error();
  } catch { throw new AdminApiError("CROSS_ORIGIN", "অনুরোধের উৎস অনুমোদিত নয়।", 403); }
}

async function privateFetch(url: string, options: RequestInit): Promise<Response> {
  try { return await fetch(url, { ...options, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) }); }
  catch { throw new AdminApiError("FIREBASE_UNAVAILABLE", "Firebase-এর সংযোগ নিশ্চিত করা যাচ্ছে না। আবার চেষ্টা করুন।", 503); }
}

export async function requireAdmin(request: Request): Promise<AdminContext> {
  requireSameOrigin(request);
  const token = /^Bearer ([A-Za-z0-9._-]{20,8192})$/.exec(request.headers.get("authorization") || "")?.[1];
  if (!token) throw new AdminApiError("SIGN_IN_REQUIRED", "অ্যাডমিন অ্যাকাউন্টে আবার sign in করুন।", 401);
  // Firebase validates the token. Decoding alone is never used as authentication.
  const response = await privateFetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
  });
  if (!response.ok) throw new AdminApiError("INVALID_SESSION", "সেশনটি আর বৈধ নয়। আবার sign in করুন।", 401);
  let uid: string;
  try {
    const body = await response.json() as { users?: { localId?: string; disabled?: boolean; validSince?: string }[] };
    const user = body.users?.[0];
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    if (!user?.localId || user.disabled === true || claims.sub !== user.localId
      || claims.aud !== firebaseConfig.projectId || claims.iss !== `https://securetoken.google.com/${firebaseConfig.projectId}`
      || typeof claims.exp !== "number" || claims.exp <= now
      || typeof claims.auth_time !== "number" || !Number.isInteger(claims.auth_time) || claims.auth_time > now
      || now - claims.auth_time >= ADMIN_SESSION_MS / 1000
      || (user.validSince && claims.auth_time < Number(user.validSince))) throw new Error();
    uid = user.localId;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error();
  } catch { throw new AdminApiError("INVALID_SESSION", "সেশনটি আর বৈধ নয়। আবার sign in করুন।", 401); }
  const role = await privateFetch(firestoreDocumentUrl(`admins/${uid}`), { headers: { Authorization: `Bearer ${token}` } });
  if (!role.ok) throw new AdminApiError("ADMIN_REQUIRED", "এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই।", 403);
  const record = await role.json() as { fields?: { active?: { booleanValue?: boolean } } };
  if (record.fields?.active?.booleanValue !== true) throw new AdminApiError("ADMIN_REQUIRED", "অ্যাডমিন অনুমতি প্রত্যাহার করা হয়েছে।", 403);
  const now = Date.now();
  for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
  const current = attempts.get(uid);
  if (current && ++current.count > 45) throw new AdminApiError("RATE_LIMITED", "অনেকবার চেষ্টা হয়েছে। এক মিনিট পরে আবার চেষ্টা করুন।", 429);
  if (!current) {
    if (attempts.size >= 5000) throw new AdminApiError("RATE_LIMITED", "সার্ভার ব্যস্ত। একটু পরে চেষ্টা করুন।", 429);
    attempts.set(uid, { count: 1, until: now + 60_000 });
  }
  return { uid, token };
}

export function firestoreDocumentUrl(path: string): string {
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${path}`;
}

export async function adminFirestore(context: AdminContext, path: string, options: RequestInit = {}): Promise<Response> {
  const response = await privateFetch(firestoreDocumentUrl(path), {
    ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${context.token}` },
  });
  if (response.status === 401) throw new AdminApiError("INVALID_SESSION", "সেশন শেষ হয়েছে। আবার sign in করুন।", 401);
  if (response.status === 403) throw new AdminApiError("FIRESTORE_PERMISSION", "Firebase Settings-এর অনুমতি পাওয়া যাচ্ছে না। Firestore Rules যাচাই করুন।", 403);
  return response;
}

export async function readAdminJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new AdminApiError("INVALID_BODY", "সঠিক ফর্ম ব্যবহার করুন।", 415);
  if (Number(request.headers.get("content-length") || 0) > 4096) throw new AdminApiError("BODY_TOO_LARGE", "অনুরোধটি অতিরিক্ত বড়।", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AdminApiError("INVALID_BODY", "অনুরোধের তথ্য পাওয়া যায়নি।");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 4096) { await reader.cancel(); throw new AdminApiError("BODY_TOO_LARGE", "অনুরোধটি অতিরিক্ত বড়।", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new AdminApiError("INVALID_BODY", "ফর্মের তথ্য সঠিক নয়।"); }
}
