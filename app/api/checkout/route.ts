import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { validateCheckout } from "@/lib/commerce";
import { CheckoutError, failure, loadQuote, notifyOrder, readCheckoutBody } from "@/lib/commerce-server";
import { createPublicOrderDocument, FirestoreCreateError } from "@/lib/firestore-rest";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const raw = await readCheckoutBody(request);
    let input;
    try {
      input = validateCheckout(raw);
    } catch (error) {
      throw new CheckoutError(error instanceof Error ? error.message : "তথ্য যাচাই করুন।");
    }

    const quote = await loadQuote(input.items);
    if (quote.quoteHash !== input.quoteHash) {
      throw new CheckoutError("পণ্যের দাম বা তথ্য বদলেছে। নতুন হিসাব দেখে আবার নিশ্চিত করুন।", 409, "QUOTE_CHANGED");
    }

    const { requestId, quoteHash: _quoteHash, items: _items, consent: _consent, ...customer } = input;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ ...customer, items: input.items, quoteHash: input.quoteHash }))
      .digest("hex");

    const orderId = `AVEN-${requestId}`;
    const payload = {
      ...customer,
      items: quote.items,
      product: quote.items.map((item) => `${item.name} × ${item.quantity}`).join(" · "),
      productId: quote.items.length === 1 ? quote.items[0].productId : "",
      color: quote.items.map((item) => item.color || "—").join(" / "),
      quantity: quote.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: quote.subtotal,
      deliveryCharge: null,
      paymentStatus: "Not collected",
      status: "Pending",
      fingerprint,
      checkoutQuote: quote,
      source: "aven-shopping-bag",
      createdAt: new Date(),
    };

    let duplicate = false;
    try {
      await createPublicOrderDocument(orderId, payload);
    } catch (error) {
      if (error instanceof FirestoreCreateError && error.alreadyExists) duplicate = true;
      else throw error;
    }

    const notificationSent = duplicate ? false : await notifyOrder([
      "NEW AVEN ORDER",
      `Reference: ${orderId}`,
      ...quote.items.map((item, index) => `${index + 1}. ${item.name}\nColor: ${item.color || "—"} · Qty: ${item.quantity} · BDT ${item.lineTotal}`),
      `Subtotal: BDT ${quote.subtotal}`,
      "Delivery charge: to be confirmed",
      "Payment: NOT COLLECTED",
      `Customer: ${input.name}`,
      `Phone: ${input.phone}`,
      `District: ${input.district}`,
      `Address: ${input.address}`,
      input.note ? `Note: ${input.note}` : "",
      "Status: Pending",
    ].filter(Boolean).join("\n"));

    return NextResponse.json({
      success: true,
      orderId,
      ...quote,
      duplicate,
      notificationSent,
    }, {
      status: duplicate ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
