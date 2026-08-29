// ============================================================
// Contexto de classe com escopo: montarContextos.
//
// Nenhum teste aqui pode passar antes da implementacao: rode o arquivo
// contra a arvore intacta e confirme `# pass 0` antes de codar.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

/**
 * Stub minimo de container DOM para renderFichaCompleta() (sheet/ficha.js).
 * O render real escreve HTML em containerRef.innerHTML e depois chama uma
 * bateria de setupEventos*() que leem document.getElementById/querySelector
 * (ja stubados em harness.mjs para devolver null) e containerRef.querySelectorAll
 * (aqui, sempre []) -- nenhum desses caminhos precisa de DOM de verdade
 * porque todo acesso subsequente usa optional chaining ou .forEach sobre um
 * array vazio. Só innerHTML precisa ser capturado, para o teste poder
 * inspecionar o HTML produzido.
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

// Mapa de dados falso, com o minimo que o contexto carrega.
const DADOS = new Map([
  ['Clérigo', { nome: 'Clérigo', caracteristicas: [{ nivel: 1, nome: 'Conjuração' }] }],
  ['Paladino', { nome: 'Paladino', caracteristicas: [{ nivel: 1, nome: 'Mãos Consagradas' }] }],
]);

test('monta um contexto por classe, na ordem de aquisicao', async () => {
  const { contextoClasse: cc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Vida' },
    { classe: 'Paladino', nivel: 5, subclasse: 'Juramento da Devoção' },
  ]);
  const ctxs = cc.montarContextos(p, DADOS);
  assert.equal(ctxs.length, 2);
  assert.equal(ctxs[0].classe, 'Clérigo');
  assert.equal(ctxs[0].nivelClasse, 5);
  assert.equal(ctxs[0].subclasse, 'Domínio da Vida');
  assert.equal(ctxs[0].ordem, 0);
  assert.equal(ctxs[0].dados.nome, 'Clérigo');
  assert.equal(ctxs[1].classe, 'Paladino');
  assert.equal(ctxs[1].ordem, 1);
});

test('ordena por ordem de aquisicao, nao pela posicao no array', async () => {
  const { contextoClasse: cc } = await modulosApp();
  // classes[] embaralhado: o Paladino (ordem 1) vem primeiro no array.
  const p = { classes: [
    { classe: 'Paladino', subclasse: '', nivel: 5, ordem: 1 },
    { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
  ], atributos: {} };
  const ctxs = cc.montarContextos(p, DADOS);
  assert.deepEqual(ctxs.map((c) => c.classe), ['Clérigo', 'Paladino'],
    'a ordem do resultado e a de aquisicao, nao a do array');
});

// O caminho mais importante: as migracoes sao preguicosas, entao ha
// caminhos que leem o personagem sem ele nunca ter sido migrado.
test('ficha legada NAO migrada produz um contexto de uma classe', async () => {
  const { contextoClasse: cc } = await modulosApp();
  const legado = { classe: 'Mago', subclasse: 'Evocador', nivel: 7 };
  const ctxs = cc.montarContextos(legado, new Map([['Mago', { nome: 'Mago' }]]));
  assert.equal(ctxs.length, 1);
  assert.equal(ctxs[0].classe, 'Mago');
  assert.equal(ctxs[0].nivelClasse, 7);
  assert.equal(ctxs[0].subclasse, 'Evocador');
  assert.equal(ctxs[0].ordem, 0);
});

test('classe sem dados no mapa entra com dados null, sem lancar', async () => {
  const { contextoClasse: cc } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 3 }]);
  const ctxs = cc.montarContextos(p, new Map());
  assert.equal(ctxs.length, 1);
  assert.equal(ctxs[0].dados, null,
    'dados ausentes viram null explicito -- o consumidor decide, o mecanismo nao inventa');
});

test('personagem vazio, null e undefined devolvem [] sem lancar', async () => {
  const { contextoClasse: cc } = await modulosApp();
  assert.deepEqual(cc.montarContextos(null, DADOS), []);
  assert.deepEqual(cc.montarContextos(undefined, DADOS), []);
  assert.deepEqual(cc.montarContextos({}, DADOS), []);
  assert.deepEqual(cc.montarContextos({ classes: [] }, DADOS), []);
  // Mapa ausente tambem nao pode lancar.
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }]);
  assert.equal(cc.montarContextos(p, null)[0].dados, null);
});

// ORACLO 6 -- a filtragem por nivelClasse.
//
// ATENCAO, leitor futuro: este oraculo mede `montarContextos` (contexto-
// classe.js) e a REGRA de filtragem por nivel -- a filtragem em si roda
// aqui dentro do teste (`ate = ...filter(...)`), nao dentro de
// caracteristicas.js. Ele nasce verde antes de caracteristicas.js ser
// tocado (a Tarefa 2 so consome montarContextos, ja pronto na Tarefa 1) e
// NAO serve como guarda de regressao do RENDER -- nao pega, por exemplo,
// `ctx.subclasse` trocado por `char.subclasse` dentro das funcoes de
// render, nem `mostrarNomeClasse` forcado sempre `true`. Essas duas
// mutacoes so caem nos oraculos "render de verdade" logo abaixo.
test('a filtragem devolve as caracteristicas daquela classe ate aquele nivel', async () => {
  const { contextoClasse: cc, db } = await modulosApp();
  const dadosClerigo = await db.getClasse('Clérigo');
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Vida' },
    { classe: 'Paladino', nivel: 5, subclasse: 'Juramento da Devoção' },
  ]);
  const ctxs = cc.montarContextos(p, new Map([['Clérigo', dadosClerigo]]));
  const clerigo = ctxs.find((c) => c.classe === 'Clérigo');
  const ate = clerigo.dados.caracteristicas.filter((f) => f.nivel <= clerigo.nivelClasse);

  assert.ok(ate.some((f) => f.nome === 'Conjuração'),
    'Conjuracao e do Clerigo nivel 1 e tem de estar');
  assert.ok(!ate.some((f) => f.nome === 'Intervenção Divina'),
    'Intervencao Divina e do Clerigo NIVEL 10 -- um Clerigo 5 nao a tem, ' +
    'mesmo que o nivel TOTAL do personagem seja 10');
});

// ============================================================
// Rodada 1 de correcao da Tarefa 2: oraculos que chamam o RENDER de
// verdade (renderSecaoCaracteristicas/renderSecaoSubclasse), via
// sheetEstado.definirChar()/definirClassesData() -- nao uma reimplementacao
// da regra dentro do teste. Duas asercoes em direcoes opostas, porque uma
// sozinha nao fecha o buraco: uma implementacao que SEMPRE mostrasse (ou
// SEMPRE escondesse) o nome da classe passaria numa das duas isolada.
// ============================================================

/** Extrai o texto de cada <h2> de card-header do HTML de uma secao. */
function titulosDeCard(html) {
  return [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
}

test('render: personagem de UMA classe -- titulo identico ao de antes da multiclasse', async () => {
  const { sheetEstado, sheetCaracteristicas, db } = await modulosApp();
  const dadosClerigo = await db.getClasse('Clérigo');
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Vida' },
  ]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClassesData(new Map([['Clérigo', dadosClerigo]]));

  const html = sheetCaracteristicas.renderSecaoCaracteristicas();
  const titulos = titulosDeCard(html);

  assert.equal(titulos.length, 1, 'uma classe, um bloco de caracteristicas');
  assert.equal(titulos[0], 'Características de Classe',
    'com uma classe so, o titulo tem de ficar EXATAMENTE como antes da multiclasse -- sem nome nem nivel de classe');
});

