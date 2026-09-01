// ============================================================
// Issues #27 e #33: magia PERSONALIZADA de círculo 1+ não tinha como ser
// preparada.
//
// O jogador criava a magia pelo formulário "Magia Personalizada", ela era
// gravada em `char.magias_customizadas` -- e parava ali. A seção
// "Magias Customizadas" da ficha mostrava a linha marcada "Não preparada",
// com editar e remover, sem "Conjurar". O caminho normal de preparo (o
// modal "+ Magia" -> aba do círculo -> marcar) montava a grade de círculos
// SÓ a partir da lista da classe (`obterMagiasDisponiveisClasseAtual`) e,
// para o Mago, de `char.grimorio`: `char.magias_customizadas` nunca era
// lido ali. Sem cartão na grade, não existia clique nenhum que fizesse a
// magia virar `magias_preparadas`.
//
// Truque personalizado não sofria disso porque truque não passa por
// preparo -- `sheet/magias.js` funde `truquesPersonalizados` direto em
// `todosTruques`. Foi o próprio jogador quem notou ("como truque vai
// direto").
//
// Os testes CLICAM na aba do círculo e no cartão da magia (memória do
// projeto: gatilho de tela só está entregue com um spec que clica nele) e
// leem o personagem SALVO -- é a gravação em `magias_preparadas` que
// nunca acontecia, e só a leitura do store mede isso.
//
// O CLÉRIGO é a semente do cenário principal de propósito: é classe de
// PREPARADAS e NÃO-Mago, exatamente o alcance da issue #27 (o print do
// relato é de um personagem não-Mago). Para o Mago existia um desvio na
// gravação do formulário (a magia é empurrada para `char.grimorio`), que
// é assunto de outra issue -- aqui ele só aparece como fonte de DUPLICATA
// na grade, e o segundo cenário guarda contra isso.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

const CLERIGO = {
  classe: 'Clérigo', subclasse: '', nivel: 3, xp: 900,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Religião', 'Intuição'],
};

const MAGO = {
  classe: 'Mago', subclasse: '', nivel: 3, xp: 900,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
};

const NOME_MAGIA = 'Bênção de Nimb';
// Segunda personalizada, que fica SEM preparar do começo ao fim: é o
// contraste que impede a última afirmação do primeiro cenário de passar por
// vacuidade. Com uma só, preparar a magia esvazia a seção "Magias
// Customizadas" inteira e "não contém mais a magia" seria verdade sobre uma
// seção que nem existe -- e passaria também numa regressão que apagasse a
// seção por completo.
const NOME_MAGIA_2 = 'Selo de Nimb';

// Carga e medição na forma que xss-campos-livres.spec.mjs já estabeleceu
// neste diretório: `src=x` falha a carregar em qualquer navegador, então o
// `onerror` dispara sozinho, sem interação. O texto visível (XSS-MARCA)
// serve para a afirmação POSITIVA -- escapar não pode virar apagar.
const CARGA = '<img src=x onerror="window.__xss=(window.__xss||0)+1">XSS-MARCA';

/** Lê os dois indicadores de injeção de uma vez, direto da página. */
async function medirInjecao(page) {
  return page.evaluate(() => ({
    scriptRodou: window.__xss ?? null,
    tagsInjetadas: document.querySelectorAll('img[src="x"]').length,
  }));
}

/** A magia personalizada do relato, no formato gravado pelo formulário. */
function magiaCustom(nome = NOME_MAGIA, circulo = 1) {
  return {
    nome, circulo, escola: 'Abjuração', tempo_conjuracao: 'Ação',
    alcance: 'Toque', componentes: 'V, S', duracao: 'Instantânea',
    descricao: 'Um brilho tênue protege o alvo por um instante.',
    dano: '', ritual: false,
  };
}

/** Abre todos os `<details>` da ficha -- o Playwright não clica no que está escondido. */
async function abrirTudo(page) {
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});
}

/**
 * Abre o modal "Gerenciar Magias" (botão "+ Magia") e espera a grade
 * existir -- `mostrarBuscaMagia` é async (carrega a lista de magias da
 * classe antes de montar o HTML), então esperar o elemento cobre essa
 * corrida em vez de um timeout fixo. Mesma forma que magia-classe.spec.mjs
 * usa; helper pequeno e específico de um spec fica replicado, pela
 * convenção já estabelecida neste diretório.
 */
