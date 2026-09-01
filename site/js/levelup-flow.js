// ============================================================
// Motor de Fluxo de Level Up - Cards Dinâmicos
// Fase 1: Contexto + Fase 2: Steps dinâmicos
// ============================================================
import { CLASSES_INFO, ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, ESCOLAS_SUBCLASSE_MAGO } from './dados-classes.js';
import { linhasDaSubclasseNoNivel, truquesConhecidosDe } from './regras-subclasse-escolhas.js';
import { contextoDeSubida } from './regras-multiclasse-progressao.js';
import { classesDe } from './regras-multiclasse.js';
import { concessoesAoEntrarEm } from './regras-multiclasse-proficiencias.js';
// INSTRUMENTOS_MUSICAIS vem de regras-cobertura.js, a MESMA copia que
// levelup.js valida (Ruling 8 da Tarefa 4) -- proficienciaClasseNovaCompleta
// (abaixo) confere o instrumento escolhido contra ela, para o predicado
// nunca aceitar em tela o que o motor recusaria.
import { INSTRUMENTOS_MUSICAIS, ritualBonusPendente } from './regras-cobertura.js';
import { getClasse, getMagiasClasse, getMagiasPorCirculo } from './db.js';
import { getTruquesFixosSubclasse } from './regras-conjuracao-subclasse.js';
import { truqueEhTrocavel } from './regras-origens-magia.js';
// preparadasPorClasse (Item 1 da revisão final do sub-projeto "magia sabe a
// classe"): ver uso perto de `temMagiaTrocavel`, no step 'selecao_magias'.
import { preparadasPorClasse } from './regras-magia-classe.js';
import {
  calcMod, bonusProficiencia, getBonusTruquesOrdem, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas
} from './utils.js';
import {
  concedeAumentoAtributo, exigeDadivaEpica, exigeSubclasse,
  exigeEspecializacaoBardo, exigeEspecializacaoGuardiao, exigeEspecializacaoLadino,
  exigeEstiloLuta, exigeTrocaEstiloLutaGuerreiro, exigeExploradorHabil, exigeAcademico, exigeConhecimentoPrimordial, opcoesPericiaConhecimentoPrimordial,
  exigeManobrasGuerreiro, getQuantidadeNovasManobras,
  obterCaracteristicasNivel, obterCaracteristicasEspecieNivel,
  obterCaracteristicasSubclasseNivel, obterMagiasDominioNivel,
  obterMagiasSemprePreparadasNivel
} from './levelup.js';

// ---- Fase 1: Construir contexto de level up ----

/**
 * Calcula o bloco de conjuração para uma subclasse HIPOTÉTICA.
 *
 * `subclasseEfetiva` é parâmetro, e não `char.subclasse`, porque as duas
 * subclasses 1/3 conjuradoras (Cavaleiro Místico e Trapaceiro Arcano) são
 * escolhidas no MESMO nível em que a conjuração começa: no nível 3 o
 * personagem ainda não tem subclasse gravada, e um cálculo preso a
 * `char.subclasse` devolvia "não é conjurador" -- o jogador subia sem
 * nenhuma tela de truques/magias e sem espaços.
 *
 * @param {Object} char - Personagem
 * @param {Object} classeData - Dados da classe
 * @param {Object} info - Entrada de CLASSES_INFO da classe
 * @param {Object} helpers - Funções da ficha (getSubclasseConjuradoraConjuracao)
 * @param {Object} sub - contextoDeSubida da classe que sobe (regras-multiclasse-progressao.js)
 * @param {string|null} subclasseEfetiva - Subclasse a considerar
 * @returns {{ehConjurador:boolean, tipoConj:string, conjuracao:Object|null}}
 */
