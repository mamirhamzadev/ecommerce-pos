import { useCallback, useEffect, useState } from 'react';
import { getApi } from '../../api';
import { FaIcon } from '../FaIcon';

/**
 * Sidebar footer: current app version, auto update check, download progress, quit & install.
 */
export function SidebarUpdate() {
  const [currentVersion, setCurrentVersion] = useState('');
  const [isPackaged, setIsPackaged] = useState(false);
  const [phase, setPhase] = useState(
    /** @type {'idle' | 'checking' | 'dev' | 'available' | 'latest' | 'downloaded' | 'error'} */ ('idle'),
  );
  const [remoteVersion, setRemoteVersion] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [devMessage, setDevMessage] = useState('');

  const runCheck = useCallback(async () => {
    setError('');
    setDevMessage('');
    setPhase('checking');
    setProgress(null);
    try {
      const r = await getApi().checkAppUpdates();
      if (r.ok !== true) {
        setError(r.error || 'Could not check for updates.');
        setPhase('idle');
        return;
      }
      if (r.mode === 'dev') {
        setPhase('dev');
        setDevMessage(r.message || '');
        if (r.currentVersion) setCurrentVersion(r.currentVersion);
        return;
      }
      if (r.currentVersion) setCurrentVersion(r.currentVersion);
      if (!r.isUpdateAvailable) {
        setPhase('latest');
        if (r.updateInfo?.version) setRemoteVersion(r.updateInfo.version);
        setProgress(null);
      } else {
        setPhase('available');
        if (r.updateInfo?.version) setRemoteVersion(r.updateInfo.version);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check for updates.');
      setPhase('idle');
    }
  }, []);

  const quitAndInstall = useCallback(async () => {
    setError('');
    try {
      const r = await getApi().quitAndInstallUpdate();
      if (r.ok !== true) {
        setError(r.error || 'Could not restart the app.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restart the app.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = await getApi().getUpdaterInfo();
        if (cancelled) return;
        if (r.ok === true) {
          setCurrentVersion(r.currentVersion || '');
          setIsPackaged(Boolean(r.isPackaged));
        } else {
          setError(r.error || '');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '');
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
              setPhase('checking');
            }
            if (t === 'update-available') {
              setPhase('available');
              const info = /** @type {{ info?: { version?: string } }} */ (payload).info;
              if (info?.version) setRemoteVersion(info.version);
            }
            if (t === 'update-not-available') {
              setPhase('latest');
              const info = /** @type {{ info?: { version?: string } }} */ (payload).info;
              if (info?.version) setRemoteVersion(info.version);
              setProgress(null);
            }
            if (t === 'download-progress') {
              const p = /** @type {{ percent?: number }} */ (payload).percent;
              setProgress(typeof p === 'number' ? p : 0);
            }
            if (t === 'update-downloaded') {
              setPhase('downloaded');
              setProgress(100);
              const info = /** @type {{ info?: { version?: string } }} */ (payload).info;
              if (info?.version) setRemoteVersion(info.version);
            }
            if (t === 'error') {
              setPhase('error');
              setError(
                /** @type {{ message?: string }} */ (payload).message || 'Update error',
              );
              setProgress(null);
            }
          })
        : () => {};

    runCheck();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [runCheck]);

  const versionLabel = currentVersion ? `v${currentVersion}` : '…';
  const isDownloading =
    isPackaged &&
    (phase === 'available' ||
      (typeof progress === 'number' && progress >= 0 && progress < 100));

  return (
    <div className="sidebar-update" aria-live="polite">
      <div className="sidebar-update-head">
        <FaIcon icon="code-branch" className="sidebar-update-icon" aria-hidden="true" />
        <span className="sidebar-update-version cell-mono">{versionLabel}</span>
      </div>

      {phase === 'checking' && isPackaged && !error ? (
        <p className="sidebar-update-status">Checking for updates…</p>
      ) : null}

      {phase === 'dev' ? (
        <p className="sidebar-update-status">
          {devMessage || 'Development build — updates apply to the installed app only.'}
        </p>
      ) : null}

      {phase === 'latest' && isPackaged ? (
        <p className="sidebar-update-status">You are on the latest version.</p>
      ) : null}

      {isDownloading ? (
        <div className="sidebar-update-download">
          <p className="sidebar-update-status">
            Downloading {remoteVersion ? `v${remoteVersion}` : 'update'}…
          </p>
          <progress
            className="sidebar-update-progress"
            value={progress ?? 0}
            max={100}
            aria-label="Update download progress"
          />
          <p className="sidebar-update-hint">
            Close the app when ready — the update installs on quit.
          </p>
        </div>
      ) : null}

      {phase === 'downloaded' ? (
        <div className="sidebar-update-ready">
          <p className="sidebar-update-status sidebar-update-status--ready">
            v{remoteVersion || 'Update'} ready to install.
          </p>
          <button
            type="button"
            className="sidebar-update-install-btn"
            onClick={quitAndInstall}
          >
            <FaIcon icon="download" className="sidebar-fa" aria-hidden="true" />
            Quit &amp; install
          </button>
          <p className="sidebar-update-hint">
            Or close the app — the update installs automatically on quit.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="sidebar-update-error" role="alert">
          {error.length > 220 ? `${error.slice(0, 220)}…` : error}
        </p>
      ) : null}
    </div>
  );
}
