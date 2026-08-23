// ============================================================
// Conjuracao em multiclasse: nivel de conjurador e tabela unificada.
//
// Funcoes PURAS: recebem o personagem por parametro e nunca leem `char`
// nem `personagem` como global.
//
// Este modulo NAO escreve em char.espacos_magia. Reconciliar os espacos
// gravados na ficha e do sub-projeto 4.
// ============================================================
import { CLASSES_INFO } from './dados-classes.js';
import { SUBCLASSES_CONJURADORAS } from './regras-conjuracao-subclasse.js';
import { classesDe } from './regras-multiclasse.js';

// Indice = nivel de conjurador (1..20). Cada valor e [1o..9o circulo].
// Transcrita do livro (Informacoes Separadas/D&D 5.5 - Livro do Jogador
// (2024) 5.3.7.md:2085-2102), linha a linha. 0 onde o livro traz "-".
export const TABELA_CONJURADOR_MULTICLASSE = {
  1:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6:  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7:  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8:  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9:  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

/**
 * Classes do personagem que possuem a caracteristica Conjuracao.
 * Bruxo fica DE FORA: ele tem Magia de Pacto, que e reserva separada
 * (livro:2118). Guerreiro e Ladino so entram com a subclasse conjuradora.
 * @returns {Array<{classe: string, nivel: number, categoria: string}>}
 */
export function classesConjuradoras(char) {
  return classesDe(char)
    .filter((c) => {
      const cat = CLASSES_INFO[c.classe]?.categoria_conjuracao;
      if (!cat || cat === 'nenhuma' || cat === 'pacto') return false;
      if (cat === 'um_terco_subclasse') return SUBCLASSES_CONJURADORAS.includes(c.subclasse);
      return true;
    })
    .map((c) => ({
      classe: c.classe,
      nivel: c.nivel,
      categoria: CLASSES_INFO[c.classe].categoria_conjuracao,
    }));
}

/**
 * True quando o personagem tem Conjuracao de DUAS ou mais classes.
 * Com uma so, o livro:2071 manda seguir as regras daquela classe -- e as
 * duas coisas divergem de verdade para os 1/3 conjuradores.
 */
export function usaTabelaUnificada(char) {
  return classesConjuradoras(char).length >= 2;
}

/**
 * Nivel de conjurador combinado (livro:2104-2110): nivel inteiro dos
 * plenos, metade ARREDONDADA PARA CIMA dos meios, e um terco arredondado
 * para baixo dos de subclasse.
 * @returns {number} 0 quando a tabela unificada nao se aplica.
 */
export function nivelConjurador(char) {
  if (!usaTabelaUnificada(char)) return 0;
  return classesConjuradoras(char).reduce((soma, c) => {
    if (c.categoria === 'plena') return soma + c.nivel;
    if (c.categoria === 'meia') return soma + Math.ceil(c.nivel / 2);
    if (c.categoria === 'um_terco_subclasse') return soma + Math.floor(c.nivel / 3);
    return soma;
  }, 0);
}

/**
 * Espacos por circulo pela tabela unificada.
 * Devolve NULL -- nao um objeto vazio -- quando a tabela nao se aplica:
 * `{}` seria lido como "zero espacos" e passaria em silencio, enquanto
 * null obriga o chamador a usar a tabela da propria classe.
 * So os circulos com ao menos um espaco entram, como faz getEspacosMagia
 * -- mas so as CHAVES batem com aquela funcao. O VALOR aqui e um NUMERO
 * puro (a quantidade de espacos), nao `{ total, usados }`: esta funcao so
 * responde "quantos", ela nao inicializa gasto. Todo o resto do app grava
 * espacos de magia no formato `{ [circulo]: { total, usados } }` --
 * utils.js:393-405 (getEspacosMagia), levelup.js:950-966,
 * creator/wizard.js:447 -- e quem for gravar o resultado desta funcao em
 * `char.espacos_magia` precisa converter cada numero para
 * `{ total: numero, usados: 0 }` antes de escrever.
 * @returns {{[circulo: number]: number}|null}
 */
export function espacosPorCirculo(char) {
  if (!usaTabelaUnificada(char)) return null;
  const linha = TABELA_CONJURADOR_MULTICLASSE[Math.min(nivelConjurador(char), 20)];
  if (!linha) return null;
  const espacos = {};
  linha.forEach((qtd, i) => { if (qtd > 0) espacos[i + 1] = qtd; });
  return espacos;
}

/** True se o personagem tem a caracteristica Magia de Pacto (Bruxo). */
export function temMagiaDePacto(char) {
  return classesDe(char).some((c) =>
    CLASSES_INFO[c.classe]?.categoria_conjuracao === 'pacto' && c.nivel >= 1);
}
