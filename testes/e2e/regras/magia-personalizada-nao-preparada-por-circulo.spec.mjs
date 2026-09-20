// ============================================================
// Issues #75/#92 -- a seção "Personalizadas não preparadas" agrupa por
// círculo (mesmo padrão visual dos blocos "Nº Círculo" da lista de
// Preparadas) e nasce minimizada por padrão. Este spec clica de verdade
// no <summary> da seção e do círculo para confirmar que abrir/ver o
// conteúdo funciona, não só que o HTML foi gerado.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

const CLERIGO_5 = {
  classe: 'Clérigo', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Religião', 'Medicina'],
  magias_customizadas: [
    { nome: 'Chama Azul', circulo: 1, sempre_preparada: false,
      escola: 'Evocação', tempo_conjuracao: 'Ação', alcance: '18 metros',
      componentes: 'V, S', duracao: 'Instantânea', descricao: 'Uma chama azulada.', ritual: false },
    { nome: 'Raio Verde', circulo: 2, sempre_preparada: false,
      escola: 'Evocação', tempo_conjuracao: 'Ação', alcance: '18 metros',
      componentes: 'V, S', duracao: 'Instantânea', descricao: 'Um raio esverdeado.', ritual: false },
  ],
};

test('a seção "não preparadas" nasce fechada; clicar nela e no círculo revela as magias agrupadas', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, CLERIGO_5, 'regras-issue75-92-nao-preparadas-circulo');
  await assentar(page).catch(() => {});

  const secao = page.locator('[data-details-id="magias-personalizadas-nao-preparadas"]');
  await expect(secao).toBeVisible();
  await expect(secao, 'a seção precisa nascer FECHADA -- issue #92').not.toHaveJSProperty('open', true);

  // Clique real no <summary> da seção -- abre e revela os dois blocos de círculo.
  // `> summary` (filho direto): a seção também contém os <summary> dos
  // círculos aninhados dentro dela, e `.locator('summary')` sem o `>`
  // casaria com os três.
  await secao.locator('> summary').click();
  await expect(secao).toHaveJSProperty('open', true);

  const blocoCirc1 = secao.locator('[data-details-id="magias-personalizadas-nao-preparadas-circulo-1"]');
  const blocoCirc2 = secao.locator('[data-details-id="magias-personalizadas-nao-preparadas-circulo-2"]');
  await expect(blocoCirc1).toBeVisible();
  await expect(blocoCirc2).toBeVisible();
  await expect(blocoCirc1, 'o bloco de círculo também nasce fechado').not.toHaveJSProperty('open', true);

  // Clique real no <summary> do círculo 1 -- só ele abre, o círculo 2 continua fechado.
  await blocoCirc1.locator('> summary').click();
  await expect(blocoCirc1).toHaveJSProperty('open', true);
  await expect(blocoCirc2).not.toHaveJSProperty('open', true);

  await expect(blocoCirc1).toContainText('Chama Azul');
  await expect(blocoCirc1).not.toContainText('Raio Verde');
  await expect(blocoCirc2).toContainText('Raio Verde');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
