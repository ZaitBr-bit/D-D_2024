// ============================================================
// Oraculos de site/js/regras-magia-classe.js -- a peca pura "de que classe
// e esta magia preparada?" (Tarefa 1 do sub-projeto
// 2026-08-29-magia-sabe-a-classe).
//
// Todos os oraculos usam dados REAIS de dados/classes/magias_*.json (via
// db.getMagiasClasse, que o stub de fetch de harness.mjs le do disco em
// Node) -- nenhum nome de magia e chutado no texto do teste sem antes ser
// medido a partir do proprio JSON.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

// ------------------------------------------------------------
// nomesDaListaDeMagias
// ------------------------------------------------------------

test('nomesDaListaDeMagias sobre o JSON real do Mago inclui um truque e uma magia de circulo alto', async () => {
  const { magiaClasse, db } = await modulosApp();
  const jsonMago = await db.getMagiasClasse('Mago');
  const nomes = magiaClasse.nomesDaListaDeMagias(jsonMago);

  assert.ok(nomes.has('Amigos'),
    'Amigos e um truque (0 circulo) do Mago -- se faltar, a leitura de "Truques" quebrou');

  const nonoCirculo = jsonMago.lista_magias['9º Círculo'];
  assert.ok(Array.isArray(nonoCirculo) && nonoCirculo.length > 0,
    'fixture: dados/classes/magias_mago.json precisa ter ao menos uma magia de 9º Círculo');
  const nomeCirculoAlto = nonoCirculo[0].nome;
  assert.ok(nomes.has(nomeCirculoAlto),
    `"${nomeCirculoAlto}" e de 9º Círculo -- se faltar, a leitura parou nos circulos baixos`);

  assert.ok(nomes.size > 100,
    `esperava mais de 100 magias distintas na lista do Mago, achou ${nomes.size}`);
});

test('nomesDaListaDeMagias(null) devolve Set vazio', async () => {
  const { magiaClasse } = await modulosApp();
  assert.deepEqual(magiaClasse.nomesDaListaDeMagias(null), new Set(),
    'entrada nula nao pode lancar nem devolver algo diferente de Set vazio');
});

test('nomesDaListaDeMagias({}) devolve Set vazio', async () => {
  const { magiaClasse } = await modulosApp();
  assert.deepEqual(magiaClasse.nomesDaListaDeMagias({}), new Set(),
    'objeto sem lista_magias nao pode lancar nem devolver algo diferente de Set vazio');
});

test('nomesDaListaDeMagias ignora entradas de circulo que nao sao array', async () => {
  const { magiaClasse } = await modulosApp();
  const nomes = magiaClasse.nomesDaListaDeMagias({
    lista_magias: { 'Truques': [{ nome: 'Luz' }], 'Lixo': 'nao e array', 'Vazio': null },
  });
  assert.deepEqual(nomes, new Set(['Luz']));
});

// ------------------------------------------------------------
// classeDaMagiaPreparada -- classe unica
// ------------------------------------------------------------

// Oraculo 3 do brief: classe unica, qualquer magia -> a classe, mesmo
// passando listasPorClasse null explicitamente (a funcao nem precisa
// olhar para o parametro quando so ha uma superficie).
test('classe unica (Mago 5): qualquer magia preparada e da classe unica, mesmo com listasPorClasse null', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const classe = magiaClasse.classeDaMagiaPreparada(
    p, { nome: 'Bola de Fogo', circulo: 3 }, { listasPorClasse: null });
  assert.equal(classe, 'Mago',
    'com uma unica superficie de conjuracao a resposta nao depende de listasPorClasse');
});

// Oraculo 4 do brief: mesmo uma magia que NAO esta na lista da classe
// (personalizada, ou lista que o app nao tem) ainda e atribuida a ela --
// nao ha ambiguidade possivel com uma unica superficie (RULING R-B).
test('classe unica (Mago 5): magia fora da lista da classe ainda e atribuida a ela', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const classe = magiaClasse.classeDaMagiaPreparada(
    p, { nome: 'Magia Personalizada Que Nao Esta Em Lista Nenhuma', circulo: 1 });
  assert.equal(classe, 'Mago',
    'RULING R-B: personagem so conjura por Mago, entao toda magia preparada que conta e do Mago');
});

// Oraculo 5 do brief: sem nenhuma superficie de conjuracao -> null.
test('personagem sem nenhuma superficie de conjuracao (Barbaro 5) devolve null', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 5 }]);
  const classe = magiaClasse.classeDaMagiaPreparada(p, { nome: 'Bola de Fogo', circulo: 3 });
  assert.equal(classe, null, 'Bárbaro puro nao conjura -- superficiesDeConjuracao devolve []');
});

// Oraculo 6 do brief -- RULING R-A, o mais facil de quebrar por descuido.
// Magia de origem isenta (talento) NAO conta no limite de uma classe,
// entao nao pode receber carimbo de classe -- mesmo em classe unica, onde
// toda magia "normal" seria carimbada sem duvida.
test('magia de origem isenta (RULING R-A) nao recebe classe, mesmo em classe unica', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const classe = magiaClasse.classeDaMagiaPreparada(
    p, { nome: 'Curar Ferimentos', circulo: 1, origem: 'iniciado_em_magia' });
  assert.equal(classe, null,
    'magia de talento (Iniciado em Magia) nao sai do orcamento de uma classe -- nao pode levar carimbo de classe');
});

// ------------------------------------------------------------
// classeDaMagiaPreparada -- multiclasse (Clerigo 5 / Mago 1)
// ------------------------------------------------------------

