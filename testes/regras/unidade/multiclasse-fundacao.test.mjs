// ============================================================
// Fundação de multiclasse: modelo de dados, acessores e migração.
//
// Este motor NÃO confronta o app com o livro -- ele confronta o app
// com o CONTRATO do modelo novo, descrito em
// docs/superpowers/specs/2026-08-22-multiclasse-fundacao-design.md.
// O confronto com o livro está em multiclasse-catalogo.test.mjs.
//
// Nenhum teste aqui pode passar antes da implementação: rode o arquivo
// contra a árvore intacta e confirme `# pass 0` antes de codar.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { modulosApp, RAIZ, personagemMulticlasse } from './harness.mjs';
import { PRE_REQUISITOS, CATEGORIA_CONJURACAO, PROFICIENCIAS_MULTICLASSE } from '../catalogo/multiclasse.mjs';

test('nivelTotal soma os níveis das classes', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Paladino', subclasse: '', nivel: 3, ordem: 0 },
    { classe: 'Feiticeiro', subclasse: '', nivel: 2, ordem: 1 },
  ] };
  assert.equal(multiclasse.nivelTotal(p), 5);
});

test('nivelNa devolve o nível naquela classe, e 0 para classe ausente', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Paladino', subclasse: '', nivel: 3, ordem: 0 },
    { classe: 'Feiticeiro', subclasse: '', nivel: 2, ordem: 1 },
  ] };
  assert.equal(multiclasse.nivelNa(p, 'Paladino'), 3);
  assert.equal(multiclasse.nivelNa(p, 'Feiticeiro'), 2);
  assert.equal(multiclasse.nivelNa(p, 'Mago'), 0,
    'classe ausente tem de devolver 0, nunca undefined nem NaN');
});

test('temClasse responde sobre presença, não sobre a primeira classe', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Paladino', subclasse: '', nivel: 3, ordem: 0 },
    { classe: 'Feiticeiro', subclasse: '', nivel: 2, ordem: 1 },
  ] };
  assert.equal(multiclasse.temClasse(p, 'Feiticeiro'), true,
    'a segunda classe também conta -- é o ponto da função');
  assert.equal(multiclasse.temClasse(p, 'Mago'), false);
});

test('classeInicial é a de ordem 0, não a primeira do array', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Feiticeiro', subclasse: '', nivel: 2, ordem: 1 },
    { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 3, ordem: 0 },
  ] };
  assert.equal(multiclasse.classeInicial(p).classe, 'Paladino');
});

test('subclasseDe devolve a subclasse daquela classe', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 5, ordem: 0 },
    { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 5, ordem: 1 },
  ] };
  assert.equal(multiclasse.subclasseDe(p, 'Paladino'), 'Juramento da Devoção');
  assert.equal(multiclasse.subclasseDe(p, 'Clérigo'), 'Domínio da Vida');
  assert.equal(multiclasse.subclasseDe(p, 'Mago'), '',
    'classe ausente devolve string vazia, nunca undefined');
});

// ORÁCULO 5 -- o mais importante deste arquivo.
// As migrações do app são PREGUIÇOSAS: rodam na abertura da ficha
// (pages/sheet.js:47-60). Uma ficha pode viver em localStorage, ser
// exportada e ser sincronizada SEM NUNCA ter sido migrada. Todo caminho
// que lê classe ou nível sem abrir a ficha depende desta normalização.
test('classesDe normaliza ficha legada NÃO migrada', async () => {
  const { multiclasse } = await modulosApp();
  const legado = { classe: 'Mago', subclasse: 'Evocador', nivel: 7 };
  const classes = multiclasse.classesDe(legado);
  assert.equal(classes.length, 1);
  assert.deepEqual(classes[0], {
    classe: 'Mago', subclasse: 'Evocador', nivel: 7, ordem: 0,
  });
  assert.equal(multiclasse.nivelTotal(legado), 7);
  assert.equal(multiclasse.nivelNa(legado, 'Mago'), 7);
  assert.equal(multiclasse.temClasse(legado, 'Mago'), true);
});

test('classesDe sobre objeto vazio devolve array vazio, não lança', async () => {
  const { multiclasse } = await modulosApp();
  assert.deepEqual(multiclasse.classesDe({}), []);
  assert.deepEqual(multiclasse.classesDe(null), []);
  assert.equal(multiclasse.nivelTotal({}), 0);
  // Canário (achado do Passo 2): um esqueleto que sempre devolve `[]`
  // passaria nas três linhas acima sem medir nada. Um personagem NÃO
  // vazio tem de produzir uma entrada -- senão a função é uma constante
  // disfarçada de implementação.
  assert.equal(multiclasse.classesDe({ classe: 'Mago', nivel: 1 }).length, 1);
});

// ORÁCULO 10 -- coerência entre as duas fontes.
// `atributo_primario` (prosa) e `atributos_primarios` (estruturado)
// descrevem o mesmo fato. Duas fontes da mesma verdade que ninguém
// confronta divergem em silêncio -- foi o que a spec de 2026-08-07 já
// registrou entre CLASSES_INFO e tracos_basicos.
test('atributos_primarios bate com o catálogo e com a prosa de atributo_primario', async () => {
  const { dadosClasses } = await modulosApp();
  const info = dadosClasses.CLASSES_INFO;
  const nomes = Object.keys(PRE_REQUISITOS);
  assert.equal(nomes.length, 12, 'o catálogo tem de cobrir as 12 classes');

  for (const nome of nomes) {
    const est = info[nome]?.atributos_primarios;
    assert.ok(est, `${nome}: falta atributos_primarios em CLASSES_INFO`);
    assert.deepEqual(est.lista, PRE_REQUISITOS[nome].lista, `${nome}: lista divergente do livro`);
    assert.equal(est.conector, PRE_REQUISITOS[nome].conector, `${nome}: conector divergente do livro`);

    // A prosa continua sendo a fonte de exibição e dos 4 consumidores
    // que fazem `.includes(nome)`. Ela tem de conter cada atributo da
    // lista estruturada -- é isso que impede as duas de divergirem.
    for (const attr of est.lista) {
      assert.ok(info[nome].atributo_primario.includes(attr),
        `${nome}: "${attr}" está na lista estruturada mas não na prosa "${info[nome].atributo_primario}"`);
    }
  }
});

test('categoria_conjuracao bate com o catálogo, e conjurador continua booleano', async () => {
  const { dadosClasses } = await modulosApp();
  const info = dadosClasses.CLASSES_INFO;
  for (const [nome, categoria] of Object.entries(CATEGORIA_CONJURACAO)) {
    assert.equal(info[nome]?.categoria_conjuracao, categoria, `${nome}: categoria divergente do livro`);
    // GUARDA: 19 consumidores usam `info.conjurador` por VERACIDADE.
    // Se algum dia virar string, 'nenhuma' seria truthy e todo marcial
    // viraria conjurador em silêncio. Este assert é o que impede isso.
    assert.equal(typeof info[nome].conjurador, 'boolean',
      `${nome}: conjurador tem de continuar booleano`);
  }
});

test('proficiencias_multiclasse bate com o livro nas 12 classes', async () => {
  const { dadosClasses } = await modulosApp();
  const info = dadosClasses.CLASSES_INFO;
  for (const [nome, esperado] of Object.entries(PROFICIENCIAS_MULTICLASSE)) {
    const obtido = info[nome]?.proficiencias_multiclasse;
    assert.ok(obtido, `${nome}: falta proficiencias_multiclasse`);
    assert.deepEqual(obtido.armaduras, esperado.armaduras, `${nome}: armaduras`);
    assert.deepEqual(obtido.armas, esperado.armas, `${nome}: armas`);
    assert.equal(obtido.pericias, esperado.pericias, `${nome}: perícias`);
    assert.deepEqual(obtido.ferramentas, esperado.ferramentas, `${nome}: ferramentas`);
    assert.equal(obtido.instrumentos, esperado.instrumentos, `${nome}: instrumentos`);
  }
});

// ASSERÇÃO NEGATIVA -- vale mais que a positiva aqui.
// Um implementador com pressa copiaria as proficiências de classe única
// para o campo novo, e todos os deepEqual acima passariam nas classes
// generosas. Estas três provam que o SUBCONJUNTO foi respeitado.
test('Mago, Monge e Feiticeiro não concedem proficiência alguma em multiclasse', async () => {
  const { dadosClasses } = await modulosApp();
  for (const nome of ['Mago', 'Monge', 'Feiticeiro']) {
    const p = dadosClasses.CLASSES_INFO[nome].proficiencias_multiclasse;
    assert.deepEqual(p.armaduras, [], `${nome}: o livro concede só o Dado de Ponto de Vida`);
    assert.deepEqual(p.armas, [], `${nome}: nem armas Simples`);
    assert.equal(p.pericias, 0, `${nome}: nenhuma perícia`);
  }
});

// NENHUMA classe concede salvaguardas em multiclasse (livro:2049-2051).
// As duas vêm só da classe inicial.
test('nenhuma classe concede salvaguardas em multiclasse', async () => {
  const { dadosClasses } = await modulosApp();
  for (const nome of Object.keys(PROFICIENCIAS_MULTICLASSE)) {
    assert.deepEqual(dadosClasses.CLASSES_INFO[nome].proficiencias_multiclasse.salvaguardas, [],
      `${nome}: salvaguardas vêm só da classe inicial`);
  }
});

