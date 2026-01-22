"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { demoProfile } from '../../lib/demoData'; // Corrected path
import {
    LogOut,
    Scale,
    Users,
    FolderOpen,
    CalendarClock,
    Settings,
    BookOpen,
    ShieldCheck,
    Menu,
    Crown,
    Sparkles
} from 'lucide-react';
import SafeChatWidget from '../../components/SafeChatWidget'; // Corrected path

import './demo.css'; // Renamed css

export default function DemoDashboardLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    // FORCE DEMO STATE
    const isDemo = true;
    const basePath = '/demo/dashboard';

    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState({ email: 'demo@judicia.com', id: 'demo' });
    const [profile, setProfile] = useState(demoProfile);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // No Auth Check effect needed for Demo

    // Helper to get display name
    const getDisplayName = () => "Dr. Martínez";

    // Helper to get initials
    const getInitials = () => "DM";

    // Helper for links
    const getLink = (path) => {
        return path.replace('/dashboard', basePath);
    };

    return (
        <div className="dashboard-layout demo-mode">
            {/* MOBILE OVERLAY */}
            {mobileSidebarOpen && (
                <div
                    className="mobile-sidebar-overlay"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            {/* MOBILE HEADER */}
            <div className="mobile-header">
                <button
                    className="mobile-toggle-btn"
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Abrir menú"
                >
                    <Menu size={20} />
                </button>
                <span className="mobile-brand">Judic-IA <span className="demo-badge">DEMO</span></span>
            </div>

            {/* SIDEBAR */}
            <aside className={`sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
                <div className="logo-section">
                    <div className="logo-link" style={{ cursor: 'default' }}>
                        <h1>Judic-IA</h1>
                        <span className="demo-tag">Modo Demo</span>
                    </div>

                    <div className="plan-badge">
                        <span className="plan-inline"><Crown size={14} /> PRO SUITE</span>
                    </div>
                </div>

                <nav className="nav-links">
                    <Link href={`${basePath}/research`} className={`nav-item ${pathname.includes('/research') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
                        <Scale size={18} className="nav-icon" />
                        <span>Jurisprudencia</span>
                    </Link>
                    <Link href={`${basePath}/clients`} className={`nav-item ${pathname.includes('/clients') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
                        <Users size={18} className="nav-icon" />
                        <span>Clientes</span>
                    </Link>
                    <Link href={`${basePath}/cases`} className={`nav-item ${pathname.includes('/cases') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
                        <FolderOpen size={18} className="nav-icon" />
                        <span>Expedientes</span>
                    </Link>
                    <Link href={`${basePath}/agenda`} className={`nav-item ${pathname.includes('/agenda') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
                        <CalendarClock size={18} className="nav-icon" />
                        <span>Plazos</span>
                    </Link>
                    <Link href={`${basePath}/settings`} className={`nav-item ${pathname.includes('/settings') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
                        <Settings size={18} className="nav-icon" />
                        <span>Ajustes</span>
                    </Link>
                    <Link href={`${basePath}/library`} className={`nav-item ${pathname.includes('/library') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
                        <BookOpen size={18} className="nav-icon" />
                        <span>Biblioteca</span>
                    </Link>
                </nav>

                <div style={{ padding: '1rem', marginTop: 'auto' }}>
                    <Link href="/" className="btn-primary" style={{ display: 'block', textAlign: 'center', fontSize: '0.8rem', padding: '0.5rem' }}>
                        Salir de Demo
                    </Link>
                </div>

                <div className="user-profile">
                    <div className="user-avatar">
                        {getInitials()}
                    </div>
                    <div className="profile-info">
                        <span className="user-name">{getDisplayName()}</span>
                        <span className="user-email">{user?.email}</span>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="main-viewport">
                {children}
            </main>
        </div>
    );
}
