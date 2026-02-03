"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon } from 'lucide-react';
// import SafeChatWidget from '../../../components/SafeChatWidget';
import { supabase } from '../../../lib/supabase';
import '../../../globals.css';

import './register.css';

function RegisterContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [countryCode, setCountryCode] = useState('+54 9');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [confirmedSession, setConfirmedSession] = useState(null);

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

    const [homeUrl, setHomeUrl] = useState('https://judic-ia.com/?public=true');

    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
            setHomeUrl('/');
        }
    }, []);

    const lawyerId = searchParams.get('lawyerId') || searchParams.get('lawyer');
    const cid = searchParams.get('cid');

    // Password Validations
    const passwordValidations = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password)
    };
    const isPasswordStrong = Object.values(passwordValidations).every(v => v);
    const passwordsMatch = password === confirmPassword && confirmPassword !== '';
    const emailsMatch = email === confirmEmail && email !== '';

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                // Safeguard: Check if this is a lawyer landing here by mistake
                const userRole = session.user?.user_metadata?.role;
                if (userRole === 'lawyer') {
                    console.log('🔄 Abogado detectado en página de cliente. Redirigiendo al dashboard...');
                    router.push('/dashboard');
                    return;
                }

                // SECURITY: Client is already logged in - redirect to login page
                // They should not be on the register page if they already have an account
                if (userRole === 'client') {
                    console.log('🔄 Cliente ya autenticado. Redirigiendo al login...');
                    const loginUrl = new URL('/consultas/auth/login', window.location.origin);
                    if (lawyerId) loginUrl.searchParams.set('lawyerId', lawyerId);
                    if (cid) loginUrl.searchParams.set('cid', cid);
                    router.push(loginUrl.toString());
                    return;
                }

                setIsConfirmed(true);
                setConfirmedSession(session);
            }
        });
        return () => subscription.unsubscribe();
    }, [router, lawyerId, cid]);

    // SECURITY: Check if CID is already claimed - redirect to login if so
    useEffect(() => {
        const checkCidClaimed = async () => {
            if (!cid) return;

            const { data: inquiry } = await supabase
                .from('inquiries')
                .select('claimed_by_email')
                .eq('id', cid)
                .maybeSingle();

            if (inquiry?.claimed_by_email) {
                console.log('🔒 CID already claimed. Redirecting to login...');
                const loginUrl = new URL('/consultas/auth/login', window.location.origin);
                if (lawyerId) loginUrl.searchParams.set('lawyerId', lawyerId);
                if (cid) loginUrl.searchParams.set('cid', cid);
                router.push(loginUrl.toString());
            }
        };
        checkCidClaimed();
    }, [cid, lawyerId, router]);

    // Countdown Logic
    useEffect(() => {
        if (redirectCountdown === null) return;
        if (redirectCountdown === 0) {
            router.push(`/consultas/auth/login?${searchParams.toString()}`);
            return;
        }
        const timer = setTimeout(() => {
            setRedirectCountdown(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [redirectCountdown, router, searchParams]);

    const enterIntake = async () => {
        if (!confirmedSession || !lawyerId) return;
        setLoading(true);
        try {
            const currentCid = cid || crypto.randomUUID();
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: `[SISTEMA: Cliente verificado: ${confirmedSession.user.email}]`,
                    history: [],
                    mode: 'intake',
                    sessionId: currentCid,
                    lawyerId: lawyerId,
                    clientUserId: confirmedSession.user.id,
                    clientEmail: confirmedSession.user.email,
                    clientName: confirmedSession.user.user_metadata?.full_name,
                    clientPhone: confirmedSession.user.user_metadata?.phone
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al sincronizar sesión.");
            }

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
            if (!isPasswordStrong) throw new Error("La contraseña no es segura.");
            if (!passwordsMatch) throw new Error("Las contraseñas no coinciden.");
            if (email.toLowerCase() !== confirmEmail.toLowerCase()) throw new Error("Los correos electrónicos no coinciden.");

            // 🔐 NEW: Check if CID is already claimed by a DIFFERENT email
            if (cid) {
                const { data: inquiry } = await supabase
                    .from('inquiries')
                    .select('claimed_by_email')
                    .eq('id', cid)
                    .maybeSingle();

                if (inquiry?.claimed_by_email && inquiry.claimed_by_email !== email.toLowerCase()) {
                    console.warn("🚫 CID already claimed by:", inquiry.claimed_by_email);
                    throw new Error("Este enlace ya fue utilizado por otro usuario. Contacte a su abogado para obtener un nuevo enlace.");
                }
            }

            // Use unified callback page that detects role and redirects appropriately
            const redirectParams = new URLSearchParams();
            if (lawyerId) redirectParams.set('lawyerId', lawyerId);
            if (cid) redirectParams.set('cid', cid);
            const fullRedirectUrl = `${window.location.origin}/auth/callback?${redirectParams.toString()}`;

            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: fullRedirectUrl, // Still good to send for prod
                    data: {
                        role: 'client',
                        full_name: `${firstName} ${lastName}`,
                        phone: `${countryCode} ${phone}`
                    }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes("already registered")) {
                    throw new Error("Este email ya tiene una clave. Por favor inicia sesión.");
                }
                if (signUpError.message.includes("Error sending confirmation email")) {
                    console.warn("Supabase SMTP Error. User likely created but email failed.");
                    throw new Error("El sistema de correos está saturado. Por favor, avisa a tu abogado o intenta iniciar sesión directo si ya te registraste.");
                }
                throw signUpError;
            }

            // 🔐 NEW: Claim the CID immediately after successful signup
            if (cid) {
                await supabase
                    .from('inquiries')
                    .update({
                        claimed_by_email: email.toLowerCase(),
                        claimed_at: new Date().toISOString()
                    })
                    .eq('id', cid)
                    .is('claimed_by_email', null); // Only claim if not already claimed
                console.log("✅ CID claimed by:", email);
            }

            // SUCCESS FLOW
            if (data.session) {
                // If we got a session immediately (Email Confirm Disabled), go straight to chat
                const finalCid = cid || crypto.randomUUID();
                const syncRes = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: `[SISTEMA: Nuevo cliente registrado: ${email}]`,
                        history: [],
                        mode: 'intake',
                        sessionId: finalCid,
                        lawyerId: lawyerId,
                        clientUserId: data.user.id,
                        clientEmail: email,
                        clientName: `${firstName} ${lastName}`,
                        clientPhone: `${countryCode} ${phone}`
                    }),
                });

                if (!syncRes.ok) {
                    const errData = await syncRes.json();
                    throw new Error(errData.error || "Error al preparar tu sesión jurídica.");
                }

                router.push(`/consultas/${lawyerId}?cid=${finalCid}`);
            } else {
                setMessage("¡Cuenta creada! Revisa tu email para confirmar y acceder.");
                setRedirectCountdown(10);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <a href={homeUrl} className="btn-back-auth-fixed">← Volver al Inicio</a>

            <button
                onClick={toggleTheme}
                className="theme-toggle-auth-fixed"
                aria-label="Alternar tema"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="auth-card glass-premium fade-in">
                {!lawyerId ? (
                    <div className="confirmed-ui slide-up">
                        <div className="success-icon-premium error" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.2)', boxShadow: 'none' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <h1 className="brand-name-premium" style={{ color: '#fca5a5' }}>Acceso Invalido</h1>
                        <p className="confirmed-text" style={{ color: '#94a3b8' }}>
                            No hemos podido identificar al profesional asociado a este enlace.
                        </p>
                        <div className="password-checklist-premium" style={{ marginBottom: '2rem', textAlign: 'left' }}>
                            <p>• El enlace puede estar incompleto.</p>
                            <p>• Intenta escanear el código QR nuevamente.</p>
                            <p>• O solicita un nuevo link a tu abogado.</p>
                        </div>
                        <button onClick={() => window.location.reload()} className="btn-gold-action">
                            Reintentar Carga
                        </button>
                    </div>
                ) : isConfirmed ? (
                    <div className="confirmed-ui fade-in">
                        <div className="success-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                        <h1 className="brand-name-premium">¡Email Confirmado!</h1>
                        <p className="confirmed-text">Tu privacidad ha sido asegurada. Ya puedes ingresar a la consulta.</p>
                        <button onClick={enterIntake} className="btn-gold-action" disabled={loading}>
                            {loading ? 'Preparando Chat...' : 'Ingresar al Chat Ahora'}
                        </button>
                    </div>
                ) : (
                    <>
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
                            <h1 className="brand-name-premium">Judic-IA <span className="justice-emoji">⚖️</span></h1>
                            <div className="brand-status">Acceso Seguro • Clientes</div>
                            <p className="brand-desc">Crea una clave de acceso temporal para proteger tu privacidad y documentos durante esta sesión.</p>
                        </header>

                        <form onSubmit={handleRegister} className="premium-form">
                            <div className="input-field">
                                <label htmlFor="email">Tu Email</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@email.com"
                                    required
                                />
                            </div>

                            <div className="input-field">
                                <label htmlFor="confirmEmail">Confirmar Email</label>
                                <input
                                    id="confirmEmail"
                                    name="confirmEmail"
                                    type="email"
                                    value={confirmEmail}
                                    onChange={(e) => setConfirmEmail(e.target.value)}
                                    placeholder="Repite tu email"
                                    required
                                    style={{ borderColor: (confirmEmail && email.toLowerCase() !== confirmEmail.toLowerCase()) ? '#ef4444' : '' }}
                                />
                                {confirmEmail && email.toLowerCase() !== confirmEmail.toLowerCase() && (
                                    <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: '0.3rem' }}>No coinciden</div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div className="input-field" style={{ flex: 1 }}>
                                    <label htmlFor="firstName">Nombre</label>
                                    <input
                                        id="firstName"
                                        name="firstName"
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Juan"
                                        required
                                    />
                                </div>
                                <div className="input-field" style={{ flex: 1 }}>
                                    <label htmlFor="lastName">Apellido</label>
                                    <input
                                        id="lastName"
                                        name="lastName"
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Pérez"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-field">
                                <label htmlFor="phone">Celular</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select
                                        name="countryCode"
                                        value={countryCode}
                                        onChange={(e) => setCountryCode(e.target.value)}
                                        style={{
                                            width: '130px',
                                            padding: '1rem 0.5rem',
                                            background: '#020617',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '14px',
                                            color: 'white',
                                            fontSize: '0.9rem',
                                            outline: 'none'
                                        }}
                                    >
                                        <option value="+54 9">+54 9 (AR)</option>
                                        <option value="+598">+598 (UY)</option>
                                        <option value="+56">+56 (CL)</option>
                                        <option value="+55">+55 (BR)</option>
                                        <option value="+57">+57 (CO)</option>
                                        <option value="+1">+1 (US/CA)</option>
                                    </select>
                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        style={{ flex: 1 }}
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="11 1234 5678"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-field">
                                <label htmlFor="password">Crear Clave de Acceso</label>
                                <div className="pass-input-wrapper">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button type="button" className="eye-toggle-premium" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="input-field">
                                <label htmlFor="confirmPassword">Repetir Clave</label>
                                <div className="pass-input-wrapper">
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button type="button" className="eye-toggle-premium" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        {showConfirmPassword ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* PASSWORD RULES */}
                            <div className="password-checklist-premium">
                                <p className={passwordValidations.length ? 'valid' : ''}>
                                    {passwordValidations.length ? '✓' : '✗'} Mínimo 8 caracteres
                                </p>
                                <p className={passwordValidations.uppercase ? 'valid' : ''}>
                                    {passwordValidations.uppercase ? '✓' : '✗'} Al menos 1 Mayúscula
                                </p>
                                <p className={passwordValidations.number ? 'valid' : ''}>
                                    {passwordValidations.number ? '✓' : '✗'} Al menos 1 Número
                                </p>
                                <p className={passwordValidations.symbol ? 'valid' : ''}>
                                    {passwordValidations.symbol ? '✓' : '✗'} Al menos 1 Símbolo
                                </p>
                                {confirmPassword && (
                                    <p className={passwordsMatch ? 'valid' : 'invalid'}>
                                        {passwordsMatch ? '✓' : '✗'} Las contraseñas coinciden
                                    </p>
                                )}
                            </div>

                            {error && <div className="error-premium">{error}</div>}
                            {message && (
                                <div className="success-premium">
                                    {message}
                                    <br />
                                    <small style={{ color: '#fff', display: 'block', marginTop: '5px' }}>
                                        Si no lo ves, <strong>revisá SPAM</strong>.
                                    </small>
                                    {redirectCountdown !== null && (
                                        <div style={{ marginTop: '0.8rem', fontWeight: 700, color: '#white' }}>
                                            Redirigiendo al login en {redirectCountdown} segundos...
                                        </div>
                                    )}
                                </div>
                            )}

                            <button type="submit" className="btn-gold-action" disabled={loading || !isPasswordStrong || !passwordsMatch || !emailsMatch || message}>
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
        </>
    );
}

function LoadingFallback() {
    return (
        <div className="auth-card glass-premium">
            <header className="brand-header">
                <div className="brand-logo-premium" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
                <div style={{ height: '30px', width: '60%', margin: '0 auto 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                <div style={{ height: '20px', width: '40%', margin: '0 auto', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
            </header>
            <div className="premium-form" style={{ gap: '2rem' }}>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
            </div>
        </div>
    );
}

export default function ClientRegisterPage() {
    return (
        <main className="auth-main">
            <div className="auth-container">
                <Suspense fallback={<LoadingFallback />}>
                    <RegisterContent />
                </Suspense>
            </div>

        </main>
    );
}