function montarConjuracao(char, classeData, info, helpers, sub, subclasseEfetiva) {
  // TUDO neste bloco é lido pelo nível NA CLASSE, nunca pelo total: cada
  // número aqui sai da tabela da CLASSE que sobe (truques, magias
  // preparadas, espaços) ou da tabela da SUBCLASSE dela. Um Mago 5/
  // Guerreiro 3 lê a linha 3 da tabela do Guerreiro, não a linha 8.
  // `getCavaleiroMisticoConjuracao` (sheet/classes/guerreiro.js) diz o
  // mesmo do seu `opcoes.nivel`: é o nível NA classe Guerreiro.
  const nivelNaClasseAnterior = sub.nivelNaClasseAnterior;
  const nivelNaClasseNovo = sub.nivelNaClasseNovo;
  const consultarSubclasse = (nivel) => helpers.getSubclasseConjuradoraConjuracao
    ? helpers.getSubclasseConjuradoraConjuracao({ subclasse: subclasseEfetiva || null, nivel })
    : null;
  const subAtual = consultarSubclasse(nivelNaClasseAnterior);
  const subNovo = consultarSubclasse(nivelNaClasseNovo);
  const ehSubConj = !!subNovo;
  const ehConjurador = !!(info?.conjurador || ehSubConj);
  const tipoConj = info?.tipo_conjuracao || (ehSubConj ? 'conhecidas' : 'preparadas');
  if (!ehConjurador) return { ehConjurador, tipoConj, conjuracao: null };

  const tabela = classeData?.tabela_caracteristicas;
  let truquesAtual = tabela ? getTruquesConhecidos(tabela, nivelNaClasseAnterior) : 0;
  let truquesNovo = tabela ? getTruquesConhecidos(tabela, nivelNaClasseNovo) : 0;
  let magiasAtual = tabela ? getMagiaPreparadas(tabela, nivelNaClasseAnterior) : 0;
  let magiasNovo = tabela ? getMagiaPreparadas(tabela, nivelNaClasseNovo) : 0;

  // Para subclasses conjuradoras, os limites vêm da tabela da subclasse
  if (ehSubConj) {
    truquesAtual = subAtual?.truques || 0;
    truquesNovo = subNovo?.truques || 0;
    magiasAtual = subAtual?.preparadas || 0;
    magiasNovo = subNovo?.preparadas || 0;
  }

  // Truques extras do Clérigo Taumaturgo / Druida Xamã (utils.js, mesma
  // função que o criador/ficha usam). NO-OP HOJE para o único valor que
  // este bloco expõe a quem consome: os 3 leitores reais
  // (levelup-cards.js:renderCardMagias, levelup-ui.js:setupEventListeners,
  // levelup-validations.js:validateAll) leem só `conjuracao.truquesGanhos`
  // (a DIFERENÇA truquesNovo-truquesAtual, algumas linhas abaixo) --
  // ordem_divina/ordem_primal não muda dentro de uma mesma chamada de
  // subirDeNivel (foi escolhida na criação, nível 1), então o bônus é
  // IDÊNTICO nos dois lados e se cancela na subtração:
  // (novo+1)-(atual+1) === novo-atual. Mantido mesmo sendo no-op, por
  // defesa: truquesAtual/truquesNovo são expostos BRUTOS em `conjuracao`
  // (objeto retornado logo abaixo) e nada impede um consumidor futuro de
  // ler um dos dois direto (ex.: um card que mostrasse "Truques: X → Y"
  // em vez de só o delta) -- sem o bônus aqui, esse consumidor hipotético
  // exibiria o valor sem o +1. 0 para subclasses conjuradoras (não são
  // Clérigo/Druida), então soma sem risco nos dois ramos acima.
  truquesAtual += getBonusTruquesOrdem(char);
  truquesNovo += getBonusTruquesOrdem(char);

  // Truques que a subclasse CONCEDE neste nível (Mãos Mágicas do Trapaceiro
  // Arcano) não são escolha do jogador: saem da conta de "novos truques",
  // senão a tela pediria 3 e o personagem terminaria com 4 de um limite 3.
  const truquesFixosNovos = getTruquesFixosSubclasse(sub.classe, subclasseEfetiva, nivelNaClasseNovo)
    .filter(nome => !(char.magias_conhecidas || []).some(m => m.nome === nome));

  // Espaços de magia no nível novo
  let espacosNovo = tabela ? getEspacosMagia(tabela, nivelNaClasseNovo) : {};
  if (ehSubConj && Object.keys(espacosNovo).length === 0) {
    // A tabela da subclasse guarda só o total por círculo ({1: 2}); aqui o
    // formato precisa ser o mesmo de getEspacosMagia ({1: {total, usados}}).
    espacosNovo = Object.fromEntries(Object.entries(subNovo?.espacos || {})
      .map(([circulo, total]) => [circulo, { total, usados: 0 }]));
  }
  const maxCirculoNovo = Math.max(...Object.keys(espacosNovo).map(Number), 0);

  // Ganhou um círculo de magia totalmente novo neste nível (independe de já saber a escola/subclasse)
  let espacosAntes = nivelNaClasseAnterior >= 1 ? getEspacosMagia(tabela, nivelNaClasseAnterior) : {};
  if (ehSubConj && Object.keys(espacosAntes).length === 0) {
    espacosAntes = Object.fromEntries(Object.entries(subAtual?.espacos || {})
      .map(([circulo, total]) => [circulo, { total, usados: 0 }]));
  }
  const ganhouNovoCirculo = Object.entries(espacosNovo).some(([c, d]) =>
    (d?.total || 0) > 0 && (espacosAntes[c]?.total || 0) === 0);

  const escolaSubclasse = sub.classe === 'Mago' &&
    Object.prototype.hasOwnProperty.call(ESCOLAS_SUBCLASSE_MAGO, subclasseEfetiva)
    ? ESCOLAS_SUBCLASSE_MAGO[subclasseEfetiva] : null;
  let subclasseArcana = null;
  if (escolaSubclasse) {
    let quantidade = 0;
    // Nível 3 DE MAGO: é quando se entra na subclasse arcana. O motor
    // decide igual (`nivelNaClasseNovo === 3`, levelup.js).
    if (nivelNaClasseNovo === 3) {
      quantidade += 2;
    } else if (ganhouNovoCirculo) {
      quantidade += 1;
    }
    if (quantidade > 0) {
      subclasseArcana = { escola: escolaSubclasse, quantidade, circuloMax: maxCirculoNovo };
    }
  }

  return {
    ehConjurador,
    tipoConj,
    conjuracao: {
      tipoConj,
      truquesAtual,
      truquesNovo,
      truquesGanhos: Math.max(0, truquesNovo - truquesAtual - truquesFixosNovos.length),
      truquesFixosNovos,
      magiasAtual,
      magiasNovo,
      magiasGanhas: magiasNovo - magiasAtual,
      maxCirculoNovo,
      espacosNovo,
      // "Ganha magias novas no Grimório neste nível?", não "é um Mago?" --
      // é a flag que empurra a pendência `grimorio` e o card de grimório.
      // Espelha `exigeGrimorioMago` de levelup.js.
      //
      // RESÍDUO CORRIGIDO: até aqui o `> 1` também excluía o 1º nível DE
      // MAGO -- mas esse nível só existe de duas formas: a criação do
      // personagem (nunca passa por este contexto) ou multiclassar em
      // Mago (nivelNaClasseAnterior === 0, contextoDeSubida). A entrada
      // "Como um Personagem Multiclasse" do Mago (Classes.md:4552-4556)
      // manda "Adquira as características de nível 1 de Mago" -- e o
      // Livro de Magias É característica de nível 1 (Conjuração). Negar a
      // pendência aqui deixava `char.grimorio` vazio para sempre num Mago
      // entrado por multiclasse. Em classe única nada muda: o contexto só
      // é montado a partir do nível 2 NA CLASSE (o 1º vem da criação), e
      // `nivelNaClasseNovo` nunca é 1 nesse caminho.
      ehMago: sub.classe === 'Mago',
      // Quantidade de magias novas do Grimório neste nível. O livro
      // (Classes.md, característica Conjuração) dá SEIS magias de 1º
      // círculo no nível 1 de Mago -- criação ou multiclasse, tanto faz --
      // e DUAS a cada nível de Mago depois do 1º (mesma quantidade de
      // sempre). Medido contra o criador: creator/passo-magias.js:78
      // (`limiteGrimorio = magoNivel1 ? 6 : 0`) já implementa o lado da
      // criação com este mesmo número.
      grimorioQtd: nivelNaClasseNovo === 1 ? 6 : 2,
      subclasseArcana,
      ganhouNovoCirculo,
      subclasseEfetiva: subclasseEfetiva || null
    }
  };
}

/**
 * Constrói o contexto completo para o fluxo de level up.
 * Reúne todas as flags, dados de classe e pendências necessárias.
 * @param {Object} char - Personagem atual
 * @param {Object} classeData - Dados carregados da classe (getClasse) -- TEM de ser o dado
 *   de `nomeClasse` (ou de `char.classe`, quando `nomeClasse` for omitido). Os dois parâmetros
 *   são independentes e nada aqui confere que concordam: `classeData` alimenta
 *   `tabela_caracteristicas` e `subclasses`, então um par desencontrado gera contagens de
 *   magia/espaço e lista de subclasses da classe ERRADA. Quem monta o contexto é responsável
 *   por carregar `getClasse(nomeClasse)` e passar exatamente essa classe aqui.
 * @param {Object} helpers - Funções auxiliares do sheet.js (ehSubclasseConjuradora, getSubclasseConjuradoraConjuracao, etc.)
 * @param {string|null} nomeClasse - Classe em que o nível vai entrar; sem ela, a classe INICIAL (o comportamento de antes do multiclasse)
 * @returns {Object} ctx - Contexto completo
 */
