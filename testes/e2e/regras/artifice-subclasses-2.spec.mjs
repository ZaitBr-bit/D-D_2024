// ============================================================
// Subclasses do Artífice (parte II): elixires, Armadura Arcana e modelos,
// Atlas do Aventureiro.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, clicarBotaoFicha, clicarSeletorFicha } from './helpers-regras.mjs';

const ATR = { forca: 8, destreza: 13, constituicao: 14, inteligencia: 16, sabedoria: 12, carisma: 10 };

/** Lê o personagem gravado. */
async function lerChar(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('dnd_personagens'))[0]);
}

/** Abre todos os <details>. */
async function abrirTudo(page) {
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await assentar(page).catch(() => {});
}

test('Alquimista 15: selo Imune: Envenenado e resistências aparecem na ficha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', subclasse: 'Alquimista', nivel: 15, xp: 165000, atributos: ATR,
    resistencias: ['Ácido', 'Venenoso'], imunidades_condicao: ['Envenenado'],
  }, 'regras-artifice-alq-defesas');
  await abrirTudo(page);
  await expect(page.locator('body')).toContainText('Imune: Envenenado');
  // Restringe à linha "Resistencias:" do card Defesas: o texto de magias e características não conta.
  const defesas = page.locator('.card', { has: page.locator('h2', { hasText: 'Defesas' }) });
  const linhaResistencias = defesas.locator('div', { hasText: /^Resistencias:/ }).first();
  await expect(linhaResistencias).toContainText('Ácido');
  await expect(linhaResistencias).toContainText('Venenoso');
  expect(erros, erros.join('; ')).toEqual([]);
});

test('subclasses do Plano 5: características passivas não ganham contador nem toggle genérico', async ({ context }) => {
  const casos = [
    ['Alquimista', ['Reagentes Restauradores', 'Maestria Química']],
    ['Armeiro', ['Ataque Extra', 'Armeiro Aprimorado', 'Armadura Perfeita']],
    ['Cartógrafo', ['Magia de Mapeamento', 'Atlas Superior']],
  ];
  for (const [subclasse, nomes] of casos) {
    const { page, erros } = await abrirFicha(context, { classe: 'Artífice', subclasse, nivel: 15, xp: 165000, atributos: ATR }, `regras-artifice-passivas2-${subclasse.charAt(0)}`);
    await abrirTudo(page);
    for (const nome of nomes) {
      const card = page.locator('details', { has: page.locator('summary', { hasText: nome }) }).first();
      await expect(card, nome).toBeVisible();
      await expect(card.locator('[data-toggle-uso], [data-usar-habilidade]'), nome).toHaveCount(0);
    }
    expect(erros, erros.join('; ')).toEqual([]);
  }
});

