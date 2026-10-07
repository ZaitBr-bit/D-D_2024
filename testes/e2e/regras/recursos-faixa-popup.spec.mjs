// ============================================================
// Recursos de classe em chips: ficam no card Magias (conjuradores) ou no
// card "Recursos de Classe" (demais), e clicar no chip fora dos botões abre
// um popup com a descrição.
//
// Todos CLICAM: o que muda para o jogador é o clique no chip e o clique no
// botão do chip, e só o clique mede se um não atrapalha o outro.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirBlocosRecursos, ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha } from './helpers-regras.mjs';

const BRUXO = {
  classe: 'Bruxo', nivel: 5, xp: 14000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'Enganação'],
};
const MAGO = {
  classe: 'Mago', nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
};
const BARBARO = {
  classe: 'Bárbaro', nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'Sobrevivência'],
};

test('Bruxo: os recursos ficam na faixa do card Magias, não acima dos atributos de combate', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO, 'regras-faixa-bruxo');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);

  const faixa = page.locator('#faixa-recursos-magias');
  await expect(faixa, 'a faixa de recursos precisa estar visível no card Magias').toBeVisible();
  await expect(faixa.locator('[data-bruxo-astucia-acao="usar"]')).toBeVisible();
  await expect(faixa.locator('[data-bruxo-recursos="abrir"]')).toBeVisible();
  await expect(page.locator('.stats-row').locator('xpath=preceding-sibling::*[contains(@class,"recursos-grupo")]'),
    'nenhum painel de recurso pode sobrar acima de CA/Iniciativa').toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bruxo: clicar no chip abre o popup, e clicar no botão do chip não', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO, 'regras-faixa-bruxo-popup');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);

  const chip = page.locator('[data-recurso-info="bruxo-astucia-magica"]');
  await expect(chip).toBeVisible();

  await chip.locator('.recurso-chip-nome').click();
  await expect(page.locator('#modal-titulo'),
    'clicar no nome do chip precisa abrir o popup com a descrição').toContainText('Astúcia Mágica');
  await expect(page.locator('#modal-corpo')).toContainText('rito esotérico');
  await expect(page.locator('#modal-corpo .md-content')).toBeVisible();
  await page.locator('#modal-acoes').getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('#modal-overlay')).toBeHidden();

  await chip.locator('[data-bruxo-astucia-acao="usar"]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#modal-overlay'),
    'clicar no botão não pode abrir o popup de descrição').toBeHidden();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Mago: o painel de recursos mora dentro da faixa do card Magias', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO, 'regras-faixa-mago');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);

  await expect(page.locator('#faixa-recursos-magias #painel-recursos-mago')).toBeVisible();
  await expect(page.locator('#painel-recursos-mago [data-mago-acao="recuperacao-arcana"]')).toBeVisible();

  await page.locator('[data-recurso-info="mago-recuperacao-arcana"] .recurso-chip-nome').click();
  await expect(page.locator('#modal-titulo')).toContainText('Recuperação Arcana');
  await expect(page.locator('#modal-corpo')).toContainText('Descanso Curto');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bárbaro (sem magia): a Fúria fica no card Recursos de Classe e o chip abre o popup', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BARBARO, 'regras-faixa-barbaro');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);

  const card = page.locator('#card-recursos-classe');
  await expect(card, 'classe sem card de Magias precisa ganhar o card Recursos de Classe').toBeVisible();
  await expect(card.locator('[data-furia-toggle]')).toBeVisible();

  await card.locator('[data-recurso-info="barbaro-furia"] .recurso-chip-nome').click();
  await expect(page.locator('#modal-titulo')).toContainText('Fúria');
  await expect(page.locator('#modal-corpo .md-content')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bruxo: a descrição da invocação abre em popup e não estica o card', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO, 'regras-faixa-bruxo-invocacao');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);
  await clicarSeletorFicha(page, '[data-bruxo-recursos]', { esperar: '#bruxo-inv-grid' });
  await assentar(page).catch(() => {});

  const card = page.locator('[data-inv-card="Pacto da Lâmina"]');
  await expect(card).toBeVisible();
  const alturaAntes = (await card.boundingBox()).height;

  await page.locator('[data-inv-info="Pacto da Lâmina"]').click();
  const popup = page.locator('.inv-popup');
  await expect(popup, 'clicar no nome precisa abrir o popup').toBeVisible();
  await expect(popup).toContainText('Pacto da Lâmina');
  expect((await card.boundingBox()).height,
    'a descrição não pode crescer dentro do card').toBe(alturaAntes);

  await clicarSeletorFicha(page, '#btn-fechar-inv-popup');
  await expect(popup).toHaveCount(0);
  await expect(card, 'fechar o popup mantém o modal de recursos aberto').toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bruxo sem pacto: não existe chip "Pacto" enquanto só há outras invocações', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BRUXO, recursos: { bruxo: { invocacoes: [{ nome: 'Armadura de Sombras' }] } },
  }, 'regras-faixa-bruxo-sem-pacto');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);

  await expect(page.locator('[data-recurso-info="bruxo-invocacoes"]')).toContainText('Armadura de Sombras');
  await expect(page.locator('[data-recurso-info="bruxo-pacto"]'),
    'sem pacto escolhido o chip de Pacto não pode aparecer').toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('os blocos de recursos nascem recolhidos e abrem pelo cabeçalho', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO, 'regras-faixa-celular');
  await assentar(page).catch(() => {});

  const bloco = page.locator('#faixa-recursos-magias .recursos-grupo').first();
  await expect(bloco).toBeVisible();
  await expect(bloco.locator('.recursos-resumo'),
    'recolhido, o cabeçalho resume o estado dos recursos').toContainText('Astúcia Mágica');
  await expect(bloco.locator('[data-bruxo-astucia-acao="usar"]')).toBeHidden();

  await bloco.locator('summary').click();
  await expect(bloco.locator('[data-bruxo-astucia-acao="usar"]')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('multiclasse: o aviso de truques fecha pelo X e não volta nesta ficha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 2, xp: 300, especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'História'],
    classes: [
      { classe: 'Mago', subclasse: '', nivel: 1, ordem: 0 },
      { classe: 'Bruxo', subclasse: '', nivel: 1, ordem: 1 },
    ],
    schema_versao: 2,
  }, 'regras-aviso-truques');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);

  const aviso = page.locator('#aviso-truques-personagem-inteiro');
  await expect(aviso, 'o aviso precisa aparecer antes de ser dispensado').toBeVisible();
  await clicarSeletorFicha(page, '#btn-dispensar-aviso-truques');
  await expect(aviso).toHaveCount(0);

  await page.reload();
  await assentar(page).catch(() => {});
  await expect(page.locator('#aviso-truques-personagem-inteiro'),
    'depois de fechado o aviso não volta ao reabrir a ficha').toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('os botões ficam dentro do chip, sem vazar da largura do card', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Druida', nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Arcanismo', 'Natureza'],
  }, 'regras-faixa-botao-dentro');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);

  const vazaram = await page.evaluate(() => [...document.querySelectorAll('.recurso-chip')].flatMap((c) => {
    const limite = c.getBoundingClientRect().right;
    return [...c.querySelectorAll('.btn')].filter((b) => b.getBoundingClientRect().right > limite + 1).map((b) => b.textContent.trim());
  }));
  expect(vazaram, 'botão mais largo que o chip').toEqual([]);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
