// ============================================================
// Oraculos de `preparadasPorClasse` (site/js/regras-magia-classe.js) --
// Tarefa 4 do sub-projeto 2026-08-29-magia-sabe-a-classe: os LEITORES
// (contadores e portoes de bloqueio) tolerando o estado misto PERMANENTE de
// magias_preparadas[] -- parte com `classe`, parte sem.
//
// `preparadasPorClasse` e a UNICA fonte dos tres baldes (desta/deOutra/
// semClasse) que os sitios de tela usam (sheet/grimorio.js, sheet/magias.js,
// levelup-ui.js) -- este arquivo prova a peca pura; os sitios de DOM ficam
// para a Tarefa 5 (e2e via Playwright), como o brief manda.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, lerClassesDados } from './harness.mjs';

// ------------------------------------------------------------
// Oraculo 1 do brief: os tres baldes, incluindo a entrada sem a chave e a
// entrada com carimbo de OUTRA classe.
// ------------------------------------------------------------

test('preparadasPorClasse classifica em desta/deOutra/semClasse', async () => {
  const { magiaClasse } = await modulosApp();
  const p = {
    magias_preparadas: [
      { nome: 'Bola de Fogo', circulo: 3, classe: 'Mago' },        // desta
      { nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' }, // deOutra
      { nome: 'Voar', circulo: 3 },                                 // semClasse (sem a chave)
    ],
  };
  const { desta, deOutra, semClasse } = magiaClasse.preparadasPorClasse(p, 'Mago');
  assert.deepEqual(desta.map((m) => m.nome), ['Bola de Fogo'],
    'classe === nomeClasse tem de cair em desta');
  assert.deepEqual(deOutra.map((m) => m.nome), ['Curar Ferimentos'],
    'classe string não vazia e diferente de nomeClasse tem de cair em deOutra');
  assert.deepEqual(semClasse.map((m) => m.nome), ['Voar'],
    'entrada sem a chave classe tem de cair em semClasse');
});

test('preparadasPorClasse: valor de classe vazio (string vazia) conta como semClasse, não como desta nem deOutra', async () => {
  const { magiaClasse } = await modulosApp();
  // O contrato dos gravadores/migração (Tarefas 2 e 3) garante que `classe`
  // nunca sai '' na prática -- mas o brief manda tratar "ausente OU valor
  // vazio" como o MESMO caso semClasse, e não confiar cegamente no contrato
  // de quem grava.
  const p = { magias_preparadas: [{ nome: 'Luz', circulo: 0, classe: '' }] };
  const r = magiaClasse.preparadasPorClasse(p, 'Mago');
  assert.deepEqual(r.desta, []);
  assert.deepEqual(r.deOutra, []);
  assert.equal(r.semClasse.length, 1);
});

// ------------------------------------------------------------
// Oraculo 2 do brief: magia isenta (magiaContaNoLimite falso) não entra em
// balde nenhum -- mesmo com `classe` gravado por engano.
// ------------------------------------------------------------

test('magia isenta (origem iniciado_em_magia) não entra em balde nenhum, mesmo com classe "Mago" gravada por engano', async () => {
  const { magiaClasse } = await modulosApp();
  const p = {
    magias_preparadas: [
      { nome: 'Curar Ferimentos', circulo: 1, origem: 'iniciado_em_magia', classe: 'Mago' },
    ],
  };
  const r = magiaClasse.preparadasPorClasse(p, 'Mago');
  assert.deepEqual(r.desta, [], 'magia isenta não gasta vaga de ninguém -- não pode entrar em desta mesmo carimbada');
  assert.deepEqual(r.deOutra, []);
  assert.deepEqual(r.semClasse, []);
});

// ------------------------------------------------------------
// Oraculo 3 do brief -- O ORÁCULO MAIS IMPORTANTE: classe única é
// ALGEBRICAMENTE IDÊNTICA ao cálculo de hoje. Roda a MIGRAÇÃO real (Tarefa
// 3) sobre um Mago 5 -- não presume que ela carimbou tudo, MEDE.
// ------------------------------------------------------------

test('classe única (Mago 5, migrado): desta.length é idêntico ao filtro antigo por magiaContaNoLimite, e semClasse fica vazio', async () => {
  const { sheetEstado, sheetMigracoes, magiaClasse, regrasOrigensMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.magias_preparadas = [
    { nome: 'Bola de Fogo', circulo: 3 },
    { nome: 'Mísseis Mágicos', circulo: 1 },
    { nome: 'Escudo Arcano', circulo: 1 },
    { nome: 'Voar', circulo: 3 },
    // Entrada isenta misturada de propósito -- prova que ela fica de fora
    // dos DOIS lados da comparação (nem no cálculo antigo, nem em `desta`),
    // e não distorce a igualdade.
    { nome: 'Concedida por Talento', circulo: 1, origem: 'iniciado_em_magia' },
  ];
  sheetEstado.definirChar(p);

  const alterado = await sheetMigracoes.migrarMagiaClasse();
  assert.equal(alterado, true, 'fixture: as 4 entradas normais não tinham classe -- a migração tinha de alterar algo');

  // O CÁLCULO "DE HOJE" (antes desta tarefa): char.magias_preparadas
  // filtrado só por magiaContaNoLimite, sem olhar `classe` nenhuma.
  const calculoAntigo = p.magias_preparadas.filter((m) => regrasOrigensMagia.magiaContaNoLimite(m));
  assert.equal(calculoAntigo.length, 4, 'fixture: 4 entradas contam no limite, 1 é isenta');

  const { desta, semClasse } = magiaClasse.preparadasPorClasse(p, 'Mago');
  assert.equal(semClasse.length, 0,
    'classe única: a migração carimba TUDO sem consultar lista nenhuma -- não pode sobrar sem classe');
  assert.equal(desta.length, calculoAntigo.length,
    'ORÁCULO DE NÃO-REGRESSÃO DA MAIORIA: para classe única, desta.length tem de ser ' +
    'algebricamente idêntico ao cálculo antigo -- uma regressão aqui atinge quase todos os usuários');
});

// ------------------------------------------------------------
// Oraculo 4 do brief: estado misto (Clérigo 5/Mago 1) com carimbos
// parciais -- os três baldes somam o total de não-isentas, e nenhuma
// entrada aparece em dois baldes.
// ------------------------------------------------------------

test('Clérigo 5/Mago 1 com carimbos parciais: os três baldes somam o total de não-isentas, sem entrada em dois baldes', async () => {
  const { magiaClasse, regrasOrigensMagia } = await modulosApp();
  const p = {
    magias_preparadas: [
      { nome: 'A', circulo: 1, classe: 'Clérigo' },  // desta (para Clérigo)
      { nome: 'B', circulo: 1, classe: 'Mago' },      // deOutra (para Clérigo)
      { nome: 'C', circulo: 1 },                      // semClasse (ainda não migrada/ambígua)
      { nome: 'D', circulo: 1 },                      // semClasse também
      { nome: 'E', circulo: 1, origem: 'dominio' },   // isenta -- fora dos três baldes
    ],
  };
  const totalNaoIsentas = p.magias_preparadas.filter((m) => regrasOrigensMagia.magiaContaNoLimite(m)).length;
  assert.equal(totalNaoIsentas, 4, 'fixture: A, B, C, D contam no limite; E é isenta');

  const { desta, deOutra, semClasse } = magiaClasse.preparadasPorClasse(p, 'Clérigo');
  assert.equal(desta.length + deOutra.length + semClasse.length, totalNaoIsentas,
    'os três baldes têm de somar exatamente o total de entradas não-isentas');

  const nomesNosBaldes = [...desta, ...deOutra, ...semClasse].map((m) => m.nome);
  assert.equal(new Set(nomesNosBaldes).size, nomesNosBaldes.length,
    'nenhuma entrada pode aparecer em mais de um balde');
  assert.deepEqual(desta.map((m) => m.nome), ['A']);
  assert.deepEqual(deOutra.map((m) => m.nome), ['B']);
  assert.deepEqual(semClasse.map((m) => m.nome).sort(), ['C', 'D']);
});

// ------------------------------------------------------------
// Oraculo 5 do brief -- Regra do BLOQUEIO: com semClasse não vazio, a
// condição de bloqueio é falsa mesmo com desta.length >= limite. A prova é
// sobre a EXPRESSÃO que os portões usam (`desta.length >= limite &&
// semClasse.length === 0`), computada a partir de preparadasPorClasse --
// não sobre nenhum handler de DOM.
// ------------------------------------------------------------

test('regra do BLOQUEIO: com semClasse não vazio, a condição de bloqueio é falsa mesmo com desta.length >= limite', async () => {
  const { magiaClasse } = await modulosApp();
  const limite = 2;
  const p = {
    magias_preparadas: [
      { nome: 'A', circulo: 1, classe: 'Mago' },
      { nome: 'B', circulo: 1, classe: 'Mago' },
      { nome: 'C', circulo: 1 }, // sem classe -- ambígua
    ],
  };
  const { desta, semClasse } = magiaClasse.preparadasPorClasse(p, 'Mago');
  assert.ok(desta.length >= limite, 'fixture: desta tem de alcançar o limite para este oráculo medir algo');
  assert.ok(semClasse.length > 0, 'fixture: precisa de ao menos uma magia sem classe');

  const bloqueia = desta.length >= limite && semClasse.length === 0;
  assert.equal(bloqueia, false,
    'havendo magia sem classe, a contagem é incerta -- o portão AVISA (contador "+N sem ' +
    'classe") mas não pode bloquear uma ação que pode ser válida');

  // Controle: SEM a entrada ambígua, a MESMA expressão bloqueia -- prova
  // que a expressão de fato reage a `semClasse`, e não está sempre falsa
  // (um oráculo que "passasse" com a condição escrita `&& false` também
  // passaria aqui se este controle não existisse).
  const pSemAmbiguidade = { magias_preparadas: p.magias_preparadas.slice(0, 2) };
  const semAmbiguidade = magiaClasse.preparadasPorClasse(pSemAmbiguidade, 'Mago');
  const bloqueariaSemAmbiguidade = semAmbiguidade.desta.length >= limite && semAmbiguidade.semClasse.length === 0;
  assert.equal(bloqueariaSemAmbiguidade, true,
    'controle: sem nenhuma magia sem classe e com desta.length >= limite, a MESMA expressão tem de bloquear');
});

// ------------------------------------------------------------
// Oraculo 6 do brief: personagem sem magias_preparadas -> três arrays
// vazios, sem lançar.
// ------------------------------------------------------------

test('personagem sem magias_preparadas devolve os três arrays vazios, sem lançar', async () => {
  const { magiaClasse } = await modulosApp();
  assert.deepEqual(magiaClasse.preparadasPorClasse({}, 'Mago'),
    { desta: [], deOutra: [], semClasse: [] });
  assert.deepEqual(magiaClasse.preparadasPorClasse({ magias_preparadas: null }, 'Mago'),
    { desta: [], deOutra: [], semClasse: [] });
  assert.deepEqual(magiaClasse.preparadasPorClasse({ magias_preparadas: undefined }, 'Mago'),
    { desta: [], deOutra: [], semClasse: [] });
  assert.doesNotThrow(() => magiaClasse.preparadasPorClasse(null, 'Mago'));
  assert.doesNotThrow(() => magiaClasse.preparadasPorClasse(undefined, 'Mago'));
});

// ============================================================
// Rodada 1 de correção da Tarefa 4 (revisão independente) -- Achado 3: os
// portões "há magia para trocar?" de site/js/sheet/hp-descanso.js
// (Memorizar Magia do Descanso Curto, e a troca do Descanso Longo) tinham
// de concordar com a lista que `mostrarTrocaMagiaConhecida` (grimorio.js)
// realmente monta -- ela filtra as candidatas por `desta ∪ semClasse` da
// superfície ATIVA. Os quatro testes abaixo disparam o CLIQUE de verdade
// (setupEventosDescanso) e leem o HTML que `abrirModal` escreveu -- é o
// único jeito de provar "o botão não aparece" sem reimplementar a checagem
// dentro do teste (o que mediria o teste, não o app).
// ============================================================

/**
 * Elemento de DOM falso, mesmo contrato de multiclasse-descansos.test.mjs
 * (duplicado aqui pelo mesmo motivo -- aquele arquivo não o exporta):
 * guarda handlers registrados (para o teste DISPARAR o clique) e o que foi
 * escrito em innerHTML (para o teste LER o HTML do modal).
 * @param {string} id
 * @returns {object}
 */
function elementoFalsoDescanso(id) {
  const el = {
    id, style: {}, innerHTML: '', textContent: '', scrollTop: 0,
    className: '', dataset: {}, handlers: {}, value: '',
    addEventListener(evento, fn) { (el.handlers[evento] ||= []).push(fn); },
    removeAttribute() {}, setAttribute() {}, appendChild() {}, remove() {},
    closest: () => null, querySelector: () => null, querySelectorAll: () => [],
    classList: { add() {}, remove() {} },
  };
  return el;
}

/**
 * Instala um `document` falso (registro id -> elementoFalsoDescanso, criado
 * sob demanda) e um `setTimeout` que não prende o processo (toast() agenda
 * 3s) -- mesmo par de utilitários de multiclasse-descansos.test.mjs,
 * duplicado pelo mesmo motivo (aquele arquivo não os exporta).
 * @returns {{registro: Map<string,object>, restaurar: () => void}}
 */
function instalarDocumentoFalsoDescanso() {
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
      if (!registro.has(id)) registro.set(id, elementoFalsoDescanso(id));
      return registro.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => elementoFalsoDescanso(tag),
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
 * `setupEventosDescanso()` precisa para rodar sem lançar (os blocos de
 * restauração por classe leem classesData/índice de magias/talentos).
 * Também zera a superfície selecionada, para a superfície ATIVA cair
 * sempre na primeira classe do roteiro (a mesma regra que
 * `superficieAtivaDaFicha` usa por padrão).
 * @param {object} p Personagem já montado (personagemMulticlasse).
 */
async function prepararEstadoParaDescanso(p) {
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

/** Dispara o clique de `idBotao` de verdade (setupEventosDescanso já tem de
 *  estar chamado) e devolve o HTML somado de #modal-corpo + #modal-acoes --
 *  os dois juntos porque abrirModal(titulo, corpoHtml, acoesHtml) escreve o
 *  texto explicativo num elemento e o BOTÃO em outro. */
function dispararEDevolverHtmlDoModal(registro, idBotao) {
  const cliques = registro.get(idBotao)?.handlers?.click || [];
  assert.equal(cliques.length, 1, `sanity: setupEventosDescanso tem de registrar UM clique em #${idBotao}`);
  cliques[0]({ stopPropagation() {}, preventDefault() {} });
  return (registro.get('modal-corpo')?.innerHTML || '') + (registro.get('modal-acoes')?.innerHTML || '');
}

test('Achado 3 -- Descanso Curto: "Memorizar Magia" não abre um beco sem saída quando a superfície ativa não tem preparada própria', async () => {
  const { sheetHpDescanso } = await modulosApp();
  // Clérigo (ordem 0, superfície ATIVA por padrão) sem preparada própria;
  // Mago 5 (satisfaz nivelNa >= 5, concede Memorizar Magia) com 2
  // preparadas, mas carimbadas 'Mago' -- de OUTRA classe, do ponto de
  // vista da superfície ativa. O gate ANTIGO (char.magias_preparadas
  // inteiro, sem olhar classe) achava as 2 do Mago e oferecia "Memorizar
  // Magia"; o clique chamaria mostrarTrocaMagiaConhecida, que resolve
  // sup=Clérigo e monta candidatas = desta ∪ semClasse de 'Clérigo' --
  // vazia. Beco sem saída.
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 1 }, { classe: 'Mago', nivel: 5 },
  ]);
  p.magias_preparadas = [
    { nome: 'Bola de Fogo', circulo: 3, classe: 'Mago' },
    { nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' },
  ];
  p.pv_atual = p.pv_max; // jaCheio=true -- pula a escolha de dado de vida e
                         // vai direto para o ramo "else if (memorizarMagia)".
  await prepararEstadoParaDescanso(p);

  const { registro, restaurar } = instalarDocumentoFalsoDescanso();
  let html;
  try {
    sheetHpDescanso.setupEventosDescanso();
    html = dispararEDevolverHtmlDoModal(registro, 'btn-descanso-curto');
  } finally {
    restaurar();
  }

  assert.ok(!html.includes('id="btn-memorizar-magia-curto"'),
    'com a superfície ativa (Clérigo) sem preparada própria, o botão "Memorizar Magia" não pode aparecer ' +
    `-- apareceria para um fluxo que abriria com a lista de candidatas vazia (beco sem saída). HTML: ${html}`);
});

test('Achado 3 -- Descanso Curto: "Memorizar Magia" aparece quando a superfície ativa TEM preparada própria (controle)', async () => {
  const { sheetHpDescanso } = await modulosApp();
  // Mesmo roteiro do teste anterior, mas a preparada agora é do CLÉRIGO (a
  // superfície ativa) -- e nivelNa(char,'Mago') >= 5 continua concedendo a
  // característica. O botão TEM de aparecer aqui: prova que o teste
  // anterior mede a AUSÊNCIA do botão por causa da classe, não um "sempre
  // falso" do gate que passaria os dois testes por acidente.
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 1 }, { classe: 'Mago', nivel: 5 },
  ]);
  p.magias_preparadas = [
    { nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' },
  ];
  p.pv_atual = p.pv_max;
  await prepararEstadoParaDescanso(p);

  const { registro, restaurar } = instalarDocumentoFalsoDescanso();
  let html;
  try {
    sheetHpDescanso.setupEventosDescanso();
    html = dispararEDevolverHtmlDoModal(registro, 'btn-descanso-curto');
  } finally {
    restaurar();
  }

  assert.ok(html.includes('id="btn-memorizar-magia-curto"'),
    `controle: com a preparada do Clérigo (a superfície ativa), "Memorizar Magia" tem de aparecer. HTML: ${html}`);
});

