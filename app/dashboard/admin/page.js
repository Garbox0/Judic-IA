'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { getPlanLimit } from '@/lib/planLimits';
import {
    Users,
    Crown,
    Activity,
    Search,
    ShieldCheck,
    AlertCircle,
    RefreshCw,
    Download,
    Cloud,
    CheckCircle2,
    XCircle,
    Power,
    Mail,
    BadgeCheck,
    ShieldAlert,
    ShieldQuestion,
    Receipt,
    Upload,
    FileText,
    Clock,
    Eye,
    CreditCard,
    DollarSign,
    Play,
    Zap,
    HardDrive,
    ShieldOff,
    Trash2,
    Building2,
    Handshake,
    Link2,
    RotateCcw,
    PlusCircle,
    Copy,
    Ban,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,

    Cell
} from 'recharts';

import './admin.css';
import AdminGuard from './components/AdminGuard';
import VerificationBadge from '@/app/components/VerificationBadge';

// Helper: Format CUIT for display (20123456786 -> 20-12345678-6)
const formatCuit = (cuit) => {
    if (!cuit) return null;
    const clean = cuit.replace(/-/g, '');
    if (clean.length !== 11) return cuit; // Return as-is if invalid length
    return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
};

export default function AdminPage() {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [health, setHealth] = useState({ status: 'healthy', latency: '40ms', database: 'connected' });
    const [stats, setStats] = useState({ totalUsers: 0, totalPro: 0, totalUsage: '0', totalMessages: 0 });
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeModal, setActiveModal] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [activeTab, setActiveTab] = useState('users'); // 'users' | 'verification' | 'invoices' | 'subscriptions' | 'kb-audit' | 'bans'
    const [bans, setBans] = useState([]);
    const [banEmail, setBanEmail] = useState('');
    const [banReason, setBanReason] = useState('');
    const [banSubmitting, setBanSubmitting] = useState(false);
    const [adminInvoices, setAdminInvoices] = useState([]);
    const [uploadingInvoice, setUploadingInvoice] = useState(null);
    const [auditReport, setAuditReport] = useState(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [rejectModal, setRejectModal] = useState({ open: false, userId: null, matriculaId: null, reason: '' });
    const [estudios, setEstudios] = useState([]);
    const [estudiosLoading, setEstudiosLoading] = useState(false);
    const [estudiosFilter, setEstudiosFilter] = useState('all');
    const [rejectOrgModal, setRejectOrgModal] = useState({ open: false, orgId: null, reason: '' });
    // ── REFERIDOS ──────────────────────────────────────────────────────────────
    const [referidos, setReferidos] = useState({ summary: [], codes: [], referrals: [] });
    const [referidosLoading, setReferidosLoading] = useState(false);
    const [newVendor, setNewVendor] = useState({ name: '', commission_pct: 20, recurring_months: 6 });
    const [vendorSubmitting, setVendorSubmitting] = useState(false);
    const [createdCode, setCreatedCode] = useState(null);
    const [replaceModal, setReplaceModal] = useState({ open: false, codeId: null, codeName: '' });
    const router = useRouter();

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (users.length > 0) {
            const lowerInfo = searchQuery.toLowerCase();
            const filtered = users.filter(u =>
                (u.email || '').toLowerCase().includes(lowerInfo) ||
                (u.full_name || '').toLowerCase().includes(lowerInfo)
            );
            setFilteredUsers(filtered);
        }
    }, [searchQuery, users]);

    useEffect(() => {
        const interval = setInterval(() => {
            checkLatency();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }
            setCurrentUser(session.user);
            initialFetch(session.user.id);
        } catch (err) {
            console.error('Auth check error:', err);
            router.push('/login');
        }
    };

    const checkLatency = async () => {
        try {
            const start = performance.now();
            await supabase.from('profiles').select('id', { count: 'exact', head: true });
            const end = performance.now();
            const latencyVal = Math.round(end - start);
            setHealth(prev => ({ ...prev, latency: `${latencyVal}ms`, database: 'connected' }));
        } catch (e) {
            setHealth(prev => ({ ...prev, latency: 'ERR', database: 'disconnected' }));
        }
    };

    const initialFetch = async (userId) => {
        setLoading(true);
        checkLatency();

        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setUsers(profiles || []);
            setFilteredUsers(profiles || []);

            const totalUsers = profiles?.length || 0;
            const totalPro = profiles?.filter(u => u.plan_tier === 'professional' && u.subscription_status === 'active').length || 0;
            const totalMessages = profiles?.reduce((acc, curr) => acc + (curr.ai_messages_used || 0), 0) || 0;
            const totalUsage = totalMessages > 1000 ? `${(totalMessages / 1000).toFixed(1)}k` : totalMessages;
            const monthlyRevenue = totalPro * 25000; // $25k ARS per professional user

            setStats({
                totalUsers,
                totalPro,
                totalUsage,
                totalMessages,
                monthlyRevenue
            });

        } catch (error) {
            console.error('Error fetching admin data:', error);
            showNotification('error', 'Error al cargar datos');
        } finally {
            setLoading(false);
        }

        // Also fetch invoices, audit, bans and estudios
        fetchAdminInvoices();
        fetchAuditReport();
        fetchBans();
        fetchEstudios();
        fetchReferidos();
    };

    const fetchReferidos = async () => {
        setReferidosLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/referrals', {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setReferidos(data);
            }
        } catch (err) { console.error('Error fetching referrals:', err); }
        finally { setReferidosLoading(false); }
    };

    const handleCreateVendor = async (e) => {
        e.preventDefault();
        if (!newVendor.name.trim()) return;
        setVendorSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/referrals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                body: JSON.stringify(newVendor)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCreatedCode(data.code);
            setNewVendor({ name: '', commission_pct: 20, recurring_months: 6 });
            showNotification('success', `Código ${data.code.code} generado.`);
            fetchReferidos();
        } catch (err) { showNotification('error', err.message); }
        finally { setVendorSubmitting(false); }
    };

    const handleReplaceCode = async () => {
        if (!replaceModal.codeId) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/referrals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                body: JSON.stringify({ old_code_id: replaceModal.codeId, vendor_name: replaceModal.codeName })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showNotification('success', `Código reemplazado: ${data.old_code} → ${data.new_code}`);
            setReplaceModal({ open: false, codeId: null, codeName: '' });
            fetchReferidos();
        } catch (err) { showNotification('error', err.message); }
    };

    const fetchEstudios = async () => {
        setEstudiosLoading(true);
        try {
            // owner_id FK apunta a auth.users (no accesible via PostgREST) → dos queries
            const { data: orgs, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('type', 'estudio')
                .order('created_at', { ascending: false });
            if (error) throw error;

            const ownerIds = (orgs || []).map(o => o.owner_id).filter(Boolean);
            let profilesMap = {};
            if (ownerIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, matriculas, verification_status')
                    .in('id', ownerIds);
                (profiles || []).forEach(p => { profilesMap[p.id] = p; });
            }

            setEstudios((orgs || []).map(o => ({ ...o, owner: profilesMap[o.owner_id] || null })));
        } catch (err) {
            console.error('Error fetching estudios:', err);
        } finally {
            setEstudiosLoading(false);
        }
    };

    const handleEstudioAction = async (orgId, action, rejectionReason) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sesión expirada');
            const res = await fetch('/api/admin/update-org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ action, orgId, rejection_reason: rejectionReason }),
            });
            if (!res.ok) throw new Error('Error al procesar acción');
            showNotification('success', action === 'verify' ? 'Estudio verificado.' : 'Estudio rechazado.');
            fetchEstudios();
        } catch (err) {
            showNotification('error', err.message);
        }
    };

    const fetchBans = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/admin/bans', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBans(data.bans || []);
            }
        } catch (err) {
            console.error('Error fetching bans:', err);
        }
    };

    const handleAddBan = async (e) => {
        e.preventDefault();
        if (!banEmail.trim()) return;
        setBanSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/bans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ email: banEmail.trim(), reason: banReason.trim() || null })
            });
            if (res.ok) {
                setBanEmail('');
                setBanReason('');
                fetchBans();
                showNotification('success', `Email baneado: ${banEmail.trim().toLowerCase()}`);
            } else {
                const d = await res.json();
                showNotification('error', d.error || 'Error al banear');
            }
        } catch {
            showNotification('error', 'Error de conexión');
        } finally {
            setBanSubmitting(false);
        }
    };

    const handleLiftBan = async (email) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`/api/admin/bans?email=${encodeURIComponent(email)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                fetchBans();
                showNotification('success', `Ban levantado: ${email}`);
            }
        } catch {
            showNotification('error', 'Error al levantar ban');
        }
    };

    const fetchAdminInvoices = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/admin/invoices', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setAdminInvoices(data.invoices || []);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    };

    const handleAction = async (userId, action, payload = {}, skipConfirm = false) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sesión expirada');

            if (action === 'toggle-pro') {
                const newStatus = payload.active ? 'active' : 'inactive';
                const now = new Date();
                now.setDate(now.getDate() + 30);
                const expiryDate = now.toISOString();

                const updates = {
                    subscription_status: newStatus,
                    plan_tier: payload.active ? 'professional' : 'free',
                    subscription_expiry: payload.active ? expiryDate : null,
                    quota_reset_at: now.toISOString(),
                    ai_messages_used: 0,
                    inquiries_used: 0,
                    research_reports_used: 0,
                    mp_preapproval_id: null,
                    mp_subscription_status: null
                };

                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ userId, updates })
                });

                if (!res.ok) throw new Error('Fallo en la actualización');
                showNotification('success', `Usuario ${payload.active ? 'activado' : 'desactivado'}.`);
            } else if (action === 'reset-usage') {
                const { error } = await supabase.from('profiles').update({
                    ai_messages_used: 0,
                    inquiries_used: 0,
                    research_reports_used: 0,
                    quota_reset_at: new Date().toISOString()
                }).eq('id', userId);
                if (error) throw error;
                showNotification('success', 'Uso reseteado.');
            } else if (action === 'revoke-access') {
                const updates = {
                    plan_tier: 'free',
                    subscription_status: 'inactive',
                    subscription_expiry: new Date().toISOString(),
                    quota_reset_at: new Date().toISOString(),
                    ai_messages_used: 0,
                    inquiries_used: 0,
                    research_reports_used: 0
                };
                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ userId, updates })
                });
                if (!res.ok) throw new Error('Fallo al revocar');
                showNotification('success', 'Acceso revocado.');
            } else if (action === 'verify-lawyer') {
                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ userId, updates: { verification_status: 'verified', rejection_reason: null } })
                });
                if (!res.ok) throw new Error('Fallo al verificar');
                showNotification('success', 'Abogado verificado.');
            } else if (action === 'reject-lawyer') {
                setRejectModal({ open: true, userId, matriculaId: null, reason: '' });
                return;
            } else if (action === 'reset-verification') {
                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ userId, updates: { verification_status: 'pending', rejection_reason: null } })
                });
                if (!res.ok) throw new Error('Fallo al resetear');
                showNotification('success', 'Verificación pendiente.');
            }

            initialFetch(session.user.id);
        } catch (err) {
            console.error(err);
            showNotification('error', err.message || 'Error en la operación');
        }
    };

    const handleVerifyMatricula = async (userId, matriculaId) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sesión expirada');
            const res = await fetch('/api/admin/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ action: 'update_matricula', userId, matriculaId, status: 'verified' })
            });
            if (!res.ok) throw new Error('Fallo al verificar matrícula');
            showNotification('success', 'Matrícula verificada.');
            initialFetch(session.user.id);
        } catch (err) {
            showNotification('error', err.message || 'Error al verificar');
        }
    };

    const handleRejectConfirm = async () => {
        if (!rejectModal.userId || !rejectModal.reason.trim()) {
            showNotification('error', 'Debés indicar un motivo de rechazo.');
            return;
        }
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sesión expirada');
            const body = rejectModal.matriculaId
                ? { action: 'update_matricula', userId: rejectModal.userId, matriculaId: rejectModal.matriculaId, status: 'rejected', rejection_reason: rejectModal.reason.trim() }
                : { userId: rejectModal.userId, updates: { verification_status: 'rejected', rejection_reason: rejectModal.reason.trim() } };
            const res = await fetch('/api/admin/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error('Fallo al rechazar');
            showNotification('success', 'Verificación rechazada con motivo.');
            setRejectModal({ open: false, userId: null, matriculaId: null, reason: '' });
            initialFetch(session.user.id);
        } catch (err) {
            console.error(err);
            showNotification('error', err.message || 'Error al rechazar');
        }
    };

    const handleInvoiceUpload = async (invoiceId, file) => {
        if (!file) return;

        setUploadingInvoice(invoiceId);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sesión expirada');

            // Upload file to Supabase Storage
            const fileName = `${invoiceId}.pdf`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('invoices')
                .getPublicUrl(fileName);

            // Update invoice record
            const res = await fetch('/api/admin/invoices', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ invoice_id: invoiceId, file_url: publicUrl })
            });

            if (!res.ok) throw new Error('Error al actualizar factura');

            showNotification('success', 'Factura adjuntada correctamente');
            fetchAdminInvoices();
        } catch (error) {
            console.error('Upload error:', error);
            showNotification('error', error.message || 'Error al subir factura');
        } finally {
            setUploadingInvoice(null);
        }
    };

    const showNotification = (type, title) => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications(prev => [...prev, { id, type, title }]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
    };

    const fetchAuditReport = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/admin/kb-audit', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAuditReport(data.report);
            }
        } catch (err) {
            console.error('Error fetching audit report:', err);
        }
    };

    const triggerAudit = async () => {
        setAuditLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/kb-audit', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Falló la auditoría');
            showNotification('success', `Auditoría completa: ${data.report?.valid_pdfs || 0} PDFs válidos`);
            fetchAuditReport();
        } catch (e) {
            showNotification('error', e.message || 'Error ejecutando auditoría');
        } finally {
            setAuditLoading(false);
        }
    };

    const triggerAuditFix = async (action, label) => {
        setAuditLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/kb-audit', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Error en ${label}`);
            const result = data.result || {};
            if (action === 'fix-urls') {
                showNotification('success', `URLs corregidas: ${result.fixed || 0}/${result.total || 0}`);
            } else {
                showNotification('success', `Archivos eliminados: ${result.deleted || 0}/${result.total || 0}`);
            }
            // Re-run audit to refresh report
            triggerAudit();
        } catch (e) {
            showNotification('error', e.message || `Error en ${label}`);
            setAuditLoading(false);
        }
    };

    const getChartData = () => {
        if (users.length === 0) return [];
        // Group users by plan tier and show AI usage
        const proUsers = users.filter(u => u.plan_tier === 'professional' && u.subscription_status === 'active');
        const freeUsers = users.filter(u => u.plan_tier !== 'professional' || u.subscription_status !== 'active');
        const proMessages = proUsers.reduce((acc, u) => acc + (u.ai_messages_used || 0), 0);
        const freeMessages = freeUsers.reduce((acc, u) => acc + (u.ai_messages_used || 0), 0);
        const proInquiries = proUsers.reduce((acc, u) => acc + (u.inquiries_used || 0), 0);
        const freeInquiries = freeUsers.reduce((acc, u) => acc + (u.inquiries_used || 0), 0);
        return [
            { name: 'Msjs Pro', val: proMessages, color: 'var(--gold)' },
            { name: 'Msjs Free', val: freeMessages, color: 'var(--admin-stroke-vibrant)' },
            { name: 'Consult Pro', val: proInquiries, color: 'var(--emerald)' },
            { name: 'Consult Free', val: freeInquiries, color: 'var(--admin-stroke-vibrant)' },
        ];
    };

    return (
        <AdminGuard>
            <div className="admin-page-root">
                <div className="max-w-[1600px] mx-auto space-y-12 pb-24 px-6">
                    {/* --- HEADER --- */}
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3 text-admin-muted font-black text-[10px] uppercase tracking-[0.4em]">
                                <Activity size={12} className="text-blue" />
                                <span>Centro de Mando Administrativo</span>
                            </div>
                            <h1 className="text-5xl font-black text-admin-primary tracking-tighter">Panel Judic-IA</h1>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-admin-secondary uppercase tracking-widest opacity-80">
                                <span className={`w-2 h-2 rounded-full ${health.status === 'healthy' ? 'bg-emerald animate-pulse' : 'bg-rose'}`} />
                                <span>Latencia: {health.latency}</span>
                                <span className="opacity-20 mx-2">|</span>
                                <span>Base de Datos: {health.database.toUpperCase()}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 flex-wrap items-center">
                            <button
                                onClick={() => initialFetch(currentUser?.id)}
                                className="action-btn w-12 h-12 rounded-xl"
                                title="Refrescar Datos"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin text-gold' : ''} />
                            </button>

                            <button
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const { data: { session } } = await supabase.auth.getSession();
                                        const res = await fetch('/api/admin/sync-usage', {
                                            method: 'POST',
                                            headers: { 'Authorization': `Bearer ${session?.access_token}` }
                                        });
                                        if (!res.ok) throw new Error('Falló la sincronización');
                                        const data = await res.json();
                                        showNotification('success', `Datos Sincronizados (${data.stats.updated} perfiles)`);
                                        initialFetch(currentUser?.id);
                                    } catch (e) {
                                        showNotification('error', 'Error al sincronizar');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="premium-btn emerald"
                            >
                                <Cloud size={16} />
                                <span>Sync Datos</span>
                            </button>

                            <button className="premium-btn">
                                <Download size={16} />
                                <span>Exportar</span>
                            </button>
                        </div>
                    </div>

                    {/* --- STATS --- */}
                    <div className="stat-grid">
                        <StatBox label="Usuarios" value={stats.totalUsers} delta="+12%" icon={Users} color="blue" />
                        <StatBox label="Planes PRO" value={stats.totalPro} delta="Active" icon={Crown} color="gold" />
                        <StatBox label="Revenue Mensual" value={`$${(stats.monthlyRevenue / 1000).toFixed(0)}k`} delta="ARS" icon={DollarSign} color="emerald" />
                        <StatBox label="Consumo AI" value={stats.totalUsage} delta="Msjs" icon={Activity} color="purple" />
                    </div>

                    {/* --- TAB NAVIGATION --- */}
                    <div className="admin-tabs">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`tab-trigger ${activeTab === 'users' ? 'active gold' : ''}`}
                        >
                            <Users size={14} />
                            Usuarios
                        </button>
                        <button
                            onClick={() => setActiveTab('subscriptions')}
                            className={`tab-trigger ${activeTab === 'subscriptions' ? 'active emerald' : ''}`}
                        >
                            <CreditCard size={14} />
                            Suscripciones MP
                            {users.filter(u => u.plan_tier === 'professional' && u.subscription_status === 'active').length > 0 && (
                                <span className="bg-emerald text-black text-[9px] font-black px-2 py-0.5 rounded-full ml-1">
                                    {users.filter(u => u.plan_tier === 'professional' && u.subscription_status === 'active').length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('verification')}
                            className={`tab-trigger ${activeTab === 'verification' ? 'active blue' : ''}`}
                        >
                            <BadgeCheck size={14} />
                            Verificación
                            {users.filter(u => u.role === 'lawyer' && u.verification_status === 'pending').length > 0 && (
                                <span className="bg-gold text-black text-[9px] font-black px-2 py-0.5 rounded-full ml-1 animate-pulse">
                                    {users.filter(u => u.role === 'lawyer' && u.verification_status === 'pending').length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('invoices')}
                            className={`tab-trigger ${activeTab === 'invoices' ? 'active gold' : ''}`}
                        >
                            <Receipt size={14} />
                            Facturas
                            {adminInvoices.filter(i => i.status === 'pending').length > 0 && (
                                <span className="bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full ml-1 animate-pulse">
                                    {adminInvoices.filter(i => i.status === 'pending').length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('kb-audit')}
                            className={`tab-trigger ${activeTab === 'kb-audit' ? 'active blue' : ''}`}
                        >
                            <HardDrive size={14} />
                            PDF Status
                            {auditReport?.invalid_files > 0 && (
                                <span className="bg-rose text-white text-[9px] font-black px-2 py-0.5 rounded-full ml-1 animate-pulse">
                                    {auditReport.invalid_files}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => { setActiveTab('bans'); fetchBans(); }}
                            className={`tab-trigger ${activeTab === 'bans' ? 'active rose' : ''}`}
                        >
                            <ShieldOff size={14} />
                            Bans
                            {bans.length > 0 && (
                                <span className="bg-rose text-white text-[9px] font-black px-2 py-0.5 rounded-full ml-1">
                                    {bans.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => { setActiveTab('estudios'); fetchEstudios(); }}
                            className={`tab-trigger ${activeTab === 'estudios' ? 'active gold' : ''}`}
                        >
                            <Building2 size={14} />
                            Estudios
                            {estudios.filter(e => e.verification_status === 'pending').length > 0 && (
                                <span className="bg-gold text-white text-[9px] font-black px-2 py-0.5 rounded-full ml-1 animate-pulse">
                                    {estudios.filter(e => e.verification_status === 'pending').length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => { setActiveTab('referidos'); fetchReferidos(); }}
                            className={`tab-trigger ${activeTab === 'referidos' ? 'active gold' : ''}`}
                        >
                            <Handshake size={14} />
                            Referidos
                            {referidos.summary.filter(v => v.pending > 0).length > 0 && (
                                <span className="bg-gold text-black text-[9px] font-black px-2 py-0.5 rounded-full ml-1 animate-pulse">
                                    {referidos.summary.filter(v => v.pending > 0).length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* --- CONTENT LAYOUT --- */}
                    <div className="space-y-8">
                        {/* Activity Chart Row */}
                        <div className="glass-card p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-admin-muted">Distribución de Consumo</h3>
                                <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest">
                                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-gold" /> Pro</span>
                                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald" /> Consultas</span>
                                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded opacity-30" style={{ background: 'var(--admin-stroke-vibrant)' }} /> Free</span>
                                </div>
                            </div>
                            {getChartData().length > 0 ? (
                                <ChartContainer data={getChartData()} />
                            ) : (
                                <div className="flex items-center justify-center h-[100px] text-admin-muted text-[10px] font-black uppercase tracking-widest opacity-40">
                                    Cargando datos...
                                </div>
                            )}
                        </div>

                        {/* Main Tab Content */}
                        <div>
                            {activeTab === 'users' && (
                                <div className="glass-card overflow-hidden flex flex-col border-emerald/5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="p-10 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div className="space-y-1">
                                            <h3 className="text-xl font-black text-admin-primary tracking-tighter">Base de Datos Central</h3>
                                            <p className="text-[10px] font-black text-admin-muted uppercase tracking-[0.3em] opacity-60">{filteredUsers.length} Registros Activos</p>
                                        </div>
                                        <div className="relative w-full md:w-auto">
                                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-admin-muted" size={16} />
                                            <input type="text" placeholder="Buscar por nombre o credencial..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                                className="bg-admin-surface border border-admin-stroke rounded-2xl py-4 pl-14 pr-8 text-sm text-admin-primary focus:outline-none focus:border-gold/40 w-full md:w-96 transition-all font-bold placeholder:text-admin-text-muted/50" />
                                        </div>
                                    </div>

                                    <div className="admin-table-container mx-10 mt-8 mb-10">
                                        <div className="user-table-grid table-header-row">
                                            <span className="table-header-item">Usuario</span>
                                            <span className="table-header-item">Credenciales</span>
                                            <span className="table-header-item">Contrato</span>
                                            <span className="table-header-item">Carga AI</span>
                                            <span className="table-header-item text-right">Comandos</span>
                                        </div>

                                        <div className="overflow-y-auto max-h-[600px]">
                                            {filteredUsers.map(user => (
                                                <div key={user.id} className="table-row user-table-grid group">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs border transition-all duration-500
                                                                ${user.subscription_status === 'active'
                                                                ? 'bg-gold text-black border-gold/50 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                                                                : 'bg-admin-surface text-admin-secondary border-admin-stroke group-hover:border-admin-stroke-vibrant'}`}>
                                                            {user.email[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-admin-primary text-sm tracking-tight">{user.full_name !== 'N/A' ? user.full_name : 'Usuario Anónimo'}</span>
                                                            <span className="text-[9px] font-black text-admin-muted uppercase tracking-widest opacity-40">#{user.id.slice(0, 8)}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <Mail size={12} className="text-admin-muted group-hover:text-blue transition-colors" />
                                                        <span className="text-[11px] font-mono text-admin-secondary italic truncate">{user.email}</span>
                                                    </div>

                                                    <div className="flex flex-col gap-1.5">
                                                        {user.subscription_status === 'active' ? (
                                                            <span className="bg-emerald/10 text-emerald px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald/20 w-fit">Professional</span>
                                                        ) : (
                                                            <span className="text-[9px] font-black uppercase text-admin-muted px-3 py-1 bg-white/5 rounded-full border border-white/5 w-fit">Basic Tier</span>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2 pr-4">
                                                        <div className="flex items-baseline gap-1.5 text-[10px] font-black">
                                                            <span className="text-admin-primary text-lg">{user.ai_messages_used || 0}</span>
                                                            <span className="text-admin-muted">/ {getPlanLimit(user.plan_tier || 'free', 'ai_messages')}</span>
                                                        </div>
                                                        <div className="h-1 bg-black/40 rounded-full overflow-hidden">
                                                            <div className="h-full bg-gold rounded-full transition-all duration-1000" style={{ width: `${Math.min(((user.ai_messages_used || 0) / getPlanLimit(user.plan_tier || 'free', 'ai_messages')) * 100, 100)}%` }} />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-end gap-2 pr-2">
                                                        <button onClick={() => handleAction(user.id, 'toggle-pro', { active: user.plan_tier !== 'professional' || user.subscription_status !== 'active' })}
                                                            className={`action-btn ${user.plan_tier === 'professional' && user.subscription_status === 'active' ? 'text-gold border-gold/30 bg-gold/10' : ''}`}
                                                            title="Toggle Professional"
                                                            aria-label={`${user.plan_tier === 'professional' ? 'Quitar' : 'Activar'} plan Professional para ${user.full_name || user.email}`}>
                                                            <Crown size={15} />
                                                        </button>
                                                        <button onClick={() => handleAction(user.id, 'reset-usage')}
                                                            className="action-btn text-emerald hover:bg-emerald/10 hover:border-emerald/30"
                                                            title="Resetear uso AI"
                                                            aria-label={`Resetear consumo de AI para ${user.full_name || user.email}`}>
                                                            <RefreshCw size={15} />
                                                        </button>
                                                        <button onClick={() => handleAction(user.id, 'revoke-access')}
                                                            className="action-btn text-rose hover:bg-rose/10 hover:border-rose/30"
                                                            title="Revocar acceso"
                                                            aria-label={`Revocar acceso para ${user.full_name || user.email}`}>
                                                            <Power size={15} />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (!window.confirm(`¿Banear a ${user.email}? No podrá registrarse ni iniciar sesión.`)) return;
                                                                const { data: { session: s } } = await supabase.auth.getSession();
                                                                fetch('/api/admin/bans', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s?.access_token}` },
                                                                    body: JSON.stringify({ email: user.email, reason: `Ban rápido desde panel – ${user.full_name || ''}` })
                                                                }).then(r => r.ok
                                                                    ? (showNotification('success', `${user.email} baneado`), fetchBans())
                                                                    : showNotification('error', 'Error al banear')
                                                                );
                                                            }}
                                                            className="action-btn"
                                                            style={{ color: '#f97316', borderColor: 'rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.06)' }}
                                                            title="Banear email"
                                                            aria-label={`Banear email ${user.email}`}>
                                                            <Ban size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'verification' && (
                                <div className="glass-card overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 py-10 px-10 border-b border-admin-stroke">
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-black text-admin-primary tracking-tighter">Verificación de Abogados</h3>
                                            <p className="text-admin-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Control de Identidad Profesional</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="badge-premium badge-pending flex items-center gap-2 py-2 px-4">
                                                <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                                                <span className="font-black">{users.filter(u => u.role === 'lawyer' && u.verification_status === 'pending').length}</span> Pendientes
                                            </div>
                                            <div className="badge-premium badge-verified flex items-center gap-2 py-2 px-4">
                                                <span className="w-2 h-2 rounded-full bg-emerald" />
                                                <span className="font-black">{users.filter(u => u.role === 'lawyer' && u.verification_status === 'verified').length}</span> Activos
                                            </div>
                                        </div>
                                    </div>

                                    <div className="admin-table-container mt-8 mx-10 mb-10 overflow-hidden">
                                        <div className="table-header-row verify-table-grid">
                                            <span className="table-header-item">Identidad Profesional</span>
                                            <span className="table-header-item">Matrícula y Jurisdicción</span>
                                            <span className="table-header-item">Estado de Red</span>
                                            <span className="table-header-item text-right">Comandos</span>
                                        </div>

                                        <div className="overflow-y-auto max-h-[600px]">
                                            {users.filter(u => u.role === 'lawyer').map(lawyer => (
                                                <div key={lawyer.id} className="verify-table-grid table-row group">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs border transition-all duration-500
                                                            ${lawyer.verification_status === 'verified'
                                                                ? 'bg-emerald/10 text-emerald border-emerald/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                                                : lawyer.verification_status === 'rejected'
                                                                    ? 'bg-rose/10 text-rose border-rose/20'
                                                                    : 'bg-gold/10 text-gold border-gold/20 shadow-[0_0_15px_rgba(251,191,36,0.1)]'}`}>
                                                            {lawyer.email[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-admin-primary text-sm tracking-tight">{lawyer.full_name !== 'N/A' ? lawyer.full_name : 'No Identificado'}</span>
                                                            <span className="text-[10px] text-admin-muted font-mono opacity-60">{lawyer.email}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col" style={{ gridColumn: 'span 2' }}>
                                                        {/* Per-matricula list */}
                                                        {Array.isArray(lawyer.matriculas) && lawyer.matriculas.length > 0 ? (
                                                            <ul aria-label="Matrículas" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                {lawyer.matriculas.map(m => (
                                                                    <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                        <span className="text-admin-secondary text-sm font-black tracking-tight">
                                                                            {m.colegio} · T°{m.tomo} F°{m.folio}
                                                                        </span>
                                                                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '99px', textTransform: 'uppercase', letterSpacing: '0.05em', background: m.status === 'verified' ? 'rgba(16,185,129,0.12)' : m.status === 'rejected' ? 'rgba(244,63,94,0.12)' : 'rgba(251,191,36,0.12)', color: m.status === 'verified' ? '#10b981' : m.status === 'rejected' ? '#f43f5e' : '#fbbf24' }}>
                                                                            {m.status === 'verified' ? '✅ Verificada' : m.status === 'rejected' ? '❌ Rechazada' : '🟡 Pendiente'}
                                                                        </span>
                                                                        {m.status !== 'verified' && (
                                                                            <button
                                                                                onClick={() => handleVerifyMatricula(lawyer.id, m.id)}
                                                                                className="action-btn text-emerald hover:bg-emerald/10 hover:border-emerald/30"
                                                                                aria-label={`Verificar ${m.colegio} T°${m.tomo} F°${m.folio}`}
                                                                                title="Verificar esta matrícula"
                                                                                style={{ padding: '2px 6px', fontSize: '10px', height: 'auto' }}
                                                                            >
                                                                                <ShieldCheck size={13} />
                                                                            </button>
                                                                        )}
                                                                        {m.status !== 'rejected' && (
                                                                            <button
                                                                                onClick={() => setRejectModal({ open: true, userId: lawyer.id, matriculaId: m.id, reason: '' })}
                                                                                className="action-btn text-rose hover:bg-rose/10 hover:border-rose/20"
                                                                                aria-label={`Rechazar ${m.colegio} T°${m.tomo} F°${m.folio}`}
                                                                                title="Rechazar esta matrícula"
                                                                                style={{ padding: '2px 6px', fontSize: '10px', height: 'auto' }}
                                                                            >
                                                                                <ShieldAlert size={13} />
                                                                            </button>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <>
                                                                <span className="text-admin-secondary text-sm font-black tracking-tight">{lawyer.matricula || 'N/D'}</span>
                                                                <span className="text-[10px] text-admin-muted uppercase tracking-widest font-bold opacity-60">{lawyer.jurisdiccion || 'Territorio No Especificado'}</span>
                                                            </>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <VerificationBadge status={lawyer.verification_status || 'pending'} size="md" />
                                                    </div>

                                                    <div className="flex items-center justify-end gap-3 pr-2">
                                                        {lawyer.verification_status !== 'verified' && (
                                                            <button
                                                                onClick={() => handleAction(lawyer.id, 'verify-lawyer')}
                                                                className="action-btn text-emerald hover:bg-emerald/10 hover:border-emerald/30"
                                                                aria-label="Aprobar abogado"
                                                                title="Aprobar"
                                                            >
                                                                <ShieldCheck size={18} />
                                                            </button>
                                                        )}
                                                        {lawyer.verification_status !== 'rejected' && (
                                                            <button
                                                                onClick={() => handleAction(lawyer.id, 'reject-lawyer')}
                                                                className="action-btn text-rose hover:bg-rose/10 hover:border-rose/20"
                                                                aria-label="Rechazar abogado"
                                                                title="Rechazar"
                                                            >
                                                                <ShieldAlert size={18} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleAction(lawyer.id, 'reset-verification')}
                                                            className="action-btn text-admin-muted hover:bg-white/5 opacity-40 hover:opacity-100"
                                                            aria-label="Reiniciar verificación"
                                                            title="Reiniciar"
                                                        >
                                                            <RefreshCw size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {users.filter(u => u.role === 'lawyer').length === 0 && (
                                                <div className="px-10 py-32 text-center animate-in fade-in zoom-in duration-500">
                                                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/5">
                                                        <ShieldQuestion size={48} className="text-admin-muted opacity-20" />
                                                    </div>
                                                    <h4 className="text-admin-primary font-black uppercase tracking-[0.3em] text-sm mb-3">Protocolos Vacíos</h4>
                                                    <p className="text-admin-muted text-[10px] font-bold uppercase tracking-widest opacity-60">No hay perfiles de abogados registrados en el sistema central</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'subscriptions' && (
                                <div className="glass-card overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="flex flex-col gap-6 py-10 px-10 border-b border-admin-stroke">
                                        <div className="flex flex-wrap justify-between items-center gap-4">
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-black text-admin-primary tracking-tighter">Suscripciones MercadoPago</h3>
                                                <p className="text-admin-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Monitoreo de Planes Profesionales</p>
                                            </div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <div className="badge-premium badge-verified flex items-center gap-2 py-2 px-4 rounded-full text-xs">
                                                    <DollarSign size={14} className="text-emerald" />
                                                    <span className="font-black">${(stats.monthlyRevenue || 0).toLocaleString('es-AR')}</span> ARS/mes
                                                </div>
                                                <div className="badge-premium badge-pending flex items-center gap-2 py-2 px-4 rounded-full text-xs">
                                                    <Crown size={14} className="text-gold" />
                                                    <span className="font-black">{users.filter(u => u.plan_tier === 'professional' && u.subscription_status === 'active').length}</span> Activas
                                                </div>
                                                {users.filter(u => u.subscription_status === 'past_due').length > 0 && (
                                                    <div className="badge-premium bg-rose/10 border-rose/20 text-rose flex items-center gap-2 py-2 px-4 rounded-full text-xs">
                                                        <AlertCircle size={14} />
                                                        <span className="font-black">{users.filter(u => u.subscription_status === 'past_due').length}</span> En Gracia
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-3 flex-wrap">
                                            <button
                                                onClick={async () => {
                                                    setLoading(true);
                                                    try {
                                                        const { data: { session } } = await supabase.auth.getSession();
                                                        const res = await fetch('/api/cron/check-expiry', {
                                                            method: 'GET',
                                                            headers: { 'Authorization': `Bearer ${session?.access_token}` }
                                                        });
                                                        const data = await res.json();
                                                        if (!res.ok) throw new Error(data.error || 'Error en CRON');
                                                        showNotification('success', `CRON Ejecutado: ${data.results?.renewed?.length || 0} renovadas, ${data.results?.downgraded?.length || 0} degradadas`);
                                                        initialFetch(currentUser?.id);
                                                    } catch (e) {
                                                        showNotification('error', 'Error ejecutando CRON');
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }}
                                                className="premium-btn emerald"
                                            >
                                                <Play size={16} />
                                                <span>Run Expiry Check</span>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setLoading(true);
                                                    try {
                                                        const { data: { session } } = await supabase.auth.getSession();
                                                        const res = await fetch('/api/cron/reset-quotas', {
                                                            method: 'GET',
                                                            headers: { 'Authorization': `Bearer ${session?.access_token}` }
                                                        });
                                                        const data = await res.json();
                                                        if (!res.ok) throw new Error(data.error || 'Error reseteando cuotas');
                                                        showNotification('success', `Cuotas reseteadas: ${data.count || 0} usuarios`);
                                                        initialFetch(currentUser?.id);
                                                    } catch (e) {
                                                        showNotification('error', 'Error reseteando cuotas');
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }}
                                                className="premium-btn"
                                            >
                                                <Zap size={16} />
                                                <span>Reset Quotas</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="admin-table-container mt-8 mx-10 mb-10 overflow-hidden">
                                        <div className="table-header-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1.5fr', gap: '1rem' }}>
                                            <span className="table-header-item">Usuario</span>
                                            <span className="table-header-item">MP ID</span>
                                            <span className="table-header-item">Status</span>
                                            <span className="table-header-item">Inicio</span>
                                            <span className="table-header-item">Vence</span>
                                            <span className="table-header-item text-right">Grace Period</span>
                                        </div>

                                        <div className="overflow-y-auto max-h-[600px]">
                                            {users.filter(u => u.plan_tier === 'professional').map(sub => {
                                                const expiryDate = sub.subscription_expiry ? new Date(sub.subscription_expiry) : null;
                                                const startedDate = sub.subscription_started_at ? new Date(sub.subscription_started_at) : null;
                                                const graceDate = sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at) : null;
                                                const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : null;

                                                return (
                                                    <div key={sub.id} className="table-row group" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1.5fr', gap: '1rem', alignItems: 'center' }}>
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs border transition-all
                                                                ${sub.subscription_status === 'active'
                                                                    ? 'bg-emerald/10 text-emerald border-emerald/20'
                                                                    : sub.subscription_status === 'past_due'
                                                                        ? 'bg-rose/10 text-rose border-rose/20'
                                                                        : 'bg-gold/10 text-gold border-gold/20'}`}>
                                                                {sub.email[0].toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-admin-primary text-sm tracking-tight">{sub.full_name || 'Sin nombre'}</span>
                                                                <span className="text-[10px] text-admin-muted font-mono opacity-60">{sub.email}</span>
                                                            </div>
                                                        </div>

                                                        <div className="text-admin-secondary text-xs font-mono truncate">
                                                            {sub.mp_preapproval_id ? (
                                                                <span className="text-blue">{sub.mp_preapproval_id.slice(0, 20)}...</span>
                                                            ) : (
                                                                <span className="text-admin-muted opacity-40">Manual</span>
                                                            )}
                                                        </div>

                                                        <div>
                                                            {sub.subscription_status === 'active' ? (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald/10 text-emerald border border-emerald/20 rounded-full text-[10px] font-black uppercase">
                                                                    <CheckCircle2 size={12} />
                                                                    Activa
                                                                </span>
                                                            ) : sub.subscription_status === 'past_due' ? (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose/10 text-rose border border-rose/20 rounded-full text-[10px] font-black uppercase">
                                                                    <AlertCircle size={12} />
                                                                    Gracia
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-admin-surface text-admin-muted border border-admin-stroke rounded-full text-[10px] font-black uppercase">
                                                                    Cancelada
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="text-admin-secondary text-xs">
                                                            {startedDate ? startedDate.toLocaleDateString('es-AR', {
                                                                day: '2-digit',
                                                                month: 'short'
                                                            }) : 'N/A'}
                                                        </div>

                                                        <div className="text-admin-secondary text-xs">
                                                            {expiryDate ? (
                                                                <div className="flex flex-col">
                                                                    <span>{expiryDate.toLocaleDateString('es-AR', {
                                                                        day: '2-digit',
                                                                        month: 'short'
                                                                    })}</span>
                                                                    {daysUntilExpiry !== null && (
                                                                        <span className={`text-[9px] font-black ${daysUntilExpiry < 7 ? 'text-rose' : daysUntilExpiry < 14 ? 'text-gold' : 'text-emerald'}`}>
                                                                            {daysUntilExpiry > 0 ? `${daysUntilExpiry}d restantes` : `Venció hace ${Math.abs(daysUntilExpiry)}d`}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : 'N/A'}
                                                        </div>

                                                        <div className="text-right text-xs">
                                                            {graceDate ? (
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-rose font-bold">{graceDate.toLocaleDateString('es-AR', {
                                                                        day: '2-digit',
                                                                        month: 'short'
                                                                    })}</span>
                                                                    <span className="text-[9px] text-rose/60 font-black">
                                                                        {Math.ceil((graceDate - new Date()) / (1000 * 60 * 60 * 24))}d de gracia
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-admin-muted opacity-40">—</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {users.filter(u => u.plan_tier === 'professional').length === 0 && (
                                                <div className="flex flex-col items-center justify-center py-32 px-10 animate-in fade-in zoom-in duration-500">
                                                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/5">
                                                        <CreditCard size={48} className="text-admin-muted opacity-20" />
                                                    </div>
                                                    <h4 className="text-admin-primary font-black uppercase tracking-[0.3em] text-sm mb-3 text-center">Sin Suscripciones</h4>
                                                    <p className="text-admin-muted text-[10px] font-bold uppercase tracking-widest opacity-60 text-center">No hay suscripciones profesionales activas</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'invoices' && (
                                <div className="glass-card overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="flex flex-col gap-6 py-10 px-10 border-b border-admin-stroke">
                                        <div className="flex flex-wrap justify-between items-center gap-4">
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-black text-admin-primary tracking-tighter">Gestión de Facturas</h3>
                                                <p className="text-admin-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Administración de Documentos Fiscales</p>
                                            </div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <div className="badge-premium badge-pending flex items-center gap-2 py-2 px-4 rounded-full text-xs">
                                                    <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                                                    <span className="font-black">{adminInvoices.filter(i => i.status === 'pending').length}</span> Pendientes
                                                </div>
                                                <div className="badge-premium badge-verified flex items-center gap-2 py-2 px-4 rounded-full text-xs">
                                                    <span className="w-2 h-2 rounded-full bg-emerald" />
                                                    <span className="font-black">{adminInvoices.filter(i => i.status === 'issued').length}</span> Emitidas
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="admin-table-container mt-8 mx-10 mb-10 overflow-hidden">
                                        <div className="table-header-row invoice-table-grid">
                                            <span className="table-header-item">Usuario</span>
                                            <span className="table-header-item">Descripción</span>
                                            <span className="table-header-item">Fecha Pago</span>
                                            <span className="table-header-item">Monto</span>
                                            <span className="table-header-item">Estado</span>
                                            <span className="table-header-item text-right">Acciones</span>
                                        </div>

                                        <div className="overflow-y-auto max-h-[600px]">
                                            {adminInvoices.map(invoice => (
                                                <div key={invoice.id} className="invoice-table-grid table-row group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs bg-gold/10 text-gold border border-gold/20">
                                                            {invoice.profiles?.email?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-admin-primary text-sm tracking-tight">{invoice.profiles?.full_name || 'Sin nombre'}</span>
                                                            <span className="text-[10px] text-admin-muted font-mono opacity-60">{invoice.profiles?.email || 'N/A'}</span>
                                                            {invoice.profiles?.cuit && (
                                                                <span className="text-[9px] text-gold font-mono opacity-80">CUIT: {formatCuit(invoice.profiles?.cuit)}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-admin-secondary text-sm truncate max-w-[200px]">
                                                        {invoice.description}
                                                    </div>

                                                    <div className="text-admin-muted text-sm">
                                                        {new Date(invoice.payment_date).toLocaleDateString('es-AR', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })}
                                                    </div>

                                                    <div className="text-emerald font-bold">
                                                        ${invoice.amount?.toLocaleString('es-AR')}
                                                    </div>

                                                    <div>
                                                        {invoice.status === 'pending' ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gold/10 text-gold border border-gold/20 rounded-full text-[10px] font-black uppercase">
                                                                <Clock size={12} />
                                                                Pendiente
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald/10 text-emerald border border-emerald/20 rounded-full text-[10px] font-black uppercase">
                                                                <CheckCircle2 size={12} />
                                                                Emitida
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-end gap-2 pr-2">
                                                        {invoice.status === 'pending' ? (
                                                            <label className="action-btn text-gold hover:bg-gold/10 hover:border-gold/30 cursor-pointer relative">
                                                                {uploadingInvoice === invoice.id ? (
                                                                    <RefreshCw size={15} className="animate-spin" />
                                                                ) : (
                                                                    <Upload size={15} />
                                                                )}
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf"
                                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                                    onChange={(e) => handleInvoiceUpload(invoice.id, e.target.files?.[0])}
                                                                    disabled={uploadingInvoice === invoice.id}
                                                                />
                                                            </label>
                                                        ) : (
                                                            <a
                                                                href={invoice.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="action-btn text-blue hover:bg-blue/10 hover:border-blue/30"
                                                                title="Ver factura"
                                                            >
                                                                <Eye size={15} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {adminInvoices.length === 0 && (
                                                <div className="flex flex-col items-center justify-center py-32 px-10 animate-in fade-in zoom-in duration-500">
                                                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/5">
                                                        <Receipt size={48} className="text-admin-muted opacity-20" />
                                                    </div>
                                                    <h4 className="text-admin-primary font-black uppercase tracking-[0.3em] text-sm mb-3 text-center">Sin Facturas</h4>
                                                    <p className="text-admin-muted text-[10px] font-bold uppercase tracking-widest opacity-60 text-center">No hay facturas registradas en el sistema</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'bans' && (
                                <div className="glass-card overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="p-10 border-b border-admin-stroke space-y-1">
                                        <h3 className="text-2xl font-black text-admin-primary tracking-tighter">Bans de Plataforma</h3>
                                        <p className="text-[10px] font-black text-admin-muted uppercase tracking-[0.3em] opacity-60">Bloqueo global por email — impide acceso a todos los abogados</p>
                                    </div>

                                    {/* Formulario para banear */}
                                    <div className="px-10 py-8 border-b border-admin-stroke">
                                        <form onSubmit={handleAddBan} className="flex flex-col md:flex-row gap-4 items-end">
                                            <div className="flex flex-col gap-2 flex-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-admin-muted">Email a banear</label>
                                                <input
                                                    type="email"
                                                    required
                                                    value={banEmail}
                                                    onChange={e => setBanEmail(e.target.value)}
                                                    placeholder="usuario@dominio.com"
                                                    className="bg-admin-surface border border-admin-stroke rounded-2xl py-4 px-6 text-sm text-admin-primary focus:outline-none focus:border-rose/40 font-bold placeholder:text-admin-text-muted/50 transition-all"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2 flex-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-admin-muted">Motivo (opcional)</label>
                                                <input
                                                    type="text"
                                                    value={banReason}
                                                    onChange={e => setBanReason(e.target.value)}
                                                    placeholder="Ej: abuso, spam, etc."
                                                    maxLength={200}
                                                    className="bg-admin-surface border border-admin-stroke rounded-2xl py-4 px-6 text-sm text-admin-primary focus:outline-none focus:border-rose/40 font-bold placeholder:text-admin-text-muted/50 transition-all"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={banSubmitting || !banEmail.trim()}
                                                className="premium-btn rose flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                                            >
                                                <ShieldOff size={16} />
                                                {banSubmitting ? 'Baneando...' : 'Banear Email'}
                                            </button>
                                        </form>
                                    </div>

                                    {/* Lista de bans */}
                                    <div className="mx-10 mt-8 mb-10">
                                        {bans.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-20">
                                                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                                                    <ShieldOff size={36} className="text-admin-muted opacity-20" />
                                                </div>
                                                <p className="text-admin-muted text-[10px] font-black uppercase tracking-widest opacity-60">Sin bans activos</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {bans.map(ban => (
                                                    <div key={ban.id} className="table-row flex items-center justify-between gap-4 group">
                                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                                            <div className="w-10 h-10 rounded-xl bg-rose/10 border border-rose/20 flex items-center justify-center shrink-0">
                                                                <ShieldOff size={16} className="text-rose" />
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-mono text-sm text-admin-primary font-bold truncate">{ban.email}</span>
                                                                {ban.reason && (
                                                                    <span className="text-[10px] text-admin-muted opacity-60 truncate">{ban.reason}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 shrink-0">
                                                            <span className="text-[9px] font-black text-admin-muted opacity-40 hidden md:block">
                                                                {new Date(ban.created_at).toLocaleDateString('es-AR')}
                                                            </span>
                                                            <button
                                                                onClick={() => handleLiftBan(ban.email)}
                                                                className="action-btn text-rose hover:bg-rose/10 hover:border-rose/30"
                                                                title="Levantar ban"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {activeTab === 'kb-audit' && (
                                <div className="glass-card overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="flex flex-col gap-6 py-10 px-10 border-b border-admin-stroke">
                                        <div className="flex flex-wrap justify-between items-center gap-4">
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-black text-admin-primary tracking-tighter">Estado de PDFs</h3>
                                                <p className="text-admin-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60">
                                                    Auditoría del Bucket Knowledge-Base
                                                    {auditReport?.ran_at && (
                                                        <span className="ml-2 text-blue">• Última: {new Date(auditReport.ran_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                onClick={triggerAudit}
                                                disabled={auditLoading}
                                                className="premium-btn emerald"
                                            >
                                                {auditLoading ? (
                                                    <><span className="animate-pulse">Auditando...</span><div className="w-4 h-4 border-2 border-emerald border-t-transparent rounded-full animate-spin" /></>
                                                ) : (
                                                    <><Play size={16} /> Ejecutar Auditoría</>
                                                )}
                                            </button>
                                        </div>

                                        {auditReport && (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="bg-emerald/10 border border-emerald/20 rounded-xl p-4 text-center">
                                                    <div className="text-2xl font-black text-emerald">{auditReport.valid_pdfs}</div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-emerald/60">PDFs Válidos</div>
                                                </div>
                                                <div className={`${auditReport.invalid_files > 0 ? 'bg-rose/10 border-rose/20' : 'bg-white/5 border-white/5'} border rounded-xl p-4 text-center`}>
                                                    <div className={`text-2xl font-black ${auditReport.invalid_files > 0 ? 'text-rose' : 'text-admin-muted'}`}>{auditReport.invalid_files}</div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-admin-muted">Inválidos</div>
                                                </div>
                                                <div className={`${auditReport.duplicate_groups > 0 ? 'bg-gold/10 border-gold/20' : 'bg-white/5 border-white/5'} border rounded-xl p-4 text-center`}>
                                                    <div className={`text-2xl font-black ${auditReport.duplicate_groups > 0 ? 'text-gold' : 'text-admin-muted'}`}>{auditReport.duplicate_groups}</div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-admin-muted">Duplicados</div>
                                                </div>
                                                <div className="bg-blue/10 border border-blue/20 rounded-xl p-4 text-center">
                                                    <div className="text-2xl font-black text-blue">{auditReport.db_rows}</div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-blue/60">Registros DB</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="admin-table-container mt-8 mx-10 mb-10 overflow-hidden">
                                        {auditReport?.details ? (
                                            <div className="space-y-6">
                                                {auditReport.details.invalid?.length > 0 && (
                                                    <div>
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose mb-3 flex items-center gap-2">
                                                            <XCircle size={14} /> PDFs Inválidos ({auditReport.details.invalid.length})
                                                        </h4>
                                                        {auditReport.details.invalid.map((item, i) => (
                                                            <div key={i} className="table-row flex items-center justify-between gap-4">
                                                                <span className="text-admin-primary text-xs font-mono truncate flex-1">{item.name}</span>
                                                                <span className="text-[9px] font-black uppercase text-rose/60 whitespace-nowrap">{item.reason}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {auditReport.details.orphan_db?.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gold flex items-center gap-2">
                                                                <AlertCircle size={14} /> DB con PDF_URL Roto ({auditReport.details.orphan_db.length})
                                                            </h4>
                                                            <button
                                                                onClick={() => triggerAuditFix('fix-urls', 'Fix URLs')}
                                                                disabled={auditLoading}
                                                                className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/20 text-gold hover:bg-gold/20 transition-all disabled:opacity-50"
                                                            >
                                                                Reparar URLs
                                                            </button>
                                                        </div>
                                                        {auditReport.details.orphan_db.map((item, i) => (
                                                            <div key={i} className="table-row flex items-center justify-between gap-4">
                                                                <span className="text-admin-primary text-xs font-bold truncate flex-1">{item.autos || 'Sin título'}</span>
                                                                <span className="text-[9px] font-mono text-admin-muted truncate max-w-[200px]">{item.pdf_url}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {auditReport.details.orphan_files?.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue flex items-center gap-2">
                                                                <FileText size={14} /> Archivos sin Registro en DB ({auditReport.details.orphan_files.length})
                                                            </h4>
                                                            <button
                                                                onClick={() => triggerAuditFix('clean-orphans', 'Clean Orphans')}
                                                                disabled={auditLoading}
                                                                className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-rose/10 border border-rose/20 text-rose hover:bg-rose/20 transition-all disabled:opacity-50"
                                                            >
                                                                Eliminar Huérfanos
                                                            </button>
                                                        </div>
                                                        {auditReport.details.orphan_files.map((item, i) => (
                                                            <div key={i} className="table-row flex items-center justify-between gap-4">
                                                                <span className="text-admin-primary text-xs font-mono truncate flex-1">{item.name}</span>
                                                                <span className="text-[9px] font-black text-admin-muted">{item.size > 1024 * 1024 ? `${(item.size / (1024 * 1024)).toFixed(1)} MB` : `${(item.size / 1024).toFixed(1)} KB`}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {auditReport.details.invalid?.length === 0 && auditReport.details.orphan_db?.length === 0 && auditReport.details.orphan_files?.length === 0 && (
                                                    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
                                                        <div className="w-20 h-20 bg-emerald/10 rounded-full flex items-center justify-center mb-6 border border-emerald/20">
                                                            <CheckCircle2 size={40} className="text-emerald" />
                                                        </div>
                                                        <h4 className="text-admin-primary font-black uppercase tracking-[0.3em] text-sm mb-2">Todo Limpio</h4>
                                                        <p className="text-admin-muted text-[10px] font-bold uppercase tracking-widest opacity-60">No se encontraron problemas en la última auditoría</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in duration-500">
                                                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/5">
                                                    <HardDrive size={48} className="text-admin-muted opacity-20" />
                                                </div>
                                                <h4 className="text-admin-primary font-black uppercase tracking-[0.3em] text-sm mb-3 text-center">Sin Reportes</h4>
                                                <p className="text-admin-muted text-[10px] font-bold uppercase tracking-widest opacity-60 text-center">Ejecutá una auditoría para ver el estado de los PDFs</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB: ESTUDIOS */}
                            {activeTab === 'estudios' && (() => {
                                const pending = estudios.filter(e => e.verification_status === 'pending').length;
                                const filtered = estudiosFilter === 'all' ? estudios
                                    : estudios.filter(e => e.verification_status === estudiosFilter);
                                return (
                                    <div className="glass-card overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
                                        {/* Header */}
                                        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 py-8 px-10 border-b border-admin-stroke">
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-black text-admin-primary tracking-tighter">Estudios Jurídicos</h3>
                                                <p className="text-admin-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60">
                                                    {estudios.length} registrados · {pending} pendiente{pending !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {/* Filtro */}
                                                <div className="estudio-filter-bar">
                                                    {[
                                                        { key: 'all', label: 'Todos' },
                                                        { key: 'pending', label: `Pendientes${pending > 0 ? ` (${pending})` : ''}` },
                                                        { key: 'verified', label: 'Verificados' },
                                                        { key: 'rejected', label: 'Rechazados' },
                                                    ].map(f => (
                                                        <button
                                                            key={f.key}
                                                            onClick={() => setEstudiosFilter(f.key)}
                                                            className={`estudio-filter-btn${estudiosFilter === f.key ? ' active' : ''}`}
                                                        >{f.label}</button>
                                                    ))}
                                                </div>
                                                <button onClick={fetchEstudios} className="action-btn" title="Actualizar">
                                                    <RefreshCw size={14} className={estudiosLoading ? 'animate-spin' : ''} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Lista */}
                                        <div className="mx-10 mt-8 mb-10">
                                            {estudiosLoading ? (
                                                <div className="flex justify-center py-20">
                                                    <RefreshCw size={28} className="animate-spin text-admin-muted opacity-40" />
                                                </div>
                                            ) : filtered.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-20">
                                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                                                        <Building2 size={36} className="text-admin-muted opacity-20" />
                                                    </div>
                                                    <p className="text-admin-muted text-[10px] font-black uppercase tracking-widest opacity-60">
                                                        {estudiosFilter === 'all' ? 'Sin estudios registrados' : 'Sin resultados para este filtro'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                    {filtered.map(estudio => {
                                                        const isPending = estudio.verification_status === 'pending';
                                                        const isVerified = estudio.verification_status === 'verified';
                                                        const isRejected = estudio.verification_status === 'rejected';
                                                        const badgeClass = isVerified ? 'text-emerald bg-emerald/10 border-emerald/20'
                                                            : isRejected ? 'text-rose bg-rose/10 border-rose/20'
                                                                : 'text-gold bg-gold/10 border-gold/20 animate-pulse';
                                                        const badgeLabel = isVerified ? 'Verificado' : isRejected ? 'Rechazado' : 'Pendiente';

                                                        return (
                                                            <div key={estudio.id} className={`table-row rounded-2xl flex flex-col gap-0 overflow-hidden border ${isPending ? 'border-gold/20' : isVerified ? 'border-emerald/15' : 'border-rose/15'}`}>
                                                                {/* Card header */}
                                                                <div className="flex items-start justify-between gap-3 p-5 pb-4">
                                                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                                                        <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                                                                            <Building2 size={17} className="text-gold" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="font-black text-admin-primary text-sm tracking-tight leading-tight truncate">
                                                                                {estudio.razon_social || estudio.name}
                                                                            </p>
                                                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeClass}`}>{badgeLabel}</span>
                                                                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-admin-stroke text-admin-muted">
                                                                                    {estudio.plan_tier?.replace(/_/g, ' ').toUpperCase()}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-[9px] text-admin-muted opacity-50 font-mono shrink-0 mt-1">
                                                                        {new Date(estudio.created_at).toLocaleDateString('es-AR')}
                                                                    </p>
                                                                </div>

                                                                {/* Datos del estudio */}
                                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 pb-4 text-[11px] text-admin-muted border-b border-admin-stroke">
                                                                    <span><strong className="text-admin-primary/60">CUIT</strong> {estudio.cuit || '-'}</span>
                                                                    <span><strong className="text-admin-primary/60">Tel</strong> {estudio.phone || '-'}</span>
                                                                    <span className="col-span-2"><strong className="text-admin-primary/60">Domicilio</strong> {estudio.domicilio || '-'}</span>
                                                                </div>

                                                                {/* Titular */}
                                                                {estudio.owner && (
                                                                    <div className="px-5 py-3 border-b border-admin-stroke">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-admin-surface border border-admin-stroke flex items-center justify-center text-[9px] font-black text-admin-muted shrink-0">
                                                                                {(estudio.owner.full_name || '?').slice(0, 2).toUpperCase()}
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="text-[11px] font-bold text-admin-primary truncate">{estudio.owner.full_name}</p>
                                                                                <p className="text-[10px] text-admin-muted font-mono truncate">{estudio.owner.email}</p>
                                                                            </div>
                                                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${estudio.owner.verification_status === 'verified' ? 'text-emerald bg-emerald/10 border-emerald/20' : 'text-gold bg-gold/10 border-gold/20'
                                                                                }`}>
                                                                                {estudio.owner.verification_status === 'verified' ? 'Matrícula OK' : 'Mat. pendiente'}
                                                                            </span>
                                                                        </div>
                                                                        {Array.isArray(estudio.owner.matriculas) && estudio.owner.matriculas.length > 0 && (
                                                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                                                {estudio.owner.matriculas.map((m, i) => (
                                                                                    <span key={i} className="text-[9px] font-mono bg-admin-surface border border-admin-stroke rounded-lg px-2 py-0.5 text-admin-muted">
                                                                                        {m.colegio} · T°{m.tomo} F°{m.folio}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {isRejected && estudio.rejection_reason && (
                                                                    <div className="px-5 py-3 text-[11px] text-rose border-b border-admin-stroke">
                                                                        <strong>Motivo de rechazo:</strong> {estudio.rejection_reason}
                                                                    </div>
                                                                )}

                                                                {/* Acciones */}
                                                                <div className="flex items-center justify-between gap-3 px-5 py-3">
                                                                    <p className="text-[9px] text-admin-muted opacity-40 font-mono truncate">ID: {estudio.id}</p>
                                                                    {isPending && (
                                                                        <div className="flex gap-2 shrink-0">
                                                                            <button
                                                                                onClick={() => handleEstudioAction(estudio.id, 'verify')}
                                                                                className="premium-btn emerald text-xs px-3 py-1.5 flex items-center gap-1.5"
                                                                                aria-label={`Verificar ${estudio.razon_social}`}
                                                                            >
                                                                                <CheckCircle2 size={12} /> Verificar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setRejectOrgModal({ open: true, orgId: estudio.id, reason: '' })}
                                                                                className="premium-btn rose text-xs px-3 py-1.5 flex items-center gap-1.5"
                                                                                aria-label={`Rechazar ${estudio.razon_social}`}
                                                                            >
                                                                                <XCircle size={12} /> Rechazar
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    {isVerified && (
                                                                        <span className="text-[10px] font-black text-emerald flex items-center gap-1">
                                                                            <CheckCircle2 size={12} /> Activo
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* TAB: REFERIDOS */}
                            {activeTab === 'referidos' && (
                                <div className="glass-card" role="region" aria-label="Panel de vendedores y referidos">
                                    {/* Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2rem 2.5rem', borderBottom: '1px solid var(--admin-stroke)' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--admin-text-primary)', letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>
                                                Vendedores &amp; Referidos
                                            </h3>
                                            <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.25em', color: 'var(--admin-text-muted)', opacity: 0.7 }}
                                                aria-live="polite">
                                                {referidos.codes.length} vendedores · {referidos.referrals.filter(r => r.status === 'converted').length} conversiones
                                            </p>
                                        </div>
                                        <button
                                            onClick={fetchReferidos}
                                            className="action-btn"
                                            aria-label="Actualizar lista de referidos"
                                            title="Actualizar"
                                        >
                                            <RefreshCw size={14} aria-hidden="true" className={referidosLoading ? 'animate-spin' : ''} />
                                        </button>
                                    </div>

                                    <div style={{ padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                                        {/* ── Formulario alta de vendedor ── */}
                                        <section className="ref-form-section" aria-labelledby="ref-form-heading">
                                            <h4 className="ref-form-title" id="ref-form-heading">
                                                <PlusCircle size={14} aria-hidden="true" />
                                                Nuevo Vendedor
                                            </h4>
                                            <form onSubmit={handleCreateVendor} className="ref-form-row" noValidate>
                                                <div className="ref-field ref-field--name">
                                                    <label htmlFor="ref-vendor-name">Nombre completo</label>
                                                    <input
                                                        id="ref-vendor-name"
                                                        className="ref-input"
                                                        type="text"
                                                        placeholder="Ej: Gabriel Rodríguez"
                                                        value={newVendor.name}
                                                        onChange={e => setNewVendor(p => ({ ...p, name: e.target.value }))}
                                                        autoComplete="name"
                                                        required
                                                        aria-required="true"
                                                    />
                                                </div>
                                                <div className="ref-field ref-field--num">
                                                    <label htmlFor="ref-commission">Comisión %</label>
                                                    <input
                                                        id="ref-commission"
                                                        className="ref-input"
                                                        type="number" min="1" max="50" step="0.5"
                                                        value={newVendor.commission_pct}
                                                        onChange={e => setNewVendor(p => ({ ...p, commission_pct: parseFloat(e.target.value) }))}
                                                        aria-describedby="ref-commission-hint"
                                                    />
                                                    <span id="ref-commission-hint" style={{ display: 'none' }}>Porcentaje de comisión sobre el pago neto</span>
                                                </div>
                                                <div className="ref-field ref-field--num">
                                                    <label htmlFor="ref-months">Meses ventana</label>
                                                    <input
                                                        id="ref-months"
                                                        className="ref-input"
                                                        type="number" min="1" max="24"
                                                        value={newVendor.recurring_months}
                                                        onChange={e => setNewVendor(p => ({ ...p, recurring_months: parseInt(e.target.value) }))}
                                                        aria-describedby="ref-months-hint"
                                                    />
                                                    <span id="ref-months-hint" style={{ display: 'none' }}>Cantidad de meses en que se paga comisión por cada cliente referido</span>
                                                </div>
                                                <button
                                                    type="submit"
                                                    className="premium-btn emerald"
                                                    disabled={vendorSubmitting || !newVendor.name.trim()}
                                                    aria-disabled={vendorSubmitting || !newVendor.name.trim()}
                                                    aria-busy={vendorSubmitting}
                                                >
                                                    <PlusCircle size={14} aria-hidden="true" />
                                                    {vendorSubmitting ? 'Generando...' : 'Generar Código'}
                                                </button>
                                            </form>

                                            {/* Código recién creado */}
                                            {createdCode && (
                                                <div className="ref-code-result" role="status" aria-live="polite" aria-label={`Código ${createdCode.code} generado para ${createdCode.name}`}>
                                                    <CheckCircle2 size={18} style={{ color: 'var(--emerald)', flexShrink: 0 }} aria-hidden="true" />
                                                    <div style={{ flex: 1 }}>
                                                        <p className="ref-code-result__label">Código generado para {createdCode.name}</p>
                                                        <p className="ref-code-result__code">{createdCode.code}</p>
                                                        <p className="ref-code-result__url">judic-ia.com/ref/{createdCode.code}</p>
                                                    </div>
                                                    <button
                                                        className="action-btn"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(`https://judic-ia.com/ref/${createdCode.code}`);
                                                            showNotification('success', 'Link copiado al portapapeles');
                                                        }}
                                                        aria-label={`Copiar link de referido para ${createdCode.name}`}
                                                        title="Copiar link"
                                                    >
                                                        <Copy size={14} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            )}
                                        </section>

                                        {/* ── Lista de vendedores ── */}
                                        <section aria-label="Lista de vendedores activos" aria-busy={referidosLoading}>
                                            {referidosLoading ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }} role="status" aria-label="Cargando vendedores">
                                                    <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--admin-text-muted)', opacity: 0.4 }} aria-hidden="true" />
                                                </div>
                                            ) : referidos.codes.length === 0 ? (
                                                <div className="ref-empty" role="status">
                                                    <Handshake size={40} aria-hidden="true" />
                                                    <p>Sin vendedores registrados</p>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                    {referidos.codes.map(vendor => {
                                                        const vendorReferrals = referidos.referrals.filter(r => r.code_id === vendor.id);
                                                        const summaryRow = referidos.summary.find(s => s.code === vendor.code) || {};
                                                        return (
                                                            <article
                                                                key={vendor.id}
                                                                className={`ref-vendor-card${!vendor.is_active ? ' ref-vendor-card--inactive' : ''}`}
                                                                aria-label={`Vendedor ${vendor.name}, código ${vendor.code}, ${vendor.is_active ? 'activo' : 'bloqueado'}`}
                                                            >
                                                                <div className="ref-vendor-header">
                                                                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                                                        <div className="ref-vendor-avatar" aria-hidden="true">{vendor.name[0]}</div>
                                                                        <div className="ref-vendor-meta">
                                                                            <p className="ref-vendor-name">{vendor.name}</p>
                                                                            <div className="ref-vendor-pills">
                                                                                <span className={`ref-pill ${vendor.is_active ? 'ref-pill--active' : 'ref-pill--inactive'}`}>
                                                                                    {vendor.is_active ? 'Activo' : 'Bloqueado'}
                                                                                </span>
                                                                                <span className="ref-pill ref-pill--code">{vendor.code}</span>
                                                                                <span className="ref-pill ref-pill--info">{vendor.commission_pct}% · {vendor.recurring_months}m</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                        <div className="ref-vendor-stats">
                                                                            <p className="ref-vendor-stats__amount">ARS {parseFloat(summaryRow.total_commission_ars || 0).toLocaleString('es-AR')}</p>
                                                                            <p className="ref-vendor-stats__sub">{summaryRow.converted || 0} conversiones</p>
                                                                        </div>
                                                                        {vendor.is_active && (
                                                                            <button
                                                                                className="action-btn"
                                                                                onClick={() => setReplaceModal({ open: true, codeId: vendor.id, codeName: vendor.name })}
                                                                                aria-label={`Reemplazar código de ${vendor.name}. El código actual quedará bloqueado.`}
                                                                                title="Reemplazar código"
                                                                            >
                                                                                <RotateCcw size={14} aria-hidden="true" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {vendorReferrals.length > 0 && (
                                                                    <div className="ref-referral-list" role="list" aria-label={`${vendorReferrals.length} clientes referidos por ${vendor.name}`}>
                                                                        {vendorReferrals.map(r => {
                                                                            const clientName = r.profiles?.full_name || r.organizations?.razon_social || r.organizations?.name || 'Desconocido';
                                                                            const effectiveMax = r.type === 'estudio' ? Math.min(vendor.recurring_months, 3) : Math.min(vendor.recurring_months, 1);
                                                                            const mesesLeft = Math.max(0, effectiveMax - (r.conversion_count || 0));
                                                                            return (
                                                                                <div
                                                                                    key={r.id}
                                                                                    className="ref-referral-row"
                                                                                    role="listitem"
                                                                                    aria-label={`${clientName}, ${r.status}, ${mesesLeft} meses restantes, ARS ${parseFloat(r.commission_amount || 0).toLocaleString('es-AR')}`}
                                                                                >
                                                                                    <div className="ref-referral-left">
                                                                                        <span className={`ref-pill ${r.status === 'converted' ? 'ref-pill--active' : 'ref-pill--code'}`} aria-hidden="true">
                                                                                            {r.status === 'converted' ? 'Pagó' : 'Pendiente'}
                                                                                        </span>
                                                                                        <span className="ref-referral-name">{clientName}</span>
                                                                                        <span className="ref-referral-type">{r.type}</span>
                                                                                    </div>
                                                                                    <div className="ref-referral-right">
                                                                                        <span className="ref-months-text">
                                                                                            {r.conversion_count || 0}/{effectiveMax}m ·{' '}
                                                                                            <span className={mesesLeft > 0 ? 'ref-months-gold' : ''}>
                                                                                                {mesesLeft > 0 ? `${mesesLeft} rest.` : 'Agotado'}
                                                                                            </span>
                                                                                        </span>
                                                                                        <span className="ref-commission-val">ARS {parseFloat(r.commission_amount || 0).toLocaleString('es-AR')}</span>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </article>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </section>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- MODAL: REEMPLAZAR CÓDIGO DE VENDEDOR --- */}
                {replaceModal.open && (
                    <div className="modal-overlay" onClick={() => setReplaceModal({ open: false, codeId: null, codeName: '' })}>
                        <div className="premium-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header-strip" />
                            <div className="p-10 space-y-6">
                                <div className="flex items-center gap-4 text-gold">
                                    <RotateCcw size={28} />
                                    <h3 className="text-xl font-black tracking-tighter">Reemplazar Código</h3>
                                </div>
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4">
                                    <p className="text-sm text-amber-300 font-bold">⚠️ El código anterior quedará <strong>bloqueado permanentemente</strong>. Todo el progreso y comisiones del vendedor se preservan automáticamente en el nuevo código.</p>
                                </div>
                                <p className="text-admin-secondary text-sm">Se generará un nuevo código para <strong className="text-admin-primary">{replaceModal.codeName}</strong>. Todos los clientes referidos con el código anterior seguirán asignados a este vendedor.</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setReplaceModal({ open: false, codeId: null, codeName: '' })} className="premium-btn flex-1">
                                        Cancelar
                                    </button>
                                    <button onClick={handleReplaceCode} className="premium-btn emerald flex-1">
                                        <RotateCcw size={14} /> Confirmar Reemplazo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODAL: RECHAZAR ESTUDIO --- */}
                {rejectOrgModal.open && (
                    <div className="modal-overlay" onClick={() => setRejectOrgModal({ open: false, orgId: null, reason: '' })}>
                        <div className="premium-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header-strip" />
                            <div className="p-10 space-y-6">
                                <div className="flex items-center gap-4 text-rose">
                                    <XCircle size={28} />
                                    <h3 className="text-xl font-black tracking-tighter">Rechazar Estudio</h3>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-admin-muted">Motivo de rechazo</label>
                                    <textarea
                                        value={rejectOrgModal.reason}
                                        onChange={e => setRejectOrgModal(prev => ({ ...prev, reason: e.target.value }))}
                                        placeholder="Ej: CUIT no encontrado en ARCA, matrícula no válida..."
                                        rows={3}
                                        className="bg-admin-surface border border-admin-stroke rounded-2xl py-4 px-6 text-sm text-admin-primary focus:outline-none focus:border-rose/40 font-bold placeholder:text-admin-text-muted/50 transition-all resize-none"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setRejectOrgModal({ open: false, orgId: null, reason: '' })}
                                        className="premium-btn flex-1"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleEstudioAction(rejectOrgModal.orgId, 'reject', rejectOrgModal.reason);
                                            setRejectOrgModal({ open: false, orgId: null, reason: '' });
                                        }}
                                        disabled={!rejectOrgModal.reason.trim()}
                                        className="premium-btn rose flex-1 disabled:opacity-50"
                                    >
                                        Confirmar Rechazo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODALS & NOTIFICATIONS --- */}
                {activeModal && (
                    <div className="modal-overlay" onClick={() => setActiveModal(null)}>
                        <div className="premium-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header-strip" />
                            <div className="p-10 space-y-8">
                                <div className="flex items-center gap-4 text-gold">
                                    <ShieldCheck size={32} />
                                    <h3 className="text-2xl font-black tracking-tighter">{activeModal.title}</h3>
                                </div>
                                <p className="text-admin-secondary text-sm font-medium leading-relaxed">
                                    {activeModal.message}
                                </p>

                                {activeModal.userInput && (
                                    <input
                                        type="number"
                                        id="modal-input"
                                        defaultValue={activeModal.defaultValue}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-gold/50 font-black text-xl tracking-widest"
                                        autoFocus
                                    />
                                )}

                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setActiveModal(null)} className="flex-1 py-5 rounded-2xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                                        Cancelar
                                    </button>
                                    <button onClick={() => {
                                        const val = document.getElementById('modal-input')?.value;
                                        activeModal.onConfirm(activeModal.userInput ? val : null);
                                        setActiveModal(null);
                                    }} className="flex-1 py-5 rounded-2xl bg-gold text-black text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all shadow-[0_15px_30px_rgba(251,191,36,0.2)]">
                                        Confirmar Acción
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="toast-container">
                    {notifications.map(n => (
                        <div key={n.id} className="premium-toast">
                            <div className={`w-3 h-3 rounded-full ${n.type === 'error' ? 'bg-rose' : 'bg-emerald'} shadow-[0_0_15px_currentColor]`} />
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-admin-muted mb-1">{n.type === 'error' ? 'Alerta de Seguridad' : 'Sistema Actualizado'}</p>
                                <p className="text-admin-primary text-sm font-bold tracking-tight">{n.title}</p>
                            </div>
                            <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} className="text-admin-muted hover:text-admin-primary">
                                <XCircle size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            {/* REJECT REASON MODAL */}
            {rejectModal.open && (
                <div className="admin-modal-overlay" onClick={() => setRejectModal({ open: false, userId: null, matriculaId: null, reason: '' })}>
                    <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black text-admin-primary mb-4">Motivo de Rechazo</h3>
                        <p className="text-admin-muted text-sm mb-4">Indicá por qué se rechaza la verificación. El abogado verá este motivo en su perfil.</p>
                        <div className="admin-reject-reasons">
                            {[
                                'Matrícula incorrecta o no encontrada en el colegio indicado.',
                                'Jurisdicción no coincide con la matrícula proporcionada.',
                                'Datos del Tomo y/o Folio no coinciden con los registros oficiales.',
                                'Matrícula vencida o suspendida.',
                                'Nombre no coincide con el titular de la matrícula.'
                            ].map(preset => (
                                <button
                                    key={preset}
                                    type="button"
                                    className={`admin-reject-preset ${rejectModal.reason === preset ? 'active' : ''}`}
                                    onClick={() => setRejectModal(prev => ({ ...prev, reason: preset }))}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                        <textarea
                            className="admin-reject-textarea"
                            placeholder="O escribí un motivo personalizado..."
                            value={rejectModal.reason}
                            onChange={e => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                            rows={3}
                        />
                        <div className="admin-modal-actions">
                            <button
                                className="admin-modal-btn-cancel"
                                onClick={() => setRejectModal({ open: false, userId: null, matriculaId: null, reason: '' })}
                            >
                                Cancelar
                            </button>
                            <button
                                className="admin-modal-btn-reject"
                                onClick={handleRejectConfirm}
                                disabled={!rejectModal.reason.trim()}
                            >
                                <ShieldAlert size={16} /> Confirmar Rechazo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminGuard >
    );
}

function StatBox({ label, value, delta, icon: Icon, color }) {
    const config = {
        blue: { glass: 'bg-blue/10 border-blue/20', text: 'text-blue', shadow: 'shadow-blue/20' },
        gold: { glass: 'bg-gold/10 border-gold/20', text: 'text-gold', shadow: 'shadow-gold/20' },
        emerald: { glass: 'bg-emerald/10 border-emerald/20', text: 'text-emerald', shadow: 'shadow-emerald/20' },
        purple: { glass: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-400', shadow: 'shadow-indigo-500/20' },
    };
    const theme = config[color] || config.blue;

    return (
        <div className="glass-card p-8 flex flex-col gap-6 group hover:translate-y-[-4px] transition-all duration-300">
            <div className="flex justify-between items-start">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme.glass} ${theme.text} ${theme.shadow} shadow-lg transition-transform group-hover:scale-110 duration-500`}>
                    <Icon size={24} strokeWidth={2.5} />
                </div>
                <div className="text-[10px] font-black uppercase text-admin-muted tracking-[0.2em]">{delta}</div>
            </div>
            <div className="space-y-1">
                <div className="text-5xl font-black text-admin-primary tracking-tighter group-hover:scale-[1.02] transition-transform origin-left">{value || 0}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-admin-muted opacity-60">{label}</div>
            </div>
        </div>
    );
}

function ChartContainer({ data }) {
    const containerRef = useRef(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const w = entry.contentRect.width;
                if (w > 0) setWidth(w);
            }
        });
        observer.observe(containerRef.current);
        // Initial measurement
        const w = containerRef.current.getBoundingClientRect().width;
        if (w > 0) setWidth(w);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} style={{ width: '100%', minHeight: 180 }}>
            {width > 0 && (
                <BarChart width={width} height={180} data={data} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-stroke)" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--admin-text-muted)', fontSize: 9, fontWeight: 900 }} />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'var(--admin-surface-vibrant)', border: '1px solid var(--admin-stroke)', borderRadius: '12px' }} />
                    <Bar dataKey="val" radius={[8, 8, 0, 0]} barSize={48}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            )}
        </div>
    );
}
