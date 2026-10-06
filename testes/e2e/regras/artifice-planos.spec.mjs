// ============================================================
// Replicar Item Mágico: escolha de planos na subida de nível e itens
// replicados na ficha (criar, carregar, drenar, transmutar, trapacear a morte).
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, abrirModalLevelUp, clicarBotaoFicha, clicarSeletorFicha } from './helpers-regras.mjs';

// Planos escolhidos por id (independe da ordem do catálogo).
const QUATRO = ['alchemy-jug', 'bag-of-holding', 'cap-of-water-breathing', 'goggles-of-night'];

const ATR = { forca: 8, destreza: 13, constituicao: 14, inteligencia: 16, sabedoria: 12, carisma: 10 };

/** Lê o personagem gravado. */
async function lerChar(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('dnd_personagens'))[0]);
}

/** Avança com "Próximo" até o card de planos aparecer. */
async function irAtePlanos(page) {
  for (let i = 0; i < 10 && !(await page.locator('#levelup-planos-artifice').isVisible()); i++) {
    await page.locator('#btn-step-proximo').click();
    await assentar(page).catch(() => {});
  }
  await expect(page.locator('#levelup-planos-artifice')).toBeVisible();
}

/** Abre o sub-modal de adicionar e escolhe o plano pelo card (data-opcao = id do plano). */
async function adicionarPlano(page, planoId) {
  await page.locator('#btn-plano-adicionar').click();
  await page.locator(`#plano-escolha [data-opcao="${planoId}"]`).click();
}

/** Confirma o sub-modal e espera o redesenho do passo. */
async function confirmarPlano(page) {
  await page.locator('#btn-plano-confirmar').click();
  await assentar(page).catch(() => {});
}

/** Avança até o fim e confirma a subida. */
async function concluirSubida(page) {
  for (let i = 0; i < 10 && await page.locator('#btn-step-proximo').isVisible(); i++) {
    await page.locator('#btn-step-proximo').click();
    await assentar(page).catch(() => {});
  }
  if (await page.locator('#btn-confirmar-levelup').isVisible()) await page.locator('#btn-confirmar-levelup').click();
  await assentar(page).catch(() => {});
}

test('subida para o nível 2: escolher 4 planos e concluir', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', nivel: 1, xp: 300, atributos: ATR }, 'regras-artifice-planos-lvl2');
  expect(await abrirModalLevelUp(page)).toBe(true);
  await irAtePlanos(page);
  for (const id of QUATRO) {
    await adicionarPlano(page, id);
    await confirmarPlano(page);
  }
  // Remove um (data-plano-remover) e troca por outro: a lista final continua com 4.
  await page.locator('[data-plano-remover]').first().click();
  await adicionarPlano(page, 'manifold-tool');
  await confirmarPlano(page);
  await concluirSubida(page);
  const c = await lerChar(page);
  expect(c.nivel).toBe(2);
  expect(c.recursos.artifice.planos).toHaveLength(4);
  expect(c.recursos.artifice.planos.map((x) => x.plano_id).sort())
    .toEqual([...QUATRO.slice(1), 'manifold-tool'].sort());
  expect(erros, erros.join('; ')).toEqual([]);
});

