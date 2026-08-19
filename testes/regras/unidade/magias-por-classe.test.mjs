// ============================================================
// Domínio Magias, Plano 2: as listas de magia por classe.
//
// O app guarda a mesma informação em QUATRO lugares. O Plano 1 confrontou
// três (os arquivos por círculo, `_indice.json` e `por_classe/*.json`); este
// acrescenta o quarto -- `dados/classes/magias_<classe>.json` --, que é
// justamente o que as TELAS usam: creator/passo-magias.js:41,
// levelup-ui.js:960 e :1058, sheet/magias.js:277, sheet/classes/bruxo.js:228.
//
// Duas asserções distintas, e a segunda é a que pega bug:
//   1. PERTENCIMENTO -- quais magias cada classe tem. As quatro concordam
//      (987 entradas, medido no pré-voo).
//   2. CÍRCULO -- em qual GRUPO cada magia está na quarta fonte. Aqui o grupo
//      é a única coisa que a tela lê: `achatarMagiasClasse`
//      (sheet/magias.js:251-265) SOBRESCREVE o círculo da magia com o do
//      grupo. Uma magia no grupo errado vira uma magia de círculo errado na
//      tela, e o jogador pode preparar cedo demais.
//
// O que este motor NÃO cobre: preparo e limites (Plano 3), ritual /
// concentração / círculo superior (Plano 4).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, comLacuna } from './harness.mjs';
import { lerMagiasDoLivro } from '../catalogo/magias.mjs';

const LIVRO = lerMagiasDoLivro(
  readFileSync(join(RAIZ, 'Informacoes Separadas', 'Magias.md'), 'utf-8'));

const CLASSES = {
  bardo: 'Bardo', bruxo: 'Bruxo', clerigo: 'Clérigo', druida: 'Druida',
  feiticeiro: 'Feiticeiro', guardiao: 'Guardião', mago: 'Mago', paladino: 'Paladino',
};

/** As 391 magias com schema completo -- a fonte primária do Plano 1. */
const PRIMARIA = new Map();
for (const arquivo of readdirSync(join(RAIZ, 'dados', 'magias'))) {
  if (!/^(truques|circulo_\d)\.json$/.test(arquivo)) continue;
  const j = JSON.parse(readFileSync(join(RAIZ, 'dados', 'magias', arquivo), 'utf-8'));
  for (const m of (j.magias || j)) PRIMARIA.set(m.nome, m);
}

/**
 * Lê a quarta fonte, achatando os grupos e guardando o círculo DO GRUPO.
 * A derivação é a mesma de `achatarMagiasClasse` (sheet/magias.js:255-261):
 * o círculo sai do NOME DO GRUPO, nunca do campo da magia.
 */
function lerQuartaFonte(arquivo) {
  const j = JSON.parse(readFileSync(join(RAIZ, 'dados', 'classes', arquivo), 'utf-8'));
  const saida = [];
  for (const [grupo, lista] of Object.entries(j.lista_magias || {})) {
    const circuloDoGrupo = grupo === 'Truques' ? 0 : Number((grupo.match(/^(\d+)/) || [])[1]);
    for (const m of (lista || [])) {
      saida.push({ ...(typeof m === 'string' ? { nome: m } : m), grupo, circuloDoGrupo });
    }
  }
  return saida;
}

// CORRIGIDO em 2026-08-18 (Correção A): achatarMagiasClasse passou a tirar o
// círculo do acervo, e a entrada errada do Druida foi movida para o grupo
// certo. O mapa fica vazio de propósito -- a próxima entrada mal colocada
// entra aqui sem precisar reconstruir o mecanismo.
const CAUSA_CIRCULO_DO_GRUPO = {};

// CORRIGIDO em 2026-08-18 (Correção A): os cinco pares (arquivo de classe,
// magia) cujo marcador `especial` contradizia a `duracao` da própria magia
// foram acertados no dado, e o selo da tela passou a vir da DURAÇÃO em vez do
// marcador (creator/passo-magias.js). O conjunto fica vazio de propósito: era
// por PAR, e não por magia -- o mesmo nome aparece na lista de várias classes
// e o `especial` é escrito por arquivo --, então o próximo par divergente
// entra aqui sem precisar reconstruir o mecanismo.
const CAUSA_MARCADOR_C = new Set([]);

