const fs = require('fs');
const path = require('path');

// Cleanly write Env Vars including Supabase
const envContent = `OPENROUTER_API_KEY=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
NEXT_PUBLIC_SUPABASE_URL=https://aeecmwzmarjzliwctqcx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZWNtd3ptYXJqemxpd2N0cWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMjEwNzMsImV4cCI6MjA4MjU5NzA3M30.Texdl2_jwzDy6kQCKIlJy3KTEo1CTQ_si8s0E1chJCI
`;

const filePath = path.join(__dirname, '.env.local');

try {
    fs.writeFileSync(filePath, envContent, { encoding: 'utf-8' });
    console.log("✅ .env.local updated: Supabase Keys set.");
} catch (error) {
    console.error("❌ Error writing .env.local:", error);
}
