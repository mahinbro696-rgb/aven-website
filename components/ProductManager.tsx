"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { collection, deleteField, doc, getDocFromServer, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SHOWROOM } from "@/lib/showroom";
import { isAllowedProductImage, safeImage } from "@/lib/atelier";
import { useCategoryOptions } from "@/components/admin/useCategoryOptions";

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

  function choose(id: string) {
    if (busy) return;
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
    if (lock.current) return;

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

  return <form onSubmit={(event) => void publish(event)} className="av-admin-product">
    <div className="av-admin-editor-note">
      <strong>Image mode: URL / existing AVEN image</strong>
      <span>Firebase Storage এখন ব্যবহার করা হচ্ছে না। পরে Cloudinary connect করলে এখানে Cloudinary image URL paste করলেই কাজ করবে।</span>
    </div>

    <h2>পণ্য প্রকাশ করুন</h2>
    <p>Category, price, color এবং stock দিয়ে product publish করুন। Image upload service ছাড়াও built-in image বা trusted image URL ব্যবহার করা যাবে।</p>

    <fieldset disabled={busy}>
      <legend>১. Main image</legend>

      <div className="av-admin-seeds">
        {SHOWROOM.map((product) => <button
          type="button"
          key={product.id}
          className={selectedId === product.id ? "is-active" : ""}
          onClick={() => choose(product.id)}
          aria-pressed={selectedId === product.id}
        >
          <Image src={product.mainImage} alt={product.name} width={180} height={200} />
          <span>{product.colors[0].name}</span>
        </button>)}
      </div>

      <button type="button" className="av-admin-secondary" onClick={() => choose("")}>
        + নতুন product
      </button>

      <label>
        Main image URL / AVEN path
        <input
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="/products/pink.png অথবা https://res.cloudinary.com/..."
          spellCheck={false}
          required
        />
      </label>

      {preview && <div className="av-admin-url-preview">
        <Image src={preview} alt="Product preview" width={230} height={260} />
        <span>Image preview</span>
      </div>}

      <legend>২. পণ্যের তথ্য ও দাম</legend>

      <label>
        পণ্যের নাম
        <input required value={form.name} maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </label>

      <label>
        ক্যাটাগরি
        <select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
          {categoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>

      <div className="av-admin-prices">
        <label>
          বিক্রয়মূল্য (টাকা)
          <input type="number" min="0.01" max="1000000" step="0.01" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="যেমন 1190" />
        </label>
        <label>
          আগের মূল্য (ঐচ্ছিক)
          <input type="number" min="0" max="1000000" step="0.01" value={form.oldPrice} onChange={(event) => setForm({ ...form, oldPrice: event.target.value })} placeholder="যেমন 2500" />
        </label>
      </div>

      <label>
        বিবরণ
        <textarea rows={5} maxLength={3000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="কাপড়, design, মাপ, care instruction ইত্যাদি" />
      </label>

      <legend>৩. Color & stock</legend>

      {variants.map((variant) => <div className="av-admin-variant" key={variant.key}>
        <label>
          রঙের নাম
          <input value={variant.name} maxLength={100} onChange={(event) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, name: event.target.value } : item))} required />
        </label>
        <label>
          Stock (ঐচ্ছিক)
          <input type="number" min="0" max="99999" step="1" value={variant.stock} placeholder="খালি = stock track নয়" onChange={(event) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, stock: event.target.value } : item))} />
        </label>
        <label>
          Color image URL (ঐচ্ছিক)
          <input value={variant.url} onChange={(event) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, url: event.target.value } : item))} placeholder="খালি রাখলে main image ব্যবহার হবে" spellCheck={false} />
        </label>
        <button type="button" className="av-admin-secondary" onClick={() => setVariants((all) => all.filter((item) => item.key !== variant.key))}>
          রঙটি সরান
        </button>
      </div>)}

      <button type="button" className="av-admin-secondary" onClick={() => setVariants((all) => [...all, {
        key: crypto.randomUUID(),
        name: "",
        url: "",
        stock: "",
      }])}>
        + আরেকটি রঙ
      </button>

      <button type="submit" className="av-admin-publish">
        {busy ? "সংরক্ষণ হচ্ছে…" : "Publish Product"}
      </button>
    </fieldset>

    {message && <div role={success ? "status" : "alert"} className={"av-admin-message " + (success ? "is-success" : "")}>
      <p>{message}</p>
      {success && <a href={"/product/" + encodeURIComponent(stableId.current)} target="_blank" rel="noopener noreferrer">Published product দেখুন →</a>}
    </div>}
  </form>;
}
