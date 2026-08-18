// ============================================================
// Magias concedidas pelas 48 subclasses, confrontadas com o livro.
//
// A pergunta deste motor NÃO é "o parser X achou a magia?" -- é "o
// personagem termina com as magias que o livro concede?". O app tem DOIS
// acessores de concessão (obterMagiasDominioNivel, site/js/levelup.js:746, e
// obterMagiasSemprePreparadasNivel, :565), sustentados por TRÊS extratores
// internos que fazem o parsing de verdade (o parser de tabela embutido no
// primeiro, mais extrairMagiasSemprePreparadasTabela e ...Texto no segundo,
// :495 e :530) -- dois acessores, três extratores -- e o livro não diz por
// qual caminho a magia deve chegar.
// Exigir um mecanismo específico seria medir arquitetura em vez de
// comportamento -- o erro nº 1 do GUIA-PROXIMOS-DOMINIOS.md, que gerou 31
// lacunas falsas na rodada de Talentos. Por isso toda asserção aqui é
// sobre a UNIÃO dos mecanismos.
//
// O que este motor NÃO cobre: as magias por ESCOLHA do jogador (Descobertas
// Mágicas do Colégio do Conhecimento) são do Plano 3; a conjuração das duas
// subclasses 1/3 conjuradoras (Cavaleiro Místico, Trapaceiro Arcano) já tem
// motor próprio em unidade/subclasse-conjuradora.test.mjs e não é repetida
// aqui.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSE_DA_SUBCLASSE, MAGIAS_SUBCLASSE, SUBCLASSES_SEM_MAGIA,
  SUBCLASSES_MAGIA_POR_ESCOLHA, SUBCLASSES_MAGIA_OUTRO_MECANISMO,
  TETO_MAGIAS_POR_ESCOLHA, MAGIAS_CLASSE_SEMPRE,
} from '../catalogo/subclasses.mjs';
// Task 6: as cinco falhas medidas pelas Tasks 4-5 (ver task-4-report.md e
// task-5-report.md) agora entram em comLacuna(), registradas em
// lacunas-conhecidas.mjs sob duas causas -- 'Círculo da Lua' representa a
// Causa 1 (guarda "sempre", 4 subclasses) e 'Círculo da Terra' é a Causa 2
// (soma das quatro tabelas de terreno, 1 subclasse). Ver o comentário de
// CAUSA_UNIAO_MAGIAS abaixo para o porquê do nome representativo.
import { modulosApp, comLacuna, escadaDeNivel } from './harness.mjs';

const { levelup } = await modulosApp();
const SUBCLASSES = Object.keys(CLASSE_DA_SUBCLASSE);

// ============================================================
// Task 6 -- as cinco subclasses com lacuna confirmada nesta rodada
// (2026-08-17), agrupadas por CAUSA (motivo completo de cada uma em
// lacunas-conhecidas.mjs). `talento`/chave usada em comLacuna() é
// REPRESENTATIVA da causa quando ela afeta mais de uma subclasse -- não é
// uma alegação de que o bug é específico daquela subclasse; mesmo padrão
// de CAUSA_DIVERGENCIA_ATIVO_PASSIVO em classes-passivas.test.mjs.
// ============================================================
// CORRIGIDO na revisão pós-Task-6 (CRITICAL 3): Círculo das Estrelas SAIU
// da Causa 1 -- simular o conserto da guarda "sempre" contra os dados
// reais mostra que Lua/Mar/Vigilante passariam a bater, mas Estrelas
// continuaria devolvendo [] (três bloqueios próprios, nenhum resolvido
// pelo fix da Causa 1: tabela de formato do mapa embutida faz
// extrairMagiasSemprePreparadasTexto desistir em levelup.js:536; a guarda
// por FRASE em levelup.js:545 continua exigindo "sempre" na mesma frase
// da concessão, que não tem; e a leitura da tabela 1d6 como se fosse
// tabela de nível criaria lixo novo -- ver o motivo completo em
// lacunas-conhecidas.mjs, entrada 'Círculo das Estrelas'). Por isso
// Estrelas agora é sua PRÓPRIA causa (3), com seu próprio talento
// representativo (ela mesma, já que é a única subclasse afetada).
const CAUSA_UNIAO_MAGIAS = {
  // Causa 1 (3 subclasses): guarda "sempre" em extrairMagiasSempre...
  // (levelup.js:498, :533) bloqueia a extração inteira -- a frase do
  // livro nunca contém "sempre".
  'Círculo da Lua': 'Círculo da Lua',
  'Círculo do Mar': 'Círculo da Lua',
  'Vigilante das Sombras': 'Círculo da Lua',
  // Causa 2 (1 subclasse): a rota de domínio está morta (mesmo bug de
  // nome "de"/"do" da Causa 1), mas a rota "sempre" PASSA da guarda (a
  // frase do livro começa com "Sempre que completar um Descanso Longo")
  // e soma as quatro tabelas de terreno em vez de escolher uma.
  'Círculo da Terra': 'Círculo da Terra',
  // Causa 3 (1 subclasse): três bloqueios próprios, nenhum compartilhado
  // com a Causa 1 -- ver comentário acima.
  'Círculo das Estrelas': 'Círculo das Estrelas',
};

