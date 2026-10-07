"use client";

import { useEffect, useState } from "react";
import type { ShopCategory } from "@/lib/shop-categories";

export function useShopCategories() {
  const [categories, setCategories] = useState<ShopCategory[]>([]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch("/api/categories", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data.success !== true || !Array.isArray(data.categories)) return;
        if (active) setCategories(data.categories);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return categories;
}
