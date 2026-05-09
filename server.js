const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// إخبار السيرفر أن المجلد العام هو public
app.use(express.static('public'));

app.get('/api/articles', (req, res) => {
    try {
        // المسار الفيزيائي للمجلد TXT داخل public
        const txtPath = path.join(process.cwd(), 'public', 'TXT');
        
        if (fs.existsSync(txtPath)) {
            const files = fs.readdirSync(txtPath);
            const articles = files.filter(f => f.endsWith('.txt')).map(f => ({
                id: f.replace('.txt', ''),
                title: f.replace('.txt', '').replace(/-/g, ' ')
            }));
            return res.json(articles);
        }
        res.json([]);
    } catch (e) {
        res.json([]);
    }
});

// هذا السطر مهم جداً لـ Vercel ليتمكن من تشغيل الملف كدالة
module.exports = app;
