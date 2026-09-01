// ============================================================
// Limite de truques por CLASSE, em ficha multiclasse.
//
// Relato: "Mago e clerigo, deixando selecionar quantos truques quiser,
// nao respeita limite".
//
// Com UMA classe so o portao sempre funcionou. O que nao existia era o
// portao em MULTICLASSE: `grimorio.js` pulava a trava inteira quando havia
// duas superficies de conjuracao (`umaSuperficieSo`), porque
// `magias_conhecidas` nao tinha campo `classe` e a contagem era global --
// os truques do Clerigo comiam o orcamento do Mago. A decisao registrada
// era "bloquear com base numa contagem incerta e pior que deixar passar".
//
// A saida e a MESMA que a magia de circulo ja usa desde o sub-projeto
// "magia sabe a classe": carimbar a classe na entrada e contar em tres
// baldes (desta / de outra / sem classe). Com contagem certa o portao
// volta a valer; com ficha antiga (sem carimbo) a incerteza fica VISIVEL
// em vez de virar bloqueio errado.
//
// ARMADILHA DE ORACULO (custou uma rodada nesta investigacao): so
// `toBeLessThanOrEqual(limite)` PASSA com zero truque gravado. A aba
// inicial do modal e "preparadas", e o listener esta no
// `[data-truque-check]`, nao no `[data-toggle-truque]` do cartao. Todo
// oraculo daqui afirma as DUAS coisas: gravou algo E parou no limite.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  abrirFicha, assentar, personagemSalvo, clicarSeletorFicha, ATRIBUTOS_REGRAS,
} from './helpers-regras.mjs';

const MAGO_CLERIGO = [
  { classe: 'Mago', subclasse: 'Evocação', nivel: 5, ordem: 0 },
  { classe: 'Clérigo', subclasse: 'Vida', nivel: 5, ordem: 1 },
];

/** Semeia a ficha multiclasse Mago 5 / Clerigo 5 e abre a ficha. */
async function fichaMagoClerigo(context, extras, id) {
  const lado = await abrirFicha(context, {
    nome: 'MC', especie: 'Humano', classe: 'Mago', subclasse: 'Evocação',
    nivel: 10, xp: 64000, atributos: ATRIBUTOS_REGRAS,
    classes: MAGO_CLERIGO, schema_versao: 2,
    ...extras,
  }, id);
  await assentar(lado.page).catch(() => {});
  return lado.page;
}

/** Abre "Gerenciar Magias" e vai para a aba de truques. */
async function abrirAbaTruques(page) {
  await page.click('#btn-add-magia');
  await page.waitForSelector('#resultado-magias', { state: 'visible', timeout: 20_000 });
  await page.locator('#tabs-gerenciar-magias [data-tab-mg="truques"]').click();
  await page.waitForSelector('[data-truque-check]', { state: 'attached', timeout: 20_000 });
  await assentar(page).catch(() => {});
}

/** Le "Truques: N/M" do contador do modal. */
async function lerContadorModal(page) {
  const texto = (await page.locator('#gm-contador-truques').textContent()).trim();
  const m = texto.match(/(\d+)\s*\/\s*(\d+)/);
  return { atual: Number(m[1]), limite: Number(m[2]), texto };
}

/** Clica em todos os cartoes de truque da grade, sem parar no primeiro bloqueio. */
async function clicarTodosOsTruques(page) {
  const cartoes = page.locator('[data-truque-check]');
  const total = await cartoes.count();
  expect(total, 'a grade precisa ter cartoes de truque para a medicao valer').toBeGreaterThan(0);
  for (let i = 0; i < total; i++) {
    await cartoes.nth(i).click({ force: true }).catch(() => {});
    await assentar(page).catch(() => {});
  }
  return total;
}

/** Truques de classe gravados, com a classe carimbada em cada um. */
async function truquesGravados(page) {
  const p = await personagemSalvo(page);
  return (p.magias_conhecidas || []).filter((m) => m.circulo === 0 && !m.origem);
}

test('multiclasse: o portao de truques para no limite da classe ativa', async ({ context }) => {
  const page = await fichaMagoClerigo(context, {}, 'truq-mc-1');
  await abrirAbaTruques(page);

  const { limite } = await lerContadorModal(page);
  expect(limite, 'a tela precisa declarar um limite').toBeGreaterThan(0);

  const totalCartoes = await clicarTodosOsTruques(page);
  expect(totalCartoes, 'a grade precisa ter MAIS cartoes que o limite').toBeGreaterThan(limite);

  const gravados = await truquesGravados(page);
  expect(gravados.length, 'os cliques precisam ter gravado alguma coisa').toBeGreaterThan(0);
  expect(gravados.length, `deveria parar em ${limite} truques, e gravou ${gravados.length}`)
    .toBeLessThanOrEqual(limite);
});

