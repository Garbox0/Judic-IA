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
            if (line.startsWith('### ')) {
                return (
                    <h3 key={index} className="guide-h3">
                        {parseBold(line.replace('### ', ''))}
                    </h3>
                );
            }
            if (line.startsWith('## ')) {
                return (
                    <h2 key={index} className={`guide-h2 ${index === 0 ? 'mt-none' : 'mt-large'}`}>
                        {parseBold(line.replace('## ', ''))}
                    </h2>
                );
            }

            // Lists (Bullets)
            if (line.trim().startsWith('* ')) {
                return (
                    <div key={index} className="guide-list-item">
                        <div className="guide-bullet-icon"><ChevronRight size={14} /></div>
                        <span className="guide-list-text">{parseBold(line.replace('* ', ''))}</span>
                    </div>
                );
            }

            // Numbered Lists
            if (line.trim().match(/^\d+\.\s/)) {
                const [num, ...rest] = line.trim().split('.');
                return (
                    <div key={index} className="guide-num-item">
                        <span className="guide-num-marker">{num}.</span>
                        <span className="guide-num-text">{parseBold(rest.join('.'))}</span>
                    </div>
                );
            }

            // Blockquotes
            if (line.startsWith('> ')) {
                return (
                    <blockquote key={index} className="guide-blockquote">
                        {parseBold(line.replace('> ', ''))}
                    </blockquote>
                );
            }

            // Empty lines
            if (line.trim() === '') return <div key={index} className="guide-spacer"></div>;

            // Paragraphs
            return (
                <p key={index} className="guide-p">
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
                return <strong key={i} className="guide-strong">{part.slice(2, -2)}</strong>;
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
                                <h2 className="guide-title-h2">Guía de la Demo</h2>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="guide-close-btn">
                                <X size={24} />
                            </button>
                        </div>

                        {/* CONTENT */}
                        <div className="guide-content custom-scrollbar">
                            <div className="sandbox-notice">
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

const styles = `
.sandbox-notice {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: rgba(251, 191, 36, 0.1);
    border-radius: 12px;
    border: 1px solid rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    font-size: 0.85rem;
    font-weight: 600;
    text-align: center;
}
.guide-title-h2 {
    margin: 0 !important;
    color: white !important;
    font-size: 1.25rem !important;
    font-weight: 600 !important;
    border: none !important;
    padding: 0 !important;
}
`;
