// ============================================================
// Render por classe: os 12 modulos de classe e renderFeatureItem.
//
// Os oraculos 1-4 medem os modulos de classe; nascem VERMELHOS contra a
// arvore atual, porque hoje cada modulo so responde para a classe que o
// espelho `char.classe` aponta -- ou seja, so para a classe INICIAL.
//
// A superficie publica NAO e uniforme entre os 12 modulos (so os portoes
// sao): `getProgressaoX` so e exportado por 4 (barbaro, clerigo, guerreiro,
// monge); os outros expoem so `getEstadoRecursosX` (ou um nome proprio, como
// getEstadoFuria do Barbaro e getEstadoInspiracaoBardo do Bardo) -- essa e a
// FACHADA de verdade, a que os ~40 pontos de chamada usam, entao os oraculos
// medem por ela. Ver docs/PERGUNTAS-PENDENTES.txt, entrada "Tarefa 1 (render
// por classe): getEstadoRecursosX e a fachada publica (2026-08-23)".
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

// Monta o estado da ficha como renderSheet monta, para os modulos de
// classe (que leem os live bindings) enxergarem o personagem.
async function porNaFicha(p) {
  const { sheetEstado, db, contextoClasse } = await modulosApp();
  const mapa = new Map();
  for (const c of contextoClasse.montarContextos(p, new Map())) {
    mapa.set(c.classe, await db.getClasse(c.classe));
  }
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapa.get(p.classe) || null);
  sheetEstado.definirClassesData(mapa);
  return mapa;
}

test('os 12 modulos respondem para a classe NAO inicial', async () => {
  const { sheetClasses } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Vida' },
    { classe: 'Paladino', nivel: 5, subclasse: 'Juramento da Devoção' },
  ]);
  await porNaFicha(p);
  assert.notEqual(sheetClasses.paladino.getEstadoRecursosPaladino(), null,
    'o Paladino e a SEGUNDA classe; hoje o portao `char.classe !== "Paladino"` o barra');
  assert.notEqual(sheetClasses.clerigo.getEstadoRecursosClerigo(), null,
    'e o Clerigo, que e a primeira, continua respondendo');
});

test('cada modulo le a linha do nivel NAQUELA classe', async () => {
  const { sheetClasses } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Vida' },
    { classe: 'Paladino', nivel: 5, subclasse: 'Juramento da Devoção' },
  ]);
  await porNaFicha(p);
  // Clerigo 5 tem 2 usos de Canalizar Divindade; Clerigo 10 tem 3.
  // char.nivel e 10, entao ler o total daria 3 -- o valor errado.
  assert.equal(sheetClasses.clerigo.getEstadoRecursosClerigo().canalizarDivindadeMax, 2,
    'Clerigo 5 tem 2 usos; ler char.nivel (10) daria 3');
});

test('os recursos das DUAS classes sao inicializados', async () => {
  const { sheetClasses } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Vida' },
    { classe: 'Paladino', nivel: 5, subclasse: 'Juramento da Devoção' },
  ]);
  await porNaFicha(p);
  assert.notEqual(sheetClasses.clerigo.getEstadoRecursosClerigo(), null);
  assert.notEqual(sheetClasses.paladino.getEstadoRecursosPaladino(), null);
  assert.ok(p.recursos?.clerigo, 'getEstadoRecursos inicializa char.recursos.clerigo');
  assert.ok(p.recursos?.paladino, 'e tambem char.recursos.paladino');
});

test('personagem de classe unica: os modulos respondem como antes', async () => {
  const { sheetClasses } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Vida' },
  ]);
  await porNaFicha(p);
  assert.equal(sheetClasses.clerigo.getEstadoRecursosClerigo().canalizarDivindadeMax, 2);
  assert.equal(sheetClasses.paladino.getEstadoRecursosPaladino(), null,
    'o personagem NAO tem Paladino, entao o modulo do Paladino continua devolvendo null');
});

// ============================================================
// Rodada de correcao 1/5 -- oraculos 5 a 8.
//
// Cada um e um PAR em direcoes opostas, de proposito: uma asserção
// sozinha sobrevive a implementacao errada. "Aura ativa quando tem o
// juramento" passa com `return true`; "a CD vale 16" passa por acidente se
// a fixture nao fizer o nivel total divergir do nivel na classe. O par e o
// que fecha as duas saidas.
// ============================================================

/**
 * Elemento de DOM falso -- o minimo que abrirModal() e o modal do Bruxo
 * tocam. Existe porque a FACHADA PUBLICA que le as invocacoes do Bruxo e
 * `abrirModalRecursosBruxo()`, e ela passa pelo DOM; medir
 * `extrairOpcoesInvocacoesBruxo()` mediria uma funcao privada, nao o que a
 * ficha de verdade chama.
 */
function elementoFalso() {
  return {
    value: '', textContent: '', innerHTML: '', scrollTop: 0,
    style: {}, dataset: {},
    addEventListener() {}, appendChild() {}, remove() {},
    querySelectorAll: () => [], querySelector: () => null, closest: () => null,
  };
}

/**
 * Roda `fn` com um `document.getElementById` que devolve elementos falsos
 * (um por id, estaveis entre chamadas) e restaura o stub do harness
 * depois, mesmo se `fn` lançar. Devolve o mapa id -> elemento, para o
 * teste ler o innerHTML que o modal escreveu.
 */
async function comDomDeModal(fn) {
  const elementos = new Map();
  const original = document.getElementById;
  document.getElementById = (id) => {
    if (!elementos.has(id)) elementos.set(id, elementoFalso());
    return elementos.get(id);
  };
  try {
    await fn();
  } finally {
    document.getElementById = original;
  }
  return elementos;
}

