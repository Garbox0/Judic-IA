"use client";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, CheckCircle, AlertCircle, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import '../registro-estudio.css';

const ROLE_LABELS = { abogado: 'Abogado/a', supervisor: 'Supervisor/a', owner: 'Titular' };

export default function UnirsePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // loading | valid | error | success
  const [errorType, setErrorType] = useState(''); // expired | already_used | invalid
  const [inviteData, setInviteData] = useState(null);

  const [form, setForm] = useState({
    first_name: '', last_name: '', password: '',
    matricula_colegio: '', matricula_tomo: '', matricula_folio: '',
  });
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorType('invalid'); return; }

    fetch(`/api/estudio/invitacion?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setErrorType(data.error);
          setStatus('error');
        } else {
          setInviteData(data);
          setStatus('valid');
        }
      })
      .catch(() => { setErrorType('invalid'); setStatus('error'); });
  }, [token]);

  const pwRules = {
    length: form.password.length >= 8,
    upper:  /[A-Z]/.test(form.password),
    number: /[0-9]/.test(form.password),
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!pwRules.length) { setError('La contraseña debe tener al menos 8 caracteres'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/estudio/aceptar-invitacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar la invitación');
      setStatus('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') return (
    <div className="re-main">
      <div className="re-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, gap: 16 }}>
        <Loader2 size={36} style={{ color: '#c9a227', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#888', fontSize: 14 }}>Validando invitación…</p>
      </div>
    </div>
  );

  if (status === 'success') return (
    <div className="re-main">
      <div className="re-container">
        <div className="re-confirm">
          <CheckCircle size={52} className="re-confirm-icon" />
          <h2 className="re-confirm-title">¡Bienvenido/a al estudio!</h2>
          <p className="re-confirm-text">
            Tu cuenta está lista. Ya podés acceder al panel de <strong>{inviteData?.org?.name}</strong>.
          </p>
          <p className="re-confirm-sub">Usá tu email <strong>{inviteData?.email}</strong> para iniciar sesión.</p>
          <Link href="/login" className="re-btn-home">Iniciar sesión →</Link>
        </div>
      </div>
    </div>
  );

  if (status === 'error') return (
    <div className="re-main">
      <div className="re-container">
        <div className="re-confirm" style={{ textAlign: 'center' }}>
          <AlertCircle size={52} style={{ color: '#f43f5e', marginBottom: 16 }} />
          <h2 className="re-confirm-title" style={{ color: '#1a1a2e' }}>
            {errorType === 'expired' && 'Invitación expirada'}
            {errorType === 'already_used' && 'Invitación ya utilizada'}
            {(!errorType || errorType === 'invalid') && 'Invitación inválida'}
          </h2>
          <p className="re-confirm-text">
            {errorType === 'expired' && 'El link de invitación ya no es válido. Pedí al titular del estudio que te reenvíe la invitación.'}
            {errorType === 'already_used' && 'Esta invitación ya fue aceptada anteriormente.'}
            {(!errorType || errorType === 'invalid') && 'El link de invitación no es válido o fue cancelado.'}
          </p>
          <Link href="/" className="re-btn-home" style={{ marginTop: 8 }}>Ir al inicio</Link>
        </div>
      </div>
    </div>
  );

  // status === 'valid'
  return (
    <div className="re-main">
      <div className="re-container">
        <div className="re-header">
          <div className="re-logo">
            <Building2 size={28} />
          </div>
          <h1 className="re-title">Unirse al estudio jurídico</h1>
          <p className="re-subtitle">
            Fuiste invitado/a a <strong>{inviteData?.org?.name}</strong> como <strong>{ROLE_LABELS[inviteData?.role] || inviteData?.role}</strong>
          </p>
        </div>

        <div className="re-form">
          <h2 className="re-form-title">Completá tus datos</h2>
          <p className="re-form-hint">Ingresarás con el email <strong>{inviteData?.email}</strong></p>

          {error && <div className="re-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="re-row">
              <div className="re-field">
                <label>Nombre <span className="re-required">*</span></label>
                <input
                  className="re-input"
                  placeholder="Juan"
                  value={form.first_name}
                  onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  required
                />
              </div>
              <div className="re-field">
                <label>Apellido <span className="re-required">*</span></label>
                <input
                  className="re-input"
                  placeholder="García"
                  value={form.last_name}
                  onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="re-field">
              <label>Contraseña <span className="re-required">*</span></label>
              <div className="re-input-wrap">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="re-input re-input--pw"
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button type="button" className="re-pw-toggle" onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="re-pw-rules">
                <span className={pwRules.length ? 're-rule--ok' : ''}>8+ caracteres</span>
                <span className={pwRules.upper  ? 're-rule--ok' : ''}>Mayúscula</span>
                <span className={pwRules.number ? 're-rule--ok' : ''}>Número</span>
              </div>
            </div>

            <div className="re-field" style={{ marginTop: 8 }}>
              <label style={{ fontWeight: 700, marginBottom: 8, display: 'block' }}>Matrícula (opcional)</label>
              <div className="re-matricula-block">
                <div className="re-row">
                  <div className="re-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Colegio / Jurisdicción</label>
                    <input
                      className="re-input"
                      placeholder="ej. CPACF, CAM, CAPC..."
                      value={form.matricula_colegio}
                      onChange={e => setForm(f => ({ ...f, matricula_colegio: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="re-row">
                  <div className="re-field">
                    <label>Tomo</label>
                    <input
                      className="re-input"
                      placeholder="ej. 42"
                      value={form.matricula_tomo}
                      onChange={e => setForm(f => ({ ...f, matricula_tomo: e.target.value }))}
                    />
                  </div>
                  <div className="re-field">
                    <label>Folio</label>
                    <input
                      className="re-input"
                      placeholder="ej. 123"
                      value={form.matricula_folio}
                      onChange={e => setForm(f => ({ ...f, matricula_folio: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="re-form-nav">
              <button type="submit" className="re-btn-submit" disabled={loading}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Procesando…
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    Unirme al estudio <ArrowRight size={16} />
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
          ¿Ya tenés cuenta? <Link href="/login" style={{ color: '#c9a227', textDecoration: 'none' }}>Iniciá sesión</Link>
        </p>
      </div>
    </div>
  );
}
