/* Úkolníček – Service Worker (offline režim)
   Při každé nové verzi aplikace zvyš VERSION, jinak si telefony nechají starou verzi. */
const VERSION = 'ukolnicek-v2.1.0';
const RUNTIME = 'ukolnicek-runtime';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './storage.js',
  './driveSync.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
  // nečekáme automaticky: aplikace nabídne „Obnovit“, pak pošle skipWaiting
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google přihlášení a Drive API nikdy necachovat
  if (/(^|\.)googleapis\.com$/.test(url.hostname) && url.hostname !== 'fonts.googleapis.com') return;
  if (url.hostname === 'accounts.google.com') return;

  // písma: z mezipaměti, na pozadí aktualizovat
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(RUNTIME).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // stránka: vždy z mezipaměti (funguje offline), nová verze se pozná přes aktualizaci SW
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((hit) => hit || fetch(req)));
    return;
  }

  // ostatní soubory aplikace: nejdřív mezipaměť, pak síť
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
