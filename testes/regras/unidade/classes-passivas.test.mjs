// ============================================================
// Confronto: heurística ehHabilidadeAtiva(descricao, nome)
// (site/js/utils.js:499-511, a que decide se a ficha exibe uma
// característica de classe em "Habilidades Ativas" ou "Habilidades
// Passivas") contra CLASSIFICACAO (testes/regras/catalogo/classes-passivas.mjs
// -- 174 características de classe base transcritas do livro).
//
// A heurística decide por SUBSTRING na descrição ("como uma ação",
// "você pode gastar", recarga por descanso etc.) -- ela nunca foi
// escrita olhando para o livro, então divergir é esperado. O que este
// motor não pode fazer é tratar toda divergência como igualmente forte:
// o catálogo já separou isso pelo campo `base` (ver cabeçalho de
// classes-passivas.mjs), e este arquivo respeita a separação em vez de
// achatá-la:
//   - 'custo-declarado' / 'ausencia-de-custo' -- o livro tem uma frase
//     citável que prova a classificação. Divergência aqui é uma
//     asserção de verdade (assert.equal): se falhar, é candidata a
//     lacuna real, com a frase do livro como prova.
//   - 'julgamento' -- o livro não declara nada, a classificação do
//     catálogo é leitura, não fato. Rodar a heurística contra ela como
//     se fosse fato produziria uma alegação sem fonte -- o vício que já
//     gerou 31 lacunas falsas numa rodada anterior deste projeto (ver
//     cabeçalho do catálogo). Estas 9 entradas usam t.skip(): o motor
//     ainda RODA a heurística e registra o resultado na mensagem do
//     skip (nada fica escondido), mas não afirma que o app está certo
//     ou errado.
//   - `composta: true` -- segunda forma de "não sustenta alegação
//     sozinha" (10 entradas, ver cabeçalho do catálogo, seção "O campo
//     `composta`"): o livro empacota, sob um nome só, cláusulas que
//     teriam `base` diferente se fossem separadas. Uma discordância do
//     app aqui pode ser só recorte diferente do mesmo parágrafo, não
//     defeito -- mesmo tratamento de 'julgamento' (t.skip, heurística
//     roda e registra), independente do `base` que a entrada composta
//     carrega (4 das 10 são `julgamento` também; as outras 6 são
//     `custo-declarado`).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { CLASSIFICACAO, EFEITOS_NUMERICOS } from '../catalogo/classes-passivas.mjs';
import { MODIFICADORES_ATRIBUTO, EVOLUCAO_PERSONAGEM } from '../catalogo/ficha-transversal.mjs';
import { modulosApp, lerClassesDados, lerConteudoLivro, RAIZ, comLacuna } from './harness.mjs';

// Achado I5 da revisão final: 4 blocos deste arquivo montavam o valor
// ESPERADO chamando `utils.calcMod`/`utils.bonusProficiencia` -- as MESMAS
// funções que `resolverPassivosTalentos`/`getEstadoRecursosPaladino`/
// `calcBonusPericia` (as funções SOB TESTE) chamam por dentro. Se
// `calcMod`/`bonusProficiencia` tivessem um bug, o esperado e o observado
// errariam do MESMO jeito, e a asserção passaria sobre um bug real -- o
// mesmo problema que o conserto irmão (`ficha-transversal.test.mjs`) já
// resolveu usando uma fonte independente do livro, transcrita à mão:
// `MODIFICADORES_ATRIBUTO`/`EVOLUCAO_PERSONAGEM`
// (`catalogo/ficha-transversal.mjs`). `modAtributoIndependente`/
// `bonusProficienciaIndependente` abaixo são essa mesma fonte, só que
// consultada aqui.
function modAtributoIndependente(valor) {
  const entrada = MODIFICADORES_ATRIBUTO.find((m) => m.valor === valor);
  assert.ok(entrada, `sanity: MODIFICADORES_ATRIBUTO não cobre o valor de atributo ${valor}`);
  return entrada.modificador;
}
function bonusProficienciaIndependente(nivel) {
  const entrada = EVOLUCAO_PERSONAGEM.find((e) => e.nivel === nivel);
  assert.ok(entrada, `sanity: EVOLUCAO_PERSONAGEM não cobre o nível ${nivel}`);
  return entrada.bonusProficiencia;
}

const { utils, criador, efeitos } = await modulosApp();
const CLASSES_DADOS = lerClassesDados();

// Módulos importados DIRETO (fora de harness.mjs/modulosApp), só para esta
// suíte -- funções de site/js/sheet/ que leem o personagem "atual" de um
// estado de módulo (site/js/sheet/estado.js), não de um parâmetro.
// O import é DINÂMICO e vem DEPOIS de `await modulosApp()` de propósito:
// combate.js grava `window.mostrarCalculoCarga` no top-level do módulo
// (linha 105) -- só existe `window` porque modulosApp() já chamou
// instalarStubs() acima; um import estático no topo deste arquivo rodaria
// antes do stub existir e quebraria com "window is not defined".
const combate = await import('../../../site/js/sheet/combate.js');
const { definirChar, definirClasseData } = await import('../../../site/js/sheet/estado.js');
const { getEstadoRecursosPaladino } = await import('../../../site/js/sheet/classes/paladino.js');
const { getEstadoRecursosGuardiao } = await import('../../../site/js/sheet/classes/guardiao.js');
const { renderSecaoMagias } = await import('../../../site/js/sheet/magias.js');
const { mostrarBuscaMagia } = await import('../../../site/js/sheet/grimorio.js');

const SITE_JS_DIR = resolve(RAIZ, 'site/js');

// Atributos "neutros" (modificador 0 em todos) para isolar, em cada teste,
// só a variável que está de fato sob varredura.
function atributosBase(overrides = {}) {
  return { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10, ...overrides };
}

// ------------------------------------------------------------
// Filtro de contaminação (mesmo compromisso de
// site/js/sheet/caracteristicas.js:14-30, e o mesmo que
// testes/regras/catalogo/classes-passivas.mjs usou para chegar às 174
// entradas de classe base -- ver task-3-report.md, "Achado prévio que
// mudou o desenho"): em 10 das 12 classes, o array de nível superior
// `caracteristicas` de dados/classes/<classe>.json vem com as
// características de TODAS as subclasses concatenadas depois das de
// classe base (373 entradas brutas contra 174 de classe base nas 12
// classes). Subtrai-se, por par (nível, nome), qualquer entrada que
// também apareça em algum `subclasses[].caracteristicas` da mesma
// classe -- sobra só classe base pura. Bárbaro e Guerreiro já vêm
// limpos (a subtração não teria efeito neles), mas passam pelo mesmo
// código -- sem ramo especial por classe, para não esconder um erro de
// filtro atrás de "essas duas eu sei que já estão limpas".
function caracteristicasDeClasseBase(classeData) {
  const chavesDeSubclasse = new Set();
  for (const sub of classeData.subclasses || []) {
    for (const f of sub.caracteristicas || []) {
      chavesDeSubclasse.add(`${f.nivel}|${f.nome}`);
    }
  }
  return (classeData.caracteristicas || [])
    .filter((f) => !chavesDeSubclasse.has(`${f.nivel}|${f.nome}`));
}

// Mapa classe -> lista de características de classe base já filtradas,
// para os 12 nomes de classe usados por CLASSIFICACAO/lerClassesDados.
const BASE_POR_CLASSE = new Map(
  [...CLASSES_DADOS.entries()].map(([nome, data]) =>
    [nome, caracteristicasDeClasseBase(data)]));

// ------------------------------------------------------------
// Sanidade do próprio filtro, ANTES de qualquer asserção sobre a
// heurística. Se isto falhar, a causa mais provável é o filtro de
// contaminação (ou uma leitura errada do catálogo) -- não 174 bugs
// novos do app. Confirma bijeção: toda entrada de CLASSIFICACAO tem
// exatamente uma característica correspondente (nível, nome) na lista
// filtrada de dados/, e a lista filtrada não tem entrada nenhuma sobrando
// que o catálogo não conheça (o que apontaria para o catálogo estar
// desatualizado, ou o filtro estar deixando passar característica de
// subclasse).
// ------------------------------------------------------------
test('filtro de contaminação: bijeção entre CLASSIFICACAO e dados/classes/*.json (classe base)', () => {
  const faltantes = []; // no catálogo, sem correspondente em dados/ filtrado
  const orfaos = [];    // em dados/ filtrado, sem correspondente no catálogo
  let totalCatalogo = 0;

  for (const [classe, entradas] of Object.entries(CLASSIFICACAO)) {
    totalCatalogo += entradas.length;
    const base = BASE_POR_CLASSE.get(classe) || [];
    for (const entrada of entradas) {
      const achou = base.some((f) => f.nivel === entrada.nivel && f.nome === entrada.nome);
      if (!achou) faltantes.push(`${classe} nível ${entrada.nivel} "${entrada.nome}"`);
    }
    for (const f of base) {
      const noCatalogo = entradas.some((e) => e.nivel === f.nivel && e.nome === f.nome);
      if (!noCatalogo) orfaos.push(`${classe} nível ${f.nivel} "${f.nome}"`);
    }
  }

  assert.equal(totalCatalogo, 174,
    `CLASSIFICACAO deveria ter 174 características de classe base ao todo, tem ${totalCatalogo}`);
  assert.deepEqual(faltantes, [],
    `entrada(s) do catálogo sem correspondente em dados/classes/*.json (classe base, ` +
    `após filtro de contaminação): ${faltantes.join('; ')}`);
  assert.deepEqual(orfaos, [],
    `característica(s) de classe base em dados/classes/*.json sem entrada no catálogo ` +
    `(filtro pode estar deixando passar característica de subclasse, ou o catálogo está ` +
    `desatualizado): ${orfaos.join('; ')}`);
});

