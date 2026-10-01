'use strict';
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const offer = JSON.parse(fs.readFileSync('lib/catalog-offer.json', 'utf8'));
const checks = [], errors = [];
let mockedOrders = 0, popupCount = 0;
fs.mkdirSync('verification', { recursive: true });
const pass = (text) => { checks.push(text); console.log('MOBILE_ORDER_PASS', text); };
const priceText = (n) => new Intl.NumberFormat('bn-BD').format(n);
const settle = (p) => p.locator('.av[data-catalog-state="ready"]').waitFor({ timeout: 30000 });
const close = (p) => p.locator('dialog[open] .av-dialog-head button').click();
const shot = (p, name) => p.screenshot({ path: `verification/${name}.png`, fullPage: false });
async function noOverflow(p) {
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'page fits viewport');
  assert(await p.evaluate(() => [...document.querySelectorAll('dialog[open]')].every((d) => d.scrollWidth <= d.clientWidth + 2)), 'dialog fits viewport');
}
async function usable(locator, minHeight = 44) {
  await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox();
  assert(box && box.height >= minHeight, 'touch target is large enough');
  assert(await locator.evaluate((el) => { const r = el.getBoundingClientRect(); const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return target === el || el.contains(target); }), 'touch target is not covered');
}
function observe(p) { p.on('pageerror', (e) => errors.push(e.message)); p.on('popup', () => popupCount++); }
// Only catalog/quote reads use the actual backend. Final order POSTs are mocked.
async function protect(context) {
  let quote = null, payload = null;
  await context.route('**/api/checkout/quote', async (route) => {
    const response = await route.fetch(); const data = await response.json();
    if (response.ok() && data.success) quote = data;
    await route.fulfill({ response });
  });
  await context.route('**/api/checkout', async (route) => {
    assert.equal(route.request().method(), 'POST'); payload = route.request().postDataJSON();
    assert(quote && payload.quoteHash === quote.quoteHash); assert.equal(payload.consent, true);
    assert(payload.name.startsWith('AUTOMATED UI TEST')); assert(payload.address.includes('NOT A REAL ORDER'));
    mockedOrders++;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...quote, success: true, orderId: 'TEST-NOT-A-REAL-ORDER', notificationSent: false }) });
  });
  return { payload: () => payload };
}
async function fillAddress(p, label, mobile = true) {
  await p.locator('.av-premium-form').waitFor();
  await p.locator('input[name="name"]').fill(`AUTOMATED UI TEST ${label}`);
  await p.locator('input[name="phone"]').fill('01987744985');
  await p.locator('input[name="district"]').fill('TEST DISTRICT');
  await p.locator('textarea[name="address"]').fill('AUTOMATED UI VERIFICATION - NOT A REAL ORDER - DO NOT SHIP');
  if (mobile) assert(await p.locator('input[name="phone"]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16));
}
(async () => {
  const browser = await chromium.launch();
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const fixture = await protect(desktop); const dp = await desktop.newPage(); observe(dp);
    const response = await dp.request.get(`${base}/api/catalog`); assert.equal(response.status(), 200);
    const catalog = await response.json();
    for (const item of offer.products) {
      const record = catalog.products.find((p) => p.id === item.id);
      assert(record && record.price === 1190 && record.oldPrice === 2500 && record.available);
    }
    pass('Live catalog has all three approved BDT 1190 sale / BDT 2500 previous prices');
    await dp.goto(`${base}/#shop`); await settle(dp);
    for (const item of offer.products) {
      const card = dp.locator(`[data-product-id="${item.id}"]`).first();
      assert((await card.locator('.av-card-bottom strong').textContent()).includes(priceText(1190)));
      assert((await card.locator('.av-card-bottom del').textContent()).includes(priceText(2500)));
      assert.equal(await card.locator('.av-purchase-actions button').count(), 2);
    }
    await dp.locator('#shop').scrollIntoViewIfNeeded(); await shot(dp, 'priced-catalog-desktop');
    pass('Cards show correct prices, crossed-out original price, Buy Now and Add to Cart');
    await dp.locator('[data-product-id="aven-blue-shawl"] .av-add-to-bag').first().click(); await close(dp);
    await dp.locator('[data-product-id="aven-golden-shawl"] .av-add-to-bag').first().click();
    assert.equal(await dp.locator('dialog[open] .av-bag-line').count(), 2);
    await dp.locator('.av-checkout-start').click(); await fillAddress(dp, 'DESKTOP', false);
    await dp.locator('.av-premium-form button[type="submit"]').click();
    await dp.locator('.av-review-step').waitFor({ timeout: 30000 });
    assert((await dp.locator('.av-review-total strong').textContent()).includes(priceText(2380)));
    await dp.locator('.av-consent input').check(); await dp.locator('.av-place-order').click();
    await dp.locator('.av-receipt').waitFor(); assert.equal(fixture.payload().items.length, 2);
    await shot(dp, 'website-receipt-desktop'); await close(dp);
    assert.equal((await dp.locator('.av-bag-count').textContent()).trim(), '0');
    pass('Multi-item website checkout uses live quote and sends complete customer fields to mocked save');
    await desktop.close();
    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await protect(context); const p = await context.newPage(); observe(p);
      await p.goto(`${base}/#shop`); await settle(p); await noOverflow(p);
      const card = p.locator('[data-product-id="aven-rose-shawl"]').first();
      await usable(card.locator('.av-purchase-actions button').first(), 52);
      if (width === 390) await shot(p, 'priced-product-mobile-390');
      await card.locator('.av-add-to-bag').click(); await p.locator('.av-bag-shell').waitFor(); await noOverflow(p);
      await close(p); await p.reload(); await settle(p);
      assert.equal((await p.locator('.av-bag-count').textContent()).trim(), '1');
      await p.locator('[data-product-id="aven-rose-shawl"] .av-card-image').first().click();
      await settle(p); await p.locator('.av-detail-title').waitFor(); await noOverflow(p);
      await usable(p.locator('.av-mobile-order .av-btn-gold'), 48);
      await p.locator('.av-mobile-order .av-btn-gold').click(); await p.locator('.av-premium-form').waitFor();
      assert.equal(await p.locator('[data-order-mode="inquiry"]').count(), 0);
      await noOverflow(p); await fillAddress(p, `MOBILE-${width}`);
      assert((await p.locator('.av-order-total-preview strong').textContent()).includes(priceText(1190)));
      await usable(p.locator('.av-premium-form button[type="submit"]'), 52);
      if (width === 390) { await p.locator('dialog[open]').evaluate((d) => d.scrollTo(0, 0)); await shot(p, 'website-address-mobile-390'); }
      await p.locator('.av-premium-form button[type="submit"]').click(); await p.locator('.av-review-step').waitFor({ timeout: 30000 });
      assert((await p.locator('.av-review-total strong').textContent()).includes(priceText(1190))); await noOverflow(p);
      if (width === 390) {
        await p.locator('.av-review-total').scrollIntoViewIfNeeded(); await shot(p, 'website-review-mobile-390');
        await p.locator('.av-consent input').check(); await usable(p.locator('.av-place-order'), 52);
        await p.locator('.av-place-order').click(); await p.locator('.av-receipt').waitFor();
        await shot(p, 'website-receipt-mobile-390'); pass('Mobile website receipt completes with mocked save response');
      }
      await close(p); assert.equal((await p.locator('.av-bag-count').textContent()).trim(), '1');
      pass(`Chromium ${width}px: visible controls, cart persistence, on-site form/review, 16px inputs, no overflow, direct Buy Now preserves bag`);
      await context.close();
    }
    const safari = await webkit.launch();
    try {
      const context = await safari.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await protect(context); const p = await context.newPage(); observe(p);
      await p.goto(`${base}/product/aven-blue-shawl`); await settle(p); await noOverflow(p);
      await p.locator('.av-mobile-order .av-btn-gold').click(); await fillAddress(p, 'WEBKIT');
      await p.locator('.av-premium-form button[type="submit"]').click(); await p.locator('.av-review-step').waitFor({ timeout: 30000 });
      await noOverflow(p); await p.locator('.av-consent input').check(); await usable(p.locator('.av-place-order'), 52);
      await shot(p, 'website-review-webkit-390'); await p.locator('.av-place-order').click(); await p.locator('.av-receipt').waitFor(); await close(p);
      pass('WebKit mobile emulation: real catalog/quote, touch form, mocked receipt'); await context.close();
    } finally { await safari.close(); }
    const offline = await browser.newContext({ viewport: { width: 390, height: 844 } }); await protect(offline);
    await offline.route('**/api/catalog', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, products: [] }) }));
    const op = await offline.newPage(); observe(op); await op.goto(base); await op.locator('.av[data-catalog-state="unavailable"]').waitFor();
    assert.equal(await op.locator('#shop .av-product-card .av-purchase-actions').count(), 0);
    pass('Catalog outage is visible and stale inventory is not offered for purchase'); await offline.close();
    assert.equal(popupCount, 0); assert.deepEqual(errors, []);
    pass('No page errors or WhatsApp popups; no live orders or notifications');
  } finally {
    await browser.close();
    fs.writeFileSync('verification/mobile-order-results.json', JSON.stringify({ checks, realCatalogAndQuoteReads: true, liveOrdersSubmitted: 0, mockedOrderSubmissions: mockedOrders, browserErrors: errors, popupCount }, null, 2));
  }
  console.log(`MOBILE_ORDER_RESULT ${checks.length} checks passed; live orders: 0; mocked saves: ${mockedOrders}`);
})().catch((error) => { console.error(error.stack); fs.writeFileSync('verification/mobile-order-failure.txt', String(error.stack)); process.exitCode = 1; });
