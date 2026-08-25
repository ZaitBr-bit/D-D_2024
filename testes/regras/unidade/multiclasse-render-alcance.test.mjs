// ============================================================
// Oraculo de ALCANCE do render por classe (renderFeatureItem).
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// O sub-projeto 3b converteu `renderFeatureItem`
// (site/js/sheet/habilidades.js, de 2547 ate o fim) de espelho para
// contexto: 145 leituras deixaram de olhar
// `char.classe`/`char.subclasse`/`char.nivel` -- que apontam sempre para a
// classe INICIAL -- e passaram a olhar
// `ctx.classe`/`ctx.subclasse`/`ctx.nivelClasse`, o contexto da classe cujo
// bloco esta sendo renderizado. Sao 95 ocorrencias de `ctx.subclasse`, 30
// de `ctx.classe` e 20 de `ctx.nivelClasse`.
//
// A revisao final do 3b mediu a rede que protege essa conversao: mutou UMA
// A UMA as 145 leituras e rodou os 19 oraculos de
// multiclasse-render.test.mjs a cada mutacao. Resultado: 138 das 145
// mutacoes SOBREVIVEM -- so 7 matam algum oraculo. O caso concreto que ela
// exibiu: reverter so `const ehAtaqueImprudente = ctx.classe === 'Bárbaro'`
// para `char.classe` faz o bloco do Barbaro de um Guerreiro 5/Barbaro 5
// perder um botao (3 -> 2), e os 19 oraculos ficam verdes.
//
// O defeito que passava nao e exotico: e CONVERSAO PARCIAL -- alguem
// reverter ou esquecer uma linha. Os 19 oraculos existentes sao PONTUAIS:
// cada um prende um comportamento (a CD do Berserker, o botao do Monge, o
// escape de `carimbarClasse`). Nenhum prende a propriedade geral, e o
// sub-projeto 3c vai editar exatamente este arquivo.
//
// A PROPRIEDADE QUE ESTE ARQUIVO PRENDE
// -------------------------------------
// O bloco de uma classe C nao pode depender de C ser a classe inicial ou
// nao. Todo o contexto necessario viaja em `ctx`. Se algum ponto ainda le o
// espelho, a propriedade quebra.
//
// Ela e medida em DOIS EIXOS, porque cada um pega uma familia diferente de
// leitura:
//
//   Eixo 1 -- TROCA DE ORDEM, mesmo nivel total.
//     A: [{C, N, S}, {X, M, T}]   B: [{X, M, T}, {C, N, S}]
//     `char.nivel` (total) e N+M nos dois -- identico. O que muda e
//     `char.classe` e `char.subclasse`, os espelhos da primeira classe.
//     Exige-se o bloco de C byte a byte igual, para as 12 classes, sem
//     nenhuma excecao. Qualquer sobrevivente de `char.classe` ou
//     `char.subclasse` derruba: 125 dos 145 pontos.
//
//   Eixo 2 -- mesmo nivel NA CLASSE, totais diferentes.
//     A: [{C, N, S}]              B: [{C, N, S}, {X, M, T}]
//     O nivel de C e N nos dois; o total difere (N contra 20). Pega as
//     reversoes de `ctx.nivelClasse` -> `char.nivel`, que o eixo 1 nao
//     enxerga por construcao -- os 20 pontos restantes.
//
// AS EXCECOES LEGITIMAS DO EIXO 2 -- SAO SEIS, NAO TRES
// -----------------------------------------------------
// Algumas CDs recebem o nivel TOTAL por regra do livro (livro:2047 -- o
// bonus de proficiencia e do PERSONAGEM, nao da classe) e por isso
// continuam lendo `char.nivel` de proposito. Tres estao dentro do corpo de
// `renderFeatureItem` (as unicas tres chamadas de `bonusProficiencia` que
// sobraram la):
//   - Barbaro / Trilha do Berserker / Presenca Intimidante  (cdPresenca)
//   - Bardo   / Colegio do Glamour  / Magia Fascinante      (cdFeitico)
//   - Ladino  / Assassino           / Golpe Mortal          (cdGolpeMortal)
// Outras TRES chegam ao HTML por fora, pelos modulos de classe que
// `renderFeatureItem` consulta via `getEstadoRecursosX` -- e cada uma tem no
// codigo o comentario que a justifica:
//   - Guerreiro / Mestre da Batalha / Superioridade em Combate
//       (sheet/classes/guerreiro.js, `cdSuperioridade`)
//   - Ladino    / QUALQUER subclasse / Ataque Furtivo -> Golpe Astuto
//       (sheet/classes/ladino.js, `cdGolpeAstuto`)
//   - Monge     / QUALQUER subclasse / Foco do Monge e Golpe Atordoante
//       (sheet/classes/monge.js, `cdFoco`)
// Ou seja: SETE das doze classes tem o bloco byte a byte identico no eixo 2
// (Bruxo, Clerigo, Druida, Feiticeiro, Guardiao, Mago, Paladino), e cinco
// tem excecao confinada a uma CD.
//
// Para as excecoes o eixo 2 NAO afrouxa para "ignora tudo". Exige-se:
//   (a) o HTML com os numeros de CD trocados por marcador tem de ficar
//       identico -- so o numero pode ter mudado;
//   (b) cada CD ou fica igual, ou sobe EXATAMENTE a diferenca entre o bonus
//       de proficiencia do total e o do nivel na classe -- nunca outro
//       valor, nunca para baixo;
//   (c) quando esses dois bonus divergem, pelo menos uma CD TEM de subir --
//       senao a CD teria passado a ler `ctx.nivelClasse` e perdido a regra
//       do livro, e a excecao ficaria verde por vacuidade.
//
// LIMITE CONHECIDO: a excecao do Golpe Mortal (Ladino / Assassino, nv17) e
// INOBSERVAVEL por este eixo. A caracteristica so existe a partir do nivel
// 17 na classe, o teto de nivel total e 20, e PB(17) === PB(20) === +6 --
// nao existe personagem em que o nivel na classe seja 17 e o bonus de
// proficiencia do total divirja. Ela entra na tabela abaixo por
// completude; quem a protege e o oraculo pontual de
// multiclasse-render.test.mjs.
//
// COMO O BLOCO E MEDIDO
// ---------------------
// `renderFeatureItem` e chamado direto, sobre o SUPERCONJUNTO de
// caracteristicas da classe ate `ctx.nivelClasse` (as de classe com
// source='classe' e as da subclasse escolhida com source='subclasse'), e
// nao pela casca `renderSecaoCaracteristicas()`. Duas razoes: (1) o titulo
// do card muda de "Caracteristicas de Classe" para "... -- C N" conforme o
// personagem tenha uma ou duas classes, o que poluiria o eixo 2 com uma
// diferenca que nao e defeito; (2) o superconjunto renderiza tambem as
// caracteristicas que a casca filtra por pertencerem a outra subclasse, o
// que aumenta o numero de ramos de `renderFeatureItem` exercitados sem
// mudar a propriedade medida (o conjunto e o mesmo em A e em B).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';
import { TRACOS_BASICOS } from '../catalogo/classes.mjs';

