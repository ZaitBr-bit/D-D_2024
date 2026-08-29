// ============================================================
// Oráculos da subida de nível com escolha de classe (sub-projeto 5).
//
// O QUE ESTE ARQUIVO PRENDE que nenhum guarda estático pega: a diferença
// entre nível NA CLASSE e nível TOTAL. Os dois eram a mesma variável
// (`novoNivel`); depois desta conversão o símbolo continua parecido e só
// o significado muda, então um guarda sintático fica verde por
// construção. Os dois CONTRA-oráculos (espécie e bônus de proficiência)
// valem tanto quanto os demais: sem eles, uma conversão que trocasse
// TUDO por nível de classe passaria igualmente verde.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modulosApp, personagemMulticlasse, subirAteNivel } from './harness.mjs';

const mods = await modulosApp();

test('contextoDeSubida separa nível na classe de nível total', async () => {
  const { multiclasseProgressao: mp } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5 }, { classe: 'Bárbaro', nivel: 2 },
  ]);
  assert.equal(p.nivel, 7, 'total 7 -- é ele que confunde a leitura antiga');

  const noBarbaro = mp.contextoDeSubida(p, 'Bárbaro');
  assert.equal(noBarbaro.nivelNaClasseNovo, 3, 'Bárbaro 2 -> 3');
  assert.equal(noBarbaro.nivelTotalNovo, 8, 'e o personagem vai a 8');
  assert.equal(noBarbaro.dadoVida, 12, 'o dado é o do Bárbaro, d12');
  assert.equal(noBarbaro.ehPrimeiroNivelNaClasse, false);
  assert.equal(noBarbaro.ehPrimeiroNivelDoPersonagem, false);

  const noClerigo = mp.contextoDeSubida(p, 'Clérigo');
  assert.equal(noClerigo.nivelNaClasseNovo, 1, 'classe nova entra no nível 1 DELA');
  assert.equal(noClerigo.nivelTotalNovo, 8, 'mas o personagem vai a 8 do mesmo jeito');
  assert.equal(noClerigo.ehPrimeiroNivelNaClasse, true);
  assert.equal(noClerigo.ehPrimeiroNivelDoPersonagem, false,
    'NÃO é o 1º nível do personagem -- é isto que decide o dado cheio de PV');
});

test('contextoDeSubida: a subclasse é a DAQUELA classe, não o espelho', async () => {
  const { multiclasseProgressao: mp } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5, subclasse: 'Escola de Evocação' },
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
  ]);
  assert.equal(p.subclasse, 'Escola de Evocação', 'o espelho aponta para o Mago');
  assert.equal(mp.contextoDeSubida(p, 'Guerreiro').subclasse, 'Campeão');
  assert.equal(mp.contextoDeSubida(p, 'Mago').subclasse, 'Escola de Evocação');
  assert.equal(mp.contextoDeSubida(p, 'Ladino').subclasse, '',
    'classe que o personagem não tem: subclasse vazia, não a do espelho');
});

test('contextoDeSubida: personagem de nível 1 tem os DOIS "primeiro nível"', async () => {
  const { multiclasseProgressao: mp } = mods;
  const vazio = { atributos: { constituicao: 14 }, classes: [] };
  const ctx = mp.contextoDeSubida(vazio, 'Mago');
  assert.equal(ctx.ehPrimeiroNivelNaClasse, true);
  assert.equal(ctx.ehPrimeiroNivelDoPersonagem, true);
  assert.equal(ctx.nivelTotalNovo, 1);
});

test('contextoDeSubida: classe fora do catálogo falha fechada', async () => {
  const { multiclasseProgressao: mp } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const ctx = mp.contextoDeSubida(p, 'Bardo Sombrio');
  assert.equal(ctx.permitido, false, 'nome desconhecido não pode ser permitido');
  assert.equal(ctx.dadoVida, 0, 'e não propaga undefined para o cálculo de PV');
});

test('contextoDeSubida repassa o pré-requisito de podeEntrarEm', async () => {
  const { multiclasseProgressao: mp } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  // personagemMulticlasse fixa todos os atributos em 15 (+2): tudo passa.
  assert.equal(mp.contextoDeSubida(p, 'Paladino').permitido, true);

  p.atributos = { ...p.atributos, carisma: 11 };
  const bloqueado = mp.contextoDeSubida(p, 'Paladino');
  assert.equal(bloqueado.permitido, false, 'Carisma 11 barra o Paladino (livro:2033)');
  assert.ok(bloqueado.faltando.some((f) => f.atributo === 'Carisma' && f.valor === 11),
    'e `faltando` nomeia o atributo e o valor atual, para a tela escrever o motivo');
});

// ============================================================
// Tarefa 3b: a subida grava em `classes[]`, e nada mais grava espaço de
// magia. Estes dois oráculos prendem o que a conversão mais arriscava:
// apagar o GASTO do jogador, e ressuscitar a forma híbrida de
// `espacos_magia` (chaves numéricas de círculo convivendo com as chaves
// de fonte) que o sub-projeto 4 documentou como o único caso desprotegido.
// ============================================================

test('subida de nível: o gasto de espaço de magia do jogador sobrevive', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.espacos_magia = { conjuracao: { 1: 2 }, pacto: {} };

  // `subirAteNivel` responde as pendencias do nivel (o Mago pede duas
  // magias novas de grimorio a cada nivel) -- e o mesmo auxiliar que a
  // caracterizacao usa.
  await subirAteNivel(p, 'Mago', 6);

  assert.equal(p.espacos_magia.conjuracao['1'], 2,
    'os 2 espaços gastos de 1º círculo continuam gastos depois da subida');
  assert.ok(!Object.keys(p.espacos_magia).some((k) => /^\d+$/.test(k)),
    'e nenhuma chave NUMÉRICA de círculo aparece -- a forma híbrida não pode voltar');
});

test('subida de nível: o nível entra em classes[], e os espelhos seguem', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 5 }, { classe: 'Guerreiro', nivel: 2 },
  ]);

  // O Guerreiro chega ao 3o nivel DELE, que exige escolher subclasse --
  // `subirAteNivel` resolve a pendencia com a primeira opcao valida.
  await subirAteNivel(p, 'Guerreiro', 8);

  const entradaGuerreiro = p.classes.find((c) => c.classe === 'Guerreiro');
  const entradaMago = p.classes.find((c) => c.classe === 'Mago');
  assert.equal(entradaGuerreiro.nivel, 3, 'o nível entrou no GUERREIRO, que era quem subia');
  assert.equal(entradaMago.nivel, 5, 'e o Mago ficou parado onde estava');
  assert.equal(p.nivel, 8, 'o espelho de nível total acompanha a soma');
  assert.equal(p.classe, 'Mago', 'o espelho de classe continua na classe INICIAL');
});

test('subida de nível: a subclasse escolhida entra na classe que sobe, não no espelho', async () => {
  const { levelup } = mods;
  // Mago 5 (já com subclasse) + Guerreiro 2: o Guerreiro chega ao 3º nível
  // DELE e escolhe a subclasse de Guerreiro. O espelho aponta para o Mago.
  const p = await personagemMulticlasse([
    { classe: 'Mago', subclasse: 'Abjurador', nivel: 5 },
    { classe: 'Guerreiro', nivel: 2 },
  ]);

  const r = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Guerreiro', subclasse: 'Campeão' });
  assert.ok(r.sucesso, `a subida deveria suceder: ${JSON.stringify(r)}`);

  assert.equal(p.classes.find((c) => c.classe === 'Guerreiro').subclasse, 'Campeão',
    'a subclasse de Guerreiro entrou na entrada do Guerreiro');
  assert.equal(p.classes.find((c) => c.classe === 'Mago').subclasse, 'Abjurador',
    'e a do Mago ficou intacta -- sobrescrevê-la é o defeito que este oráculo prende');
  assert.equal(p.subclasse, 'Abjurador',
    'o espelho continua na subclasse da classe INICIAL (o Mago)');
});

test('subida de nível: ficha SEM classe nenhuma falha fechada, não lança', async () => {
  const { levelup, store } = mods;
  // `criarPersonagemVazio()` grava `classe: ''`, e o migrador RECUSA migrar
  // uma ficha sem espelho de classe (devolve false sem criar `classes[]`).
  // Passar `opcoes.classe` faz a checagem de catálogo passar -- a classe
  // pedida existe -- e antes desta guarda a subida seguia adiante e morria
  // num TypeError de `classes.find`. `harness.subirAteNivel` SEMPRE passa
  // `opcoes.classe`, e a Tarefa 6 torna esse caminho vivo pela UI.
  const p = store.criarPersonagemVazio();
  assert.equal(p.classe, '', 'pré-condição: a ficha nasce sem classe');
  assert.equal(p.classes, undefined, 'e sem classes[]');

  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Mago' });
  assert.equal(r.sucesso, false, 'tem de recusar, não lançar');
  assert.match(r.erro, /sem classe/i, 'e o erro tem de nomear o motivo');
  assert.equal(p.classes, undefined, 'e não pode ter inventado classes[] no caminho');
});