test('as CDs de classe usam bonusProficiencia do nivel TOTAL, nao o da classe', async () => {
  const { sheetClasses, utils } = await modulosApp();
  // A fixture e sempre X 14 + Bárbaro 3 = 17 de nivel total. PB(17) = +6 e
  // PB(14) = +5 DIVERGEM -- e a divergencia e a unica coisa que faz a
  // medicao distinguir as duas leituras. Sem ela o oraculo passaria com a
  // implementacao errada, que foi exatamente o que o revisor provou ao
  // mutar as cinco chamadas de bonusProficiencia sem nenhuma falha.
  const pbTotal = utils.bonusProficiencia(17);
  const pbNaClasse = utils.bonusProficiencia(14);
  assert.notEqual(pbTotal, pbNaClasse,
    'a fixture so mede alguma coisa se os dois bonus divergirem de verdade');

  // --- Guerreiro: cdSuperioridade (salvaguarda de manobra) ---
  // Guerreiro fica como classe INICIAL de proposito: assim `char.subclasse`
  // ja aponta para Mestre da Batalha antes e depois da correcao de
  // subclasseDe, e este oraculo mede SO o bonus de proficiencia.
  const g = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 14, subclasse: 'Mestre da Batalha' },
    { classe: 'Bárbaro', nivel: 3, subclasse: 'Trilha do Berserker' },
  ]);
  await porNaFicha(g);
  const estG = sheetClasses.guerreiro.getEstadoRecursosGuerreiro();
  // 8 + maior mod entre Força e Destreza (+2 na fixture) + PB.
  assert.equal(estG.cdSuperioridade, 8 + 2 + pbTotal,
    'cdSuperioridade usa PB do nivel TOTAL 17 (+6)');
  assert.notEqual(estG.cdSuperioridade, 8 + 2 + pbNaClasse,
    'trocar por nivelNa(Guerreiro)=14 daria PB +5 -- CD mais fraca, em silencio');

  // --- Ladino: cdGolpeAstuto e cdPsionicaAdaga ---
  const l = await personagemMulticlasse([
    { classe: 'Ladino', nivel: 14, subclasse: 'Adaga Espiritual' },
    { classe: 'Bárbaro', nivel: 3, subclasse: 'Trilha do Berserker' },
  ]);
  await porNaFicha(l);
  const estL = sheetClasses.ladino.getEstadoRecursosLadino();
  assert.equal(estL.cdGolpeAstuto, 8 + 2 + pbTotal, 'cdGolpeAstuto usa PB do nivel TOTAL 17');
  assert.notEqual(estL.cdGolpeAstuto, 8 + 2 + pbNaClasse,
    'trocar por nivelNa(Ladino)=14 daria PB +5');
  assert.equal(estL.cdPsionicaAdaga, 8 + 2 + pbTotal, 'cdPsionicaAdaga usa PB do nivel TOTAL 17');
  assert.notEqual(estL.cdPsionicaAdaga, 8 + 2 + pbNaClasse,
    'trocar por nivelNa(Ladino)=14 daria PB +5');

  // --- Monge: cdFoco ---
  const m = await personagemMulticlasse([
    { classe: 'Monge', nivel: 14, subclasse: 'Combatente da Mão Espalmada' },
    { classe: 'Bárbaro', nivel: 3, subclasse: 'Trilha do Berserker' },
  ]);
  await porNaFicha(m);
  const estM = sheetClasses.monge.getEstadoRecursosMonge();
  // 8 + PB + mod Sabedoria (+2 na fixture).
  assert.equal(estM.cdFoco, 8 + pbTotal + 2, 'cdFoco usa PB do nivel TOTAL 17');
  assert.notEqual(estM.cdFoco, 8 + pbNaClasse + 2,
    'trocar por nivelNa(Monge)=14 daria PB +5 -- Golpe Atordoante mais fraco');

  // Contra-prova de que a fixture nao esta medindo o nivel errado por
  // acaso: os degraus de progressao continuam lendo o nivel NA CLASSE.
  assert.equal(estM.nivel, 14, 'o nivel do modulo e o nivel NA classe (14), nao o total (17)');
  assert.equal(estL.nivel, 14, 'idem no Ladino');
});

test('as manobras do Mestre da Batalha vem com descricao mesmo com o Guerreiro nao inicial', async () => {
  const { sheetClasses, db } = await modulosApp();
  const dadosGuerreiro = await db.getClasse('Guerreiro');
  const opcoes = (dadosGuerreiro?.subclasses || [])
    .find(sc => sc.nome === 'Mestre da Batalha')?.opcoes_manobra || [];
  assert.ok(opcoes.length >= 3, 'a fixture depende das opcoes_manobra reais do guerreiro.json');
  const escolhidas = opcoes.slice(0, 3).map(o => o.nome);

  // Le manobrasComDescricao pela fachada publica do modulo.
  async function descricoesDe(roteiro) {
    const p = await personagemMulticlasse(roteiro);
    p.manobras_conhecidas = [...escolhidas];
    await porNaFicha(p);
    return sheetClasses.guerreiro.getEstadoRecursosGuerreiro().manobrasComDescricao;
  }

  // Direcao 1: Guerreiro como classe INICIAL. Ja funcionava -- e o canario
  // que impede "consertar" a direcao 2 quebrando esta.
  const comoInicial = await descricoesDe([
    { classe: 'Guerreiro', nivel: 9, subclasse: 'Mestre da Batalha' },
    { classe: 'Bárbaro', nivel: 3, subclasse: 'Trilha do Berserker' },
  ]);
  assert.equal(comoInicial.length, 3);
  assert.ok(comoInicial.every(m => (m.descricao || '').length > 0),
    'Guerreiro inicial: as 3 manobras vem com descricao');

  // Direcao 2: Guerreiro como SEGUNDA classe. Hoje `classeData` e o do
  // Bárbaro, entao o bloco renderiza as manobras com a descricao EM BRANCO.
  const comoSegunda = await descricoesDe([
    { classe: 'Bárbaro', nivel: 3, subclasse: 'Trilha do Berserker' },
    { classe: 'Guerreiro', nivel: 9, subclasse: 'Mestre da Batalha' },
  ]);
  assert.equal(comoSegunda.length, 3);
  assert.ok(comoSegunda.every(m => (m.descricao || '').length > 0),
    'Guerreiro segunda classe: as 3 manobras TAMBEM vem com descricao');
});

test('as invocacoes do Bruxo aparecem no modal mesmo com o Bruxo nao inicial', async () => {
  const { sheetClasses } = await modulosApp();

  // Abre a fachada publica (abrirModalRecursosBruxo) e devolve o HTML que
  // ela escreveu na grade de invocacoes.
  async function htmlDaGrade(roteiro) {
    const p = await personagemMulticlasse(roteiro);
    await porNaFicha(p);
    const els = await comDomDeModal(() => sheetClasses.bruxo.abrirModalRecursosBruxo());
    return els.get('bruxo-inv-grid')?.innerHTML || '';
  }

  // Direcao 1: Bruxo como classe INICIAL.
  const comoInicial = await htmlDaGrade([
    { classe: 'Bruxo', nivel: 5, subclasse: '' },
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
  ]);
  assert.ok(comoInicial.includes('data-inv-card="Armadura de Sombras"'),
    'Bruxo inicial: a lista de invocacoes vem preenchida');
  const qtdInicial = (comoInicial.match(/data-inv-card=/g) || []).length;
  assert.ok(qtdInicial >= 10, `Bruxo inicial: esperava dezenas de invocacoes, veio ${qtdInicial}`);

  // Direcao 2: Bruxo como SEGUNDA classe. Hoje `classeData.texto_completo`
  // e o do Guerreiro, que nao tem "## Opções de Invocações Místicas" --
  // o modal abre com a lista VAZIA.
  const comoSegunda = await htmlDaGrade([
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
    { classe: 'Bruxo', nivel: 5, subclasse: '' },
  ]);
  assert.ok(comoSegunda.includes('data-inv-card="Armadura de Sombras"'),
    'Bruxo segunda classe: a lista de invocacoes TAMBEM vem preenchida');
  const qtdSegunda = (comoSegunda.match(/data-inv-card=/g) || []).length;
  assert.equal(qtdSegunda, qtdInicial,
    'a mesma quantidade de invocacoes nas duas direcoes');
});

