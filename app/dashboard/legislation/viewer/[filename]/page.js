"use client";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Download, Maximize2, FileText, Scale } from 'lucide-react';
import dynamic from 'next/dynamic';

const PdfReader = dynamic(() => import('@/app/components/PdfReader'), {
    ssr: false,
    loading: () => <div className="p-8 text-slate-400">Iniciando visor de PDF...</div>
});

export default function LegislationViewerPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const filename = params.filename;
    // Default to 'entre-rios' for backward compatibility, but allow override
    const province = searchParams.get('province') || 'entre-rios';

    // We can infer the title from the filename or pass it via query, 
    // but for now let's make it look clean.
    const displayTitle = filename
        ?.replace(/-/g, ' ')
        .replace(/\.pdf$/i, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    const pdfPath = `/legislation/${province}/${filename}`;

    return (
        <div className="viewer-container">
            <header className="viewer-header glass-panel">
                <div className="header-left">
                    <Link href="/dashboard/legislation" className="back-btn">
                        <ChevronLeft size={20} />
                    </Link>
                    <div className="title-wrapper">
                        <Scale size={18} className="text-amber-400" />
                        <h1>{displayTitle || "Visor de Leyes"}</h1>
                    </div>
                </div>
                <div className="header-right">
                    <a href={pdfPath} download className="action-btn" title="Descargar PDF">
                        <Download size={18} />
                    </a>
                </div>
            </header>

            <main className="viewer-content">
                <div className="pdf-wrapper glass-panel">
                    <PdfReader url={pdfPath} />
                </div>
            </main>

            <style jsx>{`
                .viewer-container {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background: #020617;
                    color: white;
                    padding: 1rem;
                    gap: 1rem;
                }

                .viewer-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1.5rem;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.05);
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .back-btn {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: 0.2s;
                }

                .back-btn:hover {
                    background: rgba(255,255,255,0.1);
                    border-color: #fbbf24;
                }

                .title-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .title-wrapper h1 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin: 0;
                    background: linear-gradient(to right, #fff, #94a3b8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 60vw;
                }
                
                @media (max-width: 600px) {
                    .viewer-header {
                        padding: 0.5rem 1rem;
                    }
                    .title-wrapper h1 {
                        font-size: 0.95rem;
                        max-width: 50vw;
                    }
                }

                .action-btn {
                    background: #fbbf24;
                    color: #020617;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: 0.2s;
                    text-decoration: none;
                }

                .action-btn:hover {
                    background: #f59e0b;
                    transform: scale(1.05);
                }

                .viewer-content {
                    flex: 1;
                    position: relative;
                    display: flex;
                }

                .pdf-wrapper {
                    flex: 1;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.05);
                    background: rgba(15, 23, 42, 0.5);
                    position: relative;
                }

                .pdf-frame {
                    width: 100%;
                    height: 100%;
                    border: none;
                }

                /* GLASS PANEL REUSE (copied here for standalone style scope) */
                .glass-panel {
                    background: rgba(30, 41, 59, 0.4);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }

                .pdf-error {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    width: 100%;
                    color: #94a3b8;
                    text-align: center;
                    padding: 2rem;
                }

                .retry-link {
                    margin-top: 1rem;
                    background: #fbbf24;
                    color: #020617;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: 0.2s;
                }

                .retry-link:hover {
                    background: #f59e0b;
                    transform: translateY(-2px);
                }
            `}</style>
        </div>
    );
}
