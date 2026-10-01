"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import OrderForm from "./OrderForm";

interface Color {
  name: string;
  image: string;
}

interface Product {
  id: string;
  name: string;
  category?: string;
  oldPrice: number;
  discount?: number;
  price: number;
  description?: string;
  mainImage: string;
  colors?: Color[];
}

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const [selectedColor, setSelectedColor] = useState(
    product.colors?.[0]?.name || ""
  );

  const selectedImage = useMemo(() => {
    if (!selectedColor) {
      return product.mainImage || "/products/default.png";
    }

    return (
      product.colors?.find((color) => color.name === selectedColor)?.image ||
      product.mainImage ||
      "/products/default.png"
    );
  }, [product.colors, product.mainImage, selectedColor]);

  return (
    <motion.article
      whileHover={{ y: -7 }}
      transition={{ duration: 0.25 }}
      className="group luxury-card overflow-hidden"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#111]">
        <Image
          src={selectedImage}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
          alt={product.name}
          className="object-cover transition duration-700 group-hover:scale-[1.035]"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/10" />

        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
          {product.category && (
            <span className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#f1d98d] backdrop-blur-xl">
              {product.category}
            </span>
          )}

          {!!product.discount && (
            <span className="ml-auto rounded-full bg-[#e5c76e] px-3 py-2 text-xs font-black text-black">
              -{product.discount}%
            </span>
          )}
        </div>

        <div className="absolute inset-x-5 bottom-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
            AVEN Collection
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.025em] text-white">
            {product.name}
          </h3>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <p className="line-clamp-2 text-sm leading-6 text-white/45">
          {product.description ||
            "প্রিমিয়াম কাপড় ও refined finishing-এর নির্বাচিত AVEN collection।"}
        </p>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/[0.07] pt-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
              মূল্য
            </p>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-2xl font-black text-[#f1d98d]">
                ৳ {product.price}
              </span>
              {product.oldPrice > product.price && (
                <span className="text-sm text-white/28 line-through">
                  ৳ {product.oldPrice}
                </span>
              )}
            </div>
          </div>

          <Link
            href={`/product/${product.id}`}
            className="text-sm font-bold text-white/58 transition hover:text-[#f1d98d]"
          >
            বিস্তারিত →
          </Link>
        </div>

        {!!product.colors?.length && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-white/44">রঙ নির্বাচন</p>
              {selectedColor && (
                <p className="text-xs font-bold text-[#d7b45b]">
                  {selectedColor}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              {product.colors.map((color) => {
                const active = selectedColor === color.name;

                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setSelectedColor(color.name)}
                    aria-pressed={active}
                    aria-label={`${color.name} রঙ নির্বাচন করুন`}
                    className={`relative h-11 w-11 overflow-hidden rounded-full border transition ${ 
                      active
                        ? "scale-105 border-[#f1d98d] ring-2 ring-[#d7b45b]/20"
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

        <div className="mt-7 grid grid-cols-2 gap-3">
          <Link
            href={`/product/${product.id}`}
            className="outline-btn min-h-12 px-4 text-sm"
          >
            বিস্তারিত
          </Link>

          <OrderForm
            productName={product.name}
            colors={product.colors || []}
            defaultColor={selectedColor}
            triggerLabel="অর্ডার করুন"
          />
        </div>
      </div>
    </motion.article>
  );
}