test('a subclasse lida pelos modulos e a DAQUELA classe, nao a da classe inicial', async () => {
  const { sheetClasses } = await modulosApp();

  // Direcao 1: Paladino como SEGUNDA classe, COM Juramento da Devoção.
  // Guerreiro 3/Paladino 9 -- nivel 9 no Paladino passa do degrau 7 da
  // Aura de Devoção. Hoje `char.subclasse` e 'Campeão' (do Guerreiro), e a
  // aura some da ficha em silencio.
  const comJuramento = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
    { classe: 'Paladino', nivel: 9, subclasse: 'Juramento da Devoção' },
  ]);
  await porNaFicha(comJuramento);
  assert.equal(sheetClasses.paladino.getEstadoRecursosPaladino().auraDevocaoAtiva, true,
    'Paladino 9 com Juramento da Devoção tem Aura de Devoção, mesmo nao sendo a classe inicial');

  // Direcao 2: mesmo personagem, outro juramento. Sem este par, um
  // `auraDevocaoAtiva = true` fixo passaria na direcao 1.
  const semJuramento = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
    { classe: 'Paladino', nivel: 9, subclasse: 'Juramento dos Anciões' },
  ]);
  await porNaFicha(semJuramento);
  assert.equal(sheetClasses.paladino.getEstadoRecursosPaladino().auraDevocaoAtiva, false,
    'outro juramento NAO da Aura de Devoção');

  // Mesmo par no Bárbaro, cuja subclasse decide as resistencias da Fúria:
  // Trilha do Coração Selvagem com animal Urso amplia a lista.
  const ursoSegundo = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Coração Selvagem' },
  ]);
  ursoSegundo.recursos = { furia_animal: 'Urso' };
  await porNaFicha(ursoSegundo);
  const furiaUrso = sheetClasses.barbaro.getEstadoFuria();
  assert.ok(furiaUrso.resistencias.includes('Ígneo'),
    'Coração Selvagem/Urso como segunda classe resiste tambem a Ígneo');
  assert.equal(furiaUrso.subclasse, 'Trilha do Coração Selvagem',
    'o estado devolve a subclasse do BÁRBARO, nao a do Guerreiro');

  const berserkerSegundo = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' },
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
  ]);
  berserkerSegundo.recursos = { furia_animal: 'Urso' };
  await porNaFicha(berserkerSegundo);
  const furiaBerserker = sheetClasses.barbaro.getEstadoFuria();
  assert.equal(furiaBerserker.resistencias.includes('Ígneo'), false,
    'Berserker NAO ganha a lista ampliada, mesmo com furia_animal gravado');
});

// ============================================================
// Tarefa 3 do sub-projeto 3b -- oraculos 9 a 13 de renderFeatureItem.
//
// Numeracao: o brief da Tarefa 3 (task-3-brief.md) chama estes de "oraculos
// 5 a 9", mas esses numeros ja foram gastos pela rodada de correcao da
// Tarefa 2 (oraculos 5-8, acima). Renumerados para 9-13 por decisao do
// coordenador -- conteudo, valores e assercoes ficam identicos ao brief.
//
// `renderFeatureItem` ainda tem a assinatura antiga (f, source), sem `ctx`
// -- ver docs/PERGUNTAS-PENDENTES.txt, entrada "BLOQUEANTE do sub-projeto 5:
// renderFeatureItem le a classe errada (2026-08-23)". Ela le os ESPELHOS
// (char.classe/char.subclasse/char.nivel) por dentro, que sempre apontam
// para a classe INICIAL -- exceto char.nivel, que sincronizarEspelhos
// sempre grava como a SOMA de todas as classes (regras-multiclasse.js:153),
// entao ja e o nivel TOTAL hoje, independente de ctx.
// ============================================================

// ORACULOS 9 e 10 -- o par em direcoes opostas. A asercao "o Paladino nao
// ganha o botao do Clerigo" sozinha e satisfeita por um render que nao
// emite botao nenhum; e o par que trava a regra.
//
// RODADA DE CORRECAO 2/5 (2026-08-23) -- I1: o fixture original (Clerigo
// 5/Paladino 5) caia sobre uma coincidencia DENTRO do proprio bloco que
// ele mede -- habilidades.js:3679 (`char.nivel >= 5`, o botao "Fulminar
// Mortos-Vivos") avalia igual com o nivel de classe (5>=5) e com o nivel
// TOTAL (10>=5), escondendo essa leitura errada destes dois oraculos.
// Trocado para Clerigo 3/Paladino 7 (mesmo total 10): agora nivel de
// classe (3) e total (10) DIVERGEM quanto ao limiar 5. Medido (nao
// suposto): "Centelha"/"Expulsar" nao tem gate de nivel nenhum, entao
// data-clerigo-cd-acao continua sendo emitido nos dois oraculos --
// permanecem validos. Ver oraculo 13 para a leitura que essa mudanca de
// fixture destrava.
test('renderFeatureItem com ctx do Paladino NAO emite o botao do Clerigo', async () => {
  const { sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 3, subclasse: 'Domínio da Vida' },
    { classe: 'Paladino', nivel: 7, subclasse: 'Juramento da Devoção' },
  ]);
  await porNaFicha(p);
  const dadosClerigo = await db.getClasse('Clérigo');
  const cd = dadosClerigo.caracteristicas.find(f => f.nome === 'Canalizar Divindade');
  const ctxPaladino = { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivelClasse: 7 };
  const html = sheetHabilidades.renderFeatureItem(cd, 'classe', ctxPaladino);
  assert.ok(!html.includes('data-clerigo-cd-acao'),
    'o widget do Clerigo nao pode aparecer no bloco do Paladino');
});

test('renderFeatureItem com ctx do Clerigo EMITE o botao do Clerigo', async () => {
  const { sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 3, subclasse: 'Domínio da Vida' },
    { classe: 'Paladino', nivel: 7, subclasse: 'Juramento da Devoção' },
  ]);
  await porNaFicha(p);
  const dadosClerigo = await db.getClasse('Clérigo');
  const cd = dadosClerigo.caracteristicas.find(f => f.nome === 'Canalizar Divindade');
  const ctxClerigo = { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivelClasse: 3 };
  const html = sheetHabilidades.renderFeatureItem(cd, 'classe', ctxClerigo);
  assert.ok(html.includes('data-clerigo-cd-acao'),
    'e no bloco do Clerigo ele TEM de aparecer');
});

