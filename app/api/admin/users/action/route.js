
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'gbrlescalada@gmail.com';
const ADMIN_ID = '365cd259-4f1e-4004-a677-1eda06a5147e';

export async function POST(request) {
    try {
        const { adminId, targetUserId, action, payload } = await request.json();

        // 1. Security Check
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: { user: adminUser }, error: adminError } = await supabase.auth.admin.getUserById(adminId);

        if (adminError || !adminUser || adminUser.email !== ADMIN_EMAIL || adminUser.id !== ADMIN_ID) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let updateData = {};

        // 2. Action Dispatcher
        switch (action) {
            case 'toggle-pro':
                const isActive = payload.active;
                updateData = {
                    subscription_status: isActive ? 'active' : 'inactive',
                    plan_tier: isActive ? 'pro' : 'free',
                    subscription_expiry: isActive
                        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
                        : null,
                    ai_message_quota: isActive ? 1000 : 10 // Example quotas
                };
                break;

            case 'update-credits':
                updateData = {
                    ai_message_quota: parseInt(payload.quota) || 10
                };
                break;

            case 'reset-usage':
                updateData = {
                    ai_messages_used: 0
                };
                break;

            default:
                return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });
        }

        // 3. Persist to Supabase
        const { data, error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', targetUserId)
            .select();

        if (error) throw error;

        return NextResponse.json({ success: true, data });

    } catch (error) {
        console.error("Admin Action Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
