// ============================================================
// Tarefa 5 (sub-projeto "magia sabe a classe", 2026-08-29) -- a ÚNICA prova,
// com o app rodando de verdade, de que o motor (site/js/regras-magia-classe.js,
// T1), os gravadores (os 8 sítios de T2 que carimbam `classe` em entradas
// novas de magias_preparadas[]), a migração (migrarMagiaClasse, T3) e os
// leitores (contadores, indicador "sem classe" e portões de bloqueio, T4)
// concordam. O teste de unidade não alcança nenhum dos gravadores nem dos
// leitores -- todos vivem em manipuladores de clique ou em template de HTML
// dentro de sheet/*.js, e T2 e T4 disseram isso com todas as letras nos seus
// relatórios.
//
// Contrato do campo (vale para todo cenário abaixo): a chave `classe` de uma
// entrada de magias_preparadas[] OU está ausente OU é uma string não vazia.
// Nunca `null`, `''` nem `undefined`.
//
// Leia testes/e2e/regras/multiclasse-seletor-magias.spec.mjs antes de mexer
// aqui -- é o spec irmão mais próximo (mesma tela, mesmo seletor de
// superfície #tabs-superficie-magia) e o cabeçalho dele explica a disciplina
// de `expect.poll` que este arquivo segue à risca: toda leitura de contador
// ou de personagem salvo é assíncrona por trás (render depois de um clique,
// ou uma migração que lê disco antes de decidir -- migrarMagiaClasse é a
// PRIMEIRA migração assíncrona do arquivo, ver o comentário dela em
// site/js/sheet/migracoes.js), e este projeto já foi mordido duas vezes por
// supor que uma leitura dessas era síncrona.
//
// ACHADO da escrita desta tarefa, não previsto no brief: T4 acrescentou um
// SEGUNDO indicador de incerteza além do badge "+N sem classe" ao lado do
// contador -- cada cartão da lista de preparadas por círculo (sheet/magias.js,
// renderSecaoMagias) ganhou um rótulo de classe próprio ("Clérigo", "Mago",
// ou "Sem classe conhecida"), visível só com MAIS de uma superfície de
// conjuração e só em magia não-especial (magia de domínio/talento/espécie
// continua mostrando a origem, não a classe). Os cenários 1 e 3 medem os
// dois indicadores, não só o contador.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar,
  clicarSeletorFicha, personagemSalvo,
} from './helpers-regras.mjs';

// ---------- Helpers locais ----------
//
// Nenhum destes é exportado por helpers-regras.mjs nem por nenhum spec
// irmão -- multiclasse-seletor-magias.spec.mjs e trocas-conjurador.spec.mjs
// têm cópias PRÓPRIAS de formas equivalentes (lerContadorFicha,
// abrirGerenciarMagias, o laço "avança até o card X aparecer"). Duplicar
// aqui, com o mesmo corpo, é a convenção já estabelecida neste diretório
// para helpers pequenos e específicos de UM spec -- importar de outro
// arquivo .spec.mjs seria mais estranho que replicar poucas linhas, e os
// helpers de verdade compartilhados (abrirFicha, clicarSeletorFicha etc.)
// já vivem em helpers-regras.mjs.

/**
 * Abre o modal "Gerenciar Magias" (botão "+ Magia") e espera a grade
 * existir -- `mostrarBuscaMagia` é async (carrega a lista de magias da
 * classe antes de montar o HTML), então esperar o elemento cobre essa
 * corrida em vez de um timeout fixo.
 */
async function abrirGerenciarMagias(page) {
  await page.click('#btn-add-magia');
  await page.waitForSelector('#resultado-magias', { state: 'visible', timeout: 20_000 });
  await assentar(page).catch(() => {});
}

/**
 * Lê "N / M" de um contador da seção Magias da ficha (fora do modal), pelo
 * rótulo exibido ("Truques", "Magias Preparadas"...). Os contadores não têm
 * id -- só o rótulo os distingue. `null` em vez de lançar, para uso dentro
 * de `expect.poll` (mesmo contrato do irmão desta suíte).
 */
async function lerContadorFicha(page, rotulo) {
  return page.evaluate((rotulo) => {
    const contadores = document.querySelectorAll('.magia-contadores .magia-contador');
    for (const c of contadores) {
      const label = c.querySelector('.contador-label')?.textContent?.trim();
      if (label !== rotulo) continue;
      const valor = c.querySelector('.contador-valor')?.textContent?.trim() || '';
      const m = valor.match(/(\d+)\s*\/\s*(\d+)/);
      return m ? { atual: Number(m[1]), limite: Number(m[2]) } : null;
    }
    return null;
  }, rotulo);
}