// ------------------------------------------------------------
// As 28 divergências reais (custo-declarado/ausencia-de-custo, não
// julgamento/composta) que o motor confirmou -- ver task-4-report.md
// ("As 28 divergências, agrupadas por causa raiz") para a investigação
// completa. Registradas no nível de 7 CAUSAS DE CÓDIGO, não 28 entradas
// independentes (mesmo precedente do domínio Antecedentes, README): ler
// "28" dá impressão errada do tamanho do problema -- é um ajuste em
// ehHabilidadeAtiva()/detectarRecarga() por causa, não por par
// (classe, característica). Cada item abaixo aponta para a MESMA entrada
// de LACUNAS que as demais da sua causa (mesmo par talento/teste) -- é
// esse compartilhamento que faz 28 assert.equal apontarem para só 7
// alegações em lacunas-conhecidas.mjs.
//
// CONSEQUÊNCIA, em todas as 7: é de EXIBIÇÃO, não de regra mal aplicada --
// ehHabilidadeAtiva só decide em qual das duas seções da ficha
// ("Habilidades Ativas"/"Habilidades Passivas", site/js/sheet/
// caracteristicas.js:37-38,64-65) a característica aparece. O texto e o
// efeito da característica são idênticos nas duas seções
// (renderFeatureItem não muda o que renderiza); nenhuma outra função do
// app consulta ehHabilidadeAtiva para decidir se um bônus se aplica.
// ------------------------------------------------------------
// Chave `classe|nivel|nome` (não só `classe|nome`) DE PROPÓSITO: "Golpe
// Brutal Aprimorado" do Bárbaro aparece DUAS VEZES no catálogo (nível 13,
// Classes.md:157, e nível 17, Classes.md:171) com textos diferentes -- só a
// entrada do nível 17 diverge de fato (a frase "você pode usar dois
// efeitos diferentes de Golpe Brutal" só está lá). Uma chave sem nível
// envolveria as DUAS em comLacuna, e a do nível 13 (que já concorda com o
// catálogo) passaria a FALHAR -- comLacuna exige que o wrap falhe, e uma
// asserção que passa sob wrap de lacuna dispara "Lacuna corrigida: remova
// ...". Achado durante a primeira rodada desta tarefa (ver task-6-report.md).
// CORRIGIDO em 2026-08-18 (Plano 3 da rodada de correção): as 28 divergências
// de classificação Ativa/Passiva que este mapa hospedava fecharam com a
// reescrita de ehHabilidadeAtiva (site/js/utils.js), que passou a perguntar
// "o livro declara um CUSTO?" em vez de "alguma frase da lista aparece em
// algum lugar?". O mapa fica vazio de propósito, e não removido, porque o
// laço principal o consulta para toda característica -- e a próxima
// divergência que aparecer entra aqui, sem precisar reconstruir o mecanismo.
const CAUSA_DIVERGENCIA_ATIVO_PASSIVO = {};

// ------------------------------------------------------------
// Varredura exaustiva: uma asserção por característica de classe base,
// nas 12 classes. A descrição vem de dados/classes/<classe>.json (via o
// filtro acima); o esperado (`ativa`) vem do catálogo -- nunca da
// própria heurística, para não comparar o app consigo mesmo.
// ------------------------------------------------------------
for (const [classe, entradas] of Object.entries(CLASSIFICACAO)) {
  const base = BASE_POR_CLASSE.get(classe) || [];

  for (const entrada of entradas) {
    const { nivel, nome, ativa, base: forcaEvidencia, composta, livro, motivo } = entrada;
    // Duas razões, estruturalmente distintas, para uma entrada NÃO sustentar
    // alegação sozinha (ver cabeçalho do catálogo, seções "O campo `base`"
    // e "O campo `composta`"): 'julgamento' (o livro não declara nada) e
    // `composta: true` (o livro empacota, sob um nome só, cláusulas que
    // teriam `base` diferente se separadas -- uma discordância do app pode
    // ser só recorte diferente do mesmo parágrafo, não defeito). As duas
    // recebem o MESMO tratamento (t.skip, heurística ainda roda e registra
    // o resultado) -- daí o `||`, não um `if` por razão.
    const naoSustentaAlegacaoSozinha = forcaEvidencia === 'julgamento' || composta === true;

    test(`ehHabilidadeAtiva: ${classe} nível ${nivel} "${nome}" (${forcaEvidencia}${composta ? ', composta' : ''})`, async (t) => {
      const feature = base.find((f) => f.nivel === nivel && f.nome === nome);
      // Já confirmado pelo teste de bijeção acima, mas repetir a
      // asserção aqui (em vez de supor) é o que impede este teste de
      // comparar `undefined` contra o catálogo e falhar com uma
      // mensagem sem sentido caso a suíte rode este arquivo sozinho.
      assert.ok(feature,
        `${classe} nível ${nivel} "${nome}": sem característica correspondente em ` +
        `dados/classes/*.json (classe base, após filtro de contaminação)`);

      const atual = utils.ehHabilidadeAtiva(feature.descricao, feature.nome);

      if (naoSustentaAlegacaoSozinha) {
        // 'julgamento': o livro não declara nada aqui -- `ativa` no
        // catálogo é leitura, não fato citável.
        // `composta`: o livro mistura, sob um nome só, partes de força de
        // evidência diferente -- o app pode modelar só uma metade, ou
        // classificar pelo trecho que domina o texto, sem estar "errado"
        // no sentido que este motor consegue provar.
        // Nenhum dos dois vira lacuna sem qualificação (ver cabeçalho do
        // catálogo); ainda assim a heurística RODA e o resultado fica na
        // mensagem do skip, então nenhum caso fica escondido -- só não
        // vira uma alegação de "app errado" sem fonte.
        const bateu = atual === ativa;
        const razao = forcaEvidencia === 'julgamento' && composta
          ? 'julgamento + composta'
          : forcaEvidencia === 'julgamento' ? 'julgamento' : 'composta';
        t.skip(`${razao} (não é lacuna): heurística devolveu ${atual}, catálogo lê ${ativa} ` +
          `(${bateu ? 'coincidem' : 'divergem'}) -- ${livro}: "${motivo}"`);
        return;
      }

      const causa = CAUSA_DIVERGENCIA_ATIVO_PASSIVO[`${classe}|${nivel}|${nome}`];
      const rodarAsserção = () => assert.equal(atual, ativa,
        `${classe} nível ${nivel} "${nome}" [${forcaEvidencia}] -- livro (${livro}): "${motivo}". ` +
        `ehHabilidadeAtiva devolveu ${atual}, catálogo (transcrito do livro) diz ${ativa}. ` +
        `Consequência: exibição (seção "Habilidades Ativas"/"Habilidades Passivas" da ficha), ` +
        `não regra mal aplicada.`);
      if (causa) {
        await comLacuna(causa.talento, causa.teste, rodarAsserção);
      } else {
        rodarAsserção();
      }
    });
  }
}

// Reseta char/classeData antes de um teste que usa o estado de módulo de
// site/js/sheet/estado.js -- sem isso, classeData deixado por um teste
// anterior (ex.: a tabela do Monge) vazaria para o próximo, que pode ter
// classe diferente. As funções chamadas aqui toleram classeData nulo
// (fallback próprio, conferido lendo o código-fonte antes de usar).
function definirCharLimpo(personagem) {
  definirClasseData(null);
  definirChar(personagem);
}

// ============================================================
// STEP 1 (Task 5): efeitos NUMÉRICOS de passivas de classe base ×
// EFEITOS_NUMERICOS (testes/regras/catalogo/classes-passivas.mjs) -- cada
// entrada já foi conferida linha a linha no livro (ver cabeçalho do
// catálogo); aqui ela vira asserção contra a função do app que calcula o
// número. Varredura exaustiva do domínio de entrada relevante em cada caso
// (nível 1-20, ou toda a faixa 1-30 de um atributo), nunca amostragem.
//
// Nem toda entrada de EFEITOS_NUMERICOS tem uma função pura testável: 5 das
// 10 variantes de Estilo de Luta (Combate com Armas Grandes, Combate com
// Duas Armas, Interceptação, Luta às Cegas, Protetivo) só têm uma FLAG
// booleana em resolverPassivosTalentos, sem o número do livro em lugar
// nenhum do app -- essas ficam com t.skip (ver bloco 1i; duas delas são as
// flags mortas confirmadas no Step 2).
// ============================================================

function catalogoEfeito(classe, caracteristica) {
  const entrada = EFEITOS_NUMERICOS.find((e) => e.classe === classe && e.caracteristica === caracteristica);
  assert.ok(entrada, `sanity: EFEITOS_NUMERICOS não tem entrada para ${classe}/"${caracteristica}"`);
  return entrada;
}

// ------------------------------------------------------------
// 1a. calcCA (site/js/utils.js:144-241) -- Defesa sem Armadura
// (Bárbaro = 10+Des+Con, Monge = 10+Des+Sab), sem armadura equipada.
// Varredura: os 30 valores possíveis (1-30) de CADA atributo envolvido,
// com o outro fixado em 10 (mod. 0), para isolar a variável sob teste.
// ------------------------------------------------------------
const DEFESA_SEM_ARMADURA = [
  { classe: 'Bárbaro', atributoVariavel: 'destreza' },
  { classe: 'Bárbaro', atributoVariavel: 'constituicao' },
  { classe: 'Monge', atributoVariavel: 'destreza' },
  { classe: 'Monge', atributoVariavel: 'sabedoria' },
];

for (const { classe, atributoVariavel } of DEFESA_SEM_ARMADURA) {
  test(`calcCA: ${classe} "Defesa sem Armadura" -- varredura de ${atributoVariavel} 1-30`, () => {
    const entrada = catalogoEfeito(classe, 'Defesa sem Armadura');
    for (let valor = 1; valor <= 30; valor++) {
      const personagem = {
        classe,
        nivel: 4,
        inventario: [],
        atributos: atributosBase({ [atributoVariavel]: valor }),
      };
      const esperado = 10 + modAtributoIndependente(valor); // o outro atributo envolvido fica em 10 -> mod. 0
      const atual = utils.calcCA(personagem);
      assert.equal(atual, esperado,
        `${classe} "Defesa sem Armadura" (${entrada.livro}): "${entrada.efeito}" -- ` +
        `calcCA com ${atributoVariavel}=${valor} devolveu ${atual}, esperado ${esperado}`);
    }
  });
}

