"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { doc, collection, deleteField, getDocFromServer, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { SHOWROOM } from "@/lib/showroom";
import { useCategoryOptions } from "@/components/admin/useCategoryOptions";

type Variant = { key: string; name: string; url: string; file: File | null; stock: string };
const initial = { name: SHOWROOM[0].name, category: "কুশিকাটা চাদর", price: "", oldPrice: "", description: "" };
function codeOf(error: unknown): string { return error && typeof error === "object" && "code" in error ? String(error.code) : ""; }
async function timeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("TIMEOUT")), 25000); })]); }
  finally { if (timer) clearTimeout(timer); }
}
export default function ProductManager() {
  const categoryOptions = useCategoryOptions();
  const [form, setForm] = useState(initial);
  const [selectedId, setSelectedId] = useState(SHOWROOM[0].id);
  const [imageUrl, setImageUrl] = useState(SHOWROOM[0].mainImage);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [variants, setVariants] = useState<Variant[]>([{ key: "first", name: SHOWROOM[0].colors[0].name, url: SHOWROOM[0].mainImage, file: null, stock: "" }]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const stableId = useRef("");
  const lock = useRef(false);
  useEffect(() => { if (!mainFile) { setPreview(""); return; } const url = URL.createObjectURL(mainFile); setPreview(url); return () => URL.revokeObjectURL(url); }, [mainFile]);
  const choose = (id: string) => {
    if (busy) return;
    const seed = SHOWROOM.find((p) => p.id === id);
    setSelectedId(id); stableId.current = id; setMessage(""); setSuccess(false); setMainFile(null);
    setForm({ name: seed?.name || "", category: seed ? "কুশিকাটা চাদর" : "কুশিকাটা চাদর", price: "", oldPrice: "", description: "" });
    setImageUrl(seed?.mainImage || "");
    setVariants(seed ? seed.colors.map((c, i) => ({ key: `${i}`, name: c.name, url: c.image, file: null, stock: typeof c.stock === "number" ? String(c.stock) : "" })) : []);
  };
  const acceptFile = (file?: File): File | null => {
    if (!file) return null;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 6 * 1024 * 1024) {
      setSuccess(false); setMessage("৬ MB-এর কম JPEG, PNG বা WebP ছবি দিন।"); return null;
    }
    return file;
  };
  const upload = async (file: File, id: string): Promise<string> => {
    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const location = ref(storage, `products/${id}/${crypto.randomUUID()}.${ext}`);
    await timeout(uploadBytes(location, file, { contentType: file.type }));
    return timeout(getDownloadURL(location));
  };
  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (lock.current) return;
    setSuccess(false); setMessage("");
    const price = Number(form.price); const oldPrice = form.oldPrice.trim() ? Number(form.oldPrice) : 0;
    if (!form.name.trim() || !form.category.trim() || !Number.isFinite(price) || price <= 0 || price > 1000000 || !Number.isFinite(oldPrice) || oldPrice < 0 || (oldPrice > 0 && oldPrice < price)) {
      setMessage("পণ্যের নাম ও সঠিক বিক্রয়মূল্য দিন। পুরোনো মূল্য থাকলে তা বিক্রয়মূল্যের চেয়ে কম হবে না।"); return;
    }
    if (!mainFile && !imageUrl) { setMessage("একটি পণ্যের ছবি নির্বাচন করুন।"); return; }
    if (variants.some((v) => !v.name.trim()) || new Set(variants.map((v) => v.name.trim())).size !== variants.length) { setMessage("প্রতিটি রঙের আলাদা নাম দিন।"); return; }
    if (variants.some((v) => v.stock.trim() && (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0 || Number(v.stock) > 99999))) { setMessage("Stock দিলে ০ থেকে ৯৯,৯৯৯-এর মধ্যে পূর্ণ সংখ্যা দিন।"); return; }
    lock.current = true; setBusy(true);
    const id = selectedId || stableId.current || doc(collection(db, "products")).id;
    stableId.current = id;
    try {
      const target = doc(db, "products", id);
      const existing = await timeout(getDocFromServer(target));
      if (existing.exists() && !window.confirm("এই পণ্যটি আগে প্রকাশ করা হয়েছে। দেওয়া তথ্য ও দাম দিয়ে আপডেট করবেন?")) return;
      const mainImage = mainFile ? await upload(mainFile, id) : imageUrl;
      const colors = await Promise.all(variants.map(async (v) => ({ name: v.name.trim(), image: v.file ? await upload(v.file, id) : v.url || mainImage, ...(v.stock.trim() ? { stock: Number(v.stock), available: Number(v.stock) > 0 } : {}) })));
      const tracked = variants.length > 0 && variants.every((v) => v.stock.trim());
      const totalStock = tracked ? variants.reduce((sum, v) => sum + Number(v.stock), 0) : null;
      await timeout(setDoc(target, {
        name: form.name.trim(), category: form.category.trim(), price: Math.round(price * 100) / 100, oldPrice,
        discount: oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0,
        description: form.description.trim(), mainImage, colors, stock: totalStock === null ? deleteField() : totalStock, published: true, available: totalStock === 0 ? false : true,
        ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}), updatedAt: serverTimestamp(),
      }, { merge: true }));
      try { localStorage.setItem("aven:catalog-updated", String(Date.now())); } catch { /* optional tab refresh */ }
      setSuccess(true); setMessage("পণ্যটি প্রকাশিত হয়েছে। নিচের লিংক থেকে দাম, Buy Now ও Add to Cart দেখে নিন।");
    } catch (error) {
      setMessage(error instanceof Error && error.message === "TIMEOUT" ? "সার্ভারের ফল নিশ্চিত হয়নি। একই পণ্য আবার প্রকাশের আগে Edit Product থেকে যাচাই করুন—পণ্যটি পরে সংরক্ষিত হয়ে থাকতে পারে।"
        : /permission|unauthorized/.test(codeOf(error)) ? "Firebase এই অ্যাকাউন্টের লেখা অনুমোদন করছে না। অনুমোদিত admin access ঠিক করতে হবে; database সবার জন্য খুলে দেবেন না।"
        : /storage/.test(codeOf(error)) ? "ছবি আপলোড হয়নি। আপাতত ওপরের প্রস্তুত ছবি ব্যবহার করুন অথবা Firebase Storage-এর অনুমতি যাচাই করুন।"
        : "পণ্যটি সংরক্ষণ করা যায়নি। সংযোগ ও Firebase-এর অনুমতি যাচাই করুন।");
    } finally { lock.current = false; setBusy(false); }
  };
  return <form onSubmit={(event) => void publish(event)} className="av-admin-product">
    <h2>পণ্য প্রকাশ করুন</h2><p>আগে থেকে থাকা ছবি বেছে আসল বিক্রয়মূল্য দিন। কোনো ছাড় না থাকলেও পণ্য প্রকাশ করা যাবে।</p>
    <fieldset disabled={busy}><legend>১. ছবি নির্বাচন</legend><div className="av-admin-seeds">{SHOWROOM.map((p) => <button type="button" key={p.id} className={selectedId === p.id ? "is-active" : ""} onClick={() => choose(p.id)} aria-pressed={selectedId === p.id}><Image src={p.mainImage} alt={p.name} width={180} height={200} /><span>{p.colors[0].name}</span></button>)}</div>
      <button type="button" className="av-admin-secondary" onClick={() => choose("")}>অন্য পণ্য / নিজের ছবি ব্যবহার করুন</button>
      <label>নিজের ছবি আপলোড (ঐচ্ছিক)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = acceptFile(event.target.files?.[0]); if (file) setMainFile(file); }} /></label>
      {preview && <Image src={preview} alt="নির্বাচিত ছবির প্রিভিউ" width={200} height={220} unoptimized />}
      <legend>২. পণ্যের তথ্য ও আসল দাম</legend><label>পণ্যের নাম<input required value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>ক্যাটাগরি<select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <div className="av-admin-prices"><label>বিক্রয়মূল্য (টাকা)<input name="price" type="number" min="0.01" max="1000000" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="আসল বিক্রয়মূল্য" /></label><label>আগের মূল্য (ঐচ্ছিক)<input type="number" min="0" max="1000000" step="0.01" value={form.oldPrice} onChange={(e) => setForm({ ...form, oldPrice: e.target.value })} placeholder="ছাড় না থাকলে খালি রাখুন" /></label></div>
      <label>বিবরণ<textarea rows={4} maxLength={3000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="কাপড়, মাপ ও সঠিক পণ্যের তথ্য" /></label>
      <legend>৩. রঙ ও stock</legend>{variants.map((v) => <div className="av-admin-variant" key={v.key}><label>রঙের নাম<input value={v.name} maxLength={100} onChange={(e) => setVariants((all) => all.map((item) => item.key === v.key ? { ...item, name: e.target.value } : item))} required /></label><label>Stock (ঐচ্ছিক)<input type="number" min="0" max="99999" step="1" value={v.stock} placeholder="খালি = stock track নয়" onChange={(e) => setVariants((all) => all.map((item) => item.key === v.key ? { ...item, stock: e.target.value } : item))} /></label><label>এই রঙের ছবি<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = acceptFile(e.target.files?.[0]); if (file) setVariants((all) => all.map((item) => item.key === v.key ? { ...item, file } : item)); }} /></label><button type="button" className="av-admin-secondary" onClick={() => setVariants((all) => all.filter((item) => item.key !== v.key))}>রঙটি সরান</button></div>)}
      <button type="button" className="av-admin-secondary" onClick={() => setVariants((all) => [...all, { key: crypto.randomUUID(), name: "", url: "", file: null, stock: "" }])}>+ আরেকটি রঙ</button>
      <button type="submit" className="av-admin-publish">{busy ? "সংরক্ষণ হচ্ছে…" : "Publish Product / প্রকাশ করুন"}</button>
    </fieldset>
    {message && <div role={success ? "status" : "alert"} className={`av-admin-message ${success ? "is-success" : ""}`}><p>{message}</p>{success && <a href={`/product/${encodeURIComponent(stableId.current)}`} target="_blank" rel="noopener noreferrer">প্রকাশিত পণ্য দেখুন →</a>}</div>}
  </form>;
}
