import { readFileSync, existsSync } from 'fs';
import { config } from 'dotenv';
config({ path: '.env.local' });
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

async function testVision() {
    const modelId = 'google/gemini-2.5-flash-lite-preview-09-2025';
    const img = '_captcha_raw.jpg';

    if (!existsSync(img)) {
        console.log('No existe _captcha_raw.jpg para testear.');
        return;
    }

    const base64 = readFileSync(img).toString('base64');
    console.log(`[Vision] Probando modelo: ${modelId}`);

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://judic-ia.com',
            },
            body: JSON.stringify({
                model: modelId,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Responde solo con los 4 numeros de este captcha.' },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
                    ]
                }],
                max_tokens: 10,
                temperature: 0
            }),
        });

        const data = await res.json();
        if (data.error) {
            console.log(`Error de API: ${JSON.stringify(data.error, null, 2)}`);
        } else {
            console.log(`Resultado Gemini 2.5: "${data.choices?.[0]?.message?.content?.trim()}"`);
        }
    } catch (e) {
        console.log(`Error fetch: ${e.message}`);
    }
}

testVision();
