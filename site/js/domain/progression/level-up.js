// Módulo `domain/progression/level-up`: projeção, validação e aplicação de um
// level-up (Task 23).
//
// ## Contratos
//
//   getLevelUpOptions(character, context) -> Result<LevelUpProjection, AppError>
//   validateLevelUp(character, selection, context) -> Result<void, AppError>
//   applyLevelUp(character, selection, context) -> CommandResult
//
// `getLevelUpOptions`/`validateLevelUp` são PUROS e não persistem nada.
// `applyLevelUp` devolve o Command contract da Task 17 (`{ok, character,
// events, affected}`, `affected` SEMPRE presente e vazio na falha).
//
// ## Rollback total, sem meio-caminho
//
// Toda a seleção é validada ANTES de qualquer construção do próximo
// personagem. Não existe "aplicou o PV e falhou no ASI": ou o comando devolve
// o personagem novo inteiro, ou devolve o ORIGINAL intocado. Isso é o inverso
// exato do padrão de bug de assimetria apply/revoke já pego neste projeto.
//
// ## PV: fonte é o histórico, nunca um valor congelado
//
// Cada level-up acrescenta UMA entrada em `state.hitPointRolls`
// (`{level, rolled, method}`). O máximo NUNCA é escrito no personagem: é
// recomputado por `progression-queries.js#getMaximumHitPoints`. Em particular,
// `applyLevelUp` jamais cria `overrides["hp.maximum"]` — essa chave é
// exclusivamente o ajuste manual explícito do usuário, e escrevê-la aqui
// congelaria o PV e quebraria o recálculo retroativo por aumento de
// Constituição.
//
// ## Recursos por proveniência
//
// Recursos novos do nível são materializados por `applyGrantEffects`
// (`domain/effects`), que os cria em `state.resources` com o ContentId
// estruturado (`dnd2024:resource:furias`) e `sourceInstanceId`. Nunca há
// inicialização implícita por consulta ou render, e nunca se infere um recurso
// por nome de característica.

import { ok, err } from '../../core/result.js';
import { commandOk, commandErr } from '../commands/command-result.js';
import { collectCharacterEffects, applyGrantEffects } from '../effects/index.js';
import { withEffectContextVariables } from '../character/queries/index.js';
import {
  MIN_LEVEL,
  MAX_LEVEL,
  progressionError,
  getProgressionRow,
  requireHitPointRolls,
} from './progression-queries.js';
import { applyFeatChoice, validateFeatChoice, ABILITY_SCORE_MAXIMUM } from './feat-choices.js';

/** Métodos aceitos para o PV do nível — enum fechado, igual ao schema v2. */
export const HIT_POINT_METHODS = Object.freeze(['roll', 'average', 'fixed']);

/**
 * Tamanho do dado de vida declarado pela classe (`hitDie: "d12"`), lido como
 * CAMPO ESTRUTURADO. Devolve `null` quando ausente/ilegível — a média não é
 * presumida a partir de nada.
 * @param {*} classEntity
 * @returns {number | null}
 */
function hitDieSizeOf(classEntity) {
  const bruto = classEntity?.hitDie;
  if (typeof bruto !== 'string') {
    return null;
  }
  const casado = /^[dD](\d+)$/.exec(bruto.trim());
  if (casado === null) {
    return null;
  }
  const lados = Number.parseInt(casado[1], 10);
  return Number.isInteger(lados) && lados > 0 ? lados : null;
}

/**
 * Média fixa que o 2024 usa para o PV por nível: `dado / 2 + 1`.
 * @param {number} lados
 * @returns {number}
 */
function averageForDie(lados) {
  return Math.floor(lados / 2) + 1;
}

/**
 * Confere a forma mínima de um CanonicalCharacter.
 * @param {*} character
 * @returns {boolean}
 */
function hasCharacterShape(character) {
  return (
    character !== null &&
    typeof character === 'object' &&
    character.identity !== null &&
    typeof character.identity === 'object' &&
    character.build !== null &&
    typeof character.build === 'object' &&
    character.state !== null &&
    typeof character.state === 'object'
  );
}

