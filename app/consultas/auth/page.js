"use client";
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthDispatcher() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const checkAndRedirect = async () => {
            const cid = searchParams.get('cid');
            const lawyerId = searchParams.get('lawyerId') || searchParams.get('lawyer');

            // Build base URL params
            const params = new URLSearchParams();
            if (lawyerId) params.set('lawyerId', lawyerId);
            if (cid) params.set('cid', cid);

            // Check if CID is already claimed (use API to bypass RLS)
            if (cid) {
                try {
                    const res = await fetch(`/api/intake/check-claimed?cid=${cid}`);
                    const data = await res.json();

                    if (data.claimed) {
                        // CID is claimed - user already registered, go to login
                        console.log('🔒 CID claimed, redirecting to login');
                        router.replace(`/consultas/auth/login?${params.toString()}`);
                        return;
                    }
                } catch (err) {
                    console.error('Error checking CID claim:', err);
                }
            }

            // CID not claimed or no CID - go to register
            console.log('📝 CID not claimed, redirecting to register');
            router.replace(`/consultas/auth/register?${params.toString()}`);
        };

        checkAndRedirect();
    }, [router, searchParams]);

    return null;
}

export default function AuthPage() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
            <Suspense fallback={<p>Cargando sesión...</p>}>
                <AuthDispatcher />
                <p>Verificando acceso...</p>
            </Suspense>
        </div>
    );
}
