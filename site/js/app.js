// ============================================================
// App principal - Router SPA e inicialização
// ============================================================
import { createHashRouter, parseHash } from './core/hash-router.js';
import { inicializarSync } from './sync.js';
import { carregarTaxasMoeda, initializeCharacterStorage, isCharacterStorageReady } from './store.js';
import { toast, abrirModal, fecharModal, inicializarUiDoShell } from './utils.js';
import { delegate } from './ui/event-delegation.js';
import { resolveSafeUrl, SAFE_URL_KINDS, getAppExternalLinkAllowlist, setSafeText } from './ui/html.js';
import { renderFailureNotice } from './ui/failure-notice.js';
import { registerServiceWorker } from './infra/pwa/service-worker-client.js';

// --- Rotas lazy (Task 34) ---------------------------------------------------
//
// Nenhuma das três páginas é importada estaticamente: cada `load()` só
// dispara o `import()` dinâmico do módulo quando a rota é de fato visitada,
// então abrir a home nunca baixa o grafo do criador nem o da ficha. O
// roteamento em si (parse de hash, generation-guard, chamada do disposer da
// rota anterior) vive em `core/hash-router.js` — puro, testado em
// `tests/unit/core/hash-router.test.js` sem depender do navegador.
const routes = {
  'home': { load: () => import('./pages/home.js'), exportName: 'renderHome' },
  'criar': { load: () => import('./pages/creator.js'), exportName: 'renderCreator' },
  'ficha': { load: () => import('./pages/sheet.js'), exportName: 'renderSheet' }
};

/**
 * Navegar para uma rota.
 *
 * Delega para `router.navigate()` (Task 34, fix round 1) em vez de escrever
 * `window.location.hash` diretamente — `router` só é declarado mais abaixo
 * neste módulo, mas como `navegar` só é CHAMADA depois que `init()` roda (a
 * partir de `DOMContentLoaded`), o módulo inteiro já terminou de avaliar e
 * `router` já existe no closure. Um `console.log(typeof navegar)` no topo do
 * arquivo funcionaria; `navegar()` de verdade, antes disso, não.
 * @param {string} rota - ex.: `'home'`, `'ficha/abc123'`.
 * @returns {void}
 */
export function navegar(rota) {
  router.navigate(rota);
}
window.navegar = navegar;

// Versao do app (injetada no deploy no span #header-versao do index.html).
// Capturada uma vez porque o texto do header e reescrito a cada navegacao.
const APP_VERSION = document.getElementById('header-versao')?.textContent?.trim() || '';

/** Define o texto do header preservando o selo de versao ao lado. */
export function definirTituloHeader(texto) {
  const el = document.getElementById('header-titulo');
  if (!el) return;
  el.textContent = texto;
  if (APP_VERSION) {
    const span = document.createElement('span');
    span.className = 'header-versao';
    span.textContent = ' ' + APP_VERSION;
    el.appendChild(span);
  }
}
window.definirTituloHeader = definirTituloHeader;

// --- Composition root do router (Task 34) -----------------------------
//
// `core/hash-router.js` é puro: não conhece `window`/`location`/`history`.
// Todo acesso ao navegador entra aqui, como adapters das três portas do
// contrato (`getHash`, `setHash`, `subscribeHashChange`) — o mesmo padrão de
// portas injetáveis usado pelos composition roots de `pages/sheet.js` e
// `pages/creator.js`.
//
// O router chama o disposer da rota anterior (idempotente, "esquecê-lo" vira
// o no-op explícito — nunca `undefined()`) exatamente uma vez antes de
// montar a próxima; a geração descarta silenciosamente qualquer navegação
// que perdeu a corrida contra uma mais nova.

const titulos = {
  'home': 'D&D 5.5 Ficha',
  'criar': 'Novo Personagem',
  'ficha': 'Ficha'
};

