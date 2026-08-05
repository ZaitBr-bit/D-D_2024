// Módulo `domain/spells/cast-spell`: o comando `castSpell` (Task 18).
//
// ## `slotSource` é obrigatório e discriminado
//
// O request NUNCA carrega só um `slotLevel`: um Bruxo tem os DOIS pools ao
// mesmo tempo (`state.spells.slots`, de multiclasse/subclasse, e
// `state.spells.pactSlots`, de Magia de Pacto), e um número de círculo sozinho
// é ambíguo entre eles. Por isso:
//
//   { kind: 'spell-slot', level }  -> consome SOMENTE state.spells.slots[level]
//   { kind: 'pact-slot' }          -> consome SOMENTE state.spells.pactSlots
//   { kind: 'at-will' }            -> não consome espaço nenhum
//
// Nenhum ramo lê o pool do outro, mesmo quando o nível numérico coincide.
//
// ## Nunca decrementar o que não existe
//
// Um `{kind:'spell-slot', level}` sem entrada em `state.spells.slots[level]`
// devolve `CAST_SPELL_SLOT_NOT_AVAILABLE`; com entrada mas sem espaço livre,
// `CAST_SPELL_SLOT_EXHAUSTED`. Em nenhum caso `used` é incrementado além do
// máximo nem uma entrada é criada do nada. O MÁXIMO vem da tabela da classe
// via `context.spellcasting` (ver `spellcasting-queries.js`); quando ele é
// desconhecido, o comando FALHA com `CAST_SPELL_SLOT_MAXIMUM_UNKNOWN` em vez
// de "gastar assim mesmo" — não há como saber se restava espaço.
//
// ## Ordem das checagens
//
// Todas as validações acontecem ANTES de qualquer construção de personagem
// novo, para que uma falha devolva o personagem ORIGINAL, por referência
// lógica, com `affected: []` (contrato da Task 17).

import { ok, err } from '../../core/result.js';
import { commandOk, commandErr } from '../commands/command-result.js';
import {
  MAX_SLOT_LEVEL,
  MIN_SLOT_LEVEL,
  readSpellState,
  readSpellcastingTable,
  requireRegistry,
  requireSpellCharacterShape,
  spellError,
  spellIdOf,
  SPELL_COLLECTIONS,
} from './spellcasting-queries.js';
import { checkConcentrationReplacement, withConcentration } from './concentration.js';
import { debitMetamagicPoints, validateMetamagicUse } from './metamagic.js';

export const AFFECTED_SLOTS = 'state.spells.slots';
export const AFFECTED_PACT_SLOTS = 'state.spells.pactSlots';
export const AFFECTED_RESOURCES = 'state.resources';

const SLOT_SOURCE_KINDS = Object.freeze(['spell-slot', 'pact-slot', 'at-will']);

/**
 * Normaliza o request de conjuração aplicando os defaults do brief
 * (`metamagicIds`/`targets` = `[]`, `replaceConcentration` = `false`) e
 * recusando qualquer desvio de forma. `slotSource` NÃO tem default: é
 * obrigatório e discriminado.
 * @param {*} request
 * @returns {import('../../core/result.js').Result} Result<object, AppError>
 */
