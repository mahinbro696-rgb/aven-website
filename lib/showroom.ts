import { type Product, SITE_URL, money } from "./atelier";
import type { BagLine } from "./commerce";

/** These are the shop's existing photographs, NOT invented stock or priced products.
 * Publishing a product with the same id replaces the inquiry-only photograph.
 */
export const SHOWROOM: Product[] = [
  { id: "aven-rose-shawl", name: "প্যাটার্ন শাল — গোলাপি", mainImage: "/products/pink.png", color: "গোলাপি" },
  { id: "aven-blue-shawl", name: "প্যাটার্ন শাল — নীল", mainImage: "/products/Blue.png", color: "নীল" },
  { id: "aven-golden-shawl", name: "প্যাটার্ন শাল — হলুদ", mainImage: "/products/Yellow.png", color: "হলুদ" },
].map(({ color, ...item }) => ({ ...item, category: "শাল", price: 0, oldPrice: 0,
  description: "ছবিতে দেখানো নকশাটি পছন্দ হলে রঙ ও পরিমাণ বেছে আমাদের সঙ্গে কথা বলুন। দাম, কাপড়, মাপ, বর্তমান স্টক ও ডেলিভারি চার্জ AVEN নিশ্চিত করবে।",
  colors: [{ name: color, image: item.mainImage }], available: true, createdAt: 0,
}));
export const isShowroom = (product: Product): boolean => product.price <= 0 && SHOWROOM.some((item) => item.id === product.id);
export const canSelect = (product: Product): boolean => product.available && (product.price > 0 || isShowroom(product));
export function inquiryMessage(lines: BagLine[], products: Product[]): string {
  return ["আসসালামু আলাইকুম, AVEN-এর এই পণ্যগুলোর দাম ও স্টক নিশ্চিত করে অর্ডার করতে চাই।", "",
    ...lines.map((line, index) => {
      const p = products.find((item) => item.id === line.productId);
      return [`${index + 1}. ${p?.name || "পণ্যের তথ্য নিশ্চিত করুন"}`, `রঙ: ${line.color || "ছবি অনুযায়ী"} | পরিমাণ: ${line.quantity}`,
        p && p.price > 0 ? `পণ্যের মূল্য: ${money(p.price * line.quantity)}` : "মূল্য: নিশ্চিত করা প্রয়োজন",
        `${SITE_URL}/product/${encodeURIComponent(line.productId)}`].join("\n");
    }), "", "ডেলিভারি চার্জ ও পেমেন্টের নিয়মও জানাবেন। এটি দাম/স্টক জানার অনুরোধ, পেমেন্ট বা নিশ্চিত অর্ডার নয়।",
  ].join("\n");
}
