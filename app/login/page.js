"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon } from 'lucide-react';
import SecurityBadges from '../components/SecurityBadges';
import './login.css';

export default function LoginPage() {
  const router = useRouter();

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // NEW: Loading state for session check
  const [checkingSession, setCheckingSession] = useState(false);

  // NEW: Success state for confirmations
  const [success, setSuccess] = useState(null);
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

  // Auto-redirect if already logged in and session is healthy
  useEffect(() => {
    const validateProfileAndRedirect = async (userId) => {
      if (!userId) return;

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle(); // Use maybeSingle to avoid throw errors on missing

        if (profile) {
          console.log("✅ Profile verified. Redirecting to dashboard...");
          router.push('/dashboard');
        } else {
          console.warn("⚠️ User has session but no profile row. Staying on login.");
        }
      } catch (err) {
        console.error("❌ Profile validation failed:", err);
      }
    };

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await validateProfileAndRedirect(user.id);
      }
    };
    checkUser();

    // Listen for sign-in event specifically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        await validateProfileAndRedirect(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Handle URL fragments and search params for Auth UX
  useEffect(() => {
    // 1. Parse Hash Fragments (Supabase style: #error=...)
    const hash = window.location.hash;
    if (hash.includes('otp_expired')) {
      setError("El enlace de confirmación ya fue utilizado o expiró. Si acabas de recibir el mail, es probable que tu antivirus lo haya validado automáticamente; intenta ingresar con tu contraseña.");
    }

    // 2. Parse Search Params
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

    const { error } = await supabase.auth.signInWithPassword({
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
      router.refresh();
      router.push('/dashboard');
    }
  };

  if (checkingSession) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <Image
            src="/judic-ia-mark.png"
            alt="Logo"
            width={48}
            height={64}
            className="loading-logo"
          />
          <p className="loading-text">Verificando credenciales...</p>
        </div>
      </div>
    );
  }

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
          <Image
            src="/judic-ia-mark.png"
            alt="Logo Judic-IA"
            className="logo"
            width={48}
            height={64}
            priority
          />
          <h1>Judic-IA</h1>
          <div className="subtitle">Acceso Profesional · Abogados</div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label htmlFor="email">Email profesional</label>
            <input
              id="email"
              name="email"
              autoComplete="email"
              type="email"
              placeholder="dr.nombre@estudio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Contraseña</label>
            <div className="password-wrapper">
              <input
                id="password"
                name="password"
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
            <div className="forgot-password-wrap">
              <Link href="/forgot-password" className="forgot-password-link-item">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          {success && <div className="success-msg">✅ {success}</div>}
          {error && <div className="error-msg">⚠️ {error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar al panel'}
          </button>
        </form>

        <div className="login-footer">
          ¿No sos parte de la red?{' '}
          <Link href="/register">Crear cuenta profesional →</Link>
        </div>
      </div>

      <SecurityBadges />
    </main>
  );
}
