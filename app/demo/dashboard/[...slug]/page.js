"use client";
import React from 'react';
import { Construction } from 'lucide-react';

export default function DemoPlaceholderPage({ params }) {
    // We can access the slug to show which page is being simulated if we want
    // const slug = params.slug;

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
            <Construction size={64} className="mb-4 text-emerald-400" />
            <h2 className="text-2xl font-bold text-slate-200 mb-2">Funcionalidad en Desarrollo (Demo)</h2>
            <p className="max-w-md">
                Esta sección del panel de demostración aún está en construcción.
                Pronto podrás explorar esta funcionalidad con datos de prueba.
            </p>
            <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-sm font-mono text-emerald-400">
                    Disponible actualmente:<br />
                    ✓ Panel Principal (Dashboard)<br />
                    ✓ Clientes (Clients)
                </p>
            </div>
        </div>
    );
}
