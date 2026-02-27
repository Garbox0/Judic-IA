import { createClient } from '@supabase/supabase-js';
import { fetchCsjnDailySorteos } from './csjnSorteos.js';
import {
    buildAlertRunMeta,
    computeNewMatches,
    loadAlertSeenIds,
    serializeAlertMeta
} from './alertDedupe.js';
import {
    applyCsjnAlertFilters,
    decodeCsjnAlertFilters,
    hasCsjnAlertFilters
} from './csjnAlertFilters.js';

function cleanText(value) {
    return String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeText(value) {
    return cleanText(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isAlertDue(alert, now = new Date()) {
    if (!alert?.last_run_at) return true;

    const lastRun = new Date(alert.last_run_at);
    if (Number.isNaN(lastRun.getTime())) return true;

    const frequency = String(alert.frequency || 'daily').toLowerCase();
    const msSinceLastRun = now.getTime() - lastRun.getTime();

    if (frequency === 'weekly') {
        return msSinceLastRun >= 7 * 24 * 60 * 60 * 1000;
    }

    return msSinceLastRun >= 20 * 60 * 60 * 1000;
}

function buildSearchTerms(query) {
    const normalized = normalizeText(query);
    if (!normalized) return [];
    return normalized
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);
}

function scoreSorteoMatch(searchTerms, item) {
    const haystack = normalizeText([
        item.denunciantes,
        item.denunciados,
        item.expediente,
        item.delitos,
        item.dependencia_asignada
    ].join(' '));

    if (!haystack || searchTerms.length === 0) return 0;

    let matches = 0;
    searchTerms.forEach((term) => {
        if (haystack.includes(term)) matches += 1;
    });

    if (matches === 0) return 0;

    const ratio = matches / searchTerms.length;
    if (ratio >= 0.85) return 100;
    if (ratio >= 0.6) return 80;
    if (ratio >= 0.4) return 60;
    return 40;
}

function matchSorteosByEntity(query, sorteos) {
    const terms = buildSearchTerms(query);
    if (terms.length === 0) return [];

    return (sorteos || [])
        .map((item) => ({
            ...item,
            match_score: scoreSorteoMatch(terms, item)
        }))
        .filter((item) => item.match_score >= 60)
        .sort((a, b) => b.match_score - a.match_score);
}

async function safeUpdateAlertRun(supabase, alertId, resultCount, newCount = null) {
    const nowIso = new Date().toISOString();
    const firstTry = await supabase
        .from('case_alerts')
        .update({
            last_run_at: nowIso,
            last_result_count: resultCount,
            ...(typeof newCount === 'number' ? { last_new_count: Math.max(0, newCount) } : {})
        })
        .eq('id', alertId);

    if (!firstTry.error) return;

    if (/column .* does not exist/i.test(firstTry.error.message || '')) {
        const secondTry = await supabase
            .from('case_alerts')
            .update({
                last_run_at: nowIso,
                last_result_count: resultCount
            })
            .eq('id', alertId);

        if (!secondTry.error) return;

        if (/column .* does not exist/i.test(secondTry.error.message || '')) {
            const thirdTry = await supabase
                .from('case_alerts')
                .update({ last_run_at: nowIso })
                .eq('id', alertId);
            if (thirdTry.error) {
                console.error(`[AlertEngine] No se pudo actualizar last_run_at para alerta ${alertId}:`, thirdTry.error.message);
            }
            return;
        }

        if (secondTry.error) {
            console.error(`[AlertEngine] No se pudo actualizar last_run_at para alerta ${alertId}:`, secondTry.error.message);
        }
        return;
    }

    console.error(`[AlertEngine] No se pudo actualizar alerta ${alertId}:`, firstTry.error.message);
}

async function safeInsertAlertLog(supabase, { alertId, resultCount, status, errorMessage, runMeta = null }) {
    const persistStatus = status === 'success' ? 'success' : 'error';
    const shouldSaveMeta = persistStatus === 'success' && runMeta && typeof runMeta === 'object';
    const payload = {
        alert_id: alertId,
        results_found: resultCount,
        status: persistStatus,
        error_message: shouldSaveMeta
            ? serializeAlertMeta(runMeta)
            : (errorMessage || null)
    };

    const { error } = await supabase
        .from('case_alerts_log')
        .insert(payload);

    if (error) {
        console.error(`[AlertEngine] No se pudo guardar log de alerta ${alertId}:`, error.message);
    }
}

export async function processDailyAlerts(options = {}) {
    const { limit = 100 } = options;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('[AlertEngine] Faltan credenciales de Supabase');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();

    const summary = {
        total_active_alerts: 0,
        due_alerts: 0,
        processed: 0,
        matched: 0,
        new_matches: 0,
        errors: 0,
        by_portal: {}
    };

    console.log('[AlertEngine] Iniciando procesamiento de alertas...');

    const { data: alerts, error } = await supabase
        .from('case_alerts')
        .select('*')
        .eq('is_active', true)
        .limit(limit);

    if (error) {
        throw new Error(`[AlertEngine] Error consultando case_alerts: ${error.message}`);
    }

    summary.total_active_alerts = alerts?.length || 0;

    if (!alerts || alerts.length === 0) {
        console.log('[AlertEngine] No hay alertas activas.');
        return summary;
    }

    const dueAlerts = alerts.filter((alert) => isAlertDue(alert, now));
    summary.due_alerts = dueAlerts.length;

    let sorteosCache = null;

    for (const alert of dueAlerts) {
        const portal = cleanText(alert.portal || 'PJN').toUpperCase();
        const searchQuery = cleanText(alert.search_query || alert.query_value || '');
        const csjnFilters = decodeCsjnAlertFilters(alert.fuero_id) || null;

        summary.by_portal[portal] = (summary.by_portal[portal] || 0) + 1;

        let runStatus = 'success';
        let resultCount = 0;
        let newCount = 0;
        let executionError = null;
        let runMeta = null;

        try {
            if (!searchQuery) {
                runStatus = 'skipped';
                executionError = 'ALERTA_SIN_BUSQUEDA';
            } else if (portal === 'CSJN_SORTEOS') {
                if (!sorteosCache) {
                    sorteosCache = await fetchCsjnDailySorteos();
                }

                const scopedCases = applyCsjnAlertFilters(sorteosCache.cases, csjnFilters || {});
                const matches = matchSorteosByEntity(searchQuery, scopedCases);
                const seenIds = await loadAlertSeenIds(supabase, alert.id);
                const dedupeResult = computeNewMatches(matches, seenIds);
                resultCount = matches.length;
                newCount = dedupeResult.new_count;
                if (matches.length > 0) {
                    summary.matched += 1;
                }
                summary.new_matches += newCount;

                runMeta = {
                    ...buildAlertRunMeta({
                        seenIds: dedupeResult.seen_ids_next,
                        newCount,
                        sourceDateIso: sorteosCache.source_date_iso,
                        requestedDateIso: sorteosCache.requested_date_iso || null
                    }),
                    scoped_dataset_total: scopedCases.length,
                    applied_filters: hasCsjnAlertFilters(csjnFilters || {}) ? csjnFilters : null
                };
            } else if (portal === 'PJN') {
                const { searchByParte, searchByExpediente } = await import('./captchaSolver.js');

                const legacyQuery = cleanText(alert.query_value || searchQuery);
                const typeHint = cleanText(alert.query_type || '').toLowerCase();
                const inferredType = /\d{1,8}\s*\/\s*\d{4}/.test(legacyQuery)
                    ? 'por_expediente'
                    : 'por_parte';
                const queryType = typeHint || inferredType;
                const jurisdictionId = cleanText(alert.jurisdiction_id || '');

                if (queryType.includes('expediente')) {
                    const expMatch = legacyQuery.match(/(\d{1,8})\s*\/\s*(\d{4})/);
                    if (!expMatch) {
                        runStatus = 'skipped';
                        executionError = 'FORMATO_EXPEDIENTE_INVALIDO';
                    } else {
                        const pjnResults = await searchByExpediente({
                            jurisdiccion: jurisdictionId,
                            numero: expMatch[1],
                            anio: expMatch[2]
                        });
                        if (pjnResults?.error) throw new Error(pjnResults.error);
                        resultCount = pjnResults?.results?.length || 0;
                    }
                } else {
                    const pjnResults = await searchByParte({
                        jurisdiccion: jurisdictionId,
                        nombre: legacyQuery
                    });
                    if (pjnResults?.error) throw new Error(pjnResults.error);
                    resultCount = pjnResults?.results?.length || 0;
                }

                if (resultCount > 0) {
                    summary.matched += 1;
                }
            } else {
                runStatus = 'skipped';
                executionError = 'PORTAL_NO_SOPORTADO_EN_MOTOR_ACTUAL';
            }

            await safeUpdateAlertRun(supabase, alert.id, resultCount, newCount);
        } catch (err) {
            runStatus = 'error';
            executionError = err?.message || 'ERROR_DESCONOCIDO';
            summary.errors += 1;
            console.error(`[AlertEngine] Error en alerta ${alert.id}:`, executionError);
        }

        await safeInsertAlertLog(supabase, {
            alertId: alert.id,
            resultCount,
            status: runStatus,
            errorMessage: executionError,
            runMeta
        });

        summary.processed += 1;
    }

    console.log('[AlertEngine] Proceso finalizado:', summary);
    return summary;
}
                    
