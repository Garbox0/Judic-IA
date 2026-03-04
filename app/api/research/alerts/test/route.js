import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';
import { fetchCsjnDailySorteos } from '@/lib/csjnSorteos';
import {
    buildAlertRunMeta,
    computeNewMatches,
    loadAlertSeenIds
} from '@/lib/alertDedupe';
import {
    applyCsjnAlertFilters,
    hasCsjnAlertFilters,
    normalizeCsjnAlertFilters
} from '@/lib/csjnAlertFilters';

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

function buildSearchTerms(query) {
    const normalized = normalizeText(query);
    if (!normalized) return [];

    return normalized
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);
}

function normalizeDateInput(value) {
    const text = cleanText(value);
    if (!text) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }

    const arDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (arDateMatch) {
        const day = arDateMatch[1].padStart(2, '0');
        const month = arDateMatch[2].padStart(2, '0');
        const year = arDateMatch[3];
        return `${year}-${month}-${day}`;
    }

    return 'INVALID';
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

async function safeLogExecution(
    supabase,
    alertId,
    resultCount,
    newCount,
    errorMessage = null,
    runMeta = null
) {
    if (!alertId) return;

    const nowIso = new Date().toISOString();

    try {
        const firstTry = await supabase
            .from('case_alerts')
            .update({
                last_run_at: nowIso,
                last_result_count: resultCount,
                last_new_count: newCount
            })
            .eq('id', alertId);

        if (firstTry.error && /column .* does not exist/i.test(firstTry.error.message || '')) {
            const secondTry = await supabase
                .from('case_alerts')
                .update({
                    last_run_at: nowIso,
                    last_result_count: resultCount
                })
                .eq('id', alertId);

            if (secondTry.error && /column .* does not exist/i.test(secondTry.error.message || '')) {
                await supabase
                    .from('case_alerts')
                    .update({ last_run_at: nowIso })
                    .eq('id', alertId);
            }
        }

        const metadataErrorMessage = !errorMessage && runMeta
            ? `ALERT_META:${JSON.stringify(runMeta)}`
            : (errorMessage || null);

        await supabase
            .from('case_alerts_log')
            .insert({
                alert_id: alertId,
                results_found: resultCount,
                status: errorMessage ? 'error' : 'success',
                error_message: metadataErrorMessage
            });
    } catch (err) {
        console.error('[alerts/test] safeLogExecution error:', err?.message || err);
    }
}

