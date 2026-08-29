import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, subirAteNivel } from './harness.mjs';

/** Monta uma ficha com o talento e N magias rituais ja escolhidas. */
function comRituais(nivel, quantas) {
  const nomes = ['Alarme', 'Detectar Magia', 'Identificar', 'Compreender Idiomas',
                 'Comunicação com Animais', 'Proteção Contra o Bem e o Mal'];
  return {
    classe: 'Mago', subclasse: '', nivel,
    classes: [{ classe: 'Mago', subclasse: '', nivel, ordem: 0 }],
    talentos: ['Conjurador Ritualista'],
    magias_preparadas: nomes.slice(0, quantas).map((nome) => ({
      nome, circulo: 1, origem: 'conjurador_ritualista',
    })),
  };
}

test('sem o talento, nao ha pendencia nenhuma', async () => {
  const { regras } = await modulosApp();
  const r = regras.ritualBonusPendente({ nivel: 17, talentos: [] });
  assert.equal(r.temTalento, false);
  assert.equal(r.faltam, 0);
});

// O CASO CENTRAL: nivel 4 (BP +2, 2 magias) sobe para 5 (BP +3).
test('cruzar o patamar do nivel 5 pede exatamente 1 magia', async () => {
  const { regras } = await modulosApp();
  const r = regras.ritualBonusPendente(comRituais(4, 2), 5);
  assert.equal(r.deve, 3);
  assert.equal(r.tem, 2);
  assert.equal(r.faltam, 1);
});

test('nivel que NAO cruza patamar nao pede nada', async () => {
  const { regras } = await modulosApp();
  // 5 -> 6: o Bonus de Proficiencia segue +3.
  const r = regras.ritualBonusPendente(comRituais(5, 3), 6);
  assert.equal(r.faltam, 0, 'so os niveis 5, 9, 13 e 17 aumentam o Bonus de Proficiencia');
});

// Os quatro patamares, de uma vez. Se alguem trocar o invariante por uma
// lista fixa [5, 9, 13, 17], este teste continua passando -- mas o de
// baixo (ficha atrasada) quebra, que e o ponto.
test('os quatro patamares do livro pedem uma magia cada', async () => {
  const { regras } = await modulosApp();
  for (const [nivel, deve] of [[5, 3], [9, 4], [13, 5], [17, 6]]) {
    const r = regras.ritualBonusPendente(comRituais(nivel - 1, deve - 1), nivel);
    assert.equal(r.faltam, 1, `nivel ${nivel} tem de pedir 1 magia`);
    assert.equal(r.deve, deve, `nivel ${nivel} tem de exigir ${deve} magias no total`);
  }
});

// ORACULO DECISIVO -- e a razao de o invariante existir.
// Uma ficha que JA e nivel 9 com so 2 magias (porque o crescimento nunca
// foi implementado) tem de acusar DUAS faltando, nao zero. Uma
// implementacao que reagisse so ao evento de subida devolveria 0 aqui e
// o jogador ficaria preso em 2 magias para sempre.
test('ficha atrasada acusa TODAS as magias que faltam de uma vez', async () => {
  const { regras } = await modulosApp();
  const r = regras.ritualBonusPendente(comRituais(9, 2), 9);
  assert.equal(r.deve, 4);
  assert.equal(r.tem, 2);
  assert.equal(r.faltam, 2, 'o atraso acumulado tem de aparecer inteiro');
});

test('magias A MAIS nunca viram pendencia negativa', async () => {
  const { regras } = await modulosApp();
  const r = regras.ritualBonusPendente(comRituais(4, 5), 4);
  assert.equal(r.faltam, 0, 'tirar magia do jogador nao e o que o talento manda');
});

// Magias rituais de OUTRA origem (Tocado Pelas Sombras, magia de dominio)
// nao podem ser contadas como se fossem do talento.
test('so magias com origem conjurador_ritualista contam', async () => {
  const { regras } = await modulosApp();
  const char = comRituais(5, 3);
  char.magias_preparadas.push({ nome: 'Alarme', circulo: 1, origem: 'dominio' });
  const r = regras.ritualBonusPendente(char, 5);
  assert.equal(r.tem, 3, 'a magia de dominio nao pertence ao talento');
  assert.equal(r.faltam, 0);
});

