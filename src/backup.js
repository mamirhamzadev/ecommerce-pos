const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const BACKUP_FORMAT_VERSION = 1;

/** Required columns per table for validation (order matters for docs only). */
const TABLE_SCHEMAS = {
  users: [
    'id',
    'username',
    'password_hash',
    'role',
    'name',
    'email',
    'created_at',
  ],
  login_events: ['id', 'user_id', 'logged_in_at'],
  products: ['id', 'name', 'sku', 'price', 'weight_g', 'created_at'],
  orders: [
    'id',
    'order_number',
    'customer_label',
    'product_name',
    'qty',
    'weight_g',
    'unit_price',
    'total',
    'customer_name',
    'customer_contact',
    'customer_city',
    'customer_address',
    'note',
    'status',
    'placed_by_user_id',
    'created_at',
    'delivery_charges',
    'tracking_id',
  ],
  order_items: [
    'id',
    'order_id',
    'sort_order',
    'product_id',
    'product_name',
    'qty',
    'weight_g',
    'unit_price',
    'line_total',
    'created_at',
  ],
  invoices: [
    'id',
    'invoice_number',
    'amount',
    'status',
    'order_id',
    'user_id',
    'created_at',
  ],
};

const CATEGORY_TABLES = {
  logins: ['users', 'login_events'],
  products: ['products'],
  orders: ['orders', 'order_items'],
  invoices: ['invoices'],
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function sanitizeFileSegment(raw) {
  return (
    String(raw || '')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'app'
  );
}

function formatBackupTimestamp(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[date.getMonth()];
  const yyyy = date.getFullYear();
  let hours = date.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${dd}-${month}-${yyyy}-${hh}-${mm}-${ss}-${ampm}`;
}

function buildBackupFileName(appName) {
  const safeApp = sanitizeFileSegment(appName);
  const stamp = formatBackupTimestamp();
  return `backup-${safeApp}-${stamp}.db`;
}

function normalizeSelection(selection = {}) {
  return {
    logins: Boolean(selection.logins),
    products: Boolean(selection.products),
    orders: Boolean(selection.orders),
    invoices: Boolean(selection.invoices),
  };
}

function tablesForSelection(selection) {
  const sel = normalizeSelection(selection);
  const tables = [];
  const seen = new Set();
  for (const key of ['logins', 'products', 'orders', 'invoices']) {
    if (!sel[key]) continue;
    for (const table of CATEGORY_TABLES[key]) {
      if (!seen.has(table)) {
        seen.add(table);
        tables.push(table);
      }
    }
  }
  return tables;
}

function escapeSqlitePath(filePath) {
  return String(filePath).replace(/'/g, "''");
}

function tableColumns(db, tableName, schema = 'main') {
  const rows =
    schema === 'main'
      ? db.prepare(`PRAGMA table_info(${tableName})`).all()
      : db.prepare(`PRAGMA ${schema}.table_info(${tableName})`).all();
  return rows.map((r) => r.name);
}

function validateTableSchema(db, tableName, schema = 'main') {
  const expected = TABLE_SCHEMAS[tableName];
  if (!expected) {
    return { ok: false, error: `Unknown table: ${tableName}` };
  }
  const actual = tableColumns(db, tableName, schema);
  const actualSet = new Set(actual);
  const missing = expected.filter((col) => !actualSet.has(col));
  if (missing.length) {
    return {
      ok: false,
      error: `Table "${tableName}" is missing columns: ${missing.join(', ')}`,
    };
  }
  return { ok: true };
}

function readBackupMeta(db, schema = 'main') {
  const prefix = schema === 'main' ? '' : `${schema}.`;
  const row = db
    .prepare(
      `SELECT format_version, app_name, created_at,
              selection_logins, selection_products, selection_orders, selection_invoices
       FROM ${prefix}_backup_meta LIMIT 1`,
    )
    .get();
  if (!row) return null;
  return {
    formatVersion: row.format_version,
    appName: row.app_name,
    createdAt: row.created_at,
    selection: {
      logins: Boolean(row.selection_logins),
      products: Boolean(row.selection_products),
      orders: Boolean(row.selection_orders),
      invoices: Boolean(row.selection_invoices),
    },
  };
}

function countRows(db, tableName, schema = 'main') {
  const prefix = schema === 'main' ? '' : `${schema}.`;
  try {
    return db.prepare(`SELECT COUNT(*) AS c FROM ${prefix}${tableName}`).get().c;
  } catch {
    return 0;
  }
}

function validateBackupFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { ok: false, error: 'Backup file not found.' };
  }
  let backupDb;
  try {
    backupDb = new Database(filePath, { readonly: true, fileMustExist: true });
  } catch (e) {
    return { ok: false, error: 'Could not open backup file. It may be corrupt or not a valid database.' };
  }

  try {
    const meta = readBackupMeta(backupDb, 'main');
    if (!meta) {
      return { ok: false, error: 'Invalid backup: metadata is missing.' };
    }
    if (meta.formatVersion !== BACKUP_FORMAT_VERSION) {
      return {
        ok: false,
        error: `Unsupported backup format version (${meta.formatVersion}).`,
      };
    }

    const tables = tablesForSelection(meta.selection);
    if (!tables.length) {
      return { ok: false, error: 'Backup file contains no data categories.' };
    }

    for (const table of tables) {
      const exists = backupDb
        .prepare(
          `SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`,
        )
        .get(table);
      if (!exists) {
        return { ok: false, error: `Backup is missing table "${table}".` };
      }
      const schemaCheck = validateTableSchema(backupDb, table, 'main');
      if (schemaCheck.ok !== true) {
        return schemaCheck;
      }
    }

    const counts = {};
    for (const key of ['logins', 'products', 'orders', 'invoices']) {
      if (!meta.selection[key]) continue;
      const categoryTables = CATEGORY_TABLES[key];
      counts[key] = categoryTables.reduce(
        (sum, t) => sum + countRows(backupDb, t, 'main'),
        0,
      );
    }

    return {
      ok: true,
      filePath,
      meta,
      counts,
      tables,
    };
  } finally {
    backupDb.close();
  }
}

function copyTableSchemaAndData(mainDb, tableName) {
  const exists = mainDb
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
    .get(tableName);
  if (!exists) {
    throw new Error(`Source table "${tableName}" not found.`);
  }
  // Clone column layout without parsing CREATE TABLE (handles IF NOT EXISTS, CHECK, etc.)
  mainDb.exec(
    `CREATE TABLE backup.${tableName} AS SELECT * FROM ${tableName} WHERE 0`,
  );
  mainDb.exec(`INSERT INTO backup.${tableName} SELECT * FROM ${tableName}`);
}

function exportBackup(mainDb, destPath, selection, appName) {
  const sel = normalizeSelection(selection);
  const tables = tablesForSelection(sel);
  if (!tables.length) {
    return { ok: false, error: 'Select at least one category to back up.' };
  }

  const dir = path.dirname(destPath);
  ensureDir(dir);
  if (fs.existsSync(destPath)) {
    fs.unlinkSync(destPath);
  }

  const escaped = escapeSqlitePath(destPath);
  let attached = false;
  try {
    mainDb.exec(`ATTACH DATABASE '${escaped}' AS backup`);
    attached = true;

    mainDb.exec(`
      CREATE TABLE backup._backup_meta (
        format_version INTEGER NOT NULL,
        app_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        selection_logins INTEGER NOT NULL,
        selection_products INTEGER NOT NULL,
        selection_orders INTEGER NOT NULL,
        selection_invoices INTEGER NOT NULL
      );
    `);
    mainDb
      .prepare(
        `INSERT INTO backup._backup_meta (
          format_version, app_name, created_at,
          selection_logins, selection_products, selection_orders, selection_invoices
        ) VALUES (?, ?, datetime('now'), ?, ?, ?, ?)`,
      )
      .run(
        BACKUP_FORMAT_VERSION,
        String(appName || 'App'),
        sel.logins ? 1 : 0,
        sel.products ? 1 : 0,
        sel.orders ? 1 : 0,
        sel.invoices ? 1 : 0,
      );

    for (const table of tables) {
      try {
        copyTableSchemaAndData(mainDb, table);
      } catch (e) {
        throw new Error(
          `Failed to back up "${table}": ${e.message || 'unknown error'}`,
        );
      }
    }

    mainDb.exec(`DETACH DATABASE backup`);
    attached = false;
    return { ok: true, filePath: destPath, tables };
  } catch (e) {
    if (attached) {
      try {
        mainDb.exec(`DETACH DATABASE backup`);
      } catch {
        /* best-effort detach */
      }
    }
    try {
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
    } catch {
      /* best-effort cleanup */
    }
    return { ok: false, error: e.message || 'Backup failed.' };
  }
}

function deleteBackedUpTransactionalData(mainDb, selection) {
  const sel = normalizeSelection(selection);
  const tx = mainDb.transaction(() => {
    if (sel.invoices) {
      mainDb.prepare(`DELETE FROM invoices`).run();
    }
    if (sel.orders) {
      mainDb.prepare(`DELETE FROM orders`).run();
    }
  });
  tx();
}

function userExists(mainDb, userId) {
  if (userId == null) return false;
  return Boolean(
    mainDb.prepare(`SELECT 1 FROM users WHERE id = ?`).get(userId),
  );
}

function productExists(mainDb, productId) {
  if (productId == null) return false;
  return Boolean(
    mainDb.prepare(`SELECT 1 FROM products WHERE id = ?`).get(productId),
  );
}

function orderExists(mainDb, orderId) {
  if (orderId == null) return false;
  return Boolean(
    mainDb.prepare(`SELECT 1 FROM orders WHERE id = ?`).get(orderId),
  );
}

function restoreUsers(mainDb) {
  return mainDb
    .prepare(
      `INSERT OR IGNORE INTO users (id, username, password_hash, role, name, email, created_at)
       SELECT b.id, b.username, b.password_hash, b.role, b.name, b.email, b.created_at
       FROM bk.users b
       WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = b.id)
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.username = b.username)`,
    )
    .run().changes;
}

function restoreLoginEvents(mainDb) {
  const rows = mainDb.prepare(`SELECT id, user_id, logged_in_at FROM bk.login_events`).all();
  let inserted = 0;
  const ins = mainDb.prepare(
    `INSERT OR IGNORE INTO login_events (id, user_id, logged_in_at) VALUES (?, ?, ?)`,
  );
  for (const r of rows) {
    if (!userExists(mainDb, r.user_id)) continue;
    const dup = mainDb.prepare(`SELECT 1 FROM login_events WHERE id = ?`).get(r.id);
    if (dup) continue;
    const res = ins.run(r.id, r.user_id, r.logged_in_at);
    inserted += res.changes;
  }
  return inserted;
}

function restoreProducts(mainDb) {
  return mainDb
    .prepare(
      `INSERT OR IGNORE INTO products (id, name, sku, price, weight_g, created_at)
       SELECT b.id, b.name, b.sku, b.price, b.weight_g, b.created_at
       FROM bk.products b
       WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = b.id)`,
    )
    .run().changes;
}

function restoreOrders(mainDb) {
  const rows = mainDb.prepare(`SELECT * FROM bk.orders`).all();
  let inserted = 0;
  const ins = mainDb.prepare(
    `INSERT OR IGNORE INTO orders (
      id, order_number, customer_label, product_name, qty, weight_g, unit_price, total,
      customer_name, customer_contact, customer_city, customer_address, note, status,
      placed_by_user_id, created_at, delivery_charges, tracking_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const b of rows) {
    const dupId = mainDb.prepare(`SELECT 1 FROM orders WHERE id = ?`).get(b.id);
    const dupNum = mainDb
      .prepare(`SELECT 1 FROM orders WHERE order_number = ?`)
      .get(b.order_number);
    if (dupId || dupNum) continue;
    const placedBy = userExists(mainDb, b.placed_by_user_id)
      ? b.placed_by_user_id
      : null;
    const res = ins.run(
      b.id,
      b.order_number,
      b.customer_label ?? '',
      b.product_name ?? '',
      b.qty ?? 1,
      b.weight_g ?? 0,
      b.unit_price ?? 0,
      b.total ?? 0,
      b.customer_name ?? '',
      b.customer_contact ?? '',
      b.customer_city ?? '',
      b.customer_address ?? '',
      b.note ?? '',
      b.status ?? 'pending',
      placedBy,
      b.created_at,
      b.delivery_charges ?? 0,
      b.tracking_id ?? '',
    );
    inserted += res.changes;
  }
  return inserted;
}

