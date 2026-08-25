// ============================================================
// O SELETOR DE CA ALTERNATIVA -- a primeira superficie de TELA NOVA de
// todo o esforco de multiclasse.
//
// O que existe antes deste spec: `coletarCAsAlternativas()` e
// `escolherCAAlternativa()` (site/js/utils.js, Tarefa 3) ja sabem que um
// Barbaro 5/Monge 5 tem DUAS Defesas sem Armadura ao mesmo tempo, e que o
// livro deixa o jogador se beneficiar de apenas UMA de cada vez
// (PHB.md:2067). Mas a escolha nao tinha onde ser feita: a ficha exibia o
// maior valor e pronto, e `char.ca_alternativa_escolhida` so podia ser
// escrito editando o JSON a mao.
//
// O que este spec mede: o seletor na caixa da CA
// (site/js/sheet/ficha.js) e o handler que ele dispara
// (site/js/sheet/habilidades.js, `abrirEscolhaCAAlternativa`).
//
// A DECISAO DE PRODUTO que o Oraculo 4 prende
// (docs/PERGUNTAS-PENDENTES.txt:246-257): o seletor aparece SOMENTE quando
// ha DUAS OU MAIS candidatas. Com uma candidata so -- o caso de TODO
// personagem de classe unica -- nada aparece na tela. Classe unica nao
// pode mudar de aparencia por causa desta tarefa, e o Oraculo 4 e o
// canario disso.
//
// A ARMADILHA que o Oraculo 5 prende, e que ja custou um bug real
// (commit 12a541b): o coletor PRECISA receber `{ temArmadura, temEscudo }`
// lidos do MESMO inventario que `calcCA` le. Chamado sem contexto, ele
// devolve a Defesa sem Armadura do Monge para um Monge de ESCUDO -- que o
// livro exclui (Classes.md:5174-5176) e que `calcCA` ja nao conta. O
// sintoma seria um seletor oferecendo uma fonte que o numero da tela nao
// usa. Por isso a ficha e o handler chamam `equipamentoDeCA(char)`, a
// leitura de inventario extraida de dentro de `calcCA`.
//
// Semeadura: `classes[]` + `schema_versao: 2`, como
// multiclasse-handlers.spec.mjs -- nenhum fluxo do app cria multiclasse
// hoje (isso e o sub-projeto 5), entao o estado e forjado no store.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, clicarSeletorFicha } from './helpers-regras.mjs';

// ============================================================
// Fixtures e aritmetica, escritas por extenso
// ============================================================

// Atributos escolhidos para que as DUAS fontes deem numeros DIFERENTES e
// bem separados -- com ATRIBUTOS_REGRAS (con 14, sab 13) a diferenca seria
// de 1 ponto e um erro de sinal passaria despercebido.
//   Destreza 14  -> +2
//   Constituicao 18 -> +4   (Barbaro: 10 + 2 + 4 = 16)
//   Sabedoria 12 -> +1      (Monge:   10 + 2 + 1 = 13)
const ATRIBUTOS_CA = {
  forca: 15, destreza: 14, constituicao: 18,
  inteligencia: 13, sabedoria: 12, carisma: 13,
};

const CA_BARBARO = 16;  // 10 + Des(+2) + Con(+4)  -- Classes.md:91-93
const CA_MONGE = 13;    // 10 + Des(+2) + Sab(+1)  -- Classes.md:5174-5176
const CA_BARBARO_COM_ESCUDO = CA_BARBARO + 2;

// XP coerente com o nivel TOTAL. Nao muda regra nenhuma que este spec
// meca, mas ficha com XP incoerente enche a tela de aviso e atrapalha a
// leitura de um trace.
const XP_POR_NIVEL_TOTAL = { 5: 6500, 10: 64000 };

// Barbaro em ORDEM 0 de proposito: o espelho `char.classe` vira 'Bárbaro',
// que e tambem a fonte de MAIOR valor. Assim o Oraculo 2 (escolher o
// Monge) tem de vencer o espelho E o default, e nao so um dos dois.
const BARBARO5_MONGE5 = [
  { classe: 'Bárbaro', subclasse: 'Trilha do Berserker', nivel: 5, ordem: 0 },
  { classe: 'Monge', subclasse: 'Combatente da Mão Espalmada', nivel: 5, ordem: 1 },
];

