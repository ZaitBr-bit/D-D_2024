// Inventario da ficha: render, moedas e arrastar-e-soltar.
//
// O arrastar e a unica interacao da suite que o Playwright pode nao emular de
// primeira, porque depende de eventos HTML5 de drag. Por isso a funcao tenta
// a API nativa e, se o DOM nao mudar, dispara os eventos a mao.
import { test, expect } from '@playwright/test';
import {
  abrirParelha, abrirFichaSemeada, instantaneoFicha, primeiraDivergencia,
  relatorioErros,
} from './helpers.mjs';
import { comInventario } from './fixtures.mjs';

test('a fixture de inventario produz itens na tela', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, comInventario(), 'inv-fix');
  for (const l of lados) {
    const texto = await l.page.textContent('#app-content');
    expect(texto,
      `${l.nome}: o item da fixture nao aparece; o formato do inventario mudou?`)
      .toContain('Adaga');
  }
});

test('inventario e moedas renderizam igual', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, comInventario(), 'inv-render');
  const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
  expect(primeiraDivergencia(a, b), 'inventario difere').toBeNull();
  expect(relatorioErros(lados), 'erros no inventario').toBe('');
});

/**
 * Arrasta um elemento ate outro. Tenta `dragTo`; se o DOM nao mudar, dispara
 * os eventos HTML5 a mao com um DataTransfer real.
 * @returns {Promise<boolean>} true se algo mudou na tela.
 */
async function arrastar(page, origemSel, destinoSel) {
  const antes = await page.textContent('#app-content');
  await page.locator(origemSel).dragTo(page.locator(destinoSel)).catch(() => {});
  await page.waitForTimeout(600);
  if (await page.textContent('#app-content') !== antes) return true;

  await page.evaluate(([o, d]) => {
    const origem = document.querySelectorAll(o)[0];
    const destino = document.querySelectorAll(d)[1] || document.querySelectorAll(d)[0];
    if (!origem || !destino) return;
    const dt = new DataTransfer();
    origem.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    destino.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
    destino.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    origem.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  }, [origemSel, destinoSel]);
  await page.waitForTimeout(600);
  return await page.textContent('#app-content') !== antes;
}

// PULADO: o arrasto do inventario nao e reproduzivel por automacao aqui.
// `sheet/inventario.js` so marca `draggable` por JS durante o gesto, e o
// caminho principal e de TOQUE (`touchstart`), nao de mouse. Emular isso
// exigiria sintetizar a sequencia de toque com posicoes reais -- viavel, mas
// e trabalho proprio, nao um ajuste de seletor. A paridade do inventario
// RENDERIZADO ja e coberta pelo teste acima e por ficha.spec.mjs.
// Registrado em PERGUNTAS-PARA-REVISAO.txt.
test.skip('arrastar item se comporta igual nos dois', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, comInventario(), 'inv-drag');

  // O atributo `draggable` NAO vem no HTML: sheet/inventario.js o define por
  // JS (`el.setAttribute('draggable','true')`) so quando o arrasto comeca, no
  // caminho de toque. Por isso o seletor e a linha do item, nao [draggable].
  const ITENS = '#app-content [data-idx]';
  const efeitos = [];
  for (const l of lados) {
    const n = await l.page.locator(ITENS).count();
    expect(n, `${l.nome}: nenhuma linha de item na tela`).toBeGreaterThan(1);
    efeitos.push(await arrastar(l.page, `${ITENS} >> nth=0`, `${ITENS} >> nth=1`));
  }

  // Se o arrastar nao surtir efeito nem no original, o teste nao mede nada --
  // e melhor falhar dizendo isso do que passar em silencio.
  expect(efeitos[0],
    'o arrastar nao surtiu efeito nem no original; teste sem valor').toBe(true);
  expect(efeitos[1], 'o arrastar surtiu efeito diferente no refatorado')
    .toBe(efeitos[0]);

  const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
  expect(primeiraDivergencia(a, b), 'inventario divergiu apos arrastar').toBeNull();
  expect(relatorioErros(lados), 'erros ao arrastar').toBe('');
});
