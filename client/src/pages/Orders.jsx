import { useCallback, useEffect, useRef, useState } from 'react';
import { getApi } from '../api';
import { notifyError, notifySuccess } from '../lib/notify';
import {
  getStoredPageSize,
  PAGE_SIZE_OPTIONS,
  setStoredPageSize,
} from '../lib/pageSize';
import {
  getStoredOrderSort,
  ORDER_SORT_DIRECTIONS,
  ORDER_SORT_FIELDS,
  setStoredOrderSort,
} from '../lib/orderSort';
import {
  twAlertError,
  twBtnGhostSm,
  twBtnPrimarySm,
  twBtnDangerSm,
  twCard,
  twCellMono,
  twCustomerCell,
  twCustomerCellAddress,
  twCustomerCellLine,
  twCustomerCellName,
  twEmptyHint,
  twFabPlus,
  twFabPlusInner,
  twFaComboboxChevron,
  twModalActions,
  twModalBackdrop,
  twModalBackdropViewLines,
  twModalFormOrder,
  twModalOrderEditDialog,
  twModalOrderRef,
  twModalTitle,
  twModalViewLinesDialog,
  twMuted,
  twOrderAddLineBtn,
  twOrderAddLineWrap,
  twOrderAddedLinesPanel,
  twOrderAddedLinesSum,
  twOrderAddedLinesToggle,
  twOrderChevron,
  twOrderChevronOpen,
  twOrderDeliveryField,
  twOrderDraftForm,
  twOrderDraftLineWeight,
  twOrderDraftRevampColProduct,
  twOrderDraftRevampColQty,
  twOrderDraftRevampPlaceholder,
  twOrderDraftRevampRow,
  twOrderFormSectionLabel,
  twOrderGrandTotal,
  twOrderLineColActions,
  twOrderLineColNumeric,
  twOrderLineColProduct,
  twOrderLineProductMeta,
  twOrderLineProductName,
  twOrderLineSubtotal,
  twOrderLineTableQty,
  twOrderLinesInnerTableCols5,
  twOrderLinesTableEmpty,
  twOrderLinesTableWrap,
  twOrderLinesThIcon,
  twOrderModalBlock,
  twOrderModalLineGrid,
  twOrdersColActions,
  twOrdersColCreated,
  twOrdersColCustomer,
  twOrdersColLines,
  twOrdersColNote,
  twOrdersColOrder,
  twOrdersColTracking,
  twOrdersColStatus,
  twOrdersDataTable,
  twOrdersFilterBar,
  twOrdersFilterField,
  twOrdersFilterGrow,
  twOrdersFilterSearch,
  twOrdersFilterSelect,
  twOrdersSortBtnActive,
  twOrdersLinesCellCompact,
  twOrdersLinesCount,
  twOrdersLinesSummaryInline,
  twOrdersLinesSummaryText,
  twOrdersLinesTotal,
  twOrderViewColIdx,
  twOrderViewLinesActions,
  twOrderViewLinesBtn,
  twOrderViewLinesMeta,
  twOrderViewLinesTable,
  twOrderViewLinesTableWrap,
  twPaginationActions,
  twPaginationBar,
  twPaginationMeta,
  twProductComboboxHint,
  twProductComboboxInput,
  twProductComboboxItem,
  twProductComboboxItemActive,
  twProductComboboxItemMeta,
  twProductComboboxItemName,
  twProductComboboxList,
  twProductComboboxToggle,
  twProductComboboxToggleOpen,
  twProductComboboxWrap,
  twProductsPage,
  twProductsPageHeader,
  twSectionDescTight,
  twSectionTitle,
  twSectionTitleSm,
  twStatusSelect,
  twTableActionGroup,
  twTableIconBtnDanger,
  twTableIconBtnGhost,
  twOrdersListTableWrap,
  twTableStrong,
  twTextarea,
  twField,
  twFieldLabel,
  twUsersPageSize,
  twUsersTableHead,
} from '../lib/tw';
import { RelativeTime } from '../RelativeTime';
import { FaIcon } from '../components/FaIcon';
import { BulkPrintModal } from '../components/BulkPrintModal';
import { InvoicePrintView, preloadPrintFormPages } from '../components/InvoicePrintView';

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

const TAG_OPTIONS = [
  { value: 'green', label: 'Green', dot: 'bg-emerald-500' },
  { value: 'yellow', label: 'Yellow', dot: 'bg-amber-400' },
  { value: 'red', label: 'Red', dot: 'bg-rose-500' },
];

const TAG_FILTER_OPTIONS = [
  { value: 'all', label: 'All tags' },
  { value: 'none', label: 'No tag' },
  ...TAG_OPTIONS.map((t) => ({ value: t.value, label: t.label })),
];

/** Soft row-background tint applied to a tagged order row. */
const TAG_ROW_BG = {
  green: 'bg-emerald-500/10',
  yellow: 'bg-amber-500/10',
  red: 'bg-rose-500/10',
};

function normalizeTag(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'green' || v === 'yellow' || v === 'red' ? v : null;
}

const ORDER_SORT_FIELD_CONTROLS = [
  { value: ORDER_SORT_FIELDS.none, icon: 'list', title: 'No sorting' },
  { value: ORDER_SORT_FIELDS.createdAt, icon: 'calendar', title: 'Sort by created at' },
  { value: ORDER_SORT_FIELDS.weight, icon: 'weight-hanging', title: 'Sort by total weight' },
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

/** Stable key for the draft row so the product combobox state syncs correctly */
function newDraftLine() {
  return {
    key: 'draft',
    productId: null,
    productName: '',
    qty: '1',
    unitWeightG: null,
    unitPricePkr: '',
    weightG: '',
    pricePkr: '',
    weightOffsetG: 0,
    priceOffsetPkr: 0,
  };
}

/** Total line weight (g) from per-unit catalog weight × quantity */
function lineTotalWeightG(line) {
  const q = Number(line.qty);
  const uw = Number(line.unitWeightG);
  if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(uw) || uw < 0) return null;
  return q * uw;
}

/** Trim floating-point noise from computed weight/price values. */
function roundNum(n) {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
}

/** Manual weight delta stored on a line: effectiveWeight − baseUnitWeight × qty. */
function weightDeltaOf(line) {
  const d = Number(line.weightOffsetG);
  return Number.isFinite(d) ? d : 0;
}

/** Manual price delta stored on a line: effectivePrice − baseUnitPrice × qty. */
function priceDeltaOf(line) {
  const d = Number(line.priceOffsetPkr);
  return Number.isFinite(d) ? d : 0;
}

/**
 * Recompute a line's effective weight & price when quantity changes, reapplying the
 * user's stored manual delta: effective = baseUnitValue × newQty + storedDelta.
 * The delta is persisted on the line, so it survives transient/invalid qty states.
 */