// Achado 3 original (sub-projeto "magia sabe a classe"): o gate olhava só a
// SUPERFÍCIE ATIVA -- Clérigo 5 (ativo, sem preparada própria) escondia
// "Trocar Magias" mesmo quando o Mago 1 desta ficha tinha uma preparada
// carimbada dele sobrando para trocar. A Tarefa 3 do sub-projeto
// 2026-08-29-troca-por-classe-descanso SUPERSEDE essa premissa: o gate
// não é mais "a superfície ativa tem candidata?", e sim "ALGUMA classe
// conjuradora tem candidata?" -- porque agora há um passo de troca POR
// CLASSE (trocasDoDescansoLongo + passosMagia, hp-descanso.js), não um só
// atado à aba selecionada. Com a MESMA fixture de antes (Clérigo ativo sem
// candidata, Mago com uma), o botão "Trocar Magias" TEM de aparecer agora
// -- ele abriria o passo do MAGO, que tem candidata de verdade -- e negar
// a opção seria voltar a esconder uma troca à qual o jogador tem direito.
// FORTALECE, não relaxa: a asserção anterior (`!html.includes(...)`)
// checava a ausência de uma função que o jogador deveria ter.
//
// CORREÇÃO (rodada 1 de revisão, Important 3): a versão anterior deste
// comentário afirmava que os Oráculos 2/4/6 de
// testes/regras/unidade/troca-descanso-cadeia.test.mjs tinham assumido a
// cobertura NEGATIVA do portão ("zero candidata em NENHUMA classe -> sem
// botão") -- falso, a revisão mediu que nenhum dos três exercita esse
// caso. A cobertura certa, por oráculo:
//   - "candidata só numa classe não-ativa -> só o passo dela entra":
//     Oráculo 4 (Clérigo ativo sem candidata, Druida com uma -- só o passo
//     da Druida entra na cadeia).
//   - "zero candidata em NENHUMA classe -> sem botão nenhum": Oráculo 4b
//     (acrescentado nesta rodada de correção, Clérigo/Druida sem NENHUMA
//     preparada de nenhuma das duas).
test('Achado 3 (superseded pela Tarefa 3): "Trocar Magias" aparece quando OUTRA classe (não a superfície ativa) tem candidata a sair', async () => {
  const { sheetHpDescanso } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  p.magias_preparadas = [
    { nome: 'Bola de Fogo', circulo: 1, classe: 'Mago' },
  ];
  await prepararEstadoParaDescanso(p);

  const { registro, restaurar } = instalarDocumentoFalsoDescanso();
  let html;
  try {
    sheetHpDescanso.setupEventosDescanso();
    html = dispararEDevolverHtmlDoModal(registro, 'btn-descanso-longo');
  } finally {
    restaurar();
  }

  assert.ok(html.includes('id="btn-trocar-magias-dl"'),
    'o Mago (não a superfície ativa, o Clérigo) tem 1 preparada própria sobrando -- "Trocar Magias" tem ' +
    `de aparecer para oferecer o passo do Mago, mesmo sem candidata nenhuma do Clérigo. HTML: ${html}`);
  assert.match(html, /Mago/,
    `o texto do modal tem de nomear o Mago (a classe com candidata de verdade), não só o Clérigo. HTML: ${html}`);
});

