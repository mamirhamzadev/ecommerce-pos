const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { app, BrowserWindow, ipcMain, protocol, dialog } = require("electron");

/** Prevent a second process from opening the same SQLite DB (would hang IPC / session restore). */
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

/** Lets the renderer use BrowserRouter in production (history API) instead of file:// path quirks. */
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
const crypto = require("crypto");
const {
  initDatabase,
  userQueries,
  productQueries,
  orderQueries,
  invoiceQueries,
  resetQueries,
  dashboardQueries,
} = require("./src/database");
const { hashPassword, verifyPassword } = require("./src/auth");
const { sendEmail } = require("./src/helpers");
const { registerAppUpdater } = require("./src/electronUpdater");
const {
  buildBackupFileName,
  normalizeSelection,
  validateBackupFile,
  exportBackup,
  importBackup,
  deleteBackedUpTransactionalData,
} = require("./src/backup");

let mainWindow;
let db;
/** @type {{ id: number, username: string, name: string, email: string, role: 'admin' | 'user' } | null} */
let currentSession = null;

function normalizePersonName(value) {
  return String(value || "")
    .trim()
    .slice(0, 120);
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
}

function isValidEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function normalizeOrderStatus(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "pending" || s === "delivered" || s === "cancelled") return s;
  return "pending";
}

function buildClientUserPayload(sessionLike) {
  return {
    id: sessionLike.id,
    username: sessionLike.username,
    name: sessionLike.name ?? "",
    email: sessionLike.email ?? "",
    role: sessionLike.role,
  };
}

function requireAdminSession() {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  if (currentSession.role !== "admin") {
    return { ok: false, error: "Only administrators can manage backups." };
  }
  return null;
}

