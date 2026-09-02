// ============================================================
// Magia PERSONALIZADA: o que o jogador digita no formulário tem de
// sobreviver ao "Salvar", e o que ele marcou tem de aparecer na ficha.
//
// Dois defeitos relatados pelo jogador (2026-08-19), cada um com o seu
// teste aqui:
//
//   1. GATILHO DA REAÇÃO SOME. O formulário mostra o campo "Gatilho da
//      reação" quando o tempo de conjuração é Reação, e o caminho de
//      EDIÇÃO sabe ler `"Reação, <gatilho>"` de volta para o campo
//      (grimorio.js:512-513) -- mas o caminho de SALVAR nunca lia o
//      campo. O gatilho digitado morria no DOM.
//
//   2. SELO DE RITUAL SOME. O Mago que criava uma magia personalizada de
//      círculo > 0 ganhava a magia no `char.grimorio` (grimorio.js), e a
//      linha do Grimório derivava o marcador Ritual de
//      `ehMagiaRitual(nome)`, que só consulta o ACERVO -- magia
//      personalizada não está lá, e o campo `ritual: true` que o
//      jogador marcou era ignorado nessa seção.
//
// ONDE A ISSUE #46 ENTRA. A magia customizada de círculo 1+ passou a ser
// SEMPRE preparada e derivada de `char.magias_customizadas`, e saiu do
// grimório do Mago: a busca de cópia não a oferece mais e
// `migrarCopiasCustomizadasDoGrimorio` (sheet/migracoes.js) remove a cópia
// paga que fichas antigas têm. Os cenários que mediam a customizada DENTRO
// da seção Grimório passaram a medir a mesma capacidade (selo de Ritual,
// descrição que abre, renomear que funciona) no endereço novo -- a linha da
// seção Preparadas --, e cada um afirma junto que ela NÃO está mais no
// grimório e que a magia do acervo que está lá continua intacta.
//
// Os testes CLICAM na tela (memória do projeto: botão novo só está
// entregue com spec que clica nele) e leem o personagem SALVO, não o
// DOM do formulário -- é a gravação que o jogador acusou de perder o
// dado, e só a leitura do store mede isso.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const MAGO = {
  classe: 'Mago', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
};

const GATILHO = 'quando uma criatura que você vê o ataca';

/** Abre todos os `<details>` da ficha -- o Playwright não clica no que está escondido. */
async function abrirTudo(page) {
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});
}

/**
 * Lê quantos espaços de 1º círculo já foram usados, do personagem salvo.
 * A forma armazenada virou por FONTE (Tarefa 4, sub-projeto 4): `usados`
 * mora em `espacos_magia.conjuracao[circulo]` (ou `.pacto`), não mais em
 * `espacos_magia[circulo].usados`. Mago não tem Magia de Pacto -- a fonte
 * é sempre 'conjuracao' aqui.
 *
 * O "balde" da fonte (`espacos_magia.conjuracao`) precisa EXISTIR para a
 * leitura contar como bem-sucedida. Dentro dele, a CHAVE DO CÍRCULO
 * ausente já é o jeito canônico deste sistema de representar "nada gasto
 * ainda" (mesma degradação que `usadosDe`, sheet/reservas-espacos.js, faz
 * na leitura de produção -- só grava a chave quando `usados > 0`), então
 * essa ausência vira `0`, não `null`.
 */
async function espacosConjuracaoCirculo1(page) {
  const conjuracao = (await personagemSalvo(page))?.espacos_magia?.conjuracao;
  return conjuracao ? (conjuracao['1'] ?? 0) : null;
}

/**
 * Preenche o formulário de Magia Personalizada com os campos obrigatórios,
 * deixando escola e duração no modo "Personalizado…" para não depender de
 * qual valor o acervo oferece no dropdown.
 */
async function preencherFormulario(page, { nome, tempo, ritual = false }) {
  await page.fill('#mc-nome', nome);
  await page.selectOption('#mc-circulo', '1');
  await page.selectOption('#mc-escola', '__personalizado__');
  await page.fill('#mc-escola-personalizada', 'Abjuração');
  await page.selectOption('#mc-tempo', tempo);
  await page.fill('#mc-alcance', 'Pessoal');
  await page.check('#mc-comp-v');
  await page.selectOption('#mc-duracao', '__personalizado__');
  await page.fill('#mc-duracao-texto', 'Instantânea');
  if (ritual) await page.check('#mc-ritual');
}