test('talento gravado como objeto {nome} tambem e detectado', async () => {
  const { regras } = await modulosApp();
  const char = comRituais(5, 2);
  char.talentos = [{ nome: 'Conjurador Ritualista' }];
  const r = regras.ritualBonusPendente(char, 5);
  assert.equal(r.temTalento, true, 'fichas importadas trazem o formato de objeto');
  assert.equal(r.faltam, 1);
});

// ============================================================
// TAREFA 2 -- oraculos do MOTOR (subirDeNivel): pendencia e gravacao.
// Os oraculos acima confirmam so o CALCULO (ritualBonusPendente); estes
// confirmam que subirDeNivel de fato RECUSA a subida quando falta magia e
// GRAVA a escolha quando ela vem completa -- ver Talentos.md:370 e o bloco
// "CRESCIMENTO DO CONJURADOR RITUALISTA" em site/js/levelup.js.
// ============================================================

// Duas magias de Mago SEM relacao com o Conjurador Ritualista, usadas so
// para satisfazer a pendencia de Grimorio que QUALQUER subida de Mago
// exige (levelup.js, exigeGrimorioMago = sub.classe === 'Mago', sem
// excecao de nivel) -- sem isto, um call unico nunca teria como suceder,
// travando numa pendencia diferente da que cada teste quer medir.
const GRIMORIO_NIVEL_5 = ['Armadura Arcana', 'Escudo Arcano'];

test('subir para o nivel 5 com o talento e recusado sem escolher a magia', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 4 }]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
  ];
  const r = await levelup.subirDeNivel(p, { classe: 'Mago', ignorar_xp: true });
  assert.equal(r.sucesso, false);
  assert.equal(r.tipo_pendencia, 'ritual_bonus_proficiencia');
});

test('com a magia escolhida, a subida conclui e a magia entra na ficha', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 4 }]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
  ];
  const r = await levelup.subirDeNivel(p, {
    classe: 'Mago', ignorar_xp: true,
    rituais_bonus_proficiencia: ['Detectar Magia'],
    grimorio_selecionados: GRIMORIO_NIVEL_5,
  });
  assert.equal(r.sucesso, true, r.mensagem);
  const doTalento = p.magias_preparadas.filter((m) => m.origem === 'conjurador_ritualista');
  assert.equal(doTalento.length, 3, 'tem de bater com o Bonus de Proficiencia do nivel 5');
  assert.ok(doTalento.some((m) => m.nome === 'Detectar Magia'));
});

// FIX ROUND 2 -- achado Important da revisao: o guard validava uma COPIA
// filtrada (`escolhidas`, escopada ao `if` do guard), mas a gravacao
// (mais abaixo em levelup.js) relia `opcoes.rituais_bonus_proficiencia`
// bruto de novo -- guard e gravacao podiam divergir. Um array com os
// nomes validos MAIS lixo (string vazia, `null`) passava pela contagem
// do guard (que so conta o que sobra depois do filtro) mas a gravacao,
// lendo o array cru, empurrava tambem o lixo -- permanente e silencioso,
// numa ficha sem "descer de nivel". A correcao faz a gravacao consumir a
// MESMA variavel que o guard aprovou (`magiasRitualBonusSelecionadas`,
// hoisted), nunca mais o array bruto.
test('lixo (string vazia, nao-string) junto de nomes validos e descartado, nunca gravado', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 4 }]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
  ];
  const r = await levelup.subirDeNivel(p, {
    classe: 'Mago', ignorar_xp: true,
    // faltam === 1 neste nivel (ver oraculo de recusa acima) -- a UNICA
    // magia valida vem acompanhada de uma string vazia e de um
    // nao-string (`null`), que a normalizacao do guard tem de descartar
    // SEM que a gravacao os veja.
    rituais_bonus_proficiencia: ['Detectar Magia', '', null],
    grimorio_selecionados: GRIMORIO_NIVEL_5,
  });
  assert.equal(r.sucesso, true, r.mensagem);
  const doTalento = p.magias_preparadas.filter((m) => m.origem === 'conjurador_ritualista');
  assert.equal(doTalento.length, 3,
    'tem de ganhar EXATAMENTE 1 magia nova (faltam), nunca uma por entrada de lixo');
  assert.ok(!doTalento.some((m) => !m.nome), 'nenhuma entrada com nome vazio/falsy pode ser gravada');
  assert.ok(doTalento.some((m) => m.nome === 'Detectar Magia'));
});

