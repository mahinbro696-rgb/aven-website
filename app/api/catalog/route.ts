import { NextResponse } from "next/server";
import { firebaseConfig } from "@/lib/firebase";
import { normalizeProduct, type Product } from "@/lib/atelier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Value = { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; timestampValue?: string; arrayValue?: { values?: Value[] }; mapValue?: { fields?: Record<string, Value> } };
function decode(value: Value): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if (value.timestampValue) return { seconds: Date.parse(value.timestampValue) / 1000 };
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, v]) => [key, decode(v)]));
  return null;
}
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const signal = AbortSignal.timeout(15000);
    const products: Product[] = [];
    let pageToken = "";
    for (let page = 0; page < 10; page++) {
      const url = new URL(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/products`);
      url.searchParams.set("key", firebaseConfig.apiKey);
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      // Uses the existing public-client permissions. No admin access or relaxed rules.
      const response = await fetch(url, { cache: "no-store", signal });
      if (!response.ok) {
        console.error("AVEN_CATALOG_READ_FAILED", response.status);
        return NextResponse.json({ success: false, status: "unavailable", products: [], message: "বর্তমান দাম ও স্টক যাচাই করা যাচ্ছে না।" }, { status: 503, headers });
      }
      const data = await response.json() as { documents?: { name: string; fields?: Record<string, Value> }[]; nextPageToken?: string };
      for (const doc of data.documents || []) {
        const raw = Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, decode(value)]));
        if (raw.published === false || raw.status === "draft") continue;
        const id = doc.name.split("/").pop();
        if (id) products.push(normalizeProduct(id, raw));
      }
      pageToken = data.nextPageToken || "";
      if (!pageToken) break;
    }
    if (pageToken) return NextResponse.json({ success: false, status: "unavailable", products: [], message: "কালেকশন সম্পূর্ণ লোড হয়নি। আবার চেষ্টা করুন।" }, { status: 503, headers });
    products.sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name, "bn"));
    return NextResponse.json({ success: true, status: products.length ? "ready" : "empty", products }, { headers });
  } catch (error) {
    console.error("AVEN_CATALOG_UNAVAILABLE", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ success: false, status: "unavailable", products: [], message: "বর্তমান দাম ও স্টক যাচাই করা যাচ্ছে না।" }, { status: 503, headers });
  }
}
