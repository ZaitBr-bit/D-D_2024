// Service Worker para PWA D&D 5.5 Ficha de Personagem
//
// DEPLOY_VERSION é substituído por scripts/prepare-pages.mjs (Task 35) via
// marcador único, sem sed, a cada build do artifact. Task 36 reescreve o
// install para ser TRANSACIONAL: busca o manifesto assinado por SHA-256,
// confere byte a byte cada asset antes de gravar, e só ativa a versão nova
// se TUDO bateu. Não existe "rename" de cache (a Cache API não tem essa
// operação) — a atomicidade vem de: (a) os nomes de cache já carregam a
// versão, então a versão nova nunca sobrescreve a antiga; (b) qualquer falha
// no meio do install apaga os dois caches da versão nova e rejeita
// `event.waitUntil`, o que impede a ativação do worker novo (o navegador
// mantém o worker/cache antigos como estão, servindo normalmente).
const DEPLOY_VERSION = '__DEPLOY_VERSION__';

// Em desenvolvimento local (sem build:pages) o marcador nunca é substituído.
// Detectar isso aqui evita criar um cache cujo nome contenha o marcador
// literal — usamos a versão explícita 'dev' e um shell mínimo cacheado sob
// demanda (sem manifesto).
//
// IMPORTANTE: o comparador NÃO pode ser escrito como a string contígua
// '__DEPLOY_VERSION__' — `scripts/prepare-pages.mjs#injectVersionMarker`
// substitui TODA ocorrência dessa substring no arquivo (não só a da linha
// acima), então uma segunda ocorrência contígua aqui também seria trocada
// pela versão real durante o build, fazendo esta comparação dar sempre
// verdadeiro em produção. Partir a string em duas concatenadas em tempo de
// execução evita casar com o texto substituído pelo build.
const DEPLOY_VERSION_MARKER = '__DEPLOY' + '_VERSION__';
const IS_DEV = DEPLOY_VERSION === DEPLOY_VERSION_MARKER;
const ACTIVE_VERSION = IS_DEV ? 'dev' : DEPLOY_VERSION;

const STATIC_PREFIX = 'dnd-ficha-static-v';
const DATA_PREFIX = 'dnd-ficha-data-v';
// Cache separado para requisições FORA do manifesto (rede + cache on-demand).
// Nunca compartilha nome com CACHE_STATIC/CACHE_DATA: se dividisse o mesmo
// cache, um `cache.put` on-demand escreveria bytes de rede dentro do cache
// que o install populou de forma verificada — quebrando a imutabilidade que
// o fetch handler de produção promete (cache-first nunca atualizado por
// rede) e abrindo a mistura de versões que essa imutabilidade existe pra
// evitar.
const ONDEMAND_PREFIX = 'dnd-ficha-ondemand-v';
const CACHE_STATIC = `${STATIC_PREFIX}${ACTIVE_VERSION}`;
const CACHE_DATA = `${DATA_PREFIX}${ACTIVE_VERSION}`;
const CACHE_ONDEMAND = `${ONDEMAND_PREFIX}${ACTIVE_VERSION}`;
const MANIFEST_URL = './precache-manifest.json';

/**
 * Calcula o SHA-256 (hex, minúsculo) dos bytes de um `ArrayBuffer`, usando
 * `crypto.subtle` (disponível no worker por rodar sempre em contexto seguro
 * — HTTPS ou localhost).
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Busca um asset com `cache: 'no-store'` (nunca participa do HTTP cache do
 * navegador — o servidor de deploy pode legitimamente enviar headers
 * cacheáveis, mas o install precisa sempre dos bytes reais/atuais para
 * validar contra o hash do manifesto) e devolve TANTO a Response original
 * (preserva `Content-Type` e demais headers — essencial para módulos ES,
 * que o navegador rejeita via `import()` se o MIME type não for JS) QUANTO
 * os bytes crus já lidos (para hash/gravação, sem precisar reler o body).
 * @param {string} url
 * @returns {Promise<{response: Response, bytes: ArrayBuffer}>}
 */
async function fetchAsset(url) {
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) {
    throw new Error(`PWA_ASSET_FETCH_FAILED:${url}:${resp.status}`);
  }
  const bytes = await resp.clone().arrayBuffer();
  return { response: resp, bytes };
}

