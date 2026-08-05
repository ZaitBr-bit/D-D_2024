// Testes dos predicados fechados do motor de efeitos (Task 15):
// `validateEffectSemantics` (vocabulário fechado de tipos, operações, paths
// permitidos, valores serializáveis, bloqueio de segmentos de
// prototype-pollution) e `evaluateEffectCondition` (as sete condições
// fechadas, contexto ausente e profundidade máxima).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  EFFECT_TYPES,
  MODIFIER_OPERATIONS,
  EFFECT_TARGET_NAMESPACES,
  RESERVED_PATH_SEGMENTS,
  CONDITION_KINDS,
  STATE_FLAGS,
  MAX_CONDITION_DEPTH,
  isAllowedTargetPath,
  validateEffectSemantics,
  evaluateEffectCondition,
} from '../../../site/js/domain/effects/effect-predicates.js';

const SCHEMA_PATH = fileURLToPath(new URL('../../../dados/schemas/v1/effect.schema.json', import.meta.url));

/** Lê o effect.schema.json como objeto. */
function readEffectSchema() {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
}

/** Atalho: códigos de erro de um ValidationResult. */
function codes(result) {
  return result.errors.map((error) => error.code);
}

describe('vocabulário fechado', () => {
  test('os 11 tipos de efeito do schema são exatamente os do domínio', () => {
    const schema = readEffectSchema();
    assert.deepStrictEqual([...EFFECT_TYPES].sort(), [...schema.$defs.effectType.enum].sort());
    assert.strictEqual(EFFECT_TYPES.length, 11);
    assert.ok(Object.isFrozen(EFFECT_TYPES));
  });

  test('as operações de modifier do schema são exatamente as do domínio', () => {
    const schema = readEffectSchema();
    assert.deepStrictEqual(
      [...MODIFIER_OPERATIONS].sort(),
      [...schema.$defs.modifierEffect.properties.operation.enum].sort(),
    );
  });

  test('as flags de estado do schema são exatamente as do domínio', () => {
    const schema = readEffectSchema();
    assert.deepStrictEqual([...STATE_FLAGS].sort(), [...schema.$defs.conditionStateFlag.properties.flag.enum].sort());
  });

  test('a whitelist de namespaces de target do domínio não divergiu do pattern do schema', () => {
    // Guarda contra a duplicação silenciosa da lista: se o schema ampliar o
    // vocabulário sem o domínio (ou vice-versa) este teste falha.
    const schema = readEffectSchema();
    const pattern = new RegExp(schema.$defs.modifierEffect.properties.target.pattern);
    for (const namespace of EFFECT_TARGET_NAMESPACES) {
      assert.ok(pattern.test(namespace), `o schema deveria aceitar o namespace "${namespace}"`);
      assert.ok(isAllowedTargetPath(namespace), `o domínio deveria aceitar o namespace "${namespace}"`);
    }
    // Um namespace fora da whitelist é recusado pelos dois lados.
    assert.ok(!pattern.test('state'));
    assert.ok(!isAllowedTargetPath('state.hitPoints.maximum'));
  });

  test('os paths canônicos citados no plano são aceitos', () => {
    for (const target of ['hp.maximum', 'ac', 'speed.walk', 'ability.forca.score', 'resource.furias.max']) {
      assert.ok(isAllowedTargetPath(target), target);
    }
  });
});

describe('isAllowedTargetPath: bloqueio de prototype pollution', () => {
  for (const segment of RESERVED_PATH_SEGMENTS) {
    test(`bloqueia o segmento reservado "${segment}" em qualquer posição`, () => {
      assert.ok(!isAllowedTargetPath(segment));
      assert.ok(!isAllowedTargetPath(`ability.${segment}`));
      assert.ok(!isAllowedTargetPath(`ability.${segment}.score`));
    });
  }

  test('__proto__, prototype e constructor estão na lista de reservados', () => {
    for (const segment of ['__proto__', 'prototype', 'constructor']) {
      assert.ok(RESERVED_PATH_SEGMENTS.includes(segment), segment);
    }
  });

  test('recusa valores que não são string, paths vazios e segmentos fora do formato', () => {
    for (const value of [null, undefined, 42, {}, [], '', '.', 'ability.', 'ability..score', 'Ability.Score', 'ability.score!']) {
      assert.ok(!isAllowedTargetPath(value), JSON.stringify(value));
    }
  });
});

