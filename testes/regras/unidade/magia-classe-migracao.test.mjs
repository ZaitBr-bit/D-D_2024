// ============================================================
// Oraculos de site/js/sheet/migracoes.js -- migrarMagiaClasse() (Tarefa 3
// do sub-projeto 2026-08-29-magia-sabe-a-classe): a MIGRACAO retroativa que
// carimba `classe` em entradas de magias_preparadas[] gravadas ANTES de o
// campo existir.
//
// Diferente da Tarefa 1 (regras-magia-classe.js, a peca pura que DECIDE,
// coberta por magia-classe.test.mjs) e da Tarefa 2 (os 8 gravadores, que
// carimbam na hora da escrita, cobertos por magia-classe-gravacao.test.mjs),
// esta tarefa so alimenta a peca da Tarefa 1 com os dados certos e grava o
// que ela devolver -- nunca reimplementa o criterio "sem chute".
//
// Todos os oraculos usam dados REAIS de dados/classes/magias_*.json (via
// db.getMagiasClasse, que o stub de fetch de harness.mjs le do disco em
// Node) -- nenhum nome de magia e chutado no texto do teste sem antes ser
// medido a partir do proprio JSON.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';

// ------------------------------------------------------------
// Oraculos 1 e 2 do brief: classe unica carimba tudo, e faz isso SEM
// carregar lista de magias nenhuma.
//
// Este teste roda PRIMEIRO neste arquivo, de proposito: db.js cacheia em
// memoria por caminho (module-level, testes/regras/unidade/../../../site/js/db.js:9),
// e `node --test` executa cada arquivo *.test.mjs num processo proprio
// (isolamento por arquivo) -- entao aqui o cache de 'classes/magias_*.json'
// ainda esta vazio. Se este teste rodasse DEPOIS de qualquer outro teste
// deste arquivo que ja tivesse chamado db.getMagiasClasse('Mago') ou
// ('Clérigo'), o cache serviria a resposta sem tocar fetch nenhum, e a
// prova de "nao carregou lista nenhuma" passaria mesmo que
// migrarMagiaClasse tivesse ido a disco -- um falso negativo. Os oraculos
// 3+ abaixo SAO os que chamam getMagiasClasse, por isso ficam depois deste.
// ------------------------------------------------------------

test('classe unica (Mago 5): migrarMagiaClasse carimba as 4 entradas SEM carregar nenhuma lista de magias', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.magias_preparadas = [
    { nome: 'Bola de Fogo', circulo: 3 },
    { nome: 'Mísseis Mágicos', circulo: 1 },
    { nome: 'Escudo Arcano', circulo: 1 },
    { nome: 'Voar', circulo: 3 },
  ];
  sheetEstado.definirChar(p);

  // Espiao no `fetch` global stubado por harness.mjs (instalarStubs) --
  // unica forma de provar "nao carregou lista nenhuma" sem poder reatribuir
  // o export nomeado db.getMagiasClasse (bindings de import ES sao somente
  // leitura para quem consome). getMagiasClasse busca
  // 'classes/magias_<classe>.json'; getClasse busca 'classes/<classe>.json'
  // (sem o prefixo 'magias_') -- o filtro abaixo isola so o primeiro.
  const chamadas = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, ...resto) => {
    chamadas.push(String(url));
    return fetchOriginal(url, ...resto);
  };
  let alterado;
  try {
    alterado = await sheetMigracoes.migrarMagiaClasse();
  } finally {
    globalThis.fetch = fetchOriginal;
  }
  const chamadasDeListaDeMagias = chamadas.filter((u) => u.includes('magias_'));

  assert.equal(alterado, true, 'as 4 entradas nao tinham classe -- a migracao tinha de alterar algo');
  assert.deepEqual(chamadasDeListaDeMagias, [],
    `classe unica nao precisa consultar lista de magias nenhuma (RULING R-B, ` +
    `regras-magia-classe.js) -- migrarMagiaClasse chamou fetch para: ` +
    `${JSON.stringify(chamadasDeListaDeMagias)}`);
  for (const m of p.magias_preparadas) {
    assert.equal(m.classe, 'Mago', `"${m.nome}" tinha de sair carimbada 'Mago'`);
  }
});

