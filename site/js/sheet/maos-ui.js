// ============================================================
// Mãos do personagem: modal para listar, adicionar, renomear e remover mãos.
// O limite de armas equipadas vem de regras-ataque.js (maosTotais / maosEmUso).
// ============================================================
import { maosTotais, maosEmUso } from '../regras-ataque.js';
import { abrirModal, escHtml, gerarId, toast } from '../utils.js';
import { char, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';

/** Garante `char.maos` materializado (2 mãos padrão) antes de editar a lista. */
function garantirMaos() {
  if (Array.isArray(char.maos) && char.maos.length > 0) return;
  char.maos = [{ id: gerarId(), nome: 'Mão 1' }, { id: gerarId(), nome: 'Mão 2' }];
}

/** HTML da lista de mãos com campo de nome e botão remover por mão. */
function htmlListaMaos() {
  return `<div id="lista-maos">${(char.maos || []).map((m, i) => `
    <div class="row" style="gap:6px;margin-bottom:6px;align-items:center">
      <input class="form-input" data-mao-nome="${i}" value="${escHtml(m.nome)}">
      <button class="btn btn-sm btn-danger" data-mao-remover="${i}">Remover</button>
    </div>`).join('')}</div>
    <div style="font-size:0.8rem;color:var(--text-muted)">${maosEmUso(char)} de ${maosTotais(char)} em uso</div>`;
}

/**
 * Abre o modal de mãos; adicionar e remover salvam e reabrem o modal.
 * Qualquer fechamento (Fechar, X, fora do modal) redesenha a ficha, exceto a reabertura interna.
 */
export function abrirModalMaos() {
  garantirMaos();
  let reabrindo = false;
  abrirModal('Mãos', htmlListaMaos(),
    `<button class="btn btn-secondary" id="btn-mao-adicionar">Adicionar mão</button><button class="btn btn-primary" id="btn-mao-fechar">Fechar</button>`,
    () => { if (!reabrindo) renderFichaCompleta(); });
  const redesenhar = () => {
    reabrindo = true;
    window.fecharModal();
    abrirModalMaos();
  };
  document.getElementById('btn-mao-adicionar')?.addEventListener('click', () => {
    char.maos.push({ id: gerarId(), nome: `Mão ${char.maos.length + 1}` });
    salvar();
    redesenhar();
  });
  document.querySelectorAll('[data-mao-nome]').forEach(inp => inp.addEventListener('change', () => {
    char.maos[parseInt(inp.dataset.maoNome)].nome = inp.value.trim() || `Mão ${parseInt(inp.dataset.maoNome) + 1}`;
    salvar();
  }));
  document.querySelectorAll('[data-mao-remover]').forEach(btn => btn.addEventListener('click', () => {
    if (char.maos.length <= 1) { toast('O personagem precisa de ao menos uma mão.', 'error'); return; }
    if (maosEmUso(char) > char.maos.length - 1) { toast('Desequipe um item antes de remover esta mão.', 'error'); return; }
    char.maos.splice(parseInt(btn.dataset.maoRemover), 1);
    salvar();
    redesenhar();
  }));
  document.getElementById('btn-mao-fechar')?.addEventListener('click', () => window.fecharModal());
}