// O Bárbaro é a armadilha do conjunto: concede armas Marciais mas NÃO
// Simples, e Escudos mas NÃO armadura Leve nem Média -- ao contrário do
// que a proficiência de classe única faria supor.
test('Bárbaro em multiclasse: Marciais sem Simples, Escudo sem armadura', async () => {
  const { dadosClasses } = await modulosApp();
  const info = dadosClasses.CLASSES_INFO['Bárbaro'];
  const mc = info.proficiencias_multiclasse;
  assert.deepEqual(mc.armas, ['Marcial']);
  assert.deepEqual(mc.armaduras, ['Escudo']);
  assert.ok(info.armas.includes('Simples'),
    'a proficiência de CLASSE ÚNICA continua tendo Simples -- o subconjunto não pode contaminá-la');
});

// ============================================================
// Tarefa 6 -- migração, espelhos e reservas de dado de vida.
// ============================================================

// ORÁCULOS 1 e 2 -- as duas propriedades que tornam a migração segura.
test('migração é idempotente: rodar duas vezes não muda nada', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 5,
              dados_vida_total: 5, dados_vida_usados: 2, atributos: {} };
  assert.equal(multiclasse.migrarParaMulticlasse(p), true, 'a primeira passagem altera');
  // ESTADO ABSOLUTO depois da PRIMEIRA passagem -- não só que a segunda
  // não muda nada, mas que a primeira produziu o valor CERTO. Sem isto,
  // gravar `p.dados_vida` (armadilha 1 do brief: preservar o gasto
  // legado) DEPOIS de sincronizarEspelhos() em vez de antes passaria
  // aqui do mesmo jeito -- o objeto ficaria estável, só que estável no
  // valor errado (usados perdido).
  assert.deepEqual(p.dados_vida, { 10: { total: 5, usados: 2 } },
    'Paladino usa d10; o gasto legado (usados: 2) tem de sobreviver à migração');
  assert.equal(p.dados_vida_total, 5);
  assert.equal(p.dados_vida_usados, 2);
  const depoisDaPrimeira = JSON.parse(JSON.stringify(p));
  assert.equal(multiclasse.migrarParaMulticlasse(p), false, 'a segunda não altera');
  assert.deepEqual(p, depoisDaPrimeira, 'o objeto tem de ficar idêntico');
});

test('migração é não destrutiva: os três escalares sobrevivem', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classe: 'Mago', subclasse: 'Evocador', nivel: 7,
              dados_vida_total: 7, dados_vida_usados: 0, atributos: {} };
  multiclasse.migrarParaMulticlasse(p);
  assert.equal(p.classe, 'Mago');
  assert.equal(p.subclasse, 'Evocador');
  assert.equal(p.nivel, 7);
  assert.equal(p.schema_versao, 2);
  assert.deepEqual(p.classes, [
    { classe: 'Mago', subclasse: 'Evocador', nivel: 7, ordem: 0 },
  ]);
});

test('migração é fiel nas 12 classes', async () => {
  const { multiclasse, dadosClasses } = await modulosApp();
  for (const nome of Object.keys(dadosClasses.CLASSES_INFO)) {
    for (const nivel of [1, 5, 11, 20]) {
      const p = { classe: nome, subclasse: '', nivel,
                  dados_vida_total: nivel, dados_vida_usados: 0, atributos: {} };
      multiclasse.migrarParaMulticlasse(p);
      assert.equal(multiclasse.nivelNa(p, nome), nivel, `${nome} nível ${nivel}`);
      assert.equal(multiclasse.nivelTotal(p), nivel, `${nome} nível ${nivel}: total`);
      assert.equal(multiclasse.classeInicial(p).classe, nome);
    }
  }
});

// ORÁCULO 7 -- o livro exige reservas SEPARADAS por tipo de dado
// (livro:2043), e dá os dois exemplos que este teste usa.
test('dados de vida ficam em reservas por tipo de dado', async () => {
  const { multiclasse } = await modulosApp();

  // Exemplo literal do livro: Clérigo 5/Paladino 5 = cinco d8 e cinco d10.
  const misto = { classes: [
    { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
    { classe: 'Paladino', subclasse: '', nivel: 5, ordem: 1 },
  ], dados_vida_usados: 0, atributos: {} };
  multiclasse.sincronizarEspelhos(misto);
  assert.deepEqual(misto.dados_vida, {
    8: { total: 5, usados: 0 },
    10: { total: 5, usados: 0 },
  });

  // Outro exemplo do livro: dados do MESMO tipo se combinam.
  const iguais = { classes: [
    { classe: 'Guerreiro', subclasse: '', nivel: 5, ordem: 0 },
    { classe: 'Paladino', subclasse: '', nivel: 5, ordem: 1 },
  ], dados_vida_usados: 0, atributos: {} };
  multiclasse.sincronizarEspelhos(iguais);
  assert.deepEqual(iguais.dados_vida, { 10: { total: 10, usados: 0 } });

  // O espelho de soma (dados_vida_total) é mantido para fichas salvas por
  // versões anteriores e para os escritores legados do fluxo de criação e
  // subida que ainda restam (creator/wizard.js, levelup.js, store.js --
  // escopo do sub-projeto 5). hp-descanso.js e ficha.js pararam de ler o
  // escalar no sub-projeto 3e -- passaram a chamar reservasDadosVida().
  assert.equal(misto.dados_vida_total, 10);
  assert.equal(iguais.dados_vida_total, 10);
});

// Sem este teste, zerar `usados: usadosAnteriores[faces]?.usados || 0`
// (ler sempre 0 em vez do valor anterior) passa a suíte inteira -- nenhum
// oráculo acima recria sincronizarEspelhos() sobre um personagem que já
// tem dados_vida com gasto em MAIS DE UMA reserva.
test('sincronizarEspelhos preserva o "usados" anterior em duas reservas distintas', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
    { classe: 'Paladino', subclasse: '', nivel: 5, ordem: 1 },
  ], dados_vida: { 8: { total: 0, usados: 3 }, 10: { total: 0, usados: 4 } },
     atributos: {} };
  multiclasse.sincronizarEspelhos(p);
  assert.deepEqual(p.dados_vida, {
    8: { total: 5, usados: 3 },
    10: { total: 5, usados: 4 },
  }, 'os dois gastos anteriores têm de sobreviver, cada um na sua reserva');
  assert.equal(p.dados_vida_usados, 7, 'o espelho de soma tem de somar os dois gastos');
});

// Sem este teste, remover o bloco de clamp inteiro passa a suíte inteira.
// Cenário do livro: personagem perde nível (ou a ficha foi editada à mão)
// e o "usados" registrado excede o "total" recalculado -- o gasto não
// pode superar o total de dados de vida que a classe realmente tem.
test('sincronizarEspelhos limita "usados" ao "total" quando o personagem perde níveis', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Guerreiro', subclasse: '', nivel: 5, ordem: 0 },
  ], dados_vida: { 10: { total: 0, usados: 8 } }, atributos: {} };
  multiclasse.sincronizarEspelhos(p);
  assert.deepEqual(p.dados_vida, { 10: { total: 5, usados: 5 } },
    'usados: 8 chegando para um total recalculado de 5 tem de ser CORTADO em 5, não zerado nem deixado em 8');
  assert.equal(p.dados_vida_usados, 5, 'o espelho de soma tem de refletir o valor já cortado');
});

// ORÁCULO (correção final, item 4) -- classe fora de CLASSES_INFO (nome
// inventado, ou nome acentuado em forma Unicode diferente) faz `faces`
// sair falsy para toda entrada; sem a guarda, `reservas` fica vazio e as
// somas espelhadas zeravam -- `dados_vida_usados` é LIDO pelo jogador, e a
// ficha voltaria a mostrar os dados de vida cheios mentindo sobre o gasto.
test('sincronizarEspelhos preserva dados_vida_usados quando nenhuma classe bate com CLASSES_INFO', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Classe Inventada', subclasse: '', nivel: 5, ordem: 0 },
  ], dados_vida_total: 5, dados_vida_usados: 3, atributos: {} };
  multiclasse.sincronizarEspelhos(p);
  assert.equal(p.dados_vida_total, 5,
    'sem reserva possível, o total pré-existente tem de sobreviver');
  assert.equal(p.dados_vida_usados, 3,
    'sem reserva possível, o gasto pré-existente tem de sobreviver -- não pode zerar');
});

// A entrada de ordem 0 (Paladino) vem SEGUNDA no array, de propósito: se
// sincronizarEspelhos() lesse `lista[0]` em vez de chamar classeInicial(p),
// este teste pegaria a troca -- com a ordem 0 na posição 0 do array (como
// estava antes), as duas implementações produzem o mesmo resultado e o
// teste não mediria o que promete.
test('sincronizarEspelhos escreve os três escalares a partir de classes[]', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Feiticeiro', subclasse: 'Linhagem Dracônica', nivel: 2, ordem: 1 },
    { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 3, ordem: 0 },
  ], dados_vida_usados: 0, atributos: {} };
  multiclasse.sincronizarEspelhos(p);
  assert.equal(p.classe, 'Paladino',
    'o espelho de classe é a classe INICIAL (ordem 0), não classes[0]');
  assert.equal(p.subclasse, 'Juramento da Devoção');
  assert.equal(p.nivel, 5, 'o espelho de nível é o TOTAL');
});

