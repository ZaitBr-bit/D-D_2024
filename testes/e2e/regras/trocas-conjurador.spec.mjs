// ============================================================
// Trocas de truque e de magia das classes conjuradoras.
//
// REGRA DA CASA (decisão do dono do produto, 2026-08-13), mais permissiva
// que o PHB 2024: toda classe conjuradora pode trocar truque E magia tanto
// no Descanso Longo quanto ao subir de nível. O livro varia por classe --
// truque no Descanso Longo é só do Mago (linha 6942) e do Alto Elfo (8699),
// e a troca de magia de Bardo/Bruxo/Feiticeiro é ao subir de nível (2780,
// 3258, 4999), não no descanso. Este arquivo testa a REGRA DA CASA; o
// desvio está declarado aqui de propósito para não parecer engano.
//
// Duas lacunas concretas que existiam antes:
//   1. O Descanso Longo não oferecia troca de truque a NINGUÉM
//      (hp-descanso.js só tratava magias).
//   2. O card "Trocar Magia" do level-up era gated em
//      `tipoConj === 'conhecidas'` (levelup-cards.js), deixando de fora as
//      classes preparadas e as subclasses conjuradoras.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, ATRIBUTOS_REGRAS, assentar, abrirModalLevelUp, clicarBotaoFicha } from './helpers-regras.mjs';

// Clérigo: classe preparada (dados-classes.js), justamente a categoria que
// ficava de fora do card de troca de magia no level-up. Nível 3 com um
// truque de classe e uma magia preparada escolhidos pelo jogador -- sem
// `origem`, que é o que marca as escolhas NÃO trocáveis (domínio, espécie,
// talento).
const CLERIGO_TROCAVEL = {
  classe: 'Clérigo',
  nivel: 3,
  xp: 355000,
  atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['História', 'Religião'],
  magias_conhecidas: [{ nome: 'Chama Sagrada', circulo: 0 }],
  // DUAS magias preparadas de propósito: com uma só, `montarTroca`
  // (ui-opcoes.js:421) entra no caminho `umSo`, que renderiza a única
  // opção como card de apresentação SEM `data-opcao` e exige o botão
  // "Trocar este". Com duas, o passo 1 é um montarSeletor normal -- que é
  // o caso que este teste quer exercer, e o caso comum de uso.
  magias_preparadas: [
    { nome: 'Curar Ferimentos', circulo: 1 },
    { nome: 'Bênção', circulo: 1 },
  ],
};


test('descanso longo: conjurador com truque de classe recebe a opção de trocar truque', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO_TROCAVEL);

  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page);

  const botaoTruque = page.locator('#btn-trocar-truque-dl');
  await expect(botaoTruque, 'o Descanso Longo não ofereceu troca de truque')
    .toBeVisible({ timeout: 5000 });

  await botaoTruque.click();
  await assentar(page);

  // O modal de troca lista os truques de classe do personagem como
  // candidatos a sair -- se nascer vazio, a troca é decorativa.
  const cardSaindo = page.locator('#troca-truque-remover-lista .opcao-card[data-opcao="Chama Sagrada"]');
  await expect(cardSaindo, 'o truque de classe não apareceu como trocável')
    .toBeVisible({ timeout: 5000 });

  await cardSaindo.click();
  await assentar(page);

  // Escolhido o que sai, a lista de substitutos aparece. Um truque de
  // Clérigo que o personagem ainda não tem.
  const cardEntrando = page.locator('#troca-truque-adicionar-lista .opcao-card[data-opcao="Orientação"]');
  await expect(cardEntrando, 'a lista de truques substitutos nasceu vazia')
    .toBeVisible({ timeout: 5000 });
  await cardEntrando.click();
  await clicarBotaoFicha(page, 'btn-confirmar-troca-truque');
  await assentar(page);

  const salvo = await personagemSalvo(page);
  const truques = (salvo?.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome);
  expect(truques, 'a troca de truque não foi gravada').toContain('Orientação');
  expect(truques, 'o truque antigo continuou na ficha').not.toContain('Chama Sagrada');
});

test('descanso longo: sem truque de classe trocável, a opção não aparece', async ({ context }) => {
  // Guarda contra o oposto do bug: oferecer a troca a quem não tem nada
  // para trocar abriria um modal vazio. Paladino nível 3 sem Combatente
  // Abençoado é conjurador e não tem truque nenhum.
  const { page } = await abrirFicha(context, {
    classe: 'Paladino',
    nivel: 3,
    xp: 355000,
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atletismo', 'História'],
    magias_conhecidas: [],
  });

  // Espera o proprio modal do Descanso Longo (e nao o botao de truque, que
  // este teste exige AUSENTE) -- sem isso, um clique perdido daria o mesmo
  // "count 0" que o teste procura, e ele passaria por acidente.
  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#btn-pular-troca-dl' });
  await assentar(page);

  await expect(page.locator('#btn-trocar-truque-dl'),
    'ofereceu troca de truque a quem não tem truque nenhum')
    .toHaveCount(0);
});

test('level-up: classe preparada também recebe o card de trocar magia', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO_TROCAVEL);

  // `abrirModalLevelUp` (helpers-regras.mjs) tem a retentativa de clique
  // exigida sob carga -- ver o comentario dela; nao reimplementar aqui.
  await abrirModalLevelUp(page);

  // Avanca ate o passo de Selecao de Magias. Mesma disciplina de
  // `irAteEscolhaDeTalento`: espera fixa e curta e instavel sob carga,
  // entao o laco tem folga e so desiste depois de varias voltas.
  const cardTroca = page.locator('#levelup-troca-magia');
  for (let i = 0; i < 10; i++) {
    if (await cardTroca.count()) break;
    const proximo = page.locator('#btn-step-proximo');
    if (await proximo.count()) await proximo.click();
    await page.waitForTimeout(500);
  }

  await expect(cardTroca,
    'o card de troca de magia não apareceu para uma classe preparada (Clérigo)')
    .toBeVisible({ timeout: 5000 });

  // E a magia preparada do jogador tem de estar entre as que podem sair.
  await expect(cardTroca.locator('.opcao-card[data-opcao="Curar Ferimentos"]'),
    'a magia preparada do jogador não apareceu como trocável')
    .toBeVisible({ timeout: 5000 });
});
