import type { Product } from "@/lib/atelier";

export const ORDER_STATUSES = ["Pending", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled"] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const LOW_STOCK_THRESHOLD = 5;

export function normalizeOrderStatus(value: unknown): OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus) ? value as OrderStatus : "Pending";
}

export function nextOrderStatus(value: unknown): OrderStatus | null {
  const status = normalizeOrderStatus(value);
  if (status === "Pending") return "Confirmed";
  if (status === "Confirmed") return "Packed";
  if (status === "Packed") return "Shipped";
  if (status === "Shipped") return "Delivered";
  return null;
}

export function canCancelOrder(value: unknown): boolean {
  const status = normalizeOrderStatus(value);
  return status !== "Delivered" && status !== "Cancelled";
}

export function productTrackedStock(product: Product): number | null {
  if (typeof product.stock === "number" && Number.isFinite(product.stock) && product.stock >= 0) return product.stock;
  const tracked = product.colors.filter((color) => typeof color.stock === "number" && Number.isFinite(color.stock) && color.stock >= 0);
  if (!tracked.length || tracked.length !== product.colors.length) return null;
  return tracked.reduce((sum, color) => sum + Number(color.stock || 0), 0);
}

export function productStockState(product: Product): "untracked" | "healthy" | "low" | "out" {
  const total = productTrackedStock(product);
  if (total === null) return "untracked";
  if (total === 0) return "out";
  if (total <= LOW_STOCK_THRESHOLD) return "low";
  return "healthy";
}

export function stockLabel(product: Product): string {
  const total = productTrackedStock(product);
  if (total === null) return "Stock not tracked";
  if (total === 0) return "Out of stock";
  if (total <= LOW_STOCK_THRESHOLD) return `Low stock · ${total}`;
  return `Stock · ${total}`;
}
