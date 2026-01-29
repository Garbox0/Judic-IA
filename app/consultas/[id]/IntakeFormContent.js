"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import SafeChatWidget from '../../components/SafeChatWidget';
import './IntakeFormContent.css';

export default function IntakeFormContent({ id }) {
    // ...
    // Skipping imports to keep it clean, just adding the import line
}
// Actually, I should just modify the top imports and the main tag separately or in one go if I can see them.
// I'll do two edits. One for imports, one for the main tag and removing style block.

import { useSearchParams, useRouter } from 'next/navigation';
import './IntakeFormContent.css';

export default function IntakeFormContent({ id }) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [lawyer, setLawyer] = useState(null);
    const [clientEmail, setClientEmail] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientUserId, setClientUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [restricted, setRestricted] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false); // New state for Zombie UI

    useEffect(() => {
        async function checkAuthAndFetchLawyer() {
            if (!id) return;

            const cid = searchParams.get('cid');

            // 1. CID REVOCATION CHECK (The Kill Switch)
            if (cid) {
                const { data: isRevoked } = await supabase
                    .from('revoked_access')
                    .select('id')
                    .eq('id', cid)
                    .maybeSingle();

                if (isRevoked) {
                    console.warn("🚫 BLOCKED: This CID is in the blacklist.");
                    setRestricted(true);
                    setLoading(false);
                    return;
                }
            }

            // 2. AUTH PROTECTION
            console.log("🔍 Checking auth status...");
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                console.log("🔒 Usuario no autenticado o sesión inválida. Error:", authError);
                const redirectUrl = `/consultas/auth?lawyerId=${id}${cid ? `&cid=${cid}` : ''}`;
                router.push(redirectUrl);
                return;
            }

            setClientEmail(user.email);
            setClientUserId(user.id);
            setClientName(user.user_metadata?.full_name || '');
            setClientPhone(user.user_metadata?.phone || '');
            console.log("🔓 Usuario autenticado:", user.email, user.id, "Metadata:", user.user_metadata);

            // 3. STRICT RELATIONSHIP CHECK (The "Zombie" Fix)
            console.log("🔍 Fetching inquiry data for:", {
                lawyerId: id,
                userId: user.id,
                email: user.email
            });

            const { data: inquiryRows, error: inquiryError } = await supabase
                .from('inquiries')
                .select('id, status')
                .eq('assigned_lawyer_id', id)
                .or(`client_auth_id.eq.${user.id},contact_email.eq.${user.email}`)
                .order('created_at', { ascending: false })
                .limit(1);

            const inquiryData = inquiryRows?.[0];

            if (inquiryError) {
                console.error("❌ Inquiry fetch error (Detailed):", {
                    message: inquiryError.message,
                    code: inquiryError.code,
                    details: inquiryError.details,
                    hint: inquiryError.hint,
                    raw: inquiryError
                });
                setError(`Error al verificar acceso: ${inquiryError.message || 'Error desconocido de base de datos'}`);
                setLoading(false);
                return;
            }

            if (!inquiryData) {
                console.log("⚠️ No inquiry found yet...");
                const isNewUser = (new Date() - new Date(user.created_at)) < 30000;

                if (!isNewUser) {
                    console.warn("💀 ZOMBIE DETECTED: Inquiry missing for old user.");
                    setLawyer({ full_name: 'el estudio' });
                    setIsDeleted(true);
                    setTimeout(async () => {
                        await supabase.auth.signOut();
                        window.location.href = "/";
                    }, 5000);
                    return;
                } else {
                    // RETRY LOGIC (Max 5 times)
                    const retries = parseInt(sessionStorage.getItem('intake_retries') || '0');
                    if (retries < 5) {
                        console.log(`⏳ Retry ${retries + 1}/5. Waiting for sync...`);
                        sessionStorage.setItem('intake_retries', (retries + 1).toString());
                        setTimeout(checkAuthAndFetchLawyer, 3000);
                        return;
                    } else {
                        console.error("❌ TIMEOUT: Inquiry sync failed after 5 retries.");
                        setError("No pudimos sincronizar tu sesión de consulta. Por favor, intenta entrar de nuevo desde el link enviado.");
                        setLoading(false);
                        sessionStorage.removeItem('intake_retries');
                        return;
                    }
                }
            }
            sessionStorage.removeItem('intake_retries');
            console.log("✅ Inquiry found:", inquiryData.id);

            // 4. REALTIME KILL SWITCH
            // Listen for deletion of MY inquiry
            const channel = supabase.channel(`access-guard-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'DELETE',
                        schema: 'public',
                        table: 'inquiries',
                        filter: `id=eq.${inquiryData.id}`  // Listen specifically for THIS case
                    },
                    (payload) => {
                        console.warn("🚫 REALTIME ACCESS REVOKED: Inquiry deleted by lawyer.");
                        setIsDeleted(true);
                    }
                )
                .subscribe();


            // 5. FETCH LAWYER PROFILE
            if (!id) return;
            const { data: lawyerData, error: lawyerError } = await supabase
                .from('profiles')
                .select('full_name, especialidades, matricula, avatar_url')
                .eq('id', id)
                .maybeSingle();

            if (lawyerError) {
                console.warn("⚠️ Error fetching lawyer profile:", lawyerError);
                setError(`Error técnico al cargar el perfil. Código: ${lawyerError.code}`);
            } else if (!lawyerData) {
                console.warn("⚠️ Lawyer profile not found for ID:", id);
                setError("El perfil del profesional no se encuentra disponible. Es posible que el enlace sea antiguo o incorrecto.");
            } else {
                setLawyer(lawyerData);
            }
            setLoading(false);

            // 6. ROBUST POLLING (BACKUP FOR REALTIME)
            // Polling every 4 seconds ensures that if Realtime misses the DELETE event (common with RLS),
            // we typically catch it within seconds regardless.
            const zombieInterval = setInterval(async () => {
                if (!inquiryData?.id) return;

                const { error: checkError } = await supabase
                    .from('inquiries')
                    .select('id')
                    .eq('id', inquiryData.id)
                    .single(); // Will throw error if not found

                if (checkError) {
                    // Logic: If error is "PGRST116" (not found), it's deleted.
                    console.warn("💀 POLLING DETECTED ZOMBIE: Inquiry gone.");
                    setIsDeleted(true);
                    clearInterval(zombieInterval);

                    // Force a harder exit
                    setTimeout(async () => {
                        await supabase.auth.signOut();
                        window.location.href = "/";
                    }, 5000);
                }
            }, 4000);

            return () => {
                supabase.removeChannel(channel);
                clearInterval(zombieInterval);
            };
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

    // New ZOMBIE UI
    if (isDeleted) {
        return (
            <div className="error-screen">
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '450px', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(15,23,42,0.9)' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🚫</div>
                    <h2 style={{ color: '#fbbf24', marginBottom: '1.5rem', fontFamily: 'Playfair Display, serif' }}>Acceso Revocado</h2>
                    <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: '1.6' }}>
                        Usted ya no forma parte de la cartera de clientes de <strong style={{ color: 'white' }}>{lawyer?.full_name || 'este abogado'}</strong>.
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '1rem' }}>
                        Su expediente ha sido cerrado.
                    </p>
                    <div style={{ marginTop: '2.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                        Será redirigido al inicio en 5 segundos...
                    </div>
                </div>
            </div>
        )
    }

    if (error) return <div className="error-screen">⚠️ {error}</div>;

    async function handleLogout() {
        await supabase.auth.signOut();
        // Redirect explicitly to login to avoid potential loops or wrong redirects
        window.location.href = '/auth/login';
    }

    return (
        <main className={`${styles.main} intake-main`}>
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

                        {/* NEW: USER SESSION FOOTER */}
                        {clientEmail && (
                            <div className="user-session">
                                <div className="session-info">
                                    <div className="status-dot"></div>
                                    <span>{clientEmail}</span>
                                </div>
                                <button onClick={handleLogout} className="logout-btn-mini">
                                    Cerrar Sesión
                                </button>
                            </div>
                        )}


                    </div>

                    {/* Right: The Chat */}
                    <div className="chat-side">
                        <SafeChatWidget
                            mode="intake"
                            lawyerId={id}
                            embedded={true}
                            initialMessage={`Bienvenido. Cuénteme brevemente su situación legal para poder ayudarle.`}
                            clientEmail={clientEmail}
                            clientUserId={clientUserId}
                            clientName={clientName}
                            clientPhone={clientPhone}
                            lawyerSpecialties={lawyer?.especialidades || []}
                        />
                    </div>
                </div>
            </section>


        </main>
    );
}