// Níveis em que a UNIÃO app×livro diverge de fato, medidos dirigindo os
// dois mecanismos do app nível a nível (script ad hoc sobre o app real,
// ver task-6-report.md) -- fora desses níveis app e livro concordam (os
// dois vazios), então só estes níveis entram no wrap de comLacuna; os
// demais continuam exigindo bater normal, dentro do MESMO teste e do
// MESMO laço (mesmo padrão de "obterCaracteristicasNivel × livro" em
// classes.test.mjs: comLacuna por nível, não em volta do laço inteiro).
const NIVEIS_DIVERGENTES_UNIAO = {
  'Círculo da Lua': [3, 5, 7, 9],
  'Círculo do Mar': [3, 5, 7, 9],
  'Círculo das Estrelas': [3],
  'Vigilante das Sombras': [3, 5, 9, 13, 17],
  'Círculo da Terra': [3, 5, 7, 9],
};

// Ordena e desduplica, para as comparações não dependerem da ordem em que
// cada mecanismo do app devolveu suas magias -- a ordem não é regra do
// livro, e compará-la produziria falha sem defeito por trás.
const conjunto = (nomes) => [...new Set(nomes)].sort();

// O esperado de um par (subclasse, nível): o que o LIVRO concede ali, pela
// subclasse e pela classe base. Sai só do catálogo -- nunca de uma função
// do app, nem de dados/classes/*.json.
function esperadoNoNivel(subclasse, nivel) {
  const classe = CLASSE_DA_SUBCLASSE[subclasse];
  return conjunto([
    ...((MAGIAS_SUBCLASSE[subclasse] || {})[nivel] || []),
    ...((MAGIAS_CLASSE_SEMPRE[classe] || {})[nivel] || []),
  ]);
}

test('as quatro listas do catálogo cobrem exatamente as 48 subclasses', () => {
  const cobertas = conjunto([
    ...Object.keys(MAGIAS_SUBCLASSE),
    ...Object.keys(SUBCLASSES_MAGIA_POR_ESCOLHA),
    ...Object.keys(SUBCLASSES_MAGIA_OUTRO_MECANISMO),
    ...SUBCLASSES_SEM_MAGIA,
  ]);
  assert.deepEqual(cobertas, conjunto(SUBCLASSES),
    'as quatro listas precisam cobrir as 48, sem sobra nem falta');
});

// Toda entrada das duas listas de exceção precisa de motivo com citação --
// mesmo padrão que excecoes-escolha-repetida.mjs já exige. Uma exceção sem
// motivo tira a subclasse do alcance do motor sem deixar rastro de por quê,
// que é a forma silenciosa de perder cobertura.
test('toda exceção declarada tem motivo citando Classes.md', () => {
  for (const [lista, nome] of [[SUBCLASSES_MAGIA_POR_ESCOLHA, 'SUBCLASSES_MAGIA_POR_ESCOLHA'],
                               [SUBCLASSES_MAGIA_OUTRO_MECANISMO, 'SUBCLASSES_MAGIA_OUTRO_MECANISMO']]) {
    for (const [subclasse, motivo] of Object.entries(lista)) {
      assert.ok(SUBCLASSES.includes(subclasse),
        `${nome}: "${subclasse}" não é uma subclasse conhecida`);
      assert.match(String(motivo), /Classes\.md:\d+/,
        `${nome}[${subclasse}]: motivo sem citação Classes.md:<linha>`);
    }
  }
});

