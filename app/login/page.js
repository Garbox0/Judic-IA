"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon } from 'lucide-react';
import './login.css';

export default function LoginPage() {
  const router = useRouter();

  // Credentials step
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(null);
  const [theme, setTheme] = useState('light');

  // 2FA step
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const otpRefs = useRef([]);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    setTheme(savedTheme);
  }, []);

  // Sync body class with theme
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  // Auto-redirect if already logged in (INITIAL_SESSION only)
  useEffect(() => {
    const goToOtp = async (session) => {
      await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ purpose: 'login' })
      }).catch(() => {});
      setStep('otp');
      setResendCooldown(60);
    };

    const getPostLoginDest = async (userId) => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', userId)
          .maybeSingle();

        if (prof?.org_id) {
          const { data: member } = await supabase
            .from('org_members')
            .select('org:org_id(type, verification_status)')
            .eq('user_id', userId)
            .eq('org_id', prof.org_id)
            .maybeSingle();

          if (
            member?.org?.type === 'estudio' &&
            member?.org?.verification_status === 'verified'
          ) {
            return '/dashboard/estudio';
          }
        }
      } catch {}
      return '/dashboard';
    };

    const validateProfileAndRedirect = async (userId) => {
      if (!userId) return;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, two_factor_email')
          .eq('id', userId)
          .maybeSingle();

        if (profile) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (profile.two_factor_email && !currentSession?.user?.app_metadata?.two_fa_verified_at) {
            if (currentSession) await goToOtp(currentSession);
          } else {
            const dest = await getPostLoginDest(userId);
            router.push(dest);
          }
        }
      } catch (err) {
        console.error("❌ Profile validation failed:", err);
      }
    };

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await validateProfileAndRedirect(user.id);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' && session?.user) {
        await validateProfileAndRedirect(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Handle URL fragments/params for Auth UX
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('otp_expired')) {
      setError("El enlace de confirmación ya fue utilizado o expiró. Si acabas de recibir el mail, es probable que tu antivirus lo haya validado automáticamente; intenta ingresar con tu contraseña.");
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'auth_confirmation_error') {
      setError("No pudimos validar el correo. Por favor, intenta de nuevo o solicita otro enlace.");
    }
    if (params.get('confirmed') === 'true') {
      setSuccess("¡Cuenta confirmada con éxito! Ya puedes ingresar al panel.");
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      let msg = error.message;
      if (msg === "Email not confirmed") msg = "Debes confirmar tu email antes de ingresar. Revisa tu bandeja de entrada.";
      if (msg === "Invalid login credentials") msg = "Credenciales inválidas. Revisa tu email y contraseña.";
      if (msg.toLowerCase().includes('ban')) {
        // Distinguir entre estudio pendiente de revisión o rechazado
        try {
          const statusRes = await fetch('/api/auth/estudio-login-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          const statusData = await statusRes.json();
          if (statusData.status === 'pending') {
            msg = "Tu solicitud de Estudio Jurídico está siendo revisada. Te avisaremos por email cuando esté habilitada.";
          } else {
            // rejected u otro: error genérico para no dar información extra
            msg = "Credenciales inválidas. Revisa tu email y contraseña.";
          }
        } catch {
          msg = "Credenciales inválidas. Revisa tu email y contraseña.";
        }
      }
      setError(msg);
      setLoading(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('two_factor_email')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile?.two_factor_email) {
        await fetch('/api/auth/2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.session.access_token}` },
          body: JSON.stringify({ purpose: 'login' })
        });
        setStep('otp');
        setResendCooldown(60);
      } else {
        const dest = await getPostLoginDest(data.user.id);
        router.push(dest);
      }
    } catch {
      router.push('/dashboard');
    }

    setLoading(false);
  };

  // OTP handlers
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value.slice(-1);
    setOtpDigits(next);
    setError(null);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) return;
    setVerifyLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStep('credentials'); return; }

      const res = await fetch('/api/auth/2fa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ otp: code, purpose: 'login' })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Código inválido.');
        setOtpDigits(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
        return;
      }

      const { data: { session: refreshed } } = await supabase.auth.refreshSession();
      const dest = refreshed?.user?.id ? await getPostLoginDest(refreshed.user.id) : '/dashboard';
      router.push(dest);
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStep('credentials'); return; }
      await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ purpose: 'login' })
      });
      setResendCooldown(60);
    } catch {
      setError('Error al reenviar el código.');
    } finally {
      setResending(false);
    }
  };

  const handleCancelOtp = async () => {
    await supabase.auth.signOut();
    setStep('credentials');
    setOtpDigits(['', '', '', '', '', '']);
    setError(null);
    setResendCooldown(0);
  };

  return (
    <main className="auth-body">
      <div className="back-wrapper">
        <Link href="/" className="back">← Volver al inicio</Link>
      </div>

      <button
        onClick={toggleTheme}
        className={`theme-toggle-auth-fixed ${theme === 'dark' ? 'theme-toggle-dark' : 'theme-toggle-light'}`}
        aria-label="Alternar tema"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="login-card fade-in">
        <div className="login-header">
          <Image src="/judic-ia-mark.png" alt="Logo Judic-IA" className="logo" width={48} height={64} priority />
          <h1>Judic-IA</h1>
          <div className="subtitle">
            {step === 'otp' ? 'Verificación en dos pasos' : 'Acceso Profesional · Abogados'}
          </div>
        </div>

        {step === 'credentials' ? (
          <>
            <form onSubmit={handleLogin}>
              <div className="login-field">
                <label htmlFor="email">Email profesional</label>
                <input
                  id="email" name="email" autoComplete="email" type="email"
                  placeholder="dr.nombre@estudio.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required
                />
              </div>

              <div className="login-field">
                <label htmlFor="password">Contraseña</label>
                <div className="password-wrapper">
                  <input
                    id="password" name="password" autoComplete="current-password"
                    type={showPassword ? "text" : "password"} placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)} required
                  />
                  <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>
                <div className="forgot-password-wrap">
                  <Link href="/forgot-password" className="forgot-password-link-item">¿Olvidaste tu contraseña?</Link>
                </div>
              </div>

              {success && <div className="success-msg" role="alert">✅ {success}</div>}
              {error && <div className="error-msg" role="alert">⚠️ {error}</div>}

              <button type="submit" disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar al panel'}
              </button>
            </form>

            <div className="login-footer">
              ¿No sos parte de la red?{' '}
              <Link href="/register">Crear cuenta profesional →</Link>
            </div>
          </>
        ) : (
          <form onSubmit={handleVerify}>
            <p className="otp-hint">
              Ingresá el código de 6 dígitos que enviamos a <strong>{email}</strong>.
            </p>

            <div className="otp-inputs-row">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => otpRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  aria-label={`Dígito ${i + 1}`}
                  className="otp-digit"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {error && <div className="error-msg" role="alert">⚠️ {error}</div>}

            <button type="submit" disabled={verifyLoading || otpDigits.join('').length < 6}>
              {verifyLoading ? 'Verificando...' : 'Verificar acceso'}
            </button>

            <div className="otp-actions">
              <button type="button" onClick={handleResend} disabled={resending || resendCooldown > 0}
                className="forgot-password-link-item otp-resend-btn">
                {resending ? 'Enviando...' : resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : '¿No recibiste el código? Reenviar'}
              </button>
              <button type="button" onClick={handleCancelOtp} className="otp-cancel-btn">
                Cancelar e ingresar con otra cuenta
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
