// ============================================================
// Issues #105 e #61: o modal "Preparar Magias" é escopado à classe ativa.
// Personagens semeados já no estado pós-migração, exceto onde o cenário
// mede a própria migração. Nomes medidos em dados/ (2026-09-22): truques
// nas duas listas = Badalar Fúnebre, Luz, Reparar; "Identificar" não está
// na lista do Clérigo; Domínio da Vida nível 3 = Auxílio, Bênção, Curar
// Ferimentos, Restauração Menor. Preparadas de 1º círculo nas duas listas
// (Mago/Clérigo) = Detectar Magia, Proteção Contra o Bem e o Mal (medido em
// dados/classes/magias_mago.json e magias_clerigo.json). "Luz" também é
// truque do Mago (medido acima) -- usado no fix round 1 (achados B/D do
// review) para simular um truque CONCEDIDO de outra classe.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const MAGO_CLERIGO = {
  classe: 'Mago', subclasse: '', nivel: 6, xp: 14000,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'Religião'],
  classes: [
    { classe: 'Mago', subclasse: '', nivel: 3, ordem: 0 },
    { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 3, ordem: 1 },
  ],
  schema_versao: 2,
};

/** Abre o modal Preparar Magias da superfície ativa e espera a grade. */
async function abrirPreparar(page) {
  await page.click('#btn-add-magia');
  await page.waitForSelector('#resultado-magias', { state: 'visible', timeout: 20_000 });
  await assentar(page).catch(() => {});
}

/** Fecha o modal aberto. */
async function fecharModal(page) {
  await page.evaluate(() => window.fecharModal());
  await assentar(page).catch(() => {});
}

/** Troca a superfície ativa da seção Magias da ficha. */
async function ativarClasse(page, classe) {
  await clicarSeletorFicha(page, `[data-tab-superficie="${classe}"]`,
    { esperar: `[data-tab-superficie="${classe}"].active` });
  await assentar(page).catch(() => {});
}

