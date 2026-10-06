// ============================================================
// Artífice: criação de um personagem de nível 1 pelo CRIADOR, do primeiro
// passo ao "Criar Personagem". Os testes de unidade chamam
// aplicarFerramentasDaCriacao/concederTruquesDeEntrada direto; este spec
// prova a ligação em creator/wizard.js (finalizar) e o que a ficha mostra.
//
// Confere: classe, ferramentas (Ladrão, Funileiro e a de artesão escolhida),
// Reparar com origem `caracteristica_classe` fora do limite de truques,
// truques e magias preparadas da tabela do nível 1 e o chip da fonte.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  abrirSite, assentar, confirmarModal, passoAtual, personagemSalvo, satisfazerPasso,
} from './helpers-regras.mjs';

const FERRAMENTA = 'Ferramentas de Ferreiro';

/**
 * Escolhe o Artífice, marca a ferramenta de artesão no popup da classe e
 * confirma. A lista não oferece Funileiro (a classe já concede).
 */
async function escolherArtificeComFerramenta(page) {
  await page.click('[data-classe="Artífice"]');
  await expect(page.locator(
    '[data-escolha-classe="ferramenta_artesao"][data-opcao="Ferramentas de Funileiro"]')).toHaveCount(0);
  await page.locator(
    `[data-escolha-classe="ferramenta_artesao"][data-opcao="${FERRAMENTA}"]`).click();
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  await assentar(page).catch(() => {});
}

/** Avança passo a passo até o botão final aparecer; devolve false se travar. */
async function ateFinalizar(page) {
  for (let i = 0; i < 12; i++) {
    if (await page.locator('#btn-finalizar').count()) return true;
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return (await page.locator('#btn-finalizar').count()) > 0;
}

test('criador: Artífice nível 1 do começo ao fim grava ferramentas, Reparar e tabela do nível 1', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  expect(await passoAtual(page)).toBe(0);

  await escolherArtificeComFerramenta(page);
  expect(await ateFinalizar(page), 'o criador deveria chegar ao botão Criar Personagem').toBe(true);

  await page.locator('#det-nome').fill('Artifice de Teste');
  // Idiomas adicionais: marca os 2 primeiros ainda habilitados.
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-idioma]:not(:checked):not(:disabled)').first().check();
  }
  await page.evaluate(() => document.getElementById('btn-finalizar').click());
  await expect(page).toHaveURL(/#ficha\//, { timeout: 20_000 });
  await assentar(page).catch(() => {});

  const p = await personagemSalvo(page);
  expect(p.classe).toBe('Artífice');
  expect(p.nivel).toBe(1);
  expect(p.escolhas_classe.ferramenta_artesao).toEqual([FERRAMENTA]);

  for (const f of ['Ferramentas de Ladrão', 'Ferramentas de Funileiro', FERRAMENTA]) {
    expect(p.proficiencias_ferramentas, `faltou ${f}`).toContain(f);
  }
  expect(p.proficiencias_ferramentas.filter((f) => f === 'Ferramentas de Funileiro')).toHaveLength(1);

  const reparar = (p.magias_conhecidas || []).filter((m) => m.nome === 'Reparar');
  expect(reparar).toHaveLength(1);
  expect(reparar[0].origem).toBe('caracteristica_classe');

  // Tabela do nível 1: 2 truques da classe (sem contar Reparar nem os de espécie/talento) e 2 magias preparadas.
  const truquesDaTabela = (p.magias_conhecidas || []).filter((m) => m.circulo === 0 && m.classe === 'Artífice' && !m.origem);
  expect(truquesDaTabela).toHaveLength(2);
  expect((p.magias_preparadas || []).filter((m) => (m.circulo ?? 1) >= 1 && m.classe === 'Artífice' && !m.origem)).toHaveLength(2);

  await expect(page.locator('#app-content .selo-fonte[data-fonte="tasha"]').first()).toBeVisible();
  expect(erros, erros.join('; ')).toEqual([]);
});