/**
 * Resolve a entidade de classe do personagem pelo catálogo.
 * @param {object} character
 * @param {object} registry
 * @returns {import('../../core/result.js').Result}
 */
function requireClassEntity(character, registry) {
  const referencia = character?.build?.classRef;
  const id = typeof referencia === 'string' ? referencia : referencia?.id;
  if (typeof id !== 'string' || id.length === 0) {
    return err(
      progressionError(
        'LEVEL_UP_CLASS_MISSING',
        'O personagem não tem "build.classRef": não há progressão de classe a subir.',
        {},
      ),
    );
  }
  const entidade = registry.get(id);
  if (entidade === null || entidade === undefined) {
    return err(
      progressionError('LEVEL_UP_CLASS_UNRESOLVED', `A classe "${id}" não existe no catálogo ativo.`, { classId: id }),
    );
  }
  return ok(entidade);
}

/**
 * Menor nível em que alguma subclasse desta classe concede característica —
 * ou seja, o nível em que a escolha de subclasse é exigida.
 *
 * Derivação por campo estruturado: `subclass.class === classId` +
 * `feature.grantedBy === subclass.id` + `feature.level`. Devolve `null` quando
 * a classe não tem nenhuma subclasse com característica de nível declarado —
 * ausência preservada, nunca um nível 3 plausível inventado.
 * @param {string} classId
 * @param {object} registry
 * @returns {number | null}
 */
function subclassLevelOf(classId, registry) {
  const subclasses = new Set(
    registry
      .list('subclass')
      .filter((subclasse) => subclasse?.class === classId)
      .map((subclasse) => subclasse.id),
  );
  if (subclasses.size === 0) {
    return null;
  }
  const niveis = registry
    .list('feature')
    .filter((feature) => subclasses.has(feature?.grantedBy) && Number.isInteger(feature.level))
    .map((feature) => feature.level);
  return niveis.length === 0 ? null : Math.min(...niveis);
}

/**
 * Confere que `context` traz o catálogo. Sem registry não há progressão a
 * derivar — devolver uma projeção vazia seria bypass silencioso.
 * @param {*} context
 * @returns {import('../../core/result.js').Result}
 */
function requireRegistry(context) {
  const registry = context?.registry;
  if (registry === null || typeof registry !== 'object' || typeof registry.list !== 'function') {
    return err(
      progressionError('LEVEL_UP_REGISTRY_REQUIRED', 'O level-up é derivado do catálogo: "context.registry" é obrigatório.', {}),
    );
  }
  return ok(registry);
}

/**
 * Projeta o que o próximo nível exige e concede, SEM aplicar nada.
 *
 * Devolve `{fromLevel, toLevel, proficiencyBonus, featuresGained,
 * requiresAbilityScoreImprovement, requiresEpicBoon, requiresSubclass,
 * hitPoints: {die, average}, resources, spellSlots, diceProgression}`.
 *
 * Tudo derivado de campo estruturado do catálogo (`level`, `when`, `handlerId`,
 * `params`, `hitDie`, `subclass.class`, `feature.grantedBy`), nunca de nome de
 * exibição nem de prosa.
 *
 * @param {object} character - CanonicalCharacter no nível ATUAL.
 * @param {{registry: object}} context
 * @returns {import('../../core/result.js').Result} Result<LevelUpProjection, AppError>
 */
