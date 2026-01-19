
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const start = Date.now();
        const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        const latency = Date.now() - start;

        if (error) throw error;

        return NextResponse.json({
            status: 'healthy',
            database: 'connected',
            latency: `${latency}ms`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message
        }, { status: 500 });
    }
}