// ------------------------------------------------------------
// Oraculo 3 do brief: multiclasse carimba SO o inequivoco. Os nomes sao
// MEDIDOS dentro do proprio teste (diferenca e intersecao dos Sets), nunca
// chutados -- mesma disciplina de magia-classe.test.mjs.
// ------------------------------------------------------------

test('Clérigo 5/Mago 1: migrarMagiaClasse carimba só a magia inequívoca; a compartilhada fica sem a chave classe', async () => {
  const { sheetEstado, sheetMigracoes, magiaClasse, db } = await modulosApp();
  const listaClerigo = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Clérigo'));
  const listaMago = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Mago'));
  const exclusivasDeClerigo = [...listaClerigo].filter((nome) => !listaMago.has(nome));
  const compartilhadas = [...listaClerigo].filter((nome) => listaMago.has(nome));
  assert.ok(exclusivasDeClerigo.length > 0,
    'fixture: precisa existir ao menos uma magia só na lista do Clérigo para este oráculo medir algo');
  assert.ok(compartilhadas.length > 0,
    'fixture: precisa existir ao menos uma magia nas duas listas para este oráculo medir algo');
  const nomeExclusiva = exclusivasDeClerigo[0];
  const nomeCompartilhada = compartilhadas[0];

  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  p.magias_preparadas = [
    { nome: nomeExclusiva, circulo: 1 },
    { nome: nomeCompartilhada, circulo: 1 },
  ];
  sheetEstado.definirChar(p);

  const alterado = await sheetMigracoes.migrarMagiaClasse();
  assert.equal(alterado, true, `"${nomeExclusiva}" tinha de ser carimbada -- alterado devia ser true`);

  const entradaExclusiva = p.magias_preparadas.find((m) => m.nome === nomeExclusiva);
  const entradaCompartilhada = p.magias_preparadas.find((m) => m.nome === nomeCompartilhada);
  assert.equal(entradaExclusiva.classe, 'Clérigo',
    `"${nomeExclusiva}" só bate na lista do Clérigo -- resposta devia ser inequívoca`);
  assert.ok(!('classe' in entradaCompartilhada),
    `"${nomeCompartilhada}" está nas duas listas -- carimbar seria chute; a chave classe ` +
    `não pode existir na entrada (encontrei: ${JSON.stringify(entradaCompartilhada)})`);
});

// ------------------------------------------------------------
// Oraculo 4 do brief -- RULING R-A: origem isenta nunca recebe carimbo,
// mesmo em classe única onde toda magia "normal" seria carimbada sem
// dúvida.
//
// CORREÇÃO (achado da revisão final, §4/§7 de revisao-final.md): este
// comentário afirmava que este era "o oráculo que quebra se
// migrarMagiaClasse rodar cedo demais em pages/sheet.js" -- NÃO quebra. O
// teste abaixo chama `migrarMagiaClasse()` direto sobre uma fixture que já
// tem `origem: 'iniciado_em_magia'` posta À MÃO (linha da fixture, logo
// abaixo); mover a chamada real em pages/sheet.js para antes de
// migrarMagiasDominio/migrarMagiasSemprePreparadas/sincronizarMagiasFixasMago/
// migrarMagiasLegadoEspecie não faz este teste (nem nenhum outro deste
// arquivo) ficar vermelho, porque nenhum deles exercita pages/sheet.js. A
// ORDEM de verdade só tem a guarda textual definida logo abaixo
// (guardaOrdemMigrarMagiaClasse).
// ------------------------------------------------------------

