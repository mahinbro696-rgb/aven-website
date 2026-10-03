"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { money, productMessage, whatsappLink, discountPercent, type Product } from "@/lib/atelier";
import { canSelect, isShowroom } from "@/lib/showroom";
import { Icon, Photo, Tilt, Quantity } from "./Primitives";

function colorAvailable(color: Product["colors"][number]) {
  return color.available !== false && color.stock !== 0;
}

export function ProductCard({ product, saved, onSave, onQuick, onOrder, onAdd }: {
  product: Product; saved: boolean; onSave: () => void; onQuick: () => void;
  onOrder: (color: string) => void; onAdd: (color: string) => boolean;
}) {
  const [color, setColor] = useState(product.colors.find(colorAvailable)?.name || product.colors[0]?.name || "");
  const [added, setAdded] = useState(false);
  useEffect(() => { if (!added) return; const timer = window.setTimeout(() => setAdded(false), 2000); return () => window.clearTimeout(timer); }, [added]);
  const image = product.colors.find((item) => item.name === color)?.image || product.mainImage;
  const discount = discountPercent(product);
  const inquiry = isShowroom(product);
  const href = `/product/${encodeURIComponent(product.id)}`;
  return <article className="av-product-card" data-product-id={product.id}>
    <Tilt className="av-card-visual" strength={3}>
      <Link className="av-card-image" href={href} aria-label={`${product.name} বিস্তারিত দেখুন`}><Photo key={image} src={image} alt={`${product.name}${color ? ` — ${color}` : ""}`} sizes="(max-width: 600px) 95vw, (max-width: 1050px) 46vw, 30vw" /></Link>
      <div className="av-card-badges"><span>{inquiry ? "দাম ও স্টক নিশ্চিত করুন" : !product.available ? "স্টক জানতে যোগাযোগ করুন" : discount > 0 ? `${discount}% ছাড়` : product.category}</span></div>
      <button type="button" className={`av-card-heart ${saved ? "is-saved" : ""}`} onClick={onSave} aria-pressed={saved} aria-label={`${product.name} ${saved ? "তালিকা থেকে সরান" : "পছন্দের তালিকায় রাখুন"}`}><Icon name="heart" size={18} /></button>
      <button type="button" className="av-quick-view" onClick={onQuick}>এক নজরে দেখুন <Icon name="plus" size={17} /></button>
    </Tilt>
    <div className="av-card-info"><div className="av-card-category">{product.category}</div><h3><Link href={href}>{product.name}</Link></h3>
      <div className="av-card-colors">{product.colors.length ? product.colors.map((item) => <button key={item.name} type="button" className={`${color === item.name ? "is-active" : ""} ${!colorAvailable(item) ? "is-unavailable" : ""}`} disabled={!colorAvailable(item)} onClick={() => setColor(item.name)} title={!colorAvailable(item) ? `${item.name} — স্টক শেষ` : item.name} aria-label={`${item.name} রঙ ${!colorAvailable(item) ? "স্টক শেষ" : "দেখুন"}`} aria-pressed={color === item.name}><Photo src={item.image} alt="" sizes="44px" /></button>) : <span className="av-small">বিস্তারিত দেখে পছন্দ করুন</span>}<span className="av-color-name">{color}</span></div>
      <div className="av-card-bottom"><div><strong>{product.price > 0 ? money(product.price) : "দাম জেনে নিন"}</strong>{discount > 0 && <del>{money(product.oldPrice)}</del>}</div><Link className="av-card-details-link" href={href}>বিস্তারিত <Icon name="arrow" size={15} /></Link></div>
      {canSelect(product) && (!product.colors.length || colorAvailable(product.colors.find((item) => item.name === color) || product.colors[0])) ? <div className="av-purchase-actions">
        <button type="button" onClick={() => onOrder(color)} className="av-btn av-btn-dark" aria-label={`${product.name} ${inquiry ? "দাম জেনে অর্ডার" : "এখনই কিনুন"}`}>{inquiry ? "দাম জেনে অর্ডার" : "এখনই কিনুন"}<Icon name="arrow" size={17} /></button>
        <button type="button" onClick={() => setAdded(onAdd(color))} className={`av-btn av-add-to-bag ${added ? "is-added" : ""}`} aria-label={`${product.name} কার্টে যোগ করুন`}><Icon name={added ? "check" : "bag"} size={17} />{added ? "যোগ হয়েছে" : "Add to Cart"}</button>
      </div> : <a href={whatsappLink(productMessage(product, color))} className="av-btn av-btn-outline av-stock-inquiry" target="_blank" rel="noopener noreferrer">স্টক ও দাম জেনে নিন <Icon name="chat" size={17} /></a>}
      {inquiry && <p className="av-inquiry-caption">দাম প্রকাশের আগে পেমেন্ট নেওয়া হচ্ছে না।</p>}
    </div>
  </article>;
}
export function ProductDetails({ product, saved, onSave, onOrder, onAdd, onZoom, onNotice, compact = false }: {
  product: Product; saved: boolean; onSave: () => void;
  onOrder: (product: Product, color: string, quantity: number) => void;
  onAdd: (product: Product, color: string, quantity: number) => boolean;
  onZoom?: (src: string) => void; onNotice: (message: string) => void; compact?: boolean;
}) {
  const [color, setColor] = useState(product.colors.find(colorAvailable)?.name || product.colors[0]?.name || "");
  const [quantity, setQuantity] = useState(1);
  const [main, setMain] = useState(true);
  const [added, setAdded] = useState(false);
  useEffect(() => { if (!added) return; const timer = window.setTimeout(() => setAdded(false), 2000); return () => window.clearTimeout(timer); }, [added]);
  const image = main ? product.mainImage : product.colors.find((item) => item.name === color)?.image || product.mainImage;
  const selectedVariant = product.colors.find((item) => item.name === color);
  const selectedAvailable = !product.colors.length || (!!selectedVariant && colorAvailable(selectedVariant));
  const selectable = canSelect(product) && selectedAvailable;
  const maxQuantity = selectedVariant?.stock && selectedVariant.stock > 0 ? Math.min(20, selectedVariant.stock) : 20;
  const inquiry = isShowroom(product);
  useEffect(() => { if (quantity > maxQuantity) setQuantity(maxQuantity); }, [maxQuantity, quantity]);
  const add = () => setAdded(onAdd(product, color, quantity));
  const share = async () => {
    const url = new URL(`/product/${encodeURIComponent(product.id)}`, window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else { await navigator.clipboard.writeText(url); onNotice("পণ্যের লিংক কপি হয়েছে"); }
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) onNotice("শেয়ার করা যায়নি। ব্রাউজারের ঠিকানা থেকে লিংক কপি করুন।"); }
  };
  return <div className={`av-product-detail ${compact ? "is-compact" : ""}`}>
    <div className="av-detail-gallery">
      <button type="button" className="av-detail-main-image" onClick={() => onZoom?.(image)} disabled={!onZoom} aria-label="পণ্যের বড় ছবি দেখুন"><Photo key={image} src={image} alt={product.name} eager />{onZoom && <span className="av-zoom-hint"><Icon name="plus" />বড় করে দেখুন</span>}</button>
      <div className="av-gallery-thumbs"><button type="button" className={main ? "is-active" : ""} onClick={() => setMain(true)} aria-label="মূল ছবি দেখুন" aria-pressed={main}><Photo src={product.mainImage} alt="" sizes="70px" /></button>
        {product.colors.map((item) => <button key={item.name} type="button" disabled={!colorAvailable(item)} onClick={() => { setColor(item.name); setMain(false); }} className={`${!main && color === item.name ? "is-active" : ""} ${!colorAvailable(item) ? "is-unavailable" : ""}`} aria-label={`${item.name} ${!colorAvailable(item) ? "স্টক শেষ" : "ছবি দেখুন"}`} aria-pressed={!main && color === item.name}><Photo src={item.image} alt="" sizes="70px" /></button>)}
      </div>
    </div>
    <div className="av-detail-copy"><p className="av-eyebrow">{product.category}</p>
      {compact ? <h3 className="av-detail-title">{product.name}</h3> : <h1 className="av-detail-title">{product.name}</h1>}
      <div className="av-detail-price"><strong>{product.price > 0 ? money(product.price) : "দাম নিশ্চিত করুন"}</strong>{discountPercent(product) > 0 && <><del>{money(product.oldPrice)}</del><span>{discountPercent(product)}% ছাড়</span></>}</div>
      <p className="av-detail-description">{product.description || "এই পণ্যের কাপড়, মাপ ও অন্যান্য তথ্য জানতে AVEN-এর সঙ্গে সরাসরি কথা বলুন।"}</p>
      <div className="av-detail-option"><span>রঙ {color && <strong>/ {color}</strong>}</span><div className="av-color-options">{product.colors.length ? product.colors.map((item) => <button key={item.name} type="button" disabled={!colorAvailable(item)} className={`${color === item.name ? "is-active" : ""} ${!colorAvailable(item) ? "is-unavailable" : ""}`} aria-pressed={color === item.name} onClick={() => { setColor(item.name); setMain(false); }}>{item.name}{!colorAvailable(item) ? " · স্টক শেষ" : color === item.name ? <Icon name="check" size={13} /> : null}</button>) : <p className="av-small">রঙের তথ্য WhatsApp-এ নিশ্চিত করুন।</p>}</div></div>
      <div className="av-detail-quantity"><span>পরিমাণ</span><Quantity value={quantity} onChange={setQuantity} max={maxQuantity} /></div>
      {product.price > 0 && <div className="av-detail-total"><span>পণ্যের মোট</span><strong>{money(product.price * quantity)}</strong></div>}
      <p className="av-delivery-note">{inquiry ? "দাম ও স্টক এখনো প্রকাশিত নয়। পরের ধাপে নির্বাচিত পণ্যসহ WhatsApp-এ কথা বলতে পারবেন।" : "ডেলিভারি চার্জ ও পেমেন্টের নিয়ম অর্ডার নিশ্চিত করার আগে জানানো হবে।"}</p>
      <div className="av-detail-buttons">{selectable && <div className="av-purchase-actions"><button type="button" className="av-btn av-btn-gold" onClick={() => onOrder(product, color, quantity)}>{inquiry ? "দাম জেনে অর্ডার করুন" : "এখনই কিনুন"}<Icon name="arrow" /></button><button type="button" className={`av-btn av-add-to-bag ${added ? "is-added" : ""}`} onClick={add}><Icon name={added ? "check" : "bag"} />{added ? "যোগ হয়েছে" : "Add to Cart"}</button></div>}
        {!inquiry && <a className={`av-btn ${selectable ? "av-btn-outline" : "av-btn-gold"}`} href={whatsappLink(productMessage(product, color, quantity))} target="_blank" rel="noopener noreferrer"><Icon name="chat" />{selectable ? "WhatsApp-এ অর্ডার" : "স্টক ও দাম জানতে WhatsApp করুন"}</a>}
      </div>
      <div className="av-detail-actions"><button type="button" aria-pressed={saved} onClick={onSave}><Icon name="heart" size={17} />{saved ? "পছন্দের তালিকায় আছে" : "পছন্দের তালিকায় রাখুন"}</button><button type="button" onClick={() => void share()}><Icon name="share" size={17} />শেয়ার</button></div>
      <details className="av-detail-accordion"><summary>ডেলিভারি ও অর্ডার সম্পর্কে <Icon name="plus" size={16} /></summary><p>AVEN আপনার সঙ্গে স্টক, মূল্য, ডেলিভারি চার্জ ও পেমেন্টের নিয়ম নিশ্চিত করবে। আপনার সম্মতির আগে অর্ডার চূড়ান্ত নয়। এই ফর্মে কোনো পেমেন্ট নেওয়া হচ্ছে না।</p></details>
      <details className="av-detail-accordion"><summary>যত্ন ও পণ্যের তথ্য <Icon name="plus" size={16} /></summary><p>কাপড় অনুযায়ী যত্নের নিয়ম আলাদা হতে পারে। ধোয়া বা ইস্ত্রি করার আগে আমাদের কাছ থেকে নির্দেশনা জেনে নিন। স্ক্রিনভেদে রঙে সামান্য পার্থক্য দেখা যেতে পারে।</p></details>
      {compact && <Link className="av-text-link av-full-detail" href={`/product/${encodeURIComponent(product.id)}`}>সম্পূর্ণ পৃষ্ঠায় দেখুন →</Link>}
      {!compact && selectable && <div className="av-mobile-order"><div><small>{inquiry ? "মূল্য" : "পণ্যের মোট"}</small><strong>{inquiry ? "নিশ্চিত করুন" : money(product.price * quantity)}</strong></div><button type="button" className="av-btn av-add-to-bag" onClick={add} aria-label="কার্টে যোগ করুন"><Icon name="bag" /></button><button type="button" className="av-btn av-btn-gold" onClick={() => onOrder(product, color, quantity)}>{inquiry ? "অর্ডারের কথা বলুন" : "এখনই কিনুন"}<Icon name="arrow" /></button></div>}
    </div>
  </div>;
}
