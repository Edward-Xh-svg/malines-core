const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const rootDir = process.cwd();

// خدمة الصور فقط بشكل مباشر
app.use('/PNG', express.static(path.join(rootDir, 'PNG')));
app.use(express.static(path.join(rootDir, 'public')));

// 1. جلب قائمة الملفات
app.get('/api/articles', (req, res) => {
    const txtPath = path.join(rootDir, 'TXT');
    try {
        if (!fs.existsSync(txtPath)) return res.json([]);
        const files = fs.readdirSync(txtPath);
        const articles = files
            .filter(file => file.endsWith('.txt'))
            .map(file => ({ id: file.replace('.txt', ''), title: file.replace('.txt', '').replace(/-/g, ' ') }));
        res.json(articles);
    } catch (err) { res.status(500).send("Err"); }
});

// 2. مسار جديد لجلب محتوى النص (حل مشكلة فك التشفير)
app.get('/api/content/:id', (req, res) => {
    const filePath = path.join(rootDir, 'TXT', `${req.params.id}.txt`);
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            res.json({ content });
        } else {
            res.status(404).json({ error: "File not found" });
        }
    } catch (err) { res.status(500).json({ error: "Read error" }); }
});

module.exports = app;
