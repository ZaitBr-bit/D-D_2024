// Testes focais de `domain/progression/progression-queries.js` (Task 23).
//
// O oráculo é o CATÁLOGO REAL (`dados/pacotes/dnd2024/**`), ativado pelo
// composition root com `fetchFn` de disco — não uma fixture única montada à
// mão. A matriz é verificada nas 12 classes, e não só numa: uma paridade de
// fixture única mascararia justamente as classes cujos dados são diferentes
// (Bardo com coluna de dado, Bruxo sem espaço de magia comum, Guerreiro/Ladino
// com níveis de ASI extras).

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { createAppContext } from '../../../site/js/app-context.js';
import { createDiskFetch } from '../../helpers/disk-fetch.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import {
  MIN_LEVEL,
  MAX_LEVEL,
  getProgressionMatrix,
  getProgressionRow,
  requireHitPointRolls,
  getMaximumHitPoints,
} from '../../../site/js/domain/progression/progression-queries.js';
import { getHitPointProjection } from '../../../site/js/domain/character/queries/index.js';

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
 * Monta um personagem canônico de uma classe, com o estado informado.
 * @param {string} classId
 * @param {object} [state]
 * @returns {object}
 */
function personagem(classId, state = {}) {
  const base = createEmptyCharacter({ id: 'c1', now: '2026-01-01T00:00:00.000Z', rulesetRef: RULESET_REF });
  return {
    ...base,
    build: { ...base.build, classRef: { id: classId, packageVersion: '1.0.0' } },
    state: { ...base.state, ...state },
  };
}

/** Histórico de PV completo de 1..`nivel`, todo com o mesmo valor. */
function historico(nivel, valor) {
  return Array.from({ length: nivel }, (_unused, indice) => ({ level: indice + 1, rolled: valor, method: 'fixed' }));
}

describe('getProgressionMatrix — forma e exigências', () => {
  test('exige um CanonicalCharacter', () => {
    const resultado = getProgressionMatrix(null, { registry });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PROGRESSION_CHARACTER_INVALID');
  });

  test('exige context.registry — matriz vazia seria bypass silencioso', () => {
    const resultado = getProgressionMatrix(personagem('dnd2024:class:barbaro'), {});
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PROGRESSION_REGISTRY_REQUIRED');
  });

  test('devolve exatamente 20 linhas, de 1 a 20, congeladas', () => {
    const resultado = getProgressionMatrix(personagem('dnd2024:class:mago'), contexto);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.length, MAX_LEVEL - MIN_LEVEL + 1);
    assert.deepEqual(
      resultado.value.map((linha) => linha.level),
      Array.from({ length: 20 }, (_u, i) => i + 1),
    );
    assert.equal(Object.isFrozen(resultado.value[0]), true);
  });

  test('é pura: duas chamadas dão o mesmo resultado e o personagem não muda', () => {
    const alvo = personagem('dnd2024:class:clerigo');
    const antes = JSON.stringify(alvo);
    const a = getProgressionMatrix(alvo, contexto);
    const b = getProgressionMatrix(alvo, contexto);
    assert.deepEqual(a.value, b.value);
    assert.equal(JSON.stringify(alvo), antes);
  });

  test('bônus de proficiência segue a progressão 2..6', () => {
    const matriz = getProgressionMatrix(personagem('dnd2024:class:ladino'), contexto).value;
    assert.deepEqual(
      matriz.map((linha) => linha.proficiencyBonus),
      [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6],
    );
  });
});

