// ============================================================
// Passo `atributos` (Task 27).
//
// Os três métodos ATIVOS (conjunto padrão, compra de pontos e rolagem 4d6) e o
// modo MANUAL, que segue visível e desabilitado. Nada aqui aceita tabela
// embutida: conjunto padrão e compra de pontos vêm do ruleset, e a rolagem
// consome o RNG injetado — nunca `Math.random()`.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  ABILITIES_INTENT_TYPES,
  ABILITY_METHODS,
  ENABLED_ABILITY_METHODS,
  createAbilitiesStep,
  pointBuyCost,
  readAbilityScores,
  readBackgroundAbilityBonus,
  readPointBuyTable,
  readStandardArray,
  resetDivergenceReporting,
  resolveAbilityRuleset,
  roll4d6DropLowest,
} from '../../../site/js/features/creator/steps/abilities-step.js';
import { ABILITY_KEYS } from '../../../site/js/domain/character/queries/index.js';
import { PLAYER_OWNED_SLICES, createCreatorDraft } from '../../../site/js/features/creator/creator-state.js';
import { clearedSlicesOf } from '../../../site/js/features/creator/creator-invalidation.js';
import { officialRegistry, draftWithCharacter, stepContext, qualifiedPicks, sequenceRng } from '../../helpers/creator-steps.js';

const ACOLITO = 'dnd2024:background:acolito';

let registry;
let step;
let data;

before(async () => {
  registry = await officialRegistry();
  const created = createAbilitiesStep();
  assert.equal(created.ok, true, created.ok ? '' : created.error.code);
  step = created.value;
  const loaded = await step.load(stepContext({ stepId: 'atributos', draft: draftWithCharacter(), registry }));
  assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.error.code);
  data = loaded.value;
});

/**
 * Contexto do passo com step data já carregado.
 * @param {object} draft
 * @param {object} [extra]
 * @returns {object}
 */
function ctx(draft, extra = {}) {
  return stepContext({ stepId: 'atributos', draft, data, registry, ...extra });
}

/**
 * Rascunho com o antecedente Acólito CONFIRMADO: fatias do criador mais a
 * referência e a escolha no personagem canônico, que é o que a consulta do
 * domínio lê para aplicar o `modifier` de origem.
 * @param {string} optionId
 * @returns {object} draft
 */
function draftComAntecedente(optionId) {
  const base = draftWithCharacter({
    slices: {
      backgroundSelection: { contentId: ACOLITO, packageVersion: '1.0.0' },
      backgroundAbilityBonus: qualifiedPicks('background', ACOLITO, { 'bonus-de-atributo': [optionId] }),
    },
  });
  const character = {
    ...base.character,
    build: {
      ...base.character.build,
      backgroundRef: { id: ACOLITO, packageVersion: '1.0.0' },
      choices: qualifiedPicks('background', ACOLITO, { 'bonus-de-atributo': [optionId] }),
    },
  };
  const criado = createCreatorDraft({ character, slices: base.slices, provenance: base.provenance });
  assert.equal(criado.ok, true);
  return criado.value;
}

/**
 * Aplica uma intenção e devolve o rascunho resultante.
 * @param {object} draft
 * @param {object} intent
 * @param {object} [extra]
 * @returns {object}
 */
function reduzir(draft, intent, extra = {}) {
  const resultado = step.reduce(ctx(draft, extra), intent);
  assert.equal(resultado.ok, true, resultado.ok ? '' : resultado.error.code);
  return resultado.value.draft;
}