test('render: personagem de DUAS classes -- um bloco por classe, cada um com nome e nivel', async () => {
  const { sheetEstado, sheetCaracteristicas, db } = await modulosApp();
  const [dadosClerigo, dadosPaladino] = await Promise.all([
    db.getClasse('Clérigo'), db.getClasse('Paladino'),
  ]);
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Vida' },
    { classe: 'Paladino', nivel: 5, subclasse: 'Juramento da Devoção' },
  ]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClassesData(new Map([
    ['Clérigo', dadosClerigo], ['Paladino', dadosPaladino],
  ]));

  const html = sheetCaracteristicas.renderSecaoCaracteristicas();
  const titulos = titulosDeCard(html);

  assert.equal(titulos.length, 2, 'duas classes, dois blocos de caracteristicas');
  assert.ok(titulos.some((t) => t === 'Características de Classe — Clérigo 5'),
    'o bloco do Clerigo tem de levar o nome e o nivel DAQUELA classe');
  assert.ok(titulos.some((t) => t === 'Características de Classe — Paladino 5'),
    'o bloco do Paladino tem de levar o nome e o nivel DAQUELA classe');
});

// ============================================================
// Correcao final do sub-projeto 3a, item 1 (Critical): a ficha ficava
// velha depois de toda subida de nivel, inclusive em classe unica.
//
// A cadeia do defeito: subirDeNivel (levelup.js:1411/:1429) escreve SO nos
// espelhos (char.nivel, char.subclasse) -- classes[] nunca e tocado ali.
// renderSecaoCaracteristicas le classes[] (via contextosDeClasse), entao
// uma ficha que ja migrou uma vez (classes[] existe) fica mostrando o
// NIVEL ANTERIOR ate reconciliar de novo. O conserto foi renderFichaCompleta
// chamar migrarMulticlasse() a cada render -- mas renderFichaCompleta exige
// DOM completo (container.innerHTML, dezenas de estadoXxx de classe) fora
// do escopo deste harness de unidade. Este oraculo mede o MESMO par de
// chamadas que o conserto encadeia (migrarMulticlasse -> renderSecao...),
// na ordem em que o app real as executa, com um personagem que JA MIGROU
// uma vez -- exatamente a situacao em que o defeito aparecia.
// ============================================================
test('reconciliar apos a subida (migrarMulticlasse + render) mostra a caracteristica do NOVO nivel', async () => {
  const { sheetEstado, sheetMigracoes, sheetCaracteristicas, db, store } = await modulosApp();
  const dadosClerigo = await db.getClasse('Clérigo');

  const p = store.criarPersonagemVazio();
  p.classe = 'Clérigo';
  p.nivel = 4;
  p.atributos = { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 };
  sheetEstado.definirChar(p);
  sheetEstado.definirClassesData(new Map([['Clérigo', dadosClerigo]]));

  // Abertura da ficha (renderSheet chama migrarMulticlasse uma vez): cria
  // classes[0] = { classe: 'Clérigo', nivel: 4, ... } a partir dos espelhos.
  sheetMigracoes.migrarMulticlasse();

  // PAR NA DIRECAO OPOSTA: sem subida nenhuma, Fulminar Mortos-Vivos (que e
  // do Clerigo NIVEL 5) nao pode aparecer num Clerigo 4.
  const htmlAntes = sheetCaracteristicas.renderSecaoCaracteristicas();
  assert.ok(!htmlAntes.includes('Fulminar Mortos-Vivos'),
    'Clerigo 4 nao tem Fulminar Mortos-Vivos (e do nivel 5)');

  // subirDeNivel de verdade (levelup.js:1411) escreve SO no espelho --
  // classes[0].nivel fica parado em 4 depois desta linha.
  p.nivel = 5;

  // O CONSERTO: renderFichaCompleta agora chama migrarMulticlasse() antes
  // de montar a secao de caracteristicas -- reconcilia classes[0].nivel a
  // partir do espelho que acabou de mudar.
  sheetMigracoes.migrarMulticlasse();
  const htmlDepois = sheetCaracteristicas.renderSecaoCaracteristicas();
  assert.ok(htmlDepois.includes('Fulminar Mortos-Vivos'),
    'apos reconciliar, um Clerigo que acabou de subir para 5 tem de ver Fulminar Mortos-Vivos -- ' +
    'sem a reconciliacao (o defeito relatado), classes[0].nivel ficaria parado em 4 e a caracteristica ' +
    'so apareceria depois de fechar e reabrir a ficha');
});

