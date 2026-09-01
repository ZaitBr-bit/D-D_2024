// ============================================================
// Buscas e trocas de magia
//
// Modais de busca, grimorio do Mago, troca por descanso e preenchimento
// de espaco livre.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { getIndiceMagias, getMagiasPorCirculo } from '../db.js';
import { VALOR_EM_COBRE, formatarCarteira, podePagar, retirarValor } from '../moedas.js';
import { abrirModal, escHtml, getBonusTruquesOrdem, getEspacosMagia, getLimitesMagias, magiaMagoEstaNoGrimorio, mdParaHtml, semAcento, toast } from '../utils.js';
import { montarSeletor } from '../ui-opcoes.js';
import { deMagias } from '../opcoes-dominio.js';
import { getTruquesExtraEstiloLuta } from './combate.js';
import { MAGIAS_FIXAS_MAGO, definirMagiasFixasMago, getEstadoRecursosMago } from './classes/mago.js';
import { char, indiceMagiasCache, magiasDominioCache, magiasSempreCache, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { getSubclasseConjuradoraConjuracao, magiaEhEspecial, obterMagiasDisponiveisClasseAtual, rotuloOrigemMagia } from './magias.js';
// reservasDeEspacos (Tarefa 4, sub-projeto 4): acessador derivado que
// substitui a leitura direta do campo antigo de espacos de magia; ver o
// comentario de mostrarBuscaGrimorio (achado Important 2 da revisao de
// branch).
import { reservasDeEspacos } from './reservas-espacos.js';
// truquesQueContamNoLimite: "quanto do orçamento de truques da classe já
// foi gasto?" -- a MESMA função que a seção Magias da ficha
// (sheet/magias.js) chama, com a MESMA ficha, e não a regra própria que
// este modal mantinha. O docblock inteiro (o defeito medido, a decisão de
// produto sobre o truque personalizado, o porquê do filtro de círculo)
// mora com ela, em regras-origens-magia.js.
//
// A regra vivia escrita em CINCO lugares só deste arquivo -- contador do
// topo, contador da aba de truques, a decisão "a grade está cheia?", o
// portão que recusa o clique e o refresh de `atualizarContadores` -- e foi
// a cópia à mão que já deixou este modal e a ficha divergirem em silêncio,
// duas vezes seguidas.
// `truqueContaNoLimite` (o predicado por entrada) saiu daqui junto com a
// versão local: a única leitura que este arquivo fazia dele era a contagem,
// e ela agora é `truquesQueContamNoLimite`.
import { truqueEhTrocavel, truquesQueContamNoLimite } from '../regras-origens-magia.js';
// superficiesDaFicha/superficieAtivaDaFicha (Tarefas 2 e 4 deste
// sub-projeto): substituem a leitura de char.classe/char.subclasse/
// char.nivel (a classe INICIAL, o espelho) por classes[] de verdade -- ver
// o comentario de superficieAtiva() abaixo.
import { superficiesDaFicha, superficieAtivaDaFicha } from './contexto-classe.js';
import { nivelNa } from '../regras-multiclasse.js';
// preparadasPorClasse (Tarefa 4, sub-projeto "magia sabe a classe"): fonte
// unica dos tres baldes (desta/deOutra/semClasse) que este arquivo usava a
// reimplementar contando char.magias_preparadas cru contra o limite de UMA
// superficie -- ver o comentario de mostrarBuscaMagia, abaixo, para o antes
// e depois.
import { preparadasPorClasse } from '../regras-magia-classe.js';

/**
 * As magias PERSONALIZADAS de círculo 1+ da ficha, no formato de cartão que
 * as duas telas deste arquivo consomem: `circulo` numérico (o formulário
 * grava string em ficha antiga) e a marca `personalizada: true`.
 *
 * Truque personalizado (círculo 0) fica de fora de propósito: ele não passa
 * por preparo -- `sheet/magias.js` funde `truquesPersonalizados` direto em
 * `todosTruques`, e foi o próprio jogador quem notou que "como truque vai
 * direto".
 *
 * POR QUE NO NÍVEL DO MÓDULO, e não copiada nas duas funções (achado
 * Important da revisão da lacuna #27/#33): as duas superfícies que dão
 * caminho à magia personalizada -- a grade do modal "+ Magia"
 * (`mostrarBuscaMagia`) e a troca do Descanso Longo
 * (`mostrarTrocaMagiaConhecida`) -- montavam este mesmo bloco de três
 * linhas, literalmente igual, e as duas NÃO são intercambiáveis (só a troca
 * tem o portão `ehMago`, que fica no ponto de chamada). Uma edição futura
 * precisaria achar as duas cópias, e nada avisaria quem achasse só uma.
 *
 * O caso concreto que fecha o argumento: a pergunta de produto registrada em
 * `docs/PERGUNTAS-PENDENTES.txt` -- "magia homebrew deveria ser isenta do
 * orçamento de preparadas?" -- cai EXATAMENTE neste bloco. Respondida numa
 * cópia só, a outra superfície continuaria na regra velha, em silêncio. É a
 * forma de defeito que `regras-origens-magia.js` existe para extinguir neste
 * repositório.
 *
 * @param {object} personagem Ficha (`char`, ou qualquer personagem).
 * @returns {Array<object>} Cópias dos registros, nunca os objetos da ficha.
 */
function personalizadasDeCirculoDaFicha(personagem) {
  return (personagem?.magias_customizadas || [])
    .filter(m => Number(m?.circulo) > 0)
    .map(m => ({ ...m, circulo: Number(m.circulo), personalizada: true }));
}

/**
 * O registro de `magias_customizadas` que corresponde a este nome E círculo,
 * ou `undefined`. Casa pelos DOIS campos: uma magia personalizada editada
 * para outro círculo deixa de ser a deste cartão, e homônima do acervo em
 * círculo diferente nunca é ela.
 *
 * Uma função para DUAS perguntas que sempre foram a mesma consulta escrita
 * duas vezes (achado Important da revisão da lacuna #27/#33):
 *
 *  1. LASTRO, nos dois gravadores. A marca `personalizada` viaja no CARTÃO
 *     (só ele sabe em qual das homônimas o jogador clicou), mas HTML é o que
 *     o render acabou de escrever -- quem grava em `magias_preparadas` não
 *     aceita marca sem registro correspondente na ficha.
 *  2. PLANO B dos detalhes, nos dois painéis. Magia personalizada não está
 *     em arquivo nenhum de `dados/`, então `getMagiasPorCirculo` não a
 *     conhece: sem este plano B, clicar no nome da magia que o jogador
 *     acabou de inventar não abre nada (mesma forma da issue #39, que já
 *     tinha mordido o painel do Grimório). O acervo continua sendo o plano
 *     A -- magia do livro vem do livro.
 *
 * @param {object} personagem Ficha (`char`, ou qualquer personagem).
 * @param {string} nome Nome exibido no cartão.
 * @param {number} circulo Círculo do cartão.
 * @returns {object|undefined} O registro da ficha, ou `undefined`.
 */
function magiaPersonalizadaDaFicha(personagem, nome, circulo) {
  return (personagem?.magias_customizadas || [])
    .find(m => m?.nome === nome && Number(m?.circulo) === Number(circulo));
}

/**
 * Superfície de conjuração ATIVA deste modal: a escolhida no seletor de
 * classe (Tarefa 4 -- ver `superficieAtivaDaFicha`, sheet/contexto-classe.js),
 * que por padrão é a PRIMEIRA de `superficiesDaFicha(char)` -- a classe
 * inicial, a única em personagem de classe única e a mesma que a tela
 * sempre mostrou. `null` quando o personagem não tem NENHUMA superfície de
 * conjuração por classe (ex.: Bárbaro puro com Iniciado em Magia -- a
 * seção Magias ainda abre para ele, por talento/espécie/personalizada, mas
 * não há classe nenhuma de onde pedir lista).
 *
 * Cada função exportada deste arquivo chama isto UMA VEZ, no topo, e
 * deriva tudo dali -- nunca de char.classe/char.subclasse/char.nivel
 * direto. É o que tornou "trocar a superfície ativa" (Tarefa 4, seletor de
 * classe) uma mudança de UMA variável (`superficiesDaFicha(char)[0]` virou
 * `superficieAtivaDaFicha(char)`) em vez de reescrever cada função. O
 * seletor em si mora na seção Magias da ficha (sheet/magias.js,
 * `tabs-superficie-magia`), não neste modal -- ver o comentário lá para a
 * justificativa (por que este modal NÃO ganhou um seletor próprio).
 *
 * DUAS EXCEÇÕES (Tarefa 2 do sub-projeto 2026-08-29-troca-por-classe-
 * descanso): `mostrarTrocaMagiaConhecida` e `mostrarTrocaTruque` chamam
 * `superficieDaTroca(char, opcoes.classe)`, abaixo, em vez desta -- ver o
 * comentário dela para o porquê.
 */
function superficieAtiva() {
  return superficieAtivaDaFicha(char);
}

/**
 * Superfície de conjuração para UMA TROCA (Tarefa 2 do sub-projeto
 * 2026-08-29-troca-por-classe-descanso) -- usada só por
 * `mostrarTrocaMagiaConhecida` e `mostrarTrocaTruque`, as duas exceções à
 * regra de `superficieAtiva()` acima.
 *
 * POR QUÊ: a Tarefa 3 vai abrir essas duas modais em CADEIA, uma por
 * classe conjuradora do personagem, e precisa dizer a cada uma de qual
 * classe ela é. Mudar o seletor COMPARTILHADO da ficha
 * (`definirSuperficieSelecionada`, sheet/contexto-classe.js) antes de cada
 * modal foi descartado: mexeria, como efeito colateral de um descanso, na
 * aba que o jogador escolheu na ficha, e teria de restaurar depois num
 * fluxo com N modais encadeados e um botão "Manter Tudo" que pula passos
 * -- um caminho que esqueça de restaurar deixa a ficha noutra aba sem
 * explicação.
 *
 * Com `nomeClasse` informado, procura em `superficiesDaFicha(personagem)`
 * a superfície cujo `classe` bate -- NUNCA monta uma superfície sintética
 * pela metade. Sem `nomeClasse`, ou quando ele não casa com NENHUMA
 * superfície do personagem, cai em `superficieAtivaDaFicha` -- a mesma
 * resolução de `superficieAtiva()`, preservada byte a byte para todo
 * chamador que não passa classe (os dois chamadores de hoje,
 * hp-descanso.js e habilidades.js, continuam nesse caso).
 *
 * PURA o bastante para ser testada direto: só lê `personagem` (via
 * `superficiesDaFicha`/`superficieAtivaDaFicha`, que por sua vez só leem
 * `personagem` e `classesData` de estado.js) -- nada de DOM aqui.
 *
 * @param {object} personagem
 * @param {string|null|undefined} nomeClasse Nome da classe pedida
 *   (`opcoes.classe` de quem chama), ou ausente/vazio.
 * @returns {object|null} A superfície de conjuração escolhida, ou `null`
 *   quando o personagem não tem nenhuma (mesmo caso de `superficieAtiva()`).
 */
export function superficieDaTroca(personagem, nomeClasse) {
  if (nomeClasse) {
    const casada = superficiesDaFicha(personagem).find((s) => s.classe === nomeClasse);
    if (casada) return casada;
  }
  return superficieAtivaDaFicha(personagem);
}

/**
 * Tabela de conjuração da subclasse (Cavaleiro Místico / Trapaceiro
 * Arcano) para a superfície informada, ou `null` quando ela não se aplica
 * (classe plena/meia conjuradora, ou sem superfície nenhuma).
 */
function subConjDaSuperficie(sup) {
  if (!sup) return null;
  return getSubclasseConjuradoraConjuracao({ classe: sup.classe, subclasse: sup.subclasse, nivel: sup.nivelClasse });
}

/**
 * Espaços de magia por círculo da superfície informada, no NÍVEL DELA
 * (nunca o total do personagem). Cai para os espaços da subclasse
 * conjuradora quando a tabela da classe não tem colunas de magia
 * (Guerreiro/Ladino -- Cavaleiro Místico e Trapaceiro Arcano conjuram pela
 * tabela da SUBCLASSE).
 */
function espacosDaSuperficie(sup, subConj) {
  let espacos = sup?.tabela ? getEspacosMagia(sup.tabela, sup.nivelClasse) : {};
  if (subConj && Object.keys(espacos).length === 0) espacos = subConj.espacos || {};
  return espacos;
}

/**
 * Aviso do topo do modal, mostrado SÓ quando o personagem tem mais de uma
 * superfície de conjuração. Faz duas coisas que o modal não fazia (achado
 * Important 2 da revisão final do sub-projeto "tela de magias por classe"):
 *
 *  1. NOMEIA A CLASSE ATIVA. O seletor de superfície mora na seção Magias da
 *     ficha (`tabs-superficie-magia`, sheet/magias.js), não aqui -- desvio
 *     deliberado, documentado lá. O custo desse desvio era este: quem abre o
 *     modal pelo "+ Magia" sem ter olhado a aba não tinha COMO saber de que
 *     classe era o limite mostrado, porque o título é sempre "Gerenciar
 *     Magias". Um rótulo resolve sem trazer o seletor para dentro.
 *  2. DESCREVE A CONTAGEM DE VERDADE. Achado 1 da rodada 1 de correção da
 *     Tarefa 4 (sub-projeto "magia sabe a classe"): esta frase dizia que
 *     TRUQUES E PREPARADAS contavam o personagem inteiro contra o limite de
 *     UMA classe -- verdade antes da Tarefa 4 (nenhuma entrada tinha campo
 *     de classe), falsa depois dela para preparadas (o contador do topo
 *     virou `desta.length`, ver `preparadasPorClasse`). TRUQUES continuam
 *     fora do escopo (magias_conhecidas[] sem campo de classe) e ainda
 *     contam o personagem inteiro. `semClasse` (novo parâmetro) é quantas
 *     preparadas da ficha ainda não têm classe conhecida -- quando > 0, o
 *     aviso cita o indicador ao lado do contador para quem só olhou esta
 *     caixa não ficar sem saber que o número pode estar incompleto.
 *
 * Com UMA superfície -- todo personagem de classe única, a maioria dos
 * jogadores -- devolve string vazia e o modal fica IDÊNTICO ao que sempre
 * foi. Mesmo critério (`length > 1`) do aviso e do seletor da ficha.
 *
 * @param {Array} superficies Superfícies de conjuração da ficha.
 * @param {object|null} sup Superfície ATIVA (a do seletor).
 * @param {string} labelMg 'Preparada' ou 'Conhecida', conforme o tipo da ativa.
 * @param {number} semClasse Quantas preparadas da ficha (personagem inteiro)
 *   ainda não têm `classe` conhecida -- `classificacaoAtiva.semClasse.length`
 *   de quem chama.
 * @returns {string} HTML do aviso, ou '' quando ele não se aplica.
 */
function avisoSuperficieAtiva(superficies, sup, labelMg, semClasse) {
  if (superficies.length <= 1 || !sup) return '';
  const plural = `${labelMg.toLowerCase()}s`;
  return `<div class="info-box info" style="margin-bottom:8px;font-size:0.78rem">
      Classe selecionada: <strong>${escHtml(sup.classe)} ${escHtml(String(sup.nivelClasse))}</strong> — troque pelas abas de classe na seção Magias da ficha.
      Truques contam o personagem inteiro (todas as classes) contra o limite da classe selecionada.
      Já ${plural} contam só as desta classe${semClasse > 0 ? ` -- o indicador "+${semClasse} sem classe" ao lado do contador são preparadas de fichas antigas cuja classe ainda não pôde ser determinada; elas não entram nesta contagem nem no bloqueio de limite` : ''}.
    </div>`;
}

export async function mostrarBuscaMagia() {
  const sup = superficieAtiva();
  const subConj = subConjDaSuperficie(sup);
  const tipoConj = sup ? sup.tipo : (subConj ? 'conhecidas' : 'preparadas');
  const labelMg = tipoConj === 'conhecidas' ? 'Conhecida' : 'Preparada';
  const ehMago = !!sup?.usaGrimorio;
  // ACHADO IMPORTANT da revisão da Tarefa 3 (rodada 3, quarta e quinta
  // instância da mesma forma -- contagem GLOBAL de char.magias_conhecidas/
  // magias_preparadas confrontada com o limite de UMA superfície). Estas
  // não bloqueavam a ação (os portões reais, corrigidos nas rodadas
  // anteriores, já deixavam passar) -- só pintavam a opção como
  // "bloqueada"/"cheio" na tela. Isso é PIOR que o bloqueio real: a tela
  // diz "não pode" sobre uma ação que pode, e o jogador nem tenta -- a
  // mesma violação que o contador honesto existe para evitar (o número
  // não pode mentir), por outro meio. Guarda única, reaproveitada em
  // TODO lugar desta função que decide "está cheio?" -- contador de
  // TRUQUES no topo, opacidade da grade de truques, e o refresh de
  // atualizarContadores() para truques. `magias_conhecidas[]` (truques)
  // continua sem campo de classe -- fora do escopo desta tarefa -- por
  // isso o proxy `umaSuperficieSo` permanece a única medida disponível
  // aqui.
  const superficies = superficiesDaFicha(char);
  const umaSuperficieSo = superficies.length <= 1;
  // preparadasPorClasse (Tarefa 4): substitui, para PREPARADAS, o mesmo
  // proxy `umaSuperficieSo` por uma medida DIRETA -- `desta`/`deOutra`/
  // `semClasse` de magias_preparadas[].classe (Tarefas 2 e 3). `let`
  // porque atualizarContadores() (abaixo) recalcula esta variável inteira
  // a cada mudança, em vez do truque antigo de mutar um array em lugar
  // (`preparadasNormais.length = 0; ...push(...)`) -- os fechamentos que a
  // leem (renderTab, os handlers de clique) enxergam o valor atual porque
  // todos vivem no mesmo escopo léxico desta função.
  let classificacaoAtiva = preparadasPorClasse(char, sup?.classe);
  // Classes "conhecidas" (Bardo, Bruxo, Feiticeiro) e subclasses conjuradoras: somente consulta
  const somenteConsulta = tipoConj === 'conhecidas';

  /**
   * Diz se o check de uma magia de CÍRCULO fica clicável neste modal.
   *
   * O travamento de `somenteConsulta` existe para proteger a LISTA DA
   * CLASSE: Bardo, Bruxo, Feiticeiro e as subclasses conjuradoras escolhem
   * as magias delas na subida de nível e as trocam no Descanso Longo --
   * marcar uma aqui daria uma escolha fora dessas duas portas.
   *
   * Magia PERSONALIZADA não é da lista da classe: é invenção do jogador,
   * que já a criou pelo formulário. Para ela o travamento não protegia
   * nada -- só a deixava sem caminho nenhum (issues #27/#33): o cartão
   * aparecia na grade sem `data-circ-check` e a entrada conhecida aparecia
   * na aba sem `data-remover-check`. Aparecia e não clicava, nos dois
   * lados.
   *
   * A decisão vem sempre do DADO (a marca `personalizada` do cartão ou da
   * entrada), NUNCA do nome: duas magias diferentes podem se chamar igual
   * -- ver `entradaEhDoCartao`, abaixo, para a disputa inteira.
   *
   * Uma função em vez da condição repetida nos dois lugares: foi a cópia à
   * mão de regras deste modal que já deixou duas telas divergirem em
   * silêncio (ver `truquesQueContamNoLimite`, regras-origens-magia.js, e o
   * comentário do import dela no topo deste arquivo).
   *
   * @param {boolean} ehPersonalizada Se o cartão/entrada é da magia do jogador.
   * @returns {boolean}
   */
  function checkLiberado(ehPersonalizada) {
    return !somenteConsulta || ehPersonalizada;
  }
  const tabela = sup?.tabela || null;
  // Sem tabela e sem subclasse conjuradora não há limite conhecido: 99 é o
  // "à vontade" histórico desta tela. Com qualquer uma das duas, o limite
  // sai de getLimitesMagias (utils.js), a mesma função que a seção Magias
  // da ficha usa -- antes o fallback daqui só valia quando NÃO havia
  // tabela, e o Ladino (que tem tabela, sem colunas de magia) ficava com
  // limite 0 e a grade inteira bloqueada. Sem superfície nenhuma (Bárbaro
  // puro com Iniciado em Magia) tabela e subConj são os dois null, e o
  // "à vontade" é o único valor coerente para o pouco que aparece (magias
  // de origem talento/espécie/personalizada, que não contam neste limite).
  const semLimiteConhecido = !tabela && !subConj;
  const limites = getLimitesMagias(tabela, sup?.nivelClasse ?? 0, subConj);
  let maxPrep = semLimiteConhecido ? 99 : limites.preparadas;
  let maxTruq = semLimiteConhecido ? 99 : limites.truques;
  // Truques extras de Combatente Druídico / Abençoado
  maxTruq += getTruquesExtraEstiloLuta();
  // Truques extras do Clérigo Taumaturgo / Druida Xamã (utils.js, mesma
  // função que o criador usa -- antes só o criador somava esse bônus, e a
  // ficha calculava o limite sem ele). `sup?.classe` (Tarefa 3): sem isso a
  // checagem caía no espelho `char.classe` e um Ladino 5/Clérigo 1
  // Taumaturgo nunca via o +1 truque, mesmo com a superfície ativa sendo a
  // do próprio Clérigo.
  maxTruq += getBonusTruquesOrdem(char, sup?.classe);

  // Espaços de magia para determinar círculos disponíveis
  const espacosNivel = espacosDaSuperficie(sup, subConj);
  const circulosDisponiveis = Object.keys(espacosNivel).map(Number).sort((a, b) => a - b);
  const maxCirculo = circulosDisponiveis.length > 0 ? Math.max(...circulosDisponiveis) : 9;

  // Carregar magias da classe (pré-carrega tudo). Sem superfície nenhuma
  // NÃO HÁ classe de onde pedir lista -- pedir uma (inclusive char.classe)
  // reproduziria o 404 de classes/magias_<classe>.json que este conserto
  // existe para eliminar.
  const magiasClasseClasse = sup
    ? await obterMagiasDisponiveisClasseAtual({ classe: sup.classe, subclasse: sup.subclasse, nivel: sup.nivelClasse })
    : [];
  // Magias de círculo do Mago só podem ser preparadas se já estiverem registradas.
  // Truques continuam usando a lista de classe, pois não pertencem ao grimório.
  const magiasClasse = ehMago
    ? [
        ...magiasClasseClasse.filter(m => m.circulo === 0),
        ...(Array.isArray(char.grimorio) ? char.grimorio : []).map(registrada => ({
          ...(magiasClasseClasse.find(m => m.nome === registrada?.nome) || {}),
          ...registrada
        }))
      ]
    : magiasClasseClasse;

  // Magias já possuídas
  const jaPreparadas = new Set((char.magias_preparadas || []).map(m => m.nome));
  const jaConhecidas = new Set((char.magias_conhecidas || []).map(m => m.nome));

  // Magias PERSONALIZADAS de círculo 1+ (issues #27 e #33). Esta grade era
  // montada só a partir da lista da classe e, para o Mago, do grimório --
  // `char.magias_customizadas` nunca era lido aqui. Sem cartão na grade não
  // existia clique nenhum capaz de fazer a magia virar `magias_preparadas`:
  // ela ficava para sempre na seção "Magias Customizadas" da ficha, marcada
  // "Não preparada", com editar e remover e nada mais. Truque personalizado
  // não sofria disso porque truque não passa por preparo (sheet/magias.js
  // funde `truquesPersonalizados` direto em `todosTruques`) -- foi o próprio
  // jogador quem notou que "como truque vai direto".
  //
  // NÃO é origem isenta: magia personalizada é escolha do jogador, não
  // concessão do livro, então ela CONTA no limite de preparadas como
  // qualquer outra (por isso não entra em ORIGENS_MAGIA_ISENTA, e por isso
  // a entrada gravada leva o carimbo de classe da superfície ativa).
  const personalizadasDeCirculo = personalizadasDeCirculoDaFicha(char);

  // Nomes que estão no GRIMÓRIO -- a única fonte que pode entregar a mesma
  // magia personalizada duas vezes (ver `ehCopiaJaNoGrimorio`, logo abaixo).
  const nomesDoGrimorio = new Set(
    (Array.isArray(char.grimorio) ? char.grimorio : []).map(m => m?.nome)
  );

  // Separar por círculo
  const truquesClasse = magiasClasse.filter(m => m.circulo === 0);
  const magiasCirculo = {};
  for (let c = 1; c <= maxCirculo; c++) {
    const personalizadasDoCirc = personalizadasDeCirculo.filter(m => m.circulo === c);
    const nomesPersonalizados = new Set(personalizadasDoCirc.map(m => m.nome));
    // DEDUP ESTREITO, e o estreitamento é o ponto. Para o Mago a MESMA magia
    // pode chegar por dois caminhos -- o jogador criou a personalizada (fusão
    // acima) E pagou para copiá-la para `char.grimorio` (issue #42:
    // mostrarBuscaGrimorio agora lista a magia personalizada como copiável,
    // de onde a grade do Mago também é montada) --, e sem remover uma delas
    // o jogador veria o cartão DUPLICADO. Antes da #42 este mesmo dedup já
    // existia para cobrir o CONTORNO que empurrava a personalizada sozinha
    // para o grimório; o contorno saiu, mas o dedup continua necessário
    // porque a cópia LEGÍTIMA produz o mesmo par duplicado.
    //
    // O que NÃO pode acontecer é este dedup valer para todo mundo: um
    // Clérigo pode criar a SUA "Bênção" personalizada, e "Bênção" também é
    // magia de 1º círculo do acervo. Homônimas não são a mesma magia. Um
    // filtro só por nome apagaria a magia do LIVRO da grade -- o jogador
    // perderia o caminho para prepará-la, e se ela já estivesse preparada o
    // clique no cartão que sobrou removeria a entrada dela (o handler casa
    // por nome). Regressão exatamente na população que estas issues existem
    // para atender: o conjurador não-Mago.
    //
    // Por isso as três condições juntas: só some a entrada que veio do
    // grimório (`nomesDoGrimorio`), de um personagem com grimório
    // (`ehMago`), e que tem uma personalizada do MESMO círculo com o mesmo
    // nome. Fora do Mago nada é removido, e a lista da classe fica intacta.
    const ehCopiaJaNoGrimorio = (m) => ehMago
      && nomesPersonalizados.has(m.nome)
      && nomesDoGrimorio.has(m.nome);
    const doCirculo = [
      ...magiasClasse.filter(m => m.circulo === c && !ehCopiaJaNoGrimorio(m)),
      ...personalizadasDoCirc
    ];
    if (doCirculo.length > 0) magiasCirculo[c] = doCirculo;
  }

  // ------------------------------------------------------------------
  // HOMÔNIMAS: quando a grade mostra DOIS cartões com o mesmo nome
  // ------------------------------------------------------------------
  // Antes destas issues, magia personalizada de círculo não tinha cartão
  // nenhum, então esta disputa NÃO existia -- ela é criada pela fusão acima,
  // e é esta função que tem de lidar com ela. O caso: um Clérigo cria a SUA
  // "Bênção", e "Bênção" também é magia de 1º círculo do acervo. Homônimas
  // não são a mesma magia, e as duas têm cartão.
  //
  // `magias_preparadas[]` é indexada por NOME no aplicativo inteiro (o
  // Descanso Longo, a troca de nível e o despreparo da ficha todos casam
  // assim), então DUAS homônimas preparadas ao mesmo tempo é um estado que o
  // resto do app não sabe representar -- `sheet/magias.js` chega a
  // despreparar com `filter(m => m.nome !== nome)`, que levaria as duas
  // juntas. Trocar essa chave é mudança estrutural, fora do alcance destas
  // issues. A limitação FICA: uma vaga por nome.
  //
  // O que não pode ficar é o comportamento silencioso. Estes dois nomes
  // resolvem isso sem trocar a chave: a grade passa a dizer a VERDADE sobre
  // qual das duas está preparada, e o clique na outra passa a EXPLICAR em
  // vez de apagar a preparação alheia.
  const cartoesDaGrade = Object.values(magiasCirculo).flat();
  const nomesEmDisputa = new Set(
    cartoesDaGrade
      .filter(m => m.personalizada
        && cartoesDaGrade.some(outro => !outro.personalizada && outro.nome === m.nome))
      .map(m => m.nome)
  );

  /**
   * Diz se uma entrada de `magias_preparadas[]` é a magia DESTE cartão.
   *
   * O nome sozinho não responde, porque duas magias diferentes podem se
   * chamar igual (a do acervo e a que o jogador inventou). Só que exigir a
   * marca `personalizada` SEMPRE também erra: ficha antiga tem magia
   * personalizada preparada sem marca nenhuma (antes destas issues o Mago já
   * preparava a dele pela grade, porque ela chegava lá pelo grimório, e o
   * gravador de então não marcava nada), e a regra estrita deixaria essa
   * magia presa -- cartão apagado e clique recusado, sem jeito de despreparar.
   *
   * Por isso a marca só é cobrada quando a entrada é AMBÍGUA, e ambiguidade
   * tem três fontes -- as duas últimas vindo do DADO, não da tela:
   *
   *  1. `nomesEmDisputa` -- esta grade mostra dois cartões com este nome.
   *     Pega a colisão de classe única (o Clérigo que cria a sua "Bênção").
   *  2. `entrada.classe` diferente da superfície ATIVA -- a entrada é
   *     provadamente de outra classe. Sem isto, um Clérigo X/Mago Y com
   *     "Mísseis Mágicos" preparado no Mago e uma personalizada de mesmo
   *     nome via, na aba do CLÉRIGO, um cartão só (o dele, porque a magia
   *     não está na lista de Clérigo): `nomesEmDisputa` não enxergava
   *     colisão nenhuma, o cartão nascia aceso pela entrada do Mago e o
   *     clique fazia `splice` nela, com o toast "removida" -- a destruição
   *     silenciosa de novo, só que por outra porta. A grade de UMA
   *     superfície não tem como ver o cartão que só a outra desenha; a
   *     entrada, sim, diz de quem é.
   *  3. `magiaEhEspecial(entrada)` -- a entrada veio de origem isenta
   *     (domínio, Iniciado em Magia, espécie...). Não é magia escolhida na
   *     lista de nenhuma classe, então não é a magia deste cartão. Sem isto,
   *     a personalizada homônima de uma concedida aparecia como preparada e
   *     "Especial", e `isDominio` ainda lhe tirava o check -- a magia do
   *     jogador ficava sem caminho para ser preparada.
   *
   * Entrada SEM `classe` continua não sendo ambígua por este critério: "não
   * sei de quem é" não é "é de outra" (mesma disciplina de `semClasse` em
   * regras-magia-classe.js). É o que preserva a permissão da ficha antiga,
   * cujas entradas são da própria superfície e sem carimbo.
   *
   * @param {object} entrada Entrada de `char.magias_preparadas[]`.
   * @param {string} nomeCartao Nome exibido no cartão clicado/renderizado.
   * @param {boolean} ehCartaoPersonalizado Se o cartão é o da magia do jogador.
   * @returns {boolean}
   */
  function entradaEhDoCartao(entrada, nomeCartao, ehCartaoPersonalizado) {
    if (entrada?.nome !== nomeCartao) return false;
    const classeDaEntrada = typeof entrada.classe === 'string' ? entrada.classe.trim() : '';
    const deOutraClasse = classeDaEntrada !== '' && classeDaEntrada !== sup?.classe;
    const ambigua = nomesEmDisputa.has(nomeCartao) || deOutraClasse || magiaEhEspecial(entrada);
    if (!ambigua) return true;
    return Boolean(entrada.personalizada) === ehCartaoPersonalizado;
  }

  // Minor 3 da Tarefa 4 (achado "consertar agora" da revisão final): o
  // contador de preparadas logo abaixo (id="gm-contador-preparadas")
  // testava `>= maxPrep` (contador-cheio) ANTES de `> maxPrep`
  // (contador-excedido) -- como toda contagem > maxPrep também é >=
  // maxPrep, o ramo "excedido" nunca era alcançado (o ternário sempre
  // parava no "cheio" primeiro). site/js/sheet/magias.js:838 já tinha a
  // ordem certa (excedido primeiro com `>`, cheio depois com `===`); esta
  // tela só passou a copiar a mesma ordem, para as duas concordarem na
  // regra de alarme. Mesmo conserto em atualizarContadores(), abaixo, que
  // recalcula esta mesma classe a cada mudança.
  abrirModal(somenteConsulta ? 'Consultar Magias' : 'Gerenciar Magias', `
    ${somenteConsulta ? `<div class="info-box info" style="margin-bottom:8px;font-size:0.85rem">Magias conhecidas sao definidas na <strong>subida de nivel</strong>. Use o <strong>Descanso Longo</strong> para trocar 1 magia.${
      // A frase só aparece para quem TEM magia personalizada de círculo:
      // sem ela, o modal continua dizendo exatamente o que sempre disse.
      // Com ela, a tela precisa contar a exceção -- o título ainda é
      // "Consultar Magias", e uma tela que permite uma ação sem dizer que
      // permite é a mesma mentira do contador que não bate, por outro meio.
      personalizadasDeCirculo.length > 0
        ? ' Suas <strong>magias personalizadas</strong> são a exceção: você marca e desmarca cada uma na aba do círculo dela.'
        : ''
    }</div>` : ''}
    <div id="gm-aviso-superficie">${avisoSuperficieAtiva(superficies, sup, labelMg, classificacaoAtiva.semClasse.length)}</div>
    <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.78rem">
      <span class="magia-contador ${truquesQueContamNoLimite(char).length >= maxTruq && umaSuperficieSo ? 'contador-cheio' : ''}" id="gm-contador-truques">
        Truques: ${truquesQueContamNoLimite(char).length}/${maxTruq}
      </span>
      <span class="magia-contador ${classificacaoAtiva.desta.length > maxPrep && classificacaoAtiva.semClasse.length === 0 ? 'contador-excedido' : classificacaoAtiva.desta.length === maxPrep && classificacaoAtiva.semClasse.length === 0 ? 'contador-cheio' : ''}" id="gm-contador-preparadas">
        ${labelMg}s: ${classificacaoAtiva.desta.length}/${maxPrep}
      </span>
      <span class="magia-contador contador-dominio" id="gm-contador-sem-classe" title="Magias de fichas antigas cuja classe não pôde ser determinada sem chute -- não entram nesta contagem nem no bloqueio de limite." ${classificacaoAtiva.semClasse.length > 0 ? '' : 'hidden'}>
        +${classificacaoAtiva.semClasse.length} sem classe
      </span>
    </div>
    <div class="tabs" id="tabs-gerenciar-magias" style="margin-bottom:8px;overflow-x:auto;white-space:nowrap">
      <div class="tab active" data-tab-mg="preparadas">${labelMg}s Atuais</div>
      <div class="tab" data-tab-mg="truques">Truques</div>
      ${Object.keys(magiasCirculo).map(c => `<div class="tab" data-tab-mg="${c}">${c}º Círculo</div>`).join('')}
    </div>
    <div class="search-box"><input type="text" id="busca-magia-add" placeholder="Buscar magia..." class="form-input"></div>
    <div id="resultado-magias" style="min-height:35dvh;max-height:50dvh;overflow-y:auto"></div>
  `, '', () => renderFichaCompleta());

  const resultadoEl = document.getElementById('resultado-magias');
  let tabAtiva = 'preparadas';

  function renderTab() {
    const termo = semAcento(document.getElementById('busca-magia-add')?.value || '');
    let html = '';

    if (tabAtiva === 'preparadas') {
      // Mostrar magias preparadas/conhecidas atuais (para remover). A lista
      // é `desta` ∪ `semClasse` (Tarefa 4) -- magia carimbada de OUTRA
      // classe não aparece aqui: este modal é escopado à superfície ativa
      // (`sup`), e misturar o orçamento de outra classe nesta aba era o
      // mesmo defeito que o achado da Tarefa 2 corrigiu em levelup-ui.js.
      // Para classe única `deOutra` é sempre vazio -- nada muda para a
      // maioria dos personagens.
      const especiais = (char.magias_preparadas || []).filter(m => magiaEhEspecial(m));
      const normais = [...classificacaoAtiva.desta, ...classificacaoAtiva.semClasse];
      const filtradas = termo.length >= 2 ? normais.filter(m => semAcento(m.nome).includes(termo)) : normais;
      const filtradasDom = termo.length >= 2 ? especiais.filter(m => semAcento(m.nome).includes(termo)) : especiais;

      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${labelMg}s: ${classificacaoAtiva.desta.length}/${maxPrep}${classificacaoAtiva.semClasse.length > 0 ? ` <span title="Magias de fichas antigas cuja classe não pôde ser determinada sem chute.">+${classificacaoAtiva.semClasse.length} sem classe</span>` : ''}${somenteConsulta ? '' : ' | Use o <strong>check</strong> para (des)marcar'}</div>`;

      if (filtradasDom.length > 0) {
        html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:8px 0 4px">Magias Especiais</div>`;
        html += `<div class="opcao-grid densa">${filtradasDom.map(m => `
          <div class="opcao-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
            <span class="opcao-check"></span>
            <div class="opcao-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="${m.circulo}" style="cursor:pointer"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
            <div class="opcao-resumo"><span>${rotuloOrigemMagia(m)}</span></div>
          </div>
        `).join('')}</div>`;
      }

      if (filtradas.length > 0) {
        // escHtml no NOME (issues #27/#33): esta lista passou a receber magia
        // PERSONALIZADA -- nome é texto livre que o jogador digita, e o
        // formulário só exige que não seja vazio. Sem escapar, uma aspa dupla
        // fecha o atributo antes da hora (o `data-remover-check` chega
        // truncado ao clique, e a magia certa não é achada) e uma tag chega
        // viva à tela. O navegador decodifica a entidade ao ler o atributo,
        // então `el.dataset.removerCheck` continua devolvendo o nome exato.
        //
        // `data-remover-personalizada` (lacuna das mesmas issues, classes de
        // magias CONHECIDAS): diz QUAL das duas homônimas é o cartão, do
        // mesmo jeito que `data-circ-personalizada` faz na grade de círculos
        // -- e pela mesma razão. `magias_preparadas[]` é indexada por NOME, e
        // o handler achava a entrada por nome puro: com a personalizada e a
        // magia da classe preparadas ao mesmo tempo, o clique no check da
        // personalizada apagava a que estivesse PRIMEIRO no array. Só o
        // cartão sabe em qual deles o jogador clicou.
        //
        // DE ONDE VEM esse estado, medido (correção da rodada 1 de revisão:
        // a versão anterior deste comentário culpava a subida de nível, e
        // isso é FALSO -- levelup-ui.js monta `jaTemMagias` dos nomes de
        // `magias_preparadas` e esconde a homônima, e ainda guarda a
        // gravação com `!char.magias_preparadas?.find(x => x.nome === nome)`;
        // `mostrarPreencherSlotMagia`, neste arquivo, filtra pelo mesmo
        // `jaTemSet`, e o handler da grade recusa com toast): NENHUM caminho
        // do app produz as duas. Ele chega de FORA -- ficha importada ou
        // editada à mão, que é modelo de ameaça declarado neste repositório
        // (a ficha circula como arquivo exportado; ver
        // testes/e2e/regras/xss-campos-livres.spec.mjs). A defesa vale
        // justamente por isso: o que o app não sabe criar, ele ainda tem de
        // não destruir em silêncio ao encontrar.
        html += `<div class="opcao-grid densa">${filtradas.map(m => `
          <div class="opcao-card selecionada">
            <span class="opcao-check" ${checkLiberado(!!m.personalizada) ? `data-remover-check="${escHtml(m.nome)}"${m.personalizada ? ' data-remover-personalizada="1"' : ''} style="cursor:pointer"` : ''}></span>
            <div class="opcao-nome" data-detalhe-magia="${escHtml(m.nome)}" data-detalhe-circ="${m.circulo}" style="cursor:pointer">${escHtml(m.nome)}</div>
            <div class="opcao-resumo">
              <span>${m.circulo || 0}º Circulo</span>
            </div>
          </div>
        `).join('')}</div>`;
      } else if (normais.length === 0) {
        html += `<div style="text-align:center;color:var(--text-muted);padding:16px">Nenhuma magia ${labelMg.toLowerCase()} ainda.</div>`;
      }
    } else if (tabAtiva === 'truques') {
      // Truques: grid da classe com toggle
      const truquesAtuais = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
      // `truquesEsp` continua sendo só os de ESPÉCIE: ele alimenta a seção
      // "Truques de Espécie" da grade e a deduplicação da lista de classe,
      // que são perguntas de EXIBIÇÃO, não de orçamento. Quem responde
      // "quanto do limite já foi gasto?" é truquesQueContamNoLimite(char).
      const truquesEsp = truquesAtuais.filter(m => m.origem === 'especie');
      const numTruq = truquesQueContamNoLimite(char).length;
      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Truques: ${numTruq}/${maxTruq}${truquesEsp.length > 0 ? ` (+${truquesEsp.length} espécie)` : ''}</div>`;

      const selecionadosSet = new Set(truquesAtuais.map(m => m.nome));
      const truquesEspSet = new Set(truquesEsp.map(m => m.nome));

      // Exibir truques de espécie (não removíveis) primeiro
      if (truquesEsp.length > 0) {
        let listaEsp = truquesEsp;
        if (termo.length >= 2) listaEsp = listaEsp.filter(m => semAcento(m.nome).includes(termo));
        html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:8px 0 4px">Truques de Espécie</div>`;
        html += `<div class="opcao-grid densa">${listaEsp.map(m => `
          <div class="opcao-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
            <span class="opcao-check"></span>
            <div class="opcao-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="0" style="cursor:pointer"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
            <div class="opcao-resumo"><span>Especie</span></div>
          </div>
        `).join('')}</div>`;
      }

      let lista = [...truquesClasse];
      lista.sort((a, b) => {
        const aSel = selecionadosSet.has(a.nome) ? 0 : 1;
        const bSel = selecionadosSet.has(b.nome) ? 0 : 1;
        return aSel - bSel || a.nome.localeCompare(b.nome);
      });
      // Filtrar truques de espécie da lista de classe (evitar duplicatas)
      lista = lista.filter(m => !truquesEspSet.has(m.nome));
      if (termo.length >= 2) lista = lista.filter(m => semAcento(m.nome).includes(termo));
      const cheioTruq = numTruq >= maxTruq && umaSuperficieSo;

      html += `<div class="opcao-grid densa">${lista.map(m => {
        const sel = selecionadosSet.has(m.nome);
        const bloqueado = cheioTruq && !sel;
        return `
          <div class="opcao-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'bloqueada' : ''}"
               ${somenteConsulta ? '' : `data-toggle-truque="${m.nome}"`} style="${bloqueado ? 'opacity:0.35;' : ''}">
            <span class="opcao-check" ${somenteConsulta ? '' : `data-truque-check="${m.nome}" style="cursor:pointer"`}></span>
            <div class="opcao-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="0" style="cursor:pointer">${m.nome}</div>
            <div class="opcao-resumo">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
            </div>
          </div>`;
      }).join('')}</div>`;
    } else {
      // Magias de um círculo específico — grid
      const circ = parseInt(tabAtiva);
      const magiasDoCirc = magiasCirculo[circ] || [];
      // `preparadasDoCirc` + `entradaEhDoCartao` no lugar do Set de NOMES que
      // vivia aqui: com uma homônima preparada, o Set acendia o check nos
      // DOIS cartões, e a grade afirmava que a magia do jogador estava
      // preparada quando quem estava era a do livro. Sem homônima o
      // resultado é idêntico ao do Set (o nome basta), então nada muda para
      // quem não tem magia personalizada.
      const preparadasDoCirc = (char.magias_preparadas || []).filter(m => m.circulo === circ);
      const estaPreparada = (m) => preparadasDoCirc.some(p => entradaEhDoCartao(p, m.nome, !!m.personalizada));
      const numAtual = classificacaoAtiva.desta.length;
      // Regra do BLOQUEIO (Tarefa 4): só é "cheio" com contagem CERTA --
      // sem nenhuma magia sem classe. Havendo `semClasse`, a grade não
      // grisalha por incerteza (mesma decisão do gate de "Adicionar",
      // abaixo -- bloquear/avisar visualmente com base numa contagem
      // incerta é pior que deixar passar).
      const cheio = numAtual >= maxPrep && classificacaoAtiva.semClasse.length === 0;

      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${labelMg}s: ${numAtual}/${maxPrep}${cheio ? ' <span style="color:var(--danger)">(Limite atingido)</span>' : ''}${classificacaoAtiva.semClasse.length > 0 ? ` <span title="Magias de fichas antigas cuja classe não pôde ser determinada sem chute.">+${classificacaoAtiva.semClasse.length} sem classe</span>` : ''}</div>`;

      let lista = [...magiasDoCirc];
      lista.sort((a, b) => {
        const aSel = estaPreparada(a) ? 0 : 1;
        const bSel = estaPreparada(b) ? 0 : 1;
        return aSel - bSel || a.nome.localeCompare(b.nome);
      });
      if (termo.length >= 2) lista = lista.filter(m => semAcento(m.nome).includes(termo));

      html += `<div class="opcao-grid densa">${lista.map(m => {
        const sel = estaPreparada(m);
        // `entradaEhDoCartao` também aqui, pela mesma razão: se a homônima
        // do acervo for magia de domínio, casar só por nome pintaria o
        // cartão do JOGADOR de domínio -- e cartão de domínio não tem check,
        // ou seja, a magia dele ficaria sem caminho para ser preparada.
        const isDominio = (char.magias_preparadas || [])
          .find(p => magiaEhEspecial(p) && entradaEhDoCartao(p, m.nome, !!m.personalizada));
        const bloqueado = cheio && !sel && !isDominio;
        // `checkLiberado` (lacuna das mesmas issues, classes de magias
        // CONHECIDAS) no lugar de `somenteConsulta` puro: para Bardo, Bruxo,
        // Feiticeiro e subclasse conjuradora este era o portão que fazia o
        // cartão da magia personalizada nascer SEM check -- aparecia na grade
        // e não clicava. A magia da lista da classe continua travada; ver o
        // comentário da função, no topo desta.
        //
        // `bloqueado` continua ORTOGONAL a isso: no limite o cartão sai
        // cinza e COM check, e quem recusa é o portão do handler, com o
        // toast que diz o porquê -- mesma forma das classes de preparadas.
        // Para essas classes o caminho de quem está no limite é a troca do
        // Descanso Longo (`mostrarTrocaMagiaConhecida`, abaixo).
        // escHtml no nome E NA ESCOLA: ver o comentário gêmeo na aba de
        // preparadas, acima. Esta grade passou a listar magia PERSONALIZADA
        // (issues #27/#33), e a fusão entrega o registro INTEIRO -- os dois
        // campos que este cartão interpola são texto livre digitado pelo
        // jogador. `escola` engana porque o formulário parece oferecer só um
        // select fechado: ele tem a opção "Personalizado…", que lê
        // `#mc-escola-personalizada`, um input de texto sem validação.
        return `
          <div class="opcao-card ${sel ? 'selecionada' : ''} ${isDominio ? 'magia-dominio' : ''} ${bloqueado ? 'bloqueada' : ''}"
               style="${bloqueado ? 'opacity:0.35;' : ''}${isDominio ? 'opacity:0.7;' : ''}">
            <span class="opcao-check" ${!isDominio && checkLiberado(!!m.personalizada) ? `data-circ-check="${escHtml(m.nome)}" data-circ-check-val="${circ}"${m.personalizada ? ' data-circ-personalizada="1"' : ''} style="cursor:pointer"` : ''}></span>
            <div class="opcao-nome" data-detalhe-magia="${escHtml(m.nome)}" data-detalhe-circ="${circ}" style="cursor:pointer">${isDominio ? '<span class="badge-dominio">&#9733;</span> ' : ''}${escHtml(m.nome)}</div>
            <div class="opcao-resumo">
              <span>${escHtml(m.escola || '')}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
              ${isDominio ? '<span>Especial</span>' : ''}
              <!-- Numa grade em que todo o resto veio da lista da classe, o
                   jogador precisa reconhecer a magia que ele mesmo inventou
                   -- é o mesmo papel do selo "Personalizada" da ficha. -->
              ${m.personalizada ? '<span>Personalizada</span>' : ''}
            </div>
          </div>`;
      }).join('')}</div>`;
    }

    resultadoEl.innerHTML = html;
    bindEventosTab();
  }

  function bindEventosTab() {
    // Remover magia preparada (via check na aba "Preparadas Atuais")
    resultadoEl.querySelectorAll('[data-remover-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.removerCheck;
        // QUAL cartão foi clicado -- `entradaEhDoCartao` no lugar do
        // `findIndex(m => m.nome === nome)` que vivia aqui. Com a
        // personalizada e a homônima da classe preparadas ao mesmo tempo,
        // o nome puro casava com a PRIMEIRA do array e o clique no check de
        // uma apagava a outra, em silêncio e com um toast dizendo que
        // removeu a certa. Mesmo predicado (e mesmo vocabulário) do handler
        // da grade de círculos, abaixo -- ver `entradaEhDoCartao` para as
        // três fontes de ambiguidade.
        const ehCartaoPersonalizado = el.dataset.removerPersonalizada === '1';
        const idx = char.magias_preparadas
          .findIndex(m => entradaEhDoCartao(m, nome, ehCartaoPersonalizado));
        if (idx >= 0) {
          char.magias_preparadas.splice(idx, 1);
          salvar();
          toast(`${nome} removida`, 'success');
          atualizarContadores();
          renderTab();
        }
      });
    });

    // Toggle truque (via check)
    resultadoEl.querySelectorAll('[data-truque-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.truqueCheck;
        // Não permitir remover truques de espécie
        const entradaExistente = (char.magias_conhecidas || []).find(m => m.nome === nome);
        if (entradaExistente && entradaExistente.origem === 'especie') return;
        const idx = (char.magias_conhecidas || []).findIndex(m => m.nome === nome);
        if (idx >= 0) {
          char.magias_conhecidas.splice(idx, 1);
          salvar();
          toast(`${nome} removido`, 'success');
        } else {
          // ACHADO IMPORTANT da revisão da Tarefa 3 (terceira instância da
          // mesma forma que os dois portões de preparadas/círculo já
          // corrigidos nesta rodada): `numAtual` é GLOBAL
          // (char.magias_conhecidas de TODAS as classes, sem campo que
          // diga de quem é cada truque) confrontado contra `maxTruq`, o
          // limite de UMA superfície só (a ativa). Num Clérigo 5/Mago 1 os
          // truques do Clérigo consomem o orçamento do Mago, e "Adicionar"
          // trava para sempre.
          //
          // AQUI NÃO EXISTE PROXY HONESTO -- truque não entra no grimório
          // (diferente de magia de círculo do Mago), então não há como
          // separar por classe com o dado disponível hoje. Mesma guarda
          // dos outros dois portões: com mais de uma superfície de
          // conjuração, não bloqueia -- bloquear com base numa contagem
          // incerta é pior que deixar passar, e o jogador já vê o
          // contador honesto na tela.
          const numAtual = truquesQueContamNoLimite(char).length;
          if (umaSuperficieSo && numAtual >= maxTruq) { toast(`Limite de ${maxTruq} truques atingido`, 'error'); return; }
          char.magias_conhecidas.push({ nome, circulo: 0 });
          salvar();
          toast(`${nome} adicionado`, 'success');
        }
        atualizarContadores();
        renderTab();
      });
    });

    // Toggle magia de circulo (via check)
    resultadoEl.querySelectorAll('[data-circ-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.circCheck;
        const circ = parseInt(el.dataset.circCheckVal);
        // QUAL cartão foi clicado -- ver o comentário do gravador, abaixo.
        // Precisa ser lido AQUI, antes do ramo de remoção, e não só no de
        // adição: era exatamente essa assimetria que fazia o clique no
        // cartão da homônima cair em "remover" e apagar a preparação da
        // outra magia.
        const ehCartaoPersonalizado = el.dataset.circPersonalizada === '1';
        const idx = char.magias_preparadas
          .findIndex(m => entradaEhDoCartao(m, nome, ehCartaoPersonalizado));
        if (idx < 0 && char.magias_preparadas.some(m => m?.nome === nome)) {
          // Chegar aqui significa: existe entrada com este nome, mas ela é da
          // OUTRA magia homônima (só a disputa faz `entradaEhDoCartao`
          // recusar um nome igual). Antes, este clique caía no ramo de
          // remoção e apagava a preparação alheia em SILÊNCIO, com um toast
          // dizendo "removida" -- o jogador achava que estava preparando a
          // dele e saía com a outra desfeita.
          //
          // A limitação (uma vaga por nome, porque `magias_preparadas[]` é
          // indexada por nome no app inteiro) continua existindo; o que muda
          // é ela ser DITA, no momento em que morde, em vez de agir por
          // baixo. Recusar é a única saída honesta enquanto a chave for o
          // nome: preparar as duas gravaria um estado que outras telas
          // desfazem errado (`sheet/magias.js` despreparar com
          // `filter(m => m.nome !== nome)` levaria as duas de uma vez).
          // O recado nomeia QUAL das outras está ocupando a vaga -- sem isso
          // o jogador da ficha multiclasse lê "já está preparada" olhando
          // para uma aba onde a magia não aparece, e não tem como adivinhar
          // que ela está preparada na outra classe.
          const outra = char.magias_preparadas.find(m => m?.nome === nome);
          const classeDaOutra = typeof outra?.classe === 'string' ? outra.classe.trim() : '';
          const qual = outra?.personalizada ? 'a sua magia personalizada'
            : magiaEhEspecial(outra) ? `uma magia concedida -- ${rotuloOrigemMagia(outra)}`
              : classeDaOutra && classeDaOutra !== sup?.classe ? `a magia de ${classeDaOutra}`
                : 'a magia da classe';
          toast(`"${nome}" já está preparada (${qual}). Magias preparadas são identificadas pelo nome: desprepare a outra antes.`, 'error');
          return;
        }
        if (idx >= 0) {
          // Remover
          char.magias_preparadas.splice(idx, 1);
          salvar();
          toast(`${nome} removida`, 'success');
        } else {
          // Adicionar — verificar limite. ACHADO IMPORTANT da revisão da
          // Tarefa 3 (irmão do mesmo defeito em sheet/magias.js): `numAtual`
          // era GLOBAL (char.magias_preparadas de TODAS as classes, sem
          // campo que dissesse de quem era cada entrada) confrontado contra
          // `maxPrep`, o limite de UMA superfície só (`sup`, a ativa) -- num
          // Clérigo 5/Mago 1 com o Clérigo como superfície ativa, numAtual
          // (13, as 9 do Clérigo + as 4 do Mago) nunca ficava menor que
          // maxPrep (9), e "Adicionar" travava para sempre.
          //
          // Tarefa 4: o proxy `ehMago ? ...filtrar pelo grimório... :
          // umaSuperficieSo` deu lugar à medida DIRETA --
          // `classificacaoAtiva.desta` já é só as preparadas CARIMBADAS com
          // a classe da superfície ativa (Mago incluso: o grimório continua
          // conferido logo abaixo, por `magiaMagoEstaNoGrimorio`, mas não
          // precisa mais filtrar a contagem por ele). Regra do BLOQUEIO: só
          // recusa com contagem CERTA (`semClasse.length === 0`) -- havendo
          // magia sem classe, a contagem é incerta e o portão deixa passar
          // (o contador "+N sem classe" já avisa o jogador na tela).
          const numAtual = classificacaoAtiva.desta.length;
          if (numAtual >= maxPrep && classificacaoAtiva.semClasse.length === 0) {
            toast(`Limite de ${maxPrep} magias atingido. Remova uma antes de adicionar.`, 'error');
            return;
          }
          // QUAL cartão foi clicado -- não "existe alguma personalizada com
          // este nome?". A diferença importa quando as duas coisas existem:
          // um Clérigo com a sua própria "Bênção" personalizada tem DOIS
          // cartões de 1º círculo chamados "Bênção" (o do acervo e o dele), e
          // a ficha sozinha não sabe dizer em qual deles o jogador clicou.
          // Só o cartão sabe, e por isso a marca viaja nele. Perguntar à
          // ficha por nome+círculo (a forma que `ehCustomizadaCirculo` usa em
          // sheet/magias.js, onde não há essa ambiguidade) carimbaria a magia
          // do LIVRO como personalizada, e a seção Preparadas passaria a
          // mostrar a magia do jogador no lugar da que ele escolheu.
          //
          // A ficha ainda CONFIRMA o que o cartão diz: HTML é o que o render
          // acabou de escrever, mas quem grava em `magias_preparadas` não
          // aceita uma marca sem lastro em `magias_customizadas`
          // (`magiaPersonalizadaDaFicha`, topo do arquivo -- a mesma consulta
          // que o gravador da troca do Descanso Longo faz).
          const ehPersonalizada = ehCartaoPersonalizado
            && !!magiaPersonalizadaDaFicha(char, nome, circ);
          // O portão do grimório não vale para magia personalizada: ela não
          // sai do acervo e não é "registrada" em livro nenhum -- o jogador
          // a inventou. Isento AQUI, e não só em mostrarFormMagiaCustom
          // (issue #42): o caminho normal de preparo não pode depender de a
          // magia customizada ter sido empurrada para `char.grimorio` --
          // esse empurrão automático foi removido de lá, e a magia
          // personalizada só entra no grimório se o jogador pagar a cópia,
          // pelo botão "+ Copiar Magia para Grimório" (mostrarBuscaGrimorio).
          if (ehMago && !ehPersonalizada && !magiaMagoEstaNoGrimorio(char, nome)) {
            toast('Essa magia não está registrada no grimório.', 'error');
            return;
          }
          // sup?.classe: a mesma superficie que decidiu QUAL lista de magias
          // este modal mostrou -- a magia escolhida e necessariamente dela.
          char.magias_preparadas.push({
            nome, circulo: circ,
            ...(sup?.classe ? { classe: sup.classe } : {}),
            // `personalizada: true` é o que a seção Preparadas da ficha usa
            // para resolver a magia por nome+círculo em
            // `char.magias_customizadas` e renderizar a linha personalizada
            // (descrição, tags e o botão de Conjurar próprio dela). Sem a
            // marca, a linha cairia no caminho das magias do acervo, que não
            // conhece esta magia.
            ...(ehPersonalizada ? { personalizada: true } : {})
          });
          salvar();
          toast(`${nome} adicionada`, 'success');
        }
        atualizarContadores();
        renderTab();
      });
    });

    // Botão de detalhes da magia
    resultadoEl.querySelectorAll('[data-detalhe-magia]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = btn.dataset.detalheMagia;
        const circ = parseInt(btn.dataset.detalheCirc);
        const dados = await getMagiasPorCirculo(circ);
        // A personalizada é o PLANO B, não o A: magia do acervo continua
        // vindo do acervo. Ela precisa existir aqui porque a grade de
        // círculos passou a listar `char.magias_customizadas` (issues
        // #27/#33) e magia personalizada não está em arquivo nenhum de
        // dados/ -- sem este plano B, clicar no nome do cartão recém-criado
        // responderia com o toast vermelho "Detalhes não encontrados". Mesma
        // forma da issue #39, que já tinha mordido o painel do Grimório.
        // O mesmo plano B vale no painel da troca do Descanso Longo, e por
        // isso a consulta mora em `magiaPersonalizadaDaFicha` (topo).
        const magia = dados?.magias?.find(m => m.nome === nome)
          || magiaPersonalizadaDaFicha(char, nome, circ);
        if (!magia) { toast('Detalhes não encontrados', 'error'); return; }
        // Abrir sub-modal com detalhes. escHtml nos metadados: com o plano B
        // acima, eles podem vir de uma magia PERSONALIZADA, e ali escola,
        // tempo, alcance, componentes e duração são texto livre digitado
        // pelo jogador (os selects do formulário têm a opção
        // "Personalizado…"). É o mesmo tratamento que a linha da magia
        // personalizada na ficha já dá a estes cinco campos
        // (renderDetalhesMagiaPersonalizada, sheet/magias.js). A descrição
        // continua passando por mdParaHtml, que já escapa antes de formatar.
        //
        // `classes` também é escapado: o formulário não tem esse campo, mas
        // uma FICHA IMPORTADA traz o que quiser dentro de
        // `magias_customizadas[]`, e o plano B acima entrega esse registro
        // inteiro a este template. Mesmo motivo de `circulo_superior` estar
        // seguro sem esforço (mdParaHtml escapa antes de formatar).
        const detalhesHtml = `
          <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
            <span class="badge badge-primary">${circ === 0 ? 'Truque' : circ + 'º Círculo'}</span>
            <span class="badge badge-secondary">${escHtml(magia.escola)}</span>
            <span>${escHtml(magia.tempo_conjuracao)}</span>
            <span>${escHtml(magia.alcance)}</span>
            <span>${escHtml(magia.componentes)}</span>
            <span>${escHtml(magia.duracao)}</span>
          </div>
          <div class="md-content">${mdParaHtml(magia.descricao)}</div>
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
          ${(magia.classes || []).length > 0 ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Classes: ${magia.classes.map(escHtml).join(', ')}</div>` : ''}
        `;
        abrirModal(magia.nome, detalhesHtml, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
      });
    });
  }

  function atualizarContadores() {
    // Recalcular a classificação a partir do char (Tarefa 4) -- substitui o
    // truque antigo de mutar `preparadasNormais` em lugar (`.length = 0` +
    // `push`): reatribuir o `let` de fora já é visto por renderTab e pelos
    // handlers de clique, que vivem no mesmo escopo léxico.
    classificacaoAtiva = preparadasPorClasse(char, sup?.classe);

    // Atualizar contador de truques no topo do modal
    // Excluir truques de espécie do contador de classe
    const numTruques = truquesQueContamNoLimite(char).length;
    const contTruques = document.getElementById('gm-contador-truques');
    if (contTruques) {
      contTruques.textContent = `Truques: ${numTruques}/${maxTruq}`;
      contTruques.className = `magia-contador ${numTruques >= maxTruq && umaSuperficieSo ? 'contador-cheio' : ''}`;
    }

    // Atualizar contador de preparadas no topo do modal
    const contPrep = document.getElementById('gm-contador-preparadas');
    if (contPrep) {
      contPrep.textContent = `${labelMg}s: ${classificacaoAtiva.desta.length}/${maxPrep}`;
      contPrep.className = `magia-contador ${classificacaoAtiva.desta.length > maxPrep && classificacaoAtiva.semClasse.length === 0 ? 'contador-excedido' : classificacaoAtiva.desta.length === maxPrep && classificacaoAtiva.semClasse.length === 0 ? 'contador-cheio' : ''}`;
    }

    // Atualizar (mostrar/esconder) o indicador "+N sem classe" ao lado do
    // contador de preparadas -- Regra da CONTAGEM (Tarefa 4): a incerteza
    // tem de ficar VISÍVEL, para o número do contador não mentir por
    // omissão. O elemento já existe desde o HTML inicial (só `hidden` muda
    // aqui) -- de propósito: criar nó novo via document.createElement/
    // insertAdjacentElement quebrava os stubs de DOM dos testes de unidade
    // que simulam clique neste modal (achado da validação desta tarefa,
    // multiclasse-magias-grimorio.test.mjs, Oráculo 4b), e nenhum outro
    // contador deste arquivo cria elemento em tempo de execução -- todos só
    // atualizam um nó que o `abrirModal` inicial já gravou.
    const contSemClasse = document.getElementById('gm-contador-sem-classe');
    if (contSemClasse) {
      contSemClasse.textContent = `+${classificacaoAtiva.semClasse.length} sem classe`;
      contSemClasse.hidden = classificacaoAtiva.semClasse.length === 0;
    }

    // N2 da re-revisão da Tarefa 4 (achado "consertar agora" da revisão
    // final): o aviso de `avisoSuperficieAtiva` (acima, "Classe
    // selecionada: ...") embute o número de `semClasse` no meio de uma
    // frase, e até este conserto nada aqui o atualizava -- o número
    // congelava no valor de quando o modal abriu, mesmo depois de
    // adicionar ou remover a última preparada sem carimbo (que também some
    // do contador `gm-contador-sem-classe`, acima). O container tem `id`
    // fixo desde o HTML inicial (mesmo padrão dos outros contadores desta
    // função -- nenhum cria nó novo em tempo de execução) para só o
    // `innerHTML` mudar aqui; `avisoSuperficieAtiva` devolve string vazia
    // quando não se aplica (classe única), então o container fica vazio
    // sem sobrar HTML antigo.
    const avisoEl = document.getElementById('gm-aviso-superficie');
    if (avisoEl) {
      avisoEl.innerHTML = avisoSuperficieAtiva(superficies, sup, labelMg, classificacaoAtiva.semClasse.length);
    }
  }

  // Tabs
  document.querySelectorAll('#tabs-gerenciar-magias .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#tabs-gerenciar-magias .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabAtiva = tab.dataset.tabMg;
      document.getElementById('busca-magia-add').value = '';
      renderTab();
    });
  });

  // Busca
  document.getElementById('busca-magia-add')?.addEventListener('input', renderTab);

  // Renderizar tab inicial (preparadas atuais)
  renderTab();
}

export async function mostrarFormMagiaCustom(indiceEdicao = null) {
  const magiaExistente = Number.isInteger(indiceEdicao)
    ? (char.magias_customizadas || [])[indiceEdicao]
    : null;
  if (Number.isInteger(indiceEdicao) && !magiaExistente) return;
  let indice = null;
  try {
    indice = await getIndiceMagias();
  } catch (_) {
    // O cache carregado pela ficha ainda permite criar a magia sem bloquear a tela.
  }
  const magiasIndice = indice?.magias || indiceMagiasCache || [];
  const tempoConjuracaoMagiaValido = (valor) => {
    const tempo = String(valor || '').trim();
    if (!tempo || /^(ama\s+ação|ama\s+acao)$/i.test(tempo)) return false;
    if (/crescimento excessivo|fertiliza[cç][aã]o|arma|ataque desarmado/i.test(tempo)) return false;
    return /^(?:a[cç][aã]o(?:\s+ou\s+ritual)?|a[cç][aã]o\s+b[oô]nus|1\s+a[cç][aã]o(?:\s+ou\s+ritual)?|rea[cç][aã]o(?:\b|\s+ou\s+ritual)|\d+\s+(?:minuto|minutos|hora|horas|dia|dias)(?:\s+ou\s+ritual)?)(?:\s|,|$)/i.test(tempo);
  };
  const valoresUnicos = campo => [...new Set(magiasIndice
    .map(magia => String(magia?.[campo] || '').trim())
    .filter(valor => Boolean(valor) && (campo !== 'tempo_conjuracao' || tempoConjuracaoMagiaValido(valor))))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const opcoes = {
    escolas: valoresUnicos('escola'),
    tempos: [
      'Ação', 'Ação Bônus', 'Reação', '1 ação', '1 minuto', '10 minutos',
      '1 hora', '8 horas', '12 horas', '24 horas', 'Ação ou Ritual',
      '1 ação ou Ritual', '1 minuto ou Ritual', '10 minutos ou Ritual', '1 hora ou Ritual'
    ],
    duracoes: valoresUnicos('duracao')
  };
  const opcoesSelect = (valores, rotulo) => `
    <option value="">Selecione ${rotulo}</option>
    ${valores.map(valor => `<option value="${escHtml(valor)}">${escHtml(valor)}</option>`).join('')}
    <option value="__personalizado__">Personalizado…</option>`;

  abrirModal(magiaExistente ? 'Editar Magia Personalizada' : 'Magia Personalizada', `
    <div class="form-group">
      <label class="form-label" for="mc-nome">Nome</label>
      <input type="text" class="form-input" id="mc-nome" placeholder="Nome da magia">
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label" for="mc-circulo">Circulo</label>
        <select class="form-select" id="mc-circulo">
          <option value="0">Truque</option>
          ${[1,2,3,4,5,6,7,8,9].map(i => `<option value="${i}">${i}o Circulo</option>`).join('')}
        </select>
      </div>
      <div class="col">
        <label class="form-label" for="mc-escola">Escola</label>
        <select class="form-select" id="mc-escola">${opcoesSelect(opcoes.escolas, 'a escola')}</select>
        <input type="text" class="form-input" id="mc-escola-personalizada" placeholder="Informe a escola" style="display:none;margin-top:6px">
      </div>
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label" for="mc-tempo">Tempo de Conjuração</label>
        <select class="form-select" id="mc-tempo">${opcoesSelect(opcoes.tempos, 'o tempo')}</select>
        <input type="text" class="form-input" id="mc-tempo-personalizado" placeholder="Informe o tempo de conjuração" style="display:none;margin-top:6px">
        <input type="text" class="form-input" id="mc-gatilho-reacao" placeholder="Gatilho da reação (opcional)" style="display:none;margin-top:6px">
      </div>
      <div class="col"><label class="form-label" for="mc-alcance">Alcance</label><input type="text" class="form-input" id="mc-alcance" value="9 metros"></div>
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label">Componentes</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0">
          <label><input type="checkbox" id="mc-comp-v" value="V"> V — Verbal</label>
          <label><input type="checkbox" id="mc-comp-s" value="S"> S — Somático</label>
          <label><input type="checkbox" id="mc-comp-m" value="M"> M — Material</label>
        </div>
        <input type="text" class="form-input" id="mc-comp-outro" placeholder="Outro componente ou detalhe material (opcional)">
      </div>
      <div class="col">
        <label class="form-label" for="mc-duracao">Duração</label>
        <select class="form-select" id="mc-duracao">${opcoesSelect(opcoes.duracoes, 'a duração')}</select>
        <div id="mc-duracao-personalizada" style="display:none;margin-top:6px">
          <div style="display:flex;gap:6px">
            <input type="number" min="1" step="1" class="form-input" id="mc-duracao-quantidade" placeholder="Quantidade" style="min-width:0">
            <select class="form-select" id="mc-duracao-unidade" style="min-width:0">
              <option value="turnos">turnos</option>
              <option value="minutos">minutos</option>
              <option value="horas">horas</option>
              <option value="dias">dias</option>
            </select>
          </div>
          <input type="text" class="form-input" id="mc-duracao-texto" placeholder="Ou duração complementar, ex.: Até ser dissipada" style="margin-top:6px">
        </div>
      </div>
    </div>
    <label style="display:flex;align-items:center;gap:6px;margin:10px 0"><input type="checkbox" id="mc-ritual"> Pode ser conjurada como Ritual</label>
    <div class="form-group">
      <label class="form-label" for="mc-desc">Descricao</label>
      <textarea class="form-textarea" id="mc-desc" rows="4" placeholder="Descricao da magia..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label" for="mc-dano">Dano / Efeito</label>
      <input type="text" class="form-input" id="mc-dano" placeholder="Ex: 3d6 fogo">
    </div>
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-mc">${magiaExistente ? 'Salvar Alterações' : 'Adicionar'}</button>`);

  const alternarPersonalizado = (selectId, campoId) => {
    const select = document.getElementById(selectId);
    const campo = document.getElementById(campoId);
    if (!select || !campo) return;
    const atualizar = () => { campo.style.display = select.value === '__personalizado__' ? '' : 'none'; };
    select.addEventListener('change', atualizar);
    atualizar();
  };
  alternarPersonalizado('mc-escola', 'mc-escola-personalizada');
  alternarPersonalizado('mc-tempo', 'mc-tempo-personalizado');
  alternarPersonalizado('mc-duracao', 'mc-duracao-personalizada');

  const atualizarGatilhoReacao = () => {
    const selectTempo = document.getElementById('mc-tempo');
    const campo = document.getElementById('mc-gatilho-reacao');
    if (!selectTempo || !campo) return;
    campo.style.display = /^rea[cç][aã]o$/i.test(selectTempo.value) ? '' : 'none';
  };
  document.getElementById('mc-tempo')?.addEventListener('change', atualizarGatilhoReacao);
  atualizarGatilhoReacao();

  if (magiaExistente) {
    const definirSelectOuPersonalizado = (selectId, inputId, valor) => {
      const select = document.getElementById(selectId);
      const input = document.getElementById(inputId);
      if (!select || !input) return;
      const possuiOpcao = [...select.options].some(opcao => opcao.value === valor);
      select.value = possuiOpcao ? valor : '__personalizado__';
      input.value = valor;
      select.dispatchEvent(new Event('change'));
    };
    document.getElementById('mc-nome').value = magiaExistente.nome || '';
    document.getElementById('mc-circulo').value = String(Number(magiaExistente.circulo) || 0);
    definirSelectOuPersonalizado('mc-escola', 'mc-escola-personalizada', magiaExistente.escola || '');
    const tempoExistente = String(magiaExistente.tempo_conjuracao || '');
    const matchReacao = tempoExistente.match(/^rea[cç][aã]o\s*,\s*(.+)$/i);
    definirSelectOuPersonalizado('mc-tempo', 'mc-tempo-personalizado', matchReacao ? 'Reação' : tempoExistente);
    if (matchReacao) document.getElementById('mc-gatilho-reacao').value = matchReacao[1];
    atualizarGatilhoReacao();
    definirSelectOuPersonalizado('mc-duracao', 'mc-duracao-texto', magiaExistente.duracao || '');
    document.getElementById('mc-alcance').value = magiaExistente.alcance || '';
    document.getElementById('mc-desc').value = magiaExistente.descricao || '';
    document.getElementById('mc-dano').value = magiaExistente.dano || '';
    document.getElementById('mc-ritual').checked = Boolean(magiaExistente.ritual);
    const componentes = String(magiaExistente.componentes || '').split(',').map(valor => valor.trim());
    ['V', 'S', 'M'].forEach(letra => { document.getElementById(`mc-comp-${letra.toLowerCase()}`).checked = componentes.includes(letra); });
    document.getElementById('mc-comp-outro').value = componentes.filter(valor => !['V', 'S', 'M'].includes(valor)).join(', ');
  }

  // Um tempo de conjuração que diz "ou Ritual" IMPLICA a marca de Ritual, e
  // marcá-la sozinho poupa o jogador de repetir a informação. O que a função
  // não pode fazer é DESMARCAR: a caixa é uma escolha explícita do jogador
  // (uma magia dele pode ser ritual com tempo "Ação"), e desmarcar apagava
  // essa escolha em dois momentos -- ao abrir a magia gravada para editar,
  // porque esta sincronização roda depois de preencher o formulário, e a cada
  // troca de tempo depois de já ter marcado a caixa.
  const sincronizarRitualComTempo = () => {
    const selectTempo = document.getElementById('mc-tempo');
    const inputTempo = document.getElementById('mc-tempo-personalizado');
    const ritual = document.getElementById('mc-ritual');
    if (!selectTempo || !inputTempo || !ritual) return;
    const tempo = selectTempo.value === '__personalizado__' ? inputTempo.value : selectTempo.value;
    if (/\britual\b/i.test(tempo || '')) ritual.checked = true;
  };
  document.getElementById('mc-tempo')?.addEventListener('change', sincronizarRitualComTempo);
  document.getElementById('mc-tempo-personalizado')?.addEventListener('input', sincronizarRitualComTempo);
  sincronizarRitualComTempo();

  document.getElementById('btn-salvar-mc')?.addEventListener('click', () => {
    const nome = document.getElementById('mc-nome')?.value?.trim();
    if (!nome) { toast('Informe um nome', 'error'); return; }

    const valorSelecionado = (selectId, personalizadoId) => {
      const selecionado = document.getElementById(selectId)?.value || '';
      return (selecionado === '__personalizado__'
        ? document.getElementById(personalizadoId)?.value
        : selecionado)?.trim() || '';
    };
    const escola = valorSelecionado('mc-escola', 'mc-escola-personalizada');
    const tempoBase = valorSelecionado('mc-tempo', 'mc-tempo-personalizado');
    // O gatilho da Reação faz parte do TEMPO DE CONJURAÇÃO, no formato
    // "Reação, <gatilho>" -- é assim que o livro escreve (PHB 2024,
    // Magias.md) e é exatamente o formato que o caminho de EDIÇÃO deste
    // mesmo formulário sabe reler para o campo (ver o `matchReacao` acima).
    // Só a gravação não lia o campo: o jogador digitava o gatilho e ele
    // morria no DOM ao salvar.
    const gatilhoReacao = /^rea[cç][aã]o$/i.test(tempoBase)
      ? (document.getElementById('mc-gatilho-reacao')?.value?.trim() || '')
      : '';
    const tempoConjuracao = gatilhoReacao ? `${tempoBase}, ${gatilhoReacao}` : tempoBase;
    if (!tempoConjuracaoMagiaValido(tempoConjuracao)) {
      toast('Informe um tempo de conjuração válido para uma magia (por exemplo: Ação, Ação Bônus, Reação, 1 minuto ou 1 hora).', 'error');
      return;
    }
    const alcance = document.getElementById('mc-alcance')?.value?.trim() || '';
    const componentesBase = ['v', 's', 'm']
      .filter(letra => document.getElementById(`mc-comp-${letra}`)?.checked)
      .map(letra => letra.toUpperCase());
    const outroComponente = document.getElementById('mc-comp-outro')?.value?.trim() || '';
    const componentes = [...componentesBase, outroComponente].filter(Boolean).join(', ');
    const duracaoSelecionada = document.getElementById('mc-duracao')?.value || '';
    const quantidadeDuracao = document.getElementById('mc-duracao-quantidade')?.value?.trim() || '';
    const unidadeDuracao = document.getElementById('mc-duracao-unidade')?.value || '';
    const textoDuracao = document.getElementById('mc-duracao-texto')?.value?.trim() || '';
    const duracao = duracaoSelecionada === '__personalizado__'
      ? [quantidadeDuracao && `${quantidadeDuracao} ${unidadeDuracao}`, textoDuracao].filter(Boolean).join(', ')
      : duracaoSelecionada;

    const obrigatorios = [
      ['escola', escola], ['tempo de conjuração', tempoConjuracao], ['alcance', alcance],
      ['componentes', componentes], ['duração', duracao]
    ];
    const faltante = obrigatorios.find(([, valor]) => !valor);
    if (faltante) { toast(`Informe ${faltante[0]}`, 'error'); return; }

    if (!char.magias_customizadas) char.magias_customizadas = [];
    const magiaSalva = {
      nome,
      circulo: parseInt(document.getElementById('mc-circulo')?.value) || 0,
      escola,
      tempo_conjuracao: tempoConjuracao,
      alcance,
      componentes,
      duracao,
      descricao: document.getElementById('mc-desc')?.value || '',
      dano: document.getElementById('mc-dano')?.value || '',
      ritual: Boolean(document.getElementById('mc-ritual')?.checked)
    };
    const nomeAnterior = magiaExistente?.nome;
    const circuloAnterior = magiaExistente ? (Number(magiaExistente.circulo) || 0) : null;
    if (magiaExistente) char.magias_customizadas[indiceEdicao] = magiaSalva;
    else char.magias_customizadas.push(magiaSalva);
    const identidadeMudou = Boolean(magiaExistente) && (nomeAnterior !== magiaSalva.nome || circuloAnterior !== magiaSalva.circulo);
    // Issue #42: o contorno que empurrava a magia recém-criada direto para
    // char.grimorio -- pulando o custo de cópia (50 PO / 2h por círculo)
    // que toda outra magia do grimório paga -- foi removido daqui. Ele
    // nasceu para escapar do MESMO beco que as issues #27/#33 descrevem:
    // antes da Tarefa 6 daquele sub-projeto, a grade de círculos do Mago só
    // listava o que estava em char.grimorio, e a magia customizada não
    // tinha NENHUM caminho para ser preparada. Com mostrarBuscaMagia lendo
    // char.magias_customizadas direto (Tarefa 6) e o portão do grimório
    // isento para magia personalizada (a checagem `!ehPersonalizada`, mais
    // abaixo neste arquivo, dentro de mostrarBuscaMagia), o beco não existe
    // mais -- a magia customizada segue o caminho normal: nasce FORA do
    // grimório, e só entra nele se o jogador pagar a cópia pelo botão "+
    // Copiar Magia para Grimório" (mostrarBuscaGrimorio, logo abaixo, que
    // agora também lista a magia personalizada como copiável).
    //
    // O que continua aqui: se essa magia JÁ estava no grimório por cópia
    // legítima (o jogador pagou por ela antes de vir editar), a edição não
    // pode deixar uma entrada órfã presa no nome/círculo antigo -- ela
    // acompanha a identidade nova, ou sai do grimório se a edição tirou a
    // magia de círculo (virou truque).
    //
    // ACHADO da revisão (issue #42, rodada 1): `char.grimorio` guarda só
    // `{nome, circulo}` -- a mesma limitação estrutural "uma vaga por nome"
    // que `ehCopiaJaNoGrimorio` documenta lá em cima (mostrarBuscaMagia).
    // Buscar a entrada antiga sem checar DE QUEM ela é corre o risco de
    // casar com a magia ERRADA.
    //
    // RODADA 1 perguntava "existe magia do ACERVO com este NOME?" e
    // recusava mexer se sim. ERRADO (achado da rodada 2): essa é uma
    // pergunta de EXISTÊNCIA DE NOME, não de POSSE DA ENTRADA -- ela
    // recusava até quando a entrada do grimório É da personalizada de
    // verdade (paga por 50 PO, pelo botão "+ Copiar Magia para Grimório",
    // que este mesmo sub-projeto abriu para magia personalizada, em
    // mostrarBuscaGrimorio, abaixo). Repro: Mago cria "Bola de Fogo"
    // personalizada de 1º círculo, paga a cópia (grimório vira
    // `[{nome:'Bola de Fogo', circulo:1}]`), renomeia para "Chama Azul" --
    // a rodada 1 recusava mexer (existe "Bola de Fogo" no acervo, só que
    // de OUTRO círculo), deixando a entrada PAGA órfã sob o nome morto, e
    // um toast de sucesso ("atualizada!") mentindo que deu tudo certo.
    //
    // RODADA 2: a pergunta certa é de POSSE, e o melhor sinal disponível
    // sem reestruturar `char.grimorio` (fora do escopo desta tarefa) é
    // NOME + CÍRCULO juntos, não nome sozinho. Toda sincronização
    // bem-sucedida deste bloco deixa o círculo gravado no grimório IGUAL
    // ao círculo então-atual da personalizada -- então uma entrada com o
    // NOME antigo E o CÍRCULO antigo (`circuloAnterior`, já calculado
    // acima) só pode ser desta personalizada, A MENOS que o acervo tenha
    // uma magia com o MESMO nome E o MESMO círculo (colisão dupla: rara,
    // mas possível -- o jogador escolheu de propósito nome e círculo
    // iguais aos do livro). Só nesse caso nome+círculo não bastam para
    // decidir, e a saída não é adivinhar: é DIZER ao jogador que não deu
    // para confirmar sozinho (toast de aviso, `grimorioAmbiguo` abaixo --
    // nunca um "atualizada!" silencioso escondendo a dúvida).
    //
    // Índice do acervo indisponível (`getIndiceMagias()` falhou e não há
    // cache -- MINOR da rodada 2, mesma predicada) conta como "não
    // consigo confirmar que NÃO é do acervo", não como "não é do acervo":
    // falha FECHADA (avisa o jogador), nunca aberta (sincroniza sem
    // checar).
    let grimorioAmbiguo = false;
    if (identidadeMudou && nomeAnterior && Array.isArray(char.grimorio)) {
      const idxProvavel = char.grimorio
        .findIndex(m => m?.nome === nomeAnterior && Number(m?.circulo) === circuloAnterior);
      if (idxProvavel >= 0) {
        const indiceConfiavel = magiasIndice.length > 0;
        const podeSerTambemDoAcervo = !indiceConfiavel || magiasIndice
          .some(m => m?.nome === nomeAnterior && Number(m?.circulo) === circuloAnterior && (m.classes || []).includes('Mago'));
        if (podeSerTambemDoAcervo) {
          grimorioAmbiguo = true;
        } else if (magiaSalva.circulo > 0) {
          char.grimorio[idxProvavel] = { nome: magiaSalva.nome, circulo: magiaSalva.circulo };
        } else {
          char.grimorio.splice(idxProvavel, 1);
        }
      }
      // Sem candidato com nome E círculo batendo: ou a magia nunca foi
      // copiada (nada a sincronizar, correto), ou só existe uma entrada do
      // acervo de OUTRO círculo (não mexe -- entrada paga intacta).
    }
    if (magiaExistente && nomeAnterior) {
      const idxPrep = (char.magias_preparadas || []).findIndex(m => m?.personalizada && m.nome === nomeAnterior);
      if (idxPrep >= 0) {
        if (magiaSalva.circulo > 0) {
          char.magias_preparadas[idxPrep] = { ...char.magias_preparadas[idxPrep], nome: magiaSalva.nome, circulo: magiaSalva.circulo };
        } else {
          char.magias_preparadas.splice(idxPrep, 1);
        }
      }
    }
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    // `grimorioAmbiguo` (issue #42, rodada 2): quando o bloco acima não
    // consegue confirmar se a entrada do grimório com o nome antigo é
    // desta personalizada ou de uma homônima do acervo, ele não mexe em
    // nada -- e o jogador precisa SABER disso, não ler "atualizada!" como
    // se o grimório tivesse acompanhado o rename. Tela mentindo por
    // silêncio é exatamente o que esta rodada existe para evitar.
    toast(
      `${nome} ${magiaExistente ? 'atualizada' : 'adicionada'}!` + (grimorioAmbiguo
        ? ' Não deu para confirmar se a entrada do grimório com o nome antigo era desta magia ou de uma homônima do acervo -- confira o Grimório manualmente.'
        : ''),
      grimorioAmbiguo ? 'warning' : 'success'
    );
  });
}

