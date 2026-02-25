"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Search,
    Loader2,
    FileText,
    ExternalLink,
    ShieldCheck,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Building2,
    Hash,
    Calendar,
    User
} from 'lucide-react';
import './pjn-search.css';

// PJN Jurisdiction options (value → label)
const JURISDICTIONS = [
    { value: '', label: 'Seleccionar cámara...' },
    { value: '0', label: 'CSJ - Corte Suprema de Justicia de la Nación' },
    { value: '1', label: 'CIV - Cámara Nacional de Apelaciones en lo Civil' },
    { value: '2', label: 'CAF - Cámara Nac. Apel. Contencioso Administrativo Federal' },
    { value: '3', label: 'COM - Cámara Nacional de Apelaciones en lo Comercial' },
    { value: '4', label: 'CNE - Cámara Nacional Electoral' },
    { value: '5', label: 'CSS - Cámara Federal de la Seguridad Social' },
    { value: '6', label: 'CCC - Cámara Nac. Apel. en lo Criminal y Correccional' },
    { value: '7', label: 'CPE - Cámara Nac. de Casación en lo Criminal y Correccional' },
    { value: '8', label: 'CFP - Cámara Criminal y Correccional Federal' },
    { value: '9', label: 'TRA - Cámara Nacional de Apelaciones del Trabajo' },
    { value: '25', label: 'FRO - Justicia Federal de Rosario' },
    { value: '26', label: 'FLP - Justicia Federal de La Plata' },
    { value: '27', label: 'FBB - Justicia Federal de Bahía Blanca' },
    { value: '28', label: 'FPO - Justicia Federal de Posadas' },
    { value: '29', label: 'FPA - Justicia Federal de Paraná' },
    { value: '30', label: 'FCO - Justicia Federal de Córdoba' },
    { value: '31', label: 'FMZ - Justicia Federal de Mendoza' },
    { value: '32', label: 'FTU - Justicia Federal de Tucumán' },
    { value: '33', label: 'FRE - Justicia Federal de Resistencia' },
    { value: '34', label: 'FGR - Justicia Federal de General Roca' },
    { value: '35', label: 'FSM - Justicia Federal de San Martín' },
    { value: '36', label: 'FMA - Justicia Federal de Mar del Plata' },
    { value: '37', label: 'FSA - Justicia Federal de Salta' },
    { value: '38', label: 'FCR - Justicia Federal de Comodoro Rivadavia' },
    { value: '39', label: 'FCA - Justicia Federal de Corrientes' },
    { value: '40', label: 'FCT - Justicia Federal de Catamarca' },
    { value: '41', label: 'FSJ - Justicia Federal de San Juan' },
    { value: '42', label: 'FSL - Justicia Federal de San Luis' },
    { value: '43', label: 'FSE - Justicia Federal de Santiago del Estero' },
    { value: '44', label: 'FJU - Justicia Federal de Jujuy' },
    { value: '45', label: 'FRF - Justicia Federal de Rawson' },
    { value: '46', label: 'FLR - Justicia Federal de La Rioja' },
    { value: '47', label: 'FFO - Justicia Federal de Formosa' },
    { value: '48', label: 'FRG - Justicia Federal de Río Gallegos' },
    { value: '49', label: 'FUS - Justicia Federal de Ushuaia' },
    { value: '50', label: 'FZA - Justicia Federal de Zárate-Campana' },
    { value: '51', label: 'FMO - Justicia Federal de Morón' },
    { value: '52', label: 'FAZ - Justicia Federal de Azul' },
    { value: '53', label: 'FLO - Justicia Federal de Lomas de Zamora' },
];

