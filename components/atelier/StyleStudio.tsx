"use client";

import Link from "next/link";
import { useState } from "react";
import { money, type Product } from "@/lib/atelier";
import { addLine, changeLine, lineKey, selection, unitCount, type BagLine } from "@/lib/commerce";
import { editTotals, editUrl, selectionIssue } from "@/lib/style-studio";
import { Dialog, Icon, Photo, Quantity } from "./Primitives";
import { useCommerce } from "./CommerceState";

export type StudioRequest = { mode: "compare" | "build" | "shared"; items?: BagLine[]; firstId?: string };
type OpenStudio = (request: StudioRequest) => void;

export function StudioSection({ products, onOpen }: { products: Product[]; onOpen: OpenStudio }) {
  return <section id="style-studio" className="av-style-section"><div className="av-container av-style-intro">
    <div className="av-style-copy"><p className="av-eyebrow">02 / THE PERSONAL EDIT</p><h2>আপনার রঙ।<br /><em>আপনার কম্বিনেশন।</em></h2>
      <p>দুই রঙ পাশাপাশি দেখুন। পছন্দের শালগুলো দিয়ে নিজের সেট সাজান। তারপর এখানেই অর্ডার করুন।</p>
      <div className="av-style-entry"><button type="button" className="av-btn av-btn-dark" onClick={() => onOpen({ mode: "compare" })}>রঙ মিলিয়ে দেখুন <Icon name="plus" size={17} /></button><button type="button" className="av-btn av-style-outline" onClick={() => onOpen({ mode: "build" })}>নিজের সেট বানান <Icon name="arrow" size={17} /></button></div>
      <small>কোনো অ্যাকাউন্ট নয়। আপনার পছন্দেই শুরু।</small>
    </div>
    <div className="av-style-art"><span className="av-style-watermark" aria-hidden="true">Your edit.</span><div className="av-style-lookbook">
      {products.slice(0, 3).map((product, index) => <Link key={product.id} href={`/product/${encodeURIComponent(product.id)}`} className="av-style-look" aria-label={`${product.name} দেখুন`}><div><Photo src={product.mainImage} alt={product.name} sizes="(max-width: 600px) 30vw, 200px" /></div><span>0{index + 1} / {product.colors[0]?.name || product.category}</span></Link>)}
      {!products.length && <p className="av-style-wait">কালেকশন যাচাই হচ্ছে। কিছুক্ষণের মধ্যে আবার দেখুন।</p>}
    </div><p className="av-style-art-caption"><Icon name="spark" size={16} /> DIFFERENT COLOURS. ENTIRELY YOU.</p></div>
  </div></section>;
}

