
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1. Fetch EVERYTHING in Parallel (Security, Profiles, Auth Users)
        const [authResponse, profilesResponse, authUsersResponse] = await Promise.all([
            supabase.auth.admin.getUserById(userId),
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.auth.admin.listUsers()
        ]);

        // 2. Security Check (MUST validate first before processing data)
        const { data: { user: authUser }, error: authError } = authResponse;
        if (authError || !authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const isSuperUser = authUser.email === 'gbrlescalada@gmail.com' && authUser.id === '365cd259-4f1e-4004-a677-1eda06a5147e';
        if (!isSuperUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        // 3. Process Data
        const { data: profiles, error: profilesError } = profilesResponse;
        const { data: { users: authUsers }, error: usersError } = authUsersResponse;

        if (profilesError) throw profilesError;
        if (usersError) throw usersError;

        // 3. Merge Data
        const mergedUsers = profiles.map(p => {
            const authUser = authUsers.find(u => u.id === p.id);
            return {
                id: p.id,
                email: authUser?.email || 'N/A',
                full_name: p.full_name || 'N/A',
                subscription_status: p.subscription_status || 'free',
                subscription_started_at: p.subscription_started_at,
                plan_tier: p.plan_tier || 'free',
                ai_messages_used: p.ai_messages_used || 0,
                ai_message_quota: p.ai_message_quota,
                demo_expires_at: p.demo_expires_at,
                subscription_expiry: p.subscription_expiry,
                usage_percent: p.ai_message_quota ? Math.round((p.ai_messages_used / p.ai_message_quota) * 100) : 0,
                last_active: p.updated_at || p.created_at,
                created_at: p.created_at
            };
        });

        // 4. Get System Stats
        const totalUsers = mergedUsers.length;
        const totalPro = mergedUsers.filter(u => u.subscription_status === 'active').length;
        const totalUsage = mergedUsers.reduce((acc, curr) => acc + (curr.ai_messages_used || 0), 0);

        return NextResponse.json({
            users: mergedUsers,
            stats: {
                totalUsers,
                totalPro,
                totalUsage
            }
        });

    } catch (error) {
        console.error("Admin API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
