"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { addJudicialBusinessDays } from '../../lib/dateUtils';

export default function EventModal({ isOpen, onClose, onEventCreated, initialData }) {
    const [eventData, setEventData] = useState({
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        type: 'hearing',
        inquiry_id: null // New field
    });
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState([]); // State for clients dropdown

    // Calculator State
    const [showCalculator, setShowCalculator] = useState(false);
    const [calcStart, setCalcStart] = useState(new Date().toISOString().split('T')[0]);
    const [calcDays, setCalcDays] = useState(3);

    useEffect(() => {
        if (showCalculator && calcStart) {
            const [y, m, d] = calcStart.split('-');
            const startDate = new Date(y, m - 1, d);
            const resultDate = addJudicialBusinessDays(startDate, parseInt(calcDays) || 0);
            const isoDate = resultDate.toISOString().split('T')[0];
            setEventData(prev => ({ ...prev, date: isoDate }));
        }
    }, [calcStart, calcDays, showCalculator]);

    useEffect(() => {
        if (isOpen) {
            // Fetch clients for dropdown
            const fetchClients = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase
                        .from('inquiries')
                        .select('id, contact_name')
                        .neq('status', 'link_generated') // Only active clients
                        .order('contact_name', { ascending: true });

                    if (data) setClients(data);
                }
            };
            fetchClients();

            if (initialData) {
                setEventData(prev => ({
                    ...prev,
                    ...initialData
                }));
            } else {
                setEventData({
                    title: '',
                    description: '',
                    date: new Date().toISOString().split('T')[0],
                    time: '09:00',
                    type: 'hearing',
                    inquiry_id: null
                });
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const due_date = new Date(`${eventData.date}T${eventData.time}:00`).toISOString();

        const { error } = await supabase
            .from('deadlines')
            .insert({
                user_id: user.id,
                title: eventData.title,
                description: eventData.description,
                due_date: due_date,
                type: eventData.type,
                status: 'pending',
                inquiry_id: eventData.inquiry_id // Save relation
            });

        setLoading(false);
        if (!error) {
            onEventCreated();
            onClose();
        } else {
            alert('Error al crear evento: ' + error.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-panel">
                <h3>{initialData?.title ? 'Nuevo Plazo (Derivado)' : 'Nuevo Evento'}</h3>
                <form onSubmit={handleSubmit}>
                    <label>Título</label>
                    <input
                        type="text"
                        value={eventData.title}
                        onChange={e => setEventData({ ...eventData, title: e.target.value })}
                        required
                        placeholder="Ej: Audiencia Testimonial"
                    />

                    {/* Client Selector */}
                    <label>Asociar a Cliente (Opcional)</label>
                    <select
                        value={eventData.inquiry_id || ''}
                        onChange={e => setEventData({ ...eventData, inquiry_id: e.target.value || null })}
                    >
                        <option value="">-- Sin asignar --</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>
                                👤 {c.contact_name || 'Sin Nombre'}
                            </option>
                        ))}
                    </select>

                    {/* Deadline Calculator */}
                    <div className="calc-toggle" onClick={() => setShowCalculator(!showCalculator)}>
                        <span>{showCalculator ? '▼' : '▶'}</span> 🧮 Calculadora de Plazos (Días Hábiles)
                    </div>

                    {showCalculator && (
                        <div className="calculator-box">
                            <div className="row">
                                <div>
                                    <label style={{ color: '#fbbf24' }}>Fecha Notificación</label>
                                    <input
                                        type="date"
                                        value={calcStart}
                                        onChange={e => setCalcStart(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ color: '#fbbf24' }}>Plazo (Días)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={calcDays}
                                        onChange={e => setCalcDays(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                * Se calculan días hábiles automáticamente y se actualiza la fecha abajo.
                            </div>
                        </div>
                    )}

                    <div className="row">
                        <div>
                            <label>Fecha</label>
                            <input
                                type="date"
                                value={eventData.date}
                                onChange={e => setEventData({ ...eventData, date: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label>Hora</label>
                            <input
                                type="time"
                                value={eventData.time}
                                onChange={e => setEventData({ ...eventData, time: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <label>Tipo</label>
                    <select value={eventData.type} onChange={e => setEventData({ ...eventData, type: e.target.value })}>
                        <option value="hearing">🏛️ Audiencia</option>
                        <option value="filing">📝 Vencimiento Escrito</option>
                        <option value="meeting">🤝 Reunión Cliente</option>
                        <option value="other">📌 Otro</option>
                    </select>

                    <label>Descripción (Opcional)</label>
                    <textarea
                        value={eventData.description}
                        onChange={e => setEventData({ ...eventData, description: e.target.value })}
                        rows={3}
                    />

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-cancel">Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 2000; /* Higher than other modals */
                    backdrop-filter: blur(5px);
                }
                .modal-content {
                    background: #1e293b;
                    padding: 2rem;
                    border-radius: 16px;
                    width: 400px;
                    max-height: 85vh;      /* Prevent overflow on small screens */
                    overflow-y: auto;      /* Enable toggle/scroll */
                    border: 1px solid rgba(255,255,255,0.1);
                    color: white;
                }
                .modal-content h3 { margin-top: 0; margin-bottom: 1.5rem; color: #fbbf24; }
                .modal-content form { display: flex; flex-direction: column; gap: 1rem; }
                .modal-content input, .modal-content select, .modal-content textarea {
                    padding: 0.8rem;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 6px;
                    color: white;
                    width: 100%;
                }
                .row { display: flex; gap: 1rem; }
                .row > div { flex: 1; display: flex; flex-direction: column; }
                
                .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; }
                .btn-cancel { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
                .btn-primary { background: #fbbf24; color: #0f172a; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; cursor: pointer; }
                .btn-primary:disabled { opacity: 0.7; }

                /* Fix for dropdown visibility */
                select option {
                    background-color: #1e293b;
                    color: white;
                }
                
                /* Calculator Styles */
                .calculator-box {
                    background: rgba(251, 191, 36, 0.05);
                    border: 1px dashed rgba(251, 191, 36, 0.3);
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                }
                .calc-toggle {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                    cursor: pointer;
                    color: #fbbf24;
                    font-weight: 600;
                    font-size: 0.9rem;
                }
            `}</style>
        </div>
    );
}
