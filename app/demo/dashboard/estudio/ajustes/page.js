"use client";
import React from 'react';

export default function DemoEstudioAjustesPage() {
    return (
        <div className="estudio-page-header">
            <h1 className="estudio-page-title">Ajustes del Estudio</h1>
            <p className="estudio-page-sub">Panel de administración de suscripciones, plan y datos del estudio.</p>

            <div className="estudio-card" style={{ marginTop: 24, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <h3>Modo Demo</h3>
                <p>En este sector, podés modificar la Razón Social y administrar qué plan de tipo Enterprise se adapta mejor al tamaño de tu estudio.</p>
            </div>
        </div>
    );
}
