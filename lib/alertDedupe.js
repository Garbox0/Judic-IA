const ALERT_META_PREFIX = 'ALERT_META:';

function cleanText(value) {
    return String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeIds(ids) {
    return (ids || [])
        .map((id) => cleanText(id))
        .filter(Boolean);
}

export function parseAlertMeta(value) {
    const raw = cleanText(value);
    if (!raw.startsWith(ALERT_META_PREFIX)) return null;

    const jsonText = raw.slice(ALERT_META_PREFIX.length);
    try {
        const parsed = JSON.parse(jsonText);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export function serializeAlertMeta(meta) {
    const safeMeta = meta && typeof meta === 'object' ? meta : {};
    return `${ALERT_META_PREFIX}${JSON.stringify(safeMeta)}`;
}

export function mergeSeenIds(previousIds = [], currentIds = [], maxSize = 2000) {
    const ordered = [...normalizeIds(previousIds), ...normalizeIds(currentIds)];
    const deduped = [];
    const seen = new Set();

    for (const id of ordered) {
        if (seen.has(id)) continue;
        seen.add(id);
        deduped.push(id);
    }

    if (deduped.length <= maxSize) return deduped;
    return deduped.slice(deduped.length - maxSize);
}

export function computeNewMatches(matches = [], previousSeenIds = []) {
    const seen = new Set(normalizeIds(previousSeenIds));
    const newMatches = [];

    for (const match of matches || []) {
        const id = cleanText(match?.id || '');
        if (!id) continue;
        if (!seen.has(id)) {
            newMatches.push(match);
        }
    }

    const currentIds = normalizeIds((matches || []).map((m) => m?.id));
    return {
        new_matches: newMatches,
        new_count: newMatches.length,
        seen_ids_next: mergeSeenIds(previousSeenIds, currentIds)
    };
}

export async function loadAlertSeenIds(supabase, alertId, limit = 40) {
    if (!supabase || !alertId) return [];

    try {
        const { data, error } = await supabase
            .from('case_alerts_log')
            .select('error_message, created_at')
            .eq('alert_id', alertId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[alertDedupe] loadAlertSeenIds error:', error.message);
            return [];
        }

        for (const row of data || []) {
            const meta = parseAlertMeta(row?.error_message || '');
            if (meta?.seen_ids && Array.isArray(meta.seen_ids)) {
                return normalizeIds(meta.seen_ids);
            }
        }

        return [];
    } catch (err) {
        console.error('[alertDedupe] loadAlertSeenIds exception:', err?.message || err);
        return [];
    }
}

export function buildAlertRunMeta({
    seenIds = [],
    newCount = 0,
    runAt = null,
    sourceDateIso = null,
    requestedDateIso = null,
    requestedRangeFromIso = null,
    requestedRangeToIso = null,
    samples = [],
} = {}) {
    return {
        seen_ids: normalizeIds(seenIds),
        new_count: Math.max(0, Number(newCount) || 0),
        run_at: runAt || new Date().toISOString(),
        source_date_iso: sourceDateIso || null,
        requested_date_iso: requestedDateIso || null,
        requested_range_from_iso: requestedRangeFromIso || null,
        requested_range_to_iso: requestedRangeToIso || null,
        samples: (samples || []).slice(0, 5).map(s => ({
            id:         String(s?.id || ''),
            expediente: String(s?.expediente || s?.nroExpediente || '-').slice(0, 60),
            caratula:   String(s?.caratula || s?.autos || [s?.denunciantes, s?.denunciados].filter(Boolean).join(' c/ ') || '-').slice(0, 120),
            link:       String(s?.link || s?.url || ''),
        })).filter(s => s.id),
    };
}

export { ALERT_META_PREFIX };
