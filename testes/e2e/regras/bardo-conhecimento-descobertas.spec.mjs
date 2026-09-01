// ============================================================
// Descobertas Mágicas (Bardo, Colégio do Conhecimento, nível 6) na TELA.
//
// PHB 2024, Classes.md:770: "Você aprende duas magias à sua escolha. Essas
// magias podem vir da lista de magias de Clérigo, Druida ou Mago, ou uma
// combinação dessas listas. A magia escolhida deve ser um truque ou uma
// magia para a qual você tenha espaços de magia disponíveis, conforme
// mostrado na tabela Características de Bardo. (...) Você sempre tem as
// magias escolhidas preparadas."
//
// A issue #44 relatou a ficha TRAVADA no nível 5: o card "Descobertas
// Mágicas — escolha 2 magias" aparecia com dois <select> contendo só a
// linha vazia "— escolha —". Sem escolha possível, a guarda de
// subirDeNivel recusava a subida para sempre. A causa era a lista de
// opções: a tabela declarava `fonteOpcoes: 'magias-qualquer'` e devolvia
// `[]`, apostando num carregamento assíncrono "de quem monta a tela" que
// nunca foi escrito.
//
// Só o navegador prova o que este spec mede: a lista chega DEPOIS, por
// promessa, dentro de um seletor que já está na tela -- o motor de unidade
// (testes/regras/unidade/escolha-subclasse-viva.test.mjs) confronta o
// resolvedor e a gravação, mas não o encadeamento tela → escolha → ficha.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, personagemSalvo } from './helpers-regras.mjs';

// Bardo nível 5 com a subclasse já escolhida (ela nasce no nível 3): a
// característica desta rodada é a do nível 6, então o cenário do relator é
// exatamente esta subida, 5 → 6.
// `Luz` e `Curar Ferimentos` estão na SEMENTE de propósito: as duas são
// magias de Bardo que também vivem nas listas de Clérigo/Druida/Mago, então
// sem o filtro de "já tem" elas apareceriam entre as Descobertas -- e
// escolhê-las gastaria uma das duas seleções sem conceder nada. Uma está em
// `magias_conhecidas` (truque) e a outra em `magias_preparadas` (1º círculo),
// para cobrir as DUAS listas onde esta característica grava.
const BARDO_CONHECIMENTO_NIVEL_5 = {
  classe: 'Bardo', nivel: 5, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  subclasse: 'Colégio do Conhecimento',
  pericias_proficientes: ['Atuação', 'História', 'Persuasão'],
  magias_conhecidas: [{ nome: 'Zombaria Perversa', circulo: 0 }, { nome: 'Luz', circulo: 0 }],
  magias_preparadas: [{ nome: 'Heroísmo', circulo: 1 }, { nome: 'Curar Ferimentos', circulo: 1 }],
};

// Sondas conferidas contra dados/magias/_indice.json. O Bardo nível 6 tem
// espaços de 1º, 2º e 3º círculo (dados/classes/bardo.json), então:
const MAGIA_DE_MAGO_NO_TETO = 'Bola de Fogo';        // 3º círculo, lista de Mago
const TRUQUE_DE_DRUIDA = 'Arte Druídica';            // truque, lista de Druida
const MAGIA_ACIMA_DO_TETO = 'Banimento';             // 4º círculo de Mago -- sem espaço
const MAGIA_SO_DE_BARDO = 'Sussurros Dissonantes';   // 1º círculo, fora das três listas
const TRUQUE_JA_CONHECIDO = 'Luz';                   // truque das 3 listas, já em magias_conhecidas
const MAGIA_JA_PREPARADA = 'Curar Ferimentos';       // 1º círculo das 3 listas, já preparada

/** Clica em "Próximo" e espera o modal reagir. Devolve false se o botão sumiu. */
async function proximo(page) {
  const botao = page.locator('#btn-step-proximo');
  if (!await botao.count()) return false;
  await botao.click();
  await assentar(page).catch(() => {});
  return true;
}

