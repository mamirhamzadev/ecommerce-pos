const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { hashPassword } = require('./auth');

/**
 * Persistent SQLite (never inside the packaged app):
 * - DATABASE_FILE: absolute path to the .db file
 * - DATABASE_DIR: absolute directory; uses app.db inside it
 * - Default: <user home>/<app folder>/database/app.db
 *   Example Windows: C:\Users\Hamza\POS-Mushtaq\database\app.db
 *   App folder = APP_DATA_FOLDER env, else Electron app name (sanitized).
 *
 * Migrates from older defaults under Electron userData if the new file does not exist yet.
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/** Safe single path segment for a folder under the user home directory. */
function sanitizeHomeFolderName(raw) {
  return (
    String(raw || '')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'pos-mushtaq-data'
  );
}

function homeAppDataFolderName(app) {
  const fromEnv = process.env.APP_DATA_FOLDER?.trim();
  if (fromEnv) return sanitizeHomeFolderName(fromEnv);
  return sanitizeHomeFolderName(app.getName() || 'pos-mushtaq');
}

function migrateDbWithSidecars(fromDbPath, toDbPath) {
  if (fs.existsSync(toDbPath) || !fs.existsSync(fromDbPath)) {
    return false;
  }
  ensureDir(path.dirname(toDbPath));
  const pairs = [
    [fromDbPath, toDbPath],
    [`${fromDbPath}-wal`, `${toDbPath}-wal`],
    [`${fromDbPath}-shm`, `${toDbPath}-shm`],
  ];
  for (const [from, to] of pairs) {
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      try {
        fs.renameSync(from, to);
      } catch (e) {
        try {
          fs.copyFileSync(from, to);
          fs.unlinkSync(from);
        } catch (e2) {
          console.error('[database] Could not migrate', from, '→', to, e2);
        }
      }
    }
  }
  return fs.existsSync(toDbPath);
}

function resolveDatabasePath(app) {
  const fileEnv = process.env.DATABASE_FILE?.trim();
  if (fileEnv) {
    if (!path.isAbsolute(fileEnv)) {
      console.warn(
        '[database] DATABASE_FILE must be an absolute path; falling back to default location.',
      );
    } else {
      ensureDir(path.dirname(fileEnv));
      return fileEnv;
    }
  }

  const dirEnv = process.env.DATABASE_DIR?.trim();
  if (dirEnv) {
    if (!path.isAbsolute(dirEnv)) {
      console.warn(
        '[database] DATABASE_DIR must be an absolute path; falling back to default location.',
      );
    } else {
      ensureDir(dirEnv);
      return path.join(dirEnv, 'app.db');
    }
  }

  const dbPath = path.join(os.homedir(), homeAppDataFolderName(app), 'database', 'app.db');
  ensureDir(path.dirname(dbPath));

  if (!fs.existsSync(dbPath)) {
    const userData = app.getPath('userData');
    const olderLocations = [
      path.join(userData, 'database', 'app.db'),
      path.join(userData, 'app.db'),
    ];
    for (const from of olderLocations) {
      if (migrateDbWithSidecars(from, dbPath)) {
        console.log('[database] Migrated database →', dbPath);
        break;
      }
    }
  }

  return dbPath;
}

