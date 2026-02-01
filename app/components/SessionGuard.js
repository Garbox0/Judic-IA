"use client";
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

export default function SessionGuard({ targetId, tableName = 'profiles' }) {
    const router = useRouter();

    useEffect(() => {
        if (!targetId || targetId === 'demo') return;

        // HEARTBEAT CHECK
        // Checks every 15 seconds if the record (User Profile or Inquiry) still exists.
        const heartbeat = setInterval(async () => {
            const { count, error } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true })
                .eq('id', targetId);

            // If count is 0, the record was deleted.
            if (!error && count === 0) {
                console.warn(`💔 Heartbeat failed: Record ${targetId} not found in ${tableName}. Logging out...`);
                await supabase.auth.signOut();

                // Redirect logic based on context
                if (tableName === 'inquiries') {
                    window.location.href = '/?error=case_closed';
                } else {
                    router.push('/login?error=session_revoked');
                }
            }
        }, 15000); // 15 seconds

        return () => clearInterval(heartbeat);
    }, [targetId, router]);

    return null; // Invisible Component
}
