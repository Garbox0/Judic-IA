"use client";
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import SafeChatWidget from '../components/SafeChatWidget';
import '../globals.css';

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cuit, setCuit] = useState('');
  const [matricula, setMatricula] = useState('');
  const [jurisdiccion, setJurisdiccion] = useState('');
  const [specialties, setSpecialties] = useState([]); // Array of strings
  const [consent, setConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null); // Success message state
  const [showPassword, setShowPassword] = useState(false);
  const [customJurisdiccion, setCustomJurisdiccion] = useState('');

  const [paymentStep, setPaymentStep] = useState(false);

  // Options
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      let msg = error.message;
      if (msg === "Email not confirmed") msg = "Debes confirmar tu email antes de ingresar. Revisa tu bandeja de entrada.";
      if (msg === "Invalid login credentials") msg = "Credenciales inválidas. Revisa tu email y contraseña.";
      setError(msg);
      setLoading(false);
    } else {
      router.push('/dashboard');
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

    // Send metadata to Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
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

    // STEALTH MODE: Even if there's an error like "User already registered", 
    // we show a success message to avoid leaking user existence.
    // Supabase returns an error for duplicates if "Enable email provider" is on.
    if (error) {
      // In a real production environment with high security, we'd log this error silently
      // and show the "Check your email" message anyway. 
      // But for better UX during dev, if it's a REAL structural error, we show it.
      if (error.message.includes("rate limit") || error.message.includes("valid")) {
        setError(error.message);
      } else {
        // Assume duplicate or successful send logic
        setMessage("¡Casi listo! Si el email es válido, recibirás un enlace de confirmación en instantes.");
      }
    } else {
      setMessage("¡Registro iniciado! Revisa tu email para confirmar tu cuenta profesional.");
      // We don't jump to payment until they confirm email for security/validity
    }
    setLoading(false);
  };

  const handlePayment = () => {
    setLoading(true);
    // Simulate Mercado Pago flow
    setTimeout(() => {
      alert("¡Pago exitoso! Bienvenido a Judic-IA Profesional.");
      router.push('/dashboard');
    }, 1500);
  };

  // Payment UI render
  const renderPaymentStep = () => (
    <div className="payment-container fade-in">
      <h2 className="payment-title">Suscripción Requerida</h2>
      <p className="payment-subtitle">Para completar tu registro y acceder al Gabinete Jurídico, debes activar tu membresía.</p>

      <div className="plan-card gold-border">
        <div className="plan-header">
          <span className="badge">PROFESIONAL</span>
          <h3>Judic-IA Full Access</h3>
        </div>
        <div className="plan-price">$15.000 <small>/ mes</small></div>
        <ul className="plan-features">
          <li>✅ Asistente IA 24/7 (Laboral)</li>
          <li>✅ Gestión ilimitada de Clientes</li>
          <li>✅ Investigación Legal Premium</li>
          <li>✅ Agenda Inteligente</li>
        </ul>
        <button onClick={handlePayment} className="btn-mp">
          <span className="mp-icon">🤝</span> Suscribirse con Mercado Pago
        </button>
        <p className="secure-text">🔒 Pago seguro y encriptado</p>
      </div>
    </div>
  );

  return (
    <div className="login-container">
      <div className={`login-card glass-panel ${isSignUp || paymentStep ? 'expanded' : ''}`}>
        <img src="/logo.png" alt="Judic-IA Logo" className="logo-img" />
        <h1 className="logo-text">Judic-IA</h1>
        {!paymentStep && (
          <p className="subtitle">{isSignUp ? 'Registro Profesional' : 'Acceso para Abogados'}</p>
        )}

        {paymentStep ? (
          renderPaymentStep()
        ) : (
          <form onSubmit={isSignUp ? handleSignUp : handleLogin}>

            {/* -- SIGNUP ONLY FIELDS -- */}
            {isSignUp && (
              <div className="signup-grid">
                <div className="input-group">
                  <label>Nombre</label>
                  <input
                    type="text"
                    placeholder="Juan"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required={isSignUp}
                  />
                </div>
                <div className="input-group">
                  <label>Apellido</label>
                  <input
                    type="text"
                    placeholder="Pérez"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required={isSignUp}
                  />
                </div>

                <div className="input-group full-width">
                  <label>CUIT / CUIL</label>
                  <input
                    type="text"
                    placeholder="20-12345678-9"
                    value={cuit}
                    onChange={e => setCuit(e.target.value)}
                    required={isSignUp}
                  />
                </div>

                <div className="input-group">
                  <label>Matrícula (T° F°)</label>
                  <input
                    type="text"
                    placeholder="T 80 F 500"
                    value={matricula}
                    onChange={e => setMatricula(e.target.value)}
                    required={isSignUp}
                  />
                </div>

                <div className="input-group">
                  <label>Jurisdicción / Colegio</label>
                  <select
                    value={jurisdiccion}
                    onChange={e => setJurisdiccion(e.target.value)}
                    required={isSignUp}
                  >
                    <option value="">Seleccionar...</option>
                    {JURISDICCION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                {jurisdiccion === 'Otro' && (
                  <div className="input-group full-width fade-in">
                    <label>Especificar Colegio / Jurisdicción</label>
                    <input
                      type="text"
                      placeholder="Ej: Colegio de Abogados de Tucumán"
                      value={customJurisdiccion}
                      onChange={e => setCustomJurisdiccion(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="input-group full-width">
                  <label>Especialidades (Lo que atenderá tu IA)</label>
                  <div className="tags-container">
                    {SPECIALTIES_OPTIONS.map(spec => (
                      <button
                        key={spec}
                        type="button"
                        className={`tag ${specialties.includes(spec) ? 'selected' : ''}`}
                        onClick={() => toggleSpecialty(spec)}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* -- COMMON FIELDS -- */}
            <div className="input-group full-width">
              <label>Email Profesional</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dr.ejemplo@estudio.com"
                required
              />
            </div>

            <div className="input-group full-width">
              <label>Contraseña</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            {/* -- CONSENT -- */}
            {isSignUp && (
              <div className="consent-box">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                />
                <label htmlFor="consent">
                  Declaro bajo juramento que soy un abogado matriculado habilitado para ejercer y que los datos proporcionados son reales.
                </label>
              </div>
            )}

            {error && <div className="error-msg">{error}</div>}
            {message && <div className="success-msg">📩 {message}</div>}

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Procesando...' : (isSignUp ? 'Confirmar Registro' : 'Iniciar Sesión')}
            </button>
          </form>
        )}

        {!paymentStep && (
          <>
            <div className="divider">o</div>
            <div className="toggle-mode">
              {isSignUp ? (
                <p>¿Ya tienes cuenta? <button type="button" onClick={() => setIsSignUp(false)}>Inicia Sesión</button></p>
              ) : (
                <p>¿Nuevo en Judic-IA? <button type="button" onClick={() => setIsSignUp(true)}>Crear Cuenta Profesional</button></p>
              )}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          font-family: 'Inter', sans-serif;
          padding: 1rem;
        }
        .login-card {
          background: var(--glass);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          padding: 2.5rem;
          border-radius: 20px;
          width: 100%;
          max-width: 400px;
          border: 1px solid var(--glass-border);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .login-card:hover {
          border-color: rgba(197, 160, 33, 0.2);
        }
        .login-card.expanded {
          max-width: 550px;
        }
        .logo-img { width: 60px; margin-bottom: 1rem; }
        .logo-text { color: var(--primary); font-size: 2rem; margin-bottom: 0.5rem; text-shadow: 0 0 15px rgba(197, 160, 33, 0.3); }
        .subtitle { color: var(--muted); margin-bottom: 2rem; }
        
        /* PAYMENT STEP */
        .payment-container { text-align: center; width: 100%; animation: fadeIn 0.5s ease; }
        .payment-title { color: white; margin-bottom: 0.5rem; }
        .payment-subtitle { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem; }
        .plan-card {
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.9));
            border: 1px solid rgba(197, 160, 33, 0.3);
            border-radius: 16px;
            padding: 2rem;
            position: relative;
            overflow: hidden;
            text-align: left;
        }
        .plan-card::before { content:''; position:absolute; top:0; left:0; width:100%; height:4px; background:var(--primary); }
        .badge { background:rgba(197,160,33,0.2); color:#fbbf24; font-size:0.7rem; padding:0.2rem 0.6rem; border-radius:4px; font-weight:800; }
        .plan-header h3 { margin: 0.5rem 0; font-size: 1.4rem; color: white; }
        .plan-price { font-size: 2rem; font-weight: 300; color: white; margin-bottom: 1.5rem; }
        .plan-price small { font-size: 1rem; color: #94a3b8; }
        .plan-features { list-style: none; padding: 0; margin-bottom: 2rem; color: #cbd5e1; font-size: 0.95rem; }
        .plan-features li { margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
        .btn-mp {
            width: 100%;
            background: #009ee3;
            color: white;
            border: none;
            padding: 0.9rem;
            border-radius: 8px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        .btn-mp:hover { background: #0081b8; transform: translateY(-1px); }
        .secure-text { font-size: 0.75rem; color: #64748b; margin-top: 1rem; text-align: center; opacity: 0.8; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .signup-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        .full-width { grid-column: span 2; }

        .input-group label {
          display: block;
          color: #cbd5e1;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
        }
        .input-group input, .input-group select {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: white;
          outline: none;
          transition: all 0.2s;
        }
        .input-group input:focus, .input-group select:focus { 
          border-color: var(--primary); 
          box-shadow: 0 0 0 2px var(--primary-glow);
        }

        .password-wrapper {
          position: relative;
          width: 100%;
        }
        .eye-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          opacity: 0.6;
          transition: opacity 0.2s;
          padding: 5px;
        }
        .eye-toggle:hover { opacity: 1; }

        .tags-container {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .tag {
            background: #0f172a;
            border: 1px solid #334155;
            color: #94a3b8;
            padding: 0.4rem 0.8rem;
            border-radius: 20px;
            font-size: 0.75rem;
            cursor: pointer;
            transition: all 0.2s;
        }
        .tag.selected {
            background: #fbbf24;
            color: #0f172a;
            border-color: #fbbf24;
            font-weight: 600;
        }

        .consent-box {
            display: flex;
            gap: 0.8rem;
            align-items: flex-start;
            margin-bottom: 1.5rem;
            color: #94a3b8;
            font-size: 0.8rem;
            grid-column: span 2;
        }
        .consent-box input { width: auto; margin-top: 0.2rem; }

        .btn-primary {
          width: 100%;
          padding: 0.9rem;
          background: #fbbf24;
          color: #0f172a;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 1rem;
        }
        .divider { text-align: center; color: #64748b; margin: 1.5rem 0; font-size: 0.8rem; }
        
        .toggle-mode { text-align: center; color: #94a3b8; font-size: 0.9rem; }
        .toggle-mode button {
            background: none; border: none; color: #fbbf24; cursor: pointer; font-weight: 600; margin-left: 0.5rem;
        }
        .error-msg {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          text-align: center;
        }
        .success-msg {
          background: rgba(34, 197, 94, 0.2);
          color: #86efac;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          text-align: center;
        }
      `}</style>
      {/* Client Bot - Floating */}
      <SafeChatWidget
        mode="sales"
        initialMessage="¡Hola! Veo que estás interesado en Judic-IA. ¿Necesitas ayuda con los planes o el registro?"
      />
    </div>
  );
}
