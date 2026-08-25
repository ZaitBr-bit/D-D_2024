// ============================================================
// Combate e defesas de um personagem MULTICLASSE (sub-projeto 3d).
//
// O QUE ESTE ARQUIVO COBRE
// ------------------------
// Tarefa 1 (este arquivo nasce com ela): SALVAGUARDAS.
//   - Sobrevivente Disciplinado, a proficiência nas seis salvaguardas que
//     o Monge 14 ganha (Classes.md:5266), medida por
//     site/js/regras-salvaguardas.js.
//   - Sentido de Perigo, a vantagem em salvaguarda de Destreza do
//     Bárbaro 2 (Classes.md:105-107), medida no HTML que
//     site/js/sheet/ficha.js gera.
//   - O CONGELAMENTO da regra de que uma classe NÃO inicial não concede
//     salvaguarda nenhuma (livro:2051 + as 12 listas "Como um Personagem
//     Multiclasse" de Classes.md).
// As Tarefas 2, 3 e 5 do mesmo sub-projeto acrescentam a este arquivo --
// os helpers abaixo (`renderizarFicha`, `personagemComSalvaguardasDaInicial`,
// `criarContainerStub`) existem para serem reusados por elas.
//
// O DEFEITO QUE A TAREFA 1 FECHA
// ------------------------------
// Num personagem de duas classes, `char.classe` é a classe INICIAL e
// `char.nivel` é o total. Cruzar os dois erra nos DOIS sentidos, e por
// isso todo oráculo aqui é um PAR em direções opostas -- uma asserção
// sozinha sobrevive à implementação errada:
//
//   Monge 10/Ladino 4 (total 14) -> o app dava as SEIS salvaguardas,
//                                    quatro níveis de Monge antes da hora.
//   Ladino 1/Monge 14 (total 15) -> o app dava só Destreza e Inteligência,
//                                    porque a classe inicial é Ladino.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, lerConteudoLivro } from './harness.mjs';
import { TRACOS_BASICOS } from '../catalogo/classes.mjs';

const TODAS_AS_SALVAGUARDAS = ['Força', 'Destreza', 'Constituição',
                               'Inteligência', 'Sabedoria', 'Carisma'];

const CLASSES = [
  'Bárbaro', 'Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro',
  'Guardião', 'Guerreiro', 'Ladino', 'Mago', 'Monge', 'Paladino',
];

// ============================================================
// Helpers reusáveis (Tarefas 2, 3 e 5 herdam estes)
// ============================================================

/**
 * Container mínimo que renderFichaCompleta() aceita: ele só escreve em
 * `innerHTML` e depois varre o DOM com optional chaining / listas vazias,
 * então seis linhas bastam para capturar o HTML gerado.
 * @returns {object} stub de elemento com innerHTML capturado.
 */
function criarContainerStub() {
  let htmlCapturado = '';
  return {
    get innerHTML() { return htmlCapturado; },
    set innerHTML(v) { htmlCapturado = v; },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
  };
}

/**
 * Monta um personagem multiclasse e grava nele as DUAS salvaguardas da
 * classe INICIAL -- exatamente o que creator/wizard.js:442 faz na criação
 * (`personagem.salvaguardas_proficientes = info.salvaguardas`), que é o
 * único ponto do app que escreve salvaguarda de classe.
 * Semear isso à mão é necessário porque `personagemMulticlasse` monta a
 * ficha direto de classes[], sem passar pelo criador.
 * @param {Array<{classe: string, nivel: number, subclasse?: string}>} roteiro
 * @returns {Promise<object>} personagem com espelhos sincronizados.
 */
async function personagemComSalvaguardasDaInicial(roteiro) {
  const p = await personagemMulticlasse(roteiro);
  p.salvaguardas_proficientes = [...TRACOS_BASICOS[roteiro[0].classe].salvaguardas];
  return p;
}

/**
 * Deixa o estado de sheet/estado.js apontando para `p`, como
 * pages/sheet.js faz ao abrir a ficha. Extraído de `renderizarFicha` na
 * Tarefa 5, que precisa do MESMO estado para disparar o Descanso Longo sem
 * renderizar nada -- o corpo é o de antes, sem uma linha a mais.
 * @param {object} p Personagem já montado.
 * @param {object} container Stub de container da ficha.
 * @returns {Promise<void>}
 */

/**
 * Roda renderFichaCompleta() de verdade sobre o personagem e devolve o
 * HTML que a ficha produziu. Mede o RENDER, não uma reimplementação da
 * condição dentro do teste.
 * @param {object} p Personagem já montado.
 * @returns {Promise<string>} HTML da ficha.
 */
async function prepararEstadoDaFicha(p, container) {
  const { sheetEstado, db, levelup, contextoClasse } = await modulosApp();

  const mapaClasses = new Map();
  for (const ctx of contextoClasse.montarContextos(p, new Map())) {
    mapaClasses.set(ctx.classe, await db.getClasse(ctx.classe));
  }

  sheetEstado.definirChar(p);
  sheetEstado.definirContainer(container);
  sheetEstado.definirClasseData(mapaClasses.get(p.classe) || null);
  sheetEstado.definirClassesData(mapaClasses);
  const indiceMagias = await db.getIndiceMagias();
  sheetEstado.definirIndiceMagias(indiceMagias?.magias || []);
  sheetEstado.definirTalentos(await db.getTalentos());
  sheetEstado.definirEspecies(await db.getEspecies());
  sheetEstado.definirMagiasDominio(
    await levelup.obterTodasMagiasDominio(p.classe, p.subclasse, p.nivel));
  sheetEstado.definirMagiasSempre(
    await levelup.obterTodasMagiasSemprePreparadas(p.classe, p.subclasse, p.nivel));
}

async function renderizarFicha(p) {
  const { sheetFicha } = await modulosApp();
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);
  sheetFicha.renderFichaCompleta();
  return container.innerHTML;
}

// A marca do Sentido de Perigo no HTML. NÃO usar o nome curto sozinho: ele
// também aparece como CARACTERÍSTICA na lista de habilidades de qualquer
// Bárbaro 2+, independentemente desta condição -- o nome curto ficaria
// verde nos dois lados do par e não mediria nada. O `data-vd-info` do badge
// de vantagem (ficha.js, bloco `salvaguardas-grid`) só é escrito quando a
// condição sob teste passa.
const MARCA_SENTIDO_DE_PERIGO = 'data-vd-info="Vantagem: Sentido de Perigo"';

// ============================================================
// Oráculos 1-3: Sobrevivente Disciplinado (Monge 14)
// ============================================================

test('Monge 10/Ladino 4 (total 14) NÃO tem as seis salvaguardas', async () => {
  // A metade "cedo demais" do defeito: o espelho `char.classe` aponta para
  // Monge (a inicial) e `char.nivel` é 14 (o TOTAL), então o app concedia
  // Sobrevivente Disciplinado a um personagem com apenas 10 níveis de Monge.
  const { regrasSalvaguardas } = await modulosApp();
  const p = await personagemComSalvaguardasDaInicial([
    { classe: 'Monge', nivel: 10, subclasse: 'Combatente da Mão Espalmada' },
    { classe: 'Ladino', nivel: 4, subclasse: 'Ladrão' },
  ]);
  assert.equal(p.nivel, 14, 'o total tem de ser 14 -- é ele que enganava o app');
  const obtidas = regrasSalvaguardas.salvaguardasProficientes(p);
  assert.deepEqual([...obtidas].sort(), ['Destreza', 'Força'],
    'Sobrevivente Disciplinado é de MONGE 14; este personagem tem 10 níveis de Monge');
});

test('Ladino 1/Monge 14 (total 15) TEM as seis salvaguardas', async () => {
  // A metade "tarde demais": a classe inicial é Ladino, então o espelho
  // `char.classe` nunca era 'Monge' e a concessão jamais chegava, apesar
  // dos 14 níveis de Monge conquistados.
  const { regrasSalvaguardas } = await modulosApp();
  const p = await personagemComSalvaguardasDaInicial([
    { classe: 'Ladino', nivel: 1 },
    { classe: 'Monge', nivel: 14, subclasse: 'Combatente da Mão Espalmada' },
  ]);
  assert.equal(p.classe, 'Ladino', 'o espelho aponta para a inicial, que é Ladino');
  const obtidas = regrasSalvaguardas.salvaguardasProficientes(p);
  assert.deepEqual([...obtidas].sort(), [...TODAS_AS_SALVAGUARDAS].sort(),
    'Sobrevivente Disciplinado chega com 14 níveis de MONGE, seja qual for a classe inicial');
});

test('canário: Monge 14 de classe única continua com as seis', async () => {
  // Contrapeso do par: a conversão não pode consertar o multiclasse
  // quebrando o caso de classe única, que é o que 100% das fichas de hoje são.
  const { regrasSalvaguardas } = await modulosApp();
  const p = await personagemComSalvaguardasDaInicial([
    { classe: 'Monge', nivel: 14, subclasse: 'Combatente da Mão Espalmada' },
  ]);
  const obtidas = regrasSalvaguardas.salvaguardasProficientes(p);
  assert.deepEqual([...obtidas].sort(), [...TODAS_AS_SALVAGUARDAS].sort());

  // E uma ficha LEGADA (sem classes[], só os espelhos) também -- é assim
  // que um personagem chega antes da migração.
  const legado = { classe: 'Monge', nivel: 14,
                   salvaguardas_proficientes: ['Força', 'Destreza'] };
  assert.deepEqual(
    [...regrasSalvaguardas.salvaguardasProficientes(legado)].sort(),
    [...TODAS_AS_SALVAGUARDAS].sort(),
    'classesDe() normaliza a ficha legada para classes[] de uma entrada');
});

// ============================================================
// Oráculos 4-5: Sentido de Perigo (Bárbaro 2)
// ============================================================

test('Ladino 1/Bárbaro 5 TEM vantagem em salvaguarda de Destreza', async () => {
  // O Bárbaro é a SEGUNDA classe: `char.classe` é 'Ladino', então a
  // condição antiga (`char.classe === 'Bárbaro'`) barrava a vantagem de um
  // personagem com 5 níveis de Bárbaro.
  const html = await renderizarFicha(await personagemComSalvaguardasDaInicial([
    { classe: 'Ladino', nivel: 1 },
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
  ]));
  assert.ok(html.includes(MARCA_SENTIDO_DE_PERIGO),
    'Sentido de Perigo é característica de BÁRBARO 2 (Classes.md:105-107) -- ' +
    'este personagem tem 5 níveis de Bárbaro');
});

test('Bárbaro 1/Ladino 5 (total 6) NÃO tem vantagem em salvaguarda de Destreza', async () => {
  // A direção oposta: o Bárbaro é a inicial (o espelho bate) e o total é 6
  // (>= 2), mas o personagem tem UM nível de Bárbaro -- Sentido de Perigo
  // ainda não chegou. Sem este par, `nivelNa(char, 'Bárbaro') >= 0` passaria.
  const p = await personagemComSalvaguardasDaInicial([
    { classe: 'Bárbaro', nivel: 1 },
    { classe: 'Ladino', nivel: 5, subclasse: 'Ladrão' },
  ]);
  assert.equal(p.nivel, 6, 'o total é 6 -- era ele que o app lia');
  const html = await renderizarFicha(p);
  assert.ok(!html.includes(MARCA_SENTIDO_DE_PERIGO),
    'Sentido de Perigo exige 2 níveis de BÁRBARO; este personagem tem 1');
});

// ============================================================
// Oráculo 6: CONGELAMENTO da regra -- classe não inicial não concede
// salvaguarda nenhuma.
// ============================================================
//
// A regra NÃO é uma frase do livro. `livro:2051` diz que ao multiclassear
// "você obtém APENAS ALGUMAS das proficiências iniciais dessa nova classe,
// conforme detalhado na descrição de cada classe" -- e são as 12 listas
// "Como um Personagem Multiclasse" de Classes.md que ENUMERAM o que cada
// classe concede. A negativa é DERIVADA da enumeração: salvaguarda não
// aparece em nenhuma das 12.
//
// Por isso este oráculo varre as 12 listas em vez de afirmar uma frase, e é
// um PAR: a mesma palavra que está AUSENTE nas 12 listas reduzidas está
// PRESENTE nas 12 tabelas "Traços Básicos" (a lista completa, que só a
// classe inicial recebe). Sem a metade positiva, um parser quebrado que
// devolvesse texto vazio ficaria verde afirmando nada.

/** Corpo de uma seção lida de Classes.md, com a linha de origem. */
const ARQUIVO_CLASSES = 'Classes.md';