// ORÁCULO NOVO -- o achado da Tarefa 6 sobre classeInicial(), com o
// ruling do coordenador: degradar para a primeira entrada é aceitável,
// mas fazer isso EM SILÊNCIO não é -- a classe inicial dita salvaguardas,
// perícias completas, equipamento inicial e o dado de vida cheio do 1º
// nível, e o jogador não pode levar números errados para a mesa sem
// nenhum sinal. Por isso classeInicial() agora emite um console.warn
// (não console.error -- não é falha fatal, e os specs e2e do repositório
// afirmam ausência de erros de console) quando cai no caminho degradado.
test('classeInicial cai para a primeira entrada quando nenhuma tem ordem === 0, e avisa', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Feiticeiro', subclasse: '', nivel: 2, ordem: 3 },
    { classe: 'Paladino', subclasse: '', nivel: 3, ordem: 1 },
  ], dados_vida_usados: 0, atributos: {} };

  // Captura console.warn -- restaurado no finally mesmo se a asserção falhar,
  // para não vazar o stub para os testes seguintes do mesmo processo.
  const avisosOriginal = console.warn;
  const avisos = [];
  console.warn = (...args) => avisos.push(args.join(' '));
  try {
    assert.equal(multiclasse.classeInicial(p).classe, 'Feiticeiro',
      'sem ordem === 0, o fallback devolve a PRIMEIRA entrada do array');
    assert.equal(avisos.length, 1, 'o caminho degradado tem de avisar exatamente uma vez');
    assert.match(avisos[0], /Feiticeiro/, 'o aviso precisa citar a classe eleita');
    assert.match(avisos[0], /Paladino/, 'o aviso precisa citar as classes do personagem');

    // sincronizarEspelhos não pode travar nem gravar espelhos vazios neste caso.
    multiclasse.sincronizarEspelhos(p);
    assert.equal(p.classe, 'Feiticeiro');
    assert.equal(p.nivel, 5);
  } finally {
    console.warn = avisosOriginal;
  }
});

// A idempotência de migrarParaMulticlasse é chaveada por schema_versao,
// não pela mera presença de p.classes -- uma ficha pode chegar com
// classes[] por outro caminho (fora deste sub-projeto) sem nunca ter
// passado por esta função, e sem o carimbo a Tarefa 8 a trataria como
// schema 1 para sempre (Number(schema_versao) || 1).
//
// FIXTURE com dados_vida já preenchido em DUAS reservas distintas, com
// gasto em cada uma -- rodada 2 de revisão: um fixture sem dados_vida
// mede só o carimbo e o retorno, e passaria mesmo se o ramo de carimbo
// destruísse `p.dados_vida` antes de sincronizar (a mesma classe de
// buraco que os oráculos 2 e 3 desta rodada fecharam em
// sincronizarEspelhos, um nível acima, dentro de migrarParaMulticlasse).
test('migração carimba schema_versao mesmo quando p.classes já existe, preservando dados_vida', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Guerreiro', subclasse: '', nivel: 5, ordem: 0 },
    { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 1 },
  ], dados_vida: { 8: { total: 5, usados: 3 }, 10: { total: 5, usados: 4 } },
     atributos: {} }; // sem schema_versao
  assert.equal(multiclasse.migrarParaMulticlasse(p), true,
    'classes[] já existe, mas falta carimbar o schema -- isso conta como alteração');
  assert.equal(p.schema_versao, 2);
  assert.equal(p.classe, 'Guerreiro', 'sincronizarEspelhos roda junto com o carimbo');
  // As reservas -- e o gasto de cada uma -- têm de sair IDÊNTICAS: os
  // totais já estavam certos (5 e 5) e nenhum gasto pode ser perdido.
  assert.deepEqual(p.dados_vida, { 8: { total: 5, usados: 3 }, 10: { total: 5, usados: 4 } },
    'o carimbo de schema_versao não pode zerar nem descartar dados_vida existente');
  assert.equal(p.dados_vida_usados, 7, 'espelho de soma dos dois gastos');

  // Idempotência continua valendo: agora que o schema está carimbado, uma
  // segunda passagem não pode alterar mais nada (oráculo 1 vale aqui também).
  const depoisDaPrimeira = JSON.parse(JSON.stringify(p));
  assert.equal(multiclasse.migrarParaMulticlasse(p), false, 'schema já carimbado: nada mais para fazer');
  assert.deepEqual(p, depoisDaPrimeira);
});

// ASSERÇÃO NEGATIVA -- vale mais que a positiva aqui. Sem ela, um
// console.warn INCONDICIONAL (disparando também no caminho normal)
// passaria despercebido e poluiria o console de toda ficha aberta.
test('classeInicial NÃO avisa quando há uma entrada com ordem === 0', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Feiticeiro', subclasse: '', nivel: 2, ordem: 1 },
    { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 3, ordem: 0 },
  ] };

  const avisosOriginal = console.warn;
  const avisos = [];
  console.warn = (...args) => avisos.push(args.join(' '));
  try {
    assert.equal(multiclasse.classeInicial(p).classe, 'Paladino');
    assert.equal(avisos.length, 0, 'o caminho normal não pode emitir nenhum aviso');
  } finally {
    console.warn = avisosOriginal;
  }
});

// ============================================================
// Correção final -- item 1: classes[] apodrecia na primeira subida de
// nível. O fluxo normal (levelup.js:1411 e :1429) escreve só nos
// espelhos p.nivel/p.subclasse; sem reconciliar, classes[0] ficava
// parado no valor da migração para sempre.
// ============================================================

// Simula o que levelup.js:1411 faz de verdade (personagem.nivel =
// novoNivel), sem chamar subirDeNivel -- este teste mede só a
// reconciliação de migrarParaMulticlasse, não o fluxo de subida inteiro.
test('migrarParaMulticlasse reconcilia classes[0].nivel quando o espelho avançou', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 3,
              dados_vida_total: 3, dados_vida_usados: 0, atributos: {} };
  multiclasse.migrarParaMulticlasse(p);
  assert.equal(multiclasse.nivelNa(p, 'Paladino'), 3);

  // Imita levelup.js:1411 dezessete vezes, como a subida normal faria.
  for (let i = 0; i < 17; i++) p.nivel++;
  assert.equal(p.nivel, 20);

  multiclasse.migrarParaMulticlasse(p);
  assert.equal(multiclasse.nivelNa(p, 'Paladino'), p.nivel,
    'classes[] tem de acompanhar o espelho depois da reconciliação');
  assert.equal(multiclasse.nivelTotal(p), p.nivel);
});

// Simétrico ao de cima, para subclasse (levelup.js:1429).
test('migrarParaMulticlasse reconcilia classes[0].subclasse quando o espelho mudou', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classe: 'Mago', subclasse: '', nivel: 2,
              dados_vida_total: 2, dados_vida_usados: 0, atributos: {} };
  multiclasse.migrarParaMulticlasse(p);
  assert.equal(multiclasse.subclasseDe(p, 'Mago'), '');

  // Imita levelup.js:1429 (personagem.subclasse = opcoes.subclasse).
  p.subclasse = 'Evocador';

  multiclasse.migrarParaMulticlasse(p);
  assert.equal(multiclasse.subclasseDe(p, 'Mago'), 'Evocador',
    'classes[] tem de acompanhar o espelho de subclasse depois da reconciliação');
});

// Com DUAS classes, p.nivel é a SOMA -- reconciliar seria adivinhar qual
// classe subiu. A reconciliação NÃO pode rodar neste caso: classes[]
// continua sendo a fonte da verdade, mesmo que o espelho divirja da soma.
test('migrarParaMulticlasse NÃO reconcilia com duas classes: classes[] manda', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Guerreiro', subclasse: '', nivel: 5, ordem: 0 },
    { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 1 },
  ], schema_versao: multiclasse.SCHEMA_VERSAO_ATUAL,
     dados_vida: { 10: { total: 5, usados: 0 }, 8: { total: 5, usados: 0 } },
     atributos: {} };
  multiclasse.sincronizarEspelhos(p); // garante nivel=10 e schema já carimbado

  // Alguém (hipoteticamente) mexe só no espelho, como se fosse subida de
  // nível de classe única -- não deve acontecer em produção multiclasse,
  // mas é exatamente o cenário que provaria uma reconciliação incorreta.
  p.nivel = 11;

  const antes = JSON.parse(JSON.stringify(p.classes));
  assert.equal(multiclasse.migrarParaMulticlasse(p), false,
    'com duas classes e schema já carimbado, nada é reconciliado nem salvo');
  assert.deepEqual(p.classes, antes,
    'classes[] não pode ser tocado -- não há como saber qual das duas classes subiu');
});

// ============================================================
// Tarefa 7 -- a casca liga a migração na abertura da ficha.
// ============================================================

// ORÁCULO 9 -- as migrações são PREGUIÇOSAS (rodam em pages/sheet.js:47-60).
// Uma ficha pode ser exportada, validada no import e mesclada da nuvem
// SEM nunca ter aberto. Todos esses caminhos têm de funcionar sobre ela.
test('caminhos que não abrem a ficha funcionam sobre personagem não migrado', async () => {
  const { multiclasse, store } = await modulosApp();
  const legado = { id: 'x1', nome: 'Teste', classe: 'Clérigo', subclasse: 'Domínio da Vida',
                   nivel: 6, atributos: { forca: 10 } };

  // Leitura sem migrar: os acessores normalizam.
  assert.equal(multiclasse.nivelTotal(legado), 6);
  assert.equal(multiclasse.temClasse(legado, 'Clérigo'), true);
  assert.equal(multiclasse.classeInicial(legado).subclasse, 'Domínio da Vida');

  // Serialização e volta: o formato antigo continua redondo.
  const voltou = JSON.parse(JSON.stringify(legado));
  assert.equal(multiclasse.nivelNa(voltou, 'Clérigo'), 6);

  // E a migração, quando enfim roda, produz o mesmo resultado.
  multiclasse.migrarParaMulticlasse(voltou);
  assert.equal(multiclasse.nivelTotal(voltou), 6);
  assert.equal(voltou.classes.length, 1);
});

