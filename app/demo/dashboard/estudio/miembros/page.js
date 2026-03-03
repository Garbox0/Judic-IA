"use client";
import React from 'react';

export default function DemoEstudioMiembrosPage() {
    return (
        <div className="estudio-page-header">
            <h1 className="estudio-page-title">Gestión de Miembros</h1>
            <p className="estudio-page-sub">Invitá, remové y cambiá roles de los abogados de tu estudio.</p>

            <div className="estudio-card" style={{ marginTop: 24, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <h3>Modo Demo</h3>
                <p>Acá vas a poder generar enlaces de invitación para que tus colegas se unan a la plataforma bajo tu licencia Enterprise.</p>
            </div>
        </div>
    );
}
