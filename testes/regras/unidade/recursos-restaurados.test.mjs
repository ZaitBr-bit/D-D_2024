// ============================================================
// Todo recurso que se GASTA precisa de algum ponto que o devolva.
//
// Nasceu de um bug real (2026-08-17): o Campeão dos Deuses do Bárbaro
// Trilha do Fanático gravava `campeao_deuses_gastos` ao gastar um d12 e
// lia o campo para exibir "N/4 d12", mas NENHUM ponto do app o zerava. O
// bloco do Bárbaro no Descanso Longo restaura fúria, presença intimidante
// e presença zelosa -- e pulava justamente esse. Na prática a reserva era
// de uso único por personagem, contra o livro ("Sua reserva restaura todos
// os dados gastos ao completar um Descanso Longo").
//
// A varredura é sintática e deliberadamente boba: campo cujo nome termina
// em `_usado/_usada/_gasto/_gastos` é consumo, e consumo tem de ser
// mencionado em `sheet/hp-descanso.js` (que é onde os dois descansos
// restauram tudo) ou estar em EXCECOES com o motivo escrito.
//
// O que ela NÃO garante: que a restauração esteja no descanso CERTO (curto
// vs. longo), nem que zere o valor certo. Isso continua sendo trabalho do
// spec de comportamento -- ver `e2e/regras/barbaro-fanatico-descanso.spec.mjs`.
// Aqui o objetivo é só que nenhum recurso fique sem NENHUMA volta.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './harness.mjs';

/**
 * Recursos que legitimamente não voltam por descanso. Cada entrada é uma
 * alegação: se o motivo estiver errado, um recurso quebrado passa batido.
 */
const EXCECOES = {
  concentracao_fanatica_usada:
    'Fanático nv6: "uma vez por Fúria ativa" -- zera ao ATIVAR a Fúria ' +
    '(sheet/habilidades.js), não por descanso.',
  ritual_rapido_usado:
    'Talento Conjurador Ritualista: restaurado por restaurarRecursosTalentos ' +
    "(regras-cobertura.js), chamada por hp-descanso.js com 'longo'.",
  ate_a_morte_usado:
    'Talento Dádiva da Recuperação: mesma via de restaurarRecursosTalentos.',
  dados_vitalidade_gastos:
    'Talento Dádiva da Recuperação: mesma via de restaurarRecursosTalentos.',
};

function listarJs(dir) {
  const fora = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === 'vendor') continue;
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) fora.push(...listarJs(caminho));
    else if (entrada.name.endsWith('.js')) fora.push(caminho);
  }
  return fora;
}

const BASE = join(RAIZ, 'site', 'js');
const DESCANSO = readFileSync(join(BASE, 'sheet', 'hp-descanso.js'), 'utf-8');

/** Campos de consumo gravados em algum lugar do app, com onde aparecem. */
function camposDeConsumo() {
  const mapa = new Map();
  for (const caminho of listarJs(BASE)) {
    const texto = readFileSync(caminho, 'utf-8');
    const rel = caminho.slice(BASE.length + 1).replace(/\\/g, '/');
    for (const m of texto.matchAll(/\.([a-z0-9_]*(?:_usad[ao]|_gastos?))\s*=[^=]/g)) {
      if (!mapa.has(m[1])) mapa.set(m[1], new Set());
      mapa.get(m[1]).add(rel);
    }
  }
  return mapa;
}

const CAMPOS = camposDeConsumo();

test('a varredura enxerga os recursos (senão o motor passaria vazio)', () => {
  assert.ok(CAMPOS.size > 20, `só ${CAMPOS.size} campos de consumo encontrados`);
  assert.ok(CAMPOS.has('campeao_deuses_gastos'),
    'o campo que originou este motor sumiu -- confira se o nome mudou');
});

test('nenhum recurso consumível fica sem restauração', () => {
  const orfaos = [];
  for (const [campo, arquivos] of CAMPOS) {
    if (DESCANSO.includes(campo)) continue;
    if (EXCECOES[campo]) continue;
    const onde = [...arquivos].filter(a => a !== 'sheet/hp-descanso.js').join(', ');
    orfaos.push(`${campo}  (gravado em ${onde})`);
  }
  assert.deepEqual(orfaos, [],
    'recurso é gasto mas nada o devolve: acrescente a restauração em ' +
    'sheet/hp-descanso.js, ou registre em EXCECOES deste arquivo com o ' +
    'motivo do livro:\n  ' + orfaos.join('\n  '));
});

test('a lista de exceções não guarda entrada morta', () => {
  const mortas = Object.keys(EXCECOES).filter(campo => !CAMPOS.has(campo));
  assert.deepEqual(mortas, [],
    'estes campos não existem mais no app: remova-os de EXCECOES\n  ' + mortas.join('\n  '));

  const jaRestaurados = Object.keys(EXCECOES).filter(campo => DESCANSO.includes(campo));
  assert.deepEqual(jaRestaurados, [],
    'estes campos passaram a ser restaurados no descanso: remova-os de EXCECOES\n  ' +
    jaRestaurados.join('\n  '));
});
