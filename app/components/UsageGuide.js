"use client";
import { useState } from 'react';
import { HelpCircle, X, ChevronRight, FileText, Scale, Calculator, Users, BookOpen } from 'lucide-react';

/**
 * UsageGuide Component for Demo Pages
 * Renders a floating help icon that opens a blurred modal with instructions.
 * Uses Lucide icons for bullet points and semantic sections.
 */
export default function UsageGuide({ content }) {
    const [isOpen, setIsOpen] = useState(false);

    // Determines icon based on content key or context (simplified for generalized usage)
    const BulletIcon = ChevronRight;

    // Simple markdown renderer for the demo content
    const renderMarkdown = (text) => {
        if (!text) return null;

        return text.split('\n').map((line, index) => {
            // Headers
            if (line.startsWith('### ')) return <h3 key={index} style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '1.5rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>{line.replace('### ', '')}</h3>;
            if (line.startsWith('## ')) return <h2 key={index} style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>{line.replace('## ', '')}</h2>;

            // Lists (Bullets)
            if (line.trim().startsWith('* ')) {
                return (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '0.6rem', paddingLeft: '0.5rem' }}>
                        <div style={{ marginTop: '4px', color: '#fbbf24' }}><ChevronRight size={16} /></div>
                        <span style={{ color: '#cbd5e1', lineHeight: '1.6' }}>{parseBold(line.replace('* ', ''))}</span>
                    </div>
                );
            }

            // Numbered Lists
            if (line.trim().match(/^\d+\.\s/)) {
                const [num, ...rest] = line.trim().split('.');
                return (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '0.6rem', paddingLeft: '0.5rem' }}>
                        <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontWeight: 'bold', minWidth: '20px', textAlign: 'right' }}>{num}.</span>
                        <span style={{ color: '#cbd5e1', lineHeight: '1.6' }}>{parseBold(rest.join('.'))}</span>
                    </div>
                );
            }

            // Blockquotes
            if (line.startsWith('> ')) {
                return <blockquote key={index} style={{ borderLeft: '4px solid #f59e0b', padding: '1rem', margin: '1.5rem 0', fontStyle: 'italic', color: '#cbd5e1', background: 'rgba(251, 191, 36, 0.05)', borderRadius: '0 8px 8px 0' }}>{parseBold(line.replace('> ', ''))}</blockquote>;
            }

            // Empty lines
            if (line.trim() === '') return <div key={index} style={{ height: '0.5rem' }}></div>;

            // Paragraphs
            return (
                <p key={index} style={{ marginBottom: '0.75rem', lineHeight: '1.7', color: '#94a3b8' }}>
                    {parseBold(line)}
                </p>
            );
        });
    };

    // Helper to bold text
    const parseBold = (text) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} style={{ color: 'white', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <>
            {/* TRIGGER BUTTON */}
            <button
                onClick={() => setIsOpen(true)}
                className="usage-guide-trigger"
                title="Ver Manual de Uso"
            >
                <HelpCircle size={20} />
            </button>

            {/* FLOATING MODAL */}
            {isOpen && (
                <div className="guide-overlay" onClick={() => setIsOpen(false)}>
                    <div className="guide-modal custom-scrollbar" onClick={e => e.stopPropagation()}>

                        {/* HEADER */}
                        <div className="guide-header">
                            <div className="guide-title-box">
                                <div className="guide-icon">
                                    <BookOpen size={24} color="#fbbf24" />
                                </div>
                                <h2>Manual de Uso</h2>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="guide-close-btn">
                                <X size={24} />
                            </button>
                        </div>

                        {/* CONTENT */}
                        <div className="guide-content custom-scrollbar">
                            {renderMarkdown(content)}
                        </div>

                        {/* FOOTER */}
                        <div className="guide-footer">
                            <button onClick={() => setIsOpen(false)} className="btn-close-guide">
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                /* TRIGGER STYLES */
                .usage-guide-trigger {
                    position: fixed; /* Changed from absolute to fixed */
                    top: 20px;
                    right: 20px;
                    background: rgba(251, 191, 36, 0.1);
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    color: #fbbf24;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 40;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    backdrop-filter: blur(4px);
                }
                .usage-guide-trigger:hover {
                    background: #fbbf24;
                    color: #0f172a;
                    transform: scale(1.1);
                    box-shadow: 0 6px 16px rgba(251, 191, 36, 0.3);
                }

                /* MODAL OVERLAY */
                .guide-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                    animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                /* MODAL CARD */
                .guide-modal {
                    background: #0f172a;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    width: 100%;
                    max-width: 600px;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05);
                    overflow: hidden;
                    animation: zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                /* HEADER */
                .guide-header {
                    padding: 1.5rem 2rem;
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(30, 41, 59, 0.3);
                    flex-shrink: 0;
                }
                .guide-title-box { display: flex; align-items: center; gap: 1rem; }
                .guide-title-box h2 { margin: 0; color: white; font-size: 1.25rem; font-weight: 600; letter-spacing: -0.01em; }
                .guide-icon {
                    padding: 0.6rem;
                    background: rgba(251, 191, 36, 0.1);
                    border-radius: 12px;
                    display: flex;
                    border: 1px solid rgba(251, 191, 36, 0.1);
                }
                .guide-close-btn {
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 0.4rem;
                    border-radius: 8px;
                    transition: all 0.2s;
                    display: flex;
                }
                .guide-close-btn:hover { color: white; background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }

                /* CONTENT */
                .guide-content {
                    padding: 2rem;
                    overflow-y: auto;
                    color: #e2e8f0;
                    font-size: 0.95rem;
                    line-height: 1.7;
                    flex: 1;
                }

                /* FOOTER */
                .guide-footer {
                    padding: 1.2rem;
                    border-top: 1px solid rgba(255,255,255,0.08);
                    background: rgba(15, 23, 42, 0.5);
                    text-align: right;
                    flex-shrink: 0;
                }
                .btn-close-guide {
                    padding: 0.7rem 1.8rem;
                    background: #fbbf24;
                    color: #0f172a;
                    border: none;
                    border-radius: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(251, 191, 36, 0.2);
                }
                .btn-close-guide:hover { background: #f59e0b; transform: translateY(-1px); box-shadow: 0 6px 12px -1px rgba(251, 191, 36, 0.3); }

                /* ANIMATIONS */
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zoomIn { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }

                /* RESPONSIVE */
                @media (max-width: 640px) {
                    .guide-modal {
                        max-height: 90vh;
                        border-radius: 16px;
                    }
                    .guide-header {
                        padding: 1rem 1.25rem;
                    }
                    .guide-content {
                        padding: 1rem 1.25rem;
                        font-size: 0.9rem;
                    }
                    .guide-footer {
                        padding: 1rem 1.25rem;
                    }
                    .usage-guide-trigger {
                        top: 12px;
                        right: 12px;
                        width: 32px;
                        height: 32px;
                    }
                    .guide-title-box h2 {
                        font-size: 1.1rem;
                    }
                }
            `}</style>
        </>
    );
}