// ------------------------------------------------------------
// 1b. calcCA -- Estilo de Luta: Defensivo (+1 CA usando armadura Leve,
// Média ou Pesada). Varredura: as 3 categorias de armadura do livro, mais
// o caso sem armadura nenhuma (onde o bônus não deveria se aplicar --
// "enquanto estiver usando armadura").
// ------------------------------------------------------------
test('calcCA: Estilo de Luta "Defensivo" -- +1 CA com armadura Leve/Média/Pesada, nada sem armadura', () => {
  const entrada = catalogoEfeito('Guardião, Guerreiro, Paladino', 'Estilo de Luta: Defensivo');
  const categorias = [
    { categoria: 'Leve', ca: '11' },
    { categoria: 'Média', ca: '13' },
    { categoria: 'Pesada', ca: '16' },
  ];
  for (const { categoria, ca } of categorias) {
    const armadura = { equipado: true, tipo: 'armadura', nome: `Armadura ${categoria} de teste`, dados: { categoria, ca } };
    const semEstilo = { classe: 'Guerreiro', nivel: 4, atributos: atributosBase(), inventario: [armadura], escolhas_classe: {} };
    const comEstilo = { ...semEstilo, escolhas_classe: { estilo_luta: ['Defensivo'] } };
    const delta = utils.calcCA(comEstilo) - utils.calcCA(semEstilo);
    assert.equal(delta, 1,
      `Estilo de Luta "Defensivo" (${entrada.livro}): "${entrada.efeito}" -- armadura ${categoria}: ` +
      `delta de CA com o estilo ativo foi ${delta}, esperado 1`);
  }
  const semArmaduraSemEstilo = { classe: 'Guerreiro', nivel: 4, atributos: atributosBase(), inventario: [], escolhas_classe: {} };
  const semArmaduraComEstilo = { ...semArmaduraSemEstilo, escolhas_classe: { estilo_luta: ['Defensivo'] } };
  assert.equal(utils.calcCA(semArmaduraComEstilo), utils.calcCA(semArmaduraSemEstilo),
    `Estilo de Luta "Defensivo" (${entrada.livro}): sem armadura equipada o bônus não deveria se aplicar`);
});

// Extrai o valor numérico à esquerda de "metros" do texto que
// getDeslocamentoFinal devolve (ex.: "12 metros (Escalada 12m)").
function metrosIniciais(resultado) {
  const m = String(resultado).match(/^([\d.,]+)\s*metros/);
  assert.ok(m, `resultado de getDeslocamentoFinal em formato inesperado: "${resultado}"`);
  return parseFloat(m[1].replace(',', '.'));
}

// ------------------------------------------------------------
// 1c. getDeslocamentoFinal (site/js/sheet/combate.js:130-236) -- Bárbaro
// "Movimento Rápido" e Guardião "Errante": +3m a partir do nível do livro,
// condicionado a NÃO usar Armadura Pesada. Varredura: nível 1-20 × com/sem
// Armadura Pesada (o cruzamento é o que prova que a condição é checada, não
// só o nível).
// ------------------------------------------------------------
test('getDeslocamentoFinal: Bárbaro "Movimento Rápido" -- +3m a partir do nível 5, exceto com Armadura Pesada', () => {
  const entrada = catalogoEfeito('Bárbaro', 'Movimento Rápido');
  const pesada = { equipado: true, tipo: 'armadura', nome: 'Cota de Malha', dados: { categoria: 'Pesada' } };
  for (let nivel = 1; nivel <= 20; nivel++) {
    for (const comPesada of [false, true]) {
      definirCharLimpo({ classe: 'Bárbaro', nivel, inventario: comPesada ? [pesada] : [], atributos: atributosBase() });
      const base = metrosIniciais(combate.getDeslocamentoFinal('9'));
      const esperado = (nivel >= 5 && !comPesada) ? 12 : 9;
      assert.equal(base, esperado,
        `Bárbaro "Movimento Rápido" (${entrada.livro}): "${entrada.efeito}" -- nível ${nivel}` +
        `${comPesada ? ' com Armadura Pesada' : ''}: getDeslocamentoFinal devolveu ${base}m, esperado ${esperado}m`);
    }
  }
});

test('getDeslocamentoFinal: Guardião "Errante" -- +3m e Deslocamento de Escalada/Natação a partir do nível 6, exceto com Armadura Pesada', () => {
  const entrada = catalogoEfeito('Guardião', 'Errante');
  const pesada = { equipado: true, tipo: 'armadura', nome: 'Cota de Malha', dados: { categoria: 'Pesada' } };
  for (let nivel = 1; nivel <= 20; nivel++) {
    for (const comPesada of [false, true]) {
      definirCharLimpo({ classe: 'Guardião', nivel, inventario: comPesada ? [pesada] : [], atributos: atributosBase() });
      const resultado = combate.getDeslocamentoFinal('9');
      const base = metrosIniciais(resultado);
      const ativo = nivel >= 6 && !comPesada;
      const esperado = ativo ? 12 : 9;
      assert.equal(base, esperado,
        `Guardião "Errante" (${entrada.livro}): "${entrada.efeito}" -- nível ${nivel}` +
        `${comPesada ? ' com Armadura Pesada' : ''}: getDeslocamentoFinal devolveu ${base}m, esperado ${esperado}m`);
      assert.equal(resultado.includes(`Escalada ${esperado}m`), ativo,
        `Guardião "Errante": Deslocamento de Escalada deveria valer ${esperado}m sse ativo ` +
        `(nível ${nivel}, Armadura Pesada=${comPesada}) -- resultado: "${resultado}"`);
      assert.equal(resultado.includes(`Natação ${esperado}m`), ativo,
        `Guardião "Errante": Deslocamento de Natação deveria valer ${esperado}m sse ativo ` +
        `(nível ${nivel}, Armadura Pesada=${comPesada}) -- resultado: "${resultado}"`);
    }
  }
});

// ------------------------------------------------------------
// Monge "Movimento sem Armadura" -- o catálogo só documenta o valor BASE
// ("+3 metros... escala em níveis superiores, ver tabela"), sem os números
// exatos por nível (eles vivem numa TABELA do livro, não numa frase
// citável). Em vez de inventar os valores, este teste lê a tabela de
// Classes.md diretamente (mesmo padrão de lerConteudoLivro já usado nesta
// suíte de testes) -- o esperado continua vindo do LIVRO, nunca da função
// sob teste nem de dados/classes/monge.json (que é o que getProgressaoMonge
// realmente lê, e é o lado sob teste aqui).
// ------------------------------------------------------------
function tabelaMongeMovimentoSemArmadura() {
  const md = lerConteudoLivro('Classes.md');
  const inicio = md.indexOf('Movimento sem Armadura** |');
  assert.ok(inicio >= 0, 'sanity: não achei a tabela de progressão do Monge em Classes.md');
  // +4000 (não 3000): Classes.md usa quebra de linha \r\n -- 3000 chars
  // cortava a tabela no meio do nível 16, e o assert.equal(tabela.size, 20)
  // logo abaixo pegou exatamente isso (uma varredura silenciosa teria
  // testado só 16 dos 20 níveis sem avisar).
  const bloco = md.slice(inicio, inicio + 4000);
  const linhas = bloco.split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l));
  const mapa = new Map();
  for (const linha of linhas) {
    const colunas = linha.split('|').map((c) => c.trim()).filter(Boolean);
    const nivel = parseInt(colunas[0], 10);
    const movimento = colunas[colunas.length - 1];
    const m = movimento.match(/([\d.,]+)/);
    mapa.set(nivel, m ? parseFloat(m[1].replace(',', '.')) : 0);
  }
  return mapa;
}

test('getDeslocamentoFinal: Monge "Movimento sem Armadura" -- bônus por nível conforme a tabela de Classes.md', () => {
  const entrada = catalogoEfeito('Monge', 'Movimento sem Armadura');
  const tabela = tabelaMongeMovimentoSemArmadura();
  assert.equal(tabela.size, 20, `sanity: tabela de progressão do Monge (Classes.md) deveria ter 20 níveis, tem ${tabela.size}`);
  const classeDataMonge = CLASSES_DADOS.get('Monge');
  for (let nivel = 1; nivel <= 20; nivel++) {
    definirClasseData(classeDataMonge);
    definirChar({ classe: 'Monge', nivel, inventario: [], atributos: atributosBase() });
    const base = metrosIniciais(combate.getDeslocamentoFinal('9'));
    const bonusEsperado = tabela.get(nivel) || 0;
    assert.equal(base, 9 + bonusEsperado,
      `Monge "Movimento sem Armadura" (${entrada.livro} + tabela de Classes.md): nível ${nivel} deveria ` +
      `dar +${bonusEsperado}m, getDeslocamentoFinal devolveu ${base}m (base 9m)`);
  }
});

// ------------------------------------------------------------
// 1d. getAtaquesPorAcao (site/js/sheet/combate.js:238-251) -- Ataque Extra
// e variantes (Guerreiro tem 3 patamares). O patamar de NÍVEL vem de
// CLASSIFICACAO (já conferido contra o livro nas Tasks 3/4); a QUANTIDADE
// de ataques vem do texto de EFEITOS_NUMERICOS ("ataca N vezes") -- nenhum
// número é suposto por este teste, os dois vêm do catálogo.
// ------------------------------------------------------------
function patamaresAtaqueExtra(classe) {
  const nomes = ['Ataque Extra', 'Dois Ataques Extras', 'Três Ataques Extras'];
  const patamares = [];
  for (const nome of nomes) {
    const numerico = EFEITOS_NUMERICOS.find((e) => e.classe === classe && e.caracteristica === nome);
    if (!numerico) continue;
    const carac = (CLASSIFICACAO[classe] || []).find((c) => c.nome === nome);
    const vezes = numerico.efeito.match(/ataca (\d+) vezes/);
    patamares.push({ nome, nivel: carac?.nivel ?? null, vezes: vezes ? parseInt(vezes[1], 10) : null, numerico });
  }
  return patamares;
}

for (const classe of ['Bárbaro', 'Guardião', 'Guerreiro', 'Monge', 'Paladino']) {
  test(`getAtaquesPorAcao: ${classe} -- número de ataques por nível (1-20)`, () => {
    const patamares = patamaresAtaqueExtra(classe);
    assert.ok(patamares.length > 0, `sanity: sem patamar de Ataque Extra em EFEITOS_NUMERICOS para ${classe}`);
    for (const p of patamares) {
      assert.ok(p.nivel !== null, `sanity: "${p.nome}" (${classe}) sem nível correspondente em CLASSIFICACAO`);
      assert.ok(p.vezes !== null, `sanity: efeito "${p.numerico.efeito}" (${classe}/${p.nome}) não bate no formato "ataca N vezes"`);
    }
    const ordenados = [...patamares].sort((a, b) => a.nivel - b.nivel);
    for (let nivel = 1; nivel <= 20; nivel++) {
      let esperado = 1;
      for (const p of ordenados) if (nivel >= p.nivel) esperado = p.vezes;
      definirCharLimpo({ classe, nivel, atributos: atributosBase() });
      const atual = combate.getAtaquesPorAcao();
      assert.equal(atual, esperado,
        `${classe} nível ${nivel}: getAtaquesPorAcao devolveu ${atual}, esperado ${esperado} ` +
        `(patamares: ${ordenados.map((p) => `${p.nome}@nv${p.nivel}->${p.vezes}x [${p.numerico.livro}]`).join(', ')})`);
    }
  });
}

