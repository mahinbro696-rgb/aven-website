"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CONTACT, money, whatsappLink, type Product } from "@/lib/atelier";
import { lineKey, unitCount, validateCustomer, type BagLine, type CheckoutInput, type Customer, type Quote, type Receipt } from "@/lib/commerce";
import { Dialog, Icon, Photo } from "./Primitives";
import { BagLines, bagTotal, validBag } from "./BagItems";
import { useCommerce } from "./CommerceState";

class RequestError extends Error {
  constructor(message: string, public status = 0, public code = "") { super(message); }
}
async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 28000);
  try {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    let result: Record<string, unknown>;
    try { result = await response.json(); } catch { throw new RequestError("সার্ভারের উত্তর নিশ্চিত করা যায়নি।", response.status >= 500 ? response.status : 0); }
    if (!response.ok || result.success !== true) throw new RequestError(String(result.message || "অনুরোধটি সম্পন্ন হয়নি।"), response.status, String(result.code || ""));
    return result;
  } finally { window.clearTimeout(timer); }
}
function isQuote(data: Record<string, unknown>): boolean {
  return Array.isArray(data.items) && data.items.length > 0 && data.items.every((item) => item && typeof item.name === "string" &&
    typeof item.quantity === "number" && Number.isFinite(item.lineTotal) && Number.isFinite(item.unitPrice)) &&
    typeof data.subtotal === "number" && Number.isFinite(data.subtotal) && typeof data.quoteHash === "string";
}
const freshCustomer: Customer = { name: "", phone: "", district: "", address: "", note: "" };

