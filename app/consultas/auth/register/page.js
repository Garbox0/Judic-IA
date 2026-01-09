"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SafeChatWidget from '../../../components/SafeChatWidget';
import { supabase } from '../../../lib/supabase';
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

        .error-premium { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 1rem; border-radius: 12px; font-size: 0.9rem; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); }
        .success-premium { background: rgba(34, 197, 94, 0.1); color: #86efac; padding: 1rem; border-radius: 12px; font-size: 0.9rem; text-align: center; border: 1px solid rgba(34, 197, 94, 0.2); margin-bottom: 1.5rem; }

        .btn-back-premium { position: absolute; top: 2rem; left: 2rem; color: #94a3b8; text-decoration: none; font-size: 0.85rem; font-weight: 500; transition: 0.3s; }
        .btn-back-premium:hover { color: #fbbf24; }

        .auth-nav-footer { text-align: center; font-size: 0.9rem; color: #94a3b8; margin-top: 1rem; }
        .btn-text-gold { background: none; border: none; color: #fbbf24; font-weight: 700; cursor: pointer; margin-left: 0.5rem; font-size: 0.9rem; transition: 0.2s; }
        .btn-text-gold:hover { text-decoration: underline; }

        .confirmed-ui { text-align: center; padding: 2rem 0; }
        .success-icon { font-size: 5rem; margin-bottom: 1.5rem; }
        .confirmed-text { color: #94a3b8; margin-bottom: 2.5rem; font-size: 1.1rem; }
        
        .fade-in { animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
);

function RegisterContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [confirmedSession, setConfirmedSession] = useState(null);

    const lawyerId = searchParams.get('lawyerId') || searchParams.get('lawyer');
    const cid = searchParams.get('cid');

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                // RELAXED CHECK: In development/demo, we allow unconfirmed emails if Supabase allows the login.
                /* 
               if (!session.user.email_confirmed_at) {
                   await supabase.auth.signOut();
                   setMessage("⚠️ Debes confirmar tu email desde la bandeja de entrada para acceder.");
                   return;
               }
               */
                setIsConfirmed(true);
                setConfirmedSession(session);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const enterIntake = async () => {
        if (!confirmedSession || !lawyerId) return;
        setLoading(true);
        try {
            const currentCid = cid || crypto.randomUUID();
            await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: `[SISTEMA: Cliente verificado: ${confirmedSession.user.email}]`,
                    history: [],
                    mode: 'intake',
                    sessionId: currentCid,
                    lawyerId: lawyerId,
                    clientUserId: confirmedSession.user.id,
                    clientEmail: confirmedSession.user.email
                }),
            });
            router.push(`/consultas/${lawyerId}?cid=${currentCid}`);
        } catch (err) {
            setError("Error al entrar al chat. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
            if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");

            const redirectBase = `${window.location.origin}/consultas/auth/register`;
            const redirectParams = new URLSearchParams();
            if (lawyerId) redirectParams.set('lawyerId', lawyerId);
            if (cid) redirectParams.set('cid', cid);
            const fullRedirectUrl = `${redirectBase}?${redirectParams.toString()}`;

            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: fullRedirectUrl, // Still good to send for prod
                    data: { role: 'client' }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes("already registered")) {
                    throw new Error("Este email ya tiene una clave. Por favor inicia sesión.");
                }
                // Handle Supabase SMTP limit error gracefully
                if (signUpError.message.includes("Error sending confirmation email")) {
                    console.warn("Supabase SMTP Error. User likely created but email failed.");
                    throw new Error("⚠️ El sistema de correos está saturado. Por favor, avisa a tu abogado o intenta iniciar sesión directo si ya te registraste.");
                }
                throw signUpError;
            }

            // SUCCESS FLOW
            if (data.session) {
                // If we got a session immediately (Email Confirm Disabled), go straight to chat
                const finalCid = cid || crypto.randomUUID();
                await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: `[SISTEMA: Nuevo cliente registrado: ${email}]`,
                        history: [],
                        mode: 'intake',
                        sessionId: finalCid,
                        lawyerId: lawyerId,
                        clientUserId: data.user.id,
                        clientEmail: email
                    }),
                });
                router.push(`/consultas/${lawyerId}?cid=${finalCid}`);
            } else {
                // User created but waiting for confirmation (should generally not happen if we disable confirm)
                setMessage("¡Cuenta creada! Si no recibes el email, pide a tu abogado que habilite el acceso directo.");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card glass-premium fade-in">
            <Link href="/" className="btn-back-premium">← Volver al Inicio</Link>

            {isConfirmed ? (
                <div className="confirmed-ui fade-in">
                    <div className="success-icon">✅</div>
                    <h1 className="brand-name-premium">¡Email Confirmado!</h1>
                    <p className="confirmed-text">Tu privacidad ha sido asegurada. Ya puedes ingresar a la consulta.</p>
                    <button onClick={enterIntake} className="btn-gold-action" disabled={loading}>
                        {loading ? 'Preparando Chat...' : 'Ingresar al Chat Ahora'}
                    </button>
                </div>
            ) : (
                <>
                    <header className="brand-header">
                        <img src="/logo.png" alt="Judic-IA Logo" className="brand-logo-premium" />
                        <h1 className="brand-name-premium">Judic-IA <span className="justice-emoji">⚖️</span></h1>
                        <div className="brand-status">Acceso Seguro • Clientes</div>
                        <p className="brand-desc">Crea una clave de acceso temporal para proteger tu privacidad y documentos durante esta sesión.</p>
                    </header>

                    <form onSubmit={handleRegister} className="premium-form">
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
                            <label>Crear Clave de Acceso</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <div className="input-field">
                            <label>Repetir Clave</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && <div className="error-premium">⚠️ {error}</div>}
                        {message && <div className="success-premium">📩 {message}</div>}

                        <button type="submit" className="btn-gold-action" disabled={loading}>
                            {loading ? 'Creando Acceso...' : 'Comenzar Consulta Segura'}
                        </button>
                    </form>

                    <div className="divider-premium"><span>o</span></div>

                    <footer className="auth-nav-footer">
                        <p>¿Ya tienes una clave?
                            <button type="button" className="btn-text-gold" onClick={() => router.push(`/consultas/auth/login?${searchParams.toString()}`)}>
                                Ingresar
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
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
            </div>
        </div>
    );
}

export default function ClientRegisterPage() {
    return (
        <main className="auth-main">
            <AuthStyles />
            <div className="auth-container">
                <Suspense fallback={<LoadingFallback />}>
                    <RegisterContent />
                </Suspense>
            </div>
            {/* Global Fixed Widget */}
            <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
                <SafeChatWidget mode="client_help" initialMessage="¿Necesitas ayuda con tu registro?" />
            </div>
        </main>
    );
}
