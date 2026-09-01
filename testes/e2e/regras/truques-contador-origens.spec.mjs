// ============================================================
// O contador "Truques N / M" da ficha só conta o que sai do orçamento
// da classe.
//
// O motor do critério é testes/regras/unidade/truques-limite-origem.test.mjs.
// Aqui o alvo é a TELA: um critério correto lido pelo render errado
// continua pintando o contador de vermelho, e é o vermelho que o jogador vê.
//
// Os personagens são semeados direto, sem percorrer a aquisição: os
// caminhos de aquisição já têm spec próprio (telecinetico-truque-ficha.spec.mjs
// para o talento, subclasse-escolha.spec.mjs para o Ilusionista). O que se
// afirma aqui é só a CONTAGEM.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, clicarBotaoFicha, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

/**
 * A caixa do contador de truques da SEÇÃO Magias da ficha -- o primeiro
 * `.magia-contador` de `.magia-contadores`.
 *
 * `.magia-contadores` escopa à FICHA: o modal "Gerenciar Magias" também
 * usa a classe `.magia-contador`, e os cenários mais abaixo o abrem.
 */
function caixaContadorTruques(page) {
  return page.locator('.magia-contadores .magia-contador').first();
}

/** Texto do contador de truques ("2 / 2"), ou null se a caixa não existe */
async function contadorTruques(page) {
  const caixa = caixaContadorTruques(page);
  // A espera é o que faltava: `abrirFicha` devolve com a página carregada,
  // mas sob paralelismo a seção Magias podia ainda não ter sido montada na
  // hora da leitura -- e um `null` lido cedo demais falhava como se fosse
  // regra errada. Flake pré-existente desta suíte, exposto com mais
  // frequência depois que este arquivo passou de 3 para 7 cenários.
  await caixa.waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {});
  if (!await caixa.count()) return null;
  return (await caixa.locator('.contador-valor').innerText()).trim();
}

/** Classes CSS do contador de truques (para detectar 'contador-excedido') */
async function classesContador(page) {
  return (await caixaContadorTruques(page).getAttribute('class')) || '';
}

/**
 * `{ atual, limite, classes }` do contador "Truques" da SEÇÃO Magias da
 * ficha, achado pelo RÓTULO exato e dentro de `.magia-contadores` -- as
 * duas coisas que `contadorTruques` (acima, o helper histórico deste
 * arquivo) não faz. `.magia-contador` sozinho também casa os contadores do
 * MODAL "Gerenciar Magias", que os cenários abaixo abrem: com o modal
 * aberto, um `.first()` sobre a página inteira deixaria de ser uma
 * afirmação sobre a ficha. `null` quando a caixa não existe.
 */
async function contadorTruquesFicha(page) {
  return page.evaluate(() => {
    for (const caixa of document.querySelectorAll('.magia-contadores .magia-contador')) {
      if (caixa.querySelector('.contador-label')?.textContent?.trim() !== 'Truques') continue;
      const valor = caixa.querySelector('.contador-valor')?.textContent?.trim() || '';
      const m = valor.match(/(\d+)\s*\/\s*(\d+)/);
      return m ? { atual: Number(m[1]), limite: Number(m[2]), classes: caixa.className } : null;
    }
    return null;
  });
}

/** `{ atual, limite }` do contador de truques do topo do modal "Gerenciar Magias". */
async function contadorTruquesModal(page) {
  const texto = await page.locator('#gm-contador-truques').textContent().catch(() => null);
  const m = texto?.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { atual: Number(m[1]), limite: Number(m[2]) } : null;
}

/**
 * Abre o modal "Gerenciar Magias" pelo botão "+ Magia" e espera a grade
 * existir -- `mostrarBuscaMagia` é assíncrona (carrega a lista da classe
 * antes de montar o HTML), então esperar o elemento, e não um timeout
 * fixo, é o que cobre essa corrida. `clicarBotaoFicha` (helpers-regras.mjs)
 * acrescenta a retentativa que a suíte inteira usa para clique em botão da
 * ficha sob paralelismo.
 */
async function abrirGerenciarMagias(page) {
  await clicarBotaoFicha(page, 'btn-add-magia', { esperar: '#resultado-magias' });
  await assentar(page).catch(() => {});
}

