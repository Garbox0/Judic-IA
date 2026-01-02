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
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [cuit, setCuit] = useState('');
    const [matricula, setMatricula] = useState('');
    const [jurisdiccion, setJurisdiccion] = useState('');
    const [specialties, setSpecialties] = useState([]);
    const [consent, setConsent] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [customJurisdiccion, setCustomJurisdiccion] = useState('');

    // Auto-redirect if already logged in
    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) router.push('/dashboard');
        };
        checkUser();
    }, [router]);

    const SPECIALTIES_OPTIONS = [
        'Laboral', 'Familia', 'Penal', 'Sucesiones', 'Comercial', 'Previsional',
        'Civil', 'Administrativo', 'Tributario', 'Seguros', 'Defensa del Consumidor',
        'Daños y Perjuicios', 'Propiedad Intelectual', 'Ambiental', 'Aduanero', 'Seguridad Social'
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

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/dashboard`,
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    cuit: cuit,
                    matricula: matricula,
                    jurisdiccion: finalJurisdiccion,
                    especialidades: specialties
                }
            }
        });

        if (error) {
            if (error.message.includes("rate limit")) {
                setError("Demasiados intentos. Por favor espera un momento.");
            } else if (error.message.includes("already registered") || error.message.includes("valid")) {
                setError("Este email ya está registrado o los datos son inválidos.");
            } else {
                setError(error.message);
            }
        } else {
            setMessage("¡Registro iniciado! Revisa tu email para confirmar tu cuenta. ⚠️ IMPORTANTE: Busca en la carpeta de SPAM si no lo ves en Recibidos.");
        }
        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-card glass-panel expanded">
                <Link href="/" className="btn-back">← Volver al Inicio</Link>
                <Link href="/">
                    <img src="/logo.png" alt="Judic-IA Logo" className="logo-img" style={{ display: 'block', margin: '0 auto' }} />
                </Link>
                <h1 className="logo-text" style={{ textAlign: 'center' }}>Judic-IA</h1>
                <p className="subtitle" style={{ textAlign: 'center' }}>Crear Cuenta Profesional</p>

                <form onSubmit={handleSignUp}>
                    <div className="signup-grid">
                        <div className="input-group">
                            <label>Nombre</label>
                            <input type="text" placeholder="Juan" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                        </div>
                        <div className="input-group">
                            <label>Apellido</label>
                            <input type="text" placeholder="Pérez" value={lastName} onChange={e => setLastName(e.target.value)} required />
                        </div>

                        <div className="input-group full-width">
                            <label>CUIT / CUIL</label>
                            <input type="text" placeholder="20-12345678-9" value={cuit} onChange={e => setCuit(e.target.value)} required />
                        </div>

                        <div className="input-group">
                            <label>Matrícula (T° F°)</label>
                            <input type="text" placeholder="T 80 F 500" value={matricula} onChange={e => setMatricula(e.target.value)} required />
                        </div>

                        <div className="input-group">
                            <label>Jurisdicción / Colegio</label>
                            <select value={jurisdiccion} onChange={e => setJurisdiccion(e.target.value)} required>
                                <option value="">Seleccionar...</option>
                                {JURISDICCION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        {jurisdiccion === 'Otro' && (
                            <div className="input-group full-width fade-in">
                                <label>Especificar Colegio / Jurisdicción</label>
                                <input type="text" placeholder="Ej: Colegio de Abogados de Tucumán" value={customJurisdiccion} onChange={e => setCustomJurisdiccion(e.target.value)} required />
                            </div>
                        )}

                        <div className="input-group full-width">
                            <label>Especialidades (Lo que atenderá tu IA)</label>
                            <div className="tags-container">
                                {SPECIALTIES_OPTIONS.map(spec => (
                                    <button key={spec} type="button" className={`tag ${specialties.includes(spec) ? 'selected' : ''}`} onClick={() => toggleSpecialty(spec)}>
                                        {spec}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="input-group full-width">
                        <label>Email Profesional</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dr.ejemplo@estudio.com" required />
                    </div>

                    <div className="input-group full-width">
                        <label>Establecer Contraseña</label>
                        <div className="password-wrapper">
                            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                            <button type="button" className="eye-toggle" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? "👁️" : "👁️‍🗨️"}
                            </button>
                        </div>
                    </div>

                    <div className="consent-box">
                        <input type="checkbox" id="consent" checked={consent} onChange={e => setConsent(e.target.checked)} />
                        <label htmlFor="consent">
                            Declaro bajo juramento que soy un abogado matriculado habilitado para ejercer y que los datos proporcionados son reales.
                        </label>
                    </div>

                    {error && <div className="error-msg">{error}</div>}
                    {message && <div className="success-msg">📩 {message}</div>}

                    <button type="submit" disabled={loading} className="btn-primary">
                        {loading ? 'Procesando...' : 'Confirmar Registro'}
                    </button>
                </form>

                <div className="divider">o</div>
                <div className="toggle-mode" style={{ textAlign: 'center' }}>
                    <p>¿Ya tienes cuenta? <Link href="/login" style={{ color: '#fbbf24', fontWeight: 600, textDecoration: 'none', marginLeft: '0.5rem' }}>Inicia Sesión</Link></p>
                </div>
            </div>

            <style jsx>{`
        .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; font-family: 'Inter', sans-serif; padding: 1rem; }
        .login-card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(16px); padding: 2.5rem; border-radius: 20px; width: 100%; max-width: 400px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; }
        .logo-img { width: 60px; height: auto; margin-bottom: 1rem; }
        .login-card.expanded { max-width: 550px; }
        .logo-img { width: 60px; margin-bottom: 1rem; }
        .logo-text { color: #fbbf24; font-size: 2rem; margin-bottom: 0.5rem; }
        .subtitle { color: #94a3b8; margin-bottom: 2rem; }
        .signup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .full-width { grid-column: span 2; }
        .input-group label { display: block; color: #cbd5e1; margin-bottom: 0.5rem; font-size: 0.85rem; }
        .input-group input, .input-group select { width: 100%; padding: 0.75rem 1rem; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white; outline: none; }
        .password-wrapper { position: relative; width: 100%; }
        .eye-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.6; }
        .tags-container { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .tag { background: #0f172a; border: 1px solid #334155; color: #94a3b8; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; cursor: pointer; }
        .tag.selected { background: #fbbf24; color: #0f172a; border-color: #fbbf24; font-weight: 600; }
        .consent-box { display: flex; gap: 0.8rem; align-items: flex-start; margin-bottom: 1.5rem; color: #94a3b8; font-size: 0.8rem; margin-top: 1rem; }
        .btn-primary { width: 100%; padding: 0.9rem; background: #fbbf24; color: #0f172a; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 1rem; }
        .divider { text-align: center; color: #64748b; margin: 1.5rem 0; font-size: 0.8rem; }
        .error-msg { background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; text-align: center; }
        .success-msg { background: rgba(34, 197, 94, 0.2); color: #86efac; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; text-align: center; }
        .btn-back { align-self: flex-start; color: #94a3b8; text-decoration: none; font-size: 0.85rem; margin-bottom: 1.5rem; transition: 0.2s; font-weight: 500; }
        .btn-back:hover { color: #fbbf24; }
      `}</style>
            <SafeChatWidget mode="sales" initialMessage="¡Hola! ¿Necesitas ayuda con el registro profesional?" />
        </div>
    );
}
