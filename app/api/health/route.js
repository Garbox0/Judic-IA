import { supabase } from '@/app/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Perform a simple query to keep the Supabase project active
        const { data, error } = await supabase
            .from('profiles')
            .select('count', { count: 'exact', head: true })
            .limit(1);

        if (error) throw error;

        return NextResponse.json({
            status: 'ok',
            message: 'Database heartbeat successful',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Keep-alive error:', err);
        return NextResponse.json({
            status: 'error',
            message: 'Database heartbeat failed',
            error: err.message
        }, { status: 500 });
    }
}
