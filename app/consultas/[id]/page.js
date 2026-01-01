import { Suspense, use } from 'react';
import IntakeClient from './IntakeClient';

// FORCE DYNAMIC RENDERING TO BYPASS BUILD ERROR
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function SmartIntakePage({ params }) {
    const { id } = use(params);

    return (
        <Suspense fallback={<div className="loading-screen">Iniciando asistente...</div>}>
            <IntakeClient id={id} />
        </Suspense>
    );
}
