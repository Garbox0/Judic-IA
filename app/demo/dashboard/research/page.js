"use client";
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import Link from 'next/link';
import { demoResearchHistory, demoFullResearchResult } from '@/app/lib/demoData';
import TetrisLoader from '@/app/components/TetrisLoader';
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
    ClipboardCopy
} from 'lucide-react';

export default function DemoResearchPage() {
    const isDemo = true;
    const basePath = '/demo/dashboard';

    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('nacional');
    const [province, setProvince] = useState('Buenos Aires');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    const [placeholder, setPlaceholder] = useState("Ej: Despido sin causa con antigüedad de 10 años en CABA...");
    const [logoBase64, setLogoBase64] = useState(null);
    const [history, setHistory] = useState(demoResearchHistory);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchStatus, setSearchStatus] = useState('');

    useEffect(() => {
        // Load logo for PDF
        const convertLogo = async () => {
            try {
                const response = await fetch('/logo.png');
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => setLogoBase64(reader.result);
                reader.readAsDataURL(blob);
            } catch (err) {
                console.error("Error loading logo:", err);
            }
        };
        convertLogo();
    }, []);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        const finalQuery = query || (placeholder.startsWith("Ej:") ? "" : placeholder);
        if (!finalQuery) return;

        setLoading(true);
        setResults(null);

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
        if (!results) return;

        const doc = new jsPDF();
        const timestamp = new Date().toLocaleDateString();

        const addWatermark = (pdf) => {
            if (logoBase64) {
                try {
                    pdf.setGState(new pdf.GState({ opacity: 0.05 }));
                    pdf.addImage(logoBase64, 'PNG', 45, 80, 120, 120, undefined, 'FAST');
                    pdf.setGState(new pdf.GState({ opacity: 1 }));
                } catch (e) { console.log(e); }
            }
        };

        const addHeader = (pdf, isFirstPage = false) => {
            addWatermark(pdf);

            if (isFirstPage) {
                if (logoBase64) pdf.addImage(logoBase64, 'PNG', 14, 10, 22, 22);

                pdf.setFontSize(22);
                pdf.setTextColor(15, 23, 42);
                pdf.text("Judic-IA: Informe Legal", 42, 22);

                pdf.setFontSize(9);
                pdf.setTextColor(71, 85, 105);
                pdf.text("Usuario Demo", 196, 18, { align: 'right' });

                pdf.setDrawColor(226, 232, 240);
                pdf.line(14, 34, 196, 34);

                pdf.setFontSize(10);
                pdf.setTextColor(100);
                pdf.text(`Fecha: ${timestamp}`, 14, 42);
                pdf.text(`Jurisdicción: ${scope === 'nacional' ? 'Nacional/Federal' : province}`, 14, 47);

                pdf.setFontSize(9);
                const queryText = `Consulta: ${query || (placeholder.startsWith("Ej:") ? "General" : placeholder)}`;
                const splitQuery = pdf.splitTextToSize(queryText, 180);
                pdf.text(splitQuery, 14, 53);
                return 65;
            }
            return 20;
        };

        let yPos = addHeader(doc, true);

        const safeRender = (content) => {
            if (!content) return "";
            if (Array.isArray(content)) {
                if (content.length > 0 && content[0].title) {
                    return content.map(c => `• ${c.title}\n  ${c.summary}\n  (Fuente: ${c.source})`).join('\n\n');
                }
                return content.join('\n');
            }
            if (typeof content === 'object') return Object.entries(content).map(([k, v]) => `${k.toUpperCase()}:\n${v}`).join('\n\n');
            return String(content).replace(/\*\*/g, '').replace(/###\s?/g, '');
        };

        const sections = [
            { title: "Normativa Aplicable", content: safeRender(results.laws) },
            { title: "Análisis de Jurisprudencia", content: safeRender(results.cases) },
            { title: "Liquidación Estimativa", content: safeRender(results.calculation) },
            { title: "Puntos de Prueba", content: safeRender(results.evidence) },
            { title: "Estrategia Recomendada", content: safeRender(results.strategy) }
        ];

        sections.forEach(section => {
            if (section.content) {
                const splitContent = doc.splitTextToSize(section.content, 170);
                const sectionHeight = (splitContent.length * 5) + 15;
                if (yPos + sectionHeight > 275) {
                    doc.addPage();
                    yPos = addHeader(doc);
                }
                doc.setFontSize(14);
                doc.setTextColor(30, 41, 59);
                doc.text(section.title, 14, yPos);
                doc.setFontSize(11);
                doc.setTextColor(0);
                doc.text(splitContent, 14, yPos + 8);
                yPos += sectionHeight + 5;
            }
        });

        doc.save(`Informe_Demo_${new Date().getTime()}.pdf`);
    };

    const renderContent = (content) => {
        if (!content) return null;
        let text = "";
        if (typeof content === 'string') text = content;
        else if (Array.isArray(content)) text = content.join('\n');
        else if (typeof content === 'object') text = Object.entries(content).map(([k, v]) => `### ${k}\n${v}`).join('\n\n');

        return text.split('\n').map((line, index) => {
            if (line.match(/^#{1,6}\s/)) {
                return <h4 key={index} style={{ color: '#fbbf24', marginTop: '1em' }}>{line.replace(/^#{1,6}\s/, '')}</h4>;
            }
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
                <p key={index} style={{ marginBottom: '0.8rem', lineHeight: '1.6', color: '#cbd5e1' }}>
                    {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: '#e2e8f0' }}>{part.slice(2, -2)}</strong>;
                        return part;
                    })}
                </p>
            );
        });
    };

    const provinces = ["Buenos Aires", "Catamarca", "Córdoba", "Santa Fe", "Mendoza"];

    return (
        <div className="research-container">
            <div className={`research-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                {/* HISTORY SIDEBAR - Overlay Pattern */}
                <>
                    {/* Mobile Toggle Button (Visible on mobile/desktop as configured) */}
                    <button
                        className="mobile-history-toggle"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <span>🕒 Historial</span>
                    </button>

                    {/* Overlay Backdrop */}
                    <div
                        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                    />

                    <aside className={`research-sidebar glass-panel ${sidebarOpen ? 'open' : 'closed'}`}>
                        {/* Always show header with Close button */}
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

                        {/* Collapsed State Icon (Desktop Only) */}
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
                                            Simulado • {item.jurisdiction || 'Nacional'}
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
                            <Link href={basePath} className="breadcrumb-item">Gabinete</Link>
                            <span className="breadcrumb-separator">/</span>
                            <span className="breadcrumb-current">Terminal de Estrategia (Demo)</span>
                        </div>
                    </nav>

                    <header className="research-header">
                        <div className="header-flex">
                            <img src="/logo.png" alt="Judic-IA Logo" className="logo-main" />
                            <div className="header-text">
                                <h1 className="dashboard-page-title">Terminal de Estrategia Jurídica</h1>
                                <p>Investigación avanzada, Ratio Decidendi y generación de estrategia blindada.</p>
                            </div>
                        </div>
                    </header>

                    <div className="search-box-container glass-panel">
                        <div className="jurisdiction-selector">
                            <label className={`radio-btn ${scope === 'nacional' ? 'active' : ''}`}>
                                <input type="radio" checked={scope === 'nacional'} onChange={() => setScope('nacional')} />
                                🇦🇷 Justicia Nacional / Federal
                            </label>
                            <label className={`radio-btn ${scope === 'provincial' ? 'active' : ''}`}>
                                <input type="radio" checked={scope === 'provincial'} onChange={() => setScope('provincial')} />
                                📍 Justicia Provincial
                            </label>
                            {scope === 'provincial' && (
                                <select className="province-select" value={province} onChange={(e) => setProvince(e.target.value)}>
                                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            )}
                        </div>

                        <form onSubmit={handleSearch} className="search-box">
                            <input type="text" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
                            <button type="submit" disabled={loading}>
                                {loading ? <Zap size={18} className="spin-animation" /> : <Search size={18} />}
                                {loading ? 'Procesando Inteligencia...' : 'Generar Estrategia IA'}
                            </button>
                        </form>

                        {loading && (
                            <div className="loader-container" style={{ marginTop: '2rem', textAlign: 'center' }}>
                                <TetrisLoader />
                                <p style={{ marginTop: '1.5rem', color: '#fbbf24', animation: 'pulse 2s infinite' }}>{searchStatus}</p>
                            </div>
                        )}

                        {results && (
                            <div className="action-buttons">
                                <button className="btn-action" onClick={() => { navigator.clipboard.writeText("Copiado"); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }}>
                                    <ClipboardCopy size={16} /> <span>Copiar Texto</span>
                                </button>
                                {copySuccess && <span className="copy-toast">✨ ¡Copiado!</span>}
                                <button className="btn-action btn-pdf" onClick={handleDownloadPDF}>
                                    <FileText size={16} /> <span>Exportar Informe</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {results && (
                        <div className="results-area">
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '0.4rem 0.8rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 800, marginBottom: '1.5rem', border: '1px solid rgba(251, 191, 36, 0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <span>🦁 Brave Search Pro Activo (Simulado)</span>
                            </div>

                            {results.laws && (
                                <section className="result-card glass-card">
                                    <h3>📚 Normativa Aplicable</h3>
                                    <div className="content">{renderContent(results.laws)}</div>
                                </section>
                            )}

                            <section className="result-card glass-card">
                                <h3>⚖️ Jurisprudencia Similares</h3>
                                <div className="content">
                                    {Array.isArray(results.cases) ? (
                                        <div className="cases-grid">
                                            {results.cases.length === 0 && <p style={{ fontStyle: 'italic', color: '#64748b' }}>No se encontraron fallos digitales directos.</p>}
                                            {results.cases.map((c, i) => (
                                                <div key={i} className="case-item-card" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', paddingRight: '1rem' }}>
                                                    <h4 style={{ margin: '0 0 0.4rem 0', color: '#e2e8f0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Gavel size={16} style={{ color: '#fbbf24' }} />
                                                        {c.title}
                                                    </h4>
                                                    <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: '1.5' }}>{c.summary}</p>
                                                    <span style={{ fontSize: '0.8rem', color: '#fbbf24', marginTop: '0.5rem', display: 'block' }}>Fuente: {c.source}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : results.cases}
                                </div>
                            </section>

                            {results.strategy && (
                                <section className="result-card glass-card strategy">
                                    <h3>💡 Sugerencia de Estrategia</h3>
                                    <div className="content">{renderContent(results.strategy)}</div>
                                </section>
                            )}
                        </div>
                    )}

                    {!results && !loading && (
                        <div className="guided-research">
                            <h3>💡 ¿Sobre qué quieres investigar hoy?</h3>
                            <div className="categories-grid">
                                <div className="category-card glass-card" onClick={() => { setPlaceholder('Jurisprudencia sobre despidos...'); setActiveCategory('laboral'); }}>
                                    <span className="icon"><Briefcase size={24} /></span>
                                    <h4>Laboral</h4>
                                </div>
                                <div className="category-card glass-card" onClick={() => { setPlaceholder('Jurisprudencia penal...'); setActiveCategory('penal'); }}>
                                    <span className="icon"><Gavel size={24} /></span>
                                    <h4>Penal</h4>
                                </div>
                                <div className="category-card glass-card" onClick={() => { setPlaceholder('Sucesiones...'); setActiveCategory('civil'); }}>
                                    <span className="icon"><Home size={24} /></span>
                                    <h4>Civil</h4>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                /* CORE LAYOUT */
                .research-container { padding: 0 1.5rem 2.5rem; max-width: 1600px; margin: 0 auto; color: white; }
                .glass-card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; transition: transform 0.2s, box-shadow 0.2s; }
                .glass-panel { background: rgba(30, 41, 59, 0.3); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.05); }

                /* OVERLAY HISTORY SIDEBAR (GLOBAL) */
                .research-layout {
                    position: relative;
                    display: block;
                    width: 100%;
                }

                .research-sidebar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    height: 100vh;
                    width: 320px !important;
                    z-index: 1000;
                    background: #0f172a;
                    box-shadow: 10px 0 50px rgba(0,0,0,0.5);
                    transform: translateX(-100%);
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    padding: 1.5rem !important;
                    display: flex;
                    flex-direction: column;
                }

                .research-sidebar.open {
                    transform: translateX(0);
                }

                .sidebar-backdrop {
                    display: block;
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(2px);
                    z-index: 999;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s;
                }

                .sidebar-backdrop.open { 
                    opacity: 1; 
                    pointer-events: auto;
                }

                /* Toggle Button - Fixed Bottom Left */
                .mobile-history-toggle {
                    display: flex !important;
                    position: fixed;
                    bottom: 2rem;
                    left: 300px;
                    z-index: 900;
                    background: #fbbf24;
                    color: #000;
                    border: none;
                    border-radius: 99px;
                    padding: 0.8rem 1.2rem;
                    font-weight: 700;
                    box-shadow: 0 4px 20px rgba(251, 191, 36, 0.4);
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .mobile-history-toggle:hover {
                    transform: scale(1.05);
                    box-shadow: 0 6px 25px rgba(251, 191, 36, 0.6);
                }

                @media (max-width: 1024px) {
                    .mobile-history-toggle {
                        left: 20px;
                    }
                }

                .sidebar-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .collapsed-icon-area { display: none !important; }

                /* CONTENT */
                .main-content-area { width: 100%; max-width: 100%; margin: 0 auto; }
                .research-header { margin-bottom: 3.5rem; }
                .header-flex { display: flex; gap: 2rem; align-items: center; }
                .logo-main { width: 85px; height: 85px; object-fit: contain; }
                .header-text h1 { font-size: 2.2rem; font-weight: 800; background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
                .header-text p { color: #94a3b8; font-size: 1.1rem; }

                .search-box-container { padding: 2rem; margin-bottom: 3.5rem; display: flex; flex-direction: column; gap: 1.5rem; border-radius: 20px; }
                .search-box { display: flex; gap: 1rem; }
                .search-box input { flex: 3; padding: 1.2rem; background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; transition: 0.2s; }
                .search-box input:focus { border-color: #fbbf24; outline: none; box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1); }
                .search-box button { flex: 1; padding: 1.2rem; background: #fbbf24; color: #020617; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; border: none; }
                .search-box button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 0 20px rgba(251, 191, 36, 0.3); }

                .jurisdiction-selector { display: flex; gap: 1rem; flex-wrap: wrap; }
                .radio-btn { display: flex; alignItems: center; gap: 0.5rem; padding: 0.6rem 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer; transition: 0.2s; font-size: 0.9rem; color: #cbd5e1; }
                .radio-btn.active { background: rgba(251, 191, 36, 0.1); border-color: #fbbf24; color: #fbbf24; }
                .radio-btn input { display: none; }
                .province-select { padding: 0.6rem 1rem; background: #0f172a; color: white; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer; outline: none; }

                .action-buttons { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; }
                .btn-action { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; padding: 0.7rem 1.4rem; border-radius: 10px; cursor: pointer; display: flex; gap: 0.6rem; align-items: center; font-weight: 500; transition: 0.2s; }
                .btn-action:hover { border-color: #fbbf24; color: #fbbf24; background: rgba(251, 191, 36, 0.05); }
                .btn-pdf:hover { border-color: #ef4444; color: #ef4444; background: rgba(239, 68, 68, 0.05); }

                .result-card { padding: 2.2rem; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; margin-bottom: 2rem; position: relative; overflow: hidden; }
                .result-card h3 { color: #fbbf24; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(251, 191, 36, 0.2); font-size: 1.3rem; letter-spacing: -0.01em; }
                .strategy { border: 1px solid rgba(251, 191, 36, 0.3); background: rgba(251, 191, 36, 0.05); }
                
                .categories-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
                .category-card { padding: 2.2rem; text-align: center; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; transition: 0.3s; background: rgba(255,255,255,0.02); }
                .category-card:hover { background: rgba(255,255,255,0.06); transform: translateY(-5px); border-color: rgba(255,255,255,0.2); }
                .category-card .icon { display: block; margin-bottom: 1rem; color: #fbbf24; transition: transform 0.3s ease; }
                .category-card:hover .icon { transform: scale(1.15); }
                
                .copy-toast { position: absolute; bottom: -2rem; right: 0; background: #10b981; color: white; padding: 0.3rem 0.8rem; border-radius: 6px; font-size: 0.8rem; font-weight: bold; animation: fadeUp 0.3s ease; }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

                /* MOBILE RESPONSIVE */
                @media (max-width: 1024px) {
                    .research-container { padding: 0 1.5rem 2rem; max-width: 100vw; }
                    .research-layout { position: relative; display: block; }
                    
                    /* FIXED Sidebar */
                    .research-sidebar {
                        position: fixed;
                        top: 0;
                        left: 0;
                        height: 100vh;
                        width: 280px !important;
                        z-index: 100;
                        transform: translateX(-100%);
                        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        padding: 1.5rem !important;
                    }
                    .research-sidebar.open { transform: translateX(0); }
                    .research-sidebar.closed { width: 280px; transform: translateX(-100%); }

                    /* Backdrop */
                    .sidebar-backdrop { z-index: 99; }

                    /* Toggle */
                    .mobile-history-toggle { display: flex; left: 20px; }
                    
                    /* Main Content */
                    .main-content-area { width: 100%; }

                    .header-flex { flex-direction: column; text-align: center; gap: 1rem; }
                    .logo-main { width: 60px; height: 60px; }
                    .header-text { text-align: center; }
                    .categories-grid { grid-template-columns: repeat(2, 1fr); }
                }

                @media (max-width: 768px) {
                    .search-box { flex-direction: column; }
                    .search-box button { width: 100%; height: 50px; }
                    .jurisdiction-selector { justify-content: center; flex-direction: column; width: 100%; }
                    .radio-btn { width: 100%; justify-content: center; }
                    .province-select { width: 100%; text-align: center; }
                    
                    .action-buttons { flex-direction: column; }
                    .btn-action { width: 100%; justify-content: center; }
                    .copy-toast { right: 50%; transform: translateX(50%); bottom: -3rem; }
                }
                
                @media (max-width: 480px) {
                    .categories-grid { grid-template-columns: 1fr; }
                    .dashboard-page-title { font-size: 1.5rem; }
                    .research-container { padding: 0 1rem 4rem; } 
                }
            `}</style>
        </div>
    );
}
