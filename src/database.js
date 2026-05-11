const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { hashPassword } = require('./auth');

const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASS = 'admin123';

function initDatabase(app) {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const dbPath = path.join(dir, 'app.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_login_events_time ON login_events(logged_in_at);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);`,
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

  db.exec(`
    INSERT INTO order_items (order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total)
    SELECT o.id,
           0,
           NULL,
           CASE WHEN trim(COALESCE(o.product_name, '')) != '' THEN o.product_name ELSE 'Line item' END,
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
  if (orderColNames.has('customer_label')) {
    db.exec(
      `UPDATE orders SET customer_name = customer_label WHERE trim(customer_name) = '' AND trim(customer_label) != ''`,
    );
  }
  db.exec(
    `UPDATE orders SET status = 'delivered' WHERE lower(status) = 'completed'`,
  );

  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count === 0) {
    const hash = hashPassword(DEFAULT_ADMIN_PASS);
    db.prepare(
      `INSERT INTO users (username, password_hash, role, name, email) VALUES (?, ?, 'admin', ?, ?)`
    ).run(DEFAULT_ADMIN_USER, hash, 'Administrator', '');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id INTEGER PRIMARY KEY,
      can_create_product INTEGER NOT NULL DEFAULT 1,
      can_edit_product INTEGER NOT NULL DEFAULT 1,
      can_remove_product INTEGER NOT NULL DEFAULT 1,
      can_create_order INTEGER NOT NULL DEFAULT 1,
      can_delete_order INTEGER NOT NULL DEFAULT 1,
      can_edit_order INTEGER NOT NULL DEFAULT 1,
      can_change_order_status INTEGER NOT NULL DEFAULT 1,
      can_create_user INTEGER NOT NULL DEFAULT 1,
      can_edit_user INTEGER NOT NULL DEFAULT 1,
      can_delete_user INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    INSERT INTO user_permissions (
      user_id,
      can_create_product, can_edit_product, can_remove_product,
      can_create_order, can_delete_order, can_edit_order, can_change_order_status,
      can_create_user, can_edit_user, can_delete_user
    )
    SELECT u.id, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
    FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM user_permissions p WHERE p.user_id = u.id);
  `);

  return db;
}

/** WHERE for `users u` — role + search on name, username, email, or exact id */
function buildUserListWhere(filters) {
  const fragments = [];
  const params = [];
  const role = String(filters?.role ?? 'all').trim().toLowerCase();
  const q = String(filters?.q ?? '').trim();
  const excludeUserId = Number(filters?.excludeUserId);

  if (Number.isFinite(excludeUserId) && excludeUserId > 0) {
    fragments.push('u.id != ?');
    params.push(excludeUserId);
  }

  if (role === 'admin' || role === 'user') {
    fragments.push(`(lower(trim(COALESCE(u.role,''))) = ?)`);
    params.push(role);
  }

  if (q) {
    const ql = q.toLowerCase();
    fragments.push(
      `(
        instr(lower(COALESCE(u.name,'')), ?) > 0 OR
        instr(lower(COALESCE(u.username,'')), ?) > 0 OR
        instr(lower(COALESCE(u.email,'')), ?) > 0 OR
        CAST(u.id AS TEXT) = ?
      )`,
    );
    params.push(ql, ql, ql, q);
  }

  const whereSql = fragments.length ? `WHERE ${fragments.join(' AND ')}` : '';
  return { whereSql, params };
}

/** Full access — used when no row exists (safety) and for admin defaults */
const PERMISSIONS_ALL_TRUE = {
  canCreateProduct: true,
  canEditProduct: true,
  canRemoveProduct: true,
  canCreateOrder: true,
  canDeleteOrder: true,
  canEditOrder: true,
  canChangeOrderStatus: true,
  canCreateUser: true,
  canEditUser: true,
  canDeleteUser: true,
};

/** New accounts with role `user`: create order + change status only by default */
const PERMISSIONS_NEW_USER_ROLE = {
  canCreateProduct: false,
  canEditProduct: false,
  canRemoveProduct: false,
  canCreateOrder: true,
  canDeleteOrder: false,
  canEditOrder: false,
  canChangeOrderStatus: true,
  canCreateUser: false,
  canEditUser: false,
  canDeleteUser: false,
};

function permissionsRowToApi(row) {
  if (!row) {
    return { ...PERMISSIONS_ALL_TRUE };
  }
  return {
    canCreateProduct: !!row.can_create_product,
    canEditProduct: !!row.can_edit_product,
    canRemoveProduct: !!row.can_remove_product,
    canCreateOrder: !!row.can_create_order,
    canDeleteOrder: !!row.can_delete_order,
    canEditOrder: !!row.can_edit_order,
    canChangeOrderStatus: !!row.can_change_order_status,
    canCreateUser: !!row.can_create_user,
    canEditUser: !!row.can_edit_user,
    canDeleteUser: !!row.can_delete_user,
  };
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
        `SELECT u.id, u.username, u.name, u.email, u.role
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
        `SELECT u.id, u.username, u.name, u.email, u.role, u.password_hash
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

  listUsers(db, excludeUserId) {
    const ex = Number(excludeUserId);
    if (Number.isFinite(ex) && ex > 0) {
      return db
        .prepare(
          `SELECT id, username, name, email, role, created_at FROM users WHERE id != ? ORDER BY username`,
        )
        .all(ex);
    }
    return db
      .prepare(
        `SELECT id, username, name, email, role, created_at FROM users ORDER BY username`,
      )
      .all();
  },

  listUsersPaged(db, page, pageSize, filters = {}) {
    const { whereSql, params: whereParams } = buildUserListWhere(filters);
    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM users u ${whereSql}`)
      .get(...whereParams).c;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const offset = (safePage - 1) * pageSize;
    const rows = db
      .prepare(
        `SELECT u.id, u.username, u.name, u.email, u.role, u.created_at
         FROM users u
         ${whereSql}
         ORDER BY u.username
         LIMIT ? OFFSET ?`,
      )
      .all(...whereParams, pageSize, offset);
    return { rows, total, page: safePage, pageSize };
  },

  createUser(db, username, passwordHash, role, name, email) {
    const info = db
      .prepare(
        `INSERT INTO users (username, password_hash, role, name, email) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(username, passwordHash, role, name, email);
    return Number(info.lastInsertRowid);
  },

  getUserPermissionsRow(db, userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return undefined;
    return db
      .prepare(`SELECT * FROM user_permissions WHERE user_id = ?`)
      .get(id);
  },

  getUserPermissionsForApi(db, userId) {
    const row = this.getUserPermissionsRow(db, userId);
    return permissionsRowToApi(row);
  },

  upsertUserPermissionsFromApi(db, userId, apiPerms) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return;
    const p = { ...PERMISSIONS_ALL_TRUE, ...apiPerms };
    db.prepare(
      `INSERT INTO user_permissions (
        user_id,
        can_create_product, can_edit_product, can_remove_product,
        can_create_order, can_delete_order, can_edit_order, can_change_order_status,
        can_create_user, can_edit_user, can_delete_user
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET
        can_create_product = excluded.can_create_product,
        can_edit_product = excluded.can_edit_product,
        can_remove_product = excluded.can_remove_product,
        can_create_order = excluded.can_create_order,
        can_delete_order = excluded.can_delete_order,
        can_edit_order = excluded.can_edit_order,
        can_change_order_status = excluded.can_change_order_status,
        can_create_user = excluded.can_create_user,
        can_edit_user = excluded.can_edit_user,
        can_delete_user = excluded.can_delete_user`,
    ).run(
      id,
      p.canCreateProduct ? 1 : 0,
      p.canEditProduct ? 1 : 0,
      p.canRemoveProduct ? 1 : 0,
      p.canCreateOrder ? 1 : 0,
      p.canDeleteOrder ? 1 : 0,
      p.canEditOrder ? 1 : 0,
      p.canChangeOrderStatus ? 1 : 0,
      p.canCreateUser ? 1 : 0,
      p.canEditUser ? 1 : 0,
      p.canDeleteUser ? 1 : 0,
    );
  },

  seedPermissionsForNewUser(db, userId, role) {
    const defs =
      String(role).toLowerCase() === 'admin'
        ? PERMISSIONS_ALL_TRUE
        : PERMISSIONS_NEW_USER_ROLE;
    this.upsertUserPermissionsFromApi(db, userId, defs);
  },

  deleteUser(db, id) {
    db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  },

  updatePassword(db, userId, passwordHash) {
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
      passwordHash,
      userId
    );
  },

  updateUserContact(db, userId, name, email) {
    db.prepare(`UPDATE users SET name = ?, email = ? WHERE id = ?`).run(
      name,
      email,
      userId
    );
  },

  listAdminEmails(db) {
    return db
      .prepare(
        `SELECT DISTINCT lower(trim(email)) AS email FROM users WHERE role = 'admin' AND trim(email) != ''`,
      )
      .all()
      .map((r) => r.email)
      .filter(Boolean);
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

function attachOrderItems(db, orderRow) {
  if (!orderRow) return undefined;
  const items = db
    .prepare(
      `SELECT id, order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total
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
      `SELECT id, order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total
       FROM order_items WHERE order_id IN (${ph}) ORDER BY order_id, sort_order ASC, id ASC`,
    )
    .all(...orderIds);
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

  const whereSql = fragments.length ? `WHERE ${fragments.join(' AND ')}` : '';
  return { whereSql, params };
}

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
                u.username AS placed_by_username,
                (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS line_count,
                COALESCE(
                  (SELECT SUM(i.line_total) FROM order_items i WHERE i.order_id = o.id),
                  o.total
                ) AS total
         FROM orders o
         LEFT JOIN users u ON u.id = o.placed_by_user_id
         ${whereSql}
         ORDER BY datetime(o.created_at) DESC, o.id DESC
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
    },
  ) {
    let newId = null;
    const tx = db.transaction(() => {
      let sumTotal = 0;
      for (const L of lines) {
        sumTotal += L.qty * L.unitPrice;
      }
      const first = lines[0] || {};
      const info = db
        .prepare(
          `INSERT INTO orders (
            order_number, product_name, qty, weight_g, unit_price, total,
            customer_name, customer_contact, customer_city, customer_address, note,
            status, placed_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          orderNumber,
          String(first.productName || '').slice(0, 200),
          first.qty ?? 1,
          first.weightG ?? 0,
          first.unitPrice ?? 0,
          sumTotal,
          customerName,
          customerContact,
          customerCity,
          customerAddress,
          note,
          status,
          placedByUserId,
        );
      newId = Number(info.lastInsertRowid);
      const insItem = db.prepare(
        `INSERT INTO order_items (order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      lines.forEach((L, idx) => {
        const lineTotal = L.qty * L.unitPrice;
        insItem.run(
          newId,
          idx,
          L.productId != null ? Number(L.productId) : null,
          String(L.productName || '').slice(0, 200),
          L.qty,
          L.weightG,
          L.unitPrice,
          lineTotal,
        );
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
    },
  ) {
    const tx = db.transaction(() => {
      let sumTotal = 0;
      for (const L of lines) {
        sumTotal += L.qty * L.unitPrice;
      }
      const first = lines[0] || {};
      db.prepare(
        `UPDATE orders SET
          product_name = ?, qty = ?, weight_g = ?, unit_price = ?, total = ?,
          customer_name = ?, customer_contact = ?, customer_city = ?, customer_address = ?,
          note = ?, status = ?
         WHERE id = ?`,
      ).run(
        String(first.productName || '').slice(0, 200),
        first.qty ?? 1,
        first.weightG ?? 0,
        first.unitPrice ?? 0,
        sumTotal,
        customerName,
        customerContact,
        customerCity,
        customerAddress,
        note,
        status,
        id,
      );
      db.prepare(`DELETE FROM order_items WHERE order_id = ?`).run(id);
      const insItem = db.prepare(
        `INSERT INTO order_items (order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      lines.forEach((L, idx) => {
        const lineTotal = L.qty * L.unitPrice;
        insItem.run(
          id,
          idx,
          L.productId != null ? Number(L.productId) : null,
          String(L.productName || '').slice(0, 200),
          L.qty,
          L.weightG,
          L.unitPrice,
          lineTotal,
        );
      });
    });
    tx();
    return orderQueries.findById(db, id);
  },

  updateOrderStatus(db, id, status) {
    db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, id);
  },

  deleteOrder(db, id) {
    db.prepare(`DELETE FROM orders WHERE id = ?`).run(id);
  },
};