export async function POST(request) {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let parsedBody = {};

    try {
        parsedBody = await request.json();
        const portal = cleanText(parsedBody?.portal || '');
        const query = cleanText(parsedBody?.query || '');
        const alertId = cleanText(parsedBody?.alertId || '');

        const requestedDate = normalizeDateInput(parsedBody?.date || '');
        const requestedFromDate = normalizeDateInput(parsedBody?.fromDate || parsedBody?.dateFrom || '');
        const requestedToDate = normalizeDateInput(parsedBody?.toDate || parsedBody?.dateTo || '');
        const csjnFilters = normalizeCsjnAlertFilters(parsedBody?.filters || {});

        if (!query || query.length < 3) {
            return NextResponse.json({ error: 'Query invalida (minimo 3 caracteres).' }, { status: 400 });
        }

        if ([requestedDate, requestedFromDate, requestedToDate].includes('INVALID')) {
            return NextResponse.json({ error: 'Fecha invalida. Usa YYYY-MM-DD o DD/MM/YYYY.' }, { status: 400 });
        }

        const hasRangeInput = Boolean(requestedFromDate || requestedToDate);
        if (hasRangeInput && (!requestedFromDate || !requestedToDate)) {
            return NextResponse.json({ error: 'Para rango de fechas debes enviar fromDate y toDate.' }, { status: 400 });
        }

        if (requestedDate && hasRangeInput) {
            return NextResponse.json({ error: 'Usa date exacta o fromDate/toDate, no ambos.' }, { status: 400 });
        }

        if (requestedFromDate && requestedToDate && requestedFromDate > requestedToDate) {
            return NextResponse.json({ error: 'fromDate no puede ser mayor que toDate.' }, { status: 400 });
        }

        // ── CSJN_SORTEOS ──────────────────────────────────────────
        if (portal === 'CSJN_SORTEOS') {
            if (alertId) {
                const { data: alertOwnership } = await supabase
                    .from('case_alerts')
                    .select('id')
                    .eq('id', alertId)
                    .eq('user_id', auth.user.id)
                    .maybeSingle();

                if (!alertOwnership) {
                    return NextResponse.json({ error: 'Alerta no encontrada o sin permisos.' }, { status: 403 });
                }
            }

            const sorteos = await fetchCsjnDailySorteos({
                exactDate: requestedDate || null,
                fromDate: requestedFromDate || null,
                toDate: requestedToDate || null,
                filters: csjnFilters
            });

            const scopedCases = applyCsjnAlertFilters(sorteos.cases, csjnFilters);
            const matches = matchSorteosByEntity(query, scopedCases);

            let newMatches = matches;
            let newCount = matches.length;
            let runMeta = null;

            if (alertId) {
                const seenIds = await loadAlertSeenIds(supabase, alertId);
                const dedupe = computeNewMatches(matches, seenIds);
                newMatches = dedupe.new_matches;
                newCount = dedupe.new_count;
                runMeta = {
                    ...buildAlertRunMeta({
                        seenIds: dedupe.seen_ids_next,
                        newCount,
                        sourceDateIso: sorteos.source_date_iso,
                        requestedDateIso: sorteos.requested_date_iso || requestedDate || null,
                        requestedRangeFromIso: sorteos.requested_range_from_iso || requestedFromDate || null,
                        requestedRangeToIso: sorteos.requested_range_to_iso || requestedToDate || null
                    }),
                    scoped_dataset_total: scopedCases.length,
                    applied_filters: hasCsjnAlertFilters(csjnFilters) ? csjnFilters : null
                };
            }

            await safeLogExecution(supabase, alertId || null, matches.length, newCount, null, runMeta);

            return NextResponse.json({
                ok: true,
                portal,
                query,
                run_at: new Date().toISOString(),
                requested_date_iso: requestedDate || null,
                requested_range_from_iso: requestedFromDate || null,
                requested_range_to_iso: requestedToDate || null,
                source_date: sorteos.source_date,
                source_date_iso: sorteos.source_date_iso,
                source_url: sorteos.source_url,
                dataset_total: sorteos.total,
                scoped_dataset_total: scopedCases.length,
                applied_filters: hasCsjnAlertFilters(csjnFilters) ? csjnFilters : null,
                matches_total: matches.length,
                new_matches_total: newCount,
                matches: matches.slice(0, 25).map((m) => ({
                    id: m.id,
                    assigned_date: m.assigned_date,
                    expediente: m.expediente,
                    dependencia_asignada: m.dependencia_asignada,
                    denunciantes: m.denunciantes,
                    denunciados: m.denunciados,
                    delitos: m.delitos,
                    match_score: m.match_score
                })),
                new_matches: newMatches.slice(0, 25).map((m) => ({
                    id: m.id,
                    assigned_date: m.assigned_date,
                    expediente: m.expediente,
                    dependencia_asignada: m.dependencia_asignada,
                    denunciantes: m.denunciantes,
                    denunciados: m.denunciados,
                    delitos: m.delitos,
                    match_score: m.match_score
                }))
            });

            // ── PJN ───────────────────────────────────────────────────
        } else if (portal === 'PJN') {
            if (alertId) {
                const { data: alertOwnership } = await supabase
                    .from('case_alerts')
                    .select('id')
                    .eq('id', alertId)
                    .eq('user_id', auth.user.id)
                    .maybeSingle();
                if (!alertOwnership) {
                    return NextResponse.json({ error: 'Alerta no encontrada o sin permisos.' }, { status: 403 });
                }
            }

            const { searchByParte, searchByExpediente } = await import('@/lib/captchaSolver.js');
            const jurisdictionId = cleanText(parsedBody?.jurisdictionId || '1');
            const inferredType = /\d{1,8}\s*\/\s*\d{4}/.test(query) ? 'por_expediente' : 'por_parte';
            const queryType = cleanText(parsedBody?.queryType || '') || inferredType;

            let rawResults = [];

            if (queryType.includes('expediente')) {
                const expMatch = query.match(/(\d{1,8})\s*\/\s*(\d{4})/);
                if (!expMatch) {
                    return NextResponse.json({ error: 'Formato de expediente inválido. Usar NNNN/AAAA.' }, { status: 400 });
                }
                const pjnResult = await searchByExpediente({
                    jurisdiccion: jurisdictionId,
                    numero: expMatch[1],
                    anio: expMatch[2]
                });
                if (pjnResult?.error) throw new Error(pjnResult.error);
                rawResults = pjnResult?.results || [];
            } else {
                const pjnResult = await searchByParte({
                    jurisdiccion: jurisdictionId,
                    nombre: query
                });
                if (pjnResult?.error) throw new Error(pjnResult.error);
                rawResults = pjnResult?.results || [];
            }

            const matches = rawResults.map((r) => ({
                ...r,
                id: cleanText(r.expediente || `${r.caratula}-${r.dependencia}`),
                dependencia_asignada: r.dependencia || '-',
                assigned_date: r.ultimaActuacion || '-',
                caratula: r.caratula || '-',
            }));

            let newMatches = matches;
            let newCount = matches.length;
            let runMeta = null;

            if (alertId) {
                const seenIds = await loadAlertSeenIds(supabase, alertId);
                const dedupe = computeNewMatches(matches, seenIds);
                newMatches = dedupe.new_matches;
                newCount = dedupe.new_count;
                runMeta = buildAlertRunMeta({
                    seenIds: dedupe.seen_ids_next,
                    newCount,
                    sourceDateIso: new Date().toISOString().split('T')[0],
                });
            }

            await safeLogExecution(supabase, alertId || null, matches.length, newCount, null, runMeta);

            return NextResponse.json({
                ok: true,
                portal,
                query,
                run_at: new Date().toISOString(),
                matches_total: matches.length,
                new_matches_total: newCount,
                matches: matches.slice(0, 25).map((m) => ({
                    id: m.id,
                    expediente: m.expediente,
                    caratula: m.caratula,
                    dependencia_asignada: m.dependencia_asignada,
                    assigned_date: m.assigned_date,
                    situacion: m.situacion,
                    fuero: m.fuero,
                })),
                new_matches: newMatches.slice(0, 25).map((m) => ({
                    id: m.id,
                    expediente: m.expediente,
                    caratula: m.caratula,
                    dependencia_asignada: m.dependencia_asignada,
                    assigned_date: m.assigned_date,
                    situacion: m.situacion,
                    fuero: m.fuero,
                }))
            });

            // ── SCBA ──────────────────────────────────────────────────
        } else if (portal === 'SCBA') {
            if (alertId) {
                const { data: alertOwnership } = await supabase
                    .from('case_alerts')
                    .select('id')
                    .eq('id', alertId)
                    .eq('user_id', auth.user.id)
                    .maybeSingle();
                if (!alertOwnership) {
                    return NextResponse.json({ error: 'Alerta no encontrada o sin permisos.' }, { status: 403 });
                }
            }

            const { searchMEVByName } = await import('@/lib/scbaMevSolver.js');
            const scbaJurisdiction = cleanText(parsedBody?.jurisdictionId || 'LP');

            const scbaResult = await searchMEVByName({
                nombre: query,
                jurisdiccionId: scbaJurisdiction,
                maxOrganismos: 4,
            });

            if (scbaResult.error) throw new Error(scbaResult.error);

            const matches = (scbaResult.results || []).map((r) => ({
                ...r,
                id: cleanText(r.nroExpediente || r.nroCausa || `${r.caratula}-${r.organismo}`),
                expediente: r.nroExpediente || r.nroCausa || '-',
                caratula: r.caratula || '-',
                dependencia_asignada: r.organismo || r.jurisdiccion || '-',
                assigned_date: r.fecha || '-',
            }));

            let newMatches = matches;
            let newCount = matches.length;
            let runMeta = null;

            if (alertId) {
                const seenIds = await loadAlertSeenIds(supabase, alertId);
                const dedupe = computeNewMatches(matches, seenIds);
                newMatches = dedupe.new_matches;
                newCount = dedupe.new_count;
                runMeta = buildAlertRunMeta({
                    seenIds: dedupe.seen_ids_next,
                    newCount,
                    sourceDateIso: new Date().toISOString().split('T')[0],
                });
            }

            await safeLogExecution(supabase, alertId || null, matches.length, newCount, null, runMeta);

            return NextResponse.json({
                ok: true,
                portal,
                query,
                run_at: new Date().toISOString(),
                matches_total: matches.length,
                new_matches_total: newCount,
                matches: matches.slice(0, 25).map((m) => ({
                    id: m.id,
                    expediente: m.expediente,
                    caratula: m.caratula,
                    dependencia_asignada: m.dependencia_asignada,
                    assigned_date: m.assigned_date,
                })),
                new_matches: newMatches.slice(0, 25).map((m) => ({
                    id: m.id,
                    expediente: m.expediente,
                    caratula: m.caratula,
                    dependencia_asignada: m.dependencia_asignada,
                    assigned_date: m.assigned_date,
                }))
            });

            // ── Portal no soportado ───────────────────────────────────
        } else {
            return NextResponse.json({
                error: 'Portal no soportado.',
                supported: ['CSJN_SORTEOS', 'PJN', 'SCBA']
            }, { status: 400 });
        }

    } catch (error) {
        console.error('[alerts/test] Error:', error);

        const catchAlertId = cleanText(parsedBody?.alertId || '');
        await safeLogExecution(supabase, catchAlertId || null, 0, 0, error?.message || 'ERROR', null);

        return NextResponse.json({
            ok: false,
            error: error?.message || 'No se pudo ejecutar la busqueda inmediata.'
        }, { status: 500 });
    }
}
