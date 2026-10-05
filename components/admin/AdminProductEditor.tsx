"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { collection, deleteField, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { categoryKeyForProduct, categoryName } from "@/lib/shop-categories";
import { isAllowedProductImage, safeImage, type Product } from "@/lib/atelier";
import { productStockState, stockLabel } from "@/lib/admin";
import { useCategoryOptions } from "./useCategoryOptions";

type Color = { name: string; image: string; stock: string };

function asProduct(id: string, raw: Record<string, unknown>): Product {
  const createdAt = raw.createdAt as { seconds?: number } | undefined;
  return {
    id,
    name: String(raw.name || "AVEN Product"),
    category: String(raw.category || "কালেকশন"),
    price: Number(raw.price || 0),
    oldPrice: Number(raw.oldPrice || 0),
    description: String(raw.description || ""),
    mainImage: safeImage(raw.mainImage),
    colors: Array.isArray(raw.colors)
      ? raw.colors.map((item) => ({
          name: String(item?.name || ""),
          image: safeImage(item?.image || raw.mainImage),
          stock: typeof item?.stock === "number" ? item.stock : undefined,
          available: item?.available !== false,
        }))
      : [],
    available: raw.available !== false,
    stock: typeof raw.stock === "number" ? raw.stock : undefined,
    createdAt: typeof createdAt?.seconds === "number" ? createdAt.seconds * 1000 : 0,
  };
}

