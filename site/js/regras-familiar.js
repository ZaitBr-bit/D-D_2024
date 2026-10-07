// ============================================================
// Regras puras do familiar (magia Convocar Familiar, PHB 2024). Sem DOM.
//
// O livro: o familiar tem as estatísticas da forma escolhida (apêndice B),
// embora seja Celestial, Feérico ou Ínfero (à escolha) em vez de Fera. Só
// pode haver um: conjurar de novo com um familiar troca a forma. A 0 PV ele
// desaparece e volta quando a magia é conjurada de novo. Como ação Usar
// Magia, é possível descartá-lo temporariamente (mini dimensão), fazê-lo
// reaparecer a até 9 m, ou descartá-lo para sempre.
// O Pacto da Corrente soma formas especiais à lista.
// ============================================================

import { nivelNa, subclasseDe } from './regras-multiclasse.js';

/** Tipos que o familiar pode ter no lugar de Fera. */
export const TIPOS_FAMILIAR = ['Celestial', 'Feérico', 'Ínfero'];

/** Formas especiais da invocação Pacto da Corrente. */
export const FORMAS_ESPECIAIS_PACTO = [
  'Cobra Peçonhenta', 'Diabrete', 'Esfinge Maravilhosa', 'Esqueleto',
  'Pseudodragão', 'Quasit', 'Slaad Girino', 'Sprite',
];

/** Situações possíveis do familiar. */
export const SITUACOES_FAMILIAR = ['ativo', 'descartado', 'desaparecido'];

/**
 * Formas comuns: Feras de Nível de Desafio 0 do apêndice de criaturas. A
 * lista do livro (Aranha, Coruja, Corvo, Doninha, Falcão, Gato, Lagarto,
 * Morcego, Polvo, Rato, Sapo) está contida nela; "Falcão" e "Sapo" têm no
 * apêndice os nomes Gavião e Rã.
 * @param {Array<object>} criaturas Criaturas do apêndice.
 * @returns {Array<object>} Criaturas elegíveis, em ordem alfabética.
 */
