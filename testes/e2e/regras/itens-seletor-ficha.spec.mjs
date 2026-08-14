// ============================================================
// Prova por navegador do modal "Adicionar Item" da FICHA
// (site/js/itens-seletor.js, `abrirSeletorItens`).
//
// Achado da revisão da Task 3 (extração do modal para um módulo
// compartilhado, 2026-08-13): a suíte inteira -- unidade e e2e -- ficava
// verde sem NENHUM teste tocar `#btn-add-inv`, `#lista-inv-cat`,
// `#filtro-inv-cat`, `#toggle-comprar-item` ou `#btn-confirmar-add-item`
// (confirmado por grep em toda a árvore de testes). Os 143 e2e verdes
// provavam só que o grafo de módulos carrega -- nada sobre o modal, a
// compra, ou a chamada local de `carregarDadosEquipSheet` dentro de
// `mostrarDetalheItemSheet`. Uma task de risco alto (move ~300 linhas,
// troca estado global por contexto) ficou "provada segura" sobre evidência
// que nunca a exercitava. As Tasks 4 e 5 vão mexer exatamente neste
// módulo (o criador passa a usá-lo) -- esta spec é a rede que faltava.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, clicarBotaoFicha } from './helpers-regras.mjs';

const SEMENTE_BASE = { classe: 'Guerreiro', nivel: 1 };

