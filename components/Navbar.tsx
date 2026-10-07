"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

const navItems = [
  { label: "হোম", href: "/#home" },
  { label: "কালেকশন", href: "/#collections" },
  { label: "পণ্য", href: "/#products" },
  { label: "কেন AVEN", href: "/#why-aven" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5"
      aria-label="প্রধান নেভিগেশন"
    >
      <div className="section-shell">
        <div className="glass rounded-[1.4rem] px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="group flex min-w-0 items-center gap-3"
              aria-label="AVEN হোম"
            >
              <span className="gold-text text-2xl font-black tracking-[0.26em] sm:text-3xl">
                AVEN
              </span>
              <span className="hidden border-l border-white/10 pl-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 lg:block">
                Premium Fashion
              </span>
            </Link>

            <div className="hidden items-center gap-7 text-sm font-semibold text-white/65 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition hover:text-[#f1d98d]"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/#products"
                className="gold-btn hidden min-h-0 px-5 py-2.5 text-sm sm:inline-flex"
              >
                শপ করুন
              </Link>

              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white md:hidden"
                aria-expanded={open}
                aria-controls="mobile-navigation"
                aria-label={open ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
              >
                <span className="text-xl leading-none">{open ? "×" : "☰"}</span>
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id="mobile-navigation"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden md:hidden"
              >
                <div className="mt-4 grid gap-1 border-t border-white/10 pt-4">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="rounded-xl px-3 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/5 hover:text-[#f1d98d]"
                    >
                      {item.label}
                    </Link>
                  ))}

                  <Link
                    href="/#products"
                    onClick={() => setOpen(false)}
                    className="gold-btn mt-2 w-full text-sm"
                  >
                    পণ্য দেখুন
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.nav>
  );
}