// As 12 classes do acervo, em ordem estavel.
const CLASSES = Object.keys(TRACOS_BASICOS);

// Niveis varridos por classe. 5, 9, 13 e 17 sao as fronteiras do bonus de
// proficiencia; 3 e o nivel em que toda subclasse do acervo esta
// disponivel; 14 existe para o Berserker (Presenca Intimidante e nv14) ter
// um cenario em que PB(nivel na classe) e PB(20) DIVERGEM -- em nivel 17 os
// dois valem +6 e a excecao ficaria invisivel. 18 existe para as
// caracteristicas de nivel 18 (ex.: Mestre Telecinetico, do Combatente
// Psiquico) entrarem na varredura -- e o maior nivel de classe alcancavel
// junto de um segundo pedaco de 2 niveis dentro do teto de 20.
const NIVEIS = [3, 5, 9, 13, 14, 17, 18];

// Nivel total dos personagens de dois pedacos. Fixo em 20 para que o par
// (nivel na classe, nivel total) sempre divirja no eixo 2, exceto no unico
// caso em que a regra nao permite divergir (classe em 17, PB(17)===PB(20)).
const NIVEL_TOTAL = 20;

// As CDs que leem o nivel TOTAL por regra do livro (livro:2047).
// `subclasse: null` significa "qualquer subclasse da classe". `nivelMin` e o
// nivel NA CLASSE a partir do qual a CD aparece no HTML -- abaixo dele a
// exigencia volta a ser igualdade byte a byte, sem folga.
const EXCECOES_CD_TOTAL = [
  { classe: 'Bárbaro', subclasse: 'Trilha do Berserker', nivelMin: 14,
    feature: 'Presença Intimidante', onde: 'habilidades.js, cdPresenca' },
  { classe: 'Bardo', subclasse: 'Colégio do Glamour', nivelMin: 3,
    feature: 'Magia Fascinante', onde: 'habilidades.js, cdFeitico' },
  { classe: 'Ladino', subclasse: 'Assassino', nivelMin: 17,
    feature: 'Golpe Mortal', onde: 'habilidades.js, cdGolpeMortal' },
  { classe: 'Guerreiro', subclasse: 'Mestre da Batalha', nivelMin: 3,
    feature: 'Superioridade em Combate', onde: 'classes/guerreiro.js, cdSuperioridade' },
  // nivelMin 5: `golpeAstutoAtivo = nivel >= 5` (classes/ladino.js).
  { classe: 'Ladino', subclasse: null, nivelMin: 5,
    feature: 'Ataque Furtivo (Golpe Astuto)', onde: 'classes/ladino.js, cdGolpeAstuto' },
  // nivelMin 2: Foco do Monge e caracteristica de nivel 2; Golpe Atordoante,
  // que exibe a MESMA cdFoco, entra no 5.
  { classe: 'Monge', subclasse: null, nivelMin: 2,
    feature: 'Foco do Monge / Golpe Atordoante', onde: 'classes/monge.js, cdFoco' },
];