test('subida de nível: ficha legada sem classes[] é migrada, não quebra', async () => {
  const { levelup, store } = mods;
  // `store.criarPersonagemVazio()` NÃO cria `classes[]` -- só os espelhos.
  // Antes da guarda que delega ao migrador, isto morria em
  // "Cannot read properties of undefined (reading 'find')".
  const p = store.criarPersonagemVazio();
  // Barbaro 4 -> 5 nao tem nenhuma escolha pendente, entao mede o caminho
  // de migracao sem o ruido de responder pendencia.
  p.classe = 'Bárbaro';
  p.nivel = 4;
  p.atributos = { ...p.atributos, constituicao: 14 };
  assert.equal(p.classes, undefined, 'pré-condição: a ficha nasce sem classes[]');

  const r = await levelup.subirDeNivel(p, { ignorar_xp: true });
  assert.ok(r.sucesso, `a subida deveria suceder: ${JSON.stringify(r)}`);
  assert.deepEqual(
    p.classes.map((c) => ({ classe: c.classe, nivel: c.nivel })),
    [{ classe: 'Bárbaro', nivel: 5 }],
    'o migrador materializou classes[] a partir do espelho e a subida entrou nela');
  assert.equal(p.nivel, 5, 'e o espelho acompanha');
});

// ============================================================
// Tarefa 4, fix round 1: registrarDadivaEpicaLegada trocou a checagem de
// classe elegível de "espelho `personagem.classe` (a classe INICIAL) com
// nível fixo 19" para "`classesDe(personagem)` com o MESMO literal 19".
// A primeira rodada da correção passou `c.nivel` em vez do literal, o que
// fazia `exigeDadivaEpica` passar a exigir nível EXATAMENTE 19 -- uma
// classe única no nível 20 que nunca registrou a escolha (o cenário para
// o qual esta função existe: `precisaRecuperarDadivaEpica`,
// sheet/talentos.js:19-23, gateia em `nivel >= 19`, não `=== 19`) virava
// regressão. Nenhum teste tocava esta função antes -- os dois oráculos
// abaixo fecham essa lacuna.
// ============================================================

test('registrarDadivaEpicaLegada: classe única no nível 20 sem a escolha é aceita', async () => {
  const { levelup, db } = mods;
  const dadosTalentos = await db.getTalentos();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 20 }]);
  assert.equal(p.escolhas_classe?.dadiva_epica_nivel_19, undefined,
    'pré-condição: a ficha nunca registrou a escolha de nível 19');

  // 'Aumento no Valor de Atributo': prerequisito 'Nível 4 ou superior',
  // sem exigência de classe -- serve para qualquer uma das 12
  // (talentos.json; Ruling 7 do ledger desta tarefa já usa o mesmo
  // talento pelo mesmo motivo: nenhuma "Dádiva" real existe no catálogo).
  const r = levelup.registrarDadivaEpicaLegada(
    p, { talento: 'Aumento no Valor de Atributo', aumentos_atributo: { forca: 2 } },
    dadosTalentos);

  assert.equal(r.sucesso, true,
    `classe única no nível 20 tem de poder recuperar a Dádiva Épica -- é o cenário ` +
    `legado para o qual esta função existe: ${JSON.stringify(r)}`);
  assert.equal(p.escolhas_classe.dadiva_epica_nivel_19, 'Aumento no Valor de Atributo');
});

// ============================================================
// Tarefa 8: o pré-requisito do livro:2033 (13+ no atributo primário da
// classe nova e de todas as atuais) bloqueia por padrão, mas o app oferece
// um escape explícito -- `opcoes.dispensar_prerequisito` -- porque muitas
// mesas dispensam essa regra. Sem o escape, `subirDeNivel` recusa como
// pendência (mesmo formato dos demais `tipo_pendencia`); com ele, a subida
// segue e a dispensa fica registrada em `char.edicoes`, marca permanente
// que não é reavaliada (ver sheet/estado.js:seloPrerequisitoDispensado).
// ============================================================

test('pré-requisito: bloqueia sem o 13+, e o escape libera deixando marca', async () => {
  const { levelup } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.atributos = { ...p.atributos, carisma: 11 };

  const barrado = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Paladino' });
  assert.equal(barrado.sucesso, false);
  assert.equal(barrado.tipo_pendencia, 'prerequisito_classe');
  assert.equal(p.nivel, 5, 'e o personagem NÃO subiu');

  const passou = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Paladino', dispensar_prerequisito: true });
  assert.equal(passou.sucesso, true);
  // Chave SEM o prefixo "classes." -- ela também é o caminho que
  // reverterEdicao usaria para escrever de volta no personagem, e
  // "classes.Paladino..." apontaria para dentro do ARRAY char.classes (a
  // fonte da verdade), corrompendo-o com uma propriedade não-índice.
  assert.ok(p.edicoes.campos['prerequisitoDispensado.Paladino'],
    'a dispensa fica registrada na ficha');
  assert.equal(p.edicoes.campos['prerequisitoDispensado.Paladino'].original, null,
    'a entrada segue o mesmo contrato de aplicarEdicao (campo `original`)');
});

// Defeito medido: a chave ANTIGA da marca ("classes.<Classe>.prerequisito")
// aponta, pontuada, para dentro do ARRAY `char.classes` -- a fonte da
// verdade. `reverterEdicao` (ficha-edicoes.js) escreve de volta no
// personagem com `escreverCaminho`, cujo `reduce` faz `atual[chave] ??= {}`
// em cada segmento do caminho: com a chave antiga isso criava uma
// propriedade NOMEADA ("Paladino") sobre o array. `Array.isArray` continua
// true, e a corrupção não sobrevive a um `JSON.stringify` (propriedade
// não-índice de array é ignorada) -- mas já é suficiente para estragar
// qualquer leitura de `char.classes` em memória antes do próximo reload.
// Este oráculo prova as DUAS pontas sobre a marca de VERDADE, criada pelo
// próprio motor de subida: 1) o revertedor genérico não corrompe
// `char.classes`; 2) ele de fato some com a marca (a promessa de "remover
// é o mesmo caminho que já limpa qualquer entrada de char.edicoes").
test('pré-requisito: reverterEdicao genérico remove a marca sem corromper char.classes', async () => {
  const { levelup, fichaEdicoes } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.atributos = { ...p.atributos, carisma: 11 };
  await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Paladino', dispensar_prerequisito: true });
  assert.ok(p.edicoes.campos['prerequisitoDispensado.Paladino'], 'pré-condição: a marca existe');

  const chavesNaoIndice = () => Object.keys(p.classes).filter((k) => !/^\d+$/.test(k));
  assert.deepEqual(chavesNaoIndice(), [], 'pré-condição: char.classes não tem propriedade estranha');

  const removeu = fichaEdicoes.reverterEdicao(p, 'prerequisitoDispensado.Paladino');

  assert.equal(removeu, true, 'reverterEdicao tem de reportar sucesso');
  assert.equal(p.edicoes.campos['prerequisitoDispensado.Paladino'], undefined,
    'a marca de fato some do char.edicoes -- a remoção prometida ao jogador');
  assert.equal(Array.isArray(p.classes), true, 'char.classes continua sendo um array');
  assert.deepEqual(chavesNaoIndice(), [],
    'char.classes NÃO pode ganhar propriedade não-índice ao reverter a marca');
  assert.deepEqual(p.classes.map((c) => `${c.classe} ${c.nivel}`), ['Mago 5', 'Paladino 1'],
    'as classes de verdade continuam intactas');
});

test('pré-requisito: a classe que o personagem já tem nunca bloqueia, mesmo sem o 13+', async () => {
  // Mago exige Inteligência 13 (livro:2033) -- derruba-la abaixo disso
  // depois que o personagem já É Mago não pode travar o PRÓPRIO Mago:
  // o pré-requisito é para se QUALIFICAR a uma classe nova. `subirAteNivel`
  // resolve as pendências normais do Mago (grimório) -- se o pré-requisito
  // travasse a própria classe, ela lançaria por 'prerequisito_classe' sem
  // ramo em responderPendencia, o que este teste também prende.
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  p.atributos = { ...p.atributos, inteligencia: 8 };

  await subirAteNivel(p, 'Mago', 6);
  assert.equal(p.nivel, 6, 'a própria classe nunca deveria travar');
  assert.equal(p.edicoes?.campos?.['prerequisitoDispensado.Mago'], undefined,
    'sem bloqueio, não há dispensa nenhuma para marcar');
});

test('registrarDadivaEpicaLegada: abaixo do nível 19 continua recusado', async () => {
  const { levelup, db } = mods;
  const dadosTalentos = await db.getTalentos();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 10 }]);

  const r = levelup.registrarDadivaEpicaLegada(
    p, { talento: 'Aumento no Valor de Atributo', aumentos_atributo: { forca: 2 } },
    dadosTalentos);

  assert.deepEqual(r,
    { sucesso: false, erro: 'O personagem não possui a escolha de Dádiva Épica de nível 19.' },
    'nível total 10 tem de continuar recusado -- é o caminho que a checagem de nível já cobria antes da conversão');
});

// ============================================================
// Tarefa 10: campanha de mutação. Os oráculos acima (e o header deste
// arquivo) SUGERIAM que a separação nível-na-classe/nível-total já estava
// presa em `subirDeNivel` e `buildLevelUpContext` -- a campanha mediu que
// NÃO estava: de 64 mutações (um site por vez, trocando o nível lido em
// CADA local de `levelup.js`/`levelup-flow.js` pelo outro sentido), só 2
// (as que já tinham oráculo acima) caíam. As 62 abaixo fecham cada escape
// com um valor LITERAL (nunca recalculado a partir da fórmula do app) --
// ver task-10-report.md para a tabela site a site.
//
// Técnica repetida: um personagem-âncora numa classe FIXA (que nunca sobe
// de novo) mais uma classe-alvo que sobe um nível por vez. Isso separa
// nível-na-classe de nível-total por uma diferença conhecida (a âncora),
// então uma leitura errada (total no lugar de na-classe, ou vice-versa)
// aponta para a linha ERRADA da tabela da classe/subclasse -- e o
// resultado (pendência, conteúdo concedido, boletim) diverge do literal
// que a rodada SEM mutação produziu (medido por sonda, registrado abaixo).
// ============================================================

