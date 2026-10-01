import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeProduct } from "@/lib/atelier";
import { toMinor, type BagLine, type Quote } from "@/lib/commerce";

export class CheckoutError extends Error {
  constructor(message: string, public status = 400, public code = "INVALID_REQUEST") { super(message); }
}
const bursts = new Map<string, { count: number; until: number }>();

/** Per-instance abuse guard only; production should also use a distributed edge limit. */
export async function readCheckoutBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new CheckoutError("এই ওয়েবসাইট থেকেই অর্ডার করুন।", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new CheckoutError("অনুরোধটি অনুমোদিত নয়।", 403);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new CheckoutError("সঠিক অর্ডার ফর্ম ব্যবহার করুন।", 415);
  const now = Date.now();
  if (bursts.size > 5000) for (const [key, value] of bursts) if (value.until < now) bursts.delete(key);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const current = bursts.get(ip);
  if (current && current.until > now) {
    current.count++;
    if (current.count > 30) throw new CheckoutError("একসঙ্গে অনেক অনুরোধ এসেছে। একটু পরে চেষ্টা করুন।", 429, "RATE_LIMITED");
  } else {
    if (bursts.size > 10000) throw new CheckoutError("এই মুহূর্তে ব্যস্ত। পরে চেষ্টা করুন।", 429);
    bursts.set(ip, { count: 1, until: now + 60000 });
  }
  if (Number(request.headers.get("content-length") || 0) > 16384) throw new CheckoutError("অর্ডারের তথ্য প্রয়োজনের চেয়ে বড়।", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new CheckoutError("অর্ডারের তথ্য পাওয়া যায়নি।");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16384) { await reader.cancel(); throw new CheckoutError("অর্ডারের তথ্য প্রয়োজনের চেয়ে বড়।", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new CheckoutError("অর্ডারের তথ্য পড়া যায়নি।"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CheckoutError("অর্ডারের তথ্য সঠিক নয়।");
  return raw as Record<string, unknown>;
}

export function quoteCatalog(lines: BagLine[], catalog: Map<string, Record<string, unknown>>): Quote {
  const totals = new Map<string, number>();
  for (const line of lines) totals.set(line.productId, (totals.get(line.productId) || 0) + line.quantity);
  const items = lines.map((line) => {
    const raw = catalog.get(line.productId);
    if (!raw) throw new CheckoutError("একটি পণ্য আর পাওয়া যাচ্ছে না। কার্ট আপডেট করুন।", 409, "CATALOG_CHANGED");
    const product = normalizeProduct(line.productId, raw);
    const minor = toMinor(product.price);
    if (!product.available || minor <= 0 || !Number.isSafeInteger(minor) || minor > 100000000)
      throw new CheckoutError(`${product.name}: স্টক ও দাম WhatsApp-এ জেনে নিন।`, 409, "CATALOG_CHANGED");
    if (product.colors.length && !product.colors.some((c) => c.name === line.color))
      throw new CheckoutError(`${product.name}: একটি উপলব্ধ রঙ বেছে নিন।`, 409, "CATALOG_CHANGED");
    // Validate numeric stock when provided, but do not claim or perform stock reservation.
    if (typeof raw.stock === "number" && Number.isFinite(raw.stock) && (totals.get(product.id) || 0) > raw.stock)
      throw new CheckoutError(`${product.name}: নির্বাচিত পরিমাণে স্টক নেই।`, 409, "CATALOG_CHANGED");
    const rawColor = Array.isArray(raw.colors) ? raw.colors.find((c) => c?.name?.trim() === line.color) : undefined;
    if (rawColor && (rawColor.available === false || (typeof rawColor.stock === "number" && rawColor.stock < line.quantity)))
      throw new CheckoutError(`${product.name}: এই রঙের পরিমাণ কমান অথবা অন্য রঙ নিন।`, 409, "CATALOG_CHANGED");
    return { ...line, name: product.name, image: product.colors.find((c) => c.name === line.color)?.image || product.mainImage,
      unitPrice: minor / 100, lineTotal: minor * line.quantity / 100 };
  });
  const subtotal = items.reduce((sum, item) => sum + toMinor(item.lineTotal), 0) / 100;
  const signature = items.map(({ productId, color, quantity, unitPrice, name }) => [productId, color, quantity, toMinor(unitPrice), name]);
  const quoteHash = createHash("sha256").update(JSON.stringify(signature)).digest("hex");
  return { items, subtotal, quoteHash, deliveryCharge: null, paymentStatus: "Not collected" };
}

export async function loadQuote(lines: BagLine[]): Promise<Quote> {
  const ids = [...new Set(lines.map((line) => line.productId))];
  const snapshots = await Promise.all(ids.map((id) => getDoc(doc(db, "products", id))));
  const catalog = new Map<string, Record<string, unknown>>();
  for (const snapshot of snapshots) if (snapshot.exists()) catalog.set(snapshot.id, snapshot.data());
  return quoteCatalog(lines, catalog);
}
export function failure(error: unknown) {
  if (error instanceof CheckoutError) return NextResponse.json({ success: false, message: error.message, code: error.code },
    { status: error.status, headers: { "Cache-Control": "no-store", ...(error.status === 429 ? { "Retry-After": "60" } : {}) } });
  console.error("AVEN_CHECKOUT_FAILED", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ success: false, code: "TEMPORARY_ERROR", message: "উত্তর নিশ্চিত করা যায়নি। একই অনুরোধ আবার পাঠান অথবা WhatsApp-এ যোগাযোগ করুন।" },
    { status: 503, headers: { "Cache-Control": "no-store" } });
}
export async function notifyOrder(text: string): Promise<boolean> {
  try {
    let token = process.env.TELEGRAM_BOT_TOKEN;
    let chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const settings = await Promise.race([getDoc(doc(db, "settings", "telegram")), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Settings timeout")), 1200);
        })]);
        if (settings.exists()) {
          const value = settings.data();
          token ||= typeof value.botToken === "string" ? value.botToken : undefined;
          chatId ||= typeof value.chatId === "string" ? value.chatId : undefined;
        }
      } finally { if (timer) clearTimeout(timer); }
    }
    if (!token || !chatId) return false;
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(4500),
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3900) }),
    });
    const data = await response.json();
    return response.ok && data.ok === true;
  } catch { return false; }
}