describe('validateEffectSemantics', () => {
  test('aceita um efeito modifier mínimo válido', () => {
    const result = validateEffectSemantics({ type: 'modifier', target: 'ac', operation: 'add', value: 2 });
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.valid, true);
  });

  test('tipo desconhecido é erro (nunca ignorado em silêncio)', () => {
    const result = validateEffectSemantics({ type: 'grant-superpower', target: 'ac' });
    assert.strictEqual(result.valid, false);
    assert.ok(codes(result).includes('EFFECT_TYPE_UNKNOWN'));
  });

  test('efeito que não é objeto simples é erro', () => {
    for (const value of [null, undefined, 'modifier', 7, [{ type: 'modifier' }]]) {
      assert.strictEqual(validateEffectSemantics(value).valid, false, JSON.stringify(value));
    }
  });

  test('operação fora do enum fechado é erro', () => {
    const result = validateEffectSemantics({ type: 'modifier', target: 'ac', operation: 'divide', value: 2 });
    assert.ok(codes(result).includes('EFFECT_OPERATION_UNKNOWN'));
  });

  test('target fora da whitelist é erro', () => {
    const result = validateEffectSemantics({
      type: 'modifier',
      target: 'state.hitPoints.maximum',
      operation: 'add',
      value: 1,
    });
    assert.ok(codes(result).includes('EFFECT_TARGET_NOT_ALLOWED'));
  });

  test('target com segmento reservado é erro', () => {
    for (const target of ['ability.__proto__.score', 'ability.constructor', 'resource.prototype.max']) {
      const result = validateEffectSemantics({ type: 'modifier', target, operation: 'set', value: 1 });
      assert.ok(codes(result).includes('EFFECT_TARGET_NOT_ALLOWED'), target);
    }
  });

  test('chave própria reservada no efeito é erro, mesmo com o resto válido', () => {
    const effect = JSON.parse('{"type":"modifier","target":"ac","operation":"add","value":1,"__proto__":{"polluted":true}}');
    const result = validateEffectSemantics(effect);
    assert.strictEqual(result.valid, false);
    assert.ok(codes(result).includes('EFFECT_KEY_RESERVED'));
  });

  test('valores não serializáveis são erro', () => {
    for (const value of [() => 1, Symbol('x'), Number.NaN, Number.POSITIVE_INFINITY, {}, [], true, null]) {
      const result = validateEffectSemantics({ type: 'modifier', target: 'ac', operation: 'add', value });
      assert.strictEqual(result.valid, false, String(typeof value));
      assert.ok(codes(result).includes('EFFECT_VALUE_NOT_SERIALIZABLE'), String(typeof value));
    }
  });

  test('chave desconhecida no efeito é erro (formato fechado, como additionalProperties:false)', () => {
    const result = validateEffectSemantics({
      type: 'modifier',
      target: 'ac',
      operation: 'add',
      value: 1,
      extra: 'nope',
    });
    assert.ok(codes(result).includes('EFFECT_PROPERTY_UNKNOWN'));
  });

  test('campo obrigatório ausente é erro por tipo', () => {
    assert.ok(codes(validateEffectSemantics({ type: 'proficiency' })).includes('EFFECT_PROPERTY_MISSING'));
    assert.ok(codes(validateEffectSemantics({ type: 'language' })).includes('EFFECT_PROPERTY_MISSING'));
    assert.ok(codes(validateEffectSemantics({ type: 'resource', resource: 'furias' })).includes('EFFECT_PROPERTY_MISSING'));
    assert.ok(codes(validateEffectSemantics({ type: 'manual' })).includes('EFFECT_PROPERTY_MISSING'));
  });

  test('priority deve ser inteiro seguro quando presente', () => {
    const base = { type: 'proficiency', target: 'dnd2024:skill:atletismo' };
    assert.strictEqual(validateEffectSemantics({ ...base, priority: 3 }).valid, true);
    assert.strictEqual(validateEffectSemantics({ ...base, priority: -3 }).valid, true);
    for (const priority of [1.5, '3', Number.NaN, null, Number.MAX_SAFE_INTEGER + 2]) {
      assert.ok(
        codes(validateEffectSemantics({ ...base, priority })).includes('EFFECT_PRIORITY_INVALID'),
        JSON.stringify(priority),
      );
    }
  });

  test('stackKey deve seguir o formato localSlug e stackable deve ser boolean', () => {
    const base = { type: 'language', language: 'dnd2024:language:comum' };
    assert.strictEqual(validateEffectSemantics({ ...base, stackKey: 'idioma-comum' }).valid, true);
    assert.ok(codes(validateEffectSemantics({ ...base, stackKey: 'Idioma Comum' })).includes('EFFECT_STACK_KEY_INVALID'));
    assert.ok(codes(validateEffectSemantics({ ...base, stackKey: '__proto__' })).includes('EFFECT_STACK_KEY_INVALID'));
    assert.ok(
      codes(validateEffectSemantics({ ...base, stackKey: 'x', stackable: 'false' })).includes('EFFECT_STACKABLE_INVALID'),
    );
  });

  test('stackable:false sem stackKey é erro (não haveria por onde deduplicar)', () => {
    const result = validateEffectSemantics({
      type: 'language',
      language: 'dnd2024:language:comum',
      stackable: false,
    });
    assert.ok(codes(result).includes('EFFECT_STACKABLE_WITHOUT_STACK_KEY'));
  });

  test('ausência de stackKey é válida e significa "sempre acumula"', () => {
    const result = validateEffectSemantics({ type: 'language', language: 'dnd2024:language:comum' });
    assert.strictEqual(result.valid, true);
  });

  test('`when` malformado é erro', () => {
    const base = { type: 'manual', text: 'nota' };
    assert.ok(codes(validateEffectSemantics({ ...base, when: { kind: 'sql' } })).includes('EFFECT_CONDITION_UNKNOWN_KIND'));
    assert.ok(codes(validateEffectSemantics({ ...base, when: { kind: 'level' } })).includes('EFFECT_CONDITION_INVALID'));
    assert.ok(
      codes(validateEffectSemantics({ ...base, when: { kind: 'state-flag', flag: 'voando' } })).includes(
        'EFFECT_CONDITION_INVALID',
      ),
    );
  });

  test('não muta o efeito recebido', () => {
    const effect = { type: 'modifier', target: 'ac', operation: 'add', value: 1 };
    const snapshot = JSON.parse(JSON.stringify(effect));
    validateEffectSemantics(effect);
    assert.deepStrictEqual(effect, snapshot);
  });
});

