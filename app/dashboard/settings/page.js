"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import './settings.css';
import { Toaster, toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import AvatarEditor from './AvatarEditor';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { CONTACT_CHANNELS, buildMailto } from '../../lib/contact-channels';
import {
    User,
    Shield,
    ShieldOff,
    CreditCard,
    LifeBuoy,
    Camera,
    PenLine,
    Upload,
    Check,
    AlertTriangle,
    Crown,
    Scale,
    Gem,
    Receipt,
    HelpCircle,
    Mail
} from 'lucide-react';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';
import '../../globals.css';

const SPECIALTIES_OPTIONS = [
    'Derecho Administrativo', 'Derecho Ambiental', 'Derecho Bancario',
    'Derecho Civil', 'Derecho Comercial', 'Daños y Perjuicios',
    'Derecho Empresario', 'Familia', 'Derecho Fiscal',
    'Derecho Informático', 'Derecho Internacional', 'Derecho Laboral',
    'Marcas y Patentes', 'Mediación y Arbitraje', 'Derecho Militar',
    'Derecho Penal', 'Derecho Real'
];

export default function SettingsPage({ isDemo = false }) {
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
    const [modalOpen, setModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletionStep, setDeletionStep] = useState('initial'); // initial, otp_sent, verified
    const [deletionOtp, setDeletionOtp] = useState('');

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
            if (isDemo) {
                // DEMO MODE MOCK DATA
                setUser({ id: 'demo-user', email: 'demo@judic-ia.com' });
                setFormData({
                    full_name: 'Abogado Demo',
                    especialidades: ['Derecho Civil', 'Derecho Laboral'],
                    matricula: 'Tº 100 Fº 1',
                    tomo: '100', folio: '1',
                    jurisdiccion: 'CABA',
                    biography: 'Perfil de demostración. Los cambios no se guardan.',
                    phone: '+54 9 11 1234-5678',
                    avatar_url: '',
                    plan_tier: 'starter',
                    subscription_status: 'inactive',
                    subscription_expiry: null
                });
                setLoading(false);
                return;
            }

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
        if (isDemo) {
            toast.error("🔒 La subida de archivos está desactivada en la Demo.");
            return;
        }
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

    // Verify subscription status on mount if returing from MP
    useEffect(() => {
        const checkStatus = async () => {
            const tab = searchParams.get('tab');
            // Mercado Pago adds these params on return
            const preapproval_id = searchParams.get('preapproval_id');
            const status = searchParams.get('status');

            if (tab === 'billing' && user) {
                // Si viene de MP o simplemente entró a billing, podemos verificar silenciosamente
                // Pero para no saturar, hagámoslo si hay params de MP o el usuario es Starter
                if (status === 'approved' || preapproval_id || formData.plan_tier === 'starter') {
                    // Solo mostramos toast si la verificación cambia algo importante
                    try {
                        const res = await fetch('/api/mp/subscription/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userId: user.id,
                                preapproval_id: preapproval_id
                            })
                        });
                        const data = await res.json();
                        if (data.ok) {
                            // Reload data to reflect changes
                            toast.success("¡Suscripción Verificada! Bienvenido a Pro.");
                            window.location.reload();
                        }
                    } catch (e) {
                        console.error("Auto-sync failed", e);
                    }
                }
            }
        };

        if (user) {
            checkStatus();
        }
    }, [user, searchParams, formData.plan_tier]);

    const handleSaveProfile = async () => {
        if (isDemo) {
            toast.success("✅ Simulación: Perfil actualizado (No se guardan cambios)");
            return;
        }
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
        if (isDemo) {
            toast.success("✅ Simulación: Seguridad actualizada (No se guardan cambios)");
            return;
        }
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
        if (!user || isDemo) return;

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
        if (isDemo) {
            toast.error("🔒 La suscripción real está desactivada en la Demo.");
            return;
        }
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

    if (loading) return <div className="stg-loading-screen">Cargando Gabinete...</div>;

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
                    <Link href={isDemo ? "/demo/dashboard" : "/dashboard"} className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Ajustes</span>
                </nav>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h1 className="dashboard-page-title" style={{ margin: 0 }}>Configuración Profesional <Gem size={28} className="text-amber-400" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '0.5rem' }} /></h1>
                    <UsageGuide content={dashboardManuals.settings} />
                </div>

                <div className="stg-layout-split">
                    {/* Sidebar de Ajustes (Interno) */}
                    <aside className="stg-tabs-nav">
                        <button className={`stg-tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => handleTabChange('profile')}>
                            <User size={18} /> Perfil Profesional
                        </button>
                        <button className={`stg-tab-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => handleTabChange('security')}>
                            <Shield size={18} /> Seguridad
                        </button>
                        <button className={`stg-tab-btn ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => handleTabChange('billing')}>
                            <CreditCard size={18} /> Facturación
                        </button>
                        <button className={`stg-tab-btn ${activeTab === 'support' ? 'active' : ''}`} onClick={() => handleTabChange('support')}>
                            <LifeBuoy size={18} /> Soporte y Ayuda
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
                                                    {isDragActive ? "Soltar" : <Camera size={24} className="text-slate-500" />}
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
                                                <PenLine size={14} /> Editar
                                            </button>
                                            <button
                                                className="stg-mini-btn primary"
                                                onClick={() => {
                                                    if (isDemo) {
                                                        toast.error("🔒 Función restringida en Demo");
                                                        return;
                                                    }
                                                    open();
                                                }}
                                            >
                                                <Upload size={14} /> Subir
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
                                <div className="stg-alert-card"><Shield size={16} className="text-emerald-400" style={{ display: 'inline', marginRight: '0.5rem' }} /> Sus datos están bajo la protección cifrada de Judic-IA.</div>
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
                                            <span className="stg-status-icon">{formData.plan_tier === 'professional' ? <Crown size={24} className="text-amber-400" /> : <Scale size={24} className="text-slate-400" />}</span>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{formData.plan_tier === 'professional' ? 'Judic-IA Suite Pro' : 'Plan Starter (Gratuito)'}</h4>
                                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                                    {formData.plan_tier === 'professional' ? 'Acceso completo a todas las funciones legales.' : 'Acceso limitado. Sube de nivel para desbloquear potencia total.'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="stg-badge-v2 active">
                                            <Check size={12} /> ACTIVO {formData.subscription_expiry && `(Hasta ${new Date(formData.subscription_expiry).toLocaleDateString()})`}
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
                                                <li><Check size={16} className="text-emerald-400" /> Asistente IA Ilimitado</li>
                                                <li><Check size={16} className="text-emerald-400" /> Investigación de Jurisprudencia Pro</li>
                                                <li><Check size={16} className="text-emerald-400" /> Gestión de Clientes sin límites</li>
                                                <li><Check size={16} className="text-emerald-400" /> Generación de Documentos Premium</li>

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
                                                            <Shield size={14} className="text-emerald-500" />
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
                                        <div style={{ marginBottom: '1rem' }}><Gem size={48} className="text-amber-400" /></div>
                                        <h3 style={{ margin: 0, color: '#fbbf24' }}>¡Ya eres Profesional!</h3>
                                        <p style={{ color: '#94a3b8' }}>Estás aprovechando al máximo el Gabinete Jurídico.</p>

                                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem', marginBottom: '2.5rem' }}>
                                            {formData.subscription_status === 'cancelled' ? (
                                                <div className="stg-badge-v2" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <ShieldOff size={14} className="text-red-400" /> CANCELADA (Expira el {formData.subscription_expiry ? new Date(formData.subscription_expiry).toLocaleDateString() : 'fin de mes'})
                                                </div>
                                            ) : (
                                                <button
                                                    className="stg-outline-btn danger"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
                                                    onClick={() => setModalOpen(true)}
                                                    disabled={saving}
                                                >
                                                    {saving ? 'Cancelando...' : 'Cancelar Suscripción'}
                                                </button>
                                            )}
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '24px',
                                            width: '100%',
                                            opacity: 0.7,
                                            paddingTop: '1.5rem',
                                            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                                        }}>
                                            <img src="/mercadopago/logo_white.svg" alt="Mercado Pago" style={{ height: '20px' }} />
                                            <div style={{ height: '14px', width: '1px', background: 'rgba(148, 163, 184, 0.3)' }}></div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Shield size={14} className="text-emerald-500" />
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                                    PAGO SEGURO
                                                </span>
                                            </div>
                                        </div>

                                        {/* Custom Confirmation Modal */}
                                        {modalOpen && (
                                            <div style={{
                                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                                            }}>
                                                <div style={{
                                                    background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
                                                    padding: '24px', maxWidth: '400px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                                                }}>
                                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '12px' }}>
                                                        ¿Cancelar Suscripción?
                                                    </h3>
                                                    <p style={{ color: '#94a3b8', marginBottom: '24px', lineHeight: '1.5' }}>
                                                        Perderás acceso a las funciones profesionales (búsqueda ilimitada, documentos, IA avanzada) al finalizar tu periodo actual.
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => setModalOpen(false)}
                                                            style={{
                                                                padding: '8px 16px', borderRadius: '6px', color: '#e2e8f0',
                                                                background: '#334155', border: 'none', cursor: 'pointer', fontWeight: 500
                                                            }}
                                                        >
                                                            Conservar Plan
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                setSaving(true);
                                                                try {
                                                                    const res = await fetch('/api/mp/subscription/cancel', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ userId: user.id })
                                                                    });
                                                                    const d = await res.json();
                                                                    if (!res.ok) throw new Error(d.error);
                                                                    toast.success(d.message || "Suscripción cancelada.");
                                                                    setFormData(p => ({ ...p, subscription_status: 'cancelled' }));
                                                                    window.location.reload();
                                                                } catch (e) {
                                                                    toast.error("Error al cancelar: " + e.message);
                                                                } finally {
                                                                    setSaving(false);
                                                                    setModalOpen(false);
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '8px 16px', borderRadius: '6px', color: '#fee2e2',
                                                                background: '#991b1b', border: 'none', cursor: 'pointer', fontWeight: 600
                                                            }}
                                                        >
                                                            {saving ? 'Procesando...' : 'Confirmar Baja'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
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
                                        <div className="icon-circle"><HelpCircle size={32} className="text-amber-400" /></div>
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
                                        <div className="icon-circle"><Receipt size={32} className="text-amber-400" /></div>
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
                                    <div className="stg-discrete-danger">
                                        <button
                                            onClick={() => {
                                                if (isDemo) { toast.error("🔒 Función restringida en Demo"); return; }
                                                setDeleteModalOpen(true);
                                            }}
                                            className="stg-discrete-delete-btn"
                                        >
                                            Eliminar mi cuenta definitivamente
                                        </button>
                                    </div>

                                    {deleteModalOpen && (
                                        <div className="stg-modal-overlay">
                                            <div className="stg-modal-content">
                                                {deletionStep === 'initial' && (
                                                    <>
                                                        <h3 className="text-xl font-bold mb-4 text-red-500">¿Estás absolutamente seguro?</h3>
                                                        <p className="text-slate-400 mb-6">
                                                            Esta acción eliminará <strong>permanentemente</strong> tu cuenta, casos, clientes y expedientes.
                                                            <br /><br />
                                                            Para confirmar, enviaremos un código a tu email.
                                                        </p>
                                                        <div className="flex justify-end gap-3">
                                                            <button
                                                                className="stg-ghost-btn"
                                                                onClick={() => setDeleteModalOpen(false)}
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                className="stg-danger-btn"
                                                                onClick={async () => {
                                                                    setSaving(true);
                                                                    try {
                                                                        const { data: { session } } = await supabase.auth.getSession();
                                                                        const res = await fetch('/api/account/request-deletion-otp', {
                                                                            method: 'POST',
                                                                            headers: {
                                                                                'Authorization': `Bearer ${session?.access_token}`
                                                                            }
                                                                        });
                                                                        if (!res.ok) throw new Error('Error solicitando eliminación');
                                                                        setDeletionStep('otp_sent');
                                                                        toast.success("Código enviado a tu email");
                                                                    } catch (e) {
                                                                        toast.error(e.message);
                                                                    } finally {
                                                                        setSaving(false);
                                                                    }
                                                                }}
                                                                disabled={saving}
                                                            >
                                                                {saving ? 'Enviando...' : 'Sí, eliminar cuenta'}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}

                                                {deletionStep === 'otp_sent' && (
                                                    <>
                                                        <h3 className="text-xl font-bold mb-4">Ingresa el código de confirmación</h3>
                                                        <p className="text-slate-400 mb-4">Revisa tu email y escribe el código de 6 dígitos.</p>

                                                        <input
                                                            type="text"
                                                            className="stg-dark-input text-center text-2xl tracking-widest mb-6"
                                                            placeholder="000000"
                                                            maxLength={6}
                                                            value={deletionOtp}
                                                            onChange={(e) => setDeletionOtp(e.target.value)}
                                                        />

                                                        <div className="flex justify-end gap-3">
                                                            <button
                                                                className="stg-ghost-btn"
                                                                onClick={() => setDeleteModalOpen(false)}
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                className="stg-danger-btn"
                                                                onClick={async () => {
                                                                    setSaving(true);
                                                                    try {
                                                                        const { data: { session } } = await supabase.auth.getSession();
                                                                        const res = await fetch('/api/account/confirm-deletion', {
                                                                            method: 'POST',
                                                                            headers: {
                                                                                'Content-Type': 'application/json',
                                                                                'Authorization': `Bearer ${session?.access_token}`
                                                                            },
                                                                            body: JSON.stringify({ otp: deletionOtp })
                                                                        });

                                                                        const d = await res.json();
                                                                        if (!res.ok) throw new Error(d.error || 'Error eliminando cuenta');

                                                                        toast.success("Cuenta eliminada correctamente");
                                                                        window.location.href = '/'; // Force redirect
                                                                    } catch (e) {
                                                                        toast.error(e.message);
                                                                    } finally {
                                                                        setSaving(false);
                                                                    }
                                                                }}
                                                                disabled={saving || deletionOtp.length < 6}
                                                            >
                                                                {saving ? 'Eliminando...' : 'CONFIRMAR ELIMINACIÓN'}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>


            {!isDemo && (
                <Script
                    src="https://sdk.mercadopago.com/js/v2"
                    onLoad={() => {
                        console.log("Mercado Pago SDK Loaded");
                    }}
                />
            )}
        </div>
    );
}
