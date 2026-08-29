// ============================================================
// Oráculos de comportamento do sub-projeto 3e (PV, dados de vida e
// descansos por classe).
//
// A rede do 3e tem DUAS camadas, e as duas são necessárias -- a revisão
// final do 3d mediu que, dos 19 defeitos plausíveis, 4 escapavam do
// guarda estático porque reverter um valor calculado para um LITERAL não
// reintroduz espelho nenhum. Este arquivo é a camada de COMPORTAMENTO;
// multiclasse-descansos-alcance.test.mjs é a sintática.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';

const mods = await modulosApp();
const { utils } = mods;

// ORÁCULO 1 -- a fórmula de PV multiclasse.
//
// Os pares são escolhidos para SEPARAR implementações erradas, não para
// exercitar a regra:
//   - Mago 5/Bárbaro 5 contra Bárbaro 5/Mago 5: d6 e d12 são os extremos
//     do catálogo, então usar "o dado da classe inicial x nível total"
//     (o defeito) dá 62 e 95, e a fórmula certa dá 77 e 80. As quatro
//     saídas são distintas duas a duas -- nenhuma coincidência salva uma
//     implementação errada.
//   - Guerreiro 5/Paladino 5 (d10 + d10) é o caso em que os dois dados
//     são IGUAIS: aqui o defeito acerta por acaso, e o oráculo existe
//     para provar que a fórmula nova não QUEBRA esse caso.
//   - Mago 10 de classe única é o canário da restrição mais dura do
//     projeto: classe única não pode mudar.
//
// Os valores esperados abaixo foram MEDIDOS contra a referência
// independente do harness (harness.mjs:394-405 -> p.pv_max), não copiados
// do plano: o plano trazia 85 para Guerreiro 5/Paladino 5 e 48 para Mago
// 10, mas a referência do harness produz 84 e 62 para esses dois casos
// (conferido também à mão pela fórmula do livro). Os outros três valores
// do plano (77, 80, 78) batem exatamente com o harness.
test('PV: cada classe contribui com o próprio dado de vida', async () => {
  const casos = [
    { roteiro: [{ classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }], esperado: 77 },
    { roteiro: [{ classe: 'Bárbaro', nivel: 5 }, { classe: 'Mago', nivel: 5 }], esperado: 80 },
    { roteiro: [{ classe: 'Clérigo', nivel: 5 }, { classe: 'Paladino', nivel: 5 }], esperado: 78 },
    { roteiro: [{ classe: 'Guerreiro', nivel: 5 }, { classe: 'Paladino', nivel: 5 }], esperado: 84 },
    { roteiro: [{ classe: 'Mago', nivel: 10 }], esperado: 62 },
  ];
  for (const { roteiro, esperado } of casos) {
    const p = await personagemMulticlasse(roteiro);
    const rotulo = roteiro.map((r) => `${r.classe} ${r.nivel}`).join('/');
    // modCon 2: personagemMulticlasse fixa constituicao 14.
    assert.equal(utils.calcPVMulticlasse(p, 2), esperado, `${rotulo}: PV`);
    // E bate com a referência INDEPENDENTE do harness (harness.mjs:394-405),
    // que implementa a fórmula do livro sem olhar para o app.
    assert.equal(utils.calcPVMulticlasse(p, 2), p.pv_max,
      `${rotulo}: divergiu da referência do harness`);
  }
});

// ORÁCULO 2 -- a simetria que o defeito quebra.
//
// O livro diz que a ORDEM DE AQUISIÇÃO não muda o PV total quando os
// níveis são os mesmos... mas ela MUDA, e de propósito: só a classe
// inicial paga o dado cheio. Mago 5/Bárbaro 5 = 77 e Bárbaro 5/Mago 5 = 80
// diferem em 3, que é exatamente (12 - 6) / 2 = a metade da diferença
// entre os dados cheios. O defeito de hoje produz uma diferença de 33.
// Este oráculo prende a MAGNITUDE, não só os valores: uma implementação
// que ainda use o dado do espelho não cabe em 3.
test('PV: a ordem de aquisição muda no máximo a diferença dos dados cheios', async () => {
  const ab = utils.calcPVMulticlasse(
    await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }]), 2);
  const ba = utils.calcPVMulticlasse(
    await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 5 }, { classe: 'Mago', nivel: 5 }]), 2);
  assert.equal(Math.abs(ab - ba), 3,
    'a diferença entre as duas ordens tem de ser (12-6)/2 = 3. O defeito antigo ' +
    'dava 33, porque multiplicava UM dado pelo nível TOTAL.');
});

// ORÁCULO 3 -- degradação explícita, não NaN.
test('PV: classe fora do catálogo não propaga NaN', () => {
  const p = { classes: [{ classe: 'Bardo Sombrio', nivel: 5, ordem: 0 }] };
  const pv = utils.calcPVMulticlasse(p, 2);
  assert.ok(Number.isFinite(pv) && pv >= 1, `esperado número finito >= 1, veio ${pv}`);
});

// ORÁCULO 3b -- o piso de 1 PV é POR NÍVEL, não sobre o total.
//
// Achado Minor 1 da revisão de conformidade (2026-08-26). livro:1963:
// "Jogue esse dado, adicione seu modificador de Constituição ao resultado
// e some o total (MÍNIMO DE 1) aos seus Pontos de Vida máximos" -- a
// frase descreve UM nível, então o piso vale a cada nível. calcPVMulticlasse
// aplicava `Math.max(1, pv)` só no fim: com Constituição muito baixa, os
// níveis negativos comiam os positivos e o resultado desabava para 1.
//
// Isso NÃO era regressão do multiclasse -- calcPVTotal, o antecessor, não
// tinha piso nenhum e devolvia número negativo. Mas divergia de
// pvGanhoAoSubir (regras-multiclasse-progressao.js), que aplica o piso nos
// três ramos, e de levelup.js:350/:368. Duas fichas com os MESMOS níveis
// terminavam com PV diferente conforme o caminho que as produziu.
//
// Constituição 1 (mod −5) é o caso extremo legal: o valor mínimo que a
// ficha aceita. Os literais abaixo saem da regra, não da implementação.
test('PV: o piso de 1 vale por nível, e concorda com pvGanhoAoSubir', () => {
  // Feiticeiro 5, d6, CON 1 (mod −5).
  //   nível 1: max(1, 6 − 5) = 1
  //   níveis 2-5: max(1, 4 − 5) = 1 cada  -> 4
  // Total 5. Com o piso só no fim: 1 + 4×(−1) = −3 -> 1.
  const feiticeiro = { classes: [{ classe: 'Feiticeiro', nivel: 5, ordem: 0 }] };
  assert.equal(utils.calcPVMulticlasse(feiticeiro, -5), 5,
    'Feiticeiro 5 com CON 1 tem 5 PV (1 por nível), não 1');

  // Multiclasse, dados diferentes: Mago 3 (d6) / Bárbaro 2 (d12), CON 1.
  //   nível 1 (Mago): max(1, 6 − 5) = 1
  //   Mago 2-3:       max(1, 4 − 5) = 1 cada -> 2
  //   Bárbaro 1-2:    max(1, 7 − 5) = 2 cada -> 4
  // Total 7. Com o piso só no fim: 1 − 2 + 4 = 3.
  const magoBarbaro = {
    classes: [
      { classe: 'Mago', nivel: 3, ordem: 0 },
      { classe: 'Bárbaro', nivel: 2, ordem: 1 },
    ],
  };
  assert.equal(utils.calcPVMulticlasse(magoBarbaro, -5), 7,
    'o piso é aplicado por nível em CADA classe, não uma vez no total');

  // Constituição normal não pode mudar: o piso não é para inflar ninguém.
  // Mago 3/Bárbaro 2 com mod +2 -> 8 + 2×6 + 2×9 = 8 + 12 + 18... conferido
  // pela referência do harness, não recalculado aqui.
  const normal = { classes: magoBarbaro.classes };
  assert.equal(utils.calcPVMulticlasse(normal, 2), 8 + 2 * 6 + 2 * 9,
    'com CON 14 o resultado é o de sempre -- nenhum termo chega ao piso');
});

// ORÁCULO 3c -- calcPVMulticlasse concorda com a soma de pvGanhoAoSubir.
//
// As duas funções respondem à MESMA pergunta por caminhos diferentes:
// calcPVMulticlasse recalcula uma ficha pronta de uma vez; pvGanhoAoSubir
// entrega o ganho de UM nível durante a subida. Divergir entre elas
// significa que o PV de um personagem depende de como ele foi criado --
// e a divergência real (o piso) só aparecia com Constituição baixa, que
// nenhum oráculo exercitava.
test('PV: recálculo de uma vez == soma nível a nível, inclusive com CON baixa', () => {
  const { multiclasseProgressao: mp } = mods;
  const divergencias = [];

  const roteiros = [
    [['Mago', 3], ['Bárbaro', 2]],
    [['Bárbaro', 5], ['Mago', 5]],
    [['Clérigo', 1], ['Guerreiro', 1], ['Ladino', 1]],
    [['Feiticeiro', 5]],
  ];
  // 1 (mod −5) é o extremo; 8 (−1) ainda produz níveis negativos em d6;
  // 14 (+2) é o caso comum, onde nada muda.
  for (const constituicao of [1, 8, 14]) {
    for (const roteiro of roteiros) {
      // Sobe nível a nível com o escritor real, acumulando o ganho.
      const emConstrucao = { atributos: { constituicao }, classes: [] };
      let somaPorNivel = 0;
      for (const [classe, niveis] of roteiro) {
        for (let i = 0; i < niveis; i++) {
          somaPorNivel += mp.pvGanhoAoSubir(emConstrucao, classe);
          const existente = emConstrucao.classes.find((c) => c.classe === classe);
          if (existente) existente.nivel += 1;
          else emConstrucao.classes.push({ classe, nivel: 1, ordem: emConstrucao.classes.length });
        }
      }
      const deUmaVez = utils.calcPVMulticlasse(
        { classes: emConstrucao.classes }, Math.floor((constituicao - 10) / 2));
      if (deUmaVez !== somaPorNivel) {
        const rotulo = roteiro.map(([c, n]) => `${c} ${n}`).join('/');
        divergencias.push(`CON ${constituicao} ${rotulo}: de uma vez ${deUmaVez}, nível a nível ${somaPorNivel}`);
      }
    }
  }
  assert.deepEqual(divergencias, [],
    'os dois caminhos de PV têm de dar o mesmo número em qualquer Constituição');
});