test('origem isenta (iniciado_em_magia) num Mago de classe única nunca recebe classe', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.magias_preparadas = [
    // Uma magia NORMAL na mesma ficha -- sem ela, a saída barata (que já
    // filtra por magiaContaNoLimite) devolveria false sozinha, e o teste
    // nunca chegaria a exercitar o caminho que de fato protege a magia
    // isenta (a checagem repetida dentro do laço/classeDaMagiaPreparada).
    // Ela também serve de controle: se ela não sair carimbada, a fixture
    // está quebrada, não a migração -- ver prova de mutação no relatório.
    { nome: 'Bola de Fogo', circulo: 3 },
    { nome: 'Curar Ferimentos', circulo: 1, origem: 'iniciado_em_magia' },
  ];
  sheetEstado.definirChar(p);

  const alterado = await sheetMigracoes.migrarMagiaClasse();
  assert.equal(alterado, true, 'a magia normal tinha de ser carimbada -- fixture quebrada');

  const normal = p.magias_preparadas.find((m) => m.nome === 'Bola de Fogo');
  const isenta = p.magias_preparadas.find((m) => m.nome === 'Curar Ferimentos');
  assert.equal(normal.classe, 'Mago', 'controle: a magia normal tinha de sair carimbada');
  assert.ok(!('classe' in isenta),
    'magia de talento não sai do orçamento de nenhuma classe -- não pode levar carimbo de ' +
    `classe (encontrei: ${JSON.stringify(isenta)})`);
});

// ------------------------------------------------------------
// Oraculo 5 do brief: idempotência.
// ------------------------------------------------------------

test('idempotência: rodar migrarMagiaClasse duas vezes seguidas não altera nada na segunda', async () => {
  const { sheetEstado, sheetMigracoes, magiaClasse, db } = await modulosApp();
  const listaClerigo = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Clérigo'));
  const listaMago = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Mago'));
  const exclusivasDeClerigo = [...listaClerigo].filter((nome) => !listaMago.has(nome));
  const compartilhadas = [...listaClerigo].filter((nome) => listaMago.has(nome));
  const nomeExclusiva = exclusivasDeClerigo[0];
  const nomeCompartilhada = compartilhadas[0];

  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  p.magias_preparadas = [
    { nome: nomeExclusiva, circulo: 1 },
    { nome: nomeCompartilhada, circulo: 1 },
    { nome: 'Curar Ferimentos', circulo: 1, origem: 'iniciado_em_magia' },
  ];
  sheetEstado.definirChar(p);

  const primeira = await sheetMigracoes.migrarMagiaClasse();
  assert.equal(primeira, true, 'a primeira passagem tinha de carimbar a exclusiva -- fixture quebrada');
  const instantaneo = JSON.stringify(p.magias_preparadas);

  const segunda = await sheetMigracoes.migrarMagiaClasse();
  assert.equal(segunda, false, 'a segunda passagem não devia alterar nada -- já está tudo carimbado');
  assert.equal(JSON.stringify(p.magias_preparadas), instantaneo,
    'o array de magias_preparadas não pode mudar entre a primeira e a segunda passagem');
});

// ------------------------------------------------------------
// Oraculo 6 do brief: nunca sobrescreve um carimbo que já existe.
// ------------------------------------------------------------

