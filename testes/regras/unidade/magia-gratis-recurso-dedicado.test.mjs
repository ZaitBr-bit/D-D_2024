// ============================================================
// Issue #76, Fase C -- adaptador de uso grátis de magia por RECURSO
// DEDICADO (regras-usos-gratis-magia.js), para as características cuja
// contagem NÃO cabe no booleano `gratis_usado` (uso múltiplo/escalado por
// atributo ou nível): Inimigo Favorito (Marca do Caçador), Reforços
// Feéricos e Andarilho Nebuloso (Convocar Feérico/Passo Nebuloso,
// Andarilho Feérico, Guardião) e Mapa Estelar (Raio Guia, Círculo das
// Estrelas, Druida).
//
// O adaptador lê e escreve o MESMO `char.recursos.<classe>.*` que o
// painel de recursos (sheet/habilidades.js, getEstadoRecursosGuardiao/
// getEstadoRecursosDruida) já usa -- não um contador próprio. Este teste
// mede exatamente essa concordância: gastar um uso pelo adaptador tem de
// aparecer no estado que o painel lê, e vice-versa.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { personagemMulticlasse, subirAteNivel } from './harness.mjs';
import { modulosApp } from './harness.mjs';

test('Guardião nível 1: Marca do Caçador tem 2 usos grátis (Inimigo Favorito), não 1', async () => {
  const { sheetEstado, regrasUsosGratisMagia, db } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guardião', nivel: 1 }]);
  sheetEstado.definirChar(p);
  // getProgressaoGuardiao (sheet/classes/guardiao.js) lê a tabela de
  // características pelo cache de dadosDe (contexto-classe.js) -- sem
  // popular o cache, inimigoFavoritoMax fica 0 (Guardião "sem dados"), e
  // o teste mediria só esse caminho de erro, não o valor real da tabela.
  sheetEstado.definirClassesData(new Map([['Guardião', await db.getClasse('Guardião')]]));

  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Marca do Caçador'), true,
    'nível 1 concede 2 usos (tabela Inimigo Favorito) -- o primeiro precisa estar disponível');

  assert.equal(regrasUsosGratisMagia.consumirUsoRecursoDedicadoGratis('Marca do Caçador'), true,
    'consumir devolve true quando há adaptador para o nome');
  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Marca do Caçador'), true,
    'depois do 1º uso ainda resta o 2º -- não é um booleano de 1 uso só');

  regrasUsosGratisMagia.consumirUsoRecursoDedicadoGratis('Marca do Caçador');
  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Marca do Caçador'), false,
    'depois dos 2 usos, esgotado');

  assert.equal(p.recursos.guardiao.inimigo_favorito_usos_gastos, 2,
    'o adaptador escreve no MESMO campo que o painel de recursos lê -- getEstadoRecursosGuardiao ' +
    'precisa concordar sem precisar reabrir a ficha');
});

test('Andarilho Feérico nível 11: Convocar Feérico é 1x/Descanso Longo (Reforços Feéricos)', async () => {
  const { sheetEstado, regrasUsosGratisMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guardião', nivel: 11, subclasse: 'Andarilho Feérico' }]);
  sheetEstado.definirChar(p);

  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Convocar Feérico'), true);
  regrasUsosGratisMagia.consumirUsoRecursoDedicadoGratis('Convocar Feérico');
  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Convocar Feérico'), false,
    'Reforços Feéricos é 1 uso só (booleano) -- depois de usado, esgotado até o Descanso Longo');
});

test('Andarilho Feérico nível 10 (antes de Reforços Feéricos): Convocar Feérico não tem uso grátis', async () => {
  const { sheetEstado, regrasUsosGratisMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guardião', nivel: 10, subclasse: 'Andarilho Feérico' }]);
  sheetEstado.definirChar(p);

  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Convocar Feérico'), null,
    'Reforços Feéricos só concede a partir do nível 11 -- getEstadoRecursosGuardiao inicializa o campo ' +
    'para QUALQUER Guardião, então sem o gate de nível o adaptador precisa devolver null (não se aplica ' +
    'ainda), não false (que impediria um "Convocar Feérico" normal de cair no gratis_usado do talento)');
});

