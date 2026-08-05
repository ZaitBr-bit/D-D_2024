// Módulo `domain/progression/feat-choices`: escolha e aplicação de TALENTOS
// (Task 23).
//
//   applyFeatChoice(character, selection, context) -> CommandResult
//
// Substitui a decisão por nome de talento que `site/js/regras-cobertura.js`
// faz hoje (`REGRAS_TALENTOS` indexado pelo nome de exibição, com efeitos
// codificados em JS por talento). Aqui a mecânica vem SEMPRE do catálogo:
// `feat.prerequisites` (estruturado), `feat.repeatable` (booleano) e
// `feat.effects` (efeitos declarativos, inclusive `choice`). Nome e descrição
// do talento não decidem nada.
//
// ## Rollback total
//
// Toda a seleção — talento, pré-requisitos, escolhas de cada efeito `choice` —
// é validada ANTES de qualquer construção. Uma escolha inválida devolve o
// personagem ORIGINAL, com `affected: []`; nunca um personagem com o talento
// meio aplicado.
//
// ## Pré-requisitos: só o que é estruturado
//
// O catálogo hoje só modela pré-requisito de NÍVEL (`{kind: "level", min}`).
// Os pré-requisitos em prosa do legado ("Característica Conjuração ou Magia de
// Pacto") NÃO foram estruturados pela migração — é a lacuna
// `todos[].prerequisito` declarada em `infra/content/legacy-db-projection.js`.
// Este módulo valida o que existe estruturado e NÃO tenta reconstituir o resto
// lendo a descrição: decidir mecânica por prosa é exatamente o que a
// refatoração remove.

import { ok, err } from '../../core/result.js';
import { commandOk, commandErr } from '../commands/command-result.js';
import {
  collectCharacterEffects,
  applyGrantEffects,
  deriveSourceInstanceId,
  qualifiedChoiceKey,
} from '../effects/index.js';
import { withEffectContextVariables, getAbilityModifier } from '../character/queries/index.js';
import { progressionError } from './progression-queries.js';

/** Teto de valor de atributo do 2024 fora de efeito que o eleve explicitamente. */
export const ABILITY_SCORE_MAXIMUM = 20;

/** `kind`s de pré-requisito que o catálogo modela hoje. */
const SUPPORTED_PREREQUISITE_KINDS = Object.freeze(['level']);

/**
 * Confere a forma mínima de um CanonicalCharacter.
 * @param {*} character
 * @returns {boolean}
 */
function hasCharacterShape(character) {
  return (
    character !== null &&
    typeof character === 'object' &&
    character.build !== null &&
    typeof character.build === 'object' &&
    character.state !== null &&
    typeof character.state === 'object'
  );
}

/**
 * Normaliza uma referência de conteúdo para o id string.
 * @param {*} referencia
 * @returns {string | null}
 */
function idOf(referencia) {
  if (typeof referencia === 'string') {
    return referencia;
  }
  return typeof referencia?.id === 'string' ? referencia.id : null;
}

/**
 * Valida os pré-requisitos ESTRUTURADOS de um talento.
 *
 * Um `kind` que este módulo não conhece é ERRO EXPLÍCITO, não uma aprovação
 * silenciosa: ignorar um pré-requisito desconhecido deixaria passar um talento
 * proibido, que é o pior dos dois resultados possíveis.
 * @param {object} character
 * @param {object} feat
 * @returns {object | null} AppError ou `null`
 */
function validatePrerequisites(character, feat) {
  for (const prerequisito of Array.isArray(feat.prerequisites) ? feat.prerequisites : []) {
    const kind = prerequisito?.kind;
    if (!SUPPORTED_PREREQUISITE_KINDS.includes(kind)) {
      return progressionError(
        'FEAT_PREREQUISITE_KIND_UNSUPPORTED',
        `O talento "${feat.id}" declara um pré-requisito de tipo "${String(kind)}" que este domínio não sabe avaliar; ` +
          'aprová-lo em silêncio deixaria passar um talento proibido.',
        { featId: feat.id, kind: kind ?? null },
      );
    }
    if (kind === 'level') {
      const nivel = character.state.level;
      if (Number.isInteger(prerequisito.min) && nivel < prerequisito.min) {
        return progressionError(
          'FEAT_PREREQUISITE_LEVEL_NOT_MET',
          `O talento "${feat.id}" exige nível ${prerequisito.min}; o personagem está no nível ${nivel}.`,
          { featId: feat.id, requiredLevel: prerequisito.min, level: nivel },
        );
      }
    }
  }
  return null;
}

/**
 * Índice `choiceId -> efeito choice` dos efeitos declarados por um talento.
 * @param {object} feat
 * @returns {Map<string, object>}
 */
