// ============================================================
// Issue #46: a magia customizada de círculo 1+ é SEMPRE preparada.
//
// Antes desta issue ela nascia "Não preparada" num acordeão com editar e
// remover, e só virava conjurável depois de um clique em "Preparar" na
// grade do modal (issues #27/#33). Agora ela é derivada: a ficha a desenha
// na seção Preparadas, no círculo dela, sem clique nenhum -- e sem entrar
// no "N / M".
//
// LÊ A TELA E O PERSONAGEM SALVO: é a AUSÊNCIA de gravação em
// `magias_preparadas` que esta mudança produz, e só a leitura do store mede
// isso. Uma asserção só de DOM passaria também se a ficha tivesse gravado a
// entrada por trás.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, personagemSalvo } from './helpers-regras.mjs';

const MAGIA_CUSTOM = {
  nome: 'Névoa de Nimb', circulo: 1, escola: 'Adivinhação',
  tempo_conjuracao: 'Ação', alcance: '18 metros', componentes: 'V, S',
  duracao: 'Instantânea', descricao: 'Uma névoa que o jogador inventou.',
  ritual: false,
};

// dados/classes/clerigo.json, nível 3. Classe de magias PREPARADAS, sem
// grimório -- o caso mais simples em que o "N / M" existe.
const CLERIGO_3 = {
  classe: 'Clérigo', subclasse: '', nivel: 3, xp: 900,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Religião', 'Medicina'],
};

test('a customizada de círculo é conjurável sem nenhum clique de preparo',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      ...CLERIGO_3,
      magias_preparadas: [{ nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' }],
      magias_customizadas: [MAGIA_CUSTOM],
    }, 'regras-issue46-custom-preparada');

    // GUARDA CONTRA VACUIDADE: sem a seção de Magias não há o que medir.
    await expect(page.locator('#btn-add-magia')).toBeVisible();

    const linha = page.locator('.magia-personalizada', { hasText: 'Névoa de Nimb' });
    await expect(linha, 'a customizada tem de estar desenhada na ficha').toHaveCount(1);
    await expect(linha.locator('[data-conjurar-magia-custom]'),
      'sem clique de preparo nenhum, ela já tem o botão Conjurar -- é o que '
      + '"SEMPRE PREPARADA" quer dizer').toHaveCount(1);
    await expect(page.getByText('Não preparada'),
      'o estado "Não preparada" deixou de existir para magia customizada').toHaveCount(0);

    const salvo = await personagemSalvo(page);
    expect((salvo.magias_preparadas || []).map(m => m.nome),
      'ela é DERIVADA: renderizar não pode gravar entrada em magias_preparadas')
      .toEqual(['Curar Ferimentos']);

    expect(erros, 'nenhum erro de console').toEqual([]);
  });

test('a customizada de círculo não entra no contador de preparadas',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      ...CLERIGO_3,
      magias_preparadas: [{ nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' }],
      magias_customizadas: [MAGIA_CUSTOM],
    }, 'regras-issue46-custom-fora-do-contador');

    await expect(page.locator('#btn-add-magia')).toBeVisible();

    const contador = page.locator('.magia-contador')
      .filter({ hasText: 'Magias Preparadas' }).first();
    const valor = (await contador.locator('.contador-valor').innerText()).trim();
    const [atual] = valor.split('/').map(s => s.trim());

    expect(atual,
      'só "Curar Ferimentos" gasta vaga. Se vier 2, a customizada voltou a cobrar '
      + 'do orçamento -- a issue #46 do lado das magias de círculo').toBe('1');

    expect(erros, 'nenhum erro de console').toEqual([]);
  });

test('o chip "Personalizadas" explica por que ela ficou fora da conta',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      ...CLERIGO_3,
      magias_preparadas: [{ nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' }],
      magias_customizadas: [MAGIA_CUSTOM],
    }, 'regras-issue46-chip-personalizada');

    await expect(page.locator('#btn-add-magia')).toBeVisible();

    const chip = page.locator('.magia-contador').filter({ hasText: 'Personalizadas' });
    await expect(chip,
      'sem sinal na tela, "meu truque sumiu da conta" vira a próxima issue').toHaveCount(1);
    await expect(chip.locator('.contador-valor')).toHaveText('1');

    expect(erros, 'nenhum erro de console').toEqual([]);
  });

// Truques do livro que existem em dados/magias/truques.json para o Clérigo.
const TRUQUES_DO_LIVRO = ['Chama Sagrada', 'Luz', 'Orientação'];

