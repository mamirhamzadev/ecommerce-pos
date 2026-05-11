const path = require("path");
const { autoUpdater } = require("electron-updater");
const {
  parseGithubReleaseRepoInput,
  parseGithubReleaseRepoFromPackageJsonPath,
} = require("./githubReleaseRepo");

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
        if (n && typeof n === "object" && "note" in n) return String(/** @type {{ note?: string }} */ (n).note);
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

/**
 * @param {object} opts
 * @param {import("electron").App} opts.app
 * @param {() => import("electron").BrowserWindow | null | undefined} opts.getMainWindow
 */
function wireAutoUpdater(opts) {
  const { app, getMainWindow } = opts;

  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (token && !process.env.GH_TOKEN) {
    process.env.GH_TOKEN = token;
  }

  const fromEnv = parseGithubReleaseRepoInput(process.env.GITHUB_RELEASE_REPO?.trim());
  const pkgPath = path.join(app.getAppPath(), "package.json");
  const fromPkg = parseGithubReleaseRepoFromPackageJsonPath(pkgPath);
  /** Installed app: prefer committed `repository` so updates match the real release repo. Dev: `.env` overrides. */
  const gh = app.isPackaged ? fromPkg || fromEnv : fromEnv || fromPkg;
  if (gh) {
    autoUpdater.setFeedURL({
      provider: "github",
      owner: gh.owner,
      repo: gh.repo,
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
    broadcast(getMainWindow, {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
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
 * @param {{ getMainWindow: () => import("electron").BrowserWindow | null | undefined, getIsAdmin: () => boolean }} auth
 */
function registerUpdaterIpc(ipcMain, app, auth) {
  const { getMainWindow, getIsAdmin } = auth;

  ipcMain.handle("app:updaterInfo", async () => {
    if (!getIsAdmin()) return { ok: false, error: "Forbidden." };
    return {
      ok: true,
      isPackaged: app.isPackaged,
      currentVersion: app.getVersion(),
    };
  });

  ipcMain.handle("app:updaterCheck", async () => {
    if (!getIsAdmin()) return { ok: false, error: "Forbidden." };
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
        updateInfo: result?.updateInfo ? serializeUpdateInfo(result.updateInfo) : null,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        currentVersion: app.getVersion(),
      };
    }
  });

  ipcMain.handle("app:updaterQuitAndInstall", async () => {
    if (!getIsAdmin()) return { ok: false, error: "Forbidden." };
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
 * @param {() => boolean} opts.getIsAdmin
 */
function registerAppUpdater(opts) {
  wireAutoUpdater({ app: opts.app, getMainWindow: opts.getMainWindow });
  registerUpdaterIpc(opts.ipcMain, opts.app, {
    getMainWindow: opts.getMainWindow,
    getIsAdmin: opts.getIsAdmin,
  });
}

module.exports = { registerAppUpdater };