test('ficha: truque do talento Telecinético não conta no limite da classe',
  async ({ context }) => {
    // Bardo nível 4: a tabela dá 3 truques (dados/classes/bardo.json -- são 2
    // até o nível 3), e o nível 4 é o primeiro ASI, ou seja, o mais cedo que
    // o talento pode entrar. Com o orçamento da classe JÁ CHEIO, Mãos Mágicas
    // do talento entra como quarto truque: se ela contasse, o contador iria a
    // "4 / 3" e ficaria vermelho.
    const { page } = await abrirFicha(context, {
      classe: 'Bardo',
      nivel: 4,
      xp: 355000,
      atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Atuação', 'História'],
      talentos: ['Telecinético'],
      magias_conhecidas: [
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
        { nome: 'Mensagem', circulo: 0 },
        { nome: 'Mãos Mágicas', circulo: 0, origem: 'telecinetico' },
      ],
    });

    expect(await contadorTruques(page),
      'o truque do talento foi cobrado do orçamento da classe').toBe('3 / 3');
    expect(await classesContador(page),
      'o contador ficou marcado como excedido').not.toContain('contador-excedido');
  });

test('ficha: truque automático do Ilusionista não conta no limite',
  async ({ context }) => {
    // Mago nível 3: a tabela dá 3 truques. Ilusão Menor vem da subclasse e
    // o livro diz, literal, que ela "não conta para o seu número de truques
    // conhecidos" -- o contador tem de ficar "3 / 3".
    const { page } = await abrirFicha(context, {
      classe: 'Mago',
      nivel: 3,
      xp: 355000,
      subclasse: 'Ilusionista',
      atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Arcanismo', 'História'],
      magias_conhecidas: [
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
        { nome: 'Raio de Gelo', circulo: 0 },
        { nome: 'Ilusão Menor', circulo: 0, origem: 'subclasse_automatica' },
      ],
    });

    expect(await contadorTruques(page),
      'o truque automático da subclasse foi cobrado do orçamento').toBe('3 / 3');
    expect(await classesContador(page),
      'o contador ficou marcado como excedido').not.toContain('contador-excedido');
  });

test('ficha: Mãos Mágicas do Trapaceiro Arcano CONTINUA contando no limite',
  async ({ context }) => {
    // O contrapeso. O livro põe Mãos Mágicas DENTRO dos três truques do
    // Trapaceiro Arcano, então `subclasse_fixa` conta -- se a correção
    // excluir esta origem junto com as outras, o jogador ganha um truque
    // a mais de graça e ninguém percebe.
    const { page } = await abrirFicha(context, {
      classe: 'Ladino',
      nivel: 3,
      xp: 355000,
      subclasse: 'Trapaceiro Arcano',
      atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Furtividade', 'História'],
      magias_conhecidas: [
        { nome: 'Mãos Mágicas', circulo: 0, origem: 'subclasse_fixa' },
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
      ],
    });

    expect(await contadorTruques(page),
      'Mãos Mágicas do Trapaceiro Arcano saiu da conta dos três truques').toBe('3 / 3');
  });

// ============================================================
// TRUQUE PERSONALIZADO GASTA VAGA DO ORÇAMENTO DA CLASSE.
//
// Decisão do dono do produto, registrada em docs/PERGUNTAS-PENDENTES.txt
// ("MAGIA CUSTOMIZADA DEVE GASTAR VAGA DO ORCAMENTO DA CLASSE?"): o app
// respondia a MESMA pergunta de dois jeitos -- a magia de círculo
// personalizada sempre contou no limite de preparadas, e o truque
// personalizado saía de graça. Alinha o truque à magia.
//
// POR QUE ESTES ORÁCULOS SÃO DE TELA, e não só de unidade: o motor
// (`truquesQueContamNoLimite`, medido por unidade em
// testes/regras/unidade/truques-limite-origem.test.mjs) sempre soube
// responder -- eram os dois CHAMADORES que excluíam o truque
// personalizado, cada um do seu jeito, e as duas telas
// já divergiram em silêncio por regra de contagem copiada à mão (ver o
// Oráculo 4g de testes/regras/unidade/multiclasse-magias-grimorio.test.mjs).
// Por isso cada cenário abaixo lê a ficha E abre o modal "+ Magia".
// ============================================================

// dados/classes/mago.json, nível 3: Truques "3". Medido do arquivo.
const MAGO_3_TRUQUES = 3;

