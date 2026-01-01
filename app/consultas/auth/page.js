import React, { Suspense } from 'react';
import dynamicImport from 'next/dynamic';

const AuthClient = dynamicImport(() => import('./AuthClient'), {
    ssr: false,
    loading: () => <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: 'white' }}>Cargando módulo de seguridad...</div>
});

// FORCE DYNAMIC RENDERING TO BYPASS BUILD ERROR
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function ClientAuthPage() {
    return (
        <AuthClient />
    );
}
