import { useCallback, useEffect, useRef, useState } from 'react';
import { getApi } from '../api';
import { FaIcon } from '../components/FaIcon';
import { InvoicePrintView } from '../components/InvoicePrintView';
import { RelativeTime } from '../RelativeTime';
import { notifyError } from '../lib/notify';
import {
  getStoredPageSize,
  PAGE_SIZE_OPTIONS,
  setStoredPageSize,
} from '../lib/pageSize';

const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 2,
});

function Invoices() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => getStoredPageSize());
  const [total, setTotal] = useState(0);
  const [invoices, setInvoices] = useState([]);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);
  const [printInvoice, setPrintInvoice] = useState(null);
  const [printingId, setPrintingId] = useState(null);
  const printTriggered = useRef(false);

  const loadList = useCallback(async (p, ps) => {
    setListError('');
    setLoading(true);
    const res = await getApi().listInvoicesPaged({ page: p, pageSize: ps });
    setLoading(false);
    if (res.ok === true) {
      setInvoices(res.invoices);
      setTotal(res.total);
      if (res.page !== p) {
        setPage(res.page);
      }
      return true;
    }
    setListError(res.error || 'Could not load invoices.');
    notifyError(res.error || 'Could not load invoices.');
    return false;
  }, []);

  useEffect(() => {
    loadList(page, pageSize);
  }, [page, pageSize, loadList]);

  useEffect(() => {
    if (!printInvoice || printTriggered.current) return undefined;
    printTriggered.current = true;
    const frame = requestAnimationFrame(() => {
      window.print();
      setPrintInvoice(null);
      setPrintingId(null);
      printTriggered.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [printInvoice]);

  const handlePrint = async (inv) => {
    if (printingId != null) return;
    setPrintingId(inv.id);
    const res = await getApi().getInvoiceForPrint({ id: inv.id });
    setPrintingId(null);
    if (res.ok !== true) {
      notifyError(res.error || 'Could not load invoice for printing.');
      return;
    }
    setPrintInvoice(res.invoice);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  return (
    <div className="products-page">
      {printInvoice ? <InvoicePrintView invoice={printInvoice} /> : null}

      <div className="products-page-header">
        <div>
          <h2 className="section-title">Invoices</h2>
          <p className="section-desc section-desc-tight">
            A draft invoice is created automatically whenever you place an order. Amounts include
            line items plus delivery charges.
          </p>
        </div>
      </div>

      {listError ? (
        <p className="empty-hint" role="alert">
          Could not load invoices. Try refreshing or check your connection.
        </p>
      ) : null}

      <div className="card">
        <div className="users-table-head">
          <h3 className="section-title section-title-sm">All invoices</h3>
          <div className="users-page-size">
            <span className="field-label">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value);
                setPage(1);
                setPageSize(next);
                setStoredPageSize(next);
              }}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="section-desc section-desc-tight">
          {total} invoice{total === 1 ? '' : 's'} total.
        </p>

        <div className="table-wrap">
          {loading ? (
            <p className="empty-hint">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="empty-hint">No invoices yet. They appear when you create orders.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Order</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Issued by</th>
                  <th>Created</th>
                  <th className="table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="cell-mono table-strong">{inv.invoice_number}</td>
                    <td className="cell-mono">{inv.order_number || '—'}</td>
                    <td className="cell-mono">{pkr.format(Number(inv.amount) || 0)}</td>
                    <td>{inv.status || '—'}</td>
                    <td>{inv.user_username || '—'}</td>
                    <td className="cell-mono">
                      <RelativeTime value={inv.created_at} />
                    </td>
                    <td className="table-actions">
                      <div
                        className="table-action-group"
                        role="group"
                        aria-label={`Invoice ${inv.invoice_number} actions`}
                      >
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm table-action-icon-btn"
                          aria-label={`Print invoice ${inv.invoice_number}`}
                          disabled={printingId === inv.id}
                          onClick={() => handlePrint(inv)}
                        >
                          <FaIcon icon="print" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {total > 0 && (totalPages > 1 || total > pageSize) ? (
          <div className="pagination-bar">
            <span className="pagination-meta">
              Page {page} of {totalPages}
            </span>
            <div className="pagination-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((x) => Math.max(1, x - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((x) => Math.min(totalPages, x + 1))}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Invoices;