export function getLevelUpOptions(character, context = {}) {
  if (!hasCharacterShape(character)) {
    return err(progressionError('LEVEL_UP_CHARACTER_INVALID', 'O level-up exige um CanonicalCharacter.', {}));
  }
  const registryResult = requireRegistry(context);
  if (!registryResult.ok) {
    return registryResult;
  }
  const registry = registryResult.value;

  const fromLevel = character.state.level;
  if (!Number.isInteger(fromLevel) || fromLevel < MIN_LEVEL || fromLevel > MAX_LEVEL) {
    return err(progressionError('LEVEL_UP_LEVEL_INVALID', '"state.level" deve ser um inteiro de 1 a 20.', { level: fromLevel }));
  }
  if (fromLevel === MAX_LEVEL) {
    return err(
      progressionError('LEVEL_UP_AT_MAXIMUM', `O personagem já está no nível ${MAX_LEVEL}; não há próximo nível.`, {
        level: fromLevel,
      }),
    );
  }
  const toLevel = fromLevel + 1;

  const classe = requireClassEntity(character, registry);
  if (!classe.ok) {
    return classe;
  }
  const lados = hitDieSizeOf(classe.value);
  if (lados === null) {
    return err(
      progressionError(
        'LEVEL_UP_HIT_DIE_UNKNOWN',
        `A classe "${classe.value.id}" não declara "hitDie" legível; o dado de vida não é presumido.`,
        { classId: classe.value.id, hitDie: classe.value.hitDie ?? null },
      ),
    );
  }

  const linha = getProgressionRow(character, toLevel, context);
  if (!linha.ok) {
    return linha;
  }

  // Subclasse: exigida quando ESTE é o primeiro nível em que alguma subclasse
  // da classe concede característica, e o personagem ainda não escolheu uma.
  //
  // Derivado dos campos estruturados `subclass.class` + `feature.grantedBy` +
  // `feature.level` — NÃO de uma tabela `NIVEL_SUBCLASSE` codificada por nome
  // de classe (o que `site/js/dados-classes.js` faz hoje), e NÃO da prosa
  // "Subclasse Bárbaro" da coluna de características da tabela legada.
  const nivelSubclasse = subclassLevelOf(classe.value.id, registry);
  const requiresSubclass = nivelSubclasse === toLevel && !character.build.subclassRef;

  return ok(
    Object.freeze({
      fromLevel,
      toLevel,
      proficiencyBonus: linha.value.proficiencyBonus,
      featuresGained: linha.value.features,
      requiresAbilityScoreImprovement: linha.value.grantsAbilityScoreImprovement,
      requiresEpicBoon: linha.value.grantsEpicBoon,
      requiresSubclass,
      hitPoints: Object.freeze({ die: lados, average: averageForDie(lados) }),
      resources: linha.value.resources,
      spellSlots: linha.value.spellSlots,
      diceProgression: linha.value.diceProgression,
    }),
  );
}

/**
 * Valida a entrada de PV do level-up contra o método declarado.
 *
 * `average`/`fixed` exigem que `rolled` seja EXATAMENTE o valor determinado
 * pelo método — não se aceita um número arbitrário rotulado de "média", e não
 * se preenche um valor plausível quando ele falta.
 * @param {*} hitPoints
 * @param {{die: number, average: number}} projecao
 * @returns {object | null} AppError ou `null`
 */
function validateHitPointSelection(hitPoints, projecao) {
  if (hitPoints === null || typeof hitPoints !== 'object' || Array.isArray(hitPoints)) {
    return progressionError(
      'LEVEL_UP_HIT_POINTS_REQUIRED',
      'A seleção precisa de "hitPoints: {rolled, method}"; o PV do nível não é inventado.',
      {},
    );
  }
  const { method, rolled } = hitPoints;
  if (!HIT_POINT_METHODS.includes(method)) {
    return progressionError(
      'LEVEL_UP_HIT_POINT_METHOD_INVALID',
      `"method" deve ser um de ${HIT_POINT_METHODS.join(', ')}.`,
      { method: method ?? null },
    );
  }
  if (!Number.isInteger(rolled) || rolled < 1) {
    return progressionError(
      'LEVEL_UP_HIT_POINT_ROLL_INVALID',
      '"rolled" deve ser um inteiro >= 1 em todo level-up; "null" registra histórico desconhecido e não é aceito aqui.',
      { rolled: rolled ?? null },
    );
  }
  if (method === 'roll' && rolled > projecao.die) {
    return progressionError(
      'LEVEL_UP_HIT_POINT_ROLL_OUT_OF_RANGE',
      `Uma rolagem de d${projecao.die} não pode resultar em ${rolled}.`,
      { rolled, die: projecao.die },
    );
  }
  if (method === 'average' && rolled !== projecao.average) {
    return progressionError(
      'LEVEL_UP_HIT_POINT_AVERAGE_MISMATCH',
      `A média de um d${projecao.die} é ${projecao.average}; "${rolled}" não pode ser registrado como média.`,
      { rolled, expected: projecao.average },
    );
  }
  return null;
}