function normalizeRequest(request) {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    return err(spellError('CAST_SPELL_REQUEST_INVALID', 'O request de conjuração deve ser um objeto.', {}));
  }
  const { spellId, sourceInstanceId, slotSource } = request;
  if (typeof spellId !== 'string' || spellId.length === 0) {
    return err(spellError('CAST_SPELL_SPELL_ID_INVALID', '"spellId" deve ser um ContentId não vazio.', {}));
  }
  // `sourceInstanceId` é NULLABLE no canônico (`character-canonical-v2.schema.json`
  // #/$defs/spellEntry: `["string","null"]`), e `null` é a forma DOMINANTE:
  // `infra/character/migrations/v1-to-v2.js:505` só grava uma string para
  // magias com `origem` legada (Iniciado em Magia, Conjurador Ritualista,
  // domínio...). Toda magia comum de classe de um personagem migrado chega com
  // `null`. Exigir string aqui tornaria a lista de magias de classe inteira
  // inconjurável (`CAST_SPELL_NOT_AVAILABLE`). O significado de `null` é o
  // mesmo que `domain/effects/apply-grants.js:453` já assume ao NUNCA revogar
  // entradas de fonte não-string: "não veio de uma concessão de efeito — é a
  // fonte base/classe".
  //
  // A chave precisa estar PRESENTE mesmo assim: `undefined` implícito viraria
  // "fonte de classe" por acidente de digitação, e a escolha da fonte é o que
  // separa duas instâncias independentes de Iniciado em Magia.
  if (!Object.hasOwn(request, 'sourceInstanceId')) {
    return err(
      spellError(
        'CAST_SPELL_SOURCE_INVALID',
        '"sourceInstanceId" é obrigatório no request (use `null` para a fonte base/classe).',
        { spellId },
      ),
    );
  }
  if (sourceInstanceId !== null && (typeof sourceInstanceId !== 'string' || sourceInstanceId.length === 0)) {
    return err(
      spellError('CAST_SPELL_SOURCE_INVALID', '"sourceInstanceId" deve ser uma string não vazia ou `null`.', {
        spellId,
      }),
    );
  }
  if (
    slotSource === null ||
    typeof slotSource !== 'object' ||
    Array.isArray(slotSource) ||
    !SLOT_SOURCE_KINDS.includes(slotSource.kind)
  ) {
    return err(
      spellError(
        'CAST_SPELL_SLOT_SOURCE_INVALID',
        '"slotSource" é obrigatório e deve ser {kind:"spell-slot",level} | {kind:"pact-slot"} | {kind:"at-will"}.',
        { spellId, received: slotSource === null || typeof slotSource !== 'object' ? null : String(slotSource.kind) },
      ),
    );
  }
  if (slotSource.kind === 'spell-slot') {
    const level = slotSource.level;
    if (!Number.isInteger(level) || level < MIN_SLOT_LEVEL || level > MAX_SLOT_LEVEL) {
      return err(
        spellError(
          'CAST_SPELL_SLOT_LEVEL_INVALID',
          `"slotSource.level" deve ser um inteiro entre ${MIN_SLOT_LEVEL} e ${MAX_SLOT_LEVEL}.`,
          { spellId, received: Number.isInteger(level) ? level : null },
        ),
      );
    }
  }
  const metamagicIds = request.metamagicIds ?? [];
  const targets = request.targets ?? [];
  if (!Array.isArray(metamagicIds) || !Array.isArray(targets)) {
    return err(
      spellError('CAST_SPELL_REQUEST_INVALID', '"metamagicIds" e "targets" devem ser arrays quando informados.', {
        spellId,
      }),
    );
  }
  const replaceConcentration = request.replaceConcentration ?? false;
  if (typeof replaceConcentration !== 'boolean') {
    return err(
      spellError('CAST_SPELL_REQUEST_INVALID', '"replaceConcentration" deve ser booleano quando informado.', { spellId }),
    );
  }
  return ok(
    Object.freeze({
      spellId,
      sourceInstanceId,
      slotSource: Object.freeze({ ...slotSource }),
      metamagicIds: Object.freeze([...metamagicIds]),
      targets: Object.freeze([...targets]),
      replaceConcentration,
    }),
  );
}

/**
 * Localiza a entrada da magia no personagem (conhecida/preparada/grimório)
 * pela proveniência informada. É o que impede conjurar uma magia que o
 * personagem não tem e o que mantém instâncias independentes de "Iniciado em
 * Magia" separadas: a mesma magia por outra fonte é outra entrada.
 *
 * A comparação normaliza qualquer fonte não-string da entrada para `null`
 * antes de comparar — mesma normalização de
 * `spellcasting-queries.js#projectSpellEntry` e de
 * `spell-selection.js` —, de modo que `null` (fonte base/classe, o que a
 * migração v1->v2 grava para toda magia sem `origem`) case com um request
 * `sourceInstanceId: null`, e NUNCA com uma fonte de talento.
 * @param {object} character
 * @param {string} spellId
 * @param {string|null} sourceInstanceId
 * @returns {{entry: object, collection: string} | null}
 */
function findSpellEntry(character, spellId, sourceInstanceId) {
  const state = readSpellState(character);
  for (const collection of SPELL_COLLECTIONS) {
    for (const entry of state[collection]) {
      const entrySource = typeof entry?.sourceInstanceId === 'string' ? entry.sourceInstanceId : null;
      if (spellIdOf(entry) === spellId && entrySource === sourceInstanceId) {
        return { entry, collection };
      }
    }
  }
  return null;
}