/**
 * Avança o assistente até os seletores das Descobertas Mágicas aparecerem.
 * Laço com folga pela mesma disciplina de `irAteEscolhaDeTalento`
 * (helpers-regras.mjs): espera fixa e curta é instável sob 4 workers.
 */
async function irAteDescobertasMagicas(page) {
  const seletores = page.locator('[data-subclasse-escolha="subclasse_descobertas_magicas"]');
  for (let i = 0; i < 8 && !(await seletores.count()); i++) {
    if (!await proximo(page)) break;
  }
  return seletores;
}

test('level-up: o Bardo do Colégio do Conhecimento escolhe as 2 Descobertas Mágicas e sobe para o 6', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BARDO_CONHECIMENTO_NIVEL_5,
    'regras-conhecimento-descobertas');
  expect(await abrirModalLevelUp(page)).toBe(true);

  const seletores = await irAteDescobertasMagicas(page);
  await expect(seletores, 'o livro pede 2 magias, então deveriam existir 2 seletores')
    .toHaveCount(2);

  // A lista chega por promessa depois do HTML: espera a opção real, não um
  // timeout fixo. Sem o carregamento assíncrono, o seletor fica para sempre
  // com a única linha vazia -- que é o defeito da issue #44.
  const primeiro = seletores.first();
  await expect(primeiro.locator(`option[value="${MAGIA_DE_MAGO_NO_TETO}"]`),
    `o seletor deveria oferecer ${MAGIA_DE_MAGO_NO_TETO} (3º círculo de Mago)`)
    .toHaveCount(1);
  await expect(primeiro.locator(`option[value="${TRUQUE_DE_DRUIDA}"]`),
    `o livro deixa escolher truque, então ${TRUQUE_DE_DRUIDA} deveria estar na lista`)
    .toHaveCount(1);

  // As duas fronteiras da regra, medidas na TELA e não só no resolvedor: o
  // teto de espaços do nível 6 e as três listas de classe permitidas.
  await expect(primeiro.locator(`option[value="${MAGIA_ACIMA_DO_TETO}"]`),
    `${MAGIA_ACIMA_DO_TETO} é de 4º círculo e o Bardo nível 6 não tem esse espaço`)
    .toHaveCount(0);
  await expect(primeiro.locator(`option[value="${MAGIA_SO_DE_BARDO}"]`),
    `${MAGIA_SO_DE_BARDO} só existe na lista de Bardo, fora das três que o livro permite`)
    .toHaveCount(0);

  // E o que o personagem JÁ TEM não pode ser oferecido: a gravação deduplica
  // por nome, então escolher uma repetida gastaria uma das duas seleções sem
  // conceder nada. As duas listas onde esta característica grava precisam
  // estar cobertas -- o truque veio de `magias_conhecidas`, a magia de
  // `magias_preparadas` (ver a semente).
  await expect(primeiro.locator(`option[value="${TRUQUE_JA_CONHECIDO}"]`),
    `${TRUQUE_JA_CONHECIDO} já está em magias_conhecidas e continuou sendo oferecida`)
    .toHaveCount(0);
  await expect(primeiro.locator(`option[value="${MAGIA_JA_PREPARADA}"]`),
    `${MAGIA_JA_PREPARADA} já está em magias_preparadas e continuou sendo oferecida`)
    .toHaveCount(0);

  // Escolhe as duas. `selectOption` é o gesto do jogador num <select>
  // nativo (um clique cru não seleciona opção em <select> no Chromium):
  // dispara o mesmo evento `change` que o bind de levelup-ui.js escuta.
  await primeiro.selectOption(MAGIA_DE_MAGO_NO_TETO);
  await assentar(page).catch(() => {});
  await seletores.nth(1).selectOption(TRUQUE_DE_DRUIDA);
  await assentar(page).catch(() => {});

  // O nível 6 do Bardo também ganha uma magia nova da própria classe
  // (Magias Preparadas 9 → 10): esse passo é obrigatório e precisa ser
  // satisfeito, senão a recusa da confirmação seria por outro motivo.
  await proximo(page);
  await expect(page.locator('#btn-lvlup-magias')).toBeVisible();
  await page.locator('#btn-lvlup-magias').click();
  await assentar(page).catch(() => {});
  // O grid agrupa por círculo em <details>, e só o grupo de truques nasce
  // aberto -- aqui não há truque nenhum (o filtro é 'magia'), então todos
  // vêm fechados e os cards existem mas ficam invisíveis. Abrir o primeiro
  // grupo é o que o jogador faz.
  await page.locator('#grid-magias details[data-grid-circulo] summary').first().click();
  const candidatas = page.locator('#grid-magias [data-grid-check]');
  await expect(candidatas.first()).toBeVisible();
  const magiaDeBardo = await candidatas.first().evaluate((el) => el.dataset.gridCheck);
  await page.locator(`[data-grid-check="${magiaDeBardo}"]`).click();
  await page.locator('.sub-modal-overlay button', { hasText: 'Confirmar Seleção' }).click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#lvlup-magias-resumo')).toContainText('1/1');

  // Revisão e confirmação.
  for (let i = 0; i < 4; i++) {
    if (await page.locator('#btn-confirmar-levelup').count()) break;
    if (!await proximo(page)) break;
  }
  await expect(page.locator('#btn-confirmar-levelup')).toBeVisible();
  await page.locator('#btn-confirmar-levelup').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-confirmar-levelup'),
    'a subida não concluiu mesmo com as duas Descobertas Mágicas escolhidas')
    .toHaveCount(0);

  const salvo = await personagemSalvo(page);
  expect(salvo.nivel, 'o nível deveria ter subido para 6').toBe(6);

  // "Você sempre tem as magias escolhidas preparadas": a MAGIA entra em
  // magias_preparadas com origem `subclasse_escolha`, a origem que
  // regras-origens-magia.js isenta do limite de preparadas e da troca.
  const preparadas = new Map((salvo.magias_preparadas || []).map((m) => [m.nome, m]));
  expect(preparadas.get(MAGIA_DE_MAGO_NO_TETO),
    `${MAGIA_DE_MAGO_NO_TETO} não chegou a magias_preparadas`)
    .toMatchObject({ circulo: 3, origem: 'subclasse_escolha' });

  // O TRUQUE não: truque mora em `magias_conhecidas`, como todos os outros
  // truques do app. Gravá-lo entre as preparadas o joga no grupo "1º
  // Círculo" da ficha e lhe dá um "Conjurar" que gasta espaço de magia
  // (ver a asserção de tela logo abaixo).
  const conhecidas = new Map((salvo.magias_conhecidas || []).map((m) => [m.nome, m]));
  expect(conhecidas.get(TRUQUE_DE_DRUIDA),
    `${TRUQUE_DE_DRUIDA} é truque e não chegou a magias_conhecidas`)
    .toMatchObject({ circulo: 0, origem: 'subclasse_escolha' });
  expect(preparadas.has(TRUQUE_DE_DRUIDA),
    `${TRUQUE_DE_DRUIDA} é truque e não pode entrar em magias_preparadas`).toBe(false);

  // E na FICHA: o truque tem de aparecer entre os Truques, com o botão
  // "Lançar" (uso livre), e NUNCA com o "Conjurar" que debita um espaço.
  // Recarrega para medir a ficha montada do ZERO a partir do personagem
  // salvo -- é o que o jogador vê ao voltar, e não um resto de render que
  // sobrou do modal de subida.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});
  await expect(page.locator(`[data-lancar-truque="${TRUQUE_DE_DRUIDA}"]`),
    `${TRUQUE_DE_DRUIDA} deveria aparecer na seção de Truques da ficha, com "Lançar"`)
    .toHaveCount(1);
  await expect(page.locator(`[data-conjurar="${TRUQUE_DE_DRUIDA}"]`),
    `a ficha ofereceu "Conjurar" para ${TRUQUE_DE_DRUIDA} -- conjurar um truque não pode ` +
    'gastar espaço de magia')
    .toHaveCount(0);
  await expect(page.locator(`[data-conjurar="${MAGIA_DE_MAGO_NO_TETO}"]`),
    `${MAGIA_DE_MAGO_NO_TETO} é magia de 3º círculo e deveria continuar conjurável`)
    .toHaveCount(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('level-up: sem escolher as 2 Descobertas Mágicas, a subida é recusada', async ({ context }) => {
  // O converso do teste acima -- a guarda que a issue #44 encontrou
  // travada continua travando quem NÃO respondeu. Sem este teste, um
  // conserto que simplesmente removesse a pendência também deixaria o
  // primeiro teste verde.
  const { page } = await abrirFicha(context, BARDO_CONHECIMENTO_NIVEL_5,
    'regras-conhecimento-descobertas-recusa');
  expect(await abrirModalLevelUp(page)).toBe(true);

  const seletores = await irAteDescobertasMagicas(page);
  await expect(seletores).toHaveCount(2);

  // Escolhe SÓ a primeira das duas e tenta concluir.
  await expect(seletores.first().locator(`option[value="${MAGIA_DE_MAGO_NO_TETO}"]`)).toHaveCount(1);
  await seletores.first().selectOption(MAGIA_DE_MAGO_NO_TETO);
  await assentar(page).catch(() => {});

  for (let i = 0; i < 5; i++) {
    if (await page.locator('#btn-confirmar-levelup').count()) break;
    if (!await proximo(page)) break;
  }
  await expect(page.locator('#btn-confirmar-levelup')).toBeVisible();
  await page.locator('#btn-confirmar-levelup').click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#btn-confirmar-levelup'),
    'a subida concluiu com apenas 1 das 2 Descobertas Mágicas escolhidas')
    .toBeVisible();
  const salvo = await personagemSalvo(page);
  expect(salvo.nivel, 'o personagem não deveria ter subido de nível').toBe(5);
});