test('repetir uma magia que ja esta na lista e recusado', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 4 }]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
  ];
  const r = await levelup.subirDeNivel(p, {
    classe: 'Mago', ignorar_xp: true,
    rituais_bonus_proficiencia: ['Alarme'],
  });
  assert.equal(r.sucesso, false, 'repetir gastaria o ganho em silencio');
  assert.equal(r.tipo_pendencia, 'ritual_bonus_proficiencia');
});

// FIX ROUND 1 -- achado Important da revisao: o guard antigo so conferia
// quantidade/distincao/repeticao, nunca se o nome era mesmo uma magia de
// 1o circulo com o marcador Ritual (Talentos.md:370). Sem checagem, uma
// magia real de OUTRO circulo (ou sem Ritual) entrava como sempre-
// preparada para sempre -- e como ritualBonusPendente conta so por
// `origem`, o personagem nunca seria perguntado de novo (nao ha "descer
// de nivel" nesta ficha: e permanente e silencioso). 'Bola de Fogo' e
// real (dados/magias/_indice.json), mas e 3o circulo e `tempo_conjuracao`
// e so "Ação" -- nem o circulo nem o marcador batem.
test('magia real mas invalida (circulo errado, sem marcador Ritual) e recusada', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 4 }]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
  ];
  const r = await levelup.subirDeNivel(p, {
    classe: 'Mago', ignorar_xp: true,
    rituais_bonus_proficiencia: ['Bola de Fogo'],
  });
  assert.equal(r.sucesso, false, 'Bola de Fogo e 3o circulo e nao tem o marcador Ritual');
  assert.equal(r.tipo_pendencia, 'ritual_bonus_proficiencia');
});

// CANARIO -- quem NAO tem o talento nao pode ser afetado por nada disto.
// Mesmo nivel e mesmo Grimorio do teste de sucesso acima -- a UNICA
// variavel que muda e a ausencia do talento -- para que "passar sem
// rituais_bonus_proficiencia" so possa vir da ausencia do talento, nunca
// de uma coincidencia da fixture (ex.: faltar o `magias_preparadas` que os
// outros testes montam). FIX ROUND 1: alem de suceder, confere que
// `magias_preparadas` sai INTOCADO -- sem isto o canario ficaria verde
// mesmo se o bloco de gravacao (levelup.js, ~"CRESCIMENTO DO CONJURADOR
// RITUALISTA -- fora do bloco de aquisicao") perdesse o guard
// `ritualPendente.faltam > 0` e gravasse algo para quem nao tem o talento.
test('personagem sem o talento sobe do 4 para o 5 normalmente', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 4 }]);
  const antesMagiasPreparadas = JSON.parse(JSON.stringify(p.magias_preparadas || []));
  const r = await levelup.subirDeNivel(p, {
    classe: 'Mago', ignorar_xp: true,
    grimorio_selecionados: GRIMORIO_NIVEL_5,
  });
  assert.equal(r.sucesso, true, r.mensagem);
  assert.deepEqual(p.magias_preparadas, antesMagiasPreparadas,
    'sem o talento, magias_preparadas tem de sair exatamente como entrou');
});

