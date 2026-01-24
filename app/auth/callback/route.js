import { createClient } from '../../lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');

    // Custom params passing through
    const lawyerId = searchParams.get('lawyerId');
    const cid = searchParams.get('cid');

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
                // USER REQUEST: Redirect to login page after confirmation
                // The login page will detect the session and show "Welcome/Confirmed" UI
                const loginUrl = new URL(`${origin}/consultas/auth/login`);

                if (lawyerId) loginUrl.searchParams.set('lawyerId', lawyerId);
                if (cid) loginUrl.searchParams.set('cid', cid);

                return NextResponse.redirect(loginUrl);
            }

            // Fallback for unknown roles
            return NextResponse.redirect(`${origin}/dashboard`);
        } else {
            console.error('Auth Code Exchange Error:', error);
        }
    }

    // If no code or error, redirect to login with error param
    return NextResponse.redirect(`${origin}/login?error=auth_confirmation_error`);
}