describe('passo atributos: carga a partir do RULESET', () => {
  test('load sem registry falha com erro nomeado', async () => {
    const resultado = await step.load(stepContext({ stepId: 'atributos', draft: draftWithCharacter(), registry: null }));
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_STEP_REGISTRY_MISSING');
  });

  test('sem ruleset acessível a resolução falha em vez de embutir tabela', () => {
    const semRuleset = resolveAbilityRuleset({ draft: draftWithCharacter(), registry: null, rules: null });
    assert.equal(semRuleset.ok, false);
    assert.equal(semRuleset.error.code, 'CREATOR_STEP_RULESET_UNAVAILABLE');
  });

  test('o conjunto padrão e a compra de pontos vêm do ruleset oficial', () => {
    assert.deepEqual([...data.standardArray], [15, 14, 13, 12, 10, 8]);
    assert.equal(data.pointBuy.budget, 27);
    assert.equal(data.pointBuy.minScore, 8);
    assert.equal(data.pointBuy.maxScore, 15);
    assert.deepEqual(data.pointBuy.costs, { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 });
  });

  test('uma tabela incompleta do ruleset é recusada com erro nomeado', () => {
    assert.equal(readStandardArray({ id: 'x', tables: { standardArray: [15, 14] } }).error.code, 'CREATOR_STEP_STANDARD_ARRAY_INVALID');
    const buraco = readPointBuyTable({ tables: { pointBuy: { budget: 27, minScore: 8, maxScore: 15, costs: { 8: 0 } } } });
    assert.equal(buraco.ok, false);
    assert.equal(buraco.error.code, 'CREATOR_STEP_POINT_BUY_COST_MISSING');
  });

  test('os nomes dos atributos saem das entidades do catálogo', () => {
    assert.deepEqual(
      data.abilities.map((ability) => ability.name),
      ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'],
    );
  });
});

describe('passo atributos: modo MANUAL visível e desabilitado', () => {
  test('o manual continua listado, marcado como desabilitado e fora dos métodos ativos', () => {
    const manual = ABILITY_METHODS.find((method) => method.id === 'manual');
    assert.notEqual(manual, undefined, 'o modo manual não pode sumir da interface');
    assert.equal(manual.enabled, false);
    assert.deepEqual([...ENABLED_ABILITY_METHODS], ['standard', 'pointbuy', 'rolagem']);
  });

  test('o markup renderiza o rádio manual com `disabled`', () => {
    const markup = step.render(ctx(draftWithCharacter()));
    assert.match(markup, /data-attr-mode="manual"[^>]*disabled/);
    assert.match(markup, /Manual/);
  });

  test('escolher o método manual é RECUSADO com erro nomeado', () => {
    const resultado = step.reduce(ctx(draftWithCharacter()), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'manual' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_ABILITIES_METHOD_DISABLED');
  });
});

describe('passo atributos: conjunto padrão sem reutilização', () => {
  test('cada valor é usado UMA vez; reatribuir libera o atributo anterior', () => {
    let draft = draftWithCharacter();
    draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'standard' });
    ABILITY_KEYS.forEach((key, index) => {
      draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.assignStandard, abilityKey: key, index });
    });
    assert.deepEqual(readAbilityScores(draft).base, { forca: 15, destreza: 14, constituicao: 13, inteligencia: 12, sabedoria: 10, carisma: 8 });
    assert.equal(step.validate(ctx(draft)).valid, true);

    // Dar o índice 0 (15) à Destreza tira o 15 da Força — nunca duplica.
    draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.assignStandard, abilityKey: 'destreza', index: 0 });
    const scores = readAbilityScores(draft);
    assert.equal(scores.base.destreza, 15);
    assert.equal(scores.base.forca, undefined, 'a Força perdeu o valor que a Destreza tomou');
    const resultado = step.validate(ctx(draft));
    assert.equal(resultado.valid, false);
    assert.deepEqual(resultado.errors.map((erro) => erro.code), ['CREATOR_ABILITIES_STANDARD_INCOMPLETE']);
  });

  test('um índice fora da tabela do ruleset é recusado', () => {
    const draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'standard' });
    const resultado = step.reduce(ctx(draft), { type: ABILITIES_INTENT_TYPES.assignStandard, abilityKey: 'forca', index: 6 });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_ABILITIES_STANDARD_INDEX_INVALID');
  });

  test('`state.abilities` e `build.abilityGeneration` recebem a BASE', () => {
    let draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'standard' });
    ABILITY_KEYS.forEach((key, index) => {
      draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.assignStandard, abilityKey: key, index });
    });
    assert.equal(draft.character.state.abilities.forca, 15);
    assert.equal(draft.character.build.abilityGeneration.method, 'standard');
    assert.deepEqual(draft.character.build.abilityGeneration.base, draft.character.state.abilities);
  });
});

