const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// ==================== اتصال Turso ====================
const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ==================== إنشاء الجداول ====================
async function initDB() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL UNIQUE,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'user',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS articles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT    NOT NULL UNIQUE,
      title       TEXT    NOT NULL,
      category    TEXT    NOT NULL DEFAULT 'عام',
      content     TEXT    NOT NULL,
      image       TEXT    DEFAULT '',
      published   INTEGER NOT NULL DEFAULT 1,
      author_id   INTEGER REFERENCES users(id),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS countries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL UNIQUE,
      flag         TEXT    DEFAULT '',
      description  TEXT    DEFAULT '',
      type         TEXT    NOT NULL DEFAULT 'both',
      council_data TEXT    DEFAULT '',
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_companies (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      country_id   INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
      name         TEXT    NOT NULL,
      market_value TEXT    NOT NULL DEFAULT '0',
      growth       TEXT    NOT NULL DEFAULT '0%',
      sort_order   INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      publisher   TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      image       TEXT    DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // admin افتراضي
  const res = await db.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (res.rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.execute({
      sql: "INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?,?,?,?)",
      args: ['admin', 'admin@malines.com', hash, 'admin']
    });
    console.log('✅ admin افتراضي: admin@malines.com / admin123');
  }

  console.log('✅ قاعدة البيانات جاهزة');
}

// ==================== DB Helper ====================
// يعيد صفوف كـ plain objects
function rows(result) {
  return result.rows.map(r => Object.fromEntries(
    Object.entries(r).map(([k,v]) => [k, v])
  ));
}
function firstRow(result) {
  const r = result.rows[0];
  return r ? Object.fromEntries(Object.entries(r)) : null;
}

// ==================== Query Functions ====================
const q = {
  // Users
  getUserByEmail:  (email) =>
    db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] }).then(firstRow),
  getUserById:     (id) =>
    db.execute({ sql: 'SELECT id,username,email,role,created_at FROM users WHERE id = ?', args: [id] }).then(firstRow),
  createUser:      (username, email, password, role) =>
    db.execute({ sql: 'INSERT INTO users (username,email,password,role) VALUES (?,?,?,?)', args: [username,email,password,role] }),
  listUsers:       () =>
    db.execute('SELECT id,username,email,role,created_at FROM users ORDER BY created_at DESC').then(rows),
  deleteUser:      (id) =>
    db.execute({ sql: 'DELETE FROM users WHERE id = ? AND role != "admin"', args: [id] }),
  updateUserRole:  (role, id) =>
    db.execute({ sql: 'UPDATE users SET role = ? WHERE id = ?', args: [role, id] }),

  // Articles
  listArticles:    () =>
    db.execute('SELECT id,slug,title,category,image,published,created_at FROM articles ORDER BY created_at DESC').then(rows),
  listPublished:   () =>
    db.execute('SELECT id,slug,title,category,image,created_at FROM articles WHERE published = 1 ORDER BY created_at DESC').then(rows),
  getArticle:      (slug) =>
    db.execute({ sql: 'SELECT * FROM articles WHERE slug = ?', args: [slug] }).then(firstRow),
  createArticle:   (slug,title,category,content,image,published,author_id) =>
    db.execute({ sql: 'INSERT INTO articles (slug,title,category,content,image,published,author_id) VALUES (?,?,?,?,?,?,?)', args: [slug,title,category,content,image,published,author_id] }),
  updateArticle:   (title,category,content,image,published,slug) =>
    db.execute({ sql: 'UPDATE articles SET title=?,category=?,content=?,image=?,published=?,updated_at=datetime("now") WHERE slug=?', args: [title,category,content,image,published,slug] }),
  deleteArticle:   (slug) =>
    db.execute({ sql: 'DELETE FROM articles WHERE slug = ?', args: [slug] }),

  // Countries
  listCountries:   () =>
    db.execute('SELECT * FROM countries ORDER BY name ASC').then(rows),
  listByType:      (type) =>
    db.execute({ sql: 'SELECT * FROM countries WHERE type = ? OR type = "both" ORDER BY name ASC', args: [type] }).then(rows),
  getCountryByName:(name) =>
    db.execute({ sql: 'SELECT * FROM countries WHERE name = ?', args: [name] }).then(firstRow),
  createCountry:   (name,flag,description,type,council_data) =>
    db.execute({ sql: 'INSERT INTO countries (name,flag,description,type,council_data) VALUES (?,?,?,?,?)', args: [name,flag,description,type,council_data] }),
  updateCountry:   (name,flag,description,type,council_data,id) =>
    db.execute({ sql: 'UPDATE countries SET name=?,flag=?,description=?,type=?,council_data=?,updated_at=datetime("now") WHERE id=?', args: [name,flag,description,type,council_data,id] }),
  deleteCountry:   (id) =>
    db.execute({ sql: 'DELETE FROM countries WHERE id = ?', args: [id] }),

  // Stock Companies
  getCompaniesByCountry: (country_id) =>
    db.execute({ sql: 'SELECT * FROM stock_companies WHERE country_id = ? ORDER BY sort_order ASC, id ASC', args: [country_id] }).then(rows),
  createCompany:   (country_id,name,market_value,growth,sort_order) =>
    db.execute({ sql: 'INSERT INTO stock_companies (country_id,name,market_value,growth,sort_order) VALUES (?,?,?,?,?)', args: [country_id,name,market_value,growth,sort_order] }),
  updateCompany:   (name,market_value,growth,sort_order,id) =>
    db.execute({ sql: 'UPDATE stock_companies SET name=?,market_value=?,growth=?,sort_order=?,updated_at=datetime("now") WHERE id=?', args: [name,market_value,growth,sort_order,id] }),
  deleteCompany:   (id) =>
    db.execute({ sql: 'DELETE FROM stock_companies WHERE id = ?', args: [id] }),

  // Records
  listRecords:     () =>
    db.execute('SELECT * FROM records ORDER BY created_at DESC').then(rows),
  createRecord:    (publisher,content,image) =>
    db.execute({ sql: 'INSERT INTO records (publisher,content,image) VALUES (?,?,?)', args: [publisher,content,image] }),
  deleteRecord:    (id) =>
    db.execute({ sql: 'DELETE FROM records WHERE id = ?', args: [id] }),
};

module.exports = { db, q, initDB };
