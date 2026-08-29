import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, subirAteNivel } from './harness.mjs';

// Mago 5/Barbaro 1: o Barbaro e a armadilha do conjunto -- concede armas
// Marciais mas NAO Simples, e Escudo mas NAO armadura Leve nem Media.
// Se alguem copiar as proficiencias de classe unica para o caminho de
// multiclasse, ESTE e o teste que quebra.
const MAGO_BARBARO = {
  classe: 'Mago', subclasse: '', nivel: 6,
  classes: [
    { classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 },
    { classe: 'Bárbaro', subclasse: '', nivel: 1, ordem: 1 },
  ],
};

test('classe INICIAL entrega o conjunto completo', async () => {
  const { proficiencias } = await modulosApp();
  const c = proficiencias.concessoesDaClasse(MAGO_BARBARO, 'Mago');
  // Mago de classe unica nao tem armadura no catalogo do app, mas o
  // caminho da inicial tem de ler `info.armaduras`, nao o reduzido.
  assert.deepEqual(c.armaduras, []);
  assert.equal(c.pericias, 2, 'a classe inicial concede num_pericias, nao o reduzido');
});

test('classe NOVA entrega o subconjunto reduzido, nao o completo', async () => {
  const { proficiencias } = await modulosApp();
  const c = proficiencias.concessoesDaClasse(MAGO_BARBARO, 'Bárbaro');
  assert.deepEqual(c.armas, ['Marcial'], 'Marciais sim');
  assert.ok(!c.armas.includes('Simples'), 'Simples NAO -- o Barbaro so da Marcial em multiclasse');
  assert.deepEqual(c.armaduras, ['Escudo'], 'Escudo sim, armadura nao');
  assert.equal(c.pericias, 0);
});

test('a uniao cobre as duas classes sem repetir', async () => {
  const { proficiencias } = await modulosApp();
  assert.deepEqual(proficiencias.armadurasDoPersonagem(MAGO_BARBARO), ['Escudo']);
  // MEDIDO (nao estava no rascunho original): CLASSES_INFO['Mago'].armas
  // e ['Simples'] -- o Mago tambem e proficiente em armas simples, como
  // manda o livro. A uniao entrega 'Simples' (Mago, ordem 0, completo) +
  // 'Marcial' (Barbaro, reduzido), nessa ordem -- sem repetir.
  assert.deepEqual(proficiencias.armasDoPersonagem(MAGO_BARBARO), ['Simples', 'Marcial']);
});

