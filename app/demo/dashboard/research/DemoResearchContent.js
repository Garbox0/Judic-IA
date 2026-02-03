"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { demoResearchHistory, demoFullResearchResult } from '@/app/lib/demoData';
// TetrisLoader removed
import {
    Briefcase,
    Gavel,
    Home,
    Building2,
    Search,
    Zap,
    RefreshCw,
    ExternalLink,
    Eye,
    FileText,
    ClipboardCopy,
    Loader2
} from 'lucide-react';
import '@/app/dashboard/research/research.css';

import UsageGuideDemo from '@/app/components/UsageGuideDemo';
import { demoManuals } from '@/app/lib/demoManuals';

export default function DemoResearchPage() {
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('nacional');
    const [province, setProvince] = useState('Buenos Aires');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshingCases, setRefreshingCases] = useState({});
    const [copySuccess, setCopySuccess] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    const [placeholder, setPlaceholder] = useState("Ej: Despido sin causa con antigüedad de 10 años en CABA...");
    const [history, setHistory] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [searchStatus, setSearchStatus] = useState('');
    const [refreshQuota, setRefreshQuota] = useState(5);

    useEffect(() => {
        let timer;
        if (loading && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [loading, timeLeft]);

    useEffect(() => {
        // Load demo history
        setHistory(demoResearchHistory);
    }, []);

    const handleRefreshCase = async (index) => {
        if (refreshQuota <= 0) return;
        setRefreshingCases(prev => ({ ...prev, [index]: true }));

        // Simulate fake refresh
        setTimeout(() => {
            setRefreshingCases(prev => ({ ...prev, [index]: false }));
            alert("En la demo, el refresco no cambia el resultado (Datos Mock).");
            setRefreshQuota(prev => prev - 1);
        }, 1500);
    };

    const renderContent = (content) => {
        if (!content) return null;
        let text = "";
        if (typeof content === 'string') text = content;
        else if (Array.isArray(content)) text = content.join('\n');
        else if (typeof content === 'object') text = Object.entries(content).map(([k, v]) => `### ${k}\n${v}`).join('\n\n');
        else text = String(content);

        const hasNumberedList = /\s\d+\.\s/.test(text) || /^\d+\.\s/.test(text);

        if (hasNumberedList) {
            const parts = text.split(/(\d+\.\s+)/).filter(Boolean);
            if (parts.length > 1) {
                return (
                    <ul style={{ listStyleType: 'none', paddingLeft: 0, margin: 0 }}>
                        {parts.reduce((acc, part, i) => {
                            if (/^\d+\.\s+$/.test(part)) {
                                acc.push({ marker: part.trim(), content: parts[i + 1] || "" });
                            }
                            return acc;
                        }, []).map((item, i) => (
                            <li key={i} style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 'bold', color: '#fbbf24', minWidth: '1.5em', display: 'flex', alignItems: 'center', height: '1.5rem' }}>{item.marker}</span>
                                <span style={{ color: '#cbd5e1', lineHeight: '1.6' }}>{item.content}</span>
                            </li>
                        ))}
                    </ul>
                );
            }
        }

        return text.split('\n').map((line, index) => {
            if (line.match(/^#{1,6}\s/)) {
                const match = line.match(/^#{1,6}\s/);
                const level = match[0].trim().length;
                const cleanLine = line.replace(/^#{1,6}\s/, '');
                const styles = { margin: '1em 0 0.5em', color: '#e2e8f0', fontWeight: 'bold' };
                if (level === 3) { styles.fontSize = '1.1rem'; styles.color = '#fbbf24'; }
                if (level === 4) { styles.fontSize = '1rem'; styles.color = '#cbd5e1'; }

                if (level <= 2) return <h3 key={index} style={{ ...styles, fontSize: '1.2rem' }}>{cleanLine}</h3>;
                if (level === 3) return <h4 key={index} style={styles}>{cleanLine}</h4>;
                return <h5 key={index} style={{ ...styles, fontSize: '0.9rem' }}>{cleanLine}</h5>;
            }
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
                <p key={index} style={{ marginBottom: '0.8rem', lineHeight: '1.6', color: '#cbd5e1' }}>
                    {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={i} style={{ color: '#e2e8f0' }}>{part.slice(2, -2)}</strong>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        const finalQuery = query || (placeholder.startsWith("Ej:") ? "" : placeholder);
        if (!finalQuery) return;

        setLoading(true);
        setResults(null);
        setTimeLeft(60);

        // SIMULATE SEARCH IN DEMO
        const analysisSteps = [
            'Iniciando ráfaga masiva de búsqueda (Brave Pro)...',
            'Escaneando depósitos de la CSJN y PJN...',
            'Filtrando resultados por relevancia jurídica "Surgical"...',
            'Detectando parámetros de liquidación técnica...',
            'Finalizando síntesis de inteligencia legal...'
        ];
        let stepIndex = 0;
        setSearchStatus(analysisSteps[0]);

        const statusInterval = setInterval(() => {
            stepIndex = (stepIndex + 1);
            if (stepIndex < analysisSteps.length) {
                setSearchStatus(analysisSteps[stepIndex]);
            }
        }, 800);

        setTimeout(() => {
            clearInterval(statusInterval);
            setResults(demoFullResearchResult);
            setLoading(false);
            setSearchStatus('');
        }, 4500);
    };

    const handleDownloadPDF = () => {
        alert("La exportación PDF es una característica Pro no disponible en esta Demo Interactiva.");
    };

    const provinces = [
        "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
        "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza",
        "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
        "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
    ];

    return (
        <div className="research-container">
            <div className={`research-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                {/* HISTORY SIDEBAR */}
                <>
                    <button
                        className="mobile-history-toggle"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <span>🕒 Historial</span>
                    </button>

                    <div
                        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                    />

                    <aside className={`research-sidebar glass-panel ${sidebarOpen ? 'open' : 'closed'}`}>
                        {(sidebarOpen || true) && (
                            <div className="sidebar-header-row">
                                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase' }}>Historial (Demo)</h4>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
                                    style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: '1.5rem', padding: '0.5rem' }}
                                >
                                    {sidebarOpen ? '✕' : '▶'}
                                </button>
                            </div>
                        )}

                        {!sidebarOpen && (
                            <div
                                className="collapsed-icon-area"
                                onClick={() => setSidebarOpen(true)}
                            >
                                <div className="vertical-trigger">
                                    <span className="v-icon">🕒</span>
                                    <span className="v-label">HISTORIAL</span>
                                </div>
                            </div>
                        )}

                        {sidebarOpen && (
                            <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', maxHeight: 'calc(100vh - 150px)' }}>
                                {history.map(item => (
                                    <div
                                        key={item.id}
                                        className="history-item"
                                        onClick={() => { setQuery(item.query); setResults(item.result_json); }}
                                        style={{
                                            padding: '0.8rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            transition: '0.2s',
                                            fontSize: '0.85rem'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    >
                                        <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.query}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            {new Date(item.created_at).toLocaleDateString()} • {item.jurisdiction}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </aside>
                </>

                <div className="main-content-area">
                    <nav className="research-nav">
                        {/* Adjusted breadcrumb for demo */}
                        <div className="breadcrumb">
                            <a href="/demo/dashboard" className="breadcrumb-item">Gabinete</a>
                            <span className="breadcrumb-separator">/</span>
                            <span className="breadcrumb-current">Terminal de Estrategia (Demo)</span>
                        </div>
                    </nav>

                    <header className="research-header">
                        <div className="header-flex">
                            <img
                                src="/judic-ia-mark.png"
                                alt="Judic-IA Logo"
                                className="logo-main"
                                width={56}
                                height={75}
                                style={{ objectFit: 'contain' }}
                            />
                            <div className="header-text">
                                <h1 className="dashboard-page-title">Terminal de Estrategia Jurídica</h1>
                                <p>Investigación avanzada, Ratio Decidendi y generación de estrategia blindada.</p>
                            </div>
                        </div>

                        <UsageGuideDemo content={demoManuals.research} />
                    </header>

                    <div className="search-box-container glass-panel">
                        <div className="jurisdiction-selector">
                            <label htmlFor="demo_res_scope_nacional" className={`radio-btn ${scope === 'nacional' ? 'active' : ''}`}>
                                <input
                                    id="demo_res_scope_nacional"
                                    type="radio"
                                    name="scope"
                                    value="nacional"
                                    checked={scope === 'nacional'}
                                    onChange={() => setScope('nacional')}
                                />
                                🇦🇷 Justicia Nacional / Federal
                            </label>
                            <label htmlFor="demo_res_scope_provincial" className={`radio-btn ${scope === 'provincial' ? 'active' : ''}`}>
                                <input
                                    id="demo_res_scope_provincial"
                                    type="radio"
                                    name="scope"
                                    value="provincial"
                                    checked={scope === 'provincial'}
                                    onChange={() => setScope('provincial')}
                                />
                                📍 Justicia Provincial
                            </label>

                            {scope === 'provincial' && (
                                <>
                                    <label htmlFor="demo_res_province_select" className="sr-only">Seleccionar Provincia</label>
                                    <select
                                        id="demo_res_province_select"
                                        className="province-select"
                                        value={province}
                                        onChange={(e) => setProvince(e.target.value)}
                                    >
                                        {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </>
                            )}
                        </div>

                        {/* 💡 SEARCH TIPS */}
                        <details className="search-tips-details" style={{ marginBottom: '1rem', width: '100%' }}>
                            <summary style={{ color: '#fbbf24', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', userSelect: 'none' }}>
                                <Zap size={14} fill="#fbbf24" />
                                <span>Tips para búsquedas de Alta Precisión</span>
                            </summary>
                            <div className="tips-content" style={{ marginTop: '0.8rem', padding: '1rem', background: 'rgba(251, 191, 36, 0.05)', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.1)', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                                <p style={{ margin: '0 0 0.5rem 0' }}>Para obtener los mejores resultados, utilizá estos patrones:</p>
                                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#e2e8f0' }}>
                                    <li style={{ marginBottom: '0.3rem' }}><strong>Tema + "fallo" o "sentencia":</strong> <span style={{ opacity: 0.7 }}>Ej: "despido sin causa fallo"</span></li>
                                    <li style={{ marginBottom: '0.3rem' }}><strong>Frase exacta entre comillas:</strong> <span style={{ opacity: 0.7 }}>Ej: "daño moral" accidente tránsito</span></li>
                                </ul>
                            </div>
                        </details>

                        <form onSubmit={handleSearch} className="search-box">
                            <label htmlFor="demo_research_input" className="sr-only">Consulta de investigación jurídica</label>
                            <input
                                id="demo_research_input"
                                name="query"
                                type="text"
                                placeholder={placeholder}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <button type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                {loading ? <Zap size={18} className="spin-animation" /> : <Search size={18} />}
                                {loading ? 'Procesando Inteligencia...' : 'Generar Estrategia IA'}
                            </button>
                        </form>



                        {loading && (
                            <div className="loader-container" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Loader2 className="spin-animation text-amber-400" size={48} />
                                    <p style={{ marginTop: '1.5rem', color: '#fbbf24', fontSize: '0.9rem', fontWeight: 600, animation: 'pulse 2s infinite' }}>{searchStatus}</p>
                                </div>
                            </div>
                        )}

                        {results && (
                            <div className="action-buttons">
                                <div className="copy-container">
                                    <button
                                        className="btn-action"
                                        onClick={() => {
                                            const parts = ["🏦 DEMO RESULTS", results.strategy, results.calculation].filter(Boolean).join('\n');
                                            navigator.clipboard.writeText(parts);
                                            setCopySuccess(true);
                                            setTimeout(() => setCopySuccess(false), 2000);
                                        }}
                                    >
                                        <ClipboardCopy size={16} /> <span>Copiar Texto</span>
                                    </button>
                                    {copySuccess && <span className="copy-toast">✨ ¡Copiado!</span>}
                                </div>
                                <button className="btn-action btn-pdf" onClick={handleDownloadPDF}>
                                    <FileText size={16} /> <span>Exportar Informe</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {results && (
                        <div className="results-area">
                            {results.brave_used && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '0.4rem 0.8rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 800, marginBottom: '1.5rem', border: '1px solid rgba(251, 191, 36, 0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <span>🦁 Brave Search Pro Activo (Demo)</span>
                                </div>
                            )}

                            {/* LAWS */}
                            {results.laws && results.laws.length > 5 && (
                                <section className="result-card glass-card">
                                    <h3>📚 Normativa Aplicable</h3>
                                    <div className="content">{renderContent(results.laws)}</div>
                                </section>
                            )}

                            {/* CASES */}
                            <section className="result-card glass-card">
                                <h3>⚖️ Jurisprudencia Similares</h3>
                                <div className="content">
                                    {Array.isArray(results.cases) ? (
                                        <div className="cases-grid">
                                            {results.cases.map((c, i) => (
                                                <div key={i} className={`case-item-card ${refreshingCases[i] ? 'refreshing' : ''}`}>
                                                    <div className="case-content-wrapper">
                                                        <div className="case-info">
                                                            <h4 className="case-title"><Gavel size={16} className="text-amber-400" /> {c.title}</h4>
                                                            <div className="case-summary-scroll"><p className="case-summary-text">{c.summary}</p></div>
                                                            <span className="case-source">Fuente: {c.source || 'Referencia Legal'}</span>
                                                        </div>
                                                        <div className="case-actions">
                                                            <button className="btn-preview-icon" onClick={() => handleRefreshCase(i)} disabled={refreshingCases[i]}>
                                                                <RefreshCw size={16} className={refreshingCases[i] ? "spin-animation" : ""} />
                                                            </button>
                                                            {c.url && <a href={c.url.startsWith('http') ? c.url : `https://${c.url}`} target="_blank" rel="noreferrer" className="btn-link-icon"><ExternalLink size={16} /></a>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : results.cases}
                                </div>
                            </section>

                            {/* CALCULATION */}
                            {results.calculation && results.calculation.length > 5 && (
                                <section className="result-card glass-card calculation">
                                    <h3>💰 Liquidación Estimada</h3>
                                    <div className="content">{renderContent(results.calculation)}</div>
                                </section>
                            )}
                            {/* EVIDENCE */}
                            {results.evidence && results.evidence.length > 5 && (
                                <section className="result-card glass-card evidence">
                                    <h3>🔍 Puntos de Prueba (Sugeridos)</h3>
                                    <div className="content">{renderContent(results.evidence)}</div>
                                </section>
                            )}
                            {/* STRATEGY */}
                            {results.strategy && results.strategy.length > 5 && (
                                <section className="result-card glass-card strategy">
                                    <h3>💡 Sugerencia de Estrategia</h3>
                                    <div className="content">{renderContent(results.strategy)}</div>
                                </section>
                            )}
                        </div>
                    )}

                    {!results && !loading && (
                        <div className="guided-research">
                            <h3>💡 ¿Sobre qué quieres investigar hoy? (Simulación)</h3>
                            <div className="categories-grid">
                                <div className={`category-card glass-card ${activeCategory === 'laboral' ? 'active' : ''}`} onClick={() => { setPlaceholder('Jurisprudencia sobre despidos con justa causa en CABA'); setQuery(''); setActiveCategory('laboral'); }}>
                                    <span className="icon"><Briefcase size={24} /></span>
                                    <h4>Laboral</h4>
                                    <p>Despidos, accidentes, trabajo en negro.</p>
                                </div>
                                <div className={`category-card glass-card ${activeCategory === 'penal' ? 'active' : ''}`} onClick={() => { setPlaceholder('Jurisprudencia sobre robo con arma de guerra'); setQuery(''); setActiveCategory('penal'); }}>
                                    <span className="icon"><Gavel size={24} /></span>
                                    <h4>Penal</h4>
                                    <p>Robo con armas, abusos, delitos complejos.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
}
