const express  = require('express');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { q, initDB } = require('./database');

const app = express();
app.use(express.json({ limit: '15mb' }));
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
    res.json({ success: true, token, username: user.username, role: user.role, avatar: user.avatar || '' });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password)
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    if (password.length < 6)
      return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
    const hash = bcrypt.hashSync(password, 10);
    const result = await q.createUser(username.trim(), email.trim().toLowerCase(), hash);
    const user = { id: Number(result.lastInsertRowid), username: username.trim(), role: 'user', avatar: '' };
    const token = createSession(user);
    res.json({ success: true, token, username: user.username, role: user.role, avatar: '' });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'البريد أو اسم المستخدم مستخدم مسبقاً' });
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const user = await q.getUserById(req.session.userId);
    res.json(user || { username: req.session.username, role: req.session.role });
  } catch(e) { res.json({ username: req.session.username, role: req.session.role }); }
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  sessions.delete(token);
  res.json({ success: true });
});

// ==================== Profile ====================
app.get('/api/profile/:username', async (req, res) => {
  try {
    const user = await q.getPublicProfile(req.params.username);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json(user);
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const { display_name, bio, game_id, avatar } = req.body || {};
    await q.updateProfile(display_name||'', bio||'', game_id||'', avatar||'', req.session.userId);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== imgbb Upload ====================
app.post('/api/upload', requireAuth, async (req, res) => {
  try {
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ error: 'لا توجد صورة' });

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'IMGBB_API_KEY غير مُعدّ' });

    // imgbb يقبل base64 بدون الـ prefix (data:image/...;base64,)
    const base64 = image.includes(',') ? image.split(',')[1] : image;

    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('image', base64);

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (!data.success) return res.status(500).json({ error: 'فشل الرفع على imgbb' });
    res.json({ url: data.data.url });
  } catch(e) { res.status(500).json({ error: 'خطأ في الرفع: ' + e.message }); }
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
    await q.updateArticle(title.trim(), category||'عام', content, image||'', published?1:0, req.params.slug);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.delete('/api/admin/articles/:slug', requireAdmin, async (req, res) => {
  try {
    await q.deleteArticle(req.params.slug);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Countries ====================
app.get('/api/nbn/list', async (req, res) => {
  try {
    const r = await q.listByType('council');
    res.json(r.map(x => x.name));
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.get('/api/nbn/data/:name', async (req, res) => {
  try {
    const c = await q.getCountryByName(req.params.name);
    if (!c) return res.status(404).json({ error: 'الدولة غير موجودة' });
    res.json({ council_data: c.council_data, description: c.description });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.get('/api/inc/list', async (req, res) => {
  try {
    const r = await q.listByType('stock');
    res.json(r.map(x => x.name));
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.get('/api/inc/data/:name', async (req, res) => {
  try {
    const c = await q.getCountryByName(req.params.name);
    if (!c) return res.status(404).json({ error: 'الدولة غير موجودة' });
    const companies = await q.getCompaniesByCountry(c.id);
    res.json({
      companies: companies.map((x,i) => ({ index: i+1, value: x.name, id: x.id })),
      values:    companies.map((x,i) => ({ index: i+1, value: x.market_value })),
      growth:    companies.map((x,i) => ({ index: i+1, value: x.growth })),
    });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Admin: Countries ====================
app.get('/api/admin/countries', requireAdmin, async (req, res) => {
  try {
    const countries = await q.listCountries();
    const result = await Promise.all(countries.map(async c => ({
      ...c, companies: await q.getCompaniesByCountry(c.id)
    })));
    res.json(result);
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.post('/api/admin/countries', requireAdmin, async (req, res) => {
  try {
    const { name, flag, description, type, council_data } = req.body || {};
    if (!name) return res.status(400).json({ error: 'اسم الدولة مطلوب' });
    const r = await q.createCountry(name.trim(), flag||'', description||'', type||'both', council_data||'');
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'اسم الدولة مستخدم مسبقاً' });
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

app.put('/api/admin/countries/:id', requireAdmin, async (req, res) => {
  try {
    const { name, flag, description, type, council_data } = req.body || {};
    if (!name) return res.status(400).json({ error: 'اسم الدولة مطلوب' });
    await q.updateCountry(name.trim(), flag||'', description||'', type||'both', council_data||'', req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.delete('/api/admin/countries/:id', requireAdmin, async (req, res) => {
  try {
    await q.deleteCountry(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Admin: Companies ====================
app.post('/api/admin/companies', requireAdmin, async (req, res) => {
  try {
    const { country_id, name, market_value, growth, sort_order } = req.body || {};
    if (!country_id || !name) return res.status(400).json({ error: 'البيانات ناقصة' });
    const r = await q.createCompany(country_id, name.trim(), market_value||'0', growth||'0%', sort_order||0);
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.put('/api/admin/companies/:id', requireAdmin, async (req, res) => {
  try {
    const { name, market_value, growth, sort_order } = req.body || {};
    if (!name) return res.status(400).json({ error: 'اسم الشركة مطلوب' });
    await q.updateCompany(name.trim(), market_value||'0', growth||'0%', sort_order||0, req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.delete('/api/admin/companies/:id', requireAdmin, async (req, res) => {
  try {
    await q.deleteCompany(req.params.id);
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
    await q.deleteUser(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Records (منتدى) ====================
app.get('/api/records', async (req, res) => {
  try { res.json(await q.listRecords()); }
  catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// أي مستخدم مسجل يمكنه النشر
app.post('/api/records', requireAuth, async (req, res) => {
  try {
    const { content, image } = req.body || {};
    if (!content?.trim()) return res.status(400).json({ error: 'المحتوى مطلوب' });
    const user = await q.getUserById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const publisher   = user.display_name || user.username;
    const user_role   = user.role === 'admin' ? 'Admin' : 'Member';
    const user_avatar = user.avatar || '';
    const r = await q.createRecord(user.id, publisher, user_role, user_avatar, content.trim(), image||'');
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// حذف سجل: Admin يحذف أي شيء، المستخدم يحذف منشوراته فقط
app.delete('/api/records/:id', requireAuth, async (req, res) => {
  try {
    const records = await q.listRecords();
    const record = records.find(r => r.id == req.params.id);
    if (!record) return res.status(404).json({ error: 'السجل غير موجود' });
    if (req.session.role !== 'admin' && record.user_id !== req.session.userId)
      return res.status(403).json({ error: 'غير مسموح' });
    await q.deleteRecord(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Pages ====================
app.get('/admin',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/wiki',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'wiki.html')));
app.get('/archive', (req, res) => res.sendFile(path.join(__dirname, 'public', 'wiki.html')));
app.get('/stock',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'stock.html')));
app.get('/council', (req, res) => res.sendFile(path.join(__dirname, 'public', 'council.html')));
app.get('/records', (req, res) => res.sendFile(path.join(__dirname, 'public', 'records.html')));
app.get('/hostaka', (req, res) => res.sendFile(path.join(__dirname, 'public', 'hostaka.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('*',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
initDB()
  .then(() => app.listen(PORT, () => console.log(`🚀 Malines on port ${PORT}`)))
  .catch(err => { console.error('❌ DB init failed:', err); process.exit(1); });

module.exports = app;
