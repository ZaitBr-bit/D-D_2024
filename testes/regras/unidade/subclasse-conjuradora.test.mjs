// ============================================================
// Subclasses conjuradoras: Trapaceiro Arcano (Ladino) e Cavaleiro
// Místico (Guerreiro).
//
// As duas são 1/3 conjurador e ganham a Conjuração no MESMO nível em que
// a subclasse é escolhida (nível 3). Esse encontro é o que este motor
// confronta: no nível 3 o personagem ainda não tem `subclasse` gravada
// quando o fluxo de subida monta o contexto, e tudo que depender de
// `char.subclasse` congelado nesse instante nasce vazio -- truques,
// magias e espaços.
//
// Fonte das tabelas: PHB 2024, "Conjuração de Trapaceiro Arcano"
// (dados/classes/ladino.json, característica Conjuração do nível 3) e
// "Conjuração de Cavaleiro Místico" (guerreiro.json).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { escadaDeNivel, modulosApp, personagemSemente } from './harness.mjs';

// Espaços de magia por nível de Ladino, direto da tabela do livro.
// Só os níveis em que a linha MUDA -- os demais repetem o anterior.
const ESPACOS_TRAPACEIRO = {
  3: { 1: 2 },
  4: { 1: 3 },
  7: { 1: 4, 2: 2 },
  10: { 1: 4, 2: 3 },
  13: { 1: 4, 2: 3, 3: 2 },
  16: { 1: 4, 2: 3, 3: 3 },
  19: { 1: 4, 2: 3, 3: 3, 4: 1 },
};

/**
 * Monta os `helpers` que a ficha (sheet/edicao.js) injeta no fluxo de
 * subida de nível, apontados para o personagem do teste. São as funções
 * REAIS da ficha -- reescrevê-las aqui não confrontaria nada.
 */
async function helpersDaFicha(personagem) {
  const { sheetEstado, sheetMagias } = await modulosApp();
  sheetEstado.definirChar(personagem);
  return {
    getSubclasseConjuradoraConjuracao: sheetMagias.getSubclasseConjuradoraConjuracao,
    ehSubclasseConjuradora: sheetMagias.ehSubclasseConjuradora,
    obterMagiasDisponiveisClasseAtual: sheetMagias.obterMagiasDisponiveisClasseAtual,
  };
}

/** Personagem da classe pedida, pronto para subir do nível 2 para o 3. */
async function personagemNivel2(classe) {
  const p = await personagemSemente(classe);
  p.nivel = 2;
  return p;
}

/** Contexto + estado do fluxo de subida com a subclasse escolhida AGORA. */
async function contextoEscolhendoSubclasse(classe, subclasse) {
  const { levelupFlow, db } = await modulosApp();
  const personagem = await personagemNivel2(classe);
  const classeData = await db.getClasse(classe);
  const helpers = await helpersDaFicha(personagem);
  const ctx = await levelupFlow.buildLevelUpContext(personagem, classeData, helpers);
  const state = levelupFlow.createInitialState();
  state.subclasse = subclasse;
  return { ctx, state, personagem, levelupFlow };
}

test('Trapaceiro Arcano: o step de seleção de magias aparece no nível em que a subclasse é escolhida', async () => {
  const { ctx, state, levelupFlow } = await contextoEscolhendoSubclasse('Ladino', 'Trapaceiro Arcano');

  const ids = levelupFlow.buildVisibleSteps(ctx, state).map(s => s.id);
  assert.ok(ids.includes('selecao_magias'),
    'o Ladino que escolheu Trapaceiro Arcano subiu para o nível 3 sem nenhuma tela de magias: ' +
    `steps visíveis = ${ids.join(', ')}`);
});

test('Cavaleiro Místico: o step de seleção de magias aparece no nível em que a subclasse é escolhida', async () => {
  const { ctx, state, levelupFlow } = await contextoEscolhendoSubclasse('Guerreiro', 'Cavaleiro Místico');

  const ids = levelupFlow.buildVisibleSteps(ctx, state).map(s => s.id);
  assert.ok(ids.includes('selecao_magias'),
    'o Guerreiro que escolheu Cavaleiro Místico subiu para o nível 3 sem nenhuma tela de magias: ' +
    `steps visíveis = ${ids.join(', ')}`);
});

