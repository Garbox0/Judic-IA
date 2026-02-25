import { NextResponse } from 'next/server';
import { solvePJNCaptcha, getChallenge, solveImage, submitResponse } from '@/lib/captchaSolver';

/**
 * Test endpoint para el captcha solver del PJN.
 * GET /api/test-captcha?secret=...
 *
 * Ejecuta el flujo completo: challenge → OCR → verify → token
 */
export async function GET(request) {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const retries = parseInt(url.searchParams.get('retries') || '3');
    const startMs = Date.now();

    try {
        // Option 1: Full solver with retries
        const result = await solvePJNCaptcha(retries);

        return NextResponse.json({
            status: 'ok',
            solved: true,
            token: result.token,
            ocr: {
                raw: result.ocrResult.rawText,
                cleaned: result.ocrResult.solved,
                confidence: result.ocrResult.confidence,
            },
            attempt: result.attempt,
            duration_ms: Date.now() - startMs,
        });

    } catch (err) {
        // If full solver failed, show last attempt details
        let lastAttempt = null;
        try {
            const challenge = await getChallenge();
            const ocr = await solveImage(challenge.imageBase64);
            const submit = await submitResponse(ocr.solved);
            lastAttempt = {
                ocr_raw: ocr.rawText,
                ocr_cleaned: ocr.solved,
                ocr_confidence: ocr.confidence,
                submit_status: submit.status,
                submit_success: submit.success,
                submit_raw: submit.raw,
                image_preview: challenge.imageBase64.substring(0, 100) + '...',
            };
        } catch { /* ignore */ }

        return NextResponse.json({
            status: 'error',
            error: err.message,
            last_attempt: lastAttempt,
            duration_ms: Date.now() - startMs,
        }, { status: 500 });
    }
}
