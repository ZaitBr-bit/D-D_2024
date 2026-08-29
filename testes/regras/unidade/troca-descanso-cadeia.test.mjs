// ============================================================
// Oráculos da CADEIA de modais do Descanso Longo (Tarefa 3 do sub-projeto
// 2026-08-29-troca-por-classe-descanso).
//
// T1 (regras-preparo-magias.js, trocasDoDescansoLongo) e T2 (grimorio.js,
// opcoes.classe em mostrarTrocaMagiaConhecida/mostrarTrocaTruque) já têm
// oráculo próprio, respectivamente em troca-descanso-por-classe.test.mjs e
// troca-modal-por-classe.test.mjs. Este arquivo prende a peça que FALTAVA:
// `site/js/sheet/hp-descanso.js`, o handler de clique de #btn-descanso-longo
// que MONTA a cadeia (PASSOS/iniciarTrocasAPartirDe) a partir das duas
// peças acima -- decide QUANTOS passos de magia existem, EM QUE ORDEM, e
// se a cadeia inteira (magia(s) -> truque) é alcançada a partir de um único
// clique em "Trocar Magias".
//
// PADRÃO DE DOM FALSO: `magia-classe-leitores.test.mjs` (elementoFalsoGrimorio/
// instalarDocumentoFalsoGrimorio, linhas 541-643) tem o padrão que roda
// modais de ponta a ponta sobre um DOM falso; `troca-modal-por-classe.test.mjs`
// o reaproveitou. Este arquivo faz o mesmo -- funções locais, não
// exportadas pelos outros dois arquivos --, com UMA diferença: os testes
// abaixo clicam em MAIS de um botão dentro do MESMO `document` falso (a
// cadeia inteira), e `getElementById` cacheia por id para sempre -- então
// `addEventListener('click', ...)` ACUMULA um handler novo a cada vez que
// um modal reabre no mesmo id (ex.: "btn-pular-troca-conhecida" existe em
// TODO passo de magia). `clicar()`, abaixo, sempre dispara o ÚLTIMO
// handler registrado nesse id -- o do modal que está aberto agora --, não
// o primeiro (que seria o de um passo já fechado).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, lerClassesDados } from './harness.mjs';

// `setTimeout` REAL, capturado ANTES de qualquer `instalarDocumentoFalso()`
// rodar -- ela substitui `globalThis.setTimeout` por uma versão que dá
// `unref()` no timer (para os `setTimeout` de 3s de `toast()`, nunca
// aguardados por ninguém, não travarem a SAÍDA do processo). `esperar()`,
// abaixo, PRECISA que o teste FIQUE esperando o timer disparar -- se ela
// usasse `globalThis.setTimeout` (o já sobrescrito), o timer viria
// `unref()`ado e o event loop podia se considerar "vazio" e encerrar antes
// do timer disparar, deixando a promise de `esperar()` pendente para
// sempre ("Promise resolution is still pending but the event loop has
// already resolved", erro medido ao escrever este arquivo).
const setTimeoutReal = globalThis.setTimeout;

/**
 * Elemento de DOM falso: o mínimo que abrirModal/toast, os `addEventListener`
 * de setupEventosDescanso e `montarSeletor` (site/js/ui-opcoes.js, usado por
 * mostrarTrocaMagiaConhecida/mostrarTrocaTruque) tocam. `querySelector`
 * devolve um filho fake CACHEADO por seletor -- identidade estável entre
 * chamadas, para `montarSeletor` escrever no MESMO objeto que o teste depois
 * lê -- em vez de `null`. Mesmo padrão de `elementoFalsoGrimorio`
 * (magia-classe-leitores.test.mjs:548, reaproveitado por
 * troca-modal-por-classe.test.mjs).
 * @param {string} id
 * @returns {object}
 */
