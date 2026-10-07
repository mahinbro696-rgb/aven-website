"use client";

import { useState } from "react";
import { CONTACT, whatsappLink } from "@/lib/atelier";
import { Icon, Photo, Tilt } from "./Primitives";

export function Hero({ onShop }: { onShop: () => void }) {
  const [look, setLook] = useState(0);
  const looks = [
    { image: "/products/pink.png", color: "#b56f76", label: "গোলাপি", caption: "THE ROSE EDIT" },
    { image: "/products/Blue.png", color: "#718798", label: "নীল", caption: "THE BLUE EDIT" },
    { image: "/products/Yellow.png", color: "#c5a14f", label: "হলুদ", caption: "THE GOLDEN EDIT" },
  ];
  return <section className="av-hero"><div className="av-hero-watermark" aria-hidden="true">A</div>
    <div className="av-container av-hero-grid"><div className="av-hero-copy">
      <p className="av-eyebrow av-eyebrow-light"><span />THE AVEN EDIT / 2026</p>
      <h1>Tradition.<br /><em>Reimagined.</em></h1>
      <p className="av-hero-bangla">ঐতিহ্য থাকুক,<br />আপনার নিজস্বতায়।</p>
      <p className="av-hero-description">রঙে, নকশায় আর পরার আনন্দে—<br />আপনার প্রতিদিনের গল্পে AVEN-এর একটুখানি ছোঁয়া।</p>
      <div className="av-hero-cta"><button type="button" className="av-btn av-btn-gold" onClick={onShop}>কালেকশন দেখুন <Icon name="arrow" /></button><a href={whatsappLink()} className="av-hero-secondary" target="_blank" rel="noopener noreferrer"><Icon name="chat" />কথা বলুন</a></div>
      <div className="av-hero-footnote"><span className="av-tiny-mark">A</span><div>THE ART OF EVERYDAY ELEGANCE<small>ঐতিহ্য • রঙ • নিজস্বতা</small></div></div>
    </div><div className="av-hero-scene"><div className="av-orbit av-orbit-one" aria-hidden="true" /><div className="av-orbit av-orbit-two" aria-hidden="true" />
      <Tilt className="av-hero-frame" strength={9}><div className="av-frame-line" aria-hidden="true" /><div className="av-hero-photo"><Photo key={looks[look].image} src={looks[look].image} alt={`AVEN-এর ${looks[look].label} কালেকশন`} eager /><div className="av-hero-photo-shade" /><span className="av-image-label">AVEN / SIGNATURE</span></div>
        <div className="av-frame-caption"><div><small>{looks[look].caption}</small><span>A little colour.<br />A lasting impression.</span></div><span className="av-frame-index">0{look + 1}<small>/ 03</small></span></div>
        <div className="av-floating-label"><Icon name="spark" size={22} /><span>Made for<br /><em>your moments.</em></span></div>
      </Tilt><div className="av-look-selector"><span>রঙের গল্প</span>{looks.map((item, index) => <button key={item.label} type="button" aria-label={`${item.label} ছবি দেখুন`} aria-pressed={look === index} onClick={() => setLook(index)} style={{ backgroundColor: item.color }} className={look === index ? "is-active" : ""} />)}<span aria-live="polite">{looks[look].label}</span></div>
    </div></div><a className="av-scroll-cue" href="#collections">EXPLORE THE EDIT <Icon name="down" size={14} /></a>
  </section>;
}

export function Story({ onShop }: { onShop: () => void }) {
  return <section className="av-story av-section" id="story"><div className="av-container av-story-grid">
    <Tilt className="av-story-art" strength={4}><div className="av-story-image"><Photo src="/products/Yellow.png" alt="AVEN কালেকশনের রঙ ও নকশা" sizes="(max-width: 700px) 90vw, 45vw" /></div><div className="av-story-stamp"><span>AVEN</span><small>COLOUR.<br />CHARACTER.<br />YOU.</small></div></Tilt>
    <div className="av-story-copy"><p className="av-eyebrow">03 / THE AVEN PHILOSOPHY</p><h2>ফ্যাশন নয় শুধু,<br /><em>একটুখানি আপনি।</em></h2>
      <p>কোনো এক বিকেলের আড্ডা, কাছের মানুষের সঙ্গে সময়, কিংবা নিজের জন্য সাজা—পোশাকের সৌন্দর্য লুকিয়ে থাকে এই ছোট্ট মুহূর্তগুলোয়।</p><p>AVEN-এর ভাবনা সহজ। ঐতিহ্যের রঙ ও নকশাকে আপনার নিজস্ব স্টাইলের অংশ করে তোলা। এমন কিছু, যা পরতে ভালো লাগে; নিজের মতো লাগে।</p>
      <div className="av-story-signature"><span>Wear it your way.</span><small>WITH LOVE, AVEN</small></div><button type="button" className="av-text-link" onClick={onShop}>আপনার পছন্দ খুঁজে নিন <Icon name="arrow" size={17} /></button>
    </div></div></section>;
}

