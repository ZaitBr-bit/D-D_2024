// Importacao e exportacao entre o site original e o refatorado.
//
// O teste que mais importa aqui e o ROUND-TRIP: exportar num site e importar
// no outro, nos dois sentidos. E a prova direta de que fichas antigas
// continuam abrindo depois da refatoracao, e de que fichas novas nao ficam
// presas no site novo.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  abrirParelha, semearPersonagem, instantaneoFicha, primeiraDivergencia,
  relatorioErros,
} from './helpers.mjs';

const PERSONAGEM = {
  nome: 'Exportavel', classe: 'Clérigo', especie: 'Anão',
  antecedente: 'Acólito', nivel: 7,
  atributos: { forca: 12, destreza: 10, constituicao: 15,
               inteligencia: 11, sabedoria: 17, carisma: 13 },
};

/**
 * Campos que mudam sozinhos entre duas execucoes e nao dizem nada sobre a
 * refatoracao: sao gravados com o relogio no momento do salvamento, entao os
 * dois sites os produzem com milissegundos diferentes por construcao.
 */
const VOLATEIS = ['atualizado_em', 'criado_em'];

/** Remove os campos volateis, recursivamente. */
function semVolateis(valor) {
  if (Array.isArray(valor)) return valor.map(semVolateis);
  if (valor && typeof valor === 'object') {
    const fora = {};
    for (const [k, v] of Object.entries(valor)) {
      if (!VOLATEIS.includes(k)) fora[k] = semVolateis(v);
    }
    return fora;
  }
  return valor;
}

/** Clica em Exportar e devolve o JSON baixado, ja parseado e normalizado. */
async function exportar(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.evaluate(() => document.getElementById('btn-exportar')?.click()),
  ]);
  return semVolateis(JSON.parse(readFileSync(await download.path(), 'utf-8')));
}

/** Baixa o export e devolve o CAMINHO do arquivo, para reimportar. */
async function exportarArquivo(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.evaluate(() => document.getElementById('btn-exportar')?.click()),
  ]);
  return download.path();
}

/** Importa um arquivo pelo botao, interceptando o file chooser. */
async function importarArquivo(page, caminho) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 30_000 }),
    page.evaluate(() => document.getElementById('btn-importar')?.click()),
  ]);
  await chooser.setFiles(caminho);
  await page.waitForTimeout(1200);
}

/** Lista resumida dos personagens no localStorage. */
async function listar(page) {
  return page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    return store.listarPersonagens().map((p) => ({
      id: p.id, nome: p.nome, classe: p.classe, especie: p.especie, nivel: p.nivel,
    }));
  });
}

test('exportacao produz o mesmo JSON nos dois sites', async ({ context }) => {
  const lados = await abrirParelha(context, '');
  for (const l of lados) await semearPersonagem(l.page, PERSONAGEM, 'exp-1');
  for (const l of lados) {
    await l.page.reload({ waitUntil: 'domcontentloaded' });
    await l.page.waitForTimeout(800);
  }

  const [a, b] = await Promise.all(lados.map((l) => exportar(l.page)));
  expect(b, 'JSON exportado difere do original').toEqual(a);
  expect(relatorioErros(lados), 'erros ao exportar').toBe('');
});

test('round-trip: exportar no original, importar no refatorado', async ({ context }) => {
  const lados = await abrirParelha(context, '');
  const [original, refatorado] = lados;

  await semearPersonagem(original.page, PERSONAGEM, 'rt-1');
  await original.page.reload({ waitUntil: 'domcontentloaded' });
  await original.page.waitForTimeout(800);
  const arquivo = await exportarArquivo(original.page);

  await importarArquivo(refatorado.page, arquivo);

  const importado = await listar(refatorado.page);
  expect(importado.length, 'nada foi importado no refatorado').toBe(1);
  expect(importado[0]).toMatchObject({
    nome: 'Exportavel', classe: 'Clérigo', especie: 'Anão', nivel: 7,
  });
  expect(relatorioErros(lados), 'erros no round-trip').toBe('');
});

test('round-trip inverso e ficha identica apos importar', async ({ context }) => {
  const lados = await abrirParelha(context, '');
  const [original, refatorado] = lados;

  // Exporta do REFATORADO e importa no ORIGINAL: a direcao que prova que uma
  // ficha criada no site novo continua abrindo no antigo.
  await semearPersonagem(refatorado.page, PERSONAGEM, 'rti-1');
  await refatorado.page.reload({ waitUntil: 'domcontentloaded' });
  await refatorado.page.waitForTimeout(800);
  const arquivo = await exportarArquivo(refatorado.page);

  await importarArquivo(original.page, arquivo);

  const importado = await listar(original.page);
  expect(importado.length, 'nada foi importado no original').toBe(1);

  // Agora os dois tem o mesmo personagem: a ficha tem de renderizar igual.
  for (const l of lados) {
    await l.page.goto(l.base + '#ficha/rti-1', { waitUntil: 'domcontentloaded' });
    await l.page.waitForTimeout(1800);
  }
  const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
  expect(primeiraDivergencia(a, b), 'ficha importada difere').toBeNull();
  expect(relatorioErros(lados), 'erros no round-trip inverso').toBe('');
});
