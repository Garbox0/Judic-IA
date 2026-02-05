"use client";
import { Lock, Crown, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import './trial-expired-block.css';

/**
 * Componente de bloqueo cuando el trial venció.
 * Se muestra en lugar del contenido de funciones premium (Research, Legislation).
 * 
 * NOTA: Este bloqueo es solo UX. La seguridad real está en el backend.
 */
export default function TrialExpiredBlock({ featureName = "esta función" }) {
    return (
        <div className="trial-expired-container">
            <div className="trial-expired-card glass-panel">
                <div className="trial-expired-icon">
                    <Lock size={48} />
                </div>

                <h2 className="trial-expired-title">
                    Tu período de prueba venció
                </h2>

                <p className="trial-expired-desc">
                    El acceso gratuito a <strong>{featureName}</strong> ha finalizado.
                    Suscribite al Plan Profesional para continuar utilizando todas las
                    herramientas de investigación y legislación sin límites.
                </p>

                <div className="trial-expired-features">
                    <div className="feature-item">
                        <Crown size={16} className="text-amber-400" />
                        <span>Jurisprudencia ilimitada</span>
                    </div>
                    <div className="feature-item">
                        <Crown size={16} className="text-amber-400" />
                        <span>Biblioteca legislativa completa</span>
                    </div>
                    <div className="feature-item">
                        <Crown size={16} className="text-amber-400" />
                        <span>Asistente IA sin restricciones</span>
                    </div>
                </div>

                <Link href="/dashboard/settings?tab=billing" className="trial-expired-cta">
                    <span>Activar Plan Profesional</span>
                    <ArrowRight size={18} />
                </Link>

                <p className="trial-expired-price">
                    Solo <strong>$25.000/mes</strong> • Cancela cuando quieras
                </p>
            </div>
        </div>
    );
}