/**
 * Valida a seleção de subclasse: precisa existir no catálogo E pertencer à
 * classe do personagem (campo estruturado `subclass.class`).
 * @param {*} referencia
 * @param {object} registry
 * @param {string} classId
 * @returns {object | null} AppError ou `null`
 */
function validateSubclassSelection(referencia, registry, classId) {
  const id = typeof referencia === 'string' ? referencia : referencia?.id;
  if (typeof id !== 'string' || id.length === 0) {
    return progressionError('LEVEL_UP_SUBCLASS_REQUIRED', 'Este nível exige a escolha de uma subclasse.', { classId });
  }
  const entidade = registry.get(id);
  if (entidade === null || entidade === undefined || entidade.type !== 'subclass') {
    return progressionError('LEVEL_UP_SUBCLASS_UNRESOLVED', `A subclasse "${id}" não existe no catálogo ativo.`, {
      subclassId: id,
    });
  }
  if (entidade.class !== classId) {
    return progressionError(
      'LEVEL_UP_SUBCLASS_WRONG_CLASS',
      `A subclasse "${id}" pertence a "${entidade.class}", não a "${classId}".`,
      { subclassId: id, expectedClassId: classId, actualClassId: entidade.class ?? null },
    );
  }
  return null;
}

/**
 * Valida uma seleção de level-up por completo, sem aplicar nada.
 *
 * @param {object} character
 * @param {object} selection - `{hitPoints, subclassRef?, abilityScoreImprovement?, featChoice?}`
 * @param {{registry: object}} context
 * @returns {import('../../core/result.js').Result} Result<void, AppError>
 */
export function validateLevelUp(character, selection, context = {}) {
  const projecao = getLevelUpOptions(character, context);
  if (!projecao.ok) {
    return projecao;
  }
  const opcoes = projecao.value;

  if (selection === null || typeof selection !== 'object' || Array.isArray(selection)) {
    return err(progressionError('LEVEL_UP_SELECTION_INVALID', 'A seleção de level-up deve ser um objeto.', {}));
  }

  // PV: o histórico anterior precisa estar íntegro ANTES de acrescentar mais
  // uma entrada — senão o level-up produziria um histórico com buraco, que
  // `getMaximumHitPoints` recusaria depois (falha tardia e confusa).
  const historico = requireHitPointRolls(character, opcoes.fromLevel);
  if (!historico.ok) {
    return historico;
  }
  const erroPv = validateHitPointSelection(selection.hitPoints, opcoes.hitPoints);
  if (erroPv !== null) {
    return err(erroPv);
  }

  if (opcoes.requiresSubclass) {
    const erroSub = validateSubclassSelection(selection.subclassRef, context.registry, character.build.classRef?.id ?? character.build.classRef);
    if (erroSub !== null) {
      return err(erroSub);
    }
  } else if (selection.subclassRef !== undefined && selection.subclassRef !== null) {
    return err(
      progressionError(
        'LEVEL_UP_SUBCLASS_NOT_EXPECTED',
        `O nível ${opcoes.toLevel} não concede subclasse; a seleção não pode trazer "subclassRef".`,
        { level: opcoes.toLevel },
      ),
    );
  }

  if (opcoes.requiresAbilityScoreImprovement) {
    const erroAsi = validateAbilityScoreSelection(character, selection, opcoes, context);
    if (erroAsi !== null) {
      return err(erroAsi);
    }
  } else if (selection.abilityScoreImprovement !== undefined || selection.featChoice !== undefined) {
    return err(
      progressionError(
        'LEVEL_UP_ASI_NOT_EXPECTED',
        `O nível ${opcoes.toLevel} não concede Aumento no Valor de Atributo nem talento.`,
        { level: opcoes.toLevel },
      ),
    );
  }

  return ok(undefined);
}

