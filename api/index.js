const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const rootDir = process.cwd();

// تأكد أن أسماء المجلدات هنا تطابق أسماءها في مشروعك تماماً (حروف صغيرة/كبيرة)
app.use('/png', express.static(path.join(rootDir, 'png'))); 
app.use('/PNG', express.static(path.join(rootDir, 'PNG'))); 
app.use(express.static(path.join(rootDir, 'public')));

app.get('/api/articles', (req, res) => {
    const txtPath = path.join(rootDir, 'txt'); // يفضل أن يكون المجلد اسمه txt
    try {
        const files = fs.readdirSync(txtPath);
        const articles = files.filter(f => f.endsWith('.txt')).map(f => ({
            id: f.replace('.txt', ''),
            title: f.replace('.txt', '').replace(/-/g, ' ')
        }));
        res.json(articles);
    } catch (e) { res.json([]); }
});

app.get('/api/content/:id', (req, res) => {
    const filePath = path.join(rootDir, 'txt', `${req.params.id}.txt`);
    try {
        res.json({ content: fs.readFileSync(filePath, 'utf8') });
    } catch (e) { res.status(404).json({ error: "Not found" }); }
});

module.exports = app;