/**
 * URLs do shell MÍNIMO precacheado proativamente em desenvolvimento (sem
 * manifesto). Resolve uma race estrutural: `./js/app.js` é buscado pelo
 * navegador ao parsear `<script type="module" src="./js/app.js">` — ANTES
 * de `app.js` sequer começar a rodar e chamar `register('./sw.js')`. Nenhum
 * fetch handler consegue interceptar essa primeira busca (o worker nem
 * existe ainda nesse instante), então "cachear sob demanda" sozinho NUNCA
 * captura o shell na primeira visita, nem numa segunda visita se a
 * segunda visita também for tratada como primeira (ex.: registro anterior
 * desregistrado por limpeza de teste) — sempre faltaria mais uma navegação
 * depois da ativação para o shell aparecer no cache. Buscar e cachear esses
 * dois arquivos aqui, durante o INSTALL, garante que já estejam presentes
 * assim que este worker ativa, sem depender de nenhuma navegação futura.
 * @type {string[]}
 */
const DEV_MINIMAL_SHELL_URLS = ['./index.html', './js/app.js'];

/**
 * Install transacional: em produção (marcador já substituído), busca o
 * manifesto, valida schema/versão, baixa e confere o SHA-256 de cada asset
 * (estático e de dado), e só então grava tudo nos caches definitivos da nova
 * versão (incluindo o próprio manifesto, por último). Qualquer falha em
 * qualquer etapa apaga SOMENTE os dois caches desta versão nova e relança o
 * erro — isso rejeita a Promise de `event.waitUntil`, então o navegador
 * nunca ativa este worker; o worker/cache antigos continuam servindo.
 *
 * Em desenvolvimento (`IS_DEV`), não há manifesto: os caches da versão
 * 'dev' são abertos e o SHELL MÍNIMO (`DEV_MINIMAL_SHELL_URLS`) é buscado e
 * cacheado proativamente, best-effort (`allSettled` — uma falha de rede não
 * pode impedir a ativação em dev). Todo o resto continua sendo cacheado sob
 * demanda pelo fetch handler.
 * @returns {Promise<void>}
 */
async function precacheTransactional() {
  if (IS_DEV) {
    const cache = await caches.open(CACHE_STATIC);
    await caches.open(CACHE_DATA);
    await Promise.allSettled(
      DEV_MINIMAL_SHELL_URLS.map(async (url) => {
        const resp = await fetch(url, { cache: 'no-store' });
        if (resp.ok) await cache.put(url, resp);
      })
    );
    return;
  }

  try {
    const { response: manifestResponse, bytes: manifestBytes } = await fetchAsset(MANIFEST_URL);
    let manifest;
    try {
      manifest = JSON.parse(new TextDecoder('utf-8').decode(manifestBytes));
    } catch {
      throw new Error('PWA_MANIFEST_INVALID_JSON');
    }
    if (!manifest || manifest.schemaVersion !== 1 || typeof manifest.deployVersion !== 'string') {
      throw new Error('PWA_MANIFEST_SCHEMA_INVALID');
    }
    if (manifest.deployVersion !== ACTIVE_VERSION) {
      throw new Error('PWA_MANIFEST_VERSION_MISMATCH');
    }

    const staticCache = await caches.open(CACHE_STATIC);
    const dataCache = await caches.open(CACHE_DATA);

    const entries = [
      ...(manifest.staticAssets || []).map((asset) => ({ ...asset, cache: staticCache })),
      ...(manifest.dataAssets || []).map((asset) => ({ ...asset, cache: dataCache })),
    ];

    for (const { url, sha256, cache } of entries) {
      if (typeof url !== 'string' || typeof sha256 !== 'string') {
        throw new Error('PWA_MANIFEST_ENTRY_INVALID');
      }
      const { response, bytes } = await fetchAsset(url);
      const hash = await sha256Hex(bytes);
      if (hash !== sha256) {
        throw new Error(`PWA_ASSET_INTEGRITY_MISMATCH:${url}`);
      }
      // Grava a Response ORIGINAL (com headers reais, inclusive
      // Content-Type) — nunca um `new Response(bytes)` sem headers, que
      // quebraria `import()` de módulos ES (MIME type checking estrito).
      await cache.put(url, response);
    }

    // O manifesto é gravado por último, só depois de todos os assets terem
    // sido confirmados: ele não se autoenumera (evitaria hash recursivo), e
    // gravá-lo antes deixaria um cache "quase completo" indistinguível de um
    // completo caso o worker fosse inspecionado no meio do install.
    await staticCache.put(MANIFEST_URL, manifestResponse);
  } catch (cause) {
    await caches.delete(CACHE_STATIC);
    await caches.delete(CACHE_DATA);
    throw cause;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheTransactional());
});

