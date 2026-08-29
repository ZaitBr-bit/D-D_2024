// ============================================================
// Oráculos da Tarefa 2 (sub-projeto "tela de magias por classe"):
// conversão do modal "Gerenciar Magias" (site/js/sheet/grimorio.js) para
// decidir pela SUPERFÍCIE DE CONJURAÇÃO ATIVA -- a primeira de
// superficiesDaFicha(char) -- em vez de char.classe/char.subclasse/
// char.nivel (a classe INICIAL, o espelho; o nível TOTAL).
//
// O DEFEITO RELATADO: um Ladino 5/Mago 1 abria "Gerenciar Magias" e via
// "Truques: 3/0", "Preparadas: 0/0", nenhuma aba de círculo, e o console
// acusava "Erro ao carregar classes/magias_ladino.json: Erro 404"
// (magias.js:347, chamado sem argumento por grimorio.js:62) -- o modal
// decidia tudo pela classe inicial (Ladino), que não tem lista de magias
// nem colunas de magia na tabela, e ignorava por completo o Mago.
//
// Este arquivo prende, com dados REAIS (dados/classes/mago.json, não
// valores chutados):
//   Oráculo 1 -- o caso reportado: Ladino 5/Mago 1 usa a lista e os
//                limites do MAGO, sem 404.
//   Oráculo 2 -- classe única não muda nada: Mago 5 puro, provado por
//                IDENTIDADE de objeto (===), não por comparação de valor
//                (fetchJSON, site/js/db.js, cacheia por caminho -- ver o
//                docblock do oráculo).
//   Oráculo 3 -- zero superfícies: um Bárbaro puro não tenta carregar
//                lista de classe nenhuma (o mesmo 404, por outra causa).
//   Oráculo 4 -- o portão do grimório: um Ladino 5/Mago 1 não pode
//                preparar magia de círculo que não esteja no grimório
//                (grimorio.js, o bloqueio convertido para a superfície
//                ativa em vez de char.classe).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, lerClassesDados } from './harness.mjs';

const mods = await modulosApp();
// `sheetMagias` entra aqui para o Oráculo 4g: ele é o ÚNICO deste arquivo
// que confronta as DUAS telas entre si (a seção Magias da ficha e o modal
// "Gerenciar Magias"), em vez de medir o modal contra um valor esperado.
const { sheetEstado, sheetGrimorio, sheetMagias, contextoClasse, utils, db } = mods;

// Mapa nome-de-classe -> JSON completo (leitura direta do disco, não pelo
// cache de fetchJSON de db.js) -- usado pelos Oráculos 1, 3 e 4, que só
// precisam dos DADOS, não da identidade de objeto entre chamadas (essa é
// a pergunta exclusiva do Oráculo 2).
const mapaDadosDisco = lerClassesDados();

// ------------------------------------------------------------
// Auxiliar comum aos Oráculos 1-3: chama mostrarBuscaMagia() de verdade e
// captura o HTML gravado em #modal-corpo, sem clicar em nada dentro do
// modal. Mesmo padrão de classes-passivas.test.mjs (Achado N1 daquela
// tarefa): mostrarBuscaMagia é assíncrona e termina chamando abrirModal
// (site/js/utils.js), que grava HTML no elemento #modal-corpo do DOM
// real -- o stub de `document` do harness só tem getElementById
// devolvendo null, insuficiente. Troca document.getElementById/
// querySelectorAll por uma versão local só durante a chamada, restaura
// sempre (mesmo se a função lançar), e também intercepta console.error
// (a marca do 404 de fetchJSON, site/js/db.js:21) para os oráculos que
// precisam provar "nenhum erro".
// ------------------------------------------------------------
async function chamarCapturandoModalEErros(fnAssincrona) {
  const originalGetElementById = document.getElementById;
  const originalQuerySelectorAll = document.querySelectorAll;
  const originalConsoleError = console.error;
  const erros = [];
  console.error = (...args) => { erros.push(args.map(String).join(' ')); };
  const elementoFalso = () => ({
    style: {}, innerHTML: '', textContent: '', value: '', className: '',
    querySelectorAll: () => [], addEventListener: () => {},
    classList: { add() {}, remove() {} },
  });
  const elementos = {
    'modal-overlay': { style: { display: 'none' } },
    'modal-titulo': elementoFalso(),
    'modal-corpo': elementoFalso(),
    'modal-acoes': elementoFalso(),
    'modal-container': { scrollTop: 0 },
    'resultado-magias': elementoFalso(),
    'busca-magia-add': elementoFalso(),
    'gm-contador-truques': elementoFalso(),
    'gm-contador-preparadas': elementoFalso(),
  };
  document.getElementById = (id) => elementos[id] || null;
  document.querySelectorAll = () => [];
  try {
    await fnAssincrona();
  } finally {
    document.getElementById = originalGetElementById;
    document.querySelectorAll = originalQuerySelectorAll;
    console.error = originalConsoleError;
  }
  return { html: elementos['modal-corpo'].innerHTML, erros };
}

// ------------------------------------------------------------
// DOM mínimo COM cliques, exclusivo do Oráculo 4: o portão do grimório só
// dispara dentro do handler de clique de um `data-circ-check`, e esse
// handler só existe depois de trocar para a aba do círculo (a aba
// "Preparadas Atuais", que abre por padrão, não lista candidatas a
// adicionar). Não é um parser de HTML de verdade -- extrai elementos por
// REGEX, casando só os dois formatos de seletor que sheet/grimorio.js usa
// para anexar listeners (`.classe` e `[data-atributo]`) e reconstrói
// `el.dataset` a partir dos `data-*` do mesmo elemento. O bastante para a
// troca de aba e bindEventosTab() rodarem de verdade, e o teste "clicar"
// chamando o handler capturado.
//
// IDENTIDADE ESTÁVEL: cada elemento fake é cacheado por (seletor, texto
// da tag) -- chamar querySelectorAll de novo sobre o MESMO html devolve os
// MESMOS objetos, preservando os listeners já anexados, como o DOM real
// faz. Sem isso, o clique simulado cairia num objeto diferente do que
// recebeu o addEventListener, e nada disparava.
// ------------------------------------------------------------
function criarDomDeModalComCliques() {
  const cache = new Map();

  function casaSeletor(tag, seletor) {
    if (seletor.startsWith('[') && seletor.endsWith(']')) {
      const attr = seletor.slice(1, -1);
      return new RegExp(`\\b${attr}="`).test(tag);
    }
    if (seletor.startsWith('.')) {
      const classe = seletor.slice(1);
      const m = tag.match(/class="([^"]*)"/);
      return !!m && m[1].split(/\s+/).includes(classe);
    }
    return false;
  }

  function datasetDe(tag) {
    const dataset = {};
    const regexAttr = /data-([a-z0-9-]+)="([^"]*)"/gi;
    let a;
    while ((a = regexAttr.exec(tag))) {
      const chave = a[1].replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
      dataset[chave] = a[2];
    }
    return dataset;
  }

  function elementosDoHtml(html, seletorOriginal) {
    // "#id .classe" é o único seletor composto usado por grimorio.js
    // (a troca de abas); a busca já é sobre o html do elemento certo, então
    // o prefixo "#id " é só filtro de escopo e pode ser descartado aqui.
    const seletor = seletorOriginal.replace(/^#[\w-]+\s+/, '');
    const encontrados = [];
    const regexTag = /<[a-z][a-z0-9]*\b[^>]*>/gi;
    let m;
    while ((m = regexTag.exec(html))) {
      const tag = m[0];
      if (!casaSeletor(tag, seletor)) continue;
      const chave = `${seletorOriginal}::${tag}`;
      if (!cache.has(chave)) {
        const listeners = [];
        cache.set(chave, {
          dataset: datasetDe(tag),
          classList: { add() {}, remove() {} },
          addEventListener(_tipo, fn) { listeners.push(fn); },
          dispararClick() { listeners.forEach((fn) => fn({ stopPropagation() {}, target: {} })); },
        });
      }
      encontrados.push(cache.get(chave));
    }
    return encontrados;
  }

  function criarPagina() {
    let html = '';
    return {
      style: {}, textContent: '', value: '', className: '',
      classList: { add() {}, remove() {} },
      get innerHTML() { return html; },
      set innerHTML(v) { html = v; },
      querySelectorAll(seletor) { return elementosDoHtml(html, seletor); },
      addEventListener() {},
    };
  }

  const elementos = {
    'modal-overlay': { style: { display: 'none' } },
    'modal-titulo': criarPagina(),
    'modal-corpo': criarPagina(),
    'modal-acoes': criarPagina(),
    'modal-container': { scrollTop: 0 },
    'resultado-magias': criarPagina(),
    'busca-magia-add': criarPagina(),
    'gm-contador-truques': criarPagina(),
    'gm-contador-preparadas': criarPagina(),
    // toast() (utils.js) grava aqui a cada clique que dispara um aviso --
    // o clique real de adicionar/recusar magia sempre passa por toast().
    'toast-container': { appendChild() {} },
  };

  return {
    elementos,
    getElementById: (id) => elementos[id] || null,
    // A barra de abas é HTML estático do corpo do modal (abrirModal grava
    // uma vez só); document.querySelectorAll busca nele porque, no DOM
    // real, o innerHTML de #modal-corpo entra na árvore do documento.
    querySelectorAll: (seletor) => elementosDoHtml(elementos['modal-corpo'].innerHTML, seletor),
  };
}