/** Busca de magia para copiar no Grimório do Mago */
export async function mostrarBuscaGrimorio() {
  const indice = await getIndiceMagias();
  const magiasDoAcervo = (indice?.magias || []).filter(m => m.circulo > 0 && (m.classes || []).includes('Mago'));
  // Magias PERSONALIZADAS de círculo (issue #42): com o contorno que as
  // empurrava sozinhas para char.grimorio removido (mostrarFormMagiaCustom,
  // acima), a magia customizada só chega ao grimório por AQUI -- por isso
  // ela precisa entrar na lista de copiáveis, pagando o mesmo custo (50 PO
  // / 2h por círculo) que qualquer magia do acervo. Sem `classes[]` -- o
  // formulário de criação não pede essa informação, magia personalizada é
  // escolha do jogador, não concessão de uma classe do livro -- não há
  // filtro de classe a aplicar aqui: toda magia customizada de círculo do
  // personagem entra.
  const personalizadas = (char.magias_customizadas || [])
    .filter(m => Number(m?.circulo) > 0)
    .map(m => ({ ...m, circulo: Number(m.circulo) }));
  const magias = [...magiasDoAcervo, ...personalizadas];
  // Achado da revisao de branch (Important 2, sub-projeto 4): esta linha
  // era o ULTIMO leitor vivo da forma ANTIGA de char.espacos_magia
  // ({circulo: {total, usados}}) -- o ramo `: (char.espacos_magia || {})`
  // so era alcancado quando `classeData?.tabela_caracteristicas` faltasse,
  // o que nao acontece para nenhuma classe valida (o primeiro ramo sempre
  // vencia). Convertido para o mesmo acessador derivado que o resto da
  // ficha usa (reservasDeEspacos, sheet/reservas-espacos.js) -- sem
  // fallback para a forma antiga, e sem depender de `char.nivel` (nivel
  // TOTAL do personagem) contra a tabela da PROPRIA classe, que divergiria
  // do nivel de conjurador correto para um Mago multiclasse.
  const circulosPreparaveis = new Set(
    reservasDeEspacos().filter(r => r.total > 0).map(r => r.circulo)
  );

  abrirModal('Copiar Magia para o Grimório', `
    <div class="info-box warning" style="margin-bottom:8px">
      <strong>Custo:</strong> 50 PO por círculo da magia | <strong>Tempo:</strong> 2h por círculo<br>
      <small id="grimorio-carteira-disponivel">Disponível: ${formatarCarteira(char.moedas)}</small>
    </div>
    <div class="search-box"><input type="text" id="busca-grimorio" placeholder="Buscar magia de Mago..." class="form-input" autofocus></div>
    <div id="resultado-grimorio" style="min-height:35dvh;max-height:50dvh;overflow-y:auto"></div>
  `, '', () => renderFichaCompleta());

  const resultadoEl = document.getElementById('resultado-grimorio');
  const circulosExpandidos = new Set();

  function renderGrimorio() {
    const termo = semAcento(document.getElementById('busca-grimorio')?.value || '');
    const jaNoGrimorio = new Set((char.grimorio || []).map(m => m.nome));
    let lista = magias.filter(m => !jaNoGrimorio.has(m.nome) && circulosPreparaveis.has(m.circulo));
    if (termo.length >= 2) lista = lista.filter(m => semAcento(m.nome).includes(termo));
    lista = lista.sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR'));

    if (lista.length === 0) {
      resultadoEl.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:16px">Nenhuma magia encontrada.</div>`;
      return;
    }

    // O limite de itens é por círculo, não no total combinado -- um corte
    // global aqui (ordenado por círculo) já escondeu círculos inteiros: o
    // 1º e o 2º círculo sozinhos passam de 50 magias de Mago, então o corte
    // esgotava antes de chegar a qualquer círculo mais alto, mesmo quando o
    // personagem já podia prepará-lo (achado do debug de 2026-08-08).
    const magiasPorCirculo = new Map();
    lista.forEach(m => {
      if (!magiasPorCirculo.has(m.circulo)) magiasPorCirculo.set(m.circulo, []);
      const doCirculo = magiasPorCirculo.get(m.circulo);
      if (doCirculo.length < 50) doCirculo.push(m);
    });

    resultadoEl.innerHTML = [...magiasPorCirculo.entries()].map(([circulo, magiasDoCirculo]) => `
      <details data-grimorio-circulo="${circulo}" ${termo.length >= 2 || circulosExpandidos.has(circulo) ? 'open' : ''} style="margin:8px 0">
        <summary class="section-divider" style="margin:0;cursor:pointer"><span>${circulo}º Círculo (${magiasDoCirculo.length})</span></summary>
        ${magiasDoCirculo.map(m => {
      const custo = m.circulo * 50;
      const temPO = podePagar(char.moedas, custo * VALOR_EM_COBRE.po);
      // escHtml em nome/escola (issue #42): a lista agora mistura o acervo
      // (JSON confiável) com magia PERSONALIZADA (texto livre do jogador,
      // vindo de char.magias_customizadas) -- sem escapar, um nome com `"`
      // quebraria o atributo `data-grim-nome` e um nome/escola com `<`
      // entraria como HTML.
      return `
      <div class="magia-item" style="cursor:pointer${!temPO ? ';opacity:0.5' : ''}" data-grim-nome="${escHtml(m.nome)}" data-grim-circ="${m.circulo}" data-grim-custo="${custo}">
        <div class="magia-nome">${escHtml(m.nome)}</div>
        <div class="magia-meta">
          <span>${m.circulo}º Círculo</span>
          <span>${escHtml(m.escola)}</span>
          <span style="font-weight:600;color:${temPO ? 'var(--success)' : 'var(--danger)'}">Custo: ${custo} PO</span>
        </div>
      </div>`;
    }).join('')}
      </details>`).join('');

    resultadoEl.querySelectorAll('[data-grimorio-circulo]').forEach(grupo => {
      grupo.addEventListener('toggle', () => {
        const circulo = Number(grupo.dataset.grimorioCirculo);
        if (grupo.open) circulosExpandidos.add(circulo);
        else circulosExpandidos.delete(circulo);
      });
    });

    resultadoEl.querySelectorAll('[data-grim-nome]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.grimNome;
        const circ = parseInt(el.dataset.grimCirc);
        const custo = parseInt(el.dataset.grimCusto);
        const custoCobre = custo * VALOR_EM_COBRE.po;
        if (!circulosPreparaveis.has(circ)) {
          toast('Seu Mago ainda não pode preparar magias desse círculo.', 'error');
          return;
        }
        if (!podePagar(char.moedas, custoCobre)) {
          toast(`PO insuficiente! Necessário: ${custo} PO`, 'error');
          return;
        }
        if (!char.grimorio) char.grimorio = [];
        char.grimorio.push({ nome, circulo: circ });
        char.moedas = retirarValor(char.moedas, custoCobre).moedas;
        salvar();
        const carteiraEl = document.getElementById('grimorio-carteira-disponivel');
        if (carteiraEl) carteiraEl.textContent = `Disponível: ${formatarCarteira(char.moedas)}`;
        renderGrimorio();
        toast(`${nome} copiada para o grimório! (-${custo} PO)`, 'success');
      });
    });
  }

  document.getElementById('busca-grimorio')?.addEventListener('input', renderGrimorio);
  renderGrimorio();
}

// A funcao `mostrarTrocaMagias` vivia aqui: o modal que abria a lista INTEIRA
// de magias para remontar as preparadas de uma vez. Removida em 2026-08-19,
// quando a regra de troca foi uniformizada (ver site/js/regras-preparo-magias.js):
// no Descanso Longo troca-se UMA magia, para toda classe conjuradora, e
// remontar a lista passou a ser da subida de nivel -- que faz isso com trocas
// sucessivas, no assistente, e nao com este modal.
//
// Ela ficou sem nenhum chamador. Nao foi deixada como codigo morto de
// proposito: 257 linhas que implementam exatamente o comportamento que
// acabou de ser removido sao um convite a religar sem querer, e nenhum teste
// pegaria isso -- os oraculos novos cobrem a REGRA e o modal de troca unica,
// nao a existencia deste. Se a lista completa voltar a ser necessaria, ela
// volta pelo historico do git, com a decisao registrada junto.


/** Modal de troca de 1 magia conhecida (Descanso Longo - Bardo, Feiticeiro, Bruxo, subclasses conjuradoras) */
/**
 * Abre modal para o jogador escolher uma magia conhecida que preencha um slot
 * liberado pelo ajuste automático (bug de magia passiva selecionada manualmente).
 */
export async function abrirPreenchimentoSlotMagia(tipo = 'magia') {
  const ehTruque = tipo === 'truque';
  const sup = superficieAtiva();

  // A vaga livre (char._slots_truque_livre/_magia_livre) e calculada por
  // migrarSlotsMagiaLivre (sheet/migracoes.js) SEMPRE contra a PRIMEIRA
  // superficie de conjuracao (a classe inicial) -- deliberado, roda antes
  // do primeiro render, e nao deve mudar com o seletor de classe (Tarefa
  // 4): o migrador fica preso a primeira superficie de proposito (ver o
  // comentario dele). Antes do seletor existir, superficieAtiva() SEMPRE
  // era essa primeira superficie -- as duas nunca podiam divergir.
  //
  // Agora podem: um Bardo (inicial)/Feiticeiro (segunda), os dois de
  // magias "conhecidas", pode trocar a aba do seletor para o Feiticeiro e
  // preencheria a vaga que o DEFICIT DO BARDO abriu com uma magia de
  // FEITICEIRO -- gravacao contra o orcamento da classe ERRADA. A trava
  // fica AQUI, nao no migrador: so a PRIMEIRA superficie (a mesma para a
  // qual a vaga foi calculada) pode preenche-la; qualquer outra recusa com
  // um toast, antes de sequer montar a lista de candidatas.
  const primeiraSuperficie = superficiesDaFicha(char)[0] || null;
  if (sup && primeiraSuperficie && sup.classe !== primeiraSuperficie.classe) {
    toast(`Troque para a aba de ${primeiraSuperficie.classe} para preencher essa vaga.`, 'error');
    return;
  }

  const subConj = subConjDaSuperficie(sup);
  const espacosNivel = espacosDaSuperficie(sup, subConj);
  const maxCirculo = Math.max(...Object.keys(espacosNivel).map(Number), 0);

  const magiasClasse = sup
    ? await obterMagiasDisponiveisClasseAtual({ classe: sup.classe, subclasse: sup.subclasse, nivel: sup.nivelClasse })
    : [];
  const sempreNomes = new Set((magiasSempreCache || []).map(m => m.nome));
  const dominioNomes = new Set((magiasDominioCache || []).map(m => m.nome));
  // Truques vivem em magias_conhecidas; magias de círculo, em magias_preparadas.
  const jaTem = (ehTruque ? char.magias_conhecidas : char.magias_preparadas) || [];
  const jaTemSet = new Set(jaTem.map(m => m.nome));

  const disponiveis = magiasClasse.filter(m =>
    (ehTruque ? m.circulo === 0 : (m.circulo > 0 && m.circulo <= maxCirculo)) &&
    !jaTemSet.has(m.nome) &&
    !sempreNomes.has(m.nome) &&
    !dominioNomes.has(m.nome)
  ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  let magiaSelecionada = null;
  let circuloSelecionado = null;

  abrirModal(ehTruque ? 'Escolher Truque' : 'Escolher Magia Conhecida', `
    <div class="info-box info" style="margin-bottom:12px;font-size:0.85rem">
      ${ehTruque
        ? 'Você tem uma vaga de <strong>truque</strong> em aberto para o seu nível. Escolha o truque que faltava.'
        : 'Você tem uma vaga de <strong>magia conhecida</strong> em aberto para o seu nível. Escolha uma magia para preenchê-la.'}
    </div>
    <div class="search-box" style="margin-bottom:8px">
      <input type="text" id="busca-preencher-slot" placeholder="Buscar magia..." class="form-input">
    </div>
    <div id="resultado-preencher-slot" style="max-height:40vh;overflow-y:auto;margin-bottom:8px"></div>
    <div style="font-size:0.85rem;color:var(--text-muted)">
      Selecionada: <strong id="preencher-slot-nome" style="color:var(--accent)">—</strong>
    </div>
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
     <button class="btn btn-primary" id="btn-confirmar-preencher" disabled>Confirmar</button>`);

  const resultadoEl = document.getElementById('resultado-preencher-slot');
  const confirmarBtn = document.getElementById('btn-confirmar-preencher');

  function renderLista() {
    const termo = semAcento(document.getElementById('busca-preencher-slot')?.value || '');
    let filtradas = disponiveis;
    if (termo.length >= 2) filtradas = disponiveis.filter(m => semAcento(m.nome).includes(termo));
    filtradas = filtradas.sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR'));

    const porCirculo = filtradas.reduce((acc, m) => { if (!acc[m.circulo]) acc[m.circulo] = []; acc[m.circulo].push(m); return acc; }, {});
    resultadoEl.innerHTML = Object.entries(porCirculo).map(([circ, magias]) => `
      <div style="margin-bottom:8px">
        <div style="font-size:0.78rem;font-weight:700;color:var(--accent);padding:4px 0 2px;border-bottom:1px solid var(--border-color);margin-bottom:6px">${circ === '0' ? 'Truques' : `${circ}\u00ba C\u00edrculo`}</div>
        <div class="opcao-grid densa">${magias.map(m => `
          <div class="opcao-card ${m.nome === magiaSelecionada ? 'selecionada' : ''}"
               data-preencher-nome="${m.nome}" data-preencher-circ="${m.circulo}" style="cursor:pointer">
            <span class="opcao-check"></span>
            <div class="opcao-nome" data-preencher-detalhe="${m.nome}" data-preencher-detalhe-circ="${m.circulo}" style="cursor:pointer">${m.nome}</div>
            <div class="opcao-resumo">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
            </div>
          </div>
        `).join('')}</div>
      </div>
    `).join('');

    resultadoEl.querySelectorAll('[data-preencher-nome]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-preencher-detalhe]')) return;
        magiaSelecionada = el.dataset.preencherNome;
        circuloSelecionado = parseInt(el.dataset.preencherCirc);
        document.getElementById('preencher-slot-nome').textContent = magiaSelecionada;
        confirmarBtn.disabled = false;
        renderLista();
      });
    });

    resultadoEl.querySelectorAll('[data-preencher-detalhe]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = btn.dataset.preencherDetalhe;
        const circ = parseInt(btn.dataset.preencherDetalheCirc);
        const dados = await getMagiasPorCirculo(circ);
        const magia = dados?.magias?.find(m => m.nome === nome);
        if (!magia) return;
        abrirModal(magia.nome, `
          <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
            <span class="badge badge-primary">${circ}\u00ba Circulo</span>
            <span class="badge badge-secondary">${magia.escola}</span>
            <span>${magia.tempo_conjuracao}</span> <span>${magia.alcance}</span>
            <span>${magia.componentes}</span> <span>${magia.duracao}</span>
          </div>
          <div class="md-content">${mdParaHtml(magia.descricao)}</div>
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em circulos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
        `, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
      });
    });
  }

  document.getElementById('busca-preencher-slot')?.addEventListener('input', renderLista);

  confirmarBtn?.addEventListener('click', () => {
    if (!magiaSelecionada) return;
    if (ehTruque) {
      if (!char.magias_conhecidas) char.magias_conhecidas = [];
      char.magias_conhecidas.push({ nome: magiaSelecionada, circulo: 0 });
      char._slots_truque_livre = Math.max(0, (char._slots_truque_livre || 1) - 1);
      if (char._slots_truque_livre === 0) delete char._slots_truque_livre;
    } else {
      if (!char.magias_preparadas) char.magias_preparadas = [];
      // sup?.classe: a guarda no topo desta funcao ja garante que sup e a
      // PRIMEIRA superficie (a dona da vaga liberada) antes de chegar aqui.
      char.magias_preparadas.push({ nome: magiaSelecionada, circulo: circuloSelecionado, ...(sup?.classe ? { classe: sup.classe } : {}) });
      char._slots_magia_livre = Math.max(0, (char._slots_magia_livre || 1) - 1);
      if (char._slots_magia_livre === 0) delete char._slots_magia_livre;
    }
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${magiaSelecionada} adicionad${ehTruque ? 'o como truque' : 'a como magia conhecida'}`, 'success');
  });

  renderLista();
}

