"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import ChatWidget from '../../components/ChatWidget';
import styles from '../../page.module.css'; // Reusing landing page styles for consistency
import { useSearchParams, useRouter } from 'next/navigation';

export default function IntakeClient({ id }) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [lawyer, setLawyer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function checkAuthAndFetchLawyer() {
            if (!id) return;

            // 1. AUTH PROTECTION
            const cid = searchParams.get('cid');

            // Implementation: Check Session
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // If not logged in, REDIRECT to Auth
                console.log("🔒 Usuario no autenticado. Redirigiendo a Login...");
                const redirectUrl = `/consultas/auth?lawyerId=${id}${cid ? `&cid=${cid}` : ''}`;
                router.push(redirectUrl);
                return; // Stop execution
            }

            console.log("🔓 Usuario autenticado:", session.user.email);

            // 2. FETCH LAWYER PROFILE
            console.log("🔍 Buscando abogado con ID:", id); // DEBUG

            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, especialidades, matricula')
                .eq('id', id)
                .single();

            if (error) {
                console.error("❌ Error fetching lawyer full object:", JSON.stringify(error, null, 2)); // DEBUG
                if (error.code === 'PGRST116') {
                    setError(`Perfil no encontrado o privado (ID: ${id}). Verifica RLS.`);
                } else {
                    setError(`Error técnico: ${error.message || JSON.stringify(error)}`);
                }
            } else {
                setLawyer(data);
            }
            setLoading(false);
        }
        checkAuthAndFetchLawyer();
    }, [id, searchParams, router]);

    if (loading) return <div className="loading-screen">Cargando asistente...</div>;
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
                        <div className="avatar-lg">{lawyer.full_name?.charAt(0) || 'D'}</div>
                        <h1 className="lawyer-name">{lawyer.full_name || 'Estudio Jurídico'}</h1>
                        <span className="lawyer-badge">{lawyer.especialidades?.join(' • ') || 'Derecho General'}</span>

                        <div className="welcome-text">
                            <p>👋 <strong>Hola.</strong></p>
                            <p>Soy el asistente virtual del estudio. Estoy aquí para tomar los datos de tu caso de forma segura y confidencial.</p>
                            <p style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.7 }}>
                                🔒 Tus datos están protegidos
                            </p>
                        </div>

                        {/* User Session Info */}
                        <div className="user-session">
                            <div className="session-info">
                                <span className="status-dot"></span>
                                <span className="user-email">{lawyer.currentUserEmail || 'Cliente Verificado'}</span>
                            </div>
                            <button onClick={async () => {
                                await supabase.auth.signOut();
                                router.push(`/consultas/auth?lawyerId=${id}`);
                            }} className="logout-btn-mini">
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>

                    {/* Right: The Chat */}
                    <div className="chat-side">
                        <ChatWidget
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
                height: 100vh; display: flex; align-items: center; justify-content: center;
            background: #020617; color: white; font-family: sans-serif;
        }
            .main {
                background - color: #020617;
            background-image:
            radial-gradient(circle at 10% 20%, rgba(197, 160, 33, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(56, 189, 248, 0.05) 0%, transparent 40%);
            min-height: 100vh;
        }
            .intake-container {
                min - height: 100vh;
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
        }

            .lawyer-name {font - size: 1.8rem; color: white; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
            .lawyer-badge {
                background: rgba(251, 191, 36, 0.1); color: #fbbf24;
            padding: 0.3rem 0.8rem; border-radius: 99px; font-size: 0.85rem; font-weight: 600;
            margin-bottom: 2rem; border: 1px solid rgba(251, 191, 36, 0.2);
        }

            .welcome-text {color: #94a3b8; line-height: 1.6; font-size: 0.95rem; }

            /* Right Side: Chat Interface */
            .chat-side {
                flex: 1;
            display: flex;
            flex-direction: column;
            background: rgba(30, 41, 59, 0.2);
        }

            /* Mobile Responsive */
            @media (max-width: 768px) {
            .unified - card {flex - direction: column; height: auto; min-height: 90vh; }
            .lawyer-side {width: 100%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 2rem; }
            .chat-side {height: 600px; }
            .avatar-lg {width: 80px; height: 80px; font-size: 2rem; border-radius: 25px; }
        }

            /* Reuse glass styles */
            .glass-navbar {
                position: fixed; top: 1.5rem; left: 50%; transform: translateX(-50%);
            width: 90%; max-width: 1100px; display: flex;
            align-items: center; padding: 0.8rem 2rem; z-index: 100; borderRadius: 99px;
            background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1);
        }
            .nav-brand {display: flex; align-items: center; gap: 0.8rem; }
            .nav-logo {width: 35px; }
            .nav-title {font - weight: 800; font-size: 1.2rem; color: white; }

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
        </main >
    );
}
