// ============================================================
// Issue #91 -- Revelação Celestial do Aasimar (nível 3) concede UMA
// transformação por Descanso Longo, à escolha entre 3 formas. O card do
// traço-pai precisa mostrar um SELETOR de forma (não o toggle genérico) e
// clicar em "Transformar" precisa gravar a forma escolhida e aplicar o
// efeito mecânico (Asas Celestiais = voo). Este spec clica de verdade nos
// dois botões -- "Transformar" e "Encerrar transformação" -- em vez de só
// inspecionar o HTML gerado (já coberto pelos testes de unidade).
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

test('Revelação Celestial: clicar em Transformar escolhe Asas Celestiais, grava e concede voo; Encerrar limpa', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro',
    nivel: 3,
    xp: 900,
    especie: 'Aasimar',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atletismo', 'Percepção'],
    schema_versao: 2,
  }, 'regras-aasimar-revelacao-celestial');
  await assentar(page).catch(() => {});

  await page.locator('summary', { hasText: 'Revelação Celestial' }).click();

  await expect(page.locator('#revelacao-celestial-escolha')).toBeVisible();

  await page.selectOption('#revelacao-celestial-escolha', 'asas');
  await page.click('[data-revelacao-transformar="1"]');
  await assentar(page).catch(() => {});

  const salvoTransformado = await personagemSalvo(page);
  expect(salvoTransformado?.recursos?.aasimar_revelacao_ativa, 'a forma escolhida precisa persistir no personagem salvo')
    .toBe('asas');

  // A troca de estado re-renderiza a ficha, o que fecha o <details> de novo.
  await page.locator('summary', { hasText: 'Revelação Celestial' }).click();
  await expect(page.locator('text=Transformado: Asas Celestiais')).toBeVisible();

  const conteudoComVoo = await page.evaluate(() => document.body.innerText);
  expect(conteudoComVoo, 'com Asas Celestiais ativa, o deslocamento de voo precisa aparecer na ficha')
    .toMatch(/Voo 9m/);

  await page.click('[data-revelacao-encerrar="1"]');
  await assentar(page).catch(() => {});

  const salvoEncerrado = await personagemSalvo(page);
  expect(salvoEncerrado?.recursos?.aasimar_revelacao_ativa, 'Encerrar transformação precisa limpar a forma ativa')
    .toBe('');

  const conteudoSemVoo = await page.evaluate(() => document.body.innerText);
  expect(conteudoSemVoo, 'depois de encerrar, o voo não pode continuar aparecendo')
    .not.toMatch(/Voo 9m/);

  expect(erros, 'nenhum erro de console').toEqual([]);
});