// ORÁCULO 4 -- as reservas batem com o exemplo LITERAL do livro.
//
// Os dois exemplos de livro:2043, um de cada lado da regra: Guerreiro
// 5/Paladino 5 COMBINA (dez d10, uma reserva só) e Clérigo 5/Paladino 5
// SEPARA (cinco d8 e cinco d10). Uma implementação que sempre separe
// passa no segundo e falha no primeiro; uma que sempre combine, o
// inverso. Os dois juntos não deixam passar nenhuma das duas.
test('dados de vida: reservas por tipo, como o livro exemplifica', async () => {
  const { multiclasse } = mods;
  const combina = multiclasse.reservasDadosVida(
    await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }, { classe: 'Paladino', nivel: 5 }]));
  assert.deepEqual(combina.map((r) => [r.faces, r.total]), [[10, 10]],
    'Guerreiro 5/Paladino 5: dez dados d10 numa reserva só (livro:2043)');

  const separa = multiclasse.reservasDadosVida(
    await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Paladino', nivel: 5 }]));
  assert.deepEqual(separa.map((r) => [r.faces, r.total]), [[10, 5], [8, 5]],
    'Clérigo 5/Paladino 5: cinco d8 e cinco d10, separados (livro:2043)');

  const unica = multiclasse.reservasDadosVida(
    await personagemMulticlasse([{ classe: 'Mago', nivel: 10 }]));
  assert.deepEqual(unica.map((r) => [r.faces, r.total]), [[6, 10]],
    'classe única: uma reserva, dez d6 -- a tela não pode mudar');
});

// ORÁCULO 5 -- O ACHADO CENTRAL: o gasto sobrevive à sincronização.
//
// Este é o roteiro exato que MEDIU a perda no mapeamento. Sem
// gastarDadosVida, o gasto ia para o escalar, a reserva ficava em 0, e
// sincronizarEspelhos recomputava o escalar como a soma das reservas --
// zero. O par Mago/Bárbaro é d6+d12: DUAS reservas, que é a condição
// necessária da perda. O controle de classe única prova que o caminho de
// uma reserva só continua funcionando.
test('dados de vida: o gasto sobrevive a sincronizarEspelhos', async () => {
  const { multiclasse } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }]);

  const gasto = multiclasse.gastarDadosVida(p, 12, 3);
  assert.equal(gasto, 3, 'gastou 3 dados d12 do Bárbaro');

  multiclasse.sincronizarEspelhos(p);

  const depois = multiclasse.reservasDadosVida(p);
  const d12 = depois.find((r) => r.faces === 12);
  const d6 = depois.find((r) => r.faces === 6);
  assert.equal(d12.usados, 3,
    'o gasto de d12 foi PERDIDO na sincronização -- era exatamente este o defeito ' +
    'que o sub-projeto 5 ia acionar ao fazer a subida escrever em classes[].');
  assert.equal(d12.disponiveis, 2, 'restam 2 d12');
  assert.equal(d6.usados, 0, 'a reserva de d6 do Mago não foi tocada');
  assert.equal(p.dados_vida_usados, 3, 'o escalar legado acompanha a soma');
});

// ORÁCULO 6 -- o gasto sai da reserva CERTA.
//
// Sem este, uma implementação que sempre debite da PRIMEIRA reserva
// passaria no oráculo 5 (que só gasta d12, a primeira na ordem
// decrescente). Aqui o pedido é de d6, a SEGUNDA -- e a asserção mede as
// duas reservas, não só a alvo.
test('dados de vida: o gasto sai da reserva pedida, não da primeira', async () => {
  const { multiclasse } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }]);
  multiclasse.gastarDadosVida(p, 6, 2);
  const r = multiclasse.reservasDadosVida(p);
  assert.equal(r.find((x) => x.faces === 6).usados, 2, 'd6 (Mago) debitado');
  assert.equal(r.find((x) => x.faces === 12).usados, 0, 'd12 (Bárbaro) INTACTO');
});

// ORÁCULO 7 -- saturação e tipo inexistente.
test('dados de vida: gasto satura no disponível e ignora tipo ausente', async () => {
  const { multiclasse } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }]);
  assert.equal(multiclasse.gastarDadosVida(p, 12, 99), 5, 'satura nos 5 disponíveis');
  assert.equal(multiclasse.gastarDadosVida(p, 12, 1), 0, 'reserva esgotada devolve 0');
  assert.equal(multiclasse.gastarDadosVida(p, 8, 1), 0, 'tipo d8 não existe neste personagem');
});

// ORÁCULO 8 -- o Descanso Longo devolve TODOS (Regras.md:379).
//
// Gasta dos DOIS tipos antes de restaurar: uma implementação que zere só
// a primeira reserva passaria se o gasto fosse de um tipo só.
test('dados de vida: o Descanso Longo devolve todos os dados de todos os tipos', async () => {
  const { multiclasse } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }]);
  multiclasse.gastarDadosVida(p, 12, 3);
  multiclasse.gastarDadosVida(p, 6, 2);
  multiclasse.restaurarTodosDadosVida(p);
  const r = multiclasse.reservasDadosVida(p);
  assert.deepEqual(r.map((x) => x.usados), [0, 0], 'as duas reservas voltaram cheias');
  assert.equal(p.dados_vida_usados, 0, 'o escalar legado acompanha');
});

// ORÁCULO 9 -- o escalar legado LIDERA numa ficha de UMA reserva só
// (achado do revisor da Task 2, Critical).
//
// Roteiro: personagem de classe única, já sincronizado (estruturado e
// escalar concordam em usados=0); então simula exatamente o que
// hp-descanso.js faz hoje entre duas sincronizações -- escreve SÓ o
// escalar (`p.dados_vida_usados = 3`), sem tocar no estruturado. Uma
// implementação que leia só `p.dados_vida[faces].usados` (o defeito
// medido) vê 0 onde o jogador já gastou 3; o fixture parte de usados=0 no
// estruturado e usados=3 no escalar exatamente para separar as duas: se o
// fixture partisse de usados=0 nos dois, a implementação errada acertaria
// por coincidência.
test('dados de vida: o escalar legado lidera quando há uma reserva só', async () => {
  const { multiclasse } = mods;
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  assert.equal(p.dados_vida_usados, 0, 'controle: recém-sincronizado, os dois concordam em 0');

  // hp-descanso.js grava só o escalar -- o estruturado fica para trás.
  p.dados_vida_usados = 3;

  const antes = multiclasse.reservasDadosVida(p);
  assert.equal(antes.length, 1, 'classe única: uma reserva só');
  assert.equal(antes[0].usados, 3,
    'o escalar (3) tem de liderar sobre o estruturado (0), que ficou para trás');

  const gasto = multiclasse.gastarDadosVida(p, 10, 1);
  assert.equal(gasto, 1, 'gastou 1 d10 a mais');
  assert.equal(p.dados_vida_usados, 4,
    'o gasto acumula sobre os 3 que já havia -- não parte do zero do estruturado velho');
});

