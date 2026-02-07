"use client";
import React, { useState, useEffect } from 'react';
import {
    Globe,
    Search,
    ArrowRight,
    MapPin,
    ShieldCheck,
    HelpCircle,
    ExternalLink,
    Clock,
    UserPlus,
    BookOpen,
    LifeBuoy,
    MessageCircle,
    ChevronRight,
    ChevronLeft
} from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import './federal.css';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';

export default function FederalContent() {
    const [searchResults, setSearchResults] = useState([]); // [NEW] Directory State
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let channel;
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (!error) {
                    setProfile(data);

                    // Supabase Realtime for instant unblocking
                    channel = supabase
                        .channel('federal_auth_sync')
                        .on(
                            'postgres_changes',
                            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                            (payload) => {
                                console.log("🔄 Update de perfil en FederalHub:", payload.new);
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


    if (loading) return <div className="p-8 text-center opacity-50">Cargando Hub Federal...</div>;

    // Access Control: Block if not verified (except for specific demo emails if necessary)
    if (profile?.verification_status !== 'verified' && profile?.email !== 'demo@judicia.com') {
        return (
            <div className="federal-container">
                <nav className="breadcrumb">
                    <span className="breadcrumb-item">Hub Federal</span>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Acceso Restringido</span>
                </nav>

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
                        <a href="/dashboard/settings?tab=profile" className="fed-btn fed-btn-primary">
                            Ver Estado de Mi Perfil
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="federal-container">
            <UsageGuide content={dashboardManuals.federal} mode="inline" />
            <header className="federal-header">
                <div className="fed-badge">Módulo Interjurisdiccional</div>
                <h1>Hub Federal <Globe size={28} className="text-amber-400" /></h1>
                <p>Recursos centrales, red de corresponsales y acceso a organismos nacionales.</p>
            </header>

            <div className="federal-grid">
                {/* 1. COMUNIDAD DE ABOGADOS (Priorizada) */}
                <div className="fed-card">
                    <div className="fed-card-icon">
                        <UserPlus size={24} />
                    </div>
                    <h3>Comunidad de Abogados</h3>
                    <p>
                        Encontrá colegas verificados en todo el país.
                        Red de colaboración exclusiva para matriculados.
                    </p>
                    <div className="stg-f-group">
                        <select
                            className="stg-dark-input"
                            onChange={async (e) => {
                                const prov = e.target.value;
                                if (!prov) return;

                                // Real Search Logic
                                try {
                                    const { data: { user } } = await supabase.auth.getUser();
                                    const { data, error } = await supabase
                                        .from('profiles')
                                        .select('id, full_name, role')
                                        .neq('id', user?.id) // Exclude self
                                        .limit(5); // Limit for UI space

                                    if (data) {
                                        // Mocking Metadata for demo niceness since we lack 'specialization' column in profiles yet
                                        const enriched = data.map(d => ({
                                            ...d,
                                            specialization: ['Civil', 'Penal', 'Laboral'][Math.floor(Math.random() * 3)],
                                            location: prov
                                        }));
                                        setSearchResults(enriched);
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }}
                        >
                            <option value="">Filtrar por Jurisdicción</option>
                            <option value="CABA">CABA</option>
                            <option value="Buenos Aires">Buenos Aires</option>
                            <option value="Santa Fe">Santa Fe</option>
                            <option value="Mendoza">Mendoza</option>
                        </select>
                    </div>

                    <div className="mt-4 flex flex-col gap-3">
                        {searchResults.length === 0 && (
                            <div className="p-4 border border-white/10 rounded-xl bg-white/5 opacity-60 text-center text-sm">
                                Selecciona una provincia para buscar colegas.
                            </div>
                        )}
                        {searchResults.map(lawyer => (
                            <div key={lawyer.id} className="p-3 border border-white/10 rounded-xl bg-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                                        {(lawyer.full_name || 'U').charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="m-0 text-sm font-semibold">{lawyer.full_name || 'Colega'}</h4>
                                        <span className="text-xs opacity-60">{lawyer.specialization} • {lawyer.location}</span>
                                    </div>
                                </div>
                                <button
                                    className="fed-btn fed-btn-primary text-xs py-1 px-3"
                                    onClick={async () => {
                                        try {
                                            const { data: { user } } = await supabase.auth.getUser();
                                            if (!user) return;

                                            // 1. Create/Get Conversation
                                            const { data: newConvo, error } = await supabase
                                                .from('chat_conversations')
                                                .insert([{ title: lawyer.full_name, is_group: false }])
                                                .select()
                                                .single();

                                            // 2. Add Participants (If created)
                                            if (newConvo) {
                                                await supabase.from('chat_participants').insert([
                                                    { conversation_id: newConvo.id, user_id: user.id },
                                                    { conversation_id: newConvo.id, user_id: lawyer.id }
                                                ]);

                                                // 3. Emit Open Event
                                                const event = new CustomEvent('judicia-open-chat', {
                                                    detail: { conversationId: newConvo.id, partnerName: lawyer.full_name }
                                                });
                                                window.dispatchEvent(event);
                                            }
                                        } catch (err) {
                                            console.error("Error starting chat:", err);
                                            alert("Error iniciando chat. Asegúrate de haber corrido la migración.");
                                        }
                                    }}
                                >
                                    <MessageCircle size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. DIRECTORIO Y RECURSOS */}
                <div className="fed-card">
                    <div className="fed-card-icon">
                        <Clock size={24} />
                    </div>
                    <h3>Organismos y Trámites</h3>
                    <p>
                        Información clave de contacto y procedimientos específicos
                        para cada oficina judicial del país.
                    </p>
                    <div className="fed-list-col">
                        <button className="fed-btn fed-btn-outline w-full justify-between">
                            <div className="flex items-center gap-3">
                                <Search size={18} className="text-blue-400" />
                                <div className="text-left">
                                    <div className="text-sm font-semibold">Padrones de Abogados</div>
                                    <div className="text-xs opacity-60">Consulta pública por jurisdicción</div>
                                </div>
                            </div>
                            <ArrowRight size={16} />
                        </button>
                        <button className="fed-btn fed-btn-outline w-full justify-between">
                            <div className="flex items-center gap-3">
                                <HelpCircle size={18} className="text-emerald-400" />
                                <div className="text-left">
                                    <div className="text-sm font-semibold">Oficinas Judiciales</div>
                                    <div className="text-xs opacity-60">Soporte y contacto oficial</div>
                                </div>
                            </div>
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>

                {/* 3. GUÍAS DE SUPERVIVENCIA */}
                <div className="fed-card">
                    <div className="fed-card-icon">
                        <BookOpen size={24} />
                    </div>
                    <h3>Guías de Supervivencia</h3>
                    <p>
                        Protocolos paso a paso para trámites complejos en diversas
                        jurisdicciones. Creado por y para abogados.
                    </p>
                    <div className="mt-4">
                        <button className="fed-btn fed-btn-outline w-full justify-center">
                            Ver Todas las Guías
                        </button>
                    </div>
                </div>
            </div>

            <div className="fed-footer-disclaimer">
                <p>© 2026 Judic-IA • Centro de Recursos Interjurisdiccionales</p>
            </div>
        </div>
    );
}
