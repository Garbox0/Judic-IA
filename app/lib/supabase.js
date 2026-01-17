import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Advertencia: Variables de Supabase no configuradas.");
}

// 🛡️ STABLE CACHED INSTANCES
let adminClient = null;
let clientClient = null;

const getSupabaseInstance = () => {
    if (typeof window === 'undefined') return createBrowserClient(supabaseUrl, supabaseAnonKey, { cookieOptions: { name: 'sb-admin-token' } });

    const isClientZone = window.location.pathname.startsWith('/consultas');
    if (isClientZone) {
        if (!clientClient) {
            clientClient = createBrowserClient(supabaseUrl, supabaseAnonKey, { cookieOptions: { name: 'sb-client-token' } });
        }
        return clientClient;
    } else {
        if (!adminClient) {
            adminClient = createBrowserClient(supabaseUrl, supabaseAnonKey, { cookieOptions: { name: 'sb-admin-token' } });
        }
        return adminClient;
    }
};

// 🛡️ DYNAMIC PROXY: Routes property access to the correct stable instance
export const supabase = new Proxy({}, {
    get(target, prop) {
        const instance = getSupabaseInstance();
        const value = instance[prop];

        if (typeof value === 'function') {
            return value.bind(instance);
        }
        return value;
    }
});
