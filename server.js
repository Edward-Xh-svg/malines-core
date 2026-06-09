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

// Clean URLs
app.get('/archive', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wiki.html'));
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Malines server running on port ${PORT}`);
});

module.exports = app;