/**
 * Modal de troca de UMA magia conhecida/preparada -- usado pela troca do
 * Descanso Longo (uma por classe conjuradora, Tarefa 3 deste sub-projeto)
 * e pela Memorizar Magia do Mago (Descanso Curto, nível 5).
 *
 * @param {Function|null} [callbackPosTroca] Chamado ao fechar o modal
 *   (trocou ou não -- inclusive "Não Trocar"). Sem ele, re-renderiza a
 *   ficha inteira.
 * @param {object} [opcoes]
 * @param {string} [opcoes.titulo] Título do modal. Sem ele, o padrão
 *   depende de `opcoes.classe` (ver abaixo).
 * @param {string} [opcoes.explicacao] Texto do aviso no topo do modal
 *   (HTML). Sem ele, o padrão depende de `opcoes.classe` (ver abaixo).
 * @param {string} [opcoes.classe] Nome da classe desta troca (Tarefa 2 do
 *   sub-projeto 2026-08-29-troca-por-classe-descanso). Resolve a
 *   superfície de conjuração por ELA (`superficieDaTroca`, acima), em vez
 *   da superfície ATIVA do seletor compartilhado da ficha -- para a
 *   Tarefa 3 poder abrir esta modal em cadeia, uma por classe conjuradora,
 *   sem mexer na aba que o jogador escolheu. SEM `opcoes.classe`, o
 *   comportamento é IDÊNTICO ao de antes desta tarefa (superfície ativa).
 *   COM `opcoes.classe`, e sem `opcoes.titulo`/`opcoes.explicacao`
 *   próprios, o título e a explicação passam a NOMEAR a classe -- numa
 *   cadeia de duas modais, dois modais idênticos seguidos são piores que
 *   um só (o jogador não sabe qual é qual).
 */
