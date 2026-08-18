// ============================================================
// App principal - Router SPA e inicialização
// ============================================================
import { renderHome } from './pages/home.js';
import { renderCreator } from './pages/creator.js';
import { renderSheet } from './pages/sheet.js';
import { inicializarSync } from './sync.js';
import { carregarTaxasMoeda } from './store.js';
import { toast, abrirModal } from './utils.js';
import { VERSAO_ATUAL } from './versao.js';
import { abrirNotasVersao } from './notas-versao.js';

// --- Router baseado em hash ---
const routes = {
  'home': renderHome,
  'criar': renderCreator,
  'ficha': renderSheet
};

/** Navegar para uma rota */
export function navegar(rota) {
  window.location.hash = rota;
}
window.navegar = navegar;

// Versão exibida no header. Vem de js/versao.js (controle manual), NÃO
// mais do número de build injetado no deploy -- esse continua existindo
// no span oculto #build-numero, só para diagnóstico.
const APP_VERSION = VERSAO_ATUAL ? 'v' + VERSAO_ATUAL : '';

// Chave onde fica a última versão que este navegador já viu, para abrir as
// notas de versão automaticamente uma única vez a cada atualização.
const VERSAO_VISTA_KEY = 'dnd_versao_vista';

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

/**
 * Atualiza o selo de versão (`.header-versao`, dentro do `<h1>`) pra
 * refletir se ele deve se comportar como clicável: só na home. O selo é
 * recriado a cada navegação por `definirTituloHeader`, então essa função
 * roda depois dela, em `processarRota`, e não mexe na assinatura nem no
 * propósito de `definirTituloHeader` (que só define o texto do header).
 * Fora da home o selo fica só texto: sem classe de estilo (sem cursor de
 * mão) e sem `title` de ação -- o clique é ignorado pelo handler de
 * delegação registrado em `init()`.
 */
function atualizarSeloVersaoClicavel(pagina) {
  const selo = document.querySelector('.header-versao');
  if (!selo) return;
  const clicavel = pagina === 'home';
  selo.classList.toggle('header-versao--clicavel', clicavel);
  if (clicavel) {
    selo.title = 'Ver notas de versão';
  } else {
    selo.removeAttribute('title');
  }
}

/** Processa a rota atual do hash */
/**
 * Le uma chave APENAS entre as proprias do objeto.
 *
 * O hash da URL e texto livre do usuario, e busca em objeto literal sobe
 * a cadeia de prototipos: `routes['toString']` devolveria a funcao
 * herdada de Object.prototype, que o router trataria como pagina valida
 * -- tela em branco no lugar do "Pagina nao encontrada", e o titulo do
 * header recebendo o codigo-fonte da funcao. Coberto por
 * `testes/e2e/regras/rota-desconhecida.spec.mjs`.
 */
function proprio(obj, chave) {
  return Object.prototype.hasOwnProperty.call(obj, chave) ? obj[chave] : undefined;
}

