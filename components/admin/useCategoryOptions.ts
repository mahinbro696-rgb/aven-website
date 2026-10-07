"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FEATURED_SHOP_CATEGORIES } from "@/lib/shop-categories";

const defaults = FEATURED_SHOP_CATEGORIES.map((item) => item.name);

export function useCategoryOptions() {
  const [options, setOptions] = useState<string[]>(defaults);

  useEffect(() => {
    let active = true;
    getDocs(query(collection(db, "categories"), orderBy("position", "asc")))
      .then((snapshot) => {
        if (!active) return;
        const custom = snapshot.docs
          .map((item) => String(item.data().name || "").trim())
          .filter(Boolean);
        setOptions([...new Set([...defaults, ...custom])]);
      })
      .catch(() => {
        if (active) setOptions(defaults);
      });
    return () => { active = false; };
  }, []);

  return options;
}
