"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import EventModal from '../../components/dashboard/EventModal';

// Helper to get days in month
const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
};

// Helper to get day of week for first day (0 = Sunday, 1 = Monday...)
const getFirstDayOfMonth = (year, month) => {
    const day = new Date(year, month, 1).getDay();
    // Adjust so 0 = Monday, 6 = Sunday (Argentina standard)
    return day === 0 ? 6 : day - 1;
};

export default function AgendaPage() {
    const [loading, setLoading] = useState(true);
    const [deadlines, setDeadlines] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [modalOpen, setModalOpen] = useState(false);

    // Form State
    // Local Modal state removed in favor of EventModal

    const fetchDeadlines = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data, error } = await supabase
                .from('deadlines')
                .select('*')
                .eq('user_id', user.id)
                .order('due_date', { ascending: true });

            if (data) setDeadlines(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchDeadlines();
    }, []);

    const handleMonthChange = (increment) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + increment);
            return newDate;
        });
    };

    const handleEventCreated = () => {
        fetchDeadlines();
    };

    const markAsDone = async (id) => {
        await supabase.from('deadlines').update({ status: 'done' }).eq('id', id);
        fetchDeadlines();
    };

    const deleteEvent = async (id) => {
        if (confirm('¿Seguro que deseas eliminar este evento?')) {
            await supabase.from('deadlines').delete().eq('id', id);
            fetchDeadlines();
        }
    };

    // Calendar Generation Logic
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];
    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEvents = deadlines.filter(ev => ev.due_date.startsWith(dateStr));
        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        days.push(
            <div key={d} className={`calendar-day ${isToday ? 'today' : ''}`}>
                <span className="day-number">{d}</span>
                <div className="day-events">
                    {dayEvents.map(ev => (
                        <div key={ev.id} className={`event-chip type-${ev.type} status-${ev.status}`} title={ev.title}>
                            {ev.title}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="agenda-container">
            <header className="agenda-header">
                <div>
                    <h1 className="dashboard-page-title">📅 Agenda Jurídica</h1>
                    <p className="subtitle">Gestión de vencimientos, audiencias y plazos procesales.</p>
                </div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}>
                    + Nuevo Evento
                </button>
            </header>

            <div className="agenda-grid">
                {/* CALENDAR VIEW */}
                <div className="calendar-panel glass-panel">
                    <div className="calendar-controls">
                        <button onClick={() => handleMonthChange(-1)}>◀</button>
                        <h2>{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h2>
                        <button onClick={() => handleMonthChange(1)}>▶</button>
                    </div>

                    <div className="calendar-weekdays">
                        <div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
                    </div>

                    <div className="calendar-grid">
                        {days}
                    </div>
                </div>

                {/* UPCOMING LIST */}
                <aside className="upcoming-panel glass-panel">
                    <h3>🔔 Vencimientos Próximos (48hs)</h3>
                    <div className="upcoming-list">
                        {deadlines.filter(ev => {
                            const eventDate = new Date(ev.due_date);
                            const now = new Date();
                            const diffTime = eventDate - now;
                            const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
                            return diffHours > 0 && diffHours <= 48 && ev.status === 'pending';
                        }).length === 0 && <p className="empty-msg">No hay vencimientos urgentes.</p>}

                        {deadlines
                            .filter(ev => ev.status === 'pending')
                            .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                            .slice(0, 5)
                            .map(ev => (
                                <div key={ev.id} className="upcoming-item">
                                    <div className={`priority-indicator type-${ev.type}`}></div>
                                    <div className="event-info">
                                        <h4>{ev.title}</h4>
                                        <small>{new Date(ev.due_date).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                                    </div>
                                    <div className="event-actions">
                                        <button onClick={() => markAsDone(ev.id)} title="Marcar completado">✅</button>
                                        <button onClick={() => deleteEvent(ev.id)} title="Eliminar">🗑️</button>
                                    </div>
                                </div>
                            ))}
                    </div>
                </aside>
            </div>

            {/* MODAL */}
            <EventModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onEventCreated={handleEventCreated}
                initialData={null}
            />

            <style jsx>{`
                .agenda-container {
                    padding: 0 3rem 2.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .agenda-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                .subtitle { color: var(--muted); margin: 0; }
                
                .btn-primary {
                    background: var(--primary);
                    color: black;
                    padding: 0.8rem 1.5rem;
                    border: none;
                    border-radius: 8px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                  .btn-primary:hover { transform: translateY(-2px); }

                .agenda-grid {
                    display: grid;
                    grid-template-columns: 3fr 1fr;
                    gap: 2rem;
                }

                /* CALENDAR */
                .calendar-panel {
                    padding: 1.5rem;
                    background: rgba(15, 23, 42, 0.6);
                    border-radius: 16px;
                }
                .calendar-controls {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }
                .calendar-controls button {
                    background: none;
                    border: none;
                    color: var(--primary);
                    font-size: 1.5rem;
                    cursor: pointer;
                }
                .calendar-controls h2 { margin: 0; color: white; text-transform: capitalize; }
                
                .calendar-weekdays {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    text-align: center;
                    font-weight: bold;
                    color: var(--muted);
                    margin-bottom: 0.5rem;
                }
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 5px;
                }
                .calendar-day {
                    background: rgba(255,255,255,0.03);
                    min-height: 100px;
                    padding: 0.5rem;
                    border-radius: 6px;
                    transition: background 0.2s;
                }
                .calendar-day:hover { background: rgba(255,255,255,0.06); }
                .calendar-day.empty { background: transparent; }
                .calendar-day.today { border: 1px solid var(--primary); background: rgba(197, 160, 33, 0.05); }
                .day-number { font-size: 0.85rem; color: #94a3b8; font-weight: 600; }
                
                .day-events { display: flex; flex-direction: column; gap: 2px; margin-top: 5px; }
                .event-chip {
                    font-size: 0.7rem;
                    padding: 2px 4px;
                    border-radius: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    cursor: pointer;
                }
                .status-done { opacity: 0.5; text-decoration: line-through; }
                .type-hearing { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border-left: 2px solid #ef4444; }
                .type-filing { background: rgba(59, 130, 246, 0.2); color: #93c5fd; border-left: 2px solid #3b82f6; }
                .type-meeting { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border-left: 2px solid #10b981; }
                .type-other { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border-left: 2px solid #94a3b8; }

                /* UPCOMING SIDEBAR */
                .upcoming-panel {
                    padding: 1.5rem;
                    background: rgba(15, 23, 42, 0.6);
                    border-radius: 16px;
                    height: fit-content;
                }
                .upcoming-panel h3 { margin-top: 0; font-size: 1.1rem; color: var(--primary); margin-bottom: 1rem; }
                .upcoming-list { display: flex; flex-direction: column; gap: 1rem; }
                .upcoming-item {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    padding: 0.8rem;
                    background: rgba(255,255,255,0.03);
                    border-radius: 8px;
                    transition: 0.2s;
                }
                .upcoming-item:hover { background: rgba(255,255,255,0.06); }
                .priority-indicator { width: 4px; height: 30px; border-radius: 2px; }
                .event-info h4 { margin: 0; font-size: 0.9rem; color: #e2e8f0; }
                .event-info small { color: #94a3b8; font-size: 0.8rem; }
                .event-actions { margin-left: auto; display: flex; gap: 0.5rem; opacity: 0; transition: 0.2s; }
                .upcoming-item:hover .event-actions { opacity: 1; }
                .event-actions button { background: none; border: none; cursor: pointer; font-size: 1rem; }

                /* MODAL */
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    backdrop-filter: blur(5px);
                }
                .modal-content {
                    background: #1e293b;
                    padding: 2rem;
                    border-radius: 16px;
                    width: 400px;
                    border: 1px solid var(--border);
                }
                .modal-content form { display: flex; flex-direction: column; gap: 1rem; }
                .modal-content input, .modal-content select, .modal-content textarea {
                    padding: 0.8rem;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    color: white;
                }
                .row { display: flex; gap: 1rem; }
                .row > div { flex: 1; display: flex; flex-direction: column; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; }
                .btn-cancel { background: transparent; border: 1px solid var(--border); color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }

                @media (max-width: 1024px) {
                    .agenda-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}
