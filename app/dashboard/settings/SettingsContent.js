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
import { CONTACT_CHANNELS, buildMailto, buildWhatsApp, WHATSAPP_SUPPORT_NUMBER } from '../../lib/contact-channels';
import { CHANGELOG } from '../../lib/changelog';
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
    Mail,
    FileText,
    Download,
    Eye,
    Clock,
    X,
    MessageCircle,
    Sparkles
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic import para PdfReader (evita SSR issues con react-pdf)
const PdfReader = dynamic(() => import('@/app/components/PdfReader'), { ssr: false });
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';
import '../../globals.css';

const PROVINCES = [
    'CABA', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut',
    'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy',
    'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén',
    'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
    'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

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
    const [showPhotoNudge, setShowPhotoNudge] = useState(false);
    const avatarSectionRef = useRef(null);
    const [deletionStep, setDeletionStep] = useState('initial'); // initial, otp_sent, verified
    const [deletionOtp, setDeletionOtp] = useState('');

    // 2FA por email
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [twoFaStep, setTwoFaStep] = useState('idle'); // 'idle' | 'otp_sent' | 'loading'
    const [twoFaOtp, setTwoFaOtp] = useState('');
    const [twoFaError, setTwoFaError] = useState('');

    // Invoice state
    const [invoices, setInvoices] = useState([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // Admin broadcast panel
    const [subscriberCount, setSubscriberCount] = useState(null);
    const [broadcastAlreadySent, setBroadcastAlreadySent] = useState(false);
    const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
    const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

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
        verification_status: 'pending', // Added to track lock state
        rejection_reason: '',
        plan_tier: 'starter',
        subscription_status: 'inactive',
        subscription_expiry: null,
        is_correspondent: false,
        coverage_zones: [],
        is_public: false
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
                    subscription_expiry: null,
                    is_correspondent: false,
                    coverage_zones: ['Buenos Aires', 'CABA'],
                    is_public: false
                });
                setLoading(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (data) {
                    setTwoFactorEnabled(data.two_factor_email || false);
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
                        verification_status: data.verification_status || 'pending',
                        rejection_reason: data.rejection_reason || '',
                        plan_tier: data.plan_tier || 'starter',
                        subscription_status: data.subscription_status || 'inactive',
                        subscription_expiry: data.subscription_expiry || null,
                        is_correspondent: data.is_correspondent || false,
                        coverage_zones: Array.isArray(data.coverage_zones) ? data.coverage_zones : [],
                        is_public: data.is_public || false
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

        // Fetch invoices when on billing tab
        if (activeTab === 'billing' && !isDemo) {
            fetchInvoices();
        }

        // Fetch subscriber count when admin opens support tab
        if (activeTab === 'support' && isAdmin) {
            fetchSubscriberCount();
        }
    }, [searchParams, activeTab, isAdmin]);

    const fetchInvoices = async () => {
        setInvoicesLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/invoices', {
                headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setInvoices(data.invoices || []);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setInvoicesLoading(false);
        }
    };

    const fetchSubscriberCount = async () => {
        try {
            const res = await fetch('/api/newsletter/broadcast');
            if (res.ok) {
                const data = await res.json();
                setSubscriberCount(data.count);
                setBroadcastAlreadySent(data.already_sent ?? false);
            }
        } catch (e) {
            console.error('Error fetching subscriber count:', e);
        }
    };

    const sendBroadcast = async () => {
        if (isSendingBroadcast) return;
        setIsSendingBroadcast(true);
        try {
            const res = await fetch('/api/newsletter/broadcast', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                toast.success(`✓ Enviado a ${data.sent} suscriptores`);
                setBroadcastAlreadySent(true);
            } else if (res.status === 409) {
                toast.error('Esta entrada ya fue enviada anteriormente');
                setBroadcastAlreadySent(true);
            } else {
                toast.error(data.error || 'Error al enviar');
            }
        } catch (e) {
            toast.error('Error de conexión');
        } finally {
            setIsSendingBroadcast(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const toggleSpecialty = (spec) => {
        setFormData(prev => {
            const current = prev.especialidades;
            const newSpecs = current.includes(spec) ? current.filter(s => s !== spec) : [...current, spec];
            return { ...prev, especialidades: newSpecs };
        });
    };

    const toggleZone = (zone) => {
        setFormData(prev => {
            const current = prev.coverage_zones;
            const newZones = current.includes(zone) ? current.filter(z => z !== zone) : [...current, zone];
            return { ...prev, coverage_zones: newZones };
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
                        const { data: { session: syncSession } } = await supabase.auth.getSession();
                        const res = await fetch('/api/mp/subscription/sync', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(syncSession?.access_token ? { 'Authorization': `Bearer ${syncSession.access_token}` } : {})
                            },
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
                is_correspondent: formData.is_correspondent,
                coverage_zones: formData.coverage_zones,
                is_public: formData.is_public,
                matricula: (formData.tomo || formData.folio)
                    ? `T° ${formData.tomo || ''} F° ${formData.folio || ''}`.trim()
                    : formData.matricula,
                verification_status: formData.verification_status === 'rejected' ? 'pending' : formData.verification_status,
                ...(formData.verification_status === 'rejected' ? { rejection_reason: null } : {})
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


    const handle2FaToggle = async () => {
        setTwoFaError('');
        setTwoFaStep('loading');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const purpose = twoFactorEnabled ? 'disable_2fa' : 'enable_2fa';
            const res = await fetch('/api/auth/2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ purpose })
            });
            if (!res.ok) {
                const d = await res.json();
                setTwoFaError(d.error || 'Error al enviar el código');
                setTwoFaStep('idle');
                return;
            }
            setTwoFaOtp('');
            setTwoFaStep('otp_sent');
        } catch {
            setTwoFaError('Error de conexión.');
            setTwoFaStep('idle');
        }
    };

    const handle2FaVerify = async (e) => {
        e.preventDefault();
        if (twoFaOtp.length < 6) return;
        setTwoFaStep('loading');
        setTwoFaError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const purpose = twoFactorEnabled ? 'disable_2fa' : 'enable_2fa';
            const res = await fetch('/api/auth/2fa', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ otp: twoFaOtp, purpose })
            });
            const data = await res.json();
            if (!res.ok) {
                setTwoFaError(data.error || 'Código inválido.');
                setTwoFaStep('otp_sent');
                return;
            }
            const newValue = !twoFactorEnabled;
            setTwoFactorEnabled(newValue);
            setTwoFaStep('idle');
            setTwoFaOtp('');
            toast.success(newValue
                ? '✅ Verificación en dos pasos activada.'
                : '✅ Verificación en dos pasos desactivada.'
            );
        } catch {
            setTwoFaError('Error de conexión.');
            setTwoFaStep('otp_sent');
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

    // Realtime Profile Listener (Payments & Verification)
    useEffect(() => {
        if (!user || isDemo) return;

        console.log("🔌 Conectando listener de perfil...");
        const channel = supabase
            .channel('profile_realtime')
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

                    // 1. Update verification & matricula status
                    if (payload.new.verification_status !== formData.verification_status || payload.new.matricula !== formData.matricula) {
                        let t = '', f = '';
                        if (payload.new.matricula) {
                            const match = payload.new.matricula.match(/T°?\s*(\d+)\s*F°?\s*(\d+)/i);
                            if (match) { t = match[1]; f = match[2]; } else { t = payload.new.matricula; }
                        }

                        setFormData(prev => ({
                            ...prev,
                            verification_status: payload.new.verification_status,
                            matricula: payload.new.matricula,
                            tomo: t,
                            folio: f
                        }));

                        if (payload.new.verification_status === 'verified') {
                            toast.success("🛡️ ¡Tu matrícula ha sido verificada! Ya tienes acceso total.");
                        }
                    }

                    // 2. Update payment status
                    if (payload.new.plan_tier === 'professional' && payload.new.subscription_status === 'active' && formData.plan_tier !== 'professional') {
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
    }, [user, formData.verification_status, formData.matricula, formData.plan_tier]);

    const handleSaveBilling = async () => {
        if (isDemo) {
            toast.error("🔒 La suscripción real está desactivada en la Demo.");
            return;
        }
        setSaving(true);
        setPaymentPending(true); // UI State: Esperando...

        try {
            // Utilizar el endpoint del servidor
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch('/api/mp/subscription/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
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
                <div className="settings-header-v2">
                    <h1 className="dashboard-page-title m-0">Configuración Profesional <Gem size={28} className="text-amber-400 gem-icon-inline" /></h1>
                    <UsageGuide content={dashboardManuals.settings} />
                </div>

                <div className="stg-layout-split">
                    {/* Sidebar de Ajustes (Interno) */}
                    <aside className="stg-tabs-nav" role="tablist" aria-label="Secciones de configuración">
                        <button role="tab" aria-selected={activeTab === 'profile'} className={`stg-tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => handleTabChange('profile')}>
                            <User size={18} aria-hidden="true" /> Perfil Profesional
                        </button>
                        <button role="tab" aria-selected={activeTab === 'security'} className={`stg-tab-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => handleTabChange('security')}>
                            <Shield size={18} aria-hidden="true" /> Seguridad
                        </button>
                        <button role="tab" aria-selected={activeTab === 'billing'} className={`stg-tab-btn ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => handleTabChange('billing')}>
                            <CreditCard size={18} aria-hidden="true" /> Facturación
                        </button>
                        <button role="tab" aria-selected={activeTab === 'support'} className={`stg-tab-btn ${activeTab === 'support' ? 'active' : ''}`} onClick={() => handleTabChange('support')}>
                            <LifeBuoy size={18} aria-hidden="true" /> Soporte y Ayuda
                        </button>
                    </aside>

                    {/* Contenido Principal */}
                    <main className="stg-main-content">
                        {activeTab === 'profile' && (
                            <div className="stg-tab-pane">
                                <div className="stg-profile-header">
                                    <div className="stg-photo-col" ref={avatarSectionRef}>
                                        <label htmlFor="avatar_upload" className="stg-label">Imagen 4x4</label>

                                        <div {...getRootProps()} className={`stg-avatar-box ${isDragActive ? 'drag-active' : ''}`}>
                                            <input {...getInputProps({ id: 'avatar_upload', autoComplete: 'off' })} />
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
                                                <label htmlFor="full_name" className="stg-label">Nombre Completo</label>
                                                <input id="full_name" name="full_name" autoComplete="name" className="stg-dark-input readonly" value={formData.full_name} readOnly disabled />
                                            </div>
                                            <div className="stg-f-group stg-header-action-row">
                                                {formData.verification_status === 'verified' && (
                                                    <div className="stg-verified-badge">
                                                        <Check size={12} /> Perfil Verificado
                                                    </div>
                                                )}
                                                {(!formData.verification_status || formData.verification_status === 'pending') && (
                                                    <div className="stg-pending-badge">
                                                        <Clock size={12} /> Verificación Pendiente
                                                    </div>
                                                )}
                                                {formData.verification_status === 'rejected' && (
                                                    <div className="stg-rejected-badge">
                                                        <AlertTriangle size={12} /> Revisión Necesaria
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {formData.verification_status === 'rejected' && formData.rejection_reason && (
                                            <div className="stg-rejection-reason-box">
                                                <AlertTriangle size={14} />
                                                <div>
                                                    <strong>Motivo del rechazo:</strong>
                                                    <p>{formData.rejection_reason}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="stg-field-row multi">
                                            <div className="stg-f-group flex-2">
                                                <label htmlFor="jurisdiccion" className="stg-label">Colegio / Jurisdicción</label>
                                                <input
                                                    id="jurisdiccion"
                                                    name="jurisdiccion"
                                                    autoComplete="organization"
                                                    className={`stg-dark-input ${formData.verification_status === 'verified' ? 'readonly' : 'underline'}`}
                                                    value={formData.jurisdiccion}
                                                    onChange={handleChange}
                                                    readOnly={formData.verification_status === 'verified'}
                                                    disabled={formData.verification_status === 'verified'}
                                                />
                                            </div>
                                            <div className="stg-f-group flex-1">
                                                <label htmlFor="tomo" className="stg-label">Tomo</label>
                                                <input
                                                    id="tomo"
                                                    name="tomo"
                                                    autoComplete="off"
                                                    className={`stg-dark-input ${formData.verification_status === 'verified' ? 'readonly' : 'underline'}`}
                                                    value={formData.tomo}
                                                    onChange={handleChange}
                                                    readOnly={formData.verification_status === 'verified'}
                                                    disabled={formData.verification_status === 'verified'}
                                                />
                                            </div>
                                            <div className="stg-f-group flex-1">
                                                <label htmlFor="folio" className="stg-label">Folio</label>
                                                <input
                                                    id="folio"
                                                    name="folio"
                                                    autoComplete="off"
                                                    className={`stg-dark-input ${formData.verification_status === 'verified' ? 'readonly' : 'underline'}`}
                                                    value={formData.folio}
                                                    onChange={handleChange}
                                                    readOnly={formData.verification_status === 'verified'}
                                                    disabled={formData.verification_status === 'verified'}
                                                />
                                            </div>
                                        </div>

                                        {/* SECCIÓN CORRESPONSALÍA */}
                                        <div className="stg-correspondence-wrapper">
                                            <div className="stg-correspondence-box">
                                                <div className="stg-toggle-row">
                                                    <div className="stg-toggle-info">
                                                        <h4 className="m-0 mb-1">Disponibilidad para Corresponsalía</h4>
                                                        <p>{formData.verification_status === 'verified'
                                                            ? 'Habilitá tu perfil para que otros colegas te encuentren en el Hub Federal.'
                                                            : 'Tu perfil debe estar verificado para activar corresponsalía.'}</p>
                                                    </div>
                                                    <label className={`stg-toggle ${formData.verification_status !== 'verified' ? 'stg-toggle-disabled' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            name="is_correspondent"
                                                            aria-label="Activar disponibilidad para corresponsalía"
                                                            checked={formData.is_correspondent}
                                                            onChange={(e) => {
                                                                if (formData.verification_status !== 'verified') {
                                                                    toast.error("Tu perfil debe estar verificado para activar esta opción.");
                                                                    return;
                                                                }
                                                                handleChange(e);
                                                            }}
                                                            disabled={formData.verification_status !== 'verified'}
                                                        />
                                                        <span className="stg-toggle-slider"></span>
                                                    </label>
                                                </div>

                                                {formData.is_correspondent && (
                                                    <div className="stg-coverage-section">
                                                        <fieldset className="stg-f-group fieldset-reset-v2">
                                                            <legend className="stg-label legend-full-width">Zonas de Cobertura</legend>
                                                            <div className="stg-chips-grid">
                                                                {PROVINCES.map(zone => (
                                                                    <button
                                                                        key={zone}
                                                                        type="button"
                                                                        className={`stg-chip ${formData.coverage_zones.includes(zone) ? 'selected' : ''}`}
                                                                        aria-pressed={formData.coverage_zones.includes(zone)}
                                                                        onClick={() => toggleZone(zone)}
                                                                    >
                                                                        {zone}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <p className="stg-hint">Seleccioná las jurisdicciones donde podés diligenciar trámites.</p>
                                                        </fieldset>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="stg-correspondence-guide-outside">
                                                <UsageGuide content={dashboardManuals.federal} mode="inline" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <fieldset className="stg-f-group fieldset-reset-v2">
                                    <legend className="stg-label legend-full-width">Especialidades Profesionales</legend>
                                    <div className="stg-chips-grid">
                                        {SPECIALTIES_OPTIONS.map(spec => (
                                            <button
                                                key={spec}
                                                type="button"
                                                className={`stg-chip ${formData.especialidades.includes(spec) ? 'selected' : ''}`}
                                                aria-pressed={formData.especialidades.includes(spec)}
                                                onClick={() => toggleSpecialty(spec)}
                                            >
                                                {spec}
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>

                                <div className="stg-f-group mt-1-5rem">
                                    <label htmlFor="biography" className="stg-label">Biografía / Extracto</label>
                                    <textarea id="biography" name="biography" autoComplete="off" className="stg-dark-input underline" rows="3" value={formData.biography} onChange={handleChange} />
                                </div>

                                {/* MARKETPLACE VISIBILITY TOGGLE */}
                                <div className="stg-f-group mt-1-5rem">
                                    <div className="stg-toggle-row">
                                        <div className="stg-toggle-info">
                                            <label className="stg-label" style={{ marginBottom: 0 }}>Perfil Público en Marketplace</label>
                                            <p className="stg-hint">
                                                {formData.verification_status === 'verified'
                                                    ? 'Activar para que clientes puedan encontrarte en el buscador de abogados.'
                                                    : 'Tu perfil debe estar verificado para aparecer en el marketplace.'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={formData.is_public}
                                            aria-label="Perfil público en marketplace"
                                            className={`stg-toggle-switch ${formData.is_public ? 'active' : ''}`}
                                            onClick={() => {
                                                if (formData.verification_status !== 'verified') {
                                                    toast.error("Tu perfil debe estar verificado para activar esta opción.");
                                                    return;
                                                }
                                                // When ENABLING: nudge if no photo
                                                if (!formData.is_public && !formData.avatar_url && !previewUrl) {
                                                    setShowPhotoNudge(true);
                                                    return;
                                                }
                                                setFormData(prev => ({ ...prev, is_public: !prev.is_public }));
                                            }}
                                            disabled={formData.verification_status !== 'verified'}
                                        >
                                            <span className="stg-toggle-knob" />
                                        </button>
                                    </div>
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
                                <div className="stg-alert-card"><Shield size={16} className="text-emerald-400 display-inline mr-0-5rem" /> Sus datos están bajo la protección cifrada de Judic-IA.</div>
                                <div className="stg-field-row multi">
                                    <div className="stg-f-group flex-2">
                                        <label htmlFor="email_access" className="stg-label">Email de Acceso</label>
                                        <input id="email_access" name="email" autoComplete="email" className="stg-dark-input readonly" value={user?.email || ''} readOnly />
                                    </div>
                                    <div className="stg-f-group flex-1">
                                        <label htmlFor="phone" className="stg-label">Enlace Telefónico</label>
                                        <input id="phone" name="phone" autoComplete="tel" className="stg-dark-input" value={formData.phone} onChange={handleChange} placeholder="+54 9..." />
                                    </div>
                                </div>
                                <div className="stg-divider"></div>
                                <div className="stg-f-group">
                                    <div className="stg-toggle-row">
                                        <div className="stg-toggle-info">
                                            <label className="stg-label" style={{ marginBottom: 0 }}>Verificación en Dos Pasos</label>
                                            <p className="stg-hint">Cada vez que iniciés sesión recibirás un código en tu email para confirmar tu identidad.</p>
                                        </div>
                                        {twoFaStep === 'loading' ? (
                                            <span className="stg-hint" style={{ whiteSpace: 'nowrap' }}>Enviando...</span>
                                        ) : (
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={twoFactorEnabled}
                                                aria-label="Verificación en dos pasos"
                                                className={`stg-toggle-switch ${twoFactorEnabled ? 'active' : ''}`}
                                                onClick={handle2FaToggle}
                                                disabled={twoFaStep === 'otp_sent'}
                                            >
                                                <span className="stg-toggle-knob" />
                                            </button>
                                        )}
                                    </div>

                                    {twoFaStep === 'otp_sent' && (
                                        <form onSubmit={handle2FaVerify} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                                            <p className="stg-hint">
                                                Ingresá el código de 6 dígitos que enviamos a <strong>{user?.email}</strong>.
                                            </p>
                                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={6}
                                                    value={twoFaOtp}
                                                    onChange={e => { setTwoFaOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setTwoFaError(''); }}
                                                    placeholder="000000"
                                                    className="stg-dark-input"
                                                    style={{ width: '140px', letterSpacing: '0.3em', fontWeight: 700, fontSize: '1.1rem' }}
                                                    autoFocus
                                                    required
                                                />
                                                <button type="submit" className="stg-gold-btn" disabled={twoFaOtp.length < 6}>
                                                    Confirmar
                                                </button>
                                                <button type="button" className="stg-outline-btn" onClick={() => { setTwoFaStep('idle'); setTwoFaOtp(''); setTwoFaError(''); }}>
                                                    Cancelar
                                                </button>
                                            </div>
                                            {twoFaError && <p className="stg-hint" style={{ color: '#fca5a5' }}>{twoFaError}</p>}
                                        </form>
                                    )}
                                </div>

                                <div className="stg-divider"></div>
                                <h3 className="stg-sec-title">Gabinete de Identidad</h3>
                                <div className="stg-field-row multi stg-bg-box align-items-end">
                                    <div className="stg-f-group flex-2">
                                        <label htmlFor="fake_credential" className="stg-label">Credencial de Acceso</label>
                                        <input id="fake_credential" name="credential" autoComplete="off" type="password" className="stg-dark-input readonly" value="********" readOnly />
                                        <p className="stg-hint">Solo puede ser restablecida por email oficial.</p>
                                    </div>
                                    <div className="flex-1">
                                        <button className="stg-outline-btn w-100" onClick={() => toast.info("Solicitud enviada. Revise su email.")}>Restablecer</button>
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
                                    <h3 className="stg-billing-title">Tu Plan Actual</h3>
                                    <div className="stg-current-status-card">
                                        <div className="stg-status-info">
                                            <span className="stg-status-icon">{formData.plan_tier === 'professional' ? <Crown size={24} className="text-amber-400" /> : <Scale size={24} className="text-slate-400" />}</span>
                                            <div>
                                                <h4 className="m-0 fs-1-2rem">{formData.plan_tier === 'professional' ? 'Judic-IA Suite Pro' : 'Plan Starter (Gratuito)'}</h4>
                                                <p className="billing-plan-p">
                                                    {formData.plan_tier === 'professional' ? 'Acceso completo a todas las funciones legales.' : 'Acceso limitado. Sube de nivel para desbloquear potencia total.'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="stg-badge-v2 active">
                                            <Check size={12} /> ACTIVO {formData.subscription_expiry && `(Hasta ${new Date(formData.subscription_expiry).toLocaleDateString()})`}
                                        </div>
                                    </div>
                                </div>

                                <div className="stg-divider-lg"></div>

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

                                                <div className="billing-footer-v2">
                                                    <button
                                                        className="stg-gold-btn pulse-anim billing-btn-pro"
                                                        onClick={handleSaveBilling}
                                                        disabled={saving || paymentPending}
                                                    >
                                                        {paymentPending ? 'ESPERANDO COMPROBACIÓN...' : (saving ? 'PROCESANDO...' : 'SUSCRIBIRSE AHORA')}
                                                    </button>

                                                    <div className="billing-trust-v2 full-opacity">
                                                        <img src="/mercadopago/logo_white.svg" alt="Mercado Pago" className="mp-logo-v2" />
                                                        <div className="billing-divider-v2"></div>
                                                        <div className="billing-secure-badge">
                                                            <Shield size={14} className="text-emerald-500" />
                                                            <span className="billing-secure-text">
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
                                        <div className="stg-success-icon-box"><Gem size={48} className="text-amber-400" /></div>
                                        <h3 className="stg-success-title">¡Ya eres Profesional!</h3>
                                        <p className="stg-success-text">Estás aprovechando al máximo el Gabinete Jurídico.</p>

                                        <div className="billing-success-actions">
                                            {formData.subscription_status === 'cancelled' ? (
                                                <div className="stg-badge-v2 billing-cancel-alert">
                                                    <ShieldOff size={14} className="text-red-400" /> CANCELADA (Expira el {formData.subscription_expiry ? new Date(formData.subscription_expiry).toLocaleDateString() : 'fin de mes'})
                                                </div>
                                            ) : (
                                                <button
                                                    className="stg-outline-btn danger btn-cancel-sub"
                                                    onClick={() => setModalOpen(true)}
                                                    disabled={saving}
                                                >
                                                    {saving ? 'Cancelando...' : 'Cancelar Suscripción'}
                                                </button>
                                            )}
                                        </div>

                                        <div className="billing-trust-v2 mt-1-5rem pt-1-5rem border-top-glow">
                                            <img src="/mercadopago/logo_white.svg" alt="Mercado Pago" className="mp-logo-footer" />
                                            <div className="billing-divider-v2 billing-divider-short"></div>
                                            <div className="billing-secure-badge">
                                                <Shield size={14} className="text-emerald-500" />
                                                <span className="billing-secure-text billing-secure-text-sm">
                                                    PAGO SEGURO
                                                </span>
                                            </div>
                                        </div>

                                        {/* Custom Confirmation Modal */}
                                        {modalOpen && (
                                            <div className="modal-overlay-v2">
                                                <div className="modal-content-v2" role="dialog" aria-modal="true" aria-labelledby="cancel-sub-modal-title">
                                                    <h3 id="cancel-sub-modal-title" className="modal-title-v2">
                                                        ¿Cancelar Suscripción?
                                                    </h3>
                                                    <p className="modal-text-v2">
                                                        Perderás acceso a las funciones profesionales (búsqueda ilimitada, documentos, IA avanzada) al finalizar tu periodo actual.
                                                    </p>
                                                    <div className="modal-btn-row">
                                                        <button
                                                            onClick={() => setModalOpen(false)}
                                                            className="btn-modal-ghost"
                                                        >
                                                            Conservar Plan
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                setSaving(true);
                                                                try {
                                                                    const { data: { session: cancelSession } } = await supabase.auth.getSession();
                                                                    const res = await fetch('/api/mp/subscription/cancel', {
                                                                        method: 'POST',
                                                                        headers: {
                                                                            'Content-Type': 'application/json',
                                                                            ...(cancelSession?.access_token ? { 'Authorization': `Bearer ${cancelSession.access_token}` } : {})
                                                                        },
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
                                                            className="btn-modal-danger"
                                                        >
                                                            {saving ? 'Procesando...' : 'Confirmar Baja'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Invoice History Section */}
                                <div className="stg-invoice-section">
                                    <div className="stg-invoice-header">
                                        <div className="stg-invoice-title">
                                            <Receipt size={20} className="text-amber-400" />
                                            <h4>Historial de Facturas</h4>
                                        </div>
                                    </div>

                                    {invoicesLoading ? (
                                        <div className="stg-invoice-loading">
                                            <div className="spinner-small" />
                                            <span>Cargando facturas...</span>
                                        </div>
                                    ) : invoices.length === 0 ? (
                                        <div className="stg-invoice-empty">
                                            <FileText size={32} className="text-slate-500" />
                                            <p>No hay facturas disponibles aún.</p>
                                        </div>
                                    ) : (
                                        <div className="stg-invoice-list">
                                            {invoices.map(invoice => (
                                                <div key={invoice.id} className="stg-invoice-item">
                                                    <div className="stg-invoice-info">
                                                        <div className="stg-invoice-icon">
                                                            <FileText size={18} />
                                                        </div>
                                                        <div className="stg-invoice-details">
                                                            <span className="stg-invoice-desc">{invoice.description}</span>
                                                            <span className="stg-invoice-date">
                                                                {new Date(invoice.payment_date).toLocaleDateString('es-AR', {
                                                                    day: '2-digit',
                                                                    month: 'long',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="stg-invoice-amount">
                                                        ${invoice.amount?.toLocaleString('es-AR')}
                                                    </div>
                                                    <div className="stg-invoice-actions">
                                                        {invoice.status === 'pending' ? (
                                                            <div className="stg-invoice-pending">
                                                                <Clock size={14} />
                                                                <span>En preparación</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    className="stg-invoice-btn view"
                                                                    onClick={() => {
                                                                        setSelectedInvoice(invoice);
                                                                        setInvoiceModalOpen(true);
                                                                    }}
                                                                    title="Ver factura"
                                                                    aria-label="Ver factura"
                                                                >
                                                                    <Eye size={16} aria-hidden="true" />
                                                                </button>
                                                                <a
                                                                    href={invoice.file_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="stg-invoice-btn download"
                                                                    title="Descargar factura"
                                                                    aria-label="Descargar factura"
                                                                >
                                                                    <Download size={16} aria-hidden="true" />
                                                                </a>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Invoice PDF Viewer Modal */}
                                {invoiceModalOpen && selectedInvoice && (
                                    <div className="modal-overlay-v2" onClick={() => setInvoiceModalOpen(false)}>
                                        <div className="invoice-modal-content" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title" onClick={e => e.stopPropagation()}>
                                            <div className="invoice-modal-header">
                                                <h3 id="invoice-modal-title">Factura - {selectedInvoice.description}</h3>
                                                <button
                                                    className="invoice-modal-close"
                                                    onClick={() => setInvoiceModalOpen(false)}
                                                    aria-label="Cerrar factura"
                                                >
                                                    <X size={20} aria-hidden="true" />
                                                </button>
                                            </div>
                                            <div className="invoice-modal-body">
                                                <PdfReader url={selectedInvoice.file_url} />
                                            </div>
                                            <div className="invoice-modal-footer">
                                                <a
                                                    href={selectedInvoice.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="stg-gold-btn"
                                                >
                                                    <Download size={16} />
                                                    Descargar PDF
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'support' && (
                            <div className="stg-tab-pane">
                                <h3 className="stg-sec-title">Centro de Ayuda</h3>
                                <p className="stg-support-hint">
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

                                    <div className="stg-support-card stg-support-card-wa">
                                        <div className="icon-circle icon-circle-wa">
                                            <MessageCircle size={32} />
                                        </div>
                                        <h4>Chat directo</h4>
                                        <p>¿Necesitás ayuda rápida? Escribinos por WhatsApp.</p>
                                        <a
                                            href={buildWhatsApp(WHATSAPP_SUPPORT_NUMBER, formData.full_name, formData.plan_tier)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="stg-link-btn stg-link-btn-wa"
                                        >
                                            Abrir WhatsApp
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
                                </div>

                                {isAdmin && CHANGELOG[0] && (
                                    <div className="stg-admin-broadcast-card">
                                        <div className="stg-admin-broadcast-header">
                                            <Sparkles size={18} className="stg-admin-broadcast-icon" />
                                            <span className="stg-admin-broadcast-title">Notificación de novedades</span>
                                            {subscriberCount !== null && (
                                                <span className="stg-admin-broadcast-count">{subscriberCount} suscriptores</span>
                                            )}
                                        </div>
                                        <p className="stg-admin-broadcast-entry">
                                            Última entrada: <strong>{CHANGELOG[0].date}</strong> · {CHANGELOG[0].items.length} cambios
                                        </p>
                                        {broadcastAlreadySent ? (
                                            <span className="stg-admin-broadcast-sent">✓ Ya enviado para esta entrada</span>
                                        ) : (
                                            <button
                                                className="stg-admin-broadcast-btn"
                                                onClick={sendBroadcast}
                                                disabled={isSendingBroadcast}
                                            >
                                                {isSendingBroadcast ? 'Enviando...' : 'Enviar novedades por email'}
                                            </button>
                                        )}
                                    </div>
                                )}

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
                                            <div className="stg-modal-content" role="dialog" aria-modal="true" aria-label="Eliminar cuenta definitivamente">
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
                        )}
                    </main>
                </div>
            </div>


            {/* PHOTO NUDGE MODAL */}
            {showPhotoNudge && (
                <div className="photo-nudge-overlay" onClick={() => setShowPhotoNudge(false)}>
                    <div className="photo-nudge-card" role="dialog" aria-modal="true" aria-labelledby="photo-nudge-title" onClick={e => e.stopPropagation()}>
                        <div className="photo-nudge-icon" aria-hidden="true">📸</div>
                        <h3 id="photo-nudge-title" className="photo-nudge-title">Los perfiles con foto generan más consultas</h3>
                        <p className="photo-nudge-body">
                            Los clientes tienen <strong>5 veces más probabilidad</strong> de contactar
                            a un abogado con foto. Tu imagen profesional es tu primera carta de presentación.
                        </p>
                        <div className="photo-nudge-actions">
                            <button
                                className="photo-nudge-btn-primary"
                                onClick={() => {
                                    setShowPhotoNudge(false);
                                    avatarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                            >
                                <Camera size={16} /> Subir mi foto
                            </button>
                            <button
                                className="photo-nudge-btn-secondary"
                                onClick={() => {
                                    setShowPhotoNudge(false);
                                    setFormData(prev => ({ ...prev, is_public: true }));
                                }}
                            >
                                Activar sin foto de todas formas
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