export default function AdminProductEditor() {
  const categoryOptions = useCategoryOptions();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out" | "untracked">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
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

  async function load(preferId = selectedId) {
    setLoading(true);
    setMessage("");
    try {
      const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
      const data = snap.docs.map((item) => asProduct(item.id, item.data()));
      setProducts(data);
      const preferred = data.find((item) => item.id === preferId) || data[0];
      if (preferred) select(preferred);
    } catch {
      setMessage("Products load করা যায়নি। Firebase permission যাচাই করুন।");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(""); }, []);

  function select(product: Product) {
    setSelectedId(product.id);
    setMessage("");
    setForm({
      name: product.name,
      category: categoryName(categoryKeyForProduct(product)),
      price: String(product.price || ""),
      oldPrice: String(product.oldPrice || ""),
      description: product.description,
      mainImage: product.mainImage,
      available: product.available,
      colors: product.colors.map((color) => ({
        name: color.name,
        image: color.image,
        stock: typeof color.stock === "number" ? String(color.stock) : "",
      })),
    });
  }

  const filtered = useMemo(() => products.filter((product) => {
    const text = (product.name + " " + product.category + " " + product.colors.map((color) => color.name).join(" "))
      .toLocaleLowerCase("bn");
    const searchOkay = !search.trim() || text.includes(search.trim().toLocaleLowerCase("bn"));
    const state = productStockState(product);
    const stockOkay = stockFilter === "all" || state === stockFilter;
    return searchOkay && stockOkay;
  }), [products, search, stockFilter]);

  async function save() {
    if (!selectedId || saving) return;

    const price = Number(form.price);
    const oldPrice = form.oldPrice.trim() ? Number(form.oldPrice) : 0;
    const mainImage = form.mainImage.trim();

    if (
      !form.name.trim()
      || !form.category.trim()
      || !Number.isFinite(price)
      || price <= 0
      || !Number.isFinite(oldPrice)
      || oldPrice < 0
      || (oldPrice > 0 && oldPrice < price)
    ) {
      setMessage("Product name, category এবং সঠিক price দিন।");
      return;
    }

    if (!isAllowedProductImage(mainImage)) {
      setMessage("Main image হিসেবে /products/... path, Firebase image URL অথবা Cloudinary URL দিন।");
      return;
    }

    if (form.colors.some((color) => !color.name.trim())) {
      setMessage("প্রতিটি color-এর নাম দিন।");
      return;
    }

    if (new Set(form.colors.map((color) => color.name.trim())).size !== form.colors.length) {
      setMessage("একই color name একাধিকবার ব্যবহার করবেন না।");
      return;
    }

    if (form.colors.some((color) =>
      color.stock.trim()
      && (!Number.isInteger(Number(color.stock)) || Number(color.stock) < 0 || Number(color.stock) > 99999)
    )) {
      setMessage("Stock দিলে ০ থেকে ৯৯,৯৯৯-এর মধ্যে পূর্ণ সংখ্যা দিন।");
      return;
    }

    if (form.colors.some((color) => color.image.trim() && !isAllowedProductImage(color.image.trim()))) {
      setMessage("Color image-এ AVEN local image, Firebase image URL অথবা Cloudinary URL ব্যবহার করুন।");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const colors = form.colors.map((color) => ({
        name: color.name.trim(),
        image: color.image.trim() ? safeImage(color.image.trim()) : safeImage(mainImage),
        ...(color.stock.trim()
          ? { stock: Number(color.stock), available: Number(color.stock) > 0 }
          : {}),
      }));

      const tracked = form.colors.length > 0 && form.colors.every((color) => color.stock.trim());
      const totalStock = tracked
        ? form.colors.reduce((sum, color) => sum + Number(color.stock), 0)
        : null;

      await setDoc(doc(db, "products", selectedId), {
        name: form.name.trim(),
        category: form.category.trim(),
        price: Math.round(price * 100) / 100,
        oldPrice: Math.round(oldPrice * 100) / 100,
        discount: oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0,
        description: form.description.trim(),
        mainImage: safeImage(mainImage),
        colors,
        stock: totalStock === null ? deleteField() : totalStock,
        available: form.available && totalStock !== 0,
        published: form.available,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      try {
        window.dispatchEvent(new Event("aven:admin-refresh"));
        localStorage.setItem("aven:catalog-updated", String(Date.now()));
      } catch {
        // Optional cross-component refresh only.
      }

      setMessage("Product update হয়েছে।");
      await load(selectedId);
    } catch {
      setMessage("Product save করা যায়নি। Firestore permission ও connection যাচাই করুন।");
    } finally {
      setSaving(false);
    }
  }

  const selectedProduct = products.find((product) => product.id === selectedId);
  const preview = isAllowedProductImage(form.mainImage.trim()) ? safeImage(form.mainImage.trim()) : "/products/pink.png";

  return <div className="av-admin-editor">
    <aside className="av-admin-editor-list">
      <div className="av-admin-panel-head">
        <div>
          <h2>Products</h2>
          <p>Search, stock filter এবং edit</p>
        </div>
        <button className="av-admin-action" onClick={() => void load()}>Refresh</button>
      </div>

      <input
        className="av-admin-input"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Product, category বা color খুঁজুন…"
      />

      <select className="av-admin-select av-admin-product-filter" value={stockFilter} onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)}>
        <option value="all">সব stock</option>
        <option value="low">Low stock</option>
        <option value="out">Out of stock</option>
        <option value="untracked">Stock not tracked</option>
      </select>

      <div className="av-admin-editor-products">
        {loading ? <div className="av-admin-empty">Loading…</div> : filtered.length ? filtered.map((product) => {
          const state = productStockState(product);
          return <button
            type="button"
            className={selectedId === product.id ? "is-active" : ""}
            key={product.id}
            onClick={() => select(product)}
          >
            <span className="av-admin-product-thumb"><Image src={product.mainImage} alt="" fill sizes="64px" /></span>
            <span>
              <strong>{product.name}</strong>
              <small>{categoryName(categoryKeyForProduct(product))} · ৳ {new Intl.NumberFormat("bn-BD").format(product.price)}</small>
              <em className={"av-admin-stock-text is-" + state}>{stockLabel(product)}</em>
            </span>
          </button>;
        }) : <div className="av-admin-empty">এই filter-এ কোনো product নেই।</div>}
      </div>
    </aside>

    <section className="av-admin-editor-form">
      {!selectedId ? <div className="av-admin-empty">Edit করার জন্য একটি product select করুন।</div> : <>
        <div className="av-admin-panel-head">
          <div>
            <h2>Edit product</h2>
            <p>{selectedId}</p>
          </div>
          <div className="av-admin-product-badges">
            {selectedProduct && <span className={"av-admin-stock-badge is-" + productStockState(selectedProduct)}>{stockLabel(selectedProduct)}</span>}
            <span className={"av-admin-status " + (form.available ? "delivered" : "cancelled")}>{form.available ? "Visible" : "Hidden"}</span>
          </div>
        </div>

        <div className="av-admin-editor-note">
          <strong>Image URL mode</strong>
          <span>Direct file upload এখন intentionally বন্ধ। AVEN local path অথবা trusted Cloudinary/Firebase URL ব্যবহার করুন।</span>
        </div>

        <div className="av-admin-field-grid">
          <label>
            <span>Product name</span>
            <input value={form.name} maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            <span>Category</span>
            <input list="aven-admin-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          </label>
          <datalist id="aven-admin-categories">{categoryOptions.map((name) => <option key={name} value={name} />)}</datalist>

          <label>
            <span>Sale price</span>
            <input type="number" min="1" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
          </label>
          <label>
            <span>Previous price</span>
            <input type="number" min="0" step="0.01" value={form.oldPrice} onChange={(event) => setForm({ ...form, oldPrice: event.target.value })} />
          </label>
        </div>

        <label className="av-admin-field">
          <span>Main image URL / AVEN path</span>
          <input value={form.mainImage} onChange={(event) => setForm({ ...form, mainImage: event.target.value })} placeholder="/products/pink.png অথবা https://res.cloudinary.com/..." spellCheck={false} />
        </label>

        <div className="av-admin-image-edit">
          <div className="av-admin-main-preview"><Image src={preview} alt={form.name || "Product"} fill sizes="220px" /></div>
          <div className="av-admin-image-help">
            <strong>Supported now</strong>
            <span>/products/... local images</span>
            <span>Firebase HTTPS image URLs</span>
            <span>Cloudinary HTTPS image URLs</span>
          </div>
        </div>

        <label className="av-admin-field">
          <span>Description</span>
          <textarea rows={5} maxLength={3000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>

        <div className="av-admin-variant-editor">
          <div className="av-admin-panel-head">
            <div><h2>Colors & stock</h2><p>প্রতিটি color-এর stock আলাদা করে track করা যাবে।</p></div>
            <button className="av-admin-action" type="button" onClick={() => setForm({
              ...form,
              colors: [...form.colors, { name: "", image: form.mainImage, stock: "" }],
            })}>+ Color</button>
          </div>

          {form.colors.map((color, index) => <div className="av-admin-variant-row" key={index}>
            <input value={color.name} placeholder="Color name" onChange={(event) => setForm({
              ...form,
              colors: form.colors.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item),
            })} />
            <input type="number" min="0" max="99999" step="1" value={color.stock} placeholder="Stock (optional)" onChange={(event) => setForm({
              ...form,
              colors: form.colors.map((item, itemIndex) => itemIndex === index ? { ...item, stock: event.target.value } : item),
            })} />
            <input value={color.image} placeholder="Image URL (optional)" spellCheck={false} onChange={(event) => setForm({
              ...form,
              colors: form.colors.map((item, itemIndex) => itemIndex === index ? { ...item, image: event.target.value } : item),
            })} />
            <button className="av-admin-action danger" type="button" onClick={() => setForm({
              ...form,
              colors: form.colors.filter((_, itemIndex) => itemIndex !== index),
            })}>Remove</button>
          </div>)}
        </div>

        <label className="av-admin-visibility">
          <input type="checkbox" checked={form.available} onChange={(event) => setForm({ ...form, available: event.target.checked })} />
          <span>
            <strong>Show on storefront</strong>
            <small>Off করলে product delete হবে না; customer-এর কাছে hidden থাকবে।</small>
          </span>
        </label>

        <div className="av-admin-savebar">
          <button className="av-admin-action primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <a className="av-admin-action" href={"/product/" + encodeURIComponent(selectedId)} target="_blank" rel="noopener noreferrer">View product ↗</a>
        </div>

        {message && <div className="av-admin-security" role="status">{message}</div>}
      </>}
    </section>
  </div>;
}
