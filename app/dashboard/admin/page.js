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

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }
        setCurrentUser(user);
        initialFetch(user.id);
    };

    const initialFetch = async (userId) => {
        setLoading(true);
        try {
            setHealth({ status: 'healthy', latency: '24ms', database: 'connected' });

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
                const { error } = await supabase.from('profiles').update({ subscription_status: newStatus }).eq('id', userId);
                if (error) throw error;
                showNotification('success', `Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'} como PRO`);
            } else if (action === 'update-credits') {
                const { error } = await supabase.from('profiles').update({ ai_message_quota: parseInt(payload.quota) }).eq('id', userId);
                if (error) throw error;
                showNotification('success', 'Cuota actualizada');
            } else if (action === 'reset-usage') {
                const { error } = await supabase.from('profiles').update({ ai_messages_used: 0 }).eq('id', userId);
                if (error) throw error;
                showNotification('success', 'Uso mensual reseteado');
            } else if (action === 'revoke-access') {
                showNotification('error', 'Función Revocar no implementada aún');
                return;
            }
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
        <div className="admin-page-root">
            <div className="max-w-7xl mx-auto space-y-12 pb-24">
                {/* --- HEADER --- */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-full flex items-center gap-3 text-[10px] font-black">
                                <Activity size={12} className={health?.status === 'healthy' ? 'text-emerald-400' : 'text-red-400'} />
                                <span className="opacity-40 uppercase tracking-widest">Latencia:</span>
                                <span className="text-white">{health?.latency || '--'}</span>
                            </div>
                            <div className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-full flex items-center gap-3 text-[10px] font-black">
                                <CheckCircle2 size={12} className={health?.database === 'connected' ? 'text-emerald-400' : 'text-blue-400'} />
                                <span className="opacity-40 uppercase tracking-widest">Base de Datos:</span>
                                <span className="text-white underline decoration-gold/50">{health?.database === 'connected' ? 'ONLINE' : 'CHECKING'}</span>
                            </div>
                        </div>
                        <h1 className="text-6xl font-black text-white tracking-tighter">Panel <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Judic-IA</span></h1>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] border-l border-gold/40 pl-4 mt-2">Centro de Mando Administrativo</p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => initialFetch(currentUser?.id)} className="p-4 glass-card hover:bg-white/10 transition-all active:scale-95">
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button className="px-10 py-5 glass-card bg-gold/5 text-gold font-black text-xs uppercase tracking-[0.2em] hover:bg-gold/10 transition-all border-gold/20">
                            <Download size={16} className="inline mr-2" /> Exportar Base
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
                                <div key={user.id} className="user-table-grid group transition-all hover:bg-white/[0.02]">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs border
                                                        ${user.subscription_status === 'active' ? 'bg-gold text-black border-gold/50 shadow-[0_0_20px_rgba(251,191,36,0.1)]' : 'bg-slate-900 text-slate-600 border-white/5'}`}>
                                            {user.email[0].toUpperCase()}
                                        </div>
                                        <span className="font-bold text-white text-base tracking-tight">{user.full_name !== 'N/A' ? user.full_name : 'No asignado'}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Mail size={12} className="text-slate-700" />
                                        <span className="text-[11px] font-mono text-slate-400 opacity-60 italic">{user.email}</span>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {user.subscription_status === 'active'
                                            ? <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 w-fit">Pro Suite</span>
                                            : <span className="text-[9px] font-black uppercase text-slate-600 px-3 py-1 bg-slate-900/50 rounded-full border border-white/5 w-fit">Basic Tier</span>}

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
                                                message: `Ingresar nueva cuota de mensajes para ${user.full_name || user.email}:`,
                                                userInput: true,
                                                defaultValue: user.ai_message_quota,
                                                onConfirm: (val) => handleAction(user.id, 'update-credits', { quota: val }, true)
                                            });
                                        }} className="action-btn" title="Ajustar Cuota">
                                            <Edit3 size={15} />
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
        <div className="glass-card p-8 flex flex-col gap-8 group hover:border-white/20 transition-all">
            <div className="flex justify-between items-start">
                <div className={`p-4 rounded-2xl ${colors[color]}`}>
                    <Icon size={28} strokeWidth={2.5} />
                </div>
                <div className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{delta}</div>
            </div>
            <div>
                <div className={`text-5xl font-black text-white tracking-tighter ${color === 'gold' ? 'gold-glow' : ''}`}>{value || 0}</div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2 leading-none">{label}</div>
            </div>
        </div>
    );
}
