// ============================================================
// Validações e Coleta de opções do Level Up
// Fase 4: Coleta unificada e submissão
// ============================================================
import { exigeManobrasGuerreiro } from './levelup.js';
import { validarEscolhasTalento } from './regras-cobertura.js';
import { calcularSubclasseArcana } from './levelup-flow.js';

function precisaManobrasAgora(ctx, state) {
  return exigeManobrasGuerreiro(ctx.char.classe, state.subclasse || ctx.char.subclasse, ctx.nivelNovo);
}

/**
 * Consolida o state do fluxo no formato esperado por subirDeNivel().
 * @param {Object} ctx - Contexto
 * @param {Object} state - Estado das escolhas
 * @returns {Object} opcoes compatíveis com levelup.js
 */
export function collectOpcoes(ctx, state) {
  const opcoes = { ignorar_xp: true };

  // HP
  opcoes.hp_modo = state.hpModo;
  if (state.hpModo === 'rolado') {
    opcoes.hp_rolado = state.hpRolado;
  }

  // Subclasse
  if (ctx.precisaSubclasse && state.subclasse) {
    opcoes.subclasse = state.subclasse;
  }

  // ASI
  if (ctx.ganhaASI) {
    if (state.asiModo === 'atributo') {
      const aumentos = {};
      for (const [key, val] of Object.entries(state.aumentos)) {
        if (val > 0) aumentos[key] = val;
      }
      opcoes.aumentos_atributo = aumentos;
    } else if (state.asiModo === 'talento' && state.talento) {
      opcoes.talento = state.talento;
      if (state.talento === 'Aumento no Valor de Atributo') {
        opcoes.aumentos_atributo = { ...state.aumentos };
      }
      if (state.talentoASI) opcoes.talento_asi = state.talentoASI;
      if (state.escolhasTalento.length > 0) opcoes.escolhas_talento_levelup = state.escolhasTalento;
      if (state.talentoTipoEscolha) opcoes.talento_tipo_escolha = state.talentoTipoEscolha;
      if (state.resilienteAtributo || state.talento === 'Resiliente') opcoes.resiliente_atributo = state.resilienteAtributo || state.talentoASI;
      if (state.iniciadoEmMagia) opcoes.iniciado_em_magia = state.iniciadoEmMagia;
      // Parâmetros de Dádiva da Resistência à Energia
      if (state.dadivaResistenciaEnergia?.length > 0) opcoes.dadiva_resistencia_energia = state.dadivaResistenciaEnergia;
    }
  }

  // Escolhas de classe
  if (ctx.precisaExpertiseBardo) opcoes.bardo_expertise = state.bardoExpertise;
  if (ctx.precisaExpertiseGuardiao) opcoes.guardiao_expertise = state.guardiaoExpertise;
  if (ctx.precisaEstiloLuta && state.estiloLuta) opcoes.estilo_luta = state.estiloLuta;
  if (ctx.precisaExploradorHabil) {
    opcoes.explorador_expertise = state.exploradorExpertise;
    opcoes.explorador_idiomas = state.exploradorIdiomas;
  }
  if (ctx.precisaAcademico) opcoes.academico_expertise = state.academicoExpertise;
  if (ctx.conjuracao?.ehMago) opcoes.grimorio_selecionados = state.grimorioSelecionados || [];
  const subclasseArcana = calcularSubclasseArcana(ctx, state);
  if (subclasseArcana) opcoes.subclasse_magias_selecionadas = state.subclasseMagiasSelecionados || [];

  // Manobras (Mestre da Batalha)
  const precisaManobrasLive = precisaManobrasAgora(ctx, state);
  if (precisaManobrasLive) {
    opcoes.manobras_novas = state.manobrasNovasSelecionadas || [];
    if (state.manobraTrocarDe && state.manobraTrocarPara) {
      opcoes.manobra_trocar_de = state.manobraTrocarDe;
      opcoes.manobra_trocar_para = state.manobraTrocarPara;
    }
  }

  return opcoes;
}

/**
 * Valida todas as pendências obrigatórias antes de submeter.
 * @returns {string|null} Mensagem de erro ou null se tudo ok.
 */
