"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { productCategories, productsInCategory } from "@/lib/shop-categories";
import {
  canCancelOrder,
  maskEmail,
  maskPersonalText,
  maskPhone,
  nextOrderStatus,
  normalizeOrderStatus,
  privateAddressPlaceholder,
  productStockState,
  stockLabel,
  type OrderStatus,
} from "@/lib/admin";
import type { Product } from "@/lib/atelier";
import ProductSection from "./ProductSection";
import CategoryManager from "./CategoryManager";

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
  note?: string;
  createdAt?: TimestampLike;
};

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "products", label: "Products", icon: "◇" },
  { id: "categories", label: "Categories", icon: "▦" },
  { id: "orders", label: "Orders", icon: "▤" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

const nextStatusLabel: Partial<Record<OrderStatus, string>> = {
  Confirmed: "Confirm order",
  Packed: "Mark packed",
  Shipped: "Mark shipped",
  Delivered: "Mark delivered",
};

function dateText(value?: TimestampLike) {
  try {
    const date = typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value?.seconds === "number"
        ? new Date(value.seconds * 1000)
        : null;
    return date
      ? new Intl.DateTimeFormat("bn-BD", { dateStyle: "medium", timeStyle: "short" }).format(date)
      : "তারিখ পাওয়া যায়নি";
  } catch {
    return "তারিখ পাওয়া যায়নি";
  }
}

function statusClass(status: unknown) {
  return normalizeOrderStatus(status).toLowerCase();
}

function parseProduct(id: string, raw: Record<string, any>): Product {
  return {
    id,
    name: String(raw.name || "AVEN Product"),
    category: String(raw.category || "কালেকশন"),
    price: Number(raw.price || 0),
    oldPrice: Number(raw.oldPrice || 0),
    description: String(raw.description || ""),
    mainImage: String(raw.mainImage || "/products/pink.png"),
    colors: Array.isArray(raw.colors) ? raw.colors : [],
    available: raw.available !== false,
    stock: typeof raw.stock === "number" ? raw.stock : undefined,
    createdAt: typeof raw.createdAt?.seconds === "number" ? raw.createdAt.seconds * 1000 : 0,
  };
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
  const [privacyMode, setPrivacyMode] = useState(true);
  const [revealedOrders, setRevealedOrders] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [orderSnap, productSnap] = await Promise.all([
        getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "products"), orderBy("createdAt", "desc"))),
      ]);

      setOrders(orderSnap.docs.map((item) => ({ id: item.id, ...item.data() } as Order)));
      setProducts(productSnap.docs.map((item) => parseProduct(item.id, item.data())));
    } catch (error) {
      console.error("AVEN_ADMIN_LOAD_FAILED", error instanceof Error ? error.name : "UnknownError");
      setMessage("Admin data load করা যায়নি। Firebase permission ও connection যাচাই করুন।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("aven:admin-refresh", refresh);
    return () => window.removeEventListener("aven:admin-refresh", refresh);
  }, [load]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  useEffect(() => {
    const protect = () => {
      setPrivacyMode(true);
      setRevealedOrders(new Set());
    };
    const onVisibility = () => {
      if (document.hidden) protect();
    };
    window.addEventListener("blur", protect);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", protect);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const metrics = useMemo(() => ({
    orders: orders.length,
    pending: orders.filter((order) => normalizeOrderStatus(order.status) === "Pending").length,
    processing: orders.filter((order) => ["Confirmed", "Packed", "Shipped"].includes(normalizeOrderStatus(order.status))).length,
    delivered: orders.filter((order) => normalizeOrderStatus(order.status) === "Delivered").length,
    lowStock: products.filter((product) => ["low", "out"].includes(productStockState(product))).length,
  }), [orders, products]);

  const requestValue = useMemo(() => orders
    .filter((order) => normalizeOrderStatus(order.status) !== "Cancelled")
    .reduce((sum, order) => sum + (typeof order.subtotal === "number" ? order.subtotal : 0), 0), [orders]);

  const inventoryAlerts = useMemo(() => products
    .filter((product) => ["low", "out"].includes(productStockState(product)))
    .sort((a, b) => {
      const rank = { out: 0, low: 1, healthy: 2, untracked: 3 };
      return rank[productStockState(a)] - rank[productStockState(b)];
    }), [products]);

  const categories = useMemo(() => productCategories(products), [products]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const text = [order.name, order.phone, order.product, order.id, order.district]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const searchOkay = !search.trim() || text.includes(search.trim().toLowerCase());
    const statusOkay = statusFilter === "all" || normalizeOrderStatus(order.status) === statusFilter;
    return searchOkay && statusOkay;
  }), [orders, search, statusFilter]);

  async function setOrderStatus(order: Order, status: OrderStatus) {
    if (status === "Cancelled" && !window.confirm(order.id + " order cancel করবেন?")) return;
    if (status === "Delivered" && !window.confirm(order.id + " delivery complete হয়েছে নিশ্চিত?")) return;

    setMessage("");
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status,
        statusUpdatedAt: serverTimestamp(),
      });
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

  function toggleOrderPrivacy(orderId: string) {
    setRevealedOrders((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function privateVisible(orderId: string) {
    return !privacyMode || revealedOrders.has(orderId);
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(label + " copy হয়েছে।");
    } catch {
      setMessage("Copy করা যায়নি। Browser permission যাচাই করুন।");
    }
  }

  function exportOrders(includePrivate = false) {
    if (includePrivate && !window.confirm("এই CSV-তে customer-এর full name, phone ও address থাকবে। Secure device-এ export করছেন নিশ্চিত?")) return;

    const rows = [
      ["Reference", "Status", "Customer", "Phone", "District", "Address", "Product", "Color", "Quantity", "Subtotal", "Payment"],
      ...filteredOrders.map((order) => [
        order.id,
        normalizeOrderStatus(order.status),
        includePrivate ? (order.name || "") : maskPersonalText(order.name || ""),
        includePrivate ? (order.phone || "") : maskPhone(order.phone || ""),
        includePrivate ? (order.district || "") : maskPersonalText(order.district || ""),
        includePrivate ? (order.address || "") : privateAddressPlaceholder(order.address || ""),
        order.product || "",
        order.color || "",
        String(order.quantity || 1),
        typeof order.subtotal === "number" ? String(order.subtotal) : "",
        order.paymentStatus || "Not collected",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(","))
      .join("\n");

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
      {menuOpen && <button type="button" className="av-admin-backdrop" aria-label="Admin menu বন্ধ করুন" onClick={() => setMenuOpen(false)} />}

      <aside className={"av-admin-side " + (menuOpen ? "is-open" : "")}>
        <button type="button" className="av-admin-side-close" aria-label="Menu বন্ধ করুন" onClick={() => setMenuOpen(false)}>×</button>

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
          <strong>{privacyMode ? maskEmail(auth.currentUser?.email || "admin@aven.store") : (auth.currentUser?.email || "Authorized admin")}</strong>
          <span>Firebase authenticated session</span>
        </div>
      </aside>

      <main className="av-admin-main">
        <header className="av-admin-topbar">
          <div className="av-admin-topbar-left">
            <button type="button" className="av-admin-mobile-toggle" onClick={() => setMenuOpen(true)} aria-label="Admin menu খুলুন">☰</button>
            <div>
              <p className="av-admin-kicker">AVEN / ADMINISTRATION</p>
              <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
              <p>Products, categories, inventory এবং orders এক জায়গা থেকে manage করুন।</p>
            </div>
          </div>

          <div className="av-admin-top-actions">
            <button type="button" className={"av-admin-privacy-toggle " + (privacyMode ? "is-private" : "is-visible")} onClick={() => {
              setPrivacyMode((value) => !value);
              setRevealedOrders(new Set());
            }}>
              {privacyMode ? "◉ Privacy ON" : "◉ Private data visible"}
            </button>
            <span className="av-admin-user-pill">{privacyMode ? maskEmail(auth.currentUser?.email || "admin@aven.store") : (auth.currentUser?.email || "Admin")}</span>
            <Link className="av-admin-preview" href="/" target="_blank">Storefront দেখুন ↗</Link>
          </div>
        </header>

        <div className="av-admin-systembar">
          <span><i className="is-good" /> Admin login active</span>
          <span><i className="is-good" /> Firestore admin access</span>
          <span><i className={privacyMode ? "is-good" : "is-note"} /> {privacyMode ? "Private data masked" : "Private data visible"}</span>
          <span><i className="is-note" /> Images: URL mode</span>
        </div>

        {message && <div className="av-admin-notice" role="status">
          <span aria-hidden="true">✓</span>
          <div>{message}</div>
          <button type="button" aria-label="Message বন্ধ করুন" onClick={() => setMessage("")}>×</button>
        </div>}

        {tab === "overview" && <>
          <section className="av-admin-metrics">
            <Metric label="Total orders" value={metrics.orders} />
            <Metric label="Pending" value={metrics.pending} />
            <Metric label="Processing" value={metrics.processing} />
            <Metric label="Delivered" value={metrics.delivered} />
            <Metric label="Stock alerts" value={metrics.lowStock} />
          </section>

          <section className="av-admin-overview-strip">
            <div>
              <span>ORDER REQUEST VALUE</span>
              <strong>৳ {new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 2 }).format(requestValue)}</strong>
              <small>Cancelled orders বাদ। এটা collected revenue নয়।</small>
            </div>
            <button className="av-admin-action primary" type="button" onClick={() => changeTab("products")}>Manage products</button>
            <button className="av-admin-action" type="button" onClick={() => changeTab("orders")}>Open orders</button>
          </section>

          <div className="av-admin-grid">
            <section className="av-admin-panel">
              <div className="av-admin-panel-head">
                <div><h2>Recent orders</h2><p>সর্বশেষ customer order requests</p></div>
                <button className="av-admin-action" onClick={() => changeTab("orders")}>সব দেখুন</button>
              </div>

              <div className="av-admin-list">
                {loading ? <div className="av-admin-empty">Loading…</div> : orders.length ? orders.slice(0, 6).map((order) => <div className="av-admin-list-row" key={order.id}>
                  <div>
                    <strong>{privacyMode ? maskPersonalText(order.name || "Customer") : (order.name || "Customer")}</strong>
                    <span>{order.product || "Order"} · {dateText(order.createdAt)}</span>
                  </div>
                  <span className={"av-admin-status " + statusClass(order.status)}>{normalizeOrderStatus(order.status)}</span>
                </div>) : <div className="av-admin-empty">এখনো কোনো order নেই।</div>}
              </div>
            </section>

            <section className="av-admin-panel">
              <div className="av-admin-panel-head">
                <div><h2>Inventory alerts</h2><p>Stock শেষ বা কম হয়ে আসা products</p></div>
                <button className="av-admin-action" onClick={() => changeTab("products")}>Products</button>
              </div>

              <div className="av-admin-list">
                {inventoryAlerts.length ? inventoryAlerts.slice(0, 6).map((product) => <div className="av-admin-list-row" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.category}</span>
                  </div>
                  <span className={"av-admin-stock-badge is-" + productStockState(product)}>{stockLabel(product)}</span>
                </div>) : <div className="av-admin-empty">Tracked stock-এ কোনো alert নেই।</div>}
              </div>
            </section>
          </div>

          <section className="av-admin-panel av-admin-structure-panel">
            <div className="av-admin-panel-head">
              <div><h2>Store structure</h2><p>Homepage category overview</p></div>
              <button className="av-admin-action" onClick={() => changeTab("categories")}>Manage categories</button>
            </div>

            <div className="av-admin-structure-grid">
              {categories.map((category) => {
                const count = productsInCategory(products, category.key).length;
                return <div className="av-admin-structure-item" key={category.key}>
                  <span>{category.eyebrow}</span>
                  <strong>{category.name}</strong>
                  <small>{count ? new Intl.NumberFormat("bn-BD").format(count) + "টি product" : "এখনো product নেই"}</small>
                </div>;
              })}
            </div>
          </section>
        </>}

        {tab === "products" && <section className="av-admin-product-wrap"><ProductSection /></section>}

        {tab === "categories" && <section className="av-admin-panel">
          <div className="av-admin-panel-head">
            <div><h2>Product categories</h2><p>Main collections এবং custom categories manage করুন।</p></div>
          </div>
          <CategoryManager products={products} />
        </section>}

        {tab === "orders" && <section className="av-admin-panel">
          <div className="av-admin-panel-head">
            <div>
              <h2>Order management</h2>
              <p>Customer details, fulfilment status এবং contact actions.</p>
            </div>
            <div className="av-admin-order-head-actions">
              <button className="av-admin-action" onClick={() => exportOrders(false)}>Export masked CSV</button>
              <button className="av-admin-action" onClick={() => exportOrders(true)}>Export full CSV</button>
              <button className="av-admin-action" onClick={() => void load()}>Refresh</button>
            </div>
          </div>

          <div className="av-admin-toolbar">
            <input
              className="av-admin-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="নাম, ফোন, district, product বা order reference…"
            />
            <select className="av-admin-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">সব status</option>
              <option>Pending</option>
              <option>Confirmed</option>
              <option>Packed</option>
              <option>Shipped</option>
              <option>Delivered</option>
              <option>Cancelled</option>
            </select>
          </div>

          <div className="av-admin-order-grid">
            {loading ? <div className="av-admin-empty">Orders loading…</div> : filteredOrders.length ? filteredOrders.map((order) => {
              const status = normalizeOrderStatus(order.status);
              const next = nextOrderStatus(status);

              const showPrivate = privateVisible(order.id);

              return <article className="av-admin-order" key={order.id}>
                <div className="av-admin-order-top">
                  <div>
                    <h3>{showPrivate ? (order.name || "Customer") : maskPersonalText(order.name || "Customer")}</h3>
                    <p>{order.id}<br />{dateText(order.createdAt)}</p>
                  </div>
                  <span className={"av-admin-status " + statusClass(status)}>{status}</span>
                </div>

                <div className="av-admin-order-details">
                  <div>
                    <span>CONTACT · {showPrivate ? "VISIBLE" : "MASKED"}</span>
                    <strong>
                      {showPrivate ? (order.phone || "—") : maskPhone(order.phone || "")}
                      <br />
                      {showPrivate ? (order.district || "—") : maskPersonalText(order.district || "")}
                      <br />
                      {showPrivate ? (order.address || "—") : privateAddressPlaceholder(order.address || "")}
                    </strong>
                  </div>
                  <div>
                    <span>PRODUCT</span>
                    <strong>{order.product || "—"}<br />রঙ: {order.color || "—"} · Qty: {order.quantity || 1}</strong>
                  </div>
                  <div>
                    <span>AMOUNT</span>
                    <strong>
                      {typeof order.subtotal === "number" ? "৳ " + new Intl.NumberFormat("bn-BD").format(order.subtotal) : "—"}
                      <br />Payment: {order.paymentStatus || "Not collected"}
                    </strong>
                  </div>
                </div>

                {order.note && <div className="av-admin-order-note"><span>Customer note</span><p>{showPrivate ? order.note : "•••••••••• Customer note hidden by Privacy Mode"}</p></div>}

                <div className="av-admin-order-actions">
                  {next && <button className="av-admin-action primary" onClick={() => void setOrderStatus(order, next)}>
                    {nextStatusLabel[next] || ("Move to " + next)}
                  </button>}

                  {canCancelOrder(status) && <button className="av-admin-action danger" onClick={() => void setOrderStatus(order, "Cancelled")}>Cancel</button>}

                  <button className="av-admin-action privacy" type="button" onClick={() => toggleOrderPrivacy(order.id)}>
                    {showPrivate ? "Hide private info" : "Show private info"}
                  </button>

                  {showPrivate && order.phone && <a className="av-admin-action" href={"tel:" + order.phone}>Call</a>}

                  {showPrivate && order.phone && /^01[3-9]\d{8}$/.test(order.phone) && <a
                    className="av-admin-action"
                    href={"https://wa.me/88" + order.phone + "?text=" + encodeURIComponent("আসসালামু আলাইকুম, AVEN থেকে আপনার order " + order.id + " সম্পর্কে যোগাযোগ করছি।")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >WhatsApp</a>}

                  {showPrivate && order.address && <button className="av-admin-action" type="button" onClick={() => void copyText(order.address || "", "Address")}>Copy address</button>}
                  <button className="av-admin-action" type="button" onClick={() => void copyText(order.id, "Order reference")}>Copy ID</button>
                </div>
              </article>;
            }) : <div className="av-admin-empty">এই filter-এ কোনো order পাওয়া যায়নি।</div>}
          </div>
        </section>}

        {tab === "settings" && <section className="av-admin-panel">
          <div className="av-admin-panel-head">
            <div><h2>Settings & security</h2><p>বর্তমান AVEN admin configuration</p></div>
          </div>

          <div className="av-admin-settings-grid">
            <article>
              <span>ADMIN SESSION</span>
              <strong>{privacyMode ? maskEmail(auth.currentUser?.email || "admin@aven.store") : (auth.currentUser?.email || "Authenticated admin")}</strong>
              <p>Firebase Authentication দিয়ে protected session.</p>
            </article>

            <article>
              <span>DATABASE ACCESS</span>
              <strong>Admin-authorized Firestore</strong>
              <p>Products/categories admin-write; order management authenticated admin-এর জন্য।</p>
            </article>

            <article>
              <span>PRODUCT IMAGES</span>
              <strong>URL mode</strong>
              <p>বর্তমানে built-in AVEN path / Firebase URL / Cloudinary URL support করা হচ্ছে। Direct file upload পরে Cloudinary connect করলে যোগ হবে।</p>
            </article>

            <article>
              <span>PAYMENT</span>
              <strong>Not collected online</strong>
              <p>Website order request নেয়; online payment successful বলে claim করে না।</p>
            </article>
          </div>

          <div className="av-admin-settings-note">
            <p><strong>Telegram:</strong> Order notification চালু করতে server-side <code>TELEGRAM_BOT_TOKEN</code> এবং <code>TELEGRAM_CHAT_ID</code> environment variables ব্যবহার করতে হবে।</p>
            <p><strong>Admin authorization:</strong> Firebase UID-এর <code>admins/{"{uid}"}</code> document-এ <code>active: true</code> থাকতে হবে।</p>
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