export default function StyleStudio({ products, ready, request, onClose }: {
  products: Product[]; ready: boolean; request: StudioRequest; onClose: () => void;
}) {
  const bag = useCommerce();
  const [tab, setTab] = useState<"compare" | "build">(request.mode === "compare" ? "compare" : "build");
  const [items, setItems] = useState<BagLine[]>(request.items || []);
  const first = products.find((p) => p.id === request.firstId) || products[0];
  const second = products.find((p) => p.id !== first?.id);
  const [pair, setPair] = useState([{ productId: first?.id || "", color: first?.colors[0]?.name || "" }, { productId: second?.id || "", color: second?.colors[0]?.name || "" }]);
  const [message, setMessage] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const totals = editTotals(items, products);
  const purchasable = (p: Product) => ready && p.available && p.price > 0;
  const change = (next: BagLine[]) => { setItems(next); setSharedUrl(""); setMessage(""); };
  const add = (product: Product, color = product.colors[0]?.name || "") => {
    try { change(addLine(items, selection(product, color))); setMessage("আপনার সেটে যোগ হয়েছে।"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "যোগ করা যায়নি।"); }
  };
  const update = (key: string, patch: Partial<Pick<BagLine, "quantity" | "color">>) => {
    try { change(changeLine(items, key, patch)); } catch (error) { setMessage(error instanceof Error ? error.message : "পরিমাণ যাচাই করুন।"); }
  };
  const share = async () => {
    try {
      const url = editUrl(items, window.location.origin); setSharedUrl(url);
      if (navigator.share) { await navigator.share({ title: "আমার AVEN পছন্দ", text: "আমার পছন্দের রঙগুলো দেখুন।", url }); setMessage("শেয়ার অপশন খোলা হয়েছে।"); }
      else { await navigator.clipboard.writeText(url); setMessage("সেটের লিংক কপি হয়েছে।"); }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("নিচের লিংকটি নির্বাচন করে কপি করুন।");
    }
  };
  const buy = () => { if (ready && bag.buySet(items, products)) onClose(); };
  const addAll = () => { if (ready && bag.addSet(items, products)) onClose(); };
  const choosePair = (index: number, id: string) => {
    const p = products.find((item) => item.id === id);
    setPair((current) => current.map((value, i) => i === index ? { productId: id, color: p?.colors[0]?.name || "" } : value));
  };

  return <Dialog title={request.mode === "shared" ? "আপনার জন্য শেয়ার করা পছন্দ" : "AVEN / আপনার স্টাইল স্টুডিও"} onClose={onClose} wide>
    <div className="av-style-studio" data-studio-mode={tab}>
      <div className="av-studio-heading"><div><p className="av-eyebrow">CURATED BY YOU</p><h3>{tab === "compare" ? "পাশাপাশি, সহজ পছন্দ।" : "একটি সেট। পুরোটা আপনার।"}</h3></div><div className="av-studio-tabs" aria-label="স্টুডিওর ধরন"><button type="button" aria-pressed={tab === "compare"} onClick={() => setTab("compare")}>রঙ তুলনা</button><button type="button" aria-pressed={tab === "build"} onClick={() => setTab("build")}>আমার সেট <span>{unitCount(items)}</span></button></div></div>
      {!ready && <p className="av-studio-alert" role="status">বর্তমান কালেকশন যাচাই করা যাচ্ছে না। এখন অর্ডার বা কার্টে যোগ করা বন্ধ আছে।</p>}
      {request.mode === "shared" && <p className="av-studio-disclaimer">এটি শুধু পছন্দের তালিকা, অর্ডার নয়। কোনো পণ্য নিজে থেকে আপনার কার্টে যোগ হয়নি। দাম এখনকার কালেকশন অনুযায়ী দেখানো হচ্ছে।</p>}
      {tab === "compare" ? <>
        <div className="av-compare-grid">{pair.map((choice, index) => {
          const p = products.find((product) => product.id === choice.productId);
          return <section key={index} className="av-compare-panel"><label className="av-compare-select">{index === 0 ? "প্রথম পছন্দ" : "দ্বিতীয় পছন্দ"}<select aria-label={index === 0 ? "প্রথম পণ্য" : "দ্বিতীয় পণ্য"} value={choice.productId} onChange={(e) => choosePair(index, e.target.value)}><option value="">পণ্য বেছে নিন</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
            {p ? <><div className="av-compare-photo"><Photo key={`${p.id}-${choice.color}`} src={p.colors.find((c) => c.name === choice.color)?.image || p.mainImage} alt={p.name} sizes="(max-width: 600px) 42vw, 450px" /></div><h4>{p.name}</h4><p className="av-compare-price">{p.price > 0 ? money(p.price) : "দাম যাচাই প্রয়োজন"}{p.oldPrice > p.price && p.price > 0 && <del>{money(p.oldPrice)}</del>}</p>
              {p.colors.length > 1 && <label className="av-compare-select">রঙ<select aria-label={`${index + 1} নম্বর পণ্যের রঙ`} value={choice.color} onChange={(e) => setPair((current) => current.map((v, i) => i === index ? { ...v, color: e.target.value } : v))}>{p.colors.map((c) => <option key={c.name}>{c.name}</option>)}</select></label>}
              <button type="button" className="av-btn av-btn-dark" disabled={!purchasable(p)} onClick={() => { if (bag.buySet([selection(p, choice.color)], products)) onClose(); }}>এই রঙটি কিনুন <Icon name="arrow" size={16} /></button><button type="button" className="av-studio-text-button" disabled={!purchasable(p)} onClick={() => add(p, choice.color)}>সেটে যোগ করুন <Icon name="plus" size={16} /></button>
            </> : <div className="av-compare-placeholder"><Icon name="spark" size={28} /><p>এখানে দ্বিতীয় পছন্দটি দেখুন।</p></div>}
          </section>;
        })}</div><p className="av-studio-disclaimer">ছবি ও স্ক্রিনের কারণে আসল রঙে সামান্য পার্থক্য হতে পারে। সঠিক দাম ও পছন্দ যাচাই করে অর্ডার করুন।</p>
      </> : <div className="av-set-layout"><div className="av-set-options"><p className="av-eyebrow">01 / PICK YOUR COLOURS</p><div className="av-set-catalog">{products.map((p) => <div className="av-set-option" key={p.id} data-studio-product={p.id}><div className="av-set-option-photo"><Photo src={p.mainImage} alt={p.name} sizes="(max-width: 600px) 40vw, 200px" /></div><h4>{p.name}</h4><p>{p.price > 0 ? money(p.price) : "দাম যাচাই প্রয়োজন"}</p><button type="button" disabled={!purchasable(p)} onClick={() => add(p)} aria-label={`${p.name} সেটে যোগ করুন`}><Icon name="plus" size={17} />সেটে যোগ করুন</button></div>)}</div></div>
        <aside className="av-set-summary"><p className="av-eyebrow">02 / YOUR SELECTION</p><h4>আপনার বাছাই <span key={unitCount(items)}>{unitCount(items)}টি</span></h4>
          {!items.length && <div className="av-set-empty"><Icon name="bag" size={32} /><p>পছন্দের রঙ দিয়ে শুরু করুন।<br />একটি বা একাধিক শাল বেছে নিতে পারেন।</p></div>}
          <div className="av-set-lines">{items.map((line) => {
            const p = products.find((product) => product.id === line.productId);
            const issue = selectionIssue(line, products);
            return <div className="av-set-line" key={lineKey(line)}><div className="av-set-line-top"><div className="av-set-thumb">{p && <Photo key={`${p.id}-${line.color}`} src={p.colors.find((c) => c.name === line.color)?.image || p.mainImage} alt="" sizes="60px" />}</div><div><strong>{p?.name || "অনুপলব্ধ পণ্য"}</strong><small>{line.color || "ছবি অনুযায়ী"}</small></div><button type="button" className="av-icon-btn" aria-label={`${p?.name || "পণ্য"} সেট থেকে সরান`} onClick={() => change(items.filter((i) => lineKey(i) !== lineKey(line)))}><Icon name="close" size={17} /></button></div>
              {p && p.colors.length > 1 && <label className="av-compare-select">রঙ<select value={line.color} onChange={(e) => update(lineKey(line), { color: e.target.value })}>{!p.colors.some((c) => c.name === line.color) && <option value={line.color}>অনুপলব্ধ রঙ</option>}{p.colors.map((c) => <option key={c.name}>{c.name}</option>)}</select></label>}
              <div className="av-set-line-bottom"><Quantity value={line.quantity} onChange={(quantity) => update(lineKey(line), { quantity })} /><span>{p && !issue ? money(p.price * line.quantity) : "যাচাই প্রয়োজন"}</span></div>{issue && <p className="av-studio-alert">{issue}</p>}
            </div>;
          })}</div>
          <div className="av-set-total" aria-live="polite"><span>পণ্যের মোট</span><strong>{!items.length ? "—" : totals.complete ? money(totals.subtotal) : "যাচাই প্রয়োজন"}</strong></div>
          {totals.complete && totals.saving > 0 && <p className="av-set-savings">আগের দামের তুলনায় সাশ্রয় {money(totals.saving)}</p>}
          <p className="av-studio-disclaimer">বর্তমান পণ্যমূল্য যোগ করা হয়েছে; অতিরিক্ত সেট-ছাড় নেই। ডেলিভারি চার্জ আলাদাভাবে নিশ্চিত হবে।</p>
          <button type="button" className="av-btn av-btn-dark av-set-checkout" disabled={!totals.complete || !ready} onClick={buy}>এই সেট অর্ডার করুন <Icon name="arrow" size={18} /></button>
          <button type="button" className="av-btn av-style-outline av-set-add" disabled={!totals.complete || !ready} onClick={addAll}><Icon name="bag" size={18} />পুরো সেট ব্যাগে রাখুন</button>
          <button type="button" className="av-studio-text-button av-set-share" disabled={!items.length} onClick={() => void share()}><Icon name="share" size={17} />পছন্দের সেট শেয়ার করুন</button>
          {sharedUrl && <label className="av-studio-share-link">শুধু পণ্যের লিংক; ব্যক্তিগত তথ্য নেই<input readOnly value={sharedUrl} onFocus={(event) => event.currentTarget.select()} aria-label="শেয়ারযোগ্য সেটের লিংক" /></label>}
        </aside></div>}
      <p className="av-studio-status" role="status" aria-live="polite">{message || bag.notice}</p>
    </div>
  </Dialog>;
}
