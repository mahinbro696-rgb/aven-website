import { NextResponse } from "next/server";
import { validateLines } from "@/lib/commerce";
import { CheckoutError, failure, loadQuote, readCheckoutBody } from "@/lib/commerce-server";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const raw = await readCheckoutBody(request);
    let lines;
    try { lines = validateLines(raw.items); } catch (error) { throw new CheckoutError(error instanceof Error ? error.message : "পণ্য নির্বাচন করুন।"); }
    const quote = await loadQuote(lines);
    return NextResponse.json({ success: true, ...quote }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
