// Service Worker para PWA D&D 5.5 Ficha de Personagem
// CACHE_VERSION é substituído automaticamente pelo número do run do GitHub Actions a cada deploy
const CACHE_VERSION = 0; // AUTO
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
  './js/sync.js',
  './js/utils.js',
  './js/dados-classes.js',
  './js/levelup.js',
  './js/pages/home.js',
  './js/pages/creator.js',
  './js/pages/sheet.js',
  './js/auth.js',
  './js/vendor/pdf-lib.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    // Cachear individualmente: um asset que falhe (404 / rede) NAO pode abortar
    // todo o precache — comportamento do cache.addAll — o que deixaria o app sem
    // shell offline. allSettled garante que os demais sejam cacheados mesmo assim.
    await Promise.allSettled(
      STATIC_ASSETS.map(async (url) => {
        try {
          const resp = await fetch(url, { cache: 'no-store' });
          if (resp.ok) await cache.put(url, resp.clone());
        } catch (e) {
          // asset indisponivel no install; sera cacheado on-demand pelo fetch handler
        }
      })
    );

    // Precache dos dados de jogo (classes, magias, especies...) para ficha offline.
    // A lista e gerada no deploy (dados-precache.json). Local/dev pode nao existir:
    // nesse caso os dados sao cacheados on-demand pelo fetch handler.
    try {
      const respLista = await fetch('./dados-precache.json', { cache: 'no-store' });
      if (respLista.ok) {
        const lista = await respLista.json();
        const cacheData = await caches.open(CACHE_DATA);
        await Promise.allSettled(
          lista.map(async (dadoUrl) => {
            try {
              const r = await fetch(dadoUrl, { cache: 'no-store' });
              if (r.ok) await cacheData.put(dadoUrl, r.clone());
            } catch (e) { /* ignora arquivo indisponivel */ }
          })
        );
      }
    } catch (e) {
      // sem manifesto (dev): dados serao cacheados on-demand
    }
  })());
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

  // Ignorar esquemas que o Cache API não suporta (ex: chrome-extension://)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Firebase e APIs Google: sempre rede, nunca cachear
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com') || url.hostname.includes('firebaseapp.com') || url.hostname.includes('firebaseio.com')) {
    return;
  }

  // Navegacao: rede primeiro; offline serve o shell cacheado (nunca null)
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        const cache = await caches.open(CACHE_STATIC);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(request))
          || (await caches.match('./index.html'))
          || new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>'
            + '<p>App indisponivel offline. Abra online uma vez para instalar.</p>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
      }
    })());
    return;
  }

  // Dados JSON (/dados/): rede primeiro, cache para offline; nunca null
  if (url.pathname.includes('/dados/')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh.ok) {
          const cache = await caches.open(CACHE_DATA);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return (await caches.match(request))
          || new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // Assets estaticos (JS, CSS, imagens): rede primeiro, fallback cache; nunca null
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|ico|svg|woff2?)$/)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh.ok) {
          const cache = await caches.open(CACHE_STATIC);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return (await caches.match(request))
          || new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Outras requisicoes (ex: manifest.json): rede, depois cache; nunca null
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch {
      return (await caches.match(request))
        || new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
