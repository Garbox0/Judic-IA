"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
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

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const toISODate = (d) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
};

// devuelve: { level: 'overdue'|'critical'|'high'|'medium'|'ok', label: 'CRÍTICO', hoursLeft: number }
const getUrgency = (dueDateStr) => {
    const due = new Date(dueDateStr);
    const now = new Date();
    const diffMs = due - now;
    const hoursLeft = Math.ceil(diffMs / (1000 * 60 * 60));

    if (hoursLeft <= 0) return { level: "overdue", label: "VENCIDO", hoursLeft };
    if (hoursLeft <= 24) return { level: "critical", label: "CRÍTICO", hoursLeft };
    if (hoursLeft <= 72) return { level: "high", label: "ALTO", hoursLeft };
    if (hoursLeft <= 168) return { level: "medium", label: "MEDIO", hoursLeft };
    return { level: "ok", label: "OK", hoursLeft };
};

const humanCountdown = (hoursLeft) => {
    if (hoursLeft <= 0) return "vencido";
    if (hoursLeft < 24) return `en ${hoursLeft}h`;
    const days = Math.ceil(hoursLeft / 24);
    return `en ${days}d`;
};


export default function AgendaPage() {
    const [loading, setLoading] = useState(true);
    const [deadlines, setDeadlines] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [modalOpen, setModalOpen] = useState(false);

    const [range, setRange] = useState("48h");   // 48h | 7d | 30d
    const [sortBy, setSortBy] = useState("urgency"); // urgency | date | title
    const [onlyCritical, setOnlyCritical] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [hoverDay, setHoverDay] = useState(null);

    const openHover = (e, dateStr, items) => {
        if (!items || items.length === 0) return;
        const w = 340, h = 240, pad = 16;
        const x = Math.min(e.clientX + 14, window.innerWidth - w - pad);
        const y = Math.min(e.clientY + 14, window.innerHeight - h - pad);
        setHoverDay({ dateStr, x, y, items });
    };

    const moveHover = (e) => {
        setHoverDay((prev) => {
            if (!prev) return prev;
            const w = 340, h = 240, pad = 16;
            const x = Math.min(e.clientX + 14, window.innerWidth - w - pad);
            const y = Math.min(e.clientY + 14, window.innerHeight - h - pad);
            return { ...prev, x, y };
        });
    };

    const closeHover = () => setHoverDay(null);


    const fetchDeadlines = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data, error } = await supabase
                .from('deadlines')
                .select('*, inquiries(contact_name, id)')
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
        await supabase.from('deadlines').update({
            status: 'done',
            done_at: new Date().toISOString()
        }).eq('id', id);
        fetchDeadlines();
    };

    const deleteEvent = async (id) => {
        if (confirm('¿Seguro que deseas eliminar este evento?')) {
            await supabase.from('deadlines').update({
                status: 'cancelled', // Use 'cancelled' as 'deleted' is not in constraint
                deleted_at: new Date().toISOString()
            }).eq('id', id);
            fetchDeadlines();
        }
    };

    // Logic calculation
    const now = new Date();
    const todayISO = toISODate(now);

    const pending = deadlines.filter(d => d.status === "pending");

    const withUrgency = pending.map(ev => ({
        ...ev,
        urgency: getUrgency(ev.due_date),
    }));

    const rangeHours = range === "48h" ? 48 : range === "7d" ? 168 : 720;

    let filtered = withUrgency
        .filter(ev => ev.urgency.hoursLeft <= rangeHours) // incluye vencidos también
        .filter(ev => (onlyCritical ? ["overdue", "critical"].includes(ev.urgency.level) : true));

    if (sortBy === "date") {
        filtered.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    } else if (sortBy === "title") {
        filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else {
        // urgency
        const order = { overdue: 0, critical: 1, high: 2, medium: 3, ok: 4 };
        filtered.sort((a, b) => order[a.urgency.level] - order[b.urgency.level] || (new Date(a.due_date) - new Date(b.due_date)));
    }

    const groups = {
        overdue: filtered.filter(e => e.urgency.level === "overdue"),
        today: filtered.filter(e => e.due_date?.startsWith(todayISO) && e.urgency.level !== "overdue"),
        next: filtered.filter(e => !e.due_date?.startsWith(todayISO) && e.urgency.level !== "overdue"),
    };

    // KPIs
    const kpiOverdue = withUrgency.filter(e => e.urgency.level === "overdue").length;
    const kpiToday = withUrgency.filter(e => e.due_date?.startsWith(todayISO) && e.urgency.level !== "overdue").length;
    const kpi7d = withUrgency.filter(e => e.urgency.hoursLeft > 0 && e.urgency.hoursLeft <= 168).length;

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
        // Filter pending events for calendar
        const dayEvents = deadlines.filter(ev => ev.due_date.startsWith(dateStr) && ev.status === 'pending');
        const isToday = new Date().toISOString().split('T')[0] === dateStr;
        const hasEvents = dayEvents.length > 0;

        const uniqueTypes = [...new Set(dayEvents.map((ev) => ev.type))].slice(0, 3);
        const extraCount = Math.max(0, dayEvents.length - uniqueTypes.length);

        days.push(
            <div
                key={d}
                className={`calendar-day ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
                onMouseEnter={(e) => openHover(e, dateStr, dayEvents)}
                onMouseMove={hasEvents ? moveHover : undefined}
                onMouseLeave={closeHover}
            >
                <span className="day-number">{d}</span>
                {hasEvents && (
                    <>
                        <div className="day-marker" aria-hidden="true" />
                        <div className="day-dots" aria-hidden="true">
                            {uniqueTypes.map((t) => (
                                <span key={t} className={`day-dot dot-${t}`} />
                            ))}
                            {extraCount > 0 && <span className="dot-count">+{extraCount}</span>}
                        </div>
                    </>
                )}
            </div>
        );
    }


    return (
        <div className="agenda-container">
            <nav className="agenda-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Agenda Jurídica</span>
                </div>
            </nav>

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

                {/* UPCOMING LIST (Pro Inbox) */}
                <aside className="upcoming-panel glass-panel">
                    <div className="upcoming-sticky">
                        <div className="upcoming-title-row">
                            <h3>🔔 Plazos</h3>
                            <div className="upcoming-mini">
                                <span className="pill">Vencidos: {kpiOverdue}</span>
                                <span className="pill">Hoy: {kpiToday}</span>
                                <span className="pill">7d: {kpi7d}</span>
                            </div>
                        </div>

                        <div className="upcoming-filters">
                            <div className="segmented">
                                <button className={range === "48h" ? "active" : ""} onClick={() => setRange("48h")}>48h</button>
                                <button className={range === "7d" ? "active" : ""} onClick={() => setRange("7d")}>7d</button>
                                <button className={range === "30d" ? "active" : ""} onClick={() => setRange("30d")}>30d</button>
                            </div>

                            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                <option value="urgency">Orden: Urgencia</option>
                                <option value="date">Orden: Fecha</option>
                                <option value="title">Orden: Título</option>
                            </select>

                            <label className="check">
                                <input
                                    type="checkbox"
                                    checked={onlyCritical}
                                    onChange={(e) => setOnlyCritical(e.target.checked)}
                                />
                                Solo críticos
                            </label>
                        </div>
                    </div>

                    <div className="upcoming-scroll">
                        {filtered.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-title">No hay plazos en este rango ✅</div>
                                <div className="empty-sub">Probá ampliar a 7d/30d o creá un nuevo evento.</div>
                            </div>
                        )}

                        {groups.overdue.length > 0 && (
                            <div className="section">
                                <div className="section-title">Vencidos</div>
                                {groups.overdue.map(ev => (
                                    <div key={ev.id} className={`deadline-card urgency-${ev.urgency.level}`}>

                                        <div className="card-main">
                                            <div className="card-top">
                                                <div className="badge">{ev.urgency.label}</div>
                                                <div className="countdown">{humanCountdown(ev.urgency.hoursLeft)}</div>
                                            </div>

                                            {ev.inquiries?.contact_name && (
                                                <div className="card-client">👤 {ev.inquiries.contact_name}</div>
                                            )}

                                            <div className="card-title">{ev.title}</div>
                                            <div className="card-meta">
                                                {new Date(ev.due_date).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        <div className="event-actions">
                                            <button onClick={() => markAsDone(ev.id)} title="Marcar completado">✅</button>
                                            <button onClick={() => deleteEvent(ev.id)} title="Eliminar">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {groups.today.length > 0 && (
                            <div className="section">
                                <div className="section-title">Hoy</div>
                                {groups.today.map(ev => (
                                    <div key={ev.id} className={`deadline-card urgency-${ev.urgency.level}`}>

                                        <div className="card-main">
                                            <div className="card-top">
                                                <div className="badge">{ev.urgency.label}</div>
                                                <div className="countdown">{humanCountdown(ev.urgency.hoursLeft)}</div>
                                            </div>

                                            {ev.inquiries?.contact_name && (
                                                <div className="card-client">👤 {ev.inquiries.contact_name}</div>
                                            )}

                                            <div className="card-title">{ev.title}</div>
                                            <div className="card-meta">
                                                {new Date(ev.due_date).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' })} • {new Date(ev.due_date).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </div>
                                        </div>

                                        <div className="event-actions">
                                            <button onClick={() => markAsDone(ev.id)} title="Marcar completado">✅</button>
                                            <button onClick={() => deleteEvent(ev.id)} title="Eliminar">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {groups.next.length > 0 && (
                            <div className="section">
                                <div className="section-title">Próximos</div>
                                {groups.next.map(ev => (
                                    <div key={ev.id} className={`deadline-card urgency-${ev.urgency.level}`}>

                                        <div className="card-main">
                                            <div className="card-top">
                                                <div className="badge">{ev.urgency.label}</div>
                                                <div className="countdown">{humanCountdown(ev.urgency.hoursLeft)}</div>
                                            </div>

                                            {ev.inquiries?.contact_name && (
                                                <div className="card-client">👤 {ev.inquiries.contact_name}</div>
                                            )}

                                            <div className="card-title">{ev.title}</div>
                                            <div className="card-meta">
                                                {new Date(ev.due_date).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        <div className="event-actions">
                                            <button onClick={() => markAsDone(ev.id)} title="Marcar completado">✅</button>
                                            <button onClick={() => deleteEvent(ev.id)} title="Eliminar">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

            </div>

            {/* Hover Tooltip */}
            {hoverDay && (
                <div
                    className="day-tooltip"
                    style={{ transform: `translate(${hoverDay.x}px, ${hoverDay.y}px)` }}
                >
                    <div className="tt-head">
                        <div className="tt-date">
                            {new Date(hoverDay.dateStr + "T00:00:00").toLocaleDateString('es-AR', {
                                weekday: 'long', day: 'numeric', month: 'long'
                            })}
                        </div>
                        <div className="tt-count">{hoverDay.items.length} plazos</div>
                    </div>

                    <div className="tt-list">
                        {hoverDay.items.slice(0, 6).map((ev) => (
                            <div key={ev.id} className="tt-item">
                                <span className={`tt-dot dot-${ev.type}`} />
                                <div className="tt-main">
                                    <div className="tt-title">{ev.title}</div>
                                    {ev.inquiries?.contact_name && (
                                        <div className="tt-client">👤 {ev.inquiries.contact_name}</div>
                                    )}
                                    <div className="tt-meta">
                                        {new Date(ev.due_date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {hoverDay.items.length > 6 && (
                            <div className="tt-more">
                                +{hoverDay.items.length - 6} más (miralos en la lista de la derecha)
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* History Panel */}
            <div className={`history-panel ${showHistory ? 'expanded' : ''}`}>
                <div className="history-head" onClick={() => setShowHistory(!showHistory)}>
                    <div className="history-title">
                        <span className="icon">📜</span>
                        <h3>Historial de Plazos</h3>
                        <span className="count">
                            {deadlines.filter(ev => ev.status !== 'pending').length} archivados
                        </span>
                    </div>
                    <button className="btn-toggle">{showHistory ? '▼ Ocultar' : '▲ Ver Historial'}</button>
                </div>
                {showHistory && (
                    <div className="history-body">
                        <div className="history-list">
                            {deadlines.filter(ev => ev.status !== 'pending').length === 0 ? (
                                <p className="empty-msg">No hay plazos en el historial.</p>
                            ) : (
                                <div className="history-grid">
                                    {deadlines
                                        .filter(ev => ev.status !== 'pending')
                                        .sort((a, b) => new Date(b.done_at || b.deleted_at || 0) - new Date(a.done_at || a.deleted_at || 0))
                                        .map(ev => (
                                            <div key={ev.id} className={`history-card status-${ev.status}`}>
                                                <div className="card-info">
                                                    <span className={`badge-status ${ev.status}`}>
                                                        {ev.status === 'done' ? '✓ COMPLETADO' : '✕ ELIMINADO'}
                                                    </span>
                                                    <h4>{ev.title}</h4>
                                                    <span className="date">
                                                        📅 Venció: {new Date(ev.due_date).toLocaleDateString()}
                                                    </span>
                                                    <span className="timestamp">
                                                        🕒 {ev.status === 'done' ? 'Completado' : 'Eliminado'} el: {new Date(ev.done_at || ev.deleted_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
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
                    min-height: 110px;
                    padding: 10px;
                    border-radius: 10px;
                    transition: background 0.2s, transform 0.12s;
                    position: relative;
                    overflow: hidden;
                }
                .calendar-day:hover { background: rgba(255,255,255,0.06); }
                .calendar-day.empty { background: transparent; cursor: default; }
                .calendar-day.today { border: 1px solid var(--primary); background: rgba(197, 160, 33, 0.05); }
                .calendar-day.has-events { cursor: pointer; }
                .calendar-day.has-events:hover { transform: translateY(-1px); }

                /* Usamos :global para asegurar que estilice los elementos generados en el array */
                /* IMPERATIVO: El contenedor del día DEBE ser relativo para que los hijos absolutos se posicionen dentro de él */
                .calendar-grid :global(.calendar-day) {
                    position: relative !important;
                    min-height: 100px;
                    z-index: 1;
                }

                /* Usamos :global para asegurar que estilice los elementos generados */
                .calendar-grid :global(.day-number) {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 2rem !important;
                    color: rgba(148, 163, 184, 0.5); 
                    font-weight: 800;
                    z-index: 5;
                    transition: all 0.2s;
                    user-select: none;
                    pointer-events: none;
                }
                .calendar-grid :global(.calendar-day.has-events:hover .day-number) {
                    color: #fff;
                    transform: translate(-50%, -50%) scale(1.1);
                    text-shadow: 0 2px 10px rgba(0,0,0,0.5);
                }

                .calendar-grid :global(.day-marker) {
                    position: absolute;
                    inset: 4px;
                    border-radius: 12px;
                    /* Más notable por defecto como pidió el usuario */
                    border: 1px solid rgba(212,178,76,0.3); 
                    background: rgba(212,178,76,0.02);
                    z-index: 1;
                    transition: 0.2s;
                    opacity: 1; /* Full opacity base */
                }
                
                .calendar-grid :global(.calendar-day.has-events:hover .day-marker) {
                    border: 1.5px solid rgba(212,178,76,1) !important;
                    background: rgba(212,178,76,0.2) !important;
                    box-shadow: 0 0 20px rgba(212,178,76,0.4) !important;
                    opacity: 1;
                    transform: scale(1.02); /* Sutil pop */
                }

                .calendar-grid :global(.day-dots) {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 12px;
                    display: flex;
                    justify-content: center; /* Centrar dots también */
                    gap: 6px;
                    align-items: center;
                    z-index: 2;
                }
                .day-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 999px;
                    opacity: 0.95;
                }
                .dot-count {
                    font-size: 0.72rem;
                    color: #e2e8f0;
                    padding: 2px 7px;
                    border-radius: 999px;
                    border: 1px solid rgba(255,255,255,0.10);
                    background: rgba(255,255,255,0.03);
                }

                .dot-hearing { background: #ef4444; }
                .dot-filing  { background: #3b82f6; }
                .dot-meeting { background: #10b981; }
                .dot-other   { background: #94a3b8; }

                /* Tooltip flotante */
                .day-tooltip {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 340px;
                    max-height: 240px;
                    overflow: hidden;
                    border-radius: 14px;
                    background: rgba(15, 23, 42, 0.92);
                    border: 1px solid rgba(255,255,255,0.10);
                    box-shadow: 0 18px 60px rgba(0,0,0,0.35);
                    backdrop-filter: blur(12px);
                    padding: 12px;
                    z-index: 9999;
                    pointer-events: none;
                }
                .tt-head {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    margin-bottom: 10px;
                }
                .tt-date { color: #e2e8f0; font-weight: 800; text-transform: capitalize; }
                .tt-count { color: #94a3b8; font-size: 0.85rem; font-weight: 600; }
                .tt-list { display: flex; flex-direction: column; gap: 8px; }
                .tt-item { display: flex; gap: 10px; align-items: flex-start; }
                .tt-dot { width: 8px; height: 8px; border-radius: 999px; margin-top: 6px; }
                .tt-title { color: #e2e8f0; font-weight: 700; font-size: 0.92rem; line-height: 1.15; }
                .tt-meta { color: #94a3b8; font-size: 0.82rem; margin-top: 2px; }
                .tt-more { margin-top: 6px; color: #94a3b8; font-size: 0.82rem; }

                /* UPCOMING SIDEBAR (Task Rail) */
                .upcoming-panel {
                    padding: 1.2rem;
                    background: rgba(15, 23, 42, 0.6);
                    border-radius: 16px;
                    height: calc(100vh - 220px);   /* clave: columna alta */
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;             /* para que el scroll sea interno */
                }
                .upcoming-sticky {
                    position: sticky;
                    top: 0;
                    z-index: 5;
                    background: rgba(15, 23, 42, 0.75);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    padding-bottom: 0.8rem;
                    margin-bottom: 0.8rem;
                }
                .upcoming-title-row {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .upcoming-panel h3 {
                    margin: 0;
                    font-size: 1.15rem;
                    color: var(--primary);
                }
                .upcoming-mini {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                .pill {
                    font-size: 0.75rem;
                    color: #e2e8f0;
                    border: 1px solid rgba(255,255,255,0.08);
                    padding: 0.25rem 0.5rem;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.03);
                }
                .upcoming-filters {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 0.6rem;
                    margin-top: 0.8rem;
                }
                .segmented {
                    display: flex;
                    gap: 0.4rem;
                }
                .segmented button {
                    flex: 1;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #e2e8f0;
                    border-radius: 10px;
                    padding: 0.45rem 0.6rem;
                    cursor: pointer;
                }
                .segmented button.active {
                    border-color: rgba(212,178,76,0.45);
                    background: rgba(212,178,76,0.08);
                    color: #fff;
                }
                .select {
                    width: 100%;
                    padding: 0.55rem 0.7rem;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 10px;
                    color: #e2e8f0;
                    cursor: pointer;
                }
                .select option {
                    background-color: #0f172a;
                    color: #e2e8f0;
                }
                .check {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                    color: #94a3b8;
                    font-size: 0.85rem;
                }
                .upcoming-scroll {
                    overflow: auto;
                    padding-right: 6px; /* espacio para scrollbar */
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    padding-bottom: 2rem;
                }
                .section-title {
                    color: #94a3b8;
                    font-size: 0.75rem;
                    font-weight: 700;
                    margin: 0.5rem 0 0.8rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    padding-left: 4px;
                }
                .deadline-card {
                    display: flex;
                    gap: 0; /* Removed gap since priority indicator is gone */
                    padding: 1rem 1.1rem; /* Adjusted padding */
                    background: linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(30, 41, 59, 0.4) 100%);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 14px;
                    transition: all 0.2s ease-out;
                    position: relative;
                    overflow: hidden;
                }
                .deadline-card:hover {
                    background: rgba(30, 41, 59, 0.9);
                    border-color: rgba(255,255,255,0.15);
                    transform: translateY(-2px);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
                }
                .card-main {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding-left: 4px; /* Slight left padding for text */
                }
                .card-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.4rem;
                }
                .badge {
                    font-size: 0.65rem;
                    font-weight: 700;
                    padding: 0.25rem 0.6rem;
                    border-radius: 6px;
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #fff;
                    background: rgba(255,255,255,0.05);
                    letter-spacing: 0.03em;
                }
                .countdown {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #94a3b8;
                    background: rgba(0,0,0,0.2);
                    padding: 3px 10px;
                    border-radius: 6px;
                    white-space: nowrap; /* Prevent stacking */
                    display: inline-block;
                    line-height: 1;
                }
                .card-title {
                    color: #f8fafc;
                    font-weight: 600;
                    font-size: 1rem;
                    line-height: 1.3;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 0.2rem;
                }
                .card-client {
                    font-size: 0.8rem;
                    color: #fbbf24;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 0.3rem;
                    opacity: 0.9;
                }
                .tt-client {
                    font-size: 0.75rem; 
                    color: #fbbf24;
                    margin-top: 1px;
                }
                .card-meta {
                    color: #64748b;
                    font-size: 0.8rem;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .event-actions {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 0.2rem;
                    opacity: 0;
                    transition: 0.2s;
                    border-left: 1px solid rgba(255,255,255,0.05);
                    padding-left: 0.8rem;
                }
                .deadline-card:hover .event-actions {
                    opacity: 1;
                }
                .event-actions button {
                    background: rgba(255,255,255,0.05);
                    border: none;
                    cursor: pointer;
                    font-size: 0.9rem;
                    padding: 6px;
                    border-radius: 6px;
                    transition: background 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .event-actions button:hover {
                    background: rgba(255,255,255,0.1);
                    transform: scale(1.1);
                }
                /* urgencia: borde izquierdo de color en lugar de shadow interno */
                .deadline-card.urgency-overdue { border-left: 4px solid #ef4444; }
                .deadline-card.urgency-critical { border-left: 4px solid #f97316; }
                .deadline-card.urgency-high { border-left: 4px solid #f59e0b; }
                .deadline-card.urgency-medium { border-left: 4px solid #eab308; }

                .empty-state {
                    padding: 1rem;
                    border: 1px dashed rgba(255,255,255,0.12);
                    border-radius: 12px;
                    background: rgba(255,255,255,0.02);
                }
                .empty-title { color: #e2e8f0; font-weight: 700; }
                .empty-sub { color: #94a3b8; margin-top: 0.25rem; font-size: 0.85rem; }

                /* HISTORY PANEL */
                .history-panel {
                    margin-top: 2rem;
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 16px;
                    overflow: hidden;
                    backdrop-filter: blur(10px);
                }
                .history-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem 1.5rem;
                    cursor: pointer;
                    background: rgba(255,255,255,0.02);
                }
                .history-head:hover { background: rgba(255,255,255,0.04); }
                .history-title { display: flex; align-items: center; gap: 10px; }
                .history-title h3 { font-size: 1rem; color: #e2e8f0; margin: 0; }
                .history-title .count { font-size: 0.75rem; color: #94a3b8; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 10px; }
                .btn-toggle { background: transparent; border: none; color: var(--primary); font-size: 0.8rem; cursor: pointer; font-weight: 600; }
                
                .history-body {
                    max-height: 400px;
                    overflow-y: auto;
                    padding: 1.5rem;
                    border-top: 1px solid rgba(255,255,255,0.06);
                }
                .history-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 1rem;
                }
                .history-card {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.05);
                    padding: 1rem;
                    border-radius: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .history-card.status-done { border-left: 3px solid #10b981; }
                .history-card.status-deleted, .history-card.status-cancelled { border-left: 3px solid #ef4444; opacity: 0.7; }
                
                .card-info { display: flex; flex-direction: column; gap: 4px; }
                .card-info h4 { font-size: 0.9rem; color: #f1f5f9; margin: 0; }
                .card-info span { font-size: 0.75rem; color: #94a3b8; }
                .badge-status { 
                    font-size: 0.65rem; 
                    font-weight: 800; 
                    padding: 2px 6px; 
                    border-radius: 4px; 
                    width: fit-content;
                    margin-bottom: 4px;
                }
                .badge-status.done { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .badge-status.deleted, .badge-status.cancelled { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
                .empty-msg { text-align: center; color: #64748b; font-size: 0.9rem; padding: 2rem; }

                @media (max-width: 1024px) {
                    .agenda-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}