/** Instala o DOM-com-cliques, roda `fnAssincrona`, e devolve `{ dom }` já pronto para orquestrar cliques. Restaura document.* no `finally` de quem chamar. */
function instalarDomDeModalComCliques() {
  const dom = criarDomDeModalComCliques();
  const originalGetElementById = document.getElementById;
  const originalQuerySelectorAll = document.querySelectorAll;
  const originalCreateElement = document.createElement;
  document.getElementById = dom.getElementById;
  document.querySelectorAll = dom.querySelectorAll;
  // toast() (utils.js) cria um elemento e agenda `el.remove()` 3s depois --
  // o stub padrão do harness (harness.mjs:35) não tem `.remove()`, só
  // `classList.remove()`; sem isto, o timer do toast dispara DEPOIS do
  // teste acabar e derruba a suíte inteira com uma exceção não capturada.
  // Um clique de verdade (o que este arquivo é o primeiro a simular) é o
  // que expõe essa lacuna -- os demais testes de unidade nunca chamam
  // toast() de fato.
  document.createElement = () => ({
    style: {}, classList: { add() {}, remove() {} },
    appendChild() {}, setAttribute() {}, remove() {},
  });
  return {
    dom,
    restaurar() {
      document.getElementById = originalGetElementById;
      document.querySelectorAll = originalQuerySelectorAll;
      document.createElement = originalCreateElement;
    },
  };
}

// ============================================================
// ORÁCULO 1 -- o caso reportado: Ladino 5/Mago 1.
// ============================================================
test('Oráculo 1: Ladino 5/Mago 1 -- mostrarBuscaMagia() usa a lista e os limites do Mago, sem erro de console', async () => {
  const p = await personagemMulticlasse([{ classe: 'Ladino', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  // Grimório com UMA magia registrada -- realista (a criação de personagem
  // exige 6 magias de 1º círculo no grimório de um Mago nível 1, ver
  // creator/wizard.js:348-349) e necessário para a aba de círculo aparecer:
  // "Magias de círculo do Mago só podem ser preparadas se já estiverem
  // registradas" (grimorio.js) -- a grade do círculo é derivada do
  // GRIMÓRIO, não da lista inteira da classe (ver Oráculo 4 para a prova
  // de que essa filtragem é exatamente o que impede preparar fora dele).
  p.grimorio = [{ nome: 'Armadura Arcana', circulo: 1 }];
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Ladino')); // espelho da classe inicial, como renderSheet monta
  sheetEstado.definirClassesData(mapaDadosDisco);

  const { html, erros } = await chamarCapturandoModalEErros(() => sheetGrimorio.mostrarBuscaMagia());

  assert.deepEqual(erros, [],
    `mostrarBuscaMagia() não pode logar erro nenhum (o 404 de classes/magias_ladino.json, que não ` +
    `existe, seria um) -- erros capturados: ${JSON.stringify(erros)}`);

  // Limites medidos na tabela REAL do Mago nível 1 (dados/classes/mago.json),
  // não chutados: Truques "3", Magias Preparadas "4".
  const tabelaMago = mapaDadosDisco.get('Mago').tabela_caracteristicas;
  const linhaNivel1 = tabelaMago.find((r) => r['Nível'] === '1');
  assert.ok(linhaNivel1, 'sanity: dados/classes/mago.json não tem linha de nível 1');
  const truquesEsperados = parseInt(linhaNivel1['Truques'], 10);
  const preparadasEsperadas = parseInt(linhaNivel1['Magias Preparadas'], 10);
  assert.equal(truquesEsperados, 3, 'sanity: a tabela do Mago mudou -- truques de nível 1 não é mais 3');
  assert.equal(preparadasEsperadas, 4, 'sanity: a tabela do Mago mudou -- preparadas de nível 1 não é mais 4');

  const mTruques = html.match(/Truques:\s*(\d+)\/(\d+)/);
  assert.ok(mTruques, 'sanity: não achei "Truques: X/Y" no HTML de mostrarBuscaMagia()');
  assert.equal(parseInt(mTruques[2], 10), truquesEsperados,
    `limite de truques deveria ser o do Mago nível 1 (${truquesEsperados}) -- antes do conserto ` +
    `o Ladino (classe inicial, sem colunas de magia) dava 0`);

  const mPrep = html.match(/Preparadas:\s*(\d+)\/(\d+)/);
  assert.ok(mPrep, 'sanity: não achei "Preparadas: X/Y" no HTML de mostrarBuscaMagia()');
  assert.equal(parseInt(mPrep[2], 10), preparadasEsperadas,
    `limite de preparadas deveria ser o do Mago nível 1 (${preparadasEsperadas}) -- antes do conserto ` +
    `dava 0`);

  // A prova de que a LISTA veio do Mago (classes/magias_mago.json), e não
  // de um array vazio por 404: a aba de 1º círculo existe.
  assert.match(html, /1º Círculo/,
    'deveria haver uma aba de "1º Círculo" -- sem ela, a lista de magias do Mago não carregou');
});

// ============================================================
// ORÁCULO 2 -- classe única não muda nada: Mago 5 puro, provado por
// IDENTIDADE de objeto, não por comparação de valor.
//
// site/js/db.js:12-14 (fetchJSON) cacheia em memória POR CAMINHO. Na
// abertura real da ficha (site/js/pages/sheet.js:40 e :50),
// `classeData` (o espelho que a tela usava ANTES desta tarefa) e
// `classesData.get('Mago')` (o mapa que `superficiesDaFicha` consulta
// AGORA) vêm das MESMAS duas chamadas a `getClasse('Mago')` -- a segunda
// é cache hit e devolve o MESMO objeto da primeira. Reproduz aqui essa
// MESMA ordem (getClasse direto, depois garantirDadosDeClasses) para que
// a asserção seja sobre `===`, não sobre igualdade estrutural: uma
// conversão que passasse a ler um dado DIFERENTE para classe única
// (uma cópia, um outro caminho de arquivo) faria esta asserção falhar
// mesmo que os VALORES continuassem batendo por coincidência.
// ============================================================
test('Oráculo 2: Mago 5 de classe única não muda -- identidade entre classeData e a tabela da superfície ativa', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);

  // Mesma ordem de site/js/pages/sheet.js: definirClasseData(await
  // getClasse(char.classe)) primeiro, garantirDadosDeClasses(char, true)
  // depois.
  const classeDataMago = await db.getClasse('Mago');
  sheetEstado.definirClasseData(classeDataMago);
  sheetEstado.definirChar(p);
  await contextoClasse.garantirDadosDeClasses(p, true);

  const superficies = contextoClasse.superficiesDaFicha(p);
  assert.equal(superficies.length, 1, 'sanity: Mago de classe única deveria ter exatamente uma superfície');
  assert.equal(superficies[0].classe, 'Mago');

  assert.equal(superficies[0].tabela, classeDataMago.tabela_caracteristicas,
    'a tabela da superfície ativa deveria ser o MESMO objeto (===) que classeData.tabela_caracteristicas ' +
    '-- fetchJSON cacheia por caminho, então para classe única as duas leituras vêm da mesma chamada ' +
    'a getClasse("Mago"). Se isto falhar, a conversão passou a ler uma CÓPIA (ou um dado diferente) ' +
    'para o caso mais comum do app: personagem de classe única.');

  // Confirma também que mostrarBuscaMagia() de fato CONSOME essa tabela:
  // os limites batem com getLimitesMagias(a mesma tabela, 5, null) --
  // mesma função que o app usa, chamada aqui de fora para não reimplementar
  // a regra dentro do teste.
  const limitesEsperados = utils.getLimitesMagias(classeDataMago.tabela_caracteristicas, 5, null);
  const { html, erros } = await chamarCapturandoModalEErros(() => sheetGrimorio.mostrarBuscaMagia());
  assert.deepEqual(erros, [], `sem erro de console para Mago 5 de classe única -- erros: ${JSON.stringify(erros)}`);
  const mTruques = html.match(/Truques:\s*\d+\/(\d+)/);
  const mPrep = html.match(/Preparadas:\s*\d+\/(\d+)/);
  assert.ok(mTruques && mPrep, 'sanity: não achei os contadores de Truques/Preparadas no HTML');
  assert.equal(parseInt(mTruques[1], 10), limitesEsperados.truques);
  assert.equal(parseInt(mPrep[1], 10), limitesEsperados.preparadas);
});

// ============================================================
// ORÁCULO 3 -- zero superfícies: um Bárbaro puro (sem nenhuma classe/
// subclasse conjuradora -- o mesmo estado de um Bárbaro com Iniciado em
// Magia, que abre a seção Magias por talento) não pode tentar carregar
// lista de classe nenhuma, senão toma o MESMO 404 do caso reportado, só
// que por uma causa diferente (nenhuma classe, em vez de classe errada).
// ============================================================
test('Oráculo 3: zero superfícies (Bárbaro puro) -- nenhuma tentativa de carregar lista de classe, nenhum erro', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 5 }]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Bárbaro'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  assert.equal(contextoClasse.superficiesDaFicha(p).length, 0,
    'sanity: Bárbaro puro não deveria ter nenhuma superfície de conjuração por classe');

  // Espiona o fetch (o stub de rede do harness) para provar, por
  // COMPORTAMENTO e não só por ausência de erro logado, que nenhum
  // arquivo classes/magias_*.json foi sequer pedido.
  const chamadasFetch = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opcoes) => {
    chamadasFetch.push(String(url));
    return fetchOriginal(url, opcoes);
  };
  let resultado;
  try {
    resultado = await chamarCapturandoModalEErros(() => sheetGrimorio.mostrarBuscaMagia());
  } finally {
    globalThis.fetch = fetchOriginal;
  }
  const { html, erros } = resultado;

  assert.deepEqual(erros, [],
    `sem superfície nenhuma, mostrarBuscaMagia() não pode logar erro -- erros: ${JSON.stringify(erros)}`);

  const chamadasListaDeClasse = chamadasFetch.filter((u) => /classes\/magias_/.test(u));
  assert.deepEqual(chamadasListaDeClasse, [],
    `sem superfície de conjuração, o modal não pode tentar carregar lista de magia de classe ` +
    `nenhuma -- chamadas capturadas: ${JSON.stringify(chamadasListaDeClasse)}`);

  // Sem tabela e sem subclasse conjuradora, o limite cai no "à vontade"
  // histórico da tela (99) -- não em 0, que travaria a grade para quem
  // tem magia por talento/espécie/personalizada.
  const mPrep = html.match(/Preparadas:\s*\d+\/(\d+)/);
  assert.ok(mPrep, 'sanity: não achei "Preparadas: X/Y" no HTML');
  assert.equal(parseInt(mPrep[1], 10), 99,
    'sem tabela e sem subclasse conjuradora, o limite de preparadas deveria ser 99 ("à vontade")');
});