test('multiclasse: o truque adicionado carimba a classe da superficie ativa', async ({ context }) => {
  const page = await fichaMagoClerigo(context, {}, 'truq-mc-2');
  await abrirAbaTruques(page);
  await page.locator('[data-truque-check]').first().click({ force: true });
  await assentar(page).catch(() => {});

  const gravados = await truquesGravados(page);
  expect(gravados.length, 'precisa ter gravado o truque clicado').toBe(1);
  expect(gravados[0].classe, `truque gravado sem classe: ${JSON.stringify(gravados[0])}`)
    .toBe('Mago');
});

test('multiclasse: o orcamento do Clerigo nao e gasto pelos truques do Mago', async ({ context }) => {
  // Ficha ja com o orcamento do Mago cheio, carimbado.
  const page = await fichaMagoClerigo(context, {
    magias_conhecidas: [
      { nome: 'Raio de Gelo', circulo: 0, classe: 'Mago' },
      { nome: 'Mãos Flamejantes', circulo: 0, classe: 'Mago' },
      { nome: 'Toque Chocante', circulo: 0, classe: 'Mago' },
      { nome: 'Prestidigitação', circulo: 0, classe: 'Mago' },
    ],
  }, 'truq-mc-3');

  await clicarSeletorFicha(page, '[data-tab-superficie="Clérigo"]',
    { esperar: '[data-tab-superficie="Clérigo"].active' });
  await abrirAbaTruques(page);

  const { atual, texto } = await lerContadorModal(page);
  expect(atual, `os truques do Mago nao contam no orcamento do Clerigo -- contador: "${texto}"`)
    .toBe(0);
});

test('ficha antiga: truque sem carimbo aparece como incerteza, e nao vira bloqueio', async ({ context }) => {
  // Sem `classe` -- a forma que toda ficha gravada antes deste conserto tem.
  const page = await fichaMagoClerigo(context, {
    magias_conhecidas: [
      { nome: 'Raio de Gelo', circulo: 0 },
      { nome: 'Mãos Flamejantes', circulo: 0 },
    ],
  }, 'truq-mc-4');
  await abrirAbaTruques(page);

  // A incerteza tem de ficar VISIVEL: o contador nao pode mentir por
  // omissao dizendo que o orcamento esta livre.
  const indicador = page.locator('#gm-contador-truques-sem-classe');
  await expect(indicador, 'a contagem incerta precisa aparecer ao lado do contador')
    .toBeVisible();
  await expect(indicador).toContainText('2');

  // E nao pode travar quem nao tem contagem certa: ainda da para adicionar.
  // A grade ordena os JA SELECIONADOS primeiro, entao `.first()` cairia num
  // truque marcado e o clique REMOVERIA em vez de adicionar -- o oraculo
  // mediria o contrario do que afirma. Pega um cartao nao selecionado.
  const antes = (await truquesGravados(page)).length;
  await page.locator('.opcao-card:not(.selecionada) [data-truque-check]')
    .first().click({ force: true });
  await assentar(page).catch(() => {});
  expect((await truquesGravados(page)).length,
    'com contagem incerta o app nao bloqueia -- so mostra a incerteza')
    .toBeGreaterThan(antes);
});

test('classe unica continua parando no limite, como sempre parou', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    nome: 'Solo', especie: 'Humano', classe: 'Mago', subclasse: 'Evocação',
    nivel: 5, atributos: ATRIBUTOS_REGRAS,
    classes: [{ classe: 'Mago', subclasse: 'Evocação', nivel: 5, ordem: 0 }],
    schema_versao: 2,
  }, 'truq-solo-1');
  await assentar(page).catch(() => {});
  await abrirAbaTruques(page);

  const { limite } = await lerContadorModal(page);
  await clicarTodosOsTruques(page);
  const gravados = await truquesGravados(page);
  expect(gravados.length, 'os cliques precisam ter gravado alguma coisa').toBeGreaterThan(0);
  expect(gravados.length, `classe unica deveria parar em ${limite}`).toBe(limite);
});
