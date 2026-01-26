"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Calculator, AlertTriangle, RefreshCw, Calendar, Info } from 'lucide-react';

export default function CalculatorsPage() {
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

        // Ajuste inicial si el día siguiente cae en fin de semana (aunque la lógica del while lo maneja,
        // es conceptualmente correcto empezar el conteo en día hábil? 
        // Normalmente: se cuenta el día, si es inhábil no se cuenta.

        while (count < days) {
            const day = curDate.getDay();
            if (day !== 0 && day !== 6) { // 0=Sun, 6=Sat
                count++;
            }
            if (count < days) { // Solo avanzamos si no hemos terminado
                curDate.setDate(curDate.getDate() + 1);
            }
        }

        // Si caemos en fin de semana AL FINAL, feriado judicial? 
        // Simplificación: Si cae sábado o domingo, pasa al lunes.
        // OJO: La lógica del while avanza HASTA completar los días hábiles.
        // Si el último día agregado fue Viernes (count llegó a days), curDate es Viernes.
        // Si el último conteo cayó en un día válido, ahí nos quedamos.
        // Pero el loop anterior tiene un pequeño bug lógico común "fencepost".

        // CORRECCIÓN LÓGICA ROBUSTA:
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
        d.setDate(d.getDate() + 1 + parseInt(days)); // Empezamos a contar mañana, así que +1 y +dias? 
        // No, plazos corridos: fecha + dias. Pero art 6 CCyC: "día siguiente".
        // Entonces fecha + dias (si fecha es hoy, mañana es dia 1). 
        // Ejemplo: Notificado Lunes 1. Plazo 5 días. Vence Sábado 6 (que se pasa al Lunes 8).
        // Corrección: Fecha + Dias. Lunes 1 + 5 = 6.
        // Verificación de cargo: Si vence Sábado/Do, pasa a Lunes.

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
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Calculadoras</span>
                </div>
            </nav>

            <header className="tools-header">
                <div className="header-content">
                    <h1><Calculator size={48} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.8rem', color: '#8b5cf6' }} /> Calculadoras Jurídicas</h1>
                    <p>Herramientas de precisión para el ejercicio profesional.</p>
                </div>
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

            <style jsx>{`
                .tools-container { padding: 0 3rem 3rem; max-width: 1200px; margin: 0 auto; color: white; }
                
                @media (max-width: 900px) {
                    .tools-container { padding: 0 1.5rem 2rem; }
                }

                .breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 2rem; color: #94a3b8; }
                .breadcrumb-item { color: #94a3b8; text-decoration: none; transition: 0.2s; }
                .breadcrumb-item:hover { color: #fbbf24; }
                .breadcrumb-separator { opacity: 0.5; }
                .breadcrumb-current { color: #fbbf24; font-weight: 600; }

                .tools-header { margin-bottom: 3rem; }
                .header-content h1 { font-size: 2rem; margin-bottom: 0.5rem; }
                .header-content p { color: #94a3b8; margin-bottom: 1.5rem; }

                .tools-grid { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); 
                    gap: 2rem; 
                }

                .tool-card { 
                    padding: 2rem; 
                    background: rgba(30, 41, 59, 0.4);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 20px;
                    backdrop-filter: blur(12px);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .tool-card:hover { transform: translateY(-3px); box-shadow: 0 10px 40px rgba(0,0,0,0.2); }

                .tool-header {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    margin-bottom: 2rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .tool-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #e2e8f0;
                }

                .tool-form {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .form-group.full { grid-column: 1 / -1; }

                label { font-size: 0.85rem; color: #94a3b8; font-weight: 500; }

                input {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 0.8rem;
                    border-radius: 8px;
                    color: white;
                    outline: none;
                    font-family: inherit;
                    width: 100%;
                }

                input:focus { border-color: #fbbf24; }

                .input-prefix {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .input-prefix span {
                    position: absolute;
                    left: 1rem;
                    color: #94a3b8;
                }
                .input-prefix input { padding-left: 2rem; }

                /* Radio Group for Types */
                .radio-group {
                    display: flex;
                    gap: 1rem;
                    margin-top: 0.2rem;
                }
                .radio-option {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.6rem 1rem;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    cursor: pointer;
                    border: 1px solid transparent;
                    transition: 0.2s;
                }
                .radio-option.active {
                    background: rgba(139, 92, 246, 0.15);
                    border-color: #8b5cf6;
                    color: #c4b5fd;
                }
                .radio-option input { width: auto; margin: 0; }

                .form-actions {
                    grid-column: 1 / -1;
                    display: flex;
                    gap: 1rem;
                    margin-top: 1rem;
                }

                .btn-calculate {
                    flex: 1;
                    background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
                    color: #020617;
                    border: none;
                    padding: 0.8rem;
                    border-radius: 8px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: 0.2s;
                }
                
                .btn-calculate:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3); }

                .btn-calculate.violet {
                    background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
                }
                .btn-calculate.violet:hover { box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); }

                .btn-reset {
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #94a3b8;
                    padding: 0.8rem 1.2rem;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .btn-reset:hover { color: white; border-color: white; }

                .result-panel {
                    margin-top: 2rem;
                    padding: 1.5rem;
                    background: rgba(251, 191, 36, 0.05);
                    border: 1px solid rgba(251, 191, 36, 0.2);
                    border-radius: 12px;
                    animation: fadeIn 0.3s ease;
                }

                .result-panel.violet-theme {
                    background: rgba(139, 92, 246, 0.05);
                    border-color: rgba(139, 92, 246, 0.2);
                }

                .result-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.8rem;
                    font-size: 0.95rem;
                    color: #e2e8f0;
                }

                .result-row.total {
                    margin-top: 1rem;
                    margin-bottom: 0;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    font-size: 1.2rem;
                    color: #fbbf24;
                }
                
                .violet-theme .result-row.total { color: #c4b5fd; text-transform: capitalize; }

                .result-sub {
                    margin-top: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    color: #a78bfa;
                    padding: 0.5rem 0.8rem;
                    background: rgba(139, 92, 246, 0.1);
                    border-radius: 6px;
                }

                .disclaimer-mini {
                    margin-top: 1rem;
                    display: flex;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    color: #94a3b8;
                    align-items: center;
                    opacity: 0.7;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 600px) {
                    .tool-form { grid-template-columns: 1fr; }
                    .form-actions { flex-direction: column-reverse; }
                }
            `}</style>
        </div>
    );
}
