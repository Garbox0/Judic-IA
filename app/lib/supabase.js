import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Advertencia: Variables de Supabase no configuradas.");
}

const isClientZone = typeof window !== 'undefined' && window.location.pathname.startsWith('/consultas');
const cookieName = isClientZone ? 'sb-client-token' : 'sb-admin-token';

export const supabase = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        cookieOptions: {
            name: cookieName,
        }
    }
);
