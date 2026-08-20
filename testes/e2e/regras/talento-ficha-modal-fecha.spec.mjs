// ============================================================
// O "+ Talento" da ficha tem de FECHAR ao terminar.
//
// O fluxo tem dois passos: "Adicionar Talento" (a lista) e, para quem tem
// escolhas, "Configurar Talento" (atributo, magia, perícia). O segundo
// abre EMPILHADO sobre o primeiro -- abrirModal (utils.js) transforma em
// sub-modal qualquer modal aberto com outro já visível, e isso é
// deliberado: cancelar a configuração devolve o jogador à lista.
//
// O que não estava certo é o fim feliz. `persistirTalento` chamava
// `fecharModal()`, que com sub-modal aberto remove SÓ o de cima
// (utils.js:786-791) -- a lista de talentos ficava aberta por cima da
// ficha depois de "Talento adicionado", e o jogador tinha de clicar em
// Cancelar para chegar à própria ficha que acabara de mudar.
//
// Nenhuma suíte pegava isso: os specs de talento conferiam o personagem
// salvo no localStorage e nunca voltavam a tocar na ficha. Só apareceu
// quando talento-magia-nao-conjurador.spec.mjs precisou clicar na seção
// de Magias depois de adicionar o talento, e o clique foi interceptado
// pelo modal que sobrou.
//
// Os dois ramos são afirmados aqui de propósito: o talento SEM escolhas
// nunca empilhou nada e já fechava certo -- é ele que impede a correção
// de virar "fecha tudo sempre" sem ninguém notar se o passo 1 quebrar.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, ATRIBUTOS_REGRAS, assentar } from './helpers-regras.mjs';

// Monge nível 4: satisfaz o pré-requisito dos talentos Gerais e não é
// conjurador (nenhuma tela extra de magia entra no caminho).
const SEMENTE = {
  classe: 'Monge',
  nivel: 4,
  xp: 355000,
  atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Acrobacia', 'História'],
  talentos: [],
};

/** Estado dos modais: o principal (display) e quantos sub-modais restam */
async function estadoModais(page) {
  return page.evaluate(() => ({
    principal: document.getElementById('modal-overlay')?.style.display || 'none',
    subs: document.querySelectorAll('.sub-modal-overlay').length,
  }));
}

/** Abre o "+ Talento" e seleciona o card do talento pelo nome */
async function escolherTalento(page, nome) {
  await page.click('#btn-add-talento');
  await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });
  const card = page.locator(`#add-talento-lista .opcao-card[data-opcao="${nome}"]`);
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await card.click();
  await page.click('#btn-confirmar-add-talento');
  await assentar(page);
}

test('ficha: talento COM configuração fecha todos os modais ao ser adicionado',
  async ({ context }) => {
    const { page } = await abrirFicha(context, SEMENTE);

    await escolherTalento(page, 'Tocado Por Fadas');

    // Confirma o empilhamento -- se um dia "Configurar Talento" deixar de
    // ser sub-modal, este teste passaria por outro motivo e pararia de
    // guardar o que veio guardar.
    expect(await estadoModais(page),
      '"Configurar Talento" deveria abrir empilhado sobre a lista')
      .toEqual({ principal: 'flex', subs: 1 });

    const lista = page.locator('#lvlup-magia-escola-lista');
    await expect(lista).toBeVisible({ timeout: 5000 });
    await lista.locator('.opcao-card[data-opcao="Marca do Caçador"]').click();
    await page.selectOption('#levelup-talento-asi', 'sabedoria');
    await page.click('#btn-confirmar-add-talento-asi');
    await assentar(page);

    // O talento entrou -- é o fim feliz, não uma falha de validação (que
    // deve MANTER o modal aberto, e é o assunto do último teste).
    const salvo = await personagemSalvo(page);
    const nomes = (salvo?.talentos || []).map(t => (typeof t === 'string' ? t : t?.nome));
    expect(nomes, 'o talento não foi gravado').toContain('Tocado Por Fadas');

    expect(await estadoModais(page),
      'sobrou modal aberto por cima da ficha depois de adicionar o talento')
      .toEqual({ principal: 'none', subs: 0 });

    // E a ficha por baixo tem de estar clicável de verdade: um overlay
    // esquecido não some do DOM, ele fica capturando o ponteiro.
    await page.locator('#btn-add-talento').click({ timeout: 5000 });
    await expect(page.locator('#add-talento-lista')).toBeVisible({ timeout: 5000 });
  });

test('ficha: talento SEM configuração continua fechando ao ser adicionado',
  async ({ context }) => {
    // Alerta é Geral e não pede escolha nenhuma: persistirTalento é chamado
    // direto do passo 1, sem sub-modal no caminho.
    const { page } = await abrirFicha(context, SEMENTE);

    await escolherTalento(page, 'Alerta');
    await assentar(page);

    const salvo = await personagemSalvo(page);
    const nomes = (salvo?.talentos || []).map(t => (typeof t === 'string' ? t : t?.nome));
    expect(nomes, 'o talento não foi gravado').toContain('Alerta');

    expect(await estadoModais(page),
      'o talento sem escolhas deixou modal aberto')
      .toEqual({ principal: 'none', subs: 0 });
  });

test('ficha: escolha faltando MANTÉM o modal aberto para o jogador corrigir',
  async ({ context }) => {
    // O contrapeso da correção. Fechar tudo no sucesso não pode virar
    // fechar tudo sempre: quando validarEscolhasTalento recusa, o jogador
    // precisa continuar na tela onde errou, com o que já preencheu.
    //
    // A recusa é provocada pelo caminho que um jogador realmente percorre:
    // confirmar Tocado Por Fadas sem escolher a magia de 1º círculo
    // (regras-cobertura.js: "Escolha a magia de 1º círculo de …").
    // Resiliente com atributo já proficiente NÃO serve para isto -- o
    // <option> correspondente nasce desabilitado, então aquele ramo de
    // recusa não é alcançável pela tela.
    const { page } = await abrirFicha(context, SEMENTE);

    await escolherTalento(page, 'Tocado Por Fadas');
    await expect(page.locator('#lvlup-magia-escola-lista')).toBeVisible({ timeout: 5000 });
    // Atributo escolhido, magia deixada em branco de propósito.
    await page.selectOption('#levelup-talento-asi', 'sabedoria');
    await page.click('#btn-confirmar-add-talento-asi');
    await assentar(page);

    const salvo = await personagemSalvo(page);
    const nomes = (salvo?.talentos || []).map(t => (typeof t === 'string' ? t : t?.nome));
    expect(nomes, 'o talento incompleto não deveria ter sido gravado')
      .not.toContain('Tocado Por Fadas');

    expect(await estadoModais(page),
      'a tela de configuração sumiu depois de uma escolha recusada')
      .toEqual({ principal: 'flex', subs: 1 });
    await expect(page.locator('#lvlup-magia-escola-lista'),
      'a lista de magias sumiu — o jogador não tem onde corrigir')
      .toBeVisible({ timeout: 5000 });
  });
