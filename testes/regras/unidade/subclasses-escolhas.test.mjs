// ============================================================
// Escolhas de construção que as subclasses exigem, confrontadas com o que
// o app pede ao jogador ao subir de nível.
//
// A pergunta NÃO é "a função X dispara no nível certo?" -- é "o livro exige
// uma decisão do jogador aqui, e o app pede alguma?". A diferença é a lição
// do incremento Ladino nv6 (GUIA-PROXIMOS-DOMINIOS.md): medir cada mecanismo
// existente não pega a característica que nenhuma função reconhece, porque
// uma função que não existe não aparece em nenhum laço "para cada função".
//
// EMENDA de 2026-08-17 (task-3-brief.md do plano previa só DUAS listas --
// ESCOLHAS_SUBCLASSE, ESCOLHAS_EM_JOGO; o catálogo real tem CINCO, ver
// cabeçalho de ../catalogo/subclasses.mjs). Este motor afirma coisas
// diferentes por lista:
//   - ESCOLHAS_SUBCLASSE (23)             -- Direção 1: o app PRECISA pedir
//     (pendência além de 'subclasse') no nível declarado.
//   - CONCESSOES_AUTOMATICAS_SUBCLASSE (5) -- o app NÃO deve levantar
//     pendência específica de subclasse no nível delas: o livro concede sem
//     perguntar, e exigir pendência aqui seria lacuna falsa.
//   - ESCOLHAS_EM_JOGO (50), ESCOLHAS_COSMETICAS (3),
//     PASSIVOS_FORA_DESTE_MOTOR (1) -- fora da asserção deste motor (motivo
//     e citação já vivem no catálogo; nada aqui compara contra elas).
//
// A Direção 2 (o app pede, o livro exige?) roda sobre as 48 subclasses,
// não só sobre as que aparecem em ESCOLHAS_SUBCLASSE -- é o que pega
// escolha morta numa subclasse que o catálogo nem declarou.
//
// O que este motor NÃO cobre: as escolhas EM JOGO (alvo, direção, tipo de
// dano na hora), declaradas em ESCOLHAS_EM_JOGO com o motivo -- o app não
// tem o que persistir nelas. Também não cobre as COSMÉTICAS (sabor sem
// efeito mecânico) nem os PASSIVOS (domínio do motor de passivas,
// classes-passivas.test.mjs).
//
// LIMITE DECLARADO (MINOR 6 da revisão independente de 2026-08-17, mesmo
// limite que subclasses-magias.test.mjs já documenta): este motor dirige
// só a rota `subirDeNivel` (nível 2..20 via `escadaDeNivel`). DOIS outros
// caminhos de código ficam FORA do alcance desta suíte, e uma escolha
// satisfeita neles (e não em `subirDeNivel`) aparece aqui como um vermelho
// da Direção 1 sem defeito de verdade por trás:
//   - `site/js/creator/` -- o assistente de CRIAÇÃO de personagem. Nenhuma
//     das 18 características vermelhas medidas nesta correção foi
//     confirmada como coberta por ele (fora do escopo desta tarefa
//     investigar); ficam para uma rodada futura.
//   - a CAMADA DO ASSISTENTE DE SUBIDA DE NÍVEL (`site/js/levelup-flow.js`,
//     `site/js/levelup-cards.js`, `site/js/levelup-ui.js`) -- CRITICAL 1 da
//     revisão independente de 2026-08-17: `subirDeNivel` (site/js/levelup.js)
//     é só a metade que GRAVA o resultado; a pergunta/bloqueio/renderização
//     em si (o array `requirements`, os cartões da tela, a validação que
//     trava "Confirmar") vivem numa camada acima, montada por
//     `buildLevelUpContext`/`calcularConjuracao` (levelup-flow.js) e
//     consumida por levelup-cards.js/levelup-validations.js -- nenhuma
//     dessas funções aparece em `tipo_pendencia` (a lista que
//     PENDENCIAS_CONHECIDAS, acima, confronta). Uma escolha que essa camada
//     pergunta e bloqueia de verdade (Cavaleiro Místico/Trapaceiro Arcano
//     nível 3, ver a entrada própria em lacunas-conhecidas.mjs) ainda
//     aparece vermelha aqui, porque este motor nunca constrói o contexto do
//     assistente -- só chama `subirDeNivel` direto, do jeito que
//     `escadaDeNivel` (harness.mjs) faz.
//
// CORREÇÃO de 2026-08-17 (revisão independente, 3 achados CRÍTICOS):
//   1. A Direção 1 (Grupo 3) media "alguma pendência apareceu neste
//      nível", não "o app pede ESTA escolha" -- filtrava só 'subclasse',
//      deixando passar pendências de OUTRA característica do mesmo nível
//      (Mestre da Batalha nv3: 'manobras_guerreiro' de Superioridade em
//      Combate "emprestava" cobertura para Estudioso da Guerra, que não
//      tem mecanismo nenhum -- grep -rn "Estudioso da Guerra" site/js/ =>
//      0 ocorrências) ou pendências de CLASSE (Adivinhador nv10: 'grimorio'
//      é pendência de classe do Mago em todo nível > 1, levelup.js:924,
//      não da característica O Terceiro Olho). Corrigido com
//      PENDENCIAS_DE_CLASSE (promovido para antes deste grupo) e um mapa
//      TIPO_ESPERADO que amarra cada entrada de mecanismo conhecido ao seu
//      tipo_pendencia real -- ver comentário do Grupo 3.
//   2. A exceção de "crescimento" do Grupo 4/5 (antes
//      `tiposLegitimadosPorSubclasse`) era CEGA A NÍVEL: perdoava
//      (subclasse, tipo) sem checar em qual nível o tipo aparecia. Se
//      `exigeManobrasGuerreiro` (levelup.js:464) ganhasse um nível extra
//      por engano, ou se 'subclasse_magias_arcana' passasse a disparar num
//      nível que o livro não prevê, os Grupos 4/5 continuariam 100%
//      verdes -- exatamente a escolha morta que existem para pegar.
//   3. O conjunto perdoado vinha de LER a escada (o que a característica
//      efetivamente levantou), violando a regra do harness ("valor
//      esperado nunca vem da função sob teste"): um tipo errado levantado
//      pelo app seria perdoado para sempre.
// Corrigido junto: NIVEIS_CRESCIMENTO_LEGITIMOS declara, à mão e citando o
// livro, a tripla (subclasse, tipo, nível) que é crescimento legítimo de
// uma escolha já declarada -- nunca lida da escada. Ver comentário junto
// à constante, mais abaixo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSE_DA_SUBCLASSE, SUBCLASSES_CARACTERISTICAS,
  ESCOLHAS_SUBCLASSE, CONCESSOES_AUTOMATICAS_SUBCLASSE,
  ESCOLHAS_EM_JOGO, ESCOLHAS_COSMETICAS, PASSIVOS_FORA_DESTE_MOTOR,
} from '../catalogo/subclasses.mjs';
import { escadaDeNivel, comLacuna } from './harness.mjs';

const SUBCLASSES = Object.keys(CLASSE_DA_SUBCLASSE);

// ============================================================
// Grupo 1 -- Higiene do catálogo
// ============================================================