function initDatabase(app) {
  const dbPath = resolveDatabasePath(app);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  if (process.env.DEBUG_DB_PATH === '1' || process.env.DEBUG_DB_PATH === 'true') {
    console.log('[database] Using', dbPath);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      user_id INTEGER NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      user_id INTEGER NOT NULL PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS installation_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      installation_id TEXT NOT NULL UNIQUE,
      registered_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS login_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      logged_in_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      weight_g REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      customer_label TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      qty REAL NOT NULL DEFAULT 1,
      weight_g REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      customer_name TEXT NOT NULL DEFAULT '',
      customer_contact TEXT NOT NULL DEFAULT '',
      customer_city TEXT NOT NULL DEFAULT '',
      customer_address TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      placed_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (placed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      order_id INTEGER,
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact TEXT NOT NULL UNIQUE,
      tag TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_customer_tags_contact ON customer_tags(contact);
  `);

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_login_events_time ON login_events(logged_in_at);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);`,
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      product_id INTEGER,
      product_name TEXT NOT NULL DEFAULT '',
      qty REAL NOT NULL DEFAULT 1,
      weight_g REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `);

  const itemColNames = new Set(
    db.prepare('PRAGMA table_info(order_items)').all().map((c) => c.name),
  );
  if (!itemColNames.has('base_unit_weight_g')) {
    db.exec(`ALTER TABLE order_items ADD COLUMN base_unit_weight_g REAL;`);
  }
  if (!itemColNames.has('base_unit_price')) {
    db.exec(`ALTER TABLE order_items ADD COLUMN base_unit_price REAL;`);
  }

  db.exec(`
    INSERT INTO order_items (order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total)
    SELECT o.id,
           0,
           NULL,
           CASE WHEN trim(COALESCE(o.product_name, '')) != '' THEN o.product_name ELSE 'Item' END,
           CASE WHEN o.qty > 0 THEN o.qty ELSE 1 END,
           CASE WHEN o.weight_g >= 0 THEN o.weight_g ELSE 0 END,
           CASE WHEN o.unit_price >= 0 THEN o.unit_price ELSE 0 END,
           CASE
             WHEN o.total > 0 THEN o.total
             ELSE (CASE WHEN o.qty > 0 THEN o.qty ELSE 1 END) * (CASE WHEN o.unit_price >= 0 THEN o.unit_price ELSE 0 END)
           END
    FROM orders o
    WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id);
  `);
  db.exec(`
    UPDATE orders SET total = (
      SELECT COALESCE(SUM(i.line_total), 0) FROM order_items i WHERE i.order_id = orders.id
    );
  `);

  const userCols = db.prepare('PRAGMA table_info(users)').all();
  const colNames = new Set(userCols.map((c) => c.name));
  if (!colNames.has('name')) {
    db.exec(`ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT '';`);
  }
  if (!colNames.has('email')) {
    db.exec(`ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT '';`);
  }

  const prodCols = db.prepare('PRAGMA table_info(products)').all();
  const prodColNames = new Set(prodCols.map((c) => c.name));
  if (!prodColNames.has('weight_g')) {
    db.exec(`ALTER TABLE products ADD COLUMN weight_g REAL NOT NULL DEFAULT 0;`);
  }

  const orderCols = db.prepare('PRAGMA table_info(orders)').all();
  const orderColNames = new Set(orderCols.map((c) => c.name));
  const orderMigrations = [
    ['product_name', `ALTER TABLE orders ADD COLUMN product_name TEXT NOT NULL DEFAULT '';`],
    ['qty', `ALTER TABLE orders ADD COLUMN qty REAL NOT NULL DEFAULT 1;`],
    ['weight_g', `ALTER TABLE orders ADD COLUMN weight_g REAL NOT NULL DEFAULT 0;`],
    ['unit_price', `ALTER TABLE orders ADD COLUMN unit_price REAL NOT NULL DEFAULT 0;`],
    ['customer_name', `ALTER TABLE orders ADD COLUMN customer_name TEXT NOT NULL DEFAULT '';`],
    ['customer_contact', `ALTER TABLE orders ADD COLUMN customer_contact TEXT NOT NULL DEFAULT '';`],
    ['customer_city', `ALTER TABLE orders ADD COLUMN customer_city TEXT NOT NULL DEFAULT '';`],
    ['customer_address', `ALTER TABLE orders ADD COLUMN customer_address TEXT NOT NULL DEFAULT '';`],
    ['note', `ALTER TABLE orders ADD COLUMN note TEXT NOT NULL DEFAULT '';`],
  ];
  for (const [col, sql] of orderMigrations) {
    if (!orderColNames.has(col)) {
      db.exec(sql);
    }
  }
  const orderColNamesAfter = new Set(
    db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name),
  );
  if (!orderColNamesAfter.has('delivery_charges')) {
    db.exec(`ALTER TABLE orders ADD COLUMN delivery_charges REAL NOT NULL DEFAULT 0;`);
  }
  const orderColNamesFinal = new Set(
    db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name),
  );
  if (!orderColNamesFinal.has('tracking_id')) {
    db.exec(`ALTER TABLE orders ADD COLUMN tracking_id TEXT NOT NULL DEFAULT '';`);
  }
  if (orderColNames.has('customer_label')) {
    db.exec(
      `UPDATE orders SET customer_name = customer_label WHERE trim(customer_name) = '' AND trim(customer_label) != ''`,
    );
  }
  db.exec(
    `UPDATE orders SET status = 'delivered' WHERE lower(status) = 'completed'`,
  );

  return db;
}

function needsSetup(db) {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0;
}

/**
 * Create the first administrator account. Only succeeds when no users exist yet.
 * @returns {{ ok: true, userId: number } | { ok: false, error: string }}
 */
function createFirstAdmin(db, { username, password, name, email }) {
  if (!needsSetup(db)) {
    return { ok: false, error: 'Setup has already been completed on this device.' };
  }
  const u = String(username || '').trim();
  if (!u) {
    return { ok: false, error: 'Username is required.' };
  }
  if (u.length > 64) {
    return { ok: false, error: 'Username is too long.' };
  }
  const pwd = String(password || '');
  if (pwd.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  const displayName = String(name || '').trim().slice(0, 120) || 'Administrator';
  const mail = String(email || '').trim().toLowerCase().slice(0, 254);
  const hash = hashPassword(pwd);
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, role, name, email) VALUES (?, ?, 'admin', ?, ?)`,
    )
    .run(u, hash, displayName, mail);
  return { ok: true, userId: Number(info.lastInsertRowid) };
}