// ============================================================
// Rodada 1 de correção -- o teste acima (:426-444) só confronta
// `multiclasse.migrarParaMulticlasse`, a função PURA que a Tarefa 6 já
// cobre com 23 testes próprios. Ele nunca chama `sheetMigracoes.
// migrarMulticlasse`, o entregável desta tarefa, nem exercita a fiação
// que roda em pages/sheet.js:54. Sem isto, um refator que arrancasse a
// casca inteira (não chamar migrarParaMulticlasse, ou chamar salvar()
// incondicionalmente) passava a suíte inteira sem nenhum teste acusar --
// achado do revisor, com prova de corrupção. Os três testes abaixo
// exercitam a CASCA de verdade: `sheetEstado.definirChar(p)` para pôr o
// personagem no live binding que migracoes.js lê, `sheetMigracoes.
// migrarMulticlasse()` para rodar a casca, e um espião em
// `localStorage.setItem` para contar os salvamentos -- sem abrir a
// ficha nem tocar em pages/sheet.js.
// ============================================================

test('migrarMulticlasse(): primeira abertura de ficha legada migra e salva exatamente uma vez', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  const p = { id: 'casca-1', nome: 'Casca', classe: 'Guerreiro', subclasse: '',
              nivel: 5, dados_vida_total: 5, dados_vida_usados: 0, atributos: {} };
  sheetEstado.definirChar(p);

  const setItemOriginal = localStorage.setItem;
  let chamadas = 0;
  localStorage.setItem = (...args) => { chamadas++; return setItemOriginal(...args); };
  try {
    sheetMigracoes.migrarMulticlasse();
    // Mata a corrupção "não chamar migrarParaMulticlasse": sem a chamada
    // real, p.classes nunca nasce e chamadas fica em 0.
    assert.equal(p.schema_versao, 2, 'a casca tem de rodar a migração de verdade');
    assert.equal(p.classes?.length, 1);
    assert.equal(p.classes[0].classe, 'Guerreiro');
    assert.equal(chamadas, 1, 'a primeira abertura de uma ficha legada tem de salvar exatamente uma vez');
  } finally {
    localStorage.setItem = setItemOriginal;
  }
});

test('migrarMulticlasse(): segunda passagem sobre ficha já migrada não salva', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  const p = { id: 'casca-2', nome: 'Casca', classe: 'Guerreiro', subclasse: '',
              nivel: 5, dados_vida_total: 5, dados_vida_usados: 0, atributos: {} };
  sheetEstado.definirChar(p);
  sheetMigracoes.migrarMulticlasse(); // primeira abertura, fora do espião: migra e carimba.

  const setItemOriginal = localStorage.setItem;
  let chamadas = 0;
  localStorage.setItem = (...args) => { chamadas++; return setItemOriginal(...args); };
  try {
    sheetMigracoes.migrarMulticlasse();
    // Mata a corrupção "salvar() incondicional": com o `if` arrancado da
    // casca, esta segunda chamada gravaria disco à toa -- é a que mais
    // importa, porque também mascararia uma migração que não deveria ter
    // rodado.
    assert.equal(chamadas, 0, 'ficha já carimbada: migrarMulticlasse() não pode gravar disco');
  } finally {
    localStorage.setItem = setItemOriginal;
  }
});

test('migrarMulticlasse(): gasto de dado de vida sobrevive entre duas aberturas', async () => {
  const { sheetEstado, sheetMigracoes } = await modulosApp();
  const p = { id: 'casca-3', nome: 'Casca', classe: 'Guerreiro', subclasse: '',
              nivel: 5, dados_vida_total: 5, dados_vida_usados: 0, atributos: {} };
  sheetEstado.definirChar(p);
  sheetMigracoes.migrarMulticlasse(); // primeira abertura: migra e carimba.

  // Isto NÃO é o gasto que hp-descanso.js grava hoje -- desde o
  // sub-projeto 3e ele chama gastarDadosVida()/restaurarTodosDadosVida()
  // (regras-multiclasse.js), que escrevem os DOIS modelos. Este
  // `usados: 3` representa uma ficha salva por uma versão ANTERIOR do
  // app, cujo gasto foi gravado só no ESCALAR legado
  // (`char.dados_vida_usados = (char.dados_vida_usados || 0) + qtd`) sem
  // tocar no objeto estruturado -- caminho que continua real para
  // qualquer ficha existente que ainda não passou por um descanso desde a
  // conversão. O valor representa o que sincronizarEspelhos() JÁ teria
  // escrito na reserva a partir daquele escalar, numa ficha que passou
  // por um descanso curto entre duas aberturas -- é o efeito colateral
  // que o teste verifica, não a gravação em si.
  p.dados_vida['10'].usados = 3;

  const setItemOriginal = localStorage.setItem;
  let chamadas = 0;
  localStorage.setItem = (...args) => { chamadas++; return setItemOriginal(...args); };
  try {
    sheetMigracoes.migrarMulticlasse(); // segunda abertura.
    // O que este teste PROVA: que uma reserva estruturada com gasto
    // sobrevive intacta a uma segunda passagem pela casca, e que nada é
    // salvo nessa passagem -- porque o curto-circuito por schema_versao
    // (Tarefa 6) impede migrarParaMulticlasse de chamar
    // sincronizarEspelhos() de novo.
    //
    // O que este teste NÃO PROVA: que o gasto registrado por
    // hp-descanso.js sobrevive. Aquele gasto vive no escalar
    // `char.dados_vida_usados`; a reserva estruturada só é escrita por
    // sincronizarEspelhos(). O caminho de descarte real -- gasto gravado
    // no escalar legado numa ficha que AINDA não tem `dados_vida`
    // estruturado -- é o gap documentado em
    // site/js/regras-multiclasse.js:126-146 (docblock de
    // sincronizarEspelhos) e está fora do escopo deste sub-projeto.
    assert.equal(p.dados_vida['10'].usados, 3,
      'a reserva estruturada com gasto tem de sobreviver intacta à reabertura');
    assert.equal(chamadas, 0, 'segunda abertura sobre ficha já migrada não pode gravar disco');
  } finally {
    localStorage.setItem = setItemOriginal;
  }
});

// ============================================================
// Tarefa 8 -- validação de import e guarda de schema_versao no merge.
// ============================================================

// ORÁCULO 8 -- a validação de import roda ANTES de qualquer migração.
// Se ela recusar o formato novo, a ficha some com um console.warn e o
// usuário lê "N personagem(ns) importado(s)" com N menor, sem erro.
test('_validarPersonagem aceita os dois formatos e rejeita nível inválido', async () => {
  const { store } = await modulosApp();
  const base = { id: 'x', nome: 'T', atributos: { forca: 10 } };

  assert.equal(store._validarPersonagem({ ...base, nivel: 5, classe: 'Mago' }), true,
    'formato legado continua válido');
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Paladino', subclasse: '', nivel: 3, ordem: 0 },
    { classe: 'Feiticeiro', subclasse: '', nivel: 2, ordem: 1 },
  ] }), true, 'formato novo é válido mesmo sem o escalar nivel');

  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: 21, ordem: 0 },
  ] }), false, 'soma acima de 20 é inválida');
  assert.equal(store._validarPersonagem({ ...base, classes: [] }), false,
    'array vazio sem escalar é inválido');
});

// ORÁCULO (correção final, item 3) -- a guarda de schema_versao existiu
// brevemente aqui e foi removida: ela não protegia do cenário que a
// justificava (salvarPersonagem persiste o objeto inteiro; um build antigo
// em cache de Service Worker preserva schema_versao alto junto com dado
// desatualizado, e vLocal === vCloud fazia a guarda nunca disparar) e
// disparava num caso que ninguém desenhou (cópia local nunca aberta com
// schema baixo perdendo para cópia de nuvem mais ANTIGA com schema alto).
// Este teste prova que schema_versao não influencia mais a decisão --
// só atualizado_em, como o app sempre fez antes da guarda.
test('merge de nuvem: schema_versao não influencia mais o vencedor -- só atualizado_em manda', async () => {
  const { home } = await modulosApp();
  const agora = '2026-08-22T12:00:00.000Z';
  const depois = '2026-08-22T13:00:00.000Z';

  const local = { id: 'x', schema_versao: 2, atualizado_em: agora,
                  classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }] };
  const nuvem = { id: 'x', atualizado_em: depois, classe: 'Mago', nivel: 6 }; // sem schema_versao

  // A nuvem é mais recente e vence, mesmo sem schema_versao e mesmo com o
  // local carimbado em 2 -- a guarda de schema não existe mais.
  assert.equal(home._escolherNoMerge(local, nuvem), nuvem,
    'recência manda, independente de schema_versao');
});

// CASOS EXTRAS -- bordas e armadilhas não cobertas pelo oráculo
// acima, escolhidas porque cada uma protege um caminho real de perda de
// ficha ou de dado corrompido no merge.

// Bordas exatas da faixa válida (1 e 20): um "< 1" ou "> 20" com erro de
// fencepost (ex.: '<=' em vez de '<') rejeitaria justamente os valores
// legítimos mais comuns -- personagem recém-criado e personagem no teto.
test('_validarPersonagem aceita soma de níveis exatamente 1 e exatamente 20', async () => {
  const { store } = await modulosApp();
  const base = { id: 'x', nome: 'T', atributos: { forca: 10 } };
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: 1, ordem: 0 },
  ] }), true, 'soma 1 é o mínimo válido');
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: 12, ordem: 0 },
    { classe: 'Guerreiro', subclasse: '', nivel: 8, ordem: 1 },
  ] }), true, 'soma 20 é o máximo válido');
});

