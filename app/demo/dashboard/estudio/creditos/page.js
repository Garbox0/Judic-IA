"use client";
import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Coins, ShoppingCart, CheckCircle2, XCircle, Clock, User, AlertCircle, Scale, Bell } from 'lucide-react';

const PACKS = [
    { id: 'pack_5', credits: 5, price: '$25.000', sub: '$5.000 por crédito' },
    { id: 'pack_15', credits: 15, price: '$60.000', sub: '$4.000 por crédito', featured: true },
    { id: 'pack_30', credits: 30, price: '$99.000', sub: '$3.300 por crédito' },
];

const ALERT_PACKS = [
    { id: 'alert_pack_1', credits: 1, price: '$8.900', sub: '$8.900 por alerta' },
    { id: 'alert_pack_10', credits: 10, price: '$59.000', sub: '$5.900 por alerta', featured: true },
    { id: 'alert_pack_100', credits: 100, price: '$429.000', sub: '$4.290 por alerta' },
];

const STATUS_LABELS = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' };
const STATUS_ICONS = { approved: <CheckCircle2 size={14} color="#22c55e" />, rejected: <XCircle size={14} color="#ef4444" />, pending: <Clock size={14} color="#f59e0b" /> };

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

function HistoryTabs({ activeTab, setActiveTab, purchases, usage }) {
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

export default function DemoEstudioCreditosPage() {
    // Shared
    const isOwner = true;
    const divider = <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2.5rem 0' }} />;

    // ── Antecedentes ──
    const [pool, setPool] = useState(12);
    const [buying, setBuying] = useState(false);
    const [activeTab, setActiveTab] = useState('compras');

    const purchases = [
        { id: 'p1', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), profiles: { full_name: 'Dr. Martínez' }, credits: 15, amount_ars: 60000, status: 'approved' },
        { id: 'p2', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 35).toISOString(), profiles: { full_name: 'Dr. Martínez' }, credits: 5, amount_ars: 25000, status: 'approved' }
    ];

    const usage = [
        { id: 'u1', used_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), profiles: { full_name: 'Dra. López' }, expediente: '1234/2025' },
        { id: 'u2', used_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), profiles: { full_name: 'Dr. García' }, expediente: '5678/2026' },
        { id: 'u3', used_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), profiles: { full_name: 'Dr. Martínez' }, expediente: '9012/2025' }
    ];

    // ── Investigación ──
    const [researchPool, setResearchPool] = useState(4);
    const [buyingResearch, setBuyingResearch] = useState(false);
    const [activeResearchTab, setActiveResearchTab] = useState('compras');

    const researchPurchases = [
        { id: 'rp1', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), profiles: { full_name: 'Dr. Martínez' }, credits: 5, amount_ars: 25000, status: 'approved' }
    ];

    const researchUsage = [
        { id: 'ru1', used_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), profiles: { full_name: 'Dra. Fernández' }, query: 'Estrategia laboral por despido' }
    ];

    // ── Alertas ──
    const [alertPool, setAlertPool] = useState(0);
    const [buyingAlert, setBuyingAlert] = useState(false);
    const [activeAlertTab, setActiveAlertTab] = useState('uso');

    const alertPurchases = [];
    const alertUsage = [];

    const handleBuy = (packId) => {
        setBuying(true);
        setTimeout(() => {
            alert('En Producción, esto abriría MercadoPago para comprar el paquete: ' + packId);
            setBuying(false);
        }, 1000);
    };

    const handleBuyResearch = (packId) => {
        setBuyingResearch(true);
        setTimeout(() => {
            alert('En Producción, esto abriría MercadoPago para comprar el paquete de Inv: ' + packId);
            setBuyingResearch(false);
        }, 1000);
    };

    const handleBuyAlert = (packId) => {
        setBuyingAlert(true);
        setTimeout(() => {
            alert('En Producción, esto abriría MercadoPago para comprar el paquete de Alertas: ' + packId);
            setBuyingAlert(false);
        }, 1000);
    };

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

            <HistoryTabs
                activeTab={activeResearchTab}
                setActiveTab={setActiveResearchTab}
                purchases={researchPurchases}
                usage={researchUsage}
            />

            {divider}

            {/* ══════════════════════════════════════════
                SECCIÓN 3: CRÉDITOS DE ALERTAS
            ══════════════════════════════════════════ */}
            <div className="estudio-page-header">
                <h1 className="estudio-page-title">
                    <Bell size={22} />
                    Créditos de Alertas
                </h1>
                <p className="estudio-page-subtitle">
                    Pool compartido — cada alerta de monitoreo activada consume 1 crédito.
                </p>
            </div>

            <div className="estudio-stats-grid" style={{ marginBottom: '2rem' }}>
                <BalanceCard pool={alertPool} icon={<Bell size={22} color={alertPool > 0 ? '#22c55e' : '#ef4444'} />} />
            </div>

            {isOwner && (
                <div style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                        Recargar pool de alertas
                    </h2>
                    <PackGrid packs={ALERT_PACKS} buying={buyingAlert} onBuy={handleBuyAlert} />
                </div>
            )}

            {!isOwner && alertPool === 0 && (
                <div className="estudio-alert" style={{ marginBottom: '1.5rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>El pool de alertas está agotado. Contactá al titular del estudio para recargar.</span>
                </div>
            )}

            <HistoryTabs
                activeTab={activeAlertTab}
                setActiveTab={setActiveAlertTab}
                purchases={alertPurchases}
                usage={alertUsage}
            />

        </div>
    );
}
