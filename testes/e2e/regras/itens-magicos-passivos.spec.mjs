// ============================================================
// Prova por navegador dos passivos de itens mágicos (4C): resistências,
// imunidades a condição, Deslocamento, Sentidos, vantagens (selos V e V*),
// Iniciativa, escolha de resistência e impressão.
// ============================================================
import { test, expect } from '@playwright/test';
import { PASSIVOS_VERSAO } from '../../../site/js/regras-recursos-itens.js';
import { abrirFicha, personagemSalvo, clicarBotaoFicha, marcarCondicao, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const GUERREIRO = { classe: 'Guerreiro', nivel: 1, atributos: ATRIBUTOS_REGRAS };
const MAGO = { classe: 'Mago', nivel: 1, atributos: ATRIBUTOS_REGRAS };

/** Fecha todos os modais abertos (principal e sub-modais) pela API da própria página. */
async function fecharTudo(page) {
  await page.evaluate(() => window.fecharModalTodos());
  await expect(page.locator('#modal-overlay')).toBeHidden();
}

/** Adiciona um item mágico pela categoria Itens Mágicos (com arma-base, se pedida) e fecha os modais. */
async function adicionarItemMagico(page, busca, linha, base) {
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });
  await page.locator('.filtro-inv-cat[data-cat="magicos"]').click();
  await page.locator('#busca-inv-cat').fill(busca);
  await page.locator('[data-item-magico]', { hasText: linha }).first().click();
  if (base) await page.selectOption('#base-item-magico', base);
  await page.click('#btn-confirmar-item-magico');
  await expect(page.locator('#toast-container')).toContainText('adicionado');
  await fecharTudo(page);
  await assentar(page).catch(() => {});
}

/** Item do personagem salvo cujo nome contém o trecho dado. */
async function itemSalvo(page, trecho) {
  return (await personagemSalvo(page)).inventario.find((i) => i.nome.includes(trecho));
}

/** Linha do inventário do item com o trecho de nome dado. */
function linhaDe(page, trecho) {
  return page.locator('.inv-item[data-idx]', { hasText: trecho });
}

/** Equipa o item do inventário e espera a ficha assentar. */
async function equipar(page, trecho) {
  await linhaDe(page, trecho).locator('[data-sheet-equip]').check();
  await assentar(page).catch(() => {});
}

/** Equipa e sintoniza o item do inventário, esperando a ficha assentar a cada passo. */
async function equiparESintonizar(page, trecho) {
  await equipar(page, trecho);
  await linhaDe(page, trecho).locator('[data-sintonizar]').check();
  await assentar(page).catch(() => {});
}

/** Card da ficha cujo título (h2) é o texto dado. */
function cardDe(page, titulo) {
  return page.locator('.card', { has: page.locator('h2', { hasText: titulo }) }).first();
}

/** Caixa de estatística (Iniciativa, Deslocamento) pelo rótulo. */
function statDe(page, rotulo) {
  return page.locator('.stat-box', { has: page.locator('.stat-label', { hasText: rotulo }) }).first();
}