function applyQtyChange(line, nextQtyStr) {
  const patch = { qty: nextQtyStr };
  const newQty = Number(nextQtyStr);
  if (!Number.isFinite(newQty) || newQty <= 0) return patch;
  const bw = Number(line.unitWeightG);
  if (Number.isFinite(bw)) {
    patch.weightG = String(roundNum(bw * newQty + weightDeltaOf(line)));
  }
  const bp = Number(line.unitPricePkr);
  if (Number.isFinite(bp)) {
    patch.pricePkr = String(roundNum(bp * newQty + priceDeltaOf(line)));
  }
  return patch;
}

/** User edited the effective weight → keep the value and recompute its delta vs base × qty. */
function applyWeightEdit(line, nextWeightStr) {
  const patch = { weightG: nextWeightStr };
  const w = Number(nextWeightStr);
  const bw = Number(line.unitWeightG);
  const q = Number(line.qty);
  if (Number.isFinite(w) && Number.isFinite(bw) && Number.isFinite(q) && q > 0) {
    patch.weightOffsetG = roundNum(w - bw * q);
  }
  return patch;
}

/** User edited the effective price → keep the value and recompute its delta vs base × qty. */
function applyPriceEdit(line, nextPriceStr) {
  const patch = { pricePkr: nextPriceStr };
  const p = Number(nextPriceStr);
  const bp = Number(line.unitPricePkr);
  const q = Number(line.qty);
  if (Number.isFinite(p) && Number.isFinite(bp) && Number.isFinite(q) && q > 0) {
    patch.priceOffsetPkr = roundNum(p - bp * q);
  }
  return patch;
}

function emptyForm() {
  return {
    trackingId: '',
    customerName: '',
    customerContact: '',
    customerCity: '',
    customerAddress: '',
    note: '',
    status: 'pending',
    deliveryCharges: '0',
  };
}

function CustomerCell({ name, contact, city, address }) {
  return (
    <div className={twCustomerCell}>
      <div className={twCustomerCellName}>{name || '—'}</div>
      {contact ? <div className={`${twCustomerCellLine} ${twMuted}`}>{contact}</div> : null}
      {address ? (
        <div className={`${twCustomerCellLine} ${twMuted} ${twCustomerCellAddress}`}>{address}</div>
      ) : null}
      {city ? <div className={`${twCustomerCellLine} ${twMuted}`}>{city}</div> : null}
    </div>
  );
}