test('subida: Acadêmico do Mago (nível 2 NA CLASSE) -- respondido o grimório, ainda pede a perícia', async () => {
  const { levelup } = mods;
  // FL11 (exigeAcademico): no Mago, o grimório (exigeGrimorioMago, nível >
  // 1) é checado ANTES do Acadêmico na ordem do código -- por isso este
  // oráculo precisa responder o grimório primeiro para enxergar o gate de
  // Acadêmico isolado. Com Guerreiro 5 ancorando, total é 7; nível 7 do
  // Mago não é gate de Acadêmico nenhum (só o 2 DELE é).
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Mago',
    grimorio_selecionados: ['Alarme', 'Armadura Arcana'],
  });
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'academico',
    'nível 2 NA CLASSE do Mago exige Acadêmico -- total (7) não é gate de Acadêmico');
});

test('subida: Dádiva Épica (nível 19 NA CLASSE) -- Mago 18->19 com Guerreiro 1 ancorando', async () => {
  const { levelup } = mods;
  // Guerreiro 1 (âncora, nunca sobe) + Mago 18->19: na-classe vira 19,
  // total vira 20. Se o site lesse nivelTotalNovo (20) em vez de
  // nivelNaClasseNovo (19), exigeDadivaEpica(Mago,20) é FALSO (só ===19) e
  // a pendência seguinte na ordem do código (aumento_atributo) apareceria
  // no lugar -- é o que este oráculo prende.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Mago', nivel: 18 },
  ]);
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Mago' });
  assert.equal(r.sucesso, false);
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'dadiva_epica',
    'nível 19 NA CLASSE do Mago tem de pedir Dádiva Épica -- se isto vier "aumento_atributo", o site leu o total (20)');
});

test('subida: Estilo de Luta do Guardião (nível 2 NA CLASSE) -- Guardião 1->2 com Guerreiro 5 ancorando', async () => {
  const { levelup } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Guardião', nivel: 1 },
  ]);
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Guardião' });
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'estilo_luta',
    'nível 2 NA CLASSE do Guardião exige Estilo de Luta -- total (7) não bate com esse gate');
});

test('subida: Explorador Hábil do Guardião (nível 2 NA CLASSE) -- depois do Estilo de Luta, mesmo nível', async () => {
  const { levelup } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Guardião', nivel: 1 },
  ]);
  const r = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Guardião', estilo_luta: 'Defensivo' });
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'explorador_habil',
    'respondido o Estilo de Luta, o MESMO nível 2 do Guardião ainda pede Explorador Hábil');
});

test('subida: Especialista do Guardião (nível 9 NA CLASSE) -- Guardião 8->9 com Guerreiro 1 ancorando', async () => {
  const { levelup } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Guardião', nivel: 8 },
  ]);
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Guardião' });
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'guardiao_expertise',
    'nível 9 NA CLASSE do Guardião -- total (9) aqui coincide, mas o gate teria de vir do na-classe');
});

test('subida: Especialização do Bardo (nível 2 NA CLASSE) -- Bardo 1->2 com Guerreiro 5 ancorando', async () => {
  const { levelup } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Bardo', nivel: 1 },
  ]);
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Bardo' });
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'bardo_expertise',
    'nível 2 NA CLASSE do Bardo -- total é 7, que não é gate de nada do Bardo');
});

test('subida: Especialização do Ladino (nível 6 NA CLASSE) -- aplicada direto, não é pendência', async () => {
  const { levelup } = mods;
  // exigeEspecializacaoLadino nunca bloqueia (comentário do próprio
  // levelup.js): a escolha é sempre aplicada, preenchendo automaticamente
  // com perícias proficientes livres. Por isso o oráculo mede o CAMPO
  // `expertise_ladino_aplicada` do resultado, não uma pendência.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Ladino', nivel: 5 },
  ]);
  p.pericias_proficientes = ['Furtividade', 'Acrobacia', 'Enganação', 'Intuição'];
  p.pericias_expertise = ['Furtividade', 'Acrobacia'];
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Ladino' });
  assert.equal(r.sucesso, true);
  assert.deepEqual(r.expertise_ladino_aplicada, ['Enganação', 'Intuição'],
    'nível 6 NA CLASSE do Ladino concede Especialização -- total (7) não é gate de nada do Ladino');
});

test('subida: Manobras do Mestre da Batalha (nível 3 NA CLASSE, 3 novas) -- Guerreiro 2->3 com Mago 1 ancorando', async () => {
  const { levelup } = mods;
  // Cobre FL13 (exigeManobrasGuerreiro) e FL16 (getQuantidadeNovasManobras):
  // total aqui é 4, que não é gate de manobra nenhuma (só 3,7,10,15 são).
  const p = await personagemMulticlasse([
    { classe: 'Mago', nivel: 1 }, { classe: 'Guerreiro', nivel: 2 },
  ]);
  const r = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Guerreiro', subclasse: 'Mestre da Batalha' });
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'manobras_guerreiro');
  assert.match(r.mensagem, /3 manobra/,
    'quantidade de manobras novas no nível 3 NA CLASSE é 3 -- total(4) não pede manobra nenhuma');
});

test('subida: troca de Estilo de Luta do Guerreiro só é opcional A PARTIR do nível 2 NA CLASSE', async () => {
  const { levelup } = mods;
  // No 1º nível NA CLASSE de Guerreiro (entrando fresco numa 2ª classe), a
  // troca de Estilo de Luta ainda não é oferecida -- então uma troca
  // INCOMPLETA (só "de", sem "para") não pode travar a subida. Se o site
  // lesse o nível TOTAL (6, aqui) em vez do na-classe (1), o gate
  // (`nivel>=2`) ficaria verdadeiro e a troca incompleta bloquearia.
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Guerreiro', estilo_luta_trocar_de: 'Duelismo' });
  assert.equal(r.sucesso, true,
    `1º nível de Guerreiro não pode pedir a troca de Estilo de Luta: ${JSON.stringify(r)}`);
});

test('subida: características do nível NA CLASSE (Ladino 5->6 = "Especialista", não as do total)', async () => {
  const { levelup } = mods;
  // Ladino 6 = "Especialista" (tabela do livro); Ladino 7 (o total, aqui)
  // = "Evasão, Talento Confiável" -- textos completamente diferentes, o
  // que faz qualquer leitura errada de nível ser detectável por conteúdo.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Ladino', nivel: 5 },
  ]);
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Ladino' });
  assert.equal(r.sucesso, true);
  assert.deepEqual(r.caracteristicas, ['Especialista']);
});

test('subida: subclasse com escolha bloqueante (Bardo Colégio do Conhecimento, nível 3 NA CLASSE)', async () => {
  const { levelup } = mods;
  // `linhasDaSubclasseNoNivel(...).filter(l=>l.tipo)` (FL21): só a linha do
  // nível 3 do Colégio do Conhecimento tem `tipo` (subclasse_pericias_bonus).
  // No total (4, aqui) não há linha nenhuma -- se o site lesse o total, a
  // pendência sumiria e a subida passaria sem pedir as 3 perícias.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Bardo', nivel: 2 },
  ]);
  const r = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Bardo', subclasse: 'Colégio do Conhecimento' });
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'subclasse_pericias_bonus');
});

test('subida: truque fixo de subclasse (Trapaceiro Arcano, nível 3 NA CLASSE = Mãos Mágicas)', async () => {
  const { levelup } = mods;
  // FL22 (getTruquesFixosSubclasse) e FL23 (obterCaracteristicasSubclasseNivel):
  // o Trapaceiro Arcano só ganha Mãos Mágicas e começa a conjurar no nível
  // 3 DELE. O total aqui é 4 -- uma leitura errada não concederia o truque.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Ladino', nivel: 2 },
  ]);
  const r = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Ladino', subclasse: 'Trapaceiro Arcano' });
  assert.equal(r.sucesso, true);
  assert.deepEqual(p.magias_conhecidas,
    [{ nome: 'Mãos Mágicas', circulo: 0, origem: 'subclasse_fixa' }]);
  // r.caracteristicas (FL01, obterCaracteristicasNivel): texto da tabela
  // BASE do Ladino no nível 3 -- "Subclasse Ladino" é o próprio nome que o
  // livro dá à linha de entrada na subclasse.
  assert.deepEqual(r.caracteristicas, ['Mira Firme', 'Subclasse Ladino']);
  // r.caracteristicas_subclasse (FL23, obterCaracteristicasSubclasseNivel):
  // texto da tabela da SUBCLASSE Trapaceiro Arcano no nível 3 dela.
  assert.deepEqual(r.caracteristicas_subclasse.map((c) => c.nome),
    ['Conjuração', 'Mãos Mágicas Ligeiras']);
});

test('subida: concessão automática de subclasse (Assassino, nível 3 NA CLASSE = Ferramentas de Assassino)', async () => {
  const { levelup } = mods;
  // FL24 (linhasDaSubclasseNoNivel + aplicarConcessaoAutomatica): a linha
  // "Ferramentas de Assassino" só existe no nível 3 DA classe. No total
  // (4, aqui) `linhasDaSubclasseNoNivel('Assassino', 4)` devolve [] -- uma
  // leitura errada não concederia o Kit de Disfarce/Veneno.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Ladino', nivel: 2 },
  ]);
  const r = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Ladino', subclasse: 'Assassino' });
  assert.equal(r.sucesso, true);
  assert.deepEqual(p.proficiencias_ferramentas, ['Kit de Disfarce', 'Kit de Veneno']);
});

