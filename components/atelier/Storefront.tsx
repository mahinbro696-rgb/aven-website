"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONTACT, money, whatsappLink, type Product } from "@/lib/atelier";
import { canSelect, isShowroom } from "@/lib/showroom";
import { Dialog, Empty, Icon, Photo, useWishlist } from "./Primitives";
import { ProductCard, ProductDetails } from "./CatalogProduct";
import { Hero, Story, HowTo, Contact } from "./Sections";
import { CommerceProvider, useCommerce } from "./CommerceState";
import CommerceLayer from "./ShoppingBag";
import { useCatalog } from "./useCatalog";

type Overlay = { type: "menu" | "saved" | "search" } | { type: "quick"; product: Product } | { type: "image"; src: string; alt: string } | null;
export default function Storefront(props: { productId?: string }) {
  return <CommerceProvider><StorefrontView {...props} /></CommerceProvider>;
}
function StorefrontView({ productId }: { productId?: string }) {
  const { products, status: catalogStatus, reload } = useCatalog();
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
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || ""); setCategory(params.get("collection") || "");
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 4000); return () => window.clearTimeout(timer); }, [toast]);
  const close = useCallback(() => setOverlay(null), []);
  const order = (p: Product, color = "", quantity = 1) => { close(); setToast(""); bag.buy(p, color, quantity); };
  const add = (p: Product, color = "", quantity = 1) => { close(); setToast(""); return bag.add(p, color, quantity); };
  const showBag = () => { close(); setToast(""); bag.openBag(); };
  const browse = () => {
    setCategory(""); setQuery(""); setSavedOnly(false);
    if (productId) { window.location.assign("/#shop"); return; }
    window.history.replaceState(null, "", "/#shop");
    document.getElementById("shop")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const toggleSave = (id: string) => {
    const removing = wishlist.ids.includes(id); wishlist.toggle(id);
    setToast(removing ? "পছন্দের তালিকা থেকে সরানো হয়েছে" : "পছন্দের তালিকায় রাখা হয়েছে");
  };
  const copyNumber = async () => {
    try { await navigator.clipboard.writeText(CONTACT.display); setToast("নম্বর কপি হয়েছে"); }
    catch { setToast(`কপি করা যায়নি। নম্বরটি: ${CONTACT.display}`); }
  };
  const categories = [...new Set(products.map((p) => p.category))];
  const filtered = products.filter((p) => (!category || p.category === category) && (!savedOnly || wishlist.ids.includes(p.id)) &&
    `${p.name} ${p.category} ${p.description} ${p.colors.map((c) => c.name).join(" ")}`.toLocaleLowerCase("bn").includes(query.trim().toLocaleLowerCase("bn")))
    .sort((a, b) => sort === "price-asc" ? (a.price || Infinity) - (b.price || Infinity) : sort === "price-desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name, "bn") : b.createdAt - a.createdAt);
  const product = products.find((p) => p.id === productId);
  const saved = products.filter((p) => wishlist.ids.includes(p.id));
  const grid = (items: Product[]) => <div className="av-product-grid">{items.map((p) => <ProductCard key={`${p.id}-${p.price}`} product={p} saved={wishlist.ids.includes(p.id)} onSave={() => toggleSave(p.id)} onQuick={() => setOverlay({ type: "quick", product: p })} onOrder={(color) => order(p, color)} onAdd={(color) => add(p, color)} />)}</div>;
  const menu = [["কালেকশন", "/#shop"], ["আমাদের গল্প", "/#story"], ["অর্ডারের নিয়ম", "/#how-to-order"], ["যোগাযোগ", "/#contact"]];

  return <div className="av" data-catalog-state={catalogStatus}>
    <a className="av-skip" href="#main-content">মূল অংশে যান</a>
    <div className="av-announcement"><span>AVEN / THE EVERYDAY HEIRLOOM</span><a href={`tel:${CONTACT.international}`}>কথা বলুন <span>{CONTACT.display}</span><Icon name="arrow" size={14} /></a></div>
    <header className="av-header"><div className="av-header-inner av-container"><div className="av-nav-left">
      <button type="button" className="av-icon-btn av-mobile-menu" onClick={() => setOverlay({ type: "menu" })} aria-label="মেনু খুলুন"><Icon name="menu" /></button>
      <nav aria-label="প্রধান মেনু" className="av-desktop-nav"><Link href="/#shop">কালেকশন</Link><Link href="/#story">আমাদের গল্প</Link></nav>
    </div><Link href="/" className="av-logo" aria-label="AVEN হোম">AVEN<span>THE ART OF EVERYDAY ELEGANCE</span></Link>
      <div className="av-header-actions"><Link href="/#contact" className="av-header-contact">যোগাযোগ</Link>
        <button type="button" className="av-icon-btn" onClick={() => setOverlay({ type: "search" })} aria-label="পণ্য খুঁজুন"><Icon name="search" /></button>
        <button type="button" className="av-icon-btn av-saved-button" onClick={() => setOverlay({ type: "saved" })} aria-label={`পছন্দের তালিকা, ${wishlist.ids.length}টি পণ্য`}><Icon name="heart" />{!!wishlist.ids.length && <span className="av-count">{wishlist.ids.length}</span>}</button>
        <button type="button" className="av-icon-btn av-bag-button" onClick={showBag} aria-label={`Shopping Bag খুলুন, ${bag.count}টি পণ্য`}><Icon name="bag" /><span key={bag.count} className="av-bag-count">{bag.count}</span></button>
      </div></div></header>
    <main id="main-content">{!productId ? <>
      <Hero onShop={browse} />
      <div className="av-ribbon"><span>ঐতিহ্যের ছোঁয়া</span><Icon name="spark" size={15} /><span>নিজস্বতার সৌন্দর্য</span><Icon name="spark" size={15} /><span>AVEN, EVERY DAY</span><Icon name="spark" size={15} /><span>আপনার পছন্দে, আপনার রঙে</span></div>
      <section className="av-shop av-section" id="shop"><div className="av-container">
        <div className="av-section-top"><div><p className="av-eyebrow">01 / FIND YOUR FAVOURITE</p><h2>পছন্দ হোক <em>নিজের মতো।</em></h2></div><p className="av-section-intro">ছবিতে চাপুন, বিস্তারিত দেখুন।<br />পছন্দ হলে অর্ডার করুন অথবা ব্যাগে রাখুন।</p></div>
        {catalogStatus !== "ready" && <div className="av-catalog-notice" role="status"><Icon name="bag" size={20} /><p>{catalogStatus === "checking" ? "বর্তমান দাম ও স্টক যাচাই হচ্ছে। এর মধ্যেই নিচের ডিজাইনগুলো দেখতে পারেন।" : catalogStatus === "empty" ? "এই ডিজাইনগুলোর দাম এখনো প্রকাশ করা হয়নি। পছন্দেরটি বেছে দাম ও স্টক নিশ্চিত করে অর্ডার করুন।" : "এই মুহূর্তে বর্তমান দাম যাচাই করা যাচ্ছে না। ছবির ডিজাইন বেছে WhatsApp-এ দাম ও স্টক জেনে নিন।"}</p>{catalogStatus !== "checking" && <button type="button" onClick={reload}>আবার যাচাই</button>}</div>}
        <div className="av-shop-tools"><label className="av-search-field"><Icon name="search" /><span className="av-sr-only">নাম বা রঙ দিয়ে পণ্য খুঁজুন</span><input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="নাম বা রঙ দিয়ে খুঁজুন…" type="search" /></label>
          <label className="av-sort"><span>সাজান</span><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="পণ্য সাজান"><option value="newest">নতুন আগে</option><option value="price-asc">কম দাম আগে</option><option value="price-desc">বেশি দাম আগে</option><option value="name">নাম অনুযায়ী</option></select></label>
        </div><div className="av-filter-row"><div className="av-filters" aria-label="কালেকশন ফিল্টার"><button type="button" aria-pressed={!category && !savedOnly} className={!category && !savedOnly ? "is-active" : ""} onClick={() => { setCategory(""); setSavedOnly(false); }}>সব পণ্য</button>
          {categories.map((name) => <button type="button" key={name} aria-pressed={category === name && !savedOnly} className={category === name && !savedOnly ? "is-active" : ""} onClick={() => { setCategory(name); setSavedOnly(false); }}>{name}</button>)}
          <button type="button" aria-pressed={savedOnly} className={savedOnly ? "is-active" : ""} onClick={() => { setSavedOnly(!savedOnly); setCategory(""); }}><Icon name="heart" size={14} />পছন্দের তালিকা</button>
        </div><span className="av-results" aria-live="polite">{new Intl.NumberFormat("bn-BD").format(filtered.length)}টি পছন্দ</span></div>
        {filtered.length ? grid(filtered) : <Empty title="মিলে যায় এমন পছন্দ নেই" text="অন্য নাম বা রঙ দিয়ে খুঁজুন, অথবা সব ডিজাইন দেখুন।"><button type="button" className="av-btn av-btn-dark" onClick={browse}>সব ডিজাইন দেখুন</button></Empty>}
      </div></section><Story onShop={browse} /><HowTo />
    </> : <div className="av-detail-page av-container"><Link className="av-back" href="/#shop">← কালেকশনে ফিরে যান</Link>
      {product ? <ProductDetails key={`${product.id}-${product.price}`} product={product} onOrder={order} onAdd={add} saved={wishlist.ids.includes(product.id)} onSave={() => toggleSave(product.id)} onZoom={(src) => setOverlay({ type: "image", src, alt: product.name })} onNotice={setToast} />
        : catalogStatus === "checking" ? <div className="av-detail-loading" role="status"><span className="av-spinner" />পণ্যের তথ্য আসছে…</div>
        : <Empty title="পণ্যের বর্তমান তথ্য পাওয়া যাচ্ছে না" text="কালেকশনে ফিরুন অথবা আমাদের সঙ্গে সরাসরি কথা বলুন।"><Link className="av-btn av-btn-dark" href="/#shop">কালেকশনে ফিরুন</Link><a className="av-text-link" href={whatsappLink()} target="_blank" rel="noopener noreferrer">WhatsApp-এ কথা বলুন</a></Empty>}
      {product && products.length > 1 && <section className="av-related"><p className="av-eyebrow">YOU MAY ALSO LIKE</p><h2>আরও কিছু <em>পছন্দ।</em></h2>{grid(products.filter((p) => p.id !== product.id).slice(0, 3))}</section>}
    </div>}
    <Contact onCopy={() => void copyNumber()} /></main>
    <footer className="av-footer"><div className="av-container"><div className="av-footer-top"><Link href="/" className="av-footer-logo" aria-label="AVEN হোম">AVEN</Link><p>ঐতিহ্যে অনুপ্রাণিত।<br />আপনার নিজস্বতায় পরিপূর্ণ।</p><nav aria-label="ফুটার মেনু">{menu.filter(([, href]) => href !== "/#story").map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav></div><div className="av-footer-bottom"><span>© 2026 AVEN. সর্বস্বত্ব সংরক্ষিত।</span><span>TRADITION, REIMAGINED.</span></div></div></footer>
    <a className={`av-floating-chat ${productId && product ? "av-floating-chat-detail" : ""}`} href={whatsappLink()} target="_blank" rel="noopener noreferrer" aria-label="AVEN-এর সঙ্গে WhatsApp-এ কথা বলুন"><Icon name="chat" size={24} /><span>কথা বলুন</span></a>
    <div className={`av-toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">{toast && <><Icon name="check" size={18} />{toast}</>}</div>
    {overlay?.type === "menu" && <Dialog title="AVEN / মেনু" onClose={close}><nav className="av-menu-links">{menu.map(([label, href]) => <Link key={href} href={href} onClick={close}>{label}<Icon name="arrow" /></Link>)}<button type="button" className="av-btn av-btn-dark" onClick={showBag}>Shopping Bag ({bag.count}) <Icon name="bag" /></button><a href={whatsappLink()} target="_blank" rel="noopener noreferrer">WhatsApp<Icon name="chat" /></a><a href={`tel:${CONTACT.international}`}>{CONTACT.display}<Icon name="phone" /></a></nav></Dialog>}
    {overlay?.type === "search" && <Dialog title="আপনার পছন্দ খুঁজুন" onClose={close}><form className="av-search-modal" onSubmit={(event) => {
      event.preventDefault(); const q = String(new FormData(event.currentTarget).get("q") || ""); close();
      if (productId) window.location.assign(`/?q=${encodeURIComponent(q)}#shop`);
      else { setQuery(q); setCategory(""); setSavedOnly(false); document.getElementById("shop")?.scrollIntoView(); searchRef.current?.focus({ preventScroll: true }); }
    }}><label>পণ্যের নাম অথবা রঙ<input name="q" type="search" className="av-input" placeholder="যেমন: শাল, নীল…" defaultValue={query} autoFocus /></label><button className="av-btn av-btn-dark">পণ্য খুঁজুন <Icon name="search" /></button></form></Dialog>}
    {overlay?.type === "saved" && <Dialog title="আপনার পছন্দের তালিকা" onClose={close} wide><div className="av-saved-list">{saved.length ? saved.map((p) => <div className="av-saved-item" key={p.id}><Link href={`/product/${encodeURIComponent(p.id)}`} onClick={close} className="av-saved-image"><Photo src={p.mainImage} alt={p.name} sizes="80px" /></Link><div><Link href={`/product/${encodeURIComponent(p.id)}`} onClick={close}>{p.name}</Link><p>{p.price > 0 ? money(p.price) : "দাম নিশ্চিত করা প্রয়োজন"}</p>{canSelect(p) && <div className="av-purchase-actions"><button type="button" className="av-btn av-btn-dark" onClick={() => order(p)}>{isShowroom(p) ? "দাম জেনে অর্ডার" : "এখনই কিনুন"}</button><button type="button" className="av-btn av-add-to-bag" onClick={() => add(p)}>Add to Cart</button></div>}</div><button type="button" className="av-icon-btn" onClick={() => toggleSave(p.id)} aria-label={`${p.name} তালিকা থেকে সরান`}><Icon name="close" /></button></div>)
      : <Empty title="পছন্দের জিনিসগুলো এখানে রাখুন" text="পণ্যের হার্ট চিহ্নে চাপলে সেটি এই তালিকায় থাকবে।"><Link href="/#shop" className="av-btn av-btn-dark" onClick={close}>কালেকশন দেখুন</Link></Empty>}</div></Dialog>}
    {overlay?.type === "quick" && <Dialog title="এক নজরে" onClose={close} wide><ProductDetails key={overlay.product.id} product={overlay.product} compact onOrder={order} onAdd={add} saved={wishlist.ids.includes(overlay.product.id)} onSave={() => toggleSave(overlay.product.id)} onNotice={setToast} />{toast && <p className="av-small" role="status">{toast}</p>}</Dialog>}
    {overlay?.type === "image" && <Dialog title="পণ্যের ছবি" onClose={close} wide><div className="av-lightbox"><Photo key={overlay.src} src={overlay.src} alt={overlay.alt} eager sizes="90vw" /></div></Dialog>}
    <CommerceLayer products={products} loading={false} error="" reload={reload} />
  </div>;
}
