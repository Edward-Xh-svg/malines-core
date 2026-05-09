const express = require('express');
const path = require('path');
const fs = require('fs'); // مكتبة النظام لقراءة المجلدات
const app = express();
const PORT = process.env.PORT || 3000;

// خدمة الملفات من المجلدات المطلوبة
app.use(express.static(path.join(__dirname, 'public')));
app.use('/TXT', express.static(path.join(__dirname, 'TXT')));
app.use('/PNG', express.static(path.join(__dirname, 'PNG')));

// API لجلب قائمة الملفات من مجلد TXT تلقائياً
app.get('/api/articles', (req, res) => {
    const directoryPath = path.join(__dirname, 'TXT');
    
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            return res.status(500).send('Unable to scan directory');
        }
        // فلترة الملفات التي تنتهي بـ .txt فقط وإرسال أسمائها بدون الصيغة
        const articles = files
            .filter(file => file.endsWith('.txt'))
            .map(file => ({
                id: file.replace('.txt', ''),
                title: file.replace('.txt', '').replace(/-/g, ' ') // تحويل الشرطات لمسافات للعنوان
            }));
        res.json(articles);
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Malines System Active on http://localhost:${PORT}`);
});
