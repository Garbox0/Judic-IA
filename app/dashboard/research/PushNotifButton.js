"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export default function PushNotifButton() {
    const [status, setStatus] = useState('idle'); // idle | loading | active | unsupported | error
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setStatus('unsupported');
            return;
        }

        // Register SW and check existing subscription
        navigator.serviceWorker.register('/sw.js').then(async reg => {
            const existing = await reg.pushManager.getSubscription();
            if (existing) setStatus('active');
        }).catch(() => {
            setStatus('unsupported');
        });
    }, []);

    async function handleActivate() {
        setStatus('loading');
        setErrorMsg('');

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setStatus('idle');
                setErrorMsg('Permiso denegado. Habilitalo en la configuracion del navegador.');
                return;
            }

            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setStatus('idle');
                setErrorMsg('No hay sesion activa.');
                return;
            }

            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });

            if (!res.ok) {
                throw new Error('No se pudo guardar la suscripcion.');
            }

            setStatus('active');
        } catch (err) {
            console.error('[PushNotifButton]', err);
            setStatus('error');
            setErrorMsg(err?.message || 'Error al activar notificaciones.');
        }
    }

    async function handleDeactivate() {
        setStatus('loading');
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();

            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await fetch('/api/push/unsubscribe', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${session.access_token}` }
                });
            }
            setStatus('idle');
        } catch (err) {
            console.error('[PushNotifButton] deactivate error:', err);
            setStatus('active'); // revert
        }
    }

    if (status === 'unsupported') return null;

    if (status === 'active') {
        return (
            <button
                type="button"
                className="push-notif-btn push-notif-btn--active"
                onClick={handleDeactivate}
                title="Desactivar notificaciones push"
            >
                Notificaciones activas ✓
            </button>
        );
    }

    return (
        <span className="push-notif-wrapper">
            <button
                type="button"
                className="push-notif-btn"
                onClick={handleActivate}
                disabled={status === 'loading'}
            >
                {status === 'loading' ? 'Activando…' : 'Activar notificaciones'}
            </button>
            {(status === 'error' || errorMsg) && (
                <span className="push-notif-error">{errorMsg}</span>
            )}
        </span>
    );
}