test('Andarilho Feérico nível 15: Passo Nebuloso tem usos = modificador de Sabedoria (mínimo 1)', async () => {
  const { sheetEstado, regrasUsosGratisMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guardião', nivel: 15, subclasse: 'Andarilho Feérico' }]);
  p.atributos.sabedoria = 16; // modificador +3
  sheetEstado.definirChar(p);

  for (let i = 0; i < 3; i++) {
    assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Passo Nebuloso'), true,
      `uso ${i + 1}/3 (modificador de Sabedoria +3) precisa estar disponível`);
    regrasUsosGratisMagia.consumirUsoRecursoDedicadoGratis('Passo Nebuloso');
  }
  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Passo Nebuloso'), false,
    'depois dos 3 usos (modificador de Sabedoria), esgotado');
});

// DISCRIMINADOR: um Guardião de OUTRA subclasse (não Andarilho Feérico) na
// mesma faixa de nível não pode ganhar Convocar Feérico/Passo Nebuloso de
// graça -- getEstadoRecursosGuardiao() inicializa `subclasses.andarilho`
// para QUALQUER Guardião (é lazy-init genérico, não um gate de subclasse),
// e sem o gate explícito de subclasseDe() o adaptador vazaria o uso grátis
// para quem nunca ganhou a característica.
test('Guardião de OUTRA subclasse (não Andarilho Feérico) não ganha o uso grátis do Andarilho', async () => {
  const { sheetEstado, regrasUsosGratisMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guardião', nivel: 15, subclasse: 'Vigilante das Sombras' }]);
  sheetEstado.definirChar(p);

  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Convocar Feérico'), null,
    'adaptador não se aplica -- null, não false (mesmo motivo do teste de nível 10, acima)');
  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Passo Nebuloso'), null);
});

// DISCRIMINADOR: "Passo Nebuloso" NÃO é exclusiva do Andarilho Feérico --
// o talento Tocado Por Fadas concede a MESMA magia sempre preparada com
// uso grátis 1x/Descanso Longo pelo mecanismo booleano
// (regras-cobertura.js:673 e levelup.js:2370, `gratis_usado: false`).
// Um adaptador que reivindicasse o NOME globalmente devolveria `false`
// para esse personagem (não é Guardião, logo "sem uso disponível") e
// APAGARIA o botão "Grátis" do talento -- regressão numa funcionalidade
// que já estava em produção. O contrato é o de
// `magiaFixaMagoGratisDisponivel`: `null` quando o adaptador não se
// aplica, para quem chama cair no mecanismo padrão.
test('Tocado Por Fadas (não-Guardião) mantém o uso grátis de Passo Nebuloso -- o adaptador não reivindica o nome', async () => {
  const { sheetEstado, regrasUsosGratisMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Monge', nivel: 5 }]);
  p.talentos = ['Tocado Por Fadas'];
  p.magias_preparadas = [
    { nome: 'Passo Nebuloso', circulo: 2, origem: 'tocado_por_fadas', gratis_usado: false },
  ];
  sheetEstado.definirChar(p);

  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Passo Nebuloso'), null,
    'sem Guardião/Andarilho Feérico o adaptador não se aplica -- precisa devolver null para o botão do ' +
    'talento continuar saindo do `gratis_usado`, e não false, que o esconderia');
  assert.equal(regrasUsosGratisMagia.consumirUsoRecursoDedicadoGratis('Passo Nebuloso'), false,
    'e consumir precisa ser não-op, para o clique gastar o `gratis_usado` do talento');
});