// ORÁCULO 10 -- restaurarTodosDadosVida preserva o TOTAL quando nenhuma
// classe resolve, mas ainda assim ZERA o gasto (achado do revisor da
// Task 2, Important; comportamento do gasto ajustado pelo Ruling 9 da
// revisão da Tarefa 3 -- a versão anterior deste oráculo exigia que o
// gasto TAMBÉM sobrevivesse, e essa era a parte que o Ruling 9 corrigiu).
//
// A classe é corrompida para a forma Unicode DECOMPOSTA (o mesmo caso que
// o comentário de sincronizarEspelhos já nomeia como alcançável), então
// nenhuma bate com as chaves de CLASSES_INFO (que usam a forma composta)
// e reservasDadosVida(p) devolve []. Uma implementação sem guarda nenhuma
// sobrescreve com soma vazia (total=0, usados=0, dados_vida={}); o
// fixture parte de um total e um gasto pré-existentes NÃO NULOS
// (total=5, usados=3) para que a asserção separe as duas: se partisse de
// 0, uma implementação errada acertaria por coincidência.
//
// Os dois campos se comportam DIFERENTE, e é essa assimetria que este
// oráculo prende: `Regras.md:379` é incondicional -- "Você recupera...
// todos os Dados de Vida gastos" -- zerar `usados` não depende de saber o
// TIPO do dado, então não depende do catálogo resolver a classe.
// `dados_vida_total`, esse sim, não pode ser recalculado sem o catálogo
// (é por isso que a guarda de reserva vazia de gravarReservas() existe),
// e por isso -- e só ele, junto com o objeto estruturado `dados_vida`,
// que não há como saber reescrever sem resolver as classes -- sobrevive
// intocado.
test('dados de vida: Descanso Longo sem classe resolvível ainda zera o gasto, mas preserva o total', async () => {
  const { multiclasse } = mods;
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }]);
  p.dados_vida = { 8: { total: 5, usados: 3 } };
  p.dados_vida_total = 5;
  p.dados_vida_usados = 3;
  // Corrompe o nome da classe para a forma Unicode decomposta.
  p.classes[0].classe = 'Clérigo'.normalize('NFD');

  multiclasse.restaurarTodosDadosVida(p);

  assert.equal(p.dados_vida_total, 5,
    'o total NÃO pode ser destruído só porque a classe não resolveu contra o catálogo -- não há como recalculá-lo sem o catálogo');
  assert.equal(p.dados_vida_usados, 0,
    'o gasto TEM de zerar mesmo sem reserva computável -- Regras.md:379 é incondicional, não depende de saber o tipo do dado');
  assert.deepEqual(p.dados_vida, { 8: { total: 5, usados: 3 } },
    'o estruturado (por tipo) não é sobrescrito às cegas -- só o escalar de soma zera');
});

// ============================================================
// Helpers de render (Tarefa 3, sub-projeto 3e). Mesmo padrão dos helpers
// de multiclasse-combate.test.mjs (criarContainerStub, prepararEstadoDaFicha,
// renderizarFicha) -- duplicados aqui porque aquele arquivo não os
// exporta; nenhum mecanismo novo, só o mesmo modelado de novo neste
// arquivo, como pede o brief da Tarefa 3.
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
 * Deixa o estado de sheet/estado.js apontando para `p`, como pages/sheet.js
 * faz ao abrir a ficha -- o mínimo que renderFichaCompleta() precisa para
 * rodar sem lançar.
 * @param {object} p Personagem já montado.
 * @param {object} container Stub de container da ficha.
 * @returns {Promise<void>}
 */
async function prepararEstadoDaFicha(p, container) {
  const { sheetEstado, db, levelup, contextoClasse } = mods;

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
  // Pela MESMA função que pages/sheet.js usa (por classe, no nível dela),
  // e não pelos espelhos -- ver multiclasse-magias.test.mjs, Oráculo 26.
  const magiasAutomaticas = await levelup.obterMagiasAutomaticasDoPersonagem(p);
  sheetEstado.definirMagiasDominio(magiasAutomaticas.dominio);
  sheetEstado.definirMagiasSempre(magiasAutomaticas.sempre);
}

/**
 * Roda renderFichaCompleta() de verdade sobre o personagem e devolve o
 * HTML que a ficha produziu. Mede o RENDER, não uma reimplementação da
 * condição dentro do teste.
 * @param {object} p Personagem já montado.
 * @returns {Promise<string>} HTML da ficha.
 */
async function renderizarFicha(p) {
  const { sheetFicha } = mods;
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);
  sheetFicha.renderFichaCompleta();
  return container.innerHTML;
}

// modulosApp() (harness.mjs:90) não tem uma chave para sheet/impressao.js
// -- nenhum motor anterior precisou dele. Carregado sob demanda pelo mesmo
// padrão que harness.mjs usa para todo módulo do app (pathToFileURL +
// resolve contra RAIZ), em cache para não reimportar a cada chamada.
let _impressaoMod = null;
async function carregarImpressao() {
  if (!_impressaoMod) {
    _impressaoMod = await import(
      pathToFileURL(resolve(RAIZ, 'site/js/sheet/impressao.js')).href);
  }
  return _impressaoMod;
}

/**
 * Roda gerarHtmlImpressao() de verdade (site/js/sheet/impressao.js) sobre
 * o personagem e devolve o HTML de impressão. Assinatura real:
 * `export async function gerarHtmlImpressao()` -- sem parâmetro, lê o
 * `char` global de sheet/estado.js, o mesmo padrão de renderFichaCompleta
 * (ver renderizarFicha acima); por isso reusa prepararEstadoDaFicha para
 * deixar o estado apontando para `p` antes de chamar.
 * @param {object} p Personagem já montado.
 * @returns {Promise<string>} HTML de impressão.
 */
async function renderizarImpressao(p) {
  const impressao = await carregarImpressao();
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);
  return impressao.gerarHtmlImpressao();
}

/**
 * Extrai o bloco da caixa "Dados de Vida" (ficha.js, div.hp-dv-box) do
 * HTML da ficha: do início da div até o botão "Usar DV" que sempre a
 * fecha -- evita ter que casar aninhamento de `</div>` para achar o fim
 * exato do bloco (a caixa tem uma `<div class="hp-sub-value">` aninhada
 * antes do botão, então um `[\s\S]*?<\/div>` não-guloso pararia nela, não
 * no fim da caixa). Lança se não achar: um extrator que devolve string
 * vazia faria os dois oráculos abaixo passarem sobre nada.
 * @param {string} html HTML completo da ficha.
 * @returns {string} Trecho da caixa de Dados de Vida.
 */
function trechoDaCaixaDadosVida(html) {
  const m = html.match(/<div class="hp-sub-box hp-dv-box">[\s\S]*?id="btn-usar-dv"/);
  if (!m) throw new Error('trechoDaCaixaDadosVida: bloco hp-dv-box não encontrado no HTML da ficha');
  return m[0];
}

/**
 * Extrai as LINHAS da caixa "Dados de Vida" (ficha.js, `.hp-sub-value`),
 * uma string por reserva, na mesma ordem em que reservasDadosVida as
 * devolve (faces DECRESCENTE). Achado da revisão da Tarefa 3 (Important
 * 2): os oráculos antigos casavam com `.match(/.../s)`, que atravessa
 * `<br>` -- "5 / 5" da linha do d12 mais um "d6" mais adiante satisfaziam
 * a asserção do d6 sem que as duas viessem da MESMA linha. Quebrar em
 * linhas de verdade e comparar cada uma isoladamente fecha essa brecha.
 * Lança se não achar `.hp-sub-value`, pelo mesmo motivo de
 * trechoDaCaixaDadosVida: uma lista vazia faria os oráculos passarem
 * sobre nada.
 * @param {string} html HTML completo da ficha.
 * @returns {string[]} uma linha por reserva.
 */
function linhasDaCaixaDadosVida(html) {
  const caixa = trechoDaCaixaDadosVida(html);
  const m = caixa.match(/<div class="hp-sub-value">([\s\S]*?)<\/div>/);
  if (!m) throw new Error('linhasDaCaixaDadosVida: hp-sub-value não encontrado no HTML da ficha');
  return m[1].split('<br>');
}

/**
 * Extrai o trecho do cabeçalho da ficha (ficha.js, a linha
 * "Espécie Classe(s) · Nível N" logo abaixo do nome) -- do fim do `<h2
 * id="char-nome-display">` até o `</div>` que fecha essa linha. Mesmo
 * contrato de trechoDaCaixaDadosVida/linhasDaCaixaDadosVida (Tarefa 3):
 * lança se não achar a âncora, porque um extrator que devolva string
 * vazia faria os oráculos de cabeçalho passarem sobre nada.
 * @param {string} html HTML completo da ficha.
 * @returns {string} Trecho do cabeçalho (espécie, classes e nível).
 */
function trechoDoCabecalho(html) {
  const m = html.match(/id="char-nome-display">[\s\S]*?<div style="font-size:0\.9rem;color:var\(--text-muted\)">([\s\S]*?)<\/div>/);
  if (!m) throw new Error('trechoDoCabecalho: bloco do cabeçalho não encontrado no HTML da ficha');
  return m[1];
}

// ORÁCULO 11 -- a caixa de Dados de Vida na TELA. Numerado 11 (não 9, como
// o brief original previa) porque a revisão da Tarefa 2 acrescentou dois
// oráculos extras (9 e 10, acima) que não existiam quando o brief foi
// escrito.
//
// Guarda estático não pega este defeito: reverter para o literal do dado
// da classe inicial não reintroduz espelho nenhum se alguém escrever
// `d6` cravado. Por isso o oráculo RENDERIZA e lê o número da tela.
//
// Achado da revisão (Important 2): a versão original montava o
// personagem RECÉM-CRIADO, com disponiveis === total nas duas reservas --
// um render que imprimisse `${r.total} / ${r.total}`, ou que ignorasse
// `usados` por completo, passava do mesmo jeito ("qual implementação
// errada sobreviveria a este caso?" não tinha resposta "nenhuma"). Gastar
// ANTES de renderizar, e exigir o número CERTO por linha, fecha isso; e
// como o gasto sai só do d12, também separa um render que debite a
// reserva errada -- a linha do d6 tem de continuar intocada.
test('tela: a caixa de Dados de Vida mostra uma linha por reserva', async () => {
  const { multiclasse } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }]);
  multiclasse.gastarDadosVida(p, 12, 1);
  const html = await renderizarFicha(p);
  const linhas = linhasDaCaixaDadosVida(html);
  assert.equal(linhas.length, 2, 'duas reservas -> duas linhas');
  assert.match(linhas[0], /^4 \/ 5 .*d12/,
    'faces DECRESCENTE: a reserva de d12 do Bárbaro vem primeiro, com o gasto refletido (4/5)');
  assert.match(linhas[1], /^5 \/ 5 .*d6/,
    'a reserva de d6 do Mago não foi tocada -- tem de continuar cheia (5/5)');
});

