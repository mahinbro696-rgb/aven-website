"use client";

import { useState } from "react";
import ProductManager from "@/components/ProductManager";
import AdminProductEditor from "./AdminProductEditor";

export default function ProductSection() {
  const [mode, setMode] = useState<"add" | "edit">("edit");

  return <div className="av-admin-products">
    <div className="av-admin-panel-head">
      <div><h2>Product management</h2><p>নতুন product publish করুন অথবা existing product edit করুন।</p></div>
      <div className="av-admin-segmented">
        <button type="button" className={mode === "edit" ? "is-active" : ""} onClick={() => setMode("edit")}>Edit products</button>
        <button type="button" className={mode === "add" ? "is-active" : ""} onClick={() => setMode("add")}>+ Add product</button>
      </div>
    </div>
    {mode === "edit" ? <AdminProductEditor /> : <ProductManager />}
  </div>;
}
