// Módulo `domain/spells/spell-effects`: classificação e materialização dos
// efeitos declarados por uma MAGIA do catálogo (Task 18).
//
// ## Por que classificar
//
// O baseline automatiza cerca de 50 magias em `site/js/pages/sheet.js` através
// do mapa hardcoded `MAGIAS_EFEITO` (linha 12325 em diante: CA, PV temporário,
// condições, resistências, bônus de perícia...). No pacote oficial `dnd2024`
// TODAS as 391 magias declaram exclusivamente efeitos `manual` — nenhuma
// automação de magia foi convertida para efeito declarativo nas Tasks 8-10.
//
// Isso é uma escolha legítima (`manual` é justamente o tipo que diz "esta
// mecânica existe no texto mas não é automatizada"), mas SÓ é honesta se for
// verificável: `tests/contract/spell-parity.test.js` percorre cada automação
// do mapa legado e exige que a magia correspondente exista no catálogo e
// esteja EXPLICITAMENTE marcada como `manual` aqui — nunca simplesmente
// ausente, que seria indistinguível de um esquecimento.
//
// ## Materialização
//
// Quando uma magia PASSAR a declarar efeitos de concessão (`grant-spell`,
// `resource`, `condition`, ...), este módulo não implementa nada de novo:
// envelopa o efeito num ResolvedEffect e delega ao motor da Task 15
// (`applyGrantEffects`/`revokeGrantEffects`), de modo que aplicar e revogar
// sejam exatamente inversos — a assimetria apply/revoke já foi um achado de
// revisão em tasks anteriores e não se repete aqui por construção: a revogação
// usa o MESMO `sourceInstanceId` da aplicação.

import { ok, err } from '../../core/result.js';
import {
  GRANT_TYPES,
  PROJECTION_TYPES,
  applyGrantEffects,
  revokeGrantEffects,
  createResolvedEffect,
} from '../effects/index.js';
import { spellError } from './spellcasting-queries.js';

const GRANT_TYPE_SET = new Set(GRANT_TYPES);
const PROJECTION_TYPE_SET = new Set(PROJECTION_TYPES);

// Grupo de precedência usado para efeitos de magia conjurada. Uma magia
// conjurada é uma alteração pontual dirigida pelo jogador, resolvida DEPOIS
// de progressão e equipamento — o mesmo lugar de `character.overrides` na
// escala de `domain/effects/collect-effects.js#PRECEDENCE_GROUPS`.
export const SPELL_EFFECT_GROUP = 'manual';

// Token usado no lugar da fonte quando a magia vem da fonte BASE/CLASSE, que
// o canônico representa como `sourceInstanceId: null` (ver
// `cast-spell.js#normalizeRequest`). Um sentinela explícito mantém o ID
// derivado uma string estável, sem transformar `null` em `"null"` por
// coerção acidental.
const BASE_SOURCE_TOKEN = 'base';

/**
 * Deriva o `sourceInstanceId` de uma conjuração. É determinístico (não usa
 * `Date.now()`/`Math.random()`, proibidos em `domain/**`) e carrega tanto a
 * magia quanto a instância de origem, de modo que duas conjurações da mesma
 * magia por fontes diferentes nunca colidam.
 *
 * `apply` e `revoke` chamam ESTA função com os mesmos argumentos — é o que
 * garante que a revogação atinja exatamente o que a aplicação criou.
 * @param {string} spellId
 * @param {string|null} sourceInstanceId - instância de origem da magia no
 *   personagem, ou `null` para a fonte base/classe.
 * @returns {string}
 */
export function deriveSpellCastSourceInstanceId(spellId, sourceInstanceId) {
  const source = typeof sourceInstanceId === 'string' && sourceInstanceId.length > 0 ? sourceInstanceId : BASE_SOURCE_TOKEN;
  return `spell-cast:${source}:${spellId}`;
}

/**
 * Classifica os efeitos declarados por uma entidade de magia em três baldes:
 * `grants` (materializam algo no personagem), `projections` (só modificam
 * valores derivados) e `manual` (texto sem automação).
 *
 * @param {object} spellEntity - entidade `spell` do catálogo.
 * @returns {import('../../core/result.js').Result} Result<{spellId, grants, projections, manual, automated}, AppError>
 *   `automated === false` significa "nenhuma mecânica desta magia é
 *   automatizada; tudo é `manual`".
 */
