// ============================================================
// Todo gatilho de tela NOVO precisa de um teste que o acione.
//
// Motivo, por escrito (2026-08-16): uma melhoria foi entregue sem que
// nenhum teste clicasse no botão dela. O código fazia parse, os testes de
// unidade importavam o módulo sem erro, e o spec do fluxo só afirmava que
// o botão APARECIA -- o `ReferenceError` dentro da função só apareceu para
// o usuário, ao clicar. "Desenvolver a melhoria e não testá-la" é a falha
// que este motor existe para tornar impossível de passar em silêncio.
//
// Como funciona: um gatilho (`id="btn-..."` ou `data-<x>-acao="..."` em
// `site/js/`) está coberto quando o identificador aparece em algum spec de
// `testes/e2e/`. A dívida histórica está congelada em
// `../gatilhos-sem-cobertura.mjs`; este motor só proíbe que ela cresça, e
// cobra a remoção do que já foi coberto.
//
// Ele NÃO garante que o teste seja bom -- garante que existe um teste que
// nomeia aquele gatilho. É a mesma barganha de `lacunas-conhecidas.mjs`:
// vale mais um piso que não afunda do que um ideal que ninguém sustenta.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './harness.mjs';
import { GATILHOS_SEM_COBERTURA } from '../gatilhos-sem-cobertura.mjs';

/** Todos os arquivos com a extensão pedida, recursivos, fora de `ignorar`. */
function listar(dir, extensao, ignorar = []) {
  const fora = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (ignorar.includes(entrada.name)) continue;
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) fora.push(...listar(caminho, extensao, ignorar));
    else if (entrada.name.endsWith(extensao)) fora.push(caminho);
  }
  return fora;
}

/** Gatilhos declarados no app, com o arquivo em que aparecem. */
function coletarGatilhos() {
  const mapa = new Map();
  for (const caminho of listar(join(RAIZ, 'site', 'js'), '.js', ['vendor'])) {
    const texto = readFileSync(caminho, 'utf-8');
    const registrar = (id) => {
      if (!mapa.has(id)) mapa.set(id, caminho);
    };
    for (const m of texto.matchAll(/\bid="(btn-[a-z0-9-]+)"/g)) registrar(m[1]);
    for (const m of texto.matchAll(/\bdata-([a-z-]*acao)="([a-z0-9-]+)"/g)) {
      registrar(`${m[1]}=${m[2]}`);
    }
  }
  return mapa;
}

const GATILHOS = coletarGatilhos();

const TEXTO_SPECS = listar(join(RAIZ, 'testes', 'e2e'), '.mjs', ['node_modules'])
  .map(caminho => readFileSync(caminho, 'utf-8'))
  .join('\n');

/**
 * Coberto = o identificador aparece em algum spec. Para os gatilhos de
 * `data-x-acao=valor`, basta o VALOR aparecer: é assim que os specs os
 * escrevem (`[data-mago-acao="definir-assinaturas"]`).
 */
function temCobertura(gatilho) {
  const valor = gatilho.includes('=') ? gatilho.split('=').pop() : gatilho;
  return TEXTO_SPECS.includes(valor);
}

const CONGELADOS = new Set(GATILHOS_SEM_COBERTURA);

test('a varredura enxerga o app e os specs (senão o motor passaria vazio)', () => {
  assert.ok(GATILHOS.size > 100, `só ${GATILHOS.size} gatilhos encontrados em site/js`);
  assert.ok(TEXTO_SPECS.length > 10_000, 'nenhum spec de e2e foi lido');
});

test('nenhum gatilho de tela novo sem teste que o acione', () => {
  const novos = [];
  for (const [gatilho, caminho] of GATILHOS) {
    if (CONGELADOS.has(gatilho) || temCobertura(gatilho)) continue;
    novos.push(`${gatilho}  (${caminho.slice(RAIZ.length + 1).replace(/\\/g, '/')})`);
  }
  assert.deepEqual(novos, [],
    'gatilho de tela sem nenhum teste que clique nele. Escreva o spec em ' +
    'testes/e2e/regras/, ou -- se houver motivo -- acrescente a entrada em ' +
    'testes/regras/gatilhos-sem-cobertura.mjs com o motivo por escrito:\n  ' +
    novos.join('\n  '));
});

test('a lista de gatilhos sem cobertura só encolhe', () => {
  const jaCobertos = GATILHOS_SEM_COBERTURA.filter(g => GATILHOS.has(g) && temCobertura(g));
  assert.deepEqual(jaCobertos, [],
    'estes gatilhos já têm teste: remova-os de gatilhos-sem-cobertura.mjs\n  ' +
    jaCobertos.join('\n  '));

  const sumiram = GATILHOS_SEM_COBERTURA.filter(g => !GATILHOS.has(g));
  assert.deepEqual(sumiram, [],
    'estes gatilhos não existem mais em site/js: remova-os de ' +
    'gatilhos-sem-cobertura.mjs\n  ' + sumiram.join('\n  '));

  assert.equal(new Set(GATILHOS_SEM_COBERTURA).size, GATILHOS_SEM_COBERTURA.length,
    'há entrada repetida em gatilhos-sem-cobertura.mjs');
});