/**
 * Lê o valor "+N" do indicador "<rotulo> (sem classe)" ao lado de um
 * contador da ficha -- `null` quando o indicador não está no DOM (Tarefa 4:
 * ele só é renderizado quando numSemClasse > 0, não fica só escondido).
 */
async function lerIndicadorSemClasse(page, rotulo) {
  return page.evaluate((rotulo) => {
    const alvo = `${rotulo} (sem classe)`;
    const contadores = document.querySelectorAll('.magia-contadores .magia-contador');
    for (const c of contadores) {
      const label = c.querySelector('.contador-label')?.textContent?.trim();
      if (label !== alvo) continue;
      const valor = c.querySelector('.contador-valor')?.textContent?.trim() || '';
      const m = valor.match(/\+(\d+)/);
      return m ? Number(m[1]) : null;
    }
    return null;
  }, rotulo);
}

/** Radio de uma classe dentro do card do step 'escolha_classe' do level-up (mesma forma de multiclasse-subida.spec.mjs). */
function radioClasse(page, nome) {
  return page.locator(`#levelup-escolha-classe input[name="classe-que-sobe"][data-classe="${nome}"]`);
}

/** Avança "Próximo" até o card "Trocar Magias" aparecer (mesma forma de levelup-trocas-multiplas.spec.mjs). */
async function irAteCardDeTroca(page) {
  const card = page.locator('#levelup-troca-magia');
  for (let i = 0; i < 10; i++) {
    if (await card.count()) return card;
    const proximo = page.locator('#btn-step-proximo');
    if (await proximo.count()) await proximo.click();
    await page.waitForTimeout(500);
  }
  return card;
}

// Semente multiclasse compartilhada pelos cenários 2 a 5 -- mesma forma de
// CLERIGO_5_MAGO_1 em multiclasse-seletor-magias.spec.mjs (Clérigo é a
// classe INICIAL, ordem 0; Mago é a segunda, ordem 1).
const CLERIGO_5_MAGO_1 = [
  { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
];
const PERICIAS_CLERIGO = ['Religião', 'Intuição'];

// ============================================================
// 1. O CANÁRIO DA MAIORIA: Mago 5 puro não muda em NADA.
// ============================================================
// Se este cenário falhar, o sub-projeto regrediu para quase todos os
// usuários, e nenhum deles é multiclasse -- é por isso que ele vem primeiro
// e é o único com esse aviso no comentário.
test('Mago 5 puro: classe única não muda em NADA -- o canário da maioria dos personagens', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', subclasse: '', nivel: 5, xp: 6500,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Arcanismo', 'História'],
    // 3 magias de 1º círculo de verdade (dados/classes/magias_mago.json),
    // sem `classe` -- migrarMagiaClasse carimba pela RULING R-B (superfície
    // única, sem consultar lista nenhuma): toda entrada vira Mago.
    magias_preparadas: [
      { nome: 'Alarme', circulo: 1 },
      { nome: 'Armadura Arcana', circulo: 1 },
      { nome: 'Compreender Idiomas', circulo: 1 },
    ],
  }, 'regras-t5-mago-canario');

  // GUARDA CONTRA VACUIDADE: a seção de Magias precisa existir antes de
  // qualquer afirmação sobre ela.
  await expect(page.locator('#btn-add-magia'),
    'a seção de Magias não foi montada -- sem ela o cenário não mede nada')
    .toBeVisible({ timeout: 10_000 });

  // O sub-projeto inteiro gira em torno de personagens multiclasse -- o
  // canário é provar que quem NÃO é multiclasse não vê seletor nenhum.
  await expect(page.locator('#tabs-superficie-magia'),
    'classe única não deveria ganhar o seletor de superfície -- ele só existe com mais de uma ' +
    'classe conjuradora')
    .toHaveCount(0);

  // O contador tem de mostrar exatamente o de antes deste sub-projeto: a
  // soma simples das 3 magias seedadas contra o limite do Mago 5 (9,
  // dados/classes/mago.json).
  await expect.poll(async () => (await lerContadorFicha(page, 'Magias Preparadas'))?.atual, {
    message: 'o contador de preparadas de um Mago de classe única precisa contar as 3 magias ' +
      'seedadas, exatamente como fazia antes deste sub-projeto -- carimbar classe não pode mudar ' +
      'QUANTAS contam',
  }).toBe(3);
  await expect.poll(async () => (await lerContadorFicha(page, 'Magias Preparadas'))?.limite, {
    message: 'o limite mostrado tem de continuar sendo o do Mago nível 5 (9)',
  }).toBe(9);

  // O indicador "(sem classe)" não pode existir -- nem escondido: AUSENTE
  // do DOM, porque classe única nunca tem incerteza (RULING R-B decide
  // sempre, sem consultar lista nenhuma).
  await expect(page.locator('.magia-contadores .magia-contador .contador-label', { hasText: 'sem classe' }),
    'personagem de classe única não deveria ter indicador de "sem classe" -- toda magia dele é ' +
    'carimbada com certeza pela migração')
    .toHaveCount(0);

  // O rótulo de classe por cartão (achado desta tarefa, não previsto no
  // brief original -- ver o cabeçalho do arquivo) também não pode existir:
  // ele só aparece com MAIS de uma superfície de conjuração.
  await expect(page.locator('.magia-item[data-magia-nome="Alarme"] div[title="Classe desta magia preparada"]'),
    'o rótulo de classe por cartão só deveria existir com mais de uma superfície de conjuração -- ' +
    'aparecer aqui, numa ficha de classe única, seria a MESMA regressão do seletor "aparecer sempre"')
    .toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 2. A MIGRAÇÃO CARIMBA NA ABERTURA DA FICHA.
