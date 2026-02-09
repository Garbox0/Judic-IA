import { createClient } from '@/app/lib/supabase-server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const hostname = request.headers.get('host') || '';

    // Custom params passing through
    const lawyerId = searchParams.get('lawyerId');
    const cid = searchParams.get('cid');

    // Determine domain context
    const isClientSubdomain = hostname.startsWith('consultas.');
    // If running on main domain, use that. If on client subdomain, use that.
    // The issue might be that origin comes from the request, which might be the subdomain if redirected there?
    // But usually Supabase redirects to the site URL.

    console.log(`[Auth Callback] Processing for host: ${hostname}, Code present: ${!!code}`);

    // Determine client login base URL
    const isDev = hostname.includes('localhost');
    const clientLoginBase = isDev
        ? `${origin}/consultas/auth/login`
        : 'https://consultas.judic-ia.com/auth/login';

    if (code) {
        const supabase = await createClient();

        // Exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Get user to check role
            const { data: { user } } = await supabase.auth.getUser();
            let role = user?.user_metadata?.role;

            console.log(`[Auth Callback] User Authenticated: ${user?.email}, Metadata Role: ${role}`);

            // 🛡️ ROBUST ARCHITECTURE: Check DB if metadata fails
            if (!role) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user?.id)
                    .maybeSingle();
                if (profile?.role) {
                    role = profile.role;
                    console.log(`[Auth Callback] Role found in DB: ${role}`);
                }
            }

            // fail-safe context check
            if (!role && (lawyerId || cid)) {
                role = 'client';
                console.log(`[Auth Callback] Role inferred as client from context params`);
            }

            // Intelligent Redirect based on Role
            if (role === 'lawyer') {
                // FORCE MAIN DOMAIN for lawyers
                const dashboardUrl = isDev ? `${origin}/dashboard` : 'https://judic-ia.com/dashboard';
                console.log(`[Auth Callback] Redirecting Lawyer to: ${dashboardUrl}`);
                return NextResponse.redirect(dashboardUrl);
            }
            else if (role === 'client') {
                // SECURITY: Sign out immediately if this was just a confirmation link for a client
                // Clients should log in explicitly or via magic link to the client portal
                await supabase.auth.signOut();
                console.log(`🔒 Client ${user?.email} signed out after confirmation - redirecting to login`);

                const loginUrl = new URL(clientLoginBase);
                if (lawyerId) loginUrl.searchParams.set('lawyerId', lawyerId);
                if (cid) loginUrl.searchParams.set('cid', cid);
                loginUrl.searchParams.set('confirmed', 'true');

                return NextResponse.redirect(loginUrl);
            }

            // Fallback for unknown roles - likely admin or new lawyer
            const fallbackUrl = isDev ? `${origin}/dashboard` : 'https://judic-ia.com/dashboard';
            console.log(`[Auth Callback] Unknown role, falling back to: ${fallbackUrl}`);
            return NextResponse.redirect(fallbackUrl);

        } else {
            console.error('Auth Code Exchange Error:', error);
            return NextResponse.redirect(`${origin}/login?error=auth_code_error`);
        }
    }

    // If no code or error, check if this is a client flow
    if (lawyerId || cid) {
        return NextResponse.redirect(`${origin}`);
    }

    // Default: lawyer login failure
    return NextResponse.redirect(`${origin}/login?error=auth_confirmation_error`);
}