// ORACULO 11 -- a armadilha INVERSA. As tres leituras de bonusProficiencia
// (habilidades.js:3065, :3247, :4335) usam o nivel TOTAL, por regra do
// livro:2047, e uma conversao em massa quebraria as tres de uma vez.
//
// RODADA DE CORRECAO 1/5 (2026-08-23): a versao anterior deste oraculo
// nascia verde por TRES defeitos empilhados, achados pelo coordenador
// mutando habilidades.js:3065 para `const cdPresenca = 999` e vendo o
// oraculo continuar verde:
//   1. atributo errado -- a asserção comparava contra
//      `calcMod(p.atributos.carisma)`, mas a formula real
//      (habilidades.js:3064) usa `calcMod(char.atributos.forca)`;
//   2. o fixture ESCONDIA o erro 1 -- Força e Carisma eram os DOIS 15
//      (mod +2), entao o atributo errado dava o numero certo por
//      coincidencia -- exatamente o modo de falha "o cenario escolhido e
//      um ponto onde o certo e o errado coincidem";
//   3. `html.includes(String(cdCerta))` casava um numero solto ("16") em
//      qualquer lugar do HTML, nao so na CD -- sobreviveu a CD 999 porque
//      "16" ainda aparecia em outro trecho do bloco.
//
// CONSERTADO: Força do fixture passou a ser 18 (mod +4), DIFERENTE do mod
// de Carisma (+2 -- o valor 15 default de personagemMulticlasse), para que
// o atributo errado nao tenha mais como se esconder atras de uma
// coincidencia numerica. A asserção ancora na FRASE completa que o codigo
// emite ("CD <n> (SAB)"), nao no numero solto. Os tres valores sao
// LITERAIS (nao recalculados com bonusProficiencia/calcMod -- recalcular
// com a formula da implementação mediria a implementação por ela mesma):
//   CD certa   = 8 + 4 (mod Força 18) + 6 (PB do nivel TOTAL 17)  = 18
//   CD errada A (nivel de classe, 3, em vez do total)  = 8 + 4 + 2 (PB(3)) = 14
//   CD errada B (atributo errado -- Carisma em vez de Força, nivel certo) = 8 + 2 + 6 = 16
//
// Tensao provada por mutação (saida completa no task-3-report.md,
// restaurada de um backup com `cp`, nunca com `git checkout --`):
//   - `cdPresenca = 999`               -> oraculo fica VERMELHO (positiva falha)
//   - `bonusProficiencia(3)` (nivel de classe) -> oraculo fica VERMELHO (a 14 aparece)
//   - `calcMod(char.atributos.carisma)` (atributo errado) -> oraculo fica VERMELHO (a 16 aparece)
//   - restaurado -> oraculo volta a VERDE
//
// RODADA DE CORRECAO 2/5 (2026-08-23):
//   M2 -- PREMISSA: Presença Intimidante e uma caracteristica de NIVEL 14
//   da subclasse, renderizada aqui contra um Barbaro de nivel DE CLASSE 3.
//   Isso funciona porque renderFeatureItem nao filtra por nivel de
//   aquisicao (quem filtra e caracteristicas.js) -- mas se a Tarefa 4
//   ACRESCENTAR qualquer portao de nivel a renderFeatureItem, este oraculo
//   passa a ficar vermelho por um motivo NOVO e legitimo (o personagem nao
//   "tem" a caracteristica ainda), nao pelo bug original que ele mede.
//   Nao "conserte" afrouxando o oraculo sem investigar qual dos dois e.
test('as CDs de bonusProficiencia usam o nivel TOTAL', async () => {
  const { sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 3, subclasse: 'Trilha do Berserker' },
    { classe: 'Guerreiro', nivel: 14, subclasse: 'Campeão' },
  ]);
  // Força 18 (mod +4) DIFERENTE do mod de Carisma (+2, o 15 default) --
  // sem essa divergencia um atributo errado na formula (Carisma em vez de
  // Força) produziria o mesmo numero por coincidencia, e o oraculo nao
  // pegaria a troca. Mutado DEPOIS de personagemMulticlasse (que ja
  // calculou PV a partir de Constituição, alheio a Força) e ANTES de
  // porNaFicha (que so registra o personagem nos espelhos, sem recalcular
  // nada a partir dos atributos).
  p.atributos.forca = 18;
  await porNaFicha(p);
  const dadosBarbaro = await db.getClasse('Bárbaro');
  const pi = dadosBarbaro.subclasses
    .find(s => s.nome === 'Trilha do Berserker').caracteristicas
    .find(f => f.nome === 'Presença Intimidante');
  const ctx = { classe: 'Bárbaro', subclasse: 'Trilha do Berserker', nivelClasse: 3 };
  const html = sheetHabilidades.renderFeatureItem(pi, 'subclasse', ctx);
  // I2 -- guarda contra vacuidade: se a Tarefa 4 errar o PORTAO
  // (char.subclasse) em vez do nivel, o bloco nao renderiza nada e a
  // asserção de valor abaixo falharia pela MESMA mensagem de hoje, por
  // uma causa completamente diferente. Esta linha isola as duas causas.
  assert.ok(html.includes('CD ') && html.includes('(SAB)'),
    'guarda contra vacuidade: o bloco tem de renderizar antes de medir o valor da CD');
  // Valores LITERAIS -- ver a conta no comentario acima. Nao chamar
  // utils.bonusProficiencia/calcMod aqui: isso mediria a implementação
  // com a formula dela mesma, e um erro na formula real passaria
  // despercebido por reaparecer identico dos dois lados.
  assert.ok(html.includes('CD 18 (SAB)'),
    'a CD tem de usar o bonus do nivel TOTAL (17 -> PB +6) e o mod de Força (18 -> +4): 8+4+6=18');
  assert.ok(!html.includes('CD 14 (SAB)'),
    'CD 14 seria 8+4+2 -- o bonus do nivel DE CLASSE (3 -> PB +2), nao o total');
  assert.ok(!html.includes('CD 16 (SAB)'),
    'CD 16 seria 8+2+6 -- o mod de CARISMA (+2) usado no lugar do de Força (+4)');

  // I3 (rodada de correcao 2/5): o oraculo 13 mede so o bloco do Clerigo --
  // 1 de ~144 pontos de conversao de data-classe. O revisor mediu que o
  // proprio botao deste oraculo (data-berserker-acao="presenca-
  // intimidante") tem data-classe=0 e nada o asseria. Reusa o HTML ja
  // computado acima -- amplia a cobertura de I3 para um SEGUNDO bloco
  // (Barbaro/subclasse) sem nenhum fixture novo.
  const botoesPI = (html.match(/<button/g) || []).length;
  const comClassePI = (html.match(/data-classe="Bárbaro"/g) || []).length;
  assert.ok(botoesPI > 0, 'guarda contra vacuidade: tem de haver botao para medir data-classe');
  assert.equal(comClassePI, botoesPI, 'todo botao do bloco do Barbaro carrega data-classe="Bárbaro"');
});

