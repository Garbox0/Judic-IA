"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Link from 'next/link';
import SafeChatWidget from '../../components/SafeChatWidget';
import TetrisLoader from '../../components/TetrisLoader';

export default function ResearchPage() {
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('nacional'); // 'nacional' or 'provincial'
    const [province, setProvince] = useState('Buenos Aires');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshingCases, setRefreshingCases] = useState({}); // { [index]: true/false }
    const [copySuccess, setCopySuccess] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    const [placeholder, setPlaceholder] = useState("Ej: Despido sin causa con antigüedad de 10 años en CABA...");
    const [userProfile, setUserProfile] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [logoBase64, setLogoBase64] = useState(null);
    const [history, setHistory] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile: false = hidden
    const [timeLeft, setTimeLeft] = useState(0);
    const [searchStatus, setSearchStatus] = useState('');


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
        const fetchUserAndHistory = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUser(user);
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setUserProfile(profile);

                // Fetch History
                const { data: reports } = await supabase
                    .from('research_reports')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (reports) setHistory(reports);
            }
        };
        fetchUserAndHistory();

        // Convert logo to base64 for PDF
        const convertLogo = async () => {
            try {
                const response = await fetch('/logo.png');
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    setLogoBase64(reader.result);
                };
                reader.readAsDataURL(blob);
            } catch (err) {
                console.error("Error loading logo:", err);
            }
        };
        convertLogo();
    }, []);

    const handleDownloadPDF = () => {
        if (!results) return;

        const doc = new jsPDF();
        const timestamp = new Date().toLocaleDateString();

        const addWatermark = (pdf) => {
            if (logoBase64) {
                // Background watermark
                try {
                    pdf.setGState(new pdf.GState({ opacity: 0.05 }));
                    pdf.addImage(logoBase64, 'PNG', 45, 80, 120, 120, undefined, 'FAST');
                    pdf.setGState(new pdf.GState({ opacity: 1 }));
                } catch (e) {
                    // Fallback if GState fails
                    console.log("Watermark opacity skip", e);
                }
            }
        };

        const addHeader = (pdf, isFirstPage = false) => {
            addWatermark(pdf);

            if (isFirstPage) {
                if (logoBase64) {
                    pdf.addImage(logoBase64, 'PNG', 14, 10, 22, 22);
                }

                pdf.setFontSize(22);
                pdf.setTextColor(15, 23, 42);
                pdf.text("Judic-IA: Informe Legal", 42, 22);

                if (userProfile || currentUser) {
                    pdf.setFontSize(9);
                    pdf.setTextColor(71, 85, 105);

                    const name = userProfile?.full_name || currentUser?.user_metadata?.full_name || 'Dr./Dra. Judic-IA';
                    const matriculaRaw = userProfile?.matricula || currentUser?.user_metadata?.matricula;
                    const matriculaText = matriculaRaw ? `Matrícula: ${matriculaRaw}` : null; // Don't show "Pendiente" if we can help it, or show it if really missing

                    const lawyerLines = [name];
                    if (matriculaText) lawyerLines.push(matriculaText);
                    else lawyerLines.push('Matrícula: (Pendiente de registro)');

                    pdf.text(lawyerLines, 196, 18, { align: 'right' });
                }

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
                return 65; // yPos start
            }
            return 20; // yPos start for subsequest pages
        };

        let yPos = addHeader(doc, true);

        const safeRender = (content) => {
            if (!content) return "";
            let text = "";
            if (typeof content === 'string') text = content;
            else if (Array.isArray(content)) {
                if (content.length > 0 && content[0].title) {
                    // Remove emojis from here, use simple bullets
                    text = content.map(c => `• ${c.title}\n  ${c.summary}\n  (Fuente: ${c.source})`).join('\n\n');
                } else {
                    text = content.join('\n');
                }
            } else if (typeof content === 'object') {
                text = Object.entries(content).map(([k, v]) => `${k.toUpperCase()}:\n${v}`).join('\n\n');
            } else {
                text = String(content);
            }

            return text
                .replace(/\*\*/g, '')      // Remove bold markers
                .replace(/###\s?/g, '')    // Remove header markers
                .replace(/[^\x20-\x7E\n\r\t¡¿áéíóúÁÉÍÓÚñÑüÜ]/g, ''); // Remove non-latin chars (emojis)
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
                // Adjust width to be safe (170 instead of 180)
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

        // Links Section
        if (results.links && results.links.length > 0) {
            if (yPos > 240) {
                doc.addPage();
                yPos = addHeader(doc);
            } else {
                yPos += 10;
            }

            doc.setFontSize(16);
            doc.setTextColor(30, 41, 59);
            doc.text("Recursos y Enlaces Útiles", 14, yPos);

            let linkY = yPos + 10;
            results.links.forEach(link => {
                if (linkY > 275) {
                    doc.addPage();
                    linkY = addHeader(doc);
                }

                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.text(link.title, 14, linkY);

                doc.setFontSize(8);
                doc.setTextColor(0, 0, 255);
                const displayUrl = link.url.length > 105 ? link.url.substring(0, 102) + "..." : link.url;
                doc.textWithLink(displayUrl, 14, linkY + 5, { url: link.url });

                linkY += 15;
            });
        }

        doc.save(`Informe_JudicIA_${new Date().getTime()}.pdf`);
    };

    const handleRefreshCase = async (index) => {
        if (!query || refreshingCases[index]) return;

        setRefreshingCases(prev => ({ ...prev, [index]: true }));

        try {
            // Collect all current URLs to exclude
            const excludeUrls = results.cases.map(c => c.url).filter(Boolean);

            const res = await fetch('/api/research/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, excludeUrls })
            });

            if (!res.ok) throw new Error("Failed to refresh");

            const newCase = await res.json();

            setResults(prev => {
                const newCases = [...prev.cases];
                newCases[index] = newCase;
                return { ...prev, cases: newCases };
            });

        } catch (error) {
            console.error("Refresh error:", error);
            alert("No se pudo actualizar el fallo. Intente nuevamente.");
        } finally {
            setRefreshingCases(prev => ({ ...prev, [index]: false }));
        }
    };

    const renderContent = (content) => {
        if (!content) return null;
        let text = "";
        if (typeof content === 'string') text = content;
        else if (Array.isArray(content)) text = content.join('\n');
        else if (typeof content === 'object') text = Object.entries(content).map(([k, v]) => `### ${k}\n${v}`).join('\n\n');
        else text = String(content);

        // Pre-process: Logic to detect if it's a list (e.g. "1. xxx 2. xxx") and break lines
        // If we find "1. ", "2. " pattern in the text, we try to split it into a real list.
        const hasNumberedList = /\s\d+\.\s/.test(text) || /^\d+\.\s/.test(text);

        if (hasNumberedList) {
            // Split by number pattern but keep the delimiter to reconstruct or map
            const parts = text.split(/(\d+\.\s+)/).filter(Boolean);

            // If the split actually resulted in meaningful parts, render as list
            if (parts.length > 1) {
                return (
                    <ul style={{ listStyleType: 'none', paddingLeft: 0, margin: 0 }}>
                        {parts.reduce((acc, part, i) => {
                            // Check if this part is the number marker ("1. ")
                            if (/^\d+\.\s+$/.test(part)) {
                                acc.push({ marker: part.trim(), content: parts[i + 1] || "" });
                            }
                            return acc;
                        }, []).map((item, i) => (
                            <li key={i} style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 'bold', color: '#fbbf24', minWidth: '1.5em' }}>{item.marker}</span>
                                <span style={{ color: '#cbd5e1', lineHeight: '1.6' }}>{item.content}</span>
                            </li>
                        ))}
                    </ul>
                );
            }
        }

        return text.split('\n').map((line, index) => {
            // Handle Headers
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

            // Bold text
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
        setSearchStatus('Iniciando búsqueda avanzada con API Brave Search...');
        setTimeLeft(60); // Extended to 60s for Deep Mode
        setResults(null);

        try {
            const res = await fetch('/api/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: finalQuery,
                    jurisdiction: scope === 'nacional' ? 'Nacional' : province,
                    userId: userProfile?.id,
                    mode: 'pro'
                })
            });

            setSearchStatus('Analizando resultados en tiempo real...');
            const data = await res.json();
            setSearchStatus('Sintetizando informe legal...');
            setResults(data);
        } catch (error) {
            console.error("Search error:", error);
            setSearchStatus('Error en la investigación.');
        } finally {
            setLoading(false);
            setSearchStatus('');
        }
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
                {/* HISTORY SIDEBAR - Modified for Mobile Overlay */}
                <>
                    {/* Mobile Toggle Button (Visible only on small screens via CSS) */}
                    <button
                        className="mobile-history-toggle"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <span>🕒 Historial</span>
                    </button>

                    {/* Overlay Backdrop (only visible when sidebar is open on mobile) */}
                    <div
                        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                    />

                    <aside className={`research-sidebar glass-panel ${sidebarOpen ? 'open' : 'closed'}`}>
                        {/* Always show header with Close button on Mobile/Expand */}
                        {(sidebarOpen || true) && (
                            <div className="sidebar-header-row">
                                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase' }}>Historial</h4>
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
                                {history.length === 0 && <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>Sin investigaciones recientes.</p>}
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
                        <div className="breadcrumb">
                            <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                            <span className="breadcrumb-separator">/</span>
                            <span className="breadcrumb-current">Investigación y Jurisprudencia</span>
                        </div>
                    </nav>

                    <header className="research-header">
                        <div className="header-flex">
                            <img src="/logo.png" alt="Judic-IA Logo" className="logo-main" />
                            <div className="header-text">
                                <h1 className="dashboard-page-title">Investigación y Jurisprudencia</h1>
                                <p>Consulta normativa, códigos y fallos similares para tus casos con tecnología IA.</p>
                            </div>
                        </div>
                    </header>

                    <div className="search-box-container glass-panel">
                        <div className="jurisdiction-selector">
                            <label className={`radio-btn ${scope === 'nacional' ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="scope"
                                    value="nacional"
                                    checked={scope === 'nacional'}
                                    onChange={() => setScope('nacional')}
                                />
                                🇦🇷 Justicia Nacional / Federal
                            </label>
                            <label className={`radio-btn ${scope === 'provincial' ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="scope"
                                    value="provincial"
                                    checked={scope === 'provincial'}
                                    onChange={() => setScope('provincial')}
                                />
                                📍 Justicia Provincial
                            </label>

                            {scope === 'provincial' && (
                                <select
                                    className="province-select"
                                    value={province}
                                    onChange={(e) => setProvince(e.target.value)}
                                >
                                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            )}
                        </div>

                        <form onSubmit={handleSearch} className="search-box">
                            <input
                                type="text"
                                placeholder={placeholder}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <button type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                {loading ? 'Analizando...' : 'Consultar IA Legal'}
                            </button>
                        </form>
                        {loading && (
                            <div
                                className="loader-container"
                                style={{
                                    marginTop: '2rem',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    width: '100%',
                                }}
                            >
                                <div style={{ textAlign: 'center' }}>
                                    <TetrisLoader />
                                    <p style={{
                                        marginTop: '1.5rem',
                                        color: '#fbbf24',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        animation: 'pulse 2s infinite'
                                    }}>
                                        {searchStatus}
                                    </p>
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
                                                "🏦 ESTUDIO LEGAL - INVESTIGACIÓN DE IA (JUDIC-IA)",
                                                "",
                                                "📜 NORMATIVA APLICABLE:",
                                                results.laws,
                                                "",
                                                "⚖️ JURISPRUDENCIA & FALLOS:",
                                                Array.isArray(results.cases)
                                                    ? results.cases.map(c => `🔹 ${c.title}\n   ${c.summary}\n   Fuente: ${c.source}`).join('\n\n')
                                                    : results.cases,
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
                                        📋 Copiar Texto
                                    </button>
                                    {copySuccess && <span className="copy-toast">✨ ¡Copiado!</span>}
                                </div>
                                <button className="btn-action btn-pdf" onClick={handleDownloadPDF}>
                                    📄 Descargar PDF
                                </button>
                            </div>
                        )}
                    </div>

                    {results && (
                        <div className="results-area">
                            {results.brave_used && (
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'rgba(251, 191, 36, 0.15)',
                                    color: '#fbbf24',
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '99px',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    marginBottom: '1.5rem',
                                    border: '1px solid rgba(251, 191, 36, 0.3)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    <span>🦁 Brave Search Pro Activo</span>
                                    <span style={{ opacity: 0.6 }}>•</span>
                                    <span>Resultados en Tiempo Real</span>
                                </div>
                            )}
                            {results.laws && results.laws.length > 5 && (
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
                                            {results.cases.map((c, i) => {
                                                const safeUrl = (c.url && c.url.startsWith('http')) ? c.url : (c.url ? `https://${c.url}` : null);
                                                const isRefreshing = refreshingCases[i];
                                                return (
                                                    <div
                                                        key={i}
                                                        className="case-item-card"
                                                        style={{
                                                            marginBottom: '1rem',
                                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                            paddingBottom: '1rem',
                                                            opacity: isRefreshing ? 0.5 : 1,
                                                            transition: 'opacity 0.3s ease',
                                                            pointerEvents: isRefreshing ? 'none' : 'auto'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <h4 style={{ margin: '0 0 0.4rem 0', color: '#e2e8f0', fontSize: '1rem' }}>🏛️ {c.title}</h4>
                                                                <div className="case-summary-scroll" style={{
                                                                    maxHeight: '4.5em', // Approx 3 lines
                                                                    overflowY: 'auto',
                                                                    paddingRight: '5px',
                                                                    marginBottom: '0.4rem'
                                                                }}>
                                                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.5 }}>
                                                                        {c.summary}
                                                                    </p>
                                                                </div>
                                                                <span style={{ fontSize: '0.8rem', color: '#fbbf24', opacity: 0.8 }}>Fuente: {c.source || 'Referencia Legal'}</span>
                                                            </div>
                                                            {safeUrl && (
                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    <button
                                                                        className="btn-preview-icon"
                                                                        title="Buscar nueva alternativa (Refresh)"
                                                                        onClick={() => handleRefreshCase(i)}
                                                                        disabled={refreshingCases[i]}
                                                                    >
                                                                        <span className={refreshingCases[i] ? "spin-animation" : ""}>🔄</span>
                                                                    </button>
                                                                    <a
                                                                        href={safeUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="btn-link-icon"
                                                                        title="Abrir Fuente"
                                                                    >
                                                                        🔗
                                                                    </a>
                                                                    <button
                                                                        className="btn-preview-icon"
                                                                        title="Visualizar en Pestaña"
                                                                        onClick={() => window.open(`/api/proxy-pdf?url=${encodeURIComponent(safeUrl)}`, '_blank')}
                                                                    >
                                                                        👁️
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        // Fallback for old history items (String)
                                        results.cases
                                    )}
                                </div>
                            </section>

                            {results.calculation && results.calculation.length > 5 && (
                                <section className="result-card glass-card calculation">
                                    <h3>💰 Liquidación Estimada</h3>
                                    <div className="content">{renderContent(results.calculation)}</div>
                                </section>
                            )}

                            {results.evidence && results.evidence.length > 5 && (
                                <section className="result-card glass-card evidence">
                                    <h3>🔍 Puntos de Prueba (Sugeridos)</h3>
                                    <div className="content">{renderContent(results.evidence)}</div>
                                </section>
                            )}

                            {results.strategy && results.strategy.length > 5 && (
                                <section className="result-card glass-card strategy">
                                    <h3>💡 Sugerencia de Estrategia</h3>
                                    <div className="content">{renderContent(results.strategy)}</div>
                                </section>
                            )}

                            {results.links && results.links.length > 0 && (
                                <section className="result-card links">
                                    <h3>🔗 Recursos y Enlaces Útiles</h3>
                                    <div className="links-grid">
                                        {results.links.map((link, idx) => {
                                            const safeUrl = link.url.startsWith('http') ? link.url : `https://${link.url}`;
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
                        <div className="guided-research">
                            <h3>💡 ¿Sobre qué quieres investigar hoy?</h3>
                            <div className="categories-grid">
                                <div className={`category-card glass-card ${activeCategory === 'laboral' ? 'active' : ''}`}
                                    onClick={() => { setPlaceholder('Jurisprudencia sobre despidos con justa causa en CABA'); setQuery(''); setActiveCategory('laboral'); }}>
                                    <span className="icon">💼</span>
                                    <h4>Laboral</h4>
                                    <p>Despidos, accidentes, trabajo en negro.</p>
                                </div>
                                <div className={`category-card glass-card ${activeCategory === 'penal' ? 'active' : ''}`}
                                    onClick={() => { setPlaceholder('Jurisprudencia sobre robo con arma de guerra y abuso de autoridad'); setQuery(''); setActiveCategory('penal'); }}>
                                    <span className="icon">⚖️</span>
                                    <h4>Penal</h4>
                                    <p>Robo con armas, abusos, delitos complejos.</p>
                                </div>
                                <div className={`category-card glass-card ${activeCategory === 'civil' ? 'active' : ''}`}
                                    onClick={() => { setPlaceholder('Sucesión con herederos forzosos y bienes en varias provincias'); setQuery(''); setActiveCategory('civil'); }}>
                                    <span className="icon">🏠</span>
                                    <h4>Civil & Familia</h4>
                                    <p>Sucesiones, divorcios, medianería.</p>
                                </div>
                                <div className={`category-card glass-card ${activeCategory === 'propiedad' ? 'active' : ''}`}
                                    onClick={() => { setPlaceholder('Jurisprudencia sobre mediación y medianería en edificios'); setQuery(''); setActiveCategory('propiedad'); }}>
                                    <span className="icon">🏙️</span>
                                    <h4>Propiedad</h4>
                                    <p>Medianería, consorcios, desalojos.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!results && !loading && (
                        <div className="empty-state">
                            <p>O escribe tu propia consulta legal en la barra superior.</p>
                        </div>
                    )}

                </div>
            </div>

            <style jsx>{`
                .research-container {
                    padding: 0 1.5rem 2.5rem; /* Reduced horizontal padding from 3rem */
                    max-width: 1600px; /* Increased max-width from 1300px to fill more space */
                    margin: 0 auto;
                    color: var(--foreground);
                    font-family: var(--font-main);
                    overflow-x: hidden;
                }
                .research-layout {
                    display: flex;
                    gap: 1.5rem; /* Reduced gap from 2rem */
                    align-items: flex-start;
                    transition: all 0.3s ease;
                }
                .research-sidebar {
                    width: 300px;
                    transition: 0.3s;
                    padding: 1.5rem;
                    flex-shrink: 0;
                }
                .research-sidebar.closed {
                    width: 70px;
                    padding: 0.5rem;
                }
                .main-content-area {
                    flex: 1;
                    min-width: 0;
                }



                .research-header {
                    margin-bottom: 3.5rem;
                }
                .header-flex {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                }
                .logo-main {
                    width: 85px;
                    height: 85px;
                    object-fit: contain;
                    filter: drop-shadow(0 0 15px var(--primary-glow));
                }
                .header-text {
                    text-align: left;
                }

                .research-header p { 
                    color: var(--muted); 
                    font-size: 1.1rem;
                    margin: 0; 
                }
 
                .search-box-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    margin-bottom: 3.5rem;
                    padding: 2rem;
                    border-radius: 20px;
                }
 
                .jurisdiction-selector {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1.2rem;
                    align-items: center;
                }
                .radio-btn {
                    padding: 0.7rem 1.4rem;
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid var(--border);
                    border-radius: 99px;
                    cursor: pointer;
                    font-size: 0.95rem;
                    color: var(--muted);
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                }
                .radio-btn input { display: none; }
                .radio-btn.active {
                    background: rgba(197, 160, 33, 0.1);
                    border-color: var(--primary);
                    color: var(--primary);
                    box-shadow: 0 0 15px var(--primary-glow);
                }
                .province-select {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid var(--border);
                    color: white;
                    padding: 0.6rem 1.2rem;
                    border-radius: 10px;
                    font-size: 0.95rem;
                    outline: none;
                }
                .province-select:focus { border-color: var(--primary); }
 
                .search-box {
                    display: flex;
                    gap: 1rem;
                    margin: 0;
                    width: 100%;
                }
                .action-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 1rem;
                    margin-top: 1rem;
                }
                .btn-action {
                    background: transparent;
                    border: 1px solid var(--border);
                    color: var(--muted);
                    padding: 0.7rem 1.4rem;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 0.95rem;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                }
                .btn-action:hover {
                    border-color: var(--primary);
                    color: white;
                    background: rgba(197, 160, 33, 0.05);
                }
                .btn-pdf {
                    background: rgba(197, 160, 33, 0.1);
                    border-color: rgba(197, 160, 33, 0.3);
                    color: var(--primary);
                    font-weight: 600;
                }
                .btn-pdf:hover {
                    background: var(--primary);
                    color: #020617;
                    border-color: var(--primary);
                }
                .copy-toast {
                    position: absolute;
                    bottom: -1.8rem;
                    right: 0;
                    color: var(--primary);
                    font-size: 0.85rem;
                    font-weight: 600;
                    white-space: nowrap;
                    animation: fadeInOut 2s ease-in-out forwards;
                }
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(-5px); }
                    15% { opacity: 1; transform: translateY(0); }
                    85% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-5px); }
                }
                .search-box input {
                    flex: 3;
                    padding: 1.2rem;
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    color: white;
                    font-size: 1rem;
                    transition: all 0.2s;
                }
                .search-box input:focus {
                    border-color: var(--primary);
                    box-shadow: 0 0 0 2px var(--primary-glow);
                }
                .search-box input::placeholder { color: #475569; font-style: italic; }
                .search-box button {
                    flex: 1;
                    min-width: 180px;
                    max-width: 250px;
                    padding: 0 1.5rem;
                    background: var(--primary);
                    color: #020617;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 1rem;
                    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .search-box button:hover:not(:disabled) {
                    background: var(--primary-hover);
                    transform: translateY(-2px);
                    box-shadow: 0 0 20px var(--primary-glow);
                }
 
                .results-area {
                    display: grid;
                    gap: 2rem;
                    padding-bottom: 4rem;
                }
                .result-card {
                    padding: 2.2rem;
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    transition: all 0.3s ease;
                }
                .result-card:hover {
                    border-color: rgba(255, 255, 255, 0.15);
                    background: rgba(15, 23, 42, 0.7);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                }
                .result-card h3 { 
                    font-size: 1.3rem;
                    color: var(--primary); 
                    margin: 0 0 1.5rem 0; /* Increased margin for separation */
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    border-bottom: 1px solid rgba(197, 160, 33, 0.2); 
                    padding-bottom: 1rem; 
                }
                .result-card .content { 
                    line-height: 1.9; /* Slightly increased for readability */
                    color: #e2e8f0; 
                    white-space: pre-wrap; 
                    font-size: 1.05rem; 
                    letter-spacing: 0.01em;
                    padding-left: 0.5rem; /* Indentation for visual hierarchy */
                }
                
                .strategy { 
                    border: 1px solid rgba(197, 160, 33, 0.3) !important;
                    background: rgba(197, 160, 33, 0.05) !important; 
                    box-shadow: inset 0 0 20px rgba(197, 160, 33, 0.05);
                }
                .calculation { 
                    border: 1px solid rgba(16, 185, 129, 0.3) !important;
                    background: rgba(16, 185, 129, 0.03) !important; 
                }
                .evidence { 
                    border: 1px solid rgba(99, 102, 241, 0.3) !important;
                    background: rgba(99, 102, 241, 0.03) !important; 
                }
 
                .links-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .link-item {
                    background: rgba(15, 23, 42, 0.5);
                    padding: 0.8rem 1.4rem;
                    border-radius: 10px;
                    color: var(--primary);
                    font-weight: 600;
                    border: 1px solid var(--border);
                    transition: all 0.2s;
                }
                .link-item:hover {
                    background: var(--primary);
                    color: #020617;
                    border-color: var(--primary);
                }
 
                .guided-research { margin-top: 3.5rem; }
                .guided-research h3 { 
                    color: var(--muted); 
                    font-size: 1rem; 
                    margin-bottom: 2.5rem; 
                    text-align: left; 
                    font-weight: 700; 
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    opacity: 0.8;
                }
                .categories-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1.5rem;
                }
                .category-card {
                    padding: 2.2rem 1.8rem;
                    text-align: center;
                    cursor: pointer;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .category-card:hover {
                    transform: translateY(-8px);
                    background: rgba(255, 255, 255, 0.06);
                    border-color: rgba(255, 255, 255, 0.2);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }

                .link-wrapper { display: flex; align-items: center; gap: 0.5rem; width: 100%; }
                .link-item { flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
                .btn-preview {
                    background: rgba(197, 160, 33, 0.1);
                    border: 1px solid rgba(197, 160, 33, 0.3);
                    color: #fbbf24;
                    cursor: pointer;
                    border-radius: 8px;
                    padding: 0.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .btn-preview:hover {
                    background: var(--primary);
                    color: #020617;
                }

                .pdf-modal-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0,0,0,0.8);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 1000;
                    backdrop-filter: blur(5px);
                }
                .pdf-modal-content {
                    width: 90vw; height: 90vh;
                    background: #0f172a;
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    display: flex; flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .pdf-header {
                    padding: 1rem; border-bottom: 1px solid var(--border);
                    display: flex; justify-content: space-between; align-items: center;
                    background: rgba(15,23,42,0.9);
                }
                .pdf-header h4 { margin: 0; color: white; display: flex; align-items: center; gap: 0.5rem; }
                .pdf-header button { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1.2rem; transition: 0.2s; }
                .pdf-header button:hover { color: white; }
                .pdf-iframe { width: 100%; height: 100%; border: none; background: #e2e8f0; }

                /* NEW: Jurisprudence Card Styles */
                .btn-link-icon, .btn-preview-icon {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #94a3b8;
                    width: 32px; height: 32px;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-decoration: none;
                }
                .btn-link-icon:hover { background: rgba(56, 189, 248, 0.1); color: #38bdf8; border-color: #38bdf8; }
                .btn-preview-icon:hover { background: rgba(251, 191, 36, 0.1); color: #fbbf24; border-color: #fbbf24; }

                .category-card.active {
                    background: rgba(197, 160, 33, 0.12);
                    border-color: var(--primary);
                    box-shadow: 0 0 35px var(--primary-glow), inset 0 0 15px rgba(197, 160, 33, 0.1);
                    transform: translateY(-8px) scale(1.02);
                }
                .category-card .icon { 
                    font-size: 2.8rem; 
                    display: block; 
                    margin-bottom: 1.5rem; 
                    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
                    transition: transform 0.3s ease;
                }
                .category-card:hover .icon {
                    transform: scale(1.15);
                }
                .category-card h4 { color: white; margin-bottom: 0.8rem; font-size: 1.3rem; font-weight: 700; }
                .category-card p { color: var(--muted); font-size: 0.95rem; line-height: 1.6; margin: 0; opacity: 0.8; }
 
                .empty-state { text-align: center; padding: 4rem 0; color: #475569; font-style: italic; }

                .mobile-history-toggle {
                    display: none; /* Hidden by default on desktop */
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    z-index: 90;
                    background: #fbbf24;
                    color: black;
                    border: none;
                    border-radius: 99px;
                    padding: 0.8rem 1.2rem;
                    font-weight: 700;
                    box-shadow: 0 4px 20px rgba(251, 191, 36, 0.4);
                    align-items: center;
                    gap: 0.5rem;
                }
                .sidebar-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }
                
                /* Icon when collapsed on desktop */
                .collapsed-icon-area {
                    width: 100%;
                    height: 100%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .research-sidebar.closed .sidebar-header-row { display: none; } /* Hide header when closed on desktop */
                
                .research-sidebar.closed .sidebar-header-row { display: none; } /* Hide header when closed on desktop */
                
                /* New Intuitive Trigger */
                .vertical-trigger {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.5rem;
                    padding: 1rem 0;
                    height: 100%;
                    justify-content: center;
                    transition: all 0.3s;
                }
                .v-icon {
                    font-size: 1.5rem;
                    filter: grayscale(1);
                    transition: all 0.3s;
                }
                .v-label {
                    writing-mode: vertical-rl;
                    transform: rotate(180deg);
                    font-weight: 700;
                    font-size: 0.85rem;
                    letter-spacing: 0.25rem;
                    color: #64748b;
                    text-transform: uppercase;
                    transition: all 0.3s;
                }
                .collapsed-icon-area:hover .v-label {
                    color: var(--primary);
                    text-shadow: 0 0 15px rgba(251, 191, 36, 0.4);
                }
                .collapsed-icon-area:hover .v-icon {
                    filter: grayscale(0);
                    transform: scale(1.1);
                }

                /* MOBILE RESPONSIVE */
                @media (max-width: 1024px) {
                    .research-container { padding: 0 1.5rem 2rem; max-width: 100vw; }
                    .research-layout { 
                        position: relative; /* Context for absolute sidebar */
                        display: block; /* Stack vertically, but sidebar will be absolute */
                    }
                    
                    /* FIXED: Sidebar as Overlay/Drawer on Mobile */
                    .research-sidebar {
                        position: fixed;
                        top: 0;
                        left: 0;
                        height: 100vh;
                        width: 280px !important;
                        z-index: 100;
                        background: #0f172a;
                        /* border-right: 1px solid var(--border); */
                        box-shadow: 10px 0 50px rgba(0,0,0,0.5);
                        transform: translateX(-100%); /* Hidden by default */
                        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        padding: 1.5rem !important;
                    }
                    .research-sidebar.open {
                        transform: translateX(0); /* Slide in */
                    }
                    /* "Closed" state on mobile is completely hidden off-canvas */
                    .research-sidebar.closed {
                        width: 280px; 
                        transform: translateX(-100%);
                        padding: 1.5rem;
                        height: 100vh;
                    }

                    /* BACKDROP ONLY FOR MOBILE */
                    .sidebar-backdrop {
                        display: block;
                        position: fixed;
                        inset: 0;
                        background: rgba(0,0,0,0.6);
                        backdrop-filter: blur(2px);
                        z-index: 99;
                        opacity: 0;
                        pointer-events: none;
                        transition: opacity 0.3s;
                    }
                    .sidebar-backdrop.open { 
                        opacity: 1; 
                        pointer-events: auto;
                    }

                    /* Show Toggle Button on Mobile */
                    .mobile-history-toggle {
                        display: flex; 
                    }
                    .collapsed-icon-area { display: none; }
                    
                    /* Main Content full width */
                    .main-content-area {
                        width: 100%;
                    }

                    .header-flex { flex-direction: column; text-align: center; gap: 1rem; }
                    .logo-main { width: 60px; height: 60px; }
                    .header-text { text-align: center; }
                    .categories-grid { grid-template-columns: repeat(2, 1fr); }
                }

                @media (max-width: 768px) {
                    .search-box { flex-direction: column; }
                    .search-box button { width: 100%; max-width: none; min-width: 0; height: 50px; }
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
                    .research-container { padding: 0 1rem 4rem; } /* More bottom padding */
                }

                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: #fff;
                    animation: spin 1s ease-in-out infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
            `}</style>
        </div>
    );
}
