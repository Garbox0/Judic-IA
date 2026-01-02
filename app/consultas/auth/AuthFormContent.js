"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function AuthFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLogin, setIsLogin] = useState(false); // Default to Register for new clients
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [restricted, setRestricted] = useState(false); // Restricted access state
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [confirmedSession, setConfirmedSession] = useState(null);

    // Get context from URL
    const lawyerId = searchParams.get('lawyerId') || searchParams.get('lawyer');
    const cid = searchParams.get('cid');

    // Handle Detection of invalid/deleted access
    useEffect(() => {
        // 1. Check if the URL has an error from Supabase (e.g. invalid invite/confirmation)
        const errorCode = searchParams.get('error');
        const errorDesc = searchParams.get('error_description');
        if (errorCode === 'access_denied' || errorDesc?.includes('expired') || errorDesc?.includes('invalid')) {
            setRestricted(true);
        }

        // 2. CID Validation REMOVED
        // We allow entry to the auth form for any link.
        // If the lawyer id is genuinely missing, we handle it during/after login.
        // This prevents RLS blocks for anonymous clients.
    }, [searchParams, cid, lawyerId]);

    // Redirect out if restricted
    useEffect(() => {
        if (restricted) {
            const timer = setTimeout(() => {
                router.push('/');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [restricted, router]);

    // Handle Email Confirmation Return & Auto-Redirect (Now Manual as requested)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                console.log("⚡ Auth Event: SIGNED_IN", session.user.email);

                // STRICT: Enforce Email Confirmation
                if (!session.user.email_confirmed_at) {
                    console.warn("🔒 Acceso bloqueado: Email no confirmado.");
                    await supabase.auth.signOut();
                    setMessage("⚠️ Debes confirmar tu email desde la bandeja de entrada para acceder.");
                    setIsLogin(true);
                    return;
                }

                // If confirmed, show the "Success" UI instead of auto-pushing
                setIsConfirmed(true);
                setConfirmedSession(session);
                setMessage(null);
                setError(null);
            }
        });

        return () => subscription.unsubscribe();
    }, [lawyerId, searchParams, router]);

    const enterIntake = async () => {
        if (!confirmedSession || !lawyerId) return;
        setLoading(true);

        try {
            const currentCid = searchParams.get('cid') || crypto.randomUUID();

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

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (!email || !password) throw new Error("Por favor completa todos los campos.");

            if (isLogin) {
                // LOGIN
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;

                const finalUser = signInData.user;

                // STRICT CHECK
                if (!finalUser.email_confirmed_at) {
                    await supabase.auth.signOut();
                    throw new Error("Email not confirmed");
                }

                const finalCid = cid || crypto.randomUUID();

                if (lawyerId && finalUser) {
                    await fetch("/api/chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            message: `[SISTEMA: Nuevo cliente registrado: ${email}]`,
                            history: [],
                            mode: 'intake',
                            sessionId: finalCid,
                            lawyerId: lawyerId,
                            clientUserId: finalUser.id,
                            clientEmail: email
                        }),
                    });
                }

                if (lawyerId) {
                    router.push(`/consultas/${lawyerId}?cid=${finalCid}`);
                } else {
                    router.push('/');
                }

            } else {
                // REGISTER
                if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
                if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");

                const redirectBase = `${window.location.origin}/consultas/auth`;
                const redirectParams = new URLSearchParams();
                if (lawyerId) redirectParams.set('lawyerId', lawyerId);
                if (cid) redirectParams.set('cid', cid);
                const fullRedirectUrl = `${redirectBase}?${redirectParams.toString()}`;

                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: fullRedirectUrl
                    }
                });
                if (signUpError) throw signUpError;

                if (data.session) {
                    // Even if session exists, enforce confirmation
                    if (!data.user.email_confirmed_at) {
                        await supabase.auth.signOut();
                        setMessage("¡Cuenta creada! Revisa tu email para confirmar tu cuenta y acceder al chat.");
                        setIsLogin(true);
                        return; // STOP HERE
                    }

                    const finalCid = cid || crypto.randomUUID();
                    const finalUser = data.user;

                    if (lawyerId && finalUser) {
                        await fetch("/api/chat", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                message: `[SISTEMA: Nuevo cliente registrado: ${email}]`,
                                history: [],
                                mode: 'intake',
                                sessionId: finalCid,
                                lawyerId: lawyerId,
                                clientUserId: finalUser.id,
                                clientEmail: email
                            }),
                        });
                        router.push(`/consultas/${lawyerId}?cid=${finalCid}`);
                    } else {
                        router.push('/');
                    }
                } else {
                    setMessage("¡Cuenta creada! Revisa tu email para confirmar tu cuenta y acceder al chat.");
                    setIsLogin(true);
                }
            }

        } catch (err) {
            let msg = err.message;
            if (msg === "Email not confirmed") msg = "El correo electrónico no ha sido confirmado aún. Revisa tu bandeja de entrada.";
            if (msg === "Invalid login credentials") msg = "Credenciales inválidas. Revisa tu email y contraseña.";
            if (msg === "Access denied") msg = "Acceso denegado. Este enlace puede haber expirado o no es válido.";
            if (msg.includes("only request this after")) {
                const seconds = msg.match(/\d+/);
                msg = `Por razones de seguridad, debes esperar ${seconds} segundos antes de reintentar.`;
            }
            if (msg.includes("Signup is disabled")) msg = "El registro está deshabilitado temporalmente.";

            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (restricted) {
        return (
            <div className="auth-container">
                <div className="auth-card glass-panel restricted-card">
                    <div className="logo-icon">🔒</div>
                    <h1>Acceso Restringido</h1>
                    <p>Este enlace de consulta ya no es válido, ha expirado o el acceso ha sido revocado por el profesional.</p>
                    <div className="redirect-hint">
                        Redirigiendo a la página principal en 5 segundos...
                    </div>
                    <button onClick={() => router.push('/')} className="btn-secondary">Volver Ahora</button>
                </div>
                <style jsx>{`
                    .restricted-card { text-align: center; border-color: rgba(239, 68, 68, 0.3) !important; }
                    .restricted-card h1 { color: #fca5a5; margin-bottom: 1rem; }
                    .redirect-hint { margin: 2rem 0; font-size: 0.85rem; color: #94a3b8; font-style: italic; }
                    .btn-secondary { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 0.8rem 1.5rem; border-radius: 10px; cursor: pointer; }
                `}</style>
            </div>
        )
    }

    return (
        <div className="auth-container">
            <div className="auth-card glass-panel">
                {isConfirmed ? (
                    <div className="confirmed-ui" style={{ textAlign: 'center', py: '2rem' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✅</div>
                        <h1 style={{ color: '#86efac', marginBottom: '1rem' }}>¡Email Confirmado!</h1>
                        <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6' }}>
                            Tu cuenta ha sido verificada correctamente. Ya puedes acceder a la consulta con el asistente IA del estudio.
                        </p>
                        <button onClick={enterIntake} className="btn-primary" disabled={loading}>
                            {loading ? 'Preparando Chat...' : 'Ingresar al Chat Ahora'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="auth-header">
                            <div className="logo-icon">⚖️</div>
                            <h1>{isLogin ? 'Ingresar a Consulta' : 'Proteger Consulta'}</h1>
                            <p>
                                {isLogin
                                    ? 'Ingresa tu clave para ver el estado de tu caso.'
                                    : 'Establece una clave temporal para proteger tu privacidad y documentos.'}
                            </p>
                        </div>

                        <form onSubmit={handleAuth} className="auth-form">
                            <div className="input-group">
                                <label>Tu Email (para notificaciones)</label>
                                <input
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label>Crear Clave de Acceso</label>
                                <input
                                    type="password"
                                    placeholder="••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            {!isLogin && (
                                <div className="input-group">
                                    <label>Repetir Clave</label>
                                    <input
                                        type="password"
                                        placeholder="••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            )}

                            {error && <div className="error-msg">⚠️ {error}</div>}
                            {message && <div className="success-msg">✅ {message}</div>}

                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Procesando...' : (isLogin ? 'Ingresar al Chat' : 'Comenzar Consulta Segura')}
                            </button>
                        </form>

                        <div className="auth-footer">
                            <p>
                                {isLogin ? '¿No tienes clave aún?' : '¿Ya tienes una clave?'}
                                <button type="button" onClick={() => setIsLogin(!isLogin)} className="link-btn">
                                    {isLogin ? 'Crear clave nueva' : 'Ingresar'}
                                </button>
                            </p>
                        </div>
                    </>
                )}
            </div>

            <style jsx>{`
                .auth-container {
                    min-height: 100vh;
                    display: flex; justify-content: center; align-items: center;
                    background: radial-gradient(circle at 50% 10%, #1e293b, #0f172a);
                    color: white; padding: 1rem;
                }
                .auth-card {
                    width: 100%; max-width: 420px;
                    padding: 2.5rem;
                    border-radius: 20px;
                    background: rgba(30, 41, 59, 0.6);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .auth-header { text-align: center; margin-bottom: 2rem; }
                .logo-icon { font-size: 3rem; margin-bottom: 1rem; }
                .auth-header h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem; }
                .auth-header p { color: #94a3b8; font-size: 0.95rem; }

                .input-group { margin-bottom: 1.5rem; text-align: left; }
                .input-group label { display: block; font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem; font-weight: 500; }
                .input-group input {
                    width: 100%; padding: 0.8rem 1rem;
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px; color: white;
                    transition: 0.2s;
                }
                .input-group input:focus { outline: none; border-color: #fbbf24; box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.2); }

                .btn-primary {
                    width: 100%; padding: 0.9rem;
                    background: linear-gradient(135deg, #fbbf24, #d97706);
                    color: #0f172a; border: none; font-weight: 700;
                    border-radius: 10px; cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(251, 191, 36, 0.3); }
                .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

                .error-msg { background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 0.8rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem; text-align: center; }
                .success-msg { background: rgba(34, 197, 94, 0.2); color: #86efac; padding: 0.8rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem; text-align: center; }

                .auth-footer { margin-top: 2rem; text-align: center; font-size: 0.9rem; color: #94a3b8; }
                .link-btn { background: none; border: none; color: #fbbf24; font-weight: 600; cursor: pointer; margin-left: 0.5rem; text-decoration: underline; }
                .link-btn:hover { color: #f59e0b; }
            `}</style>
        </div>
    );
}
