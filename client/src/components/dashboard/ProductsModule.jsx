import { useCallback, useEffect, useRef, useState } from 'react';
import { getApi } from '../../api';
import { RelativeTime } from '../../RelativeTime';
import { FaIcon } from '../FaIcon';

const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 2,
});

function formatWeightG(g) {
  const n = Number(g);
  if (!Number.isFinite(n)) return '—';
  if (Number.isInteger(n)) return `${n} g`;
  return `${n.toFixed(2)} g`;
}

/** @param {{ permissions: ReturnType<typeof import('../../permissions').mergePermissions> }} props */
export function ProductsModule({ permissions }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);

  const [filterSearchInput, setFilterSearchInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const lastSearchCommittedRef = useRef('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async (p, ps) => {
    setListError('');
    setLoading(true);
    const res = await getApi().listProductsPaged({
      page: p,
      pageSize: ps,
      q: filterSearch,
    });
    setLoading(false);
    if (res.ok === true) {
      setProducts(res.products);
      setTotal(res.total);
      if (res.page !== p) {
        setPage(res.page);
      }
      return true;
    }
    setListError(res.error || 'Could not load products.');
    return false;
  }, [filterSearch]);

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
        setModalOpen(false);
        setEditingId(null);
        setFormError('');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  function openCreate() {
    if (!permissions.canCreateProduct) return;
    setEditingId(null);
    setFormName('');
    setFormWeight('');
    setFormPrice('');
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(p) {
    if (!permissions.canEditProduct) return;
    setEditingId(p.id);
    setFormName(p.name || '');
    setFormWeight(String(p.weight_g ?? ''));
    setFormPrice(String(p.price ?? ''));
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const api = getApi();
    const payload = {
      name: formName.trim(),
      weightG: Number(formWeight),
      unitPricePkr: Number(formPrice),
    };
    const res = editingId
      ? await api.updateProduct({ id: editingId, ...payload })
      : await api.createProduct(payload);
    setSaving(false);
    if (res.ok !== true) {
      setFormError(res.error || 'Could not save product.');
      return;
    }
    const wasEdit = Boolean(editingId);
    const listPage = wasEdit ? page : 1;
    closeModal();
    if (!wasEdit) {
      setPage(1);
    }
    await loadList(listPage, pageSize);
  }

  async function handleDelete(p) {
    if (!permissions.canRemoveProduct) return;
    if (!window.confirm(`Delete product “${p.name}”?`)) return;
    setListError('');
    const res = await getApi().deleteProduct({ id: p.id });
    if (!res.ok) {
      setListError(res.error || 'Delete failed.');
      return;
    }
    await loadList(page, pageSize);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const hasActiveFilters = filterSearchInput.trim() !== '';

  function clearProductFilters() {
    setFilterSearchInput('');
    setFilterSearch('');
    lastSearchCommittedRef.current = '';
    setPage(1);
  }

  return (
    <div className="products-page">
      <div className="products-page-header">
        <div>
          <h2 className="section-title">Products</h2>
          <p className="section-desc section-desc-tight">
            Catalog items with weight in grams and unit price in PKR. Use the + button
            to add a product.
          </p>
        </div>
        {permissions.canCreateProduct ? (
          <button
            type="button"
            className="fab-plus"
            aria-label="Add product"
            onClick={openCreate}
          >
            <FaIcon icon="plus" className="fab-plus-fa" />
          </button>
        ) : null}
      </div>

      {listError ? (
        <div className="alert alert-error" role="alert">
          {listError}
        </div>
      ) : null}

      <div className="card">
        <div className="users-table-head">
          <h3 className="section-title section-title-sm">Inventory</h3>
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
          {total} product{total === 1 ? '' : 's'}
          {hasActiveFilters ? ' match your search.' : ' total.'}
        </p>

        <div className="orders-filter-bar">
          <div className="orders-filter-field orders-filter-grow">
            <span className="field-label" id="products-filter-q-label">
              Search
            </span>
            <input
              id="products-filter-q"
              type="search"
              className="orders-filter-search"
              placeholder="Name, weight (g), or unit price"
              aria-labelledby="products-filter-q-label"
              autoComplete="off"
              value={filterSearchInput}
              onChange={(e) => setFilterSearchInput(e.target.value)}
            />
          </div>
          {hasActiveFilters ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearProductFilters}>
              Clear search
            </button>
          ) : null}
        </div>

        <div className="table-wrap">
          {loading ? (
            <p className="empty-hint">Loading…</p>
          ) : products.length === 0 ? (
            <p className="empty-hint">
              {hasActiveFilters
                ? 'No products match this search.'
                : 'No products yet. Tap + to add your first item.'}
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Weight</th>
                  <th>Unit price</th>
                  <th>Added</th>
                  <th className="table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="table-strong">{p.name}</td>
                    <td className="cell-mono">{formatWeightG(p.weight_g)}</td>
                    <td className="cell-mono">{pkr.format(Number(p.price) || 0)}</td>
                    <td className="cell-mono">
                      <RelativeTime value={p.created_at} />
                    </td>
                    <td className="table-actions">
                      {permissions.canEditProduct || permissions.canRemoveProduct ? (
                        <div
                          className="table-action-group"
                          role="group"
                          aria-label="Product actions"
                        >
                          {permissions.canEditProduct ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm table-action-icon-btn"
                              aria-label={`Edit product ${p.name}`}
                              onClick={() => openEdit(p)}
                            >
                              <FaIcon icon="pen-to-square" />
                            </button>
                          ) : null}
                          {permissions.canRemoveProduct ? (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm table-action-icon-btn"
                              aria-label={`Delete product ${p.name}`}
                              onClick={() => handleDelete(p)}
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
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="product-modal-title" className="modal-title">
              {editingId ? 'Edit product' : 'New product'}
            </h2>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="field">
                <span className="field-label">Product name</span>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Basmati rice 5kg"
                  maxLength={200}
                  required
                  autoFocus
                />
              </div>
              <div className="field">
                <span className="field-label">Weight (g)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
              <div className="field">
                <span className="field-label">Unit price (PKR)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
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
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
