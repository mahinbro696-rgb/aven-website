"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import { safeImage } from "@/lib/atelier";

export type IconName = "arrow" | "heart" | "search" | "chat" | "phone" | "menu" | "close" | "bag" | "plus" | "minus" | "check" | "copy" | "share" | "down" | "spark";
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    chat: <><path d="M21 11.5a9 9 0 0 1-13.3 8L3 21l1.5-4.7A9 9 0 1 1 21 11.5Z" /><path d="M8 9c1 4 3 6 7 7l2-2-3-2-1 1-2-2 1-1-2-3-2 2Z" /></>,
    phone: <path d="M7 3H4a1 1 0 0 0-1 1c0 9 8 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z" />,
    menu: <path d="M4 7h16M4 12h16M4 17h10" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
    share: <path d="M12 16V3m-4 4 4-4 4 4M6 11H3v10h18V11h-3" />,
    down: <path d="m6 9 6 6 6-6" />,
    spark: <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function Photo({ src, alt, eager = false, sizes = "(max-width: 700px) 90vw, 42vw" }: { src: string; alt: string; eager?: boolean; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  const image = safeImage(src);
  if (failed) return <div className="av-photo-fallback" role="img" aria-label={`${alt} — ছবি পাওয়া যায়নি`}><span>AVEN</span><small>ছবিটি লোড হয়নি</small></div>;
  return <Image src={image} alt={alt} fill sizes={sizes} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} unoptimized={image.startsWith("https://")} onError={() => setFailed(true)} />;
}
export function Tilt({ children, className = "", strength = 5 }: { children: ReactNode; className?: string; strength?: number }) {
  const reduced = useReducedMotion();
  const rx = useSpring(0, { stiffness: 160, damping: 25 });
  const ry = useSpring(0, { stiffness: 160, damping: 25 });
  const reset = () => { rx.set(0); ry.set(0); };
  return <motion.div className={className} style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }} onPointerMove={(event) => {
    if (reduced || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    rx.set(-(event.clientY - box.top - box.height / 2) / box.height * strength);
    ry.set((event.clientX - box.left - box.width / 2) / box.width * strength);
  }} onPointerLeave={reset} onPointerCancel={reset}>{children}</motion.div>;
}

/** Native dialog supplies focus containment, Escape support and top-layer rendering. */
export function Dialog({ children, title, onClose, wide = false, variant = "modal" }: {
  children: ReactNode; title: string; onClose: () => void; wide?: boolean; variant?: "modal" | "drawer" | "checkout";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.documentElement.style.overflow;
    if (element && !element.open) element.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => { element?.close(); document.documentElement.style.overflow = previous; };
  }, []);
  return createPortal(<dialog ref={dialog} className={`av-dialog ${wide ? "av-dialog-wide" : ""} av-dialog-${variant}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="av-dialog-surface"><div className="av-dialog-head"><h2 id={titleId}>{title}</h2><button type="button" className="av-icon-btn" onClick={onClose} aria-label="বন্ধ করুন"><Icon name="close" /></button></div>{children}</div>
  </dialog>, document.body);
}
export function Quantity({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <div className="av-quantity" aria-label="পরিমাণ"><button type="button" aria-label="পরিমাণ কমান" disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}><Icon name="minus" size={16} /></button><output aria-live="polite">{value}</output><button type="button" aria-label="পরিমাণ বাড়ান" disabled={value >= 20} onClick={() => onChange(Math.min(20, value + 1))}><Icon name="plus" size={16} /></button></div>;
}
export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <div className="av-empty"><Icon name="bag" size={32} /><h3>{title}</h3><p>{text}</p><div>{children}</div></div>;
}
let memoryWishlist = "[]";
function wishlistSnapshot() {
  try { return localStorage.getItem("aven-wishlist-v2") || memoryWishlist; } catch { return memoryWishlist; }
}
function subscribeWishlist(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener("aven:wishlist", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("aven:wishlist", listener); };
}
export function useWishlist() {
  const json = useSyncExternalStore(subscribeWishlist, wishlistSnapshot, () => "[]");
  const ids: string[] = useMemo(() => {
    try { const value: unknown = JSON.parse(json); return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(0, 200) : []; } catch { return []; }
  }, [json]);
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id].slice(-200);
    memoryWishlist = JSON.stringify(next);
    try { localStorage.setItem("aven-wishlist-v2", memoryWishlist); } catch { /* session memory remains available */ }
    window.dispatchEvent(new Event("aven:wishlist"));
  };
  return { ids, toggle };
}