// ------------------------------------------------------------
// 1e. calcCDMagia (site/js/utils.js:244-257) -- Feitiçaria Inata: CD +1
// enquanto ativa. O catálogo também descreve "Vantagem nas jogadas de
// ataque de magia" e "2 usos, recarga em Descanso Longo", mas nenhuma
// função do app expõe essas duas partes como um NÚMERO (Vantagem não é
// numérica; usos/recarga não têm getter próprio) -- confronto restrito à
// parte numérica que de fato existe no app: o +1 de CD.
// ------------------------------------------------------------
test('calcCDMagia: Feiticeiro "Feitiçaria Inata" -- CD +1 quando ativa, varredura de nível (1-20) e Carisma (1-30)', () => {
  const entrada = catalogoEfeito('Feiticeiro', 'Feitiçaria Inata');
  for (let nivel = 1; nivel <= 20; nivel++) {
    for (const ativa of [false, true]) {
      const personagem = {
        classe: 'Feiticeiro', nivel,
        atributos: atributosBase({ carisma: 16 }),
        recursos: { feiticeiro: { feiticaria_inata_ativa: ativa } },
      };
      const esperado = 8 + bonusProficienciaIndependente(nivel) + modAtributoIndependente(16) + (ativa ? 1 : 0);
      const atual = utils.calcCDMagia(personagem);
      assert.equal(atual, esperado,
        `Feiticeiro "Feitiçaria Inata" (${entrada.livro}): "${entrada.efeito}" -- nível ${nivel}, ` +
        `ativa=${ativa}: calcCDMagia devolveu ${atual}, esperado ${esperado}`);
    }
  }
  for (let carisma = 1; carisma <= 30; carisma++) {
    for (const ativa of [false, true]) {
      const personagem = {
        classe: 'Feiticeiro', nivel: 5,
        atributos: atributosBase({ carisma }),
        recursos: { feiticeiro: { feiticaria_inata_ativa: ativa } },
      };
      const esperado = 8 + bonusProficienciaIndependente(5) + modAtributoIndependente(carisma) + (ativa ? 1 : 0);
      const atual = utils.calcCDMagia(personagem);
      assert.equal(atual, esperado,
        `Feiticeiro "Feitiçaria Inata" (${entrada.livro}): carisma=${carisma}, ativa=${ativa}: ` +
        `calcCDMagia devolveu ${atual}, esperado ${esperado}`);
    }
  }
});

// ------------------------------------------------------------
// 1f. calcBonusPericia (site/js/utils.js:293-342)
// ------------------------------------------------------------
test('calcBonusPericia: Bardo "Pau pra Toda Obra" -- metade do Bônus de Proficiência (sem prof./expertise), a partir do nível 2', () => {
  const entrada = catalogoEfeito('Bardo', 'Pau pra Toda Obra');
  for (let nivel = 1; nivel <= 20; nivel++) {
    const personagem = {
      classe: 'Bardo', nivel,
      atributos: atributosBase(),
      pericias_proficientes: [], pericias_expertise: [],
    };
    const esperado = modAtributoIndependente(10) + (nivel >= 2 ? Math.floor(bonusProficienciaIndependente(nivel) / 2) : 0);
    const atual = utils.calcBonusPericia(personagem, 'Acrobacia');
    assert.equal(atual, esperado,
      `Bardo "Pau pra Toda Obra" (${entrada.livro}): "${entrada.efeito}" -- nível ${nivel}: ` +
      `calcBonusPericia(Acrobacia) devolveu ${atual}, esperado ${esperado}`);
  }
});

const ORDEM_TAUMATURGICA = [
  { classe: 'Clérigo', campo: 'ordem_divina', valor: 'Taumaturgo', pericias: ['Arcanismo', 'Religião'], caracteristica: 'Ordem Divina (Taumaturgo)' },
  { classe: 'Druida', campo: 'ordem_primal', valor: 'Xamã', pericias: ['Arcanismo', 'Natureza'], caracteristica: 'Ordem Primal (Xamã)' },
];

for (const { classe, campo, valor, pericias, caracteristica } of ORDEM_TAUMATURGICA) {
  test(`calcBonusPericia: ${classe} "${caracteristica}" -- bônus = mod. Sabedoria (mínimo +1), varredura de Sabedoria 1-30`, () => {
    const entrada = catalogoEfeito(classe, caracteristica);
    for (let sabedoria = 1; sabedoria <= 30; sabedoria++) {
      const personagem = {
        classe, nivel: 4,
        [campo]: valor,
        atributos: atributosBase({ sabedoria }),
        pericias_proficientes: [], pericias_expertise: [],
      };
      const esperadoBonus = Math.max(1, modAtributoIndependente(sabedoria));
      for (const pericia of pericias) {
        const atual = utils.calcBonusPericia(personagem, pericia);
        assert.equal(atual, esperadoBonus,
          `${classe} "${caracteristica}" (${entrada.livro}): "${entrada.efeito}" -- Sabedoria=${sabedoria}, ` +
          `${pericia}: calcBonusPericia devolveu ${atual}, esperado ${esperadoBonus}`);
      }
      // Uma perícia FORA da lista do livro (mesmo atributo de conjuração,
      // Inteligência) não deveria ganhar o bônus -- confirma que o efeito é
      // restrito às perícias nomeadas, não a "qualquer perícia de Inteligência".
      const foraDaLista = utils.calcBonusPericia(personagem, 'História');
      assert.equal(foraDaLista, 0,
        `${classe} "${caracteristica}": História não está na lista do livro (${pericias.join('/')}) ` +
        `e não deveria ganhar o bônus -- calcBonusPericia devolveu ${foraDaLista}`);
    }
  });
}

// ------------------------------------------------------------
// 1g. getEstadoRecursosPaladino (site/js/sheet/classes/paladino.js:22-87)
// -- Aura de Proteção: bônus em salvaguardas = mod. Carisma (mínimo +1).
// Função fora da lista de 7 do brief, mas é a que o app usa de fato para
// este número (nenhuma das 7 calcula isso) -- sem ela esta entrada do
// catálogo ficaria sem confronto nenhum.
// ------------------------------------------------------------
test('getEstadoRecursosPaladino: "Aura de Proteção" -- bônus = mod. Carisma (mínimo +1), varredura de Carisma 1-30', () => {
  const entrada = catalogoEfeito('Paladino', 'Aura de Proteção');
  for (let carisma = 1; carisma <= 30; carisma++) {
    definirCharLimpo({ classe: 'Paladino', nivel: 6, atributos: atributosBase({ carisma }) });
    const estado = getEstadoRecursosPaladino();
    const esperado = Math.max(1, modAtributoIndependente(carisma));
    assert.equal(estado.bonusAura, esperado,
      `Paladino "Aura de Proteção" (${entrada.livro}): "${entrada.efeito}" -- Carisma=${carisma}: ` +
      `getEstadoRecursosPaladino().bonusAura devolveu ${estado.bonusAura}, esperado ${esperado}`);
  }
});

// ------------------------------------------------------------
// 1h. getEstadoRecursosGuardiao (site/js/sheet/classes/guardiao.js:19-97)
// -- Véu da Natureza: usos máximos = mod. Sabedoria (mínimo 1). Mesma
// observação da 1g: função fora da lista de 7, mas é a que calcula este
// número de fato.
// ------------------------------------------------------------
test('getEstadoRecursosGuardiao: "Véu da Natureza" -- usos máx. = mod. Sabedoria (mínimo 1), varredura de Sabedoria 1-30', () => {
  const entrada = catalogoEfeito('Guardião', 'Véu da Natureza');
  for (let sabedoria = 1; sabedoria <= 30; sabedoria++) {
    definirCharLimpo({ classe: 'Guardião', nivel: 14, atributos: atributosBase({ sabedoria }) });
    const estado = getEstadoRecursosGuardiao();
    const esperado = Math.max(1, modAtributoIndependente(sabedoria));
    assert.equal(estado.veuNaturezaMax, esperado,
      `Guardião "Véu da Natureza" (${entrada.livro}): "${entrada.efeito}" -- Sabedoria=${sabedoria}: ` +
      `getEstadoRecursosGuardiao().veuNaturezaMax devolveu ${estado.veuNaturezaMax}, esperado ${esperado}`);
  }
});

// ------------------------------------------------------------
// 1i. resolverPassivosTalentos (site/js/talentos-effects.js:47-418) -- os
// 4 estilos cujo efeito do livro aparece como um NÚMERO (ou dado) num campo
// próprio. Defensivo já foi testado em 1b (via calcCA); os outros 5
// (Combate com Armas Grandes, Combate com Duas Armas, Interceptação, Luta
// às Cegas, Protetivo) não têm campo numérico em resolverPassivosTalentos
// -- ver t.skip abaixo.
// ------------------------------------------------------------
const ESTILOS_CANONICOS = EFEITOS_NUMERICOS
  .filter((e) => e.caracteristica.startsWith('Estilo de Luta: '))
  .map((e) => e.caracteristica.replace('Estilo de Luta: ', ''));

// ATUALIZADO NA TASK 7 (2026-08-07, correção de
// 'classes-passivas-vocabulario-estilo'): antes desta rodada, o nome GRAVADO
// pelo seletor (comum.js) divergia do CANÔNICO (talentos.json/livro) para 4
// dos 10 estilos ("Arremesso", "Armas Grandes", "Duas Armas", "Desarmado"), e
// este mapa capturava essa correspondência pré-correção -- era a mesma
// normalização que getEstiloAtivo (talentos-effects.js) usava para os
// efeitos NUMÉRICOS não sofrerem disso. A Task 7 unificou o vocabulário: o
// seletor agora grava o nome canônico direto (creator/comum.js,
// CLASSES_ESCOLHAS.<classe>.estilo_luta.opcoes), então GRAVADO === CANÔNICO
// para escolhas novas -- por isso a identidade abaixo. A correspondência
// antiga não desapareceu do app: virou normalizarEstiloLuta (exportada de
// talentos-effects.js), camada de compatibilidade só para fichas SALVAS
// antes da Task 7. Este teste confronta as OPÇÕES QUE O SELETOR OFERECE a um
// jogador novo agora, então não precisa (e não deve) passar por aquela
// tradução de compatibilidade.
const CANONICO_PARA_GRAVADO = {
  'Arquearia': 'Arquearia',
  'Combate com Armas de Arremesso': 'Combate com Armas de Arremesso',
  'Combate com Armas Grandes': 'Combate com Armas Grandes',
  'Combate com Duas Armas': 'Combate com Duas Armas',
  'Combate Desarmado': 'Combate Desarmado',
  'Defensivo': 'Defensivo',
  'Duelismo': 'Duelismo',
  'Interceptação': 'Interceptação',
  'Luta às Cegas': 'Luta às Cegas',
  'Protetivo': 'Protetivo',
};