function choicesOf(feat) {
  const mapa = new Map();
  for (const efeito of Array.isArray(feat.effects) ? feat.effects : []) {
    if (efeito?.type === 'choice' && typeof efeito.choice?.id === 'string') {
      mapa.set(efeito.choice.id, efeito.choice);
    }
  }
  return mapa;
}

/**
 * Valida as escolhas informadas para os efeitos `choice` do talento:
 * toda escolha exigida presente, nenhuma escolha estranha, cardinalidade
 * `min`/`max` respeitada e toda opção pertencente ao vocabulário declarado.
 *
 * Sem tolerância a "escolha a mais": aceitar uma opção que o catálogo não
 * declara é o bypass silencioso que este projeto proíbe.
 * @param {object} feat
 * @param {*} escolhas
 * @returns {object | null} AppError ou `null`
 */
function validateChoiceSelections(feat, escolhas) {
  const declaradas = choicesOf(feat);
  const informadas =
    escolhas === null || escolhas === undefined
      ? {}
      : escolhas !== null && typeof escolhas === 'object' && !Array.isArray(escolhas)
        ? escolhas
        : null;
  if (informadas === null) {
    return progressionError('FEAT_CHOICES_INVALID', '"choices" deve ser um objeto choiceId -> lista de opções.', {
      featId: feat.id,
    });
  }

  for (const chave of Object.keys(informadas)) {
    if (!declaradas.has(chave)) {
      return progressionError(
        'FEAT_CHOICE_UNKNOWN',
        `O talento "${feat.id}" não declara a escolha "${chave}".`,
        { featId: feat.id, choiceId: chave },
      );
    }
  }

  for (const [choiceId, choice] of declaradas) {
    const selecionadas = informadas[choiceId];
    if (selecionadas === undefined) {
      return progressionError(
        'FEAT_CHOICE_REQUIRED',
        `O talento "${feat.id}" exige a escolha "${choiceId}".`,
        { featId: feat.id, choiceId },
      );
    }
    if (!Array.isArray(selecionadas)) {
      return progressionError(
        'FEAT_CHOICE_NOT_ARRAY',
        `A escolha "${choiceId}" deve ser uma lista de ids de opção.`,
        { featId: feat.id, choiceId },
      );
    }
    const min = Number.isInteger(choice.min) ? choice.min : null;
    const max = Number.isInteger(choice.max) ? choice.max : null;
    if (min !== null && selecionadas.length < min) {
      return progressionError(
        'FEAT_CHOICE_TOO_FEW',
        `A escolha "${choiceId}" exige ao menos ${min} opção(ões); vieram ${selecionadas.length}.`,
        { featId: feat.id, choiceId, min, received: selecionadas.length },
      );
    }
    if (max !== null && selecionadas.length > max) {
      return progressionError(
        'FEAT_CHOICE_TOO_MANY',
        `A escolha "${choiceId}" admite no máximo ${max} opção(ões); vieram ${selecionadas.length}.`,
        { featId: feat.id, choiceId, max, received: selecionadas.length },
      );
    }
    if (new Set(selecionadas).size !== selecionadas.length) {
      return progressionError('FEAT_CHOICE_DUPLICATE', `A escolha "${choiceId}" tem opções repetidas.`, {
        featId: feat.id,
        choiceId,
      });
    }
    const validas = new Set((Array.isArray(choice.options) ? choice.options : []).map((opcao) => opcao?.id));
    for (const opcao of selecionadas) {
      if (!validas.has(opcao)) {
        return progressionError(
          'FEAT_CHOICE_OPTION_UNKNOWN',
          `"${String(opcao)}" não é uma opção declarada de "${choiceId}".`,
          { featId: feat.id, choiceId, option: opcao ?? null },
        );
      }
    }
  }
  return null;
}

/**
 * Confere que os aumentos de atributo que o talento concede via escolha não
 * estourariam o teto de 20.
 *
 * Lê os `grants` estruturados da opção escolhida (`modifier` com
 * `target: "ability.<chave>.score"` e `operation: "add"`), nunca o rótulo da
 * opção.
 * @param {object} character
 * @param {object} feat
 * @param {object} escolhas
 * @returns {object | null} AppError ou `null`
 */
function abilityIncrementsFor(feat, escolhas) {
  const declaradas = choicesOf(feat);
  const incrementos = {};
  for (const [choiceId, choice] of declaradas) {
    const selecionadas = Array.isArray(escolhas?.[choiceId]) ? escolhas[choiceId] : [];
    for (const opcaoId of selecionadas) {
      const opcao = (Array.isArray(choice.options) ? choice.options : []).find((item) => item?.id === opcaoId);
      for (const grant of Array.isArray(opcao?.grants) ? opcao.grants : []) {
        if (grant?.type !== 'modifier' || grant.operation !== 'add' || typeof grant.target !== 'string') {
          continue;
        }
        const casado = /^ability\.([a-z]+)\.score$/.exec(grant.target);
        if (casado === null || !Number.isInteger(grant.value)) {
          continue;
        }
        incrementos[casado[1]] = (incrementos[casado[1]] ?? 0) + grant.value;
      }
    }
  }
  return incrementos;
}

