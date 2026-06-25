// ============================================================
// App principal - Router SPA e inicialização
// ============================================================
import { renderHome } from './pages/home.js';
import { renderCreator } from './pages/creator.js';
import { renderSheet } from './pages/sheet.js';
import { inicializarSync } from './sync.js';
import { toast } from './utils.js';

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

/** Processa a rota atual do hash */
function processarRota() {
  const hash = window.location.hash.slice(1) || 'home';
  const partes = hash.split('/');
  const pagina = partes[0];
  const param = partes.slice(1).join('/');

  const render = routes[pagina];
  const content = document.getElementById('app-content');
  const btnVoltar = document.getElementById('btn-voltar');
  const titulo = document.getElementById('header-titulo');
  const acoes = document.getElementById('header-acoes');

  // Limpar estado anterior
  acoes.innerHTML = '';
  btnVoltar.style.display = pagina === 'home' ? 'none' : 'block';

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
  titulo.textContent = titulos[pagina] || 'D&D 5.5 Ficha';

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

    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
        sw.postMessage({ type: 'SKIP_WAITING' });
      });
    } else {
      sw.postMessage({ type: 'SKIP_WAITING' });
    }
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

// --- Inicialização ---
function init() {
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

  // Listener de rota
  window.addEventListener('hashchange', processarRota);

  // Rota inicial
  processarRota();
}

document.addEventListener('DOMContentLoaded', init);