// Uma linha encerra o corpo de uma lista: heading (`#`), linha de tabela
// markdown (`|`) ou legenda em negrito isolada (`**Características de X**`).
const FIM_DE_LISTA = /^(#{1,6}\s|\||\s*\*\*.*\*\*\s*$)/;
const HEADING_MULTICLASSE = /^#{1,3}\s+Como um Personagem Multiclasse\s*$/;

/**
 * Extrai as 12 listas "Como um Personagem Multiclasse" de Classes.md.
 * O nível do heading varia no arquivo (`###` em 10 classes, `##` em
 * Guerreiro e Paladino), por isso o regex aceita de `#` a `###`.
 * @returns {Array<{linha: number, classe: string, corpo: string}>}
 */
function lerListasMulticlasse() {
  const linhas = lerConteudoLivro(ARQUIVO_CLASSES).split('\n');
  const secoes = [];
  for (let i = 0; i < linhas.length; i++) {
    if (!HEADING_MULTICLASSE.test(linhas[i])) continue;
    const corpo = [];
    for (let j = i + 1; j < linhas.length; j++) {
      if (FIM_DE_LISTA.test(linhas[j])) break;
      corpo.push(linhas[j]);
    }
    const texto = corpo.join('\n').trim();
    const nome = texto.match(/Traços Básicos de ([^\s:.,]+)/);
    secoes.push({ linha: i + 1, classe: nome ? nome[1] : '(não identificada)', corpo: texto });
  }
  return secoes;
}

/**
 * Extrai as 12 tabelas "Traços Básicos de X" de Classes.md -- a lista
 * COMPLETA de proficiências iniciais, que só a classe inicial concede.
 * Uma ocorrência da legenda só conta quando a próxima linha não vazia
 * começa com `|`; assim as citações da legenda dentro das listas de
 * multiclasse não entram na conta.
 * @returns {Array<{linha: number, classe: string, corpo: string}>}
 */
function lerTabelasTracosBasicos() {
  const linhas = lerConteudoLivro(ARQUIVO_CLASSES).split('\n');
  // "de Clérigo" na maioria, "do Clérigo" no Clérigo -- o arquivo mistura
  // as duas preposições.
  const LEGENDA = /Traços Básicos d[eo] ([^\s:.,*|]+)/;
  const tabelas = [];
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(LEGENDA);
    if (!m) continue;
    let j = i + 1;
    while (j < linhas.length && !linhas[j].trim()) j++;
    if (!linhas[j] || !linhas[j].trim().startsWith('|')) continue;
    const corpo = [];
    for (; j < linhas.length && linhas[j].trim().startsWith('|'); j++) corpo.push(linhas[j]);
    tabelas.push({ linha: i + 1, classe: m[1], corpo: corpo.join('\n') });
  }
  return tabelas;
}

// O rótulo da linha de salvaguarda NÃO é literal no arquivo: 6 classes
// escrevem "Proficiência em Salvaguardas" e o Clérigo escreve
// "Proficiências em Salvaguarda". A varredura procura o RADICAL, sem caixa
// -- qualquer menção a salvaguarda dentro de uma lista de multiclasse
// derruba o oráculo, que é o que se quer.
const MENCAO_A_SALVAGUARDA = /salvaguarda/i;

test('congelamento: nenhuma das 12 listas "Como um Personagem Multiclasse" concede salvaguarda', () => {
  const listas = lerListasMulticlasse();

  // Falha ALTO se o parser não achou as 12: um parser que devolvesse []
  // afirmaria a ausência sobre nada.
  assert.equal(listas.length, 12,
    `achei ${listas.length} lista(s) "Como um Personagem Multiclasse" em ${ARQUIVO_CLASSES}, ` +
    'esperava exatamente 12 (uma por classe) -- o arquivo ou o parser mudaram de forma');
  assert.deepEqual([...listas.map((s) => s.classe)].sort(), [...CLASSES].sort(),
    'as 12 listas têm de cobrir exatamente as 12 classes do app');

  // Guarda de que o corpo extraído é a lista de verdade, e não texto vazio:
  // as 12 concedem Dado de Ponto de Vida, e é a única concessão universal.
  for (const s of listas) {
    assert.match(s.corpo, /Dado de Ponto de Vida/,
      `a lista de ${s.classe} (${ARQUIVO_CLASSES}:${s.linha}) não menciona Dado de Ponto de Vida -- ` +
      'o parser não capturou o corpo certo');
  }

  // A AFIRMAÇÃO. Se alguma lista conceder salvaguarda, a regra que este
  // sub-projeto assume é OUTRA e o spec está errado -- por isso a mensagem
  // manda parar, não ajustar o teste.
  const concedem = listas.filter((s) => MENCAO_A_SALVAGUARDA.test(s.corpo));
  assert.deepEqual(concedem.map((s) => `${s.classe} (${ARQUIVO_CLASSES}:${s.linha})`), [],
    'alguma lista "Como um Personagem Multiclasse" menciona salvaguarda. A regra derivada ' +
    'aqui -- classe NÃO inicial não concede salvaguarda (livro:2051 + a enumeração fechada ' +
    'das 12 listas) -- deixa de valer. PARE e reveja o spec antes de mexer neste oráculo.');
});

test('o par: as 12 tabelas "Traços Básicos" (lista completa da inicial) CONCEDEM salvaguarda', () => {
  // A metade positiva. É a mesma palavra, no mesmo arquivo, pela mesma
  // mecânica de varredura: presente na lista COMPLETA das 12 classes,
  // ausente nas 12 listas REDUZIDAS de multiclasse. É essa diferença que
  // torna a negativa acima uma medição, e não um parser mudo.
  const tabelas = lerTabelasTracosBasicos();
  assert.equal(tabelas.length, 12,
    `achei ${tabelas.length} tabela(s) "Traços Básicos" em ${ARQUIVO_CLASSES}, esperava 12`);
  assert.deepEqual([...tabelas.map((t) => t.classe)].sort(), [...CLASSES].sort());
  for (const t of tabelas) {
    assert.match(t.corpo, MENCAO_A_SALVAGUARDA,
      `a tabela Traços Básicos de ${t.classe} (${ARQUIVO_CLASSES}:${t.linha}) não menciona ` +
      'salvaguarda -- sem ela a varredura negativa acima não prova nada');
  }
});

// ============================================================
// Oráculo 7: CONGELAMENTO do código -- há UM único escritor de
// salvaguarda de classe, e ele roda só na criação.
// ============================================================

test('congelamento: só creator/wizard.js escreve salvaguarda vinda da CLASSE', async () => {
  // A armadilha que o sub-projeto 5 (entrada numa classe nova) vai
  // encontrar é copiar `info.salvaguardas` de novo ao entrar na segunda
  // classe. Hoje isso está certo por CONSTRUÇÃO DO FLUXO -- wizard.js:442
  // roda uma vez, na criação, sobre a classe que por definição é a inicial
  // --, não por decisão registrada. Este oráculo registra a decisão.
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const { RAIZ } = await import('./harness.mjs');

  /** Lista recursivamente todos os .js sob um diretório. */
  function listarJs(dir) {
    const saida = [];
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) saida.push(...listarJs(caminho));
      else if (nome.endsWith('.js')) saida.push(caminho);
    }
    return saida;
  }

  // ATRIBUIÇÃO ao campo do personagem -- `=` seguido de algo que não é `=`,
  // para não confundir com `===`. Deliberadamente NÃO tenta reconhecer a
  // FONTE do valor (`info.salvaguardas`, `classeData`, ...): a primeira
  // versão deste regex procurava `= info.salvaguardas` e casava com
  // `creator/passo-classe.js:71`, que é um `const salvaguardas = ...` local
  // só para MOSTRAR a dupla no popup da classe -- não escreve no
  // personagem. Prender a atribuição ao campo é o recorte que não erra.
  const ESCRITA_NO_CAMPO = /salvaguardas_proficientes\s*=[^=]/;

  // Comparado por ARQUIVO + TEXTO da linha, nunca por número de linha: as
  // Tarefas 2, 3 e 5 editam levelup.js e wizard.js, e um oráculo preso a
  // número de linha ficaria vermelho por deslocamento, não por regressão.
  const ESCRITORES_CONHECIDOS = [
    // A ÚNICA escrita de salvaguarda vinda da CLASSE, e ela roda uma vez só,
    // na criação -- sobre a classe que por definição é a INICIAL.
    'creator/wizard.js :: personagem.salvaguardas_proficientes = info.salvaguardas;',
    // Talento Resiliente: só cria o array vazio antes de dar push no
    // atributo ESCOLHIDO pelo jogador. Não vem da classe.
    'levelup.js :: if (!personagem.salvaguardas_proficientes) personagem.salvaguardas_proficientes = [];',
  ];

  const achados = [];
  for (const caminho of listarJs(resolve(RAIZ, 'site/js'))) {
    const relativo = caminho.replace(/\\/g, '/').split('site/js/')[1];
    readFileSync(caminho, 'utf-8').split('\n').forEach((linha, i) => {
      if (ESCRITA_NO_CAMPO.test(linha)) {
        achados.push({ chave: `${relativo} :: ${linha.trim()}`, onde: `${relativo}:${i + 1}` });
      }
    });
  }

  // Direção 1: o conjunto de escritores é exatamente o conhecido. Se o
  // sub-projeto 5 acrescentar `personagem.salvaguardas_proficientes =
  // info.salvaguardas` ao fluxo de entrar numa classe nova, isto fica
  // vermelho e mostra onde.
  assert.deepEqual(achados.map((a) => a.chave).sort(), [...ESCRITORES_CONHECIDOS].sort(),
    'a classe NÃO inicial não concede salvaguarda (livro:2051 + as 12 listas de Classes.md). ' +
    `Escritores de salvaguardas_proficientes encontrados: ${achados.map((a) => a.onde).join(', ')}. ` +
    'Se um fluxo novo (entrar numa classe adicional) precisa gravar salvaguarda, a regra ' +
    'mudou -- reveja o spec antes de mexer neste oráculo.');

  // Direção 2 (o par): a proibição acima não pode ser a única metade -- um
  // oráculo que só PROÍBE nunca prova que a concessão legítima continua
  // acontecendo. Esta metade afirma o resultado observável: as salvaguardas
  // do personagem são as da INICIAL, e só elas.
  const { regrasSalvaguardas } = await modulosApp();
  const p = await personagemComSalvaguardasDaInicial([
    { classe: 'Ladino', nivel: 1 },
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
  ]);
  assert.deepEqual([...regrasSalvaguardas.salvaguardasProficientes(p)].sort(),
    [...TRACOS_BASICOS['Ladino'].salvaguardas].sort(),
    'um Ladino 1/Bárbaro 5 tem as salvaguardas do LADINO (a inicial) e nenhuma do Bárbaro');
});

// ------------------------------------------------------------
// Mente Escorregadia (Ladino 15) -- a SEGUNDA concessao automatica de
// salvaguarda do livro, que a funcao nao tratava.
//
//   Classes.md:4284 -- "Voce adquire proficiencia em salvaguardas de
//   Sabedoria e Carisma."
//
// NAO e defeito de multiclasse: atingia todo Ladino 15 de classe unica. O
// app ja mostrava o TEXTO da caracteristica na ficha e a grade nunca marcava
// nada -- o app se contradizia na mesma tela. Achado ao converter
// Sobrevivente Disciplinado, que e da mesma familia.
//
// O par de direcoes opostas aqui e por NIVEL: 14 nao tem, 15 tem. Sem a
// metade negativa, um `return ['Sabedoria','Carisma']` incondicional passaria.
// ------------------------------------------------------------
test('Mente Escorregadia: Ladino 15 de classe unica ganha Sabedoria e Carisma', async () => {
  const { regrasSalvaguardas } = await modulosApp();
  const p = await personagemComSalvaguardasDaInicial([
    { classe: 'Ladino', subclasse: 'Ladrão', nivel: 15, ordem: 0 },
  ]);
  const lista = regrasSalvaguardas.salvaguardasProficientes(p);
  assert.ok(lista.includes('Sabedoria'),
    'Ladino 15 tem Mente Escorregadia (Classes.md:4284): Sabedoria');
  assert.ok(lista.includes('Carisma'),
    'Ladino 15 tem Mente Escorregadia (Classes.md:4284): Carisma');
});

test('Mente Escorregadia: Ladino 14 ainda NAO tem', async () => {
  const { regrasSalvaguardas } = await modulosApp();
  const p = await personagemComSalvaguardasDaInicial([
    { classe: 'Ladino', subclasse: 'Ladrão', nivel: 14, ordem: 0 },
  ]);
  const lista = regrasSalvaguardas.salvaguardasProficientes(p);
  assert.deepEqual([...lista].sort(), [...TRACOS_BASICOS['Ladino'].salvaguardas].sort(),
    'Ladino 14: so as salvaguardas basicas da classe, sem Mente Escorregadia');
});

test('Mente Escorregadia conta o nivel NA CLASSE: Guerreiro 10/Ladino 15 tem, Ladino 10/Guerreiro 5 nao', async () => {
  const { regrasSalvaguardas } = await modulosApp();

  // Total 25 e impossivel na pratica, mas o ponto e isolar a variavel: o que
  // manda e o nivel de LADINO, nao o total nem a classe inicial.
  const tem = await personagemComSalvaguardasDaInicial([
    { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 10, ordem: 0 },
    { classe: 'Ladino', subclasse: 'Ladrão', nivel: 15, ordem: 1 },
  ]);
  assert.ok(regrasSalvaguardas.salvaguardasProficientes(tem).includes('Carisma'),
    'Ladino 15 como SEGUNDA classe tambem ganha Mente Escorregadia');

  // Total 15, mas so 10 de Ladino: nao tem.
  const naoTem = await personagemComSalvaguardasDaInicial([
    { classe: 'Ladino', subclasse: 'Ladrão', nivel: 10, ordem: 0 },
    { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 5, ordem: 1 },
  ]);
  assert.ok(!regrasSalvaguardas.salvaguardasProficientes(naoTem).includes('Carisma'),
    'Ladino 10/Guerreiro 5 (total 15) NAO tem: o nivel que manda e o de Ladino');
});

