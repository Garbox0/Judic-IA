import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processDailyAlerts } from '@/lib/alertEngine';

export async function GET(req) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const authHeader = req.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let isAdmin = false;
    if (!isCron && authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            isAdmin = profile?.role === 'admin';
        }
    }

    if (!isCron && !isAdmin) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const url = new URL(req.url);
        const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 100, 500));
        const result = await processDailyAlerts({ limit });

        return NextResponse.json({
            ok: true,
            source: 'alert_engine',
            ...result
        });
    } catch (error) {
        console.error('[CRON process-alerts] Error:', error);
        return NextResponse.json({
            ok: false,
            error: error?.message || 'ERROR'
        }, { status: 500 });
    }
}
