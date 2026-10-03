"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const highlights = [
  { title: "Premium", label: "নির্বাচিত ফিনিশিং" },
  { title: "Curated", label: "পরিশীলিত ডিজাইন" },
  { title: "Easy", label: "সহজ অর্ডার" },
];

export default function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-[820px] items-center overflow-hidden pb-20 pt-32 text-white sm:pt-36 lg:min-h-screen lg:pb-24"
    >
      <div className="pointer-events-none absolute left-1/2 top-[-14rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[#d7b45b]/10 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-12rem] right-[-12rem] h-[34rem] w-[34rem] rounded-full bg-[#8d5b24]/10 blur-[150px]" />

      <div className="section-shell relative z-10 grid items-center gap-14 lg:grid-cols-[1.03fr_0.97fr] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.75, ease: "easeOut" }}
        >
          <p className="eyebrow">AVEN · Premium Fashion House</p>

          <h1 className="mt-6 max-w-3xl text-[3.4rem] font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl md:text-7xl lg:text-[5.4rem]">
            ঐতিহ্যকে পরুন
            <span className="gold-text mt-2 block">নতুন আভিজাত্যে</span>
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-8 text-white/55 sm:text-lg">
            কুশিকথা, জামদানি ও প্রিমিয়াম শালের নির্বাচিত কালেকশন—যেখানে
            বাংলাদেশের নান্দনিক ঐতিহ্য মিশেছে আধুনিক, মিনিমাল এবং পরিশীলিত
            স্টাইলের সাথে।
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/#products" className="gold-btn px-7">
              কালেকশন দেখুন
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/#collections" className="outline-btn px-7">
              AVEN সম্পর্কে জানুন
            </Link>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
            {highlights.map((item) => (
              <div key={item.title} className="metric-card">
                <p className="text-sm font-black text-[#f1d98d] sm:text-base">
                  {item.title}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-white/40 sm:text-xs">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 22 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-[35rem]"
        >
          <div className="absolute -inset-5 rounded-[3rem] bg-[#d7b45b]/10 blur-3xl" />

          <div className="relative aspect-[4/5] overflow-hidden rounded-[2.3rem] border border-[#d7b45b]/20 bg-[#0b0b0b] shadow-[0_35px_100px_rgba(0,0,0,0.55)] sm:rounded-[3rem]">
            <Image
              src="/products/hero.png"
              fill
              priority
              sizes="(max-width: 1024px) 90vw, 560px"
              alt="AVEN premium fashion collection"
              className="object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />

            <div className="absolute inset-x-5 bottom-5 rounded-[1.5rem] border border-white/10 bg-black/45 p-5 backdrop-blur-xl sm:inset-x-7 sm:bottom-7 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#f1d98d]">
                    Signature Collection
                  </p>
                  <p className="mt-2 text-xl font-bold sm:text-2xl">
                    AVEN Exclusive
                  </p>
                </div>

                <div className="hidden h-12 w-12 items-center justify-center rounded-full border border-[#d7b45b]/30 bg-[#d7b45b]/10 text-[#f1d98d] sm:flex">
                  ✦
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -left-3 top-16 hidden rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-xs font-semibold text-white/60 shadow-xl backdrop-blur-xl sm:block">
            Crafted with detail
          </div>
        </motion.div>
      </div>
    </section>
  );
}
