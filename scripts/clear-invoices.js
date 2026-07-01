const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

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

const dbPath =
  process.env.DATABASE_FILE?.trim() ||
  path.join(
    os.homedir(),
    sanitizeHomeFolderName(process.env.APP_DATA_FOLDER || 'pos-mushtaq'),
    'database',
    'app.db',
  );

if (!fs.existsSync(dbPath)) {
  console.error('Database not found:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);
const before = db.prepare('SELECT COUNT(*) AS c FROM invoices').get().c;
db.prepare('DELETE FROM invoices').run();
const after = db.prepare('SELECT COUNT(*) AS c FROM invoices').get().c;
db.close();
console.log(`Deleted ${before} invoice(s). Remaining: ${after}.`);
process.exit(0);
