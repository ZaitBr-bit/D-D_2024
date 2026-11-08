// ============================================================
// Lâmina Maldita (Bruxo, Xanathar): selo da Maldição na seção Ataques,
// fim da Maldição ao ficar Incapacitado e recuperação no Descanso Curto.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, marcarCondicao, personagemSalvo } from './helpers-regras.mjs';

const ESPADA_LONGA = {
  nome: 'Espada Longa', tipo: 'arma', quantidade: 1, equipado: true, descricao: '',
  dados: { categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante', propriedades: 'Versátil (1d10)', peso: '1,5 kg' },
};

/** Bruxo 3 da Lâmina Maldita, Car 16, com a Espada Longa equipada e o estado dado. */
const BRUXO_MALDITO = (lamina) => ({
  classe: 'Bruxo', subclasse: 'Patrono Lâmina Maldita', nivel: 3, xp: 900,
  atributos: { ...ATRIBUTOS_REGRAS, carisma: 16 }, inventario: [ESPADA_LONGA],
  recursos: { lamina_maldita: lamina },
});

/** Linha da Espada Longa na seção Ataques. */
const linhaLonga = (page) => page.locator('#secao-ataques .ataque-item', { hasText: 'Espada Longa' });

test('Maldição ativa: selo +2 e crítico 19–20 na linha de ataque, dano inalterado', async ({ context }) => {
  const sem = await abrirFicha(context, BRUXO_MALDITO({}), 'maldita-sem');
  await assentar(sem.page).catch(() => {});
  await expect(linhaLonga(sem.page)).toBeVisible();
  await expect(linhaLonga(sem.page).locator('[data-selo-maldicao]')).toHaveCount(0);
  const danoSem = (await linhaLonga(sem.page).locator('.badge', { hasText: 'Dano' }).innerText()).trim();

  const { page, erros } = await abrirFicha(context, BRUXO_MALDITO({ maldicao_ativa: true, maldicao_usada: true }), 'maldita-ativa');
  await assentar(page).catch(() => {});
  const selo = linhaLonga(page).locator('[data-selo-maldicao]');
  await expect(selo).toContainText('+2 amaldiçoado');
  await expect(selo).toContainText('19–20');
  expect((await linhaLonga(page).locator('.badge', { hasText: 'Dano' }).innerText()).trim()).toBe(danoSem);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficar Atordoado encerra a Maldição e some o selo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO_MALDITO({ maldicao_ativa: true, maldicao_usada: true }), 'maldita-atordoado');
  await assentar(page).catch(() => {});
  await expect(linhaLonga(page).locator('[data-selo-maldicao]')).toHaveCount(1);
  await marcarCondicao(page, 'Atordoado');
  await expect(linhaLonga(page).locator('[data-selo-maldicao]')).toHaveCount(0);
  const salvo = await personagemSalvo(page);
  expect(salvo.recursos.lamina_maldita.maldicao_ativa).toBe(false);
  expect(salvo.recursos.lamina_maldita.maldicao_usada).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Descanso Curto devolve o uso da Maldição e mantém o do Espectro', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO_MALDITO({ maldicao_usada: true, espectro_usado: true }), 'maldita-descanso');
  await assentar(page).catch(() => {});
  await clicarBotaoFicha(page, 'btn-descanso-curto');
  await assentar(page).catch(() => {});
  await expect.poll(async () => (await personagemSalvo(page)).recursos.lamina_maldita.maldicao_usada).toBe(false);
  const salvo = await personagemSalvo(page);
  expect(salvo.recursos.lamina_maldita.espectro_usado).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ---------- Seção "Lâmina Maldita" da ficha ----------

/** Bruxo de nível dado, Car 16, PV 70/100, com o estado de Lâmina Maldita dado. */
const BRUXO_NIVEL = (nivel, lamina = {}) => ({
  ...BRUXO_MALDITO(lamina), nivel, xp: 355000, pv_max: 100, pv_atual: 70,
});

/** Botão de ação da seção Lâmina Maldita. */
const acaoMaldita = (page, acao) => page.locator(`[data-lamina-maldita-acao="${acao}"]`);

/** Abre o bloco recolhível da seção (nasce fechado) e confere que nasceu fechado. */
async function abrirSecaoMaldita(page) {
  const bloco = page.locator('details[data-details-id="lamina-maldita"]');
  await expect(bloco).toHaveCount(1);
  expect(await bloco.evaluate((el) => el.open)).toBe(false);
  await bloco.locator('> summary').click();
  await expect(bloco).toHaveAttribute('open', '');
}

test('Bruxo 14: Amaldiçoar, passar, cura de 17 PV ao alvo morrer e encerra a Maldição', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO_NIVEL(14), 'maldita-secao');
  await assentar(page).catch(() => {});
  await abrirSecaoMaldita(page);

  await expect(acaoMaldita(page, 'alvo-morreu')).toBeDisabled();
  await acaoMaldita(page, 'amaldicoar').click();
  await expect.poll(async () => (await personagemSalvo(page)).recursos.lamina_maldita.maldicao_ativa).toBe(true);
  await expect(linhaLonga(page).locator('[data-selo-maldicao]')).toHaveCount(1);
  await expect(acaoMaldita(page, 'amaldicoar')).toBeDisabled();

  await acaoMaldita(page, 'alvo-morreu').click();
  await expect(acaoMaldita(page, 'passar')).toBeVisible();
  await acaoMaldita(page, 'passar').click();
  const aposPassar = await personagemSalvo(page);
  expect(aposPassar.recursos.lamina_maldita.maldicao_ativa).toBe(true);
  expect(aposPassar.pv_atual).toBe(70);

  await acaoMaldita(page, 'alvo-morreu').click();
  await acaoMaldita(page, 'curar').click();
  await expect.poll(async () => (await personagemSalvo(page)).pv_atual).toBe(87);
  expect((await personagemSalvo(page)).recursos.lamina_maldita.maldicao_ativa).toBe(false);
  await expect(linhaLonga(page).locator('[data-selo-maldicao]')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bruxo 14: Armadura de Maldições mostra o resultado do d6 e Encerrar remove o selo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO_NIVEL(14, { maldicao_ativa: true, maldicao_usada: true }), 'maldita-armadura');
  await assentar(page).catch(() => {});
  await abrirSecaoMaldita(page);
  await acaoMaldita(page, 'armadura').click();
  await expect(page.locator('[data-lamina-maldita-resultado]')).toContainText(/erra|acerta/);
  await acaoMaldita(page, 'encerrar').click();
  await expect(linhaLonga(page).locator('[data-selo-maldicao]')).toHaveCount(0);
  const salvo = await personagemSalvo(page);
  expect(salvo.recursos.lamina_maldita.maldicao_ativa).toBe(false);
  expect(salvo.recursos.lamina_maldita.maldicao_usada).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bruxo 14: Espectro Amaldiçoado levanta com 7 PV temporários e ataque +3, e dispensa sem devolver o uso', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO_NIVEL(14), 'maldita-espectro');
  await assentar(page).catch(() => {});
  await abrirSecaoMaldita(page);
  await acaoMaldita(page, 'levantar-espectro').click();
  const card = page.locator('[data-lamina-maldita-espectro]');
  await expect(card).toContainText('Espectro');
  await expect(card).toContainText('PV temporários: 7');
  await expect(card).toContainText('+7 para acertar');
  await card.click();
  await expect(page.getByText('Drenar Vida').first()).toBeVisible();
  await page.locator('#btn-fechar-familiar-popup').click();
  await expect(acaoMaldita(page, 'levantar-espectro')).toBeDisabled();
  await acaoMaldita(page, 'dispensar-espectro').click();
  await expect(card).toHaveCount(0);
  const salvo = await personagemSalvo(page);
  expect(salvo.recursos.lamina_maldita.espectro_usado).toBe(true);
  expect(salvo.recursos.lamina_maldita.espectro_ativo).toBe(false);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bruxo 3: sem Espectro, Armadura de Maldições nem escolha de passar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO_NIVEL(3, { maldicao_ativa: true, maldicao_usada: true }), 'maldita-nivel3');
  await assentar(page).catch(() => {});
  await abrirSecaoMaldita(page);
  await expect(acaoMaldita(page, 'alvo-morreu')).toBeEnabled();
  await acaoMaldita(page, 'alvo-morreu').click();
  await expect(acaoMaldita(page, 'curar')).toBeVisible();
  await expect(acaoMaldita(page, 'passar')).toHaveCount(0);
  await expect(acaoMaldita(page, 'levantar-espectro')).toHaveCount(0);
  await expect(acaoMaldita(page, 'armadura')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

/** Aplica dano pelo botão "Dano" da ficha e espera o modal fechar. */
async function aplicarDano(page, valor) {
  await clicarBotaoFicha(page, 'hp-minus', { esperar: '#btn-aplicar-dano' });
  await page.locator('#input-dano-manual').fill(String(valor));
  await page.locator('#input-dano-manual').dispatchEvent('change');
  await expect(page.locator('#input-dano-val')).toHaveValue(String(valor));
  await page.locator('#btn-aplicar-dano').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await assentar(page).catch(() => {});
}

test('cair a 0 PV encerra a Maldição e some o selo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO_NIVEL(5, { maldicao_ativa: true, maldicao_usada: true }), 'maldita-zero-pv');
  await assentar(page).catch(() => {});
  await expect(linhaLonga(page).locator('[data-selo-maldicao]')).toHaveCount(1);
  await aplicarDano(page, 70);
  await expect(linhaLonga(page).locator('[data-selo-maldicao]')).toHaveCount(0);
  const salvo = await personagemSalvo(page);
  expect(salvo.pv_atual).toBe(0);
  expect(salvo.recursos.lamina_maldita.maldicao_ativa).toBe(false);
  expect(salvo.recursos.lamina_maldita.maldicao_usada).toBe(true);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bruxo 14: a cura ao alvo morrer para no PV máximo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { ...BRUXO_NIVEL(14, { maldicao_ativa: true, maldicao_usada: true }), pv_atual: 95 }, 'maldita-cura-teto');
  await assentar(page).catch(() => {});
  await abrirSecaoMaldita(page);
  await acaoMaldita(page, 'alvo-morreu').click();
  await acaoMaldita(page, 'curar').click();
  await expect.poll(async () => (await personagemSalvo(page)).pv_atual).toBe(100);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bruxo 10 sem Maldição: Armadura de Maldições aparece desabilitada', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO_NIVEL(10), 'maldita-armadura-off');
  await assentar(page).catch(() => {});
  await abrirSecaoMaldita(page);
  await expect(acaoMaldita(page, 'armadura')).toBeDisabled();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
