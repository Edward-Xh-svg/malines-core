const express = require('express');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const { q, initDB } = require('./database');

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== Sessions (Turso) ====================
async function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  // SQLite datetime format: "YYYY-MM-DD HH:MM:SS"
  const expires = new Date(Date.now() + 7*24*60*60*1000)
    .toISOString().replace('T',' ').slice(0,19);
  await q.createSession(token, user.id, user.username, user.role, expires);
  return token;
}

async function getSession(req) {
  const token = (req.headers['authorization'] || '').replace('Bearer ','').trim();
  if (!token) return null;
  return await q.getSession(token);
}

async function requireAuth(req, res, next) {
  const s = await getSession(req);
  if (!s) return res.status(401).json({ error: 'غير مصرح — سجّل دخولك' });
  req.session = s;
  next();
}

async function requireAdmin(req, res, next) {
  const s = await getSession(req);
  if (!s) return res.status(401).json({ error: 'غير مصرح' });
  if (s.role !== 'admin') return res.status(403).json({ error: 'تحتاج صلاحية admin' });
  req.session = s;
  next();
}

// ==================== Auth ====================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'البريد وكلمة المرور مطلوبان' });
    const user = await q.getUserByEmail(email.trim().toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
    const token = await createSession(user);
    res.json({ success:true, token, username:user.username, role:user.role, avatar:user.avatar||'' });
  } catch(e) { console.error(e); res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    if (password.length < 6) return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
    const hash = bcrypt.hashSync(password, 10);
    const result = await q.createUser(username.trim(), email.trim().toLowerCase(), hash);
    const user = { id: Number(result.lastInsertRowid), username: username.trim(), role:'user', avatar:'' };
    const token = await createSession(user);
    res.json({ success:true, token, username:user.username, role:user.role, avatar:'' });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'البريد أو اسم المستخدم مستخدم مسبقاً' });
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

