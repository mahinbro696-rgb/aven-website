"use client";
import { useState } from "react";
import { CONTACT, SITE_URL, whatsappLink, type Product } from "@/lib/atelier";
import { inquiryMessage } from "@/lib/showroom";
import { lineKey, type BagLine } from "@/lib/commerce";
import { BagLines, validBag } from "./BagItems";
import { Dialog, Icon } from "./Primitives";
import { useCommerce } from "./CommerceState";

export default function InquiryCheckout({ products, initialItems, source }: { products: Product[]; initialItems: BagLine[]; source: "direct" | "bag" }) {
  const bag = useCommerce();
  const [items, setItems] = useState(initialItems);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const change = (next: BagLine[]) => { setItems(next); setCopied(false); if (source === "bag") bag.replace(next); };
  const origin = typeof window === "undefined" ? SITE_URL : window.location.origin;
  const message = inquiryMessage(items, products).split(SITE_URL).join(origin);
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); setError(""); }
    catch { setError("কপি করা যায়নি। নিচের বার্তাটি সিলেক্ট করে কপি করুন।"); }
  };
  return <Dialog title="AVEN / দাম ও অর্ডার নিশ্চিতকরণ" onClose={bag.close} wide variant="checkout">
    <section className="av-inquiry-checkout" data-order-mode="inquiry"><p className="av-eyebrow">YOUR CHOICE / LET US HELP</p><h3>পছন্দ ঠিক হয়েছে।<br /><em>এবার দামটি জেনে নিন।</em></h3>
      <p className="av-inquiry-lead">এই তালিকার এক বা একাধিক পণ্যের দাম এখনো প্রকাশিত হয়নি। ভুল হিসাব বা শূন্য টাকার অর্ডার না নিয়ে, আপনার পছন্দগুলো সরাসরি AVEN-কে জানানো হবে।</p>
      <BagLines items={items} products={products} onChange={change} onRemove={(line) => change(items.filter((item) => lineKey(item) !== lineKey(line)))} />
      {validBag(items, products) ? <>
        <div className="av-inquiry-terms"><Icon name="chat" /><p>WhatsApp খুললে প্রস্তুত বার্তাটি <strong>Send</strong> করবেন। AVEN দাম, স্টক ও ডেলিভারি চার্জ জানাবে; আপনার সম্মতির পর অর্ডার চূড়ান্ত হবে।</p></div>
        <a className="av-btn av-btn-dark av-inquiry-send" href={whatsappLink(message)} target="_blank" rel="noopener noreferrer">WhatsApp-এ দাম ও অর্ডার নিশ্চিত করুন <Icon name="arrow" /></a>
        <div className="av-inquiry-alternatives"><a className="av-btn av-btn-outline" href={`tel:${CONTACT.international}`}><Icon name="phone" />{CONTACT.display}</a><button type="button" className="av-btn av-btn-outline" onClick={() => void copy()}><Icon name={copied ? "check" : "copy"} />{copied ? "বার্তা কপি হয়েছে" : "বার্তা কপি করুন"}</button></div>
        <details className="av-detail-accordion"><summary>যে বার্তাটি যাবে <Icon name="plus" size={16} /></summary><pre className="av-inquiry-message">{message}</pre></details>
        <p className="av-inquiry-caption">এখন কোনো টাকা নেওয়া হয়নি বা অর্ডার সংরক্ষণ হয়েছে বলে দাবি করা হচ্ছে না।</p>
      </> : <p role="status">পছন্দের পণ্য যোগ করে আবার আসুন।</p>}
      {error && <p role="alert">{error}</p>}<button type="button" className="av-text-link" onClick={bag.close}>আরও পণ্য দেখুন →</button>
    </section>
  </Dialog>;
}