export async function mostrarTrocaMagiaConhecida(callbackPosTroca = null, opcoes = {}) {
  const sup = superficieDaTroca(char, opcoes.classe);
  const subConj = subConjDaSuperficie(sup);

  // Espacos de magia para determinar circulos disponiveis
  const espacosNivel = espacosDaSuperficie(sup, subConj);
  const maxCirculo = Math.max(...Object.keys(espacosNivel).map(Number), 0);

  // Magias conhecidas atuais, candidatas a SAIR na troca (Tarefa 4): `desta`
  // ∪ `semClasse` da superfície ativa -- NUNCA `deOutra`. Sem este filtro,
  // um Clérigo 5/Mago 1 trocando pelo Descanso Longo com o Mago como
  // superfície ativa via TODAS as preparadas do Clérigo como candidatas a
  // sair, movendo uma magia do orçamento do Clérigo para o do Mago em
  // silêncio -- o mesmo achado roteado da Tarefa 2 para "qual magia sai?"
  // da subida de nível (levelup-ui.js). Para classe única `deOutra` é
  // sempre vazio -- nada muda para a maioria dos personagens.
  const { desta: preparadasDesta, semClasse: preparadasSemClasse } = preparadasPorClasse(char, sup?.classe);
  const magiasAtuais = [...preparadasDesta, ...preparadasSemClasse].filter(m => m.circulo > 0);

  if (magiasAtuais.length === 0) {
    toast('Nenhuma magia conhecida para trocar', 'error');
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
    return;
  }

  // Fonte do lado "entra": o MAGO so pode preparar o que esta no proprio
  // grimorio -- preparar magia fora dele contradiz normalizarGrimorioMago
  // (utils.js), o modal de lista completa (mostrarTrocaMagias, acima) e o card
  // de troca da subida de nivel (levelup-ui.js), que ja tratavam disso.
  //
  // Esta guarda nasceu de uma REGRESSAO: ate 2026-08-19 este modal so era
  // usado por classes de magias conhecidas (Bardo, Bruxo, Feiticeiro) e pelas
  // subclasses conjuradoras -- nenhuma tem grimorio --, entao a lista da
  // classe bastava. Ao uniformizar a troca do Descanso Longo em UMA para todo
  // mundo, o Mago passou por aqui e ganhou de brinde a possibilidade de
  // preparar magia que nao esta no livro dele.
  const ehMago = !!sup?.usaGrimorio;
  const magiasClasse = ehMago
    ? (char.grimorio || []).map(m => ({ ...m }))
    : sup
      ? await obterMagiasDisponiveisClasseAtual({ classe: sup.classe, subclasse: sup.subclasse, nivel: sup.nivelClasse })
      : [];

  // Magias PERSONALIZADAS de círculo 1+ no lado "ENTRA" (lacuna das issues
  // #27/#33 para as classes de magias CONHECIDAS). Esta lista vinha só da
  // classe (ou do grimório), e `char.magias_customizadas` nunca era lido
  // aqui -- era a segunda e última porta que Bardo, Bruxo, Feiticeiro e as
  // subclasses conjuradoras têm, e ela também não enxergava a magia do
  // jogador.
  //
  // É o caminho de quem está NO LIMITE: com a lista cheia, o cartão da
  // grade do modal "+ Magia" sai bloqueado e o portão recusa o clique -- a
  // troca do Descanso Longo é o direito que o jogador já tem para abrir
  // vaga. Sem isto, ele não tinha vaga nenhuma para dar à magia que
  // inventou.
  //
  // MAGO FICA DE FORA de propósito (`ehMago ? []`), e não por esquecimento:
  // a magia personalizada dele já chega aqui pelo `char.grimorio`, acima --
  // e SÓ se ele tiver pago a cópia, que é a decisão da issue #42 e não pode
  // ser desfeita por esta correção. Somá-la de novo desenharia o cartão
  // DUPLICADO, o mesmo par que `ehCopiaJaNoGrimorio` desfaz na grade do
  // modal "+ Magia". O portão fica AQUI, no ponto de chamada, e não dentro
  // de `personalizadasDeCirculoDaFicha` (topo do arquivo): a lista em si é a
  // mesma das duas telas -- só esta tem a regra do grimório.
  const personalizadasDeCirculo = ehMago ? [] : personalizadasDeCirculoDaFicha(char);
  // Homônima NÃO é deduplicada: a "Bênção" do jogador e a "Bênção" do
  // acervo são magias diferentes, e as duas têm cartão -- mesma regra da
  // grade do modal "+ Magia". Quem as separa é `jaTemSet`, abaixo: com uma
  // das duas já conhecida, as DUAS somem da lista, porque
  // `magias_preparadas[]` é indexada por nome no app inteiro e só há uma
  // vaga por nome.
  const magiasCandidatas = [...magiasClasse, ...personalizadasDeCirculo];
  const jaTemSet = new Set((char.magias_preparadas || []).map(m => m.nome));

  let magiaRemover = null;
  let magiaAdicionar = null;
  let circuloAdicionar = null;
  // Qual dos cartões homônimos foi escolhido -- o nome sozinho não
  // responde. Ver o gravador, no "Confirmar troca" ao fim desta função.
  let personalizadaAdicionar = false;

  const nomeClasse = sup ? (subConj ? `${sup.classe} (${sup.subclasse})` : sup.classe) : char.classe;

  // Titulo e explicacao sao parametrizaveis porque este modal serve a DUAS
  // regras diferentes: a troca do Descanso Longo (uma magia, para toda classe
  // conjuradora) e a Memorizar Magia do Mago (nivel 5, Descanso CURTO, "uma
  // magia preparada por outra do seu livro"). O mecanismo e o mesmo -- trocar
  // UMA --, so o texto muda.
  //
  // `opcoes.classe` (Tarefa 2): quando a T3 abre este modal em CADEIA (uma
  // por classe conjuradora), dois modais com titulo e explicacao IDENTICOS
  // seguidos sao piores que um so -- o jogador nao sabe qual e qual. Por
  // isso, com `opcoes.classe` e SEM titulo/explicacao proprios, os
  // padroes passam a nomear a classe. Sem `opcoes.classe` os padroes sao
  // OS MESMOS de antes desta tarefa. Ha TRES chamadores hoje: dois passam
  // titulo/explicacao proprios (hp-descanso.js:901, habilidades.js:2125,
  // ambos fora do fluxo de Descanso Longo) e nem chegam a usar este
  // padrao; o terceiro e a cadeia do Descanso Longo (hp-descanso.js,
  // dentro do map de PASSOS), que usa o padrao nos DOIS ramos --
  // com `opcoes.classe` (multiclasse) e sem ele (classe unica).
  const explicacaoPadrao = opcoes.classe
    ? `<strong>${escHtml(nomeClasse)}:</strong> apos um Descanso Longo, voce pode trocar <strong>1 magia ${ehMago ? 'preparada' : 'conhecida'}</strong> por outra ${ehMago ? 'do seu livro de magias' : `da lista de ${nomeClasse}`}.`
    : `Apos um Descanso Longo, voce pode trocar <strong>1 magia ${ehMago ? 'preparada' : 'conhecida'}</strong> por outra ${ehMago ? 'do seu livro de magias' : `da lista de ${nomeClasse}`}.`;
  const titulo = opcoes.titulo || (opcoes.classe ? `Trocar Magia Conhecida — ${nomeClasse}` : 'Trocar Magia Conhecida');
  const explicacao = opcoes.explicacao || explicacaoPadrao;

  abrirModal(titulo, `
    <div class="info-box info" style="margin-bottom:12px;font-size:0.85rem">
      ${explicacao}
    </div>

    <div style="margin-bottom:12px">
      <label class="form-label" style="font-weight:700;color:var(--accent)">Magia a remover:</label>
      <div id="troca-conhecida-remover-lista" style="margin-bottom:4px"></div>
    </div>

    <div id="troca-conhecida-adicionar-container" style="display:none">
      <label class="form-label" style="font-weight:700;color:var(--accent)">Nova magia:</label>
      <div class="search-box" style="margin-bottom:8px"><input type="text" id="busca-troca-conhecida" placeholder="Buscar magia..." class="form-input"></div>
      <div id="resultado-troca-conhecida" style="max-height:35vh;overflow-y:auto;margin-bottom:8px"></div>
      <div style="font-size:0.85rem;color:var(--text-muted)">
        Selecionada: <strong id="troca-conhecida-nome" style="color:var(--accent)">\u2014</strong>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
     <button class="btn btn-secondary" id="btn-pular-troca-conhecida">Nao Trocar</button>
     <button class="btn btn-primary" id="btn-confirmar-troca-conhecida" disabled>Confirmar Troca</button>`);

  const containerAdicionar = document.getElementById('troca-conhecida-adicionar-container');
  const resultadoEl = document.getElementById('resultado-troca-conhecida');
  const confirmarBtn = document.getElementById('btn-confirmar-troca-conhecida');

  function renderListaSubstituta() {
    const termo = semAcento(document.getElementById('busca-troca-conhecida')?.value || '');
    // Filtrar magias da classe que podem ser escolhidas
    let disponiveis = magiasCandidatas.filter(m =>
      m.circulo > 0 && m.circulo <= maxCirculo &&
      !jaTemSet.has(m.nome) && m.nome !== magiaRemover
    );
    if (termo.length >= 2) disponiveis = disponiveis.filter(m => semAcento(m.nome).includes(termo));
    disponiveis = disponiveis.sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR'));

    const porCirculo = disponiveis.reduce((acc, m) => { if (!acc[m.circulo]) acc[m.circulo] = []; acc[m.circulo].push(m); return acc; }, {});
    resultadoEl.innerHTML = Object.entries(porCirculo).map(([circ, magias]) => `
      <div style="margin-bottom:8px">
        <div style="font-size:0.78rem;font-weight:700;color:var(--accent);padding:4px 0 2px;border-bottom:1px solid var(--border-color);margin-bottom:6px">${circ}\u00ba C\u00edrculo</div>
        <div class="opcao-grid densa">${magias.map(m => {
          const ehPersonalizada = !!m.personalizada;
          // Seleção casada por nome E pela marca: com as duas homônimas na
          // lista, comparar só o nome acenderia os DOIS cartões e o jogador
          // não saberia qual escolheu.
          const sel = m.nome === magiaAdicionar && ehPersonalizada === personalizadaAdicionar;
          // escHtml no nome e na escola: esta lista passou a receber magia
          // PERSONALIZADA, e ali os dois campos são texto livre que o
          // jogador digita (o `escola` do formulário tem a opção
          // "Personalizado…", um input sem validação). Mesmo tratamento que
          // a grade do modal "+ Magia" já dá. Vale também para o Mago, cujo
          // `char.grimorio` pode conter a cópia paga de uma magia
          // personalizada (issue #42).
          //
          // O cartão da personalizada TAMBÉM abre detalhes: o handler abaixo
          // ganhou o mesmo plano B da grade do modal "+ Magia"
          // (`magiaPersonalizadaDaFicha`), então o painel não depende mais de
          // o acervo conhecer a magia. Esconder a descrição justo aqui era o
          // pior lugar para esconder -- esta tela é onde o jogador decide em
          // que gastar a ÚNICA troca que tem no Descanso Longo.
          return `
          <div class="opcao-card ${sel ? 'selecionada' : ''}" data-selecionar-troca="${escHtml(m.nome)}" data-selecionar-circ="${m.circulo}"${ehPersonalizada ? ' data-selecionar-personalizada="1"' : ''} style="cursor:pointer">
            <span class="opcao-check"></span>
            <div class="opcao-nome" data-troca-detalhe="${escHtml(m.nome)}" data-troca-detalhe-circ="${m.circulo}" style="cursor:pointer">${escHtml(m.nome)}</div>
            <div class="opcao-resumo">
              <span>${escHtml(m.escola || '')}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
              <!-- Numa lista em que todo o resto veio da lista da classe, o
                   jogador precisa reconhecer a magia que ele mesmo inventou
                   -- mesmo selo da grade do modal "+ Magia" e da ficha. -->
              ${ehPersonalizada ? '<span>Personalizada</span>' : ''}
            </div>
          </div>
        `;
        }).join('')}</div>
      </div>
    `).join('');

    // Selecionar magia substituta
    resultadoEl.querySelectorAll('[data-selecionar-troca]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-troca-detalhe]')) return;
        magiaAdicionar = el.dataset.selecionarTroca;
        circuloAdicionar = parseInt(el.dataset.selecionarCirc);
        personalizadaAdicionar = el.dataset.selecionarPersonalizada === '1';
        document.getElementById('troca-conhecida-nome').textContent = magiaAdicionar;
        confirmarBtn.disabled = false;
        renderListaSubstituta();
      });
    });

    // Detalhes da magia
    resultadoEl.querySelectorAll('[data-troca-detalhe]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = btn.dataset.trocaDetalhe;
        const circ = parseInt(btn.dataset.trocaDetalheCirc);
        const dados = await getMagiasPorCirculo(circ);
        // MESMO PLANO B da grade do modal "+ Magia" (ver
        // `magiaPersonalizadaDaFicha`, topo do arquivo): o acervo é o plano
        // A, e a magia que o jogador inventou não está em arquivo nenhum de
        // dados/. Sem isto, o cartão da personalizada abria o painel com
        // nada -- e é nesta tela que ele decide em que gastar a ÚNICA troca
        // do Descanso Longo.
        const magia = dados?.magias?.find(m => m.nome === nome)
          || magiaPersonalizadaDaFicha(char, nome, circ);
        if (!magia) return;
        // escHtml nos metadados: com o plano B acima, escola, tempo,
        // alcance, componentes e duração podem ser texto livre digitado pelo
        // jogador (os selects do formulário têm a opção "Personalizado…").
        // Mesmo tratamento do painel gêmeo em `mostrarBuscaMagia`. A
        // descrição continua em mdParaHtml, que escapa antes de formatar, e
        // o título passa por `abrirModal`, que já escapa.
        abrirModal(magia.nome, `
          <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
            <span class="badge badge-primary">${circ}\u00ba Circulo</span>
            <span class="badge badge-secondary">${escHtml(magia.escola)}</span>
            <span>${escHtml(magia.tempo_conjuracao)}</span> <span>${escHtml(magia.alcance)}</span>
            <span>${escHtml(magia.componentes)}</span> <span>${escHtml(magia.duracao)}</span>
          </div>
          <div class="md-content">${mdParaHtml(magia.descricao)}</div>
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em circulos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
        `, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
      });
    });
  }

  // Quando selecionar magia a remover
  montarSeletor(document.getElementById('troca-conhecida-remover-lista'), {
    opcoes: deMagias(magiasAtuais),
    densidade: 'densa', max: 1, busca: true,
    aoMudar: (sel) => {
      magiaRemover = sel[0] || null;
      magiaAdicionar = null;
      circuloAdicionar = null;
      personalizadaAdicionar = false;
      document.getElementById('troca-conhecida-nome').textContent = '\u2014';
      confirmarBtn.disabled = true;
      if (magiaRemover) {
        containerAdicionar.style.display = 'block';
        renderListaSubstituta();
      } else {
        containerAdicionar.style.display = 'none';
      }
    },
  });

  // Busca
  document.getElementById('busca-troca-conhecida')?.addEventListener('input', renderListaSubstituta);

  // Nao trocar
  document.getElementById('btn-pular-troca-conhecida')?.addEventListener('click', () => {
    window.fecharModal();
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
  });

  // Confirmar troca
  confirmarBtn?.addEventListener('click', () => {
    if (!magiaRemover || !magiaAdicionar) return;
    const idx = char.magias_preparadas.findIndex(m => m.nome === magiaRemover);
    if (idx >= 0) {
      // Uma troca de magia conhecida e sempre DENTRO da mesma classe: a que
      // entra herda a classe da que saiu. Preferir o carimbo da entrada
      // removida (nao sup?.classe) importa numa ficha MIGRADA -- e nao numa
      // ficha ainda nao migrada, onde a entrada removida nunca tem carimbo
      // proprio para preferir (cai direto no fallback, linha abaixo) --
      // porque e so quando a entrada JA TEM `classe` gravada que ela pode,
      // em tese, divergir de sup?.classe (o seletor da tela); sem essa
      // preferencia, o carimbo trocaria de classe no meio de uma troca que
      // nao mudou de classe nenhuma. So cai para sup?.classe quando a
      // entrada removida nao tem carimbo (ficha ainda nao migrada, ou
      // magia ambigua de multiclasse), e omite se nem isso houver.
      const classeRemovida = char.magias_preparadas[idx]?.classe || sup?.classe || null;
      // QUAL cartão foi escolhido -- não "existe alguma personalizada com
      // este nome?". Com a homônima do acervo na mesma lista, perguntar à
      // ficha por nome+círculo carimbaria a magia do LIVRO como
      // personalizada, e a ficha passaria a renderizar a magia do jogador
      // no lugar da que ele escolheu. Mesma disciplina (e mesma confirmação
      // com lastro em `magias_customizadas`) do gravador da grade do modal
      // "+ Magia": HTML é o que o render acabou de escrever, mas quem grava
      // não aceita marca sem lastro.
      //
      // Sem esta marca a entrada entraria "crua" e a seção de magias da
      // ficha a trataria como magia do acervo -- sem descrição e sem o
      // botão de Conjurar próprio da personalizada, que é justamente a
      // capacidade que as issues #27/#33 pedem.
      const ehPersonalizada = personalizadaAdicionar
        && !!magiaPersonalizadaDaFicha(char, magiaAdicionar, circuloAdicionar);
      char.magias_preparadas.splice(idx, 1);
      char.magias_preparadas.push({
        nome: magiaAdicionar, circulo: circuloAdicionar,
        ...(classeRemovida ? { classe: classeRemovida } : {}),
        ...(ehPersonalizada ? { personalizada: true } : {})
      });
      salvar();
      toast(`Trocou ${magiaRemover} por ${magiaAdicionar}`, 'success');
    }
    window.fecharModal();
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
  });
}

