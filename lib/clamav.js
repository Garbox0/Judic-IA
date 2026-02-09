/**
 * ClamAV Scanner Client
 * Connects to the ClamAV REST API on the VPS for malware scanning.
 */

const CLAMAV_API_URL = process.env.CLAMAV_API_URL || 'https://archivos.judic-ia.com';
const CLAMAV_API_KEY = process.env.CLAMAV_API_KEY;

/**
 * Scan a file buffer for malware.
 * @param {Buffer|Blob} fileData - The file content
 * @param {string} filename - Original filename
 * @returns {Promise<{clean: boolean, threat: string|null, size: number}>}
 */
export async function scanFile(fileData, filename = 'upload') {
    if (!CLAMAV_API_KEY) {
        console.warn('CLAMAV_API_KEY not configured - skipping scan');
        return { clean: true, threat: null, size: 0, skipped: true };
    }

    const formData = new FormData();
    const blob = fileData instanceof Blob ? fileData : new Blob([fileData]);
    formData.append('file', blob, filename);

    const response = await fetch(`${CLAMAV_API_URL}/scan`, {
        method: 'POST',
        headers: { 'X-API-Key': CLAMAV_API_KEY },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Scan service unavailable' }));
        throw new Error(error.error || `Scan failed with status ${response.status}`);
    }

    return response.json();
}

/**
 * Scan a URL for malware (downloads and scans on VPS).
 * @param {string} url - HTTPS URL to scan
 * @returns {Promise<{clean: boolean, threat: string|null, size: number}>}
 */
export async function scanUrl(url) {
    if (!CLAMAV_API_KEY) {
        console.warn('CLAMAV_API_KEY not configured - skipping scan');
        return { clean: true, threat: null, size: 0, skipped: true };
    }

    const response = await fetch(`${CLAMAV_API_URL}/scan-url`, {
        method: 'POST',
        headers: {
            'X-API-Key': CLAMAV_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Scan service unavailable' }));
        throw new Error(error.error || `Scan failed with status ${response.status}`);
    }

    return response.json();
}

/**
 * Check if ClamAV service is healthy.
 * @returns {Promise<{status: string, clamd: string}>}
 */
export async function healthCheck() {
    const response = await fetch(`${CLAMAV_API_URL}/health`, {
        method: 'GET',
    });
    return response.json();
}
