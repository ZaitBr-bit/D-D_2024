// ============================================================
// `features/sheet/spellcasting-table.js` (Task 33 — correção de fiação): o
// PRODUTOR de `context.spellcasting` em produção.
//
// O defeito que este módulo fecha: até a Task 33 o único produtor desses
// números era o harness de teste, injetando-os à mão por `projectionContext`.
// Um composition root de produção não tinha o que injetar ali, então TODO
// conjurador veria os espaços de magia como desconhecidos.
//
// O catálogo usado aqui é o REAL (`dados/pacotes/dnd2024`), carregado pelo
// mesmo composition root de conteúdo do app: um dublê provaria só que o módulo
// sabe ler o dublê. O que precisa ser provado é que a tabela derivada do
// catálogo bate com a tabela LEGADA (`dados/classes/*.json#tabela_caracteristicas`)
// — a mesma âncora que o baseline usa.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAppContext } from '../../../site/js/app-context.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { buildSpellcastingTable, createSpellcastingTableProducer } from '../../../site/js/features/sheet/spellcasting-table.js';
import { createDiskFetch } from '../../helpers/disk-fetch.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const NOW = '2026-08-04T00:00:00.000Z';

/** @type {object} */
let registry;

/**
 * Personagem canônico mínimo com classe e nível.
 * @param {string} classId - ContentId da classe.
 * @param {number} level - nível do personagem.
 * @returns {object}
 */
function personagem(classId, level) {
  const base = createEmptyCharacter({ id: 'pers-onagem-0001', now: NOW, rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    build: Object.freeze({ ...base.build, classRef: Object.freeze({ id: classId, packageVersion: '1.0.0' }) }),
    state: Object.freeze({ ...base.state, level }),
  });
}

/**
 * Linha da tabela LEGADA da classe (o oráculo do baseline).
 * @param {string} arquivo - nome do arquivo em `dados/classes`.
 * @param {number} level - nível.
 * @returns {Promise<object>}
 */
async function linhaLegada(arquivo, level) {
  const dados = JSON.parse(await readFile(path.join(repoRoot, 'dados/classes', arquivo), 'utf8'));
  const linha = (dados.tabela_caracteristicas ?? []).find((entrada) => Number.parseInt(entrada['Nível'], 10) === level);
  assert.ok(linha, `${arquivo}: nível ${level} ausente na tabela legada`);
  return linha;
}

/**
 * Converte a linha legada nos MESMOS números que `slotMaximums` carrega
 * (exatamente o que `utils.js#getEspacosMagia` faz).
 * @param {object} linha - linha da tabela legada.
 * @returns {Record<string, number>}
 */
function espacosLegados(linha) {
  const espacos = {};
  for (let circulo = 1; circulo <= 9; circulo += 1) {
    const valor = linha[String(circulo)];
    if (valor && valor !== '—' && valor !== '-') {
      espacos[String(circulo)] = Number.parseInt(valor, 10) || 0;
    }
  }
  return espacos;
}

before(async () => {
  const { fetchFn } = createDiskFetch();
  const appContext = createAppContext({ fetchFn });
  const conteudo = await appContext.initializeContent();
  assert.equal(conteudo.ok, true, conteudo.ok ? '' : conteudo.error.code);
  registry = conteudo.value;
});

