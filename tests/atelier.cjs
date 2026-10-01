/* Run: node tests/atelier.cjs. No real database writes or external messages. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const tests = [];
const test = (name, run) => tests.push({ name, run });
function compile(file) {
  const result = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${file}: ${errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')}`);
  return result.outputText;
}
function load(file, mocks = {}, extras = {}) {
  const module = { exports: {} };
  const resolve = (id) => { if (id in mocks) return mocks[id]; if (id.startsWith('node:')) return require(id); throw new Error(`Unmocked dependency: ${id}`); };
  new Function('require', 'module', 'exports', 'fetch', 'process', 'console', compile(file))(
    resolve, module, module.exports,
    extras.fetch || (async () => { throw new Error('Network calls are disabled in tests'); }),
    { env: extras.env || {} }, { ...console, error: () => {} },
  );
  return module.exports;
}
const lib = load('lib/atelier.ts');
const baseProduct = { name: 'AVEN Test Shawl', category: 'Shawl', price: 1250, oldPrice: 1500,
  mainImage: '/products/pink.png', colors: [{ name: 'Pink', image: '/products/pink.png' }] };
const valid = (overrides = {}) => ({ productId: 'p1', name: 'Test Customer', phone: '01987744985', district: 'Dhaka',
  address: 'Test address, road 10, Dhaka', color: 'Pink', quantity: 2, requestId: crypto.randomUUID(), ...overrides });

for (const input of ['01987744985', '+8801987744985', '8801987744985', '০১৯৮৭৭৪৪৯৮৫', '01987-744985']) {
  test(`phone normalization: ${input}`, () => assert.equal(lib.normalizePhone(input), '01987744985'));
}
test('WhatsApp uses the supplied business number', () => assert.equal(new URL(lib.whatsappLink('hello')).pathname, '/8801987744985'));
test('WhatsApp preserves Unicode and reserved characters', () => {
  const message = 'রঙ: নীল & gold + 2\nDetails?'; assert.equal(new URL(lib.whatsappLink(message)).searchParams.get('text'), message);
});
test('product links encode the product ID', () => {
  const p = lib.normalizeProduct('product 1', baseProduct); assert.ok(lib.productMessage(p, 'Pink', 2).includes('/product/product%201'));
});
test('invalid image schemes have a local fallback', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//evil.example/a', 'http://example.com/a', null]) assert.equal(lib.safeImage(url), '/products/pink.png');
});
test('HTTPS uploaded images stay usable', () => assert.equal(lib.safeImage('https://firebasestorage.googleapis.com/test.png'), 'https://firebasestorage.googleapis.com/test.png'));
test('missing numeric product fields stay finite', () => { const p = lib.normalizeProduct('p', { price: 'bad', oldPrice: -4 }); assert.equal(p.price, 0); assert.equal(p.oldPrice, 0); });
test('legacy product without createdAt stays valid', () => assert.equal(lib.normalizeProduct('p', baseProduct).createdAt, 0));
test('duplicate and malformed colors are removed', () => {
  const p = lib.normalizeProduct('p', { ...baseProduct, colors: [null, 'bad', { name: '' }, { name: 'Pink' }, { name: 'Pink' }] }); assert.equal(p.colors.length, 1);
});
test('discount is derived from price, not a fake percentage', () => assert.equal(lib.discountPercent(lib.normalizeProduct('p', { ...baseProduct, discount: 99 })), 17));
test('no discount at equal prices', () => assert.equal(lib.discountPercent(lib.normalizeProduct('p', { price: 100, oldPrice: 100 })), 0));
test('stock zero is unavailable', () => assert.equal(lib.normalizeProduct('p', { ...baseProduct, stock: 0 }).available, false));
test('valid form normalizes phone', () => assert.equal(lib.validateOrder(valid({ phone: '+8801987744985' })).phone, '01987744985'));
for (const [field, value] of [['quantity', 0], ['quantity', 21], ['quantity', 1.5], ['quantity', 'abc'], ['phone', '01234567890'], ['phone', 'not-a-phone'], ['name', 'x'], ['address', 'short'], ['district', 'x'], ['productId', 'bad/path'], ['requestId', 'not-a-uuid']]) {
  test(`reject invalid ${field}: ${value}`, () => assert.throws(() => lib.validateOrder(valid({ [field]: value }))));
}
test('unexpected client price and status fields are stripped', () => { const input = lib.validateOrder(valid({ price: 1, status: 'Delivered' })); assert.equal(input.price, undefined); assert.equal(input.status, undefined); });

function harness(options = {}) {
  const records = new Map([['products/p1', { ...baseProduct, ...(options.product || {}) }]]);
  let writes = 0;
  let notifications = 0;
  const ref = (_, group, id) => ({ id, path: `${group}/${id}` });
  const snapshot = (reference) => ({ id: reference.id, exists: () => records.has(reference.path), data: () => records.get(reference.path) });
  const firestore = {
    doc: ref, serverTimestamp: () => 'TEST_TIMESTAMP',
    getDoc: async (reference) => { if (options.settingsError) throw new Error('permission-denied'); return snapshot(reference); },
    runTransaction: async (_, run) => {
      if (options.databaseError) throw new Error('permission-denied');
      const pending = [];
      const result = await run({ get: async (reference) => snapshot(reference), set: (reference, value) => pending.push([reference.path, value]) });
      for (const [key, value] of pending) { records.set(key, value); writes++; }
      return result;
    },
  };
  const route = load('app/api/order/route.ts', {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    'firebase/firestore': firestore, '@/lib/firebase': { db: {} }, '@/lib/atelier': lib,
  }, {
    env: options.env || {},
    fetch: async () => { notifications++; if (options.notificationError) throw new Error('notification unavailable'); return Response.json({ ok: true }); },
  });
  let ip = 0;
  const request = async (body, headers = {}) => {
    const response = await route.POST(new Request('https://aven-website.vercel.app/api/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `test-${++ip}`, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }));
    return { status: response.status, data: await response.json() };
  };
  return { request, records, writes: () => writes, notifications: () => notifications };
}
test('order uses server price and returns reference after saving', async () => {
  const h = harness(); const input = valid({ price: 1, product: 'Spoofed' }); const r = await h.request(input);
  assert.equal(r.status, 201); assert.equal(r.data.success, true); assert.equal(r.data.subtotal, 2500);
  const saved = h.records.get(`orders/AVEN-${input.requestId}`); assert.equal(saved.product, baseProduct.name); assert.equal(saved.unitPrice, 1250); assert.equal(saved.status, 'Pending'); assert.equal(saved.deliveryCharge, null);
});
test('retry with identical request creates only one order', async () => {
  const h = harness(); const input = valid(); await h.request(input); const r = await h.request(input);
  assert.equal(r.status, 200); assert.equal(r.data.duplicate, true); assert.equal(h.writes(), 1);
});
test('changed payload cannot reuse an idempotency key', async () => {
  const h = harness(); const input = valid(); await h.request(input); const r = await h.request({ ...input, quantity: 3 }); assert.equal(r.status, 409); assert.equal(h.writes(), 1);
});
test('missing product does not save an order', async () => { const h = harness(); const r = await h.request(valid({ productId: 'missing' })); assert.equal(r.status, 404); assert.equal(h.writes(), 0); });
test('unavailable product is rejected', async () => { const h = harness({ product: { stock: 0 } }); assert.equal((await h.request(valid())).status, 409); });
test('unknown color is rejected', async () => { const h = harness(); assert.equal((await h.request(valid({ color: 'Unknown' }))).status, 400); assert.equal(h.writes(), 0); });
test('malformed JSON is rejected', async () => { const h = harness(); assert.equal((await h.request('{oops')).status, 400); });
test('foreign browser origin is rejected', async () => { const h = harness(); assert.equal((await h.request(valid(), { Origin: 'https://other.example' })).status, 403); });
test('matching origin is accepted', async () => { const h = harness(); assert.equal((await h.request(valid(), { Origin: 'https://aven-website.vercel.app' })).status, 201); });
test('wrong content type is rejected', async () => { const h = harness(); assert.equal((await h.request(valid(), { 'Content-Type': 'text/plain' })).status, 415); });
test('large declared request is rejected', async () => { const h = harness(); assert.equal((await h.request(valid(), { 'Content-Length': '99999' })).status, 413); });
test('large streamed body is bounded without content-length', async () => { const h = harness(); assert.equal((await h.request('x'.repeat(9000))).status, 413); });
test('database failure never displays success', async () => { const h = harness({ databaseError: true }); const r = await h.request(valid()); assert.equal(r.status, 503); assert.equal(r.data.success, false); });
test('missing Telegram configuration does not reject a saved order', async () => { const h = harness(); const r = await h.request(valid()); assert.equal(r.status, 201); assert.equal(r.data.notificationSent, false); });
test('Telegram settings permission failure does not lose the order', async () => { const h = harness({ settingsError: true }); assert.equal((await h.request(valid())).status, 201); assert.equal(h.writes(), 1); });
test('notification failure does not reject a saved order', async () => {
  const h = harness({ env: { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat' }, notificationError: true });
  const r = await h.request(valid()); assert.equal(r.status, 201); assert.equal(r.data.notificationSent, false); assert.equal(h.notifications(), 1);
});
test('successful notification is sent once, not again on retry', async () => {
  const h = harness({ env: { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat' } }); const input = valid();
  const first = await h.request(input); await h.request(input); assert.equal(first.data.notificationSent, true); assert.equal(h.notifications(), 1);
});
test('burst guard stops repeated requests within one instance', async () => {
  const h = harness(); let response;
  for (let i = 0; i < 13; i++) response = await h.request({}, { 'x-forwarded-for': 'burst-test' });
  assert.equal(response.status, 429);
});
test('new storefront source has valid TypeScript/TSX syntax', () => {
  for (const file of ['components/atelier/Primitives.tsx', 'components/atelier/CatalogProduct.tsx', 'components/atelier/Checkout.tsx', 'components/atelier/Sections.tsx', 'components/atelier/Storefront.tsx']) compile(file);
});

(async () => {
  let passed = 0;
  for (const { name, run } of tests) { try { await run(); passed++; } catch (error) { console.error(`FAIL: ${name}`); throw error; } }
  console.log(`AVEN: ${passed}/${tests.length} isolated checks passed. No live Firebase or Telegram requests were made.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
