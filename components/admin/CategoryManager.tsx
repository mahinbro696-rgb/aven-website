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

function countForCategory(products: Product[], name: string, coreKey?: string) {
  return products.filter((product) =>
    product.category === name
    || (coreKey === "kushikata" && ["aven-rose-shawl", "aven-blue-shawl", "aven-golden-shawl"].includes(product.id))
  ).length;
}

export default function CategoryManager({ products }: { products: Product[] }) {
  const [records, setRecords] = useState<CategoryRecord[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

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

  const lowerSearch = search.trim().toLocaleLowerCase("bn");

  const filteredCore = useMemo(() => FEATURED_SHOP_CATEGORIES.filter((category) =>
    !lowerSearch
    || (category.name + " " + category.description).toLocaleLowerCase("bn").includes(lowerSearch)
  ), [lowerSearch]);

  const filteredRecords = useMemo(() => records.filter((category) =>
    !lowerSearch
    || (category.name + " " + category.description).toLocaleLowerCase("bn").includes(lowerSearch)
  ), [records, lowerSearch]);

  const publishedCustom = records.filter((category) => category.published).length;
  const assignedProducts = products.filter((product) =>
    FEATURED_SHOP_CATEGORIES.some((category) => category.name === product.category)
    || records.some((category) => category.name === product.category)
  ).length;

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
        position: Math.max(FEATURED_SHOP_CATEGORIES.length - 1, ...records.map((item) => item.position)) + 1,
        published: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setName("");
      setDescription("");
      setCreateOpen(false);
      setMessage("Category তৈরি হয়েছে। এখন Product section থেকে product assign করতে পারবেন।");
      await load();
      window.dispatchEvent(new Event("aven:admin-refresh"));
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
    setEditName(category.name);
    setEditDescription(category.description);
    setMessage("");
  }

  async function saveCategory(category: CategoryRecord) {
    const nextName = cleanName(editName);
    const nextDescription = editDescription.trim();

    if (nextName.length < 2 || nextName.length > 80) {
      setMessage("Category name ২ থেকে ৮০ অক্ষরের মধ্যে দিন।");
      return;
    }

    if (nextDescription.length > 240) {
      setMessage("Description সর্বোচ্চ ২৪০ অক্ষর হতে পারবে।");
      return;
    }

    const conflict = FEATURED_SHOP_CATEGORIES.some((item) => item.name === nextName)
      || records.some((item) => item.id !== category.id && item.name === nextName);

    if (conflict) {
      setMessage("এই নামে আরেকটি category আগে থেকেই আছে।");
      return;
    }

    const assigned = products.filter((product) => product.category === category.name);
    if (assigned.length > 400) {
      setMessage("এই category-তে অনেক product আছে। Safe rename করতে product সংখ্যা ৪০০-এর নিচে আনুন।");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "categories", category.id), {
        name: nextName,
        description: nextDescription,
        updatedAt: serverTimestamp(),
      });

      if (nextName !== category.name) {
        for (const product of assigned) {
          batch.update(doc(db, "products", product.id), {
            category: nextName,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      setEditingId("");
      setMessage(nextName !== category.name
        ? "Category rename হয়েছে এবং assigned products-ও নতুন category-তে move হয়েছে।"
        : "Category details update হয়েছে।"
      );
      await load();
      window.dispatchEvent(new Event("aven:admin-refresh"));
    } catch {
      setMessage("Category update করা যায়নি।");
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
      setMessage("Homepage category order update হয়েছে।");
      await load();
    } catch {
      setMessage("Category order update করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category: CategoryRecord) {
    const count = countForCategory(products, category.name);
    if (count > 0) {
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
    <section className="av-admin-category-toolbar">
      <div className="av-admin-category-stats">
        <article><span>Total categories</span><strong>{FEATURED_SHOP_CATEGORIES.length + records.length}</strong></article>
        <article><span>Custom visible</span><strong>{publishedCustom}</strong></article>
        <article><span>Assigned products</span><strong>{assignedProducts}</strong></article>
      </div>

      <div className="av-admin-category-tools">
        <input
          className="av-admin-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Category খুঁজুন…"
        />
        <button type="button" className="av-admin-action primary" onClick={() => setCreateOpen((value) => !value)}>
          {createOpen ? "Close" : "+ New category"}
        </button>
      </div>
    </section>

    {createOpen && <form className="av-admin-category-create av-admin-category-create-simple" onSubmit={(event) => void addCategory(event)}>
      <div>
        <p className="av-admin-kicker">NEW COLLECTION</p>
        <h2>নতুন category</h2>
        <p>নাম ও ছোট homepage description দিলেই category ready।</p>
      </div>

      <label>
        Category name
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="যেমন: এমব্রয়ডারি চাদর" required autoFocus />
      </label>

      <label>
        Homepage description
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} rows={3} placeholder="Customer কী ধরনের product পাবে—সংক্ষেপে লিখুন" />
      </label>

      <button className="av-admin-action primary" disabled={busy}>
        {busy ? "Creating…" : "Create category"}
      </button>
    </form>}

    <div className="av-admin-category-section-title">
      <div>
        <p className="av-admin-kicker">CORE COLLECTIONS</p>
        <h3>Main categories</h3>
      </div>
      <span>এগুলো storefront structure-এর permanent category—rename/delete lock করা।</span>
    </div>

    <div className="av-admin-category-board">
      {filteredCore.map((category) => {
        const count = countForCategory(products, category.name, category.key);
        const sampleProducts = products
          .filter((product) => product.category === category.name
            || (category.key === "kushikata" && ["aven-rose-shawl", "aven-blue-shawl", "aven-golden-shawl"].includes(product.id)))
          .slice(0, 3);

        return <article className={"av-admin-category-pro " + (count ? "" : "is-empty")} key={category.key}>
          <div className="av-admin-category-pro-top">
            <span className="av-admin-category-type">CORE</span>
            <span className="av-admin-category-count">{count} products</span>
          </div>
          <h3>{category.name}</h3>
          <p>{category.description}</p>
          {sampleProducts.length > 0 && <div className="av-admin-category-product-chips">
            {sampleProducts.map((product) => <span key={product.id}>{product.name}</span>)}
            {count > sampleProducts.length && <span>+{count - sampleProducts.length} more</span>}
          </div>}
          <div className="av-admin-category-lock">Protected core category</div>
        </article>;
      })}
    </div>

    <div className="av-admin-category-section-title av-admin-category-custom-title">
      <div>
        <p className="av-admin-kicker">CUSTOM COLLECTIONS</p>
        <h3>Custom categories</h3>
      </div>
      <span>Rename, edit, show/hide এবং homepage order এখানেই control করুন।</span>
    </div>

    {filteredRecords.length > 0 ? <div className="av-admin-custom-category-list">
      {filteredRecords.map((category) => {
        const actualIndex = records.findIndex((item) => item.id === category.id);
        const count = countForCategory(products, category.name);
        const editing = editingId === category.id;
        const sampleProducts = products.filter((product) => product.category === category.name).slice(0, 4);

        return <article className={"av-admin-custom-category " + (!category.published ? "is-hidden" : "")} key={category.id}>
          <div className="av-admin-custom-category-top">
            <div>
              <div className="av-admin-category-status-line">
                <span className={"av-admin-category-visibility " + (category.published ? "is-visible" : "is-hidden")}>
                  {category.published ? "Homepage visible" : "Homepage hidden"}
                </span>
                <span>{count} products</span>
              </div>
              <h3>{category.name}</h3>
            </div>

            <div className="av-admin-category-order" aria-label="Homepage order controls">
              <button type="button" disabled={busy || actualIndex <= 0} onClick={() => void moveCategory(actualIndex, -1)} title="Move up">↑</button>
              <button type="button" disabled={busy || actualIndex === records.length - 1} onClick={() => void moveCategory(actualIndex, 1)} title="Move down">↓</button>
            </div>
          </div>

          {editing ? <div className="av-admin-category-edit av-admin-category-edit-pro">
            <label>
              Category name
              <input value={editName} maxLength={80} onChange={(event) => setEditName(event.target.value)} />
            </label>
            <label>
              Homepage description
              <textarea rows={3} maxLength={240} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
            </label>
            <div>
              <button type="button" className="av-admin-action primary" disabled={busy} onClick={() => void saveCategory(category)}>Save changes</button>
              <button type="button" className="av-admin-action" onClick={() => setEditingId("")}>Cancel</button>
            </div>
            {count > 0 && editName !== category.name && <small>Rename করলে এই category-এর {count}টি product একইসাথে নতুন নামে move হবে।</small>}
          </div> : <>
            <p className="av-admin-category-description">{category.description || "Description নেই। Edit করে homepage description দিন।"}</p>

            {sampleProducts.length > 0 && <div className="av-admin-category-product-chips">
              {sampleProducts.map((product) => <span key={product.id}>{product.name}</span>)}
              {count > sampleProducts.length && <span>+{count - sampleProducts.length} more</span>}
            </div>}
          </>}

          <div className="av-admin-custom-category-actions">
            {!editing && <button type="button" className="av-admin-action primary" onClick={() => beginEdit(category)}>Edit category</button>}
            <button type="button" className="av-admin-action" disabled={busy} onClick={() => void togglePublished(category)}>
              {category.published ? "Hide from homepage" : "Show on homepage"}
            </button>
            <button type="button" className="av-admin-action danger" disabled={busy || count > 0} onClick={() => void removeCategory(category)}>
              {count > 0 ? "Remove locked" : "Remove"}
            </button>
          </div>
        </article>;
      })}
    </div> : <div className="av-admin-empty">
      {search.trim() ? "এই search-এ কোনো custom category পাওয়া যায়নি।" : "এখনো custom category নেই। + New category চাপুন।"}
    </div>}

    {message && <div className="av-admin-notice" role="status">
      <span aria-hidden="true">✓</span>
      <div>{message}</div>
      <button type="button" aria-label="Message বন্ধ করুন" onClick={() => setMessage("")}>×</button>
    </div>}
  </div>;
}