export function describeSpellAutomation(spellEntity) {
  if (spellEntity === null || typeof spellEntity !== 'object' || spellEntity.type !== 'spell') {
    return err(
      spellError('SPELL_EFFECTS_ENTITY_INVALID', 'A classificação exige uma entidade de conteúdo do tipo "spell".', {
        received: spellEntity === null || typeof spellEntity !== 'object' ? null : String(spellEntity.type),
      }),
    );
  }
  const effects = Array.isArray(spellEntity.effects) ? spellEntity.effects : [];
  const grants = [];
  const projections = [];
  const manual = [];
  for (const effect of effects) {
    const type = effect?.type;
    if (type === 'manual') {
      manual.push(Object.freeze({ effectId: typeof effect.id === 'string' ? effect.id : null }));
      continue;
    }
    if (GRANT_TYPE_SET.has(type)) {
      grants.push(Object.freeze({ effectId: typeof effect.id === 'string' ? effect.id : null, type }));
      continue;
    }
    if (PROJECTION_TYPE_SET.has(type)) {
      projections.push(Object.freeze({ effectId: typeof effect.id === 'string' ? effect.id : null, type }));
      continue;
    }
    return err(
      spellError('SPELL_EFFECTS_TYPE_UNKNOWN', `A magia declara um efeito de tipo desconhecido: ${String(type)}.`, {
        spellId: typeof spellEntity.id === 'string' ? spellEntity.id : null,
        type: typeof type === 'string' ? type : null,
      }),
    );
  }
  return ok(
    Object.freeze({
      spellId: typeof spellEntity.id === 'string' ? spellEntity.id : null,
      grants: Object.freeze(grants),
      projections: Object.freeze(projections),
      manual: Object.freeze(manual),
      automated: grants.length > 0 || projections.length > 0,
    }),
  );
}

/**
 * Materializa as concessões de uma magia conjurada, delegando ao motor da
 * Task 15. Sem efeitos de concessão, devolve o personagem INALTERADO (mesma
 * referência) — nada é criado "por precaução".
 *
 * @param {object} character - CanonicalCharacter.
 * @param {object} spellEntity - entidade `spell` do catálogo.
 * @param {{sourceInstanceId: string}} params - instância de origem da magia no personagem.
 * @param {object} [context] - repassado a `applyGrantEffects` (`variables`).
 * @returns {import('../../core/result.js').Result} Result<{character, applied, warnings, castSourceInstanceId}, AppError>
 */
export function applySpellGrants(character, spellEntity, { sourceInstanceId } = {}, context = {}) {
  const described = describeSpellAutomation(spellEntity);
  if (!described.ok) {
    return described;
  }
  if (sourceInstanceId !== null && (typeof sourceInstanceId !== 'string' || sourceInstanceId.length === 0)) {
    return err(
      spellError(
        'SPELL_EFFECTS_SOURCE_INVALID',
        '"sourceInstanceId" da conjuração deve ser uma string não vazia ou `null` (fonte base/classe).',
        {},
      ),
    );
  }
  if (described.value.spellId === null) {
    return err(
      spellError('SPELL_EFFECTS_ENTITY_INVALID', 'A entidade de magia não declara um "id" utilizável.', {}),
    );
  }
  const castSourceInstanceId = deriveSpellCastSourceInstanceId(described.value.spellId, sourceInstanceId);
  const grantIds = new Set(described.value.grants.map((grant) => grant.effectId));
  if (grantIds.size === 0) {
    return ok(Object.freeze({ character, applied: Object.freeze([]), warnings: Object.freeze([]), castSourceInstanceId }));
  }

  const resolved = [];
  let orderIndex = 0;
  for (const effect of spellEntity.effects) {
    if (!grantIds.has(typeof effect.id === 'string' ? effect.id : null)) {
      continue;
    }
    resolved.push(
      createResolvedEffect({
        effect,
        group: SPELL_EFFECT_GROUP,
        sourceId: spellEntity.id,
        sourceInstanceId: castSourceInstanceId,
        effectInstanceId: `${castSourceInstanceId}:${effect.id}`,
        orderIndex,
      }),
    );
    orderIndex += 1;
  }

  const applied = applyGrantEffects(character, resolved, context);
  if (!applied.ok) {
    return applied;
  }
  return ok(Object.freeze({ ...applied.value, castSourceInstanceId }));
}

/**
 * Revoga exatamente as concessões criadas por `applySpellGrants` para a mesma
 * magia/instância de origem (inverso exato, pelo mesmo `sourceInstanceId`).
 * @param {object} character
 * @param {{spellId: string, sourceInstanceId: string}} params
 * @param {object} [context]
 * @returns {import('../../core/result.js').Result} Result<{character, removed, warnings}, AppError>
 */
export function revokeSpellGrants(character, { spellId, sourceInstanceId } = {}, context = {}) {
  if (typeof spellId !== 'string' || spellId.length === 0) {
    return err(spellError('SPELL_EFFECTS_SOURCE_INVALID', 'A revogação exige "spellId" não vazio.', {}));
  }
  if (sourceInstanceId !== null && (typeof sourceInstanceId !== 'string' || sourceInstanceId.length === 0)) {
    return err(
      spellError(
        'SPELL_EFFECTS_SOURCE_INVALID',
        'A revogação exige "sourceInstanceId" como string não vazia ou `null` (fonte base/classe).',
        {},
      ),
    );
  }
  return revokeGrantEffects(
    character,
    { sourceInstanceIds: [deriveSpellCastSourceInstanceId(spellId, sourceInstanceId)] },
    context,
  );
}
