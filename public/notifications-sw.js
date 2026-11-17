// Service Worker dedicado para Notificações Agendadas e Push em Segundo Plano (Lagos Credit)
const scheduledTimers = new Map();
const firedTodayTags = new Set();

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function clearAllScheduledTimers() {
  for (const timerId of scheduledTimers.values()) {
    clearTimeout(timerId);
  }
  scheduledTimers.clear();
}

async function displayCollectionNotification(payload) {
  const title = payload.title || 'Lagos Credit • Cobranças do Dia';
  const tag = payload.tag || 'lagos-credit-daily';
  if (tag && firedTodayTags.has(tag)) {
    return;
  }
  if (tag) {
    firedTodayTags.add(tag);
  }

  await self.registration.showNotification(title, {
    body: payload.body || 'Você possui cobranças pendentes para acompanhar hoje.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag,
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    data: payload.data || { tab: 'home' }
  });
}

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'SHOW_NOTIFICATION' && msg.payload) {
    event.waitUntil(displayCollectionNotification(msg.payload));
    return;
  }

  if (msg.type === 'CLEAR_REMINDERS') {
    clearAllScheduledTimers();
    return;
  }

  if (msg.type === 'SYNC_REMINDERS' && Array.isArray(msg.items)) {
    clearAllScheduledTimers();
    const now = Date.now();
    // Schedule up to 24h ahead inside the active Service Worker
    const MAX_DELAY_MS = 24 * 60 * 60 * 1000;

    msg.items.forEach((item) => {
      if (!item || !item.triggerAtMs || !item.payload) return;
      const delay = item.triggerAtMs - now;
      if (delay >= 0 && delay <= MAX_DELAY_MS) {
        const timerId = setTimeout(() => {
          scheduledTimers.delete(item.id);
          displayCollectionNotification(item.payload);
        }, delay);
        scheduledTimers.set(item.id, timerId);
      }
    });
  }
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Lagos Credit • Cobranças do Dia',
    body: 'Confira os recebimentos pendentes de hoje.',
    tag: 'lagos-credit-push',
    data: { tab: 'home' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(displayCollectionNotification(payload));
});

self.addEventListener('notificationclick', (event) => {
  const targetTab = (event.notification && event.notification.data && event.notification.data.tab) || 'home';
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_NAVIGATE', tab: targetTab });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    })
  );
});