export function HowTo() {
  return <section className="av-how av-section" id="how-to-order"><div className="av-container"><div className="av-section-top"><div><p className="av-eyebrow">04 / A LITTLE HELP</p><h2>পছন্দ থেকে <em>অর্ডার।</em></h2></div><p className="av-section-intro">জটিলতা নয়।<br />মাত্র তিনটি সহজ ধাপ।</p></div>
    <div className="av-steps">{[["01", "পছন্দ করুন", "পণ্যের ছবি, রঙ ও মূল্য দেখে নিজের পছন্দটি বেছে নিন।"], ["02", "বিস্তারিত জানান", "অর্ডার ফর্ম পূরণ করুন অথবা WhatsApp-এ সরাসরি কথা বলুন।"], ["03", "নিশ্চিত করুন", "স্টক, ডেলিভারি চার্জ এবং পেমেন্টের নিয়ম জেনে অর্ডার চূড়ান্ত করুন।"]].map(([n, title, text]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
    <div className="av-faq-layout"><div><p className="av-eyebrow">GOOD TO KNOW</p><h3>কিছু প্রশ্ন,<br /><em>সহজ উত্তর।</em></h3></div><div className="av-faq">{[
      ["কীভাবে অর্ডার করব?", "পণ্য থেকে অর্ডার বাটনে চাপুন। নাম, ফোন, ঠিকানা ও পছন্দের রঙ দিন। ফর্ম ছাড়াও WhatsApp-এ পণ্যের তথ্য পাঠিয়ে অর্ডার নিয়ে কথা বলতে পারবেন।"],
      ["ডেলিভারি চার্জ কত?", "আপনার ঠিকানা ও অর্ডার অনুযায়ী চার্জ নিশ্চিত করা হবে। এখানে দেখানো মোট শুধু পণ্যের মূল্য; ডেলিভারি চার্জ যোগ করা হয়নি।"],
      ["পেমেন্ট ও রিটার্নের নিয়ম কী?", "পেমেন্ট পদ্ধতি, ডেলিভারির সময় এবং কোনো পরিবর্তন বা রিটার্নের প্রয়োজন হলে তার শর্ত অর্ডার চূড়ান্ত করার আগে WhatsApp বা ফোনে জেনে নিন।"],
      ["ছবির রঙ ও আসল রঙ কি একই?", "স্ক্রিন ও আলোর কারণে রঙে সামান্য পার্থক্য হতে পারে। কোনো রঙ বা কাপড় নিয়ে প্রশ্ন থাকলে কেনার আগে সরাসরি কথা বলুন।"],
    ].map(([q, a]) => <details key={q}><summary>{q}<Icon name="plus" size={18} /></summary><p>{a}</p></details>)}</div></div>
  </div></section>;
}

export function Contact({ onCopy }: { onCopy: () => void }) {
  return <section className="av-contact" id="contact"><div className="av-container av-contact-grid"><div><p className="av-eyebrow av-eyebrow-light">LET’S FIND YOUR NEXT FAVOURITE</p><h2>একটু কথা <em>হোক।</em></h2><p>পণ্য, রঙ অথবা অর্ডার—আপনার প্রশ্নের জন্য<br />আমরা আছি সরাসরি WhatsApp ও ফোনে।</p></div>
    <div className="av-contact-actions"><div className="av-contact-number"><a href={`tel:${CONTACT.international}`}>{CONTACT.display}</a><button type="button" className="av-icon-btn" onClick={onCopy} aria-label="ফোন নম্বর কপি করুন"><Icon name="copy" size={18} /></button></div>
      <div><a href={whatsappLink()} className="av-btn av-btn-gold" target="_blank" rel="noopener noreferrer"><Icon name="chat" />WhatsApp করুন <Icon name="arrow" /></a><a href={`tel:${CONTACT.international}`} className="av-btn av-btn-outline"><Icon name="phone" />কল করুন</a></div><small>AVEN / DIRECT CONTACT</small>
    </div></div></section>;
}
