"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONTACT, money, whatsappLink, type Product } from "@/lib/atelier";
import { canSelect, isShowroom } from "@/lib/showroom";
import { decodeEdit } from "@/lib/style-studio";
import { Dialog, Empty, Icon, Photo, useWishlist } from "./Primitives";
import { ProductCard, ProductDetails } from "./CatalogProduct";
import { Hero, Story, HowTo, Contact } from "./Sections";
import { CommerceProvider, useCommerce } from "./CommerceState";
import CommerceLayer from "./ShoppingBag";
import { useCatalog } from "./useCatalog";
import { useShopCategories } from "./useShopCategories";
import StyleStudio, { StudioSection, type StudioRequest } from "./StyleStudio";
import CategoryShowcase from "./CategoryShowcase";
import { categoryKeyForProduct, categoryName, normalizeCategorySelection } from "@/lib/shop-categories";

type Overlay = { type: "menu" | "saved" | "search" } | { type: "quick"; product: Product } | { type: "image"; src: string; alt: string } | null;
export default function Storefront(props: { productId?: string }) {
  return <CommerceProvider><StorefrontView {...props} /></CommerceProvider>;
}
function StorefrontView({ productId }: { productId?: string }) {
  const { products, status: catalogStatus, reload } = useCatalog();
  const managedCategories = useShopCategories();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [savedOnly, setSavedOnly] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [studio, setStudio] = useState<StudioRequest | null>(null);
  const [toast, setToast] = useState("");
  const wishlist = useWishlist();
  const bag = useCommerce();
  const searchRef = useRef<HTMLInputElement>(null);
  const importedEdit = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || ""); setCategory(normalizeCategorySelection(params.get("collection") || "", products));
  }, [products]);
  useEffect(() => {
    if (catalogStatus !== "ready" || importedEdit.current) return;
    importedEdit.current = true;
    const value = new URLSearchParams(window.location.search).get("edit");
    if (!value) return;
    try { setStudio({ mode: "shared", items: decodeEdit(value) }); }
    catch { setToast("শেয়ার করা তালিকাটি সঠিক নয়। আপনার কার্ট পরিবর্তন করা হয়নি।"); }
  }, [catalogStatus]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 5000); return () => window.clearTimeout(timer); }, [toast]);
  const close = useCallback(() => setOverlay(null), []);
  const closeStudio = useCallback(() => setStudio(null), []);
  const openStudio = (request: StudioRequest) => { close(); bag.close(); setToast(""); setStudio(request); };
  const order = (p: Product, color = "", quantity = 1) => { close(); closeStudio(); setToast(""); bag.buy(p, color, quantity); };
  const add = (p: Product, color = "", quantity = 1) => { close(); closeStudio(); setToast(""); return bag.add(p, color, quantity); };
  const showBag = () => { close(); closeStudio(); setToast(""); bag.openBag(); };
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  };
  const browse = () => {
    setCategory(""); setQuery(""); setSavedOnly(false);
    if (productId) { window.location.assign("/#shop"); return; }
    window.history.replaceState(null, "", "/#shop");
    scrollTo("shop");
  };
  const browseCategories = () => {
    setQuery(""); setSavedOnly(false);
    if (productId) { window.location.assign("/#collections"); return; }
    window.history.replaceState(null, "", "/#collections");
    scrollTo("collections");
  };
  const selectCategory = (key: string) => {
    setCategory(key); setQuery(""); setSavedOnly(false);
    const params = new URLSearchParams(window.location.search);
    params.set("collection", key);
    const queryString = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}#shop`);
    window.setTimeout(() => scrollTo("shop"), 20);
  };
  const toggleSave = (id: string) => {
    const removing = wishlist.ids.includes(id); wishlist.toggle(id);
    setToast(removing ? "পছন্দের তালিকা থেকে সরানো হয়েছে" : "পছন্দের তালিকায় রাখা হয়েছে");
  };
  const copyNumber = async () => {
    try { await navigator.clipboard.writeText(CONTACT.display); setToast("নম্বর কপি হয়েছে"); }
    catch { setToast(`কপি করা যায়নি। নম্বরটি: ${CONTACT.display}`); }
  };
  const categories = [...new Set(products.map(categoryKeyForProduct))];
  const filtered = products.filter((p) => (!category || categoryKeyForProduct(p) === category) && (!savedOnly || wishlist.ids.includes(p.id)) &&
    `${p.name} ${p.category} ${p.description} ${p.colors.map((c) => c.name).join(" ")}`.toLocaleLowerCase("bn").includes(query.trim().toLocaleLowerCase("bn")))
    .sort((a, b) => sort === "price-asc" ? (a.price || Infinity) - (b.price || Infinity) : sort === "price-desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name, "bn") : b.createdAt - a.createdAt);
  const product = products.find((p) => p.id === productId);
  const saved = products.filter((p) => wishlist.ids.includes(p.id));
  const grid = (items: Product[]) => <div className="av-product-grid">{items.map((p) => <div className="av-editorial-product" key={`${p.id}-${p.price}`}><ProductCard product={p} saved={wishlist.ids.includes(p.id)} onSave={() => toggleSave(p.id)} onQuick={() => setOverlay({ type: "quick", product: p })} onOrder={(color) => order(p, color)} onAdd={(color) => add(p, color)} /><button type="button" className="av-card-compare-link" onClick={() => openStudio({ mode: "compare", firstId: p.id })}>অন্য রঙের সঙ্গে তুলনা <Icon name="plus" size={15} /></button></div>)}</div>;
  const menu = [["কালেকশন", "/#collections"], ["সব পণ্য", "/#shop"], ["আমাদের গল্প", "/#story"], ["অর্ডারের নিয়ম", "/#how-to-order"], ["যোগাযোগ", "/#contact"]];

  return <div className="av" data-catalog-state={catalogStatus}>
    <a className="av-skip" href="#main-content">মূল অংশে যান</a>
    <div className="av-announcement"><span>AVEN / THE EVERYDAY HEIRLOOM</span><a href={`tel:${CONTACT.international}`}>কথা বলুন <span>{CONTACT.display}</span><Icon name="arrow" size={14} /></a></div>
    <header className="av-header"><div className="av-header-inner av-container"><div className="av-nav-left">
      <button type="button" className="av-icon-btn av-mobile-menu" onClick={() => setOverlay({ type: "menu" })} aria-label="মেনু খুলুন"><Icon name="menu" /></button>
      <nav aria-label="প্রধান মেনু" className="av-desktop-nav"><Link href="/#collections">কালেকশন</Link><button type="button" className="av-header-studio" onClick={() => openStudio({ mode: "build" })}>নিজের সেট</button><Link href="/#story">আমাদের গল্প</Link></nav>
    </div><Link href="/" className="av-logo" aria-label="AVEN হোম">AVEN<span>THE ART OF EVERYDAY ELEGANCE</span></Link>
      <div className="av-header-actions"><Link href="/#contact" className="av-header-contact">যোগাযোগ</Link>
        <button type="button" className="av-icon-btn" onClick={() => setOverlay({ type: "search" })} aria-label="পণ্য খুঁজুন"><Icon name="search" /></button>
        <button type="button" className="av-icon-btn av-saved-button" onClick={() => setOverlay({ type: "saved" })} aria-label={`পছন্দের তালিকা, ${wishlist.ids.length}টি পণ্য`}><Icon name="heart" />{!!wishlist.ids.length && <span className="av-count">{wishlist.ids.length}</span>}</button>
        <button type="button" className="av-icon-btn av-bag-button" onClick={showBag} aria-label={`Shopping Bag খুলুন, ${bag.count}টি পণ্য`}><Icon name="bag" /><span key={bag.count} className="av-bag-count">{bag.count}</span></button>
      </div></div></header>
    <main id="main-content">{!productId ? <>
      <Hero onShop={browseCategories} />
      <CategoryShowcase products={products} selected={category} onSelect={selectCategory} managed={managedCategories} />
      <div className="av-ribbon"><span>ঐতিহ্যের ছোঁয়া</span><Icon name="spark" size={15} /><span>নিজস্বতার সৌন্দর্য</span><Icon name="spark" size={15} /><span>AVEN, EVERY DAY</span><Icon name="spark" size={15} /><span>আপনার পছন্দে, আপনার রঙে</span></div>
      <section className="av-shop av-section" id="shop"><div className="av-container">
        <div className="av-section-top"><div><p className="av-eyebrow">02 / SELECTED PRODUCTS</p><h2>{category ? <>{categoryName(category)} <em>কালেকশন।</em></> : <>সব প্রকাশিত <em>পণ্য।</em></>}</h2>{category && <div className="av-shop-category-title"><span>শুধু এই collection-এর products দেখানো হচ্ছে</span><button type="button" onClick={browse}>সব পণ্য দেখুন</button></div>}</div><p className="av-section-intro">পণ্য খুলে রঙ ও পরিমাণ বেছে নিন।<br />পছন্দ হলে ওয়েবসাইটেই অর্ডার করুন।</p></div>
        <div className="av-shop-extras"><button type="button" onClick={() => openStudio({ mode: "compare" })}><Icon name="plus" size={17} />দুই রঙ মিলিয়ে দেখুন</button><button type="button" onClick={() => openStudio({ mode: "build" })}><Icon name="spark" size={17} />নিজের সেট সাজান</button></div>
        {catalogStatus !== "ready" && <div className="av-catalog-notice" role="status"><Icon name="bag" size={20} /><p>{catalogStatus === "checking" ? "বর্তমান দাম ও স্টক যাচাই হচ্ছে।" : catalogStatus === "empty" ? "এই মুহূর্তে প্রকাশিত পণ্য পাওয়া যায়নি। বর্তমান কালেকশন জানতে আমাদের সঙ্গে যোগাযোগ করুন।" : "বর্তমান দাম যাচাই করা যাচ্ছে না। আবার যাচাই করুন অথবা আমাদের সঙ্গে যোগাযোগ করুন।"}</p>{catalogStatus !== "checking" && <button type="button" onClick={reload}>আবার যাচাই</button>}</div>}
        <div className="av-shop-tools"><label className="av-search-field"><Icon name="search" /><span className="av-sr-only">নাম বা রঙ দিয়ে পণ্য খুঁজুন</span><input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="নাম বা রঙ দিয়ে খুঁজুন…" type="search" /></label>
          <label className="av-sort"><span>সাজান</span><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="পণ্য সাজান"><option value="newest">নতুন আগে</option><option value="price-asc">কম দাম আগে</option><option value="price-desc">বেশি দাম আগে</option><option value="name">নাম অনুযায়ী</option></select></label>
        </div><div className="av-filter-row"><div className="av-filters" aria-label="কালেকশন ফিল্টার"><button type="button" aria-pressed={!category && !savedOnly} className={!category && !savedOnly ? "is-active" : ""} onClick={() => { setCategory(""); setSavedOnly(false); }}>সব পণ্য</button>
          {categories.map((name) => <button type="button" key={name} aria-pressed={category === name && !savedOnly} className={category === name && !savedOnly ? "is-active" : ""} onClick={() => selectCategory(name)}>{categoryName(name)}</button>)}
          <button type="button" aria-pressed={savedOnly} className={savedOnly ? "is-active" : ""} onClick={() => { setSavedOnly(!savedOnly); setCategory(""); }}><Icon name="heart" size={14} />পছন্দের তালিকা</button>
        </div><span className="av-results" aria-live="polite">{new Intl.NumberFormat("bn-BD").format(filtered.length)}টি পছন্দ</span></div>
        {filtered.length ? grid(filtered) : <Empty title="মিলে যায় এমন পছন্দ নেই" text="অন্য নাম বা রঙ দিয়ে খুঁজুন, অথবা সব ডিজাইন দেখুন।"><button type="button" className="av-btn av-btn-dark" onClick={browse}>সব ডিজাইন দেখুন</button></Empty>}
      </div></section><StudioSection products={products} onOpen={openStudio} /><Story onShop={browse} /><HowTo />
    </> : <div className="av-detail-page av-container"><Link className="av-back" href="/#shop">← কালেকশনে ফিরে যান</Link>
      {product ? <><ProductDetails key={`${product.id}-${product.price}`} product={product} onOrder={order} onAdd={add} saved={wishlist.ids.includes(product.id)} onSave={() => toggleSave(product.id)} onZoom={(src) => setOverlay({ type: "image", src, alt: product.name })} onNotice={setToast} /><button type="button" className="av-card-compare-link" onClick={() => openStudio({ mode: "compare", firstId: product.id })}>এই পণ্যটি অন্য রঙের সঙ্গে তুলনা করুন <Icon name="plus" size={17} /></button></>
        : catalogStatus === "checking" ? <div className="av-detail-loading" role="status"><span className="av-spinner" />পণ্য লোড হচ্ছে…</div>
        : <Empty title="পণ্যটি পাওয়া যাচ্ছে না" text="বর্তমান কালেকশন দেখুন অথবা আবার যাচাই করুন।"><button className="av-btn av-btn-dark" onClick={reload}>আবার যাচাই</button><Link href="/#shop" className="av-text-link">কালেকশনে ফিরুন</Link></Empty>}
      {product && products.length > 1 && <section className="av-related"><p className="av-eyebrow">YOU MAY ALSO LIKE</p><h2>আরও কিছু <em>পছন্দ।</em></h2>{grid(products.filter((p) => p.id !== product.id).slice(0, 3))}</section>}
    </div>}
    <Contact onCopy={() => void copyNumber()} /></main>
    <footer className="av-footer"><div className="av-container"><div className="av-footer-top"><Link href="/" className="av-footer-logo" aria-label="AVEN হোম">AVEN</Link><p>ঐতিহ্যে অনুপ্রাণিত।<br />আপনার নিজস্বতায় পরিপূর্ণ।</p><nav aria-label="ফুটার মেনু"><Link href="/#collections">কালেকশন</Link><Link href="/#style-studio">নিজের সেট</Link><Link href="/#contact">যোগাযোগ</Link></nav></div><div className="av-footer-bottom"><span>© 2026 AVEN. সর্বস্বত্ব সংরক্ষিত।</span><span>TRADITION, REIMAGINED.</span></div></div></footer>
    {!productId && <nav className="av-mobile-dock" aria-label="মোবাইল কেনাকাটা"><button type="button" onClick={browseCategories}><Icon name="search" />কালেকশন</button><button type="button" onClick={() => openStudio({ mode: "compare" })}><Icon name="plus" />রঙ তুলনা</button><button type="button" onClick={() => openStudio({ mode: "build" })}><Icon name="spark" />নিজের সেট</button><button type="button" onClick={showBag}><Icon name="bag" />ব্যাগ ({bag.count})</button></nav>}
    <a className={`av-floating-chat ${productId && product ? "av-floating-chat-detail" : ""}`} href={whatsappLink()} target="_blank" rel="noopener noreferrer" aria-label="AVEN-এর সঙ্গে WhatsApp-এ কথা বলুন"><Icon name="chat" size={24} /><span>কথা বলুন</span></a>
    <div className={`av-toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">{toast && <><Icon name="check" size={18} />{toast}</>}</div>
    {overlay?.type === "menu" && <Dialog title="AVEN / মেনু" onClose={close}><nav className="av-menu-links">{menu.map(([label, href]) => <Link key={href} href={href} onClick={close}>{label}<Icon name="arrow" /></Link>)}<button type="button" className="av-btn av-style-outline" onClick={() => openStudio({ mode: "build" })}>নিজের সেট বানান <Icon name="spark" /></button><button type="button" className="av-btn av-btn-dark" onClick={showBag}>Shopping Bag ({bag.count}) <Icon name="bag" /></button><a href={whatsappLink()} target="_blank" rel="noopener noreferrer">WhatsApp<Icon name="chat" /></a><a href={`tel:${CONTACT.international}`}>{CONTACT.display}<Icon name="phone" /></a></nav></Dialog>}
    {overlay?.type === "search" && <Dialog title="আপনার পছন্দ খুঁজুন" onClose={close}><form className="av-search-modal" onSubmit={(event) => {
      event.preventDefault(); const q = String(new FormData(event.currentTarget).get("q") || ""); close();
      if (productId) window.location.assign(`/?q=${encodeURIComponent(q)}#shop`);
      else { setQuery(q); setCategory(""); setSavedOnly(false); document.getElementById("shop")?.scrollIntoView(); searchRef.current?.focus({ preventScroll: true }); }
    }}><label>পণ্যের নাম অথবা রঙ<input name="q" type="search" className="av-input" placeholder="যেমন: শাল, নীল…" defaultValue={query} autoFocus /></label><button className="av-btn av-btn-dark">পণ্য খুঁজুন <Icon name="search" /></button></form></Dialog>}
    {overlay?.type === "saved" && <Dialog title="আপনার পছন্দের তালিকা" onClose={close} wide><div className="av-saved-list">{!!saved.length && <button type="button" className="av-btn av-style-outline av-saved-studio-action" onClick={() => openStudio({ mode: "build", items: saved.slice(0, 12).map((p) => ({ productId: p.id, color: p.colors[0]?.name || "", quantity: 1 })) })}>পছন্দেরগুলো দিয়ে সেট সাজান ও শেয়ার করুন <Icon name="share" size={18} /></button>}{saved.length ? saved.map((p) => <div className="av-saved-item" key={p.id}><Link href={`/product/${encodeURIComponent(p.id)}`} onClick={close} className="av-saved-image"><Photo src={p.mainImage} alt={p.name} sizes="80px" /></Link><div><Link href={`/product/${encodeURIComponent(p.id)}`} onClick={close}>{p.name}</Link><p>{p.price > 0 ? money(p.price) : "দাম নিশ্চিত করা প্রয়োজন"}</p>{canSelect(p) && <div className="av-purchase-actions"><button type="button" className="av-btn av-btn-dark" onClick={() => order(p)}>{isShowroom(p) ? "দাম জেনে অর্ডার" : "এখনই কিনুন"}</button><button type="button" className="av-btn av-add-to-bag" onClick={() => add(p)}>Add to Cart</button></div>}</div><button type="button" className="av-icon-btn" onClick={() => toggleSave(p.id)} aria-label={`${p.name} তালিকা থেকে সরান`}><Icon name="close" /></button></div>)
      : <Empty title="পছন্দের জিনিসগুলো এখানে রাখুন" text="পণ্যের হার্ট চিহ্নে চাপলে সেটি এই তালিকায় থাকবে।"><Link href="/#shop" className="av-btn av-btn-dark" onClick={close}>কালেকশন দেখুন</Link></Empty>}</div></Dialog>}
    {overlay?.type === "quick" && <Dialog title="এক নজরে" onClose={close} wide><ProductDetails key={overlay.product.id} product={overlay.product} compact onOrder={order} onAdd={add} saved={wishlist.ids.includes(overlay.product.id)} onSave={() => toggleSave(overlay.product.id)} onNotice={setToast} />{toast && <p className="av-small" role="status">{toast}</p>}</Dialog>}
    {overlay?.type === "image" && <Dialog title="পণ্যের ছবি" onClose={close} wide><div className="av-lightbox"><Photo key={overlay.src} src={overlay.src} alt={overlay.alt} eager sizes="90vw" /></div></Dialog>}
    {studio && <StyleStudio products={products} ready={catalogStatus === "ready"} request={studio} onClose={closeStudio} />}
    <CommerceLayer products={products} loading={false} error="" reload={reload} />
  </div>;
}