// A lista de truques não trocáveis mora em regras-origens-magia.js, a fonte
// única das origens que o jogador não escolheu. Ela vivia copiada aqui e em
// mais três lugares, e as quatro cópias divergiam -- o comentário que ficava
// aqui pedia que "as três precisem concordar", e elas não concordavam.

/** Lista os truques de classe do personagem que podem entrar numa troca */
export function truquesTrocaveis() {
  return (char?.magias_conhecidas || [])
    .filter(m => m.circulo === 0 && truqueEhTrocavel(m));
}

/**
 * Modal de troca de 1 truque no Descanso Longo.
 *
 * Decisao do dono do produto (2026-08-13): toda classe conjuradora pode
 * trocar truque tanto no Descanso Longo quanto ao subir de nivel. Antes o
 * Descanso Longo nao oferecia troca de truque para NINGUEM (hp-descanso.js
 * so tratava magias), e a troca de truque so existia no level-up
 * (levelup-cards.js/levelup-ui.js). Espelha mostrarTrocaMagiaConhecida
 * acima, restrito a circulo 0 e sem limite de circulo maximo.
 *
 * @param {Function|null} [callbackPosTroca] Chamado ao fechar o modal
 *   (trocou ou não -- inclusive "Não Trocar"). Sem ele, re-renderiza a
 *   ficha inteira.
 * @param {object} [opcoes]
 * @param {string} [opcoes.classe] Nome da classe desta troca (Tarefa 2 do
 *   sub-projeto 2026-08-29-troca-por-classe-descanso). Resolve a
 *   superfície de conjuração por ELA (`superficieDaTroca`), em vez da
 *   ATIVA do seletor compartilhado da ficha, e nomeia a classe no título
 *   -- mesma regra de `mostrarTrocaMagiaConhecida`, acima. Sem
 *   `opcoes.classe`, o comportamento é IDÊNTICO ao de antes desta tarefa.
 *
 *   LIMITAÇÃO MEDIDA, permanente (não é lacuna a fechar depois): só a
 *   lista de ENTRADA (quais truques podem entrar) segue `opcoes.classe`
 *   -- ela já vinha de `obterMagiasDisponiveisClasseAtual({ classe:
 *   sup.classe, ... })`, e `sup`, abaixo, passa a ser a superfície
 *   resolvida por `opcoes.classe`. A lista de SAÍDA (`truquesTrocaveis()`,
 *   logo abaixo) é sempre a do personagem INTEIRO -- NUNCA filtrada por
 *   classe nenhuma, nem por `opcoes.classe` nem pela superfície ativa --
 *   porque `char.magias_conhecidas[]` não tem campo `classe`, diferente
 *   de `magias_preparadas[]` (carimbado pelo sub-projeto anterior, "magia
 *   sabe a classe", que deixou os truques de fora por decisão
 *   registrada). Não dá para inferir a classe de um truque pelo NOME sem
 *   chutar: as listas de classe se sobrepõem demais (Feiticeiro e Mago
 *   compartilham 95% da lista menor) -- um filtro por nome acertaria por
 *   acaso e erraria em silêncio, então nenhum foi adicionado.
 *
 *   ACHADO IMPORTANT 1 da rodada 1 de revisão desta tarefa: os DADOS
 *   COMPLETOS de exibição de cada truque atual (escola, duração -- só
 *   para o card; `magias_conhecidas[]` guarda `{nome, circulo, origem}`,
 *   sem eles) vinham só da lista de `sup` (a de ENTRADA) -- funcionava
 *   por coincidência enquanto `sup` era sempre `superficieAtiva()`, a
 *   ÚNICA classe de um personagem de classe única. Ao `sup` passar a
 *   seguir `opcoes.classe`, essa busca virou sem querer um FILTRO POR
 *   CLASSE da lista de SAÍDA: um Clérigo/Druida cuja T3 pede a troca do
 *   Druida (`opcoes.classe: 'Druida'`) perdia os truques do Clérigo (que
 *   o personagem TEM e pode trocar, e que `truquesAtuais` já continha)
 *   do seletor "remover" -- às vezes deixando-o vazio, um beco sem saída
 *   idêntico ao já corrigido duas vezes nesta branch (o portão acima já
 *   confirmou que HÁ truque para trocar). CONSERTO: os dados completos
 *   vêm da UNIÃO das listas de TODAS as classes conjuradoras do
 *   personagem (`superficiesDaFicha(char)`), não só da de `sup` -- isto
 *   NÃO classifica de quem é cada truque (a pergunta que este docblock já
 *   dizia, corretamente, não ter resposta sem chutar): só busca, em
 *   QUALQUER lista onde o nome apareça, o mesmo dado de jogo que toda
 *   lista descreveria igual, para enriquecer a exibição de um truque que
 *   o personagem JÁ SABE que tem -- nunca decide quem entra na lista de
 *   SAÍDA, que continua sendo `truquesAtuais` inteiro, sem filtro nenhum.
 */