// ============================================================
// Tarefa 2: ATAQUE EXTRA (getAtaquesPorAcao)
//
// A funcao NAO mora em site/js/utils.js, como o brief da tarefa diz --
// mora em site/js/sheet/combate.js:238, e le o personagem do estado de
// modulo (site/js/sheet/estado.js), nao de um parametro.
//
// O DEFEITO: `const nivel = char?.nivel` (o TOTAL) cruzado com
// `char?.classe` (o espelho da classe INICIAL). Erra nos DOIS sentidos:
//
//   Guerreiro 4/Barbaro 1 (total 5) -> o app dava 2 ataques; nenhuma das
//                                      duas classes chegou ao nivel 5.
//   Ladino 1/Guerreiro 11 (total 12) -> o app dava 1; a classe inicial e
//                                       Ladino, entao o bloco do Guerreiro
//                                       nunca era alcancado, apagando os
//                                       DOIS ataques que os 11 niveis de
//                                       Guerreiro concedem.
//
// A REGRA (livro:2059-2063, capitulo 2): "Se voce adquirir a
// caracteristica Ataque Extra de mais de uma classe, as caracteristicas
// nao se acumulam. Voce nao pode realizar mais de dois ataques com essa
// caracteristica, a menos que tenha uma caracteristica que permita isso
// (como a caracteristica Dois Ataques Extras do Guerreiro)." Ou seja:
// MAIOR valor entre as classes, nunca soma, e cada classe conta pelo
// nivel NAQUELA classe.
//
// Guerreiro 5/Barbaro 5 ACERTA POR ACASO na implementacao antiga (o
// espelho aponta para Guerreiro e o total 10 passa do 5 exigido) -- e
// exatamente o fixture que um teste de fumaca escolheria, e por isso o
// defeito sobreviveu. Ele entra aqui como canario: nasce verde e prova
// que a conversao nao quebrou o caminho comum.
// ============================================================

// Import DINAMICO e DEPOIS de modulosApp(), pelo mesmo motivo documentado
// em classes-passivas.test.mjs:74-79: combate.js grava
// `window.mostrarCalculoCarga` no top-level do modulo, e `window` so
// existe porque modulosApp() ja chamou instalarStubs().
const { sheetEstado: estadoAtaques } = await modulosApp();
const sheetCombate = await import('../../../site/js/sheet/combate.js');

/**
 * Monta o personagem, publica-o no estado de modulo da ficha e devolve o
 * numero de ataques que getAtaquesPorAcao() de verdade calcula.
 * Mede a FUNCAO DO APP, nao uma reimplementacao da regra dentro do teste.
 * @param {Array<{classe: string, nivel: number, subclasse?: string}>} roteiro
 * @returns {Promise<number>} ataques por acao.
 */
async function ataquesDe(roteiro) {
  const p = await personagemMulticlasse(roteiro);
  estadoAtaques.definirChar(p);
  return sheetCombate.getAtaquesPorAcao();
}

test('Guerreiro 4/Barbaro 1 (total 5) tem 1 ataque -- nenhuma classe chegou ao 5', async () => {
  // Metade "infla" do defeito: o espelho aponta para Guerreiro e o TOTAL e
  // 5, entao o app entregava o Ataque Extra a um personagem com 4 niveis
  // de Guerreiro e 1 de Barbaro. Ataque Extra e do nivel 5 DA CLASSE.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 4, subclasse: 'Campeão' },
    { classe: 'Bárbaro', nivel: 1 },
  ]);
  assert.equal(p.nivel, 5, 'o total tem de ser 5 -- e ele que enganava o app');
  assert.equal(p.classe, 'Guerreiro', 'o espelho aponta para Guerreiro, a inicial');
  estadoAtaques.definirChar(p);
  assert.equal(sheetCombate.getAtaquesPorAcao(), 1,
    'Ataque Extra exige 5 niveis DE GUERREIRO; este personagem tem 4 (e 1 de Barbaro)');
});

test('Monge 4/Ladino 1 (total 5) tem 1 ataque', async () => {
  // Mesma metade "infla", em outra classe -- o bloco do Monge tem a mesma
  // forma do bloco do Guerreiro e nao poderia ser consertado so no primeiro.
  const p = await personagemMulticlasse([
    { classe: 'Monge', nivel: 4, subclasse: 'Combatente da Mão Espalmada' },
    { classe: 'Ladino', nivel: 1 },
  ]);
  assert.equal(p.nivel, 5, 'o total tem de ser 5');
  estadoAtaques.definirChar(p);
  assert.equal(sheetCombate.getAtaquesPorAcao(), 1,
    'Ataque Extra do Monge exige 5 niveis DE MONGE; este personagem tem 4');
});

test('Ladino 1/Guerreiro 11 (total 12) tem 3 ataques -- o app apagava dois', async () => {
  // Metade "apaga", a mais grave: a classe inicial e Ladino, entao
  // `char.classe === 'Guerreiro'` era falso e o personagem levava 1 ataque
  // para a mesa em vez dos 3 que os 11 niveis de Guerreiro concedem
  // (Ataque Extra no 5, Dois Ataques Extras no 11).
  const p = await personagemMulticlasse([
    { classe: 'Ladino', nivel: 1 },
    { classe: 'Guerreiro', nivel: 11, subclasse: 'Campeão' },
  ]);
  assert.equal(p.classe, 'Ladino', 'o espelho aponta para a inicial, que e Ladino');
  estadoAtaques.definirChar(p);
  assert.equal(sheetCombate.getAtaquesPorAcao(), 3,
    'Dois Ataques Extras chega com 11 niveis DE GUERREIRO, seja qual for a classe inicial');
});

test('canario: Guerreiro 5/Barbaro 5 continua com 2 ataques', async () => {
  // O caso que ACERTA POR ACASO hoje, e o mais importante depois dos
  // vermelhos: prova que a conversao nao quebrou o caminho que ja
  // funcionava. Tambem e o par de "nao se acumulam" (livro:2059-2063):
  // duas fontes de Ataque Extra qualificadas, e ainda assim 2, nunca 3.
  assert.equal(await ataquesDe([
    { classe: 'Guerreiro', nivel: 5, subclasse: 'Campeão' },
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
  ]), 2, 'duas fontes de Ataque Extra NAO se acumulam (livro:2059-2063): vale a maior, 2');
});

test('canario: Guerreiro 20 de classe unica continua com 4 ataques', async () => {
  // Contrapeso de classe unica, que e o que 100% das fichas de hoje sao.
  assert.equal(await ataquesDe([
    { classe: 'Guerreiro', nivel: 20, subclasse: 'Campeão' },
  ]), 4, 'Tres Ataques Extras (Guerreiro 20) = 4 ataques');

  // E uma ficha LEGADA (sem classes[], so os espelhos) tambem -- e assim
  // que um personagem chega antes da migracao.
  estadoAtaques.definirChar({ classe: 'Guerreiro', subclasse: 'Campeão', nivel: 20 });
  assert.equal(sheetCombate.getAtaquesPorAcao(), 4,
    'classesDe() normaliza a ficha legada para classes[] de uma entrada');
});

// ------------------------------------------------------------
// O ramo de SUBCLASSE (Bardo/Colegio da Bravura, Ataque Extra no nivel 6).
// E o unico ramo da funcao que le `char.subclasse` -- outro espelho da
// classe INICIAL --, e por isso erra pelos DOIS espelhos ao mesmo tempo.
// Sem este par, trocar `char.subclasse` por `subclasseDe(char, 'Bardo')`
// nao seria medido por nada.
// ------------------------------------------------------------
test('Ladino 1/Bardo 6 do Colegio da Bravura tem 2 ataques', async () => {
  // Ambos os espelhos apontam para o Ladino: `char.classe` e 'Ladino' e
  // `char.subclasse` e '' (o Ladino do roteiro nao tem subclasse). A
  // condicao antiga falhava duas vezes.
  const p = await personagemMulticlasse([
    { classe: 'Ladino', nivel: 1 },
    { classe: 'Bardo', nivel: 6, subclasse: 'Colégio da Bravura' },
  ]);
  assert.equal(p.subclasse, '', 'o espelho de subclasse vem da inicial (Ladino, sem subclasse)');
  estadoAtaques.definirChar(p);
  assert.equal(sheetCombate.getAtaquesPorAcao(), 2,
    'Ataque Extra do Colegio da Bravura chega com 6 niveis DE BARDO nessa subclasse');
});

test('Bardo 6 de outro colegio + Guerreiro 4 (total 10) tem 1 ataque', async () => {
  // Direcao oposta, e ela isola as DUAS variaveis de uma vez: o total 10
  // passaria de qualquer patamar, e a subclasse errada nao concede nada.
  // Sem esta metade, um `nivelNa(char, 'Bardo') >= 6` sem conferir a
  // subclasse ficaria verde.
  const p = await personagemMulticlasse([
    { classe: 'Bardo', nivel: 6, subclasse: 'Colégio da Dança' },
    { classe: 'Guerreiro', nivel: 4, subclasse: 'Campeão' },
  ]);
  assert.equal(p.nivel, 10, 'o total e 10 -- era ele que o app lia');
  estadoAtaques.definirChar(p);
  assert.equal(sheetCombate.getAtaquesPorAcao(), 1,
    'so o Colegio da Bravura concede Ataque Extra, e o Guerreiro tem 4 niveis');
});

// ============================================================
// Tarefa 2b: O RESTO DE site/js/sheet/combate.js
//
// A Tarefa 2 converteu getAtaquesPorAcao() e, ao abrir o arquivo, achou
// que o MESMO defeito seguia vivo em outras 14 leituras -- todas com a
// forma exata "espelho de classe (`char.classe` / `char.subclasse`)
// cruzado com o nivel TOTAL (`char.nivel`)". A Tarefa 2b converteu as 14.
//
// POR QUE SO TRES ORACULOS, E NAO CATORZE
// ---------------------------------------
// As 14 leituras tem apenas TRES formas distintas, e um oraculo por
// forma mede exatamente o que muda:
//
//   1. so CLASSE + NIVEL (Movimento Rapido, Movimento sem Armadura,
//      Segredos Magicos, Errante, Instintos Primitivos, Conhecimento
//      Primordial);
//   2. CLASSE + SUBCLASSE + NIVEL (Aspecto dos Selvagens, Poder dos
//      Selvagens, Furia dos Deuses, Andarilho de Telhados, Aura de
//      Vivacidade, Atleta Extraordinario) -- esta erra pelos DOIS
//      espelhos ao mesmo tempo;
//   3. o CANARIO DE ESPECIE (Golias, Forma Grande), que fica como esta.
//
// As outras 11 leituras ficam cobertas pelo GUARDA ESTATICO da Tarefa 6,
// que varre o arquivo inteiro exigindo zero leituras de espelho -- mais
// barato e mais completo que 11 oraculos pontuais, porque tambem pega a
// leitura NOVA que alguem escrever amanha.
// ============================================================
const { multiclasse: mcCombate } = await modulosApp();

/**
 * Monta o personagem, publica-o no estado de modulo da ficha e devolve o
 * Deslocamento final que getDeslocamentoFinal() de verdade calcula a
 * partir de uma base de 9 metros (a base de quase toda especie).
 * Mede a FUNCAO DO APP, nao uma reimplementacao da regra dentro do teste.
 * @param {Array<{classe: string, nivel: number, subclasse?: string}>} roteiro
 * @param {(p: object) => void} [ajustar] Mutacao opcional do personagem
 *   antes de publica-lo (recursos, especie, usos de habilidade).
 * @returns {Promise<string>} texto do Deslocamento, ex.: "12 metros (Escalada 12m)".
 */
async function deslocamentoDe(roteiro, ajustar) {
  const p = await personagemMulticlasse(roteiro);
  if (ajustar) ajustar(p);
  estadoAtaques.definirChar(p);
  return sheetCombate.getDeslocamentoFinal('9 metros');
}

// ------------------------------------------------------------
// ORACULO 1 (forma "so classe + nivel"): Movimento Rapido, do BARBARO 5
// (Classes.md:127) -- "Seu Deslocamento aumenta em 3 metros enquanto voce
// nao estiver usando Armadura Pesada."
//
// Escolhido em vez de Movimento sem Armadura (Monge 2), que o brief cita
// como exemplo, porque o Monge NAO tem metade "infla" observavel: para
// enganar o codigo antigo o espelho teria de apontar para Monge com
// nivelNa(Monge) < 2, ou seja Monge 1 -- e a linha de nivel 1 da tabela
// do Monge traz "—" em Movimento sem Armadura, entao getProgressaoMonge()
// devolve bonusMovimento 0 e os dois codigos dao o mesmo numero. O
// Barbaro nao tem esse problema: o bonus e +3 fixo a partir do 5. A
// metade "apaga" do Monge, que E observavel, entra como terceira asercao.
// ------------------------------------------------------------
test('Movimento Rapido: Barbaro 4/Ladino 1 (total 5) NAO ganha os 3 metros', async () => {
  // Metade "infla": o espelho aponta para Barbaro e o TOTAL e 5, entao o
  // app dava +3 m a um personagem com 4 niveis de Barbaro. Movimento
  // Rapido e do nivel 5 DA CLASSE (Classes.md:127).
  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 4 },
    { classe: 'Ladino', nivel: 1 },
  ]);
  assert.equal(p.nivel, 5, 'o total tem de ser 5 -- e ele que enganava o app');
  assert.equal(p.classe, 'Bárbaro', 'o espelho aponta para Barbaro, a inicial');
  estadoAtaques.definirChar(p);
  assert.equal(sheetCombate.getDeslocamentoFinal('9 metros'), '9 metros',
    'Movimento Rapido exige 5 niveis DE BARBARO; este personagem tem 4');
});

