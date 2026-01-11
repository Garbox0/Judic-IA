"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

  // Auto-redirect if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // router.push('/dashboard'); 
        // BREAK LOOP: If session exists but proxy rejected us, let user re-login
        console.log("User found on client, but forcing form render to fix session sync.");
      }
    };
    checkUser();

    // Listen for sign-in event specifically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // setCheckingSession(true); 
        // router.push('/dashboard');
        // Prevent loop: Don't auto-redirect on background auth changes. 
        // Let explicit user action (handleLogin) or initial checkUser handle it.
        console.log("Auth state changed to SIGNED_IN. Staying on page to avoid loop.");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

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
          <img src="/logo.png" alt="Logo" style={{ width: '60px', marginBottom: '20px', filter: 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.3))' }} width="60" height="60" />
          <p style={{ fontSize: '1.2rem', fontWeight: '600' }}>Verificando credenciales...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="auth-body">
      <div className="back-wrapper">
        <Link href="/" className="back">← Volver al inicio</Link>
      </div>

      <div className="login-card fade-in">
        <div className="login-header">
          <img src="/logo.png" alt="Logo Judic-IA" className="logo" width="56" height="56" />
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
