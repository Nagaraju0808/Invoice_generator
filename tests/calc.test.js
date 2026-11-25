// Run with: node tests/calc.test.js
// Every expected figure below was worked out by hand (see the comments) before the code was run.
const assert = require('assert');
const C = require('../js/calc.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('Indian number format');
test('1,00,000', () => assert.strictEqual(C.formatINR(100000), '1,00,000.00'));
test('1,23,45,678.90', () => assert.strictEqual(C.formatINR(12345678.9), '1,23,45,678.90'));
test('999 stays 999.00', () => assert.strictEqual(C.formatINR(999), '999.00'));
test('negative round-off', () => assert.strictEqual(C.formatINR(-0.04), '-0.04'));
test('zero', () => assert.strictEqual(C.formatINR(0), '0.00'));
test('quantity 1.5 kg', () => assert.strictEqual(C.formatQty(1.5), '1.5'));
test('quantity 1,20,000', () => assert.strictEqual(C.formatQty(120000), '1,20,000'));

console.log('Amount in words');
test('2243', () => assert.strictEqual(C.amountInWords(2243), 'Rupees Two Thousand Two Hundred Forty-Three Only'));
test('1 lakh', () => assert.strictEqual(C.amountInWords(100000), 'Rupees One Lakh Only'));
test('crore', () => assert.strictEqual(C.integerToWords(12345678),
  'One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight'));
test('with paise', () => assert.strictEqual(C.amountInWords(105.5), 'Rupees One Hundred Five and Fifty Paise Only'));
test('zero', () => assert.strictEqual(C.amountInWords(0), 'Rupees Zero Only'));
test('11 lakh 11', () => assert.strictEqual(C.amountInWords(1100011), 'Rupees Eleven Lakh Eleven Only'));

console.log('Invoice number');
test('INV-0005', () => assert.strictEqual(C.formatInvoiceNumber('INV-', 5), 'INV-0005'));
test('12345 not cut', () => assert.strictEqual(C.formatInvoiceNumber('A/', 12345), 'A/12345'));

console.log('Sample invoice (4 items, 3 GST rates, 5% discount)');
/*
  Basmati rice 5 kg   2   x 450.00  @5%  =   900.00
  Sunflower oil 1 L   3   x 145.50  @5%  =   436.50
  Toothpaste 150 g    4   x  92.75  @18% =   371.00
  Wheat flour 10 kg   1   x 520.00  @0%  =   520.00
  Subtotal                                 2,227.50
  Discount 5% = 111.375 -> 111.38          -  111.38
  Taxable value                            2,116.12
  Discount spread by share of subtotal:
    5% slab : 1,336.50 x 2116.12/2227.50 = 1,269.672 -> 1,269.67 -> CGST 2.5% = 31.74, SGST 31.74
    18% slab:   371.00 x 2116.12/2227.50 =   352.455 ->   352.45 -> CGST 9%   = 31.72, SGST 31.72
    0% slab :   520.00 x 2116.12/2227.50 =   493.999 ->   494.00 -> 0
    (1,269.67 + 352.45 + 494.00 = 2,116.12, adds up)
  CGST 63.46, SGST 63.46
  Total 2,116.12 + 126.92 = 2,243.04 -> grand total 2,243.00, round off -0.04
*/
const sample = C.computeInvoice([
  { name: 'Basmati rice 5 kg', qty: 2, rate: 450, gst: 5 },
  { name: 'Sunflower oil 1 L', qty: 3, rate: 145.5, gst: 5 },
  { name: 'Toothpaste 150 g', qty: 4, rate: 92.75, gst: 18 },
  { name: 'Wheat flour 10 kg', qty: 1, rate: 520, gst: 0 },
  { name: '', qty: '', rate: '', gst: 5 } // an empty row the user left behind is ignored
], { type: 'percent', value: 5 });

test('4 lines (blank row ignored)', () => assert.strictEqual(sample.lines.length, 4));
test('line amounts', () => assert.deepStrictEqual(sample.lines.map(l => l.amount), [900, 436.5, 371, 520]));
test('subtotal 2,227.50', () => assert.strictEqual(sample.subtotal, 2227.5));
test('discount 111.38', () => assert.strictEqual(sample.discount, 111.38));
test('taxable 2,116.12', () => assert.strictEqual(sample.taxable, 2116.12));
test('slab taxable values', () => assert.deepStrictEqual(sample.slabs.map(s => s.taxable), [494, 1269.67, 352.45]));
test('slabs add up to taxable', () =>
  assert.strictEqual(C.toPaise(sample.slabs.reduce((a, s) => a + s.taxable, 0)), C.toPaise(sample.taxable)));
test('CGST 63.46', () => assert.strictEqual(sample.cgst, 63.46));
test('SGST 63.46', () => assert.strictEqual(sample.sgst, 63.46));
test('total before round 2,243.04', () => assert.strictEqual(sample.totalBeforeRound, 2243.04));
test('round off -0.04', () => assert.strictEqual(sample.roundOff, -0.04));
test('grand total 2,243', () => assert.strictEqual(sample.grandTotal, 2243));
test('in words', () => assert.strictEqual(sample.inWords, 'Rupees Two Thousand Two Hundred Forty-Three Only'));
test('printed grand total', () => assert.strictEqual(C.formatINR(sample.grandTotal), '2,243.00'));

console.log('Other cases');
test('flat discount, rounds up', () => {
  // 3 x 333.33 = 999.99 @18%; discount Rs 100 -> taxable 899.99; CGST 9% = 80.9991 -> 81.00 each
  // total 899.99 + 162.00 = 1,061.99 -> 1,062, round off +0.01
  const r = C.computeInvoice([{ name: 'Pen box', qty: 3, rate: 333.33, gst: 18 }], { type: 'amount', value: 100 });
  assert.strictEqual(r.taxable, 899.99);
  assert.strictEqual(r.cgst, 81);
  assert.strictEqual(r.grandTotal, 1062);
  assert.strictEqual(r.roundOff, 0.01);
});
test('discount cannot exceed subtotal', () => {
  const r = C.computeInvoice([{ name: 'A', qty: 1, rate: 50, gst: 5 }], { type: 'amount', value: 80 });
  assert.strictEqual(r.discount, 50);
  assert.strictEqual(r.grandTotal, 0);
});
test('fractional quantity 0.75 kg x 240', () => {
  const r = C.computeInvoice([{ name: 'Cashew', qty: 0.75, rate: 240, gst: 5 }], {});
  assert.strictEqual(r.subtotal, 180); // CGST 4.50 + SGST 4.50 -> 189
  assert.strictEqual(r.grandTotal, 189);
});
test('large bill in lakhs', () => {
  // 2 x 62,500 @18% = 1,25,000; tax 22,500 -> 1,47,500
  const r = C.computeInvoice([{ name: 'Laptop', qty: 2, rate: 62500, gst: 18 }], {});
  assert.strictEqual(C.formatINR(r.grandTotal), '1,47,500.00');
  assert.strictEqual(r.inWords, 'Rupees One Lakh Forty-Seven Thousand Five Hundred Only');
});
test('empty invoice is zero', () => {
  const r = C.computeInvoice([], {});
  assert.strictEqual(r.grandTotal, 0);
  assert.strictEqual(r.roundOff, 0);
});

console.log(`\n${passed} passed` + (process.exitCode ? ', some FAILED' : ', all good'));
