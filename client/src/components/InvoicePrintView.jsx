import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { APP_NAME } from '../appName';
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

/**
 * Printable invoice layout — full A4, shown only during window.print().
 * @param {{ invoice: import('../../global').InvoiceForPrint }} props
 */
export function InvoicePrintView({ invoice }) {
  const lines = normalizeLines(invoice.items);
  const totals = buildTotals(lines, invoice);
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

  const content = (
    <div className="invoice-print-root" aria-hidden="true">
      <div className="invoice-print-page invoice-print-form-page">
        <img src={postFormPage1} alt="" className="invoice-print-form-img" />
      </div>
      <div className="invoice-print-page invoice-print-form-page">
        <div className="invoice-print-form-canvas">
          <img src={postFormPage2} alt="" className="invoice-print-form-img" />
          <PostFormPage2Overlay invoice={invoice} totals={totals} />
        </div>
      </div>
      <div className="invoice-print-page invoice-print-invoice-page">
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
    </div>
  );

  return createPortal(content, document.body);
}