const CAMPO_NUMERICO_ESTILO = {
  'Arquearia': { campo: 'bonusAtaqueDistancia', regex: /\+(\d+)/, tipo: 'numero' },
  'Combate com Armas de Arremesso': { campo: 'bonusDanoArremesso', regex: /\+(\d+)/, tipo: 'numero' },
  'Duelismo': { campo: 'bonusDanoUmaMao', regex: /\+(\d+)/, tipo: 'numero' },
  'Combate Desarmado': { campo: 'bonusDanoDesarmado', regex: /dano Contundente (\d+d\d+)/, tipo: 'string' },
};

const FLAG_ESTILO_SEM_NUMERO = {
  'Combate com Armas Grandes': 'estilo_armas_grandes',
  'Combate com Duas Armas': 'estilo_duas_armas',
  'Interceptação': 'estilo_interceptacao',
  'Luta às Cegas': 'estilo_luta_cegas_3m',
  'Protetivo': 'estilo_protetivo',
};

for (const canonico of ESTILOS_CANONICOS.filter((c) => c !== 'Defensivo')) {
  const entrada = catalogoEfeito('Guardião, Guerreiro, Paladino', `Estilo de Luta: ${canonico}`);
  const gravado = CANONICO_PARA_GRAVADO[canonico];
  const spec = CAMPO_NUMERICO_ESTILO[canonico];

  test(`resolverPassivosTalentos: Estilo de Luta "${canonico}" -- efeito numérico`, (t) => {
    if (!spec) {
      const flag = FLAG_ESTILO_SEM_NUMERO[canonico];
      t.skip(`"${canonico}" não tem campo numérico em resolverPassivosTalentos -- só a flag booleana ` +
        `passivos.flags.${flag}, sem consumidor em site/js/ (mesmo padrão do Step 2; ` +
        `estilo_armas_grandes/estilo_duas_armas são as duas confirmadas nesta tarefa, ver testes ` +
        `"flag sem consumidor" abaixo). Efeito do livro (${entrada.livro}): "${entrada.efeito}".`);
      return;
    }
    const m = entrada.efeito.match(spec.regex);
    assert.ok(m, `sanity: efeito "${entrada.efeito}" não bate no formato esperado para extrair o número/dado`);
    const esperado = spec.tipo === 'string' ? m[1] : parseInt(m[1], 10);

    // Ativa só o estilo sob teste e confirma tanto o campo esperado quanto
    // a ausência de bleed-over nos outros 3 campos numéricos de estilo.
    const char = { classe: 'Guerreiro', nivel: 5, talentos: [], escolhas_classe: { estilo_luta: [gravado] } };
    const passivos = efeitos.resolverPassivosTalentos(char);
    assert.equal(passivos[spec.campo], esperado,
      `Estilo de Luta "${canonico}" (${entrada.livro}): "${entrada.efeito}" -- ` +
      `resolverPassivosTalentos().${spec.campo} devolveu ${JSON.stringify(passivos[spec.campo])}, ` +
      `esperado ${JSON.stringify(esperado)}`);

    const outrosCampos = { bonusAtaqueDistancia: 0, bonusDanoArremesso: 0, bonusDanoUmaMao: 0, bonusDanoDesarmado: null };
    delete outrosCampos[spec.campo];
    for (const [campo, baseline] of Object.entries(outrosCampos)) {
      assert.equal(passivos[campo], baseline,
        `Estilo de Luta "${canonico}" ativo não deveria alterar ${campo} (devolveu ` +
        `${JSON.stringify(passivos[campo])}, esperado baseline ${JSON.stringify(baseline)})`);
    }
  });
}

// ============================================================
// STEP 2 (Task 5, redigido de novo na revisão da Task 6): flag declarada
// sem consumidor.
//
// IMPORTANTE: este bloco afirma um fato sobre o CÓDIGO -- "X é gravado em
// site/js/talentos-effects.js e nenhum outro arquivo de site/js/ o lê" --
// não uma alegação sobre o livro. Uma flag sem consumidor SÓ vira lacuna
// quando o livro descreve um efeito mecânico real para ela E nenhum OUTRO
// mecanismo já cumpre esse efeito (senão seria código morto, sem
// consequência para o personagem -- foi exatamente esse segundo caso que
// uma revisão pegou em `extras_classe`, ver mais abaixo). Dois casos
// restam nesta categoria, com a citação do livro RELIDA do livro (não da
// string que a própria ficha usa para exibir o efeito -- essa era a
// origem do erro que uma revisão corrigiu aqui):
//   - estilo_armas_grandes: o livro (Talentos.md:764) manda TRATAR
//     qualquer 1 ou 2 num dado de dano COMO UM 3 (regra de 2024) -- a
//     redação anterior desta entrada dizia "re-rolar", que é a regra de
//     2014 (mecânica diferente), copiada da string que a ficha exibe
//     (habilidades.js:4638), não do livro.
//   - estilo_duas_armas: o livro (Talentos.md:770) concede o modificador
//     de atributo a "um ataque adicional... resultante de usar uma arma
//     com a propriedade Leve", com a ressalva "se já não estiver
//     adicionando-o ao dano" -- a redação anterior falava em "mão
//     secundária" (copiada de comum.js/habilidades.js) e sugeria a
//     existência de um cálculo de "ataque de mão secundária" que não
//     existe em lugar nenhum do app.
//
// Busca de consumidor: procurei o nome exato (identificador OU string
// literal) em TODO arquivo .js de site/js/ (61 arquivos, inclusive
// site/js/vendor/), exceto o(s) arquivo(s) que grava(m) o valor -- isso
// cobre tanto `passivos.flags.estilo_armas_grandes` quanto desestruturação
// (`const { estilo_armas_grandes } = passivos.flags`) e indexação por uma
// variável que CONTENHA a string ('estilo_armas_grandes'), porque o nome
// apareceria como literal em algum lugar do código-fonte de qualquer forma.
// O único caso que este grep não pega é uma chave montada por concatenação
// em tempo de execução (`'estilo_' + 'armas_grandes'`) -- não encontrei
// nenhum caso assim ao ler talentos-effects.js inteiro e os únicos arquivos
// que hoje leem `passivosTalentosCache.flags.*` (site/js/sheet/ficha.js,
// que só lê `.flags.sortudo`, e site/js/sheet/maestrias.js, que só lê
// `.flags.mestre_armas_maestria_extra` -- as DUAS ÚNICAS flags com
// consumidor em todo o app).
// ============================================================

function listarArquivosJs(dir) {
  const resultado = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) resultado.push(...listarArquivosJs(caminho));
    else if (entrada.name.endsWith('.js')) resultado.push(caminho);
  }
  return resultado;
}

const TALENTOS_EFFECTS_PATH = resolve(SITE_JS_DIR, 'talentos-effects.js');
const TALENTOS_EFFECTS_SRC = readFileSync(TALENTOS_EFFECTS_PATH, 'utf-8');

// Nomes REALMENTE gravados em passivos.flags.<nome> = true, extraídos do
// código-fonte (não hardcoded) -- se a linha mudar de número, o teste
// continua valendo.
const FLAGS_GRAVADAS = [...TALENTOS_EFFECTS_SRC.matchAll(/passivos\.flags\.(\w+)\s*=\s*true/g)]
  .map((m) => m[1]);

// Remove comentários de bloco (/* ... */) e de linha (// ...) antes da
// busca textual -- correção de um Minor apontado na revisão da Task 5:
// sem isso, temConsumidor contava uma MENÇÃO em comentário como consumidor
// real. Caso concreto achado pelo revisor: 'mestre_armas_maestria_extra'
// aparece primeiro num comentário de site/js/regras-cobertura.js:521
// ("...separadamente pela flag mestre_armas_maestria_extra..."), antes do
// consumidor de fato em site/js/sheet/maestrias.js:21 -- sem este filtro,
// o teste passaria mesmo que maestrias.js fosse apagado, desde que o
// comentário sobrevivesse. Provado por experimento (task-6-report.md):
// comentando temporariamente a linha 21 de maestrias.js, a versão SEM este
// filtro continuava devolvendo `true` (falso positivo via o comentário de
// regras-cobertura.js:521); com o filtro, devolve `false` -- a busca
// enxerga a ausência do consumidor de verdade.
//
// Heurística textual, não um parser -- e o RISCO dessa heurística vive nos
// 61 ARQUIVOS BUSCADOS por temConsumidor (qualquer um deles pode ter um
// `/*` dentro de uma string -- ex.: um atributo HTML `accept="image/*"`,
// ou uma URL com `/*` -- que a regex não sabe distinguir de um comentário
// de bloco de verdade), não nos arquivos ESCRITORES (que são só excluídos
// da busca, por outro motivo). Um `/*` "falso" desse tipo faz a regex
// engolir tudo até o PRÓXIMO `*/` real, mesmo que isso inclua código
// legítimo no meio -- caso raro, documentado e testado abaixo
// (`removerComentarios: falso-negativo conhecido`), não corrigido nesta
// rodada (exigiria um tokenizer de verdade, fora de escopo para uma busca
// textual auxiliar). Nenhum dos nomes de flag testados nesta suíte colide
// com esse padrão (conferido lendo os arquivos buscados).
function removerComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

test('removerComentarios: remove bloco e linha, preserva código real ao redor', () => {
  const entrada = [
    'const a = 1; // comentário de linha',
    '/* comentário',
    'de várias linhas */',
    'const b = passivos.flags.minha_flag;',
  ].join('\n');
  const limpo = removerComentarios(entrada);
  assert.ok(!limpo.includes('comentário de linha'), 'comentário de linha deveria sumir');
  assert.ok(!limpo.includes('de várias linhas'), 'comentário de bloco deveria sumir');
  assert.ok(limpo.includes('const a = 1;'), 'código antes do comentário de linha deveria sobreviver');
  assert.ok(limpo.includes('const b = passivos.flags.minha_flag;'),
    'código depois do comentário de bloco deveria sobreviver');
});