const SESSION_TTL_DAYS = (() => {
  const n = Number(process.env.SESSION_TTL_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 30;
})();

/** @param {{ session_created_at?: string } | null | undefined} row */
function isSessionExpired(row) {
  const raw = row?.session_created_at;
  if (!raw) return true;
  const created = new Date(String(raw).replace(" ", "T")).getTime();
  if (Number.isNaN(created)) return true;
  const maxMs = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - created > maxMs;
}

function registerRendererAppProtocol() {
  const distPath = path.resolve(__dirname, "dist", "renderer");
  protocol.registerFileProtocol("app", (request, callback) => {
    try {
      const parsed = new URL(request.url);
      let pathname = decodeURIComponent(parsed.pathname || "/");
      if (pathname === "/" || pathname === "") {
        callback({ path: path.join(distPath, "index.html") });
        return;
      }
      const relative = pathname.replace(/^\/+/, "");
      const candidate = path.resolve(distPath, relative);
      const distResolved = path.resolve(distPath);
      if (
        candidate !== distResolved &&
        !candidate.startsWith(distResolved + path.sep)
      ) {
        callback({ path: path.join(distPath, "index.html") });
        return;
      }
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        callback({ path: candidate });
        return;
      }
      callback({ path: path.join(distPath, "index.html") });
    } catch {
      callback({ path: path.join(distPath, "index.html") });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    webPreferences: {
      preload: path.resolve(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.maximize();
  mainWindow.removeMenu();
  mainWindow.setMenu(null);
  mainWindow.setTitle(process.env.APP_NAME?.trim() || "App");

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // Use app://./ so BrowserRouter pathname is "/" (not "/index.html", which matches no route).
    mainWindow.loadURL("app://./");
  }
}

function getSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generatePasswordResetCode() {
  return crypto.randomBytes(4).toString("hex");
}

if (gotSingleInstanceLock) {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;

  if (!process.env.VITE_DEV_SERVER_URL) {
    registerRendererAppProtocol();
  }
  db = initDatabase(app);
  registerAppUpdater({
    app,
    ipcMain,
    getMainWindow: () => mainWindow,
    getIsAdmin: () => currentSession?.role === "admin",
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("auth:login", async (_event, { username, password }) => {
  if (!username || !password) {
    return { ok: false, error: "Username and password are required." };
  }
  const row = userQueries.findByUsername(db, String(username).trim());
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, error: "Invalid username or password." };
  }
  const token = getSessionToken();
  userQueries.saveSession(db, row.id, token);
  dashboardQueries.recordLogin(db, row.id);
  const name = row.name ?? "";
  const email = row.email ?? "";
  currentSession = {
    id: row.id,
    username: row.username,
    name,
    email,
    role: row.role,
  };
  return {
    ok: true,
    token,
    user: buildClientUserPayload(currentSession),
  };
});

ipcMain.handle("auth:logout", async (_event, token) => {
  const row = token ? userQueries.findBySessionToken(db, token) : null;
  if (row) {
    userQueries.deleteSession(db, row.id);
  }
  currentSession = null;
  return { ok: true };
});

ipcMain.handle("auth:forgotRequest", async (_event, { username }) => {
  const u = String(username || "").trim();
  if (!u) {
    return { ok: false, error: "Username is required." };
  }
  const row = userQueries.findByUsername(db, u);
  if (!row) {
    return { ok: true, issued: false };
  }
  const toEmail = normalizeEmail(row.email);
  if (!isValidEmail(toEmail)) {
    return {
      ok: false,
      error:
        "This account has no valid email on file. Add an email in your profile to use password reset.",
    };
  }
  const code = generatePasswordResetCode();
  const codeHash = hashPassword(code);
  const appName = process.env.APP_NAME?.trim() || "App";
  const response = await sendEmail(
    toEmail,
    `${appName} — Password reset`,
    "forgot-password",
    {
      username: row.username,
      name: (row.name && String(row.name).trim()) || row.username,
      code,
      appName,
    },
  );
  if (!response.success) {
    return { ok: false, error: response.message };
  }
  resetQueries.upsertReset(db, row.id, codeHash);
  return { ok: true, issued: true };
});

ipcMain.handle(
  "auth:forgotComplete",
  async (_event, { username, code, newPassword }) => {
    const u = String(username || "").trim();
    const rawCode = String(code || "").trim();
    const pwd = String(newPassword || "");
    if (!u || !rawCode || !pwd) {
      return {
        ok: false,
        error: "Username, verification code, and new password are required.",
      };
    }
    if (pwd.length < 6) {
      return {
        ok: false,
        error: "New password must be at least 6 characters.",
      };
    }
    const row = userQueries.findByUsername(db, u);
    if (!row) {
      return { ok: false, error: "Invalid or expired verification code." };
    }
    const pending = resetQueries.getValidReset(db, row.id);
    if (!pending || !verifyPassword(rawCode, pending.code_hash)) {
      return { ok: false, error: "Invalid or expired verification code." };
    }
    userQueries.updatePassword(db, row.id, hashPassword(pwd));
    resetQueries.deleteReset(db, row.id);
    userQueries.deleteSession(db, row.id);
    return { ok: true };
  },
);

ipcMain.handle("auth:session", async (_event, token) => {
  if (!token || typeof token !== "string") {
    return { ok: false };
  }
  const row = userQueries.findBySessionToken(db, token);
  if (!row) {
    return { ok: false };
  }
  if (isSessionExpired(row)) {
    userQueries.deleteSession(db, row.id);
    if (currentSession?.id === row.id) {
      currentSession = null;
    }
    return { ok: false };
  }
  currentSession = {
    id: row.id,
    username: row.username,
    name: row.name ?? "",
    email: row.email ?? "",
    role: row.role,
  };
  return { ok: true, user: buildClientUserPayload(currentSession) };
});

ipcMain.handle(
  "auth:changePassword",
  async (_event, { token, currentPassword, newPassword }) => {
    if (!token || typeof token !== "string") {
      return { ok: false, error: "Not signed in." };
    }
    const row = userQueries.findCredentialsBySessionToken(db, token);
    if (!row) {
      return { ok: false, error: "Session expired. Sign in again." };
    }
    if (isSessionExpired(row)) {
      userQueries.deleteSession(db, row.id);
      if (currentSession?.id === row.id) {
        currentSession = null;
      }
      return { ok: false, error: "Session expired. Sign in again." };
    }
    const cur = String(currentPassword || "");
    const pwd = String(newPassword || "");
    if (!cur || !pwd) {
      return {
        ok: false,
        error: "Current password and new password are required.",
      };
    }
    if (pwd.length < 6) {
      return { ok: false, error: "New password must be at least 6 characters." };
    }
    if (!verifyPassword(cur, row.password_hash)) {
      return { ok: false, error: "Current password is incorrect." };
    }
    userQueries.updatePassword(db, row.id, hashPassword(pwd));
    currentSession = {
      id: row.id,
      username: row.username,
      name: row.name ?? "",
      email: row.email ?? "",
      role: row.role,
    };
    return { ok: true };
  },
);

ipcMain.handle("dashboard:snapshot", async () => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const data = dashboardQueries.getSnapshot(db, {
    recentOrders: 3,
    recentProducts: 3,
  });
  return { ok: true, ...data };
});

ipcMain.handle("products:listPaged", async (_event, payload) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const p = Math.max(1, Math.floor(Number(payload?.page)) || 1);
  const ps = Math.min(100, Math.max(5, Math.floor(Number(payload?.pageSize)) || 10));
  const q = typeof payload?.q === "string" ? payload.q.trim() : "";
  const { rows, total, page: safePage, pageSize: psOut } =
    productQueries.listProductsPaged(db, p, ps, { q });
  return {
    ok: true,
    products: rows,
    total,
    page: safePage,
    pageSize: psOut,
  };
});

ipcMain.handle("products:listPicker", async (_event, payload) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const search = String(payload?.search ?? "");
  const products = productQueries.listProductsForPicker(db, search);
  return { ok: true, products };
});

ipcMain.handle(
  "products:create",
  async (_event, { name, weightG, unitPricePkr }) => {
    if (!currentSession) {
      return { ok: false, error: "Forbidden." };
    }
    const n = String(name || "").trim();
    if (!n) {
      return { ok: false, error: "Product name is required." };
    }
    const wg = Number(weightG);
    const price = Number(unitPricePkr);
    if (!Number.isFinite(wg) || wg < 0) {
      return { ok: false, error: "Weight (g) must be zero or a positive number." };
    }
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: "Unit price must be zero or a positive number." };
    }
    productQueries.createProduct(db, n.slice(0, 200), wg, price);
    return { ok: true };
  },
);