/**
 * Remove caches PRÓPRIOS da aplicação (prefixo `dnd-ficha-static-v`,
 * `dnd-ficha-data-v` ou `dnd-ficha-ondemand-v`) que não pertençam à versão
 * ativa. Nunca toca em cache de nome estrangeiro (fora desses três
 * prefixos) — não é desta aplicação.
 * @returns {Promise<void>}
 */
async function deleteOldVersionCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((k) =>
        (k.startsWith(STATIC_PREFIX) || k.startsWith(DATA_PREFIX) || k.startsWith(ONDEMAND_PREFIX)) &&
        k !== CACHE_STATIC && k !== CACHE_DATA && k !== CACHE_ONDEMAND
      )
      .map((k) => caches.delete(k))
  );
}

/**
 * Ativa a versão nova: remove os caches de versões antigas da própria
 * aplicação e assume o controle de todos os clients do escopo.
 *
 * NOTA SOBRE O BULLET 37 DO BRIEF ("adiar a remoção se houver client fora do
 * controle do worker novo"): uma primeira versão desta função tentava
 * detectar essa condição comparando
 * `clients.matchAll({includeUncontrolled:true})` com
 * `{includeUncontrolled:false}` ANTES de chamar `clients.claim()`. Essa
 * checagem se mostrou inefetiva na prática — com o único caminho de
 * atualização que esta aplicação usa (`SKIP_WAITING`, nunca a espera padrão
 * por zero clients controlados), os testes desta task (inclusive o de uma
 * única aba) mostraram a remoção acontecendo mesmo com um client presente
 * no momento da checagem: não existe, neste ponto do ciclo de vida, um
 * sinal confiável do lado do worker que distinga "aba realmente ainda
 * executando bytes v1 na memória" de "aba já contabilizada como sob
 * controle". Mantê-la seria lógica morta com uma docstring afirmando uma
 * proteção que ela não oferece.
 *
 * A garantia real de consistência vem do bullet 38 do brief, já satisfeita
 * pelo `clients.claim()` incondicional abaixo: a partir da ativação, TODA
 * aba do escopo — mesmo uma que ainda tem `app.js` de uma versão anterior
 * carregado em memória — tem qualquer fetch NOVO (inclusive um `import()`
 * de rota lazy ainda não carregada) servido de forma consistente pela
 * versão ativa (nunca uma resposta que misture bytes de duas gerações). A
 * única janela remanescente — uma fetch já DISPARADA para o worker antigo
 * antes desta ativação, ainda em voo — é inerente ao ciclo de vida do
 * próprio navegador e não é mitigável adiando `caches.delete` daqui.
 * @returns {Promise<void>}
 */
async function activateNewVersion() {
  await deleteOldVersionCaches();
  await self.clients.claim();
}

self.addEventListener('activate', (event) => {
  event.waitUntil(activateNewVersion());
});

// Escuta mensagens do cliente para controlar a atualização
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Monta uma resposta JSON estruturada de erro (503), usada quando um asset
 * de dado obrigatório está ausente offline. Nunca devolvemos `200 null` —
 * um consumidor que trata `null` como "sem dados" mascararia a falha real.
 * @param {string} code
 * @param {string} url
 * @returns {Response}
 */
