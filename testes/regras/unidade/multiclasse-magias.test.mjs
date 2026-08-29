// ============================================================
// Oráculos de reservasDeEspacos (sub-projeto 4, Tarefa 1).
//
// montarReservasDeEspacos deriva o TOTAL de espaço de magia a cada
// chamada -- a mesma separação que reservasDadosVida faz para dado de
// vida (regras-multiclasse.js), e pelo mesmo motivo: total armazenado é
// um segundo lugar dizendo a verdade.
//
// Rodada de revisão: o Critical (um terço conjurador solo recebia ZERO
// espaços em silêncio, via um_terco_subclasse caindo em
// tabela_caracteristicas vazia) só passou porque os Oráculos 2-4
// originais eram vazios demais para prender o defeito -- ver Oráculo 2
// (agora com valores exatos), Oráculo 3 (agora com tabela exata e lista
// NÃO filtrada) e Oráculo 4 (agora com valores exatos). Os Oráculos 5-8
// são novos desta rodada.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, lerClassesDados, escadaDeNivel, subirAteNivel } from './harness.mjs';

// reservas-espacos.js não tem entrada em modulosApp() (não é consumido por
// nenhum motor existente) -- importa direto. utils.js, que ele importa,
// toca `window` no top-level (harness.mjs:19), então este await prévio
// garante que instalarStubs() já rodou antes do import direto abaixo.
// multiclasseConjuracao é a chave de harness.mjs para
// regras-multiclasse-conjuracao.js -- de lá vem migrarEspacosDeMagia,
// exercitada pelos Oráculos 9-10 (sub-projeto 4, Tarefa 2).
// `mods` completo (não só as duas chaves de antes) porque o Oráculo 16
// (Tarefa 4) precisa de sheetMigracoes/sheetFicha/db/levelup/contextoClasse
// para rodar a mesma ORDEM que pages/sheet.js usa em renderSheet: migrar
// os espaços, depois renderizar -- é a ordem que o Ruling da Tarefa 2 (e a
// promoção desta tarefa para risk high) existe para proteger.
const mods = await modulosApp();
const { multiclasseConjuracao, sheetEstado } = mods;
const { montarReservasDeEspacos, gastarEspaco, restaurarEspacosDePacto, restaurarEspacosDeConjuracao, recuperarUmEspaco } =
  await import('../../../site/js/sheet/reservas-espacos.js');

// Chama a função real de migração (regras-multiclasse-conjuracao.js,
// migrarEspacosDeMagia) pelo caminho medido no Step 1 da Tarefa 2 --
// sheet/migracoes.js tem só a casca fina que lê `char` global, imprópria
// para um teste de unidade puro.
function migrar(p) {
  return multiclasseConjuracao.migrarEspacosDeMagia(p);
}

// Mapa de dados de classe (nome -> objeto de dados/classes/*.json), a
// mesma fonte que escolherMagiasMago() usa no harness. Carregado uma vez.
const mapaDados = lerClassesDados();

// gastarEspaco (Tarefa 3) não recebe `mapaDados` por parâmetro -- sua
// interface é `(p, fonte, circulo)`, igual à da casca reservasDeEspacos().
// Por isso ela resolve o mapa de dados pelo MESMO caminho que a casca usa:
// o live binding `classesData` de estado.js. Sem popular esse global aqui,
// gastarEspaco nunca encontraria reserva nenhuma (mapaDados ficaria null) e
// devolveria sempre false -- os Oráculos 12-13 exercitam a função de
// verdade, então o global precisa estar como o app deixaria na abertura da
// ficha.
sheetEstado.definirClassesData(mapaDados);

// Auxiliar do próprio teste: chama a função pura com o mapa de dados
// carregado acima.
function reservasDe(p) {
  return montarReservasDeEspacos(p, mapaDados);
}

// Auxiliares dos Oráculos 12-15 (Tarefa 3): chamam os escritores
// autorizados de verdade (sheet/reservas-espacos.js), não uma
// reimplementação da regra dentro do teste.
function gastar(p, fonte, circulo) {
  return gastarEspaco(p, fonte, circulo);
}
function restaurarPacto(p) {
  restaurarEspacosDePacto(p);
}
function restaurarConjuracao(p) {
  restaurarEspacosDeConjuracao(p);
}

// ORÁCULO 1 -- a tabela unificada, e o par que DISCRIMINA.
//
// Clérigo 5/Mago 5 NAO serve sozinho: dois conjuradores plenos somando 10
// dao a mesma linha na tabela do Clerigo contra nivel 10 e na unificada
// contra nivel de conjurador 10 -- o defeito acerta por acaso, e e
// exatamente o fixture que um teste de fumaca escolheria.
// Paladino 6/Mago 4 separa: meio-conjurador quebra a simetria. Nivel de
// conjurador = ceil(6/2) + 4 = 7, contra o nivel TOTAL 10 que o app usava.
test('espaços: a tabela unificada vale com duas classes conjuradoras', async () => {
  const divergencias = [];
  const casos = [
    { roteiro: [{ classe: 'Paladino', nivel: 6 }, { classe: 'Mago', nivel: 4 }], esperado: { 1: 4, 2: 3, 3: 3, 4: 1 } },
    { roteiro: [{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 5 }], esperado: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 } },
  ];
  for (const { roteiro, esperado } of casos) {
    const p = await personagemMulticlasse(roteiro);
    const obtido = {};
    for (const r of reservasDe(p).filter((x) => x.fonte === 'conjuracao')) obtido[r.circulo] = r.total;
    const rotulo = roteiro.map((r) => `${r.classe} ${r.nivel}`).join('/');
    if (JSON.stringify(obtido) !== JSON.stringify(esperado)) {
      divergencias.push(`${rotulo}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
    }
  }
  assert.deepEqual(divergencias, [], 'tabela unificada (livro:2104-2110)');
});

// ORÁCULO 2 -- com UMA classe conjuradora, a tabela e a DELA, no nivel DELA.
//
// O defeito antigo usava a tabela da classe INICIAL contra o nivel TOTAL:
// um Mago 5/Barbaro 5 recebia espacos de Mago 10. E a ordem invertida
// (Barbaro 5/Mago 5) nem recalculava, porque a porta era
// CLASSES_INFO['Barbaro'].conjurador === false.
//
// CORRIGIDO na rodada de revisão: a forma original só conferia AUSÊNCIA de
// círculo >= 4, o que uma lista VAZIA também satisfaz -- foi o mecanismo
// pelo qual o Critical (um terço conjurador solo devolvendo zero
// reservas) escapou. Agora confere os valores EXATOS: Mago 5 tem
// {1:4, 2:3, 3:2} (medido em dados/classes/mago.json, nível 5).
test('espaços: uma classe conjuradora usa a tabela dela, no nível dela', async () => {
  const divergencias = [];
  const esperado = { 1: 4, 2: 3, 3: 2 };
  for (const roteiro of [
    [{ classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 5 }],
    [{ classe: 'Bárbaro', nivel: 5 }, { classe: 'Mago', nivel: 5 }],
  ]) {
    const p = await personagemMulticlasse(roteiro);
    const conj = reservasDe(p).filter((x) => x.fonte === 'conjuracao');
    const obtido = {};
    for (const r of conj) obtido[r.circulo] = r.total;
    const rotulo = roteiro.map((r) => `${r.classe} ${r.nivel}`).join('/');
    if (JSON.stringify(obtido) !== JSON.stringify(esperado)) {
      divergencias.push(`${rotulo}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
    }
  }
  assert.deepEqual(divergencias, [], 'tabela da própria classe, no nível dela (livro:2071), com Mago 5 = 4/3/2');
});

// ORÁCULO 3 -- CANÁRIO de classe única: nada muda.
//
// CORRIGIDO na rodada de revisão: antes só conferia `conj.length > 0`,
// aceitando qualquer conjunto de espaços não vazio. Agora confere a linha
// EXATA de Mago 10 (medida em dados/classes/mago.json) e usa a lista NÃO
// filtrada para provar ausência de pacto -- o filtro anterior
// (`.filter(fonte === 'conjuracao')`) tornava `every(fonte === 'conjuracao')`
// tautológico: vacuamente verdadeiro mesmo numa lista vazia.
test('espaços: Mago 10 de classe única não muda', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 10 }]);
  const todas = reservasDe(p);
  const obtido = {};
  for (const r of todas.filter((x) => x.fonte === 'conjuracao')) obtido[r.circulo] = r.total;
  assert.deepEqual(obtido, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, 'tabela de Mago nível 10');
  assert.equal(todas.some((r) => r.fonte === 'pacto'), false, 'e nenhuma reserva de pacto');
});

// ORÁCULO 4 -- o pacto e reserva SEPARADA, com valores EXATOS.
//
// Num Bruxo 5/Mago 5 as duas coexistem. Uma implementacao que funda as
// duas (o comportamento de hoje) devolve uma lista sem `fonte: 'pacto'`,
// ou com o total somado.
//
// CORRIGIDO na rodada de revisão: antes só conferia PRESENÇA
// (`r.some(...)`), que uma reserva de pacto com círculo ou total errado
// também satisfaz. Agora confere os valores: Bruxo 5 tem Magia de Pacto
// de círculo 3, 2 espaços (medido em dados/classes/bruxo.json, nível 5);
// Mago 5 solo (não entra na unificada -- Bruxo é categoria 'pacto', fica
// de fora de classesConjuradoras) tem 4/3/2 (mesmo do Oráculo 2).
test('espaços: Bruxo/Mago tem as duas reservas, separadas e com valores corretos', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  const r = reservasDe(p);
  const pacto = r.filter((x) => x.fonte === 'pacto');
  const conj = r.filter((x) => x.fonte === 'conjuracao');
  assert.deepEqual(
    pacto.map((x) => ({ circulo: x.circulo, total: x.total })),
    [{ circulo: 3, total: 2 }],
    'Magia de Pacto do Bruxo 5: 1 reserva, círculo 3, 2 espaços',
  );
  const obtidoConj = {};
  for (const x of conj) obtidoConj[x.circulo] = x.total;
  assert.deepEqual(obtidoConj, { 1: 4, 2: 3, 3: 2 }, 'Conjuração do Mago 5 (só ele conta -- Bruxo é pacto)');
});

// ORÁCULO 5 -- CRITICAL da rodada de revisão: um terço conjurador SOLO.
//
// classesConjuradoras conta subclasse de um terço (Trapaceiro Arcano,
// Cavaleiro Místico) como classe conjuradora, mas guerreiro.json e
// ladino.json NÃO têm colunas de magia em tabela_caracteristicas -- a
// tabela deles vive em regras-conjuracao-subclasse.js, por CLASSE e
// SUBCLASSE. Um Ladino/Trapaceiro Arcano de CLASSE ÚNICA (nem precisa de
// multiclasse) caía no ramo de "uma classe conjuradora", buscava
// tabela_caracteristicas do Ladino, e getEspacosMagia devolvia `{}` --
// vazio mas TRUTHY -- produzindo ZERO reservas de Conjuração em silêncio.
// Nível 10 dá {1:4, 2:3} pela progressão de subclasse (regras-conjuracao-
// subclasse.js: PROGRESSAO[10].espacos).
test('espaços: Trapaceiro Arcano de classe única não fica sem espaços', async () => {
  const p = await personagemMulticlasse([{ classe: 'Ladino', nivel: 10, subclasse: 'Trapaceiro Arcano' }]);
  const conj = reservasDe(p).filter((x) => x.fonte === 'conjuracao');
  const obtido = {};
  for (const r of conj) obtido[r.circulo] = r.total;
  assert.deepEqual(obtido, { 1: 4, 2: 3 }, 'progressão de subclasse do Trapaceiro Arcano nível 10');
});

// ORÁCULO 6 -- espacos_magia_extras somam em 'conjuracao', NUNCA em 'pacto'.
//
// Fonte de Magia (e talentos equivalentes) concede espaços A MAIS para
// conjurar magias normais -- nunca Magia de Pacto, que é reserva
// independente. Bruxo 5/Mago 5 com um extra no círculo 1: o círculo 1 de
// Conjuração (Mago) sobe de 4 para 6; o círculo 3 de Pacto (Bruxo)
// permanece 2, mesmo o extra existindo no personagem.
test('espaços: espacos_magia_extras só somam em conjuração, nunca em pacto', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  p.espacos_magia_extras = { 1: 2 };
  const r = reservasDe(p);
  const conj = r.filter((x) => x.fonte === 'conjuracao');
  const pacto = r.filter((x) => x.fonte === 'pacto');
  const obtidoConj = {};
  for (const x of conj) obtidoConj[x.circulo] = x.total;
  assert.deepEqual(obtidoConj, { 1: 6, 2: 3, 3: 2 }, 'círculo 1 ganhou +2 do extra, os demais intactos');
  assert.deepEqual(
    pacto.map((x) => ({ circulo: x.circulo, total: x.total })),
    [{ circulo: 3, total: 2 }],
    'pacto não vê o extra, mesmo existindo um extra cadastrado',
  );
});

// ORÁCULO 7 -- `usados` satura no `total` (Math.min), nas duas fontes.
//
// Uma ficha com gasto gravado ACIMA do total (ex.: perdeu níveis desde o
// último gasto, ou dado corrompido) não pode devolver `disponiveis`
// negativo -- o consumidor (a tela) leria isso como "pode gastar mais".
test('espaços: usados satura no total, em conjuração e em pacto', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  p.espacos_magia = { conjuracao: { 1: 999 }, pacto: { 3: 999 } };
  const r = reservasDe(p);
  const circulo1 = r.find((x) => x.fonte === 'conjuracao' && x.circulo === 1);
  const pactoCirculo3 = r.find((x) => x.fonte === 'pacto' && x.circulo === 3);
  assert.deepEqual(
    { usados: circulo1.usados, disponiveis: circulo1.disponiveis },
    { usados: circulo1.total, disponiveis: 0 },
    'conjuração círculo 1 saturou no total, sem ficar negativo',
  );
  assert.deepEqual(
    { usados: pactoCirculo3.usados, disponiveis: pactoCirculo3.disponiveis },
    { usados: pactoCirculo3.total, disponiveis: 0 },
    'pacto círculo 3 saturou no total, sem ficar negativo',
  );
});