test('não sobrescreve um classe já gravado, mesmo quando a dedução real daria outra classe', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  // Mago de classe única: a dedução real (RULING R-B) daria 'Mago' para
  // qualquer magia que conte no limite -- mas a PRIMEIRA entrada já chegou
  // com 'Clérigo' gravado (ex.: uma passagem anterior desta própria
  // migração, ou edição manual), e o contrato proíbe sobrescrever.
  //
  // A SEGUNDA entrada (sem classe) é obrigatória na fixture -- achado da
  // revisão independente (rodada 1/5): sem ela, a única entrada já teria
  // classe, a saída barata (passo 3 do brief) devolveria false sozinha, e o
  // teste nunca chegaria a exercitar o `continue` de "nunca sobrescreve"
  // dentro do laço -- passaria mesmo que essa guarda fosse removida (mesmo
  // defeito, mesma causa, que já tinha sido corrigido no oráculo 4; ver
  // prova de mutação no relatório). Com a segunda entrada, faltaCarimbar
  // dá true e o laço roda de verdade sobre as duas.
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.magias_preparadas = [
    { nome: 'Bola de Fogo', circulo: 3, classe: 'Clérigo' },
    { nome: 'Mísseis Mágicos', circulo: 1 },
  ];
  sheetEstado.definirChar(p);

  const alterado = await sheetMigracoes.migrarMagiaClasse();
  assert.equal(alterado, true, 'a segunda entrada não tinha classe -- a migração tinha de carimbá-la');

  assert.equal(p.magias_preparadas[0].classe, 'Clérigo',
    'o carimbo existente da primeira entrada não pode ser trocado, mesmo que a dedução real ' +
    'desse outra classe');
  assert.equal(p.magias_preparadas[1].classe, 'Mago',
    'controle: a segunda entrada (sem carimbo prévio) tinha de ser carimbada normalmente -- ' +
    'se isto falhar, o problema é a fixture, não a guarda de não-sobrescrita');
});

// ------------------------------------------------------------
// Oraculo 7 do brief: nunca grava valor vazio -- toda entrada, depois da
// migração, ou não tem a chave classe, ou tem string não vazia. Varre um
// personagem que combina os quatro casos (carimbada, ambígua, isenta, já
// carimbada) numa passada só.
// ------------------------------------------------------------

test('nunca grava classe vazia -- toda entrada fica ausente OU com string não vazia', async () => {
  const { sheetEstado, sheetMigracoes, magiaClasse, db } = await modulosApp();
  const listaClerigo = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Clérigo'));
  const listaMago = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Mago'));
  const exclusivasDeClerigo = [...listaClerigo].filter((nome) => !listaMago.has(nome));
  const compartilhadas = [...listaClerigo].filter((nome) => listaMago.has(nome));

  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  p.magias_preparadas = [
    { nome: exclusivasDeClerigo[0], circulo: 1 },                          // vai ser carimbada
    { nome: compartilhadas[0], circulo: 1 },                               // ambígua -> sem a chave
    { nome: 'Curar Ferimentos', circulo: 1, origem: 'iniciado_em_magia' }, // isenta -> sem a chave
    { nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' },               // já carimbada -> preservada
  ];
  sheetEstado.definirChar(p);

  await sheetMigracoes.migrarMagiaClasse();

  assert.equal(p.magias_preparadas.length, 4, 'a migração não pode adicionar nem remover entradas');
  for (const m of p.magias_preparadas) {
    if (!Object.prototype.hasOwnProperty.call(m, 'classe')) continue;
    assert.equal(typeof m.classe, 'string', `"${m.nome}": chave classe presente mas não é string`);
    assert.ok(m.classe.trim() !== '', `"${m.nome}": chave classe presente mas vazia`);
  }
});

// ------------------------------------------------------------
// Oraculo 8 do brief: ficha sem magias_preparadas (ausente ou vazio)
// devolve false sem lançar.
// ------------------------------------------------------------

test('ficha sem magias_preparadas (ausente ou vazio) devolve false sem lançar', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();

  const p1 = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  delete p1.magias_preparadas;
  sheetEstado.definirChar(p1);
  let resultado1;
  await assert.doesNotReject(async () => { resultado1 = await sheetMigracoes.migrarMagiaClasse(); });
  assert.equal(resultado1, false, 'sem o array magias_preparadas, não há nada para migrar');

  const p2 = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p2.magias_preparadas = [];
  sheetEstado.definirChar(p2);
  let resultado2;
  await assert.doesNotReject(async () => { resultado2 = await sheetMigracoes.migrarMagiaClasse(); });
  assert.equal(resultado2, false, 'array vazio, nada para migrar');
});

