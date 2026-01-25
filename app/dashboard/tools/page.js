"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Calculator, AlertTriangle, RefreshCw } from 'lucide-react';

export default function ToolsPage() {
    const [ingreso, setIngreso] = useState('');
    const [egreso, setEgreso] = useState('');
    const [remuneracion, setRemuneracion] = useState('');
    const [resultado, setResultado] = useState(null);

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

        setResultado({
            antiguedadComputable: antiguedad,
            monto: indemnizacion
        });
    };

    const reset = () => {
        setIngreso('');
        setEgreso('');
        setRemuneracion('');
        setResultado(null);
    };

    return (
        <div className="tools-container">
            <nav className="tools-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Herramientas de Cálculo</span>
                </div>
            </nav>

            <header className="tools-header">
                <div className="header-content">
                    <h1>🧮 Calculadoras Jurídicas</h1>
                    <p>Herramientas de estimación para liquidaciones laborales y civiles.</p>
                </div>
            </header>

            <div className="tools-grid">
                {/* CALCULADORA INDEMNIZACION 245 LCT */}
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
                            <button type="button" onClick={reset} className="btn-reset">
                                <RefreshCw size={16} /> Limpiar
                            </button>
                            <button type="submit" className="btn-calculate">
                                Calcular Estimación
                            </button>
                        </div>
                    </form>

                    {resultado && (
                        <div className="result-panel fade-in">
                            <div className="result-row">
                                <span>Antigüedad Computable:</span>
                                <strong>{resultado.antiguedadComputable} años</strong>
                            </div>
                            <div className="result-row total">
                                <span>Indemnización Estimada:</span>
                                <strong>${resultado.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                            <div className="disclaimer-mini">
                                <AlertTriangle size={12} />
                                <span>Cálculo meramente estimativo. No reemplaza liquidación contable oficial.</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* PLACEHOLDER FOR FUTURE TOOLS */}
                <div className="tool-card glass-panel placeholder">
                    <h3>Proximamente...</h3>
                    <p>Calculadora de Intereses Judiciales</p>
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
                }

                .tool-card.placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border-style: dashed;
                    opacity: 0.5;
                }

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
                    border-top: 1px solid rgba(251, 191, 36, 0.2);
                    font-size: 1.2rem;
                    color: #fbbf24;
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
                }
            `}</style>
        </div>
    );
}
