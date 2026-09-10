// ============================================================
// Sintonizacao com itens magicos.
//
// Regra pura, sem DOM: quem esta sintonizado, quantos cabem e se um item
// especifico ainda pode ser marcado. A tela (sheet/inventario.js) so
// desenha o que este modulo responde.
// ============================================================

// Equipamento.md:1198 -- "Voce pode estar sintonizado com no maximo tres
// itens magicos ao mesmo tempo. Qualquer tentativa de sintonizar um quarto
// item falha". O numero e do livro; nao e configuravel.
export const TETO_SINTONIZACAO = 3;

/**
 * Os itens do inventario que estao sintonizados agora. So conta quem AINDA
 * pede sintonizacao: editar um item marcado e desmarcar "Requer
 * Sintonizacao" deixava `sintonizado: true` gravado sem a caixa na tela
 * para desmarcar, prendendo a vaga para sempre.
 * @param {object} p Personagem.
 * @returns {object[]} os itens marcados (lista vazia quando nao ha nenhum).
 */
export function itensSintonizados(p) {
  return (p?.inventario || []).filter((i) => i?.dados?.requer_sintonizacao && i?.sintonizado === true);
}

/**
 * Se o item do indice pode receber a marca de sintonizado. Um item JA
 * sintonizado responde true mesmo com o teto cheio -- senao o jogador nao
 * conseguiria DESMARCAR nada depois do terceiro.
 * @param {object} p Personagem.
 * @param {number} idx Indice no inventario.
 * @returns {boolean}
 */
export function podeSintonizar(p, idx) {
  const item = (p?.inventario || [])[idx];
  if (!item?.dados?.requer_sintonizacao) return false;
  if (item.sintonizado === true) return true;
  return itensSintonizados(p).length < TETO_SINTONIZACAO;
}
