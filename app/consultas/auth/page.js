"use client";
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthDispatcher() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        router.replace(`/consultas/auth/register?${searchParams.toString()}`);
    }, [router, searchParams]);

    return null;
}

export default function AuthPage() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
            <Suspense fallback={<p>Cargando sesión...</p>}>
                <AuthDispatcher />
                <p>Redirigiendo a registro seguro...</p>
            </Suspense>
        </div>
    );
}