// ============================================================
// ORÁCULO 4 -- o portão do grimório: um Ladino 5/Mago 1 não pode preparar
// uma magia de círculo da lista de Mago que não esteja registrada no
// grimório dele.
//
// MEDIDO ao escrever este oráculo: para um Mago (`ehMago === true`), a
// grade do círculo (`magiasClasse`, grimorio.js) já é CONSTRUÍDA a partir
// só de `char.grimorio` -- "Magias de círculo do Mago só podem ser
// preparadas se já estiverem registradas" (comentário do próprio
// arquivo). Uma magia que NÃO está no grimório não aparece na grade para
// clicar -- ela nunca chega a `data-circ-check`. Isso significa que o
// bug de fundo NÃO é "um clique no item errado passa"; é "se `ehMago`
// for computado errado (ex.: voltar a ler `char.classe`, o espelho da
// classe inicial -- `false` para este Ladino5/Mago1), a grade deixa de
// ser filtrada pelo grimório e passa a mostrar a lista INTEIRA de Mago
// (centenas de magias), todas clicáveis sem checagem nenhuma". Este
// oráculo prende exatamente essa regressão: mede que a grade do 1º
// círculo mostra SÓ a magia registrada (não a lista inteira da classe), e
// confirma com o guarda real (`magiaMagoEstaNoGrimorio`, utils.js -- a
// mesma função que grimorio.js:298 chama) que uma magia não registrada
// seria recusada.
//
// "Armadura Arcana" (1º círculo, Abjuração) foi escolhida por ser uma
// magia comum do Mago sem marcador especial (nem Concentração, nem
// Ritual) -- dados/classes/magias_mago.json, grupo "1º Círculo".
// ============================================================
test('Oráculo 4: Ladino 5/Mago 1 não pode preparar magia de círculo fora do grimório', async () => {
  const MAGIA_REGISTRADA = 'Armadura Arcana';
  const MAGIA_FORA_DO_GRIMORIO = 'Detectar Magia'; // 1º círculo de Mago, NÃO registrada
  const p = await personagemMulticlasse([{ classe: 'Ladino', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Ladino'));
  sheetEstado.definirClassesData(mapaDadosDisco);
  p.grimorio = [{ nome: MAGIA_REGISTRADA, circulo: 1 }]; // só UMA magia registrada

  // Fonte independente: a lista INTEIRA de 1º círculo de Mago tem muito
  // mais de uma magia -- se a grade da aba mostrasse a lista inteira em
  // vez de só o grimório, este número (não 1) é o que apareceria.
  const totalCirculo1DoMago = (mapaDadosDisco.get('Mago').lista_magias['1º Círculo'] || []).length;
  assert.ok(totalCirculo1DoMago > 1,
    'sanity: a lista de 1º círculo de Mago precisa ter mais de uma magia para este oráculo discriminar');
  assert.ok((mapaDadosDisco.get('Mago').lista_magias['1º Círculo'] || []).some((m) => m.nome === MAGIA_FORA_DO_GRIMORIO),
    `sanity: "${MAGIA_FORA_DO_GRIMORIO}" precisa ser uma magia real de 1º círculo de Mago`);

  const { dom, restaurar } = instalarDomDeModalComCliques();
  let candidatos;
  try {
    await sheetGrimorio.mostrarBuscaMagia();

    const abas = dom.querySelectorAll('#tabs-gerenciar-magias .tab');
    const abaCirculo1 = abas.find((a) => a.dataset.tabMg === '1');
    assert.ok(abaCirculo1, 'sanity: não achei a aba de "1º Círculo" -- o grimório não carregou?');
    abaCirculo1.dispararClick(); // troca tabAtiva para '1' e re-renderiza #resultado-magias

    candidatos = dom.elementos['resultado-magias'].querySelectorAll('[data-circ-check]');
    assert.equal(candidatos.length, 1,
      `a grade do 1º círculo deveria mostrar só a UMA magia do grimório (${candidatos.length} ` +
      `encontradas) -- se mostrar as ${totalCirculo1DoMago} do 1º círculo inteiro de Mago, "ehMago" ` +
      `provavelmente voltou a ler char.classe (o espelho da classe inicial, 'Ladino') em vez da ` +
      `superfície ativa, e a grade deixou de ser filtrada pelo grimório`);
    assert.equal(candidatos[0].dataset.circCheck, MAGIA_REGISTRADA,
      'a única candidata da grade deveria ser a magia registrada no grimório');

    // O guarda de verdade que grimorio.js:298 chama no clique
    // (`ehMago && !magiaMagoEstaNoGrimorio(char, nome)`), com o MESMO
    // personagem: recusa a que não está no grimório, aceita a que está.
    assert.equal(utils.magiaMagoEstaNoGrimorio(p, MAGIA_FORA_DO_GRIMORIO), false,
      `magiaMagoEstaNoGrimorio deveria recusar "${MAGIA_FORA_DO_GRIMORIO}" -- ela não está no grimório`);
    assert.equal(utils.magiaMagoEstaNoGrimorio(p, MAGIA_REGISTRADA), true,
      `magiaMagoEstaNoGrimorio deveria aceitar "${MAGIA_REGISTRADA}" -- ela está no grimório`);

    // Clicar na única candidata (que ESTÁ no grimório) tem de preparar --
    // controle positivo: se o portão bloqueasse tudo incondicionalmente
    // (um `return` cedo demais, por exemplo), este clique também falharia.
    candidatos[0].dispararClick();
  } finally {
    restaurar();
  }

  assert.ok((p.magias_preparadas || []).some((m) => m.nome === MAGIA_REGISTRADA),
    `"${MAGIA_REGISTRADA}" está no grimório -- o clique deveria ter preparado a magia, mas ` +
    `magias_preparadas continua sem ela: ${JSON.stringify(p.magias_preparadas)}`);
});

// ============================================================
// ORÁCULO 4b -- correção de rodada da Tarefa 3 (revisão de
// "site/js/sheet/magias.js"): o portão IRMÃO deste arquivo
// (`[data-circ-check]`, dentro de `bindEventosTab`, linha ~344 antes da
// correção) tinha o MESMO defeito que o Important achou em
// sheet/magias.js -- `numAtual` é a contagem GLOBAL de
// `char.magias_preparadas` (todas as classes, sem campo que diga de quem
// é cada entrada) confrontada contra `maxPrep`, o limite de UMA
// superfície só (a ativa). Um Clérigo 5/Mago 1, com o CLÉRIGO como
// superfície ativa (ordem 0 -- o cenário do próprio exemplo do Important),
// via a aba "1º Círculo" travar mesmo sem ter chegado ao limite PRÓPRIO
// do Clérigo: as preparadas do Mago (outra classe, mesmo array) somavam
// no total e empurravam `numAtual` para além de `maxPrep` (o limite do
// Clérigo) antes da hora.
//
// A CORREÇÃO (fora do ramo `ehMago`, onde o proxy do grimório do Mago não
// se aplica): não bloquear quando há mais de uma superfície de
// conjuração -- mesma decisão já tomada para o alarme visual
// (contador-excedido, sheet/magias.js).
//
// Cenário: Clérigo nível 5 tem limite PRÓPRIO de 9 preparadas (medido em
// dados/classes/clerigo.json); o personagem só preparou 7 do Clérigo (bem
// abaixo do limite dele), mas o Mago (a segunda classe) já preparou 3 das
// suas -- 7 + 3 = 10 no total, JÁ acima dos 9 do Clérigo. Antes da
// correção, a 8ª magia do Clérigo (que ele tem direito de preparar) era
// recusada.
// ============================================================
test('Oráculo 4b: Clérigo 5/Mago 1 -- adicionar magia preparada do CLÉRIGO não trava por causa das preparadas do Mago', async () => {
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  const limiteClerigo = mapaDadosDisco.get('Clérigo').tabela_caracteristicas.find((r) => r['Nível'] === '5');
  assert.equal(parseInt(limiteClerigo['Magias Preparadas'], 10), 9,
    'sanity: a tabela do Clérigo mudou -- preparadas de nível 5 não é mais 9');

  // 7 "preparadas do Clérigo" (nomes fabricados, sem colidir com a lista
  // real -- não precisam existir no catálogo, só contar no limite) + 3
  // "preparadas do Mago" (idem). Nenhuma delas está em char.grimorio, o
  // que é irrelevante aqui: a superfície ativa é o Clérigo (`ehMago`
  // falso para este modal), então o portão nem olha o grimório.
  p.magias_preparadas = [
    ...Array.from({ length: 7 }, (_, i) => ({ nome: `Preparada de Clérigo ${i + 1}`, circulo: 1 })),
    ...Array.from({ length: 3 }, (_, i) => ({ nome: `Preparada de Mago ${i + 1}`, circulo: 1 })),
  ];
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo')); // espelho da classe inicial
  sheetEstado.definirClassesData(mapaDadosDisco);

  const { dom, restaurar } = instalarDomDeModalComCliques();
  let candidatos;
  try {
    await sheetGrimorio.mostrarBuscaMagia();

    const abas = dom.querySelectorAll('#tabs-gerenciar-magias .tab');
    const abaCirculo1 = abas.find((a) => a.dataset.tabMg === '1');
    assert.ok(abaCirculo1, 'sanity: não achei a aba de "1º Círculo" -- a lista do Clérigo não carregou?');
    abaCirculo1.dispararClick();

    candidatos = dom.elementos['resultado-magias'].querySelectorAll('[data-circ-check]');
    assert.ok(candidatos.length > 0,
      'sanity: nenhuma candidata de 1º círculo do Clérigo na grade -- a lista real não carregou');

    // Clicar na primeira candidata REAL do Clérigo (nenhuma das 10
    // preparadas fabricadas bate por nome com o catálogo real, então
    // nenhuma candidata já vem marcada como selecionada).
    candidatos[0].dispararClick();
  } finally {
    restaurar();
  }

  const nomeClicado = candidatos[0].dataset.circCheck;
  assert.ok((p.magias_preparadas || []).some((m) => m.nome === nomeClicado),
    `"${nomeClicado}" deveria ter sido adicionada -- o Clérigo tem só 7 preparadas PRÓPRIAS, bem abaixo ` +
    `do limite dele (9); se o portão ainda somar as 3 do Mago ao total (10 >= 9), o clique falha e ` +
    `magias_preparadas continua sem ela: ${JSON.stringify(p.magias_preparadas)}`);
});

// ============================================================
// ORÁCULO 4c -- correção de rodada 2 da Tarefa 3: TERCEIRA instância da
// mesma forma (achado do coordenador). O portão de truques
// (`[data-truque-check]`, dentro de `bindEventosTab`) comparava
// `numAtual` -- `char.magias_conhecidas` GLOBAL (todas as classes,
// filtrado só por círculo 0 e origem != 'especie') -- contra `maxTruq`, o
// limite de UMA superfície só (a ativa). Num Clérigo 5/Mago 1 os truques
// do Mago consumiam o orçamento do Clérigo (ou vice-versa), e "Adicionar"
// travava mesmo com o Clérigo bem abaixo do PRÓPRIO limite dele.
//
// SEM PROXY (diferente do portão de círculo, Oráculo 4/4b): truque não
// entra no grimório, então não há como isolar por classe com o dado
// disponível hoje. A correção é só a guarda -- não bloquear com mais de
// uma superfície de conjuração.
//
// Cenário: Clérigo nível 5 tem limite PRÓPRIO de 4 truques (medido em
// dados/classes/clerigo.json); o personagem já tem 2 truques do Clérigo
// (bem abaixo do limite dele) e 3 do Mago (outra classe, mesmo array) --
// 2 + 3 = 5, já acima dos 4 do Clérigo. Antes da correção, o 3º truque do
// Clérigo (que ele tem direito de adicionar) era recusado.
// ============================================================
test('Oráculo 4c: Clérigo 5/Mago 1 -- adicionar truque do CLÉRIGO não trava por causa dos truques do Mago', async () => {
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  const limiteClerigo = mapaDadosDisco.get('Clérigo').tabela_caracteristicas.find((r) => r['Nível'] === '5');
  assert.equal(parseInt(limiteClerigo['Truques'], 10), 4,
    'sanity: a tabela do Clérigo mudou -- truques de nível 5 não é mais 4');

  // 2 "truques do Clérigo" + 3 "truques do Mago" (nomes fabricados, sem
  // colidir com o catálogo real) -- nenhum deles é o candidato que o
  // clique vai adicionar.
  p.magias_conhecidas = [
    ...Array.from({ length: 2 }, (_, i) => ({ nome: `Truque de Clérigo ${i + 1}`, circulo: 0 })),
    ...Array.from({ length: 3 }, (_, i) => ({ nome: `Truque de Mago ${i + 1}`, circulo: 0 })),
  ];
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo')); // espelho da classe inicial
  sheetEstado.definirClassesData(mapaDadosDisco);

  const { dom, restaurar } = instalarDomDeModalComCliques();
  let candidatos;
  try {
    await sheetGrimorio.mostrarBuscaMagia();

    const abas = dom.querySelectorAll('#tabs-gerenciar-magias .tab');
    const abaTruques = abas.find((a) => a.dataset.tabMg === 'truques');
    assert.ok(abaTruques, 'sanity: não achei a aba de "Truques" -- a lista do Clérigo não carregou?');
    abaTruques.dispararClick();

    candidatos = dom.elementos['resultado-magias'].querySelectorAll('[data-truque-check]');
    assert.ok(candidatos.length > 0,
      'sanity: nenhum candidato de truque do Clérigo na grade -- a lista real não carregou');

    // Nenhum dos 5 truques fabricados bate por nome com o catálogo real do
    // Clérigo, então nenhum candidato já vem marcado como selecionado.
    candidatos[0].dispararClick();
  } finally {
    restaurar();
  }

  const nomeClicado = candidatos[0].dataset.truqueCheck;
  assert.ok((p.magias_conhecidas || []).some((m) => m.nome === nomeClicado && m.circulo === 0),
    `"${nomeClicado}" deveria ter sido adicionado -- o Clérigo tem só 2 truques PRÓPRIOS, bem abaixo do ` +
    `limite dele (4); se o portão ainda somar os 3 do Mago ao total (5 >= 4), o clique falha e ` +
    `magias_conhecidas continua sem ele: ${JSON.stringify(p.magias_conhecidas)}`);
});

// ============================================================
// ORÁCULO 4d -- correção de rodada 3 da Tarefa 3 (achado do coordenador,
// no mesmo lugar em que eu tinha LEVANTADO em vez de corrigido, na rodada
// 2). `cheioTruq`/`cheio` (opacidade/classe "bloqueada" da grade) e os
// contadores do topo do modal (`gm-contador-truques`/`gm-contador-
// preparadas`, no render inicial E no refresh de `atualizarContadores()`)
// tinham a MESMA forma dos três portões já corrigidos -- contagem GLOBAL
// contra limite de UMA superfície -- só que do lado da APARÊNCIA, não do
// bloqueio: os `data-truque-check`/`data-circ-check` continuavam
// clicáveis e o portão real (já corrigido) deixava passar, mas a grade
// PINTAVA a opção como indisponível. Isso é PIOR que bloquear de
// verdade: o jogador vê "não pode" e nem tenta -- a mesma violação que o
// contador honesto existe para evitar, por outro meio.
//
// Mesmo cenário do Oráculo 4c (Clérigo com 2 truques próprios, bem
// abaixo do limite de 4; Mago com 3, que empurram o total GLOBAL para 5).
// Este oráculo mede a APARÊNCIA (a classe CSS na grade e no contador do
// topo), não o clique -- o Oráculo 4c já prova que o clique funciona;
// este prova que a tela não MENTE sobre isso.
// ============================================================
test('Oráculo 4d: Clérigo 5/Mago 1 -- a grade de truques e o contador do topo não pintam "cheio" por causa do Mago', async () => {
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  p.magias_conhecidas = [
    ...Array.from({ length: 2 }, (_, i) => ({ nome: `Truque de Clérigo ${i + 1}`, circulo: 0 })),
    ...Array.from({ length: 3 }, (_, i) => ({ nome: `Truque de Mago ${i + 1}`, circulo: 0 })),
  ];
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  const { dom, restaurar } = instalarDomDeModalComCliques();
  let htmlModal, htmlGrade;
  try {
    await sheetGrimorio.mostrarBuscaMagia();
    htmlModal = dom.elementos['modal-corpo'].innerHTML;

    const abas = dom.querySelectorAll('#tabs-gerenciar-magias .tab');
    const abaTruques = abas.find((a) => a.dataset.tabMg === 'truques');
    assert.ok(abaTruques, 'sanity: não achei a aba de "Truques" -- a lista do Clérigo não carregou?');
    abaTruques.dispararClick();
    htmlGrade = dom.elementos['resultado-magias'].innerHTML;
  } finally {
    restaurar();
  }

  // O contador do topo: extrai a lista de classes do <span> de truques
  // pelo id, em vez de procurar a substring solta -- "contador-cheio" não
  // pode aparecer NESSE span específico.
  const mContador = htmlModal.match(/<span class="([^"]*)" id="gm-contador-truques">/);
  assert.ok(mContador, 'sanity: não achei o contador de truques (#gm-contador-truques) no HTML do modal');
  assert.ok(!mContador[1].includes('contador-cheio'),
    `o contador do topo não deveria marcar "contador-cheio" -- o Clérigo tem só 2 truques próprios, bem ` +
    `abaixo do limite dele (4); a classe encontrada foi "${mContador[1]}", e se ela incluir ` +
    '"contador-cheio" a tela está mentindo sobre o Mago (3 truques) esgotar o orçamento do Clérigo');

  // A grade de truques: NENHUMA opção pode vir marcada "bloqueada" --
  // sanity de que a grade carregou (>0 candidatos reais) antes de provar
  // a ausência.
  assert.match(htmlGrade, /data-toggle-truque=/,
    'sanity: a grade de truques do Clérigo não carregou nenhuma opção');
  // `bloqueada` (não "opcao-card bloqueada" com um espaço fixo): o
  // template intercala `${sel ? 'selecionada' : ''} ${bloqueado ? ...}`, e
  // com `sel` falso (nosso caso -- nenhum candidato real bate com os
  // nomes fabricados) o HTML sai com DOIS espaços entre "opcao-card" e
  // "bloqueada" (`class="opcao-card  bloqueada"`), não um -- medido ao
  // escrever este oráculo: a asserção com um espaço só passava mesmo com
  // a mutação (achado ao provar por mutação, não vazio à toa).
  assert.doesNotMatch(htmlGrade, /\bbloqueada\b/,
    'nenhuma opção da grade deveria vir marcada "bloqueada" -- se vier, a tela pinta como indisponível ' +
    'uma ação que o portão real (já corrigido, Oráculo 4c) deixaria o jogador completar');
});

// ============================================================
// ORÁCULO 4e (onda de correção da revisão final, achado Important 2) -- o
// modal repetia os MESMOS números da ficha (contagem do personagem
// inteiro contra o limite de UMA classe) sem o aviso que a ficha dá, e
// nenhum elemento dele nomeava a classe ativa: o título é sempre
// "Gerenciar Magias". Como o seletor de superfície mora na SEÇÃO Magias
// (decisão registrada -- ver o comentário de `tabs-superficie-magia` em
// sheet/magias.js), quem abre o modal pelo "+ Magia" sem ter olhado a aba
// não tinha como saber de que classe era o limite mostrado.
//
// O par de testes é deliberado: o 4e prova que o aviso APARECE com duas
// superfícies, o 4f prova que ele NÃO aparece com uma -- a restrição dura
// deste sub-projeto (classe única, a maioria dos jogadores, vê a tela
// idêntica à de antes).
// ============================================================
test('Oráculo 4e: Clérigo 5/Mago 1 -- o modal nomeia a classe ativa e repete o aviso do contador honesto', async () => {
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  assert.equal(contextoClasse.superficiesDaFicha(p).length, 2,
    'sanity: Clérigo 5/Mago 1 deveria ter duas superfícies de conjuração');

  const { html } = await chamarCapturandoModalEErros(() => sheetGrimorio.mostrarBuscaMagia());

  // Ancorado no MARCADOR COMPLETO ("Clérigo 5" dentro do <strong> do
  // rótulo), não na palavra "Clérigo" solta: o HTML do modal lista magias
  // e origens que também podem citar a classe, e uma asserção sobre a
  // palavra solta passaria por motivo incidental.
  assert.match(html, /Classe selecionada: <strong>Clérigo 5<\/strong>/,
    'o modal precisa NOMEAR a classe ativa (a superfície do seletor da ficha) -- sem isso o jogador que ' +
    'abre pelo "+ Magia" não tem como saber de que classe é o limite mostrado, porque o título é sempre ' +
    '"Gerenciar Magias".');
  assert.match(html, /contam o personagem inteiro/,
    'com duas superfícies, o modal precisa repetir o aviso do contador honesto que a seção Magias já dá -- ' +
    'os quatro números dele são a contagem do personagem INTEIRO contra o limite de UMA classe.');
});

test('Oráculo 4f: Clérigo 5 puro (uma superfície) -- o modal continua idêntico, sem rótulo de classe e sem aviso', async () => {
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }]);
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  assert.equal(contextoClasse.superficiesDaFicha(p).length, 1,
    'sanity: Clérigo 5 puro deveria ter exatamente uma superfície de conjuração');

  const { html } = await chamarCapturandoModalEErros(() => sheetGrimorio.mostrarBuscaMagia());

  assert.doesNotMatch(html, /Classe selecionada:/,
    'com UMA superfície não há classe a desambiguar -- o rótulo não pode aparecer, ou a tela de classe ' +
    'única deixa de ser idêntica à de antes deste sub-projeto.');
  assert.doesNotMatch(html, /contam o personagem inteiro/,
    'com UMA superfície não há mistura de classes a declarar: a contagem global É a contagem daquela ' +
    'classe. O aviso aqui seria ruído.');
});

