// ============================================================
// Conjuração das subclasses 1/3 conjuradoras
//
// Cavaleiro Místico (Guerreiro) e Trapaceiro Arcano (Ladino) conjuram pela
// tabela da SUBCLASSE, não pela tabela da classe -- guerreiro.json e
// ladino.json não têm colunas de magia. Este módulo é a única fonte dessas
// tabelas: antes elas estavam copiadas em sheet/classes/guerreiro.js,
// sheet/classes/ladino.js e levelup.js (getCavaleiroMisticoEspacos), e a
// cópia do level up cobria só o Cavaleiro Místico -- foi por isso que o
// Trapaceiro Arcano subia para o nível 3 sem nenhum espaço de magia.
//
// Módulo puro de propósito: não importa estado da ficha, para poder ser
// consultado tanto pela ficha quanto pelo motor de subida de nível.
// ============================================================

// Progressão comum às duas subclasses (PHB 2024, tabelas "Conjuração de
// Cavaleiro Místico" e "Conjuração de Trapaceiro Arcano" -- as colunas de
// magias preparadas e de espaços são idênticas nas duas; só a quantidade
// de truques difere). Só os níveis em que a linha MUDA estão aqui: a
// consulta usa a última linha menor ou igual ao nível.
const PROGRESSAO = {
  3:  { preparadas: 3,  espacos: { 1: 2 } },
  4:  { preparadas: 4,  espacos: { 1: 3 } },
  7:  { preparadas: 5,  espacos: { 1: 4, 2: 2 } },
  8:  { preparadas: 6,  espacos: { 1: 4, 2: 2 } },
  10: { preparadas: 7,  espacos: { 1: 4, 2: 3 } },
  11: { preparadas: 8,  espacos: { 1: 4, 2: 3 } },
  13: { preparadas: 9,  espacos: { 1: 4, 2: 3, 3: 2 } },
  14: { preparadas: 10, espacos: { 1: 4, 2: 3, 3: 2 } },
  16: { preparadas: 11, espacos: { 1: 4, 2: 3, 3: 3 } },
  19: { preparadas: 12, espacos: { 1: 4, 2: 3, 3: 3, 4: 1 } },
  20: { preparadas: 13, espacos: { 1: 4, 2: 3, 3: 3, 4: 1 } }
};

// O que cada subclasse acrescenta à progressão comum.
// `truquesFixos`: truques que a característica CONCEDE (não são escolha do
// jogador) -- o Trapaceiro Arcano recebe Mãos Mágicas obrigatoriamente
// ("Você conhece três truques: Mãos Mágicas e dois outros truques à sua
// escolha", PHB 2024). O Cavaleiro Místico escolhe os dois livremente.
const SUBCLASSES = {
  'Cavaleiro Místico': {
    classe: 'Guerreiro',
    // "Atributo de Conjuração. Inteligência é seu atributo de conjuração
    // para suas magias de Mago." (PHB 2024, Classes.md:3968)
    atributoConjuracao: 'Inteligência',
    truques: (nivel) => (nivel >= 10 ? 3 : 2),
    truquesFixos: {}
  },
  'Trapaceiro Arcano': {
    classe: 'Ladino',
    // Mesma frase do livro, Classes.md:4473.
    atributoConjuracao: 'Inteligência',
    // 3 truques até o nível 9 (Mãos Mágicas + 2), 4 a partir do nível 10.
    truques: (nivel) => (nivel >= 10 ? 4 : 3),
    truquesFixos: { 3: ['Mãos Mágicas'] }
  }
};

/** Nomes das subclasses que concedem conjuração por tabela própria. */
export const SUBCLASSES_CONJURADORAS = Object.keys(SUBCLASSES);

/** Última linha da progressão menor ou igual ao nível informado. */
function linhaProgressao(nivel) {
  const niveis = Object.keys(PROGRESSAO).map(Number).sort((a, b) => a - b);
  let entrada = null;
  for (const n of niveis) {
    if (n <= nivel) entrada = PROGRESSAO[n];
  }
  return entrada;
}

/**
 * Tabela de conjuração da subclasse no nível informado.
 * @returns {{truques:number, preparadas:number, espacos:Object}|null} null se
 * a combinação classe/subclasse/nível não conjura.
 */
export function getConjuracaoSubclasse(classe, subclasse, nivel) {
  const def = SUBCLASSES[subclasse];
  if (!def || def.classe !== classe) return null;
  const nivelAtual = nivel || 1;
  if (nivelAtual < 3) return null;
  const linha = linhaProgressao(nivelAtual);
  if (!linha) return null;
  return {
    truques: def.truques(nivelAtual),
    preparadas: linha.preparadas,
    // Cópia: quem recebe grava direto no personagem, e devolver a tabela do
    // módulo faria dois personagens compartilharem o mesmo objeto.
    espacos: { ...linha.espacos }
  };
}

/**
 * Espaços de magia da subclasse no formato que o personagem guarda
 * (`{ 1: { total, usados } }`). Sempre objetos novos.
 */
export function getEspacosSubclasseConjuradora(classe, subclasse, nivel) {
  const conj = getConjuracaoSubclasse(classe, subclasse, nivel);
  if (!conj) return {};
  const espacos = {};
  for (const [circulo, total] of Object.entries(conj.espacos)) {
    espacos[circulo] = { total, usados: 0 };
  }
  return espacos;
}

/**
 * Truques concedidos automaticamente pela subclasse AO ALCANÇAR este nível
 * (não contam como escolha do jogador). Lista vazia quando não há.
 */
export function getTruquesFixosSubclasse(classe, subclasse, nivel) {
  const def = SUBCLASSES[subclasse];
  if (!def || def.classe !== classe) return [];
  return [...(def.truquesFixos[nivel] || [])];
}

/**
 * Todos os truques fixos que a subclasse já concedeu até o nível informado
 * -- usado para saber quantos dos truques da tabela NÃO são escolha do
 * jogador.
 */
export function getTruquesFixosAcumulados(classe, subclasse, nivel) {
  const def = SUBCLASSES[subclasse];
  if (!def || def.classe !== classe) return [];
  const nomes = [];
  for (const [nivelConcessao, truques] of Object.entries(def.truquesFixos)) {
    if (Number(nivelConcessao) <= nivel) nomes.push(...truques);
  }
  return nomes;
}

/**
 * Atributo de conjuração da subclasse, no mesmo formato de
 * `CLASSES_INFO.atributo_conjuracao` (ex.: 'Inteligência').
 * Devolve null quando a combinação classe/subclasse não conjura.
 */
export function getAtributoConjuracaoSubclasse(classe, subclasse) {
  const def = SUBCLASSES[subclasse];
  if (!def || def.classe !== classe) return null;
  return def.atributoConjuracao || null;
}
