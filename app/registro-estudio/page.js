"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Building2, User, CreditCard, CheckCircle, ChevronRight, ChevronLeft, Eye, EyeOff, Plus, X } from 'lucide-react';
import { validateCuit, formatCuit } from '../lib/validation';
import './registro-estudio.css';

const ENTERPRISE_PLANS = [
  { id: 'enterprise_s', label: 'Enterprise S', members: 'Hasta 5 miembros', price: '$89.000', period: '/mes', highlight: false },
  { id: 'enterprise_m', label: 'Enterprise M', members: 'Hasta 10 miembros', price: '$149.000', period: '/mes', highlight: true },
  { id: 'enterprise_l', label: 'Enterprise L', members: 'Hasta 20 miembros', price: '$249.000', period: '/mes', highlight: false },
  { id: 'enterprise_xl', label: 'Enterprise XL', members: 'Miembros ilimitados', price: '$449.000', period: '/mes', highlight: false },
];

const MEMBER_LIMITS = { enterprise_s: 5, enterprise_m: 10, enterprise_l: 20, enterprise_xl: null };

const COLEGIO_ZONA_MAP = {
  'CPACF (Capital Federal)': 'Capital Federal',
  'CASI (San Isidro)': 'Buenos Aires',
  'CALP (La Plata)': 'Buenos Aires',
  'Colegio de Córdoba': 'Córdoba',
  'Colegio de Santa Fe': 'Santa Fe',
};

const COLEGIOS = ['CPACF (Capital Federal)', 'CASI (San Isidro)', 'CALP (La Plata)', 'Colegio de Córdoba', 'Colegio de Santa Fe', 'Otro'];

const STEPS = [
  { num: 1, icon: Building2, label: 'Datos del Estudio' },
  { num: 2, icon: User,      label: 'Titular' },
  { num: 3, icon: CreditCard, label: 'Plan' },
  { num: 4, icon: CheckCircle, label: 'Confirmación' },
];

