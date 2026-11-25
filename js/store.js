/*
 * Saves everything in the browser's localStorage, so data is still there when the app is reopened
 * on the same phone or laptop (same browser). Use Settings > Backup to move data or keep a copy.
 */
(function (root) {
  'use strict';

  var KEY = 'shop-invoices-v1';

  var DEFAULT_SETTINGS = {
    shopName: '',
    address: '',
    phone: '',
    gstin: '',
    logo: '',          // data URL, resized on upload
    prefix: 'INV-',
    nextNumber: 1,
    defaultGst: 5,
    footerNote: 'Thank you for shopping with us.'
  };

  function blank() {
    return { settings: Object.assign({}, DEFAULT_SETTINGS), products: [], invoices: [] };
  }

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var data = JSON.parse(raw);
      return {
        settings: Object.assign({}, DEFAULT_SETTINGS, data.settings || {}),
        products: Array.isArray(data.products) ? data.products : [],
        invoices: Array.isArray(data.invoices) ? data.invoices : []
      };
    } catch (e) {
      console.error('Could not read saved data', e);
      return blank();
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('Could not save', e);
      alert('Could not save. The browser storage may be full (a very large logo can cause this). ' +
        'Try a smaller logo, or download a backup from Settings.');
      return false;
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  var Store = {
    get settings() { return state.settings; },
    get products() { return state.products; },
    get invoices() { return state.invoices; },

    saveSettings: function (patch) {
      Object.assign(state.settings, patch);
      return persist();
    },

    // ----- products -----
    findProduct: function (name) {
      var n = String(name || '').trim().toLowerCase();
      if (!n) return null;
      for (var i = 0; i < state.products.length; i++) {
        if (state.products[i].name.toLowerCase() === n) return state.products[i];
      }
      return null;
    },
    upsertProduct: function (p) {
      var existing = p.id ? state.products.find(function (x) { return x.id === p.id; }) : null;
      if (existing) Object.assign(existing, p);
      else state.products.push({ id: uid(), name: p.name, rate: p.rate, gst: p.gst });
      state.products.sort(function (a, b) { return a.name.localeCompare(b.name); });
      return persist();
    },
    deleteProduct: function (id) {
      state.products = state.products.filter(function (p) { return p.id !== id; });
      return persist();
    },

    // ----- invoices -----
    getInvoice: function (id) {
      return state.invoices.find(function (x) { return x.id === id; }) || null;
    },
    // New invoices take the next number; edited ones keep theirs.
    saveInvoice: function (inv) {
      if (inv.id) {
        var existing = Store.getInvoice(inv.id);
        if (existing) {
          Object.assign(existing, inv, { updatedAt: new Date().toISOString() });
          persist();
          return existing;
        }
      }
      var s = state.settings;
      var seq = Math.max(1, parseInt(s.nextNumber, 10) || 1);
      var rec = Object.assign({}, inv, {
        id: uid(),
        seq: seq,
        number: Calc.formatInvoiceNumber(s.prefix, seq),
        createdAt: new Date().toISOString()
      });
      state.invoices.push(rec);
      s.nextNumber = seq + 1;
      // remember new item names so they fill in next time
      (inv.items || []).forEach(function (it) {
        if (it.name && !Store.findProduct(it.name) && Number(it.rate) > 0) {
          state.products.push({ id: uid(), name: it.name, rate: Number(it.rate), gst: Number(it.gst) || 0 });
        }
      });
      state.products.sort(function (a, b) { return a.name.localeCompare(b.name); });
      persist();
      return rec;
    },
    deleteInvoice: function (id) {
      state.invoices = state.invoices.filter(function (x) { return x.id !== id; });
      return persist();
    },

    // ----- backup -----
    exportJSON: function () {
      return JSON.stringify({ app: 'shop-invoices', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2);
    },
    importJSON: function (text) {
      var parsed = JSON.parse(text);
      var data = parsed && parsed.data ? parsed.data : parsed;
      if (!data || !data.settings || !Array.isArray(data.invoices)) throw new Error('This is not a backup file from this app.');
      state = {
        settings: Object.assign({}, DEFAULT_SETTINGS, data.settings),
        products: Array.isArray(data.products) ? data.products : [],
        invoices: data.invoices
      };
      return persist();
    },
    eraseAll: function () {
      state = blank();
      return persist();
    }
  };

  root.Store = Store;
})(this);
