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
    console.log("🚑 Corrigiendo RLS para permitir al Abogado crear Inquiries...");

    const fixScript = `
        DROP POLICY IF EXISTS "Users can create their own inquiries" ON public.inquiries;

        CREATE POLICY "Users can create inquiries (as client or lawyer)" ON public.inquiries 
        FOR INSERT TO authenticated 
        WITH CHECK (
            auth.uid() = client_auth_id 
            OR 
            auth.uid() = assigned_lawyer_id
        );
    `;

    try {
        await runSql(fixScript);
        console.log("✅ Corrección aplicada: Abogados desbloqueados.");
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main();