// ORACULO DE INVERSAO -- o mais importante do arquivo.
// A MESMA dupla de classes na ordem trocada tem de dar resultado
// DIFERENTE: quem comeca Barbaro leva o conjunto COMPLETO do Barbaro
// (Leve, Media, Escudo, Simples, Marcial) e o REDUZIDO do Mago (nada).
// Sem este teste, uma implementacao que ignorasse `ordem` e sempre
// aplicasse o reduzido passaria em todos os testes acima.
test('inverter a ordem das classes inverte o conjunto', async () => {
  const { proficiencias } = await modulosApp();
  const barbaroPrimeiro = {
    classe: 'Bárbaro', subclasse: '', nivel: 6,
    classes: [
      { classe: 'Bárbaro', subclasse: '', nivel: 5, ordem: 0 },
      { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
    ],
  };
  const armaduras = proficiencias.armadurasDoPersonagem(barbaroPrimeiro);
  assert.ok(armaduras.includes('Média'),
    'Barbaro INICIAL da armadura Media; se so aparecer Escudo, o reduzido vazou para a classe inicial');
  assert.ok(proficiencias.armasDoPersonagem(barbaroPrimeiro).includes('Simples'),
    'Barbaro INICIAL da armas Simples');
});

// GUARDA DA DEDUPLICACAO -- Clerigo 5/Guerreiro 1 sobrepoe as TRES
// armaduras (Leve, Media, Escudo sao identicas nos dois conjuntos: o
// Clerigo INICIAL da o completo e o Guerreiro em multiclasse da o mesmo
// reduzido). Nenhum outro teste deste arquivo exercita
// `unirEntreClasses` com sobreposicao -- Mago/Barbaro (acima) nao repete
// nenhum rotulo. Sem o `if (!saida.includes(item))` de
// regras-multiclasse-proficiencias.js:105, a ficha deste personagem
// listaria "Leve, Media, Escudo, Leve, Media, Escudo".
test('a uniao nao repete quando as duas classes concedem a mesma armadura', async () => {
  const { proficiencias } = await modulosApp();
  const clerigoGuerreiro = {
    classe: 'Clérigo', subclasse: '', nivel: 6,
    classes: [
      { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
      { classe: 'Guerreiro', subclasse: '', nivel: 1, ordem: 1 },
    ],
  };
  assert.deepEqual(proficiencias.armadurasDoPersonagem(clerigoGuerreiro), ['Leve', 'Média', 'Escudo']);
});

// IMPORTANTE 1 da revisao final: o catalogo NAO usa vocabulario fechado.
// Ladino e Monge sao as duas unicas classes cujo conjunto COMPLETO traz
// rotulo composto ("Marcial (Acuidade ou Leve)" e "Marcial (Leve)"), e os
// fixtures deste sub-projeto usavam so Mago/Barbaro/Clerigo/Guerreiro como
// classe INICIAL -- nenhum deles compoe. A uniao com uma classe nova que da
// "Marcial" nu produzia, MEDIDO,
//   ["Simples", "Marcial (Acuidade ou Leve)", "Marcial"]
// e a ficha e a impressao renderizam UMA badge por item: o jogador via as
// duas afirmacoes lado a lado, uma delas (a restrita) ja sem valer.
//
// A dedup de `unirEntreClasses` compara por igualdade EXATA de string e nao
// tem como saber que "Marcial" engloba "Marcial (Acuidade ou Leve)" -- este
// e o caso dificil de sobreposicao (rotulos que se CONTEM), contra o caso
// facil (rotulos IDENTICOS) que o oraculo de dedup Clerigo/Guerreiro acima
// ja media.
test('Ladino INICIAL + classe nova com Marcial nu: a variante qualificada nao sobrevive', async () => {
  const { proficiencias } = await modulosApp();
  const ladinoGuerreiro = {
    classe: 'Ladino', subclasse: '', nivel: 6,
    classes: [
      { classe: 'Ladino', subclasse: '', nivel: 5, ordem: 0 },
      { classe: 'Guerreiro', subclasse: '', nivel: 1, ordem: 1 },
    ],
  };
  assert.deepEqual(proficiencias.armasDoPersonagem(ladinoGuerreiro), ['Simples', 'Marcial'],
    '"Marcial (Acuidade ou Leve)" e "Marcial" na mesma lista se contradizem na tela');
});

test('Monge INICIAL + Paladino: "Marcial (Leve)" tambem cai diante do "Marcial" nu', async () => {
  const { proficiencias } = await modulosApp();
  const mongePaladino = {
    classe: 'Monge', subclasse: '', nivel: 6,
    classes: [
      { classe: 'Monge', subclasse: '', nivel: 5, ordem: 0 },
      { classe: 'Paladino', subclasse: '', nivel: 1, ordem: 1 },
    ],
  };
  assert.deepEqual(proficiencias.armasDoPersonagem(mongePaladino), ['Simples', 'Marcial']);
});

// CONTROLE do filtro acima -- sem ele, uma implementacao que simplesmente
// apagasse TODO rotulo com parenteses passaria nos dois testes anteriores e
// tiraria do Ladino de classe unica a unica proficiencia Marcial que ele tem.
test('Ladino sozinho MANTEM "Marcial (Acuidade ou Leve)" -- nao ha "Marcial" nu para engloba-la', async () => {
  const { proficiencias } = await modulosApp();
  const ladino = {
    classe: 'Ladino', subclasse: '', nivel: 5,
    classes: [{ classe: 'Ladino', subclasse: '', nivel: 5, ordem: 0 }],
  };
  assert.deepEqual(proficiencias.armasDoPersonagem(ladino), ['Simples', 'Marcial (Acuidade ou Leve)']);
});

test('classe fora do catalogo falha fechada', async () => {
  const { proficiencias } = await modulosApp();
  const c = proficiencias.concessoesDaClasse(MAGO_BARBARO, 'Necromante');
  assert.deepEqual(c, { armaduras: [], armas: [], pericias: 0, ferramentas: [], instrumentos: 0 });
});

// As tres classes que concedem escolha de pericia NAO usam a mesma
// fonte. O livro trata Bardo diferente de Guardiao/Ladino, e este teste
// e o unico lugar que prova que a diferenca sobreviveu ao codigo.
test('Bardo escolhe entre TODAS as pericias; Guardiao e Ladino, so a lista da classe', async () => {
  const { proficiencias, dadosClasses } = await modulosApp();
  const bardo = proficiencias.concessoesAoEntrarEm('Bardo');
  assert.equal(bardo.pericias, 1);
  assert.equal(bardo.instrumentos, 1, 'Bardo tambem escolhe um Instrumento Musical');
  assert.equal(bardo.opcoesPericia.length, dadosClasses.PERICIAS.length,
    'Classes.md:366 diz "uma pericia a sua escolha" -- sem lista');

  const guardiao = proficiencias.concessoesAoEntrarEm('Guardião');
  assert.deepEqual(guardiao.opcoesPericia, dadosClasses.CLASSES_INFO['Guardião'].pericias_opcoes,
    'Classes.md:3246 restringe a lista do Guardiao');

  const ladino = proficiencias.concessoesAoEntrarEm('Ladino');
  assert.deepEqual(ladino.ferramentas, ['Ferramentas de Ladrão'],
    'a ferramenta do Ladino e FIXA, nao escolha');
});

// ============================================================
// Motor: pendencia e gravacao ao entrar em classe nova
// (site/js/levelup.js, bloco 'proficiencias_classe_nova').
//
// `personagemMulticlasse` sobe o personagem direto para nivel 5 sem
// passar por `subirDeNivel` -- por isso `opcoes.ignorar_xp: true` e
// necessario nas chamadas abaixo: o personagem sintetico nasce com
// `xp: 0` e `podeSubirDeNivel` recusaria antes mesmo de chegar na
// pendencia que estes testes medem.
// ============================================================

// O Ladino concede ferramenta FIXA: entra sozinha, sem escolha.
test('entrar em Ladino concede Ferramentas de Ladrao automaticamente', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Ladino', pericia_classe_nova: 'Furtividade', ignorar_xp: true,
  });
  assert.equal(r.sucesso, true, r.mensagem);
  assert.ok(p.proficiencias_ferramentas.includes('Ferramentas de Ladrão'));
  assert.ok(p.pericias_proficientes.includes('Furtividade'));
});

