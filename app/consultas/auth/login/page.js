"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import SafeChatWidget from '../../../components/SafeChatWidget';
import '../../../globals.css';

// --- STYLES (Hoisted to apply to both Content and Loading) ---
const AuthStyles = () => (
    <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');

        .auth-main { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 10%, #0f172a, #020617); font-family: 'Inter', sans-serif; padding: 2rem; }
        .auth-container { width: 100%; max-width: 420px; position: relative; }
        
        .glass-premium { 
            background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(20px); 
            padding: 3.5rem 3rem; border-radius: 28px; 
            border: 1px solid rgba(255, 255, 255, 0.08); 
            box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6); 
        }

        .brand-header { text-align: center; margin-bottom: 2.5rem; }
        .brand-logo-premium { width: 60px; margin-bottom: 1rem; filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3)); }
        .brand-name-premium { font-family: 'Playfair Display', serif; font-size: 2.2rem; font-weight: 700; color: #fbbf24; margin: 0; }
        .justice-emoji { font-style: normal; font-size: 0.8em; margin-left: 8px; }
        
        .brand-status { color: #94a3b8; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 0.5rem; margin-bottom: 1rem; }
        .brand-desc { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; font-weight: 400; }

        .premium-form { display: flex; flex-direction: column; gap: 1.5rem; }
        .input-field label { display: block; color: #94a3b8; margin-bottom: 0.4rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
        .input-field input { 
            width: 100%; padding: 1rem 1.2rem; background: #020617; 
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; 
            color: white; font-size: 1rem; transition: 0.3s; outline: none;
        }
        .input-field input:focus { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1); }
        
        .btn-gold-action { 
            width: 100%; padding: 1.1rem; background: linear-gradient(135deg, #fbbf24, #d97706); 
            color: #020617; border: none; border-radius: 14px; font-weight: 800; font-size: 0.95rem;
            cursor: pointer; transition: 0.3s; margin-top: 0.5rem;
        }
        .btn-gold-action:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(217, 119, 6, 0.3); }
        .btn-gold-action:disabled { opacity: 0.7; cursor: not-allowed; }

        .divider-premium { text-align: center; position: relative; margin: 2rem 0; }
        .divider-premium::before { content: ''; position: absolute; left: 0; top: 50%; width: 100%; height: 1px; background: rgba(255, 255, 255, 0.05); }
        .divider-premium span { position: relative; background: #0c1222; padding: 0 1rem; color: #475569; font-size: 0.8rem; } 

        .error-premium { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 1rem; border-radius: 12px; font-size: 0.9rem; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 1.5rem; }
        
        .btn-back-premium { position: absolute; top: 2rem; left: 2rem; color: #94a3b8; text-decoration: none; font-size: 0.85rem; font-weight: 500; transition: 0.3s; }
        .btn-back-premium:hover { color: #fbbf24; }

        .auth-nav-footer { text-align: center; font-size: 0.9rem; color: #94a3b8; margin-top: 1rem; }
        .btn-text-gold { background: none; border: none; color: #fbbf24; font-weight: 700; cursor: pointer; margin-left: 0.5rem; font-size: 0.9rem; transition: 0.2s; }
        .btn-text-gold:hover { text-decoration: underline; }

        .confirmed-ui { text-align: center; padding: 1rem 0; }
        .success-icon { font-size: 4rem; margin-bottom: 1.5rem; }
        
        .fade-in { animation: fadeIn 0.8s ease forwards; }
        .slide-up { animation: slideUp 0.6s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        /* PASSWORD TOGGLE STYLES */
        .pass-input-wrapper { position: relative; width: 100%; }
        .eye-toggle-premium { 
            position: absolute; right: 15px; top: 50%; transform: translateY(-50%); 
            background: none; border: none; cursor: pointer; color: #94a3b8; 
            display: flex; align-items: center; justify-content: center;
            opacity: 0.6; transition: 0.3s;
        }
        .eye-toggle-premium:hover { opacity: 1; color: #fbbf24; }
    `}</style>
);

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [confirmedSession, setConfirmedSession] = useState(null);

    const lawyerId = searchParams.get('lawyerId') || searchParams.get('lawyer');
    const cid = searchParams.get('cid');

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                // HARDEN: Block lawyers here too
                if (session.user.user_metadata?.role === 'lawyer') {
                    await supabase.auth.signOut();
                    setError("🚫 Acceso Denegado: Esta área es solo para clientes.");
                    return;
                }

                if (!session.user.email_confirmed_at) {
                    await supabase.auth.signOut();
                    setError("⚠️ Debes confirmar tu email antes de ingresar.");
                    return;
                }
                setIsConfirmed(true);
                setConfirmedSession(session);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    // ... (existing code) ...

    const enterIntake = async () => {
        if (!confirmedSession || !lawyerId) return;
        setLoading(true);
        try {
            const currentCid = cid || crypto.randomUUID();
            console.log("🚀 Syncing session with database...", { cid: currentCid, lawyer: lawyerId });

            let res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: `[SISTEMA: Cliente verificado: ${confirmedSession.user.email}]`,
                    history: [],
                    mode: 'intake',
                    sessionId: currentCid,
                    lawyerId: lawyerId,
                    clientUserId: confirmedSession.user.id,
                    clientEmail: confirmedSession.user.email,
                    clientName: confirmedSession.user.user_metadata?.full_name,
                    clientPhone: confirmedSession.user.user_metadata?.phone
                }),
            });

            // [FRESH START LOGIC] If the inquiry was deleted, generate a new one and retry
            if (res.status === 410) {
                console.warn("⚠️ Inquiry ID was deleted. Starting a fresh session...");
                const newCid = crypto.randomUUID();
                localStorage.removeItem('judic_ia_cid');

                // Retry sync with new CID
                res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: `[SISTEMA: Nuevo cliente registrado: ${confirmedSession.user.email}]`, // Use 'registered' to bypass 410 guard
                        history: [],
                        mode: 'intake',
                        sessionId: newCid,
                        lawyerId: lawyerId,
                        clientUserId: confirmedSession.user.id,
                        clientEmail: confirmedSession.user.email,
                        clientName: confirmedSession.user.user_metadata?.full_name,
                        clientPhone: confirmedSession.user.user_metadata?.phone
                    }),
                });

                if (res.ok) {
                    router.push(`/consultas/${lawyerId}?cid=${newCid}`);
                    return;
                }
            }

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al sincronizar sesión.");
            }

            router.push(`/consultas/${lawyerId}?cid=${currentCid}`);
        } catch (err) {
            console.error("❌ enterIntake Error:", err);
            setError(err.message || "Error al entrar al chat.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (loginError) {
                if (loginError.message === "Invalid login credentials") {
                    throw new Error("Clave de acceso incorrecta. Revisa tus datos.");
                }
                throw loginError;
            }

            // RESTRICT LAWYERS
            if (data.user?.user_metadata?.role === 'lawyer') {
                await supabase.auth.signOut();
                throw new Error("🚫 Acceso Denegado: Esta área es solo para clientes. Los abogados deben ingresar por el panel principal.");
            }

            if (!data.user.email_confirmed_at) {
                await supabase.auth.signOut();
                throw new Error("Email not confirmed");
            }

            const currentCid = cid || crypto.randomUUID();
            console.log("🚀 Syncing login with database...", { cid: currentCid, lawyer: lawyerId });

            let syncRes = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: `[SISTEMA: Intento de ingreso: ${data.user.email}]`,
                    history: [],
                    mode: 'intake',
                    sessionId: currentCid,
                    lawyerId: lawyerId,
                    clientUserId: data.user.id,
                    clientEmail: data.user.email,
                    clientName: data.user.user_metadata?.full_name,
                    clientPhone: data.user.user_metadata?.phone
                }),
            });

            // [FRESH START LOGIC] Handle deleted inquiries during main login
            if (syncRes.status === 410) {
                console.warn("⚠️ Login using deleted CID. Forcing fresh start...");
                const newCid = crypto.randomUUID();
                localStorage.removeItem('judic_ia_cid');

                syncRes = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: `[SISTEMA: Nuevo cliente registrado: ${data.user.email}]`,
                        history: [],
                        mode: 'intake',
                        sessionId: newCid,
                        lawyerId: lawyerId,
                        clientUserId: data.user.id,
                        clientEmail: data.user.email,
                        clientName: data.user.user_metadata?.full_name,
                        clientPhone: data.user.user_metadata?.phone
                    }),
                });

                if (syncRes.ok) {
                    router.push(`/consultas/${lawyerId}?cid=${newCid}`);
                    return;
                }
            }

            if (!syncRes.ok) {
                const errData = await syncRes.json();
                throw new Error(errData.error || "Error al preparar la sesión jurídica.");
            }

            router.push(`/consultas/${lawyerId}?cid=${currentCid}`);
        } catch (err) {
            let msg = err.message;
            if (msg === "Email not confirmed") msg = "Tu correo aún no ha sido verificado. Revisa tu email.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card glass-premium fade-in">
            <Link href="/" className="btn-back-premium">← Volver al Inicio</Link>

            {isConfirmed ? (
                <div className="confirmed-ui slide-up">
                    <div className="success-icon">✅</div>
                    <h1 className="brand-name-premium">¡Bienvenido!</h1>
                    <p className="confirmed-text">Tu sesión jurídica está activa y verificada.</p>
                    <button onClick={enterIntake} className="btn-gold-action" disabled={loading}>
                        {loading ? 'Preparando Sala...' : 'Continuar a Consulta'}
                    </button>
                </div>
            ) : (
                <>
                    <header className="brand-header">
                        <img src="/logo.png" alt="Judic-IA Logo" className="brand-logo-premium" />
                        <h1 className="brand-name-premium">Judic-IA <span className="justice-emoji">⚖️</span></h1>
                        <div className="brand-status">Acceso Seguro • Clientes</div>
                        <p className="brand-desc">Ingresa para continuar con tu asesoría legal automatizada.</p>
                    </header>

                    <form onSubmit={handleLogin} className="premium-form">
                        <div className="input-field">
                            <label>Tu Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                required
                            />
                        </div>
                        <div className="input-field">
                            <label>Tu Clave de Acceso</label>
                            <div className="pass-input-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                                <button type="button" className="eye-toggle-premium" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && <div className="error-premium">⚠️ {error}</div>}

                        <button type="submit" className="btn-gold-action" disabled={loading}>
                            {loading ? 'Validando Acceso...' : 'Ingresar al Chat Seguro'}
                        </button>
                    </form>

                    <div className="divider-premium"><span>o</span></div>

                    <footer className="auth-nav-footer">
                        <p style={{ marginBottom: '0.8rem' }}>
                            <Link href="/forgot-password" className="link-gold" style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.8 }}>
                                ¿Olvidaste tu clave?
                            </Link>
                        </p>
                        <p>¿Aún no tienes una clave?
                            <button type="button" className="btn-text-gold" onClick={() => router.push(`/consultas/auth/register?${searchParams.toString()}`)}>
                                Crear Nueva Clave
                            </button>
                        </p>
                    </footer>
                </>
            )}
        </div>
    );
}

function LoadingFallback() {
    return (
        <div className="auth-card glass-premium">
            <header className="brand-header">
                <div className="brand-logo-premium" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
                <div style={{ height: '30px', width: '60%', margin: '0 auto 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                <div style={{ height: '20px', width: '40%', margin: '0 auto', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
            </header>
            <div className="premium-form" style={{ gap: '2rem' }}>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
            </div>
        </div>
    );
}

export default function ClientLoginPage() {
    return (
        <main className="auth-main">
            <AuthStyles />
            <div className="auth-container">
                <Suspense fallback={<LoadingFallback />}>
                    <LoginContent />
                </Suspense>
            </div>
            {/* Global Fixed Widget */}
            <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
                <SafeChatWidget mode="client_help" initialMessage="¿Problemas para ingresar? Pregúntame." />
            </div>
        </main>
    );
}
