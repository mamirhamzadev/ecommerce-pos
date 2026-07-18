import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import '../invoice-print.css';

const SHOP_NAME = 'Pak Traders';
const SHOP_NIC = '33303-1500269-7';

function formatAmount(n) {
  const v = Number(n);
  return (Number.isFinite(v) ? v : 0).toFixed(2);
}

function formatWeightG(g) {
  const n = Number(g);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1000) {
    return `${(n / 1000).toFixed(2)} kg`;
  }
  return `${n.toFixed(2)} g`;
}

function formatPrintedAt() {
  return dayjs().format('DD MMM YYYY, hh:mm:ss A');
}

/**
 * Printable summary table for selected invoices.
 * @param {{
 *   invoices: import('../../global').InvoiceListRow[];
 * }} props
 */
export function InvoiceSummaryPrintView({ invoices }) {
  const rows = Array.isArray(invoices) ? invoices.filter(Boolean) : [];
  const printedAt = formatPrintedAt();

  const content = (
    <div className="invoice-print-root" aria-hidden="true">
      <div className="invoice-print-page invoice-summary-print-page">
        <article className="inv-summary-sheet">
          <div className="inv-summary-shop">
            <div className="inv-summary-shop-name">{SHOP_NAME}</div>
            <div className="inv-summary-shop-number">{SHOP_NIC}</div>
          </div>

          <div className="inv-summary-meta-row">
            <span>Total invoices: {rows.length}</span>
            <span>Printed at: {printedAt}</span>
          </div>

          <div className="inv3-box inv3-items inv-summary-items">
            <table className="inv3-items-table">
              <thead>
                <tr>
                  <th className="inv3-col-idx">#</th>
                  <th className="inv-summary-col-invoice">Invoice #</th>
                  <th className="inv-summary-col-tracking">Tracking ID</th>
                  <th className="inv-summary-col-customer">Customer</th>
                  <th className="inv-summary-col-city">City</th>
                  <th className="inv-summary-col-num">Amount</th>
                  <th className="inv-summary-col-num">Delivery</th>
                  <th className="inv-summary-col-num">Weight</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="inv3-items-empty">
                      No invoices selected.
                    </td>
                  </tr>
                ) : (
                  rows.map((inv, idx) => (
                    <tr key={inv.id ?? idx}>
                      <td className="inv3-col-idx">{idx + 1}</td>
                      <td className="inv-summary-col-invoice">
                        {inv.invoice_number || '—'}
                      </td>
                      <td className="inv-summary-col-tracking">
                        {inv.tracking_id && String(inv.tracking_id).trim()
                          ? String(inv.tracking_id).trim()
                          : '—'}
                      </td>
                      <td className="inv-summary-col-customer">
                        {String(inv.customer_name || '').trim() || '—'}
                      </td>
                      <td className="inv-summary-col-city">
                        {String(inv.customer_city || '').trim() || '—'}
                      </td>
                      <td className="inv-summary-col-num">{formatAmount(inv.amount)}</td>
                      <td className="inv-summary-col-num">
                        {formatAmount(inv.delivery_charges)}
                      </td>
                      <td className="inv-summary-col-num">
                        {formatWeightG(inv.total_weight_g)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
