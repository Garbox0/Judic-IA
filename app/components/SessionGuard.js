"use client";
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

export default function SessionGuard({ targetId, tableName = 'profiles' }) {
    const router = useRouter();
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!targetId || targetId === 'demo') return;

        const runHeartbeat = async () => {
            const { count, error } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true })
                .eq('id', targetId);

            if (!error && count === 0) {
                console.warn(`Heartbeat failed: Record ${targetId} not found in ${tableName}. Logging out...`);
                await supabase.auth.signOut();
                if (tableName === 'inquiries') {
                    window.location.href = '/?error=case_closed';
                } else {
                    router.push('/login?error=session_revoked');
                }
            }
        };

        const startHeartbeat = () => {
            if (!intervalRef.current) {
                intervalRef.current = setInterval(runHeartbeat, 15000);
            }
        };

        const stopHeartbeat = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        // Pause polling when tab is hidden, resume when visible
        const handleVisibility = () => {
            if (document.hidden) {
                stopHeartbeat();
            } else {
                runHeartbeat(); // Check immediately on return
                startHeartbeat();
            }
        };

        startHeartbeat();
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            stopHeartbeat();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [targetId, router, tableName]);

    return null;
}
