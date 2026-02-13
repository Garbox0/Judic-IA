"use client";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Download, Maximize2, FileText, Scale, ShieldCheck } from 'lucide-react';
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
    // Support external URLs (e.g. from Knowledge Base)
    const externalUrl = searchParams.get('url');
    const externalTitle = searchParams.get('title');

    // We can infer the title from the filename or pass it via query, 
    // but for now let's make it look clean.
    const displayTitle = externalTitle || filename
        ?.replace(/-/g, ' ')
        .replace(/\.pdf$/i, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    // 🔒 VPS MIGRATION: Serve files from MinIO (Legislation Bucket)
    // Using Env Var to avoid exposing hardcoded IP, preparing for future HTTPS domain.
    const VPS_BASE_URL = process.env.NEXT_PUBLIC_LEGISLATION_URL || 'https://judic-ia.com/legislation';

    // Build content URL
    const isExternal = !!externalUrl;
    const decodedExternalUrl = externalUrl ? decodeURIComponent(externalUrl) : '';

    // If it's already a MinIO PDF, use it directly. Otherwise, go through kb-proxy.
    const contentUrl = isExternal
        ? (decodedExternalUrl.includes('archivos.judic-ia.com')
            ? decodedExternalUrl
            : `/api/kb-proxy?url=${encodeURIComponent(decodedExternalUrl)}&title=${encodeURIComponent(displayTitle || '')}`)
        : `${VPS_BASE_URL}/${province}/${filename}`;

    return (
        <div className="viewer-container">
            <header className="viewer-header glass-panel">
                <div className="header-left">
                    <Link href={isExternal ? "/dashboard/library" : "/dashboard/legislation"} className="back-btn">
                        <ChevronLeft size={20} />
                    </Link>
                    <div className="title-wrapper">
                        <Scale size={18} className="text-amber-400" />
                        <h1>{displayTitle || "Visor de Leyes"}</h1>
                    </div>
                </div>
                <div className="header-right">
                    {!isExternal && (
                        <div className="vt-badge" title="Scanned by ClamAV Antivirus">
                            <ShieldCheck size={14} className="text-red-500" />
                            <span>ClamAV <strong>Secure</strong></span>
                        </div>
                    )}
                    {isExternal && (
                        <a href={contentUrl} download className="action-btn download-btn" title="Descargar PDF">
                            <Download size={18} />
                        </a>
                    )}
                    <a href={contentUrl} target="_blank" rel="noopener noreferrer" className="action-btn" title={isExternal ? "Abrir en nueva pestaña" : "Descargar PDF"}>
                        {isExternal ? <Maximize2 size={18} /> : <Download size={18} />}
                    </a>
                </div>
            </header>

            <main className="viewer-content">
                <div className="pdf-wrapper glass-panel">
                    <PdfReader url={contentUrl} />
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

                .header-left, .header-right {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .header-right {
                    gap: 1rem;
                }

                .vt-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    padding: 0.4rem 0.8rem;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    color: #94a3b8;
                    cursor: help;
                    transition: 0.2s;
                }
                
                .vt-badge:hover {
                    background: rgba(239, 68, 68, 0.2);
                    color: white;
                }
                
                .vt-badge strong {
                    color: #22c55e;
                    margin-left: 3px;
                }

                :global(.light-theme) .vt-badge {
                    background: rgba(239, 68, 68, 0.05);
                    border-color: rgba(239, 68, 68, 0.2);
                    color: #475569;
                }
                :global(.light-theme) .vt-badge:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: #0f172a;
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
                    .vt-badge span:last-child {
                        display: none;
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

                .download-btn {
                    background: rgba(16, 185, 129, 0.9);
                    color: white;
                }

                .download-btn:hover {
                    background: rgba(16, 185, 129, 1);
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

                /* LIGHT THEME OVERRIDES */
                :global(.light-theme) .viewer-container {
                    background: #cbd5e1;
                    color: #0f172a;
                }

                :global(.light-theme) .viewer-header {
                    background: white;
                    border-color: rgba(15, 23, 42, 0.1);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }

                :global(.light-theme) .title-wrapper h1 {
                    background: linear-gradient(to right, #0f172a, #334155);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                :global(.light-theme) .back-btn {
                    background: white;
                    border: 1px solid rgba(15, 23, 42, 0.1);
                    color: #0f172a;
                }

                :global(.light-theme) .back-btn:hover {
                    background: #f1f5f9;
                    border-color: #f59e0b;
                }

                :global(.light-theme) .pdf-wrapper {
                    background: #94a3b8;
                    border-color: rgba(15, 23, 42, 0.1);
                }
            `}</style>
        </div >
    );
}