// classes[] com entrada de nível 0 ou negativo: desde a guarda por
// entrada (ruling do coordenador, rodada 1), quem rejeita aqui NÃO é o
// mínimo de 1 da SOMA -- é a guarda `c.nivel < 1` avaliada em CADA
// entrada, antes da soma sequer ser calculada. A distinção importa: um
// refator que baixasse o piso da soma para, digamos, `< -999` sobreviveria
// a um comentário (e a um teste) que descrevesse isso como "rejeitado
// pelo mínimo da soma" -- só a guarda por entrada realmente barra estes
// dois casos.
test('_validarPersonagem rejeita classes[] com nível zero ou negativo isolado', async () => {
  const { store } = await modulosApp();
  const base = { id: 'x', nome: 'T', atributos: { forca: 10 } };
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: 0, ordem: 0 },
  ] }), false, 'nível 0 isolado soma 0, abaixo do mínimo 1');
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: -5, ordem: 0 },
  ] }), false, 'nível negativo isolado soma -5, abaixo do mínimo 1');
});

// ORÁCULO NOVO (ruling do coordenador) -- fecha o gap que a soma sozinha
// deixava aberto: `_validarPersonagem` é a ÚNICA fronteira do app com
// dado que não veio dos nossos caminhos de produção (importarPersonagens
// lê um JSON escolhido no seletor de arquivos pelo usuário -- export
// editado à mão, arquivo de outra ferramenta, backup truncado). Duas
// entradas de `classes[]` -- uma inflada e uma negativa que a compensa --
// podem somar dentro de 1..20 e passar pela checagem de soma sozinha
// (25 + -20 = 5): a ficha corrompida entra em localStorage, e o sintoma
// (nivelNa devolvendo 25 e alimentando um find() que retorna undefined
// numa tabela de 20 linhas) aparece longe daqui, sem apontar para a causa.
test('_validarPersonagem rejeita classes[] com entrada inválida mesmo quando a soma bate', async () => {
  const { store } = await modulosApp();
  const base = { id: 'x', nome: 'T', atributos: { forca: 10 } };

  // Soma 5 (dentro de 1..20), mas a entrada -20 é inválida por si só.
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: 25, ordem: 0 },
    { classe: 'Guerreiro', subclasse: '', nivel: -20, ordem: 1 },
  ] }), false, 'entrada negativa mascarada pela soma tem de ser rejeitada por si só');

  // Soma 5 (dentro de 1..20), mas a entrada 0 é inválida por si só.
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: 0, ordem: 0 },
    { classe: 'Guerreiro', subclasse: '', nivel: 5, ordem: 1 },
  ] }), false, 'entrada zero dentro de um array por-outro-lado válido tem de ser rejeitada');

  // nivel não inteiro numa entrada -- fracionário, string, null.
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: 2.5, ordem: 0 },
  ] }), false, 'nível fracionário numa entrada é inválido');
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: '3', ordem: 0 },
  ] }), false, 'nível como string numa entrada é inválido, mesmo que Number(\'3\') funcione');
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: null, ordem: 0 },
  ] }), false, 'nível null numa entrada é inválido');

  // ASSERÇÃO NEGATIVA -- a guarda por entrada não pode ficar rígida
  // demais e rejeitar personagens legítimos.
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', subclasse: '', nivel: 1, ordem: 0 },
  ] }), true, 'uma única entrada de nível 1 continua válida');
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
    { classe: 'Paladino', subclasse: '', nivel: 5, ordem: 1 },
  ] }), true, 'duas entradas legítimas continuam válidas');
});

// ORÁCULO (revisão 1, achado do revisor) -- classes[] com uma entrada
// NÃO-OBJETO tem de REJEITAR a ficha, nunca LANÇAR. Antes da correção
// `c?.nivel`, `c.nivel` sobre `c === null`/`undefined` estourava
// TypeError -- e null dentro de array é saída comum de serializador ou de
// arquivo de outra ferramenta, exatamente o dado de fronteira que a
// guarda por entrada existe para tratar (a ironia que o próprio ruling
// que pediu a guarda apontou).
test('_validarPersonagem rejeita (nunca lança) classes[] com entrada não-objeto', async () => {
  const { store } = await modulosApp();
  const base = { id: 'x', nome: 'T', atributos: { forca: 10 } };
  for (const entradaRuim of [null, undefined, 'texto', 42]) {
    assert.doesNotThrow(() => store._validarPersonagem({ ...base, classes: [entradaRuim] }),
      `entrada ${JSON.stringify(entradaRuim)} não pode lançar`);
    assert.equal(store._validarPersonagem({ ...base, classes: [entradaRuim] }), false,
      `entrada ${JSON.stringify(entradaRuim)} tem de rejeitar a ficha`);
  }
});

// ORÁCULO (correção final, item 2) -- achado do revisor: a guarda por
// entrada conferia `nivel` mas não `classe`. `classes:[{nivel:3, ordem:0}]`
// passava na validação, e a migração então sobrescrevia `char.classe` com
// `''` e zerava `dados_vida_usados`/`dados_vida_total` -- destrói a
// identidade da ficha na hora, mais grave que o buraco numérico acima.
test('_validarPersonagem rejeita classes[] sem classe válida em alguma entrada', async () => {
  const { store } = await modulosApp();
  const base = { id: 'x', nome: 'T', atributos: { forca: 10 } };
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { nivel: 3, ordem: 0 },
  ] }), false, 'entrada sem campo classe é inválida');
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: '', nivel: 3, ordem: 0 },
  ] }), false, 'classe vazia é inválida');
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 123, nivel: 3, ordem: 0 },
  ] }), false, 'classe não-string é inválida');
  // ASSERÇÃO NEGATIVA -- uma entrada bem formada continua aceita.
  assert.equal(store._validarPersonagem({ ...base, classes: [
    { classe: 'Mago', nivel: 3, ordem: 0 },
  ] }), true, 'entrada com classe válida continua aceita');
});

// PROVA DE PONTA A PONTA do mesmo achado: um arquivo de import com UMA
// ficha ruim (classes[] com entrada null) e UMA ficha boa. Antes da
// correção, o TypeError da ficha ruim subia pelo `.some()` sem ser
// capturado ali, atravessava o laço de importarPersonagens e caía no
// try/catch de store.js:230+, que devolve -1 e aborta o arquivo INTEIRO
// -- inclusive a ficha boa, que nada tinha de errado. home.js:327-332
// mostraria "Erro ao importar arquivo" e NENHUM personagem entraria.
test('importarPersonagens: uma ficha com classes[null] não derruba as demais do arquivo', async () => {
  const { store } = await modulosApp();
  const chaveOriginal = localStorage.getItem('dnd_personagens');
  localStorage.setItem('dnd_personagens', '[]');
  try {
    const arquivo = JSON.stringify([
      { id: 'ruim-tarefa8', nome: 'Ruim', atributos: { forca: 10 }, classes: [null] },
      { id: 'boa-tarefa8', nome: 'Boa', atributos: { forca: 10 }, nivel: 5, classe: 'Mago' },
    ]);
    const resultado = store.importarPersonagens(arquivo);
    assert.equal(resultado, 1,
      'só a ficha boa conta como importada -- a ruim é ignorada, não aborta o arquivo inteiro');
    const lista = store.listarPersonagens();
    assert.ok(lista.find((p) => p.id === 'boa-tarefa8'), 'a ficha boa tem de estar na lista');
    assert.ok(!lista.find((p) => p.id === 'ruim-tarefa8'), 'a ficha ruim não pode ter entrado');
  } finally {
    // Restaura o estado anterior de localStorage para não vazar para
    // outros testes do mesmo processo (mesma disciplina do stub de
    // console.warn usado nos testes de classeInicial, acima).
    if (chaveOriginal === null) localStorage.removeItem('dnd_personagens');
    else localStorage.setItem('dnd_personagens', chaveOriginal);
  }
});

// ORÁCULO (revisão 1) -- o escalar legado agora exige inteiro, fechando a
// assimetria com classes[] que o revisor apontou: o JSDoc de
// _validarPersonagem sempre disse "numero inteiro 1-20", mas o código
// aceitava `nivel: 2.5` até esta correção.
test('_validarPersonagem exige nivel inteiro também no escalar legado', async () => {
  const { store } = await modulosApp();
  const base = { id: 'x', nome: 'T', atributos: { forca: 10 }, classe: 'Mago' };
  assert.equal(store._validarPersonagem({ ...base, nivel: 2.5 }), false,
    'nivel fracionário no escalar legado é inválido');
  assert.equal(store._validarPersonagem({ ...base, nivel: 1 }), true,
    'nivel 1 (borda mínima) continua válido');
  assert.equal(store._validarPersonagem({ ...base, nivel: 20 }), true,
    'nivel 20 (borda máxima) continua válido');
});