export async function buildLevelUpContext(char, classeData, helpers = {}, nomeClasse = null) {
  const classeQueSobe = nomeClasse || char.classe;
  // OS DOIS NÍVEIS, separados de propósito -- e a MESMA divisão que
  // `subirDeNivel` (levelup.js) já faz, porque o que esta tela promete
  // tem de ser exatamente o que aquele motor aplica. `nivelNaClasse*`
  // manda em tudo que a CLASSE concede naquele patamar dela; `nivelAtual`/
  // `nivelNovo` seguem sendo o TOTAL, porque o título do modal ("Nível 7
  // -> Nível 8"), o Bônus de Proficiência (livro:2047) e as
  // características de ESPÉCIE são do personagem inteiro. Em classe única
  // os dois são o mesmo número -- nenhum teste acusa uma troca errada
  // entre eles, por isso cada uso abaixo foi decidido um a um.
  const sub = contextoDeSubida(char, classeQueSobe);
  const nivelAtual = sub.nivelTotalAnterior;
  const nivelNovo = sub.nivelTotalNovo;
  const nivelNaClasseNovo = sub.nivelNaClasseNovo;
  const info = CLASSES_INFO[classeQueSobe] || {};
  // FALHA FECHADA para classe fora do catálogo -- mesma direção de erro de
  // `podeEntrarEm` e `pvGanhoAoSubir` (regras-multiclasse-progressao.js).
  // Sem esta guarda, `info` vazio faz `hpGanhoFixo` virar NaN e o card de
  // PV anuncia "+NaN PV" (e a tela inteira sai sem característica nenhuma),
  // em silêncio. Era inalcançável enquanto só existia a classe INICIAL do
  // personagem; o seletor de classe (step 'escolha_classe') torna o nome da
  // classe um dado de entrada, e recusar é o certo -- não existe descer de
  // nível para desfazer um nível que subiu com números inventados.
  if (!Number.isFinite(info.dado_vida)) {
    throw new Error(
      `Classe fora do catálogo: "${classeQueSobe}" não tem dado de vida em CLASSES_INFO`);
  }
  const modCon = calcMod(char.atributos.constituicao);
  // Dado de vida da CLASSE QUE SOBE (`info` é dela), não o da classe
  // inicial: um Mago 5 que sobe Guerreiro rola d10.
  const hpGanhoFixo = Math.max(1, Math.floor(info.dado_vida / 2) + 1 + modCon);

  // Flags de regras -- todas pelo nível NA CLASSE, como no motor.
  // A subclasse é a DAQUELA classe: um Mago 5/Guerreiro 3 escolhe a
  // subclasse de Guerreiro, e a do Mago continua onde está.
  const precisaSubclasse = exigeSubclasse(sub.classe, nivelNaClasseNovo) && !sub.subclasse;
  const ganhaASI = concedeAumentoAtributo(sub.classe, nivelNaClasseNovo);
  const exigeDadivaEpicaNivel = exigeDadivaEpica(sub.classe, nivelNaClasseNovo);
  const precisaExpertiseBardo = exigeEspecializacaoBardo(sub.classe, nivelNaClasseNovo);
  const precisaExpertiseGuardiao = exigeEspecializacaoGuardiao(sub.classe, nivelNaClasseNovo);
  const precisaEstiloLuta = exigeEstiloLuta(sub.classe, nivelNaClasseNovo);
  // Troca de Estilo de Luta do Guerreiro (Classes.md:3812): opcional, por
  // isso não entra em `requirements` (que só lista pendências
  // obrigatórias) -- só controla se o card de troca aparece na tela.
  const podeTrocarEstiloLutaGuerreiro = exigeTrocaEstiloLutaGuerreiro(sub.classe, nivelNaClasseNovo);
  // Especialização adicional do Ladino (Classes.md:4188, nível 6):
  // também opcional -- subirDeNivel preenche sozinho se o jogador não
  // escolher (ver levelup.js).
  const precisaExpertiseLadino = exigeEspecializacaoLadino(sub.classe, nivelNaClasseNovo);
  const precisaExploradorHabil = exigeExploradorHabil(sub.classe, nivelNaClasseNovo);
  const precisaAcademico = exigeAcademico(sub.classe, nivelNaClasseNovo);
  // Conhecimento Primordial (Bárbaro nv3, Classes.md:109): perícia NOVA da
  // lista de nível 1 do Bárbaro. Nível NA CLASSE, como todo o resto deste
  // bloco. As opções já vêm filtradas pelo que o personagem tem (issue #45).
  const precisaConhecimentoPrimordial = exigeConhecimentoPrimordial(sub.classe, nivelNaClasseNovo);
  const opcoesConhecimentoPrimordial = precisaConhecimentoPrimordial
    ? opcoesPericiaConhecimentoPrimordial(classeData, char) : [];
  // Concessoes da classe NOVA, ja resolvidas (livro:2051). `null` quando o
  // nivel nao abre classe nova -- e o que faz o step 'proficiencias_classe_nova'
  // sumir. O MESMO gate de `subirDeNivel` (levelup.js): `ehPrimeiroNivelNaClasse`
  // e nunca `ehPrimeiroNivelDoPersonagem` -- a classe INICIAL recebe pericias
  // completas pelo criador, e os dois campos existem separados de proposito
  // (regras-multiclasse-progressao.js:107).
  const concessoesClasseNova = sub.ehPrimeiroNivelNaClasse && !sub.ehPrimeiroNivelDoPersonagem
    ? concessoesAoEntrarEm(classeQueSobe)
    : null;
  let manobrasGuerreiro = null;
  if (sub.classe === 'Guerreiro') {
    const opcoesDisponiveis = classeData?.subclasses
      ?.find(sc => sc.nome === 'Mestre da Batalha')?.opcoes_manobra || [];
    manobrasGuerreiro = {
      opcoesDisponiveis,
      qtdNova: getQuantidadeNovasManobras(nivelNaClasseNovo),
      manobrasConhecidasAtuais: char.manobras_conhecidas || []
    };
  }

  // Características ganhas neste nível
  const caracteristicas = await obterCaracteristicasNivel(sub.classe, nivelNaClasseNovo);
  // ESPÉCIE fica no nível TOTAL, de propósito -- NÃO "corrija" para o
  // nível na classe. O texto do próprio traço diz "No nível 5 DO
  // PERSONAGEM" (Espécies.md:106): um Mago 3/Guerreiro 2 tem direito ao
  // traço de nível 5 da espécie, e ler o nível na classe o apagaria em
  // silêncio. `subirDeNivel` decide igual (levelup.js).
  const caracteristicasEspecie = await obterCaracteristicasEspecieNivel(char.especie, nivelNovo, char.tracos_escolhidos);
  const caracteristicasSubclasse = sub.subclasse
    ? await obterCaracteristicasSubclasseNivel(sub.classe, sub.subclasse, nivelNaClasseNovo)
    : [];
  const magiasDominioNivel = sub.subclasse
    ? await obterMagiasDominioNivel(sub.classe, sub.subclasse, nivelNaClasseNovo)
    : [];
  const magiasSempreNivel = sub.subclasse
    ? await obterMagiasSemprePreparadasNivel(sub.classe, sub.subclasse, nivelNaClasseNovo)
    : [];

  // Subclasses disponíveis
  let subclassesDisponiveis = [];
  if (precisaSubclasse && classeData?.subclasses) {
    subclassesDisponiveis = classeData.subclasses
      .filter(sc => !sc.nome.toLowerCase().startsWith('subclasses de'));
  }

  // Conjuração — congelada sobre a subclasse JÁ GRAVADA na classe que sobe
  // (`sub.subclasse`, nunca o espelho `char.subclasse`, que num multiclasse
  // aponta para a classe inicial), ver `calcularConjuracao`
  const { ehConjurador, tipoConj, conjuracao } = montarConjuracao(
    char, classeData, info, helpers, sub, sub.subclasse);

  // Requirements: array de pendências obrigatórias
  const requirements = [];
  if (precisaSubclasse) requirements.push({ tipo: 'subclasse', label: 'Escolher subclasse' });
  if (exigeDadivaEpicaNivel) requirements.push({ tipo: 'dadiva_epica', label: 'Dádiva Épica ou Outro Talento' });
  else if (ganhaASI) requirements.push({ tipo: 'asi', label: 'Distribuir 2 pontos de atributo ou Talento' });
  if (precisaExpertiseBardo) requirements.push({ tipo: 'bardo_expertise', label: 'Especialização do Bardo (2 perícias)' });
  if (precisaExpertiseGuardiao) requirements.push({ tipo: 'guardiao_expertise', label: 'Especialista do Guardião (2 perícias)' });
  if (precisaEstiloLuta) requirements.push({ tipo: 'estilo_luta', label: 'Escolher Estilo de Luta' });
  if (precisaExploradorHabil) requirements.push({ tipo: 'explorador_habil', label: 'Explorador Hábil (1 perícia + 2 idiomas)' });
  if (precisaAcademico) requirements.push({ tipo: 'academico', label: 'Acadêmico do Mago (1 perícia)' });
  if (precisaConhecimentoPrimordial) requirements.push({ tipo: 'conhecimento_primordial', label: 'Conhecimento Primordial (1 perícia)' });
  if (ehConjurador && conjuracao) {
    if (conjuracao.truquesGanhos > 0) requirements.push({ tipo: 'truques', label: `Selecionar ${conjuracao.truquesGanhos} truque(s)` });
    if (tipoConj === 'conhecidas' && conjuracao.magiasGanhas > 0) requirements.push({ tipo: 'magias_conhecidas', label: `Selecionar ${conjuracao.magiasGanhas} magia(s)` });
    if (conjuracao.ehMago) requirements.push({ tipo: 'grimorio', label: `Grimório: +${conjuracao.grimorioQtd} magias` });
    if (conjuracao.subclasseArcana) requirements.push({
      tipo: 'subclasse_magias_arcana',
      label: `${conjuracao.subclasseArcana.escola}: +${conjuracao.subclasseArcana.quantidade} magia(s)`
    });
  }

  // Bônus de proficiência: pelo nível TOTAL (livro:2047), como no motor.
  const bonusAnterior = bonusProficiencia(nivelAtual);
  const bonusNovo = bonusProficiencia(nivelNovo);

  // Dívida do crescimento do Conjurador Ritualista (Talentos.md:370):
  // sempre que o Bônus de Proficiência sobe depois de o talento já
  // concedido, uma magia ritual de 1º círculo nova entra sempre preparada.
  // Medido pelo nível TOTAL NOVO (`sub.nivelTotalNovo`) -- `char.nivel`
  // aqui ainda é o total ANTERIOR, só atualizado por `sincronizarEspelhos`
  // no fim de `subirDeNivel`, bem depois deste contexto ser montado (mesmo
  // cuidado do bônus de proficiência acima e do `bindEscolhasTalento` da
  // aquisição do talento, em levelup-ui.js).
  const ritualBonus = ritualBonusPendente(char, sub.nivelTotalNovo);

  return {
    char,
    classeData,
    info,
    // A classe em que o nível entra, e o contexto de subida dela. Quem
    // precisar do nível NA CLASSE anterior lê `sub.nivelNaClasseAnterior`.
    classeQueSobe,
    sub,
    nivelAtual,
    nivelNovo,
    nivelNaClasseNovo,
    modCon,
    hpGanhoFixo,
    precisaSubclasse,
    ganhaASI,
    exigeDadivaEpica: exigeDadivaEpicaNivel,
    precisaExpertiseBardo,
    precisaExpertiseGuardiao,
    precisaEstiloLuta,
    podeTrocarEstiloLutaGuerreiro,
    precisaExpertiseLadino,
    precisaExploradorHabil,
    precisaAcademico,
    precisaConhecimentoPrimordial,
    opcoesConhecimentoPrimordial,
    concessoesClasseNova,
    manobrasGuerreiro,
    caracteristicas,
    caracteristicasEspecie,
    caracteristicasSubclasse,
    magiasDominioNivel,
    magiasSempreNivel,
    subclassesDisponiveis,
    ehConjurador,
    conjuracao,
    requirements,
    bonusAnterior,
    bonusNovo,
    bonusMudou: bonusNovo !== bonusAnterior,
    ritualBonus,
    helpers
  };
}

