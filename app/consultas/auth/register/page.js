"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon, ShieldCheck, ShieldAlert, ShieldEllipsis, RefreshCw, Sparkles, ArrowLeft } from 'lucide-react';
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

    // 🛡️ SECURITY: HIBP States
    const [pwnedStatus, setPwnedStatus] = useState(null); // 'safe' | 'breached' | 'checking'
    const [isCheckingPwned, setIsCheckingPwned] = useState(false);
    const [lastCheckedPassword, setLastCheckedPassword] = useState('');

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

    // 🛡️ Trusted Email Domains (anti-disposable)
    const TRUSTED_EMAIL_DOMAINS = [
        'gmail.com', 'googlemail.com',
        'outlook.com', 'outlook.es', 'outlook.com.ar', 'hotmail.com', 'hotmail.es', 'hotmail.com.ar', 'live.com', 'live.com.ar', 'msn.com',
        'yahoo.com', 'yahoo.com.ar', 'yahoo.es', 'ymail.com',
        'icloud.com', 'me.com', 'mac.com',
        'protonmail.com', 'proton.me', 'pm.me',
        'fibertel.com.ar', 'speedy.com.ar', 'arnet.com.ar', 'ciudad.com.ar',
        'zoho.com', 'aol.com'
    ];

    const getEmailDomain = (emailStr) => {
        const parts = emailStr.toLowerCase().split('@');
        return parts.length === 2 ? parts[1] : null;
    };

    const isEmailDomainTrusted = TRUSTED_EMAIL_DOMAINS.includes(getEmailDomain(email));

    const isPasswordStrong = Object.values(passwordValidations).every(v => v);
    const passwordsMatch = password === confirmPassword && confirmPassword !== '';
    const emailsMatch = email === confirmEmail && email !== '';

    // 🛡️ Password Generator
    const generateSecurePass = () => {
        const caps = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const lows = "abcdefghijkmnopqrstuvwxyz";
        const nums = "23456789";
        const syms = "!@#$%&*+?=";
        const all = caps + lows + nums + syms;

        let pass = "";
        pass += caps[Math.floor(Math.random() * caps.length)];
        pass += lows[Math.floor(Math.random() * lows.length)];
        pass += nums[Math.floor(Math.random() * nums.length)];
        pass += syms[Math.floor(Math.random() * syms.length)];

        for (let i = 0; i < 12; i++) {
            pass += all[Math.floor(Math.random() * all.length)];
        }

        const final = pass.split('').sort(() => 0.5 - Math.random()).join('');
        setPassword(final);
        setConfirmPassword(final);
        setError(null);
    };

    // 🛡️ HIBP Check Function (k-Anonymity)
    const checkPwned = async (pwd) => {
        if (pwd.length < 6) {
            setPwnedStatus(null);
            return;
        }

        setIsCheckingPwned(true);
        setPwnedStatus('checking');

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(pwd);
            const hashBuffer = await crypto.subtle.digest('SHA-1', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

            const prefix = hashHex.slice(0, 5);
            const suffix = hashHex.slice(5);

            const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
            const text = await response.text();

            const lines = text.split('\n');
            const found = lines.some(line => line.split(':')[0] === suffix);

            setPwnedStatus(found ? 'breached' : 'safe');
            setLastCheckedPassword(pwd);
        } catch (err) {
            console.error("HIBP Check failed:", err);
            setPwnedStatus(null);
        } finally {
            setIsCheckingPwned(false);
        }
    };

    // 🛡️ Auto-check on password change (debounced)
    useEffect(() => {
        if (!password || password.length < 6) {
            setPwnedStatus(null);
            return;
        }

        if (password !== lastCheckedPassword) {
            setPwnedStatus(null);
        }

        const timer = setTimeout(() => {
            if (password !== lastCheckedPassword) {
                checkPwned(password);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [password, lastCheckedPassword]);


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

            // 🛡️ Email Domain Validation
            if (!isEmailDomainTrusted) {
                throw new Error("Solo aceptamos emails de proveedores confiables (Gmail, Outlook, Yahoo, iCloud). Para tu seguridad, evitamos emails temporales.");
            }

            // 🛡️ HIBP Hard Block Check
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(password);
                const hashBuffer = await crypto.subtle.digest('SHA-1', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

                const prefix = hashHex.slice(0, 5);
                const suffix = hashHex.slice(5);

                const hibpResponse = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
                if (hibpResponse.ok) {
                    const hibpText = await hibpResponse.text();
                    const isBreached = hibpText.split('\n').some(line => line.split(':')[0] === suffix);

                    if (isBreached) {
                        throw new Error("Esta contraseña ha sido filtrada en internet. Por tu seguridad, elegí otra diferente.");
                    }
                }
            } catch (hibpError) {
                if (hibpError.message.includes("filtrada")) throw hibpError;
                console.warn("HIBP check failed, proceeding:", hibpError);
            }


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
                console.log("✅ CID claimed successfully");
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
            <a href={homeUrl} className="btn-back-auth-fixed"><ArrowLeft size={16} /> Volver al Inicio</a>

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
                            <h1 className="brand-name-premium">Judic-IA</h1>
                            <div className="brand-status">Acceso Seguro • Clientes</div>
                            <p className="brand-desc">Crea una clave de acceso temporal para proteger tu privacidad y documentos durante esta sesión.</p>
                        </header>

                        <form onSubmit={handleRegister} className="premium-form">
                            <div className="input-field">
                                <div className="label-row">
                                    <label htmlFor="email">Tu Email</label>
                                    {email && (
                                        <div className="domain-trust-badge">
                                            {isEmailDomainTrusted ? (
                                                <span className="text-emerald flex items-center gap-1 text-[10px] uppercase font-bold">
                                                    <ShieldCheck size={12} /> Confianza Alta
                                                </span>
                                            ) : (
                                                <span className="text-slate flex items-center gap-1 text-[10px] uppercase font-bold opacity-60">
                                                    <ShieldAlert size={12} /> No verificado
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@email.com"
                                    required
                                    className={email && !isEmailDomainTrusted ? 'untrusted-domain' : ''}
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
                                    className={confirmEmail && email.toLowerCase() !== confirmEmail.toLowerCase() ? 'email-mismatch' : ''}
                                />
                                {confirmEmail && email.toLowerCase() !== confirmEmail.toLowerCase() && (
                                    <span className="error-text-mini">Los correos no coinciden</span>
                                )}
                                {/* 🛡️ EMAIL TRUST WARNING - Near email field */}
                                {email && !isEmailDomainTrusted && (
                                    <div className="email-trust-row">
                                        <ShieldAlert size={14} />
                                        <span>Usá un email de proveedor confiable (Gmail, Outlook, etc.)</span>
                                    </div>
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
                                <div className="phone-input-group">
                                    <select
                                        name="countryCode"
                                        value={countryCode}
                                        onChange={(e) => setCountryCode(e.target.value)}
                                        className="country-select-premium"
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
                                        className="flex-1"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="11 1234 5678"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-field">
                                <div className="label-row">
                                    <label htmlFor="password">Crear Clave de Acceso</label>
                                    <button
                                        type="button"
                                        onClick={generateSecurePass}
                                        className="suggest-pass-link"
                                        title="Generar clave segura"
                                    >
                                        <Sparkles size={12} /> Sugerir
                                    </button>
                                </div>
                                <div className="pass-input-wrapper">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className={password && pwnedStatus === 'breached' ? 'untrusted-domain' : ''}
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

                            {/* 🛡️ HIBP STATUS INDICATOR */}
                            {password.length >= 6 && (
                                <div className="hibp-status-row">
                                    {pwnedStatus === 'checking' && (
                                        <>
                                            <ShieldEllipsis size={18} className="hibp-checking animate-spin" />
                                            <span className="hibp-checking">Verificando seguridad...</span>
                                        </>
                                    )}
                                    {pwnedStatus === 'safe' && (
                                        <>
                                            <ShieldCheck size={18} className="hibp-safe" />
                                            <span className="hibp-safe">Contraseña segura ✓</span>
                                        </>
                                    )}
                                    {pwnedStatus === 'breached' && (
                                        <>
                                            <ShieldAlert size={18} className="hibp-breached" />
                                            <span className="hibp-breached">Contraseña filtrada - Elegí otra</span>
                                        </>
                                    )}
                                </div>
                            )}


                            {error && <div className="error-premium">{error}</div>}
                            {message && (
                                <div className="success-premium">
                                    {message}
                                    <br />
                                    <small className="success-msg-small">
                                        Si no lo ves, <strong>revisá SPAM</strong>.
                                    </small>
                                    {redirectCountdown !== null && (
                                        <div className="countdown-msg">
                                            Redirigiendo al login en {redirectCountdown} segundos...
                                        </div>
                                    )}
                                </div>
                            )}

                            <button type="submit" className="btn-gold-action" disabled={loading || !isPasswordStrong || !passwordsMatch || !emailsMatch || !isEmailDomainTrusted || pwnedStatus === 'breached' || message}>
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
            </div >
        </>
    );
}

function LoadingFallback() {
    return (
        <div className="auth-card glass-premium">
            <header className="brand-header">
                <div className="brand-logo-premium skeleton-circle"></div>
                <div className="skeleton-text-m"></div>
                <div className="skeleton-text-s"></div>
            </header>
            <div className="premium-form skeleton-fields">
                <div className="skeleton-field"></div>
                <div className="skeleton-field"></div>
                <div className="skeleton-field"></div>
                <div className="skeleton-field"></div>
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