/**
 * Ajusta o "chrome" do cabeçalho (título, botão/ícone de voltar, ações) para
 * `pagina` — chamado no INÍCIO de cada navegação, antes do módulo da rota
 * sequer terminar de carregar, para reproduzir o comportamento síncrono que
 * o router legado tinha (o usuário via o título novo assim que clicava, sem
 * esperar o `import()`).
 * @param {string} pagina
 * @returns {void}
 */
function aplicarChromeDaRota(pagina) {
  const btnVoltar = document.getElementById('btn-voltar');
  const acoes = document.getElementById('header-acoes');
  const iconeVoltar = document.getElementById('icone-voltar');

  acoes.innerHTML = '';
  btnVoltar.style.display = pagina === 'home' ? 'none' : 'block';

  // Na ficha: botao voltar vira casinha para home; nas demais: seta para history.back()
  if (pagina === 'ficha') {
    iconeVoltar.innerHTML = '<path d="M3 12l9-9 9 9"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>';
    btnVoltar.onclick = () => navegar('home');
  } else {
    iconeVoltar.innerHTML = '<path d="M15 18l-6-6 6-6"/>';
    btnVoltar.onclick = () => window.history.back();
  }

  definirTituloHeader(titulos[pagina] || 'D&D 5.5 Ficha');
}

/**
 * Monta a tela de "página não encontrada" com nós DOM.
 *
 * Task 24: o botão não tem `onclick="navegar('home')"` inline — o clique é
 * tratado pelo listener DELEGADO registrado uma única vez em `init()`
 * (`data-acao="voltar-home"`), que sobrevive a todas as re-renderizações do
 * router.
 * @param {HTMLElement} content - contêiner `#app-content`.
 * @returns {void}
 */
function renderPaginaNaoEncontrada(content) {
  content.replaceChildren();

  const estado = document.createElement('div');
  estado.className = 'empty-state';

  const titulo = document.createElement('h2');
  setSafeText(titulo, 'Pagina nao encontrada');

  const botao = document.createElement('button');
  botao.className = 'btn btn-primary';
  botao.setAttribute('data-acao', 'voltar-home');
  setSafeText(botao, 'Voltar ao inicio');

  estado.appendChild(titulo);
  estado.appendChild(botao);
  content.appendChild(estado);
}

/**
 * Desenha o erro do PRÓPRIO router (rota não encontrada, `import()` falho,
 * export ausente/malformado) em `content`. Erros de RECUSA de uma rota
 * conhecida (repositório indisponível, catálogo não carregou etc.) nunca
 * chegam aqui — a própria página (`pages/sheet.js`/`pages/creator.js`) já
 * desenhou o próprio aviso antes de devolver `err(...)` ao router.
 * @param {HTMLElement} content - contêiner `#app-content`.
 * @param {object} error - `AppError` produzido pelo router.
 * @param {{pagina: string}} meta
 * @returns {void}
 */
function renderErroDeRota(content, error, meta) {
  if (error && error.code === 'ROUTE_NOT_FOUND') {
    renderPaginaNaoEncontrada(content);
    return;
  }
  console.error('app.js: falha ao processar a rota "' + (meta ? meta.pagina : '?') + '":', error);
  renderFailureNotice(content, {
    title: 'Não foi possível abrir esta tela',
    message: (error && error.message) || 'Tente novamente em instantes.',
    code: (error && error.code) || null
  });
  toast((error && error.message) || 'Não foi possível abrir esta tela.', 'error');
}

/**
 * Adapter browser de `getHash`: lê `window.location.hash` e, no mesmo golpe,
 * aplica o redirecionamento `criar`/`ficha` -> `home` enquanto o
 * armazenamento de personagens não estiver pronto — esses dois controllers
 * nunca são iniciados sobre um estado que não existe; a home mostra o estado
 * recuperável (`renderHome` em `pages/home.js`). Usa o MESMO `parseHash` que
 * o router usa internamente (`core/hash-router.js`), então a regra de
 * parsing existe em UM lugar só.
 *
 * `history.replaceState` (não `location.hash =`) para não disparar um
 * segundo 'hashchange' redundante, e para que a URL exibida concorde com a
 * rota de fato renderizada — sem isto, a barra de endereço continuaria
 * mostrando `#ficha/<id>` mesmo com a home na tela. Como o router lê o hash
 * de novo via este mesmo `getHash` logo depois, o `#home` já reescrito é o
 * que `process()` acaba enxergando.
 * @returns {string}
 */
