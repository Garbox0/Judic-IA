require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectUndefined() {
    console.log("🔍 Deep Inspection of 'undefined' inquiries...");

    // Check if lawyer_id is LITERAL string "undefined"
    const { data: literalUndefined, error: err1 } = await supabase
        .from('inquiries')
        .select('*')
        .eq('lawyer_id', 'undefined');

    console.log(`❌ Found ${literalUndefined ? literalUndefined.length : 0} inquiries with lawyer_id='undefined' (string)`);

    // Check if lawyer_id is actually NULL
    const { data: nullLawyer, error: err2 } = await supabase
        .from('inquiries')
        .select('*')
        .is('lawyer_id', null);

    console.log(`❓ Found ${nullLawyer ? nullLawyer.length : 0} inquiries with lawyer_id=NULL`);

    if (literalUndefined && literalUndefined.length > 0) {
        console.log("\nSample Literal Undefined Inquiries:");
        console.table(literalUndefined.map(i => ({
            id: i.id,
            name: i.contact_name,
            created: i.created_at
        })));
    }
}

inspectUndefined();
