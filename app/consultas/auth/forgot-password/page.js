"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Mail, Lock, Sun, Moon, AlertCircle, CheckCircle2 } from 'lucide-react';
import './forgot-password.css';
import '../../../globals.css';

export default function ClientForgotPasswordPage() {
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
            setRedirectCountdown(10); // Give them time to read
        } catch (err) {
            setError(err.message || "Error al enviar el correo.");
        } finally {
            setLoading(false);
        }
    };

    // Home URL logic (like in login page)
    const [homeUrl, setHomeUrl] = useState('https://judic-ia.com/?public=true');
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
            setHomeUrl('/');
        }
    }, []);

    return (
        <main className="auth-main">
            <a href={homeUrl} className="btn-back-auth-fixed">
                <ArrowLeft size={16} /> Volver al Inicio
            </a>

            <button
                onClick={toggleTheme}
                className="theme-toggle-auth-fixed"
                aria-label="Alternar tema"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="auth-card glass-premium fade-in">
                <header className="brand-header">
                    <Image
                        src="/judic-ia-mark.png"
                        alt="Judic-IA Logo"
                        className="brand-logo-premium"
                        width={48}
                        height={64}
                        style={{ objectFit: 'contain' }}
                        priority
                    />
                    <h1 className="brand-name-premium">Judic-IA</h1>
                    <div className="brand-status">Acceso Seguro • Clientes</div>
                    <p className="brand-desc">Restablecer Contraseña</p>
                </header>

                {!message ? (
                    <form onSubmit={handleReset} className="premium-form">
                        <p className="brand-desc" style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                            Ingresa tu email registrado y te enviaremos un enlace seguro para crear una nueva contraseña.
                        </p>

                        <div className="input-field">
                            <label htmlFor="email">Tu Email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="error-premium" role="alert">
                                <AlertCircle size={18} aria-hidden="true" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button type="submit" className="btn-gold-action" disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                        </button>

                        <footer className="auth-nav-footer" style={{ marginTop: '1rem' }}>
                            <Link href="/auth/login" className="btn-text-gold">
                                Volver al login
                            </Link>
                        </footer>
                    </form>
                ) : (
                    <div className="confirmed-ui slide-up" role="status" aria-live="polite">
                        <div className="success-icon" style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>
                            <Mail size={48} className="text-gold" style={{ color: '#fbbf24' }} />
                        </div>
                        <h2 className="brand-name-premium" style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>¡Correo Enviado!</h2>
                        <p className="confirmed-text" style={{ color: '#94a3b8', lineHeight: '1.6', fontSize: '0.95rem' }}>
                            Revisa tu bandeja de entrada (y Spam). Sigue las instrucciones para restablecer tu contraseña.
                        </p>
                        {redirectCountdown !== null && (
                            <div style={{ marginTop: '1.5rem', fontWeight: 600, color: '#fbbf24', fontSize: '0.9rem' }}>
                                Redirigiendo al login en {redirectCountdown} segundos...
                            </div>
                        )}
                        <button
                            onClick={() => router.push('/auth/login')}
                            className="btn-gold-action"
                            style={{ marginTop: '2rem' }}
                        >
                            Ir al Login Ahora
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