export default function PJNSearchPanel() {
    // ── State ──
    const [searchType, setSearchType] = useState('expediente'); // 'expediente' | 'parte'
    const [jurisdiction, setJurisdiction] = useState('');
    const [numero, setNumero] = useState('');
    const [anio, setAnio] = useState('');
    const [nombre, setNombre] = useState('');

    const [captchaToken, setCaptchaToken] = useState('');
    const [captchaStatus, setCaptchaStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'

    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [searched, setSearched] = useState(false);

    const captchaContainerRef = useRef(null);
    const iframeLoadedRef = useRef(false);

    // ── Captcha Widget Init ──
    useEffect(() => {
        // Load the PJN captcha init.js script which creates the iframe
        if (iframeLoadedRef.current) return;
        iframeLoadedRef.current = true;

        const container = captchaContainerRef.current;
        if (!container) return;

        // Ensure the container has the class the init.js expects
        container.classList.add('pjn-captcha');

        // Create the hidden input the widget writes the token to
        let responseInput = document.getElementById('captcha-response');
        if (!responseInput) {
            responseInput = document.createElement('input');
            responseInput.type = 'hidden';
            responseInput.id = 'captcha-response';
            responseInput.name = 'captcha-response';
            container.parentElement.appendChild(responseInput);
        }

        setCaptchaStatus('loading');

        // Load init.js — it will find .pjn-captcha and inject the iframe
        const script = document.createElement('script');
        script.src = 'https://captcha.pjn.gov.ar/api/init.js?sitekey=SCW';
        script.async = true;
        script.onload = () => {
            setCaptchaStatus('ready');
        };
        script.onerror = () => {
            setCaptchaStatus('error');
        };
        document.head.appendChild(script);

        // Listen for postMessage from the captcha widget
        const handleMessage = (event) => {
            if (event.origin !== 'https://captcha.pjn.gov.ar') return;

            // The widget sends the token via postMessage
            if (event.data && typeof event.data === 'string' && event.data.length > 10) {
                setCaptchaToken(event.data);
                setCaptchaStatus('ready');
            }
        };

        window.addEventListener('message', handleMessage);

        // Also poll the hidden input for changes (fallback)
        const pollInterval = setInterval(() => {
            const input = document.getElementById('captcha-response');
            if (input && input.value && input.value.length > 10) {
                setCaptchaToken(input.value);
                clearInterval(pollInterval);
            }
        }, 500);

        return () => {
            window.removeEventListener('message', handleMessage);
            clearInterval(pollInterval);
        };
    }, []);

    // ── Search Handler ──
    const handleSearch = useCallback(async (e) => {
        if (e) e.preventDefault();

        if (!captchaToken) {
            setError('⚠️ Resolvé el captcha antes de buscar.');
            return;
        }

        if (searchType === 'expediente' && (!numero || !anio)) {
            setError('Completá el número y año del expediente.');
            return;
        }

        if (searchType === 'parte' && !nombre.trim()) {
            setError('Completá el nombre de la parte.');
            return;
        }

        setLoading(true);
        setError('');
        setResults(null);
        setSearched(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;

            const res = await fetch('/api/pjn/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
                },
                body: JSON.stringify({
                    searchType,
                    captchaToken,
                    jurisdiction,
                    numero,
                    anio,
                    nombre: nombre.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error al consultar el PJN.');
                return;
            }

            setResults(data);

            if (data.error) {
                setError(data.error);
            }

        } catch (err) {
            setError('Error de conexión. Verificá tu internet.');
        } finally {
            setLoading(false);
        }
    }, [captchaToken, searchType, jurisdiction, numero, anio, nombre]);

    // ── Reset captcha for new search ──
    const resetCaptcha = useCallback(() => {
        setCaptchaToken('');
        setCaptchaStatus('loading');
        setResults(null);
        setSearched(false);
        setError('');

        // Remove old iframe and reload  
        const container = captchaContainerRef.current;
        if (container) {
            container.innerHTML = '';
        }

        const responseInput = document.getElementById('captcha-response');
        if (responseInput) responseInput.value = '';

        // Re-load init.js
        iframeLoadedRef.current = false;

        const oldScript = document.querySelector('script[src*="captcha.pjn.gov.ar"]');
        if (oldScript) oldScript.remove();

        setTimeout(() => {
            const script = document.createElement('script');
            script.src = `https://captcha.pjn.gov.ar/api/init.js?sitekey=SCW&t=${Date.now()}`;
            script.async = true;
            script.onload = () => setCaptchaStatus('ready');
            script.onerror = () => setCaptchaStatus('error');
            document.head.appendChild(script);
            iframeLoadedRef.current = true;

            // Re-poll
            const pollInterval = setInterval(() => {
                const input = document.getElementById('captcha-response');
                if (input && input.value && input.value.length > 10) {
                    setCaptchaToken(input.value);
                    clearInterval(pollInterval);
                }
            }, 500);

            // Cleanup after 60s
            setTimeout(() => clearInterval(pollInterval), 60000);
        }, 300);
    }, []);

    // ── Render ──
    return (
        <div className="pjn-search-container">
            {/* HEADER */}
            <div className="pjn-search-header">
                <div className="pjn-search-title">
                    <Building2 size={22} />
                    <h3>Consulta SCW — Poder Judicial de la Nación</h3>
                </div>
                <p className="pjn-search-subtitle">
                    Buscá expedientes directamente en el Sistema de Consultas Web del PJN.
                    Resolvé el captcha y consultá por expediente o por parte.
                </p>
            </div>

            <form onSubmit={handleSearch} className="pjn-search-form">
                {/* SEARCH TYPE TABS */}
                <div className="pjn-tabs">
                    <button
                        type="button"
                        className={`pjn-tab ${searchType === 'expediente' ? 'active' : ''}`}
                        onClick={() => setSearchType('expediente')}
                    >
                        <Hash size={16} />
                        Por Expediente
                    </button>
                    <button
                        type="button"
                        className={`pjn-tab ${searchType === 'parte' ? 'active' : ''}`}
                        onClick={() => setSearchType('parte')}
                    >
                        <User size={16} />
                        Por Parte
                    </button>
                </div>

                {/* FORM FIELDS */}
                <div className="pjn-fields">
                    <div className="pjn-field pjn-field-full">
                        <label>Cámara / Jurisdicción</label>
                        <select
                            value={jurisdiction}
                            onChange={(e) => setJurisdiction(e.target.value)}
                        >
                            {JURISDICTIONS.map(j => (
                                <option key={j.value} value={j.value}>{j.label}</option>
                            ))}
                        </select>
                    </div>

                    {searchType === 'expediente' ? (
                        <>
                            <div className="pjn-field">
                                <label><Hash size={14} /> Número</label>
                                <input
                                    type="text"
                                    value={numero}
                                    onChange={(e) => setNumero(e.target.value)}
                                    placeholder="Ej: 12345"
                                />
                            </div>
                            <div className="pjn-field">
                                <label><Calendar size={14} /> Año</label>
                                <input
                                    type="text"
                                    value={anio}
                                    onChange={(e) => setAnio(e.target.value)}
                                    placeholder="Ej: 2025"
                                    maxLength={4}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="pjn-field pjn-field-full">
                            <label><User size={14} /> Nombre de la parte</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Ej: González, Juan Carlos"
                            />
                        </div>
                    )}
                </div>

                {/* CAPTCHA WIDGET */}
                <div className="pjn-captcha-section">
                    <div className="pjn-captcha-label">
                        <ShieldCheck size={16} />
                        <span>Verificación de seguridad</span>
                        {captchaToken && (
                            <span className="pjn-captcha-badge">
                                <CheckCircle2 size={14} />
                                Verificado
                            </span>
                        )}
                    </div>

                    <div
                        ref={captchaContainerRef}
                        className="pjn-captcha pjn-captcha-widget"
                        id="pjn-captcha-container"
                    />

                    {captchaStatus === 'loading' && !captchaToken && (
                        <div className="pjn-captcha-loading">
                            <Loader2 size={16} className="animate-spin" />
                            <span>Cargando captcha del PJN...</span>
                        </div>
                    )}

                    {captchaStatus === 'error' && (
                        <div className="pjn-captcha-error">
                            <AlertCircle size={16} />
                            <span>No se pudo cargar el captcha. <button type="button" onClick={resetCaptcha}>Reintentar</button></span>
                        </div>
                    )}
                </div>

                {/* SUBMIT */}
                <div className="pjn-actions">
                    <button
                        type="submit"
                        className="pjn-submit-btn"
                        disabled={loading || !captchaToken}
                    >
                        {loading ? (
                            <><Loader2 size={18} className="animate-spin" /> Consultando PJN...</>
                        ) : (
                            <><Search size={18} /> Consultar SCW</>
                        )}
                    </button>

                    {searched && (
                        <button
                            type="button"
                            className="pjn-reset-btn"
                            onClick={resetCaptcha}
                        >
                            <RefreshCw size={16} /> Nueva búsqueda
                        </button>
                    )}
                </div>
            </form>

            {/* ERROR */}
            {error && (
                <div className="pjn-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* RESULTS */}
            {results && results.results && results.results.length > 0 && (
                <div className="pjn-results">
                    <div className="pjn-results-header">
                        <h4>
                            <FileText size={18} />
                            {results.total} resultado{results.total !== 1 ? 's' : ''} encontrado{results.total !== 1 ? 's' : ''}
                        </h4>
                        <span className="pjn-results-query">
                            {results.searchType === 'expediente' ? `Exp. ${results.query}` : results.query}
                        </span>
                    </div>

                    <div className="pjn-results-table-wrap">
                        <table className="pjn-results-table">
                            <thead>
                                <tr>
                                    <th>Expediente</th>
                                    <th>Carátula</th>
                                    <th>Jurisdicción</th>
                                    <th>Dependencia</th>
                                    <th>Situación</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.results.map((r, i) => (
                                    <tr key={i}>
                                        <td className="pjn-cell-exp">{r.expediente}</td>
                                        <td className="pjn-cell-caratula">{r.caratula}</td>
                                        <td>{r.jurisdiccion}</td>
                                        <td>{r.dependencia}</td>
                                        <td>{r.situacion}</td>
                                        <td>
                                            {r.link && (
                                                <a href={r.link} target="_blank" rel="noopener noreferrer" className="pjn-link-btn">
                                                    <ExternalLink size={14} />
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* EMPTY STATE */}
            {searched && !loading && results && results.results?.length === 0 && !error && (
                <div className="pjn-empty">
                    <Search size={40} />
                    <p>{results.message || 'No se encontraron expedientes con esos parámetros.'}</p>
                </div>
            )}
        </div>
    );
}
