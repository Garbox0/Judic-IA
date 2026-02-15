"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon, Lock, Eye, EyeOff, Sparkles, ShieldCheck, ShieldAlert, ShieldEllipsis, RefreshCw, ArrowLeft } from 'lucide-react';
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
    const [theme, setTheme] = useState('light');

    // Security States (HIBP)
    const [pwnedStatus, setPwnedStatus] = useState(null); // 'safe' | 'breached' | 'checking'
    const [isCheckingPwned, setIsCheckingPwned] = useState(false);
    const [lastCheckedPassword, setLastCheckedPassword] = useState('');

    // Load theme from cookies
    useEffect(() => {
        const themeCookie = document.cookie.split('; ').find(row => row.startsWith('app-theme='));
        const savedTheme = themeCookie ? themeCookie.split('=')[1] : 'light';
        setTheme(savedTheme);
    }, []);

    // Update body class and cookie when theme changes
    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 1);
        document.cookie = `app-theme=${theme}; path=/; domain=.judic-ia.com; expires=${expiry.toUTCString()}; SameSite=Lax`;
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Verify Session on Load (Recovery Flow)
    useEffect(() => {
        const establishSession = async () => {
            // 1. Check URL params for token_hash (our custom reset link)
            const params = new URLSearchParams(window.location.search);
            const tokenHash = params.get('token_hash');
            const type = params.get('type');

            if (tokenHash && type === 'recovery') {
                const { error } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: 'recovery',
                });
                if (error) {
                    console.error('OTP verification failed:', error.message);
                    setSessionError("Enlace inválido o expirado. Por favor solicita uno nuevo.");
                } else {
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

    // Pwned Check Logic (k-Anonymity) — same as register
    const checkPwned = async (pwd) => {
        if (pwd.length < 6) {
            setPwnedStatus(null);
            return;
        }

        setIsCheckingPwned(true);
        setPwnedStatus('checking');

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(pwd);
            const hashBuffer = await crypto.subtle.digest('SHA-1', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

            const prefix = hashHex.slice(0, 5);
            const suffix = hashHex.slice(5);

            const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
            const text = await response.text();

            const lines = text.split('\n');
            const found = lines.some(line => line.split(':')[0] === suffix);

            setPwnedStatus(found ? 'breached' : 'safe');
            setLastCheckedPassword(pwd);
        } catch (err) {
            console.error("HIBP Check failed:", err);
            setPwnedStatus(null);
        } finally {
            setIsCheckingPwned(false);
        }
    };

    // Auto-check on password change (debounced)
    useEffect(() => {
        if (!password || password.length < 6) {
            setPwnedStatus(null);
            return;
        }

        if (password !== lastCheckedPassword) {
            setPwnedStatus(null);
        }

        const timer = setTimeout(() => {
            if (password !== lastCheckedPassword) {
                checkPwned(password);
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [password]);

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
        if (pwnedStatus === 'breached') {
            setError("Esta contraseña fue filtrada en internet. Por favor elige otra.");
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
            setRedirectCountdown(5);
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
            <div className="back-wrapper">
                <Link href="/login" className="back-link">
                    <ArrowLeft size={16} /> Volver al login
                </Link>
            </div>

            <button
                onClick={toggleTheme}
                className="theme-toggle-auth-fixed"
                aria-label="Alternar tema"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

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
                                    <div className="pass-grid">
                                        <div className="input-field">
                                            <div className="label-row">
                                                <label htmlFor="new-password">Contraseña</label>
                                                <button
                                                    type="button"
                                                    onClick={generateSecurePass}
                                                    className="suggest-pass-link"
                                                    title="Generar clave segura"
                                                >
                                                    <Sparkles size={12} /> Sugerir
                                                </button>
                                            </div>
                                            <div className="pass-input-wrapper">
                                                <div className="pass-icon-left">
                                                    <Lock size={16} className="opacity-40" />
                                                </div>
                                                <input
                                                    id="new-password"
                                                    name="new-password"
                                                    type={showPassword ? "text" : "password"}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    autoComplete="new-password"
                                                    required
                                                    className="pl-10"
                                                />
                                                <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="input-field">
                                            <label htmlFor="confirm-password">Confirmar Contraseña</label>
                                            <div className="pass-input-wrapper">
                                                <div className="pass-icon-left">
                                                    <Lock size={16} className="opacity-40" />
                                                </div>
                                                <input
                                                    id="confirm-password"
                                                    name="confirm-password"
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    autoComplete="new-password"
                                                    required
                                                    className="pl-10"
                                                />
                                                <button type="button" className="toggle-password" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="password-checklist-premium">
                                        <p className={passwordValidations.length ? 'valid' : ''}>
                                            {passwordValidations.length ? <ShieldCheck size={14} className="text-emerald" /> : <ShieldEllipsis size={14} className="opacity-30" />}
                                            Mínimo 8 caracteres
                                        </p>
                                        <p className={passwordValidations.uppercase ? 'valid' : ''}>
                                            {passwordValidations.uppercase ? <ShieldCheck size={14} className="text-emerald" /> : <ShieldEllipsis size={14} className="opacity-30" />}
                                            Al menos 1 Mayúscula
                                        </p>
                                        <p className={passwordValidations.number ? 'valid' : ''}>
                                            {passwordValidations.number ? <ShieldCheck size={14} className="text-emerald" /> : <ShieldEllipsis size={14} className="opacity-30" />}
                                            Al menos 1 Número
                                        </p>
                                        <p className={passwordValidations.symbol ? 'valid' : ''}>
                                            {passwordValidations.symbol ? <ShieldCheck size={14} className="text-emerald" /> : <ShieldEllipsis size={14} className="opacity-30" />}
                                            Al menos 1 Símbolo (!@#$...)
                                        </p>

                                        {password.length >= 6 && (
                                            <p className={pwnedStatus === 'safe' ? 'valid' : pwnedStatus === 'breached' ? 'invalid-crit' : ''}>
                                                {isCheckingPwned ? <RefreshCw size={14} className="animate-spin text-gold" /> :
                                                    pwnedStatus === 'safe' ? <ShieldCheck size={14} className="text-emerald" /> :
                                                        pwnedStatus === 'breached' ? <ShieldAlert size={14} className="text-red-500" /> :
                                                            <ShieldEllipsis size={14} className="opacity-30" />}
                                                {pwnedStatus === 'breached' ? 'Clave comprometida en internet' : 'Protección contra filtraciones'}
                                            </p>
                                        )}

                                        {confirmPassword && (
                                            <p className={passwordsMatch ? 'valid' : 'invalid'}>
                                                {passwordsMatch ? <ShieldCheck size={14} className="text-emerald" /> : <ShieldAlert size={14} className="text-red-500" />}
                                                Las contraseñas coinciden
                                            </p>
                                        )}
                                    </div>

                                    {error && <div className="error-premium">⚠️ {error}</div>}

                                    <button type="submit" disabled={loading || !isPasswordStrong || !passwordsMatch || pwnedStatus === 'breached'} className="btn-gold-action">
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
        </main>
    );
}
