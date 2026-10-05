"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
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
  const [editingId, setEditingId] = useState("");
  const [editDescription, setEditDescription] = useState("");

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

    if (
      FEATURED_SHOP_CATEGORIES.some((item) => item.name === nextName)
      || records.some((item) => item.name === nextName)
    ) {
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
      setMessage("নতুন category তৈরি হয়েছে। Product section থেকে এই category-তে product publish করতে পারবেন।");
      await load();
    } catch {
      setMessage("Category তৈরি করা যায়নি। Firebase permission যাচাই করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(category: CategoryRecord) {
    setBusy(true);
    setMessage("");
    try {
      await updateDoc(doc(db, "categories", category.id), {
        published: !category.published,
        updatedAt: serverTimestamp(),
      });
      setMessage(category.published ? "Category homepage থেকে hidden হয়েছে।" : "Category homepage-এ visible হয়েছে।");
      await load();
    } catch {
      setMessage("Category visibility update করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(category: CategoryRecord) {
    setEditingId(category.id);
    setEditDescription(category.description);
    setMessage("");
  }

  async function saveDescription(category: CategoryRecord) {
    if (editDescription.trim().length > 240) {
      setMessage("Description সর্বোচ্চ ২৪০ অক্ষর হতে পারবে।");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await updateDoc(doc(db, "categories", category.id), {
        description: editDescription.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingId("");
      setMessage("Category description update হয়েছে।");
      await load();
    } catch {
      setMessage("Description update করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= records.length) return;

    const current = records[index];
    const target = records[targetIndex];
    setBusy(true);
    setMessage("");

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "categories", current.id), {
        position: target.position,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, "categories", target.id), {
        position: current.position,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setMessage("Category order update হয়েছে।");
      await load();
    } catch {
      setMessage("Category order update করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category: CategoryRecord) {
    if (names.has(category.name)) {
      setMessage("এই category-তে product আছে। আগে product অন্য category-তে সরান।");
      return;
    }

    if (!window.confirm(category.name + " category permanently remove করবেন?")) return;

    setBusy(true);
    setMessage("");

    try {
      await deleteDoc(doc(db, "categories", category.id));
      setMessage("Empty custom category remove হয়েছে।");
      await load();
    } catch {
      setMessage("Category remove করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return <div className="av-admin-category-manager">
    <div className="av-admin-category-section-title">
      <div>
        <p className="av-admin-kicker">CORE COLLECTIONS</p>
        <h3>Main storefront categories</h3>
      </div>
      <span>Core categories code-level structure; custom collections নিচে manage করুন।</span>
    </div>

    <div className="av-admin-categories">
      {FEATURED_SHOP_CATEGORIES.map((category) => {
        const count = products.filter((product) =>
          product.category === category.name
          || (category.key === "kushikata" && ["aven-rose-shawl", "aven-blue-shawl", "aven-golden-shawl"].includes(product.id))
        ).length;

        return <article className={"av-admin-category " + (count ? "" : "is-empty")} key={category.key}>
          <small>{category.eyebrow}</small>
          <h3>{category.name}</h3>
          <strong>{new Intl.NumberFormat("bn-BD").format(count)}</strong>
          <p>{category.description}</p>
          <span className="av-admin-category-lock">Core category</span>
        </article>;
      })}
    </div>

    <div className="av-admin-category-section-title av-admin-category-custom-title">
      <div>
        <p className="av-admin-kicker">CUSTOM COLLECTIONS</p>
        <h3>Admin-managed categories</h3>
      </div>
      <span>{records.length ? new Intl.NumberFormat("bn-BD").format(records.length) + "টি custom category" : "এখনো custom category নেই"}</span>
    </div>

    {records.length > 0 && <div className="av-admin-custom-category-list">
      {records.map((category, index) => {
        const count = products.filter((product) => product.category === category.name).length;
        const editing = editingId === category.id;

        return <article className={"av-admin-custom-category " + (!category.published ? "is-hidden" : "")} key={category.id}>
          <div className="av-admin-custom-category-top">
            <div>
              <small>CUSTOM COLLECTION · {category.published ? "VISIBLE" : "HIDDEN"}</small>
              <h3>{category.name}</h3>
              <p>{count ? new Intl.NumberFormat("bn-BD").format(count) + "টি product assigned" : "কোনো product assigned নেই"}</p>
            </div>
            <div className="av-admin-category-order">
              <button type="button" disabled={busy || index === 0} onClick={() => void moveCategory(index, -1)} aria-label={category.name + " উপরে নিন"}>↑</button>
              <button type="button" disabled={busy || index === records.length - 1} onClick={() => void moveCategory(index, 1)} aria-label={category.name + " নিচে নিন"}>↓</button>
            </div>
          </div>

          {editing ? <div className="av-admin-category-edit">
            <label>
              Homepage description
              <textarea rows={3} maxLength={240} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
            </label>
            <div>
              <button type="button" className="av-admin-action primary" disabled={busy} onClick={() => void saveDescription(category)}>Save description</button>
              <button type="button" className="av-admin-action" onClick={() => setEditingId("")}>Cancel</button>
            </div>
          </div> : <p className="av-admin-category-description">{category.description || "Description নেই। Edit করে homepage description দিন।"}</p>}

          <div className="av-admin-custom-category-actions">
            {!editing && <button type="button" className="av-admin-action" onClick={() => beginEdit(category)}>Edit description</button>}
            <button type="button" className="av-admin-action" disabled={busy} onClick={() => void togglePublished(category)}>
              {category.published ? "Hide from homepage" : "Show on homepage"}
            </button>
            <button type="button" className="av-admin-action danger" disabled={busy || count > 0} onClick={() => void removeCategory(category)}>
              {count > 0 ? "Remove disabled" : "Remove empty category"}
            </button>
          </div>
        </article>;
      })}
    </div>}

    <form className="av-admin-category-create" onSubmit={(event) => void addCategory(event)}>
      <div>
        <p className="av-admin-kicker">NEW COLLECTION</p>
        <h2>নতুন category তৈরি করুন</h2>
        <p>তারপর Product section থেকে সেই category-তে products assign করুন।</p>
      </div>

      <label>
        Category name
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="যেমন: এমব্রয়ডারি চাদর" required />
      </label>

      <label>
        Homepage description
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} rows={3} placeholder="Collection-এর ছোট professional description" />
      </label>

      <button className="av-admin-action primary" disabled={busy}>
        {busy ? "Creating…" : "Create category"}
      </button>
    </form>

    {message && <div className="av-admin-notice" role="status">
      <span aria-hidden="true">✓</span>
      <div>{message}</div>
      <button type="button" aria-label="Message বন্ধ করুন" onClick={() => setMessage("")}>×</button>
    </div>}
  </div>;
}
