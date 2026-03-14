import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';

export async function DELETE(request) {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
        .from('profiles')
        .update({ push_subscription: null })
        .eq('id', auth.user.id);

    if (error) {
        console.error('[push/unsubscribe] update error:', error.message);
        return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
