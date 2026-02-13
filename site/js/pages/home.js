// ============================================================
// Página inicial - Lista de personagens
// ============================================================
import { listarPersonagens, removerPersonagem, duplicarPersonagem, exportarTodos, importarPersonagens } from '../store.js';
import { toast, abrirModal, fmtData } from '../utils.js';
import { CLASSES_INFO } from '../dados-classes.js';

export function renderHome(container) {
  const personagens = listarPersonagens();

  if (personagens.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#7b2d26" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <h2>Nenhum personagem criado</h2>
        <p>Crie seu primeiro personagem e comece sua aventura!</p>
        <button class="btn btn-primary btn-lg" onclick="navegar('criar')">
          + Novo Personagem
        </button>
      </div>
      <div class="text-center mt-3">
        <button class="btn btn-secondary btn-sm" id="btn-importar">Importar Personagens</button>
      </div>
    `;
    setupImportar(container);
    return;
  }

  container.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <h2 style="font-size:1.1rem;color:var(--text)">Meus Personagens</h2>
      <div class="flex gap-1">
        <button class="btn btn-sm btn-secondary" id="btn-exportar" title="Exportar">Exportar</button>
        <button class="btn btn-sm btn-secondary" id="btn-importar" title="Importar">Importar</button>
      </div>
    </div>
    <div class="char-list">
      ${personagens.map(p => renderCharCard(p)).join('')}
    </div>
    <div class="mt-3 text-center">
      <button class="btn btn-primary btn-lg btn-block" onclick="navegar('criar')">
        + Novo Personagem
      </button>
    </div>
  `;

  // Eventos de clique nos cards
  container.querySelectorAll('.char-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.char-actions')) return;
      navegar(`ficha/${card.dataset.id}`);
    });
  });

  // Botões de ação nos cards
  container.querySelectorAll('[data-action="duplicar"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.char-card').dataset.id;
      duplicarPersonagem(id);
      toast('Personagem duplicado!', 'success');
      renderHome(container);
    });
  });

  container.querySelectorAll('[data-action="excluir"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.char-card').dataset.id;
      const p = personagens.find(x => x.id === id);
      abrirModal(
        'Excluir Personagem',
        `<p>Tem certeza que deseja excluir <strong>${p?.nome || 'este personagem'}</strong>?</p><p style="color:var(--danger);font-size:0.85rem;margin-top:8px;">Esta acao nao pode ser desfeita.</p>`,
        `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
         <button class="btn btn-danger" id="btn-confirmar-excluir">Excluir</button>`
      );
      document.getElementById('btn-confirmar-excluir').addEventListener('click', () => {
        removerPersonagem(id);
        window.fecharModal();
        toast('Personagem excluído', 'error');
        renderHome(container);
      });
    });
  });

  // Exportar
  const btnExportar = document.getElementById('btn-exportar');
  if (btnExportar) {
    btnExportar.addEventListener('click', () => {
      const json = exportarTodos();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dnd_personagens_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Exportados com sucesso!', 'success');
    });
  }

  setupImportar(container);
}

function setupImportar(container) {
  const btnImportar = document.getElementById('btn-importar');
  if (btnImportar) {
    btnImportar.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = importarPersonagens(ev.target.result);
          if (result >= 0) {
            toast(`${result} personagem(ns) importado(s)!`, 'success');
            renderHome(container);
          } else {
            toast('Erro ao importar arquivo', 'error');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });
  }
}

function renderCharCard(p) {
  const inicial = (p.nome || p.classe || '?')[0].toUpperCase();
  const info = CLASSES_INFO[p.classe];
  const dadoVida = info ? `d${info.dado_vida}` : '';

  return `
    <div class="card char-card" data-id="${p.id}">
      <div class="char-avatar">${inicial}</div>
      <div class="char-info">
        <div class="char-nome">${p.nome || 'Sem nome'}</div>
        <div class="char-detalhe">
          ${p.especie || ''} ${p.classe || ''}
          ${p.subclasse ? `(${p.subclasse})` : ''}
          ${dadoVida ? `&middot; ${dadoVida}` : ''}
        </div>
      </div>
      <div class="char-nivel">Nv. ${p.nivel || 1}</div>
      <div class="char-actions" style="display:flex;gap:4px;margin-left:8px;">
        <button class="btn btn-sm btn-secondary" data-action="duplicar" title="Duplicar">&#x2398;</button>
        <button class="btn btn-sm btn-danger" data-action="excluir" title="Excluir">&times;</button>
      </div>
    </div>
  `;
}
