import { createClient } from '../../lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const hostname = request.headers.get('host') || '';

    // Custom params passing through
    const lawyerId = searchParams.get('lawyerId');
    const cid = searchParams.get('cid');

    // Determine client login base URL
    const isDev = hostname.includes('localhost');
    const clientLoginBase = isDev
        ? `${origin}/consultas/auth/login`
        : 'https://consultas.judic-ia.com/auth/login';

    if (code) {
        const supabase = await createClient();

        // Exchange the code for a session
        // This happens on the server, avoiding client-side PKCE verifier issues
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Get user to check role
            const { data: { user } } = await supabase.auth.getUser();
            const role = user?.user_metadata?.role;

            console.log(`✅ Auth confirmed for ${user?.email} - Role: ${role}`);

            // Intelligent Redirect based on Role
            if (role === 'lawyer') {
                return NextResponse.redirect(`${origin}/dashboard`);
            }
            else if (role === 'client') {
                // SECURITY: Sign out immediately after confirming email
                // Client must log in manually with their credentials
                // This prevents the confirmation link from being a "magic login link"
                await supabase.auth.signOut();

                console.log(`🔒 Client ${user?.email} signed out after confirmation - must log in manually`);

                const loginUrl = new URL(clientLoginBase);
                if (lawyerId) loginUrl.searchParams.set('lawyerId', lawyerId);
                if (cid) loginUrl.searchParams.set('cid', cid);
                loginUrl.searchParams.set('confirmed', 'true'); // Flag to show success message

                return NextResponse.redirect(loginUrl);
            }

            // Fallback for unknown roles
            return NextResponse.redirect(`${origin}/dashboard`);
        } else {
            console.error('Auth Code Exchange Error:', error);
            // If client params exist, redirect to client login with error
            if (lawyerId || cid) {
                const clientUrl = new URL(clientLoginBase);
                if (lawyerId) clientUrl.searchParams.set('lawyerId', lawyerId);
                if (cid) clientUrl.searchParams.set('cid', cid);
                clientUrl.searchParams.set('error', 'link_expired');
                return NextResponse.redirect(clientUrl);
            }
        }
    }

    // If no code or error, check if this is a client flow
    if (lawyerId || cid) {
        const clientUrl = new URL(clientLoginBase);
        if (lawyerId) clientUrl.searchParams.set('lawyerId', lawyerId);
        if (cid) clientUrl.searchParams.set('cid', cid);
        clientUrl.searchParams.set('error', 'auth_error');
        return NextResponse.redirect(clientUrl);
    }

    // Default: lawyer login
    return NextResponse.redirect(`${origin}/login?error=auth_confirmation_error`);
}
