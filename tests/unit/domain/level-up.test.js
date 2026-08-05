// Testes focais de `domain/progression/level-up.js` (Task 23), contra o
// CATÁLOGO REAL. Cobrem: projeção do próximo nível, validação de PV/ASI/
// subclasse, rollback TOTAL em seleção inválida, materialização de recursos
// por ContentId estruturado e a ausência de `override` espúrio de PV.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { createAppContext } from '../../../site/js/app-context.js';
import { createDiskFetch } from '../../helpers/disk-fetch.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { getLevelUpOptions, validateLevelUp, applyLevelUp, getMaximumHitPoints } from '../../../site/js/domain/progression/index.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';

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
 * Monta um bárbaro canônico no nível pedido, com histórico de PV completo.
 * @param {number} nivel
 * @param {object} [extra] - campos de `state` a sobrepor
 * @returns {object}
 */
function barbaro(nivel, extra = {}) {
  const base = createEmptyCharacter({ id: 'c1', now: '2026-01-01T00:00:00.000Z', rulesetRef: RULESET_REF });
  return {
    ...base,
    build: { ...base.build, classRef: { id: 'dnd2024:class:barbaro', packageVersion: '1.0.0' } },
    state: {
      ...base.state,
      level: nivel,
      abilities: { forca: 16, destreza: 12, constituicao: 14, inteligencia: 8, sabedoria: 10, carisma: 10 },
      hitPointRolls: Array.from({ length: nivel }, (_u, i) => ({
        level: i + 1,
        rolled: i === 0 ? 12 : 7,
        method: i === 0 ? 'fixed' : 'average',
      })),
      ...extra,
    },
  };
}

/** Seleção mínima válida (PV pela média) para o próximo nível. */
function selecaoMedia(character) {
  const opcoes = getLevelUpOptions(character, contexto).value;
  return { hitPoints: { rolled: opcoes.hitPoints.average, method: 'average' } };
}

describe('getLevelUpOptions', () => {
  test('exige registry e CanonicalCharacter', () => {
    assert.equal(getLevelUpOptions(barbaro(1), {}).error.code, 'LEVEL_UP_REGISTRY_REQUIRED');
    assert.equal(getLevelUpOptions(null, contexto).error.code, 'LEVEL_UP_CHARACTER_INVALID');
  });

  test('personagem sem classe não tem progressão a subir', () => {
    const base = createEmptyCharacter({ id: 'c9', now: '2026-01-01T00:00:00.000Z', rulesetRef: RULESET_REF });
    assert.equal(getLevelUpOptions(base, contexto).error.code, 'LEVEL_UP_CLASS_MISSING');
  });

  test('no nível 20 não há próximo nível', () => {
    assert.equal(getLevelUpOptions(barbaro(20), contexto).error.code, 'LEVEL_UP_AT_MAXIMUM');
  });

  test('projeta o dado de vida da classe pelo campo estruturado hitDie', () => {
    const opcoes = getLevelUpOptions(barbaro(1), contexto).value;
    assert.equal(opcoes.hitPoints.die, 12);
    assert.equal(opcoes.hitPoints.average, 7);
    assert.equal(opcoes.fromLevel, 1);
    assert.equal(opcoes.toLevel, 2);
  });

  test('exige subclasse no nível 3 (derivado do catálogo, não de NIVEL_SUBCLASSE)', () => {
    assert.equal(getLevelUpOptions(barbaro(1), contexto).value.requiresSubclass, false);
    assert.equal(getLevelUpOptions(barbaro(2), contexto).value.requiresSubclass, true);
  });

  test('não exige subclasse de novo quando o personagem já tem uma', () => {
    const comSubclasse = barbaro(2);
    const alvo = {
      ...comSubclasse,
      build: { ...comSubclasse.build, subclassRef: { id: 'dnd2024:subclass:trilha-do-berserker', packageVersion: '1.0.0' } },
    };
    assert.equal(getLevelUpOptions(alvo, contexto).value.requiresSubclass, false);
  });

  test('marca ASI no nível 4 e Dádiva Épica no 19', () => {
    assert.equal(getLevelUpOptions(barbaro(3), contexto).value.requiresAbilityScoreImprovement, true);
    assert.equal(getLevelUpOptions(barbaro(3), contexto).value.requiresEpicBoon, false);
    assert.equal(getLevelUpOptions(barbaro(18), contexto).value.requiresEpicBoon, true);
  });
});

