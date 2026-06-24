// ============================================================
// Grid compartilhado de seleção de Manobras (Mestre da Batalha)
// Usado pelo fluxo de level-up e pela migração retroativa em sheet.js
// ============================================================
import { abrirModal, fecharModal, semAcento } from './utils.js';

/**
 * Abre modal de seleção/busca de manobras (nome + descrição, sem campos de magia).
 * @param {string} titulo
 * @param {number} maxSel - máximo de manobras selecionáveis nesta sessão
 * @param {Array<{nome:string,descricao:string}>} opcoes - manobras candidatas (já filtradas de quais o personagem já conhece)
 * @param {Set<string>} selSet - Set mutável de nomes selecionados (compartilhado com o chamador)
 * @param {(selecionadas: string[]) => void} aoMudar - chamado a cada clique com a lista atual de selecionados
 */
export function abrirGridManobras(titulo, maxSel, opcoes, selSet, aoMudar) {
  const disponiveis = [...opcoes].sort((a, b) =>
    (selSet.has(b.nome) ? 1 : 0) - (selSet.has(a.nome) ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR')
  );

  const conteudo = `
    <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:0.85rem;color:var(--text-muted)">Selecionadas: <strong id="grid-manobra-sel-count">${selSet.size}</strong>/${maxSel}</span>
      <div class="search-box" style="flex:1;margin-left:12px"><input type="text" id="grid-manobra-busca" placeholder="Buscar..." class="form-input" style="padding:6px 10px;font-size:0.85rem"></div>
    </div>
    <div style="max-height:55vh;overflow-y:auto"><div class="magias-grid" id="grid-manobras"></div></div>
  `;
  abrirModal(titulo, conteudo, '<button class="btn btn-secondary" onclick="fecharModal()">Confirmar Seleção</button>');

  function renderGrid() {
    const termo = semAcento(document.getElementById('grid-manobra-busca')?.value || '');
    const filtradas = termo.length >= 2 ? disponiveis.filter(m => semAcento(m.nome).includes(termo)) : disponiveis;
    const cheio = selSet.size >= maxSel;
    const gridEl = document.getElementById('grid-manobras');
    if (!gridEl) return;

    gridEl.innerHTML = filtradas.map(m => {
      const sel = selSet.has(m.nome);
      const bloqueado = cheio && !sel;
      return `
        <div class="magia-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'magia-card-bloqueada' : ''}" style="${bloqueado ? 'opacity:0.35;cursor:default' : ''}">
          <span class="magia-card-check" data-grid-manobra-check="${m.nome}"></span>
          <div class="magia-card-nome">${m.nome}</div>
          <div class="magia-card-meta" style="font-size:0.7rem;color:var(--text-muted)">${m.descricao}</div>
        </div>`;
    }).join('');

    const cntEl = document.getElementById('grid-manobra-sel-count');
    if (cntEl) { cntEl.textContent = selSet.size; cntEl.style.color = selSet.size === maxSel ? 'var(--success)' : 'inherit'; }

    gridEl.querySelectorAll('[data-grid-manobra-check]').forEach(check => {
      check.addEventListener('click', (e) => {
        e.stopPropagation();
        const n = check.dataset.gridManobraCheck;
        if (selSet.has(n)) selSet.delete(n);
        else if (selSet.size < maxSel) selSet.add(n);
        renderGrid();
        aoMudar([...selSet]);
      });
    });
  }

  document.getElementById('grid-manobra-busca')?.addEventListener('input', renderGrid);
  renderGrid();
}
