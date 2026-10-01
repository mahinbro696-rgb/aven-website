"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CONTACT, normalizeProduct, money, productMessage, whatsappLink, type Product } from "@/lib/atelier";
import { Dialog, Empty, Icon, Photo, useWishlist } from "./Primitives";
import { ProductCard, ProductDetails } from "./CatalogProduct";
import { Hero, Story, HowTo, Contact } from "./Sections";
import { CommerceProvider, useCommerce } from "./CommerceState";
import CommerceLayer from "./ShoppingBag";

type Overlay = { type: "menu" } | { type: "saved" } | { type: "search" }
  | { type: "quick"; product: Product } | { type: "image"; src: string; alt: string } | null;

export default function Storefront(props: { productId?: string }) {
  return <CommerceProvider><StorefrontView {...props} /></CommerceProvider>;
}
function StorefrontView({ productId }: { productId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [savedOnly, setSavedOnly] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState("");
  const wishlist = useWishlist();
  const bag = useCommerce();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) { setError("সংযোগে দেরি হচ্ছে। আবার চেষ্টা করুন অথবা WhatsApp-এ কথা বলুন।"); setLoading(false); }
    }, 15000);
    getDocs(collection(db, "products")).then((snapshot) => {
      if (cancelled) return;
      window.clearTimeout(timeout);
      setProducts(snapshot.docs.map((item) => normalizeProduct(item.id, item.data()))
        .sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name, "bn")));
      setError(""); setLoading(false);
    }).catch(() => {
      window.clearTimeout(timeout);
      if (!cancelled) { setError("কালেকশন লোড করা যায়নি। আবার চেষ্টা করুন অথবা WhatsApp-এ যোগাযোগ করুন।"); setLoading(false); }
    });
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [retry]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q");
    const collectionName = params.get("collection");
    queueMicrotask(() => { if (initial) setQuery(initial); if (collectionName) setCategory(collectionName); });
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 4000); return () => window.clearTimeout(timer); }, [toast]);

  const close = useCallback(() => setOverlay(null), []);
  const order = (product: Product, color = "", quantity = 1) => { close(); setToast(""); bag.buy(product, color, quantity); };
  const add = (product: Product, color = "", quantity = 1) => { close(); setToast(""); return bag.add(product, color, quantity); };
  const showBag = () => { close(); setToast(""); bag.openBag(); };
  const categories = [...new Set(products.map((p) => p.category))];
  const filtered = products.filter((p) => (!category || p.category === category) && (!savedOnly || wishlist.ids.includes(p.id)) &&
    `${p.name} ${p.category} ${p.description} ${p.colors.map((c) => c.name).join(" ")}`.toLocaleLowerCase("bn").includes(query.trim().toLocaleLowerCase("bn")))
    .sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name, "bn") : b.createdAt - a.createdAt);
  const reload = () => { setLoading(true); setError(""); setRetry((n) => n + 1); };
  const browse = (name = "") => {
    setCategory(name); setQuery(""); setSavedOnly(false);
    if (productId) { window.location.assign(`/?collection=${encodeURIComponent(name)}#shop`); return; }
    window.history.replaceState(null, "", `/${name ? `?collection=${encodeURIComponent(name)}` : ""}#shop`);
    document.getElementById("shop")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const product = productId ? products.find((item) => item.id === productId) : undefined;
  const toggleSave = (id: string) => {
    const removing = wishlist.ids.includes(id); wishlist.toggle(id);
    setToast(removing ? "পছন্দের তালিকা থেকে সরানো হয়েছে" : "পছন্দের তালিকায় রাখা হয়েছে");
  };
  const copyNumber = async () => {
    try { await navigator.clipboard.writeText(CONTACT.display); setToast("নম্বর কপি হয়েছে"); }
    catch { setToast(`কপি করা যায়নি। নম্বরটি: ${CONTACT.display}`); }
  };
  const grid = (items: Product[]) => <div className="av-product-grid">{items.map((item) => <ProductCard key={item.id} product={item} saved={wishlist.ids.includes(item.id)} onSave={() => toggleSave(item.id)} onQuick={() => setOverlay({ type: "quick", product: item })} onOrder={(color) => order(item, color)} onAdd={(color) => add(item, color)} />)}</div>;
  const collectionTiles = categories.length ? categories.slice(0, 3).map((name, index) => ({
    name, image: products.find((p) => p.category === name)?.mainImage || "/products/hero.png", label: ["The signature edit", "A different mood", "Details to love"][index], filter: name,
  })) : [
    { name: "স্নিগ্ধতার ছোঁয়া", image: "/products/pink.png", label: "The rose edit", filter: "" },
    { name: "নিজস্বতার রঙ", image: "/products/Blue.png", label: "The blue edit", filter: "" },
    { name: "উজ্জ্বল মুহূর্ত", image: "/products/Yellow.png", label: "The golden edit", filter: "" },
  ];
  const savedProducts = products.filter((p) => wishlist.ids.includes(p.id));

  return <div className="av">
    <a className="av-skip" href="#main-content">মূল অংশে যান</a>
    <div className="av-announcement"><span>AVEN / THE EVERYDAY HEIRLOOM</span><a href={`tel:${CONTACT.international}`}>কথা বলুন <span>{CONTACT.display}</span><Icon name="arrow" size={14} /></a></div>
    <header className="av-header"><div className="av-header-inner av-container"><div className="av-nav-left">
      <button type="button" className="av-icon-btn av-mobile-menu" onClick={() => setOverlay({ type: "menu" })} aria-label="মেনু খুলুন"><Icon name="menu" /></button>
      <nav aria-label="প্রধান মেনু" className="av-desktop-nav"><Link href="/#shop">কালেকশন</Link><Link href="/#story">আমাদের গল্প</Link></nav>
    </div><Link href="/" className="av-logo" aria-label="AVEN হোম">AVEN<span>THE ART OF EVERYDAY ELEGANCE</span></Link>
      <div className="av-header-actions"><Link href="/#contact" className="av-header-contact">যোগাযোগ</Link>
        <button type="button" className="av-icon-btn" onClick={() => setOverlay({ type: "search" })} aria-label="পণ্য খুঁজুন"><Icon name="search" /></button>
        <button type="button" className="av-icon-btn av-saved-button" onClick={() => setOverlay({ type: "saved" })} aria-label={`পছন্দের তালিকা, ${wishlist.ids.length}টি পণ্য`}><Icon name="heart" />{wishlist.ids.length > 0 && <span className="av-count">{wishlist.ids.length}</span>}</button>
        <button type="button" className="av-icon-btn av-bag-button" onClick={showBag} aria-label={`Shopping Bag খুলুন, ${bag.count}টি পণ্য`}><Icon name="bag" /><span key={bag.count} className="av-bag-count">{bag.count}</span></button>
      </div></div></header>
    <main id="main-content">{!productId ? <>
      <Hero onShop={() => browse()} />
      <div className="av-ribbon" aria-label="আমাদের কালেকশন"><span>ঐতিহ্যের ছোঁয়া</span><Icon name="spark" size={15} /><span>নিজস্বতার সৌন্দর্য</span><Icon name="spark" size={15} /><span>AVEN, EVERY DAY</span><Icon name="spark" size={15} /><span>আপনার পছন্দে, আপনার রঙে</span></div>
      <section className="av-section av-collection-section" id="collections"><div className="av-container">
        <div className="av-section-top"><div><p className="av-eyebrow">01 / THE COLLECTIONS</p><h2>প্রতিটি রঙে,<br /><em>নতুন এক গল্প।</em></h2></div><p className="av-section-intro">কখনো স্নিগ্ধ, কখনো উজ্জ্বল।<br />আপনার মুহূর্তের সঙ্গে মানানসই পছন্দ।</p></div>
        <div className={`av-collection-grid ${collectionTiles.length < 3 ? "av-collection-fewer" : ""}`}>{collectionTiles.map((item, index) => <button key={item.name} type="button" className="av-collection" onClick={() => browse(item.filter)}>
          <div className="av-collection-image"><Photo src={item.image} alt={item.name} sizes="(max-width: 700px) 85vw, 33vw" /><span className="av-collection-number">0{index + 1}</span><span className="av-collection-arrow"><Icon name="arrow" /></span></div>
          <div className="av-collection-caption"><div><small>{item.label}</small><h3>{item.name}</h3></div><span>দেখুন</span></div>
        </button>)}</div>
      </div></section>
      <section className="av-shop av-section" id="shop"><div className="av-container">
        <div className="av-section-top"><div><p className="av-eyebrow">02 / SELECTED FOR YOU</p><h2>পছন্দ হোক <em>নিজের মতো।</em></h2></div><p className="av-section-intro">এখনই কিনুন অথবা ব্যাগে রাখুন।<br />আপনার কেনাকাটা, আপনার ছন্দে।</p></div>
        <div className="av-shop-tools"><label className="av-search-field"><Icon name="search" /><span className="av-sr-only">নাম বা রঙ দিয়ে পণ্য খুঁজুন</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="নাম বা রঙ দিয়ে খুঁজুন…" type="search" /></label>
          <label className="av-sort"><span>সাজান</span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="পণ্য সাজান"><option value="newest">নতুন আগে</option><option value="price-asc">কম দাম আগে</option><option value="price-desc">বেশি দাম আগে</option><option value="name">নাম অনুযায়ী</option></select></label>
        </div><div className="av-filter-row"><div className="av-filters" aria-label="কালেকশন ফিল্টার"><button type="button" aria-pressed={!category && !savedOnly} className={!category && !savedOnly ? "is-active" : ""} onClick={() => { setCategory(""); setSavedOnly(false); }}>সব পণ্য</button>
          {categories.map((name) => <button type="button" key={name} aria-pressed={category === name && !savedOnly} className={category === name && !savedOnly ? "is-active" : ""} onClick={() => { setCategory(name); setSavedOnly(false); }}>{name}</button>)}
          <button type="button" aria-pressed={savedOnly} className={savedOnly ? "is-active" : ""} onClick={() => { setSavedOnly(!savedOnly); setCategory(""); }}><Icon name="heart" size={14} />পছন্দের তালিকা</button>
        </div><span className="av-results" aria-live="polite">{loading ? "লোড হচ্ছে…" : `${new Intl.NumberFormat("bn-BD").format(filtered.length)}টি পণ্য`}</span></div>
        {loading ? <div className="av-product-grid" aria-busy="true" aria-label="পণ্য লোড হচ্ছে">{[0, 1, 2].map((i) => <div key={i} className="av-skeleton" />)}</div>
          : error ? <Empty title="এই মুহূর্তে কালেকশন দেখা যাচ্ছে না" text={error}><button type="button" className="av-btn av-btn-dark" onClick={reload}>আবার চেষ্টা করুন <Icon name="arrow" /></button><a className="av-text-link" href={whatsappLink()} target="_blank" rel="noopener noreferrer">WhatsApp-এ কথা বলুন</a></Empty>
          : filtered.length ? grid(filtered) : <Empty title={products.length ? "মিলে যায় এমন পণ্য নেই" : "নতুন কালেকশনের খোঁজ নিন"} text={products.length ? "অন্য নাম, রঙ অথবা কালেকশন দিয়ে খুঁজে দেখুন।" : "পণ্যের বর্তমান তথ্য জানতে সরাসরি আমাদের সঙ্গে কথা বলুন।"}>
            {products.length ? <button type="button" className="av-btn av-btn-dark" onClick={() => { setQuery(""); setCategory(""); setSavedOnly(false); }}>সব পণ্য দেখুন</button> : <a className="av-btn av-btn-dark" href={whatsappLink()} target="_blank" rel="noopener noreferrer">WhatsApp করুন <Icon name="chat" /></a>}
          </Empty>}
      </div></section><Story onShop={() => browse()} /><HowTo />
    </> : <div className="av-detail-page av-container"><Link className="av-back" href="/#shop">← কালেকশনে ফিরে যান</Link>
      {loading ? <div className="av-detail-loading" role="status"><span className="av-spinner" />পণ্য লোড হচ্ছে…</div>
        : error ? <Empty title="পণ্য লোড করা যায়নি" text={error}><button type="button" className="av-btn av-btn-gold" onClick={reload}>আবার চেষ্টা করুন</button></Empty>
        : product ? <ProductDetails key={product.id} product={product} onOrder={order} onAdd={add} saved={wishlist.ids.includes(product.id)} onSave={() => toggleSave(product.id)} onZoom={(src) => setOverlay({ type: "image", src, alt: product.name })} onNotice={setToast} />
        : <Empty title="পণ্যটি পাওয়া যায়নি" text="পণ্যটি সরানো হয়ে থাকতে পারে। বর্তমান কালেকশন দেখুন।"><Link className="av-btn av-btn-gold" href="/#shop">কালেকশনে ফিরুন</Link></Empty>}
      {product && products.length > 1 && <section className="av-related"><p className="av-eyebrow">YOU MAY ALSO LIKE</p><h2>আরও কিছু <em>পছন্দ।</em></h2>{grid(products.filter((item) => item.id !== product.id).slice(0, 3))}</section>}
    </div>}
    <Contact onCopy={() => void copyNumber()} /></main>
    <footer className="av-footer"><div className="av-container"><div className="av-footer-top"><Link href="/" className="av-footer-logo" aria-label="AVEN হোম">AVEN</Link><p>ঐতিহ্যে অনুপ্রাণিত।<br />আপনার নিজস্বতায় পরিপূর্ণ।</p><nav aria-label="ফুটার মেনু"><Link href="/#shop">কালেকশন</Link><Link href="/#how-to-order">অর্ডারের নিয়ম</Link><Link href="/#contact">যোগাযোগ</Link></nav></div><div className="av-footer-bottom"><span>© 2026 AVEN. সর্বস্বত্ব সংরক্ষিত।</span><span>TRADITION, REIMAGINED.</span></div></div></footer>
    <a className={`av-floating-chat ${productId && product ? "av-floating-chat-detail" : ""}`} href={whatsappLink()} target="_blank" rel="noopener noreferrer" aria-label="AVEN-এর সঙ্গে WhatsApp-এ কথা বলুন"><Icon name="chat" size={24} /><span>কথা বলুন</span></a>
    <div className={`av-toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">{toast && <><Icon name="check" size={18} />{toast}</>}</div>
    {overlay?.type === "menu" && <Dialog title="AVEN / মেনু" onClose={close}><nav className="av-menu-links">{[["কালেকশন", "/#shop"], ["আমাদের গল্প", "/#story"], ["অর্ডারের নিয়ম", "/#how-to-order"], ["যোগাযোগ", "/#contact"]].map(([label, href]) => <Link key={href} href={href} onClick={close}>{label}<Icon name="arrow" /></Link>)}<button type="button" className="av-btn av-btn-dark" onClick={showBag}>Shopping Bag ({bag.count}) <Icon name="bag" /></button><a href={whatsappLink()} target="_blank" rel="noopener noreferrer">WhatsApp<Icon name="chat" /></a><a href={`tel:${CONTACT.international}`}>{CONTACT.display}<Icon name="phone" /></a></nav></Dialog>}
    {overlay?.type === "search" && <Dialog title="আপনার পছন্দ খুঁজুন" onClose={close}><form className="av-search-modal" onSubmit={(event) => {
      event.preventDefault(); const q = String(new FormData(event.currentTarget).get("q") || ""); close();
      if (productId) window.location.assign(`/?q=${encodeURIComponent(q)}#shop`);
      else { setQuery(q); setCategory(""); setSavedOnly(false); document.getElementById("shop")?.scrollIntoView(); searchRef.current?.focus({ preventScroll: true }); }
    }}><label>পণ্যের নাম অথবা রঙ<input name="q" type="search" className="av-input" placeholder="যেমন: শাল, নীল, জামদানি…" defaultValue={query} autoFocus /></label><button className="av-btn av-btn-dark">পণ্য খুঁজুন <Icon name="search" /></button></form></Dialog>}
    {overlay?.type === "saved" && <Dialog title="আপনার পছন্দের তালিকা" onClose={close} wide><div className="av-saved-list">{loading ? <p role="status">পণ্য লোড হচ্ছে…</p> : error ? <p role="alert">{error}</p> : savedProducts.length ? savedProducts.map((p) =>
      <div className="av-saved-item" key={p.id}><Link href={`/product/${encodeURIComponent(p.id)}`} onClick={close} className="av-saved-image"><Photo src={p.mainImage} alt={p.name} sizes="80px" /></Link><div><Link href={`/product/${encodeURIComponent(p.id)}`} onClick={close}>{p.name}</Link><p>{p.price > 0 ? money(p.price) : "মূল্য জানতে যোগাযোগ করুন"}</p>{p.available && p.price > 0 ? <div className="av-purchase-actions"><button type="button" className="av-btn av-btn-dark" onClick={() => order(p)}>এখনই কিনুন</button><button type="button" className="av-btn av-add-to-bag" onClick={() => add(p)}>Add to Cart</button></div> : <a className="av-text-link" href={whatsappLink(productMessage(p))} target="_blank" rel="noopener noreferrer">স্টক ও দাম জেনে নিন →</a>}</div><button type="button" className="av-icon-btn" onClick={() => toggleSave(p.id)} aria-label={`${p.name} তালিকা থেকে সরান`}><Icon name="close" /></button></div>)
      : <Empty title="পছন্দের জিনিসগুলো এখানে রাখুন" text="পণ্যের পাশের হার্ট চিহ্নে চাপলে এই ব্রাউজারে সেটি সংরক্ষিত থাকবে।"><Link href="/#shop" className="av-btn av-btn-dark" onClick={close}>কালেকশন দেখুন</Link></Empty>}</div></Dialog>}
    {overlay?.type === "quick" && <Dialog title="এক নজরে" onClose={close} wide><ProductDetails key={overlay.product.id} product={overlay.product} compact onOrder={order} onAdd={add} saved={wishlist.ids.includes(overlay.product.id)} onSave={() => toggleSave(overlay.product.id)} onNotice={setToast} />{toast && <p className="av-small" role="status">{toast}</p>}</Dialog>}
    {overlay?.type === "image" && <Dialog title="পণ্যের ছবি" onClose={close} wide><div className="av-lightbox"><Photo key={overlay.src} src={overlay.src} alt={overlay.alt} eager sizes="90vw" /></div></Dialog>}
    <CommerceLayer products={products} loading={loading} error={error} reload={reload} />
  </div>;
}