describe('getProgressionMatrix — as 12 classes derivam sem erro', () => {
  test('toda classe do catálogo produz matriz completa', () => {
    const classes = registry.list('class');
    assert.equal(classes.length, 12, 'o catálogo oficial tem 12 classes');
    for (const classe of classes) {
      const resultado = getProgressionMatrix(personagem(classe.id), contexto);
      assert.equal(resultado.ok, true, `${classe.id}: ${JSON.stringify(resultado.error ?? null)}`);
      assert.equal(resultado.value.length, 20);
    }
  });

  test('os níveis de ASI vêm do efeito estruturado, e diferem por classe', () => {
    /** Níveis com ASI de uma classe. */
    const asiDe = (classId) =>
      getProgressionMatrix(personagem(classId), contexto)
        .value.filter((linha) => linha.grantsAbilityScoreImprovement)
        .map((linha) => linha.level);

    // A maioria: 4/8/12/16 + Dádiva Épica em 19.
    assert.deepEqual(asiDe('dnd2024:class:mago'), [4, 8, 12, 16, 19]);
    // Guerreiro e Ladino têm níveis EXTRAS — se a detecção fosse pelo nome da
    // característica ou por uma tabela fixa, estes dois passariam despercebidos.
    assert.deepEqual(asiDe('dnd2024:class:guerreiro'), [4, 6, 8, 12, 14, 16, 19]);
    assert.deepEqual(asiDe('dnd2024:class:ladino'), [4, 8, 10, 12, 16, 19]);
  });

  test('a Dádiva Épica é marcada por params.epicBoon, só no nível 19', () => {
    for (const classe of registry.list('class')) {
      const matriz = getProgressionMatrix(personagem(classe.id), contexto).value;
      const epicos = matriz.filter((linha) => linha.grantsEpicBoon).map((linha) => linha.level);
      assert.deepEqual(epicos, [19], `${classe.id} deveria ter Dádiva Épica só no 19`);
      // Dádiva Épica é sempre também um nível de ASI/talento.
      assert.equal(matriz[18].grantsAbilityScoreImprovement, true);
    }
  });

  test('uma característica de nível N aparece SÓ na linha N (não se repete adiante)', () => {
    const matriz = getProgressionMatrix(personagem('dnd2024:class:barbaro'), contexto).value;
    const vistos = new Map();
    for (const linha of matriz) {
      for (const feature of linha.features) {
        assert.equal(feature.level, linha.level);
        assert.equal(vistos.has(feature.id), false, `${feature.id} repetido no nível ${linha.level}`);
        vistos.set(feature.id, linha.level);
      }
    }
    assert.equal(vistos.get('dnd2024:feature:barbaro-furia'), 1);
    assert.equal(vistos.get('dnd2024:feature:barbaro-dadiva-epica'), 19);
  });
});

describe('getProgressionMatrix — recursos e espaços de magia', () => {
  test('a ladder de recurso colapsa no degrau do nível (Fúrias do Bárbaro)', () => {
    const matriz = getProgressionMatrix(personagem('dnd2024:class:barbaro'), contexto).value;
    const furias = (nivel) => matriz[nivel - 1].resources['dnd2024:resource:furias'];
    assert.equal(furias(1), 2);
    assert.equal(furias(2), 2);
    assert.equal(furias(3), 3);
    assert.equal(furias(6), 4);
    assert.equal(furias(12), 5);
    assert.equal(furias(17), 6);
  });

  test('recursos são chaveados pelo ContentId estruturado, como state.resources', () => {
    const linha = getProgressionMatrix(personagem('dnd2024:class:barbaro'), contexto).value[0];
    for (const chave of Object.keys(linha.resources)) {
      assert.match(chave, /^[a-z0-9-]+:resource:[a-z0-9-]+$/, `recurso não qualificado: ${chave}`);
    }
  });

  test('os espaços de magia do Bardo batem com a tabela oficial 2024', () => {
    const matriz = getProgressionMatrix(personagem('dnd2024:class:bardo'), contexto).value;
    assert.deepEqual(matriz[0].spellSlots, { 1: 2 });
    assert.deepEqual(matriz[2].spellSlots, { 1: 4, 2: 2 });
    assert.deepEqual(matriz[19].spellSlots, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 });
  });

  test('classe sem espaço de magia comum não ganha espaços inventados', () => {
    for (const classId of ['dnd2024:class:barbaro', 'dnd2024:class:guerreiro', 'dnd2024:class:monge']) {
      const matriz = getProgressionMatrix(personagem(classId), contexto).value;
      for (const linha of matriz) {
        assert.deepEqual(linha.spellSlots, {}, `${classId} nível ${linha.level}`);
      }
    }
  });

  test('recurso com max por VARIÁVEL cresce linha a linha, não congela no nível atual', () => {
    // Bug real (Critical 1 da revisão): as variáveis de contexto
    // (`proficiency-bonus`, `level`, ...) eram resolvidas UMA vez, fora do loop
    // das 20 linhas, a partir do nível ATUAL do personagem. Como
    // `getProficiencyBonus` lê `character.state.level` (não `context.level`),
    // todo `max: "proficiency-bonus"` ficava constante na matriz inteira:
    // Draconato nível 1 => 2,2,2,...,2; nível 20 => 6,6,6,...,6.
    //
    // Seis espécies do catálogo dependem disso (aasimar, anão, draconato,
    // golias, orc, kenku).
    const RECURSO = 'dnd2024:resource:ataque-de-sopro';
    const esperado = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

    // O resultado NÃO pode depender do nível atual do personagem: a matriz é
    // uma projeção de 1..20, e é justamente isso que o bug violava.
    for (const nivelAtual of [1, 5, 20]) {
      const base = createEmptyCharacter({ id: 'c1', now: '2026-01-01T00:00:00.000Z', rulesetRef: RULESET_REF });
      const alvo = {
        ...base,
        build: {
          ...base.build,
          classRef: { id: 'dnd2024:class:guerreiro', packageVersion: '1.0.0' },
          speciesRef: { id: 'dnd2024:species:draconato', packageVersion: '1.0.0' },
        },
        state: { ...base.state, level: nivelAtual },
      };
      const matriz = getProgressionMatrix(alvo, contexto);
      assert.equal(matriz.ok, true, JSON.stringify(matriz.error ?? null));
      assert.deepEqual(
        matriz.value.map((linha) => linha.resources[RECURSO]),
        esperado,
        `nível atual ${nivelAtual}: o recurso deve seguir o bônus de proficiência de CADA linha`,
      );
      // Coerência interna: o recurso derivado do PB tem de bater com a coluna
      // `proficiencyBonus` da MESMA linha. Era essa contradição que denunciava
      // o bug.
      for (const linha of matriz.value) {
        assert.equal(linha.resources[RECURSO], linha.proficiencyBonus, `nível ${linha.level}`);
      }
    }
  });

  test('a coluna de DADO do Bardo vai para diceProgression, não para resources', () => {
    // `max: "D6"` é notação de dado reaproveitando o campo `max` (defeito de
    // modelagem do catálogo registrado como concern da Task 23). A matriz não
    // pode nem explodir nem descartar em silêncio.
    const matriz = getProgressionMatrix(personagem('dnd2024:class:bardo'), contexto).value;
    const dado = (nivel) => matriz[nivel - 1].diceProgression['dnd2024:resource:dados-de-inspiracao'];
    assert.equal(dado(1), 'd6');
    assert.equal(dado(5), 'd8');
    assert.equal(dado(10), 'd10');
    assert.equal(dado(15), 'd12');
    assert.equal(matriz[0].resources['dnd2024:resource:dados-de-inspiracao'], undefined);
  });
});

