const https = require('https');

const PROJECT_REF = 'aeecmwzmarjzliwctqcx';
const TOKEN = 'sbp_35d8f3e2b71a6203ce1bbd1bdd50b8de9fd9b617';

function runSql(sql) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.supabase.com',
            path: `/v1/projects/${PROJECT_REF}/database/query`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(`Error ${res.statusCode}: ${data}`);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(JSON.stringify({ query: sql }));
        req.end();
    });
}

async function main() {
    console.log("🔒 Aplicando políticas de seguridad estrictas (Authenticated Only)...");

    const hardenScript = `
        -- 1. Attachments
        DROP POLICY IF EXISTS "Public can upload attachments" ON public.attachments;
        CREATE POLICY "Authenticated users can upload attachments" ON public.attachments 
        FOR INSERT TO authenticated WITH CHECK (true);

        -- 2. Inquiries
        DROP POLICY IF EXISTS "Public can insert new inquiries" ON public.inquiries;
        CREATE POLICY "Authenticated users can insert inquiries" ON public.inquiries 
        FOR INSERT TO authenticated WITH CHECK (true);

        -- 3. Messages
        DROP POLICY IF EXISTS "Public can insert messages" ON public.messages;
        CREATE POLICY "Authenticated users can insert messages" ON public.messages 
        FOR INSERT TO authenticated WITH CHECK (true);
    `;

    try {
        await runSql(hardenScript);
        console.log("✅ ¡Seguridad aplicada! Ahora solo usuarios logueados pueden escribir.");
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main();