for (const [arquivo, classe] of Object.entries(CLASSES)) {
  const quarta = lerQuartaFonte(`magias_${arquivo}.json`);

  test(`sanity: magias_${arquivo}.json não está vazio`, () => {
    assert.ok(quarta.length > 0,
      `dados/classes/magias_${arquivo}.json não produziu entrada nenhuma -- se a estrutura ` +
      `mudou, este motor passa a afirmar sobre lista vazia, que é passar por vacuidade`);
  });

  test(`pertencimento × livro: ${classe}`, () => {
    const doLivro = [...LIVRO].filter(([, m]) => m.classes.includes(classe))
      .map(([n]) => n).sort();
    assert.deepEqual(quarta.map((m) => m.nome).sort(), doLivro,
      `dados/classes/magias_${arquivo}.json divergiu da lista de ${classe} no livro`);
  });

  test(`círculo do grupo × livro: ${classe}`, async () => {
    const corpo = () => {
      const errados = quarta
        .filter((m) => LIVRO.has(m.nome) && LIVRO.get(m.nome).circulo !== m.circuloDoGrupo)
        .map((m) => `${m.nome}: grupo "${m.grupo}" mas o livro diz ${LIVRO.get(m.nome).circulo}º`);
      assert.deepEqual(errados, [],
        `magia(s) no grupo de círculo errado em dados/classes/magias_${arquivo}.json. ` +
        `achatarMagiasClasse (sheet/magias.js:251-265) usa o GRUPO como círculo, então isso ` +
        `chega à tela: ${errados.join('; ')}`);
    };
    const causa = CAUSA_CIRCULO_DO_GRUPO[classe];
    if (causa) await comLacuna(causa.talento, causa.teste, corpo);
    else corpo();
  });

  test(`escola × livro: ${classe}`, () => {
    const errados = quarta
      .filter((m) => m.escola && LIVRO.has(m.nome) && LIVRO.get(m.nome).escola !== m.escola)
      .map((m) => `${m.nome}: "${m.escola}" != "${LIVRO.get(m.nome).escola}"`);
    assert.deepEqual(errados, [],
      `escola divergente em magias_${arquivo}.json: ${errados.join('; ')}`);
  });
}

// ============================================================
// O marcador `especial` da quarta fonte
// ============================================================
//
// `dados/classes/magias_<classe>.json` traz, por magia, um campo `especial`
// com os valores C, R, M e combinações ("C, R", "R, M", "C, M", "—"). Ele é
// dado DERIVADO: repete, em forma de sigla, fatos que a própria magia já
// declara em `duracao` e `tempo_conjuracao`. Dado derivado que ninguém
// confronta é onde este repositório já se machucou três vezes.
//
// LIMITE DECLARADO -- o `M` NÃO é confrontado aqui. Medidas as duas leituras
// possíveis contra as 987 entradas:
//   - "M = tem componente material":            389 divergências
//   - "M = material com custo ou consumido":     12 divergências (7 magias)
//
// A segunda é claramente a intenção, mas nenhuma regra derivável do texto
// chega a zero: sobram casos em que a fronteira é de julgamento, não de dado
// ("uma arma que vale 1 ou mais PP", que o jogador já possui, contra "um
// zircão de 1.000 PO que a magia consome"). Afirmar uma regra própria aqui
// seria codificar a MINHA leitura das convenções do livro num oráculo, e o
// oráculo passaria a medir isso em vez de medir o app. `C` e `R` não têm essa
// ambiguidade -- saem direto de `duracao` e `tempo_conjuracao` -- e são o que
// este bloco afirma.

for (const [arquivo, classe] of Object.entries(CLASSES)) {
  const quarta = lerQuartaFonte(`magias_${arquivo}.json`);

  test(`marcador R × tempo de conjuração: ${classe}`, () => {
    const errados = [];
    for (const m of quarta) {
      const P = PRIMARIA.get(m.nome);
      if (!P || m.especial === undefined) continue;
      const marcado = m.especial.split(',').map((x) => x.trim()).includes('R');
      const ehRitual = /ritual/i.test(P.tempo_conjuracao || '');
      if (marcado !== ehRitual) {
        errados.push(`${m.nome}: marcador R=${marcado}, tempo_conjuracao="${P.tempo_conjuracao}"`);
      }
    }
    assert.deepEqual(errados, [],
      `o marcador 'especial' contradiz o tempo de conjuração da magia em ` +
      `magias_${arquivo}.json: ${errados.join('; ')}`);
  });

  test(`marcador C × duração: ${classe}`, () => {
    const avaliar = (filtro) => {
      const errados = [];
      for (const m of quarta) {
        const P = PRIMARIA.get(m.nome);
        if (!P || m.especial === undefined) continue;
        if (!filtro(`${arquivo}|${m.nome}`)) continue;
        const marcado = m.especial.split(',').map((x) => x.trim()).includes('C');
        const exigeConc = /concentração/i.test(P.duracao || '');
        if (marcado !== exigeConc) {
          errados.push(`${m.nome}: marcador C=${marcado}, duracao="${P.duracao}"`);
        }
      }
      return errados;
    };
    // As magias sem causa registrada precisam bater normalmente.
    assert.deepEqual(avaliar((chave) => !CAUSA_MARCADOR_C.has(chave)), [],
      `o marcador 'especial' contradiz a duração da magia em magias_${arquivo}.json`);

  });
}
