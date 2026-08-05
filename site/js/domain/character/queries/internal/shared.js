// Módulo `domain/character/queries/internal/shared`: helpers PRIVADOS
// compartilhados pelas consultas puras de personagem (Task 16). Não faz
// parte da porta pública de `domain/character/queries/index.js` — é reexport
// interno para evitar duplicar a mesma lógica pequena (validação de forma,
// resolução de ability id, coleta opcional de efeitos) em cada arquivo de
// consulta. Módulo de domínio puro: sem import de `infra`, sem globais de
// navegador (site/js/domain/** é verificado por scripts/check-architecture.mjs).

import { ok, err } from '../../../../core/result.js';
import { createAppError } from '../../../../core/errors.js';
import { ABILITY_KEYS } from '../../model.js';
import { collectCharacterEffects, resolveNumericTarget, isAllowedTargetPath } from '../../../effects/index.js';

// Escopo usado em todos os AppError emitidos pelas consultas de personagem.
export const QUERIES_SCOPE = 'domain.character.queries';

const ABILITY_KEY_SET = new Set(ABILITY_KEYS);

/**
 * Cria um AppError padronizado do escopo de consultas de personagem.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
export function queryError(code, message, context = {}) {
  return createAppError({ code, scope: QUERIES_SCOPE, message, context });
}

/**
 * Confere que `character` tem a forma mínima de um CanonicalCharacter
 * (identity/build/state presentes como objetos). Não repete a validação
 * completa do schema (isso é responsabilidade de
 * `domain/character/validation.js`) — só a forma mínima necessária para as
 * consultas não explodirem com `TypeError` ao acessar campos aninhados.
 * @param {*} character
 * @returns {import('../../../../core/result.js').Result} Result<true, AppError>
 */
export function requireCharacterShape(character) {
  if (
    character === null ||
    typeof character !== 'object' ||
    character.identity === null ||
    typeof character.identity !== 'object' ||
    character.build === null ||
    typeof character.build !== 'object' ||
    character.state === null ||
    typeof character.state !== 'object'
  ) {
    return err(
      queryError(
        'CHARACTER_QUERY_INVALID_CHARACTER',
        'A consulta exige um CanonicalCharacter com identity/build/state.',
        {},
      ),
    );
  }
  return ok(true);
}

/**
 * Resolve um identificador de habilidade para a chave canônica usada em
 * `state.abilities` (`forca`, `destreza`, ...). Aceita tanto a chave
 * canônica direta quanto um ContentId de habilidade do ruleset
 * (`"dnd2024:ability:forca"` -> `"forca"`), nunca um nome de exibição em
 * português solto (isso seria o "lookup textual" que esta tarefa elimina).
 * @param {*} abilityId
 * @returns {import('../../../../core/result.js').Result} Result<string, AppError>
 */
export function resolveAbilityKey(abilityId) {
  if (typeof abilityId !== 'string' || abilityId.length === 0) {
    return err(
      queryError('CHARACTER_QUERY_INVALID_ABILITY_ID', '"abilityId" deve ser uma string não vazia.', {
        abilityId: typeof abilityId === 'string' ? abilityId : null,
      }),
    );
  }
  if (ABILITY_KEY_SET.has(abilityId)) {
    return ok(abilityId);
  }
  const segments = abilityId.split(':');
  const slug = segments.length === 3 && segments[1] === 'ability' ? segments[2] : null;
  if (slug !== null && ABILITY_KEY_SET.has(slug)) {
    return ok(slug);
  }
  return err(
    queryError('CHARACTER_QUERY_UNKNOWN_ABILITY_ID', `"${abilityId}" não é uma chave de habilidade nem um ContentId de habilidade reconhecido.`, {
      abilityId,
    }),
  );
}

/**
 * Extrai o slug (terceiro segmento) de um ContentId de classe/subclasse já
 * resolvido no personagem (`build.classRef.id`/`build.subclassRef.id`),
 * usado para decidir regras específicas de classe (ex.: Defesa sem Armadura
 * do Bárbaro) por ID estável do ruleset, nunca pelo nome de exibição em
 * português (que é localizado e frágil).
 * @param {*} ref - `{id, packageVersion}` ou `null`/`undefined`.
 * @returns {string | null}
 */
export function refSlug(ref) {
  if (ref === null || ref === undefined || typeof ref.id !== 'string') {
    return null;
  }
  const segments = ref.id.split(':');
  return segments.length === 3 ? segments[2] : null;
}

