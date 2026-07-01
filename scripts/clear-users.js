const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'POS-Mushtaq', 'database', 'app.db');
const db = new Database(dbPath);
const before = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
db.exec('DELETE FROM users');
const after = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
console.log('DB:', dbPath);
console.log('Users before:', before);
console.log('Users after:', after);
db.close();