test('subida: magias de domínio (Clérigo Domínio da Guerra, nível 3 NA CLASSE)', async () => {
  const { levelup } = mods;
  // FL25 (obterMagiasDominioNivel): as 4 magias de domínio do Domínio da
  // Guerra só entram no nível 3 DA classe -- no total (4, aqui) a tabela
  // da subclasse não tem essa linha.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Clérigo', nivel: 2 },
  ]);
  const r = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Clérigo', subclasse: 'Domínio da Guerra' });
  assert.equal(r.sucesso, true);
  assert.deepEqual(
    r.magias_dominio_adicionadas.map((m) => m.nome).sort(),
    ['Arma Espiritual', 'Arma Mágica', 'Escudo da Fé', 'Raio Guia'].sort());
});

test('subida: magias sempre preparadas de subclasse (Bardo Colégio do Glamour, nível 3 NA CLASSE)', async () => {
  const { levelup } = mods;
  // FL26 (obterMagiasSemprePreparadasNivel): Enfeitiçar Pessoa/Reflexos só
  // entram no nível 3 DA classe (nível 4, o total aqui, não tem essa linha
  // e não colide com magias de domínio -- Bardo não tem domínio).
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Bardo', nivel: 2 },
  ]);
  const r = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Bardo', subclasse: 'Colégio do Glamour' });
  assert.equal(r.sucesso, true);
  assert.deepEqual(
    r.magias_sempre_adicionadas.map((m) => m.nome).sort(),
    ['Enfeitiçar Pessoa', 'Reflexos'].sort());
});

test('subida: capstone de atributo (nível 20 NA CLASSE) não dispara no nível 19', async () => {
  const { levelup } = mods;
  // FL27: CAPSTONES_ATRIBUTO só se aplica em nivelNaClasseNovo===20. Um
  // Bárbaro que chega a 19 NA CLASSE com Guerreiro 1 ancorando tem TOTAL
  // 20 -- se o site lesse o total, o capstone (+4 Força/Constituição)
  // dispararia um nível cedo demais.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Bárbaro', nivel: 18 },
  ]);
  const antes = { ...p.atributos };
  // Nível 19 do Bárbaro concede ASI E Dádiva Épica ao mesmo tempo (os dois
  // gates batem em 19) -- sem `aumentos_atributo`, a subida pararia na
  // pendência 'talento_asi' ANTES de chegar ao bloco do capstone (bem mais
  // abaixo no código), e o teste não mediria nada.
  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Bárbaro',
    talento: 'Aumento no Valor de Atributo', aumentos_atributo: { sabedoria: 2 },
  });
  assert.equal(r.sucesso, true, `pré-condição -- a subida tem de suceder: ${JSON.stringify(r)}`);
  assert.equal(p.atributos.forca, antes.forca,
    'nível 19 NA CLASSE do Bárbaro não é o capstone -- Força não pode ter mudado pelo capstone');
  assert.equal(p.atributos.constituicao, antes.constituicao,
    'idem para Constituição -- o capstone soma nos dois juntos');
});

test('subida: bônus de espaços de magia por escola (Mago Evocador, círculo NA CLASSE, não no total)', async () => {
  const { levelup } = mods;
  // FL14/FL17/FL18/FL19/FL20: com Guerreiro 2 ancorando, Mago sobe de 2
  // para 3 NA CLASSE (total 4->5). No nível 3 DA classe o Mago só tem
  // círculos 1-2; o círculo 3 só abre no total (5) -- uma magia de
  // círculo 3 no grimório comum tem de ser RECUSADA (o site tem de ler
  // na-classe=3, não total=5).
  const p1 = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 2 }, { classe: 'Mago', nivel: 2 },
  ]);
  const r1 = await levelup.subirDeNivel(p1, {
    ignorar_xp: true, classe: 'Mago', subclasse: 'Evocador',
    grimorio_selecionados: ['Alarme', 'Bola de Fogo'], // Bola de Fogo é círculo 3
    subclasse_magias_selecionadas: ['Chama Contínua', 'Despedaçar'],
  });
  assert.equal(r1.sucesso, false, 'círculo 3 não existe no nível 3 NA CLASSE do Mago -- só no total (5)');
  assert.equal(r1.pendente, true);
  assert.equal(r1.tipo_pendencia, 'grimorio');

  // Companion: a MESMA regra vale para o bônus de escola (subclasse
  // arcana) -- Bola de Fogo (círculo 3, Evocação) não pode entrar nas 2
  // magias grátis do bônus de entrada na subclasse (nível 3 NA CLASSE).
  const p2 = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 2 }, { classe: 'Mago', nivel: 2 },
  ]);
  const r2 = await levelup.subirDeNivel(p2, {
    ignorar_xp: true, classe: 'Mago', subclasse: 'Evocador',
    grimorio_selecionados: ['Alarme', 'Armadura Arcana'],
    subclasse_magias_selecionadas: ['Chama Contínua', 'Bola de Fogo'],
  });
  assert.equal(r2.sucesso, false, 'círculo 3 não pode entrar no bônus de escola do nível 3 NA CLASSE');
  assert.equal(r2.pendente, true);
  assert.equal(r2.tipo_pendencia, 'subclasse_magias_arcana');

  // Controle positivo: as MESMAS 4 magias (círculos 1-2) têm de FUNCIONAR --
  // prova que o teste acima falha pela regra de círculo, não por outro motivo.
  const p3 = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 2 }, { classe: 'Mago', nivel: 2 },
  ]);
  const r3 = await levelup.subirDeNivel(p3, {
    ignorar_xp: true, classe: 'Mago', subclasse: 'Evocador',
    grimorio_selecionados: ['Alarme', 'Armadura Arcana'],
    subclasse_magias_selecionadas: ['Chama Contínua', 'Despedaçar'],
  });
  assert.equal(r3.sucesso, true, `controle positivo tem de suceder: ${JSON.stringify(r3)}`);
  assert.deepEqual(p3.grimorio.map((m) => m.nome).sort(),
    ['Alarme', 'Armadura Arcana', 'Chama Contínua', 'Despedaçar'].sort());
});

test('subida: bônus RECORRENTE de escola (novo círculo no nível 5 NA CLASSE) exige a escolha', async () => {
  const { levelup } = mods;
  // FL14 (ganhouNovoCirculoDeEspacos): o 3º círculo do Mago abre no nível 5
  // DELE. Com Guerreiro 1 ancorando, total 5->6 NÃO abre círculo novo
  // (5 e 6 já têm círculo 3) -- só o na-classe (4->5) abre. Se o site
  // comparasse os totais, ganhouNovoCirculoNivel viraria falso e a
  // pendência do bônus recorrente (1 magia) nunca apareceria.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 },
    { classe: 'Mago', subclasse: 'Evocador', nivel: 4 },
  ]);
  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Mago',
    grimorio_selecionados: ['Alarme', 'Armadura Arcana'],
  });
  assert.equal(r.sucesso, false);
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'subclasse_magias_arcana',
    'nível 5 NA CLASSE do Mago abre círculo novo -- exige 1 magia extra de Evocação');
  assert.match(r.mensagem, /Selecione 1 magia/);
});

test('subida: teto de 20 é do TOTAL, não da classe que entra', async () => {
  const { levelup } = mods;
  // RV1 (contra-oráculo): Guerreiro 20 (âncora) + Mago entrando do zero.
  // O Mago está no seu 1º nível (na-classe1), mas o TOTAL já é 20 -- a
  // subida tem de ser recusada pelo teto. Se o gate lesse na-classe em vez
  // de total, 1 > 20 é falso e a recusa NUNCA aconteceria.
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 20 }]);
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Mago' });
  assert.deepEqual(r, { sucesso: false, erro: 'Nível máximo já alcançado (20)' });
});

// As duas provas RV2/RV4 abaixo entram em Mago pela 1ª vez (na-classe1) --
// desde a correção do resíduo 1 (multiclassar em Mago concede o Grimório),
// subirDeNivel exige `grimorio_selecionados` (6 magias, o 1º nível de Mago)
// para suceder, senão devolve a pendência 'grimorio' em vez do boletim que
// estes dois oráculos leem. As 6 magias são só o preenchimento dessa
// pendência -- nenhuma das duas mede grimório.
const GRIMORIO_NIVEL_1_MAGO = [
  'Alarme', 'Armadura Arcana', 'Compreender Idiomas',
  'Convocar Familiar', 'Detectar Magia', 'Disco Flutuante de Tenser',
];

test('subida: traço de ESPÉCIE (nível 5 do TOTAL) -- Golias Forma Grande, não o na-classe', async () => {
  const { levelup } = mods;
  // RV2 (contra-oráculo): Guerreiro 4 (âncora) + Mago entrando do zero
  // (na-classe1, total 4->5). "Forma Grande" do Golias só existe no nível
  // 5 DO PERSONAGEM (Espécies.md:106) -- vazio em qualquer outro nível,
  // inclusive o 1 (na-classe). Se o site lesse na-classe, a lista viria
  // vazia e o traço nunca apareceria no boletim de subida.
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 4 }]);
  p.especie = 'Golias';
  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Mago', grimorio_selecionados: GRIMORIO_NIVEL_1_MAGO,
  });
  assert.deepEqual(r.caracteristicas_especie.map((c) => c.nome), ['Forma Grande']);
});

