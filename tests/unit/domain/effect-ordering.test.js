// Testes de ordenação/precedência e resolução determinística do motor de
// efeitos (Task 15): os quatro grupos de precedência, `priority` crescente
// com desempate por ID estável, a ordem fixa da resolução numérica
// (set -> add -> multiply -> min/max), as três operações de conjunto
// (`add-ids`/`remove-ids`/`replace-ids`) e a filtragem por `stackKey`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PRECEDENCE_GROUPS,
  createResolvedEffect,
  createSetContribution,
  collectCharacterEffects,
  sortResolvedEffects,
  filterByStackKey,
} from '../../../site/js/domain/effects/collect-effects.js';
import { SET_TARGETS, resolveNumericTarget, resolveSetTarget } from '../../../site/js/domain/effects/resolve-effects.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

/**
 * Monta um ResolvedEffect de modifier para os testes de resolução numérica.
 * @param {{group?: string, target?: string, operation: string, value: *, priority?: number, id: string}} params
 */
function mod({ group = 'progression', target = 'ac', operation, value, priority, id }) {
  const effect = { type: 'modifier', target, operation, value };
  if (priority !== undefined) {
    effect.priority = priority;
  }
  return createResolvedEffect({
    effect,
    group,
    sourceId: 'dnd2024:class:barbaro',
    sourceInstanceId: 'source:class:0000:dnd2024-class-barbaro',
    effectInstanceId: id,
    orderIndex: 0,
  });
}

/**
 * Monta uma contribuição de conjunto para os testes de resolveSetTarget.
 * @param {object} params
 */
function set({ group = 'progression', setTarget = 'proficiency', setOperation, ids, priority = 0, id, stackKey, stackable }) {
  return createSetContribution({
    group,
    setTarget,
    setOperation,
    ids,
    priority,
    stackKey,
    stackable,
    sourceInstanceId: `source:test:0000:${id}`,
    effectInstanceId: id,
    orderIndex: 0,
  });
}

/** Registry falso: mapa id -> entidade, com a mesma superfície usada pelo coletor. */
function fakeRegistry(entities) {
  const byId = new Map(entities.map((entity) => [entity.id, Object.freeze(entity)]));
  return Object.freeze({
    get: (id) => byId.get(id) ?? null,
    list: (type) => Object.freeze([...byId.values()].filter((entity) => type === undefined || entity.type === type)),
    resolve: (reference) => {
      const id = typeof reference === 'string' ? reference : reference?.id;
      const entity = byId.get(id) ?? null;
      return entity === null
        ? { ok: false, error: { code: 'CONTENT_REFERENCE_NOT_FOUND', context: { id } } }
        : { ok: true, value: entity };
    },
  });
}

