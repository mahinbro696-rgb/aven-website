import type { Metadata } from "next";
import Storefront from "@/components/atelier/Storefront";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return <Storefront />;
}
