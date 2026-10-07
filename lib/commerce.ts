import { normalizePhone, type Product } from "./atelier";

export const CART_KEY = "aven-shopping-bag-v1";
export const MAX_LINES = 12;
export const MAX_QUANTITY = 20;
export const MAX_UNITS = 60;
export type BagLine = { productId: string; color: string; quantity: number };
export type Customer = { name: string; phone: string; district: string; address: string; note: string };
export type CheckoutInput = Customer & { items: BagLine[]; consent: true; requestId: string; quoteHash: string };
export type QuotedItem = BagLine & { name: string; image: string; unitPrice: number; lineTotal: number };
export type Quote = { items: QuotedItem[]; subtotal: number; quoteHash: string; deliveryCharge: null; paymentStatus: "Not collected" };
export type Receipt = Quote & { orderId: string; duplicate?: boolean; notificationSent?: boolean };
export const lineKey = (line: Pick<BagLine, "productId" | "color">): string => JSON.stringify([line.productId, line.color]);
export const unitCount = (lines: BagLine[]): number => lines.reduce((sum, line) => sum + line.quantity, 0);
export const toMinor = (value: number): number => Math.round(value * 100);

/** Never store customer addresses, phone numbers or authoritative prices in the bag. */
export function validateLines(raw: unknown): BagLine[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_LINES) throw new Error(`১ থেকে ${MAX_LINES} ধরনের পণ্য নির্বাচন করুন।`);
  const merged = new Map<string, BagLine>();
  for (const value of raw) {
    if (!value || typeof value !== "object") throw new Error("কার্টের পণ্যের তথ্য সঠিক নয়।");
    const item = value as Record<string, unknown>;
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const color = typeof item.color === "string" ? item.color.trim() : "";
    const quantity = item.quantity;
    if (!productId || productId.length > 128 || productId.includes("/") || color.length > 100 ||
      typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
      throw new Error("পণ্য, রঙ ও পরিমাণ আবার যাচাই করুন।");
    const key = lineKey({ productId, color });
    const nextQuantity = (merged.get(key)?.quantity || 0) + quantity;
    if (nextQuantity > MAX_QUANTITY) throw new Error(`একই রঙের একই পণ্য সর্বোচ্চ ${MAX_QUANTITY}টি নেওয়া যাবে।`);
    merged.set(key, { productId, color, quantity: nextQuantity });
  }
  const result = [...merged.values()].sort((a, b) => lineKey(a).localeCompare(lineKey(b), "en"));
  if (unitCount(result) > MAX_UNITS) throw new Error("বড় অর্ডারের জন্য WhatsApp-এ যোগাযোগ করুন।");
  return result;
}
export function readBag(json: string): BagLine[] {
  try { const raw: unknown = JSON.parse(json); return Array.isArray(raw) && !raw.length ? [] : validateLines(raw); }
  catch { return []; }
}
export function addLine(lines: BagLine[], incoming: BagLine): BagLine[] {
  const found = lines.find((line) => lineKey(line) === lineKey(incoming));
  return validateLines(found ? lines.map((line) => line === found ? { ...line, quantity: line.quantity + incoming.quantity } : line) : [...lines, incoming]);
}
export function changeLine(lines: BagLine[], key: string, patch: Partial<Pick<BagLine, "quantity" | "color">>): BagLine[] {
  return validateLines(lines.map((line) => lineKey(line) === key ? { ...line, ...patch } : line));
}
export function removePurchased(lines: BagLine[], purchased: BagLine[]): BagLine[] {
  return lines.map((line) => ({ ...line, quantity: line.quantity - (purchased.find((p) => lineKey(p) === lineKey(line))?.quantity || 0) })).filter((line) => line.quantity > 0);
}
export function selection(product: Product, color = "", quantity = 1): BagLine {
  if (!product.available || product.price <= 0) throw new Error("এই পণ্যের স্টক ও দাম আগে জেনে নিন।");
  const chosen = color || product.colors[0]?.name || "";
  if (product.colors.length && !product.colors.some((item) => item.name === chosen)) throw new Error("তালিকা থেকে একটি রঙ নির্বাচন করুন।");
  return validateLines([{ productId: product.id, color: chosen, quantity }])[0];
}
export function validateCustomer(raw: unknown): Customer {
  if (!raw || typeof raw !== "object") throw new Error("যোগাযোগের তথ্য পূরণ করুন।");
  const data = raw as Record<string, unknown>;
  const field = (key: string, label: string, min: number, max: number) => {
    const value = typeof data[key] === "string" ? data[key].trim() : "";
    if (value.length < min || value.length > max) throw new Error(`${label} সঠিকভাবে লিখুন।`);
    return value;
  };
  const phone = normalizePhone(field("phone", "মোবাইল নম্বর", 11, 25));
  if (!/^01[3-9]\d{8}$/.test(phone)) throw new Error("সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন।");
  return { name: field("name", "নাম", 2, 100), phone, district: field("district", "জেলা", 2, 80), address: field("address", "সম্পূর্ণ ঠিকানা", 10, 500), note: field("note", "বিশেষ নির্দেশনা", 0, 300) };
}
export function validateCheckout(raw: unknown): CheckoutInput {
  if (!raw || typeof raw !== "object") throw new Error("অর্ডারের তথ্য সঠিক নয়।");
  const data = raw as Record<string, unknown>;
  if (data.consent !== true) throw new Error("অর্ডার সম্পর্কে যোগাযোগের সম্মতি দিন।");
  if (typeof data.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)) throw new Error("অর্ডারটি আবার শুরু করুন।");
  if (typeof data.quoteHash !== "string" || !/^[0-9a-f]{64}$/.test(data.quoteHash)) throw new Error("পণ্যের দাম আবার যাচাই করুন।");
  return { ...validateCustomer(data), items: validateLines(data.items), consent: true, requestId: data.requestId, quoteHash: data.quoteHash };
}