test('Trapaceiro Arcano: a conjuração do nível 3 pede 2 truques (Mãos Mágicas é automática) e 3 magias', async () => {
  const { ctx, state, levelupFlow } = await contextoEscolhendoSubclasse('Ladino', 'Trapaceiro Arcano');

  const conj = levelupFlow.calcularConjuracao(ctx, state);
  assert.ok(conj, 'nenhuma conjuração calculada para a subclasse escolhida neste nível');
  // O livro dá 3 truques no nível 3, mas um deles é Mãos Mágicas, fixa:
  // só 2 são escolha do jogador.
  assert.equal(conj.truquesGanhos, 2, 'quantidade errada de truques a escolher');
  assert.equal(conj.magiasGanhas, 3, 'quantidade errada de magias de 1º círculo a escolher');
  assert.equal(conj.tipoConj, 'conhecidas');
  assert.deepEqual(
    Object.fromEntries(Object.entries(conj.espacosNovo).map(([c, d]) => [c, d.total ?? d])),
    { 1: 2 }, 'espaços de magia do nível 3 fora da tabela do livro');
});

test('Cavaleiro Místico: a conjuração do nível 3 pede 2 truques e 3 magias', async () => {
  const { ctx, state, levelupFlow } = await contextoEscolhendoSubclasse('Guerreiro', 'Cavaleiro Místico');

  const conj = levelupFlow.calcularConjuracao(ctx, state);
  assert.ok(conj, 'nenhuma conjuração calculada para a subclasse escolhida neste nível');
  assert.equal(conj.truquesGanhos, 2, 'quantidade errada de truques a escolher');
  assert.equal(conj.magiasGanhas, 3, 'quantidade errada de magias de 1º círculo a escolher');
});

test('Trapaceiro Arcano: a lista de magias oferecida é a de Mago', async () => {
  const { levelupFlow, db } = await modulosApp();
  const personagem = await personagemNivel2('Ladino');
  const classeData = await db.getClasse('Ladino');
  // A ficha monta esta lista lendo `char`: no momento em que o contexto é
  // montado o Ladino ainda não é conjurador, e a lista sai vazia (não
  // existe magias_ladino.json). Quem precisa dela tem de perguntar DEPOIS
  // da escolha da subclasse -- é o que carregarMagiasDisponiveis faz.
  const helpers = await helpersDaFicha(personagem);
  const ctx = await levelupFlow.buildLevelUpContext(personagem, classeData, helpers);
  const state = levelupFlow.createInitialState();
  state.subclasse = 'Trapaceiro Arcano';

  const magias = await levelupFlow.carregarMagiasDisponiveis(ctx, state);
  assert.ok(magias.some(m => m.circulo === 0 && m.nome === 'Mãos Mágicas'),
    'sem a lista de Mago não há truque nenhum para escolher na tela de magias');
  assert.ok(magias.some(m => m.circulo === 1),
    'sem magias de 1º círculo o Trapaceiro Arcano não tem o que preparar');
});

test('Trapaceiro Arcano: os espaços de magia são gravados a cada nível da escada', async () => {
  let esperado = {};
  await escadaDeNivel('Ladino', (p, nivel) => {
    if (ESPACOS_TRAPACEIRO[nivel]) esperado = ESPACOS_TRAPACEIRO[nivel];
    if (nivel < 3) {
      assert.deepEqual(p.espacos_magia || {}, {},
        `Ladino nv${nivel} ganhou espaços de magia antes da subclasse`);
      return;
    }
    const obtido = Object.fromEntries(
      Object.entries(p.espacos_magia || {}).map(([c, d]) => [c, d.total]));
    assert.deepEqual(obtido, esperado,
      `espaços de magia errados no nível ${nivel} do Trapaceiro Arcano`);
  }, { subclasse: 'Trapaceiro Arcano' });
});

test('Trapaceiro Arcano: Mãos Mágicas é concedida junto com a Conjuração, no nível 3', async () => {
  await escadaDeNivel('Ladino', (p, nivel) => {
    if (nivel < 3) return;
    const truques = (p.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome);
    assert.ok(truques.includes('Mãos Mágicas'),
      `nível ${nivel}: o Trapaceiro Arcano não recebeu Mãos Mágicas (truques: ${truques.join(', ') || 'nenhum'})`);
  }, { subclasse: 'Trapaceiro Arcano' });
});

