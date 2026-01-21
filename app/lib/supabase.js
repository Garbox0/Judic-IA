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
        supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
            cookieOptions: { name: AUTH_COOKIE }
        });
    }
    return supabaseInstance;
})();