test('subida: Bônus de Proficiência acompanha o TOTAL, mesmo quando a classe que sobe está no 1º nível dela', async () => {
  const { levelup } = mods;
  // RV4 (contra-oráculo): Guerreiro 4 (âncora) + Mago entrando do zero.
  // Total 4->5 cruza a faixa de +2 para +3 (Math.ceil(nivel/4)+1) -- mas o
  // Mago está no 1º nível DELE, que sozinho ainda seria +2. Se o site lesse
  // nivelNaClasseNovo em vez de nivelTotalNovo, bonus_proficiencia viria 2
  // e bonus_mudou viria falso.
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 4 }]);
  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Mago', grimorio_selecionados: GRIMORIO_NIVEL_1_MAGO,
  });
  assert.equal(r.bonus_proficiencia, 3);
  assert.equal(r.bonus_mudou, true);
});

test('subida: Bônus de Proficiência ANTERIOR também é do TOTAL -- não muda quando o total não cruza faixa', async () => {
  const { levelup } = mods;
  // RV3 (contra-oráculo): Guerreiro 1 (âncora) + Mago 4->5 NA CLASSE
  // (total 5->6). Os dois totais (5 e 6) caem na MESMA faixa (+3) -- não
  // deveria mudar. Mas nivelNaClasseAnterior do Mago é 4 (+2 na fórmula) --
  // se o "anterior" lesse o na-classe, bonus_mudou viraria verdadeiro por
  // engano (3 contra 2), embora o total não tenha cruzado faixa nenhuma.
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Mago', nivel: 4 },
  ]);
  // Mago 4->5 exige 2 magias novas de grimório (nível > 1) -- sem
  // respondê-la a subida fica pendente e nem chega a calcular o boletim.
  const r = await levelup.subirDeNivel(p,
    { ignorar_xp: true, classe: 'Mago', grimorio_selecionados: ['Alarme', 'Armadura Arcana'] });
  assert.equal(r.sucesso, true, `pré-condição -- a subida tem de suceder: ${JSON.stringify(r)}`);
  assert.equal(r.bonus_proficiencia, 3);
  assert.equal(r.bonus_mudou, false,
    'total 5->6 não cruza faixa de Bônus de Proficiência -- não pode ter "mudado"');
});

// ------------------------------------------------------------
// buildLevelUpContext / montarConjuracao (site/js/levelup-flow.js) -- a
// TELA do assistente promete exatamente o que subirDeNivel acima aplica.
// Mesma técnica de âncora; os literais foram medidos por sonda contra o
// app sem mutação nenhuma.
// ------------------------------------------------------------

test('ctx: requirements do Mago (grimório + acadêmico) usam o nível NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  // Cobre CF01/02/03/04/05/06/07/08/09/10/12 (todos os exige*/obterCaracteristicasNivel
  // de buildLevelUpContext): com Guerreiro 5 ancorando, o Mago entra do
  // zero (na-classe1->2, total 6->7). Só o 2º nível DE MAGO pede Acadêmico
  // e concede as características "Acadêmico" -- nada no nível 7 do total
  // bate com isso.
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.nivelNaClasseNovo, 2);
  assert.equal(ctx.nivelNovo, 7);
  assert.equal(ctx.precisaAcademico, true);
  assert.deepEqual(ctx.caracteristicas, ['Acadêmico']);
  assert.deepEqual(
    ctx.requirements.map((r) => r.tipo).sort(),
    ['academico', 'grimorio'].sort());
});

test('ctx: requirements do Guardião (estilo de luta + explorador hábil) no nível 2 NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Guardião', nivel: 1 },
  ]);
  const classeData = await db.getClasse('Guardião');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Guardião');
  assert.equal(ctx.precisaEstiloLuta, true);
  assert.equal(ctx.precisaExploradorHabil, true);
  assert.deepEqual(
    ctx.requirements.map((r) => r.tipo).sort(),
    ['estilo_luta', 'explorador_habil'].sort());
});

test('ctx: Especialista do Guardião no nível 9 NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Guardião', nivel: 8 },
  ]);
  const classeData = await db.getClasse('Guardião');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Guardião');
  assert.equal(ctx.precisaExpertiseGuardiao, true);
  assert.deepEqual(ctx.requirements.map((r) => r.tipo), ['guardiao_expertise']);
});

test('ctx: Especialização do Bardo no nível 2 NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Bardo', nivel: 1 },
  ]);
  const classeData = await db.getClasse('Bardo');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Bardo');
  assert.equal(ctx.precisaExpertiseBardo, true);
  assert.ok(ctx.requirements.some((r) => r.tipo === 'bardo_expertise'));
});

test('ctx: manobras do Mestre da Batalha usam getQuantidadeNovasManobras do nível NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  // CF11: com Mago 1 ancorando, Guerreiro entra em 2->3 NA CLASSE (total
  // 3->4). qtdNova tem de ser 3 (regra do nível 3 DELE); total (4) não é
  // gate de manobra nenhuma.
  const char = await personagemMulticlasse([
    { classe: 'Mago', nivel: 1 }, { classe: 'Guerreiro', nivel: 2 },
  ]);
  const classeData = await db.getClasse('Guerreiro');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Guerreiro');
  assert.equal(ctx.nivelNaClasseNovo, 3);
  assert.equal(ctx.nivelNovo, 4);
  assert.ok(ctx.manobrasGuerreiro, 'Guerreiro monta o bloco de manobras');
  assert.equal(ctx.manobrasGuerreiro.qtdNova, 3);
});

test('ctx: precisaSubclasse (CF01) usa o nível 3 NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Mago', nivel: 2 },
  ]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.nivelNaClasseNovo, 3);
  assert.equal(ctx.precisaSubclasse, true,
    'nível 3 NA CLASSE do Mago exige subclasse -- total (4) não é esse gate');
});

test('ctx: ganhaASI (CF02) e exigeDadivaEpica (CF03) usam o nível 19 NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Mago', nivel: 18 },
  ]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.nivelNaClasseNovo, 19);
  assert.equal(ctx.ganhaASI, true, 'nível 19 NA CLASSE do Mago concede ASI -- total (20) não bate com esse gate');
  assert.equal(ctx.exigeDadivaEpica, true, 'idem para a Dádiva Épica');
});

test('ctx: podeTrocarEstiloLutaGuerreiro (CF07) é falso no 1º nível NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  // Mesma lógica de FL08: no 1º nível de Guerreiro (entrando fresco numa
  // 2ª classe), a troca de Estilo de Luta ainda não é oferecida.
  const char = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const classeData = await db.getClasse('Guerreiro');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Guerreiro');
  assert.equal(ctx.nivelNaClasseNovo, 1);
  assert.equal(ctx.podeTrocarEstiloLutaGuerreiro, false,
    '1º nível de Guerreiro não pode oferecer a troca -- o total (6) não é esse gate');
});

test('ctx: precisaExpertiseLadino (CF08) usa o nível 6 NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Ladino', nivel: 5 },
  ]);
  const classeData = await db.getClasse('Ladino');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Ladino');
  assert.equal(ctx.nivelNaClasseNovo, 6);
  assert.equal(ctx.precisaExpertiseLadino, true,
    'nível 6 NA CLASSE do Ladino concede a Especialização adicional -- total (7) não é esse gate');
});

test('ctx: características/magias de subclasse (CF13/CF14/CF15) usam o nível NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  // CF13 (obterCaracteristicasSubclasseNivel): Ladino Assassino, nível 3
  // DELE = "Assassinar" + "Ferramentas de Assassino". Com Guerreiro 1
  // ancorando, total é 4 -- linha vazia nessa tabela.
  const charLadino = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Ladino', subclasse: 'Assassino', nivel: 2 },
  ]);
  const cdLadino = await db.getClasse('Ladino');
  const ctxLadino = await levelupFlow.buildLevelUpContext(charLadino, cdLadino, {}, 'Ladino');
  assert.equal(ctxLadino.nivelNaClasseNovo, 3);
  assert.deepEqual(ctxLadino.caracteristicasSubclasse.map((c) => c.nome),
    ['Assassinar', 'Ferramentas de Assassino']);

  // CF14 (obterMagiasDominioNivel) e CF15 (obterMagiasSemprePreparadasNivel):
  // Clérigo Domínio da Guerra, nível 5 DELE. Com Guerreiro 1 ancorando,
  // total é 6 -- linha diferente (ou vazia) na tabela do domínio.
  const charClerigo = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Clérigo', subclasse: 'Domínio da Guerra', nivel: 4 },
  ]);
  const cdClerigo = await db.getClasse('Clérigo');
  const ctxClerigo = await levelupFlow.buildLevelUpContext(charClerigo, cdClerigo, {}, 'Clérigo');
  assert.equal(ctxClerigo.nivelNaClasseNovo, 5);
  assert.deepEqual(ctxClerigo.magiasDominioNivel.map((m) => m.nome).sort(),
    ['Guardiões Espirituais', 'Manto do Cruzado'].sort());
  assert.deepEqual(ctxClerigo.magiasSempreNivel.map((m) => m.nome).sort(),
    ['Guardiões Espirituais', 'Manto do Cruzado'].sort());
});

test('ctx: traço de ESPÉCIE no contexto usa o TOTAL, não o na-classe', async () => {
  const { levelupFlow, db } = mods;
  // RV5 (contra-oráculo): mesmo cenário do oráculo de subirDeNivel acima.
  const char = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 4 }]);
  char.especie = 'Golias';
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.nivelNaClasseNovo, 1, 'pré-condição: o Mago está no 1º nível DELE');
  assert.equal(ctx.nivelNovo, 5, 'mas o total é 5 -- é ele que decide o traço de espécie');
  assert.deepEqual(ctx.caracteristicasEspecie.map((c) => c.nome), ['Forma Grande']);
});

