const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// إخبار إكسبريس بمكان الملفات العامة
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/articles', (req, res) => {
    try {
        // استخدام __dirname لضمان الإشارة إلى مجلد المشروع الصحيح في Vercel
        const txtPath = path.join(__dirname, 'public', 'TXT');
        
        console.log("Checking path:", txtPath); // للسجلات في Vercel

        if (fs.existsSync(txtPath)) {
            const files = fs.readdirSync(txtPath);
            const articles = files
                .filter(f => f.endsWith('.txt'))
                .map(f => ({
                    id: f.replace('.txt', ''),
                    title: f.replace('.txt', '').replace(/-/g, ' ')
                }));
            return res.json(articles);
        } else {
            // إذا لم يجد المجلد، يرسل تنبيه في السجلات
            console.error("Directory TXT not found at:", txtPath);
            return res.json([]);
        }
    } catch (e) {
        console.error("Server Error:", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = app;
