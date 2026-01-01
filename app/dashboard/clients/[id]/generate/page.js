"use client";
import React, { useState, useEffect, use } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function GenerateDocPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [clientData, setClientData] = useState(null);
    const [messages, setMessages] = useState([]);

    // Document Types
    const DOC_TYPES = [
        { id: 'telegram_laboral', label: 'Telegrama Laboral (Ley 23.789)', icon: '📩' },
        { id: 'cd_intimacion', label: 'Carta Documento (Intimación)', icon: '📜' },
        { id: 'demanda_despido', label: 'Demanda por Despido', icon: '⚖️' },
        { id: 'acuerdo_espontaneo', label: 'Acuerdo Espontáneo (SECLO)', icon: '🤝' },
    ];
    const [selectedDoc, setSelectedDoc] = useState(DOC_TYPES[0].id);
    const [generatedContent, setGeneratedContent] = useState("");

    useEffect(() => {
        fetchCaseData();
    }, [id]);

    const fetchCaseData = async () => {
        // 1. Fetch Inquiry Details
        const { data: inquiry, error: inqError } = await supabase
            .from('inquiries')
            .select('*')
            .eq('id', id)
            .single();

        if (inqError) {
            alert("Error cargando el caso");
            router.push('/dashboard/clients');
            return;
        }

        // 2. Fetch Chat History (Context for AI)
        const { data: msgs, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .eq('inquiry_id', id)
            .order('created_at', { ascending: true });

        setClientData(inquiry);
        setMessages(msgs || []);
        setLoading(false);
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setGeneratedContent(""); // Clear previous

        try {
            const res = await fetch('/api/generate-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inquiryId: id,
                    docType: selectedDoc,
                    context: messages
                })
            });
            const data = await res.json();

            if (data.content) {
                setGeneratedContent(data.content);
            } else {
                alert("Error generando documento: " + (data.error || "Desconocido"));
            }
        } catch (e) {
            alert("Error de conexión al generar.");
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedContent);
        alert("¡Texto copiado al portapapeles!");
    };

    if (loading) return <div className="loading-screen">Cargando datos del caso...</div>;

    return (
        <div className="generate-container">
            {/* Header / Breadcrumb */}
            <nav className="top-nav">
                <Link href="/dashboard/clients" className="back-link">← Volver a Clientes</Link>
                <h1 className="page-title">Redacción Asistida con IA</h1>
            </nav>

            <div className="workspace-grid">
                {/* LEFT: Context & selection */}
                <div className="context-panel glass-panel">
                    <div className="panel-header">
                        <h2>1. Configuración</h2>
                        <span className="badge-case">Caso #{id.slice(0, 6)}</span>
                    </div>

                    <div className="form-group">
                        <label>Tipo de Documento</label>
                        <div className="doc-selector">
                            {DOC_TYPES.map(type => (
                                <div
                                    key={type.id}
                                    className={`doc-option ${selectedDoc === type.id ? 'active' : ''}`}
                                    onClick={() => setSelectedDoc(type.id)}
                                >
                                    <span className="doc-icon">{type.icon}</span>
                                    <span className="doc-label">{type.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="transcript-box">
                        <h3>Contexto del Chat ({messages.length} msgs)</h3>
                        <div className="messages-preview">
                            {messages.map((m, i) => (
                                <p key={i} className={`msg-line ${m.role}`}>
                                    <strong>{m.role === 'user' ? 'Cliente' : 'IA'}:</strong> {m.content}
                                </p>
                            ))}
                        </div>
                    </div>

                    <button
                        className="btn-generate glow-btn"
                        onClick={handleGenerate}
                        disabled={generating}
                    >
                        {generating ? '✨ Redactando...' : '⚡ Generar Borrador'}
                    </button>

                    {generating && <div className="loading-bar"></div>}
                </div>

                {/* RIGHT: Editor */}
                <div className="editor-panel glass-panel">
                    <div className="panel-header">
                        <h2>2. Editor de Borrador</h2>
                        <div className="actions">
                            <button className="btn-secondary" onClick={copyToClipboard} disabled={!generatedContent}>📋 Copiar</button>
                            <button className="btn-primary" onClick={() => window.print()} disabled={!generatedContent}>🖨️ Imprimir</button>
                        </div>
                    </div>

                    {generatedContent ? (
                        <textarea
                            className="editor-textarea"
                            value={generatedContent}
                            onChange={(e) => setGeneratedContent(e.target.value)}
                        />
                    ) : (
                        <div className="editor-placeholder">
                            <div className="icon-placeholder">📄</div>
                            <p>Selecciona un tipo de documento y haz clic en Generar para ver el borrador aquí.</p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .generate-container { padding: 2rem; max-width: 1400px; margin: 0 auto; color: white; height: 100vh; display: flex; flex-direction: column; }
                
                .top-nav { margin-bottom: 2rem; display: flex; align-items: center; gap: 2rem; }
                .back-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; transition: 0.2s; }
                .back-link:hover { color: #fbbf24; }
                .page-title { font-size: 1.8rem; font-weight: 700; color: white; }

                .workspace-grid { display: grid; grid-template-columns: 350px 1fr; gap: 2rem; flex: 1; min-height: 0; }
                
                .glass-panel { background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; backdrop-filter: blur(10px); }
                
                .panel-header { padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.3); }
                .panel-header h2 { font-size: 1.1rem; color: #fbbf24; margin: 0; font-weight: 600; }
                .badge-case { font-size: 0.8rem; background: rgba(255, 255, 255, 0.1); padding: 0.2rem 0.6rem; border-radius: 99px; }

                .context-panel { padding: 0; }
                .form-group { padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .form-group label { display: block; color: #94a3b8; margin-bottom: 1rem; font-size: 0.9rem; font-weight: 600; }
                
                .doc-selector { display: flex; flex-direction: column; gap: 0.8rem; }
                .doc-option { 
                    padding: 0.8rem; background: rgba(255,255,255,0.03); border: 1px solid transparent; 
                    border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 1rem; transition: 0.2s;
                }
                .doc-option:hover { background: rgba(255,255,255,0.06); }
                .doc-option.active { border-color: #fbbf24; background: rgba(251, 191, 36, 0.1); }
                .doc-icon { font-size: 1.2rem; }
                .doc-label { font-size: 0.95rem; font-weight: 500; }

                .transcript-box { flex: 1; padding: 1.5rem; overflow-y: auto; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .transcript-box h3 { font-size: 0.9rem; color: #94a3b8; margin-bottom: 1rem; }
                .messages-preview { font-size: 0.85rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 0.8rem; }
                .msg-line { padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 6px; }
                .msg-line.user { border-left: 2px solid #fbbf24; }

                .btn-generate { 
                    margin: 1.5rem; padding: 1rem; font-weight: 700; font-size: 1rem; 
                    background: #fbbf24; color: #0f172a; border: none; border-radius: 12px; 
                    cursor: pointer; transition: 0.2s; 
                }
                .btn-generate:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(251, 191, 36, 0.3); }
                .btn-generate:disabled { opacity: 0.7; cursor: wait; }

                .loading-bar { height: 4px; background: linear-gradient(90deg, transparent, #fbbf24, transparent); animation: load 1.5s infinite; }
                @keyframes load { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

                .editor-panel { flex: 1; }
                .actions { display: flex; gap: 0.5rem; }
                .btn-secondary { background: rgba(255,255,255,0.1); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-size: 0.9rem; }
                .btn-primary { background: #fbbf24; color: #0f172a; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem; }
                .btn-secondary:disabled, .btn-primary:disabled { opacity: 0.5; cursor: default; }

                .editor-textarea { 
                    flex: 1; width: 100%; resize: none; border: none; background: transparent; 
                    padding: 2rem; color: #e2e8f0; font-family: 'Courier New', monospace; font-size: 1.1rem; line-height: 1.6; outline: none; 
                }
                .editor-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748b; }
                .icon-placeholder { font-size: 4rem; margin-bottom: 1rem; opacity: 0.3; }

                .loading-screen { display: flex; align-items: center; justify-content: center; height: 100vh; color: white; font-family: sans-serif; }
            `}</style>
        </div>
    );
}