export default function CheckoutExperience({ products, initialItems, source, onReload }: {
  products: Product[]; initialItems: BagLine[]; source: "bag" | "direct"; onReload: () => void;
}) {
  const bag = useCommerce();
  const [items, setItems] = useState(initialItems);
  const [customer, setCustomer] = useState<Customer>(freshCustomer);
  const [step, setStep] = useState<0 | 1 | 2>(1);
  const [busy, setBusy] = useState<"quote" | "order" | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [copied, setCopied] = useState(false);
  const [helper, setHelper] = useState("");
  const attempt = useRef<CheckoutInput | null>(null);
  const inFlight = useRef(false);
  const active = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.closest("dialog")?.scrollTo({ top: 0, behavior: "instant" }); }, [step, receipt]);
  const estimated = bagTotal(items, products);
  const total = receipt?.subtotal ?? quote?.subtotal ?? estimated;
  const changeItems = (next: BagLine[]) => {
    setItems(next); setQuote(null); attempt.current = null; setError("");
    if (source === "bag") bag.replace(next);
  };
  const close = () => {
    if (inFlight.current) { setHelper("অনুরোধের ফল আসা পর্যন্ত এই ফর্মটি খোলা রাখুন।"); return; }
    if (uncertain && !window.confirm("অর্ডারটি জমা হয়ে থাকতে পারে। বন্ধ করার আগে রেফারেন্সটি লিখে রাখুন। ফল নিশ্চিত না করে নতুন অর্ডার দেবেন না। তবুও বন্ধ করবেন?")) return;
    bag.close();
  };
  const go = (value: 0 | 1 | 2) => {
    if (busy || uncertain) return;
    setStep(value); setError(""); setHelper("");
  };
  const quoteOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    try {
      const validated = validateCustomer(customer);
      if (!validBag(items, products)) { setStep(0); throw new Error("পণ্য ও রঙ আবার যাচাই করুন।"); }
      setCustomer(validated); setError(""); setHelper(""); setBusy("quote"); inFlight.current = true;
      const data = await post("/api/checkout/quote", { items });
      if (!isQuote(data)) throw new Error("পণ্যের হিসাব পাওয়া যায়নি। আবার চেষ্টা করুন।");
      if (active.current) { setQuote(data as unknown as Quote); setStep(2); attempt.current = null; }
    } catch (problem) {
      if (!active.current) return;
      if (problem instanceof RequestError && problem.code === "CATALOG_CHANGED") { onReload(); setStep(0); }
      setError(problem instanceof Error ? problem.message : "সংযোগ যাচাই করে আবার চেষ্টা করুন।");
    } finally { inFlight.current = false; if (active.current) setBusy(null); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || !quote || !consent) return;
    inFlight.current = true; setBusy("order"); setError(""); setHelper("");
    try {
      const payload = attempt.current || { ...validateCustomer(customer), items, quoteHash: quote.quoteHash, consent: true as const, requestId: crypto.randomUUID() };
      attempt.current = payload;
      const data = await post("/api/checkout", payload);
      if (!isQuote(data) || typeof data.orderId !== "string") throw new RequestError("অর্ডারের উত্তর নিশ্চিত করা যায়নি।");
      if (!active.current) return;
      setReceipt(data as unknown as Receipt); setUncertain(false);
      if (source === "bag") bag.purchased(items);
    } catch (problem) {
      if (!active.current) return;
      const knownRejection = problem instanceof RequestError && problem.status >= 400 && problem.status < 500;
      if (knownRejection) {
        setUncertain(false); attempt.current = null;
        if (problem.code === "QUOTE_CHANGED" || problem.code === "CATALOG_CHANGED") { setQuote(null); setStep(problem.code === "CATALOG_CHANGED" ? 0 : 1); onReload(); }
      } else setUncertain(true);
      setError(knownRejection ? problem.message : "সংযোগ বিচ্ছিন্ন হয়েছে বা উত্তর পেতে দেরি হচ্ছে। অর্ডার জমা হয়ে থাকতে পারে। নতুন অর্ডার না দিয়ে নিচের বাটনে একই অনুরোধের ফল যাচাই করুন।");
    } finally { inFlight.current = false; if (active.current) setBusy(null); }
  };
  const field = (key: keyof Customer) => ({
    value: customer[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCustomer((previous) => ({ ...previous, [key]: event.target.value })),
  });
  const reference = receipt?.orderId || (attempt.current ? `AVEN-${attempt.current.requestId}` : "");
  const copyReference = async () => {
    try { await navigator.clipboard.writeText(reference); setCopied(true); }
    catch { setHelper("কপি করা যায়নি। নিচের রেফারেন্সটি সিলেক্ট করে কপি করুন।"); }
  };
  const downloadReceipt = () => {
    if (!receipt) return;
    const text = ["AVEN / ORDER REQUEST", `Reference: ${receipt.orderId}`, "Status: Pending confirmation", "",
      ...receipt.items.map((item) => `${item.name} / ${item.color || "—"} / Qty ${item.quantity} / BDT ${item.lineTotal}`),
      "", `Product subtotal: BDT ${receipt.subtotal}`, "Delivery charge: to be confirmed", "Payment: NOT COLLECTED",
      `Contact / WhatsApp: ${CONTACT.display}`].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${receipt.orderId}.txt`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const headingText = receipt ? "আপনার পছন্দ, এখন আরও কাছে।" : step === 0 ? "সব পছন্দ, একসঙ্গে।" : step === 1 ? "কোথায় পৌঁছে দেব?" : "একবার দেখে নিন।";
  return <Dialog title={receipt ? "AVEN / অর্ডারের রসিদ" : "AVEN / Checkout"} onClose={close} wide variant="checkout">
    <div className={`av-checkout-experience ${receipt ? "is-complete" : ""}`}>
      {receipt ? <section className="av-receipt"><div className="av-receipt-check"><Icon name="check" size={36} /></div><p className="av-eyebrow">A LOVELY CHOICE / THANK YOU</p><h3 ref={heading} tabIndex={-1}>{headingText}</h3>
        <p>আপনার অর্ডারের অনুরোধ সংরক্ষিত হয়েছে। AVEN স্টক, ডেলিভারি চার্জ এবং পেমেন্টের নিয়ম নিশ্চিত করতে যোগাযোগ করবে।</p>
        <div className="av-receipt-ticket"><span>PENDING CONFIRMATION</span><small>অর্ডার রেফারেন্স</small><code>{reference}</code>
          <button type="button" onClick={() => void copyReference()}><Icon name={copied ? "check" : "copy"} size={15} />{copied ? "কপি হয়েছে" : "রেফারেন্স কপি"}</button>
          <div>{receipt.items.map((item) => <p key={lineKey(item)}><span>{item.name} <small>{item.color} × {item.quantity}</small></span><strong>{money(item.lineTotal)}</strong></p>)}</div>
          <p className="av-receipt-total"><span>পণ্যের মোট</span><strong>{money(receipt.subtotal)}</strong></p><small>ডেলিভারি চার্জ পরে নিশ্চিত হবে · কোনো পেমেন্ট নেওয়া হয়নি</small>
        </div>
        <div className="av-receipt-actions"><a className="av-btn av-btn-dark" target="_blank" rel="noopener noreferrer" href={whatsappLink(`আমার AVEN অর্ডারের তথ্য জানতে চাই।\nরেফারেন্স: ${reference}`)}>অর্ডার নিয়ে কথা বলুন <Icon name="chat" /></a><button type="button" className="av-btn av-btn-outline" onClick={downloadReceipt}>সারাংশ রাখুন <Icon name="down" /></button></div>
        <button type="button" className="av-text-link" onClick={close}>কেনাকাটায় ফিরে যান →</button>{helper && <p role="status">{helper}</p>}
      </section> : <>
        <nav className="av-checkout-progress" aria-label="Checkout-এর ধাপ">{["পছন্দ", "ঠিকানা", "নিশ্চিত করুন"].map((label, index) => <button type="button" key={label} disabled={!!busy || uncertain || index > step} aria-current={step === index ? "step" : undefined} className={step === index ? "is-current" : step > index ? "is-done" : ""} onClick={() => go(index as 0 | 1 | 2)}><span>{step > index ? <Icon name="check" size={13} /> : `0${index + 1}`}</span>{label}</button>)}</nav>
        <div className="av-checkout-layout"><section className="av-checkout-main"><p className="av-eyebrow">{source === "direct" ? "BUY NOW / MADE SIMPLE" : "YOUR SHOPPING BAG / NEXT CHAPTER"}</p>
          <h3 ref={heading} tabIndex={-1}>{headingText}</h3><p className="av-checkout-subtitle">{step === 0 ? "রঙ ও পরিমাণ ঠিক করুন।" : step === 1 ? "Account নয়, শুধু প্রয়োজনীয় কয়েকটি তথ্য।" : "পণ্যের বর্তমান দাম যাচাই করা হয়েছে।"}</p>
          {step === 0 && <div className="av-selection-step"><BagLines items={items} products={products} onChange={changeItems} onRemove={(line) => changeItems(items.filter((item) => lineKey(item) !== lineKey(line)))} />
            {!items.length && <p>আপনার ব্যাগ খালি। পছন্দের পণ্য যোগ করুন।</p>}
            <button type="button" className="av-btn av-btn-dark" disabled={!validBag(items, products)} onClick={() => go(1)}>ঠিকানা দিন <Icon name="arrow" /></button>
            <button type="button" className="av-text-link" onClick={close}>কেনাকাটায় ফিরে যান</button></div>}
          {step === 1 && <form className="av-premium-form" onSubmit={(event) => void quoteOrder(event)}>
            <fieldset disabled={!!busy}><legend className="av-sr-only">যোগাযোগ ও ঠিকানা</legend>
              <div className="av-form-grid"><label>আপনার নাম <span>*</span><input className="av-input" {...field("name")} name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="সম্পূর্ণ নাম" /></label>
                <label>মোবাইল নম্বর <span>*</span><input className="av-input" {...field("phone")} name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={25} placeholder="01XXXXXXXXX" /></label></div>
              <label>জেলা <span>*</span><input className="av-input" {...field("district")} name="district" autoComplete="address-level1" required minLength={2} maxLength={80} placeholder="যেমন: ঢাকা" /></label>
              <label>সম্পূর্ণ ঠিকানা <span>*</span><textarea className="av-input" {...field("address")} name="address" autoComplete="street-address" required minLength={10} maxLength={500} rows={3} placeholder="বাসা / রোড / এলাকা / থানা" /></label>
              <details className="av-order-note"><summary>বিশেষ কিছু জানাতে চান? <span>ঐচ্ছিক</span><Icon name="plus" size={15} /></summary><label className="av-sr-only" htmlFor="aven-order-note">বিশেষ নির্দেশনা</label><textarea id="aven-order-note" className="av-input" {...field("note")} maxLength={300} rows={2} placeholder="আপনার অনুরোধ লিখুন; AVEN নিশ্চিত করবে।" /></details>
            </fieldset>
            <button className="av-btn av-btn-dark" type="submit" disabled={!!busy}>{busy === "quote" ? <><span className="av-spinner" />দাম যাচাই হচ্ছে…</> : <>অর্ডার দেখে নিন <Icon name="arrow" /></>}</button>
          </form>}
          {step === 2 && quote && <form onSubmit={(event) => void submit(event)} className="av-review-step">
            <div className="av-address-review"><div><span>আপনার ঠিকানা</span><button type="button" onClick={() => go(1)} disabled={!!busy || uncertain}>পরিবর্তন</button></div><strong>{customer.name}</strong><p>{customer.phone}</p><p>{customer.address}, {customer.district}</p>{customer.note && <p className="av-small">{customer.note}</p>}</div>
            <div className="av-payment-explanation"><Icon name="phone" size={20} /><div><strong>AVEN-এর সঙ্গে নিশ্চিত করে পেমেন্ট</strong><p>এখানে টাকা কাটা হবে না। ডেলিভারি চার্জ ও পেমেন্টের নিয়ম জানিয়ে আপনার সম্মতির পর অর্ডার চূড়ান্ত হবে।</p></div></div>
            <label className="av-consent"><input type="checkbox" required checked={consent} disabled={!!busy || uncertain} onChange={(event) => setConsent(event.target.checked)} /><span>এই অর্ডার সম্পর্কে AVEN আমার দেওয়া নম্বরে যোগাযোগ করতে পারবে।</span></label>
            <button type="submit" className="av-btn av-btn-dark av-place-order" disabled={!!busy || !consent}>{busy === "order" ? <><span className="av-spinner" />অর্ডার জমা হচ্ছে…</> : uncertain ? <>একই অনুরোধ আবার যাচাই করুন <Icon name="arrow" /></> : <>অর্ডার জমা দিন <Icon name="arrow" /></>}</button>
            {uncertain && <div className="av-pending-reference"><small>এই রেফারেন্সটি রাখুন</small><code>{reference}</code><a target="_blank" rel="noopener noreferrer" href={whatsappLink(`আমার অর্ডারের ফল নিশ্চিত করতে চাই। নতুন অর্ডার নয়।\nরেফারেন্স: ${reference}`)}>WhatsApp-এ ফল নিশ্চিত করুন</a></div>}
          </form>}
          {bag.notice && <p className="av-bag-inline-notice" role="status">{bag.notice}</p>}
          {error && <p className="av-checkout-error" role="alert">{error}</p>}{helper && <p className="av-checkout-error" role="status">{helper}</p>}
          <div className="av-checkout-support"><Icon name="chat" size={17} /><span>সাহায্য দরকার?</span><a target="_blank" rel="noopener noreferrer" href={whatsappLink("AVEN website-এর checkout-এ সাহায্য চাই।")}>{CONTACT.display}</a></div>
        </section><aside className="av-checkout-summary"><div className="av-summary-head"><span>YOUR SELECTION</span><span>{unitCount(items)}টি</span></div>
          <div className="av-summary-items">{(quote?.items || items.map((line) => { const p = products.find((p) => p.id === line.productId); return { ...line, name: p?.name || "পণ্য পাওয়া যায়নি", image: p?.colors.find((c) => c.name === line.color)?.image || p?.mainImage || "/products/pink.png", lineTotal: (p?.price || 0) * line.quantity }; })).map((line) => <div key={lineKey(line)} className="av-summary-item"><div><Photo key={line.image} src={line.image} alt={line.name} sizes="72px" /><span>{line.quantity}</span></div><section><strong>{line.name}</strong><small>{line.color || "AVEN Collection"}</small><b>{money(line.lineTotal)}</b></section></div>)}</div>
          <div className="av-summary-totals"><p><span>পণ্যের মোট</span><strong key={total}>{money(total)}</strong></p><p><span>ডেলিভারি চার্জ</span><span>পরে নিশ্চিত হবে</span></p><p><span>এখন পেমেন্ট</span><strong>নেওয়া হচ্ছে না</strong></p></div>
          <p className="av-summary-footnote">{quote ? "বর্তমান পণ্যের দাম যাচাই করা হয়েছে।" : "চূড়ান্ত ধাপে বর্তমান পণ্যের দাম আবার যাচাই হবে।"} ডেলিভারি চার্জ যোগ না হওয়া পর্যন্ত এটি চূড়ান্ত payable total নয়।</p>
          <div className="av-summary-brand">AVEN<span>CHOSEN BY YOU. PREPARED WITH CARE.</span></div>
        </aside></div>
      </>}
    </div>
  </Dialog>;
}
