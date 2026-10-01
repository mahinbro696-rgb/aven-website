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
const settle = (page) => page.locator('.av[data-catalog-state="ready"]').waitFor({ timeout: 30000 });
const close = (page) => page.locator('dialog[open] .av-dialog-head button').click();
const shot = (page, name) => page.screenshot({ path: `verification/${name}.png`, fullPage: false });
async function noOverflow(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'page fits viewport');
  assert(await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].every((d) => d.scrollWidth <= d.clientWidth + 2)), 'dialog fits viewport');
}
async function usable(locator, minHeight = 44) {
  await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox();
  assert(box && box.height >= minHeight, 'visible touch target is large enough');
  assert(await locator.evaluate((el) => { const r = el.getBoundingClientRect(); const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return target === el || el.contains(target); }), 'touch target is not covered');
}
function observe(page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('popup', () => popupCount++);
}
// Real catalog and quote reads. Every final order POST is intercepted BEFORE
// reaching the application: no customer records, notifications or payments.
async function protect(context) {
  let quote = null, lastPayload = null;
  await context.route('**/api/checkout/quote', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    if (response.ok() && data.success) quote = data;
    await route.fulfill({ response });
  });
  await context.route('**/api/checkout', async (route) => {
    assert.equal(route.request().method(), 'POST');
    lastPayload = route.request().postDataJSON();
    assert(quote && lastPayload.quoteHash === quote.quoteHash);
    assert.equal(lastPayload.consent, true);
    assert(lastPayload.name.startsWith('AUTOMATED UI TEST'));
    assert(lastPayload.address.includes('NOT A REAL ORDER'));
    mockedOrders++;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...quote, success: true, orderId: 'TEST-NOT-A-REAL-ORDER', notificationSent: false }) });
  });
  return { getPayload: () => lastPayload };
}
async function fillAddress(page, label, mobile = true) {
  await page.locator('.av-premium-form').waitFor();
  await page.locator('input[name="name"]').fill(`AUTOMATED UI TEST ${label}`);
  await page.locator('input[name="phone"]').fill('01987744985');
  await page.locator('input[name="district"]').fill('TEST DISTRICT');
  await page.locator('textarea[name="address"]').fill('AUTOMATED UI VERIFICATION - NOT A REAL ORDER - DO NOT SHIP');
  if (mobile) assert(await page.locator('input[name="phone"]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16));
}
(async () => {
  const browser = await chromium.launch();
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const fixture = await protect(desktop);
    const page = await desktop.newPage(); observe(page);
    const response = await page.request.get(`${base}/api/catalog`);
    assert.equal(response.status(), 200); const catalog = await response.json();
    for (const expected of offer.products) {
      const record = catalog.products.find((p) => p.id === expected.id);
      assert(record && record.price === 1190 && record.oldPrice === 2500 && record.available);
    }
    pass('Live catalog contains three published products at BDT 1190 with previous price BDT 2500');
    await page.goto(`${base}/#shop`); await settle(page);
    for (const item of offer.products) {
      const card = page.locator(`[data-product-id="${item.id}"]`).first();
      assert((await card.locator('.av-card-bottom strong').textContent()).includes(priceText(1190)));
      assert((await card.locator('.av-card-bottom del').textContent()).includes(priceText(2500)));
      assert.equal(await card.locator('.av-purchase-actions button').count(), 2);
    }
    await page.locator('#shop').scrollIntoViewIfNeeded(); await shot(page, 'priced-catalog-desktop');
    pass('All cards show the sale price, struck-through old price, Buy Now and Add to Cart');
    await page.locator('[data-product-id="aven-blue-shawl"] .av-add-to-bag').first().click(); await close(page);
    await page.locator('[data-product-id="aven-golden-shawl"] .av-add-to-bag').first().click();
    assert.equal(await page.locator('dialog[open] .av-bag-line').count(), 2);
    await page.locator('.av-checkout-start').click(); await fillAddress(page, 'DESKTOP', false);
    await page.locator('.av-premium-form button[type="submit"]').click();
    await page.locator('.av-review-step').waitFor({ timeout: 30000 });
    assert((await page.locator('.av-review-total strong').textContent()).includes(priceText(2380)));
    await page.locator('.av-consent input').check(); await page.locator('.av-place-order').click();
    await page.locator('.av-receipt').waitFor(); assert.equal(fixture.getPayload().items.length, 2);
    await shot(page, 'website-receipt-desktop'); await close(page);
    assert.equal((await page.locator('.av-bag-count').textContent()).trim(), '0');
    pass('Multi-item checkout validates the live quote and submits name/address/phone to the intercepted order endpoint');
    await desktop.close();

    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await protect(context);
      const page = await context.newPage(); observe(page);
      await page.goto(`${base}/#shop`); await settle(page); await noOverflow(page);
      const card = page.locator('[data-product-id="aven-rose-shawl"]').first();
      await usable(card.locator('.av-purchase-actions button').first(), 52);
      if (width === 390) await shot(page, 'priced-product-mobile-390');
      await card.locator('.av-add-to-bag').click(); await page.locator('.av-bag-shell').waitFor(); await noOverflow(page);
      await close(page); await page.reload(); await settle(page);
      assert.equal((await page.locator('.av-bag-count').textContent()).trim(), '1');
      await page.locator('[data-product-id="aven-rose-shawl"] .av-card-image').first().click();
      await settle(page); await page.locator('.av-detail-title').waitFor(); await noOverflow(page);
      await usable(page.locator('.av-mobile-order .av-btn-gold'), 48);
      await page.locator('.av-mobile-order .av-btn-gold').click();
      await page.locator('.av-premium-form').waitFor();
      assert.equal(await page.locator('[data-order-mode="inquiry"]').count(), 0);
      await noOverflow(page); await fillAddress(page, `MOBILE-${width}`);
      assert((await page.locator('.av-order-total-preview strong').textContent()).includes(priceText(1190)));
      await usable(page.locator('.av-premium-form button[type="submit"]'), 52);
      if (width === 390) { await page.locator('dialog[open]').evaluate((d) => d.scrollTo(0, 0)); await shot(page, 'website-address-mobile-390'); }
      await page.locator('.av-premium-form button[type="submit"]').click();
      await page.locator('.av-review-step').waitFor({ timeout: 30000 });
      assert((await page.locator('.av-review-total strong').textContent()).includes(priceText(1190)));
      await noOverflow(page);
      if (width === 390) {
        await page.locator('.av-review-total').scrollIntoViewIfNeeded(); await shot(page, 'website-review-mobile-390');
        await page.locator('.av-consent input').check(); await usable(page.locator('.av-place-order'), 52);
        await page.locator('.av-place-order').click(); await page.locator('.av-receipt').waitFor();
        await shot(page, 'website-receipt-mobile-390');
        pass('Mobile Buy Now completes the on-site receipt flow using a mocked final save response');
      }
      await close(page);
      assert.equal((await page.locator('.av-bag-count').textContent()).trim(), '1');
      pass(`Chromium mobile ${width}px: visible controls, persistent cart, website form/review, 16px inputs and no horizontal overflow`);
      await context.close();
    }

    const safari = await webkit.launch();
    try {
      const context = await safari.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await protect(context); const page = await context.newPage(); observe(page);
      await page.goto(`${base}/product/aven-blue-shawl`); await settle(page); await noOverflow(page);
      await page.locator('.av-mobile-order .av-btn-gold').click(); await fillAddress(page, 'WEBKIT');
      await page.locator('.av-premium-form button[type="submit"]').click();
      await page.locator('.av-review-step').waitFor({ timeout: 30000 });
      await noOverflow(page); await page.locator('.av-consent input').check(); await usable(page.locator('.av-place-order'), 52);
      await shot(page, 'website-review-webkit-390'); await page.locator('.av-place-order').click();
      await page.locator('.av-receipt').waitFor(); await close(page);
      pass('WebKit mobile emulation supports Buy Now, website fields, real catalog quote and mocked receipt');
      await context.close();
    } finally { await safari.close(); }

    const offline = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await protect(offline);
    await offline.route('**/api/catalog', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, products: [] }) }));
    const page = await offline.newPage(); observe(page); await page.goto(base);
    await page.locator('.av[data-catalog-state="unavailable"]').waitFor();
    assert.equal(await page.locator('#shop .av-product-card .av-purchase-actions').count(), 0);
    pass('Catalog outage is visible and cannot silently sell stale inventory'); await offline.close();
    assert.equal(popupCount, 0); assert.deepEqual(errors, []);
    pass('No browser page errors or WhatsApp popups; no live customer order writes or notifications');
  } finally {
    await browser.close();
    fs.writeFileSync('verification/mobile-order-results.json', JSON.stringify({ checks, realCatalogAndQuoteReads: true, liveOrdersSubmitted: 0, mockedOrderSubmissions: mockedOrders, browserErrors: errors, popupCount }, null, 2));
  }
  console.log(`MOBILE_ORDER_RESULT ${checks.length} checks passed; live orders: 0; mocked saves: ${mockedOrders}`);
})().catch((error) => { console.error(error.stack); fs.writeFileSync('verification/mobile-order-failure.txt', String(error.stack)); process.exitCode = 1; });
