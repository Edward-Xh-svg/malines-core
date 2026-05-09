const express = require('express');
const path = require('path');
const app = express();

// خدمة ملفات الموقع الأساسية
app.use(express.static(path.join(__dirname, 'public')));

// خدمة المجلدات الخارجية للوصول إليها عبر المتصفح
app.use('/TXT', express.static(path.join(__dirname, 'TXT')));
app.use('/PNG', express.static(path.join(__dirname, 'PNG')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => console.log('Server running on port 3000'));
