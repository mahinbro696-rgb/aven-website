'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'lib/admin.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
  fileName: filename,
});
const errors = (compiled.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, 'admin utilities parse without errors');

const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename })(
  (name) => {
    if (name === '@/lib/atelier') return {};
    return require(name);
  },
  module,
  module.exports
);
const admin = module.exports;

assert.equal(admin.normalizeOrderStatus('Packed'), 'Packed');
assert.equal(admin.normalizeOrderStatus('weird'), 'Pending');
assert.equal(admin.nextOrderStatus('Pending'), 'Confirmed');
assert.equal(admin.nextOrderStatus('Confirmed'), 'Packed');
assert.equal(admin.nextOrderStatus('Packed'), 'Shipped');
assert.equal(admin.nextOrderStatus('Shipped'), 'Delivered');
assert.equal(admin.nextOrderStatus('Delivered'), null);
assert.equal(admin.canCancelOrder('Pending'), true);
assert.equal(admin.canCancelOrder('Delivered'), false);

const product = (stock, colors=[]) => ({ stock, colors });
assert.equal(admin.productTrackedStock(product(8)), 8);
assert.equal(admin.productStockState(product(0)), 'out');
assert.equal(admin.productStockState(product(4)), 'low');
assert.equal(admin.productStockState(product(20)), 'healthy');
assert.equal(admin.productStockState(product(undefined, [{ stock: 2 }, { stock: 3 }])), 'low');
assert.equal(admin.productStockState(product(undefined, [{ stock: 2 }, {}])), 'untracked');

console.log('PASS admin order workflow and inventory utilities');