// ORACULO DECISIVO -- sem ele, um motor que ignorasse a pendencia
// gravaria a classe nova sem pericia nenhuma e ninguem veria.
//
// LARGADO NA REVISAO: o oraculo original so conferia `p.classes`. Uma
// escrita PARCIAL (por exemplo, gravar a pericia escolhida antes de
// recusar por causa do instrumento faltando) passaria batido. Agora as
// QUATRO coisas que a subida pode tocar entram no snapshot antes/depois:
// classes, pericias, ferramentas e instrumentos.
test('entrar em Guardiao SEM escolher pericia e recusado, e nada e gravado', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const antes = {
    classes: JSON.stringify(p.classes),
    pericias: JSON.stringify(p.pericias_proficientes || []),
    ferramentas: JSON.stringify(p.proficiencias_ferramentas || []),
    instrumentos: JSON.stringify(p.proficiencias_instrumentos || []),
  };
  const r = await levelup.subirDeNivel(p, { classe: 'Guardião', ignorar_xp: true });
  assert.equal(r.sucesso, false);
  assert.equal(r.tipo_pendencia, 'proficiencias_classe_nova');
  assert.equal(JSON.stringify(p.classes), antes.classes,
    'uma recusa nao pode ter gravado a classe -- nao existe descer de nivel');
  assert.equal(JSON.stringify(p.pericias_proficientes || []), antes.pericias,
    'uma recusa nao pode ter gravado pericia nenhuma');
  assert.equal(JSON.stringify(p.proficiencias_ferramentas || []), antes.ferramentas,
    'uma recusa nao pode ter gravado ferramenta nenhuma');
  assert.equal(JSON.stringify(p.proficiencias_instrumentos || []), antes.instrumentos,
    'uma recusa nao pode ter gravado instrumento nenhum');
});