function processarRota() {
  const hash = window.location.hash.slice(1) || 'home';
  const partes = hash.split('/');
  const pagina = partes[0];
  const param = partes.slice(1).join('/');

  const render = proprio(routes, pagina);
  const content = document.getElementById('app-content');
  const btnVoltar = document.getElementById('btn-voltar');
  const acoes = document.getElementById('header-acoes');

  // Limpar estado anterior
  acoes.innerHTML = '';
  btnVoltar.style.display = pagina === 'home' ? 'none' : 'block';

  // Botão de notas de versão: só na tela inicial. #header-acoes é
  // limpo acima a cada navegação, então não é preciso removê-lo ao sair
  // da home -- ele simplesmente não é recriado.
  // Ícone + rótulo em texto (📋 Notas de versão) em spans separados: o
  // rótulo some no mobile via CSS (.header-rotulo), mas o aria-label do
  // próprio botão preserva o nome acessível mesmo com o texto escondido.
  if (pagina === 'home') {
    const btnNotas = document.createElement('button');
    btnNotas.id = 'btn-notas-versao';
    btnNotas.className = 'header-btn-rotulado no-print';
    btnNotas.title = 'Notas de versão';
    btnNotas.setAttribute('aria-label', 'Notas de versão');
    btnNotas.innerHTML =
      '<span class="header-icone" aria-hidden="true">📋</span>' +
      '<span class="header-rotulo">Notas de versão</span>';
    btnNotas.addEventListener('click', abrirNotasVersao);
    acoes.appendChild(btnNotas);
  }

  // Na ficha: botao voltar vira casinha para home; nas demais: seta para history.back()
  const iconeVoltar = document.getElementById('icone-voltar');
  if (pagina === 'ficha') {
    iconeVoltar.innerHTML = '<path d="M3 12l9-9 9 9"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>';
    btnVoltar.onclick = () => navegar('home');
  } else {
    iconeVoltar.innerHTML = '<path d="M15 18l-6-6 6-6"/>';
    btnVoltar.onclick = () => window.history.back();
  }

  // Definir título padrão
  const titulos = {
    'home': 'D&D 5.5 Ficha',
    'criar': 'Novo Personagem',
    'ficha': 'Ficha'
  };
  definirTituloHeader(proprio(titulos, pagina) || 'D&D 5.5 Ficha');
  atualizarSeloVersaoClicavel(pagina);

  if (render) {
    render(content, param);
  } else {
    content.innerHTML = '<div class="empty-state"><h2>Pagina nao encontrada</h2><button class="btn btn-primary" onclick="navegar(\'home\')">Voltar ao inicio</button></div>';
  }
}

// --- PWA Update ---
/**
 * Verifica se existe uma nova versão do Service Worker. Quando encontra,
 * limpa os caches do SW e envia SKIP_WAITING automaticamente (sem exigir
 * clique do usuário). Limpar caches do SW nunca afeta personagens, que
 * vivem só em localStorage (store.js), separado do Cache Storage do SW.
 * @param {ServiceWorkerRegistration} registration - Registro do SW ativo
 */
function verificarAtualizacaoSW(registration) {
  const novoSW = registration.waiting || registration.installing;

  function aplicarAtualizacao(sw) {
    // Evitar disparar mais de uma vez pro mesmo SW
    if (sw._dndAtualizacaoAplicada) return;
    sw._dndAtualizacaoAplicada = true;

    // NAO apagar caches aqui. O proprio SW (evento 'activate') remove apenas os
    // caches de versoes antigas. Apagar tudo do cliente destroi o cache que o novo
    // SW acabou de popular no 'install', deixando o app sem conteudo offline
    // (erro "Returned response is null" ao abrir sem rede).
    sw.postMessage({ type: 'SKIP_WAITING' });
  }

  if (novoSW) {
    if (novoSW.state === 'installed') {
      if (navigator.serviceWorker.controller) aplicarAtualizacao(novoSW);
    } else {
      novoSW.addEventListener('statechange', () => {
        if (novoSW.state === 'installed' && navigator.serviceWorker.controller) {
          aplicarAtualizacao(novoSW);
        }
      });
    }
  }

  registration.addEventListener('updatefound', () => {
    const instalando = registration.installing;
    if (instalando) {
      instalando.addEventListener('statechange', () => {
        if (instalando.state === 'installed' && navigator.serviceWorker.controller) {
          aplicarAtualizacao(instalando);
        }
      });
    }
  });
}

/**
 * Recarrega a página assim que for seguro (sem modal aberto), pra não
 * interromper o usuário no meio de uma edição (ex: wizard de level-up).
 * Se já estiver seguro, recarrega na hora.
 */
function recarregarQuandoSeguro() {
  const overlay = document.getElementById('modal-overlay');
  const modalAberto = overlay && overlay.style.display === 'flex';

  if (!modalAberto) {
    window.location.reload();
    return;
  }

  toast('Nova versão disponível — será aplicada ao fechar esta janela.', '');
  // Polling em vez do callback onClose de abrirModal() (utils.js): esse callback é
  // um slot único por modal, já pode estar ocupado pela lógica do próprio wizard/modal
  // em andamento — registrar aqui substituiria esse callback e quebraria a limpeza dele.
  const interval = setInterval(() => {
    const aindaAberto = overlay && overlay.style.display === 'flex';
    if (!aindaAberto) {
      clearInterval(interval);
      window.location.reload();
    }
  }, 500);
}

