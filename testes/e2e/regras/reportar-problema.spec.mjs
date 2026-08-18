// ============================================================
// O botão 🐛 do header tem de levar às issues do GitHub.
//
// Até 2026-08-17 o modal só oferecia Reddit. Ao abrir o repositório para
// receber issues, o canal principal passou a ser o formulário do GitHub --
// e um botão que promete isso só está entregue se um teste CLICAR nele.
//
// Duas coisas quebram em silêncio aqui e por isso viram asserção:
//
// 1. O nome do template no link. `issues/new?template=bug.yml` com um nome
//    que não existe em `.github/ISSUE_TEMPLATE/` não dá erro nenhum: o
//    GitHub abre a issue em branco, e ninguém percebe até o primeiro
//    relato chegar sem versão nem aparelho. Por isso o spec confere o
//    parâmetro do link CONTRA os arquivos no disco.
// 2. A versão pré-preenchida. `corpoReportarProblema` monta o link com
//    VERSAO_ATUAL; se essa ligação se perder, o campo chega vazio e o
//    relato volta a não dizer qual build quebrou.
// ============================================================
import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { VERSAO_ATUAL } from '../../../site/js/versao.js';
import { abrirSite } from './helpers-regras.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIR_TEMPLATES = resolve(AQUI, '..', '..', '..', '.github', 'ISSUE_TEMPLATE');

/** Nome do arquivo de template pedido por um link `issues/new?template=…`. */
function templateDoLink(href) {
  return new URL(href).searchParams.get('template');
}

test('botão 🐛: abre o modal com os links de issue do GitHub', async ({ context }) => {
  const { page, erros } = await abrirSite(context);

  await page.locator('#btn-reportar-bug').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  const bug = page.locator('#link-issue-bug');
  const sugestao = page.locator('#link-issue-sugestao');
  const lista = page.locator('#link-issues-lista');

  await expect(bug, 'o modal deveria oferecer o link de relatar problema').toBeVisible();
  await expect(sugestao, 'o modal deveria oferecer o link de sugerir melhoria').toBeVisible();
  await expect(lista, 'o modal deveria oferecer o link das issues já abertas').toBeVisible();

  // Os três apontam para o repositório público, em aba nova e sem vazar
  // o `window.opener` para o site de destino.
  for (const link of [bug, sugestao, lista]) {
    await expect(link).toHaveAttribute('href', /github\.com\/ZaitBr-bit\/D-D_2024/);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }

  // O Reddit continua como alternativa para quem não tem conta no GitHub.
  await expect(
    page.locator('#modal-corpo a[href*="reddit.com"]'),
    'o Reddit deveria continuar disponível como alternativa'
  ).toHaveCount(2);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('botão 🐛: os links citam templates que existem e mandam a versão atual', async ({ context }) => {
  const { page } = await abrirSite(context);

  await page.locator('#btn-reportar-bug').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  const hrefBug = await page.locator('#link-issue-bug').getAttribute('href');
  const hrefSugestao = await page.locator('#link-issue-sugestao').getAttribute('href');

  // Os arquivos que o GitHub vai procurar. `config.yml` não é template.
  const existentes = readdirSync(DIR_TEMPLATES).filter((f) => f !== 'config.yml');

  expect(existentes, `template do link de bug ausente em .github/ISSUE_TEMPLATE/ (${existentes.join(', ')})`)
    .toContain(templateDoLink(hrefBug));
  expect(existentes, `template do link de sugestão ausente em .github/ISSUE_TEMPLATE/ (${existentes.join(', ')})`)
    .toContain(templateDoLink(hrefSugestao));

  // A versão manual do site chega pré-preenchida no campo `versao` do
  // formulário -- o mesmo id declarado em bug.yml.
  expect(new URL(hrefBug).searchParams.get('versao')).toBe(VERSAO_ATUAL);
});
