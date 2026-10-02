"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { productCategories, productsInCategory } from "@/lib/shop-categories";
import type { Product } from "@/lib/atelier";
import ProductSection from "./ProductSection";
import CategoryManager from "./CategoryManager";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

type Tab = "overview" | "products" | "categories" | "orders" | "settings";
type TimestampLike = { toDate?: () => Date; seconds?: number };
type Order = {
  id: string;
  name?: string;
  phone?: string;
  district?: string;
  address?: string;
  product?: string;
  color?: string;
  quantity?: number;
  subtotal?: number;
  status?: string;
  paymentStatus?: string;
  createdAt?: TimestampLike;
};

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "products", label: "Products", icon: "◇" },
  { id: "categories", label: "Categories", icon: "▦" },
  { id: "orders", label: "Orders", icon: "▤" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function dateText(value?: TimestampLike) {
  try {
    const date = typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value?.seconds === "number"
        ? new Date(value.seconds * 1000)
        : null;
    return date ? new Intl.DateTimeFormat("bn-BD", { dateStyle: "medium", timeStyle: "short" }).format(date) : "তারিখ পাওয়া যায়নি";
  } catch {
    return "তারিখ পাওয়া যায়নি";
  }
}

function statusClass(status = "Pending") {
  return status.toLowerCase().replace(/[^a-z]/g, "") || "pending";
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const orderSnap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
      const productSnap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));

      setOrders(orderSnap.docs.map((item) => ({ id: item.id, ...item.data() } as Order)));
      setProducts(productSnap.docs.map((item) => {
        const raw = item.data();
        return {
          id: item.id,
          name: String(raw.name || "AVEN Product"),
          category: String(raw.category || "কালেকশন"),
          price: Number(raw.price || 0),
          oldPrice: Number(raw.oldPrice || 0),
          description: String(raw.description || ""),
          mainImage: String(raw.mainImage || "/products/pink.png"),
          colors: Array.isArray(raw.colors) ? raw.colors : [],
          available: raw.available !== false,
          createdAt: typeof raw.createdAt?.seconds === "number" ? raw.createdAt.seconds * 1000 : 0,
        };
      }));
    } catch (error) {
      console.error("AVEN_ADMIN_LOAD_FAILED", error instanceof Error ? error.name : "UnknownError");
      setMessage("Admin data load করা যায়নি। Firebase permission ও connection যাচাই করুন।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => ({
    orders: orders.length,
    pending: orders.filter((order) => (order.status || "Pending") === "Pending").length,
    delivered: orders.filter((order) => order.status === "Delivered").length,
    products: products.filter((product) => product.available).length,
  }), [orders, products]);

  const categories = useMemo(() => productCategories(products), [products]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const text = [order.name, order.phone, order.product, order.id].filter(Boolean).join(" ").toLowerCase();
    const searchOkay = !search.trim() || text.includes(search.trim().toLowerCase());
    const statusOkay = statusFilter === "all" || (order.status || "Pending") === statusFilter;
    return searchOkay && statusOkay;
  }), [orders, search, statusFilter]);

  async function setOrderStatus(order: Order, status: string) {
    setMessage("");
    try {
      await updateDoc(doc(db, "orders", order.id), { status });
      setOrders((all) => all.map((item) => item.id === order.id ? { ...item, status } : item));
      setMessage(order.id + " → " + status);
    } catch {
      setMessage("Order status update করা যায়নি। Permission যাচাই করুন।");
    }
  }

  function changeTab(next: Tab) {
    setTab(next);
    setMenuOpen(false);
  }
  function exportOrders() {
    const rows = [
      ["Reference", "Status", "Customer", "Phone", "District", "Address", "Product", "Color", "Quantity", "Subtotal", "Payment"],
      ...filteredOrders.map((order) => [
        order.id,
        order.status || "Pending",
        order.name || "",
        order.phone || "",
        order.district || "",
        order.address || "",
        order.product || "",
        order.color || "",
        String(order.quantity || 1),
        typeof order.subtotal === "number" ? String(order.subtotal) : "",
        order.paymentStatus || "Not collected",
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aven-orders-" + new Date().toISOString().slice(0, 10) + ".csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }


  return <div className="av-admin">
    <div className="av-admin-shell">
      <aside className={"av-admin-side " + (menuOpen ? "is-open" : "")}>
        <Link href="/" className="av-admin-brand">
          <strong>AVEN</strong>
          <span>STORE CONTROL CENTER</span>
        </Link>

        <nav className="av-admin-nav" aria-label="Admin navigation">
          {tabs.map((item) => <button
            type="button"
            key={item.id}
            className={tab === item.id ? "is-active" : ""}
            onClick={() => changeTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
          >
            <b aria-hidden="true">{item.icon}</b>
            {item.label}
          </button>)}
        </nav>

        <div className="av-admin-side-foot">
          Preview admin workspace.<br />
          Secure authentication and Firestore rules must be configured before production use.
        </div>
      </aside>

      <main className="av-admin-main">
        <header className="av-admin-topbar">
          <div className="av-admin-topbar-left">
            <button type="button" className="av-admin-mobile-toggle" onClick={() => setMenuOpen(true)} aria-label="Admin menu খুলুন">☰</button>
            <div>
              <p className="av-admin-kicker">AVEN / ADMINISTRATION</p>
              <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
              <p>Products, categories, orders এবং storefront এক জায়গা থেকে manage করুন।</p>
            </div>
          </div>
          <Link className="av-admin-preview" href="/" target="_blank">Storefront দেখুন ↗</Link>
        </header>

        <div className="av-admin-security">
          <span aria-hidden="true">⚠</span>
          <div>
            <strong>Security setup এখনও বাকি</strong>
            Firebase Authentication + restrictive Firestore rules configure না করা পর্যন্ত /admin-কে secure production admin হিসেবে ধরা যাবে না।
          </div>
        </div>

        {message && <div className="av-admin-security" role="status"><span aria-hidden="true">✓</span><div>{message}</div></div>}

        {tab === "overview" && <>
          <section className="av-admin-metrics">
            <Metric label="Total orders" value={metrics.orders} />
            <Metric label="Pending" value={metrics.pending} />
            <Metric label="Delivered" value={metrics.delivered} />
            <Metric label="Visible products" value={metrics.products} />
          </section>

          <div className="av-admin-grid">
            <section className="av-admin-panel">
              <div className="av-admin-panel-head">
                <div><h2>Recent orders</h2><p>সর্বশেষ customer orders</p></div>
                <button className="av-admin-action" onClick={() => changeTab("orders")}>সব দেখুন</button>
              </div>
              <div className="av-admin-list">
                {loading ? <div className="av-admin-empty">Loading…</div> : orders.slice(0, 6).map((order) => <div className="av-admin-list-row" key={order.id}>
                  <div><strong>{order.name || "Customer"}</strong><span>{order.product || "Order"} · {dateText(order.createdAt)}</span></div>
                  <span className={"av-admin-status " + statusClass(order.status)}>{order.status || "Pending"}</span>
                </div>)}
              </div>
            </section>

            <section className="av-admin-panel">
              <div className="av-admin-panel-head">
                <div><h2>Store structure</h2><p>Homepage category overview</p></div>
                <button className="av-admin-action" onClick={() => changeTab("categories")}>Manage</button>
              </div>
              <div className="av-admin-list">
                {categories.map((category) => {
                  const count = productsInCategory(products, category.key).length;
                  return <div className="av-admin-list-row" key={category.key}>
                    <div><strong>{category.name}</strong><span>{count ? "Homepage-এ active" : "এখনো product নেই"}</span></div>
                    <strong>{new Intl.NumberFormat("bn-BD").format(count)}</strong>
                  </div>;
                })}
              </div>
            </section>
          </div>
        </>}

        {tab === "products" && <section className="av-admin-product-wrap"><ProductSection /></section>}

        {tab === "categories" && <section className="av-admin-panel">
          <div className="av-admin-panel-head">
            <div><h2>Product categories</h2><p>Main collections এবং future custom categories manage করুন।</p></div>
          </div>
          <CategoryManager products={products} />
        </section>}

        {tab === "orders" && <section className="av-admin-panel">
          <div className="av-admin-panel-head">
            <div><h2>Order management</h2><p>Customer details, products এবং status manage করুন।</p></div>
            <div className="av-admin-order-head-actions"><button className="av-admin-action" onClick={exportOrders}>Export CSV</button><button className="av-admin-action" onClick={() => void load()}>Refresh</button></div>
          </div>

          <div className="av-admin-toolbar">
            <input className="av-admin-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="নাম, ফোন, পণ্য বা order reference…" />
            <select className="av-admin-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">সব status</option>
              <option>Pending</option>
              <option>Confirmed</option>
              <option>Delivered</option>
              <option>Cancelled</option>
            </select>
          </div>

          <div className="av-admin-order-grid">
            {loading ? <div className="av-admin-empty">Orders loading…</div> : filteredOrders.length ? filteredOrders.map((order) => <article className="av-admin-order" key={order.id}>
              <div className="av-admin-order-top">
                <div><h3>{order.name || "Customer"}</h3><p>{order.id}<br />{dateText(order.createdAt)}</p></div>
                <span className={"av-admin-status " + statusClass(order.status)}>{order.status || "Pending"}</span>
              </div>

              <div className="av-admin-order-details">
                <div><span>CONTACT</span><strong>{order.phone || "—"}<br />{order.district || "—"}<br />{order.address || "—"}</strong></div>
                <div><span>PRODUCT</span><strong>{order.product || "—"}<br />রঙ: {order.color || "—"} · Qty: {order.quantity || 1}</strong></div>
                <div><span>AMOUNT</span><strong>{typeof order.subtotal === "number" ? "৳ " + new Intl.NumberFormat("bn-BD").format(order.subtotal) : "—"}<br />Payment: {order.paymentStatus || "Not collected"}</strong></div>
              </div>

              <div className="av-admin-order-actions">
                {(order.status || "Pending") === "Pending" && <button className="av-admin-action primary" onClick={() => void setOrderStatus(order, "Confirmed")}>Confirm order</button>}
                {order.status === "Confirmed" && <button className="av-admin-action primary" onClick={() => void setOrderStatus(order, "Delivered")}>Mark delivered</button>}
                {order.status !== "Cancelled" && order.status !== "Delivered" && <button className="av-admin-action danger" onClick={() => void setOrderStatus(order, "Cancelled")}>Cancel</button>}
                {order.phone && <a className="av-admin-action" href={"tel:" + order.phone}>Call customer</a>}
                {order.phone && /^01[3-9]\d{8}$/.test(order.phone) && <a className="av-admin-action" href={"https://wa.me/88" + order.phone} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
              </div>
            </article>) : <div className="av-admin-empty">এই filter-এ কোনো order পাওয়া যায়নি।</div>}
          </div>
        </section>}

        {tab === "settings" && <section className="av-admin-panel">
          <div className="av-admin-panel-head">
            <div><h2>Settings & security</h2><p>Production launch-এর আগে এই অংশ শেষ করতে হবে।</p></div>
          </div>
          <div className="av-admin-settings-note">
            <p><strong>Admin session:</strong> Firebase Authentication sign-in gate active। Database-side rules deploy করার পর authorization server-side enforce হবে।</p>
            <p><strong>Telegram:</strong> Bot token admin browser-এ দেখানো বা public Firestore document-এ রাখা উচিত নয়। Production-এ <code>TELEGRAM_BOT_TOKEN</code> এবং <code>TELEGRAM_CHAT_ID</code> server environment variables হিসেবে রাখা হবে।</p>
            <p><strong>Authorization:</strong> Authorized account-এর UID অনুযায়ী <code>admins/{"{uid}"}</code> record রাখতে হবে।</p>
            <button type="button" className="av-admin-action danger" onClick={() => void signOut(auth)}>Sign out</button>
          </div>
        </section>}
      </main>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article className="av-admin-metric">
    <span>{label}</span>
    <strong>{new Intl.NumberFormat("bn-BD").format(value)}</strong>
  </article>;
}
