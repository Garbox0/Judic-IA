require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectData() {
    console.log("🔍 Inspecting Inquiries Data...");

    // Get last 5 inquiries
    const { data: inqs, error } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("❌ Error fetching inquiries:", error);
        return;
    }

    console.table(inqs.map(i => ({
        id: i.id.substring(0, 8) + "...",
        name: i.contact_name,
        lawyer_id: i.lawyer_id,
        auth_id: i.client_auth_id ? i.client_auth_id.substring(0, 8) + "..." : "NONE"
    })));

    // Also check the profiles to see if any lawyer matches these lawyer_ids
    const uniqueLawyerIds = [...new Set(inqs.map(i => i.lawyer_id))];
    for (const lid of uniqueLawyerIds) {
        const { data: prof } = await supabase.from('profiles').select('email, role').eq('id', lid).maybeSingle();
        console.log(`👤 Lawyer ID: ${lid} -> ${prof ? prof.email + " (" + prof.role + ")" : "NOT FOUND IN PROFILES"}`);
    }
}

inspectData();
