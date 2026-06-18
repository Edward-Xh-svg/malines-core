# مجتمع مالينز — مع Turso (SQLite سحابي دائم)

## الإعداد السريع

### 1. إنشاء قاعدة بيانات Turso (مجانية)

```bash
# تثبيت Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# تسجيل دخول
turso auth login

# إنشاء قاعدة بيانات
turso db create malines

# الحصول على URL
turso db show malines --url

# إنشاء token
turso db tokens create malines
```

### 2. إعداد المتغيرات

**للتطوير المحلي** — أنشئ ملف `.env`:
```env
TURSO_DATABASE_URL=libsql://malines-username.turso.io
TURSO_AUTH_TOKEN=your-token-here
```

ثم شغّل:
```bash
npm install
node -e "require('dotenv').config(); require('./server')"
```

**للتطوير بدون Turso** (SQLite محلي):
```env
TURSO_DATABASE_URL=file:./malines.db
TURSO_AUTH_TOKEN=
```

### 3. النشر على Vercel

في لوحة Vercel → Settings → Environment Variables، أضف:
- `TURSO_DATABASE_URL` ← رابط قاعدة البيانات
- `TURSO_AUTH_TOKEN`   ← الـ token

ثم ادفع الكود وسيعمل تلقائياً.

## مستخدم admin الافتراضي

```
Email:    admin@malines.com
Password: admin123
```
**غيّر كلمة المرور فوراً!**

## لوحة الإدارة

افتح `/admin` بعد النشر.

من اللوحة يمكنك:
- ✅ نشر وتعديل وحذف المقالات
- ✅ إدارة الدول (مجلس + بورصة) والشركات
- ✅ إضافة وحذف السجلات
- ✅ إدارة المستخدمين وصلاحياتهم