async function abrirGerenciarMagias(page) {
  await page.click('#btn-add-magia');
  await page.waitForSelector('#resultado-magias', { state: 'visible', timeout: 20_000 });
  await assentar(page).catch(() => {});
}

/** Fecha o modal e deixa a ficha re-renderizada, para medir a seção Preparadas. */
async function fecharModalERenderizar(page) {
  await page.evaluate(() => window.fecharModal?.());
  await assentar(page).catch(() => {});
  await abrirTudo(page);
}

test('Clérigo: magia personalizada de 1º círculo pode ser preparada pelo modal "+ Magia"', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom(), magiaCustom(NOME_MAGIA_2, 2)],
  }, 'regras-magia-custom-preparar-clerigo');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // GUARDA CONTRA VACUIDADE 1: hoje a magia vive na seção separada
  // "Magias Customizadas", marcada "Não preparada". Sem essa linha na tela
  // não haveria defeito nenhum a medir.
  const secaoCustom = page.locator('[data-details-id="magias-customizadas-circulo"]');
  await expect(secaoCustom,
    'a magia personalizada de círculo 1 precisa começar na seção "Magias Customizadas" -- '
    + 'é de lá que ela tem de sair ao ser preparada')
    .toContainText(NOME_MAGIA);
  await expect(secaoCustom,
    'antes de preparar, a linha é a do relato: "Não preparada", sem Conjurar')
    .toContainText('Não preparada');

  await abrirGerenciarMagias(page);

  // GUARDA CONTRA VACUIDADE 2: a aba do 1º círculo precisa existir para o
  // clique abaixo significar alguma coisa (Clérigo 3 tem espaços de 1º e 2º).
  const aba = page.locator('#tabs-gerenciar-magias [data-tab-mg="1"]');
  await expect(aba, 'o Clérigo 3 tem espaços de 1º círculo -- a aba precisa existir').toHaveCount(1);
  await aba.click();
  await assentar(page).catch(() => {});

  // A AÇÃO CENTRAL: o cartão da magia personalizada tem de estar na grade
  // do 1º círculo, com o check clicável. É exatamente isto que não existia.
  const cartao = page.locator(`#resultado-magias [data-circ-check="${NOME_MAGIA}"]`);
  await expect(cartao,
    'a magia personalizada de 1º círculo precisa aparecer na grade do círculo dela, junto '
    + 'das magias da classe -- sem cartão não há caminho nenhum para prepará-la (issues #27/#33)')
    .toBeVisible({ timeout: 10_000 });

  // O cartão precisa se identificar: numa grade em que todo o resto veio da
  // lista da classe, o jogador tem de conseguir ver qual magia é invenção
  // dele -- o mesmo que a ficha já faz com o selo "Personalizada".
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: NOME_MAGIA }),
    'o cartão da magia personalizada tem de se identificar como tal na grade do círculo')
    .toContainText('Personalizada');

  await cartao.click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || []).find((m) => m?.nome === NOME_MAGIA) || null;
  }, {
    message: 'marcar a magia personalizada na grade tem de gravá-la em magias_preparadas[]',
  }).not.toBeNull();

  const preparada = (await personagemSalvo(page)).magias_preparadas.find((m) => m.nome === NOME_MAGIA);
  expect(preparada.circulo,
    'a entrada gravada tem de manter o círculo da magia')
    .toBe(1);
  expect(preparada.personalizada,
    'a entrada precisa carregar `personalizada: true` -- é a marca que a seção Preparadas usa '
    + 'para achar a magia em magias_customizadas[] e renderizar a linha personalizada (com '
    + 'descrição, tags e o botão de Conjurar próprio dela)')
    .toBe(true);
  expect(preparada.classe,
    'preparada pela superfície do Clérigo, a entrada sai carimbada com essa classe -- é assim '
    + 'que ela conta no limite de preparadas da classe (magia personalizada é escolha do '
    + 'jogador, não concessão: não é origem isenta)')
    .toBe('Clérigo');

  await fecharModalERenderizar(page);

  // O outro lado do conserto: preparada, a magia passa a viver na seção
  // Preparadas do círculo dela, com Conjurar -- e SAI da seção "Magias
  // Customizadas" sozinha (aquela seção filtra por "não está preparada").
  const linhaPreparada = page.locator('[data-details-id="magias-circulo-1"] .magia-personalizada',
    { hasText: NOME_MAGIA });
  await expect(linhaPreparada,
    'depois de preparada, a magia personalizada tem de aparecer na seção Preparadas do 1º círculo')
    .toHaveCount(1);
  await expect(linhaPreparada.locator('[data-conjurar-magia-custom]'),
    'a linha preparada precisa ter o botão de Conjurar -- é a capacidade que as issues #27/#33 '
    + 'relatam como ausente')
    .toHaveCount(1);

  const secaoDepois = page.locator('[data-details-id="magias-customizadas-circulo"]');
  await expect(secaoDepois,
    'a segunda personalizada continua sem preparo -- a seção tem de sobreviver, senão a '
    + 'afirmação seguinte não distingue "a magia saiu" de "a seção inteira sumiu"')
    .toContainText(NOME_MAGIA_2);
  await expect(secaoDepois,
    'preparada, a magia não pode continuar listada como "Magias Customizadas" não preparada')
    .not.toContainText(NOME_MAGIA);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Mago: a magia personalizada aparece UMA vez na grade e é gravada como personalizada', async ({ context }) => {
  // O Mago recebe a mesma magia por dois caminhos: o desvio da gravação do
  // formulário (que a empurra para `char.grimorio`, de onde a grade do Mago
  // é montada) e a fusão nova de `magias_customizadas`. Duas fontes, um
  // cartão só -- e o cartão que vence precisa ser o PERSONALIZADO, senão a
  // entrada gravada sai sem `personalizada: true` e a seção Preparadas tenta
  // buscar a descrição no acervo, onde a magia não existe.
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [magiaCustom()],
    grimorio: [{ nome: NOME_MAGIA, circulo: 1 }],
  }, 'regras-magia-custom-preparar-mago');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);
  await page.locator('#tabs-gerenciar-magias [data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});

  const cartao = page.locator(`#resultado-magias [data-circ-check="${NOME_MAGIA}"]`);
  await expect(cartao,
    'a magia personalizada do Mago tem de aparecer EXATAMENTE uma vez na grade do 1º círculo '
    + '-- uma pelo grimório (desvio da gravação) e outra pela fusão nova seria duplicata')
    .toHaveCount(1);
  await cartao.click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || []).filter((m) => m?.nome === NOME_MAGIA).length;
  }, {
    message: 'a magia precisa ter sido gravada uma única vez em magias_preparadas[]',
  }).toBe(1);

  const preparada = (await personagemSalvo(page)).magias_preparadas.find((m) => m.nome === NOME_MAGIA);
  expect(preparada.personalizada,
    'mesmo chegando à grade também pelo grimório, a magia É personalizada -- a entrada gravada '
    + 'tem de dizer isso, ou a seção Preparadas procura a descrição no acervo e não acha nada')
    .toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('grade de círculos: NENHUM campo da magia personalizada vira HTML', async ({ context }) => {
  // Mesma disciplina (e a mesma carga) de xss-campos-livres.spec.mjs,
  // aplicada aos campos que este conserto passou a levar para dentro do
  // modal. O modelo de ameaça é o daquele arquivo: fichas CIRCULAM (o README
  // ensina a exportar e passar adiante, o formulário de bug pede o arquivo
  // exportado em anexo), então ficha de terceiro é entrada não confiável.
  //
  // A carga vai em TODO campo, não só no nome: a primeira versão deste
  // cenário só envenenava `nome` e por isso nascia verde por cima de
  // `escola`, que chega ao mesmo `innerHTML` duas linhas abaixo. Um oráculo
  // que só cobre o campo de que o autor se lembrou não mede o que ele acha
  // que mede. `classes` e `circulo_superior` não existem no formulário --
  // só uma ficha importada os traz --, e é justamente por isso que estão
  // aqui: eles chegam ao sub-modal de detalhes.
  const MAGIA_ENVENENADA = {
    nome: `Bencao ${CARGA}`,
    circulo: 1,
    escola: `Abjuracao ${CARGA}`,
    tempo_conjuracao: `Acao ${CARGA}`,
    alcance: `Toque ${CARGA}`,
    componentes: `V, S ${CARGA}`,
    duracao: `Instantanea ${CARGA}`,
    descricao: `Descricao ${CARGA}`,
    dano: `1d8 ${CARGA}`,
    ritual: false,
    classes: [`Clerigo ${CARGA}`],
    circulo_superior: `Superior ${CARGA}`,
  };
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [MAGIA_ENVENENADA],
  }, 'regras-magia-custom-preparar-escape');
  await assentar(page).catch(() => {});

  /** Afirma os dois indicadores de injeção de uma vez, com o lugar no recado. */
  const exigirLimpo = async (onde) => {
    const { scriptRodou, tagsInjetadas } = await medirInjecao(page);
    expect(scriptRodou, `um campo da magia personalizada executou script em ${onde}`).toBeNull();
    expect(tagsInjetadas, `a carga virou tag <img> de verdade no DOM em ${onde}`).toBe(0);
  };

  await exigirLimpo('a ficha, antes de abrir o modal');

  // Lê os nomes que os gatilhos da grade guardam, já decodificados pelo
  // navegador -- é o valor que o manipulador de clique vai enxergar em
  // `el.dataset`, não o texto cru do HTML.
  const nomesDoGatilho = (atributo) => page.evaluate((attr) => Array.from(
    document.querySelectorAll(`#resultado-magias [${attr}]`),
  ).map((el) => el.getAttribute(attr)), atributo);

  await abrirGerenciarMagias(page);
  await page.locator('#tabs-gerenciar-magias [data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});

  await exigirLimpo('a grade de círculos');
  // GUARDA CONTRA VACUIDADE 1: o gatilho precisa existir COM o nome íntegro
  // -- a aspa dupla dentro da carga fecha o atributo antes da hora se o nome
  // não for escapado, e aí o `data-circ-check` chega TRUNCADO ao clique (a
  // magia certa deixa de ser encontrada). Sem esta afirmação, "não injetou"
  // seria verdade por acidente, sobre um cartão já quebrado de outro jeito.
  expect(await nomesDoGatilho('data-circ-check'),
    'o cartão precisa existir e guardar o nome INTEIRO no atributo do gatilho')
    .toContain(MAGIA_ENVENENADA.nome);
  // GUARDA CONTRA VACUIDADE 2: escapar não pode virar apagar. O texto tem de
  // continuar na tela, como texto -- e `escola` é o campo que faltava.
  // O cartão é localizado pelo SELO, não pelo texto da carga -- procurá-lo
  // pela própria carga tornaria a afirmação circular.
  await expect(page.locator('#resultado-magias .opcao-card', { hasText: 'Personalizada' }),
    'o nome e a escola têm de continuar visíveis no cartão, só que como texto')
    .toContainText('XSS-MARCA');

  // O sub-modal de detalhes é o segundo destino: ele recebe escola, tempo,
  // alcance, componentes, duração, descrição, `classes` e `circulo_superior`.
  await page.locator('#resultado-magias .opcao-card', { hasText: 'Personalizada' })
    .locator('[data-detalhe-magia]').click();
  await expect(page.locator('.sub-modal-overlay'),
    'o sub-modal de detalhes precisa abrir para haver o que medir nele')
    .toContainText('XSS-MARCA');
  await exigirLimpo('o sub-modal de detalhes');
  await page.evaluate(() => window.fecharModal?.());
  await assentar(page).catch(() => {});

  // O clique é por JS casando o `dataset` decodificado: um seletor CSS com a
  // aspa dupla da carga dentro não é sequer sintaxe válida -- e é exatamente
  // o `dataset` que o manipulador de clique do produto lê.
  const clicou = await page.evaluate((alvo) => {
    const el = Array.from(document.querySelectorAll('#resultado-magias [data-circ-check]'))
      .find((e) => e.dataset.circCheck === alvo);
    if (!el) return false;
    el.click();
    return true;
  }, MAGIA_ENVENENADA.nome);
  expect(clicou, 'o gatilho da magia personalizada tem de ser encontrável pelo nome exato').toBe(true);
  await assentar(page).catch(() => {});

  // A aba "Preparadas Atuais" é o terceiro destino, e só passa a receber
  // magia personalizada por causa deste conserto.
  await page.locator('#tabs-gerenciar-magias [data-tab-mg="preparadas"]').click();
  await assentar(page).catch(() => {});
  await exigirLimpo('a aba "Preparadas Atuais"');
  expect(await nomesDoGatilho('data-remover-check'),
    'a magia precisa aparecer inteira na aba de preparadas para haver o que medir -- e é o '
    + 'clique nesse gatilho que a remove depois')
    .toContain(MAGIA_ENVENENADA.nome);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('grade de círculos: clicar no nome da magia personalizada abre a descrição dela', async ({ context }) => {
  // Consequência direta do cartão novo, não achado avulso: o nome do cartão
  // é um gatilho de clique (`data-detalhe-magia`) que busca a magia no
  // ACERVO (`getMagiasPorCirculo`). Magia personalizada não está lá -- sem
  // esta guarda, o cartão que a correção acabou de colocar na grade responde
  // ao clique com o toast vermelho "Detalhes não encontrados". A mesma forma
  // da issue #39, que já tinha mordido o painel do Grimório.
  // O escape dos metadados deste sub-modal é medido pelo cenário da carga,
  // acima. Aqui a pergunta é só uma: a descrição ABRE?
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom()],
  }, 'regras-magia-custom-preparar-detalhe');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);
  await page.locator('#tabs-gerenciar-magias [data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});

  const nome = page.locator(`#resultado-magias [data-detalhe-magia="${NOME_MAGIA}"]`);
  await expect(nome, 'o cartão da magia personalizada precisa existir para haver clique a medir')
    .toHaveCount(1);
  await nome.click();

  await expect(page.locator('.sub-modal-overlay'),
    'clicar no nome tem de abrir o sub-modal de detalhes da magia personalizada, lido da ficha '
    + '-- não o toast de erro de quem só sabe procurar no acervo')
    .toContainText(magiaCustom().descricao);

  await expect(page.locator('#toast-container'),
    'nenhum toast de "Detalhes não encontrados" pode aparecer')
    .not.toContainText('Detalhes não encontrados');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Clérigo com personalizada HOMÔNIMA de uma magia da classe: as duas continuam na grade', async ({ context }) => {
  // O contraste do cenário do Mago: lá a mesma magia chega por dois caminhos
  // e tem de virar UM cartão; aqui são DUAS magias diferentes que por acaso
  // têm o mesmo nome, e as duas têm de ficar.
  //
  // "Bênção" é magia de 1º círculo do Clérigo no acervo. Nada impede o
  // jogador de criar a SUA "Bênção" personalizada -- o formulário só exige
  // nome não vazio. Um dedup por nome que valesse para todo mundo apagaria a
  // magia do LIVRO da grade, e o jogador perderia o caminho para prepará-la:
  // regressão exatamente na população que esta tarefa existe para atender (o
  // conjurador não-Mago). Por isso o dedup só vale contra a cópia que o
  // desvio da gravação deixa em `char.grimorio`, do Mago.
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom('Bênção', 1)],
  }, 'regras-magia-custom-preparar-homonima');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);
  await page.locator('#tabs-gerenciar-magias [data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});

  const cartoes = page.locator('#resultado-magias .opcao-card', { hasText: 'Bênção' });
  await expect(cartoes,
    'a "Bênção" do livro e a "Bênção" do jogador são magias DIFERENTES: as duas têm de ter '
    + 'cartão na grade do 1º círculo')
    .toHaveCount(2);

  const daClasse = cartoes.filter({ hasNotText: 'Personalizada' });
  const doJogador = cartoes.filter({ hasText: 'Personalizada' });
  await expect(doJogador,
    'exatamente um dos dois cartões é o personalizado -- é o selo que deixa o jogador '
    + 'distinguir um do outro numa grade em que os dois se chamam igual')
    .toHaveCount(1);
  await expect(daClasse, 'e o outro é o do acervo, sem selo').toHaveCount(1);

  // A AÇÃO: preparar pela magia do LIVRO. Ela tem de entrar como magia do
  // livro -- sem `personalizada` --, senão a seção Preparadas da ficha
  // resolve o nome em `magias_customizadas` e mostra a magia do JOGADOR no
  // lugar da que ele acabou de escolher.
  await daClasse.locator('[data-circ-check]').click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || []).find((m) => m?.nome === 'Bênção') || null;
  }, {
    message: 'preparar pelo cartão da magia do livro tem de gravar a magia em magias_preparadas',
  }).not.toBeNull();

  const preparada = (await personagemSalvo(page)).magias_preparadas.find((m) => m.nome === 'Bênção');
  expect(preparada.personalizada,
    'o cartão clicado foi o do ACERVO: a entrada não pode sair marcada como personalizada só '
    + 'porque existe uma magia do jogador com o mesmo nome -- quem responde "qual cartão foi '
    + 'clicado?" é o cartão, não a ficha')
    .toBeUndefined();

  // E a magia do jogador continua na grade, disponível.
  await expect(doJogador,
    'preparar a magia do livro não pode fazer a personalizada homônima sumir da grade')
    .toHaveCount(1);

  // A TELA NÃO PODE MENTIR. `selecionadasSet` era montado só por NOME: com a
  // do livro preparada, o check acendia nos DOIS cartões, e a grade afirmava
  // que a magia do jogador estava preparada quando não estava.
  await expect(daClasse,
    'o cartão preparado é o do livro -- é nele, e só nele, que o check acende')
    .toHaveClass(/selecionada/);
  await expect(doJogador,
    'a magia do jogador NÃO está preparada: o cartão dela não pode aparecer marcado só '
    + 'porque existe uma homônima preparada')
    .not.toHaveClass(/selecionada/);

  // O CLIQUE NO SEGUNDO CARTÃO -- o caminho que destruía a preparação do
  // livro em silêncio. `findIndex(m => m.nome === nome)` casava por nome, ia
  // para o ramo de REMOÇÃO e apagava a entrada do livro, com toast
  // "Bênção removida", enquanto o jogador achava que estava preparando a
  // dele. Sem este clique o cenário não mede nada.
  await doJogador.locator('[data-circ-check]').click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#toast-container'),
    'o app precisa DIZER por que não deu -- a limitação (uma vaga por nome) tem de aparecer '
    + 'para o jogador, não agir em silêncio')
    .toContainText('já está preparada');
  await expect(page.locator('#toast-container'),
    'e o que não pode acontecer de jeito nenhum é a tentativa ser lida como "despreparar a '
    + 'do livro"')
    .not.toContainText('removida');

  const depois = (await personagemSalvo(page)).magias_preparadas.filter((m) => m.nome === 'Bênção');
  expect(depois.length,
    'a preparação do livro tem de sobreviver ao clique no cartão da homônima -- destruí-la em '
    + 'silêncio era o pior dos danos')
    .toBe(1);
  expect(depois[0].personalizada,
    'e a que sobrou tem de continuar sendo a do LIVRO, não trocada pela do jogador')
    .toBeUndefined();

  // E o caminho normal continua funcionando: clicar no cartão preparado
  // desprepara. Sem esta afirmação, "não removeu" passaria também numa
  // regressão que tivesse quebrado o despreparo inteiro.
  await daClasse.locator('[data-circ-check]').click();
  await assentar(page).catch(() => {});
  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || []).some((m) => m?.nome === 'Bênção');
  }, {
    message: 'clicar no cartão da magia preparada tem de desprepará-la, como sempre fez',
  }).toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('homônimas em círculos DIFERENTES: o clique não alcança a entrada da outra', async ({ context }) => {
  // A variante entre círculos do mesmo defeito: o ramo de remoção não é
  // escopado por círculo, então a personalizada de 2º círculo resolvia para
  // a entrada da magia da classe preparada no 1º -- duas abas diferentes
  // disputando a MESMA entrada única.
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom('Bênção', 2)],
    magias_preparadas: [{ nome: 'Bênção', circulo: 1, classe: 'Clérigo' }],
  }, 'regras-magia-custom-preparar-homonima-circulos');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);
  await page.locator('#tabs-gerenciar-magias [data-tab-mg="2"]').click();
  await assentar(page).catch(() => {});

  const doJogador = page.locator('#resultado-magias .opcao-card', { hasText: 'Bênção' })
    .filter({ hasText: 'Personalizada' });
  // GUARDA CONTRA VACUIDADE: o cartão de 2º círculo precisa existir.
  await expect(doJogador, 'a personalizada de 2º círculo precisa ter cartão na aba do 2º círculo')
    .toHaveCount(1);
  await expect(doJogador,
    'a entrada preparada é de 1º círculo e é a da classe: o cartão de 2º círculo do jogador '
    + 'não pode nascer marcado')
    .not.toHaveClass(/selecionada/);

  await doJogador.locator('[data-circ-check]').click();
  await assentar(page).catch(() => {});

  const depois = (await personagemSalvo(page)).magias_preparadas.filter((m) => m.nome === 'Bênção');
  expect(depois.length,
    'clicar na personalizada de 2º círculo não pode apagar a magia da classe preparada no 1º')
    .toBe(1);
  expect(depois[0].circulo,
    'e a que sobrou tem de ser a de 1º círculo, intacta')
    .toBe(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha antiga: personalizada preparada SEM a marca ainda casa com o cartão dela', async ({ context }) => {
  // O outro lado da desambiguação: ela não pode ser estrita a ponto de
  // deixar de reconhecer o que já está gravado. Antes desta tarefa o Mago
  // conseguia preparar a personalizada pela grade (ela chegava lá pelo
  // grimório) e a entrada saía SEM `personalizada` -- fichas assim existem.
  // Sem homônima na grade, o nome basta e tem de bastar.
  const { page, erros } = await abrirFicha(context, {
    ...MAGO,
    magias_customizadas: [magiaCustom()],
    grimorio: [{ nome: NOME_MAGIA, circulo: 1 }],
    magias_preparadas: [{ nome: NOME_MAGIA, circulo: 1, classe: 'Mago' }],
  }, 'regras-magia-custom-preparar-legado');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);
  await page.locator('#tabs-gerenciar-magias [data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});

  const cartao = page.locator('#resultado-magias .opcao-card', { hasText: NOME_MAGIA });
  await expect(cartao,
    'a entrada gravada é essa magia, ainda que sem a marca: o cartão tem de aparecer marcado')
    .toHaveClass(/selecionada/);

  await cartao.locator('[data-circ-check]').click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || []).some((m) => m?.nome === NOME_MAGIA);
  }, {
    message: 'e o clique tem de desprepará-la -- uma desambiguação estrita demais deixaria a '
      + 'magia presa, sem jeito de tirar pela grade',
  }).toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// Clérigo 5 / Mago 1 -- o multiclasse do recurso principal da 3.0.0. Clérigo é
