/**
 * 🛡️ Input Validation Helpers
 * Use these before any DB query that accepts user-supplied IDs or emails.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates a UUID v4 string.
 * Rejects nulls, objects, arrays, oversized strings, and malformed values.
 */
export function isValidUUID(value) {
    return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Validates an email address format.
 * Does not do DNS lookup — just structural validation.
 */
export function isValidEmail(value) {
    return (
        typeof value === 'string' &&
        value.length <= 320 &&        // RFC 5321 max
        EMAIL_REGEX.test(value.trim())
    );
}

/**
 * Validates a non-empty string with a max length.
 * Prevents oversized payloads from reaching the DB.
 */
export function isValidString(value, maxLength = 500) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}
