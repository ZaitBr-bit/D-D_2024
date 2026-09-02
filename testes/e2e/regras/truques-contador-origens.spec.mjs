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
 * `.magia-contadores` escopa à FICHA: o modal "Preparar Magias" também
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
 * MODAL "Preparar Magias", que os cenários abaixo abrem: com o modal
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

/** `{ atual, limite }` do contador de truques do topo do modal "Preparar Magias". */
async function contadorTruquesModal(page) {
  const texto = await page.locator('#gm-contador-truques').textContent().catch(() => null);
  const m = texto?.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { atual: Number(m[1]), limite: Number(m[2]) } : null;
}

/**
 * Abre o modal "Preparar Magias" pelo botão de mesmo nome e espera a grade
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

test('ficha: acima do limite o contador de truques fica vermelho (contador-excedido)',
  async ({ context }) => {
    // A AFIRMAÇÃO POSITIVA DO ALARME, e por que ela precisa existir: todos
    // os outros cenários deste arquivo dizem `not.toContain('contador-excedido')`
    // -- eles provam que o alarme não dispara à toa, e nenhum prova que ele
    // dispara. Só com negativas, apagar o ramo que aplica a classe em
    // `sheet/magias.js` deixaria a suíte inteira verde, e as próprias
    // negativas passariam a valer por vacuidade. Este é o oráculo que
    // quebra se o alarme sumir.
    //
    // SÓ TRUQUES DO LIVRO, nenhum personalizado, de propósito: a issue #46
    // tirou o truque personalizado do orçamento da classe, e as tarefas
    // seguintes ainda mexem no render e na magia personalizada. Um oráculo
    // do ALARME não pode depender de nenhum dos dois -- quatro truques da
    // tabela contra o limite de 3 do Mago nível 3 estouram por aritmética
    // simples, e isso não muda mais.
    const { page, erros } = await abrirFicha(context, {
      classe: 'Mago',
      nivel: 3,
      xp: 900,
      atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Arcanismo', 'História'],
      magias_conhecidas: [
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
        { nome: 'Raio de Gelo', circulo: 0 },
        { nome: 'Mensagem', circulo: 0 },
      ],
    }, 'regras-contador-excedido-livro');

    // GUARDA CONTRA VACUIDADE: sem a seção de Magias não há contador para
    // medir, e a leitura devolveria `null` por corrida, não por regra.
    await expect(page.locator('#btn-add-magia'),
      'a seção de Magias não foi montada -- sem ela não há contador para medir')
      .toBeVisible({ timeout: 10_000 });

    expect(await contadorTruques(page),
      'quatro truques da tabela contra o limite de 3 do Mago nível 3')
      .toBe('4 / 3');

    expect(await classesContador(page),
      'acima do limite o contador TEM de ganhar a classe contador-excedido -- é o vermelho '
      + 'que o jogador vê, e é o estado que os demais cenários deste arquivo só sabem negar')
      .toContain('contador-excedido');

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });

// ============================================================
// TRUQUE PERSONALIZADO NÃO GASTA VAGA DO ORÇAMENTO DA CLASSE -- issue #46.
//
// Decisão do dono do produto de 2026-09-02, que REVERTE a decisão anterior
// (registrada em docs/PERGUNTAS-PENDENTES.txt sob "MAGIA CUSTOMIZADA DEVE
// GASTAR VAGA DO ORCAMENTO DA CLASSE?"). A regra antiga -- "vaga é vaga,
// venha de onde vier" -- existia para acabar com uma incoerência real: o
// app cobrava vaga da magia homebrew de círculo e dava o truque homebrew
// de graça, sem razão escrita para a diferença. A #46 mantém a coerência e
// inverte o lado: as duas saem de graça, e as duas nascem preparadas. O
// jogador que reportou via a ficha acusar "truques demais" por um truque
// que ele mesmo inventou.
//
// POR QUE ESTES ORÁCULOS SÃO DE TELA, e não só de unidade: o motor
// (`truquesQueContamNoLimite`, medido por unidade em
// testes/regras/unidade/truques-limite-origem.test.mjs) responde por si,
// mas quem o jogador vê é o CONTADOR -- e as duas telas que o desenham (a
// seção Magias da ficha e o modal "Preparar Magias") já divergiram em silêncio por
// regra de contagem copiada à mão (ver o Oráculo 4g de
// testes/regras/unidade/multiclasse-magias-grimorio.test.mjs). Por isso
// cada cenário abaixo lê a ficha E abre o modal "Preparar Magias".
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

test('ficha e "Preparar Magias": o truque personalizado NÃO gasta vaga, e as duas telas mostram o MESMO número',
  async ({ context }) => {
    // Dois truques do livro + um personalizado = duas das três vagas do
    // Mago 3. A terceira continua livre: o personalizado não sai daqui.
    const { page, erros } = await abrirFicha(context, {
      ...MAGO_3,
      magias_conhecidas: [
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
      ],
      magias_customizadas: [TRUQUE_PERSONALIZADO],
    }, 'regras-truque-custom-nao-conta');

    // GUARDA CONTRA VACUIDADE: sem a seção de Magias (e sem o botão que
    // abre o modal) não há duas telas para confrontar.
    await expect(page.locator('#btn-add-magia'),
      'a seção de Magias não foi montada -- sem ela o cenário não mede nada')
      .toBeVisible({ timeout: 10_000 });

    const ficha = await contadorTruquesFicha(page);
    expect(ficha, 'não achei o contador "Truques N / M" na seção Magias da ficha').not.toBeNull();
    expect(ficha.atual,
      'o truque que o jogador inventou não pode gastar vaga do orçamento da classe (issue #46). '
      + 'Se vier 3, o personalizado voltou a ser cobrado.')
      .toBe(2);
    expect(ficha.limite, 'o limite deveria ser o do Mago nível 3').toBe(MAGO_3_TRUQUES);

    await abrirGerenciarMagias(page);

    const modal = await contadorTruquesModal(page);
    expect(modal, 'não achei o contador de truques (#gm-contador-truques) no modal').not.toBeNull();
    expect(modal.atual,
      'o modal "Preparar Magias" tem de mostrar o MESMO número que a ficha -- as duas telas já '
      + 'divergiram por contagem copiada à mão')
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

test('issue #46: 3 truques do livro + 1 personalizado NÃO estoura o limite do Mago 3',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      ...MAGO_3,
      magias_conhecidas: [
        { nome: 'Luz', circulo: 0 },
        { nome: 'Prestidigitação', circulo: 0 },
        { nome: 'Raio de Gelo', circulo: 0 },
      ],
      magias_customizadas: [TRUQUE_PERSONALIZADO],
    }, 'regras-issue46-truque-nao-estoura');

    await expect(page.locator('#btn-add-magia'),
      'sem a seção de Magias não há contador para medir').toBeVisible();

    expect(await contadorTruques(page),
      'o truque que o jogador inventou não pode entrar no orçamento da classe (issue #46)')
      .toBe(`${MAGO_3_TRUQUES} / ${MAGO_3_TRUQUES}`);

    const classes = await classesContador(page);
    expect(classes,
      'com 3 de 3 o contador fica "cheio", nunca "excedido" -- era o aviso de '
      + '"truques demais" do relato').not.toContain('contador-excedido');

    expect(erros, 'nenhum erro de console').toEqual([]);
  });

test('multiclasse (Clérigo 5/Mago 1): as duas telas concordam, e o personalizado fica fora da conta',
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
    // O que este teste protege, e continua valendo: as duas telas nunca
    // discordam do número. Os truques do LIVRO sem carimbo, com DUAS
    // superfícies, não podem ser cobrados do orçamento da classe ativa por
    // chute -- eles entram como INCERTEZA VISÍVEL.
    //
    // O truque PERSONALIZADO, desde a issue #46, não está nem numa conta
    // nem na outra: ele saiu do orçamento da classe, então não aparece nem
    // no contador nem na incerteza. Por isso o "sem classe" mostra 2 (os
    // dois do livro), e não 3.
    const ficha = await contadorTruquesFicha(page);
    expect(ficha, 'não achei o contador "Truques N / M" na seção Magias da ficha').not.toBeNull();
    expect(ficha.atual,
      'nenhum dos truques do livro está carimbado com uma classe, e o personagem tem duas '
      + 'superfícies -- nenhum deles pode ser cobrado do orçamento do Clérigo por chute')
      .toBe(0);

    // A incerteza tem de estar NA TELA: sem isto o contador mentiria por
    // omissão, dizendo "0 gastos" como se o orçamento estivesse livre.
    const semClasseFicha = page.locator('#ficha-contador-truques-sem-classe');
    await expect(semClasseFicha,
      'os truques sem classe têm de aparecer na ficha, não sumir da conta')
      .toBeVisible();
    await expect(semClasseFicha,
      'são dois truques do livro sem carimbo. O personalizado não entra aqui: desde a issue #46 '
      + 'ele não sai de orçamento nenhum, então não há incerteza sobre ele')
      .toContainText('2');

    await abrirGerenciarMagias(page);

    const modal = await contadorTruquesModal(page);
    expect(modal, 'não achei o contador de truques (#gm-contador-truques) no modal').not.toBeNull();
    expect(modal.atual, 'o modal "Preparar Magias" tem de mostrar o MESMO número de truques gastos que a ficha')
      .toBe(ficha.atual);
    expect(modal.limite, 'o modal e a ficha têm de mostrar o MESMO limite (o da superfície ativa)')
      .toBe(ficha.limite);
    await expect(page.locator('#gm-contador-truques-sem-classe'),
      'o modal tem de mostrar a MESMA incerteza que a ficha')
      .toContainText('2');

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });

test('multiclasse: o truque CARIMBADO com a classe ativa conta no orçamento dela',
  async ({ context }) => {
    // O complemento do teste acima: com carimbo não há incerteza nenhuma, e
    // o truque do LIVRO volta a ser cobrado do orçamento da sua classe. O
    // personalizado não aparece neste cenário porque, desde a issue #46,
    // ele não entra em orçamento nenhum -- carimbado ou não.
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
