'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  async function check(name, fn) {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log('PASS', name);
    } catch (error) {
      results.push({ name, ok: false, error: String(error?.stack || error) });
      console.error('FAIL', name, error);
      throw error;
    }
  }

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 980 } });

  await check('admin desktop shell renders professional navigation', async () => {
    await desktop.goto('http://127.0.0.1:3000/admin', { waitUntil: 'domcontentloaded' });
    await desktop.locator('.av-admin').waitFor();
    assert.match(await desktop.locator('.av-admin-brand').innerText(), /AVEN/);
    assert.equal(await desktop.locator('.av-admin-nav button').count(), 5);
    assert.match(await desktop.locator('.av-admin-topbar h1').innerText(), /Overview/);
  });

  await check('categories and orders tabs are reachable without page reload', async () => {
    await desktop.getByRole('button', { name: 'Categories' }).click();
    await desktop.getByText('Product categories').waitFor();
    await desktop.getByRole('button', { name: 'Orders' }).click();
    await desktop.getByText('Order management').waitFor();
  });

  await check('products workspace exposes add and edit modes', async () => {
    await desktop.getByRole('button', { name: 'Products' }).click();
    await desktop.getByText('Product management').waitFor();
    assert.equal(await desktop.getByRole('button', { name: 'Edit products' }).count(), 1);
    assert.equal(await desktop.getByRole('button', { name: '+ Add product' }).count(), 1);
  });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await check('admin mobile shell has no page-level horizontal overflow', async () => {
    await mobile.goto('http://127.0.0.1:3000/admin', { waitUntil: 'domcontentloaded' });
    await mobile.locator('.av-admin').waitFor();
    const metrics = await mobile.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(metrics.scrollWidth <= metrics.width + 1, JSON.stringify(metrics));
  });

  await check('mobile admin drawer opens and navigates', async () => {
    await mobile.getByRole('button', { name: 'Admin menu খুলুন' }).click();
    const side = mobile.locator('.av-admin-side');
    await side.waitFor();
    assert.ok((await side.getAttribute('class')).includes('is-open'));
    await side.getByRole('button', { name: 'Categories' }).click();
    await mobile.getByText('Product categories').waitFor();
  });

  require('node:fs').mkdirSync('verification', { recursive: true });
  require('node:fs').writeFileSync('verification/admin-results.json', JSON.stringify(results, null, 2));
  await desktop.screenshot({ path: 'verification/admin-desktop.png', fullPage: false });
  await mobile.screenshot({ path: 'verification/admin-mobile-390.png', fullPage: false });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
