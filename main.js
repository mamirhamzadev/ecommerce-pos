const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { app, BrowserWindow, ipcMain } = require("electron");
const crypto = require("crypto");
const {
  initDatabase,
  userQueries,
  productQueries,
  orderQueries,
  resetQueries,
  dashboardQueries,
} = require("./src/database");
const { hashPassword, verifyPassword } = require("./src/auth");
const { sendEmail } = require("./src/helpers");

let mainWindow;
let db;
/** @type {{ id: number, username: string, name: string, email: string, role: 'admin' | 'user' } | null} */
let currentSession = null;

/** Pending email code for creating a new admin (key = logged-in admin user id). */
const pendingAdminInviteByAdminId = new Map();

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

const PERMISSION_API_KEYS = [
  "canCreateProduct",
  "canEditProduct",
  "canRemoveProduct",
  "canCreateOrder",
  "canDeleteOrder",
  "canEditOrder",
  "canChangeOrderStatus",
  "canCreateUser",
  "canEditUser",
  "canDeleteUser",
];

function buildClientUserPayload(sessionLike) {
  const permissions = userQueries.getUserPermissionsForApi(db, sessionLike.id);
  return {
    id: sessionLike.id,
    username: sessionLike.username,
    name: sessionLike.name ?? "",
    email: sessionLike.email ?? "",
    role: sessionLike.role,
    permissions,
  };
}

function sessionHasPermission(key) {
  if (!currentSession) return false;
  const p = userQueries.getUserPermissionsForApi(db, currentSession.id);
  return Boolean(p[key]);
}

function mergePermissionPayloadFromClient(previous, raw) {
  const out = { ...previous };
  if (!raw || typeof raw !== "object") return out;
  for (const k of PERMISSION_API_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, k)) {
      out[k] = raw[k] === true;
    }
  }
  return out;
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
    mainWindow.loadFile(path.join(__dirname, "dist", "renderer", "index.html"));
  }
}

function getSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generatePasswordResetCode() {
  return crypto.randomBytes(4).toString("hex");
}

