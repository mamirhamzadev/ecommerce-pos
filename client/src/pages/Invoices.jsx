import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApi } from '../api';
import { FaIcon } from '../components/FaIcon';
import { BulkPrintModal } from '../components/BulkPrintModal';
import { InvoicePrintView, preloadPrintFormPages } from '../components/InvoicePrintView';
import { InvoiceSummaryPrintView } from '../components/InvoiceSummaryPrintView';
import { notifyError } from '../lib/notify';
import {
  getStoredPageSize,
  PAGE_SIZE_OPTIONS,
  setStoredPageSize,
} from '../lib/pageSize';

const amountFmt = new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 2,
});

function formatAmount(n) {
  return amountFmt.format(Number(n) || 0);
}

function formatWeightG(g) {
  const n = Number(g);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1000) {
    const kg = n / 1000;
    return `${kg.toFixed(kg % 1 === 0 ? 0 : 2)} kg`;
  }
  return `${n % 1 === 0 ? n : n.toFixed(2)} g`;
}

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
  const [summaryPrintRows, setSummaryPrintRows] = useState(null);
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const printTriggered = useRef(false);
  const summaryPrintTriggered = useRef(false);

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

  // Drop selection when date filters change so prints only use the current result set.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterDateFrom, filterDateTo]);

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

  useEffect(() => {
    if (!summaryPrintRows || summaryPrintTriggered.current) return undefined;
    summaryPrintTriggered.current = true;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        window.print();
        setSummaryPrintRows(null);
        summaryPrintTriggered.current = false;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [summaryPrintRows]);

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
  const allMatchingSelected = total > 0 && selectedIds.size === total;

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
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

  async function handleSelectAllMatching() {
    if (selectAllLoading || total === 0) return;
    setSelectAllLoading(true);
    const res = await getApi().listInvoiceIds({
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
    });
    setSelectAllLoading(false);
    if (res.ok !== true) {
      notifyError(res.error || 'Could not select all invoices.');
      return;
    }
    setSelectedIds(new Set(res.ids || []));
  }

  function clearSelection() {
    setSelectedIds(new Set());
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

  async function handlePrintSummary() {
    if (selectedIds.size === 0 || bulkLoading) return;
    setBulkLoading(true);
    const res = await getApi().listInvoicesByIds({ ids: [...selectedIds] });
    setBulkLoading(false);
    if (res.ok !== true) {
      notifyError(res.error || 'Could not load invoices for summary print.');
      return;
    }
    summaryPrintTriggered.current = false;
    setSummaryPrintRows(res.invoices || []);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const rowOffset = (page - 1) * pageSize;

  return (
    <div className="products-page">
      {printInvoice ? <InvoicePrintView invoice={printInvoice} /> : null}
      {summaryPrintRows ? <InvoiceSummaryPrintView invoices={summaryPrintRows} /> : null}

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
              {allMatchingSelected ? (
                <>
                  {' '}
                  (all{hasActiveFilters ? ' matching' : ''})
                </>
              ) : null}
            </span>
            <div className="bulk-actions-btns">
              {!allMatchingSelected && total > selectedIds.size ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={selectAllLoading}
                  onClick={handleSelectAllMatching}
                >
                  {selectAllLoading
                    ? 'Selecting…'
                    : `Select all ${total}${hasActiveFilters ? ' matching' : ''}`}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={bulkLoading}
                onClick={handlePrintSummary}
              >
                <FaIcon icon="list" /> {bulkLoading ? 'Loading…' : 'Print summary'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={bulkLoading}
                onClick={handleBulkPrint}
              >
                <FaIcon icon="print" /> {bulkLoading ? 'Loading…' : 'Print invoices'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={bulkLoading || selectAllLoading}
                onClick={clearSelection}
              >
                Clear
              </button>
            </div>
          </div>
        ) : total > pageIds.length ? (
          <div className="bulk-actions-bar">
            <span className="bulk-actions-meta">
              Header checkbox selects this page only.
            </span>
            <div className="bulk-actions-btns">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={selectAllLoading || total === 0}
                onClick={handleSelectAllMatching}
              >
                {selectAllLoading
                  ? 'Selecting…'
                  : `Select all ${total} invoice${total === 1 ? '' : 's'}${hasActiveFilters ? ' (filtered)' : ''}`}
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
                  <th>#</th>
                  <th>Invoice #</th>
                  <th>Tracking ID</th>
                  <th>Customer</th>
                  <th>City</th>
                  <th>Amount</th>
                  <th>Delivery charges</th>
                  <th>Total weight</th>
                  <th className="table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => (
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
                    <td className="cell-mono">{rowOffset + idx + 1}</td>
                    <td className="cell-mono table-strong whitespace-nowrap">
                      {inv.invoice_number}
                    </td>
                    <td
                      className="cell-mono whitespace-nowrap"
                      title={
                        inv.tracking_id && String(inv.tracking_id).trim()
                          ? String(inv.tracking_id).trim()
                          : undefined
                      }
                    >
                      {inv.tracking_id && String(inv.tracking_id).trim()
                        ? String(inv.tracking_id).trim()
                        : '—'}
                    </td>
                    <td>{String(inv.customer_name || '').trim() || '—'}</td>
                    <td>{String(inv.customer_city || '').trim() || '—'}</td>
                    <td className="cell-mono">{formatAmount(inv.amount)}</td>
                    <td className="cell-mono">
                      {formatAmount(inv.delivery_charges)}
                    </td>
                    <td className="cell-mono">{formatWeightG(inv.total_weight_g)}</td>
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
