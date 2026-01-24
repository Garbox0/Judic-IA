import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Advertencia: Variables de Supabase no configuradas.");
}

// 🛡️ UNIFIED AUTH COOKIE
const AUTH_COOKIE = 'sb-judicia-auth';

let supabaseInstance = null;

export const supabase = (() => {
    if (typeof window === 'undefined') {
        // En servidor NO debemos usar createBrowserClient singleton
        // Retornamos un proxy seguro o null para evitar uso accidental
        return new Proxy({}, {
            get: () => {
                console.warn("⚠️ INTENTO DE USO DE CLIENTE BROWSER EN SERVIDOR. Usa createServerClient.");
                return undefined;
            }
        });
    }

    if (!supabaseInstance) {
        // 🛡️ DYNAMIC COOKIE BASED ON SUBDOMAIN
        const hostname = window.location.hostname;
        const isClientSubdomain = hostname.startsWith('consultas.');
        const cookieName = isClientSubdomain ? 'sb-judicia-client' : 'sb-judicia-auth';

        console.log(`🍪 Initializing Supabase Client. Zone: ${isClientSubdomain ? 'CLIENT' : 'LAWYER'}, Cookie: ${cookieName}`);

        supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
            cookieOptions: { name: cookieName }
        });
    }
    return supabaseInstance;
})();
