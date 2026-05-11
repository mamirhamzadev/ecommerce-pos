import { useCallback, useEffect, useRef, useState } from 'react';
import { getApi } from '../../api';
import { RelativeTime } from '../../RelativeTime';
import { FaIcon } from '../FaIcon';

const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 2,
});

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...STATUS_OPTIONS,
];

function rowStatusValue(s) {
  const v = String(s || 'pending').toLowerCase();
  if (v === 'completed') return 'delivered';
  if (STATUS_OPTIONS.some((opt) => opt.value === v)) return v;
  return 'pending';
}

function newLineKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newOrderLine() {
  return {
    key: newLineKey(),
    productId: null,
    productName: '',
    qty: '1',
    weightG: '',
    unitPricePkr: '',
  };
}

/** Stable key for the draft row so the product combobox state syncs correctly */
function newDraftLine() {
  return {
    key: 'draft',
    productId: null,
    productName: '',
    qty: '1',
    weightG: '',
    unitPricePkr: '',
  };
}

function emptyForm() {
  return {
    customerName: '',
    customerContact: '',
    customerCity: '',
    customerAddress: '',
    note: '',
    status: 'pending',
  };
}

function CustomerCell({ name, contact, city, address }) {
  return (
    <div className="customer-cell">
      <div className="customer-cell-name">{name || '—'}</div>
      {contact ? <div className="customer-cell-line muted">{contact}</div> : null}
      {city ? <div className="customer-cell-line muted">{city}</div> : null}
      {address ? <div className="customer-cell-line muted customer-cell-address">{address}</div> : null}
    </div>
  );
}

/** Compact line summary + opens full detail in a modal */
function OrderLineItemsSummary({ items, lineCount, total, onView }) {
  const list = Array.isArray(items) ? items : [];
  const n = Number(lineCount) || list.length;
  const t = Number(total) || 0;
  const canView = list.length > 0;
  return (
    <div className="orders-lines-cell orders-lines-cell-compact">
      <div className="orders-lines-summary-text">
        <span className="orders-lines-summary-inline">
          <span className="orders-lines-count">
            <strong>{n}</strong> {n === 1 ? 'item' : 'items'}
          </span>
          <span className="orders-lines-total">{` . ${pkr.format(t)}`}</span>
        </span>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm order-view-lines-btn"
        disabled={!canView}
        title={canView ? 'Show all line items' : 'No line items loaded'}
        onClick={(e) => {
          e.stopPropagation();
          if (canView) onView();
        }}
      >
        Details
      </button>
    </div>
  );
}

