const CACHE_NAME = 'english-app-v5';
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

// Fetch - cache first, then network
self.addEventListener('fetch', e => {
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

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_ALARMS') {
    scheduleAlarms(e.data.alarms || []);
  }
});

function scheduleAlarms(alarms) {
  alarmTimers.forEach(t => clearTimeout(t));
  alarmTimers = [];

  const now = new Date();
  const jsDay = now.getDay();
  const today = jsDay === 0 ? 6 : jsDay - 1;

  alarms.forEach(alarm => {
    if (!alarm.enabled) return;
    const [h, m] = alarm.time.split(':').map(Number);

    for (let offset = 0; offset < 7; offset++) {
      const checkDay = (today + offset) % 7;
      if (!alarm.days.includes(checkDay)) continue;

      let target = new Date();
      target.setDate(target.getDate() + offset);
      target.setHours(h, m, 0, 0);
      if (target <= now && offset === 0) continue;

      const delay = target - now;
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const timer = setTimeout(() => {
          self.registration.showNotification('English Daily Practice', {
            body: 'Bugunun kelimelerini calistinmi? Hadi pratik yapalim!',
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag: 'alarm-' + alarm.id,
            renotify: true,
            actions: [{ action: 'open', title: 'Basla' }]
          });
          scheduleAlarms(alarms);
        }, delay);
        alarmTimers.push(timer);
      }
      break;
    }
  });
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