test('magia personalizada de Reação: o gatilho digitado sobrevive ao salvar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO, 'regras-magia-custom-gatilho');
  await assentar(page).catch(() => {});

  await page.click('#btn-add-magia-custom');
  await page.waitForSelector('#mc-nome', { state: 'visible', timeout: 20_000 });

  await preencherFormulario(page, { nome: 'Escudo de Nimb', tempo: 'Reação' });

  // GUARDA CONTRA VACUIDADE: o campo de gatilho só existe/aparece quando o
  // tempo é Reação. Se ele estivesse escondido, "o gatilho sumiu" seria uma
  // afirmação sobre um campo que o jogador nunca teve como preencher.
  await expect(page.locator('#mc-gatilho-reacao'),
    'com tempo de conjuração "Reação" o formulário precisa oferecer o campo de gatilho')
    .toBeVisible();
  await page.fill('#mc-gatilho-reacao', GATILHO);

  await page.click('#btn-salvar-mc');
  await expect(page.locator('#toast-container'),
    'a magia precisa ter sido gravada antes de medir o que foi gravado')
    .toContainText('adicionada');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const magia = (salvo?.magias_customizadas || []).find(m => m?.nome === 'Escudo de Nimb');
  expect(magia, 'a magia personalizada precisa estar no personagem salvo').toBeTruthy();
  expect(magia.tempo_conjuracao,
    'o gatilho digitado no campo "Gatilho da reação" tem de ser gravado junto do tempo de '
    + 'conjuração -- é o formato "Reação, <gatilho>" que o próprio formulário sabe reler ao editar')
    .toContain(GATILHO);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('magia personalizada de Reação: ao reabrir para editar, o gatilho volta no campo', async ({ context }) => {
  // O contraste do teste acima: gravar no formato certo não basta se o
  // formulário não reler. Sem este par, um formato de gravação qualquer
  // passaria no primeiro teste e o jogador continuaria vendo o campo vazio.
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Escudo de Nimb', circulo: 1, escola: 'Abjuração',
      tempo_conjuracao: `Reação, ${GATILHO}`, alcance: 'Pessoal',
      componentes: 'V', duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
  }, 'regras-magia-custom-gatilho-edicao');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-editar-magia-custom]', { esperar: '#mc-gatilho-reacao' });

  await expect(page.locator('#mc-gatilho-reacao'),
    'ao editar uma magia de Reação já gravada, o gatilho tem de voltar preenchido no campo')
    .toHaveValue(GATILHO);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Issue #46: a magia customizada SAIU do grimório do Mago.
