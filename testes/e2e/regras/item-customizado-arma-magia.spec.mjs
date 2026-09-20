// ============================================================
// Issues #82/#37 -- item customizado com bonus mecanico: categoria de
// arma (simples/marcial), propriedades, maestria, e bonus de
// ataque/CD de magia -- plugados no MESMO motor de calculo que a arma
// de catalogo/a conjuracao da ficha ja usam. Antes destes campos, o
// formulario nao tinha onde anotar nenhum dos dois.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

// Forca 15 (+2) e Destreza 14 (+2): empatados de proposito, para o teste
// nao depender de qual o motor escolheu em Acuidade.
const GUERREIRO = {
  classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
};

test('item customizado com categoria de arma: Atq/Dano/Maestria calculados como uma arma de catálogo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-item-custom-arma');
  await assentar(page).catch(() => {});

  await page.click('#btn-add-inv-custom');
  await page.waitForSelector('#ic-nome', { state: 'visible', timeout: 20_000 });

  await page.fill('#ic-nome', 'Espada Ancestral do Zait');
  await page.fill('#ic-dano', '1d8 Cortante');
  await page.selectOption('#ic-categoria', 'Armas Marciais Corpo a Corpo');
  await page.fill('#ic-propriedades', 'Acuidade, Leve');
  await page.selectOption('#ic-maestria', 'Trespassar');
  await page.click('#btn-add-ic');

  await expect(page.locator('#toast-container'),
    'o item precisa ter sido adicionado; se a validação barrou, nada foi gravado')
    .toContainText('adicionado');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const item = (salvo?.inventario || []).find(i => i.nome === 'Espada Ancestral do Zait');
  expect(item?.dados?.categoria, 'a categoria de arma tem de ser gravada').toBe('Armas Marciais Corpo a Corpo');
  expect(item?.dados?.propriedades, 'as propriedades tem de ser gravadas').toBe('Acuidade, Leve');
  expect(item?.dados?.maestria, 'a maestria tem de ser gravada').toBe('Trespassar');

  // Guerreiro (Marcial) + Forca 15/Destreza 14 (+2 cada, empatados) + Bônus
  // de Proficiência nível 3 (+2) = Atq +4 -- o MESMO cálculo que uma arma
  // Marcial de catálogo com Acuidade já usa (inventario.js).
  await expect(page.locator('text=/Atq \\+4/')).toBeVisible();
  await expect(page.locator('text=Dano 1d8+2 Cortante')).toBeVisible();
  await expect(page.locator('text=Maestria: Trespassar')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('item customizado SEM categoria de arma continua mostrando o bônus bruto de ataque (regressão)', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-item-custom-nao-arma');
  await assentar(page).catch(() => {});

  await page.click('#btn-add-inv-custom');
  await page.waitForSelector('#ic-nome', { state: 'visible', timeout: 20_000 });

  await page.fill('#ic-nome', 'Anel de Ataque Estranho');
  await page.fill('#ic-atq', '7');
  await page.click('#btn-add-ic');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await assentar(page).catch(() => {});

  // Sem categoria escolhida, o item NÃO vira arma -- continua mostrando o
  // bônus bruto digitado (comportamento antigo), não um cálculo de Força/
  // Destreza que o campo nunca pediu.
  await expect(page.locator('text=/Atq \\+7/')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('item customizado com bônus de magia EQUIPADO: CD Magia e Atq. Magia da ficha sobem', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 5, xp: 6500,
    atributos: { forca: 10, destreza: 14, constituicao: 14, inteligencia: 16, sabedoria: 10, carisma: 10 },
    pericias_proficientes: ['Arcanismo', 'Investigação'],
  }, 'regras-item-custom-bonus-magia');
  await assentar(page).catch(() => {});

  const cdAntes = await page.locator('.stat-box', { hasText: 'CD Magia' }).locator('.stat-value').innerText();
  const atqAntes = await page.locator('.stat-box', { hasText: 'Atq. Magia' }).locator('.stat-value').innerText();

  await page.click('#btn-add-inv-custom');
  await page.waitForSelector('#ic-nome', { state: 'visible', timeout: 20_000 });
  await page.fill('#ic-nome', 'Cajado do Zait');
  await page.fill('#ic-cd-magia', '1');
  await page.fill('#ic-atq-magia', '2');
  await page.click('#btn-add-ic');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await assentar(page).catch(() => {});

  // O item precisa estar EQUIPADO para contar -- clique real na caixa "Eq.".
  await page.locator('.inv-item', { hasText: 'Cajado do Zait' }).locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});

  await expect.poll(() => page.locator('.stat-box', { hasText: 'CD Magia' }).locator('.stat-value').innerText(),
    { message: 'CD Magia tem de subir +1 com o item equipado' })
    .toBe(String(Number(cdAntes) + 1));
  await expect.poll(() => page.locator('.stat-box', { hasText: 'Atq. Magia' }).locator('.stat-value').innerText(),
    { message: 'Atq. Magia tem de subir +2 com o item equipado' })
    .toBe(`+${Number(atqAntes.replace('+', '')) + 2}`);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