// ORÁCULO 12 -- CANÁRIO de classe única: a tela não pode mudar. Também
// gasta antes de renderizar, pelo mesmo motivo do Oráculo 11 -- sem
// gasto, um render que ignorasse `usados` passaria aqui também.
test('tela: classe única continua com uma linha só de Dados de Vida', async () => {
  const { multiclasse } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 10 }]);
  multiclasse.gastarDadosVida(p, 6, 3);
  const html = await renderizarFicha(p);
  const linhas = linhasDaCaixaDadosVida(html);
  assert.equal(linhas.length, 1, 'com uma reserva só não há segunda linha');
  assert.match(linhas[0], /^7 \/ 10 .*d6/, '3 dados gastos de 10: sobram 7');
});

// ============================================================
// Helpers de DOM falso (revisão da Tarefa 3, Important 1). Mesmo padrão
// de `elementoFalso`/registro que multiclasse-combate.test.mjs usa para
// disparar o clique de #btn-descanso-longo (ver `dispararDescansoLongo`
// naquele arquivo) -- duplicado aqui pelo mesmo motivo dos helpers de
// render acima: aquele arquivo não os exporta.
// ============================================================

/**
 * Elemento de DOM falso: o mínimo que utils.abrirModal/toast e os
 * `addEventListener` de setupEventosHP/setupEventosDescanso tocam. Guarda
 * os handlers registrados em `handlers`, para o teste poder DISPARAR o
 * clique/troca, e o que for escrito em `innerHTML`, para o teste LER o
 * que o handler re-renderizou.
 * @param {string} id
 * @returns {object}
 */
function elementoFalso(id) {
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
 * Instala um `document` falso (registro id -> elementoFalso, criado sob
 * demanda) para o teste poder achar/disparar handlers e ler o que foi
 * escrito em `.innerHTML`. `restaurar()` devolve o `document` original --
 * chamar SEMPRE, mesmo em caminho de erro (try/finally no chamador).
 * @returns {{registro: Map<string,object>, restaurar: () => void}}
 */
function instalarDocumentoFalso() {
  const registro = new Map();
  const docOriginal = globalThis.document;
  const setTimeoutOriginal = globalThis.setTimeout;
  // toast() (utils.js) cria um setTimeout de 3s; sem unref() o processo de
  // teste ficaria vivo esperando cada toast.
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

// ORÁCULO 13 -- o retetar do picker numérico ao trocar de reserva
// (Important 1 da revisão da Tarefa 3: nenhum oráculo de unidade
// exercitava o handler de troca -- `change` no `<select
// id="select-tipo-dv">` -- e foi por isso que o defeito passou
// despercebido).
//
// O defeito: `campo.max = String(r.disponiveis)` grava uma propriedade
// que ninguém lê -- o campo oculto que numberPickerHtml gera carrega
// `data-max` (não `max`); setupNumberPicker lê esse `data-max` UMA VEZ,
// para dentro do closure dos listeners de scroll/digitação; o campo
// visível "-manual" tem o próprio `max` renderizado uma vez; e a lista de
// itens do picker é construída uma vez -- todos para a reserva INICIAL.
//
// Clérigo 5/Paladino 3 é o par que separa: reservasDadosVida ordena por
// faces DECRESCENTE, então a reserva inicial é o d10 do Paladino (3
// disponíveis) -- o MAIOR DADO, não a maior QUANTIDADE. Trocar para o d8
// do Clérigo (5 disponíveis) tem de reescrever o teto do picker para 5;
// a implementação antiga deixava o teto travado em 3, com dois dados que
// o jogador possui inalcançáveis pelos dois modais.
test('handler: trocar de reserva reescreve o teto do picker numérico', async () => {
  const { sheetHpDescanso } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Paladino', nivel: 3 },
  ]);
  await prepararEstadoDaFicha(p, criarContainerStub());

  const { registro, restaurar } = instalarDocumentoFalso();
  try {
    sheetHpDescanso.setupEventosHP();
    const cliques = registro.get('btn-usar-dv')?.handlers?.click || [];
    assert.equal(cliques.length, 1, 'setupEventosHP tem de registrar UM clique em #btn-usar-dv');
    cliques[0]({ stopPropagation() {}, preventDefault() {} });

    const selectTipo = registro.get('select-tipo-dv');
    const trocas = selectTipo?.handlers?.change || [];
    assert.equal(trocas.length, 1,
      'o clique tem de registrar UM listener de troca em #select-tipo-dv');

    // Escolhe a reserva de d8 (Clérigo, 5 disponíveis) -- NÃO é a inicial
    // (d10 do Paladino, 3 disponíveis).
    selectTipo.value = '8';
    trocas[0]();

    const slot = registro.get('input-qtd-dv-picker-slot');
    assert.ok(slot?.innerHTML,
      'trocar de reserva tem de RE-RENDERIZAR o wrapper do picker (id "input-qtd-dv-picker-slot")');
    assert.match(slot.innerHTML, /id="input-qtd-dv-val"[^>]*data-max="5"/,
      'o campo oculto tem de carregar data-max="5" (disponível do d8), não 3 (o d10 inicial)');
    assert.match(slot.innerHTML, /id="input-qtd-dv-manual"[\s\S]*?max="5"/,
      'o campo visível "-manual" também tem de refletir o teto novo (5)');
  } finally {
    restaurar();
  }
});

// ORÁCULO 14 -- o cabeçalho mostra todas as classes. Numerado 14 (não 11,
// como o brief original previa) porque a Tarefa 3 já gastou 11, 12 e 13
// neste mesmo arquivo.
//
// Mago 5/Bárbaro 5: o defeito mostrava "Mago" e nada do Bárbaro. A
// asserção mede as DUAS classes e o nível TOTAL, porque uma implementação
// que mostre só a segunda classe também seria errada.
test('tela: o cabeçalho nomeia todas as classes', async () => {
  const html = await renderizarFicha(
    await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }]));
  const cab = trechoDoCabecalho(html);
  assert.match(cab, /Mago 5/, 'a classe inicial e o nível NELA');
  assert.match(cab, /Bárbaro 5/, 'a segunda classe -- era ela que sumia');
  assert.match(cab, /Nível 10/, 'o nível de PERSONAGEM continua sendo o total (livro:2037)');
});

// ORÁCULO 15 -- CANÁRIO: classe única não ganha número na classe.
test('tela: o cabeçalho de classe única não mudou', async () => {
  const cab = trechoDoCabecalho(
    await renderizarFicha(await personagemMulticlasse([{ classe: 'Mago', nivel: 10 }])));
  assert.match(cab, /Mago .*Nível 10/s);
  assert.doesNotMatch(cab, /Mago 10/,
    'com uma classe só o texto é o de sempre -- "Mago · Nível 10", sem o nível na classe');
});

// ORÁCULO 16 -- a rede de recálculo de PV usa a fórmula multiclasse.
//
// Medido antes de escrever este oráculo: renderizarFicha() de fato
// dispara a rede sob o harness. `char` (sheet/estado.js) é a MESMA
// referência que `personagemMulticlasse` devolve -- definirChar(p) faz
// `char = p`, não uma cópia -- e salvar() chama salvarPersonagem(char),
// que só toca localStorage (stub do harness) e enfileirarSync(), que
// retorna cedo porque getUsuario() não tem usuário logado no harness. Nada
// aí lança nem depende de rede de verdade, então o `if (char.pv_max <= 0)`
// roda e grava de volta no `p` que o teste segura.
//
// Renderiza uma ficha com pv_max = 0 (o gatilho da rede) e mede o valor
// que ela gravou. O defeito antigo gravava 62; o certo é 77.
test('tela: a rede de recálculo de PV usa a fórmula multiclasse', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }]);
  p.pv_max = 0;
  p.pv_atual = 0;
  await renderizarFicha(p);
  assert.equal(p.pv_max, 77,
    'a rede gravou o PV com UM dado de vida x nível total (62) em vez da fórmula ' +
    'por classe (77) -- livro:2039-2041');
});

/**
 * Instala `p` como o personagem ativo da ficha (sheetEstado.definirChar --
 * o mesmo mecanismo que multiclasse-combate.test.mjs usa para expor um
 * personagem ao `char` global de sheet/estado.js), chama
 * sincronizarBonusPvDraconico() PELO CAMINHO REAL e devolve o bônus que
 * ela gravou. Oráculo de UNIDADE, não de render: `char` é um live
 * binding do módulo ES -- definirChar(p) muda o valor que hp-descanso.js
 * enxerga, sem precisar renderizar a ficha inteira.
 * @param {object} p Personagem já montado (personagemMulticlasse).
 * @returns {Promise<number>} bônus gravado em
 *   recursos.feiticeiro.subclasses.draconica.bonus_pv_aplicado.
 */
async function bonusPvDraconicoDe(p) {
  const { sheetEstado, sheetHpDescanso } = mods;
  sheetEstado.definirChar(p);
  sheetHpDescanso.sincronizarBonusPvDraconico();
  return p.recursos?.feiticeiro?.subclasses?.draconica?.bonus_pv_aplicado || 0;
}

