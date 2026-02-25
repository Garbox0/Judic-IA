/**
 * PJN Captcha Solver — solves captcha.pjn.gov.ar challenges via Tesseract.js OCR
 *
 * Flujo real del captcha PJN (confirmado por ingeniería inversa):
 *
 *  1. GET  captcha.pjn.gov.ar/api/challenge?sitekey=SCW
 *     → JSON { d: "<base64 JPEG image>" }
 *
 *  2. Tesseract OCR on the JPEG → text solution
 *
 *  3. POST captcha.pjn.gov.ar/api/challenge/response
 *     body: { sitekey: "SCW", response: "<solved text>" }
 *     → JSON { rt: "<response token>" }
 *
 *  4. Use `rt` as `captcha-response` in the SCW form POST
 */

import Tesseract from 'tesseract.js';

const CAPTCHA_API = 'https://captcha.pjn.gov.ar/api';
const SITEKEY = 'SCW';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Step 1: Get captcha challenge image (base64 JPEG)
 */
export async function getChallenge() {
    const res = await fetch(`${CAPTCHA_API}/challenge?sitekey=${SITEKEY}`, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
            'Referer': 'https://captcha.pjn.gov.ar/',
        },
        signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`CAPTCHA_CHALLENGE_HTTP_${res.status}`);

    const data = await res.json();

    if (!data.d) throw new Error('CAPTCHA_NO_IMAGE_DATA');

    console.log(`[CaptchaSolver] Got challenge, image data length: ${data.d.length}`);

    return {
        imageBase64: data.d,  // raw base64 JPEG
        rawResponse: data,    // full API response (may have other fields)
    };
}

/**
 * Step 2: Solve the captcha image with Tesseract OCR
 */
export async function solveImage(imageBase64) {
    // Convert base64 to Buffer for Tesseract
    const imgBuffer = Buffer.from(imageBase64, 'base64');

    console.log(`[CaptchaSolver] Running Tesseract OCR on ${imgBuffer.length} byte image...`);

    const result = await Tesseract.recognize(imgBuffer, 'eng', {
        logger: () => { }, // silence verbose logging
    });

    const rawText = result.data.text.trim();

    // PJN captchas are short alphanumeric text with some distortion
    // Clean: remove spaces and non-alphanumeric chars, keep digits/letters
    const solved = rawText
        .replace(/\s+/g, '')             // no spaces
        .replace(/[^a-zA-Z0-9]/g, '')    // only alphanumeric
        .substring(0, 10);               // captchas are short

    console.log(`[CaptchaSolver] OCR raw: "${rawText}" → cleaned: "${solved}" (confidence: ${result.data.confidence.toFixed(1)}%)`);

    return {
        rawText,
        solved,
        confidence: result.data.confidence,
    };
}

/**
 * Step 3: Submit solved captcha to get the response token
 */
export async function submitResponse(solvedText) {
    const res = await fetch(`${CAPTCHA_API}/challenge/response`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
            'Referer': 'https://captcha.pjn.gov.ar/',
            'Origin': 'https://captcha.pjn.gov.ar',
        },
        body: JSON.stringify({
            sitekey: SITEKEY,
            response: solvedText,
        }),
        signal: AbortSignal.timeout(10000),
    });

    const data = await res.json().catch(() => ({}));

    console.log(`[CaptchaSolver] Submit response (HTTP ${res.status}):`, JSON.stringify(data));

    return {
        success: res.ok && !!data.rt,
        token: data.rt || null,  // response token for the search form
        status: res.status,
        raw: data,
    };
}

/**
 * Full flow: get challenge → OCR → submit → return token
 * Retries up to maxRetries times (OCR can fail on noisy images)
 */
export async function solvePJNCaptcha(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[CaptchaSolver] ═══ Attempt ${attempt}/${maxRetries} ═══`);

            // 1. Get challenge
            const challenge = await getChallenge();

            // 2. OCR
            const ocr = await solveImage(challenge.imageBase64);
            if (!ocr.solved || ocr.solved.length < 2) {
                throw new Error(`OCR_TOO_SHORT: "${ocr.solved}" (raw: "${ocr.rawText}")`);
            }

            // 3. Submit
            const result = await submitResponse(ocr.solved);

            if (result.success && result.token) {
                console.log(`[CaptchaSolver] ✅ SUCCESS on attempt ${attempt}! Token: ${result.token.substring(0, 30)}...`);
                return {
                    token: result.token,
                    ocrResult: ocr,
                    attempt,
                };
            }

            // Not success — the answer was wrong
            console.warn(`[CaptchaSolver] ❌ Wrong answer on attempt ${attempt}: "${ocr.solved}"`);

        } catch (err) {
            console.warn(`[CaptchaSolver] Attempt ${attempt} error: ${err.message}`);
        }

        if (attempt < maxRetries) {
            // Brief pause before retry
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }

    throw new Error(`CAPTCHA_FAILED_AFTER_${maxRetries}_ATTEMPTS`);
}