test('plano genérico com item que exige base: seletor de base aparece e a subida conclui', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', nivel: 1, xp: 300, atributos: ATR }, 'regras-artifice-planos-base');
  expect(await abrirModalLevelUp(page)).toBe(true);
  await irAtePlanos(page);
  await adicionarPlano(page, 'common-magic-item');
  await page.locator('#plano-generico [data-opcao="arma-prateada|"]').click();
  await expect(page.locator('#plano-base')).toBeVisible();
  // Cards de base com informação (dano/propriedades) e escolha explícita.
  await expect(page.locator('#plano-base [data-opcao]').first()).toContainText(/[0-9]d[0-9]|CA/);
  await page.locator('#plano-base [data-opcao]').first().click();
  await expect(page.locator('#plano-armeiro')).toHaveCount(0);
  await confirmarPlano(page);
  for (const id of QUATRO.slice(0, 3)) {
    await adicionarPlano(page, id);
    await confirmarPlano(page);
  }
  await concluirSubida(page);
  const c = await lerChar(page);
  expect(c.nivel).toBe(2);
  const generico = c.recursos.artifice.planos.find((x) => x.item_id === 'arma-prateada');
  expect(generico?.base_nome, 'a base escolhida precisa ser gravada').toBeTruthy();
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Armeiro 9: a caixa do plano extra só aparece para item de Armadura', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', subclasse: 'Armeiro', nivel: 8, xp: 48000, atributos: ATR,
    classes: [{ classe: 'Artífice', subclasse: 'Armeiro', nivel: 8, ordem: 0 }], schema_versao: 2,
  }, 'regras-artifice-planos-armeiro');
  expect(await abrirModalLevelUp(page)).toBe(true);
  await irAtePlanos(page);
  await page.locator('#btn-plano-adicionar').click();
  await page.locator('#plano-escolha [data-opcao="alchemy-jug"]').click();
  await expect(page.locator('#plano-armeiro')).toBeHidden();
  await page.locator('#plano-escolha [data-opcao="armor-1"]').click();
  await expect(page.locator('#plano-armeiro')).toBeVisible();
  expect(erros, erros.join('; ')).toEqual([]);
});

test('multiclasse: subir Mago com Artífice 1 não mostra o passo de planos', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', subclasse: '', nivel: 4, xp: 6500, atributos: ATR, especie: 'Humano',
    classes: [{ classe: 'Mago', subclasse: '', nivel: 3, ordem: 0 }, { classe: 'Artífice', subclasse: '', nivel: 1, ordem: 1 }],
    schema_versao: 2,
  }, 'regras-artifice-planos-mago');
  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await page.locator('input[name="classe-que-sobe"][data-classe="Mago"]').check();
  let passos = 0;
  while (passos < 10 && await page.locator('#btn-step-proximo:not([disabled])').count()) {
    expect(await page.locator('#levelup-planos-artifice').count()).toBe(0);
    await page.locator('#btn-step-proximo').click();
    await assentar(page).catch(() => {});
    passos++;
  }
  expect(passos, 'o assistente precisa ter avançado ao menos um passo').toBeGreaterThan(0);
  expect(await page.locator('#levelup-planos-artifice').count()).toBe(0);
  expect(erros, erros.join('; ')).toEqual([]);
});

/** Personagem Artífice semeado já com planos conhecidos (ids reais de dados/tasha/artifice/planos.json). */
const PLANOS_SEMENTE = [
  { id: 'k1', plano_id: 'bag-of-holding', item_id: 'bolsa-devoradora' },
  { id: 'k2', plano_id: 'wand-of-secrets', item_id: 'varinha-dos-segredos' },
  { id: 'k3', plano_id: 'goggles-of-night', item_id: 'oculos-da-noite' },
  { id: 'k4', plano_id: 'wand-of-magic-detection', item_id: 'varinha-de-deteccao-de-magia' },
  { id: 'k5', plano_id: 'wand-of-magic-missiles', item_id: 'varinha-de-misseis-magicos' },
];

/** Abre todos os <details>. */
async function abrirTudo(page) {
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await assentar(page).catch(() => {});
}

/** Semeia um Artífice 6 com os planos de teste e cria os itens dos conhecidos `ids` pelo card. */
async function abrirComItens(context, id, ids, extra = {}) {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', nivel: 6, xp: 14000, atributos: ATR, recursos: { artifice: { planos: PLANOS_SEMENTE } }, ...extra,
  }, id);
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="replicar-criar"]');
  for (const k of ids) await page.locator(`#replicar-conhecidos [data-opcao="${k}"]`).click();
  await page.locator('#btn-replicar-confirmar').click();
  await assentar(page).catch(() => {});
  return { page, erros };
}

