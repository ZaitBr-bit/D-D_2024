// ============================================================
// App principal - Router SPA e inicialização
// ============================================================
import { renderHome } from './pages/home.js';
import { renderCreator } from './pages/creator.js';
import { renderSheet } from './pages/sheet.js';

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
 * Verifica se existe uma nova versão do Service Worker e exibe um banner
 * convidando o usuário a atualizar. Quando o usuário clica em "Atualizar",
 * limpa todos os caches, envia SKIP_WAITING ao SW novo e recarrega a página.
 * @param {ServiceWorkerRegistration} registration - Registro do SW ativo
 */
function verificarAtualizacaoSW(registration) {
  const novoSW = registration.waiting || registration.installing;

  function mostrarPromptAtualizar(sw) {
    // Evitar duplicar banner
    if (document.getElementById('update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.className = 'update-banner';
    banner.innerHTML = `
      <span>Nova versao disponivel!</span>
      <button class="update-banner-btn" id="btn-atualizar">Atualizar agora</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('btn-atualizar').addEventListener('click', () => {
      banner.querySelector('#btn-atualizar').textContent = 'Atualizando...';
      banner.querySelector('#btn-atualizar').disabled = true;
      // Limpar todos os caches e forçar o novo SW
      if ('caches' in window) {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
          sw.postMessage({ type: 'SKIP_WAITING' });
        });
      } else {
        sw.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  }

  if (novoSW) {
    if (novoSW.state === 'installed') {
      mostrarPromptAtualizar(novoSW);
    } else {
      novoSW.addEventListener('statechange', () => {
        if (novoSW.state === 'installed') {
          mostrarPromptAtualizar(novoSW);
        }
      });
    }
  }

  registration.addEventListener('updatefound', () => {
    const instalando = registration.installing;
    if (instalando) {
      instalando.addEventListener('statechange', () => {
        if (instalando.state === 'installed' && navigator.serviceWorker.controller) {
          mostrarPromptAtualizar(instalando);
        }
      });
    }
  });
}

// --- Inicialização ---
function init() {
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
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
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
