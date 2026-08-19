// ============================================================
// Motor de Fluxo de Level Up - Cards Dinâmicos
// Fase 1: Contexto + Fase 2: Steps dinâmicos
// ============================================================
import { CLASSES_INFO, ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, ESCOLAS_SUBCLASSE_MAGO } from './dados-classes.js';
import { linhasDaSubclasseNoNivel } from './regras-subclasse-escolhas.js';
import { getClasse, getMagiasClasse, getMagiasPorCirculo } from './db.js';
import { getTruquesFixosSubclasse } from './regras-conjuracao-subclasse.js';
import {
  calcMod, bonusProficiencia, getBonusTruquesOrdem, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas
} from './utils.js';
import {
  concedeAumentoAtributo, exigeDadivaEpica, exigeSubclasse,
  exigeEspecializacaoBardo, exigeEspecializacaoGuardiao, exigeEspecializacaoLadino,
  exigeEstiloLuta, exigeTrocaEstiloLutaGuerreiro, exigeExploradorHabil, exigeAcademico,
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
 * @param {number} nivelAtual - Nível antes de subir
 * @param {number} nivelNovo - Nível depois de subir
 * @param {string|null} subclasseEfetiva - Subclasse a considerar
 * @returns {{ehConjurador:boolean, tipoConj:string, conjuracao:Object|null}}
 */
function montarConjuracao(char, classeData, info, helpers, nivelAtual, nivelNovo, subclasseEfetiva) {
  const consultarSubclasse = (nivel) => helpers.getSubclasseConjuradoraConjuracao
    ? helpers.getSubclasseConjuradoraConjuracao({ subclasse: subclasseEfetiva || null, nivel })
    : null;
  const subAtual = consultarSubclasse(nivelAtual);
  const subNovo = consultarSubclasse(nivelNovo);
  const ehSubConj = !!subNovo;
  const ehConjurador = !!(info?.conjurador || ehSubConj);
  const tipoConj = info?.tipo_conjuracao || (ehSubConj ? 'conhecidas' : 'preparadas');
  if (!ehConjurador) return { ehConjurador, tipoConj, conjuracao: null };

  const tabela = classeData?.tabela_caracteristicas;
  let truquesAtual = tabela ? getTruquesConhecidos(tabela, nivelAtual) : 0;
  let truquesNovo = tabela ? getTruquesConhecidos(tabela, nivelNovo) : 0;
  let magiasAtual = tabela ? getMagiaPreparadas(tabela, nivelAtual) : 0;
  let magiasNovo = tabela ? getMagiaPreparadas(tabela, nivelNovo) : 0;

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
  const truquesFixosNovos = getTruquesFixosSubclasse(char.classe, subclasseEfetiva, nivelNovo)
    .filter(nome => !(char.magias_conhecidas || []).some(m => m.nome === nome));

  // Espaços de magia no nível novo
  let espacosNovo = tabela ? getEspacosMagia(tabela, nivelNovo) : {};
  if (ehSubConj && Object.keys(espacosNovo).length === 0) {
    // A tabela da subclasse guarda só o total por círculo ({1: 2}); aqui o
    // formato precisa ser o mesmo de getEspacosMagia ({1: {total, usados}}).
    espacosNovo = Object.fromEntries(Object.entries(subNovo?.espacos || {})
      .map(([circulo, total]) => [circulo, { total, usados: 0 }]));
  }
  const maxCirculoNovo = Math.max(...Object.keys(espacosNovo).map(Number), 0);

  // Ganhou um círculo de magia totalmente novo neste nível (independe de já saber a escola/subclasse)
  let espacosAntes = nivelAtual >= 1 ? getEspacosMagia(tabela, nivelAtual) : {};
  if (ehSubConj && Object.keys(espacosAntes).length === 0) {
    espacosAntes = Object.fromEntries(Object.entries(subAtual?.espacos || {})
      .map(([circulo, total]) => [circulo, { total, usados: 0 }]));
  }
  const ganhouNovoCirculo = Object.entries(espacosNovo).some(([c, d]) =>
    (d?.total || 0) > 0 && (espacosAntes[c]?.total || 0) === 0);

  const escolaSubclasse = char.classe === 'Mago' &&
    Object.prototype.hasOwnProperty.call(ESCOLAS_SUBCLASSE_MAGO, subclasseEfetiva)
    ? ESCOLAS_SUBCLASSE_MAGO[subclasseEfetiva] : null;
  let subclasseArcana = null;
  if (escolaSubclasse) {
    let quantidade = 0;
    if (nivelNovo === 3) {
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
      ehMago: char.classe === 'Mago',
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
 * @param {Object} classeData - Dados carregados da classe (getClasse)
 * @param {Object} helpers - Funções auxiliares do sheet.js (ehSubclasseConjuradora, getSubclasseConjuradoraConjuracao, etc.)
 * @returns {Object} ctx - Contexto completo
 */
export async function buildLevelUpContext(char, classeData, helpers = {}) {
  const nivelAtual = char.nivel || 1;
  const nivelNovo = nivelAtual + 1;
  const info = CLASSES_INFO[char.classe];
  const modCon = calcMod(char.atributos.constituicao);
  const hpGanhoFixo = Math.max(1, Math.floor(info.dado_vida / 2) + 1 + modCon);

  // Flags de regras
  const precisaSubclasse = exigeSubclasse(char.classe, nivelNovo) && !char.subclasse;
  const ganhaASI = concedeAumentoAtributo(char.classe, nivelNovo);
  const exigeDadivaEpicaNivel = exigeDadivaEpica(char.classe, nivelNovo);
  const precisaExpertiseBardo = exigeEspecializacaoBardo(char.classe, nivelNovo);
  const precisaExpertiseGuardiao = exigeEspecializacaoGuardiao(char.classe, nivelNovo);
  const precisaEstiloLuta = exigeEstiloLuta(char.classe, nivelNovo);
  // Troca de Estilo de Luta do Guerreiro (Classes.md:3812): opcional, por
  // isso não entra em `requirements` (que só lista pendências
  // obrigatórias) -- só controla se o card de troca aparece na tela.
  const podeTrocarEstiloLutaGuerreiro = exigeTrocaEstiloLutaGuerreiro(char.classe, nivelNovo);
  // Especialização adicional do Ladino (Classes.md:4188, nível 6):
  // também opcional -- subirDeNivel preenche sozinho se o jogador não
  // escolher (ver levelup.js).
  const precisaExpertiseLadino = exigeEspecializacaoLadino(char.classe, nivelNovo);
  const precisaExploradorHabil = exigeExploradorHabil(char.classe, nivelNovo);
  const precisaAcademico = exigeAcademico(char.classe, nivelNovo);
  let manobrasGuerreiro = null;
  if (char.classe === 'Guerreiro') {
    const opcoesDisponiveis = classeData?.subclasses
      ?.find(sc => sc.nome === 'Mestre da Batalha')?.opcoes_manobra || [];
    manobrasGuerreiro = {
      opcoesDisponiveis,
      qtdNova: getQuantidadeNovasManobras(nivelNovo),
      manobrasConhecidasAtuais: char.manobras_conhecidas || []
    };
  }

  // Características ganhas neste nível
  const caracteristicas = await obterCaracteristicasNivel(char.classe, nivelNovo);
  const caracteristicasEspecie = await obterCaracteristicasEspecieNivel(char.especie, nivelNovo, char.tracos_escolhidos);
  const caracteristicasSubclasse = char.subclasse
    ? await obterCaracteristicasSubclasseNivel(char.classe, char.subclasse, nivelNovo)
    : [];
  const magiasDominioNivel = char.subclasse
    ? await obterMagiasDominioNivel(char.classe, char.subclasse, nivelNovo)
    : [];
  const magiasSempreNivel = char.subclasse
    ? await obterMagiasSemprePreparadasNivel(char.classe, char.subclasse, nivelNovo)
    : [];

  // Subclasses disponíveis
  let subclassesDisponiveis = [];
  if (precisaSubclasse && classeData?.subclasses) {
    subclassesDisponiveis = classeData.subclasses
      .filter(sc => !sc.nome.toLowerCase().startsWith('subclasses de'));
  }

  // Conjuração — congelada sobre `char.subclasse`, ver `calcularConjuracao`
  const { ehConjurador, tipoConj, conjuracao } = montarConjuracao(
    char, classeData, info, helpers, nivelAtual, nivelNovo, char.subclasse);

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
  if (ehConjurador && conjuracao) {
    if (conjuracao.truquesGanhos > 0) requirements.push({ tipo: 'truques', label: `Selecionar ${conjuracao.truquesGanhos} truque(s)` });
    if (tipoConj === 'conhecidas' && conjuracao.magiasGanhas > 0) requirements.push({ tipo: 'magias_conhecidas', label: `Selecionar ${conjuracao.magiasGanhas} magia(s)` });
    if (conjuracao.ehMago) requirements.push({ tipo: 'grimorio', label: 'Grimório: +2 magias' });
    if (conjuracao.subclasseArcana) requirements.push({
      tipo: 'subclasse_magias_arcana',
      label: `${conjuracao.subclasseArcana.escola}: +${conjuracao.subclasseArcana.quantidade} magia(s)`
    });
  }

  // Bônus de proficiência
  const bonusAnterior = bonusProficiencia(nivelAtual);
  const bonusNovo = bonusProficiencia(nivelNovo);

  return {
    char,
    classeData,
    info,
    nivelAtual,
    nivelNovo,
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
    helpers
  };
}

/**
 * Calcula a exigência de "Versado em Escola" (magias grátis de subclasse arcana do Mago)
 * de forma reativa ao estado do fluxo de level-up: usa `state.subclasse` (escolha feita
 * nesta mesma sessão) com fallback para `ctx.char.subclasse` (escolha de level-ups anteriores).
 * Não depende do valor congelado calculado em `buildLevelUpContext`, que só enxerga
 * `char.subclasse` no momento em que o contexto foi construído.
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
  const subclasseEfetiva = state?.subclasse || ctx.char?.subclasse || null;
  if (!ctx._conjuracaoCache) ctx._conjuracaoCache = new Map();
  const chave = subclasseEfetiva || '';
  if (!ctx._conjuracaoCache.has(chave)) {
    ctx._conjuracaoCache.set(chave, montarConjuracao(
      ctx.char, ctx.classeData, ctx.info, ctx.helpers || {},
      ctx.nivelAtual, ctx.nivelNovo, subclasseEfetiva));
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
  const subclasseEfetiva = state?.subclasse || ctx.char?.subclasse || null;
  if (!ctx.helpers?.obterMagiasDisponiveisClasseAtual) return ctx._listaMagiasClasse || [];
  if (!ctx._magiasCache) ctx._magiasCache = new Map();
  const chave = subclasseEfetiva || '';
  if (!ctx._magiasCache.has(chave)) {
    ctx._magiasCache.set(chave, await ctx.helpers.obterMagiasDisponiveisClasseAtual(
      { subclasse: subclasseEfetiva, nivel: ctx.nivelNovo }));
  }
  const lista = ctx._magiasCache.get(chave) || [];
  // Os consumidores de tela leem ctx._listaMagiasClasse; manter sincronizado
  // evita que uma re-renderização use a lista da subclasse anterior.
  ctx._listaMagiasClasse = lista;
  return lista;
}

export function calcularSubclasseArcana(ctx, state) {
  const subclasseEfetiva = state?.subclasse || ctx.char?.subclasse;
  const escolaSubclasse = ctx.char?.classe === 'Mago' &&
    Object.prototype.hasOwnProperty.call(ESCOLAS_SUBCLASSE_MAGO, subclasseEfetiva)
    ? ESCOLAS_SUBCLASSE_MAGO[subclasseEfetiva] : null;
  const conjuracao = calcularConjuracao(ctx, state);
  if (!escolaSubclasse || !conjuracao) return null;
  let quantidade = 0;
  if (ctx.nivelNovo === 3) {
    quantidade += 2;
  } else if (conjuracao.ganhouNovoCirculo) {
    quantidade += 1;
  }
  if (quantidade === 0) return null;
  return { escola: escolaSubclasse, quantidade, circuloMax: conjuracao.maxCirculoNovo };
}

// ---- Fase 2: Motor de steps dinâmicos ----

/**
 * Definição declarativa dos steps.
 * Cada step tem id, título, tipo, e funções de visibilidade/completude.
 */
const STEP_DEFINITIONS = [
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
                       escolhasSubclasseDoNivel(ctx, state).length > 0,
    completo: (ctx, state) => {
      if (ctx.precisaExpertiseBardo && (state.bardoExpertise || []).length !== 2) return false;
      if (ctx.precisaExpertiseGuardiao && (state.guardiaoExpertise || []).length !== 2) return false;
      if (ctx.precisaEstiloLuta && !state.estiloLuta) return false;
      if (ctx.precisaExploradorHabil && (!state.exploradorExpertise || (state.exploradorIdiomas || []).length !== 2)) return false;
      if (ctx.precisaAcademico && (state.academicoExpertise || []).length !== 1) return false;
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
      // pois deriva de ctx.char.classe, que não muda durante o level-up), mas mantido
      // explícito via calcularSubclasseArcana para não depender de ctx.conjuracao.subclasseArcana
      // (congelado) e para deixar a intenção clara caso a regra mude no futuro.
      const subclasseArcana = calcularSubclasseArcana(ctx, state);
      // Task 1: a troca de truque é universal a qualquer classe que conheça truques de
      // classe, mesmo em níveis sem ganho de truque/magia novo - então o step também
      // precisa ficar visível quando há pelo menos 1 truque elegível para troca (mesma
      // lista de origens especiais usada no card de troca em levelup-cards.js).
      const origensEspeciais = ['especie', 'sempre', 'especie_legado', 'iniciado_em_magia', 'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista', 'subclasse_fixa', 'subclasse_automatica'];
      const temTruqueTrocavel = (ctx.char.magias_conhecidas || []).some(m => m.circulo === 0 && !origensEspeciais.includes(m?.origem));
      // 2026-08-13: a troca de MAGIA passou a valer para toda classe
      // conjuradora (antes so `conhecidas` -- ver levelup-cards.js). Um
      // Clerigo/Druida/Paladino/Guardiao num nivel sem truque novo e sem
      // magia nova nao tinha nenhuma outra razao para este step aparecer,
      // e o card de troca ficaria renderizado numa tela invisivel. Mesma
      // lista de origens especiais do card (`dominio` entra aqui, porque
      // magia de dominio nao e escolha do jogador e nao pode ser trocada).
      const origensEspeciaisMagia = ['dominio', ...origensEspeciais];
      const temMagiaTrocavel = (ctx.char.magias_preparadas || []).some(m => m.circulo > 0 && !origensEspeciaisMagia.includes(m?.origem));
      return c.truquesGanhos > 0 || (c.tipoConj === 'conhecidas' && c.magiasGanhas > 0) || c.ehMago || !!subclasseArcana || temTruqueTrocavel || temMagiaTrocavel;
    },
    completo: (ctx, state) => {
      const c = calcularConjuracao(ctx, state);
      if (!c) return true;
      if (c.truquesGanhos > 0 && (state.truquesSelecionados || []).length !== c.truquesGanhos) return false;
      if (c.tipoConj === 'conhecidas' && c.magiasGanhas > 0 && (state.magiasSelecionadas || []).length !== c.magiasGanhas) return false;
      if (c.ehMago && (state.grimorioSelecionados || []).length !== 2) return false;
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
    visivel: (ctx, state) => exigeManobrasGuerreiro(ctx.char.classe, state?.subclasse || ctx.char.subclasse, ctx.nivelNovo),
    completo: (ctx, state) => {
      if (!ctx.manobrasGuerreiro) return false;
      if ((state.manobrasNovasSelecionadas || []).length !== ctx.manobrasGuerreiro.qtdNova) return false;
      if (state.manobraTrocarDe && !state.manobraTrocarPara) return false;
      return true;
    }
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
 * Le a subclasse de `state.subclasse || char.subclasse`: no nível 3 ela está
 * sendo escolhida NESTA sessão e ainda não existe no personagem salvo -- sem
 * isso, a maioria das escolhas ficaria sem step, e a pendência de
 * subirDeNivel travaria a subida sem o jogador ter onde responder.
 */
export function escolhasSubclasseDoNivel(ctx, state) {
  const subclasse = state?.subclasse || ctx?.char?.subclasse;
  return linhasDaSubclasseNoNivel(subclasse, ctx?.nivelNovo).filter((l) => l.tipo);
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
 */
export function createInitialState() {
  return {
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
    // Escolhas de subclasse (regras-subclasse-escolhas.js): { campo: [valores] }.
    // Uma chave por linha da tabela que vale neste nivel; o card generico
    // preenche, collectOpcoes copia para `opcoes`.
    escolhasSubclasse: {},
    // Magias
    truquesSelecionados: [],
    magiasSelecionadas: [],
    grimorioSelecionados: [],
    subclasseMagiasSelecionados: [],
    trocarDe: '',
    trocarPara: '',
    trocarParaCirculo: 0,
    truqueTrocarDe: '',
    truqueTrocarPara: '',
    // Manobras (Mestre da Batalha)
    manobrasNovasSelecionadas: [],
    manobraTrocarDe: '',
    manobraTrocarPara: '',
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
