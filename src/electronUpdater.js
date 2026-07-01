const path = require("path");
const { autoUpdater } = require("electron-updater");
const {
  parseGithubReleaseRepoInput,
  parseGithubReleaseRepoFromPackageJsonPath,
} = require("./githubReleaseRepo");
const { loadEnvFiles } = require("./loadEnv");

let updateDownloaded = false;

/** @param {unknown} info */
function serializeUpdateInfo(info) {
  if (!info || typeof info !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (info);
  let notes = o.releaseNotes;
  if (Array.isArray(notes)) {
    notes = notes
      .map((n) => {
        if (typeof n === "string") return n;
        if (n && typeof n === "object" && "note" in n)
          return String(/** @type {{ note?: string }} */ (n).note);
        return "";
      })
      .join("\n");
  }
  if (typeof notes !== "string") notes = "";
  return {
    version: o.version != null ? String(o.version) : "",
    releaseDate: o.releaseDate != null ? String(o.releaseDate) : "",
    releaseNotes: notes.slice(0, 8000),
    path: o.path != null ? String(o.path) : "",
  };
}

/**
 * @param {() => import("electron").BrowserWindow | null | undefined} getMainWindow
 * @param {Record<string, unknown>} payload
 */
function broadcast(getMainWindow, payload) {
  const w = getMainWindow();
  if (w && !w.isDestroyed()) {
    w.webContents.send("app:updater-event", payload);
  }
}

function resolveGithubToken() {
  const token =
    process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || "";
  if (token && !process.env.GH_TOKEN) {
    process.env.GH_TOKEN = token;
  }
  return token;
}

function resolveReleasePrivate(token) {
  const raw = process.env.GITHUB_RELEASE_PRIVATE?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return Boolean(token);
}

/** User-facing hint when GitHub returns 404 (private repo / bad token / no releases). */
function friendlyUpdaterError(message, gh, hasToken) {
  const m = String(message || "");
  if (!/404|authentication token|not reported/i.test(m)) return m;
  const repoLabel = gh ? `${gh.owner}/${gh.repo}` : "the configured GitHub repo";
  if (!hasToken) {
    return `Cannot reach ${repoLabel} releases. Add GITHUB_TOKEN (with repo read access) to .env, rebuild with npm run dist, or place .env next to the installed app.`;
  }
  return `Cannot reach ${repoLabel} releases. Check that GITHUB_TOKEN is valid, has repo access, and that a GitHub Release exists for this app.`;
}

/**
 * @param {object} opts
 * @param {import("electron").App} opts.app
 */
function getUpdaterConfig(opts) {
  const { app } = opts;
  loadEnvFiles(app);

  const token = resolveGithubToken();
  const fromEnv = parseGithubReleaseRepoInput(
    process.env.GITHUB_RELEASE_REPO?.trim(),
  );
  const pkgPath = path.join(app.getAppPath(), "package.json");
  const fromPkg = parseGithubReleaseRepoFromPackageJsonPath(pkgPath);
  /** Installed app: prefer committed `repository` so updates match the real release repo. Dev: `.env` overrides. */
  const gh = app.isPackaged ? fromPkg || fromEnv : fromEnv || fromPkg;

  return {
    gh,
    token,
    isPrivate: resolveReleasePrivate(token),
  };
}

/**
 * @param {object} opts
 * @param {import("electron").App} opts.app
 * @param {() => import("electron").BrowserWindow | null | undefined} opts.getMainWindow
 */
function wireAutoUpdater(opts) {
  const { app, getMainWindow } = opts;
  const { gh, token, isPrivate } = getUpdaterConfig({ app });

  if (gh) {
    autoUpdater.setFeedURL({
      provider: "github",
      owner: gh.owner,
      repo: gh.repo,
      private: isPrivate,
      ...(token ? { token } : {}),
    });
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    broadcast(getMainWindow, { type: "checking" });
  });
  autoUpdater.on("update-available", (info) => {
    updateDownloaded = false;
    broadcast(getMainWindow, {
      type: "update-available",
      info: serializeUpdateInfo(info),
    });
  });
  autoUpdater.on("update-not-available", (info) => {
    broadcast(getMainWindow, {
      type: "update-not-available",
      info: serializeUpdateInfo(info),
    });
  });
  autoUpdater.on("error", (err) => {
    const raw = err instanceof Error ? err.message : String(err);
    broadcast(getMainWindow, {
      type: "error",
      message: friendlyUpdaterError(raw, gh, Boolean(token)),
    });
  });
  autoUpdater.on("download-progress", (p) => {
    broadcast(getMainWindow, {
      type: "download-progress",
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    updateDownloaded = true;
    broadcast(getMainWindow, {
      type: "update-downloaded",
      info: serializeUpdateInfo(info),
    });
  });
}

/**
 * @param {import("electron").IpcMain} ipcMain
 * @param {import("electron").App} app
 */
function registerUpdaterIpc(ipcMain, app) {
  ipcMain.handle("app:updaterInfo", async () => {
    const { gh, token } = getUpdaterConfig({ app });
    return {
      ok: true,
      isPackaged: app.isPackaged,
      currentVersion: app.getVersion(),
      releaseRepo: gh ? `${gh.owner}/${gh.repo}` : null,
      hasGithubToken: Boolean(token),
    };
  });

  ipcMain.handle("app:updaterCheck", async () => {
    if (!app.isPackaged) {
      return {
        ok: true,
        mode: "dev",
        currentVersion: app.getVersion(),
        message:
          "Updates are delivered only in the installed app. Run `npm run dist`, install from the `release/` folder, then use Check for updates here.",
      };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        ok: true,
        mode: "packaged",
        currentVersion: app.getVersion(),
        isUpdateAvailable: Boolean(result?.isUpdateAvailable),
        updateInfo: result?.updateInfo
          ? serializeUpdateInfo(result.updateInfo)
          : null,
      };
    } catch (e) {
      const { gh, token } = getUpdaterConfig({ app });
      const raw = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: friendlyUpdaterError(raw, gh, Boolean(token)),
        currentVersion: app.getVersion(),
      };
    }
  });

  ipcMain.handle("app:updaterQuitAndInstall", async () => {
    if (!app.isPackaged) {
      return { ok: false, error: "Not available in development." };
    }
    if (!updateDownloaded) {
      return {
        ok: false,
        error:
          "No finished update download yet. Check for updates and wait until the download completes.",
      };
    }
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { ok: true };
  });
}

/**
 * @param {object} opts
 * @param {import("electron").App} opts.app
 * @param {import("electron").IpcMain} opts.ipcMain
 * @param {() => import("electron").BrowserWindow | null | undefined} opts.getMainWindow
 */
function registerAppUpdater(opts) {
  wireAutoUpdater({ app: opts.app, getMainWindow: opts.getMainWindow });
  registerUpdaterIpc(opts.ipcMain, opts.app);
}

module.exports = { registerAppUpdater };
