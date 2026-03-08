"use client";
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import {
    MessageSquare, CheckCircle, XCircle, Phone, RefreshCw,
    AlertCircle, Zap, Search, Bell, FileText, Newspaper,
    ChevronRight, Copy, Check, X, Plus, Tag, Calculator,
    Calendar, BookOpen, Sunrise
} from 'lucide-react';
import './whatsapp.css';

const BOT_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER || null;

const COMANDOS = [
    { icon: Sunrise,    label: 'Resumen del día',       ejemplo: 'Buenos días, dame un resumen de hoy' },
    { icon: Search,     label: 'Buscar expediente PJN', ejemplo: 'Actuaciones del expediente 12345/2023' },
    { icon: Bell,       label: 'Crear alerta',           ejemplo: 'Monitorea el expediente 12345/2023 en PJN' },
    { icon: Newspaper,  label: 'Boletín Oficial',        ejemplo: '¿Qué decretos salieron hoy en el Boletín?' },
    { icon: BookOpen,   label: 'Texto de norma',         ejemplo: 'Traeme el texto del artículo 245 de la LCT' },
    { icon: Calculator, label: 'Calcular intereses',     ejemplo: 'Calculame intereses sobre $500000 desde 01/01/2024' },
    { icon: Calculator, label: 'Liquidación laboral',    ejemplo: 'Liquidación por despido, sueldo $800000, 3 años' },
    { icon: Calendar,   label: 'Calcular plazo',         ejemplo: '15 días hábiles desde el 10 de marzo' },
    { icon: FileText,   label: 'Mis expedientes',        ejemplo: 'Mostrame mis expedientes activos' },
    { icon: Zap,        label: 'Mis vencimientos',       ejemplo: '¿Qué vence esta semana?' },
];

