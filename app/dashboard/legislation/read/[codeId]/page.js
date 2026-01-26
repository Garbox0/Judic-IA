"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Search, Bookmark, Share2, Copy, Menu } from 'lucide-react';

// Import mocked data (In real app, fetch from DB/API)
import { cccnData } from '../../data/cccn';

export default function CodeReaderPage() {
    const params = useParams();
    const codeId = params.codeId;

    // In a real app, use codeId to fetch the correct data
    const code = codeId === 'cccn' ? cccnData : null;

    const [searchTerm, setSearchTerm] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeArticle, setActiveArticle] = useState(null);

    // Initial check for mobile to autoclose sidebar
    useEffect(() => {
        if (window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    }, []);

    if (!code) {
        return (
            <div className="reader-container">
                <div className="error-state">
                    <h2>Código no encontrado</h2>
                    <Link href="/dashboard/legislation" className="back-link">Volver a Legislación</Link>
                </div>
            </div>
        );
    }

    // Smart Filter: Flatten articles for search
    const filterContent = () => {
        if (!searchTerm) return code.structure;

        // Deep clone to avoid mutating original
        // This is a simple client-side filter for POC
        return code.structure.map(level => ({
            ...level,
            chapters: level.chapters.map(chapter => ({
                ...chapter,
                articles: chapter.articles.filter(art =>
                    art.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    art.number.includes(searchTerm)
                )
            })).filter(ch => ch.articles.length > 0)
        })).filter(lvl => lvl.chapters.length > 0);
    };

    const filteredStructure = filterContent();

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        // Could add toast here
    };

    return (
        <div className="reader-layout">

            {/* LEFT SIDEBAR: Index / TOC */}
            <aside className={`reader-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="search-box">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar artículo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="toc-content">
                    {filteredStructure.map((level, i) => (
                        <div key={i} className="toc-level">
                            <h4 className="level-title">{level.level}</h4>
                            {level.chapters.map((chapter, j) => (
                                <div key={j} className="toc-chapter">
                                    <h5 className="chapter-title">{chapter.title}</h5>
                                    <div className="toc-articles">
                                        {chapter.articles.map((art, k) => (
                                            <a
                                                key={k}
                                                href={`#art-${art.number}`}
                                                className={`toc-link ${Number(activeArticle) === Number(art.number) ? 'active' : ''}`}
                                                onClick={() => {
                                                    if (window.innerWidth < 1024) setSidebarOpen(false);
                                                }}
                                            >
                                                <span className="art-num">Art. {art.number}</span>
                                                <span className="art-name">{art.title}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="reader-main">
                {/* TOOLBAR */}
                <header className="reader-toolbar glass-panel">
                    <div className="toolbar-left">
                        <button
                            className="toggle-sidebar-btn"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            <Menu size={20} />
                        </button>
                        <Link href="/dashboard/legislation" className="back-btn">
                            <ArrowLeft size={18} />
                            <span>Volver</span>
                        </Link>
                        <div className="code-meta">
                            <h1>{code.title}</h1>
                            <span className="update-badge">Actualizado: {code.lastUpdate}</span>
                        </div>
                    </div>
                </header>

                <div className="content-scroll">
                    <div className="document-body">
                        {filteredStructure.length === 0 && (
                            <div className="no-results">
                                <p>No se encontraron artículos con "{searchTerm}"</p>
                            </div>
                        )}

                        {filteredStructure.map((level, i) => (
                            <div key={i} className="doc-level">
                                <h2 className="level-heading">{level.level}</h2>
                                {level.chapters.map((chapter, j) => (
                                    <div key={j} className="doc-chapter">
                                        <h3 className="chapter-heading">{chapter.title}</h3>
                                        {chapter.articles.map((art, k) => (
                                            <article
                                                id={`art-${art.number}`}
                                                key={k}
                                                className="doc-article glass-panel"
                                            >
                                                <div className="article-header">
                                                    <h4>Artículo {art.number} <span className="art-subtitle">{art.title}</span></h4>
                                                    <div className="article-actions">
                                                        <button
                                                            onClick={() => handleCopy(`Artículo ${art.number} (${code.title}): ${art.content}`)}
                                                            className="action-btn"
                                                            title="Copiar texto"
                                                        >
                                                            <Copy size={16} />
                                                        </button>
                                                        {/* Future: Bookmark feature */}
                                                        {/* <button className="action-btn"><Bookmark size={16} /></button> */}
                                                    </div>
                                                </div>
                                                <div className="article-content">
                                                    <p>{art.content}</p>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    <footer className="reader-footer">
                        <p>Fuente: Texto oficial digitalizado. Judic-IA no se responsabiliza por errores de transcripción.</p>
                    </footer>
                </div>
            </main>

            <style jsx>{`
                .reader-layout {
                    display: flex;
                    height: 100vh;
                    overflow: hidden;
                    background: #020617;
                    color: #fff;
                    position: relative;
                }

                /* SIDEBAR */
                .reader-sidebar {
                    width: 300px;
                    background: #0f172a;
                    border-right: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    flex-direction: column;
                    transition: all 0.3s ease;
                    flex-shrink: 0;
                    z-index: 20;
                }
                .reader-sidebar.closed {
                    margin-left: -300px;
                }

                .sidebar-header {
                    padding: 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .search-box {
                    position: relative;
                    background: rgba(30, 41, 59, 0.5);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .search-icon { margin-left: 0.5rem; color: #94a3b8; }
                .search-box input {
                    width: 100%;
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 0.6rem;
                    font-size: 0.9rem;
                    outline: none;
                }

                .toc-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem;
                }
                .toc-level { margin-bottom: 1.5rem; }
                .level-title { font-size: 0.75rem; color: #fbbf24; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.5px; opacity: 0.8; }
                .chapter-title { font-size: 0.85rem; color: #e2e8f0; margin-bottom: 0.5rem; font-weight: 600; padding-left: 0.5rem; border-left: 2px solid rgba(255,255,255,0.1); }
                
                .toc-articles { display: flex; flex-direction: column; gap: 2px; }
                .toc-link {
                    display: flex; gap: 0.5rem;
                    padding: 0.4rem 0.6rem;
                    border-radius: 6px;
                    text-decoration: none;
                    color: #94a3b8;
                    font-size: 0.85rem;
                    transition: 0.2s;
                    align-items: baseline;
                }
                .toc-link:hover { background: rgba(255,255,255,0.05); color: white; }
                .toc-link.active { background: rgba(59, 130, 246, 0.1); color: #60a5fa; }
                .art-num { font-weight: 700; font-family: 'Geist Mono', monospace; font-size: 0.8rem; }
                .art-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.8; }

                /* MAIN */
                .reader-main {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    min-width: 0; /* Fix flex overflow */
                }

                .reader-toolbar {
                    height: 64px;
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0 1.5rem;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    background: rgba(2, 6, 23, 0.8);
                    backdrop-filter: blur(12px);
                    z-index: 10;
                }
                .toolbar-left { display: flex; align-items: center; gap: 1rem; }
                
                .toggle-sidebar-btn {
                    background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.5rem;
                    border-radius: 6px; transition: 0.2s;
                }
                .toggle-sidebar-btn:hover { background: rgba(255,255,255,0.1); color: white; }

                .back-btn {
                    display: flex; align-items: center; gap: 0.4rem;
                    color: #94a3b8; text-decoration: none; font-size: 0.9rem;
                    padding: 0.4rem 0.8rem;
                    border-radius: 6px;
                    transition: 0.2s;
                }
                .back-btn:hover { background: rgba(255,255,255,0.1); color: white; }

                .code-meta h1 { font-size: 1.1rem; margin: 0; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .update-badge { font-size: 0.7rem; color: #64748b; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; }

                .content-scroll {
                    flex: 1;
                    overflow-y: auto;
                    padding: 2rem;
                    scroll-behavior: smooth;
                }

                .document-body {
                    max-width: 800px;
                    margin: 0 auto;
                    padding-bottom: 4rem;
                }

                .level-heading { font-size: 1.8rem; color: #fbbf24; text-align: center; margin: 3rem 0 1.5rem; text-transform: uppercase; border-bottom: 1px solid rgba(251, 191, 36, 0.2); padding-bottom: 0.5rem; }
                .chapter-heading { font-size: 1.4rem; color: #e2e8f0; margin: 2rem 0 1rem; border-left: 4px solid #fbbf24; padding-left: 1rem; }

                .doc-article {
                    margin-bottom: 1.5rem;
                    background: rgba(30, 41, 59, 0.4);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 12px;
                    padding: 1.5rem;
                }
                
                .article-header {
                    display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;
                    border-bottom: 1px dashed rgba(255,255,255,0.1);
                    padding-bottom: 0.8rem;
                }
                .article-header h4 { margin: 0; font-size: 1.1rem; color: #fbbf24; }
                .art-subtitle { color: #94a3b8; font-weight: 400; margin-left: 0.5rem; font-size: 1rem; }
                
                .action-btn {
                    background: transparent; border: none; color: #64748b; cursor: pointer; padding: 0.4rem;
                    border-radius: 6px; transition: 0.2s;
                }
                .action-btn:hover { background: rgba(255,255,255,0.1); color: white; }

                .article-content p {
                    font-size: 1.05rem;
                    line-height: 1.7;
                    color: #e2e8f0;
                    margin: 0;
                    text-align: justify;
                }

                .reader-footer { text-align: center; font-size: 0.8rem; color: #475569; margin-top: 2rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.05); }

                @media (max-width: 1024px) {
                    .reader-sidebar { position: absolute; height: 100%; box-shadow: 10px 0 30px rgba(0,0,0,0.5); }
                    .reader-main { width: 100%; }
                }
                @media (max-width: 600px) {
                    .content-scroll { padding: 1rem; }
                    .code-meta h1 { max-width: 160px; }
                }
            `}</style>
        </div>
    );
}
