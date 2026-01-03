"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import SafeChatWidget from '../../components/SafeChatWidget';
import styles from '../../page.module.css';
import { useSearchParams, useRouter } from 'next/navigation';

export default function IntakeFormContent({ id }) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [lawyer, setLawyer] = useState(null);
    const [clientEmail, setClientEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [restricted, setRestricted] = useState(false);

    useEffect(() => {
        async function checkAuthAndFetchLawyer() {
            if (!id) return;

            const cid = searchParams.get('cid');

            // 1. CID VALIDATION REMOVED
            // We allow entry to the gatekeeper (Auth) for any link. 
            // If the link is truly invalid, it will fail to load profile/chat later.
            // This prevents "Restricted Access" for valid new links.

            // 2. AUTH PROTECTION
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                console.log("🔒 Usuario no autenticado o sesión inválida. Redirigiendo a Login...");
                const redirectUrl = `/consultas/auth?lawyerId=${id}${cid ? `&cid=${cid}` : ''}`;
                router.push(redirectUrl);
                return;
            }

            setClientEmail(user.email);
            console.log("🔓 Usuario autenticado:", user.email);

            // 3. FETCH LAWYER PROFILE
            if (!id) return;
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, especialidades, matricula, avatar_url')
                .eq('id', id)
                .single();

            if (error) {
                console.warn("⚠️ No se pudo cargar el perfil del abogado:", error.message);
                if (error.code === 'PGRST116') {
                    setError(`Perfil del abogado no encontrado (ID: ${id}).`);
                } else {
                    setError(`Error de Acceso (RLS): No se pudo cargar el perfil. Por favor, ejecuta el script SQL de corrección de RLS.`);
                }
            } else {
                setLawyer(data);
            }
            setLoading(false);
        }
        checkAuthAndFetchLawyer();
    }, [id, searchParams, router]);

    // Redirect out if restricted
    useEffect(() => {
        if (restricted) {
            const timer = setTimeout(() => {
                router.push('/');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [restricted, router]);

    if (loading) return <div className="loading-screen">Cargando asistente...</div>;

    if (restricted) {
        return (
            <div className="error-screen">
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔒</div>
                    <h2 style={{ color: '#fca5a5', marginBottom: '1rem' }}>Acceso Restringido</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6' }}>
                        Este acceso ha expirado o el abogado ha revocado el permiso para este caso específico.
                    </p>
                    <p style={{ marginTop: '2rem', fontSize: '0.75rem', opacity: 0.5 }}>Redirigiendo fuera...</p>
                </div>
            </div>
        )
    }

    if (error) return <div className="error-screen">⚠️ {error}</div>;

    return (
        <main className={styles.main}>
            {/* Navbar Minimal */}
            <nav className="glass-navbar" style={{ justifyContent: 'center' }}>
                <div className="nav-brand">
                    <img src="/logo.png" alt="Logo" className="nav-logo" />
                    <span className="nav-title">Judic-IA Intake</span>
                </div>
            </nav>

            <section className="intake-container">
                <div className="unified-card">
                    {/* Left: Lawyer Identity */}
                    <div className="lawyer-side">
                        <div className={`avatar-lg ${lawyer.avatar_url ? 'has-image' : ''}`}>
                            {lawyer.avatar_url ? (
                                <img src={lawyer.avatar_url} alt={lawyer.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                lawyer.full_name?.charAt(0) || 'D'
                            )}
                        </div>
                        <h1 className="lawyer-name">{lawyer.full_name || 'Tu Abogado'}</h1>
                        {lawyer.matricula && (
                            <span className="lawyer-matricula" style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'block' }}>
                                Matrícula: {lawyer.matricula}
                            </span>
                        )}

                        <div className="welcome-text">
                            <p>👋 <strong>Hola.</strong></p>
                            <p>Soy el asistente virtual del estudio. Estoy aquí para tomar los datos de tu caso de forma segura y confidencial.</p>
                            <p style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.7 }}>
                                🔒 Tus datos están protegidos
                            </p>
                        </div>


                    </div>

                    {/* Right: The Chat */}
                    <div className="chat-side">
                        <SafeChatWidget
                            mode="intake"
                            lawyerId={id}
                            embedded={true}
                            initialMessage={`Bienvenido. Cuénteme brevemente su situación legal para poder ayudarle.`}
                        />
                    </div>
                </div>
            </section>

            <style jsx>{`
            .loading-screen, .error-screen {
                position: fixed; top: 0; left: 0; width: 100vw;
                height: 100vh; display: flex; align-items: center; justify-content: center;
                background: #020617; color: white; font-family: sans-serif;
                z-index: 9999;
            }
            .main {
                background-color: #020617;
                background-image:
                radial-gradient(circle at 10% 20%, rgba(197, 160, 33, 0.05) 0%, transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(56, 189, 248, 0.05) 0%, transparent 40%);
                min-height: 100vh;
            }
            .intake-container {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 6rem 1rem 2rem;
            }

            /* Unified Glass Panel */
            .unified-card {
                width: 100%;
                max-width: 900px;
                height: 80vh; /* Fixed height for chat feel */
                max-height: 800px;
                display: flex;
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(255,255,255,0.05);
                backdrop-filter: blur(20px);
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }

            /* Left Side: Lawyer Info */
            .lawyer-side {
                width: 350px;
                background: rgba(15, 23, 42, 0.4);
                border-right: 1px solid rgba(255,255,255,0.05);
                padding: 3rem 2rem;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
            }

            .avatar-lg {
                width: 120px; height: 120px;
                background: linear-gradient(135deg, #fbbf24, #b45309);
                color: white; font-size: 3rem; font-weight: 800;
                display: flex; align-items: center; justify-content: center;
                border-radius: 40px;
                margin-bottom: 1.5rem;
                box-shadow: 0 10px 30px -10px rgba(251, 191, 36, 0.5);
                border: 2px solid rgba(255,255,255,0.1);
                overflow: hidden;
            }
            .avatar-lg.has-image { background: transparent; border-color: #fbbf24; }

            .lawyer-name { font-size: 1.8rem; color: white; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
            .lawyer-badge {
                background: rgba(251, 191, 36, 0.1); color: #fbbf24;
                padding: 0.3rem 0.8rem; border-radius: 99px; font-size: 0.85rem; font-weight: 600;
                margin-bottom: 2rem; border: 1px solid rgba(251, 191, 36, 0.2);
            }

            .welcome-text { color: #94a3b8; line-height: 1.6; font-size: 0.95rem; }

            /* Right Side: Chat Interface */
            .chat-side {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: rgba(30, 41, 59, 0.2);
            }

            /* Mobile Responsive */
            @media (max-width: 768px) {
                .unified-card { flex-direction: column; height: auto; min-height: 90vh; }
                .lawyer-side { width: 100%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 2rem; }
                .chat-side { height: 600px; }
                .avatar-lg { width: 80px; height: 80px; font-size: 2rem; border-radius: 25px; }
            }

            /* Reuse glass styles */
            .glass-navbar {
                position: fixed; top: 1.5rem; left: 50%; transform: translateX(-50%);
                width: 90%; max-width: 1100px; display: flex;
                align-items: center; padding: 0.8rem 2rem; z-index: 100; borderRadius: 99px;
                background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1);
            }
            .nav-brand { display: flex; align-items: center; gap: 0.8rem; }
            .nav-logo { width: 35px; }
            .nav-title { font-weight: 800; font-size: 1.2rem; color: white; }

            /* User Session Footer */
            .user-session {
                margin-top: auto; 
                width: 100%;
                padding-top: 2rem;
                display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
            .session-info { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #94a3b8; }
            .status-dot { width: 8px; height: 8px; background: #4ade80; borderRadius: 50%; box-shadow: 0 0 10px #4ade80; }
            .logout-btn-mini {
                background: none; border: none; color: #fbbf24; font-size: 0.8rem; 
                cursor: pointer; opacity: 0.8; transition: 0.2s; text-decoration: underline;
            }
            .logout-btn-mini:hover { opacity: 1; color: #ef4444; }
      `}</style>
        </main>
    );
}