// ORÁCULO 8 -- degradação para 0 quando `espacos_magia` está ausente ou
// malformado (Ruling 1 da Tarefa 1: migrar fichas antigas é da Tarefa 2;
// aqui só confirma que, sem a forma nova, `usados` nunca lança e nunca
// inventa um valor -- sempre 0).
test('espaços: usados degrada para 0 sem espacos_magia ou com a forma antiga', async () => {
  const semCampo = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  // personagemMulticlasse não grava espacos_magia -- já é o caso "ausente".
  assert.equal(reservasDe(semCampo).every((r) => r.usados === 0), true, 'sem o campo, todo usados é 0');

  const formaAntiga = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  // Forma pré-multiclasse plausível: só um número solto, não o objeto
  // { fonte: { circulo: usados } } que montarReservasDeEspacos espera.
  formaAntiga.espacos_magia = 3;
  assert.equal(reservasDe(formaAntiga).every((r) => r.usados === 0), true, 'campo malformado (não objeto) também degrada para 0');
});

// ============================================================
// Oráculos da Tarefa 2 (sub-projeto 4): migração de char.espacos_magia da
// forma antiga -- { [circulo]: { total, usados } }, onde o TOTAL era
// gravado -- para a forma nova por FONTE, onde só `usados` sobrevive.
// ============================================================

// ORÁCULO 9 -- a migração preserva o gasto e joga na fonte certa.
//
// O fixture GASTA antes de migrar: sem gasto, uma migração que jogue tudo
// fora passaria por coincidência. E o par Bruxo/Mago separa as duas
// fontes -- um Bruxo de classe única vai para 'pacto' (bruxo.js:855: "o
// unico circulo onde ele tem espacos"), um Mago para 'conjuracao'.
test('migração: o gasto sobrevive e vai para a fonte certa', async () => {
  const divergencias = [];
  const casos = [
    { classe: 'Bruxo', nivel: 5, fonteEsperada: 'pacto' },
    { classe: 'Mago', nivel: 5, fonteEsperada: 'conjuracao' },
  ];
  for (const { classe, nivel, fonteEsperada } of casos) {
    const p = await personagemMulticlasse([{ classe, nivel }]);
    p.espacos_magia = { 3: { total: 2, usados: 1 } };
    migrar(p);
    // deepEqual do OBJETO INTEIRO, não só da folha `[fonteEsperada]?.[3]`:
    // uma chave velha remanescente (ex.: um bloco legado reescrevendo a
    // forma antiga por cima, o Critical que a revisão da Task 2 pegou em
    // pages/sheet.js) passaria pela checagem antiga, que só olhava a
    // folha esperada e nunca comparava a forma completa.
    const esperado = fonteEsperada === 'pacto'
      ? { conjuracao: {}, pacto: { 3: 1 } }
      : { conjuracao: { 3: 1 }, pacto: {} };
    try {
      assert.deepEqual(p.espacos_magia, esperado);
    } catch (e) {
      divergencias.push(`${classe} ${nivel}: ${e.message}`);
    }
  }
  assert.deepEqual(divergencias, [], 'migração por fonte');
});

// ORÁCULO 10 -- a migração é IDEMPOTENTE: rodar duas vezes não muda nada.
test('migração: rodar duas vezes não muda nada', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.espacos_magia = { 1: { total: 4, usados: 2 } };
  migrar(p);
  const depoisDaPrimeira = JSON.stringify(p.espacos_magia);
  assert.equal(migrar(p), false, 'a segunda passagem não altera a ficha (valor de retorno)');
  assert.equal(JSON.stringify(p.espacos_magia), depoisDaPrimeira, 'a segunda migração é no-op (conteúdo)');
});

// ORÁCULO 11 -- IDEMPOTÊNCIA cobre também o campo VAZIO ou ausente.
//
// wizard.js:92 grava `personagem.espacos_magia = {}` na criação (nenhum
// gasto ainda) -- um objeto vazio, mas TRUTHY em JavaScript. "Vazio" e
// "zero" não são a mesma coisa (a mesma armadilha que a Tarefa 1 documenta
// para reservasDaUnicaConjuradora): uma guarda que confundisse as duas
// leria `{}` como "não migrado" para sempre, ou pior, leria a forma NOVA
// pós-migração ({ conjuracao: {}, pacto: {} }) como "ainda não migrado" e
// reprocessaria `Object.entries` sobre as chaves 'conjuracao'/'pacto' a
// cada chamada.
test('migração: campo vazio {} migra uma vez e a segunda passagem é no-op', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.espacos_magia = {};
  assert.equal(migrar(p), true, 'primeira passagem sobre {} altera (carimba a forma nova)');
  assert.deepEqual(p.espacos_magia, { conjuracao: {}, pacto: {} }, 'forma nova com as duas fontes vazias');
  assert.equal(migrar(p), false, 'segunda passagem sobre a forma já migrada não altera');
  assert.deepEqual(p.espacos_magia, { conjuracao: {}, pacto: {} }, 'conteúdo intacto após a segunda passagem');

  // Ausência total do campo (ficha ainda mais antiga que a introdução de
  // `espacos_magia: {}` em criarPersonagemVazio -- store.js:336) também
  // não pode lançar nem inventar dado. `delete` simula essa ausência: o
  // fixture do harness já vem com o campo (herdado de criarPersonagemVazio).
  const semCampo = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  delete semCampo.espacos_magia;
  assert.equal(migrar(semCampo), false, 'sem o campo, a migração é no-op');
  assert.equal(semCampo.espacos_magia, undefined, 'e não inventa o campo');
});

// ============================================================
// Oráculos da Tarefa 3 (sub-projeto 4): os três escritores autorizados de
// espacos_magia em runtime -- gastarEspaco, restaurarEspacosDePacto,
// restaurarEspacosDeConjuracao (sheet/reservas-espacos.js).
// ============================================================

// ORÁCULO 12 -- o gasto sai da reserva PEDIDA, não da primeira.
//
// Sem este, uma implementação que sempre debite 'conjuracao' passaria no
// oráculo de gasto simples. O fixture tem as DUAS reservas (Bruxo 5/Mago
// 5): gasta do pacto e confirma que a Conjuração fica intacta -- sem a
// segunda asserção, uma implementação que sempre debite 'conjuracao'
// também passaria por coincidência (o pacto pedido nunca seria checado).
test('gasto: sai da reserva pedida, e a outra fica intacta', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  const antes = reservasDe(p);
  const alvo = antes.find((r) => r.fonte === 'pacto');
  assert.ok(alvo, 'o fixture precisa ter reserva de pacto');
  assert.equal(gastar(p, 'pacto', alvo.circulo), true, 'gastarEspaco devolve true quando gasta de verdade');
  const depois = reservasDe(p);
  assert.equal(depois.find((r) => r.fonte === 'pacto' && r.circulo === alvo.circulo).usados, 1, 'pacto debitado');
  assert.equal(depois.filter((r) => r.fonte === 'conjuracao').every((r) => r.usados === 0), true, 'Conjuração INTACTA');
});

// ORÁCULO 12b -- o gasto sai da reserva PEDIDA mesmo quando as duas fontes
// já têm `usados` DIFERENTES no mesmo círculo.
//
// Achado da campanha de mutação da Tarefa 9 (docs/PERGUNTAS-PENDENTES.txt,
// seção "TAREFA 9"): remover o filtro de fonte da busca em gastarEspaco
// (`.find((r) => r.circulo === Number(circulo))`, sem `r.fonte === fonte`)
// ESCAPAVA do Oráculo 12 acima e da suíte inteira, porque
// montarReservasDeEspacos ordena as reservas por círculo e depois por
// FONTE (`'conjuracao' < 'pacto'` em ordem alfabética) -- `find` sem o
// filtro sempre acha a reserva de CONJURAÇÃO primeiro quando há colisão de
// círculo. O Oráculo 12 gasta as duas fontes a partir de `usados = 0`, e
// `alvo.usados + 1` dá 1 tanto lendo a reserva certa quanto a errada -- a
// mutação nunca aparecia.
//
// Este oráculo gasta da Conjuração primeiro (ela fica em usados=1) e só
// DEPOIS pede o gasto decisivo do Pacto (usados=0 até ali) -- as duas
// fontes chegam ao gasto decisivo com `usados` DIFERENTES. Com o filtro de
// fonte removido, a busca ainda acha a Conjuração primeiro mesmo não sendo
// a fonte pedida: o código leria `usados=1` dela para calcular o novo
// valor, e gravaria `pacto[circulo] = 2` em vez de 1 -- a ESCRITA vai para
// a chave certa (`fonte` pedido), mas com o NÚMERO errado, por isso a
// asserção confere a FORMA COMPLETA do objeto (`deepEqual`), não só um
// campo solto.
test('gasto: a fonte pedida vence mesmo com usados diferente entre as reservas do mesmo círculo', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  const pacto = reservasDe(p).find((r) => r.fonte === 'pacto');
  const conj = reservasDe(p).find((r) => r.fonte === 'conjuracao' && r.circulo === pacto.circulo);
  assert.ok(conj, 'o fixture precisa ter Conjuração e Pacto colidindo no MESMO círculo');

  // Gasta só da Conjuração -- o Pacto continua em usados=0 (contagens
  // DIFERENTES entre as duas fontes no mesmo círculo antes do gasto
  // decisivo, abaixo).
  assert.equal(gastar(p, 'conjuracao', conj.circulo), true, 'gasta 1 da Conjuração');
  assert.deepEqual(p.espacos_magia, { conjuracao: { [conj.circulo]: 1 }, pacto: {} },
    'controle: só a Conjuração foi debitada até aqui');

  // Gasto decisivo: pede o PACTO (usados=0), em desacordo com a
  // Conjuração (usados=1) no mesmo círculo.
  assert.equal(gastar(p, 'pacto', pacto.circulo), true, 'gasta 1 do Pacto');
  assert.deepEqual(p.espacos_magia,
    { conjuracao: { [conj.circulo]: 1 }, pacto: { [pacto.circulo]: 1 } },
    'o Pacto tem de terminar em usados=1 (o gasto DELE, não o da Conjuração ' +
    'emprestado por engano ao ler a reserva errada) e a Conjuração continua ' +
    'intacta em 1');
});

// ORÁCULO 13 -- o Descanso Curto devolve o pacto e NÃO a Conjuração.
//
// É o defeito mais grave que este sub-projeto fecha: hoje
// recuperarEspacosMagiaBruxo (bruxo.js:180-190) zera TODOS os círculos de
// espacos_magia, e a Tarefa 7 do sub-projeto 3e fez aquele bloco disparar
// por temClasse -- então num Bruxo 5/Mago 5 um Descanso Curto devolveria
// também os espaços do Mago. Um oráculo que meça só o pacto passaria numa
// implementação que zere tudo -- por isso o fixture GASTA das duas fontes
// antes de restaurar, e a asserção confere as duas depois.
test('descanso curto: volta o pacto, não a Conjuração', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  const pacto = reservasDe(p).find((r) => r.fonte === 'pacto');
  const conj = reservasDe(p).find((r) => r.fonte === 'conjuracao');
  gastar(p, 'pacto', pacto.circulo);
  gastar(p, 'conjuracao', conj.circulo);
  restaurarPacto(p);
  const depois = reservasDe(p);
  assert.equal(depois.find((r) => r.fonte === 'pacto' && r.circulo === pacto.circulo).usados, 0, 'o pacto voltou');
  assert.equal(depois.find((r) => r.fonte === 'conjuracao' && r.circulo === conj.circulo).usados, 1,
    'a Conjuração NÃO pode voltar num Descanso Curto -- ela só volta no Longo');
});

// ORÁCULO 14 -- o Descanso Longo devolve a Conjuração e o pacto continua
// gasto (espelho do Oráculo 13, para restaurarEspacosDeConjuracao).
//
// A revisão da Tarefa 3 julgou aceitável adiar este oráculo para a Tarefa
// 5 (que já tem um "Oráculo do Longo" planejado, integrado ao fluxo de
// Descanso), mas pediu que ele entrasse aqui mesmo: um espelho de poucas
// linhas do Oráculo 13 sai mais barato agora do que o risco de a Tarefa 5
// escorregar. Mesmo raciocínio do Oráculo 13, com as fontes trocadas: o
// fixture GASTA das DUAS antes de restaurar -- sem isso, uma implementação
// que zere tudo também passaria por coincidência.
test('descanso longo: volta a Conjuração, o pacto continua gasto', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  const pacto = reservasDe(p).find((r) => r.fonte === 'pacto');
  const conj = reservasDe(p).find((r) => r.fonte === 'conjuracao');
  gastar(p, 'pacto', pacto.circulo);
  gastar(p, 'conjuracao', conj.circulo);
  restaurarConjuracao(p);
  const depois = reservasDe(p);
  assert.equal(depois.find((r) => r.fonte === 'conjuracao' && r.circulo === conj.circulo).usados, 0, 'a Conjuração voltou');
  assert.equal(depois.find((r) => r.fonte === 'pacto' && r.circulo === pacto.circulo).usados, 1,
    'o pacto continua gasto -- restaurarEspacosDeConjuracao não mexe nele');
});