// MF11, INVERTIDO pela correção do resíduo 1 (multiclassar em Mago não
// concedia o Grimório): Classes.md:4552-4556 ("Como um Personagem
// Multiclasse" do Mago) manda "Adquira as características de nível 1 de
// Mago" -- o Livro de Magias É característica de nível 1 (Conjuração).
// Negar a pendência no 1º nível NA CLASSE deixava char.grimorio vazio para
// sempre num Mago entrado por multiclasse -- o oráculo antigo (removido)
// media exatamente esse defeito como comportamento correto.
test('ctx: montarConjuracao -- ehMago é verdadeiro também no 1º nível NA CLASSE (multiclasse em Mago), com 6 magias', async () => {
  const { levelupFlow, db } = mods;
  // Com Guerreiro 5 ancorando, o Mago entra do zero (na-classe0->1, total
  // 6->7). "Ganha magias novas de grimório NESTE nível?" tem de ser
  // verdadeiro -- é o 1º nível DELE (livro:2055 concede as características
  // do nível, sem exceção para o Livro de Magias) --, com a quantidade do
  // 1º nível (SEIS, livro: "seis magias de mago 1º círculo"), não a dos
  // níveis seguintes (duas).
  const char = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.nivelNaClasseNovo, 1);
  assert.equal(ctx.conjuracao.ehMago, true,
    '1º nível de Mago (multiclasse) concede o grimório -- livro:4552-4556');
  assert.equal(ctx.conjuracao.grimorioQtd, 6,
    'o 1º nível de Mago começa com SEIS magias de 1º círculo, não duas');
  assert.ok(ctx.requirements.some((r) => r.tipo === 'grimorio'),
    'com ehMago, a pendência de grimório tem de aparecer nos requirements');
});

// CANÁRIO de classe única (contexto): um Mago 1 de classe única monta o
// contexto de subida a partir do 2º nível DELE -- o 1º vem da criação, que
// nunca passa por buildLevelUpContext/subirDeNivel. `grimorioQtd` continua
// 2 aqui (o crescimento normal), nunca 6 -- 6 só existe no 1º nível.
test('ctx: montarConjuracao -- Mago de classe única sobe para o 2º nível DELE pedindo 2 magias (não 6)', async () => {
  const { levelupFlow, db } = mods;
  const char = await personagemMulticlasse([{ classe: 'Mago', nivel: 1 }]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.nivelNaClasseNovo, 2, 'classe única: o contexto de subida começa no 2º nível dela');
  assert.equal(ctx.conjuracao.ehMago, true);
  assert.equal(ctx.conjuracao.grimorioQtd, 2,
    'nível 2 em diante concede o crescimento normal do grimório (duas magias), não as seis do 1º nível');
});

// ------------------------------------------------------------
// Oráculos ENGINE (subirDeNivel) do resíduo 1 -- prova comportamental, não
// só o contexto que a tela lê. Valores LITERAIS (nomes de magia e
// contagem 6), nunca recalculados pela fórmula da implementação.
// ------------------------------------------------------------

// Nomes fixos de magia de 1º círculo de Mago (dados/magias/_indice.json),
// os mesmos 6 usados na prova manual de reprodução do defeito (ver
// residuo-1-report.md).
const SEIS_MAGIAS_NIVEL_1_MAGO = [
  'Alarme', 'Armadura Arcana', 'Compreender Idiomas',
  'Convocar Familiar', 'Detectar Magia', 'Disco Flutuante de Tenser',
];

test('subida: multiclassar em Mago (1º nível DELE) exige e concede SEIS magias no Grimório', async () => {
  const { levelup } = mods;
  // Guerreiro 5 (âncora) entra em Mago pela 1ª vez -- nivelNaClasseNovo=1,
  // o cenário exato do residuo (o Grimório ficava vazio para sempre).
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);

  // Sem grimorio_selecionados a subida fica pendente pedindo EXATAMENTE 6
  // -- não só "pendente", a MENSAGEM cita o número, e é o que prova que a
  // quantidade certa (não só a presença da pendência) está sendo exigida.
  const r1 = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Mago' });
  assert.equal(r1.sucesso, false);
  assert.equal(r1.pendente, true);
  assert.equal(r1.tipo_pendencia, 'grimorio');
  assert.match(r1.mensagem, /Selecione 6 magias/);
  assert.deepEqual(p.grimorio || [], [], 'antes de responder, o grimório continua vazio');

  // Com as 6 magias, a subida sucede e o grimório recebe EXATAMENTE elas
  // -- literal, não um `.length === 6`.
  const r2 = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Mago', grimorio_selecionados: SEIS_MAGIAS_NIVEL_1_MAGO,
  });
  assert.equal(r2.sucesso, true, `subida tem de suceder com as 6 magias: ${JSON.stringify(r2)}`);
  assert.deepEqual(p.grimorio.map((m) => m.nome).sort(), [...SEIS_MAGIAS_NIVEL_1_MAGO].sort());
});

// Companion: só 2 magias (a quantidade dos níveis seguintes) NÃO satisfaz
// o 1º nível -- prova que o gate é a CONTAGEM certa, não "pelo menos uma
// magia qualquer" nem a antiga contagem fixa de 2.
test('subida: multiclassar em Mago com só 2 magias (a contagem antiga) continua pendente', async () => {
  const { levelup } = mods;
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Mago', grimorio_selecionados: ['Alarme', 'Armadura Arcana'],
  });
  assert.equal(r.sucesso, false);
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'grimorio',
    '2 magias não bastam para o 1º nível de Mago -- ele exige 6, não a contagem dos níveis seguintes');
});

// CANÁRIO decisivo de classe única: um Mago de classe única subindo do 1º
// para o 2º nível (a MESMA escada de sempre, sem multiclasse nenhum) exige
// e concede DUAS magias, exatamente como antes desta correção -- a
// abertura do portão em nivelNaClasseNovo===1 nunca alcança este
// personagem, porque o 1º nível dele é da criação, não de subirDeNivel.
test('CANÁRIO -- subida: Mago de classe única (1º -> 2º nível dele) continua exigindo e concedendo DUAS magias', async () => {
  const { levelup } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 1 }]);
  // Acadêmico do Mago (nível 2 NA CLASSE) exige proficiência PRÉVIA na
  // perícia escolhida (mesmo achado documentado em harness.mjs) -- sem
  // isso a 2ª chamada abaixo trocaria de pendência ('academico') em vez de
  // suceder, e este canário não é sobre Acadêmico.
  p.pericias_proficientes = ['Arcanismo'];

  const r1 = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Mago' });
  assert.equal(r1.sucesso, false);
  assert.equal(r1.pendente, true);
  assert.equal(r1.tipo_pendencia, 'grimorio');
  assert.match(r1.mensagem, /Selecione 2 magias/,
    'classe única não pode ter mudado para 6 -- continua pedindo 2, a contagem de sempre');

  const r2 = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Mago',
    grimorio_selecionados: ['Alarme', 'Armadura Arcana'],
    academico_expertise: ['Arcanismo'],
  });
  assert.equal(r2.sucesso, true, `subida tem de suceder com as 2 magias: ${JSON.stringify(r2)}`);
  assert.deepEqual(p.grimorio.map((m) => m.nome).sort(), ['Alarme', 'Armadura Arcana'].sort());
});

test('ctx: montarConjuracao lê o nível ANTERIOR também NA CLASSE (Trapaceiro Arcano ainda não conjurava)', async () => {
  const { levelupFlow, db, sheetEstado, sheetMagias } = mods;
  // MF01/MF03/MF05 (leituras do nível ANTERIOR dentro de montarConjuracao)
  // e MF09 (espacosAntes): o Trapaceiro Arcano só começa a conjurar no
  // nível 3 DELE -- no nível ANTERIOR na-classe (2), ele ainda não
  // conjura, então truquesAtual/magiasAtual têm de ser 0. Com Guerreiro 1
  // ancorando, o total ANTERIOR já é 3 -- se o site lesse o total, o
  // "antes" pareceria já conjurando (TA conjura a partir do total 3) e o
  // ganho (truquesGanhos/magiasGanhas) sairia menor do que deveria.
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Ladino', subclasse: 'Trapaceiro Arcano', nivel: 2 },
  ]);
  sheetEstado.definirChar(char);
  const helpers = {
    getSubclasseConjuradoraConjuracao: sheetMagias.getSubclasseConjuradoraConjuracao,
    ehSubclasseConjuradora: sheetMagias.ehSubclasseConjuradora,
    obterMagiasDisponiveisClasseAtual: sheetMagias.obterMagiasDisponiveisClasseAtual,
  };
  const classeData = await db.getClasse('Ladino');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, helpers, 'Ladino');
  assert.equal(ctx.conjuracao.truquesAtual, 0,
    'nível 2 NA CLASSE (anterior) do Trapaceiro Arcano ainda não conjura');
  assert.equal(ctx.conjuracao.magiasAtual, 0);
  assert.equal(ctx.conjuracao.truquesGanhos, 2);
  assert.equal(ctx.conjuracao.magiasGanhas, 3);
  assert.deepEqual(ctx.conjuracao.espacosNovo, { 1: { total: 2, usados: 0 } });
});

