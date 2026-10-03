/* Offline regression suite. No live Firebase writes or Telegram messages. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { randomUUID } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const records = new Map();
let writes = 0, sends = 0, failDatabase = false, failNotification = false;
let transactionQueue = Promise.resolve();
let orderWriteQueue = Promise.resolve();
const requestFingerprints = new Map();
const snapshot = (ref) => ({ id: ref.id, exists: () => records.has(ref.path), data: () => records.get(ref.path) });
const firebase = {
  doc: (_, collection, id) => ({ id, path: `${collection}/${id}` }),
  getDoc: async (ref) => { if (failDatabase) throw new Error("permission-denied"); return snapshot(ref); },
  serverTimestamp: () => "SERVER_TIMESTAMP",
  runTransaction: (_, callback) => {
    const result = transactionQueue.catch(() => {}).then(async () => {
      if (failDatabase) throw new Error("permission-denied");
      const pending = [];
      const value = await callback({
        get: async (ref) => { assert.equal(pending.length, 0, "all reads must precede writes"); return snapshot(ref); },
        set: (ref, data) => pending.push([ref, data]),
      });
      pending.forEach(([ref, data]) => { records.set(ref.path, data); writes++; });
      return value;
    });
    transactionQueue = result;
    return result;
  },
};
class FirestoreCreateError extends Error {
  constructor(message, status, alreadyExists = false, conflict = false) {
    super(message);
    this.status = status;
    this.alreadyExists = alreadyExists;
    this.conflict = conflict;
  }
}
const orderWriter = {
  FirestoreCreateError,
  createPublicOrderDocument: (orderId, data, fingerprint) => {
    const result = orderWriteQueue.catch(() => {}).then(async () => {
      if (failDatabase) throw new FirestoreCreateError("database unavailable", 503);
      const requestId = orderId.replace(/^AVEN-/, "");
      const existing = requestFingerprints.get(requestId);
      if (existing) {
        if (existing === fingerprint) return { duplicate: true };
        throw new FirestoreCreateError("payload conflict", 409, true, true);
      }
      requestFingerprints.set(requestId, fingerprint);
      records.set(`orders/${orderId}`, data);
      writes++;
      return { duplicate: false };
    });
    orderWriteQueue = result;
    return result;
  },
};
const cache = new Map();
const capturedLogs = [];
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true, fileName: filename });
  const errors = (compiled.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${relative} parses without errors`);
  const module = { exports: {} }; cache.set(filename, module);
  const localRequire = (name) => {
    if (name === "firebase/firestore") return firebase;
    if (name === "@/lib/firebase") return { db: {} };
    if (name === "@/lib/firestore-rest") return orderWriter;
    if (name === "next/server") return { NextResponse: { json: (data, options) => new Response(JSON.stringify(data), { ...options, headers: { "Content-Type": "application/json", ...options?.headers } }) } };
    if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`);
    if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)));
    return require(name);
  };
  const run = vm.runInThisContext(`(function(require,module,exports,fetch,console){${compiled.outputText}\n})`, { filename });
  run(localRequire, module, module.exports, async () => { sends++; if (failNotification) throw new Error("notification failed"); return new Response(JSON.stringify({ ok: true })); }, { error: (...args) => capturedLogs.push(args.join(" ")) });
  return module.exports;
}
const commerce = load("lib/commerce.ts");
const server = load("lib/commerce-server.ts");
const checkout = load("app/api/checkout/route.ts");
const quoteRoute = load("app/api/checkout/quote/route.ts");
process.env.TELEGRAM_BOT_TOKEN = "TEST_NOT_A_REAL_TOKEN";
process.env.TELEGRAM_CHAT_ID = "TEST_NOT_A_REAL_CHAT";
const line = (productId = "shawl", color = "Rose", quantity = 1) => ({ productId, color, quantity });
const customer = { name: "Test Buyer", phone: "01987744985", district: "Dhaka", address: "House 12 Road 3 Test Address", note: "" };
let n = 0, passed = 0;
const request = (body, extra = {}) => new Request("https://example.test/api/checkout", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `test-${++n}`, ...extra }, body: typeof body === "string" ? body : JSON.stringify(body) });
function fixture() {
  records.clear(); requestFingerprints.clear(); writes = 0; sends = 0; failDatabase = false; failNotification = false; orderWriteQueue = Promise.resolve();
  records.set("products/shawl", { name: "Signature Shawl", price: 999.95, category: "Shawl", mainImage: "/products/pink.png", stock: 20, colors: [{ name: "Rose", image: "/products/pink.png", stock: 15 }, { name: "Blue", image: "/products/Blue.png", stock: 5 }] });
  records.set("products/jamdani", { name: "Jamdani", price: 1500, mainImage: "/products/Yellow.png", colors: [], available: true });
}
async function payload(items = [line(), line("jamdani", "", 2)]) {
  const quote = await server.loadQuote(commerce.validateLines(items));
  return { ...customer, items, consent: true, requestId: randomUUID(), quoteHash: quote.quoteHash };
}
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
(async () => {
  await test("cart merges the same product and colour", () => assert.equal(commerce.addLine([line()], line()).at(0).quantity, 2));
  await test("different colours remain separate", () => assert.equal(commerce.addLine([line()], line("shawl", "Blue")).length, 2));
  await test("colour changes merge matching lines", () => assert.equal(commerce.changeLine([line(), line("shawl", "Blue", 2)], commerce.lineKey(line("shawl", "Blue")), { color: "Rose" }).at(0).quantity, 3));
  await test("quantity ceiling is enforced", () => assert.throws(() => commerce.addLine([line("shawl", "Rose", 20)], line())));
  await test("line and unit limits are enforced", () => { assert.throws(() => commerce.validateLines(Array.from({ length: 13 }, (_, i) => line(String(i))))); assert.throws(() => commerce.validateLines(Array.from({ length: 4 }, (_, i) => line(String(i), "", 20)))); });
  await test("zero, negative, fractional and string quantities are rejected", () => { for (const value of [0, -1, 1.2, "2", NaN]) assert.throws(() => commerce.validateLines([{ ...line(), quantity: value }])); });
  await test("corrupt or malicious stored bags are discarded", () => { assert.deepEqual(commerce.readBag("{bad"), []); assert.deepEqual(commerce.readBag(JSON.stringify([line("../bad")])), []); });
  await test("stored prices cannot override authoritative data", () => { const cleaned = commerce.validateLines([{ ...line(), price: 1, subtotal: 1 }])[0]; assert.equal(cleaned.price, undefined); });
  await test("checkout clears only purchased quantities", () => assert.equal(commerce.removePurchased([line("shawl", "Rose", 4), line("shawl", "Blue")], [line("shawl", "Rose", 2)])[0].quantity, 2));
  await test("Bangla and international phone inputs normalize", () => { assert.equal(commerce.validateCustomer({ ...customer, phone: "+880 1987-744985" }).phone, customer.phone); assert.equal(commerce.validateCustomer({ ...customer, phone: "০১৯৮৭৭৪৪৯৮৫" }).phone, customer.phone); });
  await test("invalid phone, missing address and missing consent fail", () => { assert.throws(() => commerce.validateCustomer({ ...customer, phone: "123" })); assert.throws(() => commerce.validateCustomer({ ...customer, address: "" })); assert.throws(() => commerce.validateCheckout({ ...customer, consent: false })); });
  fixture();
  await test("server quote performs integer-money arithmetic", async () => { const q = await server.loadQuote([line("shawl", "Rose", 3)]); assert.equal(q.subtotal, 2999.85); });
  await test("server reads current catalog prices", async () => { const q = await server.loadQuote([line()]); assert.equal(q.items[0].unitPrice, 999.95); records.get("products/shawl").price = 1100; const next = await server.loadQuote([line()]); assert.equal(next.subtotal, 1100); assert.notEqual(q.quoteHash, next.quoteHash); });
  fixture();
  await test("stock is validated across variants", async () => { await assert.rejects(() => server.loadQuote([line("shawl", "Rose", 15), line("shawl", "Blue", 6)])); });
  await test("colour stock, invalid colour and missing product are rejected", async () => { await assert.rejects(() => server.loadQuote([line("shawl", "Blue", 6)])); await assert.rejects(() => server.loadQuote([line("shawl", "Invalid")])); await assert.rejects(() => server.loadQuote([line("missing")])); });
  await test("quote endpoint returns no-store verified totals", async () => { const response = await quoteRoute.POST(request({ items: [line()] })); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal((await response.json()).subtotal, 999.95); });
  await test("multiple products are saved atomically in one order", async () => { const input = await payload(); const response = await checkout.POST(request(input)); const result = await response.json(); assert.equal(response.status, 201); assert.equal(result.subtotal, 3999.95); assert.equal(writes, 1); const order = records.get(`orders/${result.orderId}`); assert.equal(order.items.length, 2); assert.equal(order.quantity, 3); assert.equal(order.status, "Pending"); assert.equal(order.paymentStatus, "Not collected"); assert.equal(order.deliveryCharge, null); assert.equal(order.name, customer.name); });
  fixture();
  await test("same request retry creates only one order and notification", async () => { const input = await payload(); const first = await checkout.POST(request(input)); const second = await checkout.POST(request(input)); assert.equal(first.status, 201); assert.equal(second.status, 200); assert.equal((await second.json()).duplicate, true); assert.equal(writes, 1); assert.equal(sends, 1); });
  fixture();
  await test("concurrent identical requests are idempotent", async () => { const input = await payload(); const results = await Promise.all([checkout.POST(request(input)), checkout.POST(request(input))]); assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]); assert.equal(writes, 1); assert.equal(sends, 1); });
  fixture();
  await test("same reference with altered data is rejected", async () => { const input = await payload(); await checkout.POST(request(input)); const response = await checkout.POST(request({ ...input, note: "Changed" })); assert.equal(response.status, 409); assert.equal((await response.json()).code, "REQUEST_CONFLICT"); assert.equal(writes, 1); });
  fixture();
  await test("price changes require explicit re-quotation", async () => { const input = await payload(); records.get("products/shawl").price = 2000; const response = await checkout.POST(request(input)); assert.equal(response.status, 409); assert.equal((await response.json()).code, "QUOTE_CHANGED"); assert.equal(writes, 0); });
  fixture();
  await test("catalog removal cannot partially save a basket", async () => { const input = await payload(); records.delete("products/jamdani"); const response = await checkout.POST(request(input)); assert.equal(response.status, 409); assert.equal(writes, 0); });
  fixture();
  await test("notification failure does not invalidate a saved order", async () => { failNotification = true; const response = await checkout.POST(request(await payload())); assert.equal(response.status, 201); assert.equal((await response.json()).notificationSent, false); assert.equal(writes, 1); });
  fixture();
  await test("database failures are not reported as order success", async () => { const input = await payload(); failDatabase = true; const response = await checkout.POST(request(input)); assert.equal(response.status, 503); assert.equal(writes, 0); assert.ok(!capturedLogs.join(" ").includes(customer.address)); failDatabase = false; });
  await test("invalid JSON and object structure are rejected", async () => { assert.equal((await checkout.POST(request("{bad"))).status, 400); assert.equal((await checkout.POST(request([]))).status, 400); });
  await test("cross-origin and cross-site browser requests are rejected", async () => { assert.equal((await checkout.POST(request({}, { origin: "https://other.test" }))).status, 403); assert.equal((await checkout.POST(request({}, { "sec-fetch-site": "cross-site" }))).status, 403); });
  await test("incorrect content types and oversized bodies are rejected", async () => { assert.equal((await checkout.POST(request({}, { "Content-Type": "text/plain" }))).status, 415); assert.equal((await checkout.POST(request({ padding: "x".repeat(20000) }))).status, 413); });
  await test("all commerce TSX files parse", () => {
    for (const name of ["CommerceState", "BagItems", "ShoppingBag", "CheckoutExperience", "CatalogProduct", "Storefront"]) {
      const fileName = `${root}/components/atelier/${name}.tsx`;
      const result = ts.transpileModule(fs.readFileSync(fileName, "utf8"), { fileName, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
      assert.equal((result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0, name);
    }
  });
  console.log(`\n${passed} commerce regression tests passed. All external writes mocked.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