function elementoFalso(id) {
  const filhos = new Map();
  const el = {
    id, style: {}, innerHTML: '', textContent: '', scrollTop: 0,
    className: '', dataset: {}, handlers: {}, value: '',
    addEventListener(evento, fn) { (el.handlers[evento] ||= []).push(fn); },
    // `ligarClique` (site/js/ui-opcoes.js:47-52) remove o listener ANTERIOR
    // antes de registrar um novo no MESMO elemento -- e nosso `document`
    // falso cacheia por id/seletor para sempre (o mesmo objeto atravessa
    // vários passos da cadeia), então essa remoção acontece de verdade a
    // cada novo passo de magia. Sem esta função, `montarSeletor` lança ao
    // reabrir pela SEGUNDA vez sobre o mesmo id -- exatamente o cenário de
    // dois-ou-mais passos de magia que os Oráculos 2, 3 e 5 exercitam.
    removeEventListener(evento, fn) {
      const arr = el.handlers[evento];
      if (!arr) return;
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    removeAttribute() {}, setAttribute() {}, appendChild() {}, remove() {},
    closest: () => null,
    querySelector(sel) {
      if (!filhos.has(sel)) filhos.set(sel, elementoFalso(sel));
      return filhos.get(sel);
    },
    querySelectorAll: () => [],
    classList: { add() {}, remove() {}, toggle() {} },
  };
  return el;
}

/**
 * Instala um `document` falso com `getElementById` cacheado por id.
 * `restaurar()` devolve o `document`/`setTimeout` originais -- chamar
 * SEMPRE, mesmo em caminho de erro (try/finally no chamador).
 * @returns {{registro: Map<string,object>, restaurar: () => void}}
 */
function instalarDocumentoFalso() {
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
  return {
    registro,
    restaurar() {
      globalThis.document = docOriginal;
      globalThis.setTimeout = setTimeoutOriginal;
    },
  };
}

/**
 * Prepara sheet/estado.js com dados REAIS de disco -- o mínimo que
 * setupEventosDescanso()/mostrarTrocaMagiaConhecida/mostrarTrocaTruque
 * precisam para rodar sem lançar. Zera a superfície selecionada, para a
 * ativa cair sempre na PRIMEIRA classe do roteiro -- mesmo padrão de
 * `prepararEstadoGrimorio` (troca-modal-por-classe.test.mjs).
 * @param {object} p Personagem já montado (personagemMulticlasse).
 */
async function prepararEstado(p) {
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

/**
 * Dispara o Descanso Longo DE VERDADE (clique em #btn-descanso-longo) e
 * devolve `{registro, restaurar}` para o teste continuar clicando pela
 * cadeia. `restaurar()` tem de ser chamado ao final (try/finally).
 * @param {object} p Personagem já montado.
 * @returns {Promise<{registro: Map<string,object>, restaurar: () => void}>}
 */
async function iniciarDescansoLongo(p) {
  const { sheetHpDescanso } = await modulosApp();
  await prepararEstado(p);
  const { registro, restaurar } = instalarDocumentoFalso();
  sheetHpDescanso.setupEventosDescanso();
  const cliques = registro.get('btn-descanso-longo')?.handlers?.click || [];
  assert.equal(cliques.length, 1,
    'setupEventosDescanso tem de registrar UM clique em #btn-descanso-longo');
  cliques[0]({ stopPropagation() {}, preventDefault() {} });
  return { registro, restaurar };
}

/**
 * Dispara o handler de clique MAIS RECENTE registrado em `id` -- não o
 * primeiro. Necessário porque `getElementById` cacheia por id para sempre
 * (ver cabeçalho do arquivo): cada vez que um passo de magia reabre o MESMO
 * id ("btn-pular-troca-conhecida" existe em todo passo), um handler NOVO se
 * empilha sobre os anteriores, e só o último corresponde ao modal
 * atualmente aberto.
 * @param {Map<string,object>} registro
 * @param {string} id
 */
function clicar(registro, id) {
  const cliques = registro.get(id)?.handlers?.click || [];
  assert.ok(cliques.length >= 1, `esperado >=1 click handler em #${id}, achado ${cliques.length}`);
  cliques[cliques.length - 1]({});
}

/** Lê o modal ATUAL (o que `abrirModal` escreveu por último). */
function modalAtual(registro) {
  return {
    titulo: registro.get('modal-titulo')?.textContent || '',
    corpo: registro.get('modal-corpo')?.innerHTML || '',
    acoes: registro.get('modal-acoes')?.innerHTML || '',
  };
}

/**
 * `mostrarTrocaMagiaConhecida`/`mostrarTrocaTruque` são `async` (fazem
 * `await` em `db.js`, que por sua vez faz `await fetch(...)` -- o stub de
 * `harness.mjs` lê o arquivo do disco de forma síncrona, mas o resultado
 * ainda passa por uma cadeia de promises antes de `abrirModal` escrever no
 * DOM). Como a cadeia deste arquivo é disparada por um `click` SÍNCRONO
 * (não há `await` no handler registrado em `addEventListener`), o teste
 * precisa ceder o controle ao event loop para essas promises resolverem
 * antes de ler o modal seguinte. Um `setTimeout` real (ainda que curto)
 * escoa TANTO microtasks quanto qualquer macrotask pendente -- mais
 * robusto que encadear `Promise.resolve()` à mão, que escoa só microtasks.
 */
function esperar(ms = 40) {
  return new Promise((resolve) => setTimeoutReal(resolve, ms));
}

/** Texto (sem tags) do `.opcao-lista` de "Magia a remover" do modal atual. */
function listaRemoverMagia(registro) {
  return registro.get('troca-conhecida-remover-lista')?.querySelector('.opcao-lista')?.innerHTML || '';
}

// ------------------------------------------------------------
// ORÁCULO 1 -- não-regressão da maioria: classe única produz os MESMOS
// passos de hoje (um de magia, um de truque), com o MESMO texto EM TODA
// PARTE -- inclusive o TÍTULO e a EXPLICAÇÃO do sub-modal que
// `mostrarTrocaMagiaConhecida` (grimorio.js) abre, não só o parágrafo que
// hp-descanso.js escreve. Clérigo 5 sozinho: 'preparadas', sem Maestria em
// Arma -- isola exatamente o texto de troca de magia/truque, sem o
// parágrafo de maestria misturado no meio.
//
// CORREÇÃO (rodada 1 de revisão, Important 1 e 2): a versão anterior deste
// oráculo EXIGIA o título novo ("Trocar Magia Conhecida — Clérigo"),
// cimentando a regressão em vez de pegá-la -- hp-descanso.js chamava
// `mostrarTrocaMagiaConhecida` com `opcoes.classe` SEMPRE, mesmo em classe
// única, usando a condição errada (`passosMagia.length === 1`, que também
// é verdadeira num multiclasse reduzido a um passo por falta de candidata
// nas outras classes -- Oráculo 4). A condição certa é
// `superficiesLongo.length === 1` -- UMA SÓ superfície de conjuração no
// personagem INTEIRO --, que só é verdadeira para personagem de classe
// única de verdade. Com ela, a chamada para classe única volta a ser
// `mostrarTrocaMagiaConhecida(prox)`, SEM `opcoes.classe` -- a MESMA
// chamada de antes desta tarefa -- e título/explicação saem EXATAMENTE
// como grimorio.js (T2, já aprovado) os produz sem `opcoes.classe`
// (grimorio.js:1341-1344): título `'Trocar Magia Conhecida'` (sem
// sufixo de classe) e explicação `'Apos um Descanso Longo, voce pode
// trocar <strong>1 magia conhecida</strong> por outra da lista de
// Clérigo.'` -- SEM acentos em "Apos"/"voce" (é o texto LITERAL do
// código-fonte, copiado dali, não digitado de memória) e dizendo
// "conhecida" mesmo para o Clérigo (o rótulo interno de grimorio.js segue
// `ehMago`, não `tipo_conjuracao` -- comportamento de T2, anterior a esta
// tarefa e fora do escopo dela).
// ------------------------------------------------------------
test('ORACULO 1 -- classe única (Clérigo 5): um passo de magia, um de truque, texto idêntico ao de antes', async () => {
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }]);
  p.magias_preparadas = [{ nome: 'Bênção', circulo: 1, classe: 'Clérigo' }];
  p.magias_conhecidas = [{ nome: 'Chama Sagrada', circulo: 0 }];

  const { registro, restaurar } = await iniciarDescansoLongo(p);
  try {
    const inicial = modalAtual(registro);
    assert.ok(inicial.acoes.includes('id="btn-trocar-magias-dl"'),
      'Clérigo com preparada própria tem de oferecer "Trocar Magias"');
    assert.ok(inicial.acoes.includes('id="btn-trocar-truque-dl"'),
      'Clérigo com truque próprio tem de oferecer "Trocar Truque"');
    assert.ok(!inicial.acoes.includes('id="btn-trocar-maestrias-dl"'),
      'sanity: Clérigo não concede Maestria em Arma -- isola o parágrafo de magia/truque');

    // Texto do parágrafo de magia: IDÊNTICO ao produzido antes desta
    // tarefa para classe única (byte a byte, exceto espaçamento de
    // indentação do template).
    assert.match(inicial.corpo,
      /Como Clérigo, você pode trocar <strong>1 magia preparada<\/strong> por outra da lista de classe após um Descanso Longo\. Para remontar a lista inteira, use a subida de nível\./,
      `parágrafo de troca de magia mudou para classe única. corpo: ${inicial.corpo}`);
    assert.doesNotMatch(inicial.corpo, /trocas de magia disponíveis/,
      'classe única não pode mostrar o texto plural de múltiplas trocas');

    // Texto do parágrafo de truque: IDÊNTICO ao de antes (fonte da classe
    // é superficieAtivaDaFicha, que para classe única é sempre a única
    // classe -- concorda com o espelho char.classe).
    assert.match(inicial.corpo,
      /Você pode trocar <strong>1 truque<\/strong> por outro da lista de Clérigo após um Descanso Longo\./,
      `parágrafo de troca de truque mudou para classe única. corpo: ${inicial.corpo}`);

    // A cadeia: clicar "Trocar Magias" tem de abrir o passo de magia (com
    // candidata 'Bênção'), e "Não Trocar" ali tem de levar direto ao passo
    // de truque -- exatamente DOIS modais depois do inicial, nem mais nem
    // menos (é a propriedade que o Oráculo 5 mede a fundo).
    //
    // TÍTULO e EXPLICAÇÃO do sub-modal: EXATAMENTE os de antes desta
    // tarefa -- texto copiado do código-fonte de grimorio.js:1341-1344 (o
    // ramo SEM `opcoes.classe`), não reconstruído de memória.
    clicar(registro, 'btn-trocar-magias-dl');
    await esperar();
    const modalMagia = modalAtual(registro);
    assert.equal(modalMagia.titulo, 'Trocar Magia Conhecida',
      `título do sub-modal de magia, classe única: tem de ser IDÊNTICO ao de antes desta tarefa, sem ` +
      `sufixo de classe nenhum. título obtido: "${modalMagia.titulo}"`);
    assert.match(modalMagia.corpo,
      /Apos um Descanso Longo, voce pode trocar <strong>1 magia conhecida<\/strong> por outra da lista de Clérigo\./,
      `explicação do sub-modal de magia, classe única: tem de ser IDÊNTICA à de antes desta tarefa. corpo: ${modalMagia.corpo}`);
    assert.match(listaRemoverMagia(registro), /data-opcao="Bênção"/,
      `candidata a sair tem de incluir Bênção. lista: ${listaRemoverMagia(registro)}`);

    clicar(registro, 'btn-pular-troca-conhecida');
    await esperar();
    const modalTruque = modalAtual(registro);
    assert.equal(modalTruque.titulo, 'Trocar Truque',
      `depois do único passo de magia, o próximo modal tem de ser o de truque. título: ${modalTruque.titulo}`);
  } finally {
    restaurar();
  }
});

