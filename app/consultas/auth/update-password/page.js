"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import SafeChatWidget from '../../../components/SafeChatWidget';

export default function ClientUpdatePasswordPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [redirectCountdown, setRedirectCountdown] = useState(null);
    const [verifyingSession, setVerifyingSession] = useState(true);
    const [sessionError, setSessionError] = useState(null);

    // Verify Session on Load (Recovery Flow)
    useEffect(() => {
        const checkSession = async () => {
            // Check if we have a hash with tokens (Supabase sends #access_token=...)
            const hasAuthHash = window.location.hash && window.location.hash.includes('access_token');

            // If there's a hash, Supabase needs time to process it. We wait longer.
            const timeoutDuration = hasAuthHash ? 6000 : 3000;

            const { data: { session }, error } = await supabase.auth.getSession();

            if (session) {
                setVerifyingSession(false);
                return;
            }

            // Try listening for the recovery event specifically
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                    setVerifyingSession(false);
                }
            });

            // If after the delay we still have no session, show error
            setTimeout(async () => {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (!currentSession) {
                    setSessionError("Enlace inválido o expirado. Por favor solicita uno nuevo.");
                    setVerifyingSession(false);
                } else {
                    setVerifyingSession(false);
                }
            }, timeoutDuration);

            return () => subscription.unsubscribe();
        };

        checkSession();
    }, []);

    // Password Validations (Same as Register)
    const passwordValidations = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password)
    };

    const isPasswordStrong = Object.values(passwordValidations).every(v => v);
    const passwordsMatch = password === confirmPassword && confirmPassword !== '';

    // Countdown Effect
    useEffect(() => {
        if (redirectCountdown === null) return;
        if (redirectCountdown === 0) {
            // Force sign out so they have to login with new password
            supabase.auth.signOut().then(() => {
                router.push('/auth/login');
            });
            return;
        }
        const timer = setTimeout(() => {
            setRedirectCountdown(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [redirectCountdown, router]);

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (!isPasswordStrong) {
            setError("La contraseña no cumple con los requisitos de seguridad.");
            return;
        }
        if (!passwordsMatch) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Check for Password Reuse (RPC)
            const { data: isReused, error: rpcError } = await supabase.rpc('check_password_reuse', {
                plain_password: password
            });

            if (rpcError) {
                console.error("Error checking password history:", rpcError);
            }

            if (isReused) {
                throw new Error("Por seguridad, no puedes reutilizar una contraseña antigua.");
            }

            // 2. Update Password
            const { error } = await supabase.auth.updateUser({ password: password });
            if (error) throw error;

            // Get user email to send notification
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.email) {
                await fetch('/api/auth/notify-password-change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email })
                });
            }

            setSuccess(true);
            setRedirectCountdown(5); // 5 Seconds Countdown
        } catch (err) {
            let msg = err.message;
            if (msg.includes("New password should be different from the old password")) {
                msg = "Por seguridad, la nueva contraseña debe ser diferente a la anterior.";
            }
            setError(msg || "Error al actualizar la contraseña.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-main">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
                
                .auth-main { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 10%, #0f172a, #020617); font-family: 'Inter', sans-serif; padding: 2rem; }
                .auth-container { width: 100%; max-width: 440px; position: relative; }
                
                .glass-premium { 
                    background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(20px); 
                    padding: 3.5rem 3rem; border-radius: 28px; 
                    border: 1px solid rgba(255, 255, 255, 0.08); 
                    box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6); 
                }

                @media (max-width: 640px) {
                    .glass-premium { padding: 2rem 1.5rem; border-radius: 20px; }
                    .auth-main { padding: 1rem; }
                    .brand-name-premium { font-size: 1.8rem; }
                }

                .brand-header { text-align: center; margin-bottom: 2.5rem; }
                .brand-logo-img { width: 60px; margin-bottom: 1rem; filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3)); }
                .brand-name-premium { font-family: 'Playfair Display', serif; font-size: 2.2rem; font-weight: 700; color: #fbbf24; margin: 0; }
                .brand-status { color: #94a3b8; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 0.5rem; margin-bottom: 1rem; }

                .input-field { margin-bottom: 1.5rem; }
                .input-field label { display: block; color: #94a3b8; margin-bottom: 0.4rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
                .pass-input-wrapper { position: relative; }
                .input-field input { 
                    width: 100%; padding: 1rem 1.25rem; background: rgba(2, 6, 23, 0.5); 
                    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; 
                    color: white; font-size: 1rem; transition: 0.3s; outline: none;
                }
                .input-field input:focus { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1); }
                
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
                  transform: translateY(-50%);
                }

                .password-checklist-premium { background: rgba(2, 6, 23, 0.4); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.03); margin-bottom: 1.5rem; }
                .password-checklist-premium p { margin: 0.4rem 0; font-size: 0.85rem; color: #64748b; }
                .password-checklist-premium p.valid { color: #86efac; font-weight: 600; }
                .password-checklist-premium p.invalid { color: #fca5a5; font-weight: 600; }

                .btn-gold-action { 
                    width: 100%; padding: 1.1rem; background: linear-gradient(135deg, #fbbf24, #d97706); 
                    color: #020617; border: none; border-radius: 14px; font-weight: 800; font-size: 0.95rem;
                    cursor: pointer; transition: 0.3s; margin-top: 0.5rem;
                }
                .btn-gold-action:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(217, 119, 6, 0.3); }
                .btn-gold-action:disabled { opacity: 0.7; cursor: not-allowed; }

                .error-premium { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 1rem; border-radius: 12px; font-size: 0.9rem; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 1.5rem; }
                .success-ui { text-align: center; padding: 2rem 0; animation: fadeIn 0.8s ease forwards; }
                
                .fade-in { animation: fadeIn 0.8s ease forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            <div className="auth-container">
                <div className="glass-premium fade-in">
                    {!success ? (
                        <>
                            <header className="brand-header">
                                <img src="/logo.png" alt="Logo" className="brand-logo-img" width="60" height="60" />
                                <h1 className="brand-name-premium">Actualizar Clave</h1>
                                <p className="brand-status">Acceso Seguro • Clientes</p>
                            </header>

                            {verifyingSession ? (
                                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>
                                    <p>Verificando credenciales de seguridad...</p>
                                </div>
                            ) : sessionError ? (
                                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                                    <h3 style={{ color: '#fca5a5', marginBottom: '1rem' }}>Acceso Denegado</h3>
                                    <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>{sessionError}</p>
                                    <Link href="/auth/forgot-password" style={{ color: '#fbbf24', textDecoration: 'none', fontWeight: 'bold' }}>
                                        Solicitar nuevo enlace →
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleUpdatePassword}>
                                    <div className="input-field">
                                        <label>Nueva Contraseña</label>
                                        <div className="pass-input-wrapper">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••"
                                                required
                                            />
                                            <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                                                {showPassword ? (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                                ) : (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="input-field">
                                        <label>Confirmar Contraseña</label>
                                        <div className="pass-input-wrapper">
                                            <input
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="••••••••"
                                                required
                                            />
                                            <button type="button" className="toggle-password" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                                {showConfirmPassword ? (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                                ) : (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="password-checklist-premium">
                                        <p className={passwordValidations.length ? 'valid' : ''}>{passwordValidations.length ? '✅' : '❌'} Mínimo 8 caracteres</p>
                                        <p className={passwordValidations.uppercase ? 'valid' : ''}>{passwordValidations.uppercase ? '✅' : '❌'} Al menos 1 Mayúscula</p>
                                        <p className={passwordValidations.number ? 'valid' : ''}>{passwordValidations.number ? '✅' : '❌'} Al menos 1 Número</p>
                                        <p className={passwordValidations.symbol ? 'valid' : ''}>{passwordValidations.symbol ? '✅' : '❌'} Al menos 1 Símbolo</p>
                                        {confirmPassword && (
                                            <p className={passwordsMatch ? 'valid' : 'invalid'}>{passwordsMatch ? '✅' : '❌'} Las contraseñas coinciden</p>
                                        )}
                                    </div>

                                    {error && <div className="error-premium">⚠️ {error}</div>}

                                    <button type="submit" disabled={loading || !isPasswordStrong || !passwordsMatch} className="btn-gold-action">
                                        {loading ? 'Actualizando...' : 'Confirmar Nueva Contraseña'}
                                    </button>
                                </form>
                            )}
                        </>
                    ) : (
                        <div className="success-ui">
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                            <h2 style={{ color: '#fbbf24', marginBottom: '1rem' }}>¡Contraseña Actualizada!</h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: '2rem' }}>
                                Tu acceso ha sido restaurado exitosamente.
                                <br />
                                Redirigiendo al login en <strong>{redirectCountdown}</strong> segundos...
                            </p>
                            <Link href="/auth/login" style={{ color: '#fbbf24', fontWeight: 'bold', textDecoration: 'none' }}>
                                Ir al Login Ahora →
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* AI ASSISTANT FOR PASSWORD RESET */}
            <SafeChatWidget mode="password_reset" initialMessage="¿Necesitas ayuda para crear tu nueva clave?" />
        </main>
    );
}
