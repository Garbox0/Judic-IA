"use client";
import React, { useState, useEffect, use } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './generate.css';

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


        </div>
    );
}
