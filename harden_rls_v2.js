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
    console.log("🔒 Aplicando políticas de seguridad GRANULARES (Owner Check)...");

    const hardenScript = `
        -- 1. Attachments: Solo si pertenezco al inquiry
        DROP POLICY IF EXISTS "Public can upload attachments" ON public.attachments;
        DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON public.attachments; -- Limpiar versión previa si existe
        
        CREATE POLICY "Users can upload attachments to their inquiries" ON public.attachments 
        FOR INSERT TO authenticated 
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.inquiries i
                WHERE i.id = inquiry_id
                AND (i.client_auth_id = auth.uid() OR i.assigned_lawyer_id = auth.uid())
            )
        );

        -- 2. Inquiries: Solo si soy el cliente que dice ser
        DROP POLICY IF EXISTS "Public can insert new inquiries" ON public.inquiries;
        DROP POLICY IF EXISTS "Authenticated users can insert inquiries" ON public.inquiries;

        CREATE POLICY "Users can create their own inquiries" ON public.inquiries 
        FOR INSERT TO authenticated 
        WITH CHECK (
            auth.uid() = client_auth_id
        );

        -- 3. Messages: Solo si pertenezco al inquiry
        DROP POLICY IF EXISTS "Public can insert messages" ON public.messages;
        DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;

        CREATE POLICY "Users can insert messages in their inquiries" ON public.messages 
        FOR INSERT TO authenticated 
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.inquiries i
                WHERE i.id = inquiry_id
                AND (i.client_auth_id = auth.uid() OR i.assigned_lawyer_id = auth.uid())
            )
        );
    `;

    try {
        await runSql(hardenScript);
        console.log("✅ ¡Seguridad Granular Aplicada! Cero warnings.");
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main();