// ORÁCULO 17 -- Resiliência Dracônica: fonte e fórmula. Numerado a partir de
// 17 porque a Tarefa 3 já gastou 11-13 e a Tarefa 4 gastou 14-16 neste
// mesmo arquivo.
//
// Os cinco casos separam TRÊS implementações erradas diferentes:
//   - Mago 5/Feiticeiro 5 vale 5 e o defeito de FONTE dava 0 -- o bônus
//     SOME inteiro, porque char.subclasse é a do Mago ("").
//   - Feiticeiro 5/Mago 5 vale 5 e o defeito de FONTE dava 12 -- usa o
//     nível TOTAL (char.nivel = 10) em vez do nível NA classe.
//   - Feiticeiro 5 de classe única vale 5 e o defeito de FÓRMULA dava 7
//     -- nivelFeiticeiro + 2 em vez de nivelFeiticeiro.
//   - Feiticeiro 7 de classe única vale 7. Este caso é o que de fato prova
//     a correção de FÓRMULA: os quatro fixtures acima e abaixo usam todos
//     nível 5 de Feiticeiro, então um retrocesso para o LITERAL `5` (em
//     vez de `nivelFeiticeiro`) sobreviveria a eles sem ser percebido --
//     achado da revisão final do sub-projeto. Nível 7 separa fórmula de
//     literal (e é a única mudança de classe única declarada no
//     sub-projeto, nota de versão 2.2.21).
//   - Feiticeiro 2 mede o portão do nível 3: zero, não negativo.
//   - Feiticeiro 5 de Feitiçaria Selvagem mede que o bônus não vaza para
//     quem não é Dracônico.
//
// Achado da revisão da Task 5: `assert.equal` DENTRO do laço falha rápido no
// primeiro desencontro -- sob a mutação da fórmula, o caso 0 (Mago/Feiticeiro)
// já diverge (7 ≠ 5) e o laço aborta ali, então "qual caso caiu" nunca chega a
// medir o caso de classe única (índice 2), que é o que a mutação de fórmula
// deveria expor. Coletar TODOS os desencontros antes de assertar torna a
// atribuição por caso uma medição de verdade, não um artefato da ORDEM dos
// fixtures.
test('Resiliência Dracônica: +N no nível N de Feiticeiro, não N+2 do total', async () => {
  const casos = [
    { roteiro: [{ classe: 'Mago', nivel: 5 }, { classe: 'Feiticeiro', nivel: 5, subclasse: 'Feitiçaria Dracônica' }], esperado: 5 },
    { roteiro: [{ classe: 'Feiticeiro', nivel: 5, subclasse: 'Feitiçaria Dracônica' }, { classe: 'Mago', nivel: 5 }], esperado: 5 },
    { roteiro: [{ classe: 'Feiticeiro', nivel: 5, subclasse: 'Feitiçaria Dracônica' }], esperado: 5 },
    { roteiro: [{ classe: 'Feiticeiro', nivel: 7, subclasse: 'Feitiçaria Dracônica' }], esperado: 7 },
    { roteiro: [{ classe: 'Feiticeiro', nivel: 2, subclasse: 'Feitiçaria Dracônica' }], esperado: 0 },
    { roteiro: [{ classe: 'Feiticeiro', nivel: 5, subclasse: 'Feitiçaria Selvagem' }], esperado: 0 },
  ];
  const divergencias = [];
  for (const { roteiro, esperado } of casos) {
    const p = await personagemMulticlasse(roteiro);
    const rotulo = roteiro.map((r) => `${r.classe} ${r.nivel}`).join('/');
    const obtido = await bonusPvDraconicoDe(p);
    if (obtido !== esperado) {
      divergencias.push(`${rotulo}: esperado ${esperado}, veio ${obtido}`);
    }
  }
  assert.deepEqual(divergencias, [], `bônus de PV divergiu em: ${divergencias.join(' | ')}`);
});

/**
 * Instala `p` como `char` (mesmo mecanismo de bonusPvDraconicoDe acima),
 * carrega o dado REAL de cada classe do roteiro em `classesData`
 * (contextoClasse.montarContextos + db.getClasse, o mesmo par que
 * prepararEstadoDaFicha usa) e popula `char.usos_habilidades` com TODAS as
 * chaves de característica de classe/subclasse do personagem marcadas
 * como gastas (`true`) -- para medir quais delas voltam a `false`/`0`
 * depois do descanso, não só quais aparecem no mapa.
 *
 * `restaurarHabilidades` é exportada (hp-descanso.js) especificamente para
 * este helper poder chamá-la direto, sem depender do clique de um botão de
 * DOM: é a mudança mínima para tornar a função testável em isolamento, e
 * sincronizarBonusPvDraconico (Tarefa 4) já é exportada pelo mesmo motivo.
 *
 * @param {object} p Personagem já montado (personagemMulticlasse).
 * @param {'curto'|'longo'} tipo
 * @returns {Promise<string[]>} chaves de char.usos_habilidades que
 *   voltaram a `false`/`0` -- as que o descanso efetivamente restaurou.
 */
async function chavesRestauradasNoDescanso(p, tipo) {
  const { sheetEstado, sheetHpDescanso, contextoClasse, db } = mods;

  const mapaClasses = new Map();
  for (const ctx of contextoClasse.montarContextos(p, new Map())) {
    mapaClasses.set(ctx.classe, await db.getClasse(ctx.classe));
  }
  sheetEstado.definirChar(p);
  sheetEstado.definirClassesData(mapaClasses);
  sheetEstado.definirClasseData(mapaClasses.get(p.classe) || null);

  p.usos_habilidades = {};
  for (const ctx of contextoClasse.montarContextos(p, mapaClasses)) {
    if (!ctx.dados) continue;
    (ctx.dados.caracteristicas || []).forEach((f) => {
      p.usos_habilidades[`classe_${f.nome}`] = true;
    });
    const sc = (ctx.dados.subclasses || []).find((s) => s.nome === ctx.subclasse);
    (sc?.caracteristicas || []).forEach((f) => {
      p.usos_habilidades[`subclasse_${f.nome}`] = true;
    });
  }

  sheetHpDescanso.restaurarHabilidades(tipo);

  return Object.entries(p.usos_habilidades)
    .filter(([, v]) => v === false || v === 0)
    .map(([k]) => k);
}

// ORÁCULO 18 -- restaurarHabilidades vê as duas classes. Numerado a partir
// de 18 porque a Tarefa 3 já gastou 11-13, a Tarefa 4 gastou 14-16 e a
// Tarefa 5 gastou 17 neste mesmo arquivo.
//
// Bárbaro 2/Guerreiro 3 é o fixture do mapeamento: o app restaurava 1
// característica e o livro manda restaurar 3. A asserção mede as DUAS
// características do Guerreiro pelo nome, não a contagem -- uma contagem
// deixaria passar uma implementação que restaure três coisas erradas.
test('restaurarHabilidades: as características da segunda classe recarregam', async () => {
  const chaves = await chavesRestauradasNoDescanso(
    await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 2 }, { classe: 'Guerreiro', nivel: 3 }]),
    'curto');
  assert.ok(chaves.some((k) => /Fúria/i.test(k)), 'Fúria (Bárbaro, classe inicial)');
  assert.ok(chaves.some((k) => /Recuperar Fôlego/i.test(k)),
    'Recuperar Fôlego (Guerreiro 1) -- nunca recarregava');
  assert.ok(chaves.some((k) => /Surto de Ação/i.test(k)),
    'Surto de Ação (Guerreiro 2) -- nunca recarregava');
});

// ORÁCULO 19 -- o gate é o nível NA CLASSE, não o total.
//
// O brief original media isso com Ataque Extra (Guerreiro 5) num Bárbaro
// 2/Guerreiro 3 (total 5): "se o filtro usasse o total, Ataque Extra
// entraria na coleta". MEDIDO no catálogo (dados/classes/guerreiro.json):
// a descrição de Ataque Extra não menciona descanso nenhum --
// detectarRecarga(descricao) devolve null INDEPENDENTE do nível aceito, e
// o laço de restaurarHabilidades descarta toda característica sem recarga
// (`if (!recarga) return;`) antes de escrever em usos_habilidades. Com
// Ataque Extra, chavesRestauradasNoDescanso não distingue certo de errado
// -- as duas implementações produzem a mesma lista vazia.
//
// Troca de fixture, medida no mesmo catálogo: Indomável (Guerreiro nível
// 9) recarrega em Descanso Longo ("não pode usar essa característica
// novamente até completar um Descanso Longo"). Bárbaro 6/Guerreiro 3 tem
// nível TOTAL 9 -- exatamente o nível de Indomável -- mas o Guerreiro
// desta ficha está no nível 3 NELE MESMO. Um filtro por char.nivel (o
// defeito, e a mutação do Step 4) libera Indomável; o filtro certo
// (ctx.nivelClasse) não.
test('restaurarHabilidades: nível na classe, não o total', async () => {
  const chaves = await chavesRestauradasNoDescanso(
    await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 6 }, { classe: 'Guerreiro', nivel: 3 }]),
    'longo');
  assert.ok(!chaves.some((k) => /Indomável/i.test(k)),
    'Indomável é Guerreiro 9; com nível total 9 o filtro antigo (ou a mutação ' +
    'c.nivel <= char.nivel) o liberaria num Guerreiro de nível 3');
});

