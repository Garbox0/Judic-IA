"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Globe,
    ArrowRight,
    MapPin,
    ShieldCheck,
    Clock,
    UserPlus,
    BookOpen,
    MessageCircle,
    ChevronDown,
    ExternalLink,
    Scale,
    Building2,
    GraduationCap,
    FileText,
    ChevronRight,
    Users,
    Landmark,
    CheckCircle2
} from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import { toast } from 'sonner';
import './federal.css';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';
import { provincialDirectory, survivalGuides } from '@/app/lib/federalDirectory';

export default function FederalContent() {
    const [searchResults, setSearchResults] = useState([]);
    const [selectedProv, setSelectedProv] = useState("");
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [networkStats, setNetworkStats] = useState({ total: 0, provinces: 0 });

    // Directory state
    const [dirProv, setDirProv] = useState("");
    const [dirData, setDirData] = useState(null);

    // Guides state
    const [expandedGuide, setExpandedGuide] = useState(null);

    useEffect(() => {
        let channel;
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (!error) {
                    setProfile(data);
                    channel = supabase
                        .channel('federal_auth_sync')
                        .on(
                            'postgres_changes',
                            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                            (payload) => {
                                if (payload.new.verification_status === 'verified') {
                                    setProfile(payload.new);
                                }
                            }
                        )
                        .subscribe();
                }
            }
            setLoading(false);
        };
        fetchProfile();
        fetchNetworkStats();
        return () => { if (channel) supabase.removeChannel(channel); };
    }, []);

    const fetchNetworkStats = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('jurisdiccion')
                .eq('is_correspondent', true)
                .eq('verification_status', 'verified')
                .eq('role', 'lawyer');
            if (!error && data) {
                const uniqueProvs = new Set(data.map(d => d.jurisdiccion).filter(Boolean));
                setNetworkStats({ total: data.length, provinces: uniqueProvs.size });
            }
        } catch (e) { /* silent */ }
    };

    const handleSearch = async (prov) => {
        setSelectedProv(prov);
        if (!prov) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, especialidades, jurisdiccion, coverage_zones, avatar_url, biography')
                .eq('is_correspondent', true)
                .eq('verification_status', 'verified')
                .eq('role', 'lawyer')
                .contains('coverage_zones', [prov])
                .neq('id', user?.id)
                .limit(20);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (err) {
            console.error("Search error:", err);
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    const handleStartChat = async (lawyer) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: existingParticipations } = await supabase
                .from('chat_participants')
                .select('conversation_id')
                .eq('user_id', user.id);

            if (existingParticipations && existingParticipations.length > 0) {
                const myConvoIds = existingParticipations.map(p => p.conversation_id);
                const { data: sharedConvo } = await supabase
                    .from('chat_participants')
                    .select('conversation_id')
                    .eq('user_id', lawyer.id)
                    .in('conversation_id', myConvoIds)
                    .limit(1)
                    .single();

                if (sharedConvo) {
                    window.dispatchEvent(new CustomEvent('judicia-open-chat', {
                        detail: { conversationId: sharedConvo.conversation_id, partnerName: lawyer.full_name }
                    }));
                    toast.success(`Chat con ${lawyer.full_name} abierto`);
                    return;
                }
            }

            const { data: newConvo, error } = await supabase
                .from('chat_conversations')
                .insert([{ title: lawyer.full_name }])
                .select()
                .single();

            if (error) throw error;

            await supabase.from('chat_participants').insert([
                { conversation_id: newConvo.id, user_id: user.id },
                { conversation_id: newConvo.id, user_id: lawyer.id }
            ]);

            window.dispatchEvent(new CustomEvent('judicia-open-chat', {
                detail: { conversationId: newConvo.id, partnerName: lawyer.full_name }
            }));
            toast.success(`Conversacion iniciada con ${lawyer.full_name}`);
        } catch (err) {
            console.error("Error starting chat:", err);
            toast.error("Error iniciando chat: " + err.message);
        }
    };

    const handleDirSearch = (prov) => {
        setDirProv(prov);
        if (!prov) {
            setDirData(null);
            return;
        }
        const found = provincialDirectory.find(d => d.province === prov);
        setDirData(found || null);
    };

    const guideIcons = {
        FileText: <FileText size={18} />,
        Globe: <Globe size={18} />,
        Users: <Users size={18} />,
        Shield: <ShieldCheck size={18} />,
    };

    if (loading) return <div className="p-8 text-center opacity-50">Cargando Hub Federal...</div>;

    // Access Control
    if (profile?.verification_status !== 'verified' && profile?.email !== 'demo@judicia.com') {
        return (
            <div className="fed-container">
                <div className="fed-restricted-container">
                    <div className="fed-restricted-icon-box">
                        <ShieldCheck size={40} />
                    </div>
                    <h1 className="dashboard-page-title">Verificacion Necesaria</h1>
                    <p className="opacity-70 text-lg mb-8">
                        Para acceder al Hub Federal y a la Comunidad de Abogados, tu matricula profesional debe ser verificada por nuestro equipo tecnico.
                    </p>
                    <div className="fed-restricted-status-box">
                        <h4 className="m-0 mb-3 flex items-center gap-2">
                            <Clock size={16} className="text-amber-400" />
                            Estado actual: {profile?.verification_status === 'pending' ? 'Pendiente de Revision' : 'Accion Requerida'}
                        </h4>
                        <p className="text-sm opacity-60 m-0">
                            Estamos validando tus credenciales con los colegios publicos correspondientes. Te notificaremos via email cuando tu acceso sea habilitado.
                        </p>
                    </div>
                    <div className="fed-restricted-btn-wrapper">
                        <a href="/dashboard/settings?tab=profile" className="fed-action-btn-gold">
                            Ver Estado de Mi Perfil
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fed-container">
            <div className="breadcrumb">
                <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                <span className="breadcrumb-separator">/</span>
                <span className="breadcrumb-current">Hub Federal</span>
            </div>

            <header className="fed-header">
                <div className="fed-badge">Modulo Interjurisdiccional</div>
                <h1>Hub Federal <Globe size={28} className="text-amber-400" /></h1>
                <p>Nexo interjurisdiccional para la Red de Colegas y Recursos Nacionales.</p>
                <UsageGuide content={dashboardManuals.federal} />

                {/* Network stats */}
                <div className="fed-stats-row">
                    <div className="fed-stat">
                        <Users size={16} />
                        <span><strong>{networkStats.total}</strong> corresponsales activos</span>
                    </div>
                    <div className="fed-stat">
                        <MapPin size={16} />
                        <span><strong>{networkStats.provinces}</strong> provincias cubiertas</span>
                    </div>
                    <div className="fed-stat">
                        <Landmark size={16} />
                        <span><strong>25</strong> jurisdicciones en directorio</span>
                    </div>
                </div>
            </header>

            <div className="fed-grid">
                {/* 1. RED DE CORRESPONSALES */}
                <div className="fed-card">
                    <div className="fed-icon-box" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                        <UserPlus size={24} />
                    </div>
                    <h3>Red de Corresponsales</h3>
                    <p>Colabora con colegas verificados de todo el pais para delegar tareas judiciales locales en un entorno seguro.</p>

                    <div className="fed-select-group">
                        <label htmlFor="jurisdiccion-select">Jurisdiccion de Busqueda</label>
                        <div className="fed-select-wrapper">
                            <select
                                id="jurisdiccion-select"
                                className="fed-select"
                                value={selectedProv}
                                onChange={(e) => handleSearch(e.target.value)}
                            >
                                <option value="">Selecciona una Provincia...</option>
                                <option value="CABA">CABA</option>
                                <option value="Buenos Aires">Buenos Aires</option>
                                <option value="Catamarca">Catamarca</option>
                                <option value="Chaco">Chaco</option>
                                <option value="Chubut">Chubut</option>
                                <option value="Córdoba">Córdoba</option>
                                <option value="Corrientes">Corrientes</option>
                                <option value="Entre Ríos">Entre Ríos</option>
                                <option value="Formosa">Formosa</option>
                                <option value="Jujuy">Jujuy</option>
                                <option value="La Pampa">La Pampa</option>
                                <option value="La Rioja">La Rioja</option>
                                <option value="Mendoza">Mendoza</option>
                                <option value="Misiones">Misiones</option>
                                <option value="Neuquén">Neuquén</option>
                                <option value="Río Negro">Río Negro</option>
                                <option value="Salta">Salta</option>
                                <option value="San Juan">San Juan</option>
                                <option value="San Luis">San Luis</option>
                                <option value="Santa Cruz">Santa Cruz</option>
                                <option value="Santa Fe">Santa Fe</option>
                                <option value="Santiago del Estero">Santiago del Estero</option>
                                <option value="Tierra del Fuego">Tierra del Fuego</option>
                                <option value="Tucumán">Tucumán</option>
                            </select>
                            <div className="fed-chevron">
                                <ChevronDown size={20} />
                            </div>
                        </div>
                    </div>

                    <div className="fed-lawyer-list">
                        {searching && (
                            <div className="p-6 text-center opacity-40 text-sm">Buscando...</div>
                        )}
                        {!searching && !selectedProv && (
                            <div className="fed-lawyer-placeholder">
                                <MapPin size={24} className="opacity-50" />
                                <span>Selecciona una provincia para ver colegas disponibles.</span>
                            </div>
                        )}
                        {!searching && selectedProv && searchResults.length === 0 && (
                            <div className="fed-lawyer-placeholder">
                                <UserPlus size={24} className="opacity-50" />
                                <span>No se encontraron colegas en esta jurisdiccion.</span>
                            </div>
                        )}
                        {searchResults.map(lawyer => (
                            <div key={lawyer.id} className="fed-lawyer-card">
                                <div className="fed-lawyer-info">
                                    <div className="fed-lawyer-avatar">
                                        {lawyer.avatar_url ? (
                                            <img src={lawyer.avatar_url} alt={lawyer.full_name} />
                                        ) : (
                                            (lawyer.full_name || 'U').charAt(0)
                                        )}
                                    </div>
                                    <div className="fed-lawyer-details">
                                        <h4>{lawyer.full_name || 'Colega'}</h4>
                                        <span className="fed-lawyer-specialty">
                                            {lawyer.especialidades && lawyer.especialidades.length > 0
                                                ? lawyer.especialidades.slice(0, 2).join(' - ')
                                                : 'Generalista'}
                                        </span>
                                        {lawyer.coverage_zones?.length > 0 && (
                                            <span className="fed-lawyer-zone">Zona: {lawyer.coverage_zones.join(', ')}</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className="fed-lawyer-action-btn"
                                    title="Iniciar conversacion"
                                    aria-label={`Iniciar conversación con ${lawyer.full_name}`}
                                    onClick={() => handleStartChat(lawyer)}
                                >
                                    <MessageCircle size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. DIRECTORIO NACIONAL */}
                <div className="fed-card">
                    <div className="fed-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <Building2 size={24} />
                    </div>
                    <h3>Directorio Judicial Nacional</h3>
                    <p>Acceso directo a portales judiciales, consulta de expedientes, colegios de abogados y MEV de cada jurisdiccion.</p>

                    <div className="fed-select-group">
                        <label htmlFor="dir-prov-select">Seleccionar Jurisdiccion</label>
                        <div className="fed-select-wrapper">
                            <select
                                id="dir-prov-select"
                                className="fed-select"
                                value={dirProv}
                                onChange={(e) => handleDirSearch(e.target.value)}
                            >
                                <option value="">Elegir jurisdiccion...</option>
                                <option value="Federal">Justicia Nacional y Federal</option>
                                <option value="CABA">CABA</option>
                                <option value="Buenos Aires">Buenos Aires</option>
                                <option value="Catamarca">Catamarca</option>
                                <option value="Chaco">Chaco</option>
                                <option value="Chubut">Chubut</option>
                                <option value="Córdoba">Córdoba</option>
                                <option value="Corrientes">Corrientes</option>
                                <option value="Entre Ríos">Entre Ríos</option>
                                <option value="Formosa">Formosa</option>
                                <option value="Jujuy">Jujuy</option>
                                <option value="La Pampa">La Pampa</option>
                                <option value="La Rioja">La Rioja</option>
                                <option value="Mendoza">Mendoza</option>
                                <option value="Misiones">Misiones</option>
                                <option value="Neuquén">Neuquén</option>
                                <option value="Río Negro">Río Negro</option>
                                <option value="Salta">Salta</option>
                                <option value="San Juan">San Juan</option>
                                <option value="San Luis">San Luis</option>
                                <option value="Santa Cruz">Santa Cruz</option>
                                <option value="Santa Fe">Santa Fe</option>
                                <option value="Santiago del Estero">Santiago del Estero</option>
                                <option value="Tierra del Fuego">Tierra del Fuego</option>
                                <option value="Tucumán">Tucumán</option>
                            </select>
                            <div className="fed-chevron">
                                <ChevronDown size={20} />
                            </div>
                        </div>
                    </div>

                    {!dirData && (
                        <div className="fed-lawyer-placeholder" style={{ marginTop: '1.5rem' }}>
                            <Landmark size={24} className="opacity-50" />
                            <span>Selecciona una jurisdiccion para ver portales y recursos.</span>
                        </div>
                    )}

                    {dirData && (
                        <div className="fed-dir-results">
                            <div className="fed-dir-title">{dirData.fullName}</div>

                            <a href={dirData.poderJudicial.url} target="_blank" rel="noopener noreferrer" className="fed-dir-link">
                                <div className="fed-dir-link-left">
                                    <div className="fed-dir-link-icon" style={{ color: '#10b981' }}>
                                        <Scale size={16} />
                                    </div>
                                    <div>
                                        <div className="fed-dir-link-name">{dirData.poderJudicial.name}</div>
                                        <div className="fed-dir-link-label">Poder Judicial</div>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="fed-dir-link-arrow" />
                            </a>

                            <a href={dirData.expedientes.url} target="_blank" rel="noopener noreferrer" className="fed-dir-link">
                                <div className="fed-dir-link-left">
                                    <div className="fed-dir-link-icon" style={{ color: '#3b82f6' }}>
                                        <FileText size={16} />
                                    </div>
                                    <div>
                                        <div className="fed-dir-link-name">{dirData.expedientes.name}</div>
                                        <div className="fed-dir-link-label">Consulta de Expedientes</div>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="fed-dir-link-arrow" />
                            </a>

                            <a href={dirData.colegio.url} target="_blank" rel="noopener noreferrer" className="fed-dir-link">
                                <div className="fed-dir-link-left">
                                    <div className="fed-dir-link-icon" style={{ color: '#a855f7' }}>
                                        <GraduationCap size={16} />
                                    </div>
                                    <div>
                                        <div className="fed-dir-link-name">{dirData.colegio.name}</div>
                                        <div className="fed-dir-link-label">Colegio de Abogados</div>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="fed-dir-link-arrow" />
                            </a>

                            {dirData.mev && (
                                <a href={dirData.mev.url} target="_blank" rel="noopener noreferrer" className="fed-dir-link fed-dir-link-highlight">
                                    <div className="fed-dir-link-left">
                                        <div className="fed-dir-link-icon" style={{ color: '#fbbf24' }}>
                                            <Building2 size={16} />
                                        </div>
                                        <div>
                                            <div className="fed-dir-link-name">{dirData.mev.name}</div>
                                            <div className="fed-dir-link-label">Mesa de Entradas Virtual</div>
                                        </div>
                                    </div>
                                    <ExternalLink size={14} className="fed-dir-link-arrow" />
                                </a>
                            )}

                            {dirData.extras.length > 0 && dirData.extras.map((extra, i) => (
                                <a key={i} href={extra.url} target="_blank" rel="noopener noreferrer" className="fed-dir-link">
                                    <div className="fed-dir-link-left">
                                        <div className="fed-dir-link-icon" style={{ color: '#64748b' }}>
                                            <Globe size={16} />
                                        </div>
                                        <div>
                                            <div className="fed-dir-link-name">{extra.name}</div>
                                            <div className="fed-dir-link-label">Recurso Adicional</div>
                                        </div>
                                    </div>
                                    <ExternalLink size={14} className="fed-dir-link-arrow" />
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. GUÍAS DE SUPERVIVENCIA */}
                <div className="fed-card fed-card-full">
                    <div className="fed-icon-box" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                        <BookOpen size={24} />
                    </div>
                    <h3>Guias de Supervivencia Juridica</h3>
                    <p>Protocolos paso a paso para tramites frecuentes ante organismos y tribunales.</p>

                    <div className="fed-guides-list">
                        {survivalGuides.map(guide => (
                            <div key={guide.id} className="fed-guide-item">
                                <button
                                    className="fed-guide-header"
                                    onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
                                    aria-expanded={expandedGuide === guide.id}
                                    aria-controls={`guide-body-${guide.id}`}
                                >
                                    <div className="fed-guide-header-left">
                                        <div className="fed-guide-icon">
                                            {guideIcons[guide.icon] || <FileText size={18} />}
                                        </div>
                                        <div>
                                            <div className="fed-guide-title">{guide.title}</div>
                                            <div className="fed-guide-meta">
                                                <span className="fed-guide-category">{guide.category}</span>
                                                <span className="fed-guide-difficulty">{guide.difficulty}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight
                                        size={18}
                                        className={`fed-guide-chevron ${expandedGuide === guide.id ? 'fed-guide-chevron-open' : ''}`}
                                    />
                                </button>

                                {expandedGuide === guide.id && (
                                    <div className="fed-guide-body" id={`guide-body-${guide.id}`}>
                                        <div className="fed-guide-section">
                                            <h4>Pasos</h4>
                                            <ol className="fed-guide-steps">
                                                {guide.steps.map((step, i) => (
                                                    <li key={i}>
                                                        <span className="fed-step-number">{i + 1}</span>
                                                        <span>{step}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                        <div className="fed-guide-section">
                                            <h4>Tips</h4>
                                            <ul className="fed-guide-tips">
                                                {guide.tips.map((tip, i) => (
                                                    <li key={i}>
                                                        <CheckCircle2 size={14} className="fed-tip-icon" />
                                                        <span>{tip}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="fed-footer">
                <p>&copy; 2026 Judic-IA - Centro de Recursos Interjurisdiccionales</p>
            </div>
        </div>
    );
}