// ORÁCULO 15 -- os escritores normalizam a forma antiga ANTES de
// escrever (Important 1 da revisão da Tarefa 3).
//
// Medido na revisão: sem normalizar primeiro, gastar sobre uma ficha
// ainda na forma antiga ({circulo: {total, usados}}) carimbava a forma
// nova por cima (`.conjuracao`/`.pacto`) sem nunca carregar o `usados`
// antigo -- e migrarEspacosDeMagia, vendo esses dois campos já
// presentes, concluía "já migrada" e abandonava aquele gasto para
// sempre. O fixture tem um gasto de 2 no círculo 1 GRAVADO NA FORMA
// ANTIGA (não migrado) e gasta o círculo 2 pelo escritor novo: o gasto
// antigo do círculo 1 tem de sobreviver, migrado para dentro de
// `conjuracao`. A asserção confere a FORMA INTEIRA (deepEqual do objeto
// todo, inclusive a chave `pacto` vazia que só a migração cria), não só
// a folha que mudou -- do contrário uma implementação que escreva por
// cima sem migrar passaria por coincidência sempre que os dois gastos
// caem em círculos diferentes (a folha nova bate, a antiga que sobra
// escondida não é olhada).
test('gasto: normaliza a forma antiga antes de escrever, sem perder o gasto que já existia', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.espacos_magia = { 1: { total: 4, usados: 2 } }; // forma antiga, ainda não migrada
  assert.equal(gastar(p, 'conjuracao', 2), true, 'gastou o círculo 2 pelo escritor novo');
  assert.deepEqual(p.espacos_magia, { conjuracao: { 1: 2, 2: 1 }, pacto: {} },
    'círculo 1 preserva o gasto antigo (migrado), círculo 2 tem o gasto novo, e a forma é a nova completa');
});

// ============================================================
// Oráculo da Tarefa 4 (sub-projeto 4): a ORDEM dentro de renderSheet --
// migrar os espaços de magia ANTES de renderizar, sem o reconciliador
// legado depois para desfazer a migração (ver o ruling do task-4-brief.md,
// simulado e confirmado na revisão da Tarefa 2).
// ============================================================

/**
 * Container mínimo que renderFichaCompleta() aceita: só escreve em
 * innerHTML e varre o DOM com optional chaining / listas vazias. Mesmo
 * padrão de multiclasse-descansos.test.mjs (criarContainerStub) --
 * duplicado aqui porque aquele arquivo não o exporta.
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
 * faz ao abrir a ficha -- o mínimo que migrarEspacosMagia()/
 * renderFichaCompleta() precisam para rodar sem lançar. Mesmo padrão de
 * multiclasse-descansos.test.mjs (prepararEstadoDaFicha) -- duplicado pelo
 * mesmo motivo de criarContainerStub, acima.
 * @param {object} p Personagem já montado.
 * @param {object} container Stub de container da ficha.
 * @returns {Promise<void>}
 */
async function prepararEstadoDaFicha(p, container) {
  const { sheetEstado: estado, db, levelup, contextoClasse } = mods;
  const mapaClasses = new Map();
  for (const ctx of contextoClasse.montarContextos(p, new Map())) {
    mapaClasses.set(ctx.classe, await db.getClasse(ctx.classe));
  }
  estado.definirChar(p);
  estado.definirContainer(container);
  estado.definirClasseData(mapaClasses.get(p.classe) || null);
  estado.definirClassesData(mapaClasses);
  const indiceMagias = await db.getIndiceMagias();
  estado.definirIndiceMagias(indiceMagias?.magias || []);
  estado.definirTalentos(await db.getTalentos());
  estado.definirEspecies(await db.getEspecies());
  // Pela MESMA função que pages/sheet.js usa (por classe, no nível dela).
  // Montar os caches aqui pelos espelhos reproduziria dentro do teste o
  // defeito que o Oráculo 26 existe para prender.
  const magiasAutomaticas = await levelup.obterMagiasAutomaticasDoPersonagem(p);
  estado.definirMagiasDominio(magiasAutomaticas.dominio);
  estado.definirMagiasSempre(magiasAutomaticas.sempre);
}

/**
 * Roda a mesma ORDEM que pages/sheet.js:renderSheet usa para espaços de
 * magia -- migrarEspacosMagia() (sheet/migracoes.js, a casca ligada pela
 * Tarefa 4) e SÓ DEPOIS renderFichaCompleta() -- e devolve o HTML
 * produzido. Não chama renderSheet() em si (ele resolve o personagem por
 * `charId` via store.js e mexe em elementos de header que o stub de
 * container não cobre); esta função reproduz a fatia da ordem que importa
 * para esta tarefa com as funções REAIS, não uma reimplementação.
 * @param {object} p Personagem já montado.
 * @returns {Promise<string>} HTML da ficha, depois de migrar e renderizar.
 */
async function migrarERenderizar(p) {
  const { sheetMigracoes, sheetFicha } = mods;
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);
  sheetMigracoes.migrarEspacosMagia();
  sheetFicha.renderFichaCompleta();
  return container.innerHTML;
}

/**
 * Como migrarERenderizar, mas GASTA um espaço pelo escritor real
 * (gastarEspaco) DEPOIS de prepararEstadoDaFicha, não antes -- e é essa
 * ordem que importa. `gastarEspaco` resolve a reserva contra o live
 * binding `classesData` de estado.js; chamar `gastar(p, ...)` (o
 * auxiliar do topo do arquivo) ANTES deste helper usaria o `classesData`
 * que o teste ANTERIOR deixou (mapaDados completo na primeira vez, mas
 * NARROW -- só as classes do personagem daquele teste -- depois de
 * qualquer chamada a migrarERenderizar/gastarERenderizar). MEDIDO: foi
 * exatamente o defeito que quebrou o Oráculo 18 na primeira versão --
 * `gastarEspaco(bruxo, 'pacto', 3)` devolvia `false` em silêncio porque o
 * Oráculo 17, rodando logo antes, tinha deixado `classesData` só com
 * 'Mago'. Lança se o gasto falhar -- um `false` engolido faria o oráculo
 * medir uma ficha SEM gasto nenhum, e um render que ignorasse `usados`
 * passaria por coincidência (mesma armadilha que o Oráculo 3 documenta).
 * @param {object} p Personagem já montado.
 * @param {'conjuracao'|'pacto'} fonte
 * @param {number} circulo
 * @returns {Promise<string>} HTML da ficha, depois de gastar e renderizar.
 */
async function gastarERenderizar(p, fonte, circulo) {
  const { sheetFicha } = mods;
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);
  if (!gastarEspaco(p, fonte, circulo)) {
    throw new Error(`gastarERenderizar: gastarEspaco(p, '${fonte}', ${circulo}) devolveu false -- fixture ou classesData errado`);
  }
  sheetFicha.renderFichaCompleta();
  return container.innerHTML;
}

// ORÁCULO 16 -- a ORDEM dentro de renderSheet: migrar ANTES de renderizar,
// sem reconciliador nenhum depois para desfazer o que a migração fez.
//
// Este é o cenário EXATO do Critical achado na revisão da Tarefa 2: um
// Mago 5 com `espacos_magia` ainda na forma ANTIGA (ficha salva antes
// desta tarefa) e um gasto real -- 1 de 4 espaços de 1º círculo.
// `migrarERenderizar` chama migrarEspacosMagia() e SÓ DEPOIS
// renderFichaCompleta(), a mesma ordem de pages/sheet.js:renderSheet
// depois desta tarefa (o reconciliador legado que rodava ENTRE as duas e
// desfazia a migração foi removido). Se ele voltasse, o círculo migrado
// (`conjuracao.1`) pareceria ausente para o bloco antigo, que o
// recriaria com usados:0 e apagaria a chave nova -- o gasto do jogador
// sumiria em silêncio na primeira abertura de toda ficha conjuradora
// existente (task-2-report.md).
//
// HISTÓRICO deste oráculo (relevante para quem ler o diff): na primeira
// passagem desta tarefa, medi que `site/js/sheet/magias.js` ainda lia
// `char.espacos_magia[circ].total`/`.usados` na forma ANTIGA, direto --
// sem a conversão (que eu tinha deixado para a Tarefa 6), o render
// produzia "NaN/undefined" e o rótulo virava "conjuracao° Círculo" para
// QUALQUER personagem conjurador. Troquei esta asserção de HTML para DADO
// por causa disso. O CONTROLADOR then measured o mesmo achado (inclusive
// que o checkbox de espaço fazia `if (!char.espacos_magia[circ]) return`
// e ficava mudo) e mandou a Tarefa 4 ABSORVER a conversão de leitura em
// `magias.js` -- ver task-4-report.md, "Endereçando a mensagem do
// controlador". Com `magias.js` convertido, o Oráculo 17 (abaixo) faz a
// asserção de TELA que o brief original pedia. Este oráculo (16) continua
// existindo porque mede uma coisa que o 17 não mede: a ORDEM dentro de
// renderSheet com uma ficha ainda NA FORMA ANTIGA (migração + render sem
// reconciliador no meio) -- o 17 sempre parte de uma ficha já na forma
// nova (via `gastar`), então não prende regressão de ORDEM.
test('render: a ordem migrar→renderizar preserva o gasto do jogador (canário da Tarefa 4)', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.espacos_magia = { 1: { total: 4, usados: 1 } }; // forma antiga -- ficha "já existente"

  const html = await migrarERenderizar(p);

  assert.deepEqual(p.espacos_magia, { conjuracao: { 1: 1 }, pacto: {} },
    'o gasto (1 de 4 no 1º círculo) sobrevive migrado para a forma nova -- ' +
    'nenhum reconciliador legado rodou depois da migração para desfazê-la');
  assert.equal(typeof html, 'string', 'a ordem migrar→renderizar roda até o fim sem lançar');
});

// ============================================================
// Oráculos 17-18: exigidos pelo RULING do controlador sobre esta tarefa.
// A medição do Oráculo 16 (acima) mostrou que a suíte inteira passava
// verde com a caixa "Espaços de magia" quebrada na tela E o checkbox de
// gasto mudo -- nenhum oráculo cobria a renderização. O controlador
// mediu o mesmo e mais um sintoma (o checkbox retornava cedo em silêncio,
// `magias.js:1645` antes da conversão) e decidiu que a Tarefa 4 absorve a
// conversão de LEITURA de `site/js/sheet/magias.js` (não o resto da
// Tarefa 6 -- `habilidades.js`, `classes/bruxo.js`, `ficha.js`,
// `grimorio.js`, `impressao.js` continuam intocados). Estes dois oráculos
// são a prova de que a conversão funciona -- e o canário duplo (Mago
// solo/fonte conjuração, Bruxo solo/fonte pacto) existe porque a
// conversão combina as reservas por CÍRCULO num objeto só (`espacos`, em
// `renderSecaoMagias`) para não duplicar a regra de total em cada
// consumidor -- ver o comentário daquela variável em magias.js.
// ============================================================

// ORÁCULO 17 -- a TELA mostra o número certo: Mago 5 de classe única.
//
// Medido antes de fixar o regex (marcação real de renderSecaoMagias,
// depois da conversão): o círculo é rotulado com a entidade HTML
// "&ordm;", não o caractere "º" solto, e a disponibilidade aparece como
// "disponiveis/total" (não "usados/total") dentro de um <span> logo
// depois das bolhas -- o brief original supunha a marcação, não a media.
// A JANELA do `[\s\S]{0,1000}?` também foi medida, não copiada do brief
// (que sugeria 120): cada bolha (`.slot-bolha`) é uma `<div>` com 4
// atributos `data-*`, e um círculo de 4 espaços (Mago 5, 1º círculo) tem 4
// bolhas entre o rótulo e o texto "3/4" -- a distância real medida foi de
// 739 caracteres; 120, ou mesmo 300, cortava ANTES do texto e fazia o
// oráculo falhar mesmo com a tela certa (medido: foi exatamente o que
// aconteceu na primeira versão deste oráculo).
//
// O fixture GASTA antes de renderizar -- sem gasto, um render que ignore
// `usados` passaria por coincidência (mesmo raciocínio do Oráculo 3). O
// gasto usa `gastarERenderizar` (não `gastar` + `migrarERenderizar`) --
// ver o docblock daquela função para o porquê: gastar ANTES de preparar o
// estado desta ficha usaria o `classesData` que o teste anterior deixou.
test('tela: Mago 5 de classe única mostra os espaços certos depois da conversão', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const html = await gastarERenderizar(p, 'conjuracao', 1);
  assert.match(html, /1&ordm;\s*Círculo[\s\S]{0,1000}?3\s*\/\s*4/,
    'o 1º círculo mostra 3 de 4 disponíveis (4 total, 1 gasto) na caixa de espaços de magia');
});

// ORÁCULO 18 -- CANÁRIO complementar: Bruxo 5 de classe única (fonte
// PACTO, não conjuração) também renderiza certo.
//
// Existe porque a conversão combina as reservas de `reservasDeEspacos()`
// num único objeto por CÍRCULO independente da fonte -- um Bruxo de
// classe única tem toda a reserva dele em 'pacto' (bruxo.js documenta: "o
// único círculo onde ele tem espaços"); uma implementação que só juntasse
// a fonte 'conjuracao' na combinação zeraria a tela de TODO Bruxo de
// classe única em silêncio -- exatamente a classe de defeito que este
// sub-projeto existe para fechar (o mesmo "vazio não é a mesma coisa que
// zero" que a revisão da Tarefa 1 já pegou uma vez nesta série).
// Valores: Bruxo 5 tem Magia de Pacto de círculo 3, 2 espaços (Oráculo 4).
test('tela: Bruxo 5 de classe única (fonte pacto) mostra os espaços certos', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }]);
  const html = await gastarERenderizar(p, 'pacto', 3);
  assert.match(html, /3&ordm;\s*Círculo[\s\S]{0,1000}?1\s*\/\s*2/,
    'o 3º círculo (Magia de Pacto) mostra 1 de 2 disponíveis (2 total, 1 gasto)');
});

