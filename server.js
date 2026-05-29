const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

// منع الوصول المباشر إلى مجلدات البريد وكلمات المرور
app.use((req, res, next) => {
    if (req.path.startsWith('/email') || req.path.startsWith('/PS')) {
        return res.status(404).send('Not Found');
    }
    next();
});

// خدمة الملفات الثابتة من public
app.use(express.static(path.join(__dirname, 'public')));

// نقطة نهاية تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'يجب إدخال البريد الإلكتروني وكلمة المرور' });
    }

    const emailDir = path.join(__dirname, 'public', 'email');
    const psDir = path.join(__dirname, 'public', 'PS');

    // قراءة مجلد البريد الإلكتروني
    let files;
    try {
        files = fs.readdirSync(emailDir);
    } catch (err) {
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }

    // البحث عن ملف يحتوي على نفس البريد الإلكتروني
    for (const file of files) {
        if (!file.endsWith('.txt')) continue;
        const emailFilePath = path.join(emailDir, file);
        try {
            const content = fs.readFileSync(emailFilePath, 'utf8').trim();
            if (content === email) {
                // البريد موجود، نتحقق من كلمة المرور
                const username = path.basename(file, '.txt'); // اسم الملف بدون .txt هو اسم المستخدم
                const passFilePath = path.join(psDir, file); // نفس اسم الملف في مجلد PS
                if (fs.existsSync(passFilePath)) {
                    const passContent = fs.readFileSync(passFilePath, 'utf8').trim();
                    if (passContent === password) {
                        return res.json({ success: true, username });
                    }
                }
                // كلمة مرور خاطئة أو ملف غير موجود
                return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
            }
        } catch (err) {
            continue; // تخطي الملفات التي تعذرت قراءتها
        }
    }

    // إذا لم نجد البريد الإلكتروني
    return res.status(404).json({ error: 'البريد الإلكتروني غير مسجل' });
});

// جميع المسارات الأخرى تذهب إلى index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;