// ORÁCULO (achado do exercício de mutação pedido pelo coordenador) --
// nenhum teste desta suíte afirmava que um `nivel` escalar NEGATIVO ou
// ZERO é rejeitado. O buraco só apareceu ao reinjetar a mutação "baixar o
// piso da soma para < -999": para o ramo classes[], a guarda por entrada
// (`c.nivel < 1`) intercepta antes de a soma ser calculada -- mas o
// escalar legado não passa pela guarda por entrada, então um `nivel: -5`
// chegava direto no piso da soma sem nenhum outro obstáculo, e a mutação
// sobrevivia em silêncio. Este teste fecha esse buraco.
test('_validarPersonagem rejeita nivel escalar negativo ou zero', async () => {
  const { store } = await modulosApp();
  const base = { id: 'x', nome: 'T', atributos: { forca: 10 }, classe: 'Mago' };
  assert.equal(store._validarPersonagem({ ...base, nivel: -5 }), false,
    'nivel negativo no escalar legado é inválido');
  assert.equal(store._validarPersonagem({ ...base, nivel: 0 }), false,
    'nivel zero no escalar legado é inválido');
});

// `classes` presente mas não-array (objeto, string, número): o brief usa
// `Array.isArray(p.classes) && p.classes.length > 0` como guarda de
// entrada, então um `classes` não-array deve cair no ramo do escalar
// `nivel` -- e, sem `nivel` numérico, ser rejeitado. Uma implementação que
// testasse só `p.classes` (truthy) sem `Array.isArray` aceitaria lixo.
test('_validarPersonagem trata classes não-array como ausente, caindo no escalar nivel', async () => {
  const { store } = await modulosApp();
  const base = { id: 'x', nome: 'T', atributos: { forca: 10 } };
  assert.equal(store._validarPersonagem({ ...base, classes: 'Mago', nivel: 5 }), true,
    'classes string é ignorado; o escalar nivel válido ainda salva o personagem');
  assert.equal(store._validarPersonagem({ ...base, classes: { classe: 'Mago' } }), false,
    'classes objeto é ignorado, e sem escalar nivel a ficha é inválida');
});

// Empate de atualizado_em entre schemas iguais: o código do brief usa
// `tLocal > tCloud` (estrito) para decidir o vencedor, então um empate
// exato cai no `else` e a nuvem vence -- é o comportamento de HOJE
// (home.js:267 pré-extração), e a extração não pode mudar isso.
test('merge de nuvem: empate exato de atualizado_em entre schemas iguais mantém a nuvem', async () => {
  const { home } = await modulosApp();
  const mesmoInstante = '2026-08-22T12:00:00.000Z';
  const local = { id: 'x', schema_versao: 2, atualizado_em: mesmoInstante };
  const cloud = { id: 'x', schema_versao: 2, atualizado_em: mesmoInstante };
  assert.equal(home._escolherNoMerge(local, cloud), cloud,
    'empate exato: tLocal > tCloud é falso, então a nuvem (o "else" de hoje) vence');
});

// ORÁCULO (revisão 1, Critical) -- achado do revisor: a suíte inteira até
// aqui NUNCA afirma que o LOCAL vence quando ele é o mais recente. Os
// testes existentes cobrem "nuvem vence por empate" e "nuvem vence por
// recência" -- mas nenhum cobre "local vence por atualizado_em".
// Trocar `tLocal > tCloud ? local : cloud` por `return cloud` deixava
// TODA a suíte verde antes deste teste existir: a edição local nunca
// subiria à nuvem, e seria sobrescrita a cada sync -- o jogador perde
// trabalho em silêncio, sem um único teste vermelho para acusar.
test('merge de nuvem: local mais recente vence quando os schemas são iguais', async () => {
  const { home } = await modulosApp();
  const local = { id: 'x', schema_versao: 2, atualizado_em: '2026-08-22T13:00:00.000Z' };
  const cloud = { id: 'x', schema_versao: 2, atualizado_em: '2026-08-22T12:00:00.000Z' };
  assert.equal(home._escolherNoMerge(local, cloud), local,
    'schemas iguais, local estritamente mais recente: o local tem de vencer');
});

// ORÁCULO (revisão 1, Critical) -- achado do revisor: `_sincronizarSeLogado`
// empurra o vencedor do merge para `paraEnviarCloud` só quando
// `vencedor === local` (home.js, dentro do laço de merge) -- uma
// comparação por IDENTIDADE, não por igualdade estrutural. Remover essa
// linha também deixa a suíte inteira verde, porque `_sincronizarSeLogado`
// não é exportada e depende de Firebase (não dá para testá-la
// diretamente aqui a custo baixo). A propriedade testável da qual o
// rewire DEPENDE é esta: `_escolherNoMerge` devolve a MESMA referência
// que recebeu, nunca uma cópia -- se algum dia passar a clonar
// (`{ ...local }` em vez de `local`), `vencedor === local` vira `false`
// para sempre e o reenvio para a nuvem para de acontecer, silenciosamente.
test('merge de nuvem: _escolherNoMerge devolve a MESMA referência recebida, nunca uma cópia', async () => {
  const { home } = await modulosApp();
  const local = { id: 'x', schema_versao: 2, atualizado_em: '2026-08-22T13:00:00.000Z' };
  const cloud = { id: 'x', schema_versao: 2, atualizado_em: '2026-08-22T12:00:00.000Z' };
  assert.strictEqual(home._escolherNoMerge(local, cloud), local,
    'quando o local vence, a referência devolvida tem de ser a MESMA que foi passada');
  assert.strictEqual(home._escolherNoMerge(cloud, local), local,
    'simétrico: quando a nuvem (aqui, o segundo argumento) vence, idem para a referência dela');
});

// ============================================================
// Tarefa 9 -- ORÁCULO 6: char.classe, char.subclasse e char.nivel são
// ESPELHOS; char.dados_vida, char.dados_vida_total e char.dados_vida_usados
// TAMBÉM SÃO -- regras-multiclasse.js:103-124 documenta isso em comentário,
// mas um gap documentado só em comentário some da vista. Esta varredura
// estende a rede da Tarefa 6 para as duas famílias de campo: escrever
// fora do escritor autorizado desincroniza o modelo em silêncio
// (classes[] diz uma coisa e a ficha exibe outra). A lista de exceções só
// pode ENCOLHER; cada uma vira tarefa do sub-projeto 5.
// ============================================================

// Forma "char.campo = valor" / "personagem.campo = valor" -- cobre os três
// escalares de classe/subclasse/nível e os três campos de dado de vida.
// Também cobre atribuição composta (+=, -=, *=, /=, %=, **=, <<=, >>=, >>>=,
// &=, |=, ^=, &&=, ||=, ??=) e incremento/decremento (++/--): a forma
// "char.dados_vida_usados += qtd" é a refatoração mais natural da forma
// antiga "char.dados_vida_usados = (char.dados_vida_usados || 0) + qtd", e
// SEM este alargamento ela escapava da rede inteira -- achado da revisão
// final do sub-projeto 3e. Medido sobre site/js/ inteiro: o alargamento não
// pega nenhuma linha nova hoje, então ESCRITAS_PERMITIDAS não precisou
// crescer.
// Alargamento da Tarefa 3 (sub-projeto 4): espacos_magia e
// espacos_magia_extras entram na mesma alternancia -- mesmo raciocinio
// do dado de vida (total armazenado e um segundo lugar dizendo a
// verdade). Medido sobre site/js/ inteiro: o alargamento acha 9 linhas
// legadas (criacao/subida de nivel e o reconciliador de render de
// pages/sheet.js), todas em ESCRITAS_PERMITIDAS abaixo -- ver a lista
// no relatorio da Tarefa 3.
const PADRAO_ESPELHO_ATRIBUICAO =
  /(char|personagem)\.(classe|subclasse|nivel|dados_vida|dados_vida_total|dados_vida_usados|espacos_magia|espacos_magia_extras)\s*(?:\+\+|--|(?:[-+*/%|&^]|\*\*|<<|>>>?|\?\?|\|\||&&)?=[^=])/;
// Forma INDEXADA -- "char.espacos_magia[circulo] = ..." ou
// "char.espacos_magia[circulo].usados = ...": achado da revisão da Tarefa
// 3 (sub-projeto 4). PADRAO_ESPELHO_ATRIBUICAO só casa atribuição do CAMPO
// INTEIRO ("campo = valor"); mas para espacos_magia a forma indexada é a
// NORMAL -- é como todo gasto/recuperação de espaço é escrito hoje
// (magias.js, bruxo.js, hp-descanso.js, levelup.js, pages/sheet.js) --,
// não uma exceção rara como seria para dados_vida. Sem este segundo
// padrão, a asserção do guarda ("ninguém escreve nos espelhos fora do
// escritor autorizado") era falsa na prática para espacos_magia: depois
// que as Tarefas 4-7 converterem os pontos hoje declarados em
// ESCRITAS_PERMITIDAS, uma regressão que reintroduza escrita indexada
// passaria verde. Restrito à família espacos_magia/espacos_magia_extras
// -- não há escrita indexada conhecida de classe/subclasse/nivel/dados_vida
// hoje, e alargar sem um caso real só criaria ruído (mesmo critério do
// PADRAO_ESPELHO_LITERAL, abaixo).
const PADRAO_ESPELHO_INDEXADO =
  /(char|personagem)\.(espacos_magia|espacos_magia_extras)\s*\[[^\]]*\](?:\.\w+)?\s*(?:\+\+|--|[-+*/%]?=[^=])/;
// Forma de literal de objeto "dados_vida_total: valor" -- só existe hoje em
// store.js (criarPersonagemVazio), que não usa `char.`/`personagem.` como
// prefixo por ser um TEMPLATE de personagem novo, não uma mutação de ficha
// existente. Restrito à família de dado de vida: classe/subclasse/nivel
// nunca aparecem nesse formato em site/js hoje, e alargar o padrão para
// elas sem um caso real para justificar só criaria ruído.
const PADRAO_ESPELHO_LITERAL = /^\s*(dados_vida|dados_vida_total|dados_vida_usados):\s*\S/;

