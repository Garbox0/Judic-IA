"use client";
import React from 'react';
import { Construction, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function DemoPlaceholderPage() {
    const availableDemos = [
        { name: 'Clientes', path: '/demo/dashboard/clients' },
        { name: 'Expedientes', path: '/demo/dashboard/cases' },
        { name: 'Agenda', path: '/demo/dashboard/agenda' },
        { name: 'Jurisprudencia', path: '/demo/dashboard/research' },
        { name: 'Jurisprudencias', path: '/demo/dashboard/library' },
        { name: 'Calculadoras', path: '/demo/dashboard/calculators' },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
            <Construction size={64} className="mb-4 text-emerald-400 animate-pulse" />
            <h2 className="text-2xl font-bold text-slate-200 mb-2">Sección Limitada en Demo</h2>
            <p className="max-w-md mb-8">
                Esta funcionalidad específica no tiene una simulación interactiva habilitada todavía.
                Por favor, explora las secciones principales que ya están activas con datos de prueba.
            </p>

            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700 w-full max-w-md">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-700 pb-2">
                    Demos Disponibles
                </h3>
                <div className="grid grid-cols-1 gap-2 text-left">
                    {availableDemos.map((demo) => (
                        <Link
                            key={demo.path}
                            href={demo.path}
                            className="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded-lg transition-colors group"
                        >
                            <CheckCircle size={16} className="text-emerald-400" />
                            <span className="text-slate-300 group-hover:text-emerald-300 font-medium">
                                {demo.name}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
