self.addEventListener('push', e => {
    const d = e.data?.json() || {};
    e.waitUntil(self.registration.showNotification(d.title || 'Judic-IA', {
        body: d.body || '',
        icon: '/logo-mark.png',
        badge: '/logo-mark.png',
        data: { url: d.url || '/dashboard/research' }
    }));
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(clients.openWindow(e.notification.data?.url || '/dashboard/research'));
});
