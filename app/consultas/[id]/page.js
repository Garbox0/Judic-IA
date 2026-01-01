import { use } from 'react';
import IntakeClient from './IntakeClient';

// FORCE DYNAMIC RENDERING
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function SmartIntakePage({ params }) {
    const { id } = use(params);

    return (
        <IntakeClient id={id} />
    );
}
