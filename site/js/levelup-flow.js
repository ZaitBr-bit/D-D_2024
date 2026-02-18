// ============================================================
// Motor de Fluxo de Level Up - Cards Dinâmicos
// Fase 1: Contexto + Fase 2: Steps dinâmicos
// ============================================================
import { CLASSES_INFO, ATRIBUTOS_KEYS, ATRIBUTOS_NOMES } from './dados-classes.js';
import { getClasse, getMagiasClasse, getMagiasPorCirculo } from './db.js';
import {
  calcMod, bonusProficiencia, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas
} from './utils.js';
import {
  concedeAumentoAtributo, exigeSubclasse,
  exigeEspecializacaoBardo, exigeEspecializacaoGuardiao,
  exigeEstiloLuta, exigeExploradorHabil, exigeAcademico,
  obterCaracteristicasNivel, obterCaracteristicasEspecieNivel,
  obterCaracteristicasSubclasseNivel, obterMagiasDominioNivel
} from './levelup.js';

// ---- Fase 1: Construir contexto de level up ----

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
  const precisaExpertiseBardo = exigeEspecializacaoBardo(char.classe, nivelNovo);
  const precisaExpertiseGuardiao = exigeEspecializacaoGuardiao(char.classe, nivelNovo);
  const precisaEstiloLuta = exigeEstiloLuta(char.classe, nivelNovo);
  const precisaExploradorHabil = exigeExploradorHabil(char.classe, nivelNovo);
  const precisaAcademico = exigeAcademico(char.classe, nivelNovo);

  // Características ganhas neste nível
  const caracteristicas = await obterCaracteristicasNivel(char.classe, nivelNovo);
  const caracteristicasEspecie = await obterCaracteristicasEspecieNivel(char.especie, nivelNovo);
  const caracteristicasSubclasse = char.subclasse
    ? await obterCaracteristicasSubclasseNivel(char.classe, char.subclasse, nivelNovo)
    : [];
  const magiasDominioNivel = char.subclasse
    ? await obterMagiasDominioNivel(char.classe, char.subclasse, nivelNovo)
    : [];

  // Subclasses disponíveis
  let subclassesDisponiveis = [];
  if (precisaSubclasse && classeData?.subclasses) {
    subclassesDisponiveis = classeData.subclasses
      .filter(sc => !sc.nome.toLowerCase().startsWith('subclasses de'));
  }

  // Conjuração
  const ehSubConj = helpers.ehSubclasseConjuradora?.() || false;
  const ehConjurador = !!(info.conjurador || ehSubConj);
  const tipoConj = info.tipo_conjuracao || (ehSubConj ? 'conhecidas' : 'preparadas');

  let conjuracao = null;
  if (ehConjurador) {
    const tabela = classeData?.tabela_caracteristicas;
    let truquesAtual = tabela ? getTruquesConhecidos(tabela, nivelAtual) : 0;
    let truquesNovo = tabela ? getTruquesConhecidos(tabela, nivelNovo) : 0;
    let magiasAtual = tabela ? getMagiaPreparadas(tabela, nivelAtual) : 0;
    let magiasNovo = tabela ? getMagiaPreparadas(tabela, nivelNovo) : 0;

    // Para subclasses conjuradoras, calcular limites da tabela da subclasse
    if (ehSubConj && helpers.getSubclasseConjuradoraConjuracao) {
      const subAtual = helpers.getSubclasseConjuradoraConjuracao();
      // Simular nível novo temporariamente
      const nivelOriginal = char.nivel;
      char.nivel = nivelNovo;
      const subNovo = helpers.getSubclasseConjuradoraConjuracao();
      char.nivel = nivelOriginal;
      truquesAtual = subAtual?.truques || 0;
      truquesNovo = subNovo?.truques || 0;
      magiasAtual = subAtual?.preparadas || 0;
      magiasNovo = subNovo?.preparadas || 0;
    }

    // Espaços de magia no nível novo
    let espacosNovo = tabela ? getEspacosMagia(tabela, nivelNovo) : {};
    if (ehSubConj && Object.keys(espacosNovo).length === 0 && helpers.getSubclasseConjuradoraConjuracao) {
      const nivelOriginal = char.nivel;
      char.nivel = nivelNovo;
      const subNovo = helpers.getSubclasseConjuradoraConjuracao();
      char.nivel = nivelOriginal;
      espacosNovo = subNovo?.espacos || {};
    }
    const maxCirculoNovo = Math.max(...Object.keys(espacosNovo).map(Number), 0);

    conjuracao = {
      tipoConj,
      truquesAtual,
      truquesNovo,
      truquesGanhos: truquesNovo - truquesAtual,
      magiasAtual,
      magiasNovo,
      magiasGanhas: magiasNovo - magiasAtual,
      maxCirculoNovo,
      espacosNovo,
      ehMago: char.classe === 'Mago'
    };
  }

  // Requirements: array de pendências obrigatórias
  const requirements = [];
  if (precisaSubclasse) requirements.push({ tipo: 'subclasse', label: 'Escolher subclasse' });
  if (ganhaASI) requirements.push({ tipo: 'asi', label: 'Distribuir 2 pontos de atributo ou Talento' });
  if (precisaExpertiseBardo) requirements.push({ tipo: 'bardo_expertise', label: 'Especialização do Bardo (2 perícias)' });
  if (precisaExpertiseGuardiao) requirements.push({ tipo: 'guardiao_expertise', label: 'Especialista do Guardião (2 perícias)' });
  if (precisaEstiloLuta) requirements.push({ tipo: 'estilo_luta', label: 'Escolher Estilo de Luta' });
  if (precisaExploradorHabil) requirements.push({ tipo: 'explorador_habil', label: 'Explorador Hábil (1 perícia + 2 idiomas)' });
  if (precisaAcademico) requirements.push({ tipo: 'academico', label: 'Acadêmico do Mago (2 perícias)' });
  if (ehConjurador && conjuracao) {
    if (conjuracao.truquesGanhos > 0) requirements.push({ tipo: 'truques', label: `Selecionar ${conjuracao.truquesGanhos} truque(s)` });
    if (tipoConj === 'conhecidas' && conjuracao.magiasGanhas > 0) requirements.push({ tipo: 'magias_conhecidas', label: `Selecionar ${conjuracao.magiasGanhas} magia(s)` });
    if (conjuracao.ehMago) requirements.push({ tipo: 'grimorio', label: 'Grimório: +2 magias' });
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
    precisaExpertiseBardo,
    precisaExpertiseGuardiao,
    precisaEstiloLuta,
    precisaExploradorHabil,
    precisaAcademico,
    caracteristicas,
    caracteristicasEspecie,
    caracteristicasSubclasse,
    magiasDominioNivel,
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
      if (state.asiModo === 'talento') return !!state.talento;
      if (state.asiModo === 'atributo') return state.pontosDistribuidos === 2;
      return false;
    }
  },
  {
    id: 'escolhas_classe',
    titulo: 'Escolhas de Classe',
    tipo: 'escolha',
    obrigatorio: true,
    visivel: (ctx) => ctx.precisaExpertiseBardo || ctx.precisaExpertiseGuardiao ||
                       ctx.precisaEstiloLuta || ctx.precisaExploradorHabil || ctx.precisaAcademico,
    completo: (ctx, state) => {
      if (ctx.precisaExpertiseBardo && (state.bardoExpertise || []).length !== 2) return false;
      if (ctx.precisaExpertiseGuardiao && (state.guardiaoExpertise || []).length !== 2) return false;
      if (ctx.precisaEstiloLuta && !state.estiloLuta) return false;
      if (ctx.precisaExploradorHabil && (!state.exploradorExpertise || (state.exploradorIdiomas || []).length !== 2)) return false;
      if (ctx.precisaAcademico && (state.academicoExpertise || []).length !== 2) return false;
      return true;
    }
  },
  {
    id: 'selecao_magias',
    titulo: 'Seleção de Magias',
    tipo: 'magia',
    obrigatorio: true,
    visivel: (ctx) => {
      if (!ctx.ehConjurador || !ctx.conjuracao) return false;
      const c = ctx.conjuracao;
      return c.truquesGanhos > 0 || (c.tipoConj === 'conhecidas' && c.magiasGanhas > 0) || c.ehMago;
    },
    completo: (ctx, state) => {
      const c = ctx.conjuracao;
      if (!c) return true;
      if (c.truquesGanhos > 0 && (state.truquesSelecionados || []).length !== c.truquesGanhos) return false;
      if (c.tipoConj === 'conhecidas' && c.magiasGanhas > 0 && (state.magiasSelecionadas || []).length !== c.magiasGanhas) return false;
      if (c.ehMago && (state.grimorioSelecionados || []).length !== 2) return false;
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
 * Constrói a lista de steps visíveis para o contexto atual.
 * @param {Object} ctx - Contexto do buildLevelUpContext
 * @param {Object} state - Estado atual das escolhas do usuário
 * @returns {Array} Steps visíveis (com ordem recalculada)
 */
export function buildVisibleSteps(ctx, state) {
  const visibles = STEP_DEFINITIONS.filter(s => s.visivel(ctx, state));
  return visibles.map((s, i) => ({
    ...s,
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
    exploradorExpertise: '',
    exploradorIdiomas: [],
    academicoExpertise: [],
    // Magias
    truquesSelecionados: [],
    magiasSelecionadas: [],
    grimorioSelecionados: [],
    trocarDe: '',
    trocarPara: '',
    trocarParaCirculo: 0,
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
