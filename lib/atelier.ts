/** Shared storefront data. Never place private credentials here. */
export const CONTACT = { display: "01987744985", international: "+8801987744985", whatsapp: "8801987744985" } as const;
export const SITE_URL = "https://aven-website.vercel.app";
export type ProductColor = { name: string; image: string; stock?: number; available?: boolean };
export type Product = {
  id: string; name: string; category: string; price: number; oldPrice: number;
  description: string; mainImage: string; colors: ProductColor[]; available: boolean; stock?: number; createdAt: number;
};
export function whatsappLink(message = "আসসালামু আলাইকুম, AVEN-এর কালেকশন সম্পর্কে জানতে চাই।"): string {
  return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`;
}
export const money = (amount: number): string => `৳ ${new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 2 }).format(amount)}`;
export const PRODUCT_IMAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
  "res.cloudinary.com",
]);

export function isAllowedProductImage(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const source = value.trim();
  if (!source) return false;
  if (source.startsWith("/") && !source.startsWith("//") && !source.includes("\\")) {
    return source.startsWith("/products/");
  }
  try {
    const url = new URL(source);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && PRODUCT_IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function safeImage(value: unknown): string {
  return isAllowedProductImage(value) ? value.trim() : "/products/pink.png";
}
export function normalizeProduct(id: string, raw: Record<string, unknown>): Product {
  const positive = (value: unknown) => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const colors: ProductColor[] = [];
  if (Array.isArray(raw.colors)) for (const item of raw.colors) {
    if (item && typeof item === "object" && typeof item.name === "string" && item.name.trim() && !colors.some((c) => c.name === item.name.trim()))
      colors.push({ name: item.name.trim(), image: safeImage(item.image || raw.mainImage), stock: typeof item.stock === "number" && Number.isFinite(item.stock) && item.stock >= 0 ? item.stock : undefined, available: item.available !== false });
  }
  let createdAt = 0;
  const timestamp = raw.createdAt as { toMillis?: () => number; seconds?: number } | undefined;
  if (typeof timestamp?.toMillis === "function") createdAt = timestamp.toMillis();
  else if (typeof timestamp?.seconds === "number") createdAt = timestamp.seconds * 1000;
  return {
    id, name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "AVEN Collection",
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "কালেকশন",
    price: positive(raw.price), oldPrice: positive(raw.oldPrice), description: typeof raw.description === "string" ? raw.description : "",
    mainImage: safeImage(raw.mainImage), colors,
    available: raw.available !== false && raw.inStock !== false && raw.stock !== 0 && !(colors.length > 0 && colors.every((color) => color.available === false || color.stock === 0)),
    stock: typeof raw.stock === "number" && Number.isFinite(raw.stock) && raw.stock >= 0 ? raw.stock : undefined,
    createdAt,
  };
}
export function discountPercent(product: Product): number {
  return product.oldPrice > product.price && product.price > 0 ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
}
export function productMessage(product: Product, color = "", quantity = 1): string {
  return ["আসসালামু আলাইকুম, AVEN থেকে এই পণ্যটি নিতে চাই।", `পণ্য: ${product.name}`, color ? `রঙ: ${color}` : "", `পরিমাণ: ${quantity}`,
    product.price > 0 ? `পণ্যের মোট মূল্য: ${money(product.price * quantity)}` : "মূল্য নিশ্চিত করবেন।",
    "স্টক, ডেলিভারি চার্জ ও পেমেন্টের নিয়ম নিশ্চিত করবেন।", `${SITE_URL}/product/${encodeURIComponent(product.id)}`].filter(Boolean).join("\n");
}
export function normalizePhone(input: string): string {
  let phone = input.replace(/[০-৯]/g, (n) => String("০১২৩৪৫৬৭৮৯".indexOf(n))).replace(/[\s()+-]/g, "");
  if (phone.startsWith("880")) phone = phone.slice(2);
  return phone;
}
export type OrderInput = {
  productId: string; name: string; phone: string; district: string; address: string; color: string; quantity: number; requestId: string;
};
export function validateOrder(raw: unknown): OrderInput {
  if (!raw || typeof raw !== "object") throw new Error("অর্ডারের তথ্য সঠিক নয়।");
  const item = raw as Record<string, unknown>;
  const field = (key: string, min: number, max: number) => {
    const value = typeof item[key] === "string" ? (item[key] as string).trim() : "";
    if (value.length < min || value.length > max) throw new Error("প্রয়োজনীয় তথ্য সঠিকভাবে পূরণ করুন।");
    return value;
  };
  const phone = normalizePhone(field("phone", 11, 25));
  if (!/^01[3-9]\d{8}$/.test(phone)) throw new Error("সঠিক বাংলাদেশি মোবাইল নম্বর দিন।");
  const quantity = Number(item.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error("পরিমাণ ১ থেকে ২০-এর মধ্যে দিন।");
  const productId = field("productId", 1, 128);
  if (productId.includes("/")) throw new Error("পণ্যটি সঠিক নয়।");
  const requestId = field("requestId", 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new Error("অর্ডারটি আবার শুরু করুন।");
  return { productId, requestId, phone, quantity, name: field("name", 2, 100), district: field("district", 2, 80), address: field("address", 10, 500), color: field("color", 0, 100) };
}
