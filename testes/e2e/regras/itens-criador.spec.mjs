// ============================================================
// O criador passou a usar o MESMO modal de itens da ficha (2026-08-13).
// Antes eram 4 botoes com um modal por tipo; municao nao existia no
// criador e nao dava para gastar o ouro inicial.
// ============================================================
import { test, expect } from '@playwright/test';
import { assentar, clicarBotaoFicha, abrirSite, satisfazerPasso, personagemEmCriacao } from './helpers-regras.mjs';

/** Leva o wizard ate o passo de equipamento, escolhendo Guardiao */
async function irAtePassoEquipamento(page) {
  await page.click('[data-classe="Guardião"]');
  await page.waitForTimeout(300);
  for (let i = 0; i < 10; i++) {
    if (await page.locator('#btn-add-item').count()) return true;
    if (!await satisfazerPasso(page)) break;
    await assentar(page).catch(() => {});
  }
  return (await page.locator('#btn-add-item').count()) > 0;
}

test('criador: + Item abre o modal unificado, com a categoria Municao', async ({ context }) => {
  const { page } = await abrirSite(context, '#criar');
  expect(await irAtePassoEquipamento(page), 'nao chegou ao passo de equipamento').toBe(true);

  // Os botoes por tipo nao existem mais.
  await expect(page.locator('#btn-add-arma')).toHaveCount(0);
  await expect(page.locator('#btn-add-armadura')).toHaveCount(0);

  await clicarBotaoFicha(page, 'btn-add-item', { esperar: '#lista-inv-cat' });
  await expect(page.locator('[data-cat="municao"]'), 'categoria Municao nao existe no criador')
    .toBeVisible({ timeout: 5000 });

  await page.click('[data-cat="municao"]');
  await assentar(page);
  const primeiraMunicao = page.locator('#lista-inv-cat [data-add-cat]').first();
  await expect(primeiraMunicao, 'a lista de municao nasceu vazia').toBeVisible({ timeout: 5000 });

  // Achado IMPORTANTE #4 da revisao final de branch inteira: ate aqui o
  // teste so afirmava que a lista de Municao nao esta vazia -- nunca
  // clicava nem confirmava. Se uma municao entrasse sem `dados.peso` (o bug
  // irmao do que a correcao das "20 Flechas" do pacote inicial resolveu em
  // adicionarItensEquipamentoInicial, passo-equipamento.js), este teste
  // continuaria verde sem pegar nada. Clicar, confirmar e checar o peso no
  // personagem EM CONSTRUCAO (nao so o DOM) fecha essa lacuna.
  const nomeMunicao = (await primeiraMunicao.locator('.inv-item-nome').textContent())?.trim();
  await primeiraMunicao.click();

  const btnConfirmarMunicao = page.locator('#btn-confirmar-add-item');
  await expect(btnConfirmarMunicao).toBeVisible();
  await btnConfirmarMunicao.click();

  const emConstrucaoMunicao = await personagemEmCriacao(page);
  const municaoGravada = (emConstrucaoMunicao?.inventario || []).find(i => i.nome === nomeMunicao);
  expect(municaoGravada, `${nomeMunicao} deveria ter sido gravada no personagem em construcao`).toBeTruthy();
  expect(municaoGravada?.dados?.peso, `${nomeMunicao} entrou sem peso -- vai contar zero na carga`).toBeTruthy();
});

