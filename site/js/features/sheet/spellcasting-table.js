// Módulo `features/sheet/spellcasting-table`: o PRODUTOR de
// `context.spellcasting` na arquitetura nova (Task 33 — correção de fiação).
//
// ## O buraco que este módulo fecha
//
// `domain/spells/spellcasting-queries.js` documenta, desde a Task 18, que os
// MÁXIMOS de espaço de magia, o teto de truques e o teto de magias preparadas
// entram por `context.spellcasting` — "os números já resolvidos pelo chamador".
// Até aqui o único chamador que resolvia esses números era o HARNESS de teste
// (`tests/e2e/harness/sheet-harness.js`), que os injetava à mão por
// `projectionContext`. Em produção não havia produtor nenhum: qualquer
// conjurador abriria a ficha com todos os espaços em "desconhecido", e
// `cast-spell` recusaria com `SPELL_SLOT_MAXIMUM_UNKNOWN`.
//
// ## De onde os números vêm (nenhuma regra nova)
//
// Da MESMA matriz de progressão que a Task 23 já deriva do catálogo
// (`domain/progression/progression-queries.js#getProgressionRow`): efeitos
// `resource` ESTRUTURADOS, gated por `when: {kind: 'level'}`. Nada aqui lê
// tabela em prosa, nome de classe traduzido ou `tabela_caracteristicas` do DB
// legado — este módulo só TRADUZ o vocabulário da linha de progressão
// (`spellSlots` por círculo, `resources` por ContentId) para o vocabulário que
// `readSpellcastingTable` espera.
//
// A equivalência com o baseline é literal:
//
//   - `getEspacosMagia(tabela, nivel)` -> `row.spellSlots` (as colunas "1".."9"
//     da tabela legada são exatamente os efeitos `spell-slot-<N>` da migração
//     da Task 8). Para o BRUXO, a tabela legada preenche as mesmas colunas
//     "1".."9" com os espaços de pacto, e `getProgressionMatrix` funde a tabela
//     `pact-magic-slots` nos mesmos círculos — o comportamento coincide sem
//     nenhum `if` por identidade de classe;
//   - `getTruquesConhecidos(...)` -> recurso `truques`;
//   - `getMagiaPreparadas(...)` -> recurso `magias-preparadas`.
//
// ## Ausência nunca vira zero
//
// Classe que não declara `spellcasting` no catálogo devolve `null`: a ficha de
// um Guerreiro não afirma "você tem 0 espaços de 1º círculo", ela simplesmente
// não tem tabela de conjuração. Um recurso ausente (Paladino e Guardião não têm
// `truques`) vira `null`, e `readSpellcastingTable` já trata `null` como
// desconhecido — nunca como zero.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { getProgressionRow, MIN_LEVEL, MAX_LEVEL } from '../../domain/progression/index.js';

const SCOPE = 'features.sheet.spellcasting-table';

/**
 * Sufixo do ContentId do recurso que conta TRUQUES conhecidos.
 *
 * A chave de `row.resources` é o ContentId qualificado
 * (`dnd2024:resource:truques`); o namespace varia por pacote, o sufixo
 * estruturado não. Comparar pelo sufixo é reconhecimento por CAMPO
 * ESTRUTURADO — o mesmo critério que `progression-queries.js` usa com o
 * prefixo `spell-slot-` —, nunca por nome de exibição.
 * @type {string}
 */
export const CANTRIPS_RESOURCE_SUFFIX = ':resource:truques';

/**
 * Sufixo do ContentId do recurso que conta MAGIAS PREPARADAS.
 * @type {string}
 */
export const PREPARED_RESOURCE_SUFFIX = ':resource:magias-preparadas';

/**
 * Cria um AppError deste módulo.
 * @param {string} code - código do erro.
 * @param {string} message - explicação.
 * @param {object} [context] - dados de diagnóstico.
 * @returns {object}
 */
function tableError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Lê o máximo de um recurso da linha de progressão pelo SUFIXO estruturado do
 * seu ContentId. Ausência devolve `null` (desconhecido), nunca `0`.
 * @param {Readonly<Record<string, number>>} resources - `row.resources`.
 * @param {string} suffix - sufixo estruturado (`:resource:truques`).
 * @returns {number|null}
 */
