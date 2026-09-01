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
//   2. SELO DE RITUAL SOME NO GRIMÓRIO. O Mago que cria uma magia
//      personalizada de círculo > 0 ganha a magia no `char.grimorio`
//      (grimorio.js), mas a linha do Grimório deriva o marcador Ritual
//      de `ehMagiaRitual(nome)`, que só consulta o ACERVO -- magia
//      personalizada não está lá, e o campo `ritual: true` que o
//      jogador marcou era ignorado nessa seção.
//
// Os dois testes CLICAM na tela (memória do projeto: botão novo só está
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

test('grimório do Mago: magia personalizada marcada como Ritual mostra o selo Ritual', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Selo de Nimb', circulo: 1, escola: 'Abjuração',
      tempo_conjuracao: 'Ação', alcance: 'Pessoal', componentes: 'V',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: true,
    }],
    grimorio: [{ nome: 'Selo de Nimb', circulo: 1 }],
  }, 'regras-magia-custom-ritual');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // GUARDA CONTRA VACUIDADE: a linha precisa existir no Grimório antes de
  // qualquer afirmação sobre o selo dela.
  const linha = page.locator('[data-details-id="grimorio-mago"] .magia-item', { hasText: 'Selo de Nimb' });
  await expect(linha,
    'a magia personalizada de círculo > 0 do Mago vive no grimório -- sem a linha, nada a medir')
    .toHaveCount(1);

  await expect(linha,
    'o jogador marcou "Pode ser conjurada como Ritual" no formulário; o selo Ritual tem de '
    + 'aparecer no grimório como aparece para magia do acervo')
    .toContainText('Ritual');

  // O selo vem acompanhado do botão -- e botão só está entregue quando um
  // spec CLICA nele. Aqui o clique também prova que o botão do grimório está
  // ligado ao handler certo: o do acervo se guarda com `ehMagiaRitual`, que
  // não conhece magia personalizada, e não faria nada.
  const antes = await espacosConjuracaoCirculo1(page);
  expect(antes, 'o spec precisa ler os espaços de 1º círculo antes de medir o efeito do clique')
    .not.toBeNull();

  await clicarSeletorFicha(page,
    '[data-details-id="grimorio-mago"] [data-conjurar-ritual-custom]',
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

test('grimório do Mago: magia personalizada SEM Ritual não ganha o selo -- o contraste', async ({ context }) => {
  // Sem este contraste, "aparece Ritual" passaria numa tela que carimba
  // Ritual em toda linha do grimório.
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Selo Mundano', circulo: 1, escola: 'Abjuração',
      tempo_conjuracao: 'Ação', alcance: 'Pessoal', componentes: 'V',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
    grimorio: [{ nome: 'Selo Mundano', circulo: 1 }],
  }, 'regras-magia-custom-sem-ritual');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  const linha = page.locator('[data-details-id="grimorio-mago"] .magia-item', { hasText: 'Selo Mundano' });
  await expect(linha, 'a linha precisa existir para o contraste medir alguma coisa').toHaveCount(1);
  await expect(linha,
    'magia personalizada sem o marcador Ritual não pode ganhar o selo')
    .not.toContainText('Ritual');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('grimório do Mago: clicar na magia personalizada abre a descrição (issue #39)', async ({ context }) => {
  // Causa raiz: o Grimório renderizava a magia personalizada com
  // `data-magia-nome` -- o mesmo atributo de uma magia do acervo --, então o
  // clique caía no handler genérico (site/js/sheet/magias.js, perto da linha
  // 2585), que busca a descrição em `getMagiasPorCirculo(circ)`. A magia
  // personalizada não está lá: `magia` fica `undefined`, o handler ainda
  // marca a linha como "expandida" (então nada parece quebrado à primeira
  // vista), mas `.magia-desc` fica vazio e sem altura -- na prática, nada
  // abre. Na seção Preparadas a MESMA magia sai com `data-magia-custom-index`
  // e usa o handler certo (perto da linha 2617), que lê
  // `char.magias_customizadas` -- ali funciona. Este teste clica na linha
  // do Grimório e exige a descrição visível, igual já acontece com uma
  // magia do acervo.
  const DESCRICAO = 'Névoa arcana revela armadilhas ocultas num raio de 3 metros.';
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: 'Névoa de Nimb', circulo: 1, escola: 'Adivinhação',
      tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V, S',
      duracao: '1 minuto', descricao: DESCRICAO, dano: '', ritual: false,
    }],
    grimorio: [{ nome: 'Névoa de Nimb', circulo: 1 }],
  }, 'regras-magia-custom-grimorio-desc');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // GUARDA CONTRA VACUIDADE: a linha precisa existir no Grimório antes de
  // qualquer afirmação sobre o clique nela.
  const linha = page.locator('[data-details-id="grimorio-mago"] .magia-item', { hasText: 'Névoa de Nimb' });
  await expect(linha,
    'a magia personalizada de círculo > 0 do Mago vive no grimório -- sem a linha, nada a medir')
    .toHaveCount(1);

  const descricao = linha.locator('.magia-desc');
  await expect(descricao, 'a descrição não pode estar visível antes do clique').toBeHidden();

  // Clica no nome, fora da área dos botões (Preparar/Remover) -- o handler
  // de expandir ignora clique que caia em cima de um <button>/<select>.
  await linha.locator('.magia-nome').click();

  await expect(descricao,
    'clicar na magia personalizada do Grimório tem de abrir a descrição, igual já '
    + 'acontece com uma magia do acervo')
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