describe('validateLevelUp — PV', () => {
  test('seleção sem hitPoints é recusada (o PV do nível não é inventado)', () => {
    assert.equal(validateLevelUp(barbaro(1), {}, contexto).error.code, 'LEVEL_UP_HIT_POINTS_REQUIRED');
  });

  test('método fora do enum é recusado', () => {
    const r = validateLevelUp(barbaro(1), { hitPoints: { rolled: 7, method: 'chute' } }, contexto);
    assert.equal(r.error.code, 'LEVEL_UP_HIT_POINT_METHOD_INVALID');
  });

  test('rolagem maior que o dado é recusada', () => {
    const r = validateLevelUp(barbaro(1), { hitPoints: { rolled: 13, method: 'roll' } }, contexto);
    assert.equal(r.error.code, 'LEVEL_UP_HIT_POINT_ROLL_OUT_OF_RANGE');
  });

  test('"média" com valor diferente da média do dado é recusada', () => {
    const r = validateLevelUp(barbaro(1), { hitPoints: { rolled: 12, method: 'average' } }, contexto);
    assert.equal(r.error.code, 'LEVEL_UP_HIT_POINT_AVERAGE_MISMATCH');
    assert.equal(r.error.context.expected, 7);
  });

  test('rolled null é recusado no level-up (histórico desconhecido não se cria aqui)', () => {
    const r = validateLevelUp(barbaro(1), { hitPoints: { rolled: null, method: 'roll' } }, contexto);
    assert.equal(r.error.code, 'LEVEL_UP_HIT_POINT_ROLL_INVALID');
  });

  test('histórico anterior incompleto reprova ANTES de acrescentar o nível', () => {
    const semHistorico = barbaro(1, { hitPointRolls: undefined });
    const r = validateLevelUp(semHistorico, { hitPoints: { rolled: 7, method: 'average' } }, contexto);
    assert.equal(r.error.code, 'PROGRESSION_HIT_POINT_ROLLS_MISSING');
  });
});