app.get('/api/me', async (req, res) => {
  try {
    const s = await getSession(req);
    if (!s) return res.status(401).json({ error: 'غير مصرح' });
    const user = await q.getUserById(s.user_id);
    res.json(user || { username:s.username, role:s.role });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.post('/api/logout', async (req, res) => {
  try {
    const token = (req.headers['authorization']||'').replace('Bearer ','').trim();
    if (token) await q.deleteSession(token);
    res.json({ success:true });
  } catch(e) { res.json({ success:true }); }
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
    await q.updateProfile(display_name||'', bio||'', game_id||'', avatar||'', req.session.user_id);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ==================== Upload (imgbb) ====================
app.post('/api/upload', requireAuth, async (req, res) => {
  try {
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ error: 'لا توجد صورة' });
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'IMGBB_API_KEY غير مُعدّ' });
    const base64 = image.includes(',') ? image.split(',')[1] : image;
    const form = new URLSearchParams();
    form.append('key', apiKey);
    form.append('image', base64);
    const r = await fetch('https://api.imgbb.com/1/upload', { method:'POST', body:form });
    const data = await r.json();
    if (!data.success) return res.status(500).json({ error: 'فشل الرفع' });
    res.json({ url: data.data.url });
  } catch(e) { res.status(500).json({ error: 'خطأ: '+e.message }); }
});

// ==================== Articles ====================
app.get('/api/articles', async (req, res) => {
  try { res.json(await q.listPublished()); } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.get('/api/admin/articles', requireAdmin, async (req, res) => {
  try { res.json(await q.listArticles()); } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.get('/api/articles/:slug', async (req, res) => {
  try {
    const a = await q.getArticle(req.params.slug);
    if (!a) return res.status(404).json({ error:'غير موجود' });
    const s = await getSession(req);
    if (!a.published && s?.role !== 'admin') return res.status(404).json({ error:'غير موجود' });
    res.json(a);
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.post('/api/admin/articles', requireAdmin, async (req, res) => {
  try {
    const { slug,title,category,content,image,published } = req.body||{};
    if (!slug||!title||!content) return res.status(400).json({ error:'بيانات ناقصة' });
    await q.createArticle(slug.trim(),title.trim(),category||'عام',content,image||'',published?1:0,req.session.user_id);
    res.json({ success:true });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error:'slug مستخدم مسبقاً' });
    res.status(500).json({ error:'خطأ' });
  }
});
app.put('/api/admin/articles/:slug', requireAdmin, async (req, res) => {
  try {
    const { title,category,content,image,published } = req.body||{};
    await q.updateArticle(title,category||'عام',content,image||'',published?1:0,req.params.slug);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.delete('/api/admin/articles/:slug', requireAdmin, async (req, res) => {
  try { await q.deleteArticle(req.params.slug); res.json({ success:true }); }
  catch(e) { res.status(500).json({ error:'خطأ' }); }
});

// ==================== Countries ====================
app.get('/api/nbn/list', async (req, res) => {
  try { res.json((await q.listByType('council')).map(x=>x.name)); } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.get('/api/nbn/data/:name', async (req, res) => {
  try {
    const c = await q.getCountryByName(req.params.name);
    if (!c) return res.status(404).json({ error:'غير موجود' });
    res.json({ council_data:c.council_data, description:c.description });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.get('/api/inc/list', async (req, res) => {
  try { res.json((await q.listByType('stock')).map(x=>x.name)); } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.get('/api/inc/data/:name', async (req, res) => {
  try {
    const c = await q.getCountryByName(req.params.name);
    if (!c) return res.status(404).json({ error:'غير موجود' });
    const cos = await q.getCompaniesByCountry(c.id);
    res.json({
      companies: cos.map((x,i)=>({index:i+1,value:x.name,id:x.id})),
      values:    cos.map((x,i)=>({index:i+1,value:x.market_value})),
      growth:    cos.map((x,i)=>({index:i+1,value:x.growth})),
    });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.get('/api/admin/countries', requireAdmin, async (req, res) => {
  try {
    const cs = await q.listCountries();
    res.json(await Promise.all(cs.map(async c=>({...c, companies:await q.getCompaniesByCountry(c.id)}))));
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.post('/api/admin/countries', requireAdmin, async (req, res) => {
  try {
    const { name,flag,description,type,council_data } = req.body||{};
    if (!name) return res.status(400).json({ error:'الاسم مطلوب' });
    const r = await q.createCountry(name.trim(),flag||'',description||'',type||'both',council_data||'');
    res.json({ success:true, id:Number(r.lastInsertRowid) });
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error:'الاسم مستخدم' });
    res.status(500).json({ error:'خطأ' });
  }
});
app.put('/api/admin/countries/:id', requireAdmin, async (req, res) => {
  try {
    const { name,flag,description,type,council_data } = req.body||{};
    await q.updateCountry(name,flag||'',description||'',type||'both',council_data||'',req.params.id);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.delete('/api/admin/countries/:id', requireAdmin, async (req, res) => {
  try { await q.deleteCountry(req.params.id); res.json({ success:true }); }
  catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.post('/api/admin/companies', requireAdmin, async (req, res) => {
  try {
    const { country_id,name,market_value,growth,sort_order } = req.body||{};
    const r = await q.createCompany(country_id,name.trim(),market_value||'0',growth||'0%',sort_order||0);
    res.json({ success:true, id:Number(r.lastInsertRowid) });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.put('/api/admin/companies/:id', requireAdmin, async (req, res) => {
  try {
    const { name,market_value,growth,sort_order } = req.body||{};
    await q.updateCompany(name,market_value||'0',growth||'0%',sort_order||0,req.params.id);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.delete('/api/admin/companies/:id', requireAdmin, async (req, res) => {
  try { await q.deleteCompany(req.params.id); res.json({ success:true }); }
  catch(e) { res.status(500).json({ error:'خطأ' }); }
});

// ==================== Admin: Users ====================
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try { res.json(await q.listUsers()); } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body||{};
    if (!['user','admin'].includes(role)) return res.status(400).json({ error:'role غير صحيح' });
    await q.updateUserRole(role, req.params.id);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try { await q.deleteUser(req.params.id); res.json({ success:true }); }
  catch(e) { res.status(500).json({ error:'خطأ' }); }
});

// ==================== Records ====================
app.get('/api/records', async (req, res) => {
  try {
    const records = await q.listRecords();
    const enriched = await Promise.all(records.map(async r => {
      const [reactions, comments] = await Promise.all([
        q.getReactions(r.id),
        q.getComments(r.id),
      ]);
      return { ...r, reactions, comments };
    }));
    res.json(enriched);
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});

app.post('/api/records', requireAuth, async (req, res) => {
  try {
    const { content, image } = req.body||{};
    if (!content?.trim()) return res.status(400).json({ error:'المحتوى مطلوب' });
    const user = await q.getUserById(req.session.user_id);
    if (!user) return res.status(404).json({ error:'المستخدم غير موجود' });
    const publisher   = user.display_name || user.username;
    const user_role   = user.role === 'admin' ? 'Admin' : 'Member';
    const user_avatar = user.avatar || '';
    const r = await q.createRecord(user.id, publisher, user_role, user_avatar, content.trim(), image||'');
    res.json({ success:true, id:Number(r.lastInsertRowid) });
  } catch(e) { res.status(500).json({ error:'خطأ: '+e.message }); }
});

app.delete('/api/records/:id', requireAuth, async (req, res) => {
  try {
    const record = await q.getRecord(req.params.id);
    if (!record) return res.status(404).json({ error:'غير موجود' });
    if (req.session.role !== 'admin' && record.user_id != req.session.user_id)
      return res.status(403).json({ error:'غير مسموح' });
    await q.deleteRecord(req.params.id);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});

// ── Reactions ──
app.post('/api/records/:id/react', requireAuth, async (req, res) => {
  try {
    const { emoji } = req.body||{};
    const existing = await q.getUserReaction(req.params.id, req.session.user_id);
    if (existing && existing.emoji === emoji) {
      await q.removeReaction(req.params.id, req.session.user_id);
    } else {
      await q.addReaction(req.params.id, req.session.user_id, emoji||'like');
    }
    const reactions = await q.getReactions(req.params.id);
    const userReaction = await q.getUserReaction(req.params.id, req.session.user_id);
    res.json({ success:true, reactions, userReaction: userReaction?.emoji||null });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});

// ── Comments ──
app.get('/api/records/:id/comments', async (req, res) => {
  try { res.json(await q.getComments(req.params.id)); }
  catch(e) { res.status(500).json({ error:'خطأ' }); }
});

app.post('/api/records/:id/comments', requireAuth, async (req, res) => {
  try {
    const { content } = req.body||{};
    if (!content?.trim()) return res.status(400).json({ error:'التعليق فارغ' });
    const user = await q.getUserById(req.session.user_id);
    const user_role = user.role === 'admin' ? 'Admin' : 'Member';
    await q.addComment(req.params.id, user.id, user.username, user.display_name||'', user.avatar||'', user_role, content.trim());
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});

app.delete('/api/comments/:id', requireAuth, async (req, res) => {
  try {
    await q.deleteComment(req.params.id, req.session.user_id, req.session.role);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});

// ==================== Messages ====================
app.get('/api/messages/conversations', requireAuth, async (req, res) => {
  try { res.json(await q.getConversations(req.session.user_id)); }
  catch(e) { res.status(500).json({ error:'خطأ' }); }
});

app.get('/api/messages/:username', requireAuth, async (req, res) => {
  try {
    const other = await q.getPublicProfile(req.params.username);
    if (!other) return res.status(404).json({ error:'المستخدم غير موجود' });
    await q.markRead(other.id, req.session.user_id);
    res.json(await q.getMessages(req.session.user_id, other.id));
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});

app.post('/api/messages/:username', requireAuth, async (req, res) => {
  try {
    const { content } = req.body||{};
    if (!content?.trim()) return res.status(400).json({ error:'الرسالة فارغة' });
    const other = await q.getPublicProfile(req.params.username);
    if (!other) return res.status(404).json({ error:'المستخدم غير موجود' });
    const me = await q.getUserById(req.session.user_id);
    await q.sendMessage(me.id, other.id, me.display_name||me.username, other.display_name||other.username, content.trim());
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:'خطأ' }); }
});

app.get('/api/messages/unread', requireAuth, async (req, res) => {
  try { res.json(await q.unreadCount(req.session.user_id)); }
  catch(e) { res.status(500).json({ error:'خطأ' }); }
});

app.get('/api/users/search', requireAuth, async (req, res) => {
  try { res.json(await q.searchUsers(req.query.q||'')); }
  catch(e) { res.status(500).json({ error:'خطأ' }); }
});

// ==================== Pages ====================
app.get('/admin',   (_, res) => res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('/wiki',    (_, res) => res.sendFile(path.join(__dirname,'public','wiki.html')));
app.get('/archive', (_, res) => res.sendFile(path.join(__dirname,'public','wiki.html')));
app.get('/stock',   (_, res) => res.sendFile(path.join(__dirname,'public','stock.html')));
app.get('/council', (_, res) => res.sendFile(path.join(__dirname,'public','council.html')));
app.get('/records', (_, res) => res.sendFile(path.join(__dirname,'public','records.html')));
app.get('/hostaka', (_, res) => res.sendFile(path.join(__dirname,'public','hostaka.html')));
app.get('/profile', (_, res) => res.sendFile(path.join(__dirname,'public','profile.html')));
app.get('/chat',    (_, res) => res.sendFile(path.join(__dirname,'public','chat.html')));
app.get('*',        (_, res) => res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT || 3000;
initDB()
  .then(() => app.listen(PORT, () => console.log(`🚀 Malines on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });

module.exports = app;