/**
 * Resolve o consumo de espaço, devolvendo o ramo parcial de `state.spells` a
 * aplicar e o path afetado. Nunca cria entrada nem passa do máximo.
 * @param {object} character
 * @param {object} slotSource
 * @param {object} spellEntity
 * @param {object} context
 * @returns {import('../../core/result.js').Result} Result<{patch, affected, slotLevel}, AppError>
 */
function consumeSlot(character, slotSource, spellEntity, context) {
  const state = readSpellState(character);
  const table = readSpellcastingTable(context);
  const spellLevel = Number.isInteger(spellEntity.level) ? spellEntity.level : null;

  if (slotSource.kind === 'at-will') {
    return ok({ patch: null, affected: null, slotLevel: null });
  }

  if (slotSource.kind === 'pact-slot') {
    // Pool SEPARADO. Nada aqui lê nem escreve `state.spells.slots`.
    const used = state.pactSlotsUsed;
    if (used === null) {
      return err(
        spellError(
          'CAST_SPELL_PACT_STATE_INVALID',
          '"state.spells.pactSlots.used" não é um inteiro; a conjuração por espaço de pacto foi recusada.',
          {},
        ),
      );
    }
    const maximum = table.pactSlots.maximum;
    if (maximum === null) {
      return err(
        spellError(
          'CAST_SPELL_PACT_MAXIMUM_UNKNOWN',
          'O total de espaços de Magia de Pacto é desconhecido: informe "context.spellcasting.pactSlots.maximum".',
          {},
        ),
      );
    }
    const pactLevel = table.pactSlots.level;
    if (spellLevel !== null && spellLevel > 0 && pactLevel !== null && spellLevel > pactLevel) {
      return err(
        spellError(
          'CAST_SPELL_SLOT_LEVEL_TOO_LOW',
          `A magia é de ${spellLevel}º círculo e o espaço de Magia de Pacto é de ${pactLevel}º.`,
          { spellLevel, pactLevel },
        ),
      );
    }
    if (used >= maximum) {
      return err(
        spellError('CAST_SPELL_PACT_SLOT_EXHAUSTED', 'Não há espaços de Magia de Pacto disponíveis.', { used, maximum }),
      );
    }
    return ok({
      patch: { pactSlots: Object.freeze({ ...character.state.spells.pactSlots, used: used + 1 }) },
      affected: AFFECTED_PACT_SLOTS,
      slotLevel: pactLevel,
    });
  }

  // kind === 'spell-slot'
  const level = slotSource.level;
  const key = String(level);
  if (spellLevel !== null && spellLevel > 0 && level < spellLevel) {
    return err(
      spellError(
        'CAST_SPELL_SLOT_LEVEL_TOO_LOW',
        `A magia é de ${spellLevel}º círculo e o espaço escolhido é de ${level}º.`,
        { spellLevel, level },
      ),
    );
  }
  if (!Object.hasOwn(state.slots, key)) {
    return err(
      spellError(
        'CAST_SPELL_SLOT_NOT_AVAILABLE',
        `O personagem não tem espaços de ${level}º círculo (nenhuma entrada em state.spells.slots).`,
        { level },
      ),
    );
  }
  const entry = state.slots[key];
  const used = Number.isInteger(entry?.used) ? entry.used : null;
  const extra = Number.isInteger(entry?.extra) ? entry.extra : null;
  if (used === null || extra === null) {
    return err(
      spellError(
        'CAST_SPELL_SLOT_STATE_INVALID',
        `A entrada de espaços de ${level}º círculo não tem "used"/"extra" inteiros; a conjuração foi recusada.`,
        { level },
      ),
    );
  }
  const base = Object.hasOwn(table.slotMaximums, key) ? table.slotMaximums[key] : null;
  if (base === null) {
    return err(
      spellError(
        'CAST_SPELL_SLOT_MAXIMUM_UNKNOWN',
        `O total de espaços de ${level}º círculo é desconhecido: informe "context.spellcasting.slotMaximums".`,
        { level },
      ),
    );
  }
  const maximum = base + extra;
  if (used >= maximum) {
    return err(
      spellError('CAST_SPELL_SLOT_EXHAUSTED', `Não há espaços de ${level}º círculo disponíveis.`, {
        level,
        used,
        maximum,
      }),
    );
  }
  return ok({
    patch: { slots: Object.freeze({ ...character.state.spells.slots, [key]: Object.freeze({ ...entry, used: used + 1 }) }) },
    affected: AFFECTED_SLOTS,
    slotLevel: level,
  });
}