/**
 * Valida a escolha do nível de ASI: OU aumentos de atributo, OU um talento —
 * exatamente uma das duas, nunca as duas nem nenhuma.
 * @param {object} character
 * @param {object} selection
 * @param {object} opcoes - projeção de `getLevelUpOptions`
 * @returns {object | null} AppError ou `null`
 */
function validateAbilityScoreSelection(character, selection, opcoes, contexto) {
  const temAsi = selection.abilityScoreImprovement !== undefined && selection.abilityScoreImprovement !== null;
  const temTalento = selection.featChoice !== undefined && selection.featChoice !== null;
  if (temAsi === temTalento) {
    return progressionError(
      'LEVEL_UP_ASI_OR_FEAT_REQUIRED',
      `O nível ${opcoes.toLevel} exige EXATAMENTE uma escolha: "abilityScoreImprovement" ou "featChoice".`,
      { level: opcoes.toLevel, hasAbilityScoreImprovement: temAsi, hasFeatChoice: temTalento },
    );
  }
  if (temTalento) {
    // O talento tem regras próprias (pré-requisito, repetibilidade, escolhas) e
    // `feat-choices.js` é a autoridade — mas a validação tem de acontecer
    // AGORA, não só no apply.
    //
    // `validateLevelUp` é `Result<void, AppError>`: quem a chama (a UI, para
    // habilitar o botão de confirmar) precisa da resposta REAL. Antes isto
    // devolvia `null` sem olhar o talento, então uma seleção com `featRef`
    // inexistente aparecia como válida e só estourava no apply.
    //
    // `validateFeatChoice` é PURO (não constrói personagem, não aplica
    // concessão), então chamá-lo aqui não tem efeito colateral nenhum. O
    // personagem é projetado no nível NOVO porque é lá que o pré-requisito de
    // nível do talento vale (um talento de nível 4 é legítimo no level-up que
    // leva ao 4).
    const noProximoNivel = { ...character, state: { ...character.state, level: opcoes.toLevel } };
    const talento = validateFeatChoice(noProximoNivel, selection.featChoice, contexto);
    return talento.ok ? null : talento.error;
  }

  const aumentos = selection.abilityScoreImprovement;
  if (aumentos === null || typeof aumentos !== 'object' || Array.isArray(aumentos)) {
    return progressionError(
      'LEVEL_UP_ASI_INVALID',
      '"abilityScoreImprovement" deve ser um mapa atributo -> incremento.',
      {},
    );
  }
  const entradas = Object.entries(aumentos);
  let total = 0;
  for (const [chave, incremento] of entradas) {
    if (!Number.isInteger(incremento) || incremento < 1 || incremento > 2) {
      return progressionError('LEVEL_UP_ASI_INCREMENT_INVALID', `O incremento de "${chave}" deve ser 1 ou 2.`, {
        ability: chave,
        increment: incremento ?? null,
      });
    }
    const atual = character.state.abilities?.[chave];
    if (!Number.isInteger(atual)) {
      return progressionError('LEVEL_UP_ASI_ABILITY_UNKNOWN', `"state.abilities.${chave}" não é um inteiro.`, {
        ability: chave,
      });
    }
    if (atual + incremento > ABILITY_SCORE_MAXIMUM) {
      return progressionError(
        'LEVEL_UP_ASI_ABILITY_CAP',
        `"${chave}" iria a ${atual + incremento}, acima do teto ${ABILITY_SCORE_MAXIMUM}.`,
        { ability: chave, current: atual, increment: incremento, maximum: ABILITY_SCORE_MAXIMUM },
      );
    }
    total += incremento;
  }
  if (total !== 2) {
    return progressionError(
      'LEVEL_UP_ASI_TOTAL_INVALID',
      `Um Aumento no Valor de Atributo distribui exatamente 2 pontos (recebido: ${total}).`,
      { total },
    );
  }
  return null;
}