test('Alquimista 15: Gerenciar condições bloqueia Envenenado com a fonte "Característica de classe"', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', subclasse: 'Alquimista', nivel: 15, xp: 165000, atributos: ATR,
    resistencias: ['Ácido', 'Venenoso'], imunidades_condicao: ['Envenenado'],
  }, 'regras-artifice-alq-condicoes');
  await clicarSeletorFicha(page, '#btn-gerenciar-condicoes', { esperar: '[data-condicao-toggle="Envenenado"]' });
  const card = page.locator('[data-condicao-toggle="Envenenado"]');
  await expect(card).toHaveClass(/disabled/);
  await expect(card).toContainText('Imune (Característica de classe)');
  // Uma condição sem imunidade continua selecionável.
  await expect(page.locator('[data-condicao-toggle="Cego"]')).not.toHaveClass(/disabled/);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Alquimista: criar elixir gastando espaço; Descanso Longo troca os elixires', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', subclasse: 'Alquimista', nivel: 3, xp: 900, atributos: ATR }, 'regras-artifice-elixir');
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="elixir-criar"]', { esperar: '#elixir-efeito' });
  await page.locator('#elixir-efeito [data-opcao="Voo"] .opcao-check').click();
  await clicarSeletorFicha(page, '#btn-elixir-confirmar');
  await assentar(page).catch(() => {});
  expect((await lerChar(page)).inventario.filter((i) => i.origem?.tipo === 'elixir').map((i) => i.nome)).toEqual(['Elixir Experimental (Voo)']);
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  if (await page.locator('#btn-pular-troca-dl').isVisible().catch(() => false)) await page.locator('#btn-pular-troca-dl').click();
  await assentar(page).catch(() => {});
  // O elixir criado antes do descanso (1) sumiu; nasceram exatamente os 2 do Alquimista 3.
  const elixires = (await lerChar(page)).inventario.filter((i) => i.origem?.tipo === 'elixir');
  expect(elixires).toHaveLength(2);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Alquimista: elixir da rolagem 6 recebe o efeito escolhido pelo card', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', subclasse: 'Alquimista', nivel: 3, xp: 900, atributos: ATR,
    inventario: [{ nome: 'Elixir Experimental (Escolha)', tipo: 'magico', quantidade: 1, equipado: false, descricao: '',
      dados: { tipo_item: 'Consumível', raridade: '', requer_sintonizacao: false, descricao_magica: 'Escolha.' },
      origem: { tipo: 'elixir', expira: 'descanso_longo' } }],
  }, 'regras-artifice-elixir-escolha');
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="elixir-definir"]', { esperar: '#elixir-efeito' });
  await page.locator('#elixir-efeito [data-opcao="Rapidez"] .opcao-check').click();
  await clicarSeletorFicha(page, '#btn-elixir-definir-confirmar');
  await assentar(page).catch(() => {});
  expect((await lerChar(page)).inventario[0].nome).toBe('Elixir Experimental (Rapidez)');
  expect(erros, erros.join('; ')).toEqual([]);
});

/** Total de espaços de magia de conjuração gastos. */
function espacosGastos(c) {
  return Object.values(c.espacos_magia?.conjuracao || {}).reduce((s, n) => s + (Number(n) || 0), 0);
}