test('Cajado do Fogo: resistência Ígneo (Item) só com o item equipado e sintonizado', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO, 'regras-passivos-1');
  await adicionarItemMagico(page, 'Cajado do Fogo', 'Cajado do Fogo');
  await expect(cardDe(page, 'Defesas')).not.toContainText('Ígneo (Item)');
  // Exige sintonização: equipado sem sintonizar não vale.
  await equipar(page, 'Cajado do Fogo');
  await expect(cardDe(page, 'Defesas')).not.toContainText('Ígneo (Item)');
  await linhaDe(page, 'Cajado do Fogo').locator('[data-sintonizar]').check();
  await assentar(page).catch(() => {});
  await expect(cardDe(page, 'Defesas')).toContainText('Ígneo (Item)');

  // Impressão (cenário 6): a folha traz a resistência do item.
  const html = await page.evaluate(async () => {
    const mod = await import(new URL('./js/sheet/impressao.js', location.href).href);
    return mod.gerarHtmlImpressao();
  });
  expect(html).toContain('Ígneo (Item)');

  await linhaDe(page, 'Cajado do Fogo').locator('[data-sheet-equip]').uncheck();
  await assentar(page).catch(() => {});
  await expect(cardDe(page, 'Defesas')).not.toContainText('Ígneo (Item)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Anel de Resistência: pede a escolha e passa a resistir ao tipo escolhido', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-passivos-2');
  await adicionarItemMagico(page, 'Anel de Resistência', 'Anel de Resistência');
  await equipar(page, 'Anel de Resistência');
  await expect(cardDe(page, 'Defesas')).toContainText('Escolha o tipo de resistência em Anel de Resistência');

  await linhaDe(page, 'Anel de Resistência').locator('[data-info-inv-sheet]').first().click();
  await page.selectOption('#sel-escolha-resistencia', 'Gélido');
  await assentar(page).catch(() => {});
  await expect(cardDe(page, 'Defesas')).toContainText('Gélido (Item)');
  await expect(cardDe(page, 'Defesas')).not.toContainText('Escolha o tipo de resistência');
  expect((await itemSalvo(page, 'Anel de Resistência')).escolhas.resistencia).toBe('Gélido');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Anel de Natação: Natação 12 m no Deslocamento e some quando Contido zera o Deslocamento', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-passivos-3');
  await adicionarItemMagico(page, 'Anel de Natação', 'Anel de Natação');
  await equipar(page, 'Anel de Natação');
  await expect(statDe(page, 'Deslocamento')).toContainText('Natação');
  await expect(statDe(page, 'Deslocamento')).toContainText('12');
  await marcarCondicao(page, 'Contido');
  await expect(statDe(page, 'Deslocamento')).not.toContainText('Natação');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Óculos da Noite: 18 m para quem não tem Visão no Escuro e soma 18 m para quem tem', async ({ context }) => {
  const humano = await abrirFicha(context, { ...GUERREIRO, especie: 'Humano' }, 'regras-passivos-4a');
  await adicionarItemMagico(humano.page, 'Óculos da Noite', 'Óculos da Noite');
  await equipar(humano.page, 'Óculos da Noite');
  await expect(cardDe(humano.page, 'Sentidos Passivos')).toContainText('Visão no Escuro');
  await expect(cardDe(humano.page, 'Sentidos Passivos')).toContainText('18 m');
  expect(humano.erros, `erros de console/página: ${humano.erros.join('; ')}`).toEqual([]);

  const anao = await abrirFicha(context, { ...GUERREIRO, especie: 'Anão' }, 'regras-passivos-4b');
  const base = await anao.page.locator('.salva-item', { hasText: 'Visão no Escuro' }).locator('.pericia-bonus').innerText();
  const metrosBase = parseInt(base, 10);
  expect(metrosBase).toBeGreaterThan(0);
  await adicionarItemMagico(anao.page, 'Óculos da Noite', 'Óculos da Noite');
  await equipar(anao.page, 'Óculos da Noite');
  await expect(cardDe(anao.page, 'Sentidos Passivos')).toContainText(`${metrosBase + 18} m`);
  await linhaDe(anao.page, 'Óculos da Noite').locator('[data-sheet-equip]').uncheck();
  await assentar(anao.page).catch(() => {});
  await expect(cardDe(anao.page, 'Sentidos Passivos')).toContainText(`${metrosBase} m`);
  expect(anao.erros, `erros de console/página: ${anao.erros.join('; ')}`).toEqual([]);
});