/**
 * Confere que os aumentos de atributo concedidos pelas opções escolhidas não
 * estouram o teto de 20.
 * @param {object} character
 * @param {object} feat
 * @param {object} escolhas
 * @returns {object | null} AppError ou `null`
 */
function validateAbilityCaps(character, feat, escolhas) {
  const incrementos = abilityIncrementsFor(feat, escolhas);
  for (const [chave, incremento] of Object.entries(incrementos)) {
    const atual = character.state.abilities?.[chave];
    if (!Number.isInteger(atual)) {
      return progressionError('FEAT_ABILITY_UNKNOWN', `"state.abilities.${chave}" não é um inteiro.`, {
        featId: feat.id,
        ability: chave,
      });
    }
    if (atual + incremento > ABILITY_SCORE_MAXIMUM) {
      return progressionError(
        'FEAT_ABILITY_CAP',
        `"${chave}" iria a ${atual + incremento}, acima do teto ${ABILITY_SCORE_MAXIMUM}.`,
        { featId: feat.id, ability: chave, current: atual, increment: incremento, maximum: ABILITY_SCORE_MAXIMUM },
      );
    }
  }
  return null;
}

/**
 * Valida uma seleção de talento sem aplicar nada.
 * @param {object} character
 * @param {{featRef: *, choices?: object}} selection
 * @param {{registry: object}} context
 * @returns {import('../../core/result.js').Result} Result<{feat: object, featId: string}, AppError>
 */
export function validateFeatChoice(character, selection, context = {}) {
  if (!hasCharacterShape(character)) {
    return err(progressionError('FEAT_CHARACTER_INVALID', 'A escolha de talento exige um CanonicalCharacter.', {}));
  }
  const registry = context?.registry;
  if (registry === null || typeof registry !== 'object' || typeof registry.get !== 'function') {
    return err(
      progressionError('FEAT_REGISTRY_REQUIRED', 'A mecânica do talento vem do catálogo: "context.registry" é obrigatório.', {}),
    );
  }
  if (selection === null || typeof selection !== 'object' || Array.isArray(selection)) {
    return err(progressionError('FEAT_SELECTION_INVALID', 'A seleção de talento deve ser um objeto.', {}));
  }

  const featId = idOf(selection.featRef);
  if (featId === null) {
    return err(progressionError('FEAT_REF_REQUIRED', 'A seleção precisa de "featRef" com o ContentId do talento.', {}));
  }
  const feat = registry.get(featId);
  if (feat === null || feat === undefined || feat.type !== 'feat') {
    return err(progressionError('FEAT_UNRESOLVED', `O talento "${featId}" não existe no catálogo ativo.`, { featId }));
  }

  // Repetibilidade: o campo estruturado `repeatable` é a única autoridade.
  const jaTem = (Array.isArray(character.build.featRefs) ? character.build.featRefs : []).some(
    (referencia) => idOf(referencia) === featId,
  );
  if (jaTem && feat.repeatable !== true) {
    return err(
      progressionError('FEAT_NOT_REPEATABLE', `O talento "${featId}" não é repetível e o personagem já o possui.`, {
        featId,
      }),
    );
  }

  const erroPre = validatePrerequisites(character, feat);
  if (erroPre !== null) {
    return err(erroPre);
  }
  const erroEscolhas = validateChoiceSelections(feat, selection.choices);
  if (erroEscolhas !== null) {
    return err(erroEscolhas);
  }
  const erroTeto = validateAbilityCaps(character, feat, selection.choices ?? {});
  if (erroTeto !== null) {
    return err(erroTeto);
  }

  return ok(Object.freeze({ feat, featId }));
}

