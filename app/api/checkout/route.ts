import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { validateCheckout, type Quote } from "@/lib/commerce";
import { CheckoutError, failure, notifyOrder, quoteCatalog, readCheckoutBody } from "@/lib/commerce-server";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const raw = await readCheckoutBody(request);
    let input;
    try { input = validateCheckout(raw); } catch (error) { throw new CheckoutError(error instanceof Error ? error.message : "তথ্য যাচাই করুন।"); }
    const { requestId, ...payload } = input;
    const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const ref = doc(db, "orders", `AVEN-${requestId}`);
    const result = await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists()) {
        const data = existing.data();
        if (data.fingerprint !== fingerprint) throw new CheckoutError("একই রেফারেন্সের তথ্য বদলেছে। সহায়তার জন্য যোগাযোগ করুন।", 409, "REQUEST_CONFLICT");
        return { created: false, quote: data.checkoutQuote as Quote };
      }
      // Every catalog read must precede the single atomic order write.
      const catalog = new Map<string, Record<string, unknown>>();
      for (const id of [...new Set(input.items.map((line) => line.productId))]) {
        const snapshot = await transaction.get(doc(db, "products", id));
        if (snapshot.exists()) catalog.set(id, snapshot.data());
      }
      const quote = quoteCatalog(input.items, catalog);
      if (quote.quoteHash !== input.quoteHash) throw new CheckoutError("পণ্যের দাম বা তথ্য বদলেছে। নতুন হিসাব দেখে আবার নিশ্চিত করুন।", 409, "QUOTE_CHANGED");
      const { items: _items, quoteHash: _quoteHash, ...customer } = payload;
      transaction.set(ref, {
        ...customer, items: quote.items, product: quote.items.map((item) => `${item.name} × ${item.quantity}`).join(" · "),
        productId: quote.items.length === 1 ? quote.items[0].productId : "",
        color: quote.items.map((item) => item.color || "—").join(" / "),
        quantity: quote.items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: quote.subtotal, deliveryCharge: null, paymentStatus: "Not collected",
        status: "Pending", fingerprint, checkoutQuote: quote, source: "aven-shopping-bag",
        createdAt: serverTimestamp(),
      });
      return { created: true, quote };
    });
    const notificationSent = result.created ? await notifyOrder([
      "NEW AVEN ORDER", `Reference: ${ref.id}`,
      ...result.quote.items.map((item, index) => `${index + 1}. ${item.name}\nColor: ${item.color || "—"} · Qty: ${item.quantity} · BDT ${item.lineTotal}`),
      `Subtotal: BDT ${result.quote.subtotal}`, "Delivery charge: to be confirmed", "Payment: NOT COLLECTED",
      `Customer: ${input.name}`, `Phone: ${input.phone}`, `District: ${input.district}`,
      `Address: ${input.address}`, input.note ? `Note: ${input.note}` : "", "Status: Pending",
    ].filter(Boolean).join("\n")) : false;
    return NextResponse.json({ success: true, orderId: ref.id, ...result.quote, duplicate: !result.created, notificationSent },
      { status: result.created ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
