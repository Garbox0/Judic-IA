"use client";
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { generateResearchPDF } from '../../lib/pdfGenerator';
import Link from 'next/link';
import Image from 'next/image';
import { demoResearchHistory, demoFullResearchResult } from '../../lib/demoData'; // [NEW] Mock Data
import SafeChatWidget from '../../components/SafeChatWidget';
import TrialExpiredBlock from '../../components/TrialExpiredBlock';
import { isTrialExpired } from '../../lib/subscription';
import { analyzeQueryQuality } from '../../../lib/queryEnhancer';

import {
    Briefcase,
    Gavel,
    Home,
    Building2,
    Search,
    Zap,
    RefreshCw,
    ExternalLink,
    Eye,
    FileText,
    ClipboardCopy,
    Loader2,
    Sparkles,
    AlertCircle,
    TrendingUp
} from 'lucide-react';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';
import { getPlanLimit } from '@/lib/planLimits';
import './research.css';

// Module-level cache for logo base64 (persists across re-mounts)
let _logoCache = null;

export default function ResearchPage({ isDemo: isDemoProp = false }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('nacional'); // 'nacional' or 'provincial'
    const [province, setProvince] = useState('Buenos Aires');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshingCases, setRefreshingCases] = useState({}); // { [index]: true/false }
    const [capturingCases, setCapturingCases] = useState({}); // New state for capture loading
    const [copySuccess, setCopySuccess] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    const [placeholder, setPlaceholder] = useState("Ej: Despido sin causa con antigüedad de 10 años en CABA...");
    const [userProfile, setUserProfile] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [logoBase64, setLogoBase64] = useState(null);
    const [history, setHistory] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile: false = hidden
    const [timeLeft, setTimeLeft] = useState(0);
    const [searchStatus, setSearchStatus] = useState('');
    const [refreshQuota, setRefreshQuota] = useState(5);
    const [quotaModalOpen, setQuotaModalOpen] = useState(false); // [NEW] Quota Modal State
    const [buyingPack, setBuyingPack] = useState(null); // 'pack_10' | 'pack_25' | 'pack_50'
    const [creditsToast, setCreditsToast] = useState(null); // 'ok' | 'error' | 'pending'
    const [quotaExhausted, setQuotaExhausted] = useState(false); // true = llegó a 0, false = compra proactiva
    const [trialExpired, setTrialExpired] = useState(false); // [NEW] Trial Expiration Check

    // 🏢 EMPRESA TAB
    const [activeTab, setActiveTab] = useState('jurisprudencia');
    const [empresaName, setEmpresaName] = useState('');
    const [empresaCuit, setEmpresaCuit] = useState('');
    const [empresaJurisdiction, setEmpresaJurisdiction] = useState('federal');
    const [empresaLoading, setEmpresaLoading] = useState(false);
    const [empresaResults, setEmpresaResults] = useState(null); // { cases: [], message? }
    const [empresaError, setEmpresaError] = useState(null);

    // 🎯 QUERY ENHANCEMENT STATES
    const [assistedMode, setAssistedMode] = useState(true); // Default to assisted for better UX
    const [enhancementModal, setEnhancementModal] = useState(null); // { original, enhanced, quality }
    const [analyzingQuery, setAnalyzingQuery] = useState(false);
    const [reformulationModal, setReformulationModal] = useState(null); // { alternatives }
    const [queryQuality, setQueryQuality] = useState(null); // Current query quality analysis

    // 📊 CLICK TRACKING: Fire-and-forget feedback for re-ranking
    const trackClick = (caseUrl, action) => {
        if (!caseUrl || isDemoProp) return;
        fetch('/api/research/track-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                case_url: caseUrl,
                action,
                query_context: query?.substring(0, 500)
            })
        }).catch(() => { }); // Fire-and-forget
    };


    useEffect(() => {
        let timer;
        if (loading && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [loading, timeLeft]);

    // Detectar redirect de MercadoPago tras compra de credits
    useEffect(() => {
        const creditsParam = searchParams?.get('credits');
        if (!creditsParam) return;

        setCreditsToast(creditsParam);
        // Limpiar param de la URL sin recargar
        router.replace('/dashboard/research', { scroll: false });

        // Si el pago fue aprobado, refrescar perfil para mostrar nuevos credits
        if (creditsParam === 'ok') {
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (!user) return;
                supabase.from('profiles').select('*').eq('id', user.id).single()
                    .then(({ data: profile }) => {
                        if (profile) setUserProfile(profile);
                    });
            });
        }

        // Auto-dismiss toast después de 5s
        const t = setTimeout(() => setCreditsToast(null), 5000);
        return () => clearTimeout(t);
    }, [searchParams]);

    useEffect(() => {
        const fetchUserAndHistory = async () => {
            if (isDemoProp) {
                // DEMO MODE SETUP
                setHistory(demoResearchHistory);
                // Mock user profile for PDF generation
                setUserProfile({ full_name: "Usuario Demo", matricula: "Tº 100 Fº 1" });
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUser(user);
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setUserProfile(profile);

                // 🔒 Check Trial Expiration (Frontend UX - Backend is the real security)
                if (profile && isTrialExpired(profile)) {
                    setTrialExpired(true);
                }

                // Fetch History
                const { data: reports } = await supabase
                    .from('research_reports')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (reports) setHistory(reports);
            }
        };
        fetchUserAndHistory();

        // Convert logo to base64 for PDF (cached at module level)
        if (_logoCache) {
            setLogoBase64(_logoCache);
        } else {
            fetch('/judic-ia-mark.png')
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        _logoCache = reader.result;
                        setLogoBase64(reader.result);
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(err => console.error("Error loading logo:", err));
        }
    }, []);

    const handleDownloadPDF = () => {
        generateResearchPDF(results, userProfile, currentUser, {
            scope,
            province,
            query,
            logoBase64
        });
    };

    const handleRefreshCase = async (index) => {
        if (!query || refreshingCases[index]) return;

        // 🔒 REFRESH GOVERNANCE: Front-end blocks
        const isDemo = isDemoProp || !currentUser || userProfile?.subscription_status === 'demo';
        if (isDemo) {
            alert("🔒 Función disponible solo para usuarios Profesionales.");
            return;
        }

        if (refreshQuota <= 0) {
            setQuotaExhausted(true);
            setQuotaModalOpen(true);
            return;
        }

        setRefreshingCases(prev => ({ ...prev, [index]: true }));
        trackClick(results.cases[index]?.url, 'refresh');

        try {
            // Collect all current URLs to exclude
            const excludeUrls = results.cases.map(c => c.url).filter(Boolean);

            const res = await fetch('/api/research/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    excludeUrls,
                    mode: isDemo ? 'demo' : 'pro',
                    userId: currentUser?.id
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to refresh");
            }

            const newCase = await res.json();

            setResults(prev => {
                const newCases = [...prev.cases];
                newCases[index] = newCase;
                return { ...prev, cases: newCases };
            });

            // Consume Quota
            setRefreshQuota(prev => prev - 1);

        } catch (error) {
            console.error("Refresh error:", error);
            alert(`No se pudo actualizar el fallo: ${error.message}`);
        } finally {
            setRefreshingCases(prev => ({ ...prev, [index]: false }));
        }
    };

    // 📸 NEW: Handle PDF Capture via Puppeteer
    const handleCapture = async (index, url, title) => {
        if (capturingCases[index]) return;

        setCapturingCases(prev => ({ ...prev, [index]: true }));
        trackClick(url, 'view_pdf');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;

            const res = await fetch('/api/research/capture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
                },
                body: JSON.stringify({ url, title })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Fallo en captura');
            }

            const data = await res.json();
            // Open in internal PDF viewer
            const viewerUrl = `/dashboard/legislation/viewer/case?url=${encodeURIComponent(data.url)}&title=${encodeURIComponent(title)}&from=research`;
            window.open(viewerUrl, '_blank');

        } catch (error) {
            console.error("Capture failed:", error);
            alert("No se pudo generar el PDF limpio: " + error.message);
            // Fallback: try old proxy if capture fails? or just let user know.
            // window.open(`/api/proxy-pdf?url=${encodeURIComponent(url)}`, '_blank');
        } finally {
            setCapturingCases(prev => ({ ...prev, [index]: false }));
        }
    };

    const renderContent = (content) => {
        if (!content) return null;
        let text = "";
        if (typeof content === 'string') text = content;
        else if (Array.isArray(content)) text = content.join('\n');
        else if (typeof content === 'object') text = Object.entries(content).map(([k, v]) => `### ${k}\n${v}`).join('\n\n');
        else text = String(content);

        // Pre-process: Logic to detect if it's a list (e.g. "1. xxx 2. xxx") and break lines
        // If we find "1. ", "2. " pattern in the text, we try to split it into a real list.
        const hasNumberedList = /\s\d+\.\s/.test(text) || /^\d+\.\s/.test(text);

        if (hasNumberedList) {
            // Split by number pattern but keep the delimiter to reconstruct or map
            const parts = text.split(/(\d+\.\s+)/).filter(Boolean);

            // If the split actually resulted in meaningful parts, render as list
            if (parts.length > 1) {
                return (
                    <ul className="numbered-list">
                        {parts.reduce((acc, part, i) => {
                            // Check if this part is the number marker ("1. ")
                            if (/^\d+\.\s+$/.test(part)) {
                                acc.push({ marker: part.trim(), content: parts[i + 1] || "" });
                            }
                            return acc;
                        }, []).map((item, i) => (
                            <li key={i} className="numbered-list-item">
                                <span className="numbered-list-marker">{item.marker}</span>
                                <span className="numbered-list-content">{item.content}</span>
                            </li>
                        ))}
                    </ul>
                );
            }
        }

        return text.split('\n').map((line, index) => {
            // Handle Headers
            if (line.match(/^#{1,6}\s/)) {
                const match = line.match(/^#{1,6}\s/);
                const level = match[0].trim().length;
                const cleanLine = line.replace(/^#{1,6}\s/, '');
                const levelClass = level <= 2 ? 'research-h3' : (level === 3 ? 'research-h4' : 'research-h5');

                if (level <= 2) return <h3 key={index} className={levelClass}>{cleanLine}</h3>;
                if (level === 3) return <h4 key={index} className={levelClass}>{cleanLine}</h4>;
                return <h5 key={index} className={levelClass}>{cleanLine}</h5>;
            }

            // Bold text
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
                <p key={index} className="research-p">
                    {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={i} className="research-strong">{part.slice(2, -2)}</strong>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    // 🏢 EMPRESA SEARCH HANDLER
    const handleEmpresaSearch = async (e) => {
        e.preventDefault();
        if (!empresaName && !empresaCuit) return;
        setEmpresaLoading(true);
        setEmpresaResults(null);
        setEmpresaError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch('/api/research/company', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({
                    name: empresaName || undefined,
                    cuit: empresaCuit || undefined,
                    jurisdiction: empresaJurisdiction
                })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error === 'QUOTA_EXCEEDED') {
                    setQuotaExhausted(true);
                    setQuotaModalOpen(true);
                    return;
                }
                setEmpresaError(data.error || 'Error al buscar. Intentá de nuevo.');
                return;
            }

            setEmpresaResults(data);

            // Reload profile to update quota display
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (profile) setUserProfile(profile);
            }
        } catch (err) {
            setEmpresaError('Error de conexión. Verificá tu internet.');
        } finally {
            setEmpresaLoading(false);
        }
    };

    // 🎯 PRE-FLIGHT CHECK: Analyze query quality before searching
    const handleSearch = async (e, forceQuery = null) => {
        if (e) e.preventDefault();
        const finalQuery = forceQuery || query || (placeholder.startsWith("Ej:") ? "" : placeholder);
        if (!finalQuery) return;

        // 🔍 ASSISTED MODE: Check query quality first
        if (assistedMode && !forceQuery) {
            setAnalyzingQuery(true);
            const quality = analyzeQueryQuality(finalQuery);
            setQueryQuality(quality);
            setAnalyzingQuery(false);

            console.log('🎯 Query Quality Analysis:', {
                query: finalQuery,
                score: quality.score,
                level: quality.level,
                shouldEnhance: quality.shouldEnhance,
                issues: quality.issues,
                strengths: quality.strengths
            });

            // If query is poor, offer enhancement
            if (quality.shouldEnhance && quality.score < 60) {
                console.log('✨ Attempting to enhance query...');
                try {
                    const jurisdiction = scope === 'nacional' ? 'Nacional' : province;
                    const { data: { session: enhanceSession } } = await supabase.auth.getSession();
                    const enhanceToken = enhanceSession?.access_token;

                    const enhanceRes = await fetch('/api/research/enhance', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(enhanceToken && { 'Authorization': `Bearer ${enhanceToken}` })
                        },
                        body: JSON.stringify({ query: finalQuery, jurisdiction })
                    });

                    console.log('📡 Enhancement API response:', enhanceRes.status);

                    if (enhanceRes.ok) {
                        const enhancement = await enhanceRes.json();
                        console.log('✅ Enhancement received:', enhancement);

                        if (enhancement.enhanced && enhancement.enhanced !== finalQuery && enhancement.confidence >= 50) {
                            console.log('💡 Showing enhancement modal');
                            // Show enhancement modal
                            setEnhancementModal({
                                original: finalQuery,
                                enhanced: enhancement.enhanced,
                                quality: quality,
                                changes: enhancement.changes,
                                reasoning: enhancement.reasoning
                            });
                            return; // Stop here, wait for user decision
                        } else {
                            console.log('⚠️ Enhancement not shown:', {
                                same: enhancement.enhanced === finalQuery,
                                lowConfidence: enhancement.confidence < 50
                            });
                        }
                    } else {
                        const errorText = await enhanceRes.text();
                        console.error('❌ Enhancement API failed:', errorText);
                    }
                } catch (err) {
                    console.error('❌ Enhancement error:', err);
                }
            } else {
                console.log('⏭️ Skipping enhancement (score too high or not needed)');
            }
        }

        // 🚀 EXECUTE SEARCH
        await executeSearch(finalQuery);
    };

    // Separated search execution for reuse
    const executeSearch = async (finalQuery) => {
        setLoading(true);
        setResults(null);
        setTimeLeft(60);
        setReformulationModal(null); // Clear any previous reformulation suggestions

        if (isDemoProp) {
            // SIMULATE SEARCH IN DEMO
            const analysisSteps = [
                'Iniciando ráfaga masiva de búsqueda (Brave Pro)...',
                'Escaneando depósitos de la CSJN y PJN...',
                'Filtrando resultados por relevancia jurídica "Surgical"...',
                'Detectando parámetros de liquidación técnica...',
                'Finalizando síntesis de inteligencia legal...'
            ];
            let stepIndex = 0;
            setSearchStatus(analysisSteps[0]);

            const statusInterval = setInterval(() => {
                stepIndex = (stepIndex + 1);
                if (stepIndex < analysisSteps.length) {
                    setSearchStatus(analysisSteps[stepIndex]);
                }
            }, 800);

            setTimeout(() => {
                clearInterval(statusInterval);
                setResults(demoFullResearchResult);
                setLoading(false);
                setSearchStatus('');
            }, 4500);
            return;
        }

        const analysisSteps = [
            'Iniciando ráfaga masiva de búsqueda (Brave Pro)...',
            'Escaneando depósitos de la CSJN y PJN...',
            'Consultando nodos de jurisprudencia provincial...',
            'Filtrando resultados por relevancia jurídica "Surgical"...',
            'Analizando doctrina y fallos de fuentes oficiales...',
            'Extrayendo Ratio Decidendi de 20+ fuentes...',
            'Detectando parámetros de liquidación técnica...',
            'Blindando estrategia procesal (Ofensiva/Defensiva)...',
            'Finalizando síntesis de inteligencia legal...'
        ];

        let stepIndex = 0;
        setSearchStatus(analysisSteps[0]);

        const statusInterval = setInterval(() => {
            stepIndex = (stepIndex + 1) % analysisSteps.length;
            setSearchStatus(analysisSteps[stepIndex]);
        }, 3500);

        try {
            // Get current session token for Authorization
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;

            const res = await fetch('/api/research', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
                },
                body: JSON.stringify({
                    query: finalQuery,
                    jurisdiction: scope === 'nacional' ? 'Nacional' : province,
                    mode: 'pro'
                })
            });

            if (res.status === 402) {
                setQuotaExhausted(true);
                setQuotaModalOpen(true);
                setLoading(false);
                return;
            }

            if (!res.ok) throw new Error("Search failed");
            const data = await res.json();
            setResults(data);

            // [FIX] Update History Immediately
            if (data.report_meta) {
                const newHistoryItem = {
                    id: data.report_meta.id,
                    created_at: data.report_meta.created_at,
                    query: finalQuery,
                    jurisdiction: scope === 'nacional' ? 'Nacional' : province,
                    result_json: data
                };
                setHistory(prev => [newHistoryItem, ...prev]);
            }

            // 🔍 POST-SEARCH: Check results quality and offer reformulation if needed
            if (assistedMode && data.cases && data.cases.length > 0) {
                const avgScore = data._debug?.avg_score
                    ?? Math.round(data.cases.reduce((sum, c) => sum + (c.score || 0), 0) / data.cases.length);
                const highQualityCases = data._debug?.high_score
                    ?? data.cases.filter(c => (c.score || 0) >= 60).length;

                // If results are poor, offer alternatives
                if (avgScore < 50 || highQualityCases < 2) {
                    setTimeout(async () => {
                        try {
                            const { data: { session: altSession } } = await supabase.auth.getSession();
                            const altToken = altSession?.access_token;

                            const altRes = await fetch('/api/research/alternatives', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(altToken && { 'Authorization': `Bearer ${altToken}` })
                                },
                                body: JSON.stringify({
                                    query: finalQuery,
                                    jurisdiction: scope === 'nacional' ? 'Nacional' : province
                                })
                            });

                            if (altRes.ok) {
                                const alternatives = await altRes.json();
                                if (alternatives.alternatives && alternatives.alternatives.length > 0) {
                                    setReformulationModal({
                                        original: finalQuery,
                                        alternatives: alternatives.alternatives,
                                        avgScore: Math.round(avgScore)
                                    });
                                }
                            }
                        } catch (err) {
                            console.warn('Failed to generate alternatives:', err);
                        }
                    }, 2000); // Show after 2 seconds so user can see initial results
                }
            }

        } catch (error) {
            console.error("Search error:", error);
            setSearchStatus('Error en la investigación avanzada.');
        } finally {
            clearInterval(statusInterval);
            setLoading(false);
            setSearchStatus('');
            setRefreshQuota(5); // Reset quota for new search
        }
    };

    const provinces = [
        "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
        "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza",
        "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
        "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
    ];

    return (
        <div className="research-container">
            {/* CREDITS PURCHASE TOAST */}
            {creditsToast && (
                <div className={`credits-toast ${creditsToast === 'ok' ? 'success' : creditsToast === 'pending' ? 'pending' : 'error'}`}>
                    {creditsToast === 'ok' && '✅ ¡Créditos acreditados! Ya podés seguir buscando.'}
                    {creditsToast === 'pending' && '⏳ Pago en proceso. Los créditos se acreditarán en breve.'}
                    {creditsToast === 'error' && '❌ El pago no se completó. Intentá de nuevo.'}
                    <button className="credits-toast-close" onClick={() => setCreditsToast(null)}>✕</button>
                </div>
            )}

            {/* 🔒 TRIAL EXPIRED BLOCK - UX only, backend is real security */}
            {trialExpired && !isDemoProp && (
                <TrialExpiredBlock featureName="Jurisprudencia" />
            )}

            {/* Main content - hidden when trial expired */}
            {!trialExpired && (
                <div className={`research-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                    {/* HISTORY SIDEBAR */}
                    {/* HISTORY SIDEBAR - Modified for Mobile Overlay */}
                    <>
                        {/* Mobile Toggle Button (Visible only on small screens via CSS) */}
                        <button
                            className="mobile-history-toggle"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <span>🕒 Historial</span>
                        </button>

                        {/* Overlay Backdrop (only visible when sidebar is open on mobile) */}
                        <div
                            className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                        />

                        <aside className={`research-sidebar glass-panel ${sidebarOpen ? 'open' : 'closed'}`}>
                            {/* Always show header with Close button on Mobile/Expand */}
                            {(sidebarOpen || true) && (
                                <div className="sidebar-header-row">
                                    <h4 className="sidebar-title">Historial</h4>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
                                        className="sidebar-close-btn"
                                    >
                                        {sidebarOpen ? '✕' : '▶'}
                                    </button>
                                </div>
                            )}

                            {/* Collapsed State Icon (Desktop Only) */}
                            {!sidebarOpen && (
                                <div
                                    className="collapsed-icon-area"
                                    onClick={() => setSidebarOpen(true)}
                                >
                                    <div className="vertical-trigger">
                                        <span className="v-icon">🕒</span>
                                        <span className="v-label">HISTORIAL</span>
                                    </div>
                                </div>
                            )}

                            {sidebarOpen && (
                                <div className="history-list history-list-container">
                                    {history.length === 0 && <p className="history-empty-text">Sin investigaciones recientes.</p>}
                                    {history.map(item => (
                                        <div
                                            key={item.id}
                                            className="history-item history-item-box"
                                            onClick={() => { setQuery(item.query); setResults(item.result_json); }}
                                        >
                                            <div className="history-item-query">
                                                {item.query}
                                            </div>
                                            <div className="history-item-meta">
                                                {new Date(item.created_at).toLocaleDateString()} • {item.jurisdiction}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </aside>
                    </>
                    <div className="main-content-area">
                        <nav className="research-nav">
                            <div className="breadcrumb">
                                <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                                <span className="breadcrumb-separator">/</span>
                                <span className="breadcrumb-current">Terminal de Estrategia</span>
                            </div>
                        </nav>

                        <header className="research-header">
                            <div className="header-flex">
                                <Image
                                    src="/judic-ia-mark.png"
                                    alt="Judic-IA Logo"
                                    className="logo-main logo-main-contain"
                                    width={56}
                                    height={75}
                                />
                                <div className="header-text">
                                    <h1 className="dashboard-page-title">Terminal de Estrategia Jurídica</h1>
                                    <p>Investigación avanzada, Ratio Decidendi y generación de estrategia blindada.</p>
                                </div>
                                <UsageGuide content={dashboardManuals.research} />
                            </div>
                        </header>

                        {/* TAB SWITCHER */}
                        <div className="research-tabs">
                            <button
                                className={`research-tab ${activeTab === 'jurisprudencia' ? 'active' : ''}`}
                                onClick={() => setActiveTab('jurisprudencia')}
                            >
                                <Search size={15} /> Jurisprudencia
                            </button>
                            <button
                                className={`research-tab ${activeTab === 'empresa' ? 'active' : ''}`}
                                onClick={() => setActiveTab('empresa')}
                            >
                                <Building2 size={15} /> Antecedentes Judiciales
                            </button>
                        </div>

                        {/* ── EMPRESA TAB ── */}
                        {activeTab === 'empresa' && (
                            <div className="search-box-container glass-panel empresa-panel">
                                <div className="empresa-panel-header">
                                    <div className="empresa-panel-icon"><Building2 size={20} /></div>
                                    <div>
                                        <h3 className="empresa-panel-title">Antecedentes Judiciales de Empresa</h3>
                                        <p className="empresa-panel-subtitle">Investigá causas, demandas y sentencias públicas antes de aceptar un caso.</p>
                                    </div>
                                </div>

                                <form onSubmit={handleEmpresaSearch} className="empresa-form">
                                    <div className="empresa-row">
                                        <div className="empresa-field empresa-field-main">
                                            <label htmlFor="empresa_name">Razón social</label>
                                            <input
                                                id="empresa_name"
                                                type="text"
                                                placeholder="Ej: YPF SA, Carrefour, Techint..."
                                                value={empresaName}
                                                onChange={e => setEmpresaName(e.target.value)}
                                            />
                                        </div>
                                        <div className="empresa-field empresa-field-cuit">
                                            <label htmlFor="empresa_cuit">CUIT <span className="empresa-optional">(opcional)</span></label>
                                            <input
                                                id="empresa_cuit"
                                                type="text"
                                                placeholder="30-54668997-9"
                                                value={empresaCuit}
                                                onChange={e => setEmpresaCuit(e.target.value)}
                                                maxLength={13}
                                            />
                                        </div>
                                    </div>
                                    <div className="empresa-row empresa-row-bottom">
                                        <div className="empresa-field empresa-field-jur">
                                            <label htmlFor="empresa_jur">Jurisdicción</label>
                                            <select
                                                id="empresa_jur"
                                                value={empresaJurisdiction}
                                                onChange={e => setEmpresaJurisdiction(e.target.value)}
                                            >
                                                <option value="federal">🇦🇷 Federal / Nacional</option>
                                                <option value="buenosaires">📍 Buenos Aires (SCBA)</option>
                                                <option value="caba">🏙️ CABA</option>
                                                <option value="todas">🔍 Todas las disponibles</option>
                                            </select>
                                        </div>
                                        <button type="submit" disabled={empresaLoading || (!empresaName && !empresaCuit)} className="btn-search-submit empresa-btn">
                                            {empresaLoading ? <Loader2 size={18} className="spin-animation" /> : <Search size={18} />}
                                            {empresaLoading ? 'Buscando...' : 'Buscar expedientes'}
                                        </button>
                                    </div>
                                    <p className="empresa-disclaimer">
                                        Los resultados provienen de fuentes públicas y pueden ser incompletos. No reemplaza una consulta al sistema oficial.
                                    </p>
                                </form>

                                {!isDemoProp && userProfile && (() => {
                                    const limit = getPlanLimit(userProfile.plan_tier, 'research_reports');
                                    const used = userProfile.research_reports_used || 0;
                                    const extra = userProfile.research_reports_extra || 0;
                                    const monthlyRemaining = limit === -1 ? null : Math.max(0, limit - used);
                                    const usingExtra = limit !== -1 && monthlyRemaining === 0 && extra > 0;
                                    const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
                                    const isLow = limit !== -1 && !usingExtra && monthlyRemaining <= Math.ceil(limit * 0.2);
                                    return (
                                        <div className="research-quota-bar">
                                            <div className="research-quota-track">
                                                <div
                                                    className={`research-quota-fill ${isLow || usingExtra ? 'low' : ''}`}
                                                    style={{ width: usingExtra ? '100%' : `${pct}%` }}
                                                />
                                            </div>
                                            <span className={`research-quota-label ${isLow || usingExtra ? 'low' : ''}`}>
                                                {limit === -1
                                                    ? '∞ búsquedas ilimitadas'
                                                    : usingExtra
                                                        ? `${extra} créditos extra restantes`
                                                        : `${monthlyRemaining} de ${limit} búsquedas disponibles este mes`}
                                                {extra > 0 && !usingExtra && (
                                                    <span className="quota-extra-badge"> +{extra} extra</span>
                                                )}
                                                {limit !== -1 && userProfile?.subscription_status === 'active' && (
                                                    <button
                                                        className="quota-buy-btn"
                                                        onClick={() => setQuotaModalOpen(true)}
                                                    >
                                                        + Comprar más
                                                    </button>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })()}

                                {empresaError && (
                                    <div className="empresa-error">
                                        <AlertCircle size={16} /> {empresaError}
                                    </div>
                                )}

                                {empresaResults && (
                                    <div className="empresa-results">
                                        {empresaResults.message && empresaResults.cases?.length === 0 && (
                                            <p className="empresa-empty">{empresaResults.message}</p>
                                        )}
                                        {empresaResults.cases?.length > 0 && (
                                            <>
                                                <p className="empresa-count">{empresaResults.cases.length} causa{empresaResults.cases.length !== 1 ? 's' : ''} encontrada{empresaResults.cases.length !== 1 ? 's' : ''}</p>
                                                <div className="empresa-cases">
                                                    {empresaResults.cases.map((c, i) => (
                                                        <div key={i} className="empresa-case-card">
                                                            <div className="empresa-case-header">
                                                                <span className={`empresa-tipo tipo-${c.tipo?.toLowerCase().replace(/\s/g, '-')}`}>{c.tipo || 'Otro'}</span>
                                                                {c.año && <span className="empresa-year">{c.año}</span>}
                                                                {c.estado && <span className={`empresa-estado ${c.estado === 'Activo' ? 'activo' : c.estado === 'Con sentencia' ? 'sentencia' : 'archivado'}`}>{c.estado}</span>}
                                                            </div>
                                                            <p className="empresa-caratula">{c.caratula}</p>
                                                            {c.resumen && <p className="empresa-resumen">{c.resumen}</p>}
                                                            <div className="empresa-case-meta">
                                                                {c.expediente && <span className="empresa-meta">Expte: {c.expediente}</span>}
                                                                {c.tribunal && <span className="empresa-meta">{c.tribunal}</span>}
                                                            </div>
                                                            {c.url && (
                                                                <a href={c.url} target="_blank" rel="noopener noreferrer" className="empresa-link">
                                                                    <ExternalLink size={13} /> Ver fuente
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── JURISPRUDENCIA TAB ── */}
                        {activeTab === 'jurisprudencia' && (
                        <div className="search-box-container glass-panel">
                            {/* MODE SELECTOR - Two clear cards */}
                            <div className="mode-selector">
                                <span className="mode-selector-label">¿Cómo querés buscar?</span>
                                <div className="mode-cards">
                                    <button
                                        onClick={() => setAssistedMode(true)}
                                        className={`mode-card ${assistedMode ? 'selected' : ''}`}
                                    >
                                        <div className="mode-card-icon assisted-icon">
                                            <Sparkles size={22} />
                                        </div>
                                        <span className="mode-card-title">Asistido por IA</span>
                                        <span className="mode-card-desc">La IA analiza y mejora tu búsqueda antes de ejecutarla para obtener mejores resultados.</span>
                                        {assistedMode && <span className="mode-card-badge">✓ Activo</span>}
                                    </button>
                                    <button
                                        onClick={() => setAssistedMode(false)}
                                        className={`mode-card ${!assistedMode ? 'selected' : ''}`}
                                    >
                                        <div className="mode-card-icon expert-icon">
                                            <Zap size={22} />
                                        </div>
                                        <span className="mode-card-title">Búsqueda Directa</span>
                                        <span className="mode-card-desc">Tu consulta se ejecuta tal cual la escribís, sin modificaciones. Ideal para búsquedas precisas.</span>
                                        {!assistedMode && <span className="mode-card-badge">✓ Activo</span>}
                                    </button>
                                </div>
                            </div>

                            <div className="jurisdiction-selector">
                                <label htmlFor="res_scope_nacional" className={`radio-btn ${scope === 'nacional' ? 'active' : ''}`}>
                                    <input
                                        id="res_scope_nacional"
                                        type="radio"
                                        name="scope"
                                        value="nacional"
                                        checked={scope === 'nacional'}
                                        onChange={() => setScope('nacional')}
                                    />
                                    🇦🇷 Justicia Nacional / Federal
                                </label>
                                <label htmlFor="res_scope_provincial" className={`radio-btn ${scope === 'provincial' ? 'active' : ''}`}>
                                    <input
                                        id="res_scope_provincial"
                                        type="radio"
                                        name="scope"
                                        value="provincial"
                                        checked={scope === 'provincial'}
                                        onChange={() => setScope('provincial')}
                                    />
                                    📍 Justicia Provincial
                                </label>

                                {scope === 'provincial' && (
                                    <>
                                        <label htmlFor="res_province_select" className="sr-only">Seleccionar Provincia</label>
                                        <select
                                            id="res_province_select"
                                            className="province-select"
                                            value={province}
                                            onChange={(e) => setProvince(e.target.value)}
                                        >
                                            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </>
                                )}
                            </div>

                            {/* 💡 SEARCH TIPS */}
                            <details className="search-tips-details tips-details">
                                <summary className="tips-summary">
                                    <Zap size={14} fill="#fbbf24" />
                                    <span>Tips para búsquedas de Alta Precisión</span>
                                </summary>
                                <div className="tips-content tips-content-box">
                                    <p className="tips-intro-p">Para obtener los mejores resultados, utilizá estos patrones:</p>
                                    <ul className="tips-list">
                                        <li className="tips-li">
                                            <strong>Tema + "fallo" o "sentencia":</strong> <span className="tips-example">Ej: "despido sin causa fallo", "cuota alimentaria sentencia"</span>
                                        </li>
                                        <li className="tips-li">
                                            <strong>Frase exacta entre comillas:</strong> <span className="tips-example">Ej: "daño moral" accidente tránsito</span>
                                        </li>
                                        <li className="tips-li">
                                            <strong>Jurisdicción específica:</strong> <span className="tips-example">Ej: "mala praxis médica cordoba camara"</span>
                                        </li>
                                        <li>
                                            <strong>Autos (si conocés):</strong> <span className="tips-example">Ej: "autos garcia c/ perez s/ daños"</span>
                                        </li>
                                    </ul>
                                </div>
                            </details>

                            <form onSubmit={handleSearch} className="search-box">
                                <label htmlFor="research_input" className="sr-only">Consulta de investigación jurídica</label>
                                <input
                                    id="research_input"
                                    name="query"
                                    type="text"
                                    placeholder={placeholder}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                />
                                <button type="submit" disabled={loading} className="btn-search-submit">
                                    {loading ? <Zap size={18} className="spin-animation" /> : <Search size={18} />}
                                    {loading ? 'Procesando Inteligencia...' : 'Generar Estrategia IA'}
                                </button>
                            </form>

                            {!isDemoProp && userProfile && (() => {
                                const limit = getPlanLimit(userProfile.plan_tier, 'research_reports');
                                const used = userProfile.research_reports_used || 0;
                                const extra = userProfile.research_reports_extra || 0;
                                const monthlyRemaining = limit === -1 ? null : Math.max(0, limit - used);
                                const usingExtra = limit !== -1 && monthlyRemaining === 0 && extra > 0;
                                const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
                                const isLow = limit !== -1 && !usingExtra && monthlyRemaining <= Math.ceil(limit * 0.2);
                                return (
                                    <div className="research-quota-bar">
                                        <div className="research-quota-track">
                                            <div
                                                className={`research-quota-fill ${isLow || usingExtra ? 'low' : ''}`}
                                                style={{ width: usingExtra ? '100%' : `${pct}%` }}
                                            />
                                        </div>
                                        <span className={`research-quota-label ${isLow || usingExtra ? 'low' : ''}`}>
                                            {limit === -1
                                                ? '∞ búsquedas ilimitadas'
                                                : usingExtra
                                                    ? `${extra} créditos extra restantes`
                                                    : `${monthlyRemaining} de ${limit} búsquedas disponibles este mes`}
                                            {extra > 0 && !usingExtra && (
                                                <span className="quota-extra-badge"> +{extra} extra</span>
                                            )}
                                            {limit !== -1 && userProfile?.subscription_status === 'active' && (
                                                <button
                                                    className="quota-buy-btn"
                                                    onClick={() => setQuotaModalOpen(true)}
                                                >
                                                    + Comprar más
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                );
                            })()}

                            {loading && (
                                <div className="loader-container loader-wrapper">
                                    <div className="loader-text-wrapper">
                                        <Loader2 className="spin-animation text-amber-400" size={48} />
                                        <p className="loader-status-text">
                                            {searchStatus}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {results && (
                                <div className="action-buttons">
                                    <div className="copy-container">
                                        <button
                                            className="btn-action"
                                            onClick={() => {
                                                // ... copy logic same ...
                                                const parts = [
                                                    "🏦 ESTUDIO LEGAL - INVESTIGACIÓN DE IA (JUDIC-IA)",
                                                    "",
                                                    "📜 NORMATIVA APLICABLE:",
                                                    results.laws,
                                                    "",
                                                    "⚖️ JURISPRUDENCIA & FALLOS:",
                                                    results.cases.map(c => `🔹 ${c.title}\n   ${c.summary}\n   Fuente: ${c.source}`).join('\n\n'),
                                                    "",
                                                    results.calculation ? `💰 LIQUIDACIÓN ESTIMAD@:\n${results.calculation}\n` : null,
                                                    results.evidence ? `🔍 PUNTOS DE PRUEBA:\n${results.evidence}\n` : null,
                                                    "💡 ESTRATEGIA SUGERIDA:",
                                                    results.strategy,
                                                    "",
                                                    "🔗 FUENTES & LINKS:",
                                                    results.links?.map(l => `- ${l.title}: ${l.url}`).join('\n') || "No hay enlaces digitales directos."
                                                ].filter(Boolean).join('\n');

                                                navigator.clipboard.writeText(parts);
                                                setCopySuccess(true);
                                                setTimeout(() => setCopySuccess(false), 2000);
                                            }}
                                        >
                                            <ClipboardCopy size={16} />
                                            <span>Copiar Texto</span>
                                        </button>
                                        {copySuccess && <span className="copy-toast">✨ ¡Copiado!</span>}
                                    </div>
                                    <button className="btn-action btn-pdf" onClick={handleDownloadPDF}>
                                        <FileText size={16} />
                                        <span>Exportar Informe de Estrategia</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        )} {/* end activeTab === 'jurisprudencia' */}

                        {activeTab === 'jurisprudencia' && results && (
                            <div className="results-area">
                                {results.brave_used && (
                                    <div className="badge-brave">
                                        <span>🦁 Brave Search Pro Activo</span>
                                        <span className="opacity-60">•</span>
                                        <span>Resultados en Tiempo Real</span>
                                        {/* DEBUG LOGIC */}
                                        {/* STATUS BADGE LOGIC */}
                                        {isDemoProp || (userProfile && userProfile.subscription_status === 'demo') ? (
                                            <>
                                                <span className="quota-status-badge">•</span>
                                                <span className="demo-quota-text">Refrescos Desactivados (Demo)</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="quota-status-badge">•</span>
                                                <span>Refrescos Restantes: {refreshQuota}/5</span>
                                            </>
                                        )}
                                    </div>
                                )}
                                {results.laws && results.laws.length > 5 && (
                                    <section className="result-card glass-card">
                                        <h3>📚 Normativa Aplicable</h3>
                                        <div className="content">{renderContent(results.laws)}</div>
                                    </section>
                                )}

                                <section className="result-card glass-card">
                                    <h3>⚖️ Jurisprudencia Similares</h3>
                                    <div className="content">
                                        {Array.isArray(results.cases) ? (
                                            <div className="cases-grid">
                                                {results.cases.length === 0 && <p className="case-empty-text">No se encontraron fallos digitales directos.</p>}
                                                {results.cases.map((c, i) => {
                                                    // Fix malformed URLs (e.g., "www.example.com/https://...")
                                                    let safeUrl = c.url;
                                                    if (safeUrl) {
                                                        if (safeUrl.includes('://') && !safeUrl.startsWith('http')) {
                                                            // Extract the actual URL after the protocol
                                                            const protocolIndex = safeUrl.indexOf('://');
                                                            safeUrl = safeUrl.substring(safeUrl.lastIndexOf('http'));
                                                        } else if (!safeUrl.startsWith('http')) {
                                                            safeUrl = `https://${safeUrl}`;
                                                        }
                                                    }
                                                    const isRefreshing = refreshingCases[i];
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`case-item-card ${isRefreshing ? 'refreshing' : ''}`}
                                                        >
                                                            <div className="case-content-wrapper">
                                                                <div className="case-info">
                                                                    <h4 className="case-title">
                                                                        <Gavel size={16} className="text-amber-400" />
                                                                        {c.title}
                                                                    </h4>
                                                                    <div className="case-summary-scroll">
                                                                        <p className="case-summary-text">
                                                                            {c.summary}
                                                                        </p>
                                                                    </div>
                                                                    <span className="case-source">Fuente: {c.source || 'Referencia Legal'}</span>
                                                                </div>
                                                                {safeUrl && (
                                                                    <div className="case-actions">
                                                                        <button
                                                                            className="btn-preview-icon"
                                                                            title="Buscar nueva alternativa (Refresh)"
                                                                            onClick={() => handleRefreshCase(i)}
                                                                            disabled={refreshingCases[i]}
                                                                        >
                                                                            <RefreshCw size={16} className={refreshingCases[i] ? "spin-animation" : ""} />
                                                                        </button>
                                                                        <a
                                                                            href={safeUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="btn-link-icon"
                                                                            title="Abrir Fuente"
                                                                            onClick={() => trackClick(safeUrl, 'open_link')}
                                                                        >
                                                                            <ExternalLink size={16} />
                                                                        </a>
                                                                        <button
                                                                            className="btn-preview-icon"
                                                                            title={capturingCases[i] ? "Generando PDF limpio..." : "Visualizar (PDF Limpio)"}
                                                                            onClick={() => handleCapture(i, safeUrl, c.title)}
                                                                            disabled={capturingCases[i]}
                                                                        >
                                                                            {capturingCases[i] ? <Loader2 size={16} className="spin-animation" /> : <Eye size={16} />}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            // Fallback for old history items (String)
                                            results.cases
                                        )}
                                    </div>
                                </section>

                                {results.calculation && results.calculation.length > 5 && (
                                    <section className="result-card glass-card calculation">
                                        <h3>💰 Liquidación Estimada</h3>
                                        <div className="content">{renderContent(results.calculation)}</div>
                                    </section>
                                )}

                                {results.evidence && results.evidence.length > 5 && (
                                    <section className="result-card glass-card evidence">
                                        <h3>🔍 Puntos de Prueba (Sugeridos)</h3>
                                        <div className="content">{renderContent(results.evidence)}</div>
                                    </section>
                                )}

                                {results.strategy && results.strategy.length > 5 && (
                                    <section className="result-card glass-card strategy">
                                        <h3>💡 Sugerencia de Estrategia</h3>
                                        <div className="content">{renderContent(results.strategy)}</div>
                                    </section>
                                )}

                                {results.links && results.links.length > 0 && (
                                    <section className="result-card links">
                                        <h3>🔗 Recursos y Enlaces Útiles</h3>
                                        <div className="links-grid">
                                            {results.links.map((link, idx) => {
                                                // Fix malformed URLs
                                                let safeUrl = link.url;
                                                if (safeUrl.includes('://') && !safeUrl.startsWith('http')) {
                                                    safeUrl = safeUrl.substring(safeUrl.lastIndexOf('http'));
                                                } else if (!safeUrl.startsWith('http')) {
                                                    safeUrl = `https://${safeUrl}`;
                                                }
                                                return (
                                                    <div key={idx} className="link-wrapper">
                                                        <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="link-item">
                                                            {link.title} ↗
                                                        </a>

                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}



                        {activeTab === 'jurisprudencia' && !results && !loading && (
                            <div className="empty-state">
                                <p>✨ Escribí tu consulta legal y el sistema te ayudará a optimizarla automáticamente.</p>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* QUOTA LIMIT MODAL — CREDIT PACKS */}
            {quotaModalOpen && (
                <div className="quota-modal-overlay" onClick={() => { setQuotaModalOpen(false); setQuotaExhausted(false); }}>
                    <div className="quota-modal-card quota-modal-packs" onClick={e => e.stopPropagation()}>
                        <div className="quota-icon-circle">
                            <span className="quota-icon-emoji">{quotaExhausted ? '⚠️' : '🔍'}</span>
                        </div>
                        <h3 className="quota-title">
                            {quotaExhausted ? 'Búsquedas Agotadas' : 'Comprar Búsquedas Extra'}
                        </h3>
                        <p className="quota-desc">
                            {quotaExhausted
                                ? `Usaste tus ${getPlanLimit(userProfile?.plan_tier, 'research_reports')} búsquedas del mes. Cargá un pack para seguir investigando.`
                                : 'Los créditos extra no vencen al fin del mes. Se acumulan con tu cuota mensual.'
                            }
                        </p>

                        {userProfile?.subscription_status !== 'active' && userProfile?.plan_tier !== 'enterprise' ? (
                            <div className="credits-no-sub">
                                <p>Los créditos extra son exclusivos para suscriptores del Plan Profesional.</p>
                                <button
                                    className="btn-quota-pro"
                                    onClick={() => window.location.href = '/dashboard/settings?tab=billing'}
                                >
                                    Ver Plan Profesional
                                </button>
                            </div>
                        ) : null}

                        {(userProfile?.subscription_status === 'active' || userProfile?.plan_tier === 'enterprise') && (
                        <div className="credit-packs-grid">
                            {[
                                { id: 'pack_10', credits: 10, price: '5.000', badge: null },
                                { id: 'pack_25', credits: 25, price: '10.000', badge: 'Popular' },
                                { id: 'pack_50', credits: 50, price: '18.000', badge: 'Mejor valor' },
                            ].map(pack => (
                                <button
                                    key={pack.id}
                                    className={`credit-pack-card ${buyingPack === pack.id ? 'loading' : ''}`}
                                    disabled={!!buyingPack}
                                    onClick={async () => {
                                        setBuyingPack(pack.id);
                                        try {
                                            const { data: { session: creditsSession } } = await supabase.auth.getSession();
                                            const creditsToken = creditsSession?.access_token;
                                            const res = await fetch('/api/mp/credits/create', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    ...(creditsToken && { 'Authorization': `Bearer ${creditsToken}` }),
                                                },
                                                body: JSON.stringify({ pack_id: pack.id }),
                                            });
                                            const data = await res.json();
                                            if (data.init_point) {
                                                window.open(data.init_point, '_blank', 'noopener,noreferrer');
                                            } else {
                                                alert('Error al iniciar el pago. Intentá de nuevo.');
                                            }
                                        } catch {
                                            alert('Error de conexión. Intentá de nuevo.');
                                        } finally {
                                            setBuyingPack(null);
                                        }
                                    }}
                                >
                                    {pack.badge && (
                                        <span className="pack-badge">{pack.badge}</span>
                                    )}
                                    <span className="pack-credits">{pack.credits}</span>
                                    <span className="pack-label">búsquedas</span>
                                    <span className="pack-price">$ {pack.price} ARS</span>
                                    {buyingPack === pack.id && (
                                        <Loader2 size={16} className="spin-animation pack-spinner" />
                                    )}
                                </button>
                            ))}
                        </div>
                        )}

                        {(userProfile?.subscription_status === 'active' || userProfile?.plan_tier === 'enterprise') && (
                        <p className="quota-reset-note">
                            Los créditos extra no vencen. Se acumulan con tu cuota mensual.
                        </p>
                        )}
                        <div className="quota-actions">
                            <button
                                onClick={() => setQuotaModalOpen(false)}
                                className="btn-quota-cancel"
                            >
                                Ahora no
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QUERY ENHANCEMENT MODAL */}
            {enhancementModal && (
                <div className="quota-modal-overlay" onClick={() => setEnhancementModal(null)}>
                    <div className="enhancement-modal-card" onClick={e => e.stopPropagation()}>
                        <button
                            className="modal-close-btn"
                            onClick={() => setEnhancementModal(null)}
                            aria-label="Cerrar modal"
                        >
                            ✕
                        </button>
                        <div className="enhancement-icon-circle">
                            <Sparkles size={32} className="text-amber-400" />
                        </div>
                        <h3 className="enhancement-title">Mejora de Búsqueda Detectada</h3>

                        <div className="enhancement-quality-badge">
                            <AlertCircle size={16} />
                            <span>Calidad de búsqueda: {enhancementModal.quality.level === 'POOR' ? 'Baja' : 'Mejorable'} ({enhancementModal.quality.score}/100)</span>
                        </div>

                        {enhancementModal.quality.issues.length > 0 && (
                            <div className="enhancement-issues">
                                <p className="enhancement-section-title">Problemas detectados:</p>
                                <ul>
                                    {enhancementModal.quality.issues.map((issue, i) => (
                                        <li key={i}>{issue}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="enhancement-comparison">
                            <div className="enhancement-query original">
                                <label>Tu búsqueda:</label>
                                <div className="query-text">{enhancementModal.original}</div>
                            </div>
                            <div className="enhancement-arrow">→</div>
                            <div className="enhancement-query enhanced">
                                <label>Búsqueda mejorada:</label>
                                <div className="query-text">{enhancementModal.enhanced}</div>
                            </div>
                        </div>

                        {enhancementModal.changes && enhancementModal.changes.length > 0 && (
                            <div className="enhancement-changes">
                                <p className="enhancement-section-title">Mejoras aplicadas:</p>
                                <ul>
                                    {enhancementModal.changes.map((change, i) => (
                                        <li key={i}>✓ {change}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="enhancement-actions">
                            <button
                                className="btn-enhancement-accept"
                                onClick={() => {
                                    setQuery(enhancementModal.enhanced);
                                    setEnhancementModal(null);
                                    handleSearch(null, enhancementModal.enhanced);
                                }}
                            >
                                <TrendingUp size={16} />
                                Usar búsqueda mejorada
                            </button>
                            <button
                                onClick={() => {
                                    setEnhancementModal(null);
                                    handleSearch(null, enhancementModal.original);
                                }}
                                className="btn-enhancement-original"
                            >
                                Usar búsqueda original
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REFORMULATION SUGGESTIONS MODAL */}
            {reformulationModal && (
                <div className="quota-modal-overlay" onClick={() => setReformulationModal(null)}>
                    <div className="enhancement-modal-card" onClick={e => e.stopPropagation()}>
                        <button
                            className="modal-close-btn"
                            onClick={() => setReformulationModal(null)}
                            aria-label="Cerrar modal"
                        >
                            ✕
                        </button>
                        <div className="enhancement-icon-circle">
                            <AlertCircle size={32} className="text-orange-400" />
                        </div>
                        <h3 className="enhancement-title">Resultados Limitados</h3>

                        <p className="reformulation-desc">
                            La búsqueda "{reformulationModal.original}" obtuvo resultados de calidad limitada (score promedio: {reformulationModal.avgScore}/100).
                        </p>

                        <p className="reformulation-desc">
                            Probá con alguna de estas búsquedas alternativas:
                        </p>

                        <div className="reformulation-alternatives">
                            {reformulationModal.alternatives.map((alt, i) => (
                                <button
                                    key={i}
                                    className="reformulation-option"
                                    onClick={() => {
                                        setQuery(alt.query);
                                        setReformulationModal(null);
                                        handleSearch(null, alt.query);
                                    }}
                                >
                                    <div className="reformulation-query">{alt.query}</div>
                                    <div className="reformulation-reason">{alt.reason}</div>
                                </button>
                            ))}
                        </div>

                        <div className="enhancement-actions">
                            <button
                                onClick={() => setReformulationModal(null)}
                                className="btn-enhancement-original"
                            >
                                Mantener resultados actuales
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
