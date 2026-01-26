"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Configuración del worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfReader({ url }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.2);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
        setPageNumber(1);
    }

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
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="control-btn">-</button>
                    <span className="zoom-info">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(2.5, s + 0.1))} className="control-btn">+</button>
                </div>
            </div>

            {/* PDF Document */}
            <div className="pdf-document-wrapper">
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