// ------------------------------------------------------------
// ORÁCULO 2 -- O DEFEITO DO SUB-PROJETO: Clérigo 5/Druida 5 produz DOIS
// passos de magia, um por classe, NA ORDEM de `ordem` (Clérigo primeiro,
// que veio primeiro no roteiro) -- e as candidatas de cada passo são só as
// DAQUELA classe.
// ------------------------------------------------------------
test('ORACULO 2 -- Clerigo 5/Druida 5: DOIS passos de magia, um por classe, na ordem de aquisicao', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Druida', nivel: 5 },
  ]);
  p.magias_preparadas = [
    { nome: 'Bênção', circulo: 1, classe: 'Clérigo' },
    { nome: 'Amizade Animal', circulo: 1, classe: 'Druida' },
  ];

  const { registro, restaurar } = await iniciarDescansoLongo(p);
  try {
    const inicial = modalAtual(registro);
    assert.match(inicial.corpo, /2 trocas de magia disponíveis/,
      `modal inicial tem de anunciar as DUAS trocas disponíveis. corpo: ${inicial.corpo}`);
    assert.match(inicial.corpo, /Clérigo: 1 magia preparada/, inicial.corpo);
    assert.match(inicial.corpo, /Druida: 1 magia preparada/, inicial.corpo);

    clicar(registro, 'btn-trocar-magias-dl');
    await esperar();
    const passo1 = modalAtual(registro);
    assert.match(passo1.titulo, /Clérigo/,
      `o PRIMEIRO passo tem de ser Clérigo (ordem 0, veio primeiro). título: ${passo1.titulo}`);
    assert.match(listaRemoverMagia(registro), /data-opcao="Bênção"/,
      `passo do Clérigo tem de oferecer Bênção. lista: ${listaRemoverMagia(registro)}`);
    assert.doesNotMatch(listaRemoverMagia(registro), /Amizade Animal/,
      'passo do Clérigo NÃO pode oferecer Amizade Animal (carimbada Druida, de OUTRA classe)');

    clicar(registro, 'btn-pular-troca-conhecida');
    await esperar();
    const passo2 = modalAtual(registro);
    assert.match(passo2.titulo, /Druida/,
      `o SEGUNDO passo tem de ser Druida (ordem 1, veio depois). título: ${passo2.titulo}`);
    assert.match(listaRemoverMagia(registro), /data-opcao="Amizade Animal"/,
      `passo da Druida tem de oferecer Amizade Animal. lista: ${listaRemoverMagia(registro)}`);
    assert.doesNotMatch(listaRemoverMagia(registro), /Bênção/,
      'passo da Druida NÃO pode oferecer Bênção (carimbada Clérigo, de OUTRA classe)');
  } finally {
    restaurar();
  }
});

