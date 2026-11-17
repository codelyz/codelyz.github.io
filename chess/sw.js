// Service worker: guarda os arquivos do app para funcionar sem internet.
// Ao mudar qualquer arquivo, aumente a versão abaixo para os aparelhos baixarem a nova.
const CACHE = 'xadrez-sob-medida-v3';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/main.js',
  './js/engine.js',
  './js/presets.js',
  './js/ai.js',
  './js/ai-client.js',
  './js/ai-worker.js',
  './js/ui.js',
  './js/pieces.js',
  './js/store.js',
  './js/describe.js',
  './js/board.js',
  './js/movegrid.js',
  './js/editor.js',
  './js/library.js',
  './js/play.js',
  './fonts/schola-regular.woff',
  './fonts/schola-bold.woff',
  './fonts/schola-italic.woff',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './img/para-will.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Responde com o que está guardado e atualiza em segundo plano
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