test('#105/#61: cada classe vê 3/3 dos próprios truques, o truque da outra fica travado e o domínio do Clérigo não aparece no Mago', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO_CLERIGO,
    magias_conhecidas: [
      { nome: 'Raio de Fogo', circulo: 0, classe: 'Mago' },
      { nome: 'Toque Chocante', circulo: 0, classe: 'Mago' },
      { nome: 'Reparar', circulo: 0, classe: 'Mago' },
      { nome: 'Chama Sagrada', circulo: 0, classe: 'Clérigo' },
      { nome: 'Orientação', circulo: 0, classe: 'Clérigo' },
      { nome: 'Taumaturgia', circulo: 0, classe: 'Clérigo' },
      { nome: 'Prestidigitação Arcana', circulo: 0, origem: 'especie' },
    ],
    magias_preparadas: [
      { nome: 'Identificar', circulo: 1, classe: 'Mago' },
      { nome: 'Bênção', circulo: 1, origem: 'dominio' },
      { nome: 'Curar Ferimentos', circulo: 1, origem: 'dominio' },
      { nome: 'Enfeitiçar Pessoa', circulo: 1, origem: 'iniciado_em_magia' },
    ],
  }, 'regras-105-61-escopo');

  // Migração carimba o domínio no Clérigo (Task 3).
  await expect.poll(async () => (await personagemSalvo(page))?.magias_preparadas?.find((m) => m.nome === 'Bênção')?.classe ?? null,
    { message: 'Bênção (Domínio da Vida) tinha de ser carimbada Clérigo na abertura' }).toBe('Clérigo');

  // ---- Mago ----
  await ativarClasse(page, 'Mago');
  await abrirPreparar(page);
  await expect(page.locator('#gm-contador-truques')).toHaveText(/Truques: 3\/3/);
  await expect(page.locator('#gm-bloco-sem-classe'), 'nada ambíguo nesta ficha').toHaveCount(0);
  await expect(page.locator('#gm-especiais-classe'), 'o domínio do Clérigo não pode aparecer no Mago')
    .not.toContainText('Bênção');
  await expect(page.locator('#gm-outras-origens'), 'talento aparece em Outras origens')
    .toContainText('Enfeitiçar Pessoa');
  await fecharModal(page);

  // ---- Clérigo ----
  await ativarClasse(page, 'Clérigo');
  await abrirPreparar(page);
  await expect(page.locator('#gm-contador-truques')).toHaveText(/Truques: 3\/3/);
  await expect(page.locator('#gm-especiais-classe')).toContainText('Bênção');
  await expect(page.locator('#gm-outras-origens')).toContainText('Enfeitiçar Pessoa');
  await expect(page.locator('#resultado-magias'), 'Identificar é do Mago -- não pode estar em Preparadas Atuais do Clérigo')
    .not.toContainText('Identificar');
  await page.locator('[data-tab-mg="truques"]').click();
  await assentar(page).catch(() => {});
  const reparar = page.locator('[data-truque-travado="Reparar"]');
  await expect(reparar, 'Reparar do Mago aparece travado na grade do Clérigo').toContainText('Conhecido pelo Mago');
  await expect(reparar.locator('[data-truque-check]'), 'o cartão travado não tem check').toHaveCount(0);
  await expect(page.locator('#gm-bloco-sem-classe'), 'truque de espécie nunca é ambíguo').toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('#105: truque ambíguo aparece no bloco "Classe não definida" e o clique grava a classe', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO_CLERIGO,
    magias_conhecidas: [
      { nome: 'Raio de Fogo', circulo: 0, classe: 'Mago' },
      { nome: 'Luz', circulo: 0 },
      { nome: 'Chama Sagrada', circulo: 0, classe: 'Clérigo' },
    ],
  }, 'regras-105-ambiguo');

  await ativarClasse(page, 'Mago');
  await abrirPreparar(page);
  const bloco = page.locator('#gm-bloco-sem-classe');
  await expect(bloco).toContainText('Luz');
  await expect(bloco.locator('[data-definir-classe-magia="Luz"][data-classe="Mago"]')).toBeVisible();
  await expect(bloco.locator('[data-definir-classe-magia="Luz"][data-classe="Clérigo"]')).toBeVisible();
  await expect(page.locator('#gm-contador-truques')).toHaveText(/Truques: 1\/3/);

  await bloco.locator('[data-definir-classe-magia="Luz"][data-classe="Mago"]').click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => (await personagemSalvo(page))?.magias_conhecidas?.find((m) => m.nome === 'Luz')?.classe ?? null)
    .toBe('Mago');
  await expect(page.locator('#gm-contador-truques')).toHaveText(/Truques: 2\/3/);
  await expect(page.locator('#gm-bloco-sem-classe')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('#105: excedente de truques fica vermelho, bloqueia adicionar e remover pelo check baixa a conta', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', subclasse: '', nivel: 3, xp: 900,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Arcanismo', 'História'],
    magias_conhecidas: [
      { nome: 'Raio de Fogo', circulo: 0, classe: 'Mago' },
      { nome: 'Toque Chocante', circulo: 0, classe: 'Mago' },
      { nome: 'Reparar', circulo: 0, classe: 'Mago' },
      { nome: 'Luz', circulo: 0, classe: 'Mago' },
      { nome: 'Raio de Gelo', circulo: 0, classe: 'Mago' },
    ],
  }, 'regras-105-excedente');

  await abrirPreparar(page);
  const contador = page.locator('#gm-contador-truques');
  await expect(contador).toHaveText(/Truques: 5\/3 \(acima do limite\)/);
  await expect(contador).toHaveClass(/contador-excedido/);
  await page.locator('[data-tab-mg="truques"]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('[data-toggle-truque="Mensagem"]'), 'cartão livre fica bloqueado').toHaveClass(/bloqueada/);

  await page.locator('[data-truque-check="Raio de Gelo"]').click();
  await assentar(page).catch(() => {});
  await expect(contador).toHaveText(/Truques: 4\/3 \(acima do limite\)/);
  await expect.poll(async () => (await personagemSalvo(page))?.magias_conhecidas?.some((m) => m.nome === 'Raio de Gelo'))
    .toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('#105: remover Luz na grade do Clérigo não apaga a Luz do Mago (dado legado duplicado)', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO_CLERIGO,
    magias_conhecidas: [
      { nome: 'Luz', circulo: 0, classe: 'Mago' },
      { nome: 'Luz', circulo: 0, classe: 'Clérigo' },
    ],
  }, 'regras-105-homonimo');

  await ativarClasse(page, 'Clérigo');
  await abrirPreparar(page);
  await page.locator('[data-tab-mg="truques"]').click();
  await assentar(page).catch(() => {});
  await page.locator('[data-truque-check="Luz"]').click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => (await personagemSalvo(page))?.magias_conhecidas
    ?.map((m) => `${m.nome}|${m.classe}`)).toEqual(['Luz|Mago']);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('canário: Mago de classe única sem carimbo não vê bloco, seções separadas nem mudança de contagem', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', subclasse: '', nivel: 3, xp: 900,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Arcanismo', 'História'],
    magias_conhecidas: [
      { nome: 'Raio de Fogo', circulo: 0 }, { nome: 'Luz', circulo: 0 }, { nome: 'Reparar', circulo: 0 },
    ],
    magias_preparadas: [{ nome: 'Enfeitiçar Pessoa', circulo: 1, origem: 'iniciado_em_magia' }],
  }, 'regras-105-canario');

  await expect.poll(async () => (await personagemSalvo(page))?.magias_conhecidas?.every((m) => m.classe === 'Mago'))
    .toBe(true);
  await abrirPreparar(page);
  await expect(page.locator('#gm-contador-truques')).toHaveText(/^\s*Truques: 3\/3\s*$/);
  await expect(page.locator('#gm-bloco-sem-classe')).toHaveCount(0);
  await expect(page.locator('#gm-outras-origens'), 'classe única mantém uma seção só de especiais').toHaveCount(0);
  await expect(page.locator('#gm-especiais-classe')).toContainText('Enfeitiçar Pessoa');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Fix round 1 (achados do review, rodada 1): A, B, C(coberto pelo canário
// já existente), D, E, F. Ver o report da Tarefa 4 para o texto completo
// de cada achado.
// ============================================================

test('#105 (achado A do review): preparada carimbada com OUTRA classe aparece travada na grade do círculo, e o clique não a remove', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO_CLERIGO,
    magias_preparadas: [
      { nome: 'Detectar Magia', circulo: 1, classe: 'Mago' },
    ],
  }, 'regras-105-preparada-travada');

  await ativarClasse(page, 'Clérigo');
  await abrirPreparar(page);
  await page.locator('[data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});

  const travada = page.locator('[data-magia-travada="Detectar Magia"]');
  await expect(travada, 'Detectar Magia carimbada Mago aparece travada na grade do 1º círculo do Clérigo')
    .toContainText('Preparada pelo Mago');
  await expect(travada.locator('[data-circ-check]'), 'o cartão travado não tem check').toHaveCount(0);
  await expect(page.locator('[data-circ-check="Detectar Magia"]'),
    'não pode sobrar um cartão livre com o mesmo nome').toHaveCount(0);

  // O clique não existe (cartão travado não tem check), mas a entrada do
  // Mago precisa continuar intacta -- é o que o achado A relata que o
  // código antigo apagava em silêncio.
  await expect.poll(async () => (await personagemSalvo(page))?.magias_preparadas
    ?.find((m) => m.nome === 'Detectar Magia')?.classe).toBe('Mago');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('#105 (achado B do review): truque concedido de OUTRA classe (origem que não conta no limite) aparece travado, não livre', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO_CLERIGO,
    magias_conhecidas: [
      // "Luz" também é truque do Mago (medido no cabeçalho) -- sem o fix,
      // este cartão aparecia LIVRE na grade do Mago, com check que clicava
      // e não fazia nada (a guarda `truqueEhTrocavel` do handler recusava
      // em silêncio).
      { nome: 'Luz', circulo: 0, origem: 'subclasse_automatica', classe: 'Clérigo' },
    ],
  }, 'regras-105-concedido-outra-classe');

  await ativarClasse(page, 'Mago');
  await abrirPreparar(page);
  await page.locator('[data-tab-mg="truques"]').click();
  await assentar(page).catch(() => {});

  const travado = page.locator('[data-truque-travado="Luz"]');
  await expect(travado, 'Luz concedida ao Clérigo (subclasse_automatica) aparece travada na grade do Mago')
    .toContainText('Conhecido pelo Clérigo');
  await expect(travado.locator('[data-truque-check]'), 'o cartão travado não tem check').toHaveCount(0);
  await expect(page.locator('[data-truque-check="Luz"]'),
    'não pode sobrar um cartão livre e clicável com o mesmo nome').toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('#105 (achado F do review): bloco "Classe não definida" resolve preparada ambígua de círculo, e atualiza #gm-contador-preparadas', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO_CLERIGO,
    magias_preparadas: [
      // Sem `classe` -- ambígua de propósito. "Detectar Magia" está nas
      // duas listas (medido no cabeçalho), então o bloco oferece os dois
      // botões de classe.
      { nome: 'Detectar Magia', circulo: 1 },
    ],
  }, 'regras-105-ambiguo-preparada');

  await ativarClasse(page, 'Mago');
  await abrirPreparar(page);
  const bloco = page.locator('#gm-bloco-sem-classe');
  await expect(bloco).toContainText('Detectar Magia');
  await expect(bloco.locator('[data-definir-classe-magia="Detectar Magia"][data-classe="Mago"][data-lista="preparadas"]'))
    .toBeVisible();
  await expect(bloco.locator('[data-definir-classe-magia="Detectar Magia"][data-classe="Clérigo"][data-lista="preparadas"]'))
    .toBeVisible();
  await expect(page.locator('#gm-contador-preparadas')).toHaveText(/Preparadas: 0\/\d+/);

  await bloco.locator('[data-definir-classe-magia="Detectar Magia"][data-classe="Mago"]').click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => (await personagemSalvo(page))?.magias_preparadas
    ?.find((m) => m.nome === 'Detectar Magia')?.classe).toBe('Mago');
  await expect(page.locator('#gm-contador-preparadas')).toHaveText(/Preparadas: 1\/\d+/);
  await expect(page.locator('#gm-bloco-sem-classe')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('#61: na lista da ficha, a magia de domínio mostra a origem e a classe dona', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO_CLERIGO,
    magias_preparadas: [{ nome: 'Bênção', circulo: 1, origem: 'dominio', classe: 'Clérigo' }],
  }, 'regras-61-rotulo');
  const cartao = page.locator('.magia-item[data-magia-nome="Bênção"]');
  await expect(cartao).toContainText('Clérigo');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Achado de campo (2026-09-23, ficha real do usuário): Bardo 3/Bruxo 1.