// MULTICLASSE: o Bonus de Proficiencia e do nivel TOTAL (livro:2047). Um
// Guerreiro 3/Mago 5 subindo o Mago para 6 cruza o total 8 -> 9, e o Bonus
// de Proficiencia vai de +3 para +4: TEM de pedir a magia, mesmo com o
// nivel NA CLASSE (5 -> 6) nao batendo com nenhum dos quatro patamares do
// livro (5, 9, 13, 17). Este e o cenario que separa "nivel total" de
// "nivel na classe" -- em classe unica os dois andam juntos e um erro
// aqui seria inalcancavel.
//
// Mago sobe de 5 para 6 (nao de 3 para 4) DE PROPOSITO: nivelNaClasseNovo
// = 4 e um nivel de Aumento no Valor de Atributo do Mago
// (concedeAumentoAtributo, levelup.js) -- essa pendencia (`aumento_atributo`)
// dispara ANTES da de rituais no codigo e mediria outra coisa. nivel 6 nao
// e ASI, nem subclasse (3) nem Academico (2): a UNICA pendencia que resta
// e a que este teste quer medir.
//
// Personagem montado DIRETO com as duas classes (personagemMulticlasse
// aceita mais de uma entrada no roteiro), nao via subirAteNivel: o
// `nivelAlvo` desta ultima e o nivel TOTAL final (documentado no proprio
// harness.mjs), entao levar um Guerreiro 3/Mago 5 la exigiria resolver
// pendencias de classes que este teste nao quer medir.
test('em multiclasse o patamar e do nivel TOTAL, nao do nivel na classe', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 3 },
    { classe: 'Mago', nivel: 5 },
  ]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Compreender Idiomas', circulo: 1, origem: 'conjurador_ritualista' },
  ];
  const r = await levelup.subirDeNivel(p, { classe: 'Mago', ignorar_xp: true });
  assert.equal(r.sucesso, false, 'total 8 -> 9 cruza o patamar do Bonus de Proficiencia');
  assert.equal(r.tipo_pendencia, 'ritual_bonus_proficiencia');
});

// RULING 6 do plano -- prova que responderPendencia (harness.mjs) sabe
// resolver esta pendencia SOZINHO. Sem este caso, QUALQUER escada que
// cruzasse um patamar de Bonus de Proficiencia com o talento equipado
// esgotaria as 12 tentativas de subirAteNivel e lancaria -- foi exatamente
// isto que faltou na tarefa imediatamente anterior deste mesmo plano
// (achado Important da revisao, custou uma rodada de correcao).
test('subirAteNivel completa a escada sozinho com o talento equipado (4 -> 5)', async () => {
  const { regras } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 4 }]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
  ];
  await subirAteNivel(p, 'Mago', 5);
  assert.equal(p.nivel, 5);
  const pendente = regras.ritualBonusPendente(p);
  assert.equal(pendente.faltam, 0, 'a escada tem de completar o crescimento, nao so o nivel');
  assert.equal(pendente.tem, 3, 'Bonus de Proficiencia do nivel 5 e +3');
});

// ============================================================
// ONDA DE CORRECAO DA REVISAO FINAL DE BRANCH
// ============================================================

/**
 * Monta o contexto REAL do assistente (buildLevelUpContext) para a classe
 * pedida, ja com a lista de magias rituais carregada como irParaStep
 * (levelup-ui.js) carrega. Existe para os oraculos da TELA nao inventarem
 * um `ctx` de mentira: a forma do contexto e o que o card e o predicado
 * consomem, e um objeto montado a mao no teste esconderia justamente uma
 * troca de campo em `ritualBonus`.
 */
async function contextoDaTela(personagem, nomeClasse) {
  const { db, levelupFlow } = await modulosApp();
  const classeData = await db.getClasse(nomeClasse);
  const ctx = await levelupFlow.buildLevelUpContext(personagem, classeData, {}, nomeClasse);
  ctx.magiasRituaisDisponiveis = await db.getMagiasRituais(1);
  return ctx;
}

/** Nomes oferecidos como caixa marcavel no card de rituais. */
function opcoesDoCard(html) {
  return [...html.matchAll(/name="ritual-bonus" value="([^"]*)"/g)].map((m) => m[1]);
}

// ------------------------------------------------------------
// IMPORTANT 1 -- colisao de NOME com magia preparada por outra origem.
//
// A tela oferecia, e o motor aceitava, uma magia ritual que o personagem ja
// tinha preparada por OUTRA via (preparacao normal, magia de dominio,
// Tocado Pelas Sombras), porque os dois so consultavam `jaEscolhidas` (as
// do proprio talento). A gravacao deduplica por `nome` + `origem` -- de
// proposito, para o invariante nao entrar em laco -- entao empurrava uma
// SEGUNDA entrada com o mesmo nome, permanente, numa ficha sem "descer de
// nivel". Nenhum fixture do plano tinha origens misturadas no caminho de
// GRAVACAO: a contagem era testada, a escolha colidindo nunca.
// ------------------------------------------------------------