/**
 * Abre as notas de versão sozinho, uma única vez, quando o site atualiza
 * para uma versão diferente da última que este navegador viu. Na primeira
 * visita (nada salvo ainda) não é uma atualização -- só grava a versão
 * atual em silêncio, sem abrir o modal.
 */
function abrirNotasVersaoSeAtualizou() {
  if (!VERSAO_ATUAL) return;
  const vista = localStorage.getItem(VERSAO_VISTA_KEY);
  if (vista === VERSAO_ATUAL) return;
  if (vista) abrirNotasVersao();
  localStorage.setItem(VERSAO_VISTA_KEY, VERSAO_ATUAL);
}

// --- Inicialização ---
function init() {
  // Carregar taxas de conversao de moeda customizadas (se houver), antes de qualquer ficha renderizar
  carregarTaxasMoeda();

  // Inicializar módulo de sync (registra listeners online/offline e processa fila pendente)
  inicializarSync();

  // Registrar Service Worker e verificar atualizações
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      verificarAtualizacaoSW(registration);

      // Verificar atualizações periodicamente (a cada 5 min)
      setInterval(() => {
        registration.update();
      }, 5 * 60 * 1000);

      // Verificar ao voltar para a aba (útil em mobile)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      });
    }).catch(err => {
      console.warn('SW registro falhou:', err);
    });

    // Recarregar página quando o novo SW assumir controle (pós-atualização)
    // hadController evita reload desnecessário na primeira instalação
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      recarregarQuandoSeguro();
    });
  }

  // Fechar modal ao clicar fora (usa fecharModal para suporte a pilha)
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      window.fecharModal();
    }
  });

  // FAB Reportar Bug (global, disponível em todas as telas)
  document.getElementById('btn-reportar-bug')?.addEventListener('click', () => {
    abrirModal(
      'Reportar Problema',
      `
        <p style="margin-bottom:12px">Para reportar problemas ou solicitar melhorias entre em contato via Reddit:</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <a class="btn btn-accent" href="https://www.reddit.com/r/rpgbrasil/comments/1sgrj1j/criador_de_ficha_dd_55_2024_web_e_mobile_gratuito/" target="_blank" rel="noopener noreferrer" style="text-align:center;text-decoration:none">💬 Comentário no post</a>
          <a class="btn btn-secondary" href="https://www.reddit.com/user/ZaitBrz/" target="_blank" rel="noopener noreferrer" style="text-align:center;text-decoration:none">✉ Mensagem direta</a>
        </div>
      `,
      '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>'
    );
  });

  // Selo de versão clicável (delegação): o span `.header-versao` é
  // recriado a cada navegação por `definirTituloHeader`, então um listener
  // preso nele morreria na troca de rota seguinte. Um único listener aqui,
  // no ancestral estável `#header-titulo`, sobrevive à recriação --
  // registrado uma vez só, nunca dentro de `processarRota` (senão
  // acumularia um listener por navegação). A checagem de rota acontece no
  // clique, não no cadastro, pra sempre valer a rota atual.
  document.getElementById('header-titulo')?.addEventListener('click', (e) => {
    const selo = e.target.closest('.header-versao');
    if (!selo) return;
    const hash = window.location.hash.slice(1) || 'home';
    const pagina = hash.split('/')[0];
    if (pagina !== 'home') return;
    abrirNotasVersao();
  });

  // Listener de rota
  window.addEventListener('hashchange', processarRota);

  // Rota inicial
  processarRota();

  // Notas de versão automáticas: depois da rota inicial, pra não competir
  // com o primeiro render.
  abrirNotasVersaoSeAtualizou();
}

document.addEventListener('DOMContentLoaded', init);
