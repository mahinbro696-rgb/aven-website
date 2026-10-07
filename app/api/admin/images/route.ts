import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/admin-api";
import { readUploadImage, uploadProductImage } from "@/lib/product-image-upload";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function POST(request: Request) {
  try {
    const context = await requireAdmin(request);
    const image = await readUploadImage(request);
    return NextResponse.json(await uploadProductImage(context, image), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AdminApiError ? error.code : "UPLOAD_FAILED", message: error instanceof AdminApiError ? error.message : "ছবি upload করা যায়নি। আবার চেষ্টা করুন।" }, { status: error instanceof AdminApiError ? error.status : 503, headers });
  }
}
