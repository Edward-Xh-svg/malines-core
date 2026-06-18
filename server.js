const express  = require('express');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { q, initDB } = require('./database');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== Sessions ====================
const sessions = new Map();

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, role: user.role, username: user.username });
  setTimeout(() => sessions.delete(token), 7 * 24 * 60 * 60 * 1000);
  return token;
}
function getSession(req) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  return token ? sessions.get(token) : null;
}
function requireAuth(req, res, next) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'غير مصرح' });
  req.session = s; next();
}
function requireAdmin(req, res, next) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'غير مصرح' });
  if (s.role !== 'admin') return res.status(403).json({ error: 'تحتاج صلاحية admin' });
  req.session = s; next();
}

// ==================== Auth ====================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'البريد وكلمة المرور مطلوبان' });
    const user = await q.getUserByEmail(email.trim().toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
    const token = createSession(user);
    res.json({ success: true, token, username: user.username, role: user.role });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password)
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    if (password.length < 6)
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    const hash = bcrypt.hashSync(password, 10);
    const result = await q.createUser(username.trim(), email.trim().toLowerCase(), hash, 'user');
    const user = { id: Number(result.lastInsertRowid), username: username.trim(), role: 'user' };
    const token = createSession(user);
    res.json({ success: true, token, username: user.username, role: user.role });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'البريد أو اسم المستخدم مستخدم مسبقاً' });
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ username: req.session.username, role: req.session.role });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  sessions.delete(token);
  res.json({ success: true });
});