/** Mago 4 com o talento, 2 rituais do talento e 1 ritual de OUTRA origem. */
async function magoComColisao() {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 4 }]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
    // Mesma magia que o talento poderia conceder, mas preparada por outra
    // via -- e o unico ingrediente que faltava aos fixtures do plano.
    { nome: 'Detectar Magia', circulo: 1, origem: 'dominio' },
  ];
  return p;
}

test('escolher magia ja preparada por OUTRA origem e recusado, e nada e gravado', async () => {
  const { levelup } = await modulosApp();
  const p = await magoComColisao();
  const antes = JSON.parse(JSON.stringify(p.magias_preparadas));
  const r = await levelup.subirDeNivel(p, {
    classe: 'Mago', ignorar_xp: true,
    rituais_bonus_proficiencia: ['Detectar Magia'],
    grimorio_selecionados: GRIMORIO_NIVEL_5,
  });
  assert.equal(r.sucesso, false,
    'gravar aqui criaria uma SEGUNDA entrada "Detectar Magia", permanente');
  assert.equal(r.tipo_pendencia, 'ritual_bonus_proficiencia');
  assert.deepEqual(p.magias_preparadas, antes,
    'a recusa nao pode deixar rastro em magias_preparadas');
});

test('com outro nome, a subida conclui e nenhum nome fica duplicado na ficha', async () => {
  const { levelup } = await modulosApp();
  const p = await magoComColisao();
  const r = await levelup.subirDeNivel(p, {
    classe: 'Mago', ignorar_xp: true,
    rituais_bonus_proficiencia: ['Compreender Idiomas'],
    grimorio_selecionados: GRIMORIO_NIVEL_5,
  });
  assert.equal(r.sucesso, true, r.mensagem);
  const nomes = p.magias_preparadas.map((m) => m.nome);
  assert.equal(new Set(nomes).size, nomes.length,
    `nenhum nome pode aparecer duas vezes em magias_preparadas: ${nomes.join(', ')}`);
  const doTalento = p.magias_preparadas
    .filter((m) => m.origem === 'conjurador_ritualista').map((m) => m.nome).sort();
  assert.deepEqual(doTalento, ['Alarme', 'Compreender Idiomas', 'Identificar']);
  // A entrada de dominio tem de sair INTOCADA: adotar a entrada existente
  // (como Iniciado em Magia faz) roubaria a magia do dominio.
  assert.deepEqual(p.magias_preparadas.find((m) => m.nome === 'Detectar Magia'),
    { nome: 'Detectar Magia', circulo: 1, origem: 'dominio' });
});

test('a TELA nao oferece a magia preparada por outra origem, e o predicado a recusa', async () => {
  const { levelupCards, levelupFlow } = await modulosApp();
  const p = await magoComColisao();
  const ctx = await contextoDaTela(p, 'Mago');
  assert.equal(ctx.ritualBonus.faltam, 1, 'fixture: o nivel 5 pede exatamente 1 magia');

  const html = levelupCards.renderCardRitualBonus(ctx, { rituaisBonusSelecionados: [] });
  const oferecidas = opcoesDoCard(html);
  assert.ok(!oferecidas.includes('Detectar Magia'),
    'oferecer a magia colidindo e o que produzia a entrada duplicada');
  assert.ok(!oferecidas.includes('Alarme') && !oferecidas.includes('Identificar'),
    'as do proprio talento continuam fora do seletor');
  assert.ok(oferecidas.includes('Servo Invisível'),
    'as outras rituais de 1o circulo continuam disponiveis');
  assert.ok(html.includes('Fora da lista por já estarem preparadas por outra origem: Detectar Magia'),
    'a opcao que some tem de ser NOMEADA -- sumir em silencio e a falha que o card evita');

  // TELA e MOTOR na mesma linha: o predicado que libera o "Confirmar"
  // (step.completo e validateAll) tem de recusar o mesmo nome que o guard.
  assert.equal(levelupFlow.ritualBonusProficienciaCompleto(ctx,
    { rituaisBonusSelecionados: ['Detectar Magia'] }), false);
  assert.equal(levelupFlow.ritualBonusProficienciaCompleto(ctx,
    { rituaisBonusSelecionados: ['Compreender Idiomas'] }), true);
});

