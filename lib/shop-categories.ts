import type { Product } from "./atelier";

export type ShopCategory = {
  key: string;
  name: string;
  eyebrow: string;
  description: string;
};

export const FEATURED_SHOP_CATEGORIES: ShopCategory[] = [
  {
    key: "kushikata",
    name: "কুশিকাটা চাদর",
    eyebrow: "KUSHIKATA EDIT",
    description: "রঙ ও নকশা অনুযায়ী কুশিকাটা চাদরের সব প্রকাশিত পণ্য এক জায়গায় দেখুন।",
  },
  {
    key: "jamdani",
    name: "জামদানি চাদর",
    eyebrow: "JAMDANI EDIT",
    description: "জামদানি চাদরের প্রকাশিত ডিজাইনগুলো এই collection-এর নিচে সাজানো থাকবে।",
  },
  {
    key: "premium-shawl",
    name: "প্রিমিয়াম শাল",
    eyebrow: "SEASONAL EDIT",
    description: "প্রিমিয়াম শালের নতুন ডিজাইন প্রকাশ হলে এখান থেকেই সরাসরি দেখা যাবে।",
  },
];

const currentKushikataIds = new Set([
  "aven-rose-shawl",
  "aven-blue-shawl",
  "aven-golden-shawl",
]);

export function categoryKeyForProduct(product: Product): string {
  if (currentKushikataIds.has(product.id)) return "kushikata";

  const value = product.category.trim().toLocaleLowerCase("bn");
  if (value.includes("জামদানি")) return "jamdani";
  if (value.includes("কুশি") || value.includes("কুশি") || value.includes("কুশিকাটা")) return "kushikata";
  if (value.includes("শাল") || value.includes("shawl")) return "premium-shawl";

  return `custom:${product.category.trim() || "অন্যান্য"}`;
}

export function categoryName(key: string): string {
  const preset = FEATURED_SHOP_CATEGORIES.find((item) => item.key === key);
  return preset?.name || (key.startsWith("custom:") ? key.slice(7) : key);
}

export function categoryDefinition(key: string): ShopCategory {
  const preset = FEATURED_SHOP_CATEGORIES.find((item) => item.key === key);
  if (preset) return preset;

  const name = categoryName(key);
  return {
    key,
    name,
    eyebrow: "AVEN COLLECTION",
    description: `${name} category-র প্রকাশিত পণ্যগুলো এখানে সাজানো থাকবে।`,
  };
}

export function productCategories(products: Product[], managed: ShopCategory[] = []): ShopCategory[] {
  const actualKeys = [...new Set(products.map(categoryKeyForProduct))];
  const base = [...FEATURED_SHOP_CATEGORIES];
  for (const item of managed) {
    const index = base.findIndex((current) => current.key === item.key || current.name === item.name);
    if (index >= 0) base[index] = { ...base[index], ...item };
    else base.push(item);
  }
  const custom = actualKeys
    .filter((key) => !base.some((item) => item.key === key || item.name === categoryName(key)))
    .map(categoryDefinition);

  return [...base, ...custom];
}

export function productsInCategory(products: Product[], key: string): Product[] {
  return products.filter((product) => categoryKeyForProduct(product) === key);
}

export function normalizeCategorySelection(value: string, products: Product[]): string {
  if (!value) return "";
  if (FEATURED_SHOP_CATEGORIES.some((item) => item.key === value)) return value;
  const exact = products.find((product) => product.category === value);
  return exact ? categoryKeyForProduct(exact) : value;
}