/**
 * Calcula a exigência de "Versado em Escola" (magias grátis de subclasse arcana do Mago)
 * de forma reativa ao estado do fluxo de level-up: usa `state.subclasse` (escolha feita
 * nesta mesma sessão) com fallback para `ctx.sub.subclasse` (escolha de level-ups anteriores,
 * na classe que sobe). Não depende do valor congelado calculado em `buildLevelUpContext`,
 * que só enxerga a subclasse gravada no momento em que o contexto foi construído.
 * @param {Object} ctx - Contexto do buildLevelUpContext
 * @param {Object} state - Estado atual das escolhas do usuário
 * @returns {{ escola: string, quantidade: number, circuloMax: number } | null}
 */
/**
 * Bloco de conjuração considerando a subclasse escolhida NESTA sessão de
 * subida de nível (`state.subclasse`), com fallback para a já gravada.
 *
 * É o que torna a tela de magias visível para quem vira conjurador no
 * mesmo nível em que escolhe a subclasse (Cavaleiro Místico e Trapaceiro
 * Arcano, nível 3). O valor congelado em `ctx.conjuracao` continua lá para
 * quem só precisa do estado anterior à escolha.
 *
 * O resultado é memoizado por subclasse dentro do próprio ctx: esta função
 * é chamada em toda re-renderização do modal.
 */
export function calcularConjuracao(ctx, state) {
  const subclasseEfetiva = state?.subclasse || ctx.sub?.subclasse || null;
  if (!ctx._conjuracaoCache) ctx._conjuracaoCache = new Map();
  const chave = subclasseEfetiva || '';
  if (!ctx._conjuracaoCache.has(chave)) {
    ctx._conjuracaoCache.set(chave, montarConjuracao(
      ctx.char, ctx.classeData, ctx.info, ctx.helpers || {},
      ctx.sub, subclasseEfetiva));
  }
  return ctx._conjuracaoCache.get(chave).conjuracao;
}

/** Se o personagem conjura considerando a subclasse escolhida agora. */
export function ehConjuradorAtivo(ctx, state) {
  return !!calcularConjuracao(ctx, state);
}

/**
 * Lista de magias que a tela de seleção oferece, já considerando a
 * subclasse escolhida nesta sessão -- um Ladino só passa a enxergar a
 * lista de Mago depois de escolher Trapaceiro Arcano, e a escolha acontece
 * DEPOIS de o contexto ser montado. Memoizada por subclasse.
 */
export async function carregarMagiasDisponiveis(ctx, state) {
  const subclasseEfetiva = state?.subclasse || ctx.sub?.subclasse || null;
  if (!ctx.helpers?.obterMagiasDisponiveisClasseAtual) return ctx._listaMagiasClasse || [];
  if (!ctx._magiasCache) ctx._magiasCache = new Map();
  const chave = subclasseEfetiva || '';
  if (!ctx._magiasCache.has(chave)) {
    // `classe` é a QUE SOBE, não o espelho `char.classe` que a ficha usa
    // por padrão: um Mago 5 que entra em Clérigo 1 escolhe magias DE
    // CLÉRIGO. Sem este argumento a lista vinha do Mago enquanto o card
    // dizia "da lista de Clérigo" (levelup-cards.js) e o motor gravava as
    // escolhas no nível de Clérigo -- rótulo certo, dado errado.
    // `nivel` aqui é o NA CLASSE: a ficha só o usa para perguntar se a
    // subclasse já conjura naquele patamar (ehSubclasseConjuradora ->
    // getCavaleiroMisticoConjuracao, que documenta o próprio `opcoes.nivel`
    // como "o nível NA classe Guerreiro", não o total).
    ctx._magiasCache.set(chave, await ctx.helpers.obterMagiasDisponiveisClasseAtual(
      { classe: ctx.classeQueSobe, subclasse: subclasseEfetiva, nivel: ctx.nivelNaClasseNovo }));
  }
  const lista = ctx._magiasCache.get(chave) || [];
  // Os consumidores de tela leem ctx._listaMagiasClasse; manter sincronizado
  // evita que uma re-renderização use a lista da subclasse anterior.
  ctx._listaMagiasClasse = lista;
  return lista;
}

