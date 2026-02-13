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

// --- Inicialização ---
function init() {
  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registro falhou:', err);
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