test('Movimento Rapido: Ladino 1/Barbaro 5 (total 6) GANHA os 3 metros', async () => {
  // Metade "apaga": a classe inicial e Ladino, entao
  // `char.classe === 'Bárbaro'` era falso e o personagem levava 9 m para
  // a mesa em vez dos 12 que os 5 niveis de Barbaro concedem.
  const p = await personagemMulticlasse([
    { classe: 'Ladino', nivel: 1 },
    { classe: 'Bárbaro', nivel: 5 },
  ]);
  assert.equal(p.classe, 'Ladino', 'o espelho aponta para a inicial, que e Ladino');
  estadoAtaques.definirChar(p);
  assert.equal(sheetCombate.getDeslocamentoFinal('9 metros'), '12 metros',
    'Movimento Rapido chega com 5 niveis DE BARBARO, seja qual for a classe inicial');
});

test('Movimento sem Armadura: Ladino 1/Monge 2 GANHA os 3 metros do Monge', async () => {
  // A metade "apaga" do Monge 2 (Classes.md:5200), que E observavel: com o
  // espelho apontando para Ladino, o portao nunca abria e o bonus da
  // tabela do Monge (getProgressaoMonge, que ja lia nivelNa) era
  // ignorado. A metade "infla" nao existe -- ver o comentario do bloco.
  // getProgressaoMonge() le a tabela do Monge de sheetEstado.classesData,
  // que este arquivo de teste nao popula por padrao -- sem ela o bonus vem
  // 0 e o oraculo mediria o nada em vez do portao. Carrega os dados reais
  // da classe e devolve o estado ao fim, para nao vazar para os vizinhos.
  const { db, sheetEstado: est } = await modulosApp();
  est.definirClassesData(new Map([['Monge', await db.getClasse('Monge')]]));
  try {
    assert.equal(await deslocamentoDe([
      { classe: 'Ladino', nivel: 1 },
      { classe: 'Monge', nivel: 2 },
    ]), '12 metros',
      'Movimento sem Armadura chega com 2 niveis DE MONGE, mesmo com o Ladino na frente');
  } finally {
    est.definirClassesData(null);
  }
});

test('canario: Barbaro 5 de classe unica continua com 12 metros', async () => {
  // O caminho que 100% das fichas de hoje usam. Nasce verde e prova que a
  // conversao nao quebrou a classe unica. Tambem cobre a ficha LEGADA,
  // sem classes[], que e como um personagem chega antes da migracao.
  assert.equal(await deslocamentoDe([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
  ]), '12 metros', 'Barbaro 5 de classe unica: 9 + 3');

  estadoAtaques.definirChar({ classe: 'Bárbaro', subclasse: 'Trilha do Berserker', nivel: 5 });
  assert.equal(sheetCombate.getDeslocamentoFinal('9 metros'), '12 metros',
    'classesDe() normaliza a ficha legada para classes[] de uma entrada');
});

// ------------------------------------------------------------
// ORACULO 2 (forma "classe + SUBCLASSE + nivel"): Aspecto dos Selvagens,
// do BARBARO/TRILHA DO CORACAO SELVAGEM 6 (Classes.md:265) -- a opcao
// Pantera da "um Deslocamento de Escalada igual ao seu Deslocamento".
//
// Este e o unico par que erra pelos DOIS espelhos de uma vez:
// `char.subclasse` tambem e da classe INICIAL, entao um Guerreiro/Barbaro
// lia a subclasse do Guerreiro ao decidir uma caracteristica de Barbaro.
//
// Escolhido em vez de Andarilho de Telhados (Ladino/Ladrao 3), que o
// brief cita, porque o degrau do Ladrao coincide com o nivel em que a
// subclasse e escolhida (3): nao existe personagem LEGAL cujo espelho
// aponte para 'Ladrão' com menos de 3 niveis de Ladino, logo a metade
// "infla" e inconstruivel ali. O degrau 6 do Coracao Selvagem fica TRES
// niveis acima da escolha da subclasse, e por isso admite as duas
// metades. Andarilho de Telhados entra na metade "apaga", que existe.
// ------------------------------------------------------------
test('Aspecto dos Selvagens: Barbaro 3/Guerreiro 3 (total 6) NAO ganha Escalada', async () => {
  // Metade "infla", e ela mostra os dois espelhos ao mesmo tempo: a
  // subclasse do espelho E 'Trilha do Coração Selvagem' e o TOTAL e 6, so
  // que o personagem tem 3 niveis de Barbaro. Aspecto dos Selvagens e do
  // nivel 6 DE BARBARO.
  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 3, subclasse: 'Trilha do Coração Selvagem' },
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
  ]);
  p.recursos = { ...(p.recursos || {}), aspecto_selvagem: 'Pantera' };
  assert.equal(p.nivel, 6, 'o total tem de ser 6 -- era ele que o app lia');
  assert.equal(p.subclasse, 'Trilha do Coração Selvagem',
    'o espelho de subclasse aponta para a trilha certa: so o NIVEL e que nao chegou');
  estadoAtaques.definirChar(p);
  const texto = sheetCombate.getDeslocamentoFinal('9 metros');
  assert.ok(!texto.includes('Escalada'),
    `Aspecto dos Selvagens exige 6 niveis DE BARBARO; este tem 3. Recebido: ${texto}`);
});

test('Aspecto dos Selvagens: Guerreiro 1/Barbaro 6 do Coracao Selvagem GANHA Escalada', async () => {
  // Metade "apaga", e ela isola o espelho de SUBCLASSE: `char.classe` e
  // 'Guerreiro' e `char.subclasse` e '' (Guerreiro 1 ainda nao escolheu
  // subclasse), entao a condicao antiga falhava duas vezes e a Escalada
  // da Pantera sumia da ficha.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 },
    { classe: 'Bárbaro', nivel: 6, subclasse: 'Trilha do Coração Selvagem' },
  ]);
  p.recursos = { ...(p.recursos || {}), aspecto_selvagem: 'Pantera' };
  assert.equal(p.subclasse, '', 'o espelho de subclasse vem da inicial (Guerreiro 1, sem subclasse)');
  estadoAtaques.definirChar(p);
  const texto = sheetCombate.getDeslocamentoFinal('9 metros');
  assert.ok(texto.includes('Escalada'),
    `6 niveis DE BARBARO na trilha certa concedem Escalada. Recebido: ${texto}`);
});

test('Andarilho de Telhados: Guerreiro 1/Ladino 3 do Ladrao GANHA Escalada', async () => {
  // A metade "apaga" do caso que o brief nomeia (Classes.md:4413). A
  // metade oposta e inconstruivel: o degrau (3) e o nivel em que a
  // subclasse do Ladino e escolhida, entao nenhum personagem legal tem o
  // espelho em 'Ladrão' com menos de 3 niveis de Ladino.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 },
    { classe: 'Ladino', nivel: 3, subclasse: 'Ladrão' },
  ]);
  assert.equal(p.classe, 'Guerreiro', 'o espelho de classe aponta para o Guerreiro');
  assert.equal(p.subclasse, '', 'e o de subclasse esta vazio');
  estadoAtaques.definirChar(p);
  const texto = sheetCombate.getDeslocamentoFinal('9 metros');
  assert.ok(texto.includes('Escalada'),
    `Andarilho de Telhados chega com 3 niveis DE LADINO no Ladrao. Recebido: ${texto}`);
});

// ------------------------------------------------------------
// ORACULO 3, O CANARIO: Forma Grande do GOLIAS (Especies.md:212) FICA
// COMO ESTA -- `char.nivel`, o TOTAL, e a leitura CERTA aqui.
//
// O livro diz "a partir do nivel 5 DE PERSONAGEM". Especie nao tem
// "nivel na classe": o numero que manda e o nivel total (livro:2037),
// mesma familia do `pb` de Maos Curativas do Aasimar, que o sub-projeto
// 3c preservou pelo mesmo motivo.
//
// Este par existe para que a PROXIMA varredura de `char.nivel` em
// combate.js nao converta esta leitura por analogia com as 14 vizinhas:
// convertida para nivelNa(), a primeira asercao fica vermelha na hora.
// ------------------------------------------------------------
test('canario de especie: Golias Ladino 1/Guerreiro 4 (total 5) TEM Forma Grande', async () => {
  // Nenhuma das duas classes chegou ao nivel 5 -- e ainda assim o traco
  // vale, porque o degrau e de nivel TOTAL. Converter esta linha para
  // nivelNa() apagaria a Vantagem de um Golias legitimamente no 5.
  const p = await personagemMulticlasse([
    { classe: 'Ladino', nivel: 1 },
    { classe: 'Guerreiro', nivel: 4, subclasse: 'Campeão' },
  ]);
  p.especie = 'Golias';
  p.usos_habilidades = { 'Forma Grande': { ativa: true } };
  assert.equal(mcCombate.nivelNa(p, 'Ladino'), 1, 'Ladino 1');
  assert.equal(mcCombate.nivelNa(p, 'Guerreiro'), 4, 'Guerreiro 4 -- nenhuma classe no 5');
  assert.equal(p.nivel, 5, 'mas o nivel TOTAL e 5, e e ele que Forma Grande le');
  estadoAtaques.definirChar(p);
  const { vantagens } = sheetCombate.calcVantagemDesvantagemPericia('Atletismo');
  assert.ok(vantagens.includes('Forma Grande'),
    `Forma Grande e traco de ESPECIE e conta o nivel TOTAL (Especies.md:212). Recebido: ${JSON.stringify(vantagens)}`);
});

test('canario de especie: Golias Guerreiro 4 (total 4) NAO tem Forma Grande', async () => {
  // Direcao oposta, para a asercao de cima nao ficar verde por um
  // `true` constante: abaixo do total 5 o traco nao existe.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 4, subclasse: 'Campeão' },
  ]);
  p.especie = 'Golias';
  p.usos_habilidades = { 'Forma Grande': { ativa: true } };
  assert.equal(p.nivel, 4, 'total 4');
  estadoAtaques.definirChar(p);
  const { vantagens } = sheetCombate.calcVantagemDesvantagemPericia('Atletismo');
  assert.ok(!vantagens.includes('Forma Grande'),
    `Forma Grande so a partir do nivel 5 de personagem. Recebido: ${JSON.stringify(vantagens)}`);
});

// ============================================================
// Tarefa 3: CA ALTERNATIVA (calcCA + coletor + escolhedor)
//
// O DEFEITO: `calcCA` (site/js/utils.js) tinha QUATRO `if` sequenciais
// que sobrescreviam a mesma variavel `ca`, todos lendo
// `personagem.classe` -- o espelho da classe INICIAL. Num multiclasse no
// maximo UM deles casava, e a formula da outra classe simplesmente nao
// existia para o app: o vencedor era a ORDEM DE CRIACAO do personagem.
//
// Medido com Des+3 / Con+4 / Sab+1 / Car+5 (os atributos deste bloco):
//   Barbaro 5/Monge 5              -> app 17, certo 17  (acerta POR ACASO)
//   Monge 5/Barbaro 5              -> app 14, certo 17  (mesmo personagem)
//   Monge 5/Feiticeiro 3 Draconica -> app 14, certo 18  (o par de livro:2065-2067)
//
// A DECISAO DE PRODUTO (docs/PERGUNTAS-PENDENTES.txt:246-257, de
// 2026-08-22): CA alternativa e o MAIOR VALOR por padrao, com escolha
// manual em `char.ca_alternativa_escolhida` guardando a CLASSE DE ORIGEM.
// Com uma candidata so, nada aparece na tela.
//
// O DESENHO: um COLETOR puro (`coletarCAsAlternativas`) devolve as
// candidatas aplicaveis, e um ESCOLHEDOR (`escolherCAAlternativa`) aplica
// a regra. Os oraculos do coletor medem a LISTA, nao o HTML -- e por isso
// o seletor da Tarefa 4 fica testavel sem tela.
// ============================================================
const { utils: utilsCA } = await modulosApp();

// Des 16 (+3), Con 18 (+4), Sab 12 (+1), Car 20 (+5) -- os quatro
// modificadores da tabela do brief, escolhidos porque separam as quatro
// formulas em quatro numeros DIFERENTES:
//   Barbaro    10+3+4 = 17
//   Monge      10+3+1 = 14
//   Bardo/Danca e Feiticeiro/Draconica  10+3+5 = 18
// Sem valores distintos, "o maior venceu" e "o primeiro venceu" dariam o
// mesmo numero e o oraculo nao mediria a regra.
const ATRIBUTOS_CA = {
  forca: 10, destreza: 16, constituicao: 18,
  inteligencia: 10, sabedoria: 12, carisma: 20,
};
const MOD_CA = { destreza: 3, constituicao: 4, sabedoria: 1, carisma: 5 };
const ESCUDO_CA = { nome: 'Escudo', tipo: 'escudo', equipado: true, ca: 2 };
const ARMADURA_LEVE_CA = {
  equipado: true, tipo: 'armadura', nome: 'Couro Batido',
  dados: { categoria: 'Leve', ca: '12' },
};

/**
 * Monta um personagem multiclasse com os atributos fixos deste bloco e o
 * inventario vazio, e aplica um ajuste opcional (escudo, armadura, escolha
 * manual de CA).
 * @param {Array<{classe: string, nivel: number, subclasse?: string}>} roteiro
 * @param {(p: object) => void} [ajustar]
 * @returns {Promise<object>} personagem pronto para calcCA.
 */
