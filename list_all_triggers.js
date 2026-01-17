require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTriggers() {
    console.log("🔍 Listing ALL Triggers in the database...");

    // We can query pg_trigger if we have service_role
    // We want the trigger name, the table name, and the function it calls.
    const { data: triggers, error } = await supabase.from('pg_trigger')
        .select(`
            tgname,
            tgrelid:pg_class(relname),
            tgfoid:pg_proc(proname)
        `)
        .limit(20);

    if (error) {
        console.error("❌ Error listing triggers:", error);
        return;
    }

    console.table(triggers.map(t => ({
        trigger_name: t.tgname,
        table: t.tgrelid ? t.tgrelid.relname : 'unknown',
        function: t.tgfoid ? t.tgfoid.proname : 'unknown'
    })));
}

listTriggers();
