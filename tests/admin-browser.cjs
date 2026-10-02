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

  await check('anonymous desktop visitor sees secure admin sign-in, not dashboard', async () => {
    await desktop.goto('http://127.0.0.1:3000/admin', { waitUntil: 'domcontentloaded' });
    await desktop.getByRole('heading', { name: 'Admin sign in' }).waitFor();
    assert.equal(await desktop.locator('.av-admin-shell').count(), 0);
    assert.equal(await desktop.locator('input[type="email"]').count(), 1);
    assert.equal(await desktop.locator('input[type="password"]').count(), 1);
  });

  await check('admin sign-in form has real credential semantics', async () => {
    const email = desktop.locator('input[type="email"]');
    const password = desktop.locator('input[type="password"]');
    assert.equal(await email.getAttribute('autocomplete'), 'username');
    assert.equal(await password.getAttribute('autocomplete'), 'current-password');
    assert.equal(await desktop.getByRole('button', { name: 'Sign in securely' }).count(), 1);
  });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await check('mobile admin login has no page-level horizontal overflow', async () => {
    await mobile.goto('http://127.0.0.1:3000/admin', { waitUntil: 'domcontentloaded' });
    await mobile.getByRole('heading', { name: 'Admin sign in' }).waitFor();
    const metrics = await mobile.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(metrics.scrollWidth <= metrics.width + 1, JSON.stringify(metrics));
  });

  require('node:fs').mkdirSync('verification', { recursive: true });
  require('node:fs').writeFileSync('verification/admin-results.json', JSON.stringify(results, null, 2));
  await desktop.screenshot({ path: 'verification/admin-login-desktop.png', fullPage: false });
  await mobile.screenshot({ path: 'verification/admin-login-mobile-390.png', fullPage: false });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