// ============================================================
// ORÁCULO 4g (onda de correção da revisão final, achado Important 1) -- o
// modal contava truques por REGRA PRÓPRIA e recusava, em personagem de
// CLASSE ÚNICA, um truque a que o jogador tem direito.
//
// O filtro literal do modal (`m.circulo === 0 && m.origem !== 'especie'`)
// excluía UMA origem; a seção Magias da ficha usa `truqueContaNoLimite`
// (regras-origens-magia.js), que dispensa as dez de
// ORIGENS_TRUQUE_NAO_TROCAVEL. Num Mago 5 de classe única com o talento
// Iniciado em Magia (3 truques da tabela + 1 do talento, limite 4 em
// dados/classes/mago.json), a ficha mostrava "Truques 3 / 4" e o modal
// "Truques: 4/4", com a grade bloqueada e o clique recusado.
//
// ESTE ORÁCULO NÃO COMPARA CONTRA UM NÚMERO ESCRITO À MÃO -- ele confronta
// as DUAS TELAS ENTRE SI. É a asserção certa para a tese do sub-projeto
// ("as duas telas não podem discordar"): se alguém mudar a regra de
// contagem de um dos lados, o oráculo cai, qualquer que seja o número novo.
// O par contra a tabela real do Mago fica como sanity, para o teste não
// passar com as duas telas igualmente ERRADAS.
//
// CLASSE ÚNICA de propósito: é onde o defeito morde (com mais de uma
// superfície a guarda `umaSuperficieSo` já desliga o bloqueio) e é a
// população majoritária do app.
// ============================================================
test('Oráculo 4g: Mago 5 puro com truque de talento -- modal e ficha mostram o MESMO número de truques, e o quarto truque de classe não é recusado', async () => {
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  // Três truques escolhidos da tabela da classe (sem `origem`: é assim que
  // a escolha normal do jogador é gravada) + UM concedido pelo talento
  // Iniciado em Magia. Nomes fabricados de propósito: nenhum bate com a
  // lista real do Mago, então a grade do modal fica inteira de candidatos
  // NÃO selecionados e o clique abaixo é sempre uma ADIÇÃO.
  p.magias_conhecidas = [
    ...Array.from({ length: 3 }, (_, i) => ({ nome: `Truque de Classe ${i + 1}`, circulo: 0 })),
    { nome: 'Truque do Talento', circulo: 0, origem: 'iniciado_em_magia' },
  ];
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Mago'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  assert.equal(contextoClasse.superficiesDaFicha(p).length, 1,
    'sanity: Mago 5 puro deveria ter exatamente uma superfície de conjuração -- é o caso em que o ' +
    'bloqueio do modal fica ATIVO, e portanto o caso em que o defeito morde');

  // --- O número que cada tela mostra ---
  const htmlFicha = sheetMagias.renderSecaoMagias();
  const mFicha = htmlFicha.match(
    /<span class="contador-label">Truques<\/span>\s*<span class="contador-valor">(\d+)\s*\/\s*(\d+)<\/span>/);
  assert.ok(mFicha, 'sanity: não achei o contador "Truques X / Y" no HTML de renderSecaoMagias()');

  const { html: htmlModal } = await chamarCapturandoModalEErros(() => sheetGrimorio.mostrarBuscaMagia());
  const mModal = htmlModal.match(/Truques:\s*(\d+)\/(\d+)/);
  assert.ok(mModal, 'sanity: não achei "Truques: X/Y" no HTML de mostrarBuscaMagia()');

  assert.equal(mModal[1], mFicha[1],
    `o modal e a ficha têm de mostrar o MESMO número de truques gastos. Ficha: ${mFicha[1]}, ` +
    `modal: ${mModal[1]}. Se divergirem, uma das duas telas voltou a contar por regra própria -- ` +
    'a divergência que este sub-projeto inteiro existe para eliminar.');
  assert.equal(mModal[2], mFicha[2],
    `o modal e a ficha têm de mostrar o MESMO limite. Ficha: ${mFicha[2]}, modal: ${mModal[2]}.`);

  // Sanity contra a tabela REAL (dados/classes/mago.json), para as duas
  // telas não passarem no teste estando igualmente erradas.
  const linhaNivel5 = mapaDadosDisco.get('Mago').tabela_caracteristicas.find((r) => r['Nível'] === '5');
  assert.equal(parseInt(linhaNivel5['Truques'], 10), 4,
    'sanity: a tabela do Mago mudou -- truques de nível 5 não é mais 4');
  assert.equal(parseInt(mModal[1], 10), 3,
    'os três truques ESCOLHIDOS da tabela gastam o orçamento; o do talento Iniciado em Magia não ' +
    '(ORIGENS_TRUQUE_NAO_TROCAVEL, regras-origens-magia.js). Se vier 4, o modal ainda cobra do ' +
    'jogador um truque que o livro concede de graça.');
  assert.equal(parseInt(mModal[2], 10), 4, 'o limite deveria ser o do Mago nível 5');

  // O contador do topo não pode vir pintado de "cheio" com 3 de 4.
  const mClasse = htmlModal.match(/<span class="([^"]*)" id="gm-contador-truques">/);
  assert.ok(mClasse, 'sanity: não achei o contador de truques (#gm-contador-truques) no HTML do modal');
  assert.ok(!mClasse[1].includes('contador-cheio'),
    `com 3 truques de classe e limite 4 o contador não pode vir "cheio" -- classe encontrada: "${mClasse[1]}"`);

  // --- O portão: clicar no quarto truque DE CLASSE tem de adicionar ---
  const antes = p.magias_conhecidas.length;
  const { dom, restaurar } = instalarDomDeModalComCliques();
  try {
    await sheetGrimorio.mostrarBuscaMagia();
    const abas = dom.querySelectorAll('#tabs-gerenciar-magias .tab');
    const abaTruques = abas.find((a) => a.dataset.tabMg === 'truques');
    assert.ok(abaTruques, 'sanity: não achei a aba de "Truques" -- a lista do Mago não carregou?');
    abaTruques.dispararClick();

    const htmlGrade = dom.elementos['resultado-magias'].innerHTML;
    assert.doesNotMatch(htmlGrade, /\bbloqueada\b/,
      'com 3 truques de classe e limite 4, nenhuma opção da grade pode vir marcada "bloqueada"');

    const checks = dom.elementos['resultado-magias'].querySelectorAll('[data-truque-check]');
    assert.ok(checks.length > 0, 'sanity: a grade de truques do Mago não carregou nenhum candidato');
    checks[0].dispararClick();
  } finally {
    restaurar();
  }

  assert.equal(p.magias_conhecidas.length, antes + 1,
    'o quarto truque DE CLASSE tem de ser aceito: são 3 gastos contra o limite de 4. Se a contagem ' +
    'não mudar, o portão recusou com "Limite de 4 truques atingido" -- impedindo o jogador de ' +
    'escolher um truque a que tem direito, que é o defeito do achado Important 1.');
});