export async function mostrarTrocaTruque(callbackPosTroca = null, opcoes = {}) {
  // Lista de SAIDA sem filtro de classe -- ver a LIMITACAO MEDIDA no
  // docblock acima.
  const truquesAtuais = truquesTrocaveis();
  if (truquesAtuais.length === 0) {
    toast('Nenhum truque de classe para trocar', 'error');
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
    return;
  }

  const sup = superficieDaTroca(char, opcoes.classe);
  const subConj = subConjDaSuperficie(sup);
  const magiasClasse = sup
    ? await obterMagiasDisponiveisClasseAtual({ classe: sup.classe, subclasse: sup.subclasse, nivel: sup.nivelClasse })
    : [];
  const truquesClasse = magiasClasse.filter(m => m.circulo === 0);
  // Truques ja conhecidos por QUALQUER origem entram no bloqueio: trocar um
  // truque por outro que ja se tem geraria duplicata na lista.
  const jaTemSet = new Set((char.magias_conhecidas || []).map(m => m.nome));

  // `deMagias` precisa dos dados completos (escola, duracao) para o resumo
  // do card; magias_conhecidas so guarda {nome, circulo, origem}. ACHADO
  // IMPORTANT 1 da rodada 1 (ver docblock acima): busca na UNIAO das
  // listas de TODAS as classes conjuradoras do personagem, nao so na de
  // `sup` -- senao um truque de OUTRA classe (que `truquesAtuais` ja
  // inclui, sem filtro) fica sem dado de exibicao e SOME do seletor
  // "remover" (a lista de SAIDA nunca pode perder item nenhum de
  // `truquesAtuais` por causa desta busca).
  const truquesDeTodasAsClasses = (await Promise.all(
    superficiesDaFicha(char).map((s) =>
      obterMagiasDisponiveisClasseAtual({ classe: s.classe, subclasse: s.subclasse, nivel: s.nivelClasse }))
  )).flat().filter(m => m.circulo === 0);
  const mapaTruquesCompletos = new Map(truquesDeTodasAsClasses.map(m => [m.nome, m]));
  // `truquesAtuais.map` (nao `.filter`) e' o que garante que NENHUM truque
  // de `truquesAtuais` desaparece: sem dado completo em nenhuma lista
  // (personagem com magia personalizada, ou classe sem dados carregados),
  // cai no proprio registro cru (`{nome, circulo, origem}`) -- `deMagias`
  // degrada graciosamente sem escola/duracao, e "ver detalhes" continua
  // funcionando via busca por nome no indice inteiro (nao por classe).
  const truquesAtuaisCompletos = truquesAtuais.map(m => mapaTruquesCompletos.get(m.nome) || m);

  let truqueRemover = null;
  let truqueAdicionar = null;

  const nomeClasse = sup ? (subConj ? `${sup.classe} (${sup.subclasse})` : sup.classe) : char.classe;

  // `opcoes.classe` (Tarefa 2): titulo nomeia a classe para uma cadeia de
  // modais (T3, uma por classe conjuradora) nao parecer o mesmo modal
  // repetido -- a explicacao logo abaixo ja nomeia `nomeClasse` de
  // qualquer forma (mesmo sem opcoes.classe), entao so o titulo faltava.
  const titulo = opcoes.classe ? `Trocar Truque — ${nomeClasse}` : 'Trocar Truque';

  abrirModal(titulo, `
    <div class="info-box info" style="margin-bottom:12px;font-size:0.85rem">
      Apos um Descanso Longo, voce pode trocar <strong>1 truque</strong> por outro da lista de ${escHtml(nomeClasse)}.
    </div>

    <div style="margin-bottom:12px">
      <label class="form-label" style="font-weight:700;color:var(--accent)">Truque a remover:</label>
      <div id="troca-truque-remover-lista" style="margin-bottom:4px"></div>
    </div>

    <div id="troca-truque-adicionar-container" style="display:none">
      <label class="form-label" style="font-weight:700;color:var(--accent)">Novo truque:</label>
      <div id="troca-truque-adicionar-lista"></div>
    </div>
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
     <button class="btn btn-secondary" id="btn-pular-troca-truque">Nao Trocar</button>
     <button class="btn btn-primary" id="btn-confirmar-troca-truque" disabled>Confirmar Troca</button>`);

  const containerAdicionar = document.getElementById('troca-truque-adicionar-container');
  const confirmarBtn = document.getElementById('btn-confirmar-troca-truque');

  /** Remonta a lista de truques substitutos, excluindo o que esta saindo */
  function renderListaSubstituta() {
    montarSeletor(document.getElementById('troca-truque-adicionar-lista'), {
      opcoes: deMagias(
        truquesClasse.filter(m => m.nome !== truqueRemover),
        { jaTem: jaTemSet }
      ),
      densidade: 'densa', max: 1, busca: true,
      // `selecionadas` (plural, array) e o nome do parametro em
      // montarSeletor/ui-opcoes.js -- `selecionado` (singular) e do
      // sub-objeto de montarTroca e seria ignorado em silencio aqui.
      selecionadas: truqueAdicionar ? [truqueAdicionar] : [],
      aoMudar: (sel) => {
        truqueAdicionar = sel[0] || null;
        confirmarBtn.disabled = !truqueAdicionar;
      },
    });
  }

  montarSeletor(document.getElementById('troca-truque-remover-lista'), {
    opcoes: deMagias(truquesAtuaisCompletos),
    densidade: 'densa', max: 1, busca: true,
    aoMudar: (sel) => {
      truqueRemover = sel[0] || null;
      truqueAdicionar = null;
      confirmarBtn.disabled = true;
      if (truqueRemover) {
        containerAdicionar.style.display = 'block';
        renderListaSubstituta();
      } else {
        containerAdicionar.style.display = 'none';
      }
    },
  });

  document.getElementById('btn-pular-troca-truque')?.addEventListener('click', () => {
    window.fecharModal();
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
  });

  confirmarBtn?.addEventListener('click', () => {
    if (!truqueRemover || !truqueAdicionar) return;
    const idx = char.magias_conhecidas.findIndex(m => m.nome === truqueRemover);
    if (idx >= 0) {
      // Preserva a `origem` do truque que sai: o substituto ocupa a MESMA
      // vaga, entao herda de onde ela veio (undefined = truque de classe).
      const origem = char.magias_conhecidas[idx]?.origem;
      char.magias_conhecidas.splice(idx, 1);
      const novo = { nome: truqueAdicionar, circulo: 0 };
      if (origem) novo.origem = origem;
      char.magias_conhecidas.push(novo);
      salvar();
      toast(`Trocou ${truqueRemover} por ${truqueAdicionar}`, 'success');
    }
    window.fecharModal();
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
  });
}
/**
 * Modal de escolha das magias que o Mago "sempre tem preparadas" por
 * característica de classe: Maestria de Magias (nível 18) e Assinatura
 * Mágica (nível 20).
 *
 * As duas escolhem DO LIVRO DE MAGIAS (char.grimorio), não da lista geral
 * de Mago -- o texto do livro diz "em seu livro de magias" nas duas. A
 * Maestria ainda exige tempo de conjuração de uma ação, conferido contra
 * o índice de magias.
 *
 * Antes destas telas, a Assinatura Mágica tinha botões "Assinatura 1/2"
 * que só marcavam o uso, sem nunca perguntar QUAL magia era a assinatura,
 * e a Maestria de Magias não pedia nada.
 *
 * @param {string} tipo - 'maestria_magias' ou 'assinatura_magica'
 */
