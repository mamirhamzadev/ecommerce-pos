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

function formatInvoiceTime(iso) {
  const d = parseDbTimestamp(iso);
  if (!d || !d.isValid()) return '';
  return d.local().format('hh:mm A');
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
 * @param {{ invoice: import('../../global').InvoiceForPrint }} props
 */
function CustomerBlock({ invoice }) {
  const name = String(invoice.customer_name || '').trim();
  const contact = String(invoice.customer_contact || '').trim();
  const city = String(invoice.customer_city || '').trim();
  const address = String(invoice.customer_address || '').trim();
  const hasAny = name || contact || city || address;

  if (!hasAny) {
    return <p className="invoice-meta-empty">No customer details recorded.</p>;
  }

  return (
    <>
      {name ? <p className="invoice-customer-name">{name}</p> : null}
      {contact ? <p className="invoice-meta-line">{contact}</p> : null}
      {city ? <p className="invoice-meta-line">{city}</p> : null}
      {address ? <p className="invoice-meta-line invoice-address">{address}</p> : null}
    </>
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
  const issuedTime = formatInvoiceTime(invoice.created_at);
  const note = String(invoice.note || '').trim();
  const trackingId = String(invoice.tracking_id || '').trim();
  const orderNo = String(invoice.order_number || '').trim();
  const qrPayload = buildInvoiceQrPayload(orderNo, trackingId);

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
      <article className="invoice-sheet">
        <div className="invoice-sheet-body">
          <header className="invoice-sheet-header">
            <div className="invoice-brand">
              <img src={stampImg} alt="" className="invoice-stamp-img" />
            </div>
            {qrPayload ? (
              <div className="invoice-qr-wrap" aria-hidden="true">
                <QRCodeSVG
                  value={qrPayload}
                  size={68}
                  level="M"
                  marginSize={0}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
            ) : null}
            <span className="invoice-bulk-user" aria-hidden="true">Bulk User</span>
          </header>

          <div className="invoice-meta-grid">
            <section className="invoice-meta-card">
              <CustomerBlock invoice={invoice} />
            </section>
            <section className="invoice-meta-card">
              <dl className="invoice-details-dl">
                {trackingId ? (
                  <div>
                    <dt>Tracking ID</dt>
                    <dd className="invoice-mono">{trackingId}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Invoice No.</dt>
                  <dd className="invoice-mono">{invoice.invoice_number}</dd>
                </div>
                {invoice.order_number ? (
                  <div>
                    <dt>Order No.</dt>
                    <dd className="invoice-mono">{invoice.order_number}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Date</dt>
                  <dd>
                    {issuedAt}
                    {issuedTime ? ` · ${issuedTime}` : ''}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="invoice-lines-wrap">
            <table className="invoice-lines">
              <thead>
                <tr>
                  <th className="invoice-col-idx">#</th>
                  <th className="invoice-col-desc">Description</th>
                  <th className="invoice-col-num">Qty</th>
                  <th className="invoice-col-num">Unit wt.</th>
                  <th className="invoice-col-money">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="invoice-lines-empty">
                      No line items on this order.
                    </td>
                  </tr>
                ) : (
                  lines.map((row, idx) => (
                    <tr key={row.key}>
                      <td className="invoice-col-idx">{idx + 1}</td>
                      <td className="invoice-col-desc invoice-item-name">{row.productName}</td>
                      <td className="invoice-col-num">{qtyFmt.format(row.qty)}</td>
                      <td className="invoice-col-num">
                        {formatWeightG(row.unitWeightG) || '—'}
                      </td>
                      <td className="invoice-col-money invoice-amount-cell">
                        {pkr.format(row.lineTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="invoice-sheet-footer">
          {note ? (
            <section className="invoice-note">
              <h2>Order Note</h2>
              <p>{note}</p>
            </section>
          ) : null}

          <section className="invoice-summary" aria-label="Invoice totals">
            <table className="invoice-totals-table">
              <tbody>
                <tr>
                  <th scope="row">Items subtotal</th>
                  <td>{pkr.format(totals.itemsSubtotal)}</td>
                </tr>
                <tr>
                  <th scope="row">Delivery charges</th>
                  <td>{pkr.format(totals.delivery)}</td>
                </tr>
                <tr className="invoice-totals-grand-row">
                  <th scope="row">Total payable (PKR)</th>
                  <td>{pkr.format(totals.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <footer className="invoice-legal">
            <img src={footerImg} alt="" className="invoice-footer-img" />
          </footer>
        </div>
      </article>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
