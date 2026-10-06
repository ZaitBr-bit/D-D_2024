// ============================================================
// Companheiros do Artífice: criar, aplicar PV, Reparar, Detonar e dispensar.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, clicarSeletorFicha } from './helpers-regras.mjs';

const ATR = { forca: 8, destreza: 13, constituicao: 14, inteligencia: 16, sabedoria: 12, carisma: 10 };

/** Lê o personagem gravado. */
async function lerChar(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('dnd_personagens'))[0]);
}

// Todo clique de botão da ficha vai por clicarSeletorFicha (clique por DOM com espera/retentativa):
// a ficha re-renderiza depois de cada ação e `locator.click()` direto é fonte de flake sob 4 workers
// (mesma disciplina de artifice-ficha.spec.mjs e artifice-planos.spec.mjs).
const SEC = '#secao-companheiros-artifice';

/** Soma dos espaços de magia gastos na fonte de conjuração. */
async function espacosUsados(page) {
  return Object.values((await lerChar(page)).espacos_magia?.conjuracao || {}).reduce((s, n) => s + (Number(n) || 0), 0);
}

test('Ferreiro de Batalha: Defensor de Aço criado, PV aplicado, Reparar e dispensa', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', subclasse: 'Ferreiro de Batalha', nivel: 5, xp: 6500, atributos: ATR }, 'regras-artifice-defensor');
  const secao = page.locator(SEC);
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-criar"]`);
  await assentar(page).catch(() => {});
  await expect(secao.locator('[data-companheiro-cartao="defensor-de-aco"]')).toContainText('CA 15');
  await expect(secao.locator('[data-companheiro-cartao="defensor-de-aco"]')).toContainText('PV 30/30');
  await page.locator('#companheiro-pv-defensor-de-aco-0').fill('-7');
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-pv"]`);
  await assentar(page).catch(() => {});
  await expect(secao.locator('[data-companheiro-cartao="defensor-de-aco"]')).toContainText('PV 23/30');
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="defensor-reparar"]`);
  await assentar(page).catch(() => {});
  expect((await lerChar(page)).recursos.artifice.reparar_defensor_gastos).toBe(1);
  await expect(secao.locator('[data-artifice-acao="defensor-reparar"]')).toContainText('(2/3)');
  // Esgota os usos: o botão fica desabilitado em (0/3) e o contador não passa de 3.
  for (let k = 0; k < 2; k++) {
    await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="defensor-reparar"]`);
    await assentar(page).catch(() => {});
  }
  await expect(secao.locator('[data-artifice-acao="defensor-reparar"]')).toContainText('(0/3)');
  await expect(secao.locator('[data-artifice-acao="defensor-reparar"]')).toBeDisabled();
  expect((await lerChar(page)).recursos.artifice.reparar_defensor_gastos).toBe(3);
  // PV decimal é truncado: -2.9 vira -2 (30 - 7 = 23 -> 21).
  await page.locator('#companheiro-pv-defensor-de-aco-0').fill('-2.9');
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-pv"]`);
  await assentar(page).catch(() => {});
  await expect(secao.locator('[data-companheiro-cartao="defensor-de-aco"]')).toContainText('PV 21/30');
  // Fração que trunca para zero é recusada e não altera o PV.
  await page.locator('#companheiro-pv-defensor-de-aco-0').fill('0.5');
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-pv"]`);
  await expect(secao.locator('[data-companheiro-cartao="defensor-de-aco"]')).toContainText('PV 21/30');
  // Em 0 PV o defensor fica destruído: sem Aplicar PV nem Reparar; Reviver gasta um espaço e restaura os PV.
  await page.locator('#companheiro-pv-defensor-de-aco-0').fill('-99');
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-pv"]`);
  await assentar(page).catch(() => {});
  const cartaoDef = secao.locator('[data-companheiro-cartao="defensor-de-aco"]');
  await expect(cartaoDef).toContainText('PV 0/30');
  await expect(cartaoDef).toContainText('Destruído');
  await expect(cartaoDef.locator('[data-artifice-acao="companheiro-pv"]')).toBeDisabled();
  await expect(cartaoDef.locator('[data-artifice-acao="defensor-reparar"]')).toHaveCount(0);
  expect(await espacosUsados(page)).toBe(0);
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="defensor-reviver"]`);
  await assentar(page).catch(() => {});
  await expect(cartaoDef).toContainText('PV 30/30');
  await expect(cartaoDef).not.toContainText('Destruído');
  expect(await espacosUsados(page)).toBe(1);
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-dispensar"]`);
  await assentar(page).catch(() => {});
  await expect(secao.locator('[data-companheiro-cartao]')).toHaveCount(0);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Artilheiro 15: criação grátis cria os dois canhões; gastar espaço custa um por canhão; 0 PV remove; Detonar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', subclasse: 'Artilheiro', nivel: 15, xp: 165000, atributos: ATR }, 'regras-artifice-canhao');
  const secao = page.locator(SEC);
  // Com a criação grátis disponível não há botão de gastar espaço.
  await expect(secao.locator('[data-artifice-acao="companheiro-criar-espaco"]')).toHaveCount(0);
  await expect(secao.locator('[data-artifice-acao="companheiro-criar"]')).toHaveText('Criar 2 canhões (grátis)');
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-criar"]`);
  await assentar(page).catch(() => {});
  await expect(secao.locator('[data-companheiro-cartao="canhao-mistico"]')).toHaveCount(2);
  expect(await espacosUsados(page)).toBe(0);
  // Sem vaga (nunca um terceiro), não há botão de criar.
  await expect(secao.locator('[data-artifice-acao^="companheiro-criar"]')).toHaveCount(0);
  // Canhão em 0 PV desaparece.
  await page.locator('#companheiro-pv-canhao-mistico-1').fill('-999');
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-pv"][data-i="1"]`);
  await assentar(page).catch(() => {});
  await expect(secao.locator('[data-companheiro-cartao="canhao-mistico"]')).toHaveCount(1);
  // Criação grátis já usada: com uma vaga, gastar espaço cria um canhão por um espaço.
  await expect(secao.locator('[data-artifice-acao="companheiro-criar-espaco"]')).toHaveText('Criar gastando espaço');
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-criar-espaco"]`);
  await assentar(page).catch(() => {});
  await expect(secao.locator('[data-companheiro-cartao="canhao-mistico"]')).toHaveCount(2);
  // O espaço gasto fica em espacos_magia.conjuracao (mesma leitura do spec de Carregar, artifice-planos.spec.mjs).
  expect(await espacosUsados(page)).toBe(1);
  // Sem os dois canhões, gastar espaço cria os dois e custa dois espaços.
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="canhao-detonar"][data-i="0"]`);
  await expect(page.locator('#toast-container .toast').last()).toHaveText(/^Quando o canhão sofre dano/);
  await assentar(page).catch(() => {});
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="canhao-detonar"][data-i="0"]`);
  await assentar(page).catch(() => {});
  await expect(secao.locator('[data-companheiro-cartao="canhao-mistico"]')).toHaveCount(0);
  await expect(secao.locator('[data-artifice-acao="companheiro-criar-espaco"]')).toHaveText('Criar 2 canhões gastando 2 espaços');
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-criar-espaco"]`);
  await assentar(page).catch(() => {});
  await expect(secao.locator('[data-companheiro-cartao="canhao-mistico"]')).toHaveCount(2);
  expect(await espacosUsados(page)).toBe(3);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Servo Homúnculo aparece com a magia preparada e usa o círculo escolhido', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', nivel: 5, xp: 6500, atributos: ATR,
    magias_preparadas: [{ nome: 'Servo Homúnculo', circulo: 2, classe: 'Artífice' }],
  }, 'regras-artifice-servo');
  const secao = page.locator(SEC);
  // O botão só registra o servo (a magia é lançada na lista de magias).
  await expect(secao.locator('[data-artifice-acao="companheiro-criar"]')).toHaveText('Registrar servo');
  await expect(secao).toContainText('Magia já lançada na lista de magias');
  await page.locator('#servo-circulo').selectOption('3');
  await clicarSeletorFicha(page, `${SEC} [data-artifice-acao="companheiro-criar"]`);
  await assentar(page).catch(() => {});
  await expect(secao.locator('[data-companheiro-cartao="servo-homunculo"]')).toContainText('PV 20/20');
  await expect(secao.locator('[data-companheiro-cartao="servo-homunculo"]')).toContainText('(3º círculo)');
  expect((await lerChar(page)).recursos.artifice.companheiros['servo-homunculo'][0].circulo).toBe(3);
  expect(erros, erros.join('; ')).toEqual([]);
});

