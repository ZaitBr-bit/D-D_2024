// ============================================================
// Conjuracao em multiclasse: nivel de conjurador e tabela unificada.
//
// Funcoes PURAS: recebem o personagem por parametro e nunca leem `char`
// nem `personagem` como global.
//
// migrarEspacosDeMagia (Tarefa 2) MUTA o `p` recebido -- escreve em
// `p.espacos_magia` -- mas continua pura no sentido acima: nunca toca
// `char` global, so o parametro. O ponto de chamada em producao existe
// desde a Tarefa 4: `site/js/pages/sheet.js:103` chama `migrarEspacosMagia()`
// (sheet/migracoes.js), que chama esta funcao, ANTES de qualquer leitor de
// `char.espacos_magia` rodar -- junto das demais migracoes de abertura de
// ficha. A Tarefa 4 tambem removeu os blocos legados que reescreviam
// `char.espacos_magia` na forma antiga a cada render; sem essa remocao,
// ligar a chamada teria apagado o gasto do jogador na primeira abertura de
// ficha (ver task-2-report.md e task-4-report.md).
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
 *
 * ARREDONDA POR CLASSE, NAO SOBRE A SOMA -- decisao registrada, nao
 * acidente. A frase do livro ("Metade dos seus niveis (arredonde para
 * cima) NAS CLASSES Guardiao e Paladino") e ambigua em portugues e em
 * ingles: da para ler como ceil((Guardiao + Paladino) / 2), uma metade
 * so. A regra oficial e a leitura POR CLASSE -- Jeremy Crawford,
 * 18/10/2016: "Multiclass spell slots: when dividing the levels of
 * multiple classes, you divide, round down, and then add the results
 * together". O 2024 trocou o sentido do arredondamento dos meios (para
 * cima), nao a ordem das operacoes: divide-se, arredonda-se e SO ENTAO
 * se soma. As duas leituras divergem no par minimo Guardiao 3/Paladino
 * 3 (por classe = 2 + 2 = 4; pela soma = ceil(6/2) = 3), preso pelo
 * Oraculo 12b de testes/regras/unidade/multiclasse-motor.test.mjs --
 * antes dele NENHUM oraculo distinguia as duas leituras.
 *
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
 * responde "quantos", ela nao inicializa gasto. NINGUEM deve gravar este
 * resultado em `char.espacos_magia` (Tarefa 4, sub-projeto 4): o campo
 * guarda so `usados`, por FONTE e circulo (`{conjuracao:{...},pacto:{...}}`)
 * -- o TOTAL nunca e armazenado, e sempre derivado a cada leitura por
 * montarReservasDeEspacos (sheet/reservas-espacos.js), que chama esta
 * funcao de novo quando precisa. `getEspacosMagia` (utils.js) continua
 * devolvendo `{ total, usados }` -- e' a tabela de UMA classe so, usada por
 * quem ainda le por classe direto (ex.: criador de personagem) -- mas essa
 * forma nunca chega a `char.espacos_magia`.
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

/**
 * True quando o personagem conjura por ALGUMA de suas classes -- a
 * caracteristica Conjuracao de qualquer uma delas (inclusive as de
 * subclasse, Cavaleiro Mistico e Trapaceiro Arcano) ou a Magia de Pacto
 * do Bruxo.
 *
 * E o PORTAO DE TELA, nao um calculo de regra: quem decide "esta ficha
 * mostra a secao de Magias / a caixa de CD de Magia?" pergunta aqui.
 * Existe porque os portoes liam `CLASSES_INFO[char.classe].conjurador`
 * -- o espelho da classe INICIAL. Um Barbaro 5/Mago 1 dava falso e nao
 * via a secao de Magias; como ela e a UNICA superficie da ficha com o
 * botao "+ Magia", o personagem ficava sem caminho nenhum para
 * registrar a primeira magia, mesmo com montarReservasDeEspacos ja lhe
 * concedendo os espacos corretos. Beco sem saida, nao so numero errado.
 *
 * Deliberadamente mais LARGO que nivelConjurador: aqui o Bruxo entra
 * (tem magias e CD, so nao entra na tabela unificada) e nao ha piso de
 * duas classes -- classe unica tambem conjura.
 */
export function conjuraPorAlgumaClasse(char) {
  return classesConjuradoras(char).length > 0 || temMagiaDePacto(char);
}

/**
 * Migra os espacos de magia gravados da forma antiga -- `{ [circulo]:
 * { total, usados } }`, onde o TOTAL era armazenado -- para a forma nova
 * por FONTE -- `{ conjuracao: {circulo: usados}, pacto: {circulo: usados} }`,
 * onde so `usados` sobrevive (o total volta a ser DERIVADO da regra a
 * cada leitura, em montarReservasDeEspacos).
 *
 * Para ONDE vai o `usados` antigo: um Bruxo de classe UNICA tem hoje o
 * PACTO gravado em `espacos_magia` -- bruxo.js documenta esse campo como
 * "o unico circulo onde ele tem espacos". Qualquer outra combinacao
 * (nenhuma classe de pacto, ou Bruxo MULTICLASSE) e Conjuracao.
 *
 * LIMITACAO CONHECIDA (registrada no ledger, nao consertada aqui): um
 * Bruxo multiclasse (`classesDe(p).length !== 1`, ex.: Bruxo 5/Mago 5) cai
 * no ramo 'conjuracao' por inteiro -- inclusive o que era gasto de PACTO
 * no campo antigo. A DIRECAO da perda e essa: gasto de pacto vira gasto
 * de conjuracao (nunca o contrario). Julgado defensavel: multiclasse so
 * existe nesta branch ainda nao mesclada, entao nenhuma ficha armazenada
 * em producao pode ter chegado a essa combinacao -- toda ficha real que
 * existir ate aqui tem `classesDe(p).length === 1` depois de
 * migrarMulticlasse().
 *
 * A SATURACAO (usados > total) NAO acontece aqui -- ela e responsabilidade
 * da leitura (Math.min em montarReservasDeEspacos), pelo mesmo motivo de
 * reservasDadosVida: saturar na escrita apagaria um gasto que a regra
 * poderia voltar a acomodar depois (o jogador sobe de nivel e o total
 * cresce).
 *
 * IDEMPOTENTE: a guarda abaixo cobre nao so a forma nova "cheia" mas
 * tambem `{ conjuracao: {}, pacto: {} }` -- o resultado desta propria
 * funcao quando o campo antigo estava vazio -- porque um objeto vazio
 * ainda e TRUTHY em JavaScript. Sem isso, uma segunda passagem leria
 * `Object.entries` sobre a forma NOVA (chaves 'conjuracao'/'pacto', nao
 * circulos) e jogaria o gasto fora.
 *
 * @param {object} p Personagem, mutado no lugar.
 * @returns {boolean} true se a ficha foi alterada.
 */
export function migrarEspacosDeMagia(p) {
  if (!p || typeof p !== 'object') return false;
  const antigo = p.espacos_magia;
  if (!antigo || typeof antigo !== 'object') return false;
  if (antigo.conjuracao || antigo.pacto) return false; // ja migrado
  const fonte = temMagiaDePacto(p) && classesDe(p).length === 1 ? 'pacto' : 'conjuracao';
  const novo = { conjuracao: {}, pacto: {} };
  for (const [circulo, valor] of Object.entries(antigo)) {
    const usados = Number(valor?.usados) || 0;
    if (usados > 0) novo[fonte][circulo] = usados;
  }
  p.espacos_magia = novo;
  return true;
}
