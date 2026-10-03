'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');

// One approved catalog revision only. Future admin changes retain this marker and
// are NOT overwritten by subsequent CI runs. Never read any customer collection.
async function main() {
  assert.equal(process.env.PUBLISH_AVEN_APPROVED_OFFER, 'owner-approved-2026-10-01-1190-v1');
  const offer = JSON.parse(fs.readFileSync('lib/catalog-offer.json', 'utf8'));
  assert.equal(offer.price, 1190); assert.equal(offer.oldPrice, 2500);
  assert.deepEqual(offer.products.map((p) => p.id).sort(), ['aven-blue-shawl', 'aven-golden-shawl', 'aven-rose-shawl']);
  const config = fs.readFileSync('lib/firebase.ts', 'utf8');
  const project = config.match(/projectId:\s*["']([^"']+)/)?.[1];
  const key = config.match(/apiKey:\s*["']([^"']+)/)?.[1];
  assert.equal(project, 'aven-ba684'); assert(key);
  const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const call = async (path, options = {}) => {
    const response = await fetch(`${root}${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`, {
      ...options, signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok && response.status !== 404) throw new Error(`Catalog publication refused: HTTP ${response.status}, ${data.error?.status || 'unknown'}. No permission rules were changed.`);
    return { status: response.status, data };
  };
  const value = (v) => typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } :
    typeof v === 'number' ? { doubleValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(value) } } :
      { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) } };
  const writes = [];
  for (const p of offer.products) {
    const before = await call(`/products/${p.id}`);
    if (before.status === 200 && before.data.fields?.offerRevision?.stringValue === offer.revision) continue;
    const isNew = before.status === 404;
    const now = { timestampValue: new Date().toISOString() };
    const fields = {
      price: value(offer.price), oldPrice: value(offer.oldPrice), discount: value(52.4), offerRevision: value(offer.revision), updatedAt: now,
      ...(isNew ? { name: value(p.name), category: value('শাল'), mainImage: value(p.mainImage),
        description: value('পছন্দের রঙ ও পরিমাণ বেছে ওয়েবসাইটেই নাম, মোবাইল নম্বর ও ঠিকানা দিয়ে অর্ডার করুন। ডেলিভারি চার্জ ও সময় অর্ডার গ্রহণের পর নিশ্চিত করা হবে।'),
        colors: value([{ name: p.color, image: p.mainImage }]), available: value(true), published: value(true), createdAt: now } : {}),
    };
    writes.push({ update: { name: `projects/${project}/databases/(default)/documents/products/${p.id}`, fields },
      ...(isNew ? {} : { updateMask: { fieldPaths: Object.keys(fields) } }),
      currentDocument: isNew ? { exists: false } : { updateTime: before.data.updateTime },
    });
  }
  if (writes.length) {
    const committed = await call(':commit', { method: 'POST', body: JSON.stringify({ writes }) });
    assert.equal(committed.status, 200, 'All approved prices must commit together');
  }
  const results = [];
  for (const p of offer.products) {
    const check = await call(`/products/${p.id}`);
    assert.equal(check.status, 200);
    const f = check.data.fields;
    assert.equal(f.offerRevision?.stringValue, offer.revision);
    const number = (v) => Number(v?.doubleValue ?? v?.integerValue);
    results.push({ id: p.id, price: number(f.price), oldPrice: number(f.oldPrice), published: f.published?.booleanValue !== false });
  }
  fs.mkdirSync('verification', { recursive: true });
  fs.writeFileSync('verification/approved-offer.json', JSON.stringify({ revision: offer.revision, changedDocuments: writes.length, products: results }, null, 2));
  console.log('APPROVED_OFFER_PUBLISHED', JSON.stringify({ changedDocuments: writes.length, products: results }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