// ------------------------------------------------------------
// PROVA DE MUTAÇÃO do Oráculo 2 -- documentada no relatório (comando +
// saída colados de uma execução manual: comentar `...passosMagia.map(...)`
// para só o primeiro elemento entrar em PASSOS reduz a cadeia a UM passo
// de magia, e o Oráculo 2 tem de acusar a falta do segundo).
// ------------------------------------------------------------

// ------------------------------------------------------------
// ORÁCULO 3 -- cada passo de magia nomeia a sua classe E usa o rotuloMagia
// certo: Bardo (magias CONHECIDAS) e Clérigo (magias PREPARADAS) na MESMA
// ficha mostram palavras diferentes. Mesmo roteiro do Oráculo 4 de
// troca-descanso-por-classe.test.mjs (Tarefa 1) -- fixture já confirmada
// ali: Bardo tem `tipo: 'conhecidas'`, Clérigo `tipo: 'preparadas'`.
// ------------------------------------------------------------
test('ORACULO 3 -- Bardo/Clerigo: cada passo nomeia a classe e usa "conhecida"/"preparada" corretamente', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Bardo', nivel: 5 }, { classe: 'Clérigo', nivel: 5 },
  ]);
  p.magias_preparadas = [
    { nome: 'Comando', circulo: 1, classe: 'Bardo' },
    { nome: 'Bênção', circulo: 1, classe: 'Clérigo' },
  ];

  const { registro, restaurar } = await iniciarDescansoLongo(p);
  try {
    const inicial = modalAtual(registro);
    // O rótulo que ESTE arquivo (hp-descanso.js) produz, no resumo do
    // modal inicial -- a fonte direta de "usa o rotuloMagia certo".
    assert.match(inicial.corpo, /Bardo: 1 magia conhecida/,
      `Bardo tem magias CONHECIDAS -- o resumo tem de dizer "conhecida". corpo: ${inicial.corpo}`);
    assert.match(inicial.corpo, /Clérigo: 1 magia preparada/,
      `Clérigo tem magias PREPARADAS -- o resumo tem de dizer "preparada". corpo: ${inicial.corpo}`);

    clicar(registro, 'btn-trocar-magias-dl');
    await esperar();
    assert.match(modalAtual(registro).titulo, /Bardo/,
      `primeiro passo (ordem 0) tem de nomear Bardo. título: ${modalAtual(registro).titulo}`);
    assert.match(listaRemoverMagia(registro), /data-opcao="Comando"/, listaRemoverMagia(registro));

    clicar(registro, 'btn-pular-troca-conhecida');
    await esperar();
    assert.match(modalAtual(registro).titulo, /Clérigo/,
      `segundo passo (ordem 1) tem de nomear Clérigo. título: ${modalAtual(registro).titulo}`);
    assert.match(listaRemoverMagia(registro), /data-opcao="Bênção"/, listaRemoverMagia(registro));
  } finally {
    restaurar();
  }
});

