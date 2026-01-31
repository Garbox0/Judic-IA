"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Calculator, AlertTriangle, RefreshCw, Calendar, Info } from 'lucide-react';
import '@/app/dashboard/calculators/calculators.css'; // Reuse existing styles

import UsageGuideDemo from '@/app/components/UsageGuideDemo';
import { demoManuals } from '@/app/lib/demoManuals';

export default function DemoCalculatorsPage() {
    // STATE: Indemnización
    const [ingreso, setIngreso] = useState('');
    const [egreso, setEgreso] = useState('');
    const [remuneracion, setRemuneracion] = useState('');
    const [resultadoIndem, setResultadoIndem] = useState(null);

    // STATE: Plazos
    const [fechaNotif, setFechaNotif] = useState('');
    const [diasPlazo, setDiasPlazo] = useState('');
    const [tipoPlazo, setTipoPlazo] = useState('habiles'); // habiles | corridos
    const [resultadoPlazo, setResultadoPlazo] = useState(null);

    // --- LOGIC: INDEMNIZACION ---
    const calcularIndemnizacion = (e) => {
        e.preventDefault();

        const fechaIngreso = new Date(ingreso);
        const fechaEgreso = new Date(egreso);
        const mejorRemuneracion = parseFloat(remuneracion);

        if (!ingreso || !egreso || !remuneracion) return;

        // Calcular Antigüedad en años
        const diffTime = Math.abs(fechaEgreso - fechaIngreso);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let antiguedad = Math.floor(diffDays / 365);

        const fraccionMeses = (diffDays % 365) / 30;

        // Regla: Fracción mayor a 3 meses cuenta como año extra
        if (fraccionMeses > 3) {
            antiguedad += 1;
        }

        // Mínimo 1 año de sueldo (Piso art 245)
        if (antiguedad < 1) antiguedad = 1;

        const indemnizacion = mejorRemuneracion * antiguedad;

        setResultadoIndem({
            antiguedadComputable: antiguedad,
            monto: indemnizacion
        });
    };

    const resetIndem = () => {
        setIngreso('');
        setEgreso('');
        setRemuneracion('');
        setResultadoIndem(null);
    };

    // --- LOGIC: PLAZOS ---
    const addBusinessDays = (startDate, days) => {
        let count = 0;
        const curDate = new Date(startDate);
        // Empezamos a contar desde el día SIGUIENTE a la notificación
        curDate.setDate(curDate.getDate() + 1);

        // Reset
        let daysAdded = 0;
        const d = new Date(startDate);
        d.setDate(d.getDate() + 1); // Start counting tomorrow

        while (daysAdded < days) {
            // Avanzar día por día checkeando si es hábil
            // Si es hábil, increments daysAdded.
            // Si llegamos a daysAdded === days, ese es el día final (si es hábil).

            const day = d.getDay();
            const isWeekend = (day === 6 || day === 0);

            if (!isWeekend) {
                daysAdded++;
            }

            if (daysAdded < days) {
                d.setDate(d.getDate() + 1);
            }
        }

        // Si TERMINAMOS en un día inhábil (imposible con la lógica arriba salvo feriados manuales que no tenemos),
        // pero chequear por si acaso si cayó Sábado/Domingo (e.g. si days=0)
        while (d.getDay() === 6 || d.getDay() === 0) {
            d.setDate(d.getDate() + 1);
        }

        return d;
    };

    const addCalendarDays = (startDate, days) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + 1 + parseInt(days));
        // Vamos a usar setDate(notif + dias).
        const result = new Date(startDate);
        result.setDate(result.getDate() + parseInt(days));

        // CHECK FIN DE SEMANA (Prorroga automática)
        while (result.getDay() === 6 || result.getDay() === 0) {
            result.setDate(result.getDate() + 1);
        }

        return result;
    };

    const calcularPlazo = (e) => {
        e.preventDefault();
        if (!fechaNotif || !diasPlazo) return;

        // Parse local date strictly to avoid timezone shifts
        const [y, m, d] = fechaNotif.split('-');
        const startDate = new Date(y, m - 1, d); // Local midnight

        let fechaVencimiento;
        const dias = parseInt(diasPlazo);

        if (tipoPlazo === 'habiles') {
            fechaVencimiento = addBusinessDays(startDate, dias);
        } else {
            fechaVencimiento = addCalendarDays(startDate, dias);
        }

        setResultadoPlazo(fechaVencimiento);
    };

    const resetPlazo = () => {
        setFechaNotif('');
        setDiasPlazo('');
        setResultadoPlazo(null);
    };


    return (
        <div className="tools-container">
            <nav className="tools-nav">
                <div className="breadcrumb">
                    <Link href="/demo/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Calculadoras (Demo)</span>
                </div>
            </nav>

            <header className="tools-header">
                <div className="header-content">
                    <h1><Calculator size={48} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.8rem', color: '#8b5cf6' }} /> Calculadoras Jurídicas</h1>
                    <p>Herramientas de precisión para el ejercicio profesional.</p>
                </div>
                <UsageGuideDemo content={demoManuals.calculators} />
            </header>

            <div className="tools-grid">

                {/* --- CALCULADORA DE PLAZOS --- */}
                <div className="tool-card glass-panel" style={{ borderColor: '#8b5cf6' }}> {/* Purple tint */}
                    <div className="tool-header">
                        <Calendar size={24} className="text-violet-400" />
                        <h3>Calculadora de Plazos Procesales</h3>
                    </div>

                    <form onSubmit={calcularPlazo} className="tool-form">
                        <div className="form-group">
                            <label>Fecha de Notificación</label>
                            <input
                                type="date"
                                value={fechaNotif}
                                onChange={(e) => setFechaNotif(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Plazo (Días)</label>
                            <input
                                type="number"
                                min="1"
                                placeholder="Ej: 5, 10, 15"
                                value={diasPlazo}
                                onChange={(e) => setDiasPlazo(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group full">
                            <label>Tipo de Cómputo</label>
                            <div className="radio-group">
                                <label className={`radio-option ${tipoPlazo === 'habiles' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="tipoPlazo"
                                        value="habiles"
                                        checked={tipoPlazo === 'habiles'}
                                        onChange={() => setTipoPlazo('habiles')}
                                    />
                                    Días Hábiles (Judiciales)
                                </label>
                                <label className={`radio-option ${tipoPlazo === 'corridos' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="tipoPlazo"
                                        value="corridos"
                                        checked={tipoPlazo === 'corridos'}
                                        onChange={() => setTipoPlazo('corridos')}
                                    />
                                    Días Corridos (Civiles)
                                </label>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button type="button" onClick={resetPlazo} className="btn-reset">
                                <RefreshCw size={16} /> Limpiar
                            </button>
                            <button type="submit" className="btn-calculate violet">
                                Calcular Vencimiento
                            </button>
                        </div>
                    </form>

                    {resultadoPlazo && (
                        <div className="result-panel fade-in violet-theme">
                            <div className="result-row total">
                                <span>Vencimiento:</span>
                                <strong>
                                    {resultadoPlazo.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </strong>
                            </div>
                            <div className="result-sub">
                                <Info size={14} />
                                <span>
                                    + Dos primeras horas del día hábil siguiente:
                                    <strong> {(() => {
                                        const nextDay = new Date(resultadoPlazo);
                                        nextDay.setDate(nextDay.getDate() + 1); // Get real next calendar day
                                        while (nextDay.getDay() === 6 || nextDay.getDay() === 0) { // Skip weekend if grace period falls there
                                            nextDay.setDate(nextDay.getDate() + 1);
                                        }
                                        return nextDay.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
                                    })()} 9:30 AM
                                    </strong>
                                </span>
                            </div>
                        </div>
                    )}
                </div>


                {/* --- CALCULADORA INDEMNIZACION 245 LCT --- */}
                <div className="tool-card glass-panel">
                    <div className="tool-header">
                        <Calculator size={24} className="text-amber-400" />
                        <h3>Indemnización por Despido (Art. 245 LCT)</h3>
                    </div>

                    <form onSubmit={calcularIndemnizacion} className="tool-form">
                        <div className="form-group">
                            <label>Fecha de Ingreso</label>
                            <input
                                type="date"
                                value={ingreso}
                                onChange={(e) => setIngreso(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Fecha de Egreso</label>
                            <input
                                type="date"
                                value={egreso}
                                onChange={(e) => setEgreso(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group full">
                            <label>Mejor Remuneración (Bruta)</label>
                            <div className="input-prefix">
                                <span>$</span>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={remuneracion}
                                    onChange={(e) => setRemuneracion(e.target.value)}
                                    step="0.01"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-actions">
                            <button type="button" onClick={resetIndem} className="btn-reset">
                                <RefreshCw size={16} /> Limpiar
                            </button>
                            <button type="submit" className="btn-calculate">
                                Calcular Estimación
                            </button>
                        </div>
                    </form>

                    {resultadoIndem && (
                        <div className="result-panel fade-in">
                            <div className="result-row">
                                <span>Antigüedad Computable:</span>
                                <strong>{resultadoIndem.antiguedadComputable} años</strong>
                            </div>
                            <div className="result-row total">
                                <span>Indemnización Estimada:</span>
                                <strong>${resultadoIndem.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                            <div className="disclaimer-mini">
                                <AlertTriangle size={12} />
                                <span>Cálculo meramente estimativo. No reemplaza liquidación contable.</span>
                            </div>
                        </div>
                    )}
                </div>

            </div>


        </div>
    );
}