ipcMain.handle(
  "products:update",
  async (_event, { id, name, weightG, unitPricePkr }) => {
    if (!currentSession) {
      return { ok: false, error: "Forbidden." };
    }
    const pid = Number(id);
    if (!pid || !productQueries.findById(db, pid)) {
      return { ok: false, error: "Product not found." };
    }
    const n = String(name || "").trim();
    if (!n) {
      return { ok: false, error: "Product name is required." };
    }
    const wg = Number(weightG);
    const price = Number(unitPricePkr);
    if (!Number.isFinite(wg) || wg < 0) {
      return { ok: false, error: "Weight (g) must be zero or a positive number." };
    }
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: "Unit price must be zero or a positive number." };
    }
    productQueries.updateProduct(db, pid, n.slice(0, 200), wg, price);
    return { ok: true };
  },
);

ipcMain.handle("products:delete", async (_event, { id }) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const pid = Number(id);
  if (!pid || !productQueries.findById(db, pid)) {
    return { ok: false, error: "Product not found." };
  }
  productQueries.deleteProduct(db, pid);
  return { ok: true };
});

ipcMain.handle("orders:listPaged", async (_event, payload) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const p = Math.max(1, Math.floor(Number(payload?.page)) || 1);
  const ps = Math.min(100, Math.max(5, Math.floor(Number(payload?.pageSize)) || 10));
  const status =
    typeof payload?.status === "string" && payload.status.trim()
      ? payload.status.trim().toLowerCase()
      : "all";
  const q = typeof payload?.q === "string" ? payload.q.trim() : "";
  const { rows, total, page: safePage, pageSize: psOut } =
    orderQueries.listOrdersPaged(db, p, ps, { status, q });
  return {
    ok: true,
    orders: rows,
    total,
    page: safePage,
    pageSize: psOut,
  };
});

function normalizeOrderLines(payloadLines) {
  const raw = Array.isArray(payloadLines) ? payloadLines : [];
  if (raw.length === 0) {
    return { ok: false, error: "Add at least one line item." };
  }
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const ln = raw[i] || {};
    const productName = String(ln.productName || "").trim();
    const pid = ln.productId != null ? Number(ln.productId) : null;
    if (!productName || !Number.isFinite(pid) || pid <= 0) {
      return {
        ok: false,
        error: `Line ${i + 1}: search the catalog and select a product.`,
      };
    }
    const qty = Number(ln.qty);
    const weightG = Number(ln.weightG);
    const unitPrice = Number(ln.unitPricePkr);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: `Line ${i + 1}: quantity must be a positive number.` };
    }
    if (!Number.isFinite(weightG) || weightG < 0) {
      return { ok: false, error: `Line ${i + 1}: weight (g) must be zero or positive.` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { ok: false, error: `Line ${i + 1}: unit price must be zero or positive.` };
    }
    lines.push({
      productId: pid,
      productName: productName.slice(0, 200),
      qty,
      weightG,
      unitPrice,
    });
  }
  return { ok: true, lines };
}

