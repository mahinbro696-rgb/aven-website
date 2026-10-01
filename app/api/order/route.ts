import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeProduct, validateOrder } from "@/lib/atelier";

export const runtime = "nodejs";
export const maxDuration = 30;

// Per-instance burst protection. Production still needs durable edge rate limiting.
const attempts = new Map<string, { count: number; until: number }>();
function limited(key: string): boolean {
  const now = Date.now();
  if (attempts.size > 5000) {
    for (const [ip, value] of attempts) if (value.until < now) attempts.delete(ip);
    if (attempts.size > 5000) attempts.clear();
  }
  const current = attempts.get(key);
  if (!current || current.until < now) { attempts.set(key, { count: 1, until: now + 60000 }); return false; }
  current.count++;
  return current.count > 12;
}
class OrderError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
async function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Optional notification timed out")), milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return NextResponse.json({ success: false, message: "এই ওয়েবসাইট থেকেই অর্ডার পাঠান।" }, { status: 403 });
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json"))
      return NextResponse.json({ success: false, message: "সঠিক অর্ডার ফর্ম ব্যবহার করুন।" }, { status: 415 });
    const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (limited(key)) return NextResponse.json({ success: false, message: "একসঙ্গে অনেক অনুরোধ এসেছে। একটু পরে আবার চেষ্টা করুন।" },
      { status: 429, headers: { "Retry-After": "60" } });
    if (Number(request.headers.get("content-length") || 0) > 8192) throw new OrderError("অর্ডারের তথ্য প্রয়োজনের চেয়ে বড়।", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new OrderError("অর্ডারের তথ্য পাওয়া যায়নি।");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8192) { await reader.cancel(); throw new OrderError("অর্ডারের তথ্য প্রয়োজনের চেয়ে বড়।", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    let json: unknown;
    try { json = JSON.parse(new TextDecoder().decode(buffer)); }
    catch { throw new OrderError("অর্ডারের তথ্য পড়া যায়নি।"); }
    let input;
    try { input = validateOrder(json); }
    catch (error) { throw new OrderError(error instanceof Error ? error.message : "অর্ডারের তথ্য সঠিক নয়।"); }

    const { requestId, ...customerInput } = input;
    const fingerprint = createHash("sha256").update(JSON.stringify(customerInput)).digest("hex");
    const orderRef = doc(db, "orders", `AVEN-${requestId}`);
    const productRef = doc(db, "products", input.productId);
    const result = await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(orderRef);
      if (existing.exists()) {
        if (existing.data().fingerprint !== fingerprint)
          throw new OrderError("এই অনুরোধের তথ্য বদলেছে। অর্ডার ফর্মটি বন্ধ করে আবার খুলুন।", 409);
        return { created: false, productName: String(existing.data().product || ""), subtotal: Number(existing.data().subtotal || 0) };
      }
      const snapshot = await transaction.get(productRef);
      if (!snapshot.exists()) throw new OrderError("পণ্যটি আর পাওয়া যাচ্ছে না।", 404);
      const product = normalizeProduct(snapshot.id, snapshot.data());
      if (!product.available || product.price <= 0) throw new OrderError("এই পণ্যের স্টক ও মূল্য WhatsApp-এ নিশ্চিত করুন।", 409);
      if (product.colors.length && !product.colors.some((color) => color.name === input.color))
        throw new OrderError("পণ্যের তালিকা থেকে একটি রঙ নির্বাচন করুন।");
      const subtotal = Math.round(product.price * input.quantity * 100) / 100;
      transaction.set(orderRef, {
        ...customerInput, product: product.name, unitPrice: product.price, subtotal,
        deliveryCharge: null, paymentStatus: "Not collected", status: "Pending",
        fingerprint, createdAt: serverTimestamp(), source: "aven-atelier",
      });
      return { created: true, productName: product.name, subtotal };
    });

    // Missing Telegram settings must never turn a saved order into an error.
    let notificationSent = false;
    if (result.created) {
      try {
        let botToken = process.env.TELEGRAM_BOT_TOKEN;
        let chatId = process.env.TELEGRAM_CHAT_ID;
        if (!botToken || !chatId) {
          const settings = await bounded(getDoc(doc(db, "settings", "telegram")), 1500);
          if (settings.exists()) {
            botToken ||= typeof settings.data().botToken === "string" ? settings.data().botToken : undefined;
            chatId ||= typeof settings.data().chatId === "string" ? settings.data().chatId : undefined;
          }
        }
        if (botToken && chatId) {
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(4500),
            body: JSON.stringify({ chat_id: chatId, text: [
              "NEW AVEN ORDER", `Reference: ${orderRef.id}`, `Product: ${result.productName}`,
              `Color: ${input.color || "Not specified"}`, `Quantity: ${input.quantity}`,
              `Subtotal: BDT ${result.subtotal}`, "Delivery: to be confirmed",
              `Name: ${input.name}`, `Phone: ${input.phone}`, `District: ${input.district}`,
              `Address: ${input.address}`, "Status: Pending",
            ].join("\n") }),
          });
          const responseBody = await response.json();
          notificationSent = response.ok && responseBody.ok === true;
        }
      } catch { /* Orders remain visible in the existing admin dashboard. */ }
    }
    return NextResponse.json({ success: true, orderId: orderRef.id, subtotal: result.subtotal, duplicate: !result.created, notificationSent },
      { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof OrderError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    // Never log customer data or tokens.
    console.error("AVEN_ORDER_SAVE_FAILED", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ success: false, message: "অনলাইন অর্ডার সংরক্ষণ করা যায়নি। একই তথ্য দিয়ে আবার চেষ্টা করুন অথবা WhatsApp-এ অর্ডার করুন।" }, { status: 503 });
  }
}
