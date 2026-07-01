import { APP_NAME } from '../appName';
import { parseDbTimestamp } from '../RelativeTime';
import '../invoice-print.css';

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

function formatInvoiceTime(iso) {
  const d = parseDbTimestamp(iso);
  if (!d || !d.isValid()) return '';
  return d.local().format('hh:mm A');
}

function statusLabel(status) {
  const s = String(status || 'draft').toLowerCase();
  if (s === 'pending') return 'Pending';
  if (s === 'delivered') return 'Delivered';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'draft') return 'Draft';
  if (s === 'paid') return 'Paid';
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  const issuedBy =
    String(invoice.issued_by_name || '').trim() ||
    String(invoice.issued_by_username || '').trim() ||
    '—';
  const orderStatus = invoice.order_status
    ? statusLabel(invoice.order_status)
    : null;
  const invoiceStatus = statusLabel(invoice.status);
  const issuedAt = formatInvoiceDate(invoice.created_at);
  const issuedTime = formatInvoiceTime(invoice.created_at);
  const note = String(invoice.note || '').trim();
  const trackingId = String(invoice.tracking_id || '').trim();

  return (
    <div className="invoice-print-root" aria-hidden="true">
      <article className="invoice-sheet">
        <div className="invoice-sheet-body">
          <header className="invoice-sheet-header">
            <div className="invoice-brand">
              <div className="invoice-brand-mark" aria-hidden="true">
                {APP_NAME.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="invoice-brand-name">{APP_NAME}</p>
                <p className="invoice-brand-tagline">Sales Invoice</p>
              </div>
            </div>
            <div className="invoice-title-block">
              <p className="invoice-doc-label">Tax Invoice</p>
              <h1 className="invoice-number">{invoice.invoice_number}</h1>
              <span
                className={`invoice-status invoice-status-${String(invoice.status || 'draft').toLowerCase()}`}
              >
                {invoiceStatus}
              </span>
            </div>
          </header>

          <div className="invoice-meta-grid">
            <section className="invoice-meta-card">
              <h2>Bill To</h2>
              <CustomerBlock invoice={invoice} />
            </section>
            <section className="invoice-meta-card">
              <h2>Invoice Details</h2>
              <dl className="invoice-details-dl">
                <div>
                  <dt>Date</dt>
                  <dd>
                    {issuedAt}
                    {issuedTime ? ` · ${issuedTime}` : ''}
                  </dd>
                </div>
                {invoice.order_number ? (
                  <div>
                    <dt>Order No.</dt>
                    <dd className="invoice-mono">{invoice.order_number}</dd>
                  </div>
                ) : null}
                {orderStatus ? (
                  <div>
                    <dt>Order status</dt>
                    <dd>{orderStatus}</dd>
                  </div>
                ) : null}
                {trackingId ? (
                  <div>
                    <dt>Tracking ID</dt>
                    <dd className="invoice-mono">{trackingId}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Prepared by</dt>
                  <dd>{issuedBy}</dd>
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
                  <th className="invoice-col-num">Line wt.</th>
                  <th className="invoice-col-money">Unit price</th>
                  <th className="invoice-col-money">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="invoice-lines-empty">
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
                      <td className="invoice-col-num">
                        {formatWeightG(row.lineWeightG) || '—'}
                      </td>
                      <td className="invoice-col-money">{pkr.format(row.unitPrice)}</td>
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
            <div className="invoice-summary-meta">
              <div className="invoice-summary-stat">
                <span className="invoice-summary-stat-label">Line items</span>
                <span className="invoice-summary-stat-value">{totals.lineCount}</span>
              </div>
              <div className="invoice-summary-stat">
                <span className="invoice-summary-stat-label">Total quantity</span>
                <span className="invoice-summary-stat-value">{qtyFmt.format(totals.totalQty)}</span>
              </div>
              <div className="invoice-summary-stat">
                <span className="invoice-summary-stat-label">Total weight</span>
                <span className="invoice-summary-stat-value">
                  {formatWeightG(totals.totalWeightG) || '—'}
                </span>
              </div>
            </div>

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
            <p className="invoice-thanks">Thank you for your purchase.</p>
            <p className="invoice-legal-muted">
              Document ref. {invoice.invoice_number}
              {invoice.order_number ? ` · Order ${invoice.order_number}` : ''}
              {' · '}
              All amounts in Pakistani Rupees (PKR).
            </p>
          </footer>
        </div>
      </article>
    </div>
  );
}
