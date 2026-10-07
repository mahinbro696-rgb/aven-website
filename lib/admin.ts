import type { Product } from "@/lib/atelier";

export const ORDER_STATUSES = ["Pending", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled"] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const LOW_STOCK_THRESHOLD = 5;

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\t\r\n]/.test(text) || /^\s*[=+\-@]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

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


export function maskEmail(value: string): string {
  const email = value.trim();
  const at = email.indexOf("@");
  if (at <= 0) return maskPersonalText(email);
  const local = Array.from(email.slice(0, at));
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length)).join("");
  const hidden = "*".repeat(Math.max(4, local.length - visible.length));
  return visible + hidden + "@" + domain;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "—";
  if (digits.length < 7) return "*".repeat(Math.max(6, digits.length));
  const prefix = digits.slice(0, Math.min(3, digits.length - 4));
  const suffix = digits.slice(-3);
  return prefix + "*".repeat(Math.max(5, digits.length - prefix.length - suffix.length)) + suffix;
}

export function maskPersonalText(value: string): string {
  const text = value.trim();
  if (!text) return "—";
  return text.split(/\s+/).map((word) => {
    const chars = Array.from(word);
    if (chars.length <= 1) return "*";
    if (chars.length === 2) return chars[0] + "*";
    return chars[0] + "*".repeat(Math.min(8, chars.length - 1));
  }).join(" ");
}

export function privateAddressPlaceholder(value: string): string {
  return value.trim() ? "•••••••• •••••••• ••••••••" : "—";
}