function resourceMaximumBySuffix(resources, suffix) {
  for (const [contentId, maximum] of Object.entries(resources ?? {})) {
    if (contentId.endsWith(suffix) && Number.isInteger(maximum) && maximum >= 0) {
      return maximum;
    }
  }
  return null;
}

/**
 * Diz se a entidade de classe do personagem DECLARA conjuração no catálogo.
 *
 * É o mesmo campo estruturado que `getSpellcastingProjection` consulta
 * (`classEntity.spellcasting.ability`/`.progression`) — nunca uma lista de
 * nomes de classe conjuradora escrita no código.
 * @param {object} character - CanonicalCharacter.
 * @param {object} registry - catálogo ativo.
 * @returns {boolean}
 */
export function declaresSpellcasting(character, registry) {
  const classRef = character?.build?.classRef;
  const classId = typeof classRef === 'string' ? classRef : (classRef?.id ?? null);
  if (classId === null || typeof registry?.get !== 'function') {
    return false;
  }
  const entity = registry.get(classId);
  return entity !== null && entity !== undefined && entity.spellcasting !== null && typeof entity.spellcasting === 'object';
}

/**
 * Constrói o canal `context.spellcasting` do personagem, no nível ATUAL dele.
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {{registry?: object}} [context] - contexto de consulta; `registry` é
 *   obrigatório (sem catálogo não há progressão a derivar).
 * @returns {import('../../core/result.js').Result} `Result<table|null, AppError>`
 *   — `null` quando a classe do personagem não declara conjuração.
 */
export function buildSpellcastingTable(character, context = {}) {
  const registry = context?.registry ?? null;
  if (registry === null || typeof registry !== 'object') {
    return err(
      tableError(
        'SHEET_SPELLCASTING_TABLE_REGISTRY_REQUIRED',
        'A tabela de conjuração é derivada do catálogo: "context.registry" é obrigatório.',
      ),
    );
  }
  if (!declaresSpellcasting(character, registry)) {
    // Não é erro: a classe simplesmente não conjura (ou o personagem ainda não
    // tem classe). Devolver uma tabela vazia afirmaria "zero espaços", que é
    // uma afirmação de jogo diferente de "não há tabela".
    return ok(null);
  }

  const level = character?.state?.level;
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    return err(
      tableError('SHEET_SPELLCASTING_TABLE_LEVEL_INVALID', `"state.level" precisa ser um inteiro de ${MIN_LEVEL} a ${MAX_LEVEL}.`, {
        level: level ?? null,
      }),
    );
  }

  const row = getProgressionRow(character, level, context);
  if (row.ok !== true) {
    return row;
  }

  const slotMaximums = {};
  for (const [circle, maximum] of Object.entries(row.value.spellSlots ?? {})) {
    if (Number.isInteger(maximum) && maximum >= 0) {
      slotMaximums[circle] = maximum;
    }
  }

  return ok(
    Object.freeze({
      slotMaximums: Object.freeze(slotMaximums),
      cantripsKnown: resourceMaximumBySuffix(row.value.resources, CANTRIPS_RESOURCE_SUFFIX),
      preparedLimit: resourceMaximumBySuffix(row.value.resources, PREPARED_RESOURCE_SUFFIX),
    }),
  );
}

/**
 * Cria o PRODUTOR que a sessão da ficha recebe como porta nomeada.
 *
 * @param {{registry: object}} ports - catálogo ativo.
 * @returns {(character: object) => import('../../core/result.js').Result}
 */
export function createSpellcastingTableProducer({ registry } = {}) {
  if (registry === null || registry === undefined || typeof registry !== 'object') {
    throw new TypeError('createSpellcastingTableProducer: "registry" é obrigatório.');
  }
  /**
   * @param {object} character - CanonicalCharacter.
   * @returns {import('../../core/result.js').Result}
   */
  return (character) => buildSpellcastingTable(character, { registry });
}