// ============================================================
// Oráculos 19-24: exigidos pelo RULING 11 do controlador (Tarefa 4 absorve
// as Tarefas 5 e 6, que deixaram de existir como tarefas separadas do
// plano). A revisão achou o Critical em magias.js:1724 -- a MESMA linha
// que o checkbox (:1645) já tinha, 79 linhas acima, convertida na primeira
// rodada desta tarefa -- e mediu mais cinco superfícies quebradas para
// personagem de CLASSE ÚNICA: Descanso Curto de Bruxo (bruxo.js), Descanso
// Longo (hp-descanso.js, que DESTRUÍA o campo), Impressão (NaN/undefined),
// Fonte de Magia/Resplendor Sagrado/Recuperação Arcana (habilidades.js) e
// magia personalizada de Bruxo (que tinha SUMIDO -- funcionalidade PERDIDA
// por classe única, não limitação declarável). Um oráculo por família,
// exercitando o CAMINHO REAL (clique de DOM onde a conversão trocou um
// handler, chamada direta onde a conversão trocou uma função exportada) --
// nunca uma reimplementação da regra dentro do teste.
// ============================================================

/**
 * Botão de DOM falso com `dataset` fixo e um `addEventListener` que só
 * GUARDA o handler (em `handlers[evento]`), para o teste poder DISPARAR o
 * clique manualmente depois de `setupEventosEspacosMagia()` registrar os
 * listeners de verdade. `parentElement.querySelector` sempre devolve null
 * -- nenhum oráculo desta rodada usa upcast (seletor de círculo dentro do
 * próprio botão), então não há select para achar.
 * @param {Record<string,string>} dataset
 * @returns {object}
 */
function botaoFalso(dataset) {
  const el = { dataset, parentElement: { querySelector: () => null }, handlers: {} };
  el.addEventListener = (evento, fn) => { el.handlers[evento] = fn; };
  return el;
}

/**
 * Instala um `document` falso cujo `querySelectorAll(seletor)` devolve os
 * elementos registrados em `porSeletor[seletor]` (lista vazia se nenhum
 * foi registrado para aquele seletor) -- setupEventosEspacosMagia()
 * registra DEZENAS de handlers por seletor de atributo (`[data-conjurar]`,
 * `[data-conjurar-magia-custom]`, `.slot-bolha` etc.); sem isso, cada um
 * leria contra um document real que não existe em Node. `getElementById`
 * e `createElement` devolvem um elemento falso simples criado sob demanda
 * (com `appendChild`/`querySelectorAll`) -- medido rodando o Oráculo 19
 * pela primeira vez, em duas rodadas: (1) `_executarConjuracao` chama
 * `toast()` (utils.js) mesmo no caminho feliz ("Magia conjurada!"), e
 * `toast()` faz
 * `document.getElementById('toast-container').appendChild(document.createElement('div'))`
 * -- sem os dois, o teste lançava `document.createElement is not a
 * function` no meio do clique; (2) `_executarConjuracao` termina chamando
 * `renderFichaCompleta()` (o re-render de verdade depois de gastar), que
 * aciona `setupEventosInventarioSheet()`, e esse faz
 * `document.getElementById(id).querySelectorAll(...)` num elemento que o
 * elemento falso simples ainda não tinha. Também troca `setTimeout` por
 * uma versão com `unref()`, mesmo motivo de instalarDocumentoFalso
 * (abaixo): o `setTimeout(() => el.remove(), 3000)` de toast() não pode
 * manter o processo de teste vivo.
 * @param {Record<string, object[]>} porSeletor
 * @returns {() => void} restaurar() -- devolve `document`/`setTimeout` originais.
 */
function instalarDocumentoPorSeletor(porSeletor) {
  const docOriginal = globalThis.document;
  const setTimeoutOriginal = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => {
    const t = setTimeoutOriginal(fn, ms);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
  };
  const registroId = new Map();
  const elementoSimples = (id) => ({
    id, addEventListener() {}, removeAttribute() {}, setAttribute() {},
    appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [],
    style: {}, dataset: {}, classList: { add() {}, remove() {} },
  });
  globalThis.document = {
    querySelectorAll: (sel) => porSeletor[sel] || [],
    querySelector: () => null,
    createElement: (tag) => elementoSimples(tag),
    getElementById(id) {
      if (!registroId.has(id)) registroId.set(id, elementoSimples(id));
      return registroId.get(id);
    },
  };
  return () => {
    globalThis.document = docOriginal;
    globalThis.setTimeout = setTimeoutOriginal;
  };
}

/**
 * Elemento de DOM falso com handlers REGISTRADOS DE VERDADE (não um
 * `addEventListener` vazio como `elementoSimples`, acima) -- necessário
 * para os Oráculos 27-28 (Tarefa 7) disparar o clique de confirmar dentro
 * do modal "De qual reserva?" (mostrarSeletorFonteMagia, magias.js), que
 * é achado via `document.getElementById` (não `querySelectorAll`), depois
 * que `abrirModal` (utils.js) já rodou. Mesmo padrão de `elementoFalso`
 * em multiclasse-descansos.test.mjs -- duplicado aqui porque aquele
 * arquivo não o exporta.
 * @param {string} id
 * @returns {object}
 */
function elementoModalFalso(id) {
  const el = {
    id, style: {}, innerHTML: '', textContent: '', value: '',
    dataset: {}, handlers: {},
    addEventListener(evento, fn) { (el.handlers[evento] ||= []).push(fn); },
    removeAttribute() {}, setAttribute() {}, appendChild() {}, remove() {},
    querySelector: () => null, querySelectorAll: () => [],
    classList: { add() {}, remove() {} },
  };
  return el;
}

/**
 * Como `instalarDocumentoPorSeletor` (acima), mas com `getElementById`
 * "de verdade" (handlers guardados em `registro`, não descartados) --
 * o que os Oráculos 27-28 precisam para achar e clicar o botão de
 * confirmação DENTRO do modal que `mostrarSeletorFonteMagia` abre via
 * `abrirModal`. `querySelectorAll` continua resolvendo pelos botões de
 * `[data-conjurar]` etc. registrados em `porSeletor`, como antes.
 * @param {Record<string, object[]>} porSeletor
 * @returns {{registro: Map<string,object>, restaurar: () => void}}
 */
function instalarDocumentoComModal(porSeletor) {
  const docOriginal = globalThis.document;
  const setTimeoutOriginal = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => {
    const t = setTimeoutOriginal(fn, ms);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
  };
  const registro = new Map();
  globalThis.document = {
    querySelectorAll: (sel) => porSeletor[sel] || [],
    querySelector: () => null,
    createElement: (tag) => elementoModalFalso(tag),
    getElementById(id) {
      if (!registro.has(id)) registro.set(id, elementoModalFalso(id));
      return registro.get(id);
    },
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

// ORÁCULO 19 -- O CRITICAL da revisão: "Conjurar" de magia preparada
// debita o espaço, para um Mago 5 de classe única.
//
// magias.js:1724 (antes da conversão) lia `char.espacos_magia[circ]`
// direto -- a MESMA linha que o checkbox (:1645) já tinha, convertida na
// primeira rodada desta tarefa. "Conjurar" é a forma PRINCIPAL de gastar
// espaço no app -- clicar virava no-op silencioso (nem toast de erro
// aparecia) para qualquer conjurador de classe única.
//
// Dispara o clique de VERDADE (setupEventosEspacosMagia real, handler
// real) -- não chama gastarEspaco nem _executarConjuracao diretamente, que
// mediria a função e não o PONTO DE CHAMADA que estava quebrado (mesmo
// raciocínio do Oráculo 16 desta série).
test('conjurar: clicar "Conjurar" debita o espaço de um Mago 5 de classe única (o Critical)', async () => {
  const { sheetMagias } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);

  const btn = botaoFalso({ conjurar: 'Magia De Teste Sem Efeito Especial', conjCirc: '1' });
  const restaurar = instalarDocumentoPorSeletor({ '[data-conjurar]': [btn] });
  try {
    sheetMagias.setupEventosEspacosMagia();
    assert.equal(typeof btn.handlers.click, 'function',
      'setupEventosEspacosMagia tem de registrar UM clique em [data-conjurar]');
    btn.handlers.click({ stopPropagation() {} });
  } finally {
    restaurar();
  }

  assert.deepEqual(p.espacos_magia, { conjuracao: { 1: 1 }, pacto: {} },
    'clicar "Conjurar" debitou 1 espaço do 1º círculo de conjuração -- antes ' +
    'da conversão, o clique não fazia NADA em silêncio');
});

// ORÁCULO 20 -- magia personalizada: Bruxo 5 de classe única (fonte
// PACTO) consegue conjurá-la.
//
// Achado da revisão: fixar a fonte em 'conjuracao' fazia a magia
// personalizada SUMIR para um Bruxo cuja reserva inteira é Magia de
// Pacto -- funcionalidade PERDIDA por classe única, não limitação
// declarável (a diferença que separa este caso do par Companheiro
// Selvagem/Ressurgimento Selvagem, que a revisão confirmou como
// inalcançável por Bruxo e mandou manter fixo). Círculo 3: a Magia de
// Pacto do Bruxo 5 (Oráculo 4).
test('magia personalizada: Bruxo 5 de classe única (fonte pacto) consegue conjurá-la', async () => {
  const { sheetMagias } = mods;
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }]);
  p.magias_customizadas = [{ nome: 'Toque Sombrio Pessoal', circulo: 3 }];
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);

  const btn = botaoFalso({ conjurarMagiaCustom: '0', conjCirc: '3' });
  const restaurar = instalarDocumentoPorSeletor({ '[data-conjurar-magia-custom]': [btn] });
  try {
    sheetMagias.setupEventosEspacosMagia();
    assert.equal(typeof btn.handlers.click, 'function',
      'setupEventosEspacosMagia tem de registrar UM clique em [data-conjurar-magia-custom]');
    btn.handlers.click({ stopPropagation() {} });
  } finally {
    restaurar();
  }

  assert.deepEqual(p.espacos_magia, { conjuracao: {}, pacto: { 3: 1 } },
    'a magia personalizada gastou da reserva de Pacto -- antes, a fonte fixa em ' +
    '\'conjuracao\' fazia este Bruxo (sem reserva nenhuma de conjuração) ver sempre ' +
    '"Sem espaços", mesmo tendo Magia de Pacto disponível');
});

/**
 * Elemento de DOM falso: o mínimo que setupEventosDescanso() toca (id,
 * addEventListener que GUARDA os handlers em `handlers[evento]`, os
 * campos que hp-descanso.js lê/escreve). Mesmo padrão de
 * multiclasse-descansos.test.mjs (elementoFalso) -- duplicado aqui pelo
 * mesmo motivo dos outros helpers deste arquivo: aquele arquivo não o
 * exporta.
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
 * demanda) para o teste poder achar/disparar handlers registrados por
 * `document.getElementById(...)`. Mesmo padrão de
 * multiclasse-descansos.test.mjs (instalarDocumentoFalso) -- duplicado
 * pelo mesmo motivo. `restaurar()` devolve o `document` original -- chamar
 * SEMPRE, mesmo em caminho de erro (try/finally no chamador).
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

/**
 * Dispara o Descanso Curto DE VERDADE -- clique em #btn-descanso-curto --
 * e devolve o próprio `p`, mutado pelo handler. Mesmo padrão de
 * multiclasse-descansos.test.mjs (descansoCurto) -- duplicado pelo mesmo
 * motivo dos outros helpers.
 * @param {object} p Personagem já montado, já com prepararEstadoDaFicha
 *   rodado (o chamador gasta um espaço ANTES, e gastar precisa de
 *   classesData já apontando para as classes de `p` -- mesmo cuidado do
 *   Oráculo 16/gastarERenderizar).
 * @returns {Promise<object>} o mesmo `p`, mutado pelo descanso.
 */
async function descansoCurto(p) {
  const { sheetHpDescanso } = mods;
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
 * Dispara o Descanso Longo DE VERDADE -- clique em #btn-descanso-longo.
 * Espelho de descansoCurto, acima, mesmas notas.
 * @param {object} p Personagem já montado, já com prepararEstadoDaFicha rodado.
 * @returns {Promise<object>}
 */
async function descansoLongo(p) {
  const { sheetHpDescanso } = mods;
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

// ORÁCULO 21 -- Descanso Curto: Bruxo 5 de classe única gasta pacto,
// descansa, o pacto volta (Classes.md:898).
//
// bruxo.js:181-189 (antes da conversão) somava `.usados` dos mapas de
// FONTE ('conjuracao'/'pacto' como se fossem `{ total, usados }`, que não
// têm esse campo) -- `usadosAntes` dava 0 e a função retornava 0 em
// silêncio: o Descanso Curto de um Bruxo de classe única não devolvia
// pacto NENHUM.
test('descanso curto: Bruxo 5 de classe única gasta pacto, descansa, o pacto volta', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }]);
  await prepararEstadoDaFicha(p, criarContainerStub());
  assert.equal(gastarEspaco(p, 'pacto', 3), true, 'gastou o único círculo de pacto do Bruxo 5');

  await descansoCurto(p);

  const depois = montarReservasDeEspacos(p, mapaDados);
  const pacto = depois.find(r => r.fonte === 'pacto');
  assert.ok(pacto, 'a reserva de pacto continua existindo depois do descanso -- o campo não foi destruído');
  assert.equal(pacto.usados, 0, 'o pacto voltou no Descanso Curto');
});

// ORÁCULO 22 -- Descanso Longo: gasta das DUAS fontes, descansa, as DUAS
// voltam, e o campo NÃO É DESTRUÍDO.
//
// hp-descanso.js:954-980 (antes da conversão) reescrevia
// `char.espacos_magia[circulo]` direto -- na forma nova por fonte, isso
// APAGAVA as próprias chaves 'conjuracao'/'pacto' (nenhuma delas está na
// tabela de círculos da classe), destruindo o campo inteiro a cada
// Descanso Longo. A asserção mede as DUAS fontes e a CONTAGEM de reservas
// antes/depois -- uma implementação que zerasse só uma fonte, ou que
// perdesse reservas no processo, também seria pega.
test('descanso longo: gasta das duas fontes, descansa, as duas voltam e o campo não é destruído', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  await prepararEstadoDaFicha(p, criarContainerStub());
  assert.equal(gastarEspaco(p, 'pacto', 3), true, 'gastou pacto');
  assert.equal(gastarEspaco(p, 'conjuracao', 1), true, 'gastou conjuração');

  const antes = montarReservasDeEspacos(p, mapaDados);

  await descansoLongo(p);

  const depois = montarReservasDeEspacos(p, mapaDados);
  assert.equal(depois.length, antes.length,
    'o mesmo número de reservas existe depois do descanso -- o campo não foi destruído');
  assert.equal(depois.every(r => r.usados === 0), true,
    'as duas fontes voltaram (Conjuração: livro:2772; Pacto: Classes.md:898, "Curto OU Longo")');
});

