import { NextResponse } from "next/server";
import { AdminApiError, readAdminJson, requireAdmin } from "@/lib/admin-api";
import { cloudinaryAction, cloudinaryStatus } from "@/lib/cloudinary-integration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache" };
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof AdminApiError ? error.code : "CONNECTION_FAILED",
    message: error instanceof AdminApiError ? error.message : "সংযোগের তথ্য যাচাই করা যায়নি। আবার চেষ্টা করুন।" },
  { status: error instanceof AdminApiError ? error.status : 503, headers });
}
export async function GET(request: Request) {
  try { return NextResponse.json({ status: await cloudinaryStatus(await requireAdmin(request)) }, { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const context = await requireAdmin(request);
    return NextResponse.json(await cloudinaryAction(context, await readAdminJson(request)), { headers });
  } catch (error) { return failure(error); }
}