export function validateAll(ctx, state) {
  const precisaManobrasLive = precisaManobrasAgora(ctx, state);

  if (ctx.precisaSubclasse && !state.subclasse) return 'Escolha uma subclasse.';

  if (ctx.ganhaASI) {
    if (ctx.exigeDadivaEpica && state.asiModo !== 'talento')
      return 'Selecione uma Dádiva Épica ou outro talento.';
    if (state.asiModo === 'atributo' && state.pontosDistribuidos !== 2)
      return 'Distribua exatamente 2 pontos de atributo.';
    if (state.asiModo === 'talento' && !state.talento)
      return 'Selecione um talento.';
    if (state.asiModo === 'talento' && state.talento === 'Aumento no Valor de Atributo' && state.pontosDistribuidos !== 2)
      return 'Distribua exatamente 2 pontos de atributo para o talento Aumento no Valor de Atributo.';
    // Validar escolha de tipos de energia da Dádiva da Resistência à Energia
    if (state.asiModo === 'talento' && state.talento === 'Dádiva da Resistência à Energia') {
      const tipos = state.dadivaResistenciaEnergia || [];
      if (tipos.length !== 2) return 'Selecione 2 tipos de energia para a Dádiva da Resistência à Energia.';
      if (tipos[0] === tipos[1]) return 'Os dois tipos de energia devem ser diferentes.';
    }
    if (state.asiModo === 'talento' && state.talento === 'Dádiva da Proficiência em Perícia') {
      const escolhas = state.escolhasTalento || [];
      const pericia = escolhas.length === 1 ? escolhas[0] : '';
      if (!pericia || !(ctx.char.pericias_proficientes || []).includes(pericia) ||
          (ctx.char.pericias_expertise || []).includes(pericia)) {
        return 'Escolha uma perícia em que já possua proficiência e ainda não tenha Especialização.';
      }
    }
    if (state.asiModo === 'talento' && ['Habilidoso', 'Artifista', 'Músico'].includes(state.talento)) {
      const escolhas = state.escolhasTalento || [];
      if (escolhas.length !== 3 || new Set(escolhas).size !== 3) {
        return `Selecione 3 opções diferentes para ${state.talento}.`;
      }
    }
    if (state.asiModo === 'talento' && state.talento) {
      const validacaoTalento = validarEscolhasTalento(ctx.char, state.talento, {
        atributo: state.talentoASI || state.resilienteAtributo || state.iniciadoEmMagia?.atributo,
        talento_asi: state.talentoASI,
        selecoes: state.escolhasTalento || [],
        magia: state.escolhasTalento?.[0],
        rituais: state.talento === 'Conjurador Ritualista' ? state.escolhasTalento : undefined,
        energias: state.dadivaResistenciaEnergia,
        iniciado_em_magia: state.iniciadoEmMagia
      });
      if (!validacaoTalento.valido) return validacaoTalento.erro;
    }
  }

  if (ctx.precisaExpertiseBardo && state.bardoExpertise.length !== 2) return 'Selecione 2 perícias para Especialização do Bardo.';
  if (ctx.precisaExpertiseGuardiao && state.guardiaoExpertise.length !== 2) return 'Selecione 2 perícias para Especialista do Guardião.';
  if (ctx.precisaEstiloLuta && !state.estiloLuta) return 'Selecione um Estilo de Luta.';
  if (ctx.precisaExploradorHabil && !state.exploradorExpertise) return 'Selecione 1 perícia para Explorador Hábil.';
  if (ctx.precisaExploradorHabil && state.exploradorIdiomas.length !== 2) return 'Selecione 2 idiomas (Explorador Hábil).';
  if (ctx.precisaAcademico) {
    const periciasAcademicas = new Set(['Arcanismo', 'História', 'Investigação', 'Medicina', 'Natureza', 'Religião']);
    const pericia = state.academicoExpertise[0];
    if (state.academicoExpertise.length !== 1 || !periciasAcademicas.has(pericia) ||
        !(ctx.char.pericias_proficientes || []).includes(pericia) ||
        (ctx.char.pericias_expertise || []).includes(pericia)) {
      return 'Selecione 1 perícia acadêmica elegível em que você já é proficiente para Acadêmico.';
    }
  }

  if (precisaManobrasLive && ctx.manobrasGuerreiro) {
    if ((state.manobrasNovasSelecionadas || []).length !== ctx.manobrasGuerreiro.qtdNova)
      return `Selecione ${ctx.manobrasGuerreiro.qtdNova} manobra(s) (Mestre da Batalha).`;
    if (state.manobraTrocarDe && !state.manobraTrocarPara)
      return 'Escolha a manobra substituta ou desmarque a troca.';
  }

  if (ctx.ehConjurador && ctx.conjuracao) {
    const c = ctx.conjuracao;
    if (c.truquesGanhos > 0 && state.truquesSelecionados.length !== c.truquesGanhos)
      return `Selecione ${c.truquesGanhos} truque(s).`;
    if (c.tipoConj === 'conhecidas' && c.magiasGanhas > 0 && state.magiasSelecionadas.length !== c.magiasGanhas)
      return `Selecione ${c.magiasGanhas} magia(s) conhecida(s).`;
    if (c.ehMago) {
      const selecionadas = state.grimorioSelecionados || [];
      const nomesNoGrimorio = new Set((ctx.char.grimorio || []).map(m => m?.nome));
      const magiasPorNome = new Map((ctx._listaMagiasClasse || []).map(m => [m.nome, m]));
      const escolhasValidas = selecionadas.length === 2 && new Set(selecionadas).size === 2 &&
        selecionadas.every(nome => {
          const magia = magiasPorNome.get(nome);
          return magia && magia.circulo > 0 && magia.circulo <= c.maxCirculoNovo && !nomesNoGrimorio.has(nome);
        });
      if (!escolhasValidas) return 'Selecione 2 magias novas de círculos para os quais você possui espaços no Grimório.';
    }
    const subclasseArcana = calcularSubclasseArcana(ctx, state);
    if (subclasseArcana) {
      const selecionadas = state.subclasseMagiasSelecionados || [];
      const nomesNoGrimorio = new Set([
        ...(ctx.char.grimorio || []).map(m => m?.nome),
        ...(state.grimorioSelecionados || [])
      ]);
      const magiasPorNome = new Map((ctx._listaMagiasClasse || []).map(m => [m.nome, m]));
      const escolhasValidas = selecionadas.length === subclasseArcana.quantidade &&
        new Set(selecionadas).size === subclasseArcana.quantidade &&
        selecionadas.every(nome => {
          const magia = magiasPorNome.get(nome);
          return magia && magia.escola === subclasseArcana.escola &&
            magia.circulo > 0 && magia.circulo <= subclasseArcana.circuloMax &&
            !nomesNoGrimorio.has(nome);
        });
      if (!escolhasValidas) return `Selecione ${subclasseArcana.quantidade} magia(s) de ${subclasseArcana.escola} para o Grimório.`;
    }
    if (state.trocarDe && !state.trocarPara)
      return 'Escolha a magia substituta ou desmarque a troca.';
    if (state.truqueTrocarDe && !state.truqueTrocarPara)
      return 'Escolha o truque substituto ou desmarque a troca.';
  }

  return null;
}
