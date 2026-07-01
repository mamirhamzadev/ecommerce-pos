import { useState } from 'react';
import { useSelector } from 'react-redux';
import { getApi } from '../api';
import { notifyError, notifyInfo, notifySuccess } from '../lib/notify';

const BACKUP_OPTIONS = [
  { key: 'logins', label: 'Logins', hint: 'User accounts and login history' },
  { key: 'products', label: 'Products', hint: 'Product catalog' },
  { key: 'orders', label: 'Orders', hint: 'Orders and line items' },
  { key: 'invoices', label: 'Invoices', hint: 'Invoice records' },
];

function formatSelectionLabels(selection) {
  return BACKUP_OPTIONS.filter((o) => selection?.[o.key])
    .map((o) => o.label)
    .join(', ');
}

function Settings() {
  const user = useSelector((state) => /** @type {any} */ (state)?.auth?.user);
  const isAdmin = user?.role === 'admin';

  const [selection, setSelection] = useState({
    logins: true,
    products: true,
    orders: true,
    invoices: true,
  });
  const [deleteAfterBackup, setDeleteAfterBackup] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [validating, setValidating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(
    /** @type {{ filePath: string; meta: any; counts: Record<string, number> } | null} */ (null),
  );

  function toggleSelection(key) {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const hasSelection =
    selection.logins || selection.products || selection.orders || selection.invoices;

  async function handleBackup() {
    if (!hasSelection) {
      notifyError('Select at least one category to back up.');
      return;
    }
    if (
      deleteAfterBackup &&
      (selection.orders || selection.invoices) &&
      !window.confirm(
        'After backup, orders and invoices will be removed from this app to save space. Logins and products will be kept. Continue?',
      )
    ) {
      return;
    }

    setBackingUp(true);
    try {
      const res = await getApi().createBackup({
        selection,
        deleteAfterBackup,
      });
      if (res.cancelled) {
        return;
      }
      if (!res.ok) {
        notifyError(res.error || 'Backup failed.');
        return;
      }
      let message = `Backup saved successfully.`;
      if (res.deletedAfterBackup) {
        message += ' Orders and invoices were removed from this app.';
      }
      if (res.warning) {
        notifyInfo(res.warning);
      }
      notifySuccess(message);
    } finally {
      setBackingUp(false);
    }
  }

  async function handlePickBackup() {
    setValidating(true);
    setPendingRestore(null);
    try {
      const res = await getApi().validateBackupFile();
      if (res.cancelled) {
        return;
      }
      if (!res.ok) {
        notifyError(res.error || 'Invalid backup file.');
        return;
      }
      setPendingRestore({
        filePath: res.filePath,
        meta: res.meta,
        counts: res.counts,
      });
      notifyInfo('Backup file verified. Review the details below, then restore.');
    } finally {
      setValidating(false);
    }
  }

  async function handleRestore() {
    if (!pendingRestore?.filePath) {
      notifyError('Select and verify a backup file first.');
      return;
    }
    if (
      !window.confirm(
        'Restore will merge backup data into this app. Duplicate records will be skipped. Continue?',
      )
    ) {
      return;
    }

    setRestoring(true);
    try {
      const res = await getApi().restoreBackup({ filePath: pendingRestore.filePath });
      if (!res.ok) {
        notifyError(res.error || 'Restore failed.');
        return;
      }
      const parts = Object.entries(res.restored || {})
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`);
      const summary = parts.length ? parts.join(', ') : 'no new records';
      notifySuccess(`Restore complete: ${summary}.`);
      setPendingRestore(null);
    } finally {
      setRestoring(false);
    }
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <section className="card module-card">
        <h2 className="section-title section-title-sm">Settings</h2>
        <p className="section-desc">
          Backup and restore are available to administrators only. Contact an admin if you need
          to export or import data.
        </p>
      </section>
    );
  }

  return (
    <div className="settings-layout">
      <section className="card module-card settings-card">
        <h2 className="section-title section-title-sm">Backup</h2>
        <p className="section-desc section-desc-tight">
          Choose what to include, pick a save location, and create a{' '}
          <span className="cell-mono">.db</span> backup file on your computer.
        </p>

        <fieldset className="settings-fieldset">
          <legend className="settings-legend">Include in backup</legend>
          <ul className="settings-check-list">
            {BACKUP_OPTIONS.map(({ key, label, hint }) => (
              <li key={key}>
                <label className="settings-check-row">
                  <input
                    type="checkbox"
                    checked={Boolean(selection[key])}
                    onChange={() => toggleSelection(key)}
                  />
                  <span className="settings-check-text">
                    <span className="settings-check-label">{label}</span>
                    <span className="settings-check-hint">{hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <label className="settings-check-row settings-check-row-inline">
          <input
            type="checkbox"
            checked={deleteAfterBackup}
            onChange={(e) => setDeleteAfterBackup(e.target.checked)}
            disabled={!selection.orders && !selection.invoices}
          />
          <span className="settings-check-text">
            <span className="settings-check-label">Delete orders and invoices after backup</span>
            <span className="settings-check-hint">
              Frees space by removing backed-up orders and invoices from this app. Logins and
              products are never deleted.
            </span>
          </span>
        </label>

        <div className="form-footer settings-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleBackup}
            disabled={backingUp || !hasSelection}
          >
            {backingUp ? 'Creating backup…' : 'Create backup'}
          </button>
        </div>
      </section>

      <section className="card module-card settings-card">
        <h2 className="section-title section-title-sm">Restore</h2>
        <p className="section-desc section-desc-tight">
          Select a backup file. It will be verified against this app&apos;s data format before
          anything is imported. Existing records are kept; duplicates are skipped.
        </p>

        <div className="form-footer settings-actions settings-actions-start">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handlePickBackup}
            disabled={validating || restoring}
          >
            {validating ? 'Verifying…' : 'Select backup file'}
          </button>
        </div>

        {pendingRestore ? (
          <div className="settings-restore-preview">
            <h3 className="section-title section-title-sm">Verified backup</h3>
            <dl className="profile-dl settings-restore-dl">
              <div>
                <dt>App</dt>
                <dd>{pendingRestore.meta?.appName || '—'}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd className="cell-mono">{pendingRestore.meta?.createdAt || '—'}</dd>
              </div>
              <div>
                <dt>Categories</dt>
                <dd>{formatSelectionLabels(pendingRestore.meta?.selection) || '—'}</dd>
              </div>
            </dl>
            <ul className="settings-restore-counts">
              {BACKUP_OPTIONS.filter((o) => pendingRestore.meta?.selection?.[o.key]).map(
                ({ key, label }) => (
                  <li key={key}>
                    <span>{label}</span>
                    <span className="cell-mono">{pendingRestore.counts?.[key] ?? 0} rows</span>
                  </li>
                ),
              )}
            </ul>
            <div className="form-footer settings-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPendingRestore(null)}
                disabled={restoring}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRestore}
                disabled={restoring}
              >
                {restoring ? 'Restoring…' : 'Restore data'}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default Settings;