// ------------------------------------------------------------
// DOM mínimo do Oráculo 5: mostrarFormMagiaCustom() (o formulário de
// "Magia Personalizada") lê uma dezena de campos por
// `document.getElementById`. Aqui o teste está criando uma magia NOVA
// (indiceEdicao = null, `magiaExistente` fica null dentro da função), o
// que pula todo o ramo de EDIÇÃO (o único que chama
// `select.dispatchEvent(new Event('change'))`) -- por isso os elementos
// fake abaixo só precisam de `.value`/`.checked`/`.style` graváveis e
// `addEventListener` capturando o handler, sem `dispatchEvent` nenhum.
// Os valores preenchidos são o mínimo que passa pela validação do
// formulário (nome, escola, tempo de conjuração válido, alcance, ao
// menos um componente, duração, círculo > 0 -- círculo > 0 é o que ativa
// o bloco do grimório sob teste).
// ------------------------------------------------------------
/**
 * Stub mínimo de container DOM para renderFichaCompleta() (sheet/ficha.js),
 * que mostrarFormMagiaCustom() chama ao salvar. O render real escreve HTML
 * em containerRef.innerHTML e depois só lê document/containerRef por
 * optional chaining ou itera array vazio -- mesmo padrão de
 * multiclasse-contexto.test.mjs (criarContainerStub) e
 * multiclasse-combate.test.mjs.
 */
