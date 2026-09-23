// ============================================================
// "De que classe e esta magia preparada?" -- a peca pura que responde a
// pergunta, para as Tarefas 2, 3 e 4 deste sub-projeto usarem.
//
// `personagem.magias_preparadas[]` guarda { nome, circulo, origem? } sem
// campo de classe. Num Clerigo 5/Mago 1 as magias preparadas das DUAS
// classes ficam no mesmo array, indistinguiveis -- e o livro (PHB 2024,
// livro:2073) diz o contrario: "Cada magia que voce prepara esta
// associada a uma de suas classes, e voce usa o atributo de conjuracao
// dessa classe quando conjura a magia."
//
// A MEDICAO QUE DECIDIU O DESENHO: inferir a classe pelo NOME da magia nao
// e viavel em geral. Sobre os 8 arquivos dados/classes/magias_*.json (391
// magias distintas), so 24,6% aparecem numa UNICA classe -- e as duplas
// que se jogam de verdade sao os piores casos (Feiticeiro/Mago
// compartilham 95% da lista menor, Bruxo/Mago 89%, Bardo/Mago 74%,
// Clerigo/Paladino 69%).
//
// DECISAO (do humano, ja tomada): campo OPCIONAL, sem chute. Quando nao da
// para saber sem adivinhar, a resposta e `null` -- nunca um palpite. Dado
// errado e pior que dado ausente, porque o app passaria a exibir limite
// por classe com confianca e errado.
//
// MODULO PURO: nada de fetch, DOM ou `window` -- o teste de unidade
// importa este modulo direto do disco em Node, e este arquivo nao grava
// nada em ficha nenhuma nem muda tela nenhuma.
// ============================================================
import { magiaContaNoLimite, truqueContaNoLimite, truquesQueContamNoLimite } from './regras-origens-magia.js';
import { superficiesDeConjuracao } from './regras-multiclasse-conjuracao.js';
import { classesDe } from './regras-multiclasse.js';

/**
 * Devolve um Set com TODOS os nomes de magia do JSON de
 * dados/classes/magias_<classe>.json -- de todos os circulos, truques
 * inclusive.
 *
 * As chaves de circulo variam entre arquivos ("Truques", "1o Circulo",
 * ...), por isso itera `Object.values(json?.lista_magias)` em vez de
 * listar as chaves a mao -- um arquivo com uma chave diferente nao quebra
 * a leitura.
 *
 * Entrada nula ou malformada devolve Set vazio, NUNCA lanca: quem monta um
 * `listasPorClasse` juntando varias classes nao pode ter uma classe sem
 * dados (ou com JSON incompleto) derrubar a leitura das demais.
 *
 * @param {object} jsonDaClasse JSON de magias_<classe>.json (ou qualquer
 *   entrada nula/malformada -- tratada como vazia).
 * @returns {Set<string>} nomes de magia distintos.
 */
export function nomesDaListaDeMagias(jsonDaClasse) {
  const nomes = new Set();
  const listaPorCirculo = jsonDaClasse?.lista_magias;
  if (!listaPorCirculo || typeof listaPorCirculo !== 'object') return nomes;
  for (const entradas of Object.values(listaPorCirculo)) {
    if (!Array.isArray(entradas)) continue;
    for (const magia of entradas) {
      if (typeof magia?.nome === 'string' && magia.nome.trim() !== '') {
        nomes.add(magia.nome);
      }
    }
  }
  return nomes;
}