describe('getProgressionRow', () => {
  test('recusa nível fora de 1..20', () => {
    for (const nivel of [0, 21, 1.5, '3', null]) {
      const resultado = getProgressionRow(personagem('dnd2024:class:mago'), nivel, contexto);
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'PROGRESSION_LEVEL_OUT_OF_RANGE');
    }
  });

  test('devolve a mesma linha que a matriz completa', () => {
    const alvo = personagem('dnd2024:class:druida');
    const matriz = getProgressionMatrix(alvo, contexto).value;
    for (const nivel of [1, 7, 20]) {
      assert.deepEqual(getProgressionRow(alvo, nivel, contexto).value, matriz[nivel - 1]);
    }
  });
});

describe('requireHitPointRolls — ausência e buraco são erro, nunca média', () => {
  test('sem hitPointRolls: erro explícito', () => {
    const resultado = requireHitPointRolls(personagem('dnd2024:class:mago', { level: 3 }), 3);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PROGRESSION_HIT_POINT_ROLLS_MISSING');
  });

  test('buraco no histórico: erro que nomeia o nível faltante', () => {
    const alvo = personagem('dnd2024:class:mago', {
      level: 3,
      hitPointRolls: [
        { level: 1, rolled: 6, method: 'fixed' },
        { level: 3, rolled: 4, method: 'roll' },
      ],
    });
    const resultado = requireHitPointRolls(alvo, 3);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PROGRESSION_HIT_POINT_ROLL_GAP');
    assert.equal(resultado.error.context.level, 2);
  });

  test('nível duplicado: erro', () => {
    const alvo = personagem('dnd2024:class:mago', {
      level: 2,
      hitPointRolls: [
        { level: 1, rolled: 6, method: 'fixed' },
        { level: 1, rolled: 4, method: 'roll' },
      ],
    });
    assert.equal(requireHitPointRolls(alvo, 2).error.code, 'PROGRESSION_HIT_POINT_ROLL_DUPLICATE');
  });

  test('rolled: null NÃO vira média silenciosamente', () => {
    const alvo = personagem('dnd2024:class:mago', {
      level: 2,
      hitPointRolls: [
        { level: 1, rolled: 6, method: 'fixed' },
        { level: 2, rolled: null, method: 'roll' },
      ],
    });
    const resultado = requireHitPointRolls(alvo, 2);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PROGRESSION_HIT_POINT_ROLL_UNKNOWN');
  });

  test('histórico além do nível atual é ignorado (não é erro)', () => {
    const alvo = personagem('dnd2024:class:mago', { level: 1, hitPointRolls: historico(3, 6) });
    const resultado = requireHitPointRolls(alvo, 1);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.length, 1);
  });
});

