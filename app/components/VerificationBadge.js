'use client';

import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

/**
 * VerificationBadge - Displays lawyer verification status
 * @param {string} status - 'pending' | 'verified' | 'rejected'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} showLabel - Whether to show text label
 */
export default function VerificationBadge({ status = 'pending', size = 'md', showLabel = true }) {
    const sizes = {
        sm: { icon: 12, text: 'text-[9px]', padding: 'px-2 py-1', gap: 'gap-1' },
        md: { icon: 14, text: 'text-[10px]', padding: 'px-3 py-1.5', gap: 'gap-1.5' },
        lg: { icon: 16, text: 'text-xs', padding: 'px-4 py-2', gap: 'gap-2' }
    };

    const config = {
        pending: {
            icon: ShieldQuestion,
            label: 'Pendiente de Verificación',
            className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
            glow: 'shadow-[0_0_10px_rgba(251,191,36,0.1)]'
        },
        verified: {
            icon: ShieldCheck,
            label: 'Abogado Verificado',
            className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
            glow: 'shadow-[0_0_10px_rgba(16,185,129,0.15)]'
        },
        rejected: {
            icon: ShieldAlert,
            label: 'No Verificado',
            className: 'bg-red-500/10 text-red-400 border-red-500/30',
            glow: 'shadow-[0_0_10px_rgba(239,68,68,0.1)]'
        }
    };

    const current = config[status] || config.pending;
    const sizeConfig = sizes[size] || sizes.md;
    const Icon = current.icon;

    return (
        <div
            className={`
                inline-flex items-center ${sizeConfig.gap} ${sizeConfig.padding}
                rounded-full border font-black uppercase tracking-widest
                ${current.className} ${current.glow}
                transition-all duration-300 hover:scale-105
            `}
            title={current.label}
        >
            <Icon size={sizeConfig.icon} strokeWidth={2.5} />
            {showLabel && (
                <span className={sizeConfig.text}>
                    {status === 'pending' && 'Pendiente'}
                    {status === 'verified' && 'Verificado'}
                    {status === 'rejected' && 'No Verificado'}
                </span>
            )}
        </div>
    );
}