export default function RegistroEstudioPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Paso 1: Datos del estudio
  const [razonSocial, setRazonSocial] = useState('');
  const [cuitEstudio, setCuitEstudio] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [phone, setPhone] = useState('');

  // Paso 2: Titular
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [matriculas, setMatriculas] = useState([
    { id: crypto.randomUUID(), colegio: '', tomo: '', folio: '', zona: '', custom: '' }
  ]);

  // Paso 3: Plan
  const [planTier, setPlanTier] = useState('enterprise_m');

  // Helpers matrícula
  const updateMatricula = (index, field, value) => {
    setMatriculas(prev => prev.map((m, i) => {
      if (i !== index) return m;
      const updated = { ...m, [field]: value };
      if (field === 'colegio') {
        updated.zona = value !== 'Otro' ? (COLEGIO_ZONA_MAP[value] || value) : '';
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

  // Validaciones por paso
  const validateStep1 = () => {
    if (!razonSocial.trim()) return 'Ingresá la Razón Social del estudio.';
    if (!cuitEstudio.trim()) return 'Ingresá el CUIT del estudio.';
    const cuitClean = cuitEstudio.replace(/[-]/g, '');
    if (cuitClean.length === 11 && !validateCuit(cuitClean)) return 'El CUIT ingresado no es válido.';
    if (!domicilio.trim()) return 'Ingresá el domicilio legal.';
    if (!phone.trim()) return 'Ingresá un teléfono de contacto.';
    return null;
  };

  const validateStep2 = () => {
    if (!firstName.trim()) return 'Ingresá el nombre del titular.';
    if (!lastName.trim()) return 'Ingresá el apellido del titular.';
    if (!email.trim() || !email.includes('@')) return 'Ingresá un email válido.';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(password)) return 'La contraseña debe tener al menos una mayúscula.';
    if (!/[0-9]/.test(password)) return 'La contraseña debe tener al menos un número.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'La contraseña debe tener al menos un símbolo.';
    for (let i = 0; i < matriculas.length; i++) {
      const m = matriculas[i];
      if (!m.colegio) return `Seleccioná el colegio para la matrícula ${i + 1}.`;
      if (m.colegio === 'Otro' && !m.custom.trim()) return `Especificá el nombre del colegio para la matrícula ${i + 1}.`;
      if (!m.tomo) return `Ingresá el Tomo para la matrícula ${i + 1}.`;
      if (!m.folio) return `Ingresá el Folio para la matrícula ${i + 1}.`;
    }
    return null;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) { setError(err); return; }
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
        setError(data.error || 'Error al enviar la solicitud. Intentá nuevamente.');
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

  const selectedPlan = ENTERPRISE_PLANS.find(p => p.id === planTier);

  return (
    <main className="re-main">
      <div className="re-back">
        <Link href="/">← Volver al inicio</Link>
      </div>

      <div className="re-container">
        {/* Header */}
        <div className="re-header">
          <div className="re-logo">
            <Building2 size={28} />
          </div>
          <h1 className="re-title">Registrar Estudio Jurídico</h1>
          <p className="re-subtitle">Verificaremos los datos de tu estudio antes de activar el acceso.</p>
        </div>

        {/* Steps indicator */}
        {step < 4 && (
          <div className="re-steps" aria-label="Pasos del registro">
            {STEPS.slice(0, 3).map((s, i) => (
              <div key={s.num} className="re-step-wrap">
                <div className={`re-step ${step === s.num ? 're-step--active' : step > s.num ? 're-step--done' : ''}`}>
                  <span className="re-step-num">{step > s.num ? '✓' : s.num}</span>
                  <span className="re-step-label">{s.label}</span>
                </div>
                {i < 2 && <div className={`re-step-line ${step > s.num ? 're-step-line--done' : ''}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="re-error" role="alert">{error}</div>
        )}

        {/* PASO 1: Datos del estudio */}
        {step === 1 && (
          <section className="re-form" aria-label="Datos del Estudio">
            <h2 className="re-form-title">Datos del Estudio</h2>

            <div className="re-field">
              <label htmlFor="razon-social">Razón Social <span className="re-required">*</span></label>
              <input
                id="razon-social"
                type="text"
                value={razonSocial}
                onChange={e => setRazonSocial(e.target.value)}
                placeholder="Estudio García & Asociados"
                className="re-input"
                autoFocus
              />
            </div>

            <div className="re-field">
              <label htmlFor="cuit-estudio">CUIT del Estudio <span className="re-required">*</span></label>
              <input
                id="cuit-estudio"
                type="text"
                value={cuitEstudio}
                onChange={e => setCuitEstudio(e.target.value)}
                placeholder="30-12345678-9"
                className="re-input"
                maxLength={13}
              />
            </div>

            <div className="re-field">
              <label htmlFor="domicilio">Domicilio Legal <span className="re-required">*</span></label>
              <input
                id="domicilio"
                type="text"
                value={domicilio}
                onChange={e => setDomicilio(e.target.value)}
                placeholder="Av. Corrientes 1234, CABA"
                className="re-input"
              />
            </div>

            <div className="re-field">
              <label htmlFor="phone">Teléfono de Contacto <span className="re-required">*</span></label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+54 11 1234-5678"
                className="re-input"
              />
            </div>

            <button className="re-btn-next" onClick={handleNext}>
              Continuar <ChevronRight size={18} />
            </button>
          </section>
        )}

        {/* PASO 2: Datos del titular */}
        {step === 2 && (
          <section className="re-form" aria-label="Datos del Titular">
            <h2 className="re-form-title">Datos del Titular</h2>
            <p className="re-form-hint">El titular debe ser un abogado matriculado.</p>

            <div className="re-row">
              <div className="re-field">
                <label htmlFor="first-name">Nombre <span className="re-required">*</span></label>
                <input id="first-name" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Juan" className="re-input" />
              </div>
              <div className="re-field">
                <label htmlFor="last-name">Apellido <span className="re-required">*</span></label>
                <input id="last-name" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="García" className="re-input" />
              </div>
            </div>

            <div className="re-field">
              <label htmlFor="email-titular">Email Profesional <span className="re-required">*</span></label>
              <input id="email-titular" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="dr.garcia@estudio.com" className="re-input" />
            </div>

            <div className="re-field">
              <label htmlFor="password-titular">Contraseña <span className="re-required">*</span></label>
              <div className="re-input-wrap">
                <input
                  id="password-titular"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="re-input re-input--pw"
                />
                <button type="button" className="re-pw-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="re-pw-rules" aria-label="Requisitos de contraseña">
                <span className={password.length >= 8 ? 're-rule--ok' : ''}>8+ caracteres</span>
                <span className={/[A-Z]/.test(password) ? 're-rule--ok' : ''}>Mayúscula</span>
                <span className={/[0-9]/.test(password) ? 're-rule--ok' : ''}>Número</span>
                <span className={/[^A-Za-z0-9]/.test(password) ? 're-rule--ok' : ''}>Símbolo</span>
              </div>
            </div>

            {/* Matrículas */}
            <div className="re-matriculas">
              {matriculas.map((m, i) => (
                <fieldset key={m.id} className="re-matricula-block">
                  <legend>Matrícula {i + 1}</legend>
                  {i > 0 && (
                    <button type="button" className="re-matricula-remove" onClick={() => removeMatricula(i)} aria-label={`Eliminar matrícula ${i + 1}`}>
                      <X size={14} />
                    </button>
                  )}
                  <div className="re-field">
                    <label htmlFor={`colegio-${i}`}>Colegio</label>
                    <select id={`colegio-${i}`} value={m.colegio} onChange={e => updateMatricula(i, 'colegio', e.target.value)} className="re-input">
                      <option value="">Seleccionar colegio</option>
                      {COLEGIOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {m.colegio === 'Otro' && (
                    <div className="re-field">
                      <label htmlFor={`colegio-custom-${i}`}>Nombre del Colegio</label>
                      <input id={`colegio-custom-${i}`} type="text" value={m.custom} onChange={e => updateMatricula(i, 'custom', e.target.value)} placeholder="Colegio de Abogados de..." className="re-input" />
                    </div>
                  )}
                  <div className="re-row">
                    <div className="re-field">
                      <label htmlFor={`tomo-${i}`}>Tomo</label>
                      <input id={`tomo-${i}`} type="number" value={m.tomo} onChange={e => updateMatricula(i, 'tomo', e.target.value)} placeholder="80" className="re-input" min="1" />
                    </div>
                    <div className="re-field">
                      <label htmlFor={`folio-${i}`}>Folio</label>
                      <input id={`folio-${i}`} type="number" value={m.folio} onChange={e => updateMatricula(i, 'folio', e.target.value)} placeholder="500" className="re-input" min="1" />
                    </div>
                  </div>
                </fieldset>
              ))}
              {matriculas.length < 5 && (
                <button type="button" className="re-btn-add-matricula" onClick={addMatricula}>
                  <Plus size={14} /> Agregar otra matrícula
                </button>
              )}
            </div>

            <div className="re-form-nav">
              <button className="re-btn-back" onClick={() => { setError(null); setStep(1); }}>
                <ChevronLeft size={18} /> Atrás
              </button>
              <button className="re-btn-next" onClick={handleNext}>
                Continuar <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {/* PASO 3: Elegir plan */}
        {step === 3 && (
          <section className="re-form" aria-label="Elegir Plan Enterprise">
            <h2 className="re-form-title">Elegir Plan</h2>
            <p className="re-form-hint">Podés cambiar de plan en cualquier momento.</p>

            <div className="re-plans">
              {ENTERPRISE_PLANS.map(plan => (
                <button
                  key={plan.id}
                  type="button"
                  className={`re-plan-card ${planTier === plan.id ? 're-plan-card--selected' : ''} ${plan.highlight ? 're-plan-card--featured' : ''}`}
                  onClick={() => setPlanTier(plan.id)}
                  aria-pressed={planTier === plan.id}
                >
                  {plan.highlight && <span className="re-plan-badge">MÁS ELEGIDO</span>}
                  <div className="re-plan-name">{plan.label}</div>
                  <div className="re-plan-members">{plan.members}</div>
                  <div className="re-plan-price">
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
              <button className="re-btn-back" onClick={() => { setError(null); setStep(2); }}>
                <ChevronLeft size={18} /> Atrás
              </button>
              <button className="re-btn-submit" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </section>
        )}

        {/* PASO 4: Confirmación */}
        {step === 4 && (
          <section className="re-confirm" aria-label="Solicitud enviada">
            <div className="re-confirm-icon">
              <CheckCircle size={48} />
            </div>
            <h2 className="re-confirm-title">¡Solicitud enviada!</h2>
            <p className="re-confirm-text">
              Recibimos los datos de <strong>{razonSocial}</strong>.<br />
              Verificaremos el CUIT y la matrícula del titular y te notificaremos
              a <strong>{email}</strong> cuando el estudio esté activo.
            </p>
            <p className="re-confirm-sub">El proceso de verificación suele tardar 1-2 días hábiles.</p>
            <Link href="/" className="re-btn-home">Volver al inicio</Link>
          </section>
        )}
      </div>
    </main>
  );
}
