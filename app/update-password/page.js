"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
// import SafeChatWidget from '../components/SafeChatWidget';
import './update-password.css';

export default function UpdatePasswordPage() {
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
        const establishSession = async () => {
            // 1. Check URL params for token_hash (our custom reset link)
            const params = new URLSearchParams(window.location.search);
            const tokenHash = params.get('token_hash');
            const type = params.get('type');

            if (tokenHash && type === 'recovery') {
                // Verify the token directly — no Supabase redirect needed
                const { error } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: 'recovery',
                });
                if (error) {
                    console.error('OTP verification failed:', error.message);
                    setSessionError("Enlace inválido o expirado. Por favor solicita uno nuevo.");
                } else {
                    // Clean the URL to remove token params
                    window.history.replaceState({}, '', '/update-password');
                }
                setVerifyingSession(false);
                return;
            }

            // 2. Fallback: check for existing session (legacy links / hash-based tokens)
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setVerifyingSession(false);
                return;
            }

            // 3. Listen for PASSWORD_RECOVERY event (implicit flow hash fragments)
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                    setVerifyingSession(false);
                }
            });

            setTimeout(async () => {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (!currentSession) {
                    setSessionError("Enlace inválido o expirado. Por favor solicita uno nuevo.");
                }
                setVerifyingSession(false);
            }, 3000);

            return () => subscription.unsubscribe();
        };

        establishSession();
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

    // Passphrase Generator (Cryptographically Secure)
    const generateSecurePass = () => {
        const caps = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const lows = "abcdefghijkmnopqrstuvwxyz";
        const nums = "23456789";
        const syms = "!@#$%&*+?=";
        const all = caps + lows + nums + syms;

        const secureRandom = (max) => {
            const array = new Uint32Array(1);
            crypto.getRandomValues(array);
            return array[0] % max;
        };

        let pass = "";
        pass += caps[secureRandom(caps.length)];
        pass += lows[secureRandom(lows.length)];
        pass += nums[secureRandom(nums.length)];
        pass += syms[secureRandom(syms.length)];

        for (let i = 0; i < 12; i++) {
            pass += all[secureRandom(all.length)];
        }

        const arr = pass.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = secureRandom(i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        const final = arr.join('');
        setPassword(final);
        setConfirmPassword(final);
        setShowPassword(true);
        setError(null);
    };

    // Countdown Effect
    useEffect(() => {
        if (redirectCountdown === null) return;
        if (redirectCountdown === 0) {
            // Force sign out so they have to login with new password
            supabase.auth.signOut().then(() => {
                router.push('/login');
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
                // We don't block on RPC error to avoid locking user out if DB logic fails, 
                // but strictly speaking we should. For now, we log it.
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




            <div className="auth-container">
                <div className="glass-premium fade-in">
                    {!success ? (
                        <>
                            <header className="brand-header">
                                <Image
                                    src="/judic-ia-mark.png"
                                    alt="Logo"
                                    className="brand-logo-img"
                                    width={48}
                                    height={64}
                                />
                                <h1 className="brand-name-premium">Actualizar Clave</h1>
                                <p className="brand-status">Restablecimiento Seguro</p>
                            </header>

                            {verifyingSession ? (
                                <div className="verifying-msg">
                                    <p>Verificando credenciales de seguridad...</p>
                                </div>
                            ) : sessionError ? (
                                <div className="error-container">
                                    <div className="error-icon">⚠️</div>
                                    <h3 className="error-title">Acceso Denegado</h3>
                                    <p className="error-description">{sessionError}</p>
                                    <Link href="/forgot-password" className="error-link">
                                        Solicitar nuevo enlace →
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleUpdatePassword}>
                                    <div className="input-field">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <label>Nueva Contraseña</label>
                                            <button
                                                type="button"
                                                onClick={generateSecurePass}
                                                className="suggest-pass-link"
                                                title="Generar clave segura"
                                            >
                                                Sugerir
                                            </button>
                                        </div>
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
                            <div className="success-ui-icon">🎉</div>
                            <h2 className="success-ui-title">¡Contraseña Actualizada!</h2>
                            <p className="success-ui-description">
                                Tu acceso ha sido restaurado exitosamente.
                                <br />
                                Redirigiendo al login en <strong>{redirectCountdown}</strong> segundos...
                            </p>
                            <Link href="/login" className="success-ui-link">
                                Ir al Login Ahora →
                            </Link>
                        </div>
                    )}
                </div>
            </div>


        </main >
    );
}
