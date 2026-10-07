'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const modules = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (modules.has(filename)) return modules.get(filename).exports;
  const mod = { exports: {} }; modules.set(filename, mod);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dependency = (name) => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts'))
    : name.startsWith('@/') ? load(path.resolve(root, name.slice(2) + '.ts')) : require(name);
  vm.runInThisContext(`(function(module,exports,require){${code}\n})`, { filename })(mod, mod.exports, dependency);
  return mod.exports;
}
const api = load(path.join(root, 'lib/admin-api.ts'));
const integration = load(path.join(root, 'lib/cloudinary-integration.ts'));
const route = load(path.join(root, 'app/api/admin/cloudinary/route.ts'));
const imageRoute = load(path.join(root, 'app/api/admin/images/route.ts'));
const imageApi = load(path.join(root, 'lib/product-image-upload.ts'));
let uploadMode = 'success', uploadCalls = 0;
const originalFetch = global.fetch;
const originalKey = process.env.CLOUDINARY_INTEGRATION_KEY;
const master = 'a1'.repeat(32);
const now = Math.floor(Date.now() / 1000);
let claims = { sub: 'owner', aud: 'aven-ba684', iss: 'https://securetoken.google.com/aven-ba684', exp: now + 3600, auth_time: now };
function token() { return 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature'; }
function request(body, headers = {}) { return new Request('https://aven.example/api/admin/cloudinary', { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + token(), origin: 'https://aven.example', ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
let active = true, validToken = true, disabled = false, validSince = '0', cloudOkay = true, cloudCalls = 0, writes = 0, stored = null, cloudTimeout = false;
const secret = 'cloudinary_secret_123456';
const creds = { cloudName: 'pcprovqw', apiKey: '123456789012345', apiSecret: secret };
global.fetch = async (url, options = {}) => {
  url = String(url);
  if (url.includes('identitytoolkit')) return Response.json(validToken ? { users: [{ localId: 'owner', disabled, validSince }] } : { error: 'invalid' }, { status: validToken ? 200 : 400 });
  if (url.endsWith('/admins/owner')) return Response.json({ fields: { active: { booleanValue: active } } });
  if (url.endsWith('/settings/cloudinary')) {
    assert.match(options.headers.Authorization, /^Bearer /);
    if (options.method === 'PATCH') { writes++; stored = JSON.parse(options.body); return Response.json(stored); }
    if (options.method === 'DELETE') { stored = null; return new Response(null, { status: 200 }); }
    return stored ? Response.json(stored) : new Response(null, { status: 404 });
  }
  if (url === 'https://api.cloudinary.com/v1_1/pcprovqw/ping') {
    cloudCalls++;
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from(creds.apiKey + ':' + secret).toString('base64'));
    assert.equal(options.redirect, 'error');
    if (cloudTimeout) throw new Error('secret-bearing provider error: ' + secret);
    return Response.json(cloudOkay ? { status: 'ok' } : { error: { message: secret } }, { status: cloudOkay ? 200 : 401 });
  }
  if (url === 'https://api.cloudinary.com/v1_1/pcprovqw/image/upload') {
    uploadCalls++;
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from(creds.apiKey + ':' + secret).toString('base64'));
    assert.equal(options.redirect, 'error');
    assert.match(options.body.get('public_id'), /^aven\/products\/[0-9a-f-]{36}$/);
    assert.equal(options.body.get('overwrite'), 'false');
    assert.equal(options.body.get('file').type, 'image/png');
    if (uploadMode === 'denied') return Response.json({ error: { message: secret } }, { status: 403 });
    if (uploadMode === 'network') throw new Error(secret);
    return Response.json({ secure_url: uploadMode === 'badurl' ? 'https://evil.example/file.svg' : 'https://res.cloudinary.com/pcprovqw/image/upload/v123/aven/products/test.png', resource_type: 'image', width: 100, height: 150 });
  }
  throw new Error('Unexpected endpoint: ' + url);
};
(async () => {
  process.env.CLOUDINARY_INTEGRATION_KEY = master;
  let response = await route.GET(new Request('https://aven.example/api/admin/cloudinary'));
  assert.equal(response.status, 401); assert.equal(cloudCalls, 0);
  response = await route.POST(request({ action: 'verify', ...creds }, { origin: 'https://evil.example' }));
  assert.equal(response.status, 403); assert.equal(cloudCalls, 0);
  validToken = false;
  response = await route.GET(request()); assert.equal(response.status, 401);
  validToken = true; active = false;
  response = await route.GET(request()); assert.equal(response.status, 403);
  active = true; disabled = true;
  response = await route.GET(request()); assert.equal(response.status, 401);
  disabled = false; validSince = String(now + 1);
  response = await route.GET(request()); assert.equal(response.status, 401);
  validSince = '0'; claims.auth_time = now - 8 * 3600;
  response = await route.GET(request()); assert.equal(response.status, 401);
  claims.auth_time = now;
  response = await route.GET(request());
  assert.equal((await response.json()).status.state, 'disconnected');
  assert.match(response.headers.get('cache-control'), /no-store/);
  const context = await api.requireAdmin(request());
  await assert.rejects(api.readAdminJson(new Request('https://aven.example', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(4096) }) })), /বড়/);
  await assert.rejects(api.readAdminJson(new Request('https://aven.example', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })), /ফর্ম/);
  await assert.rejects(integration.cloudinaryAction(context, { action: 'verify', ...creds, cloudName: '../evil' }), /সঠিক/);
  response = await route.POST(request({ action: 'verify', ...creds }));
  assert.equal(response.status, 200);
  const verified = await response.json();
  assert.ok(verified.receipt); assert.equal(writes, 0); assert.equal(stored, null);
  assert.ok(!JSON.stringify(verified).includes(secret));
  assert.ok(!JSON.stringify(verified).includes(creds.apiKey));
  await assert.rejects(integration.cloudinaryAction({ ...context, uid: 'other' }, { action: 'connect', receipt: verified.receipt }), /Verification/);
  const parts = verified.receipt.split('.');
  const decrypt = crypto.createDecipheriv('aes-256-gcm', Buffer.from(master, 'hex'), Buffer.from(parts[1], 'base64url'));
  decrypt.setAAD(Buffer.from('aven:cloudinary:verification:v1')); decrypt.setAuthTag(Buffer.from(parts[2], 'base64url'));
  const payload = JSON.parse(Buffer.concat([decrypt.update(Buffer.from(parts[3], 'base64url')), decrypt.final()]));
  payload.expiresAt = Date.now() - 1;
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(master, 'hex'), iv);
  cipher.setAAD(Buffer.from('aven:cloudinary:verification:v1'));
  const expiredCipher = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  const expired = ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), expiredCipher.toString('base64url')].join('.');
  await assert.rejects(integration.cloudinaryAction(context, { action: 'connect', receipt: expired }), /Verification/);
  await assert.rejects(integration.cloudinaryAction(context, { action: 'connect', receipt: verified.receipt + 'tamper' }), /যাচাই/);
  response = await route.POST(request({ action: 'connect', receipt: verified.receipt }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status.state, 'connected');
  assert.equal(writes, 1); assert.ok(!JSON.stringify(stored).includes(secret)); assert.ok(!JSON.stringify(stored).includes(creds.apiKey));
  const savedCalls = cloudCalls;
  await integration.cloudinaryStatus(context); await integration.cloudinaryStatus(context);
  assert.equal(cloudCalls, savedCalls, 'Health checks should use the short cache');
  cloudOkay = false;
  response = await route.POST(request({ action: 'reconnect' }));
  assert.equal(response.status, 400); assert.ok(!(await response.text()).includes(secret));
  assert.equal((await integration.cloudinaryStatus(context)).state, 'error');
  cloudTimeout = true;
  response = await route.POST(request({ action: 'verify', ...creds }));
  assert.equal(response.status, 502); assert.ok(!(await response.text()).includes(secret));
  cloudTimeout = false; cloudOkay = true;
  response = await route.POST(request({ action: 'reconnect' }));
  assert.equal((await response.json()).status.state, 'connected');
  const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
  const uploadRequest = (body = png, type = 'image/png', headers = {}) => new Request('https://aven.example/api/admin/images', { method: 'POST', headers: { authorization: 'Bearer ' + token(), origin: 'https://aven.example', 'content-type': type, ...headers }, body });
  response = await imageRoute.POST(new Request('https://aven.example/api/admin/images', { method: 'POST', body: png }));
  assert.equal(response.status, 401); assert.equal(uploadCalls, 0);
  response = await imageRoute.POST(uploadRequest(png, 'image/png', { origin: 'https://evil.example' })); assert.equal(response.status, 403);
  response = await imageRoute.POST(uploadRequest(png, 'image/svg+xml')); assert.equal(response.status, 415);
  response = await imageRoute.POST(uploadRequest(png, 'image/jpeg')); assert.equal(response.status, 400);
  response = await imageRoute.POST(uploadRequest(new Uint8Array(imageApi.MAX_UPLOAD_BYTES + 1))); assert.equal(response.status, 413);
  assert.equal(uploadCalls, 0, 'Invalid uploads must never reach Cloudinary');
  response = await imageRoute.POST(uploadRequest()); assert.equal(response.status, 200);
  const uploaded = await response.json(); assert.match(uploaded.url, /^https:\/\/res.cloudinary.com\/pcprovqw\/image\/upload\//);
  assert.ok(!JSON.stringify(uploaded).includes(secret)); assert.match(response.headers.get('cache-control'), /no-store/);
  uploadMode = 'denied'; response = await imageRoute.POST(uploadRequest()); assert.equal(response.status, 409); assert.ok(!(await response.text()).includes(secret));
  uploadMode = 'badurl'; response = await imageRoute.POST(uploadRequest()); assert.equal(response.status, 502);
  uploadMode = 'network'; response = await imageRoute.POST(uploadRequest()); assert.equal(response.status, 502); assert.ok(!(await response.text()).includes(secret));
  uploadMode = 'success';
  process.env.CLOUDINARY_INTEGRATION_KEY = 'b2'.repeat(32);
  assert.equal((await integration.cloudinaryStatus(context)).state, 'error');
  delete process.env.CLOUDINARY_INTEGRATION_KEY;
  let status = await integration.cloudinaryStatus(context);
  assert.equal(status.state, 'setup_required'); assert.equal(status.configured, true);
  response = await route.POST(request({ action: 'disconnect' }));
  assert.equal(response.status, 200); assert.equal(stored, null);
  response = await route.POST(request({ action: 'verify', ...creds }));
  assert.equal(response.status, 503); assert.equal((await response.json()).error, 'SETUP_REQUIRED');
  process.env.CLOUDINARY_INTEGRATION_KEY = master;
  response = await imageRoute.POST(uploadRequest()); assert.equal(response.status, 409);
  console.log('PASS private image uploads: authorization, MIME signatures, streaming size limits, safe URLs, provider errors, disconnect and secret redaction');
  console.log('PASS Cloudinary admin authorization, CSRF, body limits, real verification, encrypted storage, receipt binding/expiry, red status, reconnect, disconnect and secret redaction');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.CLOUDINARY_INTEGRATION_KEY; else process.env.CLOUDINARY_INTEGRATION_KEY = originalKey;
});