// ------------------------------------------------------------
// IMPORTANT 2 -- a mensagem afirmava que o Bonus de Proficiencia tinha
// aumentado SEMPRE, inclusive no nivel em que ele nao aumentou. O portao e
// um invariante: ele tambem dispara por DIVIDA ACUMULADA, que e a razao
// declarada de o invariante existir.
// ------------------------------------------------------------

/** Guerreiro 9 (Bonus +4) com so 3 magias do talento: divide sem patamar. */
async function guerreiroEmDivida(nivel, quantasDoTalento) {
  const nomes = ['Alarme', 'Identificar', 'Compreender Idiomas', 'Detectar Veneno e Doença'];
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel }]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = nomes.slice(0, quantasDoTalento)
    .map((nome) => ({ nome, circulo: 1, origem: 'conjurador_ritualista' }));
  return p;
}

test('no nivel que CRUZA o patamar, a mensagem fala do aumento', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 4 }]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
  ];
  const r = await levelup.subirDeNivel(p, { classe: 'Mago', ignorar_xp: true });
  assert.equal(r.sucesso, false);
  assert.ok(r.mensagem.includes('subiu para +3'),
    `o Bonus de Proficiencia subiu mesmo de +2 para +3 aqui: ${r.mensagem}`);
});

// 9 -> 10 NAO cruza patamar (Bonus +4 dos dois lados, livro:2047), mas a
// ficha deve 4 e tem 3 -- o caso central do desenho, e justo onde a
// mensagem antiga mentia.
test('no nivel SEM aumento, a mensagem nao pode afirmar que o Bonus subiu', async () => {
  const { levelup } = await modulosApp();
  const p = await guerreiroEmDivida(9, 3);
  const r = await levelup.subirDeNivel(p, { classe: 'Guerreiro', ignorar_xp: true });
  assert.equal(r.sucesso, false);
  assert.equal(r.tipo_pendencia, 'ritual_bonus_proficiencia');
  assert.ok(!/subiu|aumentou/.test(r.mensagem),
    `o Bonus de Proficiencia e +4 antes e depois -- a mensagem nao pode dizer que mudou: ${r.mensagem}`);
  assert.ok(r.mensagem.includes('mantém 4 magias rituais'),
    `a mensagem tem de dizer a QUANTIDADE devida: ${r.mensagem}`);
  assert.ok(r.mensagem.includes('sua ficha tem 3'),
    `a mensagem tem de dizer quantas a ficha tem: ${r.mensagem}`);
});

test('o CARD ramifica pelo mesmo criterio da mensagem do motor', async () => {
  const { levelupCards } = await modulosApp();

  const semAumento = await contextoDaTela(await guerreiroEmDivida(9, 3), 'Guerreiro');
  assert.equal(semAumento.bonusMudou, false, 'fixture: 9 -> 10 nao cruza patamar');
  const htmlDivida = levelupCards.renderCardRitualBonus(semAumento, { rituaisBonusSelecionados: [] });
  assert.ok(!/subiu|aumentou/.test(htmlDivida),
    `o card nao pode anunciar um aumento que nao houve: ${htmlDivida}`);
  assert.ok(htmlDivida.includes('Sua ficha tem menos magias rituais'),
    'o card tem de dizer o que de fato aconteceu');
  assert.ok(htmlDivida.includes('e você tem 3'), 'o card tem de dizer quantas a ficha tem');

  const comAumento = await contextoDaTela(await guerreiroEmDivida(8, 3), 'Guerreiro');
  assert.equal(comAumento.bonusMudou, true, 'fixture: 8 -> 9 cruza o patamar');
  const htmlPatamar = levelupCards.renderCardRitualBonus(comAumento, { rituaisBonusSelecionados: [] });
  assert.ok(htmlPatamar.includes('Seu Bônus de Proficiência subiu para +4'),
    `no patamar o card continua anunciando o aumento: ${htmlPatamar}`);
});

// ------------------------------------------------------------
// IMPORTANT 4 -- `faltam >= 2` (a divida acumulada, unica justificativa do
// invariante) so existia na funcao de contagem: motor e tela eram medidos
// SEMPRE com `faltam === 1`. O laco de gravacao com 2+ nomes, a checagem de
// distincao com 2+ e a mensagem no plural nao tinham prova nenhuma.
//
// Guerreiro 8 -> 9: total 9 da Bonus +4, a ficha tem 2 do talento, faltam 2.
// Guerreiro nao e conjurador (sem grimorio no caminho) e o nivel 9 nao
// concede ASI (4/6/8/12/14/16/19) nem subclasse (3): a UNICA pendencia
// possivel e a que estes oraculos medem.
// ------------------------------------------------------------