test('ficha: modal "Adicionar Item" abre, lista as 5 categorias e a busca filtra', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, SEMENTE_BASE, 'regras-itens-seletor-1');

  // Abrir pelo botão da ficha -- getElementById(...)?.click() puro é
  // no-op silencioso sob carga (ver docstring de clicarBotaoFicha).
  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });

  // As 5 categorias do brief, na ordem certa.
  const filtros = page.locator('.filtro-inv-cat[data-cat]');
  await expect(filtros).toHaveCount(5);
  const categoriasEsperadas = ['armas', 'armaduras', 'consumiveis', 'municao', 'equipamento'];
  const categoriasNoDOM = await filtros.evaluateAll(els => els.map(el => el.dataset.cat));
  expect(categoriasNoDOM, 'categorias do filtro devem bater com as 5 do brief, na mesma ordem').toEqual(categoriasEsperadas);

  // Toggle "Comprar" existe e começa desmarcado (preferência global só
  // fica marcada se salva antes -- contexto novo do teste, sem gravação prévia).
  const toggleComprar = page.locator('#toggle-comprar-item');
  await expect(toggleComprar).toHaveCount(1);
  await expect(toggleComprar).not.toBeChecked();

  // Categoria inicial é "armas", com pelo menos um item renderizado.
  await expect(page.locator('.filtro-inv-cat[data-cat="armas"]')).toHaveClass(/active/);
  const listaCat = page.locator('#lista-inv-cat');
  await expect(listaCat.locator('.inv-item')).not.toHaveCount(0);

  // Busca por texto filtra a lista (categoria "armas" ainda ativa).
  await page.locator('#busca-inv-cat').fill('adaga');
  await expect(listaCat, 'busca por "adaga" deveria mostrar a Adaga (arma simples do catálogo)').toContainText('Adaga');
  await expect(listaCat.locator('.inv-item')).toHaveCount(1);

  await page.locator('#busca-inv-cat').fill('zzz-item-que-nao-existe-no-catalogo');
  await expect(listaCat, 'termo sem correspondência deveria mostrar o aviso de lista vazia').toContainText('Nenhum item encontrado');

  // Limpar a busca antes de trocar de categoria -- o termo digitado
  // permanece aplicado na renderização da categoria seguinte
  // (renderCategoria reaplica o valor atual de #busca-inv-cat), então uma
  // busca "suja" deixaria a lista nova vazia por acidente e mascararia
  // uma troca de categoria quebrada atrás de um resultado vazio legítimo.
  await page.locator('#busca-inv-cat').fill('');

  // Trocar de categoria re-renderiza: sai a Adaga (arma), entra um item
  // de equipamento de aventura, e o botão ativo muda.
  await page.locator('.filtro-inv-cat[data-cat="equipamento"]').click();
  await expect(page.locator('.filtro-inv-cat[data-cat="equipamento"]')).toHaveClass(/active/);
  await expect(page.locator('.filtro-inv-cat[data-cat="armas"]')).not.toHaveClass(/active/);
  await expect(listaCat, 'depois de trocar para "equipamento" a Adaga (categoria "armas") não deveria mais aparecer').not.toContainText('Adaga');
  await expect(listaCat.locator('.inv-item'), 'categoria "equipamento" deveria ter itens do equipamento de aventura').not.toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: filtro de armas só aparece na categoria Armas, filtra por proficiência, e badge de Força insuficiente aparece nas armaduras', async ({ context }) => {
  // Mago nível 4, Força 8: proficiente só em armas Simples (dados-classes.js),
  // sem proficiência de armadura nenhuma, e abaixo do requisito de Força (For
  // 13) da Cota de Malha -- o mesmo cenário do Step 4 do brief da Task 4.
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 4,
    atributos: { forca: 8, destreza: 14, constituicao: 12, inteligencia: 16, sabedoria: 10, carisma: 10 },
  }, 'regras-itens-seletor-4');

  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });

  // Categoria "armas" é a inicial: a linha de filtro (Todas/Proficientes/
  // Simples/Marcial) deveria estar presente com os 4 botões do brief.
  const filtrosArma = page.locator('[data-filtro-arma]');
  await expect(filtrosArma).toHaveCount(4);

  // Clicar "Proficientes" filtra a lista: Mago só tem proficiência em armas
  // Simples, então sobra pelo menos um item com badge-prof-sm e nenhum com
  // badge-no-prof-sm (os listeners são religados a cada render -- é
  // exatamente o que este clique prova).
  const listaCat = page.locator('#lista-inv-cat');
  await page.locator('[data-filtro-arma="proficiente"]').click();
  await expect(listaCat.locator('.badge-prof-sm').first(), 'filtro "Proficientes" deveria deixar pelo menos um item proficiente na lista').toBeVisible();
  await expect(listaCat.locator('.badge-no-prof-sm'), 'filtro "Proficientes" não deveria deixar nenhum item "Sem Prof" na lista').toHaveCount(0);

  // "Simples" e "Marcial" (achado MENOR da rodada 1): a contagem de 4
  // botões só prova presença, não comportamento -- um typo futuro em
  // 'Simples' ou 'Marciai' (sem o "s" final, de propósito, ver
  // regras-equipamento.js:temProficienciaArma) passaria despercebido se só
  // o filtro "Proficientes" fosse exercitado. Captura os nomes visíveis em
  // cada filtro e prova que (a) nenhum dos dois esvazia a lista e (b) os
  // dois conjuntos são disjuntos -- pega tanto o typo (lista vazia) quanto
  // um filtro que não filtra nada (listas idênticas).
  const nomesVisiveis = async () =>
    listaCat.locator('.inv-item-nome').evaluateAll(els => els.map(el => el.textContent.trim()));

  await page.locator('[data-filtro-arma="simples"]').click();
  const nomesSimples = await nomesVisiveis();
  expect(nomesSimples.length, 'filtro "Simples" não deveria esvaziar a lista').toBeGreaterThan(0);

  await page.locator('[data-filtro-arma="marcial"]').click();
  const nomesMarcial = await nomesVisiveis();
  expect(nomesMarcial.length, 'filtro "Marcial" não deveria esvaziar a lista').toBeGreaterThan(0);

  const intersecao = nomesSimples.filter(n => nomesMarcial.includes(n));
  expect(intersecao, 'nenhuma arma deveria aparecer nos dois filtros ao mesmo tempo (Simples e Marcial são categorias exclusivas)').toEqual([]);

  // Trocar para a categoria Armaduras: a linha de filtro de armas é
  // exclusiva de Armas -- não deve nem ser renderizada (não basta escondê-la).
  await page.locator('.filtro-inv-cat[data-cat="armaduras"]').click();
  await expect(page.locator('.filtro-inv-cat[data-cat="armaduras"]')).toHaveClass(/active/);
  await expect(filtrosArma).toHaveCount(0);

  // Ainda em Armaduras, com Força 8 (abaixo do requisito "For 13" da Cota de
  // Malha), o item mostra o aviso -- badge, não bloqueio: continua clicável.
  const cardCotaDeMalha = listaCat.locator('.inv-item', { hasText: 'Cota de Malha' }).filter({ hasNotText: 'Parcial' });
  await expect(cardCotaDeMalha.locator('.badge-warn'), 'Cota de Malha com Força 8 (requisito For 13) deveria mostrar o aviso de Força insuficiente').toContainText('For. insuficiente');

  // Achado IMPORTANTE da rodada 1: a presença do badge sozinha não prova
  // "aviso, não bloqueio" -- uma regressão que acrescentasse um `return`
  // antecipado num handler ao ver `reqOk === false` não seria pega por uma
  // asserção só de DOM. Completa o fluxo de verdade: clica no card,
  // confirma a adição, e confere pelo personagem SALVO (store real, não só
  // o DOM) que a Cota de Malha entrou no inventário mesmo com Força
  // insuficiente.
  await cardCotaDeMalha.click();
  const btnConfirmar = page.locator('#btn-confirmar-add-item');
  await expect(btnConfirmar).toBeVisible();
  await btnConfirmar.click();
  await expect(page.locator('.toast, [class*="toast"]').last(), 'deveria confirmar a adição da Cota de Malha por toast')
    .toContainText('Cota de Malha');

  const salvo = await personagemSalvo(page);
  const itemSalvo = (salvo?.inventario || []).find(i => i.nome === 'Cota de Malha');
  expect(itemSalvo, 'Cota de Malha (Força insuficiente) deveria ter sido adicionada ao inventário salvo -- aviso, não bloqueio').toBeTruthy();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// Correção da rodada 2 de revisão da Task 5: o filtro de armas (teste acima)
