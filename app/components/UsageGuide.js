"use client";
import { useState } from 'react';
import { HelpCircle, X, ChevronRight, BookOpen } from 'lucide-react';
import './usage-guide.css';

/**
 * UsageGuide Component for Lawyers Dashboard
 * Renders a floating help icon that opens a blurred modal with professional instructions.
 */
export default function UsageGuide({ content }) {
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