/**
 * Lê o canal `context.talentPassives` (fix round 1, C2): bônus numéricos
 * derivados de talentos que ainda NÃO existem como efeito declarativo do
 * motor da Task 15 (ex.: Alerta, Velocista, Mestre em Armaduras Médias).
 * A ÚNICA fonte de verdade de "quais talentos concedem o quê" continua
 * sendo `site/js/talentos-effects.js#resolverPassivosTalentos` — este canal
 * só recebe os NÚMEROS já resolvidos, nunca reimplementa a lista de
 * talentos. Quem popula `context.talentPassives` (ex.: o adapter em
 * `utils.js`) é responsável por mapear a saída de `resolverPassivosTalentos`
 * para este vocabulário fechado; consultas de domínio nunca conhecem nomes
 * de talento.
 * @param {object} context
 * @returns {Readonly<{armorClassBonus: number, mediumArmorMaxDexBonus: number | null, initiativeBonus: number, speedBonus: number}>}
 */
export function readTalentPassives(context = {}) {
  const passives = context?.talentPassives;
  const num = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  return Object.freeze({
    armorClassBonus: num(passives?.armorClassBonus, 0),
    mediumArmorMaxDexBonus: num(passives?.mediumArmorMaxDexBonus, null),
    initiativeBonus: num(passives?.initiativeBonus, 0),
    speedBonus: num(passives?.speedBonus, 0),
  });
}

// Catálogo neutro usado quando `context.registry` não foi informado:
// resolve QUALQUER referência de conteúdo (ruleset/classe/subclasse/
// espécie/antecedente/item/talento) para uma entidade-stub sem efeitos,
// nunca falha, nunca lista nada. Existe para que `collectCharacterEffects`
// (Task 15) SEMPRE possa rodar — inclusive para sintetizar o grupo `manual`
// a partir de `character.overrides`, que não depende de catálogo nenhum —
// em vez de pular o motor inteiro e, com isso, ignorar overrides quando não
// há catálogo real (fix round 1, achado I1: overrides do próprio
// personagem nunca deveriam depender da presença de conteúdo externo).
const NULL_REGISTRY = Object.freeze({
  get() {
    return null;
  },
  resolve(reference) {
    const id = typeof reference === 'string' ? reference : reference?.id;
    return ok(Object.freeze({ id: typeof id === 'string' ? id : 'stub', type: 'stub', effects: Object.freeze([]) }));
  },
  list() {
    return Object.freeze([]);
  },
});

/**
 * Coleta os efeitos ativos do personagem via o motor declarativo (Task 15).
 * Com `context.registry` real, aplica efeitos de progressão/equipamento do
 * catálogo; sem ele, usa `NULL_REGISTRY` (acima) — o que garante que
 * `character.overrides` (grupo `manual`, sintetizado direto de
 * `character.overrides` sem nenhuma referência de conteúdo) SEMPRE é
 * aplicado, com ou sem catálogo real informado.
 * @param {object} character
 * @param {object} context
 * @returns {import('../../../../core/result.js').Result} Result<ReadonlyArray<object>, AppError>
 */
export function collectEffectsOptional(character, context = {}) {
  const safeContext = context !== null && typeof context === 'object' ? context : {};
  const registry = safeContext.registry ?? NULL_REGISTRY;

  // `character.overrides` pode, em tese, conter chaves fora do vocabulário
  // fechado de alvos derivados (ex.: um registro antigo/corrompido, ou uma
  // chave de schema futuro ainda não migrada). Sem filtrar, uma dessas
  // chaves faria `collectCharacterEffects` devolver `EFFECT_TARGET_NOT_ALLOWED`
  // para TODA consulta, não só a do alvo problemático — uma regressão pior
  // que simplesmente ignorar a chave desconhecida (fix round 1, achado I1).
  // Todas as chaves hoje estabelecidas (`hp.maximum`, `ability.forca`, `ac`,
  // `initiative`, ...) já pertencem ao vocabulário fechado e são sintetizadas
  // normalmente pelo motor; este filtro é defesa em profundidade para o caso
  // de uma chave inesperada aparecer.
  const overrides = character?.overrides;
  let effectiveCharacter = character;
  if (overrides !== null && typeof overrides === 'object' && !Array.isArray(overrides)) {
    const entries = Object.entries(overrides);
    const filtered = entries.filter(([key]) => isAllowedTargetPath(key));
    if (filtered.length !== entries.length) {
      effectiveCharacter = { ...character, overrides: Object.fromEntries(filtered) };
    }
  }

  return collectCharacterEffects(effectiveCharacter, { ...safeContext, registry });
}

/**
 * Resolve um alvo numérico derivado aplicando os efeitos coletados sobre um
 * valor base já calculado pela regra legada equivalente. Um alvo sem
 * nenhuma contribuição de efeito devolve `baseValue` inalterado.
 * @param {{target: string, baseValue: number, effects: ReadonlyArray<object>, context?: object}} params
 * @returns {import('../../../../core/result.js').Result} Result<number, AppError>
 */
export function applyNumericEffects({ target, baseValue, effects, context = {} }) {
  return resolveNumericTarget({ target, baseValue, effects, context });
}
