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

test('a fixture de inventario produz LINHAS DE ITEM na tela', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, comInventario(), 'inv-fix');

  // Estrutural, e nao `textContent.includes('Adaga')`. A versao anterior deste
  // teste procurava so o texto -- e 'Adaga' aparece em varios lugares da ficha
  // (seletor de equipamento, ataques), entao ele passava mesmo se a LISTA do
  // inventario estivesse vazia. Uma assercao que nao consegue falhar nao e um
  // teste.
  for (const l of lados) {
    const linhas = await l.page.evaluate(() => {
      const sel = ['#app-content .inv-item', '#app-content [data-idx]',
                   '#app-content [data-item-idx]'];
      return Object.fromEntries(sel.map((s) => [s, document.querySelectorAll(s).length]));
    });
    const total = Math.max(...Object.values(linhas));
    expect(total,
      `${l.nome}: nenhuma linha de item renderizada. Contagens: ${JSON.stringify(linhas)}`)
      .toBeGreaterThan(0);
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
 * Arrasta um item ate outro sintetizando gesto de TOQUE.
 *
 * O handler de sheet/inventario.js so inicia o arrasto se o toque comecar em
 * `.inv-drag-handle` (`if (!e.target.closest('.inv-drag-handle')) return`), e
 * resolve o alvo com `document.elementFromPoint` -- entao as coordenadas
 * precisam ser as reais dos elementos, nao offsets chutados. Um teste com
 * posicao inventada passaria por acidente ou falharia sem motivo.
 *
 * @returns {Promise<boolean>} true se a tela mudou.
 */
async function arrastarPorToque(page, de, para) {
  const antes = await page.textContent('#app-content');

  const pontos = await page.evaluate(([i, j]) => {
    const itens = [...document.querySelectorAll('#app-content .inv-item[data-idx]')];
    const origem = itens[i];
    const destino = itens[j];
    if (!origem || !destino) return null;
    const handle = origem.querySelector('.inv-drag-handle');
    if (!handle) return null;
    const hr = handle.getBoundingClientRect();
    const dr = destino.getBoundingClientRect();
    return {
      x0: Math.round(hr.x + hr.width / 2), y0: Math.round(hr.y + hr.height / 2),
      x1: Math.round(dr.x + dr.width / 2), y1: Math.round(dr.y + dr.height / 2),
    };
  }, [de, para]);
  if (pontos === null) return false;

  await page.evaluate(async (p) => {
    const itens = [...document.querySelectorAll('#app-content .inv-item[data-idx]')];
    const handle = itens[0].querySelector('.inv-drag-handle');
    const toque = (x, y) => [new Touch({
      identifier: 1, target: handle, clientX: x, clientY: y,
    })];
    const disparar = (tipo, x, y, alvo) => alvo.dispatchEvent(
      new TouchEvent(tipo, {
        bubbles: true, cancelable: true,
        touches: tipo === 'touchend' ? [] : toque(x, y),
        changedTouches: toque(x, y),
      }));

    disparar('touchstart', p.x0, p.y0, handle);
    await new Promise((r) => setTimeout(r, 120));
    for (const f of [0.34, 0.67, 1]) {
      disparar('touchmove', p.x1, Math.round(p.y0 + (p.y1 - p.y0) * f), handle);
      await new Promise((r) => setTimeout(r, 80));
    }
    disparar('touchend', p.x1, p.y1, handle);
  }, pontos);

  await page.waitForTimeout(700);
  return await page.textContent('#app-content') !== antes;
}

// PULADO: o arrasto do inventario nao e reproduzivel por automacao aqui.
// `sheet/inventario.js` so marca `draggable` por JS durante o gesto, e o
// caminho principal e de TOQUE (`touchstart`), nao de mouse. Emular isso
// exigiria sintetizar a sequencia de toque com posicoes reais -- viavel, mas
// e trabalho proprio, nao um ajuste de seletor. A paridade do inventario
// RENDERIZADO ja e coberta pelo teste acima e por ficha.spec.mjs.
// Registrado em PERGUNTAS-PARA-REVISAO.txt.
// PULADO. O gesto de toque sintetizado nao surtiu efeito NEM NO ORIGINAL,
// entao comparar os dois lados nao mediria nada.
//
// O que se apurou: o handler de sheet/inventario.js so inicia o arrasto se o
// toque comecar em `.inv-drag-handle`
// (`if (!e.target.closest('.inv-drag-handle')) return`) e resolve o alvo com
// `document.elementFromPoint`. O gesto foi sintetizado com as coordenadas
// reais do handle e do destino, e ainda assim nada mudou na tela.
//
// O que NAO se apurou: um script de diagnostico avulso reportou zero
// elementos para `.inv-item`, `[data-idx]` e `.inv-drag-handle`, enquanto o
// teste estrutural logo acima -- que usa os mesmos helpers do resto da suite
// -- encontra linhas de item e passa. Os dois nao foram reconciliados. A
// suspeita mais provavel e diferenca de tempo de espera entre o script solto
// e o `assentar()` dos helpers, mas isso e hipotese, nao medicao.
//
// Proximo passo para quem retomar: rodar este arquivo com `--headed` e
// inspecionar a lista do inventario na tela, em vez de contar seletores as
// cegas. Registrado em PERGUNTAS-PARA-REVISAO.txt.
test.skip('arrastar item por toque se comporta igual nos dois', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, comInventario(), 'inv-drag');

  const efeitos = [];
  for (const l of lados) {
    const n = await l.page.locator('#app-content .inv-item[data-idx]').count();
    expect(n, `${l.nome}: menos de dois itens na lista`).toBeGreaterThan(1);
    efeitos.push(await arrastarPorToque(l.page, 0, 1));
  }

  // Se o gesto nao surtir efeito nem no original, o teste nao mede nada --
  // melhor falhar dizendo isso do que passar em silencio.
  expect(efeitos[0],
    'o arrasto por toque nao surtiu efeito no original; teste sem valor').toBe(true);
  expect(efeitos[1], 'o arrasto surtiu efeito diferente no refatorado')
    .toBe(efeitos[0]);

  const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
  expect(primeiraDivergencia(a, b), 'inventario divergiu apos arrastar').toBeNull();
  expect(relatorioErros(lados), 'erros ao arrastar').toBe('');
});
