"use client";
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // By default, redirect to register since most hits are new leads
        // Preserve all search params (lawyerId, cid, etc)
        router.replace(`/consultas/auth/register?${searchParams.toString()}`);
    }, [router, searchParams]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
            <p>Redirigiendo a registro seguro...</p>
        </div>
    );
}
