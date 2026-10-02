"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FEATURED_SHOP_CATEGORIES } from "@/lib/shop-categories";
import type { Product } from "@/lib/atelier";

type CategoryRecord = {
  id: string;
  name: string;
  description: string;
  position: number;
  published: boolean;
};

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function CategoryManager({ products }: { products: Product[] }) {
  const [records, setRecords] = useState<CategoryRecord[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const snap = await getDocs(query(collection(db, "categories"), orderBy("position", "asc")));
      setRecords(snap.docs.map((item) => ({
        id: item.id,
        name: String(item.data().name || ""),
        description: String(item.data().description || ""),
        position: Number(item.data().position || 0),
        published: item.data().published !== false,
      })).filter((item) => item.name));
    } catch {
      setMessage("Custom categories load করা যায়নি। Permission যাচাই করুন।");
    }
  }

  useEffect(() => { void load(); }, []);

  const names = useMemo(() => new Set(products.map((product) => product.category.trim())), [products]);

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    const nextName = cleanName(name);
    if (nextName.length < 2 || nextName.length > 80) {
      setMessage("Category name ২ থেকে ৮০ অক্ষরের মধ্যে দিন।");
      return;
    }
    if (FEATURED_SHOP_CATEGORIES.some((item) => item.name === nextName) || records.some((item) => item.name === nextName)) {
      setMessage("এই category আগে থেকেই আছে।");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const id = "cat-" + crypto.randomUUID().slice(0, 12);
      await setDoc(doc(db, "categories", id), {
        name: nextName,
        description: description.trim(),
        position: FEATURED_SHOP_CATEGORIES.length + records.length,
        published: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setName("");
      setDescription("");
      setMessage("নতুন category তৈরি হয়েছে। এখন Add/Edit Product থেকে এই category নির্বাচন করুন।");
      await load();
    } catch {
      setMessage("Category তৈরি করা যায়নি। Firebase permission যাচাই করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category: CategoryRecord) {
    if (names.has(category.name)) {
      setMessage("এই category-তে product আছে। আগে product অন্য category-তে সরান বা hide করুন।");
      return;
    }
    if (!window.confirm(category.name + " category সরাবেন?")) return;
    setBusy(true);
    setMessage("");
    try {
      await deleteDoc(doc(db, "categories", category.id));
      setMessage("Empty custom category সরানো হয়েছে।");
      await load();
    } catch {
      setMessage("Category remove করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return <div className="av-admin-category-manager">
    <div className="av-admin-categories">
      {FEATURED_SHOP_CATEGORIES.map((category) => {
        const count = products.filter((product) => product.category === category.name ||
          (category.key === "kushikata" && ["aven-rose-shawl","aven-blue-shawl","aven-golden-shawl"].includes(product.id))).length;
        return <article className={"av-admin-category " + (count ? "" : "is-empty")} key={category.key}>
          <small>{category.eyebrow}</small>
          <h3>{category.name}</h3>
          <strong>{new Intl.NumberFormat("bn-BD").format(count)}</strong>
          <p>{category.description}</p>
          <span className="av-admin-category-lock">Core category</span>
        </article>;
      })}

      {records.map((category) => {
        const count = products.filter((product) => product.category === category.name).length;
        return <article className={"av-admin-category " + (count ? "" : "is-empty")} key={category.id}>
          <small>CUSTOM COLLECTION</small>
          <h3>{category.name}</h3>
          <strong>{new Intl.NumberFormat("bn-BD").format(count)}</strong>
          <p>{category.description || "Custom AVEN collection"}</p>
          <button type="button" className="av-admin-action danger" disabled={busy || count > 0} onClick={() => void removeCategory(category)}>
            {count > 0 ? "Product আছে" : "Remove empty category"}
          </button>
        </article>;
      })}
    </div>

    <form className="av-admin-category-create" onSubmit={(event) => void addCategory(event)}>
      <div>
        <p className="av-admin-kicker">NEW COLLECTION</p>
        <h2>নতুন category তৈরি করুন</h2>
        <p>Category তৈরি করার পর Product section থেকে সেই category-তে products publish করুন।</p>
      </div>
      <label>Category name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="যেমন: এমব্রয়ডারি চাদর" required /></label>
      <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} rows={3} placeholder="Homepage collection-এর ছোট description" /></label>
      <button className="av-admin-action primary" disabled={busy}>{busy ? "Creating…" : "Create category"}</button>
    </form>

    {message && <div className="av-admin-security" role="status">{message}</div>}
  </div>;
}
