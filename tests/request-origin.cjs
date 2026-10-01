'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('lib/commerce-server.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled)((name) => {
  if (name.startsWith('node:')) return require(name);
  if (name === '@/lib/atelier') return { normalizeProduct: (id, raw) => ({ id, ...raw }) };
  if (name === '@/lib/commerce') return { toMinor: (value) => Math.round(value * 100) };
  return {};
}, mod, mod.exports);
const check = mod.exports.isSameOrigin;
const make = (origin, host, url = 'http://localhost:3000/api/checkout', extra = {}) => new Request(url, { headers: { ...(origin === undefined ? {} : { origin }), ...(host === undefined ? {} : { host }), ...extra } });
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ORIGIN_PASS', name); }
test('same HTTP target accepts 127.0.0.1 despite internal localhost URL', () => assert(check(make('http://127.0.0.1:3000', '127.0.0.1:3000'))));
test('real deployment Host is respected', () => assert(check(make('https://shop.example.test', 'shop.example.test', 'https://internal.example.test/api/checkout'))));
test('cross-origin request remains blocked', () => assert.equal(check(make('https://evil.test', 'shop.example.test', 'https://shop.example.test/api/checkout')), false));
test('different port is not the same origin', () => assert.equal(check(make('http://127.0.0.1:3001', '127.0.0.1:3000')), false));
test('different scheme is not the same origin', () => assert.equal(check(make('https://127.0.0.1:3000', '127.0.0.1:3000')), false));
test('opaque, credentialed and malformed origins are rejected', () => {
  for (const origin of ['null', 'https://user:pass@shop.example.test', 'https://shop.example.test/', 'data:text/plain,x']) assert.equal(check(make(origin, 'shop.example.test')), false);
});
test('untrusted forwarded hosts do not authorize a foreign origin', () => assert.equal(check(make('https://evil.test', 'shop.example.test', 'https://shop.example.test/api/checkout', { 'x-forwarded-host': 'evil.test' })), false));
test('missing Host falls back to request URL', () => assert(check(make('http://localhost:3000', undefined))));
test('malformed Host values are rejected', () => {
  for (const host of ['good.test/evil', 'a.test,b.test', 'user@evil.test', 'evil.test?x=1', 'evil.test%2f']) assert.equal(check(make('http://evil.test', host)), false);
});
test('non-browser requests without Origin retain existing behavior', () => assert(check(make(undefined, 'localhost:3000'))));
test('draft or unpublished products cannot be quoted', () => {
  for (const flag of [{ published: false }, { status: 'draft' }]) assert.throws(() => mod.exports.quoteCatalog([{ productId: 'p', color: '', quantity: 1 }], new Map([['p', { price: 1190, ...flag }]])));
});
console.log(`${passed} origin and publication checks passed; no network calls`);