test('render: personagem de DUAS classes -- uma secao de Subclasse por classe, cada uma com a sua', async () => {
  // Este oraculo e o que pega a mutacao "ctx.subclasse trocado por
  // char.subclasse dentro de renderSubclasseDeUmaClasse": char.subclasse e
  // o espelho da classe INICIAL (aqui, Clerigo/Dominio da Vida) -- se o
  // render usasse esse espelho em vez de ctx.subclasse, a secao de
  // Subclasse do Paladino sumiria inteira, e as duas caixas cairiam para
  // a MESMA subclasse (Dominio da Vida) em vez de uma cada.
  const { sheetEstado, sheetCaracteristicas, db } = await modulosApp();
  const [dadosClerigo, dadosPaladino] = await Promise.all([
    db.getClasse('Clérigo'), db.getClasse('Paladino'),
  ]);
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Vida' },
    { classe: 'Paladino', nivel: 5, subclasse: 'Juramento da Devoção' },
  ]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClassesData(new Map([
    ['Clérigo', dadosClerigo], ['Paladino', dadosPaladino],
  ]));

  const html = sheetCaracteristicas.renderSecaoSubclasse();
  const titulos = titulosDeCard(html);

  assert.equal(titulos.length, 2, 'duas classes com subclasse, duas secoes de Subclasse');
  assert.ok(titulos.includes('Subclasse — Domínio da Vida'),
    'a secao de subclasse do Clerigo tem de aparecer');
  assert.ok(titulos.includes('Subclasse — Juramento da Devoção'),
    'a secao de subclasse do Paladino tem de aparecer -- nao a mesma do Clerigo duas vezes');
});

