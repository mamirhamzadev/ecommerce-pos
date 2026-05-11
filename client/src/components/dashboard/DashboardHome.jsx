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
    setError(res.error || 'Could not load dashboard.');
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

      {isAdmin ? (
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
              Built with <strong>electron-updater</strong> + <strong>electron-builder</strong>. Set{' '}
              <span className="cell-mono">GITHUB_RELEASE_REPO=owner/repo</span> when running{' '}
              <span className="cell-mono">npm run dist</span> so the app knows which GitHub project to
              read. Private repos: set <span className="cell-mono">GITHUB_TOKEN</span> or{' '}
              <span className="cell-mono">GH_TOKEN</span> for this machine user (see electron-updater
              docs).
            </p>
          ) : null}
        </section>
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