function criarContainerStubFicha() {
  let htmlCapturado = '';
  return {
    get innerHTML() { return htmlCapturado; },
    set innerHTML(v) { htmlCapturado = v; },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
  };
}

function criarDomDeFormMagiaCustom() {
  const campo = (valorInicial = '') => {
    const el = { value: valorInicial, checked: false, style: {}, _listeners: [] };
    el.addEventListener = (_tipo, fn) => el._listeners.push(fn);
    el.click = () => el._listeners.forEach((fn) => fn({}));
    return el;
  };
  const elementos = {
    'modal-overlay': { style: { display: 'none' } },
    'modal-titulo': campo(), 'modal-corpo': campo(), 'modal-acoes': campo(),
    'modal-container': { scrollTop: 0 },
    'toast-container': { appendChild() {} },
    'mc-nome': campo(), 'mc-circulo': campo('1'),
    'mc-escola': campo('Abjuração'), 'mc-escola-personalizada': campo(),
    'mc-tempo': campo('1 ação'), 'mc-tempo-personalizado': campo(), 'mc-gatilho-reacao': campo(),
    'mc-alcance': campo('9 metros'),
    'mc-comp-v': campo(), 'mc-comp-s': campo(), 'mc-comp-m': campo(), 'mc-comp-outro': campo(),
    'mc-duracao': campo('Instantânea'), 'mc-duracao-personalizada': campo(),
    'mc-duracao-quantidade': campo(), 'mc-duracao-unidade': campo(), 'mc-duracao-texto': campo(),
    'mc-ritual': campo(), 'mc-desc': campo(), 'mc-dano': campo(),
    'btn-salvar-mc': campo(),
  };
  elementos['mc-comp-v'].checked = true; // ao menos um componente marcado (V)
  return {
    elementos,
    getElementById: (id) => elementos[id] || null,
    querySelectorAll: () => [],
  };
}