function normalizeDeliveryCharges(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: "Delivery charges must be zero or a positive number." };
  }
  return { ok: true, value: n };
}

ipcMain.handle("invoices:listPaged", async (_event, payload) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const p = Math.max(1, Math.floor(Number(payload?.page)) || 1);
  const ps = Math.min(100, Math.max(5, Math.floor(Number(payload?.pageSize)) || 10));
  const { rows, total, page: safePage, pageSize: psOut } =
    invoiceQueries.listInvoicesPaged(db, p, ps);
  return {
    ok: true,
    invoices: rows,
    total,
    page: safePage,
    pageSize: psOut,
  };
});

ipcMain.handle("invoices:getForPrint", async (_event, { id, orderId }) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const oid = Number(orderId);
  if (oid) {
    const row = invoiceQueries.getForPrintByOrderId(db, oid);
    if (!row) {
      return { ok: false, error: "Order not found." };
    }
    return { ok: true, invoice: row };
  }
  const iid = Number(id);
  if (!iid) {
    return { ok: false, error: "Invalid invoice." };
  }
  const row = invoiceQueries.getForPrint(db, iid);
  if (!row) {
    return { ok: false, error: "Invoice not found." };
  }
  return { ok: true, invoice: row };
});

ipcMain.handle("invoices:deleteAll", async () => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  invoiceQueries.deleteAll(db);
  return { ok: true };
});

ipcMain.handle("orders:create", async (_event, payload) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const normalized = normalizeOrderLines(payload.lines);
  if (normalized.ok !== true) {
    return { ok: false, error: normalized.error };
  }
  const customerName = String(payload.customerName || "").trim();
  if (!customerName) {
    return { ok: false, error: "Customer name is required." };
  }
  const customerContact = String(payload.customerContact || "").trim();
  const customerCity = String(payload.customerCity || "").trim();
  const customerAddress = String(payload.customerAddress || "").trim();
  const note = String(payload.note || "").trim();
  const trackingId = String(payload.trackingId || "").trim();
  const status = normalizeOrderStatus(payload.status);
  const del = normalizeDeliveryCharges(payload.deliveryCharges);
  if (del.ok !== true) {
    return { ok: false, error: del.error };
  }
  const orderNumber = orderQueries.generateOrderNumber(db);
  const row = orderQueries.createOrderWithLines(db, {
    orderNumber,
    lines: normalized.lines,
    customerName: customerName.slice(0, 120),
    customerContact: customerContact.slice(0, 120),
    customerCity: customerCity.slice(0, 120),
    customerAddress: customerAddress.slice(0, 500),
    note: note.slice(0, 2000),
    status,
    placedByUserId: currentSession.id,
    deliveryCharges: del.value,
    trackingId: trackingId.slice(0, 120),
  });
  return { ok: true, order: row };
});

ipcMain.handle("orders:update", async (_event, payload) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const id = Number(payload.id);
  const existing = orderQueries.findById(db, id);
  if (!id || !existing) {
    return { ok: false, error: "Order not found." };
  }
  const normalized = normalizeOrderLines(payload.lines);
  if (normalized.ok !== true) {
    return { ok: false, error: normalized.error };
  }
  const customerName = String(payload.customerName || "").trim();
  if (!customerName) {
    return { ok: false, error: "Customer name is required." };
  }
  const customerContact = String(payload.customerContact || "").trim();
  const customerCity = String(payload.customerCity || "").trim();
  const customerAddress = String(payload.customerAddress || "").trim();
  const note = String(payload.note || "").trim();
  const trackingId = String(payload.trackingId || "").trim();
  const status = normalizeOrderStatus(payload.status);
  const del = normalizeDeliveryCharges(payload.deliveryCharges);
  if (del.ok !== true) {
    return { ok: false, error: del.error };
  }
  const row = orderQueries.updateOrderWithLines(db, id, {
    lines: normalized.lines,
    customerName: customerName.slice(0, 120),
    customerContact: customerContact.slice(0, 120),
    customerCity: customerCity.slice(0, 120),
    customerAddress: customerAddress.slice(0, 500),
    note: note.slice(0, 2000),
    status,
    deliveryCharges: del.value,
    trackingId: trackingId.slice(0, 120),
    placedByUserId: existing.placed_by_user_id ?? currentSession.id,
  });
  return { ok: true, order: row };
});

