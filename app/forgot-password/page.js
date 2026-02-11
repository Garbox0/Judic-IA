"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon, Lock, Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import SecurityBadges from '../components/SecurityBadges';
import './forgot-password.css';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [redirectCountdown, setRedirectCountdown] = useState(null);
    const [theme, setTheme] = useState('light');

    // Load theme from cookies
    useEffect(() => {
        const themeCookie = document.cookie.split('; ').find(row => row.startsWith('app-theme='));
        const savedTheme = themeCookie ? themeCookie.split('=')[1] : 'light';
        setTheme(savedTheme);
    }, []);

    // Update body class and cookie when theme changes
    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        // Save to cookie for SSR/Middleware (shared across subdomains)
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 1);
        document.cookie = `app-theme=${theme}; path=/; domain=.judic-ia.com; expires=${expiry.toUTCString()}; SameSite=Lax`;
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

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
                <Link href="/login" className="back">
                    <ArrowLeft size={16} /> Volver al login
                </Link>
            </div>

            <button
                onClick={toggleTheme}
                className="theme-toggle-auth-fixed"
                aria-label="Alternar tema"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="card glass-premium fade-in">
                <div className="header brand-header">
                    <Image
                        src="/judic-ia-mark.png"
                        alt="Logo Judic-IA"
                        className="logo brand-logo-premium"
                        width={48}
                        height={64}
                        priority
                    />
                    <h1 className="brand-name-premium">Recuperar Acceso</h1>
                    <div className="subtitle brand-status">Restablecer Contraseña</div>
                </div>

                {!message ? (
                    <form onSubmit={handleReset} className="premium-form">
                        <div className="instructions-text brand-desc">
                            Ingresa tu email profesional y te enviaremos un enlace seguro para crear una nueva contraseña.
                        </div>

                        <div className="field input-field">
                            <label htmlFor="email">Email profesional</label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                autoComplete="email"
                                placeholder="dr.nombre@estudio.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="error-premium" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="btn-gold-action">
                            {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                        </button>
                    </form>
                ) : (
                    <div className="success-msg fade-in confirmed-ui">
                        <div className="success-icon" style={{ color: '#fbbf24', marginBottom: '1.5rem' }}>
                            <Mail size={48} />
                        </div>
                        <h3 className="brand-name-premium" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>¡Correo Enviado!</h3>
                        <p className="confirmed-text brand-desc">
                            Revisa tu bandeja de entrada (y Spam). Sigue las instrucciones para restablecer tu contraseña.
                        </p>
                        {redirectCountdown !== null && (
                            <div className="countdown-text" style={{ marginTop: '1.5rem', color: '#fbbf24', fontWeight: 'bold' }}>
                                Redirigiendo al login en {redirectCountdown} segundos...
                            </div>
                        )}
                    </div>
                )}
            </div>

            <SecurityBadges />
        </main>
    );
}