// Correcao da rodada 1 de revisao da Task 5 (achado IMPORTANTE #3): as duas
// specs acima so tocam DOM (categoria existe, linha visivel). O risco
// ESPECIFICO desta task e o fio de ligacao entre o modal compartilhado e o
// wizard -- ctx.aoAdicionar() precisa re-renderizar #wizard-content e o
// ctx.personagem (o objeto vivo do criador, nao o store da ficha) precisa
// ser mutado de verdade. Se abrirSeletorItens lancasse ao confirmar, ou se
// aoAdicionar fosse trocado por um no-op, os dois testes acima continuariam
// verdes -- so este prova a ligacao ponta a ponta.
test('criador: adicionar um item pelo modal grava no personagem em construcao e a lista do passo re-renderiza', async ({ context }) => {
  const { page } = await abrirSite(context, '#criar');
  expect(await irAtePassoEquipamento(page), 'nao chegou ao passo de equipamento').toBe(true);

  await clicarBotaoFicha(page, 'btn-add-item', { esperar: '#lista-inv-cat' });

  // Adaga: item deterministico da categoria Armas (mesma escolha usada em
  // itens-seletor-ficha.spec.mjs), presente no catalogo para qualquer classe.
  const cardAdaga = page.locator('#lista-inv-cat .inv-item', { hasText: 'Adaga' });
  await cardAdaga.click();

  const btnConfirmar = page.locator('#btn-confirmar-add-item');
  await expect(btnConfirmar).toBeVisible();
  await btnConfirmar.click();

  // ctx.personagem, dentro de itens-seletor.js, e o MESMO objeto vivo que
  // creator/wizard.js exporta -- personagemEmCriacao le exatamente esse
  // modulo (nao o store da ficha, que so existe apos terminar o wizard).
  const emConstrucao = await personagemEmCriacao(page);
  const itemGravado = (emConstrucao?.inventario || []).find(i => i.nome === 'Adaga');
  expect(itemGravado, 'Adaga deveria ter sido gravada no personagem em construcao do wizard').toBeTruthy();

  // ctx.aoAdicionar() (passo-equipamento.js) re-renderiza #wizard-content
  // via renderStepEquipamento -- a lista do passo, por baixo do modal
  // (que continua aberto de proposito), precisa mostrar a Adaga sem reload.
  await expect(page.locator('#lista-inventario'),
    'a lista do passo de equipamento deveria mostrar a Adaga depois de ctx.aoAdicionar() re-renderizar')
    .toContainText('Adaga');
});

// Correcao da rodada 1 de revisao da Task 5 (achado IMPORTANTE #4): o teste
// anterior so olhava a PRIMEIRA abertura do modal -- uma implementacao em
// localStorage sem gravacao previa passaria identica, e uma que resetasse a
// cada abertura tambem. As duas metades do contrato de _comprarAtivoCriador
// (variavel de MODULO: sobrevive entre aberturas do modal na mesma carga de
// pagina, mas nasce desligada a cada carga nova) ficavam sem cobertura.
test('criador: o toggle Comprar nasce desligado a cada carga da pagina, mas sobrevive entre reaberturas do modal', async ({ context }) => {
  const { page } = await abrirSite(context, '#criar');
  expect(await irAtePassoEquipamento(page), 'nao chegou ao passo de equipamento').toBe(true);

  // 1a abertura: nasce desligado.
  await clicarBotaoFicha(page, 'btn-add-item', { esperar: '#lista-inv-cat' });
  await expect(page.locator('#toggle-comprar-item')).not.toBeChecked();

  // Ligar, fechar o modal e reabrir: precisa continuar ligado -- a metade
  // "variavel de modulo, nao reseta a cada abertura" do contrato.
  await page.locator('#toggle-comprar-item').check();
  await page.locator('#modal-header .modal-fechar').click();
  await expect(page.locator('#modal-overlay')).toBeHidden();

  await clicarBotaoFicha(page, 'btn-add-item', { esperar: '#lista-inv-cat' });
  await expect(page.locator('#toggle-comprar-item'),
    'o toggle deveria continuar ligado entre reaberturas do modal, na mesma carga de pagina')
    .toBeChecked();
  await page.locator('#modal-header .modal-fechar').click();

  // Recarregar a pagina: precisa nascer desligado de novo -- a outra
  // metade do contrato ("nao e localStorage", ver comentario de
  // _comprarAtivoCriador em creator/passo-equipamento.js).
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page);
  expect(await irAtePassoEquipamento(page), 'nao chegou ao passo de equipamento depois do reload').toBe(true);

  await clicarBotaoFicha(page, 'btn-add-item', { esperar: '#lista-inv-cat' });
  await expect(page.locator('#toggle-comprar-item'),
    'apos recarregar a pagina o toggle deveria nascer desligado de novo (variavel de modulo, nao localStorage)')
    .not.toBeChecked();
});

// Regressao de 2026-08-13: "Flechas" so existe na chave `municao` do
// equipamento_aventura.json. Como o criador nao a carregava (e depois,
// mesmo carregando, adicionarItensEquipamentoInicial so procurava em
// armas/armaduras/equipAvent), a busca do pacote inicial falhava e o item
// caia no ramo generico com `dados: {}` -- e getPesoTotalInventario
// (utils.js) le `item.dados?.peso`, entao as 20 flechas do pacote do
// Guardiao (e do Ladino) pesavam ZERO na carga.
test('criador: as 20 Flechas do pacote do Guardiao entram COM peso', async ({ context }) => {
  const { page } = await abrirSite(context, '#criar');
  expect(await irAtePassoEquipamento(page), 'nao chegou ao passo de equipamento').toBe(true);

  // Escolher a opcao (A) do pacote de CLASSE, que inclui "20 Flechas".
  // O card e marcado com data-equip-tipo (valores: 'classe' | 'antecedente')
  // e data-equip-letra -- ver passo-equipamento.js.
  await page.click('[data-equip-tipo="classe"][data-equip-letra="A"]');
  await assentar(page);

  const emConstrucao = await personagemEmCriacao(page);
  const flechas = (emConstrucao?.inventario || []).find(i => i.nome === 'Flechas') || null;

  expect(flechas, 'as Flechas do pacote inicial nao entraram no inventario').not.toBeNull();
  expect(flechas.quantidade, 'quantidade errada').toBe(20);
  expect(flechas.dados?.peso, 'Flechas entraram sem peso -- vao contar zero na carga')
    .toBeTruthy();
});

