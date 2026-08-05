// Módulo `infra/character/legacy-alias-resolver`: consome o mapa de
// aliases exato de `dados/pacotes/dnd2024/migrations/character-v1-aliases.json`
// (entidade `migration-map`) para traduzir nomes legados (a string
// literal que o app monolítico persistia — em português, no formato
// legado) para o `ContentId` v1 qualificado correspondente. Não duplica
// aliases em JavaScript: o mapa é injetado; este módulo só monta uma busca
// O(1) sobre ele. Não faz normalização aproximada (case-insensitive,
// remoção de acento, trim heurístico...): a chave de busca é a string
// bruta exata, igual ao `from` do mapa.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';

const SCOPE = 'infra.character.legacy-alias-resolver';

/**
 * Cria um resolvedor de aliases legados a partir de uma entidade
 * `migration-map` já carregada (ex.: o JSON de
 * `dnd2024:migration-map:character-v1-aliases`).
 * @param {{mappings: ReadonlyArray<{from: string, to: string}>}} characterV1Aliases
 * @returns {Readonly<{resolve: Function, has: Function, size: number}>}
 */
export function createLegacyAliasResolver(characterV1Aliases) {
  if (
    characterV1Aliases === null ||
    typeof characterV1Aliases !== 'object' ||
    !Array.isArray(characterV1Aliases.mappings)
  ) {
    throw new TypeError(
      'createLegacyAliasResolver: "characterV1Aliases" deve ser uma entidade migration-map com "mappings".',
    );
  }

  const byFrom = new Map();
  // Mapa inverso (ContentId -> nome legado de exibição), usado pelo encoder
  // para reconstruir os campos planos de exibição do baseline (ex.:
  // `salvaguardas_proficientes` guarda "Força", não
  // "dnd2024:ability:forca"). Quando mais de um alias aponta para o mesmo
  // ContentId (só acontece hoje com habilidades: "forca"/"Força"), a forma
  // com inicial maiúscula sempre vence — é a forma de exibição usada pelo
  // app legado; a chave minúscula é uma variante interna, nunca exibida.
  const byToDisplay = new Map();
  for (const mapping of characterV1Aliases.mappings) {
    if (
      mapping === null ||
      typeof mapping !== 'object' ||
      typeof mapping.from !== 'string' ||
      typeof mapping.to !== 'string'
    ) {
      throw new TypeError(
        'createLegacyAliasResolver: cada mapeamento deve ser {from: string, to: string}.',
      );
    }
    if (byFrom.has(mapping.from) && byFrom.get(mapping.from) !== mapping.to) {
      throw new TypeError(
        `createLegacyAliasResolver: alias "${mapping.from}" está mapeado para mais de um destino ("${byFrom.get(mapping.from)}" e "${mapping.to}").`,
      );
    }
    byFrom.set(mapping.from, mapping.to);

    const isUppercaseDisplay = /^[A-ZÀ-Ý]/.test(mapping.from);
    if (isUppercaseDisplay || !byToDisplay.has(mapping.to)) {
      byToDisplay.set(mapping.to, mapping.from);
    }
  }

  /**
   * Resolve um ContentId de volta para o nome legado de exibição (inverso
   * de `resolve`). Devolve `null` quando não há alias para esse id.
   * @param {string} id
   * @returns {string | null}
   */
  function reverseResolve(id) {
    return byToDisplay.get(id) ?? null;
  }

  /**
   * Resolve um nome legado exato para o ContentId correspondente.
   * @param {string} from
   * @returns {import('../../core/result.js').Result}
   */
  function resolve(from) {
    if (typeof from !== 'string' || from.length === 0) {
      return err(
        createAppError({
          code: 'CHARACTER_LEGACY_ALIAS_INVALID_INPUT',
          scope: SCOPE,
          message: 'O nome legado a resolver deve ser uma string não vazia.',
          context: { receivedType: typeof from },
        }),
      );
    }
    if (!byFrom.has(from)) {
      return err(
        createAppError({
          code: 'CHARACTER_LEGACY_ALIAS_NOT_FOUND',
          scope: SCOPE,
          message: `Não há alias exato para o nome legado "${from}".`,
          context: { from },
        }),
      );
    }
    return ok(byFrom.get(from));
  }

  /**
   * @param {string} from
   * @returns {boolean}
   */
  function has(from) {
    return byFrom.has(from);
  }

  return Object.freeze({ resolve, has, reverseResolve, size: byFrom.size });
}
