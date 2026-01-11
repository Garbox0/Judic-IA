"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SafeChatWidget from '../../../components/SafeChatWidget';
import { supabase } from '../../../lib/supabase';
import '../../../globals.css';

// --- STYLES (Hoisted to apply to both Content and Loading) ---
const AuthStyles = () => (
    <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');

        .auth-main { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 10%, #0f172a, #020617); font-family: 'Inter', sans-serif; padding: 2rem; }
        .auth-container { width: 100%; max-width: 420px; position: relative; }
        
        .glass-premium { 
            background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(20px); 
            padding: 3.5rem 3rem; border-radius: 28px; 
            border: 1px solid rgba(255, 255, 255, 0.08); 
            box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6); 
        }

        .brand-header { text-align: center; margin-bottom: 2.5rem; }
        .brand-logo-premium { width: 60px; margin-bottom: 1rem; filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3)); }
        .brand-name-premium { font-family: 'Playfair Display', serif; font-size: 2.2rem; font-weight: 700; color: #fbbf24; margin: 0; }
        .justice-emoji { font-style: normal; font-size: 0.8em; margin-left: 8px; }

        .brand-status { color: #94a3b8; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 0.5rem; margin-bottom: 1rem; }
        .brand-desc { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; font-weight: 400; }

        .premium-form { display: flex; flex-direction: column; gap: 1.5rem; }
        .input-field label { display: block; color: #94a3b8; margin-bottom: 0.4rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
        .input-field input { 
            width: 100%; padding: 1rem 1.2rem; background: #020617; 
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; 
            color: white; font-size: 1rem; transition: 0.3s; outline: none;
        }
        .input-field input:focus { border-color: #fbbf24; box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1); }
        
        .btn-gold-action { 
            width: 100%; padding: 1.1rem; background: linear-gradient(135deg, #fbbf24, #d97706); 
            color: #020617; border: none; border-radius: 14px; font-weight: 800; font-size: 0.95rem;
            cursor: pointer; transition: 0.3s; margin-top: 0.5rem;
        }
        .btn-gold-action:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(217, 119, 6, 0.3); }
        .btn-gold-action:disabled { opacity: 0.7; cursor: not-allowed; }

        .divider-premium { text-align: center; position: relative; margin: 2rem 0; }
        .divider-premium::before { content: ''; position: absolute; left: 0; top: 50%; width: 100%; height: 1px; background: rgba(255, 255, 255, 0.05); }
        .divider-premium span { position: relative; background: #0c1222; padding: 0 1rem; color: #475569; font-size: 0.8rem; }

        .error-premium { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 1rem; border-radius: 12px; font-size: 0.9rem; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); }
        .success-premium { background: rgba(34, 197, 94, 0.1); color: #86efac; padding: 1rem; border-radius: 12px; font-size: 0.9rem; text-align: center; border: 1px solid rgba(34, 197, 94, 0.2); margin-bottom: 1.5rem; }

        .btn-back-premium { position: absolute; top: 2rem; left: 2rem; color: #94a3b8; text-decoration: none; font-size: 0.85rem; font-weight: 500; transition: 0.3s; }
        .btn-back-premium:hover { color: #fbbf24; }

        .auth-nav-footer { text-align: center; font-size: 0.9rem; color: #94a3b8; margin-top: 1rem; }
        .btn-text-gold { background: none; border: none; color: #fbbf24; font-weight: 700; cursor: pointer; margin-left: 0.5rem; font-size: 0.9rem; transition: 0.2s; }
        .btn-text-gold:hover { text-decoration: underline; }

        .confirmed-ui { text-align: center; padding: 2rem 0; }
        .success-icon { font-size: 5rem; margin-bottom: 1.5rem; }
        .confirmed-text { color: #94a3b8; margin-bottom: 2.5rem; font-size: 1.1rem; }
        
        .fade-in { animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* PASSWORD RULES & TOGGLE */
        .pass-input-wrapper { position: relative; }
        .eye-toggle-premium { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 1.2rem; opacity: 0.5; transition: 0.3s; color: white; }
        .eye-toggle-premium:hover { opacity: 1; color: #fbbf24; }

        .password-checklist-premium { background: rgba(2, 6, 23, 0.4); padding: 1rem; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.05); margin-top: 0.5rem; }
        .password-checklist-premium p { margin: 0.3rem 0; font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 0.5rem; }
        .password-checklist-premium p.valid { color: #86efac; font-weight: 600; }
        .password-checklist-premium p.invalid { color: #fca5a5; }
    `}</style>
);

function RegisterContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [confirmedSession, setConfirmedSession] = useState(null);

    const [redirectCountdown, setRedirectCountdown] = useState(null);

    const lawyerId = searchParams.get('lawyerId') || searchParams.get('lawyer');
    const cid = searchParams.get('cid');

    // Password Validations
    const passwordValidations = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password)
    };
    const isPasswordStrong = Object.values(passwordValidations).every(v => v);
    const passwordsMatch = password === confirmPassword && confirmPassword !== '';
    const emailsMatch = email === confirmEmail && email !== '';

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                setIsConfirmed(true);
                setConfirmedSession(session);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    // Countdown Logic
    useEffect(() => {
        if (redirectCountdown === null) return;
        if (redirectCountdown === 0) {
            router.push(`/consultas/auth/login?${searchParams.toString()}`);
            return;
        }
        const timer = setTimeout(() => {
            setRedirectCountdown(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [redirectCountdown, router, searchParams]);

    const enterIntake = async () => {
        if (!confirmedSession || !lawyerId) return;
        setLoading(true);
        try {
            const currentCid = cid || crypto.randomUUID();
            await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: `[SISTEMA: Cliente verificado: ${confirmedSession.user.email}]`,
                    history: [],
                    mode: 'intake',
                    sessionId: currentCid,
                    lawyerId: lawyerId,
                    clientUserId: confirmedSession.user.id,
                    clientEmail: confirmedSession.user.email
                }),
            });
            router.push(`/consultas/${lawyerId}?cid=${currentCid}`);
        } catch (err) {
            setError("Error al entrar al chat. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (!isPasswordStrong) throw new Error("La contraseña no es segura.");
            if (!passwordsMatch) throw new Error("Las contraseñas no coinciden.");
            if (email.toLowerCase() !== confirmEmail.toLowerCase()) throw new Error("Los correos electrónicos no coinciden.");

            const redirectBase = `${window.location.origin}/consultas/auth/login`;
            const redirectParams = new URLSearchParams();
            if (lawyerId) redirectParams.set('lawyerId', lawyerId);
            if (cid) redirectParams.set('cid', cid);
            const fullRedirectUrl = `${redirectBase}?${redirectParams.toString()}`;

            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: fullRedirectUrl, // Still good to send for prod
                    data: {
                        role: 'client',
                        full_name: fullName,
                        phone: phone
                    }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes("already registered")) {
                    throw new Error("Este email ya tiene una clave. Por favor inicia sesión.");
                }
                if (signUpError.message.includes("Error sending confirmation email")) {
                    console.warn("Supabase SMTP Error. User likely created but email failed.");
                    throw new Error("⚠️ El sistema de correos está saturado. Por favor, avisa a tu abogado o intenta iniciar sesión directo si ya te registraste.");
                }
                throw signUpError;
            }

            // SUCCESS FLOW
            if (data.session) {
                // If we got a session immediately (Email Confirm Disabled), go straight to chat
                const finalCid = cid || crypto.randomUUID();
                await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: `[SISTEMA: Nuevo cliente registrado: ${email}]`,
                        history: [],
                        mode: 'intake',
                        sessionId: finalCid,
                        lawyerId: lawyerId,
                        clientUserId: data.user.id,
                        clientEmail: email
                    }),
                });
                router.push(`/consultas/${lawyerId}?cid=${finalCid}`);
            } else {
                setMessage("¡Cuenta creada! Revisa tu email para confirmar y acceder.");
                setRedirectCountdown(10);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card glass-premium fade-in">
            <Link href="/" className="btn-back-premium">← Volver al Inicio</Link>

            {isConfirmed ? (
                <div className="confirmed-ui fade-in">
                    <div className="success-icon">✅</div>
                    <h1 className="brand-name-premium">¡Email Confirmado!</h1>
                    <p className="confirmed-text">Tu privacidad ha sido asegurada. Ya puedes ingresar a la consulta.</p>
                    <button onClick={enterIntake} className="btn-gold-action" disabled={loading}>
                        {loading ? 'Preparando Chat...' : 'Ingresar al Chat Ahora'}
                    </button>
                </div>
            ) : (
                <>
                    <header className="brand-header">
                        <img src="/logo.png" alt="Judic-IA Logo" className="brand-logo-premium" />
                        <h1 className="brand-name-premium">Judic-IA <span className="justice-emoji">⚖️</span></h1>
                        <div className="brand-status">Acceso Seguro • Clientes</div>
                        <p className="brand-desc">Crea una clave de acceso temporal para proteger tu privacidad y documentos durante esta sesión.</p>
                    </header>

                    <form onSubmit={handleRegister} className="premium-form">
                        <div className="input-field">
                            <label>Tu Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                required
                            />
                        </div>

                        <div className="input-field">
                            <label>Nombre Completo</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Nombre Apellido"
                                required
                            />
                        </div>

                        <div className="input-field">
                            <label>Celular</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+54 9 11..."
                                required
                            />
                        </div>

                        <div className="input-field">
                            <label>Confirmar Email</label>
                            <input
                                type="email"
                                value={confirmEmail}
                                onChange={(e) => setConfirmEmail(e.target.value)}
                                placeholder="Repite tu email"
                                required
                                style={{ borderColor: (confirmEmail && email.toLowerCase() !== confirmEmail.toLowerCase()) ? '#ef4444' : '' }}
                            />
                            {confirmEmail && email.toLowerCase() !== confirmEmail.toLowerCase() && (
                                <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: '0.3rem' }}>No coinciden</div>
                            )}
                        </div>

                        <div className="input-field">
                            <label>Crear Clave de Acceso</label>
                            <div className="pass-input-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                                <button type="button" className="eye-toggle-premium" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="input-field">
                            <label>Repetir Clave</label>
                            <div className="pass-input-wrapper">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                                <button type="button" className="eye-toggle-premium" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    {showConfirmPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* PASSWORD RULES */}
                        <div className="password-checklist-premium">
                            <p className={passwordValidations.length ? 'valid' : ''}>
                                {passwordValidations.length ? '✅' : '❌'} Mínimo 8 caracteres
                            </p>
                            <p className={passwordValidations.uppercase ? 'valid' : ''}>
                                {passwordValidations.uppercase ? '✅' : '❌'} Al menos 1 Mayúscula
                            </p>
                            <p className={passwordValidations.number ? 'valid' : ''}>
                                {passwordValidations.number ? '✅' : '❌'} Al menos 1 Número
                            </p>
                            <p className={passwordValidations.symbol ? 'valid' : ''}>
                                {passwordValidations.symbol ? '✅' : '❌'} Al menos 1 Símbolo
                            </p>
                            {confirmPassword && (
                                <p className={passwordsMatch ? 'valid' : 'invalid'}>
                                    {passwordsMatch ? '✅' : '❌'} Las contraseñas coinciden
                                </p>
                            )}
                        </div>

                        {error && <div className="error-premium">⚠️ {error}</div>}
                        {message && (
                            <div className="success-premium">
                                📩 {message}
                                <br />
                                <small style={{ color: '#fff', display: 'block', marginTop: '5px' }}>
                                    ⚠️ Si no lo ves, <strong>revisá SPAM</strong>.
                                </small>
                                {redirectCountdown !== null && (
                                    <div style={{ marginTop: '0.8rem', fontWeight: 700, color: '#white' }}>
                                        Redirigiendo al login en {redirectCountdown} segundos...
                                    </div>
                                )}
                            </div>
                        )}

                        <button type="submit" className="btn-gold-action" disabled={loading || !isPasswordStrong || !passwordsMatch || !emailsMatch || message}>
                            {loading ? 'Creando Acceso...' : 'Comenzar Consulta Segura'}
                        </button>
                    </form>

                    <div className="divider-premium"><span>o</span></div>

                    <footer className="auth-nav-footer">
                        <p>¿Ya tienes una clave?
                            <button type="button" className="btn-text-gold" onClick={() => router.push(`/consultas/auth/login?${searchParams.toString()}`)}>
                                Ingresar
                            </button>
                        </p>
                    </footer>
                </>
            )}
        </div>
    );
}

function LoadingFallback() {
    return (
        <div className="auth-card glass-premium">
            <header className="brand-header">
                <div className="brand-logo-premium" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
                <div style={{ height: '30px', width: '60%', margin: '0 auto 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                <div style={{ height: '20px', width: '40%', margin: '0 auto', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
            </header>
            <div className="premium-form" style={{ gap: '2rem' }}>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
                <div style={{ height: '50px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}></div>
            </div>
        </div>
    );
}

export default function ClientRegisterPage() {
    return (
        <main className="auth-main">
            <AuthStyles />
            <div className="auth-container">
                <Suspense fallback={<LoadingFallback />}>
                    <RegisterContent />
                </Suspense>
            </div>
            {/* Global Fixed Widget */}
            <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
                <SafeChatWidget mode="client_help" initialMessage="¿Necesitas ayuda con tu registro?" />
            </div>
        </main>
    );
}
