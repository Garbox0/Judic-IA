"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import AvatarEditor from './AvatarEditor';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { CONTACT_CHANNELS, buildMailto } from '../../lib/contact-channels';
import '../../globals.css';

const SPECIALTIES_OPTIONS = [
    'Derecho Administrativo', 'Derecho Ambiental', 'Derecho Bancario',
    'Derecho Civil', 'Derecho Comercial', 'Daños y Perjuicios',
    'Derecho Empresario', 'Familia', 'Derecho Fiscal',
    'Derecho Informático', 'Derecho Internacional', 'Derecho Laboral',
    'Marcas y Patentes', 'Mediación y Arbitraje', 'Derecho Militar',
    'Derecho Penal', 'Derecho Real'
];

export default function SettingsPage() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('profile');

    // Sync tab with URL on mount and whenever searchParams change
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['profile', 'security', 'billing', 'support'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const handleTabChange = (tabName) => {
        setActiveTab(tabName);
        // Update URL without full refresh for better UX and deep linking
        window.history.pushState(null, '', `?tab=${tabName}`);
    };
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [paymentPending, setPaymentPending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [user, setUser] = useState(null);
    // Editor State
    const [editorOpen, setEditorOpen] = useState(false);
    const [tempImageSrc, setTempImageSrc] = useState(null);
    const [pendingAvatarBlob, setPendingAvatarBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    const [formData, setFormData] = useState({
        full_name: '',
        especialidades: [],
        matricula: '',
        tomo: '',
        folio: '',
        jurisdiccion: '',
        biography: '',
        phone: '',
        avatar_url: '',
        plan_tier: 'starter',
        subscription_status: 'inactive',
        subscription_expiry: null
    });

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (data) {
                    let t = '', f = '';
                    if (data.matricula) {
                        const match = data.matricula.match(/T°?\s*(\d+)\s*F°?\s*(\d+)/i);
                        if (match) { t = match[1]; f = match[2]; } else { t = data.matricula; }
                    }
                    setFormData({
                        full_name: data.full_name || '',
                        especialidades: Array.isArray(data.especialidades) ? data.especialidades : [],
                        matricula: data.matricula || '',
                        tomo: t, folio: f,
                        jurisdiccion: data.jurisdiccion || '',
                        biography: data.biography || '',
                        phone: data.phone || '',
                        avatar_url: data.avatar_url || '',
                        plan_tier: data.plan_tier || 'starter',
                        subscription_status: data.subscription_status || 'inactive',
                        subscription_expiry: data.subscription_expiry || null
                    });
                }
            }
            setLoading(false);
        };

        // Detect payment success from URL
        const status = searchParams.get('status');
        if (status === 'success') {
            toast.success("🎉 ¡Pago acreditado con éxito! Tu cuenta se está actualizando.");
            // Remove the status from URL to prevent multiple alerts
            window.history.replaceState(null, '', '/dashboard/settings?tab=billing');
            fetchProfile(); // Refresh profile to show new plan
        } else {
            fetchProfile();
        }
    }, [searchParams]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleSpecialty = (spec) => {
        setFormData(prev => {
            const current = prev.especialidades;
            const newSpecs = current.includes(spec) ? current.filter(s => s !== spec) : [...current, spec];
            return { ...prev, especialidades: newSpecs };
        });
    };

    // DROPZONE & EDITOR LOGIC
    const onDrop = useCallback((acceptedFiles) => {
        const file = acceptedFiles[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setTempImageSrc(reader.result);
                setEditorOpen(true);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        multiple: false,
        noClick: true
    });

    const handleEditCurrent = async () => {
        const src = previewUrl || formData.avatar_url;
        if (src) {
            // If it's already a blob URL (local preview), use it directly
            if (src.startsWith('blob:')) {
                setTempImageSrc(src);
                setEditorOpen(true);
                return;
            }

            // If it's a remote URL, fetch it first to avoid CORS canvas tainting
            try {
                const response = await fetch(src);
                if (!response.ok) throw new Error(`Status: ${response.status}`);

                const blob = await response.blob();

                if (blob.size === 0) throw new Error("Imagen vacía");

                toast.dismiss();

                const objectUrl = URL.createObjectURL(blob);
                setTempImageSrc(objectUrl);
                setEditorOpen(true);
            } catch (error) {
                console.error("Error downloading image for editing:", error);
                toast.error(`No se pudo cargar la imagen original (${error.message}). Intenta subir una nueva.`);
            }
        }
    };

    const handleEditorSave = async (croppedBlob) => {
        setEditorOpen(false);
        setPendingAvatarBlob(croppedBlob);
        const localUrl = URL.createObjectURL(croppedBlob);
        setPreviewUrl(localUrl);
        toast.info("📷 Foto lista. Guardá el perfil para aplicar.");
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            let avatarUrlToSave = formData.avatar_url;

            if (pendingAvatarBlob) {
                const fileExt = 'jpg';
                const filePath = `avatars/${user.id}-${Math.random()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, pendingAvatarBlob);
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
                avatarUrlToSave = publicUrl;

                if (previewUrl) URL.revokeObjectURL(previewUrl);
            }

            const updates = {
                avatar_url: avatarUrlToSave,
                full_name: formData.full_name,
                biography: formData.biography,
                jurisdiccion: formData.jurisdiccion,
                especialidades: formData.especialidades,
                // Removed updated_at as it doesn't exist in schema
            };

            const { data: updateData, error: updateError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id)
                .select();

            if (updateError) throw updateError;

            if (!updateData || updateData.length === 0) {
                throw new Error("No se pudo actualizar el perfil (ID no encontrado o sin permisos).");
            }

            setFormData(prev => ({ ...prev, avatar_url: avatarUrlToSave }));
            setPendingAvatarBlob(null);
            setPreviewUrl(null);

            toast.success("✅ Perfil guardado con éxito");
        } catch (error) {
            console.error("Full Save Error:", JSON.stringify(error, null, 2), error);
            const msg = error.message || error.details || "Error al guardar perfil";
            toast.error("❌ " + msg);
        } finally {
            setSaving(false);
        }
    };


    const handleSaveSecurity = async () => {
        setSaving(true);
        try {
            const updates = { phone: formData.phone };
            const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
            if (error) throw error;
            toast.success("✅ Datos de seguridad actualizados.");
        } catch (error) {
            toast.error("❌ Alerta: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Realtime Payment Listener
    useEffect(() => {
        if (!user) return;

        console.log("🔌 Conectando listener de pagos para:", user.id);
        const channel = supabase
            .channel('profile_changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                },
                (payload) => {
                    console.log("🔔 Cambio detectado en perfil:", payload.new);
                    if (payload.new.plan_tier === 'professional' && payload.new.subscription_status === 'active') {
                        setFormData(prev => ({
                            ...prev,
                            plan_tier: payload.new.plan_tier,
                            subscription_status: payload.new.subscription_status,
                            subscription_expiry: payload.new.subscription_expiry
                        }));
                        setPaymentPending(false);
                        setSaving(false);
                        toast.success("🎉 ¡Pago confirmado! Tu suscripción Profesional está activa.");
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const handleSaveBilling = async () => {
        setSaving(true);
        setPaymentPending(true); // UI State: Esperando...

        try {
            // Utilizar el endpoint del servidor
            const response = await fetch('/api/mp/subscription/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = typeof data.error === 'object'
                    ? JSON.stringify(data.error, null, 2)
                    : (data.error || 'Error al iniciar suscripción');
                throw new Error(errorMsg);
            }

            if (data.init_point) {
                console.log("🔗 Abriendo Mercado Pago en nueva pestaña:", data.init_point);
                // Abrir en nueva pestaña
                const paymentWindow = window.open(data.init_point, '_blank');

                // Detectar cuando se cierra la ventana
                const pollTimer = setInterval(() => {
                    if (paymentWindow && paymentWindow.closed) {
                        clearInterval(pollTimer);
                        console.log("❌ Ventana de pago cerrada por el usuario.");
                        setPaymentPending(false);
                        setSaving(false); // <--- FIX: También liberar el estado de carga
                    }
                }, 1000);
            } else {
                throw new Error("No se recibió link de pago.");
            }

        } catch (error) {
            console.error("Subscription Error:", error);
            toast.error("❌ Error al procesar: " + error.message);
            setSaving(false);
            setPaymentPending(false);
        }
    };

    if (loading) return <div style={{ background: '#020617', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>Cargando Gabinete...</div>;

    return (
        <div className="stg-root">
            <Toaster position="bottom-right" theme="dark" richColors />
            {editorOpen && tempImageSrc && (
                <AvatarEditor
                    imageSrc={tempImageSrc}
                    onCancel={() => setEditorOpen(false)}
                    onSave={handleEditorSave}
                />
            )}
            <div className="stg-container">
                <nav className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Ajustes</span>
                </nav>
                <h1 className="dashboard-page-title">Configuración Profesional ⚖️</h1>

                <div className="stg-layout-split">
                    {/* Sidebar de Ajustes (Interno) */}
                    <aside className="stg-tabs-nav">
                        <button className={`stg-tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => handleTabChange('profile')}>
                            👤 Perfil Profesional
                        </button>
                        <button className={`stg-tab-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => handleTabChange('security')}>
                            🛡️ Seguridad
                        </button>
                        <button className={`stg-tab-btn ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => handleTabChange('billing')}>
                            💳 Facturación
                        </button>
                        <button className={`stg-tab-btn ${activeTab === 'support' ? 'active' : ''}`} onClick={() => handleTabChange('support')}>
                            🧩 Soporte y Ayuda
                        </button>
                    </aside>

                    {/* Contenido Principal */}
                    <main className="stg-main-content">
                        {activeTab === 'profile' && (
                            <div className="stg-tab-pane">
                                <div className="stg-profile-header">
                                    <div className="stg-photo-col">
                                        <label className="stg-label">Imagen 4x4</label>

                                        <div {...getRootProps()} className={`stg-avatar-box ${isDragActive ? 'drag-active' : ''}`}>
                                            <input {...getInputProps()} />
                                            {(previewUrl || formData.avatar_url) ? (
                                                <img src={previewUrl || formData.avatar_url} alt="Profile" />
                                            ) : (
                                                <div className="stg-placeholder">
                                                    {isDragActive ? "Soltar" : <>📷</>}
                                                </div>
                                            )}
                                            {uploading && <div className="stg-loader-overlay">...</div>}
                                        </div>

                                        <div className="stg-avatar-actions">
                                            <button
                                                className="stg-mini-btn"
                                                onClick={handleEditCurrent}
                                                disabled={!(previewUrl || formData.avatar_url)}
                                            >
                                                ✏️ Editar
                                            </button>
                                            <button
                                                className="stg-mini-btn primary"
                                                onClick={open}
                                            >
                                                📷 Subir
                                            </button>
                                        </div>
                                    </div>
                                    <div className="stg-fields-col">
                                        <div className="stg-field-row">
                                            <div className="stg-f-group">
                                                <label className="stg-label">Nombre Completo</label>
                                                <input name="full_name" className="stg-dark-input readonly" value={formData.full_name} readOnly disabled />
                                            </div>
                                        </div>
                                        <div className="stg-field-row multi">
                                            <div className="stg-f-group flex-2">
                                                <label className="stg-label">Colegio / Jurisdicción</label>
                                                <input name="jurisdiccion" className="stg-dark-input readonly" value={formData.jurisdiccion} readOnly disabled />
                                            </div>
                                            <div className="stg-f-group flex-1">
                                                <label className="stg-label">Tomo</label>
                                                <input className="stg-dark-input readonly" value={formData.tomo} readOnly disabled />
                                            </div>
                                            <div className="stg-f-group flex-1">
                                                <label className="stg-label">Folio</label>
                                                <input className="stg-dark-input readonly" value={formData.folio} readOnly disabled />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="stg-f-group" style={{ marginTop: '1.5rem' }}>
                                    <label className="stg-label">Especialidades Profesionales</label>
                                    <div className="stg-chips-grid">
                                        {SPECIALTIES_OPTIONS.map(spec => (
                                            <button
                                                key={spec}
                                                className={`stg-chip ${formData.especialidades.includes(spec) ? 'selected' : ''}`}
                                                onClick={() => toggleSpecialty(spec)}
                                            >
                                                {spec}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="stg-f-group" style={{ marginTop: '1.5rem' }}>
                                    <label className="stg-label">Biografía / Extracto</label>
                                    <textarea name="biography" className="stg-dark-input underline" rows="3" value={formData.biography} onChange={handleChange} />
                                </div>

                                <div className="stg-actions-footer">
                                    <button className="stg-gold-btn" onClick={handleSaveProfile} disabled={saving || uploading}>
                                        {saving ? 'Procesando...' : 'Guardar Perfil'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="stg-tab-pane">
                                <div className="stg-alert-card">🛡️ Sus datos están bajo la protección cifrada de Judic-IA.</div>
                                <div className="stg-field-row multi">
                                    <div className="stg-f-group flex-2">
                                        <label className="stg-label">Email de Acceso</label>
                                        <input className="stg-dark-input readonly" value={user?.email || ''} readOnly />
                                    </div>
                                    <div className="stg-f-group flex-1">
                                        <label className="stg-label">Enlace Telefónico</label>
                                        <input name="phone" className="stg-dark-input" value={formData.phone} onChange={handleChange} placeholder="+54 9..." />
                                    </div>
                                </div>
                                <div className="stg-divider"></div>
                                <h3 className="stg-sec-title">Gabinete de Identidad</h3>
                                <div className="stg-field-row multi stg-bg-box" style={{ alignItems: 'flex-end' }}>
                                    <div className="stg-f-group flex-2">
                                        <label className="stg-label">Credencial de Acceso</label>
                                        <input type="password" className="stg-dark-input readonly" value="********" readOnly />
                                        <p className="stg-hint">Solo puede ser restablecida por email oficial.</p>
                                    </div>
                                    <div className="flex-1">
                                        <button className="stg-outline-btn" style={{ width: '100%' }} onClick={() => toast.info("Solicitud enviada. Revise su email.")}>Restablecer</button>
                                    </div>
                                </div>
                                <div className="stg-actions-footer">
                                    <button className="stg-gold-btn" onClick={handleSaveSecurity} disabled={saving}>
                                        {saving ? 'Guardando...' : 'Actualizar Seguridad'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'billing' && (
                            <div className="stg-tab-pane">
                                {/* Plan Actual Section */}
                                <div className="stg-current-plan-box">
                                    <label className="stg-label">Tu Plan Actual</label>
                                    <div className="stg-current-status-card">
                                        <div className="stg-status-info">
                                            <span className="stg-status-icon">{formData.plan_tier === 'professional' ? '👑' : '⚖️'}</span>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{formData.plan_tier === 'professional' ? 'Judic-IA Suite Pro' : 'Plan Starter (Gratuito)'}</h4>
                                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                                    {formData.plan_tier === 'professional' ? 'Acceso completo a todas las funciones legales.' : 'Acceso limitado. Sube de nivel para desbloquear potencia total.'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="stg-badge-v2 active">
                                            ● ACTIVO {formData.subscription_expiry && `(Hasta ${new Date(formData.subscription_expiry).toLocaleDateString()})`}
                                        </div>
                                    </div>
                                </div>

                                <div className="stg-divider" style={{ margin: '2.5rem 0' }}></div>

                                {formData.plan_tier !== 'professional' ? (
                                    <>
                                        <h3 className="stg-sec-title">Mejorar al Plan Profesional</h3>
                                        <div className="stg-plan-card stg-premium-glow">
                                            <div className="stg-plan-badge">RECOMENDADO</div>
                                            <small className="stg-tag">Gabinete de Élite</small>
                                            <h2 className="stg-plan-name">Judic-IA Suite Pro</h2>
                                            <div className="stg-price-row">
                                                <span className="stg-val">$25.000</span>
                                                <span className="stg-period">/ mensual</span>
                                            </div>
                                            <ul className="stg-plan-list">
                                                <li>✓ Asistente IA Ilimitado</li>
                                                <li>✓ Investigación de Jurisprudencia Pro</li>
                                                <li>✓ Gestión de Clientes sin límites</li>
                                                <li>✓ Generación de Documentos Premium</li>

                                                <div className="stg-plan-footer" style={{
                                                    marginTop: '2.5rem',
                                                    paddingTop: '2rem',
                                                    borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '1.5rem'
                                                }}>
                                                    <button
                                                        className="stg-gold-btn pulse-anim"
                                                        style={{
                                                            width: 'auto', // Changed from 100%
                                                            minWidth: '280px',
                                                            padding: '1rem 2rem', // Reduced padding
                                                            fontSize: '1rem', // Reduced font size
                                                            fontWeight: '800',
                                                            borderRadius: '16px',
                                                            boxShadow: '0 8px 25px rgba(251, 191, 36, 0.25)',
                                                            letterSpacing: '1px',
                                                            textTransform: 'uppercase'
                                                        }}
                                                        onClick={handleSaveBilling}
                                                        disabled={saving || paymentPending} // Disable main button if pending
                                                    >
                                                        {paymentPending ? 'ESPERANDO COMPROBACIÓN...' : (saving ? 'PROCESANDO...' : 'SUSCRIBIRSE AHORA')}
                                                    </button>



                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '24px',
                                                        width: '100%',
                                                        opacity: 0.9
                                                    }}>
                                                        <img src="/mercadopago/logo_white.svg" alt="Mercado Pago" style={{ height: '24px' }} />
                                                        <div style={{ height: '16px', width: '1px', background: 'rgba(148, 163, 184, 0.3)' }}></div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                                                PAGO SEGURO
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </ul>
                                        </div>
                                    </>
                                ) : (
                                    <div className="stg-success-card">
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                                        <h3 style={{ margin: 0, color: '#fbbf24' }}>¡Ya eres Profesional!</h3>
                                        <p style={{ color: '#94a3b8' }}>Estás aprovechando al máximo el Gabinete Jurídico.</p>
                                        <h3 style={{ margin: 0, color: '#fbbf24' }}>¡Ya eres Profesional!</h3>
                                        <p style={{ color: '#94a3b8' }}>Estás aprovechando al máximo el Gabinete Jurídico.</p>
                                        <button className="stg-outline-btn" style={{ marginTop: '1rem' }} onClick={() => toast.info("Próximamente: Panel de gestión de suscripciones externas.")}>Ver Facturas</button>
                                    </div>
                                )}

                                {/* El botón de confirmar aquí es redundante ya que el pago se inicia arriba */}
                            </div>
                        )}
                        {activeTab === 'support' && (
                            <div className="stg-tab-pane">
                                <h3 className="stg-sec-title">Centro de Ayuda</h3>
                                <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
                                    Selecciona el canal adecuado para agilizar tu consulta.
                                </p>
                                <div className="stg-support-grid">
                                    <div className="stg-support-card">
                                        <div className="icon-circle">🔧</div>
                                        <h4>{CONTACT_CHANNELS.support.label}</h4>
                                        <p>¿Algo no funciona bien en la plataforma?</p>
                                        <a
                                            href={buildMailto(
                                                CONTACT_CHANNELS.support.email,
                                                CONTACT_CHANNELS.support.defaultSubject,
                                                `Hola equipo Judic-IA,\n\nSoy el usuario: ${user?.id}\nPlan: ${formData.plan_tier}\n\nMi problema es:`
                                            )}
                                            className="stg-link-btn"
                                        >
                                            {CONTACT_CHANNELS.support.email}
                                        </a>
                                    </div>

                                    <div className="stg-support-card">
                                        <div className="icon-circle">💳</div>
                                        <h4>{CONTACT_CHANNELS.billing.label}</h4>
                                        <p>Dudas sobre tu plan o pagos.</p>
                                        <a
                                            href={buildMailto(
                                                CONTACT_CHANNELS.billing.email,
                                                CONTACT_CHANNELS.billing.defaultSubject,
                                                `Hola,\n\nConsulta sobre facturación.\nUsuario: ${user?.id}`
                                            )}
                                            className="stg-link-btn"
                                        >
                                            {CONTACT_CHANNELS.billing.email}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            <style jsx global>{`
                /* SUPPORT GRID STYLES */
                .stg-support-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.5rem;
                }
                .stg-support-card {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 20px;
                    padding: 2rem;
                    text-align: center;
                    transition: 0.3s;
                }
                .stg-support-card:hover {
                    background: rgba(255,255,255,0.05);
                    border-color: rgba(251, 191, 36, 0.3);
                    transform: translateY(-3px);
                }
                .icon-circle {
                    width: 60px; height: 60px;
                    background: rgba(15, 23, 42, 0.6);
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.8rem;
                    margin: 0 auto 1rem;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .stg-support-card h4 {
                    margin: 0.5rem 0;
                    font-size: 1.1rem;
                    color: white;
                }
                .stg-support-card p {
                    color: #64748b;
                    font-size: 0.9rem;
                    margin-bottom: 1.5rem;
                }
                .stg-link-btn {
                    display: inline-block;
                    padding: 0.8rem 1.2rem;
                    background: rgba(251, 191, 36, 0.1);
                    color: #fbbf24;
                    text-decoration: none;
                    font-weight: 700;
                    border-radius: 12px;
                    font-size: 0.9rem;
                    transition: 0.3s;
                }
                .stg-link-btn:hover {
                    background: #fbbf24;
                    color: #020617;
                }

                /* ENCAPSULATED ROOT - PREVENT OVERLAP */
                .stg-root {
                    min-height: 100vh;
                    background: #020617;
                    color: white;
                    padding: 0 4rem 3rem 2rem;
                    font-family: var(--font-main);
                }
                .stg-container { max-width: 1200px; margin: 0 auto; }


                .stg-layout-split { 
                    display: flex; 
                    gap: 3.5rem; 
                    align-items: flex-start;
                }

                /* INTERNAL SIDEBAR - UNIQUE CLASSES */
                .stg-tabs-nav {
                    width: 280px;
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 24px;
                    padding: 1.5rem;
                    backdrop-filter: blur(20px);
                }

                .stg-tab-btn {
                    width: 100%;
                    text-align: left;
                    padding: 1.1rem 1.4rem;
                    margin-bottom: 0.8rem;
                    border: 1px solid transparent;
                    background: transparent;
                    color: #64748b;
                    border-radius: 14px;
                    cursor: pointer;
                    font-weight: 700;
                    transition: all 0.3s;
                    font-size: 0.95rem;
                }
                .stg-tab-btn:hover { background: rgba(255,255,255,0.03); color: white; }
                .stg-tab-btn.active {
                    background: rgba(251, 191, 36, 0.1);
                    border-color: rgba(251, 191, 36, 0.2);
                    color: #fbbf24;
                }

                /* CONTENT BOX */
                .stg-main-content {
                    flex: 1;
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 32px;
                    padding: 3.5rem;
                    backdrop-filter: blur(50px);
                    box-shadow: 0 40px 100px -20px rgba(0,0,0,0.5);
                    min-height: 700px;
                }

                .stg-tab-pane { animation: stgFade 0.6s ease; }
                @keyframes stgFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .stg-profile-header { display: flex; gap: 3.5rem; margin-bottom: 2.5rem; }
                .stg-photo-col { width: 180px; }
                .stg-avatar-box {
                    width: 180px; height: 180px;
                    background: #0f172a;
                    border: 2px dashed rgba(251, 191, 36, 0.25);
                    border-radius: 24px;
                    overflow: hidden; cursor: pointer; position: relative;
                    display: flex; align-items: center; justify-content: center;
                    transition: 0.4s;
                }
                .stg-avatar-box:hover, .stg-avatar-box.drag-active { border-color: #fbbf24; transform: scale(1.02); background: rgba(251,191,36,0.05); }
                .stg-avatar-box img { width: 100%; height: 100%; object-fit: cover; }
                .stg-placeholder { text-align: center; color: #334155; font-size: 0.8rem; font-weight: 800; }
                
                .stg-avatar-actions {
                    display: flex; gap: 0.8rem; margin-top: 0.8rem; width: 100%; justify-content: space-between;
                }
                .stg-mini-btn {
                    flex: 1;
                    padding: 0.4rem 0.6rem;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.08);
                    background: transparent;
                    color: #64748b;
                    font-size: 0.7rem; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    cursor: pointer; transition: 0.3s;
                    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
                }
                .stg-mini-btn:hover:not(:disabled) { background: rgba(255,255,255,0.03); color: white; border-color: rgba(255,255,255,0.2); }
                .stg-mini-btn.primary { background: rgba(251, 191, 36, 0.05); color: #fbbf24; border-color: rgba(251, 191, 36, 0.15); }
                .stg-mini-btn.primary:hover { background: rgba(251, 191, 36, 0.15); border-color: #fbbf24; color: #fbbf24; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.1); }
                .stg-mini-btn:disabled { opacity: 0.3; cursor: not-allowed; border-color: transparent; }

                /* REMOVED stg-change-photo-btn */
                .stg-loader-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; color: #fbbf24; }

                .stg-fields-col { flex: 1; }
                .stg-f-group { margin-bottom: 1.8rem; display: flex; flex-direction: column; }
                .stg-label { font-size: 0.75rem; font-weight: 900; color: #475569 !important; text-transform: uppercase; margin-bottom: 0.7rem; letter-spacing: 0.08em; padding-left: 0.4rem; }
                
                .stg-dark-input {
                    background: #0f172a !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    color: white !important;
                    padding: 1rem 1.4rem !important;
                    border-radius: 16px !important;
                    font-size: 1rem !important;
                    outline: none !important;
                    width: 100%;
                    transition: 0.3s;
                }
                .stg-dark-input:focus { border-color: #fbbf24 !important; background: #020617 !important; box-shadow: 0 0 0 5px rgba(251,191,36,0.1) !important; }
                .stg-dark-input.readonly { opacity: 0.4; cursor: not-allowed; }
                .stg-dark-input.underline { resize: none; }

                .stg-dark-input.underline { resize: none; }

                .stg-field-row.multi { display: flex; gap: 1.8rem; align-items: flex-end; }
                .flex-1 { flex: 1; } .flex-2 { flex: 2; }
                .flex-1 { flex: 1; } .flex-2 { flex: 2; }

                .stg-chips-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; }
                .stg-chip {
                    padding: 0.6rem 1rem;
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px;
                    color: #64748b;
                    font-size: 0.8rem;
                    cursor: pointer;
                    font-weight: 600;
                    transition: 0.3s;
                }
                .stg-chip:hover { color: white; background: rgba(255,255,255,0.05); }
                .stg-chip.selected { background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.2); color: #fbbf24; }

                .stg-actions-footer { margin-top: 3.5rem; display: flex; justify-content: flex-end; padding-top: 2.5rem; border-top: 1px solid rgba(255,255,255,0.05); }
                .stg-gold-btn {
                    background: linear-gradient(135deg, #fbbf24, #d97706);
                    color: #020617; border: none; padding: 1.1rem 3.5rem; border-radius: 18px;
                    font-weight: 800; cursor: pointer; transition: 0.3s; font-size: 1rem;
                    text-transform: uppercase; letter-spacing: 0.05em;
                }
                .stg-gold-btn:hover { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(217, 119, 6, 0.3); }
                .stg-gold-btn:disabled { opacity: 0.5; }

                /* SECURITY */
                .stg-alert-card { background: rgba(251,191,36,0.05); border: 1px solid rgba(251,191,36,0.15); padding: 1.5rem; border-radius: 16px; color: #fbbf24; font-size: 0.95rem; margin-bottom: 3rem; font-weight: 700; }
                .stg-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 3rem 0; }
                .stg-sec-title { font-family: 'Playfair Display'; font-size: 1.8rem; color: white; margin-bottom: 2rem; }
                .stg-bg-box { background: rgba(15, 23, 42, 0.3); padding: 2.5rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.03); }
                .stg-hint { font-size: 0.75rem; color: #475569; margin-top: 0.8rem; }
                .stg-outline-btn { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; padding: 1rem; border-radius: 14px; cursor: pointer; font-weight: 700; transition: 0.3s; }
                .stg-outline-btn:hover { color: white; border-color: #fbbf24; }

                /* BILLING */
                .stg-plan-card {
                    background: linear-gradient(145deg, #0f172a, #020617);
                    border: 1px solid rgba(251, 191, 36, 0.4);
                    padding: 3.5rem; border-radius: 28px; position: relative;
                }
                .stg-premium-glow { box-shadow: 0 0 50px rgba(251, 191, 36, 0.05); }
                .stg-plan-badge { 
                    position: absolute; top: 2rem; right: 2rem; 
                    background: #fbbf24; color: #020617; font-size: 0.75rem; font-weight: 950; 
                    padding: 0.5rem 1.2rem; border-radius: 100px;
                }
                .stg-tag { color: #fbbf24; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; display: block; margin-bottom: 0.5rem; }
                .stg-plan-name { font-family: 'Playfair Display'; font-size: 3rem; margin: 0; }
                .stg-price-row { display: flex; align-items: baseline; gap: 0.8rem; margin-top: 1rem; }
                .stg-val { font-size: 2.5rem; font-weight: 900; color: white; }
                .stg-period { color: #475569; font-weight: 600; }
                .stg-plan-footer { display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 2rem; padding-top: 1.5rem; }
                .stg-status-active { color: #10b981; font-weight: 900; font-size: 0.85rem; }
                .stg-next-date { color: #64748b; font-size: 0.85rem; }

                .stg-methods-box { margin-top: 4rem; }
                .stg-method-item { 
                    background: rgba(0, 158, 227, 0.04); 
                    border: 1px solid rgba(0, 158, 227, 0.15); 
                    padding: 1.8rem; border-radius: 18px; 
                    display: flex; justify-content: space-between; align-items: center;
                }
                .stg-mp-btn:hover { background: #0085bd; transform: translateY(-2px); }
                .stg-mp-btn:disabled { opacity: 0.6; cursor: not-allowed; }

                /* NEW BILLING STYLES */
                .stg-current-status-card {
                    display: flex; justify-content: space-between; align-items: center;
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
                    padding: 1.5rem 2rem; border-radius: 20px;
                }
                .stg-status-info { display: flex; align-items: center; gap: 1.5rem; }
                .stg-status-icon { font-size: 2rem; background: rgba(255,255,255,0.05); width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 16px; }
                
                .stg-badge-v2 { font-size: 0.75rem; font-weight: 900; padding: 0.5rem 1rem; border-radius: 99px; }
                .stg-badge-v2.active { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
                .stg-badge-v2.inactive { background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244,63,94,0.2); }

                .stg-plan-list { list-style: none; padding: 0; margin: 2rem 0 0; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .stg-plan-list li { color: #94a3b8; font-size: 0.9rem; font-weight: 500; }
                
                .stg-success-card { text-align: center; padding: 4rem 2rem; background: rgba(251, 191, 36, 0.03); border: 2px dashed rgba(251,191,36,0.15); border-radius: 32px; }

                .stg-pro-upgrade-action {
                    margin-top: 2.5rem;
                    padding-top: 2rem;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    text-align: left;
                }

                .pulse-anim {
                    animation: proPulse 2s infinite;
                }
                @keyframes proPulse {
                    0% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4); }
                    70% { box-shadow: 0 0 0 15px rgba(251, 191, 36, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
                }

                @media (max-width: 900px) {
                    .stg-layout-split { flex-direction: column; }
                    .stg-tabs-nav { width: 100%; }
                    .stg-profile-header { flex-direction: column; align-items: center; }
                    .stg-field-row.multi { flex-direction: column; gap: 0; }
                    .stg-root { padding: 2rem; }
                    .stg-plan-list { grid-template-columns: 1fr; }
                }

                @media (max-width: 600px) {
                    .stg-root { padding: 1rem; }
                    .stg-main-content { padding: 1.5rem; }
                    .stg-header-title { font-size: 1.8rem; }
                }
            `}</style>
            <Script
                src="https://sdk.mercadopago.com/js/v2"
                onLoad={() => {
                    console.log("Mercado Pago SDK Loaded");
                }}
            />
        </div>
    );
}
