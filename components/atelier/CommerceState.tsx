"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { addLine, CART_KEY, readBag, removePurchased, selection, unitCount, type BagLine } from "@/lib/commerce";
import type { Product } from "@/lib/atelier";

let fallback = "[]";
let memoryOnly = false;
function snapshot(): string {
  if (memoryOnly) return fallback;
  try { return localStorage.getItem(CART_KEY) || fallback; } catch { return fallback; }
}
function subscribe(listener: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== CART_KEY && event.key !== null) return;
    fallback = event.newValue || "[]"; memoryOnly = false; listener();
  };
  window.addEventListener("storage", sync); window.addEventListener("aven:bag", listener);
  return () => { window.removeEventListener("storage", sync); window.removeEventListener("aven:bag", listener); };
}
function persist(lines: BagLine[]) {
  fallback = JSON.stringify(lines);
  try { localStorage.setItem(CART_KEY, fallback); memoryOnly = false; } catch { memoryOnly = true; }
  window.dispatchEvent(new Event("aven:bag"));
}
type Panel = { type: "bag" } | { type: "checkout"; items: BagLine[]; source: "bag" | "direct"; key: string } | null;
type Commerce = {
  lines: BagLine[]; count: number; panel: Panel; notice: string;
  openBag: () => void; close: () => void; inform: (message: string) => void;
  add: (product: Product, color?: string, quantity?: number) => boolean;
  buy: (product: Product, color?: string, quantity?: number) => void;
  replace: (lines: BagLine[]) => void; checkout: () => void;
  purchased: (lines: BagLine[]) => void;
};
const Context = createContext<Commerce | null>(null);
export function CommerceProvider({ children }: { children: ReactNode }) {
  const json = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const lines = useMemo(() => readBag(json), [json]);
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const inform = useCallback((message: string) => setNotice(message), []);
  const close = useCallback(() => setPanel(null), []);
  const openBag = useCallback(() => setPanel({ type: "bag" }), []);
  const add = useCallback((product: Product, color = "", quantity = 1) => {
    try {
      persist(addLine(readBag(snapshot()), selection(product, color, quantity)));
      setNotice("আপনার Shopping Bag-এ যোগ হয়েছে"); setPanel({ type: "bag" }); return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "পণ্য যোগ করা যায়নি।"); return false; }
  }, []);
  const buy = useCallback((product: Product, color = "", quantity = 1) => {
    try { setPanel({ type: "checkout", items: [selection(product, color, quantity)], source: "direct", key: crypto.randomUUID() }); }
    catch (error) { setNotice(error instanceof Error ? error.message : "পণ্য নির্বাচন করুন।"); }
  }, []);
  const replace = useCallback((next: BagLine[]) => persist(next), []);
  const checkout = useCallback(() => {
    const items = readBag(snapshot());
    if (items.length) setPanel({ type: "checkout", items, source: "bag", key: crypto.randomUUID() });
  }, []);
  const purchased = useCallback((items: BagLine[]) => persist(removePurchased(readBag(snapshot()), items)), []);
  return <Context.Provider value={{ lines, count: unitCount(lines), panel, notice, openBag, close, inform, add, buy, replace, checkout, purchased }}>{children}</Context.Provider>;
}
export function useCommerce(): Commerce {
  const value = useContext(Context);
  if (!value) throw new Error("CommerceProvider is required");
  return value;
}
