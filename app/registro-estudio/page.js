"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Building2, User, CreditCard, CheckCircle, ChevronRight, ChevronLeft,
  Eye, EyeOff, Plus, X, ShieldCheck, ShieldAlert, ShieldEllipsis,
  RefreshCw, Sparkles, Sun, Moon,
} from 'lucide-react';
import { validateCuit } from '../lib/validation';
import './registro-estudio.css';

const ENTERPRISE_PLANS = [
  { id: 'enterprise_s',  label: 'Enterprise S',  members: 'Hasta 5 miembros',      price: '$89.000',  period: '/mes', highlight: false },
  { id: 'enterprise_m',  label: 'Enterprise M',  members: 'Hasta 10 miembros',     price: '$149.000', period: '/mes', highlight: true  },
  { id: 'enterprise_l',  label: 'Enterprise L',  members: 'Hasta 20 miembros',     price: '$249.000', period: '/mes', highlight: false },
  { id: 'enterprise_xl', label: 'Enterprise XL', members: 'Miembros ilimitados',   price: '$449.000', period: '/mes', highlight: false },
];

const MEMBER_LIMITS = { enterprise_s: 5, enterprise_m: 10, enterprise_l: 20, enterprise_xl: null };

const COLEGIO_ZONA_MAP = {
  'CPACF (Capital Federal)': 'Capital Federal',
  'CASI (San Isidro)':       'Buenos Aires',
  'CALP (La Plata)':         'Buenos Aires',
  'Colegio de Córdoba':      'Córdoba',
  'Colegio de Santa Fe':     'Santa Fe',
};

const COLEGIOS = ['CPACF (Capital Federal)', 'CASI (San Isidro)', 'CALP (La Plata)', 'Colegio de Córdoba', 'Colegio de Santa Fe', 'Otro'];

const STEPS = [
  { num: 1, label: 'Datos del Estudio' },
  { num: 2, label: 'Titular' },
  { num: 3, label: 'Plan' },
];

