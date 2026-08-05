// Contrato: o level-up do domínio (Task 23) sobrevive a um ciclo REAL de
// save -> load (Decisão A).
//
// Este teste existe por causa do Concern C2 do relatório da Task 23: antes da
// Decisão A, `state.hitPointRolls` só existia em memória — o codec não tinha
// canal para ele, e um personagem que subisse de nível e fosse salvo perdia o
// histórico, fazendo `getMaximumHitPoints` falhar com
// PROGRESSION_HIT_POINT_ROLLS_MISSING no carregamento seguinte. O domínio de
// progressão era, na prática, inutilizável em produção.
//
// O ciclo aqui é o real, não um mock: `encodeCharacterRecord` ->
// `decodeCharacterRecord`, com o mesmo `aliasResolver` do runtime, sobre o
// catálogo oficial ativado pelo composition root.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAppContext } from '../../site/js/app-context.js';
import { createDiskFetch } from '../helpers/disk-fetch.js';
import { createLegacyAliasResolver } from '../../site/js/infra/character/legacy-alias-resolver.js';
import { decodeCharacterRecord, encodeCharacterRecord } from '../../site/js/infra/character/character-codec.js';
import { createEmptyCharacter } from '../../site/js/domain/character/model.js';
import { getLevelUpOptions, applyLevelUp, getMaximumHitPoints } from '../../site/js/domain/progression/index.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const NOW = '2026-07-30T00:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

let codecCtx;
let progressionCtx;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  codecCtx = { aliasResolver: createLegacyAliasResolver(aliases), now: NOW };

  const { fetchFn } = createDiskFetch();
  const ativacao = await createAppContext({ fetchFn }).initializeContent();
  assert.equal(ativacao.ok, true, `ativação do catálogo falhou: ${JSON.stringify(ativacao.error ?? null)}`);
  progressionCtx = { registry: ativacao.value };
});

/** Bárbaro nível 1 com histórico de PV inicial. */
function barbaroNivel1() {
  const base = createEmptyCharacter({ id: 'persist-1', now: NOW, rulesetRef: RULESET_REF });
  return {
    ...base,
    identity: { ...base.identity, name: 'Grog' },
    build: { ...base.build, classRef: { id: 'dnd2024:class:barbaro', packageVersion: '1.0.0' } },
    state: {
      ...base.state,
      level: 1,
      abilities: { forca: 16, destreza: 12, constituicao: 14, inteligencia: 8, sabedoria: 10, carisma: 10 },
      hitPointRolls: [{ level: 1, rolled: 12, method: 'fixed' }],
    },
  };
}

/** Sobe um nível escolhendo média de PV (e subclasse/ASI quando exigidos). */
function subirUmNivel(character) {
  const opcoes = getLevelUpOptions(character, progressionCtx);
  assert.equal(opcoes.ok, true, JSON.stringify(opcoes.error ?? null));
  const selecao = { hitPoints: { rolled: opcoes.value.hitPoints.average, method: 'average' } };
  if (opcoes.value.requiresSubclass) {
    selecao.subclassRef = { id: 'dnd2024:subclass:trilha-do-berserker', packageVersion: '1.0.0' };
  }
  if (opcoes.value.requiresAbilityScoreImprovement) {
    selecao.abilityScoreImprovement = { constituicao: 2 };
  }
  const resultado = applyLevelUp(character, selecao, progressionCtx);
  assert.equal(resultado.ok, true, JSON.stringify(resultado.error ?? null));
  return resultado.character;
}

