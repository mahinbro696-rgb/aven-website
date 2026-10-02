import { NextResponse } from "next/server";
import { firebaseConfig } from "@/lib/firebase";
import { FEATURED_SHOP_CATEGORIES, type ShopCategory } from "@/lib/shop-categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Value = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
};

function stringField(fields: Record<string, Value>, key: string, fallback = "") {
  return typeof fields[key]?.stringValue === "string" ? fields[key].stringValue! : fallback;
}

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/categories`);
    url.searchParams.set("key", firebaseConfig.apiKey);
    url.searchParams.set("pageSize", "100");

    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (response.status === 404) {
      return NextResponse.json({ success: true, categories: FEATURED_SHOP_CATEGORIES }, { headers });
    }
    if (!response.ok) throw new Error("category fetch failed");

    const data = await response.json() as {
      documents?: { name: string; fields?: Record<string, Value> }[];
    };

    const custom: ShopCategory[] = (data.documents || [])
      .filter((document) => document.fields?.published?.booleanValue !== false)
      .map((document) => {
        const fields = document.fields || {};
        const name = stringField(fields, "name").trim();
        return {
          key: "custom:" + name,
          name,
          eyebrow: stringField(fields, "eyebrow", "AVEN COLLECTION"),
          description: stringField(fields, "description", name + " category-র প্রকাশিত পণ্যগুলো এখানে সাজানো থাকবে।"),
        };
      })
      .filter((item) => item.name);

    return NextResponse.json({ success: true, categories: custom }, { headers });
  } catch {
    return NextResponse.json({ success: true, categories: [] }, { headers });
  }
}