app.whenReady().then(() => {
  db = initDatabase(app);
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
        "This account has no valid email on file. Contact an administrator to add one.",
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

ipcMain.handle("users:list", async () => {
  if (!currentSession || currentSession.role !== "admin") {
    return { ok: false, error: "Forbidden." };
  }
  const users = userQueries.listUsers(db, currentSession.id);
  return { ok: true, users };
});

ipcMain.handle("users:listPaged", async (_event, payload) => {
  if (!currentSession || currentSession.role !== "admin") {
    return { ok: false, error: "Forbidden." };
  }
  const p = Math.max(1, Math.floor(Number(payload?.page)) || 1);
  const ps = Math.min(100, Math.max(5, Math.floor(Number(payload?.pageSize)) || 10));
  const roleRaw = typeof payload?.role === "string" ? payload.role.trim().toLowerCase() : "";
  const role =
    roleRaw === "admin" || roleRaw === "user" ? roleRaw : "all";
  const q = typeof payload?.q === "string" ? payload.q.trim() : "";
  const { rows, total, page: safePage, pageSize: psOut } =
    userQueries.listUsersPaged(db, p, ps, {
      role,
      q,
      excludeUserId: currentSession.id,
    });
  return {
    ok: true,
    users: rows,
    total,
    page: safePage,
    pageSize: psOut,
  };
});

ipcMain.handle("dashboard:snapshot", async () => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const data = dashboardQueries.getSnapshot(db, {
    recentOrders: 3,
    recentLogins: 3,
    recentSignups: 3,
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
    if (!sessionHasPermission("canCreateProduct")) {
      return { ok: false, error: "You do not have permission to create products." };
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
    if (!sessionHasPermission("canEditProduct")) {
      return { ok: false, error: "You do not have permission to edit products." };
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
  if (!sessionHasPermission("canRemoveProduct")) {
    return { ok: false, error: "You do not have permission to remove products." };
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

ipcMain.handle("orders:create", async (_event, payload) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  if (!sessionHasPermission("canCreateOrder")) {
    return { ok: false, error: "You do not have permission to create orders." };
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
  let status = normalizeOrderStatus(payload.status);
  if (!sessionHasPermission("canChangeOrderStatus")) {
    status = "pending";
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
  });
  const adminEmails = userQueries.listAdminEmails(db);
  let emailWarning = null;
  if (adminEmails.length === 0) {
    emailWarning = "No admin email on file; order was saved but not emailed.";
  } else {
    const appName = process.env.APP_NAME?.trim() || "App";
    const mailRes = await sendEmail(
      adminEmails.join(", "),
      `${appName} — New order ${row.order_number}`,
      "new-order",
      {
        appName,
        order: row,
        placedByUsername: currentSession.username,
        placedByName: currentSession.name || currentSession.username,
      },
    );
    if (!mailRes.success) {
      emailWarning = mailRes.message || "Email could not be sent.";
    }
  }
  return { ok: true, order: row, emailWarning };
});

ipcMain.handle("orders:update", async (_event, payload) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  if (!sessionHasPermission("canEditOrder")) {
    return { ok: false, error: "You do not have permission to edit orders." };
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
  let status = normalizeOrderStatus(payload.status);
  if (!sessionHasPermission("canChangeOrderStatus")) {
    status = normalizeOrderStatus(existing.status);
  }
  const row = orderQueries.updateOrderWithLines(db, id, {
    lines: normalized.lines,
    customerName: customerName.slice(0, 120),
    customerContact: customerContact.slice(0, 120),
    customerCity: customerCity.slice(0, 120),
    customerAddress: customerAddress.slice(0, 500),
    note: note.slice(0, 2000),
    status,
  });
  return { ok: true, order: row };
});

ipcMain.handle("orders:patchStatus", async (_event, { id, status }) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  if (!sessionHasPermission("canChangeOrderStatus")) {
    return {
      ok: false,
      error: "You do not have permission to change order status.",
    };
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
  if (!sessionHasPermission("canDeleteOrder")) {
    return { ok: false, error: "You do not have permission to delete orders." };
  }
  const oid = Number(id);
  if (!oid || !orderQueries.findById(db, oid)) {
    return { ok: false, error: "Order not found." };
  }
  orderQueries.deleteOrder(db, oid);
  return { ok: true };
});

ipcMain.handle("users:sendAdminInviteCode", async () => {
  if (!currentSession || currentSession.role !== "admin") {
    return { ok: false, error: "Forbidden." };
  }
  if (!sessionHasPermission("canCreateUser")) {
    return { ok: false, error: "You do not have permission to create users." };
  }
  const mail = normalizeEmail(currentSession.email);
  if (!isValidEmail(mail)) {
    return {
      ok: false,
      error:
        "Your profile must have a valid email address to receive the verification code. Update your profile first.",
    };
  }
  const code = generatePasswordResetCode();
  const codeHash = hashPassword(code);
  const expiresAt = Date.now() + 15 * 60 * 1000;
  pendingAdminInviteByAdminId.set(currentSession.id, { codeHash, expiresAt });
  const appName = process.env.APP_NAME?.trim() || "App";
  const response = await sendEmail(
    mail,
    `${appName} — New admin verification`,
    "admin-invite-code",
    {
      username: currentSession.username,
      name:
        (currentSession.name && String(currentSession.name).trim()) ||
        currentSession.username,
      code,
      appName,
    },
  );
  if (!response.success) {
    pendingAdminInviteByAdminId.delete(currentSession.id);
    return { ok: false, error: response.message };
  }
  return { ok: true };
});

ipcMain.handle(
  "users:create",
  async (_event, payload) => {
    if (!currentSession || currentSession.role !== "admin") {
      return { ok: false, error: "Forbidden." };
    }
    if (!sessionHasPermission("canCreateUser")) {
      return { ok: false, error: "You do not have permission to create users." };
    }
    const username = payload?.username;
    const password = payload?.password;
    const role = payload?.role;
    const name = payload?.name;
    const email = payload?.email;
    const u = String(username || "").trim();
    if (!u || !password) {
      return { ok: false, error: "Username and password are required." };
    }
    const displayName = normalizePersonName(name);
    const mail = normalizeEmail(email);
    if (!isValidEmail(mail)) {
      return { ok: false, error: "A valid email address is required." };
    }
    if (role !== "admin" && role !== "user") {
      return { ok: false, error: "Role must be admin or user." };
    }
    if (userQueries.findByUsername(db, u)) {
      return { ok: false, error: "Username already exists." };
    }
    if (role === "admin") {
      const rawCode = String(payload?.adminInviteCode || "").trim();
      const pending = pendingAdminInviteByAdminId.get(currentSession.id);
      if (!pending || Date.now() > pending.expiresAt) {
        return {
          ok: false,
          error:
            "Creating an admin requires a verification code. Tap “Send code to my email”, then enter the code from your inbox.",
          needsAdminCode: true,
        };
      }
      if (!rawCode || !verifyPassword(rawCode, pending.codeHash)) {
        return {
          ok: false,
          error: "Invalid verification code. Check the email sent to your account and try again.",
          needsAdminCode: true,
        };
      }
      pendingAdminInviteByAdminId.delete(currentSession.id);
    }
    const passwordHash = hashPassword(password);
    const newId = userQueries.createUser(
      db,
      u,
      passwordHash,
      role,
      displayName,
      mail,
    );
    userQueries.seedPermissionsForNewUser(db, newId, role);
    pendingAdminInviteByAdminId.delete(currentSession.id);
    return { ok: true };
  },
);

ipcMain.handle("users:getPermissions", async (_event, { id }) => {
  if (!currentSession || currentSession.role !== "admin") {
    return { ok: false, error: "Forbidden." };
  }
  if (!sessionHasPermission("canEditUser")) {
    return {
      ok: false,
      error: "You do not have permission to view or edit user settings.",
    };
  }
  const targetId = Number(id);
  if (!targetId) {
    return { ok: false, error: "Invalid user." };
  }
  const row = userQueries.findById(db, targetId);
  if (!row) {
    return { ok: false, error: "User not found." };
  }
  const permissions = userQueries.getUserPermissionsForApi(db, targetId);
  return {
    ok: true,
    username: row.username,
    role: row.role,
    permissions,
  };
});

ipcMain.handle("users:updatePermissions", async (_event, payload) => {
  if (!currentSession || currentSession.role !== "admin") {
    return { ok: false, error: "Forbidden." };
  }
  if (!sessionHasPermission("canEditUser")) {
    return {
      ok: false,
      error: "You do not have permission to update user settings.",
    };
  }
  const targetId = Number(payload?.id);
  if (!targetId) {
    return { ok: false, error: "Invalid user." };
  }
  if (!userQueries.findById(db, targetId)) {
    return { ok: false, error: "User not found." };
  }
  const previous = userQueries.getUserPermissionsForApi(db, targetId);
  const merged = mergePermissionPayloadFromClient(previous, payload?.permissions);
  userQueries.upsertUserPermissionsFromApi(db, targetId, merged);
  return { ok: true };
});

ipcMain.handle("users:update", async (_event, { id, name, email }) => {
  if (!currentSession) {
    return { ok: false, error: "Forbidden." };
  }
  const targetId = Number(id);
  if (!targetId) {
    return { ok: false, error: "Invalid user." };
  }
  const isAdmin = currentSession.role === "admin";
  const isSelf = targetId === currentSession.id;
  if (!isAdmin && !isSelf) {
    return { ok: false, error: "Forbidden." };
  }
  if (!isSelf && isAdmin && !sessionHasPermission("canEditUser")) {
    return {
      ok: false,
      error: "You do not have permission to edit other users.",
    };
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
  userQueries.updateUserContact(db, targetId, displayName, mail);
  if (currentSession.id === targetId) {
    currentSession = {
      ...currentSession,
      name: displayName,
      email: mail,
    };
  }
  return { ok: true };
});

ipcMain.handle("users:delete", async (_event, { id }) => {
  if (!currentSession || currentSession.role !== "admin") {
    return { ok: false, error: "Forbidden." };
  }
  if (!sessionHasPermission("canDeleteUser")) {
    return { ok: false, error: "You do not have permission to delete users." };
  }
  const targetId = Number(id);
  if (!targetId || targetId === currentSession.id) {
    return { ok: false, error: "Cannot remove yourself or invalid user." };
  }
  userQueries.deleteUser(db, targetId);
  return { ok: true };
});
