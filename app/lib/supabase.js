import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Advertencia: Variables de Supabase no configuradas.");
}

// 🛡️ UNIFIED AUTH COOKIE
// Must match middleware.js and generic API routes
const AUTH_COOKIE = 'sb-judicia-auth';

// 🛡️ SINGLETON PATTERN
// Create a single instance for the browser context. 
// @supabase/ssr handles the cookies automatically.
let supabaseInstance = null;

const getSupabase = () => {
    if (typeof window === 'undefined') {
        // Server-side (during generic SSR): Creates a temporary instance
        return createBrowserClient(supabaseUrl, supabaseAnonKey, {
            cookieOptions: { name: AUTH_COOKIE }
        });
    }

    if (!supabaseInstance) {
        supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
            cookieOptions: { name: AUTH_COOKIE }
        });
    }
    return supabaseInstance;
};

// Export the singleton directly
export const supabase = getSupabase();