// ============================================================
// As duas magias abaixo foram escolhidas por MEDIÇÃO sobre
// dados/classes/magias_clerigo.json e magias_mago.json (script Node ad hoc,
// não um nome chutado):
//   - "Comando": 1º Círculo, existe SÓ na lista do Clérigo (ausente da lista
//     de 242 magias do Mago) -- classeDaMagiaPreparada não tem ambiguidade
//     nenhuma para resolver.
//   - "Detectar Magia": 1º Círculo, existe NAS DUAS listas -- é o caso em
//     que a função tem de devolver `null` (RULING "sem chute" do brief da
//     Tarefa 1) em vez de adivinhar qual das duas.
test('Clérigo 5/Mago 1: a migração carimba na abertura da ficha -- só o inequívoco', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', subclasse: '', nivel: 6, xp: 14000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_CLERIGO,
    classes: CLERIGO_5_MAGO_1,
    schema_versao: 2,
    // SEM nenhuma `classe` -- é exatamente a ficha legada (gravada antes
    // das Tarefas 1/2) que migrarMagiaClasse existe para converter.
    magias_preparadas: [
      { nome: 'Comando', circulo: 1 },
      { nome: 'Detectar Magia', circulo: 1 },
    ],
  }, 'regras-t5-migracao-clerigo-mago');

  await expect(page.locator('#btn-add-magia'),
    'a seção de Magias não foi montada -- sem ela o cenário não mede nada')
    .toBeVisible({ timeout: 10_000 });

  // migrarMagiaClasse é ASSÍNCRONA (lê classes/magias_clerigo.json e
  // classes/magias_mago.json de disco antes de decidir) -- expect.poll
  // cobre essa corrida, no lugar de ler o personagem salvo uma vez só logo
  // depois de abrir a ficha.
  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return p?.magias_preparadas?.find((m) => m.nome === 'Comando')?.classe ?? null;
  }, {
    message: '"Comando" só existe na lista do Clérigo (medido em magias_clerigo.json, ausente de ' +
      'magias_mago.json) -- a migração deveria carimbar classe: "Clérigo" sem ambiguidade nenhuma',
  }).toBe('Clérigo');

  // As duas entradas são processadas na MESMA passagem (migrarMagiaClasse
  // monta listasPorClasse uma vez, itera as duas, e só então chama
  // salvar()) -- com "Comando" já carimbado, "Detectar Magia" já foi
  // decidida também; ler o personagem salvo agora não é uma corrida nova.
  const salvo = await personagemSalvo(page);
  const detectarMagia = salvo?.magias_preparadas?.find((m) => m.nome === 'Detectar Magia');
  expect(detectarMagia, 'a magia semeada "Detectar Magia" tem de continuar na ficha depois da migração')
    .toBeTruthy();
  expect('classe' in detectarMagia,
    '"Detectar Magia" existe NAS DUAS listas (Clérigo e Mago, medido) -- a migração não pode ' +
    'chutar entre elas; a chave classe tem de continuar AUSENTE (nunca null nem string vazia, ' +
    'contrato do campo)')
    .toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 3. O ESTADO MISTO APARECE NA TELA, E O NÚMERO NÃO MENTE.
