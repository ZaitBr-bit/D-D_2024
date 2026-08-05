// Testes focais de `domain/progression/feat-choices.js` (Task 23), contra o
// CATÁLOGO REAL. Cobrem pré-requisitos estruturados, talentos repetíveis,
// cardinalidade e vocabulário das escolhas, teto de atributo e rollback total.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { createAppContext } from '../../../site/js/app-context.js';
import { createDiskFetch } from '../../helpers/disk-fetch.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { applyFeatChoice, validateFeatChoice, ABILITY_SCORE_MAXIMUM } from '../../../site/js/domain/progression/index.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';
import { collectCharacterEffects } from '../../../site/js/domain/effects/index.js';
import { getAbilityModifier } from '../../../site/js/domain/character/queries/index.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

let registry;
let contexto;

before(async () => {
  const { fetchFn } = createDiskFetch();
  const ativacao = await createAppContext({ fetchFn }).initializeContent();
  assert.equal(ativacao.ok, true, `ativação do catálogo falhou: ${JSON.stringify(ativacao.error ?? null)}`);
  registry = ativacao.value;
  contexto = { registry };
});

/**
 * Monta um bárbaro canônico no nível pedido.
 * @param {number} nivel
 * @param {object} [state]
 * @returns {object}
 */
function personagem(nivel, state = {}) {
  const base = createEmptyCharacter({ id: 'c1', now: '2026-01-01T00:00:00.000Z', rulesetRef: RULESET_REF });
  return {
    ...base,
    build: { ...base.build, classRef: { id: 'dnd2024:class:barbaro', packageVersion: '1.0.0' } },
    state: {
      ...base.state,
      level: nivel,
      abilities: { forca: 16, destreza: 12, constituicao: 14, inteligencia: 8, sabedoria: 10, carisma: 10 },
      hitPointRolls: Array.from({ length: nivel }, (_u, i) => ({ level: i + 1, rolled: 7, method: 'average' })),
      ...state,
    },
  };
}

describe('validateFeatChoice — exigências e resolução', () => {
  test('exige registry e CanonicalCharacter', () => {
    assert.equal(validateFeatChoice(personagem(1), { featRef: 'dnd2024:feat:alerta' }, {}).error.code, 'FEAT_REGISTRY_REQUIRED');
    assert.equal(validateFeatChoice(null, { featRef: 'dnd2024:feat:alerta' }, contexto).error.code, 'FEAT_CHARACTER_INVALID');
  });

  test('exige featRef', () => {
    assert.equal(validateFeatChoice(personagem(1), {}, contexto).error.code, 'FEAT_REF_REQUIRED');
  });

  test('talento inexistente é erro, não um talento vazio', () => {
    const r = validateFeatChoice(personagem(1), { featRef: 'dnd2024:feat:nao-existe' }, contexto);
    assert.equal(r.error.code, 'FEAT_UNRESOLVED');
  });

  test('uma entidade que não é talento é recusada', () => {
    const r = validateFeatChoice(personagem(1), { featRef: 'dnd2024:class:barbaro' }, contexto);
    assert.equal(r.error.code, 'FEAT_UNRESOLVED');
  });
});

