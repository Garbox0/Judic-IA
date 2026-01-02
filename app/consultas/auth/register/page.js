"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import '../../../globals.css';

export default function ClientRegisterPage() {
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
                options: { emailRedirectTo: fullRedirectUrl }
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
        <div className="auth-container">
            <div className="auth-card glass-panel">
                {isConfirmed ? (
                    <div className="confirmed-ui" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✅</div>
                        <h1 style={{ color: '#86efac', marginBottom: '1rem' }}>¡Email Confirmado!</h1>
                        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Ya puedes acceder a la consulta segura.</p>
                        <button onClick={enterIntake} className="btn-primary" disabled={loading}>
                            {loading ? 'Preparando Chat...' : 'Ingresar al Chat Ahora'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="auth-header" style={{ textAlign: 'center' }}>
                            <div className="logo-icon" style={{ fontSize: '3rem' }}>⚖️</div>
                            <h1>Proteger Consulta</h1>
                            <p style={{ color: '#94a3b8', margin: '1rem 0' }}>Establece una clave temporal para proteger tu privacidad.</p>
                        </div>

                        <form onSubmit={handleRegister} className="auth-form">
                            <div className="input-group">
                                <label>Tu Email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required />
                            </div>
                            <div className="input-group">
                                <label>Crear Clave de Acceso</label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required />
                            </div>
                            <div className="input-group">
                                <label>Repetir Clave</label>
                                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••" required />
                            </div>

                            {error && <div className="error-msg" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '0.8rem', borderRadius: '8px', margin: '1rem 0' }}>⚠️ {error}</div>}
                            {message && <div className="success-msg" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#86efac', padding: '0.8rem', borderRadius: '8px', margin: '1rem 0' }}>✅ {message}</div>}

                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Procesando...' : 'Comenzar Consulta Segura'}
                            </button>
                        </form>

                        <div className="auth-footer" style={{ textAlign: 'center', marginTop: '2rem' }}>
                            <p style={{ color: '#94a3b8' }}>¿Ya tienes una clave?
                                <button type="button" onClick={() => router.push(`/consultas/auth/login?${searchParams.toString()}`)} style={{ background: 'none', border: 'none', color: '#fbbf24', fontWeight: 600, cursor: 'pointer', marginLeft: '0.5rem', textDecoration: 'underline' }}>Ingresar</button>
                            </p>
                        </div>
                    </>
                )}
            </div>
            <style jsx>{`
                .auth-container { min-height: 100vh; display: flex; justify-content: center; align-items: center; background: radial-gradient(circle at 50% 10%, #1e293b, #0f172a); color: white; padding: 1rem; }
                .auth-card { width: 100%; max-width: 420px; padding: 2.5rem; border-radius: 20px; background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); }
                .input-group { margin-bottom: 1.5rem; }
                .input-group label { display: block; font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem; }
                .input-group input { width: 100%; padding: 0.8rem 1rem; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; color: white; }
                .btn-primary { width: 100%; padding: 0.9rem; background: linear-gradient(135deg, #fbbf24, #d97706); color: #0f172a; border: none; font-weight: 700; border-radius: 10px; cursor: pointer; }
            `}</style>
        </div>
    );
}
