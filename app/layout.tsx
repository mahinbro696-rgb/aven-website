import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aven-website.vercel.app"),
  title: {
    default: "AVEN | Premium Fashion House",
    template: "%s | AVEN",
  },
  description:
    "AVEN-এর প্রিমিয়াম ফ্যাশন কালেকশন—ঐতিহ্য, আধুনিক সৌন্দর্য এবং পরিশীলিত ডিজাইনের সমন্বয়।",
  keywords: [
    "AVEN",
    "premium fashion Bangladesh",
    "বাংলাদেশি ফ্যাশন",
    "জামদানি",
    "শাল",
    "কুশিকথা",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "AVEN | Premium Fashion House",
    description:
      "ঐতিহ্যকে নতুন আভিজাত্যে তুলে ধরা AVEN-এর প্রিমিয়াম ফ্যাশন কালেকশন।",
    url: "/",
    siteName: "AVEN",
    locale: "bn_BD",
    type: "website",
    images: [
      {
        url: "/products/hero.png",
        alt: "AVEN premium fashion collection",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AVEN | Premium Fashion House",
    description:
      "ঐতিহ্য, আধুনিক সৌন্দর্য এবং প্রিমিয়াম ফিনিশিং—AVEN-এর নির্বাচিত কালেকশন।",
    images: ["/products/hero.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="bn" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
