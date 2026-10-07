// ============================================================
// Regras puras da Forma Selvagem do Druida (PHB 2024). Sem DOM.
//
// O livro: como Ação Bônus o druida se multimorfa para uma forma Animal que
// conhece (Fera, ND máximo e Deslocamento de Voo pela tabela Formas de
// Feras), por metade do nível em horas, até usar de novo, ficar Incapacitado
// ou morrer. Ao assumir a forma ganha PV temporários iguais ao nível de
// Druida, mantém PV, Dados de Vida e atributos mentais, e não conjura.
// Círculo da Lua: ND máximo = nível ÷ 3 (arredondado para baixo), CA mínima
// 13 + Sabedoria, PV temporários = 3 × nível, e conjura as magias do Círculo.
// ============================================================

/** Formas de Feras: nível de Druida, formas conhecidas, ND máximo e voo. */
export const TABELA_FORMAS = [
  { nivel: 2, conhecidas: 4, nd: 0.25, voo: false },
  { nivel: 4, conhecidas: 6, nd: 0.5, voo: false },
  { nivel: 8, conhecidas: 8, nd: 1, voo: true },
];

/** Formas que o livro recomenda para começar. */
export const FORMAS_RECOMENDADAS = ['Aranha', 'Cavalo de Montaria', 'Lobo', 'Rato'];

/** Nome da subclasse do Druida com Formas Animais próprias. */
export const SUBCLASSE_LUA = 'Círculo da Lua';

/**
 * Converte o ND do apêndice ("1/4 (XP 50; BP +2)", "0 (XP 10…)") em número.
 * @param {string} nd Texto do ND.
 * @returns {number} ND numérico, ou Infinity quando não reconhece.
 */
export function ndNumero(nd) {
  const m = String(nd || '').trim().match(/^(\d+)(?:\/(\d+))?/);
  if (!m) return Infinity;
  return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
}

/**
 * Se a criatura tem Deslocamento de Voo.
 * @param {object} criatura Criatura do apêndice.
 * @returns {boolean}
 */
export function temVoo(criatura) {
  return /Voo/i.test(String(criatura?.deslocamento || ''));
}

/**
 * Limites da Forma Selvagem no nível de Druida: formas conhecidas, ND máximo
 * e voo. Sem Forma Selvagem (nível 1) devolve null. Círculo da Lua usa o
 * maior ND entre a tabela e nível ÷ 3.
 * @param {number} nivelDruida Nível na classe Druida.
 * @param {string} [subclasse] Subclasse do Druida.
 * @returns {{conhecidas: number, nd: number, voo: boolean}|null}
 */
export function limitesFormas(nivelDruida, subclasse = '') {
  const n = Number(nivelDruida) || 0;
  if (n < 2) return null;
  const linha = [...TABELA_FORMAS].reverse().find((l) => n >= l.nivel);
  let nd = linha.nd;
  if (subclasse === SUBCLASSE_LUA && n >= 3) nd = Math.max(nd, Math.max(1, Math.floor(n / 3)));
  return { conhecidas: linha.conhecidas, nd, voo: linha.voo };
}

/**
 * Feras do apêndice que o druida pode conhecer no nível dado.
 * @param {Array<object>} criaturas Criaturas do apêndice.
 * @param {number} nivelDruida Nível na classe Druida.
 * @param {string} [subclasse] Subclasse do Druida.
 * @returns {Array<object>} Criaturas elegíveis, em ordem alfabética.
 */