describe('getMaximumHitPoints — sempre recomputado, nunca congelado', () => {
  test('soma rolagens + modificador de Constituição por nível', () => {
    const alvo = personagem('dnd2024:class:barbaro', {
      level: 3,
      abilities: { forca: 10, destreza: 10, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 10 },
      hitPointRolls: [
        { level: 1, rolled: 12, method: 'fixed' },
        { level: 2, rolled: 7, method: 'average' },
        { level: 3, rolled: 7, method: 'average' },
      ],
    });
    const resultado = getMaximumHitPoints(alvo, contexto);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.value.fromRolls, 26);
    assert.equal(resultado.value.fromConstitution, 6);
    assert.equal(resultado.value.base, 32);
    assert.equal(resultado.value.maximum, 32);
  });

  test('subir Constituição depois recalcula RETROATIVAMENTE, sem tocar em hitPointRolls', () => {
    const rolagens = [
      { level: 1, rolled: 12, method: 'fixed' },
      { level: 2, rolled: 7, method: 'average' },
      { level: 3, rolled: 7, method: 'average' },
      { level: 4, rolled: 7, method: 'average' },
    ];
    const antes = personagem('dnd2024:class:barbaro', {
      level: 4,
      abilities: { forca: 10, destreza: 10, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 10 },
      hitPointRolls: rolagens,
    });
    const depois = personagem('dnd2024:class:barbaro', {
      level: 4,
      abilities: { forca: 10, destreza: 10, constituicao: 16, inteligencia: 10, sabedoria: 10, carisma: 10 },
      hitPointRolls: rolagens,
    });
    assert.equal(getMaximumHitPoints(antes, contexto).value.maximum, 33 + 8);
    // +1 de modificador × 4 níveis = +4 retroativos.
    assert.equal(getMaximumHitPoints(depois, contexto).value.maximum, 33 + 12);
    assert.deepEqual(depois.state.hitPointRolls, rolagens, 'as rolagens não mudam quando a Constituição muda');
  });

  test('o ajuste manual do usuário vence em `maximum`, mas `base` continua a derivação pura', () => {
    const alvo = personagem('dnd2024:class:barbaro', {
      level: 1,
      abilities: { forca: 10, destreza: 10, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 10 },
      hitPointRolls: [{ level: 1, rolled: 12, method: 'fixed' }],
    });
    const comOverride = { ...alvo, overrides: { 'hp.maximum': { value: 999, updatedAt: '2026-01-01T00:00:00.000Z' } } };

    const semOverride = getMaximumHitPoints(alvo, contexto);
    assert.equal(semOverride.value.hasManualOverride, false);

    const resultado = getMaximumHitPoints(comOverride, contexto);
    assert.equal(resultado.value.hasManualOverride, true);
    // O ajuste manual é uma decisão EXPLÍCITA do usuário e vence (grupo
    // `manual` do motor de efeitos, Task 15) — mesma semântica de
    // getHitPointProjection.
    assert.equal(resultado.value.maximum, 999);
    // Mas a derivação pura continua disponível e intocada: é ela que prova que
    // o motor não congelou nada.
    assert.equal(resultado.value.base, 14);
    assert.equal(comOverride.overrides['hp.maximum'].value, 999, 'o override não é reescrito');
  });

  test('sem context.registry devolve Result de erro, nunca TypeError cru', () => {
    // Important 2 da revisão: as outras funções do módulo guardavam o registry
    // e esta deixava `collectCharacterEffects` LANÇAR.
    const alvo = personagem('dnd2024:class:barbaro', {
      level: 1,
      hitPointRolls: [{ level: 1, rolled: 12, method: 'fixed' }],
    });
    let resultado;
    assert.doesNotThrow(() => {
      resultado = getMaximumHitPoints(alvo, {});
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PROGRESSION_REGISTRY_REQUIRED');
  });

  test('sem histórico: erro explícito, nunca a média presumida', () => {
    const alvo = personagem('dnd2024:class:barbaro', { level: 5 });
    const resultado = getMaximumHitPoints(alvo, contexto);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'PROGRESSION_HIT_POINT_ROLLS_MISSING');
  });

  test('`base` alimenta getHitPointProjection sem contar os efeitos duas vezes', () => {
    const alvo = personagem('dnd2024:class:barbaro', {
      level: 2,
      abilities: { forca: 10, destreza: 10, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 10 },
      hitPointRolls: [
        { level: 1, rolled: 12, method: 'fixed' },
        { level: 2, rolled: 7, method: 'average' },
      ],
      hitPoints: { current: 10, temporary: 0 },
      hitDice: { used: 0 },
    });
    const derivado = getMaximumHitPoints(alvo, contexto).value;
    const projecao = getHitPointProjection(alvo, { ...contexto, maximumHitPoints: derivado.base });
    assert.equal(projecao.ok, true);
    // Sem efeito de conteúdo sobre hp.maximum neste personagem, os dois batem;
    // o contrato que este teste trava é QUAL campo se repassa.
    assert.equal(projecao.value.maximum, derivado.maximum);
  });
});
