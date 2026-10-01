"use client";
import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/lib/atelier";
import { SHOWROOM } from "@/lib/showroom";

type CatalogStatus = "checking" | "ready" | "empty" | "unavailable";
export function useCatalog() {
  const [products, setProducts] = useState<Product[]>(SHOWROOM);
  const [status, setStatus] = useState<CatalogStatus>("checking");
  const [retry, setRetry] = useState(0);
  const reload = useCallback(() => setRetry((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 18000);
    setStatus("checking");
    fetch("/api/catalog", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || data.success !== true || !Array.isArray(data.products)) throw new Error("Catalog unavailable");
      if (!active) return;
      const records = data.products as Product[];
      if (records.some((p) => !p || typeof p.id !== "string" || typeof p.name !== "string" || !Array.isArray(p.colors))) throw new Error("Invalid catalog");
      // Existing photos stay inquiry-only until the owner publishes their price.
      setProducts([...records, ...SHOWROOM.filter((p) => !records.some((r) => r.id === p.id))]);
      setStatus(records.length ? "ready" : "empty");
    }).catch(() => {
      if (active) { setProducts(SHOWROOM); setStatus("unavailable"); }
    }).finally(() => window.clearTimeout(timer));
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [retry]);
  useEffect(() => {
    const refresh = (event: StorageEvent) => { if (event.key === "aven:catalog-updated") reload(); };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [reload]);
  return { products, status, reload };
}
