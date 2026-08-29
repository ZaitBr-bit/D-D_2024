// ============================================================
// Oraculos de `superficieDaTroca` (site/js/sheet/grimorio.js) -- Tarefa 2
// do sub-projeto 2026-08-29-troca-por-classe-descanso: a peca pura que
// `mostrarTrocaMagiaConhecida` e `mostrarTrocaTruque` passam a usar para
// resolver a superficie de conjuracao de UMA troca a partir de
// `opcoes.classe`, em vez de sempre `superficieAtiva()` (o seletor
// COMPARTILHADO da ficha, que a Tarefa 3 nao pode mexer numa cadeia de
// modais -- ver o docblock de `superficieDaTroca`).
//
// RODADA DE CORRECAO 1: os Oraculos 1-5 (abaixo) provam so a RESOLUCAO da
// superficie, sem DOM -- o achado Important 3 da revisao apontou que o
// comportamento novo e VISIVEL das duas modais (titulo/explicacao nomeando
// a classe, e a lista de candidatas a sair seguindo `opcoes.classe`)
// tinha ficado sem oraculo nenhum. Os testes "DOM" no fim deste arquivo
// rodam as duas funcoes REAIS (`mostrarTrocaMagiaConhecida`,
// `mostrarTrocaTruque`) de ponta a ponta sobre um documento falso -- o
// mesmo padrao ja usado em magia-classe-leitores.test.mjs:541-643
// (`elementoFalsoGrimorio`/`instalarDocumentoFalsoGrimorio`), copiado (nao
// importado: sao funcoes locais, nao exportadas) para este arquivo.
//
// O QUE NEM ASSIM ESTE ARQUIVO PROVA: clique de verdade em cada card,
// fechamento do modal, a gravacao final da troca no personagem -- isso
// continua e2e (Tarefa 4, ver task-2-brief.md). O que os testes DOM daqui
// provam e o HTML que as duas funcoes escrevem ja com `opcoes.classe`
// resolvida -- o suficiente para os achados Important 3.
//
// Arquivo NOVO (nao uma extensao de troca-descanso-por-classe.test.mjs,
// da Tarefa 1): aquele arquivo prende `trocasDoDescansoLongo`
// (site/js/regras-preparo-magias.js), a peca "que direito o personagem
// tem"; este prende `superficieDaTroca` (site/js/sheet/grimorio.js) e as
// duas modais que a usam -- funcoes diferentes, em modulos diferentes,
// sem nada em comum alem do sub-projeto.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, lerClassesDados } from './harness.mjs';

// ------------------------------------------------------------
// ORACULO 1 -- as tres respostas da resolucao: classe que casa devolve a
// superficie DELA; classe que nao casa cai na ativa; ausencia de
// opcoes.classe tambem cai na ativa.
// ------------------------------------------------------------
test('ORACULO 1 -- classe que casa devolve a superficie dela; classe que nao casa e ausencia caem na ativa', async () => {
  const { sheetGrimorio, contextoClasse } = await modulosApp();
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 },
    { classe: 'Druida', nivel: 5 },
  ]);

  const casada = sheetGrimorio.superficieDaTroca(p, 'Druida');
  assert.equal(casada.classe, 'Druida',
    'opcoes.classe "Druida" tem que devolver a superficie do Druida, nao a ativa (Clerigo, ordem 0)');

  const naoCasada = sheetGrimorio.superficieDaTroca(p, 'Bardo');
  assert.equal(naoCasada.classe, 'Clérigo',
    'classe "Bardo" nao existe nas superficies do personagem -- tem que cair na ativa (Clerigo, ordem 0), ' +
    'nunca montar uma superficie sintetica nem devolver undefined/null com o personagem tendo superficies');

  const semClasse = sheetGrimorio.superficieDaTroca(p, undefined);
  assert.equal(semClasse.classe, 'Clérigo',
    'sem opcoes.classe, a resolucao tem que ser a ativa -- o comportamento de sempre');

  contextoClasse.resetarSuperficieSelecionada();
});