// modulosApp() (harness.mjs) não tem entrada para sheet/impressao.js --
// nenhum motor anterior a este sub-projeto precisou dele. Carregado sob
// demanda pelo mesmo padrão que harness.mjs usa para todo módulo do app.
// Mesmo padrão de multiclasse-descansos.test.mjs (carregarImpressao/
// renderizarImpressao) -- duplicado aqui pelo mesmo motivo dos outros
// helpers deste arquivo.
let _impressaoMod = null;
async function carregarImpressao() {
  const { pathToFileURL } = await import('node:url');
  const { resolve } = await import('node:path');
  const { RAIZ } = await import('./harness.mjs');
  if (!_impressaoMod) {
    _impressaoMod = await import(pathToFileURL(resolve(RAIZ, 'site/js/sheet/impressao.js')).href);
  }
  return _impressaoMod;
}

// ORÁCULO 23 -- Impressão: Mago 5 com gasto imprime o número certo, não NaN.
//
// Medido antes de fixar o regex (marcação real de gerarHtmlImpressao,
// depois da conversão): "3/4" vem ANTES do rótulo do círculo aqui (ordem
// invertida da caixa de resumo em magias.js, que mostra o rótulo primeiro)
// -- `<div>3/4</div><div>...>1º Círculo</div>`.
test('impressão: Mago 5 com gasto imprime o número certo, não NaN', async () => {
  const impressao = await carregarImpressao();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);
  assert.equal(gastarEspaco(p, 'conjuracao', 1), true, 'gastou 1 do 1º círculo');

  const html = await impressao.gerarHtmlImpressao();

  assert.doesNotMatch(html, /NaN/, 'a impressão não pode mostrar NaN');
  assert.match(html, /3\s*\/\s*4[\s\S]{0,120}?1º\s*Círculo/,
    'o 1º círculo mostra 3 de 4 disponíveis (4 total, 1 gasto) na página de impressão');
});

// ORÁCULO 24 -- recuperarUmEspaco: gasta 2, recupera 1, e o piso é 0.
//
// "Hoje ele não tem oráculo nenhum" (achado da revisão): um escritor
// autorizado sem teste é o que a rede de guarda inteira existe para
// impedir. A asserção confere a FORMA COMPLETA (deepEqual do objeto
// inteiro) em cada passo, não só o valor de `usados` -- para prender
// qualquer escrita colateral na chave errada.
test('recuperarUmEspaco: gasta 2, recupera 1, e o piso é 0 (com false no piso)', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  assert.equal(gastar(p, 'conjuracao', 1), true);
  assert.equal(gastar(p, 'conjuracao', 1), true);
  assert.deepEqual(p.espacos_magia, { conjuracao: { 1: 2 }, pacto: {} }, 'gastou 2');

  assert.equal(recuperarUmEspaco(p, 'conjuracao', 1), true, 'recupera 1 devolve true');
  assert.deepEqual(p.espacos_magia, { conjuracao: { 1: 1 }, pacto: {} }, 'usados caiu para 1');

  assert.equal(recuperarUmEspaco(p, 'conjuracao', 1), true, 'recupera o último devolve true');
  assert.deepEqual(p.espacos_magia, { conjuracao: { 1: 0 }, pacto: {} }, 'usados caiu para 0');

  assert.equal(recuperarUmEspaco(p, 'conjuracao', 1), false, 'no piso 0, recuperar de novo devolve false');
  assert.deepEqual(p.espacos_magia, { conjuracao: { 1: 0 }, pacto: {} }, 'e não fica negativo (piso 0 mantido)');
});

// ============================================================
// Oráculos 25-26: exigidos pelo RULING 15 do controlador.
//
// ATUALIZAÇÃO (sub-projeto 5): o laço descrito abaixo NÃO EXISTE MAIS --
// `subirDeNivel` parou de gravar espaço de magia, `atualizarEspacosMagia`
// foi removida, e o total passou a ser derivado da regra a cada leitura.
// Os dois oráculos continuam valendo e continuam medindo os MESMOS dois
// fatos observáveis (o gasto do jogador sobrevive à subida; o Bruxo troca
// de círculo em vez de acumular) -- só que agora contra o comportamento
// derivado, que é quem responde por eles. Ler o campo direto passaria a
// enxergar `{}` e os dois ficariam verdes sem afirmar nada.
//
// O que o laço fazia, e por que os dois oráculos existem:
// o laço de "remover círculos que não existem mais" em levelup.js (dois
// lugares: `atualizarEspacosMagia` e o gêmeo de subclasse conjuradora
// dentro de `subirDeNivel`) tinha DOIS trabalhos, medidos separadamente:
// (1) apagar o círculo de Magia de Pacto que o Bruxo deixou para trás ao
// subir (ele MUDA de número: 1º nos níveis 1-2, 2º no nível 3, 3º no
// nível 5 -- medido em dados/classes/bruxo.json); (2) o trabalho
// destrutivo que a Tarefa 4 já tinha fechado no Descanso Longo -- apagar
// as chaves 'conjuracao'/'pacto' por não serem círculos válidos,
// destruindo o gasto do jogador a cada subida. O Ruling 13 tentou remover
// o laço inteiro (só via o trabalho 2) e QUEBROU classes-progressao.
// test.mjs -- a medição errada foi corrigida pelo Ruling 15: o laço FICA,
// mas pula 'conjuracao'/'pacto' por NOME. Os dois oráculos abaixo são o
// par que prova que os DOIS trabalhos sobrevivem -- nenhum sozinho prova
// isso (um oráculo só do gasto passaria com o laço inteiro removido; um
// oráculo só do círculo do Bruxo passaria com o laço original, ainda
// destrutivo).
//
// Reusam escadaDeNivel (harness.mjs), o MESMO mecanismo de subida que
// classes-progressao.test.mjs usa -- não uma reimplementação.
// ============================================================

// ORÁCULO 25 -- o gasto de um conjurador de classe única sobrevive à
// subida de nível.
//
// `sheetEstado.definirClassesData(mapaDados)` é chamado de novo aqui,
// explicitamente, mesmo já tendo sido chamado uma vez no topo do arquivo
// -- mesmo motivo do Oráculo 18/gastarERenderizar (achado daquela rodada):
// `gastarEspaco` lê o live binding `classesData`, e outros oráculos deste
// arquivo o estreitam (prepararEstadoDaFicha) para só as classes do
// PRÓPRIO fixture. Sem repopular aqui, `gastarEspaco(p, 'conjuracao', 1)`
// poderia devolver `false` em silêncio se o oráculo anterior tivesse
// deixado `classesData` sem 'Mago'.
//
// O fixture GASTA de verdade (via gastarEspaco, o escritor real) no meio
// da escada, não escreve `usados` à mão -- e mede a sobrevivência na
// subida SEGUINTE, não na mesma chamada (para separar "o gasto nunca foi
// perdido" de "o gasto sobreviveu à escrita de totais que roda a cada
// nível").
test('subida de nível: o gasto de um Mago 5 de classe única sobrevive à subida seguinte', async () => {
  sheetEstado.definirClassesData(mapaDados);
  let gastou = false;
  await escadaDeNivel('Mago', (p, nivel) => {
    if (nivel === 5 && !gastou) {
      assert.equal(gastarEspaco(p, 'conjuracao', 1), true,
        'gastou 1 espaço do 1º círculo no nível 5');
      gastou = true;
      return;
    }
    if (nivel === 6) {
      assert.equal(p.espacos_magia?.conjuracao?.['1'], 1,
        'o gasto sobrevive à subida de nível 5→6 -- o laço de limpeza de ' +
        'círculos não pode apagar a chave "conjuracao"');
    }
  }, { ateNivel: 6 });
  assert.equal(gastou, true, 'controle: o gasto de fato foi inserido no nível 5');
});

// ORÁCULO 26 -- o Bruxo tem UM círculo de pacto por vez, e ele SOBE com o
// nível: no 2→3 o 1º círculo dá lugar ao 2º.
//
// Antes do sub-projeto 5 isso era trabalho de um LAÇO DE LIMPEZA em
// `subirDeNivel`, que apagava a chave numérica do círculo obsoleto depois
// de gravar a nova -- e este oráculo lia `p.espacos_magia` direto para
// medi-lo. O laço saiu junto com toda a gravação de espaços: o total passou
// a ser DERIVADO da regra a cada leitura, e um círculo que o Bruxo não tem
// mais simplesmente não é produzido -- não há o que limpar.
//
// A propriedade do LIVRO continua idêntica e continua medida; só o caminho
// mudou, de campo gravado para reserva derivada. Ler o campo direto aqui
// enxergaria `{}` nos dois níveis e o oráculo passaria sem afirmar nada.
test('subida de nível: Bruxo 2→3 troca o círculo de pacto (1º sai, 2º entra)', async () => {
  const circulosDePacto = (p) => new Set(
    reservasDe(p).filter((r) => r.fonte === 'pacto').map((r) => r.circulo));
  let viuNivel2 = false;
  await escadaDeNivel('Bruxo', (p, nivel) => {
    if (nivel === 2) {
      const circulos = circulosDePacto(p);
      assert.ok(circulos.has(1), 'nível 2: o Bruxo tem espaços no 1º círculo');
      assert.ok(!circulos.has(2), 'nível 2: ainda não tem 2º círculo');
      viuNivel2 = true;
    }
    if (nivel === 3) {
      assert.ok(viuNivel2, 'pré-condição: o nível 2 foi medido antes do 3');
      const circulos = circulosDePacto(p);
      assert.ok(!circulos.has(1),
        'nível 3: o 1º círculo é obsoleto -- o Bruxo só tem UM círculo de ' +
        'pacto por vez, e a reserva derivada não deveria mais produzi-lo');
      assert.ok(circulos.has(2), 'nível 3: o 2º círculo (novo) existe');
    }
  }, { ateNivel: 3 });
});

// ============================================================
// Oráculos 27-28 (Tarefa 7, sub-projeto 4): o seletor de reserva "De
// qual reserva?" ao conjurar -- só aparece quando o círculo pedido tem
// espaço disponível nas DUAS fontes (Conjuração e Magia de Pacto) ao
// mesmo tempo. livro:2116 diz "pode usar" -- permissão, não ordem -- e a
// escolha não é neutra (Classes.md:898, o pacto volta no Curto; e
// Classes.md:1342/:1473, invocações que CONSOMEM espaço de pacto para
// outra coisa -- ver o docblock de mostrarSeletorFonteMagia em
// magias.js), por isso o app pergunta em vez de decidir por conta
// própria.
//
// O par abaixo é o que DISCRIMINA "só aparece com as duas disponíveis"
// de "sempre aparece" e de "nunca aparece": Bruxo 5/Mago 5 tem duas
// reservas que se sobrepõem SÓ no 3º círculo (Mago solo -- Bruxo fica de
// fora da tabela unificada, livro:2118 -- tem {1:4,2:3,3:2}; a Magia de
// Pacto do Bruxo 5 mora inteira no 3º círculo, 2 espaços, Oráculo 4). O
// 1º círculo só existe do lado de Conjuração -- é o controle que prova
// que o seletor não aparece indiscriminadamente.
// ============================================================

// ORÁCULO 27 -- as duas fontes disponíveis no mesmo círculo: o seletor
// aparece (rotulado, sem gasto prematuro) e escolher "pacto" debita SÓ o
// pacto -- a Conjuração fica intacta. Passo 5 do cenário do brief, em
// unidade: lê o ESTADO ARMAZENADO (p.espacos_magia), não só o texto do
// modal.
test('conjurar: Bruxo 5/Mago 5 com as duas reservas disponíveis mostra o seletor, e escolher pacto debita só o pacto', async () => {
  const { sheetMagias } = mods;
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  p.magias_preparadas = [{ nome: 'Bola de Fogo', circulo: 3 }];
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);

  const btn = botaoFalso({ conjurar: 'Bola de Fogo', conjCirc: '3' });
  const { registro, restaurar } = instalarDocumentoComModal({ '[data-conjurar]': [btn] });
  try {
    sheetMagias.setupEventosEspacosMagia();
    assert.equal(typeof btn.handlers.click, 'function',
      'setupEventosEspacosMagia tem de registrar UM clique em [data-conjurar]');
    btn.handlers.click({ stopPropagation() {} });

    // O seletor apareceu -- ancorado no CORPO do modal, com as duas
    // fontes rotuladas de um jeito que o jogador distingue qual é qual,
    // e a contagem certa de cada uma (2 de 2 disponíveis nas duas, no
    // fixture deste oráculo).
    const corpo = registro.get('modal-corpo');
    assert.match(corpo?.innerHTML || '', /Conjuração[\s\S]*?2 de 2 dispon[ií]veis/,
      'o seletor tem de rotular a reserva de Conjuração com a contagem certa (2 de 2)');
    assert.match(corpo?.innerHTML || '', /Magia de Pacto[\s\S]*?2 de 2 dispon[ií]veis/,
      'o seletor tem de rotular a reserva de Pacto com a contagem certa (2 de 2)');

    // Nenhum gasto ainda -- o clique em "Conjurar" só ABRIU o seletor,
    // não debitou nada até o jogador confirmar.
    assert.equal(p.espacos_magia?.conjuracao?.['3'], undefined,
      'antes de confirmar o seletor, a Conjuração não pode ter sido debitada');
    assert.equal(p.espacos_magia?.pacto?.['3'], undefined,
      'antes de confirmar o seletor, o Pacto não pode ter sido debitado');

    // Escolhe "pacto" e confirma. `mostrarSeletorFonteMagia` só lê
    // `getElementById(idSelect)` DENTRO do handler de confirmar (não tem
    // troca de reserva ao vivo como o seletor de dado de vida, que
    // precisa re-renderizar um picker) -- por isso o valor é escrito no
    // MESMO elemento memoizado que aquele handler vai ler, forçando a
    // criação por `getElementById` (idêntico ao caminho de produção) em
    // vez de tentar pegar algo que ainda não existe em `registro`.
    const selectFonte = globalThis.document.getElementById('select-fonte-magia');
    selectFonte.value = 'pacto';
    const confirmar = registro.get('btn-confirmar-fonte-magia');
    assert.equal(confirmar?.handlers?.click?.length, 1,
      'o modal tem de registrar UM clique em #btn-confirmar-fonte-magia');
    confirmar.handlers.click[0]();
  } finally {
    restaurar();
  }

  assert.deepEqual(p.espacos_magia, { conjuracao: {}, pacto: { 3: 1 } },
    'escolher "pacto" no seletor tem de debitar SÓ o pacto -- a Conjuração fica intacta');
});

