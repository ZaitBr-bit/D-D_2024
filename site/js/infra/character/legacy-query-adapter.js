// Módulo `infra/character/legacy-query-adapter`: ponte entre um registro de
// personagem legado (plano, `LegacyCharacterRecord`) e as consultas puras de
// `site/js/domain/character/queries/*` (Task 16), que só conhecem o
// personagem canônico v2. Implementado POR CIMA de
// `decodeCharacterRecord` (Task 12) — nunca reimplementa normalização de
// campo legado (ex.: `pv_temp`/`pv_temporario`); só reformata a saída do
// codec para o par `{character, context}` que as consultas esperam.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { decodeCharacterRecord } from './character-codec.js';
import { getMaximumHitPoints } from '../../domain/progression/index.js';

const SCOPE = 'infra.character.legacy-query-adapter';

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Projeta um registro legado (bruto, possivelmente mutado em memória pelo
 * criador/ficha) para o personagem canônico v2, pronto para ser passado às
 * consultas de `domain/character/queries/*`. Só decodifica — nunca
 * persiste, nunca cria recursos, nunca corrige o registro.
 *
 * Só aceita registros que decodificam em modo editável: um registro de
 * schema futuro ou com colisão de campo reservado não tem personagem
 * canônico para consultar (mesma regra de
 * `infra/character/legacy-character-projection.js#acceptLegacyCharacterMutation`,
 * reaproveitada aqui só que para leitura, não para aceitar uma mutação a
 * salvar).
 *
 * @param {object} rawRecord - LegacyCharacterRecord.
 * @param {{aliasResolver: object, now: string, contentManifests?: object}} context
 * @returns {import('../../core/result.js').Result} Result<object, AppError> (CanonicalCharacter, Task 12)
 */
export function projectLegacyCharacterForQueries(rawRecord, context = {}) {
  const decoded = decodeCharacterRecord(rawRecord, context);
  if (!decoded.ok) {
    return decoded;
  }
  if (decoded.value.mode !== 'editable') {
    return err(
      createAppError({
        code: 'CHARACTER_LEGACY_QUERY_UNSUPPORTED_SCHEMA',
        scope: SCOPE,
        message: 'Este registro não tem personagem canônico consultável (schema futuro ou colisão de campo reservado).',
        context: { detectedVersion: decoded.value.detectedVersion ?? null },
      }),
    );
  }
  return ok(decoded.value.character);
}

/**
 * Extrai, do MESMO registro legado bruto, as dicas numéricas que as
 * consultas de PV/deslocamento ainda não sabem derivar do ruleset sozinhas
 * (PV máximo — `getHitPointProjection` exige `context.maximumHitPoints`
 * quando não há override manual; ver comentário de
 * `domain/character/queries/hit-points.js`). É leitura DIRETA de um campo
 * plano já existente no registro (`pv_max`), nunca uma reconciliação
 * própria de campos divergentes — essa reconciliação já aconteceu dentro de
 * `decodeCharacterRecord`/`migrations/v1-to-v2.js` para todo campo que o
 * codec estrutura; `pv_max` não é estruturado no canônico por design (ver
 * comentário do schema), então continua vindo direto do registro plano.
 * @param {object} rawRecord - LegacyCharacterRecord.
 * @returns {Readonly<{maximumHitPoints: number | null}>}
 */
export function deriveLegacyQueryHints(rawRecord) {
  const pvMax = isPlainObject(rawRecord) ? rawRecord.pv_max : undefined;
  return Object.freeze({
    maximumHitPoints: typeof pvMax === 'number' && Number.isFinite(pvMax) ? pvMax : null,
  });
}

/**
 * Resolve o PV MÁXIMO a partir do personagem CANÔNICO, sem o registro plano.
 *
 * ## Por que isto existe (bug de integração achado no cutover da Task 33)
 *
 * `deriveLegacyQueryHints` precisa do `rawRecord`, e quem tem o registro plano
 * é quem decodifica. A sessão da ficha (`features/sheet/sheet-session.js`)
 * carrega pelo REPOSITÓRIO, que já devolve o personagem canônico — ela nunca
 * viu o registro plano. Até o cutover isso não aparecia porque só o HARNESS de
 * teste montava a ficha, e ele injetava `maximumHitPoints` à mão por
 * `projectionContext`. Num composition root de produção não há o que injetar
 * ali, e o resultado era a ficha de QUALQUER personagem legado não abrir:
 * `CHARACTER_QUERY_HP_MAXIMUM_UNKNOWN`.
 *
 * ## As duas fontes, nesta ordem, e por quê
 *
 *   1. `getMaximumHitPoints` (Task 23): recomputa a partir de
 *      `state.hitPointRolls`. É a fonte CANÔNICA — subir Constituição por ASI
 *      recalcula o máximo retroativamente. Só existe para personagens nascidos
 *      (ou nivelados) na arquitetura nova.
 *   2. `extensions.legacyPassthrough.pv_max`: o MESMO campo plano que
 *      `deriveLegacyQueryHints` lê, preservado pelo codec para todo registro
 *      migrado do v1. Um registro legado não tem histórico de rolagens, e
 *      inventar entradas plausíveis para ele é o default de migração proibido
 *      pelas Global Constraints.
 *
 * Nenhuma das duas disponível -> `null`, e `getHitPointProjection` RECUSA com
 * o seu erro nomeado. Nada de "estimar" um máximo: um PV máximo inventado é a
 * diferença entre um personagem vivo e um morto.
 *
 * O override manual (`overrides['hp.maximum']`) NÃO é consultado aqui de
 * propósito: `getHitPointProjection` já lhe dá precedência sobre esta dica, e
 * duplicar a precedência criaria dois lugares onde a mesma regra pode divergir.
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {object} [context] - contexto de consulta (`registry`, ...).
 * @returns {number|null} o máximo, ou `null` quando não é derivável.
 */
export function resolveCanonicalMaximumHitPoints(character, context = {}) {
  const derivado = getMaximumHitPoints(character, context);
  if (derivado.ok === true && Number.isFinite(derivado.value)) {
    return derivado.value;
  }
  const passthrough = character?.extensions?.legacyPassthrough;
  const pvMax = isPlainObject(passthrough) ? passthrough.pv_max : undefined;
  return typeof pvMax === 'number' && Number.isFinite(pvMax) ? pvMax : null;
}
