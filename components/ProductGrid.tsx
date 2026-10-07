"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase";
import ProductCard from "./ProductCard";

interface Color {
  name: string;
  image: string;
}

interface Product {
  id: string;
  name: string;
  category?: string;
  oldPrice: number;
  discount: number;
  price: number;
  description: string;
  mainImage: string;
  colors: Color[];
}

export default function ProductGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const productsQuery = query(
        collection(db, "products"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(productsQuery);

      const data: Product[] = snapshot.docs.map((productDoc) => {
        const item = productDoc.data();

        return {
          id: productDoc.id,
          name: item.name || "নাম নেই",
          category: item.category || "AVEN Collection",
          oldPrice: Number(item.oldPrice || 0),
          discount: Number(item.discount || 0),
          price: Number(item.price || 0),
          description:
            item.description || "প্রিমিয়াম লাক্সারি AVEN কালেকশন।",
          mainImage: item.mainImage || "/products/pink.png",
          colors: Array.isArray(item.colors)
            ? item.colors.map((color: Color) => ({
                name: color.name || "",
                image: color.image || "/products/pink.png",
              }))
            : [],
        };
      });

      setProducts(data);
    } catch (err) {
      console.error("PRODUCT FETCH ERROR:", err);
      setError("পণ্য লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="shimmer aspect-[3/5] rounded-[2rem] border border-white/[0.05]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="luxury-card py-14 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d7b45b]">
          Something went wrong
        </p>
        <h3 className="mt-3 text-2xl font-black">পণ্য লোড করা যায়নি</h3>
        <p className="mt-3 text-sm text-white/45">{error}</p>
        <button onClick={() => void loadProducts()} className="gold-btn mt-6">
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="luxury-card py-16 text-center">
        <p className="text-4xl">✦</p>
        <h3 className="mt-4 text-2xl font-black">নতুন কালেকশন প্রস্তুত হচ্ছে</h3>
        <p className="mt-3 text-sm text-white/42">
          খুব শীঘ্রই AVEN-এর নতুন পণ্য এখানে দেখা যাবে।
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7 flex flex-col gap-3 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/40">
          বর্তমানে{" "}
          <span className="font-black text-[#f1d98d]">{products.length}</span>{" "}
          টি পণ্য
        </p>

        <button
          type="button"
          onClick={() => void loadProducts()}
          className="text-sm font-bold text-white/45 transition hover:text-[#f1d98d]"
        >
          পণ্য রিফ্রেশ করুন ↻
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.45, delay: Math.min(index * 0.06, 0.24) }}
          >
            <ProductCard product={product} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