ipcMain.handle("orders:patchStatus", async (_event, { id, status }) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const oid = Number(id);
  if (!oid || !orderQueries.findById(db, oid)) {
    return { ok: false, error: "Order not found." };
  }
  orderQueries.updateOrderStatus(db, oid, normalizeOrderStatus(status));
  return { ok: true };
});

ipcMain.handle("orders:delete", async (_event, { id }) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const oid = Number(id);
  if (!oid || !orderQueries.findById(db, oid)) {
    return { ok: false, error: "Order not found." };
  }
  orderQueries.deleteOrder(db, oid);
  return { ok: true };
});

ipcMain.handle("backup:create", async (_event, payload) => {
  const denied = requireAdminSession();
  if (denied) return denied;

  const selection = normalizeSelection(payload?.selection);
  const deleteAfterBackup = Boolean(payload?.deleteAfterBackup);
  if (!selection.logins && !selection.products && !selection.orders && !selection.invoices) {
    return { ok: false, error: "Select at least one category to back up." };
  }

  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  const defaultName = buildBackupFileName(app.getName());
  const dialogResult = await dialog.showSaveDialog(win, {
    title: "Save backup",
    defaultPath: defaultName,
    filters: [{ name: "Database backup", extensions: ["db"] }],
  });
  if (dialogResult.canceled || !dialogResult.filePath) {
    return { ok: false, cancelled: true };
  }

  let filePath = dialogResult.filePath;
  if (!filePath.toLowerCase().endsWith(".db")) {
    filePath = `${filePath}.db`;
  }

  const exportResult = exportBackup(db, filePath, selection, app.getName());
  if (exportResult.ok !== true) {
    return exportResult;
  }

  let deletedAfterBackup = false;
  let warning;
  if (deleteAfterBackup && (selection.orders || selection.invoices)) {
    try {
      deleteBackedUpTransactionalData(db, selection);
      deletedAfterBackup = true;
    } catch (e) {
      warning =
        e.message ||
        "Backup was saved, but orders/invoices could not be removed from this app.";
    }
  }

  return {
    ok: true,
    filePath,
    deletedAfterBackup,
    ...(warning ? { warning } : {}),
  };
});

ipcMain.handle("backup:validate", async () => {
  const denied = requireAdminSession();
  if (denied) return denied;

  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  const dialogResult = await dialog.showOpenDialog(win, {
    title: "Select backup file",
    filters: [{ name: "Database backup", extensions: ["db"] }],
    properties: ["openFile"],
  });
  if (dialogResult.canceled || !dialogResult.filePaths?.length) {
    return { ok: false, cancelled: true };
  }

  const filePath = dialogResult.filePaths[0];
  const validation = validateBackupFile(filePath);
  if (validation.ok !== true) {
    return validation;
  }
  return {
    ok: true,
    filePath,
    meta: validation.meta,
    counts: validation.counts,
  };
});

ipcMain.handle("backup:restore", async (_event, { filePath }) => {
  const denied = requireAdminSession();
  if (denied) return denied;

  const backupPath = String(filePath || "").trim();
  if (!backupPath) {
    return { ok: false, error: "No backup file selected." };
  }

  const validation = validateBackupFile(backupPath);
  if (validation.ok !== true) {
    return validation;
  }

  try {
    const result = importBackup(db, backupPath);
    return result;
  } catch (e) {
    return { ok: false, error: e.message || "Restore failed." };
  }
});

ipcMain.handle("users:update", async (_event, { id, name, email, username }) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const targetId = Number(id);
  if (!targetId || targetId !== currentSession.id) {
    return { ok: false, error: "Forbidden." };
  }
  const row = userQueries.findById(db, targetId);
  if (!row) {
    return { ok: false, error: "User not found." };
  }
  const displayName = normalizePersonName(name);
  const mail = normalizeEmail(email);
  if (!isValidEmail(mail)) {
    return { ok: false, error: "A valid email address is required." };
  }
  const u = String(username ?? row.username ?? "")
    .trim()
    .slice(0, 80);
  if (!u) {
    return { ok: false, error: "Username is required." };
  }
  const existing = userQueries.findByUsername(db, u);
  if (existing && existing.id !== targetId) {
    return { ok: false, error: "That username is already in use." };
  }
  userQueries.updateUserProfile(db, targetId, displayName, mail, u);
  currentSession = {
    ...currentSession,
    username: u,
    name: displayName,
    email: mail,
  };
  return { ok: true };
});

