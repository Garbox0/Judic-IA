'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import {
    Users,
    Crown,
    Activity,
    Search,
    ShieldCheck,
    TrendingUp,
    AlertCircle,
    RefreshCw,
    Download,
    Cloud,
    CheckCircle2,
    XCircle,
    Power,
    Edit3,
    Calendar,
    ArrowUpRight,
    Mail,
    Lock,
    BadgeCheck,
    ShieldAlert,
    ShieldQuestion,
    Receipt,
    Upload,
    FileText,
    Clock,
    Eye
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
    const [activeTab, setActiveTab] = useState('users'); // 'users' | 'verification' | 'invoices'
    const [adminInvoices, setAdminInvoices] = useState([]);
    const [uploadingInvoice, setUploadingInvoice] = useState(null);
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
            const totalPro = profiles?.filter(u => u.subscription_status === 'active').length || 0;
            const totalMessages = profiles?.reduce((acc, curr) => acc + (curr.ai_messages_used || 0), 0) || 0;
            const totalUsage = totalMessages > 1000 ? `${(totalMessages / 1000).toFixed(1)}k` : totalMessages;

            setStats({
                totalUsers,
                totalPro,
                totalUsage,
                totalMessages
            });

        } catch (error) {
            console.error('Error fetching admin data:', error);
            showNotification('error', 'Error al cargar datos');
        } finally {
            setLoading(false);
        }

        // Also fetch invoices
        fetchAdminInvoices();
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
                    plan_tier: payload.active ? 'professional' : 'basic',
                    ai_message_quota: payload.active ? 1000 : 20,
                    subscription_expiry: payload.active ? expiryDate : null,
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
            } else if (action === 'update-credits') {
                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ userId, updates: { ai_message_quota: parseInt(payload.quota) } })
                });
                if (!res.ok) throw new Error('Fallo al actualizar cuota');
                showNotification('success', 'Cuota actualizada.');
            } else if (action === 'reset-usage') {
                const { error } = await supabase.from('profiles').update({ ai_messages_used: 0 }).eq('id', userId);
                if (error) throw error;
                showNotification('success', 'Uso reseteado.');
            } else if (action === 'revoke-access') {
                const updates = {
                    plan_tier: 'free',
                    subscription_status: 'inactive',
                    subscription_expiry: new Date().toISOString(),
                    ai_message_quota: 20
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

    const getChartData = () => {
        return [
            { name: 'Lun', val: 40 },
            { name: 'Mar', val: 65 },
            { name: 'Mié', val: 45 },
            { name: 'Jue', val: 90 },
            { name: 'Vie', val: 75 },
            { name: 'Sáb', val: 30 },
            { name: 'Dom', val: 20 },
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
                        <StatBox label="Consumo AI" value={stats.totalUsage} delta="Msjs" icon={Activity} color="emerald" />
                        <StatBox label="Status Web" value={health.status === 'healthy' ? '100%' : '50%'} delta="LIVE" icon={TrendingUp} color="purple" />
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
                            onClick={() => setActiveTab('verification')}
                            className={`tab-trigger ${activeTab === 'verification' ? 'active emerald' : ''}`}
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
                    </div>

                    {/* --- CONTENT LAYOUT --- */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Sidebar Chart */}
                        <div className="glass-card p-10 flex flex-col items-center">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-admin-muted mb-10 w-full text-center">Niveles de Actividad</h3>
                            <div className="w-full h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={getChartData()}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-stroke)" vertical={false} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--admin-text-muted)', fontSize: 9, fontWeight: 900 }} />
                                        <YAxis hide />
                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'var(--admin-surface-vibrant)', border: '1px solid var(--admin-stroke)', borderRadius: '12px', backdropFilter: 'blur(10px)' }} />
                                        <Bar dataKey="val" radius={[8, 8, 0, 0]} barSize={36}>
                                            {getChartData().map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 2 ? 'var(--gold)' : 'var(--admin-stroke-vibrant)'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Main Tab Content */}
                        <div className="xl:col-span-2">
                            {activeTab === 'users' ? (
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
                                                            <span className="text-admin-primary text-lg">{user.ai_messages_used}</span>
                                                            <span className="text-admin-muted">/ {user.ai_message_quota || 20}</span>
                                                        </div>
                                                        <div className="h-1 bg-black/40 rounded-full overflow-hidden">
                                                            <div className="h-full bg-gold rounded-full transition-all duration-1000" style={{ width: `${Math.min((user.ai_messages_used / (user.ai_message_quota || 20)) * 100, 100)}%` }} />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-end gap-2 pr-2">
                                                        <button onClick={() => handleAction(user.id, 'toggle-pro', { active: user.subscription_status !== 'active' })}
                                                            className={`action-btn ${user.subscription_status === 'active' ? 'text-gold border-gold/30 bg-gold/10' : ''}`} title="Swap Subscription">
                                                            <Crown size={15} />
                                                        </button>
                                                        <button onClick={() => handleAction(user.id, 'revoke-access')} className="action-btn text-rose hover:bg-rose/10 hover:border-rose/30" title="Revive Access">
                                                            <Power size={15} />
                                                        </button>
                                                        <button onClick={() => {
                                                            setActiveModal({
                                                                title: 'Protocolo de Cuota',
                                                                message: `Ajustar límite mensual para ${user.email}:`,
                                                                userInput: true,
                                                                defaultValue: user.ai_message_quota,
                                                                onConfirm: (val) => handleAction(user.id, 'update-credits', { quota: val })
                                                            });
                                                        }} className="action-btn">
                                                            <Edit3 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
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
