// Service worker: guarda o app no aparelho para funcionar sem internet.
// IMPORTANTE: ao publicar uma versão nova, mude o número abaixo (ex.: acende-v2).
const VERSION = 'acende-v1';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/input.js',
  './js/audio.js',
  './js/draw.js',
  './js/fx.js',
  './js/settings.js',
  './js/modes/cores.js',
  './js/modes/siga.js',
  './js/modes/bolhas.js',
  './js/modes/dianoite.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Responde do cache na hora e atualiza em segundo plano (stale-while-revalidate).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => null);
      if (cached) { event.waitUntil(network); return cached; }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }),
  );
});