test('level-up: se as listas de magia não carregarem, a tela DIZ que falhou', async ({ context }) => {
  // A falha de carregamento é silenciosa por baixo: `db.js:fetchJSON` engole
  // o erro e devolve `null`, então `getMagiasClasse` NUNCA rejeita e o
  // `.catch` da promessa não dispara. Sem este aviso, um `magias_*.json`
  // ausente ou quebrado produz exatamente o sintoma da issue #44 -- dois
  // seletores mudos e o jogador preso no nível 5 -- sem nada na tela que
  // explique o porquê.
  //
  // `context.route` (e não `page.route`): a rota precisa existir ANTES de
  // `abrirFicha` criar a página. Só as três listas das Descobertas são
  // abortadas; `magias_bardo.json`, que o passo de magias da classe usa,
  // continua respondendo.
  await context.route(/magias_(clerigo|druida|mago)\.json/, (rota) => rota.abort());

  const { page } = await abrirFicha(context, BARDO_CONHECIMENTO_NIVEL_5,
    'regras-conhecimento-descobertas-falha');
  expect(await abrirModalLevelUp(page)).toBe(true);

  const seletores = await irAteDescobertasMagicas(page);
  await expect(seletores).toHaveCount(2);

  const aviso = page.locator('[data-subclasse-escolha-aviso="subclasse_descobertas_magicas"]');
  await expect(aviso, 'a lista veio vazia e a tela não avisou nada -- seletor mudo é a #44 de volta')
    .toBeVisible();
  await expect(aviso).toContainText(/não foi possível carregar/i);

  // E o seletor não pode mentir dizendo "— escolha —" como se houvesse o
  // que escolher: com a lista vazia, a única opção é a que carrega o aviso.
  await expect(seletores.first().locator('option')).toHaveCount(1);

  // Sem asserção de console limpo AQUI de propósito: `db.js` registra o
  // erro de fetch, e é bom que registre -- este teste existe justamente
  // porque esse registro sozinho não chega ao jogador.
});