const userQueries = {
  findByUsername(db, username) {
    return db
      .prepare(
        `SELECT id, username, name, email, password_hash, role FROM users WHERE username = ?`
      )
      .get(username);
  },

  findById(db, id) {
    return db
      .prepare(
        `SELECT id, username, name, email, role FROM users WHERE id = ?`
      )
      .get(id);
  },

  findBySessionToken(db, token) {
    return db
      .prepare(
        `SELECT u.id, u.username, u.name, u.email, u.role, s.created_at AS session_created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`
      )
      .get(token);
  },

  /** Session row including password hash (main-process auth only; never send to renderer). */
  findCredentialsBySessionToken(db, token) {
    return db
      .prepare(
        `SELECT u.id, u.username, u.name, u.email, u.role, u.password_hash, s.created_at AS session_created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`,
      )
      .get(token);
  },

  saveSession(db, userId, token) {
    db.prepare(
      `INSERT INTO sessions (user_id, token) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, created_at = datetime('now')`
    ).run(userId, token);
  },

  deleteSession(db, userId) {
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
  },

  updatePassword(db, userId, passwordHash) {
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
      passwordHash,
      userId
    );
  },

  updateUserProfile(db, userId, name, email, username) {
    db.prepare(`UPDATE users SET name = ?, email = ?, username = ? WHERE id = ?`).run(
      name,
      email,
      username,
      userId,
    );
  },

};

/** WHERE for `products p` — search name, weight (g), or unit price (text match) */
function buildProductListWhere(filters) {
  const q = String(filters?.q ?? '').trim();
  if (!q) {
    return { whereSql: '', params: [] };
  }
  const ql = q.toLowerCase();
  const whereSql = `WHERE (
    instr(lower(COALESCE(p.name,'')), ?) > 0 OR
    instr(CAST(p.weight_g AS TEXT), ?) > 0 OR
    instr(CAST(p.price AS TEXT), ?) > 0
  )`;
  return { whereSql, params: [ql, q, q] };
}

const productQueries = {
  listProductsPaged(db, page, pageSize, filters = {}) {
    const { whereSql, params: whereParams } = buildProductListWhere(filters);
    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM products p ${whereSql}`)
      .get(...whereParams).c;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const offset = (safePage - 1) * pageSize;
    const rows = db
      .prepare(
        `SELECT p.id, p.name, p.sku, p.price, p.weight_g, p.created_at
         FROM products p
         ${whereSql}
         ORDER BY datetime(p.created_at) DESC, p.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...whereParams, pageSize, offset);
    return { rows, total, page: safePage, pageSize };
  },

  findById(db, id) {
    return db
      .prepare(
        `SELECT id, name, price, weight_g FROM products WHERE id = ?`
      )
      .get(id);
  },

  /** For order modal: optional substring search, cap for UI responsiveness */
  listProductsForPicker(db, search, limit = 120) {
    const lim = Math.min(200, Math.max(5, Math.floor(Number(limit)) || 120));
    const q = String(search || '').trim();
    if (!q) {
      return db
        .prepare(
          `SELECT id, name, price, weight_g FROM products
           ORDER BY name COLLATE NOCASE
           LIMIT ?`
        )
        .all(lim);
    }
    return db
      .prepare(
        `SELECT id, name, price, weight_g FROM products
         WHERE instr(lower(name), lower(?)) > 0
         ORDER BY name COLLATE NOCASE
         LIMIT ?`
      )
      .all(q, lim);
  },

  createProduct(db, name, weightG, unitPricePkr) {
    db.prepare(
      `INSERT INTO products (name, sku, price, weight_g) VALUES (?, '', ?, ?)`
    ).run(name, unitPricePkr, weightG);
  },

  updateProduct(db, id, name, weightG, unitPricePkr) {
    db.prepare(
      `UPDATE products SET name = ?, price = ?, weight_g = ? WHERE id = ?`
    ).run(name, unitPricePkr, weightG, id);
  },

  deleteProduct(db, id) {
    db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
  },
};