// Oraculo 7 do brief: uma magia que so existe na lista do Clerigo ->
// 'Clérigo'. O nome e MEDIDO dentro do proprio teste (diferenca dos dois
// Sets), nunca chutado.
test('Clérigo 5/Mago 1: magia exclusiva da lista do Clérigo e atribuida a ele', async () => {
  const { magiaClasse, db } = await modulosApp();
  const listaClerigo = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Clérigo'));
  const listaMago = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Mago'));
  const exclusivasDeClerigo = [...listaClerigo].filter((nome) => !listaMago.has(nome));
  assert.ok(exclusivasDeClerigo.length > 0,
    'fixture: precisa existir ao menos uma magia so na lista do Clérigo para este oráculo medir algo');
  const nomeMagia = exclusivasDeClerigo[0];

  const listasPorClasse = new Map([['Clérigo', listaClerigo], ['Mago', listaMago]]);
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  const classe = magiaClasse.classeDaMagiaPreparada(
    p, { nome: nomeMagia, circulo: 1 }, { listasPorClasse });
  assert.equal(classe, 'Clérigo',
    `"${nomeMagia}" só bate na lista do Clérigo -- resposta devia ser inequívoca`);
});

// Oraculo 8 do brief -- a outra metade da regra "sem chute": magia
// presente nas DUAS listas e genuinamente ambigua -> null, nao um palpite.
test('Clérigo 5/Mago 1: magia presente nas duas listas é ambígua -> null', async () => {
  const { magiaClasse, db } = await modulosApp();
  const listaClerigo = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Clérigo'));
  const listaMago = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Mago'));
  const compartilhadas = [...listaClerigo].filter((nome) => listaMago.has(nome));
  assert.ok(compartilhadas.length > 0,
    'fixture: precisa existir ao menos uma magia nas duas listas para este oráculo medir algo');
  const nomeMagia = compartilhadas[0];

  const listasPorClasse = new Map([['Clérigo', listaClerigo], ['Mago', listaMago]]);
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  const classe = magiaClasse.classeDaMagiaPreparada(
    p, { nome: nomeMagia, circulo: 1 }, { listasPorClasse });
  assert.equal(classe, null,
    `"${nomeMagia}" está nas duas listas -- não há como saber de qual classe é sem chutar`);
});

// Oraculo 9 do brief: mesma dupla, mas sem listasPorClasse -> null. A
// funcao NUNCA chuta na duvida, mesmo quando "poderia" adivinhar.
test('Clérigo 5/Mago 1 sem listasPorClasse nunca chuta -> null', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  const classe = magiaClasse.classeDaMagiaPreparada(p, { nome: 'Bola de Fogo', circulo: 3 });
  assert.equal(classe, null,
    'com duas ou mais superfícies e sem listasPorClasse utilizável, a função não pode decidir');
});

// Oraculo 10 do brief: entrada sem nome (ou nao-string) devolve null sem
// lancar, para qualquer numero de superficies.
test('magia sem nome (ou nula) devolve null sem lançar', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  assert.equal(magiaClasse.classeDaMagiaPreparada(p, null), null);
  assert.equal(magiaClasse.classeDaMagiaPreparada(p, {}), null);
  assert.equal(magiaClasse.classeDaMagiaPreparada(p, { nome: '' }), null);
  assert.equal(magiaClasse.classeDaMagiaPreparada(p, { nome: '   ' }), null);
  assert.equal(magiaClasse.classeDaMagiaPreparada(p, { nome: 123 }), null);
});

// ------------------------------------------------------------
// Cobertura extra: a CHAVE de listasPorClasse é o nome da LISTA
// (listaMagias), não o nome da classe -- Cavaleiro Místico usa a lista
// 'Mago' com classe 'Guerreiro'. Sem estes dois oráculos, uma
// implementação que confundisse `s.classe` com `s.listaMagias` passaria
// em todos os oráculos acima (nenhum deles usa uma subclasse conjuradora).
// ------------------------------------------------------------

test('classe única por SUBCLASSE conjuradora (Cavaleiro Místico): devolve a CLASSE, não a lista', async () => {
  const { magiaClasse } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5, subclasse: 'Cavaleiro Místico' },
  ]);
  // Nem sequer precisa de listasPorClasse: superfície única, RULING R-B.
  const classe = magiaClasse.classeDaMagiaPreparada(p, { nome: 'Mãos Flamejantes', circulo: 1 });
  assert.equal(classe, 'Guerreiro',
    'a superfície tem classe "Guerreiro" e listaMagias "Mago" -- a resposta é a CLASSE');
});

test('Guerreiro (Cavaleiro Místico) 5/Mago 5: as duas superfícies casam pela MESMA lista "Mago" -> ambíguo', async () => {
  const { magiaClasse, db } = await modulosApp();
  const listaMago = magiaClasse.nomesDaListaDeMagias(await db.getMagiasClasse('Mago'));
  const listasPorClasse = new Map([['Mago', listaMago]]);
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5, subclasse: 'Cavaleiro Místico' },
    { classe: 'Mago', nivel: 5 },
  ]);
  const nomeMagia = [...listaMago][0];
  const classe = magiaClasse.classeDaMagiaPreparada(
    p, { nome: nomeMagia, circulo: 1 }, { listasPorClasse });
  assert.equal(classe, null,
    'as duas superfícies (classe "Guerreiro" e classe "Mago") casam pela mesma lista "Mago" -- ' +
    'duas classes distintas batem, então é genuinamente ambíguo');
});
