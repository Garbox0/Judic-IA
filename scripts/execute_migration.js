const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const PROJECT_REF = 'aeecmwzmarjzliwctqcx'; // From .env.local
const TOKEN_FILE = path.join(__dirname, '../supabase_access.txt');
const MIGRATION_FILE = path.join(__dirname, '../supabase/migrations/20260129_deletion_otps.sql');

async function executeSql() {
    console.log("🚀 Starting SQL Execution via Management API...");

    // 1. Read Token
    if (!fs.existsSync(TOKEN_FILE)) {
        console.error("❌ Token file not found!");
        process.exit(1);
    }
    const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    console.log("🔑 Token read successfully.");

    // 2. Read SQL
    if (!fs.existsSync(MIGRATION_FILE)) {
        console.error("❌ Migration file not found!");
        process.exit(1);
    }
    const sqlContent = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log("cdc SQL Content loaded. Length:", sqlContent.length);

    // 3. Execute request
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

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log("✅ SQL Executed Successfully!");
                console.log("Response:", data);
            } else {
                console.error(`❌ API Request Failed. Status: ${res.statusCode}`);
                console.error("Response:", data);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`❌ Request Error: ${e.message}`);
    });

    req.write(JSON.stringify({ query: sqlContent }));
    req.end();
}

executeSql();