function ehEscritaDeEspelho(linha) {
  return PADRAO_ESPELHO_ATRIBUICAO.test(linha) || PADRAO_ESPELHO_INDEXADO.test(linha) || PADRAO_ESPELHO_LITERAL.test(linha);
}

const ESCRITAS_PERMITIDAS = new Set([
  'site/js/creator/passo-classe.js:197',  // personagem.subclasse = e.target.value
  'site/js/creator/passo-classe.js:263',  // personagem.subclasse = ''
  'site/js/creator/passo-classe.js:273',  // personagem.classe = nome

  // levelup.js SAIU INTEIRO desta lista no sub-projeto 5 (Tarefa 3a+3b).
  // Eram ONZE entradas: `personagem.nivel`, `personagem.subclasse`,
  // `dados_vida_total` e as oito de `espacos_magia` (quatro em
  // `atualizarEspacosMagia`, quatro no bloco de subclasse conjuradora).
  // Nenhuma foi reapontada -- todas deixaram de existir:
  //   - a subida grava em `classes[]` e chama `sincronizarEspelhos()`,
  //     que é o escritor autorizado dos espelhos e do dado de vida;
  //   - `atualizarEspacosMagia` foi REMOVIDA, e com ela o laço que movia
  //     o círculo de pacto do Bruxo; o total de espaços passou a ser
  //     derivado da regra a cada leitura (montarReservasDeEspacos).
  // Medido: os regexes deste guarda não encontram NENHUMA escrita de
  // espelho em site/js/levelup.js. Isso fecha o Minor 2 da revisão de
  // conformidade de 2026-08-26 -- nada mais no app produz a forma híbrida
  // de `espacos_magia`.

  // Escritores legados da família de dado de vida que SOBRAM depois do
  // sub-projeto 3e: agora só o fluxo de CRIAÇÃO. Os três de hp-descanso.js
  // saíram no 3e (gasto e reset passaram por gastarDadosVida()/
  // restaurarTodosDadosVida(), em regras-multiclasse.js, que está em
  // ARQUIVOS_AUTORIZADOS); o da subida de nível saiu no sub-projeto 5.
  'site/js/creator/wizard.js:441',     // grava dados_vida_total na criação de personagem
  'site/js/store.js:324',  // dados_vida_total: 1  (template de criação)
  'site/js/store.js:325',  // dados_vida_usados: 0 (template de criação)

  // Escritores legados de espacos_magia que sobram depois da Tarefa 3
  // (sub-projeto 4): a rede de escrita fecha para o GASTO (gastarEspaco/
  // restaurarEspacosDePacto/restaurarEspacosDeConjuracao, em
  // sheet/reservas-espacos.js, agora ARQUIVOS_AUTORIZADOS). Sobra só a
  // CRIAÇÃO, que ainda inicializa o campo direto.
  'site/js/creator/wizard.js:92',   // personagem.espacos_magia = {} na criação -- sub-projeto 5
  'site/js/creator/wizard.js:447',  // idem, grava a tabela da classe inicial -- sub-projeto 5
  // pages/sheet.js:100-158 era o reconciliador de render -- a Tarefa 4
  // removeu-o (deixando migrarEspacosMagia() no lugar, em
  // sheet/migracoes.js, ARQUIVOS_AUTORIZADOS) e as 9 entradas que
  // declaravam suas escritas (2 literais, 7 indexadas) saíram daqui: a
  // lista só encolhe, e escritor que não existe mais não tem o que
  // declarar.
  // espacos_magia_extras NÃO TEM escritor autorizado neste sub-projeto --
  // achado da revisão da Tarefa 3 (Minor 1): rotular estas linhas como
  // "escopo de tarefa futura" seria enganoso, porque NENHUMA tarefa do
  // plano as remove. Ficam declaradas como exceção PERMANENTE: os extras
  // de Fonte de Magia são efêmeros por natureza (concedidos e limpos a
  // cada Descanso Longo), e nenhuma tarefa do sub-projeto 4 lhes dá um
  // escritor único.
  'site/js/sheet/hp-descanso.js:983',       // char.espacos_magia_extras = {} (limpa no Longo) -- número atualizado pela Tarefa 8 (comentários acrescentados acima deslocaram a linha)
  'site/js/sheet/habilidades.js:923',       // if (!extras) extras = {}  (Fonte de Magia) -- número de linha atualizado pela Tarefa 4 (Ruling 11)
  'site/js/sheet/habilidades.js:924',       // extras[c] = (extras[c] || 0) + 1  (Fonte de Magia) -- idem
  // habilidades.js: Resplendor Sagrado (Paladino/Devoção), Fonte de Magia
  // (Feiticeiro) e Recuperação Arcana (Mago) foram convertidos na Tarefa 4
  // (Ruling 11 do controlador) para gastarEspaco/recuperarUmEspaco/
  // reservasDeEspacos, fonte 'conjuracao' fixa (nenhuma das três classes
  // tem Magia de Pacto) -- as entradas antigas (:1728, :1734, :903, :904)
  // saíram: a lista só encolhe. A escrita redundante do TOTAL
  // (`char.espacos_magia[c].total += 1`, antes em :904) foi REMOVIDA, não
  // convertida -- o total agora é derivado e soma os extras sozinho.
  // hp-descanso.js: o bloco do Descanso Longo (zerava usados de todos os
  // círculos, e recalculava "total" marcado "NAO CONVERTIDA DE PROPOSITO")
  // agora chama restaurarEspacosDeConjuracao(char) + restaurarEspacosDePacto(char)
  // (Ruling 11 do controlador, Tarefa 4) -- as duas entradas antigas
  // saíram: a lista só encolhe.
  // classes/bruxo.js: recuperarEspacosMagiaBruxo agora usa
  // restaurarEspacosDePacto/recuperarUmEspaco (Ruling 11 do controlador,
  // Tarefa 4) -- as duas entradas antigas saíram: a lista só encolhe.
  // magias.js: bolhas de espaço de magia, "Conjurar" de magia preparada e
  // grimório, e magia personalizada -- a Tarefa 4 converteu TODOS os pontos
  // de leitura/escrita de char.espacos_magia deste arquivo (Ruling 11 do
  // controlador: trocar o formato exige que TODOS os leitores virem
  // juntos, ou a tela fica quebrada e nenhum oráculo cobre -- a primeira
  // rodada desta tarefa converteu só a caixa de resumo e o checkbox, e a
  // revisão achou o Critical em :1724, a linha idêntica a :1645 que tinha
  // sobrado). As entradas antigas (:1648, :1651, :1816) saíram: a lista só
  // encolhe.
]);

// Arquivos autorizados a escrever nos espelhos por desenho.
const ARQUIVOS_AUTORIZADOS = new Set([
  'site/js/regras-multiclasse.js',
  'site/js/sheet/migracoes.js',
  // Tarefa 3 (sub-projeto 4): escritor autorizado de espacos_magia em
  // runtime -- gastarEspaco/restaurarEspacosDePacto/
  // restaurarEspacosDeConjuracao.
  //
  // Nota (achado da revisão da Tarefa 3, Minor 2): estas duas entradas
  // são hoje INERTES -- nenhuma linha destes dois arquivos bate com
  // PADRAO_ESPELHO_ATRIBUICAO/PADRAO_ESPELHO_INDEXADO, porque os dois
  // escrevem sempre por `p.` (o parâmetro da função pura/casca), nunca
  // por `char.`/`personagem.` (as âncoras dos padrões). Ficam na lista
  // por DESENHO -- são os escritores autorizados de verdade -- não como
  // prova de cobertura: a exclusão delas do scan (arquivosJs) é o que
  // importa aqui, não um match que nunca vai acontecer.
  'site/js/sheet/reservas-espacos.js',
  // Tarefa 2 (sub-projeto 4): migrarEspacosDeMagia, o escritor autorizado
  // da migração de espacos_magia da forma antiga para a forma por fonte
  // -- roda uma única vez na abertura da ficha, via sheet/migracoes.js.
  // Mesma nota de inércia acima: escreve por `p.`, não `char.`/`personagem.`.
  'site/js/regras-multiclasse-conjuracao.js',
]);

// Varre recursivamente site/js/ coletando caminhos de arquivo .js,
// ignorando site/js/vendor (código de terceiros, fora do nosso controle).
function arquivosJs(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === 'vendor') continue;
      arquivosJs(caminho, acc);
    } else if (nome.endsWith('.js')) {
      acc.push(caminho);
    }
  }
  return acc;
}