// O inverso: um Guardião Andarilho Feérico que TAMBÉM tem o talento tem
// dois recursos distintos para a mesma magia (o do livro é assim). O
// adaptador gasta o da subclasse enquanto houver, e o `gratis_usado` do
// talento continua disponível depois -- por isso `consumir` devolve false
// quando o recurso dedicado esgota, deixando o mecanismo padrão assumir.
test('Andarilho Feérico COM Tocado Por Fadas: esgotar o recurso da subclasse não engole o uso do talento', async () => {
  const { sheetEstado, regrasUsosGratisMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guardião', nivel: 15, subclasse: 'Andarilho Feérico' }]);
  p.atributos.sabedoria = 12; // modificador +1 -> 1 uso de subclasse
  p.talentos = ['Tocado Por Fadas'];
  p.magias_preparadas = [
    { nome: 'Passo Nebuloso', circulo: 2, origem: 'tocado_por_fadas', gratis_usado: false },
  ];
  sheetEstado.definirChar(p);

  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Passo Nebuloso'), true,
    'o uso da subclasse (mod. Sabedoria +1) está disponível');
  assert.equal(regrasUsosGratisMagia.consumirUsoRecursoDedicadoGratis('Passo Nebuloso'), true);

  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Passo Nebuloso'), false,
    'o recurso da subclasse esgotou');
  assert.equal(regrasUsosGratisMagia.consumirUsoRecursoDedicadoGratis('Passo Nebuloso'), false,
    'consumir devolve false com o recurso dedicado esgotado -- é o que deixa o clique seguinte gastar o ' +
    '`gratis_usado` do talento, em vez de perder o uso que o livro concede');
});

test('Círculo das Estrelas nível 3: Raio Guia tem usos = modificador de Sabedoria (mínimo 1)', async () => {
  const { sheetEstado, regrasUsosGratisMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Druida', nivel: 3, subclasse: 'Círculo das Estrelas' }]);
  p.atributos.sabedoria = 18; // modificador +4
  sheetEstado.definirChar(p);

  for (let i = 0; i < 4; i++) {
    assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Raio Guia'), true,
      `uso ${i + 1}/4 (modificador de Sabedoria +4) precisa estar disponível`);
    regrasUsosGratisMagia.consumirUsoRecursoDedicadoGratis('Raio Guia');
  }
  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Raio Guia'), false,
    'depois dos 4 usos (modificador de Sabedoria), esgotado');
  assert.equal(p.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos, 4,
    'o adaptador escreve no MESMO campo que o painel de recursos do Druida lê');
});

test('Druida nível 2 (antes do Círculo das Estrelas): Raio Guia não tem uso grátis dedicado', async () => {
  const { sheetEstado, regrasUsosGratisMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Druida', nivel: 2, subclasse: 'Círculo das Estrelas' }]);
  sheetEstado.definirChar(p);

  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Raio Guia'), null,
    'Mapa Estelar só concede a partir do nível 3 -- adaptador não se aplica ainda (null, não false)');
});

// DISCRIMINADOR: um Druida de OUTRO círculo não pode ganhar o uso grátis
// do Círculo das Estrelas -- mesmo raciocínio do teste equivalente do
// Guardião/Andarilho Feérico, acima.
test('Druida de OUTRO círculo não ganha o uso grátis de Raio Guia (Mapa Estelar)', async () => {
  const { sheetEstado, regrasUsosGratisMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Druida', nivel: 6, subclasse: 'Círculo da Lua' }]);
  sheetEstado.definirChar(p);

  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Raio Guia'), null);
});

test('magia sem adaptador cadastrado: magiaRecursoDedicadoGratisDisponivel devolve null (cai no mecanismo padrão)', async () => {
  const { sheetEstado, regrasUsosGratisMagia } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guardião', nivel: 5 }]);
  sheetEstado.definirChar(p);

  assert.equal(regrasUsosGratisMagia.magiaRecursoDedicadoGratisDisponivel('Mísseis Mágicos'), null);
  assert.equal(regrasUsosGratisMagia.consumirUsoRecursoDedicadoGratis('Mísseis Mágicos'), false,
    'consumir devolve false (não-op) quando não há adaptador para o nome');
});
