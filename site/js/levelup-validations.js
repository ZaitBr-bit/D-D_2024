// ============================================================
// Validações e Coleta de opções do Level Up
// Fase 4: Coleta unificada e submissão
// ============================================================
import { exigeManobrasGuerreiro } from './levelup.js';
import { validarEscolhasTalento } from './regras-cobertura.js';
import {
  calcularConjuracao, calcularSubclasseArcana,
  proficienciaClasseNovaCompleta, ritualBonusProficienciaCompleto
} from './levelup-flow.js';

/**
 * Se ESTE nivel concede manobras novas (Mestre da Batalha).
 *
 * Os tres argumentos sao da CLASSE QUE SOBE, e tem de ser exatamente os
 * mesmos que o step 'manobras_guerreiro' (levelup-flow.js) usa para
 * decidir se o card aparece -- senao a tela e o motor discordam. Lendo os
 * espelhos (`char.classe`, `char.subclasse`) e o nivel TOTAL, um Mago 5
 * que sobe para Guerreiro 3/Mestre da Batalha VIA o card de manobras,
 * escolhia as 3, e `collectOpcoes` descartava `manobras_novas` porque
 * `char.classe` dizia "Mago": `subirDeNivel` recusava a subida por
 * pendencia de manobra e `validateAll` pulava a propria checagem pelo
 * mesmo motivo -- recusa MUDA, com o card preenchido na tela. O espelho
 * invertido (Guerreiro 6 entrando numa segunda classe no total 7) mandava
 * `manobras_novas: []` num nivel que nao concede nenhuma.
 */
function precisaManobrasAgora(ctx, state) {
  return exigeManobrasGuerreiro(
    ctx.classeQueSobe, state.subclasse || ctx.sub?.subclasse, ctx.nivelNaClasseNovo);
}

/**
 * Consolida o state do fluxo no formato esperado por subirDeNivel().
 * @param {Object} ctx - Contexto
 * @param {Object} state - Estado das escolhas
 * @returns {Object} opcoes compatíveis com levelup.js
 */
