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
            // KICK-OUT: If auth fails (e.g. user deleted), redirect to main landing page
            // We don't want them to see the login screen at all.
            return NextResponse.redirect('https://judic-ia.com');
        }
    }

    // If no code or error, check if this is a client flow
    if (lawyerId || cid) {
        // Also redirect to landing page on generic errors
        return NextResponse.redirect('https://judic-ia.com');
    }

    // Default: lawyer login failure
    return NextResponse.redirect(`${origin}/login?error=auth_confirmation_error`);
}
