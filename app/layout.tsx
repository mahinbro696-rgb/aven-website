import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_Bengali, Playfair_Display } from "next/font/google";
import "./globals.css";
import "./atelier.css";

const bengali = Noto_Sans_Bengali({ subsets: ["bengali", "latin"], variable: "--font-bengali", display: "swap" });
const editorial = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-editorial", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://aven-website.vercel.app"),
  title: { default: "AVEN | ঐতিহ্য, আপনার নিজস্বতায়", template: "%s | AVEN" },
  description: "AVEN-এর নির্বাচিত ফ্যাশন কালেকশন। পছন্দের রঙ বেছে অর্ডার করুন অথবা WhatsApp-এ কথা বলুন: 01987744985।",
  openGraph: { title: "AVEN | Tradition. Reimagined.", description: "ঐতিহ্যের রঙ, আপনার নিজস্বতায়। AVEN-এর কালেকশন দেখুন।", siteName: "AVEN", locale: "bn_BD", type: "website", images: [{ url: "/products/hero.png", alt: "AVEN collection" }] },
  twitter: { card: "summary_large_image", title: "AVEN | Tradition. Reimagined.", images: ["/products/hero.png"] },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
  robots: process.env.VERCEL_ENV === "preview" ? { index: false, follow: false } : { index: true, follow: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#171e1c" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="bn" className={`${bengali.variable} ${editorial.variable}`}><body>{children}</body></html>;
}