// Confere as duas listas de escolha de CONSTRUÇÃO (ESCOLHAS_SUBCLASSE e
// CONCESSOES_AUTOMATICAS_SUBCLASSE) contra SUBCLASSES_CARACTERISTICAS:
// cada entrada precisa apontar para uma característica real (mesmo nível,
// mesmo nome), ter quantidade inteira >= 1 e citar Classes.md:<linha>.
for (const [lista, nomeLista] of [
  [ESCOLHAS_SUBCLASSE, 'ESCOLHAS_SUBCLASSE'],
  [CONCESSOES_AUTOMATICAS_SUBCLASSE, 'CONCESSOES_AUTOMATICAS_SUBCLASSE'],
]) {
  test(`${nomeLista}: toda entrada aponta para uma característica real, com quantidade e citação válidas`, () => {
    for (const [subclasse, escolhas] of Object.entries(lista)) {
      assert.ok(SUBCLASSES.includes(subclasse),
        `${nomeLista}: subclasse desconhecida "${subclasse}"`);
      const classe = CLASSE_DA_SUBCLASSE[subclasse];
      const daSubclasse = SUBCLASSES_CARACTERISTICAS[classe][subclasse];
      for (const e of escolhas) {
        assert.ok(daSubclasse.some((c) => c.nivel === e.nivel && c.nome === e.caracteristica),
          `${nomeLista}[${subclasse}]: não existe característica "${e.caracteristica}" ` +
          `no nível ${e.nivel}`);
        assert.ok(Number.isInteger(e.quantidade) && e.quantidade >= 1,
          `${nomeLista}[${subclasse}]/${e.caracteristica}: quantidade inválida (${e.quantidade})`);
        assert.match(String(e.livro), /Classes\.md:\d+/,
          `${nomeLista}[${subclasse}]/${e.caracteristica}: sem citação do livro`);
      }
    }
  });
}

// As três listas de chave "<Subclasse>|<nível>|<Nome>" (ESCOLHAS_EM_JOGO,
// ESCOLHAS_COSMETICAS, PASSIVOS_FORA_DESTE_MOTOR): cada chave aponta para
// uma característica real e tem motivo citando o livro. Este motor não
// afirma nada sobre o COMPORTAMENTO delas -- só que o catálogo não está
// apontando para uma característica inexistente ou sem citação.
for (const [lista, nomeLista] of [
  [ESCOLHAS_EM_JOGO, 'ESCOLHAS_EM_JOGO'],
  [ESCOLHAS_COSMETICAS, 'ESCOLHAS_COSMETICAS'],
  [PASSIVOS_FORA_DESTE_MOTOR, 'PASSIVOS_FORA_DESTE_MOTOR'],
]) {
  test(`${nomeLista}: toda chave aponta para uma característica real e tem motivo citado`, () => {
    for (const [chave, motivo] of Object.entries(lista)) {
      const [subclasse, nivel, nome] = chave.split('|');
      assert.ok(SUBCLASSES.includes(subclasse),
        `${nomeLista}: subclasse desconhecida em "${chave}"`);
      const classe = CLASSE_DA_SUBCLASSE[subclasse];
      assert.ok(SUBCLASSES_CARACTERISTICAS[classe][subclasse]
        .some((c) => c.nivel === Number(nivel) && c.nome === nome),
        `${nomeLista}: "${chave}" não corresponde a nenhuma característica`);
      assert.match(String(motivo), /Classes\.md:\d+/,
        `${nomeLista}["${chave}"]: motivo sem citação Classes.md:<linha>`);
    }
  });
}

// MENOR 6 da revisão independente de 2026-08-18: o README alegava que as
// cinco listas cobrem "79 das 241 características". Na verdade cobrem 78
// DISTINTAS -- a soma bruta das cinco (20+5+50+3+1=79) conta duas vezes
// Andarilho Feérico|3|Glamour Transcendental, DELIBERADAMENTE listada em
// ESCOLHAS_SUBCLASSE (a frase de escolha de perícia) e em
// PASSIVOS_FORA_DESTE_MOTOR (a frase de bônus numérico passivo -- as duas
// frases vivem na MESMA característica do livro, Classes.md:3478/:3480, e
// nenhuma pode ser enterrada dentro da outra sem virar cobertura perdida em
// silêncio). Até esta correção essa exceção só era garantida por
// "self-review" (leitura humana, uma vez, sem teste que pudesse falhar) --
// e foi justamente a ausência de um teste assim que deixou duas OUTRAS
// características (Vitalidade da Árvore, Baluarte de Energia) caírem de
// FORA de todas as cinco listas numa rodada anterior deste mesmo plano
// (achado IMPORTANTE 1 da revisão de 2026-08-17, ver progress.md). Este
// teste promove aquele self-review a invariante automático: toda
// característica citada por alguma das cinco listas aparece em EXATAMENTE
// uma delas, exceto a dupla legítima (whitelisted por nome, não por
// contagem) -- e o total de características distintas é travado em 78: se
// uma entrada for removida de uma lista sem sair de nenhuma outra, o total
// cai para 77 e este teste denuncia.
const DUPLA_LISTAGEM_LEGITIMA = new Set(['Andarilho Feérico|3|Glamour Transcendental']);