// ============================================================
// Correcao final do sub-projeto 3a, re-revisao: o oraculo acima
// ("reconciliar apos a subida") mede migrarMulticlasse() + renderSecao...
// chamadas NA MAO, na mesma ordem do app -- mas nunca importa nem chama
// renderFichaCompleta() (sheet/ficha.js), que e o PONTO DE CHAMADA onde o
// conserto de verdade foi aplicado (ficha.js:157). Uma implementacao que
// removesse a chamada `migrarMulticlasse()` de dentro de renderFichaCompleta
// continuaria passando no oraculo acima, porque ele chama migrarMulticlasse()
// por fora. Este oraculo chama renderFichaCompleta() de verdade, com um
// stub de container de seis linhas (DOM completo nao e exigido -- todo
// acesso a document/containerRef depois do innerHTML usa optional chaining
// ou .forEach sobre array vazio) -- e afirma o par nas duas direcoes.
// ============================================================
// Marca usada para detectar a caracteristica "Fulminar Mortos-Vivos" no HTML.
// NAO usar o nome curto "Fulminar Mortos-Vivos" sozinho: ele tambem aparece
// num BOTAO de acao rapida embutido dentro do item "Expulsar Mortos-Vivos"
// (habilidades.js:3679), condicionado a `char.nivel >= 5` -- o ESPELHO vivo,
// nao `ctx.nivelClasse`/classes[]. Esse botao e um bug latente independente
// (fora do escopo deste conserto) que faz o nome curto aparecer mesmo com
// classes[0].nivel parado em 4, mascarando a regressao que este oraculo
// existe para pegar (achado durante a escrita deste oraculo: com
// migrarMulticlasse() removido de ficha.js, `htmlDepois.includes('Fulminar
// Mortos-Vivos')` continuava true por causa desse botao). O trecho da
// DESCRICAO da caracteristica so entra no HTML quando o item "Fulminar
// Mortos-Vivos" em si passa pelo filtro `c.nivel <= ctx.nivelClasse`
// (caracteristicas.js:21) -- e por isso mede exatamente o mecanismo sob
// teste.
const MARCA_FULMINAR_MORTOS_VIVOS = 'não encerra o efeito de Expulsar Mortos-Vivos';

