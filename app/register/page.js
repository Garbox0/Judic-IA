"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SafeChatWidget from '../components/SafeChatWidget';
import '../globals.css';

export default function RegisterPage() {
    const router = useRouter();

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [cuit, setCuit] = useState('');
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

    // Password Validations
    const passwordValidations = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password)
    };

    const isPasswordStrong = Object.values(passwordValidations).every(v => v);
    const passwordsMatch = password === confirmPassword && confirmPassword !== '';

    // Auto-redirect if already logged in
    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) router.push('/dashboard');
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
                emailRedirectTo: `${window.location.origin}/dashboard`,
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    full_name: `${firstName} ${lastName}`,
                    cuit: cuit,
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
        <main className="auth-main">
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
      `}</style>

            <div className="auth-container expanded">
                <div className="auth-card glass-premium fade-in">
                    <Link href="/" className="btn-back-premium">← Volver al Inicio</Link>

                    <header className="brand-header">
                        <img src="/logo.png" alt="Logo" className="brand-logo-img" />
                        <h1 className="brand-name-premium">Judic-IA <span className="justice-emoji">⚖️</span></h1>
                        <p className="brand-status">Registro Profesional • Abogados</p>
                    </header>

                    <form onSubmit={handleSignUp} className="premium-form">
                        <div className="signup-grid-premium">
                            <div className="input-field">
                                <label>Nombre</label>
                                <input type="text" placeholder="Juan" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                            </div>
                            <div className="input-field">
                                <label>Apellido</label>
                                <input type="text" placeholder="Pérez" value={lastName} onChange={e => setLastName(e.target.value)} required />
                            </div>

                            <div className="input-field full-width">
                                <label>CUIT / CUIL</label>
                                <input type="text" placeholder="20-12345678-9" value={cuit} onChange={e => setCuit(e.target.value)} required />
                            </div>

                            <div className="input-field-row">
                                <div style={{ flex: 1 }}>
                                    <label>Tomo</label>
                                    <input type="number" placeholder="80" value={tomo} onChange={e => setTomo(e.target.value)} required />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Folio</label>
                                    <input type="number" placeholder="500" value={folio} onChange={e => setFolio(e.target.value)} required />
                                </div>
                            </div>

                            <div className="input-field">
                                <label>Jurisdicción / Colegio</label>
                                <select value={jurisdiccion} onChange={e => setJurisdiccion(e.target.value)} required>
                                    <option value="">Seleccionar...</option>
                                    {JURISDICCION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            {jurisdiccion === 'Otro' && (
                                <div className="input-field full-width slide-up">
                                    <label>Especificar Colegio / Jurisdicción</label>
                                    <input type="text" placeholder="Ej: Colegio de Abogados de Tucumán" value={customJurisdiccion} onChange={e => setCustomJurisdiccion(e.target.value)} required />
                                </div>
                            )}

                            <div className="input-field full-width">
                                <label>Especialidades (Lo que atenderá tu IA)</label>
                                <div className="tags-container-premium">
                                    {SPECIALTIES_OPTIONS.map(spec => (
                                        <button key={spec} type="button" className={`tag-premium ${specialties.includes(spec) ? 'selected' : ''}`} onClick={() => toggleSpecialty(spec)}>
                                            {spec}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="input-field full-width">
                            <label>Email Profesional</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dr.nombre@estudio.com" required />
                        </div>

                        <div className="signup-grid-premium">
                            <div className="input-field">
                                <label>Contraseña</label>
                                <div className="pass-input-wrapper">
                                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                                    <button type="button" className="eye-toggle-premium" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? "👁️" : "👁️‍🗨️"}
                                    </button>
                                </div>
                            </div>

                            <div className="input-field">
                                <label>Confirmar Contraseña</label>
                                <div className="pass-input-wrapper">
                                    <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                                    <button type="button" className="eye-toggle-premium" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="password-checklist-premium">
                            <p className={passwordValidations.length ? 'valid' : ''}>{passwordValidations.length ? '✅' : '❌'} Mínimo 8 caracteres</p>
                            <p className={passwordValidations.uppercase ? 'valid' : ''}>{passwordValidations.uppercase ? '✅' : '❌'} Al menos 1 Mayúscula</p>
                            <p className={passwordValidations.number ? 'valid' : ''}>{passwordValidations.number ? '✅' : '❌'} Al menos 1 Número</p>
                            <p className={passwordValidations.symbol ? 'valid' : ''}>{passwordValidations.symbol ? '✅' : '❌'} Al menos 1 Símbolo (!@#$...)</p>
                            {confirmPassword && (
                                <p className={passwordsMatch ? 'valid' : 'invalid'}>{passwordsMatch ? '✅' : '❌'} Las contraseñas coinciden</p>
                            )}
                        </div>

                        <div className="consent-check-premium">
                            <input type="checkbox" id="consent" checked={consent} onChange={e => setConsent(e.target.checked)} />
                            <label htmlFor="consent">
                                Declaro bajo juramento que soy un abogado matriculado habilitado para ejercer y que los datos proporcionados son reales.
                            </label>
                        </div>

                        {error && <div className="error-premium">⚠️ {error}</div>}
                        {message && (
                            <div className="success-premium">
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

                        <button type="submit" disabled={loading || !isPasswordStrong || !passwordsMatch} className="btn-gold-action">
                            {loading ? 'Procesando Registro...' : 'Confirmar Registro Profesional'}
                        </button>
                    </form>

                    <div className="divider-premium"><span>o</span></div>

                    <footer className="auth-nav-footer">
                        <p>¿Ya tienes una cuenta?
                            <Link href="/login" className="link-gold">Inicia Sesión</Link>
                        </p>
                    </footer>
                </div>
            </div>

            <style jsx>{`
        .auth-main { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 10%, #0f172a, #020617); font-family: 'Inter', sans-serif; padding: 4rem 2rem; }
        .auth-container { width: 100%; max-width: 440px; position: relative; }
        .auth-container.expanded { max-width: 650px; }
        
        .glass-premium { 
            background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(25px); 
            padding: 4rem 3.5rem; border-radius: 32px; 
            border: 1px solid rgba(255, 255, 255, 0.08); 
            box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6); 
        }

        .brand-header { text-align: center; margin-bottom: 3rem; }
        .brand-logo-img { width: 55px; margin-bottom: 1.25rem; filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3)); }
        .brand-name-premium { font-family: 'Playfair Display', serif; font-size: 2.2rem; font-weight: 900; color: #fbbf24; margin-bottom: 0.5rem; letter-spacing: -0.01em; }
        .brand-status { color: #64748b; font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
        .justice-emoji { font-style: normal; }

        .premium-form { display: flex; flex-direction: column; gap: 1.75rem; }
        .signup-grid-premium { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; width: 100%; }
        .full-width { grid-column: span 2; }
        
        .input-field label, .input-field-row label { display: block; color: #94a3b8; margin-bottom: 0.6rem; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .input-field input, .input-field select, .input-field-row input { 
            width: 100%; padding: 1.1rem 1.25rem; background: rgba(2, 6, 23, 0.5); 
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; 
            color: white; font-size: 1rem; transition: 0.3s; outline: none;
        }
        .input-field input:focus, .input-field select:focus, .input-field-row input:focus { border-color: #fbbf24; background: rgba(2, 6, 23, 0.8); box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1); }
        
        .input-field-row { display: flex; gap: 1rem; grid-column: span 1; }

        .pass-input-wrapper { position: relative; }
        .eye-toggle-premium { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 1.2rem; opacity: 0.5; }

        .tags-container-premium { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.5rem; }
        .tag-premium { 
            background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); 
            color: #94a3b8; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.8rem; 
            cursor: pointer; transition: 0.3s; 
        }
        .tag-premium.selected { background: #fbbf24; color: #020617; border-color: #fbbf24; font-weight: 700; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.2); }
        .tag-premium:hover:not(.selected) { border-color: #fbbf24; color: #fbbf24; }

        .password-checklist-premium { background: rgba(2, 6, 23, 0.4); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.03); }
        .password-checklist-premium p { margin: 0.4rem 0; font-size: 0.85rem; color: #64748b; }
        .password-checklist-premium p.valid { color: #86efac; font-weight: 600; }
        .password-checklist-premium p.invalid { color: #fca5a5; font-weight: 600; }

        .consent-check-premium { display: flex; gap: 1rem; align-items: flex-start; color: #94a3b8; font-size: 0.85rem; line-height: 1.4; margin: 0.5rem 0; }
        .consent-check-premium input { width: 18px; height: 18px; margin-top: 0.2rem; cursor: pointer; accent-color: #fbbf24; }

        .btn-gold-action { 
            width: 100%; padding: 1.25rem; background: linear-gradient(135deg, #fbbf24, #d97706); 
            color: #020617; border: none; border-radius: 16px; font-weight: 800; font-size: 1rem;
            cursor: pointer; transition: 0.4s; box-shadow: 0 10px 25px rgba(217, 119, 6, 0.3); text-transform: uppercase;
        }
        .btn-gold-action:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(217, 119, 6, 0.4); filter: brightness(1.1); }
        .btn-gold-action:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(0.5); }

        .divider-premium { text-align: center; position: relative; margin: 2.5rem 0; }
        .divider-premium::before { content: ''; position: absolute; left: 0; top: 50%; width: 100%; height: 1px; background: rgba(255, 255, 255, 0.05); }
        .divider-premium span { position: relative; background: #0f172a; padding: 0 1rem; color: #475569; font-size: 0.8rem; }

        .error-premium { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 1.25rem; border-radius: 14px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); }
        .success-premium { background: rgba(34, 197, 94, 0.1); color: #86efac; padding: 1.25rem; border-radius: 14px; text-align: center; border: 1px solid rgba(34, 197, 94, 0.2); }
        
        .btn-back-premium { position: absolute; top: 1.5rem; left: 1.5rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 600; transition: 0.3s; }
        .btn-back-premium:hover { color: #fbbf24; }

        .auth-nav-footer { text-align: center; font-size: 1rem; color: #94a3b8; }
        .link-gold { color: #fbbf24; text-decoration: none; font-weight: 700; margin-left: 0.5rem; }
        .link-gold:hover { text-decoration: underline; }

        .fade-in { animation: fadeIn 0.8s ease forwards; }
        .slide-up { animation: slideUp 0.4s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        @media(max-width: 650px) {
            .signup-grid-premium { grid-template-columns: 1fr; }
            .input-field-row { grid-column: span 2; }
            .glass-premium { padding: 3rem 1.5rem; }
        }
      `}</style>
            <SafeChatWidget mode="sales" initialMessage="¡Hola! ¿Necesitas ayuda con el registro profesional?" />
        </main>
    );
}
