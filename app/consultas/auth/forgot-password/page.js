"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './forgot-password.css';

export default function ClientForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [redirectCountdown, setRedirectCountdown] = useState(null);

    useEffect(() => {
        if (redirectCountdown === null) return;
        if (redirectCountdown === 0) {
            router.push('/auth/login');
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
                    redirectTo: `${window.location.origin}/auth/update-password`
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
                <Link href="/auth/login" className="back">← Volver al login</Link>
            </div>

            <div className="card fade-in">
                <div className="header">
                    <img src="/logo.png" alt="Logo Judic-IA" className="logo" />
                    <h1>Recuperar Acceso 🔐</h1>
                    <div className="subtitle">Clientes • Restablecer Contraseña</div>
                </div>

                {!message ? (
                    <form onSubmit={handleReset}>
                        <div style={{ marginBottom: '1.5rem', color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            Ingresa tu email registrado y te enviaremos un enlace seguro para crear una nueva contraseña.
                        </div>

                        <div className="field">
                            <label>Tu Email</label>
                            <input
                                type="email"
                                placeholder="tu@email.com"
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


        </main>
    );
}
