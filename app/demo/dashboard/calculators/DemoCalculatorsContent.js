"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calculator, AlertTriangle, RefreshCw, Calendar, Info, Clock, CheckCircle2 } from 'lucide-react';
import UsageGuideDemo from '@/app/components/UsageGuideDemo';
import { demoManuals } from '@/app/lib/demoManuals';
import { isJudicialBusinessDay, addJudicialBusinessDays } from '@/app/lib/dateUtils';
import '@/app/dashboard/calculators/calculators.css';

export default function DemoCalculatorsContent() {
    // STATE: Indemnización
    const [ingreso, setIngreso] = useState('');
    const [egreso, setEgreso] = useState('');
    const [remuneracion, setRemuneracion] = useState('');
    const [includeSAC, setIncludeSAC] = useState(false);
    const [includeVacations, setIncludeVacations] = useState(false);
    const [includePreaviso, setIncludePreaviso] = useState(false);
    const [resultadoIndem, setResultadoIndem] = useState(null);

    // STATE: Plazos
    const [fechaNotif, setFechaNotif] = useState('');
    const [diasPlazo, setDiasPlazo] = useState('');
    const [tipoPlazo, setTipoPlazo] = useState('habiles'); // habiles | corridos
    const [resultadoPlazo, setResultadoPlazo] = useState(null);

    // --- LOGIC: INDEMNIZACION ---
    useEffect(() => {
        calcularIndemnizacion();
    }, [ingreso, egreso, remuneracion, includeSAC, includeVacations, includePreaviso]);

    const calcularIndemnizacion = (e) => {
        if (e) e.preventDefault();

        const fechaIngreso = new Date(ingreso);
        const fechaEgreso = new Date(egreso);
        const mejorRemuneracion = parseFloat(remuneracion);

        if (!ingreso || !egreso || !remuneracion) {
            setResultadoIndem(null);
            return;
        }

        // --- 1. Antigüedad Art. 245 ---
        const diffTime = Math.abs(fechaEgreso - fechaIngreso);
        const diffDaysTotal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let antiguedadAnos = Math.floor(diffDaysTotal / 365);
        const fraccionMeses = (diffDaysTotal % 365) / 30;
        if (fraccionMeses > 3) antiguedadAnos += 1;
        if (antiguedadAnos < 1) antiguedadAnos = 1;

        const monto245 = mejorRemuneracion * antiguedadAnos;

        // --- 2. Preaviso (Indemnización Substitutiva) ---
        let montoPreaviso = 0;
        let sacSobrePreaviso = 0;
        if (includePreaviso) {
            // Lógica simplificada: 1 mes si < 5 años, 2 meses si > 5 años.
            const mesesPreaviso = antiguedadAnos >= 5 ? 2 : 1;
            montoPreaviso = mejorRemuneracion * mesesPreaviso;
            sacSobrePreaviso = montoPreaviso / 12;
        }

        // --- 3. SAC Proporcional ---
        let montoSAC = 0;
        if (includeSAC) {
            const currentYear = fechaEgreso.getFullYear();
            const semesterStart = fechaEgreso.getMonth() < 6 ? new Date(currentYear, 0, 1) : new Date(currentYear, 6, 1);
            const daysInSemester = Math.max(0, Math.ceil((fechaEgreso - Math.max(fechaIngreso, semesterStart)) / (1000 * 60 * 60 * 24)));
            montoSAC = (mejorRemuneracion / 2) * (daysInSemester / 182.5);
        }

        // --- 4. Vacaciones Proporcionales ---
        let montoVacaciones = 0;
        let sacSobreVacaciones = 0;
        if (includeVacations) {
            // Días según antigüedad
            let diasVacaciones = 14;
            if (antiguedadAnos >= 5) diasVacaciones = 21;
            if (antiguedadAnos >= 10) diasVacaciones = 28;
            if (antiguedadAnos >= 20) diasVacaciones = 35;

            const startOfLastYear = new Date(fechaEgreso.getFullYear(), 0, 1);
            const workedInYear = Math.max(0, Math.ceil((fechaEgreso - Math.max(fechaIngreso, startOfLastYear)) / (1000 * 60 * 60 * 24)));

            const diasProporcionales = (diasVacaciones * workedInYear) / 365;
            montoVacaciones = (mejorRemuneracion / 25) * diasProporcionales;
            sacSobreVacaciones = montoVacaciones / 12;
        }

        const totalFinal = monto245 + montoPreaviso + sacSobrePreaviso + montoSAC + montoVacaciones + sacSobreVacaciones;

        setResultadoIndem({
            antiguedad: antiguedadAnos,
            monto245,
            montoPreaviso,
            sacSobrePreaviso,
            montoSAC,
            montoVacaciones,
            sacSobreVacaciones,
            total: totalFinal
        });
    };

    const resetIndem = () => {
        setIngreso('');
        setEgreso('');
        setRemuneracion('');
        setIncludeSAC(false);
        setIncludeVacations(false);
        setIncludePreaviso(false);
        setResultadoIndem(null);
    };

    // --- LOGIC: PLAZOS ---
    useEffect(() => {
        calcularPlazo();
    }, [fechaNotif, diasPlazo, tipoPlazo]);

    const addCalendarDays = (startDate, days) => {
        const result = new Date(startDate);
        result.setDate(result.getDate() + parseInt(days));

        // CHECK IF IT ENDS ON NON-BUSINESS DAY (Prorroga automática / Cargo)
        while (!isJudicialBusinessDay(result)) {
            result.setDate(result.getDate() + 1);
        }

        return result;
    };

    const calcularPlazo = (e) => {
        if (e) e.preventDefault();
        if (!fechaNotif || !diasPlazo) {
            setResultadoPlazo(null);
            return;
        }

        // Parse local date strictly to avoid timezone shifts
        const [y, m, d] = fechaNotif.split('-');
        const startDate = new Date(y, m - 1, d); // Local midnight

        let fechaVencimiento;
        const dias = parseInt(diasPlazo);

        if (tipoPlazo === 'habiles') {
            fechaVencimiento = addJudicialBusinessDays(startDate, dias);
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
                        </div>
                    </form>

                    {resultadoPlazo && (
                        <div className="result-panel fade-in violet-theme">
                            <div className="result-label">VENCIMIENTO PROCESAL</div>
                            <div className="result-main-date">
                                {resultadoPlazo.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>

                            <div className="grace-period-box">
                                <div className="grace-head">
                                    <Clock size={16} />
                                    <span>Plazo de Gracia (Cargo)</span>
                                </div>
                                <div className="grace-body">
                                    Hasta el <strong>{(() => {
                                        const nextDay = new Date(resultadoPlazo);
                                        nextDay.setDate(nextDay.getDate() + 1);
                                        // Use the robust utility to find the next business day
                                        while (!isJudicialBusinessDay(nextDay)) {
                                            nextDay.setDate(nextDay.getDate() + 1);
                                        }
                                        return nextDay.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
                                    })()} de 7:30 a 9:30 hs</strong>
                                </div>
                            </div>

                            <div className="disclaimer-mini" style={{ marginTop: '1.5rem' }}>
                                <Info size={14} />
                                <span>El cómputo contempla fines de semana, feriados nacionales y periodos de feria judicial argentina 2026.</span>
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

                        <div className="form-group full">
                            <label>Rubros Adicionales (Opcionales)</label>
                            <div className="checkbox-grid">
                                <label className={`check-option ${includePreaviso ? 'active' : ''}`}>
                                    <input type="checkbox" checked={includePreaviso} onChange={() => setIncludePreaviso(!includePreaviso)} />
                                    <span>Indemnización por Preaviso</span>
                                </label>
                                <label className={`check-option ${includeSAC ? 'active' : ''}`}>
                                    <input type="checkbox" checked={includeSAC} onChange={() => setIncludeSAC(!includeSAC)} />
                                    <span>SAC Proporcional</span>
                                </label>
                                <label className={`check-option ${includeVacations ? 'active' : ''}`}>
                                    <input type="checkbox" checked={includeVacations} onChange={() => setIncludeVacations(!includeVacations)} />
                                    <span>Vacaciones Proporcionales</span>
                                </label>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button type="button" onClick={resetIndem} className="btn-reset">
                                <RefreshCw size={16} /> Limpiar
                            </button>
                        </div>
                    </form>

                    {resultadoIndem && (
                        <div className="result-panel breakdown fade-in amber-theme">
                            <div className="result-header">Desglose de la Liquidación</div>
                            <div className="result-breakdown">
                                <div className="result-row">
                                    <span>Antigüedad computable:</span>
                                    <span>{resultadoIndem.antiguedad} años</span>
                                </div>
                                <div className="result-row standout">
                                    <span>Indemnización por Antigüedad (Art. 245):</span>
                                    <span>$ {resultadoIndem.monto245.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>

                                {includePreaviso && (
                                    <div className="rubric-group">
                                        <div className="result-row">
                                            <span>Sustitutiva del Preaviso:</span>
                                            <span>$ {resultadoIndem.montoPreaviso.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="result-row ind">
                                            <span>+ SAC sobre Preaviso:</span>
                                            <span>$ {resultadoIndem.sacSobrePreaviso.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                )}

                                {includeSAC && (
                                    <div className="result-row">
                                        <span>SAC Proporcional:</span>
                                        <span>$ {resultadoIndem.montoSAC.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}

                                {includeVacations && (
                                    <div className="rubric-group">
                                        <div className="result-row">
                                            <span>Vacaciones No Gozadas:</span>
                                            <span>$ {resultadoIndem.montoVacaciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="result-row ind">
                                            <span>+ SAC sobre Vacaciones:</span>
                                            <span>$ {resultadoIndem.sacSobreVacaciones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="result-row total">
                                <span>TOTAL INDEMNIZATORIO:</span>
                                <strong>$ {resultadoIndem.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                            </div>

                            <div className="disclaimer-mini">
                                <AlertTriangle size={12} />
                                <span>Estimación basada en LCT. No incluye multas (Ley 24.013, 25.323, etc.)</span>
                            </div>
                        </div>
                    )}
                </div>

            </div>


        </div>
    );
}