// ORACULO 12 -- a mais perigosa das 20 de nivel de classe: o rotulo JA diz
// "nivel de Clerigo" e o codigo le o total (habilidades.js:3815).
//
// ACHADO ao escrever este oraculo (relatado no task-3-report.md): a subclasse
// Dominio da Trapaca tem DUAS caracteristicas com "Duplicidade" no nome --
// "Invocar Duplicidade" (o gatilho) e "Duplicidade Aprimorada" (nivel 17, o
// texto com "cure PV = nivel de Clerigo"). Um filtro `f.nome.includes(...)`
// pega a PRIMEIRA da lista do catalogo, que e "Invocar Duplicidade" -- cuja
// renderizacao nao emite nenhum numero de cura, entao o oraculo nasceria
// vermelho pelo motivo ERRADO (feature trocada) e continuaria vermelho MESMO
// DEPOIS da Tarefa 4 consertar ctx, porque a caracteristica errada nunca
// emite "(N)" nenhum. Trocado para nome exato, que e a caracteristica que a
// asserção de fato quer medir.
//
// RODADA DE CORRECAO 1/5 (2026-08-23): o coordenador pediu o mesmo rigor
// aplicado ao oraculo 11 nos outros tres. Aqui a asserção original ancorava
// em `(5)`/`(15)` soltos -- curtos o bastante para, em tese, casar em outro
// lugar do bloco. Trocado para a FRASE completa que habilidades.js:3815
// emite ("nível de Clérigo (N)"), que só ocorre uma vez no HTML (a segunda
// menção a "nível de Clérigo", dentro do texto em markdown da
// caracteristica, termina em ponto final, sem numero nenhum -- conferido
// lendo o HTML real antes de escolher a ancora). Os literais 5/15
// continuam vindo do FIXTURE (nivel de Clerigo e nivel total do roteiro),
// nao de nenhuma formula do app -- nao ha o que recalcular aqui.
//
// RODADA DE CORRECAO 2/5 (2026-08-23) -- I2: guarda contra vacuidade
// acrescentada. Mesmo motivo do oraculo 11/14: se a Tarefa 4 errar o
// PORTAO em vez do nivel, o bloco nao renderiza nada e a asserção de
// valor falharia com a mesma mensagem de hoje, escondendo qual das duas
// causas e a real.
test('a Ilusao de Cura usa o nivel de CLERIGO, e o rotulo ja dizia isso', async () => {
  const { sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Trapaça' },
    { classe: 'Paladino', nivel: 10, subclasse: 'Juramento da Devoção' },
  ]);
  await porNaFicha(p);
  const dados = await db.getClasse('Clérigo');
  const dup = dados.subclasses.find(s => s.nome === 'Domínio da Trapaça')
    .caracteristicas.find(f => f.nome === 'Duplicidade Aprimorada');
  const ctx = { classe: 'Clérigo', subclasse: 'Domínio da Trapaça', nivelClasse: 5 };
  const html = sheetHabilidades.renderFeatureItem(dup, 'subclasse', ctx);
  assert.ok(html.includes('nível de Clérigo ('),
    'guarda contra vacuidade: o bloco tem de renderizar antes de medir o nivel');
  assert.ok(html.includes('nível de Clérigo (5)'), 'cura = nivel de Clerigo = 5');
  assert.ok(!html.includes('nível de Clérigo (15)'), 'nao o nivel total, que e 15');
});

// ORACULO 13 -- data-classe, para o sub-projeto 3c ler.
//
// RODADA DE CORRECAO 2/5 (2026-08-23) -- I1: fixture trocado para
// Clerigo 3/Paladino 7 (mesmo total 10, mesma razao do oraculo 9/10).
// Isso destrava uma segunda leitura: habilidades.js:3679 (botao "Fulminar
// Mortos-Vivos") usa `char.nivel >= 5`, o nivel TOTAL (10, sempre >=5
// nesta fixture), quando deveria usar o nivel DE CLASSE do Clerigo (3,
// <5). MEDIDO (nao suposto, mutando habilidades.js:3679 e restaurando com
// `cp`): com a leitura CERTA (nivelClasse=3) botoes=2; com a leitura de
// HOJE (char.nivel=10) botoes=3.
//
// ACHADO: a troca de fixture sozinha NAO fecha essa leitura -- medi as
// duas assercoes originais (botoes>0 e comClasse===botoes) contra um
// cenario onde data-classe foi consertado nos TRES botoes mas o bug de
// nivel continua (fulminar aparecendo errado): botoes=3, comClasse=3, e as
// duas assercoes originais PASSAM apesar do bug -- porque nenhuma delas
// fixa a CONTAGEM certa, so a proporção. Por isso a asserção nova abaixo
// (`botoes === 2`) e necessaria, nao so o fixture -- ver task-3-report.md
// para a medicao completa das duas rodadas.
test('todo elemento interativo carrega data-classe do contexto', async () => {
  const { sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 3, subclasse: 'Domínio da Vida' },
    { classe: 'Paladino', nivel: 7, subclasse: 'Juramento da Devoção' },
  ]);
  await porNaFicha(p);
  const dados = await db.getClasse('Clérigo');
  const cd = dados.caracteristicas.find(f => f.nome === 'Canalizar Divindade');
  const ctx = { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivelClasse: 3 };
  const html = sheetHabilidades.renderFeatureItem(cd, 'classe', ctx);
  const botoes = (html.match(/<button/g) || []).length;
  const comClasse = (html.match(/data-classe="Clérigo"/g) || []).length;
  assert.ok(botoes > 0, 'guarda contra vacuidade: tem de haver botao para medir');
  assert.equal(comClasse, botoes, 'todo botao emitido carrega data-classe');
  assert.equal(botoes, 2,
    'Fulminar Mortos-Vivos so a partir do nivel 5 NA CLASSE (Clerigo esta no 3 aqui) -- ' +
    'nao do nivel TOTAL (10); ler o total daria 3 botoes em vez de 2');
});

