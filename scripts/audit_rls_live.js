const https = require('https');
const fs = require('fs');

const PROJECT_REF = 'aeecmwzmarjzliwctqcx';

function getAccessToken() {
    try {
        const path = 'supabase_access.txt';
        if (!fs.existsSync(path)) return null;
        const content = fs.readFileSync(path, 'utf8').trim();
        return content.split('\n')[0].trim();
    } catch (e) {
        return null;
    }
}

const TOKEN = getAccessToken();

if (!TOKEN || !TOKEN.startsWith('sbp_')) {
    console.error('❌ Error: Token inválido en supabase_access.txt');
    process.exit(1);
}

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
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
                } else {
                    reject(`Error API ${res.statusCode}: ${data}`);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(JSON.stringify({ query: sql }));
        req.end();
    });
}

async function main() {
    console.log("🔍 Auditando RLS...");

    // Consulta para listar políticas
    const query = `
        SELECT tablename, policyname, cmd, roles, with_check, qual
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('inquiries', 'messages', 'attachments')
        ORDER BY tablename, cmd;
    `;

    try {
        const res = await runSql(query);
        // Write directly to file to avoid shell redirection issues
        fs.writeFileSync('last_audit_rls.json', JSON.stringify(res, null, 2));
        console.log("✅ Resultados guardados en last_audit_rls.json");
    } catch (error) {
        console.error("❌ Fallo:", error);
    }
}

main();