export default function WhatsappContent() {
    const [session, setSession] = useState(null);
    const [phone, setPhone] = useState('');
    const [currentPhone, setCurrentPhone] = useState(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    // BO Keywords
    const [keywords, setKeywords] = useState([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [kwLoading, setKwLoading] = useState(false);
    const [kwError, setKwError] = useState(null);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data }) => {
            if (!data.session) return;
            setSession(data.session);
            const { data: p } = await supabase
                .from('profiles')
                .select('whatsapp_phone')
                .eq('id', data.session.user.id)
                .single();
            if (p) {
                setCurrentPhone(p.whatsapp_phone || null);
                setPhone(p.whatsapp_phone || '');
            }
            fetchKeywords(data.session);
        });
    }, []);

    const fetchKeywords = useCallback(async (sess) => {
        const s = sess || session;
        if (!s) return;
        const res = await fetch('/api/whatsapp/bo-keywords', {
            headers: { Authorization: `Bearer ${s.access_token}` },
        });
        const data = await res.json();
        setKeywords(data.keywords || []);
    }, [session]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!phone.trim()) return;
        setSaving(true); setError(null); setSuccess(false);
        try {
            const res = await fetch('/api/whatsapp/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ phone: phone.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al vincular');
            setCurrentPhone(data.phone);
            setSuccess(true);
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const handleUnlink = async () => {
        setSaving(true); setError(null);
        try {
            await fetch('/api/whatsapp/link', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            setCurrentPhone(null); setPhone(''); setSuccess(false);
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const addKeyword = async (e) => {
        e.preventDefault();
        if (!newKeyword.trim()) return;
        setKwLoading(true); setKwError(null);
        try {
            const res = await fetch('/api/whatsapp/bo-keywords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ keyword: newKeyword.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setKeywords(prev => [data.keyword, ...prev]);
            setNewKeyword('');
        } catch (err) { setKwError(err.message); }
        finally { setKwLoading(false); }
    };

    const removeKeyword = async (id) => {
        setKeywords(prev => prev.filter(k => k.id !== id));
        await fetch('/api/whatsapp/bo-keywords', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ id }),
        });
    };

    const copyExample = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(text);
        setTimeout(() => setCopied(false), 2000);
    };

    const isLinked = !!currentPhone;

    return (
        <div className="wa-container">
            <nav className="wa-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Agente WhatsApp</span>
                </div>
            </nav>

            <header className="wa-header">
                <div className="wa-header-icon">
                    <MessageSquare size={36} />
                </div>
                <div>
                    <h1>Agente WhatsApp <span className="wa-beta-badge">BETA</span></h1>
                    <p>Tu asistente legal inteligente disponible 24/7 en WhatsApp</p>
                </div>
            </header>

            <div className="wa-grid">

                {/* Vinculación */}
                <section className="wa-card glass-panel">
                    <div className="wa-card-header">
                        <Phone size={18} />
                        <h2>Tu número de WhatsApp</h2>
                    </div>
                    <div className={`wa-status ${isLinked ? 'linked' : 'unlinked'}`}>
                        {isLinked ? (
                            <><CheckCircle size={20} /><div><strong>Vinculado</strong><span>{currentPhone}</span></div></>
                        ) : (
                            <><XCircle size={20} /><div><strong>Sin vincular</strong><span>El agente no te reconocerá hasta vincular tu número</span></div></>
                        )}
                    </div>
                    <form onSubmit={handleSave} className="wa-form">
                        <label htmlFor="wa-phone">Número (con código de país)</label>
                        <div className="wa-input-row">
                            <input
                                id="wa-phone" type="tel"
                                placeholder="+54 9 11 1234 5678"
                                value={phone} onChange={e => setPhone(e.target.value)}
                                disabled={saving}
                            />
                            <button type="submit" className="btn-primary" disabled={saving || !phone.trim()}>
                                {saving ? <RefreshCw size={15} className="spin" /> : 'Guardar'}
                            </button>
                        </div>
                        <p className="wa-hint">Formato: +54 9 11 seguido de 8 dígitos</p>
                    </form>
                    {success && (
                        <div className="wa-alert success">
                            <CheckCircle size={16} />
                            <span>Número vinculado. Ya podés escribirle al agente.</span>
                        </div>
                    )}
                    {error && (
                        <div className="wa-alert error"><AlertCircle size={16} /><span>{error}</span></div>
                    )}
                    {isLinked && (
                        <button className="btn-unlink" onClick={handleUnlink} disabled={saving}>
                            Desvincular número
                        </button>
                    )}
                </section>

                {/* Keywords BO en vivo */}
                <section className="wa-card glass-panel">
                    <div className="wa-card-header">
                        <Newspaper size={18} />
                        <h2>Boletín Oficial en vivo</h2>
                    </div>
                    <p className="wa-intro">
                        Cada mañana el agente te manda por WhatsApp las publicaciones del BO que coincidan con tus palabras clave.
                    </p>
                    <form onSubmit={addKeyword} className="wa-form" style={{ marginBottom: '0.75rem' }}>
                        <div className="wa-input-row">
                            <input
                                type="text"
                                placeholder="ej: laboral, licitación, AFIP..."
                                value={newKeyword}
                                onChange={e => setNewKeyword(e.target.value)}
                                disabled={kwLoading}
                                maxLength={40}
                            />
                            <button type="submit" className="btn-primary" disabled={kwLoading || !newKeyword.trim()}>
                                {kwLoading ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />}
                            </button>
                        </div>
                        {kwError && <p className="wa-hint" style={{ color: '#fca5a5' }}>{kwError}</p>}
                    </form>

                    {keywords.length > 0 ? (
                        <div className="wa-keywords">
                            {keywords.map(k => (
                                <span key={k.id} className="wa-keyword-tag">
                                    <Tag size={11} />
                                    {k.keyword}
                                    <button onClick={() => removeKeyword(k.id)} aria-label={`Eliminar ${k.keyword}`}>
                                        <X size={11} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="wa-hint">Sin keywords. Agregá términos para recibir alertas del BO.</p>
                    )}
                </section>

                {/* Comandos disponibles */}
                <section className="wa-card wa-card-full glass-panel">
                    <div className="wa-card-header">
                        <Zap size={18} />
                        <h2>Qué podés pedirle al agente</h2>
                    </div>
                    <p className="wa-intro">Escribile en lenguaje natural. Estos son algunos ejemplos — hacé clic para copiar:</p>
                    <ul className="wa-commands">
                        {COMANDOS.map(({ icon: Icon, label, ejemplo }) => (
                            <li key={label} className="wa-command">
                                <div className="wa-command-icon"><Icon size={14} /></div>
                                <div className="wa-command-body">
                                    <span className="wa-command-label">{label}</span>
                                    <button className="wa-command-example" onClick={() => copyExample(ejemplo)} title="Copiar">
                                        <span>"{ejemplo}"</span>
                                        {copied === ejemplo ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Conectar al bot */}
                {BOT_NUMBER ? (
                    <section className="wa-card wa-card-full glass-panel">
                        <div className="wa-card-header"><MessageSquare size={18} /><h2>Abrir chat con el agente</h2></div>
                        <a href={`https://wa.me/${BOT_NUMBER.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn-wa">
                            <MessageSquare size={18} />Abrir chat
                            <ChevronRight size={16} />
                        </a>
                    </section>
                ) : (
                    <section className="wa-card wa-card-full glass-panel wa-coming-soon">
                        <div className="wa-card-header"><MessageSquare size={18} /><h2>Número del agente</h2></div>
                        <p>El número estará disponible próximamente. Vinculá tu número ahora para estar listo cuando se active.</p>
                    </section>
                )}
            </div>
        </div>
    );
}