//
// Este cenário e os quatro seguintes mediam a customizada DENTRO da seção
// Grimório, que era onde ela morava para o Mago -- primeiro pelo contorno
// que a empurrava para lá ao criá-la, depois (issue #42) pela cópia paga de
// 50 PO/círculo. A #46 tornou a customizada SEMPRE preparada e derivada de
// `char.magias_customizadas`: a cópia deixou de comprar qualquer coisa e só
// desenharia a mesma magia numa segunda linha, com Preparar/Despreparar
// sem efeito. Por isso ela saiu da busca de cópia (grimorio-mago.spec.mjs)
// e a cópia existente é removida por `migrarCopiasCustomizadasDoGrimorio`
// (sheet/migracoes.js) na abertura da ficha.
//
// A CAPACIDADE MEDIDA CONTINUA A MESMA -- o selo Ritual do jogador tem de
// aparecer, e o botão Ritual tem de conjurar sem gastar espaço --, só que
// na linha da seção Preparadas, que é onde a magia passou a viver. O que
// muda é o ENDEREÇO.
//
// "Mísseis Mágicos" no grimório é o GUARDA CONTRA VACUIDADE de todos eles:
// sem outra magia lá, a seção Grimório sumiria depois da limpeza e "a
// customizada não está no grimório" não distinguiria a regra nova de uma
// seção que deixou de ser desenhada.
// ============================================================
test('issue #46: a customizada Ritual sai do grimório e mantém selo e botão Ritual na ficha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Selo de Nimb', circulo: 1, escola: 'Abjuração',
      tempo_conjuracao: 'Ação', alcance: 'Pessoal', componentes: 'V',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: true,
    }],
    grimorio: [{ nome: 'Selo de Nimb', circulo: 1 }, { nome: 'Mísseis Mágicos', circulo: 1 }],
  }, 'regras-magia-custom-ritual');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // GUARDA CONTRA VACUIDADE: a seção Grimório continua existindo, com a
  // magia do LIVRO -- a limpeza não pode ter levado o grimório inteiro.
  await expect(page.locator('[data-details-id="grimorio-mago"] .magia-item', { hasText: 'Mísseis Mágicos' }),
    'a magia do acervo comprada para o grimório continua lá')
    .toHaveCount(1);
  await expect(page.locator('[data-details-id="grimorio-mago"] .magia-item', { hasText: 'Selo de Nimb' }),
    'a customizada não é mais magia de grimório: copiá-la não compra nada, e a linha só '
    + 'duplicaria a magia que a seção Preparadas já desenha')
    .toHaveCount(0);
  expect((await personagemSalvo(page)).grimorio.map((m) => m.nome),
    'e a cópia sai do dado também, não só da tela')
    .toEqual(['Mísseis Mágicos']);

  // A CAPACIDADE, no endereço novo: a linha da seção Preparadas.
  const linha = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: 'Selo de Nimb' });
  await expect(linha,
    'sem preparo nenhum, a customizada é desenhada no círculo dela -- sem a linha, nada a medir')
    .toHaveCount(1);
  await expect(linha,
    'o jogador marcou "Pode ser conjurada como Ritual" no formulário; o selo Ritual tem de '
    + 'aparecer como aparece para magia do acervo')
    .toContainText('Ritual');

  // O selo vem acompanhado do botão -- e botão só está entregue quando um
  // spec CLICA nele. O clique também prova que a linha está ligada ao
  // handler certo: o do acervo se guarda com `ehMagiaRitual`, que não
  // conhece magia personalizada, e não faria nada.
  const antes = await espacosConjuracaoCirculo1(page);
  expect(antes, 'o spec precisa ler os espaços de 1º círculo antes de medir o efeito do clique')
    .not.toBeNull();

  await clicarSeletorFicha(page,
    '[data-details-id="magias-circulo-1"] [data-conjurar-ritual-custom]',
    { esperar: '#toast-container' });
  await expect(page.locator('#toast-container'),
    'a conjuração ritual precisa ter acontecido antes de medir os espaços')
    .toContainText('conjurada como Ritual');
  await assentar(page).catch(() => {});

  expect(await espacosConjuracaoCirculo1(page),
    'a versão Ritual NÃO utiliza um espaço de magia (Magias.md:62)')
    .toBe(antes);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('editar magia personalizada de Ritual: a marca de Ritual sobrevive à edição', async ({ context }) => {
  // Terceira causa do mesmo relato ("o ritual some"): o formulário deriva a
  // caixa "Pode ser conjurada como Ritual" do TEXTO do tempo de conjuração,
  // e essa derivação roda DEPOIS de preencher o formulário com a magia
  // existente. Numa magia gravada com `ritual: true` e tempo "Ação" (o
  // jogador marcou a caixa à mão), abrir para editar desmarcava a caixa
  // sozinho -- e salvar qualquer outra alteração apagava o Ritual.
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Selo de Nimb', circulo: 1, escola: 'Abjuração',
      tempo_conjuracao: 'Ação', alcance: 'Pessoal', componentes: 'V',
      duracao: 'Instantânea', descricao: 'Original', dano: '', ritual: true,
    }],
    grimorio: [{ nome: 'Selo de Nimb', circulo: 1 }],
  }, 'regras-magia-custom-ritual-edicao');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-editar-magia-custom]', { esperar: '#mc-ritual' });

  await expect(page.locator('#mc-ritual'),
    'a magia foi gravada como Ritual; ao abrir para editar, a caixa tem de vir marcada')
    .toBeChecked();

  // E o clique no Salvar é o que mede o prejuízo real: sem ele, "a caixa
  // veio desmarcada" seria só cosmético.
  await page.fill('#mc-desc', 'Editada');
  await page.click('#btn-salvar-mc');
  await expect(page.locator('#toast-container'),
    'a edição precisa ter sido gravada antes de medir o que sobrou dela')
    .toContainText('atualizada');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo?.magias_customizadas?.[0]?.ritual,
    'editar a descrição não pode apagar o marcador Ritual da magia')
    .toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('a customizada SEM Ritual não ganha o selo na ficha -- o contraste', async ({ context }) => {
  // Sem este contraste, "aparece Ritual" passaria numa tela que carimba
  // Ritual em toda linha personalizada.
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Selo Mundano', circulo: 1, escola: 'Abjuração',
      tempo_conjuracao: 'Ação', alcance: 'Pessoal', componentes: 'V',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
    grimorio: [{ nome: 'Selo Mundano', circulo: 1 }, { nome: 'Mísseis Mágicos', circulo: 1 }],
  }, 'regras-magia-custom-sem-ritual');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  const linha = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: 'Selo Mundano' });
  await expect(linha, 'a linha precisa existir para o contraste medir alguma coisa').toHaveCount(1);
  await expect(linha,
    'magia personalizada sem o marcador Ritual não pode ganhar o selo')
    .not.toContainText('Ritual');
  await expect(linha.locator('[data-conjurar-ritual-custom]'),
    'nem o botão de conjurar como Ritual')
    .toHaveCount(0);
  await expect(linha.locator('[data-conjurar-magia-custom]'),
    'mas o Conjurar normal continua lá -- o contraste é sobre o Ritual, não sobre a magia sumir')
    .toHaveCount(1);

  // GUARDA CONTRA VACUIDADE do lado do grimório (issue #46): a seção
  // continua desenhada, sem a customizada.
  await expect(page.locator('[data-details-id="grimorio-mago"] .magia-item', { hasText: 'Mísseis Mágicos' }),
    'a magia do acervo continua no grimório')
    .toHaveCount(1);
  await expect(page.locator('[data-details-id="grimorio-mago"] .magia-item', { hasText: 'Selo Mundano' }),
    'e a customizada não está mais lá')
    .toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('clicar na magia personalizada abre a descrição dela, no endereço novo (issue #39)', async ({ context }) => {
  // Causa raiz da issue #39: o Grimório renderizava a magia personalizada
  // com `data-magia-nome` -- o mesmo atributo de uma magia do acervo --,
  // então o clique caía no handler genérico (site/js/sheet/magias.js), que
  // busca a descrição em `getMagiasPorCirculo(circ)`. A magia personalizada
  // não está lá: `magia` fica `undefined`, o handler ainda marca a linha
  // como "expandida" (nada parece quebrado à primeira vista), mas
  // `.magia-desc` fica vazio e sem altura -- na prática, nada abre.
  //
  // Issue #46: a customizada saiu do Grimório, então a linha que existia
  // para errar não existe mais. A capacidade medida é a mesma -- ler a
  // descrição da magia que o jogador inventou --, agora na linha da seção
  // Preparadas, que sempre usou o handler certo (`data-magia-custom-index`,
  // que lê `char.magias_customizadas`). O par de asserções abaixo é o
  // oráculo da #39 no endereço novo: o atributo CERTO e a descrição ABERTA.
  const DESCRICAO = 'Névoa arcana revela armadilhas ocultas num raio de 3 metros.';
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Névoa de Nimb', circulo: 1, escola: 'Adivinhação',
      tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V, S',
      duracao: '1 minuto', descricao: DESCRICAO, dano: '', ritual: false,
    }],
    grimorio: [{ nome: 'Névoa de Nimb', circulo: 1 }, { nome: 'Mísseis Mágicos', circulo: 1 }],
  }, 'regras-magia-custom-grimorio-desc');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // GUARDA CONTRA VACUIDADE, dos dois lados: a seção Grimório continua
  // desenhada (com a magia do livro) e a customizada não está nela.
  await expect(page.locator('[data-details-id="grimorio-mago"] .magia-item', { hasText: 'Mísseis Mágicos' }),
    'a magia do acervo continua no grimório -- sem ela, "a customizada saiu" passaria por uma '
    + 'seção que deixou de existir')
    .toHaveCount(1);
  await expect(page.locator('[data-details-id="grimorio-mago"] .magia-item', { hasText: 'Névoa de Nimb' }),
    'a customizada não é magia de grimório desde a issue #46')
    .toHaveCount(0);

  const linha = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: 'Névoa de Nimb' });
  await expect(linha,
    'ela é sempre preparada: a linha vive na seção do 1º círculo -- sem a linha, nada a medir')
    .toHaveCount(1);
  await expect(linha,
    'e sai com `data-magia-custom-index` -- é esse atributo que leva o clique ao handler que '
    + 'lê char.magias_customizadas, em vez do handler do acervo que não conhece a magia (#39)')
    .toHaveAttribute('data-magia-custom-index', '0');

  const descricao = linha.locator('.magia-desc');
  await expect(descricao, 'a descrição não pode estar visível antes do clique').toBeHidden();

  // Clica no nome, fora da área dos botões -- o handler de expandir ignora
  // clique que caia em cima de um <button>/<select>.
  await linha.locator('.magia-nome').click();

  await expect(descricao,
    'clicar na magia personalizada tem de abrir a descrição, igual já acontece com uma magia '
    + 'do acervo')
    .toBeVisible();
  await expect(descricao,
    'a descrição exibida tem de ser a da magia personalizada (lida de '
    + 'char.magias_customizadas), não ficar vazia')
    .toContainText(DESCRICAO);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Issue #42 -- o mesmo contorno que empurrava a magia recém-CRIADA para