/**
 * Diz de que classe e uma magia preparada -- ou `null` quando isso nao
 * pode ser afirmado sem chutar (ver cabecalho do modulo: "sem chute" e
 * decisao de projeto, nao lacuna a preencher depois).
 *
 * Ordem das decisoes, exatamente esta (task-1-brief.md):
 *
 *  1. Sem `magia?.nome` valido (nao-string ou vazio) -> null.
 *  2. `magiaContaNoLimite(magia)` falso -> null. Magia de dominio, de
 *     talento, de especie, 'sempre', conjurador_ritualista,
 *     maestria_magias, assinatura_magica, subclasse_escolha -- nenhuma
 *     delas sai do orcamento de UMA classe, entao nenhuma recebe carimbo
 *     de classe (RULING R-A).
 *  3. Sem nenhuma superficie de conjuracao (`superficiesDeConjuracao`
 *     vazio) -> null.
 *  4. EXATAMENTE UMA superficie -> a classe dela, SEM consultar
 *     `listasPorClasse`. Nao ha ambiguidade possivel: se o personagem so
 *     conjura por uma classe, toda magia preparada que conta no limite e
 *     daquela classe -- mesmo que a magia nao esteja na lista dela
 *     (magia personalizada, ou lista que o app nao tem) (RULING R-B).
 *  5. Duas ou mais superficies: sem `listasPorClasse` utilizavel -> null.
 *     Com ele, para cada superficie confere se `listasPorClasse.get(
 *     s.listaMagias)` contem o nome da magia (a CHAVE e o nome da LISTA,
 *     campo `listaMagias` da superficie -- Cavaleiro Mistico e Trapaceiro
 *     Arcano tem `classe` 'Guerreiro'/'Ladino' mas `listaMagias` 'Mago').
 *     Junta as `s.classe` DISTINTAS das superficies que casaram --
 *     CLASSES distintas, nao superficies distintas: duas superficies da
 *     MESMA classe que casarem ainda dao resposta unica. Exatamente uma
 *     classe distinta -> essa classe. Zero, ou duas ou mais -> null.
 *
 * @param {object} personagem Personagem inteiro (le `classes[]` via
 *   `superficiesDeConjuracao`).
 * @param {{nome?: string, circulo?: number, origem?: string}} magia Entrada
 *   de `personagem.magias_preparadas[]`.
 * @param {object} [opcoes]
 * @param {Map<string, object>|null} [opcoes.mapaDados] O `classesData` da
 *   ficha, repassado tal e qual para `superficiesDeConjuracao`. Opcional:
 *   sem ele a funcao continua funcionando (so o campo `tabela` das
 *   superficies vem `null`, e esta funcao nao usa `tabela`).
 * @param {Map<string, Set<string>>|null} [opcoes.listasPorClasse] Nome da
 *   LISTA de magias (`listaMagias` da superficie) -> Set de nomes, no
 *   formato que `nomesDaListaDeMagias` produz.
 * @returns {string|null} Nome da classe, ou `null` quando indecidivel.
 */
export function classeDaMagiaPreparada(personagem, magia, opcoes = {}) {
  const { mapaDados = null, listasPorClasse = null } = opcoes;
  if (typeof magia?.nome !== 'string' || magia.nome.trim() === '') return null;
  if (!magiaContaNoLimite(magia)) return null;
  return classePelasSuperficies(personagem, magia.nome, mapaDados, listasPorClasse);
}

/**
 * Núcleo comum de classeDaMagiaPreparada e classeDoTruque: passos 3 a 5 da
 * ordem documentada em classeDaMagiaPreparada. Não olha origem nem círculo;
 * quem chama já descartou o que não conta no limite.
 */
function classePelasSuperficies(personagem, nome, mapaDados, listasPorClasse) {
  const superficies = superficiesDeConjuracao(personagem, mapaDados);
  if (superficies.length === 0) return null;
  if (superficies.length === 1) return superficies[0].classe;
  if (!listasPorClasse) return null;
  const classesQueBatem = new Set();
  for (const superficie of superficies) {
    if (listasPorClasse.get(superficie.listaMagias)?.has(nome)) classesQueBatem.add(superficie.classe);
  }
  return classesQueBatem.size === 1 ? [...classesQueBatem][0] : null;
}