test('faltam 2: escolher so 1 e recusado, com a mensagem no plural', async () => {
  const { levelup } = await modulosApp();
  const p = await guerreiroEmDivida(8, 2);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Guerreiro', ignorar_xp: true,
    rituais_bonus_proficiencia: ['Detectar Magia'],
  });
  assert.equal(r.sucesso, false, 'metade da divida nao pode passar');
  assert.equal(r.tipo_pendencia, 'ritual_bonus_proficiencia');
  assert.ok(r.mensagem.includes('2 magias rituais de 1º círculo distintas'),
    `a mensagem tem de pedir as DUAS: ${r.mensagem}`);
  assert.equal(p.magias_preparadas.length, 2, 'nada pode ter sido gravado');
});

test('faltam 2: repetir o mesmo nome duas vezes e recusado', async () => {
  const { levelup } = await modulosApp();
  const p = await guerreiroEmDivida(8, 2);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Guerreiro', ignorar_xp: true,
    rituais_bonus_proficiencia: ['Detectar Magia', 'Detectar Magia'],
  });
  assert.equal(r.sucesso, false,
    'duas entradas iguais gravariam UMA magia e a divida voltaria na proxima subida');
  assert.equal(r.tipo_pendencia, 'ritual_bonus_proficiencia');
  assert.equal(p.magias_preparadas.length, 2, 'nada pode ter sido gravado');
});

test('faltam 2: com as duas escolhidas, o motor grava as DUAS de uma vez', async () => {
  const { levelup, regras } = await modulosApp();
  const p = await guerreiroEmDivida(8, 2);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Guerreiro', ignorar_xp: true,
    rituais_bonus_proficiencia: ['Detectar Magia', 'Servo Invisível'],
  });
  assert.equal(r.sucesso, true, r.mensagem);
  const doTalento = p.magias_preparadas
    .filter((m) => m.origem === 'conjurador_ritualista').map((m) => m.nome).sort();
  assert.deepEqual(doTalento,
    ['Alarme', 'Detectar Magia', 'Identificar', 'Servo Invisível'],
    'o laco de gravacao tem de gravar as duas, nem uma nem tres');
  for (const m of p.magias_preparadas.filter((x) => x.origem === 'conjurador_ritualista')) {
    assert.equal(m.circulo, 1, 'o talento so concede 1o circulo (Talentos.md:370)');
  }
  assert.equal(regras.ritualBonusPendente(p).faltam, 0,
    'depois da gravacao a divida do nivel 9 tem de estar quitada');
});

test('faltam 2 na TELA: o card pede 2 e o predicado so aceita 2 distintas', async () => {
  const { levelupCards, levelupFlow } = await modulosApp();
  const ctx = await contextoDaTela(await guerreiroEmDivida(8, 2), 'Guerreiro');
  assert.equal(ctx.ritualBonus.faltam, 2, 'fixture: total 9 pede 4 e a ficha tem 2');

  const html = levelupCards.renderCardRitualBonus(ctx, { rituaisBonusSelecionados: [] });
  assert.ok(html.includes('data-faltam="2"'), 'o limite do bind sai deste atributo');
  assert.ok(html.includes('>0</span>/2'), 'o contador tem de fechar em 2');
  assert.ok(html.includes('escolha mais 2'), 'o texto tem de pedir as duas');

  const completo = (sel) => levelupFlow.ritualBonusProficienciaCompleto(ctx,
    { rituaisBonusSelecionados: sel });
  assert.equal(completo(['Detectar Magia']), false, 'uma so nao quita a divida');
  assert.equal(completo(['Detectar Magia', 'Detectar Magia']), false, 'repetida nao conta duas vezes');
  assert.equal(completo(['Detectar Magia', 'Alarme']), false, 'Alarme ja e do talento');
  assert.equal(completo(['Detectar Magia', 'Bola de Fogo']), false, 'Bola de Fogo nao e ritual de 1o circulo');
  assert.equal(completo(['Detectar Magia', 'Servo Invisível']), true);
});