async function personagemCA(roteiro, ajustar) {
  const p = await personagemMulticlasse(roteiro);
  p.atributos = { ...ATRIBUTOS_CA };
  p.inventario = [];
  if (ajustar) ajustar(p);
  return p;
}

/**
 * Roda `fn` com `console.warn` capturado e devolve o resultado junto com
 * os avisos emitidos. E o que permite medir a GUARDA DE COERENCIA: cair
 * no maior valor NAO pode acontecer em silencio.
 * @param {() => any} fn
 * @returns {{resultado: any, avisos: string[]}}
 */
function capturandoAvisos(fn) {
  const original = console.warn;
  const avisos = [];
  console.warn = (...args) => avisos.push(args.join(' '));
  try {
    return { resultado: fn(), avisos };
  } finally {
    console.warn = original;
  }
}

// ------------------------------------------------------------
// ORACULO 1: a ordem de criacao deixa de mandar.
// O par e o MESMO personagem em duas ordens. Sem as duas metades, um
// `calcCA` que ainda lesse o espelho ficaria verde na primeira.
// ------------------------------------------------------------
test('CA: Monge 5/Barbaro 5 vale 17 -- o app dava 14 porque o espelho era Monge', async () => {
  const p = await personagemCA([
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
  ]);
  assert.equal(p.classe, 'Monge', 'o espelho aponta para a inicial, que e Monge');
  assert.equal(utilsCA.calcCA(p), 17,
    'Defesa sem Armadura do Barbaro (Classes.md:91-93) = 10+Des+Con = 17, maior que os ' +
    '14 do Monge (Classes.md:5174-5176). O app dava 14: o `if` do Barbaro nunca casava.');
});

test('canario: Barbaro 5/Monge 5 continua valendo 17 -- o caso que acertava por acaso', async () => {
  // Mesma dupla, ordem invertida. Acertava ANTES (o espelho apontava para
  // Barbaro) e tem de continuar acertando: e o contrapeso que prova que a
  // conversao nao trocou um erro por outro.
  const p = await personagemCA([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
  ]);
  assert.equal(p.classe, 'Bárbaro', 'aqui o espelho aponta para Barbaro');
  assert.equal(utilsCA.calcCA(p), 17, 'o mesmo 17 do teste acima -- a ordem nao pode importar');
});

// ------------------------------------------------------------
// ORACULO 2: as fontes de SUBCLASSE, que o espelho `char.subclasse`
// tambem apagava. O par isola a SUBCLASSE: mesma classe, mesmo nivel,
// subclasse diferente.
//
// LACUNA DECLARADA -- o portao de NIVEL destas duas fontes (`>= 3`) NAO
// tem metade "infla" construivel: o nivel 3 e exatamente o nivel em que a
// subclasse e escolhida, entao nao existe personagem LEGAL com
// 'Colégio da Dança'/'Feitiçaria Dracônica' e menos de 3 niveis naquela
// classe. E a mesma forma de lacuna que a Tarefa 2b registrou para
// Andarilho de Telhados (Ladino/Ladrao 3). O que E construivel, e o que
// estes oraculos medem, e o portao de SUBCLASSE -- e ele sozinho ja
// implica o de nivel para todo dado legal.
// ------------------------------------------------------------
test('CA: Monge 5/Feiticeiro 3 Draconica vale 18 -- o app dava 14', async () => {
  // O par que livro:2065-2067 usa como exemplo. `char.classe` e 'Monge' e
  // `char.subclasse` e 'Combatente da Mão Espalmada': a condicao antiga
  // falhava pelos DOIS espelhos ao mesmo tempo.
  const p = await personagemCA([
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
    { classe: 'Feiticeiro', nivel: 3, subclasse: 'Feitiçaria Dracônica' },
  ]);
  assert.equal(p.subclasse, 'Combatente da Mão Espalmada', 'o espelho de subclasse vem do Monge');
  assert.equal(utilsCA.calcCA(p), 18,
    'Resiliencia Draconica (Classes.md:3072-3076) = 10+Des+Car = 18, maior que os 14 do Monge');
});

test('CA: Monge 5/Feiticeiro 3 da Feiticaria SELVAGEM vale 14 -- so a Draconica concede', async () => {
  // Metade oposta, e ela isola a SUBCLASSE: mesmos 3 niveis de Feiticeiro,
  // mesmo total 8, outra subclasse. Sem esta metade, um coletor que
  // ignorasse a subclasse e olhasse so a classe ficaria verde acima.
  const p = await personagemCA([
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
    { classe: 'Feiticeiro', nivel: 3, subclasse: 'Feitiçaria Selvagem' },
  ]);
  assert.equal(p.nivel, 8, 'o total e 8 -- e era ele que o portao `>= 3` antigo lia');
  assert.equal(utilsCA.calcCA(p), 14,
    'Feiticaria Selvagem nao tem CA alternativa; sobra a Defesa sem Armadura do Monge, 14');
});

test('CA: Monge 5/Bardo 2 vale 14 -- o Colegio da Danca exige 3 niveis DE BARDO', async () => {
  // A ARMADILHA que docs/PERGUNTAS-PENDENTES.txt:240-243 nomeia por
  // extenso: o `>= 3` colado nos gates antigos lia o nivel TOTAL, entao um
  // Monge 5/Bardo 2 (total 7) passaria pelo portao de nivel. O que o
  // barra e o portao de SUBCLASSE -- Bardo 2 ainda nao escolheu colegio --,
  // e e por isso que a Tarefa 3 converteu os dois portoes juntos.
  const p = await personagemCA([
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
    { classe: 'Bardo', nivel: 2 },
  ]);
  assert.equal(p.nivel, 7, 'total 7, bem acima do `>= 3` que o gate antigo comparava');
  assert.equal(utilsCA.calcCA(p), 14, 'Bardo 2 nao tem Colegio da Danca: fica a CA do Monge');
});

test('CA: Monge 5/Bardo 3 do Colegio da Danca vale 18', async () => {
  // Metade positiva do teste acima -- um Bardo que CHEGOU ao 3 e escolheu
  // o colegio certo concede, mesmo sendo a segunda classe.
  const p = await personagemCA([
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
    { classe: 'Bardo', nivel: 3, subclasse: 'Colégio da Dança' },
  ]);
  assert.equal(utilsCA.calcCA(p), 18,
    'Ginga Fascinante (Classes.md:724-732) = 10+Des+Car = 18');
});

// ------------------------------------------------------------
// ORACULO 3: o ESCUDO nao e uniforme, e a assimetria e do livro.
//
// Este e o oraculo mais afiado do bloco porque compara DUAS FONTES DE
// FORMULA IDENTICA (10+Des+Car, as duas de subclasse de nivel 3) que o
// livro trata de forma OPOSTA quanto ao escudo:
//   Bardo/Colegio da Danca  (Classes.md:724-732) -- "nao estiver vestindo
//     armadura ou empunhando um Escudo"        -> perde com escudo
//   Feiticeiro/Draconica    (Classes.md:3072-3076) -- "Enquanto nao
//     estiver vestindo armadura"               -> mantem com escudo
// Se o coletor tratasse `permiteEscudo` como uniforme, um dos dois
// numeros abaixo ficaria errado, seja qual for o valor uniforme escolhido.
//
// O `!escudo` do Monge ja custou um bug real (commit 12a541b, tres
// oraculos em classes-passivas.test.mjs). Estes testes sao o canario
// dessa correcao no terreno de multiclasse.
// ------------------------------------------------------------
test('CA com escudo: Monge 5/Bardo 3 Danca cai para 15 -- as DUAS fontes perdem o escudo', async () => {
  const p = await personagemCA([
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
    { classe: 'Bardo', nivel: 3, subclasse: 'Colégio da Dança' },
  ], (x) => { x.inventario = [{ ...ESCUDO_CA }]; });
  assert.equal(utilsCA.calcCA(p), 15,
    'com escudo nem o Monge nem o Colegio da Danca valem: 10 + 3 (Des) + 2 (escudo) = 15');
});

test('CA com escudo: Monge 5/Feiticeiro 3 Draconica sobe para 20 -- a Draconica MANTEM', async () => {
  // Mesma formula (10+Des+Car), mesmo nivel de subclasse, mesmo escudo --
  // e cinco pontos de diferenca em relacao ao teste acima, porque o livro
  // nao cita Escudo na Resiliencia Draconica.
  const p = await personagemCA([
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
    { classe: 'Feiticeiro', nivel: 3, subclasse: 'Feitiçaria Dracônica' },
  ], (x) => { x.inventario = [{ ...ESCUDO_CA }]; });
  assert.equal(utilsCA.calcCA(p), 20,
    'Resiliencia Draconica (Classes.md:3072-3076) nao exclui Escudo: 10+3+5 = 18, mais 2 = 20');
});

test('CA com escudo: Barbaro 5/Monge 5 vale 19 -- o Barbaro mantem, o Monge nao', async () => {
  // A mesma assimetria entre CLASSES base. Com escudo o Monge sai da
  // lista de candidatas e sobra o Barbaro: 10+3+4 = 17, mais 2 = 19.
  const p = await personagemCA([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
  ], (x) => { x.inventario = [{ ...ESCUDO_CA }]; });
  assert.equal(utilsCA.calcCA(p), 19,
    'Barbaro com escudo mantem a Defesa sem Armadura (Classes.md:93): 17 + 2');
});

// ------------------------------------------------------------
// ORACULO 4: a ESCOLHA MANUAL (`char.ca_alternativa_escolhida`).
// O par e a mesma dupla com e sem a escolha gravada -- e a escolha tem de
// vencer mesmo entregando um numero MENOR, que e o ponto de livro:2067
// ("pode se beneficiar apenas de uma de cada vez", e quem escolhe e o
// jogador).
// ------------------------------------------------------------
test('CA: escolha manual "Monge" num Barbaro/Monge vale 14, mesmo sendo MENOR que 17', async () => {
  const p = await personagemCA([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
  ], (x) => { x.ca_alternativa_escolhida = 'Monge'; });
  assert.equal(utilsCA.calcCA(p), 14,
    'a escolha do jogador vence o maior valor (docs/PERGUNTAS-PENDENTES.txt:246-257)');
});

test('CA: sem escolha manual, o mesmo Barbaro/Monge volta ao maior valor, 17', async () => {
  // Metade oposta. Sem ela, um escolhedor que devolvesse sempre a ULTIMA
  // candidata ficaria verde no teste acima.
  const p = await personagemCA([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
  ]);
  assert.equal(p.ca_alternativa_escolhida, undefined, 'o campo e aditivo: ausente por padrao');
  assert.equal(utilsCA.calcCA(p), 17, 'ausencia significa "usar o maior"');
});

test('CA: escolha manual "Barbaro" num Barbaro/Monge vale 17 -- honrada, nao ignorada', async () => {
  // Terceira asercao do mesmo par: com a escolha apontando para a
  // candidata que JA seria a vencedora, o numero e o mesmo -- o que prova
  // que o escolhedor nao esta simplesmente descartando o campo.
  const p = await personagemCA([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
  ], (x) => { x.ca_alternativa_escolhida = 'Bárbaro'; });
  assert.equal(utilsCA.calcCA(p), 17);
});

// ------------------------------------------------------------
// ORACULO 5: a GUARDA DE COERENCIA.
// Escolha apontando para classe que o personagem NAO TEM (perdeu niveis,
// importou ficha editada a mao) cai no maior valor -- e AVISA. O par mede
// as duas coisas nas duas direcoes: o NUMERO (nunca zera a CA
// alternativa) e o SILENCIO (nunca cai em silencio).
// ------------------------------------------------------------
test('CA: escolha apontando para classe AUSENTE cai no maior valor e AVISA', async () => {
  const p = await personagemCA([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
  ], (x) => { x.ca_alternativa_escolhida = 'Bardo'; });
  const { resultado, avisos } = capturandoAvisos(() => utilsCA.calcCA(p));
  assert.equal(resultado, 17,
    'cai no maior valor -- NAO zera a CA alternativa, que daria 13 (10+Des)');
  assert.equal(avisos.length, 1, `esperava exatamente 1 aviso, recebi ${avisos.length}`);
  assert.match(avisos[0], /ca_alternativa_escolhida/,
    'o aviso tem de nomear o campo incoerente');
  assert.match(avisos[0], /Bardo/, 'e o valor que nao casou');
});

test('CA: escolha COERENTE nao emite aviso nenhum', async () => {
  // Metade oposta do silencio. Sem ela, um `console.warn` incondicional
  // deixaria o teste acima verde -- e encheria o console de todo
  // personagem de classe unica do app.
  const p = await personagemCA([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
  ], (x) => { x.ca_alternativa_escolhida = 'Monge'; });
  const { resultado, avisos } = capturandoAvisos(() => utilsCA.calcCA(p));
  assert.equal(resultado, 14);
  assert.deepEqual(avisos, [], 'escolha que casa com uma candidata nao avisa nada');
});

test('CA: escolha coerente cuja candidata sumiu POR EQUIPAMENTO nao avisa -- e nao e dado perdido', async () => {
  // O Monge que equipou um escudo: a classe EXISTE, so a candidata nao se
  // aplica agora. Cair no Barbaro em silencio e o comportamento certo --
  // avisar aqui encheria o console a cada troca de equipamento. E a
  // fronteira exata da guarda: classe ausente avisa, candidata
  // temporariamente inaplicavel nao.
  const p = await personagemCA([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
  ], (x) => {
    x.ca_alternativa_escolhida = 'Monge';
    x.inventario = [{ ...ESCUDO_CA }];
  });
  const { resultado, avisos } = capturandoAvisos(() => utilsCA.calcCA(p));
  assert.equal(resultado, 19, 'sobra o Barbaro, que mantem a Defesa sem Armadura com escudo');
  assert.deepEqual(avisos, [], 'candidata inaplicavel por equipamento nao e incoerencia de dado');
});

