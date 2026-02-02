"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon } from 'lucide-react';
import SafeChatWidget from '../components/SafeChatWidget';
import './register.css';

/* Inline styles for CUIT row, typically would be in CSS but adding here for quick execution */
const cuitStyles = `
.cuit-inputs-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
`;

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

    const isPasswordStrong = Object.values(passwordValidations).every(v => v);
    const passwordsMatch = password === confirmPassword && confirmPassword !== '';
    const emailsMatch = email.toLowerCase() === confirmEmail.toLowerCase() && email !== '';

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
            setError("los emails no coinciden.");
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

        const finalJurisdiccion = jurisdiccion === 'Otro' ? customJurisdiccion : jurisdiccion;
        const finalMatricula = `T° ${tomo} F° ${folio}`;

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    full_name: `${firstName} ${lastName}`,
                    cuit: `${cuitPrefix}-${cuitDni}-${cuitSuffix}`,
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
        }
        setLoading(false);
    };

    return (
        <main className="register-main">
            <div className="back-wrapper">
                <Link href="/home" className="back">← Volver al inicio</Link>
                <button
                    onClick={toggleTheme}
                    className="theme-toggle-auth"
                    aria-label="Alternar tema"
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: theme === 'dark' ? '#fbbf24' : '#0f172a',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        marginLeft: 'auto'
                    }}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

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
                            style={{ objectFit: 'contain' }}
                        />
                        <h1 className="register-brand">Judic-IA <span className="justice-emoji">⚖️</span></h1>
                        <p className="register-status">Registro Profesional • Abogados</p>
                    </header>

                    <form onSubmit={handleSignUp} className="register-form">
                        <div className="register-grid">
                            <div className="register-field">
                                <label>Nombre</label>
                                <input type="text" placeholder="Juan" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                            </div>
                            <div className="register-field">
                                <label>Apellido</label>
                                <input type="text" placeholder="Pérez" value={lastName} onChange={e => setLastName(e.target.value)} required />
                            </div>

                            <div className="register-field full-width">
                                <label>CUIT / CUIL</label>
                                <div className="cuit-inputs-row">
                                    <input
                                        type="text"
                                        placeholder="20"
                                        value={cuitPrefix}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val.length <= 2 && /^\d*$/.test(val)) setCuitPrefix(val);
                                        }}
                                        required
                                        maxLength={2}
                                        style={{ width: '65px', textAlign: 'center' }}
                                    />
                                    <span style={{ color: '#64748b', fontSize: '1.2rem' }}>-</span>
                                    <input
                                        type="text"
                                        placeholder="12345678"
                                        value={cuitDni}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val.length <= 8 && /^\d*$/.test(val)) setCuitDni(val);
                                        }}
                                        required
                                        maxLength={8}
                                        style={{ flex: 1, textAlign: 'center' }}
                                    />
                                    <span style={{ color: '#64748b', fontSize: '1.2rem' }}>-</span>
                                    <input
                                        type="text"
                                        placeholder="6"
                                        value={cuitSuffix}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val.length <= 1 && /^\d*$/.test(val)) setCuitSuffix(val);
                                        }}
                                        required
                                        maxLength={1}
                                        style={{ width: '50px', textAlign: 'center' }}
                                    />
                                </div>
                            </div>

                            <div className="register-field-row">
                                <div style={{ flex: 1 }}>
                                    <label>Tomo</label>
                                    <input
                                        type="number"
                                        placeholder="80"
                                        value={tomo}
                                        onChange={e => setTomo(e.target.value)}
                                        onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                                        required
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Folio</label>
                                    <input
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
                                <label>Jurisdicción / Colegio</label>
                                <select value={jurisdiccion} onChange={e => setJurisdiccion(e.target.value)} required>
                                    <option value="">Seleccionar...</option>
                                    {JURISDICCION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            {jurisdiccion === 'Otro' && (
                                <div className="register-field full-width slide-up">
                                    <label>Especificar Colegio / Jurisdicción</label>
                                    <input type="text" placeholder="Ej: Colegio de Abogados de Tucumán" value={customJurisdiccion} onChange={e => setCustomJurisdiccion(e.target.value)} required />
                                </div>
                            )}

                            <div className="register-field full-width">
                                <label>Especialidades (Lo que atenderá tu IA)</label>
                                <div className="tags-container">
                                    {SPECIALTIES_OPTIONS.map(spec => (
                                        <button key={spec} type="button" className={`tag-btn ${specialties.includes(spec) ? 'selected' : ''}`} onClick={() => toggleSpecialty(spec)}>
                                            {spec}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="register-field full-width">
                            <label>Email Profesional</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dr.nombre@estudio.com" required />
                        </div>

                        <div className="register-field full-width">
                            <label>Confirmar Email</label>
                            <input
                                type="email"
                                value={confirmEmail}
                                onChange={(e) => setConfirmEmail(e.target.value)}
                                placeholder="Repita su email"
                                required
                                style={{ borderColor: (confirmEmail && email.toLowerCase() !== confirmEmail.toLowerCase()) ? '#ef4444' : '' }}
                            />
                            {confirmEmail && email.toLowerCase() !== confirmEmail.toLowerCase() && (
                                <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                                    Los emails no coinciden
                                </span>
                            )}
                        </div>

                        <div className="register-grid">
                            <div className="register-field">
                                <label>Contraseña</label>
                                <div className="pass-input-wrapper">
                                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                                    <button type="button" className="eye-toggle-register" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? "👁️" : "👁️‍🗨️"}
                                    </button>
                                </div>
                            </div>

                            <div className="register-field">
                                <label>Confirmar Contraseña</label>
                                <div className="pass-input-wrapper">
                                    <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                                    <button type="button" className="eye-toggle-register" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="password-checklist">
                            <p className={passwordValidations.length ? 'valid' : ''}>{passwordValidations.length ? '✅' : '❌'} Mínimo 8 caracteres</p>
                            <p className={passwordValidations.uppercase ? 'valid' : ''}>{passwordValidations.uppercase ? '✅' : '❌'} Al menos 1 Mayúscula</p>
                            <p className={passwordValidations.number ? 'valid' : ''}>{passwordValidations.number ? '✅' : '❌'} Al menos 1 Número</p>
                            <p className={passwordValidations.symbol ? 'valid' : ''}>{passwordValidations.symbol ? '✅' : '❌'} Al menos 1 Símbolo (!@#$...)</p>
                            {confirmPassword && (
                                <p className={passwordsMatch ? 'valid' : 'invalid'}>{passwordsMatch ? '✅' : '❌'} Las contraseñas coinciden</p>
                            )}
                        </div>

                        <div className="consent-check">
                            <input type="checkbox" id="consent" checked={consent} onChange={e => setConsent(e.target.checked)} />
                            <label htmlFor="consent">
                                Declaro bajo juramento que soy un abogado matriculado habilitado para ejercer y que los datos proporcionados son reales.
                            </label>
                        </div>

                        {error && <div className="error-msg">⚠️ {error}</div>}
                        {message && (
                            <div className="success-msg">
                                📩 {message}
                                <br />
                                <small style={{ color: '#fff', display: 'block', marginTop: '5px' }}>
                                    ⚠️ Si no lo ves, <strong>revisá Correo no deseado / Spam</strong>.
                                </small>
                                {redirectCountdown !== null && (
                                    <div style={{ marginTop: '0.8rem', fontWeight: 700, color: '#white' }}>
                                        Redirigiendo al login en {redirectCountdown} segundos...
                                    </div>
                                )}
                            </div>
                        )}

                        {!message && (
                            <button type="submit" disabled={loading || !isPasswordStrong || !passwordsMatch || !emailsMatch} className="btn-register-action">
                                {loading ? 'Procesando Registro...' : 'Confirmar Registro Profesional'}
                            </button>
                        )}
                    </form>

                    <div className="divider"><span>o</span></div>

                    <footer className="register-footer">
                        <p>¿Ya tienes una cuenta? <Link href="/login" className="link-gold">Inicia Sesión →</Link></p>
                    </footer>
                </div>
            </div>

            <SafeChatWidget mode="sales" initialMessage="¡Hola! ¿Necesitas ayuda con el registro profesional?" />
        </main>
    );
}