// ============================================================
// Tarefa 7 (sub-projeto 3e): os 12 blocos de classe do Descanso Curto
// (hp-descanso.js, setupEventosDescanso -> #btn-descanso-curto). Numerado
// a partir de 20 porque as Tarefas 3-6 já gastaram 1-19 neste arquivo.
// ============================================================

/**
 * Dispara o Descanso Curto DE VERDADE -- clique em #btn-descanso-curto --
 * e devolve o próprio `p`, mutado pelos blocos de restauração por classe.
 * Os 12 blocos (Bárbaro, Bardo, Clérigo, Bruxo, Druida, Guerreiro,
 * Feiticeiro, Paladino, Monge, Ladino, Mago, Guardião) vivem dentro do
 * handler de clique (hp-descanso.js, setupEventosDescanso), sem função
 * exportada própria -- mesmo mecanismo de instalarDocumentoFalso() /
 * prepararEstadoDaFicha() já definidos acima (Oráculo 13), e o mesmo
 * padrão que multiclasse-combate.test.mjs usa para #btn-descanso-longo
 * (dispararDescansoLongo).
 * @param {object} p Personagem já montado (personagemMulticlasse).
 * @returns {Promise<object>} o mesmo `p`, mutado pelo descanso.
 */
async function descansoCurto(p) {
  const { sheetHpDescanso } = mods;
  await prepararEstadoDaFicha(p, criarContainerStub());

  const { registro, restaurar } = instalarDocumentoFalso();
  try {
    sheetHpDescanso.setupEventosDescanso();
    const cliques = registro.get('btn-descanso-curto')?.handlers?.click || [];
    assert.equal(cliques.length, 1,
      'setupEventosDescanso tem de registrar UM clique em #btn-descanso-curto');
    cliques[0]({ stopPropagation() {}, preventDefault() {} });
  } finally {
    restaurar();
  }
  return p;
}

/**
 * Grava N Pontos de Foco gastos direto em char.recursos.monge -- o
 * equivalente ao jogador clicando "gastar" N vezes na ficha, sem precisar
 * simular esse clique (o handler que consome Pontos de Foco não faz parte
 * do escopo desta tarefa).
 * @param {object} p Personagem.
 * @param {number} n Quantos Pontos de Foco marcar como gastos.
 */
function gastarPontosFoco(p, n) {
  if (!p.recursos) p.recursos = {};
  if (!p.recursos.monge) p.recursos.monge = {};
  p.recursos.monge.pontos_foco_gastos = n;
}

/**
 * Pontos de Foco DISPONÍVEIS agora, pelo CAMINHO REAL
 * (getEstadoRecursosMonge, sheet/classes/monge.js) -- não uma
 * reimplementação da fórmula dentro do teste. Reinstala `p` como `char`
 * antes de ler, para não depender de qual personagem ficou instalado por
 * uma chamada anterior.
 * @param {object} p Personagem.
 * @returns {number}
 */
function pontosFocoDisponiveis(p) {
  mods.sheetEstado.definirChar(p);
  return mods.sheetClasses.monge.getEstadoRecursosMonge()?.pontosAtuais ?? 0;
}

/**
 * Gasta os usos de Fonte de Inspiração do Bardo, gravando um número de
 * usos gastos grande o bastante para zerar `usosDisponiveis` seja qual for
 * o modificador de Carisma do personagem -- usosDisponiveis satura em 0
 * (Math.max(0, usosMax - gastos)), então não é preciso saber o máximo de
 * antemão.
 * @param {object} p Personagem.
 */
function gastarInspiracao(p) {
  if (!p.recursos) p.recursos = {};
  p.recursos.inspiracao_bardo_usos_gastos = 99;
}

/**
 * Usos de Fonte de Inspiração DISPONÍVEIS agora, pelo CAMINHO REAL
 * (getEstadoInspiracaoBardo, sheet/classes/bardo.js). Mesmo motivo de
 * pontosFocoDisponiveis acima para reinstalar `p` como `char`.
 * @param {object} p Personagem.
 * @returns {number}
 */
function inspiracaoDisponivel(p) {
  mods.sheetEstado.definirChar(p);
  return mods.sheetClasses.bardo.getEstadoInspiracaoBardo()?.usosDisponiveis ?? 0;
}

/** Usos MÁXIMOS de Fonte de Inspiração -- mesmo caminho de inspiracaoDisponivel. */
function inspiracaoMax(p) {
  mods.sheetEstado.definirChar(p);
  return mods.sheetClasses.bardo.getEstadoInspiracaoBardo()?.usosMax ?? 0;
}

// ORÁCULO 20 -- C1: recurso certo, NUNCA recuperado.
//
// Monge 5/Ladino 5 contra Ladino 5/Monge 5: mesmo personagem, ordem
// trocada. A ficha mostra a barra de Pontos de Foco nos DOIS (o
// getEstadoRecursosMonge já foi convertido nas Tarefas 3/5 -- ele já lê
// temClasse/nivelNa/subclasseDe), o jogador gasta, e no segundo o Descanso
// Curto NÃO devolvia nada -- Classes.md:5184. Não é número errado na tela:
// é recurso morto. O par é o fixture porque a ORDEM é a única variável
// entre os dois -- uma implementação que ainda leia `char.classe` no
// bloco do Monge passa no primeiro roteiro e falha no segundo.
//
// Achado do Global Constraint 4 desta série: `assert.equal` DENTRO do laço
// falha rápido no primeiro desencontro e não mede o segundo -- acumular as
// duas divergências antes de assertar é o que torna "qual roteiro falhou"
// uma medição, não um artefato da ordem dos fixtures.
test('Descanso Curto: Pontos de Foco voltam com o Monge em qualquer ordem', async () => {
  const divergencias = [];
  for (const roteiro of [
    [{ classe: 'Monge', nivel: 5 }, { classe: 'Ladino', nivel: 5 }],
    [{ classe: 'Ladino', nivel: 5 }, { classe: 'Monge', nivel: 5 }],
  ]) {
    const p = await personagemMulticlasse(roteiro);
    const rotulo = roteiro.map((r) => `${r.classe} ${r.nivel}`).join('/');
    gastarPontosFoco(p, 5);
    await descansoCurto(p);
    const disponiveis = pontosFocoDisponiveis(p);
    if (disponiveis !== 5) {
      divergencias.push(`${rotulo}: esperado 5 Pontos de Foco disponíveis, veio ${disponiveis}`);
    }
  }
  assert.deepEqual(divergencias, [],
    `o Descanso Curto tem de devolver todos os Pontos de Foco (Classes.md:5184): ${divergencias.join(' | ')}`);
});

// ORÁCULO 21 -- C2: recurso errado, recuperado CEDO DEMAIS.
//
// Fonte de Inspiração é Bardo 5 (Classes.md:462-464). Um Bardo
// 2/Guerreiro 3 tem nível TOTAL 5, então o gate antigo (char.nivel >= 5)
// dizia `true` e recarregava a Inspiração inteira a cada hora.
// O controle Bardo 5/Guerreiro 5 é onde app e livro COINCIDEM -- ele
// existe para provar que a conversão (nivelNa(char,'Bardo') >= 5) não
// quebrou o caso certo.
test('Descanso Curto: Fonte de Inspiração exige Bardo 5, não nível total 5', async () => {
  const cedo = await personagemMulticlasse([{ classe: 'Bardo', nivel: 2 }, { classe: 'Guerreiro', nivel: 3 }]);
  gastarInspiracao(cedo);
  await descansoCurto(cedo);
  assert.ok(inspiracaoDisponivel(cedo) < inspiracaoMax(cedo),
    'Bardo 2 (nível total 5) NÃO tem Fonte de Inspiração -- o gate antigo era o nível total');

  const naHora = await personagemMulticlasse([{ classe: 'Bardo', nivel: 5 }, { classe: 'Guerreiro', nivel: 5 }]);
  gastarInspiracao(naHora);
  await descansoCurto(naHora);
  assert.equal(inspiracaoDisponivel(naHora), inspiracaoMax(naHora),
    'Bardo 5 TEM Fonte de Inspiração -- o Descanso Curto restaura todos os usos');
});

// ORÁCULO 22 -- C3: o MESMO gate errando nos dois sentidos.
//
// Incansável é Guardião 10 (Classes.md:3348). Guardião 5/Guerreiro 5 tem
// total 10 e o app reduzia Exaustão SEM DIREITO; Guerreiro 5/Guardião 10
// tem o direito de verdade e o app NÃO reduzia, porque a guarda de classe
// era do espelho (a classe inicial é Guerreiro, então `char.classe ===
// 'Guardião'` nunca era verdadeiro e o bloco inteiro nem executava). Os
// dois casos juntos prendem as duas pontas -- um só deixaria passar uma
// implementação que errasse pela outra.
test('Descanso Curto: Incansável é Guardião 10, nos dois sentidos', async () => {
  const semDireito = await personagemMulticlasse([{ classe: 'Guardião', nivel: 5 }, { classe: 'Guerreiro', nivel: 5 }]);
  semDireito.exaustao = 2;
  await descansoCurto(semDireito);
  assert.equal(semDireito.exaustao, 2,
    'Guardião 5 (total 10) não tem Incansável -- o gate antigo lia o nível total');

  const comDireito = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }, { classe: 'Guardião', nivel: 10 }]);
  comDireito.exaustao = 2;
  await descansoCurto(comDireito);
  assert.equal(comDireito.exaustao, 1,
    'Guardião 10 TEM Incansável -- o gate antigo nem entrava no bloco, porque a ' +
    'classe inicial é Guerreiro');
});

