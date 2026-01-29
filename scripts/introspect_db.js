const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const PROJECT_REF = 'aeecmwzmarjzliwctqcx';
const TOKEN_FILE = path.join(__dirname, '../supabase_access.txt');

async function introspect() {
    console.log("🔍 Starting Database Introspection...");

    if (!fs.existsSync(TOKEN_FILE)) {
        console.error("❌ Token file not found.");
        return;
    }
    const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();

    const queries = {
        tables: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';",
        foreign_keys: `
            SELECT
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public';
        `,
        rls_policies: "SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public';"
    };

    for (const [key, sql] of Object.entries(queries)) {
        await runQuery(key, sql, token);
    }
}

function runQuery(label, sql, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.supabase.com',
            path: `/v1/projects/${PROJECT_REF}/database/query`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`\n--- ${label.toUpperCase()} ---`);
                    // The API returns an array of objects directly usually, or { result: [] } check that
                    // Actually the management API query endpoint returns the rows directly as JSON array
                    try {
                        const rows = JSON.parse(data);
                        console.log(JSON.stringify(rows, null, 2));
                    } catch (e) {
                        console.log("Raw output:", data);
                    }
                } else {
                    console.error(`❌ Error querying ${label}: ${res.statusCode} - ${data}`);
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(e);
            resolve();
        });

        req.write(JSON.stringify({ query: sql }));
        req.end();
    });
}

introspect();
