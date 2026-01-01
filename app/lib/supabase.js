import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("🛠️ Supabase Lib Init. URL:", supabaseUrl ? "Found" : "MISSING");

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Advertencia: Variables de Supabase no configuradas. El backend no funcionará correctamente.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
