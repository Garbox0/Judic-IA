"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Building2, LayoutDashboard, Inbox, Users, BarChart2,
    Scale, Settings, LogOut, Menu, X, Sun, Moon, ArrowLeft
} from 'lucide-react';
import '../../../dashboard/estudio/estudio-dashboard.css';

export default function DemoEstudioLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [theme, setTheme] = useState('light');

    useEffect(() => {
        const savedTheme = localStorage.getItem('app-theme') || 'light';
        setTheme(savedTheme);
    }, []);

    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    }, [theme]);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('app-theme', newTheme);
    };

    const navItems = [
        { label: 'Volver al Inicio', href: '/demo/dashboard', icon: ArrowLeft, bottomBorder: true },
        { label: 'Resumen', href: '/demo/dashboard/estudio', icon: LayoutDashboard },
        { label: 'Bandeja de Causas', href: '/demo/dashboard/estudio/bandeja', icon: Inbox },
        { label: 'Miembros', href: '/demo/dashboard/estudio/miembros', icon: Users },
        { label: 'Uso y Créditos', href: '/demo/dashboard/estudio/creditos', icon: BarChart2 },
        { label: 'Ajustes de Estudio', href: '/demo/dashboard/estudio/ajustes', icon: Settings }
    ];

    return (
        <div className={`estudio-layout ${theme === 'light' ? 'light-theme' : ''}`}>

            {/* SIDEBAR */}
            <aside className={`estudio-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="estudio-sidebar-header">
                    <Building2 size={24} className="estudio-brand-icon" />
                    <div>
                        <span className="estudio-brand-name">Estudio Demo</span>
                        <span className="estudio-brand-tag">Plan Enterprise M</span>
                    </div>
                </div>

                <nav className="estudio-nav">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`estudio-nav-item ${pathname === item.href ? 'active' : ''} ${item.bottomBorder ? 'border-b border-white/5 pb-4 mb-4' : ''}`}
                        >
                            <item.icon size={18} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="estudio-sidebar-footer">
                    <div className="estudio-user">
                        <div className="estudio-avatar">DM</div>
                        <div className="estudio-user-info">
                            <span className="estudio-user-name">Dr. Martínez</span>
                            <span className="estudio-user-role">Titular</span>
                        </div>
                        <button className="estudio-logout" aria-label="Cerrar sesión de demo">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* MOBILE OVERLAY */}
            {mobileMenuOpen && (
                <div className="estudio-mobile-overlay" onClick={() => setMobileMenuOpen(false)}></div>
            )}

            {/* MAIN VIEW */}
            <main className="estudio-main">
                {/* TOPBAR */}
                <header className="estudio-topbar">
                    <div className="estudio-topbar-left">
                        <button className="estudio-mobile-btn" onClick={() => setMobileMenuOpen(true)}>
                            <Menu size={20} />
                        </button>
                        <h2 className="estudio-topbar-title">Administración del Estudio</h2>
                        <span className="estudio-demo-badge" style={{
                            background: 'rgba(251, 191, 36, 0.1)',
                            color: '#fbbf24',
                            padding: '2px 8px',
                            borderRadius: '99px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            marginLeft: '12px',
                            border: '1px solid rgba(251, 191, 36, 0.2)'
                        }}>MODO DEMO</span>
                    </div>

                    <div className="estudio-topbar-right">
                        <button className="estudio-theme-btn" onClick={toggleTheme}>
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <div className="estudio-topbar-avatar">DM</div>
                    </div>
                </header>

                {/* CONTENT SCOPE */}
                <div className="estudio-content-scroll">
                    <div className="estudio-content-wrapper">
                        {children}
                    </div>
                </div>
            </main>

        </div>
    );
}