// ------------------------------------------------------------
// ORÁCULO 4 -- portão por CANDIDATA: Clérigo 5 (sem NENHUMA preparada
// própria) / Druida 5 (com uma) -- só a Druida entra na cadeia de magia. O
// Clérigo continua contribuindo para a ELEGIBILIDADE de truque (é
// conjurador), então a cadeia tem de ir direto do passo único de magia
// (Druida) para o de truque -- SEM um segundo passo de magia (Clérigo) no
// meio, que é o beco sem saída que este portão existe para fechar.
// ------------------------------------------------------------
test('ORACULO 4 -- Clerigo sem candidata nao entra na cadeia; Druida (com candidata) e o passo unico', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Druida', nivel: 5 },
  ]);
  p.magias_preparadas = [{ nome: 'Amizade Animal', circulo: 1, classe: 'Druida' }];
  p.magias_conhecidas = [{ nome: 'Chama Sagrada', circulo: 0 }];

  const { registro, restaurar } = await iniciarDescansoLongo(p);
  try {
    const inicial = modalAtual(registro);
    assert.doesNotMatch(inicial.corpo, /trocas de magia disponíveis/,
      'com candidata numa SÓ classe o resumo tem de usar o texto singular, não o plural de N classes');
    assert.match(inicial.corpo, /Como Druida, você pode trocar/,
      `o único passo de magia tem de ser Druida (a que tem candidata). corpo: ${inicial.corpo}`);
    assert.doesNotMatch(inicial.corpo, /Como Clérigo, você pode trocar/,
      'Clérigo (sem candidata) não pode aparecer como o passo de magia único');

    clicar(registro, 'btn-trocar-magias-dl');
    await esperar();
    assert.match(modalAtual(registro).titulo, /Druida/,
      `o passo de magia tem de ser o da Druida. título: ${modalAtual(registro).titulo}`);

    // "Não Trocar" aqui tem de ir DIRETO para o truque -- se o Clérigo
    // tivesse entrado na cadeia (o defeito que este portão evita), o
    // próximo modal seria um SEGUNDO passo de magia (Clérigo), não truque.
    clicar(registro, 'btn-pular-troca-conhecida');
    await esperar();
    assert.equal(modalAtual(registro).titulo, 'Trocar Truque',
      `depois do passo único (Druida), o próximo modal tem de ser truque -- não um segundo passo de ` +
      `magia para o Clérigo (sem candidata). título: ${modalAtual(registro).titulo}`);
  } finally {
    restaurar();
  }
});

