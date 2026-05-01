const CACHE_NAME = 'english-app-v16';
const ASSETS = [
  './',
  './index.html',
  './wordlist_final.json',
  './patterns.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install - cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - network-first for JSON, cache-first for others
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Bypass SW for cross-origin (Firebase, Google APIs, CDNs)
  if (url.includes('firebaseio.com') || url.includes('googleapis.com') ||
      url.includes('gstatic.com') || url.includes('firebasestorage') ||
      url.includes('firebaseapp.com') || !url.startsWith(self.location.origin)) {
    return;
  }

  // Network-first for HTML and JSON (fresh content when online)
  const isHTML = e.request.mode === 'navigate' ||
                 url.endsWith('.html') ||
                 url.endsWith('/') ||
                 (e.request.headers.get('accept') || '').includes('text/html');
  const isJSON = url.endsWith('.json') && !url.includes('manifest');

  if (isHTML || isJSON) {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets (images, css, fonts, etc.)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('./index.html'))
  );
});

// Alarm system
let alarmTimers = [];
const SUPPORTS_TRIGGER = 'showTrigger' in Notification.prototype;

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_ALARMS') {
    scheduleAlarms(e.data.alarms || []);
  } else if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function scheduleAlarms(alarms) {
  // Clear timeout-based timers
  alarmTimers.forEach(t => clearTimeout(t));
  alarmTimers = [];

  // Clear previously-scheduled trigger notifications
  if (SUPPORTS_TRIGGER) {
    try {
      const existing = await self.registration.getNotifications({ includeTriggered: true });
      for (const n of existing) {
        if (n.tag && n.tag.startsWith('alarm-')) n.close();
      }
    } catch(e) {}
  }

  const now = new Date();
  const jsDay = now.getDay();
  const today = jsDay === 0 ? 6 : jsDay - 1;

  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const [h, m] = alarm.time.split(':').map(Number);

    // Schedule for next 14 days using TimestampTrigger (survives SW death)
    // Without trigger support, only schedule for next 24h via setTimeout (less reliable on mobile)
    const daysToSchedule = SUPPORTS_TRIGGER ? 14 : 1;

    for (let offset = 0; offset < daysToSchedule; offset++) {
      const checkDay = (today + offset) % 7;
      if (!alarm.days.includes(checkDay)) continue;

      const target = new Date();
      target.setDate(target.getDate() + offset);
      target.setHours(h, m, 0, 0);
      if (target <= now) continue;

      const body = alarm.note && alarm.note.trim() ? alarm.note : 'Bugunun kelimelerini calistinmi? Hadi pratik yapalim!';
      const opts = {
        body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: 'alarm-' + alarm.id + '-' + target.getTime(),
        renotify: true,
        requireInteraction: false,
        actions: [{ action: 'open', title: 'Basla' }]
      };

      if (SUPPORTS_TRIGGER) {
        // Schedule notification with OS - works even when SW is killed
        opts.showTrigger = new TimestampTrigger(target.getTime());
        try {
          await self.registration.showNotification('English Daily Practice', opts);
        } catch(e) {
          console.warn('Trigger schedule failed:', e);
        }
      } else {
        // Fallback: setTimeout (only fires if SW alive)
        const delay = target - now;
        if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
          const timer = setTimeout(() => {
            self.registration.showNotification('English Daily Practice', opts);
            scheduleAlarms(alarms);
          }, delay);
          alarmTimers.push(timer);
        }
        break; // only schedule next occurrence in fallback mode
      }
    }
  }
}

// Notification click - open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('./index.html');
    })
  );
});