export function collectOpcoes(ctx, state) {
  // A classe em que o nivel entra. Sem isto, subirDeNivel cai no default
  // (a classe INICIAL do personagem, ver levelup.js) e o nivel seria
  // gravado numa classe diferente da que a tela mostrou -- o defeito mais
  // caro possivel aqui, invisivel enquanto as duas coincidirem (ate a
  // Tarefa 7, o seletor, introduzir a assimetria).
  const opcoes = { ignorar_xp: true, classe: state.classeQueSobe };

  // Dispensa do pre-requisito de multiclasse (livro:2033), ligada pelo
  // botao "usar mesmo assim" de uma classe travada -- ver
  // bindEventosDispensaPrerequisito (levelup-ui.js). So entra em `opcoes`
  // quando true: `subirDeNivel` so olha esta chave quando a classe esta
  // de fato travada, entao omiti-la no caso comum e inocuo.
  if (state.dispensarPrerequisito) opcoes.dispensar_prerequisito = true;

  // Escolhas de subclasse (regras-subclasse-escolhas.js): o card generico
  // grava em state.escolhasSubclasse[campo], e a guarda de subirDeNivel le
  // opcoes[campo] -- este bloco e a unica ponte entre os dois.
  for (const [campo, valores] of Object.entries(state.escolhasSubclasse || {})) {
    if (Array.isArray(valores) && valores.length) opcoes[campo] = valores;
  }

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
  // Troca de Estilo de Luta do Guerreiro (opcional, ver levelup.js) --
  // só entra em opcoes quando o jogador preencheu os dois lados da troca,
  // mesmo padrão de manobra_trocar_de/manobra_trocar_para logo abaixo.
  if (ctx.podeTrocarEstiloLutaGuerreiro && state.estiloLutaTrocarDe && state.estiloLutaTrocarPara) {
    opcoes.estilo_luta_trocar_de = state.estiloLutaTrocarDe;
    opcoes.estilo_luta_trocar_para = state.estiloLutaTrocarPara;
  }
  // Especialização adicional do Ladino (nível 6, opcional -- ver
  // levelup.js). Se o jogador não escolher nada aqui, subirDeNivel
  // preenche automaticamente; por isso só entra em opcoes quando há
  // alguma seleção real.
  if (ctx.precisaExpertiseLadino && (state.ladinoExpertise || []).length > 0) {
    opcoes.ladino_expertise = state.ladinoExpertise;
  }
  if (ctx.precisaExploradorHabil) {
    opcoes.explorador_expertise = state.exploradorExpertise;
    opcoes.explorador_idiomas = state.exploradorIdiomas;
  }
  if (ctx.precisaAcademico) opcoes.academico_expertise = state.academicoExpertise;
  if (ctx.precisaConhecimentoPrimordial) {
    opcoes.conhecimento_primordial_pericia = state.conhecimentoPrimordialPericia;
  }
  if (calcularConjuracao(ctx, state)?.ehMago) opcoes.grimorio_selecionados = state.grimorioSelecionados || [];
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

  // Proficiências da Classe Nova (Bardo/Guardião/Ladino, livro:2051) --
  // os nomes das chaves têm de bater EXATAMENTE com o que subirDeNivel lê
  // (opcoes.pericia_classe_nova / opcoes.instrumento_classe_nova, ver
  // levelup.js): sem isso a tela mostra a escolha certa e o motor recusa
  // a subida do mesmo jeito, por não achar a chave.
  opcoes.pericia_classe_nova = state.periciaClasseNova || undefined;
  opcoes.instrumento_classe_nova = state.instrumentoClasseNova || undefined;

  // Magias Rituais do Bônus de Proficiência (Conjurador Ritualista,
  // Talentos.md:370) -- o nome da chave tem de bater EXATAMENTE com o que
  // subirDeNivel lê (opcoes.rituais_bonus_proficiencia, levelup.js), senão
  // a tela mostra a escolha certa e o motor recusa a subida do mesmo jeito,
  // por não achar a chave. Diferente das duas linhas acima, aqui o valor É
  // SEMPRE um array (nunca `undefined`): `state.rituaisBonusSelecionados`
  // nasce `[]` em createInitialState e nenhuma troca de classe o apaga
  // (mesmo motivo de periciaClasseNova/instrumentoClasseNova) -- `[]` já é
  // o valor certo para "nada escolhido ainda".
  opcoes.rituais_bonus_proficiencia = state.rituaisBonusSelecionados || [];

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
      // `ctx.nivelNovo` explicito: mesma razao do chamador em levelup.js
      // (subirDeNivel) -- `ctx.char.nivel` ainda e o TOTAL ANTERIOR, e
      // esta validacao roda ANTES de sincronizarEspelhos.
      const validacaoTalento = validarEscolhasTalento(ctx.char, state.talento, {
        atributo: state.talentoASI || state.resilienteAtributo || state.iniciadoEmMagia?.atributo,
        talento_asi: state.talentoASI,
        selecoes: state.escolhasTalento || [],
        magia: state.escolhasTalento?.[0],
        rituais: state.talento === 'Conjurador Ritualista' ? state.escolhasTalento : undefined,
        energias: state.dadivaResistenciaEnergia,
        iniciado_em_magia: state.iniciadoEmMagia
      }, ctx.nivelNovo);
      if (!validacaoTalento.valido) return validacaoTalento.erro;
    }
  }

  if (ctx.precisaExpertiseBardo && state.bardoExpertise.length !== 2) return 'Selecione 2 perícias para Especialização do Bardo.';
  if (ctx.precisaExpertiseGuardiao && state.guardiaoExpertise.length !== 2) return 'Selecione 2 perícias para Especialista do Guardião.';
  if (ctx.precisaEstiloLuta && !state.estiloLuta) return 'Selecione um Estilo de Luta.';
  // Troca de Estilo de Luta do Guerreiro: nunca obrigatória, só trava se
  // o jogador começou a preencher e não terminou (mesma forma da troca de
  // manobra, mais abaixo).
  if (ctx.podeTrocarEstiloLutaGuerreiro && state.estiloLutaTrocarDe && !state.estiloLutaTrocarPara) {
    return 'Escolha o Estilo de Luta substituto ou desmarque a troca.';
  }
  // Especialização adicional do Ladino (nível 6): NUNCA bloqueia, nem
  // parcialmente preenchida -- diferente da troca de Estilo de Luta
  // (duas pontas de uma substituição, "de"/"para", incompleta sem as
  // duas), aqui cada perícia marcada é uma escolha independente e válida
  // por si só. subirDeNivel (levelup.js) já aceita 0, 1 ou 2 perícias em
  // opcoes.ladino_expertise e completa o que faltar automaticamente com
  // as próximas elegíveis -- bloquear aqui uma seleção de 1 (achado da
  // revisão final: o jogador marca só a perícia que lhe importa e confia
  // no preenchimento automático para a outra) contradiria esse desenho e
  // impediria exatamente o uso que ele existe para suportar.
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
  // Conhecimento Primordial (Bárbaro nv3, issue #45). Espelho do Acadêmico,
  // com a condição INVERTIDA na proficiência: aqui a perícia tem de ser uma
  // que o personagem AINDA NÃO tem -- é concessão nova, não especialização.
  // A lista elegível vem de `ctx.opcoesConhecimentoPrimordial`, montada por
  // buildLevelUpContext com a mesma função que subirDeNivel valida.
  if (ctx.precisaConhecimentoPrimordial) {
    const pericia = state.conhecimentoPrimordialPericia;
    if (!pericia || !(ctx.opcoesConhecimentoPrimordial || []).includes(pericia)) {
      return 'Selecione 1 perícia da lista do Bárbaro para Conhecimento Primordial.';
    }
  }

  if (precisaManobrasLive && ctx.manobrasGuerreiro) {
    if ((state.manobrasNovasSelecionadas || []).length !== ctx.manobrasGuerreiro.qtdNova)
      return `Selecione ${ctx.manobrasGuerreiro.qtdNova} manobra(s) (Mestre da Batalha).`;
    if (state.manobraTrocarDe && !state.manobraTrocarPara)
      return 'Escolha a manobra substituta ou desmarque a troca.';
  }

  // Proficiências da Classe Nova (Bardo/Guardião/Ladino, livro:2051):
  // mesma checagem amigável que os outros requirements acima têm -- sem
  // ela, clicar "Confirmar" sem escolher chegaria em subirDeNivel e só
  // apareceria a mensagem genérica do motor (levelup.js), um passo depois.
  // Delega em proficienciaClasseNovaCompleta (levelup-flow.js), a MESMA
  // função que o step 'completo' usa -- NÃO reimplementar a comparação
  // aqui: hand-copiar as duas metades da mesma regra foi exatamente o que
  // deixou completo/validateAll divergirem do motor (achado da revisão
  // da Tarefa 4, rodada 1) — uma escolha que sobrevivia a uma troca de
  // classe passava aqui e só o motor recusava, sem nenhum campo marcado.
  if (ctx.concessoesClasseNova && !proficienciaClasseNovaCompleta(ctx, state)) {
    return `Escolha as proficiências concedidas por ${ctx.classeQueSobe} ` +
      '(perícia e/ou Instrumento Musical, no passo "Proficiências da Classe Nova").';
  }

  // Magias Rituais do Bônus de Proficiência (Conjurador Ritualista,
  // Talentos.md:370): mesma checagem amigável dos requirements acima --
  // sem ela, clicar "Confirmar" sem escolher chegaria em subirDeNivel e só
  // apareceria a mensagem genérica do motor, sem nomear o passo. Delega em
  // ritualBonusProficienciaCompleto (levelup-flow.js), a MESMA função que o
  // step 'completo' usa -- NÃO reimplementar a comparação aqui (ver o
  // cabeçalho dela para o porquê).
  if ((ctx.ritualBonus?.faltam || 0) > 0 && !ritualBonusProficienciaCompleto(ctx, state)) {
    return ctx.ritualBonus.faltam === 1
      ? 'Escolha 1 magia ritual de 1º círculo para o Conjurador Ritualista (passo "Magias Rituais (Bônus de Proficiência)").'
      : `Escolha ${ctx.ritualBonus.faltam} magias rituais de 1º círculo distintas para o Conjurador Ritualista ` +
        '(passo "Magias Rituais (Bônus de Proficiência)").';
  }

  // Reativo à subclasse escolhida nesta sessão (ver calcularConjuracao):
  // sem isso, um Cavaleiro Místico/Trapaceiro Arcano recém-escolhido
  // confirmaria o nível sem nenhuma cobrança de truque ou magia.
  const conjuracaoAtiva = calcularConjuracao(ctx, state);
  if (conjuracaoAtiva) {
    const c = conjuracaoAtiva;
    if (c.truquesGanhos > 0 && state.truquesSelecionados.length !== c.truquesGanhos)
      return `Selecione ${c.truquesGanhos} truque(s).`;
    if (c.tipoConj === 'conhecidas' && c.magiasGanhas > 0 && state.magiasSelecionadas.length !== c.magiasGanhas)
      return `Selecione ${c.magiasGanhas} magia(s) conhecida(s).`;
    if (c.ehMago) {
      const selecionadas = state.grimorioSelecionados || [];
      const nomesNoGrimorio = new Set((ctx.char.grimorio || []).map(m => m?.nome));
      const magiasPorNome = new Map((ctx._listaMagiasClasse || []).map(m => [m.nome, m]));
      // `c.grimorioQtd`: 6 no 1º nível de Mago (multiclasse), 2 nos
      // seguintes -- ver calcularConjuracao (levelup-flow.js).
      const escolhasValidas = selecionadas.length === c.grimorioQtd && new Set(selecionadas).size === c.grimorioQtd &&
        selecionadas.every(nome => {
          const magia = magiasPorNome.get(nome);
          return magia && magia.circulo > 0 && magia.circulo <= c.maxCirculoNovo && !nomesNoGrimorio.has(nome);
        });
      if (!escolhasValidas) return `Selecione ${c.grimorioQtd} magias novas de círculos para os quais você possui espaços no Grimório.`;
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