describe('evaluateEffectCondition', () => {
  const context = {
    level: 5,
    classLevels: { 'dnd2024:class:barbaro': 5 },
    choices: { 'linhagem-elfica': ['alto-elfo'] },
    equippedItemIds: ['dnd2024:armor:cota-de-malha'],
    stateFlags: { raging: true },
  };

  test('ausência de condição significa efeito sempre ativo', () => {
    for (const condition of [undefined, null]) {
      const result = evaluateEffectCondition(condition, context);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.value, true);
    }
  });

  test('todas as sete kinds fechadas estão cobertas pelo domínio', () => {
    const schema = readEffectSchema();
    const schemaKinds = schema.$defs.conditionExpr.oneOf
      .map((ref) => schema.$defs[ref.$ref.replace('#/$defs/', '')].properties.kind.const)
      .sort();
    assert.deepStrictEqual([...CONDITION_KINDS].sort(), schemaKinds);
    assert.strictEqual(CONDITION_KINDS.length, 7);
  });

  test('level: compara o nível geral quando não há classe', () => {
    assert.strictEqual(evaluateEffectCondition({ kind: 'level', min: 5 }, context).value, true);
    assert.strictEqual(evaluateEffectCondition({ kind: 'level', min: 6 }, context).value, false);
    assert.strictEqual(evaluateEffectCondition({ kind: 'level', min: 1, max: 4 }, context).value, false);
    assert.strictEqual(evaluateEffectCondition({ kind: 'level', min: 1, max: 5 }, context).value, true);
  });

  test('level: com classe usa o nível DAQUELA classe', () => {
    assert.strictEqual(
      evaluateEffectCondition({ kind: 'level', class: 'dnd2024:class:barbaro', min: 5 }, context).value,
      true,
    );
    // Classe que o personagem não tem: condição falsa, não erro.
    const other = evaluateEffectCondition({ kind: 'level', class: 'dnd2024:class:mago', min: 1 }, context);
    assert.strictEqual(other.ok, true);
    assert.strictEqual(other.value, false);
  });

  test('level: contexto sem nível é erro (não assume 1)', () => {
    const result = evaluateEffectCondition({ kind: 'level', min: 1 }, {});
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_CONDITION_CONTEXT_MISSING');
  });

  test('choice: consulta por propriedade própria, nunca pelo protótipo', () => {
    assert.strictEqual(
      evaluateEffectCondition({ kind: 'choice', choiceId: 'linhagem-elfica', equals: 'alto-elfo' }, context).value,
      true,
    );
    assert.strictEqual(
      evaluateEffectCondition({ kind: 'choice', choiceId: 'linhagem-elfica', equals: 'drow' }, context).value,
      false,
    );
    // Escolha não selecionada é false, nunca erro.
    assert.strictEqual(
      evaluateEffectCondition({ kind: 'choice', choiceId: 'linhagem-gnomica', equals: 'drow' }, context).value,
      false,
    );
    // `toString` existe no protótipo de qualquer objeto: um `choiceId` assim é
    // RECUSADO no vocabulário, não avaliado contra o protótipo.
    const reservado = evaluateEffectCondition({ kind: 'choice', choiceId: 'toString', equals: 'drow' }, context);
    assert.strictEqual(reservado.ok, false);
    assert.strictEqual(reservado.error.code, 'EFFECT_CONDITION_INVALID');
    // E mesmo que o vocabulário fosse ampliado, a leitura é por propriedade
    // própria: um mapa de escolhas herdado nunca "acerta".
    const herdado = Object.create({ 'linhagem-elfica': ['drow'] });
    assert.strictEqual(
      evaluateEffectCondition({ kind: 'choice', choiceId: 'linhagem-elfica', equals: 'drow' }, { ...context, choices: herdado })
        .value,
      false,
    );
  });

  test('equipped: verdadeiro só para item efetivamente equipado', () => {
    assert.strictEqual(
      evaluateEffectCondition({ kind: 'equipped', item: 'dnd2024:armor:cota-de-malha' }, context).value,
      true,
    );
    assert.strictEqual(
      evaluateEffectCondition({ kind: 'equipped', item: 'dnd2024:armor:couro' }, context).value,
      false,
    );
  });

  test('state-flag: `equals` ausente equivale a true (default do schema)', () => {
    assert.strictEqual(evaluateEffectCondition({ kind: 'state-flag', flag: 'raging' }, context).value, true);
    assert.strictEqual(
      evaluateEffectCondition({ kind: 'state-flag', flag: 'raging', equals: false }, context).value,
      false,
    );
    // Flag não presente no estado conta como false.
    assert.strictEqual(evaluateEffectCondition({ kind: 'state-flag', flag: 'prone' }, context).value, false);
    assert.strictEqual(
      evaluateEffectCondition({ kind: 'state-flag', flag: 'prone', equals: false }, context).value,
      true,
    );
  });

  test('state-flag fora do enum fechado é erro', () => {
    const result = evaluateEffectCondition({ kind: 'state-flag', flag: 'voando' }, context);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_CONDITION_INVALID');
  });

  test('all/any/not compõem as condições fechadas', () => {
    const all = { kind: 'all', conditions: [{ kind: 'level', min: 5 }, { kind: 'state-flag', flag: 'raging' }] };
    assert.strictEqual(evaluateEffectCondition(all, context).value, true);
    const any = { kind: 'any', conditions: [{ kind: 'level', min: 20 }, { kind: 'state-flag', flag: 'raging' }] };
    assert.strictEqual(evaluateEffectCondition(any, context).value, true);
    const not = { kind: 'not', condition: { kind: 'level', min: 20 } };
    assert.strictEqual(evaluateEffectCondition(not, context).value, true);
  });

  test('erro de uma subcondição propaga em vez de virar false', () => {
    const result = evaluateEffectCondition(
      { kind: 'all', conditions: [{ kind: 'level', min: 1 }] },
      { stateFlags: {} },
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_CONDITION_CONTEXT_MISSING');
  });

  test('kind desconhecida é erro', () => {
    const result = evaluateEffectCondition({ kind: 'eval', expression: '1+1' }, context);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_CONDITION_UNKNOWN_KIND');
  });

  test('condição aninhada além da profundidade máxima é erro, não recursão infinita', () => {
    let condition = { kind: 'level', min: 1 };
    for (let i = 0; i <= MAX_CONDITION_DEPTH + 1; i += 1) {
      condition = { kind: 'not', condition };
    }
    const result = evaluateEffectCondition(condition, context);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'EFFECT_CONDITION_TOO_DEEP');
  });
});