// ORÁCULO 28 -- CONTROLE que discrimina o Oráculo 27: com uma reserva só
// disponível no círculo pedido (1º círculo, só do lado de Conjuração --
// o Pacto do Bruxo 5 inteiro mora no 3º), o seletor NÃO aparece e o
// gasto vai direto para a única fonte, como sempre foi. Sem este
// controle, uma implementação que SEMPRE mostrasse o seletor (mesmo com
// uma reserva só) passaria pelo Oráculo 27 sozinho -- é exatamente o
// precedente do seletor de dado de vida (3e): só aparece com mais de uma
// opção.
test('conjurar: Bruxo 5/Mago 5 com UMA reserva só no círculo não mostra seletor -- gasta direto', async () => {
  const { sheetMagias } = mods;
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  p.magias_preparadas = [{ nome: 'Mísseis Mágicos', circulo: 1 }];
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);

  const btn = botaoFalso({ conjurar: 'Mísseis Mágicos', conjCirc: '1' });
  const { registro, restaurar } = instalarDocumentoComModal({ '[data-conjurar]': [btn] });
  try {
    sheetMagias.setupEventosEspacosMagia();
    assert.equal(typeof btn.handlers.click, 'function',
      'setupEventosEspacosMagia tem de registrar UM clique em [data-conjurar]');
    btn.handlers.click({ stopPropagation() {} });

    // O seletor nunca foi aberto -- getElementById('select-fonte-magia')
    // nunca teria sido chamado, então a chave nem existe no registro.
    assert.equal(registro.has('select-fonte-magia'), false,
      'com uma reserva só, mostrarSeletorFonteMagia não pode ter sido chamado');
  } finally {
    restaurar();
  }

  assert.deepEqual(p.espacos_magia, { conjuracao: { 1: 1 }, pacto: {} },
    'com uma reserva só (1º círculo, só Conjuração), o clique gasta direto -- sem seletor');
});

// ============================================================
// Oráculos 29-30 -- RULING do controlador sobre a Tarefa 7: o seletor de
// reserva se estende à magia PERSONALIZADA. Achado da revisão: antes
// deste ruling, o botão "Conjurar" de magia preparada oferecia o
// seletor, mas o de magia personalizada continuava resolvendo a fonte
// só por precedência automática (reservaDoCirculo) -- a MESMA pergunta
// "de qual reserva sai o espaço?" respondida de dois jeitos diferentes
// pelos dois botões, o que é pior que não perguntar (o jogador não
// consegue formar um modelo do que o app faz). A decisão de produto foi
// sobre CONJURAR, não sobre um tipo de magia -- então o mecanismo é o
// MESMO (mostrarSeletorFonteMagia), só ligado num segundo botão.
//
// Espelham os Oráculos 27-28 byte a byte na estrutura, trocando
// `[data-conjurar]` (preparada) por `[data-conjurar-magia-custom]`
// (personalizada) -- o mesmo par que discrimina "só aparece com as duas
// disponíveis" de "sempre aparece" e de "nunca aparece".
// ============================================================

// ORÁCULO 29 -- as duas fontes disponíveis no mesmo círculo, para uma
// magia PERSONALIZADA: o seletor aparece (rotulado) e escolher pacto
// debita SÓ o pacto -- a Conjuração fica intacta. Mesmo fixture do
// Oráculo 27 (Bruxo 5/Mago 5, 3º círculo -- a única sobreposição), com a
// magia preparada trocada por personalizada.
test('magia personalizada: Bruxo 5/Mago 5 com as duas reservas disponíveis mostra o seletor, e escolher pacto debita só o pacto', async () => {
  const { sheetMagias } = mods;
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  p.magias_customizadas = [{ nome: 'Toque Sombrio Multiclasse', circulo: 3 }];
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);

  const btn = botaoFalso({ conjurarMagiaCustom: '0', conjCirc: '3' });
  const { registro, restaurar } = instalarDocumentoComModal({ '[data-conjurar-magia-custom]': [btn] });
  try {
    sheetMagias.setupEventosEspacosMagia();
    assert.equal(typeof btn.handlers.click, 'function',
      'setupEventosEspacosMagia tem de registrar UM clique em [data-conjurar-magia-custom]');
    btn.handlers.click({ stopPropagation() {} });

    // O seletor apareceu, rotulado -- mesma verificação do Oráculo 27.
    const corpo = registro.get('modal-corpo');
    assert.match(corpo?.innerHTML || '', /Conjuração[\s\S]*?2 de 2 dispon[ií]veis/,
      'o seletor tem de rotular a reserva de Conjuração com a contagem certa (2 de 2)');
    assert.match(corpo?.innerHTML || '', /Magia de Pacto[\s\S]*?2 de 2 dispon[ií]veis/,
      'o seletor tem de rotular a reserva de Pacto com a contagem certa (2 de 2)');

    // Nenhum gasto ainda -- abrir o seletor não debita nada por conta
    // própria.
    assert.equal(p.espacos_magia?.conjuracao?.['3'], undefined,
      'antes de confirmar o seletor, a Conjuração não pode ter sido debitada');
    assert.equal(p.espacos_magia?.pacto?.['3'], undefined,
      'antes de confirmar o seletor, o Pacto não pode ter sido debitado');

    // Escolhe "pacto" e confirma.
    const selectFonte = globalThis.document.getElementById('select-fonte-magia');
    selectFonte.value = 'pacto';
    const confirmar = registro.get('btn-confirmar-fonte-magia');
    assert.equal(confirmar?.handlers?.click?.length, 1,
      'o modal tem de registrar UM clique em #btn-confirmar-fonte-magia');
    confirmar.handlers.click[0]();
  } finally {
    restaurar();
  }

  assert.deepEqual(p.espacos_magia, { conjuracao: {}, pacto: { 3: 1 } },
    'escolher "pacto" no seletor tem de debitar SÓ o pacto (magia personalizada) -- a Conjuração fica intacta');
});

// ORÁCULO 30 -- CONTROLE que discrimina o Oráculo 29: com uma reserva só
// disponível no círculo pedido (1º círculo, só Conjuração -- o Pacto do
// Bruxo 5 mora inteiro no 3º), o seletor NÃO aparece e o gasto vai
// direto -- mesmo controle do Oráculo 28, para a magia personalizada.
test('magia personalizada: Bruxo 5/Mago 5 com UMA reserva só no círculo não mostra seletor -- gasta direto', async () => {
  const { sheetMagias } = mods;
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  p.magias_customizadas = [{ nome: 'Mísseis Sombrios Pessoais', circulo: 1 }];
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);

  const btn = botaoFalso({ conjurarMagiaCustom: '0', conjCirc: '1' });
  const { registro, restaurar } = instalarDocumentoComModal({ '[data-conjurar-magia-custom]': [btn] });
  try {
    sheetMagias.setupEventosEspacosMagia();
    assert.equal(typeof btn.handlers.click, 'function',
      'setupEventosEspacosMagia tem de registrar UM clique em [data-conjurar-magia-custom]');
    btn.handlers.click({ stopPropagation() {} });

    // O seletor nunca foi aberto -- getElementById('select-fonte-magia')
    // nunca teria sido chamado, então a chave nem existe no registro.
    assert.equal(registro.has('select-fonte-magia'), false,
      'com uma reserva só, mostrarSeletorFonteMagia não pode ter sido chamado (magia personalizada)');
  } finally {
    restaurar();
  }

  assert.deepEqual(p.espacos_magia, { conjuracao: { 1: 1 }, pacto: {} },
    'com uma reserva só (1º círculo, só Conjuração), o clique gasta direto -- sem seletor (magia personalizada)');
});

// ============================================================
// Oráculos 31-32 -- achado da revisão desta rodada: TODO oráculo que abre
// o seletor (27, 29, e os dois cenários e2e) escolhia "pacto". Nenhum
// escolhia "conjuracao" -- e por isso a mutação "o modal ignora o
// <select> e sempre devolve 'pacto'" (`const fonte = 'pacto'` fixo,
// dentro do handler de clique de `mostrarSeletorFonteMagia`) sobrevivia
// às duas suítes inteiras: a LEITURA da escolha do jogador estava sem
// teste em metade do alcance -- exatamente a promessa central desta
// tarefa (o jogador escolhe, o app não decide por ele). Um caso a mais
// POR CAMINHO (preparada e personalizada), escolhendo "conjuracao" desta
// vez, fecha o alcance -- espelham os Oráculos 27/29 trocando só a
// fonte escolhida no seletor e o objeto final esperado.
// ============================================================

// ORÁCULO 31 -- escolher "Conjuração" no seletor (magia preparada)
// debita SÓ a Conjuração -- o Pacto fica intacto. Espelho do Oráculo 27
// com a escolha invertida.
test('conjurar: Bruxo 5/Mago 5 com as duas reservas disponíveis, escolher CONJURAÇÃO debita só a Conjuração', async () => {
  const { sheetMagias } = mods;
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  p.magias_preparadas = [{ nome: 'Bola de Fogo', circulo: 3 }];
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);

  const btn = botaoFalso({ conjurar: 'Bola de Fogo', conjCirc: '3' });
  const { registro, restaurar } = instalarDocumentoComModal({ '[data-conjurar]': [btn] });
  try {
    sheetMagias.setupEventosEspacosMagia();
    btn.handlers.click({ stopPropagation() {} });

    // Escolhe "conjuracao" desta vez (o Oráculo 27 já escolhe "pacto").
    const selectFonte = globalThis.document.getElementById('select-fonte-magia');
    selectFonte.value = 'conjuracao';
    const confirmar = registro.get('btn-confirmar-fonte-magia');
    assert.equal(confirmar?.handlers?.click?.length, 1,
      'o modal tem de registrar UM clique em #btn-confirmar-fonte-magia');
    confirmar.handlers.click[0]();
  } finally {
    restaurar();
  }

  assert.deepEqual(p.espacos_magia, { conjuracao: { 3: 1 }, pacto: {} },
    'escolher "Conjuração" no seletor tem de debitar SÓ a Conjuração -- o Pacto fica intacto');
});

// ORÁCULO 32 -- espelho do Oráculo 31 para magia PERSONALIZADA: escolher
// "Conjuração" no seletor debita SÓ a Conjuração -- o Pacto fica intacto.
test('magia personalizada: Bruxo 5/Mago 5 com as duas reservas disponíveis, escolher CONJURAÇÃO debita só a Conjuração', async () => {
  const { sheetMagias } = mods;
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]);
  p.magias_customizadas = [{ nome: 'Toque Sombrio Multiclasse', circulo: 3 }];
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);

  const btn = botaoFalso({ conjurarMagiaCustom: '0', conjCirc: '3' });
  const { registro, restaurar } = instalarDocumentoComModal({ '[data-conjurar-magia-custom]': [btn] });
  try {
    sheetMagias.setupEventosEspacosMagia();
    btn.handlers.click({ stopPropagation() {} });

    const selectFonte = globalThis.document.getElementById('select-fonte-magia');
    selectFonte.value = 'conjuracao';
    const confirmar = registro.get('btn-confirmar-fonte-magia');
    assert.equal(confirmar?.handlers?.click?.length, 1,
      'o modal tem de registrar UM clique em #btn-confirmar-fonte-magia');
    confirmar.handlers.click[0]();
  } finally {
    restaurar();
  }

  assert.deepEqual(p.espacos_magia, { conjuracao: { 3: 1 }, pacto: {} },
    'escolher "Conjuração" no seletor tem de debitar SÓ a Conjuração (magia personalizada) -- o Pacto fica intacto');
});

// ============================================================
// ORÁCULO 33 -- Memorizar Magia (Tarefa 8): a característica é MAGO 5,
// não nível TOTAL 5.
// ============================================================

/**
 * Dispara o Descanso Curto DE VERDADE e mede se o botão "Memorizar Magia"
 * apareceu no modal de conclusão. `personagemMulticlasse` deixa
 * `pv_atual === pv_max` (harness.mjs:407) -- o personagem já "cheio" --
 * então o handler de hp-descanso.js (btn-descanso-curto) cai direto no
 * ramo `else if (memorizarMagia)`, sem oferecer Dados de Vida, que escreve
 * o botão (ou não) em `#modal-acoes` via `abrirModal` (utils.js:991,
 * `acoesEl.innerHTML = acoesHtml`). Mesmo padrão de `descansoCurto`,
 * acima, mas com o `registro` capturado ANTES do `restaurar()` --
 * `descansoCurto` devolve o document original antes de retornar, e o
 * conteúdo escrito no modal não sobreviveria à leitura depois disso.
 * @param {object} p Personagem já com prepararEstadoDaFicha rodado.
 * @returns {Promise<boolean>} true se "Memorizar Magia" apareceu no modal.
 */