/** Abre todos os <details> da ficha para os botões ficarem visíveis. */
async function abrirTudo(page) {
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await assentar(page).catch(() => {});
}

test('subclasses do Plano 4: características passivas não ganham contador nem toggle genérico', async ({ context }) => {
  for (const [subclasse, nomes] of [['Ferreiro de Batalha', ['Pronto para a Batalha', 'Ataque Extra', 'Defensor Aprimorado']], ['Artilheiro', ['Arma de Fogo Arcana', 'Canhão Explosivo', 'Posição Fortificada']]]) {
    const { page, erros } = await abrirFicha(context, { classe: 'Artífice', subclasse, nivel: 15, xp: 165000, atributos: ATR }, `regras-artifice-passivas-${subclasse.charAt(0)}`);
    await abrirTudo(page);
    for (const nome of nomes) {
      const card = page.locator('details', { has: page.locator('summary', { hasText: nome }) }).first();
      await expect(card, nome).toBeVisible();
      await expect(card.locator('[data-toggle-uso], [data-usar-habilidade]'), nome).toHaveCount(0);
    }
    expect(erros, erros.join('; ')).toEqual([]);
  }
});

test('Ferreiro de Batalha 9: Golpe Arcano gasta um uso', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', subclasse: 'Ferreiro de Batalha', nivel: 9, xp: 48000, atributos: ATR }, 'regras-artifice-golpe');
  await abrirTudo(page);
  const card = page.locator('details', { has: page.locator('summary', { hasText: 'Golpe Arcano' }) }).first();
  // Int 16: mod +3, 3 usos.
  await expect(card.locator('summary')).toContainText('3/3');
  await clicarSeletorFicha(page, '[data-artifice-acao="golpe-arcano"]');
  await assentar(page).catch(() => {});
  expect((await lerChar(page)).recursos.artifice.golpe_arcano_gastos).toBe(1);
  await abrirTudo(page);
  await expect(card.locator('summary')).toContainText('2/3');
  for (let i = 0; i < 2; i++) {
    await clicarSeletorFicha(page, '[data-artifice-acao="golpe-arcano"]');
    await assentar(page).catch(() => {});
    await abrirTudo(page);
  }
  await expect(card.locator('summary')).toContainText('0/3');
  await expect(card.locator('[data-artifice-acao="golpe-arcano"]')).toBeDisabled();
  expect(erros, erros.join('; ')).toEqual([]);
});
