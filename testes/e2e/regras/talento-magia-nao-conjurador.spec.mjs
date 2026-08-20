// ============================================================
// Talentos que concedem magia a quem NÃO é conjurador: a seção de
// Magias tem de existir na ficha.
//
// Livro, Talentos.md:710 §Tocado Por Fadas:
//   "Escolha uma magia de 1º círculo da escola de magia Adivinhação ou
//    Encantamento. Você tem sempre essa magia e *Passo Nebuloso*
//    preparadas, podendo conjurá-las sem gastar espaço de magia."
//
// O talento é Geral, sem pré-requisito de conjuração -- um Monge, um
// Guerreiro ou um Bárbaro podem pegá-lo, e nenhum deles é conjurador.
//
// Issue #20: o motor sempre funcionou (regras-cobertura.js grava as duas
// magias em `magias_preparadas` com `origem: 'tocado_por_fadas'`), mas o
// PORTÃO DE RENDERIZAÇÃO da seção de Magias (sheet/ficha.js) só a montava
// para conjurador de classe, subclasse conjuradora, Iniciado em Magia ou
// magias personalizadas. Para um Monge com Tocado Por Fadas as magias
// existiam no personagem e a seção inteira não era montada -- nada
// falhava, nada dava erro, a ficha simplesmente pulava de Traços de
// Espécie para Inventário.
//
// Por isso o alvo aqui é a TELA, com clique de verdade no "+ Talento":
// um teste de unidade sobre o motor passaria com o bug inteiro em pé.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, ATRIBUTOS_REGRAS, assentar } from './helpers-regras.mjs';

// Monge nível 4: não-conjurador (nem a classe nem a subclasse conjuram) e
// no nível mínimo do talento Geral. É a classe da issue #20.
const SEMENTE = {
  classe: 'Monge',
  nivel: 4,
  xp: 355000,
  atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Acrobacia', 'História'],
  talentos: [],
};

// Marca do Caçador: 1º círculo, Adivinhação (Magias.md:4837). É da lista do
// Guardião, mas o talento não restringe por classe -- só por círculo e
// escola --, então é escolha legal. Foi a escolha do relato da issue #20.
const MAGIA_ESCOLHIDA = 'Marca do Caçador';
// Concedida junto, sempre, pelo texto do talento.
const MAGIA_PARCEIRA = 'Passo Nebuloso';

/** Abre o "+ Talento" da ficha e seleciona o card do talento pelo nome */
async function escolherTalento(page, nome) {
  await page.click('#btn-add-talento');
  await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });
  const card = page.locator(`#add-talento-lista .opcao-card[data-opcao="${nome}"]`);
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await card.click();
  await page.click('#btn-confirmar-add-talento');
  await assentar(page);
}

test('ficha: Monge sem magia nenhuma não mostra a seção de Magias', async ({ context }) => {
  // O converso do teste principal. Sem ele, "abrir o portão para todo
  // mundo" passaria como correção -- e a ficha de todo não-conjurador
  // ganharia uma seção de Magias vazia.
  const { page } = await abrirFicha(context, SEMENTE);

  await expect(page.locator('#btn-add-magia'),
    'Monge sem talento de magia não deveria ter seção de Magias')
    .toHaveCount(0);
});

