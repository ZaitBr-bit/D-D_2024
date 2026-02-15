// Service Worker para PWA D&D 5.5 Ficha de Personagem
const CACHE_NAME = 'dnd-ficha-v2';

// Arquivos estáticos do site
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/store.js',
  './js/utils.js',
  './js/dados-classes.js',
  './js/pages/home.js',
  './js/pages/creator.js',
  './js/pages/sheet.js'
];

// Arquivos JSON de dados (cache sob demanda)
const DATA_PREFIX = '../dados/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Escuta mensagens do cliente para controlar a atualização
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache dados JSON quando acessados pela primeira vez
        if (response.ok && event.request.url.includes('/dados/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Fallback offline para navegação
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
