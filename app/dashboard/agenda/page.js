"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import EventModal from '../../components/dashboard/EventModal';
import {
    Calendar,
    Bell,
    User,
    Check,
    Trash2,
    FileClock,
    ChevronDown,
    ChevronUp,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';
import './agenda.css';

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
                    <h1 className="dashboard-page-title"><Calendar size={32} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.8rem', color: '#fbbf24' }} /> Agenda Jurídica</h1>
                    <p className="subtitle">Gestión de vencimientos, audiencias y plazos procesales.</p>
                </div>
                <button className="btn-primary" onClick={() => setModalOpen(true)}>
                    + Nuevo Evento
                </button>
                <UsageGuide content={dashboardManuals.agenda} />
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
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bell size={18} /> Plazos</h3>
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
                                <div className="empty-title">No hay plazos en este rango <CheckCircle size={16} style={{ display: 'inline' }} /></div>
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
                                                <div className="card-client" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {ev.inquiries.contact_name}</div>
                                            )}

                                            <div className="card-title">{ev.title}</div>
                                            <div className="card-meta">
                                                {new Date(ev.due_date).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        <div className="event-actions">
                                            <button onClick={() => markAsDone(ev.id)} title="Marcar completado"><Check size={14} /></button>
                                            <button onClick={() => deleteEvent(ev.id)} title="Eliminar"><Trash2 size={14} /></button>
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
                                                <div className="card-client" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {ev.inquiries.contact_name}</div>
                                            )}

                                            <div className="card-title">{ev.title}</div>
                                            <div className="card-meta">
                                                {new Date(ev.due_date).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' })} • {new Date(ev.due_date).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </div>
                                        </div>

                                        <div className="event-actions">
                                            <button onClick={() => markAsDone(ev.id)} title="Marcar completado"><Check size={14} /></button>
                                            <button onClick={() => deleteEvent(ev.id)} title="Eliminar"><Trash2 size={14} /></button>
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
                                                <div className="card-client" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {ev.inquiries.contact_name}</div>
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
                                        <div className="tt-client" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={10} /> {ev.inquiries.contact_name}</div>
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
                        <span className="icon"><FileClock size={20} /></span>
                        <h3>Historial de Plazos</h3>
                        <span className="count">
                            {deadlines.filter(ev => ev.status !== 'pending').length} archivados
                        </span>
                    </div>
                    <button className="btn-toggle">{showHistory ? <><ChevronDown size={14} /> Ocultar</> : <><ChevronUp size={14} /> Ver Historial</>}</button>
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
                                                    <span className={`badge-status ${ev.status}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                                                        {ev.status === 'done' ? <><CheckCircle size={10} /> COMPLETADO</> : <><XCircle size={10} /> ELIMINADO</>}
                                                    </span>
                                                    <h4>{ev.title}</h4>
                                                    <span className="date" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Calendar size={12} /> Venció: {new Date(ev.due_date).toLocaleDateString()}
                                                    </span>
                                                    <span className="timestamp" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Clock size={12} /> {ev.status === 'done' ? 'Completado' : 'Eliminado'} el: {new Date(ev.done_at || ev.deleted_at).toLocaleDateString()}
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


        </div>
    );
}