/** Custom tag picker: colored circle badges for Green/Yellow/Red plus "No tag". */
function TagDropdown({ value, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const current = TAG_OPTIONS.find((o) => o.value === value) || null;

  function pick(next) {
    setOpen(false);
    if (next !== value) onChange(next);
  }

  return (
    <div className="relative min-w-[118px]" ref={ref}>
      <button
        type="button"
        className={`${twStatusSelect} flex items-center justify-between gap-2 ${
          disabled ? 'cursor-not-allowed opacity-60' : ''
        }`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={disabled ? 'Add a phone/email to this order to tag the customer' : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`h-3 w-3 shrink-0 rounded-full ${
              current ? current.dot : 'border border-[color:var(--border)]'
            }`}
          />
          <span className="truncate">{current ? current.label : 'No tag'}</span>
        </span>
        <FaIcon
          icon="chevron-down"
          className={open ? `${twFaComboboxChevron} rotate-180` : twFaComboboxChevron}
        />
      </button>
      {open ? (
        <ul className={twProductComboboxList} role="listbox">
          <li role="none">
            <button
              type="button"
              role="option"
              aria-selected={!current}
              className={twProductComboboxItem}
              onClick={() => pick(null)}
            >
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border border-[color:var(--border)]" />
                No tag
              </span>
            </button>
          </li>
          {TAG_OPTIONS.map((o) => (
            <li key={o.value} role="none">
              <button
                type="button"
                role="option"
                aria-selected={value === o.value}
                className={twProductComboboxItem}
                onClick={() => pick(o.value)}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${o.dot}`} />
                  {o.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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
    <div className={twOrdersLinesCellCompact}>
      <div className={twOrdersLinesSummaryText}>
        <span className={twOrdersLinesSummaryInline}>
          <span className={twOrdersLinesCount}>
            <strong>{n}</strong> {n === 1 ? 'item' : 'items'}
          </span>
          <span className={twOrdersLinesTotal}>{` . ${pkr.format(t)}`}</span>
        </span>
      </div>
      <button
        type="button"
        className={twOrderViewLinesBtn}
        disabled={!canView}
        title={canView ? 'Show all items' : 'No items loaded'}
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
  const lineSum = items.reduce((s, it) => s + (Number(it.line_total) || 0), 0);
  const delRaw = Number(order.delivery_charges);
  const delivery = Number.isFinite(delRaw) && delRaw >= 0 ? delRaw : 0;
  const grandStored = Number(order.total);
  const grand = Number.isFinite(grandStored) ? grandStored : lineSum + delivery;

  return (
    <div
      className={twModalBackdropViewLines}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={twModalViewLinesDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-view-lines-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="order-view-lines-title" className={twModalTitle}>
          Items
        </h2>
        <p className={`${twModalOrderRef} ${twCellMono}`}>Order {order.order_number}</p>
        <p className={twOrderViewLinesMeta}>
          {n} {n === 1 ? 'item' : 'items'} · Lines {pkr.format(lineSum)}
          {delivery > 0 ? ` · Delivery ${pkr.format(delivery)}` : null} · Total {pkr.format(grand)}
        </p>
        <div className={twOrderViewLinesTableWrap}>
          {items.length === 0 ? (
            <p className={twEmptyHint}>No items for this order.</p>
          ) : (
            <table className={twOrderViewLinesTable}>
              <thead>
                <tr>
                  <th className={twOrderViewColIdx}>#</th>
                  <th>Product</th>
                  <th className={twOrderLineColNumeric}>Qty</th>
                  <th className={twOrderLineColNumeric}>Weight</th>
                  <th className={twOrderLineColNumeric}>Unit price</th>
                  <th className={twOrderLineColNumeric}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id ?? `${idx}-${it.product_name}`}>
                    <td className={`${twCellMono} ${twOrderViewColIdx}`}>{idx + 1}</td>
                    <td>{it.product_name}</td>
                    <td className={`${twCellMono} ${twOrderLineColNumeric}`}>{it.qty}</td>
                    <td className={`${twCellMono} ${twOrderLineColNumeric}`}>
                      {Number.isFinite(Number(it.weight_g)) ? `${it.weight_g} g` : '—'}
                    </td>
                    <td className={`${twCellMono} ${twOrderLineColNumeric}`}>
                      {pkr.format(Number(it.unit_price) || 0)}
                    </td>
                    <td className={`${twCellMono} ${twOrderLineColNumeric}`}>
                      {pkr.format(Number(it.line_total) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className={`${twModalActions} ${twOrderViewLinesActions}`}>
          <button type="button" className={twBtnPrimarySm} onClick={onClose}>
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
function OrderLineDraftForm({ line, onChange, onAddItem, readOnly = false }) {
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
    const uw = Number(p.weight_g);
    const safeUw = Number.isFinite(uw) && uw >= 0 ? uw : 0;
    const up = Number(p.price);
    const safeUp = Number.isFinite(up) && up >= 0 ? up : 0;
    const q = Number(line.qty);
    const validQty = Number.isFinite(q) && q > 0;
    onChange({
      ...line,
      productId: p.id,
      productName: p.name,
      unitWeightG: safeUw,
      unitPricePkr: String(p.price ?? ''),
      weightG: validQty ? String(roundNum(safeUw * q)) : '',
      pricePkr: validQty ? String(roundNum(safeUp * q)) : '',
      weightOffsetG: 0,
      priceOffsetPkr: 0,
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
      unitWeightG: null,
      unitPricePkr: '',
      weightG: '',
      pricePkr: '',
      weightOffsetG: 0,
      priceOffsetPkr: 0,
    });
  }

  const linePreview =
    Number.isFinite(Number(line.qty)) && Number.isFinite(Number(line.unitPricePkr))
      ? Number(line.qty) * Number(line.unitPricePkr)
      : null;

  return (
    <div className={twOrderDraftForm}>
      <div className={`${twField} relative`} ref={wrapRef}>
        <span className={twFieldLabel}>Product (search catalog)</span>
        <div className={twProductComboboxWrap}>
          <input
            type="text"
            className={twProductComboboxInput}
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
            className={`${twProductComboboxToggle}${open ? ` ${twProductComboboxToggleOpen}` : ''}`}
            aria-label={open ? 'Close list' : 'Open list'}
            disabled={readOnly}
            onClick={() => {
              if (readOnly) return;
              setOpen((v) => !v);
            }}
          >
            <FaIcon
              icon="chevron-down"
              className={open ? `${twFaComboboxChevron} rotate-180` : twFaComboboxChevron}
            />
          </button>
        </div>
        {open ? (
          <ul
            id="order-draft-line-listbox"
            className={twProductComboboxList}
            role="listbox"
          >
            {loading ? (
              <li className={twProductComboboxHint}>Loading…</li>
            ) : products.length === 0 ? (
              <li className={twProductComboboxHint}>
                {query.trim() ? 'No matches.' : 'No products — add some first.'}
              </li>
            ) : (
              products.map((p) => (
                <li key={p.id} role="none">
                  <button
                    type="button"
                    role="option"
                    className={`${twProductComboboxItem}${
                      line.productId === p.id ? ` ${twProductComboboxItemActive}` : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickProduct(p)}
                  >
                    <span className={twProductComboboxItemName}>{p.name}</span>
                    <span className={twProductComboboxItemMeta}>
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
      <div className={twOrderDraftRevampRow}>
        <div className={twOrderDraftRevampColProduct}>
          {line.productId != null ? (
            <>
              <div className={twOrderLineProductName}>{line.productName}</div>
              <div className={`${twOrderLineProductMeta} ${twMuted}`}>
                <span>Unit qty: 1</span>
                <span>
                  Unit weight:{' '}
                  {Number.isFinite(Number(line.unitWeightG)) ? `${line.unitWeightG} g` : '—'}
                </span>
                <span>
                  Unit price:{' '}
                  {pkr.format(Number(line.unitPricePkr) || 0)}
                </span>
              </div>
            </>
          ) : (
            <p className={twOrderDraftRevampPlaceholder}>
              Choose a product above to see name, unit weight, and unit price here.
            </p>
          )}
        </div>
        <div className={twOrderDraftRevampColQty}>
          <div className={twField}>
            <span className={twFieldLabel}>Quantity</span>
            <input
              type="number"
              min={0.001}
              step="any"
              value={line.qty}
              disabled={readOnly}
              onChange={(e) => onChange({ ...line, ...applyQtyChange(line, e.target.value) })}
            />
          </div>
          {line.productId != null && lineTotalWeightG(line) != null ? (
            <p className={twOrderDraftLineWeight}>
              Weight:{' '}
              <strong>{`${lineTotalWeightG(line)} g`}</strong>
            </p>
          ) : null}
          <p className={twOrderLineSubtotal}>
            Total:{' '}
            <strong>{linePreview != null ? pkr.format(linePreview) : '—'}</strong>
          </p>
        </div>
      </div>
      <div className={twOrderAddLineWrap}>
        <button
          type="button"
          className={twOrderAddLineBtn}
          onClick={onAddItem}
        >
          Add item to order
        </button>
      </div>
    </div>
  );
}

function Orders() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => getStoredPageSize());
  const [total, setTotal] = useState(0);
  const [orders, setOrders] = useState([]);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [draftTag, setDraftTag] = useState('all');
  const [filterSearchInput, setFilterSearchInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortField, setSortField] = useState(() => getStoredOrderSort().field);
  const [sortDirection, setSortDirection] = useState(() => getStoredOrderSort().direction);
  const [advFilterOpen, setAdvFilterOpen] = useState(false);
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [draftSortField, setDraftSortField] = useState(ORDER_SORT_FIELDS.none);
  const [draftSortDirection, setDraftSortDirection] = useState(ORDER_SORT_DIRECTIONS.desc);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingOrderNumber, setEditingOrderNumber] = useState('');
  const [draftLine, setDraftLine] = useState(() => newDraftLine());
  const [lines, setLines] = useState(() => []);
  const [linesTableExpanded, setLinesTableExpanded] = useState(true);
  const [form, setForm] = useState(() => emptyForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewLinesOrder, setViewLinesOrder] = useState(null);
  const [printInvoice, setPrintInvoice] = useState(null);
  const [printingOrderId, setPrintingOrderId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [bulkPrintInvoices, setBulkPrintInvoices] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const printTriggered = useRef(false);

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
      tag: filterTag,
      q: filterSearch,
      sortBy: sortField,
      sortDir: sortDirection,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
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
    notifyError(res.error || 'Could not load orders.');
    return false;
  }, [filterStatus, filterTag, filterSearch, sortField, sortDirection, filterDateFrom, filterDateTo]);

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

  // Drop selections that are no longer on the current page.
  useEffect(() => {
    const visible = new Set(orders.map((o) => o.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
        else changed = true;
      });
      return changed || next.size !== prev.size ? next : prev;
    });
  }, [orders]);

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
          setPrintingOrderId(null);
          printTriggered.current = false;
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [printInvoice]);

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

  /** Same product → merge by increasing qty (catalog price & weight per unit stay fixed). */
  function tableRowMatchesDraft(row, productId) {
    return Number(row.productId) === Number(productId);
  }

  function addDraftLineToTable() {
    setFormError('');
    const L = draftLine;
    if (L.productId == null || !String(L.productName || '').trim()) {
      setFormError('Select a product from the catalog, then add the item.');
      return;
    }
    const qty = Number(L.qty);
    const up = Number(L.unitPricePkr);
    const uw = Number(L.unitWeightG);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Quantity must be a positive number.');
      return;
    }
    if (!Number.isFinite(up) || up < 0) {
      setFormError('Select a product so the catalog unit price is applied.');
      return;
    }
    if (!Number.isFinite(uw) || uw < 0) {
      setFormError('Select a product so catalog weight per unit is applied.');
      return;
    }
    const pid = Number(L.productId);
    setLines((rows) => {
      const mergeIdx = rows.findIndex((r) => tableRowMatchesDraft(r, pid));
      if (mergeIdx >= 0) {
        return rows.map((r, i) => {
          if (i !== mergeIdx) return r;
          const combined = Number(r.qty) + qty;
          return {
            ...r,
            ...applyQtyChange(r, String(combined)),
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
          unitWeightG: uw,
          unitPricePkr: String(L.unitPricePkr),
          weightG: String(roundNum(uw * qty)),
          pricePkr: String(roundNum(up * qty)),
          weightOffsetG: 0,
          priceOffsetPkr: 0,
        },
      ];
    });
    setDraftLine(newDraftLine());
    setLinesTableExpanded(true);
  }

  function openCreate() {
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
    orderEditTokenRef.current += 1;
    setEditingId(o.id);
    setEditingOrderNumber(o.order_number || '');
    const rawItems = Array.isArray(o.items) && o.items.length > 0 ? o.items : null;
    if (rawItems) {
      setLines(
        rawItems.map((it) => {
          const qRaw = Number(it.qty ?? 1);
          const wg = Number(it.weight_g ?? 0);
          const up = Number(it.unit_price ?? 0);
          const lt = Number(it.line_total ?? 0);
          const baseW = Number(it.base_unit_weight_g);
          const baseP = Number(it.base_unit_price);
          const derivedUnitW =
            Number.isFinite(qRaw) && qRaw > 0 && Number.isFinite(wg) ? wg / qRaw : 0;
          const unitW = Number.isFinite(baseW) && baseW >= 0 ? baseW : derivedUnitW;
          const unitP = Number.isFinite(baseP) && baseP >= 0 ? baseP : up;
          const effWeight = Number.isFinite(wg) && wg >= 0 ? wg : 0;
          const effPrice =
            Number.isFinite(lt) && lt >= 0
              ? lt
              : (Number.isFinite(up) ? up : 0) * (Number.isFinite(qRaw) ? qRaw : 0);
          const safeUnitW = Number.isFinite(unitW) && unitW >= 0 ? unitW : 0;
          const safeUnitP = Number.isFinite(unitP) ? unitP : 0;
          const safeQty = Number.isFinite(qRaw) && qRaw > 0 ? qRaw : 1;
          return {
            key: `e-${it.id}-${newLineKey()}`,
            productId: it.product_id != null ? Number(it.product_id) : null,
            productName: it.product_name || '',
            qty: String(it.qty ?? 1),
            unitWeightG: safeUnitW,
            unitPricePkr: String(Number.isFinite(unitP) ? unitP : ''),
            weightG: String(roundNum(effWeight)),
            pricePkr: String(roundNum(effPrice)),
            weightOffsetG: roundNum(effWeight - safeUnitW * safeQty),
            priceOffsetPkr: roundNum(effPrice - safeUnitP * safeQty),
          };
        }),
      );
    } else {
      const qRaw = Number(o.qty ?? 1);
      const wg = Number(o.weight_g ?? 0);
      const up = Number(o.unit_price ?? 0);
      const unitW =
        Number.isFinite(qRaw) && qRaw > 0 && Number.isFinite(wg) ? wg / qRaw : 0;
      const safeQty = Number.isFinite(qRaw) && qRaw > 0 ? qRaw : 1;
      const safeUp = Number.isFinite(up) ? up : 0;
      setLines([
        {
          key: newLineKey(),
          productId: null,
          productName: o.product_name || '',
          qty: String(o.qty ?? 1),
          unitWeightG: Number.isFinite(unitW) && unitW >= 0 ? unitW : 0,
          unitPricePkr: String(Number.isFinite(up) ? up : ''),
          weightG: String(roundNum(Number.isFinite(wg) && wg >= 0 ? wg : 0)),
          pricePkr: String(roundNum(safeUp * safeQty)),
          weightOffsetG: 0,
          priceOffsetPkr: 0,
        },
      ]);
    }
    setForm({
      trackingId: o.tracking_id || '',
      customerName: o.customer_name || '',
      customerContact: o.customer_contact || '',
      customerCity: o.customer_city || '',
      customerAddress: o.customer_address || '',
      note: o.note || '',
      status: rowStatusValue(o.status),
      deliveryCharges:
        o.delivery_charges != null && o.delivery_charges !== ''
          ? String(o.delivery_charges)
          : '0',
    });
    setFormError('');
    setModalOpen(true);
    setDraftLine(newDraftLine());
    setLinesTableExpanded(true);
  }

  const linesSubtotal = lines.reduce((sum, L) => {
    const p = Number(L.pricePkr);
    if (!Number.isFinite(p)) return sum;
    return sum + p;
  }, 0);
  const deliveryParsed = Number(form.deliveryCharges);
  const safeDeliveryPreview =
    Number.isFinite(deliveryParsed) && deliveryParsed >= 0 ? deliveryParsed : 0;
  const orderGrandPreview = linesSubtotal + safeDeliveryPreview;

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (lines.length === 0) {
      setFormError('Add at least one item: fill the form above, then use “Add item to order”.');
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (L.productId == null || !String(L.productName || '').trim()) {
        setFormError(`Item ${i + 1}: select a product from the catalog.`);
        return;
      }
      const qty = Number(L.qty);
      const up = Number(L.unitPricePkr);
      const uw = Number(L.unitWeightG);
      const ew = Number(L.weightG);
      const ep = Number(L.pricePkr);
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError(`Item ${i + 1}: quantity must be positive.`);
        return;
      }
      if (!Number.isFinite(up) || up < 0) {
        setFormError(`Item ${i + 1}: catalog unit price is missing.`);
        return;
      }
      if (!Number.isFinite(uw) || uw < 0) {
        setFormError(`Item ${i + 1}: catalog weight per unit is missing.`);
        return;
      }
      if (!Number.isFinite(ew) || ew < 0) {
        setFormError(`Item ${i + 1}: weight (g) must be zero or positive.`);
        return;
      }
      if (!Number.isFinite(ep) || ep < 0) {
        setFormError(`Item ${i + 1}: price must be zero or positive.`);
        return;
      }
    }
    if (!form.customerName.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    const deliveryNum = Number(form.deliveryCharges);
    if (!Number.isFinite(deliveryNum) || deliveryNum < 0) {
      setFormError('Delivery charges must be zero or a positive number.');
      return;
    }
    setSaving(true);
    const payloadLines = lines.map((L) => {
      const qty = Number(L.qty);
      const weightG = Number(L.weightG);
      const linePrice = Number(L.pricePkr);
      // Store an effective per-unit price so invoices/views stay consistent (unit × qty = line total).
      const unitPricePkr = qty > 0 ? roundNum(linePrice / qty) : linePrice;
      return {
        productId: L.productId,
        productName: L.productName.trim(),
        qty,
        weightG: Number.isFinite(weightG) ? weightG : 0,
        unitPricePkr,
        lineTotal: Number.isFinite(linePrice) ? linePrice : 0,
        baseUnitWeightG: Number(L.unitWeightG),
        baseUnitPrice: Number(L.unitPricePkr),
      };
    });
    const body = {
      lines: payloadLines,
      trackingId: form.trackingId.trim(),
      customerName: form.customerName.trim(),
      customerContact: form.customerContact.trim(),
      customerCity: form.customerCity.trim(),
      customerAddress: form.customerAddress.trim(),
      note: form.note.trim(),
      status: form.status,
      deliveryCharges: deliveryNum,
    };
    const res = editingId
      ? await getApi().updateOrder({ id: editingId, ...body })
      : await getApi().createOrder(body);
    setSaving(false);
    if (res.ok !== true) {
      setFormError(res.error || 'Could not save order.');
      return;
    }
    const wasEdit = Boolean(editingId);
    const listPage = wasEdit ? page : 1;
    closeModal();
    if (!wasEdit) {
      setPage(1);
    }
    notifySuccess(wasEdit ? 'Order updated.' : 'Order created.');
    await loadList(listPage, pageSize);
  }

  async function handleDelete(o) {
    if (!window.confirm(`Delete order ${o.order_number}?`)) return;
    setListError('');
    const res = await getApi().deleteOrder({ id: o.id });
    if (res.ok !== true) {
      const err = res.error || 'Delete failed.';
      setListError(err);
      notifyError(err);
      return;
    }
    notifySuccess('Order deleted.');
    await loadList(page, pageSize);
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0 || bulkLoading) return;
    const n = selectedIds.size;
    if (
      !window.confirm(
        `Delete ${n} selected order${n === 1 ? '' : 's'}? Related invoices will also be deleted.`,
      )
    ) {
      return;
    }
    setBulkLoading(true);
    setListError('');
    const ids = [...selectedIds];
    let failed = 0;
    for (const id of ids) {
      const res = await getApi().deleteOrder({ id });
      if (res.ok !== true) {
        failed += 1;
        notifyError(res.error || 'Delete failed.');
      }
    }
    setBulkLoading(false);
    setSelectedIds(new Set());
    if (failed === 0) {
      notifySuccess(n === 1 ? 'Order deleted.' : `${n} orders deleted.`);
    } else if (failed < n) {
      notifySuccess(`${n - failed} deleted; ${failed} failed.`);
    }
    await loadList(page, pageSize);
  }

  async function handlePrintInvoice(o) {
    if (printingOrderId != null) return;
    setPrintingOrderId(o.id);
    const res = await getApi().getInvoiceForPrint({ orderId: o.id });
    setPrintingOrderId(null);
    if (res.ok !== true) {
      notifyError(res.error || 'Could not load invoice for printing.');
      return;
    }
    setPrintInvoice(res.invoice);
  }

  async function handleBulkPrint() {
    if (selectedIds.size === 0 || bulkLoading) return;
    setBulkLoading(true);
    const ids = [...selectedIds];
    const loaded = [];
    for (const id of ids) {
      const res = await getApi().getInvoiceForPrint({ orderId: id });
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

  const pageOrderIds = orders.map((o) => o.id);
  const allOrdersSelected =
    pageOrderIds.length > 0 && pageOrderIds.every((id) => selectedIds.has(id));
  const someOrdersSelected = pageOrderIds.some((id) => selectedIds.has(id));

  function toggleSelectAllOrders() {
    setSelectedIds((prev) => {
      if (allOrdersSelected) return new Set();
      return new Set(pageOrderIds);
    });
  }

  function toggleSelectOrder(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleStatusChange(o, nextStatus) {
    const prev = o.status;
    setOrders((rows) =>
      rows.map((r) => (r.id === o.id ? { ...r, status: nextStatus } : r)),
    );
    const res = await getApi().patchOrderStatus({ id: o.id, status: nextStatus });
    if (res.ok !== true) {
      setOrders((rows) =>
        rows.map((r) => (r.id === o.id ? { ...r, status: prev } : r)),
      );
      const err = res.error || 'Could not update status.';
      setListError(err);
      notifyError(err);
      return;
    }
    setListError('');
  }

  async function handleTagChange(o, nextTag) {
    const contact = String(o.customer_contact || '').trim();
    if (!contact) {
      notifyError('This order has no phone/email to tag.');
      return;
    }
    const key = contact.toLowerCase();
    const prevByRow = new Map();
    // A tag lives on the contact, so update every row that shares this phone/email.
    setOrders((rows) =>
      rows.map((r) => {
        if (String(r.customer_contact || '').trim().toLowerCase() !== key) return r;
        prevByRow.set(r.id, r.tag ?? null);
        return { ...r, tag: nextTag };
      }),
    );
    const res = await getApi().setCustomerTag({ contact, tag: nextTag ?? 'none' });
    if (res.ok !== true) {
      setOrders((rows) =>
        rows.map((r) =>
          prevByRow.has(r.id) ? { ...r, tag: prevByRow.get(r.id) } : r,
        ),
      );
      const err = res.error || 'Could not update tag.';
      setListError(err);
      notifyError(err);
      return;
    }
    setListError('');
  }

  function openAdvancedFilters() {
    setDraftDateFrom(filterDateFrom);
    setDraftDateTo(filterDateTo);
    setDraftTag(filterTag);
    setDraftSortField(sortField);
    setDraftSortDirection(sortDirection);
    setAdvFilterOpen(true);
  }

  function applyAdvancedFilters() {
    setFilterDateFrom(draftDateFrom);
    setFilterDateTo(draftDateTo);
    setFilterTag(draftTag);
    setSortField(draftSortField);
    setSortDirection(draftSortDirection);
    setStoredOrderSort({ field: draftSortField, direction: draftSortDirection });
    setPage(1);
    setAdvFilterOpen(false);
  }

  function resetAdvancedDraft() {
    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftTag('all');
    setDraftSortField(ORDER_SORT_FIELDS.none);
    setDraftSortDirection(ORDER_SORT_DIRECTIONS.desc);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const advancedFilterCount =
    (filterDateFrom ? 1 : 0) +
    (filterDateTo ? 1 : 0) +
    (filterTag !== 'all' ? 1 : 0) +
    (sortField !== ORDER_SORT_FIELDS.none ? 1 : 0) +
    (sortField !== ORDER_SORT_FIELDS.none &&
    sortDirection === ORDER_SORT_DIRECTIONS.asc
      ? 1
      : 0);
  const hasActiveFilters =
    filterStatus !== 'all' ||
    filterSearchInput.trim() !== '' ||
    advancedFilterCount > 0;

  function clearOrderFilters() {
    setFilterStatus('all');
    setFilterTag('all');
    setDraftTag('all');
    setFilterSearchInput('');
    setFilterSearch('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSortField(ORDER_SORT_FIELDS.none);
    setSortDirection(ORDER_SORT_DIRECTIONS.desc);
    setStoredOrderSort({
      field: ORDER_SORT_FIELDS.none,
      direction: ORDER_SORT_DIRECTIONS.desc,
    });
    lastSearchCommittedRef.current = '';
    setPage(1);
  }

  return (
    <div className={twProductsPage}>
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

      <div className={twProductsPageHeader}>
        <div>
          <h2 className={twSectionTitle}>Orders</h2>
          <p className={twSectionDescTight}>
            Each order can include multiple catalog lines from your product catalog.
          </p>
        </div>
        <button
          type="button"
          className={twFabPlus}
          aria-label="New order"
          onClick={openCreate}
        >
          <FaIcon icon="plus" className={twFabPlusInner} />
        </button>
      </div>

      {listError ? (
        <p className={twEmptyHint} role="alert">
          Could not load the list. Try refreshing or check your connection.
        </p>
      ) : null}

      <div className={twCard}>
        <div className={twUsersTableHead}>
          <h3 className={twSectionTitleSm}>All orders</h3>
          <div className={twUsersPageSize}>
            <span className={twFieldLabel}>Rows</span>
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
        <p className={twSectionDescTight}>
          {total} order{total === 1 ? '' : 's'}
          {hasActiveFilters ? ' match your filters.' : ' total.'}
          {sortField !== ORDER_SORT_FIELDS.none
            ? sortField === ORDER_SORT_FIELDS.weight
              ? ' Sorted by total weight.'
              : ' Sorted by created date.'
            : ''}
        </p>

        <div className={twOrdersFilterBar}>
          <div className={twOrdersFilterField}>
            <span className={twFieldLabel} id="orders-filter-status-label">
              Status
            </span>
            <select
              id="orders-filter-status"
              className={twOrdersFilterSelect}
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
          <div className={`${twOrdersFilterField} ${twOrdersFilterGrow}`}>
            <span className={twFieldLabel} id="orders-filter-q-label">
              Search
            </span>
            <input
              id="orders-filter-q"
              type="search"
              className={twOrdersFilterSearch}
              placeholder="Customer name, order #, or ID"
              aria-labelledby="orders-filter-q-label"
              autoComplete="off"
              value={filterSearchInput}
              onChange={(e) => setFilterSearchInput(e.target.value)}
            />
          </div>
          <div className={twOrdersFilterField}>
            <span className={twFieldLabel} aria-hidden="true">
              &nbsp;
            </span>
            <button
              type="button"
              className={`${twBtnGhostSm} relative ${
                advancedFilterCount > 0
                  ? '!border-sky-400/60 !bg-sky-500/15 !text-sky-200'
                  : ''
              }`}
              onClick={openAdvancedFilters}
              aria-label={`More filters${advancedFilterCount > 0 ? ` (${advancedFilterCount} applied)` : ''}`}
            >
              <FaIcon icon="sliders" />
              <span>Filters</span>
              {advancedFilterCount > 0 ? (
                <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-sky-400 px-1 text-[0.7rem] font-bold text-[#0c1222]">
                  {advancedFilterCount}
                </span>
              ) : null}
            </button>
          </div>
          {hasActiveFilters ? (
            <button type="button" className={twBtnGhostSm} onClick={clearOrderFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        {advFilterOpen ? (
          <div
            className={twModalBackdropViewLines}
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setAdvFilterOpen(false);
            }}
          >
            <div
              className={twModalViewLinesDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="orders-adv-filter-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h2 id="orders-adv-filter-title" className={twModalTitle}>
                Filters
              </h2>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className={twField}>
                    <span className={twFieldLabel}>From date</span>
                    <input
                      type="date"
                      className={twOrdersFilterSelect}
                      value={draftDateFrom}
                      max={draftDateTo || undefined}
                      onChange={(e) => setDraftDateFrom(e.target.value)}
                    />
                  </label>
                  <label className={twField}>
                    <span className={twFieldLabel}>To date</span>
                    <input
                      type="date"
                      className={twOrdersFilterSelect}
                      value={draftDateTo}
                      min={draftDateFrom || undefined}
                      onChange={(e) => setDraftDateTo(e.target.value)}
                    />
                  </label>
                </div>

                <div className={twField}>
                  <span className={twFieldLabel}>Tag</span>
                  <select
                    className={twOrdersFilterSelect}
                    value={draftTag}
                    onChange={(e) => setDraftTag(e.target.value)}
                  >
                    {TAG_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={twField}>
                  <span className={twFieldLabel}>Sort by</span>
                  <div className={twTableActionGroup} role="group" aria-label="Sort by">
                    {ORDER_SORT_FIELD_CONTROLS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`${twTableIconBtnGhost} ${
                          draftSortField === opt.value ? twOrdersSortBtnActive : ''
                        }`}
                        title={opt.title}
                        aria-label={opt.title}
                        aria-pressed={draftSortField === opt.value}
                        onClick={() => setDraftSortField(opt.value)}
                      >
                        <FaIcon icon={opt.icon} />
                      </button>
                    ))}
                  </div>
                </div>

                {draftSortField !== ORDER_SORT_FIELDS.none ? (
                  <div className={twField}>
                    <span className={twFieldLabel}>Order</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`${twBtnGhostSm} ${
                          draftSortDirection === ORDER_SORT_DIRECTIONS.desc
                            ? twOrdersSortBtnActive
                            : ''
                        }`}
                        aria-pressed={draftSortDirection === ORDER_SORT_DIRECTIONS.desc}
                        onClick={() => setDraftSortDirection(ORDER_SORT_DIRECTIONS.desc)}
                      >
                        <FaIcon icon="arrow-down-wide-short" />
                        Descending
                      </button>
                      <button
                        type="button"
                        className={`${twBtnGhostSm} ${
                          draftSortDirection === ORDER_SORT_DIRECTIONS.asc
                            ? twOrdersSortBtnActive
                            : ''
                        }`}
                        aria-pressed={draftSortDirection === ORDER_SORT_DIRECTIONS.asc}
                        onClick={() => setDraftSortDirection(ORDER_SORT_DIRECTIONS.asc)}
                      >
                        <FaIcon icon="arrow-up-wide-short" />
                        Ascending
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={twModalActions}>
                <button
                  type="button"
                  className={`${twBtnGhostSm} mr-auto`}
                  onClick={resetAdvancedDraft}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className={twBtnGhostSm}
                  onClick={() => setAdvFilterOpen(false)}
                >
                  Cancel
                </button>
                <button type="button" className={twBtnPrimarySm} onClick={applyAdvancedFilters}>
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedIds.size > 0 ? (
          <div className="bulk-actions-bar">
            <span className="bulk-actions-meta">
              <strong>{selectedIds.size}</strong> selected
            </span>
            <div className="bulk-actions-btns">
              <button
                type="button"
                className={twBtnGhostSm}
                disabled={bulkLoading}
                onClick={handleBulkPrint}
              >
                <FaIcon icon="print" /> {bulkLoading ? 'Loading…' : 'Print'}
              </button>
              <button
                type="button"
                className={twBtnDangerSm}
                disabled={bulkLoading}
                onClick={handleBulkDelete}
              >
                <FaIcon icon="trash-can" /> Delete
              </button>
            </div>
          </div>
        ) : null}

        <div className={twOrdersListTableWrap}>
          {loading ? (
            <p className={twEmptyHint}>Loading…</p>
          ) : orders.length === 0 ? (
            <p className={twEmptyHint}>
              {hasActiveFilters
                ? 'No orders match these filters.'
                : 'No orders yet. Tap + to create one.'}
            </p>
          ) : (
            <table className={twOrdersDataTable}>
              <thead>
                <tr>
                  <th className="table-select-col">
                    <input
                      type="checkbox"
                      className="pretty-check"
                      checked={allOrdersSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someOrdersSelected && !allOrdersSelected;
                      }}
                      onChange={toggleSelectAllOrders}
                      aria-label="Select all orders on this page"
                    />
                  </th>
                  <th className={twOrdersColOrder}>Order #</th>
                  <th className={twOrdersColTracking}>Tracking ID</th>
                  <th className={twOrdersColLines}>Items</th>
                  <th className={twOrdersColCustomer}>Customer</th>
                  <th className={twOrdersColCreated}>Created at</th>
                  <th className={twOrdersColNote}>Note</th>
                  <th className={twOrdersColStatus}>Status</th>
                  <th className={twOrdersColStatus}>Tag</th>
                  <th className={twOrdersColActions}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const rowTag = normalizeTag(o.tag);
                  return (
                  <tr key={o.id} className={rowTag ? TAG_ROW_BG[rowTag] : undefined}>
                    <td className="table-select-col">
                      <input
                        type="checkbox"
                        className="pretty-check"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleSelectOrder(o.id)}
                        aria-label={`Select order ${o.order_number}`}
                      />
                    </td>
                    <td className={`${twOrdersColOrder} ${twTableStrong} ${twCellMono}`}>{o.order_number}</td>
                    <td
                      className={`${twOrdersColTracking} ${twCellMono}`}
                      title={
                        o.tracking_id && String(o.tracking_id).trim()
                          ? String(o.tracking_id).trim()
                          : undefined
                      }
                    >
                      {o.tracking_id && String(o.tracking_id).trim()
                        ? String(o.tracking_id).trim()
                        : '—'}
                    </td>
                    <td className={twOrdersColLines}>
                      <OrderLineItemsSummary
                        items={o.items}
                        lineCount={o.line_count}
                        total={o.total}
                        onView={() => setViewLinesOrder(o)}
                      />
                    </td>
                    <td className={twOrdersColCustomer}>
                      <CustomerCell
                        name={o.customer_name}
                        contact={o.customer_contact}
                        city={o.customer_city}
                        address={o.customer_address}
                      />
                    </td>
                    <td className={`${twOrdersColCreated} ${twCellMono} text-[0.82rem]`}>
                      <RelativeTime value={o.created_at} />
                    </td>
                    <td className={twOrdersColNote}>{o.note || '—'}</td>
                    <td className={twOrdersColStatus}>
                      <select
                        className={twStatusSelect}
                        value={rowStatusValue(o.status)}
                        aria-label={`Status for ${o.order_number}`}
                        onChange={(e) => handleStatusChange(o, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={twOrdersColStatus}>
                      <TagDropdown
                        value={rowTag}
                        disabled={!String(o.customer_contact || '').trim()}
                        onChange={(next) => handleTagChange(o, next)}
                      />
                    </td>
                    <td className={twOrdersColActions}>
                      <div className={twTableActionGroup} role="group" aria-label="Order actions">
                        <button
                          type="button"
                          className={twTableIconBtnGhost}
                          aria-label={`Edit order ${o.order_number}`}
                          onClick={() => openEdit(o)}
                        >
                          <FaIcon icon="pen-to-square" />
                        </button>
                        <button
                          type="button"
                          className={twTableIconBtnGhost}
                          aria-label={`Print invoice for order ${o.order_number}`}
                          disabled={printingOrderId === o.id}
                          onClick={() => handlePrintInvoice(o)}
                        >
                          <FaIcon icon="print" />
                        </button>
                        <button
                          type="button"
                          className={twTableIconBtnDanger}
                          aria-label={`Delete order ${o.order_number}`}
                          onClick={() => handleDelete(o)}
                        >
                          <FaIcon icon="trash-can" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {total > 0 && (totalPages > 1 || total > pageSize) ? (
          <div className={twPaginationBar}>
            <span className={twPaginationMeta}>
              Page {page} of {totalPages}
            </span>
            <div className={twPaginationActions}>
              <button
                type="button"
                className={twBtnGhostSm}
                disabled={page <= 1 || loading}
                onClick={() => setPage((x) => Math.max(1, x - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className={twBtnGhostSm}
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
          className={twModalBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className={twModalOrderEditDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="order-modal-title" className={twModalTitle}>
              {editingId ? `Edit order` : 'New order'}
            </h2>
            {editingId ? (
              <p className={`${twModalOrderRef} ${twCellMono}`}>
                Order # (read-only): {editingOrderNumber}
              </p>
            ) : null}
            <form className={twModalFormOrder} onSubmit={handleSubmit}>
              <div className={twField}>
                <span className={twFieldLabel}>Tracking ID</span>
                <input
                  type="text"
                  className="input-mono"
                  value={form.trackingId}
                  onChange={(e) => setField('trackingId', e.target.value)}
                  placeholder="Courier / shipment tracking number (optional)"
                  maxLength={120}
                  autoComplete="off"
                />
              </div>
              <section className={twOrderModalBlock} aria-labelledby="order-lines-heading">
                <h3 id="order-lines-heading" className={twOrderFormSectionLabel}>
                  Items
                </h3>
                <OrderLineDraftForm
                  line={draftLine}
                  onChange={setDraftLine}
                  onAddItem={addDraftLineToTable}
                />

                <div className={twOrderAddedLinesPanel}>
                  <button
                    type="button"
                    className={twOrderAddedLinesToggle}
                    aria-expanded={linesTableExpanded}
                    onClick={() => setLinesTableExpanded((v) => !v)}
                  >
                    <span>
                      Added items ({lines.length})
                      {lines.length > 0 ? (
                        <span className={twOrderAddedLinesSum}>
                          {' '}
                          · {pkr.format(linesSubtotal)}
                        </span>
                      ) : null}
                    </span>
                    <FaIcon
                      icon="chevron-down"
                      className={
                        linesTableExpanded
                          ? `${twOrderChevron} ${twOrderChevronOpen}`
                          : twOrderChevron
                      }
                    />
                  </button>
                  {linesTableExpanded ? (
                    <div className={twOrderLinesTableWrap}>
                      {lines.length === 0 ? (
                        <p className={twOrderLinesTableEmpty}>No lines added yet.</p>
                      ) : (
                        <table className={twOrderLinesInnerTableCols5}>
                          <thead>
                            <tr>
                              <th scope="col">Product</th>
                              <th scope="col" className={twOrderLineColNumeric}>
                                Quantity
                              </th>
                              <th scope="col" className={twOrderLineColNumeric}>
                                weight
                              </th>
                              <th scope="col" className={twOrderLineColNumeric}>
                                price
                              </th>
                              <th
                                scope="col"
                                className={twOrderLineColActions}
                                aria-label="Remove item from order"
                              >
                                <FaIcon icon="trash-can" className={twOrderLinesThIcon} />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((row) => {
                              const u = Number(row.unitPricePkr);
                              const uw = Number(row.unitWeightG);
                              return (
                                <tr key={row.key}>
                                  <td className={twOrderLineColProduct}>
                                    <div
                                      className={twOrderLineProductName}
                                      title={row.productName || undefined}
                                    >
                                      {row.productName || '—'}
                                    </div>
                                    <div className={`${twOrderLineProductMeta} ${twMuted}`}>
                                      <span>
                                        weight:{' '}
                                        {Number.isFinite(uw) && uw >= 0 ? `${uw} g` : '—'}
                                      </span>
                                      <span>
                                        price:{' '}
                                        {Number.isFinite(u) ? pkr.format(u) : '—'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className={twOrderLineColNumeric}>
                                    <input
                                      type="number"
                                      className={twOrderLineTableQty}
                                      min={0.001}
                                      step="any"
                                      value={row.qty}
                                      aria-label={`Quantity for ${row.productName || 'item'}`}
                                      onChange={(e) =>
                                        updateTableLine(row.key, applyQtyChange(row, e.target.value))
                                      }
                                    />
                                  </td>
                                  <td className={twOrderLineColNumeric}>
                                    <input
                                      type="number"
                                      className={twOrderLineTableQty}
                                      min={0}
                                      step="any"
                                      value={row.weightG}
                                      aria-label={`Weight (g) for ${row.productName || 'item'}`}
                                      onChange={(e) =>
                                        updateTableLine(row.key, applyWeightEdit(row, e.target.value))
                                      }
                                    />
                                  </td>
                                  <td className={twOrderLineColNumeric}>
                                    <input
                                      type="number"
                                      className={twOrderLineTableQty}
                                      min={0}
                                      step="any"
                                      value={row.pricePkr}
                                      aria-label={`Price for ${row.productName || 'item'}`}
                                      onChange={(e) =>
                                        updateTableLine(row.key, applyPriceEdit(row, e.target.value))
                                      }
                                    />
                                  </td>
                                  <td className={twOrderLineColActions}>
                                    <button
                                      type="button"
                                      className={twTableIconBtnDanger}
                                      aria-label={`Remove item: ${row.productName || 'item'}`}
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

                <div className={`${twField} ${twOrderDeliveryField}`}>
                  <span className={twFieldLabel}>Delivery charges (PKR)</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={form.deliveryCharges}
                    onChange={(e) => setField('deliveryCharges', e.target.value)}
                    aria-label="Delivery charges in PKR"
                  />
                </div>
                <p className={twOrderGrandTotal}>
                  <span className={twMuted}>Lines subtotal:</span>{' '}
                  <strong>{pkr.format(linesSubtotal)}</strong>
                  <span className={twMuted}> · Grand total (with delivery):</span>{' '}
                  <strong>{pkr.format(orderGrandPreview)}</strong>
                </p>
              </section>

              <section className={twOrderModalBlock} aria-labelledby="order-customer-heading">
                <h3 id="order-customer-heading" className={twOrderFormSectionLabel}>
                  Customer
                </h3>
                <div className={twField}>
                  <span className={twFieldLabel}>Customer name</span>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setField('customerName', e.target.value)}
                    required
                    maxLength={120}
                  />
                </div>
                <div className={twOrderModalLineGrid}>
                  <div className={twField}>
                    <span className={twFieldLabel}>Contact</span>
                    <input
                      type="text"
                      value={form.customerContact}
                      onChange={(e) => setField('customerContact', e.target.value)}
                      placeholder="Phone or email"
                      maxLength={120}
                    />
                  </div>
                  <div className={twField}>
                    <span className={twFieldLabel}>City</span>
                    <input
                      type="text"
                      value={form.customerCity}
                      onChange={(e) => setField('customerCity', e.target.value)}
                      maxLength={120}
                    />
                  </div>
                </div>
                <div className={twField}>
                  <span className={twFieldLabel}>Address (optional)</span>
                  <textarea
                    className={twTextarea}
                    rows={2}
                    value={form.customerAddress}
                    onChange={(e) => setField('customerAddress', e.target.value)}
                    maxLength={500}
                    placeholder="Street, area, postal code…"
                  />
                </div>
                <div className={twField}>
                  <span className={twFieldLabel}>Note</span>
                  <textarea
                    className={twTextarea}
                    rows={2}
                    value={form.note}
                    onChange={(e) => setField('note', e.target.value)}
                    maxLength={2000}
                    placeholder="Delivery instructions, reference, etc."
                  />
                </div>
              </section>

              <section className={twOrderModalBlock}>
                <div className={twField}>
                  <span className={twFieldLabel}>Status</span>
                  <select
                    value={form.status}
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
                <div className={twAlertError} role="alert">
                  {formError}
                </div>
              ) : null}
              <div className={twModalActions}>
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm ${twBtnGhostSm}`}
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary btn-sm ${twBtnPrimarySm}`}
                  disabled={saving}
                >
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

export default Orders;