// ------------------------------------------------------------
// ORACULO 2 -- nao-regressao da maioria: personagem de classe UNICA. Com
// opcoes.classe igual ao nome da unica classe, ou sem opcoes.classe, a
// resposta tem que ser a MESMA superficie -- e o oraculo que prende
// "sem opcoes.classe, o comportamento tem de ser byte a byte o de hoje".
// ------------------------------------------------------------
test('ORACULO 2 -- classe unica: opcoes.classe com o nome dela e ausencia de opcoes.classe produzem a MESMA superficie', async () => {
  const { sheetGrimorio, contextoClasse } = await modulosApp();
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);

  const comClasse = sheetGrimorio.superficieDaTroca(p, 'Mago');
  const semClasse = sheetGrimorio.superficieDaTroca(p, undefined);
  assert.equal(comClasse.classe, 'Mago');
  assert.equal(semClasse.classe, 'Mago');
  assert.deepEqual(comClasse, semClasse,
    'para um personagem de classe unica, pedir a classe por nome ou nao pedir nenhuma classe ' +
    'tem que devolver a MESMA superficie -- e o oraculo da nao-regressao da maioria dos personagens ' +
    '(todo personagem hoje na ficha e de classe unica)');

  contextoClasse.resetarSuperficieSelecionada();
});

// ------------------------------------------------------------
// ORACULO 3 -- o oraculo do sub-projeto inteiro: Clerigo 5/Druida 5 com o
// Clerigo ativo (o padrao, ninguem trocou de aba); pedir 'Druida' tem que
// devolver a superficie do Druida, NAO a ativa.
// ------------------------------------------------------------
test('ORACULO 3 -- Clerigo 5/Druida 5, Clerigo ativo: pedir "Druida" devolve a do Druida, nao a ativa', async () => {
  const { sheetGrimorio, contextoClasse } = await modulosApp();
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 },
    { classe: 'Druida', nivel: 5 },
  ]);

  const ativa = contextoClasse.superficieAtivaDaFicha(p);
  assert.equal(ativa.classe, 'Clérigo', 'fixture: sem selecao no seletor, a ativa e a classe inicial (ordem 0)');

  const resolvida = sheetGrimorio.superficieDaTroca(p, 'Druida');
  assert.equal(resolvida.classe, 'Druida',
    'pedir "Druida" com o Clerigo ativo tem que devolver a superficie do DRUIDA -- se devolver a ' +
    'ativa (Clerigo), a resolucao esta ignorando opcoes.classe e caindo direto no fallback');
  assert.notEqual(resolvida.classe, ativa.classe,
    'a superficie resolvida nao pode ser a mesma classe da superficie ativa neste cenario');

  contextoClasse.resetarSuperficieSelecionada();
});

// ------------------------------------------------------------
// ORACULO 5 -- Achado Important 2 da rodada 1 de revisao: nenhum oraculo
// acima distingue "cai na superficie ATIVA" de "cai na PRIMEIRA
// superficie" -- os Oraculos 1 e 3 usam Clerigo/Druida com o Clerigo
// ATIVO, que tambem e' a PRIMEIRA (ordem 0); uma implementacao que sempre
// devolvesse `superficiesDaFicha(personagem)[0]` (a primeira, fixa, o
// jeito ANTIGO de antes do seletor de classe existir -- ver o docblock de
// `superficieAtivaDaFicha`, contexto-classe.js) passaria nos quatro
// oraculos anteriores sem que ninguem notasse. Este oraculo marca a
// SEGUNDA classe como ativa via `definirSuperficieSelecionada` e prova
// que o fallback (classe pedida ausente/nao casada) segue ELA, nao a
// primeira.
// ------------------------------------------------------------
test('ORACULO 5 -- fallback segue a superficie ATIVA (definirSuperficieSelecionada), nao a primeira do roteiro', async () => {
  const { sheetGrimorio, contextoClasse } = await modulosApp();
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 },
    { classe: 'Druida', nivel: 5 },
  ]);

  // Clerigo e' a PRIMEIRA (ordem 0); marca a SEGUNDA (Druida) como ativa
  // no seletor -- o mesmo mecanismo que a aba da ficha usa.
  contextoClasse.definirSuperficieSelecionada('Druida');
  const ativa = contextoClasse.superficieAtivaDaFicha(p);
  assert.equal(ativa.classe, 'Druida',
    'sanity: apos definirSuperficieSelecionada("Druida"), a superficie ATIVA tem que ser a Druida -- ' +
    'se isto falhar, o oraculo abaixo nao mede nada');

  const semClasse = sheetGrimorio.superficieDaTroca(p, undefined);
  assert.equal(semClasse.classe, 'Druida',
    'sem opcoes.classe, o fallback tem que devolver a ATIVA (Druida, a segunda marcada no seletor) -- ' +
    'se devolver "Clerigo", a resolucao esta usando superficiesDaFicha(p)[0] (a PRIMEIRA, fixa) em vez ' +
    'de superficieAtivaDaFicha(p) (a que o seletor da ficha escolheu)');

  const naoCasada = sheetGrimorio.superficieDaTroca(p, 'Bardo');
  assert.equal(naoCasada.classe, 'Druida',
    'classe pedida que nao casa tambem tem que cair na ATIVA (Druida), pelo mesmo motivo do caso acima');

  contextoClasse.resetarSuperficieSelecionada();
});