test('todo nível declarado no catálogo de magias é inteiro de 1 a 20 com lista não vazia', () => {
  for (const [subclasse, porNivel] of Object.entries(MAGIAS_SUBCLASSE)) {
    for (const [nivel, magias] of Object.entries(porNivel)) {
      const n = Number(nivel);
      assert.ok(Number.isInteger(n) && n >= 1 && n <= 20,
        `${subclasse}: nível inválido ${nivel}`);
      assert.ok(Array.isArray(magias) && magias.length > 0,
        `${subclasse} nv${nivel}: lista de magias vazia — use SUBCLASSES_SEM_MAGIA para "não concede"`);
      for (const m of magias) {
        assert.equal(typeof m, 'string', `${subclasse} nv${nivel}: nome de magia deve ser string`);
        assert.doesNotMatch(m, /[*_]/, `${subclasse} nv${nivel}: "${m}" carrega marcação markdown`);
      }
    }
  }
});

// Helper: a união do que os DOIS mecanismos do app entregam num nível.
async function concedidasPeloApp(classe, subclasse, nivel) {
  const dominio = await levelup.obterMagiasDominioNivel(classe, subclasse, nivel);
  const sempre = await levelup.obterMagiasSemprePreparadasNivel(classe, subclasse, nivel);
  return conjunto([...dominio, ...sempre].map((m) => m.nome));
}

// Para cada par (subclasse, nível), a UNIÃO do que os dois mecanismos de
// concessão entregam tem de ser exatamente o que o livro concede. Os
// níveis em que o esperado é lista vazia são varridos junto -- são eles
// que pegam magia concedida no nível errado, ou concedida a uma subclasse
// que o livro não contempla.
//
// Só as subclasses de LISTA FIXA e as SEM MAGIA entram aqui: para elas o
// livro fixa o conjunto exato, então `assert.deepEqual` é a asserção
// certa. As duas listas de exceção têm asserção própria, logo abaixo --
// não são puladas.
const COM_CONJUNTO_FIXO = SUBCLASSES.filter((s) =>
  MAGIAS_SUBCLASSE[s] || SUBCLASSES_SEM_MAGIA.includes(s));

for (const subclasse of COM_CONJUNTO_FIXO) {
  const classe = CLASSE_DA_SUBCLASSE[subclasse];
  const niveisDivergentes = NIVEIS_DIVERGENTES_UNIAO[subclasse];
  test(`magias concedidas × livro: ${subclasse} (${classe}, 20 níveis)`, async () => {
    for (let nivel = 1; nivel <= 20; nivel++) {
      // comLacuna() é chamado POR NÍVEL, dentro do laço, só nos níveis
      // onde a Task 6 mediu divergência real -- envolver o laço inteiro
      // (ou todos os 20 níveis de uma subclasse com lacuna) engoliria
      // também os níveis onde app e livro já concordam (ambos vazios),
      // que devem continuar exigindo bater normal.
      const corpo = async () => {
        assert.deepEqual(await concedidasPeloApp(classe, subclasse, nivel),
          esperadoNoNivel(subclasse, nivel), `${subclasse} nv${nivel}`);
      };
      if (niveisDivergentes?.includes(nivel)) {
        await comLacuna(CAUSA_UNIAO_MAGIAS[subclasse], 'subclasses-magias', corpo);
      } else {
        await corpo();
      }
    }
  });
}

