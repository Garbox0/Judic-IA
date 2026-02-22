"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Image from 'next/image';

export default function TwoFactorVerifyPage() {
    const router = useRouter();
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [resending, setResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef([]);

    useEffect(() => {
        // Verificar que haya sesión activa
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                router.replace('/login');
                return;
            }

            // Si ya verificó (two_fa_verified_at en JWT), ir al dashboard
            if (session.user.app_metadata?.two_fa_verified_at) {
                router.replace('/dashboard');
                return;
            }

            setEmail(session.user.email);
        });
    }, [router]);

    useEffect(() => {
        if (resendCooldown > 0) {
            const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
            return () => clearTimeout(t);
        }
    }, [resendCooldown]);

    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...otp];
        next[index] = value.slice(-1);
        setOtp(next);
        setError('');

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setOtp(pasted.split(''));
            inputRefs.current[5]?.focus();
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) {
            setError('Ingresá los 6 dígitos del código.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.replace('/login'); return; }

            const res = await fetch('/api/auth/2fa', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ otp: code, purpose: 'login' })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Código inválido.');
                setOtp(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
                return;
            }

            // Refrescar JWT para que incluya two_fa_verified_at en app_metadata
            await supabase.auth.refreshSession();
            router.replace('/dashboard');

        } catch {
            setError('Error de conexión. Intentá de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setResending(true);
        setError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.replace('/login'); return; }

            await fetch('/api/auth/2fa', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ purpose: 'login' })
            });

            setResendCooldown(60);
        } catch {
            setError('Error al reenviar el código.');
        } finally {
            setResending(false);
        }
    };

    return (
        <main style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#020617', fontFamily: 'system-ui, sans-serif'
        }}>
            <div style={{
                width: '100%', maxWidth: '420px', margin: '0 1rem',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '24px',
                padding: '2.5rem 2rem',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Image src="/judic-ia-mark.png" alt="Logo" width={40} height={54} style={{ marginBottom: '1rem' }} />
                    <h1 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                        Verificación
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                        Ingresá el código de 6 dígitos que enviamos a{' '}
                        <strong style={{ color: '#cbd5e1' }}>{email}</strong>
                    </p>
                </div>

                {/* OTP Input */}
                <form onSubmit={handleVerify}>
                    <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        {otp.map((digit, i) => (
                            <input
                                key={i}
                                ref={el => inputRefs.current[i] = el}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={e => handleOtpChange(i, e.target.value)}
                                onKeyDown={e => handleKeyDown(i, e)}
                                onPaste={i === 0 ? handlePaste : undefined}
                                aria-label={`Dígito ${i + 1}`}
                                style={{
                                    width: '48px', height: '56px',
                                    textAlign: 'center', fontSize: '1.4rem', fontWeight: 700,
                                    borderRadius: '12px',
                                    border: `2px solid ${digit ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.1)'}`,
                                    background: 'rgba(15,23,42,0.6)',
                                    color: 'white',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    caretColor: '#fbbf24'
                                }}
                            />
                        ))}
                    </div>

                    {error && (
                        <p style={{
                            color: '#fca5a5', fontSize: '0.85rem', textAlign: 'center',
                            marginBottom: '1rem', background: 'rgba(239,68,68,0.1)',
                            padding: '0.6rem 1rem', borderRadius: '8px',
                            border: '1px solid rgba(239,68,68,0.2)'
                        }} role="alert">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading || otp.join('').length < 6}
                        style={{
                            width: '100%', padding: '0.85rem',
                            borderRadius: '12px', border: 'none',
                            background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                            color: '#0f172a', fontWeight: 700, fontSize: '0.95rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: (loading || otp.join('').length < 6) ? 0.6 : 1,
                            transition: 'opacity 0.2s'
                        }}
                    >
                        {loading ? 'Verificando...' : 'Verificar acceso'}
                    </button>
                </form>

                {/* Reenviar */}
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
                        ¿No recibiste el código?
                    </p>
                    <button
                        onClick={handleResend}
                        disabled={resending || resendCooldown > 0}
                        style={{
                            background: 'none', border: 'none',
                            color: resendCooldown > 0 ? '#475569' : '#fbbf24',
                            fontSize: '0.85rem', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                            fontWeight: 600, textDecoration: 'underline'
                        }}
                    >
                        {resending ? 'Enviando...' : resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
                    </button>
                </div>

                {/* Cancelar */}
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            router.replace('/login');
                        }}
                        style={{
                            background: 'none', border: 'none',
                            color: '#475569', fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        Cancelar e ingresar con otra cuenta
                    </button>
                </div>
            </div>
        </main>
    );
}
