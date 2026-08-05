// Contrato de PARIDADE da progressão (Task 23): a matriz derivada do catálogo
// por `domain/progression/progression-queries.js#getProgressionMatrix`
// reproduz, coluna a coluna, a `tabela_caracteristicas` dos arquivos de classe
// LEGADOS (`dados/classes/*.json`) — as 12 classes × os 20 níveis.
//
// ## Por que este teste é o gate da Decisão D
//
// A lacuna `tabela_caracteristicas (ausente na projeção)` de
// `infra/content/legacy-db-projection.js` só pode ser fechada "por remoção do
// consumidor" se houver prova de que o domínio entrega os MESMOS números que o
// consumidor lia da tabela legada. Sem esta prova, migrar `levelup.js` &
// companhia seria trocar uma fonte por outra na esperança de que batessem.
//
// O oráculo é o arquivo legado real, não uma fixture reduzida: uma paridade
// medida numa classe só (padrão de bug (d) deste projeto) esconderia
// exatamente os casos difíceis — o Bruxo, cujos espaços NÃO são efeitos
// `resource` mas uma tabela dentro de `params` do marcador `pact-magic-slots`
// (foi assim que as 20 divergências do Bruxo apareceram, e foi por isso que
// `pactMagicSlots` passou a existir).
//
// Fora de escopo por decisão explícita (ver relatório, Decisão D): as colunas
// de APRESENTAÇÃO da tabela legada — "Características de Classe" (nomes de
// exibição unidos por vírgula, na ordem do markdown) e os rótulos de coluna,
// que variam por classe ("Características de Classe" no Bárbaro vs
// "Características" no Feiticeiro). Não são deriváveis de campo estruturado e
// não são o que os consumidores calculam.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAppContext } from '../../site/js/app-context.js';
import { createDiskFetch } from '../helpers/disk-fetch.js';
import { createEmptyCharacter } from '../../site/js/domain/character/model.js';
import { getProgressionMatrix, MAX_LEVEL } from '../../site/js/domain/progression/index.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const legacyClassesDir = path.join(repoRoot, 'dados/classes');
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

let registry;
let contexto;
let classesLegadas;

before(async () => {
  const { fetchFn } = createDiskFetch();
  const ativacao = await createAppContext({ fetchFn }).initializeContent();
  assert.equal(ativacao.ok, true, `ativação do catálogo falhou: ${JSON.stringify(ativacao.error ?? null)}`);
  registry = ativacao.value;
  contexto = { registry };

  // Os 12 arquivos de classe legados (os `magias_*.json` são listas de magia).
  const nomes = (await readdir(legacyClassesDir)).filter(
    (nome) => nome.endsWith('.json') && !nome.startsWith('magias_'),
  );
  classesLegadas = new Map();
  for (const nome of nomes) {
    const slug = nome.replace('.json', '');
    classesLegadas.set(slug, JSON.parse(await readFile(path.join(legacyClassesDir, nome), 'utf8')));
  }
});

// --- Leitores da tabela legada --------------------------------------------
//
// Cópias EXATAS de `site/js/utils.js#getEspacosMagia/getTruquesConhecidos/
// getMagiaPreparadas` — os três helpers que os consumidores usam hoje. São
// reproduzidos aqui (em vez de importados) porque `site/js/utils.js` toca
// `window` no topo do módulo e não carrega sob Node; copiar mantém o oráculo
// fiel ao que a produção realmente calcula.

/** Espaços de magia por círculo, como `utils.js#getEspacosMagia` os lê. */
function espacosLegado(tabela, nivel) {
  if (!tabela || nivel < 1) return {};
  const linha = tabela.find((r) => Number.parseInt(r['Nível'], 10) === nivel);
  if (!linha) return {};
  const espacos = {};
  for (let circulo = 1; circulo <= 9; circulo += 1) {
    const valor = linha[String(circulo)];
    if (valor && valor !== '—' && valor !== '-') {
      espacos[circulo] = Number.parseInt(valor, 10) || 0;
    }
  }
  return espacos;
}

/** Truques conhecidos, como `utils.js#getTruquesConhecidos` os lê. */
function truquesLegado(tabela, nivel) {
  if (!tabela) return 0;
  const linha = tabela.find((r) => Number.parseInt(r['Nível'], 10) === nivel);
  return linha ? Number.parseInt(linha['Truques'], 10) || 0 : 0;
}

/** Magias preparadas, como `utils.js#getMagiaPreparadas` as lê. */
function preparadasLegado(tabela, nivel) {
  if (!tabela) return 0;
  const linha = tabela.find((r) => Number.parseInt(r['Nível'], 10) === nivel);
  return linha ? Number.parseInt(linha['Magias Preparadas'], 10) || 0 : 0;
}

/** Bônus de proficiência legado ("+2") como inteiro. */
function proficienciaLegado(tabela, nivel) {
  const linha = tabela.find((r) => Number.parseInt(r['Nível'], 10) === nivel);
  return linha ? Number.parseInt(String(linha['Bônus de Proficiência']).replace('+', ''), 10) : null;
}

/** Personagem canônico mínimo da classe, no nível 20 (a matriz cobre 1..20). */
function personagemDe(slug) {
  const base = createEmptyCharacter({ id: 'parity', now: '2026-01-01T00:00:00.000Z', rulesetRef: RULESET_REF });
  return {
    ...base,
    build: { ...base.build, classRef: { id: `dnd2024:class:${slug}`, packageVersion: '1.0.0' } },
    state: { ...base.state, level: MAX_LEVEL },
  };
}

/** Matriz do domínio para a classe, já desembrulhada. */
function matrizDe(slug) {
  const resultado = getProgressionMatrix(personagemDe(slug), contexto);
  assert.equal(resultado.ok, true, `${slug}: ${JSON.stringify(resultado.error ?? null)}`);
  return resultado.value;
}

