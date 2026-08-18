// ============================================================
// Todo literal de nome de subclasse escrito em site/js/ tem de ser um
// nome REAL de subclasse, dos 48 que dados/classes/*.json declara.
//
// Nasceu de um bug real (achado em 2026-08-18 pelo domínio Subclasses /
// Recursos): site/js/sheet/hp-descanso.js guardava a restauração de
// Descanso do Paladino com `char.subclasse === 'Juramento de Glória'`,
// mas o nome gravado no personagem, vindo de dados/classes/paladino.json,
// é 'Juramento DA Glória'. A comparação nunca era verdadeira e o bloco
// inteiro era código morto -- 3 das 4 trilhas de Juramento nunca
// restauravam recurso nenhum, em Descanso nenhum. O contraste que provou
// ser grafia e não mecanismo: 'Juramento dos Anciões', escrito certo,
// funcionava.
//
// A varredura é sintática e deliberadamente boba: qualquer literal
// comparado com `subclasse === '...'` ou `subclasse !== '...'` tem de
// estar entre os 48 nomes reais. É o tipo de erro que nenhuma revisão que
// LÊ o código pega -- os dois lados parecem certos isoladamente; só
// confrontar um contra o outro revela a divergência.
//
// O que ela NÃO garante: que a guarda esteja no bloco de Descanso certo,
// nem que zere o campo certo. Isso continua sendo trabalho do Grupo 5 de
// subclasses-recursos.test.mjs e do spec de navegador
// e2e/regras/subclasse-recursos-ficha.spec.mjs. Aqui o objetivo é só que
// nenhum literal aponte para uma subclasse que não existe.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RAIZ } from './harness.mjs';

/**
 * Lê os 48 nomes de subclasse declarados em dados/classes/*.json.
 * Ignora os arquivos magias_<classe>.json, que são listas de magia por
 * classe e não trazem o campo `subclasses`.
 */
function nomesReaisDeSubclasse() {
  const dir = join(RAIZ, 'dados', 'classes');
  const nomes = new Set();
  for (const arquivo of readdirSync(dir)) {
    if (!arquivo.endsWith('.json') || arquivo.startsWith('magias_')) continue;
    const json = JSON.parse(readFileSync(join(dir, arquivo), 'utf-8'));
    for (const sub of json.subclasses || []) {
      if (sub?.nome) nomes.add(sub.nome);
    }
  }
  return nomes;
}

/** Lista recursivamente todo arquivo .js sob site/js/. */
function listarJs(dir) {
  const saida = [];
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...listarJs(caminho));
    else if (entrada.endsWith('.js')) saida.push(caminho);
  }
  return saida;
}

/**
 * Encontra todo literal comparado com `subclasse === '...'` ou
 * `subclasse !== '...'` em site/js/, devolvendo { nome, arquivo, linha }.
 * Cobre `char.subclasse`, `p.subclasse`, `personagem.subclasse` etc. --
 * o que importa é a propriedade, não o objeto que a carrega.
 */
function literaisDeSubclasse() {
  const achados = [];
  for (const caminho of listarJs(join(RAIZ, 'site', 'js'))) {
    const texto = readFileSync(caminho, 'utf-8');
    const re = /subclasse\s*[!=]==\s*'([^']*)'/g;
    let m;
    while ((m = re.exec(texto)) !== null) {
      achados.push({
        nome: m[1],
        arquivo: relative(RAIZ, caminho).replace(/\\/g, '/'),
        linha: texto.slice(0, m.index).split('\n').length,
      });
    }
  }
  return achados;
}

const NOMES_REAIS = nomesReaisDeSubclasse();
const LITERAIS = literaisDeSubclasse();

test('sanity: dados/classes/*.json declara as 48 subclasses', () => {
  assert.equal(NOMES_REAIS.size, 48,
    `esperado 48 nomes de subclasse em dados/classes/*.json, achado ${NOMES_REAIS.size} -- ` +
    'se o número mudou de propósito, atualize este número; se não, algum arquivo de classe ' +
    'perdeu o campo subclasses');
});

test('sanity: a varredura encontra literais de subclasse em site/js/', () => {
  assert.ok(LITERAIS.length > 0,
    'nenhum literal `subclasse === \'...\'` encontrado em site/js/ -- o regex da varredura ' +
    'parou de casar (o app mudou de forma?), e o motor estaria passando verde sem olhar nada');
});

test('todo literal de subclasse em site/js/ corresponde a uma subclasse real', () => {
  const orfaos = LITERAIS.filter((l) => !NOMES_REAIS.has(l.nome));
  const detalhe = orfaos.map((l) => `${l.arquivo}:${l.linha} -> '${l.nome}'`).join('\n  ');
  assert.deepEqual(orfaos, [],
    'literal(is) de subclasse que nenhuma entrada de dados/classes/*.json declara -- ' +
    'a comparação nunca será verdadeira e o bloco guardado por ela é código morto:\n  ' +
    detalhe);
});