// tinha spec própria desde a Task 4, mas o filtro de armaduras -- código
// NOVO, acrescentado na rodada 1 desta mesma task (mostrarSeletorArmadura,
// apagado do criador, tinha essa linha e a unificação original a perdeu) --
// não tinha nenhum clique automatizado. Mesmo padrão que motivou a rodada 1:
// capacidade que "parecia certa" na leitura, só pega numa revisão manual.
test('ficha: filtro de armaduras só aparece na categoria Armaduras, filtra por peso, e o Escudo some dos três filtros de peso sem caso especial', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, SEMENTE_BASE, 'regras-itens-seletor-5');

  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });

  await page.locator('.filtro-inv-cat[data-cat="armaduras"]').click();
  await expect(page.locator('.filtro-inv-cat[data-cat="armaduras"]')).toHaveClass(/active/);

  // Cinco botões (Todas/Proficientes/Leve/Média/Pesada) -- espelha o filtro
  // de armas, mas com atributo PRÓPRIO (`data-filtro-armadura`, não
  // `data-filtro-arma`): o teste acima já prova que `[data-filtro-arma]`
  // conta 0 na categoria Armaduras, e um atributo compartilhado quebraria
  // essa garantia.
  const filtrosArmadura = page.locator('[data-filtro-armadura]');
  await expect(filtrosArmadura).toHaveCount(5);

  const listaCat = page.locator('#lista-inv-cat');
  const nomesVisiveis = async () =>
    listaCat.locator('.inv-item-nome').evaluateAll(els => els.map(el => el.textContent.trim()));
  // O rótulo de categoria de cada card ("Leve"/"Média"/"Pesada"/"Escudo")
  // vem do badge `.badge-secondary` (badgeCat, ver itens-seletor.js) -- é
  // o sinal mais direto de que o filtro filtrou pela categoria certa, não
  // só de que a lista não ficou vazia.
  const categoriasVisiveis = async () =>
    listaCat.locator('.inv-item .badge-secondary').evaluateAll(els => els.map(el => el.textContent.trim()));

  // "Todas" (estado inicial ao trocar para a categoria): o Escudo está
  // presente -- é a base de comparação para o caso sutil mais abaixo.
  const nomesTodas = await nomesVisiveis();
  expect(nomesTodas.some(n => n.includes('Escudo')), 'Escudo deveria aparecer no filtro "Todas"').toBe(true);

  // "Pesada": lista não vazia e toda categoria visível é, de fato, "Pesada".
  await page.locator('[data-filtro-armadura="pesada"]').click();
  const nomesPesada = await nomesVisiveis();
  const catsPesada = await categoriasVisiveis();
  expect(catsPesada.length, 'filtro "Pesada" não deveria esvaziar a lista').toBeGreaterThan(0);
  expect(catsPesada.every(c => c === 'Pesada'), 'todo item visível no filtro "Pesada" deveria ter categoria Pesada').toBe(true);

  // "Leve": idem, e o conjunto de nomes é disjunto do de "Pesada" (mesmo
  // padrão do teste de Simples/Marcial, acima).
  await page.locator('[data-filtro-armadura="leve"]').click();
  const nomesLeve = await nomesVisiveis();
  const catsLeve = await categoriasVisiveis();
  expect(catsLeve.length, 'filtro "Leve" não deveria esvaziar a lista').toBeGreaterThan(0);
  expect(catsLeve.every(c => c === 'Leve'), 'todo item visível no filtro "Leve" deveria ter categoria Leve').toBe(true);
  const intersecao = nomesPesada.filter(n => nomesLeve.includes(n));
  expect(intersecao, 'nenhuma armadura deveria aparecer nos filtros "Leve" e "Pesada" ao mesmo tempo (categorias exclusivas)').toEqual([]);

  // "Média": mesma checagem -- prova que semAcento("Média") bate com o
  // filtro "media" (sem acento no id do botão) apesar do acento no rótulo
  // e no categoria do JSON.
  await page.locator('[data-filtro-armadura="media"]').click();
  const nomesMedia = await nomesVisiveis();
  const catsMedia = await categoriasVisiveis();
  expect(catsMedia.length, 'filtro "Média" não deveria esvaziar a lista').toBeGreaterThan(0);
  expect(catsMedia.every(c => c === 'Média'), 'todo item visível no filtro "Média" deveria ter categoria Média').toBe(true);

  // O CASO SUTIL, que é o que mais importa: o Escudo (categoria "Escudo" no
  // JSON) não bate com nenhum dos três pesos -- ele precisa sumir sozinho,
  // sem `if` especial no código (ver itens-seletor.js). Um refactor futuro
  // que normalizasse a categoria (ex.: juntar "Média"/"Pesada", ou tratar
  // Escudo como "Leve") quebraria isso em silêncio sem este teste.
  expect(nomesPesada.some(n => n.includes('Escudo')), 'Escudo não deveria aparecer no filtro "Pesada"').toBe(false);
  expect(nomesLeve.some(n => n.includes('Escudo')), 'Escudo não deveria aparecer no filtro "Leve"').toBe(false);
  expect(nomesMedia.some(n => n.includes('Escudo')), 'Escudo não deveria aparecer no filtro "Média"').toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: adicionar item com quantidade 2 grava no personagem salvo, sem overlay órfão', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, SEMENTE_BASE, 'regras-itens-seletor-2');

  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });

  // Adaga: item único e determinístico no catálogo de armas (custo "2 PO").
  const cardAdaga = page.locator('#lista-inv-cat .inv-item', { hasText: 'Adaga' });
  await cardAdaga.click();

  // Abre o sub-modal de detalhe/confirmação (abrirModal empilha por cima
  // do modal principal, que já está aberto -- ver utils.js:abrirModal).
  const btnConfirmar = page.locator('#btn-confirmar-add-item');
  await expect(btnConfirmar).toBeVisible();

  // Sobe a quantidade de 1 para 2 pelo stepper.
  await expect(page.locator('#valor-qtd-item')).toHaveText('1');
  await page.locator('#btn-qtd-item-mais').click();
  await expect(page.locator('#valor-qtd-item')).toHaveText('2');

  await btnConfirmar.click();

  // window.fecharModal() (ANTES de ctx.aoAdicionar(), nesta ordem) fecha
  // só o sub-modal de detalhe -- o modal principal "Adicionar Item"
  // continua aberto de propósito, para dar para adicionar mais de um item
  // na mesma sessão. O toast confirma que ctx.aoAdicionar() (salvar +
  // renderFichaCompleta) já rodou, de forma síncrona, antes dele aparecer.
  await expect(page.locator('.toast, [class*="toast"]').last(), 'deveria confirmar a adição por toast')
    .toContainText('Adaga');
  await expect(page.locator('.sub-modal-overlay'), 'o sub-modal de detalhe do item deveria ter fechado, sem sobrar órfão')
    .toHaveCount(0);

  // Prova que ctx.aoAdicionar() persistiu de verdade: o personagem SALVO
  // (não só o DOM) tem a Adaga com quantidade 2.
  const salvo = await personagemSalvo(page);
  const itemSalvo = (salvo?.inventario || []).find(i => i.nome === 'Adaga');
  expect(itemSalvo, 'Adaga deveria estar no inventário salvo').toBeTruthy();
  expect(itemSalvo?.quantidade, 'quantidade escolhida no stepper (2) deveria ter sido gravada').toBe(2);

  // Fecha o modal principal explicitamente (botão "x" do cabeçalho) e
  // confirma que não fica overlay nenhum para trás.
  await page.locator('#modal-header .modal-fechar').click();
  await expect(page.locator('#modal-overlay'), 'modal principal não deveria continuar visível depois de fechado').toBeHidden();
  await expect(page.locator('.sub-modal-overlay')).toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: com "Comprar" ativo, adicionar um item desconta o custo da carteira salva', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...SEMENTE_BASE,
    moedas: { pl: 0, po: 10, pe: 0, pp: 0, pc: 0 },
  }, 'regras-itens-seletor-3');

  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });

  await page.locator('#toggle-comprar-item').check();

  const cardAdaga = page.locator('#lista-inv-cat .inv-item', { hasText: 'Adaga' });
  await cardAdaga.click();

  const btnConfirmar = page.locator('#btn-confirmar-add-item');
  // Com "Comprar" ativo o rótulo do botão muda (ver itens-seletor.js) --
  // confirma que o app entendeu que esta é uma compra, não uma adição livre.
  await expect(btnConfirmar).toContainText('Comprar');
  await expect(page.locator('#badge-custo-item'), 'deveria mostrar o custo de 1x Adaga (2 PO) antes de confirmar')
    .toContainText('2 PO');

  await btnConfirmar.click();
  await expect(page.locator('.toast, [class*="toast"]').last()).toContainText('Adaga');

  // 10 PO - 2 PO (custo da Adaga) = 8 PO. distribuirCobre (moedas.js)
  // redistribui pelo menor número de moedas -- com só PO na carteira e um
  // custo que também é só PO, o resultado fica inteiro em PO, sem sobra
  // nas outras denominações.
  const salvo = await personagemSalvo(page);
  expect(salvo?.moedas, 'carteira deveria ter descontado exatamente o custo da Adaga (2 PO)').toEqual({
    pl: 0, po: 8, pe: 0, pp: 0, pc: 0,
  });
  const itemSalvo = (salvo?.inventario || []).find(i => i.nome === 'Adaga');
  expect(itemSalvo?.quantidade, 'a compra também deveria ter adicionado o item ao inventário').toBe(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// BLOQUEANTE 1 da revisão final de branch inteira: os botões das duas linhas
// de filtro (armas e armaduras) nasciam com a classe `filtro-arma-item`, que
// NENHUMA regra de app.css estiliza (o CSS espera `filtro-arma` e
// `filtro-armadura`, ver app.css:846 -- espelha a nomenclatura antiga de
// scripts/baseline/creator.js). O filtro funcionava (a lista filtrava de
// verdade), a classe `active` era aplicada certinho, mas visualmente nada
// mudava -- o botão clicado ficava idêntico aos outros três, enquanto a
// linha de categorias (`filtro-inv-cat`, logo acima) SE destacava na mesma
// tela. `toHaveClass(/active/)` não pegaria isso: a classe está lá mesmo com
// o bug, só não casa com nenhum seletor de CSS. É preciso comparar o ESTILO
// COMPUTADO do botão ativo com o de um inativo.
test('ficha: o botão de filtro ativo (armas e armaduras) tem estilo computado diferente de um inativo, não só a classe "active"', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, SEMENTE_BASE, 'regras-itens-seletor-6');

  await clicarBotaoFicha(page, 'btn-add-inv', { esperar: '#lista-inv-cat' });

  // Lê `background-color` computado de dois botões da mesma linha de
  // filtro -- um ativo, um inativo -- num único page.evaluate (evita duas
  // idas ao navegador e garante que os dois são lidos no mesmo frame).
  const compararFundo = async (seletorAtivo, seletorInativo) => page.evaluate(
    ([a, i]) => {
      const elAtivo = document.querySelector(a);
      const elInativo = document.querySelector(i);
      return {
        ativo: elAtivo ? getComputedStyle(elAtivo).backgroundColor : null,
        inativo: elInativo ? getComputedStyle(elInativo).backgroundColor : null,
      };
    },
    [seletorAtivo, seletorInativo],
  );

  // Categoria Armas é a inicial, com filtroArma = 'todas' (renderCategoria) --
  // dá para comparar sem nem precisar clicar.
  await expect(page.locator('[data-filtro-arma="todas"]')).toHaveClass(/active/);
  const armas = await compararFundo('[data-filtro-arma="todas"]', '[data-filtro-arma="marcial"]');
  expect(armas.ativo, 'filtro de ARMAS: o botão "Todas" (ativo) deveria existir no DOM').not.toBeNull();
  expect(armas.inativo, 'filtro de ARMAS: o botão "Marcial" (inativo) deveria existir no DOM').not.toBeNull();
  expect(armas.ativo, 'filtro de ARMAS: o botão ativo ("Todas") deveria ter cor de fundo diferente do inativo ("Marcial") -- se os dois usarem a mesma classe sem regra de CSS (filtro-arma-item), as cores ficam iguais mesmo com "active" presente no DOM')
    .not.toBe(armas.inativo);

  // Trocar para Armaduras e repetir: a linha 238 do código (armaduras) tinha
  // o MESMO bug, de forma independente da linha 232 (armas) -- o teste
  // acima sozinho não pegaria uma regressão isolada nos botões de armadura.
  await page.locator('.filtro-inv-cat[data-cat="armaduras"]').click();
  await expect(page.locator('[data-filtro-armadura="todas"]')).toBeVisible();
  await expect(page.locator('[data-filtro-armadura="todas"]')).toHaveClass(/active/);

  const armaduras = await compararFundo('[data-filtro-armadura="todas"]', '[data-filtro-armadura="pesada"]');
  expect(armaduras.ativo, 'filtro de ARMADURAS: o botão "Todas" (ativo) deveria existir no DOM').not.toBeNull();
  expect(armaduras.inativo, 'filtro de ARMADURAS: o botão "Pesada" (inativo) deveria existir no DOM').not.toBeNull();
  expect(armaduras.ativo, 'filtro de ARMADURAS: o botão ativo ("Todas") deveria ter cor de fundo diferente do inativo ("Pesada") -- mesmo bug possível na linha de armaduras, independente da de armas')
    .not.toBe(armaduras.inativo);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