// Estado de recurso "em uso" por classe, aplicado IGUALMENTE nos dois lados
// de cada comparacao. Existe porque varios ramos de `renderFeatureItem` so
// escrevem o nivel no HTML quando o recurso esta LIGADO -- Furia Divina,
// Frenesi e o Surto da Arvore do Mundo escondem o numero atras de
// `furiaAtiva ? ... : 'Requer Furia ativa'`, e o botao da Feiticaria Inata so
// consulta o nivel quando os usos acabaram. Com o personagem recem-criado
// esses ramos nunca sao renderizados, e uma reversao para `char.nivel` dentro
// deles sobreviveria a varredura inteira sem que isso significasse que ela e
// segura. Ligar o recurso nos DOIS lados nao afrouxa nada: o estado e
// identico em A e em B, entao a exigencia continua sendo igualdade.
//
// Os campos abaixo sao dados simples; os modulos de classe preenchem o resto
// do formato por guarda campo a campo (ex.: sheet/classes/feiticeiro.js:63-76),
// entao um objeto parcial e seguro.
const ESTADO_EM_USO = {
  'Bárbaro': (p) => {
    p.recursos = p.recursos || {};
    p.recursos.furia_ativa = true;
    p.recursos.furia_deuses_ativa = true;
  },
  'Feiticeiro': (p) => {
    p.recursos = p.recursos || {};
    p.recursos.feiticeiro = { ...(p.recursos.feiticeiro || {}), feiticaria_inata_usos_gastos: 2 };
  },
};

/** Aplica o estado "em uso" da classe medida, se houver, ao personagem. */
function ligarRecursos(p, classe) {
  const preparar = ESTADO_EM_USO[classe];
  if (preparar) preparar(p);
  return p;
}

// Cache dos dados de classe: `db.getClasse` le o JSON do disco a cada
// chamada e a varredura monta mais de mil personagens.
const _dadosClasse = new Map();