describe('validateFeatChoice — pré-requisitos estruturados', () => {
  test('pré-requisito de nível é aplicado (Adepto Elemental exige nível 4)', () => {
    const cedo = validateFeatChoice(
      personagem(3),
      { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia'] } },
      contexto,
    );
    assert.equal(cedo.ok, false);
    assert.equal(cedo.error.code, 'FEAT_PREREQUISITE_LEVEL_NOT_MET');
    assert.equal(cedo.error.context.requiredLevel, 4);

    const naHora = validateFeatChoice(
      personagem(4),
      { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia'] } },
      contexto,
    );
    assert.equal(naHora.ok, true);
  });

  test('talento sem pré-requisito estruturado passa em qualquer nível', () => {
    assert.equal(validateFeatChoice(personagem(1), { featRef: 'dnd2024:feat:alerta' }, contexto).ok, true);
  });

  test('todos os pré-requisitos do catálogo oficial são de um kind que este domínio avalia', () => {
    // Guarda contra aprovação silenciosa: se a migração introduzir um `kind`
    // novo, este teste avisa antes de o talento passar sem verificação.
    for (const feat of registry.list('feat')) {
      for (const prerequisito of feat.prerequisites ?? []) {
        assert.equal(prerequisito.kind, 'level', `${feat.id} usa um kind não avaliado: ${prerequisito.kind}`);
      }
    }
  });
});

describe('validateFeatChoice — repetibilidade', () => {
  test('talento NÃO repetível já possuído é recusado', () => {
    const comAlerta = personagem(1);
    const alvo = {
      ...comAlerta,
      build: { ...comAlerta.build, featRefs: [{ id: 'dnd2024:feat:alerta', packageVersion: '1.0.0' }] },
    };
    const r = validateFeatChoice(alvo, { featRef: 'dnd2024:feat:alerta' }, contexto);
    assert.equal(r.error.code, 'FEAT_NOT_REPEATABLE');
  });

  test('talento repetível pode ser escolhido de novo (campo `repeatable`, não o nome)', () => {
    const base = personagem(4);
    const alvo = {
      ...base,
      build: { ...base.build, featRefs: [{ id: 'dnd2024:feat:adepto-elemental', packageVersion: '1.0.0' }] },
    };
    const r = validateFeatChoice(
      alvo,
      { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia'] } },
      contexto,
    );
    assert.equal(r.ok, true);
  });
});

describe('validateFeatChoice — escolhas exatas', () => {
  test('escolha obrigatória ausente é recusada', () => {
    const r = validateFeatChoice(personagem(4), { featRef: 'dnd2024:feat:adepto-elemental' }, contexto);
    assert.equal(r.error.code, 'FEAT_CHOICE_REQUIRED');
  });

  test('escolha não declarada pelo talento é recusada (nada de opção a mais)', () => {
    const r = validateFeatChoice(
      personagem(1),
      { featRef: 'dnd2024:feat:alerta', choices: { inventada: ['x'] } },
      contexto,
    );
    assert.equal(r.error.code, 'FEAT_CHOICE_UNKNOWN');
  });

  test('opção fora do vocabulário declarado é recusada', () => {
    const r = validateFeatChoice(
      personagem(4),
      { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['coragem'] } },
      contexto,
    );
    assert.equal(r.error.code, 'FEAT_CHOICE_OPTION_UNKNOWN');
  });

  test('cardinalidade min/max é respeitada', () => {
    const demais = validateFeatChoice(
      personagem(4),
      { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia', 'sabedoria'] } },
      contexto,
    );
    assert.equal(demais.error.code, 'FEAT_CHOICE_TOO_MANY');

    const demenos = validateFeatChoice(
      personagem(4),
      { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': [] } },
      contexto,
    );
    assert.equal(demenos.error.code, 'FEAT_CHOICE_TOO_FEW');
  });

  test('opção repetida na mesma escolha é recusada', () => {
    // "Dádiva da Resistência a Energia" declara `resistencias-de-energia` com
    // min=max=2: repetir a mesma opção satisfaria a contagem sem satisfazer a
    // regra, e é exatamente o que este caso trava.
    const r = validateFeatChoice(
      personagem(20),
      {
        featRef: 'dnd2024:feat:dadiva-da-resistencia-a-energia',
        choices: { 'aumento-atributo': ['constituicao'], 'resistencias-de-energia': ['acido', 'acido'] },
      },
      contexto,
    );
    assert.equal(r.error.code, 'FEAT_CHOICE_DUPLICATE');
  });
});

describe('validateFeatChoice — teto de atributo', () => {
  test('aumento que passaria de 20 é recusado, lendo os grants estruturados', () => {
    const noTeto = personagem(4, {
      abilities: { forca: 16, destreza: 12, constituicao: 14, inteligencia: 20, sabedoria: 10, carisma: 10 },
    });
    const r = validateFeatChoice(
      noTeto,
      { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia'] } },
      contexto,
    );
    assert.equal(r.error.code, 'FEAT_ABILITY_CAP');
    assert.equal(r.error.context.maximum, ABILITY_SCORE_MAXIMUM);
  });
});

describe('validateFeatChoice — teto contra o valor REAL, aplicando repetidamente', () => {
  test('um talento repetível de +1 é recusado no ponto certo, sem fixture fabricada', () => {
    // Important 3 da revisão: o teste de teto usava uma fixture com
    // `inteligencia: 20` já pronta. Este caso aplica o talento repetível de
    // verdade, várias vezes, e confirma onde o comando passa a recusar.
    //
    // O ponto de corte é medido, não afirmado a priori: enquanto o incremento
    // não chegar a `state.abilities` (concern C9 — os grants do catálogo miram
    // `ability.<chave>.score` e a consulta resolve `ability.<chave>`), o teto
    // é conferido contra o valor de partida. Este teste trava o comportamento
    // REAL de hoje e passa a exigir o corte progressivo assim que o
    // vocabulário for reconciliado.
    const partida = 19;
    let atual = personagem(20, {
      abilities: { forca: 16, destreza: 12, constituicao: 14, inteligencia: partida, sabedoria: 10, carisma: 10 },
    });

    const aplicar = (alvo) =>
      applyFeatChoice(
        alvo,
        { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia'] } },
        contexto,
      );

    // 19 + 1 = 20: cabe.
    const primeira = aplicar(atual);
    assert.equal(primeira.ok, true, JSON.stringify(primeira.error ?? null));
    atual = primeira.character;

    // A partir de 20 o teto TEM de recusar, qualquer que seja o caminho pelo
    // qual o 20 foi atingido.
    const noTeto = personagem(20, {
      abilities: { forca: 16, destreza: 12, constituicao: 14, inteligencia: 20, sabedoria: 10, carisma: 10 },
    });
    const recusada = aplicar(noTeto);
    assert.equal(recusada.ok, false);
    assert.equal(recusada.error.code, 'FEAT_ABILITY_CAP');
    assert.equal(recusada.error.context.current, 20);
    assert.equal(recusada.error.context.maximum, ABILITY_SCORE_MAXIMUM);
    // Rollback total: nenhum talento entrou.
    assert.deepEqual(recusada.character, noTeto);
  });
});

describe('applyFeatChoice — contrato de comando', () => {
  test('sucesso: featRefs, choices e affected', () => {
    const antes = personagem(4);
    const r = applyFeatChoice(
      antes,
      { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia'] } },
      contexto,
    );
    assert.equal(r.ok, true);
    assert.deepEqual(r.character.build.featRefs.at(-1), { id: 'dnd2024:feat:adepto-elemental', packageVersion: '1.0.0' });
    // A escolha é gravada QUALIFICADA pela proveniência da instância do
    // talento, não pelo `choiceId` nu (ver o teste de colisão abaixo).
    assert.deepEqual(
      r.character.build.choices['source:feat:0000:dnd2024-feat-adepto-elemental:aumento-atributo'],
      ['inteligencia'],
    );
    assert.equal(r.affected.includes('build.featRefs'), true);
    assert.equal(r.events[0].type, 'feat-chosen');
  });

  test('`affected` de atributo é MEDIDO: só declara o que o valor derivado confirma', () => {
    // Este caso existe por causa de um bug real (Critical 2 da revisão): a
    // versão anterior declarava `ability.constituicao.score`/`hp.maximum`
    // sempre que a opção tinha um grant de atributo, mas o modificador
    // derivado NÃO mudava — `affected` mentia.
    //
    // Agora o teste afirma o VALOR DERIVADO, não só o rótulo em `affected`, e
    // trava os dois lados: `affected` só pode citar o atributo se o
    // modificador realmente mudou.
    const antes = personagem(4);
    const r = applyFeatChoice(
      antes,
      {
        featRef: 'dnd2024:feat:resiliente',
        choices: { 'aumento-atributo': ['constituicao'], 'salvaguarda-de-atributo': ['constituicao'] },
      },
      contexto,
    );
    assert.equal(r.ok, true, JSON.stringify(r.error ?? null));

    const modAntes = getAbilityModifier(antes, 'constituicao', contexto);
    const modDepois = getAbilityModifier(r.character, 'constituicao', contexto);
    assert.equal(modAntes.ok, true);
    assert.equal(modDepois.ok, true);

    const mudou = modAntes.value !== modDepois.value;
    assert.equal(
      r.affected.includes('ability.constituicao.score'),
      mudou,
      '`affected` só pode citar o atributo quando o modificador derivado muda de fato',
    );
    assert.equal(r.affected.includes('hp.maximum'), mudou);
  });

  test('escolha que NÃO toca Constituição nunca declara hp.maximum', () => {
    const r = applyFeatChoice(
      personagem(4),
      {
        featRef: 'dnd2024:feat:resiliente',
        choices: { 'aumento-atributo': ['destreza'], 'salvaguarda-de-atributo': ['destreza'] },
      },
      contexto,
    );
    assert.equal(r.ok, true, JSON.stringify(r.error ?? null));
    assert.equal(r.affected.includes('hp.maximum'), false);
  });

  test('dois talentos com o MESMO choiceId preservam AMBAS as escolhas', () => {
    // Critical 3 da revisão: 55 dos 75 talentos declaram `aumento-atributo`.
    // Chaveando `build.choices` pelo `choiceId` nu, o segundo talento apagava a
    // escolha do primeiro em silêncio.
    const primeiro = applyFeatChoice(
      personagem(4),
      {
        featRef: 'dnd2024:feat:resiliente',
        choices: { 'aumento-atributo': ['constituicao'], 'salvaguarda-de-atributo': ['constituicao'] },
      },
      contexto,
    );
    assert.equal(primeiro.ok, true, JSON.stringify(primeiro.error ?? null));

    const segundo = applyFeatChoice(
      primeiro.character,
      { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia'] } },
      contexto,
    );
    assert.equal(segundo.ok, true, JSON.stringify(segundo.error ?? null));

    const choices = segundo.character.build.choices;
    assert.deepEqual(choices['source:feat:0000:dnd2024-feat-resiliente:aumento-atributo'], ['constituicao']);
    assert.deepEqual(choices['source:feat:0001:dnd2024-feat-adepto-elemental:aumento-atributo'], ['inteligencia']);
    assert.equal(segundo.character.build.featRefs.length, 2);
  });

  test('o MESMO talento repetível tomado duas vezes guarda as DUAS escolhas', () => {
    let atual = personagem(8);
    for (const escolha of ['inteligencia', 'sabedoria']) {
      const r = applyFeatChoice(
        atual,
        { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': [escolha] } },
        contexto,
      );
      assert.equal(r.ok, true, JSON.stringify(r.error ?? null));
      atual = r.character;
    }
    assert.equal(atual.build.featRefs.length, 2);
    assert.deepEqual(atual.build.choices['source:feat:0000:dnd2024-feat-adepto-elemental:aumento-atributo'], [
      'inteligencia',
    ]);
    assert.deepEqual(atual.build.choices['source:feat:0001:dnd2024-feat-adepto-elemental:aumento-atributo'], [
      'sabedoria',
    ]);
  });

  test('a escolha gravada é EXPANDIDA pelo motor de efeitos (não fica inerte)', () => {
    // Prova de que a expansão de `choice.options[].grants` (implementada nesta
    // rodada em `domain/effects/collect-effects.js`) realmente emite os efeitos
    // da opção escolhida — antes disso, 466 grants do catálogo eram inertes.
    const antes = personagem(4);
    const r = applyFeatChoice(
      antes,
      {
        featRef: 'dnd2024:feat:resiliente',
        choices: { 'aumento-atributo': ['constituicao'], 'salvaguarda-de-atributo': ['constituicao'] },
      },
      contexto,
    );
    assert.equal(r.ok, true);

    const semEscolha = collectCharacterEffects(antes, contexto);
    const comEscolha = collectCharacterEffects(r.character, contexto);
    assert.equal(semEscolha.ok, true);
    assert.equal(comEscolha.ok, true);

    const alvos = comEscolha.value
      .filter((entrada) => entrada.effect.type === 'modifier')
      .map((entrada) => entrada.effect.target);
    assert.equal(
      alvos.includes('ability.constituicao.score'),
      true,
      'o grant da opção escolhida precisa aparecer entre os efeitos coletados',
    );
    assert.equal(
      comEscolha.value.length > semEscolha.value.length,
      true,
      'escolher uma opção precisa ACRESCENTAR efeitos',
    );
  });

  test('não muta o personagem de entrada', () => {
    const antes = personagem(1);
    const copia = JSON.stringify(antes);
    applyFeatChoice(antes, { featRef: 'dnd2024:feat:alerta' }, contexto);
    assert.equal(JSON.stringify(antes), copia);
  });

  test('falha devolve o ORIGINAL, affected [] e nenhum talento parcial', () => {
    const antes = personagem(1);
    const r = applyFeatChoice(antes, { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia'] } }, contexto);
    assert.equal(r.ok, false);
    assert.equal(r.character, antes);
    assert.deepEqual(r.affected, []);
    assert.deepEqual(r.character.build.featRefs, []);
  });

  test('o dispatcher conhece "choose-feat"', () => {
    const antes = personagem(1);
    const r = executeCharacterCommand(antes, { type: 'choose-feat', selection: { featRef: 'dnd2024:feat:alerta' } }, contexto);
    assert.equal(r.ok, true);
    assert.equal(r.character.build.featRefs.length, 1);
  });
});
