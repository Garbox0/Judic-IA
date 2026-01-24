import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export async function createClient() {
    const cookieStore = await cookies();
    const headersList = await headers();
    const hostname = headersList.get('host') || '';

    const isClientSubdomain = hostname.startsWith('consultas.');
    const cookieName = isClientSubdomain ? 'sb-judicia-client' : 'sb-judicia-auth';

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                    }
                },
            },
            cookieOptions: { name: cookieName }
        }
    );
}
