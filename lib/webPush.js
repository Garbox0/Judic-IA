/**
 * Web Push helper
 * Requires: npm install web-push
 * Env vars: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
 */
import webpush from 'web-push';

let vapidConfigured = false;

function ensureVapid() {
    if (vapidConfigured) return;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL || 'mailto:info@judic-ia.com';

    if (!publicKey || !privateKey) {
        throw new Error('[webPush] Faltan VAPID keys en env: NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY');
    }

    webpush.setVapidDetails(email, publicKey, privateKey);
    vapidConfigured = true;
}

/**
 * Send a push notification to a browser subscription.
 * @param {object} subscription - PushSubscription object (from browser / saved in DB)
 * @param {{ title: string, body: string, url: string }} payload
 * @returns {Promise<boolean>} true if sent, false if subscription is gone (410/404)
 */
export async function sendPushNotification(subscription, payload) {
    if (!subscription?.endpoint) return false;

    try {
        ensureVapid();
        await webpush.sendNotification(
            subscription,
            JSON.stringify({
                title: payload?.title || 'Judic-IA',
                body: payload?.body || '',
                url: payload?.url || '/dashboard/research',
            })
        );
        return true;
    } catch (err) {
        const status = err?.statusCode || err?.status;
        // 410 Gone / 404 Not Found means subscription is no longer valid
        if (status === 410 || status === 404) {
            return false;
        }
        console.error('[webPush] sendPushNotification error:', err?.message || err);
        return false;
    }
}
