"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SafeChatWidget from '../components/SafeChatWidget';
import '../globals.css';

export default function LoginPage() {
  const router = useRouter();

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/dashboard');
      }
    };
    checkUser();

    // Listen for sign-in event specifically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Only redirect if we weren't already trying to go elsewhere
        router.push('/dashboard');
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
      router.push('/dashboard');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <Link href="/" className="btn-back">← Volver al Inicio</Link>
        <Link href="/">
          <img src="/logo.png" alt="Judic-IA Logo" className="logo-img" style={{ display: 'block', margin: '0 auto' }} />
        </Link>
        <h1 className="logo-text" style={{ textAlign: 'center' }}>Judic-IA</h1>
        <p className="subtitle" style={{ textAlign: 'center' }}>Acceso para Abogados</p>

        <form onSubmit={handleLogin}>
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

          <div className="input-group full-width" style={{ marginTop: '1.5rem' }}>
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

          {error && <div className="error-msg" style={{ marginTop: '1.5rem' }}>{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '2rem' }}>
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="divider" style={{ margin: '2rem 0' }}>o</div>
        <div className="toggle-mode" style={{ textAlign: 'center' }}>
          <p>¿Nuevo en Judic-IA? <Link href="/register" style={{ color: '#fbbf24', fontWeight: 600, textDecoration: 'none', marginLeft: '0.5rem' }}>Crear Cuenta Profesional</Link></p>
        </div>
      </div>

      <style jsx>{`
        .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; font-family: 'Inter', sans-serif; padding: 1rem; }
        .login-card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(16px); padding: 2.5rem; border-radius: 20px; width: 100%; max-width: 400px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; }
        .logo-img { width: 60px; height: auto; margin-bottom: 1rem; }
        .logo-text { color: #fbbf24; font-size: 2rem; margin-bottom: 0.5rem; }
        .subtitle { color: #94a3b8; margin-bottom: 2rem; }
        .input-group label { display: block; color: #cbd5e1; margin-bottom: 0.5rem; font-size: 0.85rem; }
        .input-group input { width: 100%; padding: 0.75rem 1rem; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white; outline: none; }
        .password-wrapper { position: relative; width: 100%; }
        .eye-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.6; }
        .btn-primary { width: 100%; padding: 0.9rem; background: #fbbf24; color: #0f172a; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .divider { text-align: center; color: #64748b; font-size: 0.8rem; }
        .error-msg { background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 0.75rem; border-radius: 8px; font-size: 0.9rem; text-align: center; }
        .btn-back { align-self: flex-start; color: #94a3b8; text-decoration: none; font-size: 0.85rem; margin-bottom: 1.5rem; transition: 0.2s; font-weight: 500; }
        .btn-back:hover { color: #fbbf24; }
      `}</style>
      <SafeChatWidget mode="sales" initialMessage="¡Hola! Si ya tienes una cuenta, ingresa tus credenciales aquí." />
    </div>
  );
}
