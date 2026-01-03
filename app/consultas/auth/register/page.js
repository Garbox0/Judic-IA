"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import '../../../globals.css';

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
                if (!session.user.email_confirmed_at) {
                    await supabase.auth.signOut();
                    setMessage("⚠️ Debes confirmar tu email desde la bandeja de entrada para acceder.");
                    return;
                }
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
                    emailRedirectTo: fullRedirectUrl,
                    data: { role: 'client' }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes("already registered")) {
                    throw new Error("Este email ya tiene una clave. Por favor inicia sesión.");
                }
                throw signUpError;
            }

            if (data.session && data.user.email_confirmed_at) {
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
                setMessage("¡Cuenta creada! Revisa tu email para confirmar tu cuenta y acceder al chat.");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-main">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
            `}</style>

            <div className="auth-container">
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
                                <div className="brand-icon-premium">🛡️</div>
                                <h1 className="brand-name-premium">Protege tu Consulta</h1>
                                <p className="brand-status">Acceso Seguro • Clientes</p>
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
            </div>

            <style jsx>{`
                .auth-main { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 10%, #0f172a, #020617); font-family: 'Inter', sans-serif; padding: 2rem; }
                .auth-container { width: 100%; max-width: 440px; position: relative; }

                .glass-premium {
                    background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(25px);
                    padding: 4rem 3rem; border-radius: 32px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);
                }

                .brand-header { text-align: center; margin-bottom: 2.5rem; }
                .brand-icon-premium { font-size: 3.5rem; margin-bottom: 1rem; filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3)); }
                .brand-name-premium { font-family: 'Playfair Display', serif; font-size: 2.2rem; font-weight: 900; color: #fbbf24; margin-bottom: 0.5rem; }
                .brand-status { color: #64748b; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 1rem; }
                .brand-desc { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; font-weight: 400; }

                .premium-form { display: flex; flex-direction: column; gap: 1.5rem; }
                .input-field label { display: block; color: #cbd5e1; margin-bottom: 0.6rem; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
                .input-field input {
                    width: 100%; padding: 1.1rem 1.25rem; background: rgba(2, 6, 23, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px;
                    color: white; font-size: 1rem; transition: 0.3s; outline: none;
                }
                .input-field input:focus { border-color: #fbbf24; background: rgba(2, 6, 23, 0.8); box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1); }

                .btn-gold-action {
                    width: 100%; padding: 1.1rem; background: linear-gradient(135deg, #fbbf24, #d97706);
                    color: #020617; border: none; border-radius: 14px; font-weight: 800; font-size: 1rem;
                    cursor: pointer; transition: 0.4s; box-shadow: 0 10px 25px rgba(217, 119, 6, 0.3); text-transform: uppercase;
                }
                .btn-gold-action:hover { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(217, 119, 6, 0.4); filter: brightness(1.1); }
                .btn-gold-action:disabled { opacity: 0.6; cursor: not-allowed; }

                .divider-premium { text-align: center; position: relative; margin: 2rem 0; }
                .divider-premium::before { content: ''; position: absolute; left: 0; top: 50%; width: 100%; height: 1px; background: rgba(255, 255, 255, 0.05); }
                .divider-premium span { position: relative; background: #0f172a; padding: 0 1rem; color: #475569; font-size: 0.8rem; }

                .error-premium { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 1rem; border-radius: 12px; font-size: 0.9rem; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 1.5rem; }
                .success-premium {
                    background: rgba(34, 197, 94, 0.1);
                    color: #86efac;
                    padding: 1rem;
                    border-radius: 12px;
                    font-size: 0.9rem;
                    text-align: center;
                    border: 1px solid rgba(34, 197, 94, 0.2);
                    margin-bottom: 1.5rem;
                }

                .btn-back-premium { position: absolute; top: 1.5rem; left: 1.5rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 600; transition: 0.3s; }
                .btn-back-premium:hover { color: #fbbf24; }

                .auth-nav-footer { text-align: center; font-size: 0.9rem; color: #94a3b8; }
                .btn-text-gold { background: none; border: none; color: #fbbf24; font-weight: 700; cursor: pointer; margin-left: 0.5rem; font-size: 0.9rem; transition: 0.2s; }
                .btn-text-gold:hover { text-decoration: underline; color: #f59e0b; }

                .confirmed-ui { text-align: center; padding: 2rem 0; }
                .success-icon { font-size: 5rem; margin-bottom: 1.5rem; }
                .confirmed-text { color: #94a3b8; margin-bottom: 2.5rem; font-size: 1.1rem; }
                
                .fade-in { animation: fadeIn 0.5s ease forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </main>
    );
}

export default function ClientRegisterPage() {
    return (
        <Suspense fallback={<div className="auth-card glass-panel" style={{ textAlign: 'center' }}>Cargando protección...</div>}>
            <RegisterContent />
        </Suspense>
    );
}
