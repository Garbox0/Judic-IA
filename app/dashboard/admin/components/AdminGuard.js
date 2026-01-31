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
    const router = useRouter(); // Hook

    useEffect(() => {
        // Check session storage
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
            // Use the singleton directly
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
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <ShieldCheck size={48} className="text-slate-700" />
                    <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em]">Verificando Credenciales...</p>
                </div>
            </div>
        );
    }

    if (verified) return children;

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px]" />
            </div>

            <div className="max-w-md w-full glass-card p-12 relative z-10 flex flex-col items-center text-center space-y-8 border-white/10 shadow-2xl">
                <div className="w-20 h-20 bg-slate-900/50 rounded-full flex items-center justify-center border border-white/5 mb-2 relative">
                    <div className="absolute inset-0 rounded-full border border-gold/20 animate-ping opacity-20" />
                    <Lock size={32} className="text-gold" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-white tracking-tighter">Acceso Restringido</h1>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed">
                        Estas ingresando a una zona de alta seguridad. <br />
                        Nivel de autorización: <span className="text-gold font-bold">ADMINISTRADOR</span>
                    </p>
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs font-bold w-full">
                        ⚠️ {error}
                    </div>
                )}

                {step === 'initial' ? (
                    <div className="w-full space-y-4">
                        <button
                            onClick={sendOtp}
                            disabled={loading}
                            className="group w-full py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-gold hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                        >
                            {loading ? 'Enviando...' : (
                                <>
                                    Solicitar Código de Acceso <Mail size={14} />
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:text-white flex items-center justify-center gap-2 w-full py-2"
                        >
                            <LogOut size={12} /> Salir del Admin
                        </button>
                    </div>
                ) : (
                    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block text-left">
                                Código de Verificación
                            </label>
                            <input
                                type="text"
                                placeholder="123456"
                                value={otp}
                                onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-gold/50 transition-colors"
                                autoFocus
                            />
                            <p className="text-[10px] text-slate-500">
                                Enviado a <span className="text-white">{email}</span>
                            </p>
                        </div>

                        <button
                            onClick={verifyOtp}
                            disabled={otp.length !== 6 || loading}
                            className="w-full py-4 bg-gold text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-amber-400 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                        >
                            {loading ? 'Verificando...' : (
                                <>
                                    Desbloquear Panel <ArrowRight size={14} />
                                </>
                            )}
                        </button>

                        <div className="flex justify-between items-center w-full px-2">
                            <button
                                onClick={() => setStep('initial')}
                                className="text-[10px] text-slate-600 hover:text-white uppercase tracking-wider font-bold"
                            >
                                Reenviar
                            </button>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="text-[10px] text-rose-500/50 hover:text-rose-500 uppercase tracking-wider font-bold flex items-center gap-1"
                            >
                                <LogOut size={10} /> Salir
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
