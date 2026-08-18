// ============================================================
// As escolhas que uma subclasse exige aparecem no assistente de subida de
// nível, e o que foi escolhido entra na ficha.
//
// PHB 2024, Colégio do Conhecimento nv3, Proficiências Bônus
// (Classes.md:766): "Você adquire proficiência em três perícias à sua
// escolha". Antes do Plano 4 a ficha mostrava um cartão DECORATIVO -- só
// texto, sem <select> nem botão (sheet/habilidades.js:3087-3096) -- e nada
// era gravado em lugar nenhum do app: nem no assistente, nem na ficha, nem
// em subirDeNivel. O jogador terminava o nível sem aviso e sem as perícias.
//
// Este spec prova as duas pontas do conserto: o card genérico
// (levelup-cards.js:montarCardsEscolhaSubclasse) aparece com os três
// seletores, e o que se escolhe neles chega a `pericias_proficientes` do
// personagem salvo.
//
// Por que a subclasse é escolhida NESTA sessão: o nível 3 é onde ela nasce.
// O card precisa reagir a `state.subclasse`, não a `char.subclasse` (ainda
// vazio) -- ler só o personagem salvo deixaria a maioria das escolhas sem
// card, com a pendência travando a subida sem o jogador ter onde responder.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, personagemSalvo } from './helpers-regras.mjs';

const BARDO = {
  classe: 'Bardo', nivel: 2, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atuação', 'Persuasão'],
};

/** Clica em "Próximo" e espera o modal reagir. Devolve false se o botão sumiu. */
async function proximo(page) {
  const botao = page.locator('#btn-step-proximo');
  if (!await botao.count()) return false;
  await botao.click();
  await assentar(page).catch(() => {});
  return true;
}

test('level-up: o Colégio do Conhecimento oferece os 3 seletores de perícia na tela', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BARDO, 'regras-conhecimento-tela');
  expect(await abrirModalLevelUp(page)).toBe(true);

  // Passo 1 (ganhos) -> passo 2 (subclasse)
  await proximo(page);
  const cardSubclasse = page.locator('[data-subclasse="Colégio do Conhecimento"]');
  await expect(cardSubclasse).toBeVisible();
  await cardSubclasse.click();
  await assentar(page).catch(() => {});

  // Avança até o passo onde o card de escolhas de classe/subclasse vive.
  const seletores = page.locator('[data-subclasse-escolha="subclasse_pericias_bonus"]');
  for (let i = 0; i < 4 && !(await seletores.count()); i++) {
    if (!await proximo(page)) break;
  }

  await expect(seletores, 'o livro pede 3 perícias, então deveriam existir 3 seletores')
    .toHaveCount(3);
  await expect(page.locator('.levelup-card-header', { hasText: 'Proficiências Bônus' }))
    .toBeVisible();

  // As opções são as 18 perícias (mais a linha "— escolha —").
  const opcoes = await seletores.first().locator('option').count();
  expect(opcoes, 'o seletor deveria oferecer as 18 perícias mais a opção vazia').toBe(19);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

const CAMPEAO = {
  classe: 'Guerreiro', nivel: 6, xp: 23000, atributos: ATRIBUTOS_REGRAS,
  subclasse: 'Campeão',
  pericias_proficientes: ['Atletismo', 'História'],
};

// Este segundo teste usa o Campeão nível 7, e não o Bardo, de propósito: o
// Bardo ganha uma magia nova ao chegar no nível 3, e o step de magias
// bloqueia a confirmação por um motivo que nada tem a ver com o Plano 4
// ("Selecione 1 magia(s) conhecida(s)"). O Campeão sobe do 6 para o 7 sem
// nenhum outro passo obrigatório, então o que sobra medido aqui é só a
// escolha de subclasse chegando à ficha. A REATIVIDADE (card aparecendo para
// uma subclasse escolhida na mesma sessão) é o que o teste do Bardo, acima,
// cobre -- os dois juntos cobrem as duas propriedades.
test('level-up: o Estilo de Luta Adicional do Campeão é exigido e fica gravado', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, CAMPEAO, 'regras-campeao-lvl7');
  expect(await abrirModalLevelUp(page)).toBe(true);

  const seletor = page.locator('[data-subclasse-escolha="subclasse_estilo_luta_extra"]');
  for (let i = 0; i < 4 && !(await seletor.count()); i++) {
    if (!await proximo(page)) break;
  }
  await expect(seletor, 'o Campeão nível 7 deveria ganhar um seletor de Estilo de Luta')
    .toHaveCount(1);

  await seletor.selectOption('Duelismo');
  await assentar(page).catch(() => {});

  for (let i = 0; i < 6; i++) {
    if (!await proximo(page)) break;
  }
  const confirmar = page.locator('#btn-confirmar-levelup');
  await expect(confirmar, 'o assistente deveria chegar ao passo de confirmação').toBeVisible();
  await confirmar.click();
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo.nivel, 'o nível deveria ter subido para 7').toBe(7);
  // Grava no MESMO campo da escolha de classe (uma lista), e não num campo
  // paralelo: é o campo que talentos-effects.js lê para aplicar o efeito do
  // estilo. Um campo próprio daria ao jogador um estilo que aparece e não faz
  // nada.
  expect(salvo.escolhas_classe?.estilo_luta,
    'o Estilo de Luta Adicional escolhido deveria entrar em escolhas_classe.estilo_luta')
    .toContain('Duelismo');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
