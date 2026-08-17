// ============================================================
// A foto carregada do personagem sai na ficha impressa.
//
// A imagem já era guardada (`char.imagem`, um data URL gravado pelo
// "Trocar foto" da edição) e aparecia no avatar da ficha na tela, mas o
// HTML de impressão (`sheet/impressao.js`) montava o cabeçalho só com nome
// e subtítulos -- quem imprimia a ficha recebia a folha sem retrato.
//
// O spec afirma sobre o HTML gerado por `gerarHtmlImpressao()`, e não sobre
// a janela de impressão: o `window.print()` do navegador não é observável
// pelo Playwright, e o que se quer garantir é o conteúdo da folha.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha } from './helpers-regras.mjs';

// PNG 1x1 transparente -- o menor data URL válido possível.
const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const BASE = {
  classe: 'Guerreiro', nivel: 3, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
  nome: 'Retrato Falado',
};

/** HTML que a ficha manda para a impressão. */
async function htmlDeImpressao(page) {
  return page.evaluate(async () => {
    const mod = await import(new URL('./js/sheet/impressao.js', location.href).href);
    return mod.gerarHtmlImpressao();
  });
}

test('impressão: personagem com foto carregada sai com o retrato na folha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { ...BASE, imagem: FOTO }, 'regras-impressao-foto');

  const html = await htmlDeImpressao(page);
  expect(html, 'o HTML de impressão não trouxe a imagem do personagem').toContain(FOTO);
  expect(html, 'a imagem deveria estar no cabeçalho, junto do nome').toContain('print-char-foto');
  expect(html).toContain('Retrato Falado');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('impressão: sem foto, o cabeçalho não ganha moldura vazia', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BASE, 'regras-impressao-sem-foto');

  const html = await htmlDeImpressao(page);
  expect(html, 'sem imagem não deveria haver elemento de foto no cabeçalho')
    .not.toContain('print-char-foto');
  expect(html).toContain('Retrato Falado');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
