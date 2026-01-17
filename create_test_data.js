const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, supabaseServiceKey);

async function createTestInquiry() {
    console.log("🛠️ Creating test inquiry for Juan Paparulo...");

    const juanId = '264430e5-760f-47e7-a166-fd09ef699160';
    const gabrielId = 'd77e2d5f-4307-4e13-b53f-d6d490236cea';
    const cid = 'cbd40f23-ab42-4cf4-bce5-2000437a0ce4';

    const { error } = await client
        .from('inquiries')
        .upsert({
            id: cid,
            contact_email: 'likkledraw@gmail.com',
            client_auth_id: juanId,
            assigned_lawyer_id: gabrielId,
            contact_name: 'Juan Paparulo',
            case_type: 'Test',
            status: 'Nuevo'
        });

    if (error) {
        console.error("❌ Error creating test inquiry:", error);
    } else {
        console.log("✅ Test inquiry created/synced.");

        // Let's also check if the profile sync trigger worked
        setTimeout(async () => {
            const { data: profile } = await client
                .from('profiles')
                .select('id, assigned_lawyer_id')
                .eq('id', juanId)
                .single();
            console.log("👤 Profile state after sync:", profile);
        }, 2000);
    }
}

createTestInquiry();
