const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// خدمة الملفات الثابتة من public
app.use(express.static(path.join(__dirname, 'public')));

// نقطة نهاية DeepSeek
app.post('/api/deepseek', async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'يجب توفير مصفوفة messages' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'مفتاح API غير مضبوط' });
    }

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: 'أنت Malines Hostaka - ChatBot Economy. مهمتك حساب دخل شركات لعبة Malines بشكل واقعي صارم مع هوامش دقيقة. أجب بالعربية.'
                    },
                    ...messages
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('خطأ في الاتصال بـ DeepSeek:', error);
        res.status(500).json({ error: 'فشل الاتصال بخدمة الذكاء الاصطناعي' });
    }
});

// أي مسار غير معروف → index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;