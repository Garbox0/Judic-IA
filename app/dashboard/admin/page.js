'use client';

import { useState, useEffect } from 'react';
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
    HardDrive
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
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
    const [activeTab, setActiveTab] = useState('users'); // 'users' | 'verification' | 'invoices' | 'subscriptions' | 'kb-audit'
    const [adminInvoices, setAdminInvoices] = useState([]);
    const [uploadingInvoice, setUploadingInvoice] = useState(null);
    const [auditReport, setAuditReport] = useState(null);
    const [auditLoading, setAuditLoading] = useState(false);
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

        // Also fetch invoices and audit
        fetchAdminInvoices();
        fetchAuditReport();
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
                    body: JSON.stringify({ userId, updates: { verification_status: 'verified' } })
                });
                if (!res.ok) throw new Error('Fallo al verificar');
                showNotification('success', 'Abogado verificado.');
            } else if (action === 'reject-lawyer') {
                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ userId, updates: { verification_status: 'rejected' } })
                });
                if (!res.ok) throw new Error('Fallo al rechazar');
                showNotification('success', 'Verificación rechazada.');
            } else if (action === 'reset-verification') {
                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ userId, updates: { verification_status: 'pending' } })
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
                                <div style={{ width: '100%', height: 200 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={getChartData()} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-stroke)" vertical={false} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--admin-text-muted)', fontSize: 9, fontWeight: 900 }} />
                                            <YAxis hide />
                                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'var(--admin-surface-vibrant)', border: '1px solid var(--admin-stroke)', borderRadius: '12px' }} />
                                            <Bar dataKey="val" radius={[8, 8, 0, 0]} barSize={48}>
                                                {getChartData().map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
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
                                                            className={`action-btn ${user.plan_tier === 'professional' && user.subscription_status === 'active' ? 'text-gold border-gold/30 bg-gold/10' : ''}`} title="Toggle Professional">
                                                            <Crown size={15} />
                                                        </button>
                                                        <button onClick={() => handleAction(user.id, 'reset-usage')} className="action-btn text-emerald hover:bg-emerald/10 hover:border-emerald/30" title="Reset Usage">
                                                            <RefreshCw size={15} />
                                                        </button>
                                                        <button onClick={() => handleAction(user.id, 'revoke-access')} className="action-btn text-rose hover:bg-rose/10 hover:border-rose/30" title="Revoke Access">
                                                            <Power size={15} />
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

                                                    <div className="flex flex-col">
                                                        <span className="text-admin-secondary text-sm font-black tracking-tight">{lawyer.matricula || 'N/D'}</span>
                                                        <span className="text-[10px] text-admin-muted uppercase tracking-widest font-bold opacity-60">{lawyer.jurisdiccion || 'Territorio No Especificado'}</span>
                                                    </div>

                                                    <div>
                                                        <VerificationBadge status={lawyer.verification_status || 'pending'} size="md" />
                                                    </div>

                                                    <div className="flex items-center justify-end gap-3 pr-2">
                                                        {lawyer.verification_status !== 'verified' && (
                                                            <button
                                                                onClick={() => handleAction(lawyer.id, 'verify-lawyer')}
                                                                className="action-btn text-emerald hover:bg-emerald/10 hover:border-emerald/30"
                                                                title="Aprobar"
                                                            >
                                                                <ShieldCheck size={18} />
                                                            </button>
                                                        )}
                                                        {lawyer.verification_status !== 'rejected' && (
                                                            <button
                                                                onClick={() => handleAction(lawyer.id, 'reject-lawyer')}
                                                                className="action-btn text-rose hover:bg-rose/10 hover:border-rose/20"
                                                                title="Rechazar"
                                                            >
                                                                <ShieldAlert size={18} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleAction(lawyer.id, 'reset-verification')}
                                                            className="action-btn text-admin-muted hover:bg-white/5 opacity-40 hover:opacity-100"
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
                                                            headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET || 'dev-secret'}` }
                                                        });
                                                        const data = await res.json();
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
                                                            headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET || 'dev-secret'}` }
                                                        });
                                                        const data = await res.json();
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
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-3 flex items-center gap-2">
                                                            <AlertCircle size={14} /> DB con PDF_URL Roto ({auditReport.details.orphan_db.length})
                                                        </h4>
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
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue mb-3 flex items-center gap-2">
                                                            <FileText size={14} /> Archivos sin Registro en DB ({auditReport.details.orphan_files.length})
                                                        </h4>
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
                        </div>
                    </div>
                </div>

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
