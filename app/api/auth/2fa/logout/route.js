import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

async function getAuthUser(request) {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const supabase = getAdminClient();
    const { data: { user } } = await supabase.auth.getUser(auth.slice(7));
    return user || null;
}

// POST /api/auth/2fa/logout — limpiar flag de 2FA del JWT (app_metadata)
export async function POST(request) {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const supabase = getAdminClient();
    await supabase.auth.admin.updateUserById(user.id, {
        app_metadata: { two_fa_verified_at: null }
    });

    return NextResponse.json({ success: true });
}