/** Dados de uma classe do acervo, lidos uma unica vez por execucao. */
async function dadosDaClasse(nome) {
  if (!_dadosClasse.has(nome)) {
    const { db } = await modulosApp();
    _dadosClasse.set(nome, await db.getClasse(nome));
  }
  return _dadosClasse.get(nome);
}

/**
 * Monta o estado da ficha como pages/sheet.js monta: `definirChar` mais
 * `definirClasseData` E `definirClassesData`. Chamar so `definirClasseData`
 * modela meio estado e quebra assim que o codigo passa por `dadosDe()`.
 * @returns {Promise<Map<string, object>>} mapa nome-da-classe -> dados
 */
async function porNaFicha(p) {
  const { sheetEstado, contextoClasse } = await modulosApp();
  const mapa = new Map();
  for (const c of contextoClasse.montarContextos(p, new Map())) {
    mapa.set(c.classe, await dadosDaClasse(c.classe));
  }
  sheetEstado.definirChar(p);
  sheetEstado.definirClasseData(mapa.get(p.classe) || null);
  sheetEstado.definirClassesData(mapa);
  return mapa;
}

/**
 * HTML do bloco de UMA classe do personagem: todas as caracteristicas de
 * classe ate o nivel NAQUELA classe (source='classe') seguidas das
 * caracteristicas da subclasse escolhida (source='subclasse'), cada uma
 * passada por `renderFeatureItem` com o contexto daquela classe.
 * @param {object} p - personagem ja montado
 * @param {string} nomeClasse - a classe cujo bloco se quer
 * @returns {Promise<string>} o HTML concatenado
 */
async function blocoDaClasse(p, nomeClasse) {
  const { contextoClasse, sheetHabilidades } = await modulosApp();
  const mapa = await porNaFicha(p);
  const ctx = contextoClasse.montarContextos(p, mapa).find((c) => c.classe === nomeClasse);
  assert.ok(ctx, `o personagem nao tem a classe ${nomeClasse}`);
  const partes = [];
  for (const f of (ctx.dados?.caracteristicas || []).filter((c) => c.nivel <= ctx.nivelClasse)) {
    partes.push(sheetHabilidades.renderFeatureItem(f, 'classe', ctx));
  }
  const sc = (ctx.dados?.subclasses || []).find((s) => s.nome === ctx.subclasse);
  for (const f of (sc?.caracteristicas || []).filter((c) => c.nivel <= ctx.nivelClasse)) {
    partes.push(sheetHabilidades.renderFeatureItem(f, 'subclasse', ctx));
  }
  assert.ok(partes.length > 0, `${nomeClasse} nao rendeu caracteristica nenhuma`);
  return partes.join('\n');
}

/** A classe-par (X) de C: a seguinte na lista, para nunca colidir com C. */
function classePar(classe) {
  const i = CLASSES.indexOf(classe);
  return CLASSES[(i + 1) % CLASSES.length];
}

/** Subclasse de referencia da classe-par: a primeira do acervo. */
async function subclassePar(classe) {
  const dados = await dadosDaClasse(classe);
  return dados.subclasses?.[0]?.nome || '';
}

/** As subclasses reais do acervo para uma classe. */
async function subclassesDe(classe) {
  const dados = await dadosDaClasse(classe);
  return (dados.subclasses || []).map((s) => s.nome);
}

/**
 * Troca todo numero de CD por um marcador, para separar "o HTML mudou" de
 * "so o numero da CD mudou". Cobre as duas formas que o app escreve:
 * `CD 16` e `CD: 16`.
 */
function semNumerosDeCd(html) {
  return html.replace(/CD:? \d+/g, 'CD #');
}

/** Os numeros de CD do HTML, na ordem em que aparecem. */
function numerosDeCd(html) {
  return [...html.matchAll(/CD:? (\d+)/g)].map((m) => Number(m[1]));
}

// As cinco classes que concedem Maestria em Arma (espelha CLASSES_MAESTRIA de
// site/js/sheet/maestrias.js). Escrita a mao aqui de proposito: um oraculo que
// importasse a lista do app nao notaria uma classe entrando ou saindo dela.
const CLASSES_QUE_DAO_MAESTRIA = ['Bárbaro', 'Guerreiro', 'Guardião', 'Paladino', 'Ladino'];

