// ============================================================
// Issue #57 -- os detalhes pessoais no PDF vinham num paragrafo unico,
// e as quebras de linha que o jogador digitou sumiam.
//
// Spec e2e, e nao teste de unidade: pdf.js usa `DOMParser`, que so existe
// de verdade dentro da pagina do Playwright. O plano original pedia
// `linkedom` como dependencia de dev para dar um DOMParser ao harness de
// Node, mas o controlador revogou -- instalar dependencia e decisao do
// dono do repositorio. Este spec importa pdf.js DENTRO da pagina (mesmo
// padrao de pdf-blocos-inventario.spec.mjs, Tarefa 4) e roda as asercoes
// no Node com o resultado devolvido pelo evaluate.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirSite } from './helpers-regras.mjs';

const HTML = `
  <div class="print-section">
    <div class="print-section-title">Detalhes</div>
    <div class="print-detail-field">
      <div class="print-detail-label">Aparencia</div>
      <div class="print-detail-value">Alta e ruiva.</div>
    </div>
    <div class="print-detail-field">
      <div class="print-detail-label">Historia</div>
      <div class="print-detail-value">Nasceu no norte.
Foi criada por lobos.

Depois virou paladina.</div>
    </div>
  </div>`;

/** Importa pdf.js dentro da pagina e chama extrairBlocosDetalhe com o HTML dado. */
async function extrairBlocos(page, html) {
  return page.evaluate(async (htmlArg) => {
    const mod = await import(new URL('./js/sheet/pdf.js', location.href).href);
    return mod.extrairBlocosDetalhe(htmlArg);
  }, html);
}

test('cada campo vira um bloco de nome com o rotulo', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML);
  const nomes = blocos.filter(b => b.t === 'name').map(b => b.text);
  expect(nomes).toEqual(['Aparencia', 'Historia']);
});

test('o valor do campo vem em paragrafo proprio, logo depois do rotulo', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML);
  const i = blocos.findIndex(b => b.text === 'Aparencia');
  expect(blocos[i + 1].t).toBe('p');
  expect(blocos[i + 1].text).toBe('Alta e ruiva.');
});

test('as quebras de linha do jogador viram paragrafos separados', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML);
  const i = blocos.findIndex(b => b.text === 'Historia');
  expect(blocos[i + 1].text).toBe('Nasceu no norte.');
  expect(blocos[i + 2].text).toBe('Foi criada por lobos.');
  expect(blocos[i + 3].text).toBe('Depois virou paladina.');
});

test('linha em branco nao vira paragrafo vazio', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML);
  expect(blocos.some(b => b.text === '')).toBe(false);
});

test('NENHUM bloco junta Aparencia e Historia no mesmo texto', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML);
  expect(blocos.some(b => b.text.includes('ruiva') && b.text.includes('lobos'))).toBe(false);
});