/**
 * Classifica `personagem.magias_preparadas[]` em TRÊS baldes, para o
 * `nomeClasse` informado -- a peça que os leitores (contadores e portões de
 * bloqueio da Tarefa 4) usam para não reimplementar esta lógica à mão em
 * cada tela (a mesma lição de regras-origens-magia.js: ver o cabeçalho
 * daquele arquivo).
 *
 * POR QUE TRÊS BALDES E NÃO DOIS: o estado misto (algumas entradas com
 * `classe`, outras sem) é PERMANENTE, não uma fase de transição -- a
 * migração (Tarefa 3) só carimba o INEQUÍVOCO, magia de origem isenta
 * nunca recebe carimbo (por decisão de projeto, RULING R-A de
 * `classeDaMagiaPreparada`) e uma ficha antiga pode nunca ter sido aberta
 * depois da migração. Um leitor que tratasse "sem carimbo" como "não é
 * desta classe" SUB-contaria o orçamento da classe; um que tratasse como
 * "é desta classe" SUPER-contaria (e poderia bloquear uma ação válida).
 * As duas leituras erradas escondem o mesmo problema: "não sei" não é
 * "não" nem "sim". Por isso a resposta tem de nomear a incerteza como um
 * balde próprio (`semClasse`), em vez de forçá-la para dentro de um dos
 * outros dois.
 *
 * - `desta`: `m.classe === nomeClasse` -- gasta o orçamento desta classe,
 *   com certeza.
 * - `deOutra`: `m.classe` é uma string não vazia e diferente de
 *   `nomeClasse` -- gasta o orçamento de OUTRA classe, com certeza.
 * - `semClasse`: sem a chave `classe`, ou valor vazio -- pode ser desta
 *   classe ou de outra; a ficha não sabe (e este módulo não chuta).
 *
 * Entradas isentas (`magiaContaNoLimite(m)` falso -- domínio, talento,
 * espécie, `'sempre'` etc.) ficam de FORA dos três baldes: elas não gastam
 * vaga de limite de ninguém, então não são nem "desta" nem "de outra" nem
 * "sem classe" -- são irrelevantes para a pergunta que esta função responde.
 *
 * PURA: sem DOM, sem `fetch`, sem estado global -- só lê os dois parâmetros.
 *
 * @param {object} personagem Personagem inteiro; só `magias_preparadas[]`
 *   é lido. Sem o array (ou não-array), os três baldes saem vazios, sem
 *   lançar.
 * @param {string} nomeClasse Nome da classe cujo orçamento está sendo
 *   medido (ex.: `sup.classe` da superfície ativa).
 * @returns {{desta: Array, deOutra: Array, semClasse: Array}} As três
 *   entradas de `magias_preparadas[]` originais (não cópias), cada uma em
 *   exatamente um balde.
 */
export function preparadasPorClasse(personagem, nomeClasse) {
  const resultado = { desta: [], deOutra: [], semClasse: [] };
  const preparadas = Array.isArray(personagem?.magias_preparadas)
    ? personagem.magias_preparadas
    : [];
  for (const magia of preparadas) {
    if (!magiaContaNoLimite(magia)) continue;
    const classe = typeof magia?.classe === 'string' ? magia.classe.trim() : '';
    if (classe === '') {
      resultado.semClasse.push(magia);
    } else if (classe === nomeClasse) {
      resultado.desta.push(magia);
    } else {
      resultado.deOutra.push(magia);
    }
  }
  return resultado;
}

