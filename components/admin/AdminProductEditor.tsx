"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { collection, deleteField, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { categoryKeyForProduct, categoryName } from "@/lib/shop-categories";
import type { Product } from "@/lib/atelier";
import { useCategoryOptions } from "./useCategoryOptions";

type Color = { name: string; image: string; file?: File | null; stock: string };

function asProduct(id: string, raw: Record<string, unknown>): Product {
  return {
    id,
    name: String(raw.name || "AVEN Product"),
    category: String(raw.category || "কালেকশন"),
    price: Number(raw.price || 0),
    oldPrice: Number(raw.oldPrice || 0),
    description: String(raw.description || ""),
    mainImage: String(raw.mainImage || "/products/pink.png"),
    colors: Array.isArray(raw.colors) ? raw.colors.map((item) => ({ name: String(item?.name || ""), image: String(item?.image || raw.mainImage || "/products/pink.png"), stock: typeof item?.stock === "number" ? item.stock : undefined })) : [],
    available: raw.available !== false,
    createdAt: typeof (raw.createdAt as { seconds?: number })?.seconds === "number"
      ? Number((raw.createdAt as { seconds?: number }).seconds) * 1000
      : 0,
  };
}

async function upload(file: File, productId: string) {
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1] || "webp";
  const target = ref(storage, "products/" + productId + "/" + crypto.randomUUID() + "." + ext);
  await uploadBytes(target, file, { contentType: file.type });
  return getDownloadURL(target);
}