// ============================================================
// Mesmo personagem-base do cenário 2 (Clérigo 5/Mago 1), mas desta vez as
// magias já chegam PARCIALMENTE carimbadas -- o estado que a migração
// sozinha nunca produz por completo (ela só carimba o inequívoco), mas que
// uma ficha real acumula com o tempo: magia antiga sem carimbo convivendo
// com magia nova que os gravadores (Tarefa 2) já carimbaram.
const CLERIGO_MAGO_MISTO_MAGIAS = [
  { nome: 'Bênção', circulo: 1, classe: 'Clérigo' },
  { nome: 'Comando', circulo: 1, classe: 'Clérigo' },
  { nome: 'Enfeitiçar Pessoa', circulo: 1, classe: 'Mago' },
  // "Detectar Magia" sem `classe`: nas duas listas (medido no cenário 2) --
  // fica assim FOR SEMPRE depois da migração, não é um estado transitório.
  { nome: 'Detectar Magia', circulo: 1 },
];

test('Clérigo 5/Mago 1 com estado misto: o contador segue a classe ATIVA, e o indicador "sem classe" tem o número certo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', subclasse: '', nivel: 6, xp: 14000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_CLERIGO,
    classes: CLERIGO_5_MAGO_1,
    schema_versao: 2,
    magias_preparadas: CLERIGO_MAGO_MISTO_MAGIAS,
  }, 'regras-t5-estado-misto-tela');

  await expect(page.locator('#tabs-superficie-magia'),
    'com duas superfícies de conjuração o seletor precisa aparecer')
    .toBeVisible({ timeout: 10_000 });

  // Abre no Clérigo (classe inicial): "desta" = Bênção + Comando (2),
  // "semClasse" = Detectar Magia (1). "Enfeitiçar Pessoa" (Mago) é
  // "deOutra" -- gasta o orçamento do Mago, não o do Clérigo.
  await expect.poll(async () => (await lerContadorFicha(page, 'Magias Preparadas'))?.atual, {
    message: 'com o Clérigo ativo o contador tem de mostrar 2 (Bênção + Comando) -- NÃO a soma ' +
      'global de todas as 4 magias preparadas do personagem, e não incluir a magia carimbada Mago',
  }).toBe(2);
  await expect.poll(async () => (await lerContadorFicha(page, 'Magias Preparadas'))?.limite, {
    message: 'o limite mostrado tem de ser o do Clérigo nível 5 (9)',
  }).toBe(9);
  await expect.poll(async () => lerIndicadorSemClasse(page, 'Magias Preparadas'), {
    message: 'o indicador "sem classe" tem de mostrar +1 (Detectar Magia) -- é essa a prova de ' +
    'que a tela responde à TERCEIRA pergunta (incerteza), não só a duas',
  }).toBe(1);

  // Rótulo de classe por cartão: cada magia mostra a SUA classe, e a
  // ambígua mostra o texto de incerteza -- não um chute.
  await expect(page.locator('.magia-item[data-magia-nome="Bênção"] div[title="Classe desta magia preparada"]'),
    'o cartão de "Bênção" tem de rotular a classe dela (Clérigo)').toHaveText('Clérigo');
  await expect(page.locator('.magia-item[data-magia-nome="Enfeitiçar Pessoa"] div[title="Classe desta magia preparada"]'),
    'o cartão de "Enfeitiçar Pessoa" tem de rotular a classe dela (Mago), mesmo com o Clérigo ' +
    'como superfície ATIVA -- a lista mostra as magias de TODAS as classes')
    .toHaveText('Mago');
  await expect(page.locator('.magia-item[data-magia-nome="Detectar Magia"] div[title="Classe desta magia preparada"]'),
    'o cartão da magia ambígua tem de mostrar o texto de incerteza, não um chute de classe')
    .toHaveText('Sem classe conhecida');

  // Troca para o Mago: "desta" passa a ser só "Enfeitiçar Pessoa" (1) contra
  // o limite do Mago 1 (4). "semClasse" continua 1 -- Detectar Magia é
  // ambígua entre as duas classes do personagem, não pertence a UMA aba só.
  await clicarSeletorFicha(page, '[data-tab-superficie="Mago"]',
    { esperar: '[data-tab-superficie="Mago"].active' });

  await expect.poll(async () => (await lerContadorFicha(page, 'Magias Preparadas'))?.atual, {
    message: 'depois de trocar para o Mago, o contador tem de cair para 1 (só "Enfeitiçar ' +
      'Pessoa") -- se continuar 2, o contador não está acompanhando a superfície ativa',
  }).toBe(1);
  await expect.poll(async () => (await lerContadorFicha(page, 'Magias Preparadas'))?.limite, {
    message: 'o limite tem de virar o do Mago nível 1 (4)',
  }).toBe(4);
  await expect.poll(async () => lerIndicadorSemClasse(page, 'Magias Preparadas'), {
    message: 'o indicador "sem classe" continua +1 depois da troca -- a incerteza é do ' +
      'PERSONAGEM, não de uma aba só',
  }).toBe(1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 4. INCERTEZA AVISA, NÃO BLOQUEIA.
// ============================================================
// Clérigo 5/Mago 1, com o Mago ativo: 4 magias já carimbadas classe: 'Mago'
// (a contagem CERTA já bate o limite do Mago nível 1 -- 4) e MAIS uma magia
// ambígua ("Detectar Magia", sem classe, nas duas listas). Se a incerteza
// não existisse, "Adicionar" teria de recusar -- é a regra oposta que este
// cenário prova: bloquear com base numa contagem incerta é pior que deixar
// passar (regra já adotada duas vezes neste repositório, citada no
// comentário do portão em site/js/sheet/grimorio.js).
const MAGO_4_PREPARADAS_NO_LIMITE = [
  { nome: 'Alarme', circulo: 1, classe: 'Mago' },
  { nome: 'Armadura Arcana', circulo: 1, classe: 'Mago' },
  { nome: 'Compreender Idiomas', circulo: 1, classe: 'Mago' },
  { nome: 'Convocar Familiar', circulo: 1, classe: 'Mago' },
  { nome: 'Detectar Magia', circulo: 1 }, // ambígua: fica sem classe
];

// O Mago só pode PREPARAR o que já está no Grimório (achado da escrita
// deste cenário, sheet/grimorio.js/mostrarBuscaMagia: "Magias de círculo do
// Mago só podem ser preparadas se já estiverem registradas") -- sem isto a
// aba de 1º Círculo do modal nasce vazia (só truques), porque
// `magiasClasse` filtra por `char.grimorio` para qualquer classe com
// `usaGrimorio`. As 4 já preparadas entram aqui por realismo (um Mago de
// verdade só prepara o que já registrou), e "Enfeitiçar Pessoa" entra
// porque é a que o cenário vai clicar para adicionar.
const GRIMORIO_MAGO_1 = [
  { nome: 'Alarme', circulo: 1 },
  { nome: 'Armadura Arcana', circulo: 1 },
  { nome: 'Compreender Idiomas', circulo: 1 },
  { nome: 'Convocar Familiar', circulo: 1 },
  { nome: 'Enfeitiçar Pessoa', circulo: 1 },
];

test('incerteza avisa, não bloqueia: adicionar magia não pode ser recusada com a contagem incerta', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', subclasse: '', nivel: 6, xp: 14000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_CLERIGO,
    classes: CLERIGO_5_MAGO_1,
    schema_versao: 2,
    magias_preparadas: MAGO_4_PREPARADAS_NO_LIMITE,
    grimorio: GRIMORIO_MAGO_1,
  }, 'regras-t5-incerteza-nao-bloqueia');

  await expect(page.locator('#tabs-superficie-magia')).toBeVisible({ timeout: 10_000 });
  await clicarSeletorFicha(page, '[data-tab-superficie="Mago"]',
    { esperar: '[data-tab-superficie="Mago"].active' });

  // CONTROLE: a contagem CERTA (desta) já bate o limite do Mago 1 (4) --
  // sem este controle, um "Adicionar" que passasse por outro motivo (ex.:
  // o portão nunca checou limite nenhum) não provaria a regra da incerteza.
  await expect.poll(async () => (await lerContadorFicha(page, 'Magias Preparadas'))?.atual, {
    message: 'controle: as 4 magias carimbadas Mago já deveriam bater o limite (4) antes do ' +
      'teste tentar adicionar mais uma -- sem isso o cenário não testa bloqueio nenhum',
  }).toBe(4);
  await expect.poll(async () => lerIndicadorSemClasse(page, 'Magias Preparadas'), {
    message: 'controle: a magia ambígua (Detectar Magia) precisa aparecer como "+1 sem classe" ' +
      '-- é essa incerteza que o portão tem de respeitar',
  }).toBe(1);

  await abrirGerenciarMagias(page);
  await page.locator('[data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});

  const cardEnfeiticar = page.locator('#resultado-magias [data-circ-check="Enfeitiçar Pessoa"]');
  await expect(cardEnfeiticar,
    '"Enfeitiçar Pessoa" (1º círculo de Mago, ainda não preparada) precisa aparecer disponível ' +
    'na grade -- se a grade tivesse ficado cinza/bloqueada por causa da contagem incerta, o ' +
    'defeito já apareceria aqui')
    .toBeVisible({ timeout: 10_000 });
  await cardEnfeiticar.click();
  await assentar(page).catch(() => {});

  // A AÇÃO CENTRAL: mesmo com desta.length (4) já no limite do Mago, a
  // magia tem de ENTRAR. O defeito relatado pelo usuário que originou este
  // sub-projeto era justamente uma tela que bloqueava tudo por não saber de
  // que classe eram as magias -- este cenário prova que o conserto não
  // trocou "bloqueia sempre" por "bloqueia quando incerto", os dois errados
  // pelo mesmo motivo.
  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || []).some((m) => m.nome === 'Enfeitiçar Pessoa');
  }, {
    message: '"Enfeitiçar Pessoa" deveria ter sido adicionada -- a ação NÃO PODE ser recusada só ' +
      'porque a contagem CERTA (4/4) já bate o limite, enquanto há 1 magia "sem classe" tornando ' +
      'essa contagem incerta (regra do BLOQUEIO: só recusa com semClasse === 0)',
  }).toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 5. O GRAVADOR CARIMBA DE VERDADE -- a prova que faltava da Tarefa 2.