/**
 * O mesmo de `preparadasPorClasse`, para TRUQUES.
 *
 * POR QUE EXISTE: o modal "Preparar Magias" (sheet/grimorio.js) confrontava uma
 * contagem GLOBAL de truques (`magias_conhecidas` de todas as classes)
 * contra o limite de UMA superfície só. Num Mago 5/Clérigo 5 os truques do
 * Clérigo comiam o orçamento do Mago, e a saída adotada na época foi
 * DESLIGAR o portão quando havia mais de uma superfície -- o que deixava
 * adicionar truque sem limite nenhum (medido: 16 truques com limite 4).
 * Com o carimbo `classe` na entrada, a contagem deixa de ser incerta e o
 * portão volta a valer, sem o proxy `umaSuperficieSo`.
 *
 * Reusa `truquesQueContamNoLimite` em vez de refiltrar: é ela que decide
 * QUEM gasta vaga (círculo 0 de `magias_conhecidas`, sem origem de
 * concessão). Aqui só se responde de QUEM é cada um dos que já contam.
 *
 * O TRUQUE PERSONALIZADO NÃO CHEGA AQUI desde a issue #46: ele saiu de
 * `truquesQueContamNoLimite` junto com a leitura de `magias_customizadas`,
 * porque a decisão do dono do produto de 2026-09-02 reverteu o "vaga é
 * vaga, venha de onde vier" -- truque e magia customizados não ocupam vaga
 * e estão sempre preparados. Logo ele não cai em nenhum dos três baldes:
 * nem cobrado, nem contado como incerteza.
 *
 * SEM CARIMBO NÃO É SEMPRE INCERTO -- RULING R-B, o mesmo que
 * `classeDaMagiaPreparada` (acima) já aplica: com EXATAMENTE UMA
 * superfície de conjuração não há ambiguidade possível. Se o personagem
 * só conjura por uma classe, todo truque que conta no limite é daquela
 * classe, mesmo sem carimbo. Sem esta regra eles cairiam em `semClasse` e
 * sairiam de graça do orçamento da única classe que o personagem tem.
 *
 * R-B NÃO É SÓ FAXINA DE LEGADO -- FATO ATUAL (corrigido na revisão final
 * #105/#61, achado Minor m1): o push de truque fixo de subclasse no
 * level-up (`levelup.js`) e a migração `migrarTruquesFixosSubclasse`
 * (`sheet/migracoes.js`) hoje CARIMBAM `classe` (`sub.classe`) nessa
 * entrada, e `migrarMagiaClasse` também varre `magias_conhecidas` (não só
 * `magias_preparadas`) -- as duas afirmações que este comentário fazia
 * antes (truque fixo SEM `classe`, `migrarMagiaClasse` NUNCA carimbando
 * truque) ficaram falsas com essa entrega. R-B continua necessária mesmo
 * assim: uma ficha ainda não migrada, ou uma migração que não pôde decidir
 * (classe fora do catálogo, JSON ausente), ainda grava/deixa a entrada sem
 * `classe` -- e com superfície única não há ambiguidade possível nesse
 * caso, então a regra segue valendo para ele.
 *
 * `semClasse` fica reservado ao caso em que a dúvida é real: DUAS ou mais
 * superfícies e uma entrada sem carimbo. Aí a incerteza aparece na tela e
 * não vira bloqueio -- mesma regra das preparadas.
 *
 * PURA: sem DOM, sem `fetch`, sem estado global.
 *
 * @param {object} personagem Personagem inteiro; `magias_conhecidas[]` é
 *   lido (por `truquesQueContamNoLimite`), além de `classes[]` (por
 *   `superficiesDeConjuracao`).
 * @param {string} nomeClasse Classe cujo orçamento está sendo medido.
 * @param {Map<string, object>|null} [mapaDados] O `classesData` da ficha,
 *   repassado tal e qual para `superficiesDeConjuracao`. Opcional: esta
 *   função só usa a CONTAGEM de superfícies e o campo `classe` de cada
 *   uma, nenhum dos quais depende de `mapaDados`.
 * @returns {{desta: Array, deOutra: Array, semClasse: Array}} As entradas
 *   originais (não cópias), cada uma em exatamente um balde.
 */
export function truquesPorClasse(personagem, nomeClasse, mapaDados = null) {
  const resultado = { desta: [], deOutra: [], semClasse: [] };
  const superficies = superficiesDeConjuracao(personagem, mapaDados);
  // RULING R-B: uma superfície só -> o não carimbado é dela, sem chute.
  const classeUnica = superficies.length === 1 ? superficies[0].classe : null;

  for (const truque of truquesQueContamNoLimite(personagem)) {
    const carimbo = typeof truque?.classe === 'string' ? truque.classe.trim() : '';
    const classe = carimbo || classeUnica || '';
    if (classe === '') {
      resultado.semClasse.push(truque);
    } else if (classe === nomeClasse) {
      resultado.desta.push(truque);
    } else {
      resultado.deOutra.push(truque);
    }
  }
  return resultado;
}

