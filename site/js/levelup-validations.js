// ============================================================
// Validações e Coleta de opções do Level Up
// Fase 4: Coleta unificada e submissão
// ============================================================

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
      if (state.talentoASI) opcoes.talento_asi = state.talentoASI;
      if (state.escolhasTalento.length > 0) opcoes.escolhas_talento_levelup = state.escolhasTalento;
      if (state.talentoTipoEscolha) opcoes.talento_tipo_escolha = state.talentoTipoEscolha;
      if (state.resilienteAtributo) opcoes.resiliente_atributo = state.resilienteAtributo;
      if (state.iniciadoEmMagia) opcoes.iniciado_em_magia = state.iniciadoEmMagia;
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

  return opcoes;
}

/**
 * Valida todas as pendências obrigatórias antes de submeter.
 * @returns {string|null} Mensagem de erro ou null se tudo ok.
 */
export function validateAll(ctx, state) {
  if (ctx.precisaSubclasse && !state.subclasse) return 'Escolha uma subclasse.';

  if (ctx.ganhaASI) {
    if (state.asiModo === 'atributo' && state.pontosDistribuidos !== 2)
      return 'Distribua exatamente 2 pontos de atributo.';
    if (state.asiModo === 'talento' && !state.talento)
      return 'Selecione um talento.';
  }

  if (ctx.precisaExpertiseBardo && state.bardoExpertise.length !== 2) return 'Selecione 2 perícias para Especialização do Bardo.';
  if (ctx.precisaExpertiseGuardiao && state.guardiaoExpertise.length !== 2) return 'Selecione 2 perícias para Especialista do Guardião.';
  if (ctx.precisaEstiloLuta && !state.estiloLuta) return 'Selecione um Estilo de Luta.';
  if (ctx.precisaExploradorHabil && !state.exploradorExpertise) return 'Selecione 1 perícia para Explorador Hábil.';
  if (ctx.precisaExploradorHabil && state.exploradorIdiomas.length !== 2) return 'Selecione 2 idiomas (Explorador Hábil).';
  if (ctx.precisaAcademico && state.academicoExpertise.length !== 2) return 'Selecione 2 perícias para Acadêmico.';

  if (ctx.ehConjurador && ctx.conjuracao) {
    const c = ctx.conjuracao;
    if (c.truquesGanhos > 0 && state.truquesSelecionados.length !== c.truquesGanhos)
      return `Selecione ${c.truquesGanhos} truque(s).`;
    if (c.tipoConj === 'conhecidas' && c.magiasGanhas > 0 && state.magiasSelecionadas.length !== c.magiasGanhas)
      return `Selecione ${c.magiasGanhas} magia(s) conhecida(s).`;
    if (c.ehMago && state.grimorioSelecionados.length !== 2)
      return 'Selecione 2 magias para o Grimório.';
    if (state.trocarDe && !state.trocarPara)
      return 'Escolha a magia substituta ou desmarque a troca.';
  }

  return null;
}