// ORACULO 14 -- o buraco maior (rodada de correcao 2/5). TODOS os fixtures
// dos oraculos 9-13 mediam a classe medida como a classe INICIAL do
// roteiro -- e como os espelhos char.classe/char.subclasse sempre apontam
// para a inicial, eles CONCORDAVAM com `ctx` por coincidencia. O revisor
// mediu: 95 das 96 conversoes de char.subclasse e 25 das 26 de char.classe
// ficavam invisiveis a este arquivo por essa razao estrutural. Um Paladino
// 10/Clerigo 5 renderiza o bloco do Clerigo VAZIO hoje, e nenhum oraculo
// anterior notava.
//
// Aqui o Paladino e a classe INICIAL e o Clerigo e a SEGUNDA: os espelhos
// char.classe='Paladino'/char.subclasse='Juramento da Devoção' DIVERGEM de
// ctx.classe='Clérigo'/ctx.subclasse='Domínio da Trapaça', e o bloco do
// Clerigo tem de renderizar mesmo assim. E o oraculo de maior valor do
// lote: sozinho ele prende a familia inteira dos portoes de
// char.classe/char.subclasse, no lugar exato onde os oraculos 9-13 nao
// alcancavam.
test('renderFeatureItem com o Clerigo como SEGUNDA classe ainda renderiza o bloco completo', async () => {
  const { sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Paladino', nivel: 10, subclasse: 'Juramento da Devoção' },
    { classe: 'Clérigo', nivel: 5, subclasse: 'Domínio da Trapaça' },
  ]);
  await porNaFicha(p);
  const dados = await db.getClasse('Clérigo');
  const dup = dados.subclasses.find(s => s.nome === 'Domínio da Trapaça')
    .caracteristicas.find(f => f.nome === 'Duplicidade Aprimorada');
  const ctx = { classe: 'Clérigo', subclasse: 'Domínio da Trapaça', nivelClasse: 5 };
  const html = sheetHabilidades.renderFeatureItem(dup, 'subclasse', ctx);
  // Guarda contra vacuidade (I2): se a Tarefa 4 errar o PORTAO (nao ler
  // ctx.subclasse) o bloco nao renderiza nada e a asserção de valor abaixo
  // falharia com a MESMA mensagem de hoje, por uma causa diferente. Esta
  // linha isola "o bloco nao renderizou" de "o bloco renderizou com o
  // numero errado".
  assert.ok(html.includes('nível de Clérigo ('),
    'guarda contra vacuidade: o bloco do Clerigo tem de renderizar mesmo sendo a SEGUNDA classe');
  assert.ok(html.includes('nível de Clérigo (5)'),
    'e com o nivel DE CLASSE certo (5) -- nao o total (15) nem o nivel do Paladino (10)');
});

// ORACULO 15 -- I4 (rodada de correcao 2/5): a "armadilha inversa" (livro:
// 2047) tinha so 1 das 3 leituras de bonusProficiencia cobertas pelo
// oraculo 11 (habilidades.js:3065). Esta cobre a segunda:
// habilidades.js:3247, a CD de Magia Fascinante do Bardo (Colegio do
// Glamour).
//
// PREMISSA (M2, mesma do oraculo 11): Magia Fascinante e uma
// caracteristica de nivel 3 da SUBCLASSE, renderizada aqui contra um
// Bardo de nivel DE CLASSE 3 (a fixture precisa do Bardo como classe
// INICIAL para o portao char.classe==='Bardo' bater -- mesmo motivo
// estrutural do oraculo 11: hoje so a classe inicial consegue renderizar
// o proprio bloco de subclasse). Se a Tarefa 4 acrescentar um portao de
// nivel a renderFeatureItem, este oraculo pode cair por um motivo NOVO e
// legitimo -- nao "conserte" afrouxando sem investigar.
test('a CD de Magia Fascinante (Bardo/Glamour) usa o nivel TOTAL e o mod de Carisma', async () => {
  const { sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Bardo', nivel: 3, subclasse: 'Colégio do Glamour' },
    { classe: 'Guerreiro', nivel: 14, subclasse: 'Campeão' },
  ]);
  // Carisma 18 (mod +4), DIFERENTE dos outros mods (+2, o default de
  // personagemMulticlasse) -- mesma tecnica do oraculo 11 com Força: sem
  // essa divergencia um atributo errado na formula (outro mod usado no
  // lugar de Carisma) daria o mesmo numero por coincidencia, e o oraculo
  // nao pegaria a troca (foi exatamente o defeito 1/3 da primeira versao
  // do oraculo 11).
  p.atributos.carisma = 18;
  await porNaFicha(p);
  const dados = await db.getClasse('Bardo');
  const mf = dados.subclasses.find(s => s.nome === 'Colégio do Glamour')
    .caracteristicas.find(f => f.nome === 'Magia Fascinante');
  const ctx = { classe: 'Bardo', subclasse: 'Colégio do Glamour', nivelClasse: 3 };
  const html = sheetHabilidades.renderFeatureItem(mf, 'subclasse', ctx);
  assert.ok(html.includes('CD ') && html.includes('(SAB)'),
    'guarda contra vacuidade: o bloco tem de renderizar antes de medir o valor da CD');
  // CD certa = 8 + 4 (mod Carisma 18) + 6 (PB do nivel TOTAL 17) = 18.
  assert.ok(html.includes('CD 18 (SAB)'),
    'a CD tem de usar o bonus do nivel TOTAL (17 -> PB +6) e o mod de Carisma (18 -> +4): 8+4+6=18');
  // CD errada A = 8 + 4 + 2 (PB do nivel DE CLASSE 3) = 14.
  assert.ok(!html.includes('CD 14 (SAB)'),
    'CD 14 seria 8+4+2 -- o bonus do nivel DE CLASSE (3 -> PB +2), nao o total');
  // CD errada B = 8 + 2 (outro mod, +2) + 6 = 16.
  assert.ok(!html.includes('CD 16 (SAB)'),
    'CD 16 seria 8+2+6 -- um mod ERRADO (+2) usado no lugar do de Carisma (+4)');
});

// ORACULO 16 -- I4, terceira e ultima leitura de bonusProficiencia:
// habilidades.js:4335, a CD de Golpe Mortal do Ladino (Assassino).
//
// PREMISSA (M2, mesma dos oraculos 11/15): Golpe Mortal e nivel 17 da
// subclasse, renderizado contra um Ladino de nivel DE CLASSE 3 -- mesma
// razao estrutural e o mesmo aviso. O HTML deste bloco tem formato
// diferente dos outros dois (nao usa "(SAB)"): a CD aparece como
// `<strong>CD N</strong>`, dentro de "salvaguarda CON ... ou dano
// dobrado" -- ancora ajustada para esse formato real, conferido lendo o
// codigo antes de escrever a asserção.
test('a CD de Golpe Mortal (Ladino/Assassino) usa o nivel TOTAL e o mod de Destreza', async () => {
  const { sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Ladino', nivel: 3, subclasse: 'Assassino' },
    { classe: 'Guerreiro', nivel: 14, subclasse: 'Campeão' },
  ]);
  // Destreza 18 (mod +4), DIFERENTE dos outros mods (+2) -- mesma tecnica.
  p.atributos.destreza = 18;
  await porNaFicha(p);
  const dados = await db.getClasse('Ladino');
  const gm = dados.subclasses.find(s => s.nome === 'Assassino')
    .caracteristicas.find(f => f.nome === 'Golpe Mortal');
  const ctx = { classe: 'Ladino', subclasse: 'Assassino', nivelClasse: 3 };
  const html = sheetHabilidades.renderFeatureItem(gm, 'subclasse', ctx);
  assert.ok(html.includes('<strong>CD ') && html.includes('ou dano dobrado'),
    'guarda contra vacuidade: o bloco tem de renderizar antes de medir o valor da CD');
  // CD certa = 8 + 4 (mod Destreza 18) + 6 (PB do nivel TOTAL 17) = 18.
  assert.ok(html.includes('<strong>CD 18</strong>'),
    'a CD tem de usar o bonus do nivel TOTAL (17 -> PB +6) e o mod de Destreza (18 -> +4): 8+4+6=18');
  // CD errada A = 8 + 4 + 2 (PB do nivel DE CLASSE 3) = 14.
  assert.ok(!html.includes('<strong>CD 14</strong>'),
    'CD 14 seria 8+4+2 -- o bonus do nivel DE CLASSE (3 -> PB +2), nao o total');
  // CD errada B = 8 + 2 (outro mod, +2) + 6 = 16.
  assert.ok(!html.includes('<strong>CD 16</strong>'),
    'CD 16 seria 8+2+6 -- um mod ERRADO (+2) usado no lugar do de Destreza (+4)');
});