/**
 * Comando: conjura uma magia.
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {{spellId: string, sourceInstanceId: string, slotSource: object,
 *   metamagicIds?: ReadonlyArray<string>, replaceConcentration?: boolean,
 *   targets?: ReadonlyArray<object>}} request
 * @param {object} [context] - `{registry (obrigatório), spellcasting?, metamagic?}`.
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function castSpell(character, request, context = {}) {
  const shape = requireSpellCharacterShape(character);
  if (!shape.ok) {
    return commandErr({ character, error: shape.error });
  }
  const normalized = normalizeRequest(request);
  if (!normalized.ok) {
    return commandErr({ character, error: normalized.error });
  }
  const { spellId, sourceInstanceId, slotSource, metamagicIds, targets, replaceConcentration } = normalized.value;

  const registryResult = requireRegistry(context, 'CAST_SPELL_REGISTRY_REQUIRED');
  if (!registryResult.ok) {
    return commandErr({ character, error: registryResult.error });
  }
  const spellEntity = registryResult.value.get(spellId);
  if (spellEntity === null || spellEntity === undefined || spellEntity.type !== 'spell') {
    return commandErr({
      character,
      error: spellError('CAST_SPELL_UNKNOWN_SPELL', `A magia "${spellId}" não existe no catálogo ativo.`, { spellId }),
    });
  }

  const found = findSpellEntry(character, spellId, sourceInstanceId);
  if (found === null) {
    return commandErr({
      character,
      error: spellError(
        'CAST_SPELL_NOT_AVAILABLE',
        `A magia "${spellId}" não está disponível para o personagem pela fonte ${sourceInstanceId === null ? 'base/classe' : `"${sourceInstanceId}"`}.`,
        { spellId, sourceInstanceId },
      ),
    });
  }

  // --- Metamagia (custo em Pontos de Feitiçaria) ------------------------
  const metamagicResult = validateMetamagicUse(character, { spellEntity, metamagicIds }, context);
  if (!metamagicResult.ok) {
    return commandErr({ character, error: metamagicResult.error });
  }
  const metamagic = metamagicResult.value;

  // --- Concentração: checada ANTES de qualquer mutação ------------------
  const requiresConcentration = spellEntity.concentration === true;
  if (requiresConcentration) {
    const conflict = checkConcentrationReplacement(character, spellId, replaceConcentration);
    if (conflict !== null) {
      return commandErr({ character, error: conflict });
    }
  }

  // --- Espaço de magia ---------------------------------------------------
  const slot = consumeSlot(character, slotSource, spellEntity, context);
  if (!slot.ok) {
    return commandErr({ character, error: slot.error });
  }

  // --- Construção do personagem novo (só a partir daqui) ----------------
  const affected = [];
  let nextCharacter = character;

  if (slot.value.patch !== null) {
    nextCharacter = Object.freeze({
      ...nextCharacter,
      state: Object.freeze({
        ...nextCharacter.state,
        spells: Object.freeze({ ...nextCharacter.state.spells, ...slot.value.patch }),
      }),
    });
    affected.push(slot.value.affected);
  }

  const nextResources = debitMetamagicPoints(nextCharacter, metamagic);
  if (nextResources !== null) {
    nextCharacter = Object.freeze({
      ...nextCharacter,
      state: Object.freeze({ ...nextCharacter.state, resources: nextResources }),
    });
    affected.push(AFFECTED_RESOURCES);
  }

  if (requiresConcentration) {
    const applied = withConcentration(nextCharacter, spellId);
    nextCharacter = applied.character;
    affected.push(...applied.affected);
  }

  return commandOk({
    character: nextCharacter,
    events: [
      {
        type: 'spell-cast',
        spellId,
        sourceInstanceId,
        collection: found.collection,
        slotSource,
        slotLevel: slot.value.slotLevel,
        metamagicIds: [...metamagic.optionIds],
        metamagicCost: metamagic.totalCost,
        concentration: requiresConcentration,
        ritual: spellEntity.ritual === true,
        targets: [...targets],
      },
    ],
    affected,
  });
}
