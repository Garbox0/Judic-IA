"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import './forgot-password.css';

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
                    <Image
                        src="/judic-ia-mark.png"
                        alt="Logo Judic-IA"
                        className="logo"
                        width={48}
                        height={64}
                    />
                    <h1>Recuperar Acceso 🔐</h1>
                    <div className="subtitle">Restablecer Contraseña</div>
                </div>

                {!message ? (
                    <form onSubmit={handleReset}>
                        <div className="instructions-text">
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
                        <div className="success-icon">📩</div>
                        <h3 className="success-title">¡Correo Enviado!</h3>
                        <p className="success-description">
                            Revisa tu bandeja de entrada (y Spam). Sigue las instrucciones para restablecer tu contraseña.
                        </p>
                        {redirectCountdown !== null && (
                            <div className="countdown-text">
                                Redirigiendo al login en {redirectCountdown} segundos...
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