test('removerComentarios: falso-negativo conhecido -- "/*" dentro de string engole código real até o próximo "*/"', () => {
  // Documenta, por experimento (não só por comentário), o limite descrito
  // acima: um `/*` que na verdade está dentro de uma STRING (aqui,
  // "image/*", o mesmo formato de um atributo `accept`) não é distinguido
  // de um comentário de bloco real -- a regex apaga tudo até o PRÓXIMO
  // `*/`, mesmo que isso inclua uma referência real a uma flag no meio.
  const entrada = [
    'input.accept = "image/*";',
    'const usoRealDaFlag = passivos.flags.minha_flag_de_teste;',
    '/* comentário real, sem relação com a flag */',
  ].join('\n');
  const limpo = removerComentarios(entrada);
  // Comportamento ATUAL (o falso-negativo): o trecho entre a string
  // "image/*" e o primeiro "*/" real -- que inclui a linha do consumidor
  // de verdade -- desaparece junto.
  assert.ok(!limpo.includes('usoRealDaFlag'),
    'este teste documenta o falso-negativo conhecido: se ele começar a falhar (a linha voltar a ' +
    'aparecer em `limpo`), o comportamento de removerComentarios mudou -- reavalie se este aviso ' +
    'ainda é necessário no comentário acima do helper');
});

// Verdadeiro se `nome` aparece em algum arquivo .js de site/js/ FORA de
// `arquivosEscritores` -- identificador ou string literal, ambos batem
// porque a busca é textual pelo nome exato (ver nota acima sobre o que
// isso cobre e o que não cobre), e fora de comentário (ver
// removerComentarios acima).
function temConsumidor(nome, arquivosEscritores) {
  const limite = new RegExp(`\\b${nome}\\b`);
  for (const arquivo of listarArquivosJs(SITE_JS_DIR)) {
    if (arquivosEscritores.has(arquivo)) continue;
    const semComentarios = removerComentarios(readFileSync(arquivo, 'utf-8'));
    if (limite.test(semComentarios)) return true;
  }
  return false;
}

const FLAGS_MORTAS_COM_EFEITO_NO_LIVRO = [
  { nome: 'estilo_armas_grandes', livro: 'Talentos.md:764',
    efeito: 'tratar qualquer 1 ou 2 num dado de dano de arma de duas mãos como um 3 (regra de 2024 -- ' +
      'não "re-rolar", que é a regra de 2014)',
    teste: 'classes-passivas-flag-armas-grandes' },
  { nome: 'estilo_duas_armas', livro: 'Talentos.md:770',
    efeito: 'somar o modificador de atributo ao dano de um ataque adicional resultante do uso de uma ' +
      'arma Leve, se já não estiver somando',
    teste: 'classes-passivas-flag-duas-armas' },
];

for (const { nome, livro, efeito, teste } of FLAGS_MORTAS_COM_EFEITO_NO_LIVRO) {
  test(`flag sem consumidor: passivos.flags.${nome} (talentos-effects.js) nunca é lido em site/js/`, async () => {
    assert.ok(FLAGS_GRAVADAS.includes(nome),
      `sanity: "${nome}" não foi extraído de talentos-effects.js -- a regex de extração pode ter ` +
      `deixado de bater (a linha que grava a flag mudou de forma?)`);
    // I1 (revisão da Task 6): a MEDIÇÃO (temConsumidor) roda FORA de
    // comLacuna -- só a asserção entra no wrap. Uma versão anterior deste
    // teste chamava temConsumidor(...) DENTRO do wrap: se a própria
    // maquinaria de busca quebrasse (ex.: um `throw` acidental dentro de
    // temConsumidor), o `catch` de comLacuna engoliria o erro e o leria
    // como "falha esperada -- lacuna confirmada", quando na verdade
    // nenhuma medição real tinha acontecido. Ver classes-trocas.test.mjs
    // (que já fazia certo) para o mesmo padrão.
    const consumida = temConsumidor(nome, new Set([TALENTOS_EFFECTS_PATH]));
    await comLacuna('Guerreiro', teste, () => {
      assert.ok(consumida,
        `passivos.flags.${nome} é gravado em site/js/talentos-effects.js mas não é lido em nenhum ` +
        `outro arquivo de site/js/ -- fato sobre o CÓDIGO (não sobre o livro). Isso é uma lacuna real ` +
        `porque o livro (${livro}) descreve um efeito mecânico para o estilo: ${efeito}.`);
    });
  });
}

// ------------------------------------------------------------
// O bônus de truque do Taumaturgo/Xamã -- achado real por trás do que uma
// primeira redação chamava, errado, de "extras_classe sem consumidor"
// (corrigido na revisão da Task 6, ver lacunas-conhecidas.mjs e
// task-6-report.md). `extras_classe` em si é código morto (o app já cumpre
// o livro por outro caminho -- não vira teste aqui, pelo mesmo critério que
// abre o bloco Step 2: flag/campo sem consumidor só é lacuna quando NENHUM
// mecanismo cumpre o livro).
//
// ANTES DA TASK 7 (2026-08-07): o CRIADOR aplicava o bônus corretamente
// (creator/passo-magias.js:54-56 e creator/wizard.js:330-332 somavam +1 a
// numTruques/truquesNecessarios via um `if` escrito à mão), mas a FICHA e a
// SUBIDA DE NÍVEL não -- sheet/grimorio.js:27, sheet/magias.js:399 e
// levelup-flow.js:93-94 chamavam getTruquesConhecidos() para um limite
// mostrado/validado ao jogador e nunca somavam o bônus.
//
// DEPOIS DA TASK 7: a regra foi centralizada em getBonusTruquesOrdem
// (utils.js), seguindo a lição de GUIA-PROXIMOS-DOMINIOS.md ("A lição da
// rodada de correção") -- os 5 fluxos chamam a mesma função em vez de cada
// um reimplementar o `if`. O bloco de asserções logo abaixo (I1, revisão de
// tier alto pós-Task-7) prova o que a função DEVOLVE, não só que existe uma
// chamada -- sem isso, um `getBonusTruquesOrdem` que sempre devolvesse 0
// passaria despercebido por qualquer teste aqui (confirmado por
// experimento: o revisor inseriu `if (personagem) return 0;` no topo da
// função real e a suíte inteira ficou verde antes desta correção).
// ------------------------------------------------------------

// I1 (revisão pós-Task-7): confronta o RETORNO de getBonusTruquesOrdem
// contra o livro (Classes.md:1568/2060, +1 truque para Clérigo/Taumaturgo e
// Druida/Xamã), nos dois formatos em que o app grava a ordem escolhida
// (campo direto -- usado pela ficha/subida de nível -- e escolhas_classe --
// usado durante a criação, antes de "consolidar" no campo direto) e em
// casos negativos (ordem errada, classe errada, sem personagem). Sem este
// bloco, `aplicaBonusTruqueTaumaturgo` só prova que os 5 arquivos CHAMAM a
// função -- nunca que ela faz a coisa certa.
test('getBonusTruquesOrdem: Clérigo/Taumaturgo devolve 1 (campo direto)', () => {
  assert.equal(utils.getBonusTruquesOrdem({ classe: 'Clérigo', ordem_divina: 'Taumaturgo' }), 1);
});
test('getBonusTruquesOrdem: Clérigo/Taumaturgo devolve 1 (via escolhas_classe, formato do criador)', () => {
  assert.equal(utils.getBonusTruquesOrdem({ classe: 'Clérigo', escolhas_classe: { ordem_divina: ['Taumaturgo'] } }), 1);
});
test('getBonusTruquesOrdem: Druida/Xamã devolve 1 (campo direto)', () => {
  assert.equal(utils.getBonusTruquesOrdem({ classe: 'Druida', ordem_primal: 'Xamã' }), 1);
});
test('getBonusTruquesOrdem: Druida/Xamã devolve 1 (via escolhas_classe, formato do criador)', () => {
  assert.equal(utils.getBonusTruquesOrdem({ classe: 'Druida', escolhas_classe: { ordem_primal: ['Xamã'] } }), 1);
});
test('getBonusTruquesOrdem: Clérigo/Protetor (ordem errada) devolve 0', () => {
  assert.equal(utils.getBonusTruquesOrdem({ classe: 'Clérigo', ordem_divina: 'Protetor' }), 0);
});
test('getBonusTruquesOrdem: Druida/Protetor (ordem errada) devolve 0', () => {
  assert.equal(utils.getBonusTruquesOrdem({ classe: 'Druida', ordem_primal: 'Protetor' }), 0);
});
test('getBonusTruquesOrdem: classe sem essa ordem (Guerreiro) devolve 0', () => {
  assert.equal(utils.getBonusTruquesOrdem({ classe: 'Guerreiro' }), 0);
});
test('getBonusTruquesOrdem: sem personagem devolve 0 (guarda contra null/undefined)', () => {
  assert.equal(utils.getBonusTruquesOrdem(null), 0);
  assert.equal(utils.getBonusTruquesOrdem(undefined), 0);
});
const PASSO_MAGIAS_PATH = resolve(SITE_JS_DIR, 'creator/passo-magias.js');
const WIZARD_PATH = resolve(SITE_JS_DIR, 'creator/wizard.js');
const GRIMORIO_PATH = resolve(SITE_JS_DIR, 'sheet/grimorio.js');
const MAGIAS_PATH = resolve(SITE_JS_DIR, 'sheet/magias.js');
const LEVELUP_FLOW_PATH = resolve(SITE_JS_DIR, 'levelup-flow.js');

