"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { demoResearchHistory, demoFullResearchResult } from '@/app/lib/demoData';
import {
    Briefcase,
    Gavel,
    Search,
    Zap,
    RefreshCw,
    ExternalLink,
    Eye,
    FileText,
    ClipboardCopy,
    Loader2,
    Sparkles,
    AlertCircle,
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
    const [assistedMode, setAssistedMode] = useState(true);

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
        setHistory(demoResearchHistory);
    }, []);

    const handleRefreshCase = async (index) => {
        setRefreshingCases(prev => ({ ...prev, [index]: true }));
        setTimeout(() => {
            setRefreshingCases(prev => ({ ...prev, [index]: false }));
            alert("En la demo, el refresco no cambia el resultado (Datos Mock).");
        }, 1500);
    };

    const handleCapture = (index) => {
        alert("La visualización de PDFs es una característica Pro no disponible en esta Demo.");
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
                    <ul className="numbered-list">
                        {parts.reduce((acc, part, i) => {
                            if (/^\d+\.\s+$/.test(part)) {
                                acc.push({ marker: part.trim(), content: parts[i + 1] || "" });
                            }
                            return acc;
                        }, []).map((item, i) => (
                            <li key={i} className="numbered-list-item">
                                <span className="numbered-list-marker">{item.marker}</span>
                                <span className="numbered-list-content">{item.content}</span>
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
                const levelClass = level <= 2 ? 'research-h3' : (level === 3 ? 'research-h4' : 'research-h5');

                if (level <= 2) return <h3 key={index} className={levelClass}>{cleanLine}</h3>;
                if (level === 3) return <h4 key={index} className={levelClass}>{cleanLine}</h4>;
                return <h5 key={index} className={levelClass}>{cleanLine}</h5>;
            }
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
                <p key={index} className="research-p">
                    {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={i} className="research-strong">{part.slice(2, -2)}</strong>;
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
                {/* HISTORY SIDEBAR — mirrors real dashboard */}
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
                                <h4 className="sidebar-title">Historial</h4>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
                                    className="sidebar-close-btn"
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
                            <div className="history-list history-list-container">
                                {history.length === 0 && <p className="history-empty-text">Sin investigaciones recientes.</p>}
                                {history.map(item => (
                                    <div
                                        key={item.id}
                                        className="history-item history-item-box"
                                        onClick={() => { setQuery(item.query); setResults(item.result_json); }}
                                    >
                                        <div className="history-item-query">
                                            {item.query}
                                        </div>
                                        <div className="history-item-meta">
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
                        <div className="breadcrumb">
                            <Link href="/demo/dashboard" className="breadcrumb-item">Gabinete</Link>
                            <span className="breadcrumb-separator">/</span>
                            <span className="breadcrumb-current">Terminal de Estrategia (Demo)</span>
                        </div>
                    </nav>

                    <header className="research-header">
                        <div className="header-flex">
                            <Image
                                src="/judic-ia-mark.png"
                                alt="Judic-IA Logo"
                                className="logo-main logo-main-contain"
                                width={56}
                                height={75}
                            />
                            <div className="header-text">
                                <h1 className="dashboard-page-title">Terminal de Estrategia Jurídica</h1>
                                <p>Investigación avanzada, Ratio Decidendi y generación de estrategia blindada.</p>
                            </div>
                            <UsageGuideDemo content={demoManuals.research} />
                        </div>
                    </header>

                    <div className="search-box-container glass-panel">
                        {/* MODE TOGGLE — visual only in demo */}
                        <div className="mode-toggle-container">
                            <button
                                onClick={() => setAssistedMode(!assistedMode)}
                                className={`mode-toggle ${assistedMode ? 'assisted' : 'expert'}`}
                                title={assistedMode ? 'Modo Asistido: Sugerencias y mejoras automáticas' : 'Modo Experto: Búsqueda directa sin asistencia'}
                            >
                                {assistedMode ? (
                                    <>
                                        <Sparkles size={18} />
                                        <span className="mode-label">Modo Asistido</span>
                                        <span className="mode-hint">IA te ayuda a mejorar tu búsqueda</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap size={18} />
                                        <span className="mode-label">Modo Experto</span>
                                        <span className="mode-hint">Búsqueda directa sin asistencia</span>
                                    </>
                                )}
                            </button>
                        </div>

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
                        <details className="search-tips-details tips-details">
                            <summary className="tips-summary">
                                <Zap size={14} fill="#fbbf24" />
                                <span>Tips para búsquedas de Alta Precisión</span>
                            </summary>
                            <div className="tips-content tips-content-box">
                                <p className="tips-intro-p">Para obtener los mejores resultados, utilizá estos patrones:</p>
                                <ul className="tips-list">
                                    <li className="tips-li">
                                        <strong>Tema + "fallo" o "sentencia":</strong> <span className="tips-example">Ej: "despido sin causa fallo", "cuota alimentaria sentencia"</span>
                                    </li>
                                    <li className="tips-li">
                                        <strong>Frase exacta entre comillas:</strong> <span className="tips-example">Ej: "daño moral" accidente tránsito</span>
                                    </li>
                                    <li className="tips-li">
                                        <strong>Jurisdicción específica:</strong> <span className="tips-example">Ej: "mala praxis médica cordoba camara"</span>
                                    </li>
                                    <li>
                                        <strong>Autos (si conocés):</strong> <span className="tips-example">Ej: "autos garcia c/ perez s/ daños"</span>
                                    </li>
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
                            <button type="submit" disabled={loading} className="btn-search-submit">
                                {loading ? <Zap size={18} className="spin-animation" /> : <Search size={18} />}
                                {loading ? 'Procesando Inteligencia...' : 'Generar Estrategia IA'}
                            </button>
                        </form>

                        {loading && (
                            <div className="loader-container loader-wrapper">
                                <div className="loader-text-wrapper">
                                    <Loader2 className="spin-animation text-amber-400" size={48} />
                                    <p className="loader-status-text">{searchStatus}</p>
                                </div>
                            </div>
                        )}

                        {results && (
                            <div className="action-buttons">
                                <div className="copy-container">
                                    <button
                                        className="btn-action"
                                        onClick={() => {
                                            const parts = [
                                                "🏦 ESTUDIO LEGAL - INVESTIGACIÓN DE IA (JUDIC-IA) [DEMO]",
                                                "",
                                                "📜 NORMATIVA APLICABLE:",
                                                results.laws,
                                                "",
                                                "⚖️ JURISPRUDENCIA & FALLOS:",
                                                Array.isArray(results.cases) ? results.cases.map(c => `🔹 ${c.title}\n   ${c.summary}\n   Fuente: ${c.source}`).join('\n\n') : '',
                                                "",
                                                results.calculation ? `💰 LIQUIDACIÓN ESTIMAD@:\n${results.calculation}\n` : null,
                                                results.evidence ? `🔍 PUNTOS DE PRUEBA:\n${results.evidence}\n` : null,
                                                "💡 ESTRATEGIA SUGERIDA:",
                                                results.strategy,
                                                "",
                                                "🔗 FUENTES & LINKS:",
                                                results.links?.map(l => `- ${l.title}: ${l.url}`).join('\n') || "No hay enlaces digitales directos."
                                            ].filter(Boolean).join('\n');
                                            navigator.clipboard.writeText(parts);
                                            setCopySuccess(true);
                                            setTimeout(() => setCopySuccess(false), 2000);
                                        }}
                                    >
                                        <ClipboardCopy size={16} />
                                        <span>Copiar Texto</span>
                                    </button>
                                    {copySuccess && <span className="copy-toast">✨ ¡Copiado!</span>}
                                </div>
                                <button className="btn-action btn-pdf" onClick={handleDownloadPDF}>
                                    <FileText size={16} />
                                    <span>Exportar Informe de Estrategia</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {results && (
                        <div className="results-area">
                            {results.brave_used && (
                                <div className="badge-brave">
                                    <span>🦁 Brave Search Pro Activo (Demo)</span>
                                    <span className="opacity-60">•</span>
                                    <span>Resultados en Tiempo Real</span>
                                    <span className="quota-status-badge">•</span>
                                    <span className="demo-quota-text">Refrescos Desactivados (Demo)</span>
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
                                            {results.cases.length === 0 && <p className="case-empty-text">No se encontraron fallos digitales directos.</p>}
                                            {results.cases.map((c, i) => {
                                                let safeUrl = c.url;
                                                if (safeUrl) {
                                                    if (safeUrl.includes('://') && !safeUrl.startsWith('http')) {
                                                        safeUrl = safeUrl.substring(safeUrl.lastIndexOf('http'));
                                                    } else if (!safeUrl.startsWith('http')) {
                                                        safeUrl = `https://${safeUrl}`;
                                                    }
                                                }
                                                const isRefreshing = refreshingCases[i];
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`case-item-card ${isRefreshing ? 'refreshing' : ''}`}
                                                    >
                                                        <div className="case-content-wrapper">
                                                            <div className="case-info">
                                                                <h4 className="case-title">
                                                                    <Gavel size={16} className="text-amber-400" />
                                                                    {c.title}
                                                                </h4>
                                                                <div className="case-summary-scroll">
                                                                    <p className="case-summary-text">
                                                                        {c.summary}
                                                                    </p>
                                                                </div>
                                                                <span className="case-source">Fuente: {c.source || 'Referencia Legal'}</span>
                                                            </div>
                                                            {safeUrl && (
                                                                <div className="case-actions">
                                                                    <button
                                                                        className="btn-preview-icon"
                                                                        title="Buscar nueva alternativa (Refresh)"
                                                                        onClick={() => handleRefreshCase(i)}
                                                                        disabled={refreshingCases[i]}
                                                                    >
                                                                        <RefreshCw size={16} className={refreshingCases[i] ? "spin-animation" : ""} />
                                                                    </button>
                                                                    <a
                                                                        href={safeUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="btn-link-icon"
                                                                        title="Abrir Fuente"
                                                                    >
                                                                        <ExternalLink size={16} />
                                                                    </a>
                                                                    <button
                                                                        className="btn-preview-icon"
                                                                        title="Visualizar (PDF Limpio)"
                                                                        onClick={() => handleCapture(i)}
                                                                    >
                                                                        <Eye size={16} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
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

                            {/* LINKS */}
                            {results.links && results.links.length > 0 && (
                                <section className="result-card links">
                                    <h3>🔗 Recursos y Enlaces Útiles</h3>
                                    <div className="links-grid">
                                        {results.links.map((link, idx) => {
                                            let safeUrl = link.url;
                                            if (safeUrl.includes('://') && !safeUrl.startsWith('http')) {
                                                safeUrl = safeUrl.substring(safeUrl.lastIndexOf('http'));
                                            } else if (!safeUrl.startsWith('http')) {
                                                safeUrl = `https://${safeUrl}`;
                                            }
                                            return (
                                                <div key={idx} className="link-wrapper">
                                                    <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="link-item">
                                                        {link.title} ↗
                                                    </a>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {!results && !loading && (
                        <div className="empty-state">
                            <p>✨ Escribí tu consulta legal y el sistema te ayudará a optimizarla automáticamente.</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