// O canario: Monge 5 de classe unica. UMA candidata -- nada na tela.
const MONGE5_SOZINHO = [
  { classe: 'Monge', subclasse: 'Combatente da Mão Espalmada', nivel: 5, ordem: 0 },
];

const SELETOR_CA = '[data-ca-acao="escolher-alternativa"]';

/** Um Escudo equipado, no formato que `calcCA` reconhece (utils.js). */
function escudoEquipado() {
  return {
    nome: 'Escudo', tipo: 'escudo', quantidade: 1, equipado: true,
    dados: { ca: '+2', categoria: 'Escudo', peso: '3' },
  };
}

/**
 * Semeia um personagem (multi ou classe unica) pelo mesmo caminho de
 * multiclasse-handlers.spec.mjs e abre a ficha dele.
 *
 * Os espelhos (`classe`, `subclasse`, `nivel`) sao preenchidos com o que
 * `sincronizarEspelhos()` produziria: classe INICIAL e nivel TOTAL. E
 * exatamente o que um render escrito sobre o espelho leria -- deixa-los
 * corretos e o que permite ao oraculo distinguir "leu a classe certa" de
 * "acertou por acaso".
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {Array<{classe:string,subclasse:string,nivel:number,ordem:number}>} classes
 * @param {object} extras Campos extras do personagem (ex.: `inventario`).
 * @param {string} id Id do personagem no store (unico por teste).
 */
async function abrirFichaCA(context, classes, extras, id) {
  const inicial = classes.find((c) => c.ordem === 0) || classes[0];
  const nivelTotal = classes.reduce((soma, c) => soma + c.nivel, 0);
  const lado = await abrirFicha(context, {
    classe: inicial.classe,
    subclasse: inicial.subclasse,
    nivel: nivelTotal,
    xp: XP_POR_NIVEL_TOTAL[nivelTotal] || 0,
    especie: 'Humano',
    atributos: ATRIBUTOS_CA,
    pericias_proficientes: ['Atletismo', 'Acrobacia'],
    classes,
    schema_versao: 2,
    ...extras,
  }, id);
  await assentar(lado.page).catch(() => {});
  return lado;
}

/**
 * Le a CAIXA da CA inteira, de uma vez: o numero exibido, quantos seletores
 * ha nela, quantos ha na PAGINA toda, e o rotulo do seletor.
 *
 * Uma leitura so, e nao quatro `page.locator`, porque as afirmacoes deste
 * spec sao sobre a caixa NUM INSTANTE -- entre duas leituras separadas a
 * ficha pode ter re-renderizado, e um par "antes/depois" perderia o
 * sentido.
 *
 * `seletoresNaPagina` existe para provar que o gatilho nao vazou para
 * outro canto da ficha: o Oraculo 4 afirma AUSENCIA, e ausencia dentro da
 * caixa nao seria ausencia nenhuma se o elemento tivesse sido emitido
 * fora dela.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{valor:number|null,bruto:string,naCaixa:number,naPagina:number,rotulo:string|null,html:string}|null>}
 */
async function caixaCA(page) {
  return page.evaluate((alvo) => {
    const rotulo = [...document.querySelectorAll('.stat-label')]
      .find((el) => el.textContent.trim() === 'CA');
    const caixa = rotulo?.parentElement || null;
    if (!caixa) return null;
    const bruto = (caixa.querySelector('.stat-value')?.textContent || '').trim();
    const sel = caixa.querySelector(alvo);
    return {
      valor: /^\d+$/.test(bruto) ? Number(bruto) : null,
      bruto,
      naCaixa: caixa.querySelectorAll(alvo).length,
      naPagina: document.querySelectorAll(alvo).length,
      rotulo: sel ? (sel.textContent || '').trim() : null,
      html: caixa.innerHTML,
    };
  }, SELETOR_CA);
}

/**
 * GUARDA CONTRA VACUIDADE, e ela e obrigatoria em TODO oraculo daqui.
 *
 * Sem esta guarda, um render que simplesmente explodisse (ou uma ficha que
 * nem carregasse) faria toda afirmacao de AUSENCIA passar -- "o seletor nao
 * aparece" seria verdade porque NADA aparece. O Oraculo 4 inteiro e uma
 * afirmacao de ausencia; ele so vale se a caixa da CA existir e exibir um
 * numero antes.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} porque O que esta prestes a ser afirmado sobre a caixa.
 * @returns {Promise<object>} A leitura de `caixaCA`, ja validada.
 */
