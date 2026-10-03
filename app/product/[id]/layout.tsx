import type { Metadata } from "next";
import type { ReactNode } from "react";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pathname = `/product/${encodeURIComponent(id)}`;
  return {
    title: "পণ্যের বিস্তারিত",
    alternates: { canonical: pathname },
    openGraph: {
      title: "AVEN | পণ্যের বিস্তারিত",
      description: "পণ্যের ছবি, রঙ ও মূল্য দেখে AVEN-এ আপনার পছন্দের অর্ডার করুন।",
      url: pathname,
      siteName: "AVEN",
      locale: "bn_BD",
      type: "website",
      images: [{ url: "/products/hero.png", alt: "AVEN collection" }],
    },
  };
}

export default function ProductLayout({ children }: { children: ReactNode }) {
  return children;
}