function lerHashComRedirecionamento() {
  const atual = window.location.hash;
  const { pagina } = parseHash(atual);
  if ((pagina === 'criar' || pagina === 'ficha') && !isCharacterStorageReady()) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#home`);
    return '#home';
  }
  return atual;
}

const router = createHashRouter({
  routes,
  // Adapters browser das três portas injetáveis: o router em si nunca toca
  // em `window`/`location`/`history`. Estas são as MESMAS portas que
  // `router.start()`/`router.navigate()` usam em produção (Task 34, fix
  // round 1) — não sobra nenhum caminho paralelo de hash change/navegação
  // fora delas.
  getHash: lerHashComRedirecionamento,
  setHash: (rota) => {
    window.location.hash = rota;
  },
  subscribeHashChange: (handler) => {
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  },
  // Scripts `type="module"` são adiados pelo navegador até o HTML terminar
  // de ser interpretado — `#app-content` já existe no DOM neste ponto, antes
  // mesmo de `DOMContentLoaded` disparar (é por isso que `init()`, mais
  // abaixo, também espera esse evento só para o resto da inicialização).
  contentRoot: document.getElementById('app-content'),
  onRouteState: (estado) => {
    if (estado.status === 'start') aplicarChromeDaRota(estado.pagina);
  },
  renderError: (content, error, meta) => renderErroDeRota(content, error, meta)
});

/**
 * Monta o corpo do modal "Reportar Problema" com nós DOM e com as URLs
 * externas validadas pela allowlist fechada de `ui/html.js`
 * (`kind: 'app-link'`). Um link cujo destino não esteja na allowlist
 * simplesmente não é criado.
 * @returns {DocumentFragment}
 */
function montarCorpoReportarProblema() {
  const fragment = document.createDocumentFragment();

  const paragrafo = document.createElement('p');
  paragrafo.setAttribute('style', 'margin-bottom:12px');
  setSafeText(paragrafo, 'Para reportar problemas ou solicitar melhorias entre em contato via Reddit:');
  fragment.appendChild(paragrafo);

  const lista = document.createElement('div');
  lista.setAttribute('style', 'display:flex;flex-direction:column;gap:8px');

  const [urlComentario, urlMensagem] = getAppExternalLinkAllowlist();
  const links = [
    { url: urlComentario, classe: 'btn btn-accent', texto: '💬 Comentário no post' },
    { url: urlMensagem, classe: 'btn btn-secondary', texto: '✉ Mensagem direta' }
  ];

  for (const { url, classe, texto } of links) {
    const resolvida = resolveSafeUrl(url, { kind: SAFE_URL_KINDS.appLink });
    if (!resolvida.ok) {
      console.error('Link de contato rejeitado pela allowlist:', resolvida.error);
      continue;
    }
    const ancora = document.createElement('a');
    ancora.className = classe;
    ancora.href = resolvida.value.href;
    ancora.target = '_blank';
    ancora.rel = 'noopener noreferrer';
    ancora.setAttribute('style', 'text-align:center;text-decoration:none');
    setSafeText(ancora, texto);
    lista.appendChild(ancora);
  }

  fragment.appendChild(lista);
  return fragment;
}

/**
 * Botão "Fechar" do modal de reporte, sem `onclick` inline.
 * @returns {HTMLButtonElement}
 */
function montarAcaoFecharReporte() {
  const botao = document.createElement('button');
  botao.className = 'btn btn-secondary';
  setSafeText(botao, 'Fechar');
  botao.addEventListener('click', () => fecharModal());
  return botao;
}

// --- PWA Update ---
//
// Registro, verificação de atualização e recarga segura pós-atualização
// foram extraídos para site/js/infra/pwa/service-worker-client.js (Task
// 36). app.js só fornece as duas pontas específicas da UI do shell:
// `canReload` (nenhum modal aberto) e `onUpdate` (toast avisando que a
// atualização será aplicada ao fechar o modal).

