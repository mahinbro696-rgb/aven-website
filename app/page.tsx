import Link from "next/link";

import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import ProductGrid from "@/components/ProductGrid";

const collections = [
  {
    number: "01",
    title: "কুশিকথা",
    description:
      "ঐতিহ্যবাহী নকশাকে আধুনিক styling-এর সাথে মিলিয়ে তৈরি নির্বাচিত pieces।",
  },
  {
    number: "02",
    title: "জামদানি",
    description:
      "বাংলার timeless craftsmanship-এর সৌন্দর্যকে premium presentation-এ তুলে ধরা।",
  },
  {
    number: "03",
    title: "প্রিমিয়াম শাল",
    description:
      "আরাম, texture এবং elegant finishing-এর সমন্বয়ে refined seasonal collection।",
  },
];

const reasons = [
  {
    title: "পরিশীলিত নির্বাচন",
    description:
      "প্রতিটি collection visual balance, finishing এবং presentation বিবেচনা করে সাজানো।",
  },
  {
    title: "স্পষ্ট পণ্যের তথ্য",
    description:
      "মূল্য, রঙ এবং product details সহজভাবে দেখানো—যাতে সিদ্ধান্ত নেওয়া আরও পরিষ্কার হয়।",
  },
  {
    title: "সহজ অর্ডার অভিজ্ঞতা",
    description:
      "পছন্দের পণ্য থেকে সরাসরি order flow-এ যাওয়া যায়, অপ্রয়োজনীয় ধাপ ছাড়াই।",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#060606] text-white">
      <Navbar />
      <Hero />

      <section id="collections" className="relative scroll-mt-28 py-24 sm:py-28">
        <div className="section-shell">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <p className="eyebrow">Our Collections</p>
              <h2 className="mt-5 max-w-xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                প্রতিটি কালেকশনে
                <span className="gold-text block">একটি আলাদা পরিচয়</span>
              </h2>
              <p className="mt-6 max-w-lg text-base leading-7 text-white/50">
                AVEN-এর visual language রাখা হয়েছে clean, premium এবং focused—
                যাতে পণ্যের craftsmanship-ই থাকে মূল আকর্ষণ।
              </p>
              <Link href="#products" className="outline-btn mt-8">
                সব পণ্য দেখুন
              </Link>
            </div>

            <div className="grid gap-4 sm:gap-5">
              {collections.map((item) => (
                <article
                  key={item.number}
                  className="surface-card group relative overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:border-[#d7b45b]/35 sm:p-8"
                >
                  <div className="absolute right-5 top-2 text-6xl font-black tracking-[-0.08em] text-white/[0.035] sm:text-8xl">
                    {item.number}
                  </div>

                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d7b45b]">
                    Collection {item.number}
                  </p>
                  <h3 className="mt-5 text-2xl font-black sm:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-white/48 sm:text-base">
                    {item.description}
                  </p>
                  <Link
                    href="#products"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#f1d98d] transition group-hover:gap-3"
                  >
                    কালেকশন দেখুন <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="products"
        className="relative scroll-mt-28 border-y border-white/[0.06] bg-white/[0.015] py-24 sm:py-28"
      >
        <div className="section-shell">
          <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
            <p className="eyebrow justify-center">AVEN Collection</p>
            <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl md:text-6xl">
              আপনার পছন্দের
              <span className="gold-text block">প্রিমিয়াম পণ্য</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/48 sm:text-base">
              রঙ, মূল্য এবং বিস্তারিত দেখে আপনার জন্য উপযুক্ত পণ্যটি নির্বাচন করুন।
            </p>
          </div>

          <ProductGrid />
        </div>
      </section>

      <section id="why-aven" className="scroll-mt-28 py-24 sm:py-28">
        <div className="section-shell">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="eyebrow">Why AVEN</p>
              <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                সুন্দর design,
                <span className="gold-text block">সহজ shopping flow</span>
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-white/48 sm:text-base lg:justify-self-end">
              Premium website experience মানে শুধু dark-gold color নয়—navigation,
              product information, mobile usability এবং order journey সবকিছুই
              consistent হওয়া।
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {reasons.map((item, index) => (
              <article key={item.title} className="surface-card p-6 sm:p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d7b45b]/25 bg-[#d7b45b]/8 text-sm font-black text-[#f1d98d]">
                  0{index + 1}
                </div>
                <h3 className="mt-6 text-xl font-black">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/45">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24 sm:pb-28">
        <div className="section-shell">
          <div className="luxury-card relative overflow-hidden px-6 py-12 text-center sm:px-10 sm:py-16">
            <div className="pointer-events-none absolute left-1/2 top-0 h-52 w-96 -translate-x-1/2 rounded-full bg-[#d7b45b]/10 blur-[90px]" />
            <div className="relative">
              <p className="eyebrow justify-center">Ready to Explore?</p>
              <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                আপনার স্টাইলে যোগ করুন
                <span className="gold-text block">AVEN-এর নতুন পরিচয়</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/45 sm:text-base">
                কালেকশন দেখুন, পছন্দের রঙ নির্বাচন করুন এবং product page থেকেই
                অর্ডার সম্পন্ন করুন।
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="#products" className="gold-btn px-7">
                  এখনই পণ্য দেখুন
                </Link>
                <Link href="#contact" className="outline-btn px-7">
                  যোগাযোগ
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer
        id="contact"
        className="scroll-mt-28 border-t border-white/[0.07] bg-black/40 py-12"
      >
        <div className="section-shell">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="gold-text text-3xl font-black tracking-[0.3em]">
                AVEN
              </p>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/42">
                Premium fashion presentation rooted in tradition and refined for
                modern style.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-white/50">
              <Link href="/#collections" className="hover:text-[#f1d98d]">
                কালেকশন
              </Link>
              <Link href="/#products" className="hover:text-[#f1d98d]">
                পণ্য
              </Link>
              <Link href="/#why-aven" className="hover:text-[#f1d98d]">
                কেন AVEN
              </Link>
            </div>
          </div>

          <div className="mt-9 flex flex-col gap-2 border-t border-white/[0.06] pt-6 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 AVEN. সর্বস্বত্ব সংরক্ষিত।</p>
            <p>Premium Fashion House</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