test('render de verdade: renderFichaCompleta() reconcilia a ficha apos subida de nivel (Clerigo 4->5)', async () => {
  const { sheetEstado, sheetFicha, sheetMigracoes, db, store, levelup } = await modulosApp();
  const dadosClerigo = await db.getClasse('Clérigo');

  const p = store.criarPersonagemVazio();
  p.classe = 'Clérigo';
  p.nivel = 4;
  p.atributos = { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 };

  const container = criarContainerStub();
  sheetEstado.definirChar(p);
  sheetEstado.definirContainer(container);
  sheetEstado.definirClasseData(dadosClerigo);
  sheetEstado.definirClassesData(new Map([['Clérigo', dadosClerigo]]));
  const indiceMagias = await db.getIndiceMagias();
  sheetEstado.definirIndiceMagias(indiceMagias?.magias || []);
  sheetEstado.definirTalentos(await db.getTalentos());
  sheetEstado.definirEspecies(await db.getEspecies());
  // Pela MESMA função que pages/sheet.js usa (por classe, no nível dela),
  // e não pelos espelhos -- ver multiclasse-magias.test.mjs, Oráculo 26.
  const magiasAutomaticas = await levelup.obterMagiasAutomaticasDoPersonagem(p);
  sheetEstado.definirMagiasDominio(magiasAutomaticas.dominio);
  sheetEstado.definirMagiasSempre(magiasAutomaticas.sempre);

  // Abertura da ficha (renderSheet chama migrarMulticlasse() uma vez, em
  // pages/sheet.js -- chamada FORA do escopo deste conserto, e por isso
  // simulada aqui na mao): cria classes[0] = { classe: 'Clérigo', nivel: 4,
  // ... } a partir dos espelhos. Sem este passo, montarContextos nunca
  // encontraria classes[] e cairia sempre no caminho de ficha LEGADA (que lê
  // os espelhos direto) -- o mesmo defeito aparente, mas por um motivo
  // errado, mascarando exatamente a regressao que este oraculo mede.
  sheetMigracoes.migrarMulticlasse();

  // PAR NA DIRECAO OPOSTA: Clerigo 4 nao tem Fulminar Mortos-Vivos (nivel 5).
  // Uma implementacao que sempre mostrasse tudo passaria so na asserção de
  // baixo -- e o par e o que fecha a regra.
  sheetFicha.renderFichaCompleta();
  const htmlAntes = container.innerHTML;
  assert.ok(!htmlAntes.includes(MARCA_FULMINAR_MORTOS_VIVOS),
    'Clerigo 4 nao tem Fulminar Mortos-Vivos (e do nivel 5) -- renderFichaCompleta() de verdade');

  // subirDeNivel de verdade (levelup.js:1411) escreve SO no espelho --
  // classes[0].nivel fica parado em 4 depois desta linha.
  p.nivel = 5;

  // O CONSERTO sob teste: renderFichaCompleta() (sheet/ficha.js:157) chama
  // migrarMulticlasse() a cada render, reconciliando classes[0].nivel a
  // partir do espelho ANTES de montar a secao de caracteristicas. Sem essa
  // chamada, classes[0].nivel fica parado em 4 (o conserto de migrarMulticlasse()
  // que rodou ANTES da subida, na "abertura da ficha" simulada acima, nunca
  // roda de novo) e o HTML abaixo nao muda.
  sheetFicha.renderFichaCompleta();
  const htmlDepois = container.innerHTML;
  assert.ok(htmlDepois.includes(MARCA_FULMINAR_MORTOS_VIVOS),
    'apos renderFichaCompleta() de verdade, um Clerigo que acabou de subir para 5 tem de ver ' +
    'Fulminar Mortos-Vivos -- essa e a regressao Critical que o conserto em ficha.js:157 existe para fechar');
});