// Achado IMPORTANTE #3 da revisao final de branch inteira: o spec (Camada 3
// de Validacao) exige explicitamente provar "comprar desconta da carteira"
// NO CRIADOR, mas nenhum teste desta suite ligava o toggle #toggle-comprar-
// item e confirmava uma compra -- so a cobertura da FICHA
// (itens-seletor-ficha.spec.mjs) exercitava esse caminho, e la o
// personagem e o `char` do store, um objeto diferente. No criador,
// ctx.personagem.moedas e a carteira do wizard (criarCarteiraVazia() mais o
// ouro somado pelos pacotes de equipamento), pagarCusto (moedas.js) devolve
// um objeto NOVO que precisa ser reatribuido (itens-seletor.js), e o passo
// tem inputs de moeda editaveis re-renderizados por aoAdicionar -- uma
// regressao aqui deixaria o jogador comprar de graca na criacao, ou
// zeraria a carteira, sem nenhum teste vermelho.
test('criador: com "Comprar" ativo, comprar um item desconta o custo da carteira do personagem em construcao', async ({ context }) => {
  const { page } = await abrirSite(context, '#criar');
  expect(await irAtePassoEquipamento(page), 'nao chegou ao passo de equipamento').toBe(true);

  // Semeia um saldo conhecido, direto no objeto vivo do wizard -- o mesmo
  // que ctx.personagem referencia dentro de abrirSeletorItens e que
  // personagemEmCriacao le depois. Sobrescreve o que os pacotes de
  // equipamento ja tenham somado, para o teste nao depender de quanto ouro
  // o pacote do Guardiao concede.
  await page.evaluate(async () => {
    const wizard = await import(new URL('./js/creator/wizard.js', location.href).href);
    wizard.personagem.moedas = { pl: 0, po: 10, pe: 0, pp: 0, pc: 0 };
  });

  await clicarBotaoFicha(page, 'btn-add-item', { esperar: '#lista-inv-cat' });
  await page.locator('#toggle-comprar-item').check();

  // Adaga: item deterministico e barato (custo "2 PO" no catalogo, mesma
  // escolha usada em itens-seletor-ficha.spec.mjs).
  const cardAdaga = page.locator('#lista-inv-cat .inv-item', { hasText: 'Adaga' });
  await cardAdaga.click();

  const btnConfirmar = page.locator('#btn-confirmar-add-item');
  await expect(btnConfirmar, 'com "Comprar" ativo o rotulo do botao deveria mudar').toContainText('Comprar');
  await expect(page.locator('#badge-custo-item'), 'deveria mostrar o custo de 1x Adaga (2 PO) antes de confirmar')
    .toContainText('2 PO');

  await btnConfirmar.click();
  await expect(page.locator('.toast, [class*="toast"]').last()).toContainText('Adaga');

  // 10 PO - 2 PO (custo da Adaga) = 8 PO, tudo em PO (mesma conta de
  // distribuirCobre usada em itens-seletor-ficha.spec.mjs). Le do
  // personagem EM CONSTRUCAO (o objeto vivo do wizard), nao do DOM -- prova
  // que a reatribuicao de ctx.personagem.moedas = pagarCusto(...).moedas
  // realmente aconteceu no objeto que o resto do wizard usa.
  const emConstrucao = await personagemEmCriacao(page);
  expect(emConstrucao?.moedas, 'a compra deveria ter descontado exatamente o custo da Adaga (2 PO) da carteira do wizard').toEqual({
    pl: 0, po: 8, pe: 0, pp: 0, pc: 0,
  });
  const itemGravado = (emConstrucao?.inventario || []).find(i => i.nome === 'Adaga');
  expect(itemGravado?.quantidade, 'a compra tambem deveria ter adicionado a Adaga ao inventario em construcao').toBe(1);
});
