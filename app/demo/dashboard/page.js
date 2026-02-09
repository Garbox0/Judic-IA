"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { demoStats } from '../../lib/demoData'; // Adjusted Path
import {
    Search,
    Users,
    FolderOpen,
    Calendar,
    BookOpen,
    Settings,
    Globe
} from 'lucide-react';
import UsageGuideDemo from '@/app/components/UsageGuideDemo';
import { demoManuals } from '@/app/lib/demoManuals';

export default function DemoDashboardHome() {
    const isDemo = true;
    const basePath = '/demo/dashboard';
    const user = { user_metadata: { first_name: 'Dr. Martínez' } };
    const stats = demoStats;

    // Helper to adjust links
    const getLink = (path) => {
        return path.replace('/dashboard', basePath);
    };

    const tools = [
        {
            id: 'research',
            title: 'Jurisprudencia',
            desc: 'Consulta normativa, códigos y fallos con IA.',
            icon: <Search size={24} />,
            link: '/dashboard/research',
            color: 'var(--gold)'
        },
        {
            id: 'clients',
            title: 'Clientes',
            desc: 'Administra tus consultas y contactos entrantes.',
            icon: <Users size={24} />,
            link: '/dashboard/clients',
            color: '#6366f1'
        },
        {
            id: 'cases',
            title: 'Expedientes',
            desc: 'Gestión centralizada de tus casos oficiales.',
            icon: <FolderOpen size={24} />,
            link: '/dashboard/cases',
            color: '#3b82f6'
        },
        {
            id: 'agenda',
            title: 'Plazos',
            desc: 'Controla tus fechas, plazos y audiencias.',
            icon: <Calendar size={24} />,
            link: '/dashboard/agenda',
            color: '#10b981'
        },
        {
            id: 'library',
            title: 'Biblioteca',
            desc: 'Base de conocimiento y precedentes guardados.',
            icon: <BookOpen size={24} />,
            link: '/dashboard/library',
            color: '#a855f7'
        },
        {
            id: 'federal',
            title: 'Hub Federal',
            desc: 'Bus-Justicia y red de corresponsalía nacional.',
            icon: <Globe size={24} />,
            link: '/dashboard/federal',
            color: 'var(--accent)'
        },
        {
            id: 'settings',
            title: 'Ajustes',
            desc: 'Configuración de perfil, firma y facturación.',
            icon: <Settings size={24} />,
            link: '/dashboard/settings',
            color: '#94a3b8'
        }
    ];

    return (
        <div className="dashboard-container demo-mode">

            <div className="breadcrumb">
                <span className="breadcrumb-current">Gabinete de {user?.user_metadata?.first_name}</span>
            </div>

            <header className="dashboard-header">
                <h2>Hola, {user?.user_metadata?.first_name}</h2>
                <div className="header-stats">
                    <span className="flex-item-center-gap-5"><Calendar size={16} /> <b>{stats.deadlines}</b> vencimientos hoy</span>
                    <span className="flex-item-center-gap-5"><Users size={16} /> <b>{stats.clients}</b> clientes activos</span>
                </div>
                <UsageGuideDemo content={demoManuals.dashboard} />
            </header>

            <section className="dashboard-grid">
                {tools.map((tool, index) => (
                    <Link href={getLink(tool.link)} key={tool.id} className="dashboard-card-link">
                        <div className={`dashboard-card ${index === 0 ? 'primary' : ''}`}>
                            <div className="card-icon">
                                {tool.icon}
                            </div>
                            <div>
                                <h3>{tool.title}</h3>
                                <p>{tool.desc}</p>
                            </div>
                        </div>
                    </Link>
                ))}
            </section>

        </div>
    );
}