test('Achado 3 -- Descanso Longo: "Trocar Magias" aparece quando a superfície ativa TEM candidata a sair (controle)', async () => {
  const { sheetHpDescanso } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  p.magias_preparadas = [
    { nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' },
  ];
  await prepararEstadoParaDescanso(p);

  const { registro, restaurar } = instalarDocumentoFalsoDescanso();
  let html;
  try {
    sheetHpDescanso.setupEventosDescanso();
    html = dispararEDevolverHtmlDoModal(registro, 'btn-descanso-longo');
  } finally {
    restaurar();
  }

  assert.ok(html.includes('id="btn-trocar-magias-dl"'),
    `controle: com a preparada do Clérigo (a superfície ativa), "Trocar Magias" tem de aparecer. HTML: ${html}`);
});

// ------------------------------------------------------------
// Item 1 (Important) da revisão final: os dois portões da SUBIDA DE NÍVEL
// (site/js/levelup-cards.js:698 e site/js/levelup-flow.js:683) nunca foram
// convertidos na Tarefa 4 -- mesma família do Achado 3 acima (hp-descanso.js),
// mas neste caso o beco sem saída é o card "Trocar Magias (Opcional)" e o
// step "Conjuração" do assistente de subida de nível: os dois contavam
// `magiaContaNoLimite` sobre `char.magias_preparadas` INTEIRO, enquanto
// `montarBlocoTrocaMagia` (levelup-ui.js:1772, já convertido na Tarefa 4)
// monta as candidatas do seletor "Qual magia sai?" só por `desta ∪
// semClasse` de `ctx.classeQueSobe`. Num Feiticeiro 5/Mago 1 (95% de lista
// em comum) subindo a classe cujas preparadas estão todas carimbadas com a
// OUTRA, o card/step apareciam prometendo uma troca e o seletor abria com
// zero candidatas.
//
// Fixture: Clérigo 5/Mago 1 subindo CLÉRIGO (5->6) -- nível medido (ver
// task-6-report.md) para não ativar nenhuma OUTRA razão de visibilidade do
// step 'selecao_magias' (truquesGanhos=0 neste nível; tipoConj='preparadas'
// então o ramo de magiasGanhas, que só vale para 'conhecidas', não entra em
// jogo; ehMago=false; subclasseArcana=null) -- isolando exatamente
// `temMagiaTrocavel`/`magiasAtuais` como única variável.
// ------------------------------------------------------------

test('Item 1 -- levelup-cards.js: card "Trocar Magias (Opcional)" não aparece quando a classe que sobe não tem candidata a sair', async () => {
  const { levelupFlow, levelupCards, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  // As duas preparadas existentes são do MAGO -- de OUTRA classe, do ponto
  // de vista de quem sobe (Clérigo). O gate ANTIGO (magiaContaNoLimite sobre
  // o personagem inteiro) via as duas e mostrava o card; o seletor por trás
  // dele (levelup-ui.js/montarBlocoTrocaMagia) filtra por classeQueSobe e
  // abriria vazio.
  p.magias_preparadas = [
    { nome: 'Bola de Fogo', circulo: 3, classe: 'Mago' },
    { nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' },
  ];
  const classeData = await db.getClasse('Clérigo');
  const ctx = await levelupFlow.buildLevelUpContext(p, classeData, {}, 'Clérigo');

  const html = levelupCards.renderCardMagias(ctx, {});

  assert.ok(!html.includes('Trocar Magias (Opcional)'),
    'sem nenhuma preparada do Clérigo (a classe que sobe) para trocar, o card não pode aparecer -- ' +
    `abriria o seletor de levelup-ui.js com a lista de candidatas vazia (beco sem saída). HTML: ${html}`);
});

test('Item 1 -- levelup-cards.js: card "Trocar Magias (Opcional)" aparece quando a classe que sobe TEM candidata a sair (controle)', async () => {
  const { levelupFlow, levelupCards, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  p.magias_preparadas = [
    { nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' },
  ];
  const classeData = await db.getClasse('Clérigo');
  const ctx = await levelupFlow.buildLevelUpContext(p, classeData, {}, 'Clérigo');

  const html = levelupCards.renderCardMagias(ctx, {});

  assert.ok(html.includes('Trocar Magias (Opcional)'),
    `controle: com a preparada do Clérigo (a classe que sobe), o card tem de aparecer. HTML: ${html}`);
});

test('Item 1 -- levelup-flow.js: step "Seleção de Magias" fica invisível quando a classe que sobe não tem candidata a trocar', async () => {
  const { levelupFlow, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  p.magias_preparadas = [
    { nome: 'Bola de Fogo', circulo: 3, classe: 'Mago' },
    { nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' },
  ];
  const classeData = await db.getClasse('Clérigo');
  const ctx = await levelupFlow.buildLevelUpContext(p, classeData, {}, 'Clérigo');
  // Sanity da fixture: nenhuma OUTRA razão de visibilidade do step pode
  // estar ativa neste nível, senão o teste não isola temMagiaTrocavel.
  const c = levelupFlow.calcularConjuracao(ctx, {});
  assert.equal(c.truquesGanhos, 0, 'sanity: este nível não pode conceder truque novo');
  assert.equal(c.ehMago, false, 'sanity: Clérigo não é Mago');

  const steps = levelupFlow.buildVisibleSteps(ctx, {});

  assert.ok(!steps.some(s => s.id === 'selecao_magias'),
    'sem nenhuma preparada do Clérigo (a classe que sobe) para trocar, e sem truque/magia nova ' +
    `neste nível, o step "Seleção de Magias" não pode ficar visível. Steps: ${steps.map(s => s.id)}`);
});

test('Item 1 -- levelup-flow.js: step "Seleção de Magias" fica visível quando a classe que sobe TEM candidata a trocar (controle)', async () => {
  const { levelupFlow, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  p.magias_preparadas = [
    { nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' },
  ];
  const classeData = await db.getClasse('Clérigo');
  const ctx = await levelupFlow.buildLevelUpContext(p, classeData, {}, 'Clérigo');

  const steps = levelupFlow.buildVisibleSteps(ctx, {});

  assert.ok(steps.some(s => s.id === 'selecao_magias'),
    `controle: com a preparada do Clérigo (a classe que sobe), o step tem de ficar visível. ` +
    `Steps: ${steps.map(s => s.id)}`);
});

// ------------------------------------------------------------
// Minor "consertar agora" 1 da revisão final: `site/js/sheet/habilidades.js`
// (ação 'memorizar-magia', botão "Trocar Magia Preparada") é o TERCEIRO
// caminho para `mostrarTrocaMagiaConhecida`, ao lado dos dois portões de
// hp-descanso.js já cobertos pelo Achado 3 acima.
//
// RODADA DE CORREÇÃO 1/5: a primeira versão deste teste (e do portão que
// ele media) usava `ctx.classe` como referência -- a classe DONA da
// característica ('Mago'), não a classe que `mostrarTrocaMagiaConhecida`
// (grimorio.js) resolve de fato (`superficieAtiva()`, a aba ATIVA da
// ficha). Os dois testes hardcoded (um esperando `false`, outro esperando
// `true`) bateram por coincidência com a fixture escolhida, sem medir se
// portão e modal CONCORDAVAM de verdade -- exatamente o defeito que o
// revisor pegou: o teste de controle certificava um portão que continuava
// divergindo do modal num Clérigo 5/Mago 1 comum. Reescrito para chamar as
// duas peças REAIS (`renderFeatureItem` e `mostrarTrocaMagiaConhecida`)
// sobre o MESMO personagem e comparar o resultado das duas, em vez de duas
// expectativas hardcoded independentes.
// ------------------------------------------------------------

/**
 * Elemento de DOM falso mínimo para `mostrarTrocaMagiaConhecida` rodar até
 * o fim sem lançar: além do que `elementoFalsoDescanso` (acima) já cobre,
 * `montarSeletor` (site/js/ui-opcoes.js) faz `el.querySelector('.opcao-
 * lista')`/`('.opcao-contagem')` sobre o container que ela mesma preenche
 * -- por isso `querySelector` aqui devolve um filho fake cacheado por
 * seletor (identidade estável entre chamadas), em vez de `null`.
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

/** Mesmo par de utilitários de `instalarDocumentoFalsoDescanso` (acima),
 *  com `querySelector` capaz de montarSeletor -- ver `elementoFalsoGrimorio`. */
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
 * Roda o portão real (`renderFeatureItem`) e o modal real
 * (`mostrarTrocaMagiaConhecida`) sobre o MESMO personagem já posto em
 * `sheetEstado`, e devolve os dois resultados para o teste comparar
 * concordância -- em vez de duas expectativas hardcoded independentes.
 * `modalAbriu` é `false` quando `mostrarTrocaMagiaConhecida` toma o
 * caminho curto de "Nenhuma magia conhecida para trocar" (toast + return
 * antes de `abrirModal`), e `true` quando chega a escrever conteúdo em
 * `#modal-corpo`.
 * @param {object} p Personagem já em `sheetEstado.definirChar`.
 * @returns {Promise<{apareceuBotao: boolean, modalAbriu: boolean}>}
 */
async function medirPortaoEModal(p) {
  const { sheetHabilidades, sheetGrimorio, sheetEstado, db, levelup, contextoClasse } = await modulosApp();
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
  // Superfície ATIVA cai na PRIMEIRA classe do roteiro -- mesma regra que
  // `superficieAtivaDaFicha` usa por padrão -- para a fixture não depender
  // de escolha vazada de um teste anterior.
  contextoClasse.resetarSuperficieSelecionada();

  const dadosMago = await db.getClasse('Mago');
  const featureMemorizarMagia = dadosMago.caracteristicas.find(f => f.nome === 'Memorizar Magia');
  assert.ok(featureMemorizarMagia, 'sanity: "Memorizar Magia" tem de existir em classes/Mago.json');
  const ctx = { classe: 'Mago', subclasse: '', nivelClasse: 5 };
  const htmlBotao = sheetHabilidades.renderFeatureItem(featureMemorizarMagia, 'classe', ctx);
  const apareceuBotao = htmlBotao.includes('data-mago-acao="memorizar-magia"');

  const { registro, restaurar } = instalarDocumentoFalsoGrimorio();
  let modalAbriu;
  try {
    await sheetGrimorio.mostrarTrocaMagiaConhecida(null, {
      titulo: 'Memorizar Magia',
      explicacao: 'Apos um Descanso Curto, voce pode trocar 1 magia preparada por outra do seu livro de magias.',
    });
    modalAbriu = (registro.get('modal-corpo')?.innerHTML || '') !== '';
  } finally {
    restaurar();
  }

  return { apareceuBotao, modalAbriu };
}

test('Minor 1 -- habilidades.js: botão "Trocar Magia Preparada" concorda com mostrarTrocaMagiaConhecida quando a superfície ativa não tem candidata', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 5 },
  ]);
  // Superfície ATIVA (Clérigo, ordem 0) sem preparada própria; a única
  // preparada é carimbada 'Mago' -- de OUTRA classe do ponto de vista do
  // modal, que resolve por `superficieAtiva()`, não pela classe da
  // característica. Esta é a fixture que pega o defeito da rodada 1: um
  // portão baseado em `ctx.classe` acharia esta preparada (é 'Mago') e
  // liberaria o botão, enquanto o modal real (Clérigo ativo) não teria
  // candidata nenhuma -- beco sem saída.
  p.magias_preparadas = [
    { nome: 'Bola de Fogo', circulo: 3, classe: 'Mago' },
  ];

  const { apareceuBotao, modalAbriu } = await medirPortaoEModal(p);

  assert.equal(modalAbriu, false,
    'sanity: sem candidata na superfície ativa, mostrarTrocaMagiaConhecida tem de tomar o caminho ' +
    'do toast de erro (nunca escrever em #modal-corpo)');
  assert.equal(apareceuBotao, modalAbriu,
    `o botão "Trocar Magia Preparada" (apareceuBotao=${apareceuBotao}) e o modal real ` +
    `(modalAbriu=${modalAbriu}) têm de concordar -- um portão que libera o botão quando o modal não ` +
    'tem candidata nenhuma é o beco sem saída que este item existe para fechar.');
});

test('Minor 1 -- habilidades.js: botão "Trocar Magia Preparada" concorda com mostrarTrocaMagiaConhecida quando a superfície ativa TEM candidata (controle)', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 5 },
  ]);
  // Superfície ATIVA (Clérigo) COM preparada própria -- controle na direção
  // oposta: um portão baseado em `ctx.classe` ('Mago') não acharia esta
  // preparada (é 'Clérigo') e esconderia o botão, apesar de o modal real
  // ter uma troca legítima para oferecer.
  p.magias_preparadas = [
    { nome: 'Curar Ferimentos', circulo: 1, classe: 'Clérigo' },
  ];

  const { apareceuBotao, modalAbriu } = await medirPortaoEModal(p);

  assert.equal(modalAbriu, true,
    'sanity: com a preparada da superfície ativa, mostrarTrocaMagiaConhecida tem de passar do ' +
    'cheque de candidatas e escrever conteúdo em #modal-corpo');
  assert.equal(apareceuBotao, modalAbriu,
    `controle: o botão (apareceuBotao=${apareceuBotao}) e o modal real (modalAbriu=${modalAbriu}) ` +
    'têm de concordar -- um portão apertado demais esconderia uma troca legítima.');
});

test('Minor 1 -- habilidades.js: classe única (Mago) continua idêntica a antes deste sub-projeto', async () => {
  // Pedido explícito da rodada 1: com UMA superfície de conjuração só (a
  // maioria esmagadora dos personagens), `superficieAtivaDaFicha` devolve
  // essa única superfície -- o portão não pode se comportar diferente do
  // que se comportava antes de existir superfície ativa/classe carimbada
  // nenhuma. Mago 5 puro, uma preparada normal: o botão tem de aparecer, e
  // concordar com o modal, exatamente como um Mago de classe única sempre
  // viu.
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.magias_preparadas = [
    { nome: 'Bola de Fogo', circulo: 3 }, // sem carimbo -- migração/gravador não rodou nesta fixture
  ];

  const { apareceuBotao, modalAbriu } = await medirPortaoEModal(p);

  assert.equal(modalAbriu, true,
    'sanity: Mago de classe única com uma preparada de círculo > 0 tem de ter candidata a trocar');
  assert.equal(apareceuBotao, modalAbriu,
    `classe única: o botão (apareceuBotao=${apareceuBotao}) e o modal real (modalAbriu=${modalAbriu}) ` +
    'têm de concordar, do mesmo jeito que concordam em multiclasse -- não é um caminho separado.');
});
