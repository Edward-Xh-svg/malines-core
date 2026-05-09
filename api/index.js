const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// المسارات
const rootDir = process.cwd();

// خدمة الملفات الثابتة
app.use('/TXT', express.static(path.join(rootDir, 'TXT')));
app.use('/PNG', express.static(path.join(rootDir, 'PNG')));
app.use(express.static(path.join(rootDir, 'public')));

app.get('/api/articles', (req, res) => {
    const txtPath = path.join(rootDir, 'TXT');
    
    try {
        if (!fs.existsSync(txtPath)) {
            return res.status(404).json({ error: "Directory not found" });
        }

        const files = fs.readdirSync(txtPath);
        const articles = files
            .filter(file => file.endsWith('.txt'))
            .map(file => ({
                id: file.replace('.txt', ''),
                title: file.replace('.txt', '').replace(/-/g, ' ')
            }));
            
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(articles);
    } catch (err) {
        res.status(500).json({ error: "Server Error", details: err.message });
    }
});

// تصدير التطبيق لـ Vercel
module.exports = app;
