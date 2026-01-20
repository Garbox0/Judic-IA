
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

// --- Theme Tokens ---
const adminStyles = `
  .admin-page-root {
    --bg0: #020617;
    --bg1: #0f172a;
    --card: rgba(15, 23, 42, 0.50);
    --stroke: rgba(255, 255, 255, 0.08);
    --gold: #fbbf24;
    --radius-xl: 32px;
    background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, var(--bg0) 80%);
    min-height: 100vh;
    font-family: 'Outfit', sans-serif;
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 1280px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 640px) { .stat-grid { grid-template-columns: 1fr; } }

  .glass-card {
    background: var(--card);
    backdrop-filter: blur(25px);
    border: 1px solid var(--stroke);
    border-radius: var(--radius-xl);
    box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.6);
  }
  .user-table-grid {
    display: grid;
    grid-template-columns: 1.8fr 1.8fr 1.6fr 1.8fr 1fr;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--stroke);
    gap: 1.5rem;
  }
  .user-table-header {
    background: rgba(255, 255, 255, 0.02);
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #475569;
  }
  .action-btn {
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 12px; background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05); color: #94a3b8;
    transition: all 0.2s;
  }
  .action-btn:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); color: white; }
  .action-btn.active-pro { color: var(--gold); border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.05); }
  .loading-container { height: 100vh; display: flex; flex-direction: column; items-center; justify-center; gap: 1rem; color: #94a3b8; }

  /* Premium Modal */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(15px);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem; animation: fadeIn 0.3s ease;
  }
  .premium-modal {
    width: 100%; max-width: 480px;
    background: #0f172a; border: 1px solid var(--stroke);
    border-radius: 28px; overflow: hidden;
    box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 0.7);
    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .modal-header-strip { height: 4px; background: linear-gradient(to right, var(--gold), #f59e0b); }
  
  /* Toasts */
  .toast-container {
    position: fixed; bottom: 2rem; right: 2rem;
    display: flex; flex-direction: column; gap: 0.75rem; z-index: 200;
  }
  .premium-toast {
    padding: 1rem 1.5rem; border-radius: 20px;
    background: #1e293b; border: 1px solid var(--stroke);
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    display: flex; align-items: center; gap: 1rem;
    animation: slideLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    min-width: 320px;
  }
  
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { transform: translateY(20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
  @keyframes slideLeft { from { transform: translateX(50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
`;

export default function AdminDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [health, setHealth] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState(null);

    // Premium UI State
    const [notifications, setNotifications] = useState([]);
    const [activeModal, setActiveModal] = useState(null); // { title: string, message: string, onConfirm: fn }

    // 1. ABSOLUTE GUARD (INVISIBLE REDIRECT)
    useEffect(() => {
        const verifyAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;

                if (!user || user.email !== 'gbrlescalada@gmail.com' || user.id !== '365cd259-4f1e-4004-a677-1eda06a5147e') {
                    router.replace('/dashboard');
                    return;
                }

                setCurrentUser(user);
                setIsAdmin(true);
                initialFetch(user.id);
            } catch (e) {
                router.replace('/dashboard');
            }
        };
        verifyAuth();
    }, [router]);

    const initialFetch = async (uid) => {
        try {
            // First health check
            const hRes = await fetch('/api/admin/health');
            const hData = await hRes.json();
            setHealth(hData);

            // Fetch users
            const uRes = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid })
            });
            const uData = await uRes.json();
            setStats(uData.stats);
            setUsers(uData.users);

            setLoading(false);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    // Live monitoring intervals
    useEffect(() => {
        if (!isAdmin || !currentUser) return;

        const hInt = setInterval(async () => {
            try {
                const res = await fetch('/api/admin/health');
                const data = await res.json();
                setHealth(data);
            } catch { setHealth(null); }
        }, 5000);

        const dInt = setInterval(async () => {
            try {
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id })
                });
                const data = await res.json();
                setStats(data.stats);
                setUsers(data.users);
            } catch { }
        }, 30000);

        return () => { clearInterval(hInt); clearInterval(dInt); };
    }, [isAdmin, currentUser]);

    if (!isAdmin) return null; // Invisible while checking

    const addNotification = (title, type = 'success') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, title, type }]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
    };

    const handleAction = async (targetId, action, payload = {}, skipConfirm = false) => {
        const confirmRequest = (onConfirm) => {
            if (skipConfirm) {
                onConfirm();
                return;
            }
            setActiveModal({
                title: 'Confirmar Acción',
                message: `¿Estás seguro que deseas ejecutar "${action}" en este usuario?`,
                onConfirm
            });
        };

        const exec = async () => {
            try {
                const res = await fetch('/api/admin/users/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminId: currentUser.id, targetUserId: targetId, action, payload })
                });
                if (res.ok) {
                    addNotification(`Acción "${action}" ejecutada con éxito`);
                    initialFetch(currentUser.id);
                } else {
                    const data = await res.json();
                    addNotification(data.error || 'Error en la petición', 'error');
                }
            } catch (err) {
                addNotification(err.message, 'error');
            }
        };

        confirmRequest(exec);
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getChartData = () => [
        { name: 'Intensivos', val: users.filter(u => u.ai_messages_used > 50).length, fill: '#fbbf24' },
        { name: 'Medios', val: users.filter(u => u.ai_messages_used > 10 && u.ai_messages_used <= 50).length, fill: '#10b981' },
        { name: 'Nuevos', val: users.filter(u => u.ai_messages_used > 0 && u.ai_messages_used <= 10).length, fill: '#3b82f6' },
        { name: 'Inactivos', val: users.filter(u => u.ai_messages_used === 0).length, fill: '#475569' },
    ];

    return (
        <div className="admin-page-root text-slate-200 p-6 md:p-12 font-sans overflow-x-hidden">
            <style>{adminStyles}</style>

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
                        <button onClick={() => initialFetch(currentUser.id)} className="p-4 glass-card hover:bg-white/10 transition-all active:scale-95">
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
                                            <div className="h-full bg-gradient-to-r from-gold to-orange-600 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(251,191,36,0.2)]" style={{ width: `${Math.min(user.usage_percent, 100)}%` }} />
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
