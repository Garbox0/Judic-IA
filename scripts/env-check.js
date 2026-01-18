// scripts/env-check.js
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
console.log("🔍 Checking NEXT_PUBLIC_SUPABASE_URL...");
console.log("RAW:", JSON.stringify(url));

if (!url) {
    console.error("❌ URL is undefined!");
    process.exit(1);
}

const chars = [...url].map(c => c.charCodeAt(0));
console.log("CHARS:", chars);

const hasInvisible = chars.some(c => c < 32 || c > 126);
if (hasInvisible) {
    console.error("❌ HIDDEN CHARACTERS DETECTED! Your .env file is corrupted.");
} else {
    console.log("✅ No hidden characters found in URL.");
}