// Verdadeiro se o arquivo aplica o bônus de truque do Taumaturgo/Xamã.
//
// ATUALIZADO NA TASK 7 (2026-08-07): a versão original desta função media
// presença literal de "Taumaturgo" e "Xamã" no arquivo -- correto enquanto
// cada um dos 5 fluxos tinha sua PRÓPRIA cópia manual do `if
// (classe==='Clérigo' && ordem_divina==='Taumaturgo') += 1`. A correção
// desta lacuna seguiu a lição de GUIA-PROXIMOS-DOMINIOS.md ("A lição da
// rodada de correção"): em vez de copiar a checagem mais uma vez para os 3
// fluxos que faltavam, moveu a regra para um lugar único que os 5 já podem
// chamar -- getBonusTruquesOrdem (utils.js), a única função que hoje
// menciona "Taumaturgo"/"Xamã" em código real. Com a regra centralizada,
// medir "cita Taumaturgo/Xamã" deixou de distinguir quem aplica o bônus de
// quem não aplica -- todos os 5 arquivos deixam de citar os nomes das
// ordens; o que os distingue agora é CHAMAR ou NÃO getBonusTruquesOrdem(.
function aplicaBonusTruqueTaumaturgo(caminho) {
  const src = readFileSync(caminho, 'utf-8');
  const semComentarios = removerComentarios(src);
  return /getBonusTruquesOrdem\s*\(/.test(semComentarios);
}

test('sanity: o criador (passo-magias.js e wizard.js) aplica o bônus de truque do Taumaturgo/Xamã', () => {
  for (const caminho of [PASSO_MAGIAS_PATH, WIZARD_PATH]) {
    assert.ok(aplicaBonusTruqueTaumaturgo(caminho),
      `${caminho} deveria mencionar Taumaturgo e Xamã (o ramo de bônus de truque, ` +
      `creator/passo-magias.js:54-62 é a referência) -- se isto falhar, o CRIADOR parou de aplicar ` +
      `o bônus certo, e a asserção de divergência abaixo (que assume o criador como referência ` +
      `correta) perde o sentido.`);
  }
});

// Achado I1 da revisão final: `aplicaBonusTruqueTaumaturgo` (acima) é uma
// varredura TEXTUAL -- ela procura `getBonusTruquesOrdem(` no código-fonte,
// sem rodar nada. Isso não distingue "aplica o bônus certo" de "chama a
// função e descarta o resultado": o revisor reproduziu isso ao vivo trocando
// `maxTruq += getBonusTruquesOrdem(char);` por
// `maxTruq += 0 * getBonusTruquesOrdem(char);` em sheet/magias.js -- a
// chamada continua existindo textualmente (a regex ainda casa), mas o bônus
// numérico sumiu, e a suíte inteira ficava verde. A asserção abaixo fecha
// esse buraco chamando `renderSecaoMagias()` de verdade (não lendo o
// código-fonte) com um Clérigo Protetor e um Clérigo Taumaturgo -- mesmo
// nível, mesma classeData real (`db.getClasse`, via `CLASSES_DADOS`) -- e
// comparando o limite de truques NUMÉRICO extraído do HTML devolvido
// (`<span class="contador-valor">X / Y</span>`, sheet/magias.js:488). Se o
// bônus for neutralizado por qualquer meio (multiplicado por zero, `if`
// invertido, etc.), esta asserção acusa porque o NÚMERO não bate — não
// porque um padrão de texto sumiu.
function extrairLimiteTruques(html) {
  const m = html.match(/<span class="contador-valor">(\d+)\s*\/\s*(\d+)<\/span>/);
  assert.ok(m, 'sanity: não achei o contador "X / Y" de truques no HTML de renderSecaoMagias()');
  return parseInt(m[2], 10);
}

test('numérico: renderSecaoMagias() aplica de fato +1 truque para Clérigo Taumaturgo (não só cita a função)', () => {
  const classeDataClerigo = CLASSES_DADOS.get('Clérigo');
  const personagemBase = {
    classe: 'Clérigo', nivel: 4, ordem_divina: 'Protetor',
    atributos: atributosBase(), magias_conhecidas: [], magias_preparadas: [],
    espacos_magia: {}, grimorio: [], magias_customizadas: [],
  };

  definirClasseData(classeDataClerigo);
  definirChar({ ...personagemBase, ordem_divina: 'Protetor' });
  const limiteSemBonus = extrairLimiteTruques(renderSecaoMagias());

  definirChar({ ...personagemBase, ordem_divina: 'Taumaturgo' });
  const limiteComBonus = extrairLimiteTruques(renderSecaoMagias());

  assert.equal(limiteComBonus, limiteSemBonus + 1,
    `Clérigo Taumaturgo (Classes.md:1568) deveria ter +1 truque no limite mostrado pela ficha em ` +
    `relação a Protetor -- Protetor: ${limiteSemBonus}, Taumaturgo: ${limiteComBonus}. Se os dois ` +
    `números baterem, o bônus de sheet/magias.js foi neutralizado (ex.: multiplicado por 0) sem que ` +
    `a varredura textual de aplicaBonusTruqueTaumaturgo percebesse.`);
});

// Achado N1 da re-revisão: o teste numérico acima só chama `renderSecaoMagias()`
// (sheet/magias.js). O comentário logo abaixo (IMPORTANTE, revisão pós-Task-7)
// já nomeia DOIS arquivos com comportamento observável -- sheet/magias.js E
// sheet/grimorio.js (o contador "Truques: X/Y" do modal "Gerenciar Magias" e
// o bloqueio de troca) -- mas só o primeiro tinha prova numérica. Confirmado
// ao vivo pelo revisor: `maxTruq += 0 * getBonusTruquesOrdem(char)` em
// grimorio.js:41 deixa a SUÍTE INTEIRA verde (1287/1223/0), porque nada
// chamava mostrarBuscaMagia() de verdade. `mostrarBuscaMagia` é assíncrona e
// termina chamando `abrirModal` (site/js/utils.js) -- que grava o HTML no
// elemento `#modal-corpo` do DOM real. O stub de `document` de harness.mjs
// só tem `getElementById: () => null`, insuficiente para capturar isso; o
// helper abaixo troca `document.getElementById`/`querySelectorAll` por uma
// versão local, só durante a chamada, que devolve objetos simples o
// bastante para a função rodar até o fim sem lançar (`style`, `innerHTML`,
// `querySelectorAll: () => []`, `addEventListener: () => {}`) e captura o
// `corpoHtml` gravado em `#modal-corpo` -- o mesmo texto que o jogador veria
// na tela. Restaura os originais mesmo se `mostrarBuscaMagia` lançar.
function chamarCapturandoModal(fnAssincrona) {
  return (async () => {
    const originalGetElementById = document.getElementById;
    const originalQuerySelectorAll = document.querySelectorAll;
    const elementoFalso = () => ({
      style: {}, innerHTML: '', textContent: '', value: '', className: '',
      querySelectorAll: () => [], addEventListener: () => {},
      classList: { add() {}, remove() {} },
    });
    const elementos = {
      'modal-overlay': { style: { display: 'none' } },
      'modal-titulo': elementoFalso(),
      'modal-corpo': elementoFalso(),
      'modal-acoes': elementoFalso(),
      'modal-container': { scrollTop: 0 },
      'resultado-magias': elementoFalso(),
      'busca-magia-add': elementoFalso(),
      'gm-contador-truques': elementoFalso(),
      'gm-contador-preparadas': elementoFalso(),
    };
    document.getElementById = (id) => elementos[id] || null;
    document.querySelectorAll = () => [];
    try {
      await fnAssincrona();
    } finally {
      document.getElementById = originalGetElementById;
      document.querySelectorAll = originalQuerySelectorAll;
    }
    return elementos['modal-corpo'].innerHTML;
  })();
}

test('numérico: mostrarBuscaMagia() (sheet/grimorio.js) aplica de fato +1 truque para Clérigo Taumaturgo (não só cita a função)', async () => {
  const classeDataClerigo = CLASSES_DADOS.get('Clérigo');
  const personagemBase = {
    classe: 'Clérigo', nivel: 4, ordem_divina: 'Protetor',
    atributos: atributosBase(), magias_conhecidas: [], magias_preparadas: [],
    espacos_magia: {}, grimorio: [], magias_customizadas: [],
  };

  definirClasseData(classeDataClerigo);
  definirChar({ ...personagemBase, ordem_divina: 'Protetor' });
  const htmlSemBonus = await chamarCapturandoModal(() => mostrarBuscaMagia());
  const mSemBonus = htmlSemBonus.match(/Truques:\s*\d+\/(\d+)/);
  assert.ok(mSemBonus, 'sanity: não achei "Truques: X/Y" no HTML de mostrarBuscaMagia()');
  const limiteSemBonus = parseInt(mSemBonus[1], 10);

  definirChar({ ...personagemBase, ordem_divina: 'Taumaturgo' });
  const htmlComBonus = await chamarCapturandoModal(() => mostrarBuscaMagia());
  const mComBonus = htmlComBonus.match(/Truques:\s*\d+\/(\d+)/);
  assert.ok(mComBonus, 'sanity: não achei "Truques: X/Y" no HTML de mostrarBuscaMagia() (Taumaturgo)');
  const limiteComBonus = parseInt(mComBonus[1], 10);

  assert.equal(limiteComBonus, limiteSemBonus + 1,
    `Clérigo Taumaturgo (Classes.md:1568) deveria ter +1 truque no limite mostrado pelo modal ` +
    `"Gerenciar Magias" (sheet/grimorio.js) em relação a Protetor -- Protetor: ${limiteSemBonus}, ` +
    `Taumaturgo: ${limiteComBonus}. Se os dois números baterem, o bônus de sheet/grimorio.js foi ` +
    `neutralizado (ex.: multiplicado por 0) sem que nenhuma outra asserção deste arquivo percebesse.`);
});

// IMPORTANTE (revisão pós-Task-7, I2): dos 3 arquivos abaixo, só 2 mudam
// comportamento OBSERVÁVEL ao ganhar a chamada de getBonusTruquesOrdem --
// sheet/grimorio.js (contador "Truques: X/Y" e bloqueio de troca,
// grimorio.js:87/263) e sheet/magias.js (mesmo limite, consumido pela
// ficha). levelup-flow.js:128-129 soma o bônus a truquesAtual E truquesNovo,
// mas os 3 consumidores reais desse cálculo (levelup-cards.js,
// levelup-ui.js, levelup-validations.js) só leem `truquesGanhos` = a
// DIFERENÇA entre os dois -- e a diferença não muda (o bônus é o mesmo dos
// dois lados, se cancela). É um NO-OP para o comportamento hoje observável,
// mantido por defesa (ver comentário em levelup-flow.js:104-116 para o
// porquê) -- listado aqui mesmo assim porque a chamada existe de verdade e
// a proteção defensiva é real, só não é uma correção de bug observável como
// as outras duas.
const ARQUIVOS_TRUQUE_SEM_BONUS = [
  { caminho: GRIMORIO_PATH, rotulo: 'sheet/grimorio.js', linha: '27, 83, 259' },
  { caminho: MAGIAS_PATH, rotulo: 'sheet/magias.js', linha: '399' },
  { caminho: LEVELUP_FLOW_PATH, rotulo: 'levelup-flow.js', linha: '85-86, 104-116 (no-op defensivo, ver comentário)' },
];

for (const { caminho, rotulo, linha } of ARQUIVOS_TRUQUE_SEM_BONUS) {
  test(`bônus de truque do Taumaturgo/Xamã: ${rotulo} aplica o mesmo bônus que o criador aplica`, async () => {
    // Lacuna 'classes-passivas-extras-classe-truque' foi corrigida e aposentada
    // na Task 7 -- o wrap em comLacuna() foi removido, a asserção roda direto.
    const aplica = aplicaBonusTruqueTaumaturgo(caminho);
    assert.ok(aplica,
      `${rotulo}:${linha} chama getTruquesConhecidos() para calcular um limite de truques mostrado/` +
      `validado ao jogador, mas não aplica o bônus de +1 truque do Clérigo Taumaturgo/Druida Xamã ` +
      `que o criador aplica (creator/passo-magias.js:54-62, creator/wizard.js:330-337; livro: ` +
      `Classes.md:1568/2060) -- um personagem criado com o bônus (4 truques conhecidos) é medido ` +
      `aqui contra um limite calculado SEM o bônus (3), produzindo "Truques: 4/3" ` +
      `(sheet/grimorio.js:83) e bloqueando qualquer troca de truque com "Limite de 3 truques ` +
      `atingido" (grimorio.js:259) desde a criação, sem o jogador ter feito nada de errado.`);
  });
}

// ============================================================
// STEP 3 (Task 5, achado; corrigido na Task 7): vocabulário único de Estilo
// de Luta.
//
// ANTES DA TASK 7: o seletor de escolha de classe (CLASSES_ESCOLHAS,
// site/js/creator/comum.js) gravava o nome que o jogador ESCOLHEU abreviado
// em 4 dos 10 casos ("Arremesso", "Armas Grandes", "Duas Armas",
// "Desarmado"). O mapa de exibição da ficha (efeitosEstilo,
// site/js/sheet/habilidades.js) era indexado por um TERCEIRO vocabulário,
// que só batia por acaso em metade dos nomes. Os efeitos NUMÉRICOS não
// sofriam disso porque getEstiloAtivo (talentos-effects.js) normalizava os
// dois vocabulários -- só a EXIBIÇÃO na ficha sofria.
//
// DEPOIS DA TASK 7: comum.js grava os 10 nomes CANÔNICOS diretamente (os
// mesmos de dados/talentos/talentos.json, categoria "de Estilo de Luta"), e
// efeitosEstilo foi reindexado por eles -- os dois lados agora usam o MESMO
// vocabulário para escolhas novas. A correspondência antiga sobrevive só
// como normalizarEstiloLuta (talentos-effects.js, exportada), camada de
// compatibilidade para fichas SALVAS antes da correção -- ver bloco "I3"
// logo abaixo dos testes de efeitosEstilo, que prova que essa camada
// devolve, para os 4 nomes legados, uma chave que efeitosEstilo reconhece
// (sem esse teste, um `normalizarEstiloLuta` que virasse `return nome;`
// passaria despercebido, e fichas antigas voltariam a perder o texto de
// efeito -- confirmado por experimento pelo revisor de tier alto).
//
// Os nomes CANÔNICOS -- os que o livro e dados/talentos/talentos.json
// (categoria "de Estilo de Luta") usam -- vêm de EFEITOS_NUMERICOS (Step 1),
// não de uma lista redigitada aqui. CANONICO_PARA_GRAVADO (acima) documenta
// por que "gravado" e "canônico" são a mesma coisa agora.
// ============================================================

test('sanity: EFEITOS_NUMERICOS tem as 10 variantes de Estilo de Luta', () => {
  assert.equal(ESTILOS_CANONICOS.length, 10,
    `esperava 10 variantes de "Estilo de Luta: " em EFEITOS_NUMERICOS, achei ${ESTILOS_CANONICOS.length}`);
});

for (const classe of ['Guerreiro', 'Guardião', 'Paladino']) {
  test(`CLASSES_ESCOLHAS.${classe}.estilo_luta oferece os 10 estilos canônicos ao jogador`, () => {
    const opcoes = criador.CLASSES_ESCOLHAS[classe]?.estilo_luta?.opcoes || [];
    const nomesOferecidos = new Set(opcoes.map((o) => o.nome));
    for (const canonico of ESTILOS_CANONICOS) {
      const gravado = CANONICO_PARA_GRAVADO[canonico];
      assert.ok(nomesOferecidos.has(gravado),
        `${classe}: CLASSES_ESCOLHAS.estilo_luta.opcoes não oferece "${gravado}" ` +
        `(nome canônico: "${canonico}") -- comum.js:282-393`);
    }
  });
}

// efeitosEstilo (habilidades.js:4635-4648) é um const local, não exportado
// -- lido do disco, como o Step 2 faz com talentos-effects.js.
const HABILIDADES_SRC = readFileSync(resolve(SITE_JS_DIR, 'sheet/habilidades.js'), 'utf-8');
const BLOCO_EFEITOS_ESTILO = HABILIDADES_SRC.match(/const efeitosEstilo = \{([\s\S]*?)\n\s*\};/);

test('sanity: achei o objeto efeitosEstilo em site/js/sheet/habilidades.js', () => {
  assert.ok(BLOCO_EFEITOS_ESTILO,
    'não encontrei "const efeitosEstilo = { ... };" em site/js/sheet/habilidades.js -- ' +
    'o teste de vocabulário depende desse bloco (por volta da linha 4622)');
});

const EFEITOS_ESTILO_FICHA = new Map(
  BLOCO_EFEITOS_ESTILO
    ? [...BLOCO_EFEITOS_ESTILO[1].matchAll(/'([^']+)':\s*'([^']*)'/g)].map((m) => [m[1], m[2]])
    : []
);

// Os 5 dos 10 nomes GRAVADOS que efeitosEstilo não reconhecia antes da Task 7
// (achado registrado em lacunas-conhecidas.mjs sob
// 'classes-passivas-vocabulario-estilo') -- só estes 5 passam pelo wrap de
// comLacuna; os outros 5 (Arquearia, Combate com Armas de Arremesso, Combate
// com Armas Grandes, Defensivo, Duelismo) batiam por acaso mesmo antes da
// correção e precisam continuar afirmando isso sem inversão nenhuma. Valores
// atualizados para a forma CANÔNICA na Task 7 (ver comentário de
// CANONICO_PARA_GRAVADO acima) -- eram 'Duas Armas'/'Desarmado' abreviados.
const GRAVADOS_SEM_EFEITO_NA_FICHA = new Set(['Combate com Duas Armas', 'Combate Desarmado', 'Interceptação', 'Luta às Cegas', 'Protetivo']);

for (const canonico of ESTILOS_CANONICOS) {
  const gravado = CANONICO_PARA_GRAVADO[canonico];
  test(`efeitosEstilo (ficha): "${gravado}" (canônico "${canonico}") tem texto de efeito descrito`, async () => {
    const efeito = EFEITOS_ESTILO_FICHA.get(gravado);
    const rodarAsserção = () => assert.ok(typeof efeito === 'string' && efeito.trim().length > 0,
      `efeitosEstilo (site/js/sheet/habilidades.js:4635-4648) não tem entrada para "${gravado}" -- ` +
      `o jogador pode escolher este estilo (CLASSES_ESCOLHAS oferece "${gravado}"), mas a ficha não ` +
      `mostra o que ele faz. Chaves hoje no mapa: ${[...EFEITOS_ESTILO_FICHA.keys()].join(', ')}`);
    // Lacuna 'classes-passivas-vocabulario-estilo' foi corrigida e aposentada
    // na Task 7 -- o wrap em comLacuna() foi removido, a asserção roda direto
    // para todos os 10 estilos (o Set GRAVADOS_SEM_EFEITO_NA_FICHA acima só
    // documenta quais 5 eram o achado original, sem mudar mais o fluxo).
    rodarAsserção();
  });
}

// I3 (revisão pós-Task-7): a camada de compatibilidade (normalizarEstiloLuta,
// talentos-effects.js) precisa devolver, para os 4 nomes LEGADOS que fichas
// salvas antes da Task 7 ainda têm gravados em escolhas_classe.estilo_luta,
// um nome que efeitosEstilo (acima) reconhece -- senão a ficha desses
// personagens perde o texto de efeito, que é exatamente a lacuna
// 'classes-passivas-vocabulario-estilo' que acabou de ser aposentada. Sob o
// teste ANTIGO (que confrontava efeitosEstilo indexado pelos nomes
// abreviados diretamente), essa proteção vinha de graça -- o único conserto
// que passava era pôr as chaves abreviadas no mapa de exibição. Sob o
// vocabulário canônico novo, a proteção passou a depender inteira deste
// normalizador, que não tinha teste nenhum -- confirmado por experimento
// pelo revisor de tier alto: substituir o corpo de normalizarEstiloLuta por
// `return nome;` deixava a suíte inteira verde antes desta correção.
const NOMES_LEGADOS_ESTILO_LUTA = ['Armas Grandes', 'Duas Armas', 'Desarmado', 'Arremesso'];
for (const legado of NOMES_LEGADOS_ESTILO_LUTA) {
  test(`normalizarEstiloLuta: nome legado "${legado}" (ficha salva antes da Task 7) vira chave de efeitosEstilo`, () => {
    const canonico = efeitos.normalizarEstiloLuta(legado);
    assert.notEqual(canonico, legado,
      `normalizarEstiloLuta("${legado}") devolveu o próprio nome legado sem traduzir -- a camada de ` +
      `compatibilidade parou de normalizar (virou passthrough?), e uma ficha salva com este nome ` +
      `abreviado voltaria a não achar texto de efeito em efeitosEstilo.`);
    assert.ok(EFEITOS_ESTILO_FICHA.has(canonico),
      `normalizarEstiloLuta("${legado}") devolveu "${canonico}", que não é chave de efeitosEstilo ` +
      `(site/js/sheet/habilidades.js) -- uma ficha salva com "${legado}" gravado (nome de antes da ` +
      `Task 7) mostraria a seção de Estilo de Luta sem texto de efeito nenhum. Chaves hoje no mapa: ` +
      `${[...EFEITOS_ESTILO_FICHA.keys()].join(', ')}`);
  });
}