test('Alquimista: Criar elixir consome exatamente um espaço de magia', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', subclasse: 'Alquimista', nivel: 3, xp: 900, atributos: ATR }, 'regras-artifice-elixir-espaco');
  await abrirTudo(page);
  const antes = espacosGastos(await lerChar(page));
  await clicarSeletorFicha(page, '[data-artifice-acao="elixir-criar"]', { esperar: '#elixir-efeito' });
  await page.locator('#elixir-efeito [data-opcao="Cura"] .opcao-check').click();
  await clicarSeletorFicha(page, '#btn-elixir-confirmar');
  await assentar(page).catch(() => {});
  const c = await lerChar(page);
  expect(espacosGastos(c)).toBe(antes + 1);
  expect(c.inventario.filter((i) => i.origem?.tipo === 'elixir')).toHaveLength(1);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Alquimista: Criar elixir sem espaço disponível recusa e não cria o elixir', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', subclasse: 'Alquimista', nivel: 3, xp: 900, atributos: ATR,
    espacos_magia: { conjuracao: { 1: 3 }, pacto: {} },
  }, 'regras-artifice-elixir-sem-espaco');
  await abrirTudo(page);
  const antes = await lerChar(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="elixir-criar"]', { esperar: '#elixir-efeito' });
  await page.locator('#elixir-efeito [data-opcao="Cura"] .opcao-check').click();
  await page.locator('#btn-elixir-confirmar').click();
  await assentar(page).catch(() => {});
  // O fluxo não conclui: o modal continua aberto e nada muda no personagem.
  await expect(page.locator('#btn-elixir-confirmar')).toBeVisible();
  const depois = await lerChar(page);
  expect(depois.inventario.filter((i) => i.origem?.tipo === 'elixir')).toHaveLength(0);
  expect(espacosGastos(depois)).toBe(espacosGastos(antes));
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Armeiro: Armadura Arcana, modelo Infiltrador e contador do 15', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', subclasse: 'Armeiro', nivel: 15, xp: 165000, atributos: ATR,
    inventario: [{ nome: 'Cota de Malha', tipo: 'armadura', quantidade: 1, equipado: true, dados: { ca: '16', categoria: 'Pesada', furtividade: 'Desvantagem' } }],
    recursos: { artifice: { modelo: 'Infiltrador', armadura_arcana: null } },
  }, 'regras-artifice-armeiro');
  await abrirTudo(page);
  // Modelo Infiltrador gravado, mas sem a Armadura Arcana ativa: sem Vantagem em Furtividade.
  await expect(page.locator('[data-vd-info*="Campo Silenciador"]')).toHaveCount(0);
  await clicarSeletorFicha(page, '[data-artifice-acao="armadura-arcana"]');
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="modelo"][data-modelo="Infiltrador"]');
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await expect(page.locator('#app-content')).toContainText('Lançador de Relâmpagos');
  // Vantagem (Campo Silenciador) e Desvantagem (armadura) se anulam no selo da perícia.
  await expect(page.locator('[data-vd-info*="Campo Silenciador"]').first()).toBeAttached();
  await clicarSeletorFicha(page, '[data-artifice-acao="armeiro-contador"][data-chave="voo"]');
  await assentar(page).catch(() => {});
  const c = await lerChar(page);
  expect(c.recursos.artifice.modelo).toBe('Infiltrador');
  expect(c.recursos.artifice.armadura_arcana).toBe('Cota de Malha');
  expect(c.recursos.artifice.armeiro_gastos.voo).toBe(1);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Armeiro Guardião: Campo Defensivo quando Ferido', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', subclasse: 'Armeiro', nivel: 5, xp: 6500, atributos: ATR, pv_max: 40, pv_atual: 5,
    inventario: [{ nome: 'Cota de Malha', tipo: 'armadura', quantidade: 1, equipado: true, dados: { ca: '16', categoria: 'Pesada' } }],
    recursos: { artifice: { armadura_arcana: 'Cota de Malha', modelo: 'Guardião' } },
  }, 'regras-artifice-campo');
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="campo-defensivo"]');
  await assentar(page).catch(() => {});
  expect((await lerChar(page)).pv_temporario).toBe(5);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Armeiro Guardião: Campo Defensivo fica desabilitado acima da metade dos PV e o clique não concede PV Temporários', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Artífice', subclasse: 'Armeiro', nivel: 5, xp: 6500, atributos: ATR, pv_max: 40, pv_atual: 30,
    inventario: [{ nome: 'Cota de Malha', tipo: 'armadura', quantidade: 1, equipado: true, dados: { ca: '16', categoria: 'Pesada' } }],
    recursos: { artifice: { armadura_arcana: 'Cota de Malha', modelo: 'Guardião' } },
  }, 'regras-artifice-campo-sadio');
  await abrirTudo(page);
  await expect(page.locator('[data-artifice-acao="campo-defensivo"]')).toBeDisabled();
  await clicarSeletorFicha(page, '[data-artifice-acao="campo-defensivo"]');
  await assentar(page).catch(() => {});
  expect((await lerChar(page)).pv_temporario || 0).toBe(0);
  expect(erros, erros.join('; ')).toEqual([]);
});

test('Cartógrafo: criar atlas mostra +1d4 na Iniciativa; sem ser portador, não mostra', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { classe: 'Artífice', subclasse: 'Cartógrafo', nivel: 3, xp: 900, atributos: ATR }, 'regras-artifice-atlas');
  await abrirTudo(page);
  await expect(page.locator('.stat-box', { hasText: 'Iniciativa' })).not.toContainText('+1d4');
  await clicarSeletorFicha(page, '[data-artifice-acao="atlas"]', { esperar: '#btn-atlas-confirmar' });
  await clicarSeletorFicha(page, '#btn-atlas-confirmar');
  await assentar(page).catch(() => {});
  expect((await lerChar(page)).recursos.artifice.atlas).toMatchObject({ ativo: true, voce: true });
  await expect(page.locator('.stat-box', { hasText: 'Iniciativa' })).toContainText('+1d4');
  // Recriar sem ser portador tira o dado.
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-artifice-acao="atlas"]', { esperar: '#btn-atlas-confirmar' });
  await page.locator('#atlas-voce').uncheck();
  await clicarSeletorFicha(page, '#btn-atlas-confirmar');
  await assentar(page).catch(() => {});
  await expect(page.locator('.stat-box', { hasText: 'Iniciativa' })).not.toContainText('+1d4');
  expect(erros, erros.join('; ')).toEqual([]);
});
