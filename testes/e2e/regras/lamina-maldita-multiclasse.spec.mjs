// ============================================================
// Lâmina Maldita (Bruxo, Xanathar) em multiclasse: a subida de nível que
// escolhe o patrono na SEGUNDA classe concede magias e proficiências, e a
// ficha usa o nível de Bruxo (não o total) para Espectro e cura.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, personagemSalvo } from './helpers-regras.mjs';

const PATRONO = 'Patrono Lâmina Maldita';
const CARD_CLASSE = '#levelup-escolha-classe';
const PROXIMO = '#btn-step-proximo';
const STEP_ATIVO = '.levelup-step-ativo .levelup-step-label';

const ESPADA_LONGA = {
  nome: 'Espada Longa', tipo: 'arma', quantidade: 1, equipado: true, descricao: '',
  dados: { categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante', propriedades: 'Versátil (1d10)', peso: '1,5 kg' },
};

/** Clica em "Próximo" e espera o modal reagir. */
async function proximo(page) {
  await page.locator(PROXIMO).click();
  await assentar(page).catch(() => {});
}

/** Magias de patrono sempre preparadas no personagem salvo (o app as grava com origem 'dominio' ou 'sempre'). */
async function magiasSempre(page) {
  const p = await personagemSalvo(page);
  return (p.magias_preparadas || []).filter((m) => ['sempre', 'dominio'].includes(m.origem)).map((m) => m.nome);
}

test('Mago 5/Bruxo 2 sobe para Bruxo 3 e escolhe o patrono: magias sempre preparadas e proficiências chegam e sobrevivem a recarregar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', subclasse: '', nivel: 7, xp: 23000,
    especie: 'Humano', atributos: { ...ATRIBUTOS_REGRAS, carisma: 16 },
    pericias_proficientes: ['Arcanismo', 'História'],
    classes: [
      { classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 },
      { classe: 'Bruxo', subclasse: '', nivel: 2, ordem: 1 },
    ],
    schema_versao: 2,
  }, 'maldita-multi-subida');

  expect(await magiasSempre(page), 'controle: a semente não tem magia sempre preparada').toEqual([]);
  expect((await personagemSalvo(page)).proficiencias_extra || [], 'controle: sem proficiência extra').toEqual([]);

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false })).toBe(true);
  await expect(page.locator(CARD_CLASSE)).toBeVisible();
  await page.locator(`${CARD_CLASSE} input[name="classe-que-sobe"][data-classe="Bruxo"]`).click();
  await expect(page.locator(CARD_CLASSE)).toHaveAttribute('data-classe-ctx', 'Bruxo');
  await assentar(page).catch(() => {});

  // Navega até a Revisão escolhendo o patrono; qualquer outro portão falha alto, nomeando o step.
  const confirmar = page.locator('#btn-confirmar-levelup');
  let patronoEscolhido = false;
  let magiaEscolhida = false;
  for (let i = 0; i < 10 && !(await confirmar.count()); i++) {
    const card = page.locator(`[data-subclasse="${PATRONO}"]`);
    if (!patronoEscolhido && await card.count()) {
      await card.click();
      await assentar(page).catch(() => {});
      patronoEscolhido = true;
      continue;
    }
    // O 3º nível de Bruxo pede 1 magia conhecida nova: abre o grid, escolhe a primeira e confirma.
    if (!magiaEscolhida && await page.locator('#btn-lvlup-magias').count()) {
      await page.locator('#btn-lvlup-magias').click();
      await assentar(page).catch(() => {});
      await page.locator('#grid-magias details[data-grid-circulo] summary').first().click();
      const candidatas = page.locator('#grid-magias [data-grid-check]');
      await expect(candidatas.first()).toBeVisible();
      const nome = await candidatas.first().evaluate((el) => el.dataset.gridCheck);
      await page.locator(`[data-grid-check="${nome}"]`).click();
      await page.locator('.sub-modal-overlay button', { hasText: 'Confirmar Seleção' }).click();
      await assentar(page).catch(() => {});
      await expect(page.locator('#lvlup-magias-resumo')).toContainText('1/1');
      magiaEscolhida = true;
      continue;
    }
    expect(await page.locator(PROXIMO).isEnabled().catch(() => false),
      `o assistente travou no step "${await page.locator(STEP_ATIVO).textContent().catch(() => '?')}"`).toBe(true);
    await proximo(page);
  }
  expect(patronoEscolhido, 'o 3º nível DE BRUXO tem de oferecer o patrono Lâmina Maldita').toBe(true);
  await expect(page.locator('#levelup-step-body')).toContainText('Bruxo 2 → Bruxo 3');
  await confirmar.click();
  await assentar(page).catch(() => {});
  await expect.poll(async () => (await personagemSalvo(page)).classes.find((c) => c.classe === 'Bruxo').nivel,
    'a subida tem de gravar o Bruxo em nível 3').toBe(3);

  const conferir = async () => {
    const salvo = await personagemSalvo(page);
    expect(salvo.classes.map((c) => `${c.classe} ${c.nivel}`)).toEqual(['Mago 5', 'Bruxo 3']);
    expect(salvo.classes.find((c) => c.classe === 'Bruxo').subclasse).toBe(PATRONO);
    expect(await magiasSempre(page), 'o patrono concede as magias do nível 3 do Bruxo')
      .toEqual(expect.arrayContaining(['Escudo Arcano', 'Destruição Colérica', 'Turvar', 'Destruição Radiante']));
    expect(salvo.proficiencias_extra, 'o Guerreiro Maldito concede armadura média, escudos e armas marciais')
      .toEqual(expect.arrayContaining(['Armadura Média', 'Escudo', 'Armas Marciais']));
  };
  await conferir();

  // Recarregar de verdade: a higienização de abertura não pode apagar o que a segunda classe concedeu.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page);
  await conferir();
  await expect(page.locator('details[data-details-id="lamina-maldita"]'),
    'a seção do patrono aparece na ficha do multiclasse').toHaveCount(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

/** Guerreiro 5/Bruxo 3 (patrono), Car 16, PV 70/100, com a Espada Longa equipada. */
const GUERREIRO_5_BRUXO_3 = (extra = {}) => ({
  classe: 'Guerreiro', subclasse: 'Campeão', nivel: 8, xp: 34000,
  atributos: { ...ATRIBUTOS_REGRAS, carisma: 16 }, inventario: [ESPADA_LONGA], pv_max: 100, pv_atual: 70,
  classes: [
    { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 5, ordem: 0 },
    { classe: 'Bruxo', subclasse: PATRONO, nivel: 3, ordem: 1 },
  ],
  schema_versao: 2, ...extra,
});

test('Guerreiro 5/Bruxo 3: o selo usa a proficiência do nível total, a cura e o Espectro usam o nível de Bruxo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO_5_BRUXO_3(), 'maldita-multi-ficha');
  await assentar(page).catch(() => {});

  // O espelho da ficha é Guerreiro, mas o patrono vem de classes[]: a seção existe.
  const bloco = page.locator('details[data-details-id="lamina-maldita"]');
  await expect(bloco).toHaveCount(1);
  await bloco.locator('> summary').click();

  // Nível de Bruxo 3 < 6: sem Espectro, mesmo com nível total 8.
  await expect(page.locator('[data-lamina-maldita-acao="levantar-espectro"]')).toHaveCount(0);

  await page.locator('[data-lamina-maldita-acao="amaldicoar"]').click();
  await expect.poll(async () => (await personagemSalvo(page)).recursos?.lamina_maldita?.maldicao_ativa).toBe(true);
  // Bônus de proficiência do nível total 8 = +3 (um Bruxo 3 sozinho teria +2).
  const linha = page.locator('#secao-ataques .ataque-item', { hasText: 'Espada Longa' });
  await expect(linha.locator('[data-selo-maldicao]')).toContainText('+3 amaldiçoado');

  // Cura = nível de Bruxo (3) + Carisma (+3) = 6, e não o nível total (8) + 3 = 11.
  await page.locator('[data-lamina-maldita-acao="alvo-morreu"]').click();
  await page.locator('[data-lamina-maldita-acao="curar"]').click();
  await expect.poll(async () => (await personagemSalvo(page)).pv_atual).toBe(76);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Guerreiro 8/Mago 3 (sem o patrono): a seção da Lâmina Maldita não aparece', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', subclasse: 'Campeão', nivel: 11, xp: 85000,
    atributos: { ...ATRIBUTOS_REGRAS, carisma: 16 }, inventario: [ESPADA_LONGA],
    classes: [
      { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 8, ordem: 0 },
      { classe: 'Mago', subclasse: '', nivel: 3, ordem: 1 },
    ],
    schema_versao: 2,
  }, 'maldita-multi-sem-patrono');
  await assentar(page).catch(() => {});
  await expect(page.locator('details[data-details-id="lamina-maldita"]')).toHaveCount(0);
  await expect(page.locator('[data-selo-maldicao]')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