async function exigirCaixaCA(page, porque) {
  await expect.poll(async () => (await caixaCA(page))?.valor ?? null, {
    message: `a caixa da CA precisa existir e exibir um numero antes de ${porque} `
      + '-- sem isso, qualquer afirmacao de ausencia passaria por vacuidade',
  }).toBeGreaterThan(0);
  return caixaCA(page);
}

/**
 * Le `ca_alternativa_escolhida` do personagem SALVO no store, pelo id.
 *
 * Dado CRU gravado, e nao o resultado de `escolherCAAlternativa()`: afirmar
 * sobre a funcao de producao seria medir a formula com a propria formula.
 * `salvar()` e parte do contrato do handler, entao ler do store tambem
 * prova que o clique persistiu.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @returns {Promise<string|undefined>}
 */
async function escolhaSalva(page, id) {
  return page.evaluate(async (alvo) => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const p = store.listarPersonagens().find((x) => x.id === alvo);
    return p ? p.ca_alternativa_escolhida : undefined;
  }, id);
}

/** Abre o modal do seletor e espera o botao Salvar dele existir. */
async function abrirModalCA(page) {
  await clicarSeletorFicha(page, SELETOR_CA, { esperar: '#btn-salvar-ca-alternativa' });
}

/**
 * Le as opcoes do `<select>` do modal aberto: valor, texto e qual esta
 * selecionada. E o que o modal DECLARA -- nao o que uma funcao de producao
 * recalcularia.
 *
 * @param {import('@playwright/test').Page} page
 */
async function opcoesDoModal(page) {
  return page.evaluate(() => {
    const sel = document.getElementById('ca-alternativa-select');
    if (!sel) return null;
    return {
      selecionada: sel.value,
      opcoes: [...sel.options].map((o) => ({ valor: o.value, texto: o.textContent.trim() })),
    };
  });
}