async function ofereceMemorizarMagia(p) {
  const { sheetHpDescanso } = mods;
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
  const acoes = registro.get('modal-acoes');
  return !!acoes?.innerHTML?.includes('btn-memorizar-magia-curto');
}

// ORÁCULO 33 -- Memorizar Magia exige MAGO 5 (Classes.md), não nível TOTAL
// 5 do personagem.
//
// Bardo 2/Mago 3 (dados/classes/bardo.json, dados/classes/mago.json) tem
// nível TOTAL 5 e Mago 3 -- não tem Memorizar Magia, porque a
// característica é do 5º nível EM MAGO, não do 5º nível de personagem.
// Bardo 2/Mago 5 (controle, nível total 7) TEM. `nivelNa(char, 'Mago')`
// mede exatamente isso; `char.nivel` (o espelho, TOTAL) não. A Tarefa 8
// prova essa distinção por MUTAÇÃO (não por este par de casos sozinho):
// trocar `nivelNa(char, 'Mago') >= 5` de volta para
// `(char.nivel || 1) >= 5` faz o caso Bardo 2/Mago 3 (total 5) ser
// liberado por engano -- é esse defeito que a conversão fecha. O controle
// Bardo 2/Mago 5 garante que a conversão não quebrou o caso legítimo --
// sem ele, uma implementação que negasse SEMPRE passaria pelo caso
// negativo sozinho.
test('descanso curto: Memorizar Magia exige Mago 5, não total 5', async () => {
  const divergencias = [];
  const casos = [
    { roteiro: [{ classe: 'Bardo', nivel: 2 }, { classe: 'Mago', nivel: 3 }], esperado: false },
    { roteiro: [{ classe: 'Bardo', nivel: 2 }, { classe: 'Mago', nivel: 5 }], esperado: true },
  ];
  for (const { roteiro, esperado } of casos) {
    const p = await personagemMulticlasse(roteiro);
    // circulo > 0 e sem `origem` -- magiaContaNoLimite(m) fica true, então
    // o segundo `&&` do gate não interfere: só o nível em Mago decide.
    p.magias_preparadas = [{ nome: 'Bola de Fogo', circulo: 3 }];
    const container = criarContainerStub();
    await prepararEstadoDaFicha(p, container);

    const obtido = await ofereceMemorizarMagia(p);
    if (obtido !== esperado) {
      divergencias.push(`${roteiro.map((r) => `${r.classe} ${r.nivel}`).join('/')}: esperado ${esperado}, veio ${obtido}`);
    }
  }
  assert.deepEqual(divergencias, [], 'Memorizar Magia é Mago 5, não nível total 5');
});

// ============================================================
// RODADA DE CONFORMIDADE COM O LIVRO (2026-08-26)
//
// Achados Important 2 e 3 da revisão de conformidade
// (docs/superpowers/reviews/2026-08-26-multiclasse-conformidade-regras.md):
// o atributo de conjuração era UM por personagem, vindo do espelho da
// classe INICIAL, e o portão da seção de Magias lia o mesmo espelho.
// ============================================================

// ORÁCULO 21 -- CD e ataque de magia SAEM DE CADA CLASSE, não da inicial.
//
// livro:2075: "Cada magia que você prepara está associada a uma de suas
// classes, e você usa o atributo de conjuração DESSA CLASSE quando
// conjura a magia." Num Clérigo/Mago são dois atributos e duas CDs.
//
// Os valores são LITERAIS de propósito -- repetir `8 + bonusProficiencia
// + calcMod` aqui seria reescrever a implementação, não medi-la.
// personagemMulticlasse fixa Inteligência 15 (+2) e Sabedoria 15 (+2), o
// que tornaria as duas CDs IGUAIS e o oráculo cego; por isso os atributos
// são reescritos abaixo para valores que divergem.
test('CD e ataque de magia: um par por CLASSE conjuradora, não o da inicial', async () => {
  const { utils } = mods;

  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 5 },
  ]);
  // Sab 16 (+3) e Int 10 (+0): três pontos de diferença, exatamente o
  // erro que a revisão mediu nas magias de Mago de um Clérigo/Mago.
  p.atributos = { ...p.atributos, sabedoria: 16, inteligencia: 10 };
  assert.equal(p.classe, 'Clérigo', 'o espelho aponta para Clérigo, a inicial');
  assert.equal(p.nivel, 10, 'nível total 10 -> bônus de proficiência +4');

  const conj = utils.conjuracoesPorClasse(p);
  assert.deepEqual(conj.map((c) => c.classe), ['Clérigo', 'Mago'],
    'as DUAS classes conjuradoras aparecem, na ordem de aquisição');
  assert.deepEqual(conj.map((c) => c.atributo), ['Sabedoria', 'Inteligência'],
    'cada entrada traz o atributo DA SUA classe');
  // 8 + 4 (PB do nível TOTAL 10, livro:2047) + 3 = 15; e 8 + 4 + 0 = 12.
  assert.deepEqual(conj.map((c) => c.cd), [15, 12],
    'CD por classe. Ler o espelho daria 15 para as duas, e as magias de ' +
    'Mago sairiam 3 pontos acima do certo.');
  assert.deepEqual(conj.map((c) => c.ataque), [7, 4],
    'ataque de magia por classe: 4 + 3 e 4 + 0');

  // O bônus de proficiência é o do nível TOTAL nas DUAS entradas -- é o
  // que separa esta regra da de características de classe. Se alguém
  // trocasse por nivelNa, as CDs cairiam para 8+3+3 e 8+3+0.
  assert.ok(conj.every((c) => c.cd - 8 - (c.ataque - 4) === 4),
    'as duas entradas usam o MESMO bônus de proficiência, o do nível total');
});

// ORÁCULO 22 -- classe inicial não-conjuradora: o beco sem saída.
//
// Este é o achado Important 3. Um Bárbaro 5/Mago 1 SEM nenhuma magia
// registrada dava falso em TODOS os termos do portão -- inclusive em
// possuiAlgumaMagia, justamente por ainda não ter magia -- e a seção de
// Magias não era renderizada. Como ela é a única superfície com o botão
// "+ Magia", não havia caminho nenhum para registrar a primeira.
test('classe inicial não-conjuradora: a seção de Magias aparece e traz o "+ Magia"', async () => {
  const { utils, multiclasseConjuracao: mc } = mods;

  const barbaroMago = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  assert.equal(barbaroMago.classe, 'Bárbaro', 'espelho na classe inicial, não-conjuradora');
  assert.deepEqual(barbaroMago.magias_preparadas || [], [],
    'SEM magia registrada -- é esta a combinação que o portão antigo perdia');

  assert.equal(mc.conjuraPorAlgumaClasse(barbaroMago), true,
    'conjura pelo Mago, ainda que a inicial seja Bárbaro');
  assert.deepEqual(utils.conjuracoesPorClasse(barbaroMago).map((c) => c.classe), ['Mago'],
    'uma entrada só: a do Mago');

  const html = await migrarERenderizar(barbaroMago);
  assert.ok(html.includes('<h2>Magias</h2>'),
    'a seção de Magias tem de ser renderizada');
  assert.ok(html.includes('id="btn-add-magia"'),
    'e com o botão "+ Magia" -- sem ele o personagem não tem como registrar a primeira magia');
  assert.ok(html.includes('CD Magia'),
    'a caixa de CD de Magia também some quando o portão lê só o espelho');

  // O contrário continua fechado: quem não conjura por classe nenhuma não
  // ganha a seção só porque o portão ficou mais largo.
  const barbaroPuro = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 5 }]);
  assert.equal(mc.conjuraPorAlgumaClasse(barbaroPuro), false,
    'Bárbaro de classe única não conjura -- o portão não pode virar sempre-verdadeiro');
  assert.deepEqual(utils.conjuracoesPorClasse(barbaroPuro), [],
    'e não tem CD de magia nenhuma');
});

// ORÁCULO 23 -- classe única não regride: nem no número, nem no RÓTULO.
//
// A troca de calcCDMagia por conjuracoesPorClasse não pode mudar nada
// para quem tem uma classe só. Duas coisas são medidas: o VALOR (contra
// calcCDMagia/calcAtaqueMagia, que continuam existindo e que a suíte
// antiga já prende) e o RÓTULO -- sem sufixo de classe, porque com uma
// conjuradora só não há o que desambiguar.
test('classe única: CD/ataque idênticos a calcCDMagia, e rótulo sem nome de classe', async () => {
  const { utils } = mods;
  const divergencias = [];

  const conjuradoras = [
    ['Bardo', ''], ['Clérigo', ''], ['Druida', ''], ['Feiticeiro', ''],
    ['Mago', ''], ['Guardião', ''], ['Paladino', ''], ['Bruxo', ''],
    ['Guerreiro', 'Cavaleiro Místico'], ['Ladino', 'Trapaceiro Arcano'],
  ];
  for (const [classe, subclasse] of conjuradoras) {
    const p = await personagemMulticlasse([{ classe, nivel: 5, subclasse }]);
    const conj = utils.conjuracoesPorClasse(p);
    if (conj.length !== 1) {
      divergencias.push(`${classe}: esperava 1 entrada, veio ${conj.length}`);
      continue;
    }
    if (conj[0].cd !== utils.calcCDMagia(p)) {
      divergencias.push(`${classe}: CD ${conj[0].cd} != calcCDMagia ${utils.calcCDMagia(p)}`);
    }
    if (conj[0].ataque !== utils.calcAtaqueMagia(p)) {
      divergencias.push(`${classe}: ataque ${conj[0].ataque} != calcAtaqueMagia ${utils.calcAtaqueMagia(p)}`);
    }
  }
  assert.deepEqual(divergencias, [],
    'conjuracoesPorClasse tem de concordar com calcCDMagia em TODA classe única');

  // O rótulo: um Mago sozinho traz "CD Magia" sem parêntese; um
  // Clérigo/Mago traz "CD Magia (Clérigo)" e "CD Magia (Mago)".
  const mago = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const htmlMago = await migrarERenderizar(mago);
  assert.ok(htmlMago.includes('>CD Magia<'),
    'classe única: o rótulo continua "CD Magia", sem sufixo');
  assert.ok(!htmlMago.includes('CD Magia (') ,
    'classe única não pode ganhar sufixo de classe -- não há o que desambiguar');

  const clerigoMago = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 5 },
  ]);
  const htmlDuplo = await migrarERenderizar(clerigoMago);
  assert.ok(htmlDuplo.includes('CD Magia (Clérigo)') && htmlDuplo.includes('CD Magia (Mago)'),
    'com duas conjuradoras, cada caixa nomeia a classe');
  assert.ok(htmlDuplo.includes('Atq. Magia (Clérigo)') && htmlDuplo.includes('Atq. Magia (Mago)'),
    'o mesmo vale para o ataque de magia');
});

// ORÁCULO 24 -- subclasse conjuradora entra pelo nível NAQUELA classe.
//
// getConjuracaoSubclasse só concede conjuração a partir do 3º nível. O
// caminho antigo passava `personagem.nivel`, o TOTAL: um Mago 5/Guerreiro
// 2 tem nível total 7 e ganharia conjuração de Cavaleiro Místico que não
// possui. Aqui o nível que manda é o de Guerreiro.
test('Cavaleiro Místico conta pelo nível de Guerreiro, não pelo total', async () => {
  const { utils } = mods;

  const cedo = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5 },
    { classe: 'Guerreiro', nivel: 2, subclasse: 'Cavaleiro Místico' },
  ]);
  assert.equal(cedo.nivel, 7, 'total 7 -- é ele que enganaria a leitura antiga');
  assert.deepEqual(utils.conjuracoesPorClasse(cedo).map((c) => c.classe), ['Mago'],
    'Guerreiro 2 não conjura: Cavaleiro Místico só a partir do 3º nível DE GUERREIRO');

  const naHora = await personagemMulticlasse([
    { classe: 'Mago', nivel: 1 },
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Cavaleiro Místico' },
  ]);
  assert.deepEqual(utils.conjuracoesPorClasse(naHora).map((c) => c.classe), ['Mago', 'Guerreiro'],
    'Guerreiro 3 conjura, mesmo com o total (4) menor que o do caso anterior');
  assert.equal(utils.conjuracoesPorClasse(naHora)[1].atributo, 'Inteligência',
    'o atributo do Cavaleiro Místico vem da subclasse');
});

// ORÁCULO 25 -- Feitiçaria Inata sobe a CD do FEITICEIRO, e só dele.
//
// O ramo antigo era `personagem.classe === 'Feiticeiro'`, o espelho: num
// Feiticeiro/Mago o +1 vazava para a CD do Mago (que não o tem), e num
// Mago/Feiticeiro não chegava à do Feiticeiro (que o tem). Os dois
// sentidos são medidos, porque um `if` preso ao espelho erra nos dois.
test('Feitiçaria Inata: +1 na CD do Feiticeiro, em qualquer ordem de aquisição', async () => {
  const { utils } = mods;

  for (const roteiro of [
    [{ classe: 'Feiticeiro', nivel: 7 }, { classe: 'Mago', nivel: 3 }],
    [{ classe: 'Mago', nivel: 3 }, { classe: 'Feiticeiro', nivel: 7 }],
  ]) {
    const p = await personagemMulticlasse(roteiro);
    // Carisma e Inteligência iguais (15, +2), para o +1 ser a ÚNICA
    // diferença possível entre as duas CDs.
    p.atributos = { ...p.atributos, carisma: 15, inteligencia: 15 };
    const rotulo = roteiro.map((r) => `${r.classe} ${r.nivel}`).join('/');

    const semInata = utils.conjuracoesPorClasse(p);
    const cdSem = Object.fromEntries(semInata.map((c) => [c.classe, c.cd]));
    assert.equal(cdSem['Feiticeiro'], cdSem['Mago'],
      `${rotulo}: com Feitiçaria Inata DESLIGADA as duas CDs têm de ser iguais`);

    p.recursos = { ...(p.recursos || {}), feiticeiro: { feiticaria_inata_ativa: true } };
    const comInata = utils.conjuracoesPorClasse(p);
    const cdCom = Object.fromEntries(comInata.map((c) => [c.classe, c.cd]));
    assert.equal(cdCom['Feiticeiro'], cdSem['Feiticeiro'] + 1,
      `${rotulo}: a CD do Feiticeiro sobe 1 com Feitiçaria Inata ativa`);
    assert.equal(cdCom['Mago'], cdSem['Mago'],
      `${rotulo}: a CD do Mago NÃO pode subir -- Feitiçaria Inata é do Feiticeiro`);
  }
});

