// Testes dos comandos de descanso (Task 17): `domain/commands/rest.js`.
// Cobre descanso curto (não restaura dados de vida) e longo (restaura PV,
// dados de vida, salvaguardas contra morte e espaços de magia extras), além
// da restauração de recursos declarados via conteúdo (`recovery`) — nunca
// por comparação de nome de talento/classe. Reflete
// `tests/fixtures/expected/command-transitions.json` (categoria "descansos").

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { shortRest, longRest } from '../../../site/js/domain/commands/rest.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key], seen);
  }
  return value;
}

function makeCharacter(stateOverrides = {}) {
  const base = createEmptyCharacter({ id: 'char-1', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
  const character = { ...base, state: { ...base.state, ...stateOverrides } };
  return deepFreeze(character);
}

/**
 * Registry fake que resolve UMA entidade de talento concedendo um efeito
 * `resource` com `recovery`/`max` declarados — prova que a restauração é
 * dirigida pelo conteúdo (não por nome). O pacote `dnd2024` real já declara
 * `recovery`/`max` deste jeito em 20+ pontos (classes/*.json,
 * species/catalog.json, e agora também o próprio talento "Dádiva do
 * Destino" em feats/catalog.json — fix round 1, achado I2); este fake só
 * evita acoplar o teste unitário ao conteúdo real.
 * @param {string} recovery
 * @param {number | string} [max]
 * @returns {object}
 */
function fakeRegistryWithResourceFeat(recovery, max = 1) {
  const feat = Object.freeze({
    id: 'dnd2024:feat:dadiva-do-destino',
    type: 'feat',
    effects: Object.freeze([
      Object.freeze({ id: 'uso-dadiva', type: 'resource', resource: 'dadiva-do-destino', max, recovery }),
    ]),
  });
  return Object.freeze({
    get(type, id) {
      return type === 'feat' && id === feat.id ? feat : null;
    },
    resolve(reference) {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return id === feat.id
        ? { ok: true, value: feat }
        : { ok: true, value: Object.freeze({ id: typeof id === 'string' ? id : 'stub', type: 'stub', effects: Object.freeze([]) }) };
    },
    list(type) {
      return type === 'feat' ? Object.freeze([feat]) : Object.freeze([]);
    },
  });
}

describe('domain/commands/rest — shortRest', () => {
  test('não restaura dados de vida usados nem PV/salvaguardas contra morte', () => {
    const character = makeCharacter({ hitDice: { used: 3 }, hitPoints: { current: 0, temporary: 0 } });
    const result = shortRest(character, {}, {});
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });

  test('restaura recurso estruturado declarado com recovery "short-rest" (via conteúdo, nunca por nome)', () => {
    const base = createEmptyCharacter({ id: 'char-2', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    const withFeat = deepFreeze({
      ...base,
      build: { ...base.build, featRefs: [{ id: 'dnd2024:feat:dadiva-do-destino', packageVersion: '1.0.0' }] },
      state: {
        ...base.state,
        resources: { 'dnd2024:resource:dadiva-do-destino': { current: 0, sourceInstanceId: 'src-1' } },
      },
    });
    const registry = fakeRegistryWithResourceFeat('short-rest');
    const result = shortRest(withFeat, {}, { registry });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources['dnd2024:resource:dadiva-do-destino'].current, 1);
    assert.deepEqual(result.affected, ['state.resources']);
  });

  test('recurso com recovery "long-rest" NÃO é restaurado por descanso curto', () => {
    const base = createEmptyCharacter({ id: 'char-3', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    const withFeat = deepFreeze({
      ...base,
      build: { ...base.build, featRefs: [{ id: 'dnd2024:feat:dadiva-do-destino', packageVersion: '1.0.0' }] },
      state: {
        ...base.state,
        resources: { 'dnd2024:resource:dadiva-do-destino': { current: 0, sourceInstanceId: 'src-1' } },
      },
    });
    const registry = fakeRegistryWithResourceFeat('long-rest');
    const result = shortRest(withFeat, {}, { registry });
    assert.equal(result.ok, true);
    assert.equal(result.character, withFeat);
  });

  test('recurso PARCIALMENTE gasto é restaurado até "max" declarado, não para um "1" fixo (fix round 1, achado I3)', () => {
    const base = createEmptyCharacter({ id: 'char-4', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    const withFeat = deepFreeze({
      ...base,
      build: { ...base.build, featRefs: [{ id: 'dnd2024:feat:dadiva-do-destino', packageVersion: '1.0.0' }] },
      state: {
        ...base.state,
        // 2 de 6 usos disponíveis — nem "current === 0" nem "max === 1".
        resources: { 'dnd2024:resource:dadiva-do-destino': { current: 2, sourceInstanceId: 'src-1' } },
      },
    });
    const registry = fakeRegistryWithResourceFeat('short-rest', 6);
    const result = shortRest(withFeat, {}, { registry });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.resources['dnd2024:resource:dadiva-do-destino'].current, 6);
  });

  test('recurso já no teto não é alterado (no-op de sucesso)', () => {
    const base = createEmptyCharacter({ id: 'char-5', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    const withFeat = deepFreeze({
      ...base,
      build: { ...base.build, featRefs: [{ id: 'dnd2024:feat:dadiva-do-destino', packageVersion: '1.0.0' }] },
      state: {
        ...base.state,
        resources: { 'dnd2024:resource:dadiva-do-destino': { current: 6, sourceInstanceId: 'src-1' } },
      },
    });
    const registry = fakeRegistryWithResourceFeat('short-rest', 6);
    const result = shortRest(withFeat, {}, { registry });
    assert.equal(result.ok, true);
    assert.equal(result.character, withFeat);
    assert.deepEqual(result.affected, []);
  });

  test('"max" não resolvível numericamente é erro explícito (nunca inventa um teto)', () => {
    const base = createEmptyCharacter({ id: 'char-6', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    const withFeat = deepFreeze({
      ...base,
      build: { ...base.build, featRefs: [{ id: 'dnd2024:feat:dadiva-do-destino', packageVersion: '1.0.0' }] },
      state: {
        ...base.state,
        resources: { 'dnd2024:resource:dadiva-do-destino': { current: 0, sourceInstanceId: 'src-1' } },
      },
    });
    // "variavel-desconhecida" não está em context.variables nem é um literal numérico.
    const registry = fakeRegistryWithResourceFeat('short-rest', 'variavel-desconhecida');
    const result = shortRest(withFeat, {}, { registry });
    assert.equal(result.ok, false);
    assert.equal(result.character, withFeat);
    assert.equal(result.error.code, 'COMMAND_REST_RESOURCE_MAX_UNRESOLVED');
  });

  test('estado de recurso corrompido ("current" não inteiro) é erro explícito, nunca "consertado" em silêncio', () => {
    const base = createEmptyCharacter({ id: 'char-7', now: '2026-07-30T00:00:00.000Z', rulesetRef: RULESET_REF });
    const withFeat = deepFreeze({
      ...base,
      build: { ...base.build, featRefs: [{ id: 'dnd2024:feat:dadiva-do-destino', packageVersion: '1.0.0' }] },
      state: {
        ...base.state,
        resources: { 'dnd2024:resource:dadiva-do-destino': { current: undefined, sourceInstanceId: 'src-1' } },
      },
    });
    const registry = fakeRegistryWithResourceFeat('short-rest', 1);
    const result = shortRest(withFeat, {}, { registry });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'COMMAND_REST_RESOURCE_STATE_INVALID');
  });
});

describe('domain/commands/rest — shortRest devolve os espaços de Magia de Pacto', () => {
  // O comentário do handler do Bruxo já dizia que o descanso curto "devolve os
  // espaços de pacto (domínio de magias)", mas `rest.short` dele não tinha
  // entrada nenhuma para isso e nenhum outro ponto do domínio tocava
  // `state.spells.pactSlots.used`. O baseline chama
  // `recuperarEspacosMagiaBruxo(false)` no descanso CURTO
  // (`tests/helpers/legacy-sheet-source.js:4430`).
  test('descanso curto zera pactSlots.used e declara o path afetado', () => {
    const character = makeCharacter({
      spells: { known: [], prepared: [], spellbook: [], slots: {}, pactSlots: { used: 2 }, concentration: null },
    });
    const result = shortRest(character, {}, {});
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.pactSlots.used, 0);
    assert.ok(result.affected.includes('state.spells.pactSlots'));
  });

  test('descanso curto NÃO restaura os espaços de magia comuns (isso é do longo)', () => {
    const character = makeCharacter({
      spells: { known: [], prepared: [], spellbook: [], slots: { 1: { used: 3, extra: 0 } }, pactSlots: { used: 0 }, concentration: null },
    });
    const result = shortRest(character, {}, {});
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });
});

describe('domain/commands/rest — longRest', () => {
  test('restaura PV ao máximo, zera dados de vida usados e salvaguardas contra morte', () => {
    const character = makeCharacter({
      hitPoints: { current: 10, temporary: 0 },
      hitDice: { used: 4 },
      deathSaves: { successes: 2, failures: 1 },
    });
    const result = longRest(character, {}, { maximumHitPoints: 38 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.hitPoints.current, 38);
    assert.equal(result.character.state.hitDice.used, 0);
    assert.deepEqual(result.character.state.deathSaves, { successes: 0, failures: 0 });
    assert.deepEqual(
      [...result.affected].sort(),
      ['hp.current', 'state.deathSaves', 'state.hitDice.used'],
    );
  });

  test('zera espaços de magia extras concedidos', () => {
    const character = makeCharacter({
      hitPoints: { current: 38, temporary: 0 },
      spells: {
        known: [],
        prepared: [],
        spellbook: [],
        slots: { 1: { used: 0, extra: 2 } },
        pactSlots: { used: 0 },
        concentration: null,
        freeKnownSlots: 0,
      },
    });
    const result = longRest(character, {}, { maximumHitPoints: 38 });
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.state.spells.slots, { 1: { used: 0, extra: 0 } });
    assert.ok(result.affected.includes('state.spells.slots'));
  });

  test('sem override e sem context.maximumHitPoints, devolve erro explícito', () => {
    const character = makeCharacter({ hitPoints: { current: 10, temporary: 0 } });
    const result = longRest(character, {}, {});
    assert.equal(result.ok, false);
    assert.equal(result.character, character);
    assert.equal(result.error.code, 'CHARACTER_QUERY_HP_MAXIMUM_UNKNOWN');
  });

  test('já em repouso completo (nada a restaurar) é no-op de sucesso', () => {
    const character = makeCharacter({
      hitPoints: { current: 38, temporary: 0 },
      hitDice: { used: 0 },
      deathSaves: { successes: 0, failures: 0 },
    });
    const result = longRest(character, {}, { maximumHitPoints: 38 });
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });
  // ------------------------------------------------------------------
  // Achado do CUTOVER (Task 33): a assimetria apply/revoke dos espaços.
  //
  // `cast-spell` INCREMENTA `state.spells.slots[c].used` e `pactSlots.used`, e
  // nada nunca os decrementava — todo conjurador gastaria os espaços uma vez e
  // nunca mais os recuperaria. O defeito ficou invisível porque o único caso
  // de descanso longo do oráculo tem `espacos_magia: {}` e porque, até a Task
  // 33, a ficha pública era o monólito (que zera `usados` em
  // `legacy-sheet-source.js:4628-4631`).
  // ------------------------------------------------------------------
  test('descanso longo RESTAURA os espaços de magia gastos (não só os extras)', () => {
    const character = makeCharacter({
      hitPoints: { current: 38, temporary: 0 },
      spells: { known: [], prepared: [], spellbook: [], slots: { 1: { used: 3, extra: 0 }, 2: { used: 1, extra: 2 } }, pactSlots: { used: 0 }, concentration: null },
    });
    const result = longRest(character, {}, { maximumHitPoints: 38 });
    assert.equal(result.ok, true);
    assert.deepEqual(result.character.state.spells.slots, { 1: { used: 0, extra: 0 }, 2: { used: 0, extra: 0 } });
    assert.ok(result.affected.includes('state.spells.slots'));
  });

  test('descanso longo restaura também os espaços de Magia de Pacto', () => {
    const character = makeCharacter({
      hitPoints: { current: 38, temporary: 0 },
      spells: { known: [], prepared: [], spellbook: [], slots: {}, pactSlots: { used: 2 }, concentration: null },
    });
    const result = longRest(character, {}, { maximumHitPoints: 38 });
    assert.equal(result.ok, true);
    assert.equal(result.character.state.spells.pactSlots.used, 0);
    assert.ok(result.affected.includes('state.spells.pactSlots'));
  });

  test('nenhum espaço gasto: continua no-op — sem `affected` espúrio', () => {
    const character = makeCharacter({
      hitPoints: { current: 38, temporary: 0 },
      hitDice: { used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      spells: { known: [], prepared: [], spellbook: [], slots: { 1: { used: 0, extra: 0 } }, pactSlots: { used: 0 }, concentration: null },
    });
    const result = longRest(character, {}, { maximumHitPoints: 38 });
    assert.equal(result.ok, true);
    assert.equal(result.character, character);
    assert.deepEqual(result.affected, []);
  });
});