/** Altera o personagem gravado e recarrega a ficha. */
async function editarEReabrir(page, editar) {
  await page.evaluate((corpo) => {
    const lista = JSON.parse(localStorage.getItem('dnd_personagens'));
    // eslint-disable-next-line no-new-func
    new Function('c', corpo)(lista[0]);
    localStorage.setItem('dnd_personagens', JSON.stringify(lista));
  }, editar);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page);
  await abrirTudo(page);
}

test('criar, transmutar, drenar e gastar o espaço temporário de itens replicados', async ({ context }) => {
  const { page, erros } = await abrirComItens(context, 'regras-artifice-replicar', ['k2', 'k5']);
  let c = await lerChar(page);
  expect(c.inventario.filter((i) => i.origem?.tipo === 'replicado')).toHaveLength(2);
  // Selo 'Replicado' no inventário e sem botões de quantidade para esses itens.
  await expect(page.locator('.inv-item-badges', { hasText: 'Replicado' })).toHaveCount(2);
  await expect(page.locator('[data-qty-plus]')).toHaveCount(0);
  // Os botões identificam o item pelo conhecido, nunca por índice do inventário.
  await abrirTudo(page);
  await expect(page.locator('[data-artifice-acao^="replicar-"][data-idx]')).toHaveCount(0);

  // Transmutar o k2 (primeiro do inventário) em outro conhecido sem item.
  await clicarSeletorFicha(page, '[data-artifice-acao="replicar-transmutar"][data-conhecido="k2"]');
  await page.locator('#transmutar-destino [data-opcao="k3"]').click();
  await page.locator('#btn-transmutar-confirmar').click();
  await assentar(page).catch(() => {});
  c = await lerChar(page);
  expect(c.recursos.artifice.transmutar_usado).toBe(true);
  const replic = c.inventario.filter((i) => i.origem?.tipo === 'replicado');
  expect(replic).toHaveLength(2);
  expect(replic.some((i) => i.origem.conhecido_id === 'k2')).toBe(false);
  expect(replic.some((i) => i.origem.conhecido_id === 'k3')).toBe(true);
  expect(replic.some((i) => i.origem.conhecido_id === 'k5')).toBe(true);

  // Drenar o k5 enquanto o outro item replicado vem antes no inventário: só o k5 sai.
  const k5 = replic.find((i) => i.origem.conhecido_id === 'k5');
  const circulo = k5.dados.raridade === 'Comum' ? 1 : 2;
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="replicar-drenar"][data-conhecido="k5"]');
  await assentar(page).catch(() => {});
  c = await lerChar(page);
  expect(c.recursos.artifice.drenar_usado).toBe(true);
  expect(c.inventario.filter((i) => i.origem?.tipo === 'replicado')).toHaveLength(1);
  expect(c.inventario.some((i) => i.origem?.conhecido_id === 'k5')).toBe(false);
  // Sem espaço gasto para devolver, fica um espaço temporário do círculo do item.
  expect(c.recursos.artifice.espaco_temporario?.circulo).toBe(circulo);
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="espaco-temporario"]');
  await assentar(page).catch(() => {});
  c = await lerChar(page);
  expect(c.recursos.artifice.espaco_temporario).toBeNull();
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Carregar soma cargas do círculo ao item, gasta 1 espaço e recusa item cheio sem gastar', async ({ context }) => {
  const { page, erros } = await abrirComItens(context, 'regras-artifice-carregar', ['k5']);
  const usadosDe = (c, circ) => (c.espacos_magia?.conjuracao?.[circ] || 0);
  let c = await lerChar(page);
  const max = c.inventario.find((i) => i.origem?.conhecido_id === 'k5').dados.recursos.cargas.max;
  await editarEReabrir(page, "c.inventario.find((i) => i.origem && i.origem.conhecido_id === 'k5').estado_recursos.cargas = 0;");

  await clicarSeletorFicha(page, '[data-artifice-acao="replicar-carregar"][data-conhecido="k5"]');
  const circulo = Number((await page.locator('#carregar-espaco').inputValue()).split('|')[1]);
  const antes = usadosDe(await lerChar(page), circulo);
  await page.locator('#btn-carregar-confirmar').click();
  await assentar(page).catch(() => {});
  c = await lerChar(page);
  expect(c.inventario.find((i) => i.origem?.conhecido_id === 'k5').estado_recursos.cargas).toBe(Math.min(max, circulo));
  expect(usadosDe(c, circulo)).toBe(antes + 1);

  // Cargas cheias: botão desabilitado e nenhum espaço gasto.
  await editarEReabrir(page, "delete c.inventario.find((i) => i.origem && i.origem.conhecido_id === 'k5').estado_recursos.cargas;");
  const antesCheio = usadosDe(await lerChar(page), circulo);
  await expect(page.locator('[data-artifice-acao="replicar-carregar"][data-conhecido="k5"]')).toBeDisabled();
  expect(usadosDe(await lerChar(page), circulo)).toBe(antesCheio);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Descanso Longo oferece Criar Itens Replicados', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', nivel: 6, xp: 14000, atributos: ATR, recursos: { artifice: { planos: PLANOS_SEMENTE } },
  }, 'regras-artifice-replicar-dl');
  // #btn-descanso-longo fica num FAB oculto: só o clique por DOM (clicarBotaoFicha) o aciona; não há passo de confirmação.
  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#btn-replicar-dl' });
  await page.locator('#btn-replicar-dl').click();
  await page.locator('#replicar-conhecidos [data-opcao="k1"]').click();
  await page.locator('#btn-replicar-confirmar').click();
  await assentar(page).catch(() => {});
  const c = await lerChar(page);
  expect(c.inventario.some((i) => i.origem?.conhecido_id === 'k1')).toBe(true);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Trapacear a Morte com 0 PV desintegra o item, zera salvaguardas e limita ao PV máximo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', nivel: 20, xp: 355000, atributos: ATR, pv_max: 100, pv_atual: 0, morte_sucessos: 2, morte_falhas: 1,
    recursos: { artifice: { planos: PLANOS_SEMENTE } },
  }, 'regras-artifice-trapacear');
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="replicar-criar"]');
  await page.locator('#replicar-conhecidos [data-opcao="k1"]').click();
  await page.locator('#btn-replicar-confirmar').click();
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="trapacear-morte"]', { esperar: '#trapacear-itens [data-opcao]' });
  // O item elegível já vem marcado no card; o clique de confirmação desintegra.
  await expect(page.locator('#trapacear-itens [data-opcao].selecionada')).toHaveCount(1);
  await page.locator('#btn-trapacear-confirmar').click();
  await assentar(page).catch(() => {});
  const c = await lerChar(page);
  expect(c.pv_atual).toBe(20);
  expect(c.morte_sucessos).toBe(0);
  expect(c.morte_falhas).toBe(0);
  expect(c.inventario.some((i) => i.origem?.conhecido_id === 'k1')).toBe(false);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Trapacear a Morte não passa do PV máximo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', nivel: 20, xp: 355000, atributos: ATR, pv_max: 15, pv_atual: 0, recursos: { artifice: { planos: PLANOS_SEMENTE } },
  }, 'regras-artifice-trapacear-teto');
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="replicar-criar"]');
  await page.locator('#replicar-conhecidos [data-opcao="k1"]').click();
  await page.locator('#btn-replicar-confirmar').click();
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="trapacear-morte"]');
  await page.locator('#btn-trapacear-confirmar').click();
  await assentar(page).catch(() => {});
  expect((await lerChar(page)).pv_atual).toBe(15);
  expect(erros, erros.join('; ')).toEqual([]);
});
