/**
 * 🛡️ Simple Rate Limiter for Serverless (Vercel Edge Compatible)
 * 
 * Uses in-memory Map for rate limiting. In production, this resets
 * on each cold start, but is still effective against burst attacks.
 * 
 * For persistent rate limiting, integrate Upstash Redis.
 */

const rateLimitMap = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitMap.entries()) {
        if (now - data.firstRequest > 60000) { // 1 minute window
            rateLimitMap.delete(key);
        }
    }
}, 300000);

/**
 * Check if a request should be rate limited
 * @param {string} identifier - Unique identifier (IP, userId, email)
 * @param {number} maxRequests - Max requests allowed in window
 * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 min)
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
export function checkRateLimit(identifier, maxRequests = 5, windowMs = 60000) {
    const now = Date.now();
    const key = identifier;

    let data = rateLimitMap.get(key);

    if (!data || (now - data.firstRequest > windowMs)) {
        // First request or window expired
        data = { count: 1, firstRequest: now };
        rateLimitMap.set(key, data);
        return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    // Within window
    data.count++;
    rateLimitMap.set(key, data);

    const resetIn = windowMs - (now - data.firstRequest);
    const remaining = Math.max(0, maxRequests - data.count);

    if (data.count > maxRequests) {
        return { allowed: false, remaining: 0, resetIn };
    }

    return { allowed: true, remaining, resetIn };
}

/**
 * Get client IP from request (Vercel/Cloudflare compatible)
 * @param {Request} request 
 * @returns {string}
 */
export function getClientIP(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return request.headers.get('x-real-ip') || '127.0.0.1';
}
