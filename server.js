const express = require('express');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Performance Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// Also serve TXT and PNG folders as static
app.use('/TXT', express.static(path.join(__dirname, 'TXT'), {
  maxAge: '1d',
  etag: true
}));

app.use('/PNG', express.static(path.join(__dirname, 'PNG'), {
  maxAge: '1d',
  etag: true
}));

// Parse JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API: Scan TXT/ and PNG/ folders and return articles list
app.get('/api/articles', async (req, res) => {
  try {
    const txtDir = path.join(__dirname, 'TXT');
    const pngDir = path.join(__dirname, 'PNG');

    // Check if directories exist
    let txtFiles = [];
    let pngFiles = [];

    try {
      const txtExists = await stat(txtDir);
      if (txtExists.isDirectory()) {
        txtFiles = await readdir(txtDir);
      }
    } catch (e) {
      // TXT folder doesn't exist
    }

    try {
      const pngExists = await stat(pngDir);
      if (pngExists.isDirectory()) {
        pngFiles = await readdir(pngDir);
      }
    } catch (e) {
      // PNG folder doesn't exist
    }

    // Filter only .txt and .png files
    txtFiles = txtFiles.filter(f => f.endsWith('.txt'));
    pngFiles = pngFiles.filter(f => f.endsWith('.png'));

    // Match files by name (without extension)
    const articles = [];
    let id = 1;

    for (const txtFile of txtFiles) {
      const baseName = txtFile.replace('.txt', '');
      const pngFile = baseName + '.png';
      const hasImage = pngFiles.includes(pngFile);

      // Read first few lines for excerpt
      let content = '';
      let title = baseName.replace(/-/g, ' ').replace(/_/g, ' ');
      let excerpt = '';

      try {
        const filePath = path.join(txtDir, txtFile);
        const fileContent = await readFile(filePath, 'utf-8');
        const lines = fileContent.split('\n').filter(line => line.trim());

        // First non-empty line is title if it starts with #
        if (lines.length > 0 && lines[0].startsWith('#')) {
          title = lines[0].replace('#', '').trim();
          content = lines.slice(1).join('\n');
        } else {
          content = fileContent;
        }

        // Create excerpt from first 150 chars
        excerpt = content.replace(/\n/g, ' ').substring(0, 150).trim();
        if (content.length > 150) excerpt += '...';

      } catch (e) {
        console.error('Error reading file:', txtFile, e.message);
        continue;
      }

      // Get file stats for date
      let date = new Date().toISOString().split('T')[0];
      try {
        const fileStat = await stat(path.join(txtDir, txtFile));
        date = fileStat.mtime.toISOString().split('T')[0];
      } catch (e) {
        // Use current date
      }

      // Determine tag from filename or content
      let tag = 'عام';
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('تحديث') || lowerTitle.includes('update')) tag = 'تحديثات';
      else if (lowerTitle.includes('دليل') || lowerTitle.includes('guide')) tag = 'دليل';
      else if (lowerTitle.includes('بطولة') || lowerTitle.includes('tournament')) tag = 'بطولات';
      else if (lowerTitle.includes('أخبار') || lowerTitle.includes('news')) tag = 'أخبار';
      else if (lowerTitle.includes('شرح') || lowerTitle.includes('tutorial')) tag = 'شروحات';

      articles.push({
        id: id++,
        title: title,
        excerpt: excerpt,
        content: content,
        tag: tag,
        date: date,
        readTime: Math.max(1, Math.ceil(content.length / 1000)),
        hasImage: hasImage,
        imagePath: hasImage ? `PNG/${pngFile}` : null,
        txtPath: `TXT/${txtFile}`
      });
    }

    // Sort by date (newest first)
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(articles);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to load articles', message: error.message });
  }
});

// API: Get single article content
app.get('/api/articles/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(__dirname, 'TXT', filename + '.txt');
    const content = await readFile(filePath, 'utf-8');

    res.json({ content });
  } catch (error) {
    res.status(404).json({ error: 'Article not found' });
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/wiki', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wiki.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    service: 'Malines Community'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Malines Community server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Serving articles from TXT/ and PNG/ folders`);
});

module.exports = app;