function restoreOrderItems(mainDb) {
  const rows = mainDb.prepare(`SELECT * FROM bk.order_items`).all();
  let inserted = 0;
  const ins = mainDb.prepare(
    `INSERT OR IGNORE INTO order_items (
      id, order_id, sort_order, product_id, product_name, qty, weight_g, unit_price, line_total, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const b of rows) {
    if (!orderExists(mainDb, b.order_id)) continue;
    const dup = mainDb.prepare(`SELECT 1 FROM order_items WHERE id = ?`).get(b.id);
    if (dup) continue;
    const productId = productExists(mainDb, b.product_id) ? b.product_id : null;
    const res = ins.run(
      b.id,
      b.order_id,
      b.sort_order ?? 0,
      productId,
      b.product_name ?? '',
      b.qty ?? 1,
      b.weight_g ?? 0,
      b.unit_price ?? 0,
      b.line_total ?? 0,
      b.created_at,
    );
    inserted += res.changes;
  }
  return inserted;
}

function restoreInvoices(mainDb) {
  const rows = mainDb.prepare(`SELECT * FROM bk.invoices`).all();
  let inserted = 0;
  const ins = mainDb.prepare(
    `INSERT OR IGNORE INTO invoices (
      id, invoice_number, amount, status, order_id, user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const b of rows) {
    const dupId = mainDb.prepare(`SELECT 1 FROM invoices WHERE id = ?`).get(b.id);
    const dupNum = mainDb
      .prepare(`SELECT 1 FROM invoices WHERE invoice_number = ?`)
      .get(b.invoice_number);
    if (dupId || dupNum) continue;
    const orderId =
      b.order_id != null && orderExists(mainDb, b.order_id) ? b.order_id : null;
    const userId =
      b.user_id != null && userExists(mainDb, b.user_id) ? b.user_id : null;
    const res = ins.run(
      b.id,
      b.invoice_number,
      b.amount ?? 0,
      b.status ?? 'draft',
      orderId,
      userId,
      b.created_at,
    );
    inserted += res.changes;
  }
  return inserted;
}

function tableExistsInBackup(mainDb, tableName) {
  return Boolean(
    mainDb
      .prepare(
        `SELECT 1 FROM bk.sqlite_master WHERE type='table' AND name=? LIMIT 1`,
      )
      .get(tableName),
  );
}

function importBackup(mainDb, filePath) {
  const validation = validateBackupFile(filePath);
  if (validation.ok !== true) {
    return validation;
  }

  const escaped = escapeSqlitePath(filePath);
  mainDb.exec(`ATTACH DATABASE '${escaped}' AS bk`);
  try {
    const meta = readBackupMeta(mainDb, 'bk');
    if (!meta) {
      return { ok: false, error: 'Invalid backup metadata.' };
    }

    const restored = {
      users: 0,
      login_events: 0,
      products: 0,
      orders: 0,
      order_items: 0,
      invoices: 0,
    };

    const tx = mainDb.transaction(() => {
      if (meta.selection.logins) {
        if (tableExistsInBackup(mainDb, 'users')) {
          const schemaCheck = validateTableSchema(mainDb, 'users', 'bk');
          if (schemaCheck.ok !== true) throw new Error(schemaCheck.error);
          restored.users = restoreUsers(mainDb);
        }
        if (tableExistsInBackup(mainDb, 'login_events')) {
          const schemaCheck = validateTableSchema(mainDb, 'login_events', 'bk');
          if (schemaCheck.ok !== true) throw new Error(schemaCheck.error);
          restored.login_events = restoreLoginEvents(mainDb);
        }
      }
      if (meta.selection.products && tableExistsInBackup(mainDb, 'products')) {
        const schemaCheck = validateTableSchema(mainDb, 'products', 'bk');
        if (schemaCheck.ok !== true) throw new Error(schemaCheck.error);
        restored.products = restoreProducts(mainDb);
      }
      if (meta.selection.orders) {
        if (tableExistsInBackup(mainDb, 'orders')) {
          const schemaCheck = validateTableSchema(mainDb, 'orders', 'bk');
          if (schemaCheck.ok !== true) throw new Error(schemaCheck.error);
          restored.orders = restoreOrders(mainDb);
        }
        if (tableExistsInBackup(mainDb, 'order_items')) {
          const schemaCheck = validateTableSchema(mainDb, 'order_items', 'bk');
          if (schemaCheck.ok !== true) throw new Error(schemaCheck.error);
          restored.order_items = restoreOrderItems(mainDb);
        }
      }
      if (meta.selection.invoices && tableExistsInBackup(mainDb, 'invoices')) {
        const schemaCheck = validateTableSchema(mainDb, 'invoices', 'bk');
        if (schemaCheck.ok !== true) throw new Error(schemaCheck.error);
        restored.invoices = restoreInvoices(mainDb);
      }
    });

    try {
      tx();
    } catch (e) {
      return { ok: false, error: e.message || 'Restore failed.' };
    }

    return { ok: true, restored, meta };
  } finally {
    mainDb.exec(`DETACH DATABASE bk`);
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

module.exports = {
  BACKUP_FORMAT_VERSION,
  buildBackupFileName,
  normalizeSelection,
  validateBackupFile,
  exportBackup,
  importBackup,
  deleteBackedUpTransactionalData,
};
