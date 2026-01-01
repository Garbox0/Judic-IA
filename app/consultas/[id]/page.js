import { Suspense, use } from 'react';
import dynamicImport from 'next/dynamic';

const IntakeClient = dynamicImport(() => import('./IntakeClient'), {
    ssr: false,
    loading: () => <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: 'white' }}>Cargando Asistente Legal...</div>
});

// FORCE DYNAMIC RENDERING TO BYPASS BUILD ERROR
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function SmartIntakePage({ params }) {
    const { id } = use(params);

    return (
        <IntakeClient id={id} />
    );
}