// char.grimorio (testado em testes/e2e/regras/grimorio-mago.spec.mjs)
// disparava também ao EDITAR: renomear (ou trocar o círculo de) uma magia
// personalizada que nunca foi copiada legitimamente ainda assim a fazia
// aparecer no grimório, pulando o custo de cópia da mesma forma. Este
// teste cobre essa segunda porta do mesmo defeito -- ela vive no MESMO
// bloco (`if (identidadeMudou && ...)`, grimorio.js) que a criação, mas é
// um caminho de código diferente (`magiaExistente` true, `indiceEdicao`
// não-nulo), então precisa do próprio clique para não ficar sem cobertura.
// ============================================================
test('grimório do Mago: renomear magia personalizada que NUNCA foi copiada não a registra no grimório de graça (issue #42)', async ({ context }) => {
  const NOME_ANTIGO = 'Facho de Nimb';
  const NOME_NOVO = 'Facho de Nimb Aprimorado';
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: NOME_ANTIGO, circulo: 1, escola: 'Evocação',
      tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V, S',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
    // Grimório vazio de propósito: esta magia nunca foi copiada. A
    // asserção abaixo é o que fica VERMELHO sem a correção da issue #42.
  }, 'regras-magia-custom-grimorio-renomear-sem-copia');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-editar-magia-custom]', { esperar: '#mc-nome' });
  await page.fill('#mc-nome', NOME_NOVO);
  await page.click('#btn-salvar-mc');
  await expect(page.locator('#toast-container'),
    'a edição precisa ter sido gravada antes de medir o que sobrou dela')
    .toContainText('atualizada');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect((salvo?.magias_customizadas || []).some((m) => m.nome === NOME_NOVO),
    'o novo nome precisa ter sido gravado em magias_customizadas -- sem isso a asserção do '
    + 'grimório não mede a edição de verdade')
    .toBe(true);
  expect((salvo?.grimorio || []).some((m) => m?.nome === NOME_NOVO || m?.nome === NOME_ANTIGO),
    'renomear uma magia personalizada que nunca foi copiada não pode fazê-la aparecer no '
    + 'grimório -- copiar continua sendo uma ação à parte, que custa 50 PO / 2h por círculo')
    .toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// O contraste do teste acima. Ele media a coerência do grimório ao renomear
