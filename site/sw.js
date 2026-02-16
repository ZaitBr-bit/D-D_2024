// Service Worker para PWA D&D 5.5 Ficha de Personagem
// Incrementar esta versão a cada deploy para forçar atualização dos caches
const CACHE_VERSION = 37;
const CACHE_STATIC = `dnd-ficha-static-v${CACHE_VERSION}`;
const CACHE_DATA = `dnd-ficha-data-v${CACHE_VERSION}`;

// Arquivos estáticos do site (versionados pelo cache)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/store.js',
  './js/utils.js',
  './js/dados-classes.js',
  './js/levelup.js',
  './js/pages/home.js',
  './js/pages/creator.js',
  './js/pages/sheet.js'
];

self.addEventListener('install', (event) => {
  // Forçar ativação imediata do novo SW (sem esperar abas fecharem)
  self.skipWaiting();
  // Pré-cachear assets estáticos na nova versão
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Limpar caches de versões anteriores
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_DATA)
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Escuta mensagens do cliente para controlar a atualização
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Limpar todos os caches manualmente (atualização forçada)
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((k) => caches.delete(k)));
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Navegação: Network-first com fallback pro cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Dados JSON (/dados/): Network-first com cache para offline
  if (url.pathname.includes('/dados/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_DATA).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Assets estáticos (JS, CSS, imagens): Network-first com fallback cache
  if (url.pathname.match(/\.(js|css|png|jpg|ico|svg|woff2?)$/)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Outras requisições: tentar rede, depois cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