// ------------------------------------------------------------
// ORACULO 4 -- degenerado: personagem sem NENHUMA superficie de conjuracao
// (Barbaro puro) devolve null, sem lancar -- mesmo pedindo uma classe que
// nao existe nele.
// ------------------------------------------------------------
test('ORACULO 4 -- personagem sem nenhuma superficie de conjuracao devolve null, sem lancar', async () => {
  const { sheetGrimorio, contextoClasse } = await modulosApp();
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 5 }]);

  assert.equal(sheetGrimorio.superficieDaTroca(p, 'Bárbaro'), null,
    'Barbaro nao e classe conjuradora -- nenhuma superficie existe para casar, e o fallback ' +
    '(superficieAtivaDaFicha) tambem devolve null para um personagem sem superficie nenhuma');
  assert.equal(sheetGrimorio.superficieDaTroca(p, undefined), null);

  contextoClasse.resetarSuperficieSelecionada();
});

// ============================================================
// ORACULOS DOM -- Achado Important 3 da rodada 1: o comportamento novo
// VISIVEL das duas modais (titulo nomeando a classe; candidatas a sair
// seguindo `opcoes.classe`) ficou sem oraculo. Padrao de DOM falso copiado
// de magia-classe-leitores.test.mjs:541-643 (`elementoFalsoGrimorio`/
// `instalarDocumentoFalsoGrimorio`) -- funcoes locais daquele arquivo, nao
// exportadas, por isso reproduzidas aqui em vez de importadas.
// ============================================================

/**
 * Elemento de DOM falso minimo para as duas modais rodarem ate o fim sem
 * lancar: `montarSeletor` (site/js/ui-opcoes.js) faz
 * `el.querySelector('.opcao-lista')`/`('.opcao-contagem')`/`('.opcao-busca')`
 * sobre o container que ela mesma preenche -- por isso `querySelector`
 * aqui devolve um filho fake CACHEADO por seletor (identidade estavel
 * entre chamadas, para `montarSeletor` escrever no MESMO objeto que este
 * arquivo depois le), em vez de `null`.
 */
function elementoFalsoGrimorio(id) {
  const filhos = new Map();
  const el = {
    id, style: {}, innerHTML: '', textContent: '', scrollTop: 0,
    className: '', dataset: {}, handlers: {}, value: '',
    addEventListener(evento, fn) { (el.handlers[evento] ||= []).push(fn); },
    removeAttribute() {}, setAttribute() {}, appendChild() {}, remove() {},
    closest: () => null,
    querySelector(sel) {
      if (!filhos.has(sel)) filhos.set(sel, elementoFalsoGrimorio(sel));
      return filhos.get(sel);
    },
    querySelectorAll: () => [],
    classList: { add() {}, remove() {}, toggle() {} },
  };
  return el;
}

/** Instala um `document` falso com `getElementById` cacheado por id (para
 *  as duas modais e `montarSeletor` lerem/escreverem sempre no MESMO
 *  objeto) e devolve `{ registro, restaurar }` -- `registro` e o Map
 *  id -> elemento falso, para o teste inspecionar o que foi escrito.
 */
function instalarDocumentoFalsoGrimorio() {
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
      if (!registro.has(id)) registro.set(id, elementoFalsoGrimorio(id));
      return registro.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => elementoFalsoGrimorio(tag),
    body: { appendChild() {} },
  };
  return {
    registro,
    restaurar() {
      globalThis.document = docOriginal;
      globalThis.setTimeout = setTimeoutOriginal;
    },
  };
}

