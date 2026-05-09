const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// استخدام مسار العمل الحالي لضمان الوصول للمجلدات خارج public
const rootDir = process.cwd();

app.use(express.static(path.join(rootDir, 'public')));
app.use('/TXT', express.static(path.join(rootDir, 'TXT')));
app.use('/PNG', express.static(path.join(rootDir, 'PNG')));

app.get('/api/articles', (req, res) => {
    const txtPath = path.join(rootDir, 'TXT');
    
    // التأكد من وجود المجلد قبل القراءة
    if (!fs.existsSync(txtPath)) {
        return res.json([{ id: 'error', title: 'مجلد TXT غير موجود' }]);
    }

    fs.readdir(txtPath, (err, files) => {
        if (err) return res.status(500).json({ error: "Failed to read" });
        
        const articles = files
            .filter(file => file.endsWith('.txt'))
            .map(file => ({
                id: file.replace('.txt', ''),
                title: file.replace('.txt', '').replace(/-/g, ' ')
            }));
        res.json(articles);
    });
});

// توجيه أي مسار غير معروف لـ index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`System Online: ${PORT}`));