export default function RegistroEstudioPage() {
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [theme, setTheme]   = useState('light');
  const headingRef          = useRef(null);

  // ── Tema ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('app-theme') || 'light';
    setTheme(saved);
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // ── Focus management al cambiar paso ──────────────────────────────────────
  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
  }, [step]);

  // ── Paso 1: Datos del estudio ──────────────────────────────────────────────
  const [razonSocial, setRazonSocial] = useState('');
  const [cuitEstudio, setCuitEstudio] = useState('');
  const [domicilio,   setDomicilio]   = useState('');
  const [phone,       setPhone]       = useState('');

  // ── Paso 2: Titular ────────────────────────────────────────────────────────
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwnedStatus, setPwnedStatus] = useState(null); // null | 'checking' | 'safe' | 'breached'
  const [isCheckingPwned, setIsCheckingPwned] = useState(false);
  const [lastCheckedPassword, setLastCheckedPassword] = useState('');
  const [matriculas, setMatriculas] = useState([
    { id: crypto.randomUUID(), colegio: '', tomo: '', folio: '', zona: '', custom: '' }
  ]);

  // ── Paso 3: Plan ──────────────────────────────────────────────────────────
  const [planTier, setPlanTier] = useState('enterprise_m');

  // ── CUIT validation (computed) ────────────────────────────────────────────
  const cuitClean    = cuitEstudio.replace(/[-]/g, '');
  const isCuitComplete = cuitClean.length === 11;
  const isCuitValid    = isCuitComplete ? validateCuit(cuitClean) : null;

  // ── Generador de contraseña segura ────────────────────────────────────────
  const generateSecurePass = () => {
    const caps = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lows = 'abcdefghijkmnopqrstuvwxyz';
    const nums = '23456789';
    const syms = '!@#$%&*+?=';
    const all  = caps + lows + nums + syms;
    const rand = (max) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max; };
    let pass = caps[rand(caps.length)] + lows[rand(lows.length)] + nums[rand(nums.length)] + syms[rand(syms.length)];
    for (let i = 0; i < 12; i++) pass += all[rand(all.length)];
    const arr = pass.split('');
    for (let i = arr.length - 1; i > 0; i--) { const j = rand(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    setPassword(arr.join(''));
    setError(null);
  };

  // ── HaveIBeenPwned (k-Anonymity) ──────────────────────────────────────────
  const checkPwned = async (pwd) => {
    if (pwd.length < 6) { setPwnedStatus(null); return; }
    setIsCheckingPwned(true);
    setPwnedStatus('checking');
    try {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-1', enc.encode(pwd));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`);
      const found = (await res.text()).split('\n').some(l => l.split(':')[0] === hex.slice(5));
      setPwnedStatus(found ? 'breached' : 'safe');
      setLastCheckedPassword(pwd);
    } catch {
      setPwnedStatus(null);
    } finally {
      setIsCheckingPwned(false);
    }
  };

  useEffect(() => {
    if (!password || password.length < 6) { setPwnedStatus(null); return; }
    if (password !== lastCheckedPassword) setPwnedStatus(null);
    const t = setTimeout(() => { if (password !== lastCheckedPassword) checkPwned(password); }, 600);
    return () => clearTimeout(t);
  }, [password, lastCheckedPassword]);

  // ── Helpers matrícula ─────────────────────────────────────────────────────
  const updateMatricula = (index, field, value) => {
    setMatriculas(prev => prev.map((m, i) => {
      if (i !== index) return m;
      const updated = { ...m, [field]: value };
      if (field === 'colegio') {
        updated.zona   = value !== 'Otro' ? (COLEGIO_ZONA_MAP[value] || value) : '';
        updated.custom = '';
      }
      return updated;
    }));
  };

  const addMatricula = () => {
    if (matriculas.length >= 5) return;
    setMatriculas(prev => [...prev, { id: crypto.randomUUID(), colegio: '', tomo: '', folio: '', zona: '', custom: '' }]);
  };

  const removeMatricula = (index) => {
    if (matriculas.length <= 1) return;
    setMatriculas(prev => prev.filter((_, i) => i !== index));
  };

  // ── Validaciones ──────────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!razonSocial.trim()) return 'Ingresá la Razón Social del estudio.';
    if (!cuitEstudio.trim()) return 'Ingresá el CUIT del estudio.';
    if (isCuitComplete && !isCuitValid) return 'El CUIT ingresado no es válido.';
    if (!domicilio.trim()) return 'Ingresá el domicilio legal.';
    if (!phone.trim()) return 'Ingresá un teléfono de contacto.';
    return null;
  };

  const validateStep2 = () => {
    if (!firstName.trim()) return 'Ingresá el nombre del titular.';
    if (!lastName.trim()) return 'Ingresá el apellido del titular.';
    if (!email.trim() || !email.includes('@')) return 'Ingresá un email válido.';
    if (password.length < 8)           return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(password))       return 'La contraseña debe tener al menos una mayúscula.';
    if (!/[0-9]/.test(password))       return 'La contraseña debe tener al menos un número.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'La contraseña debe tener al menos un símbolo.';
    for (let i = 0; i < matriculas.length; i++) {
      const m = matriculas[i];
      if (!m.colegio) return `Seleccioná el colegio para la matrícula ${i + 1}.`;
      if (m.colegio === 'Otro' && !m.custom.trim()) return `Especificá el nombre del colegio para la matrícula ${i + 1}.`;
      if (!m.tomo)   return `Ingresá el Tomo para la matrícula ${i + 1}.`;
      if (!m.folio)  return `Ingresá el Folio para la matrícula ${i + 1}.`;
    }
    return null;
  };

  const handleNext = async () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) { setError(err); return; }
      // Hard block: contraseña filtrada en HIBP
      try {
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-1', enc.encode(password));
        const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`);
        if (res.ok && (await res.text()).split('\n').some(l => l.split(':')[0] === hex.slice(5))) {
          setError('Esta contraseña fue filtrada en internet. Por tu seguridad, elegí otra más segura.');
          setPwnedStatus('breached');
          return;
        }
      } catch { /* HIBP falló, continuamos igual */ }
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    const matriculasData = matriculas.map((m, i) => ({
      id: m.id,
      colegio: m.colegio === 'Otro' ? m.custom : m.colegio,
      tomo: m.tomo,
      folio: m.folio,
      zona: m.zona || (m.colegio === 'Otro' ? m.custom : (COLEGIO_ZONA_MAP[m.colegio] || m.colegio)),
      status: 'pending',
      principal: i === 0,
      verified_at: null,
      rejection_reason: null,
    }));

    try {
      const res = await fetch('/api/estudio/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razon_social: razonSocial.trim(),
          cuit: cuitEstudio.replace(/[-]/g, ''),
          domicilio: domicilio.trim(),
          phone: phone.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          matriculas: matriculasData,
          plan_tier: planTier,
          member_limit: MEMBER_LIMITS[planTier],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data._debug ? `${data.error} (${data._debug})` : (data.error || 'Error al enviar la solicitud. Intentá nuevamente.');
        setError(msg);
        setLoading(false);
        return;
      }

      setStep(4);
    } catch {
      setError('Error de conexión. Verificá tu conexión a internet.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="re-main" id="main-content">
      {/* Skip navigation */}
      <a href="#re-form-content" className="re-skip-link">Ir al formulario</a>

      {/* Theme toggle */}
      <button
        className="re-theme-toggle"
        onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <div className="re-back">
        <Link href="/">← Volver al inicio</Link>
      </div>

      <div className="re-container">
        {/* Header */}
        <div className="re-header">
          <div className="re-logo" aria-hidden="true">
            <Building2 size={28} />
          </div>
          <h1 className="re-title">Registrar Estudio Jurídico</h1>
          <p className="re-subtitle">Verificaremos los datos de tu estudio antes de activar el acceso.</p>
        </div>

        {/* Steps indicator */}
        {step < 4 && (
          <nav aria-label="Progreso del registro">
            <ol className="re-steps" role="list">
              {STEPS.map((s, i) => (
                <li key={s.num} className="re-step-wrap" role="listitem">
                  <div
                    className={`re-step ${step === s.num ? 're-step--active' : step > s.num ? 're-step--done' : ''}`}
                    aria-current={step === s.num ? 'step' : undefined}
                    aria-label={`Paso ${s.num}: ${s.label}${step > s.num ? ' (completado)' : step === s.num ? ' (actual)' : ' (pendiente)'}`}
                  >
                    <span className="re-step-num" aria-hidden="true">{step > s.num ? '✓' : s.num}</span>
                    <span className="re-step-label">{s.label}</span>
                  </div>
                  {i < 2 && <div className={`re-step-line ${step > s.num ? 're-step-line--done' : ''}`} aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Error global */}
        {error && (
          <div id="re-error-msg" className="re-error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <div id="re-form-content">

        {/* ── PASO 1: Datos del estudio ── */}
        {step === 1 && (
          <section className="re-form" aria-labelledby="re-heading-1">
            <h2 id="re-heading-1" className="re-form-title" ref={headingRef} tabIndex={-1}>
              Datos del Estudio
            </h2>

            <div className="re-field">
              <label htmlFor="razon-social">
                Razón Social <span className="re-required" aria-hidden="true">*</span>
              </label>
              <input
                id="razon-social"
                type="text"
                value={razonSocial}
                onChange={e => setRazonSocial(e.target.value)}
                placeholder="Estudio García & Asociados"
                className="re-input"
                autoComplete="organization"
                aria-required="true"
                aria-describedby={error ? 're-error-msg' : undefined}
                autoFocus
              />
            </div>

            <div className="re-field">
              <label htmlFor="cuit-estudio">
                CUIT del Estudio <span className="re-required" aria-hidden="true">*</span>
              </label>
              <input
                id="cuit-estudio"
                type="text"
                inputMode="numeric"
                value={cuitEstudio}
                onChange={e => setCuitEstudio(e.target.value)}
                placeholder="30-12345678-9"
                className="re-input"
                maxLength={13}
                autoComplete="off"
                aria-required="true"
                aria-describedby={isCuitComplete ? 'cuit-status' : undefined}
                aria-invalid={isCuitComplete && !isCuitValid ? 'true' : undefined}
              />
              {isCuitComplete && (
                <div id="cuit-status" className="re-cuit-status" aria-live="polite">
                  {isCuitValid
                    ? <><ShieldCheck size={14} style={{ color: '#22c55e' }} aria-hidden="true" /><span style={{ color: '#22c55e' }}>CUIT válido</span></>
                    : <><ShieldAlert size={14} style={{ color: '#f87171' }} aria-hidden="true" /><span style={{ color: '#f87171' }}>CUIT inválido — verificá los dígitos</span></>
                  }
                </div>
              )}
            </div>

            <div className="re-field">
              <label htmlFor="domicilio">
                Domicilio Legal <span className="re-required" aria-hidden="true">*</span>
              </label>
              <input
                id="domicilio"
                type="text"
                value={domicilio}
                onChange={e => setDomicilio(e.target.value)}
                placeholder="Av. Corrientes 1234, CABA"
                className="re-input"
                autoComplete="street-address"
                aria-required="true"
              />
            </div>

            <div className="re-field">
              <label htmlFor="phone">
                Teléfono de Contacto <span className="re-required" aria-hidden="true">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+54 11 1234-5678"
                className="re-input"
                autoComplete="tel"
                aria-required="true"
              />
            </div>

            <button className="re-btn-next" onClick={handleNext} aria-label="Continuar al paso 2: Titular">
              Continuar <ChevronRight size={18} aria-hidden="true" />
            </button>
          </section>
        )}

        {/* ── PASO 2: Datos del titular ── */}
        {step === 2 && (
          <section className="re-form" aria-labelledby="re-heading-2">
            <h2 id="re-heading-2" className="re-form-title" ref={headingRef} tabIndex={-1}>
              Datos del Titular
            </h2>
            <p className="re-form-hint">El titular debe ser un abogado matriculado.</p>

            <div className="re-row">
              <div className="re-field">
                <label htmlFor="first-name">
                  Nombre <span className="re-required" aria-hidden="true">*</span>
                </label>
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Juan"
                  className="re-input"
                  autoComplete="given-name"
                  aria-required="true"
                />
              </div>
              <div className="re-field">
                <label htmlFor="last-name">
                  Apellido <span className="re-required" aria-hidden="true">*</span>
                </label>
                <input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="García"
                  className="re-input"
                  autoComplete="family-name"
                  aria-required="true"
                />
              </div>
            </div>

            <div className="re-field">
              <label htmlFor="email-titular">
                Email Profesional <span className="re-required" aria-hidden="true">*</span>
              </label>
              <input
                id="email-titular"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="dr.garcia@estudio.com"
                className="re-input"
                autoComplete="email"
                aria-required="true"
              />
            </div>

            <div className="re-field">
              <div className="re-label-row">
                <label htmlFor="password-titular">
                  Contraseña <span className="re-required" aria-hidden="true">*</span>
                </label>
                <button
                  type="button"
                  className="re-suggest-btn"
                  onClick={generateSecurePass}
                  aria-label="Generar contraseña segura automáticamente"
                >
                  <Sparkles size={11} aria-hidden="true" /> Sugerir
                </button>
              </div>
              <div className="re-input-wrap">
                <input
                  id="password-titular"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="re-input re-input--pw"
                  autoComplete="new-password"
                  aria-required="true"
                  aria-describedby="pw-rules"
                />
                <button
                  type="button"
                  className="re-pw-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              <div id="pw-rules" className="re-pw-rules" aria-label="Requisitos de contraseña" aria-live="polite">
                <span className={password.length >= 8 ? 're-rule--ok' : ''} aria-label={`8 o más caracteres: ${password.length >= 8 ? 'cumplido' : 'pendiente'}`}>
                  8+ caracteres
                </span>
                <span className={/[A-Z]/.test(password) ? 're-rule--ok' : ''} aria-label={`Mayúscula: ${/[A-Z]/.test(password) ? 'cumplido' : 'pendiente'}`}>
                  Mayúscula
                </span>
                <span className={/[0-9]/.test(password) ? 're-rule--ok' : ''} aria-label={`Número: ${/[0-9]/.test(password) ? 'cumplido' : 'pendiente'}`}>
                  Número
                </span>
                <span className={/[^A-Za-z0-9]/.test(password) ? 're-rule--ok' : ''} aria-label={`Símbolo: ${/[^A-Za-z0-9]/.test(password) ? 'cumplido' : 'pendiente'}`}>
                  Símbolo
                </span>
                {password.length >= 6 && (
                  <span
                    className={pwnedStatus === 'safe' ? 're-rule--ok' : pwnedStatus === 'breached' ? 're-rule--breach' : ''}
                    aria-label={pwnedStatus === 'breached' ? 'Contraseña filtrada en internet' : pwnedStatus === 'safe' ? 'Sin filtraciones conocidas' : 'Verificando filtraciones'}
                  >
                    {isCheckingPwned
                      ? <RefreshCw size={10} className="re-spin" aria-hidden="true" />
                      : pwnedStatus === 'breached'
                        ? <ShieldAlert size={10} aria-hidden="true" />
                        : <ShieldEllipsis size={10} aria-hidden="true" />}
                    {pwnedStatus === 'breached' ? 'Contraseña filtrada' : 'Sin filtraciones'}
                  </span>
                )}
              </div>
            </div>

            {/* Matrículas */}
            <div className="re-matriculas" role="group" aria-label="Matrículas del titular">
              {matriculas.map((m, i) => (
                <fieldset key={m.id} className="re-matricula-block">
                  <legend>Matrícula {i + 1}{i === 0 ? ' (principal)' : ''}</legend>
                  {i > 0 && (
                    <button
                      type="button"
                      className="re-matricula-remove"
                      onClick={() => removeMatricula(i)}
                      aria-label={`Eliminar matrícula ${i + 1}`}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                  <div className="re-field">
                    <label htmlFor={`colegio-${i}`}>
                      Colegio <span className="re-required" aria-hidden="true">*</span>
                    </label>
                    <select
                      id={`colegio-${i}`}
                      value={m.colegio}
                      onChange={e => updateMatricula(i, 'colegio', e.target.value)}
                      className="re-input"
                      aria-required="true"
                    >
                      <option value="">Seleccionar colegio</option>
                      {COLEGIOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {m.colegio === 'Otro' && (
                    <div className="re-field">
                      <label htmlFor={`colegio-custom-${i}`}>
                        Nombre del Colegio <span className="re-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id={`colegio-custom-${i}`}
                        type="text"
                        value={m.custom}
                        onChange={e => updateMatricula(i, 'custom', e.target.value)}
                        placeholder="Colegio de Abogados de..."
                        className="re-input"
                        aria-required="true"
                      />
                    </div>
                  )}
                  <div className="re-row">
                    <div className="re-field">
                      <label htmlFor={`tomo-${i}`}>
                        Tomo <span className="re-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id={`tomo-${i}`}
                        type="number"
                        value={m.tomo}
                        onChange={e => updateMatricula(i, 'tomo', e.target.value)}
                        placeholder="80"
                        className="re-input"
                        min="1"
                        aria-required="true"
                        onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                      />
                    </div>
                    <div className="re-field">
                      <label htmlFor={`folio-${i}`}>
                        Folio <span className="re-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id={`folio-${i}`}
                        type="number"
                        value={m.folio}
                        onChange={e => updateMatricula(i, 'folio', e.target.value)}
                        placeholder="500"
                        className="re-input"
                        min="1"
                        aria-required="true"
                        onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                      />
                    </div>
                  </div>
                </fieldset>
              ))}
              {matriculas.length < 5 && (
                <button
                  type="button"
                  className="re-btn-add-matricula"
                  onClick={addMatricula}
                  aria-label="Agregar otra matrícula al titular"
                >
                  <Plus size={14} aria-hidden="true" /> Agregar otra matrícula
                </button>
              )}
            </div>

            <div className="re-form-nav">
              <button
                className="re-btn-back"
                onClick={() => { setError(null); setStep(1); }}
                aria-label="Volver al paso 1: Datos del Estudio"
              >
                <ChevronLeft size={18} aria-hidden="true" /> Atrás
              </button>
              <button
                className="re-btn-next"
                onClick={handleNext}
                disabled={pwnedStatus === 'breached'}
                aria-label="Continuar al paso 3: Plan"
                aria-disabled={pwnedStatus === 'breached' ? 'true' : undefined}
              >
                Continuar <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {/* ── PASO 3: Elegir plan ── */}
        {step === 3 && (
          <section className="re-form" aria-labelledby="re-heading-3">
            <h2 id="re-heading-3" className="re-form-title" ref={headingRef} tabIndex={-1}>
              Elegir Plan
            </h2>
            <p className="re-form-hint">Podés cambiar de plan en cualquier momento.</p>

            <div
              className="re-plans"
              role="radiogroup"
              aria-label="Planes Enterprise disponibles"
            >
              {ENTERPRISE_PLANS.map(plan => (
                <button
                  key={plan.id}
                  type="button"
                  role="radio"
                  aria-checked={planTier === plan.id}
                  aria-label={`${plan.label}: ${plan.members}, ${plan.price} por mes${plan.highlight ? ', el más elegido' : ''}`}
                  className={`re-plan-card ${planTier === plan.id ? 're-plan-card--selected' : ''} ${plan.highlight ? 're-plan-card--featured' : ''}`}
                  onClick={() => setPlanTier(plan.id)}
                >
                  {plan.highlight && <span className="re-plan-badge" aria-hidden="true">MÁS ELEGIDO</span>}
                  <div className="re-plan-name" aria-hidden="true">{plan.label}</div>
                  <div className="re-plan-members" aria-hidden="true">{plan.members}</div>
                  <div className="re-plan-price" aria-hidden="true">
                    <span className="re-plan-amount">{plan.price}</span>
                    <span className="re-plan-period">{plan.period}</span>
                  </div>
                </button>
              ))}
            </div>

            <p className="re-plan-note">
              Tu estudio quedará en revisión. Una vez verificado, te enviaremos un email para activar el plan.
            </p>

            <div className="re-form-nav">
              <button
                className="re-btn-back"
                onClick={() => { setError(null); setStep(2); }}
                aria-label="Volver al paso 2: Titular"
              >
                <ChevronLeft size={18} aria-hidden="true" /> Atrás
              </button>
              <button
                className="re-btn-submit"
                onClick={handleSubmit}
                disabled={loading}
                aria-busy={loading}
                aria-label={loading ? 'Enviando solicitud, por favor esperá' : 'Enviar solicitud de registro'}
              >
                {loading ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </section>
        )}

        {/* ── PASO 4: Confirmación ── */}
        {step === 4 && (
          <section
            className="re-confirm"
            aria-labelledby="re-heading-4"
            role="status"
            aria-live="polite"
          >
            <div className="re-confirm-icon" aria-hidden="true">
              <CheckCircle size={48} />
            </div>
            <h2 id="re-heading-4" className="re-confirm-title" ref={headingRef} tabIndex={-1}>
              ¡Solicitud enviada!
            </h2>
            <p className="re-confirm-text">
              Recibimos los datos de <strong>{razonSocial}</strong>.<br />
              Verificaremos el CUIT y la matrícula del titular y te notificaremos
              a <strong>{email}</strong> cuando el estudio esté activo.
            </p>
            <p className="re-confirm-sub">El proceso de verificación suele tardar 1-2 días hábiles.</p>
            <Link href="/" className="re-btn-home">Volver al inicio</Link>
          </section>
        )}

        </div>{/* #re-form-content */}
      </div>
    </main>
  );
}