// ORACULO 17 -- I3 (rodada de correcao 2/5): o oraculo 13 media so o
// bloco do Clerigo (Canalizar Divindade) -- 1 de ~144 pontos de conversao
// de data-classe -- e o oraculo 11 amplia para um segundo (Barbaro). Esta
// varredura cobre mais QUATRO classes, cada uma com fixture de classe
// UNICA: o portao char.classe bate trivialmente nesse cenario (nao ha
// segunda classe disputando o espelho), entao o que se mede aqui e SO a
// cobertura de data-classe -- os portoes de multiclasse sao trabalho dos
// oraculos 9/10/14. Nao e exaustivo (ainda restam ~138 pontos sem
// oraculo), mas amplia a familia coberta de 2 classes para 6.
test('data-classe tambem falta em Guerreiro, Mago, Monge e Feiticeiro', async () => {
  const { sheetHabilidades, db } = await modulosApp();

  // Mede UM bloco de caracteristica de CLASSE: guarda contra vacuidade +
  // todo botao emitido carrega data-classe="<classe>". Personagem de
  // classe UNICA de proposito -- isola a cobertura de data-classe do
  // portao de multiclasse, que os oraculos 9/10/14 ja medem em separado.
  async function medirClasse(classe, nomeFeature) {
    const p = await personagemMulticlasse([{ classe, nivel: 5, subclasse: '' }]);
    await porNaFicha(p);
    const dados = await db.getClasse(classe);
    const f = dados.caracteristicas.find(x => x.nome === nomeFeature);
    const ctx = { classe, subclasse: '', nivelClasse: 5 };
    const html = sheetHabilidades.renderFeatureItem(f, 'classe', ctx);
    const botoes = (html.match(/<button/g) || []).length;
    const comClasse = (html.match(new RegExp(`data-classe="${classe}"`, 'g')) || []).length;
    assert.ok(botoes > 0, `guarda contra vacuidade (${classe}): tem de haver botao para medir`);
    assert.equal(comClasse, botoes, `todo botao de ${classe}/${nomeFeature} carrega data-classe`);
  }

  await medirClasse('Guerreiro', 'Recuperar Fôlego');
  await medirClasse('Mago', 'Recuperação Arcana');
  await medirClasse('Monge', 'Foco do Monge');
  await medirClasse('Feiticeiro', 'Feitiçaria Inata');
});

// ORACULO 18 -- desambiguacao de data-classe quando DOIS ramos de classe
// diferentes emitem o MESMO atributo data-*-acao (rodada de correcao 3/5).
//
// Achado do coordenador ao investigar o achado do "tamanho real de I3" da
// rodada 2: tres ramos de classe emitem o atributo IDENTICO
// data-config-maestrias="1" -- habilidades.js:2906 (Barbaro), :4074
// (Guerreiro), :4160 (Guardiao). Um Barbaro/Guerreiro renderiza DOIS
// botoes data-config-maestrias="1" INDISTINGUIVEIS sem data-classe, e o
// handler do sub-projeto 3c nao tem como saber qual botao pertence a qual
// classe. Os oraculos 11/13/17 amostram BLOCOS DE CLASSES DISTINTAS --
// uma implementacao que emita data-classe certo em cada bloco ISOLADO
// passa nos tres sem nunca tocar o caso que quebra o 3c: dois elementos
// com o MESMO data-*-acao, no MESMO DOM, de classes diferentes.
//
// NIVEIS: Maestria em Arma tem nivel_aquisicao 1 nas tres classes
// (conferido em dados/classes/barbaro.json, guerreiro.json, guardiao.json)
// -- Barbaro 5/Guerreiro 5 escolhido por consistencia com outros oraculos
// deste arquivo, nao por exigencia de nivel. MEDIDO antes de escrever o
// oraculo (script descartavel, sem tocar produção): hoje, como
// renderFeatureItem ignora `ctx`, as DUAS chamadas abaixo renderizam pelo
// MESMO ramo (ehMaestriaBarbaro) -- porque a gate so olha
// char.classe/mirror (='Bárbaro', a classe inicial) + f.nome, nunca qual
// objeto `f` foi passado nem `ctx.classe`. As DUAS saem com 1 botao (nao
// vazias) e SEM data-classe -- por isso a guarda contra vacuidade abaixo e
// necessaria: sem ela, uma mudanca futura que trocasse "sem data-classe"
// por "sem botao nenhum" passaria despercebida pela mesma mensagem.
test('data-classe desambigua dois botoes data-config-maestrias de classes diferentes', async () => {
  const { sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 5, subclasse: 'Trilha do Berserker' },
    { classe: 'Guerreiro', nivel: 5, subclasse: 'Campeão' },
  ]);
  await porNaFicha(p);
  const dadosBarbaro = await db.getClasse('Bárbaro');
  const dadosGuerreiro = await db.getClasse('Guerreiro');
  const mBarbaro = dadosBarbaro.caracteristicas.find(f => f.nome === 'Maestria em Arma');
  const mGuerreiro = dadosGuerreiro.caracteristicas.find(f => f.nome === 'Maestria em Arma');
  const ctxBarbaro = { classe: 'Bárbaro', subclasse: 'Trilha do Berserker', nivelClasse: 5 };
  const ctxGuerreiro = { classe: 'Guerreiro', subclasse: 'Campeão', nivelClasse: 5 };
  // Simula o que renderSecaoCaracteristicas faz de verdade: uma chamada
  // por classe, no MESMO DOM (aqui, concatenadas na mesma string) -- e o
  // ponto exato onde os dois botoes identicos colidem.
  const html = sheetHabilidades.renderFeatureItem(mBarbaro, 'classe', ctxBarbaro) +
               sheetHabilidades.renderFeatureItem(mGuerreiro, 'classe', ctxGuerreiro);

  // Guarda contra vacuidade: se um dos dois blocos nao renderizar, sobra 1
  // botao (ou 0), e as asserções de data-classe abaixo falhariam pela
  // AUSENCIA DO BOTAO, nao pela ausencia do atributo -- causas diferentes,
  // mesma mensagem. Exige os DOIS botoes antes de olhar para o data-classe.
  const botoesMaestria = (html.match(/data-config-maestrias="1"/g) || []).length;
  assert.equal(botoesMaestria, 2,
    'guarda contra vacuidade: os DOIS blocos (Barbaro e Guerreiro) tem de renderizar seus botoes');

  // O par em direcoes opostas: uma implementacao que emita o MESMO
  // data-classe nos dois (ou nenhum) nao desambigua nada -- e exatamente
  // o que quebraria o handler do 3c, que precisa distinguir os dois
  // botoes identicos data-config-maestrias="1" no mesmo DOM.
  //
  // M3 (rodada de correcao 1/5 da Tarefa 4): as duas asserções que estavam
  // aqui checavam que as strings `data-classe="Bárbaro"` e `="Guerreiro"`
  // apareciam EM ALGUM LUGAR da concatenacao -- nao que fossem os DOIS
  // botoes data-config-maestrias que as carregavam. Um render que
  // carimbasse a classe certa em qualquer OUTRO elemento do bloco e
  // deixasse os dois botoes de Maestria sem atributo (ou com o mesmo)
  // passaria, apesar de ser exatamente o caso que quebra o 3c -- a asserção
  // era mais fraca que o comentario acima dela. Agora ancora no ELEMENTO:
  // le o data-classe de dentro de cada tag <button ...data-config-maestrias>.
  const tagsMaestria = html.match(/<button[^>]*data-config-maestrias="1"[^>]*>/g) || [];
  assert.equal(tagsMaestria.length, 2,
    'guarda contra vacuidade: as DUAS tags de botao de Maestria tem de ser localizaveis inteiras');
  const classesDosBotoes = tagsMaestria.map(t => (t.match(/data-classe="([^"]*)"/) || [])[1]);
  assert.deepEqual(classesDosBotoes, ['Bárbaro', 'Guerreiro'],
    'cada botao data-config-maestrias carrega o data-classe da SUA propria classe, ' +
    'e os dois sao DIFERENTES -- e disso que o handler do 3c depende para desambiguar');
});

