"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function AuthFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    // Default to Login unless a valid lawyerId/cid is present AND view is not explicitly login
    const initialViewIsLogin = searchParams.get('view') === 'login' || (!searchParams.get('lawyerId') && !searchParams.get('cid'));
    const [isLogin, setIsLogin] = useState(initialViewIsLogin);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [viewOnly, setViewOnly] = useState(false); // New state to handle "Success" view
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [validating, setValidating] = useState(true); // Binary Gatekeeper state
    const [restricted, setRestricted] = useState(false); // Restricted access state
    const [cidClaimedByOther, setCidClaimedByOther] = useState(false); // CID already claimed by different email
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [confirmedSession, setConfirmedSession] = useState(null);

    // Get context from URL or LocalStorage fallback
    const [lawyerId, setLawyerId] = useState(null);
    const [cid, setCid] = useState(null);

    // Initial load and persistence
    useEffect(() => {
        const urlLawyer = searchParams.get('lawyerId') || searchParams.get('lawyer');
        const urlCid = searchParams.get('cid');

        // Restore from storage if missing in URL (e.g. returning from email confirmation)
        const storedLawyer = localStorage.getItem('judic_ia_lawyer_id');
        const storedCid = localStorage.getItem('judic_ia_cid');

        const finalLawyer = urlLawyer || storedLawyer;
        const finalCid = urlCid || storedCid;

        if (finalLawyer) {
            setLawyerId(finalLawyer);
            localStorage.setItem('judic_ia_lawyer_id', finalLawyer);
        }
        if (finalCid) {
            setCid(finalCid);
            localStorage.setItem('judic_ia_cid', finalCid);
        }

        // --- BINARY ACCESS CHECK ---
        const validateAccess = async () => {
            console.log("🛡️ Gatekeeper: Validating CID access...");

            // 1. Detect errors in Query Params AND Hash Fragment (Supabase defaults)
            const hash = window.location.hash;
            const hashParams = new URLSearchParams(hash.replace('#', '?'));
            const errorCode = searchParams.get('error') || hashParams.get('error');
            const errorDesc = (searchParams.get('error_description') || hashParams.get('error_description') || '').toLowerCase();

            if (errorCode === 'access_denied' || errorDesc.includes('expired') || errorDesc.includes('invalid') || errorDesc.includes('not found')) {
                console.warn("🚫 AUTH ERROR DETECTED:", errorCode, errorDesc);
                setRestricted(true);
                setValidating(false);
                return;
            }

            // 2. Validate CID existence and USER relationship
            if (finalCid) {
                const { data: inquiry, error: inqErr } = await supabase
                    .from('inquiries')
                    .select('id, client_auth_id, claimed_by_email')
                    .eq('id', finalCid)
                    .maybeSingle();

                if (!inquiry || inqErr) {
                    console.warn("🚫 CID INVALID OR DELETED:", finalCid);
                    localStorage.removeItem('judic_ia_cid');
                    setRestricted(true);
                    setValidating(false);
                    return;
                }

                // 🔐 NEW: Check if CID is already claimed. If so, force login.
                if (inquiry.claimed_by_email) {
                    console.log("📝 CID already claimed by:", inquiry.claimed_by_email);
                    setIsLogin(true);
                }

                // If inquiry is linked to a user...
                if (inquiry.client_auth_id) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('id', inquiry.client_auth_id)
                        .maybeSingle();

                    if (!profile) {
                        console.warn("🚫 CID LINKS TO DELETED PROFILE:", inquiry.client_auth_id);
                        setRestricted(true);
                        setValidating(false);
                        return;
                    }
                }
            }

            // 3. Validate Current Session Profile (if authenticated)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('id', user.id)
                    .maybeSingle();

                if (!profile) {
                    console.warn("🚫 LOGGED USER HAS NO PROFILE:", user.id);
                    await supabase.auth.signOut();
                    setRestricted(true);
                    setValidating(false);
                    return;
                }
            }

            setValidating(false);
        };

        validateAccess();
    }, [searchParams]);

    // Redirect out if restricted
    useEffect(() => {
        if (restricted) {
            const timer = setTimeout(() => {
                router.push('/?public=true');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [restricted, router]);

    // Handle Email Confirmation Return & Auto-Redirect (Now Manual as requested)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                console.log("⚡ Auth Event: SIGNED_IN", session.user.email);

                // Safeguard: Check if this is a lawyer
                const userRole = session.user?.user_metadata?.role;
                if (userRole === 'lawyer') {
                    console.log('🔄 Abogado detectado en flujo de cliente. Redirigiendo al dashboard...');
                    router.push('/dashboard');
                    return;
                }

                // STRICT: Enforce Email Confirmation
                if (!session.user.email_confirmed_at) {
                    console.warn("🔒 Acceso bloqueado: Email no confirmado.");
                    await supabase.auth.signOut();
                    setMessage("⚠️ Debes confirmar tu email desde la bandeja de entrada para acceder.");
                    setIsLogin(true);
                    return;
                }

                // If confirmed, show the "Success" UI instead of auto-pushing
                setIsConfirmed(true);
                setConfirmedSession(session);
                setMessage(null);
                setError(null);
            }
        });

        return () => subscription.unsubscribe();
    }, [lawyerId, searchParams, router]);

    const enterIntake = async () => {
        // Fallback check for lawyerId from localStorage if state is lost
        const activeLawyerId = lawyerId || localStorage.getItem('judic_ia_lawyer_id');
        const activeCid = cid || searchParams.get('cid') || localStorage.getItem('judic_ia_cid') || crypto.randomUUID();

        if (!activeLawyerId) {
            console.error("❌ Lawyer ID missing for redirection");
            setError("No pudimos identificar al abogado. Por favor usa el link original que te enviaron.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log("🚀 Syncing session with database...", { cid: activeCid, lawyer: activeLawyerId });

            // We use the current session from Supabase if confirmedSession is missing but user is logged in
            let session = confirmedSession;
            if (!session) {
                const { data } = await supabase.auth.getSession();
                session = data?.session;
            }

            if (!session) {
                throw new Error("No hay una sesión activa. Por favor ingresa tus credenciales.");
            }

            let res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: `[SISTEMA: Cliente verificado y listo para consulta: ${session.user.email}]`,
                    history: [],
                    mode: 'intake',
                    sessionId: activeCid,
                    lawyerId: activeLawyerId,
                    clientUserId: session.user.id,
                    clientEmail: session.user.email,
                    clientName: session.user.user_metadata?.full_name,
                    clientPhone: session.user.user_metadata?.phone
                }),
            });

            // [FRESH START LOGIC] Handle 410 Gone (Inquiry was deleted)
            if (res.status === 410) {
                console.warn("⚠️ CID detected as deleted by server. Initiating Fresh Start...");
                localStorage.removeItem('judic_ia_cid');
                const newCid = crypto.randomUUID();

                // Retry sync with new CID using 'Nuevo cliente registrado' to bypass 410 guard
                res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: `[SISTEMA: Nuevo cliente registrado: ${session.user.email}]`,
                        history: [],
                        mode: 'intake',
                        sessionId: newCid,
                        lawyerId: activeLawyerId,
                        clientUserId: session.user.id,
                        clientEmail: session.user.email,
                        clientName: session.user.user_metadata?.full_name,
                        clientPhone: session.user.user_metadata?.phone
                    }),
                });

                if (res.ok) {
                    router.push(`/consultas/${activeLawyerId}?cid=${newCid}`);
                    return;
                }
            }

            if (!res.ok) {
                const errData = await res.json();
                console.error("❌ Sync failed:", errData);
                throw new Error(errData.error || "Error al sincronizar sesión.");
            }

            console.log("✅ Session synced. Entering chat...");
            router.push(`/consultas/${activeLawyerId}?cid=${activeCid}`);
        } catch (err) {
            console.error("❌ enterIntake Error:", err);
            setError(err.message || "No pudimos preparar tu sesión. Por favor intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (!email || !password) throw new Error("Por favor completa todos los campos.");

            if (isLogin) {
                // LOGIN
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;

                const finalUser = signInData.user;

                // STRICT CHECK
                if (!finalUser.email_confirmed_at) {
                    await supabase.auth.signOut();
                    throw new Error("Email not confirmed");
                }

                const finalCid = cid || crypto.randomUUID();

                if (lawyerId && finalUser) {
                    await fetch("/api/chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            message: `[SISTEMA: Nuevo cliente registrado: ${email}]`,
                            history: [],
                            mode: 'intake',
                            sessionId: finalCid,
                            lawyerId: lawyerId,
                            clientUserId: finalUser.id,
                            clientEmail: email
                        }),
                    });
                }

                if (lawyerId) {
                    setIsConfirmed(true);
                    setConfirmedSession(signInData.session);
                } else {
                    router.push('/');
                }

            } else {
                // REGISTER
                if (email !== confirmEmail) throw new Error("Los correos electrónicos no coinciden.");
                if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
                if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");

                // 🔐 NEW: Check if CID is already claimed by a DIFFERENT email
                if (cid) {
                    const { data: inquiry } = await supabase
                        .from('inquiries')
                        .select('claimed_by_email')
                        .eq('id', cid)
                        .maybeSingle();

                    if (inquiry?.claimed_by_email && inquiry.claimed_by_email !== email.toLowerCase()) {
                        console.warn("🚫 CID already claimed by:", inquiry.claimed_by_email);
                        setCidClaimedByOther(true);
                        throw new Error("Este enlace ya fue utilizado por otro usuario. Contacte a su abogado para obtener un nuevo enlace.");
                    }
                }

                // Use unified callback that detects role and redirects
                const redirectParams = new URLSearchParams();
                if (lawyerId) redirectParams.set('lawyerId', lawyerId);
                if (cid) redirectParams.set('cid', cid);

                // 🔒 FORCE SUBDOMAIN REDIRECT
                // Ensure the email link always brings them back to the CLIENT subdomain, not the main domain.
                const isDev = window.location.hostname.includes('localhost');
                const baseUrl = isDev ? window.location.origin : 'https://consultas.judic-ia.com';
                const fullRedirectUrl = `${baseUrl}/auth/callback?${redirectParams.toString()}`;

                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: fullRedirectUrl,
                        data: {
                            role: 'client' // EXPLICIT ROLE ASSIGNMENT
                        }
                    }
                });
                if (signUpError) throw signUpError;

                // 🔐 NEW: Claim the CID immediately after successful signup
                if (cid) {
                    await supabase
                        .from('inquiries')
                        .update({
                            claimed_by_email: email.toLowerCase(),
                            claimed_at: new Date().toISOString()
                        })
                        .eq('id', cid)
                        .is('claimed_by_email', null); // Only claim if not already claimed
                    console.log("✅ CID claimed by:", email);
                }

                if (data.session) {
                    // Even if session exists, enforce confirmation
                    if (!data.user.email_confirmed_at) {
                        await supabase.auth.signOut();
                        setMessage("¡Cuenta creada! Revisa tu email para confirmar tu cuenta y acceder al chat.");
                        setIsLogin(true);
                        return; // STOP HERE
                    }

                    const finalCid = cid || crypto.randomUUID();
                    const finalUser = data.user;

                    if (lawyerId && finalUser) {
                        await fetch("/api/chat", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                message: `[SISTEMA: Nuevo cliente registrado: ${email}]`,
                                history: [],
                                mode: 'intake',
                                sessionId: finalCid,
                                lawyerId: lawyerId,
                                clientUserId: finalUser.id,
                                clientEmail: email
                            }),
                        });
                        router.push(`/consultas/${lawyerId}?cid=${finalCid}`);
                    } else {
                        router.push('/');
                    }
                } else {
                    setMessage("¡Cuenta creada! Revisa tu email para confirmar tu cuenta y acceder al chat.");
                    setIsLogin(true);
                }
            }

        } catch (err) {
            let msg = err.message;
            if (msg === "Email not confirmed") msg = "El correo electrónico no ha sido confirmado aún. Revisa tu bandeja de entrada.";
            if (msg === "Invalid login credentials") msg = "Credenciales inválidas. Revisa tu email y contraseña.";
            if (msg === "Access denied") msg = "Acceso denegado. Este enlace puede haber expirado o no es válido.";
            if (msg.includes("only request this after")) {
                const seconds = msg.match(/\d+/);
                msg = `Por razones de seguridad, debes esperar ${seconds} segundos antes de reintentar.`;
            }
            if (msg.includes("Signup is disabled")) msg = "El registro está deshabilitado temporalmente.";

            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (validating) {
        return (
            <div className="auth-container">
                <div className="loading-spinner">Verificando seguridad judicial...</div>
                <style jsx>{`
                    .loading-spinner { font-size: 1.2rem; color: #94a3b8; font-style: italic; animation: pulse 2s infinite; }
                    .auth-container { min-height: 100vh; display: flex; justify-content: center; align-items: center; background: #0f172a; }
                    @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
                `}</style>
            </div>
        )
    }

    if (restricted) {
        return (
            <div className="auth-container">
                <div className="auth-card glass-panel restricted-card">
                    <div className="logo-icon-premium error">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <h1>Acceso Restringido</h1>
                    <p>Este enlace de consulta ya no es válido, ha expirado o el acceso ha sido revocado por el profesional.</p>
                    <div className="redirect-hint">
                        Redirigiendo a la página principal en 5 segundos...
                    </div>
                    <button onClick={() => router.push('/?public=true')} className="btn-secondary">Volver Ahora</button>
                </div>
                <style jsx>{`
                    .restricted-card { text-align: center; border-color: rgba(239, 68, 68, 0.3) !important; }
                    .restricted-card h1 { color: #fca5a5; margin-bottom: 1rem; }
                    .redirect-hint { margin: 2rem 0; font-size: 0.85rem; color: #94a3b8; font-style: italic; }
                    .btn-secondary { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 0.8rem 1.5rem; border-radius: 10px; cursor: pointer; }
                `}</style>
            </div>
        )
    }

    return (
        <div className="auth-container">
            <div className="auth-card glass-panel">
                {isConfirmed ? (
                    <div className="confirmed-ui" style={{ textAlign: 'center', padding: '1rem 0' }}>
                        <div className="success-icon-premium">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <h1 style={{
                            fontSize: '2.2rem',
                            color: '#fbbf24',
                            marginBottom: '1rem',
                            fontFamily: "'Playfair Display', serif",
                            fontWeight: '800'
                        }}>¡Bienvenido!</h1>
                        <p style={{ color: '#cbd5e1', marginBottom: '2.5rem', lineHeight: '1.6', fontSize: '1.05rem' }}>
                            Tu sesión jurídica está <span style={{ color: '#fbbf24', fontWeight: '600' }}>activa y verificada</span>.
                        </p>
                        <button onClick={enterIntake} className="btn-primary" disabled={loading} style={{ padding: '1.2rem' }}>
                            {loading ? 'Preparando Consulta...' : 'Continuar a Consulta'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="auth-header">
                            <div className="logo-icon-premium">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v11z"></path><path d="M21 7l-5 3v4l5 3V7z"></path></svg>
                            </div>
                            <h1>{isLogin ? 'Ingresar a Consulta' : 'Proteger Consulta'}</h1>
                            <p>
                                {isLogin
                                    ? 'Ingresa tu clave para ver el estado de tu caso.'
                                    : 'Establece una clave temporal para proteger tu privacidad y documentos.'}
                            </p>
                        </div>

                        <form onSubmit={handleAuth} className="auth-form">
                            <div className="input-group">
                                <label>Tu Email (para notificaciones)</label>
                                <input
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            {!isLogin && (
                                <div className="input-group">
                                    <label>Confirmar Email</label>
                                    <input
                                        type="email"
                                        placeholder="Repite tu email"
                                        value={confirmEmail}
                                        onChange={(e) => setConfirmEmail(e.target.value)}
                                        required
                                        style={{ borderColor: (confirmEmail && email !== confirmEmail) ? '#ef4444' : '' }}
                                    />
                                    {confirmEmail && email !== confirmEmail && (
                                        <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: '0.3rem' }}>No coinciden</div>
                                    )}
                                </div>
                            )}

                            <div className="input-group">
                                <label>Crear Clave de Acceso</label>
                                <input
                                    type="password"
                                    placeholder="••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            {!isLogin && (
                                <div className="input-group">
                                    <label>Repetir Clave</label>
                                    <input
                                        type="password"
                                        placeholder="••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            )}

                            {error && <div className="error-msg">⚠️ {error}</div>}
                            {message && <div className="success-msg">✅ {message}</div>}

                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Procesando...' : (isLogin ? 'Ingresar al Chat' : 'Comenzar Consulta Segura')}
                            </button>
                        </form>

                        <div className="auth-footer">
                            {!isLogin ? (
                                <p>
                                    ¿Ya tienes una clave?
                                    <button type="button" onClick={() => setIsLogin(true)} className="link-btn">
                                        Ingresar
                                    </button>
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        ¿Olvidaste tu clave?
                                    </p>

                                    <p style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.8rem' }}>
                                        ¿Aún no tienes una clave? <span style={{ color: '#fbbf24' }}>Solicita el enlace de acceso a tu abogado profesional.</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <style jsx>{`
                .auth-container {
                    min-height: 100vh;
                    display: flex; justify-content: center; align-items: center;
                    background: radial-gradient(circle at 50% 10%, #1e293b, #0f172a);
                    color: white; padding: 1rem;
                }
                .auth-card {
                    width: 100%; max-width: 420px;
                    padding: 2.5rem;
                    border-radius: 20px;
                    background: rgba(30, 41, 59, 0.6);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .auth-header { text-align: center; margin-bottom: 2rem; }
                .logo-icon { font-size: 3rem; margin-bottom: 1rem; }
                .auth-header h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem; }
                .auth-header p { color: #94a3b8; font-size: 0.95rem; }

                .input-group { margin-bottom: 1.5rem; text-align: left; }
                .input-group label { display: block; font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem; font-weight: 500; }
                .input-group input {
                    width: 100%; padding: 0.8rem 1rem;
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px; color: white;
                    transition: 0.2s;
                }
                .input-group input:focus { outline: none; border-color: #fbbf24; box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.2); }

                .btn-primary {
                    width: 100%; padding: 0.9rem;
                    background: linear-gradient(135deg, #fbbf24, #d97706);
                    color: #0f172a; border: none; font-weight: 700;
                    border-radius: 10px; cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(251, 191, 36, 0.3); }
                .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

                .error-msg { background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 0.8rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem; text-align: center; }
                .success-msg { background: rgba(34, 197, 94, 0.2); color: #86efac; padding: 0.8rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem; text-align: center; }

                .auth-footer { margin-top: 2rem; text-align: center; font-size: 0.9rem; color: #94a3b8; }
                .link-btn { background: none; border: none; color: #fbbf24; font-weight: 600; cursor: pointer; margin-left: 0.5rem; text-decoration: underline; }
                .link-btn:hover { color: #f59e0b; }

                /* Premium Success & Error Icons */
                .success-icon-premium, .logo-icon-premium {
                    width: 70px; height: 70px;
                    background: #22c55e;
                    color: white;
                    border-radius: 20px;
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 1.5rem;
                    box-shadow: 0 10px 20px rgba(34, 197, 94, 0.3);
                }
                .logo-icon-premium {
                    background: rgba(251, 191, 36, 0.1);
                    color: #fbbf24;
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
                }
                .logo-icon-premium.error {
                    background: rgba(239, 68, 68, 0.1);
                    color: #fca5a5;
                    border-color: rgba(239, 68, 68, 0.3);
                }
            `}</style>
        </div>
    );
}