/**
 * Prepara sheet/estado.js com dados REAIS de disco -- o minimo que
 * `mostrarTrocaMagiaConhecida`/`mostrarTrocaTruque` precisam para rodar
 * sem lancar (leem classesData/indice de magias). Zera a superficie
 * selecionada, para a superficie ATIVA cair sempre na primeira classe do
 * roteiro -- mesmo padrao de `prepararEstadoParaDescanso`
 * (multiclasse-descansos.test.mjs) e `medirPortaoEModal`
 * (magia-classe-leitores.test.mjs).
 * @param {object} p Personagem ja montado (personagemMulticlasse).
 */
async function prepararEstadoGrimorio(p) {
  const { sheetEstado, db, levelup, contextoClasse } = await modulosApp();
  const mapaClasses = lerClassesDados();
  sheetEstado.definirChar(p);
  sheetEstado.definirContainer({
    innerHTML: '', querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {},
  });
  sheetEstado.definirClasseData(mapaClasses.get(p.classe) || null);
  sheetEstado.definirClassesData(mapaClasses);
  const indiceMagias = await db.getIndiceMagias();
  sheetEstado.definirIndiceMagias(indiceMagias?.magias || []);
  sheetEstado.definirTalentos(await db.getTalentos());
  sheetEstado.definirEspecies(await db.getEspecies());
  const magiasAutomaticas = await levelup.obterMagiasAutomaticasDoPersonagem(p);
  sheetEstado.definirMagiasDominio(magiasAutomaticas.dominio);
  sheetEstado.definirMagiasSempre(magiasAutomaticas.sempre);
  contextoClasse.resetarSuperficieSelecionada();
}

// ------------------------------------------------------------
// ORACULO DOM 1 -- mostrarTrocaMagiaConhecida: titulo nomeia a classe
// pedida, e a lista de candidatas a sair segue `opcoes.classe` (a magia
// DESTA classe aparece, a de OUTRA classe nao) -- nao a superficie ATIVA
// (Clerigo, ordem 0, sem selecao no seletor).
//
// 'Bênção' (1º Círculo de Clérigo, ausente da lista de Druida) e 'Amizade
// Animal' (1º Círculo de Druida, ausente da lista de Clérigo) sao nomes
// REAIS de dados/classes/magias_{clerigo,druida}.json -- conferidos antes
// de escrever este teste, para nao inventar fixture que o app rejeitaria.
// ------------------------------------------------------------
test('ORACULO DOM 1 -- mostrarTrocaMagiaConhecida: titulo nomeia a classe e candidatas seguem opcoes.classe, nao a ativa', async () => {
  const { sheetGrimorio } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 },
    { classe: 'Druida', nivel: 5 },
  ]);
  p.magias_preparadas = [
    { nome: 'Bênção', circulo: 1, classe: 'Clérigo' },
    { nome: 'Amizade Animal', circulo: 1, classe: 'Druida' },
  ];
  await prepararEstadoGrimorio(p);

  const { registro, restaurar } = instalarDocumentoFalsoGrimorio();
  try {
    await sheetGrimorio.mostrarTrocaMagiaConhecida(null, { classe: 'Druida' });
  } finally {
    restaurar();
  }

  const titulo = registro.get('modal-titulo')?.textContent || '';
  assert.match(titulo, /Druida/,
    `com opcoes.classe: 'Druida' e sem titulo proprio, o titulo do modal ('${titulo}') tem que nomear ` +
    'a classe -- para uma cadeia de modais (T3) nao mostrar dois "Trocar Magia Conhecida" identicos');

  const listaHtml = registro.get('troca-conhecida-remover-lista')?.querySelector('.opcao-lista')?.innerHTML || '';
  assert.match(listaHtml, /data-opcao="Amizade Animal"/,
    'candidata a sair pedindo opcoes.classe:"Druida" tem que incluir "Amizade Animal" (carimbada Druida)');
  assert.doesNotMatch(listaHtml, /Bênção/,
    'candidata a sair pedindo opcoes.classe:"Druida" NAO pode incluir "Bênção" (carimbada Clérigo, de ' +
    'OUTRA classe) -- se aparecer, a resolucao caiu na superficie ATIVA (Clerigo) em vez da pedida');
});

