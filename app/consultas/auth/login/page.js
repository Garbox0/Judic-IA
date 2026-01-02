"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import '../../../globals.css';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [confirmedSession, setConfirmedSession] = useState(null);

    const lawyerId = searchParams.get('lawyerId') || searchParams.get('lawyer');
    const cid = searchParams.get('cid');

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
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

    const enterIntake = async () => {
        if (!confirmedSession || !lawyerId) return;
        setLoading(true);
        try {
            const currentCid = cid || crypto.randomUUID();
            router.push(`/consultas/${lawyerId}?cid=${currentCid}`);
        } catch (err) {
            setError("Error al entrar al chat.");
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

            if (!data.user.email_confirmed_at) {
                await supabase.auth.signOut();
                throw new Error("Email not confirmed");
            }

            const currentCid = cid || crypto.randomUUID();
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
        <div className="auth-card glass-panel">
            {isConfirmed ? (
                <div className="confirmed-ui" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✅</div>
                    <h1 style={{ color: '#86efac', marginBottom: '1rem' }}>¡Bienvenido de nuevo!</h1>
                    <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Tu sesión está activa.</p>
                    <button onClick={enterIntake} className="btn-primary" disabled={loading}>
                        {loading ? 'Entrando...' : 'Continuar Consulta'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="auth-header" style={{ textAlign: 'center' }}>
                        <div className="logo-icon" style={{ fontSize: '3rem' }}>🔑</div>
                        <h1>Ingresar a Consulta</h1>
                        <p style={{ color: '#94a3b8', margin: '1rem 0' }}>Ingresa tu clave para ver el estado de tu caso.</p>
                    </div>

                    <form onSubmit={handleLogin} className="auth-form">
                        <div className="input-group">
                            <label>Tu Email</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required />
                        </div>
                        <div className="input-group">
                            <label>Tu Clave de Acceso</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required />
                        </div>

                        {error && <div className="error-msg" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '0.8rem', borderRadius: '8px', margin: '1rem 0' }}>⚠️ {error}</div>}

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Validando...' : 'Ingresar al Chat'}
                        </button>
                    </form>

                    <div className="auth-footer" style={{ textAlign: 'center', marginTop: '2rem' }}>
                        <p style={{ color: '#94a3b8' }}>¿No tienes clave aún?
                            <button type="button" onClick={() => router.push(`/consultas/auth/register?${searchParams.toString()}`)} style={{ background: 'none', border: 'none', color: '#fbbf24', fontWeight: 600, cursor: 'pointer', marginLeft: '0.5rem', textDecoration: 'underline' }}>Crear una clave nueva</button>
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

export default function ClientLoginPage() {
    return (
        <div className="auth-container">
            <Suspense fallback={<div className="auth-card glass-panel" style={{ textAlign: 'center' }}>Cargando acceso seguro...</div>}>
                <LoginContent />
            </Suspense>
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
