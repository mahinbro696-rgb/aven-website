"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ProductManager from "@/components/ProductManager";
import AdminProductEditor from "./AdminProductEditor";

export default function ProductSection() {
  const [mode, setMode] = useState<"add" | "edit">("edit");
  const reducedMotion = useReducedMotion();

  return <div className="av-admin-products">
    <div className="av-admin-panel-head">
      <div><h2>Product management</h2><p>নতুন product publish করুন অথবা existing product edit করুন।</p></div>
      <div className="av-admin-segmented">
        <button type="button" className={mode === "edit" ? "is-active" : ""} onClick={() => setMode("edit")}>Edit products</button>
        <button type="button" className={mode === "add" ? "is-active" : ""} onClick={() => setMode("add")}>+ Add product</button>
      </div>
    </div>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={mode} initial={reducedMotion ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? undefined : { opacity: 0, x: -18 }} transition={{ duration: reducedMotion ? 0 : .3 }}>
        {mode === "edit" ? <AdminProductEditor /> : <ProductManager />}
      </motion.div>
    </AnimatePresence>
  </div>;
}
