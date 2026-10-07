// ============================================================
// Regras puras do Necromante (Mago, Arcana Unleashed). Sem DOM.
// Fórmulas do livro: Vitalidade Morta-Viva (nv 3), Fortitude Morta-Viva e
// Golpe Debilitante (nv 6), Colher Mortos-Vivos (nv 10), Fortalecer e
// Extinguir Mortos-Vivos (nv 14).
// ============================================================
import { nivelNa, subclasseDe } from './regras-multiclasse.js';
import { calcMod } from './utils.js';

/** Magias de Necromancia que criam ou invocam Mortos-Vivos. */
export const MAGIAS_QUE_CRIAM_MORTOS_VIVOS = ['Animar Mortos', 'Criar Mortos-Vivos', 'Invocar Morto-Vivo'];

/** Se a escola é Necromancia. */
export function ehMagiaDeNecromancia(escola) {
  return escola === 'Necromancia';
}

/** Se o personagem tem a subclasse Necromante no Mago. */
export function ehNecromante(p) {
  return subclasseDe(p, 'Mago') === 'Necromante';
}

/** Nível do personagem na classe Mago. */
export function nivelDoMago(p) {
  return nivelNa(p, 'Mago') || 0;
}

/** Modificador de Inteligência (valor gravado em `atributos`). */
export function modInteligencia(p) {
  return calcMod(p?.atributos?.inteligencia ?? 10);
}

/** PV recuperados por Vitalidade Morta-Viva: nível do espaço gasto + nível de Mago. */
export function vitalidadeMortaViva(p, circuloDoEspaco) {
  if (!ehNecromante(p) || nivelDoMago(p) < 3) return 0;
  return (Number(circuloDoEspaco) || 0) + nivelDoMago(p);
}

/** Aumento de PV máximo e atual do Morto-Vivo criado: Int + metade do nível (para baixo). */
export function fortitudeMortaViva(p) {
  if (!ehNecromante(p) || nivelDoMago(p) < 6) return 0;
  return Math.max(0, modInteligencia(p) + Math.floor(nivelDoMago(p) / 2));
}

/** Dano necrótico extra do Golpe Debilitante: modificador de Inteligência, mínimo 1. */
export function golpeDebilitante(p) {
  if (!ehNecromante(p) || nivelDoMago(p) < 6) return 0;
  return Math.max(1, modInteligencia(p));
}

/** PV que o mago recupera ao Colher um Morto-Vivo: o nível de Mago. */
export function pvDaColheita(p) {
  if (!ehNecromante(p) || nivelDoMago(p) < 10) return 0;
  return nivelDoMago(p);
}

/** PV temporários de Fortalecer Mortos-Vivos: o nível de Mago. */
export function pvTemporariosFortalecer(p) {
  if (!ehNecromante(p) || nivelDoMago(p) < 14) return 0;
  return nivelDoMago(p);
}

/** Quantidade de d6 de Extinguir: metade dos Dados de Vida (para cima), mínimo 1. */
export function dadosDeExtinguir(dadosDeVida) {
  return Math.max(1, Math.ceil((Number(dadosDeVida) || 0) / 2));
}

/**
 * Estado do Necromante em `recursos.mago.subclasses.necromante`, criado com os
 * valores padrão.
 * @param {object} p Personagem, mutado no lugar.
 * @returns {{mortos_vivos: Array<object>, fortalecer_usado: boolean, livro_empunhado: boolean}}
 */
export function estadoNecromante(p) {
  if (!p.recursos) p.recursos = {};
  if (!p.recursos.mago) p.recursos.mago = {};
  if (!p.recursos.mago.subclasses) p.recursos.mago.subclasses = {};
  const s = p.recursos.mago.subclasses.necromante || (p.recursos.mago.subclasses.necromante = {});
  if (!Array.isArray(s.mortos_vivos)) s.mortos_vivos = [];
  if (typeof s.fortalecer_usado !== 'boolean') s.fortalecer_usado = false;
  if (typeof s.livro_empunhado !== 'boolean') s.livro_empunhado = false;
  return s;
}