test('Cavaleiro Místico: dois personagens não compartilham o mesmo objeto de espaços de magia', async () => {
  const { levelup } = await modulosApp();

  async function guerreiroNivel3() {
    const p = await personagemSemente('Guerreiro');
    for (let nivel = 2; nivel <= 3; nivel++) {
      p.xp = levelup.XP_POR_NIVEL[nivel];
      const resultado = await levelup.subirDeNivel(p, { subclasse: 'Cavaleiro Místico' });
      assert.ok(resultado.sucesso, `Guerreiro nv${nivel}: ${JSON.stringify(resultado)}`);
    }
    return p;
  }

  const primeiro = await guerreiroNivel3();
  primeiro.espacos_magia[1].usados = 2;

  const segundo = await guerreiroNivel3();
  assert.equal(segundo.espacos_magia[1].usados, 0,
    'o segundo personagem nasceu com os espaços já gastos do primeiro -- a tabela ' +
    'de espaços está sendo entregue por referência, não copiada');
});

test('Trapaceiro Arcano: Mãos Mágicas entra como truque de classe e não pode ser trocada', async () => {
  const { sheetEstado, sheetGrimorio, levelup } = await modulosApp();
  const personagem = await personagemSemente('Ladino');
  for (let nivel = 2; nivel <= 3; nivel++) {
    personagem.xp = levelup.XP_POR_NIVEL[nivel];
    const resultado = await levelup.subirDeNivel(personagem, { subclasse: 'Trapaceiro Arcano' });
    assert.ok(resultado.sucesso, `Ladino nv${nivel}: ${JSON.stringify(resultado)}`);
  }
  sheetEstado.definirChar(personagem);

  const maosMagicas = personagem.magias_conhecidas.find(m => m.nome === 'Mãos Mágicas');
  assert.equal(maosMagicas.origem, 'subclasse_fixa',
    'sem essa origem a ficha não sabe distinguir o truque concedido dos escolhidos');
  // "Você pode substituir um dos seus truques, EXCETO Mãos Mágicas" (PHB 2024).
  assert.deepEqual(sheetGrimorio.truquesTrocaveis().map(m => m.nome), [],
    'Mãos Mágicas apareceu como truque trocável');
});

test('Ficha legada: Trapaceiro Arcano nível 3 sem magias recebe Mãos Mágicas e as vagas em aberto', async () => {
  const { sheetEstado, sheetMigracoes, db } = await modulosApp();
  // O personagem que o bug produziu: nível 3, subclasse gravada, nenhuma
  // magia e nenhum truque. Sem migração ele não teria como escolher --
  // a tela de magias da ficha é somente consulta para subclasse conjuradora.
  const personagem = await personagemSemente('Ladino');
  personagem.nivel = 3;
  personagem.subclasse = 'Trapaceiro Arcano';
  personagem.magias_conhecidas = [];
  personagem.magias_preparadas = [];
  sheetEstado.definirChar(personagem);
  sheetEstado.definirClasseData(await db.getClasse('Ladino'));

  sheetMigracoes.migrarTruquesFixosSubclasse();
  sheetMigracoes.migrarSlotsMagiaLivre();

  assert.ok(personagem.magias_conhecidas.some(m => m.nome === 'Mãos Mágicas'),
    'Mãos Mágicas não foi concedida retroativamente');
  // 3 truques no nível 3, um deles já concedido -> 2 vagas.
  assert.equal(personagem._slots_truque_livre, 2, 'vagas de truque em aberto erradas');
  assert.equal(personagem._slots_magia_livre, 3, 'vagas de magia conhecida em aberto erradas');
});

test('Limite de truques/magias da ficha: a tabela do Ladino não zera o limite da subclasse', async () => {
  const { utils, db } = await modulosApp();
  const classeData = await db.getClasse('Ladino');
  // A tabela do Ladino EXISTE mas não tem colunas de magia -- é o caso que
  // fazia o modal "Consultar Magias" exibir "Truques: 0/0" e travar toda a
  // grade de seleção, enquanto a seção Magias da ficha mostrava 0/3.
  const limites = utils.getLimitesMagias(classeData.tabela_caracteristicas, 3,
    { truques: 3, preparadas: 3, espacos: { 1: 2 } });
  assert.deepEqual(limites, { truques: 3, preparadas: 3 });
});
