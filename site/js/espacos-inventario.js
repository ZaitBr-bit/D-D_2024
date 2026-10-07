// ============================================================
// Espaços do inventário (Mochila + locais criados pelo jogador): ordem de exibição
// e escolha do espaço de destino ao adicionar um item (loja, item mágico, item
// personalizado). Equipados e Esgotados não entram aqui: ficam sempre no topo e no fim.
// ============================================================
import { escHtml } from './utils.js';

/** Chave da Mochila na ordem dos espaços; os locais usam o próprio id. */
export const CHAVE_MOCHILA = 'mochila';

/**
 * Ordem dos espaços: a salva pelo jogador, sem chaves de locais removidos, com os
 * espaços novos no fim. Sem ordem salva, a Mochila vem primeiro e os locais na ordem
 * em que foram criados.
 * @param {Array<{id: string}>} locais `char.inventario_locais`.
 * @param {string[]} [ordemSalva] `char.inventario_ordem_espacos`.
 * @returns {string[]} Chaves ('mochila' ou id do local).
 */
export function ordemDosEspacos(locais = [], ordemSalva = []) {
  const existentes = [CHAVE_MOCHILA, ...(locais || []).map((l) => l.id)];
  const ordem = (Array.isArray(ordemSalva) ? ordemSalva : []).filter((c) => existentes.includes(c));
  for (const c of existentes) if (!ordem.includes(c)) ordem.push(c);
  return [...new Set(ordem)];
}

/**
 * Move um espaço para a posição de outro (arrastar e soltar), como os itens do inventário:
 * o arrastado ocupa o lugar do alvo e os do meio andam uma casa.
 * @param {string[]} ordem Ordem completa.
 * @param {string} chave Espaço arrastado.
 * @param {string} alvo Espaço sobre o qual foi solto.
 * @returns {string[]} Nova ordem; a mesma se alguma chave não existe ou se são iguais.
 */
export function moverEspacoPara(ordem, chave, alvo) {
  const de = ordem.indexOf(chave);
  const para = ordem.indexOf(alvo);
  if (de < 0 || para < 0 || de === para) return [...ordem];
  const nova = [...ordem];
  nova.splice(de, 1);
  nova.splice(para, 0, chave);
  return nova;
}

/**
 * Campo "Guardar em" para escolher o espaço do item novo. Vazio quando o personagem não
 * tem locais criados (o item vai para a Mochila, como sempre).
 * @param {object} personagem Personagem (lê `inventario_locais` e a ordem salva).
 * @param {string} idCampo Id do <select>.
 * @returns {string} HTML.
 */
export function htmlEscolhaEspaco(personagem, idCampo) {
  const locais = personagem?.inventario_locais || [];
  if (!locais.length) return '';
  const opcoes = ordemDosEspacos(locais, personagem.inventario_ordem_espacos).map((chave) => {
    if (chave === CHAVE_MOCHILA) return '<option value="">Mochila</option>';
    const local = locais.find((l) => l.id === chave);
    return `<option value="${escHtml(local.id)}">${escHtml(local.nome)}</option>`;
  }).join('');
  return `<div class="form-group" style="margin-bottom:8px">
    <label class="form-label" for="${idCampo}">Guardar em</label>
    <select class="form-input" id="${idCampo}">${opcoes}</select></div>`;
}

/** Id do local escolhido no campo "Guardar em" ('' = Mochila ou campo ausente). */
export function lerEspacoEscolhido(idCampo) {
  return document.getElementById(idCampo)?.value || '';
}

/** Grava o espaço no item novo: num local ele fica desequipado; '' deixa na Mochila. */
export function aplicarEspaco(item, localId) {
  if (localId) {
    item.local = localId;
    item.equipado = false;
  } else {
    delete item.local;
  }
  return item;
}
