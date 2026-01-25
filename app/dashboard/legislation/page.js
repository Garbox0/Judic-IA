"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Book, Gavel, FileText, Scale, Search, Map, Globe, Shield } from 'lucide-react';

export default function LegislationPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProvince, setSelectedProvince] = useState('Buenos Aires');

    const handleSearch = (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        // Smart Search: Use Google Site Search for reliable InfoLeg results
        const url = `https://www.google.com/search?q=site:infoleg.gob.ar+${encodeURIComponent(searchQuery)}`;
        window.open(url, '_blank');
    };

    const nationalCodes = [
        {
            title: "Código Civil y Comercial de la Nación",
            desc: "Normativa unificada que regula las relaciones civiles y comerciales.",
            url: "http://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/texact.htm",
            icon: <Scale size={32} className="text-amber-400" />
        },
        {
            title: "Código Penal de la Nación",
            desc: "Establece los delitos y las penas en el territorio argentino.",
            url: "http://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16546/texact.htm",
            icon: <Gavel size={32} className="text-amber-400" />
        },
        {
            title: "Código Procesal Civil y Comercial (Nación)",
            desc: "Reglas de procedimiento para juicios en ámbito nacional.",
            url: "http://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16545/texact.htm",
            icon: <Book size={32} className="text-amber-400" />
        },
        {
            title: "Ley de Contrato de Trabajo (20.744)",
            desc: "Régimen de contrato de trabajo para el sector privado.",
            url: "http://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25552/texact.htm",
            icon: <FileText size={32} className="text-amber-400" />
        },
        {
            title: "Código Aduanero (Ley 22.415)",
            desc: "Disposiciones sobre el tráfico internacional de mercaderías.",
            url: "http://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16536/texact.htm",
            icon: <Globe size={32} className="text-amber-400" />
        },
        {
            title: "Código Aeronáutico (Ley 17.285)",
            desc: "Rige la aeronáutica civil en el territorio de la República.",
            url: "http://servicios.infoleg.gob.ar/infolegInternet/anexos/20000-24999/24963/texact.htm",
            icon: <Shield size={32} className="text-amber-400" />
        }
    ];

    const provincialData = {
        "Buenos Aires": [
            { title: "Constitución de la Pcia. de Bs. As.", url: "https://normas.gba.gob.ar/documentos/0Z0000X0.html" },
            { title: "Código Procesal Civil y Comercial (PBA)", url: "https://normas.gba.gob.ar/documentos/0X0000X0.html" },
            { title: "Código Procesal Penal (PBA)", url: "https://normas.gba.gob.ar/documentos/0W0000X0.html" },
            { title: "Ley de Procedimiento Administrativo", url: "https://normas.gba.gob.ar/documentos/0V0000X0.html" }
        ],
        "CABA": [
            { title: "Constitución de la CABA", url: "https://boletinoficial.buenosaires.gob.ar/normativaba/norma/290000" },
            { title: "Código Contencioso Admin. y Tributario", url: "https://boletinoficial.buenosaires.gob.ar/normativaba/norma/310000" },
            { title: "Código Procesal Penal CABA", url: "https://boletinoficial.buenosaires.gob.ar/normativaba/norma/420000" }
        ],
        "Córdoba": [
            { title: "Constitución de la Pcia. de Córdoba", url: "https://www.legiscba.gob.ar/" },
            { title: "Código Procesal Civil y Comercial", url: "https://seo.tsj.cba.gov.ar/" }
        ],
        "Santa Fe": [
            { title: "Constitución de la Pcia. de Santa Fe", url: "https://www.santafe.gov.ar/index.php/web/content/view/full/113110" },
            { title: "Código Procesal Civil y Comercial", url: "https://www.santafe.gov.ar/normativa/" }
        ]
    };

    const provinces = Object.keys(provincialData);

    return (
        <div className="legislation-container">
            <nav className="legislation-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Legislación y Códigos</span>
                </div>
            </nav>

            <header className="legislation-header">
                <div className="header-content">
                    <h1>⚖️ Códigos de Fondo y Forma</h1>
                    <p>Acceso directo a las fuentes normativas oficiales (InfoLeg) y legislación provincial.</p>
                </div>

                {/* INFOLEG SEARCH BAR */}
                <div className="infoleg-search glass-panel">
                    <form onSubmit={handleSearch} className="search-form">
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar en InfoLeg (Ej: Ley 27.551, Divorcio...)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit">Buscar Norma</button>
                    </form>
                </div>
            </header>

            <section className="section-title">
                <h2>📜 Legislación Nacional</h2>
            </section>

            <div className="codes-grid">
                {nationalCodes.map((code, index) => (
                    <a
                        key={index}
                        href={code.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="code-card glass-panel"
                    >
                        <div className="icon-wrapper">
                            {code.icon}
                        </div>
                        <div className="code-info">
                            <h3>{code.title}</h3>
                            <p>{code.desc}</p>
                            <span className="link-text">Ver Texto Actualizado (InfoLeg) →</span>
                        </div>
                    </a>
                ))}
            </div>

            <section className="section-title" style={{ marginTop: '4rem' }}>
                <div className="provincial-header">
                    <h2>📍 Legislación Provincial</h2>
                    <div className="province-selector">
                        <Map size={18} />
                        <select
                            value={selectedProvince}
                            onChange={(e) => setSelectedProvince(e.target.value)}
                        >
                            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>
            </section>

            <div className="provincial-grid">
                {provincialData[selectedProvince]?.map((norm, index) => (
                    <a
                        key={index}
                        href={norm.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="province-card glass-panel"
                    >
                        <h3>{norm.title}</h3>
                        <span className="province-badge">{selectedProvince}</span>
                        <span className="arrow">↗</span>
                    </a>
                ))}
            </div>

            <style jsx>{`
                .legislation-container { padding: 0 3rem 3rem; max-width: 1200px; margin: 0 auto; color: white; }
                
                @media (max-width: 900px) {
                    .legislation-container { padding: 0 1.5rem 2rem; }
                }

                .breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 2rem; color: #94a3b8; }
                .breadcrumb-item { color: #94a3b8; text-decoration: none; transition: 0.2s; }
                .breadcrumb-item:hover { color: #fbbf24; }
                .breadcrumb-separator { opacity: 0.5; }
                .breadcrumb-current { color: #fbbf24; font-weight: 600; }

                .legislation-header { margin-bottom: 3rem; }
                .header-content h1 { font-size: 2rem; margin-bottom: 0.5rem; }
                .header-content p { color: #94a3b8; margin-bottom: 1.5rem; }

                /* SEARCH BAR */
                .infoleg-search {
                    padding: 0.5rem;
                    border-radius: 50px; /* Pillow shape for better definition */
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    background: rgba(15, 23, 42, 0.95); /* More solid background */
                    max-width: 800px;
                    width: 100%;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center; /* Vertical center */
                }

                .infoleg-search:focus-within {
                    border-color: #fbbf24;
                    box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.2);
                }

                .search-form {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    width: 100%;
                    gap: 0.5rem; /* Small gap between input and button */
                }

                .search-icon { 
                    color: #fbbf24; 
                    margin-left: 1rem;
                    flex-shrink: 0;
                }

                .search-form input {
                    flex: 1; /* Takes ALL remaining space */
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 1rem;
                    padding: 0.8rem 0.5rem;
                    outline: none;
                    min-width: 0;
                }

                .search-form input::placeholder {
                    color: #64748b;
                }

                .search-form button {
                    background: #fbbf24;
                    color: #020617;
                    border: none;
                    padding: 0.6rem 1.2rem; /* Increased vertical padding */
                    border-radius: 50px;
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: 0.2s;
                    white-space: nowrap;
                    flex-shrink: 0;
                    width: auto;
                    max-width: fit-content;
                    margin-right: 0.4rem;
                }

                .search-form button:hover { 
                    transform: scale(1.05);
                    background: #f59e0b;
                }

                .section-title h2 {
                    font-size: 1.5rem;
                    color: #e2e8f0;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    padding-bottom: 1rem;
                    margin-bottom: 1.5rem;
                }

                .provincial-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    padding-bottom: 1rem;
                    margin-bottom: 1.5rem;
                }
                
                .provincial-header h2 {
                    border: none;
                    padding: 0;
                    margin: 0;
                }

                .province-selector {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(15, 23, 42, 0.8);
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .province-selector select {
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 0.9rem;
                    outline: none;
                    cursor: pointer;
                }

                .codes-grid { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); 
                    gap: 1.5rem; 
                }

                .code-card { 
                    padding: 2rem; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 1.5rem; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid rgba(255,255,255,0.05);
                    background: rgba(30, 41, 59, 0.4);
                    border-radius: 16px;
                    text-decoration: none;
                }

                .provincial-grid {
                    display: grid; 
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
                    gap: 1rem; 
                }

                .province-card {
                    padding: 1.2rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: rgba(30, 41, 59, 0.4);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 10px;
                    text-decoration: none;
                    transition: 0.2s;
                }

                .province-card:hover {
                    background: rgba(30, 41, 59, 0.6);
                    border-color: #fbbf24;
                    transform: translateX(5px);
                }

                .province-card h3 {
                    font-size: 0.95rem;
                    color: #e2e8f0;
                    margin: 0;
                    font-weight: 500;
                }

                .province-badge {
                    font-size: 0.7rem;
                    background: rgba(251, 191, 36, 0.1);
                    color: #fbbf24;
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    margin-left: auto;
                    margin-right: 0.5rem;
                }

                .arrow { color: #94a3b8; }

                .glass-panel {
                    backdrop-filter: blur(12px);
                }

                .code-card:hover { 
                    transform: translateY(-5px); 
                    border-color: rgba(251, 191, 36, 0.3); 
                    background: rgba(30, 41, 59, 0.6);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
                }

                .icon-wrapper {
                    background: rgba(251, 191, 36, 0.1);
                    width: 60px;
                    height: 60px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .code-info h3 { 
                    font-size: 1.25rem; 
                    line-height: 1.4; 
                    margin: 0 0 0.5rem 0; 
                    color: #f8fafc; 
                    font-weight: 700; 
                }
                
                .code-info p { 
                    font-size: 0.95rem; 
                    color: #cbd5e1; 
                    line-height: 1.6; 
                    margin: 0 0 1.5rem 0;
                }

                .link-text {
                    font-size: 0.9rem;
                    color: #fbbf24;
                    font-weight: 600;
                    margin-top: auto;
                }

                @media (max-width: 600px) {
                    .codes-grid { grid-template-columns: 1fr; }
                    .provincial-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
                    .infoleg-search { max-width: 100%; }
                }
            `}</style>
        </div>
    );
}