export function formasComuns(criaturas) {
  return (criaturas || [])
    .filter((c) => /^0(\s|$)/.test(String(c.nd || '')) && /^Fera/.test(String(c.tipo_tamanho || '')))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Formas especiais do Pacto da Corrente presentes no apêndice.
 * @param {Array<object>} criaturas Criaturas do apêndice.
 * @returns {Array<object>} Criaturas, na ordem da lista do livro.
 */
export function formasEspeciais(criaturas) {
  return FORMAS_ESPECIAIS_PACTO
    .map((nome) => (criaturas || []).find((c) => c.nome === nome))
    .filter(Boolean);
}

/**
 * PV da forma: o valor médio, que é o número antes do parêntese ("2 (1d4)").
 * @param {object} criatura Criatura do apêndice.
 * @returns {number} PV máximo do familiar (mínimo 1).
 */
export function pvDaForma(criatura) {
  const n = parseInt(String(criatura?.pv || '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Tamanho da criatura ("Minúsculo"), lido de `tipo_tamanho` ("Fera Minúscula, ...").
 * @param {object} criatura Criatura do apêndice.
 * @returns {string} Tamanho, ou '' quando não reconhece.
 */
export function tamanhoDaForma(criatura) {
  const m = String(criatura?.tipo_tamanho || '').match(/^\S+\s+(\S+?)[\s,(]/);
  return m ? m[1] : '';
}

/**
 * Tipo mostrado na ficha: na forma comum, o tipo escolhido no lugar de Fera;
 * na especial, o tipo que a criatura já tem.
 * @param {object} criatura Criatura do apêndice.
 * @param {string} tipo Celestial, Feérico ou Ínfero.
 * @param {boolean} especial Forma do Pacto da Corrente.
 * @returns {string} Linha de tipo e tamanho.
 */
export function tipoExibido(criatura, tipo, especial) {
  const base = String(criatura?.tipo_tamanho || '');
  if (especial || !tipo) return base;
  return base.replace(/^Fera/, tipo);
}

/** Tipo extra do familiar do Necromante (no lugar de Fera). */
export const TIPO_MORTO_VIVO = 'Morto-Vivo';

/** Formas especiais do familiar do Necromante (Arcana Unleashed). */
export const FORMAS_ESPECIAIS_NECROMANTE = ['Esqueleto', 'Zumbi'];

/** Se o personagem é Necromante (Mago) de nível 3 ou mais. */
function ehNecromanteComFamiliar(p) {
  return subclasseDe(p, 'Mago') === 'Necromante' && (nivelNa(p, 'Mago') || 0) >= 3;
}

/**
 * Formas especiais oferecidas ao personagem: as do Pacto da Corrente na rota
 * 'pacto' e, para o Necromante, Esqueleto e Zumbi em qualquer rota.
 * @param {object} p Personagem.
 * @param {string} rota Rota da conjuração.
 * @param {Array<object>} criaturas Criaturas do apêndice.
 * @returns {Array<object>}
 */
export function formasEspeciaisDoPersonagem(p, rota, criaturas) {
  const nomes = new Set();
  if (rota === 'pacto') FORMAS_ESPECIAIS_PACTO.forEach((n) => nomes.add(n));
  if (ehNecromanteComFamiliar(p)) FORMAS_ESPECIAIS_NECROMANTE.forEach((n) => nomes.add(n));
  return [...nomes].map((nome) => (criaturas || []).find((c) => c.nome === nome)).filter(Boolean);
}

/**
 * Tipos que o personagem pode dar ao familiar de forma comum.
 * @param {object} p Personagem.
 * @returns {string[]}
 */
export function tiposDoPersonagem(p) {
  return ehNecromanteComFamiliar(p) ? [...TIPOS_FAMILIAR, TIPO_MORTO_VIVO] : [...TIPOS_FAMILIAR];
}

/**
 * Estado do familiar, ou `null` quando não há.
 * @param {object} p Personagem.
 * @returns {object|null}
 */
export function estadoFamiliar(p) {
  const f = p?.recursos?.familiar;
  return f && f.forma ? f : null;
}

/**
 * Registra o familiar com PV cheios, trocando o anterior (só pode haver um).
 * @param {object} p Personagem, mutado no lugar.
 * @param {object} criatura Criatura do apêndice.
 * @param {{tipo?: string, especial?: boolean, origem?: string, tipos?: string[]}} [opcoes] `tipos`: tipos
 *   permitidos ao personagem (o Necromante soma Morto-Vivo); `origem` marca o
 *   familiar que não vem da magia ('companheiro_selvagem': some no Descanso Longo).
 * @returns {object} O estado gravado.
 */
export function registrarFamiliar(p, criatura, { tipo = 'Feérico', especial = false, origem = '', tipos = TIPOS_FAMILIAR } = {}) {
  if (!p.recursos) p.recursos = {};
  const pv = pvDaForma(criatura);
  p.recursos.familiar = {
    forma: criatura.nome,
    tipo: especial ? '' : (tipos.includes(tipo) ? tipo : 'Feérico'),
    especial: !!especial,
    pv_max: pv,
    pv_atual: pv,
    situacao: 'ativo',
    ...(origem ? { origem } : {}),
  };
  return p.recursos.familiar;
}

/**
 * Soma `delta` aos PV do familiar (negativo é dano), entre 0 e o máximo. A 0
 * PV ele desaparece até a magia ser conjurada de novo.
 * @param {object} p Personagem, mutado no lugar.
 * @param {number} delta PV a somar.
 * @returns {object|null} O estado, ou null sem familiar ou sem presença em campo.
 */
export function ajustarPVFamiliar(p, delta) {
  const f = estadoFamiliar(p);
  if (!f || f.situacao !== 'ativo') return null;
  f.pv_atual = Math.max(0, Math.min(f.pv_max, f.pv_atual + (Number(delta) || 0)));
  if (f.pv_atual === 0) f.situacao = 'desaparecido';
  return f;
}

/**
 * Descarta o familiar para a mini dimensão (ação Usar Magia); ele mantém os PV.
 * @param {object} p Personagem, mutado no lugar.
 * @returns {boolean} true se mudou de situação.
 */
export function descartarFamiliar(p) {
  const f = estadoFamiliar(p);
  if (!f || f.situacao !== 'ativo') return false;
  f.situacao = 'descartado';
  return true;
}

/**
 * Faz o familiar descartado reaparecer a até 9 m (ação Usar Magia).
 * @param {object} p Personagem, mutado no lugar.
 * @returns {boolean} true se mudou de situação.
 */
export function reaparecerFamiliar(p) {
  const f = estadoFamiliar(p);
  if (!f || f.situacao !== 'descartado') return false;
  f.situacao = 'ativo';
  return true;
}

/**
 * Descarta o familiar para sempre.
 * @param {object} p Personagem, mutado no lugar.
 * @returns {boolean} true se havia familiar.
 */
export function dispensarFamiliar(p) {
  if (!estadoFamiliar(p)) return false;
  delete p.recursos.familiar;
  return true;
}
