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
        </>
    );
}