// ------------------------------------------------------------
// ORACULO 6: O COLETOR, medido como LISTA.
//
// E este oraculo que torna o seletor da Tarefa 4 testavel sem tela: a
// regra "so aparece com duas ou mais candidatas" e uma pergunta sobre o
// TAMANHO desta lista, nao sobre HTML. O par sao as duas pontas da regra:
// duas candidatas (o seletor aparece) e uma so (nada aparece, que e o
// caso de 100% das fichas de hoje).
// ------------------------------------------------------------
test('coletor: Barbaro 5/Monge 5 tem DUAS candidatas, com valor e regra de escudo', async () => {
  const p = await personagemCA([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
  ]);
  const candidatas = utilsCA.coletarCAsAlternativas(p);
  assert.deepEqual(
    candidatas.map((c) => ({ classe: c.classe, valor: c.valor, permiteEscudo: c.permiteEscudo })),
    [
      { classe: 'Bárbaro', valor: 17, permiteEscudo: true },
      { classe: 'Monge', valor: 14, permiteEscudo: false },
    ],
    'a Tarefa 4 renderiza a partir DESTA lista -- classe de origem, valor e regra de escudo');
});

test('coletor: Barbaro 5 de classe unica tem UMA candidata -- nada aparece na tela', async () => {
  // A ponta oposta, e a que protege 100% das fichas de hoje: com uma
  // candidata so, a decisao de produto manda nao renderizar seletor
  // nenhum (docs/PERGUNTAS-PENDENTES.txt:250-252).
  const p = await personagemCA([{ classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' }]);
  assert.equal(utilsCA.coletarCAsAlternativas(p).length, 1);

  // E um Guerreiro nao tem NENHUMA -- terceira ponta, que impede um
  // coletor que devolvesse sempre uma lista nao vazia.
  const guerreiro = await personagemCA([{ classe: 'Guerreiro', nivel: 5, subclasse: 'Campeão' }]);
  assert.deepEqual(utilsCA.coletarCAsAlternativas(guerreiro), []);
});

test('coletor: o escudo TIRA a candidata do Monge da lista, e a armadura tira TODAS', async () => {
  // O coletor recebe o estado de equipamento; a lista muda com ele. E o
  // que faz o seletor da ficha sumir sozinho quando so resta uma opcao.
  const p = await personagemCA([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
  ]);
  assert.deepEqual(
    utilsCA.coletarCAsAlternativas(p, { temEscudo: true }).map((c) => c.classe),
    ['Bárbaro'], 'com escudo so o Barbaro continua candidato (Classes.md:93)');
  assert.deepEqual(
    utilsCA.coletarCAsAlternativas(p, { temArmadura: true }), [],
    'as QUATRO fontes exigem "nao estar vestindo armadura"');
});

test('escolhedor: sem candidatas devolve null, e a escolha manual nao inventa nenhuma', async () => {
  // Guarda contra o escolhedor lancar ou fabricar candidata a partir do
  // campo do personagem. Um Guerreiro com o campo gravado (ficha editada a
  // mao) tem de sair daqui com null e com a CA comum.
  const p = await personagemCA([{ classe: 'Guerreiro', nivel: 5, subclasse: 'Campeão' }],
    (x) => { x.ca_alternativa_escolhida = 'Monge'; });
  assert.equal(utilsCA.escolherCAAlternativa(p, utilsCA.coletarCAsAlternativas(p)), null);
  assert.equal(utilsCA.calcCA(p), 13, 'CA comum sem armadura: 10 + 3 (Des)');
});

// ------------------------------------------------------------
// ORACULO 6b: O EMPATE -- o unico caso em que o seletor visivelmente NAO
// muda o numero.
//
// POR QUE ISTO PRECISA DE ORACULO: e exatamente o caso que um mantenedor
// futuro olha e conclui "isto e UI morta". Duas fontes de CA alternativa
// com o MESMO valor: trocar de uma para a outra nao mexe em nenhum
// numero da tela, e o aviso de empate (site/js/sheet/ficha.js, o `title`
// do `data-ca-acao="escolher-alternativa"`) parece texto sobrando. Apagar
// esse aviso passava pelos tres guardas estaticos, pela suite de unidade
// inteira e pelos specs e2e -- nada media o empate.
//
// O RULING EXISTE JUSTAMENTE PORQUE NAO E UI MORTA: empate em VALOR nao e
// empate em EFEITO. O Barbaro MANTEM a Defesa sem Armadura empunhando um
// Escudo (Classes.md:91-93) e o Monge a PERDE (Classes.md:5174-5176).
// Escolher entre duas candidatas de mesma CA importa PROSPECTIVAMENTE:
// quem escolhe Barbaro mantem a fonte ao equipar um escudo, quem escolhe
// Monge a perde. O aviso e o unico lugar da tela que conta isso ao
// jogador antes de ele descobrir na mesa.
//
// Por isso os oraculos abaixo medem as DUAS metades: que o seletor
// APARECE com o aviso no empate (e sem o aviso fora dele), e que a
// escolha MUDA O COMPORTAMENTO FUTURO, medido equipando o escudo depois.
// ------------------------------------------------------------

// Des 14 (+2), Con 16 (+3), Sab 16 (+3). Sao atributos PROPRIOS deste
// oraculo, diferentes de ATRIBUTOS_CA (que separa as quatro formulas de
// proposito): aqui o objetivo e o oposto, colar duas delas no MESMO
// numero. Barbaro 10+2+3 = 15, Monge 10+2+3 = 15.
const ATRIBUTOS_CA_EMPATE = {
  forca: 10, destreza: 14, constituicao: 16,
  inteligencia: 10, sabedoria: 16, carisma: 10,
};

// O roteiro do empate. Barbaro primeiro por ser a ordem da tabela
// canonica do coletor -- e a ativa por padrao.
const ROTEIRO_EMPATE = [
  { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
  { classe: 'Monge', nivel: 5, subclasse: 'Combatente da Mão Espalmada' },
];

// As marcas do seletor de CA no HTML da ficha. O `data-ca-acao` e o
// mesmo atributo que habilidades.js:2568 liga ao clique e que o spec e2e
// `multiclasse-ca-seletor.spec.mjs` usa -- e o contrato, nao o rotulo.
// O aviso de empate e medido por um trecho do `title`, que so e escrito
// quando TODAS as candidatas empatam em valor.
const MARCA_SELETOR_CA = 'data-ca-acao="escolher-alternativa"';
const MARCA_EMPATE_CA = 'As fontes empatam em valor';

/**
 * Barbaro 5/Monge 5 com os atributos do EMPATE e inventario vazio, mais
 * um ajuste opcional (escudo, escolha manual). Separado de
 * `personagemCA` porque a tabela de atributos e outra.
 * @param {(p: object) => void} [ajustar]
 * @returns {Promise<object>} personagem com as duas CA alternativas em 15.
 */
async function personagemEmpateCA(ajustar) {
  const p = await personagemMulticlasse(ROTEIRO_EMPATE);
  p.atributos = { ...ATRIBUTOS_CA_EMPATE };
  p.inventario = [];
  if (ajustar) ajustar(p);
  return p;
}

/**
 * Personagem de CLASSE UNICA com os atributos do empate -- o controle que
 * mostra o que cada fonte faz sozinha ao receber um escudo.
 * @param {object} entrada Entrada de classes[] (classe, nivel, subclasse).
 * @param {boolean} comEscudo Se equipa o Escudo.
 * @returns {Promise<object>} personagem pronto para calcCA.
 */
async function personagemUnicoEmpateCA(entrada, comEscudo) {
  const p = await personagemMulticlasse([entrada]);
  p.atributos = { ...ATRIBUTOS_CA_EMPATE };
  p.inventario = comEscudo ? [{ ...ESCUDO_CA }] : [];
  return p;
}

test('empate: Barbaro 5/Monge 5 com Con 16 e Sab 16 tem DUAS candidatas de valor 15', async () => {
  // A pre-condicao de tudo o que vem depois. Se os atributos deixarem de
  // empatar, os oraculos seguintes continuariam verdes medindo OUTRO
  // caso -- e por isso o empate e afirmado aqui, sobre a lista do coletor.
  const p = await personagemEmpateCA();
  const candidatas = utilsCA.coletarCAsAlternativas(p);
  assert.deepEqual(
    candidatas.map((c) => ({ classe: c.classe, valor: c.valor, permiteEscudo: c.permiteEscudo })),
    [
      { classe: 'Bárbaro', valor: 15, permiteEscudo: true },
      { classe: 'Monge', valor: 15, permiteEscudo: false },
    ],
    'mesmo VALOR (15) e regras de escudo OPOSTAS -- e essa assimetria que o empate esconde');
  assert.equal(utilsCA.calcCA(p), 15, 'seja qual for a vencedora, a CA de agora e 15');
});

test('empate: o seletor APARECE e avisa que o numero nao muda agora', async () => {
  const p = await personagemEmpateCA();
  const html = await renderizarFicha(p);
  assert.ok(html.includes(MARCA_SELETOR_CA),
    'com duas candidatas o seletor tem de ser renderizado, mesmo elas empatando');
  assert.ok(html.includes(MARCA_EMPATE_CA),
    'o aviso de empate e o unico texto da tela que explica por que trocar a fonte importa ' +
    'quando o numero nao muda -- apaga-lo torna o seletor indistinguivel de UI morta');
  const ativa = utilsCA.escolherCAAlternativa(p, utilsCA.coletarCAsAlternativas(p));
  assert.equal(ativa.classe, 'Bárbaro',
    'no empate a ativa e a primeira da ordem da tabela do coletor');
});

test('empate: fora do empate o MESMO seletor aparece SEM o aviso', async () => {
  // A metade oposta. Sem ela, um aviso INCONDICIONAL deixaria o teste
  // acima verde -- e mentiria em toda ficha de Barbaro/Monge com valores
  // diferentes, que e a maioria.
  const p = await personagemCA(ROTEIRO_EMPATE);
  const html = await renderizarFicha(p);
  assert.ok(html.includes(MARCA_SELETOR_CA), 'duas candidatas: o seletor continua na tela');
  assert.ok(!html.includes(MARCA_EMPATE_CA),
    'com Barbaro 17 e Monge 14 nao ha empate -- trocar a fonte MUDA o numero, e o aviso mentiria');
});

test('empate: a escolha decide o FUTURO -- com escudo o Barbaro mantem e o Monge perde', async () => {
  // A segunda metade, a que transforma "UI morta" em regra. As duas
  // fontes valem 15 hoje; sozinhas, sob um Escudo, elas divergem em TRES
  // pontos, e e para essa divergencia que o jogador esta escolhendo.
  const barbaro = await personagemUnicoEmpateCA(ROTEIRO_EMPATE[0], false);
  const barbaroEscudo = await personagemUnicoEmpateCA(ROTEIRO_EMPATE[0], true);
  const monge = await personagemUnicoEmpateCA(ROTEIRO_EMPATE[1], false);
  const mongeEscudo = await personagemUnicoEmpateCA(ROTEIRO_EMPATE[1], true);
  assert.equal(utilsCA.calcCA(barbaro), 15, 'as duas fontes partem do MESMO 15');
  assert.equal(utilsCA.calcCA(monge), 15);
  assert.equal(utilsCA.calcCA(barbaroEscudo), 17,
    'Classes.md:91-93 nao exclui Escudo: a Defesa sem Armadura do Barbaro sobrevive, 15 + 2');
  assert.equal(utilsCA.calcCA(mongeEscudo), 14,
    'Classes.md:5174-5176 exclui Escudo: o Monge PERDE a fonte e cai na CA comum, 10 + 2 + 2');

  // E no personagem do empate a candidata do Monge some da lista assim
  // que o escudo entra -- e o que "perder a fonte" significa na tela.
  const comEscudo = await personagemEmpateCA((x) => { x.inventario = [{ ...ESCUDO_CA }]; });
  const candidatas = utilsCA.coletarCAsAlternativas(comEscudo, { temEscudo: true });
  assert.deepEqual(candidatas.map((c) => c.classe), ['Bárbaro'],
    'com escudo so a fonte do Barbaro continua candidata');

  // A consequencia da escolha, medida na IDENTIDADE da fonte ativa. O
  // NUMERO coincide nos dois casos (17) justamente porque o Barbaro esta
  // ali para cobrir o Monge; num personagem que tivesse escolhido Monge
  // sem essa rede -- o Monge puro acima -- a queda e de 15 para 14. Quem
  // escolheu Barbaro continua usando a fonte que escolheu; quem escolheu
  // Monge foi silenciosamente trocado.
  const escolheuBarbaro = await personagemEmpateCA((x) => {
    x.inventario = [{ ...ESCUDO_CA }];
    x.ca_alternativa_escolhida = 'Bárbaro';
  });
  const escolheuMonge = await personagemEmpateCA((x) => {
    x.inventario = [{ ...ESCUDO_CA }];
    x.ca_alternativa_escolhida = 'Monge';
  });
  const ativaDe = (x) => utilsCA.escolherCAAlternativa(
    x, utilsCA.coletarCAsAlternativas(x, { temEscudo: true }))?.classe;
  assert.equal(ativaDe(escolheuBarbaro), 'Bárbaro', 'a escolha do Barbaro SOBREVIVE ao escudo');
  assert.equal(ativaDe(escolheuMonge), 'Bárbaro',
    'a escolha do Monge NAO sobrevive: o app cai no Barbaro, e a fonte escolhida deixou de valer');
  assert.equal(utilsCA.calcCA(escolheuBarbaro), 17);
  assert.equal(utilsCA.calcCA(escolheuMonge), 17,
    'o numero e o mesmo porque o Barbaro cobre -- por isso o que o empate decide e a FONTE, ' +
    'nao a CA de agora');
});

// ------------------------------------------------------------
// ORACULO 7: as 12 CLASSES, UNICAS, em varios niveis -- a restricao mais
// dura deste sub-projeto.
//
// A conversao nao pode mudar UM numero de personagem de classe unica, que
// e o que 100% das fichas de hoje sao. A varredura cobre as 12 classes x
// 4 subclasses (as duas com CA alternativa, uma sem, e nenhuma) x 7
// niveis x 3 estados de equipamento x 2 FORMAS de ficha (a legada, com os
// escalares `classe`/`subclasse`/`nivel`, e a nova, com `classes[]`) --
// 2.016 combinacoes.
//
// O esperado NAO vem de calcCA nem de utils.calcMod: e montado aqui a
// partir das quatro citacoes do livro e da tabela MOD_CA, para um bug
// dentro de calcMod nao ficar invisivel. A conferencia contra o COMMIT
// ANTERIOR foi feita a parte, importando HEAD:site/js/utils.js lado a
// lado com a versao nova sobre 107.520 combinacoes -- zero divergencias;
// esta varredura e a forma DURAVEL da mesma medicao.
// ------------------------------------------------------------
const SUBCLASSES_VARREDURA_CA = ['', 'Colégio da Dança', 'Feitiçaria Dracônica', 'Campeão'];
const NIVEIS_VARREDURA_CA = [1, 2, 3, 4, 5, 10, 20];
const EQUIPAMENTOS_VARREDURA_CA = {
  sem: [],
  escudo: [ESCUDO_CA],
  armaduraLeve: [ARMADURA_LEVE_CA],
};

/**
 * A CA esperada de um personagem de CLASSE UNICA, montada a partir das
 * quatro citacoes do livro -- fonte independente de calcCA.
 * @param {string} classe
 * @param {string} subclasse
 * @param {number} nivel
 * @param {string} equipamento 'sem' | 'escudo' | 'armaduraLeve'
 * @returns {number} CA esperada.
 */
function caEsperadaClasseUnica(classe, subclasse, nivel, equipamento) {
  // Armadura Leve substitui a CA base: 12 (Couro Batido) + mod. Destreza.
  // Nenhuma das quatro fontes se aplica vestindo armadura.
  if (equipamento === 'armaduraLeve') return 12 + MOD_CA.destreza;

  const comEscudo = equipamento === 'escudo';
  let base = 10 + MOD_CA.destreza;
  if (classe === 'Bárbaro') {
    // Classes.md:91-93 -- escudo permitido.
    base = 10 + MOD_CA.destreza + MOD_CA.constituicao;
  } else if (classe === 'Monge' && !comEscudo) {
    // Classes.md:5174-5176 -- escudo EXCLUI.
    base = 10 + MOD_CA.destreza + MOD_CA.sabedoria;
  } else if (classe === 'Bardo' && subclasse === 'Colégio da Dança' && nivel >= 3 && !comEscudo) {
    // Classes.md:724-732 -- escudo EXCLUI.
    base = 10 + MOD_CA.destreza + MOD_CA.carisma;
  } else if (classe === 'Feiticeiro' && subclasse === 'Feitiçaria Dracônica' && nivel >= 3) {
    // Classes.md:3072-3076 -- o livro nao cita Escudo.
    base = 10 + MOD_CA.destreza + MOD_CA.carisma;
  }
  return base + (comEscudo ? 2 : 0);
}

test('congelamento: as 12 classes, UNICAS, dao a mesma CA de antes (2.016 combinacoes)', () => {
  let conferidas = 0;
  for (const forma of ['legada', 'classes']) {
    for (const classe of CLASSES) {
      for (const subclasse of SUBCLASSES_VARREDURA_CA) {
        for (const nivel of NIVEIS_VARREDURA_CA) {
          for (const [equipamento, inventario] of Object.entries(EQUIPAMENTOS_VARREDURA_CA)) {
            const p = {
              id: 'ca-varredura', nome: 'Varredura',
              atributos: { ...ATRIBUTOS_CA },
              inventario: inventario.map((i) => ({ ...i })),
              escolhas_classe: {},
              efeitos_magicos: [],
            };
            if (forma === 'classes') {
              p.classes = [{ classe, subclasse, nivel, ordem: 0 }];
              p.schema_versao = mcCombate.SCHEMA_VERSAO_ATUAL;
              mcCombate.sincronizarEspelhos(p);
            } else {
              p.classe = classe; p.subclasse = subclasse; p.nivel = nivel;
            }
            const esperado = caEsperadaClasseUnica(classe, subclasse, nivel, equipamento);
            assert.equal(utilsCA.calcCA(p), esperado,
              `${forma}: ${classe}/${subclasse || '(sem subclasse)'} nivel ${nivel}, ` +
              `equipamento "${equipamento}" -- esperado ${esperado}`);
            conferidas++;
          }
        }
      }
    }
  }
  // Falha ALTO se a varredura encolher: um laco que nao rodasse afirmaria
  // a compatibilidade sobre nada.
  assert.equal(conferidas, 2016,
    `a varredura conferiu ${conferidas} combinacoes, esperava 2016`);
});

// ============================================================
// Tarefa 5: MAESTRIA EM ARMA -- o teto único
//
// O DEFEITO: não existia UM teto, existiam CINCO. As cinco classes que
// concedem Maestria em Arma (Bárbaro, Guerreiro, Guardião, Paladino e
// Ladino) renderizam um card cada, e cada card usava a contagem da SUA
// classe: um Bárbaro 4/Ladino 5 via dois cards contraditórios ("3/3" e
// "3/2"), e o teto realmente imposto era o do ÚLTIMO botão clicado.
//
// E um gate escondia a opção inteira: hp-descanso.js comparava a lista das
// cinco com `char.classe`, o ESPELHO da classe INICIAL. Num Mago 5/
// Guerreiro 5 (`char.classe === 'Mago'`) o Descanso Longo NUNCA oferecia a
// troca de maestria -- a opção sumia da tela, não errava o número.
//
// A DECISÃO DE PRODUTO (docs/PERGUNTAS-PENDENTES.txt, PERGUNTA 2, de
// 2026-08-22): o MAIOR limite entre as classes que concedem, NÃO a soma.
// Bárbaro 4 (3 maestrias) / Guerreiro 3 (3) fica com 3, não 6. É o
// tratamento que o livro dá à característica análoga que ele de fato
// arbitra, Ataque Extra (livro:2059-2063, "as características não se
// acumulam"); o capítulo 2 não arbitra Maestria em Arma.
//
// SOBRE O CASO 1 DO BRIEF (Bárbaro 4/Guerreiro 3 -> 3, não 6): ele tem UMA
// metade só. As duas classes concedem 3 nesse par, então 3 é ao mesmo tempo
// o número da classe inicial, o do último botão e o maior -- o caso rejeita
// a SOMA e mais nada. O par que separa "o maior" de "o da classe inicial" e
// de "o do último clicado" precisa de contagens DIFERENTES nas duas pontas,
// e está nos oráculos 1a/1b abaixo (Bárbaro 10/Guerreiro 3 -> 4, o maior na
// INICIAL; Bárbaro 3/Guerreiro 4 -> 4, o maior na NÃO inicial). O caso do
// brief entra como oráculo 2, no papel que ele de fato cumpre.
//
// FORA DESTA TAREFA: QUAIS armas cada classe pode dominar (as listas
// reduzidas de proficiência de multiclasse, livro:2051) -- sub-projeto
// seguinte, registrado em docs/PERGUNTAS-PENDENTES.txt e já anunciado ao
// jogador na nota da versão 2.2.19.
// ============================================================

// A progressão de Maestria em Arma das cinco classes, escrita À MÃO a
// partir das tabelas do livro (Classes.md, coluna "Maestria em Arma") em vez
// de lida de dados/classes/*.json -- ler o mesmo JSON que o app lê tornaria
// a varredura de congelamento uma tautologia.
const MAESTRIAS_POR_NIVEL = {
  // Bárbaro: 2 do 1º ao 3º, 3 do 4º ao 9º, 4 do 10º em diante.
  'Bárbaro': (n) => (n >= 10 ? 4 : n >= 4 ? 3 : 2),
  // Guerreiro: 3 / 4 (4º) / 5 (10º) / 6 (16º).
  'Guerreiro': (n) => (n >= 16 ? 6 : n >= 10 ? 5 : n >= 4 ? 4 : 3),
  // As outras três concedem 2 e nunca mudam.
  'Guardião': () => 2,
  'Paladino': () => 2,
  'Ladino': () => 2,
};

/**
 * Deixa em sheet/estado.js o estado MÍNIMO que `tetoMaestrias()` lê: o
 * personagem, o mapa de dados de classe (de onde getProgressaoBarbaro/
 * getProgressaoGuerreiro tiram a tabela) e o cache de passivos de talentos.
 * Mais barato de propósito que `prepararEstadoDaFicha` -- a varredura de
 * congelamento o chama 100 vezes.
 * O cache de passivos é reescrito a cada chamada porque ele é estado de
 * MÓDULO: sem isso, um oráculo com o talento Mestre das Armas deixaria o
 * bônus ligado para o oráculo seguinte.
 * @param {object} p Personagem já montado.
 * @returns {Promise<void>}
 */
async function prepararTetoMaestrias(p) {
  const { sheetEstado, efeitos, db, contextoClasse } = await modulosApp();
  const mapaClasses = new Map();
  for (const ctx of contextoClasse.montarContextos(p, new Map())) {
    mapaClasses.set(ctx.classe, await db.getClasse(ctx.classe));
  }
  sheetEstado.definirChar(p);
  sheetEstado.definirClassesData(mapaClasses);
  sheetEstado.definirPassivosTalentos(efeitos.resolverPassivosTalentos(p));
}

/**
 * O teto único de maestrias do personagem, medido na função do app.
 * @param {object} p Personagem já montado.
 * @returns {Promise<number>}
 */
async function tetoDe(p) {
  const { sheetMaestrias } = await modulosApp();
  await prepararTetoMaestrias(p);
  return sheetMaestrias.tetoMaestrias();
}

/**
 * Os tetos que os cards de Maestria em Arma EXIBEM, um por botão
 * "Definir Maestrias" no HTML da ficha. Mede o número na TELA, não uma
 * reimplementação da regra dentro do teste: para cada `data-config-maestrias`
 * pega o contador `N/M` mais próximo ANTES dele, porque renderFeatureItem
 * emite o resumo no cabeçalho do item e o botão no corpo, logo abaixo.
 * @param {string} html HTML da ficha.
 * @returns {number[]} um teto por card, na ordem em que aparecem.
 */
function tetosNosCards(html) {
  const partes = html.split('data-config-maestrias');
  const tetos = [];
  for (let i = 1; i < partes.length; i++) {
    const anteriores = [...partes[i - 1].matchAll(/margin-left:auto">(\d+)\/(\d+)<\/span>/g)];
    // Sem contador antes do botão o oráculo não mediu nada -- falha alto em
    // vez de devolver uma lista curta que a asserção leria como "só um card".
    assert.ok(anteriores.length,
      `botão data-config-maestrias nº ${i} sem contador "N/M" antes dele`);
    tetos.push(Number(anteriores[anteriores.length - 1][2]));
  }
  return tetos;
}

/**
 * Elemento de DOM falso: o mínimo que utils.abrirModal/toast e os
 * `addEventListener` de setupEventosDescanso tocam. Guarda os handlers
 * registrados em `handlers`, para o teste poder DISPARAR o clique.
 * @param {string} id
 * @returns {object}
 */
function elementoFalso(id) {
  const el = {
    id, style: {}, innerHTML: '', textContent: '', scrollTop: 0,
    className: '', dataset: {}, handlers: {},
    addEventListener(evento, fn) { (el.handlers[evento] ||= []).push(fn); },
    removeAttribute() {}, setAttribute() {}, appendChild() {}, remove() {},
    closest: () => null, querySelector: () => null, querySelectorAll: () => [],
    classList: { add() {}, remove() {} },
  };
  return el;
}

/**
 * Roda o Descanso Longo DE VERDADE e devolve o modal que ele abriu.
 *
 * O gate da troca de maestria mora dentro do handler de clique de
 * `#btn-descanso-longo` (hp-descanso.js, setupEventosDescanso) -- não há
 * função exportada a chamar. Então o teste instala um `document` falso,
 * chama setupEventosDescanso(), captura o handler que ele registrou e o
 * dispara; `abrirModal` (utils.js) escreve em `#modal-corpo`/`#modal-acoes`,
 * que é o que este helper devolve. Mede a TELA do jogador, não uma cópia da
 * condição dentro do teste.
 *
 * `setTimeout` é envolvido para dar unref() nos timers de 3s que `toast()`
 * cria -- sem isso o processo de teste ficaria vivo esperando cada toast.
 * @param {object} p Personagem já montado.
 * @returns {Promise<{titulo: string, corpo: string, acoes: string}>}
 */
async function dispararDescansoLongo(p) {
  const { sheetHpDescanso } = await modulosApp();
  await prepararEstadoDaFicha(p, elementoFalso('sheet-container'));

  const registro = new Map();
  const docOriginal = globalThis.document;
  const setTimeoutOriginal = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => {
    const t = setTimeoutOriginal(fn, ms);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
  };
  globalThis.document = {
    getElementById(id) {
      if (!registro.has(id)) registro.set(id, elementoFalso(id));
      return registro.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => elementoFalso(tag),
    body: { appendChild() {} },
  };
  try {
    sheetHpDescanso.setupEventosDescanso();
    const cliques = registro.get('btn-descanso-longo')?.handlers?.click || [];
    assert.equal(cliques.length, 1,
      'setupEventosDescanso tem de registrar UM clique em #btn-descanso-longo');
    cliques[0]({ stopPropagation() {}, preventDefault() {} });
    return {
      titulo: registro.get('modal-titulo')?.textContent || '',
      corpo: registro.get('modal-corpo')?.innerHTML || '',
      acoes: registro.get('modal-acoes')?.innerHTML || '',
    };
  } finally {
    globalThis.document = docOriginal;
    globalThis.setTimeout = setTimeoutOriginal;
  }
}

// O botão de troca de maestria do modal de Descanso Longo. É o id, não o
// rótulo: o texto "Trocar Maestrias" também poderia vir de outro lugar.
const BOTAO_TROCA_MAESTRIA_DL = 'id="btn-trocar-maestrias-dl"';

// ------------------------------------------------------------
// ORÁCULO 1: o teto é o MAIOR, e o maior pode estar em qualquer ponta.
// As duas metades usam contagens DIFERENTES nas duas classes -- é isso que
// separa "o maior" de "o da classe inicial" e de "o do último botão".
// ------------------------------------------------------------
test('teto: Bárbaro 10/Guerreiro 3 vale 4 -- o maior está na classe INICIAL', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 10, subclasse: 'Trilha do Berserker' },
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
  ]);
  // Bárbaro 10 concede 4; Guerreiro 3 concede 3. Um teto que viesse do
  // ÚLTIMO card renderizado daria 3 e tiraria uma vaga do jogador.
  assert.equal(await tetoDe(p), 4,
    'o maior entre Bárbaro 10 (4) e Guerreiro 3 (3) é 4');
});

test('teto: Bárbaro 3/Guerreiro 4 vale 4 -- o maior está na classe NÃO INICIAL', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 3, subclasse: 'Trilha do Berserker' },
    { classe: 'Guerreiro', nivel: 4, subclasse: 'Campeão' },
  ]);
  // Bárbaro 3 concede 2; Guerreiro 4 concede 4. A metade oposta da anterior:
  // um teto lido do espelho `char.classe` (a INICIAL) daria 2.
  assert.equal(await tetoDe(p), 4,
    'o maior entre Bárbaro 3 (2) e Guerreiro 4 (4) é 4');
});

