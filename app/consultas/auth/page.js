import React, { Suspense } from 'react';
import AuthClient from './AuthClient';

// FORCE DYNAMIC RENDERING TO BYPASS BUILD ERROR
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function ClientAuthPage() {
    return (
        <Suspense fallback={<div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>Cargando acceso seguro...</div>}>
            <AuthClient />
        </Suspense>
    );
}
