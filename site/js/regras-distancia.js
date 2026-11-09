// ============================================================
// Regras puras de distância: metros para quadrados de grid (1,5 m = 1 quadrado).
// Sem DOM e sem leitura de personagem.
// ============================================================

// Número seguido de "metros", "metro" ou "m", sem "(N q)" logo depois (já anotado).
const RE_DISTANCIA = /(\d+(?:[.,]\d+)?)\s*(?:metros?|m)(?![\p{L}\p{N}_])(?!\s*\(\d+\s*q\))/gu;

/** Converte metros em quadrados (piso de metros/1,5); entrada inválida ou negativa vira 0. */
export function metrosParaQuadrados(metros) {
  const n = Number(metros);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n / 1.5 + 1e-9);
}

/** Troca cada "N metros/metro/m" do texto por "N m (X q)"; texto já anotado ou sem número fica igual. */
export function comQuadrados(texto) {
  const s = String(texto ?? '');
  return s.replace(RE_DISTANCIA, (_, num) =>
    `${num} m (${metrosParaQuadrados(parseFloat(num.replace(',', '.')))} q)`);
}

/** Formata o deslocamento final ("9 metros (Voo 12m, Escalada 9m)") como "9 m (6 q) · Voo 12 m (8 q), ...". */
export function deslocamentoComQuadrados(texto) {
  const s = String(texto ?? '');
  if (/\(\d+\s*q\)/.test(s)) return s; // já formatado: devolve igual (idempotência)
  const m = s.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!m) return comQuadrados(s);
  return `${comQuadrados(m[1])} · ${comQuadrados(m[2])}`;
}
