"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { demoDeadlines } from '@/app/lib/demoData';

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


export default function DemoAgendaPage() {
    const isDemo = true;
    const basePath = '/demo/dashboard';

    const [date, setDate] = useState(new Date());
    const [view, setView] = useState('month'); // 'month', 'week', 'day', 'list'
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
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


    useEffect(() => {
        // MOCK DATA LOADING
        const mappedDemoEvents = demoDeadlines.map(d => ({
            id: d.id,
            title: d.title,
            start: new Date(d.due_date),
            end: new Date(new Date(d.due_date).getTime() + 60 * 60 * 1000), // assume 1 hour duration
            type: d.type || 'hearing',
            status: d.status,
            description: d.description,
            location: 'Tribunal', // Mock location
            priority: d.priority,
            due_date: d.due_date,
            inquiries: { contact_name: "Cliente Demo" }
        }));

        // Simular delay
        setTimeout(() => {
            setEvents(mappedDemoEvents);
            setLoading(false);
        }, 500);

    }, [date, view]);


    const handleMonthChange = (increment) => {
        setDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + increment);
            return newDate;
        });
    };

    // Logic calculation
    const now = new Date();
    const todayISO = toISODate(now);

    const pending = events.filter(d => d.status === "pending");

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

    const year = date.getFullYear();
    const month = date.getMonth();
    const monthName = date.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
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
        const dayEvents = events.filter(ev => ev.due_date && ev.due_date.startsWith(dateStr) && ev.status === 'pending');
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
                    <Link href={basePath} className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Agenda Jurídica</span>
                </div>
            </nav>

            <header className="agenda-header">
                <div>
                    <h1 className="dashboard-page-title">📅 Agenda Jurídica (Demo)</h1>
                    <p className="subtitle">Gestión de vencimientos, audiencias y plazos procesales.</p>
                </div>
                <button className="btn-primary" onClick={() => alert("Función de demostración")}>
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
                                            <button onClick={() => { }} title="Marcar completado (Demo)">✅</button>
                                            <button onClick={() => { }} title="Eliminar (Demo)">🗑️</button>
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
                                            <button onClick={() => { }} title="Marcar completado">✅</button>
                                            <button onClick={() => { }} title="Eliminar">🗑️</button>
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
                                            <button onClick={() => { }} title="Marcar completado">✅</button>
                                            <button onClick={() => { }} title="Eliminar">🗑️</button>
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

                @media (max-width: 1024px) {
                    .agenda-grid {
                        grid-template-columns: 1fr;
                    }
                    .upcoming-panel {
                        height: auto;
                        max-height: 500px;
                    }
                }

                @media (max-width: 768px) {
                    .agenda-container {
                        padding: 0 1.5rem 2rem;
                    }
                    .calendar-day {
                        min-height: 80px;
                    }
                    .calendar-grid :global(.day-number) {
                        font-size: 1.2rem !important;
                    }
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
                @media (max-width: 500px) {
                    .calendar-grid :global(.calendar-day) { min-height: 80px; padding: 4px; }
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
                    color: white;
                    font-size: 1.1rem;
                }
                .upcoming-mini { display: flex; gap: 5px; flex-wrap: wrap; }
                .pill { font-size: 0.75rem; color: var(--muted); background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; }

                .upcoming-filters {
                    display: flex;
                    flex-direction: column;
                    gap: 0.8rem;
                }
                .segmented { display: flex; background: rgba(0,0,0,0.2); padding: 2px; border-radius: 8px; }
                .segmented button {
                    flex: 1; background: transparent; border: none; color: var(--muted); padding: 4px; font-size: 0.8rem; cursor: pointer; border-radius: 6px;
                }
                .segmented button.active { background: rgba(255,255,255,0.1); color: white; font-weight: 600; }

                .select {
                    background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 6px; border-radius: 6px; font-size: 0.85rem;
                }
                .check { font-size: 0.85rem; color: var(--muted); display: flex; align-items: center; gap: 6px; cursor: pointer; }

                .upcoming-scroll {
                    overflow-y: auto;
                    flex: 1;
                    padding-right: 4px;
                }
                /* Scrollbar fina */
                .upcoming-scroll::-webkit-scrollbar { width: 4px; }
                .upcoming-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

                .section { margin-bottom: 1.5rem; }
                .section-title {
                    font-size: 0.8rem; text-transform: uppercase; color: var(--muted); letter-spacing: 1px; margin-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;
                }

                .deadline-card {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 10px;
                    padding: 10px;
                    margin-bottom: 0.8rem;
                    transition: 0.2s;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 10px;
                }
                .deadline-card:hover {
                    background: rgba(255,255,255,0.06);
                    transform: translateX(2px);
                }
                .urgency-overdue { border-left: 3px solid #ef4444; background: rgba(239, 68, 68, 0.05); }
                .urgency-critical { border-left: 3px solid #f97316; }
                .urgency-high { border-left: 3px solid #eab308; }

                .card-main { flex: 1; }
                .card-top { display: flex; justify-content: space-between; margin-bottom: 4px; }
                .badge { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: #e2e8f0; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; }
                .countdown { font-size: 0.7rem; color: #94a3b8; font-weight: 600; }
                
                .card-client { font-size: 0.75rem; color: #60a5fa; margin-bottom: 2px; }
                .card-title { font-size: 0.9rem; font-weight: 600; color: white; line-height: 1.2; margin-bottom: 4px; }
                .card-meta { font-size: 0.75rem; color: var(--muted); }

                .event-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    opacity: 0;
                    transition: 0.2s;
                }
                .deadline-card:hover .event-actions { opacity: 1; }
                .event-actions button {
                    background: transparent;
                    border: none;
                    font-size: 1rem;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                }
                .event-actions button:hover { background: rgba(255,255,255,0.1); }

                .empty-state { text-align: center; padding: 2rem; color: var(--muted); opacity: 0.6; }
                .empty-title { font-size: 1rem; color: white; margin-bottom: 0.5rem; }
                .empty-sub { font-size: 0.8rem; }
            `}</style>
        </div>
    );
}
