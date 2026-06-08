import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // 1. التحقق من المدخلات
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    // 2. الاتصال بقاعدة البيانات باستخدام الرابط المحقون تلقائياً في فيرسيل
    const sql = neon(process.env.DATABASE_URL!);

    // 3. التحقق مما إذا كان البريد الإلكتروني مسجلاً مسبقاً
    const existingUser = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 });
    }

    // 4. تشفير كلمة المرور لحماية البيانات
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. إدخال المستخدم الجديد في الجدول
    await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashedPassword})
    `;

    return NextResponse.json({ message: 'تم إنشاء الحساب بنجاح' }, { status: 201 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم أثناء التسجيل' }, { status: 500 });
  }
}