test('ctx: montarConjuracao -- truques ANTERIORES (não-subclasse) também NA CLASSE (Mago 3->4)', async () => {
  const { levelupFlow, db } = mods;
  // MF03 (truquesAtual "puro", fora do ramo de subclasse conjuradora):
  // Mago sabe 3 truques do nível 1 ao 3 DELE, e passa a 4 no nível 4 DELE.
  // Com Guerreiro 1 ancorando, o total ANTERIOR (4) coincide numericamente
  // com o NOVO na-classe (4) -- se o site lesse o total no "anterior",
  // truquesAtual viria 4 igual a truquesNovo, e o ganho sumiria (0 em vez
  // de 1).
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Mago', subclasse: 'Evocador', nivel: 3 },
  ]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.nivelNaClasseNovo, 4);
  assert.equal(ctx.conjuracao.truquesAtual, 3, 'nível 3 NA CLASSE (anterior) do Mago ainda tem 3 truques');
  assert.equal(ctx.conjuracao.truquesNovo, 4);
  assert.equal(ctx.conjuracao.truquesGanhos, 1);
});

test('ctx: montarConjuracao -- bônus de entrada na escola (nível 3 NA CLASSE) concede as 2 magias', async () => {
  const { levelupFlow, db } = mods;
  // MF10: com Guerreiro 1 ancorando, o Mago entra em 2->3 NA CLASSE (total
  // 3->4). O bônus de ENTRADA na escola arcana (2 magias) é do nível 3
  // DELE -- a escolha da subclasse ainda está sendo feita nesta mesma
  // sessão (`calcularConjuracao` com `state.subclasse`, como o wizard usa).
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Mago', nivel: 2 },
  ]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  const conjuracao = levelupFlow.calcularConjuracao(ctx, { subclasse: 'Evocador' });
  assert.equal(ctx.nivelNaClasseNovo, 3);
  assert.deepEqual(conjuracao.subclasseArcana, { escola: 'Evocação', quantidade: 2, circuloMax: 2 },
    'nível 3 NA CLASSE do Mago concede o bônus DUPLO de entrada -- total (4) não é esse gate');
});

test('ctx: montarConjuracao -- círculo novo RECORRENTE (nível 5 NA CLASSE) usa o nível ANTERIOR também na-classe', async () => {
  const { levelupFlow, db } = mods;
  // MF09 (espacosAntes): com Guerreiro 1 ancorando, o Mago sobe de 4 para
  // 5 NA CLASSE (total 5->6). O 3º círculo abre no nível 5 DELE -- mas o
  // total ANTERIOR (5) já teria círculo 3 na tabela do livro. Se o
  // "antes" lesse o total, o círculo pareceria já existir e o bônus
  // recorrente (1 magia) nunca apareceria.
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Mago', subclasse: 'Evocador', nivel: 4 },
  ]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.nivelNaClasseNovo, 5);
  assert.equal(ctx.conjuracao.ganhouNovoCirculo, true,
    'nível 5 NA CLASSE do Mago abre o 3º círculo -- o total (6) já teria círculo 3 no anterior');
  assert.deepEqual(ctx.conjuracao.subclasseArcana, { escola: 'Evocação', quantidade: 1, circuloMax: 3 });
});

test('ctx: Bônus de Proficiência (novo) segue o TOTAL -- RV7', async () => {
  const { levelupFlow, db } = mods;
  const char = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 4 }]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.bonusNovo, 3);
  assert.equal(ctx.bonusMudou, true);
});

test('ctx: Bônus de Proficiência (anterior) segue o TOTAL -- RV6', async () => {
  const { levelupFlow, db } = mods;
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Mago', nivel: 4 },
  ]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.bonusNovo, 3);
  assert.equal(ctx.bonusMudou, false,
    'total 5->6 não cruza faixa -- se o "anterior" lesse na-classe (4), viria "mudou" por engano');
});

test('ctx: montarConjuracao (bloco de conjuração do Mago) lê tudo pelo nível NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  // Cobre MF01-MF11: mesmo cenário do 1º oráculo de ctx acima. O bloco de
  // conjuração é recalculado sobre a MESMA `sub` -- se qualquer um dos 11
  // sites de montarConjuracao lesse sub.nivelTotal* em vez do
  // nivelNaClasse* local, os espaços/truques/magias viriam da linha 7 da
  // tabela do Mago, não da linha 2.
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  assert.equal(ctx.conjuracao.ehMago, true, 'MF11: nível 2 NA CLASSE do Mago (>1)');
  assert.equal(ctx.conjuracao.magiasGanhas, 1);
  assert.deepEqual(ctx.conjuracao.espacosNovo, { 1: { total: 3, usados: 0 } },
    'MF08: espaços de 1º círculo do nível 2 NA CLASSE do Mago -- o nível 7 (total) teria círculos 1-4');
});

test('ctx: montarConjuracao concede o truque fixo da subclasse conjuradora no nível 3 NA CLASSE', async () => {
  const { levelupFlow, db, sheetEstado, sheetMagias } = mods;
  // MF07 (getTruquesFixosSubclasse dentro de montarConjuracao): Trapaceiro
  // Arcano ganha Mãos Mágicas no nível 3 DELE. Com Guerreiro 1 ancorando,
  // total é 4 -- uma leitura errada não concederia o truque fixo aqui.
  //
  // `ctx.conjuracao` só existe quando `helpers.getSubclasseConjuradoraConjuracao`
  // está presente (é o que reconhece "esta subclasse conjura neste nível") --
  // por isso os helpers reais da ficha entram aqui, como o wizard faz de
  // verdade (mesmo idioma de subclasse-conjuradora.test.mjs).
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Ladino', nivel: 2 },
  ]);
  sheetEstado.definirChar(char);
  const helpers = {
    getSubclasseConjuradoraConjuracao: sheetMagias.getSubclasseConjuradoraConjuracao,
    ehSubclasseConjuradora: sheetMagias.ehSubclasseConjuradora,
    obterMagiasDisponiveisClasseAtual: sheetMagias.obterMagiasDisponiveisClasseAtual,
  };
  const classeData = await db.getClasse('Ladino');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, helpers, 'Ladino');
  // `ctx.conjuracao` fica congelado sobre `sub.subclasse` (ainda vazio --
  // a subclasse está sendo escolhida NESTA sessão, no nível 3). Quem
  // enxerga a conjuração do Trapaceiro Arcano já neste nível é
  // `calcularConjuracao`, com a escolha do wizard em `state.subclasse`
  // (mesmo caminho reativo que a tela usa -- task-5-report §1, linha 35).
  const conjuracao = levelupFlow.calcularConjuracao(ctx, { subclasse: 'Trapaceiro Arcano' });
  assert.ok(conjuracao, 'pré-condição: o Trapaceiro Arcano conjura no nível 3 dele');
  assert.deepEqual(conjuracao.truquesFixosNovos, ['Mãos Mágicas']);
});

test('RF: escolhasSubclasseDoNivel usa ctx.nivelNaClasseNovo (Bardo Colégio do Conhecimento, nível 3)', async () => {
  const { levelupFlow, db } = mods;
  // RF04: mesmo cenário do oráculo de subclasse com escolha bloqueante,
  // agora medido pela função reativa que a TELA usa para montar o step.
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 1 }, { classe: 'Bardo', nivel: 2 },
  ]);
  const classeData = await db.getClasse('Bardo');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Bardo');
  const state = { subclasse: 'Colégio do Conhecimento' };
  const linhas = levelupFlow.escolhasSubclasseDoNivel(ctx, state);
  assert.deepEqual(linhas.map((l) => l.tipo), ['subclasse_pericias_bonus']);
});

test('RF: step de manobras do Mestre da Batalha fica visível pelo nível NA CLASSE', async () => {
  const { levelupFlow, db } = mods;
  // RF03 (STEP_DEFINITIONS.manobras_guerreiro.visivel): mesmo personagem
  // do oráculo de ctx.manobrasGuerreiro acima -- agora medindo se o STEP
  // aparece na lista visível do assistente.
  const char = await personagemMulticlasse([
    { classe: 'Mago', nivel: 1 }, { classe: 'Guerreiro', nivel: 2 },
  ]);
  const classeData = await db.getClasse('Guerreiro');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Guerreiro');
  const state = { subclasse: 'Mestre da Batalha', classeQueSobe: 'Guerreiro' };
  const steps = levelupFlow.buildVisibleSteps(ctx, state);
  assert.ok(steps.some((s) => s.id === 'manobras_guerreiro'),
    'nível 3 NA CLASSE do Guerreiro (Mestre da Batalha) tem de mostrar o step de manobras');
});

test('RF: calcularSubclasseArcana usa ctx.nivelNaClasseNovo (entrada na escola do Mago, nível 3)', async () => {
  const { levelupFlow, db } = mods;
  // RF02: com Guerreiro 2 ancorando, o Mago entra em 2->3 NA CLASSE (total
  // 4->5) -- o bônus de entrada na escola (2 magias) é do nível 3 DELE.
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 2 }, { classe: 'Mago', nivel: 2 },
  ]);
  const classeData = await db.getClasse('Mago');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Mago');
  const state = { subclasse: 'Evocador' };
  const bonus = levelupFlow.calcularSubclasseArcana(ctx, state);
  assert.deepEqual(bonus, { escola: 'Evocação', quantidade: 2, circuloMax: 2 });
});

test('RF: carregarMagiasDisponiveis pede a lista pelo nível NA CLASSE, não pelo total', async () => {
  const { levelupFlow, db } = mods;
  // RF01: `nivel` é o único jeito de observar o site sem mexer no app --
  // um stub de helpers.obterMagiasDisponiveisClasseAtual grava o que
  // recebeu.
  const char = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Mago', nivel: 1 },
  ]);
  const classeData = await db.getClasse('Mago');
  let nivelRecebido = null;
  const helpers = {
    obterMagiasDisponiveisClasseAtual: async ({ nivel }) => { nivelRecebido = nivel; return []; },
  };
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, helpers, 'Mago');
  await levelupFlow.carregarMagiasDisponiveis(ctx, {});
  assert.equal(nivelRecebido, 2,
    'nível 2 NA CLASSE do Mago -- se o site passasse o total, viria 7');
});