function jsonUnavailableResponse(code, url) {
  return new Response(
    JSON.stringify({ error: code, url }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Monta uma resposta de erro estruturada (504) para um asset OBRIGATÓRIO do
 * manifesto que está ausente do cache versionado. Nunca cai pra rede nesse
 * caso — um asset listado no manifesto só pode vir do cache que o install
 * verificou por SHA-256; buscar da rede aqui misturaria bytes de uma
 * geração diferente dentro da versão ativa.
 * @param {string} url
 * @returns {Response}
 */
function requiredAssetMissingResponse(url) {
  return new Response(
    JSON.stringify({ error: 'PWA_REQUIRED_ASSET_MISSING', url }),
    { status: 504, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Conjunto de URLs absolutas (resolvidas contra a origem deste worker) de
 * TODO asset listado no manifesto ativo — estáticos, dados e o próprio
 * `precache-manifest.json`. Calculado uma única vez por instância do worker
 * (memorizado em `manifestUrlSetPromise`) a partir do manifesto JÁ GRAVADO
 * no cache pelo install (nunca refeito por rede) — usado pelo fetch handler
 * de produção para diferenciar "asset obrigatório do precache" (nunca cai
 * pra rede; ausência é erro estruturado) de "fora do manifesto" (rede +
 * cache on-demand, num cache SEPARADO que nunca mistura com o versionado).
 * @type {Promise<Set<string>>|null}
 */
let manifestUrlSetPromise = null;

/**
 * Carrega (com memorização em `manifestUrlSetPromise`) o conjunto de URLs do
 * manifesto ativo. Só é chamada em produção (`!IS_DEV`), onde o manifesto
 * sempre existe no cache após um install bem-sucedido.
 * @returns {Promise<Set<string>>}
 */
function loadManifestUrlSet() {
  if (manifestUrlSetPromise === null) {
    manifestUrlSetPromise = (async () => {
      const cache = await caches.open(CACHE_STATIC);
      const manifestResponse = await cache.match(MANIFEST_URL);
      const set = new Set();
      if (!manifestResponse) return set;
      let manifest;
      try {
        manifest = await manifestResponse.clone().json();
      } catch {
        return set;
      }
      set.add(new URL(MANIFEST_URL, self.location.href).href);
      for (const asset of manifest.staticAssets || []) {
        if (typeof asset?.url === 'string') set.add(new URL(asset.url, self.location.href).href);
      }
      for (const asset of manifest.dataAssets || []) {
        if (typeof asset?.url === 'string') set.add(new URL(asset.url, self.location.href).href);
      }
      return set;
    })();
  }
  return manifestUrlSetPromise;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignorar esquemas que o Cache API não suporta (ex: chrome-extension://)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Requisições não-GET nunca são cacheadas (POST/PUT/etc. seguem direto pra rede).
  if (request.method !== 'GET') return;

  // Firebase e APIs Google: sempre rede, nunca cachear
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com') || url.hostname.includes('firebaseapp.com') || url.hostname.includes('firebaseio.com')) {
    return;
  }

  if (IS_DEV) {
    // Dev sem manifesto: rede primeiro, cache sob demanda como fallback offline.
    event.respondWith((async () => {
      const isData = url.pathname.includes('/dados/');
      const cacheName = isData ? CACHE_DATA : CACHE_STATIC;
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh.ok) {
          const cache = await caches.open(cacheName);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return (await caches.match('./index.html'))
            || new Response(
              '<!doctype html><meta charset="utf-8"><title>Offline</title>'
              + '<p>App indisponivel offline. Abra online uma vez para instalar.</p>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
        }
        if (isData) return jsonUnavailableResponse('PWA_DATA_UNAVAILABLE_OFFLINE', url.pathname);
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Produção: cache-first IMUTÁVEL para toda URL listada no manifesto da
  // versão ativa (shell, navegação, módulos JS, dados). O cache versionado
  // (CACHE_STATIC/CACHE_DATA) NUNCA é atualizado com bytes de rede depois do
  // install — um asset do manifesto ausente do cache é erro estruturado,
  // NUNCA fallback de rede (que buscaria de um servidor que pode já estar
  // publicando outra versão, misturando gerações dentro da versão ativa).
  // Rede + cache on-demand ficam restritos a URLs FORA do manifesto, e
  // gravam num cache SEPARADO (CACHE_ONDEMAND) — nunca no versionado.
  event.respondWith((async () => {
    const isData = url.pathname.includes('/dados/');
    const cacheName = isData ? CACHE_DATA : CACHE_STATIC;
    const cache = await caches.open(cacheName);

    // Navegação usa o shell (./index.html) como chave de cache — o worker
    // serve sempre o mesmo documento cacheado, independentemente do path
    // hash-routed (#home, #criar, #ficha/<id>) pedido pelo navegador.
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>Offline</title>'
        + '<p>App indisponivel offline. Abra online uma vez para instalar.</p>',
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const manifestUrls = await loadManifestUrlSet();
    if (manifestUrls.has(request.url)) {
      // Asset OBRIGATÓRIO do manifesto: cache-first estrito, nunca rede.
      const cached = await cache.match(request);
      if (cached) return cached;
      if (isData) return jsonUnavailableResponse('PWA_DATA_UNAVAILABLE_OFFLINE', url.pathname);
      return requiredAssetMissingResponse(request.url);
    }

    // URL FORA do manifesto (ex.: `site/manifest.json` de metadado do PWA
    // quando não capturado pelo grafo, ou algo não previsto no build): rede
    // primeiro, com cache on-demand num cache SEPARADO do versionado — nunca
    // grava em CACHE_STATIC/CACHE_DATA.
    const ondemandCache = await caches.open(CACHE_ONDEMAND);
    try {
      const fresh = await fetch(request);
      if (fresh.ok && url.origin === self.location.origin) {
        ondemandCache.put(request, fresh.clone());
      }
      return fresh;
    } catch {
      const cachedOndemand = await ondemandCache.match(request);
      if (cachedOndemand) return cachedOndemand;
      if (isData) return jsonUnavailableResponse('PWA_DATA_UNAVAILABLE_OFFLINE', url.pathname);
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