// ============================================================
// ORÁCULO 5 -- rodada de correção 1/5: `mostrarFormMagiaCustom`
// (grimorio.js) decidia se registrava a magia de círculo criada no
// grimório por `char.classe === 'Mago'` (o espelho da classe INICIAL),
// UMA linha acima de `magiaMagoEstaNoGrimorio(char, ...)` -- convertida
// para `temClasse` nesta mesma tarefa. Duas linhas vizinhas respondendo
// "este personagem é Mago?" de formas diferentes: para um Ladino 5/Mago 1,
// `char.classe === 'Mago'` é `false`, então o bloco inteiro era pulado e a
// magia de círculo criada NUNCA entrava em `char.grimorio`. Como
// `mostrarBuscaMagia` monta a grade de círculos só a partir do grimório
// para quem `ehMago` (ver Oráculo 4), a magia criada não aparecia lá --
// beco sem saída, alcançável só depois desta tarefa (antes o modal inteiro
// estava quebrado para esse personagem).
//
// A correção é `temClasse(char, 'Mago')` -- a mesma pergunta que a linha
// vizinha já faz. Note que aqui é `temClasse`, não `superficieAtiva()?.
// usaGrimorio`: o grimório é propriedade do PERSONAGEM (ele "tem" um
// grimório porque tem níveis de Mago), não da superfície que a tela está
// mostrando no momento -- a mesma distinção que fez `magiaMagoEstaNoGrimorio`
// usar `temClasse` e não `superficieAtiva()`.
// ============================================================
test('Oráculo 5: Ladino 5/Mago 1 -- magia de círculo criada em "Magia Personalizada" entra no grimório', async () => {
  const NOME_MAGIA = 'Lâmina Improvisada de Teste';
  const p = await personagemMulticlasse([{ classe: 'Ladino', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  sheetEstado.definirChar(p);
  sheetEstado.definirContainer(criarContainerStubFicha()); // renderFichaCompleta() roda ao salvar
  sheetEstado.definirClasseData(mapaDadosDisco.get('Ladino'));
  sheetEstado.definirClassesData(mapaDadosDisco);
  p.magias_customizadas = [];
  p.grimorio = [];

  const dom = criarDomDeFormMagiaCustom();
  const originalGetElementById = document.getElementById;
  const originalQuerySelectorAll = document.querySelectorAll;
  const originalCreateElement = document.createElement;
  document.getElementById = dom.getElementById;
  document.querySelectorAll = dom.querySelectorAll;
  // Mesmo achado do Oráculo 4: o "salvar" real dispara toast(), que agenda
  // `el.remove()` 3s depois -- o stub padrão do harness não tem `.remove()`.
  document.createElement = () => ({
    style: {}, classList: { add() {}, remove() {} },
    appendChild() {}, setAttribute() {}, remove() {},
  });
  try {
    await sheetGrimorio.mostrarFormMagiaCustom(); // indiceEdicao=null -> cria magia nova
    dom.elementos['mc-nome'].value = NOME_MAGIA;
    dom.elementos['btn-salvar-mc'].click(); // dispara o handler real de salvar
  } finally {
    document.getElementById = originalGetElementById;
    document.querySelectorAll = originalQuerySelectorAll;
    document.createElement = originalCreateElement;
  }

  assert.ok((p.magias_customizadas || []).some((m) => m.nome === NOME_MAGIA),
    `"${NOME_MAGIA}" deveria ter sido salva em magias_customizadas -- validação do formulário recusou? ` +
    `magias_customizadas: ${JSON.stringify(p.magias_customizadas)}`);
  assert.ok((p.grimorio || []).some((m) => m?.nome === NOME_MAGIA),
    `"${NOME_MAGIA}" (círculo 1, personagem com Mago) deveria ter entrado em char.grimorio -- se não ` +
    `entrou, o bloco "if (temClasse(char, 'Mago') && ...)" não disparou para este personagem ` +
    `multiclasse. magias_customizadas: ${JSON.stringify(p.magias_customizadas)}, grimorio: ` +
    `${JSON.stringify(p.grimorio)}`);
});

// ============================================================
// ORÁCULO 6 -- rodada de revisão 1/5 da Tarefa 4 (achado do coordenador,
// Important "o orçamento errado"): `abrirPreenchimentoSlotMagia`
// (grimorio.js) resolve a lista de magias pela SUPERFÍCIE ATIVA -- dirigida
// pelo seletor de classe (Tarefa 4) -- mas a vaga livre que ela preenche
// (`char._slots_magia_livre`/`_slots_truque_livre`) é calculada por
// migrarSlotsMagiaLivre (sheet/migracoes.js) SEMPRE contra a PRIMEIRA
// superfície (deliberado, pré-render -- ver o comentário dela). Antes do
// seletor existir, superficieAtiva() sempre ERA essa primeira superfície,
// então as duas nunca podiam divergir.
//
// Com o seletor, um Bardo (inicial)/Feiticeiro (segunda) -- as duas de
// magias "conhecidas" -- pode trocar a aba para o Feiticeiro e preencheria
// a vaga que o DÉFICIT DO BARDO abriu com uma magia de FEITICEIRO:
// gravação contra o orçamento da classe ERRADA.
//
// A CORREÇÃO: uma trava no TOPO de abrirPreenchimentoSlotMagia -- só a
// PRIMEIRA superfície (a mesma para a qual migrarSlotsMagiaLivre calculou
// a vaga) pode preenchê-la; qualquer outra recusa com um toast, ANTES de
// montar a lista de candidatas (nunca chega a pedir a lista de magias nem
// a abrir o picker).
//
// Os dois oráculos abaixo são o PAR completo: 6a prova que a trava NÃO
// bloqueia o caminho correto (a primeira superfície continua preenchendo
// a vaga normalmente -- sem este controle positivo, uma trava incondicional
// também passaria); 6b prova que ela BLOQUEIA o caminho errado, com nada
// escrito no personagem.
//
// PROVA POR MUTAÇÃO (verificado ao escrever este oráculo, não é código
// automatizado): comentando a trava em grimorio.js, o Oráculo 6b falha --
// a asserção do título do modal ("SENTINELA" esperado, "Escolher Magia
// Conhecida" recebido) e a da lista de candidatas (que passaria a trazer
// "Mãos Flamejantes", do Feiticeiro) acusam a regressão. Restaurada a
// trava, os dois oráculos voltam a passar.
//
// "Curar Ferimentos" (1º círculo) é exclusiva do BARDO entre as listas de
// Bardo e Feiticeiro (dados/classes/magias_bardo.json vs.
// magias_feiticeiro.json); "Mãos Flamejantes" é exclusiva do FEITICEIRO --
// a mesma técnica de discriminação por magia exclusiva dos Oráculos 1-5
// (multiclasse-seletor-magias.spec.mjs usa o mesmo par "Raio de
// Gelo"/"Chama Sagrada" para Mago/Clérigo).
// ============================================================

/**
 * DOM mínimo do Oráculo 6: só os elementos que
 * abrirPreenchimentoSlotMagia() toca -- o modal do PICKER de vaga livre
 * (#resultado-preencher-slot, #busca-preencher-slot,
 * #preencher-slot-nome, #btn-confirmar-preencher) e #toast-container (a
 * trava recusa com um toast, sem montar o picker). Elemento PRÓPRIO, não
 * reaproveitado de criarDomDeModalComCliques (Oráculos 1-4d, o modal
 * "Gerenciar Magias") nem de criarDomDeFormMagiaCustom (Oráculo 5, o
 * formulário) -- estender qualquer um deles arriscaria os oráculos já
 * revisados por um ganho que só este teste usa.
 */
function criarDomDePreenchimentoSlot() {
  const elementoFalso = () => ({
    style: {}, innerHTML: '', textContent: '', value: '', className: '',
    querySelectorAll: () => [], addEventListener: () => {},
    classList: { add() {}, remove() {} },
  });
  const toasts = [];
  const elementos = {
    'modal-overlay': { style: { display: 'none' } },
    'modal-titulo': elementoFalso(),
    'modal-corpo': elementoFalso(),
    'modal-acoes': elementoFalso(),
    'modal-container': { scrollTop: 0 },
    'resultado-preencher-slot': elementoFalso(),
    'busca-preencher-slot': elementoFalso(),
    'preencher-slot-nome': elementoFalso(),
    'btn-confirmar-preencher': elementoFalso(),
    // toast() (utils.js) cria um <div>, grava o texto nele e chama
    // container.appendChild(el) -- capturar aqui é mais simples e mais
    // fiel do que espionar a função toast() em si (que os módulos já
    // importaram por binding direto, não reatribuível de fora).
    'toast-container': { appendChild: (el) => toasts.push(el.textContent) },
  };
  return { elementos, toasts, getElementById: (id) => elementos[id] || null, querySelectorAll: () => [] };
}

/** Instala o DOM acima, roda `fnAssincrona`, restaura document.* mesmo se ela lançar, e devolve o DOM para inspeção. */
async function chamarComDomDePreenchimentoSlot(fnAssincrona) {
  const dom = criarDomDePreenchimentoSlot();
  const originalGetElementById = document.getElementById;
  const originalQuerySelectorAll = document.querySelectorAll;
  const originalCreateElement = document.createElement;
  document.getElementById = dom.getElementById;
  document.querySelectorAll = dom.querySelectorAll;
  // Mesmo achado dos Oráculos 4/5: toast() agenda `el.remove()` 3s depois,
  // e o stub padrão do harness não tem `.remove()`.
  document.createElement = () => ({
    style: {}, classList: { add() {}, remove() {} }, textContent: '',
    appendChild() {}, setAttribute() {}, remove() {},
  });
  try {
    await fnAssincrona();
  } finally {
    document.getElementById = originalGetElementById;
    document.querySelectorAll = originalQuerySelectorAll;
    document.createElement = originalCreateElement;
  }
  return dom;
}

test('Oráculo 6a (controle positivo): Bardo 5/Feiticeiro 3, PRIMEIRA superfície ativa -- o picker abre normalmente com a lista do Bardo', async () => {
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([{ classe: 'Bardo', nivel: 5 }, { classe: 'Feiticeiro', nivel: 3 }]);
  p._slots_magia_livre = 1; // deficit calculado (por migrarSlotsMagiaLivre) contra o BARDO, a 1ª superfície
  p.magias_preparadas = [];
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Bardo'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  assert.equal(contextoClasse.superficiesDaFicha(p)[0]?.classe, 'Bardo',
    'sanity: a primeira superfície deste personagem precisa ser o Bardo');

  const dom = await chamarComDomDePreenchimentoSlot(() => sheetGrimorio.abrirPreenchimentoSlotMagia('magia'));

  assert.deepEqual(dom.toasts, [],
    `com a superfície correta (Bardo) ativa, nenhum toast de recusa deveria disparar -- capturados: ${JSON.stringify(dom.toasts)}`);
  assert.equal(dom.elementos['modal-titulo'].textContent, 'Escolher Magia Conhecida',
    'com a PRIMEIRA superfície (Bardo, a mesma para a qual a vaga foi calculada) ativa, o picker deveria abrir normalmente');
  assert.match(dom.elementos['resultado-preencher-slot'].innerHTML, /Curar Ferimentos/,
    'a lista de candidatas deveria vir do BARDO -- "Curar Ferimentos" (1º círculo) é exclusiva dele entre Bardo e Feiticeiro');
  assert.doesNotMatch(dom.elementos['resultado-preencher-slot'].innerHTML, /Mãos Flamejantes/,
    'a lista não deveria trazer "Mãos Flamejantes" (exclusiva do Feiticeiro) -- a superfície ativa é o Bardo, não o Feiticeiro');

  contextoClasse.resetarSuperficieSelecionada();
});

test('Oráculo 6b (a trava): Bardo 5/Feiticeiro 3, superfície TROCADA para o Feiticeiro -- a vaga do Bardo é recusada, não preenchida com magia de outra classe', async () => {
  contextoClasse.resetarSuperficieSelecionada();
  const p = await personagemMulticlasse([{ classe: 'Bardo', nivel: 5 }, { classe: 'Feiticeiro', nivel: 3 }]);
  p._slots_magia_livre = 1; // mesmo deficit do Oráculo 6a -- calculado contra o BARDO
  p.magias_preparadas = [];
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapaDadosDisco.get('Bardo'));
  sheetEstado.definirClassesData(mapaDadosDisco);

  // O jogador troca a aba do seletor para o FEITICEIRO -- a vaga continua
  // sendo do Bardo (migrarSlotsMagiaLivre já rodou, na abertura da ficha,
  // antes de qualquer clique no seletor).
  contextoClasse.definirSuperficieSelecionada('Feiticeiro');

  const dom = await chamarComDomDePreenchimentoSlot(() => sheetGrimorio.abrirPreenchimentoSlotMagia('magia'));

  assert.equal(dom.toasts.length, 1,
    `a trava deveria disparar UM toast de recusa -- capturados: ${JSON.stringify(dom.toasts)}`);
  assert.match(dom.toasts[0], /Bardo/,
    `o toast deveria orientar o jogador a voltar para a aba do Bardo (a classe para a qual a vaga foi calculada) -- texto: "${dom.toasts[0]}"`);

  // O picker NUNCA deveria ter sido montado: nem o título do modal nem a
  // lista de candidatas podem ter sido tocados.
  assert.equal(dom.elementos['modal-titulo'].textContent, '',
    'a trava deveria recusar ANTES de abrirModal() -- o título do modal não pode ter sido escrito');
  assert.equal(dom.elementos['resultado-preencher-slot'].innerHTML, '',
    'a trava deveria recusar ANTES de montar a lista de candidatas -- nenhuma magia (nem do ' +
    'Bardo, nem do Feiticeiro) deveria ter sido renderizada');

  // A PROVA CENTRAL: nada foi escrito no personagem. Se a trava não
  // existisse, um clique subsequente na candidata do Feiticeiro
  // debitaria a vaga do Bardo com uma magia de outra classe -- este
  // oráculo já barra um passo antes disso, no próprio ato de abrir.
  assert.equal(p._slots_magia_livre, 1,
    `a vaga do Bardo não pode ter sido consumida -- _slots_magia_livre deveria continuar 1, veio ${p._slots_magia_livre}`);
  assert.deepEqual(p.magias_preparadas, [],
    `nenhuma magia deveria ter sido gravada em magias_preparadas -- veio ${JSON.stringify(p.magias_preparadas)}`);

  contextoClasse.resetarSuperficieSelecionada();
});