/**
 * Aplica um level-up. Devolve o Command contract da Task 17.
 *
 * Ordem: valida TUDO -> constrói o próximo personagem -> materializa as
 * concessões novas do nível. Qualquer falha em qualquer etapa devolve o
 * personagem ORIGINAL, com `affected: []` (rollback total).
 *
 * @param {object} character
 * @param {object} selection
 * @param {{registry: object}} context
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function applyLevelUp(character, selection, context = {}) {
  const validacao = validateLevelUp(character, selection, context);
  if (!validacao.ok) {
    return commandErr({ character, error: validacao.error });
  }
  const projecao = getLevelUpOptions(character, context);
  if (!projecao.ok) {
    return commandErr({ character, error: projecao.error });
  }
  const opcoes = projecao.value;

  const affected = ['state.level', 'state.hitPointRolls', 'hp.maximum'];

  // --- 1. nível, histórico de PV, subclasse, atributos ---------------------
  const hitPointRolls = [
    ...(Array.isArray(character.state.hitPointRolls) ? character.state.hitPointRolls : []),
    Object.freeze({ level: opcoes.toLevel, rolled: selection.hitPoints.rolled, method: selection.hitPoints.method }),
  ];

  let build = character.build;
  if (opcoes.requiresSubclass) {
    const referencia = selection.subclassRef;
    const id = typeof referencia === 'string' ? referencia : referencia.id;
    const packageVersion =
      typeof referencia === 'object' && typeof referencia.packageVersion === 'string'
        ? referencia.packageVersion
        : character.build.classRef?.packageVersion;
    if (typeof packageVersion !== 'string') {
      return commandErr({
        character,
        error: progressionError(
          'LEVEL_UP_SUBCLASS_PACKAGE_VERSION_UNKNOWN',
          `Não foi possível determinar a "packageVersion" da subclasse "${id}"; uma versão não é inventada.`,
          { subclassId: id },
        ),
      });
    }
    build = { ...build, subclassRef: Object.freeze({ id, packageVersion }) };
    affected.push('build.subclassRef');
  }

  let abilities = character.state.abilities;
  if (opcoes.requiresAbilityScoreImprovement && selection.abilityScoreImprovement) {
    abilities = { ...abilities };
    for (const [chave, incremento] of Object.entries(selection.abilityScoreImprovement)) {
      abilities[chave] = abilities[chave] + incremento;
      affected.push(`ability.${chave}.score`);
    }
  }

  let proximo = {
    ...character,
    build,
    state: { ...character.state, level: opcoes.toLevel, abilities, hitPointRolls },
  };

  // --- 2. talento escolhido no lugar do ASI --------------------------------
  if (opcoes.requiresAbilityScoreImprovement && selection.featChoice) {
    const comTalento = applyFeatChoice(proximo, selection.featChoice, context);
    if (!comTalento.ok) {
      // Rollback TOTAL: o personagem devolvido é o ORIGINAL, não o
      // parcialmente subido de nível.
      return commandErr({ character, error: comTalento.error });
    }
    proximo = comTalento.character;
    affected.push(...comTalento.affected);
  }

  // --- 3. materializa as concessões novas do nível -------------------------
  // Inclusive os recursos, por ContentId estruturado + `sourceInstanceId`
  // (`effects/apply-grants.js`). Consulta e render continuam SEM inicialização
  // implícita: quem cria o estado do recurso é este comando.
  const comVariaveis = withEffectContextVariables(proximo, context);
  if (!comVariaveis.ok) {
    return commandErr({ character, error: comVariaveis.error });
  }
  const contexto = comVariaveis.value;

  const efeitos = collectCharacterEffects(proximo, contexto);
  if (!efeitos.ok) {
    return commandErr({ character, error: efeitos.error });
  }
  const concessoes = applyGrantEffects(proximo, efeitos.value, contexto);
  if (!concessoes.ok) {
    return commandErr({ character, error: concessoes.error });
  }
  proximo = concessoes.value.character;
  if (concessoes.value.applied.length > 0) {
    affected.push('state.resources', 'state.activeEffects');
  }

  return commandOk({
    character: proximo,
    events: [
      Object.freeze({
        type: 'level-up',
        fromLevel: opcoes.fromLevel,
        toLevel: opcoes.toLevel,
        featureIds: Object.freeze(opcoes.featuresGained.map((feature) => feature.id)),
        warnings: Object.freeze([...concessoes.value.warnings]),
      }),
    ],
    affected: [...new Set(affected)],
  });
}
