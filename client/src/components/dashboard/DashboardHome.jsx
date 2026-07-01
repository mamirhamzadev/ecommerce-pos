import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../../api';
import { notifyError } from '../../lib/notify';
import { FaIcon } from '../FaIcon';
import { RelativeTime } from '../../RelativeTime';

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

function orderHBarWidthPct(count, max) {
  const n = Math.max(0, Number(count) || 0);
  const m = Math.max(1, Number(max) || 0);
  return (n / m) * 100;
}

/**
 * @param {{
 *   active: boolean,
 *   isAdmin: boolean,
 * }} props
 */
export function DashboardHome({ active, isAdmin }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    const res = await getApi().getDashboardSnapshot();
    setLoading(false);
    if (res.ok === true) {
      setData(res);
      return;
    }
    const msg = res.error || 'Could not load dashboard.';
    setError(msg);
    notifyError(msg);
  }, []);

  useEffect(() => {
    if (active) {
      load();
    }
  }, [active, load]);

  if (!active) {
    return null;
  }

  if (loading && !data) {
    return (
      <div className="dashboard-home">
        <p className="empty-hint">Loading overview…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-home">
        <p className="empty-hint">Could not load the overview. Use Retry below or check your connection.</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  const c = data?.counts;
  const recentOrders = data?.recentOrders ?? [];
  const recentProducts = data?.recentProducts ?? [];

  const pendingOrders = Number(c?.ordersOpen) || 0;
  const deliveredOrders = Number(c?.ordersDelivered) || 0;
  const cancelledOrders = Number(c?.ordersCancelled) || 0;
  const orderStatusMax = Math.max(pendingOrders, deliveredOrders, cancelledOrders, 1);

  return (
    <div className="dashboard-home">
      <div className="dashboard-home-toolbar">
        <p className="section-desc section-desc-tight" style={{ margin: 0 }}>
          Overview, recent activity, and order status mix.
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm table-refresh-btn"
          onClick={load}
          disabled={loading}
          aria-label={loading ? 'Refreshing dashboard' : 'Refresh dashboard'}
          title="Refresh"
        >
          <FaIcon icon="arrows-rotate" className={loading ? 'fa-spin' : ''} />
        </button>
      </div>

      <div className="stat-grid">
        <button
          type="button"
          className="stat-card"
          onClick={() => navigate('/products')}
        >
          <span className="stat-card-label">Products</span>
          <span className="stat-card-value">{c?.products ?? 0}</span>
          <span className="stat-card-hint">Name, weight & unit price</span>
        </button>
        <button
          type="button"
          className="stat-card"
          onClick={() => navigate('/orders')}
        >
          <span className="stat-card-label">Orders</span>
          <span className="stat-card-value">{c?.orders ?? 0}</span>
          <span className="stat-card-hint">{c?.ordersOpen ?? 0} open / pending</span>
        </button>
        <button
          type="button"
          className="stat-card"
          onClick={() => navigate('/invoices')}
        >
          <span className="stat-card-label">Invoices</span>
          <span className="stat-card-value">{c?.invoices ?? 0}</span>
          <span className="stat-card-hint">{c?.invoicesUnpaid ?? 0} unpaid / draft</span>
        </button>
        <button
          type="button"
          className="stat-card"
          onClick={() => navigate('/orders')}
          title="Open orders"
        >
          <span className="stat-card-label">Cancelled orders</span>
          <span className="stat-card-value">{c?.ordersCancelled ?? 0}</span>
          <span className="stat-card-hint">All-time cancelled</span>
        </button>
      </div>

      <div className="dash-panels">
        <section className="card dash-panel">
          <div className="dash-panel-head">
            <h3 className="section-title section-title-sm">Recent pending orders</h3>
            <div className="dash-panel-head-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/orders')}
              >
                View all
              </button>
            </div>
          </div>
          {recentOrders.length === 0 ? (
            <p className="dash-panel-empty">No pending orders right now.</p>
          ) : (
            <div className="table-wrap dash-table-wrap">
              <table className="data-table data-table-compact">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Lines</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="table-strong cell-mono">{o.order_number}</td>
                      <td className="cell-mono">{o.line_count ?? '—'}</td>
                      <td>{o.customer_name || '—'}</td>
                      <td className="cell-mono">{pkr.format(Number(o.total) || 0)}</td>
                      <td>
                        <span className="dash-status">{o.status}</span>
                      </td>
                      <td className="cell-mono">
                        <RelativeTime value={o.created_at} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card dash-panel">
          <div className="dash-panel-head">
            <h3 className="section-title section-title-sm">Recent products</h3>
            <div className="dash-panel-head-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/products')}
              >
                View all
              </button>
            </div>
          </div>
          {recentProducts.length === 0 ? (
            <p className="dash-panel-empty">No products in the catalog yet.</p>
          ) : (
            <div className="table-wrap dash-table-wrap">
              <table className="data-table data-table-compact">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Weight</th>
                    <th>Unit price</th>
                    <th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="table-strong">{p.name || '—'}</td>
                      <td className="cell-mono">{formatWeightG(p.weight_g)}</td>
                      <td className="cell-mono">{pkr.format(Number(p.price) || 0)}</td>
                      <td className="cell-mono">
                        <RelativeTime value={p.created_at} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section
        className="card dash-panel dash-order-status"
        aria-labelledby="order-status-bars-heading"
      >
        <div className="dash-panel-head">
          <div>
            <h3 id="order-status-bars-heading" className="section-title section-title-sm">
              Orders by status
            </h3>
            <p className="section-desc section-desc-tight order-status-sub">
              Pending, delivered, and cancelled orders (bar length is relative to the largest count).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/orders')}
          >
            View orders
          </button>
        </div>

        <div className="order-hbar-list" role="list">
          <div className="order-hbar-row" role="listitem">
            <div className="order-hbar-top">
              <span className="order-hbar-title">Pending</span>
              <span className="order-hbar-count cell-mono">{pendingOrders}</span>
            </div>
            <div className="order-hbar-track" aria-hidden="true">
              <div
                className="order-hbar-fill order-hbar-fill--pending"
                style={{ width: `${orderHBarWidthPct(pendingOrders, orderStatusMax)}%` }}
              />
            </div>
          </div>
          <div className="order-hbar-row" role="listitem">
            <div className="order-hbar-top">
              <span className="order-hbar-title">Delivered</span>
              <span className="order-hbar-count cell-mono">{deliveredOrders}</span>
            </div>
            <div className="order-hbar-track" aria-hidden="true">
              <div
                className="order-hbar-fill order-hbar-fill--delivered"
                style={{ width: `${orderHBarWidthPct(deliveredOrders, orderStatusMax)}%` }}
              />
            </div>
          </div>
          <div className="order-hbar-row" role="listitem">
            <div className="order-hbar-top">
              <span className="order-hbar-title">Cancelled</span>
              <span className="order-hbar-count cell-mono">{cancelledOrders}</span>
            </div>
            <div className="order-hbar-track" aria-hidden="true">
              <div
                className="order-hbar-fill order-hbar-fill--cancelled"
                style={{ width: `${orderHBarWidthPct(cancelledOrders, orderStatusMax)}%` }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
