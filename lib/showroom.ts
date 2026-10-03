import { type Product, SITE_URL, money } from "./atelier";
import type { BagLine } from "./commerce";
import offer from "./catalog-offer.json";

/** Merchant-approved display defaults, not an inventory source.
 * The live catalog replaces these records. Checkout always re-reads Firestore.
 */
export const SHOWROOM: Product[] = offer.products.map(({ color, ...item }) => ({
  ...item, category: "শাল", price: offer.price, oldPrice: offer.oldPrice,
  description: "পছন্দের রঙ ও পরিমাণ বেছে ওয়েবসাইটেই নাম, মোবাইল নম্বর ও ঠিকানা দিয়ে অর্ডার করুন। ডেলিভারি চার্জ ও সময় আলাদাভাবে নিশ্চিত করা হবে।",
  colors: [{ name: color, image: item.mainImage }], available: true, createdAt: 0,
}));
export const isShowroom = (product: Product): boolean => product.price <= 0 && SHOWROOM.some((item) => item.id === product.id);
export const canSelect = (product: Product): boolean => product.available && (product.price > 0 || isShowroom(product));
export function inquiryMessage(lines: BagLine[], products: Product[]): string {
  return ["আসসালামু আলাইকুম, AVEN-এর এই পণ্যগুলোর তথ্য জানতে চাই।", "",
    ...lines.map((line, index) => {
      const p = products.find((item) => item.id === line.productId);
      return [`${index + 1}. ${p?.name || "পণ্যের তথ্য নিশ্চিত করুন"}`, `রঙ: ${line.color || "ছবি অনুযায়ী"} | পরিমাণ: ${line.quantity}`,
        p && p.price > 0 ? `পণ্যের মূল্য: ${money(p.price * line.quantity)}` : "মূল্য: নিশ্চিত করা প্রয়োজন",
        `${SITE_URL}/product/${encodeURIComponent(line.productId)}`].join("\n");
    }), "", "এটি পণ্যের তথ্য জানার অনুরোধ, পেমেন্ট বা নিশ্চিত অর্ডার নয়।",
  ].join("\n");
}
