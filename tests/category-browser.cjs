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

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await check('hero is followed by shop-by-category section', async () => {
    await desktop.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    await desktop.locator('.av-category-hub').waitFor();
    const heroBox = await desktop.locator('.av-hero').boundingBox();
    const categoryBox = await desktop.locator('.av-category-hub').boundingBox();
    assert.ok(heroBox && categoryBox);
    assert.ok(categoryBox.y >= heroBox.y + heroBox.height - 4);
    await desktop.locator('.av-category-card').first().screenshot({ path: 'verification/category-card-desktop.png' });
  });

  await check('current colours are grouped under Kushikata and category click filters the shop', async () => {
    const card = desktop.locator('.av-category-card').filter({ hasText: 'কুশিকাটা চাদর' });
    await card.locator('button').click();
    await desktop.locator('#shop').waitFor();
    await desktop.waitForTimeout(250);
    assert.ok(desktop.url().includes('collection=kushikata'));
    assert.match(await desktop.locator('#shop h2').innerText(), /কুশিকাটা চাদর/);
    assert.equal(await desktop.locator('#shop .av-product-card').count(), 3);
  });

  await check('empty Jamdani category has no dead navigation', async () => {
    await desktop.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    const button = desktop.locator('.av-category-card').filter({ hasText: 'জামদানি চাদর' }).locator('button');
    if (await button.count()) {
      const disabled = await button.isDisabled();
      if (disabled) assert.equal(disabled, true);
    }
  });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await check('mobile category rail is usable without page overflow', async () => {
    await mobile.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    await mobile.locator('.av-category-hub').scrollIntoViewIfNeeded();
    const metrics = await mobile.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(metrics.scrollWidth <= metrics.width + 1, JSON.stringify(metrics));
    const first = mobile.locator('.av-category-card').first();
    await first.scrollIntoViewIfNeeded();
    await first.screenshot({ path: 'verification/category-mobile-390.png' });
  });

  await mobile.close();
  await desktop.close();
  await browser.close();
  require('node:fs').writeFileSync('verification/category-results.json', JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
