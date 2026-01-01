import React from 'react';
import AuthClient from './AuthClient';

// FORCE DYNAMIC RENDERING
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function ClientAuthPage() {
    return (
        <AuthClient />
    );
}
