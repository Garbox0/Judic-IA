"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Building2, LayoutDashboard, Inbox, Users, BarChart2,
    Scale, Settings, LogOut, Menu, X, Sun, Moon, ArrowLeft, Coins,
    Search, Archive, CreditCard
} from 'lucide-react';
import '../../../dashboard/estudio/estudio-dashboard.css';

export default function DemoEstudioLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [theme, setTheme] = useState('light');

    useEffect(() => {
        try {
            const t = localStorage.getItem('app-theme') || 'light';
            setTheme(t);
        } catch { }
    }, []);

    useEffect(() => {
        if (theme === 'light') document.body.classList.add('light-theme');
        else document.body.classList.remove('light-theme');
        try { localStorage.setItem('app-theme', theme); } catch { }
    }, [theme]);

    const orgName = 'Estudio Martínez & Asociados';
    const planLabel = 'Enterprise M';
    const roleLabel = 'Titular';
    const displayName = 'Dr. Martínez';
    const initials = 'DM';

    const navItems = [
        { href: '/demo/dashboard/estudio', label: 'Resumen', icon: LayoutDashboard, exact: true },
        { href: '/demo/dashboard/estudio/bandeja', label: 'Bandeja', icon: Inbox },
        { href: '/demo/dashboard/estudio/supervision', label: 'Supervisión', icon: BarChart2 },
        { href: '/demo/dashboard/estudio/buscar', label: 'Buscar', icon: Search },
        { href: '/demo/dashboard/estudio/archivados', label: 'Archivados', icon: Archive },
        { href: '/demo/dashboard/estudio/miembros', label: 'Miembros', icon: Users },
        { href: '/demo/dashboard/estudio/creditos', label: 'Créditos', icon: Coins },
        { href: '/demo/dashboard/estudio/suscripcion', label: 'Suscripción', icon: CreditCard },
    ];

    const externalItems = [
        { href: '/demo/dashboard/research', label: 'Investigación', icon: Scale },
        { href: '/demo/dashboard/settings', label: 'Ajustes', icon: Settings },
    ];

    const isActive = (href, exact = false) => exact
        ? pathname === href
        : pathname.startsWith(href);

    return (
        <div className={`estudio-layout ${theme === 'light' ? 'light-theme' : ''}`}>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className="estudio-mobile-overlay" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Mobile header */}
            <div className="estudio-mobile-header">
                <button className="estudio-mobile-toggle" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
                    <Menu size={20} />
                </button>
                <span className="estudio-mobile-brand">{orgName}</span>
                <button className="estudio-mobile-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label="Cambiar tema">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`estudio-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Navegación del estudio">
                {sidebarOpen && (
                    <button
                        onClick={() => setSidebarOpen(false)}
                        style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 4 }}
                        aria-label="Cerrar menú"
                    >
                        <X size={18} />
                    </button>
                )}

                <div className="estudio-logo-section">
                    <h1 title={orgName}>{orgName}</h1>
                    <div className="estudio-plan-badge">
                        <Building2 size={10} /> {planLabel}
                    </div>
                    <span className="demo-badge" style={{
                        background: 'rgba(251, 191, 36, 0.1)',
                        color: '#fbbf24',
                        padding: '2px 6px',
                        borderRadius: '99px',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        marginTop: '6px',
                        display: 'inline-block',
                        border: '1px solid rgba(251, 191, 36, 0.2)'
                    }}>MODO DEMO</span>
                </div>

                <nav className="estudio-nav" aria-label="Menú del estudio">
                    <span className="estudio-nav-divider">Panel</span>
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${isActive(item.href, item.exact) ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <item.icon size={18} className="nav-icon" />
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    <span className="estudio-nav-divider" style={{ marginTop: 8 }}>Herramientas</span>
                    {externalItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="nav-item nav-external"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <item.icon size={18} className="nav-icon" />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="estudio-user-section">
                    <div className="estudio-user-row">
                        <div className="estudio-user-avatar">{initials}</div>
                        <div className="estudio-user-info">
                            <span className="estudio-user-name">{displayName}</span>
                            <span className="estudio-user-role">{roleLabel}</span>
                        </div>
                        <button
                            className="estudio-logout-btn"
                            title="Cerrar sesión"
                            aria-label="Cerrar sesión"
                            onClick={() => {
                                router.push('/');
                            }}
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                    <Link href="/demo/dashboard" className="estudio-back-link" onClick={() => setSidebarOpen(false)}>
                        <ArrowLeft size={13} /> Volver a mi panel
                    </Link>
                </div>
            </aside>

            {/* Main content */}
            <main className="estudio-main" id="estudio-main-content">
                <div className="estudio-content-scroll">
                    <div className="estudio-content-wrapper">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
