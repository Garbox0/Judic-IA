'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, ArrowRight, Mail, LogOut } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';

export default function AdminGuard({ children }) {
    const [verified, setVerified] = useState(false);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState('initial'); // initial, sent, verified
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    useEffect(() => {
        const isVerified = sessionStorage.getItem('admin_access_token');
        if (isVerified === 'granted') {
            setVerified(true);
        }
        setLoading(false);
    }, []);

    const sendOtp = async () => {
        setLoading(true);
        setError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) throw new Error('No has iniciado sesión.');

            const res = await fetch('/api/admin/auth/send-otp', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error enviando código');

            setStep('sent');
            setEmail(data.email || 'tu correo');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Código inválido');

            sessionStorage.setItem('admin_access_token', 'granted');
            setVerified(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !verified && step === 'initial') {
        return (
            <div className="admin-page-root flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-6">
                    <ShieldCheck size={64} className="text-admin-muted opacity-20" />
                    <p className="text-admin-muted text-[10px] font-black uppercase tracking-[0.4em]">Sincronizando Protocolos de Seguridad...</p>
                </div>
            </div>
        );
    }

    if (verified) return children;

    return (
        <div className="admin-page-root flex items-center justify-center min-vh-100">
            <div className="auth-page-root relative overflow-hidden flex items-center justify-center w-full">
                {/* Background Effects */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]" />
                </div>

                <div className="glass-card auth-card animate-in fade-in zoom-in duration-700 relative z-10">
                    <div className="auth-icon-wrapper mx-auto">
                        <div className="absolute inset-0 rounded-[24px] border border-gold/20 animate-ping opacity-20" />
                        <Lock size={32} className="text-gold" />
                    </div>

                    <div className="space-y-3 mt-8">
                        <div className="flex items-center justify-center gap-2 text-admin-muted text-[10px] font-black uppercase tracking-[0.4em]">
                            <ShieldCheck size={12} className="text-blue" />
                            <span>Acceso Restringido</span>
                        </div>
                        <h1 className="text-4xl font-black text-admin-primary tracking-tighter">Verificación OTP</h1>
                        <p className="text-admin-secondary text-xs font-medium leading-relaxed max-w-[280px] mx-auto">
                            Esta es una zona de alta seguridad. Ingresa el código enviado a tu correo.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-rose/10 border border-rose/20 text-rose px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-wider w-full animate-in slide-in-from-top-2 mt-6">
                            ⚠️ {error}
                        </div>
                    )}

                    {step === 'initial' ? (
                        <div className="w-full space-y-4 mt-8">
                            <button
                                onClick={sendOtp}
                                disabled={loading}
                                className="premium-btn gold w-full justify-center h-14"
                            >
                                {loading ? 'Solicitando...' : (
                                    <>
                                        Solicitar Código <Mail size={16} />
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="flex items-center justify-center gap-2 text-admin-muted text-[10px] font-black uppercase tracking-[0.2em] hover:text-admin-primary transition-colors w-full py-2"
                            >
                                <LogOut size={12} /> Salir del Centro de Mando
                            </button>
                        </div>
                    ) : (
                        <div className="w-full space-y-8 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-admin-muted block text-left pl-2">
                                    Código de 6 Dígitos
                                </label>
                                <input
                                    type="text"
                                    placeholder="000000"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                    className="auth-input-otp"
                                    autoFocus
                                />
                                <div className="flex items-center justify-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                                    <Mail size={12} className="text-blue" />
                                    <p className="text-[10px] text-admin-secondary font-bold truncate max-w-[220px]">
                                        Enviado a {email}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={verifyOtp}
                                    disabled={otp.length !== 6 || loading}
                                    className="premium-btn gold w-full justify-center h-14 shadow-lg shadow-gold/20"
                                >
                                    {loading ? 'Verificando...' : (
                                        <>
                                            Desbloquear Panel <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>

                                <div className="flex justify-between items-center w-full px-2">
                                    <button
                                        onClick={() => setStep('initial')}
                                        className="text-[10px] text-admin-muted hover:text-admin-primary uppercase tracking-widest font-black transition-colors"
                                    >
                                        Reenviar Código
                                    </button>
                                    <button
                                        onClick={() => router.push('/dashboard')}
                                        className="text-[10px] text-rose/60 hover:text-rose uppercase tracking-widest font-black flex items-center gap-2 transition-colors"
                                    >
                                        <LogOut size={12} /> Abortar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
