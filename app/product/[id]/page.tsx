"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import OrderForm from "@/components/OrderForm";

interface Color {
  name: string;
  image: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  oldPrice: number;
  discount: number;
  price: number;
  description: string;
  mainImage: string;
  colors: Color[];
}

export default function ProductDetails() {
  const params = useParams();
  const id = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState("");

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;

      try {
        setLoading(true);

        const snapshot = await getDoc(doc(db, "products", id));

        if (!snapshot.exists()) {
          setProduct(null);
          return;
        }

        const data = snapshot.data();

        const productData: Product = {
          id: snapshot.id,
          name: data.name || "",
          category: data.category || "AVEN Collection",
          oldPrice: Number(data.oldPrice || 0),
          discount: Number(data.discount || 0),
          price: Number(data.price || 0),
          description: data.description || "",
          mainImage: data.mainImage || "/products/pink.png",
          colors: Array.isArray(data.colors) ? data.colors : [],
        };

        setProduct(productData);
        setSelectedColor(productData.colors[0]?.name || "");
      } catch (error) {
        console.error("Product error:", error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    void loadProduct();
  }, [id]);

  const selectedImage = useMemo(() => {
    if (!product) return "/products/pink.png";

    return (
      product.colors.find((color) => color.name === selectedColor)?.image ||
      product.mainImage
    );
  }, [product, selectedColor]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#060606] text-white">
        <Navbar />
        <div className="section-shell flex min-h-screen items-center justify-center pt-28">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#d7b45b]" />
            <p className="mt-4 text-sm font-semibold text-white/45">
              পণ্য লোড হচ্ছে...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-[#060606] text-white">
        <Navbar />
        <div className="section-shell flex min-h-screen items-center justify-center pt-28">
          <div className="luxury-card max-w-lg p-8 text-center">
            <p className="text-4xl">✦</p>
            <h1 className="mt-4 text-3xl font-black">পণ্যটি পাওয়া যায়নি</h1>
            <p className="mt-3 text-sm leading-6 text-white/42">
              পণ্যটি সরানো হয়ে থাকতে পারে অথবা লিংকটি সঠিক নয়।
            </p>
            <Link href="/#products" className="gold-btn mt-6">
              কালেকশনে ফিরুন
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#060606] pb-20 text-white">
      <Navbar />

      <section className="section-shell grid gap-10 pt-32 sm:pt-36 lg:grid-cols-[1fr_0.95fr] lg:items-start lg:gap-16">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:sticky lg:top-32"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-[#d7b45b]/18 bg-[#111] shadow-[0_32px_90px_rgba(0,0,0,0.5)] sm:rounded-[2.6rem]">
            <Image
              src={selectedImage}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 52vw"
              alt={product.name}
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

            {!!product.discount && (
              <div className="absolute right-5 top-5 rounded-full bg-[#e5c76e] px-4 py-2 text-sm font-black text-black">
                -{product.discount}%
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="pb-8 lg:pt-6"
        >
          <Link
            href="/#products"
            className="text-xs font-bold uppercase tracking-[0.16em] text-white/35 transition hover:text-[#f1d98d]"
          >
            ← কালেকশনে ফিরুন
          </Link>

          <p className="eyebrow mt-8">{product.category}</p>

          <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            {product.name}
          </h1>

          <p className="mt-6 text-base leading-8 text-white/50">
            {product.description ||
              "AVEN-এর নির্বাচিত premium collection—refined finishing এবং elegant presentation-এর সমন্বয়।"}
          </p>

          <div className="mt-8 flex items-end gap-4 border-y border-white/[0.07] py-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                মূল্য
              </p>
              <p className="mt-1 text-4xl font-black text-[#f1d98d]">
                ৳ {product.price}
              </p>
            </div>

            {product.oldPrice > product.price && (
              <p className="pb-1 text-lg text-white/28 line-through">
                ৳ {product.oldPrice}
              </p>
            )}
          </div>

          {product.colors.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-bold">রঙ নির্বাচন</h2>
                {selectedColor && (
                  <p className="text-sm font-black text-[#d7b45b]">
                    {selectedColor}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {product.colors.map((color) => {
                  const active = selectedColor === color.name;

                  return (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setSelectedColor(color.name)}
                      aria-pressed={active}
                      className={`relative h-16 w-16 overflow-hidden rounded-2xl border transition ${ 
                        active
                          ? "scale-[1.04] border-[#f1d98d] ring-2 ring-[#d7b45b]/18"
                          : "border-white/10 hover:border-[#d7b45b]/45"
                      }`}
                    >
                      <Image
                        src={color.image}
                        fill
                        alt={color.name}
                        className="object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-9">
            <OrderForm
              productName={product.name}
              colors={product.colors}
              defaultColor={selectedColor}
              triggerLabel="এখনই অর্ডার করুন"
            />
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {["Premium finishing", "Easy ordering", "Secure delivery"].map(
              (item) => (
                <div key={item} className="metric-card text-center">
                  <p className="text-xs font-bold text-white/52">{item}</p>
                </div>
              )
            )}
          </div>
        </motion.div>
      </section>
    </main>
  );
}
