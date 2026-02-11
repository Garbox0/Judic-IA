"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon, ShieldCheck, ShieldAlert, ShieldEllipsis, RefreshCw, Sparkles, Key, Lock, Eye, EyeOff } from 'lucide-react';
import { validateCuit, formatCuit } from '../lib/validation';
import './register.css';



export default function RegisterPage() {
    const router = useRouter();

    // Form States
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [cuitPrefix, setCuitPrefix] = useState('');
    const [cuitDni, setCuitDni] = useState('');
    const [cuitSuffix, setCuitSuffix] = useState('');
    const [tomo, setTomo] = useState('');
    const [folio, setFolio] = useState('');
    const [jurisdiccion, setJurisdiccion] = useState('');
    const [specialties, setSpecialties] = useState([]);
    const [consent, setConsent] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [customJurisdiccion, setCustomJurisdiccion] = useState('');

    const [redirectCountdown, setRedirectCountdown] = useState(null);
    const [theme, setTheme] = useState('light');

    // Security States
    const [pwnedStatus, setPwnedStatus] = useState(null); // 'safe' | 'breached' | 'checking'
    const [isCheckingPwned, setIsCheckingPwned] = useState(false);
    const [lastCheckedPassword, setLastCheckedPassword] = useState('');


    // Load theme from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('app-theme') || 'light';
        setTheme(savedTheme);
    }, []);

    // Update body class when theme changes
    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Password Validations
    const passwordValidations = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password)
    };

    // Trusted Email Domains (anti-disposable)
    const TRUSTED_EMAIL_DOMAINS = [
        // Google
        'gmail.com', 'googlemail.com',
        // Microsoft
        'outlook.com', 'outlook.es', 'outlook.com.ar', 'hotmail.com', 'hotmail.es', 'hotmail.com.ar', 'live.com', 'live.com.ar', 'msn.com',
        // Yahoo
        'yahoo.com', 'yahoo.com.ar', 'yahoo.es', 'ymail.com',
        // Apple
        'icloud.com', 'me.com', 'mac.com',
        // ProtonMail (privacy-focused but legit)
        'protonmail.com', 'proton.me', 'pm.me',
        // Business/Corporate (common Argentina)
        'fibertel.com.ar', 'speedy.com.ar', 'arnet.com.ar', 'ciudad.com.ar',
        // International trusted
        'zoho.com', 'aol.com'
    ];

    const getEmailDomain = (emailStr) => {
        const parts = emailStr.toLowerCase().split('@');
        return parts.length === 2 ? parts[1] : null;
    };

    const isEmailDomainTrusted = TRUSTED_EMAIL_DOMAINS.includes(getEmailDomain(email));

    // 🛡️ CUIT Validation
    const fullCuit = `${cuitPrefix}${cuitDni}${cuitSuffix}`;
    const isCuitComplete = cuitPrefix.length === 2 && cuitDni.length === 8 && cuitSuffix.length === 1;
    const isCuitValid = isCuitComplete ? validateCuit(fullCuit) : null;

    const isPasswordStrong = Object.values(passwordValidations).every(v => v);
    const passwordsMatch = password === confirmPassword && confirmPassword !== '';
    const emailsMatch = email.toLowerCase() === confirmEmail.toLowerCase() && email !== '';

    // Passphrase Generator (Cryptographically Secure)
    const generateSecurePass = () => {
        const caps = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const lows = "abcdefghijkmnopqrstuvwxyz";
        const nums = "23456789";
        const syms = "!@#$%&*+?=";
        const all = caps + lows + nums + syms;

        const secureRandom = (max) => {
            const array = new Uint32Array(1);
            crypto.getRandomValues(array);
            return array[0] % max;
        };

        let pass = "";
        pass += caps[secureRandom(caps.length)];
        pass += lows[secureRandom(lows.length)];
        pass += nums[secureRandom(nums.length)];
        pass += syms[secureRandom(syms.length)];

        for (let i = 0; i < 12; i++) {
            pass += all[secureRandom(all.length)];
        }

        // Fisher-Yates shuffle with secure random
        const arr = pass.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = secureRandom(i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        const final = arr.join('');
        setPassword(final);
        setConfirmPassword(final);
        setError(null);
    };

    // Pwned Check Logic (k-Anonymity)
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

    // Auto-check on password change (debounced)
    useEffect(() => {
        if (!password || password.length < 6) {
            setPwnedStatus(null);
            return;
        }

        // Reset status while waiting for debounce
        if (password !== lastCheckedPassword) {
            setPwnedStatus(null);
        }

        const timer = setTimeout(() => {
            if (password !== lastCheckedPassword) {
                console.log('Checking password against HIBP...');
                checkPwned(password);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [password, lastCheckedPassword]);


    // Auto-redirect if already logged in
    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            // if (user) router.push('/dashboard');
        };
        checkUser();
    }, [router]);

    // Countdown Effect
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

    const SPECIALTIES_OPTIONS = [
        'Derecho Administrativo', 'Derecho Ambiental', 'Derecho Bancario',
        'Derecho Civil', 'Derecho Comercial', 'Daños y Perjuicios',
        'Derecho Empresario', 'Familia', 'Derecho Fiscal',
        'Derecho Informático', 'Derecho Internacional', 'Derecho Laboral',
        'Marcas y Patentes', 'Mediación y Arbitraje', 'Derecho Militar',
        'Derecho Penal', 'Derecho Real'
    ];
    const JURISDICCION_OPTIONS = ['CPACF (Capital Federal)', 'CASI (San Isidro)', 'CALP (La Plata)', 'Colegio de Córdoba', 'Colegio de Santa Fe', 'Otro'];

    const toggleSpecialty = (spec) => {
        if (specialties.includes(spec)) {
            setSpecialties(specialties.filter(s => s !== spec));
        } else {
            setSpecialties([...specialties, spec]);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();

        if (!isPasswordStrong) {
            setError("La contraseña no cumple con los requisitos de seguridad.");
            return;
        }
        if (!passwordsMatch) {
            setError("Las contraseñas no coinciden.");
            return;
        }
        if (!emailsMatch) {
            setError("Los emails no coinciden.");
            return;
        }
        if (!isEmailDomainTrusted) {
            setError("Solo aceptamos emails de proveedores confiables (Gmail, Outlook, Yahoo, iCloud). Para tu seguridad, evitamos emails temporales.");
            return;
        }
        // 🛡️ CUIT Validation
        if (isCuitComplete && !isCuitValid) {
            setError("El CUIT ingresado no es válido. Verificá los números.");
            return;
        }
        if (!consent) {
            setError("Debes aceptar la declaración jurada para continuar.");
            return;
        }
        if (specialties.length === 0) {
            setError("Selecciona al menos una especialidad.");
            return;
        }
        if (jurisdiccion === 'Otro' && !customJurisdiccion) {
            setError("Por favor especifica tu colegio o jurisdicción.");
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);

        // === CRITICAL: Hard block for breached passwords ===
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
                    setError("Esta contraseña ha sido filtrada en internet. Por tu seguridad, elegí otra más segura.");
                    setLoading(false);
                    return;
                }
            }
        } catch (hibpError) {
            console.warn("HIBP check failed, proceeding with registration:", hibpError);
            // If HIBP fails, we allow registration but log the issue
        }
        // === END HIBP CHECK ===

        const finalJurisdiccion = jurisdiccion === 'Otro' ? customJurisdiccion : jurisdiccion;
        const finalMatricula = `T° ${tomo} F° ${folio}`;

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${process.env.NODE_ENV === 'development' ? window.location.origin : 'https://judic-ia.com'}/auth/callback`,
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    full_name: `${firstName} ${lastName}`,
                    cuit: `${cuitPrefix}${cuitDni}${cuitSuffix}`,
                    role: 'lawyer',
                    matricula: finalMatricula,
                    jurisdiccion: finalJurisdiccion,
                    especialidades: specialties
                }
            }
        });

        if (signUpError) {
            if (signUpError.message.includes("rate limit")) {
                setError("Demasiados intentos. Por favor espera un momento.");
            } else if (signUpError.message.includes("already registered") || signUpError.message.includes("valid")) {
                setError("Este email ya está registrado o los datos son inválidos.");
            } else {
                setError(signUpError.message);
            }
        } else {
            setMessage("¡Registro Exitoso! Revisa tu email (incluso SPAM) para confirmar.");
            setRedirectCountdown(10); // Start countdown

            // Notify Admin (Background)
            try {
                fetch('/api/admin/notify-registration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fullName: `${firstName} ${lastName}`,
                        email,
                        matricula: finalMatricula,
                        jurisdiccion: finalJurisdiccion,
                        date: new Date().toLocaleString()
                    })
                });
            } catch (err) {
                console.error("Failed to notify admin:", err);
            }
        }
        setLoading(false);
    };

    return (
        <main className="register-main">
            <div className="back-wrapper">
                <Link href="/" className="back">← Volver al inicio</Link>
            </div>

            <button
                onClick={toggleTheme}
                className={`theme-toggle-auth-fixed-register ${theme === 'dark' ? 'theme-toggle-dark-reg' : 'theme-toggle-light-reg'}`}
                aria-label="Alternar tema"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="register-container expanded">
                <div className="register-card fade-in">

                    <header className="register-header">
                        <Image
                            src="/judic-ia-mark.png"
                            alt="Logo"
                            className="logo"
                            width={48}
                            height={64}
                            priority
                        />
                        <h1 className="register-brand">Judic-IA</h1>
                        <p className="register-status">Registro Profesional • Abogados</p>
                    </header>

                    <form onSubmit={handleSignUp} className="register-form">
                        <div className="register-grid">
                            <div className="register-field">
                                <label htmlFor="firstName">Nombre</label>
                                <input id="firstName" name="firstName" autoComplete="given-name" type="text" placeholder="Juan" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                            </div>
                            <div className="register-field">
                                <label htmlFor="lastName">Apellido</label>
                                <input id="lastName" name="lastName" autoComplete="family-name" type="text" placeholder="Pérez" value={lastName} onChange={e => setLastName(e.target.value)} required />
                            </div>

                            <div className="register-field full-width">
                                <fieldset className="cuit-fieldset fieldset-reset">
                                    <legend id="cuit-label" className="legend-cuit">CUIT / CUIL</legend>
                                    <div className="cuit-inputs-row">
                                        <input
                                            name="cuitPrefix"
                                            aria-label="CUIT Prefix"
                                            autoComplete="off"
                                            type="text"
                                            placeholder="20"
                                            value={cuitPrefix}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val.length <= 2 && /^\d*$/.test(val)) setCuitPrefix(val);
                                            }}
                                            required
                                            maxLength={2}
                                            className="cuit-input-s"
                                        />
                                        <span className="cuit-separator">-</span>
                                        <input
                                            name="cuitDni"
                                            aria-label="CUIT DNI"
                                            autoComplete="off"
                                            type="text"
                                            placeholder="12345678"
                                            value={cuitDni}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val.length <= 8 && /^\d*$/.test(val)) setCuitDni(val);
                                            }}
                                            required
                                            maxLength={8}
                                            className="cuit-input-m"
                                        />
                                        <span className="cuit-separator">-</span>
                                        <input
                                            name="cuitSuffix"
                                            aria-label="CUIT Suffix"
                                            autoComplete="off"
                                            type="text"
                                            placeholder="6"
                                            value={cuitSuffix}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val.length <= 1 && /^\d*$/.test(val)) setCuitSuffix(val);
                                            }}
                                            required
                                            maxLength={1}
                                            className="cuit-input-xs"
                                        />
                                    </div>
                                </fieldset>
                                {/* 🛡️ CUIT Validation Indicator */}
                                {isCuitComplete && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                        {isCuitValid ? (
                                            <>
                                                <ShieldCheck size={16} style={{ color: '#22c55e' }} />
                                                <span style={{ color: '#22c55e' }}>CUIT válido ✓</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldAlert size={16} style={{ color: '#f87171' }} />
                                                <span style={{ color: '#f87171' }}>CUIT inválido - Verificá los números</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="register-field-row">
                                <div className="flex-1">
                                    <label htmlFor="tomo">Tomo</label>
                                    <input
                                        id="tomo"
                                        name="tomo"
                                        autoComplete="off"
                                        type="number"
                                        placeholder="80"
                                        value={tomo}
                                        onChange={e => setTomo(e.target.value)}
                                        onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                                        required
                                    />
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="folio">Folio</label>
                                    <input
                                        id="folio"
                                        name="folio"
                                        autoComplete="off"
                                        type="number"
                                        placeholder="500"
                                        value={folio}
                                        onChange={e => setFolio(e.target.value)}
                                        onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="register-field">
                                <label htmlFor="jurisdiccion">Jurisdicción / Colegio</label>
                                <select id="jurisdiccion" name="jurisdiccion" autoComplete="organization" value={jurisdiccion} onChange={e => setJurisdiccion(e.target.value)} required>
                                    <option value="">Seleccionar...</option>
                                    {JURISDICCION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            {jurisdiccion === 'Otro' && (
                                <div className="register-field full-width slide-up">
                                    <label htmlFor="customJurisdiccion">Especificar Colegio / Jurisdicción</label>
                                    <input id="customJurisdiccion" name="customJurisdiccion" autoComplete="organization" type="text" placeholder="Ej: Colegio de Abogados de Tucumán" value={customJurisdiccion} onChange={e => setCustomJurisdiccion(e.target.value)} required />
                                </div>
                            )}

                            <div className="register-field full-width">
                                <fieldset className="fieldset-reset">
                                    <legend className="legend-cuit">Especialidades (Lo que atenderá tu IA)</legend>
                                    <div className="tags-container">
                                        {SPECIALTIES_OPTIONS.map(spec => (
                                            <button key={spec} type="button" className={`tag-btn ${specialties.includes(spec) ? 'selected' : ''}`} onClick={() => toggleSpecialty(spec)}>
                                                {spec}
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>
                            </div>
                        </div>

                        <div className="register-field full-width">
                            <div className="label-row">
                                <label htmlFor="email">Email Profesional</label>
                                {email && (
                                    <div className="domain-trust-badge">
                                        {isEmailDomainTrusted ? (
                                            <span className="text-emerald flex items-center gap-1 text-[10px] uppercase font-bold">
                                                <ShieldCheck size={12} /> Confianza Alta
                                            </span>
                                        ) : (
                                            <span className="text-[#94a3b8] flex items-center gap-1 text-[10px] uppercase font-bold opacity-60">
                                                <ShieldAlert size={12} /> No verificado
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <input id="email" name="email" autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dr.nombre@estudio.com" required className={email && !isEmailDomainTrusted ? 'untrusted-domain' : ''} />
                            {email && !isEmailDomainTrusted && (
                                <span className="error-text-mini">
                                    Recomendamos usar Gmail, Outlook o Yahoo para evitar bloqueos
                                </span>
                            )}
                        </div>

                        <div className="register-field full-width">
                            <label htmlFor="confirmEmail">Confirmar Email</label>
                            <input
                                id="confirmEmail"
                                name="confirmEmail"
                                autoComplete="off"
                                type="email"
                                value={confirmEmail}
                                onChange={(e) => setConfirmEmail(e.target.value)}
                                placeholder="Repita su email"
                                required
                                className={(confirmEmail && email.toLowerCase() !== confirmEmail.toLowerCase()) ? 'email-mismatch' : ''}
                            />
                            {confirmEmail && email.toLowerCase() !== confirmEmail.toLowerCase() && (
                                <span className="error-text-mini">
                                    Los emails no coinciden
                                </span>
                            )}
                        </div>

                        <div className="register-grid">
                            <div className="register-field">
                                <div className="label-row">
                                    <label htmlFor="password">Contraseña</label>
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
                                    <div className="pass-icon-left">
                                        <Lock size={16} className="opacity-40" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        autoComplete="new-password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="pl-10"
                                    />
                                    <button type="button" className="eye-toggle-register eye-absolute" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="register-field">
                                <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                                <div className="pass-input-wrapper">
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        autoComplete="new-password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button type="button" className="eye-toggle-register eye-absolute" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="password-checklist">
                            <p className={passwordValidations.length ? 'valid' : ''}>
                                {passwordValidations.length ? <ShieldCheck size={14} className="text-emerald" /> : <ShieldEllipsis size={14} className="opacity-30" />}
                                Mínimo 8 caracteres
                            </p>
                            <p className={passwordValidations.uppercase ? 'valid' : ''}>
                                {passwordValidations.uppercase ? <ShieldCheck size={14} className="text-emerald" /> : <ShieldEllipsis size={14} className="opacity-30" />}
                                Al menos 1 Mayúscula
                            </p>
                            <p className={passwordValidations.number ? 'valid' : ''}>
                                {passwordValidations.number ? <ShieldCheck size={14} className="text-emerald" /> : <ShieldEllipsis size={14} className="opacity-30" />}
                                Al menos 1 Número
                            </p>
                            <p className={passwordValidations.symbol ? 'valid' : ''}>
                                {passwordValidations.symbol ? <ShieldCheck size={14} className="text-emerald" /> : <ShieldEllipsis size={14} className="opacity-30" />}
                                Al menos 1 Símbolo (!@#$...)
                            </p>

                            {/* Pwned Check Item */}
                            {password.length >= 6 && (
                                <p className={pwnedStatus === 'safe' ? 'valid' : pwnedStatus === 'breached' ? 'invalid-crit' : ''}>
                                    {isCheckingPwned ? <RefreshCw size={14} className="animate-spin text-gold" /> :
                                        pwnedStatus === 'safe' ? <ShieldCheck size={14} className="text-emerald" /> :
                                            pwnedStatus === 'breached' ? <ShieldAlert size={14} className="text-red-500" /> :
                                                <ShieldEllipsis size={14} className="opacity-30" />}
                                    {pwnedStatus === 'breached' ? 'Clave comprometida en internet' : 'Protección contra filtraciones'}
                                </p>
                            )}

                            {confirmPassword && (
                                <p className={passwordsMatch ? 'valid' : 'invalid'}>
                                    {passwordsMatch ? <ShieldCheck size={14} className="text-emerald" /> : <ShieldAlert size={14} className="text-red-500" />}
                                    Las contraseñas coinciden
                                </p>
                            )}
                        </div>

                        <div className="consent-check">
                            <input type="checkbox" id="consent" checked={consent} onChange={e => setConsent(e.target.checked)} />
                            <label htmlFor="consent">
                                Declaro bajo juramento que soy un abogado matriculado habilitado para ejercer y que los datos proporcionados son reales.
                            </label>
                        </div>

                        {error && <div className="error-msg">⚠️ {error}</div>}

                        {!message && (
                            <button
                                type="submit"
                                disabled={loading || !isPasswordStrong || !passwordsMatch || !emailsMatch || pwnedStatus === 'breached'}
                                className="btn-register-action"
                            >
                                {loading ? 'Procesando Registro...' : 'Confirmar Registro Profesional'}
                            </button>
                        )}
                    </form>

                    <footer className="register-footer">
                        <p>¿Ya tienes una cuenta? <Link href="/login" className="link-gold">Inicia Sesión →</Link></p>
                    </footer>
                </div>
            </div>

            {/* FULL SCREEN SUCCESS MODAL - Moved outside to escape backdrop-filter context */}
            {message && (
                <div className="register-success-modal">
                    <div className="success-modal-content">
                        <div className="success-icon-large">
                            <ShieldCheck size={80} />
                        </div>
                        <h2 className="success-title-large">¡Registro Confirmado!</h2>
                        <p className="success-text-large">
                            Hemos enviado un correo de validación a:<br />
                            <span className="success-highlight">{email}</span>
                        </p>
                        <p className="text-slate-400 text-sm mb-6 success-subtext">
                            ⚠️ Es <strong>fundamental</strong> que revises tu bandeja de entrada (y Spam) para activar tu cuenta.
                        </p>

                        <div className="redirect-timer">
                            Redirigiendo al login en <strong>{redirectCountdown}</strong> segundos...
                        </div>
                        <div className="mt-6">
                            <Link href="/login" className="btn-register-action" style={{ padding: '0.8rem 2rem', fontSize: '0.9rem' }}>
                                Ir al Login Ahora
                            </Link>
                        </div>
                    </div>
                </div>
            )}


        </main>
    );
}
