import { randomUUID } from "node:crypto";
import { AdminApiError, type AdminContext } from "./admin-api";
import { connectedCloudinaryCredentials } from "./cloudinary-integration";

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export function imageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if ([137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte)) return "image/png";
  if (Buffer.from(bytes.subarray(0,4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8,12)).toString() === "WEBP") return "image/webp";
  return null;
}
export async function readUploadImage(request: Request) {
  const type = request.headers.get("content-type")?.split(";")[0].trim();
  if (!["image/jpeg", "image/png", "image/webp"].includes(type || "")) throw new AdminApiError("INVALID_IMAGE", "JPG, PNG অথবা WebP ছবি দিন।", 415);
  if (Number(request.headers.get("content-length") || 0) > MAX_UPLOAD_BYTES) throw new AdminApiError("IMAGE_TOO_LARGE", "ছবি 3 MB-এর মধ্যে রাখুন।", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AdminApiError("INVALID_IMAGE", "ছবি পাওয়া যায়নি।");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_BYTES) { await reader.cancel(); throw new AdminApiError("IMAGE_TOO_LARGE", "ছবি 3 MB-এর মধ্যে রাখুন।", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  if (imageMime(bytes) !== type) throw new AdminApiError("INVALID_IMAGE", "ফাইলটি সঠিক ছবি নয়। অন্য JPG, PNG অথবা WebP দিন।");
  return { bytes, type: type! };
}
export async function uploadProductImage(context: AdminContext, image: { bytes: Uint8Array; type: string }) {
  const value = await connectedCloudinaryCredentials(context);
  const data = new FormData();
  data.append("file", new Blob([new Uint8Array(image.bytes)], { type: image.type }), "product-image");
  data.append("public_id", `aven/products/${randomUUID()}`);
  data.append("overwrite", "false");
  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(value.cloudName)}/image/upload`, {
      method: "POST", body: data, headers: { Authorization: `Basic ${Buffer.from(`${value.apiKey}:${value.apiSecret}`).toString("base64")}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000),
    });
  } catch { throw new AdminApiError("UPLOAD_UNCERTAIN", "Upload-এর উত্তর পাওয়া যায়নি। Cloudinary Media Library দেখে তারপর আবার চেষ্টা করুন।", 502); }
  if (response.status === 401 || response.status === 403) throw new AdminApiError("UPLOAD_AUTH_FAILED", "Cloudinary upload permission পাওয়া যাচ্ছে না। Settings থেকে Reconnect বা নতুন Key দিয়ে Connect করুন।", 409);
  if (response.status === 429) throw new AdminApiError("UPLOAD_LIMIT", "Cloudinary limit হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।", 429);
  if (!response.ok) throw new AdminApiError("UPLOAD_FAILED", "ছবি upload হয়নি। ছবির format ও Cloudinary quota যাচাই করুন।", 502);
  try {
    const result = await response.json() as { secure_url?: string; resource_type?: string; width?: number; height?: number };
    const url = new URL(result.secure_url || "");
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password || url.port
      || !url.pathname.startsWith(`/${value.cloudName}/image/upload/`) || result.resource_type !== "image"
      || !Number.isFinite(result.width) || !Number.isFinite(result.height) || result.width! <= 0 || result.height! <= 0) throw new Error();
    return { url: url.href, width: result.width, height: result.height, message: "ছবি upload হয়েছে। Product Save / Publish করলে স্টোরে দেখা যাবে।" };
  } catch { throw new AdminApiError("INVALID_UPLOAD_RESPONSE", "Upload-এর তথ্য যাচাই করা যায়নি। Cloudinary Media Library দেখে আবার চেষ্টা করুন।", 502); }
}