// ==================== Articles ====================
app.get('/api/articles', async (req, res) => {
  try { res.json(await q.listPublished()); }
  catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.get('/api/admin/articles', requireAdmin, async (req, res) => {
  try { res.json(await q.listArticles()); }
  catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.get('/api/articles/:slug', async (req, res) => {
  try {
    const article = await q.getArticle(req.params.slug);
    if (!article) return res.status(404).json({ error: 'المقال غير موجود' });
    if (!article.published && getSession(req)?.role !== 'admin')
      return res.status(404).json({ error: 'المقال غير موجود' });
    res.json(article);
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.post('/api/admin/articles', requireAdmin, async (req, res) => {
  try {
    const { slug, title, category, content, image, published } = req.body || {};
    if (!slug || !title || !content)
      return res.status(400).json({ error: 'slug والعنوان والمحتوى مطلوبة' });
    await q.createArticle(slug.trim(), title.trim(), category||'عام', content, image||'', published?1:0, req.session.userId);
    res.json({ success: true, slug: slug.trim() });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'slug مستخدم مسبقاً' });
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

app.put('/api/admin/articles/:slug', requireAdmin, async (req, res) => {
  try {
    const { title, category, content, image, published } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: 'العنوان والمحتوى مطلوبان' });
    const result = await q.updateArticle(title.trim(), category||'عام', content, image||'', published?1:0, req.params.slug);
    if (!result.rowsAffected) return res.status(404).json({ error: 'المقال غير موجود' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.delete('/api/admin/articles/:slug', requireAdmin, async (req, res) => {
  try {
    const result = await q.deleteArticle(req.params.slug);
    if (!result.rowsAffected) return res.status(404).json({ error: 'المقال غير موجود' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Countries ====================
app.get('/api/nbn/list', async (req, res) => {
  try {
    const rows = await q.listByType('council');
    res.json(rows.map(r => r.name));
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.get('/api/nbn/data/:name', async (req, res) => {
  try {
    const country = await q.getCountryByName(req.params.name);
    if (!country) return res.status(404).json({ error: 'الدولة غير موجودة' });
    res.json({ council_data: country.council_data, description: country.description });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.get('/api/inc/list', async (req, res) => {
  try {
    const rows = await q.listByType('stock');
    res.json(rows.map(r => r.name));
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.get('/api/inc/data/:name', async (req, res) => {
  try {
    const country = await q.getCountryByName(req.params.name);
    if (!country) return res.status(404).json({ error: 'الدولة غير موجودة' });
    const companies = await q.getCompaniesByCountry(country.id);
    res.json({
      companies: companies.map((c,i) => ({ index: i+1, value: c.name, id: c.id })),
      values:    companies.map((c,i) => ({ index: i+1, value: c.market_value })),
      growth:    companies.map((c,i) => ({ index: i+1, value: c.growth })),
    });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Admin: Countries ====================
app.get('/api/admin/countries', requireAdmin, async (req, res) => {
  try {
    const countries = await q.listCountries();
    const result = await Promise.all(
      countries.map(async c => ({
        ...c,
        companies: await q.getCompaniesByCountry(c.id)
      }))
    );
    res.json(result);
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.post('/api/admin/countries', requireAdmin, async (req, res) => {
  try {
    const { name, flag, description, type, council_data } = req.body || {};
    if (!name) return res.status(400).json({ error: 'اسم الدولة مطلوب' });
    const result = await q.createCountry(name.trim(), flag||'', description||'', type||'both', council_data||'');
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'اسم الدولة مستخدم مسبقاً' });
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

app.put('/api/admin/countries/:id', requireAdmin, async (req, res) => {
  try {
    const { name, flag, description, type, council_data } = req.body || {};
    if (!name) return res.status(400).json({ error: 'اسم الدولة مطلوب' });
    const result = await q.updateCountry(name.trim(), flag||'', description||'', type||'both', council_data||'', req.params.id);
    if (!result.rowsAffected) return res.status(404).json({ error: 'الدولة غير موجودة' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.delete('/api/admin/countries/:id', requireAdmin, async (req, res) => {
  try {
    const result = await q.deleteCountry(req.params.id);
    if (!result.rowsAffected) return res.status(404).json({ error: 'الدولة غير موجودة' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Admin: Companies ====================
app.post('/api/admin/companies', requireAdmin, async (req, res) => {
  try {
    const { country_id, name, market_value, growth, sort_order } = req.body || {};
    if (!country_id || !name) return res.status(400).json({ error: 'country_id واسم الشركة مطلوبان' });
    const result = await q.createCompany(country_id, name.trim(), market_value||'0', growth||'0%', sort_order||0);
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.put('/api/admin/companies/:id', requireAdmin, async (req, res) => {
  try {
    const { name, market_value, growth, sort_order } = req.body || {};
    if (!name) return res.status(400).json({ error: 'اسم الشركة مطلوب' });
    const result = await q.updateCompany(name.trim(), market_value||'0', growth||'0%', sort_order||0, req.params.id);
    if (!result.rowsAffected) return res.status(404).json({ error: 'الشركة غير موجودة' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.delete('/api/admin/companies/:id', requireAdmin, async (req, res) => {
  try {
    const result = await q.deleteCompany(req.params.id);
    if (!result.rowsAffected) return res.status(404).json({ error: 'الشركة غير موجودة' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Admin: Users ====================
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try { res.json(await q.listUsers()); }
  catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!['user','admin'].includes(role)) return res.status(400).json({ error: 'role غير صحيح' });
    await q.updateUserRole(role, req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const result = await q.deleteUser(req.params.id);
    if (!result.rowsAffected) return res.status(404).json({ error: 'المستخدم غير موجود أو هو admin' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Records ====================
app.get('/api/records', async (req, res) => {
  try { res.json(await q.listRecords()); }
  catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.post('/api/admin/records', requireAdmin, async (req, res) => {
  try {
    const { publisher, content, image } = req.body || {};
    if (!publisher || !content) return res.status(400).json({ error: 'الناشر والمحتوى مطلوبان' });
    const result = await q.createRecord(publisher.trim(), content.trim(), image||'');
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.delete('/api/admin/records/:id', requireAdmin, async (req, res) => {
  try {
    const result = await q.deleteRecord(req.params.id);
    if (!result.rowsAffected) return res.status(404).json({ error: 'السجل غير موجود' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Pages ====================
app.get('/admin',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==================== Start ====================
const PORT = process.env.PORT || 3000;
initDB()
  .then(() => app.listen(PORT, () => console.log(`🚀 Malines on port ${PORT}`)))
  .catch(err => { console.error('❌ فشل تهيئة قاعدة البيانات:', err); process.exit(1); });

module.exports = app;
