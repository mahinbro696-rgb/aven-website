import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AdminApiError, adminFirestore, type AdminContext } from "./admin-api";

type Credentials = { cloudName: string; apiKey: string; apiSecret: string };
type Receipt = Credentials & { uid: string; expiresAt: number };
type StoredConnection = { encrypted: string; connectedAt: string };
export type CloudinaryStatus = {
  state: "setup_required" | "disconnected" | "connected" | "error";
  configured: boolean; encryptionReady: boolean; message: string;
  cloudName?: string; maskedKey?: string; connectedAt?: string; checkedAt?: string;
};
const documentPath = "settings/cloudinary";
const health = new Map<string, { until: number; okay: boolean; checkedAt: string }>();
const RECEIPT_MS = 5 * 60_000;

export function encryptionReady() { return /^[0-9a-fA-F]{64}$/.test(process.env.CLOUDINARY_INTEGRATION_KEY || ""); }
function encryptionKey() {
  if (!encryptionReady()) throw new AdminApiError("SETUP_REQUIRED", "Vercel-এ CLOUDINARY_INTEGRATION_KEY সেট করে redeploy করুন।", 503);
  return Buffer.from(process.env.CLOUDINARY_INTEGRATION_KEY!, "hex");
}
function seal(value: unknown, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`aven:cloudinary:${purpose}:v1`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
function open(value: string, purpose: string): unknown {
  const key = encryptionKey();
  try {
    if (value.length > 3000) throw new Error();
    const [version, iv, tag, body, extra] = value.split(".");
    if (version !== "v1" || !iv || !tag || !body || extra) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(`aven:cloudinary:${purpose}:v1`));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8"));
  } catch { throw new AdminApiError("INVALID_CREDENTIALS", "সংরক্ষিত তথ্য যাচাই করা যায়নি। Key ও Secret দিয়ে আবার Verify করুন।"); }
}
function credentials(value: Record<string, unknown>): Credentials {
  const cloudName = typeof value.cloudName === "string" ? value.cloudName.trim() : "";
  const apiKey = typeof value.apiKey === "string" ? value.apiKey.trim() : "";
  const apiSecret = typeof value.apiSecret === "string" ? value.apiSecret.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(cloudName) || !/^[0-9]{5,30}$/.test(apiKey) || !/^[A-Za-z0-9_-]{8,200}$/.test(apiSecret)) {
    throw new AdminApiError("INVALID_CREDENTIALS", "সঠিক Cloud name, API Key ও API Secret দিন।");
  }
  return { cloudName, apiKey, apiSecret };
}
async function ping(value: Credentials): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(value.cloudName)}/ping`, {
      headers: { Authorization: `Basic ${Buffer.from(`${value.apiKey}:${value.apiSecret}`).toString("base64")}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
  } catch { throw new AdminApiError("CLOUDINARY_UNAVAILABLE", "Cloudinary-তে সংযোগ হচ্ছে না। আবার Reconnect করুন।", 502); }
  if (response.status === 401 || response.status === 403 || response.status === 404) throw new AdminApiError("CLOUDINARY_REJECTED", "Cloud name, API Key বা API Secret ভুল অথবা অনুমতি নেই। নতুন তথ্য দিয়ে Verify করুন।", 400);
  if (response.status === 429) throw new AdminApiError("CLOUDINARY_LIMIT", "Cloudinary API limit হয়েছে। কিছুক্ষণ পরে Reconnect করুন।", 429);
  if (!response.ok) throw new AdminApiError("CLOUDINARY_UNAVAILABLE", "Cloudinary সংযোগে সমস্যা। আবার Reconnect করুন।", 502);
  try { if ((await response.json() as { status?: string }).status !== "ok") throw new Error(); }
  catch { throw new AdminApiError("CLOUDINARY_UNAVAILABLE", "Cloudinary সংযোগ যাচাই করা যায়নি। আবার চেষ্টা করুন।", 502); }
}
async function read(context: AdminContext): Promise<StoredConnection | null> {
  const response = await adminFirestore(context, documentPath);
  if (response.status === 404) return null;
  if (!response.ok) throw new AdminApiError("STORAGE_UNAVAILABLE", "সংযোগের তথ্য পড়া যায়নি। আবার চেষ্টা করুন।", 503);
  const data = await response.json() as { fields?: Record<string, { stringValue?: string }> };
  const encrypted = data.fields?.encrypted?.stringValue;
  if (!encrypted) throw new AdminApiError("INVALID_CONFIGURATION", "সংযোগের তথ্য সঠিক নয়। Disconnect করে আবার Connect করুন।");
  return { encrypted, connectedAt: data.fields?.connectedAt?.stringValue || "" };
}
function publicDetails(value: Credentials, stored: StoredConnection) {
  return { cloudName: value.cloudName, maskedKey: `•••• ${value.apiKey.slice(-4)}`, connectedAt: stored.connectedAt };
}
function recordHealth(encrypted: string, okay: boolean) {
  const now = Date.now();
  for (const [key, value] of health) if (value.until <= now) health.delete(key);
  if (health.size > 100) health.clear();
  const result = { until: now + 60_000, okay, checkedAt: new Date(now).toISOString() };
  health.set(encrypted, result);
  return result;
}
export async function cloudinaryStatus(context: AdminContext): Promise<CloudinaryStatus> {
  let stored: StoredConnection | null;
  try { stored = await read(context); }
  catch (error) {
    if (error instanceof AdminApiError && error.code === "INVALID_CONFIGURATION") return { state: "error", configured: true, encryptionReady: true, message: error.message };
    throw error;
  }
  if (!encryptionReady()) return { state: "setup_required", configured: !!stored, encryptionReady: false, message: "সংযোগের আগে একবার Vercel encryption key সেট করুন।" };
  if (!stored) return { state: "disconnected", configured: false, encryptionReady: true, message: "Cloudinary এখনো connect করা হয়নি।" };
  let value: Credentials;
  try { value = credentials(open(stored.encrypted, "connection") as Record<string, unknown>); }
  catch { return { state: "error", configured: true, encryptionReady: true, message: "সংরক্ষিত Key পড়া যায়নি। আবার Verify ও Connect করুন।" }; }
  let result = health.get(stored.encrypted);
  if (!result || result.until <= Date.now()) {
    try { await ping(value); result = recordHealth(stored.encrypted, true); }
    catch { result = recordHealth(stored.encrypted, false); }
  }
  return { state: result.okay ? "connected" : "error", configured: true, encryptionReady: true, ...publicDetails(value, stored), checkedAt: result.checkedAt,
    message: result.okay ? "Cloudinary সংযোগ সচল।" : "Cloudinary সংযোগে সমস্যা। Reconnect করুন অথবা নতুন Key দিয়ে Verify করুন।" };
}
export async function cloudinaryAction(context: AdminContext, data: Record<string, unknown>) {
  if (data.action === "disconnect") {
    // Disconnect must work even if the encryption key was removed or changed.
    const response = await adminFirestore(context, documentPath, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new AdminApiError("STORAGE_UNAVAILABLE", "Disconnect হয়নি। আবার চেষ্টা করুন।", 503);
    health.clear();
    return { status: { state: "disconnected", configured: false, encryptionReady: encryptionReady(), message: "Cloudinary disconnect করা হয়েছে।" } };
  }
  encryptionKey();
  if (data.action === "verify") {
    const value = credentials(data);
    await ping(value);
    const expiresAt = Date.now() + RECEIPT_MS;
    return { receipt: seal({ ...value, uid: context.uid, expiresAt }, "verification"), expiresAt, message: "Verification complete. এখন Connect করুন।" };
  }
  if (data.action === "connect") {
    if (typeof data.receipt !== "string") throw new AdminApiError("VERIFY_REQUIRED", "আগে Verify করুন।");
    const receipt = open(data.receipt, "verification") as Receipt;
    if (receipt.uid !== context.uid || typeof receipt.expiresAt !== "number" || receipt.expiresAt <= Date.now() || receipt.expiresAt > Date.now() + RECEIPT_MS) {
      throw new AdminApiError("VERIFY_REQUIRED", "Verification-এর সময় শেষ হয়েছে। আবার Verify করুন।");
    }
    const value = credentials(receipt);
    await ping(value);
    const stored = { encrypted: seal(value, "connection"), connectedAt: new Date().toISOString() };
    const response = await adminFirestore(context, documentPath, { method: "PATCH", body: JSON.stringify({ fields: {
      encrypted: { stringValue: stored.encrypted }, connectedAt: { stringValue: stored.connectedAt }, version: { integerValue: "1" },
    } }) });
    if (!response.ok) throw new AdminApiError("STORAGE_UNAVAILABLE", "সংযোগের তথ্য save হয়নি। আবার Connect করুন।", 503);
    const result = recordHealth(stored.encrypted, true);
    return { status: { state: "connected", configured: true, encryptionReady: true, ...publicDetails(value, stored), checkedAt: result.checkedAt, message: "Cloudinary সফলভাবে connect হয়েছে।" } };
  }
  if (data.action === "reconnect") {
    const stored = await read(context);
    if (!stored) throw new AdminApiError("VERIFY_REQUIRED", "আগে Key ও Secret দিয়ে Verify করুন।");
    const value = credentials(open(stored.encrypted, "connection") as Record<string, unknown>);
    try { await ping(value); }
    catch (error) { recordHealth(stored.encrypted, false); throw error; }
    const result = recordHealth(stored.encrypted, true);
    return { status: { state: "connected", configured: true, encryptionReady: true, ...publicDetails(value, stored), checkedAt: result.checkedAt, message: "Cloudinary আবার connect হয়েছে।" } };
  }
  throw new AdminApiError("INVALID_ACTION", "সঠিক connection action নির্বাচন করুন।");
}
