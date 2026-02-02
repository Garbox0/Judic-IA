"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import SafeChatWidget from '../../../components/SafeChatWidget';
import '../../../globals.css';

import './login.css';

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

    // Get lawyerId and cid from URL or localStorage fallback
    const [lawyerId, setLawyerId] = useState(null);
    const [cid, setCid] = useState(null);
    const [confirmationMessage, setConfirmationMessage] = useState(null);
    const [theme, setTheme] = useState('light');

    // Load theme from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('app-theme') || 'light';
        setTheme(savedTheme);
    }, []);

    // Update body class when theme changes
    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    useEffect(() => {
        const urlLawyer = searchParams.get('lawyerId') || searchParams.get('lawyer');
        const urlCid = searchParams.get('cid');
        const justConfirmed = searchParams.get('confirmed') === 'true';
        const urlError = searchParams.get('error');

        // Show confirmation success message
        if (justConfirmed) {
            setConfirmationMessage("¡Email confirmado! Ahora ingresa con tu email y contraseña.");
        }

        // Handle error params from callback
        if (urlError === 'link_expired') {
            setError("El enlace de confirmación expiró o ya fue utilizado. Ingresa tus credenciales para continuar.");
        } else if (urlError === 'auth_error') {
            setError("Error de autenticación. Ingresa tus credenciales para continuar.");
        }

        // Fallback to localStorage if URL params are missing
        const storedLawyer = localStorage.getItem('judic_ia_lawyer_id');
        const storedCid = localStorage.getItem('judic_ia_cid');

        const finalLawyer = urlLawyer || storedLawyer;
        const finalCid = urlCid || storedCid;

        if (finalLawyer) {
            setLawyerId(finalLawyer);
            localStorage.setItem('judic_ia_lawyer_id', finalLawyer);
        }
        if (finalCid) {
            setCid(finalCid);
            localStorage.setItem('judic_ia_cid', finalCid);
        }
    }, [searchParams]);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                // HARDEN: Block lawyers here too
                if (session.user.user_metadata?.role === 'lawyer') {
                    await supabase.auth.signOut();
                    setError("Acceso Denegado: Esta área es solo para clientes.");
                    return;
                }

                if (!session.user.email_confirmed_at) {
                    await supabase.auth.signOut();
                    setError("Debes confirmar tu email antes de ingresar.");
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
                    clientPhone: confirmedSession.user.user_metadata?.phone,
                    syncOnly: true // Don't generate AI response, just sync session
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
                        clientPhone: confirmedSession.user.user_metadata?.phone,
                        syncOnly: true
                    }),
                });

                if (res.ok) {
                    router.push(`/consultas/${lawyerId}?cid=${newCid}`);
                    return;
                }
            }

            if (!res.ok) {
                let errorMsg = "Error al sincronizar sesión.";
                try {
                    const errData = await res.json();
                    errorMsg = errData.error || errorMsg;
                } catch (e) {
                    console.error("❌ Failed to parse error JSON:", e);
                    const text = await res.text();
                    console.log("📄 Raw response:", text);
                }
                throw new Error(errorMsg);
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
                throw new Error("Acceso Denegado: Esta área es solo para clientes. Los abogados deben ingresar por el panel principal.");
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
                    clientPhone: data.user.user_metadata?.phone,
                    syncOnly: true
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
                        clientPhone: data.user.user_metadata?.phone,
                        syncOnly: true
                    }),
                });

                if (syncRes.ok) {
                    router.push(`/consultas/${lawyerId}?cid=${newCid}`);
                    return;
                }
            }

            if (!syncRes.ok) {
                let errorMsg = "Error al preparar la sesión jurídica.";
                try {
                    const errData = await syncRes.json();
                    errorMsg = errData.error || errorMsg;
                } catch (e) {
                    console.error("❌ Failed to parse sync error JSON:", e);
                }
                throw new Error(errorMsg);
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

    const [homeUrl, setHomeUrl] = useState('https://judic-ia.com/?public=true');

    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
            setHomeUrl('/');
        }
    }, []);

    return (
        <>
            <a href={homeUrl} className="btn-back-premium">← Volver al Inicio</a>

            <button
                onClick={toggleTheme}
                className="theme-toggle-auth"
                aria-label="Alternar tema"
                style={{
                    position: 'fixed',
                    top: '2rem',
                    right: '2rem',
                    zIndex: 100,
                    background: 'transparent',
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                    color: theme === 'dark' ? '#fbbf24' : '#0f172a',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                }}
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="auth-card glass-premium fade-in">

                {isConfirmed ? (
                    <div className="confirmed-ui slide-up">
                        <div className="success-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                        <h1 className="brand-name-premium">¡Bienvenido!</h1>
                        <p className="confirmed-text">Tu sesión jurídica está activa y verificada.</p>
                        <button onClick={enterIntake} className="btn-gold-action" disabled={loading}>
                            {loading ? 'Preparando Sala...' : 'Continuar a Consulta'}
                        </button>
                    </div>
                ) : (
                    <>
                        <header className="brand-header">
                            <Image
                                src="/judic-ia-mark.png"
                                alt="Judic-IA Logo"
                                className="brand-logo-premium"
                                width={48}
                                height={64}
                                style={{ objectFit: 'contain' }}
                            />
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

                            {confirmationMessage && <div className="success-premium">{confirmationMessage}</div>}
                            {error && <div className="error-premium">{error}</div>}

                            <button type="submit" className="btn-gold-action" disabled={loading}>
                                {loading ? 'Validando Acceso...' : 'Ingresar al Chat Seguro'}
                            </button>
                        </form>

                        <footer className="auth-nav-footer">
                            <p className="footer-link-wrapper">
                                <Link href="/auth/forgot-password" className="link-gold footer-link">
                                    ¿Olvidaste tu clave?
                                </Link>
                            </p>
                            <p className="footer-note-wrapper">
                                ¿Aún no tienes una clave? <span className="highlight-gold">Solicita el enlace de acceso a tu abogado profesional.</span>
                            </p>
                        </footer>
                    </>
                )}
            </div>
        </>
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