export function calcularSubclasseArcana(ctx, state) {
  const subclasseEfetiva = state?.subclasse || ctx.sub?.subclasse;
  const escolaSubclasse = ctx.classeQueSobe === 'Mago' &&
    Object.prototype.hasOwnProperty.call(ESCOLAS_SUBCLASSE_MAGO, subclasseEfetiva)
    ? ESCOLAS_SUBCLASSE_MAGO[subclasseEfetiva] : null;
  const conjuracao = calcularConjuracao(ctx, state);
  if (!escolaSubclasse || !conjuracao) return null;
  let quantidade = 0;
  // Nível 3 DE MAGO, o da entrada na subclasse (mesmo critério do motor).
  if (ctx.nivelNaClasseNovo === 3) {
    quantidade += 2;
  } else if (conjuracao.ganhouNovoCirculo) {
    quantidade += 1;
  }
  if (quantidade === 0) return null;
  return { escola: escolaSubclasse, quantidade, circuloMax: conjuracao.maxCirculoNovo };
}

/**
 * A escolha de proficiencias da classe NOVA (state.periciaClasseNova /
 * state.instrumentoClasseNova) e VALIDA para o contexto atual -- mesma
 * checagem de MEMBRO que o motor aplica em subirDeNivel
 * (levelup.js:1454 e :1472): a pericia tem de estar em
 * `ctx.concessoesClasseNova.opcoesPericia` (a lista resolvida DAQUELA
 * classe) e o instrumento em INSTRUMENTOS_MUSICAIS (a lista fixa do
 * livro), e nenhum dos dois pode ja pertencer ao personagem.
 *
 * UM SO LUGAR DE PROPOSITO. O step 'proficiencias_classe_nova' (completo,
 * abaixo) e a mensagem amigavel de validateAll
 * (levelup-validations.js) chamam esta MESMA funcao, em vez de cada um
 * reimplementar a comparacao por conta propria -- foi exatamente essa
 * duplicacao (uma copia em cada arquivo) que deixou as duas so conferindo
 * "o campo foi preenchido", nunca "o valor preenchido ainda e valido para
 * a classe ATUAL". Sem a checagem de membro, uma pericia escolhida para
 * Bardo (ex.: Persuasao) sobrevivia a uma troca de classe dentro do
 * assistente e o step reportava completo para uma pericia que Guardiao
 * nem oferece -- a tela prometia uma subida que o motor recusava um passo
 * depois, com o select renderizando vazio (o valor velho nao bate com
 * nenhuma <option> nova) e nenhum campo marcado como errado.
 */
export function proficienciaClasseNovaCompleta(ctx, state) {
  const c = ctx.concessoesClasseNova;
  if (!c) return true;
  if (c.pericias > 0) {
    const pericia = state.periciaClasseNova;
    const jaTem = (ctx.char.pericias_proficientes || []).includes(pericia);
    if (!pericia || !c.opcoesPericia.includes(pericia) || jaTem) return false;
  }
  if (c.instrumentos > 0) {
    const instrumento = state.instrumentoClasseNova;
    const jaTemInstrumento = (ctx.char.proficiencias_instrumentos || []).includes(instrumento);
    if (!instrumento || !INSTRUMENTOS_MUSICAIS.includes(instrumento) || jaTemInstrumento) return false;
  }
  return true;
}

/**
 * A escolha de magias rituais do Bônus de Proficiência (Conjurador
 * Ritualista, Talentos.md:370: "Sempre que seu Bônus de Proficiência
 * aumentar depois disso, você pode adicionar uma magia de 1º círculo com o
 * marcador Ritual às magias sempre preparadas com esta característica") é
 * VÁLIDA para o contexto atual -- mesma checagem que `subirDeNivel`
 * (levelup.js) aplica no guard de `ritual_bonus_proficiencia`: quantidade
 * exata de `ctx.ritualBonus.faltam`, todas distintas entre si, nenhuma
 * repetindo uma magia já preparada na ficha por QUALQUER origem
 * (`ctx.ritualBonus.nomesPreparados`) e todas
 * pertencentes à MESMA lista que o motor valida (`getMagiasRituais(1)`,
 * carregada em `ctx.magiasRituaisDisponiveis` por quem monta a tela --
 * levelup-ui.js).
 *
 * UM SO LUGAR DE PROPOSITO, como `proficienciaClasseNovaCompleta` acima: o
 * step 'ritual_bonus_proficiencia' (completo, abaixo) e a mensagem
 * amigavel de validateAll (levelup-validations.js) chamam esta MESMA
 * funcao, em vez de cada um reimplementar a comparacao por conta propria --
 * foi exatamente essa duplicacao, no par de `proficienciaClasseNovaCompleta`,
 * que deixou completo/validateAll divergirem do motor numa rodada anterior
 * deste projeto (achado da revisão da Tarefa 4, rodada 1).
 */
export function ritualBonusProficienciaCompleto(ctx, state) {
  const faltam = ctx.ritualBonus?.faltam || 0;
  if (faltam === 0) return true;
  const sel = state.rituaisBonusSelecionados || [];
  if (sel.length !== faltam) return false;
  if (new Set(sel).size !== faltam) return false;
  // TODAS as preparadas da ficha, de qualquer origem -- e o mesmo
  // conjunto que o guard do motor recusa desde o Important 1 da revisão
  // final (levelup.js, `repetindoPreparada`) e o mesmo que o card tira do
  // seletor (levelup-cards.js). Se aqui ficasse só `jaEscolhidas`, o
  // "Confirmar" aprovaria uma escolha que o motor recusa logo em seguida.
  const bloqueadas = ctx.ritualBonus?.nomesPreparados || [];
  if (sel.some((nome) => bloqueadas.includes(nome))) return false;
  const validas = new Set((ctx.magiasRituaisDisponiveis || []).map((m) => m.nome));
  if (sel.some((nome) => !validas.has(nome))) return false;
  return true;
}

// ---- Fase 2: Motor de steps dinâmicos ----

/**
 * Definição declarativa dos steps.
 * Cada step tem id, título, tipo, e funções de visibilidade/completude.
 */
