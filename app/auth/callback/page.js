"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState('Verificando tu cuenta...');
    const [error, setError] = useState(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // METHOD 1: PKCE Flow - Check for code in URL params
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');

                if (code) {
                    console.log('📧 PKCE flow detected - exchanging code...');
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError) {
                        console.error('Code exchange error:', exchangeError);
                        setError('Error al verificar el email. El enlace puede haber expirado.');
                        setTimeout(() => router.push('/login'), 3000);
                        return;
                    }
                }

                // METHOD 2: Implicit Flow - Check for tokens in hash
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (accessToken && refreshToken) {
                    console.log('📧 Implicit flow detected - setting session...');
                    const { error: setSessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });

                    if (setSessionError) {
                        console.error('Set session error:', setSessionError);
                        setError('Error al establecer la sesión.');
                        setTimeout(() => router.push('/login'), 3000);
                        return;
                    }
                }

                // Now get the session (should exist after code exchange or token set)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('Session error:', sessionError);
                    setError('Error al verificar la sesión. Por favor intenta iniciar sesión manualmente.');
                    setTimeout(() => router.push('/login'), 3000);
                    return;
                }

                if (!session) {
                    // No session found - maybe they just landed here without confirming
                    setStatus('No se encontró sesión activa. Redirigiendo al login...');
                    setTimeout(() => router.push('/login'), 2000);
                    return;
                }

                // Get fresh session after potential token exchange
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    setStatus('No se pudo verificar el usuario. Redirigiendo...');
                    setTimeout(() => router.push('/login'), 2000);
                    return;
                }

                // Determine user role from metadata
                const userRole = user.user_metadata?.role;
                console.log('User confirmed:', user.email, 'Role:', userRole);

                // Check for redirect parameters (for clients coming from lawyer's link)
                const lawyerId = searchParams.get('lawyerId') || searchParams.get('lawyer');
                const cid = searchParams.get('cid');

                if (userRole === 'lawyer') {
                    // LAWYER FLOW - Go to dashboard
                    setStatus('✅ ¡Email confirmado! Bienvenido Dr/a. Redirigiendo al panel...');
                    setTimeout(() => router.push('/dashboard'), 1500);

                } else if (userRole === 'client') {
                    // CLIENT FLOW - Go to consultation
                    if (lawyerId) {
                        setStatus('✅ ¡Email confirmado! Ingresando a tu consulta...');
                        const redirectUrl = cid
                            ? `/consultas/${lawyerId}?cid=${cid}`
                            : `/consultas/auth/login?lawyerId=${lawyerId}`;
                        setTimeout(() => router.push(redirectUrl), 1500);
                    } else {
                        // Client without lawyer context - this shouldn't happen normally
                        setStatus('✅ Cuenta verificada. Redirigiendo...');
                        setTimeout(() => router.push('/'), 2000);
                    }

                } else {
                    // Unknown role - fallback logic based on URL params
                    if (lawyerId) {
                        // Has lawyer params, assume client
                        setStatus('✅ Verificado. Redirigiendo a tu consulta...');
                        const redirectUrl = cid
                            ? `/consultas/${lawyerId}?cid=${cid}`
                            : `/consultas/auth/login?lawyerId=${lawyerId}`;
                        setTimeout(() => router.push(redirectUrl), 1500);
                    } else {
                        // No params, could be lawyer - check profile
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('role')
                            .eq('id', user.id)
                            .single();

                        if (profile?.role === 'lawyer') {
                            setStatus('✅ ¡Bienvenido Dr/a! Accediendo al panel...');
                            setTimeout(() => router.push('/dashboard'), 1500);
                        } else {
                            setStatus('✅ Cuenta verificada. Redirigiendo...');
                            setTimeout(() => router.push('/login'), 2000);
                        }
                    }
                }

            } catch (err) {
                console.error('Callback error:', err);
                setError('Error inesperado. Redirigiendo al login...');
                setTimeout(() => router.push('/login'), 3000);
            }
        };

        handleCallback();
    }, [router, searchParams]);

    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 10%, #0f172a, #020617)',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{
                textAlign: 'center',
                padding: '3rem',
                background: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(20px)',
                borderRadius: '28px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 40px 80px rgba(0, 0, 0, 0.6)',
                maxWidth: '400px'
            }}>
                <img
                    src="/logo.png"
                    alt="Judic-IA"
                    style={{
                        width: '70px',
                        marginBottom: '1.5rem',
                        filter: 'drop-shadow(0 0 15px rgba(251, 191, 36, 0.4))'
                    }}
                />

                <h1 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '1.8rem',
                    color: '#fbbf24',
                    marginBottom: '1rem'
                }}>
                    Judic-IA ⚖️
                </h1>

                {error ? (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#fca5a5',
                        padding: '1rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        marginBottom: '1rem'
                    }}>
                        ⚠️ {error}
                    </div>
                ) : (
                    <>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            marginBottom: '1.5rem'
                        }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                border: '3px solid rgba(251, 191, 36, 0.3)',
                                borderTopColor: '#fbbf24',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                        </div>

                        <p style={{
                            color: '#94a3b8',
                            fontSize: '1rem',
                            lineHeight: 1.5
                        }}>
                            {status}
                        </p>
                    </>
                )}
            </div>

            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </main>
    );
}

function LoadingFallback() {
    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 10%, #0f172a, #020617)'
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(251, 191, 36, 0.3)',
                borderTopColor: '#fbbf24',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
            }} />
            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </main>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <CallbackContent />
        </Suspense>
    );
}