test('pericia fora da lista da classe e recusada', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  // Arcanismo NAO esta em pericias_opcoes do Guardiao (Classes.md:3246).
  const r = await levelup.subirDeNivel(p, {
    classe: 'Guardião', pericia_classe_nova: 'Arcanismo', ignorar_xp: true,
  });
  assert.equal(r.sucesso, false);
  assert.equal(r.tipo_pendencia, 'proficiencias_classe_nova');
});

// MENOR 1 da revisao final: os TRES motivos de recusa (nao escolheu, fora da
// lista, ja possui) devolviam a MESMA mensagem -- "Escolha 1 pericia nova
// concedida por X". Quem foi recusado por JA POSSUIR era mandado escolher
// algo que a tela nem oferece (o select filtra as ja-possuidas), e quem
// mandou uma pericia fora da lista nao sabia qual das duas coisas errou.
// Os tres testes abaixo prendem as tres mensagens SEPARADAS. Sem eles, um
// futuro "simplifica isso numa mensagem so" desfaz o conserto em silencio:
// `tipo_pendencia` continua o mesmo nos tres casos, entao os oraculos
// existentes nao notariam.
test('recusa por NAO TER ESCOLHIDO nomeia o que falta', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, { classe: 'Guardião', ignorar_xp: true });
  assert.match(r.mensagem, /Escolha 1 perícia nova concedida por Guardião/);
});

test('recusa por PERICIA FORA DA LISTA nomeia a pericia e a lista', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Guardião', pericia_classe_nova: 'Arcanismo', ignorar_xp: true,
  });
  assert.match(r.mensagem, /Arcanismo/,
    'a mensagem tem de nomear a perícia recusada -- sem isso o chamador não sabe o que trocar');
  assert.match(r.mensagem, /lista de perícias que Guardião concede/);
});

test('recusa por JA POSSUIR a pericia manda escolher OUTRA, nao "escolha 1"', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  // Natureza esta na lista do Guardiao E o personagem ja e proficiente:
  // conceder de novo gastaria a concessao em silencio.
  p.pericias_proficientes = ['Natureza'];
  const r = await levelup.subirDeNivel(p, {
    classe: 'Guardião', pericia_classe_nova: 'Natureza', ignorar_xp: true,
  });
  assert.equal(r.sucesso, false);
  assert.equal(r.tipo_pendencia, 'proficiencias_classe_nova');
  assert.match(r.mensagem, /ainda não tenha proficiência/,
    'mandar "escolha 1 perícia nova" para quem já possui a escolhida pede algo que a tela não oferece');
});

test('recusa por INSTRUMENTO FORA DA LISTA nomeia o instrumento', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Bardo', pericia_classe_nova: 'Atuação',
    instrumento_classe_nova: 'Bateria Eletrônica', ignorar_xp: true,
  });
  assert.match(r.mensagem, /Bateria Eletrônica/);
  assert.match(r.mensagem, /não é um Instrumento Musical do livro/);
});