const STEP_DEFINITIONS = [
  {
    id: 'escolha_classe',
    titulo: 'Classe do Nível',
    tipo: 'escolha',
    obrigatorio: true,
    // PRIMEIRO de propósito: tudo que os outros steps mostram (PV, ganhos,
    // subclasse, magias) sai da classe em que o nível entra, então ela tem
    // de estar decidida antes de qualquer outra tela ser montada.
    visivel: () => true,
    // Com UMA classe so, createInitialState ja deixa classeQueSobe
    // preenchida e o step nasce completo -- quem so continua clica
    // "Avancar" como sempre, sem escolha nenhuma a mais que antes. Com
    // DUAS ou mais nada vem marcado, de proposito: pre-selecionar uma
    // resposta num personagem que ja e multiclasse faz dois cliques em
    // "Avancar" subirem a classe errada, e nao existe descer de nivel.
    completo: (ctx, state) => !!state.classeQueSobe,
  },
  {
    id: 'ganhos_nivel',
    titulo: 'Ganhos do Nível',
    tipo: 'ganho',
    obrigatorio: true,
    // Sempre visível - todo level up mostra o que se ganha
    visivel: () => true,
    completo: () => true // Informativo, sempre completo
  },
  {
    id: 'escolha_subclasse',
    titulo: 'Escolha de Subclasse',
    tipo: 'escolha',
    obrigatorio: true,
    visivel: (ctx) => ctx.precisaSubclasse,
    completo: (ctx, state) => !!state.subclasse
  },
  {
    id: 'aumento_atributo',
    titulo: 'Aumento de Atributo ou Talento',
    tipo: 'escolha',
    obrigatorio: true,
    visivel: (ctx) => ctx.ganhaASI,
    completo: (ctx, state) => {
      if (state.asiModo === 'talento') {
        if (!state.talento) return false;
        if (state.talento === 'Aumento no Valor de Atributo' && state.pontosDistribuidos !== 2) return false;
        if (state.talento === 'Dádiva da Proficiência em Perícia' &&
            (state.escolhasTalento || []).length !== 1) return false;
        if (state.talento === 'Iniciado em Magia') {
          const im = state.iniciadoEmMagia;
          if (!im || !im.lista || !im.atributo || (im.truques?.length || 0) < 2 || !im.magia) return false;
        }
        return true;
      }
      if (state.asiModo === 'atributo') return state.pontosDistribuidos === 2;
      return false;
    }
  },
  {
    id: 'escolhas_classe',
    titulo: 'Escolhas de Classe',
    tipo: 'escolha',
    obrigatorio: true,
    // IMPORTANTE: a troca opcional de Estilo de Luta do Guerreiro
    // (podeTrocarEstiloLutaGuerreiro) e a Especialização opcional do
    // Ladino nível 6 (precisaExpertiseLadino) DELIBERADAMENTE não entram
    // nesta condição de visibilidade -- essas duas nunca introduzem um
    // step novo na tela (ver renderCardRevisao/'revisao_confirmacao'
    // abaixo, onde os dois cards aparecem). talentos-levelup.spec.mjs
    // (testes/e2e/regras/) hardcoda que, semeando um Guerreiro ou
    // Paladino, o step de ASI/talento é seguido DIRETAMENTE pela Revisão
    // ("um Próximo, um Confirmar") -- inserir aqui um step visível em
    // TODO nível >= 2 de Guerreiro quebraria essa suposição para dezenas
    // de testes de talento, sem relação nenhuma com Estilo de Luta.
    // As escolhas de SUBCLASSE (Plano 4) entram aqui de propósito: elas
    // BLOQUEIAM a subida em subirDeNivel, então precisam de um step onde
    // responder -- diferente das duas opcionais citadas acima, que nunca
    // bloqueiam. A condição é estreita (12 pares subclasse/nível), não "todo
    // nível de Guerreiro".
    visivel: (ctx, state) => ctx.precisaExpertiseBardo || ctx.precisaExpertiseGuardiao ||
                       ctx.precisaEstiloLuta ||
                       ctx.precisaExploradorHabil || ctx.precisaAcademico ||
                       ctx.precisaConhecimentoPrimordial ||
                       escolhasSubclasseDoNivel(ctx, state).length > 0,
    completo: (ctx, state) => {
      if (ctx.precisaExpertiseBardo && (state.bardoExpertise || []).length !== 2) return false;
      if (ctx.precisaExpertiseGuardiao && (state.guardiaoExpertise || []).length !== 2) return false;
      if (ctx.precisaEstiloLuta && !state.estiloLuta) return false;
      if (ctx.precisaExploradorHabil && (!state.exploradorExpertise || (state.exploradorIdiomas || []).length !== 2)) return false;
      if (ctx.precisaAcademico && (state.academicoExpertise || []).length !== 1) return false;
      if (ctx.precisaConhecimentoPrimordial && !state.conhecimentoPrimordialPericia) return false;
      for (const linha of escolhasSubclasseDoNivel(ctx, state)) {
        const valores = (state.escolhasSubclasse || {})[linha.campo] || [];
        if (valores.filter(Boolean).length !== linha.quantidade) return false;
      }
      return true;
    }
  },
  {
    id: 'selecao_magias',
    titulo: 'Seleção de Magias',
    tipo: 'magia',
    obrigatorio: true,
    visivel: (ctx, state) => {
      // Reativo à subclasse escolhida agora (ver calcularConjuracao): quem
      // vira conjurador neste mesmo nível não tinha step nenhum antes.
      const c = calcularConjuracao(ctx, state);
      if (!c) return false;
      // Nota: !!subclasseArcana é redundante hoje (só é truthy quando c.ehMago já é true,
      // pois deriva de ctx.classeQueSobe, que não muda dentro de um mesmo ctx), mas mantido
      // explícito via calcularSubclasseArcana para não depender de ctx.conjuracao.subclasseArcana
      // (congelado) e para deixar a intenção clara caso a regra mude no futuro.
      const subclasseArcana = calcularSubclasseArcana(ctx, state);
      // Task 1: a troca de truque é universal a qualquer classe que conheça truques de
      // classe, mesmo em níveis sem ganho de truque/magia novo - então o step também
      // precisa ficar visível quando há pelo menos 1 truque elegível para troca (mesma
      // lista de origens especiais usada no card de troca em levelup-cards.js).
      const temTruqueTrocavel = (ctx.char.magias_conhecidas || []).some(m => m.circulo === 0 && truqueEhTrocavel(m));
      // 2026-08-13: a troca de MAGIA passou a valer para toda classe
      // conjuradora (antes so `conhecidas` -- ver levelup-cards.js). Um
      // Clerigo/Druida/Paladino/Guardiao num nivel sem truque novo e sem
      // magia nova nao tinha nenhuma outra razao para este step aparecer,
      // e o card de troca ficaria renderizado numa tela invisivel.
      //
      // Esta linha montava a lista de magia como `['dominio', ...origensEspeciais]`
      // -- espalhando a lista de TRUQUE. Carregava origens que magia de
      // círculo 1+ nunca tem (`especie`, `subclasse_fixa`, `subclasse_automatica`)
      // e, pior, NÃO tinha `subclasse_escolha`, `maestria_magias` nem
      // `assinatura_magica`: o step ficava visível oferecendo troca de magia
      // que o livro diz que o personagem sempre tem preparada.
      //
      // preparadasPorClasse (Item 1 da revisão final do sub-projeto "magia
      // sabe a classe"): este cálculo contava `magiaContaNoLimite` sobre o
      // personagem INTEIRO, enquanto o card que este step exibe
      // (renderCardMagias, levelup-cards.js) já filtra as candidatas por
      // `classeQueSobe`. Num Feiticeiro 5/Mago 1 com as preparadas todas
      // carimbadas da OUTRA classe, o step aparecia (visível) e o card por
      // trás dele não tinha "Trocar Magias" para oferecer -- o mesmo beco
      // sem saída já consertado em sheet/hp-descanso.js (Achado 3 da
      // rodada 1 da Tarefa 4). `desta ∪ semClasse` é a MESMA expressão que
      // levelup-cards.js usa; `ctx.classeQueSobe` (não o espelho
      // `char.classe`) porque é a classe em que o nível ENTRA.
      const candidatasTrocaNivel = preparadasPorClasse(ctx.char, ctx.classeQueSobe);
      const temMagiaTrocavel = [...candidatasTrocaNivel.desta, ...candidatasTrocaNivel.semClasse]
        .some(m => m.circulo > 0);
      return c.truquesGanhos > 0 || (c.tipoConj === 'conhecidas' && c.magiasGanhas > 0) || c.ehMago || !!subclasseArcana || temTruqueTrocavel || temMagiaTrocavel;
    },
    completo: (ctx, state) => {
      const c = calcularConjuracao(ctx, state);
      if (!c) return true;
      if (c.truquesGanhos > 0 && (state.truquesSelecionados || []).length !== c.truquesGanhos) return false;
      if (c.tipoConj === 'conhecidas' && c.magiasGanhas > 0 && (state.magiasSelecionadas || []).length !== c.magiasGanhas) return false;
      if (c.ehMago && (state.grimorioSelecionados || []).length !== c.grimorioQtd) return false;
      const subclasseArcana = calcularSubclasseArcana(ctx, state);
      if (subclasseArcana && (state.subclasseMagiasSelecionados || []).length !== subclasseArcana.quantidade) return false;
      return true;
    }
  },
  {
    id: 'manobras_guerreiro',
    titulo: 'Manobras (Mestre da Batalha)',
    tipo: 'escolha',
    obrigatorio: true,
    // Manobras são do nível de GUERREIRO e da subclasse de Guerreiro --
    // mesmos três argumentos que `subirDeNivel` usa (levelup.js).
    visivel: (ctx, state) => exigeManobrasGuerreiro(ctx.classeQueSobe, state?.subclasse || ctx.sub?.subclasse, ctx.nivelNaClasseNovo),
    completo: (ctx, state) => {
      if (!ctx.manobrasGuerreiro) return false;
      if ((state.manobrasNovasSelecionadas || []).length !== ctx.manobrasGuerreiro.qtdNova) return false;
      if (state.manobraTrocarDe && !state.manobraTrocarPara) return false;
      return true;
    }
  },
  {
    id: 'proficiencias_classe_nova',
    titulo: 'Proficiências da Classe Nova',
    tipo: 'escolha',
    obrigatorio: true,
    // So aparece no PRIMEIRO nivel naquela classe, e nunca no primeiro
    // nivel do PERSONAGEM (a classe inicial recebe pericias completas
    // pelo criador). Os dois campos existem separados de proposito --
    // ver regras-multiclasse-progressao.js:107. MESMO gate que
    // `ctx.concessoesClasseNova` ja aplicou em buildLevelUpContext; aqui
    // so falta checar se ha ALGO para escolher (Bardo/Guardiao/Ladino),
    // pois as outras 9 classes tem pericias:0 e instrumentos:0 no
    // proprio catalogo (dados-classes.js) e o step tem de ficar invisivel
    // para elas.
    visivel: (ctx) => Boolean(ctx.concessoesClasseNova)
      && (ctx.concessoesClasseNova.pericias > 0 || ctx.concessoesClasseNova.instrumentos > 0),
    // Delega em proficienciaClasseNovaCompleta (acima) -- ver o cabecalho
    // dela para o porque de NAO reimplementar a checagem aqui.
    completo: (ctx, state) => proficienciaClasseNovaCompleta(ctx, state)
  },
  {
    id: 'ritual_bonus_proficiencia',
    titulo: 'Magias Rituais (Bônus de Proficiência)',
    tipo: 'escolha',
    obrigatorio: true,
    // So aparece quando o invariante do talento esta em divida
    // (Talentos.md:370). Em quem nao tem o talento -- ou tem, mas o
    // Bonus de Proficiencia nao cruzou nenhum patamar nesta subida --
    // `ritualBonusPendente` devolve `faltam: 0` e o step nunca entra na
    // lista: sem este gate, TODO personagem veria este step e a subida de
    // nivel 5/9/13/17 travaria para quem nunca teve o talento.
    visivel: (ctx) => (ctx.ritualBonus?.faltam || 0) > 0,
    // Delega em ritualBonusProficienciaCompleto (acima) -- ver o cabecalho
    // dela para o porque de NAO reimplementar a checagem aqui.
    completo: (ctx, state) => ritualBonusProficienciaCompleto(ctx, state)
  },
  {
    id: 'revisao_confirmacao',
    titulo: 'Revisão e Confirmação',
    tipo: 'revisao',
    obrigatorio: true,
    // Sempre visível
    visivel: () => true,
    completo: () => true
  }
];

