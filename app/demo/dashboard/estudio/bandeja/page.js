"use client";
import React from 'react';

export default function DemoEstudioBandejaPage() {
    return (
        <div className="estudio-page-header">
            <h1 className="estudio-page-title">Bandeja Compartida</h1>
            <p className="estudio-page-sub">Causas que ingresan al Estudio y pendientes de asignación.</p>

            <div className="estudio-card" style={{ marginTop: 24, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <h3>Modo Demo</h3>
                <p>En la versión final podrás ver aquí todos los expedientes centralizados del estudio y asignarlos al abogado correspondiente.</p>
            </div>
        </div>
    );
}