// MINOR 2 da revisao: o instrumento so era conferido por presenca e por
// "ja tem", nunca contra uma lista valida -- um chamador direto do motor
// podia gravar qualquer string em `proficiencias_instrumentos`. Espelha
// o teste da pericia fora da lista, acima, mas para o Bardo (unica
// classe que concede instrumento).
test('instrumento fora da lista de INSTRUMENTOS_MUSICAIS e recusado', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Bardo', pericia_classe_nova: 'Atuação', instrumento_classe_nova: 'Bateria Eletrônica',
    ignorar_xp: true,
  });
  assert.equal(r.sucesso, false);
  assert.equal(r.tipo_pendencia, 'proficiencias_classe_nova');
});

// RETITULADO NA REVISAO: o nome e o comentario antigos ("ehPrimeiroNivelDoPersonagem
// e o que separa os dois casos") eram falsos para esta fixture -- um
// Ladino 5 subindo para 6 na MESMA classe ja tem `ehPrimeiroNivelNaClasse
// === false`, que sozinho corta o `&&` antes de `ehPrimeiroNivelDoPersonagem`
// ser avaliado. Provado pela revisao: apagar
// `&& !sub.ehPrimeiroNivelDoPersonagem` de levelup.js:1447 nao quebrava
// este teste. O nome agora diz o que ele mede de verdade -- ver o
// CANARIO REAL logo abaixo para o outro campo.
test('subir de nivel numa classe que ja se tem (ehPrimeiroNivelNaClasse=false) nao pede pericia', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Ladino', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, { classe: 'Ladino', ignorar_xp: true });
  assert.equal(r.sucesso, true, 'o 6o nivel de Ladino nao e primeiro nivel NA CLASSE');
});

// CANARIO REAL de `ehPrimeiroNivelDoPersonagem` (IMPORTANT 1 da revisao).
// `subirDeNivel` recusa `classes[]` vazio (levelup.js:1122-1124) antes de
// chegar em `contextoDeSubida` -- entao a unica fixture ALCANCAVEL neste
// nivel que produz `nivelTotalAnterior === 0` e uma UNICA entrada de
// classe parada em nivel 0: o estado exato de um personagem que ainda
// nao tomou o 1o nivel (o cenario que o guard existe para proteger --
// criacao de personagem). `entradaDaClasse` ja existe em `classes[]`
// (nivel 0), entao a subida cai no ramo `nivel += 1`, NUNCA no ramo de
// push que grava concessoes -- coerente com o cabecalho do modulo: "as
// pericias da classe INICIAL vem do criador, completas".
test('personagem no proprio 1o nivel (ehPrimeiroNivelDoPersonagem) nao pede pericia de classe nova', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guardião', nivel: 0 }]);
  const r = await levelup.subirDeNivel(p, { classe: 'Guardião', ignorar_xp: true });
  assert.equal(r.sucesso, true, JSON.stringify(r));
});

// IMPORTANT 2 da revisao: sem um caso para 'proficiencias_classe_nova' em
// harness.mjs (responderPendencia), QUALQUER escada que entrasse em
// Bardo/Guardiao/Ladino como classe ADICIONAL esgotava as 12 tentativas
// de subirAteNivel e lancava -- a suite so nao notava porque a unica
// escada multiclasse existente usa Paladino (nao concede escolha
// nenhuma). Bardo exercita as DUAS pontas do caso novo (pericia E
// instrumento) na mesma chamada.
test('subirAteNivel entra em Bardo como segunda classe respondendo pericia e instrumento', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }]);
  await subirAteNivel(p, 'Bardo', 4);
  const entradaBardo = p.classes.find((c) => c.classe === 'Bardo');
  assert.ok(entradaBardo, 'Bardo deveria ter entrado em classes[]');
  assert.equal(entradaBardo.nivel, 1);
  assert.equal(p.pericias_proficientes.length, 1, 'a pendencia deveria ter concedido 1 pericia');
  assert.equal(p.proficiencias_instrumentos.length, 1, 'a pendencia deveria ter concedido 1 instrumento');
});
