"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Configuración del worker (Hosted locally to avoid unpkg issues)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default function PdfReader({ url }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.2);

    // Touch gesture state
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const gestureRef = useRef({
        startDist: 0,
        startScale: 1,
        startX: 0, startY: 0,
        startOffsetX: 0, startOffsetY: 0,
        isPinching: false,
    });
    const wrapperRef = useRef(null);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
        setPageNumber(1);
    }

    // Reset offset when scale changes via buttons
    const handleZoomIn = () => {
        setScale(s => Math.min(2.5, s + 0.1));
    };
    const handleZoomOut = () => {
        const newScale = Math.max(0.5, scale - 0.1);
        setScale(newScale);
        if (newScale <= 1.2) setOffset({ x: 0, y: 0 });
    };

    // Double-tap to reset zoom
    const lastTapRef = useRef(0);
    const handleDoubleTap = useCallback(() => {
        setScale(1.2);
        setOffset({ x: 0, y: 0 });
    }, []);

    // ═══════════════════════════════════════
    // TOUCH HANDLERS (pinch-to-zoom + pan)
    // ═══════════════════════════════════════

    const getTouchDist = (touches) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = useCallback((e) => {
        const g = gestureRef.current;

        if (e.touches.length === 2) {
            // Pinch start
            e.preventDefault();
            g.isPinching = true;
            g.startDist = getTouchDist(e.touches);
            g.startScale = scale;
        } else if (e.touches.length === 1) {
            // Check for double-tap
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
                handleDoubleTap();
                lastTapRef.current = 0;
                return;
            }
            lastTapRef.current = now;

            // Pan start (only when zoomed in)
            if (scale > 1.2) {
                g.startX = e.touches[0].clientX;
                g.startY = e.touches[0].clientY;
                g.startOffsetX = offset.x;
                g.startOffsetY = offset.y;
                setIsDragging(true);
            }
        }
    }, [scale, offset, handleDoubleTap]);

    const handleTouchMove = useCallback((e) => {
        const g = gestureRef.current;

        if (g.isPinching && e.touches.length === 2) {
            e.preventDefault();
            const dist = getTouchDist(e.touches);
            const ratio = dist / g.startDist;
            const newScale = Math.min(2.5, Math.max(0.5, g.startScale * ratio));
            setScale(newScale);
            if (newScale <= 1.2) setOffset({ x: 0, y: 0 });
        } else if (isDragging && e.touches.length === 1) {
            const dx = e.touches[0].clientX - g.startX;
            const dy = e.touches[0].clientY - g.startY;
            setOffset({
                x: g.startOffsetX + dx,
                y: g.startOffsetY + dy,
            });
        }
    }, [isDragging]);

    const handleTouchEnd = useCallback(() => {
        gestureRef.current.isPinching = false;
        setIsDragging(false);
    }, []);

    // Prevent default pinch on the wrapper to avoid browser zoom
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const prevent = (e) => {
            if (e.touches?.length >= 2) e.preventDefault();
        };
        el.addEventListener('touchmove', prevent, { passive: false });
        return () => el.removeEventListener('touchmove', prevent);
    }, []);

    const isZoomed = scale > 1.2;

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
                    <span className="zoom-info">{Math.round(scale * 100)}%</span>
                    <button onClick={handleZoomIn} className="control-btn">+</button>
                </div>
            </div>

            {/* PDF Document with touch gestures */}
            <div
                ref={wrapperRef}
                className="pdf-document-wrapper"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: isZoomed ? 'none' : 'pan-y' }}
            >
                <div
                    className="pdf-transform-layer"
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px)`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease',
                    }}
                >
                    <Document
                        file={url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="loading">Cargando documento...</div>}
                        error={<div className="error">No se pudo cargar el PDF. <a href={url} target="_blank">Abrir link directo</a></div>}
                        className="pdf-document"
                    >
                        <Page
                            pageNumber={pageNumber}
                            scale={scale}
                            renderAnnotationLayer={false}
                            renderTextLayer={false}
                            className="pdf-page shadow-lg"
                        />
                    </Document>
                </div>

                {/* Zoom hint on mobile */}
                {!isZoomed && numPages && (
                    <div className="zoom-hint">
                        Pellizcá para zoom · Doble tap para resetear
                    </div>
                )}
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
                padding: 8px;
            }
            .pagination, .zoom-controls {
                font-size: 0.8rem;
                gap: 8px;
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
            position: relative;
            -webkit-overflow-scrolling: touch;
        }

        @media (max-width: 600px) {
            .pdf-document-wrapper {
                padding: 8px;
            }
        }

        .pdf-transform-layer {
            display: flex;
            justify-content: center;
            will-change: transform;
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

        .zoom-hint {
            position: absolute;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(8px);
            color: rgba(148, 163, 184, 0.7);
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            padding: 6px 16px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.05);
            pointer-events: none;
            animation: fadeInHint 0.5s ease, fadeOutHint 0.5s ease 4s forwards;
        }

        @keyframes fadeInHint {
            from { opacity: 0; transform: translateX(-50%) translateY(10px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeOutHint {
            from { opacity: 1; }
            to { opacity: 0; }
        }

        @media (min-width: 601px) {
            .zoom-hint { display: none; }
        }
      `}</style>
        </div>
    );
}
