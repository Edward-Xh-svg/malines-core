const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function rows(r)  { return r.rows.map(row => Object.fromEntries(Object.entries(row))); }
function first(r) { const row = r.rows[0]; return row ? Object.fromEntries(Object.entries(row)) : null; }

async function initDB() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT NOT NULL UNIQUE,
      email        TEXT NOT NULL UNIQUE,
      password     TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'user',
      avatar       TEXT DEFAULT '',
      bio          TEXT DEFAULT '',
      game_id      TEXT DEFAULT '',
      display_name TEXT DEFAULT '',
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS articles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      slug       TEXT NOT NULL UNIQUE,
      title      TEXT NOT NULL,
      category   TEXT NOT NULL DEFAULT 'عام',
      content    TEXT NOT NULL,
      image      TEXT DEFAULT '',
      published  INTEGER NOT NULL DEFAULT 1,
      author_id  INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS countries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL UNIQUE,
      flag         TEXT DEFAULT '',
      description  TEXT DEFAULT '',
      type         TEXT NOT NULL DEFAULT 'both',
      council_data TEXT DEFAULT '',
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_companies (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      country_id   INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      market_value TEXT NOT NULL DEFAULT '0',
      growth       TEXT NOT NULL DEFAULT '0%',
      sort_order   INTEGER NOT NULL DEFAULT 0,
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id),
      publisher   TEXT NOT NULL,
      user_role   TEXT NOT NULL DEFAULT 'Member',
      user_avatar TEXT DEFAULT '',
      content     TEXT NOT NULL,
      image       TEXT DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS record_reactions (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji     TEXT NOT NULL DEFAULT 'like',
      UNIQUE(record_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS record_comments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id    INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username     TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      avatar       TEXT DEFAULT '',
      user_role    TEXT DEFAULT 'Member',
      content      TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_name  TEXT NOT NULL,
      to_name    TEXT NOT NULL,
      content    TEXT NOT NULL,
      read       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // إنشاء/تحديث admin
  const ADMIN_EMAIL = 'misha@malines.nc';
  const ADMIN_PASS  = '60dbedfd4f3247bfa11fc32bb2acd9';
  const hash = bcrypt.hashSync(ADMIN_PASS, 10);
  const adminRes = await db.execute({ sql: "SELECT id FROM users WHERE role='admin' LIMIT 1", args: [] });
  if (adminRes.rows.length === 0) {
    await db.execute({ sql: "INSERT OR REPLACE INTO users (username,email,password,role,display_name) VALUES (?,?,?,?,?)", args: ['misha','misha@malines.nc',hash,'admin','Misha'] });
  } else {
    await db.execute({ sql: "UPDATE users SET email=?,password=?,username='misha',display_name='Misha' WHERE role='admin'", args: [ADMIN_EMAIL, hash] });
  }
  console.log('✅ DB ready | admin: ' + ADMIN_EMAIL);
}

const q = {
  // Users
  getUserByEmail:   (email)    => db.execute({ sql:'SELECT * FROM users WHERE email=?', args:[email] }).then(first),
  getUserById:      (id)       => db.execute({ sql:'SELECT id,username,email,role,avatar,bio,game_id,display_name,created_at FROM users WHERE id=?', args:[id] }).then(first),
  getPublicProfile: (username) => db.execute({ sql:'SELECT id,username,display_name,avatar,bio,game_id,role,created_at FROM users WHERE username=?', args:[username] }).then(first),
  createUser:       (username,email,password) => db.execute({ sql:'INSERT INTO users (username,email,password) VALUES (?,?,?)', args:[username,email,password] }),
  updateProfile:    (display_name,bio,game_id,avatar,id) => db.execute({ sql:'UPDATE users SET display_name=?,bio=?,game_id=?,avatar=? WHERE id=?', args:[display_name,bio,game_id,avatar,id] }),
  listUsers:        () => db.execute('SELECT id,username,email,role,avatar,display_name,created_at FROM users ORDER BY created_at DESC').then(rows),
  listPublicUsers:  () => db.execute("SELECT id,username,display_name,avatar,role FROM users ORDER BY username ASC").then(rows),
  deleteUser:       (id) => db.execute({ sql:"DELETE FROM users WHERE id=? AND role!='admin'", args:[id] }),
  updateUserRole:   (role,id) => db.execute({ sql:'UPDATE users SET role=? WHERE id=?', args:[role,id] }),
  searchUsers:      (q) => db.execute({ sql:"SELECT id,username,display_name,avatar,role FROM users WHERE username LIKE ? OR display_name LIKE ? LIMIT 15", args:['%'+q+'%','%'+q+'%'] }).then(rows),

  // Articles
  listArticles:  () => db.execute('SELECT id,slug,title,category,image,published,created_at FROM articles ORDER BY created_at DESC').then(rows),
  listPublished: () => db.execute('SELECT id,slug,title,category,image,created_at FROM articles WHERE published=1 ORDER BY created_at DESC').then(rows),
  getArticle:    (slug) => db.execute({ sql:'SELECT * FROM articles WHERE slug=?', args:[slug] }).then(first),
  createArticle: (slug,title,category,content,image,published,author_id) => db.execute({ sql:'INSERT INTO articles (slug,title,category,content,image,published,author_id) VALUES (?,?,?,?,?,?,?)', args:[slug,title,category,content,image,published,author_id] }),
  updateArticle: (title,category,content,image,published,slug) => db.execute({ sql:'UPDATE articles SET title=?,category=?,content=?,image=?,published=?,updated_at=datetime("now") WHERE slug=?', args:[title,category,content,image,published,slug] }),
  deleteArticle: (slug) => db.execute({ sql:'DELETE FROM articles WHERE slug=?', args:[slug] }),

  // Countries
  listCountries:    () => db.execute('SELECT * FROM countries ORDER BY name ASC').then(rows),
  listByType:       (type) => db.execute({ sql:'SELECT * FROM countries WHERE type=? OR type="both" ORDER BY name ASC', args:[type] }).then(rows),
  getCountryByName: (name) => db.execute({ sql:'SELECT * FROM countries WHERE name=?', args:[name] }).then(first),
  createCountry:    (name,flag,description,type,council_data) => db.execute({ sql:'INSERT INTO countries (name,flag,description,type,council_data) VALUES (?,?,?,?,?)', args:[name,flag,description,type,council_data] }),
  updateCountry:    (name,flag,description,type,council_data,id) => db.execute({ sql:'UPDATE countries SET name=?,flag=?,description=?,type=?,council_data=?,updated_at=datetime("now") WHERE id=?', args:[name,flag,description,type,council_data,id] }),
  deleteCountry:    (id) => db.execute({ sql:'DELETE FROM countries WHERE id=?', args:[id] }),

  // Stock
  getCompaniesByCountry: (cid) => db.execute({ sql:'SELECT * FROM stock_companies WHERE country_id=? ORDER BY sort_order ASC,id ASC', args:[cid] }).then(rows),
  createCompany:   (cid,name,mv,gr,so) => db.execute({ sql:'INSERT INTO stock_companies (country_id,name,market_value,growth,sort_order) VALUES (?,?,?,?,?)', args:[cid,name,mv,gr,so] }),
  updateCompany:   (name,mv,gr,so,id)  => db.execute({ sql:'UPDATE stock_companies SET name=?,market_value=?,growth=?,sort_order=?,updated_at=datetime("now") WHERE id=?', args:[name,mv,gr,so,id] }),
  deleteCompany:   (id) => db.execute({ sql:'DELETE FROM stock_companies WHERE id=?', args:[id] }),

  // Records
  listRecords:  () => db.execute('SELECT * FROM records ORDER BY created_at DESC').then(rows),
  createRecord: (user_id,publisher,user_role,user_avatar,content,image) => db.execute({ sql:'INSERT INTO records (user_id,publisher,user_role,user_avatar,content,image) VALUES (?,?,?,?,?,?)', args:[user_id,publisher,user_role,user_avatar,content,image] }),
  deleteRecord: (id) => db.execute({ sql:'DELETE FROM records WHERE id=?', args:[id] }),
  getRecord:    (id) => db.execute({ sql:'SELECT * FROM records WHERE id=?', args:[id] }).then(first),

  // Reactions
  getReactions:    (rid) => db.execute({ sql:'SELECT emoji,COUNT(*) as count FROM record_reactions WHERE record_id=? GROUP BY emoji', args:[rid] }).then(rows),
  getUserReaction: (rid,uid) => db.execute({ sql:'SELECT emoji FROM record_reactions WHERE record_id=? AND user_id=?', args:[rid,uid] }).then(first),
  addReaction:     (rid,uid,emoji) => db.execute({ sql:'INSERT OR REPLACE INTO record_reactions (record_id,user_id,emoji) VALUES (?,?,?)', args:[rid,uid,emoji] }),
  removeReaction:  (rid,uid) => db.execute({ sql:'DELETE FROM record_reactions WHERE record_id=? AND user_id=?', args:[rid,uid] }),

  // Comments
  getComments:   (rid) => db.execute({ sql:'SELECT * FROM record_comments WHERE record_id=? ORDER BY created_at ASC', args:[rid] }).then(rows),
  addComment:    (rid,uid,username,display_name,avatar,user_role,content) => db.execute({ sql:'INSERT INTO record_comments (record_id,user_id,username,display_name,avatar,user_role,content) VALUES (?,?,?,?,?,?,?)', args:[rid,uid,username,display_name,avatar,user_role,content] }),
  deleteComment: (id,uid,role) => role==='admin'
    ? db.execute({ sql:'DELETE FROM record_comments WHERE id=?', args:[id] })
    : db.execute({ sql:'DELETE FROM record_comments WHERE id=? AND user_id=?', args:[id,uid] }),

  // Messages
  getConversations: (uid) => db.execute({ sql:`
    SELECT m.*,u1.avatar as from_avatar,u2.avatar as to_avatar
    FROM messages m
    JOIN users u1 ON u1.id=m.from_id
    JOIN users u2 ON u2.id=m.to_id
    WHERE m.id IN (
      SELECT MAX(id) FROM messages
      WHERE from_id=? OR to_id=?
      GROUP BY CASE WHEN from_id=? THEN to_id ELSE from_id END
    )
    ORDER BY m.created_at DESC`, args:[uid,uid,uid] }).then(rows),
  getMessages:  (uid,oid) => db.execute({ sql:'SELECT m.*,u.avatar as from_avatar FROM messages m JOIN users u ON u.id=m.from_id WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY created_at ASC', args:[uid,oid,oid,uid] }).then(rows),
  sendMessage:  (fid,tid,fn,tn,content) => db.execute({ sql:'INSERT INTO messages (from_id,to_id,from_name,to_name,content) VALUES (?,?,?,?,?)', args:[fid,tid,fn,tn,content] }),
  markRead:     (fid,tid) => db.execute({ sql:'UPDATE messages SET read=1 WHERE from_id=? AND to_id=?', args:[fid,tid] }),
  unreadCount:  (uid) => db.execute({ sql:'SELECT COUNT(*) as count FROM messages WHERE to_id=? AND read=0', args:[uid] }).then(first),
};

module.exports = { db, q, initDB };