// ------------------------------------------------------------
// ORACULO DOM 2 -- mostrarTrocaTruque: titulo nomeia a classe pedida; a
// lista de SAIDA (remover) nao perde um truque de OUTRA classe (Achado
// Important 1, ja consertado em superficieDaTroca/mostrarTrocaTruque); e
// a lista de ENTRADA (adicionar, revelada ao selecionar o truque a
// remover) segue `opcoes.classe`, nao a ativa.
//
// 'Chama Sagrada' (Truque de Clérigo, ausente da lista de Druida),
// 'Bordão Místico' (Truque de Druida, ausente da lista de Clérigo) e
// 'Palavra de Radiância' (Truque de Clérigo, ausente da lista de Druida)
// sao nomes REAIS, conferidos em dados/classes/magias_{clerigo,druida}.json.
// ------------------------------------------------------------
test('ORACULO DOM 2 -- mostrarTrocaTruque: titulo nomeia a classe, saida nao perde truque de outra classe, entrada segue opcoes.classe', async () => {
  const { sheetGrimorio } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 },
    { classe: 'Druida', nivel: 5 },
  ]);
  // Personagem so tem truque do CLERIGO -- superficie ATIVA (sem selecao)
  // e' o Clerigo, mas a troca pedida (opcoes.classe) e' do DRUIDA.
  p.magias_conhecidas = [{ nome: 'Chama Sagrada', circulo: 0 }];
  await prepararEstadoGrimorio(p);

  const { registro, restaurar } = instalarDocumentoFalsoGrimorio();
  try {
    await sheetGrimorio.mostrarTrocaTruque(null, { classe: 'Druida' });

    const titulo = registro.get('modal-titulo')?.textContent || '';
    assert.match(titulo, /Druida/,
      `com opcoes.classe: 'Druida', o titulo do modal ('${titulo}') tem que nomear a classe`);

    const listaRemoverHtml = registro.get('troca-truque-remover-lista')?.querySelector('.opcao-lista')?.innerHTML || '';
    assert.match(listaRemoverHtml, /data-opcao="Chama Sagrada"/,
      'ACHADO IMPORTANT 1: "Chama Sagrada" (truque que o personagem TEM, do Clerigo -- OUTRA classe do ' +
      'ponto de vista da troca pedida, Druida) tem que continuar na lista de SAIDA -- se sumir, a busca ' +
      'de dados completos voltou a filtrar a lista de saida pela classe de `sup`');

    // Simula o clique no card "Chama Sagrada" da lista de remover -- o
    // mesmo handler que ligarClique (site/js/ui-opcoes.js) registra via
    // el.addEventListener('click', ...) sobre o elemento passado a
    // montarSeletor (aqui, 'troca-truque-remover-lista'; NAO o filho
    // '.opcao-lista', que so recebe o innerHTML).
    const elRemover = registro.get('troca-truque-remover-lista');
    const cardFalso = { dataset: { opcao: 'Chama Sagrada' }, closest: (sel) => (sel === '[data-opcao]' ? cardFalso : null) };
    const cliques = elRemover?.handlers?.click || [];
    assert.equal(cliques.length, 1, 'sanity: montarSeletor tem que ter registrado UM clique no container de remover');
    cliques[0]({ target: cardFalso });

    const listaAdicionarHtml = registro.get('troca-truque-adicionar-lista')?.querySelector('.opcao-lista')?.innerHTML || '';
    assert.match(listaAdicionarHtml, /data-opcao="Bordão Místico"/,
      'lista de ENTRADA (o que pode substituir "Chama Sagrada") tem que vir da lista de DRUIDA ' +
      '(opcoes.classe) -- "Bordão Místico" e truque de Druida');
    assert.doesNotMatch(listaAdicionarHtml, /Palavra de Radiância/,
      '"Palavra de Radiância" e truque de CLERIGO, ausente da lista de Druida -- nao pode aparecer como ' +
      'candidata a entrar quando opcoes.classe e "Druida" (se aparecer, a entrada caiu na ativa, nao na pedida)');
  } finally {
    restaurar();
  }
});