export async function abrirEscolhaMagiasFixasMago(tipo) {
  const def = MAGIAS_FIXAS_MAGO[tipo];
  const estado = getEstadoRecursosMago();
  if (!def || !estado) return;
  // Nível NA CLASSE Mago, não o total: um Mago 5/Guerreiro 15 (nível total
  // 20) ainda não tem Maestria de Magias/Assinatura Mágica (características
  // de nível 18/20 DE MAGO) -- comparar contra o total concedia cedo demais.
  if (nivelNa(char, 'Mago') < def.nivel) return;

  const grimorio = Array.isArray(char.grimorio) ? char.grimorio : [];
  if (grimorio.length === 0) {
    toast('Registre magias no seu livro de magias primeiro.', 'error');
    return;
  }

  /**
   * Tempo de conjuração da magia, vindo do índice já carregado na ficha.
   * Magia que o índice não conhece (personalizada, por exemplo) NÃO é
   * descartada: sem informação, esconder a opção seria pior que mostrá-la
   * -- o jogador não teria como saber por que ela sumiu da lista.
   */
  const ehAcao = (nome) => {
    const info = indiceMagiasCache?.find(m => m.nome === nome);
    if (!info?.tempo_conjuracao) return true;
    const tc = info.tempo_conjuracao.toLowerCase();
    return tc === 'ação' || tc === 'acao';
  };

  const atual = tipo === 'maestria_magias'
    ? { c1: estado.maestriaMagia1, c2: estado.maestriaMagia2 }
    : { m1: estado.assinatura1, m2: estado.assinatura2 };
  const escolhas = { ...atual };

  const corpo = def.vagas.map(vaga => `
    <div style="margin-bottom:12px">
      <label class="form-label" style="font-weight:700;color:var(--accent)">
        Magia de ${vaga.circulo}º Círculo${def.exigeAcao ? ' (tempo de conjuração: Ação)' : ''}
      </label>
      <div id="magia-fixa-${vaga.chave}"></div>
    </div>
  `).join('');

  abrirModal(`${def.rotulo}`, `
    <div class="info-box info" style="margin-bottom:12px;font-size:0.85rem">
      Escolha ${def.vagas.length === 1 ? 'a magia' : 'as magias'} do seu
      <strong>livro de magias</strong>. ${tipo === 'maestria_magias'
        ? 'Você sempre as tem preparadas e pode conjurá-las no círculo mais baixo sem gastar espaço de magia.'
        : 'Você sempre as tem preparadas e pode conjurar cada uma no 3º círculo, uma vez, sem gastar espaço de magia.'}
    </div>
    ${corpo}
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
     <button class="btn btn-primary" id="btn-salvar-magias-fixas">Salvar</button>`);

  /**
   * (Re)monta a lista de uma vaga. Precisa ser refeita a cada escolha, e
   * não só na abertura: uma magia já usada na OUTRA vaga tem de ficar
   * bloqueada aqui ("escolha uma magia de 1º e uma de 2º", "escolha DUAS
   * magias de 3º círculo" -- são escolhas distintas). Enquanto o bloqueio
   * era calculado uma única vez na montagem, dava para marcar a mesma
   * magia nas duas vagas; a gravação deduplica por nome e o jogador
   * terminava com UMA assinatura -- o sintoma "só está podendo escolher 1
   * magia em vez de 2".
   */
  const montarVaga = (vaga) => {
    const el = document.getElementById(`magia-fixa-${vaga.chave}`);
    if (!el) return;
    const outrasVagas = def.vagas.filter(v => v.chave !== vaga.chave);
    const candidatas = grimorio
      .filter(m => Number(m.circulo) === vaga.circulo)
      .filter(m => !def.exigeAcao || ehAcao(m.nome));
    if (candidatas.length === 0) {
      el.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted)">
        Nenhuma magia de ${vaga.circulo}º círculo${def.exigeAcao ? ' com tempo de conjuração de ação' : ''}
        no seu livro de magias.
      </div>`;
      return;
    }
    montarSeletor(el, {
      opcoes: deMagias(candidatas, {
        jaTem: new Set(outrasVagas.map(v => escolhas[v.chave]).filter(Boolean))
      }),
      densidade: 'densa', max: 1, busca: candidatas.length > 8,
      selecionadas: escolhas[vaga.chave] ? [escolhas[vaga.chave]] : [],
      aoMudar: (sel) => {
        const novo = sel[0] || '';
        if (novo === escolhas[vaga.chave]) return; // montagem, não escolha
        escolhas[vaga.chave] = novo;
        // Só as OUTRAS vagas são remontadas -- remontar a própria durante o
        // seu callback reentraria em montarSeletor no meio do desenho.
        outrasVagas.forEach(montarVaga);
      },
    });
  };

  def.vagas.forEach(montarVaga);

  document.getElementById('btn-salvar-magias-fixas')?.addEventListener('click', () => {
    definirMagiasFixasMago(tipo, escolhas);
    window.fecharModal();
    renderFichaCompleta();
    toast(`${def.rotulo}: magias atualizadas.`, 'success');
  });
}
