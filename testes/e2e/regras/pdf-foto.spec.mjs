// ============================================================
// A foto do personagem sai no PDF gerado pelo botão "Gerar PDF".
//
// LIÇÃO QUE ORIGINOU ESTE SPEC (2026-08-17): a foto foi implementada em
// `gerarHtmlImpressao()` (o caminho do `window.print()`) e o spec afirmou
// sobre ESSE html -- verde, e mesmo assim o usuário abriu o PDF e não viu
// retrato nenhum. O botão da ficha (`#btn-print`, rotulado "Gerar PDF")
// chama `baixarPdfFicha`, que desenha o cartão com PDFLib
// (`sheet/pdf.js:_desenharCartao`) e não usa aquele HTML para o cabeçalho.
// Testei o que implementei em vez do que o usuário aperta.
//
// Por isso este spec vai pelo caminho inteiro: clica no botão, captura o
// download e inspeciona os BYTES do PDF. `/Subtype /Image` e `/DCTDecode`
// (o filtro de JPEG) só aparecem no arquivo se uma imagem foi mesmo
// embutida.
// ============================================================
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha } from './helpers-regras.mjs';

// JPEG 8x8 vermelho -- o formato que `processarImagemArquivo` grava
// (canvas.toDataURL('image/jpeg', 0.8)).
const FOTO_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAIAAgBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiiv/9k=';

const BASE = {
  classe: 'Bardo', nivel: 2, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atuação', 'História'],
  nome: 'Retrato no PDF', especie: 'Golias', antecedente: 'Criminoso',
};

/** Clica em "Gerar PDF" e devolve os bytes do arquivo baixado. */
async function bytesDoPdf(page) {
  const espera = page.waitForEvent('download', { timeout: 60_000 });
  await clicarBotaoFicha(page, 'btn-print');
  const download = await espera;
  const caminho = await download.path();
  return readFileSync(caminho);
}

test('PDF: personagem com foto carregada sai com o retrato no cartão', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { ...BASE, imagem: FOTO_JPEG }, 'regras-pdf-foto');
  await assentar(page).catch(() => {});

  const pdf = await bytesDoPdf(page);
  const texto = pdf.toString('latin1');

  expect(texto, 'o PDF não tem nenhuma imagem embutida').toContain('/Subtype /Image');
  expect(texto, 'a imagem embutida deveria ser o JPEG da foto (filtro DCTDecode)')
    .toContain('/DCTDecode');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('PDF: sem foto, o cartão é gerado igual e sem imagem', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BASE, 'regras-pdf-sem-foto');
  await assentar(page).catch(() => {});

  const pdf = await bytesDoPdf(page);
  expect(pdf.length, 'o PDF sem foto deveria ser gerado normalmente').toBeGreaterThan(1000);
  expect(pdf.toString('latin1'), 'sem foto não deveria haver imagem no PDF')
    .not.toContain('/Subtype /Image');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