// O contador de Maestria em Arma no HTML: `...margin-left:auto">N/M</span>`
// seguido, SEM outro contador no meio, do botao `data-config-maestrias`. A
// guarda `(?!margin-left:auto)` e o que impede o casamento de atravessar a
// caracteristica anterior e mascarar o contador errado.
const CONTADOR_MAESTRIA = /(margin-left:auto">\d+\/)(\d+)(<\/span>(?:(?!margin-left:auto)[\s\S])*?data-config-maestrias)/;

/**
 * O teto que o card de Maestria em Arma exibe, ou null se o bloco nao tem
 * esse card.
 * @param {string} html
 * @returns {number|null}
 */
function tetoDeMaestria(html) {
  const m = html.match(CONTADOR_MAESTRIA);
  return m ? Number(m[2]) : null;
}

/**
 * Troca o TETO do contador de Maestria em Arma por um marcador, para separar
 * "o HTML mudou" de "so o teto de maestria mudou" -- o mesmo tratamento que
 * `semNumerosDeCd` da as CDs de nivel total.
 * @param {string} html
 * @returns {string}
 */
function semTetoDeMaestria(html) {
  return html.replace(new RegExp(CONTADOR_MAESTRIA.source, 'g'), '$1#$3');
}

/**
 * A excecao de CD por nivel total que se aplica a (classe, subclasse,
 * nivel), ou null. `subclasse: null` na tabela vale para qualquer subclasse.
 */
function excecaoDeCd(classe, subclasse, nivel) {
  return EXCECOES_CD_TOTAL.find((e) => e.classe === classe
    && (e.subclasse === null || e.subclasse === subclasse)
    && nivel >= e.nivelMin) || null;
}

// ============================================================
// Contra-oraculo: a fixture precisa divergir de verdade.
//
// Se `sincronizarEspelhos` deixasse `char.classe`/`char.subclasse` iguais
// nos dois lados do eixo 1, ou `char.nivel` igual nos dois lados do eixo 2,
// a varredura inteira passaria com QUALQUER implementacao -- verde por
// vacuidade. Este teste fecha essa saida antes dos outros 24.
// ============================================================
test('alcance: as fixtures dos dois eixos divergem no espelho que medem', async () => {
  const a1 = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5, subclasse: 'Campeão' },
    { classe: 'Bárbaro', nivel: 15, subclasse: 'Trilha do Berserker' },
  ]);
  const b1 = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 15, subclasse: 'Trilha do Berserker' },
    { classe: 'Guerreiro', nivel: 5, subclasse: 'Campeão' },
  ]);
  assert.equal(a1.nivel, b1.nivel, 'eixo 1: o nivel TOTAL tem de ser identico nos dois');
  assert.notEqual(a1.classe, b1.classe, 'eixo 1: o espelho char.classe tem de divergir');
  assert.notEqual(a1.subclasse, b1.subclasse, 'eixo 1: o espelho char.subclasse tem de divergir');

  const a2 = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 14, subclasse: 'Trilha do Berserker' },
  ]);
  const b2 = await personagemMulticlasse([
    { classe: 'Bárbaro', nivel: 14, subclasse: 'Trilha do Berserker' },
    { classe: 'Guerreiro', nivel: 6, subclasse: 'Campeão' },
  ]);
  assert.equal(a2.classe, b2.classe, 'eixo 2: a classe medida e a mesma nos dois');
  assert.notEqual(a2.nivel, b2.nivel, 'eixo 2: o espelho char.nivel tem de divergir');
  const { utils } = await modulosApp();
  assert.notEqual(utils.bonusProficiencia(a2.nivel), utils.bonusProficiencia(b2.nivel),
    'eixo 2: no cenario do Berserker o BONUS DE PROFICIENCIA tem de divergir, ' +
    'senao a excecao da CD por nivel total ficaria invisivel');
});

