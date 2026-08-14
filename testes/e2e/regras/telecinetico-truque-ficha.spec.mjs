// ============================================================
// REGRA DA CASA (não do livro): Telecinético para quem já conhece
// Mãos Mágicas oferece a escolha de outro truque, da lista de Mago.
//
// O motor (validar/aplicar, regras-cobertura.js) é coberto por
// testes/regras/unidade/telecinetico-truque.test.mjs, que também documenta
// por que isto é regra da casa: o PHB 2024 §Telecinético diz apenas "Você
// aprende a magia Mãos Mágicas", sem cláusula de substituição.
//
// Aqui o alvo é a TELA -- o par renderEscolhasTalento/bindEscolhasTalento
// (levelup-ui.js) mais a leitura da escolha pelo "+ Talento" da ficha
// (sheet/talentos.js). Um motor correto com a tela desligada gravaria o
// talento sem truque nenhum, em silêncio: exatamente a classe de falha que
// já mordeu este projeto quando um <select> virou card e alguém continuou
// lendo `?.value`.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, ATRIBUTOS_REGRAS, assentar } from './helpers-regras.mjs';

// Ladino nível 4: o Trapaceiro Arcano recebe Mãos Mágicas obrigatoriamente
// (PHB 2024, linha 6811), então é o caso de sobreposição mais comum do
// livro -- e nível 4 satisfaz o pré-requisito de Telecinético.
const SEMENTE = {
  classe: 'Ladino',
  nivel: 4,
  xp: 355000,
  atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
  talentos: [],
};

/** Nomes dos truques (círculo 0) do personagem salvo */
function truquesDe(salvo) {
  return (salvo?.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome);
}

/** Abre o "+ Talento" e seleciona o card de um talento pelo nome */
async function escolherTalento(page, nome) {
  await page.click('#btn-add-talento');
  await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });
  const card = page.locator(`#add-talento-lista .opcao-card[data-opcao="${nome}"]`);
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await card.click();
  await page.click('#btn-confirmar-add-talento');
  await assentar(page);
}

test('ficha: Telecinético com Mãos Mágicas oferece truque substituto e o grava', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    ...SEMENTE,
    magias_conhecidas: [{ nome: 'Mãos Mágicas', circulo: 0 }],
  });

  await escolherTalento(page, 'Telecinético');

  // A tela de configuração tem de trazer o seletor de truque substituto.
  const lista = page.locator('#lvlup-telecinetico-truque-lista');
  await expect(lista, 'a escolha de truque substituto não foi oferecida')
    .toBeVisible({ timeout: 5000 });

  // Mãos Mágicas, que o personagem já tem, precisa estar bloqueada -- é o
  // motivo de a tela existir; escolhê-la de volta não concederia nada.
  // Cards bloqueados NÃO somem: cardOpcaoHtml (ui-opcoes.js:127) mantém o
  // `data-opcao` e acrescenta a classe `bloqueada` (que app.css desativa com
  // pointer-events:none), trocando o círculo de check pelo motivo. Por isso
  // a asserção é sobre a classe, não sobre a ausência do card.
  await expect(lista.locator('.opcao-card[data-opcao="Mãos Mágicas"]'),
    'Mãos Mágicas continuou selecionável no substituto')
    .toHaveClass(/bloqueada/);

  const substituto = lista.locator('.opcao-card[data-opcao="Raio de Gelo"]');
  await expect(substituto, 'a lista de truques de Mago nasceu vazia')
    .toBeVisible({ timeout: 5000 });
  await substituto.click();

  // Atributo do talento (+1 em Int/Sab/Car) -- obrigatório nos dois ramos.
  await page.selectOption('#levelup-talento-asi', 'inteligencia');
  await page.click('#btn-confirmar-add-talento-asi');
  await assentar(page);

  const salvo = await personagemSalvo(page);
  const nomesTalento = (salvo?.talentos || []).map(t => (typeof t === 'string' ? t : t?.nome));
  expect(nomesTalento, 'o talento não foi gravado').toContain('Telecinético');

  const truques = truquesDe(salvo);
  expect(truques, 'o truque substituto escolhido não foi gravado').toContain('Raio de Gelo');
  // E Mãos Mágicas continua uma só vez -- o talento não pode duplicá-la.
  expect(truques.filter(n => n === 'Mãos Mágicas').length,
    'Mãos Mágicas foi duplicada pelo talento').toBe(1);
});

test('ficha: Telecinético sem Mãos Mágicas continua igual ao livro (concede Mãos Mágicas, sem escolher truque)', async ({ context }) => {
  // Guarda do lado oposto: a regra da casa não pode vazar para quem não
  // está no caso de sobreposição, ou o talento passaria a pedir uma escolha
  // que o livro não pede a ninguém.
  const { page } = await abrirFicha(context, { ...SEMENTE, magias_conhecidas: [] });

  await escolherTalento(page, 'Telecinético');

  await expect(page.locator('#lvlup-telecinetico-truque-lista'),
    'pediu truque substituto a quem não conhece Mãos Mágicas')
    .toHaveCount(0);

  await page.selectOption('#levelup-talento-asi', 'inteligencia');
  await page.click('#btn-confirmar-add-talento-asi');
  await assentar(page);

  const salvo = await personagemSalvo(page);
  expect(truquesDe(salvo), 'Mãos Mágicas não foi concedida pelo talento')
    .toContain('Mãos Mágicas');
});