test('Livro dos Feitos Exaltados: imunidade a Amedrontado na seção Condições', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-passivos-5');
  await adicionarItemMagico(page, 'Livro dos Feitos', 'Livro dos Feitos Exaltados');
  await equiparESintonizar(page, 'Livro dos Feitos Exaltados');
  await expect(cardDe(page, 'Condições')).toContainText('Imune: Amedrontado (Livro dos Feitos Exaltados)');
  await expect(cardDe(page, 'Salvaguardas')).toContainText('Imune: Amedrontado (Livro dos Feitos Exaltados)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Botas Élficas: selo de Vantagem em Furtividade com a origem', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-passivos-7');
  await adicionarItemMagico(page, 'Botas Élficas', 'Botas Élficas');
  const selo = page.locator('.pericia-item', { hasText: 'Furtividade' }).locator('.pericia-vd-badge.vantagem');
  await expect(selo).toHaveCount(0);
  await equipar(page, 'Botas Élficas');
  await expect(selo).toHaveCount(1);
  await expect(selo).toHaveAttribute('data-vd-info', /Botas Élficas/);
  await linhaDe(page, 'Botas Élficas').locator('[data-sheet-equip]').uncheck();
  await assentar(page).catch(() => {});
  await expect(selo).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Bastão do Alerta: Vantagem na Iniciativa', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-passivos-8');
  await adicionarItemMagico(page, 'Bastão do Alerta', 'Bastão do Alerta');
  await expect(statDe(page, 'Iniciativa')).not.toContainText('Vantagem');
  await equiparESintonizar(page, 'Bastão do Alerta');
  await expect(statDe(page, 'Iniciativa')).toContainText('Vantagem');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Manto de Resistência a Magias: nota V* sem anular Desvantagem real', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-passivos-9');
  await adicionarItemMagico(page, 'Manto de Resistência a Magias', 'Manto de Resistência a Magias');
  await equiparESintonizar(page, 'Manto de Resistência a Magias');
  const sabedoria = page.locator('.salva-item', { hasText: 'Sabedoria' });
  await expect(sabedoria.locator('.vantagem-nota')).toHaveAttribute('data-vd-info', /contra magias/);
  await expect(sabedoria.locator('.pericia-vd-badge.vantagem')).toHaveCount(0);

  await marcarCondicao(page, 'Contido');
  const destreza = page.locator('.salva-item', { hasText: 'Destreza' });
  await expect(destreza.locator('.pericia-vd-badge.desvantagem')).toHaveCount(1);
  await expect(destreza.locator('.pericia-vd-badge.neutro')).toHaveCount(0);
  await expect(destreza.locator('.vantagem-nota')).toHaveCount(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('resistência fixa da ficha não se repete com a do item (sem "(Item)")', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { ...MAGO, resistencias: ['Ígneo'] }, 'regras-passivos-10');
  await adicionarItemMagico(page, 'Cajado do Fogo', 'Cajado do Fogo');
  await equiparESintonizar(page, 'Cajado do Fogo');
  const defesas = cardDe(page, 'Defesas');
  await expect(defesas).toContainText('Ígneo');
  await expect(defesas).not.toContainText('Ígneo (Item)');
  expect(((await defesas.innerText()).match(/Ígneo/g) || []).length).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('imunidade a condição de magia e de item para a mesma condição aparece uma vez em Condições', async ({ context }) => {
  const efeito = { tipo: 'imunidade_condicao', condicao: 'Amedrontado', nome: 'Bênção Teste' };
  const { page, erros } = await abrirFicha(context, { ...GUERREIRO, efeitos_magicos: [efeito] }, 'regras-passivos-11');
  await adicionarItemMagico(page, 'Livro dos Feitos', 'Livro dos Feitos Exaltados');
  await equiparESintonizar(page, 'Livro dos Feitos Exaltados');
  const condicoes = cardDe(page, 'Condições');
  await expect(condicoes).toContainText('Imune: Amedrontado (Bênção Teste)');
  await expect(condicoes).not.toContainText('Imune: Amedrontado (Livro dos Feitos Exaltados)');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('nome hostil de item equipado não vira HTML nem quebra atributo nos passivos', async ({ context }) => {
  const NOME = 'Anel "X" <img src=x onerror="window.__xss=(window.__xss||0)+1">';
  const item = {
    nome: NOME, tipo: 'magico', quantidade: 1, equipado: true, sintonizado: true,
    dados: {
      magico_id: 'hostil', requer_sintonizacao: true, passivos_versao: 1, recursos: null, magias: null,
      efeitos: [
        { alvo: 'resistencia', tipo_dano: 'Ígneo' },
        { alvo: 'imunidade_condicao', condicao: 'Amedrontado' },
        { alvo: 'vantagem', em: 'pericia', pericia: 'Furtividade' },
        { alvo: 'vantagem', em: 'salvaguarda', atributo: 'Sabedoria', contexto: 'contra "magias"' },
        { alvo: 'vantagem', em: 'iniciativa' },
      ],
    },
  };
  const { page, erros } = await abrirFicha(context, { ...GUERREIRO, inventario: [item] }, 'regras-passivos-12');
  const medir = () => page.evaluate(() => ({
    scriptRodou: window.__xss ?? null,
    tags: document.querySelectorAll('img[src="x"]').length,
  }));
  const { scriptRodou, tags } = await medir();
  expect(scriptRodou, 'o nome do item executou script').toBeNull();
  expect(tags, 'o nome do item virou tag <img>').toBe(0);

  // Atributos íntegros: o texto hostil fica inteiro dentro de data-vd-info/title.
  const seloPericia = page.locator('.pericia-item', { hasText: 'Furtividade' }).locator('.pericia-vd-badge.vantagem');
  await expect(seloPericia).toHaveAttribute('data-vd-info', `Vantagem: ${NOME}`);
  expect(await seloPericia.evaluate((el) => [...el.attributes].map((a) => a.name).sort())).toEqual(['class', 'data-vd-info']);
  const notaSab = page.locator('.salva-item', { hasText: 'Sabedoria' }).locator('.vantagem-nota');
  await expect(notaSab).toHaveAttribute('data-vd-info', `${NOME}: Vantagem contra "magias"`);
  await expect(statDe(page, 'Iniciativa').locator('div[title]')).toHaveAttribute('title', NOME);
  await expect(cardDe(page, 'Defesas').locator('span[title]').first()).toHaveAttribute('title', NOME);
  await expect(cardDe(page, 'Condições')).toContainText(`Imune: Amedrontado (${NOME})`);
  await expect(cardDe(page, 'Salvaguardas')).toContainText(`Imune: Amedrontado (${NOME})`);
  const badgeSalv = cardDe(page, 'Salvaguardas').locator('.badge[title]').first();
  await expect(badgeSalv).toHaveAttribute('title', NOME);

  // Detalhe do item e impressão também escapam o nome.
  await linhaDe(page, 'Anel').locator('[data-info-inv-sheet]').first().click();
  // O detalhe abre de forma assíncrona: espera o modal antes de fechar.
  await expect(page.locator('#modal-overlay')).toBeVisible();
  await fecharTudo(page);
  const html = await page.evaluate(async () => {
    const mod = await import(new URL('./js/sheet/impressao.js', location.href).href);
    return mod.gerarHtmlImpressao();
  });
  expect(html).not.toContain('<img src=x');
  expect((await medir()).tags).toBe(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ---- Plano 8, Task 3: achados menores do Plano 6 ----

/** Personagem de classe única (schema v2) com o nível e a subclasse dados. */
function classeUnica(classe, nivel, subclasse = '', extra = {}) {
  return { classe, subclasse, nivel, especie: 'Humano', atributos: ATRIBUTOS_REGRAS, classes: [{ classe, subclasse, nivel, ordem: 0 }], schema_versao: 2, ...extra };
}

/** Item mágico sintético equipado e sintonizado, para efeitos que o acervo não traz. */
function itemSintetico(nome, efeitos) {
  return {
    nome, tipo: 'magico', quantidade: 1, equipado: true, sintonizado: true,
    dados: { magico_id: `sintetico-${nome}`, requer_sintonizacao: true, passivos_versao: PASSIVOS_VERSAO, recursos: null, magias: null, requisito_sintonizacao: '', aumento_permanente: null, efeitos },
  };
}

test('3.1 Guardião 6 + Manto da Arraia-Jamanta: uma só Natação (a maior) e nenhuma velocidade sob Contido', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, classeUnica('Guardião', 6), 'regras-passivos-p8-31');
  await expect(statDe(page, 'Deslocamento')).toContainText('Natação 12m');
  await adicionarItemMagico(page, 'Manto da Arraia', 'Manto da Arraia-Jamanta');
  await equiparESintonizar(page, 'Manto da Arraia-Jamanta');
  const texto = await statDe(page, 'Deslocamento').innerText();
  expect(texto).toContain('Natação 18m');
  expect(texto.match(/Natação/g) || [], `Natação repetida: ${texto}`).toHaveLength(1);
  expect(texto).toContain('Escalada 12m');

  await marcarCondicao(page, 'Contido');
  await expect(statDe(page, 'Deslocamento').locator('.stat-value')).toHaveText('0metros');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('3.3 selos de Visão no Escuro: Óculos da Noite somam à base e o Cinturão dos Anões fica sem efeito com base maior', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, { ...classeUnica('Guerreiro', 1), especie: 'Anão' }, 'regras-passivos-p8-33');
  const base = parseInt(await page.locator('.salva-item', { hasText: 'Visão no Escuro' }).locator('.pericia-bonus').innerText(), 10);
  expect(base).toBeGreaterThan(18);
  await adicionarItemMagico(page, 'Óculos da Noite', 'Óculos da Noite');
  await equipar(page, 'Óculos da Noite');
  const seloOculos = linhaDe(page, 'Óculos da Noite').locator('[data-selo-efeito]', { hasText: 'Visão no Escuro' });
  await expect(seloOculos).toContainText('+18 m (soma à base)');
  await expect(seloOculos).toHaveAttribute('data-selo-efeito', 'ativo');

  await adicionarItemMagico(page, 'Cinturão dos Anões', 'Cinturão dos Anões');
  await equiparESintonizar(page, 'Cinturão dos Anões');
  const seloCinturao = linhaDe(page, 'Cinturão dos Anões').locator('[data-selo-efeito]', { hasText: 'Visão no Escuro' });
  await expect(seloCinturao).toHaveAttribute('data-selo-efeito', 'inativo');
  await expect(seloCinturao).toHaveAttribute('title', `sem efeito: sua base já é ${base} m`);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('3.4 Condições: Aura de Coragem do Paladino e Livro dos Feitos Exaltados mostram a imunidade a Amedrontado uma vez', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, classeUnica('Paladino', 10), 'regras-passivos-p8-34a');
  await adicionarItemMagico(page, 'Livro dos Feitos', 'Livro dos Feitos Exaltados');
  await equiparESintonizar(page, 'Livro dos Feitos Exaltados');
  const condicoes = cardDe(page, 'Condições');
  await expect(condicoes).toContainText('Imune: Amedrontado (Aura de Coragem)');
  // O Livro também dá Enfeitiçado (sem Aura de Devoção, esse selo continua); Amedrontado fica só o da Aura.
  await expect(condicoes).not.toContainText('Imune: Amedrontado (Livro dos Feitos Exaltados)');
  await expect(condicoes).toContainText('Imune: Enfeitiçado (Livro dos Feitos Exaltados)');
  expect(((await condicoes.innerText()).match(/Imune: Amedrontado/g) || []).length).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('3.4 Condições: Fúria Irracional ativa do Bárbaro Berserker e o Livro mostram Amedrontado uma vez', async ({ context }) => {
  const campos = classeUnica('Bárbaro', 6, 'Trilha do Berserker', { recursos: { furia_ativa: true } });
  const { page, erros } = await abrirFicha(context, campos, 'regras-passivos-p8-34b');
  await adicionarItemMagico(page, 'Livro dos Feitos', 'Livro dos Feitos Exaltados');
  await equiparESintonizar(page, 'Livro dos Feitos Exaltados');
  const condicoes = cardDe(page, 'Condições');
  await expect(condicoes).toContainText('Imune: Amedrontado (Furia Irracional)');
  await expect(condicoes).not.toContainText('Livro dos Feitos Exaltados');
  expect(((await condicoes.innerText()).match(/Imune: Amedrontado/g) || []).length).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('3.5 Iniciativa: o título da Vantagem lista Bárbaro 7 e o item', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, classeUnica('Bárbaro', 7), 'regras-passivos-p8-35');
  const vantagem = () => statDe(page, 'Iniciativa').locator('div[title]');
  await expect(statDe(page, 'Iniciativa')).toContainText('Vantagem');
  await expect(vantagem()).toHaveAttribute('title', 'Instintos Primitivos');
  await adicionarItemMagico(page, 'Bastão do Alerta', 'Bastão do Alerta');
  await equiparESintonizar(page, 'Bastão do Alerta');
  await expect(vantagem()).toHaveAttribute('title', 'Instintos Primitivos, Bastão do Alerta');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('3.6 Guardião 18 (Sentidos Selvagens) + Navalha Negra: empate em 9 m fica a do Guardião; item maior prevalece', async ({ context }) => {
  const guardiao = classeUnica('Guardião', 18);
  const { page, erros } = await abrirFicha(context, guardiao, 'regras-passivos-p8-36a');
  const cegas = () => page.locator('.salva-item', { hasText: /Vis(ã|a)o (à|a)s Cegas/ });
  await expect(cegas()).toHaveCount(1);
  await expect(cegas().locator('.pericia-bonus')).toHaveText('9 m');
  await adicionarItemMagico(page, 'Navalha Negra', 'Navalha Negra', 'Espada Grande');
  await equiparESintonizar(page, 'Navalha Negra');
  // Item e Guardião em 9 m: uma só caixa, a do Guardião (sem origem de item no title).
  await expect(cegas()).toHaveCount(1);
  await expect(cegas().locator('.pericia-bonus')).toHaveText('9 m');
  await expect(cegas()).not.toHaveAttribute('title', /Navalha/);

  // Item com alcance maior que o do Guardião: aparece só a maior, com a origem do item.
  const maior = await abrirFicha(context, { ...guardiao, inventario: [itemSintetico('Lente Longa', [{ alvo: 'sentido', sentido: 'visao_as_cegas', metros: 18 }])] }, 'regras-passivos-p8-36b');
  const cegasMaior = maior.page.locator('.salva-item', { hasText: /Vis(ã|a)o (à|a)s Cegas/ });
  await expect(cegasMaior).toHaveCount(1);
  await expect(cegasMaior.locator('.pericia-bonus')).toHaveText('18 m');
  await expect(cegasMaior).toHaveAttribute('title', 'Lente Longa');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  expect(maior.erros, `erros de console/página: ${maior.erros.join('; ')}`).toEqual([]);
});

test('3.2 PDF: o cartão traz os sentidos de espécie e de item (Visão no Escuro e Visão Verdadeira)', async ({ context }) => {
  const item = itemSintetico('Lente Verdadeira', [{ alvo: 'sentido', sentido: 'visao_verdadeira', metros: 36 }, { alvo: 'sentido', sentido: 'visao_no_escuro', metros: 18 }]);
  const { page, erros } = await abrirFicha(context, { ...classeUnica('Guerreiro', 1), especie: 'Humano', inventario: [item] }, 'regras-passivos-p8-32');
  const sentidos = await page.evaluate(async () => {
    const mod = await import(new URL('./js/sheet/pdf.js', location.href).href);
    return mod.montarDadosCartaoPdf().sentidos;
  });
  expect(sentidos).toContain('Visão no Escuro 18 m');
  expect(sentidos).toContain('Visão Verdadeira 36 m');
  // O botão "Gerar PDF" produz o arquivo com esses textos sem erro.
  await assentar(page).catch(() => {});
  const espera = page.waitForEvent('download', { timeout: 60_000 });
  await clicarBotaoFicha(page, 'btn-print');
  const download = await espera;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('M2 PDF: a linha de sentidos com Visão no Escuro, Verdadeira e às Cegas quebra em vez de passar da largura útil', async ({ context }) => {
  const item = itemSintetico('Lente Tripla', [
    { alvo: 'sentido', sentido: 'visao_no_escuro', metros: 120 },
    { alvo: 'sentido', sentido: 'visao_verdadeira', metros: 360 },
    { alvo: 'sentido', sentido: 'visao_as_cegas', metros: 180 },
  ]);
  const { page, erros } = await abrirFicha(context, { ...classeUnica('Guerreiro', 1), inventario: [item] }, 'regras-passivos-p8-m2');
  await assentar(page).catch(() => {});
  // Primeiro download carrega o pdf-lib; no segundo, drawText é observado.
  const baixar = async () => {
    const espera = page.waitForEvent('download', { timeout: 60_000 });
    await clicarBotaoFicha(page, 'btn-print');
    await espera;
  };
  await baixar();
  await page.evaluate(() => {
    window.__linhasPdf = [];
    const proto = window.PDFLib.PDFPage.prototype;
    const original = proto.drawText;
    proto.drawText = function (texto, opcoes) {
      window.__linhasPdf.push({ texto, largura: opcoes.font.widthOfTextAtSize(texto, opcoes.size) });
      return original.call(this, texto, opcoes);
    };
  });
  await baixar();
  const linhas = await page.evaluate(() => window.__linhasPdf);
  const dosSentidos = linhas.filter((l) => /Vis(ã|a)o|Percep/.test(l.texto) && /\d+ m|Percepção \d/.test(l.texto));
  expect(dosSentidos.some((l) => l.texto.includes('Visão no Escuro 120 m'))).toBe(true);
  expect(dosSentidos.some((l) => l.texto.includes('Visão às Cegas 180 m'))).toBe(true);
  expect(dosSentidos.some((l) => l.texto.includes('Visão Verdadeira 360 m'))).toBe(true);
  // Largura útil do cartão: 595,28 - 2 x 36 = 523,28 pt.
  for (const l of dosSentidos) expect(l.largura, l.texto).toBeLessThanOrEqual(523.28);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