// Bruxo é caster "conhecidas" (tipo_conjuracao, dados-classes.js) -- o
// modal abre como "Consultar Magias" e a grade de truques nunca renderiza
// `data-truque-check` (é `somenteConsulta ? '' : data-truque-check...`),
// porque truque de caster "conhecidas" é escolhido no assistente de
// subida, não marcado aqui. Mas o excedente de truques (issue #105,
// decisão "sinalizar e bloquear novos, remover pelo check") também pode
// acontecer numa classe assim -- e sem check nenhum, o jogador não tinha
// NENHUM caminho nesta tela para tirar o excedente: "não consigo nem
// selecionar nem desmarcar". Nomes medidos em dados/classes/magias_bruxo.json
// e magias_bardo.json (2026-09-23): "Golpe Certeiro" só no Bardo; "Badalar
// Fúnebre", "Proteção Contra Lâminas" e "Toque Necrótico" só no Bruxo.
// ============================================================
test('#105: caster "conhecidas" acima do limite de truques ainda deixa remover o excedente pelo check', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Bardo', subclasse: '', nivel: 4, xp: 2700,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Atuação', 'Persuasão'],
    classes: [
      { classe: 'Bardo', subclasse: '', nivel: 3, ordem: 0 },
      { classe: 'Bruxo', subclasse: '', nivel: 1, ordem: 1 },
    ],
    schema_versao: 2,
    // Já pós-migração (classe carimbada) -- este caso isola o bug da UI,
    // não a migração (já coberta pelos outros specs deste arquivo).
    magias_conhecidas: [
      { nome: 'Golpe Certeiro', circulo: 0, classe: 'Bardo' },
      { nome: 'Badalar Fúnebre', circulo: 0, classe: 'Bruxo' },
      { nome: 'Proteção Contra Lâminas', circulo: 0, classe: 'Bruxo' },
      { nome: 'Toque Necrótico', circulo: 0, classe: 'Bruxo' },
    ],
  }, 'regras-105-excedente-consulta');

  await ativarClasse(page, 'Bruxo');
  await abrirPreparar(page);
  await expect(page.locator('#modal-titulo'), 'Bruxo é "conhecidas" -- o modal abre em modo consulta').toHaveText('Consultar Magias');
  await expect(page.locator('#gm-contador-truques')).toHaveText(/Truques: 3\/2 \(acima do limite\)/);

  await page.locator('[data-tab-mg="truques"]').click();
  await assentar(page).catch(() => {});

  const excedente = page.locator('[data-truque-check="Badalar Fúnebre"]');
  await expect(excedente, 'o excedente de um caster "conhecidas" precisa continuar removível pelo check').toBeVisible();
  await excedente.click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#gm-contador-truques')).toHaveText(/Truques: 2\/2/);
  await expect.poll(async () => (await personagemSalvo(page))?.magias_conhecidas?.some((m) => m.nome === 'Badalar Fúnebre'))
    .toBe(false);

  // Voltou ao limite: a classe volta a ser consulta pura, sem check nenhum
  // -- o escape só existe enquanto a classe está de fato acima do limite.
  await expect(page.locator('[data-truque-check="Proteção Contra Lâminas"]'),
    'fora do excedente, caster "conhecidas" continua sem check nenhum').toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
