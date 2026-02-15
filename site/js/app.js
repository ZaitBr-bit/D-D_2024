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
 * envia a mensagem SKIP_WAITING ao SW instalado para que ele assuma o controle;
 * o listener de 'controllerchange' em init() recarrega a página automaticamente.
 * @param {ServiceWorkerRegistration} registration - Registro do SW ativo
 */
function verificarAtualizacaoSW(registration) {
  // Quando uma nova versão do SW é encontrada e está esperando ativação
  const novoSW = registration.waiting || registration.installing;

  function mostrarPromptAtualizar(sw) {
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.className = 'update-banner';
    banner.innerHTML = `
      <span>Nova versão disponível!</span>
      <button class="update-banner-btn" id="btn-atualizar">Atualizar</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('btn-atualizar').addEventListener('click', () => {
      sw.postMessage({ type: 'SKIP_WAITING' });
      banner.remove();
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
    }).catch(err => {
      console.warn('SW registro falhou:', err);
    });

    // Recarregar página quando o novo SW assumir controle
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  // Fechar modal ao clicar fora
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      document.getElementById('modal-overlay').style.display = 'none';
    }
  });

  // Listener de rota
  window.addEventListener('hashchange', processarRota);

  // Rota inicial
  processarRota();
}

document.addEventListener('DOMContentLoaded', init);
