const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware لقراءة JSON من الطلبات (مطلوب لتسجيل الدخول)
app.use(express.json());

// خدمة الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// -------------------- API Routes --------------------

// قائمة مقالات الأرشيف (كما هي)
app.get('/api/articles', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'articles.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.send(data);
    } catch (e) {
      res.status(500).json({ error: 'Failed to read articles' });
    }
  } else {
    res.json([]);
  }
});

// قائمة الدول لسجلات الدول (council) من مجلد NBN/NB
app.get('/api/nbn/list', (req, res) => {
  const nbDir = path.join(__dirname, 'public', 'NBN', 'NB');
  if (!fs.existsSync(nbDir)) {
    return res.json([]);
  }
  try {
    const files = fs.readdirSync(nbDir);
    const countries = files
      .filter(file => file.endsWith('.txt'))
      .map(file => file.replace(/\.txt$/, ''));
    res.json(countries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read countries' });
  }
});

// قائمة الدول لبورصة هوستاكا (stock) من مجلد INC/IO
app.get('/api/inc/list', (req, res) => {
  const ioDir = path.join(__dirname, 'public', 'INC', 'IO');
  if (!fs.existsSync(ioDir)) {
    return res.json([]);
  }
  try {
    const files = fs.readdirSync(ioDir);
    const countries = files
      .filter(file => file.endsWith('.txt'))
      .map(file => file.replace(/\.txt$/, ''));
    res.json(countries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read countries' });
  }
});

// بيانات بورصة دولة محددة (الشركات، القيم السوقية، النمو)
app.get('/api/inc/data/:country', (req, res) => {
  const country = req.params.country;
  const baseDir = path.join(__dirname, 'public', 'INC');
  const ioPath = path.join(baseDir, 'IO', `${country}.txt`);
  const inPath = path.join(baseDir, 'IN', `${country}.txt`);
  const ifPath = path.join(baseDir, 'IF', `${country}.txt`);

  if (!fs.existsSync(ioPath)) {
    return res.status(404).json({ error: 'Country not found' });
  }

  const readLines = (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').filter(line => line.trim() && line.match(/^\d+\s*-\s*.+/));
  };

  const ioLines = readLines(ioPath);
  const inLines = readLines(inPath);
  const ifLines = readLines(ifPath);

  const parseLine = (line) => {
    const match = line.match(/^(\d+)\s*-\s*(.+)$/);
    if (!match) return null;
    return { index: parseInt(match[1]), value: match[2].trim() };
  };

  const companies = ioLines.map(parseLine).filter(c => c);
  const values = inLines.map(parseLine).filter(v => v);
  const growth = ifLines.map(parseLine).filter(g => g);

  res.json({ companies, values, growth });
});

// -------------------- Clean URLs (الصفحات الرئيسية) --------------------

app.get('/archive', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wiki.html'));
});

app.get('/hostaka', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hostaka.html'));
});

app.get('/stock', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stock.html'));
});

app.get('/council', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'council.html'));
});

app.get('/records', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'records.html'));
});

// -------------------- SPA Fallback (يجب أن يكون آخر مسار) --------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------- تشغيل الخادم --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Malines server running on port ${PORT}`);
});

module.exports = app;