test('ninguém escreve nos espelhos fora do escritor autorizado', () => {
  const achados = [];
  for (const caminho of arquivosJs(resolve(RAIZ, 'site', 'js'))) {
    const rel = caminho.replace(RAIZ, '').replace(/\\/g, '/').replace(/^\//, '');
    if (ARQUIVOS_AUTORIZADOS.has(rel)) continue;
    const linhas = readFileSync(caminho, 'utf-8').split(/\r?\n/);
    linhas.forEach((linha, i) => {
      if (!ehEscritaDeEspelho(linha)) return;
      const chave = `${rel}:${i + 1}`;
      if (!ESCRITAS_PERMITIDAS.has(chave)) achados.push(`${chave} -> ${linha.trim()}`);
    });
  }
  assert.deepEqual(achados, [],
    'escrita direta em espelho de multiclasse (classe/subclasse/nivel), em campo de dado ' +
    'de vida (dados_vida/dados_vida_total/dados_vida_usados) ou em espacos_magia/' +
    'espacos_magia_extras (forma direta ou indexada); para dado de vida use ' +
    'sincronizarEspelhos(), para espacos_magia use gastarEspaco()/restaurarEspacosDePacto()/' +
    'restaurarEspacosDeConjuracao() (sheet/reservas-espacos.js) -- ou acrescente a linha a ' +
    'ESCRITAS_PERMITIDAS com justificativa');
});

// A lista de exceções só pode encolher. Se uma entrada deixou de existir
// (a linha mudou de número, ou deixou de ser uma escrita de espelho),
// remova-a -- senão ela protege uma linha que já mudou. A mensagem
// mostra o conteúdo ATUAL da linha para o próximo agente não precisar
// abrir o arquivo para descobrir o que deslocou.
test('a lista de escritas permitidas não tem entradas mortas', () => {
  for (const chave of ESCRITAS_PERMITIDAS) {
    const [rel, num] = chave.split(':');
    const linhas = readFileSync(resolve(RAIZ, rel), 'utf-8').split(/\r?\n/);
    const linha = linhas[Number(num) - 1] || '';
    assert.ok(ehEscritaDeEspelho(linha),
      `${chave} não é mais uma escrita de espelho -- remova ou atualize essa entrada de ` +
      `ESCRITAS_PERMITIDAS. Linha ${num} de ${rel} hoje é: "${linha.trim()}"`);
  }
});

// ============================================================
// Tarefa 10 -- personagemMulticlasse() no harness.
// ============================================================

test('personagemMulticlasse monta o exemplo do livro corretamente', async () => {
  const { multiclasse } = await modulosApp();
  // Exemplo literal de livro:2114: Guardião 4 / Feiticeiro 3.
  const p = await personagemMulticlasse([
    { classe: 'Guardião', nivel: 4 },
    { classe: 'Feiticeiro', nivel: 3 },
  ]);
  assert.equal(multiclasse.nivelTotal(p), 7);
  assert.equal(multiclasse.nivelNa(p, 'Guardião'), 4);
  assert.equal(multiclasse.nivelNa(p, 'Feiticeiro'), 3);
  assert.equal(p.classe, 'Guardião', 'o espelho aponta para a classe inicial');
  assert.equal(p.nivel, 7, 'o espelho de nível é o total');
  // d10 do Guardião e d6 do Feiticeiro: reservas separadas.
  assert.deepEqual(p.dados_vida, {
    10: { total: 4, usados: 0 },
    6: { total: 3, usados: 0 },
  });
});

// ============================================================
// Correção final, rodada 2 -- a onda anterior consertou classes[]
// apodrecendo na subida de nível (item 1 da rodada 1), mas abriu uma
// regressão de mesma gravidade: a reconciliação de migrarParaMulticlasse
// agora chama sincronizarEspelhos() em toda reabertura de ficha
// já migrada, e sincronizarEspelhos() lia o gasto anterior SÓ do objeto
// estruturado (p.dados_vida) -- ignorando qualquer gasto que
// hp-descanso.js tivesse gravado no ESCALAR legado (p.dados_vida_usados)
// entre duas sincronizações. Fluxo real: abre a ficha (migra) -> descanso
// curto gasta dados (escreve só no escalar) -> sobe de nível -> reabre a
// ficha -> reconciliação diverge (nivel mudou) -> sincronizarEspelhos()
// roda de novo -> semeia a reserva a partir de p.dados_vida (ainda com o
// usados ANTIGO) -> o gasto do descanso é perdido e gravado em disco.
// ============================================================

// ORÁCULO 1 (item 1) -- reprodução ponta a ponta do cenário relatado:
// migrar -> gasto só no escalar (como hp-descanso.js faz) -> sobe de
// nível -> migra de novo (reconciliação) -> o gasto tem de SOBREVIVER, e
// o total tem de acompanhar o nível novo.
test('sincronizarEspelhos não perde gasto de dado de vida gravado só no escalar entre duas migrações', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 3,
              dados_vida_total: 3, dados_vida_usados: 0, atributos: {} };
  multiclasse.migrarParaMulticlasse(p);
  assert.deepEqual(p.dados_vida, { 10: { total: 3, usados: 0 } });

  // Imita o que uma ficha salva por uma versão ANTERIOR ao sub-projeto 3e
  // continha: gasto de descanso curto gravado SÓ no escalar legado, nunca
  // no objeto estruturado. Desde o sub-projeto 3e hp-descanso.js escreve
  // os DOIS modelos via gastarDadosVida(), mas uma ficha gravada antes
  // dessa conversão continua existindo com essa divergência.
  p.dados_vida_usados += 2;
  assert.equal(p.dados_vida_usados, 2);
  assert.deepEqual(p.dados_vida, { 10: { total: 3, usados: 0 } },
    'o gasto do descanso não toca no objeto estruturado -- só uma ficha legada, gravada antes da conversão, chegaria assim');

  // Imita levelup.js:1411 -- sobe de nível escrevendo só no espelho.
  p.nivel++;
  assert.equal(p.nivel, 4);

  // Reabre a ficha: a reconciliação detecta divergência de nível e chama
  // sincronizarEspelhos() de novo.
  multiclasse.migrarParaMulticlasse(p);
  assert.deepEqual(p.dados_vida, { 10: { total: 4, usados: 2 } },
    'o gasto gravado só no escalar tem de sobreviver, e o total tem de acompanhar o nível novo');
  assert.equal(p.dados_vida_usados, 2, 'o espelho de soma tem de refletir o gasto preservado');
});

// ORÁCULO 2 (item 1) -- o gasto no escalar pode ser maior que o total
// novo (ex.: personagem perdeu níveis entre uma sincronização e outra).
// Tem de ser CORTADO no total, nunca zerado.
test('sincronizarEspelhos corta no total o gasto do escalar quando ele excede o total novo', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Guerreiro', subclasse: '', nivel: 3, ordem: 0 },
  ], dados_vida: { 10: { total: 3, usados: 0 } }, dados_vida_usados: 8, atributos: {} };
  multiclasse.sincronizarEspelhos(p);
  assert.deepEqual(p.dados_vida, { 10: { total: 3, usados: 3 } },
    'usados: 8 vindo do escalar para um total de 3 tem de ser CORTADO em 3, não zerado nem deixado em 8');
  assert.equal(p.dados_vida_usados, 3);
});

// ORÁCULO 3 (item 1) -- com DUAS OU MAIS reservas, um escalar único não
// tem como ser distribuído entre elas: o estruturado é que manda, sem
// nenhuma semeadura a partir do escalar.
test('sincronizarEspelhos NÃO semeia do escalar quando há duas reservas: o estruturado manda', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
    { classe: 'Paladino', subclasse: '', nivel: 5, ordem: 1 },
  ], dados_vida: { 8: { total: 5, usados: 3 }, 10: { total: 5, usados: 4 } },
     dados_vida_usados: 999, atributos: {} };
  multiclasse.sincronizarEspelhos(p);
  assert.deepEqual(p.dados_vida, {
    8: { total: 5, usados: 3 },
    10: { total: 5, usados: 4 },
  }, 'com duas reservas, o escalar discordante (999) não pode sobrescrever nenhuma das duas');
  assert.equal(p.dados_vida_usados, 7, 'o espelho de soma tem de refletir só o estruturado');
});

// ORÁCULO 4 (item 1) -- ASSERÇÃO NEGATIVA: o caso que já funcionava (gasto
// presente no estruturado, escalar coerente com ele) continua funcionando
// -- a nova semeadura não pode disparar quando não há divergência.
test('sincronizarEspelhos não mexe no gasto estruturado quando o escalar já está coerente', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Guerreiro', subclasse: '', nivel: 5, ordem: 0 },
  ], dados_vida: { 10: { total: 0, usados: 3 } }, dados_vida_usados: 3, atributos: {} };
  multiclasse.sincronizarEspelhos(p);
  assert.deepEqual(p.dados_vida, { 10: { total: 5, usados: 3 } },
    'escalar e estruturado já concordam (3 === 3): nada deveria mudar além do total recalculado');
  assert.equal(p.dados_vida_usados, 3);
});

// ORÁCULO (item 2) -- achado do revisor: uma ficha com classes[] VÁLIDO
// (aceito por _validarPersonagem desde a rodada 1, mesmo sem o escalar
// p.nivel) mas sem os espelhos p.nivel/p.subclasse tinha classes[0]
// destruído pela reconciliação -- ela lia `Number(p.nivel) || 0` e
// `p.subclasse || ''`, e escrevia 0 / '' de volta em classes[0] por
// ausência de espelho ser tratada como divergência real. Ausência de
// espelho é ausência de INFORMAÇÃO, não divergência: classes[] é que
// manda quando não há espelho para comparar.
test('migrarParaMulticlasse não destrói classes[0] quando os espelhos p.nivel/p.subclasse estão ausentes', async () => {
  const { multiclasse } = await modulosApp();
  const p = { classes: [
    { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 6, ordem: 0 },
  ], schema_versao: 2, atributos: {} }; // sem p.nivel nem p.subclasse -- espelhos ausentes

  multiclasse.migrarParaMulticlasse(p);

  assert.equal(p.classes[0].nivel, 6,
    'ausência de espelho não é divergência -- classes[0].nivel não pode virar 0');
  assert.equal(p.classes[0].subclasse, 'Juramento da Devoção',
    'ausência de espelho não é divergência -- classes[0].subclasse não pode virar vazio');
  assert.equal(p.nivel, 6, 'o espelho recém-escrito tem de vir de classes[], não de si mesmo');
  assert.equal(p.subclasse, 'Juramento da Devoção');
});