// As subclasses cuja concessão depende de ESCOLHA do jogador não têm
// conjunto fixo para comparar -- mas têm um teto que o livro fixa, e é
// esse teto que se afirma. Círculo da Terra é o caso vivo: o livro
// (Classes.md:2406) manda escolher UM terreno entre quatro a cada
// Descanso Longo e conceder só aquela tabela, então o app nunca pode
// entregar mais magias num nível do que UM terreno concede naquele nível.
// `tetoPorNivel` vem do catálogo (a contagem do livro), não do app.
//
// LIMITE DECLARADO desta asserção (achado Important da revisão
// independente): `<=` só é exercitada de verdade perto do valor que
// declara para UMA das duas subclasses. Círculo da Terra é o caso vivo --
// o app entrega 12 nomes no nível 3 contra o teto 3 do livro (é uma das
// cinco falhas desta rodada, ver task-4-report.md), então o teto ali é
// testado com folga real dos dois lados. Colégio do Conhecimento NÃO é:
// o app entrega 0 magias no nível 6 (site/js/levelup.js:547-557 exige
// nomes em itálico no texto da característica, e a descrição de
// Descobertas Mágicas -- Classes.md:768-772, "Você aprende duas magias à
// sua escolha" -- não nomeia nenhuma), então o que roda vivo para essa
// subclasse é o teto IMPLÍCITO de 0 nos outros 19 níveis; o valor 2
// declarado no catálogo nunca é aproximado por uma execução real. Uma
// corrupção que fizesse o app emitir 1 ou 2 nomes espúrios no nível 6
// passaria despercebida por este teste hoje.
//
// Mesmo assim a asserção continua `<=`, não `===`: apertá-la para `=== 0`
// puniria uma implementação futura que passasse a modelar a escolha do
// jogador corretamente (2 magias reais no nível 6) -- o teste passaria a
// cobrar que o app continue SEM implementar a regra do livro, o oposto do
// que esta suíte existe para fazer. O limite fica registrado aqui, não
// numa asserção mais apertada, para "51 testes verdes" não parecer
// garantia maior do que é para o Colégio do Conhecimento.
for (const [subclasse, motivo] of Object.entries(SUBCLASSES_MAGIA_POR_ESCOLHA)) {
  const classe = CLASSE_DA_SUBCLASSE[subclasse];
  const teto = TETO_MAGIAS_POR_ESCOLHA[subclasse];
  const niveisDivergentes = NIVEIS_DIVERGENTES_UNIAO[subclasse];
  test(`teto de magias por escolha × livro: ${subclasse} (${classe})`, async () => {
    assert.ok(teto, `${subclasse}: sem teto declarado em TETO_MAGIAS_POR_ESCOLHA`);
    for (let nivel = 1; nivel <= 20; nivel++) {
      const daClasse = (MAGIAS_CLASSE_SEMPRE[classe] || {})[nivel] || [];
      const daSubclasse = (await concedidasPeloApp(classe, subclasse, nivel))
        .filter((nome) => !daClasse.includes(nome));
      // comLacuna() por nível, mesmo padrão do laço acima: só Círculo da
      // Terra (Causa 2) tem lacuna aqui, e só nos quatro níveis onde a
      // Task 6 mediu o teto violado (Colégio do Conhecimento nunca entra
      // -- não tem entrada em NIVEIS_DIVERGENTES_UNIAO).
      const corpo = () => assert.ok(daSubclasse.length <= (teto[nivel] || 0),
        `${subclasse} nv${nivel}: o app concede ${daSubclasse.length} magias ` +
        `(${daSubclasse.join(', ')}), e o livro concede no máximo ${teto[nivel] || 0} ` +
        `neste nível — ${motivo}`);
      if (niveisDivergentes?.includes(nivel)) {
        await comLacuna(CAUSA_UNIAO_MAGIAS[subclasse], 'subclasses-magias', corpo);
      } else {
        corpo();
      }
    }
  });
}

// As subclasses que concedem por OUTRO mecanismo do livro ("você conhece
// a magia X", "apenas como um Ritual") não podem aparecer na rota de
// sempre-preparada: o que se afirma aqui é que a única coisa que essa
// rota entrega para elas são as concessões da CLASSE. Se a magia
// "conhecida" vazasse para cá, ela viraria sempre preparada -- benefício
// que o livro não concede.
for (const [subclasse, motivo] of Object.entries(SUBCLASSES_MAGIA_OUTRO_MECANISMO)) {
  const classe = CLASSE_DA_SUBCLASSE[subclasse];
  // Ilusionista está NAS DUAS listas (truque conhecido no nv3, magia
  // sempre preparada no nv6), então a asserção de "só o da classe" não
  // vale para ele -- o laço de conjunto fixo acima já o cobre.
  if (MAGIAS_SUBCLASSE[subclasse]) continue;
  test(`concessão por outro mecanismo não vira sempre preparada: ${subclasse} (${classe})`, async () => {
    for (let nivel = 1; nivel <= 20; nivel++) {
      const daClasse = conjunto((MAGIAS_CLASSE_SEMPRE[classe] || {})[nivel] || []);
      assert.deepEqual(await concedidasPeloApp(classe, subclasse, nivel), daClasse,
        `${subclasse} nv${nivel}: só as concessões da classe deveriam aparecer — ${motivo}`);
    }
  });
}

// ============================================================
// Task 5 -- o motor sai do "o parser acha a magia?" para "o personagem
// termina com as magias?": os dois grupos abaixo dirigem subirDeNivel()
// de verdade (escada) e chamam os acessores que a TELA da ficha usa
// (sheet.js), em vez de chamar os mecanismos internos direto como os
// grupos acima fazem.
// ============================================================