describe('level-up parity — o oráculo legado está carregado de verdade', () => {
  test('os 12 arquivos de classe legados foram lidos e têm tabela_caracteristicas', () => {
    assert.equal(classesLegadas.size, 12);
    for (const [slug, dados] of classesLegadas) {
      assert.equal(Array.isArray(dados.tabela_caracteristicas), true, `${slug} sem tabela_caracteristicas`);
      assert.equal(dados.tabela_caracteristicas.length, 20, `${slug}: a tabela legada deve ter 20 linhas`);
    }
  });
});

describe('level-up parity — bônus de proficiência (12 classes × 20 níveis)', () => {
  test('a matriz reproduz a coluna "Bônus de Proficiência" da tabela legada', () => {
    const divergencias = [];
    for (const [slug, dados] of classesLegadas) {
      const matriz = matrizDe(slug);
      for (let nivel = 1; nivel <= MAX_LEVEL; nivel += 1) {
        const legado = proficienciaLegado(dados.tabela_caracteristicas, nivel);
        const dominio = matriz[nivel - 1].proficiencyBonus;
        if (legado !== dominio) {
          divergencias.push(`${slug} n${nivel}: legado ${legado} != domínio ${dominio}`);
        }
      }
    }
    assert.deepEqual(divergencias, []);
  });
});

describe('level-up parity — espaços de magia (12 classes × 20 níveis)', () => {
  test('a matriz reproduz as colunas 1..9 da tabela legada, inclusive a Magia de Pacto do Bruxo', () => {
    const divergencias = [];
    for (const [slug, dados] of classesLegadas) {
      const matriz = matrizDe(slug);
      for (let nivel = 1; nivel <= MAX_LEVEL; nivel += 1) {
        const legado = espacosLegado(dados.tabela_caracteristicas, nivel);
        const dominio = {};
        for (const [circulo, quantidade] of Object.entries(matriz[nivel - 1].spellSlots)) {
          dominio[Number(circulo)] = quantidade;
        }
        if (JSON.stringify(legado) !== JSON.stringify(dominio)) {
          divergencias.push(`${slug} n${nivel}: legado ${JSON.stringify(legado)} != domínio ${JSON.stringify(dominio)}`);
        }
      }
    }
    assert.deepEqual(divergencias, []);
  });

  test('o Bruxo tem espaços de Magia de Pacto em TODOS os 20 níveis', () => {
    // Guarda contra um falso verde: se `pactMagicSlots` parasse de ler a
    // tabela, `spellSlots` viraria `{}` nos 20 níveis e o teste acima só
    // reprovaria se o legado também estivesse vazio. Este caso afirma o
    // conteúdo positivo.
    const matriz = matrizDe('bruxo');
    for (const linha of matriz) {
      assert.equal(Object.keys(linha.spellSlots).length, 1, `Bruxo n${linha.level} deveria ter 1 círculo de pacto`);
    }
    assert.deepEqual(matriz[0].spellSlots, { 1: 1 });
    assert.deepEqual(matriz[19].spellSlots, { 5: 4 });
  });

  test('classe não conjuradora continua sem espaço nenhum nos dois lados', () => {
    for (const slug of ['barbaro', 'guerreiro', 'ladino', 'monge']) {
      const dados = classesLegadas.get(slug);
      const matriz = matrizDe(slug);
      for (let nivel = 1; nivel <= MAX_LEVEL; nivel += 1) {
        assert.deepEqual(espacosLegado(dados.tabela_caracteristicas, nivel), {});
        assert.deepEqual(matriz[nivel - 1].spellSlots, {});
      }
    }
  });
});

describe('level-up parity — truques e magias preparadas (12 classes × 20 níveis)', () => {
  test('a matriz reproduz a coluna "Truques" da tabela legada', () => {
    const divergencias = [];
    for (const [slug, dados] of classesLegadas) {
      const matriz = matrizDe(slug);
      for (let nivel = 1; nivel <= MAX_LEVEL; nivel += 1) {
        const legado = truquesLegado(dados.tabela_caracteristicas, nivel);
        const dominio = matriz[nivel - 1].resources['dnd2024:resource:truques'] ?? 0;
        if (legado !== dominio) {
          divergencias.push(`${slug} n${nivel}: legado ${legado} != domínio ${dominio}`);
        }
      }
    }
    assert.deepEqual(divergencias, []);
  });

  test('a matriz reproduz a coluna "Magias Preparadas" da tabela legada', () => {
    const divergencias = [];
    for (const [slug, dados] of classesLegadas) {
      const matriz = matrizDe(slug);
      for (let nivel = 1; nivel <= MAX_LEVEL; nivel += 1) {
        const legado = preparadasLegado(dados.tabela_caracteristicas, nivel);
        const dominio = matriz[nivel - 1].resources['dnd2024:resource:magias-preparadas'] ?? 0;
        if (legado !== dominio) {
          divergencias.push(`${slug} n${nivel}: legado ${legado} != domínio ${dominio}`);
        }
      }
    }
    assert.deepEqual(divergencias, []);
  });
});

describe('level-up parity — sem multiclasse (checklist do brief)', () => {
  test('a matriz é sempre de UMA classe: nenhuma linha mistura duas progressões', () => {
    // O modelo canônico tem `build.classRef` singular (não `classRefs`), então
    // a matriz não tem como somar duas progressões. Afirmado explicitamente
    // para que uma introdução futura de multiclasse não passe por aqui em
    // silêncio.
    const personagem = personagemDe('mago');
    assert.equal(Object.hasOwn(personagem.build, 'classRefs'), false);
    assert.equal(typeof personagem.build.classRef.id, 'string');
  });
});
