"use client";
import { useState, useEffect, useRef } from 'react';
import { HelpCircle, X, ChevronRight, BookOpen } from 'lucide-react';
import './usage-guide.css';

/**
 * UsageGuide Component for Lawyers Dashboard
 * Renders a floating help icon that opens a blurred modal with professional instructions.
 */
export default function UsageGuide({ content, mode = 'fixed' }) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const modalRef = useRef(null);

    // Mover foco al modal al abrirse; restituir al trigger al cerrarse
    useEffect(() => {
        if (isOpen) {
            modalRef.current?.focus();
        }
    }, [isOpen]);

    // Cerrar con Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

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

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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

    const modalContent = isOpen ? (
        <div className="guide-overlay" onClick={() => { setIsOpen(false); triggerRef.current?.focus(); }}>
            <div
                className="guide-modal custom-scrollbar"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="guide-modal-title"
                tabIndex={-1}
                ref={modalRef}
            >

                {/* HEADER */}
                <div className="guide-header">
                    <div className="guide-title-box">
                        <div className="guide-icon">
                            <BookOpen size={24} color="#fbbf24" />
                        </div>
                        <h2 id="guide-modal-title">Manual de Uso</h2>
                    </div>
                    <button onClick={() => { setIsOpen(false); triggerRef.current?.focus(); }} className="guide-close-btn" aria-label="Cerrar manual de uso">
                        <X size={24} />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="guide-content custom-scrollbar">
                    {renderMarkdown(content)}
                </div>

                {/* FOOTER */}
                <div className="guide-footer">
                    <button onClick={() => { setIsOpen(false); triggerRef.current?.focus(); }} className="btn-close-guide">
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    if (!mounted) return (
        <button
            onClick={() => setIsOpen(true)}
            className={mode === 'inline' ? 'usage-guide-inline-trigger' : 'usage-guide-trigger'}
            title="Ver Manual de Uso"
            aria-label="Abrir manual de uso"
        >
            <HelpCircle size={mode === 'inline' ? 14 : 20} />
        </button>
    );

    // Import createPortal dynamically or use from 'react-dom' if available in env
    const { createPortal } = require('react-dom');

    return (
        <>
            {/* TRIGGER BUTTON */}
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(true)}
                className={mode === 'inline' ? 'usage-guide-inline-trigger' : 'usage-guide-trigger'}
                title="Ver Manual de Uso"
                aria-label="Abrir manual de uso"
                aria-expanded={isOpen}
            >
                <HelpCircle size={mode === 'inline' ? 14 : 20} />
            </button>

            {/* FLOATING MODAL (PORTAL) */}
            {isOpen && createPortal(modalContent, document.body)}
        </>
    );
}
