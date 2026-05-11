import { useCallback, useEffect, useState } from 'react';
import { getApi } from '../../api';
import { FaIcon } from '../FaIcon';
import { RelativeTime } from '../../RelativeTime';

const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 2,
});

/**
 * @param {{
 *   active: boolean,
 *   isAdmin: boolean,
 *   onOpenModule: (id: 'products' | 'orders' | 'invoices' | 'users') => void,
 * }} props
 */
export function DashboardHome({ active, isAdmin, onOpenModule }) {
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
    setError(res.error || 'Could not load dashboard.');
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
        <div className="alert alert-error" role="alert">
          {error}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  const c = isAdmin ? data?.counts : null;
  const recentOrders = data?.recentOrders ?? [];
  const recentLogins = isAdmin ? (data?.recentLogins ?? []) : [];
  const recentSignups = isAdmin ? (data?.recentSignups ?? []) : [];

  return (
    <div className="dashboard-home">
      <div className="dashboard-home-toolbar">
        <p className="section-desc section-desc-tight" style={{ margin: 0 }}>
          {isAdmin
            ? 'Live counts and the latest three pending orders, sign-ins, and new accounts.'
            : 'The latest pending orders (up to three).'}
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

      {isAdmin ? (
        <div className="stat-grid">
          <button
            type="button"
            className="stat-card"
            onClick={() => onOpenModule('products')}
          >
            <span className="stat-card-label">Products</span>
            <span className="stat-card-value">{c?.products ?? 0}</span>
            <span className="stat-card-hint">Name, weight & unit price</span>
          </button>
          <button
            type="button"
            className="stat-card"
            onClick={() => onOpenModule('orders')}
          >
            <span className="stat-card-label">Orders</span>
            <span className="stat-card-value">{c?.orders ?? 0}</span>
            <span className="stat-card-hint">
              {c?.ordersOpen ?? 0} open / pending
            </span>
          </button>
          <button
            type="button"
            className="stat-card"
            onClick={() => onOpenModule('invoices')}
          >
            <span className="stat-card-label">Invoices</span>
            <span className="stat-card-value">{c?.invoices ?? 0}</span>
            <span className="stat-card-hint">
              {c?.invoicesUnpaid ?? 0} unpaid / draft
            </span>
          </button>
          <button
            type="button"
            className="stat-card"
            onClick={() => onOpenModule('users')}
            title="Open users"
          >
            <span className="stat-card-label">Users</span>
            <span className="stat-card-value">{c?.users ?? 0}</span>
            <span className="stat-card-hint">Staff accounts</span>
          </button>
        </div>
      ) : null}

      <div className={`dash-panels${isAdmin ? '' : ' dash-panels-user-only'}`}>
        <section className="card dash-panel">
          <div className="dash-panel-head">
            <h3 className="section-title section-title-sm">Recent pending orders</h3>
            <div className="dash-panel-head-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onOpenModule('orders')}
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

        {isAdmin ? (
          <section className="card dash-panel">
            <div className="dash-panel-head">
              <h3 className="section-title section-title-sm">Recent sign-ins</h3>
            </div>
            {recentLogins.length === 0 ? (
              <p className="dash-panel-empty">No sign-in history yet.</p>
            ) : (
              <div className="table-wrap dash-table-wrap">
                <table className="data-table data-table-compact">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Signed in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogins.map((row, i) => (
                      <tr key={`${row.user_id}-${row.logged_in_at}-${i}`}>
                        <td>
                          <span className="table-strong">
                            {row.name?.trim() || row.username}
                          </span>
                          <span className="muted dash-sub"> @{row.username}</span>
                        </td>
                        <td className="cell-mono">
                          <RelativeTime value={row.logged_in_at} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {isAdmin ? (
          <section className="card dash-panel dash-panel-wide">
            <div className="dash-panel-head">
              <h3 className="section-title section-title-sm">New accounts</h3>
              <div className="dash-panel-head-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onOpenModule('users')}
                >
                  Manage users
                </button>
              </div>
            </div>
            {recentSignups.length === 0 ? (
              <p className="dash-panel-empty">No newly created accounts yet.</p>
            ) : (
              <div className="table-wrap dash-table-wrap">
                <table className="data-table data-table-compact">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSignups.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name?.trim() || '—'}</td>
                        <td className="cell-mono">{u.username}</td>
                        <td>
                          <span
                            className={
                              u.role === 'admin' ? 'badge badge-admin' : 'badge badge-user'
                            }
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="cell-mono">
                          <RelativeTime value={u.created_at} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
