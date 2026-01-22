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
                {/* HISTORY SIDEBAR */}
                <aside className={`research-sidebar glass-panel ${sidebarOpen ? 'open' : 'closed'}`}>
                    <div className="sidebar-header-row">
                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase' }}>Historial (Demo)</h4>
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: '1.5rem' }}>
                            {sidebarOpen ? '✕' : '▶'}
                        </button>
                    </div>
                    {sidebarOpen && (
                        <div className="history-list">
                            {history.map(item => (
                                <div key={item.id} className="history-item" onClick={() => { setQuery(item.query); setResults(item.result_json); }} style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.5rem' }}>
                                    <div style={{ fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.query}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

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
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '0.4rem 0.8rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 800, marginBottom: '1.5rem' }}>
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
                                            {results.cases.map((c, i) => (
                                                <div key={i} className="case-item-card" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                                                    <h4 style={{ margin: '0 0 0.4rem 0', color: '#e2e8f0' }}>{c.title}</h4>
                                                    <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{c.summary}</p>
                                                    <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>Fuente: {c.source}</span>
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
                .research-container { padding: 0 1.5rem 2.5rem; max-width: 1600px; margin: 0 auto; color: white; }
                .research-layout { display: flex; gap: 1.5rem; }
                .research-sidebar { width: 300px; padding: 1.5rem; transition: 0.3s; }
                .research-sidebar.closed { width: 70px; padding: 0.5rem; overflow: hidden; }
                .main-content-area { flex: 1; min-width: 0; }
                .research-header { margin-bottom: 3.5rem; }
                .header-flex { display: flex; gap: 2rem; align-items: center; }
                .logo-main { width: 85px; height: 85px; object-fit: contain; }
                .search-box-container { padding: 2rem; margin-bottom: 3.5rem; display: flex; flex-direction: column; gap: 1.5rem; border-radius: 20px; }
                .search-box { display: flex; gap: 1rem; }
                .search-box input { flex: 3; padding: 1.2rem; background: rgba(15,23,42,0.5); border: 1px solid var(--border); border-radius: 12px; color: white; }
                .search-box button { flex: 1; padding: 1.2rem; background: var(--primary); color: #020617; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; }
                .search-box button:hover { transform: translateY(-2px); box-shadow: 0 0 20px var(--primary-glow); }
                .action-buttons { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; }
                .btn-action { background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 0.7rem 1.4rem; border-radius: 10px; cursor: pointer; display: flex; gap: 0.6rem; align-items: center; }
                .btn-action:hover { border-color: var(--primary); color: white; }
                .result-card { padding: 2.2rem; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; margin-bottom: 2rem; }
                .result-card h3 { color: var(--primary); margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(197, 160, 33, 0.2); }
                .strategy { border: 1px solid rgba(197, 160, 33, 0.3); background: rgba(197, 160, 33, 0.05); }
                .categories-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
                .category-card { padding: 2.2rem; text-align: center; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; transition: 0.3s; }
                .category-card:hover { background: rgba(255,255,255,0.06); transform: translateY(-5px); }
                .sidebar-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                @media (max-width: 1024px) {
                    .research-layout { display: block; }
                    .research-sidebar { position: fixed; top: 0; left: 0; height: 100vh; z-index: 100; background: #0f172a; transform: translateX(-100%); }
                    .research-sidebar.open { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}