describe('validateLevelUp — subclasse e ASI', () => {
  test('nível de subclasse sem subclassRef é recusado', () => {
    const r = validateLevelUp(barbaro(2), selecaoMedia(barbaro(2)), contexto);
    assert.equal(r.error.code, 'LEVEL_UP_SUBCLASS_REQUIRED');
  });

  test('subclasse de OUTRA classe é recusada', () => {
    const selecao = { ...selecaoMedia(barbaro(2)), subclassRef: { id: 'dnd2024:subclass:colegio-da-danca', packageVersion: '1.0.0' } };
    const r = validateLevelUp(barbaro(2), selecao, contexto);
    assert.equal(r.error.code, 'LEVEL_UP_SUBCLASS_WRONG_CLASS');
  });

  test('subclassRef em nível que não concede subclasse é recusado', () => {
    const selecao = { ...selecaoMedia(barbaro(1)), subclassRef: { id: 'dnd2024:subclass:trilha-do-berserker', packageVersion: '1.0.0' } };
    assert.equal(validateLevelUp(barbaro(1), selecao, contexto).error.code, 'LEVEL_UP_SUBCLASS_NOT_EXPECTED');
  });

  test('nível de ASI exige EXATAMENTE uma escolha entre atributo e talento', () => {
    const base = selecaoMedia(barbaro(3));
    assert.equal(validateLevelUp(barbaro(3), base, contexto).error.code, 'LEVEL_UP_ASI_OR_FEAT_REQUIRED');
    const ambos = { ...base, abilityScoreImprovement: { forca: 2 }, featChoice: { featRef: 'dnd2024:feat:alerta' } };
    assert.equal(validateLevelUp(barbaro(3), ambos, contexto).error.code, 'LEVEL_UP_ASI_OR_FEAT_REQUIRED');
  });

  test('ASI distribui exatamente 2 pontos', () => {
    const base = selecaoMedia(barbaro(3));
    assert.equal(
      validateLevelUp(barbaro(3), { ...base, abilityScoreImprovement: { forca: 1 } }, contexto).error.code,
      'LEVEL_UP_ASI_TOTAL_INVALID',
    );
    assert.equal(validateLevelUp(barbaro(3), { ...base, abilityScoreImprovement: { forca: 1, destreza: 1 } }, contexto).ok, true);
  });

  test('ASI respeita o teto de 20', () => {
    const noTeto = barbaro(3, {
      abilities: { forca: 19, destreza: 12, constituicao: 14, inteligencia: 8, sabedoria: 10, carisma: 10 },
    });
    const r = validateLevelUp(noTeto, { ...selecaoMedia(noTeto), abilityScoreImprovement: { forca: 2 } }, contexto);
    assert.equal(r.error.code, 'LEVEL_UP_ASI_ABILITY_CAP');
    assert.equal(r.error.context.maximum, 20);
  });

  test('validateLevelUp REJEITA featChoice inválido, sem esperar o apply', () => {
    // Important 1 da revisão: `validateLevelUp` devolvia `ok` para qualquer
    // `featChoice`, delegando a validação real ao apply. Uma UI que use
    // `validateLevelUp` para habilitar o botão mostraria a seleção como válida
    // e só falharia ao confirmar.
    const base = selecaoMedia(barbaro(3));

    const inexistente = validateLevelUp(
      barbaro(3),
      { ...base, featChoice: { featRef: 'dnd2024:feat:nao-existe' } },
      contexto,
    );
    assert.equal(inexistente.ok, false);
    assert.equal(inexistente.error.code, 'FEAT_UNRESOLVED');

    const semEscolhaObrigatoria = validateLevelUp(
      barbaro(3),
      { ...base, featChoice: { featRef: 'dnd2024:feat:adepto-elemental' } },
      contexto,
    );
    assert.equal(semEscolhaObrigatoria.ok, false);
    assert.equal(semEscolhaObrigatoria.error.code, 'FEAT_CHOICE_REQUIRED');
  });

  test('validateLevelUp ACEITA featChoice válido e não muta nada', () => {
    const antes = barbaro(3);
    const copia = JSON.stringify(antes);
    const selecao = {
      ...selecaoMedia(antes),
      featChoice: { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia'] } },
    };
    const resultado = validateLevelUp(antes, selecao, contexto);
    assert.equal(resultado.ok, true, JSON.stringify(resultado.error ?? null));
    assert.equal(JSON.stringify(antes), copia, 'validar não pode ter efeito colateral');
  });

  test('o pré-requisito de nível do talento vale para o nível NOVO', () => {
    // "Adepto Elemental" exige nível 4. No level-up que leva do 3 ao 4 ele é
    // legítimo — validar contra o nível de origem o recusaria por engano.
    const selecao = {
      ...selecaoMedia(barbaro(3)),
      featChoice: { featRef: 'dnd2024:feat:adepto-elemental', choices: { 'aumento-atributo': ['inteligencia'] } },
    };
    assert.equal(validateLevelUp(barbaro(3), selecao, contexto).ok, true);
  });

  test('ASI em nível que não concede ASI é recusado', () => {
    const selecao = { ...selecaoMedia(barbaro(1)), abilityScoreImprovement: { forca: 2 } };
    assert.equal(validateLevelUp(barbaro(1), selecao, contexto).error.code, 'LEVEL_UP_ASI_NOT_EXPECTED');
  });
});

describe('applyLevelUp — contrato de comando e rollback total', () => {
  test('sucesso: nível, histórico e affected', () => {
    const antes = barbaro(1);
    const r = applyLevelUp(antes, selecaoMedia(antes), contexto);
    assert.equal(r.ok, true);
    assert.equal(r.character.state.level, 2);
    assert.deepEqual(r.character.state.hitPointRolls.at(-1), { level: 2, rolled: 7, method: 'average' });
    assert.equal(Array.isArray(r.affected), true);
    assert.equal(r.affected.includes('state.level'), true);
    assert.equal(r.affected.includes('state.hitPointRolls'), true);
    assert.equal(r.affected.includes('hp.maximum'), true);
    assert.equal(r.events[0].type, 'level-up');
  });

  test('não muta o personagem de entrada', () => {
    const antes = barbaro(1);
    const copia = JSON.stringify(antes);
    applyLevelUp(antes, selecaoMedia(antes), contexto);
    assert.equal(JSON.stringify(antes), copia);
  });

  test('falha devolve o personagem ORIGINAL e affected vazio (rollback TOTAL)', () => {
    const antes = barbaro(2); // exige subclasse
    const r = applyLevelUp(antes, selecaoMedia(antes), contexto);
    assert.equal(r.ok, false);
    assert.equal(r.character, antes, 'o personagem devolvido tem de ser o mesmo objeto original');
    assert.deepEqual(r.affected, []);
    assert.deepEqual(r.events, []);
  });

  test('talento inválido no nível de ASI não deixa o nível meio subido', () => {
    const antes = barbaro(3);
    const selecao = { ...selecaoMedia(antes), featChoice: { featRef: 'dnd2024:feat:nao-existe' } };
    const r = applyLevelUp(antes, selecao, contexto);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'FEAT_UNRESOLVED');
    assert.equal(r.character.state.level, 3, 'o nível NÃO pode ter sido incrementado');
    assert.equal(r.character.state.hitPointRolls.length, 3, 'nenhuma rolagem foi acrescentada');
    assert.deepEqual(r.affected, []);
  });

  test('NUNCA cria overrides["hp.maximum"] — o máximo continua derivado', () => {
    let atual = barbaro(1);
    for (let nivel = 2; nivel <= 5; nivel += 1) {
      const opcoes = getLevelUpOptions(atual, contexto).value;
      const selecao = { hitPoints: { rolled: opcoes.hitPoints.average, method: 'average' } };
      if (opcoes.requiresSubclass) {
        selecao.subclassRef = { id: 'dnd2024:subclass:trilha-do-berserker', packageVersion: '1.0.0' };
      }
      if (opcoes.requiresAbilityScoreImprovement) {
        selecao.abilityScoreImprovement = { constituicao: 2 };
      }
      const r = applyLevelUp(atual, selecao, contexto);
      assert.equal(r.ok, true, `nível ${nivel}: ${JSON.stringify(r.error ?? null)}`);
      atual = r.character;
      assert.equal(
        Object.hasOwn(atual.overrides ?? {}, 'hp.maximum'),
        false,
        `o level-up para ${nivel} criou um override espúrio de PV`,
      );
    }
    assert.equal(atual.state.level, 5);
    // 12 + 7×4 = 40 de rolagens; Constituição 16 (14 + ASI) => +3 × 5 = 15.
    const pv = getMaximumHitPoints(atual, contexto).value;
    assert.equal(pv.fromRolls, 40);
    assert.equal(pv.fromConstitution, 15);
    assert.equal(pv.maximum, 55);
    assert.equal(pv.hasManualOverride, false);
  });

  test('materializa recursos novos por ContentId estruturado e sourceInstanceId', () => {
    const antes = barbaro(1);
    const r = applyLevelUp(antes, selecaoMedia(antes), contexto);
    assert.equal(r.ok, true);
    const recursos = r.character.state.resources;
    assert.equal(Object.hasOwn(recursos, 'dnd2024:resource:furias'), true);
    assert.equal(Number.isInteger(recursos['dnd2024:resource:furias'].current), true);
    assert.match(recursos['dnd2024:resource:furias'].sourceInstanceId, /^source:/);
    // Nenhum recurso é inferido por nome de característica.
    for (const chave of Object.keys(recursos)) {
      assert.match(chave, /^[a-z0-9-]+:resource:[a-z0-9-]+$/);
    }
  });
});

