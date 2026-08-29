// ============================================================
// Progressao em multiclasse: pre-requisito de entrada e PV por nivel.
//
// Funcoes PURAS: recebem o personagem por parametro. Nao escrevem nada.
// ============================================================
import { CLASSES_INFO, ATRIBUTO_NOME_PARA_KEY } from './dados-classes.js';
import { classesDe, nivelNa, nivelTotal } from './regras-multiclasse.js';
import { calcMod } from './utils.js';

/** Valor de um atributo pelo nome legivel; 0 quando ausente. */
function valorDoAtributo(char, nome) {
  const chave = ATRIBUTO_NOME_PARA_KEY[nome];
  return Number(char?.atributos?.[chave]) || 0;
}

/**
 * Responde "posso adquirir um nivel NESTA classe?" -- nao "posso ter esta
 * classe" em geral. Para uma classe que o personagem JA POSSUI (nivelNa >
 * 0), a resposta e sempre sim: o livro:2033 impoe o 13+ para "se
 * qualificar para uma NOVA classe", e subir de nivel na classe que voce ja
 * tem nao e qualificar-se para nada. Sem esta distincao, um Monge 5 com
 * Sabedoria 12 -- personagem legal, pois classe unica nunca teve minimo de
 * atributo -- ficaria travado ao tentar subir de nivel na propria classe.
 * Para uma classe NOVA, o livro exige 13+ no atributo primario dela e das
 * ATUAIS -- os dois sentidos. Respeita o conector: 'ou' pede um dos
 * atributos, 'e' pede todos.
 * Classe fora do catalogo (nome desconhecido ou digitado sem acento) falha
 * FECHADA: `permitido: false`, nunca `true` por CLASSES_INFO[nomeClasse]
 * ser undefined. Recusar e o certo numa funcao que decide o que o jogador
 * pode escolher -- e mantem a mesma direcao de erro da funcao irma,
 * `pvGanhoAoSubir`, que ja devolve 0 (fechado) para a mesma entrada.
 * @returns {{permitido: boolean, faltando: Array<{classe, atributo, valor}>}}
 */
export function podeEntrarEm(char, nomeClasse) {
  if (nivelNa(char, nomeClasse) > 0) return { permitido: true, faltando: [] };
  if (!CLASSES_INFO[nomeClasse]) {
    return { permitido: false, faltando: [{ classe: nomeClasse, atributo: null, valor: null }] };
  }
  const faltando = [];
  const exigirDe = (classe) => {
    const req = CLASSES_INFO[classe]?.atributos_primarios;
    if (!req || !req.lista?.length) return;
    const atende = req.conector === 'ou'
      ? req.lista.some((a) => valorDoAtributo(char, a) >= 13)
      : req.lista.every((a) => valorDoAtributo(char, a) >= 13);
    if (atende) return;
    for (const a of req.lista) {
      // Com 'e', so o atributo abaixo de 13 e a falta. Com 'ou', todos
      // faltam, porque nenhum sozinho resolveria.
      if (req.conector === 'e' && valorDoAtributo(char, a) >= 13) continue;
      faltando.push({ classe, atributo: a, valor: valorDoAtributo(char, a) });
    }
  };
  exigirDe(nomeClasse);
  for (const c of classesDe(char)) {
    if (c.classe !== nomeClasse) exigirDe(c.classe);
  }
  return { permitido: faltando.length === 0, faltando };
}

/**
 * PV ganhos ao adquirir um nivel na classe indicada.
 * O dado e o da CLASSE QUE SOBE, nao o da classe atual do personagem.
 * O dado cheio so vale quando este e o 1o nivel do personagem
 * (livro:2041); dai em diante, media ou o valor rolado.
 * `char` e o estado ANTERIOR a aplicacao do nivel -- por isso o 1o nivel
 * do personagem e `nivelTotal(char) === 0`, nao 1: quem inserir a classe
 * em `char.classes` antes de chamar esta funcao erraria o 1o nivel em
 * silencio (nivelTotal ja contaria 1, e o dado cheio nunca dispararia).
 * O livro:1963 e explicito: "some o total (MINIMO DE 1) aos seus Pontos
 * de Vida maximos" -- o piso vale nos TRES caminhos de retorno (dado
 * cheio, media, rolado). levelup.js:350 e :368 ja aplicam o mesmo piso
 * para classe unica; as duas implementacoes concordam de proposito.
 * @param {object} opcoes - { rolado } opcional; sem ele, usa a media.
 * @returns {number}
 */