/** Truque que o jogador inventou no formulário "Magia Personalizada" (círculo 0). */
const TRUQUE_PERSONALIZADO = {
  nome: 'Fagulha de Nimb', circulo: 0, escola: 'Evocação',
  tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V',
  duracao: 'Instantânea', descricao: 'Uma fagulha azul que o jogador inventou.',
  dano: '1d4 de fogo', ritual: false,
};

const MAGO_3 = {
  classe: 'Mago', subclasse: '', nivel: 3, xp: 900,
  atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
};

test('ficha e "+ Magia": o truque personalizado gasta vaga, e as duas telas mostram o MESMO número',
  async ({ context }) => {
    // Dois truques do livro + um personalizado = as três vagas do Mago 3.
    const { page, erros } = await abrirFicha(context, {
      ...MAGO_3,
      magias_conhecidas: [
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
      ],
      magias_customizadas: [TRUQUE_PERSONALIZADO],
    }, 'regras-truque-custom-conta');

    // GUARDA CONTRA VACUIDADE: sem a seção de Magias (e sem o botão que
    // abre o modal) não há duas telas para confrontar.
    await expect(page.locator('#btn-add-magia'),
      'a seção de Magias não foi montada -- sem ela o cenário não mede nada')
      .toBeVisible({ timeout: 10_000 });

    const ficha = await contadorTruquesFicha(page);
    expect(ficha, 'não achei o contador "Truques N / M" na seção Magias da ficha').not.toBeNull();
    expect(ficha.atual,
      'o truque que o jogador inventou tem de gastar vaga do orçamento da classe, como a magia de '
      + 'círculo personalizada dele já gasta. Se vier 2, o truque personalizado continua de graça.')
      .toBe(3);
    expect(ficha.limite, 'o limite deveria ser o do Mago nível 3').toBe(MAGO_3_TRUQUES);

    await abrirGerenciarMagias(page);

    const modal = await contadorTruquesModal(page);
    expect(modal, 'não achei o contador de truques (#gm-contador-truques) no modal').not.toBeNull();
    expect(modal.atual,
      'o modal "+ Magia" tem de contar o truque personalizado igual à ficha -- ele lia SÓ '
      + 'char.magias_conhecidas, onde o truque personalizado nunca mora')
      .toBe(ficha.atual);
    expect(modal.limite, 'o modal e a ficha têm de mostrar o MESMO limite').toBe(ficha.limite);

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });

test('ficha: o truque personalizado aparece UMA vez só na seção de Truques, e abre a descrição dele',
  async ({ context }) => {
    // A ARMADILHA desta mudança. `truquesClasse` fazia dupla função --
    // contava E renderizava --, e o truque personalizado JÁ é desenhado à
    // parte por `renderLinhaMagiaPersonalizada`. Fazer o mesmo conjunto
    // servir às duas perguntas duplicaria a linha na tela, e a segunda
    // cópia sairia com `data-magia-nome`: o clique cairia no handler
    // genérico, que procura a descrição no acervo do livro, onde a magia
    // do jogador não está -- a forma exata da issue #39.
    const { page, erros } = await abrirFicha(context, {
      ...MAGO_3,
      magias_conhecidas: [
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
      ],
      magias_customizadas: [TRUQUE_PERSONALIZADO],
    }, 'regras-truque-custom-uma-linha');

    const truques = page.locator('#details-truques');
    await expect(truques, 'a seção de Truques da ficha não foi montada -- nada a medir')
      .toHaveCount(1);

    // A seção nasce COLAPSADA (`_truquesColapsados = true`, sheet/colapso.js):
    // o Playwright não clica no que está escondido, e "está escondido" não é
    // o que este oráculo mede.
    await truques.locator('summary').first().click();
    await expect(truques.locator('.magia-item').first(),
      'a seção de Truques não abriu -- sem ela aberta o clique abaixo não mede nada')
      .toBeVisible();

    const linha = truques.locator('.magia-item', { hasText: TRUQUE_PERSONALIZADO.nome });
    await expect(linha,
      'o truque personalizado tem de aparecer UMA vez só na seção de Truques. Duas linhas '
      + 'significam que o conjunto que CONTA voltou a ser o mesmo que DESENHA.')
      .toHaveCount(1);

    // A linha que sobrou tem de ser a personalizada (por índice), não uma
    // cópia genérica: é o atributo que decide qual handler de descrição o
    // clique aciona.
    await expect(truques.locator('.magia-item[data-magia-custom-index][data-magia-circ="0"]'),
      'a linha do truque personalizado tem de sair com data-magia-custom-index -- com '
      + 'data-magia-nome o clique cai no handler do acervo e a descrição abre vazia (issue #39)')
      .toHaveCount(1);

    const descricao = linha.locator('.magia-desc');
    await expect(descricao, 'a descrição não pode estar visível antes do clique').toBeHidden();

    // O clique é o que prova que não é só cosmético: sem ele, "existe uma
    // linha" passaria numa linha que não abre nada.
    await linha.locator('.magia-nome').click();
    await expect(descricao,
      'clicar no truque personalizado tem de abrir a descrição que o jogador escreveu')
      .toBeVisible();
    await expect(descricao, 'a descrição exibida tem de ser a da magia personalizada, não vazia')
      .toContainText(TRUQUE_PERSONALIZADO.descricao);

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });

