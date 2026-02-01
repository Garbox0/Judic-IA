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
    Lock
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
        const { data: { user } } = await supabase.auth.getSession();
        if (!user || !user.session) {
            // Check session strictly
            const { data: { user: dbUser } } = await supabase.auth.getUser();
            if (!dbUser) {
                router.push('/login');
                return;
            }
            setCurrentUser(dbUser);
            initialFetch(dbUser.id);
        } else {
            setCurrentUser(user);
            initialFetch(user.id);
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
        // Trigger ping immediately
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
    };

    const handleAction = async (userId, action, payload = {}, skipConfirm = false) => {
        try {
            if (action === 'toggle-pro') {
                const newStatus = payload.active ? 'active' : 'inactive';
                // Calculate 30 days expiry for manual activation
                const now = new Date();
                now.setDate(now.getDate() + 30);
                const expiryDate = now.toISOString();

                const updates = {
                    subscription_status: newStatus,
                    plan_tier: payload.active ? 'professional' : 'basic',
                    ai_message_quota: payload.active ? 1000 : 20,
                    // If activating, set expiry to +30 days so sync logic respects it. 
                    subscription_expiry: payload.active ? expiryDate : null,
                    // CRITICAL: Clear external IDs so sync logic doesn't try to validate with MP and fail
                    mp_preapproval_id: payload.active ? null : null,
                    mp_subscription_status: payload.active ? null : null
                };
                const { data: { session } } = await supabase.auth.getSession();
                console.log('Sending Update to Admin API:', updates);

                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ userId, updates })
                });

                const apiData = await res.json();

                if (!res.ok) throw new Error(apiData.error || 'Error en la API de administración');

                console.log('API Update Success:', apiData.data);
                showNotification('success', `Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'} como profesional.`);
            } else if (action === 'update-credits') {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ userId, updates: { ai_message_quota: parseInt(payload.quota) } })
                });
                if (!res.ok) throw new Error('Error en API');
                showNotification('success', 'Cuota actualizada correctamente.');
            } else if (action === 'set-usage') {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ userId, updates: { ai_messages_used: parseInt(payload.usage) } })
                });
                if (!res.ok) throw new Error('Error en API');
                showNotification('success', 'Consumo actualizado correctamente.');
            } else if (action === 'reset-usage') {
                const { error } = await supabase.from('profiles').update({ ai_messages_used: 0 }).eq('id', userId);
                if (error) throw error;
                showNotification('success', 'Uso mensual reseteado');
            } else if (action === 'revoke-access') {
                const { data: { session } } = await supabase.auth.getSession();
                const updates = {
                    plan_tier: 'free',
                    subscription_status: 'inactive',
                    subscription_expiry: new Date().toISOString(),
                    mp_preapproval_id: null,
                    mp_subscription_status: null,
                    ai_message_quota: 20
                };

                const res = await fetch('/api/admin/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ userId, updates })
                });
                if (!res.ok) throw new Error('Error en API al revocar');
                showNotification('success', 'Acceso revocado y cuenta degradada a Basic.');
            }
            // Optimistic Update
            setUsers(prev => prev.map(u => {
                if (u.id === userId) {
                    if (action === 'toggle-pro') {
                        return {
                            ...u,
                            subscription_status: payload.active ? 'active' : 'inactive',
                            plan_tier: payload.active ? 'professional' : 'basic',
                            ai_message_quota: payload.active ? 1000 : 20
                        };
                    }
                    if (action === 'update-credits') return { ...u, ai_message_quota: parseInt(payload.quota) };
                    if (action === 'set-usage') return { ...u, ai_messages_used: parseInt(payload.usage) };
                    if (action === 'reset-usage') return { ...u, ai_messages_used: 0 };
                    if (action === 'revoke-access') {
                        return {
                            ...u,
                            plan_tier: 'free',
                            subscription_status: 'inactive',
                            subscription_expiry: new Date().toISOString(),
                            mp_preapproval_id: null,
                            mp_subscription_status: null,
                            ai_message_quota: 20
                        };
                    }
                }
                return u;
            }));

            // Then fetch to ensure sync
            initialFetch(currentUser.id);
        } catch (err) {
            console.error(err);
            showNotification('error', 'Fallo en la operación');
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
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
                        <div className="space-y-4 max-w-2xl">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="px-4 py-1.5 bg-slate-900/80 border border-emerald-500/30 rounded-full flex items-center gap-3 text-[10px] font-black shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                    <Activity size={12} className={health?.status === 'healthy' ? 'text-emerald-400' : 'text-red-400'} />
                                    <span className="opacity-60 text-slate-400 uppercase tracking-widest">Latencia:</span>
                                    <span className="text-white font-mono">{health?.latency}</span>
                                </div>
                                <div className="px-4 py-1.5 bg-slate-900/80 border border-blue-500/30 rounded-full flex items-center gap-3 text-[10px] font-black shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                                    <CheckCircle2 size={12} className={health?.database === 'connected' ? 'text-emerald-400' : 'text-blue-400'} />
                                    <span className="opacity-60 text-slate-400 uppercase tracking-widest">Base de Datos:</span>
                                    <span className="text-blue-100">{health?.database === 'connected' ? 'ONLINE' : 'CHECKING'}</span>
                                </div>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter drop-shadow-2xl">
                                Panel <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-500 to-amber-600 filter drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">Judic-IA</span>
                            </h1>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] border-l-2 border-amber-500 pl-4 mt-2">
                                Centro de Mando Administrativo
                            </p>
                        </div>

                        <div className="flex gap-4 flex-wrap items-center">
                            {/* Refresh Button */}
                            <button
                                onClick={() => initialFetch(currentUser?.id)}
                                className="w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-2xl bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white hover:border-amber-400/50 hover:bg-amber-400/10 hover:shadow-[0_0_15px_rgba(251,191,36,0.2)] transition-all active:scale-95"
                                title="Refrescar Datos"
                            >
                                <RefreshCw size={22} className={loading ? 'animate-spin text-amber-400' : ''} />
                            </button>

                            {/* Sync Button */}
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
                                        initialFetch(currentUser?.id); // Refresh UI
                                    } catch (e) {
                                        showNotification('error', 'Error al sincronizar');
                                        console.error(e);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="group relative h-14 px-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-500/20 hover:border-emerald-400/60 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all overflow-hidden flex items-center flex-shrink-0"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-700" />
                                <div className="flex items-center gap-3">
                                    <Cloud size={18} className="group-hover:scale-110 transition-transform" />
                                    <span>Sync Datos</span>
                                </div>
                            </button>

                            {/* Export Button */}
                            <button className="h-14 px-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-amber-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-amber-500/10 hover:border-amber-400/60 hover:shadow-[0_0_20px_rgba(251,191,36,0.2)] transition-all flex items-center gap-3 flex-shrink-0">
                                <Download size={18} />
                                <span>Exportar</span>
                            </button>
                        </div>
                    </div>

                    {/* --- STATS --- */}
                    <div className="stat-grid">
                        <StatBox label="Usuarios" value={stats?.totalUsers} delta="+12%" icon={Users} color="blue" />
                        <StatBox label="Planes PRO" value={stats?.totalPro} delta="Active" icon={Crown} color="gold" />
                        <StatBox label="Consumo AI" value={stats?.totalUsage} delta="Msjs" icon={Activity} color="emerald" />
                        <StatBox label="Status Web" value={health?.status === 'healthy' ? '100%' : '50%'} delta="LIVE" icon={TrendingUp} color="purple" />
                    </div>

                    {/* --- SECTIONS --- */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <div className="glass-card p-10 flex flex-col items-center">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 mb-12 w-full text-center">Niveles de Actividad</h3>
                            <div className="w-full h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={getChartData()}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9, fontWeight: 900 }} />
                                        <YAxis hide />
                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.01)' }} contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px' }} />
                                        <Bar dataKey="val" radius={[12, 12, 0, 0]} barSize={42} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card xl:col-span-2 overflow-hidden flex flex-col">
                            <div className="p-10 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Base de Datos de Usuarios</h3>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                                    <input type="text" placeholder="Filtrar por nombre o mail..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                        className="bg-black/20 border border-white/5 rounded-full py-3 pl-12 pr-8 text-xs text-white focus:outline-none focus:border-gold/20 w-80 transition-all font-medium" />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <div className="user-table-grid user-table-header">
                                    <span>Nombre del Profesional</span>
                                    <span>Mail de Acceso</span>
                                    <span>Plan Contractual</span>
                                    <span>Consumo AI</span>
                                    <span className="text-right">Herramientas</span>
                                </div>

                                {filteredUsers.map(user => (
                                    <div key={user.id} className="user-table-grid group transition-all hover:bg-white/[0.05] border-b border-white/[0.02] last:border-0">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs border
                                                        ${user.subscription_status === 'active' ? 'bg-amber-400 text-black border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.2)]' : 'bg-slate-800 text-slate-500 border-white/5'}`}>
                                                {user.email[0].toUpperCase()}
                                            </div>
                                            <span className="font-bold text-white text-base tracking-tight">{user.full_name !== 'N/A' ? user.full_name : 'No asignado'}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Mail size={12} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                                            <span className="text-[11px] font-mono text-slate-500 group-hover:text-slate-300 transition-colors opacity-80 italic">{user.email}</span>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            {user.subscription_status === 'active' ? (
                                                <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 w-fit">Pro Suite</span>
                                            ) : user.subscription_status === 'cancelled' && user.plan_tier === 'professional' ? (
                                                <span className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-500/20 w-fit flex items-center gap-1">
                                                    <ShieldCheck size={10} /> Cancelado (Pro)
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black uppercase text-slate-600 px-3 py-1 bg-slate-900/50 rounded-full border border-white/5 w-fit">Basic Tier</span>
                                            )}

                                            <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-1">
                                                    <Calendar size={8} /> Alta: {user.subscription_started_at ? new Date(user.subscription_started_at).toLocaleDateString() : new Date(user.created_at).toLocaleDateString()}
                                                </span>
                                                <span className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-1">
                                                    <ArrowUpRight size={8} /> Vence: {user.subscription_expiry ? new Date(user.subscription_expiry).toLocaleDateString() : 'Manual'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pr-8">
                                            <div className="flex items-baseline gap-1.5 text-[10px] font-black tracking-tighter">
                                                <span className="text-white text-lg">{user.ai_messages_used}</span>
                                                <span className="text-slate-700 text-xs">/ {user.ai_message_quota || '∞'}</span>
                                                <span className="text-slate-600 text-[8px] ml-auto uppercase opacity-50">Mensajes</span>
                                            </div>
                                            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5 p-[1px]">
                                                <div className="h-full bg-gradient-to-r from-gold to-orange-600 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(251,191,36,0.2)]" style={{ width: `${Math.min(user.usage_percent || 0, 100)}%` }} />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleAction(user.id, 'toggle-pro', { active: user.subscription_status !== 'active' })}
                                                className={`action-btn ${user.subscription_status === 'active' ? 'active-pro' : ''}`} title="Upgrade a PRO">
                                                <Crown size={15} />
                                            </button>
                                            <button onClick={() => {
                                                setActiveModal({
                                                    title: 'Ajustar Cuota',
                                                    message: `Nueva cuota mensual para ${user.full_name || user.email}:`,
                                                    userInput: true,
                                                    inputType: 'number',
                                                    defaultValue: user.ai_message_quota,
                                                    onConfirm: (val) => handleAction(user.id, 'update-credits', { quota: val }, true)
                                                });
                                            }} className="action-btn" title="Ajustar Cuota">
                                                <Edit3 size={15} />
                                            </button>
                                            <button onClick={() => {
                                                setActiveModal({
                                                    title: 'Ajustar Consumo',
                                                    message: `Modificar consumo actual para ${user.full_name || user.email} (Testing):`,
                                                    userInput: true,
                                                    inputType: 'number',
                                                    defaultValue: user.ai_messages_used,
                                                    onConfirm: (val) => handleAction(user.id, 'set-usage', { usage: val }, true)
                                                });
                                            }} className="action-btn" title="Forzar Consumo (Test)">
                                                <Activity size={15} />
                                            </button>
                                            <button onClick={() => handleAction(user.id, 'reset-usage')} className="action-btn" title="Limpiar Uso Mensual">
                                                <RefreshCw size={14} />
                                            </button>
                                            <button onClick={() => handleAction(user.id, 'revoke-access')} className="action-btn text-red-500/20 hover:text-red-500 hover:bg-red-500/10" title="Revocar Acceso">
                                                <Power size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- PREMIUM MODAL OVERLAY --- */}
                {activeModal && (
                    <div className="modal-overlay" onClick={() => setActiveModal(null)}>
                        <div className="premium-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header-strip" />
                            <div className="p-8 space-y-6">
                                <div className="flex items-center gap-4 text-gold">
                                    <ShieldCheck size={24} />
                                    <h3 className="text-xl font-black tracking-tight">{activeModal.title}</h3>
                                </div>
                                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                    {activeModal.message}
                                </p>

                                {activeModal.userInput && (
                                    <input
                                        type="number"
                                        id="modal-input"
                                        defaultValue={activeModal.defaultValue}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50 font-bold"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.target.value;
                                                activeModal.onConfirm(val);
                                                setActiveModal(null);
                                            }
                                        }}
                                    />
                                )}

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setActiveModal(null)}
                                        className="flex-1 py-4 rounded-2xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => {
                                            const val = document.getElementById('modal-input')?.value;
                                            activeModal.onConfirm(activeModal.userInput ? val : null);
                                            setActiveModal(null);
                                        }}
                                        className="flex-1 py-4 rounded-2xl bg-gold text-black text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all shadow-[0_10px_20px_rgba(251,191,36,0.2)]"
                                    >
                                        Confirmar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TOAST CONTAINER --- */}
                <div className="toast-container">
                    {notifications.map(n => (
                        <div key={n.id} className="premium-toast">
                            <div className={`w-2 h-2 rounded-full ${n.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            <div className="flex-1">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">{n.type === 'error' ? 'Error' : 'Éxito'}</p>
                                <p className="text-white text-[13px] font-bold tracking-tight">{n.title}</p>
                            </div>
                            <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} className="text-white/20 hover:text-white">
                                <XCircle size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </AdminGuard >
    );
}

function StatBox({ label, value, delta, icon: Icon, color }) {
    const colors = {
        blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
        gold: 'text-gold bg-gold/10 border-gold/20',
        emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
        purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    };
    return (
        <div className={`glass-card p-8 flex flex-col gap-8 group border border-white/5 hover:border-${color === 'gold' ? 'amber-400' : colors[color].split(' ')[0].replace('text-', '')}/50 transition-all duration-300 hover:shadow-2xl hover:bg-white/[0.02]`}>
            <div className="flex justify-between items-start">
                <div className={`p-4 rounded-2xl ${colors[color]} shadow-lg`}>
                    <Icon size={28} strokeWidth={2.5} />
                </div>
                <div className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] group-hover: text-white transition-colors">{delta}</div>
            </div>
            <div>
                <div className={`text-5xl font-black text-white tracking-tighter ${color === 'gold' ? 'gold-glow' : ''} group-hover:scale-105 transition-transform origin-left`}>{value || 0}</div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2 leading-none group-hover:text-slate-400 transition-colors">{label}</div>
            </div>
        </div>
    );
}
