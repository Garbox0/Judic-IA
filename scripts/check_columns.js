const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_REF = 'aeecmwzmarjzliwctqcx';
const TOKEN_FILE = path.join(__dirname, '../supabase_access.txt');

async function checkColumns() {
    const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();

    // We want to know how rows are linked to the User
    const tables = ['cases', 'inquiries', 'organizations', 'research_reports', 'deadlines', 'messages'];

    const sql = `
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name IN ('${tables.join("','")}') 
        AND (column_name LIKE '%user%' OR column_name LIKE '%lawyer%' OR column_name LIKE '%owner%' OR column_name LIKE '%org%')
        ORDER BY table_name;
    `;

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
            try {
                const rows = JSON.parse(data);
                console.log(JSON.stringify(rows, null, 2));
            } catch (e) {
                console.log("Raw output:", data);
            }
        });
    });

    req.write(JSON.stringify({ query: sql }));
    req.end();
}

checkColumns();