// ============================================================
// Oráculos 26-29: a revisão final do sub-projeto 5.
//
// O buraco que deixou o Critical passar por onze tarefas foi de CENÁRIO,
// não de motor: todo cenário de multiclasse escrito no sub-projeto usou
// Guerreiro ou Bárbaro -- NÃO conjuradores -- como segunda classe. O que
// a campanha de mutação mediu foi a DECISÃO DE NÍVEL dentro de
// subirDeNivel/buildLevelUpContext; nada mediu o que a ficha faz com o
// personagem DEPOIS de ele existir. Estes quatro oráculos entram por esse
// buraco: segunda classe CONJURADORA, e a cadeia de ABERTURA da ficha.
// ============================================================

// ORÁCULO 26 -- O CRITICAL: reabrir a ficha não pode apagar a magia
// sempre preparada concedida pela subclasse da SEGUNDA classe.
//
// `subirDeNivel` grava a magia em `magias_preparadas` com
// `origem: 'sempre'`. Na abertura seguinte da ficha,
// `migrarMagiasSemprePreparadas` REMOVE toda entrada 'sempre' ausente de
// `magiasSempreCache` e chama salvar() -- a exclusão é PERSISTIDA. Com o
// cache montado pelos espelhos (classe INICIAL, nível TOTAL), o cache de
// um Mago 5/Paladino 3 não conhecia NENHUMA magia de Paladino: a
// 'Destruição Divina' do Juramento da Devoção sumia em silêncio.
//
// O personagem é produzido pela cadeia REAL (subirAteNivel ->
// subirDeNivel), não montado à mão -- montá-lo à mão pularia justamente o
// produtor cuja saída o higienizador apaga.
//
// O DISCRIMINADOR é a asserção do cache pelo espelho (`[]`): sem ela,
// este oráculo passaria também numa implementação que só tivesse deixado
// de higienizar. Os nomes são LITERAIS, medidos nesta árvore.
test('reabrir a ficha PRESERVA a magia sempre preparada da segunda classe', async () => {
  const { levelup, sheetMigracoes } = mods;

  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5, subclasse: 'Evocador' }]);
  await subirAteNivel(p, 'Paladino', 8);

  assert.deepEqual(p.classes.map((c) => `${c.classe} ${c.nivel} ${c.subclasse}`),
    ['Mago 5 Evocador', 'Paladino 3 Juramento da Devoção'],
    'o cenário é Mago 5/Paladino 3 -- se a ordem das subclasses em dados/ mudar, ' +
    'este oráculo falha aqui em vez de medir outra coisa em silêncio');
  assert.equal(p.classe, 'Mago', 'o espelho de classe aponta para a INICIAL');
  assert.equal(p.nivel, 8, 'o espelho de nível é o TOTAL');

  const sempreDe = (x) => (x.magias_preparadas || [])
    .filter((m) => m.origem === 'sempre').map((m) => m.nome);
  assert.deepEqual(sempreDe(p), ['Destruição Divina'],
    'a subida concedeu a magia sempre preparada do Juramento da Devoção');

  // DISCRIMINADOR: era exatamente isto que apagava o dado.
  const cachePeloEspelho = await levelup.obterTodasMagiasSemprePreparadas(
    p.classe, p.subclasse, p.nivel);
  assert.deepEqual(cachePeloEspelho.map((m) => m.nome), [],
    'o cache montado pelos espelhos (Mago/Evocador/8) não conhece NENHUMA magia ' +
    'sempre preparada -- é ele que fazia a higienização apagar a do Paladino');

  // A cadeia de ABERTURA da ficha, com as funções reais.
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);
  sheetMigracoes.migrarMagiasDominio();
  sheetMigracoes.migrarMagiasSemprePreparadas();

  assert.deepEqual(sempreDe(p), ['Destruição Divina'],
    'depois de reabrir a ficha, a magia sempre preparada da SEGUNDA classe continua lá');
});

// ORÁCULO 27 -- a face inversa do mesmo defeito: classe INICIAL
// conjuradora lida no nível TOTAL concede DEMAIS.
//
// Paladino 5/Mago 4 tem nível total 9. O cache antigo pedia as magias
// sempre preparadas do Paladino no nível 9 -- e o Juramento da Devoção
// abre 'Dissipar Magia' e 'Sinal de Esperança' exatamente no 9º nível DE
// PALADINO, que este personagem não tem. Marcadas como "sempre", elas
// liberariam vagas de preparação a mais.
//
// Listas LITERAIS, medidas nesta árvore, nos dois lados.
test('classe inicial conjuradora: o cache sai do nível NA CLASSE, não do total', async () => {
  const { levelup } = mods;

  const p = await personagemMulticlasse([
    { classe: 'Paladino', nivel: 5, subclasse: 'Juramento da Devoção' },
    { classe: 'Mago', nivel: 4, subclasse: 'Evocador' },
  ]);
  assert.equal(p.nivel, 9, 'total 9 -- é ele que enganava a leitura antiga');

  const peloEspelho = (await levelup.obterTodasMagiasSemprePreparadas(
    p.classe, p.subclasse, p.nivel)).map((m) => m.nome);
  assert.deepEqual(peloEspelho, [
    'Destruição Divina', 'Escudo da Fé', 'Proteção Contra o Bem e o Mal',
    'Convocar Montaria', 'Auxílio', 'Zona da Verdade',
    'Dissipar Magia', 'Sinal de Esperança',
  ], 'a leitura antiga entrega o Paladino do nível 9 -- duas magias a mais');

  const porClasse = (await levelup.obterMagiasAutomaticasDoPersonagem(p)).sempre
    .map((m) => m.nome);
  assert.deepEqual(porClasse, [
    'Destruição Divina', 'Escudo da Fé', 'Proteção Contra o Bem e o Mal',
    'Convocar Montaria', 'Auxílio', 'Zona da Verdade',
  ], 'por classe, o Paladino entra no nível 5 DELE: sem as duas magias do 9º');
});

// ORÁCULO 28 -- CANÁRIO de não-regressão de CLASSE ÚNICA.
//
// Para uma classe só, nível-na-classe é o nível total e a classe inicial
// é a única classe: os dois caminhos TÊM de coincidir, campo a campo.
// Sem este oráculo, uma implementação que quebrasse a ficha de classe
// única (a esmagadora maioria das fichas reais) passaria pelos 26-27.
test('classe única: o cache por classe é idêntico ao cache pelo espelho', async () => {
  const { levelup } = mods;

  for (const roteiro of [
    [{ classe: 'Clérigo', nivel: 9, subclasse: 'Domínio da Vida' }],
    [{ classe: 'Paladino', nivel: 9, subclasse: 'Juramento da Devoção' }],
    [{ classe: 'Mago', nivel: 9, subclasse: 'Evocador' }],
    [{ classe: 'Druida', nivel: 9, subclasse: 'Círculo da Terra' }],
    [{ classe: 'Bardo', nivel: 9, subclasse: 'Colégio da Dança' }],
  ]) {
    const p = await personagemMulticlasse(roteiro);
    const rotulo = `${roteiro[0].classe} ${roteiro[0].nivel}`;
    const espelhoDominio = await levelup.obterTodasMagiasDominio(p.classe, p.subclasse, p.nivel);
    const espelhoSempre = await levelup.obterTodasMagiasSemprePreparadas(p.classe, p.subclasse, p.nivel);
    const auto = await levelup.obterMagiasAutomaticasDoPersonagem(p);
    assert.deepEqual(auto.dominio, espelhoDominio,
      `${rotulo}: o cache de domínio de classe única não pode mudar`);
    assert.deepEqual(auto.sempre, espelhoSempre,
      `${rotulo}: o cache de sempre preparadas de classe única não pode mudar`);
  }
});

// ORÁCULO 29 -- o IMPORTANT 1: depois de uma subida que ABRE uma classe
// nova, o mapa `classesData` da abertura da ficha não a contém, e a
// re-renderização mostra ZERO espaço de magia quando a classe nova é a
// única conjuradora.
//
// O primeiro `deepEqual` mede o DEFEITO (reserva vazia com o mapa da
// abertura) e é o que discrimina: sem ele, o oráculo passaria numa
// implementação em que o mapa nunca esteve incompleto. O segundo mede o
// conserto -- `garantirDadosDeClasses` completa o mapa que já está em
// `classesData`, sem montar outro.
//
// 2 espaços de 1º círculo é a tabela unificada para 1 nível de conjurador
// pleno (livro:2050), literal.
test('depois de abrir classe nova, garantirDadosDeClasses devolve os espaços à ficha', async () => {
  const { sheetEstado: estado, contextoClasse, db } = mods;

  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
  ]);
  // O mapa COMO A ABERTURA DA FICHA o deixou: só Bárbaro.
  const mapaDaAbertura = new Map([['Bárbaro', await db.getClasse('Bárbaro')]]);
  estado.definirChar(p);
  estado.definirClassesData(mapaDaAbertura);

  await subirAteNivel(p, 'Mago', 6); // abre Mago 1

  assert.deepEqual(p.classes.map((c) => `${c.classe} ${c.nivel}`), ['Bárbaro 5', 'Mago 1'],
    'a subida abriu a classe conjuradora nova');
  assert.deepEqual(montarReservasDeEspacos(p, mapaDaAbertura), [],
    'com o mapa da abertura -- o que a ficha re-renderizava --, a reserva é VAZIA: ' +
    'getEspacosMagia(undefined, 1) devolve {} e o Mago recém-aberto não aparece');

  await contextoClasse.garantirDadosDeClasses(p);

  assert.ok(estado.classesData.get('Mago'),
    'garantirDadosDeClasses completou o MESMO mapa com a classe nova');
  assert.deepEqual(montarReservasDeEspacos(p, estado.classesData), [
    { fonte: 'conjuracao', circulo: 1, total: 2, usados: 0, disponiveis: 2 },
  ], 'com o mapa completo, o Mago 1 traz os 2 espaços de 1º círculo da tabela unificada');
});

// ============================================================
// ORÁCULO 34 -- correção de rodada da Tarefa 3 (sub-projeto "tela magias
// por classe"): o portão de "Preparar" do painel do grimório
// (sheet/magias.js, [data-preparar-grimorio]) virou bloqueio PERMANENTE
// para qualquer personagem com outra classe conjuradora.
//
// O DEFEITO, MEDIDO PELA REVISÃO: o portão comparava uma contagem GLOBAL
// (`char.magias_preparadas` inteiro, filtrado só por `magiaContaNoLimite`
// -- TODAS as classes, porque não há campo que diga de quem é cada
// entrada) contra o limite de UMA classe (o Mago, via
// `nivelETabelaDoMago()`). Um Clérigo 5/Mago 1 com as 9 preparadas do
// Clérigo já feitas nunca conseguia preparar NENHUMA magia do grimório do
// Mago: `9 >= 4` (o limite do Mago 1) é verdadeiro em todo clique, sempre.
//
// A CORREÇÃO: contar só as preparadas que TAMBÉM estão em `char.grimorio`
// (proxy honesto -- magia de círculo do Mago tem de estar lá) quando há
// mais de uma superfície de conjuração; com só uma superfície, o bloqueio
// original continua valendo (não há ambiguidade de classe nesse caso).
//
// Clique de VERDADE via setupEventosEspacosMagia() -- mesmo padrão dos
// Oráculos 19-24, acima -- não uma reimplementação da regra dentro do
// teste.
// ============================================================
test('grimório: "Preparar" não trava permanentemente quando outra classe já tem várias preparadas (Clérigo 5/Mago 1)', async () => {
  const { sheetMagias } = mods;
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 }]);
  // 9 "preparadas do Clérigo" -- nenhuma no grimório do Mago, todas contam
  // no limite (magiaContaNoLimite: sem origem especial). O número em si
  // não importa além de "maior que o limite do Mago 1" (4, medido em
  // dados/classes/mago.json) -- 9 é o limite real de um Clérigo 5, só para
  // o cenário ficar realista.
  p.magias_preparadas = Array.from({ length: 9 }, (_, i) => ({ nome: `Magia de Clérigo ${i + 1}`, circulo: 1 }));
  p.grimorio = [{ nome: 'Armadura Arcana', circulo: 1 }]; // a única magia do Mago, ainda não preparada
  const container = criarContainerStub();
  await prepararEstadoDaFicha(p, container);

  const btn = botaoFalso({ prepararGrimorio: 'Armadura Arcana', prepCirc: '1' });
  const restaurar = instalarDocumentoPorSeletor({ '[data-preparar-grimorio]': [btn] });
  try {
    sheetMagias.setupEventosEspacosMagia();
    assert.equal(typeof btn.handlers.click, 'function',
      'setupEventosEspacosMagia tem de registrar UM clique em [data-preparar-grimorio]');
    btn.handlers.click({ stopPropagation() {} });
  } finally {
    restaurar();
  }

  assert.ok((p.magias_preparadas || []).some((m) => m.nome === 'Armadura Arcana'),
    '"Armadura Arcana" (a única magia do grimório do Mago) deveria ter sido preparada pelo clique -- ' +
    'se o portão ainda comparar a contagem GLOBAL (9, do Clérigo) contra o limite do Mago (4), o clique ' +
    `não faz nada e magias_preparadas continua sem ela: ${JSON.stringify(p.magias_preparadas)}`);
});