// a classe INICIAL (ordem 0), como nos fixtures irmãos deste diretório.
const CLERIGO_5_MAGO_1 = [
  { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
];

const MULTICLASSE = {
  classe: 'Clérigo', subclasse: '', nivel: 6, xp: 14000,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Religião', 'Intuição'],
  classes: CLERIGO_5_MAGO_1,
  schema_versao: 2,
};

test('multiclasse: a homônima preparada em OUTRA classe não é apagada pelo cartão desta', async ({ context }) => {
  // O residual que só o multiclasse revela. "Mísseis Mágicos" é magia de 1º
  // círculo do MAGO e não existe na lista do Clérigo -- então, na aba do
  // Clérigo, o único cartão com esse nome é o da magia personalizada. As duas
  // homônimas nunca aparecem na MESMA grade, e um conjunto de disputa
  // derivado dos cartões renderizados não enxerga colisão nenhuma: o cartão
  // do jogador nascia aceso pela entrada do Mago, e o clique fazia `splice`
  // nela com o toast "removida".
  //
  // Quem sabe de quem é a entrada é o DADO (`classe: 'Mago'`), não a tela.
  const { page, erros } = await abrirFicha(context, {
    ...MULTICLASSE,
    magias_customizadas: [magiaCustom('Mísseis Mágicos', 1)],
    magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' }],
  }, 'regras-magia-custom-preparar-multiclasse');
  await assentar(page).catch(() => {});

  // A superfície ativa tem de ser a do CLÉRIGO -- é a aba onde a magia do
  // Mago não aparece, e é aí que o defeito mora. Clérigo é a classe inicial,
  // então já é a ativa; a afirmação existe para o cenário não passar a medir
  // a aba errada em silêncio se esse padrão mudar.
  await expect(page.locator('#tabs-superficie-magia'),
    'o personagem precisa ter as duas superfícies de conjuração para o cenário existir')
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-tab-superficie="Clérigo"].active'),
    'a aba ativa tem de ser a do Clérigo -- é a superfície em que a magia do Mago não é listada')
    .toHaveCount(1);

  await abrirGerenciarMagias(page);
  await page.locator('#tabs-gerenciar-magias [data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});

  const cartao = page.locator('#resultado-magias .opcao-card', { hasText: 'Mísseis Mágicos' });
  // GUARDA CONTRA VACUIDADE: exatamente UM cartão, e é o personalizado -- se
  // houvesse dois, o cenário estaria medindo a colisão da MESMA grade, que os
  // outros cenários já cobrem, e não este residual.
  await expect(cartao, 'na aba do Clérigo há um único cartão com esse nome').toHaveCount(1);
  await expect(cartao, 'e ele é o da magia personalizada').toContainText('Personalizada');

  await expect(cartao,
    'a entrada preparada é a do MAGO: o cartão da personalizada, na aba do Clérigo, não pode '
    + 'nascer aceso por uma entrada que não é dele')
    .not.toHaveClass(/selecionada/);

  await cartao.locator('[data-circ-check]').click();
  await assentar(page).catch(() => {});

  const depois = (await personagemSalvo(page)).magias_preparadas
    .filter((m) => m.nome === 'Mísseis Mágicos');
  expect(depois.length,
    'a preparação do Mago tem de sobreviver ao clique no cartão da personalizada homônima')
    .toBe(1);
  expect(depois[0].classe,
    'e continuar sendo a entrada do Mago, intacta')
    .toBe('Mago');

  await expect(page.locator('#toast-container'),
    'e o app tem de DIZER onde a vaga está ocupada -- numa aba em que a magia sequer aparece, '
    + 'o jogador não tem como adivinhar que ela está preparada na outra classe')
    .toContainText('já está preparada');
  await expect(page.locator('#toast-container'),
    'o recado precisa nomear a classe que está ocupando a vaga')
    .toContainText('Mago');
  await expect(page.locator('#toast-container'),
    'e nada de ler a tentativa como "despreparar"')
    .not.toContainText('removida');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('origem isenta: a personalizada homônima de uma magia CONCEDIDA não herda o estado dela', async ({ context }) => {
  // A variante que para na mentira antes de chegar ao splice, e que é o
  // personagem da própria issue #27 (não-Mago, com magias de Iniciado em
  // Magia). A entrada concedida não foi escolhida na lista de classe nenhuma
  // -- não é a magia deste cartão. Sem tratá-la como ambígua, `isDominio`
  // casava por nome, o cartão do jogador saía marcado como preparado e
  // "Especial", e o check era removido junto: a magia dele ficava SEM
  // caminho para ser preparada, que é exatamente o defeito destas issues,
  // reintroduzido por outro caminho.
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO,
    magias_customizadas: [magiaCustom('Escudo Arcano', 1)],
    magias_preparadas: [{ nome: 'Escudo Arcano', circulo: 1, origem: 'iniciado_em_magia' }],
  }, 'regras-magia-custom-preparar-isenta');
  await assentar(page).catch(() => {});

  await abrirGerenciarMagias(page);
  await page.locator('#tabs-gerenciar-magias [data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});

  const cartao = page.locator('#resultado-magias .opcao-card', { hasText: 'Escudo Arcano' });
  await expect(cartao, 'o cartão da personalizada precisa existir').toHaveCount(1);
  await expect(cartao, 'e ser o da magia personalizada').toContainText('Personalizada');

  await expect(cartao,
    'a magia concedida é OUTRA magia: o cartão do jogador não pode nascer marcado por ela')
    .not.toHaveClass(/selecionada/);
  await expect(cartao,
    'nem herdar o rótulo de magia especial da concedida')
    .not.toContainText('Especial');

  // E o check tem de estar lá: era ele que `isDominio` removia, deixando a
  // magia do jogador sem caminho nenhum -- o defeito original de volta.
  await expect(cartao.locator('[data-circ-check]'),
    'o cartão do jogador precisa manter o check -- sem ele a magia dele volta a não ter '
    + 'caminho para ser preparada, que é o defeito que estas issues consertam')
    .toHaveCount(1);

  await cartao.locator('[data-circ-check]').click();
  await assentar(page).catch(() => {});

  const depois = (await personagemSalvo(page)).magias_preparadas
    .filter((m) => m.nome === 'Escudo Arcano');
  expect(depois.length,
    'a magia concedida não pode ser destruída pelo clique na homônima do jogador')
    .toBe(1);
  expect(depois[0].origem,
    'e continua sendo a concedida, intacta')
    .toBe('iniciado_em_magia');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