/**
 * Escolhas de subclasse exigidas neste nível (regras-subclasse-escolhas.js).
 * Le a subclasse de `state.subclasse || sub.subclasse`: no nível 3 ela está
 * sendo escolhida NESTA sessão e ainda não existe no personagem salvo -- sem
 * isso, a maioria das escolhas ficaria sem step, e a pendência de
 * subirDeNivel travaria a subida sem o jogador ter onde responder.
 * O nível é o NA CLASSE: a característica de subclasse vem do patamar da
 * classe que sobe, como `subirDeNivel` já decide (levelup.js).
 */
export function escolhasSubclasseDoNivel(ctx, state) {
  const subclasse = state?.subclasse || ctx?.sub?.subclasse;
  return linhasDaSubclasseNoNivel(subclasse, ctx?.nivelNaClasseNovo,
    truquesAoConfirmar(ctx, state)).filter((l) => l.tipo);
}

/**
 * As trocas de truque desta sessão, numa lista só: as já confirmadas pelo
 * botão "Adicionar outra troca" mais o par pendente, se estiver completo --
 * quem faz UMA troca só nunca clica naquele botão, e não pode perder a troca
 * por causa disso.
 */
function todasTrocasTruque(state) {
  return [
    ...(state?.trocasTruque || []),
    ...(state?.truqueTrocarDe && state?.truqueTrocarPara
      ? [{ de: state.truqueTrocarDe, para: state.truqueTrocarPara }] : []),
  ];
}

/**
 * O que ESTA sessão do assistente vai escrever em `char.magias_conhecidas`
 * antes de `subirDeNivel` ser chamado, e o conjunto de truques que sai disso.
 *
 * FONTE ÚNICA, e é esse o ponto. `confirmarLevelUp` (levelup-ui.js) empurra
 * truques escolhidos e trocas de truque para o personagem ANTES de chamar o
 * motor: a tela lê o personagem de antes, o motor o de depois. Para uma
 * característica condicionada ao que o personagem já sabe (Ilusões
 * Aprimoradas, Classes.md:5074) isso basta para os dois discordarem -- e a
 * discordância é uma confirmação RECUSADA por uma pendência que não tem
 * nenhum controle na página.
 *
 * Esta função existe para manter os dois de acordo, então ela não pode ser
 * uma SEGUNDA leitura da mesma regra: quem APLICA os empurrões
 * (`confirmarLevelUp`) consome `ganhos` e `trocas` daqui, e quem PREVÊ o
 * personagem (`escolhasSubclasseDoNivel`,
 * `popularEscolhasSubclasseAssincronas`) consome `conhecidos`. Uma expressão
 * só, dos dois lados. Duas cópias da mesma lista divergindo em silêncio é a
 * história que o cabeçalho de `regras-origens-magia.js` conta.
 *
 * As três guardas do empurrão vivem AQUI, e só aqui:
 *   1. nada acontece se a classe -- já com a subclasse escolhida nesta
 *      sessão -- não conjura (`ehConjuradorAtivo`);
 *   2. só entra truque que exista na lista da classe que sobe
 *      (`ctx._listaMagiasClasse`) e que o personagem ainda não tenha;
 *   3. só se aplica a troca cujo `de` esteja MESMO entre os truques do
 *      personagem naquele momento -- e a troca que não se aplica não traz o
 *      `para` junto.
 *
 * A troca conta pelos DOIS lados porque o caminho inverso existe do mesmo
 * jeito: trocar a Ilusão Menor FORA (possível quando ela é truque de classe,
 * sem origem especial) devolve o motor ao ramo automático, e a tela que
 * ainda mostrasse o seletor cobraria uma escolha que ninguém iria gravar.
 *
 * @returns {{ganhos: string[], trocas: Array<{de: string, para: string}>,
 *            conhecidos: Set<string>}}
 */