describe('unit/sheet/spellcasting-table — paridade com a tabela legada', () => {
  test('Clérigo nível 5: espaços, truques e preparadas batem com a tabela legada', async () => {
    const tabela = buildSpellcastingTable(personagem('dnd2024:class:clerigo', 5), { registry });
    assert.equal(tabela.ok, true, tabela.ok ? '' : tabela.error.code);
    const linha = await linhaLegada('clerigo.json', 5);
    assert.deepEqual({ ...tabela.value.slotMaximums }, espacosLegados(linha));
    assert.equal(tabela.value.cantripsKnown, Number.parseInt(linha['Truques'], 10));
    assert.equal(tabela.value.preparedLimit, Number.parseInt(linha['Magias Preparadas'], 10));
  });

  test('Mago nível 20: os nove círculos batem com a tabela legada', async () => {
    const tabela = buildSpellcastingTable(personagem('dnd2024:class:mago', 20), { registry });
    assert.equal(tabela.ok, true, tabela.ok ? '' : tabela.error.code);
    const linha = await linhaLegada('mago.json', 20);
    assert.deepEqual({ ...tabela.value.slotMaximums }, espacosLegados(linha));
  });

  test('Bruxo: os espaços de PACTO chegam nos mesmos círculos que a tabela legada preenche', async () => {
    // O Bruxo é a única classe cujos espaços não são efeitos `spell-slot-N`.
    // A tabela legada os escreve nas MESMAS colunas "1".."9"; a matriz de
    // progressão funde `pact-magic-slots` nos mesmos círculos. Sem esta
    // coincidência estrutural, o Bruxo abriria a ficha sem espaço nenhum.
    for (const nivel of [1, 5, 11, 20]) {
      const tabela = buildSpellcastingTable(personagem('dnd2024:class:bruxo', nivel), { registry });
      assert.equal(tabela.ok, true, tabela.ok ? '' : tabela.error.code);
      const linha = await linhaLegada('bruxo.json', nivel);
      assert.deepEqual({ ...tabela.value.slotMaximums }, espacosLegados(linha), `bruxo nível ${nivel}`);
    }
  });

  test('todos os NÍVEIS de todas as classes conjuradoras convergem com a tabela legada', async () => {
    // Amostra única esconde erro de faixa (`when.min`/`max`): a varredura é
    // exaustiva de propósito.
    const classes = [
      ['dnd2024:class:clerigo', 'clerigo.json'],
      ['dnd2024:class:druida', 'druida.json'],
      ['dnd2024:class:mago', 'mago.json'],
      ['dnd2024:class:feiticeiro', 'feiticeiro.json'],
      ['dnd2024:class:bardo', 'bardo.json'],
      ['dnd2024:class:paladino', 'paladino.json'],
      ['dnd2024:class:guardiao', 'guardiao.json'],
      ['dnd2024:class:bruxo', 'bruxo.json'],
    ];
    const falhas = [];
    let verificados = 0;
    for (const [classId, arquivo] of classes) {
      for (let nivel = 1; nivel <= 20; nivel += 1) {
        const tabela = buildSpellcastingTable(personagem(classId, nivel), { registry });
        if (tabela.ok !== true) {
          falhas.push(`${classId} nível ${nivel}: ${tabela.error.code}`);
          continue;
        }
        const linha = await linhaLegada(arquivo, nivel);
        verificados += 1;
        try {
          assert.deepEqual({ ...tabela.value.slotMaximums }, espacosLegados(linha));
        } catch {
          falhas.push(`${classId} nível ${nivel}: espaços divergentes`);
        }
      }
    }
    assert.deepEqual(falhas, []);
    assert.equal(verificados, classes.length * 20);
  });
});

describe('unit/sheet/spellcasting-table — ausência nunca vira zero', () => {
  test('classe que NÃO declara conjuração devolve null, não uma tabela vazia', () => {
    const tabela = buildSpellcastingTable(personagem('dnd2024:class:guerreiro', 5), { registry });
    assert.equal(tabela.ok, true, tabela.ok ? '' : tabela.error.code);
    // `null` = "não há tabela de conjuração". Uma tabela com `slotMaximums: {}`
    // afirmaria "zero espaços de 1º círculo", que é uma alegação de jogo
    // diferente — e faria `cast-spell` recusar com a mensagem errada.
    assert.equal(tabela.value, null);
  });

  test('personagem SEM classe devolve null', () => {
    const base = createEmptyCharacter({ id: 'pers-onagem-0002', now: NOW, rulesetRef: RULESET_REF });
    const tabela = buildSpellcastingTable(base, { registry });
    assert.equal(tabela.ok, true);
    assert.equal(tabela.value, null);
  });

  test('Paladino não tem truque: cantripsKnown fica null, nunca 0', () => {
    const tabela = buildSpellcastingTable(personagem('dnd2024:class:paladino', 5), { registry });
    assert.equal(tabela.ok, true, tabela.ok ? '' : tabela.error.code);
    assert.equal(tabela.value.cantripsKnown, null);
    assert.ok(Number.isInteger(tabela.value.preparedLimit));
  });
});

describe('unit/sheet/spellcasting-table — recusa explícita', () => {
  test('sem catálogo, RECUSA com erro nomeado em vez de devolver tabela vazia', () => {
    const tabela = buildSpellcastingTable(personagem('dnd2024:class:clerigo', 5), {});
    assert.equal(tabela.ok, false);
    assert.equal(tabela.error.code, 'SHEET_SPELLCASTING_TABLE_REGISTRY_REQUIRED');
  });

  test('nível fora de 1..20 RECUSA com erro nomeado', () => {
    const tabela = buildSpellcastingTable(personagem('dnd2024:class:clerigo', 0), { registry });
    assert.equal(tabela.ok, false);
    assert.equal(tabela.error.code, 'SHEET_SPELLCASTING_TABLE_LEVEL_INVALID');
  });

  test('o produtor exige registry na construção (falha cedo, no composition root)', () => {
    assert.throws(() => createSpellcastingTableProducer({}), TypeError);
  });

  test('o produtor devolve o MESMO Result de buildSpellcastingTable', () => {
    const produtor = createSpellcastingTableProducer({ registry });
    const personagemClerigo = personagem('dnd2024:class:clerigo', 5);
    assert.deepEqual(produtor(personagemClerigo), buildSpellcastingTable(personagemClerigo, { registry }));
  });
});
