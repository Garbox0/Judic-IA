import { createClient } from '@supabase/supabase-js';
import { fetchCsjnDailySorteos } from './csjnSorteos.js';
import { Resend } from 'resend';
import { sendEmail } from '../app/lib/resend.js';
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

const PORTAL_LABELS = {
    PJN: 'Nacion y Federal',
    SCBA: 'Buenos Aires',
    CABA: 'Ciudad de Buenos Aires',
    CSJN_SORTEOS: 'Sorteos Federal'
};

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

function buildAlertSubject(alert) {
    const raw = cleanText(alert?.search_query || alert?.query_value || '');
    return raw || 'Alerta';
}

function buildMatchPreviewRows(matches = []) {
    return (matches || []).slice(0, 3).map((item) => {
        const expediente = cleanText(item?.expediente || '-');
        const dependencia = cleanText(item?.dependencia_asignada || '-');
        const fecha = cleanText(item?.assigned_date || '-');
        return `<tr>
            <td style="padding:8px;border-bottom:1px solid #1e293b;">${escapeHtml(expediente)}</td>
            <td style="padding:8px;border-bottom:1px solid #1e293b;">${escapeHtml(dependencia)}</td>
            <td style="padding:8px;border-bottom:1px solid #1e293b;">${escapeHtml(fecha)}</td>
        </tr>`;
    }).join('');
}

async function notifyAlertByEmail({
    resendClient,
    profile,
    alert,
    newCount,
    totalCount,
    sampleMatches
}) {
    const recipient = cleanText(profile?.email || '');
    if (!resendClient || !recipient) return false;

    const appUrl = cleanText(process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com');
    const dashboardUrl = `${appUrl.replace(/\/$/, '')}/dashboard/research`;
    const portal = cleanText(alert?.portal || '').toUpperCase();
    const portalLabel = PORTAL_LABELS[portal] || portal || 'Portal';
    const target = buildAlertSubject(alert);
    const firstName = cleanText((profile?.full_name || '').split(' ')[0] || 'Profesional');
    const rows = buildMatchPreviewRows(sampleMatches);

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#020617;color:#e2e8f0;border-radius:10px;border:1px solid #1e293b;">
            <h2 style="margin:0 0 8px;color:#f8fafc;">Nueva coincidencia en tus alertas</h2>
            <p style="margin:0 0 16px;color:#cbd5e1;">Hola ${escapeHtml(firstName)}, detectamos ${newCount} novedad(es) para <strong>${escapeHtml(target)}</strong>.</p>
            <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:12px 14px;margin-bottom:16px;">
                <p style="margin:0 0 6px;"><strong>Canal:</strong> ${escapeHtml(portalLabel)}</p>
                <p style="margin:0;"><strong>Coincidencias totales en corrida:</strong> ${Number(totalCount || 0)}</p>
            </div>
            ${rows ? `
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead>
                    <tr>
                        <th style="text-align:left;padding:8px;border-bottom:1px solid #334155;color:#94a3b8;">Expediente</th>
                        <th style="text-align:left;padding:8px;border-bottom:1px solid #334155;color:#94a3b8;">Dependencia</th>
                        <th style="text-align:left;padding:8px;border-bottom:1px solid #334155;color:#94a3b8;">Fecha</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>` : ''}
            <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#f59e0b;color:#111827;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700;">Ver alertas</a>
        </div>
    `;

    await sendEmail({
        resendClient,
        to: recipient,
        from: process.env.ALERTS_FROM_EMAIL || 'alerts@judic-ia.com',
        subject: `Judic-IA: ${newCount} nueva(s) coincidencia(s) para "${target}"`,
        html
    });

    return true;
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
        emails_sent: 0,
        email_errors: 0,
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
    const dueUserIds = [...new Set(dueAlerts.map((item) => item.user_id).filter(Boolean))];
    const profileByUserId = new Map();

    if (dueUserIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', dueUserIds);

        if (profileError) {
            console.error('[AlertEngine] No se pudo cargar emails de perfiles:', profileError.message);
        } else {
            for (const profile of profiles || []) {
                profileByUserId.set(profile.id, profile);
            }
        }
    }

    const resendClient = process.env.RESEND_API_KEY
        ? new Resend(process.env.RESEND_API_KEY)
        : null;

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
        let emailPayload = null;

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

                if (newCount > 0) {
                    emailPayload = {
                        newCount,
                        totalCount: resultCount,
                        sampleMatches: dedupeResult.new_matches
                    };
                }
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

        if (runStatus === 'success' && emailPayload?.newCount > 0) {
            const profile = profileByUserId.get(alert.user_id);
            try {
                const sent = await notifyAlertByEmail({
                    resendClient,
                    profile,
                    alert,
                    newCount: emailPayload.newCount,
                    totalCount: emailPayload.totalCount,
                    sampleMatches: emailPayload.sampleMatches
                });
                if (sent) summary.emails_sent += 1;
            } catch (emailErr) {
                summary.email_errors += 1;
                console.error(`[AlertEngine] Error enviando email de alerta ${alert.id}:`, emailErr?.message || emailErr);
            }
        }

        summary.processed += 1;
    }

    console.log('[AlertEngine] Proceso finalizado:', summary);
    return summary;
}
                    