// ============================================================
// Os sítios de gravação de site/js/sheet/grimorio.js vivem num manipulador
// de clique ([data-circ-check], dentro de mostrarBuscaMagia) e nunca tinham
// sido exercitados por um clique de verdade num navegador -- só por leitura
// de código e por uma guarda textual do teste de unidade. Este cenário abre
// "Gerenciar Magias" com a superfície do MAGO ativa, clica para preparar uma
// magia nova, e lê o personagem SALVO.
test('o gravador carimba de verdade: adicionar magia pelo modal "Gerenciar Magias" grava classe: "Mago"', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', subclasse: '', nivel: 6, xp: 14000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_CLERIGO,
    classes: CLERIGO_5_MAGO_1,
    schema_versao: 2,
    // O Mago só pode PREPARAR o que já está no Grimório (ver o comentário
    // de GRIMORIO_MAGO_1, cenário 4, para o achado completo) -- sem isto a
    // aba de 1º Círculo do modal nasce vazia e o clique abaixo não acha
    // "Alarme" nenhum.
    grimorio: [{ nome: 'Alarme', circulo: 1 }],
  }, 'regras-t5-gravador-carimba');

  await expect(page.locator('#tabs-superficie-magia')).toBeVisible({ timeout: 10_000 });
  await clicarSeletorFicha(page, '[data-tab-superficie="Mago"]',
    { esperar: '[data-tab-superficie="Mago"].active' });

  await abrirGerenciarMagias(page);
  await page.locator('[data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});

  const cardAlarme = page.locator('#resultado-magias [data-circ-check="Alarme"]');
  await expect(cardAlarme, '"Alarme" (1º círculo de Mago) precisa aparecer na grade do modal')
    .toBeVisible({ timeout: 10_000 });
  await cardAlarme.click();
  await assentar(page).catch(() => {});

  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return p?.magias_preparadas?.find((m) => m.nome === 'Alarme')?.classe ?? null;
  }, {
    message: 'com a superfície do Mago ativa, a magia adicionada pelo modal "Gerenciar Magias" ' +
      'precisa sair gravada com classe: "Mago" -- sem isso o gravador está mudo diante de um ' +
      'clique de verdade, mesmo passando nas leituras estáticas que a Tarefa 2 tinha',
  }).toBe('Mago');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 6. A TROCA DE SUBIDA DE NÍVEL NÃO MOVE MAGIA ENTRE ORÇAMENTOS.
