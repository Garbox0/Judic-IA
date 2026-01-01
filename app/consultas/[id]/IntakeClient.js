"use client";
import React from 'react';
import dynamic from 'next/dynamic';

const IntakeFormContent = dynamic(() => import('./IntakeFormContent'), {
    ssr: false,
    loading: () => <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: 'white' }}>Cargando Asistente Legal...</div>
});

export default function IntakeClient({ id }) {
    return (
        <IntakeFormContent id={id} />
    );
}