describe('contract/level-up-persistence — o histórico de PV sobrevive a save -> load', () => {
  test('subir 2 níveis, salvar, carregar: histórico e PV máximo recomputado batem', () => {
    let personagem = barbaroNivel1();
    personagem = subirUmNivel(personagem); // -> nível 2
    personagem = subirUmNivel(personagem); // -> nível 3 (exige subclasse)

    assert.equal(personagem.state.level, 3);
    const pvAntes = getMaximumHitPoints(personagem, progressionCtx);
    assert.equal(pvAntes.ok, true, JSON.stringify(pvAntes.error ?? null));
    // 12 + 7 + 7 = 26 de rolagens; Constituição 14 (mod +2) × 3 níveis = 6.
    assert.equal(pvAntes.value.fromRolls, 26);
    assert.equal(pvAntes.value.fromConstitution, 6);
    assert.equal(pvAntes.value.maximum, 32);

    // --- SAVE ---
    const registro = encodeCharacterRecord(personagem, codecCtx);
    assert.equal(registro.ok, true, JSON.stringify(registro.error ?? null));
    assert.deepEqual(registro.value.pv_rolagens, [
      { level: 1, rolled: 12, method: 'fixed' },
      { level: 2, rolled: 7, method: 'average' },
      { level: 3, rolled: 7, method: 'average' },
    ]);
    // O registro atravessa a persistência como JSON puro.
    const serializado = JSON.parse(JSON.stringify(registro.value));

    // --- LOAD ---
    const carregado = decodeCharacterRecord(serializado, codecCtx);
    assert.equal(carregado.ok, true, JSON.stringify(carregado.error ?? null));
    assert.deepEqual(carregado.value.character.state.hitPointRolls, personagem.state.hitPointRolls);
    assert.equal(carregado.value.character.state.level, 3);

    // O PV máximo é RECOMPUTADO do histórico carregado — não lido de um valor
    // congelado no registro — e dá exatamente o mesmo.
    const pvDepois = getMaximumHitPoints(carregado.value.character, progressionCtx);
    assert.equal(pvDepois.ok, true, JSON.stringify(pvDepois.error ?? null));
    assert.equal(pvDepois.value.maximum, pvAntes.value.maximum);
    assert.equal(pvDepois.value.fromRolls, 26);
    assert.equal(pvDepois.value.hasManualOverride, false);
  });

  test('dá para continuar subindo de nível DEPOIS de recarregar', () => {
    let personagem = barbaroNivel1();
    personagem = subirUmNivel(personagem);

    const registro = encodeCharacterRecord(personagem, codecCtx);
    const carregado = decodeCharacterRecord(JSON.parse(JSON.stringify(registro.value)), codecCtx);
    assert.equal(carregado.ok, true);

    // Antes da Decisão A isto falhava com PROGRESSION_HIT_POINT_ROLLS_MISSING:
    // o histórico não tinha sobrevivido ao save.
    const continuado = subirUmNivel(carregado.value.character);
    assert.equal(continuado.state.level, 3);
    assert.equal(continuado.state.hitPointRolls.length, 3);
  });

  test('subir Constituição por ASI depois de recarregar recalcula RETROATIVAMENTE', () => {
    let personagem = barbaroNivel1();
    for (let nivel = 2; nivel <= 3; nivel += 1) {
      personagem = subirUmNivel(personagem);
    }
    const registro = encodeCharacterRecord(personagem, codecCtx);
    const carregado = decodeCharacterRecord(JSON.parse(JSON.stringify(registro.value)), codecCtx).value.character;

    // Nível 4 é de ASI: `subirUmNivel` sobe Constituição de 14 para 16.
    const nivel4 = subirUmNivel(carregado);
    const pv = getMaximumHitPoints(nivel4, progressionCtx).value;
    assert.equal(pv.fromRolls, 33); // 12 + 7 + 7 + 7
    assert.equal(pv.fromConstitution, 12); // mod +3 × 4 níveis, RETROATIVO
    assert.equal(pv.maximum, 45);
    // E nada disso criou um override espúrio de PV.
    assert.equal(Object.hasOwn(nivel4.overrides ?? {}, 'hp.maximum'), false);
  });

  test('personagem sem histórico continua falhando EXPLÍCITO depois do round-trip', () => {
    const semHistorico = (() => {
      const base = barbaroNivel1();
      const state = { ...base.state };
      delete state.hitPointRolls;
      return { ...base, state };
    })();
    const registro = encodeCharacterRecord(semHistorico, codecCtx);
    assert.equal(registro.ok, true);
    assert.equal(Object.hasOwn(registro.value, 'pv_rolagens'), false);

    const carregado = decodeCharacterRecord(JSON.parse(JSON.stringify(registro.value)), codecCtx).value.character;
    const pv = getMaximumHitPoints(carregado, progressionCtx);
    assert.equal(pv.ok, false);
    assert.equal(pv.error.code, 'PROGRESSION_HIT_POINT_ROLLS_MISSING');
  });
});