/** Effective line total: use the provided lineTotal, falling back to qty × unit price. */
function lineTotalFor(L) {
  const lt = Number(L.lineTotal);
  if (Number.isFinite(lt) && lt >= 0) return lt;
  return Number(L.qty) * Number(L.unitPrice);
}

function attachOrderItems(db, orderRow) {
  if (!orderRow) return undefined;
  const items = db
    .prepare(
      `SELECT id, order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total, base_unit_weight_g, base_unit_price
       FROM order_items WHERE order_id = ? ORDER BY sort_order ASC, id ASC`,
    )
    .all(orderRow.id);
  return { ...orderRow, items };
}

function listOrderItemsForOrders(db, orderIds) {
  if (!orderIds.length) return [];
  const ph = orderIds.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT id, order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total, base_unit_weight_g, base_unit_price
       FROM order_items WHERE order_id IN (${ph}) ORDER BY order_id, sort_order ASC, id ASC`,
    )
    .all(...orderIds);
}

/**
 * Push inclusive date-range fragments for a UTC `created_at` column.
 * created_at is stored as UTC; convert to localtime so it matches the local
 * calendar dates the user picks in the UI.
 */
function pushDateRange(fragments, params, col, dateFrom, dateTo) {
  const from = String(dateFrom ?? '').trim();
  const to = String(dateTo ?? '').trim();
  if (from) {
    fragments.push(`date(${col}, 'localtime') >= date(?)`);
    params.push(from);
  }
  if (to) {
    fragments.push(`date(${col}, 'localtime') <= date(?)`);
    params.push(to);
  }
}

/** WHERE for `orders o` — status + search on customer name, order #, or internal id */
function buildOrderListWhere(filters) {
  const fragments = [];
  const params = [];
  const status = String(filters?.status ?? 'all')
    .trim()
    .toLowerCase();
  const q = String(filters?.q ?? '').trim();

  if (status && status !== 'all') {
    if (status === 'delivered') {
      fragments.push(
        `(lower(trim(COALESCE(o.status,''))) IN ('delivered','completed'))`,
      );
    } else if (status === 'pending' || status === 'cancelled') {
      fragments.push(`(lower(trim(COALESCE(o.status,''))) = ?)`);
      params.push(status);
    }
  }

  if (q) {
    const ql = q.toLowerCase();
    fragments.push(
      `(
        instr(lower(COALESCE(o.customer_name,'')), ?) > 0 OR
        instr(lower(COALESCE(o.order_number,'')), ?) > 0 OR
        CAST(o.id AS TEXT) = ?
      )`,
    );
    params.push(ql, ql, q);
  }

  const tag = String(filters?.tag ?? 'all').trim().toLowerCase();
  if (tag && tag !== 'all') {
    const tagExpr = `(SELECT ct.tag FROM customer_tags ct
      WHERE ct.contact = lower(trim(o.customer_contact)) AND trim(o.customer_contact) != '')`;
    if (tag === 'none') {
      fragments.push(`(${tagExpr} IS NULL)`);
    } else if (tag === 'green' || tag === 'yellow' || tag === 'red') {
      fragments.push(`(${tagExpr} = ?)`);
      params.push(tag);
    }
  }

  pushDateRange(fragments, params, 'o.created_at', filters?.dateFrom, filters?.dateTo);

  const whereSql = fragments.length ? `WHERE ${fragments.join(' AND ')}` : '';
  return { whereSql, params };
}

/** WHERE for `invoices i` — created_at date range only. */
function buildInvoiceListWhere(filters) {
  const fragments = [];
  const params = [];
  pushDateRange(fragments, params, 'i.created_at', filters?.dateFrom, filters?.dateTo);
  const whereSql = fragments.length ? `WHERE ${fragments.join(' AND ')}` : '';
  return { whereSql, params };
}

/** ORDER BY for orders list — `none` keeps the default newest-first ordering. */
function buildOrderListOrderBy(filters) {
  const sortBy = String(filters?.sortBy ?? 'none').trim().toLowerCase();
  const sortDir =
    String(filters?.sortDir ?? 'desc').trim().toLowerCase() === 'asc'
      ? 'ASC'
      : 'DESC';
  const tie = sortDir === 'ASC' ? 'ASC' : 'DESC';

  if (sortBy === 'created_at') {
    return `ORDER BY datetime(o.created_at) ${sortDir}, o.id ${tie}`;
  }
  if (sortBy === 'weight') {
    return `ORDER BY (
      SELECT COALESCE(SUM(i.weight_g), 0) FROM order_items i WHERE i.order_id = o.id
    ) ${sortDir}, o.id ${tie}`;
  }
  return `ORDER BY datetime(o.created_at) DESC, o.id DESC`;
}

const invoiceQueries = {
  /** INV + DDMMYY + 4-digit daily serial (e.g. INV1105260001). */
  generateInvoiceNumber(db) {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    const prefix = `INV${dd}${mm}${yy}`;
    const row = db
      .prepare(
        `SELECT MAX(CAST(substr(invoice_number, 10, 4) AS INTEGER)) AS max_n
         FROM invoices
         WHERE length(invoice_number) = 13
           AND substr(invoice_number, 1, 9) = ?
           AND substr(invoice_number, 10, 4) GLOB '[0-9][0-9][0-9][0-9]'`,
      )
      .get(prefix);
    let next = 1;
    if (row && row.max_n != null && Number.isFinite(Number(row.max_n))) {
      next = Number(row.max_n) + 1;
    }
    if (next > 9999) {
      throw new Error('Daily invoice number limit (9999) reached for this date prefix.');
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
  },

  /** Create a draft invoice for a new order (call inside the same transaction). */
  insertForOrder(db, { invoiceNumber, amount, orderId, userId }) {
    db.prepare(
      `INSERT INTO invoices (invoice_number, amount, status, order_id, user_id)
       VALUES (?, ?, 'draft', ?, ?)`,
    ).run(invoiceNumber, amount, orderId, userId);
  },

  syncAmountForOrder(db, { orderId, amount, userId }) {
    const row = db
      .prepare(`SELECT id FROM invoices WHERE order_id = ? LIMIT 1`)
      .get(orderId);
    if (row) {
      db.prepare(`UPDATE invoices SET amount = ? WHERE order_id = ?`).run(amount, orderId);
    } else {
      const invoiceNumber = invoiceQueries.generateInvoiceNumber(db);
      invoiceQueries.insertForOrder(db, {
        invoiceNumber,
        amount,
        orderId,
        userId,
      });
    }
  },

  listInvoicesPaged(db, page, pageSize, filters = {}) {
    const { whereSql, params: whereParams } = buildInvoiceListWhere(filters);
    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM invoices i ${whereSql}`)
      .get(...whereParams).c;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const offset = (safePage - 1) * pageSize;
    const rows = db
      .prepare(
        `SELECT i.id, i.invoice_number, i.amount, i.status, i.order_id, i.user_id, i.created_at,
                o.order_number,
                u.username AS user_username
         FROM invoices i
         LEFT JOIN orders o ON o.id = i.order_id
         LEFT JOIN users u ON u.id = i.user_id
         ${whereSql}
         ORDER BY datetime(i.created_at) DESC, i.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...whereParams, pageSize, offset);
    return { rows, total, page: safePage, pageSize };
  },

  deleteByOrderId(db, orderId) {
    db.prepare(`DELETE FROM invoices WHERE order_id = ?`).run(orderId);
  },

  deleteAll(db) {
    db.prepare(`DELETE FROM invoices`).run();
  },

  getForPrint(db, id) {
    const row = db
      .prepare(
        `SELECT i.id, i.invoice_number, i.amount, i.status, i.order_id, i.user_id, i.created_at,
                o.order_number, o.customer_name, o.customer_contact, o.customer_city,
                o.customer_address, o.note, o.delivery_charges, o.tracking_id, o.status AS order_status,
                u.username AS issued_by_username, u.name AS issued_by_name
         FROM invoices i
         LEFT JOIN orders o ON o.id = i.order_id
         LEFT JOIN users u ON u.id = i.user_id
         WHERE i.id = ?`,
      )
      .get(id);
    if (!row) return undefined;
    const items =
      row.order_id != null
        ? db
            .prepare(
              `SELECT product_name, qty, weight_g, unit_price, line_total
               FROM order_items WHERE order_id = ? ORDER BY sort_order ASC, id ASC`,
            )
            .all(row.order_id)
        : [];
    return { ...row, items };
  },

  /** Print payload for an order; creates a draft invoice if one does not exist yet. */
  getForPrintByOrderId(db, orderId) {
    const order = orderQueries.findById(db, orderId);
    if (!order) return undefined;
    let inv = db
      .prepare(`SELECT id FROM invoices WHERE order_id = ? LIMIT 1`)
      .get(orderId);
    if (!inv) {
      const amount = Number(order.total) || 0;
      invoiceQueries.syncAmountForOrder(db, {
        orderId,
        amount,
        userId: order.placed_by_user_id,
      });
      inv = db
        .prepare(`SELECT id FROM invoices WHERE order_id = ? LIMIT 1`)
        .get(orderId);
    }
    if (!inv) return undefined;
    return invoiceQueries.getForPrint(db, inv.id);
  },
};

const orderQueries = {
  /** DDMMYY + 4-digit daily serial (e.g. 1105260001 for 11 May 2026, #1). */
  generateOrderNumber(db) {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    const prefix = `${dd}${mm}${yy}`;
    const row = db
      .prepare(
        `SELECT MAX(CAST(substr(order_number, 7, 4) AS INTEGER)) AS max_n
         FROM orders
         WHERE length(order_number) = 10
           AND substr(order_number, 1, 6) = ?
           AND substr(order_number, 7, 4) GLOB '[0-9][0-9][0-9][0-9]'`,
      )
      .get(prefix);
    let next = 1;
    if (row && row.max_n != null && Number.isFinite(Number(row.max_n))) {
      next = Number(row.max_n) + 1;
    }
    if (next > 9999) {
      throw new Error('Daily order number limit (9999) reached for this date prefix.');
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
  },

  listOrdersPaged(db, page, pageSize, filters = {}) {
    const { whereSql, params: whereParams } = buildOrderListWhere(filters);
    const orderBySql = buildOrderListOrderBy(filters);
    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM orders o ${whereSql}`)
      .get(...whereParams).c;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const offset = (safePage - 1) * pageSize;
    const rows = db
      .prepare(
        `SELECT o.id, o.order_number,
                o.customer_name, o.customer_contact, o.customer_city, o.customer_address,
                o.note, o.status, o.created_at, o.placed_by_user_id,
                o.delivery_charges, o.tracking_id,
                u.username AS placed_by_username,
                (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS line_count,
                (COALESCE(
                  (SELECT SUM(i.line_total) FROM order_items i WHERE i.order_id = o.id),
                  0
                ) + COALESCE(o.delivery_charges, 0)) AS total,
                (SELECT ct.tag FROM customer_tags ct
                  WHERE ct.contact = lower(trim(o.customer_contact))
                    AND trim(o.customer_contact) != '') AS tag
         FROM orders o
         LEFT JOIN users u ON u.id = o.placed_by_user_id
         ${whereSql}
         ${orderBySql}
         LIMIT ? OFFSET ?`,
      )
      .all(...whereParams, pageSize, offset);
    const ids = rows.map((r) => r.id);
    const allItems = listOrderItemsForOrders(db, ids);
    const byOrder = new Map();
    for (const it of allItems) {
      const list = byOrder.get(it.order_id);
      if (list) list.push(it);
      else byOrder.set(it.order_id, [it]);
    }
    const enriched = rows.map((r) => ({
      ...r,
      items: byOrder.get(r.id) || [],
    }));
    return { rows: enriched, total, page: safePage, pageSize };
  },

  findById(db, id) {
    const orderRow = db
      .prepare(
        `SELECT o.id, o.order_number, o.product_name, o.qty, o.weight_g, o.unit_price, o.total,
                o.delivery_charges, o.tracking_id,
                o.customer_name, o.customer_contact, o.customer_city, o.customer_address,
                o.note, o.status, o.created_at, o.placed_by_user_id,
                u.username AS placed_by_username
         FROM orders o
         LEFT JOIN users u ON u.id = o.placed_by_user_id
         WHERE o.id = ?`,
      )
      .get(id);
    return attachOrderItems(db, orderRow);
  },

  createOrderWithLines(
    db,
    {
      orderNumber,
      lines,
      customerName,
      customerContact,
      customerCity,
      customerAddress,
      note,
      status,
      placedByUserId,
      deliveryCharges,
      trackingId,
    },
  ) {
    const rawDel = Number(deliveryCharges);
    const safeDelivery =
      Number.isFinite(rawDel) && rawDel >= 0 ? rawDel : 0;
    const safeTrackingId = String(trackingId || '').trim().slice(0, 120);
    let newId = null;
    const tx = db.transaction(() => {
      let sumLines = 0;
      for (const L of lines) {
        sumLines += lineTotalFor(L);
      }
      const grandTotal = sumLines + safeDelivery;
      const first = lines[0] || {};
      const info = db
        .prepare(
          `INSERT INTO orders (
            order_number, product_name, qty, weight_g, unit_price, total,
            customer_name, customer_contact, customer_city, customer_address, note,
            delivery_charges, tracking_id, status, placed_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          orderNumber,
          String(first.productName || '').slice(0, 200),
          first.qty ?? 1,
          first.weightG ?? 0,
          first.unitPrice ?? 0,
          grandTotal,
          customerName,
          customerContact,
          customerCity,
          customerAddress,
          note,
          safeDelivery,
          safeTrackingId,
          status,
          placedByUserId,
        );
      newId = Number(info.lastInsertRowid);
      const insItem = db.prepare(
        `INSERT INTO order_items (order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total, base_unit_weight_g, base_unit_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      lines.forEach((L, idx) => {
        insItem.run(
          newId,
          idx,
          L.productId != null ? Number(L.productId) : null,
          String(L.productName || '').slice(0, 200),
          L.qty,
          L.weightG,
          L.unitPrice,
          lineTotalFor(L),
          L.baseUnitWeightG != null ? Number(L.baseUnitWeightG) : null,
          L.baseUnitPrice != null ? Number(L.baseUnitPrice) : null,
        );
      });
      const invoiceNumber = invoiceQueries.generateInvoiceNumber(db);
      invoiceQueries.insertForOrder(db, {
        invoiceNumber,
        amount: grandTotal,
        orderId: newId,
        userId: placedByUserId,
      });
    });
    tx();
    return orderQueries.findById(db, newId);
  },

  updateOrderWithLines(
    db,
    id,
    {
      lines,
      customerName,
      customerContact,
      customerCity,
      customerAddress,
      note,
      status,
      deliveryCharges,
      placedByUserId,
      trackingId,
    },
  ) {
    const rawDel = Number(deliveryCharges);
    const safeDelivery =
      Number.isFinite(rawDel) && rawDel >= 0 ? rawDel : 0;
    const safeTrackingId = String(trackingId || '').trim().slice(0, 120);
    const tx = db.transaction(() => {
      let sumLines = 0;
      for (const L of lines) {
        sumLines += lineTotalFor(L);
      }
      const grandTotal = sumLines + safeDelivery;
      const first = lines[0] || {};
      db.prepare(
        `UPDATE orders SET
          product_name = ?, qty = ?, weight_g = ?, unit_price = ?, total = ?,
          customer_name = ?, customer_contact = ?, customer_city = ?, customer_address = ?,
          note = ?, delivery_charges = ?, tracking_id = ?, status = ?
         WHERE id = ?`,
      ).run(
        String(first.productName || '').slice(0, 200),
        first.qty ?? 1,
        first.weightG ?? 0,
        first.unitPrice ?? 0,
        grandTotal,
        customerName,
        customerContact,
        customerCity,
        customerAddress,
        note,
        safeDelivery,
        safeTrackingId,
        status,
        id,
      );
      db.prepare(`DELETE FROM order_items WHERE order_id = ?`).run(id);
      const insItem = db.prepare(
        `INSERT INTO order_items (order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total, base_unit_weight_g, base_unit_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      lines.forEach((L, idx) => {
        insItem.run(
          id,
          idx,
          L.productId != null ? Number(L.productId) : null,
          String(L.productName || '').slice(0, 200),
          L.qty,
          L.weightG,
          L.unitPrice,
          lineTotalFor(L),
          L.baseUnitWeightG != null ? Number(L.baseUnitWeightG) : null,
          L.baseUnitPrice != null ? Number(L.baseUnitPrice) : null,
        );
      });
      invoiceQueries.syncAmountForOrder(db, {
        orderId: id,
        amount: grandTotal,
        userId: placedByUserId,
      });
    });
    tx();
    return orderQueries.findById(db, id);
  },

  updateOrderStatus(db, id, status) {
    db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, id);
  },

  deleteOrder(db, id) {
    const tx = db.transaction(() => {
      invoiceQueries.deleteByOrderId(db, id);
      db.prepare(`DELETE FROM orders WHERE id = ?`).run(id);
    });
    tx();
  },
};

const tagQueries = {
  /** Upsert a Green/Yellow/Red tag against a normalized (lowercased) contact. */
  setTag(db, contact, tag) {
    const c = String(contact || '').trim().toLowerCase();
    if (!c) return;
    db.prepare(
      `INSERT INTO customer_tags (contact, tag) VALUES (?, ?)
       ON CONFLICT(contact) DO UPDATE SET tag = excluded.tag, updated_at = datetime('now')`,
    ).run(c, tag);
  },

  removeTag(db, contact) {
    const c = String(contact || '').trim().toLowerCase();
    if (!c) return;
    db.prepare(`DELETE FROM customer_tags WHERE contact = ?`).run(c);
  },
};

const dashboardQueries = {
  recordLogin(db, userId) {
    db.prepare(`INSERT INTO login_events (user_id) VALUES (?)`).run(userId);
  },

  getSnapshot(db, limits) {
    const limOrders = limits?.recentOrders ?? 3;
    const limProducts = limits?.recentProducts ?? 3;
    const users = db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c;
    const products = db.prepare(`SELECT COUNT(*) AS c FROM products`).get().c;
    const orders = db.prepare(`SELECT COUNT(*) AS c FROM orders`).get().c;
    const invoices = db.prepare(`SELECT COUNT(*) AS c FROM invoices`).get().c;
    const ordersOpen = db
      .prepare(
        `SELECT COUNT(*) AS c FROM orders WHERE lower(status) IN ('pending','open','held')`
      )
      .get().c;
    const ordersCancelled = db
      .prepare(
        `SELECT COUNT(*) AS c FROM orders WHERE lower(trim(COALESCE(status,''))) = 'cancelled'`
      )
      .get().c;
    const ordersDelivered = db
      .prepare(
        `SELECT COUNT(*) AS c FROM orders WHERE lower(trim(COALESCE(status,''))) IN ('delivered','completed')`,
      )
      .get().c;
    const invoicesUnpaid = db
      .prepare(
        `SELECT COUNT(*) AS c FROM invoices WHERE lower(status) NOT IN ('paid','void','cancelled')`
      )
      .get().c;
    const recentOrders = db
      .prepare(
        `SELECT o.id, o.order_number,
                (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS line_count,
                (COALESCE(
                  (SELECT SUM(i.line_total) FROM order_items i WHERE i.order_id = o.id),
                  0
                ) + COALESCE(o.delivery_charges, 0)) AS total,
                o.customer_name, o.status, o.created_at,
                u.username AS placed_by_username
         FROM orders o
         LEFT JOIN users u ON u.id = o.placed_by_user_id
         WHERE lower(trim(COALESCE(o.status,''))) IN ('pending','open','held')
         ORDER BY datetime(o.created_at) DESC, o.id DESC
         LIMIT ?`
      )
      .all(limOrders);

    const recentProducts = db
      .prepare(
        `SELECT p.id, p.name, p.sku, p.price, p.weight_g, p.created_at
         FROM products p
         ORDER BY datetime(p.created_at) DESC, p.id DESC
         LIMIT ?`,
      )
      .all(limProducts);

    return {
      counts: {
        users,
        products,
        orders,
        invoices,
        ordersOpen,
        ordersDelivered,
        ordersCancelled,
        invoicesUnpaid,
      },
      recentOrders,
      recentProducts,
    };
  },
};

const resetQueries = {
  upsertReset(db, userId, codeHash) {
    db.prepare(
      `INSERT INTO password_resets (user_id, code_hash, expires_at)
       VALUES (?, ?, datetime('now', '+15 minutes'))
       ON CONFLICT(user_id) DO UPDATE SET
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at`
    ).run(userId, codeHash);
  },

  /** @returns {{ code_hash: string } | undefined} */
  getValidReset(db, userId) {
    return db
      .prepare(
        `SELECT code_hash FROM password_resets
         WHERE user_id = ? AND datetime(expires_at) > datetime('now')`
      )
      .get(userId);
  },

  deleteReset(db, userId) {
    db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).run(userId);
  },
};

const installationQueries = {
  getMeta(db) {
    return db
      .prepare(
        `SELECT installation_id, registered_at FROM installation_meta WHERE id = 1`,
      )
      .get();
  },

  setMeta(db, installationId) {
    db.prepare(
      `INSERT INTO installation_meta (id, installation_id) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET
         installation_id = excluded.installation_id,
         registered_at = datetime('now')`,
    ).run(installationId);
  },
};

module.exports = {
  initDatabase,
  needsSetup,
  createFirstAdmin,
  userQueries,
  productQueries,
  orderQueries,
  invoiceQueries,
  resetQueries,
  dashboardQueries,
  installationQueries,
  tagQueries,
};
