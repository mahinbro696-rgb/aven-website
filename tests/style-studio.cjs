'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  assert.equal((output.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  const module = { exports: {} }; cache.set(filename, module);
  vm.runInThisContext(`(function(require,module,exports){${output.outputText}\n})`, { filename })((name) => {
    if (!name.startsWith('.')) throw new Error('Unexpected dependency in public selection helpers');
    return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')));
  }, module, module.exports);
  return module.exports;
}
const studio = load('lib/style-studio.ts');
const product = (id, price = 1190) => ({ id, name: id, category: 'Shawl', mainImage: '/products/pink.png', colors: [{ name: 'Rose', image: '/products/pink.png' }], available: true, price, oldPrice: 2500, createdAt: 0, description: '' });
const line = (id, quantity = 1) => ({ productId: id, color: 'Rose', quantity });
const results = { unit: [], browser: [], pageErrors: [], mockedOrders: 0, liveOrders: 0 };
function unit(name, fn) { fn(); results.unit.push(name); console.log('PASS', name); }
unit('Shared selections round-trip public product/colour/quantity only', () => {
  const encoded = studio.encodeEdit([{ ...line('a'), name: 'PRIVATE CUSTOMER', phone: 'PRIVATE PHONE', price: 1 }]);
  assert(!encoded.includes('PRIVATE') && !encoded.includes('price')); assert.deepEqual(studio.decodeEdit(encoded), [line('a')]);
});
unit('Malformed, oversized, unknown-version and invalid-quantity links are rejected', () => {
  for (const value of ['bad', 'x'.repeat(12001), '{}', JSON.stringify({ v: 2, items: [['a','Rose',1]] }), JSON.stringify({ v: 1, items: [['a','Rose',-1]] }), JSON.stringify({ v: 1, items: [['../x','Rose',1]] }), JSON.stringify({ v: 1, items: [['a',null,1]] })]) assert.throws(() => studio.decodeEdit(value));
});
unit('Current product prices, not the shared URL, determine the subtotal', () => {
  const encoded = studio.encodeEdit([line('a'), line('b')]); const items = studio.decodeEdit(encoded);
  assert.equal(studio.editTotals(items, [product('a'),product('b')]).subtotal, 2380);
  assert.equal(studio.editTotals(items, [product('a',1500),product('b')]).subtotal, 2690);
});
unit('Set savings use the approved previous price without inventing a bundle discount', () => assert.equal(studio.editTotals([line('a'),line('b')],[product('a'),product('b')]).saving,2620));
unit('An unavailable item cannot be silently removed from a checkout', () => assert.throws(() => studio.checkedEdit([line('a'),line('missing')],[product('a')])));
unit('A removed colour and unavailable stock block selection', () => {
  assert.throws(() => studio.checkedEdit([{ ...line('a'),color:'missing' }],[product('a')]));
  assert.throws(() => studio.checkedEdit([line('a')],[{...product('a'),available:false}]));
});
unit('A failed multi-item add leaves the original bag unchanged', () => {
  const current = [line('a',20)]; const before = JSON.stringify(current);
  assert.throws(() => studio.mergeEdit(current,[line('b'),line('a')],[product('a'),product('b')])); assert.equal(JSON.stringify(current),before);
});
unit('Successful multi-item add merges variants once', () => assert.equal(studio.mergeEdit([line('a')],[line('a'),line('b')],[product('a'),product('b')]).find((l)=>l.productId==='a').quantity,2));
unit('Unpriced and empty selections never claim a complete final total', () => {
  assert.equal(studio.editTotals([],[]).complete,false); assert.equal(studio.editTotals([line('a')],[product('a',0)]).complete,false);
});
unit('Shared URL has a same-origin destination and no private data', () => {
  const url = new URL(studio.editUrl([line('a')],'https://example.test')); assert.equal(url.origin,'https://example.test'); assert.equal(url.hash,'#style-studio');
  assert.deepEqual(studio.decodeEdit(url.searchParams.get('edit')),[line('a')]); assert.throws(() => studio.editUrl([line('a')],'javascript:alert(1)'));
});

