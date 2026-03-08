"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import {
    MessageSquare, CheckCircle, XCircle, Phone,
    RefreshCw, AlertCircle, Zap, Search, Bell,
    FileText, Newspaper, ChevronRight, Copy, Check
} from 'lucide-react';
import './whatsapp.css';

const BOT_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER || null;

const COMANDOS = [
    { icon: Search, label: 'Buscar expediente', ejemplo: 'Busca el expediente García c/ López en PJN' },
    { icon: Bell, label: 'Crear alerta', ejemplo: 'Avisame si hay movimientos en el expediente 12345/2023' },
    { icon: Newspaper, label: 'Boletín Oficial', ejemplo: '¿Qué leyes salieron hoy en el Boletín?' },
    { icon: FileText, label: 'Texto de norma', ejemplo: 'Traeme el texto completo del Decreto 135/2026' },
    { icon: Zap, label: 'Resumen', ejemplo: 'Resumime la Ley 27802' },
];

export default function WhatsappContent() {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [phone, setPhone] = useState('');
    const [currentPhone, setCurrentPhone] = useState(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data }) => {
            if (!data.session) return;
            setSession(data.session);
            const { data: p } = await supabase
                .from('profiles')
                .select('full_name, whatsapp_phone')
                .eq('id', data.session.user.id)
                .single();
            if (p) {
                setProfile(p);
                setCurrentPhone(p.whatsapp_phone || null);
                setPhone(p.whatsapp_phone || '');
            }
        });
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!phone.trim()) return;
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const res = await fetch('/api/whatsapp/link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ phone: phone.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al vincular');
            setCurrentPhone(data.phone);
            setSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUnlink = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/whatsapp/link', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (!res.ok) throw new Error('Error al desvincular');
            setCurrentPhone(null);
            setPhone('');
            setSuccess(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
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
                    <p>Consultá expedientes, alertas y el Boletín Oficial desde WhatsApp</p>
                </div>
            </header>

            <div className="wa-grid">
                {/* Estado + Vinculación */}
                <section className="wa-card glass-panel">
                    <div className="wa-card-header">
                        <Phone size={18} />
                        <h2>Tu número de WhatsApp</h2>
                    </div>

                    <div className={`wa-status ${isLinked ? 'linked' : 'unlinked'}`}>
                        {isLinked ? (
                            <>
                                <CheckCircle size={20} />
                                <div>
                                    <strong>Vinculado</strong>
                                    <span>{currentPhone}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <XCircle size={20} />
                                <div>
                                    <strong>Sin vincular</strong>
                                    <span>El bot no te reconocerá hasta que vincules tu número</span>
                                </div>
                            </>
                        )}
                    </div>

                    <form onSubmit={handleSave} className="wa-form">
                        <label htmlFor="wa-phone">Número (con código de país)</label>
                        <div className="wa-input-row">
                            <input
                                id="wa-phone"
                                type="tel"
                                placeholder="+54 9 11 1234 5678"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                disabled={saving}
                                aria-describedby="wa-phone-hint"
                            />
                            <button type="submit" className="btn-primary" disabled={saving || !phone.trim()}>
                                {saving ? <RefreshCw size={15} className="spin" /> : 'Guardar'}
                            </button>
                        </div>
                        <p id="wa-phone-hint" className="wa-hint">
                            Formato argentino: +54 9 11 seguido de 8 dígitos
                        </p>
                    </form>

                    {success && (
                        <div className="wa-alert success">
                            <CheckCircle size={16} />
                            <span>Número vinculado correctamente. Ya podés escribirle al bot.</span>
                        </div>
                    )}
                    {error && (
                        <div className="wa-alert error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {isLinked && (
                        <button className="btn-unlink" onClick={handleUnlink} disabled={saving}>
                            Desvincular número
                        </button>
                    )}
                </section>

                {/* Cómo usarlo */}
                <section className="wa-card glass-panel">
                    <div className="wa-card-header">
                        <Zap size={18} />
                        <h2>Qué podés pedirle al bot</h2>
                    </div>
                    <p className="wa-intro">Escribile en lenguaje natural, como si le mandaras un mensaje a un colega:</p>
                    <ul className="wa-commands">
                        {COMANDOS.map(({ icon: Icon, label, ejemplo }) => (
                            <li key={label} className="wa-command">
                                <div className="wa-command-icon">
                                    <Icon size={15} />
                                </div>
                                <div className="wa-command-body">
                                    <span className="wa-command-label">{label}</span>
                                    <button
                                        className="wa-command-example"
                                        onClick={() => copyExample(ejemplo)}
                                        title="Copiar ejemplo"
                                    >
                                        <span>"{ejemplo}"</span>
                                        {copied === ejemplo
                                            ? <Check size={12} />
                                            : <Copy size={12} />
                                        }
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Cómo conectarse */}
                {BOT_NUMBER && (
                    <section className="wa-card wa-card-full glass-panel">
                        <div className="wa-card-header">
                            <MessageSquare size={18} />
                            <h2>Conectar con el bot</h2>
                        </div>
                        <p>Una vez que vinculaste tu número, escribile al bot:</p>
                        <a
                            href={`https://wa.me/${BOT_NUMBER.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-wa"
                        >
                            <MessageSquare size={18} />
                            Abrir chat con el bot
                            <ChevronRight size={16} />
                        </a>
                    </section>
                )}

                {!BOT_NUMBER && (
                    <section className="wa-card wa-card-full glass-panel wa-coming-soon">
                        <div className="wa-card-header">
                            <MessageSquare size={18} />
                            <h2>Número del bot</h2>
                        </div>
                        <p>El número del bot estará disponible próximamente. Vinculá tu número ahora para estar listo cuando se active.</p>
                    </section>
                )}
            </div>
        </div>
    );
}