test('as cinco listas cobrem cada característica em exatamente uma, exceto a dupla legítima', () => {
  // Um Set por lista (não um Map incrementado por ENTRADA) -- de propósito:
  // ESCOLHAS_SUBCLASSE/CONCESSOES_AUTOMATICAS_SUBCLASSE têm característica
  // com DUAS entradas na MESMA lista (Estudioso da Guerra: ferramenta +
  // perícia; Conjuração de Cavaleiro Místico/Trapaceiro Arcano: truque +
  // magia) -- isso é repetição DENTRO de uma lista, não listagem cruzada, e
  // não pode contar como se fosse a mesma dupla que este teste audita.
  const chavesDeEntradasPorSubclasse = (lista) => {
    const chaves = new Set();
    for (const [subclasse, escolhas] of Object.entries(lista)) {
      for (const e of escolhas) chaves.add(`${subclasse}|${e.nivel}|${e.caracteristica}`);
    }
    return chaves;
  };
  const listasDeChaves = [
    chavesDeEntradasPorSubclasse(ESCOLHAS_SUBCLASSE),
    chavesDeEntradasPorSubclasse(CONCESSOES_AUTOMATICAS_SUBCLASSE),
    new Set(Object.keys(ESCOLHAS_EM_JOGO)),
    new Set(Object.keys(ESCOLHAS_COSMETICAS)),
    new Set(Object.keys(PASSIVOS_FORA_DESTE_MOTOR)),
  ];

  const contagem = new Map(); // chave -> em quantas das cinco listas aparece
  for (const chaves of listasDeChaves) {
    for (const chave of chaves) contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  for (const [chave, vezes] of contagem) {
    const esperado = DUPLA_LISTAGEM_LEGITIMA.has(chave) ? 2 : 1;
    assert.equal(vezes, esperado,
      `"${chave}" aparece em ${vezes} das cinco listas (esperava ${esperado}) -- toda ` +
      `característica citada precisa aparecer em exatamente uma, exceto a dupla legítima ` +
      `(${[...DUPLA_LISTAGEM_LEGITIMA].join(', ')})`);
  }
  for (const chave of DUPLA_LISTAGEM_LEGITIMA) {
    assert.ok(contagem.has(chave), `dupla legítima "${chave}" não aparece em lista nenhuma`);
  }
  assert.equal(contagem.size, 78,
    `${contagem.size} características distintas cobertas pelas cinco listas -- esperava 78 ` +
    `(README.md). Se este número mudou de propósito, ajuste o catálogo E o README juntos.`);
});

// ============================================================
// Grupo 2 -- A escada, uma vez por subclasse
// ============================================================

// Sobe cada uma das 48 subclasses do nível 1 ao 20 UMA vez e guarda as
// pendências por nível num Map, para os grupos 3, 4 e 5 abaixo não
// subirem 48 escadas cada um (~230 ms na primeira subida, ~8 ms nas
// seguintes -- ainda assim, repetir por grupo multiplicaria o custo à
// toa).
const pendenciasPorSubclasse = new Map();
for (const subclasse of SUBCLASSES) {
  const classe = CLASSE_DA_SUBCLASSE[subclasse];
  const porNivel = {};
  await escadaDeNivel(classe, (_personagem, nivel, pendencias) => {
    porNivel[nivel] = pendencias ?? [];
  }, { subclasse });
  pendenciasPorSubclasse.set(subclasse, porNivel);
}

// Pendências que são da CLASSE, não da subclasse -- não contam como
// "escolha específica de subclasse" em nenhuma das duas direções. Lista
// dada pela amenda da tarefa (mesmo conjunto que PENDENCIAS_CONHECIDAS do
// harness, exceto 'manobras_guerreiro' e 'subclasse_magias_arcana', que
// SÃO específicas de subclasse -- Mestre da Batalha e as subclasses
// arcanas 1/3 conjuradoras -- e portanto não entram aqui). Promovido para
// antes do Grupo 3 (CRÍTICO 1 da revisão de 2026-08-17): a Direção 1
// precisa dele tanto quanto a Direção 2, senão uma pendência de CLASSE
// (ex.: 'grimorio', que o Mago levanta em TODO nível > 1 --
// levelup.js:924) passa por engano como se respondesse por uma
// característica de SUBCLASSE (Adivinhador nv10, O Terceiro Olho).
const PENDENCIAS_DE_CLASSE = new Set([
  'subclasse', 'dadiva_epica', 'aumento_atributo', 'talento_asi',
  'dadiva_proficiencia_pericia', 'dadiva_resistencia_energia', 'escolhas_talento',
  'bardo_expertise', 'guardiao_expertise', 'estilo_luta', 'explorador_habil',
  'grimorio', 'academico',
]);

// Tipo de pendência esperado, para as entradas de ESCOLHAS_SUBCLASSE cujo
// mecanismo já foi identificado dirigindo a escada de verdade (achado do
// pré-voo original desta tarefa, task-3-report.md). Chave
// "<Subclasse>|<nível>|<característica>". Entradas ausentes daqui não têm
// mecanismo conhecido -- o Grupo 3 cai no fallback "alguma pendência
// específica de subclasse, ainda não reivindicada por uma característica
// IRMÃ do mesmo nível, apareceu" (ver Grupo 3 abaixo).
//
// CRÍTICO 1 da revisão de 2026-08-17: sem esta amarração por
// característica, "alguma pendência além de 'subclasse' apareceu no
// nível" deixava passar 2 falsos positivos -- Mestre da Batalha nv3
// "Estudioso da Guerra" (ferramenta e perícia) passavam só porque
// 'manobras_guerreiro', pendência de OUTRA característica do MESMO nível
// (Superioridade em Combate), também estava presente. Confirmado que
// Estudioso da Guerra não tem mecanismo nenhum: `grep -rn "Estudioso da
// Guerra" site/js/` não retorna nada (a string só existe em
// dados/classes/guerreiro.json).
const TIPO_ESPERADO = new Map([
  // Superioridade em Combate (Mestre da Batalha nv3): levanta
  // 'manobras_guerreiro' (harness.mjs:463-465, resolverPendencia).
  ['Mestre da Batalha|3|Superioridade em Combate', 'manobras_guerreiro'],
  // Versado em [Escola] (Abjurador/Adivinhador/Evocador/Ilusionista nv3):
  // levantam 'subclasse_magias_arcana' (harness.mjs:470-481,
  // resolverPendencia; levelup.js:928-940, escolaSubclasseArcana).
  ['Abjurador|3|Versado em Abjuração', 'subclasse_magias_arcana'],
  ['Adivinhador|3|Versado em Adivinhação', 'subclasse_magias_arcana'],
  ['Evocador|3|Versado em Evocação', 'subclasse_magias_arcana'],
  ['Ilusionista|3|Versado em Ilusão', 'subclasse_magias_arcana'],
  // Estilo de Luta Adicional (Campeão nv7): IMPORTANTE 3 da revisão
  // independente de 2026-08-18 -- hoje NENHUM mecanismo levanta pendência
  // aqui (é a Causa 1, ver CAUSA_ESCOLHA_SUBCLASSE abaixo), mas
  // levelup.js:1076-1090 documenta o app REUSANDO o tipo_pendencia
  // 'estilo_luta' para uma segunda finalidade adjacente à subclasse (a
  // TROCA de Estilo de Luta do Guerreiro). Um desenvolvedor implementando
  // esta característica pelo mesmo padrão levantaria 'estilo_luta' no
  // nível 7 -- e, sem esta entrada, o filtro `PENDENCIAS_DE_CLASSE` (que
  // trata 'estilo_luta' como pendência genérica de CLASSE em todo outro
  // caso) excluiria essa pendência de `especificas` ANTES de qualquer
  // comparação, deixando a asserção vermelha para sempre, mesmo depois do
  // bug corrigido -- a alegação de lacuna nunca conseguiria se retirar.
  // Ver o ramo do Grupo 3 abaixo: para entradas com TIPO_ESPERADO, a
  // checagem usa `pendenciasNoNivel` (sem o filtro de classe), não
  // `especificas` -- só assim um tipo que também é PENDENCIAS_DE_CLASSE
  // pode ser reconhecido quando reaproveitado por uma característica.
  ['Campeão|7|Estilo de Luta Adicional', 'estilo_luta'],
]);

// Para cada (subclasse, nível) com pelo menos uma entrada de mecanismo
// conhecido em TIPO_ESPERADO, o conjunto de tipos já "reivindicados" por
// ela -- usado pelo fallback do Grupo 3 para não deixar a pendência de
// UMA característica emprestar cobertura para uma característica VIZINHA
// sem mecanismo, no MESMO nível (o caso Estudioso da Guerra acima).
const tiposReivindicadosPorNivel = new Map(); // "subclasse|nivel" -> Set(tipos)
for (const [subclasse, escolhas] of Object.entries(ESCOLHAS_SUBCLASSE)) {
  for (const e of escolhas) {
    const tipo = TIPO_ESPERADO.get(`${subclasse}|${e.nivel}|${e.caracteristica}`);
    if (!tipo) continue;
    const chave = `${subclasse}|${e.nivel}`;
    if (!tiposReivindicadosPorNivel.has(chave)) tiposReivindicadosPorNivel.set(chave, new Set());
    tiposReivindicadosPorNivel.get(chave).add(tipo);
  }
}

// Níveis em que o crescimento de uma escolha JÁ declarada em
// ESCOLHAS_SUBCLASSE é legítimo -- declarados à mão, citando o livro,
// NUNCA lidos da escada (CRÍTICO 3 da revisão de 2026-08-17: o valor
// esperado não pode vir da função sob teste). Chave externa é a
// subclasse, interna é o tipo_pendencia, valor é o Set de níveis em que
// aquele tipo é crescimento legítimo DAQUELA subclasse -- a tripla
// (subclasse, tipo, nível) completa, para não perdoar uma subclasse
// errada por coincidência de nome de tipo.
//
// CRÍTICO 2 da revisão de 2026-08-17: a versão anterior
// (tiposLegitimadosPorSubclasse) perdoava (subclasse, tipo) SEM nível --
// se o app passasse a levantar 'manobras_guerreiro' num nível que o
// livro não prevê (e.g. exigeManobrasGuerreiro virasse [3,4,7,10,15] em
// levelup.js:464), o Grupo 4 continuaria 100% verde. Consertado
// declarando os níveis aqui, citando o livro:
const NIVEIS_CRESCIMENTO_LEGITIMOS = new Map([
  ['Mestre da Batalha', new Map([
    // "Você aprende duas manobras adicionais à sua escolha quando atinge
    // os níveis 7, 10 e 15 de Guerreiro" (Classes.md:4069) -- somado ao
    // nível de aquisição (3, já coberto pela Direção 1/Grupo 3). Medido
    // contra o app: exigeManobrasGuerreiro (levelup.js:463-466) retorna
    // true exatamente para [3, 7, 10, 15] -- app e livro batem.
    ['manobras_guerreiro', new Set([3, 7, 10, 15])],
  ])],
  ...['Abjurador', 'Adivinhador', 'Evocador', 'Ilusionista'].map((subclasse) => [
    subclasse, new Map([
      // "ao adquirir acesso a um novo círculo de espaços de magia...
      // você pode adicionar gratuitamente uma magia" (Classes.md:4980,
      // texto igual nas 4 escolas). A tabela Características de Mago
      // (Classes.md:4560-4580) mostra cada coluna de círculo passando de
      // "—" para um número pela primeira vez nos níveis 3 (2º círculo), 5
      // (3º), 7 (4º), 9 (5º), 11 (6º), 13 (7º), 15 (8º) e 17 (9º) -- não
      // há 10º círculo, então não há crescimento além do 17. Nível 3 já é
      // o nível de aquisição declarado em ESCOLHAS_SUBCLASSE; 5-17 são o
      // crescimento. Medido contra o app: ganhouNovoCirculoDeEspacos
      // (levelup.js:864-872) deriva isso da mesma tabela de espaços de
      // magia -- app e livro batem pela própria definição da função.
      ['subclasse_magias_arcana', new Set([3, 5, 7, 9, 11, 13, 15, 17])],
    ]),
  ]),
]);

// Verdadeiro se `tipo`, no `nivel` dado, é crescimento legítimo de uma
// escolha já declarada da `subclasse` -- nunca lido da escada, sempre do
// mapa acima.
function crescimentoLegitimo(subclasse, tipo, nivel) {
  return NIVEIS_CRESCIMENTO_LEGITIMOS.get(subclasse)?.get(tipo)?.has(nivel) ?? false;
}

// ============================================================
// Lacunas conhecidas: mapa característica -> causa (Task 5, 2026-08-17)
// ============================================================
//
// As 33 divergências desta rodada (18 da Direção 1 + 15 do converso) caem
// em QUATRO causas de código -- ver lacunas-conhecidas.mjs para a análise
// completa (grep por campo/característica, consequência por personagem) e
// task-5-report.md para a tabela. Chave "<Subclasse>|<nível>|<característica>"
// (mesma forma de TIPO_ESPERADO acima), valor {talento, teste} -- `talento`
// é REPRESENTATIVO da causa (mesmo padrão de CAUSA_DIVERGENCIA_ATIVO_PASSIVO
// em classes-passivas.test.mjs); não é alegação de que o bug é específico
// daquela subclasse. Usado pelos Grupos 3 e 6 abaixo para rotear cada
// assert() divergente para a MESMA entrada de LACUNAS quando o call site
// pertence à causa já registrada -- e para rodar a asserção direto
// (sem lacuna) em qualquer característica fora deste mapa, incluindo as
// que hoje passam (Superioridade em Combate, os quatro "Versado em X").
const CAUSA_ESCOLHA_SUBCLASSE = new Map([
  // Causa 1 -- nenhum controle dedicado existe (nem levelup.js, nem a
  // ficha) para estas 6 características.
  ['Colégio do Conhecimento|3|Proficiências Bônus', { talento: 'Colégio do Conhecimento', teste: 'subclasses-escolha-ausente' }],
  ['Colégio do Conhecimento|6|Descobertas Mágicas', { talento: 'Colégio do Conhecimento', teste: 'subclasses-escolha-ausente' }],
  ['Mestre da Batalha|3|Estudioso da Guerra', { talento: 'Colégio do Conhecimento', teste: 'subclasses-escolha-ausente' }],
  ['Andarilho Feérico|3|Glamour Transcendental', { talento: 'Colégio do Conhecimento', teste: 'subclasses-escolha-ausente' }],
  ['Campeão|7|Estilo de Luta Adicional', { talento: 'Colégio do Conhecimento', teste: 'subclasses-escolha-ausente' }],
  ['Círculo da Terra|3|Magias do Círculo da Terra', { talento: 'Colégio do Conhecimento', teste: 'subclasses-escolha-ausente' }],
  // Causa 1-bis -- CRITICAL 1 da revisão independente de 2026-08-17: as duas
  // ficaram FORA da Causa 1 nesta correção (viviam lá antes, por engano). O
  // controle EXISTE, é dedicado, obrigatório e persiste (levelup-flow.js/
  // levelup-cards.js/levelup-ui.js) -- só que numa camada que este motor não
  // dirige (ver LIMITE DECLARADO acima). `tipo: 'limitacao-observabilidade'`
  // na entrada de LACUNAS, não 'app-diverge-do-livro'.
  ['Cavaleiro Místico|3|Conjuração', { talento: 'Cavaleiro Místico', teste: 'subclasses-escolha-ausente' }],
  ['Trapaceiro Arcano|3|Conjuração', { talento: 'Cavaleiro Místico', teste: 'subclasses-escolha-ausente' }],
  // Causa 2 -- o controle existe, dedicado, mas só na ficha (char.recursos.*,
  // criado sob demanda por site/js/sheet/*.js); subirDeNivel nunca o cria
  // nem pergunta. Só a Direção 1 (Grupo 3) destas 7 chega a uma asserção
  // vermelha -- o converso (Grupo 6) já é SKIP pelo mecanismo
  // RAIZES_FORA_DA_ROTA_SUBIRDENIVEL acima, sem precisar de comLacuna.
  ['Trilha do Coração Selvagem|6|Aspecto dos Selvagens', { talento: 'Caçador', teste: 'subclasses-escolha-ausente' }],
  ['Patrono Ínfero|10|Resistência Ínfera', { talento: 'Caçador', teste: 'subclasses-escolha-ausente' }],
  ['Feitiçaria Dracônica|6|Afinidade Elemental', { talento: 'Caçador', teste: 'subclasses-escolha-ausente' }],
  ['Caçador|3|Presa do Caçador', { talento: 'Caçador', teste: 'subclasses-escolha-ausente' }],
  ['Caçador|7|Táticas Defensivas', { talento: 'Caçador', teste: 'subclasses-escolha-ausente' }],
  ['Senhor das Feras|3|Companheiro Primal', { talento: 'Caçador', teste: 'subclasses-escolha-ausente' }],
  ['Adivinhador|10|O Terceiro Olho', { talento: 'Caçador', teste: 'subclasses-escolha-ausente' }],
  // Causa 3 -- concessões AUTOMÁTICAS (CONCESSOES_AUTOMATICAS_SUBCLASSE,
  // sem par na Direção 1) que nenhum código aplica em lugar nenhum. Só o
  // converso (Grupo 6) chega a uma asserção vermelha aqui.
  ['Combatente da Misericórdia|3|Implementos de Misericórdia', { talento: 'Assassino', teste: 'subclasses-escolha-ausente' }],
  ['Assassino|3|Ferramentas de Assassino', { talento: 'Assassino', teste: 'subclasses-escolha-ausente' }],
  ['Vigilante das Sombras|7|Mente de Ferro', { talento: 'Assassino', teste: 'subclasses-escolha-ausente' }],
  ['Ilusionista|3|Ilusões Aprimoradas', { talento: 'Assassino', teste: 'subclasses-escolha-ausente' }],
  // Treinamento Marcial (Colégio da Bravura nv3) -- CRÍTICO 1 da revisão
  // independente de 2026-08-18: até esta correção era `t.skip` por engano
  // (campoEsperado apontava para 'proficiencias_armaduras', raiz tratada
  // como fora da rota subirDeNivel). O campo real, `proficiencias_extra`
  // (ver catalogo/subclasses.mjs), está plenamente alcançável por
  // subirDeNivel e nenhuma rota grava nele para esta subclasse -- mesma
  // forma da Causa 3 (concessão automática que nada aplica), não um limite
  // de rota.
  ['Colégio da Bravura|3|Treinamento Marcial', { talento: 'Assassino', teste: 'subclasses-escolha-ausente' }],
]);

// ============================================================
// Grupo 3 -- Direção 1: o livro exige, o app pede?
// ============================================================

// Para cada uma das 23 escolhas de construção declaradas em
// ESCOLHAS_SUBCLASSE: a pendência CERTA precisa aparecer no nível dela.
//
// Duas formas, conforme o mecanismo é conhecido ou não (TIPO_ESPERADO):
//  - Conhecido: exige que o tipo_pendencia específico esteja presente --
//    não basta "alguma pendência apareceu", tem que ser A pendência da
//    característica declarada, não a de uma vizinha do mesmo nível.
//  - Desconhecido: cai no fallback "alguma pendência específica de
//    subclasse (fora de PENDENCIAS_DE_CLASSE) apareceu, e essa pendência
//    não é a já reivindicada por uma característica IRMÃ do mesmo nível
//    com mecanismo conhecido" -- a exclusão da irmã é o que impede
//    'manobras_guerreiro' (de Superioridade em Combate) de "emprestar"
//    cobertura para Estudioso da Guerra, que não tem mecanismo nenhum.
for (const [subclasse, escolhas] of Object.entries(ESCOLHAS_SUBCLASSE)) {
  for (const e of escolhas) {
    test(`o app pede a escolha do livro: ${subclasse} nv${e.nivel} — ${e.caracteristica}`, async () => {
      const pendenciasNoNivel = pendenciasPorSubclasse.get(subclasse)[e.nivel] ?? [];
      const especificas = pendenciasNoNivel.filter((t) => !PENDENCIAS_DE_CLASSE.has(t));
      const tipoEsperado = TIPO_ESPERADO.get(`${subclasse}|${e.nivel}|${e.caracteristica}`);
      // Wrap exatamente a asserção divergente (Step 3 do brief): a causa,
      // quando existe, é sempre a MESMA para os dois ramos (nenhuma
      // característica com mecanismo conhecido -- TIPO_ESPERADO -- está no
      // mapa de causas), então basta um comLacuna em volta dos dois ramos.
      const causa = CAUSA_ESCOLHA_SUBCLASSE.get(`${subclasse}|${e.nivel}|${e.caracteristica}`);
      const rodarAsserção = () => {
        if (tipoEsperado) {
          // Checa contra `pendenciasNoNivel` SEM o filtro de
          // PENDENCIAS_DE_CLASSE (não `especificas`) -- de propósito
          // (IMPORTANTE 3 da revisão de 2026-08-18): o tipo esperado pode
          // ser um tipo que, para OUTRA característica, é genérico de
          // classe (caso de 'estilo_luta', reaproveitado pelo padrão de
          // levelup.js:1076-1090). Filtrar aqui excluiria essa pendência
          // antes da comparação e tornaria a entrada permanentemente
          // vermelha mesmo depois de corrigida. Para os cinco tipos já
          // conhecidos que NÃO estão em PENDENCIAS_DE_CLASSE
          // ('manobras_guerreiro', 'subclasse_magias_arcana'),
          // `pendenciasNoNivel.includes(t)` e `especificas.includes(t)` são
          // equivalentes -- nenhum comportamento muda para eles.
          assert.ok(pendenciasNoNivel.includes(tipoEsperado),
            `${subclasse} nv${e.nivel}: o livro exige escolher ${e.quantidade} ${e.oQue} ` +
            `(${e.livro}), esperava a pendência '${tipoEsperado}' e o app levantou ` +
            `${JSON.stringify(pendenciasNoNivel)}`);
          return;
        }
        const reivindicados = tiposReivindicadosPorNivel.get(`${subclasse}|${e.nivel}`) ?? new Set();
        const sobra = especificas.filter((t) => !reivindicados.has(t));
        assert.ok(sobra.length > 0,
          `${subclasse} nv${e.nivel}: o livro exige escolher ${e.quantidade} ${e.oQue} ` +
          `(${e.livro}), e o app não levantou nenhuma pendência específica de subclasse ` +
          `além da(s) já explicada(s) por outra característica do mesmo nível ` +
          `(pendências no nível: ${JSON.stringify(pendenciasNoNivel)})`);
      };
      if (causa) {
        await comLacuna(causa.talento, causa.teste, rodarAsserção);
      } else {
        rodarAsserção();
      }
    });
  }
}

// ============================================================
// Grupo 4 -- Direção 2: o app pede, o livro exige?
// ============================================================

// Uma pendência específica de subclasse num nível onde o livro não
// declara escolha de construção é escolha morta: o app cobra do jogador
// uma decisão que o livro não prevê. Varre as 48 subclasses (não só as
// declaradas em ESCOLHAS_SUBCLASSE) -- é o que pegaria uma pendência
// nova aparecendo numa subclasse que o catálogo nem cita.
for (const subclasse of SUBCLASSES) {
  test(`o app não pede escolha que o livro não exige: ${subclasse}`, () => {
    const porNivel = pendenciasPorSubclasse.get(subclasse);
    const declarados = (ESCOLHAS_SUBCLASSE[subclasse] ?? []).map((e) => e.nivel);
    for (const [nivel, tipos] of Object.entries(porNivel)) {
      if (declarados.includes(Number(nivel))) continue; // nível já coberto pela Direção 1
      // Uma pendência é "escolha morta" só se NEM for genérica de classe
      // NEM for crescimento legítimo (subclasse, tipo, nível) de uma
      // escolha já declarada em outro nível (NIVEIS_CRESCIMENTO_LEGITIMOS
      // acima -- por triplas, não por (subclasse, tipo) cego a nível).
      const naoExplicadas = tipos.filter((t) =>
        !PENDENCIAS_DE_CLASSE.has(t) && !crescimentoLegitimo(subclasse, t, Number(nivel)));
      assert.equal(naoExplicadas.length, 0,
        `${subclasse} nv${nivel}: o app pede ${JSON.stringify(naoExplicadas)}, ` +
        `e o livro não declara nenhuma escolha de construção neste nível ` +
        `(nem é crescimento legítimo, no nível ${nivel}, de uma escolha já declarada em outro nível)`);
    }
  });
}

// ============================================================
// Grupo 5 -- as concessões automáticas não viram pendência (amenda)
// ============================================================

// Para as 5 concessões automáticas: o livro concede sem perguntar nada
// ("Você adquire proficiência em X"), então o app NÃO deve levantar
// pendência específica de subclasse no nível delas. Um app que
// perguntasse estaria cobrando uma decisão que o livro não prevê --
// mesma forma de escolha morta que o Grupo 4 mede, mas afirmada aqui
// diretamente sobre a lista que documenta a ausência de escolha.
for (const [subclasse, concessoes] of Object.entries(CONCESSOES_AUTOMATICAS_SUBCLASSE)) {
  for (const c of concessoes) {
    test(`concessão automática não vira pendência: ${subclasse} nv${c.nivel} — ${c.caracteristica}`, () => {
      // Exclui tipos que são crescimento legítimo (subclasse, tipo, nível)
      // de OUTRA escolha de construção declarada da MESMA subclasse no
      // MESMO nível (ex.: Ilusionista nv3 tem Ilusões Aprimoradas --
      // automática -- e Versado em Ilusão -- construção, ESCOLHAS_SUBCLASSE
      // -- na mesma característica-nível; a pendência
      // 'subclasse_magias_arcana' medida ali pertence a Versado em Ilusão,
      // não a Ilusões Aprimoradas, e a Direção 1 já confirma que ela
      // responde pela escolha certa). Sem esta exclusão o motor culparia a
      // concessão automática por uma pendência de uma característica
      // vizinha no mesmo nível. CRÍTICO 2/3: usa crescimentoLegitimo (nível
      // declarado à mão) em vez do antigo `legitimados` cego a nível.
      const noNivel = (pendenciasPorSubclasse.get(subclasse)[c.nivel] ?? [])
        .filter((t) => !PENDENCIAS_DE_CLASSE.has(t) && !crescimentoLegitimo(subclasse, t, c.nivel));
      assert.equal(noNivel.length, 0,
        `${subclasse} nv${c.nivel}: o livro concede ${c.caracteristica} sem perguntar ` +
        `(${c.livro}), e o app levantou pendência específica de subclasse ` +
        `${JSON.stringify(noNivel)} — o app está cobrando uma decisão que o livro não prevê`);
    });
  }
}

// ============================================================
// Grupo 6 -- o converso: existe ALGUM mecanismo que responda pela
// escolha, com ou sem pendência?
// ============================================================
//
// A Direção 1 (Grupo 3) pergunta "alguma PENDÊNCIA responde por esta
// característica?" -- mas um app pode implementar a escolha SEM levantar
// pendência nenhuma, concedendo o resultado direto no personagem. Isso
// conta como implementado, e a Direção 1 sozinha o marcaria como
// vermelho (falso negativo de arquitetura, não de comportamento). Este
// grupo pergunta a questão comportamental: o personagem realmente mudou
// quando ganhou o nível da característica?
//
// Roda para as 23 entradas de ESCOLHAS_SUBCLASSE (construção) e as 5 de
// CONCESSOES_AUTOMATICAS_SUBCLASSE (concessão automática) -- as duas
// listas descrevem algo que o livro entrega ao personagem nesse nível,
// só a FORMA (pergunta vs. concede) muda; a pergunta "o personagem
// mudou?" vale para as duas.
//
// Duas escadas por entrada -- uma até `e.nivel - 1`, outra até
// `e.nivel` -- e não contra a fixture inicial (`personagemSemente`):
// comparar contra o nível anterior é o que isola o que a SUBCLASSE
// concedeu daquele nível específico do que a CLASSE já concede em
// qualquer subida (perícias, PV, espaços de magia etc. já mudariam entre
// a semente e qualquer nível > 1, mesmo sem a característica da
// subclasse existir).
//
// A ARMADILHA que este teste existe para não cair: comparar por NOME DE
// CAMPO inventado mede arquitetura, não comportamento (erro nº 1 do
// GUIA-PROXIMOS-DOMINIOS.md, que uma vez produziu 31 lacunas falsas). Por
// isso a ramificação abaixo:
//   - `campoEsperado` não-nulo: é uma DICA, só preenchida onde o campo foi
//     CONFERIDO existir em site/js/ (grep, ver cabeçalho do catálogo) --
//     mesmo estatuto que `efeito` em classes-passivas.mjs, decorativo. Se
//     o campo é array (a maioria), a asserção é de CRESCIMENTO (mais
//     itens depois que antes); se é escalar (os três campos
//     `recursos.*`/`escolhas_classe.*` cujo valor real é uma string ou
//     objeto único), a asserção é de MUDANÇA de valor.
//   - `campoEsperado` nulo: nenhum nome de campo é seguro (a característica
//     não tem mecanismo confirmado no app, ou o catálogo não pôde
//     confirmar um). A asserção NÃO olha nome de campo nenhum -- compara o
//     personagem INTEIRO antes/depois, ignorando só a bookkeeping
//     automática que muda em QUALQUER subida de nível (nivel, pv_max,
//     pv_atual, espacos_magia, xp) mesmo sem a característica fazer nada.
//     Um app que grava o resultado sob qualquer outro nome passa; um app
//     que não faz nada falha.
// ACHADO durante a implementação: a lista original (nivel, pv_max,
// pv_atual, espacos_magia, xp) deixava a comparação integral VAZIA (sempre
// "passa", não importa o que a característica faça) para as quatro
// entradas de `campoEsperado: null` -- as duas escadas (`antes`/`depois`)
// são PERSONAGENS DIFERENTES (duas chamadas de escadaDeNivel, cada uma
// cria seu próprio `store.criarPersonagemVazio()`), e três campos mudam
// entre quaisquer dois personagens por CONSTRUÇÃO, não por causa de
// nenhuma característica: `id` (site/js/store.js:238, `gerarId()`
// aleatório), `criado_em`/`atualizado_em` (site/js/store.js:316-317,
// `new Date().toISOString()` no instante da criação -- e `atualizado_em`
// é regravado a cada chamada que passa por `store.js:82`, então mesmo
// sem `id` ele sozinho já vacuaria o teste). Medido rodando as quatro
// entradas manualmente (Caçador nv3/nv7, Círculo da Terra nv3, Senhor das
// Feras nv3): as três apareciam em TODO diff, entrada com característica
// real ou não. Ignorá-las é exigido para o teste ter alguma chance de
// falhar -- sem isso, "ignorar de menos" (não "ignorar demais") era o que
// tornava o teste vazio.
// Somado por análise (mesmo motivo, confirmado no mesmo experimento):
// `dados_vida_total` sobe 1-para-1 com `nivel` (site/js/store.js:280 +
// levelup.js, um dado de vida por nível, para TODA classe/subclasse) --
// mesmo estatuto mecânico de `pv_max`/`pv_atual`, só que a lista original
// não o citava. `subclasse` muda exatamente UMA vez na escada inteira (no
// nível em que a pendência 'subclasse' é resolvida, ver
// `PENDENCIAS_DE_CLASSE` acima, que já trata essa pendência como DE
// CLASSE, não de característica específica) -- contá-la como evidência
// daria "passa" para QUALQUER característica daquele mesmo nível, tenha
// ela mecanismo ou não (achado real: sem esta exclusão, Presa do Caçador
// e Companheiro Primal passavam só por causa da atribuição de subclasse
// nv3, não por mecanismo próprio -- ambos voltam a FALHAR, batendo com a
// Direção 1, depois desta correção).
const CAMPOS_BOOKKEEPING_AUTOMATICA = [
  'nivel', 'pv_max', 'pv_atual', 'espacos_magia', 'xp',
  'id', 'criado_em', 'atualizado_em', 'dados_vida_total', 'subclasse',
];

// Lê um valor por caminho com pontos (ex.: 'escolhas_classe.estilo_luta',
// 'recursos.aspecto_selvagem') -- devolve `undefined` se qualquer nível
// intermediário do caminho não existir.
function valorEmCaminho(objeto, caminho) {
  return caminho.split('.').reduce(
    (atual, chave) => (atual == null ? undefined : atual[chave]), objeto);
}

// Cópia rasa do personagem sem os campos de bookkeeping automática -- só
// para a comparação integral de `campoEsperado === null`. Rasa (não
// profunda) de propósito: os objetos aninhados (`recursos`,
// `escolhas_classe` etc.) continuam por referência, e `assert.notDeepEqual`
// abaixo compara profundamente por conteúdo, não por identidade.
function personagemSemBookkeeping(personagem) {
  const copia = { ...personagem };
  for (const campo of CAMPOS_BOOKKEEPING_AUTOMATICA) delete copia[campo];
  return copia;
}

// CORREÇÃO (revisão independente de 2026-08-17, IMPORTANTE 4): o primeiro
// segmento de `campoEsperado` (ex.: 'recursos' em 'recursos.aspecto_selvagem')
// pode simplesmente NÃO EXISTIR no esquema de personagem que a rota
// `subirDeNivel` produz -- `store.criarPersonagemVazio()`
// (site/js/store.js:236-317) não cria `recursos`, e GREP CONFIRMA (`grep -n
// "personagem\.recursos" site/js/levelup.js`, zero ocorrências) que nenhuma
// linha de site/js/levelup.js a cria durante a subida de nível -- é uma
// impossibilidade ARQUITETURAL desta rota, não um sintoma de mecanismo
// quebrado. Sem alguma checagem, os dois lados da comparação
// (`antes`/`depois`) são `undefined` e `undefined`, e tanto
// `assert.notDeepEqual` quanto a comparação de array (via
// `(valor ?? []).length`, que colapsa `undefined` para `[]` e mede
// crescimento 0→0) FALHAM ou PASSAM por acidente de tipo, não por evidência
// sobre o app -- exatamente o "compara undefined com undefined" do achado.
//
// ARMADILHA EVITADA (achado durante esta correção, ver prova de mutação no
// relatório): a primeira versão desta checagem era em TEMPO DE EXECUÇÃO --
// "nenhum dos dois personagens tem a chave" -- e isso é ambíguo demais.
// `manobras_conhecidas` (Mestre da Batalha) também não existe em
// `criarPersonagemVazio()`; ele só nasce quando `levelup.js` resolve a
// pendência 'manobras_guerreiro' pela primeira vez. Uma checagem em tempo
// de execução não distingue "esta rota NUNCA cria isso" (recursos) de "o
// mecanismo que criaria isso está quebrado e por isso não criou desta vez"
// (manobras_conhecidas com exigeManobrasGuerreiro mutado) -- a segunda é
// EXATAMENTE o defeito que este motor existe para pegar, e a checagem em
// runtime o escondia como "limite declarado" em vez de deixá-lo vermelho.
// Por isso a lista abaixo é ESTÁTICA (só as raízes confirmadas por grep
// como impossíveis nesta rota), não uma pergunta feita a `antes`/`depois`.
//
// CORREÇÃO (revisão independente de 2026-08-18, CRÍTICO 1): esta lista
// tinha um SEGUNDO membro, `proficiencias_armaduras` (Treinamento Marcial,
// Colégio da Bravura), retirado nesta correção. Diferente de `recursos`,
// `proficiencias_armaduras` não é "impossível de alcançar" -- é só o campo
// ERRADO: a raiz que o app de fato usa para esse benefício,
// `proficiencias_extra`, já é criada como `[]` por
// `store.criarPersonagemVazio()` (site/js/store.js:255) e está plenamente
// alcançável por `subirDeNivel` (site/js/creator/wizard.js:453-460 grava
// nela, embora não para esta subclasse -- ver a `observacao` da entrada em
// catalogo/subclasses.mjs). Tratar `proficiencias_armaduras` como
// "impossibilidade arquitetural" fazia exatamente o que este comentário, um
// parágrafo acima, alerta contra: escondia uma pendência que o mecanismo
// quebrado (a ausência de gravação para Colégio da Bravura) devia deixar
// vermelha, atrás de um `t.skip` que parecia "limite de rota" mas era, na
// verdade, `campoEsperado` apontando para o campo errado -- o mesmo erro nº
// 1 do GUIA-PROXIMOS-DOMINIOS.md (medir arquitetura, aqui vestido de nome
// de campo), agora pego pela correção do catálogo, não por este motor.
const RAIZES_FORA_DA_ROTA_SUBIRDENIVEL = new Set(['recursos']);

function primeiroSegmentoForaDaRota(caminho) {
  return RAIZES_FORA_DA_ROTA_SUBIRDENIVEL.has(caminho.split('.')[0]);
}

// A pendência de CLASSE 'grimorio' (site/js/levelup.js:924,
// `exigeGrimorioMago = personagem.classe === 'Mago' && novoNivel > 1`) exige
// SEMPRE exatamente 2 magias novas (levelup.js:1139,
// `selecionadas.length === 2`) em TODO nível > 1, incondicional de
// subclasse -- e a escada canônica sempre a resolve com 2 magias
// (harness.mjs:468). Uma entrada com `campoEsperado: 'grimorio'` mede o
// array `grimorio` inteiro, que mistura essa concessão de CLASSE com a
// concessão de SUBCLASSE ("Versado em [Escola]", 2 magias grátis no nível
// 3) -- CRÍTICO 2 da revisão de 2026-08-17: como a concessão de classe
// sozinha (+2) já é >= à `quantidade` da característica de subclasse (2),
// checar só `crescimento >= quantidade` no array bruto passaria mesmo que o
// mecanismo de SUBCLASSE fosse apagado do app inteiro -- um verde inerte.
// Descontar este "chão" conhecido antes de comparar com `e.quantidade` é o
// que torna a asserção capaz de falhar de verdade.
const CRESCIMENTO_GRIMORIO_DE_CLASSE_POR_NIVEL = 2;

// MENOR 5 da revisão independente de 2026-08-18: `escolhas_classe.estilo_luta`
// (Campeão nv7 -- Estilo de Luta Adicional) é um campo cujo TIPO é array de
// verdade (levelup.js:1571/1588 grava `personagem.escolhas_classe.estilo_luta
// = [opcoes.estilo_luta]`) mas que esta escada SINTÉTICA nunca chega a criar
// para um Guerreiro: a pendência 'estilo_luta' só é levantada por
// `subirDeNivel` para Guardião/Paladino nível 2 (levelup.js:1057); para o
// Guerreiro o campo nasce no assistente de CRIAÇÃO, fora do que
// `personagemSemente()`/`escadaDeNivel` (harness.mjs) reproduz. Resultado:
// `valorAntes`/`valorDepois` são `undefined` nos DOIS lados -- nem `antes`
// nem `depois` é array --, e sem tratamento especial isso cai no ramo
// ESCALAR (`assert.notDeepEqual`), cuja mensagem "não mudou (antes:
// undefined, depois: undefined)" parece dizer "o campo não existe", quando na
// verdade o campo é um array que só não foi inicializado por esta rota. O
// veredito não muda (a característica continua sem mecanismo aqui, pelos
// MESMOS sete leitores de índice 0 documentados em lacunas-conhecidas.mjs) --
// só a mensagem, que passa a usar a MESMA lógica de crescimento 0→0 do ramo
// array (mais clara: "cresceu só 0, esperava >= N") em vez do
// undefined-contra-undefined enganoso.
const CAMPOS_ARRAY_MESMO_QUANDO_UNDEFINED = new Set(['escolhas_classe.estilo_luta']);

for (const [lista, listaTemOQue] of [
  [ESCOLHAS_SUBCLASSE, true],
  [CONCESSOES_AUTOMATICAS_SUBCLASSE, false],
]) {
  for (const [subclasse, escolhas] of Object.entries(lista)) {
    const classe = CLASSE_DA_SUBCLASSE[subclasse];
    for (const e of escolhas) {
      test(`algum mecanismo responde por ${subclasse} nv${e.nivel} — ${e.caracteristica} (converso)`, async (t) => {
        const antes = await escadaDeNivel(classe, () => {}, { subclasse, ateNivel: e.nivel - 1 });
        const depois = await escadaDeNivel(classe, () => {}, { subclasse, ateNivel: e.nivel });
        const oQue = listaTemOQue ? `${e.quantidade} ${e.oQue}` : `${e.caracteristica} (concessão automática)`;
        // Wrap exatamente a asserção divergente (Step 3 do brief), nunca o
        // `t.skip` (LIMITE DECLARADO, não uma alegação -- fica intocado) nem
        // o cálculo de antes/depois. Mesma causa das duas em CAUSA_ESCOLHA_SUBCLASSE.
        const causa = CAUSA_ESCOLHA_SUBCLASSE.get(`${subclasse}|${e.nivel}|${e.caracteristica}`);

        if (e.campoEsperado) {
          // LIMITE DECLARADO (CRÍTICO 1 + IMPORTANTE 4 da revisão de
          // 2026-08-17): campo cuja raiz é conhecida como fora do alcance
          // desta rota não é evidência de que o app carece de mecanismo --
          // é evidência de que `subirDeNivel` não alcança o campo. `t.skip`
          // deixa isso visível no relatório da suíte (nada fica escondido,
          // mesmo tratamento de `classes-passivas.test.mjs`/
          // `escolha-morta.test.mjs`) sem afirmar "nenhum mecanismo do app
          // respondeu", que seria falso sempre que a `observacao` do
          // catálogo cita onde o mecanismo real mora (tipicamente
          // site/js/sheet/*.js).
          if (primeiroSegmentoForaDaRota(e.campoEsperado)) {
            t.skip(`${subclasse} nv${e.nivel} — ${e.caracteristica}: campo ` +
              `'${e.campoEsperado}' está fora do alcance da rota subirDeNivel ` +
              `(raiz '${e.campoEsperado.split('.')[0]}' nunca é criada por ` +
              `site/js/levelup.js nem por store.criarPersonagemVazio()) — LIMITE ` +
              `DECLARADO deste motor (dirige só subirDeNivel, nível 2..20; a ficha ` +
              `-- site/js/sheet/* -- é outro caminho de código, fora do alcance desta ` +
              `suíte). Ver \`observacao\` da entrada no catálogo para onde o campo ` +
              `real é gravado, se houver.`);
            return;
          }
          const valorAntes = valorEmCaminho(antes, e.campoEsperado);
          const valorDepois = valorEmCaminho(depois, e.campoEsperado);
          const rodarAsserção = () => {
            if (Array.isArray(valorAntes) || Array.isArray(valorDepois) ||
                CAMPOS_ARRAY_MESMO_QUANDO_UNDEFINED.has(e.campoEsperado)) {
              const qtdAntes = (valorAntes ?? []).length;
              const qtdDepois = (valorDepois ?? []).length;
              // CRÍTICO 2/3 (revisão de 2026-08-17): honra `e.quantidade` --
              // crescer qualquer coisa (mesmo 1 item) não basta quando o
              // livro pede mais de um. Para 'grimorio', desconta primeiro o
              // "chão" da pendência de classe (ver constante acima), senão a
              // concessão de classe sozinha mascara a ausência da concessão
              // de subclasse (achado real: sem o desconto, as quatro
              // entradas "Versado em [Escola]" passariam mesmo com o
              // mecanismo de subclasse apagado).
              const crescimentoBruto = qtdDepois - qtdAntes;
              const crescimentoDaSubclasse = e.campoEsperado === 'grimorio'
                ? crescimentoBruto - CRESCIMENTO_GRIMORIO_DE_CLASSE_POR_NIVEL
                : crescimentoBruto;
              assert.ok(crescimentoDaSubclasse >= e.quantidade,
                `${subclasse} nv${e.nivel} (${e.livro}): o livro concede ${oQue}, e ` +
                `${e.campoEsperado} cresceu só ${crescimentoDaSubclasse} atribuível à ` +
                `subclasse (bruto ${qtdAntes} → ${qtdDepois}` +
                (e.campoEsperado === 'grimorio'
                  ? `, descontados ${CRESCIMENTO_GRIMORIO_DE_CLASSE_POR_NIVEL} da pendência ` +
                    `de CLASSE 'grimorio', que concede sempre em todo nível > 1`
                  : '') +
                `), esperava >= ${e.quantidade} — nenhum mecanismo do app respondeu`);
            } else {
              assert.notDeepEqual(valorDepois, valorAntes,
                `${subclasse} nv${e.nivel} (${e.livro}): o livro concede ${oQue}, e ` +
                `${e.campoEsperado} não mudou ao subir para este nível ` +
                `(antes: ${JSON.stringify(valorAntes)}, depois: ${JSON.stringify(valorDepois)}) ` +
                `— nenhum mecanismo do app respondeu`);
            }
          };
          if (causa) {
            await comLacuna(causa.talento, causa.teste, rodarAsserção);
          } else {
            rodarAsserção();
          }
          return;
        }

        // campoEsperado === null: comparação integral, ignorando só a
        // bookkeeping automática -- ver comentário do grupo acima. Lista os
        // dez campos ignorados de verdade (não só os cinco do brief
        // original) para quem lê um vermelho aqui saber exatamente o que a
        // asserção NÃO está enxergando (MENOR 7 da revisão de 2026-08-17).
        // MINOR 4 da revisão independente de 2026-08-17: `causa` (calculada
        // acima, antes deste `if`) fica SEM USO neste ramo, de propósito --
        // só Círculo da Terra alcança `campoEsperado === null` hoje, e seu
        // teste já passa (ver task-5-report.md, Concern 1); nenhum comLacuna
        // envolve a asserção abaixo.
        assert.notDeepEqual(personagemSemBookkeeping(depois), personagemSemBookkeeping(antes),
          `${subclasse} nv${e.nivel} (${e.livro}): o livro concede ${oQue}, e nada no ` +
          `personagem mudou ao subir para este nível além da bookkeeping automática ` +
          `(${CAMPOS_BOOKKEEPING_AUTOMATICA.join('/')}) — nenhum mecanismo do app respondeu`);
      });
    }
  }
}
