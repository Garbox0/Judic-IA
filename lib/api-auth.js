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
 * Also checks that the user is not banned, deleted, or soft-deleted.
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

    // Verificar que el usuario no fue soft-deleted ni baneado de la plataforma
    const [profileRes, banRes] = await Promise.all([
        supabaseAdmin
            .from('profiles')
            .select('deleted_at')
            .eq('id', user.id)
            .single(),
        supabaseAdmin
            .from('platform_bans')
            .select('id')
            .eq('email', user.email)
            .maybeSingle(),
    ]);

    if (profileRes.data?.deleted_at) {
        return {
            user: null,
            error: 'account_deleted',
            response: NextResponse.json({ error: 'Cuenta eliminada' }, { status: 403 })
        };
    }

    if (banRes.data) {
        return {
            user: null,
            error: 'account_banned',
            response: NextResponse.json({ error: 'Cuenta suspendida' }, { status: 403 })
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
