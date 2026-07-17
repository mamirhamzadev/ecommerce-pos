import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { parseDbTimestamp } from '../RelativeTime';
import postFormPage1 from '../assets/print/post-form-page-1.png';
import postFormPage2 from '../assets/print/post-form-page-2.png';
import stampImg from '../assets/print/stamp.png';
import footerImg from '../assets/print/footer.png';
import '../invoice-print.css';

const PRINT_FORM_PAGES = [postFormPage1, postFormPage2, stampImg, footerImg];

/** Preload postal form scans so pages 1–2 are ready before window.print(). */
export function preloadPrintFormPages() {
  return Promise.all(
    PRINT_FORM_PAGES.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        }),
    ),
  );
}

const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFmt = new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 2,
});

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function roundWeight(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function formatWeightG(g) {
  const n = Number(g);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1000) {
    const kg = n / 1000;
    return `${kg.toFixed(kg % 1 === 0 ? 0 : 2)} kg`;
  }
  return `${n % 1 === 0 ? n : n.toFixed(2)} g`;
}

function formatInvoiceDate(iso) {
  const d = parseDbTimestamp(iso);
  if (!d || !d.isValid()) return iso ? String(iso) : '—';
  return d.local().format('DD MMM YYYY');
}

const amountFiguresFmt = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmountFigures(n) {
  return amountFiguresFmt.format(roundMoney(n));
}

/** QR payload: orderNo on first line; trackingId on second when present. */
function buildInvoiceQrPayload(orderNo, trackingId) {
  const order = String(orderNo || '').trim();
  if (!order) return '';
  const tracking = String(trackingId || '').trim();
  if (tracking) {
    return `${order}\n${tracking}`;
  }
  return order;
}

/** Normalize line items so displayed amounts always match qty × unit price. */
function normalizeLines(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items.map((row, idx) => {
    const qty = Number(row.qty) || 0;
    const unitPrice = Number(row.unit_price) || 0;
    // order_items.weight_g stores total line weight (qty × unit weight), not per-unit.
    const storedLineWeightG = Number(row.weight_g) || 0;
    const lineWeightG = roundWeight(storedLineWeightG);
    const unitWeightG =
      qty > 0 ? roundWeight(storedLineWeightG / qty) : roundWeight(storedLineWeightG);
    const lineTotal = roundMoney(qty * unitPrice);
    return {
      key: `${idx}-${String(row.product_name || '').slice(0, 40)}`,
      productName: String(row.product_name || '').trim() || 'Unnamed item',
      qty,
      unitWeightG,
      lineWeightG,
      unitPrice,
      lineTotal,
    };
  });
}

function buildTotals(lines, invoice) {
  const itemsSubtotal = roundMoney(lines.reduce((sum, row) => sum + row.lineTotal, 0));
  const delivery = roundMoney(Number(invoice.delivery_charges) || 0);
  const computedGrand = roundMoney(itemsSubtotal + delivery);
  const storedGrand = roundMoney(Number(invoice.amount) || 0);
  const grandTotal = storedGrand > 0 ? storedGrand : computedGrand;
  const totalQty = roundMoney(lines.reduce((sum, row) => sum + row.qty, 0));
  const totalWeightG = roundWeight(lines.reduce((sum, row) => sum + row.lineWeightG, 0));
  const lineCount = lines.length;

  return {
    itemsSubtotal,
    delivery,
    grandTotal,
    totalQty,
    totalWeightG,
    lineCount,
  };
}

/**
 * Dynamic fields overlaid on the scanned V.P.P. postal form (page 2).
 * @param {{ invoice: import('../../global').InvoiceForPrint; totals: ReturnType<typeof buildTotals> }} props
 */
