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
  const [uInfo, setUInfo] = useState(null);
  const [updaterErr, setUpdaterErr] = useState('');
  const [uCheckLoading, setUCheckLoading] = useState(false);
  const [uProgress, setUProgress] = useState(null);
  const [uPhase, setUPhase] = useState(
    /** @type {'idle' | 'checking' | 'dev' | 'available' | 'latest' | 'downloaded' | 'error'} */ (
      'idle'
    ),
  );
  const [uRemote, setURemote] = useState(null);
  const [uDevMessage, setUDevMessage] = useState('');

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

  const runUpdateCheck = useCallback(async () => {
    if (!isAdmin) return;
    setUpdaterErr('');
    setUDevMessage('');
    setUCheckLoading(true);
    setUPhase('checking');
    setUProgress(null);
    try {
      const r = await getApi().checkAppUpdates();
      setUCheckLoading(false);
      if (r.ok !== true) {
        setUpdaterErr(r.error || 'Could not check for updates.');
        setUPhase('idle');
        return;
      }
      if (r.mode === 'dev') {
        setUPhase('dev');
        setUDevMessage(r.message || '');
        return;
      }
      if (!r.isUpdateAvailable) {
        setUPhase('latest');
        setURemote(r.updateInfo);
        setUProgress(null);
      } else {
        setUPhase('available');
        setURemote(r.updateInfo);
      }
    } catch (e) {
      setUCheckLoading(false);
      setUpdaterErr(e instanceof Error ? e.message : 'Could not check for updates.');
      setUPhase('idle');
    }
  }, [isAdmin]);

  const quitAndInstall = useCallback(async () => {
    setUpdaterErr('');
    try {
      const r = await getApi().quitAndInstallUpdate();
      if (r.ok !== true) {
        setUpdaterErr(r.error || 'Could not restart the app.');
      }
    } catch (e) {
      setUpdaterErr(e instanceof Error ? e.message : 'Could not restart the app.');
    }
  }, []);

  useEffect(() => {
    if (!active || !isAdmin) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await getApi().getUpdaterInfo();
        if (cancelled) return;
        if (r.ok === true) {
          setUInfo(r);
        } else {
          setUpdaterErr(r.error || '');
        }
      } catch (e) {
        if (!cancelled) {
          setUpdaterErr(e instanceof Error ? e.message : '');
        }
      }
    })();

    const api = getApi();
    const unsub =
      typeof api.onUpdaterEvent === 'function'
        ? api.onUpdaterEvent((payload) => {
            if (!payload || typeof payload !== 'object') return;
            const t = /** @type {{ type?: string }} */ (payload).type;
            if (t === 'checking') {
              setUPhase('checking');
            }
            if (t === 'update-available') {
              setUPhase('available');
              setURemote(/** @type {{ info?: unknown }} */ (payload).info ?? null);
            }
            if (t === 'update-not-available') {
              setUPhase('latest');
              setURemote(/** @type {{ info?: unknown }} */ (payload).info ?? null);
              setUProgress(null);
            }
            if (t === 'download-progress') {
              const p = /** @type {{ percent?: number }} */ (payload).percent;
              setUProgress(typeof p === 'number' ? p : 0);
            }
            if (t === 'update-downloaded') {
              setUPhase('downloaded');
              setUProgress(100);
              setURemote(/** @type {{ info?: unknown }} */ (payload).info ?? null);
            }
            if (t === 'error') {
              setUPhase('error');
              setUpdaterErr(/** @type {{ message?: string }} */ (payload).message || 'Update error');
              setUProgress(null);
            }
          })
        : () => {};

    return () => {
      cancelled = true;
      unsub();
    };
  }, [active, isAdmin]);

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

      {/* {isAdmin ? (
        <section className="card dash-panel dash-panel-wide" style={{ marginTop: '1rem' }}>
          <div className="dash-panel-head">
            <h3 className="section-title section-title-sm">Software update</h3>
            <div className="dash-panel-head-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={runUpdateCheck}
                disabled={uCheckLoading}
              >
                {uCheckLoading ? 'Checking…' : 'Check for updates'}
              </button>
            </div>
          </div>
          {updaterErr ? (
            <div className="alert alert-error" role="alert">
              {updaterErr}
            </div>
          ) : null}
          {uInfo?.ok === true ? (
            <p className="section-desc section-desc-tight" style={{ marginTop: 0 }}>
              Installed version <strong className="cell-mono">{uInfo.currentVersion}</strong>
              {uInfo.isPackaged ? '' : ' — this session is a development build (not updatable).'}
            </p>
          ) : null}
          {uPhase === 'dev' ? (
            <p className="empty-hint" style={{ margin: '0.5rem 0 0' }}>
              {uDevMessage ||
                'Updates use electron-updater against GitHub Releases only in the packaged installer.'}{' '}
              Run <span className="cell-mono">npm run dist</span>, install from <span className="cell-mono">release/</span>, then open that app.
            </p>
          ) : null}
          {uPhase === 'checking' && uInfo?.isPackaged && !updaterErr ? (
            <p className="empty-hint" style={{ marginTop: '0.5rem' }}>
              Contacting update server…
            </p>
          ) : null}
          {(uPhase === 'available' ||
            (typeof uProgress === 'number' && uProgress >= 0 && uProgress < 100)) &&
          uInfo?.isPackaged ? (
            <div style={{ marginTop: '0.75rem' }}>
              <p className="section-desc section-desc-tight" style={{ marginTop: 0 }}>
                Downloading{' '}
                {uRemote && typeof uRemote === 'object' && 'version' in uRemote ? (
                  <strong className="cell-mono">{String(uRemote.version)}</strong>
                ) : (
                  'update'
                )}
                …
              </p>
              <progress
                className="dash-update-progress"
                value={uProgress ?? 0}
                max={100}
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            </div>
          ) : null}
          {uPhase === 'latest' && uInfo?.isPackaged ? (
            <p className="empty-hint" style={{ marginTop: '0.5rem' }}>
              You are on the latest published release (or newer than GitHub).
            </p>
          ) : null}
          {uPhase === 'downloaded' ? (
            <div className="alert alert-success" role="status" style={{ marginTop: '0.75rem' }}>
              <p style={{ margin: 0 }}>Update downloaded. Restart now to finish installing.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: '0.5rem' }}
                onClick={quitAndInstall}
              >
                Restart and install
              </button>
            </div>
          ) : null}
          {uInfo?.ok === true && uInfo.isPackaged ? (
            <p className="empty-hint" style={{ marginTop: '0.75rem' }}>
              Built with <strong>electron-updater</strong> + <strong>electron-builder</strong>. The
              installed app reads GitHub <span className="cell-mono">repository</span> from{' '}
              <span className="cell-mono">package.json</span> first; optional{' '}
              <span className="cell-mono">GITHUB_RELEASE_REPO</span> in <span className="cell-mono">.env</span>{' '}
              overrides in dev or as a fallback when packaged. Private repos:{' '}
              <span className="cell-mono">GITHUB_TOKEN</span> / <span className="cell-mono">GH_TOKEN</span>{' '}
              on the machine (see electron-updater docs).
            </p>
          ) : null}
        </section>
      ) : null} */}

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
