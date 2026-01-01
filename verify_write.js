const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1] : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testWrite() {
    console.log("👉 Testing WRITE (Upsert) to 'inquiries'...");

    const fakeId = "11111111-2222-3333-4444-555555555555"; // Valid UUID format

    const { data, error } = await supabase
        .from('inquiries')
        .upsert({
            id: fakeId,
            case_type: 'Test Case',
            status: 'new'
        }, { onConflict: 'id' })
        .select();

    if (error) {
        console.error("❌ WRITE Failed:", error.message, error.details);
    } else {
        console.log("✅ WRITE Successful!", data);

        // Cleanup (optional, but good)
        await supabase.from('inquiries').delete().eq('id', fakeId);
    }
}

testWrite();
