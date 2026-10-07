"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import AdminIcon from "@/components/admin/AdminIcon";
import { collection, deleteField, doc, getDocFromServer, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SHOWROOM } from "@/lib/showroom";
import { isAllowedProductImage, safeImage } from "@/lib/atelier";
import { useCategoryOptions } from "@/components/admin/useCategoryOptions";
import ProductImageUpload from "@/components/admin/ProductImageUpload";
import { useAdminDraftGuard, useProductUploads } from "@/components/admin/useProductUploads";

type Variant = { key: string; name: string; url: string; stock: string };

const initial = {
  name: SHOWROOM[0].name,
  category: "কুশিকাটা চাদর",
  price: "",
  oldPrice: "",
  description: "",
};

function codeOf(error: unknown): string {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "";
}

async function timeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("TIMEOUT")), 25000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function ProductManager() {
  const categoryOptions = useCategoryOptions();
  const reducedMotion = useReducedMotion();
  const [form, setForm] = useState(initial);
  const [selectedId, setSelectedId] = useState(SHOWROOM[0].id);
  const [imageUrl, setImageUrl] = useState(SHOWROOM[0].mainImage);
  const [variants, setVariants] = useState<Variant[]>([
    {
      key: "first",
      name: SHOWROOM[0].colors[0].name,
      url: SHOWROOM[0].mainImage,
      stock: "",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const stableId = useRef("");
  const lock = useRef(false);
  const uploads = useProductUploads();
  const snapshot = JSON.stringify({ form, imageUrl, variants });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  useAdminDraftGuard(snapshot !== savedSnapshot, busy || uploads.uploading);

  function choose(id: string) {
    if (busy || uploads.pending.current.size) return;
    if (snapshot !== savedSnapshot && !window.confirm("বর্তমান পরিবর্তন বাদ দিয়ে এই product দিয়ে শুরু করবেন?")) return;
    const seed = SHOWROOM.find((product) => product.id === id);
    setSelectedId(id);
    stableId.current = id;
    setMessage("");
    setSuccess(false);
    setForm({
      name: seed?.name || "",
      category: "কুশিকাটা চাদর",
      price: "",
      oldPrice: "",
      description: "",
    });
    setImageUrl(seed?.mainImage || "");
    setVariants(seed
      ? seed.colors.map((color, index) => ({
          key: String(index),
          name: color.name,
          url: color.image,
          stock: typeof color.stock === "number" ? String(color.stock) : "",
        }))
      : []
    );
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || uploads.pending.current.size) return;

    setSuccess(false);
    setMessage("");

    const price = Number(form.price);
    const oldPrice = form.oldPrice.trim() ? Number(form.oldPrice) : 0;
    const mainImage = imageUrl.trim();

    if (
      !form.name.trim()
      || !form.category.trim()
      || !Number.isFinite(price)
      || price <= 0
      || price > 1000000
      || !Number.isFinite(oldPrice)
      || oldPrice < 0
      || (oldPrice > 0 && oldPrice < price)
    ) {
      setMessage("পণ্যের নাম ও সঠিক বিক্রয়মূল্য দিন। পুরোনো মূল্য থাকলে তা বিক্রয়মূল্যের চেয়ে কম হবে না।");
      return;
    }

    if (!isAllowedProductImage(mainImage)) {
      setMessage("Main image হিসেবে /products/... path, Firebase image URL অথবা Cloudinary URL দিন।");
      return;
    }

    const names = variants.map((variant) => variant.name.trim());
    if (names.some((name) => !name) || new Set(names).size !== names.length) {
      setMessage("প্রতিটি রঙের আলাদা নাম দিন।");
      return;
    }

    if (variants.some((variant) =>
      variant.stock.trim()
      && (!Number.isInteger(Number(variant.stock)) || Number(variant.stock) < 0 || Number(variant.stock) > 99999)
    )) {
      setMessage("Stock দিলে ০ থেকে ৯৯,৯৯৯-এর মধ্যে পূর্ণ সংখ্যা দিন।");
      return;
    }

    if (variants.some((variant) => variant.url.trim() && !isAllowedProductImage(variant.url.trim()))) {
      setMessage("Color image-এ শুধু AVEN local image, Firebase image URL অথবা Cloudinary URL ব্যবহার করুন।");
      return;
    }

    lock.current = true;
    setBusy(true);

    const id = selectedId || stableId.current || doc(collection(db, "products")).id;
    stableId.current = id;

    try {
      const target = doc(db, "products", id);
      const existing = await timeout(getDocFromServer(target));

      if (
        existing.exists()
        && !window.confirm("এই product ID আগে থেকেই আছে। বর্তমান তথ্য update করবেন?")
      ) {
        return;
      }

      const colors = variants.map((variant) => ({
        name: variant.name.trim(),
        image: variant.url.trim() ? safeImage(variant.url.trim()) : safeImage(mainImage),
        ...(variant.stock.trim()
          ? { stock: Number(variant.stock), available: Number(variant.stock) > 0 }
          : {}),
      }));

      const tracked = variants.length > 0 && variants.every((variant) => variant.stock.trim());
      const totalStock = tracked
        ? variants.reduce((sum, variant) => sum + Number(variant.stock), 0)
        : null;

      await timeout(setDoc(target, {
        name: form.name.trim(),
        category: form.category.trim(),
        price: Math.round(price * 100) / 100,
        oldPrice: Math.round(oldPrice * 100) / 100,
        discount: oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0,
        description: form.description.trim(),
        mainImage: safeImage(mainImage),
        colors,
        stock: totalStock === null ? deleteField() : totalStock,
        published: true,
        available: totalStock === 0 ? false : true,
        ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true }));

      setSelectedId(id);
      try {
        localStorage.setItem("aven:catalog-updated", String(Date.now()));
        window.dispatchEvent(new Event("aven:admin-refresh"));
      } catch {
        // Cross-tab refresh is an enhancement only.
      }
      setSuccess(true);
      setSavedSnapshot(snapshot);
      setMessage("Product publish হয়েছে। Storefront preview থেকে price, image, Buy Now এবং stock দেখে নিন।");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "TIMEOUT"
          ? "Server response নিশ্চিত হয়নি। একই product আবার publish করার আগে Edit Products থেকে যাচাই করুন।"
          : /permission|unauthorized/.test(codeOf(error))
            ? "Firebase এই admin account-এর write permission দিচ্ছে না। Firestore admin authorization যাচাই করুন।"
            : "Product save করা যায়নি। Internet connection ও Firestore permission যাচাই করুন।"
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const preview = isAllowedProductImage(imageUrl.trim()) ? safeImage(imageUrl.trim()) : "";

  const detailsReady = Boolean(form.name.trim() && form.category.trim() && Number(form.price) > 0);
  const checks = [Boolean(preview), detailsReady, variants.every((v) => Boolean(v.name.trim()))];
  const completed = checks.filter(Boolean).length;
  const money = (value: string) => new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 2 }).format(Number(value) || 0);
  const entrance = reducedMotion ? {} : { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: .55 } };

  return <motion.form {...entrance} onSubmit={(event) => void publish(event)} className="av-admin-product av-create">
    <header className="av-create-intro">
      <div><span className="av-create-eyebrow">COLLECTION STUDIO</span><h2>নতুন পণ্য সাজান</h2><p>ছবি, দাম ও রঙ যোগ করুন। পাশে দেখুন আপনার পণ্য কেমন দেখাবে।</p></div>
      <span className="av-create-draft"><i /> {success ? "Published" : "Product setup"}</span>
    </header>
    <div className="av-create-progress" aria-label="Product setup progress">
      {["পণ্যের ছবি", "তথ্য ও দাম", "রঙ ও স্টক"].map((label, index) => <div key={label} className={checks[index] ? "is-complete" : ""}><b>{checks[index] ? "✓" : "0" + (index + 1)}</b><span>{label}</span></div>)}
      <div className="av-create-progress-track"><motion.span animate={{ width: (completed / 3 * 100) + "%" }} transition={{ duration: reducedMotion ? 0 : .6 }} /></div>
    </div>
    <div className="av-create-layout">
      <fieldset disabled={busy} className="av-create-fields">
        <legend className="av-create-sr">পণ্যের তথ্য</legend>
        <section className="av-create-section">
          <div className="av-create-section-head"><span>01</span><div><h3>পণ্যের ছবি</h3><p>প্রধান ছবি নির্বাচন করুন অথবা ছবির লিংক দিন।</p></div><AdminIcon name="products" /></div>
          <div className="av-create-image-tools">
            <ProductImageUpload label="প্রধান পণ্যের ছবি" disabled={busy} onUploaded={setImageUrl} onBusy={(uploading) => uploads.track("main", uploading)} />
            <label>Main image URL / AVEN path<input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="/products/pink.png অথবা trusted image URL" spellCheck={false} required /></label>
            <small>Upload করলে লিংক নিজে বসে যাবে। চাইলে AVEN, Firebase অথবা Cloudinary link-ও দিতে পারেন।</small>
          </div>
          <p className="av-create-label">বর্তমান কালেকশন থেকে শুরু করুন</p>
          <div className="av-create-seeds">
            {SHOWROOM.map((product) => <motion.button whileHover={reducedMotion ? undefined : { y: -5 }} whileTap={reducedMotion ? undefined : { scale: .97 }} type="button" key={product.id} className={selectedId === product.id ? "is-active" : ""} onClick={() => choose(product.id)} aria-pressed={selectedId === product.id}><Image src={product.mainImage} alt={product.name} width={110} height={125} /><span>{product.colors[0].name}</span>{selectedId === product.id && <b>✓</b>}</motion.button>)}
          </div>
          <button type="button" className="av-admin-action" onClick={() => choose("")}>＋ একদম নতুন পণ্য দিয়ে শুরু করুন</button>
        </section>
        <section className="av-create-section">
          <div className="av-create-section-head"><span>02</span><div><h3>পণ্যের তথ্য ও দাম</h3><p>সঠিক নাম ও দাম দিয়ে আপনার কালেকশন সাজান।</p></div><AdminIcon name="categories" /></div>
          <label>পণ্যের নাম<input required value={form.name} maxLength={150} placeholder="যেমন: প্রিমিয়াম জামদানি চাদর" onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>ক্যাটাগরি<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <div className="av-admin-prices"><label>বিক্রয়মূল্য (টাকা)<input type="number" min="0.01" max="1000000" step="0.01" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="1190" /></label><label>আগের মূল্য (ঐচ্ছিক)<input type="number" min="0" max="1000000" step="0.01" value={form.oldPrice} onChange={(event) => setForm({ ...form, oldPrice: event.target.value })} placeholder="2500" /></label></div>
          <label>বিবরণ<textarea rows={4} maxLength={3000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="কাপড়, ডিজাইন, মাপ ও যত্নের নির্দেশনা লিখুন…" /></label>
        </section>
        <section className="av-create-section">
          <div className="av-create-section-head"><span>03</span><div><h3>রঙ ও স্টক</h3><p>প্রতিটি রঙের ছবি ও স্টক আলাদা করে রাখুন।</p></div><span className="av-create-count">{variants.length} রঙ</span></div>
          <AnimatePresence initial={false}>
            {variants.map((variant, index) => <motion.div layout={!reducedMotion} initial={reducedMotion ? false : { opacity: 0, y: 20, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reducedMotion ? undefined : { opacity: 0, scale: .95 }} transition={{ duration: reducedMotion ? 0 : .3 }} className="av-create-variant" key={variant.key}>
              <div className="av-create-variant-head"><strong>Color variant {String(index + 1).padStart(2, "0")}</strong><button type="button" disabled={uploads.uploading} aria-label={"রঙ " + (index + 1) + " সরান"} onClick={() => setVariants((all) => all.filter((item) => item.key !== variant.key))}>সরান ×</button></div>
              <div className="av-admin-prices"><label>রঙের নাম<input value={variant.name} maxLength={100} onChange={(event) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, name: event.target.value } : item))} required placeholder="যেমন: গোলাপি" /></label><label>Stock (ঐচ্ছিক)<input type="number" min="0" max="99999" step="1" value={variant.stock} placeholder="খালি = স্টক ট্র্যাক নয়" onChange={(event) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, stock: event.target.value } : item))} /></label></div>
              <label>Color image URL (ঐচ্ছিক)<input value={variant.url} onChange={(event) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, url: event.target.value } : item))} placeholder="খালি রাখলে প্রধান ছবি ব্যবহার হবে" spellCheck={false} /></label>
              <ProductImageUpload label={"রঙ " + (index + 1) + "-এর ছবি"} disabled={busy} onUploaded={(url) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, url } : item))} onBusy={(uploading) => uploads.track(variant.key, uploading)} />
            </motion.div>)}
          </AnimatePresence>
          {!variants.length && <p className="av-create-hint">রঙের অপশন থাকলে নিচের বাটন থেকে যোগ করুন।</p>}
          <motion.button whileTap={reducedMotion ? undefined : { scale: .97 }} type="button" className="av-create-add-color" onClick={() => setVariants((all) => [...all, { key: crypto.randomUUID(), name: "", url: "", stock: "" }])}>＋ আরেকটি রঙ যোগ করুন</motion.button>
        </section>
        <div className="av-create-savebar"><div><strong>{success ? "পণ্য প্রকাশিত হয়েছে" : "প্রকাশ করার জন্য প্রস্তুত?"}</strong><small>{uploads.uploading ? "ছবি upload শেষ হলে Publish করুন।" : "Publish করলে পণ্যটি আপনার স্টোরে দেখা যাবে।"}</small></div><motion.button disabled={uploads.uploading} whileHover={reducedMotion || busy || uploads.uploading ? undefined : { y: -3 }} whileTap={reducedMotion || busy || uploads.uploading ? undefined : { scale: .97 }} type="submit" className="av-admin-publish">{busy ? <><span className="av-create-spinner" /> সংরক্ষণ হচ্ছে…</> : <>Publish Product <AdminIcon name="arrow" /></>}</motion.button></div>
      </fieldset>
      <aside className="av-create-preview">
        <div className="av-create-preview-head"><span>LIVE PREVIEW</span><i /> <small>আপনার পরিবর্তনের সঙ্গে আপডেট হয়</small></div>
        <div className="av-create-preview-image"><AnimatePresence mode="wait" initial={false}>{preview ? <motion.div key={preview} initial={reducedMotion ? false : { opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .35 }}><Image src={preview} alt="Product preview" fill sizes="(max-width: 760px) 90vw, 350px" /></motion.div> : <div className="av-create-placeholder"><AdminIcon name="products" /><span>পণ্যের ছবি যোগ করুন</span></div>}</AnimatePresence>{Number(form.oldPrice) > Number(form.price) && Number(form.price) > 0 && <span className="av-create-discount">{Math.round((1 - Number(form.price) / Number(form.oldPrice)) * 100)}% OFF</span>}</div>
        <div className="av-create-preview-details"><span>{form.category || "আপনার ক্যাটাগরি"}</span><h3>{form.name || "আপনার পণ্যের নাম"}</h3><div className="av-create-preview-price"><strong>৳ {money(form.price)}</strong>{Number(form.oldPrice) > Number(form.price) && <del>৳ {money(form.oldPrice)}</del>}</div><div className="av-create-color-chips">{variants.filter((v) => v.name.trim()).map((v) => <span key={v.key}>{v.name}</span>)}</div><p>{form.description || "পণ্যের বিবরণ এখানে দেখা যাবে।"}</p></div>
        <div className="av-create-preview-note"><AdminIcon name="shield" /><span>এটি একটি প্রিভিউ। Publish Product চাপার পর পণ্যটি স্টোরে প্রকাশিত হবে।</span></div>
      </aside>
    </div>
    <AnimatePresence>{message && <motion.div initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} role={success ? "status" : "alert"} className={"av-admin-message " + (success ? "is-success" : "")}><p>{message}</p>{success && <a href={"/product/" + encodeURIComponent(selectedId)} target="_blank" rel="noopener noreferrer">Published product দেখুন →</a>}</motion.div>}</AnimatePresence>
  </motion.form>;
}
