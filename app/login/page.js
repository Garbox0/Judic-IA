"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon } from 'lucide-react';
import SafeChatWidget from '../components/SafeChatWidget';
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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 10%, #0f172a, #020617)',
        color: '#fbbf24',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <Image
            src="/judic-ia-mark.png"
            alt="Logo"
            width={48}
            height={64}
            style={{ marginBottom: '20px', filter: 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.3))', objectFit: 'contain' }}
          />
          <p style={{ fontSize: '1.2rem', fontWeight: '600' }}>Verificando credenciales...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="auth-body">
      <div className="back-wrapper">
        <Link href="/" className="back">← Volver al inicio</Link>
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

      <div className="login-card fade-in">
        <div className="login-header">
          <Image
            src="/judic-ia-mark.png"
            alt="Logo Judic-IA"
            className="logo"
            width={48}
            height={64}
            priority
            style={{ objectFit: 'contain' }}
          />
          <h1>Judic-IA <span className="justice-emoji">⚖️</span></h1>
          <div className="subtitle">Acceso Profesional · Abogados</div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label>Email profesional</label>
            <input
              type="email"
              placeholder="dr.nombre@estudio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label>Contraseña</label>
            <div className="password-wrapper">
              <input
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
            <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
              <Link href="/forgot-password" style={{ color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'none' }}>
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

      <SafeChatWidget mode="lawyer_login" initialMessage="¿Problemas para ingresar? Estoy aquí para ayudarte." />
    </main>
  );
}
