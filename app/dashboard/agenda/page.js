"use client";
import React from 'react';
import Link from 'next/link';

export default function AgendaPage() {
    return (
        <div className="agenda-container">
            <nav className="agenda-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Agenda Judicial</span>
                </div>
            </nav>

            <header className="agenda-header">
                <div className="header-flex">
                    <div className="header-icon-box">📅</div>
                    <div className="header-text">
                        <h1 className="dashboard-page-title">Agenda y Plazos</h1>
                        <p>Controla tus audiencias, plazos procesales y recordatorios importantes.</p>
                    </div>
                </div>
            </header>

            <div className="content-box glass-panel">
                <div className="placeholder-content">
                    <div className="empty-icon">⏳</div>
                    <h3>Seguimiento de Plazos</h3>
                    <p>Estamos integrando el calendario para que nunca más se te pase un vencimiento judicial.</p>
                    <button className="btn-premium">Configurar Alertas</button>
                </div>
            </div>

            <style jsx>{`
                .agenda-container {
                    padding: 0 3rem 3rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .agenda-nav { margin-bottom: 3rem; }


                .agenda-header { margin-bottom: 4rem; }
                .header-flex { display: flex; align-items: center; gap: 2.5rem; }
                .header-icon-box {
                    width: 90px;
                    height: 90px;
                    background: rgba(16, 185, 129, 0.05);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    border-radius: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3rem;
                    box-shadow: 0 0 30px rgba(0,0,0,0.3);
                }
                .header-text p { color: var(--muted); font-size: 1.2rem; }

                .content-box {
                    padding: 5rem 3rem;
                    border-radius: 32px;
                    text-align: center;
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .placeholder-content .empty-icon { font-size: 5rem; margin-bottom: 2rem; opacity: 0.4; filter: contrast(1.2); }
                .placeholder-content h3 { font-size: 2.2rem; color: white; margin-bottom: 1.2rem; font-weight: 700; }
                .placeholder-content p { color: var(--muted); font-size: 1.15rem; max-width: 550px; margin: 0 auto 2.5rem; line-height: 1.6; }
                
                .btn-premium {
                    background: #10b981;
                    color: white;
                    padding: 1rem 2.5rem;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 1.1rem;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s;
                    box-shadow: 0 10px 20px rgba(16, 185, 129, 0.2);
                }
                .btn-premium:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 15px 30px rgba(16, 185, 129, 0.3);
                    filter: brightness(1.1);
                }
            `}</style>
        </div>
    );
}