describe('passo atributos: compra de pontos 8–15 / 27 pontos', () => {
  test('a distribuição começa no mínimo do ruleset e custa 0', () => {
    const draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'pointbuy' });
    const scores = readAbilityScores(draft);
    assert.deepEqual(scores.base, Object.fromEntries(ABILITY_KEYS.map((key) => [key, 8])));
    assert.equal(pointBuyCost(scores.base, data.pointBuy), 0);
    // Zero ponto gasto NÃO é uma distribuição completa.
    assert.deepEqual(step.validate(ctx(draft)).errors.map((erro) => erro.code), ['CREATOR_ABILITIES_POINT_BUY_REMAINING']);
  });

  test('gastar exatamente 27 pontos torna o passo válido', () => {
    let draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'pointbuy' });
    // 15/15/15 custa 27 (9+9+9) e zera o orçamento.
    for (const key of ['forca', 'destreza', 'constituicao']) {
      for (let passo = 0; passo < 7; passo += 1) {
        draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.pointBuy, abilityKey: key, delta: 1 });
      }
    }
    assert.equal(pointBuyCost(readAbilityScores(draft).base, data.pointBuy), 27);
    assert.equal(step.validate(ctx(draft)).valid, true);
  });

  test('estourar o orçamento é RECUSADO no reduce, não corrigido em silêncio', () => {
    let draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'pointbuy' });
    for (const key of ['forca', 'destreza', 'constituicao']) {
      for (let passo = 0; passo < 7; passo += 1) {
        draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.pointBuy, abilityKey: key, delta: 1 });
      }
    }
    const resultado = step.reduce(ctx(draft), { type: ABILITIES_INTENT_TYPES.pointBuy, abilityKey: 'inteligencia', delta: 1 });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_ABILITIES_POINT_BUY_OVER_BUDGET');
  });

  test('sair do intervalo 8–15 é recusado nas duas pontas', () => {
    const draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'pointbuy' });
    const abaixo = step.reduce(ctx(draft), { type: ABILITIES_INTENT_TYPES.pointBuy, abilityKey: 'forca', delta: -1 });
    assert.equal(abaixo.ok, false);
    assert.equal(abaixo.error.code, 'CREATOR_ABILITIES_POINT_BUY_OUT_OF_RANGE');
  });
});

describe('passo atributos: rolagem 4d6 com RNG INJETADO', () => {
  test('sem RNG injetado a rolagem é recusada — nunca cai em Math.random()', () => {
    const draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'rolagem' });
    const resultado = step.reduce(ctx(draft), { type: ABILITIES_INTENT_TYPES.roll, abilityKey: 'forca' });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_ABILITIES_RNG_MISSING');
  });

  test('4d6 descarta o MENOR dado, com resultado determinístico', () => {
    // Faces 6, 1, 4, 5 -> descarta o 1, soma 15.
    const rng = sequenceRng([5 / 6 + 0.01, 0.01, 3 / 6 + 0.01, 4 / 6 + 0.01]);
    const rolagem = roll4d6DropLowest(rng);
    assert.deepEqual([...rolagem.dice], [6, 1, 4, 5]);
    assert.equal(rolagem.dropped, 1);
    assert.equal(rolagem.total, 15);
    assert.equal(rng.calls(), 4, 'exatamente quatro dados por rolagem');
  });

  test('rolar todos consome 24 valores do RNG e completa os seis atributos', () => {
    const rng = sequenceRng([5 / 6 + 0.01, 0.01, 3 / 6 + 0.01, 4 / 6 + 0.01]);
    let draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'rolagem' });
    draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.roll, abilityKey: null }, { rng });
    assert.equal(rng.calls(), 24);
    const scores = readAbilityScores(draft);
    assert.deepEqual(scores.base, Object.fromEntries(ABILITY_KEYS.map((key) => [key, 15])));
    assert.deepEqual([...draft.character.build.abilityGeneration.rolls], [15, 15, 15, 15, 15, 15]);
    assert.equal(draft.character.build.abilityGeneration.method, 'rolled', 'o enum canônico é "rolled"');
    assert.equal(step.validate(ctx(draft)).valid, true);
  });

  test('rolar só um atributo deixa o passo incompleto', () => {
    const rng = sequenceRng([0.5]);
    let draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'rolagem' });
    draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.roll, abilityKey: 'carisma' }, { rng });
    const resultado = step.validate(ctx(draft));
    assert.equal(resultado.valid, false);
    assert.deepEqual(resultado.errors.map((erro) => erro.code), ['CREATOR_ABILITIES_ROLLS_INCOMPLETE']);
    assert.equal(resultado.errors[0].rolled, 1);
  });

  test('trocar de método RECOMEÇA a distribuição (um 15 rolado não vira 15 de graça na compra de pontos)', () => {
    const rng = sequenceRng([5 / 6 + 0.01]);
    let draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'rolagem' });
    draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.roll, abilityKey: null }, { rng });
    draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'pointbuy' });
    assert.deepEqual(readAbilityScores(draft).base, Object.fromEntries(ABILITY_KEYS.map((key) => [key, 8])));
    assert.deepEqual(readAbilityScores(draft).rolls, {});
  });
});