// ORACULO 19 -- I1 da rodada de correcao 1/5 da Tarefa 4: o valor de
// data-classe nao pode ser interpretado como PADRAO DE SUBSTITUICAO.
//
// `carimbarClasse` (habilidades.js) monta o atributo com
// String.prototype.replace. `escHtml` neutraliza `& < > " '` DENTRO do nome
// da classe, mas o `replace` interpreta `$&`, "$`", "$'" e `$1` na string de
// SUBSTITUICAO, depois -- e o resultado dessa expansao nao passa por escape
// nenhum. Medido contra o codigo de hoje (sonda descartavel, sem tocar
// produção), com f = 'Recuperar Fôlego' do Guerreiro:
//
//   ctx.classe     data-classe emitido
//   'Guerreiro'    Guerreiro                      (certo)
//   'A$&B'         A<buttonamp;B                  ($& = o trecho casado)
//   'X$`Y'         X\n    <details style="...     ($` = TODO o HTML anterior)
//   "Z$'W"         Z<button#39;W                  ($' = todo o HTML posterior)
//   'Q$1R'         QbuttonR                       ($1 = o grupo capturado)
//
// O terceiro e o grave: despeja o HTML anterior, com ASPAS DUPLAS nao
// escapadas, dentro do valor do atributo -- quebra a marcacao e permite
// injetar atributos arbitrarios, inclusive um `data-*-acao` falso que o
// handler do 3c vai despachar.
//
// O caminho e alcancavel: `ctx.classe` vem de contexto-classe.js:32
// (montarContextos) <- regras-multiclasse.js:25 (classesDe), que faz
// `c.classe || ''` -- SEM validacao nenhuma, direto de `p.classes[]` do JSON
// importado. Basta importar um arquivo forjado.
//
// A asserção NAO usa escHtml para calcular o esperado: recalcular com a
// formula da implementação mediria a implementação por ela mesma. Os cinco
// valores esperados sao LITERAIS.
//
// PAR EM DIRECAO OPOSTA: o primeiro caso ('Guerreiro') exige que o carimbo
// continue funcionando. Sem ele, um `carimbarClasse` que simplesmente
// deixasse de emitir data-classe passaria nos outros quatro.
test('data-classe nao interpreta os padroes $ de String.replace', async () => {
  const { sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5, subclasse: '' }]);
  await porNaFicha(p);
  const dados = await db.getClasse('Guerreiro');
  const f = dados.caracteristicas.find(x => x.nome === 'Recuperar Fôlego');

  // Nome de classe -> valor que data-classe TEM de ter. Literais: `&` e `'`
  // viram entidade (escHtml), `$` e a crase nao sao caracteres de HTML e
  // passam inteiros. Com um nome envenenado o portao
  // `ctx.classe === 'Guerreiro'` nao bate e o ramo dedicado nao roda -- quem
  // emite o botao e o caminho generico do fim de renderFeatureItem, e e por
  // isso que a guarda contra vacuidade abaixo e obrigatoria.
  const casos = [
    ['Guerreiro', 'Guerreiro'],
    ['A$&B', 'A$&amp;B'],
    ['X$`Y', 'X$`Y'],
    ["Z$'W", 'Z$&#39;W'],
    ['Q$1R', 'Q$1R'],
  ];

  for (const [nome, esperado] of casos) {
    const html = sheetHabilidades.renderFeatureItem(f, 'classe', { classe: nome, subclasse: '', nivelClasse: 5 });
    // Guarda contra vacuidade: sem botao no HTML, as asserções abaixo
    // passariam por AUSENCIA (nenhum data-classe para conferir), nao por
    // acerto -- causas diferentes, mesma mensagem.
    assert.ok(html.includes('<button'),
      `guarda contra vacuidade (${nome}): tem de haver botao emitido para medir o data-classe`);
    const valores = Array.from(html.matchAll(/data-classe="([^"]*)"/g)).map(m => m[1]);
    assert.ok(valores.length > 0,
      `guarda contra vacuidade (${nome}): tem de haver data-classe emitido`);
    for (const v of valores) {
      // A asserção mais grave, isolada: um `<` dentro do valor so pode ter
      // vindo do despejo de HTML que "$&", "$\`" ou "$'" causam.
      assert.ok(!v.includes('<'),
        `o valor de data-classe nao pode conter marcacao despejada por padrao $ (nome ${JSON.stringify(nome)}, valor ${JSON.stringify(v)})`);
      assert.equal(v, esperado,
        `data-classe tem de ser o nome da classe escapado, literal (nome ${JSON.stringify(nome)})`);
    }
  }
});
