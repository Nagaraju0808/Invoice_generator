# Shop Invoices

A simple GST invoice maker for a small shop. It runs in any web browser on a phone or a laptop, and
there is nothing to install. Your data is saved on the device you use.

## Opening the app

- **On a laptop:** open `index.html` in Chrome or Edge.
- **On a phone:** put the folder on any static web host (for example GitHub Pages: repository
  Settings → Pages → choose this branch), open the link in Chrome, then use the menu and pick
  **Add to Home screen**. It then opens like an app.

Your data stays inside the browser on that device, so a phone and a laptop each keep their own
copy. To move data between them, use **Settings → Backup** (see below).

## First-time setup (2 minutes)

1. Open **Settings**.
2. Under **Shop details**, enter your shop name, address, phone and GSTIN, and choose a logo if you
   have one. Leave GSTIN empty if your shop is not GST registered. Press **Save shop details**.
3. Under **Invoice numbers and GST**, set:
   - **Invoice prefix**, for example `INV-` or `2026-27/`
   - **Next number**: `1` for a new shop, or the number after your last paper bill
   - **Default GST rate** for new items
   - the **note** printed at the bottom (for example "Goods once sold will not be taken back")

   Press **Save invoice settings**.
4. Open **Products** and add the items you sell most, with their rate (before GST) and GST %.

## Making an invoice

1. Tap **New** (phone) or **New invoice** (laptop).
2. Type the customer's name, phone and address. Leave the name empty for a walk-in cash sale.
3. In **Items**, start typing an item name. Pick it from the list and its **rate and GST fill in by
   themselves**. Enter the quantity (decimals such as `0.5` kg work).
4. Press **Add item** for more rows, or the **×** at the end of a row to remove it.
5. Enter a **discount** if needed: choose **₹** for a fixed amount or **%** for a percentage.
6. The totals update as you type: subtotal, discount, taxable value, CGST, SGST, round off, grand
   total, and the amount in words.
7. Press **Save invoice**. The invoice gets the next number automatically and opens as an A4 page.

If you close the app halfway through, the unsaved invoice is still there when you come back.
Any new item name you type is added to your product list when you save.

## Printing or saving a PDF

On the invoice page press **Print or save PDF**.
- To print, choose your printer.
- For a PDF, choose **Save as PDF** as the printer, with paper size **A4**. On a phone, the PDF can
  then be shared on WhatsApp or email.

## History and sales totals

Open **History** to see every saved invoice, newest first.
- **Sales on**: the total for one day (today by default). Pick another date to check it.
- **Sales in**: the total for a month. The bar chart shows each day of that month; tap a bar to see
  that day's total.
- **Search** by invoice number, customer name, phone number or item name.
- Tap an invoice to open it, print it again, **Edit** it (it keeps its number) or delete it.

## Keeping your data safe

Everything is saved in this browser. Clearing the browser's data (or "site data") deletes it.
Once a week, go to **Settings → Download backup** and keep the file somewhere safe (email it to
yourself or save it to Google Drive). **Restore from backup** brings it back, on this device or a
new one.

## How the sums are worked out

- Amount = quantity × rate. Rates are entered **before GST**.
- The discount is shared across the items in proportion to their amounts, and GST is charged on the
  value after the discount (the taxable value).
- CGST and SGST are each half of the item's GST rate, worked out for each GST rate separately and
  shown in the **GST summary** on the invoice.
- The grand total is rounded to the nearest rupee; the difference is shown as **Round off**.
- All money is counted in whole paise, so totals never drift by a paisa.

Example (this is the sample invoice in the tests):

| Item | Qty | Rate | GST | Amount |
| --- | ---: | ---: | ---: | ---: |
| Basmati rice 5 kg | 2 | 450.00 | 5% | 900.00 |
| Sunflower oil 1 L | 3 | 145.50 | 5% | 436.50 |
| Toothpaste 150 g | 4 | 92.75 | 18% | 371.00 |
| Wheat flour 10 kg | 1 | 520.00 | 0% | 520.00 |

Subtotal 2,227.50 − discount 5% (111.38) = taxable 2,116.12; CGST 63.46 + SGST 63.46;
total 2,243.04, round off −0.04, **grand total ₹2,243.00** (Rupees Two Thousand Two Hundred
Forty-Three Only).

## Limits to know about

- Only CGST + SGST (sales inside your state). There is no IGST for customers in other states, and no
  HSN code or customer GSTIN column yet.
- Rates are always entered before GST. If your prices already include GST, enter the rate without it.
- Data is per device and per browser; use backups to move it.

## For developers

Plain HTML, CSS and JavaScript with no build step.

- `js/calc.js`: totals, Indian number format, amount in words (no browser needed)
- `js/store.js`: saving to `localStorage`, backup and restore
- `js/app.js`: the screens
- `tests/calc.test.js`: `node tests/calc.test.js` checks the sums against hand-worked figures
- `tests/e2e.test.js`: start `python3 -m http.server 8123` in this folder, then
  `node tests/e2e.test.js` types the sample invoice into the real app in a browser (needs Playwright)
