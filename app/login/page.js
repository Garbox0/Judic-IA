"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SafeChatWidget from '../components/SafeChatWidget';

export default function LoginPage() {
  const router = useRouter();

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // NEW: Loading state for session check
  const [checkingSession, setCheckingSession] = useState(true);

  // Auto-redirect if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/dashboard');
      } else {
        setCheckingSession(false);
      }
    };
    checkUser();

    // Listen for sign-in event specifically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setCheckingSession(true); // Show loader while redirecting
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

      <div className="card fade-in">
        <div className="header">
          <img src="/logo.png" alt="Logo Judic-IA" className="logo" />
          <h1>Judic-IA <span className="justice-emoji">⚖️</span></h1>
          <div className="subtitle">Acceso Profesional · Abogados</div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="field">
            <label>Email profesional</label>
            <input
              type="email"
              placeholder="dr.nombre@estudio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
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

        <div className="footer">
          ¿No sos parte de la red?{' '}
          <Link href="/register">Crear cuenta profesional →</Link>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:wght@700;900&display=swap');
      `}</style>

      <style jsx>{`
        :root{
          --bg:#020617;
          --card:#0f172a;
          --gold:#fbbf24;
          --muted:#94a3b8;
        }

        .auth-body {
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          background:radial-gradient(circle at 50% 10%, #0f172a, #020617);
          font-family:'Inter',sans-serif;
          color:white;
          padding: 2rem;
          position: relative;
        }

        .card{
          width:100%;
          max-width:420px;
          background:rgba(15,23,42,.7);
          backdrop-filter:blur(20px);
          border-radius:28px;
          padding:3.5rem 3rem;
          box-shadow:0 40px 80px rgba(0,0,0,.6);
          border:1px solid rgba(255,255,255,.08);
        }

        @media (max-width: 640px) {
          .card {
            padding: 2rem 1.5rem;
            border-radius: 20px;
          }
          .auth-body {
            padding: 1rem;
          }
          h1 {
            font-size: 1.8rem;
          }
        }

        .back-wrapper {
          position:absolute;
          top:2rem;
          left:2rem;
          z-index: 10;
        }

        .back{
          color:#94a3b8;
          text-decoration:none;
          font-size:.85rem;
          transition: 0.3s;
        }
        .back:hover { color: #fbbf24; }

        .header{
          text-align:center;
          margin-bottom:2.5rem;
        }

        .logo{
          width:56px;
          margin-bottom:1rem;
          filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3));
        }

        h1{
          font-family:'Playfair Display',serif;
          color:#fbbf24;
          margin:0;
          font-size:2.2rem;
        }

        .justice-emoji { font-style: normal; }

        .subtitle{
          text-transform:uppercase;
          font-size:.75rem;
          letter-spacing:.15em;
          color:#94a3b8;
          margin-top:.5rem;
        }

        .field{
          margin-bottom:1.5rem;
        }

        label{
          font-size:.75rem;
          text-transform:uppercase;
          letter-spacing:.08em;
          color:#94a3b8;
          margin-bottom:.4rem;
          display:block;
        }

        input{
          width:100%;
          padding:1rem 1.2rem;
          border-radius:14px;
          border:1px solid rgba(255,255,255,.1);
          background:#020617;
          color:white;
          font-size:1rem;
          outline: none;
          transition: 0.3s;
        }
        input:focus {
            border-color: #fbbf24;
            box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1);
        }

        .password-wrapper {
          position: relative;
        }

        .toggle-password {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          padding: 0;
          margin: 0;
          color: #94a3b8;
          cursor: pointer;
          width: auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .toggle-password:hover {
          color: #fbbf24;
          box-shadow: none;
          transform: translateY(-50%);
        }

        button{
          width:100%;
          padding:1.1rem;
          margin-top:1rem;
          background:linear-gradient(135deg,#fbbf24,#d97706);
          border:none;
          border-radius:14px;
          font-weight:800;
          cursor:pointer;
          color:#020617;
          font-size:.95rem;
          transition: 0.3s;
        }
        button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(217, 119, 6, 0.3);
        }
        button:disabled { opacity: 0.7; cursor: not-allowed; }

        .footer{
          margin-top:2rem;
          text-align:center;
          font-size:.9rem;
          color:#94a3b8;
        }

        .footer a{
          color:#fbbf24;
          text-decoration:none;
          font-weight:700;
        }
        .footer a:hover { text-decoration: underline; }

        .error-msg {
            background: rgba(239, 68, 68, 0.1);
            color: #fca5a5;
            padding: 1rem;
            border-radius: 12px;
            font-size: 0.9rem;
            text-align: center;
            border: 1px solid rgba(239, 68, 68, 0.2);
            margin-bottom: 1.5rem;
        }
        
        .fade-in { animation: fadeIn 0.8s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <SafeChatWidget mode="lawyer_login" initialMessage="¿Problemas para ingresar? Estoy aquí para ayudarte." />
    </main>
  );
}