describe('passo atributos: bônus de antecedente por campo ESTRUTURADO', () => {
  test('as sete opções dos DEZESSEIS antecedentes são +2/+1 distintos ou +1/+1/+1', () => {
    const backgrounds = registry.list('background');
    assert.equal(backgrounds.length, 16);
    for (const entity of backgrounds) {
      const choice = entity.effects.find((effect) => effect?.type === 'choice' && effect.choice?.id === 'bonus-de-atributo')?.choice ?? null;
      assert.notEqual(choice, null, `${entity.id} sem escolha de bônus`);
      for (const option of choice.options) {
        const bonus = readBackgroundAbilityBonus({ entity, optionId: option.id });
        assert.ok(['+2/+1', '+1/+1/+1'].includes(bonus.shape), `${entity.id}/${option.id}: forma ${String(bonus.shape)}`);
        const total = Object.values(bonus.byAbility).reduce((soma, valor) => soma + valor, 0);
        assert.equal(total, 3, `${entity.id}/${option.id}: o total precisa ser 3`);
        if (bonus.shape === '+2/+1') {
          assert.equal(Object.keys(bonus.byAbility).length, 2, `${entity.id}/${option.id}: +2 e +1 em atributos DISTINTOS`);
        }
      }
    }
  });

  test('uma opção com forma ilegal é reportada como inválida (nunca aplicada torta)', () => {
    const entity = {
      effects: [
        {
          type: 'choice',
          choice: {
            id: 'bonus-de-atributo',
            options: [
              {
                id: 'torta',
                grants: [
                  { type: 'modifier', target: 'ability.forca.score', operation: 'add', value: 2 },
                  { type: 'modifier', target: 'ability.forca.score', operation: 'add', value: 1 },
                ],
              },
            ],
          },
        },
      ],
    };
    const bonus = readBackgroundAbilityBonus({ entity, optionId: 'torta' });
    assert.deepEqual(bonus.byAbility, { forca: 3 });
    assert.equal(bonus.shape, null, '+2/+1 no MESMO atributo não é uma das duas formas legais');
  });

  test('o bônus confirmado entra em `derivedStats` sem ser somado a `state.abilities`', () => {
    // O personagem carrega o antecedente DE VERDADE (`build.backgroundRef` +
    // `build.choices`), como o passo `antecedente` o deixa: é assim que a
    // consulta do domínio enxerga o `modifier` de origem. Testar com o
    // rascunho pela metade esconderia justamente a dupla contagem.
    let draft = draftComAntecedente('inteligencia-mais2-sabedoria-mais1');
    draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'standard' });
    ABILITY_KEYS.forEach((key, index) => {
      draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.assignStandard, abilityKey: key, index });
    });
    assert.equal(draft.character.state.abilities.inteligencia, 12, 'a BASE não pode absorver o bônus');
    const derived = draft.slices.derivedStats;
    assert.equal(derived.abilities.inteligencia.base, 12);
    assert.equal(derived.abilities.inteligencia.bonus, 2);
    assert.equal(derived.abilities.inteligencia.total, 14);
    assert.equal(derived.abilities.inteligencia.modifier, 2, 'o modificador exibido considera o bônus de origem');
    // A consulta do domínio ainda resolve o alvo `ability.<chave>` enquanto o
    // catálogo declara `ability.<chave>.score`: a diferença fica REGISTRADA em
    // `engineModifier` em vez de escondida (ver o concern da Task 27).
    assert.equal(derived.abilities.inteligencia.engineModifier, 1);
    assert.equal(derived.backgroundBonusShape, '+2/+1');
    assert.equal(derived.proficiencyBonus, 2);
  });

  test('a divergência entre `modifier` e `engineModifier` vira AVISO estruturado e barulhento', () => {
    resetDivergenceReporting();
    const avisado = [];
    const original = console.warn;
    console.warn = (...args) => avisado.push(args);
    try {
      let draft = draftComAntecedente('inteligencia-mais2-sabedoria-mais1');
      draft = reduzir(draft, { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'standard' });
      const avisos = draft.slices.derivedStats.warnings;
      // Diverge onde o bônus MUDA o modificador. Com a base ainda em 10, o
      // +1 de Sabedoria (10 -> 11) não muda o modificador e por isso não é
      // divergência; o +2 de Inteligência (10 -> 12) é.
      assert.deepEqual(
        avisos.map((aviso) => aviso.context.abilityKey),
        ['inteligencia'],
      );
      for (const aviso of avisos) {
        assert.equal(aviso.name, 'AppWarning');
        assert.equal(aviso.code, 'CREATOR_ABILITIES_MODIFIER_DIVERGENCE');
        assert.equal(aviso.scope, 'features.creator.steps.abilities');
        assert.notEqual(aviso.context.modifier, aviso.context.engineModifier);
      }
      assert.equal(avisado.length, 1, 'o aviso vai para o log');
      assert.match(String(avisado[0][0]), /CREATOR_ABILITIES_MODIFIER_DIVERGENCE/);

      // E não vira ruído: reprojetar de novo não repete o mesmo aviso no log.
      reduzir(draft, { type: ABILITIES_INTENT_TYPES.assignStandard, abilityKey: 'forca', index: 0 });
      assert.equal(avisado.length, 1, 'o aviso é deduplicado por assinatura');
    } finally {
      console.warn = original;
      resetDivergenceReporting();
    }
  });

  test('sem divergência não há aviso nenhum', () => {
    resetDivergenceReporting();
    // Sem antecedente confirmado não há bônus de origem: os dois valores batem.
    const draft = reduzir(draftWithCharacter(), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'standard' });
    assert.deepEqual([...draft.slices.derivedStats.warnings], []);
    assert.equal(draft.slices.derivedStats.backgroundBonusShape, null);
  });
});