const base = process.env.STOREFRONT_TEST_URL || 'http://127.0.0.1:3000';
const dir = path.join(root, 'verification'); fs.mkdirSync(dir,{recursive:true});
const rose = 'aven-rose-shawl', blue = 'aven-blue-shawl', gold = 'aven-golden-shawl';
const priceText = (n) => new Intl.NumberFormat('bn-BD').format(n);
async function protect(context) {
  await context.addInitScript(() => { Object.defineProperty(navigator,'share',{value:undefined,configurable:true}); });
  let quote;
  await context.route('**/api/checkout/quote', async (route) => {
    const response = await route.fetch(); const json = await response.json(); if (json.success) quote=json; await route.fulfill({response});
  });
  await context.route('**/api/checkout', async (route) => {
    const payload = route.request().postDataJSON(); assert.equal(payload.name,'AUTOMATED STUDIO TEST'); assert(quote && payload.quoteHash===quote.quoteHash);
    results.mockedOrders++; await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({...quote,success:true,orderId:'TEST-STUDIO-NOT-A-REAL-ORDER'})});
  });
  await context.route('**/api/order', (route)=>route.abort());
  await context.route('https://api.telegram.org/**',(route)=>route.abort());
}
function observe(p){p.on('pageerror',(error)=>results.pageErrors.push(error.message));}
const settle = (p)=>p.locator('.av[data-catalog-state="ready"]').waitFor({timeout:30000});
const close = async(p)=>{await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('dialog[open]'));};
async function noOverflow(p){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const d=p.locator('dialog[open]');if(await d.count())assert(await d.evaluate((e)=>e.scrollWidth<=e.clientWidth+2));}
async function usable(locator){await locator.scrollIntoViewIfNeeded();assert(await locator.evaluate((e)=>{const r=e.getBoundingClientRect();return r.height>=44 && r.width>=44 && e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));}
async function shot(p,name){await p.screenshot({path:path.join(dir,name+'.png')});}
function pass(name){results.browser.push(name);console.log('BROWSER PASS',name);}
async function buildTwo(p){await p.locator('.av-set-option[data-studio-product="'+rose+'"] button').click();await p.locator('.av-set-option[data-studio-product="'+blue+'"] button').click();assert((await p.locator('.av-set-total strong').textContent()).includes(priceText(2380)));}
async function address(p){await p.locator('.av-premium-form').waitFor();await p.locator('input[name="name"]').fill('AUTOMATED STUDIO TEST');await p.locator('input[name="phone"]').fill('01987744985');await p.locator('input[name="district"]').fill('TEST DISTRICT');await p.locator('textarea[name="address"]').fill('AUTOMATED VERIFICATION - NOT A REAL ORDER - DO NOT SHIP');await p.locator('.av-premium-form button[type="submit"]').click();await p.locator('.av-review-step').waitFor({timeout:30000});}
(async()=>{
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await protect(context);const p=await context.newPage();observe(p);
  await p.goto(base+'/#style-studio');await settle(p);await p.locator('#style-studio').scrollIntoViewIfNeeded();await shot(p,'personal-edit-desktop');
  await p.locator('[data-product-id="'+gold+'"] .av-add-to-bag').first().click();await p.locator('.av-bag-shell').waitFor();await close(p);
  await p.locator('.av-shop-extras button').first().click();await p.locator('[data-studio-mode="compare"]').waitFor();
  await p.locator('select[aria-label="প্রথম পণ্য"]').selectOption(rose);await p.locator('select[aria-label="দ্বিতীয় পণ্য"]').selectOption(blue);
  assert.equal(await p.locator('.av-compare-photo').count(),2);await noOverflow(p);await shot(p,'compare-desktop');
  await p.locator('.av-compare-panel').first().locator('.av-studio-text-button').click();await p.locator('.av-studio-tabs button').nth(1).click();await p.locator('[data-studio-product="'+blue+'"] button').click();
  assert((await p.locator('.av-set-total strong').textContent()).includes(priceText(2380)));pass('Compare two real colours and build a correctly priced two-piece set');
  await p.locator('.av-set-share').click();const shared=await p.locator('input[aria-label="শেয়ারযোগ্য সেটের লিংক"]').inputValue();assert(!shared.includes('phone')&&!shared.includes('address'));
  await p.locator('.av-set-checkout').click();await address(p);assert((await p.locator('.av-review-total strong').textContent()).includes(priceText(2380)));
  await p.locator('.av-consent input').check();await p.locator('.av-place-order').click();await p.locator('.av-receipt').waitFor();await close(p);
  assert.equal((await p.locator('.av-bag-count').textContent()).trim(),'1');pass('Set goes to on-site address, real quote and mocked receipt without consuming the existing bag');
  const sharedContext=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});await protect(sharedContext);const sp=await sharedContext.newPage();observe(sp);await sp.goto(shared);await settle(sp);await sp.locator('[data-studio-mode="build"]').waitFor();assert.equal(await sp.locator('.av-set-line').count(),2);assert.equal((await sp.locator('.av-bag-count').textContent()).trim(),'0');await sp.locator('.av-set-add').click();await sp.locator('.av-bag-shell').waitFor();await close(sp);assert.equal((await sp.locator('.av-bag-count').textContent()).trim(),'2');await sp.reload();await settle(sp);assert.equal((await sp.locator('.av-bag-count').textContent()).trim(),'2');pass('Shared set opens without auto-adding and can be added atomically with refresh persistence');
  const missing=new URL(base);missing.searchParams.set('edit',JSON.stringify({v:1,items:[['missing-item','',1]]}));await sp.goto(missing.href);await settle(sp);await sp.locator('.av-set-line').waitFor();assert(await sp.locator('.av-set-checkout').isDisabled());assert(await sp.locator('.av-set-add').isDisabled());pass('Missing shared items block checkout instead of changing the requested set');await sharedContext.close();await context.close();
  for(const width of [320,360,390,430]){
   const c=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await protect(c);const m=await c.newPage();observe(m);await m.goto(base);await settle(m);await noOverflow(m);
   await usable(m.locator('.av-mobile-dock button').nth(1));await m.locator('.av-mobile-dock button').nth(1).click();await m.locator('[data-studio-mode="compare"]').waitFor();await m.locator('select[aria-label="প্রথম পণ্য"]').selectOption(rose);await m.locator('select[aria-label="দ্বিতীয় পণ্য"]').selectOption(blue);await noOverflow(m);await usable(m.locator('.av-compare-panel .av-btn').first());if(width===390)await shot(m,'compare-mobile-390');await close(m);
   await m.locator('.av-mobile-dock button').nth(2).click();await buildTwo(m);await noOverflow(m);await usable(m.locator('.av-set-checkout'));if(width===390)await shot(m,'set-mobile-390');await m.locator('.av-set-checkout').click();await address(m);await noOverflow(m);assert((await m.locator('.av-review-total strong').textContent()).includes(priceText(2380)));if(width===390){await m.locator('.av-review-total').scrollIntoViewIfNeeded();await shot(m,'set-review-mobile-390');}await close(m);pass('Chromium '+width+'px: dock, comparison, set builder and real on-site quote without overflow');await c.close();
  }
  const safari=await webkit.launch();try{const c=await safari.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await protect(c);const m=await c.newPage();observe(m);await m.goto(base);await settle(m);await m.locator('.av-mobile-dock button').nth(2).click();await buildTwo(m);await noOverflow(m);await usable(m.locator('.av-set-add'));await m.locator('.av-set-add').click();await m.locator('.av-bag-shell').waitFor();await noOverflow(m);await close(m);pass('WebKit mobile: set builder and atomic two-item bag');await c.close();}finally{await safari.close();}
  const invalid=await browser.newContext();await protect(invalid);const ip=await invalid.newPage();observe(ip);await ip.goto(base+'/?edit=not-json');await settle(ip);await ip.locator('.av-toast.is-visible').waitFor();assert.equal((await ip.locator('.av-bag-count').textContent()).trim(),'0');assert.equal(await ip.locator('dialog[open]').count(),0);pass('Malformed shared links cannot mutate the bag or open a checkout');await invalid.close();
  assert.deepEqual(results.pageErrors,[]);pass('No browser runtime errors; no live order or external notification writes');
 }catch(error){results.failure=error.stack;throw error;}finally{await browser.close();fs.writeFileSync(path.join(dir,'style-studio-results.json'),JSON.stringify(results,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
