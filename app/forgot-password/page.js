"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [redirectCountdown, setRedirectCountdown] = useState(null);

    useEffect(() => {
        if (redirectCountdown === null) return;
        if (redirectCountdown === 0) {
            router.push('/login');
            return;
        }
        const timer = setTimeout(() => {
            setRedirectCountdown(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [redirectCountdown, router]);

    const handleReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            // Use server-side API for reliable delivery via Resend
            const response = await fetch('/api/auth/request-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    redirectTo: `${window.location.origin}/update-password`
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Error al solicitar restauración.");
            setMessage("Hemos enviado un email de restauración. Revisa tu bandeja de entrada.");
            setRedirectCountdown(5);
        } catch (err) {
            setError(err.message || "Error al enviar el correo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-body">
            <div className="back-wrapper">
                <Link href="/login" className="back">← Volver al login</Link>
            </div>

            <div className="card fade-in">
                <div className="header">
                    <img src="/logo.png" alt="Logo Judic-IA" className="logo" />
                    <h1>Recuperar Acceso 🔐</h1>
                    <div className="subtitle">Restablecer Contraseña</div>
                </div>

                {!message ? (
                    <form onSubmit={handleReset}>
                        <div style={{ marginBottom: '1.5rem', color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            Ingresa tu email profesional y te enviaremos un enlace seguro para crear una nueva contraseña.
                        </div>

                        <div className="field">
                            <label>Email profesional</label>
                            <input
                                type="email"
                                placeholder="dr.nombre@estudio.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        {error && <div className="error-msg">⚠️ {error}</div>}

                        <button type="submit" disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                        </button>
                    </form>
                ) : (
                    <div className="success-msg fade-in">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📩</div>
                        <h3 style={{ color: '#fbbf24', marginBottom: '1rem' }}>¡Correo Enviado!</h3>
                        <p style={{ color: '#94a3b8', lineHeight: '1.6' }}>
                            Revisa tu bandeja de entrada (y Spam). Sigue las instrucciones para restablecer tu contraseña.
                        </p>
                        {redirectCountdown !== null && (
                            <div style={{ marginTop: '1.5rem', fontWeight: 600, color: '#fbbf24' }}>
                                Redirigiendo al login en {redirectCountdown} segundos...
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:wght@700;900&display=swap');
            `}</style>

            <style jsx>{`
                :root { --bg: #020617; --card: #0f172a; --gold: #fbbf24; }
                .auth-body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 10%, #0f172a, #020617); font-family: 'Inter', sans-serif; padding: 2rem; color: white; position: relative; }
                .card { width: 100%; max-width: 420px; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(20px); border-radius: 28px; padding: 3.5rem 3rem; box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); text-align: center; }
                
                @media (max-width: 640px) {
                    .card { padding: 2rem 1.5rem; border-radius: 20px; }
                    .auth-body { padding: 1rem; }
                    h1 { font-size: 1.5rem; }
                }
                .back-wrapper { position: absolute; top: 2rem; left: 2rem; z-index: 10; }
                .back { color: #94a3b8; text-decoration: none; font-size: 0.85rem; transition: 0.3s; }
                .back:hover { color: #fbbf24; }
                .logo { width: 56px; margin-bottom: 1rem; filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3)); }
                h1 { font-family: 'Playfair Display', serif; color: #fbbf24; margin: 0; font-size: 1.8rem; }
                .subtitle { text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.15em; color: #94a3b8; margin-top: 0.5rem; margin-bottom: 2rem; }
                .field { margin-bottom: 1.5rem; text-align: left; }
                label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 0.4rem; display: block; }
                input { width: 100%; padding: 1rem 1.2rem; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.1); background: #020617; color: white; font-size: 1rem; outline: none; transition: 0.3s; }
                input:focus { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1); }
                button { width: 100%; padding: 1.1rem; background: linear-gradient(135deg, #fbbf24, #d97706); border: none; border-radius: 14px; font-weight: 800; cursor: pointer; color: #020617; font-size: 0.95rem; transition: 0.3s; margin-top: 1rem; }
                button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(217, 119, 6, 0.3); }
                button:disabled { opacity: 0.7; cursor: not-allowed; }
                .error-msg { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 1rem; border-radius: 12px; font-size: 0.9rem; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 1.5rem; }
                .success-msg { animation: fadeIn 0.8s ease forwards; }
                .fade-in { animation: fadeIn 0.8s ease forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </main>
    );
}