// ------------------------------------------------------------
// ORÁCULO 4b -- COBERTURA NEGATIVA DO PORTÃO: zero candidata em NENHUMA
// classe conjuradora -- "Trocar Magias" não pode aparecer.
//
// RESTAURADO na rodada 1 de correção (Important 3): o teste "Achado 3"
// original de `magia-classe-leitores.test.mjs` cobria exatamente este caso
// negativo (o portão devolvendo AUSÊNCIA de botão), mas media pela
// superfície ATIVA -- premissa que a Tarefa 3 substituiu (ver o teste
// invertido naquele arquivo). O relatório da rodada anterior afirmou que os
// Oráculos 2/4/6 deste arquivo tinham assumido essa cobertura; a revisão
// mediu que NENHUM dos três exercita "zero candidata em TODAS as classes":
// o Oráculo 4 tem uma classe SEM candidata e OUTRA COM -- o portão nesse
// caso tem de dizer "sim" (para a Druida), não "não". Este oráculo aqui é
// o que efetivamente fecha a lacuna: Clérigo 5/Druida 5, NENHUMA preparada
// de nenhuma das duas -- "Trocar Magias" tem de estar ausente.
//
// CORREÇÃO (revisão final, Minor CA-5): a versão anterior deste oráculo
// deixava `magias_conhecidas` implicitamente `[]` (`criarPersonagemVazio`,
// store.js) -- com isso `temMaestria`, `temTrocaMagia` E `temTrocaTruque`
// ficavam os TRÊS falsos, `if (temMaestria || temTrocaMagia ||
// temTrocaTruque)` nunca entrava, `abrirModal` nunca rodava, e as duas
// asserções abaixo corriam sobre `inicial.acoes`/`inicial.corpo` vazios
// (os valores-padrão de `modalAtual`, ver seu docblock) -- passavam por
// AUSÊNCIA DE TELA, não por uma tela real sem o botão. O oráculo ainda
// discriminava a mutação que ele mira (prova de mutação abaixo), mas
// passaria também se o modal sumisse por qualquer outro motivo -- a
// cobertura era real por acaso do arranjo, não por medir a coisa certa.
// Dar um truque ao personagem abre o modal pelo PASSO DE TRUQUE (a
// elegibilidade de truque só depende do direito da classe, não de haver
// candidata de MAGIA -- `podeTrocarTruque`, regras-preparo-magias.js), e
// transforma a ausência do botão de magia numa afirmação sobre HTML de
// verdade.
// ------------------------------------------------------------
test('ORACULO 4b -- zero candidata em NENHUMA classe conjuradora: "Trocar Magias" nao aparece', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Druida', nivel: 5 },
  ]);
  p.magias_preparadas = [];
  // Truque para o modal ABRIR de verdade (pelo passo de truque, já que
  // nenhuma classe tem candidata de magia) -- sem isto o portão do modal
  // inteiro fica falso e a ausência do botão de magia é vácua. Ver
  // comentário do oráculo, acima.
  p.magias_conhecidas = [{ nome: 'Chama Sagrada', circulo: 0 }];

  const { registro, restaurar } = await iniciarDescansoLongo(p);
  try {
    const inicial = modalAtual(registro);
    // Sanity: o modal abriu de verdade (pelo truque) -- se isto falhar, as
    // duas asserções abaixo voltariam a medir vácuo.
    assert.ok(inicial.acoes.includes('id="btn-trocar-truque-dl"'),
      `sanity: o modal tem de abrir pelo passo de truque, senão a ausência do botão de magia, abaixo, ` +
      `não afirma nada sobre tela real. ações: ${inicial.acoes}`);
    assert.ok(!inicial.acoes.includes('id="btn-trocar-magias-dl"'),
      'sem NENHUMA preparada de NENHUMA das duas classes, "Trocar Magias" não pode aparecer -- abriria ' +
      `um passo com a lista de candidatas vazia. ações: ${inicial.acoes}`);
    assert.doesNotMatch(inicial.corpo, /Deseja trocar (uma magia|suas magias)/,
      `o parágrafo de troca de magia não pode aparecer quando não há candidata nenhuma. corpo: ${inicial.corpo}`);
  } finally {
    restaurar();
  }
});

