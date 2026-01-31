"use client";
import { useState } from 'react';
import { HelpCircle, X, ChevronRight, BookOpen } from 'lucide-react';

/**
 * UsageGuideDemo Component specifically for Sandbox/Demo environment
 * Renders a floating gold help icon that opens a blurred modal with demo-specific instructions.
 */
export default function UsageGuideDemo({ content }) {
    const [isOpen, setIsOpen] = useState(false);

    // Simple markdown renderer for the demo content
    const renderMarkdown = (text) => {
        if (!text) return null;

        return text.split('\n').map((line, index) => {
            // Headers
            if (line.startsWith('### ')) return <h3 key={index} style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '1.5rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>{parseBold(line.replace('### ', ''))}</h3>;
            if (line.startsWith('## ')) return <h2 key={index} style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fbbf24', marginBottom: '1.2rem', paddingBottom: '0.6rem', borderBottom: '1px solid rgba(251, 191, 36, 0.2)', letterSpacing: '-0.02em', marginTop: index === 0 ? '0' : '1.5rem' }}>{parseBold(line.replace('## ', ''))}</h2>;

            // Lists (Bullets)
            if (line.trim().startsWith('* ')) {
                return (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '1rem', paddingLeft: '0.5rem' }}>
                        <div style={{ marginTop: '5px', color: '#fbbf24' }}><ChevronRight size={14} /></div>
                        <span style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.95rem' }}>{parseBold(line.replace('* ', ''))}</span>
                    </div>
                );
            }

            // Numbered Lists
            if (line.trim().match(/^\d+\.\s/)) {
                const [num, ...rest] = line.trim().split('.');
                return (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '1.2rem', paddingLeft: '0.5rem' }}>
                        <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontWeight: '800', minWidth: '24px', textAlign: 'left', fontSize: '1.05rem' }}>{num}.</span>
                        <span style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '1rem' }}>{parseBold(rest.join('.'))}</span>
                    </div>
                );
            }

            // Blockquotes
            if (line.startsWith('> ')) {
                return <blockquote key={index} style={{ borderLeft: '4px solid #fbbf24', padding: '1rem 1.4rem', margin: '1.5rem 0', fontStyle: 'italic', color: '#cbd5e1', background: 'rgba(251, 191, 36, 0.05)', borderRadius: '0 12px 12px 0', fontSize: '0.95rem', lineHeight: '1.6' }}>{parseBold(line.replace('> ', ''))}</blockquote>;
            }

            // Empty lines
            if (line.trim() === '') return <div key={index} style={{ height: '0.4rem' }}></div>;

            // Paragraphs
            return (
                <p key={index} style={{ marginBottom: '1rem', lineHeight: '1.7', color: '#94a3b8', fontSize: '0.95rem' }}>
                    {parseBold(line)}
                </p>
            );
        });
    };

    // Helper to bold text
    const parseBold = (text) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part && part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} style={{ color: 'white', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
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
                title="Guía de la Demo"
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
                                <h2 style={{ margin: 0, color: 'white', fontSize: '1.25rem', fontWeight: 600 }}>Guía de la Demo</h2>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="guide-close-btn">
                                <X size={24} />
                            </button>
                        </div>

                        {/* CONTENT */}
                        <div className="guide-content custom-scrollbar">
                            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.2)', color: '#fbbf24', fontSize: '0.85rem', fontWeight: '600', textAlign: 'center' }}>
                                🔓 Entorno Sandbox: Explora todas las funciones sin riesgo.
                            </div>
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
        </>
    );
}