// Confronto COMPORTAMENTAL: sobe um personagem de cada uma das 48
// subclasses do nível 1 ao 20 via subirDeNivel() e confere o que ficou
// gravado na ficha. subirDeNivel grava magia de círculo >= 1 em
// magias_preparadas e truque (círculo 0) em magias_conhecidas
// (site/js/levelup.js:1309-1313), então as duas listas entram na conta.
//
// Uma escada completa custa ~230 ms na primeira e ~8 ms nas seguintes
// (db.js cacheia dados/), medido em 2026-08-17 -- por isso as 48 rodam,
// não uma amostra.
//
// LIMITE DECLARADO DESTA ROTA, medido em 2026-08-17: a escada começa a
// chamar subirDeNivel no nível 2, então nenhuma concessão de NÍVEL 1
// passa por ela. Duas existem e são de classe, não de subclasse:
// `Marca do Caçador` (Guardião, característica Inimigo Favorito) e
// `Falar com Animais` (Druida, característica Idioma Druídico). Medido:
// a escada grava `[]` para as duas, enquanto o acessor da ficha
// (Step 2, que varre 1..20) devolve as duas corretamente.
//
// Por isso o esperado AQUI é a união dos níveis 2..20, e não 1..20 --
// exigir o nível 1 nesta rota produziria duas falhas sem defeito do app
// por trás (o erro 5 do GUIA-PROXIMOS-DOMINIOS.md: fixture que não
// satisfaz o pré-requisito e faz o teste acusar o que não deve). Quem
// cobre o nível 1 é o Step 2, e é isso que torna as duas rotas
// complementares em vez de redundantes.
//
// PERGUNTA EM ABERTO, para uma rodada futura -- NÃO a conclua aqui: um
// personagem criado no nível 1 pelo assistente recebe essa magia? O
// fluxo de criação é outro caminho de código (site/js/creator/), que
// esta suíte não dirige. Se você for procurar, procure de verdade e
// cite arquivo e linha nos dois sentidos; não registre ausência sem ter
// esgotado a busca.
for (const subclasse of SUBCLASSES) {
  const classe = CLASSE_DA_SUBCLASSE[subclasse];
  // Achado I2 da revisão final: SUBCLASSES_MAGIA_POR_ESCOLHA (Círculo da
  // Terra, Colégio do Conhecimento) não tem lista fixa -- esperadoNoNivel()
  // devolveria só a concessão da CLASSE base para elas, o que afirmaria "esta
  // subclasse não concede nada", falso pelo livro (o mesmo erro nº 1 do
  // GUIA-PROXIMOS-DOMINIOS.md, medir o mecanismo em vez do comportamento).
  // Tratamento ceiling-based abaixo, espelhando o teste de teto que a rota
  // de parser já faz (ver TETO_MAGIAS_POR_ESCOLHA acima) -- para (a) uma
  // implementação futura correta da escolha do jogador não acender vermelho
  // sem lacuna, (b) o excesso de hoje (Círculo da Terra) continuar sendo
  // pego, e (c) o wrap poder disparar "Lacuna corrigida" quando o app for
  // consertado.
  const teto = TETO_MAGIAS_POR_ESCOLHA[subclasse];
  test(`ficha depois da escada 1→20 × livro: ${subclasse} (${classe})`, async () => {
    const personagem = await escadaDeNivel(classe, () => {}, { subclasse });
    const concedidas = conjunto([
      ...(personagem.magias_preparadas || []),
      ...(personagem.magias_conhecidas || []),
    ].filter((m) => m.origem === 'dominio' || m.origem === 'sempre')
     .map((m) => m.nome));

    if (teto) {
      // Soma dos tetos por nível declarados no catálogo, só nos níveis
      // 2-20 (o nível 1 fica fora por construção da escada, mesmo limite
      // do bloco de conjunto fixo acima) -- descontada a concessão da
      // CLASSE base, do mesmo jeito que a rota de parser já faz.
      const daClasse = conjunto(
        Array.from({ length: 19 }, (_, i) => (MAGIAS_CLASSE_SEMPRE[classe] || {})[i + 2] || [])
          .flat());
      const daSubclasse = concedidas.filter((nome) => !daClasse.includes(nome));
      const tetoTotal = Object.values(teto).reduce((soma, n) => soma + n, 0);
      const corpo = () => assert.ok(daSubclasse.length <= tetoTotal,
        `${subclasse}: a ficha do nível 20 (via escada 2-20) tem ${daSubclasse.length} ` +
        `magias de subclasse (${daSubclasse.join(', ')}), e o livro concede no máximo ` +
        `${tetoTotal} (soma de TETO_MAGIAS_POR_ESCOLHA nos níveis 2-20)`);
      if (CAUSA_UNIAO_MAGIAS[subclasse]) {
        await comLacuna(CAUSA_UNIAO_MAGIAS[subclasse], 'subclasses-magias', corpo);
      } else {
        corpo();
      }
      return;
    }

    // Níveis 2..20: o nível 1 fica fora por construção da escada (ver o
    // limite declarado acima), não por escolha de conveniência.
    const esperado = conjunto(
      Array.from({ length: 19 }, (_, i) => esperadoNoNivel(subclasse, i + 2)).flat());

    // Asserção única (não há laço por nível aqui -- é a UNIÃO 2..20 de uma
    // só vez), então o wrap cobre a asserção inteira sem risco de engolir
    // uma irmã: as 5 subclasses da Task 6 são as únicas com entrada em
    // CAUSA_UNIAO_MAGIAS.
    const corpo = () => assert.deepEqual(concedidas, esperado,
      `${subclasse}: magias concedidas na ficha do nível 20 (níveis 2-20; ` +
      `o nível 1 é coberto pelo teste dos acessores da ficha)`);
    if (CAUSA_UNIAO_MAGIAS[subclasse]) {
      await comLacuna(CAUSA_UNIAO_MAGIAS[subclasse], 'subclasses-magias', corpo);
    } else {
      corpo();
    }
  });
}