export function pvGanhoAoSubir(char, nomeClasse, opcoes = {}) {
  const faces = CLASSES_INFO[nomeClasse]?.dado_vida;
  if (!faces) return 0;
  const modCon = calcMod(Number(char?.atributos?.constituicao) || 10);
  if (nivelTotal(char) === 0) return Math.max(1, faces + modCon);
  if (opcoes.rolado !== undefined && opcoes.rolado !== null) {
    const rolado = Math.min(Math.max(Number(opcoes.rolado) || 0, 1), faces);
    return Math.max(1, rolado + modCon);
  }
  return Math.max(1, Math.floor(faces / 2) + 1 + modCon);
}

/**
 * Reune, num objeto so, tudo que a subida de um nivel precisa saber -- e,
 * acima de tudo, SEPARA OS DOIS NIVEIS que hoje sao a mesma variavel.
 *
 * POR QUE EXISTE. Em classe unica, "nivel na classe" e "nivel total" sao o
 * mesmo numero, e `subirDeNivel` usa um so (`novoNivel`) para as duas
 * coisas -- 40 vezes. Em multiclasse eles divergem, e o simbolo continua o
 * mesmo: nenhum guarda estatico enxerga a troca de significado. Nomear os
 * dois campos separadamente obriga cada chamador a dizer qual quer.
 *
 * QUAL E QUAL. Nivel NA CLASSE manda em tudo que a classe concede naquele
 * patamar dela: caracteristicas, subclasse no 3o, Aumento no Valor de
 * Atributo e Dadiva Epica (os dois estao na TABELA DE CLASSE do livro,
 * Classes.md:49/53/57/61), estilo de luta, manobras, expertise, grimorio,
 * e o dado de PV. Nivel TOTAL manda no teto de 20, no XP (livro:2037), no
 * Bonus de Proficiencia (livro:2047) e nas caracteristicas de ESPECIE,
 * cujo proprio texto diz "No nivel 5 DO PERSONAGEM" (Especies.md:106).
 *
 * OS DOIS "PRIMEIRO NIVEL" SAO CAMPOS DIFERENTES DE PROPOSITO.
 * `ehPrimeiroNivelNaClasse` decide proficiencias reduzidas (livro:2051,
 * sub-projeto proprio); `ehPrimeiroNivelDoPersonagem` decide o dado CHEIO
 * de PV (livro:2041). Num personagem de nivel 1 os dois valem; no 1o nivel
 * de uma SEGUNDA classe, so o primeiro. Confundi-los da PV errado.
 *
 * NAO ESCREVE NADA. Recebe o personagem por parametro, nunca le global.
 * Classe fora do catalogo falha FECHADA (`permitido: false`, `dadoVida: 0`),
 * como `podeEntrarEm` e `pvGanhoAoSubir` ja fazem.
 *
 * @param {object} personagem Estado ANTES da subida.
 * @param {string} nomeClasse Classe em que o nivel entra.
 * @returns {{classe: string, subclasse: string,
 *   nivelNaClasseAnterior: number, nivelNaClasseNovo: number,
 *   nivelTotalAnterior: number, nivelTotalNovo: number,
 *   ehPrimeiroNivelNaClasse: boolean, ehPrimeiroNivelDoPersonagem: boolean,
 *   dadoVida: number, permitido: boolean, faltando: Array}}
 */
export function contextoDeSubida(personagem, nomeClasse) {
  const entrada = classesDe(personagem).find((c) => c.classe === nomeClasse);
  const nivelNaClasseAnterior = nivelNa(personagem, nomeClasse);
  const nivelTotalAnterior = nivelTotal(personagem);
  const { permitido, faltando } = podeEntrarEm(personagem, nomeClasse);
  return {
    classe: nomeClasse,
    // A subclasse DAQUELA classe, nunca o espelho `personagem.subclasse`:
    // num Mago 5/Guerreiro 3 o espelho aponta para o Mago.
    subclasse: entrada?.subclasse || '',
    nivelNaClasseAnterior,
    nivelNaClasseNovo: nivelNaClasseAnterior + 1,
    nivelTotalAnterior,
    nivelTotalNovo: nivelTotalAnterior + 1,
    ehPrimeiroNivelNaClasse: nivelNaClasseAnterior === 0,
    ehPrimeiroNivelDoPersonagem: nivelTotalAnterior === 0,
    dadoVida: CLASSES_INFO[nomeClasse]?.dado_vida || 0,
    permitido,
    faltando,
  };
}
