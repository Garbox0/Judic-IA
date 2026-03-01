"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useSearchParams } from 'next/navigation';
import { Coins, ShoppingCart, CheckCircle2, XCircle, Clock, User, AlertCircle, Scale } from 'lucide-react';

const PACKS = [
    { id: 'pack_5',  credits: 5,  price: '$25.000', sub: '$5.000 por crédito' },
    { id: 'pack_15', credits: 15, price: '$60.000', sub: '$4.000 por crédito', featured: true },
    { id: 'pack_30', credits: 30, price: '$99.000', sub: '$3.300 por crédito' },
];

const STATUS_LABELS = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' };
const STATUS_ICONS  = { approved: <CheckCircle2 size={14} color="#22c55e" />, rejected: <XCircle size={14} color="#ef4444" />, pending: <Clock size={14} color="#f59e0b" /> };

function formatDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function BalanceCard({ pool, icon }) {
    return (
        <div className="estudio-stat-card" style={{ gridColumn: '1 / -1', maxWidth: 300 }}>
            <div className="estudio-stat-icon" style={{ background: pool > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
                {icon}
            </div>
            <div>
                <div className="estudio-stat-value" style={{ color: pool > 0 ? 'var(--text-primary)' : '#ef4444' }}>
                    {pool ?? '…'}
                </div>
                <div className="estudio-stat-label">Créditos disponibles</div>
            </div>
        </div>
    );
}

function PackGrid({ packs, buying, onBuy }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {packs.map(p => (
                <button
                    key={p.id}
                    type="button"
                    onClick={() => onBuy(p.id)}
                    disabled={buying}
                    style={{
                        background: p.featured ? 'var(--accent)' : 'var(--card-bg)',
                        color: p.featured ? '#020617' : 'var(--text-primary)',
                        border: `1px solid ${p.featured ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 10,
                        padding: '1rem',
                        cursor: buying ? 'not-allowed' : 'pointer',
                        opacity: buying ? 0.6 : 1,
                        textAlign: 'left',
                        transition: 'opacity 0.15s',
                    }}
                >
                    <div style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: 4 }}>{p.credits} créditos</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 4 }}>{p.price}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{p.sub}</div>
                    {p.featured && (
                        <span style={{ display: 'inline-block', marginTop: 8, background: 'rgba(0,0,0,0.15)', borderRadius: 4, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                            Más popular
                        </span>
                    )}
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                        <ShoppingCart size={13} /> Comprar
                    </div>
                </button>
            ))}
        </div>
    );
}

function HistoryTabs({ activeTab, setActiveTab, purchases, usage, usageQueryCol }) {
    return (
        <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                {[{ id: 'compras', label: 'Historial de compras' }, { id: 'uso', label: 'Uso por miembro' }].map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        style={{
                            background: activeTab === t.id ? 'var(--accent)' : 'transparent',
                            color: activeTab === t.id ? '#020617' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.4rem 1rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'compras' && (
                purchases.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Todavía no se realizaron compras de créditos para el estudio.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Fecha</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Comprador</th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Créditos</th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Monto</th>
                                    <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchases.map(p => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{formatDate(p.created_at)}</td>
                                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-primary)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={13} />{p.profiles?.full_name || '—'}</span>
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{p.credits}</td>
                                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: 'var(--text-secondary)' }}>${p.amount_ars?.toLocaleString('es-AR') || '—'}</td>
                                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem' }}>
                                                {STATUS_ICONS[p.status]}{STATUS_LABELS[p.status] || p.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {activeTab === 'uso' && (
                usage.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Todavía no se usaron créditos del estudio.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Fecha</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Miembro</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Detalle</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usage.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{formatDate(u.used_at)}</td>
                                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-primary)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={13} />{u.profiles?.full_name || '—'}</span>
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {u.expediente || u.query || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}
        </>
    );
}

export default function EstudioCreditosPage() {
    const searchParams = useSearchParams();
    const creditsStatus = searchParams?.get('credits');
    const researchCreditsStatus = searchParams?.get('research_credits');

    // ── Antecedentes ──
    const [pool, setPool] = useState(null);
    const [purchases, setPurchases] = useState([]);
    const [usage, setUsage] = useState([]);
    const [buying, setBuying] = useState(false);
    const [activeTab, setActiveTab] = useState('compras');

    // ── Investigación ──
    const [researchPool, setResearchPool] = useState(null);
    const [researchPurchases, setResearchPurchases] = useState([]);
    const [researchUsage, setResearchUsage] = useState([]);
    const [buyingResearch, setBuyingResearch] = useState(false);
    const [activeResearchTab, setActiveResearchTab] = useState('compras');

    // ── Shared ──
    const [orgId, setOrgId] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: prof } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('id', user.id)
            .single();

        if (!prof?.org_id) { setLoading(false); return; }

        const { data: member } = await supabase
            .from('org_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('org_id', prof.org_id)
            .single();

        const { data: org } = await supabase
            .from('organizations')
            .select('antecedentes_credits_pool, research_credits_pool')
            .eq('id', prof.org_id)
            .single();

        setOrgId(prof.org_id);
        setRole(member?.role || 'abogado');
        setPool(org?.antecedentes_credits_pool ?? 0);
        setResearchPool(org?.research_credits_pool ?? 0);

        // ── Antecedentes history ──
        const { data: purchaseData } = await supabase
            .from('org_antecedentes_credit_purchases')
            .select('id, pack_id, credits, amount_ars, status, created_at, purchased_by, profiles!purchased_by(full_name)')
            .eq('org_id', prof.org_id)
            .order('created_at', { ascending: false })
            .limit(30);
        setPurchases(purchaseData || []);

        const { data: usageData } = await supabase
            .from('org_antecedentes_credit_usage')
            .select('id, expediente, used_at, used_by, profiles!used_by(full_name)')
            .eq('org_id', prof.org_id)
            .order('used_at', { ascending: false })
            .limit(50);
        setUsage(usageData || []);

        // ── Research history ──
        const { data: researchPurchaseData } = await supabase
            .from('org_research_credit_purchases')
            .select('id, pack_id, credits, amount_ars, status, created_at, purchased_by, profiles!purchased_by(full_name)')
            .eq('org_id', prof.org_id)
            .order('created_at', { ascending: false })
            .limit(30);
        setResearchPurchases(researchPurchaseData || []);

        const { data: researchUsageData } = await supabase
            .from('org_research_credit_usage')
            .select('id, query, used_at, used_by, profiles!used_by(full_name)')
            .eq('org_id', prof.org_id)
            .order('used_at', { ascending: false })
            .limit(50);
        setResearchUsage(researchUsageData || []);

        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleBuy = async (packId) => {
        setBuying(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/mp/org-credits/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                body: JSON.stringify({ pack_id: packId }),
            });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload?.error || 'Error al iniciar pago.');
            if (payload.init_point) window.location.href = payload.init_point;
        } catch (err) {
            console.error('[EstudioCreditos/antecedentes]', err.message);
            alert(`Error: ${err.message}`);
        } finally {
            setBuying(false);
        }
    };

    const handleBuyResearch = async (packId) => {
        setBuyingResearch(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/mp/org-research/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                body: JSON.stringify({ pack_id: packId }),
            });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload?.error || 'Error al iniciar pago.');
            if (payload.init_point) window.location.href = payload.init_point;
        } catch (err) {
            console.error('[EstudioCreditos/research]', err.message);
            alert(`Error: ${err.message}`);
        } finally {
            setBuyingResearch(false);
        }
    };

    const isOwner = role === 'owner';
    const divider = <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2.5rem 0' }} />;

    if (loading) return (
        <div className="estudio-page">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                <div className="estudio-spinner" />
            </div>
        </div>
    );

    return (
        <div className="estudio-page">

            {/* ══════════════════════════════════════════
                SECCIÓN 1: CRÉDITOS DE ANTECEDENTES
            ══════════════════════════════════════════ */}
            <div className="estudio-page-header">
                <h1 className="estudio-page-title">
                    <Coins size={22} />
                    Créditos de Antecedentes
                </h1>
                <p className="estudio-page-subtitle">
                    Pool compartido — cada importación de expediente consume 1 crédito.
                </p>
            </div>

            {creditsStatus === 'ok' && (
                <div className="estudio-alert estudio-alert--success" style={{ marginBottom: '1.5rem' }}>
                    <CheckCircle2 size={16} /> Pago aprobado. Los créditos ya están disponibles en el pool del estudio.
                </div>
            )}
            {creditsStatus === 'error' && (
                <div className="estudio-alert estudio-alert--error" style={{ marginBottom: '1.5rem' }}>
                    <XCircle size={16} /> El pago no pudo procesarse. Podés intentarlo nuevamente.
                </div>
            )}
            {creditsStatus === 'pending' && (
                <div className="estudio-alert estudio-alert--warning" style={{ marginBottom: '1.5rem' }}>
                    <Clock size={16} /> El pago está pendiente de confirmación. Los créditos se acreditarán automáticamente.
                </div>
            )}

            <div className="estudio-stats-grid" style={{ marginBottom: '2rem' }}>
                <BalanceCard pool={pool} icon={<Coins size={22} color={pool > 0 ? '#22c55e' : '#ef4444'} />} />
            </div>

            {isOwner && (
                <div style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                        Recargar pool del estudio
                    </h2>
                    <PackGrid packs={PACKS} buying={buying} onBuy={handleBuy} />
                </div>
            )}

            {!isOwner && pool === 0 && (
                <div className="estudio-alert" style={{ marginBottom: '1.5rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>El pool de créditos está agotado. Contactá al titular del estudio para recargar.</span>
                </div>
            )}

            <HistoryTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                purchases={purchases}
                usage={usage}
            />

            {divider}

            {/* ══════════════════════════════════════════
                SECCIÓN 2: CRÉDITOS DE INVESTIGACIÓN
            ══════════════════════════════════════════ */}
            <div className="estudio-page-header">
                <h1 className="estudio-page-title">
                    <Scale size={22} />
                    Créditos de Investigación
                </h1>
                <p className="estudio-page-subtitle">
                    Pool compartido — cada reporte de Estrategia IA consume 1 crédito.
                </p>
            </div>

            {researchCreditsStatus === 'ok' && (
                <div className="estudio-alert estudio-alert--success" style={{ marginBottom: '1.5rem' }}>
                    <CheckCircle2 size={16} /> Pago aprobado. Los créditos de investigación ya están disponibles.
                </div>
            )}
            {researchCreditsStatus === 'error' && (
                <div className="estudio-alert estudio-alert--error" style={{ marginBottom: '1.5rem' }}>
                    <XCircle size={16} /> El pago no pudo procesarse. Podés intentarlo nuevamente.
                </div>
            )}
            {researchCreditsStatus === 'pending' && (
                <div className="estudio-alert estudio-alert--warning" style={{ marginBottom: '1.5rem' }}>
                    <Clock size={16} /> El pago está pendiente de confirmación. Los créditos se acreditarán automáticamente.
                </div>
            )}

            <div className="estudio-stats-grid" style={{ marginBottom: '2rem' }}>
                <BalanceCard pool={researchPool} icon={<Scale size={22} color={researchPool > 0 ? '#22c55e' : '#ef4444'} />} />
            </div>

            {isOwner && (
                <div style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                        Recargar pool de investigación
                    </h2>
                    <PackGrid packs={PACKS} buying={buyingResearch} onBuy={handleBuyResearch} />
                </div>
            )}

            {!isOwner && researchPool === 0 && (
                <div className="estudio-alert" style={{ marginBottom: '1.5rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>El pool de investigación está agotado. Contactá al titular del estudio para recargar.</span>
                </div>
            )}

            <HistoryTabs
                activeTab={activeResearchTab}
                setActiveTab={setActiveResearchTab}
                purchases={researchPurchases}
                usage={researchUsage}
            />

        </div>
    );
}