// ============================================================
// Eixo 1 -- troca de ordem, mesmo nivel total.
// ============================================================
for (const classe of CLASSES) {
  test(`alcance eixo 1: o bloco de ${classe} nao muda ao deixar de ser a classe inicial`, async () => {
    const par = classePar(classe);
    const subPar = await subclassePar(par);
    let cenarios = 0;
    for (const subclasse of await subclassesDe(classe)) {
      for (const nivel of NIVEIS) {
        const nivelPar = NIVEL_TOTAL - nivel;
        const proprio = { classe, nivel, subclasse };
        const outro = { classe: par, nivel: nivelPar, subclasse: subPar };
        const a = ligarRecursos(await personagemMulticlasse([proprio, outro]), classe);
        const b = ligarRecursos(await personagemMulticlasse([outro, proprio]), classe);
        const htmlA = await blocoDaClasse(a, classe);
        const htmlB = await blocoDaClasse(b, classe);
        assert.equal(htmlB, htmlA,
          `${classe} ${nivel} (${subclasse}) + ${par} ${nivelPar}: o bloco de ${classe} ` +
          `mudou so por ${classe} ter deixado de ser a classe inicial. O nivel TOTAL e ` +
          `${NIVEL_TOTAL} nos dois, entao a diferenca so pode vir de um ponto que ainda ` +
          `le char.classe ou char.subclasse em vez de ctx.classe/ctx.subclasse.`);
        cenarios++;
      }
    }
    assert.ok(cenarios >= NIVEIS.length, `${classe}: a varredura nao rodou cenario nenhum`);
  });
}

