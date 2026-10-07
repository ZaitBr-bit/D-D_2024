// ============================================================
// Regras puras do Necromante (Mago, Arcana Unleashed). Sem DOM.
// Fórmulas do livro: Vitalidade Morta-Viva (nv 3), Fortitude Morta-Viva e
// Golpe Debilitante (nv 6), Colher Mortos-Vivos (nv 10), Fortalecer e
// Extinguir Mortos-Vivos (nv 14).
// ============================================================
import { nivelNa, nivelTotal, subclasseDe } from './regras-multiclasse.js';
import { ajustarPVFamiliar, estadoFamiliar } from './regras-familiar.js';
import { bonusProficiencia, calcMod } from './utils.js';

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

/**
 * Formas do Espírito Morto-Vivo (magia Invocar Morto-Vivo, 3º círculo). PV base
 * no 3º círculo; cada círculo acima soma 10. A ação e o dano seguem o bloco do livro.
 */
export const FORMAS_ESPIRITO = {
  'Esquelético': {
    pvBase: 20, deslocamento: '9 m', alcance: '45 m', acao: 'Raio da Cova', corpoACorpo: false,
    dano: (c) => `2d4 + 3 + ${c}`, tipoDano: 'Necrótico', extra: '',
    traco: 'Sem traço próprio; ataca à distância.',
  },
  'Fantasmagórico': {
    pvBase: 30, deslocamento: '9 m; Voo 12 m (pairar)', alcance: '1,5 m', acao: 'Toque Mortal', corpoACorpo: true,
    dano: (c) => `1d8 + 3 + ${c}`, tipoDano: 'Necrótico', extra: 'o alvo fica Amedrontado até o fim do próximo turno dele',
    traco: 'Passagem Incorpórea: atravessa criaturas e objetos como Terreno Difícil; terminar o turno dentro de um objeto causa 1d10 de dano Energético por 1,5 m.',
  },
  'Pútrido': {
    pvBase: 30, deslocamento: '9 m', alcance: '1,5 m', acao: 'Garra Podre', corpoACorpo: true,
    dano: (c) => `1d6 + 3 + ${c}`, tipoDano: 'Cortante', extra: 'alvo Envenenado fica Paralisado até o fim do próximo turno dele',
    traco: 'Aura Purulenta: criatura (exceto você) que começa o turno a até 1,5 m dele faz salvaguarda de Constituição (sua CD) ou fica Envenenada até o início do próximo turno.',
  },
};

/** PV do espírito: base da forma + 10 por círculo acima do 3º. */
export function pvDoEspirito(forma, circulo) {
  return (FORMAS_ESPIRITO[forma]?.pvBase || 0) + 10 * Math.max(0, (Number(circulo) || 3) - 3);
}

/** Dados do espírito que dependem do círculo e do conjurador (CA, ataques, bônus de ataque). */
export function dadosDoEspirito(p, forma, circulo) {
  const f = FORMAS_ESPIRITO[forma];
  const c = Number(circulo) || 3;
  return {
    forma, circulo: c, ca: 11 + c, ataques: Math.max(1, Math.floor(c / 2)),
    bonusAtaque: modInteligencia(p) + bonusProficiencia(nivelTotal(p) || 1),
    acao: f?.acao || '', dano: f ? f.dano(c) : '', tipoDano: f?.tipoDano || '',
  };
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

/**
 * Registra o Espírito Morto-Vivo de Invocar Morto-Vivo. A criatura é uma só por
 * conjuração: um espírito anterior some. PV do bloco do livro mais a Fortitude
 * Morta-Viva (nível 6+). Não tem Dados de Vida.
 * @param {object} p Personagem, mutado no lugar.
 * @param {string} forma Esquelético, Fantasmagórico ou Pútrido.
 * @param {number} circulo Círculo do espaço gasto.
 * @returns {object|null} A entrada criada; null se a forma não existe.
 */
export function registrarEspirito(p, forma, circulo) {
  if (!FORMAS_ESPIRITO[forma]) return null;
  const e = estadoNecromante(p);
  e.mortos_vivos = e.mortos_vivos.filter((m) => !m.espirito);
  _sequencia += 1;
  const pv = pvDoEspirito(forma, circulo) + fortitudeMortaViva(p);
  const entrada = {
    id: `mv${Date.now().toString(36)}${_sequencia}`, nome: `Espírito Morto-Vivo (${forma})`,
    pv_max: pv, pv_atual: pv, pv_temporarios: 0, dados_de_vida: 0,
    espirito: { forma, circulo: Number(circulo) || 3 },
  };
  e.mortos_vivos.push(entrada);
  return entrada;
}

/**
 * Criaturas Mortas-Vivas que podem receber a cura da Vitalidade Morta-Viva: as
 * registradas e o familiar Morto-Vivo (tipo Morto-Vivo, Esqueleto ou Zumbi), em
 * campo e com PV abaixo do máximo.
 * @param {object} p Personagem.
 * @returns {Array<{tipo: 'morto'|'familiar', id: string, nome: string, pv_atual: number, pv_max: number}>}
 */
export function candidatosVitalidade(p) {
  const lista = estadoNecromante(p).mortos_vivos
    .filter((m) => m.pv_atual < m.pv_max)
    .map((m) => ({ tipo: 'morto', id: m.id, nome: m.nome, pv_atual: m.pv_atual, pv_max: m.pv_max }));
  const f = estadoFamiliar(p);
  const familiarMortoVivo = f && (f.tipo === 'Morto-Vivo' || (f.especial && ['Esqueleto', 'Zumbi'].includes(f.forma)));
  if (familiarMortoVivo && f.situacao === 'ativo' && f.pv_atual < f.pv_max) {
    lista.push({ tipo: 'familiar', id: 'familiar', nome: `Familiar: ${f.forma}`, pv_atual: f.pv_atual, pv_max: f.pv_max });
  }
  return lista;
}

/**
 * Aplica a cura da Vitalidade Morta-Viva ao candidato escolhido.
 * @returns {number} PV realmente recuperados (limitados ao máximo); 0 se o candidato não existe mais.
 */
export function curarCandidatoVitalidade(p, candidato, pv) {
  const antes = candidato.tipo === 'familiar' ? estadoFamiliar(p)?.pv_atual : estadoNecromante(p).mortos_vivos.find((m) => m.id === candidato.id)?.pv_atual;
  if (antes == null) return 0;
  const depois = candidato.tipo === 'familiar'
    ? ajustarPVFamiliar(p, pv)?.pv_atual
    : ajustarPVMortoVivo(p, candidato.id, pv)?.pv_atual;
  return depois == null ? 0 : depois - antes;
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
