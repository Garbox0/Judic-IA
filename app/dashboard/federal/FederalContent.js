"use client";
import React, { useState, useEffect } from 'react';
import {
    Globe,
    ArrowRight,
    MapPin,
    ShieldCheck,
    HelpCircle,
    Clock,
    UserPlus,
    BookOpen,
    MessageCircle,
    ChevronDown,
    AlertCircle
} from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import { toast } from 'sonner';
import './federal.css';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';

export default function FederalContent() {
    const [searchResults, setSearchResults] = useState([]);
    const [selectedProv, setSelectedProv] = useState("");
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [directoryFeedback, setDirectoryFeedback] = useState(null);

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
        return () => { if (channel) supabase.removeChannel(channel); };
    }, []);

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
                .select('id, full_name, especialidades, jurisdiccion, coverage_areas, avatar_url, biography')
                .eq('is_correspondent', true)
                .eq('verification_status', 'verified')
                .eq('role', 'lawyer')
                .ilike('jurisdiccion', `%${prov}%`)
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

            // Check if conversation already exists between these two users
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
                    // Open existing conversation
                    window.dispatchEvent(new CustomEvent('judicia-open-chat', {
                        detail: { conversationId: sharedConvo.conversation_id, partnerName: lawyer.full_name }
                    }));
                    toast.success(`Chat con ${lawyer.full_name} abierto`);
                    return;
                }
            }

            // Create new conversation
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
            toast.success(`Conversación iniciada con ${lawyer.full_name}`);
        } catch (err) {
            console.error("Error starting chat:", err);
            toast.error("Error iniciando chat: " + err.message);
        }
    };

    const showDirectoryMsg = (msg) => {
        setDirectoryFeedback(msg);
        setTimeout(() => setDirectoryFeedback(null), 4000);
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
                    <h1 className="dashboard-page-title">Verificación Necesaria</h1>
                    <p className="opacity-70 text-lg mb-8">
                        Para acceder al Hub Federal y a la Comunidad de Abogados, tu matrícula profesional debe ser verificada por nuestro equipo técnico.
                    </p>
                    <div className="fed-restricted-status-box">
                        <h4 className="m-0 mb-3 flex items-center gap-2">
                            <Clock size={16} className="text-amber-400" />
                            Estado actual: {profile?.verification_status === 'pending' ? 'Pendiente de Revisión' : 'Acción Requerida'}
                        </h4>
                        <p className="text-sm opacity-60 m-0">
                            Estamos validando tus credenciales con los colegios públicos correspondientes. Te notificaremos vía email cuando tu acceso sea habilitado.
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
            <UsageGuide content={dashboardManuals.federal} mode="inline" />

            <header className="fed-header">
                <div className="fed-badge">Módulo Interjurisdiccional</div>
                <h1>Hub Federal <Globe size={28} className="text-amber-400" /></h1>
                <p>Nexo interjurisdiccional para la Red de Colegas y Recursos Nacionales.</p>
            </header>

            <div className="fed-grid">
                {/* 1. RED DE CORRESPONSALES */}
                <div className="fed-card">
                    <div className="fed-icon-box" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                        <UserPlus size={24} />
                    </div>
                    <h3>Red de Corresponsales</h3>
                    <p>Colaborá con colegas verificados de todo el país para delegar tareas judiciales locales en un entorno seguro.</p>

                    <div className="fed-select-group">
                        <label htmlFor="jurisdiccion-select">Jurisdicción de Búsqueda</label>
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
                                <span>Seleccioná una provincia para ver colegas disponibles.</span>
                            </div>
                        )}
                        {!searching && selectedProv && searchResults.length === 0 && (
                            <div className="fed-lawyer-placeholder">
                                <UserPlus size={24} className="opacity-50" />
                                <span>No se encontraron colegas en esta jurisdicción.</span>
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
                                                ? lawyer.especialidades.slice(0, 2).join(' • ')
                                                : 'Generalista'}
                                        </span>
                                        {lawyer.coverage_areas && (
                                            <span className="fed-lawyer-zone">Zona: {lawyer.coverage_areas}</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className="fed-lawyer-action-btn"
                                    title="Iniciar conversación"
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
                        <Clock size={24} />
                    </div>
                    <h3>Directorio Nacional</h3>
                    <p>Buscador de organismos judiciales, padrones y contactos oficiales de todo el territorio nacional.</p>

                    {directoryFeedback && (
                        <div className="fed-feedback-bar">
                            <AlertCircle size={16} className="text-blue-400 shrink-0" />
                            <span>{directoryFeedback}</span>
                        </div>
                    )}

                    <div className="fed-btn-list">
                        <button className="fed-full-btn" onClick={() => showDirectoryMsg("Próximamente: Buscador de Padrones Nacionales.")}>
                            <div className="flex items-center gap-3">
                                <div className="fed-btn-icon-box text-blue-400">
                                    <Globe size={18} />
                                </div>
                                <span>Padrones Federales</span>
                            </div>
                            <ArrowRight size={18} className="fed-btn-arrow" />
                        </button>
                        <button className="fed-full-btn" onClick={() => showDirectoryMsg("Próximamente: Base de datos de oficinas judiciales.")}>
                            <div className="flex items-center gap-3">
                                <div className="fed-btn-icon-box text-emerald-400">
                                    <HelpCircle size={18} />
                                </div>
                                <span>Oficinas Judiciales</span>
                            </div>
                            <ArrowRight size={18} className="fed-btn-arrow" />
                        </button>
                    </div>
                </div>

                {/* 3. GUÍAS PRO */}
                <div className="fed-card">
                    <div className="fed-icon-box" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                        <BookOpen size={24} />
                    </div>
                    <h3>Guías de Supervivencia</h3>
                    <p>Protocolos paso a paso para trámites ante organismos específicos y tribunales de distintas provincias.</p>
                    <div className="mt-4">
                        <button
                            className="fed-full-btn"
                            style={{ justifyContent: 'center', borderColor: 'rgba(251, 191, 36, 0.3)', color: '#fbbf24' }}
                            onClick={() => toast.info("Próximamente: Protocolos PRO por jurisdicción.")}
                        >
                            <ShieldCheck size={18} className="mr-2" /> Explorar Protocolos PRO
                        </button>
                    </div>
                </div>
            </div>

            <div className="fed-footer">
                <p>© 2026 Judic-IA • Centro de Recursos Interjurisdiccionales</p>
            </div>
        </div>
    );
}