// ============================================================
// Tarefa 8 (sub-projeto 3e): os 12 blocos de classe do Descanso Longo
// (hp-descanso.js, setupEventosDescanso -> #btn-descanso-longo). Numerado
// a partir de 23 porque as Tarefas 3-7 já gastaram 1-22 neste mesmo
// arquivo.
// ============================================================

/**
 * Dispara o Descanso Longo DE VERDADE -- clique em #btn-descanso-longo --
 * e devolve o próprio `p`, mutado pelos blocos de restauração por classe.
 * Os 12 blocos (Bárbaro, Bardo, Guerreiro, Clérigo, Bruxo, Druida,
 * Guardião, Feiticeiro, Paladino, Monge, Ladino, Mago) vivem dentro do
 * handler de clique (hp-descanso.js, setupEventosDescanso), sem função
 * exportada própria -- mesmo mecanismo de instalarDocumentoFalso() /
 * prepararEstadoDaFicha() já usados por descansoCurto, acima, e o mesmo
 * padrão que multiclasse-combate.test.mjs usa para #btn-descanso-longo
 * (dispararDescansoLongo, definida naquele arquivo -- reescrita aqui
 * porque é local e não exportada, mas é o MESMO mecanismo, não um novo).
 * @param {object} p Personagem já montado (personagemMulticlasse).
 * @returns {Promise<object>} o mesmo `p`, mutado pelo descanso.
 */
async function descansoLongo(p) {
  const { sheetHpDescanso } = mods;
  await prepararEstadoDaFicha(p, criarContainerStub());

  const { registro, restaurar } = instalarDocumentoFalso();
  try {
    sheetHpDescanso.setupEventosDescanso();
    const cliques = registro.get('btn-descanso-longo')?.handlers?.click || [];
    assert.equal(cliques.length, 1,
      'setupEventosDescanso tem de registrar UM clique em #btn-descanso-longo');
    cliques[0]({ stopPropagation() {}, preventDefault() {} });
  } finally {
    restaurar();
  }
  return p;
}

/**
 * Grava N usos de Canalizar Divindade gastos direto na reserva DESTA
 * classe -- Clérigo e Paladino guardam contadores separados
 * (`char.recursos.clerigo.canalizar_divindade_usos_gastos` e
 * `char.recursos.paladino.canalizar_divindade_usos_gastos`, Classes.md:1574
 * e :5545), o equivalente ao jogador clicando "gastar" N vezes na ficha.
 * @param {object} p Personagem.
 * @param {'clerigo'|'paladino'} classe
 * @param {number} n Quantos usos marcar como gastos.
 */
function gastarCanalizarDivindade(p, classe, n) {
  if (!p.recursos) p.recursos = {};
  if (!p.recursos[classe]) p.recursos[classe] = {};
  p.recursos[classe].canalizar_divindade_usos_gastos = n;
}

/**
 * Usos de Canalizar Divindade GASTOS agora, pelo CAMINHO REAL
 * (getEstadoRecursosClerigo/getEstadoRecursosPaladino, sheet/classes/*.js)
 * -- não uma leitura direta do campo dentro do teste. Reinstala `p` como
 * `char` antes de ler, mesmo motivo de pontosFocoDisponiveis, acima.
 * @param {object} p Personagem.
 * @param {'clerigo'|'paladino'} classe
 * @returns {number}
 */
function canalizarGastos(p, classe) {
  mods.sheetEstado.definirChar(p);
  if (classe === 'clerigo') {
    return mods.sheetClasses.clerigo.getEstadoRecursosClerigo()?.canalizarDivindadeUsosGastos ?? 0;
  }
  return mods.sheetClasses.paladino.getEstadoRecursosPaladino()?.canalizarGastos ?? 0;
}

// ORÁCULO 23 -- C4: Canalizar Divindade do Clérigo nunca zerado.
//
// Mago 5/Clérigo 5: a guarda antiga `char.classe === 'Clérigo'` é falsa (o
// espelho é Mago), mas getEstadoRecursosClerigo() já devolve estado VÁLIDO
// -- os recursos de Clérigo existem de qualquer forma no personagem. A
// ficha exibia "Canalizar Divindade 0/2" para sempre, e o Descanso Longo
// não devolvia nada (Classes.md:1574). O controle Clérigo 5/Mago 5 é onde
// o app já acertava (classe inicial = Clérigo).
test('Descanso Longo: Canalizar Divindade do Clérigo volta em qualquer ordem', async () => {
  const divergencias = [];
  for (const roteiro of [
    [{ classe: 'Mago', nivel: 5 }, { classe: 'Clérigo', nivel: 5 }],
    [{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 5 }],
  ]) {
    const p = await personagemMulticlasse(roteiro);
    const rotulo = roteiro.map((r) => `${r.classe} ${r.nivel}`).join('/');
    gastarCanalizarDivindade(p, 'clerigo', 2);
    await descansoLongo(p);
    const gastos = canalizarGastos(p, 'clerigo');
    if (gastos !== 0) {
      divergencias.push(`${rotulo}: esperado 0 usos gastos de Canalizar Divindade, veio ${gastos}`);
    }
  }
  assert.deepEqual(divergencias, [],
    `o Descanso Longo tem de restaurar TODOS os usos (Classes.md:1574): ${divergencias.join(' | ')}`);
});

// ORÁCULO 24 -- as DUAS reservas de Canalizar Divindade, separadas.
//
// Clérigo 5/Paladino 5 tem DUAS reservas ("Canalizar Divindade DESTA
// classe" -- Classes.md:1574 e :5545), e o app já guarda os contadores
// separados (canalizar_divindade_usos_gastos dentro de char.recursos.clerigo
// e, à parte, dentro de char.recursos.paladino). Este oráculo prende que a
// conversão não os JUNTOU: gasta os dois, restaura, e mede os dois. Uma
// implementação que zere só o do Clérigo passa no Oráculo 23 e falha aqui.
test('Descanso Longo: Clérigo/Paladino restauram as duas reservas', async () => {
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Paladino', nivel: 5 }]);
  gastarCanalizarDivindade(p, 'clerigo', 2);
  gastarCanalizarDivindade(p, 'paladino', 2);
  await descansoLongo(p);
  assert.equal(canalizarGastos(p, 'clerigo'), 0, 'reserva do Clérigo');
  assert.equal(canalizarGastos(p, 'paladino'), 0, 'reserva do Paladino');
});

/**
 * Marca o terceiro dado de previsão do Prodígio (subclasse Adivinhador)
 * como JÁ USADO -- a pré-condição para medir se um próximo Descanso Longo
 * o RESTAURA. Passa por getEstadoRecursosMago() (CAMINHO REAL) primeiro
 * para garantir que `char.recursos.mago.subclasses.adivinhador` já existe
 * com os defaults normalizados (prodigio_dado_3_usado = false); só depois
 * disso a marca `= true` escrita aqui tem efeito -- se viesse antes, a
 * normalização a sobrescreveria.
 *
 * NÃO usa `prodigio_dado_3 !== undefined` como sinal: getEstadoRecursosMago()
 * inicializa esse campo para 0 incondicionalmente (não é gated por nível),
 * então ele SEMPRE existe depois de qualquer render -- não separa Prodígio
 * Maior de nível insuficiente. O campo que só o Descanso Longo mexe SOB
 * O GATE é `prodigio_dado_3_usado` (hp-descanso.js: só é escrito dentro do
 * `if (n >= 3)`), e é esse que este par de helpers mede.
 * @param {object} p Personagem (precisa ser Mago/Adivinhador).
 */
function marcarProdigioDado3Usado(p) {
  mods.sheetEstado.definirChar(p);
  const estado = mods.sheetClasses.mago.getEstadoRecursosMago();
  assert.ok(estado, 'personagem tem de ser Mago para este oráculo');
  p.recursos.mago.subclasses.adivinhador.prodigio_dado_3_usado = true;
}

/** Lê `prodigio_dado_3_usado` direto do personagem, depois do Descanso Longo. */
function prodigioDado3Usado(p) {
  return p.recursos?.mago?.subclasses?.adivinhador?.prodigio_dado_3_usado;
}

