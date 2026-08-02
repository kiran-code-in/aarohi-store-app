const CACHE = 'aarohi-v10';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './logo.png',
  './data/products.json',
  './js/storage.js',
  './js/data.js',
  './js/sheets-sync.js',
  './js/pricing.js',
  './js/inventory.js',
  './js/wholesale.js',
  './js/retail.js',
  './js/scan.js',
  './js/history.js',
  './js/prices-page.js',
  './js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});