/** Se o Necromante está com o livro de magias na mão (ocupa 1 mão; marcado na seção Ataques). */
export function livroEmpunhado(p) {
  return ehNecromante(p) && nivelDoMago(p) >= 3 && estadoNecromante(p).livro_empunhado === true;
}

/**
 * Aviso quando uma característica que exige o livro de magias na mão (Poder
 * Sepulcral, Servos Fortalecidos, Mestre da Morte; níveis 6+) é usada sem ele.
 * O efeito não é bloqueado.
 * @param {object} p Personagem.
 * @returns {string} Texto do aviso; vazio se não se aplica ou o livro está empunhado.
 */
export function avisoLivroNaoEmpunhado(p) {
  if (!ehNecromante(p) || nivelDoMago(p) < 6 || livroEmpunhado(p)) return '';
  return 'Livro de magias não empunhado: esta característica exige o livro na mão (marque em Ataques).';
}

/** Número de dados da fórmula de PV do bloco ("13 (2d8 + 4)" -> 2). */
function dadosDaFormula(criatura) {
  const m = String(criatura?.pv || '').match(/\((\d+)d\d+/);
  return m ? Number(m[1]) : 1;
}

let _sequencia = 0;

/**
 * Registra Mortos-Vivos sob controle, com o PV do bloco mais a Fortitude
 * Morta-Viva (só do nível 6 em diante).
 * @param {object} p Personagem, mutado no lugar.
 * @param {object} criatura Bloco do apêndice (Esqueleto, Zumbi) ou `{ nome, pv }`.
 * @param {{quantidade?: number}} [opcoes]
 * @returns {Array<object>} As entradas criadas.
 */
export function registrarMortoVivo(p, criatura, { quantidade = 1 } = {}) {
  const e = estadoNecromante(p);
  const base = parseInt(String(criatura?.pv || ''), 10) || 1;
  const pv = base + fortitudeMortaViva(p);
  const criadas = [];
  for (let i = 0; i < Math.max(1, quantidade); i++) {
    _sequencia += 1;
    const entrada = {
      id: `mv${Date.now().toString(36)}${_sequencia}`, nome: criatura.nome, pv_max: pv, pv_atual: pv,
      pv_temporarios: 0, dados_de_vida: dadosDaFormula(criatura),
    };
    e.mortos_vivos.push(entrada);
    criadas.push(entrada);
  }
  return criadas;
}

/** Soma `delta` aos PV do Morto-Vivo, entre 0 e o máximo. */
export function ajustarPVMortoVivo(p, id, delta) {
  const m = estadoNecromante(p).mortos_vivos.find((x) => x.id === id);
  if (!m) return null;
  m.pv_atual = Math.max(0, Math.min(m.pv_max, m.pv_atual + (Number(delta) || 0)));
  return m;
}

/** Tira o Morto-Vivo da lista. */
export function dispensarMortoVivo(p, id) {
  const e = estadoNecromante(p);
  const i = e.mortos_vivos.findIndex((x) => x.id === id);
  if (i < 0) return false;
  e.mortos_vivos.splice(i, 1);
  return true;
}

/**
 * Colher Mortos-Vivos: o Morto-Vivo vai a 0 PV (sai da lista) e o mago
 * recupera PV iguais ao nível.
 * @returns {number} PV a recuperar (0 se não pôde colher).
 */
export function colherMortoVivo(p, id) {
  const cura = pvDaColheita(p);
  if (!cura || !dispensarMortoVivo(p, id)) return 0;
  return cura;
}

/**
 * Fortalecer Mortos-Vivos (1x por Descanso Longo): cada Morto-Vivo registrado
 * ganha PV temporários. Sem nenhum registrado, não gasta o uso.
 * @returns {number} PV temporários dados (0 se não aplicou).
 */
export function fortalecerMortosVivos(p) {
  const e = estadoNecromante(p);
  const pv = pvTemporariosFortalecer(p);
  if (!pv || e.fortalecer_usado || !e.mortos_vivos.length) return 0;
  e.mortos_vivos.forEach((m) => { m.pv_temporarios = Math.max(m.pv_temporarios || 0, pv); });
  e.fortalecer_usado = true;
  return pv;
}