function OrderLineItemsViewModal({ order, onClose }) {
  if (!order) return null;
  const items = Array.isArray(order.items) ? order.items : [];
  const n = Number(order.line_count) || items.length;
  const t = Number(order.total) || 0;

  return (
    <div
      className="modal-backdrop order-view-lines-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog modal-dialog-wide order-view-lines-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-view-lines-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="order-view-lines-title" className="modal-title">
          Line items
        </h2>
        <p className="modal-order-ref cell-mono">Order {order.order_number}</p>
        <p className="order-view-lines-meta muted">
          {n} {n === 1 ? 'item' : 'items'} · Total {pkr.format(t)}
        </p>
        <div className="table-wrap order-view-lines-table-wrap">
          {items.length === 0 ? (
            <p className="empty-hint">No line rows for this order.</p>
          ) : (
            <table className="data-table order-view-lines-table">
              <thead>
                <tr>
                  <th className="order-view-col-idx">#</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Weight</th>
                  <th>Unit price</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id ?? `${idx}-${it.product_name}`}>
                    <td className="cell-mono order-view-col-idx">{idx + 1}</td>
                    <td>{it.product_name}</td>
                    <td className="cell-mono">{it.qty}</td>
                    <td className="cell-mono">
                      {Number.isFinite(Number(it.weight_g)) ? `${it.weight_g} g` : '—'}
                    </td>
                    <td className="cell-mono">{pkr.format(Number(it.unit_price) || 0)}</td>
                    <td className="cell-mono">{pkr.format(Number(it.line_total) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-actions order-view-lines-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Draft line item form (product search + qty + weight + unit price). Stays fixed above the added-lines table.
 */
function OrderLineDraftForm({ line, onChange, readOnly = false }) {
  const [query, setQuery] = useState(line.productName || '');
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(line.productName || '');
  }, [line.key, line.productName]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await getApi().listProductsPicker({ search: query });
      if (cancelled) return;
      setLoading(false);
      if (res.ok === true) {
        setProducts(res.products);
      } else {
        setProducts([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  function pickProduct(p) {
    if (readOnly) return;
    onChange({
      ...line,
      productId: p.id,
      productName: p.name,
      weightG: String(p.weight_g ?? ''),
      unitPricePkr: String(p.price ?? ''),
    });
    setQuery(p.name);
    setOpen(false);
  }

  function onSearchInput(value) {
    if (readOnly) return;
    setQuery(value);
    setOpen(true);
    onChange({
      ...line,
      productId: null,
      productName: '',
    });
  }

  const linePreview =
    Number.isFinite(Number(line.qty)) && Number.isFinite(Number(line.unitPricePkr))
      ? Number(line.qty) * Number(line.unitPricePkr)
      : null;

  return (
    <div className="order-draft-line-form">
      <div className="field" ref={wrapRef}>
        <span className="field-label">Product (search catalog)</span>
        <div className="product-combobox-input-wrap">
          <input
            type="text"
            className="product-combobox-input"
            role="combobox"
            aria-expanded={open}
            aria-controls="order-draft-line-listbox"
            autoComplete="off"
            placeholder="Search…"
            value={query}
            disabled={readOnly}
            onChange={(e) => onSearchInput(e.target.value)}
            onFocus={() => {
              if (!readOnly) setOpen(true);
            }}
          />
          <button
            type="button"
            className={`product-combobox-toggle${open ? ' product-combobox-toggle-open' : ''}`}
            aria-label={open ? 'Close list' : 'Open list'}
            disabled={readOnly}
            onClick={() => {
              if (readOnly) return;
              setOpen((v) => !v);
            }}
          >
            <FaIcon icon="chevron-down" className="fa-combobox-chevron" />
          </button>
        </div>
        {open ? (
          <ul
            id="order-draft-line-listbox"
            className="product-combobox-list"
            role="listbox"
          >
            {loading ? (
              <li className="product-combobox-hint">Loading…</li>
            ) : products.length === 0 ? (
              <li className="product-combobox-hint">
                {query.trim() ? 'No matches.' : 'No products — add some first.'}
              </li>
            ) : (
              products.map((p) => (
                <li key={p.id} role="none">
                  <button
                    type="button"
                    role="option"
                    className={`product-combobox-item${
                      line.productId === p.id ? ' product-combobox-item-active' : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickProduct(p)}
                  >
                    <span className="product-combobox-item-name">{p.name}</span>
                    <span className="product-combobox-item-meta">
                      {Number.isFinite(Number(p.weight_g)) ? `${p.weight_g} g` : '—'} ·{' '}
                      {pkr.format(Number(p.price) || 0)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      <div className="field">
        <span className="field-label">Quantity</span>
        <input
          type="number"
          min={0.001}
          step="any"
          value={line.qty}
          disabled={readOnly}
          onChange={(e) => onChange({ ...line, qty: e.target.value })}
        />
      </div>
      <div className="order-modal-line-grid">
        <div className="field">
          <span className="field-label">Weight (g)</span>
          <input
            type="number"
            min={0}
            step="any"
            value={line.weightG}
            disabled={readOnly}
            onChange={(e) => onChange({ ...line, weightG: e.target.value })}
          />
        </div>
        <div className="field">
          <span className="field-label">Unit price (PKR)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={line.unitPricePkr}
            disabled={readOnly}
            onChange={(e) => onChange({ ...line, unitPricePkr: e.target.value })}
          />
        </div>
      </div>
      <p className="modal-total-preview order-line-subtotal">
        This line (preview):{' '}
        <strong>{linePreview != null ? pkr.format(linePreview) : '—'}</strong>
      </p>
    </div>
  );
}

/** @param {{ permissions: ReturnType<typeof import('../../permissions').mergePermissions> }} props */
export function OrdersModule({ permissions }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [orders, setOrders] = useState([]);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSearchInput, setFilterSearchInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingOrderNumber, setEditingOrderNumber] = useState('');
  const [draftLine, setDraftLine] = useState(() => newDraftLine());
  const [lines, setLines] = useState(() => []);
  const [linesTableExpanded, setLinesTableExpanded] = useState(true);
  const [form, setForm] = useState(() => emptyForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [viewLinesOrder, setViewLinesOrder] = useState(null);

  const orderEditTokenRef = useRef(0);
  const lastSearchCommittedRef = useRef('');

  const closeModal = useCallback(() => {
    orderEditTokenRef.current += 1;
    setModalOpen(false);
    setEditingId(null);
    setEditingOrderNumber('');
    setLines([]);
    setDraftLine(newDraftLine());
    setLinesTableExpanded(true);
    setForm(emptyForm());
    setFormError('');
  }, []);

  const loadList = useCallback(async (p, ps) => {
    setListError('');
    setLoading(true);
    const res = await getApi().listOrdersPaged({
      page: p,
      pageSize: ps,
      status: filterStatus,
      q: filterSearch,
    });
    setLoading(false);
    if (res.ok === true) {
      setOrders(res.orders);
      setTotal(res.total);
      if (res.page !== p) {
        setPage(res.page);
      }
      return true;
    }
    setListError(res.error || 'Could not load orders.');
    return false;
  }, [filterStatus, filterSearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = filterSearchInput.trim();
      if (lastSearchCommittedRef.current !== next) {
        lastSearchCommittedRef.current = next;
        setPage(1);
      }
      setFilterSearch(next);
    }, 350);
    return () => clearTimeout(t);
  }, [filterSearchInput]);

  useEffect(() => {
    loadList(page, pageSize);
  }, [page, pageSize, loadList]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        closeModal();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen, closeModal]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const closeViewLinesModal = useCallback(() => {
    setViewLinesOrder(null);
  }, []);

  useEffect(() => {
    if (!viewLinesOrder) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        closeViewLinesModal();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewLinesOrder, closeViewLinesModal]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateTableLine(key, patch) {
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /** Same catalog line at same weight & unit price → merge by increasing qty */
  function tableRowMatchesDraft(row, productId, weightG, unitPrice) {
    return (
      Number(row.productId) === Number(productId) &&
      Number(row.weightG) === weightG &&
      Number(row.unitPricePkr) === unitPrice
    );
  }

  function addDraftLineToTable() {
    const canMutateLines = editingId
      ? permissions.canEditOrder
      : permissions.canCreateOrder;
    if (!canMutateLines) return;
    setFormError('');
    const L = draftLine;
    if (L.productId == null || !String(L.productName || '').trim()) {
      setFormError('Select a product from the catalog, then add the line.');
      return;
    }
    const qty = Number(L.qty);
    const wg = Number(L.weightG);
    const up = Number(L.unitPricePkr);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Quantity must be a positive number.');
      return;
    }
    if (!Number.isFinite(wg) || wg < 0) {
      setFormError('Weight (g) must be zero or positive.');
      return;
    }
    if (!Number.isFinite(up) || up < 0) {
      setFormError('Unit price must be zero or positive.');
      return;
    }
    const pid = Number(L.productId);
    setLines((rows) => {
      const mergeIdx = rows.findIndex((r) => tableRowMatchesDraft(r, pid, wg, up));
      if (mergeIdx >= 0) {
        return rows.map((r, i) => {
          if (i !== mergeIdx) return r;
          const combined = Number(r.qty) + qty;
          return {
            ...r,
            qty: String(combined),
          };
        });
      }
      return [
        ...rows,
        {
          key: newLineKey(),
          productId: L.productId,
          productName: L.productName.trim(),
          qty: String(L.qty),
          weightG: String(L.weightG),
          unitPricePkr: String(L.unitPricePkr),
        },
      ];
    });
    setDraftLine(newDraftLine());
    setLinesTableExpanded(true);
  }

  function openCreate() {
    if (!permissions.canCreateOrder) return;
    orderEditTokenRef.current += 1;
    setEditingId(null);
    setEditingOrderNumber('');
    setLines([]);
    setDraftLine(newDraftLine());
    setLinesTableExpanded(true);
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(o) {
    if (!permissions.canEditOrder) return;
    orderEditTokenRef.current += 1;
    setEditingId(o.id);
    setEditingOrderNumber(o.order_number || '');
    const rawItems = Array.isArray(o.items) && o.items.length > 0 ? o.items : null;
    if (rawItems) {
      setLines(
        rawItems.map((it) => ({
          key: `e-${it.id}-${newLineKey()}`,
          productId: it.product_id != null ? Number(it.product_id) : null,
          productName: it.product_name || '',
          qty: String(it.qty ?? 1),
          weightG: String(it.weight_g ?? ''),
          unitPricePkr: String(it.unit_price ?? ''),
        })),
      );
    } else {
      setLines([
        {
          key: newLineKey(),
          productId: null,
          productName: o.product_name || '',
          qty: String(o.qty ?? 1),
          weightG: String(o.weight_g ?? ''),
          unitPricePkr: String(o.unit_price ?? ''),
        },
      ]);
    }
    setForm({
      customerName: o.customer_name || '',
      customerContact: o.customer_contact || '',
      customerCity: o.customer_city || '',
      customerAddress: o.customer_address || '',
      note: o.note || '',
      status: rowStatusValue(o.status),
    });
    setFormError('');
    setModalOpen(true);
    setDraftLine(newDraftLine());
    setLinesTableExpanded(true);
  }

  const orderPreviewTotal = lines.reduce((sum, L) => {
    const q = Number(L.qty);
    const u = Number(L.unitPricePkr);
    if (!Number.isFinite(q) || !Number.isFinite(u)) return sum;
    return sum + q * u;
  }, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (editingId) {
      if (!permissions.canEditOrder) return;
    } else if (!permissions.canCreateOrder) {
      return;
    }
    setFormError('');
    if (lines.length === 0) {
      setFormError('Add at least one line item: fill the form above, then use “Add line item to order”.');
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (L.productId == null || !String(L.productName || '').trim()) {
        setFormError(`Line ${i + 1}: select a product from the catalog.`);
        return;
      }
      const qty = Number(L.qty);
      const wg = Number(L.weightG);
      const up = Number(L.unitPricePkr);
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError(`Line ${i + 1}: quantity must be positive.`);
        return;
      }
      if (!Number.isFinite(wg) || wg < 0) {
        setFormError(`Line ${i + 1}: weight (g) must be zero or positive.`);
        return;
      }
      if (!Number.isFinite(up) || up < 0) {
        setFormError(`Line ${i + 1}: unit price must be zero or positive.`);
        return;
      }
    }
    if (!form.customerName.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    setSaving(true);
    const payloadLines = lines.map((L) => ({
      productId: L.productId,
      productName: L.productName.trim(),
      qty: Number(L.qty),
      weightG: Number(L.weightG),
      unitPricePkr: Number(L.unitPricePkr),
    }));
    const body = {
      lines: payloadLines,
      customerName: form.customerName.trim(),
      customerContact: form.customerContact.trim(),
      customerCity: form.customerCity.trim(),
      customerAddress: form.customerAddress.trim(),
      note: form.note.trim(),
      status: form.status,
    };
    const res = editingId
      ? await getApi().updateOrder({ id: editingId, ...body })
      : await getApi().createOrder(body);
    setSaving(false);
    if (res.ok !== true) {
      setFormError(res.error || 'Could not save order.');
      return;
    }
    if (res.emailWarning) {
      setToast(res.emailWarning);
    }
    const wasEdit = Boolean(editingId);
    const listPage = wasEdit ? page : 1;
    closeModal();
    if (!wasEdit) {
      setPage(1);
    }
    await loadList(listPage, pageSize);
  }

  async function handleDelete(o) {
    if (!permissions.canDeleteOrder) return;
    if (!window.confirm(`Delete order ${o.order_number}?`)) return;
    setListError('');
    const res = await getApi().deleteOrder({ id: o.id });
    if (!res.ok) {
      setListError(res.error || 'Delete failed.');
      return;
    }
    await loadList(page, pageSize);
  }

  async function handleStatusChange(o, nextStatus) {
    if (!permissions.canChangeOrderStatus) return;
    const prev = o.status;
    setOrders((rows) =>
      rows.map((r) => (r.id === o.id ? { ...r, status: nextStatus } : r)),
    );
    const res = await getApi().patchOrderStatus({ id: o.id, status: nextStatus });
    if (!res.ok) {
      setOrders((rows) =>
        rows.map((r) => (r.id === o.id ? { ...r, status: prev } : r)),
      );
      setListError(res.error || 'Could not update status.');
      return;
    }
    setListError('');
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const hasActiveFilters =
    filterStatus !== 'all' || filterSearchInput.trim() !== '';

  const canMutateOrderLines = editingId
    ? permissions.canEditOrder
    : permissions.canCreateOrder;

  function clearOrderFilters() {
    setFilterStatus('all');
    setFilterSearchInput('');
    setFilterSearch('');
    lastSearchCommittedRef.current = '';
    setPage(1);
  }

  return (
    <div className="products-page orders-page">
      <div className="products-page-header">
        <div>
          <h2 className="section-title">Orders</h2>
          <p className="section-desc section-desc-tight">
            Each order can include multiple catalog lines. New orders email admins when mail is
            configured.
          </p>
        </div>
        {permissions.canCreateOrder ? (
          <button
            type="button"
            className="fab-plus"
            aria-label="New order"
            onClick={openCreate}
          >
            <FaIcon icon="plus" className="fab-plus-fa" />
          </button>
        ) : null}
      </div>

      {toast ? (
        <div className="alert order-toast" role="status">
          {toast}
        </div>
      ) : null}
      {listError ? (
        <div className="alert alert-error" role="alert">
          {listError}
        </div>
      ) : null}

      <div className="card">
        <div className="users-table-head">
          <h3 className="section-title section-title-sm">All orders</h3>
          <div className="users-page-size">
            <span className="field-label">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
              aria-label="Rows per page"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <p className="section-desc section-desc-tight">
          {total} order{total === 1 ? '' : 's'}
          {hasActiveFilters ? ' match your filters.' : ' total.'}
        </p>

        <div className="orders-filter-bar">
          <div className="orders-filter-field">
            <span className="field-label" id="orders-filter-status-label">
              Status
            </span>
            <select
              id="orders-filter-status"
              className="orders-filter-select"
              aria-labelledby="orders-filter-status-label"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="orders-filter-field orders-filter-grow">
            <span className="field-label" id="orders-filter-q-label">
              Search
            </span>
            <input
              id="orders-filter-q"
              type="search"
              className="orders-filter-search"
              placeholder="Customer name, order #, or ID"
              aria-labelledby="orders-filter-q-label"
              autoComplete="off"
              value={filterSearchInput}
              onChange={(e) => setFilterSearchInput(e.target.value)}
            />
          </div>
          {hasActiveFilters ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearOrderFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="table-wrap orders-table-wrap">
          {loading ? (
            <p className="empty-hint">Loading…</p>
          ) : orders.length === 0 ? (
            <p className="empty-hint">
              {hasActiveFilters
                ? 'No orders match these filters.'
                : 'No orders yet. Tap + to create one.'}
            </p>
          ) : (
            <table className="data-table orders-data-table orders-data-table-compact">
              <thead>
                <tr>
                  <th className="orders-col-order">Order #</th>
                  <th className="orders-col-lines">Line items</th>
                  <th className="orders-col-customer">Customer</th>
                  <th className="orders-col-created">Created at</th>
                  <th className="orders-col-note">Note</th>
                  <th className="orders-col-status">Status</th>
                  <th className="orders-col-actions table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="orders-col-order table-strong cell-mono">{o.order_number}</td>
                    <td className="orders-col-lines">
                      <OrderLineItemsSummary
                        items={o.items}
                        lineCount={o.line_count}
                        total={o.total}
                        onView={() => setViewLinesOrder(o)}
                      />
                    </td>
                    <td className="orders-col-customer">
                      <CustomerCell
                        name={o.customer_name}
                        contact={o.customer_contact}
                        city={o.customer_city}
                        address={o.customer_address}
                      />
                    </td>
                    <td className="orders-col-created cell-mono orders-cell-nowrap">
                      <RelativeTime value={o.created_at} />
                    </td>
                    <td className="orders-col-note orders-note-cell">{o.note || '—'}</td>
                    <td className="orders-col-status">
                      <select
                        className="status-select"
                        value={rowStatusValue(o.status)}
                        aria-label={`Status for ${o.order_number}`}
                        disabled={!permissions.canChangeOrderStatus}
                        onChange={(e) => handleStatusChange(o, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="orders-col-actions table-actions">
                      {permissions.canEditOrder || permissions.canDeleteOrder ? (
                        <div className="table-action-group" role="group" aria-label="Order actions">
                          {permissions.canEditOrder ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm table-action-icon-btn"
                              aria-label={`Edit order ${o.order_number}`}
                              onClick={() => openEdit(o)}
                            >
                              <FaIcon icon="pen-to-square" />
                            </button>
                          ) : null}
                          {permissions.canDeleteOrder ? (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm table-action-icon-btn"
                              aria-label={`Delete order ${o.order_number}`}
                              onClick={() => handleDelete(o)}
                            >
                              <FaIcon icon="trash-can" />
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
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

      {modalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="modal-dialog modal-dialog-wide modal-dialog-order modal-dialog-order-lines"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="order-modal-title" className="modal-title">
              {editingId ? `Edit order` : 'New order'}
            </h2>
            {editingId ? (
              <p className="modal-order-ref cell-mono">
                Order # (read-only): {editingOrderNumber}
              </p>
            ) : null}
            <form className="modal-form modal-form-order" onSubmit={handleSubmit}>
              <section className="order-modal-block" aria-labelledby="order-lines-heading">
                <h3 id="order-lines-heading" className="modal-section-label">
                  Line items
                </h3>
                <p className="section-desc section-desc-tight order-modal-hint">
                  Fill the fields below, then add each line to the order. Matching product, weight,
                  and unit price updates the existing row&apos;s quantity instead of adding a
                  duplicate. You can edit unit price or remove lines in the table.
                </p>
                <OrderLineDraftForm
                  line={draftLine}
                  onChange={setDraftLine}
                  readOnly={!canMutateOrderLines}
                />
                <div className="order-add-line-wrap">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm order-add-line-btn"
                    disabled={!canMutateOrderLines}
                    onClick={addDraftLineToTable}
                  >
                    Add line item to order
                  </button>
                </div>

                <div className="order-added-lines-panel">
                  <button
                    type="button"
                    className="order-added-lines-toggle"
                    aria-expanded={linesTableExpanded}
                    onClick={() => setLinesTableExpanded((v) => !v)}
                  >
                    <span>
                      Added line items ({lines.length})
                      {lines.length > 0 ? (
                        <span className="order-added-lines-sum muted">
                          {' '}
                          · {pkr.format(orderPreviewTotal)}
                        </span>
                      ) : null}
                    </span>
                    <FaIcon
                      icon="chevron-down"
                      className={
                        linesTableExpanded ? 'order-chevron order-chevron-open' : 'order-chevron'
                      }
                    />
                  </button>
                  {linesTableExpanded ? (
                    <div className="order-lines-table-wrap">
                      {lines.length === 0 ? (
                        <p className="order-lines-table-empty muted">No lines added yet.</p>
                      ) : (
                        <table className="data-table order-lines-inner-table">
                          <thead>
                            <tr>
                              <th className="order-lines-col-idx">#</th>
                              <th>Product</th>
                              <th>Qty</th>
                              <th>Weight</th>
                              <th>Unit price</th>
                              <th>Line total</th>
                              <th className="table-actions" aria-label="Remove line from order">
                                <FaIcon icon="trash-can" className="order-lines-th-icon" />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((row, idx) => {
                              const q = Number(row.qty);
                              const u = Number(row.unitPricePkr);
                              const lineTot =
                                Number.isFinite(q) && Number.isFinite(u) ? q * u : null;
                              return (
                                <tr key={row.key}>
                                  <td className="cell-mono order-lines-col-idx">{idx + 1}</td>
                                  <td className="order-lines-col-product">{row.productName}</td>
                                  <td className="cell-mono">{row.qty}</td>
                                  <td className="cell-mono">
                                    {Number.isFinite(Number(row.weightG))
                                      ? `${row.weightG} g`
                                      : '—'}
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="order-line-table-price"
                                      min={0}
                                      step="0.01"
                                      value={row.unitPricePkr}
                                      disabled={!canMutateOrderLines}
                                      aria-label={`Unit price for ${row.productName}`}
                                      onChange={(e) =>
                                        updateTableLine(row.key, { unitPricePkr: e.target.value })
                                      }
                                    />
                                  </td>
                                  <td className="cell-mono">
                                    {lineTot != null ? pkr.format(lineTot) : '—'}
                                  </td>
                                  <td className="table-actions">
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm table-action-icon-btn"
                                      aria-label={`Remove line: ${row.productName}`}
                                      disabled={!canMutateOrderLines}
                                      onClick={() =>
                                        setLines((rows) => rows.filter((r) => r.key !== row.key))
                                      }
                                    >
                                      <FaIcon icon="trash-can" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ) : null}
                </div>

                <p className="modal-total-preview order-grand-total">
                  Order total: <strong>{pkr.format(orderPreviewTotal)}</strong> (sum of added lines)
                </p>
              </section>

              <section className="order-modal-block" aria-labelledby="order-customer-heading">
                <h3 id="order-customer-heading" className="modal-section-label">
                  Customer
                </h3>
                <div className="field">
                  <span className="field-label">Customer name</span>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setField('customerName', e.target.value)}
                    required
                    maxLength={120}
                  />
                </div>
                <div className="order-modal-line-grid">
                  <div className="field">
                    <span className="field-label">Contact</span>
                    <input
                      type="text"
                      value={form.customerContact}
                      onChange={(e) => setField('customerContact', e.target.value)}
                      placeholder="Phone or email"
                      maxLength={120}
                    />
                  </div>
                  <div className="field">
                    <span className="field-label">City</span>
                    <input
                      type="text"
                      value={form.customerCity}
                      onChange={(e) => setField('customerCity', e.target.value)}
                      maxLength={120}
                    />
                  </div>
                </div>
                <div className="field">
                  <span className="field-label">Address (optional)</span>
                  <textarea
                    className="input-textarea"
                    rows={2}
                    value={form.customerAddress}
                    onChange={(e) => setField('customerAddress', e.target.value)}
                    maxLength={500}
                    placeholder="Street, area, postal code…"
                  />
                </div>
                <div className="field">
                  <span className="field-label">Note</span>
                  <textarea
                    className="input-textarea"
                    rows={2}
                    value={form.note}
                    onChange={(e) => setField('note', e.target.value)}
                    maxLength={2000}
                    placeholder="Delivery instructions, reference, etc."
                  />
                </div>
              </section>

              <section className="order-modal-block">
                <div className="field">
                  <span className="field-label">Status</span>
                  <select
                    value={form.status}
                    disabled={!permissions.canChangeOrderStatus}
                    onChange={(e) => setField('status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
              {formError ? (
                <div className="alert alert-error" role="alert">
                  {formError}
                </div>
              ) : null}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save order' : 'Place order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewLinesOrder ? (
        <OrderLineItemsViewModal order={viewLinesOrder} onClose={closeViewLinesModal} />
      ) : null}
    </div>
  );
}