// site/js/pages/sheet.js:48-49 monta a ficha com estas duas funções, e
// elas NÃO são as mesmas que subirDeNivel usa: obterTodasMagiasDominio
// (site/js/levelup.js:797) varre uma lista fixa de níveis, [3,5,7,9],
// enquanto obterTodasMagiasSemprePreparadas (:640) varre 1..nivelAtual.
// Uma subclasse que conceda fora daqueles quatro níveis pela rota de
// domínio ficaria de fora da ficha mesmo com a subida de nível correta --
// por isso este confronto é separado do Step 1, e não uma repetição dele.
for (const subclasse of SUBCLASSES) {
  const classe = CLASSE_DA_SUBCLASSE[subclasse];
  // Mesmo tratamento de teto do bloco da escada, acima -- aqui a soma cobre
  // os níveis 1-20 (esta rota, diferente da escada, também varre o nível 1).
  const teto = TETO_MAGIAS_POR_ESCOLHA[subclasse];
  test(`acessores da ficha × livro: ${subclasse} (${classe}, nível 20)`, async () => {
    const dominio = await levelup.obterTodasMagiasDominio(classe, subclasse, 20);
    const sempre = await levelup.obterTodasMagiasSemprePreparadas(classe, subclasse, 20);
    const obtido = conjunto([...dominio, ...sempre].map((m) => m.nome));

    if (teto) {
      const daClasse = conjunto(
        Array.from({ length: 20 }, (_, i) => (MAGIAS_CLASSE_SEMPRE[classe] || {})[i + 1] || [])
          .flat());
      const daSubclasse = obtido.filter((nome) => !daClasse.includes(nome));
      const tetoTotal = Object.values(teto).reduce((soma, n) => soma + n, 0);
      const corpo = () => assert.ok(daSubclasse.length <= tetoTotal,
        `${subclasse}: os acessores da ficha (nível 20) devolvem ${daSubclasse.length} ` +
        `magias de subclasse (${daSubclasse.join(', ')}), e o livro concede no máximo ` +
        `${tetoTotal} (soma de TETO_MAGIAS_POR_ESCOLHA nos níveis 1-20)`);
      if (CAUSA_UNIAO_MAGIAS[subclasse]) {
        await comLacuna(CAUSA_UNIAO_MAGIAS[subclasse], 'subclasses-magias-ficha', corpo);
      } else {
        corpo();
      }
      return;
    }

    const esperado = conjunto(
      Array.from({ length: 20 }, (_, i) => esperadoNoNivel(subclasse, i + 1)).flat());

    // Asserção única, mesmo raciocínio do bloco da escada acima -- só que
    // pela chave 'subclasses-magias-ficha' (rota separada dos acessores
    // que site/js/pages/sheet.js chama, ver comentário de TESTES_VALIDOS
    // em lacunas-conhecidas.mjs).
    const corpo = () => assert.deepEqual(obtido, esperado,
      `${subclasse}: o que a ficha exibiria no nível 20`);
    if (CAUSA_UNIAO_MAGIAS[subclasse]) {
      await comLacuna(CAUSA_UNIAO_MAGIAS[subclasse], 'subclasses-magias-ficha', corpo);
    } else {
      corpo();
    }
  });
}