// O contraste do teste acima -- e uma checagem de coerência, não de
// regressão: mesmo antes da correção da #42, este caso específico (a magia
// JÁ estava no grimório por cópia legítima) já limpava a entrada antiga e
// gravava a nova -- é o comportamento que o achado da issue #42 pediu para
// PRESERVAR ao remover o empurrão automático (site/js/sheet/grimorio.js,
// mostrarFormMagiaCustom: "Decida o que fazer com essa limpeza... Não
// deixe entrada órfã"). Sem este teste, um conserto apressado que
// removesse a limpeza inteira (e não só o empurrão indevido) passaria sem
// aviso -- é o cenário que o relatório desta tarefa pede para verificar:
// uma ficha com a magia JÁ no grimório continua correta depois da mudança.
test('grimório do Mago: renomear magia personalizada JÁ copiada mantém o grimório coerente, sem entrada órfã (issue #42)', async ({ context }) => {
  const NOME_ANTIGO = 'Facho de Nimb';
  const NOME_NOVO = 'Facho de Nimb Aprimorado';
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: NOME_ANTIGO, circulo: 1, escola: 'Evocação',
      tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V, S',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
    // Desta vez a magia JÁ está no grimório -- simula uma cópia legítima
    // paga antes desta edição (o mesmo estado que uma ficha real, em
    // produção, tem hoje).
    grimorio: [{ nome: NOME_ANTIGO, circulo: 1 }],
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
  const grimorio = salvo?.grimorio || [];
  expect(grimorio.some((m) => m?.nome === NOME_ANTIGO),
    'renomear não pode deixar uma entrada órfã no grimório presa no nome antigo')
    .toBe(false);
  expect(grimorio.some((m) => m?.nome === NOME_NOVO && m.circulo === 1),
    'a magia já estava no grimório por cópia legítima -- a entrada precisa acompanhar o nome novo, '
    + 'não desaparecer nem duplicar')
    .toBe(true);
  expect(grimorio.length, 'nem órfã sobrando, nem duplicata: continua uma entrada só')
    .toBe(1);

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
// Issue #42, achado da rodada 2 (quebra nova introduzida pelo conserto da
// rodada 1): `nomeEhDoAcervoMago` perguntava "existe magia do ACERVO com
// este NOME?" -- existência de nome, não posse da entrada -- e por isso
// recusava mexer até quando a entrada do grimório É da personalizada de
// verdade, paga por 50 PO. Este é o CONTRASTE do teste de homônima acima:
// lá a entrada paga era do ACERVO e a personalizada nunca foi copiada; aqui
// a entrada paga É da personalizada (ela mesma pagou a cópia, pelo botão
// "+ Copiar Magia para Grimório" -- ver grimorio-mago.spec.mjs), com um
// círculo DIFERENTE do da magia real de mesmo nome no acervo -- exatamente
// o repro que a rodada 2 apontou: sem este teste, um conserto que voltasse
// a recusar por nome sozinho passaria batido de novo.
// ============================================================
test('grimório do Mago: renomear magia personalizada PAGA e homônima do acervo atualiza a entrada certa, sem deixar órfã (issue #42)', async ({ context }) => {
  const NOME_COLISAO = 'Bola de Fogo'; // magia real do acervo, mas 3º círculo -- a personalizada é 1º
  const NOME_NOVO = 'Chama Azul de Nimb';
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [{
      nome: NOME_COLISAO, circulo: 1, escola: 'Evocação',
      tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V, S',
      duracao: 'Instantânea', descricao: '', dano: '', ritual: false,
    }],
    // A entrada paga É da personalizada (1º círculo -- nenhuma "Bola de
    // Fogo" do acervo é 1º círculo, então esta entrada só pode ser dela).
    grimorio: [{ nome: NOME_COLISAO, circulo: 1 }],
  }, 'regras-magia-custom-grimorio-renomear-homonima-paga');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  await clicarSeletorFicha(page, '[data-editar-magia-custom]', { esperar: '#mc-nome' });
  await page.fill('#mc-nome', NOME_NOVO);
  await page.click('#btn-salvar-mc');
  await expect(page.locator('#toast-container'),
    'renomear uma cópia paga, sem ambiguidade nenhuma (círculo não bate com o do acervo), tem de '
    + 'confirmar sucesso sem ressalva')
    .toContainText('atualizada');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const grimorio = salvo?.grimorio || [];
  expect(grimorio.some((m) => m?.nome === NOME_COLISAO),
    'a entrada com o nome antigo não pode sobrar -- ela é desta personalizada, e tem de acompanhar '
    + 'o rename, não ficar órfã sob o nome morto')
    .toBe(false);
  expect(grimorio.some((m) => m?.nome === NOME_NOVO && m.circulo === 1),
    'a cópia paga precisa aparecer com o nome novo e o círculo (1º) preservado')
    .toBe(true);
  expect(grimorio.length, 'nem órfã sobrando, nem duplicata: continua uma entrada só')
    .toBe(1);

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