// ORÁCULO 25 -- o gate de nível NA CLASSE no Descanso Longo.
//
// DIVERGÊNCIA DO PLANO: o mapa de escopo apontava "Assinatura Mágica" como
// a característica com gate de Mago 14. MEDIDO no catálogo
// (dados/classes/mago.json) e no código (hp-descanso.js, bloco do Mago):
// Assinatura Mágica é Mago NÍVEL 20 e não tem gate de nível nenhum neste
// bloco (as duas flags assinatura_magia_*_usada são zeradas incondicional-
// mente). A característica com gate de nível 14 é PRODÍGIO MAIOR
// (Adivinhador, "Jogue três d20s para sua característica Prodígio em vez
// de dois") -- é ela que `(char.nivel || 1) >= 14` decidia antes da
// conversão, dentro do bloco `subclasseDe(char,'Mago') === 'Adivinhador'`.
//
// Um Mago 5/Guerreiro 9 tem nível TOTAL 14 e o gate antigo o liberaria
// (o terceiro dado seria re-rolado e destravado sem direito); um
// Guerreiro 5/Mago 14 tem o direito de verdade, mas o bloco do Mago
// inteiro nem executava -- classe inicial é Guerreiro. Os dois casos são
// Adivinhador para o gate de nível ter algo a decidir.
test('Descanso Longo: o gate de Mago 14 (Prodígio Maior) é o nível na classe', async () => {
  const cedo = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5, subclasse: 'Adivinhador' }, { classe: 'Guerreiro', nivel: 9 },
  ]);
  marcarProdigioDado3Usado(cedo);
  await descansoLongo(cedo);
  assert.equal(prodigioDado3Usado(cedo), true,
    'Mago 5 (total 14, Adivinhador) não tem Prodígio Maior -- o terceiro dado ' +
    'continua marcado como usado, porque o gate antigo era o nível total');

  const naHora = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Mago', nivel: 14, subclasse: 'Adivinhador' },
  ]);
  marcarProdigioDado3Usado(naHora);
  await descansoLongo(naHora);
  assert.equal(prodigioDado3Usado(naHora), false,
    'Mago 14 (Adivinhador) TEM Prodígio Maior -- o Descanso Longo reseta o ' +
    'terceiro dado, e o bloco antigo nem rodava porque a classe inicial é Guerreiro');
});

// ============================================================
// Tarefa 9 (sub-projeto 3e): os cinco painéis de recurso da ficha
// (ficha.js) que ainda liam char.nivel/char.subclasse DE DENTRO de um
// painel já guardado por estadoX. Numerado a partir de 26 porque as
// Tarefas 3-8 já gastaram 1-25 neste mesmo arquivo.
// ============================================================

// ORÁCULO 26 -- painel do Feiticeiro num Mago 5/Feiticeiro 5.
//
// O painel APARECE (getEstadoRecursosFeiticeiro já foi convertido nos
// sub-projetos 3a/3b), mas char.subclasse é "" (a do Mago), então as
// linhas de Marés do Caos e de Afinidade SUMIAM de dentro dele. O
// controle de ordem invertida é onde o app já acertava -- os dois juntos
// separam "converteu" de "sempre mostra".
//
// ÂNCORA COM O RÓTULO "Marés do Caos: Disponível/Indisponível", não só
// a substring "Marés do Caos": a seção de Características (habilidades.js,
// já convertida em sub-projetos anteriores) também emite um botão "Usar
// Marés do Caos" independente do painel de recursos -- um regex solto
// casava com ELE e o oráculo passava mesmo com a mutação de volta
// (`char.subclasse || ''`), porque a substring sobrava de outro lugar da
// tela. Medido rodando a fixture com a mutação antes de fechar este
// oráculo.
test('tela: as linhas de subclasse do painel do Feiticeiro não somem', async () => {
  const selvagem = { classe: 'Feiticeiro', nivel: 5, subclasse: 'Feitiçaria Selvagem' };
  for (const roteiro of [
    [{ classe: 'Mago', nivel: 5 }, selvagem],
    [selvagem, { classe: 'Mago', nivel: 5 }],
  ]) {
    const html = await renderizarFicha(await personagemMulticlasse(roteiro));
    assert.match(html, /Marés do Caos: (Disponível|Indisponível)/,
      `${roteiro.map((r) => r.classe).join('/')}: a linha de Marés do Caos do PAINEL tem de aparecer`);
  }
});

// ORÁCULO 27 -- o rótulo do painel do Guerreiro.
//
// Mago 5/Guerreiro 5 (Mestre da Batalha) imprimia "Recursos do
// Guerreiro ()" -- parêntese vazio, o app se contradizendo na tela.
test('tela: o painel do Guerreiro rotula a subclasse do Guerreiro', async () => {
  const html = await renderizarFicha(await personagemMulticlasse([
    { classe: 'Mago', nivel: 5 },
    { classe: 'Guerreiro', nivel: 5, subclasse: 'Mestre da Batalha' },
  ]));
  assert.match(html, /Recursos do Guerreiro \(Mestre da Batalha\)/);
  assert.doesNotMatch(html, /Recursos do Guerreiro \(\)/,
    'o parêntese vazio era o defeito');
});

// ORÁCULO 28 -- CANÁRIO: o gate do Druida é Druida 5.
test('tela: Ressurgimento exige Druida 5, não nível total 5', async () => {
  const cedo = await renderizarFicha(await personagemMulticlasse([
    { classe: 'Druida', nivel: 2 }, { classe: 'Guerreiro', nivel: 3 }]));
  assert.doesNotMatch(cedo, /Ressurgimento/,
    'Druida 2 (total 5) não tem Ressurgimento -- o gate era o nível total');
  const naHora = await renderizarFicha(await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 3 }, { classe: 'Druida', nivel: 5 }]));
  assert.match(naHora, /Ressurgimento/, 'Druida 5 tem, e a classe inicial é Guerreiro');
});

// ORÁCULO 29 -- a impressão mostra PV temporário e dados gastos.
//
// Os dois campos antigos (`char.pv_temp` e `char.dados_vida_disponiveis`)
// não tinham escritor nenhum no repositório (medido com grep antes de
// mexer -- ver task-10-report.md), então a impressão mostrava sempre "0"
// de PV Temporário e sempre a reserva CHEIA. O fixture GASTA dados antes
// de imprimir -- sem isso, uma implementação que ainda mostre a reserva
// cheia passaria por coincidência.
test('impressão: PV temporário e dados de vida gastos aparecem', async () => {
  const { multiclasse } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }]);
  p.pv_temporario = 7;
  multiclasse.gastarDadosVida(p, 12, 2);
  const html = await renderizarImpressao(p);
  assert.match(html, /PV Temporario[\s\S]{0,200}>7</,
    'o campo antigo (pv_temp) não tinha escritor -- imprimia 0 sempre');
  assert.match(html, /3\/5 d12/, 'd12: 5 totais, 2 gastos');
  assert.match(html, /5\/5 d6/, 'd6 intacto');
  assert.doesNotMatch(html, /10\/10/,
    'o defeito antigo mostrava a reserva cheia com o dado da classe inicial');
});

// ORÁCULO 30 -- o clique real até o fim: #btn-usar-dv -> escolher reserva ->
// #btn-aplicar-dv debita a reserva CERTA, não só o escalar.
//
// O Oráculo 13 já clica #btn-usar-dv e a troca de reserva, mas para no
// re-render do picker -- não segue até #btn-aplicar-dv. Achado da revisão
// final do sub-projeto 3e: nenhum oráculo media o EFEITO do clique em
// #btn-aplicar-dv, então uma reversão de gastarDadosVida(...) para uma
// escrita direta no escalar legado (o defeito Critical que a Tarefa 2
// consertou: perda silenciosa de dado de vida num personagem com mais de
// um tipo de dado) escapava de todo oráculo de unidade -- só a suíte e2e
// de navegador pegaria, tarde demais no ciclo. Mago 5/Bárbaro 5 (d6 + d12,
// tipos DIFERENTES) é a condição necessária: com um tipo só, escrever no
// escalar e escrever na reserva estruturada produzem o mesmo resultado
// (Oráculo 9), e o defeito não apareceria.
test('handler: #btn-aplicar-dv debita a reserva escolhida, não o escalar', async () => {
  const { sheetHpDescanso, multiclasse } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 },
  ]);
  await prepararEstadoDaFicha(p, criarContainerStub());

  const { registro, restaurar } = instalarDocumentoFalso();
  try {
    sheetHpDescanso.setupEventosHP();
    const cliquesUsar = registro.get('btn-usar-dv')?.handlers?.click || [];
    assert.equal(cliquesUsar.length, 1, 'setupEventosHP tem de registrar UM clique em #btn-usar-dv');
    cliquesUsar[0]({ stopPropagation() {}, preventDefault() {} });

    // reservasDadosVida ordena por faces DECRESCENTE -- a inicial é o d12
    // do Bárbaro. Troca explicitamente para o d6 do Mago, para provar que
    // o botão aplica a reserva ESCOLHIDA, não a inicial.
    const selectTipo = registro.get('select-tipo-dv');
    const trocas = selectTipo?.handlers?.change || [];
    assert.equal(trocas.length, 1,
      'o clique tem de registrar UM listener de troca em #select-tipo-dv');
    selectTipo.value = '6';
    trocas[0]();

    const picker = registro.get('input-qtd-dv-val');
    picker.value = '2';

    const cliquesAplicar = registro.get('btn-aplicar-dv')?.handlers?.click || [];
    assert.equal(cliquesAplicar.length, 1,
      'a troca de reserva tem de manter UM listener em #btn-aplicar-dv');
    cliquesAplicar[0]();

    const reservas = multiclasse.reservasDadosVida(p);
    const d6 = reservas.find((r) => r.faces === 6);
    const d12 = reservas.find((r) => r.faces === 12);
    assert.equal(d6?.usados, 2,
      'a reserva ESCOLHIDA (d6, Mago) tem de registrar os 2 dados gastos');
    assert.equal(d12?.usados, 0,
      'a reserva NÃO escolhida (d12, Bárbaro) tem de continuar intacta');
  } finally {
    restaurar();
  }
});