test('ficha: com o orçamento já cheio, o truque personalizado leva o contador ACIMA do limite, em vermelho',
  async ({ context }) => {
    // A CONSEQUÊNCIA QUE É PARA ACONTECER, e não para ser suavizada: quem
    // já tinha um truque personalizado passa a contar um a mais e pode
    // aparecer acima do limite. Nada é removido da ficha -- o jogador só
    // vê que está acima, e não pega mais um truque da classe até resolver.
    const { page, erros } = await abrirFicha(context, {
      ...MAGO_3,
      magias_conhecidas: [
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
        { nome: 'Raio de Gelo', circulo: 0 },
      ],
      magias_customizadas: [TRUQUE_PERSONALIZADO],
    }, 'regras-truque-custom-excedido');

    // GUARDA CONTRA VACUIDADE: a seção de Magias precisa ter sido montada
    // antes de qualquer leitura do contador -- lida cedo demais, ela
    // devolve `null` e a asserção falharia por corrida, não por regra.
    await expect(page.locator('#btn-add-magia'),
      'a seção de Magias não foi montada -- sem ela não há contador para medir')
      .toBeVisible({ timeout: 10_000 });

    const ficha = await contadorTruquesFicha(page);
    expect(ficha, 'não achei o contador "Truques N / M" na seção Magias da ficha').not.toBeNull();
    expect(ficha.atual,
      'três truques do livro + um personalizado = 4 vagas gastas contra o limite de 3')
      .toBe(MAGO_3_TRUQUES + 1);
    expect(ficha.classes,
      'acima do limite o contador tem de ficar vermelho (contador-excedido) -- é o estado que o '
      + 'app já tem para isto, e a decisão do dono do produto é que ele apareça')
      .toContain('contador-excedido');

    // E nada foi apagado da ficha por causa da mudança de regra.
    const truques = page.locator('#details-truques');
    await expect(truques.locator('.magia-item'),
      'nenhum truque pode sumir da ficha: 3 do livro + 1 personalizado continuam desenhados')
      .toHaveCount(4);

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });

