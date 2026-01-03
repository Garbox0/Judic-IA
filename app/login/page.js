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
    <main className="auth-main">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
      `}</style>

      <div className="auth-container">
        <div className="auth-card glass-premium fade-in">
          <Link href="/" className="btn-back-premium">← Volver al Inicio</Link>

          <header className="brand-header">
            <img src="/logo.png" alt="Logo" className="brand-logo-img" />
            <h1 className="brand-name-premium">Judic-IA <span className="justice-emoji">⚖️</span></h1>
            <p className="brand-status">Acceso Profesional • Abogados</p>
          </header>

          <form onSubmit={handleLogin} className="premium-form">
            <div className="input-field">
              <label>Email Profesional</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dr.nombre@estudio.com"
                required
              />
            </div>

            <div className="input-field">
              <label>Contraseña</label>
              <div className="pass-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="eye-toggle-premium"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            {error && <div className="error-premium">⚠️ {error}</div>}

            <button type="submit" disabled={loading} className="btn-gold-action">
              {loading ? 'Validando Acceso...' : 'Iniciar Sesión Profesional'}
            </button>
          </form>

          <div className="divider-premium"><span>o</span></div>

          <footer className="auth-nav-footer">
            <p>¿No eres parte de la red?
              <Link href="/register" className="link-gold">Crear Cuenta Profesional</Link>
            </p>
          </footer>
        </div>
      </div>

      <style jsx>{`
        .auth-main { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 10%, #0f172a, #020617); font-family: 'Inter', sans-serif; padding: 2rem; }
        .auth-container { width: 100%; max-width: 440px; position: relative; }
        
        .glass-premium { 
            background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(25px); 
            padding: 4rem 3rem; border-radius: 32px; 
            border: 1px solid rgba(255, 255, 255, 0.08); 
            box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6); 
        }

        .brand-header { text-align: center; margin-bottom: 3rem; }
        .brand-logo-img { width: 55px; margin-bottom: 1.25rem; filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3)); }
        .brand-name-premium { font-family: 'Playfair Display', serif; font-size: 2.2rem; font-weight: 900; color: #fbbf24; margin-bottom: 0.5rem; letter-spacing: -0.01em; }
        .brand-status { color: #64748b; font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
        .justice-emoji { font-style: normal; }

        .premium-form { display: flex; flex-direction: column; gap: 1.75rem; }
        .input-field label { display: block; color: #94a3b8; margin-bottom: 0.6rem; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .input-field input { 
            width: 100%; padding: 1.1rem 1.25rem; background: rgba(2, 6, 23, 0.5); 
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; 
            color: white; font-size: 1rem; transition: 0.3s; outline: none;
        }
        .input-field input:focus { border-color: #fbbf24; background: rgba(2, 6, 23, 0.8); box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1); }
        
        .pass-input-wrapper { position: relative; }
        .eye-toggle-premium { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 1.2rem; opacity: 0.5; transition: 0.3s; }
        .eye-toggle-premium:hover { opacity: 1; }

        .btn-gold-action { 
            width: 100%; padding: 1.1rem; background: linear-gradient(135deg, #fbbf24, #d97706); 
            color: #020617; border: none; border-radius: 14px; font-weight: 800; font-size: 1rem;
            cursor: pointer; transition: 0.4s; box-shadow: 0 10px 25px rgba(217, 119, 6, 0.3); text-transform: uppercase;
        }
        .btn-gold-action:hover { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(217, 119, 6, 0.4); filter: brightness(1.1); }
        .btn-gold-action:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }

        .divider-premium { text-align: center; position: relative; margin: 2.5rem 0; }
        .divider-premium::before { content: ''; position: absolute; left: 0; top: 50%; width: 100%; height: 1px; background: rgba(255, 255, 255, 0.05); }
        .divider-premium span { position: relative; background: #0f172a; padding: 0 1rem; color: #475569; font-size: 0.8rem; text-transform: uppercase; }

        .error-premium { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 1rem; border-radius: 12px; font-size: 0.9rem; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); }
        
        .btn-back-premium { position: absolute; top: 1.5rem; left: 1.5rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 600; transition: 0.3s; }
        .btn-back-premium:hover { color: #fbbf24; }

        .auth-nav-footer { text-align: center; font-size: 0.95rem; color: #94a3b8; }
        .link-gold { 
            color: #fbbf24; 
            text-decoration: none; 
            font-weight: 800; 
            margin-left: 0.5rem; 
            transition: 0.3s;
        }
        .link-gold:hover { 
            text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
            text-decoration: underline;
        }

        .fade-in { animation: fadeIn 0.8s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <SafeChatWidget mode="sales" initialMessage="¡Hola! Si ya tienes una cuenta, ingresa tus credenciales aquí." />
    </main>
  );
}
