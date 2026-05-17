const CACHE_NAME = 'poultry-farm-v8';
const urlsToCache = [
  '.',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://unpkg.com/html5-qrcode',
  'https://cdn.jsdelivr.net/npm/tesseract.js@2/dist/tesseract.min.js',
  'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_ALERT') {
    self.registration.showNotification('تنبيه المزرعة', {
      body: event.data.body,
      icon: 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNjQgNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMyYzNlNTAiLz48cGF0aCBkPSJNMjAgMzJjMC02IDgtMTIgMTItMTJzMTIgNiAxMiAxMi04IDEyLTEyIDEyLTEyLTYtMTItMTJ6IiBmaWxsPSIjZWNmMGYxIi8+PC9zdmc+',
      vibrate: [200, 100, 200]
    });
  }
});
