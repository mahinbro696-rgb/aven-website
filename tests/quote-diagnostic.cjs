'use strict';
const fs = require('node:fs');
const offer = JSON.parse(fs.readFileSync('lib/catalog-offer.json', 'utf8'));
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const product = offer.products[0];
(async () => {
  const results = [];
  for (const origin of [null, base]) {
    try {
      const response = await fetch(`${base}/api/checkout/quote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
        body: JSON.stringify({ items: [{ productId: product.id, color: product.color, quantity: 1 }] }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json();
      results.push({ origin, status: response.status, success: data.success, subtotal: data.subtotal, code: data.code, message: data.message });
    } catch (error) { results.push({ origin, error: error.name }); }
  }
  fs.mkdirSync('verification', { recursive: true });
  fs.writeFileSync('verification/quote-diagnostics.json', JSON.stringify(results, null, 2));
  console.log('QUOTE_DIAGNOSTIC', JSON.stringify(results));
})();
