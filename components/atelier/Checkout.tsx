"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { money, productMessage, validateOrder, whatsappLink, type Product } from "@/lib/atelier";
import { Icon, Photo, Quantity } from "./Primitives";

export default function Checkout({ product, initialColor, initialQuantity, onClose }: {
  product: Product; initialColor: string; initialQuantity: number; onClose: () => void;
}) {
  const [color, setColor] = useState(initialColor || product.colors[0]?.name || "");
  const [quantity, setQuantity] = useState(initialQuantity);
  const [state, setState] = useState<"idle" | "sending" | "success">("idle");
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [savedSubtotal, setSavedSubtotal] = useState<number | null>(null);
  const idempotency = useRef({ payload: "", requestId: "" });
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "sending") return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const raw = { ...values, productId: product.id, color, quantity };
    const payload = JSON.stringify(raw);
    try {
      if (idempotency.current.payload !== payload) idempotency.current = { payload, requestId: crypto.randomUUID() };
      const input = validateOrder({ ...raw, requestId: idempotency.current.requestId });
      setError(""); setState("sending");
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 25000);
      let response: Response;
      try {
        response = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input), signal: controller.signal });
      } finally { window.clearTimeout(timer); }
      const data = await response.json();
      if (!response.ok || data.success !== true || typeof data.orderId !== "string") throw new Error(data.message || "অর্ডার জমা হয়নি। আবার চেষ্টা করুন।");
      if (mounted.current) {
        setOrderId(data.orderId);
        setSavedSubtotal(typeof data.subtotal === "number" ? data.subtotal : null);
        setState("success");
      }
    } catch (problem) {
      if (!mounted.current) return;
      setState("idle");
      setError(problem instanceof DOMException && problem.name === "AbortError"
        ? "উত্তর পেতে দেরি হচ্ছে। একই তথ্য দিয়ে আবার পাঠান—একই অনুরোধ দুবার সংরক্ষণ করা হবে না।"
        : problem instanceof Error ? problem.message : "সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন বা WhatsApp ব্যবহার করুন।");
    }
  };
  if (state === "success") return <div className="av-order-success">
    <span className="av-success-icon"><Icon name="check" size={32} /></span><p className="av-eyebrow">THANK YOU / AVEN</p>
    <h3>আপনার অনুরোধ<br /><em>পৌঁছে গেছে।</em></h3>
    <p>স্টক, ডেলিভারি চার্জ এবং পেমেন্টের নিয়ম নিশ্চিত করতে AVEN আপনার সঙ্গে যোগাযোগ করবে।</p>
    <div className="av-order-reference"><small>অর্ডার রেফারেন্স</small><code>{orderId}</code>{savedSubtotal !== null && <p>পণ্যের মোট: {money(savedSubtotal)}</p>}</div>
    <a className="av-btn av-btn-dark" href={whatsappLink(`আমার AVEN অর্ডার সম্পর্কে জানতে চাই।\nঅর্ডার রেফারেন্স: ${orderId}\nপণ্য: ${product.name}`)} target="_blank" rel="noopener noreferrer">অর্ডার নিয়ে কথা বলুন <Icon name="chat" /></a>
    <button type="button" className="av-text-link" onClick={onClose}>কেনাকাটায় ফিরে যান →</button>
  </div>;
  return <form className="av-checkout" onSubmit={(event) => void submit(event)}>
    <div className="av-checkout-product"><div><Photo key={color} src={product.colors.find((c) => c.name === color)?.image || product.mainImage} alt={product.name} sizes="80px" /></div><section><small>{product.category}</small><h3>{product.name}</h3><strong>{money(product.price)}</strong></section></div>
    <fieldset disabled={state === "sending"}><legend className="av-sr-only">যোগাযোগ ও ডেলিভারির তথ্য</legend>
      <div className="av-form-grid"><label>আপনার নাম<input className="av-input" name="name" minLength={2} maxLength={100} autoComplete="name" placeholder="সম্পূর্ণ নাম" required /></label>
        <label>মোবাইল নম্বর<input className="av-input" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" maxLength={25} required /></label></div>
      <label>জেলা<input className="av-input" name="district" minLength={2} maxLength={80} autoComplete="address-level1" placeholder="জেলার নাম" required /></label>
      <label>সম্পূর্ণ ঠিকানা<textarea className="av-input" name="address" minLength={10} maxLength={500} autoComplete="street-address" placeholder="বাসা, রোড, এলাকা, থানা…" rows={3} required /></label>
      <div className="av-form-grid"><label>রঙ{product.colors.length ? <select className="av-input" value={color} onChange={(event) => setColor(event.target.value)}>{product.colors.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select> : <input className="av-input" value={color} onChange={(event) => setColor(event.target.value)} placeholder="প্রযোজ্য হলে" maxLength={100} />}</label>
        <div className="av-quantity-label"><span>পরিমাণ</span><Quantity value={quantity} onChange={setQuantity} /></div></div>
    </fieldset>
    <div className="av-checkout-total"><span>পণ্যের মোট মূল্য</span><strong>{money(product.price * quantity)}</strong></div>
    <p className="av-checkout-note">ডেলিভারি চার্জ এতে অন্তর্ভুক্ত নয়। চার্জ ও পেমেন্টের নিয়ম নিশ্চিত করার পর অর্ডার চূড়ান্ত হবে।</p>
    <label className="av-consent"><input type="checkbox" required disabled={state === "sending"} />অর্ডারের জন্য AVEN আমার দেওয়া নম্বরে যোগাযোগ করতে পারবে।</label>
    {error && <p className="av-form-error" role="alert">{error}</p>}
    <button className="av-btn av-btn-dark" disabled={state === "sending"} type="submit">{state === "sending" ? <><span className="av-spinner" />পাঠানো হচ্ছে…</> : <>অর্ডার অনুরোধ পাঠান <Icon name="arrow" /></>}</button>
    <a href={whatsappLink(productMessage(product, color, quantity))} className="av-checkout-whatsapp" target="_blank" rel="noopener noreferrer"><Icon name="chat" size={18} />সরাসরি WhatsApp-এ অর্ডার করুন</a>
    <p className="av-private-note">এই ফর্মে পেমেন্ট, পাসওয়ার্ড বা OTP দেবেন না।</p>
  </form>;
}
