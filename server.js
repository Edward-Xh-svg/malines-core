const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// خدمة الملفات الثابتة من مجلد public و المجلدات الأخرى
app.use(express.static(path.join(__dirname, 'public')));
app.use('/TXT', express.static(path.join(__dirname, 'TXT')));
app.use('/PNG', express.static(path.join(__dirname, 'PNG')));

// المسار الرئيسي
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// مسار الويكي
app.get('/wiki', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'wiki.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
