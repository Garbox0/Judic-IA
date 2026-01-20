"use client";
import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Link from 'next/link';
import {
    Briefcase,
    Gavel,
    Home,
    Building2,
    FileText,
    ClipboardCopy
} from 'lucide-react';

export default function DemoResearchPage() {
    // ... existing state ...
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('nacional'); // 'nacional' or 'provincial'
    const [province, setProvince] = useState('Buenos Aires');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    const [placeholder, setPlaceholder] = useState("Ej: Despido sin causa con antigüedad de 10 años en CABA...");

    // Hardcoded Demo Profile
    const userProfile = {
        full_name: 'Dr. Roberto Martínez',
        matricula: 'Tº 80 Fº 312 CPACF',
        id: 'demo-user'
    };

    const [logoBase64, setLogoBase64] = useState(null);

    useEffect(() => {
        // Demo: Skip Auth Check

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
                pdf.text("Judic-IA: Informe Legal (DEMO)", 42, 22);

                if (userProfile) {
                    pdf.setFontSize(9);
                    pdf.setTextColor(71, 85, 105);
                    const lawyerLines = [
                        userProfile.full_name,
                        `Matrícula: ${userProfile.matricula}`
                    ];
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

        const sections = [
            { title: "Normativa Aplicable", content: results.laws },
            { title: "Análisis de Jurisprudencia", content: results.cases },
            { title: "Liquidación Estimativa", content: results.calculation },
            { title: "Puntos de Prueba", content: results.evidence },
            { title: "Estrategia Recomendada", content: results.strategy }
        ];

        sections.forEach(section => {
            if (section.content) {
                const splitContent = doc.splitTextToSize(section.content, 180);
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

        doc.save(`Informe_JudicIA_DEMO_${new Date().getTime()}.pdf`);
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        const finalQuery = query || (placeholder.startsWith("Ej:") ? "" : placeholder);
        if (!finalQuery) return;

        setLoading(true);
        setResults(null);

        try {
            const res = await fetch('/api/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: finalQuery,
                    jurisdiction: scope === 'nacional' ? 'Nacional' : province,
                    userId: null, // No auth user in demo
                    mode: 'demo'  // Trigger Demo Limits
                })
            });
            const data = await res.json();

            // Handle Payment Required (Limit Exceeded)
            if (res.status === 402) {
                alert(data.cases); // Show the limit message
            }

            setResults(data);
        } catch (error) {
            console.error("Search error:", error);
        }
        setLoading(false);
    };

    const provinces = [
        "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
        "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza",
        "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
        "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
    ];

    return (
        <div className="research-container">
            <nav className="research-nav">
                <div className="breadcrumb">
                    <Link href="/demo/dashboard" className="breadcrumb-item">Gabinete (Demo)</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Investigación y Jurisprudencia</span>
                </div>
            </nav>

            <header className="research-header">
                <div className="header-flex">
                    <img src="/logo.png" alt="Judic-IA Logo" className="logo-main" />
                    <div className="header-text">
                        <h1 className="glow-text">Investigación y Jurisprudencia <span style={{ fontSize: '0.6em', background: '#fbbf24', color: '#020617', padding: '4px 8px', borderRadius: '12px', verticalAlign: 'middle' }}>DEMO</span></h1>
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
                    <button type="submit" disabled={loading}>
                        {loading ? 'Buscando...' : 'Consultar IA Legal'}
                    </button>
                </form>
                {results && results.laws && !results.laws.includes("LÍMITE") && (
                    <div className="action-buttons">
                        <div className="copy-container">
                            <button
                                className="btn-action"
                                onClick={() => {
                                    const text = `ESTUDIO LEGAL - INVESTIGACIÓN (DEMO)\n\nNORMATIVA:\n${results.laws}\n\nJURISPRUDENCIA:\n${results.cases}\n\nESTRATEGIA:\n${results.strategy}`;
                                    navigator.clipboard.writeText(text);
                                    setCopySuccess(true);
                                    setTimeout(() => setCopySuccess(false), 2000);
                                }}
                            >
                                <ClipboardCopy size={18} style={{ marginRight: '8px' }} /> Copiar Texto
                            </button>
                            {copySuccess && <span className="copy-toast">✨ ¡Copiado!</span>}
                        </div>
                        <button className="btn-action btn-pdf" onClick={handleDownloadPDF}>
                            <FileText size={18} style={{ marginRight: '8px' }} /> Descargar PDF
                        </button>
                    </div>
                )}
            </div>

            {results && results.laws && !results.laws.includes("LÍMITE") && (
                <div className="results-area">
                    <section className="result-card glass-card">
                        <h3>📚 Normativa Aplicable</h3>
                        <div className="content">{results.laws}</div>
                    </section>

                    <section className="result-card glass-card">
                        <h3>⚖️ Jurisprudencia Similares</h3>
                        <div className="content">{results.cases}</div>
                    </section>

                    {/* Simplified sections for Demo */}
                    <section className="result-card glass-card strategy">
                        <h3>💡 Sugerencia de Estrategia</h3>
                        <div className="content">{results.strategy}</div>
                    </section>

                    {results.links && results.links.length > 0 && (
                        <section className="result-card links">
                            <h3>🔗 Recursos y Enlaces Útiles</h3>
                            <div className="links-grid">
                                {results.links.map((link, idx) => {
                                    const safeUrl = link.url.startsWith('http') ? link.url : `https://${link.url}`;
                                    return (
                                        <a key={idx} href={safeUrl} target="_blank" rel="noopener noreferrer" className="link-item">
                                            {link.title} ↗
                                        </a>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* LIMIT MESSAGE DISPLAY */}
            {results && results.laws && results.laws.includes("LÍMITE") && (
                <div className="limit-card glass-card">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                    <h3>{results.laws}</h3>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{results.cases}</p>
                    <Link href="/pricing" className="btn-upgrade">Ver Planes y Precios</Link>
                </div>
            )}

            {!results && !loading && (
                <div className="guided-research">
                    <h3>💡 ¿Sobre qué quieres investigar hoy?</h3>
                    <div className="categories-grid">
                        <div className={`category-card glass-card ${activeCategory === 'laboral' ? 'active' : ''}`}
                            onClick={() => { setPlaceholder('Jurisprudencia sobre despidos con justa causa en CABA'); setQuery(''); setActiveCategory('laboral'); }}>
                            <span className="icon"><Briefcase size={32} /></span>
                            <h4>Laboral</h4>
                            <p>Despidos, accidentes, trabajo en negro.</p>
                        </div>
                        <div className={`category-card glass-card ${activeCategory === 'penal' ? 'active' : ''}`}
                            onClick={() => { setPlaceholder('Jurisprudencia sobre robo con arma de guerra y abuso de autoridad'); setQuery(''); setActiveCategory('penal'); }}>
                            <span className="icon"><Gavel size={32} /></span>
                            <h4>Penal</h4>
                            <p>Robo con armas, abusos, delitos complejos.</p>
                        </div>
                        <div className={`category-card glass-card ${activeCategory === 'civil' ? 'active' : ''}`}
                            onClick={() => { setPlaceholder('Sucesión con herederos forzosos y bienes en varias provincias'); setQuery(''); setActiveCategory('civil'); }}>
                            <span className="icon"><Home size={32} /></span>
                            <h4>Civil & Familia</h4>
                            <p>Sucesiones, divorcios, medianería.</p>
                        </div>
                        <div className={`category-card glass-card ${activeCategory === 'propiedad' ? 'active' : ''}`}
                            onClick={() => { setPlaceholder('Jurisprudencia sobre mediación y medianería en edificios'); setQuery(''); setActiveCategory('propiedad'); }}>
                            <span className="icon"><Building2 size={32} /></span>
                            <h4>Propiedad</h4>
                            <p>Medianería, consorcios, desalojos.</p>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .research-container {
                    padding: 2.5rem 3rem;
                    max-width: 1300px;
                    margin: 0 auto;
                    color: var(--foreground);
                    font-family: var(--font-outfit);
                    background: radial-gradient(circle at 50% 10%, #1e293b 0%, #020617 80%);
                    min-height: 100vh;
                }
                .research-nav {
                    margin-bottom: 3.5rem;
                }
                .breadcrumb {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    font-size: 0.9rem;
                    color: var(--muted);
                }
                .breadcrumb-item {
                    color: var(--muted);
                    text-decoration: none;
                    transition: all 0.2s;
                    font-weight: 500;
                    opacity: 0.8;
                }
                .breadcrumb-item:hover {
                    color: var(--primary);
                    opacity: 1;
                }
                .breadcrumb-separator {
                    opacity: 0.3;
                    font-size: 0.8rem;
                }
                .breadcrumb-current {
                    color: white;
                    font-weight: 600;
                    letter-spacing: 0.02em;
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
                .research-header h1 { 
                    color: var(--primary); 
                    margin-bottom: 0.2rem; 
                    font-size: 2.8rem; 
                    font-weight: 800;
                    letter-spacing: -0.02em;
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
                    background: rgba(15, 23, 42, 0.4); 
                    border: 1px solid rgba(255,255,255,0.05);
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
                    flex: 1;
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
                    padding: 1.2rem 2rem;
                    min-height: 100%;
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
                    color: var(--primary); 
                    margin-bottom: 1.5rem; 
                    font-size: 1.3rem; 
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    border-bottom: 1px solid rgba(197, 160, 33, 0.2); 
                    padding-bottom: 1rem; 
                }
                .result-card .content { 
                    line-height: 1.8; 
                    color: #e2e8f0; 
                    white-space: pre-wrap; 
                    font-size: 1.05rem; 
                    letter-spacing: 0.01em;
                }
                
                .strategy { 
                    border: 1px solid rgba(197, 160, 33, 0.3) !important;
                    background: rgba(197, 160, 33, 0.05) !important; 
                    box-shadow: inset 0 0 20px rgba(197, 160, 33, 0.05);
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
 
                .limit-card {
                    text-align: center;
                    padding: 4rem;
                    border: 1px solid rgba(255, 99, 71, 0.5);
                    background: rgba(40, 0, 0, 0.4);
                }
                .btn-upgrade {
                    display: inline-block;
                    margin-top: 1rem;
                    padding: 0.8rem 2rem;
                    background: var(--primary);
                    color: black;
                    font-weight: 700;
                    text-decoration: none;
                    border-radius: 8px;
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
                /* Responsive Mobile */
                @media (max-width: 768px) {
                    .research-container {
                        padding: 1.5rem 1rem;
                    }
                    .research-nav {
                        margin-bottom: 2rem;
                    }
                    .header-flex {
                        flex-direction: column;
                        text-align: center;
                        gap: 1rem;
                    }
                    .header-text {
                        text-align: center;
                    }
                    .research-header h1 {
                        font-size: 2rem;
                    }
                    .search-box-container {
                        padding: 1.5rem;
                    }
                    .search-box {
                        flex-direction: column;
                    }
                    .search-box button {
                        width: 100%;
                        padding: 1rem;
                    }
                    .categories-grid {
                        grid-template-columns: 1fr;
                    }
                    .action-buttons {
                        flex-direction: column;
                    }
                    .btn-action {
                        width: 100%;
                        justify-content: center;
                    }
                    .jurisdiction-selector {
                        justify-content: center;
                    }
                }
            `}</style>
        </div>
    );
}
