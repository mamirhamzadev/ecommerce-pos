import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApi } from '../api';
import { FaIcon } from '../components/FaIcon';
import { BulkPrintModal } from '../components/BulkPrintModal';
import { InvoicePrintView, preloadPrintFormPages } from '../components/InvoicePrintView';
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
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [bulkPrintInvoices, setBulkPrintInvoices] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const printTriggered = useRef(false);

  const loadList = useCallback(async (p, ps) => {
    setListError('');
    setLoading(true);
    const res = await getApi().listInvoicesPaged({
      page: p,
      pageSize: ps,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
    });
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
  }, [filterDateFrom, filterDateTo]);

  const hasActiveFilters = filterDateFrom !== '' || filterDateTo !== '';

  function clearInvoiceFilters() {
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  }

  useEffect(() => {
    loadList(page, pageSize);
  }, [page, pageSize, loadList]);

  // Drop selections that are no longer on the current page.
  useEffect(() => {
    const visible = new Set(invoices.map((inv) => inv.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
        else changed = true;
      });
      return changed || next.size !== prev.size ? next : prev;
    });
  }, [invoices]);

  useEffect(() => {
    if (!printInvoice || printTriggered.current) return undefined;
    printTriggered.current = true;
    let cancelled = false;
    preloadPrintFormPages().then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
          setPrintInvoice(null);
          setPrintingId(null);
          printTriggered.current = false;
        });
      });
    });
    return () => {
      cancelled = true;
    };
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

  const pageIds = useMemo(() => invoices.map((inv) => inv.id), [invoices]);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = pageIds.some((id) => selectedIds.has(id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      return new Set(pageIds);
    });
  }

  function toggleSelectOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkPrint() {
    if (selectedIds.size === 0 || bulkLoading) return;
    setBulkLoading(true);
    const ids = [...selectedIds];
    const loaded = [];
    for (const id of ids) {
      const res = await getApi().getInvoiceForPrint({ id });
      if (res.ok === true && res.invoice) {
        loaded.push(res.invoice);
      } else {
        notifyError(res.error || 'Could not load an invoice for printing.');
        setBulkLoading(false);
        return;
      }
    }
    setBulkLoading(false);
    setBulkPrintInvoices(loaded);
    setBulkPrintOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  return (
    <div className="products-page">
      {printInvoice ? <InvoicePrintView invoice={printInvoice} /> : null}

      <BulkPrintModal
        open={bulkPrintOpen}
        invoices={bulkPrintInvoices}
        title={`Bulk print (${bulkPrintInvoices.length})`}
        onClose={() => {
          setBulkPrintOpen(false);
          setBulkPrintInvoices([]);
        }}
      />

      <div className="products-page-header">
        <div>
          <h2 className="section-title">Invoices</h2>
          <p className="section-desc section-desc-tight">
            A draft invoice is created automatically whenever you place an order. Amounts include
            items plus delivery charges.
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

        <div className="orders-filter-bar">
          <div className="orders-filter-field">
            <span className="field-label" id="invoices-filter-from-label">
              From date
            </span>
            <input
              id="invoices-filter-from"
              type="date"
              className="orders-filter-select"
              aria-labelledby="invoices-filter-from-label"
              value={filterDateFrom}
              max={filterDateTo || undefined}
              onChange={(e) => {
                setFilterDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="orders-filter-field">
            <span className="field-label" id="invoices-filter-to-label">
              To date
            </span>
            <input
              id="invoices-filter-to"
              type="date"
              className="orders-filter-select"
              aria-labelledby="invoices-filter-to-label"
              value={filterDateTo}
              min={filterDateFrom || undefined}
              onChange={(e) => {
                setFilterDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {hasActiveFilters ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearInvoiceFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        {selectedIds.size > 0 ? (
          <div className="bulk-actions-bar">
            <span className="bulk-actions-meta">
              <strong>{selectedIds.size}</strong> selected
            </span>
            <div className="bulk-actions-btns">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={bulkLoading}
                onClick={handleBulkPrint}
              >
                <FaIcon icon="print" /> {bulkLoading ? 'Loading…' : 'Print'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="table-wrap">
          {loading ? (
            <p className="empty-hint">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="empty-hint">No invoices yet. They appear when you create orders.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="table-select-col">
                    <input
                      type="checkbox"
                      className="pretty-check"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Select all invoices on this page"
                    />
                  </th>
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
                    <td className="table-select-col">
                      <input
                        type="checkbox"
                        className="pretty-check"
                        checked={selectedIds.has(inv.id)}
                        onChange={() => toggleSelectOne(inv.id)}
                        aria-label={`Select invoice ${inv.invoice_number}`}
                      />
                    </td>
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