/**
 * Issue #105: classe dona de um TRUQUE de `magias_conhecidas`, com a mesma
 * ordem de decisão de classeDaMagiaPreparada. Truque que não conta no limite
 * de truques da classe (espécie, talento etc.) devolve null: não pertence ao
 * orçamento de classe nenhuma. Entrada de círculo diferente de 0 devolve null.
 */
export function classeDoTruque(personagem, truque, opcoes = {}) {
  const { mapaDados = null, listasPorClasse = null } = opcoes;
  if (typeof truque?.nome !== 'string' || truque.nome.trim() === '') return null;
  if (truque.circulo !== 0) return null;
  if (!truqueContaNoLimite(truque)) return null;
  return classePelasSuperficies(personagem, truque.nome, mapaDados, listasPorClasse);
}

/**
 * Origens de concessão cuja classe dona é descoberta pelas tabelas da
 * subclasse do personagem (magias de domínio, sempre preparadas e truque
 * fixo de subclasse).
 */
export const ORIGENS_CONCEDIDAS_POR_TABELA = ['dominio', 'sempre', 'subclasse_fixa'];

/** Origens que só uma classe concede: Maestria de Magias e Assinatura Mágica são do Mago. */
export const ORIGEM_DE_CLASSE_FIXA = { maestria_magias: 'Mago', assinatura_magica: 'Mago' };

/** Diz se a entrada é uma concessão de classe/subclasse (e portanto tem classe dona). */
export function ehConcedidaDeClasse(magia) {
  return ORIGENS_CONCEDIDAS_POR_TABELA.includes(magia?.origem)
    || Object.prototype.hasOwnProperty.call(ORIGEM_DE_CLASSE_FIXA, magia?.origem);
}

/**
 * Issue #61: classe dona de uma magia/truque CONCEDIDO por classe ou
 * subclasse. `concessoesPorClasse` é o Map<classe, Set<nome>> das concessões
 * de cada classe do personagem até o nível dele nela (ver
 * obterConcessoesPorClasse em levelup.js). Exatamente uma classe concede o
 * nome -> essa classe; zero ou várias -> null. Origem que não é de classe
 * (talento, espécie...) -> null sempre.
 */
export function classeDaMagiaConcedida(personagem, magia, concessoesPorClasse = null) {
  if (typeof magia?.nome !== 'string' || magia.nome.trim() === '') return null;
  const classesDoPersonagem = classesDe(personagem).map((c) => c.classe);
  const fixa = ORIGEM_DE_CLASSE_FIXA[magia.origem];
  if (fixa) return classesDoPersonagem.includes(fixa) ? fixa : null;
  if (!ORIGENS_CONCEDIDAS_POR_TABELA.includes(magia.origem)) return null;
  if (!concessoesPorClasse) return null;
  const donas = classesDoPersonagem.filter((c) => concessoesPorClasse.get(c)?.has(magia.nome));
  return donas.length === 1 ? donas[0] : null;
}

/**
 * Classes oferecidas ao jogador no bloco "Classe não definida" do modal
 * Preparar Magias: as classes conjuradoras cuja lista contém o nome, na
 * ordem das superfícies. Nenhuma lista contém -> todas as classes
 * conjuradoras (magia fora das listas que o app conhece).
 */
export function classesCandidatas(personagem, nome, listasPorClasse, mapaDados = null) {
  const superficies = superficiesDeConjuracao(personagem, mapaDados);
  const todas = [...new Set(superficies.map((s) => s.classe))];
  const batem = [...new Set(superficies
    .filter((s) => listasPorClasse?.get(s.listaMagias)?.has(nome))
    .map((s) => s.classe))];
  return batem.length > 0 ? batem : todas;
}