// ============================================================
// Guarda textual: a ORDEM de chamada em site/js/pages/sheet.js.
//
// Achado da revisão final (Minor "consertar agora" 4 do task-6-brief.md,
// detalhado em §4/§7 de revisao-final.md): nenhum oráculo, de unidade ou
// e2e, prende a ordem em que pages/sheet.js chama os migradores -- os
// oráculos acima chamam migrarMagiaClasse() direto sobre fixtures que JÁ
// têm `origem` posta à mão (ver correção no comentário do Oráculo 4,
// acima), então mover a chamada real para antes de migrarMagiasDominio()
// não faz nada ficar vermelho. A ordem importa porque migrarMagiaClasse()
// tem de rodar DEPOIS de todo migrador/sincronizador que atribui `origem`
// retroativa a entradas JÁ EXISTENTES de magias_preparadas -- uma magia de
// domínio/sempre-preparada/maestria/assinatura/espécie ainda sem `origem`
// pareceria uma magia normal de classe para classeDaMagiaPreparada e seria
// carimbada PERMANENTEMENTE (a migração nunca sobrescreve um carimbo já
// gravado) -- exatamente o que a regra "sem chute" proíbe.
//
// Guarda TEXTUAL sobre o código-fonte, padrão já usado neste repositório
// (classes-passivas.test.mjs:1048, aplicaBonusTruqueTaumaturgo) e por este
// mesmo sub-projeto (magia-classe-gravacao.test.mjs,
// extrairCorpoConfirmarLevelUp): lê site/js/pages/sheet.js e prova, por
// posição de string, que a chamada a migrarMagiaClasse() vem depois das
// quatro chamadas que atribuem origem retroativa -- sincronizarMagiasFixasMago
// inclusive, que mora em site/js/sheet/classes/mago.js, fora do arquivo de
// migrações (site/js/sheet/migracoes.js).
// ============================================================

// Remove comentários de bloco e de linha, para que as buscas de posição
// abaixo não confundam texto de COMENTÁRIO (que também cita os nomes das
// funções) com a chamada real no código. Cópia local do mesmo utilitário
// de classes-passivas.test.mjs:879 e magia-classe-gravacao.test.mjs:120 --
// não há versão exportada de harness.mjs para reaproveitar.
function removerComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

test('guarda textual: pages/sheet.js chama migrarMagiaClasse() depois de todo migrador que atribui origem retroativa', () => {
  const caminho = resolve(RAIZ, 'site/js/pages/sheet.js');
  const src = removerComentarios(readFileSync(caminho, 'utf-8'));

  const posMigrarMagiaClasse = src.indexOf('migrarMagiaClasse(');
  assert.ok(posMigrarMagiaClasse !== -1,
    'sanity: não achei a chamada a migrarMagiaClasse() em site/js/pages/sheet.js -- foi renomeada ' +
    'ou removida, e esta guarda precisa ser revista.');

  // As quatro chamadas que atribuem `origem` retroativa a entradas JÁ
  // EXISTENTES de magias_preparadas (ver comentário acima). migrarMulticlasse()
  // fica de fora de propósito: ela não mexe em `origem`, só reconcilia
  // classes[] -- é pré-requisito de superficiesDeConjuracao, não desta regra.
  const chamadasAnteriores = [
    'migrarMagiasDominio(',
    'migrarMagiasSemprePreparadas(',
    'sincronizarMagiasFixasMago(',
    'migrarMagiasLegadoEspecie(',
  ];
  for (const chamada of chamadasAnteriores) {
    const pos = src.indexOf(chamada);
    assert.ok(pos !== -1,
      `sanity: não achei a chamada a ${chamada}) em site/js/pages/sheet.js -- foi renomeada ou ` +
      'removida, e esta guarda precisa ser revista.');
    assert.ok(pos < posMigrarMagiaClasse,
      `${chamada}) tem de rodar ANTES de migrarMagiaClasse() em pages/sheet.js. Se isto falhar, ` +
      'alguém moveu a ordem das migrações -- uma magia de domínio/sempre-preparada/maestria/' +
      'assinatura/espécie sem `origem` atribuída ainda pareceria uma magia normal de classe, e ' +
      'ganharia um carimbo de classe permanente e errado.');
  }
});
