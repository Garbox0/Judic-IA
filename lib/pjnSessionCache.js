/**
 * Cache en memoria para cookies de sesión del PJN SCW.
 * Permite que el proxy /api/pjn/doc acceda a documentos
 * sin lanzar un nuevo Puppeteer ni resolver otro captcha.
 *
 * TTL: 20 minutos (la sesión JSF de PJN suele durar ~30 min de inactividad).
 */

const TTL_MS = 20 * 60 * 1000;

// Map<token, { cookies: string, expiresAt: number }>
const _cache = new Map();

/**
 * Guarda cookies de sesión y devuelve un token de acceso.
 * @param {string} cookieHeader  Valor del header Cookie (e.g. "JSESSIONID=abc123; ...")
 * @returns {string} token UUID
 */
export function storePjnSession(cookieHeader) {
    const token = crypto.randomUUID();
    _cache.set(token, {
        cookies:   cookieHeader,
        expiresAt: Date.now() + TTL_MS,
    });
    _cleanExpired();
    return token;
}

/**
 * Recupera las cookies de sesión por token.
 * @param {string} token
 * @returns {string|null}
 */
export function getPjnSession(token) {
    const entry = _cache.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        _cache.delete(token);
        return null;
    }
    // Renovar TTL en cada acceso
    entry.expiresAt = Date.now() + TTL_MS;
    return entry.cookies;
}

function _cleanExpired() {
    const now = Date.now();
    for (const [key, val] of _cache.entries()) {
        if (now > val.expiresAt) _cache.delete(key);
    }
}
