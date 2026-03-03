"use client";
import React from 'react';

export default function DemoEstudioCreditosPage() {
    return (
        <div className="estudio-page-header">
            <h1 className="estudio-page-title">Consumo de Créditos</h1>
            <p className="estudio-page-sub">Historial de uso del pool de créditos del estudio.</p>

            <div className="estudio-card" style={{ marginTop: 24, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <h3>Modo Demo</h3>
                <p>Llevá el control de qué abogado consumió créditos para alertas e importación de casos en el mes en curso.</p>
            </div>
        </div>
    );
}