export default function AdminProductEditor() {
  const categoryOptions = useCategoryOptions();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "কুশিকাটা চাদর",
    price: "",
    oldPrice: "",
    description: "",
    mainImage: "",
    available: true,
    colors: [] as Color[],
  });

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
      const data = snap.docs.map((item) => asProduct(item.id, item.data()));
      setProducts(data);
      if (!selectedId && data[0]) select(data[0]);
    } catch {
      setMessage("Products load করা যায়নি। Firebase permission যাচাই করুন।");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function select(product: Product) {
    setSelectedId(product.id);
    setMainFile(null);
    setMessage("");
    setForm({
      name: product.name,
      category: categoryName(categoryKeyForProduct(product)),
      price: String(product.price || ""),
      oldPrice: String(product.oldPrice || ""),
      description: product.description,
      mainImage: product.mainImage,
      available: product.available,
      colors: product.colors.map((color) => ({ ...color, file: null, stock: typeof color.stock === "number" ? String(color.stock) : "" })),
    });
  }

  const filtered = useMemo(() => products.filter((product) =>
    (product.name + " " + product.category + " " + product.colors.map((color) => color.name).join(" "))
      .toLocaleLowerCase("bn")
      .includes(search.trim().toLocaleLowerCase("bn"))
  ), [products, search]);

  async function save() {
    if (!selectedId || saving) return;
    const price = Number(form.price);
    const oldPrice = form.oldPrice.trim() ? Number(form.oldPrice) : 0;
    if (!form.name.trim() || !form.category.trim() || !Number.isFinite(price) || price <= 0 || !Number.isFinite(oldPrice) || oldPrice < 0 || (oldPrice > 0 && oldPrice < price)) {
      setMessage("Product name, category এবং সঠিক price দিন।");
      return;
    }
    if (form.colors.some((color) => !color.name.trim())) {
      setMessage("প্রতিটি color-এর নাম দিন।");
      return;
    }
    if (form.colors.some((color) => color.stock.trim() && (!Number.isInteger(Number(color.stock)) || Number(color.stock) < 0 || Number(color.stock) > 99999))) {
      setMessage("Stock দিলে ০ থেকে ৯৯,৯৯৯-এর মধ্যে পূর্ণ সংখ্যা দিন।");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const mainImage = mainFile ? await upload(mainFile, selectedId) : form.mainImage;
      const colors = await Promise.all(form.colors.map(async (color) => ({
        name: color.name.trim(),
        image: color.file ? await upload(color.file, selectedId) : (color.image || mainImage),
        ...(color.stock.trim() ? { stock: Number(color.stock), available: Number(color.stock) > 0 } : {}),
      })));
      const tracked = form.colors.length > 0 && form.colors.every((color) => color.stock.trim());
      const totalStock = tracked ? form.colors.reduce((sum, color) => sum + Number(color.stock), 0) : null;

      await setDoc(doc(db, "products", selectedId), {
        name: form.name.trim(),
        category: form.category.trim(),
        price: Math.round(price * 100) / 100,
        oldPrice: Math.round(oldPrice * 100) / 100,
        discount: oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0,
        description: form.description.trim(),
        mainImage,
        colors,
        stock: totalStock === null ? deleteField() : totalStock,
        available: form.available && totalStock !== 0,
        published: form.available,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setMessage("Product update হয়েছে।");
      await load();
    } catch {
      setMessage("Product save করা যায়নি। Firebase permission বা image upload access যাচাই করুন।");
    } finally {
      setSaving(false);
    }
  }

  return <div className="av-admin-editor">
    <aside className="av-admin-editor-list">
      <div className="av-admin-panel-head">
        <div><h2>Published products</h2><p>একটি product select করে edit করুন।</p></div>
        <button className="av-admin-action" onClick={() => void load()}>Refresh</button>
      </div>
      <input className="av-admin-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product বা color খুঁজুন…" />
      <div className="av-admin-editor-products">
        {loading ? <div className="av-admin-empty">Loading…</div> : filtered.map((product) => <button type="button" className={selectedId === product.id ? "is-active" : ""} key={product.id} onClick={() => select(product)}>
          <span className="av-admin-product-thumb"><Image src={product.mainImage} alt="" fill sizes="64px" /></span>
          <span><strong>{product.name}</strong><small>{categoryName(categoryKeyForProduct(product))} · ৳ {new Intl.NumberFormat("bn-BD").format(product.price)}</small></span>
        </button>)}
      </div>
    </aside>

    <section className="av-admin-editor-form">
      {!selectedId ? <div className="av-admin-empty">Edit করার জন্য একটি product select করুন।</div> : <>
        <div className="av-admin-panel-head">
          <div><h2>Edit product</h2><p>{selectedId}</p></div>
          <span className={"av-admin-status " + (form.available ? "delivered" : "cancelled")}>{form.available ? "Visible" : "Hidden"}</span>
        </div>

        <div className="av-admin-field-grid">
          <label><span>Product name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label><span>Category</span><input list="aven-admin-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
          <datalist id="aven-admin-categories">{categoryOptions.map((name) => <option key={name} value={name} />)}</datalist>
          <label><span>Sale price</span><input type="number" min="1" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <label><span>Previous price</span><input type="number" min="0" step="0.01" value={form.oldPrice} onChange={(event) => setForm({ ...form, oldPrice: event.target.value })} /></label>
        </div>

        <label className="av-admin-field"><span>Description</span><textarea rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>

        <div className="av-admin-image-edit">
          <div className="av-admin-main-preview"><Image src={form.mainImage || "/products/pink.png"} alt={form.name || "Product"} fill sizes="220px" /></div>
          <label className="av-admin-field"><span>Replace main image</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setMainFile(event.target.files?.[0] || null)} /><small>{mainFile ? mainFile.name : "বর্তমান image থাকবে"}</small></label>
        </div>

        <div className="av-admin-variant-editor">
          <div className="av-admin-panel-head"><div><h2>Colors</h2><p>এক product-এর color variants</p></div><button className="av-admin-action" type="button" onClick={() => setForm({ ...form, colors: [...form.colors, { name: "", image: form.mainImage, file: null, stock: "" }] })}>+ Color</button></div>
          {form.colors.map((color, index) => <div className="av-admin-variant-row" key={index}>
            <input value={color.name} placeholder="Color name" onChange={(event) => setForm({ ...form, colors: form.colors.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} />
            <input type="number" min="0" max="99999" step="1" value={color.stock} placeholder="Stock (optional)" onChange={(event) => setForm({ ...form, colors: form.colors.map((item, itemIndex) => itemIndex === index ? { ...item, stock: event.target.value } : item) })} />
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setForm({ ...form, colors: form.colors.map((item, itemIndex) => itemIndex === index ? { ...item, file } : item) });
            }} />
            <button className="av-admin-action danger" type="button" onClick={() => setForm({ ...form, colors: form.colors.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button>
          </div>)}
        </div>

        <label className="av-admin-visibility"><input type="checkbox" checked={form.available} onChange={(event) => setForm({ ...form, available: event.target.checked })} /><span><strong>Show on storefront</strong><small>Off করলে product delete হবে না; customer-এর কাছে hidden থাকবে।</small></span></label>

        <div className="av-admin-savebar">
          <button className="av-admin-action primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</button>
          <LinkToProduct id={selectedId} />
        </div>
        {message && <div className="av-admin-security" role="status">{message}</div>}
      </>}
    </section>
  </div>;
}

function LinkToProduct({ id }: { id: string }) {
  return <a className="av-admin-action" href={"/product/" + encodeURIComponent(id)} target="_blank" rel="noopener noreferrer">View product ↗</a>;
}
