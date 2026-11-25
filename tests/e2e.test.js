// Browser test: types the sample invoice into the real app and checks every figure on screen.
// Run:  python3 -m http.server 8123   (in the project folder)   then   node tests/e2e.test.js [screenshot-folder]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || 'test-screens';
const URL = 'http://localhost:8123/index.html';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  const check = (name, got, want) => {
    const ok = got === want;
    console.log((ok ? '  ok   ' : '  FAIL ') + name + ': ' + JSON.stringify(got) + (ok ? '' : ' (want ' + JSON.stringify(want) + ')'));
    if (!ok) process.exitCode = 1;
  };
  const t = async sel => (await page.textContent(sel)).trim();
  const row = i => page.locator('.item-row').nth(i);
  const RS = '₹ ';

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.screenshot({ path: OUT + '/0-first-run.png' });

  console.log('Settings');
  await page.goto(URL + '#settings');
  await page.fill('#s-name', 'Sri Lakshmi General Stores');
  await page.fill('#s-address', '12, Gandhi Bazaar Main Road\nBasavanagudi, Bengaluru 560004');
  await page.fill('#s-phone', '98450 12345');
  await page.fill('#s-gstin', '29abcde1234f1z5');
  await page.click('#shop-form .btn-primary');
  await page.fill('#s-prefix', 'SLG/');
  await page.fill('#s-next', '101');
  await page.click('#inv-form .btn-primary');
  check('number preview', await t('#num-preview'), 'SLG/0101');
  check('brand shows shop name', await t('#brand-name'), 'Sri Lakshmi General Stores');
  await page.screenshot({ path: OUT + '/1-settings.png', fullPage: true });

  console.log('Products');
  await page.goto(URL + '#products');
  for (const [n, r, g] of [['Basmati rice 5 kg', '450', '5'], ['Sunflower oil 1 L', '145.50', '5'], ['Toothpaste 150 g', '92.75', '18']]) {
    await page.fill('#p-name', n); await page.fill('#p-rate', r); await page.selectOption('#p-gst', g);
    await page.click('#p-save');
  }
  check('3 products saved', await page.locator('.prod-table tbody tr').count(), 3);

  console.log('Sample invoice (same as tests/calc.test.js)');
  await page.goto(URL + '#new');
  check('next number shown', await t('.sub strong'), 'SLG/0101');
  await page.fill('#c-name', 'Meena Raghavan');
  await page.fill('#c-phone', '98861 40213');
  await page.fill('#c-address', '4th Cross, Hanumanthanagar, Bengaluru');
  await row(0).locator('.i-name').fill('Basmati rice 5 kg');
  check('rate filled from product list', await row(0).locator('.i-rate').inputValue(), '450');
  await row(0).locator('.i-qty').fill('2');
  await page.click('#add-row');
  await row(1).locator('.i-name').fill('Sunflower oil 1 L');
  await row(1).locator('.i-qty').fill('3');
  await page.click('#add-row');
  await row(2).locator('.i-name').fill('Toothpaste 150 g');
  check('GST filled from product list', await row(2).locator('.i-gst').inputValue(), '18');
  await row(2).locator('.i-qty').fill('4');
  await page.click('#add-row');
  await row(3).locator('.i-name').fill('Wheat flour 10 kg');
  await row(3).locator('.i-rate').fill('520');
  await row(3).locator('.i-gst').selectOption('0');
  await page.click('#add-row');
  check('5 rows after add', await page.locator('.item-row').count(), 5);
  await row(4).locator('.row-del').click();
  check('4 rows after delete', await page.locator('.item-row').count(), 4);
  await page.selectOption('#disc-type', 'percent');
  await page.fill('#disc-val', '5');
  check('row amount, oil', (await row(1).locator('.i-amt').textContent()).trim(), '436.50');
  check('subtotal', await t('#t-sub'), '2,227.50');
  check('discount 5%', await t('#t-disc'), '−111.38');
  check('taxable value', await t('#t-taxable'), '2,116.12');
  check('CGST', await t('#t-cgst'), '63.46');
  check('SGST', await t('#t-sgst'), '63.46');
  check('round off', await t('#t-round'), '-0.04');
  check('grand total', await t('#t-grand'), RS + '2,243.00');
  check('in words', await t('#t-words'), 'Rupees Two Thousand Two Hundred Forty-Three Only');
  await page.screenshot({ path: OUT + '/2-new-invoice.png', fullPage: true });

  await page.reload();
  check('unsaved form kept after reload', await page.locator('.item-row').count(), 4);
  check('total kept after reload', await t('#t-grand'), RS + '2,243.00');

  await page.click('#save-inv');
  await page.waitForSelector('.sheet');
  check('invoice page', await t('h1'), 'Invoice SLG/0101');
  check('printed grand total', await t('.sh-grand td'), RS + '2,243.00');
  check('titled Tax Invoice', await t('.sh-title'), 'Tax Invoice');
  check('GST summary has 3 rates', await page.locator('.sh-slabs tbody tr').count(), 3);
  await page.screenshot({ path: OUT + '/3-invoice-view.png', fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: OUT + '/invoice-SLG-0101.pdf', format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.screenshot({ path: OUT + '/4-print-layout.png', fullPage: true });
  await page.emulateMedia({ media: 'screen' });

  console.log('Second invoice: cash sale, flat discount, earlier date');
  await page.goto(URL + '#new');
  check('number went up', await t('.sub strong'), 'SLG/0102');
  await page.fill('#inv-date', '2026-11-03');
  await page.dispatchEvent('#inv-date', 'change');
  await row(0).locator('.i-name').fill('Toothpaste 150 g');
  await row(0).locator('.i-qty').fill('10');
  await page.fill('#disc-val', '27.50');
  // 927.50 - 27.50 = 900.00 taxable; 18% -> CGST 81 + SGST 81 -> 1,062.00
  check('flat discount total', await t('#t-grand'), RS + '1,062.00');
  await page.click('#save-inv');
  await page.waitForSelector('.sheet');
  check('no name prints Cash sale', await t('.sh-cust'), 'Cash sale');

  console.log('History');
  await page.goto(URL + '#history');
  const now = new Date();
  const todayIso = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  check('today\'s total', await t('#day-val'), RS + '2,243.00');
  if (todayIso.slice(0, 7) === '2026-11') {
    check('month total (2,243 + 1,062)', await t('#month-val'), RS + '3,305.00');
    check('month count', await t('#month-sub'), '2 invoices');
  }
  await page.screenshot({ path: OUT + '/5-history.png', fullPage: true });
  await page.fill('#q', 'meena');
  check('search by customer', await page.locator('.inv-table tbody tr').count(), 1);
  await page.fill('#q', 'toothpaste');
  check('search by item', await page.locator('.inv-table tbody tr').count(), 2);
  await page.fill('#q', '0102');
  check('search by number', await page.locator('.inv-table tbody tr').count(), 1);
  await page.fill('#q', '');
  await page.selectOption('#month-pick', '2026-11');
  await page.locator('.bar[data-day="2026-11-03"] .hit').click();
  check('tap a day on the chart', await t('#day-val'), RS + '1,062.00');

  console.log('Edit, products, persistence');
  const id = await page.locator('.inv-table tbody tr', { hasText: 'Meena' }).getAttribute('data-id');
  await page.goto(URL + '#edit/' + id);
  await row(0).locator('.i-qty').fill('3');
  await page.click('#save-inv');
  await page.waitForSelector('.sheet');
  check('edit keeps the number', await t('h1'), 'Invoice SLG/0101');
  await page.goto(URL + '#products');
  check('new item saved to products', await page.locator('.pt-name', { hasText: 'Wheat flour 10 kg' }).count(), 1);
  const p2 = await ctx.newPage();
  await p2.goto(URL + '#history');
  check('data still there in a new tab', await p2.locator('.inv-table tbody tr').count(), 2);

  console.log('Phone (Pixel 7)');
  const saved = await page.evaluate(() => localStorage.getItem('shop-invoices-v1'));
  const phone = await browser.newContext({ ...devices['Pixel 7'] });
  const ph = await phone.newPage();
  ph.on('pageerror', e => errors.push('phone: ' + e.message));
  await ph.goto(URL);
  await ph.evaluate(s => localStorage.setItem('shop-invoices-v1', s), saved);
  for (const [hash, name] of [['#new', 'p-new'], ['#history', 'p-history'], ['#products', 'p-products'], ['#settings', 'p-settings'], ['#invoice/' + id, 'p-invoice']]) {
    await ph.goto(URL + hash); await ph.reload();
    if (hash === '#new') {
      await ph.locator('.item-row .i-name').first().fill('Sunflower oil 1 L');
      await ph.locator('.item-row .i-qty').first().fill('2');
    }
    await ph.screenshot({ path: OUT + '/' + name + '.png' });
    check('no sideways scroll ' + hash.split('/')[0], await ph.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }
  await ph.goto(URL + '#new');
  await ph.screenshot({ path: OUT + '/p-new-full.png', fullPage: true });

  console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
  if (errors.length) process.exitCode = 1;
  console.log(process.exitCode ? 'SOME CHECKS FAILED' : 'all checks passed');
  await browser.close();
})();