// ============================================================
// Oraculo 1 -- Barbaro 5/Monge 5: o seletor APARECE, e a CA e a MAIOR
// ============================================================
//
// As duas metades apontam para lados opostos:
//   (a) o seletor EXISTE e nomeia o Barbaro -- e NAO nomeia o Monge;
//   (b) o numero exibido e 16 (Barbaro) e NAO 13 (Monge).
//
// Mata: um render que emita o seletor sempre (a metade (a) do Oraculo 4
// pega isso), um que nomeie a classe do ESPELHO sem consultar o escolhedor,
// e um que mostre a PRIMEIRA candidata da tabela em vez da de maior valor.
// (Neste fixture espelho e vencedora coincidem de proposito -- ver Oraculo
// 2, que e onde elas se separam.)
test('Oraculo 1 -- Barbaro 5/Monge 5: o seletor aparece na caixa da CA e o numero e o MAIOR', async ({ context }) => {
  const id = 'regras-3d-ca-oraculo-1';
  const { page, erros } = await abrirFichaCA(context, BARBARO5_MONGE5, {}, id);

  const caixa = await exigirCaixaCA(page, 'afirmar que o seletor aparece');

  // ---------- Metade (a): o seletor esta la, e diz "Bárbaro" ----------
  expect(caixa.naCaixa,
    'com DUAS Defesas sem Armadura ativas o jogador precisa de onde escolher: '
    + 'exatamente um seletor dentro da caixa da CA')
    .toBe(1);
  expect(caixa.naPagina,
    'o seletor e um so na ficha inteira -- duplicata significaria dois handlers no mesmo clique')
    .toBe(1);
  expect(caixa.rotulo,
    'o seletor tem de nomear a fonte ATIVA, para o jogador saber de onde o numero saiu')
    .toContain('Bárbaro');
  expect(caixa.rotulo,
    'a fonte ativa e o Barbaro (16), entao o rotulo nao pode nomear o Monge (13)')
    .not.toContain('Monge');

  // ---------- Metade (b): o numero e o do Barbaro, nao o do Monge ----------
  expect(caixa.valor,
    `sem escolha manual vale o MAIOR valor: Barbaro 10+Des(+2)+Con(+4) = ${CA_BARBARO}`)
    .toBe(CA_BARBARO);
  expect(caixa.valor,
    `${CA_MONGE} e a CA do Monge -- exibi-la aqui seria ter pego a primeira candidata da tabela, `
    + 'ou a classe do espelho, em vez da de maior valor')
    .not.toBe(CA_MONGE);

  // O seletor e de tela, nao de papel: nao pode sair na impressao.
  expect(caixa.html,
    'o seletor e interativo -- tem de nascer `no-print`, como as badges de efeito da mesma caixa')
    .toContain('no-print');

  expect(erros, `erros de console/pagina: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Oraculo 2 -- escolher o Monge MUDA a CA na tela E PERSISTE
// ============================================================
//
// O par completo, em tres tempos: antes (16, "Bárbaro", campo ausente),
// depois do clique (13, "Monge", campo = 'Monge') e depois de RECARREGAR
// (13, "Monge"). A metade "antes" nao e decorativa: sem ela, um render que
// ja nascesse mostrando o Monge passaria o "depois" sem que clique nenhum
// tivesse efeito.
//
// Mata: o handler que abre o modal e nao grava; o que grava o VALOR em vez
// da CLASSE (o valor muda com os atributos e a escolha se perderia no
// primeiro aumento); o que grava sem `salvar()` (a tela muda, o F5
// desfaz); e o que grava mas nao re-renderiza.
test('Oraculo 2 -- escolher o Monge muda a CA na tela e sobrevive ao recarregar', async ({ context }) => {
  const id = 'regras-3d-ca-oraculo-2';
  const { page, erros } = await abrirFichaCA(context, BARBARO5_MONGE5, {}, id);

  // ---------- Tempo 1: o estado ANTES ----------
  const antes = await exigirCaixaCA(page, 'clicar no seletor');
  expect(antes.valor, `antes do clique vale o default (o maior): ${CA_BARBARO}`).toBe(CA_BARBARO);
  expect(antes.rotulo, 'antes do clique a fonte ativa e o Barbaro').toContain('Bárbaro');
  expect(await escolhaSalva(page, id),
    'o campo `ca_alternativa_escolhida` e ADITIVO: ausente ate o jogador escolher')
    .toBeUndefined();

  // ---------- O modal precisa oferecer AS DUAS fontes ----------
  await abrirModalCA(page);
  const modal = await opcoesDoModal(page);
  expect(modal, 'o clique tem de abrir um modal com o `<select>` das fontes').not.toBeNull();
  expect(modal.opcoes.map((o) => o.valor).sort(),
    'as duas fontes ativas tem de estar no modal -- oferecer uma so nao e escolha')
    .toEqual(['Bárbaro', 'Monge']);
  expect(modal.selecionada,
    'o modal abre na fonte ATIVA, nao na primeira da lista por acaso')
    .toBe('Bárbaro');
  expect(modal.opcoes.find((o) => o.valor === 'Monge').texto,
    `a opcao precisa mostrar o valor de cada fonte, senao a escolha e as cegas (Monge = ${CA_MONGE})`)
    .toContain(String(CA_MONGE));

  // ---------- Tempo 2: o estado DEPOIS ----------
  await page.selectOption('#ca-alternativa-select', 'Monge');
  await clicarSeletorFicha(page, '#btn-salvar-ca-alternativa');
  await assentar(page).catch(() => {});

  await expect.poll(async () => (await caixaCA(page))?.valor, {
    message: `escolher o Monge tem de trocar o numero da tela para ${CA_MONGE} `
      + '-- se ficar em 16, a escolha nao chegou ao calculo',
  }).toBe(CA_MONGE);

  const depois = await caixaCA(page);
  expect(depois.rotulo, 'o rotulo do seletor acompanha a escolha').toContain('Monge');
  expect(depois.naCaixa,
    'as DUAS candidatas continuam ativas: o seletor nao pode sumir depois de usado')
    .toBe(1);
  expect(await escolhaSalva(page, id),
    'o que se grava e a CLASSE DE ORIGEM -- o valor muda com os atributos, a classe nao')
    .toBe('Monge');

  // ---------- Tempo 3: depois de RECARREGAR ----------
  // `reload()` e nao `goto()`: a URL ja e `#ficha/<id>`, e uma navegacao
  // para a MESMA hash pode nao recarregar documento nenhum -- o "F5" seria
  // encenado e o oraculo mediria a memoria, nao o disco.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});

  const recarregada = await exigirCaixaCA(page, 'afirmar que a escolha sobreviveu ao F5');
  expect(recarregada.valor,
    `depois do F5 a CA continua sendo a do Monge (${CA_MONGE}): sem isso a escolha so vivia em memoria`)
    .toBe(CA_MONGE);
  expect(recarregada.rotulo, 'e o rotulo continua nomeando o Monge').toContain('Monge');

  expect(erros, `erros de console/pagina: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Oraculo 3 -- a guarda contra vacuidade, medida de frente
// ============================================================
//
// O Oraculo 4 afirma AUSENCIA. Uma afirmacao de ausencia so vale se o
// lugar onde se procura estiver de fato montado -- este oraculo prova
// isso separadamente, nos DOIS fixtures, para que o canario nao possa
// passar por a ficha do Monge simplesmente nao ter renderizado.
//
// As duas metades sao o mesmo par, aplicado aos dois personagens: a caixa
// da CA existe e exibe um numero em AMBOS; o seletor existe em um e nao no
// outro. Se as duas fichas dessem `null` na caixa, este oraculo cai --
// e o 4 nao chegaria a ser lido como verde.
test('Oraculo 3 -- a caixa da CA existe e exibe numero nos DOIS fixtures (guarda contra vacuidade)', async ({ context }) => {
  const idMulti = 'regras-3d-ca-oraculo-3-multi';
  const idUnico = 'regras-3d-ca-oraculo-3-unico';

  const multi = await abrirFichaCA(context, BARBARO5_MONGE5, {}, idMulti);
  const caixaMulti = await exigirCaixaCA(multi.page, 'comparar as duas fichas');
  expect(caixaMulti.valor, `Barbaro 5/Monge 5 sem armadura: ${CA_BARBARO}`).toBe(CA_BARBARO);
  expect(caixaMulti.bruto,
    'a caixa tem de trazer o numero, e nao um texto vazio -- vazio passaria toda comparacao adiante')
    .not.toBe('');

  const unico = await abrirFichaCA(context, MONGE5_SOZINHO, {}, idUnico);
  const caixaUnico = await exigirCaixaCA(unico.page, 'comparar as duas fichas');
  expect(caixaUnico.valor,
    `Monge 5 de classe unica sem armadura: ${CA_MONGE}. A ficha dele RENDERIZA -- `
    + 'e por isso que a ausencia do seletor, no Oraculo 4, e ausencia de verdade')
    .toBe(CA_MONGE);

  // O par, em uma linha: o mesmo widget presente num e ausente no outro.
  expect([caixaMulti.naPagina, caixaUnico.naPagina],
    'o seletor existe no multiclasse (2 candidatas) e nao existe no classe unica (1 candidata)')
    .toEqual([1, 0]);

  expect(multi.erros, `erros no multiclasse: ${multi.erros.join('; ')}`).toEqual([]);
  expect(unico.erros, `erros no classe unica: ${unico.erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Oraculo 4 (o canario) -- Monge 5 de classe unica: NADA na tela
// ============================================================
//
// Este e o oraculo que prende a decisao de produto de
// docs/PERGUNTAS-PENDENTES.txt:246-257: "com uma candidata so, nada
// aparece na tela".
//
// Vale tambem como a garantia central desta tarefa inteira: classe unica
// nao pode mudar. Todo personagem de classe unica do app tem no maximo UMA
// CA alternativa -- entao, se o seletor aparecesse aqui, ele apareceria
// para a base inteira de usuarios que nunca pediu multiclasse.
//
// As duas metades: a caixa da CA esta montada e exibe 13 (positiva); o
// seletor nao existe nem na caixa nem em lugar nenhum da pagina, e o HTML
// da caixa nao carrega o gatilho (negativa).
test('Oraculo 4 (canario) -- Monge 5 de classe unica: o seletor NAO aparece', async ({ context }) => {
  const id = 'regras-3d-ca-oraculo-4';
  const { page, erros } = await abrirFichaCA(context, MONGE5_SOZINHO, {}, id);

  // ---------- Metade positiva: a caixa esta montada e correta ----------
  const caixa = await exigirCaixaCA(page, 'afirmar que o seletor NAO aparece');
  expect(caixa.valor,
    `Monge 5 sem armadura: 10 + Des(+2) + Sab(+1) = ${CA_MONGE}. A Defesa sem Armadura `
    + 'continua valendo -- o que nao existe e a ESCOLHA')
    .toBe(CA_MONGE);

  // ---------- Metade negativa: o gatilho nao existe ----------
  expect(caixa.naCaixa,
    'uma candidata so nao e escolha: a caixa da CA de um Monge de classe unica '
    + 'tem de ficar identica ao que era antes desta tarefa')
    .toBe(0);
  expect(caixa.naPagina,
    'e o gatilho nao pode ter vazado para outro canto da ficha')
    .toBe(0);
  expect(caixa.html,
    'nem o atributo de gatilho pode aparecer no HTML da caixa')
    .not.toContain('data-ca-acao');

  expect(erros, `erros de console/pagina: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Oraculo 5 -- o ESCUDO: o contexto de equipamento nao e opcional
// ============================================================
//
// O aviso mais importante que a Tarefa 3 deixou, e um bug ja pago (commit
// 12a541b): o Monge PERDE a Defesa sem Armadura ao empunhar um Escudo
// (Classes.md:5174-5176), o Barbaro NAO (Classes.md:91-93).
//
// Logo, um Barbaro 5/Monge 5 DE ESCUDO tem uma candidata so -- e o seletor
// tem de sumir, exatamente como no Monge de classe unica.
//
// Mata: a ficha (ou o handler) que chame `coletarCAsAlternativas(char)` sem
// `{ temArmadura, temEscudo }`. Nesse caso as duas candidatas voltariam, o
// seletor apareceria oferecendo o Monge, e o jogador poderia escolher uma
// fonte que `calcCA` nao usa -- o numero da tela ficaria em 18 enquanto o
// seletor jurasse "Monge". Este oraculo e o unico do arquivo que distingue
// "passou o contexto" de "chamou o coletor".
//
// O par: mesmo personagem, mesmo nivel, SO o Escudo muda -- e a resposta
// tem de mudar nas duas pontas (numero sobe 2, seletor desaparece).
test('Oraculo 5 -- Barbaro 5/Monge 5 COM Escudo: sobra uma candidata, o seletor some e a CA sobe 2', async ({ context }) => {
  const idSem = 'regras-3d-ca-oraculo-5-sem-escudo';
  const idCom = 'regras-3d-ca-oraculo-5-com-escudo';

  // ---------- Metade sem Escudo: duas candidatas ----------
  const sem = await abrirFichaCA(context, BARBARO5_MONGE5, { inventario: [] }, idSem);
  const caixaSem = await exigirCaixaCA(sem.page, 'comparar com o mesmo personagem de Escudo');
  expect(caixaSem.valor, `sem Escudo, o maior valor: ${CA_BARBARO}`).toBe(CA_BARBARO);
  expect(caixaSem.naPagina,
    'sem Escudo as duas Defesas sem Armadura valem, e ha escolha a fazer')
    .toBe(1);

  // ---------- Metade com Escudo: o Monge sai, sobra uma ----------
  const com = await abrirFichaCA(
    context, BARBARO5_MONGE5, { inventario: [escudoEquipado()] }, idCom);
  const caixaCom = await exigirCaixaCA(com.page, 'afirmar que o seletor sumiu com o Escudo');
  expect(caixaCom.valor,
    `com Escudo so a fonte do Barbaro sobrevive, e o Escudo soma 2: ${CA_BARBARO_COM_ESCUDO}`)
    .toBe(CA_BARBARO_COM_ESCUDO);
  expect(caixaCom.naPagina,
    'o Monge perde a Defesa sem Armadura ao empunhar Escudo (Classes.md:5174-5176): '
    + 'sobra UMA candidata, e uma candidata so nao mostra seletor. Se ele aparecer aqui, '
    + 'o coletor foi chamado SEM `{ temArmadura, temEscudo }`')
    .toBe(0);
  expect(caixaCom.html,
    'e o gatilho nao pode estar escondido no HTML da caixa')
    .not.toContain('data-ca-acao');

  expect(sem.erros, `erros sem Escudo: ${sem.erros.join('; ')}`).toEqual([]);
  expect(com.erros, `erros com Escudo: ${com.erros.join('; ')}`).toEqual([]);
});