export function formasElegiveis(criaturas, nivelDruida, subclasse = '') {
  const lim = limitesFormas(nivelDruida, subclasse);
  if (!lim) return [];
  return (criaturas || [])
    .filter((c) => /^Fera/.test(String(c.tipo_tamanho || '')) && ndNumero(c.nd) <= lim.nd && (lim.voo || !temVoo(c)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Duração da forma em horas: metade do nível de Druida (mínimo 1).
 * @param {number} nivelDruida Nível na classe Druida.
 * @returns {number}
 */
export function duracaoHoras(nivelDruida) {
  return Math.max(1, Math.floor((Number(nivelDruida) || 0) / 2));
}

/**
 * PV temporários ao assumir a forma: nível de Druida; Círculo da Lua, 3×.
 * @param {number} nivelDruida Nível na classe Druida.
 * @param {string} [subclasse] Subclasse do Druida.
 * @returns {number}
 */
export function pvTemporariosDaForma(nivelDruida, subclasse = '') {
  const n = Number(nivelDruida) || 0;
  return subclasse === SUBCLASSE_LUA && n >= 3 ? 3 * n : n;
}

/**
 * CA na forma: a da Fera; Círculo da Lua usa 13 + Sabedoria se for maior.
 * @param {object} criatura Criatura do apêndice.
 * @param {string} [subclasse] Subclasse do Druida.
 * @param {number} [modSab] Modificador de Sabedoria.
 * @returns {number}
 */
export function caNaForma(criatura, subclasse = '', modSab = 0) {
  const base = parseInt(String(criatura?.ca || ''), 10) || 10;
  return subclasse === SUBCLASSE_LUA ? Math.max(base, 13 + (Number(modSab) || 0)) : base;
}

/**
 * Se o druida pode conjurar na forma: só o Círculo da Lua (magias do Círculo).
 * @param {object} p Personagem.
 * @param {string} subclasse Subclasse do Druida.
 * @returns {boolean}
 */
export function podeConjurarEmForma(p, subclasse = '') {
  return !estadoFormaSelvagem(p) || subclasse === SUBCLASSE_LUA;
}

/**
 * Forma ativa, ou `null`.
 * @param {object} p Personagem.
 * @returns {{forma: string}|null}
 */
export function estadoFormaSelvagem(p) {
  const f = p?.recursos?.druida?.forma_selvagem_atual;
  return f && f.forma ? f : null;
}

/**
 * Nomes das formas conhecidas, limitados ao máximo do nível.
 * @param {object} p Personagem.
 * @param {number} max Máximo de formas conhecidas.
 * @returns {string[]}
 */
export function formasConhecidas(p, max = Infinity) {
  const lista = p?.recursos?.druida?.formas_conhecidas;
  return Array.isArray(lista) ? lista.filter((n) => typeof n === 'string').slice(0, max) : [];
}

/**
 * Define as formas conhecidas (únicas, até `max`).
 * @param {object} p Personagem, mutado no lugar.
 * @param {string[]} nomes Formas escolhidas.
 * @param {number} max Máximo de formas conhecidas.
 * @returns {string[]} A lista gravada.
 */
export function definirFormasConhecidas(p, nomes, max) {
  if (!p.recursos) p.recursos = {};
  if (!p.recursos.druida) p.recursos.druida = {};
  p.recursos.druida.formas_conhecidas = [...new Set(nomes)].slice(0, max);
  return p.recursos.druida.formas_conhecidas;
}

/**
 * Assume a forma: grava a forma e soma os PV temporários (que não se
 * acumulam: vale o maior).
 * @param {object} p Personagem, mutado no lugar.
 * @param {object} criatura Criatura do apêndice.
 * @param {{nivel: number, subclasse?: string}} ctx Nível e subclasse do Druida.
 * @returns {{forma: string, pvTemporarios: number, horas: number}}
 */
export function assumirForma(p, criatura, { nivel, subclasse = '' }) {
  if (!p.recursos) p.recursos = {};
  if (!p.recursos.druida) p.recursos.druida = {};
  const pvTemporarios = pvTemporariosDaForma(nivel, subclasse);
  const horas = duracaoHoras(nivel);
  p.recursos.druida.forma_selvagem_atual = { forma: criatura.nome, horas, pv_temporarios: pvTemporarios };
  p.recursos.druida.forma_selvagem_ativa = true;
  p.pv_temporario = Math.max(p.pv_temporario || 0, pvTemporarios);
  return { forma: criatura.nome, pvTemporarios, horas };
}

/**
 * Sai da forma. Os PV temporários restantes ficam (o livro não os remove).
 * @param {object} p Personagem, mutado no lugar.
 * @returns {boolean} true se havia forma.
 */
export function sairDaForma(p) {
  const tinha = !!estadoFormaSelvagem(p);
  if (p?.recursos?.druida) {
    delete p.recursos.druida.forma_selvagem_atual;
    p.recursos.druida.forma_selvagem_ativa = false;
  }
  return tinha;
}
