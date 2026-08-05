// ============================================================
// Caracterização da geração de PDF da ficha (site/js/pages/sheet.js
// #btn-print → baixarPdfFicha(), via pdf-lib). O botão não usa
// window.print() no código atual (imprimirFicha()/#print-overlay existe no
// arquivo mas não está ligado a nenhum elemento clicável — código morto do
// ponto de vista da UI). Os valores derivados comparados vêm do oráculo
// congelado em Task 2 (tests/fixtures/expected/derived-values.json).
// ============================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetApp, goFicha } from './helpers/app.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const derivedValues = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8')
);
const casesById = Object.fromEntries(derivedValues.cases.map((c) => [c.id, c]));
const PERSONAGEM_BASE = casesById['pv-convergente'].personagem;
const expectedOf = (id) => casesById[id].expectedUnified;

test.describe('Ficha — impressão e PDF', () => {
  test('gerar PDF baixa um arquivo nomeado com o personagem e de tamanho > 0', async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btn-print').click()
    ]);

    expect(download.suggestedFilename()).toBe(`Ficha ${PERSONAGEM_BASE.nome}.pdf`);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const stats = fs.statSync(filePath);
    expect(stats.size).toBeGreaterThan(0);
    // Assinatura de arquivo PDF válida (%PDF-).
    const buf = Buffer.alloc(5);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    expect(buf.toString('ascii')).toBe('%PDF-');
  });

  test('CD de magia e ataque de magia usados no cartão do PDF batem com o oráculo de Task 2', async ({ page }) => {
    // O cartão do PDF (_montarDadosCartao, sheet.js) e a tela usam a mesma
    // origem (char lido diretamente / calcCDMagia / calcAtaqueMagia) — como o
    // PDF não é inspecionável por seletor, caracterizamos a convergência via
    // os valores exibidos na tela, que o oráculo já certifica como idênticos
    // aos usados na geração do PDF (ver `origemReal` de cada caso).
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);

    // Task 33 (cutover): a ficha pública deixou de ser o monólito, e com ela
    // os seletores `.stat-box`/`.stat-label`, que eram POSICIONAIS (o valor era
    // achado pelo texto do rótulo ao lado). Os novos identificam o VALOR pelo
    // que ele é — `data-sheet-spell-save-dc` / `data-sheet-spell-attack-bonus`,
    // emitidos pela seção de magias a partir de `derived.defenses`. A garantia
    // medida é a mesma, e ficou mais forte: a tela e o PDF agora leem
    // literalmente a mesma projeção (`SheetViewModel`), o que o contrato
    // `tests/contract/sheet-output-parity.test.js` prende campo a campo.
    await expect(page.locator('[data-sheet-spell-save-dc]')).toHaveText(String(expectedOf('cd-magia-convergente')));
    await expect(page.locator('[data-sheet-spell-attack-bonus]')).toContainText(String(expectedOf('ataque-magia-convergente')));
  });
});