const dashboardQueries = {
  recordLogin(db, userId) {
    db.prepare(`INSERT INTO login_events (user_id) VALUES (?)`).run(userId);
  },

  getSnapshot(db, limits) {
    const limOrders = limits?.recentOrders ?? 3;
    const limLogins = limits?.recentLogins ?? 3;
    const limSignups = limits?.recentSignups ?? 3;

    const users = db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c;
    const products = db.prepare(`SELECT COUNT(*) AS c FROM products`).get().c;
    const orders = db.prepare(`SELECT COUNT(*) AS c FROM orders`).get().c;
    const invoices = db.prepare(`SELECT COUNT(*) AS c FROM invoices`).get().c;
    const ordersOpen = db
      .prepare(
        `SELECT COUNT(*) AS c FROM orders WHERE lower(status) IN ('pending','open','held')`
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
                COALESCE(
                  (SELECT SUM(i.line_total) FROM order_items i WHERE i.order_id = o.id),
                  o.total
                ) AS total,
                o.customer_name, o.status, o.created_at,
                u.username AS placed_by_username
         FROM orders o
         LEFT JOIN users u ON u.id = o.placed_by_user_id
         WHERE lower(trim(COALESCE(o.status,''))) IN ('pending','open','held')
         ORDER BY datetime(o.created_at) DESC, o.id DESC
         LIMIT ?`
      )
      .all(limOrders);

    const recentLogins = db
      .prepare(
        `SELECT e.logged_in_at, u.id AS user_id, u.username, u.name
         FROM login_events e
         JOIN users u ON u.id = e.user_id
         ORDER BY datetime(e.logged_in_at) DESC, e.id DESC
         LIMIT ?`
      )
      .all(limLogins);

    const recentSignups = db
      .prepare(
        `SELECT id, username, name, role, created_at
         FROM users
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT ?`
      )
      .all(limSignups);

    return {
      counts: {
        users,
        products,
        orders,
        invoices,
        ordersOpen,
        invoicesUnpaid,
      },
      recentOrders,
      recentLogins,
      recentSignups,
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

module.exports = {
  initDatabase,
  userQueries,
  productQueries,
  orderQueries,
  resetQueries,
  dashboardQueries,
};