describe('applyLevelUp — via executeCharacterCommand (dispatcher da Task 17)', () => {
  test('o dispatcher conhece "level-up" e devolve o Command contract', () => {
    const antes = barbaro(1);
    const r = executeCharacterCommand(antes, { type: 'level-up', selection: selecaoMedia(antes) }, contexto);
    assert.equal(r.ok, true);
    assert.equal(r.character.state.level, 2);
    assert.equal(Array.isArray(r.affected), true);
  });

  test('falha pelo dispatcher também traz affected: []', () => {
    const antes = barbaro(2);
    const r = executeCharacterCommand(antes, { type: 'level-up', selection: {} }, contexto);
    assert.equal(r.ok, false);
    assert.deepEqual(r.affected, []);
    assert.equal(r.character, antes);
  });

  test('sem context.registry o comando falha com erro estruturado, não com um level-up "quase certo"', () => {
    const antes = barbaro(1);
    const r = executeCharacterCommand(antes, { type: 'level-up', selection: selecaoMedia(antes) }, {});
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'LEVEL_UP_REGISTRY_REQUIRED');
  });
});

describe('applyLevelUp — sem multiclasse (checklist do brief)', () => {
  test('o level-up sobe a classe existente e nunca acrescenta uma segunda', () => {
    const antes = barbaro(1);
    const r = applyLevelUp(antes, selecaoMedia(antes), contexto);
    assert.equal(r.ok, true);
    assert.deepEqual(r.character.build.classRef, antes.build.classRef);
    assert.equal(Object.hasOwn(r.character.build, 'classRefs'), false);
  });
});