export function truquesDaSessao(ctx, state) {
  const conhecidos = truquesConhecidosDe(ctx?.char);
  const ganhos = [];
  const trocas = [];
  if (!ehConjuradorAtivo(ctx, state)) return { ganhos, trocas, conhecidos };
  const daClasseQueSobe = new Set((ctx?._listaMagiasClasse || []).map((m) => m?.nome));
  for (const nome of state?.truquesSelecionados || []) {
    if (!daClasseQueSobe.has(nome) || conhecidos.has(nome)) continue;
    ganhos.push(nome);
    conhecidos.add(nome);
  }
  // `conhecidos` já vem com os ganhos acima, e é atualizado a cada troca --
  // a mesma leitura incremental que `confirmarLevelUp` faz sobre o array
  // vivo, onde uma troca enxerga o resultado da anterior.
  for (const troca of todasTrocasTruque(state)) {
    if (!troca?.de || !conhecidos.has(troca.de)) continue;
    trocas.push(troca);
    conhecidos.delete(troca.de);
    if (troca.para) conhecidos.add(troca.para);
  }
  return { ganhos, trocas, conhecidos };
}

/**
 * Os truques que o personagem terá quando `subirDeNivel` for chamado.
 * Atalho de leitura sobre `truquesDaSessao` -- ver o cabeçalho dela.
 */
export function truquesAoConfirmar(ctx, state) {
  return truquesDaSessao(ctx, state).conhecidos;
}

/**
 * Constrói a lista de steps visíveis para o contexto atual.
 * @param {Object} ctx - Contexto do buildLevelUpContext
 * @param {Object} state - Estado atual das escolhas do usuário
 * @returns {Array} Steps visíveis (com ordem recalculada)
 */
export function buildVisibleSteps(ctx, state) {
  const visibles = STEP_DEFINITIONS.filter(s => s.visivel(ctx, state));
  return visibles.map((s, i) => ({
    ...s,
    titulo: s.id === 'aumento_atributo' && ctx.exigeDadivaEpica
      ? 'Dádiva Épica ou Outro Talento'
      : s.titulo,
    ordem: i,
    _completo: s.completo(ctx, state)
  }));
}

/**
 * Cria o estado inicial vazio para o fluxo de level up.
 * @param {Object} [char] - Personagem, usado so para pre-preencher classeQueSobe.
 */
export function createInitialState(char) {
  const classes = classesDe(char);
  return {
    // A classe em que o nivel entra. PRE-SELECAO SO COM UMA CLASSE: ai a
    // resposta e unica e o step 'escolha_classe' ja nasce completo. Com
    // duas ou mais o jogador tem de escolher, e o campo nasce vazio --
    // ver o comentario daquele step para o porque.
    classeQueSobe: classes.length === 1 ? classes[0].classe : '',
    // Dispensa explicita do pre-requisito de multiclasse (livro:2033) para
    // a classe travada escolhida acima -- ligado pelo botao "usar mesmo
    // assim" (levelup-cards.js/levelup-ui.js), nunca marcado sozinho.
    // Reconstruir o estado noutra classe (trocarClasseQueSobe) zera este
    // campo de proposito, como zera as outras escolhas: a dispensa e DA
    // classe escolhida, nao sobrevive a trocar de escolha.
    dispensarPrerequisito: false,
    // HP
    hpModo: 'fixo',
    hpRolado: 1,
    // Subclasse
    subclasse: '',
    // ASI
    asiModo: 'atributo',
    aumentos: {}, // { chave: valor }
    pontosDistribuidos: 0,
    talento: '',
    talentoData: null,
    talentoASI: '',
    escolhasTalento: [],
    talentoTipoEscolha: '',
    resilienteAtributo: '',
    iniciadoEmMagia: null,
    // Escolhas de classe
    bardoExpertise: [],
    guardiaoExpertise: [],
    estiloLuta: '',
    estiloLutaTrocarDe: '',
    estiloLutaTrocarPara: '',
    ladinoExpertise: [],
    exploradorExpertise: '',
    exploradorIdiomas: [],
    academicoExpertise: [],
    conhecimentoPrimordialPericia: '',
    // Escolhas de subclasse (regras-subclasse-escolhas.js): { campo: [valores] }.
    // Uma chave por linha da tabela que vale neste nivel; o card generico
    // preenche, collectOpcoes copia para `opcoes`.
    escolhasSubclasse: {},
    // Magias
    truquesSelecionados: [],
    magiasSelecionadas: [],
    grimorioSelecionados: [],
    subclasseMagiasSelecionados: [],
    // Magias rituais do Bônus de Proficiência (Conjurador Ritualista,
    // Talentos.md:370). TEM de nascer aqui pelo mesmo motivo de
    // periciaClasseNova/instrumentoClasseNova, acima: trocarClasseQueSobe
    // (levelup-ui.js) reconstrói o state inteiro com
    // `Object.assign(state, createInitialState(char), ...)`, que só
    // sobrescreve as chaves que este objeto DECLARA -- um campo ausente
    // sobreviveria intacto a uma troca de classe dentro do assistente.
    rituaisBonusSelecionados: [],
    // Trocas JA CONFIRMADAS nesta subida de nivel. Ao avancar um nivel o
    // jogador pode trocar QUANTAS magias e truques quiser (decisao de
    // produto, ver regras-preparo-magias.js) -- o Descanso Longo e que fica
    // com uma so. Cada entrada e { de, para, circulo }.
    trocasMagia: [],
    trocasTruque: [],
    // O par que esta sendo montado agora, ainda nao confirmado. Vira uma
    // entrada das listas acima quando o jogador clica "Adicionar outra
    // troca", e tambem e aplicado sozinho se ele terminar o nivel sem
    // clicar -- nao se perde troca por falta de um clique extra.
    trocarDe: '',
    trocarPara: '',
    trocarParaCirculo: 0,
    truqueTrocarDe: '',
    truqueTrocarPara: '',
    // Manobras (Mestre da Batalha)
    manobrasNovasSelecionadas: [],
    manobraTrocarDe: '',
    manobraTrocarPara: '',
    // Proficiências da Classe Nova (Bardo/Guardião/Ladino, livro:2051).
    // TÊM de nascer aqui: trocarClasseQueSobe (levelup-ui.js) reconstrói o
    // state inteiro com `Object.assign(state, createInitialState(char), ...)`,
    // e Object.assign só sobrescreve as chaves que o objeto de origem
    // DECLARA -- um campo ausente daqui sobrevive intacto a uma troca de
    // classe dentro do assistente. Sem esta declaração, escolher Persuasão
    // para Bardo e depois trocar a classe que sobe para Guardião deixava
    // `state.periciaClasseNova = 'Persuasão'` — uma perícia que Guardião
    // nem oferece — e o step reportava completo para uma escolha que o
    // motor recusaria (achado da revisão da Tarefa 4, rodada 1).
    periciaClasseNova: '',
    instrumentoClasseNova: '',
    // Navegação
    stepAtual: 0
  };
}

/**
 * Motor de navegação: avança para o próximo step visível.
 */
export function proximoStep(steps, state) {
  const idx = state.stepAtual;
  if (idx < steps.length - 1) {
    return idx + 1;
  }
  return idx;
}

/**
 * Motor de navegação: volta para o step anterior visível.
 */
export function stepAnterior(steps, state) {
  const idx = state.stepAtual;
  if (idx > 0) {
    return idx - 1;
  }
  return idx;
}

/**
 * Verifica se todos os steps obrigatórios estão completos.
 */
export function todosStepsCompletos(steps) {
  return steps.every(s => !s.obrigatorio || s._completo);
}