test('multiclasse (Clérigo 5/Mago 1): o truque personalizado conta nas duas telas também com mais de uma superfície',
  async ({ context }) => {
    // Com DUAS superfícies de conjuração a tela muda de forma: o seletor
    // de classe aparece e as guardas `superficies.length <= 1` /
    // `umaSuperficieSo` desligam o alarme de excedido e o bloqueio do
    // modal. A CONTAGEM, porém, é do personagem inteiro e não depende
    // disso -- semear só classe única deixaria este caminho sem oráculo.
    const { page, erros } = await abrirFicha(context, {
      classe: 'Clérigo', subclasse: '', nivel: 6, xp: 14000,
      especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Religião', 'Intuição'],
      classes: [
        { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
        { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
      ],
      schema_versao: 2,
      magias_conhecidas: [
        { nome: 'Chama Sagrada', circulo: 0 },
        { nome: 'Luz', circulo: 0 },
      ],
      magias_customizadas: [TRUQUE_PERSONALIZADO],
    }, 'regras-truque-custom-multiclasse');

    // GUARDA CONTRA VACUIDADE: sem as duas superfícies este cenário seria
    // só mais um teste de classe única com outro nome.
    await expect(page.locator('#tabs-superficie-magia'),
      'Clérigo 5/Mago 1 tem duas superfícies de conjuração -- o seletor de classe precisa aparecer, '
      + 'senão o cenário não é o de multiclasse')
      .toBeVisible({ timeout: 10_000 });

    // O QUE MUDOU AQUI, e por quê. Este oráculo afirmava `ficha.atual === 3`
    // -- "a contagem de truques é do personagem inteiro". Essa contagem
    // global era exatamente o defeito relatado depois ("Mago e clérigo,
    // deixando selecionar quantos truques quiser"): os truques de uma
    // classe gastavam o orçamento da outra, e a saída da época foi
    // DESLIGAR a trava em multiclasse -- 16 truques com limite 4, medido.
    //
    // O que continua valendo, e o que este teste protege: (1) as duas
    // telas nunca discordam do número, e (2) o truque personalizado não é
    // de graça. O que mudou é ONDE ele aparece: com DUAS superfícies e
    // nenhum carimbo de classe, o app não sabe de quem é o truque, então
    // ele entra como INCERTEZA VISÍVEL em vez de ser cobrado em silêncio
    // do orçamento da classe ativa. Com uma superfície só (o teste irmão,
    // acima) nada mudou: sem ambiguidade possível, o truque é dela e conta.
    const ficha = await contadorTruquesFicha(page);
    expect(ficha, 'não achei o contador "Truques N / M" na seção Magias da ficha').not.toBeNull();
    expect(ficha.atual,
      'nenhum dos três truques está carimbado com uma classe, e o personagem tem duas superfícies '
      + '-- nenhum deles pode ser cobrado do orçamento do Clérigo por chute')
      .toBe(0);

    // A incerteza tem de estar NA TELA: sem isto o contador mentiria por
    // omissão, dizendo "0 gastos" como se o orçamento estivesse livre.
    const semClasseFicha = page.locator('#ficha-contador-truques-sem-classe');
    await expect(semClasseFicha,
      'os truques sem classe têm de aparecer na ficha, não sumir da conta')
      .toBeVisible();
    await expect(semClasseFicha,
      'são três truques sem carimbo: dois do livro e o personalizado')
      .toContainText('3');

    await abrirGerenciarMagias(page);

    const modal = await contadorTruquesModal(page);
    expect(modal, 'não achei o contador de truques (#gm-contador-truques) no modal').not.toBeNull();
    expect(modal.atual, 'o modal "+ Magia" tem de mostrar o MESMO número de truques gastos que a ficha')
      .toBe(ficha.atual);
    expect(modal.limite, 'o modal e a ficha têm de mostrar o MESMO limite (o da superfície ativa)')
      .toBe(ficha.limite);
    await expect(page.locator('#gm-contador-truques-sem-classe'),
      'o modal tem de mostrar a MESMA incerteza que a ficha')
      .toContainText('3');

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });

test('multiclasse: o truque CARIMBADO com a classe ativa conta no orçamento dela',
  async ({ context }) => {
    // O complemento do teste acima: com carimbo não há incerteza nenhuma, e
    // o truque volta a ser cobrado -- inclusive o personalizado continua
    // fora de qualquer isenção, ele só não tem como ser atribuído sozinho.
    const { page, erros } = await abrirFicha(context, {
      classe: 'Clérigo', subclasse: '', nivel: 6, xp: 14000,
      especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Religião', 'Intuição'],
      classes: [
        { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
        { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
      ],
      schema_versao: 2,
      magias_conhecidas: [
        { nome: 'Chama Sagrada', circulo: 0, classe: 'Clérigo' },
        { nome: 'Luz', circulo: 0, classe: 'Clérigo' },
        { nome: 'Raio de Gelo', circulo: 0, classe: 'Mago' },
      ],
    }, 'regras-truque-carimbado-multiclasse');

    await expect(page.locator('#tabs-superficie-magia'),
      'o cenário precisa ser mesmo o de multiclasse').toBeVisible({ timeout: 10_000 });

    const ficha = await contadorTruquesFicha(page);
    expect(ficha, 'não achei o contador "Truques N / M" na seção Magias da ficha').not.toBeNull();
    expect(ficha.atual,
      'a superfície ativa é a do Clérigo: só os dois truques dele contam, e o do Mago não')
      .toBe(2);
    await expect(page.locator('#ficha-contador-truques-sem-classe'),
      'com tudo carimbado não há incerteza para mostrar')
      .toHaveCount(0);

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });
