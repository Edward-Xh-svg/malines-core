const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const rootDir = process.cwd();

// إعداد الوصول للمجلدات - تأكد من هذه الأسطر
app.use('/TXT', express.static(path.join(rootDir, 'TXT')));
app.use('/PNG', express.static(path.join(rootDir, 'PNG')));
app.use(express.static(path.join(rootDir, 'public')));

app.get('/api/articles', (req, res) => {
    const txtPath = path.join(rootDir, 'TXT');
    try {
        if (!fs.existsSync(txtPath)) return res.json([]);
        
        const files = fs.readdirSync(txtPath);
        const articles = files
            .filter(file => file.endsWith('.txt'))
            .map(file => ({
                id: file.replace('.txt', ''),
                title: file.replace('.txt', '').replace(/-/g, ' ')
            }));
        res.json(articles);
    } catch (err) {
        res.status(500).json({ error: "Read Error" });
    }
});

module.exports = app;
