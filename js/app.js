/* Shop Invoices: screens, routing and printing. Depends on Calc (calc.js) and Store (store.js). */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];
  var DRAFT_KEY = 'shop-invoices-draft';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'];

  // ---------- small helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rs(n) { return '₹ ' + Calc.formatINR(n); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function prettyDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }
  function monthLabel(ym) {
    var p = ym.split('-');
    return MONTHS_LONG[Number(p[1]) - 1] + ' ' + p[0];
  }
  function gstOptions(selected) {
    var rates = GST_RATES.slice();
    var sel = Number(selected) || 0;
    if (rates.indexOf(sel) === -1) { rates.push(sel); rates.sort(function (a, b) { return a - b; }); }
    return rates.map(function (r) {
      return '<option value="' + r + '"' + (r === sel ? ' selected' : '') + '>' + r + '%</option>';
    }).join('');
  }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function hasGstin() { return !!String(Store.settings.gstin || '').trim(); }
  function setBrand() {
    document.getElementById('brand-name').textContent = Store.settings.shopName || 'Shop Invoices';
  }

  // ---------- routing ----------
  function route() {
    var hash = location.hash.replace(/^#/, '') || 'new';
    var parts = hash.split('/');
    var name = parts[0];
    $all('[data-route]').forEach(function (a) {
      if (a.getAttribute('data-route') === name || (name === 'invoice' && a.getAttribute('data-route') === 'history') ||
        (name === 'edit' && a.getAttribute('data-route') === 'history')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.setAttribute('data-screen', name);
    setBrand();
    if (name === 'history') renderHistory();
    else if (name === 'products') renderProducts();
    else if (name === 'settings') renderSettings();
    else if (name === 'invoice' && parts[1]) renderInvoiceView(parts[1]);
    else if (name === 'edit' && parts[1]) renderEditor(parts[1]);
    else renderEditor(null);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // =====================================================================
  // New / edit invoice
  // =====================================================================
  function emptyItem() { return { name: '', qty: 1, rate: '', gst: Number(Store.settings.defaultGst) || 0 }; }

  function loadDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d && Array.isArray(d.items)) return d;
    } catch (e) { /* ignore */ }
    return null;
  }
  function newDraft() {
    return {
      date: todayISO(),
      customer: { name: '', phone: '', address: '' },
      items: [emptyItem()],
      discount: { type: 'amount', value: '' }
    };
  }

  function renderEditor(editId) {
    var s = Store.settings;
    var editing = editId ? Store.getInvoice(editId) : null;
    if (editId && !editing) { location.hash = '#history'; return; }

    var draft = editing ? JSON.parse(JSON.stringify({
      date: editing.date, customer: editing.customer, items: editing.items, discount: editing.discount
    })) : (loadDraft() || newDraft());
    if (!draft.items.length) draft.items.push(emptyItem());

    function saveDraft() {
      if (editing) return;
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* ignore */ }
    }

    var nextNo = Calc.formatInvoiceNumber(s.prefix, s.nextNumber);
    var title = editing ? 'Edit invoice ' + esc(editing.number) : 'New invoice';
    var sub = editing
      ? 'Changes keep the same invoice number.'
      : 'This will be invoice <strong class="num">' + esc(nextNo) + '</strong> when you save.';

    app.innerHTML =
      '<div class="title-row">' +
        '<div><h1>' + title + '</h1><p class="sub">' + sub + '</p></div>' +
        '<label class="field date-field"><span>Date</span><input type="date" id="inv-date" value="' + esc(draft.date) + '" required></label>' +
      '</div>' +
      (!s.shopName ? '<p class="notice">Your shop name and address are not set yet, so they will be missing from the invoice. <a href="#settings">Add shop details</a></p>' : '') +
      '<div class="editor">' +
        '<div class="editor-main">' +
          '<section class="panel" aria-labelledby="cust-h">' +
            '<h2 id="cust-h">Customer</h2>' +
            '<div class="grid-2">' +
              '<label class="field"><span>Name</span><input id="c-name" autocomplete="off" placeholder="Leave empty for a cash sale" value="' + esc(draft.customer.name) + '"></label>' +
              '<label class="field"><span>Phone</span><input id="c-phone" type="tel" inputmode="tel" autocomplete="off" value="' + esc(draft.customer.phone) + '"></label>' +
              '<label class="field span-2"><span>Address</span><textarea id="c-address" rows="2">' + esc(draft.customer.address) + '</textarea></label>' +
            '</div>' +
          '</section>' +
          '<section class="panel" aria-labelledby="items-h">' +
            '<h2 id="items-h">Items</h2>' +
            '<div class="items-head" aria-hidden="true"><span>Item</span><span class="r">Qty</span><span class="r">Rate (₹)</span><span>GST</span><span class="r">Amount (₹)</span><span></span></div>' +
            '<div id="rows"></div>' +
            '<button type="button" class="btn btn-secondary btn-wide" id="add-row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add item</button>' +
            '<datalist id="product-names">' + Store.products.map(function (p) { return '<option value="' + esc(p.name) + '"></option>'; }).join('') + '</datalist>' +
          '</section>' +
        '</div>' +
        '<aside class="panel totals" aria-labelledby="tot-h">' +
          '<h2 id="tot-h">Totals</h2>' +
          '<dl class="sum-list">' +
            '<div><dt>Subtotal</dt><dd class="num" id="t-sub"></dd></div>' +
            '<div class="disc-row"><dt><label for="disc-val">Discount</label></dt><dd>' +
              '<span class="disc-inputs"><select id="disc-type" aria-label="Discount type"><option value="amount">₹</option><option value="percent">%</option></select>' +
              '<input id="disc-val" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="' + esc(draft.discount.value) + '"></span>' +
              '<span class="num disc-amt" id="t-disc"></span></dd></div>' +
            '<div><dt>Taxable value</dt><dd class="num" id="t-taxable"></dd></div>' +
            '<div><dt>CGST</dt><dd class="num" id="t-cgst"></dd></div>' +
            '<div><dt>SGST</dt><dd class="num" id="t-sgst"></dd></div>' +
            '<div><dt>Round off</dt><dd class="num" id="t-round"></dd></div>' +
          '</dl>' +
          '<div class="grand"><span>Grand total</span><strong class="num money" id="t-grand"></strong></div>' +
          '<p class="words" id="t-words"></p>' +
          '<button type="button" class="btn btn-primary btn-wide" id="save-inv">' + (editing ? 'Save changes' : 'Save and view invoice') + '</button>' +
          (editing
            ? '<a class="btn btn-text btn-wide" href="#invoice/' + esc(editing.id) + '">Cancel</a>'
            : '<button type="button" class="btn btn-text btn-wide" id="clear-inv">Clear form</button>') +
          '<p class="form-error" id="form-error" role="alert"></p>' +
        '</aside>' +
      '</div>' +
      '<div class="savebar"><div><span>Total</span><strong class="num money" id="sb-grand"></strong></div>' +
        '<button type="button" class="btn btn-primary" id="save-inv-2">' + (editing ? 'Save' : 'Save invoice') + '</button></div>';

    $('#disc-type').value = draft.discount.type === 'percent' ? 'percent' : 'amount';

    var rowsEl = $('#rows');

    function rowHTML(it, i) {
      return '<div class="item-row" data-i="' + i + '">' +
        '<label class="f-name"><span class="m-label">Item</span><input class="i-name" list="product-names" autocomplete="off" aria-label="Item name" placeholder="Type item name" value="' + esc(it.name) + '"></label>' +
        '<label class="f-qty"><span class="m-label">Qty</span><input class="i-qty num" type="number" min="0" step="any" inputmode="decimal" aria-label="Quantity" value="' + esc(it.qty) + '"></label>' +
        '<label class="f-rate"><span class="m-label">Rate (₹)</span><input class="i-rate num" type="number" min="0" step="any" inputmode="decimal" aria-label="Rate in rupees" value="' + esc(it.rate) + '"></label>' +
        '<label class="f-gst"><span class="m-label">GST</span><select class="i-gst" aria-label="GST percent">' + gstOptions(it.gst) + '</select></label>' +
        '<div class="f-amt"><span class="m-label">Amount (₹)</span><output class="num i-amt">0.00</output></div>' +
        '<button type="button" class="row-del" aria-label="Remove this item"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</div>';
    }
    function drawRows() {
      rowsEl.innerHTML = draft.items.map(rowHTML).join('');
      updateTotals();
    }
    function readRow(row) {
      var i = Number(row.getAttribute('data-i'));
      draft.items[i] = {
        name: $('.i-name', row).value,
        qty: $('.i-qty', row).value,
        rate: $('.i-rate', row).value,
        gst: Number($('.i-gst', row).value)
      };
    }
    function updateTotals() {
      draft.discount = { type: $('#disc-type').value, value: $('#disc-val').value };
      var r = Calc.computeInvoice(draft.items, draft.discount);
      $all('.item-row', rowsEl).forEach(function (row) {
        var it = draft.items[Number(row.getAttribute('data-i'))];
        var amt = Math.round((Number(it.qty) || 0) * Calc.toPaise(it.rate)) / 100; // same rule as calc.js
        $('.i-amt', row).textContent = Calc.formatINR(amt);
      });
      $('#t-sub').textContent = Calc.formatINR(r.subtotal);
      $('#t-disc').textContent = r.discount ? '−' + Calc.formatINR(r.discount) : '0.00';
      $('#t-taxable').textContent = Calc.formatINR(r.taxable);
      $('#t-cgst').textContent = Calc.formatINR(r.cgst);
      $('#t-sgst').textContent = Calc.formatINR(r.sgst);
      $('#t-round').textContent = (r.roundOff > 0 ? '+' : '') + Calc.formatINR(r.roundOff);
      $('#t-grand').textContent = rs(r.grandTotal);
      $('#sb-grand').textContent = rs(r.grandTotal);
      $('#t-words').textContent = r.inWords;
      saveDraft();
      return r;
    }

    rowsEl.addEventListener('input', function (e) {
      var row = e.target.closest('.item-row');
      if (!row) return;
      if (e.target.classList.contains('i-name')) {
        var p = Store.findProduct(e.target.value);
        if (p) {
          $('.i-rate', row).value = p.rate;
          var sel = $('.i-gst', row);
          sel.innerHTML = gstOptions(p.gst);
          row.classList.add('filled');
          setTimeout(function () { row.classList.remove('filled'); }, 700);
        }
      }
      readRow(row);
      updateTotals();
    });
    rowsEl.addEventListener('change', function (e) {
      var row = e.target.closest('.item-row');
      if (row) { readRow(row); updateTotals(); }
    });
    rowsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.row-del');
      if (!btn) return;
      var i = Number(btn.closest('.item-row').getAttribute('data-i'));
      draft.items.splice(i, 1);
      if (!draft.items.length) draft.items.push(emptyItem());
      drawRows();
    });
    // Enter in the last row's rate field adds a new row
    rowsEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.matches('.i-rate, .i-qty')) return;
      e.preventDefault();
      var row = e.target.closest('.item-row');
      if (Number(row.getAttribute('data-i')) === draft.items.length - 1) addRow();
    });
    function addRow() {
      draft.items.push(emptyItem());
      drawRows();
      var rows = $all('.item-row', rowsEl);
      $('.i-name', rows[rows.length - 1]).focus();
    }
    $('#add-row').addEventListener('click', addRow);
    $('#disc-type').addEventListener('change', updateTotals);
    $('#disc-val').addEventListener('input', updateTotals);
    $('#inv-date').addEventListener('change', function () { draft.date = this.value; saveDraft(); });
    ['name', 'phone', 'address'].forEach(function (k) {
      $('#c-' + k).addEventListener('input', function () { draft.customer[k] = this.value; saveDraft(); });
    });

    function save() {
      var err = $('#form-error');
      var items = draft.items.filter(function (it) { return String(it.name).trim() || Number(it.qty) || Number(it.rate); });
      var problem = '';
      if (!items.length) problem = 'Add at least one item.';
      items.forEach(function (it, i) {
        if (problem) return;
        if (!String(it.name).trim()) problem = 'Item ' + (i + 1) + ' has no name.';
        else if (!(Number(it.qty) > 0)) problem = '"' + it.name + '" needs a quantity above 0.';
        else if (!(Number(it.rate) >= 0) || it.rate === '') problem = '"' + it.name + '" needs a rate.';
      });
      if (!draft.date) problem = 'Choose a date.';
      if (problem) { err.textContent = problem; toast(problem); return; }
      err.textContent = '';
      var r = Calc.computeInvoice(items, draft.discount);
      var rec = Store.saveInvoice({
        id: editing ? editing.id : undefined,
        date: draft.date,
        customer: {
          name: draft.customer.name.trim(), phone: draft.customer.phone.trim(), address: draft.customer.address.trim()
        },
        items: items.map(function (it) {
          return { name: String(it.name).trim(), qty: Number(it.qty), rate: Number(it.rate), gst: Number(it.gst) || 0 };
        }),
        discount: { type: draft.discount.type, value: Number(draft.discount.value) || 0 },
        grandTotal: r.grandTotal,
        shop: { shopName: s.shopName, address: s.address, phone: s.phone, gstin: s.gstin, footerNote: s.footerNote }
      });
      if (!editing) localStorage.removeItem(DRAFT_KEY);
      toast(editing ? 'Changes saved' : 'Invoice ' + rec.number + ' saved');
      location.hash = '#invoice/' + rec.id;
    }
    $('#save-inv').addEventListener('click', save);
    $('#save-inv-2').addEventListener('click', save);
    var clearBtn = $('#clear-inv');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (!confirm('Clear this invoice form? Nothing saved will be lost.')) return;
      localStorage.removeItem(DRAFT_KEY);
      renderEditor(null);
    });

    drawRows();
  }

  // =====================================================================
  // Printable invoice (A4)
  // =====================================================================
  function sheetHTML(inv) {
    var shop = Object.assign({}, Store.settings, inv.shop || {});
    var logo = Store.settings.logo;
    var r = Calc.computeInvoice(inv.items, inv.discount);
    var gstin = String(shop.gstin || '').trim();
    var showGst = r.totalTax > 0 || r.slabs.some(function (sl) { return sl.rate > 0; });
    var c = inv.customer || {};

    var rows = r.lines.map(function (l, i) {
      return '<tr><td class="c-sn num">' + (i + 1) + '</td><td class="c-item">' + esc(l.name) + '</td>' +
        '<td class="num">' + Calc.formatQty(l.qty) + '</td><td class="num">' + Calc.formatINR(l.rate) + '</td>' +
        (showGst ? '<td class="num">' + l.gst + '%</td>' : '') +
        '<td class="num">' + Calc.formatINR(l.amount) + '</td></tr>';
    }).join('');

    var slabRows = r.slabs.filter(function (sl) { return sl.rate > 0 || r.slabs.length > 1; }).map(function (sl) {
      return '<tr><td class="num">' + sl.rate + '%</td><td class="num">' + Calc.formatINR(sl.taxable) + '</td>' +
        '<td class="num">' + Calc.formatINR(sl.cgst) + '</td><td class="num">' + Calc.formatINR(sl.sgst) + '</td>' +
        '<td class="num">' + Calc.formatINR(sl.cgst + sl.sgst) + '</td></tr>';
    }).join('');

    function sumRow(label, val, cls) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row">' + label + '</th><td class="num">' + val + '</td></tr>';
    }

    return '<article class="sheet" aria-label="Invoice ' + esc(inv.number) + '">' +
      '<header class="sh-head">' +
        '<div class="sh-shop">' +
          (logo ? '<img class="sh-logo" src="' + esc(logo) + '" alt="">' : '') +
          '<div><p class="sh-name">' + esc(shop.shopName || 'Your shop name') + '</p>' +
          (shop.address ? '<p class="sh-addr">' + esc(shop.address) + '</p>' : '') +
          (shop.phone ? '<p>Phone: ' + esc(shop.phone) + '</p>' : '') +
          (gstin ? '<p>GSTIN: <span class="sh-id">' + esc(gstin) + '</span></p>' : '') +
          '</div>' +
        '</div>' +
        '<div class="sh-doc">' +
          '<p class="sh-title">' + (gstin ? 'Tax Invoice' : 'Invoice') + '</p>' +
          '<dl><div><dt>Invoice no.</dt><dd>' + esc(inv.number) + '</dd></div>' +
          '<div><dt>Date</dt><dd>' + prettyDate(inv.date) + '</dd></div></dl>' +
        '</div>' +
      '</header>' +
      '<section class="sh-bill"><p class="sh-label">Bill to</p>' +
        '<p class="sh-cust">' + esc(c.name || 'Cash sale') + '</p>' +
        (c.phone ? '<p>Phone: ' + esc(c.phone) + '</p>' : '') +
        (c.address ? '<p class="sh-addr">' + esc(c.address) + '</p>' : '') +
      '</section>' +
      '<table class="sh-lines"><thead><tr><th class="c-sn">S.No</th><th class="c-item">Item</th><th class="num">Qty</th>' +
        '<th class="num">Rate (₹)</th>' + (showGst ? '<th class="num">GST</th>' : '') + '<th class="num">Amount (₹)</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
      '<div class="sh-foot">' +
        '<div class="sh-left">' +
          (showGst ? '<table class="sh-slabs"><caption>GST summary</caption><thead><tr><th class="num">Rate</th><th class="num">Taxable (₹)</th><th class="num">CGST (₹)</th><th class="num">SGST (₹)</th><th class="num">Total tax (₹)</th></tr></thead><tbody>' + slabRows + '</tbody></table>' : '') +
          '<p class="sh-label">Amount in words</p><p class="sh-words">' + esc(r.inWords) + '</p>' +
        '</div>' +
        '<table class="sh-sums"><tbody>' +
          sumRow('Subtotal', Calc.formatINR(r.subtotal)) +
          (r.discount ? sumRow('Discount' + (inv.discount && inv.discount.type === 'percent' ? ' (' + inv.discount.value + '%)' : ''), '−' + Calc.formatINR(r.discount)) : '') +
          (showGst ? sumRow('Taxable value', Calc.formatINR(r.taxable)) + sumRow('CGST', Calc.formatINR(r.cgst)) + sumRow('SGST', Calc.formatINR(r.sgst)) : '') +
          (r.roundOff ? sumRow('Round off', (r.roundOff > 0 ? '+' : '') + Calc.formatINR(r.roundOff)) : '') +
          sumRow('Grand total', '₹ ' + Calc.formatINR(r.grandTotal), 'sh-grand') +
        '</tbody></table>' +
      '</div>' +
      '<footer class="sh-end">' +
        '<p>' + esc(shop.footerNote || '') + '</p>' +
        '<p class="sh-sign">For ' + esc(shop.shopName || 'the shop') + '<br><span>Authorised signatory</span></p>' +
      '</footer>' +
    '</article>';
  }

  function renderInvoiceView(id) {
    var inv = Store.getInvoice(id);
    if (!inv) {
      app.innerHTML = '<div class="title-row"><div><h1>Invoice not found</h1><p class="sub">It may have been deleted.</p></div></div>' +
        '<a class="btn btn-secondary" href="#history">Back to history</a>';
      return;
    }
    document.title = inv.number + ' · ' + (Store.settings.shopName || 'Shop Invoices');
    app.innerHTML =
      '<div class="title-row no-print">' +
        '<div><h1>Invoice <span class="num">' + esc(inv.number) + '</span></h1>' +
        '<p class="sub">' + esc(inv.customer && inv.customer.name || 'Cash sale') + ' · ' + prettyDate(inv.date) +
        ' · <strong class="num">' + rs(inv.grandTotal) + '</strong></p></div>' +
        '<div class="actions">' +
          '<button type="button" class="btn btn-primary" id="print"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/></svg>Print or save PDF</button>' +
          '<a class="btn btn-secondary" href="#edit/' + esc(inv.id) + '">Edit</a>' +
          '<a class="btn btn-secondary" href="#new">New invoice</a>' +
        '</div>' +
      '</div>' +
      '<p class="hint no-print">To get a PDF, press <strong>Print or save PDF</strong> and choose <strong>Save as PDF</strong> as the printer. Paper size A4.</p>' +
      '<div class="sheet-wrap">' + sheetHTML(inv) + '</div>' +
      '<div class="danger-line no-print"><button type="button" class="btn btn-danger-text" id="del-inv">Delete this invoice</button></div>';

    $('#print').addEventListener('click', function () { window.print(); });
    $('#del-inv').addEventListener('click', function () {
      if (!confirm('Delete invoice ' + inv.number + ' for ' + rs(inv.grandTotal) + '? This cannot be undone.')) return;
      Store.deleteInvoice(inv.id);
      toast('Invoice ' + inv.number + ' deleted');
      location.hash = '#history';
    });
  }
  window.addEventListener('afterprint', function () { document.title = 'Shop Invoices'; });

  // =====================================================================
  // History with daily and monthly sales
  // =====================================================================
  var historyState = { day: null, month: null, q: '', limit: 50 };

  function renderHistory() {
    var all = Store.invoices.slice().sort(function (a, b) {
      return (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''));
    });
    var today = todayISO();
    if (!historyState.day) historyState.day = today;
    if (!historyState.month) historyState.month = today.slice(0, 7);

    // month choices: last 12 months plus any month that has invoices
    var monthSet = {};
    var d = new Date();
    for (var k = 0; k < 12; k++) {
      var m = new Date(d.getFullYear(), d.getMonth() - k, 1);
      monthSet[m.getFullYear() + '-' + pad2(m.getMonth() + 1)] = true;
    }
    all.forEach(function (inv) { monthSet[inv.date.slice(0, 7)] = true; });
    var months = Object.keys(monthSet).sort().reverse();

    app.innerHTML =
      '<div class="title-row"><div><h1>History</h1><p class="sub">' +
        (all.length ? all.length + ' invoice' + (all.length === 1 ? '' : 's') + ' saved' : 'No invoices yet') +
      '</p></div><a class="btn btn-primary" href="#new"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>New invoice</a></div>' +
      '<section class="panel sales" aria-labelledby="sales-h">' +
        '<h2 id="sales-h" class="vh">Sales totals</h2>' +
        '<div class="sales-figs">' +
          '<div class="fig"><label class="fig-label" for="day-pick">Sales on</label><input type="date" id="day-pick" value="' + historyState.day + '">' +
            '<p class="fig-val num money" id="day-val"></p><p class="fig-sub" id="day-sub"></p></div>' +
          '<div class="fig"><label class="fig-label" for="month-pick">Sales in</label><select id="month-pick">' +
            months.map(function (m) { return '<option value="' + m + '"' + (m === historyState.month ? ' selected' : '') + '>' + MONTHS[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4) + '</option>'; }).join('') +
            '</select><p class="fig-val num money" id="month-val"></p><p class="fig-sub" id="month-sub"></p></div>' +
        '</div>' +
        '<figure class="chart"><figcaption id="chart-cap"></figcaption><div id="chart"></div></figure>' +
      '</section>' +
      '<section class="panel list-panel" aria-labelledby="list-h">' +
        '<div class="list-top"><h2 id="list-h">Invoices</h2>' +
        '<label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
        '<input type="search" id="q" placeholder="Search number, customer, phone or item" aria-label="Search invoices" value="' + esc(historyState.q) + '"></label></div>' +
        '<div id="list"></div>' +
      '</section>';

    function sumFor(pred) {
      var n = 0, total = 0;
      all.forEach(function (inv) { if (pred(inv)) { n++; total += Calc.toPaise(inv.grandTotal); } });
      return { n: n, total: total / 100 };
    }
    function plural(n) { return n + ' invoice' + (n === 1 ? '' : 's'); }

    function drawFigures() {
      var day = sumFor(function (inv) { return inv.date === historyState.day; });
      var mon = sumFor(function (inv) { return inv.date.slice(0, 7) === historyState.month; });
      $('#day-val').textContent = rs(day.total);
      $('#day-val').classList.toggle('zero', !day.n);
      $('#day-sub').textContent = (historyState.day === today ? 'Today · ' : '') + plural(day.n);
      $('#month-val').textContent = rs(mon.total);
      $('#month-val').classList.toggle('zero', !mon.n);
      $('#month-sub').textContent = plural(mon.n);
      drawChart();
    }

    function drawChart() {
      var ym = historyState.month;
      var y = Number(ym.slice(0, 4)), mo = Number(ym.slice(5, 7));
      var days = new Date(y, mo, 0).getDate();
      var totals = [];
      for (var i = 1; i <= days; i++) totals.push(0);
      all.forEach(function (inv) {
        if (inv.date.slice(0, 7) === ym) totals[Number(inv.date.slice(8, 10)) - 1] += Calc.toPaise(inv.grandTotal) / 100;
      });
      var max = Math.max.apply(null, totals);
      // a round top for the scale: 1, 2 or 5 x 10^n
      var top = 1000;
      if (max > 0) {
        var p = Math.pow(10, Math.floor(Math.log10(max)));
        top = [1, 2, 5, 10].map(function (m) { return m * p; }).find(function (v) { return v >= max; });
      }
      var W = Math.max(300, Math.round($('#chart').clientWidth) || 720), H = 180, L = 64, R = 8, T = 10, B = 26; // drawn at real width so labels stay readable
      var pw = W - L - R, ph = H - T - B, bw = pw / days;
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Daily sales in ' + monthLabel(ym) + '">';
      [0, 0.5, 1].forEach(function (f) {
        var yy = T + ph - ph * f;
        svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" class="' + (f === 0 ? 'axis' : 'grid') + '"/>';
        svg += '<text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end">₹' + Calc.formatINR(top * f, 0) + '</text>';
      });
      totals.forEach(function (v, i) {
        var h = v ? Math.max(2, ph * v / top) : 0;
        var x = L + i * bw + bw * 0.18;
        var dayIso = ym + '-' + pad2(i + 1);
        var sel = dayIso === historyState.day;
        svg += '<g class="bar' + (sel ? ' sel' : '') + '" data-day="' + dayIso + '">' +
          '<rect class="hit" x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + ph + '"/>' +
          (h ? '<rect class="fill" x="' + x.toFixed(1) + '" y="' + (T + ph - h).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + h.toFixed(1) + '"/>' : '') +
          '<title>' + prettyDate(dayIso) + ': ' + rs(v) + '</title></g>';
        if ((i + 1) === 1 || (i + 1) % 5 === 0) {
          svg += '<text x="' + (L + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + (i + 1) + '</text>';
        }
      });
      svg += '</svg>';
      $('#chart').innerHTML = svg;
      var best = -1, bestV = 0;
      totals.forEach(function (v, i) { if (v > bestV) { bestV = v; best = i; } });
      $('#chart-cap').textContent = 'Daily sales, ' + monthLabel(ym) +
        (best >= 0 ? ' · best day ' + (best + 1) + ' ' + MONTHS[mo - 1] + ', ' + rs(bestV) : ' · no sales yet') +
        ' · tap a day to see its total';
    }

    function drawList() {
      var q = historyState.q.trim().toLowerCase();
      var rows = !q ? all : all.filter(function (inv) {
        var c = inv.customer || {};
        var hay = [inv.number, c.name, c.phone, prettyDate(inv.date)].concat(inv.items.map(function (i) { return i.name; })).join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
      });
      var list = $('#list');
      if (!all.length) {
        list.innerHTML = '<div class="empty">No invoices yet. Saved invoices appear here, newest first. <a href="#new">Make the first one</a></div>';
        return;
      }
      if (!rows.length) {
        list.innerHTML = '<div class="empty">No invoice matches “' + esc(historyState.q) + '”.</div>';
        return;
      }
      var shown = rows.slice(0, historyState.limit);
      var foundTotal = rows.reduce(function (s, inv) { return s + Calc.toPaise(inv.grandTotal); }, 0) / 100;
      list.innerHTML =
        (q ? '<p class="list-meta">' + plural(rows.length) + ' found · ' + rs(foundTotal) + '</p>' : '') +
        '<table class="inv-table"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th class="num">Items</th><th class="num">Amount (₹)</th></tr></thead><tbody>' +
        shown.map(function (inv) {
          var c = inv.customer || {};
          return '<tr data-id="' + esc(inv.id) + '" tabindex="0">' +
            '<td class="t-no" data-meta="' + ' · ' + prettyDate(inv.date) + ' · ' + inv.items.length + (inv.items.length === 1 ? ' item' : ' items') + '"><a href="#invoice/' + esc(inv.id) + '">' + esc(inv.number) + '</a></td>' +
            '<td class="t-date">' + prettyDate(inv.date) + '</td>' +
            '<td class="t-cust">' + esc(c.name || 'Cash sale') + (c.phone ? '<span class="t-phone"> · ' + esc(c.phone) + '</span>' : '') + '</td>' +
            '<td class="num t-items">' + inv.items.length + '</td>' +
            '<td class="num t-amt money">' + Calc.formatINR(inv.grandTotal) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        (rows.length > shown.length ? '<button type="button" class="btn btn-secondary btn-wide" id="more">Show more (' + (rows.length - shown.length) + ' left)</button>' : '');
      var more = $('#more');
      if (more) more.addEventListener('click', function () { historyState.limit += 100; drawList(); });
    }

    $('#day-pick').addEventListener('change', function () {
      if (!this.value) return;
      historyState.day = this.value;
      if (this.value.slice(0, 7) !== historyState.month && monthSet[this.value.slice(0, 7)]) {
        historyState.month = this.value.slice(0, 7);
        $('#month-pick').value = historyState.month;
      }
      drawFigures();
    });
    $('#month-pick').addEventListener('change', function () { historyState.month = this.value; drawFigures(); });
    $('#chart').addEventListener('click', function (e) {
      var g = e.target.closest('.bar');
      if (!g) return;
      historyState.day = g.getAttribute('data-day');
      $('#day-pick').value = historyState.day;
      drawFigures();
    });
    $('#q').addEventListener('input', function () { historyState.q = this.value; historyState.limit = 50; drawList(); });
    $('#list').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (tr && !e.target.closest('a')) location.hash = '#invoice/' + tr.getAttribute('data-id');
    });
    $('#list').addEventListener('keydown', function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (tr && e.key === 'Enter') location.hash = '#invoice/' + tr.getAttribute('data-id');
    });

    drawFigures();
    drawList();
  }

  // =====================================================================
  // Products
  // =====================================================================
  function renderProducts() {
    var editingId = null, q = '';
    app.innerHTML =
      '<div class="title-row"><div><h1>Products</h1><p class="sub">Type a saved name on an invoice and its rate and GST fill in by themselves. New items are added here when you save an invoice.</p></div></div>' +
      '<section class="panel" aria-labelledby="padd-h">' +
        '<h2 id="padd-h">Add a product</h2>' +
        '<form id="pform" class="pform" novalidate>' +
          '<label class="field p-name"><span>Name</span><input id="p-name" autocomplete="off" required placeholder="e.g. Sugar 1 kg"></label>' +
          '<label class="field p-rate"><span>Rate (₹, before GST)</span><input id="p-rate" class="num" type="number" min="0" step="any" inputmode="decimal" required></label>' +
          '<label class="field p-gst"><span>GST</span><select id="p-gst">' + gstOptions(Store.settings.defaultGst) + '</select></label>' +
          '<div class="p-actions"><button class="btn btn-primary" id="p-save">Add product</button>' +
          '<button type="button" class="btn btn-text" id="p-cancel" hidden>Cancel</button></div>' +
        '</form>' +
        '<p class="form-error" id="p-error" role="alert"></p>' +
      '</section>' +
      '<section class="panel list-panel" aria-labelledby="plist-h">' +
        '<div class="list-top"><h2 id="plist-h">Saved products</h2>' +
        '<label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
        '<input type="search" id="pq" placeholder="Search products" aria-label="Search products"></label></div>' +
        '<div id="plist"></div>' +
      '</section>';

    function draw() {
      var ql = q.trim().toLowerCase();
      var rows = Store.products.filter(function (p) { return !ql || p.name.toLowerCase().indexOf(ql) !== -1; });
      var el = $('#plist');
      $('#plist-h').textContent = 'Saved products (' + Store.products.length + ')';
      if (!Store.products.length) { el.innerHTML = '<div class="empty">No products yet. Add your common items above to fill invoices faster.</div>'; return; }
      if (!rows.length) { el.innerHTML = '<div class="empty">No product matches “' + esc(q) + '”.</div>'; return; }
      el.innerHTML = '<table class="prod-table"><thead><tr><th>Name</th><th class="num">Rate (₹)</th><th class="num">GST</th><th><span class="vh">Actions</span></th></tr></thead><tbody>' +
        rows.map(function (p) {
          return '<tr><td class="pt-name">' + esc(p.name) + '</td><td class="num">' + Calc.formatINR(p.rate) + '</td><td class="num">' + p.gst + '%</td>' +
            '<td class="row-actions"><button type="button" class="btn btn-text" data-edit="' + esc(p.id) + '">Edit</button>' +
            '<button type="button" class="btn btn-danger-text" data-del="' + esc(p.id) + '">Delete</button></td></tr>';
        }).join('') + '</tbody></table>';
    }
    function resetForm() {
      editingId = null;
      $('#pform').reset();
      $('#p-gst').innerHTML = gstOptions(Store.settings.defaultGst);
      $('#padd-h').textContent = 'Add a product';
      $('#p-save').textContent = 'Add product';
      $('#p-cancel').hidden = true;
      $('#p-error').textContent = '';
    }
    $('#pform').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#p-name').value.trim(), rate = $('#p-rate').value;
      var err = '';
      if (!name) err = 'Enter a product name.';
      else if (rate === '' || !(Number(rate) >= 0)) err = 'Enter a rate.';
      else {
        var dup = Store.findProduct(name);
        if (dup && dup.id !== editingId) err = '“' + name + '” is already saved. Use Edit to change it.';
      }
      if (err) { $('#p-error').textContent = err; return; }
      Store.upsertProduct({ id: editingId || undefined, name: name, rate: Number(rate), gst: Number($('#p-gst').value) });
      toast(editingId ? 'Product updated' : 'Product added');
      resetForm();
      draw();
      $('#p-name').focus();
    });
    $('#p-cancel').addEventListener('click', resetForm);
    $('#pq').addEventListener('input', function () { q = this.value; draw(); });
    $('#plist').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
      if (ed) {
        var p = Store.products.find(function (x) { return x.id === ed.getAttribute('data-edit'); });
        editingId = p.id;
        $('#p-name').value = p.name;
        $('#p-rate').value = p.rate;
        $('#p-gst').innerHTML = gstOptions(p.gst);
        $('#padd-h').textContent = 'Edit product';
        $('#p-save').textContent = 'Save product';
        $('#p-cancel').hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        $('#p-name').focus();
      }
      if (del) {
        var pd = Store.products.find(function (x) { return x.id === del.getAttribute('data-del'); });
        if (confirm('Delete “' + pd.name + '” from saved products? Old invoices are not changed.')) {
          Store.deleteProduct(pd.id);
          if (editingId === pd.id) resetForm();
          toast('Product deleted');
          draw();
        }
      }
    });
    draw();
  }

  // =====================================================================
  // Settings
  // =====================================================================
  function renderSettings() {
    var s = Store.settings;
    var pendingLogo = s.logo;

    app.innerHTML =
      '<div class="title-row"><div><h1>Settings</h1><p class="sub">Saved on this device. Download a backup now and then to keep your data safe.</p></div></div>' +

      '<section class="set-row" aria-labelledby="set-shop-h">' +
        '<div class="set-label"><h2 id="set-shop-h">Shop details</h2><p>Printed at the top of every invoice. Leave GSTIN empty if your shop is not GST registered: the invoice is then titled “Invoice” and GST is left out when every rate is 0%.</p></div>' +
        '<form class="set-panel" id="shop-form" novalidate>' +
          '<label class="field"><span>Shop name</span><input id="s-name" value="' + esc(s.shopName) + '" autocomplete="organization"></label>' +
          '<label class="field"><span>Address</span><textarea id="s-address" rows="3">' + esc(s.address) + '</textarea></label>' +
          '<div class="grid-2">' +
            '<label class="field"><span>Phone</span><input id="s-phone" type="tel" value="' + esc(s.phone) + '"></label>' +
            '<label class="field"><span>GSTIN</span><input id="s-gstin" maxlength="15" autocapitalize="characters" placeholder="Leave empty if none" value="' + esc(s.gstin) + '"></label>' +
          '</div>' +
          '<div class="field"><span>Logo</span>' +
            '<div class="logo-row"><div class="logo-box" id="logo-box"></div>' +
            '<div class="logo-btns"><label class="btn btn-secondary file-btn">Choose image<input type="file" id="s-logo" accept="image/*"></label>' +
            '<button type="button" class="btn btn-text" id="logo-remove">Remove</button></div></div>' +
            '<small>PNG or JPG. It is shrunk to fit the invoice header.</small></div>' +
          '<p class="form-error" id="shop-error" role="alert"></p>' +
          '<div class="set-save"><button class="btn btn-primary">Save shop details</button></div>' +
        '</form>' +
      '</section>' +

      '<section class="set-row" aria-labelledby="set-inv-h">' +
        '<div class="set-label"><h2 id="set-inv-h">Invoice numbers and GST</h2><p>Numbers go up by one with each saved invoice. Change the prefix at the start of a financial year, for example <span class="num">2026-27/</span>.</p>' +
          '<p class="preview">Next invoice: <strong class="num" id="num-preview"></strong></p></div>' +
        '<form class="set-panel" id="inv-form" novalidate>' +
          '<div class="grid-2">' +
            '<label class="field"><span>Invoice prefix</span><input id="s-prefix" value="' + esc(s.prefix) + '"></label>' +
            '<label class="field"><span>Next number</span><input id="s-next" class="num" type="number" min="1" step="1" inputmode="numeric" value="' + esc(s.nextNumber) + '"></label>' +
          '</div>' +
          '<label class="field"><span>Default GST rate for new items</span><select id="s-gst">' + gstOptions(s.defaultGst) + '</select></label>' +
          '<label class="field"><span>Note at the bottom of the invoice</span><input id="s-note" value="' + esc(s.footerNote) + '"></label>' +
          '<p class="form-error" id="inv-error" role="alert"></p>' +
          '<div class="set-save"><button class="btn btn-primary">Save invoice settings</button></div>' +
        '</form>' +
      '</section>' +

      '<section class="set-row" aria-labelledby="set-bak-h">' +
        '<div class="set-label"><h2 id="set-bak-h">Backup</h2><p>Your data lives in this browser only. A backup file lets you keep a safe copy or move everything to another phone or laptop.</p></div>' +
        '<div class="set-panel">' +
          '<p class="stat-line"><span class="num">' + Store.invoices.length + '</span> invoices · <span class="num">' + Store.products.length + '</span> products</p>' +
          '<div class="btn-row"><button type="button" class="btn btn-secondary" id="bak-down">Download backup</button>' +
          '<label class="btn btn-secondary file-btn">Restore from backup<input type="file" id="bak-up" accept=".json,application/json"></label></div>' +
          '<small>Restoring replaces everything currently saved on this device.</small>' +
        '</div>' +
      '</section>' +

      '<section class="set-row" aria-labelledby="set-del-h">' +
        '<div class="set-label"><h2 id="set-del-h">Erase all data</h2><p>Removes every invoice, product and setting from this device.</p></div>' +
        '<div class="set-panel"><button type="button" class="btn btn-danger" id="erase">Erase all data</button></div>' +
      '</section>';

    function drawLogo() {
      $('#logo-box').innerHTML = pendingLogo ? '<img src="' + esc(pendingLogo) + '" alt="Shop logo">' : '<span>No logo</span>';
      $('#logo-remove').hidden = !pendingLogo;
    }
    function drawPreview() {
      $('#num-preview').textContent = Calc.formatInvoiceNumber($('#s-prefix').value, Math.max(1, parseInt($('#s-next').value, 10) || 1));
    }
    drawLogo();
    drawPreview();
    $('#s-prefix').addEventListener('input', drawPreview);
    $('#s-next').addEventListener('input', drawPreview);

    $('#s-logo').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      shrinkImage(f, 480, 240, function (url) { pendingLogo = url; drawLogo(); });
      this.value = '';
    });
    $('#logo-remove').addEventListener('click', function () { pendingLogo = ''; drawLogo(); });

    $('#shop-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var gstin = $('#s-gstin').value.trim().toUpperCase();
      $('#s-gstin').value = gstin;
      if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) {
        $('#shop-error').textContent = 'A GSTIN has 15 characters and starts with 2 digits (state code). Check it, or leave it empty.';
        return;
      }
      $('#shop-error').textContent = '';
      if (Store.saveSettings({
        shopName: $('#s-name').value.trim(), address: $('#s-address').value.trim(),
        phone: $('#s-phone').value.trim(), gstin: gstin, logo: pendingLogo
      })) { toast('Shop details saved'); setBrand(); }
    });
    $('#inv-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var next = parseInt($('#s-next').value, 10);
      if (!(next >= 1)) { $('#inv-error').textContent = 'Next number must be 1 or more.'; return; }
      var newNo = Calc.formatInvoiceNumber($('#s-prefix').value, next);
      var clash = Store.invoices.some(function (inv) { return inv.number === newNo; });
      if (clash && !confirm(newNo + ' already exists. Use it anyway? Two invoices would have the same number.')) return;
      $('#inv-error').textContent = '';
      if (Store.saveSettings({
        prefix: $('#s-prefix').value, nextNumber: next,
        defaultGst: Number($('#s-gst').value), footerNote: $('#s-note').value.trim()
      })) toast('Invoice settings saved');
    });

    $('#bak-down').addEventListener('click', function () {
      var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'invoices-backup-' + todayISO() + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast('Backup downloaded');
    });
    $('#bak-up').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          if (!confirm('Replace all data on this device with the backup “' + f.name + '”?')) return;
          Store.importJSON(reader.result);
          toast('Backup restored');
          renderSettings();
          setBrand();
        } catch (err) { alert('Could not restore: ' + err.message); }
      };
      reader.readAsText(f);
      this.value = '';
    });
    $('#erase').addEventListener('click', function () {
      var typed = prompt('This deletes ' + Store.invoices.length + ' invoices and ' + Store.products.length +
        ' products from this device. Download a backup first if you may need them.\n\nType ERASE to confirm.');
      if (typed !== 'ERASE') return;
      Store.eraseAll();
      localStorage.removeItem(DRAFT_KEY);
      toast('All data erased');
      renderSettings();
      setBrand();
    });
  }

  function shrinkImage(file, maxW, maxH, done) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxW / img.width, maxH / img.height);
        var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        var png = /png|svg|gif|webp/.test(file.type);
        if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        done(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = function () { alert('That file could not be read as an image.'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  route();
})();
