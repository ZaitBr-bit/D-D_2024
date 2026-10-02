// ============================================================
// Regras puras de condições (sem DOM, sem estado da ficha).
// ============================================================

// Condições que incluem Incapacitado pelo glossário (CONDICOES_DESCRICAO em
// sheet/condicoes.js), além da própria Incapacitado.
const CONDICOES_INCAPACITANTES = ['Incapacitado', 'Atordoado', 'Inconsciente', 'Paralisado', 'Petrificado'];

/**
 * Devolve a primeira condição da lista que deixa o personagem Incapacitado
 * (a própria Incapacitado ou uma que a inclui), ou null se não houver.
 */
export function condicaoIncapacitante(condicoes) {
  const lista = condicoes || [];
  return CONDICOES_INCAPACITANTES.find(c => lista.includes(c)) || null;
}

/**
 * Indica se a lista de condições deixa o personagem Incapacitado:
 * Incapacitado, Atordoado, Inconsciente, Paralisado ou Petrificado.
 */
export function estaIncapacitado(condicoes) {
  return condicaoIncapacitante(condicoes) !== null;
}