function PostFormPage2Overlay({ invoice, totals }) {
  const customerName = String(invoice.customer_name || '').trim();
  const customerCity = String(invoice.customer_city || '').trim();
  const trackingId = String(invoice.tracking_id || '').trim();
  const orderNo = String(invoice.order_number || '').trim();
  const qrPayload = buildInvoiceQrPayload(orderNo, trackingId);
  const orderDate = formatInvoiceDate(invoice.created_at);
  const amountFigures = formatAmountFigures(totals.grandTotal);
  const recipient = [customerName, customerCity].filter(Boolean).join(', ');

  return (
    <div className="post-form-p2-overlay" aria-hidden="true">
      {qrPayload ? (
        <div className="post-form-p2-qr">
          <QRCodeSVG
            value={qrPayload}
            size={96}
            level="M"
            marginSize={0}
            bgColor="#ffffff"
            fgColor="#111111"
          />
        </div>
      ) : null}
      <p className="post-form-p2-field post-form-p2-amount-figures">{amountFigures}</p>
      <p className="post-form-p2-field post-form-p2-customer-name">{recipient}</p>
      <p className="post-form-p2-field post-form-p2-intimation-amount">{amountFigures}</p>
      {trackingId ? (
        <p className="post-form-p2-field post-form-p2-tracking">{trackingId}</p>
      ) : null}
      <p className="post-form-p2-field post-form-p2-order-date">{orderDate}</p>
      <p className="post-form-p2-field post-form-p2-recipient-bottom">{recipient}</p>
    </div>
  );
}

/** @typedef {{ formFront?: boolean; formBack?: boolean; invoice?: boolean }} PrintPageOptions */

export const DEFAULT_PRINT_OPTIONS = {
  formFront: true,
  formBack: true,
  invoice: true,
};

/**
 * Full A4 sheet for one content type (used for single print and bulk grid cells).
 * @param {{
 *   invoice: import('../../global').InvoiceForPrint;
 *   kind: 'formFront' | 'formBack' | 'invoice';
 *   embedded?: boolean;
 * }} props
 */