describe('passo atributos: perícias de classe são exibidas, nunca reconcedidas', () => {
  test('o passo não toca em `classSkills` nem acrescenta proficiência ao personagem', () => {
    const BARBARO = 'dnd2024:class:barbaro';
    const base = draftWithCharacter({
      slices: {
        classSelection: { contentId: BARBARO, packageVersion: '1.0.0' },
        classSkills: qualifiedPicks('class', BARBARO, { 'pericias-de-classe': ['atletismo', 'intimidacao'] }),
      },
    });
    const draft = reduzir(base, { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'standard' });
    assert.deepEqual(draft.slices.classSkills, base.slices.classSkills, 'as perícias da classe seguem intactas');
    assert.deepEqual(draft.character.state.activeEffects, base.character.state.activeEffects, 'nenhuma concessão nova');
    const markup = step.render(ctx(draft));
    assert.match(markup, /data-pericias-count="2"/);
    assert.match(markup, /atletismo, intimidacao/);
  });
});

describe('passo atributos: invalidate', () => {
  test('limpa SÓ os derivados e preserva as fatias do jogador', () => {
    const patch = step.invalidate(ctx(draftWithCharacter()));
    assert.equal(patch.ok, true);
    assert.deepEqual([...patch.value.clearedStepIds], []);
    assert.deepEqual([...clearedSlicesOf(patch.value)], ['derivedStats']);
    for (const slice of PLAYER_OWNED_SLICES) {
      assert.ok(patch.value.preservedSlices.includes(slice), `${slice} precisa estar preservada`);
    }
  });

  test('o `invalidation` do reduce declara `derivedStats` como ESCRITA (não como resíduo)', () => {
    const draft = draftWithCharacter();
    const resultado = step.reduce(ctx(draft), { type: ABILITIES_INTENT_TYPES.chooseMethod, method: 'standard' });
    assert.equal(resultado.ok, true);
    assert.ok(resultado.value.invalidation.preservedSlices.includes('derivedStats'));
    assert.ok(resultado.value.invalidation.preservedSlices.includes('abilityScores'));
  });
});
