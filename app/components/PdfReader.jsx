"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Configuración del worker (Hosted locally to avoid unpkg issues)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default function PdfReader({ url, originalUrl }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [containerWidth, setContainerWidth] = useState(null);
    const wrapperRef = useRef(null);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
        setPageNumber(1);
    }

    // Measure container width for responsive PDF sizing on mobile
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;

        const measure = () => {
            const w = el.clientWidth;
            if (w > 0) setContainerWidth(w);
        };
        measure();

        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // On mobile (<600px), use width-based sizing. On desktop, use scale.
    const isMobile = containerWidth && containerWidth < 560;
    const pageProps = isMobile
        ? { width: Math.floor(containerWidth - 16) } // Fit width, minus padding
        : { scale };

    const handleZoomIn = () => setScale(s => Math.min(2.5, +(s + 0.1).toFixed(1)));
    const handleZoomOut = () => setScale(s => Math.max(0.5, +(s - 0.1).toFixed(1)));

    return (
        <div className="pdf-reader-container">
            {/* Controls Bar */}
            <div className="pdf-controls">
                <div className="pagination">
                    <button
                        onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                        disabled={pageNumber <= 1}
                        className="control-btn"
                    >
                        ◀
                    </button>
                    <span className="page-info">
                        Página {pageNumber} de {numPages || "--"}
                    </span>
                    <button
                        onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || prev))}
                        disabled={pageNumber >= numPages}
                        className="control-btn"
                    >
                        ▶
                    </button>
                </div>

                <div className="zoom-controls">
                    <button onClick={handleZoomOut} className="control-btn">-</button>
                    <span className="zoom-info">{isMobile ? 'Auto' : `${Math.round(scale * 100)}%`}</span>
                    <button onClick={handleZoomIn} className="control-btn">+</button>
                </div>
            </div>

            {/* PDF Document — native scroll/touch, no custom gestures */}
            <div ref={wrapperRef} className="pdf-document-wrapper">
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div className="loading">Cargando documento...</div>}
                    error={
                        <div className="error">
                            <p>No se pudo cargar el PDF.</p>
                            {originalUrl && (
                                <a href={originalUrl} target="_blank" rel="noopener noreferrer">
                                    Abrir en sitio oficial →
                                </a>
                            )}
                            {!originalUrl && (
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                    Abrir link directo
                                </a>
                            )}
                        </div>
                    }
                    className="pdf-document"
                >
                    <Page
                        pageNumber={pageNumber}
                        {...pageProps}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                        className="pdf-page shadow-lg"
                    />
                </Document>
            </div>

            <style jsx>{`
        .pdf-reader-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            position: relative;
        }

        .pdf-controls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 16px;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(8px);
            border-bottom: 1px solid rgba(255,255,255,0.05);
            z-index: 10;
            flex-wrap: wrap;
            gap: 10px;
        }

        @media (max-width: 600px) {
            .pdf-controls {
                justify-content: center;
                padding: 6px 8px;
            }
            .pagination, .zoom-controls {
                font-size: 0.75rem;
                gap: 6px;
            }
        }

        .pagination, .zoom-controls {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #e2e8f0;
            font-size: 0.9rem;
        }

        .control-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.1);
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
        }

        .control-btn:hover:not(:disabled) {
            background: #fbbf24;
            color: #0f172a;
        }

        .control-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .pdf-document-wrapper {
            flex: 1;
            overflow: auto;
            display: flex;
            justify-content: center;
            padding: 24px;
            background: rgba(2, 6, 23, 0.5);
            -webkit-overflow-scrolling: touch;
        }

        @media (max-width: 600px) {
            .pdf-document-wrapper {
                padding: 8px;
                justify-content: flex-start;
            }
        }

        .loading, .error {
            color: #94a3b8;
            margin-top: 40px;
        }

        .error a {
            color: #fbbf24;
            text-decoration: underline;
            margin-left: 8px;
        }
      `}</style>
        </div>
    );
}
