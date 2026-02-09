/**
 * 🛡️ API AUTHENTICATION HELPERS
 * Centralized auth verification for API routes
 */
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify user from Bearer token in Authorization header.
 * Returns { user, error, response }
 * If error, response is a ready-to-return NextResponse.
 */
export async function verifyAuth(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return {
            user: null,
            error: 'missing_token',
            response: NextResponse.json({ error: 'No autorizado - falta token' }, { status: 401 })
        };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
        return {
            user: null,
            error: 'invalid_token',
            response: NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
        };
    }

    return { user, error: null, response: null };
}

/**
 * Verify that the authenticated user matches the requested userId.
 * Prevents IDOR attacks where user A acts on user B's data.
 */
export async function verifyAuthAndOwnership(request, requestedUserId) {
    const auth = await verifyAuth(request);
    if (auth.error) return auth;

    if (auth.user.id !== requestedUserId) {
        return {
            user: null,
            error: 'forbidden',
            response: NextResponse.json({ error: 'No autorizado para este recurso' }, { status: 403 })
        };
    }

    return auth;
}

/**
 * Verify user is authenticated AND is admin.
 */
export async function verifyAdmin(request) {
    const auth = await verifyAuth(request);
    if (auth.error) return auth;

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', auth.user.id)
        .single();

    if (profile?.role !== 'admin') {
        return {
            user: null,
            error: 'not_admin',
            response: NextResponse.json({ error: 'Acceso denegado: se requiere rol admin' }, { status: 403 })
        };
    }

    return auth;
}