// ------------------------------------------------------------
// ORÁCULO 2: o caso do brief. Rejeita a SOMA -- e só ela, porque as duas
// classes concedem 3 aqui (ver o cabeçalho deste bloco).
// ------------------------------------------------------------
test('teto: Bárbaro 4/Guerreiro 3 vale 3, não 6 -- é o MAIOR, não a soma', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 4, subclasse: 'Trilha do Berserker' },
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
  ]);
  const teto = await tetoDe(p);
  assert.equal(teto, 3, 'Bárbaro 4 (3) + Guerreiro 3 (3) -> 3, o maior');
  assert.notEqual(teto, 6, 'somar as duas classes é exatamente o que a decisão de 2026-08-22 recusa');
});

// ------------------------------------------------------------
// ORÁCULO 3: UM número na tela, não dois cards contraditórios.
// O par são as DUAS ordens do MESMO personagem: sem as duas metades, um
// render que ainda lesse a classe do card ficaria verde numa delas.
// ------------------------------------------------------------
test('cards: Bárbaro 4/Ladino 5 mostra o MESMO teto nos dois cards', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 4, subclasse: 'Trilha do Berserker' },
    { classe: 'Ladino', nivel: 5, subclasse: 'Ladrão' },
  ]);
  const tetos = tetosNosCards(await renderizarFicha(p));
  assert.equal(tetos.length, 2, 'a ficha tem de renderizar os DOIS cards de maestria');
  // Antes: [3, 2] -- "3/3" no card do Bárbaro e "3/2" no do Ladino.
  assert.deepEqual(tetos, [3, 3],
    'os dois cards mostram o teto do PERSONAGEM (maior entre Bárbaro 4 = 3 e Ladino = 2)');
});

