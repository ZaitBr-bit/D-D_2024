// ============================================================
// Pontos de Vida de magia calculados por dados (Vitalidade Vazia 2d4 + 4, Banquete de
// Heróis 2d10 de PV máximos): média ou o valor que o jogador rolou. Sem DOM.
// ============================================================

/**
 * Descrição dos dados de uma magia de PV.
 * @typedef {object} DadosPV
 * @property {number} quantidade Quantidade de dados (2 em 2d4).
 * @property {number} faces Faces de cada dado (4 em 2d4).
 * @property {number} [fixo] Valor fixo somado (4 em 2d4 + 4).
 * @property {number} [por_circulo] Soma por círculo de espaço acima de `base_circulo` (5 na Vitalidade Vazia).
 * @property {number} [base_circulo] Círculo da magia (1 na Vitalidade Vazia).
 */

/** Parte fixa dos PV no círculo dado: valor fixo mais o bônus por círculo acima da base. */
export function parteFixaPV(d, circulo) {
  const acima = Math.max(0, (Number(circulo) || d.base_circulo || 0) - (d.base_circulo || 0));
  return (d.fixo || 0) + (d.por_circulo || 0) * acima;
}

/** Média dos dados, arredondada para baixo (2d4 = 5; 2d10 = 11). */
export function mediaDosDados(d) {
  return Math.floor(d.quantidade * (d.faces + 1) / 2);
}

/** PV pela média no círculo dado. */
export function valorPelaMedia(d, circulo) {
  return mediaDosDados(d) + parteFixaPV(d, circulo);
}

/** Menor e maior soma possíveis para os dados. */
export function limitesDosDados(d) {
  return { minimo: d.quantidade, maximo: d.quantidade * d.faces };
}

/**
 * PV a partir da soma que o jogador rolou: soma dos dados mais a parte fixa.
 * @param {DadosPV} d Dados da magia.
 * @param {number} circulo Círculo do espaço gasto.
 * @param {number|string} soma Soma dos dados rolados.
 * @returns {number|null} PV, ou null se a soma não é um inteiro dentro dos limites dos dados.
 */
export function valorPelosDados(d, circulo, soma) {
  const n = Number(soma);
  const { minimo, maximo } = limitesDosDados(d);
  if (!Number.isInteger(n) || n < minimo || n > maximo) return null;
  return n + parteFixaPV(d, circulo);
}
