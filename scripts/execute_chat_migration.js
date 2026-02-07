const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const PROJECT_REF = 'aeecmwzmarjzliwctqcx';
const TOKEN_FILE = path.join(__dirname, '../supabase_access.txt');
// Pointing to the artifact location
const MIGRATION_FILE = 'C:/Users/Likkl/.gemini/antigravity/brain/1a9a1fec-d1d0-4b11-a789-6c58aca50ccd/chat_migration.sql';

async function executeSql() {
    console.log("🚀 Starting Chat Migration...");

    if (!fs.existsSync(TOKEN_FILE)) {
        console.error("❌ Token file not found at:", TOKEN_FILE);
        process.exit(1);
    }
    const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();

    if (!fs.existsSync(MIGRATION_FILE)) {
        console.error("❌ Migration file not found at:", MIGRATION_FILE);
        process.exit(1);
    }
    const sqlContent = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log("📄 SQL Content loaded. Length:", sqlContent.length);

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
                console.log("✅ Chat Migration Executed Successfully!");
                console.log("Response:", data);
            } else {
                console.error(`❌ Migration Failed. Status: ${res.statusCode}`);
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