// ============================================================
// Eixo 2 -- mesmo nivel NA classe, nivel total diferente.
// ============================================================
for (const classe of CLASSES) {
  test(`alcance eixo 2: o bloco de ${classe} depende do nivel NA classe, nao do total`, async () => {
    const { utils } = await modulosApp();
    const par = classePar(classe);
    const subPar = await subclassePar(par);
    const pbTotal = utils.bonusProficiencia(NIVEL_TOTAL);
    for (const subclasse of await subclassesDe(classe)) {
      for (const nivel of NIVEIS) {
        const nivelPar = NIVEL_TOTAL - nivel;
        const proprio = { classe, nivel, subclasse };
        const a = ligarRecursos(await personagemMulticlasse([proprio]), classe);
        const b = ligarRecursos(await personagemMulticlasse([
          proprio, { classe: par, nivel: nivelPar, subclasse: subPar }]), classe);
        const brutoA = await blocoDaClasse(a, classe);
        const brutoB = await blocoDaClasse(b, classe);
        const rotulo = `${classe} ${nivel} (${subclasse}) sozinho contra ` +
          `${classe} ${nivel} + ${par} ${nivelPar}`;

        // A EXCECAO QUE NAO E UMA CD: o teto de Maestria em Arma.
        //
        // Desde a Tarefa 5 do sub-projeto 3d ele e do PERSONAGEM -- o MAIOR
        // limite entre as classes que concedem (docs/PERGUNTAS-PENDENTES.txt,
        // PERGUNTA 2, decidida em 2026-08-22) -- e nao da classe do card.
        // Antes havia CINCO tetos, um por card, e o imposto de verdade era o
        // do ultimo botao clicado. Num Guardiao 3 + Guerreiro 17 o card do
        // Guardiao passa a dizer 6 em vez de 2, e 6 e o numero certo: o
        // personagem tem direito a seis maestrias, guardadas num unico array.
        //
        // Isso NAO e uma reversao para `char.nivel`. O teto nao le o nivel
        // TOTAL: le o nivel de cada classe NA CLASSE dela. Um Guardiao 3 +
        // Ladino 17, de total identico, continua em 2 -- e a metade oposta
        // que mostra que a excecao nao e uma folga para o total.
        //
        // O confinamento e o mesmo que as CDs recebem: so o NUMERO pode
        // mudar, e ainda assim
        //   (a) ele nunca ENCOLHE ao acrescentar uma classe (o maior sobre um
        //       conjunto maior), e
        //   (b) quando a classe-par NAO concede maestria, ele nao pode mudar
        //       de jeito nenhum.
        // O VALOR em si e medido em multiclasse-combate.test.mjs, no bloco da
        // Tarefa 5 (incluindo a varredura das 5 classes nos 20 niveis).
        const tetoA = tetoDeMaestria(brutoA);
        const tetoB = tetoDeMaestria(brutoB);
        if (tetoA !== null || tetoB !== null) {
          assert.ok(tetoA !== null && tetoB !== null,
            `${rotulo}: o card de Maestria em Arma existe de um lado so ` +
            `(A=${tetoA}, B=${tetoB}) -- isso nao e diferenca de teto, e o card sumindo`);
          assert.ok(tetoB >= tetoA,
            `${rotulo}: o teto de maestria caiu de ${tetoA} para ${tetoB} ao ` +
            `acrescentar uma classe; o MAIOR sobre um conjunto maior nunca encolhe`);
          if (!CLASSES_QUE_DAO_MAESTRIA.includes(par)) {
            assert.equal(tetoB, tetoA,
              `${rotulo}: ${par} nao concede Maestria em Arma, entao o teto de ` +
              `${classe} nao tinha como mudar`);
          }
        }

        const htmlA = semTetoDeMaestria(brutoA);
        const htmlB = semTetoDeMaestria(brutoB);
        const excecao = excecaoDeCd(classe, subclasse, nivel);

        if (!excecao) {
          assert.equal(htmlB, htmlA,
            `${rotulo}: o bloco de ${classe} mudou so porque o nivel TOTAL subiu de ` +
            `${nivel} para ${NIVEL_TOTAL}. Nada nesse bloco depende do total -- a ` +
            `diferenca so pode vir de um ponto que ainda le char.nivel em vez de ` +
            `ctx.nivelClasse.`);
          continue;
        }

        const delta = pbTotal - utils.bonusProficiencia(nivel);
        if (delta === 0) {
          assert.equal(htmlB, htmlA,
            `${rotulo}: PB(${nivel}) e PB(${NIVEL_TOTAL}) sao iguais, entao nem a ` +
            `excecao de ${excecao.feature} (${excecao.onde}) pode mudar o HTML.`);
          continue;
        }

        // Excecao legitima: a CD de `excecao.feature` usa o bonus de
        // proficiencia do nivel TOTAL (livro:2047). A diferenca tem de
        // ficar CONFINADA ao numero da CD, e mover-se exatamente `delta`.
        assert.equal(semNumerosDeCd(htmlB), semNumerosDeCd(htmlA),
          `${rotulo}: a unica diferenca permitida e o numero da CD de ` +
          `${excecao.feature} (${excecao.onde}), que usa o bonus de proficiencia do ` +
          `nivel TOTAL. Aqui mudou outra coisa no HTML.`);
        const cdsA = numerosDeCd(htmlA);
        const cdsB = numerosDeCd(htmlB);
        assert.equal(cdsB.length, cdsA.length, `${rotulo}: mudou a QUANTIDADE de CDs`);
        for (let i = 0; i < cdsA.length; i++) {
          assert.ok(cdsB[i] === cdsA[i] || cdsB[i] === cdsA[i] + delta,
            `${rotulo}: a CD ${i} foi de ${cdsA[i]} para ${cdsB[i]}. So sao aceitos ` +
            `dois valores: o mesmo (CD que nao depende do total) ou ` +
            `${cdsA[i] + delta} (CD que usa o bonus de proficiencia do total, +${delta}).`);
        }
        assert.ok(cdsA.some((v, i) => cdsB[i] === v + delta),
          `${rotulo}: o bonus de proficiencia do total e +${delta} maior que o do nivel ` +
          `na classe, entao a CD de ${excecao.feature} (${excecao.onde}) TINHA de subir. ` +
          `Nenhuma subiu -- essa CD passou a ler o nivel NA CLASSE e perdeu a regra do ` +
          `livro (livro:2047).`);
      }
    }
  });
}