export function InvoicePrintSheet({ invoice, kind, embedded = false }) {
  const lines = normalizeLines(invoice.items);
  const totals = buildTotals(lines, invoice);
  const pageClass = embedded
    ? 'invoice-print-sheet invoice-print-form-page'
    : 'invoice-print-page invoice-print-form-page';

  if (kind === 'formFront') {
    return (
      <div className={pageClass}>
        <img src={postFormPage1} alt="" className="invoice-print-form-img" />
      </div>
    );
  }

  if (kind === 'formBack') {
    return (
      <div className={pageClass}>
        <div className="invoice-print-form-canvas">
          <img src={postFormPage2} alt="" className="invoice-print-form-img" />
          <PostFormPage2Overlay invoice={invoice} totals={totals} />
        </div>
      </div>
    );
  }

  const sheetClass = embedded
    ? 'invoice-print-sheet invoice-print-invoice-page'
    : 'invoice-print-page invoice-print-invoice-page';

  const issuedAt = formatInvoiceDate(invoice.created_at);
  const trackingId = String(invoice.tracking_id || '').trim();
  const orderNo = String(invoice.order_number || '').trim();
  const qrPayload = buildInvoiceQrPayload(orderNo, trackingId);
  const customerName = String(invoice.customer_name || '').trim();
  const customerContact = String(invoice.customer_contact || '').trim();
  const customerCity = String(invoice.customer_city || '').trim();
  const customerAddress = String(invoice.customer_address || '').trim();
  const totalWeight = formatWeightG(totals.totalWeightG) || '';
  const urduNotice =
    'محترم پوسٹ مین: اگر پیکٹ کو کسٹمر تک نہ پہنچایا گیا اور بغیر واضح عذر کے واپس کیا گیا تو شکایت درج کرائی جا سکتی ہے۔ شکریہ\nفون لازمی کر کے اطلاع دیں۔';

  return (
    <div className={sheetClass}>
      <article className="inv3-sheet">
        <header className="inv3-header">
          <div className="inv3-header-col">
            <div className="inv3-stamp-box">
              <img src={stampImg} alt="" className="inv3-stamp-img" />
            </div>
            <div className="inv3-underline inv3-nic">
              <span className="inv3-value inv3-value-strong">33303-1500269-7</span>
            </div>
          </div>
          <div className="inv3-header-col inv3-header-col-right">
            <div className="inv3-brand-row">
              <div className="inv3-qr-wrap">
                <span className="inv3-bulk-user">BULK USER</span>
                <div className="inv3-qr-box" aria-hidden="true">
                  {qrPayload ? (
                    <QRCodeSVG
                      value={qrPayload}
                      size={128}
                      level="M"
                      marginSize={0}
                      bgColor="#ffffff"
                      fgColor="#111111"
                    />
                  ) : (
                    <span className="inv3-qr-placeholder">QR Code</span>
                  )}
                </div>
              </div>
            </div>
            <div className="inv3-underline inv3-total-amount">
              <span className="inv3-label">Total Amount</span>
              <span className="inv3-value">{pkr.format(totals.grandTotal)}</span>
            </div>
          </div>
        </header>

        <div className="inv3-box inv3-customer">
          <div className="inv3-field">
            <span className="inv3-label">Number/Email</span>
            <span className="inv3-value">{customerContact}</span>
          </div>
          <div className="inv3-field">
            <span className="inv3-label">Name</span>
            <span className="inv3-value">{customerName}</span>
          </div>
          <div className="inv3-field">
            <span className="inv3-label">Address</span>
            <span className="inv3-value inv3-value-strong">{customerAddress}</span>
          </div>
          <div className="inv3-field">
            <span className="inv3-label">City</span>
            <span className="inv3-value">{customerCity}</span>
          </div>
        </div>

        <div className="inv3-main">
          <div className="inv3-box inv3-items">
            <table className="inv3-items-table">
              <thead>
                <tr>
                  <th className="inv3-col-idx">#</th>
                  <th className="inv3-col-name">Item name</th>
                  <th className="inv3-col-qty">Qty</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="inv3-items-empty">
                      No items on this order.
                    </td>
                  </tr>
                ) : (
                  lines.map((row, idx) => (
                    <tr key={row.key}>
                      <td className="inv3-col-idx">{idx + 1}</td>
                      <td className="inv3-col-name">{row.productName}</td>
                      <td className="inv3-col-qty">{qtyFmt.format(row.qty)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="inv3-side">
            <div className="inv3-box inv3-side-meta">
              <div className="inv3-field inv3-field-split">
                <span className="inv3-label">Date</span>
                <span className="inv3-value">{issuedAt}</span>
              </div>
              <div className="inv3-field inv3-field-split">
                <span className="inv3-label">Tracking ID</span>
                <span className="inv3-value">{trackingId}</span>
              </div>
              <div className="inv3-field inv3-field-split">
                <span className="inv3-label">Invoice No</span>
                <span className="inv3-value">{invoice.invoice_number}</span>
              </div>
            </div>

            <div className="inv3-box inv3-side-meta">
              <div className="inv3-field inv3-field-split">
                <span className="inv3-label">Total Weight</span>
                <span className="inv3-value">{totalWeight}</span>
              </div>
              <div className="inv3-field inv3-field-split">
                <span className="inv3-label">Delivery Charges</span>
                <span className="inv3-value">{pkr.format(totals.delivery)}</span>
              </div>
            </div>

            <div className="inv3-urdu">
              <p className="inv3-urdu-text">{urduNotice}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function chunkItems(items, size) {
  const out = [];
  const n = Math.max(1, size);
  for (let i = 0; i < items.length; i += n) {
    out.push(items.slice(i, i + n));
  }
  return out;
}

function gridMeta(perPage) {
  const cols = 2;
  const rows = Math.ceil(perPage / cols);
  return { cols, rows };
}

/**
 * Renders one A4 page holding up to `perPage` full-size sheets scaled into a 2-column grid.
 * Full sheets are rendered at A4 then scaled — overlay positions stay pixel-accurate relative to the form.
 */
function BulkGridPage({ invoices, kind, perPage, pageKey }) {
  const { cols, rows } = gridMeta(perPage);
  const cells = Array.from({ length: rows * cols }, (_, i) => invoices[i] || null);

  // Max printer safe margin (0.5in). Cell pad 10px. Scale fills the inner flex frame.
  const SAFE_MM = 12.7;
  const GAP_MM = 2;
  const PAD_MM = (10 / 96) * 25.4; // 10px → mm
  const BORDER_MM = 0.5;
  const usableW = 210 - SAFE_MM * 2;
  const usableH = 297 - SAFE_MM * 2;
  const cellW = (usableW - (cols - 1) * GAP_MM) / cols;
  const cellH = (usableH - (rows - 1) * GAP_MM) / rows;
  const frameW = cellW - PAD_MM * 2 - BORDER_MM * 2;
  const frameH = cellH - PAD_MM * 2 - BORDER_MM * 2;
  const scale = Math.min(frameW / 210, frameH / 297);

  return (
    <div
      className="invoice-print-page bulk-print-grid-page"
      data-cols={cols}
      data-rows={rows}
      style={{ '--bulk-cols': cols, '--bulk-rows': rows, '--bulk-scale': scale }}
    >
      <div className="bulk-print-grid">
        {cells.map((inv, i) => (
          <div
            key={`${pageKey}-cell-${i}`}
            className={`bulk-print-cell${inv ? ' is-filled' : ' is-empty'}`}
          >
            {inv ? (
              <div className="bulk-print-cell-frame">
                <div className="bulk-print-cell-inner">
                  <InvoicePrintSheet invoice={inv} kind={kind} embedded />
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Build print pages for many invoices according to options + per-page density.
 * @param {{
 *   invoices: import('../../global').InvoiceForPrint[];
 *   options?: PrintPageOptions;
 *   perPage?: number;
 * }} props
 */
export function buildBulkPrintPages({ invoices, options = DEFAULT_PRINT_OPTIONS, perPage = 1 }) {
  const list = Array.isArray(invoices) ? invoices.filter(Boolean) : [];
  const n = Math.min(6, Math.max(1, Number(perPage) || 1));
  const kinds = [];
  if (options.formFront) kinds.push('formFront');
  if (options.formBack) kinds.push('formBack');
  if (options.invoice) kinds.push('invoice');

  const pages = [];
  if (list.length === 0 || kinds.length === 0) return pages;

  const chunks = chunkItems(list, n);
  chunks.forEach((chunk, chunkIdx) => {
    kinds.forEach((kind) => {
      if (n === 1) {
        chunk.forEach((inv, i) => {
          pages.push(
            <InvoicePrintSheet
              key={`p-${chunkIdx}-${kind}-${inv.id ?? i}`}
              invoice={inv}
              kind={kind}
            />,
          );
        });
      } else {
        pages.push(
          <BulkGridPage
            key={`g-${chunkIdx}-${kind}`}
            pageKey={`g-${chunkIdx}-${kind}`}
            invoices={chunk}
            kind={kind}
            perPage={n}
          />,
        );
      }
    });
  });
  return pages;
}

/**
 * Printable invoice layout — full A4, shown only during window.print().
 * @param {{
 *   invoice?: import('../../global').InvoiceForPrint;
 *   invoices?: import('../../global').InvoiceForPrint[];
 *   options?: PrintPageOptions;
 *   perPage?: number;
 *   preview?: boolean;
 * }} props
 */
export function InvoicePrintView({
  invoice,
  invoices,
  options = DEFAULT_PRINT_OPTIONS,
  perPage = 1,
  preview = false,
}) {
  const list = invoices?.length ? invoices : invoice ? [invoice] : [];
  const pages = buildBulkPrintPages({ invoices: list, options, perPage });

  const content = (
    <div
      className={preview ? 'invoice-print-root invoice-print-root-preview' : 'invoice-print-root'}
      aria-hidden={preview ? undefined : 'true'}
    >
      {pages}
    </div>
  );

  if (preview) return content;
  return createPortal(content, document.body);
}