/**
 * Aplica a escolha de um talento. Devolve o Command contract da Task 17.
 *
 * @param {object} character
 * @param {{featRef: *, choices?: object}} selection
 * @param {{registry: object}} context
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function applyFeatChoice(character, selection, context = {}) {
  const validacao = validateFeatChoice(character, selection, context);
  if (!validacao.ok) {
    return commandErr({ character, error: validacao.error });
  }
  const { feat, featId } = validacao.value;

  const packageVersion =
    typeof selection.featRef === 'object' && typeof selection.featRef?.packageVersion === 'string'
      ? selection.featRef.packageVersion
      : character.build.contentScopes?.[featId.split(':')[0]]?.packageVersion;
  if (typeof packageVersion !== 'string') {
    return commandErr({
      character,
      error: progressionError(
        'FEAT_PACKAGE_VERSION_UNKNOWN',
        `Não foi possível determinar a "packageVersion" do talento "${featId}" pelos escopos do personagem; ` +
          'uma versão não é inventada.',
        { featId },
      ),
    });
  }

  // O talento entra no FIM de `build.featRefs`; esse índice é o que dá
  // identidade à instância.
  const featRefsAnteriores = Array.isArray(character.build.featRefs) ? character.build.featRefs : [];
  const featRefs = [...featRefsAnteriores, Object.freeze({ id: featId, packageVersion })];
  const indiceDaInstancia = featRefs.length - 1;

  // `build.choices` é a fonte de verdade das escolhas (mesmo contrato do
  // codec/`collect-effects`), mas a chave NÃO pode ser o `choiceId` nu: 55 dos
  // 75 talentos do catálogo declaram `aumento-atributo`, e 4 são repetíveis.
  // Chaveando por `choiceId`, aplicar "Resiliente" (Constituição) e depois
  // "Adepto Elemental" (Inteligência) apagava a primeira escolha em silêncio, e
  // tomar o mesmo talento repetível duas vezes só guardava uma das duas.
  //
  // A chave é qualificada pela PROVENIÊNCIA da instância
  // (`<sourceInstanceId>:<choiceId>`) — o mesmo princípio que `state.resources`
  // e `usageFlags` já usam (Tasks 15/20/21). `deriveSourceInstanceId` é a MESMA
  // função que `collect-effects.js` usa para montar o `sourceInstanceId` da
  // fonte `feat` no índice correspondente, então a chave gravada aqui é
  // exatamente a que o motor procura depois.
  const sourceInstanceId = deriveSourceInstanceId({
    collection: 'feat',
    index: indiceDaInstancia,
    key: featId,
  });
  const choices = { ...(character.build.choices ?? {}) };
  for (const [choiceId, opcoes] of Object.entries(selection.choices ?? {})) {
    choices[qualifiedChoiceKey(sourceInstanceId, choiceId)] = Object.freeze([...opcoes]);
  }

  let proximo = {
    ...character,
    build: { ...character.build, featRefs, choices },
  };

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
    // Rollback TOTAL: nada do talento fica no personagem devolvido.
    return commandErr({ character, error: concessoes.error });
  }
  proximo = concessoes.value.character;

  const affected = ['build.featRefs', 'build.choices'];
  if (concessoes.value.applied.length > 0) {
    affected.push('state.resources', 'state.activeEffects');
  }

  // `affected` de atributo é MEDIDO, não presumido.
  //
  // A versão anterior declarava `ability.<chave>.score`/`hp.maximum` sempre que
  // a opção escolhida tinha um grant de atributo — e isso era uma MENTIRA: o
  // modificador derivado não mudava. Duas causas, uma já corrigida:
  //
  //   1. o motor não expandia `choice.options[].grants` (corrigido nesta
  //      rodada, em `domain/effects/collect-effects.js`); e
  //   2. o catálogo declara esses grants sobre `ability.<chave>.score` (626
  //      efeitos), enquanto `queries/abilities.js#getAbilityModifier` resolve
  //      o alvo `ability.<chave>` — vocabulários diferentes, então o grant
  //      ainda não chega ao valor derivado. Reconciliar os dois é decisão de
  //      contrato entre a Task 8/9 (conteúdo) e a Task 16 (consultas), e não
  //      pode ser tomada aqui: `overrides["ability.forca"]` é a chave que o
  //      usuário JÁ tem persistida (ver character-queries.test.js), e mudar o
  //      alvo da consulta mudaria o significado desses overrides.
  //      Registrado como concern C9.
  //
  // Enquanto (2) não for resolvido, comparar antes/depois mantém `affected`
  // verdadeiro por construção — e passa a declarar os paths sozinho, sem
  // mudança neste arquivo, assim que o vocabulário for reconciliado.
  const incrementos = abilityIncrementsFor(feat, selection.choices ?? {});
  for (const chave of Object.keys(incrementos)) {
    const antes = getAbilityModifier(character, chave, context);
    const depois = getAbilityModifier(proximo, chave, contexto);
    if (!antes.ok || !depois.ok || antes.value === depois.value) {
      continue;
    }
    affected.push(`ability.${chave}.score`);
    if (chave === 'constituicao') {
      // Constituição entra na recomputação do PV máximo (Task 23).
      affected.push('hp.maximum');
    }
  }

  return commandOk({
    character: proximo,
    events: [
      Object.freeze({
        type: 'feat-chosen',
        featId,
        repeatable: feat.repeatable === true,
        warnings: Object.freeze([...concessoes.value.warnings]),
      }),
    ],
    affected: [...new Set(affected)],
  });
}
