"use client";
import React from 'react';
import dynamic from 'next/dynamic';

const AuthFormContent = dynamic(() => import('./AuthFormContent'), {
    ssr: false,
    loading: () => <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: 'white' }}>Cargando módulo de seguridad...</div>
});

export default function AuthClient() {
    return (
        <AuthFormContent />
    );
}
