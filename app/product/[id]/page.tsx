"use client";

import { useParams } from "next/navigation";
import Storefront from "@/components/atelier/Storefront";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  return <Storefront key={id} productId={id} />;
}