// uma customizada JÁ copiada -- estado que a issue #42 criou e que a #46
// desfez: `migrarCopiasCustomizadasDoGrimorio` remove essa cópia na
// abertura da ficha, porque ela não compra mais nada.
//
// A CAPACIDADE PRESERVADA é RENOMEAR: o jogador continua tendo de poder
// mudar o nome da magia que inventou, e a linha renomeada continua tendo de
// aparecer -- só que na seção Preparadas, não no grimório. E o grimório
// continua não podendo ficar com órfã nem ganhar entrada de graça: as duas
// afirmações da #42 valem igual, agora sobre um grimório do qual a cópia
// acabou de sair.
test('renomear a customizada continua funcionando -- e o grimório não fica com órfã nem ganha entrada (issues #42 e #46)', async ({ context }) => {
  const NOME_ANTIGO = 'Facho de Nimb';
  const NOME_NOVO = 'Facho de Nimb Aprimorado';
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: NOME_ANTIGO, circulo: 1, escola: 'Evocação',
      tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V, S',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
    // A ficha antiga da issue #42: a magia JÁ estava no grimório por cópia
    // paga. "Mísseis Mágicos" é o guarda contra vacuidade -- o grimório não
    // pode ficar vazio, ou "a órfã não existe" valeria sobre o nada.
    grimorio: [{ nome: NOME_ANTIGO, circulo: 1 }, { nome: 'Mísseis Mágicos', circulo: 1 }],
  }, 'regras-magia-custom-grimorio-renomear-com-copia');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-editar-magia-custom]', { esperar: '#mc-nome' });
  await page.fill('#mc-nome', NOME_NOVO);
  await page.click('#btn-salvar-mc');
  await expect(page.locator('#toast-container'),
    'a edição precisa ter sido gravada antes de medir o que sobrou dela')
    .toContainText('atualizada');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect((salvo?.magias_customizadas || []).map((m) => m.nome),
    'A CAPACIDADE: renomear continua gravando o nome novo em magias_customizadas')
    .toEqual([NOME_NOVO]);

  const grimorio = salvo?.grimorio || [];
  expect(grimorio.some((m) => m?.nome === NOME_ANTIGO),
    'a cópia da customizada saiu na migração da #46: não pode ter ficado órfã sob o nome morto')
    .toBe(false);
  expect(grimorio.some((m) => m?.nome === NOME_NOVO),
    'e renomear não pode registrá-la de novo no grimório -- ela não é mais magia de grimório')
    .toBe(false);
  expect(grimorio.map((m) => m.nome),
    'a magia do ACERVO comprada continua no grimório, intacta -- a limpeza é só da customizada')
    .toEqual(['Mísseis Mágicos']);

  // E a linha renomeada aparece onde a magia passou a viver.
  const linha = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: NOME_NOVO });
  await expect(linha,
    'a linha renomeada tem de aparecer na seção Preparadas do círculo dela, conjurável')
    .toHaveCount(1);
  await expect(linha.locator('[data-conjurar-magia-custom]'),
    'com o botão de Conjurar -- renomear não pode custar a capacidade')
    .toHaveCount(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Issue #42, achado IMPORTANT 2 da revisão: os dois testes de rename acima
// usam nomes inventados, que nunca colidem com o acervo -- e por isso não
// alcançam este defeito. `char.grimorio` só guarda `{nome, circulo}` (a
// mesma limitação estrutural "uma vaga por nome" documentada em
// grimorio.js:372-390), e o `idxAntigo` que sincroniza o grimório ao
// renomear achava a entrada antiga só por NOME, em TODO o grimório, sem
// checar de quem ela era.
//
// Repro: o Mago tem "Bola de Fogo" do ACERVO paga no grimório (150 PO).
// Ele cria uma magia PERSONALIZADA com o MESMO nome "Bola de Fogo" (o
// formulário não recusa nome duplicado) e nunca a copia. Ao renomear a
// personalizada para "Chama Azul", a busca por nome achava a entrada PAGA
// do acervo -- não a da personalizada, que nunca existiu no grimório -- e
// sobrescrevia essa entrada paga com o nome/círculo da personalizada:
// destrói uma cópia paga E registra a outra de graça, as duas coisas que
// o bloco de sincronia existe para evitar.
// ============================================================
test('grimório do Mago: renomear magia personalizada homônima do acervo não destrói a entrada paga nem registra de graça (issue #42)', async ({ context }) => {
  const NOME_COLISAO = 'Bola de Fogo'; // magia real do acervo, 3º círculo de Mago
  const NOME_NOVO = 'Chama Azul de Nimb';
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      // Círculo DIFERENTE do acervo (1º, não 3º) para o resultado do
      // conserto ficar inequívoco: se a entrada paga sobreviver, ela
      // continua com círculo 3; se a personalizada tivesse sido registrada
      // de graça, apareceria com círculo 1.
      nome: NOME_COLISAO, circulo: 1, escola: 'Evocação',
      tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V, S',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
    // A entrada PAGA é do ACERVO (3º círculo) -- a personalizada nunca foi
    // copiada, nunca teve entrada própria.
    grimorio: [{ nome: NOME_COLISAO, circulo: 3 }],
  }, 'regras-magia-custom-grimorio-renomear-homonima');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-editar-magia-custom]', { esperar: '#mc-nome' });
  await page.fill('#mc-nome', NOME_NOVO);
  await page.click('#btn-salvar-mc');
  await expect(page.locator('#toast-container'),
    'a edição precisa ter sido gravada antes de medir o que sobrou dela')
    .toContainText('atualizada');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const grimorio = salvo?.grimorio || [];
  expect(grimorio.some((m) => m?.nome === NOME_COLISAO && m.circulo === 3),
    'a cópia PAGA de "Bola de Fogo" (acervo, 3º círculo, 150 PO) não pode ser destruída só porque uma '
    + 'magia personalizada homônima foi renomeada')
    .toBe(true);
  expect(grimorio.some((m) => m?.nome === NOME_NOVO),
    'a magia personalizada nunca foi copiada -- renomeá-la não pode registrá-la de graça no grimório')
    .toBe(false);
  expect(grimorio.length, 'nem a entrada paga some, nem uma nova entrada de graça aparece')
    .toBe(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// A MIRA DA LIMPEZA da issue #46, no caso em que ela é mais fácil de errar:
// a customizada leva um nome que EXISTE no acervo, só que em outro círculo.
// O jogador criou a SUA "Bola de Fogo" de 1º círculo (a do livro é de 3º) e
// tinha pago a cópia dela para o grimório.
//
// `migrarCopiasCustomizadasDoGrimorio` (sheet/migracoes.js) precisa remover
// essa entrada, e a decisão é por nome E CÍRCULO contra o acervo: o acervo
// não tem "Bola de Fogo" de 1º círculo, então a entrada só pode ser a cópia
// da customizada. Uma limpeza que perguntasse "existe magia do acervo com
// este NOME?" preservaria a entrada -- e o Mago ficaria com a linha
// duplicada que a #46 existe para eliminar.
//
// O CONTRASTE já está no arquivo, nos dois cenários vizinhos: quando o
// círculo da entrada BATE com o do acervo (a entrada é do livro, ou a
// origem é genuinamente ambígua), ela fica.
//
// POR QUE NÃO SE SEMEIA "as duas homônimas no grimório": `char.grimorio` é
// deduplicado por NOME em `normalizarGrimorioMago` (site/js/utils.js),
// chamada já na leitura do store -- duas entradas com o mesmo nome viram
// uma só antes de qualquer migração rodar. A vaga por nome é a limitação
// estrutural que os cenários vizinhos documentam.
//
// "Mísseis Mágicos" é o GUARDA CONTRA VACUIDADE: sem ela o grimório ficaria
// vazio, e "a cópia saiu" não distinguiria a mira certa de uma limpeza que
// levou tudo.
// ============================================================
test('a limpeza do grimório acerta a cópia da customizada homônima de uma magia de OUTRO círculo (issues #42 e #46)', async ({ context }) => {
  const NOME_COLISAO = 'Bola de Fogo'; // magia real do acervo, 3º círculo
  const NOME_NOVO = 'Chama Azul de Nimb';
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: NOME_COLISAO, circulo: 1, escola: 'Evocação',
      tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V, S',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
    // A entrada de 1º círculo só pode ser a cópia paga da personalizada:
    // nenhuma "Bola de Fogo" do acervo é de 1º círculo.
    grimorio: [{ nome: NOME_COLISAO, circulo: 1 }, { nome: 'Mísseis Mágicos', circulo: 1 }],
  }, 'regras-magia-custom-grimorio-renomear-homonima-paga');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // A MIRA DA LIMPEZA, antes de qualquer edição.
  expect((await personagemSalvo(page)).grimorio,
    'sai a cópia da customizada -- e sai apesar de "Bola de Fogo" existir no acervo, porque a '
    + 'decisão é por nome E CÍRCULO. A magia do livro comprada continua no grimório')
    .toEqual([{ nome: 'Mísseis Mágicos', circulo: 1 }]);

  await clicarSeletorFicha(page, '[data-editar-magia-custom]', { esperar: '#mc-nome' });
  await page.fill('#mc-nome', NOME_NOVO);
  await page.click('#btn-salvar-mc');
  await expect(page.locator('#toast-container'),
    'a edição precisa ter sido gravada antes de medir o que sobrou dela')
    .toContainText('atualizada');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect((salvo?.magias_customizadas || []).map((m) => m.nome),
    'A CAPACIDADE: renomear a customizada homônima continua funcionando')
    .toEqual([NOME_NOVO]);
  expect(salvo?.grimorio,
    'e o grimório não muda com o rename: nem a entrada do livro é tocada, nem o nome novo '
    + 'aparece -- a customizada não é magia de grimório desde a #46')
    .toEqual([{ nome: 'Mísseis Mágicos', circulo: 1 }]);

  await expect(page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: NOME_NOVO }),
  'e a linha renomeada aparece na seção Preparadas, conjurável como sempre')
    .toHaveCount(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Issue #42, achado da rodada 2 ("o oráculo tem de cobrir o ramo de
// recusa"): quando nome E círculo do grimório batem com a personalizada
// sendo renomeada E TAMBÉM com uma magia real do acervo (colisão dupla --
// o jogador escolheu de propósito o mesmo nome e o mesmo círculo do
// livro), o código genuinamente não tem como saber de quem é a entrada.
// A saída não é adivinhar (arriscando destruir uma cópia paga do acervo OU
// deixar uma personalizada registrada de graça) -- é avisar o jogador em
// vez de um "atualizada!" silencioso.
// ============================================================
test('grimório do Mago: renomear personalizada com nome E círculo idênticos ao acervo avisa em vez de adivinhar (issue #42)', async ({ context }) => {
  const NOME_COLISAO = 'Bola de Fogo'; // magia real do acervo, 3º círculo
  const NOME_NOVO = 'Chama Azul de Nimb';
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      // MESMO círculo do acervo (3º) -- a colisão dupla que torna a
      // entrada do grimório genuinamente ambígua.
      nome: NOME_COLISAO, circulo: 3, escola: 'Evocação',
      tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V, S',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
    grimorio: [{ nome: NOME_COLISAO, circulo: 3 }],
  }, 'regras-magia-custom-grimorio-renomear-ambigua');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-editar-magia-custom]', { esperar: '#mc-nome' });
  await page.fill('#mc-nome', NOME_NOVO);
  await page.click('#btn-salvar-mc');

  // GUARDA CONTRA VACUIDADE + a asserção central deste teste: o toast não
  // pode dizer só "atualizada!" -- a tela mentiria sobre o grimório não ter
  // sido tocado. Precisa nomear a incerteza.
  const toastFinal = page.locator('#toast-container');
  await expect(toastFinal, 'a edição precisa ter sido gravada antes de medir o aviso')
    .toContainText('atualizada');
  await expect(toastFinal,
    'quando nome E círculo batem com o acervo E com a personalizada ao mesmo tempo, o código não '
    + 'pode confirmar de quem é a entrada -- o jogador precisa ser avisado, não ler um sucesso liso')
    .toContainText('grimório');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const grimorio = salvo?.grimorio || [];
  expect(grimorio,
    'ambíguo, o bloco de sincronia não pode mexer em NADA -- nem atualizar, nem remover: a entrada '
    + 'original continua exatamente como estava')
    .toEqual([{ nome: NOME_COLISAO, circulo: 3 }]);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
