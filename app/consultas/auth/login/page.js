"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import SafeChatWidget from '../../../components/SafeChatWidget';
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
        <main className="auth-main">
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
      `}</style>

            <div className="auth-container">
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
                                <div className="brand-icon-premium">⚖️</div>
                                <h1 className="brand-name-premium">Judic-IA</h1>
                                <p className="brand-status">Acceso Seguro • Clientes</p>
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
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>

                                {error && <div className="error-premium">⚠️ {error}</div>}

                                <button type="submit" className="btn-gold-action" disabled={loading}>
                                    {loading ? 'Validando Acceso...' : 'Ingresar al Chat Seguro'}
                                </button>
                            </form>

                            <div className="divider-premium"><span>o</span></div>

                            <footer className="auth-nav-footer">
                                <p>¿Aún no tienes una clave?
                                    <button type="button" className="btn-text-gold" onClick={() => router.push(`/consultas/auth/register?${searchParams.toString()}`)}>
                                        Crear Nueva Clave
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
        .brand-name-premium { font-family: 'Playfair Display', serif; font-size: 2.5rem; font-weight: 900; color: #fbbf24; margin-bottom: 0.5rem; }
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

        .error-premium { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 1rem; border-radius: 12px; font-size: 0.9rem; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); }
        
        .btn-back-premium { position: absolute; top: 1.5rem; left: 1.5rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 600; transition: 0.3s; }
        .btn-back-premium:hover { color: #fbbf24; }

        .auth-nav-footer { text-align: center; font-size: 0.9rem; color: #94a3b8; }
        .btn-text-gold { background: none; border: none; color: #fbbf24; font-weight: 700; cursor: pointer; margin-left: 0.5rem; font-size: 0.9rem; transition: 0.2s; }
        .btn-text-gold:hover { text-decoration: underline; color: #f59e0b; }

        .confirmed-ui { text-align: center; padding: 1rem 0; }
        .success-icon { font-size: 4rem; margin-bottom: 1.5rem; }
        .confirmed-text { color: #94a3b8; margin-bottom: 2.5rem; font-size: 1.1rem; font-weight: 300; }

        .fade-in { animation: fadeIn 0.8s ease forwards; }
        .slide-up { animation: slideUp 0.6s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
            <SafeChatWidget mode="sales" initialMessage="¡Hola! Si ya tienes una clave de acceso, ingrésala aquí." />
        </main>
    );
}

export default function ClientLoginPage() {
    return (
        <Suspense fallback={<div className="auth-card glass-panel" style={{ textAlign: 'center' }}>Cargando acceso seguro...</div>}>
            <LoginContent />
        </Suspense>
    );
}