test('cards: Ladino 5/Bárbaro 4 -- a ordem de criação deixa de mandar', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Ladino', nivel: 5, subclasse: 'Ladrão' },
    { classe: 'Bárbaro', nivel: 4, subclasse: 'Trilha do Berserker' },
  ]);
  const tetos = tetosNosCards(await renderizarFicha(p));
  assert.equal(tetos.length, 2, 'a ficha tem de renderizar os DOIS cards de maestria');
  assert.deepEqual(tetos, [3, 3],
    'o MESMO personagem na outra ordem dá o MESMO teto -- o acidente que a decisão de produto fecha');
});

// ------------------------------------------------------------
// ORÁCULO 3b: os OUTROS TRÊS cards -- Guerreiro, Guardião e Paladino.
//
// O par acima (Bárbaro 4/Ladino 5) renderiza só DOIS dos CINCO cards de
// Maestria em Arma que a ficha sabe emitir. Os outros três
// (site/js/sheet/habilidades.js, os ramos `ehMaestriaGuerreiro`,
// `ehMaestriaGuardiao` e `ehMaestriaPaladino`) não eram renderizados por
// oráculo nenhum: reverter qualquer um deles ao literal `2` da versão
// anterior deixava a ficha com DOIS números contraditórios na mesma tela
// -- "0/2" num bloco e "0/6" no outro -- com a suíte inteira verde.
//
// Os guardas estáticos deste sub-projeto também não pegam, e não é por
// descuido: eles procuram REINTRODUÇÃO DE ESPELHO (`char.classe`,
// `char.nivel`), e trocar `${tetoMaestrias()}` pelo literal `2` não
// reintroduz espelho nenhum. Só um render medido fecha este buraco.
//
// A forma do par é o CONTRASTE de tetos. Guardião, Paladino e Ladino
// concedem 2 em TODO nível; num personagem em que as duas classes têm
// teto 2 o literal, o número da classe e o do personagem coincidem e o
// oráculo não mediria nada. Por isso o outro lado é sempre um Guerreiro
// 17, cuja tabela concede 6 (Classes.md, coluna "Maestria em Arma":
// 3 / 4 no 4º / 5 no 10º / 6 no 16º) -- o maior, e portanto o teto do
// PERSONAGEM inteiro pela decisão de 2026-08-22.
//
// Cada teste mede as DUAS coisas que o defeito separa: o número que a
// TELA mostra em cada card e o teto que o modal de fato IMPÕE. É a
// contradição entre esses dois que o jogador vê.
// ------------------------------------------------------------
test('cards: Guardião 3/Guerreiro 17 mostra 6 nos DOIS cards -- o do Guardião não é o literal 2', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Guardião', nivel: 3, subclasse: 'Caçador' },
    { classe: 'Guerreiro', nivel: 17, subclasse: 'Campeão' },
  ]);
  const tetos = tetosNosCards(await renderizarFicha(p));
  assert.equal(tetos.length, 2, 'a ficha tem de renderizar os DOIS cards de maestria');
  // Guardião 3 concede 2; Guerreiro 17 concede 6. Com o literal de volta no
  // card do Guardião a lista vira [2, 6] (ou [6, 2], conforme a ordem de
  // render) -- dois números para o mesmo limite, na mesma tela.
  assert.deepEqual(tetos, [6, 6],
    'os dois cards mostram o teto do PERSONAGEM (maior entre Guardião = 2 e Guerreiro 17 = 6)');
  assert.equal(await tetoDe(p), 6,
    'e é esse mesmo 6 que o modal impõe -- card e modal não podem divergir');
});

test('cards: Paladino 3/Guerreiro 17 mostra 6 nos DOIS cards -- o do Paladino não é o literal 2', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Paladino', nivel: 3, subclasse: 'Juramento da Devoção' },
    { classe: 'Guerreiro', nivel: 17, subclasse: 'Campeão' },
  ]);
  const tetos = tetosNosCards(await renderizarFicha(p));
  assert.equal(tetos.length, 2, 'a ficha tem de renderizar os DOIS cards de maestria');
  assert.deepEqual(tetos, [6, 6],
    'os dois cards mostram o teto do PERSONAGEM (maior entre Paladino = 2 e Guerreiro 17 = 6)');
  assert.equal(await tetoDe(p), 6,
    'e é esse mesmo 6 que o modal impõe -- card e modal não podem divergir');
});

// ------------------------------------------------------------
// ORÁCULO 4: o gate do Descanso Longo. A metade "some da tela" e a metade
// canária, que prova que o gate não virou sempre-verdadeiro.
// ------------------------------------------------------------
test('Descanso Longo: Mago 5/Guerreiro 5 OFERECE a troca de maestria', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5, subclasse: 'Evocador' },
    { classe: 'Guerreiro', nivel: 5, subclasse: 'Campeão' },
  ]);
  assert.equal(p.classe, 'Mago',
    'o espelho tem de ser Mago -- é ele que escondia a opção');
  const modal = await dispararDescansoLongo(p);
  assert.ok(modal.acoes.includes(BOTAO_TROCA_MAESTRIA_DL),
    'o Descanso Longo de um Mago/Guerreiro tem de oferecer "Trocar Maestrias"');
  assert.match(modal.corpo, /Como Guerreiro, você pode/,
    'o texto nomeia a classe que CONCEDE a maestria, não o espelho Mago');
});

test('Descanso Longo: Mago 5/Clérigo 5 NÃO oferece -- o gate não virou sempre verdadeiro', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5, subclasse: 'Evocador' },
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Vida' },
  ]);
  const modal = await dispararDescansoLongo(p);
  assert.ok(!modal.acoes.includes(BOTAO_TROCA_MAESTRIA_DL),
    'nenhuma das duas classes concede Maestria em Arma');
  assert.ok(!/maestria/i.test(modal.corpo),
    'o corpo do modal não pode falar de maestria para quem não tem a característica');
});

// ------------------------------------------------------------
// ORÁCULO 5: o bônus do talento Mestre das Armas entra UMA vez, no
// personagem -- não uma por classe que concede.
// ------------------------------------------------------------
test('talento: Mestre das Armas soma UMA vaga ao teto de um Bárbaro 4/Guerreiro 3', async () => {
  const roteiro = [
    { classe: 'Bárbaro', nivel: 4, subclasse: 'Trilha do Berserker' },
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
  ];
  const semTalento = await personagemMulticlasse(roteiro);
  assert.equal(await tetoDe(semTalento), 3, 'sem o talento, o maior entre 3 e 3');

  const comTalento = await personagemMulticlasse(roteiro);
  comTalento.talentos = ['Mestre das Armas'];
  // 4 = 3 + 1. Se o bônus entrasse por classe seriam 5 (3+1 e 3+1 somados)
  // ou 8 (a soma das duas com bônus) -- nenhum dos dois é a regra.
  assert.equal(await tetoDe(comTalento), 4,
    'Talentos.md §Mestre das Armas: UMA vaga adicional ao personagem');
});

// ------------------------------------------------------------
// ORÁCULO 6: os canários de classe única. Guerreiro 5 e Bárbaro 5 têm
// tetos DIFERENTES (4 e 3) de propósito: um teto que virasse constante
// passaria num deles e falharia no outro.
// ------------------------------------------------------------
test('canário: Guerreiro 5 de classe única continua com teto 4', async () => {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5, subclasse: 'Campeão' }]);
  assert.equal(await tetoDe(p), 4, 'Guerreiro 5 concede 4 maestrias, como antes');
  assert.deepEqual(tetosNosCards(await renderizarFicha(p)), [4],
    'e a ficha mostra UM card, com o mesmo 4');
});

test('canário: Bárbaro 5 de classe única continua com teto 3', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' }]);
  assert.equal(await tetoDe(p), 3, 'Bárbaro 5 concede 3 maestrias, como antes');
  assert.deepEqual(tetosNosCards(await renderizarFicha(p)), [3],
    'e a ficha mostra UM card, com o mesmo 3');
});

// ------------------------------------------------------------
// ORÁCULO 7: congelamento -- as cinco classes de maestria, ÚNICAS, nos 20
// níveis. "Classe única não pode mudar" tem de valer em TODO nível, não só
// nos dois que os canários acima medem.
// ------------------------------------------------------------
test('congelamento: as 5 classes de maestria, ÚNICAS, nos 20 níveis (100 combinações)', async () => {
  let conferidas = 0;
  for (const [classe, esperadoNoNivel] of Object.entries(MAESTRIAS_POR_NIVEL)) {
    for (let nivel = 1; nivel <= 20; nivel++) {
      const p = await personagemMulticlasse([{ classe, nivel }]);
      assert.equal(await tetoDe(p), esperadoNoNivel(nivel),
        `${classe} ${nivel} de classe única`);
      conferidas++;
    }
  }
  // Falha ALTO se a varredura encolher: um laço que não rodasse afirmaria a
  // compatibilidade sobre nada.
  assert.equal(conferidas, 100,
    `a varredura conferiu ${conferidas} combinações, esperava 100`);
});
