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
    console.log("🔍 Respaldando políticas actuales...");

    const backupQuery = `
        SELECT 
            tablename, 
            policyname, 
            cmd, 
            qual, 
            with_check 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('inquiries', 'messages', 'attachments')
        AND (qual = 'true' OR with_check = 'true');
    `;

    try {
        const policies = await runSql(backupQuery);

        let rollbackScript = "-- ROLLBACK RLS: Ejecutar esto para deshacer los cambios\n\n";

        for (const p of policies) {
            // Drop modificada
            rollbackScript += `DROP POLICY IF EXISTS "${p.policyname}" ON public.${p.tablename};\n`;
            // Re-create original
            rollbackScript += `CREATE POLICY "${p.policyname}" ON public.${p.tablename}\n`;
            rollbackScript += `FOR ${p.cmd}\n`;
            rollbackScript += `TO public\n`;
            if (p.qual) rollbackScript += `USING (${p.qual})`;
            if (p.qual && p.with_check) rollbackScript += `\n`;
            if (p.with_check) rollbackScript += `WITH CHECK (${p.with_check});\n`;
            rollbackScript += `\n`;
        }

        console.log("✅ Script de Rollback generado:");
        console.log(rollbackScript);

        // Save to file for user
        const fs = require('fs');
        fs.writeFileSync('rollback_rls.sql', rollbackScript);

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main();