describe('grupos de precedência', () => {
  test('são exatamente quatro, na ordem base -> progressão -> equipamento -> manual', () => {
    assert.deepStrictEqual([...PRECEDENCE_GROUPS], ['base', 'progression', 'equipment', 'manual']);
    assert.ok(Object.isFrozen(PRECEDENCE_GROUPS));
  });

  test('um `set` de grupo posterior vence o `set` de um grupo anterior, mesmo com priority menor', () => {
    const result = resolveNumericTarget({
      target: 'ac',
      baseValue: 10,
      effects: [
        mod({ group: 'manual', operation: 'set', value: 17, priority: 0, id: 'e-manual' }),
        mod({ group: 'base', operation: 'set', value: 11, priority: 99, id: 'a-base' }),
        mod({ group: 'progression', operation: 'set', value: 13, priority: 99, id: 'b-prog' }),
        mod({ group: 'equipment', operation: 'set', value: 15, priority: 99, id: 'c-equip' }),
      ],
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.value, 17);
  });

  test('grupo desconhecido é defeito de programação (lança)', () => {
    assert.throws(() => mod({ group: 'homebrew', operation: 'add', value: 1, id: 'x' }), /group/);
  });
});

describe('resolveNumericTarget: ordem determinística', () => {
  test('priority crescente dentro do grupo: a maior priority é aplicada por último', () => {
    const result = resolveNumericTarget({
      target: 'ac',
      baseValue: 10,
      effects: [
        mod({ operation: 'set', value: 12, priority: 2, id: 'z' }),
        mod({ operation: 'set', value: 14, priority: 5, id: 'a' }),
        mod({ operation: 'set', value: 13, priority: 3, id: 'm' }),
      ],
    });
    assert.strictEqual(result.value, 14);
  });

  test('desempate por ID estável quando grupo e priority são iguais e o valor é o mesmo', () => {
    const effects = [
      mod({ operation: 'multiply', value: 2, priority: 0, id: 'b' }),
      mod({ operation: 'multiply', value: 3, priority: 0, id: 'a' }),
    ];
    const forward = resolveNumericTarget({ target: 'ac', baseValue: 10, effects });
    const reversed = resolveNumericTarget({ target: 'ac', baseValue: 10, effects: [...effects].reverse() });
    // A ordem do array de entrada não pode mudar o resultado.
    assert.strictEqual(forward.value, reversed.value);
    assert.strictEqual(forward.value, 60);
  });

  test('dois `set` conflitantes no mesmo grupo e mesma priority são erro', () => {
    const result = resolveNumericTarget({
      target: 'ac',
      baseValue: 10,
      effects: [
        mod({ operation: 'set', value: 12, priority: 1, id: 'a' }),
        mod({ operation: 'set', value: 13, priority: 1, id: 'b' }),
      ],
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_SET_CONFLICT');
  });

  test('dois `set` idênticos na mesma priority não são conflito', () => {
    const result = resolveNumericTarget({
      target: 'senses.blindsight',
      baseValue: 0,
      effects: [
        mod({ target: 'senses.blindsight', operation: 'set', value: 3, priority: 0, id: 'a' }),
        mod({ target: 'senses.blindsight', operation: 'set', value: 3, priority: 0, id: 'b' }),
      ],
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.value, 3);
  });

  test('todos os `add` precedem todos os `multiply`, mesmo com prioridades intercaladas', () => {
    const result = resolveNumericTarget({
      target: 'hp.maximum',
      baseValue: 10,
      effects: [
        mod({ target: 'hp.maximum', operation: 'multiply', value: 2, priority: 1, id: 'm1' }),
        mod({ target: 'hp.maximum', operation: 'add', value: 5, priority: 2, id: 'a1' }),
        mod({ target: 'hp.maximum', operation: 'multiply', value: 3, priority: 3, id: 'm2' }),
        mod({ target: 'hp.maximum', operation: 'add', value: 5, priority: 4, id: 'a2' }),
      ],
    });
    // (10 + 5 + 5) * 2 * 3 = 120 — nunca ((10*2)+5)*3+5.
    assert.strictEqual(result.value, 120);
  });

  test('o `set` vencedor substitui o baseValue antes dos add/multiply', () => {
    const result = resolveNumericTarget({
      target: 'ac',
      baseValue: 10,
      effects: [
        mod({ operation: 'add', value: 2, id: 'add' }),
        mod({ operation: 'set', value: 20, id: 'set' }),
      ],
    });
    assert.strictEqual(result.value, 22);
  });

  test('limites: vence o maior `min` e o menor `max`', () => {
    const result = resolveNumericTarget({
      target: 'speed.walk',
      baseValue: 30,
      effects: [
        mod({ target: 'speed.walk', operation: 'min', value: 5, id: 'min-a' }),
        mod({ target: 'speed.walk', operation: 'min', value: 12, id: 'min-b' }),
        mod({ target: 'speed.walk', operation: 'max', value: 40, id: 'max-a' }),
        mod({ target: 'speed.walk', operation: 'max', value: 25, id: 'max-b' }),
      ],
    });
    // Limite inferior 12 (o maior), limite superior 25 (o menor) -> 30 vira 25.
    assert.strictEqual(result.value, 25);
  });

  test('o limite inferior é aplicado mesmo quando o valor cai abaixo dele', () => {
    const result = resolveNumericTarget({
      target: 'speed.walk',
      baseValue: 30,
      effects: [
        mod({ target: 'speed.walk', operation: 'add', value: -28, id: 'a' }),
        mod({ target: 'speed.walk', operation: 'min', value: 5, id: 'min' }),
      ],
    });
    assert.strictEqual(result.value, 5);
  });

  test('min > max é erro, não escolha implícita', () => {
    const result = resolveNumericTarget({
      target: 'ac',
      baseValue: 10,
      effects: [
        mod({ operation: 'min', value: 20, id: 'min' }),
        mod({ operation: 'max', value: 15, id: 'max' }),
      ],
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_BOUNDS_CONFLICT');
  });

  test('`stackKey` com `stackable:false` deduplica: só a contribuição de maior precedência vale', () => {
    const ladder = (value, priority, id) =>
      createResolvedEffect({
        effect: {
          type: 'modifier',
          target: 'resource.furias.max',
          operation: 'add',
          value,
          priority,
          stackKey: 'furias',
          stackable: false,
        },
        group: 'progression',
        sourceId: 'dnd2024:class:barbaro',
        sourceInstanceId: 'source:class:0000:dnd2024-class-barbaro',
        effectInstanceId: id,
        orderIndex: 0,
      });
    const result = resolveNumericTarget({
      target: 'resource.furias.max',
      baseValue: 0,
      effects: [ladder(2, 1, 'a'), ladder(3, 3, 'b'), ladder(4, 6, 'c')],
    });
    // Sem stackKey somaria 9; com stackKey/stackable:false vale só o 4.
    assert.strictEqual(result.value, 4);
  });

  test('sem `stackKey`, contribuições da mesma fonte sempre acumulam', () => {
    const result = resolveNumericTarget({
      target: 'ac',
      baseValue: 10,
      effects: [
        mod({ operation: 'add', value: 1, id: 'a' }),
        mod({ operation: 'add', value: 1, id: 'b' }),
      ],
    });
    assert.strictEqual(result.value, 12);
  });

  test('`stackKey` com `stackable` ausente (true) continua acumulando', () => {
    const withKey = (id) =>
      createResolvedEffect({
        effect: { type: 'modifier', target: 'ac', operation: 'add', value: 1, stackKey: 'bonus-ca' },
        group: 'progression',
        sourceId: null,
        sourceInstanceId: 'source:test:0000:x',
        effectInstanceId: id,
        orderIndex: 0,
      });
    const result = resolveNumericTarget({ target: 'ac', baseValue: 10, effects: [withKey('a'), withKey('b')] });
    assert.strictEqual(result.value, 12);
  });

  test('efeitos de outro target são ignorados', () => {
    const result = resolveNumericTarget({
      target: 'ac',
      baseValue: 10,
      effects: [mod({ target: 'speed.walk', operation: 'add', value: 100, id: 'a' })],
    });
    assert.strictEqual(result.value, 10);
  });

  test('target fora da whitelist é erro', () => {
    const result = resolveNumericTarget({ target: 'state.hitPoints.maximum', baseValue: 1, effects: [] });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_TARGET_NOT_ALLOWED');
  });

  test('baseValue ausente sem nenhum `set` é erro (nunca 0 implícito)', () => {
    const result = resolveNumericTarget({ target: 'ac', effects: [mod({ operation: 'add', value: 2, id: 'a' })] });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_BASE_VALUE_MISSING');
  });

  test('baseValue ausente com um `set` é resolvido pelo `set`', () => {
    const result = resolveNumericTarget({ target: 'ac', effects: [mod({ operation: 'set', value: 13, id: 'a' })] });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.value, 13);
  });

  test('valor por nome de variável é resolvido pelo contexto, e nome desconhecido é erro', () => {
    const effects = [mod({ target: 'initiative', operation: 'add', value: 'proficiency-bonus', id: 'a' })];
    const okResult = resolveNumericTarget({
      target: 'initiative',
      baseValue: 2,
      effects,
      context: { variables: { 'proficiency-bonus': 3 } },
    });
    assert.strictEqual(okResult.value, 5);

    const missing = resolveNumericTarget({ target: 'initiative', baseValue: 2, effects, context: {} });
    assert.strictEqual(missing.ok, false);
    assert.strictEqual(missing.error.code, 'EFFECT_VALUE_NOT_NUMERIC');
  });

  test('variável só é lida como propriedade própria do mapa de contexto', () => {
    const result = resolveNumericTarget({
      target: 'ac',
      baseValue: 10,
      effects: [mod({ operation: 'add', value: 'toString', id: 'a' })],
      context: { variables: {} },
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_VALUE_NOT_NUMERIC');
  });

  test('valor com unidade ou dado não é numérico e é erro explícito', () => {
    for (const value of ['1d6', '+3 m', '+4,5 m']) {
      const result = resolveNumericTarget({
        target: 'damage.sneak-attack',
        baseValue: 0,
        effects: [mod({ target: 'damage.sneak-attack', operation: 'set', value, id: 'a' })],
      });
      assert.strictEqual(result.ok, false, value);
      assert.strictEqual(result.error.code, 'EFFECT_VALUE_NOT_NUMERIC');
    }
  });

  test('não muta o array de efeitos recebido', () => {
    const effects = [mod({ operation: 'add', value: 1, id: 'b' }), mod({ operation: 'add', value: 2, id: 'a' })];
    const order = effects.map((entry) => entry.effectInstanceId);
    resolveNumericTarget({ target: 'ac', baseValue: 10, effects });
    assert.deepStrictEqual(effects.map((entry) => entry.effectInstanceId), order);
  });
});

describe('resolveSetTarget: add-ids / remove-ids / replace-ids', () => {
  test('o vocabulário de alvos de conjunto é fechado e congelado', () => {
    assert.ok(Object.isFrozen(SET_TARGETS));
    const result = resolveSetTarget({ target: 'homebrew.stuff', baseIds: [], effects: [] });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_SET_TARGET_UNKNOWN');
  });

  test('add-ids acumula sobre o conjunto base', () => {
    const result = resolveSetTarget({
      target: 'proficiency',
      baseIds: ['dnd2024:skill:atletismo'],
      effects: [set({ setOperation: 'add-ids', ids: ['dnd2024:skill:furtividade'], id: 'a' })],
    });
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual([...result.value].sort(), ['dnd2024:skill:atletismo', 'dnd2024:skill:furtividade']);
    assert.ok(result.value instanceof Set);
  });

  test('add-ids do mesmo ID por duas fontes não duplica (conjunto)', () => {
    const result = resolveSetTarget({
      target: 'language',
      baseIds: [],
      effects: [
        set({ setTarget: 'language', setOperation: 'add-ids', ids: ['dnd2024:language:comum'], id: 'a' }),
        set({ setTarget: 'language', setOperation: 'add-ids', ids: ['dnd2024:language:comum'], id: 'b' }),
      ],
    });
    assert.deepStrictEqual([...result.value], ['dnd2024:language:comum']);
  });

  test('remove-ids em priority maior subtrai o que uma priority menor acrescentou', () => {
    const result = resolveSetTarget({
      target: 'proficiency',
      baseIds: [],
      effects: [
        set({ setOperation: 'add-ids', ids: ['dnd2024:skill:atletismo'], priority: 1, id: 'add' }),
        set({ setOperation: 'remove-ids', ids: ['dnd2024:skill:atletismo'], priority: 2, id: 'remove' }),
      ],
    });
    assert.deepStrictEqual([...result.value], []);
  });

  test('o grupo de override manual remove um ID concedido pela classe', () => {
    const result = resolveSetTarget({
      target: 'proficiency',
      baseIds: [],
      effects: [
        set({ group: 'progression', setOperation: 'add-ids', ids: ['dnd2024:skill:atletismo', 'dnd2024:skill:natureza'], id: 'classe' }),
        set({ group: 'manual', setOperation: 'remove-ids', ids: ['dnd2024:skill:atletismo'], id: 'manual' }),
      ],
    });
    assert.deepStrictEqual([...result.value], ['dnd2024:skill:natureza']);
  });

  test('replace-ids substitui o conjunto inteiro na priority em que ocorre', () => {
    const result = resolveSetTarget({
      target: 'proficiency',
      baseIds: ['dnd2024:skill:atletismo'],
      effects: [
        set({ setOperation: 'add-ids', ids: ['dnd2024:skill:natureza'], priority: 1, id: 'add' }),
        set({ setOperation: 'replace-ids', ids: ['dnd2024:skill:medicina'], priority: 2, id: 'replace' }),
        set({ setOperation: 'add-ids', ids: ['dnd2024:skill:religiao'], priority: 3, id: 'depois' }),
      ],
    });
    assert.deepStrictEqual([...result.value].sort(), ['dnd2024:skill:medicina', 'dnd2024:skill:religiao']);
  });

  test('remove-ids e add-ids do mesmo ID na mesma priority e grupo é erro (ambíguo)', () => {
    const result = resolveSetTarget({
      target: 'proficiency',
      baseIds: [],
      effects: [
        set({ setOperation: 'add-ids', ids: ['dnd2024:skill:atletismo'], priority: 1, id: 'a-add' }),
        set({ setOperation: 'remove-ids', ids: ['dnd2024:skill:atletismo'], priority: 1, id: 'b-remove' }),
      ],
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_SET_AMBIGUOUS');
  });

  test('remove-ids e add-ids de IDs diferentes na mesma priority não é ambíguo', () => {
    const result = resolveSetTarget({
      target: 'proficiency',
      baseIds: ['dnd2024:skill:medicina'],
      effects: [
        set({ setOperation: 'add-ids', ids: ['dnd2024:skill:atletismo'], priority: 1, id: 'a-add' }),
        set({ setOperation: 'remove-ids', ids: ['dnd2024:skill:medicina'], priority: 1, id: 'b-remove' }),
      ],
    });
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual([...result.value], ['dnd2024:skill:atletismo']);
  });

  test('`stackKey` com `stackable:false` mantém só a contribuição de maior precedência', () => {
    const result = resolveSetTarget({
      target: 'language',
      baseIds: [],
      effects: [
        set({
          setTarget: 'language',
          setOperation: 'add-ids',
          ids: ['dnd2024:language:anao'],
          priority: 1,
          stackKey: 'idioma-extra',
          stackable: false,
          id: 'a',
        }),
        set({
          setTarget: 'language',
          setOperation: 'add-ids',
          ids: ['dnd2024:language:elfico'],
          priority: 2,
          stackKey: 'idioma-extra',
          stackable: false,
          id: 'b',
        }),
      ],
    });
    assert.deepStrictEqual([...result.value], ['dnd2024:language:elfico']);
  });

  test('sem `stackKey` as duas contribuições acumulam', () => {
    const result = resolveSetTarget({
      target: 'language',
      baseIds: [],
      effects: [
        set({ setTarget: 'language', setOperation: 'add-ids', ids: ['dnd2024:language:anao'], id: 'a' }),
        set({ setTarget: 'language', setOperation: 'add-ids', ids: ['dnd2024:language:elfico'], id: 'b' }),
      ],
    });
    assert.deepStrictEqual([...result.value].sort(), ['dnd2024:language:anao', 'dnd2024:language:elfico']);
  });

  test('efeitos de concessão derivam o alvo de conjunto do próprio tipo', () => {
    const grant = createResolvedEffect({
      effect: { type: 'defense', damageType: 'dnd2024:damage-type:veneno', mode: 'resistance' },
      group: 'progression',
      sourceId: 'dnd2024:species:anao',
      sourceInstanceId: 'source:species:0000:dnd2024-species-anao',
      effectInstanceId: 'effect:defense:0',
      orderIndex: 0,
    });
    assert.strictEqual(grant.setTarget, 'defense.resistance');
    const result = resolveSetTarget({ target: 'defense.resistance', baseIds: [], effects: [grant] });
    assert.deepStrictEqual([...result.value], ['dnd2024:damage-type:veneno']);
  });

  test('baseIds ausente equivale a conjunto vazio, sem inventar IDs', () => {
    const result = resolveSetTarget({ target: 'condition', effects: [] });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.value.size, 0);
  });

  test('não muta o conjunto base recebido', () => {
    const baseIds = ['dnd2024:skill:atletismo'];
    resolveSetTarget({
      target: 'proficiency',
      baseIds,
      effects: [set({ setOperation: 'add-ids', ids: ['dnd2024:skill:natureza'], id: 'a' })],
    });
    assert.deepStrictEqual(baseIds, ['dnd2024:skill:atletismo']);
  });
});

describe('collectCharacterEffects', () => {
  const ruleset = { id: 'dnd2024:ruleset:core', type: 'ruleset', effects: [{ id: 'ca-base', type: 'modifier', target: 'ac', operation: 'set', value: 10 }] };
  const classe = {
    id: 'dnd2024:class:barbaro',
    type: 'class',
    effects: [
      { id: 'atletismo', type: 'proficiency', target: 'dnd2024:skill:atletismo' },
      { id: 'furias-1', type: 'resource', resource: 'furias', max: 2, priority: 1, stackKey: 'furias', stackable: false, when: { kind: 'level', min: 1, max: 2 } },
      { id: 'furias-3', type: 'resource', resource: 'furias', max: 3, priority: 3, stackKey: 'furias', stackable: false, when: { kind: 'level', min: 3, max: 5 } },
    ],
  };
  const feature = {
    id: 'dnd2024:feature:barbaro-movimento-rapido',
    type: 'feature',
    grantedBy: 'dnd2024:class:barbaro',
    level: 5,
    effects: [{ id: 'movimento', type: 'modifier', target: 'speed.walk', operation: 'add', value: 3 }],
  };
  const armadura = {
    id: 'dnd2024:armor:cota-de-malha',
    type: 'armor',
    effects: [{ id: 'ca-armadura', type: 'modifier', target: 'ac', operation: 'set', value: 16 }],
  };

  /** Personagem de teste com classe, feature e armadura equipada. */
  function makeCharacter({ level = 3, equipped = true, overrides = {} } = {}) {
    const base = createEmptyCharacter({ id: 'char-1', now: '2026-07-31T00:00:00.000Z', rulesetRef: RULESET_REF });
    return {
      ...base,
      build: { ...base.build, classRef: { id: classe.id, packageVersion: '1.0.0' } },
      state: {
        ...base.state,
        level,
        inventory: [
          {
            instanceId: 'legacy:inventario:0000:cota-de-malha',
            itemRef: { id: armadura.id, packageVersion: '1.0.0' },
            customDefinition: null,
            quantity: 1,
            equipped,
            expended: 0,
            sourceInstanceId: null,
          },
        ],
      },
      overrides,
    };
  }

  test('classifica cada efeito no grupo de precedência correto', () => {
    const registry = fakeRegistry([ruleset, classe, feature, armadura]);
    const result = collectCharacterEffects(makeCharacter(), { registry });
    assert.strictEqual(result.ok, true, JSON.stringify(result.error ?? null));

    const byId = new Map(result.value.map((entry) => [entry.effect.id, entry]));
    assert.strictEqual(byId.get('ca-base').group, 'base');
    assert.strictEqual(byId.get('atletismo').group, 'progression');
    assert.strictEqual(byId.get('ca-armadura').group, 'equipment');
  });

  test('respeita o gating de `when` por nível e não devolve o efeito inativo', () => {
    const registry = fakeRegistry([ruleset, classe, feature, armadura]);
    const nivel3 = collectCharacterEffects(makeCharacter({ level: 3 }), { registry });
    const ids3 = nivel3.value.map((entry) => entry.effect.id);
    assert.ok(ids3.includes('furias-3'));
    assert.ok(!ids3.includes('furias-1'));
    // Feature de nível 5 não entra num personagem de nível 3.
    assert.ok(!ids3.includes('movimento'));

    const nivel5 = collectCharacterEffects(makeCharacter({ level: 5 }), { registry });
    assert.ok(nivel5.value.map((entry) => entry.effect.id).includes('movimento'));
  });

  test('item não equipado não contribui com efeitos', () => {
    const registry = fakeRegistry([ruleset, classe, feature, armadura]);
    const result = collectCharacterEffects(makeCharacter({ equipped: false }), { registry });
    assert.ok(!result.value.map((entry) => entry.effect.id).includes('ca-armadura'));
  });

  test('`overrides` do personagem entram como `set` no grupo manual, com o mesmo vocabulário de path', () => {
    const registry = fakeRegistry([ruleset, classe, feature, armadura]);
    const result = collectCharacterEffects(
      makeCharacter({
        overrides: { 'hp.maximum': { value: 42, original: 30, editedAt: '2026-07-31T00:00:00.000Z', source: 'manual' } },
      }),
      { registry },
    );
    const manual = result.value.filter((entry) => entry.group === 'manual');
    assert.strictEqual(manual.length, 1);
    assert.strictEqual(manual[0].effect.target, 'hp.maximum');
    assert.strictEqual(manual[0].effect.operation, 'set');
    assert.strictEqual(manual[0].effect.value, 42);
  });

  test('override com path fora da whitelist é erro (não silenciosamente ignorado)', () => {
    const registry = fakeRegistry([ruleset, classe, feature, armadura]);
    const result = collectCharacterEffects(
      makeCharacter({
        overrides: { 'state.hitPoints.maximum': { value: 42, original: 30, editedAt: '2026-07-31T00:00:00.000Z', source: 'manual' } },
      }),
      { registry },
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_TARGET_NOT_ALLOWED');
  });

  test('os IDs de proveniência são determinísticos entre chamadas', () => {
    const registry = fakeRegistry([ruleset, classe, feature, armadura]);
    const first = collectCharacterEffects(makeCharacter(), { registry });
    const second = collectCharacterEffects(makeCharacter(), { registry });
    assert.deepStrictEqual(
      first.value.map((entry) => [entry.sourceInstanceId, entry.effectInstanceId]),
      second.value.map((entry) => [entry.sourceInstanceId, entry.effectInstanceId]),
    );
    for (const entry of first.value) {
      assert.match(entry.sourceInstanceId, /^source:[a-z-]+:\d{4}:[a-z0-9-]+$/);
      assert.match(entry.effectInstanceId, /^effect:source:[a-z-]+:\d{4}:[a-z0-9-]+:\d{4}:[a-z0-9-]+$/);
    }
  });

  test('o resultado e cada envelope são congelados', () => {
    const registry = fakeRegistry([ruleset, classe, feature, armadura]);
    const result = collectCharacterEffects(makeCharacter(), { registry });
    assert.ok(Object.isFrozen(result.value));
    for (const entry of result.value) {
      assert.ok(Object.isFrozen(entry));
    }
  });

  test('efeito com tipo desconhecido no conteúdo é erro', () => {
    const quebrado = { id: 'dnd2024:class:mago', type: 'class', effects: [{ type: 'grant-superpower' }] };
    const registry = fakeRegistry([ruleset, quebrado, armadura]);
    const base = createEmptyCharacter({ id: 'char-2', now: '2026-07-31T00:00:00.000Z', rulesetRef: RULESET_REF });
    const character = {
      ...base,
      build: { ...base.build, classRef: { id: quebrado.id, packageVersion: '1.0.0' } },
      state: { ...base.state, level: 1 },
    };
    const result = collectCharacterEffects(character, { registry });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_INVALID');
  });

  test('referência de conteúdo inexistente é erro', () => {
    const registry = fakeRegistry([ruleset]);
    const base = createEmptyCharacter({ id: 'char-3', now: '2026-07-31T00:00:00.000Z', rulesetRef: RULESET_REF });
    const character = {
      ...base,
      build: { ...base.build, classRef: { id: 'dnd2024:class:inexistente', packageVersion: '1.0.0' } },
    };
    const result = collectCharacterEffects(character, { registry });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_SOURCE_UNRESOLVED');
  });

  test('registry sem a superfície esperada é defeito de programação (lança)', () => {
    assert.throws(() => collectCharacterEffects(makeCharacter(), { registry: {} }), /registry/);
  });
});

describe('resolveNumericTarget: conflito de `set` fora do grupo vencedor', () => {
  test('dois `set` contraditórios numa priority sobrescrita por outro grupo AINDA são erro', () => {
    const result = resolveNumericTarget({
      target: 'ac',
      baseValue: 10,
      effects: [
        mod({ group: 'progression', operation: 'set', value: 12, priority: 1, id: 'a' }),
        mod({ group: 'progression', operation: 'set', value: 13, priority: 1, id: 'b' }),
        // Um override manual sobrescreveria os dois — o defeito do conteúdo não
        // pode ficar escondido por causa disso.
        mod({ group: 'manual', operation: 'set', value: 20, priority: 0, id: 'z' }),
      ],
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_SET_CONFLICT');
  });
});

// --- filterByStackKey contra CONTEÚDO REAL do pacote ----------------------
//
// A filtragem por `stackKey` não pode ser exercitada apenas com objetos
// fabricados à mão: se nenhum efeito real carregasse `stackKey`, o caminho
// seria código morto. Estes testes leem os ladders de `modifier` de
// `dados/pacotes/dnd2024/classes/*.json` (marcados por
// scripts/content/migrate-classes.mjs) e verificam que a filtragem escolhe
// exatamente uma contribuição por `stackKey`.

/**
 * Carrega os efeitos de uma entidade de classe do pacote real, pelo slug.
 * @param {string} arquivo - nome do arquivo em dados/pacotes/dnd2024/classes
 * @param {string} entityId - ContentId da entidade dentro da coleção
 * @returns {object[]}
 */
function efeitosDoPacote(arquivo, entityId) {
  const caminho = new URL(`../../../dados/pacotes/dnd2024/classes/${arquivo}`, import.meta.url);
  const colecao = JSON.parse(readFileSync(caminho, 'utf8'));
  const entidade = (colecao.items ?? []).find((item) => item.id === entityId);
  assert.ok(entidade, `entidade ${entityId} ausente em ${arquivo}`);
  return entidade.effects ?? [];
}

/**
 * Converte efeitos crus do pacote em ResolvedEffects do grupo de progressão,
 * preservando a ordem de declaração como `orderIndex`.
 * @param {object[]} efeitos
 * @returns {object[]}
 */
function comoResolvidos(efeitos) {
  return efeitos.map((effect, index) =>
    createResolvedEffect({
      effect,
      group: 'progression',
      sourceId: 'dnd2024:class:barbaro',
      sourceInstanceId: 'source:class:0000:dnd2024-class-barbaro',
      effectInstanceId: `effect:source:class:0000:dnd2024-class-barbaro:${String(index).padStart(4, '0')}:${effect.id}`,
      orderIndex: index,
    }),
  );
}

describe('filterByStackKey: ladder real de damage.rage-bonus (barbaro.json)', () => {
  const ladder = efeitosDoPacote('barbaro.json', 'dnd2024:class:barbaro').filter(
    (effect) => effect.type === 'modifier' && effect.target === 'damage.rage-bonus',
  );

  test('o pacote real declara stackKey/stackable:false no ladder (o filtro não é código morto)', () => {
    assert.ok(ladder.length > 1, 'damage.rage-bonus deveria ser um ladder de mais de uma faixa');
    for (const effect of ladder) {
      assert.strictEqual(effect.stackKey, 'dano-da-furia');
      assert.strictEqual(effect.stackable, false);
      assert.strictEqual(effect.priority, effect.when.min);
    }
  });

  test('com as três faixas presentes, só a de maior priority sobrevive à filtragem', () => {
    const filtrados = filterByStackKey(sortResolvedEffects(comoResolvidos(ladder)));
    assert.strictEqual(filtrados.length, 1, 'um ladder não acumulável deve colapsar em uma contribuição');
    const vencedor = filtrados[0];
    const maiorPriority = Math.max(...ladder.map((effect) => effect.priority));
    assert.strictEqual(vencedor.priority, maiorPriority);
    assert.strictEqual(vencedor.effect.value, ladder.find((e) => e.priority === maiorPriority).value);
  });

  test('sem a marcação, os mesmos efeitos reais acumulariam — a marcação é o que garante o colapso', () => {
    // Controle negativo: remove `stackKey`/`stackable` dos MESMOS efeitos reais.
    const semMarcacao = ladder.map(({ stackKey, stackable, ...resto }) => {
      void stackKey;
      void stackable;
      return resto;
    });
    const filtrados = filterByStackKey(sortResolvedEffects(comoResolvidos(semMarcacao)));
    assert.strictEqual(filtrados.length, ladder.length);
  });
});
