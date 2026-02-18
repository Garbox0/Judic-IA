import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/research/track-click
 * 
 * Lightweight endpoint to record when a lawyer interacts with a search result.
 * Used for the feedback loop that boosts frequently-used results.
 * 
 * Body: { case_url, action, query_context }
 * action: 'open_link' | 'view_pdf' | 'copy' | 'refresh'
 */
export async function POST(request) {
    try {
        const { case_url, action, query_context } = await request.json();

        if (!case_url || !action) {
            return NextResponse.json({ error: 'Missing case_url or action' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Extract user from auth header (optional — anonymous clicks are still useful)
        let userId = null;
        const authHeader = request.headers.get('authorization');
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) userId = user.id;
        }

        await supabase.from('research_clicks').insert({
            user_id: userId,
            case_url,
            action,
            query_context: query_context?.substring(0, 500) // Limit stored text
        });

        // Also increment click_count on case_library for this URL (fire-and-forget)
        supabase
            .rpc('increment_click_count', { target_url: case_url })
            .then(() => { })
            .catch(() => { }); // Ignore if RPC doesn't exist yet

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('Track click error:', err);
        return NextResponse.json({ ok: true }); // Don't fail the client
    }
}
