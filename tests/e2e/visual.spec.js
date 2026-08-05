// ============================================================
// Baseline visual (screenshots) do app: home, cada passo do criador, ficha
// principal, modais críticos e os layouts desktop/móvel. Todos os testes
// aqui são marcados `@visual` e SÓ rodam através do runner protegido
// `scripts/run-playwright-visual-linux.mjs` (npm run test:e2e:visual /
// test:e2e:update-snapshots), na imagem Linux
// mcr.microsoft.com/playwright:v1.62.0-noble — nunca neste host Windows e
// nunca por uma execução comum de `npm run test:e2e` (que roda com
// `--grep-invert @visual`).
//
// Máscaras: apenas versão do header (#header-versao), timestamps e os IDs
// gerados dinamicamente (`data-id`/`data-*` de personagem) já declarados
// como voláteis — nunca conteúdo de regra/gameplay, que deve ser
// pixel-estável entre execuções (personagens/seeds fixos, relógio e
// Math.random congelados via resetApp()).
// ============================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetApp, goHome, goCreator, goFicha } from './helpers/app.js';
import {
  primeiroContentId,
  selecionarClasse,
  selecionarEspecie,
  selecionarAntecedente,
  escolherAtributosPointBuy,
  escolherEquipamentoPadrao,
  escolherMagiasSuficientes,
  proximoPasso
} from './helpers/creator.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const derivedValues = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8')
);
const PERSONAGEM_BASE = derivedValues.cases.find((c) => c.id === 'pv-convergente').personagem;

// Segunda camada de proteção (independente de scripts/run-playwright-visual-linux.mjs):
// mesmo que este spec seja aberto diretamente via `playwright test` (sem passar
// pelo wrapper), os testes `@visual` abaixo se recusam a rodar fora de Linux. Isso
// evita que o Playwright grave screenshots "ausentes" automaticamente neste host
// (Windows) mesmo sem `--update-snapshots` — pixels renderizados fora da imagem
// mcr.microsoft.com/playwright:v1.62.0-noble nunca podem entrar no oráculo de
// compatibilidade visual.
test.skip(
  process.platform !== 'linux',
  `Suíte visual roda apenas em Linux (plataforma atual: "${process.platform}"). ` +
    'Use scripts/run-playwright-visual-linux.mjs na imagem mcr.microsoft.com/playwright:v1.62.0-noble.'
);

const MASK_HEADER_VERSAO = (page) => [page.locator('#header-versao')];

test.describe('@visual Home', () => {
  test('home vazia', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goHome(page);
    await expect(page).toHaveScreenshot('home-vazia.png', { mask: MASK_HEADER_VERSAO(page), fullPage: true });
  });

  test('home com personagens', async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goHome(page);
    await expect(page).toHaveScreenshot('home-com-personagens.png', {
      mask: [...MASK_HEADER_VERSAO(page), page.locator('.char-card')],
      fullPage: true
    });
  });
});

test.describe('@visual Criador', () => {
  // ATENÇÃO (Task 28b): o criador foi trocado pela arquitetura nova, então
  // TODAS as capturas `criador-*.png` deste bloco precisam ser regravadas no
  // comando Linux de baselines visuais (`npm run test:e2e:update-snapshots`).
  // A troca é de DOM, não de fluxo: continuam sendo os mesmos sete passos.
  //
  // Fluxo determinístico próprio (Guerreiro — não-conjurador, para não
  // depender do passo de magias ter conteúdo — 1a espécie do grid,
  // antecedente "Andarilho" para evitar a lacuna de "Iniciado em Magia",
  // Compra de Pontos). Note que tests/e2e/dom-baseline.spec.js
  // usa um caminho determinístico DIFERENTE (Mago, conjurador) porque precisa
  // caracterizar o passo "magias" com conteúdo real; os dois não são o mesmo
  // fluxo e não precisam ser — cada um captura o que sua asserção exige. Cada
  // passo aqui é fotografado assim que renderiza, antes de qualquer interação
  // nele.
  test('todos os passos do criador em sequência', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goCreator(page);
    await expect(page).toHaveScreenshot('criador-classe.png', { mask: MASK_HEADER_VERSAO(page), fullPage: true });

    await selecionarClasse(page, 'dnd2024:class:guerreiro');
    await proximoPasso(page);
    await expect(page).toHaveScreenshot('criador-especie.png', { mask: MASK_HEADER_VERSAO(page), fullPage: true });

    const especie = await primeiroContentId(page, 'grid-especies');
    await selecionarEspecie(page, especie);
    await proximoPasso(page);
    await expect(page).toHaveScreenshot('criador-antecedente.png', { mask: MASK_HEADER_VERSAO(page), fullPage: true });

    await selecionarAntecedente(page, 'dnd2024:background:andarilho');
    await proximoPasso(page);
    await expect(page).toHaveScreenshot('criador-atributos.png', { mask: MASK_HEADER_VERSAO(page), fullPage: true });

    await escolherAtributosPointBuy(page);
    await proximoPasso(page);
    await expect(page).toHaveScreenshot('criador-equipamento.png', { mask: MASK_HEADER_VERSAO(page), fullPage: true });

    await escolherEquipamentoPadrao(page);
    await proximoPasso(page);
    await expect(page).toHaveScreenshot('criador-magias.png', { mask: MASK_HEADER_VERSAO(page), fullPage: true });

    await escolherMagiasSuficientes(page);
    await proximoPasso(page);
    await expect(page).toHaveScreenshot('criador-detalhes.png', { mask: MASK_HEADER_VERSAO(page), fullPage: true });
  });
});

test.describe('@visual Ficha', () => {
  test('ficha principal', async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);
    await expect(page).toHaveScreenshot('ficha-principal.png', {
      mask: MASK_HEADER_VERSAO(page),
      fullPage: true
    });
  });

  test('modal crítico: gerenciar condições', async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);
    await page.locator('#btn-gerenciar-condicoes').click();
    await expect(page.locator('#modal-overlay')).toHaveCSS('display', 'flex');
    await expect(page.locator('#modal-container')).toHaveScreenshot('modal-condicoes.png');
  });

  test('modal crítico: excluir personagem (home)', async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goHome(page);
    await page.locator(`.char-card[data-id="${PERSONAGEM_BASE.id}"] [data-action="excluir"]`).click();
    await expect(page.locator('#modal-overlay')).toHaveCSS('display', 'flex');
    await expect(page.locator('#modal-container')).toHaveScreenshot('modal-excluir.png');
  });
});