/**
 * Indica se é seguro recarregar a página agora (nenhum modal aberto) — usado
 * por `registerServiceWorker` para decidir se aplica o reload imediatamente
 * ou adia até o modal fechar.
 * @returns {boolean}
 */
function podeRecarregarAgora() {
  const overlay = document.getElementById('modal-overlay');
  return !(overlay && overlay.style.display === 'flex');
}

// --- Inicialização ---
async function init() {
  // Carregar taxas de conversao de moeda customizadas (se houver), antes de qualquer ficha renderizar
  carregarTaxasMoeda();

  // Ativa o catálogo de conteúdo oficial + repositório local de personagens
  // (migração/validação única) ANTES de qualquer rota renderizar. Falha em
  // qualquer etapa não impede o boot do app — home.js mostra o estado
  // recuperável (ver lerHashComRedirecionamento, o adapter getHash do
  // router, que redireciona criar/ficha para home enquanto
  // isCharacterStorageReady() for false).
  let storagePronto = false;
  try {
    const initResult = await initializeCharacterStorage();
    storagePronto = initResult.ok;
    if (!initResult.ok) {
      console.error('initializeCharacterStorage falhou:', initResult.error);
    }
  } catch (cause) {
    console.error('initializeCharacterStorage lançou uma exceção inesperada:', cause);
  }

  // Módulo de sync (fila de personagens pendentes para a nuvem) só é
  // inicializado quando o armazenamento local de personagens está pronto —
  // sem isto, `inicializarSync()` processaria uma fila que referencia dados
  // de um repositório que nunca chegou a existir. Registro do Service
  // Worker (abaixo) é deliberadamente INDEPENDENTE disso: ele cobre o cache
  // do app shell, não personagens, e é o que permite o app abrir OFFLINE em
  // primeiro lugar — gateá-lo pela mesma condição criaria um círculo (sem
  // rede, `initializeCharacterStorage()` tende a falhar por não conseguir
  // buscar o pacote de conteúdo, e sem o SW registrado o app nunca ganha
  // suporte offline para a próxima visita).
  if (storagePronto) {
    inicializarSync();
  }

  // Registrar Service Worker e verificar atualizações (site/js/infra/pwa/service-worker-client.js)
  const swResult = await registerServiceWorker({
    canReload: podeRecarregarAgora,
    onUpdate: (mensagem) => toast(mensagem, ''),
    onError: (cause) => console.warn('SW registro falhou:', cause)
  });
  if (!swResult.ok) {
    console.warn('SW registro falhou:', swResult.error);
  }

  // Serviços de UI do shell (modal + toast). Criá-los aqui registra, já no
  // boot, os listeners que substituíram os `onclick` inline: o botão de
  // fechar do cabeçalho do modal (antes `onclick="fecharModal()"` em
  // site/index.html) e o fechamento ao clicar fora, que agora pertencem ao
  // ModalService e cobrem também os sub-modais empilhados.
  inicializarUiDoShell();

  // Listener DELEGADO do shell: o botão "Voltar ao inicio" da página não
  // encontrada é recriado a cada rota inválida, então o listener fica na
  // raiz `#app-content` e é registrado uma única vez.
  delegate(document.getElementById('app-content'), 'click', '[data-acao="voltar-home"]', () => {
    navegar('home');
  });

  // FAB Reportar Bug (global, disponível em todas as telas)
  document.getElementById('btn-reportar-bug')?.addEventListener('click', () => {
    abrirModal('Reportar Problema', montarCorpoReportarProblema(), montarAcaoFecharReporte());
  });

  // Router: assina 'hashchange' (via subscribeHashChange) e processa a rota
  // inicial (site/js/core/hash-router.js). `router.start()` é o único lugar
  // em produção que dispara `router.process()` — não existe mais um
  // `processarRota()` paralelo em `app.js`.
  router.start();
}

document.addEventListener('DOMContentLoaded', init);