// ------------------------------------------------------------
// PROVA DE MUTAÇÃO do Oráculo 4b -- documentada no relatório da Tarefa 5
// (comando + saída colados de uma execução manual: relaxar o portão de
// "Trocar Magias" em hp-descanso.js para ignorar candidata -- `const
// temTrocaMagia = passosMagia.length > 0` virando `const temTrocaMagia =
// trocasLongo.length > 0` -- faz o botão aparecer mesmo sem preparada
// nenhuma, e o Oráculo 4b tem de acusar).
// ------------------------------------------------------------

// ------------------------------------------------------------
// ORÁCULO 5 -- A PROPRIEDADE QUE `PASSOS` EXISTE PARA GARANTIR: clicar
// "Trocar Magias" (o primeiro passo de magia) leva a TODAS as trocas dali
// para a frente, incluindo a de truque no fim -- mesmo com DOIS passos de
// magia no meio.
// ------------------------------------------------------------
test('ORACULO 5 -- a cadeia percorre tudo dali para a frente: magia(Clerigo) -> magia(Druida) -> truque', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Druida', nivel: 5 },
  ]);
  p.magias_preparadas = [
    { nome: 'Bênção', circulo: 1, classe: 'Clérigo' },
    { nome: 'Amizade Animal', circulo: 1, classe: 'Druida' },
  ];
  p.magias_conhecidas = [{ nome: 'Chama Sagrada', circulo: 0 }];

  const { registro, restaurar } = await iniciarDescansoLongo(p);
  try {
    clicar(registro, 'btn-trocar-magias-dl');
    await esperar();
    assert.match(modalAtual(registro).titulo, /Clérigo/, 'passo 1: Clérigo');

    clicar(registro, 'btn-pular-troca-conhecida');
    await esperar();
    assert.match(modalAtual(registro).titulo, /Druida/, 'passo 2: Druida');

    clicar(registro, 'btn-pular-troca-conhecida');
    await esperar();
    assert.equal(modalAtual(registro).titulo, 'Trocar Truque',
      `o clique em "Trocar Magias" tem de alcançar o passo de TRUQUE no fim da cadeia, depois dos DOIS ` +
      `passos de magia -- título final: ${modalAtual(registro).titulo}`);

    // A troca de truque em si continua funcionando dali (não travou):
    // "Não Trocar" fecha e a cadeia termina sem lançar.
    clicar(registro, 'btn-pular-troca-truque');
  } finally {
    restaurar();
  }
});

