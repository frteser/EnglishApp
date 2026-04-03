const CACHE_NAME = 'english-app-v1';
const ASSETS = [
  './',
  './index.html',
  './wordlist_final.json',
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

// Daily notification check
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATION') {
    scheduleDaily(e.data.hour, e.data.minute);
  }
});

function scheduleDaily(hour, minute) {
  const now = new Date();
  let target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const delay = target - now;
  setTimeout(() => {
    self.registration.showNotification('English Daily Practice', {
      body: 'Bugunun 5 kelimesi seni bekliyor! Hadi pratik yapalim.',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'daily-reminder',
      renotify: true,
      actions: [
        { action: 'open', title: 'Basla' }
      ]
    });
    // Reschedule for next day
    scheduleDaily(hour, minute);
  }, delay);
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
