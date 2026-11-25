/*
 * Invoice calculations, number formatting and amount-in-words.
 * All money is computed in whole paise (integers) so totals never drift by a paisa.
 * Plain script (no modules) so the app also works when index.html is opened straight from disk.
 */
(function (root) {
  'use strict';

  // ---------- money helpers ----------
  function toPaise(rupees) {
    var n = Number(rupees);
    if (!isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function fromPaise(p) {
    return p / 100;
  }

  // Indian digit grouping: 1,00,000 / 12,34,56,789
  function groupIndian(intStr) {
    if (intStr.length <= 3) return intStr;
    var last3 = intStr.slice(-3);
    var rest = intStr.slice(0, -3);
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return rest + ',' + last3;
  }

  // formatINR(100000) -> "1,00,000.00"; decimals defaults to 2
  function formatINR(value, decimals) {
    if (decimals === undefined) decimals = 2;
    var n = Number(value);
    if (!isFinite(n)) n = 0;
    var neg = n < 0;
    var fixed = Math.abs(n).toFixed(decimals);
    var parts = fixed.split('.');
    var out = groupIndian(parts[0]) + (parts[1] ? '.' + parts[1] : '');
    if (neg && Number(fixed) !== 0) out = '-' + out;
    return out;
  }

  // Quantity: up to 3 decimals, no trailing zeros, Indian grouping
  function formatQty(value) {
    var n = Number(value);
    if (!isFinite(n)) return '0';
    var parts = String(Math.round(Math.abs(n) * 1000) / 1000).split('.');
    return (n < 0 ? '-' : '') + groupIndian(parts[0]) + (parts[1] ? '.' + parts[1] : '');
  }

  // ---------- amount in words (Indian system) ----------
  var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n) {
    if (n < 20) return ONES[n];
    return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  }

  function threeDigits(n) {
    var h = Math.floor(n / 100), r = n % 100, out = [];
    if (h) out.push(ONES[h] + ' Hundred');
    if (r) out.push(twoDigits(r));
    return out.join(' ');
  }

  // 12345678 -> "One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight"
  function integerToWords(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'Zero';
    var parts = [];
    var crore = Math.floor(n / 10000000);
    n = n % 10000000;
    var lakh = Math.floor(n / 100000);
    n = n % 100000;
    var thousand = Math.floor(n / 1000);
    n = n % 1000;
    if (crore) parts.push(integerToWords(crore) + ' Crore'); // handles 100+ crore too
    if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
    if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
    if (n) parts.push(threeDigits(n));
    return parts.join(' ');
  }

  // amountInWords(2243) -> "Rupees Two Thousand Two Hundred Forty-Three Only"
  function amountInWords(rupees) {
    var paise = Math.abs(toPaise(rupees));
    var r = Math.floor(paise / 100), p = paise % 100;
    var out = 'Rupees ' + integerToWords(r);
    if (p) out += ' and ' + twoDigits(p) + ' Paise';
    return (toPaise(rupees) < 0 ? 'Minus ' : '') + out + ' Only';
  }

  // ---------- invoice ----------
  function isBlankItem(it) {
    return !String(it.name || '').trim() && !Number(it.qty) && !Number(it.rate);
  }

  /*
   * items: [{ name, qty, rate, gst }]   rate is before GST, gst is a percentage
   * discount: { type: 'amount' | 'percent', value }
   * The discount is spread over the items in proportion to their amounts, so GST is charged on the
   * discounted (taxable) value. CGST and SGST are each half of the GST rate, computed per rate slab.
   */
  function computeInvoice(items, discount) {
    var lines = [];
    (items || []).forEach(function (it) {
      if (isBlankItem(it)) return;
      var qty = Number(it.qty) || 0;
      var ratePaise = toPaise(it.rate);
      var gst = Number(it.gst) || 0;
      lines.push({
        name: String(it.name || '').trim(),
        qty: qty,
        rate: fromPaise(ratePaise),
        gst: gst,
        amountPaise: Math.round(qty * ratePaise)
      });
    });

    var subtotal = lines.reduce(function (s, l) { return s + l.amountPaise; }, 0);

    var d = discount || {};
    var dv = Number(d.value) || 0;
    var disc = d.type === 'percent' ? Math.round(subtotal * dv / 100) : toPaise(dv);
    if (disc < 0) disc = 0;
    if (disc > subtotal) disc = subtotal;
    var taxableTotal = subtotal - disc;

    // group by GST rate
    var byRate = {};
    lines.forEach(function (l) {
      var k = String(l.gst);
      if (!byRate[k]) byRate[k] = { rate: l.gst, gross: 0, taxable: 0, cgst: 0, sgst: 0 };
      byRate[k].gross += l.amountPaise;
    });
    var slabs = Object.keys(byRate).map(function (k) { return byRate[k]; })
      .sort(function (a, b) { return a.rate - b.rate; });

    var assigned = 0;
    slabs.forEach(function (s) {
      s.taxable = subtotal ? Math.round(s.gross * taxableTotal / subtotal) : 0;
      assigned += s.taxable;
    });
    // put any 1-paisa rounding remainder on the largest slab so slabs add up exactly
    if (slabs.length && assigned !== taxableTotal) {
      var big = slabs.reduce(function (a, b) { return b.gross > a.gross ? b : a; });
      big.taxable += taxableTotal - assigned;
    }

    var cgst = 0, sgst = 0;
    slabs.forEach(function (s) {
      s.cgst = Math.round(s.taxable * s.rate / 200);
      s.sgst = s.cgst;
      cgst += s.cgst;
      sgst += s.sgst;
    });

    var total = taxableTotal + cgst + sgst;
    var grand = Math.round(total / 100) * 100; // nearest rupee
    var roundOff = grand - total;

    return {
      lines: lines.map(function (l) {
        return { name: l.name, qty: l.qty, rate: l.rate, gst: l.gst, amount: fromPaise(l.amountPaise) };
      }),
      subtotal: fromPaise(subtotal),
      discount: fromPaise(disc),
      taxable: fromPaise(taxableTotal),
      cgst: fromPaise(cgst),
      sgst: fromPaise(sgst),
      totalTax: fromPaise(cgst + sgst),
      totalBeforeRound: fromPaise(total),
      roundOff: fromPaise(roundOff),
      grandTotal: fromPaise(grand),
      inWords: amountInWords(fromPaise(grand)),
      slabs: slabs.map(function (s) {
        return { rate: s.rate, taxable: fromPaise(s.taxable), cgst: fromPaise(s.cgst), sgst: fromPaise(s.sgst) };
      })
    };
  }

  function formatInvoiceNumber(prefix, n) {
    return String(prefix || '') + String(n).padStart(4, '0');
  }

  var api = {
    toPaise: toPaise,
    formatINR: formatINR,
    formatQty: formatQty,
    integerToWords: integerToWords,
    amountInWords: amountInWords,
    computeInvoice: computeInvoice,
    formatInvoiceNumber: formatInvoiceNumber
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