// ------------------------------------------------------------
// ORÁCULO 6 -- classe que não conjura não gera PASSO DE MAGIA: Bárbaro
// 5/Mago 1 tem um passo de magia só (o do Mago) -- o Bárbaro nunca aparece
// no resumo/cadeia de TROCA DE MAGIA. (Bárbaro concede Maestria em Arma,
// um recurso INDEPENDENTE desta tarefa -- "Como Bárbaro, você pode
// alterar..." aparece no parágrafo de MAESTRIA, e é esperado; a asserção
// abaixo mede só o parágrafo de MAGIA, que é o escopo desta tarefa.)
// ------------------------------------------------------------
test('ORACULO 6 -- Barbaro 5/Mago 1: um passo de magia so (Barbaro nao conjura)', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  p.magias_preparadas = [{ nome: 'Alarme', circulo: 1, classe: 'Mago' }];

  const { registro, restaurar } = await iniciarDescansoLongo(p);
  try {
    const inicial = modalAtual(registro);
    assert.doesNotMatch(inicial.corpo, /trocas de magia disponíveis/,
      'com uma classe conjuradora só (Mago) o resumo tem de usar o texto singular');
    assert.match(inicial.corpo, /Como Mago, você pode trocar/, inicial.corpo);
    assert.doesNotMatch(inicial.corpo, /Como Bárbaro, você pode trocar/,
      'Bárbaro não conjura -- não pode aparecer como o passo de troca de MAGIA ' +
      '(a menção a "Bárbaro" no parágrafo de maestria, acima, é esperada e outro recurso)');
    assert.doesNotMatch(inicial.acoes, /id="btn-trocar-truque-dl"/,
      'sanity: sem magias_conhecidas nenhuma, não há truque trocável -- isola o passo de magia');

    // Bárbaro não conjura -- `superficiesDaFicha` só inclui o Mago, então
    // este personagem tem UMA superfície de conjuração só (mesmo tendo DUAS
    // classes). `ehSuperficieUnica` (hp-descanso.js) é true aqui, e o
    // sub-modal abre SEM `opcoes.classe` -- mesmo título de sempre, sem
    // sufixo de classe (mesma regra do Oráculo 1).
    clicar(registro, 'btn-trocar-magias-dl');
    await esperar();
    assert.equal(modalAtual(registro).titulo, 'Trocar Magia Conhecida',
      `com uma única superfície de conjuração (só o Mago), o título não pode ganhar sufixo de classe. ` +
      `título obtido: "${modalAtual(registro).titulo}"`);
  } finally {
    restaurar();
  }
});