test('ficha: Monge com Tocado Por Fadas mostra a magia escolhida e a parceira',
  async ({ context }) => {
    const { page } = await abrirFicha(context, SEMENTE);

    // Antes do talento, a seção não existe -- confirma que é o talento que
    // a traz, e não um estado herdado da semente.
    await expect(page.locator('#btn-add-magia')).toHaveCount(0);

    await escolherTalento(page, 'Tocado Por Fadas');

    // Seletor de magia de 1º círculo (Adivinhação ou Encantamento),
    // populado assincronamente por bindEscolhasTalento (levelup-ui.js).
    const lista = page.locator('#lvlup-magia-escola-lista');
    await expect(lista, 'a escolha de magia de 1º círculo não foi oferecida')
      .toBeVisible({ timeout: 5000 });
    const cardMagia = lista.locator(`.opcao-card[data-opcao="${MAGIA_ESCOLHIDA}"]`);
    await expect(cardMagia, `${MAGIA_ESCOLHIDA} não apareceu entre as opções`)
      .toBeVisible({ timeout: 5000 });
    await cardMagia.click();

    // +1 em Inteligência, Sabedoria ou Carisma -- obrigatório no talento.
    await page.selectOption('#levelup-talento-asi', 'sabedoria');
    await page.click('#btn-confirmar-add-talento-asi');
    await assentar(page);

    // 1. O motor gravou as duas magias no personagem.
    const salvo = await personagemSalvo(page);
    const preparadas = (salvo?.magias_preparadas || []);
    for (const nome of [MAGIA_ESCOLHIDA, MAGIA_PARCEIRA]) {
      const gravada = preparadas.find(m => m?.nome === nome);
      assertGravada(gravada, nome);
    }

    // 2. E a ficha as MOSTRA -- que é o que a issue #20 relatava faltando.
    // Chegar até aqui depende de o fluxo do "+ Talento" ter fechado sozinho:
    // enquanto persistirTalento chamava `fecharModal` (que só removia a
    // camada de cima do modal empilhado), a lista de talentos ficava por
    // cima da ficha e interceptava todo clique daqui para baixo. Esse
    // defeito é guardado por talento-ficha-modal-fecha.spec.mjs.
    await expect(page.locator('#btn-add-magia'),
      'a seção de Magias não foi montada para o não-conjurador')
      .toBeVisible({ timeout: 5000 });

    // Cada círculo mora num <details> que nasce recolhido -- para todo
    // personagem, conjurador ou não. Expandir com clique de verdade é o que
    // o jogador faz; asserir sem expandir estaria medindo a UI de colapso,
    // não o portão da seção.
    for (const [nome, circulo] of [[MAGIA_ESCOLHIDA, 1], [MAGIA_PARCEIRA, 2]]) {
      const bloco = page.locator(`details[data-details-id="magias-circulo-${circulo}"]`);
      await expect(bloco, `o ${circulo}º círculo não foi montado na seção de Magias`)
        .toBeVisible({ timeout: 5000 });
      await bloco.locator('summary').click();

      const item = page.locator(`.magia-item[data-magia-nome="${nome}"]`);
      await expect(item, `${nome} não apareceu na seção de Magias`)
        .toBeVisible({ timeout: 5000 });
      await expect(item, `${nome} apareceu sem o rótulo de origem do talento`)
        .toContainText('Tocado Por Fadas');
    }

    /** Falha com mensagem útil se a magia não foi gravada com a origem certa */
    function assertGravada(magia, nome) {
      expect(magia, `${nome} não foi gravada em magias_preparadas`).toBeTruthy();
      expect(magia.origem, `${nome} foi gravada com origem "${magia?.origem}"`)
        .toBe('tocado_por_fadas');
    }
  });

test('ficha: Guerreiro com Conjurador Ritualista também mostra a seção de Magias',
  async ({ context }) => {
    // A issue #20 chegou como um caso (Monge + Tocado Por Fadas), mas o
    // portão fechado atingia toda origem de magia vinda de talento. Este
    // segundo caso é o que impede a correção de ser feita só para
    // `tocado_por_fadas` e deixar os vizinhos quebrados.
    const { page } = await abrirFicha(context, {
      classe: 'Guerreiro',
      nivel: 4,
      xp: 355000,
      atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Atletismo', 'História'],
      talentos: [],
      // Semeado direto: o caminho de aquisição pelo "+ Talento" já é
      // coberto por talento-conjurador-ritualista.spec.mjs. O que se
      // afirma AQUI é só o portão de renderização.
      magias_preparadas: [
        { nome: 'Detectar Magia', circulo: 1, origem: 'conjurador_ritualista' },
      ],
    });

    await expect(page.locator('#btn-add-magia'),
      'seção de Magias não montada para magia de Conjurador Ritualista')
      .toBeVisible({ timeout: 5000 });
    await page.locator('details[data-details-id="magias-circulo-1"] summary').click();
    await expect(page.locator('.magia-item[data-magia-nome="Detectar Magia"]'))
      .toBeVisible({ timeout: 5000 });
  });
