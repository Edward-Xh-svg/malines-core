const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

// API: get articles list
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

// صفحات الخدمات الجديدة (روابط نظيفة)
app.get('/hostaka', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hostaka.html'));
});

app.get('/stock', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stock.html'));
});

app.get('/records', (req, res) => {   // سجلات الدول
  res.sendFile(path.join(__dirname, 'public', 'ssc.html'));
});

app.get('/council', (req, res) => {   // المنتدى الدولي
  res.sendFile(path.join(__dirname, 'public', 'csc.html'));
});

// رابط الأرشيف النظيف (كان موجوداً بالفعل)
app.get('/archive', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wiki.html'));
});

// مسار SPA العام (يجب أن يكون آخر مسار)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Malines server running on port ${PORT}`);
});

module.exports = app;