// ============================================================
// FL19/FL20 -- os DOIS únicos sites da campanha para os quais NENHUM
// oráculo comportamental pode existir. Não é um buraco na rede: é uma
// PROVA matemática de que a troca é um no-op em todo estado alcançável.
//
// As duas linhas (site/js/levelup.js, bônus de "Versado em [Escola]" do
// Mago) só executam quando `qtdMagiasSubclasseArcana > 0`, o que só
// acontece em dois casos: (a) nivelNaClasseNovo === 3 (bônus de entrada,
// +2) -- e aí SEMPRE circuloMaxRecorrente === 2 (o 2º círculo do Mago abre
// EXATAMENTE no nível 3 dele, e circuloMaxInicial já é 2 por definição do
// livro); ou (b) um círculo novo abrindo num nível recorrente (5, 7, 9,
// ...) -- e aí nivelNaClasseNovo !== 3 em qualquer nível alcançável, então
// o ramo mutado (que testaria nivelTOTALNovo === 3) também dá falso,
// porque total > na-classe sempre (nenhum personagem multiclasse tem
// total < na-classe da classe que sobe). Nos dois casos os dois lados da
// troca (`nivelNaClasseNovo` vs `nivelTotalNovo`) produzem o MESMO número
// -- verificado por varredura exaustiva (nível na classe 3..19 × todo
// total alcançável a partir dele, medido com as próprias funções do app,
// não reimplementadas) sem UMA divergência.
//
// Escrever um oráculo comportamental "pegando" essa mutação exigiria um
// cenário que NÃO PODE OCORRER -- exatamente o erro que este sub-projeto
// já documentou como custo de uma rodada anterior (ver task-10-report.md).
// Em vez disso, um guarda ESTÁTICO (mesma família do `ESCRITAS_PERMITIDAS`
// de multiclasse-fundacao.test.mjs): pina o TEXTO das duas linhas. Não
// prova nada sobre comportamento -- só impede que o símbolo mude de nome
// em silêncio, o que é tudo que resta para proteger aqui.
// ============================================================

test('guarda estático: bônus de escola do Mago (FL19/FL20) continua lendo nivelNaClasseNovo', async () => {
  const aqui = fileURLToPath(import.meta.url);
  const levelupJs = readFileSync(resolve(aqui, '..', '..', '..', '..', 'site', 'js', 'levelup.js'), 'utf-8');

  const linhaCirculoMaxPermitido = levelupJs.split('\n')
    .find((l) => l.includes('const circuloMaxPermitido = Math.max('));
  assert.ok(linhaCirculoMaxPermitido, 'a linha do circuloMaxPermitido tem de existir -- se sumiu, revise este guarda');
  assert.match(linhaCirculoMaxPermitido, /circuloMaxRecorrente >= 1 && nivelNaClasseNovo === 3/,
    'FL19: o bônus de entrada na escola (Mago, nível 3) tem de continuar comparando nivelNaClasseNovo');

  const linhaLimiteCirculo = levelupJs.split('\n')
    .find((l) => l.includes('return magia.circulo <= (nivelNaClasseNovo === 3'));
  assert.ok(linhaLimiteCirculo,
    'FL20: a linha do teto de círculo (magia.circulo <= (nivelNaClasseNovo === 3 ? ...)) tem de continuar existindo com esse texto');
});

// ============================================================
// Bloqueio do Conjurador Ritualista em multiclasse: a TELA (levelup-ui.js,
// bindEscolhasTalento) conta as magias rituais pelo Bônus de Proficiência
// do nível NOVO (`ctx.nivelNovo`); o MOTOR (validarEscolhasTalento, chamado
// por subirDeNivel ANTES de sincronizarEspelhos) contava pelo nível
// ANTERIOR (`char.nivel`, ainda não atualizado nesse ponto). Os dois só
// concordam em classe única -- lá o nível de ASI (4/6/8/10/12/14/16/19)
// nunca cruza um patamar de Bônus de Proficiência (5/9/13/17) entre o
// nível anterior e o novo. Em multiclasse cruzam: ASI é por nível DE
// CLASSE, o Bônus de Proficiência é pelo nível TOTAL.
//
// O ORÁCULO PRENDE A CONCORDÂNCIA, NÃO O NÚMERO SOZINHO: o teste
// decisivo escolhe EXATAMENTE o que a tela pediria (4, literal da tabela
// do livro -- nunca `bonusProficiencia(...)` recalculado aqui dentro) e
// exige que a subida SUCEDA. Um jogador que escolhe o que a tela pediu
// não pode ser recusado pelo motor.
// ============================================================

// 11 magias rituais de 1º círculo (dados/magias/circulo_1.json, marcador
// "Ritual" em tempo_conjuracao) -- os 4 primeiros nomes em ordem
// alfabética, os mesmos que db.getMagiasRituais(1) devolveria para a tela.
const QUATRO_MAGIAS_RITUAIS = ['Alarme', 'Compreender Idiomas', 'Convocar Familiar', 'Detectar Magia'];

test('ORÁCULO DECISIVO -- Guerreiro 5/Mago 3 sobe Mago para o 4º nível DELE (total 8->9) e Conjurador Ritualista com 4 magias rituais SUCEDE', async () => {
  const { levelup } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Mago', nivel: 3 },
  ]);
  assert.equal(p.nivel, 8, 'pré-condição: total 8 antes da subida');

  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true,
    classe: 'Mago',
    talento: 'Conjurador Ritualista',
    talento_tipo_escolha: 'conjurador_ritualista',
    talento_asi: 'inteligencia',
    escolhas_talento_levelup: QUATRO_MAGIAS_RITUAIS,
    // Pendência independente do mesmo nível (grimório do Mago) -- resolvida
    // aqui só para não mascarar o resultado que este oráculo mede.
    grimorio_selecionados: ['Armadura Arcana', 'Disfarçar-se'],
  });

  assert.equal(r.sucesso, true,
    `a subida tem de suceder com as 4 magias que a TELA pede (Bônus de Proficiência do nível 9, ` +
    `livro "Evolução do Personagem":1932, é +4) -- resultado: ${JSON.stringify(r)}`);
  assert.equal(p.nivel, 9, 'total sobe de 8 para 9 -- é essa travessia que cruza o patamar de Bônus de Proficiência 3->4');
  assert.equal(r.bonus_proficiencia, 4, 'literal da tabela do livro para o nível 9, não recalculado');
  assert.deepEqual(
    (p.magias_preparadas || [])
      .filter((m) => m.origem === 'conjurador_ritualista')
      .map((m) => m.nome).sort(),
    [...QUATRO_MAGIAS_RITUAIS].sort(),
    'as 4 magias escolhidas entram como preparadas, com a origem do talento');
});

// Companion: a mesma travessia (total 8->9) com a contagem ANTIGA (3, o
// Bônus de Proficiência do nível 8 -- o número errado que o defeito
// produzia) tem de continuar recusada -- prova que o motor exige a
// contagem CERTA, não "qualquer quantidade".
test('companion -- a mesma subida com 3 magias (a contagem do nível ANTERIOR) continua pendente', async () => {
  const { levelup } = mods;
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 }, { classe: 'Mago', nivel: 3 },
  ]);

  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true,
    classe: 'Mago',
    talento: 'Conjurador Ritualista',
    talento_tipo_escolha: 'conjurador_ritualista',
    talento_asi: 'inteligencia',
    escolhas_talento_levelup: QUATRO_MAGIAS_RITUAIS.slice(0, 3),
    grimorio_selecionados: ['Armadura Arcana', 'Disfarçar-se'],
  });

  assert.equal(r.sucesso, false);
  assert.equal(r.pendente, true);
  assert.equal(r.tipo_pendencia, 'escolhas_talento');
  assert.match(r.mensagem, /Escolha exatamente 4 magias rituais/,
    '3 (a contagem do nível 8) não satisfaz mais -- só 4 (nível 9) satisfaz');
});

// CANÁRIO de classe única: um Mago de classe única (sem multiclasse
// nenhum) subindo do 3º para o 4º nível escolhe Conjurador Ritualista e
// tem de suceder com 2 magias rituais (Bônus de Proficiência do nível 4,
// livro "Evolução do Personagem":1932, é +2). Este caso NÃO distingue a
// versão corrigida da versão com o defeito -- nível anterior (3) e nível
// novo (4) estão no MESMO patamar de Bônus de Proficiência -- e existe
// para provar que a correção não regride o caminho comum.
test('CANÁRIO classe única -- Mago 3->4 com Conjurador Ritualista sucede com 2 magias rituais', async () => {
  const { levelup } = mods;
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }]);
  assert.equal(p.nivel, 3);

  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true,
    classe: 'Mago',
    talento: 'Conjurador Ritualista',
    talento_tipo_escolha: 'conjurador_ritualista',
    talento_asi: 'inteligencia',
    escolhas_talento_levelup: QUATRO_MAGIAS_RITUAIS.slice(0, 2),
    grimorio_selecionados: ['Armadura Arcana', 'Disfarçar-se'],
  });

  assert.equal(r.sucesso, true, `canário de classe única tem de continuar passando: ${JSON.stringify(r)}`);
  assert.equal(p.nivel, 4);
  assert.equal(r.bonus_proficiencia, 2, 'literal da tabela do livro para o nível 4');
});
