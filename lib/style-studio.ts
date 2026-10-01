import type { Product } from "./atelier";
import { addLine, selection, toMinor, validateLines, type BagLine } from "./commerce";

/** Shared links contain public product references only, never prices or customer data. */
export function encodeEdit(lines: BagLine[]): string {
  return JSON.stringify({ v: 1, items: validateLines(lines).map(({ productId, color, quantity }) => [productId, color, quantity]) });
}
export function decodeEdit(value: string): BagLine[] {
  if (value.length > 12000) throw new Error("শেয়ার করা তালিকাটি অনেক বড়।");
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { throw new Error("শেয়ার করা লিংকটি সঠিক নয়।"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("শেয়ার করা লিংকটি সঠিক নয়।");
  const data = raw as Record<string, unknown>;
  if (data.v !== 1 || !Array.isArray(data.items)) throw new Error("এই তালিকার সংস্করণ সমর্থিত নয়।");
  return validateLines(data.items.map((item: unknown) => {
    if (!Array.isArray(item) || item.length !== 3 || typeof item[0] !== "string" || typeof item[1] !== "string") throw new Error("শেয়ার করা পণ্যের তথ্য সঠিক নয়।");
    return { productId: item[0], color: item[1], quantity: item[2] };
  }));
}
export function editUrl(lines: BagLine[], origin: string): string {
  const url = new URL("/", origin);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("লিংক তৈরি করা যায়নি।");
  url.searchParams.set("edit", encodeEdit(lines));
  url.hash = "style-studio";
  return url.href;
}
export function selectionIssue(line: BagLine, products: Product[]): string {
  const product = products.find((p) => p.id === line.productId);
  if (!product) return "এই পণ্যটি এখন তালিকায় নেই। সরিয়ে অন্যটি নিন।";
  if (!product.available || product.price <= 0 || !Number.isFinite(product.price)) return "এই পণ্যটি এখন অনলাইনে অর্ডার করা যাচ্ছে না।";
  if (product.colors.length && !product.colors.some((color) => color.name === line.color)) return "এই রঙটি এখন পাওয়া যাচ্ছে না। অন্য রঙ বেছে নিন।";
  return "";
}
export function checkedEdit(raw: BagLine[], products: Product[]): BagLine[] {
  const lines = validateLines(raw);
  return lines.map((line) => {
    const issue = selectionIssue(line, products);
    if (issue) throw new Error(issue);
    const product = products.find((p) => p.id === line.productId)!;
    return selection(product, line.color, line.quantity);
  });
}
/** Pure calculation: callers persist only after every line validates successfully. */
export function mergeEdit(current: BagLine[], incoming: BagLine[], products: Product[]): BagLine[] {
  return checkedEdit(incoming, products).reduce((result, line) => addLine(result, line), current);
}
export function editTotals(lines: BagLine[], products: Product[]): { subtotal: number; saving: number; complete: boolean } {
  let minor = 0; let saving = 0;
  const complete = lines.length > 0 && lines.every((line) => !selectionIssue(line, products));
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId);
    if (!product || selectionIssue(line, products)) continue;
    minor += toMinor(product.price) * line.quantity;
    saving += Math.max(0, toMinor(product.oldPrice) - toMinor(product.price)) * line.quantity;
  }
  return { subtotal: minor / 100, saving: saving / 100, complete };
}
