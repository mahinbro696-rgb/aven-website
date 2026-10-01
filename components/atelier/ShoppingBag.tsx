"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { lineKey, addLine, type BagLine } from "@/lib/commerce";
import { money, type Product } from "@/lib/atelier";
import { Dialog, Empty, Icon } from "./Primitives";
import { useCommerce } from "./CommerceState";
import CheckoutExperience from "./CheckoutExperience";
import InquiryCheckout from "./InquiryCheckout";
import { BagLines, bagTotal, validBag, needsInquiry } from "./BagItems";

function Bag({ products, loading, error, reload }: { products: Product[]; loading: boolean; error: string; reload: () => void }) {
  const bag = useCommerce();
  const [removed, setRemoved] = useState<BagLine | null>(null);
  useEffect(() => { if (!removed) return; const timer = window.setTimeout(() => setRemoved(null), 7000); return () => window.clearTimeout(timer); }, [removed]);
  const total = bagTotal(bag.lines, products);
  const inquiry = needsInquiry(bag.lines, products);
  const undo = () => {
    if (!removed) return;
    try { bag.replace(addLine(bag.lines, removed)); setRemoved(null); }
    catch (error) { bag.inform(error instanceof Error ? error.message : "ফিরিয়ে আনা যায়নি।"); }
  };
  return <Dialog title="আপনার Shopping Bag" onClose={bag.close} variant="drawer">
    <div className="av-bag-shell"><div className="av-bag-intro"><span className="av-eyebrow">A LITTLE SOMETHING, JUST FOR YOU</span><p>পছন্দগুলো থাকুক <em>একসঙ্গে।</em><span>{new Intl.NumberFormat("bn-BD").format(bag.count)}টি পণ্য</span></p></div>
      {bag.notice && <p className="av-bag-inline-notice" role="status">{bag.notice}</p>}
      {loading ? <div className="av-bag-loading" role="status"><span className="av-spinner" />কালেকশন যাচাই হচ্ছে…</div>
        : error ? <Empty title="সংযোগ আবার যাচাই করুন" text={error}><button className="av-btn av-btn-dark" type="button" onClick={reload}>আবার চেষ্টা করুন</button></Empty>
        : bag.lines.length ? <BagLines items={bag.lines} products={products} onChange={bag.replace} onRemove={(line) => { bag.replace(bag.lines.filter((item) => lineKey(item) !== lineKey(line))); setRemoved(line); }} />
        : <Empty title="আপনার প্রথম পছন্দের অপেক্ষায়।" text="পণ্যের Add to Cart বাটনে চাপুন। পছন্দের পণ্যগুলো এই ব্রাউজারে মনে রাখা হবে।"><Link className="av-btn av-btn-dark" onClick={bag.close} href="/#shop">কালেকশন দেখুন <Icon name="arrow" /></Link></Empty>}
      {removed && <div className="av-bag-undo" role="status"><span>ব্যাগ থেকে সরানো হয়েছে</span><button type="button" onClick={undo}>ফিরিয়ে আনুন</button></div>}
      {bag.lines.length > 0 && !loading && !error && <div className="av-bag-footer">
        <div className="av-bag-subtotal"><span>{inquiry ? "পণ্যের মূল্য" : "পণ্যের মোট"}</span><strong key={`${total}-${inquiry}`}>{inquiry ? "নিশ্চিত করা হবে" : money(total)}</strong></div>
        <p>{inquiry ? `${total > 0 ? `দাম প্রকাশিত পণ্যগুলোর মোট ${money(total)}। ` : ""}এক বা একাধিক পণ্যের দাম ও স্টক নিশ্চিত করা বাকি। পরের ধাপে সব পছন্দসহ WhatsApp-এ কথা বলুন।` : "ডেলিভারি চার্জ আলাদাভাবে নিশ্চিত করা হবে। এটি পণ্যের মূল্য, চূড়ান্ত মোট নয়।"}</p>
        <button type="button" className="av-btn av-btn-dark av-checkout-start" disabled={!validBag(bag.lines, products)} onClick={bag.checkout}>{inquiry ? "দাম জেনে অর্ডার করুন" : "Checkout-এ যান"}<Icon name="arrow" /></button>
        <button type="button" className="av-text-link" onClick={bag.close}>আরও পণ্য দেখুন</button>
        <div className="av-bag-reassurance"><Icon name="check" size={14} />Account খোলার প্রয়োজন নেই <span>·</span> অর্ডারের আগে তথ্য যাচাই</div>
      </div>}
    </div>
  </Dialog>;
}
export default function CommerceLayer(props: { products: Product[]; loading: boolean; error: string; reload: () => void }) {
  const bag = useCommerce();
  return <>
    {bag.panel?.type === "bag" && <Bag {...props} />}
    {bag.panel?.type === "checkout" && (needsInquiry(bag.panel.items, props.products)
      ? <InquiryCheckout key={bag.panel.key} products={props.products} initialItems={bag.panel.items} source={bag.panel.source} />
      : <CheckoutExperience key={bag.panel.key} products={props.products} initialItems={bag.panel.items} source={bag.panel.source} onReload={props.reload} />)}
    <div className={`av-commerce-notice ${bag.notice ? "is-visible" : ""}`} role="status" aria-live="polite">{bag.notice && <><Icon name="check" size={17} /><span>{bag.notice}</span></>}</div>
  </>;
}