// ============================================================
// O achado que a revisão da Tarefa 2 levantou e a Tarefa 4 consertou
// (levelup-ui.js, montarBlocoTrocaMagia): antes, a lista "qual magia sai?"
// filtrava só por magiaContaNoLimite, sem olhar de que classe era cada
// preparada -- um jogador podia "trocar" uma magia que pertence ao
// orçamento de OUTRA classe do mesmo personagem, e a troca gravava a
// substituta na classe que está subindo, movendo uma magia de um orçamento
// para o outro em silêncio.
//
// Clérigo 5/Paladino 3 -- as duas classes preparadas cujas listas se
// sobrepõem (medido: 35 de 51 magias do Paladino também estão na lista do
// Clérigo). "Bênção" (1º Círculo) está NAS DUAS listas -- carimbada aqui
// como Paladino. Subir o CLÉRIGO (5 -> 6) não pode oferecer "Bênção" como
// candidata a sair: ela pertence ao orçamento do Paladino, não ao do
// Clérigo que está subindo, mesmo estando na lista de magias do Clérigo
// também (é essa sobreposição que torna o cenário honesto -- se "Bênção"
// não estivesse na lista do Clérigo, a ausência dela na tela não provaria
// nada sobre o filtro por classe, só que a lista de origem já a excluiria).
const CLERIGO_5_PALADINO_3 = [
  { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Paladino', subclasse: '', nivel: 3, ordem: 1 },
];

test('subida de nível: a troca de magia não oferece uma magia carimbada com a OUTRA classe', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', subclasse: '', nivel: 8, xp: 34000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: PERICIAS_CLERIGO,
    classes: CLERIGO_5_PALADINO_3,
    schema_versao: 2,
    magias_preparadas: [
      // "Bênção" existe nas DUAS listas (Clérigo e Paladino, medido em
      // magias_clerigo.json e magias_paladino.json, 1º Círculo nas duas) --
      // carimbada Paladino aqui.
      { nome: 'Bênção', circulo: 1, classe: 'Paladino' },
      // "Palavra Curativa" e "Infligir Ferimentos" só existem na lista do
      // Clérigo (medido: ausentes de magias_paladino.json) -- CONTROLE
      // POSITIVO: se a lista de candidatas viesse vazia por outro motivo (a
      // classe errada escolhida no assistente, um filtro largo demais),
      // este cenário passaria por vacuidade em vez de medir a regra. DUAS
      // magias de propósito (achado da escrita deste cenário, mesma razão
      // de CLERIGO_TROCAVEL em trocas-conjurador.spec.mjs): com uma
      // candidata só, `montarTroca` (ui-opcoes.js) entra no caminho `umSo`,
      // que renderiza a opção como card de apresentação SEM `data-opcao`
      // -- o seletor abaixo não acharia nada, por um motivo que não tem
      // nada a ver com a regra sendo provada.
      { nome: 'Palavra Curativa', circulo: 1, classe: 'Clérigo' },
      { nome: 'Infligir Ferimentos', circulo: 1, classe: 'Clérigo' },
    ],
  }, 'regras-t5-troca-nao-move-orcamento');

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false }),
    'o assistente de nível não abriu').toBe(true);
  await expect(page.locator('#levelup-escolha-classe'),
    'com duas classes, o step "Classe do Nível" precisa aparecer para o teste escolher qual sobe')
    .toBeVisible({ timeout: 10_000 });

  // Sobe o CLÉRIGO (5 -> 6): é o orçamento dele que "Bênção" NÃO pode
  // invadir, mesmo carimbada Paladino e presente na lista de magias dele.
  await radioClasse(page, 'Clérigo').click();
  await expect(page.locator('#levelup-escolha-classe'),
    'o contexto do assistente tem de ser reconstruído sobre o Clérigo')
    .toHaveAttribute('data-classe-ctx', 'Clérigo');
  await assentar(page).catch(() => {});

  const card = await irAteCardDeTroca(page);
  await expect(card, 'o card "Trocar Magias" não apareceu para o Clérigo').toBeVisible({ timeout: 10_000 });

  // A AFIRMAÇÃO CENTRAL: "Bênção" está preparada, é 1º círculo, e faz parte
  // da lista de magias do Clérigo (a classe que sobe) -- só não pode
  // aparecer como candidata a sair porque está carimbada classe: "Paladino".
  await expect(card.locator('.opcao-card[data-opcao="Bênção"]'),
    '"Bênção" está carimbada classe: "Paladino" -- oferecê-la para sair do orçamento do Clérigo ' +
    'moveria uma magia de outra classe para o orçamento errado em silêncio, o mesmo defeito que a ' +
    'revisão da Tarefa 2 apontou')
    .toHaveCount(0);

  // CONTROLE: a lista não está vazia por acidente -- "Palavra Curativa"
  // (carimbada Clérigo de verdade) aparece normalmente como candidata.
  await expect(card.locator('.opcao-card[data-opcao="Palavra Curativa"]'),
    'controle: "Palavra Curativa" (carimbada Clérigo) precisa aparecer como candidata a sair -- ' +
    'sem isso a ausência de "Bênção" acima não provaria filtro nenhum, só uma lista vazia')
    .toBeVisible({ timeout: 5000 });

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// 7. A VAGA DE MAGIA LIVRE GRAVA A CLASSE CERTA -- o sítio 6 da Tarefa 2.
// ============================================================
// Achado da Rodada 2 de revisão: o relatório desta tarefa tinha creditado ao
// cenário 5 a cobertura dos "sítios 5 e 6" da Tarefa 2, mas o cenário 5 só
// exercita o sítio 5 (grimorio.js, mostrarBuscaMagia/[data-circ-check]). O
// sítio 6 é `site/js/sheet/grimorio.js:1164`, dentro de
// `abrirPreenchimentoSlotMagia` -- outro modal, outro handler de clique,
// nunca antes exercitado por um clique de verdade. Este cenário fecha essa
// lacuna.
//
// `abrirPreenchimentoSlotMagia` tem uma guarda própria (grimorio.js:1046-1050):
// só permite preencher a vaga pela PRIMEIRA superfície de conjuração (a que
// `migrarSlotsMagiaLivre` usou para calcular o déficit) -- qualquer outra
// aba recusa com um toast, antes de montar a lista. Este cenário respeita
// essa guarda de propósito: NÃO troca de aba, porque a superfície ativa por
// padrão já é a primeira (a classe inicial) -- o mesmo caminho que a guarda
// exige.
//
// Bardo 5 (inicial, tipo_conjuracao "conhecidas" -- dados-classes.js:40) /
// Mago 1 (segunda classe): a multiclasse não é decorativa aqui -- prova que
// o gravador estampa a classe ATIVA de verdade (Bardo), não uma constante
// nem a classe errada. `_slots_magia_livre` é seedado direto (1), sem
// depender de `migrarSlotsMagiaLivre` calcular o déficit certo -- essa
// migração só ELEVA o valor quando o déficit computado é maior
// (`deficit > (char._slots_magia_livre || 0)`, migracoes.js:84), nunca
// abaixa nem apaga, então o valor seedado nunca desaparece antes do clique.
const BARDO_5_MAGO_1 = [
  { classe: 'Bardo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
];

test('vaga de magia livre: preencher pela primeira superfície grava classe: "Bardo" -- o sítio 6 da Tarefa 2', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Bardo', subclasse: '', nivel: 6, xp: 14000,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atuação', 'Persuasão'],
    classes: BARDO_5_MAGO_1,
    schema_versao: 2,
    _slots_magia_livre: 1,
  }, 'regras-t5-vaga-livre-bardo');

  // GUARDA CONTRA VACUIDADE: o botão só aparece com a vaga aberta e a
  // superfície ATIVA sendo do tipo "conhecidas" -- a superfície ativa por
  // padrão é a primeira (Bardo), então o botão tem de existir sem clique
  // nenhum de troca de aba.
  const botaoEscolher = page.locator('#btn-preencher-slot-magia');
  await expect(botaoEscolher,
    'a vaga de magia livre (_slots_magia_livre) deveria oferecer o botão "Escolher" na seção Magias')
    .toBeVisible({ timeout: 10_000 });
  await botaoEscolher.click();
  await page.waitForSelector('#resultado-preencher-slot', { state: 'visible', timeout: 20_000 });
  await assentar(page).catch(() => {});

  // "Amizade Animal" é 1º círculo de Bardo (dados/classes/magias_bardo.json).
  const cardAmizade = page.locator('#resultado-preencher-slot [data-preencher-nome="Amizade Animal"]');
  await expect(cardAmizade,
    '"Amizade Animal" (1º círculo de Bardo) precisa aparecer na grade de preenchimento -- se a ' +
    'guarda da PRIMEIRA superfície tivesse falhado, a lista seria de outra classe (ou vazia)')
    .toBeVisible({ timeout: 10_000 });
  await cardAmizade.click();
  await assentar(page).catch(() => {});

  await page.click('#btn-confirmar-preencher');
  await assentar(page).catch(() => {});

  // A PROVA: o sítio 6 (grimorio.js:1164) nunca tinha sido clicado por um
  // navegador de verdade -- só lido e conferido por guarda textual, igual
  // ao sítio 5 antes do cenário 5.
  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return p?.magias_preparadas?.find((m) => m.nome === 'Amizade Animal')?.classe ?? null;
  }, {
    message: 'preencher a vaga de magia livre pela primeira superfície (Bardo) precisa gravar ' +
      'classe: "Bardo" -- é o sítio 6 da Tarefa 2 (grimorio.js, abrirPreenchimentoSlotMagia), ' +
      'nunca antes exercitado por um clique de verdade',
  }).toBe('Bardo');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
