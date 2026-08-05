// Módulo `domain/character/queries/context-variables` (Task 22a): resolve, a
// partir do personagem REAL, o mapa `context.variables` que o motor de
// efeitos (`resolveNumericValue`, Task 15) usa para transformar um `max`
// declarado como NOME DE VARIÁVEL (`"carismaModifierMin1"`) num inteiro.
//
// ## Por que este módulo existe
//
// Até a Task 21, NENHUM caminho de produção populava `context.variables` com
// modificador de atributo: `resolveNumericValue("carismaModifier")` caía em
// `EFFECT_VALUE_NOT_NUMERIC`, e por isso todo recurso cujo teto é "modificador
// de atributo (mínimo de 1)" ficou fora dos handlers das Tasks 20/21 (concern
// C5 dos dois relatórios). Isso bloqueava, entre outros, a Inspiração de Bardo
// — o recurso que 5 ações de subclasse do Bardo consomem.
//
// A plumbing é REAL: os valores vêm de `getAbilityModifier`/
// `getProficiencyBonus` (as consultas puras já revisadas da Task 16, que
// aplicam os efeitos declarativos de `ability.<chave>`/`proficiency-bonus`
// antes de derivar), nunca de constante embutida. Personagem sem pontuação de
// atributo materializada faz este módulo FALHAR com o erro da própria
// consulta (`CHARACTER_QUERY_ABILITY_SCORE_MISSING`) — nunca vira um `10`
// plausível chutado.
//
// ## Por que aqui, e não em `domain/effects/**`
//
// `domain/character/queries/abilities.js` IMPORTA `domain/effects`. Construir
// as variáveis dentro do motor de efeitos inverteria essa dependência e criaria
// um ciclo. Este módulo fica do lado que já depende do outro.
//
// ## Recursão
//
// `buildEffectContextVariables` chama as consultas com o contexto recebido
// SEM o campo `variables` que está sendo construído. Um efeito de atributo que
// dependesse de uma variável ainda não resolvida falha explicitamente em vez de
// recursar.
//
// ## O sufixo `Min1`
//
// O vocabulário declarativo de `resourceEffect.max` não tem operador de piso, e
// "modificador de atributo (mínimo de 1)" é a forma que o PHB 2024 usa em
// dezenas de reservas (Inspiração de Bardo, Passos Feéricos, Sorte do
// Tenebroso, Restaurar Equilíbrio). Em vez de acrescentar gramática ao schema
// de efeitos (contrato fechado da Task 15), o piso é exposto como uma variável
// SEPARADA e nomeada — `carismaModifier` continua sendo o modificador cru.
// Ambas são derivadas do mesmo personagem real; nenhuma é um default de jogo.

import { ok, err } from '../../../core/result.js';
import { createAppError } from '../../../core/errors.js';
import { getAbilityModifier, getProficiencyBonus } from './abilities.js';

const SCOPE = 'domain.character.queries.context-variables';

// As seis chaves canônicas de atributo, na ordem do livro. São as MESMAS
// chaves de `state.abilities` (ver `domain/character/model.js`).
export const ABILITY_KEYS = Object.freeze([
  'forca',
  'destreza',
  'constituicao',
  'inteligencia',
  'sabedoria',
  'carisma',
]);

/**
 * Nome da variável do modificador CRU de um atributo (ex.: `carismaModifier`).
 * @param {string} abilityKey
 * @returns {string}
 */
export function abilityModifierVariable(abilityKey) {
  return `${abilityKey}Modifier`;
}

/**
 * Nome da variável do modificador com piso 1 (ex.: `carismaModifierMin1`).
 * @param {string} abilityKey
 * @returns {string}
 */
export function abilityModifierMin1Variable(abilityKey) {
  return `${abilityKey}ModifierMin1`;
}

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
function variablesError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Constrói o mapa de variáveis numéricas do personagem.
 *
 * Devolve, congelado:
 *   - `<atributo>Modifier` e `<atributo>ModifierMin1` para os seis atributos;
 *   - `proficiency-bonus` (o nome já usado por `domain/commands/rest.js`) e o
 *     alias `proficiencyBonus`;
 *   - `level` e `levelHalfDown` (`floor(nível / 2)`), usados por recargas que o
 *     baseline calcula a partir do nível (Restauração Feiticeira,
 *     `site/js/pages/sheet.js:5676`).
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {object} [context] - `{registry?, level?, choices?, ...}`; o campo
 *   `variables` que porventura exista é IGNORADO na resolução (ver comentário
 *   de topo sobre recursão).
 * @returns {import('../../../core/result.js').Result} `ok(Readonly<object>)`
 */
export function buildEffectContextVariables(character, context = {}) {
  if (character === null || typeof character !== 'object' || Array.isArray(character)) {
    return err(
      variablesError('CONTEXT_VARIABLES_CHARACTER_INVALID', 'A resolução de variáveis exige um personagem.', {}),
    );
  }
  // `variables` é removido de propósito: as consultas abaixo são a FONTE do
  // mapa, não consumidoras dele.
  const { variables: _ignored, ...baseContext } = context ?? {};
  void _ignored;

  const variables = {};
  for (const key of ABILITY_KEYS) {
    const modifier = getAbilityModifier(character, key, baseContext);
    if (!modifier.ok) {
      return modifier;
    }
    variables[abilityModifierVariable(key)] = modifier.value;
    variables[abilityModifierMin1Variable(key)] = Math.max(1, modifier.value);
  }

  const proficiency = getProficiencyBonus(character, baseContext);
  if (!proficiency.ok) {
    return proficiency;
  }
  variables['proficiency-bonus'] = proficiency.value;
  variables.proficiencyBonus = proficiency.value;

  const level = Number.isInteger(baseContext.level) ? baseContext.level : character?.state?.level;
  if (!Number.isInteger(level) || level < 1) {
    return err(
      variablesError('CONTEXT_VARIABLES_LEVEL_INVALID', 'O nível do personagem não é um inteiro >= 1.', {
        level: Number.isInteger(level) ? level : null,
      }),
    );
  }
  variables.level = level;
  variables.levelHalfDown = Math.floor(level / 2);

  return ok(Object.freeze(variables));
}

/**
 * Devolve o mesmo `context`, agora com `variables` resolvidas do personagem.
 *
 * Variáveis já presentes em `context.variables` VENCEM as resolvidas: quem
 * chama pode fixar um valor deliberadamente (um simulador de "e se", por
 * exemplo) sem que este módulo o sobrescreva. Quando `context.variables` já é
 * um objeto, nada é recalculado — a resolução é feita UMA vez, no ponto de
 * entrada (o adapter do registry de handlers).
 *
 * @param {object} character
 * @param {object} [context]
 * @returns {import('../../../core/result.js').Result} `ok(object)` — o contexto enriquecido
 */
export function withEffectContextVariables(character, context = {}) {
  const base = context === null || typeof context !== 'object' || Array.isArray(context) ? {} : context;
  if (base.variables !== undefined && base.variables !== null && typeof base.variables === 'object') {
    return ok(base);
  }
  const built = buildEffectContextVariables(character, base);
  if (!built.ok) {
    return built;
  }
  return ok(Object.freeze({ ...base, variables: built.value }));
}
