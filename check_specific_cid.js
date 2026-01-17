require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSpecific() {
    const targetCid = "c02d9b07-c846-4f04-af61-c23ce92a5219";
    console.log(`🔍 Checking inquiry ${targetCid}...`);

    const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .eq('id', targetCid)
        .maybeSingle();

    if (error) {
        console.error("❌ Error:", error);
    } else if (!data) {
        console.warn("⚠️ Inquiry not found.");
    } else {
        console.log("✅ Inquiry data:", data);
    }
}

checkSpecific();
