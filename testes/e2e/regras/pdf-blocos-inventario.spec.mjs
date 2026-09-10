// ============================================================
// Issue #57 -- a mochila no PDF vinha num paragrafo unico.
//
// _extrairBlocosDetalhe nao conhecia `.print-inv-item`, caia no `else`
// generico e fazia `clone.textContent` da secao inteira: nome, efeito e
// detalhe de todos os itens numa linha so. Aqui se mede que cada item
// vira UM bloco de nome mais os seus paragrafos.
//
// Spec e2e, e nao teste de unidade: pdf.js usa `DOMParser`, que so existe
// de verdade dentro da pagina do Playwright. O plano original pedia
// `linkedom` como dependencia de dev para dar um DOMParser ao harness de
// Node, mas o controlador revogou -- instalar dependencia e decisao do
// dono do repositorio. Este spec importa pdf.js DENTRO da pagina (mesmo
// padrao de bruxo-multiclasse-espelho.spec.mjs:22) e roda as asercoes no
// Node com o resultado devolvido pelo evaluate.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirSite } from './helpers-regras.mjs';

const HTML = `
  <div class="print-section">
    <div class="print-section-title">Inventario (Mochila)</div>
    <div class="print-inv-item">
      <span class="print-inv-name">Espada Longa (x2)</span>
      <span class="print-inv-effect">1d8 Cortante | Versatil (1d10)</span>
      <span class="print-inv-detail">15 PO | 1,5 kg</span>
    </div>
    <div class="print-inv-item">
      <span class="print-inv-name">Corda</span>
      <span class="print-inv-detail">1 PO | 2,5 kg</span>
    </div>
  </div>`;

/** Importa pdf.js dentro da pagina e chama extrairBlocosDetalhe com o HTML dado. */
async function extrairBlocos(page, html) {
  return page.evaluate(async (htmlArg) => {
    const mod = await import(new URL('./js/sheet/pdf.js', location.href).href);
    return mod.extrairBlocosDetalhe(htmlArg);
  }, html);
}

test('cada item da mochila vira um bloco de nome proprio', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML);
  const nomes = blocos.filter(b => b.t === 'name').map(b => b.text);
  expect(nomes).toEqual(['Espada Longa (x2)', 'Corda']);
});

test('efeito e detalhe saem em blocos SEPARADOS, nao numa linha so', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML);
  const i = blocos.findIndex(b => b.text === 'Espada Longa (x2)');
  expect(blocos[i + 1].text).toBe('1d8 Cortante | Versatil (1d10)');
  expect(blocos[i + 2].text).toBe('15 PO | 1,5 kg');
});

test('item sem efeito nao gera bloco de efeito vazio', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML);
  expect(blocos.some(b => b.text === ''), 'nenhum bloco pode sair vazio').toBe(false);
  const i = blocos.findIndex(b => b.text === 'Corda');
  expect(blocos[i + 1].text).toBe('1 PO | 2,5 kg');
});

test('a secao continua abrindo com o titulo', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML);
  expect(blocos[0].t).toBe('h2');
  expect(blocos[0].text).toBe('Inventario (Mochila)');
});

test('NENHUM bloco junta os dois itens no mesmo texto', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML);
  expect(blocos.some(b => b.text.includes('Espada') && b.text.includes('Corda')),
    'era exatamente isso que o `else` generico fazia').toBe(false);
});

// A secao Equipamento tinha caminho proprio (`.print-equip-item`) e ficava
// de fora do conjunto `pular` -- ou melhor, ficava DENTRO dele, entao
// nunca chegava ao extrator. Agora usa a mesma estrutura em tres partes da
// Mochila, e o extrator precisa reconhecer as duas classes sem duplicar o
// corpo do ramo (issue #57, "os equipamentos ganham o mesmo tratamento").
const HTML_EQUIPADO = `
  <div class="print-section">
    <div class="print-section-title">Equipamento</div>
    <div class="print-equip-item">
      <span class="print-equip-name">Machado de Batalha</span>
      <span class="print-equip-effect">1d8 Cortante | Versatil (1d10)</span>
      <span class="print-equip-detail">10 PO | 2 kg</span>
    </div>
    <div class="print-equip-item">
      <span class="print-equip-name">Escudo</span>
      <span class="print-equip-effect">CA: 2</span>
    </div>
  </div>`;

test('item equipado tambem vira um bloco de nome proprio', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML_EQUIPADO);
  const nomes = blocos.filter(b => b.t === 'name').map(b => b.text);
  expect(nomes).toEqual(['Machado de Batalha', 'Escudo']);
});

test('item equipado: efeito e detalhe saem em blocos SEPARADOS', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML_EQUIPADO);
  const i = blocos.findIndex(b => b.text === 'Machado de Batalha');
  expect(blocos[i + 1].text).toBe('1d8 Cortante | Versatil (1d10)');
  expect(blocos[i + 2].text).toBe('10 PO | 2 kg');
});

test('item equipado: NENHUM bloco junta os dois itens no mesmo texto', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML_EQUIPADO);
  expect(blocos.some(b => b.text.includes('Machado') && b.text.includes('Escudo')),
    'era exatamente isso que o `else` generico fazia').toBe(false);
});

test('a secao Equipamento continua abrindo com o titulo', async ({ context }) => {
  const { page } = await abrirSite(context);
  const blocos = await extrairBlocos(page, HTML_EQUIPADO);
  expect(blocos[0].t).toBe('h2');
  expect(blocos[0].text).toBe('Equipamento');
});