test('nenhuma linha some nem duplica: os truques do livro e a customizada convivem na seção Magias',
  async ({ context }) => {
    // POR QUE ESTE CENÁRIO EXISTE.
    //
    // A issue #46 FUNDE duas listas no mesmo balde: as entradas de
    // `magias_preparadas` e as customizadas derivadas de
    // `char.magias_customizadas` passam a ser empurradas juntas para
    // `preparadasPorCirculo`. Fusão de listas é exatamente o tipo de
    // mudança cujo erro típico não é exceção nem tela em branco -- é item
    // que SOME (um filtro que ficou largo demais e engoliu as do livro) ou
    // item que aparece DUAS vezes (a customizada entrando pelo caminho
    // novo sem sair do antigo, a forma exata da issue #39).
    //
    // Nada mais na suíte mede isso desde que a Task 1 substituiu o cenário
    // que carregava a única guarda de "nenhum truque pode sumir da ficha"
    // (`.magia-item` com `toHaveCount(4)`, em
    // truques-contador-origens.spec.mjs). Os outros cenários deste arquivo
    // olham SÓ a linha personalizada: todos passariam com os truques do
    // livro apagados da tela.
    //
    // Os dois lados da fusão são distinguíveis por seletor: a linha do
    // livro sai com `data-magia-nome` (handler do acervo), a personalizada
    // com `data-magia-custom-index` e a classe `magia-personalizada`
    // (handler que lê `char.magias_customizadas`).
    const { page, erros } = await abrirFicha(context, {
      ...CLERIGO_3,
      magias_conhecidas: TRUQUES_DO_LIVRO.map(nome => ({ nome, circulo: 0 })),
      magias_preparadas: [{ nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' }],
      magias_customizadas: [MAGIA_CUSTOM],
    }, 'regras-issue46-nada-some-nada-duplica');

    // GUARDA CONTRA VACUIDADE: sem a seção de Magias não há o que medir.
    await expect(page.locator('#btn-add-magia')).toBeVisible();
    const secaoMagias = page.locator('.card').filter({ has: page.locator('#btn-add-magia') });

    // --- Lado do LIVRO: os três truques continuam desenhados, um cada ---
    const truques = page.locator('#details-truques');
    await expect(truques, 'a seção de Truques não foi montada -- nada a medir').toHaveCount(1);
    await expect(truques.locator('.magia-item'),
      'os três truques do livro têm de continuar desenhados. Menos que isso é linha '
      + 'que SUMIU na fusão das listas; mais que isso é linha DUPLICADA')
      .toHaveCount(TRUQUES_DO_LIVRO.length);
    for (const nome of TRUQUES_DO_LIVRO) {
      await expect(truques.locator('.magia-item', { hasText: nome }),
        `"${nome}" tem de aparecer exatamente uma vez na seção de Truques`)
        .toHaveCount(1);
    }

    // --- Lado do CÍRCULO: a do livro e a customizada, lado a lado ---
    const circulo1 = page.locator('[data-details-id="magias-circulo-1"]');
    await expect(circulo1, 'o bloco do 1º Círculo não foi montado -- nada a medir').toHaveCount(1);
    await expect(circulo1.locator('.magia-item'),
      'o 1º Círculo tem de ter DUAS linhas: "Curar Ferimentos" (do livro, por '
      + 'magias_preparadas) e "Névoa de Nimb" (derivada de magias_customizadas). '
      + 'A fusão não pode fazer uma delas sumir por causa da outra')
      .toHaveCount(2);
    await expect(circulo1.locator('.magia-item[data-magia-nome="Curar Ferimentos"]'),
      'a magia do livro tem de sair com data-magia-nome -- é o atributo que leva o '
      + 'clique ao handler do acervo').toHaveCount(1);
    await expect(circulo1.locator('.magia-personalizada[data-magia-custom-index]'),
      'a customizada tem de sair com data-magia-custom-index -- com data-magia-nome o '
      + 'clique cai no handler do acervo e a descrição abre vazia (issue #39)')
      .toHaveCount(1);

    // --- Nenhuma duplicata em NENHUM lugar da seção ---
    await expect(secaoMagias.locator('.magia-item', { hasText: 'Névoa de Nimb' }),
      'a customizada tem de aparecer UMA vez só na seção Magias inteira. Duas linhas '
      + 'significam que ela entrou pelo caminho novo sem sair do antigo (o acordeão '
      + '"Magias Customizadas", removido nesta issue)')
      .toHaveCount(1);
    await expect(secaoMagias.locator('.magia-item[data-magia-custom-index]'),
      'só a "Névoa de Nimb" é personalizada nesta ficha -- qualquer outra linha com '
      + 'data-magia-custom-index é cópia').toHaveCount(1);

    expect(erros, 'nenhum erro de console').toEqual([]);
  });

test('o botão da seção Magias diz "Preparar Magias"', async ({ context }) => {
  // ATÉ A #46 o botão se chamava "+ Magia" e abria um modal chamado
  // "Gerenciar Magias" -- os dois nomes prometiam CADASTRO. Os dois nomes
  // antigos estão citados aqui de propósito, no passado: é a única menção
  // que deve sobreviver a esta troca de rótulo, porque é ela que explica
  // POR QUE o rótulo mudou. Depois da #46 a magia que o jogador inventa
  // não passa mais por ali (ela é derivada de
  // char.magias_customizadas), e o que sobrou na tela é exatamente uma
  // coisa: preparar magia do livro. O rótulo passa a dizer isso, no botão
  // e no título do modal.
  const { page, erros } = await abrirFicha(context, {
    ...CLERIGO_3,
    magias_preparadas: [{ nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' }],
  }, 'regras-issue46-rotulo-botao');

  const botao = page.locator('#btn-add-magia');
  await expect(botao, 'o id não muda -- é seletor de e2e; só o rótulo muda').toBeVisible();
  await expect(botao).toHaveText('Preparar Magias');

  await botao.click();
  // Mede o TÍTULO do modal (#modal-titulo), não um getByText solto: o
  // próprio botão também casa com o texto, e um seletor de página inteira
  // passaria verde com o título do modal ainda no nome antigo.
  await expect(page.locator('#modal-titulo'),
    'o título do modal acompanha o botão que o abre').toHaveText('Preparar Magias');

  expect(erros, 'nenhum erro de console').toEqual([]);
});

// ============================================================
// OS DOIS SINAIS DO TRUQUE PERSONALIZADO NA TELA.
//
// POR QUE ESTES DOIS CENÁRIOS EXISTEM: o truque personalizado deixou de
// gastar vaga, e o contador de quem já tinha um vai CAIR sozinho na
// primeira abertura da ficha. Sem um sinal dizendo "ele continua aqui, só
// não custa mais vaga", "meu truque sumiu da conta" vira a próxima issue
// -- é o mesmo argumento que fez o chip das magias de círculo
// ("Personalizadas", acima) ganhar oráculo.
//
// O lado do TRUQUE nasceu sem oráculo nenhum: apagar o chip e o segmento
// do resumo de sheet/magias.js deixava a suíte INTEIRA verde, e nenhum
// arquivo de testes/ mencionava qualquer um dos dois textos. Assimetria
// difícil de justificar, porque o truque é justamente o lado do relato
// original da #46 -- o jogador viu a ficha acusar "truques demais" por um
// truque que ele mesmo inventou.
// ============================================================

/** Truque que o jogador inventou no formulário "Magia Personalizada" (círculo 0). */
const TRUQUE_CUSTOM = {
  nome: 'Fagulha de Nimb', circulo: 0, escola: 'Evocação',
  tempo_conjuracao: 'Ação', alcance: '9 metros', componentes: 'V',
  duracao: 'Instantânea', descricao: 'Uma fagulha azul que o jogador inventou.',
  dano: '1d4 de fogo', ritual: false,
};

// dados/classes/clerigo.json, nível 3: Truques "3". Medido do arquivo.
const CLERIGO_3_TRUQUES = 3;

// Dois truques do livro que existem em dados/magias/truques.json para o
// Clérigo. Sem carimbo de classe, e com UMA classe só não há dúvida
// possível: os dois gastam vaga do Clérigo.
const DOIS_TRUQUES_DO_LIVRO = [
  { nome: 'Luz', circulo: 0 },
  { nome: 'Orientação', circulo: 0 },
];

test('o chip "Truques Personalizados" mostra o truque que saiu da conta',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      ...CLERIGO_3,
      magias_conhecidas: DOIS_TRUQUES_DO_LIVRO,
      magias_customizadas: [TRUQUE_CUSTOM],
    }, 'regras-issue46-chip-truque-personalizado');

    // GUARDA CONTRA VACUIDADE: sem a seção de Magias não há o que medir.
    await expect(page.locator('#btn-add-magia')).toBeVisible();

    const chip = page.locator('.magia-contador').filter({ hasText: 'Truques Personalizados' });
    await expect(chip,
      'o truque personalizado saiu do "N / M": sem um chip dizendo que ele existe e '
      + 'está fora da conta, o jogador lê o contador caindo como truque perdido')
      .toHaveCount(1);
    await expect(chip.locator('.contador-valor'),
      'o chip tem de contar os truques personalizados desta ficha -- é 1 aqui')
      .toHaveText('1');

    expect(erros, 'nenhum erro de console').toEqual([]);
  });

test('o resumo da seção de Truques declara o "+ N personalizado" ao lado do limite',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      ...CLERIGO_3,
      magias_conhecidas: DOIS_TRUQUES_DO_LIVRO,
      magias_customizadas: [TRUQUE_CUSTOM],
    }, 'regras-issue46-resumo-truque-personalizado');

    // GUARDA CONTRA VACUIDADE: sem a seção de Magias não há o que medir.
    await expect(page.locator('#btn-add-magia')).toBeVisible();

    const resumo = page.locator('#details-truques > summary');
    await expect(resumo, 'a seção de Truques não foi montada -- nada a medir').toHaveCount(1);
    // O "2 / 3" e o "+ 1 personalizado" na MESMA asserção de propósito: o
    // que o jogador precisa entender é que os três truques da ficha viram
    // "2 de 3, mais um que não custa vaga". Medir só o segmento deixaria
    // passar um limite que voltou a cobrar o personalizado.
    await expect(resumo,
      'o cabeçalho de Truques tem de mostrar as vagas gastas (2 de 3, sem o '
      + 'personalizado) E declarar o personalizado à parte. Se vier "3 / 3", ele '
      + 'voltou a ser cobrado do orçamento da classe')
      .toHaveText(`Truques (2 / ${CLERIGO_3_TRUQUES} + 1 personalizado)`);

    expect(erros, 'nenhum erro de console').toEqual([]);
  });
