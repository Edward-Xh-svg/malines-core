const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const rootDir = process.cwd();

// خدمة المجلدات مباشرة بدون تعقيد
app.use('/txt', express.static(path.join(rootDir, 'txt')));
app.use('/png', express.static(path.join(rootDir, 'png')));
app.use(express.static(path.join(rootDir, 'public')));

app.get('/api/articles', (req, res) => {
    try {
        const txtPath = path.join(rootDir, 'txt');
        const files = fs.readdirSync(txtPath);
        const articles = files.filter(f => f.endsWith('.txt')).map(f => ({
            id: f.replace('.txt', ''),
            title: f.replace('.txt', '').replace(/-/g, ' ')
        }));
        res.json(articles);
    } catch (e) {
        res.json([]);
    }
});

module.exports = app;
