// ============================================================
// Issue #46: a magia customizada de círculo 1+ passou a ser SEMPRE
// preparada, DERIVADA de `char.magias_customizadas`. As entradas que fichas
// antigas gravaram em `char.magias_preparadas` ao clicar "Preparar" viraram
// cópia de um fato que agora tem uma morada só -- e desenhá-las nas duas
// telas mostraria a mesma magia duas vezes.
//
// POR QUE PRESERVAR A ÓRFÃ: uma entrada marcada `personalizada` SEM lastro
// em `magias_customizadas` não é a magia do jogador -- é marca errada (o
// jogador removeu a customizada e a preparada ficou, ou a marca foi gravada
// numa homônima do acervo). Apagá-la seria perda de dado silenciosa numa
// migração que roda em TODA abertura de ficha. Ela fica, sem a marca.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { sheetEstado, sheetMigracoes, db, regrasOrigensMagia } = await modulosApp();

// `migrarCopiasCustomizadasDoGrimorio` (passo B, abaixo) lê o acervo de
// `indiceMagiasCache`, o mesmo cache que sheet.js popula com
// `definirIndiceMagias` antes de rodar as migrações. Semeia-se aqui com o
// índice REAL do disco para que os oráculos da ressalva meçam o acervo de
// verdade: se "Bênção" saísse de `dados/magias/_indice.json`, ou "Névoa de
// Nimb" entrasse, o teste quebra em vez de passar por engano.
const INDICE_REAL = (await db.getIndiceMagias())?.magias || [];
sheetEstado.definirIndiceMagias(INDICE_REAL);

/** Ficha mínima: a migração só lê as duas listas de magia. */
const ficha = (campos) => ({
  classe: 'Mago', nivel: 3,
  magias_preparadas: [],
  magias_customizadas: [],
  ...campos,
});

test('entrada personalizada COM lastro sai de magias_preparadas', () => {
  const p = ficha({
    magias_preparadas: [
      { nome: 'Bola de Fogo', circulo: 3, classe: 'Mago' },
      { nome: 'Névoa de Nimb', circulo: 1, classe: 'Mago', personalizada: true },
    ],
    magias_customizadas: [{ nome: 'Névoa de Nimb', circulo: 1, escola: 'Adivinhação' }],
  });
  sheetEstado.definirChar(p);

  const alterado = sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

  assert.equal(alterado, true, 'havia uma entrada com lastro -- a migração tinha de alterar');
  assert.deepEqual(p.magias_preparadas.map(m => m.nome), ['Bola de Fogo'],
    'a customizada sai de magias_preparadas (agora é derivada); a do livro fica');
  assert.equal(p.magias_customizadas.length, 1,
    'magias_customizadas é a morada dela -- a migração não pode tocá-la');
});

test('entrada personalizada SEM lastro fica, perdendo só a marca', () => {
  const p = ficha({
    magias_preparadas: [
      { nome: 'Bênção', circulo: 1, classe: 'Clérigo', personalizada: true },
    ],
    magias_customizadas: [],
  });
  sheetEstado.definirChar(p);

  const alterado = sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

  assert.equal(alterado, true, 'a marca órfã foi removida -- houve alteração');
  assert.equal(p.magias_preparadas.length, 1, 'nada some da ficha do jogador');
  assert.equal(p.magias_preparadas[0].personalizada, undefined,
    'sem lastro a marca é falsa: a entrada volta a ser magia do livro');
});

test('lastro casa por nome E círculo: homônima de outro círculo não é lastro', () => {
  const p = ficha({
    magias_preparadas: [
      { nome: 'Bênção', circulo: 1, classe: 'Clérigo', personalizada: true },
    ],
    magias_customizadas: [{ nome: 'Bênção', circulo: 2 }],
  });
  sheetEstado.definirChar(p);

  sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

  assert.equal(p.magias_preparadas.length, 1,
    'a customizada de 2º círculo não é lastro para a preparada de 1º -- são magias diferentes');
});

test('ficha antiga: círculo gravado como string casa com o numérico', () => {
  const p = ficha({
    magias_preparadas: [{ nome: 'Névoa de Nimb', circulo: 1, personalizada: true }],
    magias_customizadas: [{ nome: 'Névoa de Nimb', circulo: '1' }],
  });
  sheetEstado.definirChar(p);

  sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

  assert.equal(p.magias_preparadas.length, 0,
    'o formulário gravava círculo em string; o lastro tem de enxergar os dois formatos');
});

// O NOME DIZ QUAL MIGRAÇÃO: há um par destes, um por migração, e nomes
// iguais ficam indistinguíveis na saída TAP.
//
// A SEGUNDA ENTRADA DO FIXTURE É O QUE FAZ O TESTE MEDIR. Sem ela, a
// primeira passagem esvazia `magias_preparadas` e a segunda chamada volta na
// SAÍDA BARATA (`preparadas.length === 0`), sem tocar em uma linha da lógica:
// o teste passaria até com uma implementação que grava a cada passagem.
// A "Bênção" crua é NÃO-CANDIDATA de propósito -- sem marca e sem `origem`,
// com lastro em `magias_customizadas`, mas homônima de uma magia REAL de 1º
// círculo do acervo, então o caminho 2 a declara ambígua e preserva. Ela
// sobrevive à primeira passagem E mantém `temCandidataCrua` verdadeiro, o que
// obriga a segunda chamada a passar pela guarda barata, montar o índice do
// acervo e percorrer o laço inteiro antes de responder `false`.
test('idempotente em magias_preparadas: a segunda passagem percorre a lógica e não altera nada', () => {
  const p = ficha({
    magias_preparadas: [
      { nome: 'Névoa de Nimb', circulo: 1, personalizada: true },
      { nome: 'Bênção', circulo: 1, classe: 'Clérigo' },
    ],
    magias_customizadas: [
      { nome: 'Névoa de Nimb', circulo: 1 },
      { nome: 'Bênção', circulo: 1 },
    ],
  });
  sheetEstado.definirChar(p);

  assert.equal(sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas(), true);
  assert.deepEqual(p.magias_preparadas.map(m => m.nome), ['Bênção'],
    'a marcada sai; a crua homônima do acervo é ambígua e fica -- é ela que mantém a '
    + 'segunda passagem fora da saída barata');

  assert.equal(sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas(), false,
    'roda em TODA abertura de ficha -- uma segunda passagem que grava faria salvar() '
    + 'a cada render, sem nada para converter');
  assert.deepEqual(p.magias_preparadas.map(m => m.nome), ['Bênção'],
    'a segunda passagem não pode remover a entrada que a primeira preservou');
});

test('ficha sem nenhuma das listas não lança', () => {
  sheetEstado.definirChar({ classe: 'Mago', nivel: 3 });
  assert.equal(sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas(), false);
});

// ============================================================
// A ENTRADA CRUA, sem marca nenhuma (residual achado pela Task 5).
//
// Ficha MUITO antiga -- Mago de antes das issues #27/#33 -- em que o jogador
// preparou a magia customizada pelo grimório numa época em que o gravador não
// carimbava `personalizada`. A entrada está em `magias_preparadas` CRUA. A
// marca, que é a prova de origem dos oráculos acima, não existe ali.
//
// Depois que a ficha passou a DERIVAR a customizada de
// `char.magias_customizadas` no render, essa entrada crua faz a mesma magia
// ser desenhada duas vezes: uma pelo ramo do acervo (com `data-magia-nome` e
// descrição vazia, porque a magia não está no acervo) e outra por
// `renderLinhaMagiaPersonalizada`.
//
// O DESEMPATE é o MESMO de `migrarCopiasCustomizadasDoGrimorio` (passo B,
// mais abaixo), e pelo mesmo motivo: remover por nome+círculo apagaria a
// preparação LEGÍTIMA da magia do livro homônima. Só sai a entrada cujo nome
// NÃO existe no acervo naquele círculo -- a única em que a origem é
// inequívoca. Sem acervo carregado, este caminho inteiro é pulado.
// ============================================================

test('entrada CRUA (sem marca) sai quando o acervo não tem homônima', () => {
  // "Névoa de Nimb" não existe no acervo: a entrada só pode ter vindo da
  // customizada, preparada por um gravador antigo que não marcava nada.
  const p = ficha({
    magias_preparadas: [
      { nome: 'Bola de Fogo', circulo: 3, classe: 'Mago' },
      { nome: 'Névoa de Nimb', circulo: 1, classe: 'Mago' },
    ],
    magias_customizadas: [{ nome: 'Névoa de Nimb', circulo: 1 }],
  });
  sheetEstado.definirChar(p);

  const alterado = sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

  assert.equal(alterado, true, 'a entrada crua tinha de sair');
  assert.deepEqual(p.magias_preparadas.map(m => m.nome), ['Bola de Fogo'],
    'sem a remoção a ficha desenha "Névoa de Nimb" duas vezes: crua pelo ramo do '
    + 'acervo e derivada por renderLinhaMagiaPersonalizada');
  assert.equal(p.magias_customizadas.length, 1,
    'magias_customizadas é a morada dela -- a migração não pode tocá-la');
});

test('entrada CRUA PRESERVADA quando o acervo tem homônima do mesmo círculo', () => {
  // "Bênção" é magia de 1º círculo do acervo. Um Clérigo/Mago pode ter criado
  // a SUA "Bênção" e preparado a do LIVRO: a entrada crua é ambígua, e apagar
  // seria perda de dado silenciosa.
  const p = ficha({
    magias_preparadas: [{ nome: 'Bênção', circulo: 1, classe: 'Clérigo' }],
    magias_customizadas: [{ nome: 'Bênção', circulo: 1 }],
  });
  sheetEstado.definirChar(p);

  const alterado = sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

  assert.equal(alterado, false, 'nada a fazer: a única candidata é ambígua');
  assert.equal(p.magias_preparadas.length, 1,
    'o acervo TEM "Bênção" de 1º círculo -- a entrada pode ser a preparação legítima da '
    + 'magia do livro, e na dúvida preserva');
  assert.equal(p.magias_preparadas[0].personalizada, undefined,
    'preservar não é carimbar: a migração nunca INVENTA a marca que não estava lá');
});

test('índice vazio: o caminho da entrada crua é pulado, o da marca continua removendo', (t) => {
  // Restaura o índice real ao fim, aconteça o que acontecer -- os vizinhos
  // deste arquivo dependem dele.
  t.after(() => sheetEstado.definirIndiceMagias(INDICE_REAL));

  const p = ficha({
    magias_preparadas: [
      { nome: 'Névoa de Nimb', circulo: 1, classe: 'Mago' },
      { nome: 'Sopro de Vidro', circulo: 2, classe: 'Mago', personalizada: true },
    ],
    magias_customizadas: [
      { nome: 'Névoa de Nimb', circulo: 1 },
      { nome: 'Sopro de Vidro', circulo: 2 },
    ],
  });
  sheetEstado.definirChar(p);
  sheetEstado.definirIndiceMagias([]);

  const alterado = sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

  assert.equal(alterado, true, 'a entrada COM marca sai mesmo sem acervo carregado');
  assert.deepEqual(p.magias_preparadas.map(m => m.nome), ['Névoa de Nimb'],
    'os dois caminhos são independentes: a marca é prova de origem e não precisa do '
    + 'acervo; a entrada CRUA, sem acervo para consultar, é indistinguível da magia do '
    + 'livro e fica');

  // Índice ausente (null, antes de definirIndiceMagias rodar) é o mesmo "não sei".
  sheetEstado.definirIndiceMagias(null);
  assert.equal(sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas(), false);
  assert.equal(p.magias_preparadas.length, 1);
});

test('idempotente no caminho da entrada crua: a segunda passagem devolve false', () => {
  const p = ficha({
    magias_preparadas: [{ nome: 'Névoa de Nimb', circulo: 1, classe: 'Mago' }],
    magias_customizadas: [{ nome: 'Névoa de Nimb', circulo: 1 }],
  });
  sheetEstado.definirChar(p);

  assert.equal(sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas(), true);
  assert.equal(sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas(), false,
    'roda em TODA abertura de ficha -- uma segunda passagem que grava faria salvar() '
    + 'a cada render, sem nada para converter');
});

// ============================================================
// A ENTRADA CONCEDIDA nunca é candidata do caminho 2.
//
// O caminho 2 desempata pelo acervo ("o nome não existe neste círculo"), e há
// concessão real que cai nesse buraco. `site/js/levelup.js:966` grava a magia
// concedida com `circulo: magiaIdx?.circulo || 1` -- o `|| 1` transforma
// círculo 0 em 1, e SETE concessões de subclasse são truques do livro:
// Chama Sagrada e Luz (Bruxo/Patrono Celestial), Fagulha Estelar (Druida/
// Círculo da Lua), Raio de Fogo, Raio de Gelo e Toque Chocante (Círculo da
// Terra) e Raio de Gelo (Círculo do Mar). O acervo tem todas no círculo 0, e
// a entrada gravada diz 1: "não existe no acervo naquele círculo" é
// VERDADEIRO para elas.
//
// A perda seria DEFINITIVA: magia de domínio só entra em level-up, e
// `migrarMagiasDominio` apenas carimba entradas existentes -- nunca readiciona.
//
// A guarda é `origem`: quem escreve `origem` é mecanismo de CONCESSÃO, nunca
// o gravador do grimório que o caminho 2 existe para limpar (aquele grava
// `{ nome, circulo, classe }`, sem `origem`). Pular entrada carimbada não
// perde nada do que o caminho 2 procura.
//
// O `|| 1` de levelup.js é a causa raiz e um defeito por si -- truque
// concedido na lista errada, no círculo errado. Está fora do alcance da issue
// #46 e virou issue própria; esta guarda protege o dado enquanto isso.
//
// COMO ESTES ORÁCULOS SÃO ARMADOS, e por que não bastava a entrada concedida
// sozinha. Um cenário com UMA entrada só (a concedida) não mede a guarda: ele
// mede a saída barata, que dispara por não haver candidata nenhuma. Provado
// por mutação -- com a guarda apenas na pré-checagem da saída barata, e
// nenhuma no laço, o cenário de entrada única fica VERDE, e a implementação
// está quebrada (basta a ficha ter OUTRA candidata crua para a saída barata
// não disparar, a função seguir e a concedida ser apagada). Por isso todo
// oráculo desta seção carrega uma SEGUNDA entrada, crua e genuinamente
// removível: ela obriga a função a percorrer o laço.
//
// E por isso cada um cobre DUAS origens. Uma lista branca estreita
// (`origem === 'dominio'`) satisfaz um oráculo que só usa domínio, e deixa
// `subclasse_escolha`, `iniciado_em_magia`, `tocado_por_fadas` e as demais
// desprotegidas. `subclasse_escolha` é o par natural do domínio aqui:
// `regras-subclasse-escolhas.js:469` grava a Descoberta Mágica com
// `contexto.circulos?.[nome] ?? 1` -- e o comentário de lá diz que o `1` é o
// último recurso para "um nome que o índice não conhece (magia
// personalizada)". Ou seja: a magia inventada pelo jogador, escolhida numa
// Descoberta Mágica, entra em `magias_preparadas` com círculo 1 e nome que o
// acervo não tem -- candidata perfeita do caminho 2, e concessão real.
// ============================================================

test('entrada com `origem` NUNCA é removida pelo caminho 2 -- com candidata crua ao lado, e em duas origens', () => {
  // Bruxo/Patrono Celestial que criou a SUA magia de 1º círculo chamada
  // "Luz". "Luz" existe no acervo só no círculo 0, então o desempate do
  // caminho 2 diria "não existe no 1º círculo" -- e apagaria a concessão.
  //
  // "Névoa de Nimb" (`subclasse_escolha`) é a Descoberta Mágica gasta na
  // magia que o próprio jogador inventou: o índice não a conhece, então o
  // gravador caiu no círculo 1 de último recurso.
  //
  // "Sopro de Vidro" é a CANDIDATA CRUA -- sem marca, sem origem, com lastro
  // e ausente do acervo. Ela existe para que a saída barata NÃO dispare: sem
  // ela, este cenário mediria o curto-circuito, não a guarda.
  const p = ficha({
    classe: 'Bruxo',
    magias_preparadas: [
      { nome: 'Luz', circulo: 1, classe: 'Bruxo', origem: 'dominio' },
      { nome: 'Névoa de Nimb', circulo: 1, classe: 'Bruxo', origem: 'subclasse_escolha' },
      { nome: 'Sopro de Vidro', circulo: 2, classe: 'Bruxo' },
    ],
    magias_customizadas: [
      { nome: 'Luz', circulo: 1 },
      { nome: 'Névoa de Nimb', circulo: 1 },
      { nome: 'Sopro de Vidro', circulo: 2 },
    ],
  });
  sheetEstado.definirChar(p);

  const alterado = sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

  assert.equal(alterado, true,
    'a candidata crua saiu -- prova de que a função PERCORREU o laço em vez de sair barato');
  assert.deepEqual(p.magias_preparadas.map(m => m.nome), ['Luz', 'Névoa de Nimb'],
    'concessão não tem como ser recriada -- level-up não roda de novo, e '
    + 'migrarMagiasDominio só carimba o que já existe');
  assert.deepEqual(p.magias_preparadas.map(m => m.origem), ['dominio', 'subclasse_escolha'],
    'a guarda vale para QUALQUER origem, não só `dominio`: uma lista branca estreita '
    + 'deixaria subclasse_escolha, iniciado_em_magia e as demais desprotegidas');
  assert.equal(p.magias_preparadas.some(m => m.personalizada), false,
    'nenhuma delas tinha a marca -- e preservar não é carimbar');
});

test('caminho 1: entrada com `origem` E com a marca `personalizada` fica, perdendo só a marca', () => {
  // A MARCA E `origem` CONVIVEM na mesma entrada, por dois mecanismos
  // independentes -- e é por isso que a guarda tem de vir ANTES do ramo que
  // testa a marca, não dentro do ramo que não a tem:
  //
  //  1. `_concederMagiaAutomatica` (levelup.js:1064) casa POR NOME e, achando
  //     entrada existente, só carimba `origem`/`circulo`. A marca
  //     `personalizada` que a ficha antiga gravou sobrevive ao carimbo.
  //  2. `migrarMagiasDominio` e `migrarMagiasSemprePreparadas` (o mesmo
  //     sheet/migracoes.js) carimbam `origem` POR NOME SÓ, em entradas
  //     existentes, e rodam em pages/sheet.js DEZ LINHAS ANTES desta
  //     migração, na mesma abertura de ficha. Nenhuma delas pula entrada com
  //     a marca.
  //
  // Cenário medido: Clérigo com a sua própria "Bênção" de 1º círculo em
  // `magias_customizadas`. O caminho 1 (marca + lastro) apagava a entrada,
  // com `salvar()`, em silêncio -- e o que sumia era a CONCESSÃO: o rótulo, a
  // isenção do limite de preparadas e a vaga do orçamento. A magia customizada
  // continuava desenhada (derivada), então o jogador não percebia.
  //
  // A MARCA, essa, SAI: `sheet/grimorio.js` (`entradaEhDoCartao`) documenta
  // como invariante que nenhuma entrada de `magias_preparadas` carrega mais
  // `personalizada`, e se apoia nisso.
  //
  // "TOQUE GÉLIDO" É A ENTRADA QUE PINA A EXCLUSÃO DA MARCA, e ela está aqui
  // porque sem ela esta implementação errada passava o arquivo inteiro:
  //
  //     if (magia.personalizada && temLastro(magia.nome, magia.circulo)) {
  //       delete magia.personalizada; alterado = true;
  //     }
  //
  // Ela deixa VIVA uma entrada carregando `personalizada` sempre que não
  // houver customizada casando nome e círculo -- quebrando a invariante de
  // `entradaEhDoCartao`, que é load-bearing. O cenário é real e não exige
  // nada de exótico: a marca foi carimbada POR NOME numa magia do LIVRO
  // (gravador antigo do painel Grimório), o jogador REMOVEU a customizada
  // depois, e `migrarMagiasDominio` carimbou `origem` dez linhas antes, na
  // mesma abertura. Por isso "Toque Gélido" entra COM `origem` e COM a marca,
  // e SEM lastro em `magias_customizadas`: ela fica, e perde a marca.
  //
  // QUATRO ORIGENS, de quatro famílias diferentes (subclasse, talento,
  // espécie, característica de classe), mais as duas do oráculo anterior
  // (`dominio` e `subclasse_escolha`): uma lista branca teria de enumerar
  // cinco origens distintas de `ORIGENS_MAGIA_ISENTA`
  // (site/js/regras-origens-magia.js) para sobreviver aos dois oráculos.
  const p = ficha({
    classe: 'Clérigo',
    magias_preparadas: [
      { nome: 'Bênção', circulo: 1, classe: 'Clérigo', origem: 'dominio', personalizada: true },
      { nome: 'Névoa de Nimb', circulo: 1, classe: 'Clérigo', origem: 'iniciado_em_magia', personalizada: true },
      { nome: 'Sopro de Vidro', circulo: 2, classe: 'Clérigo', origem: 'especie_legado', personalizada: true },
      { nome: 'Toque Gélido', circulo: 1, classe: 'Clérigo', origem: 'maestria_magias', personalizada: true },
      { nome: 'Chama do Fogo Fátuo', circulo: 3, classe: 'Clérigo', personalizada: true },
    ],
    magias_customizadas: [
      { nome: 'Bênção', circulo: 1 },
      { nome: 'Névoa de Nimb', circulo: 1 },
      { nome: 'Sopro de Vidro', circulo: 2 },
      // "Toque Gélido" NÃO entra aqui de propósito -- é a entrada sem lastro.
      { nome: 'Chama do Fogo Fátuo', circulo: 3 },
    ],
  });
  sheetEstado.definirChar(p);

  const alterado = sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

  assert.equal(alterado, true, 'as marcas saíram e a marcada sem origem foi removida');
  assert.deepEqual(p.magias_preparadas.map(m => m.nome),
    ['Bênção', 'Névoa de Nimb', 'Sopro de Vidro', 'Toque Gélido'],
    'as quatro concedidas ficam, nas quatro origens -- COM lastro ou SEM ele; só a '
    + 'marcada SEM origem, a que o caminho 1 existe para limpar, é que sai');
  assert.deepEqual(p.magias_preparadas.map(m => m.origem),
    ['dominio', 'iniciado_em_magia', 'especie_legado', 'maestria_magias'],
    'a guarda preserva o carimbo inteiro, em qualquer origem');
  assert.equal(p.magias_preparadas.some(m => m.personalizada), false,
    'a marca some das QUATRO, com lastro ou sem: grimorio.js se apoia no invariante de '
    + 'que nenhuma entrada de magias_preparadas a carrega mais, e apagá-la só quando há '
    + 'lastro deixaria "Toque Gélido" viva com a marca');
  assert.equal(sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas(), false,
    'roda em TODA abertura de ficha -- apagada a marca, a segunda passagem não grava');
});

test('apagar a marca da entrada concedida É alteração: sozinha, ela obriga o retorno true', () => {
  // A marca numa entrada concedida é a ÚNICA mutação pendente desta ficha.
  //
  // Se a guarda apagasse a marca sem marcar `alterado`, o `delete` aconteceria
  // só na MEMÓRIA: `char.magias_preparadas` não seria reatribuída, `salvar()`
  // não rodaria, e na abertura seguinte a marca estaria de volta -- para
  // sempre, porque a migração roda em TODA abertura e nunca persistiria a
  // correção. Nenhum outro oráculo pega isso: em todo cenário com mais de uma
  // entrada, a remoção da vizinha já liga `alterado` e mascara a falta.
  //
  // O lastro aqui também importa: sem a guarda no laço, esta entrada (marca +
  // lastro, caminho 1) seria REMOVIDA, e a asserção de que ela fica pega isso.
  const p = ficha({
    classe: 'Clérigo',
    magias_preparadas: [
      { nome: 'Bênção', circulo: 1, classe: 'Clérigo', origem: 'dominio', personalizada: true },
    ],
    magias_customizadas: [{ nome: 'Bênção', circulo: 1 }],
  });
  sheetEstado.definirChar(p);

  assert.equal(sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas(), true,
    'a marca apagada É alteração -- sem `alterado`, nada é persistido e ela volta na '
    + 'próxima abertura da ficha');
  assert.equal(p.magias_preparadas.length, 1, 'a concessão fica');
  assert.equal(p.magias_preparadas[0].origem, 'dominio', 'com o carimbo intacto');
  assert.equal(p.magias_preparadas[0].personalizada, undefined, 'e sem a marca');
  assert.equal(sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas(), false,
    'e a segunda passagem não tem mais o que fazer');
});

// ============================================================
// A GUARDA É TRUTHINESS DE `origem` -- NÃO uma lista, branca ou negra.
//
// Item parkeado pela Task 2 (cap de 5 rounds) e roteado para a onda de
// correção da revisão final de branch. Os oráculos acima cobrem CINCO
// origens nomeadas (`dominio`, `subclasse_escolha`, `iniciado_em_magia`,
// `especie_legado`, `maestria_magias`), e isso deixava passar, com a suíte
// INTEIRA verde, duas implementações erradas:
//
//   LISTA NEGRA: `magia?.origem && magia.origem !== 'assinatura_magica'`
//     -- um Mago 20 perde a concessão de Assinatura Mágica em silêncio.
//   LISTA BRANCA: `ORIGENS_MAGIA_ISENTA.includes(magia?.origem)`
//     -- toda origem fora daquela lista fica desprotegida.
//
// A TABELA SOBRE `ORIGENS_MAGIA_ISENTA` MATA A LISTA NEGRA, mas NÃO basta
// para a lista branca: a guarda do código protege QUALQUER `origem` truthy,
// e há origens vivas que não estão em `ORIGENS_MAGIA_ISENTA` --
// `subclasse_fixa` e `subclasse_automatica` (subclasse), `especie` (truque
// de espécie) e `telecinetico` (talento) --, além das que ainda não existem.
// Por isso a tabela termina numa string ARBITRÁRIA E DESCONHECIDA: é ela,
// e só ela, que trava a truthiness em si. Qualquer enumeração de origens,
// por mais completa que seja hoje, falha nessa linha.
//
// CADA LINHA MEDE OS DOIS CAMINHOS: "Selo de Nimb" tem marca + lastro
// (caminho 1) e "Pó de Nimb" é crua com lastro e ausente do acervo naquele
// círculo (caminho 2) -- sem a guarda, as duas sairiam. "Sopro de Vidro" é
// a candidata genuinamente removível: ela existe para que a saída barata
// NÃO dispare e a função percorra o laço, e o `alterado === true` é a prova
// de que percorreu.
// ============================================================

// Nomes inventados, ausentes do índice real (conferido): usá-los garante
// que o desempate do caminho 2 ("não existe no acervo neste círculo") seja
// VERDADEIRO, que é o que torna a entrada removível na ausência da guarda.
const ENTRADA_CAMINHO_1 = { nome: 'Selo de Nimb', circulo: 1 };
const ENTRADA_CAMINHO_2 = { nome: 'Pó de Nimb', circulo: 2 };
const ENTRADA_REMOVIVEL = { nome: 'Sopro de Vidro', circulo: 3 };

/** Ficha com as duas entradas protegidas por `origem` e uma removível ao lado. */
const fichaDeOrigem = (origem) => ficha({
  classe: 'Mago',
  magias_preparadas: [
    { ...ENTRADA_CAMINHO_1, classe: 'Mago', origem, personalizada: true },
    { ...ENTRADA_CAMINHO_2, classe: 'Mago', origem },
    { ...ENTRADA_REMOVIVEL, classe: 'Mago' },
  ],
  magias_customizadas: [ENTRADA_CAMINHO_1, ENTRADA_CAMINHO_2, ENTRADA_REMOVIVEL],
});

const ORIGENS_PROTEGIDAS = [
  // As dez de ORIGENS_MAGIA_ISENTA, lidas da fonte: acrescentar uma origem
  // lá e esquecer esta guarda passa a ser impossível.
  ...regrasOrigensMagia.ORIGENS_MAGIA_ISENTA,
  // Origens VIVAS que não estão naquela lista -- a guarda também as protege.
  'especie',
  'telecinetico',
  'subclasse_fixa',
  'subclasse_automatica',
  // A LINHA QUE TRAVA A TRUTHINESS: string arbitrária, que nenhuma lista
  // branca poderia conter. Não remova nem troque por uma origem "de
  // verdade" -- ela não representa um mecanismo, representa a REGRA ("basta
  // ter `origem`"), e é a única que derruba a implementação em lista branca.
  'origem-inventada-que-o-app-ainda-nao-tem',
];

for (const origem of ORIGENS_PROTEGIDAS) {
  test(`origem "${origem}": a guarda preserva a entrada nos DOIS caminhos`, () => {
    const p = fichaDeOrigem(origem);
    sheetEstado.definirChar(p);

    const alterado = sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

    assert.equal(alterado, true,
      'a candidata crua sem `origem` saiu -- prova de que a função PERCORREU o laço '
      + 'em vez de voltar na saída barata');
    assert.deepEqual(p.magias_preparadas.map(m => m.nome),
      [ENTRADA_CAMINHO_1.nome, ENTRADA_CAMINHO_2.nome],
      `origem "${origem}" tem de proteger a entrada nos dois caminhos -- a guarda é `
      + 'truthiness de `origem`, não uma lista de origens conhecidas');
    assert.deepEqual(p.magias_preparadas.map(m => m.origem), [origem, origem],
      'o carimbo fica intacto: preservar não é reescrever');
    assert.equal(p.magias_preparadas.some(m => m.personalizada), false,
      'a marca sai das duas, em qualquer origem -- grimorio.js se apoia nesse invariante');
  });
}

// O outro lado da truthiness: `origem` FALSY não protege nada. Sem estes
// casos, uma implementação escrita como `'origem' in magia` ou
// `magia.origem !== undefined` passaria a tabela acima inteira e deixaria de
// limpar exatamente as entradas que esta migração existe para limpar.
for (const [rotulo, origem] of [['string vazia', ''], ['null', null], ['zero', 0]]) {
  test(`origem falsy (${rotulo}) NÃO protege: a entrada é tratada como não carimbada`, () => {
    const p = fichaDeOrigem(origem);
    sheetEstado.definirChar(p);

    assert.equal(sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas(), true);
    assert.deepEqual(p.magias_preparadas.map(m => m.nome), [],
      'sem `origem` de verdade não há concessão a proteger -- as três entradas são '
      + 'cópias da customizada e saem pelos caminhos 1 e 2');
  });
}

// ============================================================
// CUSTOMIZADA DE CÍRCULO 0 não justifica remoção nenhuma.
//
// A premissa do fix -- "agora tem morada única, derivada no render" -- vale
// só para círculo 1+: sheet/magias.js:715 deriva
// `magiasPersonalizadas.filter(m => m.circulo > 0)` para as preparadas, e a
// customizada de círculo 0 vai para o bloco de TRUQUES (linha 573), que é
// outra coisa. Uma remoção justificada por uma customizada de círculo 0
// apagaria a entrada preparada SEM NADA no lugar.
//
// Mesmo filtro da função irmã `migrarCopiasCustomizadasDoGrimorio`, que já
// faz `.filter(m => (Number(m?.circulo) || 0) > 0)`.
// ============================================================

test('customizada de círculo 0 não justifica remover entrada nenhuma de magias_preparadas', () => {
  // Preparada sem `circulo` (cai em 0 pelo saneamento) e customizada de
  // círculo 0: hoje casariam, e a entrada sairia sem substituta na seção de
  // preparadas. Vale igual para `circulo: null` e para string não numérica.
  const p = ficha({
    magias_preparadas: [
      { nome: 'Bola de Fogo', classe: 'Mago' },
      { nome: 'Névoa de Nimb', circulo: null, classe: 'Mago', personalizada: true },
    ],
    magias_customizadas: [
      { nome: 'Bola de Fogo', circulo: 0 },
      { nome: 'Névoa de Nimb', circulo: 0 },
    ],
  });
  sheetEstado.definirChar(p);

  sheetMigracoes.migrarMagiasCustomizadasSemprePreparadas();

  assert.deepEqual(p.magias_preparadas.map(m => m.nome), ['Bola de Fogo', 'Névoa de Nimb'],
    'o filtro vale nos DOIS caminhos: nem a entrada crua nem a marcada saem por lastro '
    + 'de círculo 0, porque a customizada de círculo 0 é derivada no bloco de truques e '
    + 'não substituiria nenhuma delas na seção de preparadas');
  assert.equal(p.magias_preparadas[1].personalizada, undefined,
    'sem lastro de círculo 1+ a marca é falsa e sai, como em toda marca órfã');
});

// ============================================================
// Issue #46, passo B: a cópia paga no grimório do Mago (issue #42).
//
// Com a customizada sempre preparada, a cópia não compra mais nada e cria
// uma segunda linha da mesma magia na seção Grimório, com Preparar/
// Despreparar que a regra nova torna sem efeito.
//
// A RESSALVA DA HOMÔNIMA é o coração desta migração. O grimório grava
// `{ nome, circulo }` cru (grimorio.js:1585), SEM marca que separe a cópia
// da customizada de uma magia do livro. Remover por nome+círculo apagaria,
// num Mago que criou a SUA "Bênção" e comprou a "Bênção" do acervo, a cópia
// legítima que ele pagou 50 PO por círculo para ter. Por isso só sai a
// entrada cujo nome NÃO existe no acervo naquele círculo -- a única em que a
// origem é inequívoca.
// ============================================================

test('remove a cópia da customizada quando o acervo não tem homônima', () => {
  const p = ficha({
    grimorio: [
      { nome: 'Bola de Fogo', circulo: 3 },
      { nome: 'Névoa de Nimb', circulo: 1 },
    ],
    magias_customizadas: [{ nome: 'Névoa de Nimb', circulo: 1 }],
  });
  sheetEstado.definirChar(p);

  const alterado = sheetMigracoes.migrarCopiasCustomizadasDoGrimorio();

  assert.equal(alterado, true);
  assert.deepEqual(p.grimorio.map(m => m.nome), ['Bola de Fogo'],
    '"Névoa de Nimb" não existe no acervo de 1º círculo: a entrada só pode ter vindo '
    + 'da customizada');
});

test('PRESERVA a cópia quando o acervo tem homônima do mesmo círculo', () => {
  // "Bênção" é magia de 1º círculo do acervo. Um Clérigo/Mago pode ter criado
  // a SUA "Bênção" E comprado a do livro -- são magias diferentes.
  const p = ficha({
    grimorio: [{ nome: 'Bênção', circulo: 1 }],
    magias_customizadas: [{ nome: 'Bênção', circulo: 1 }],
  });
  sheetEstado.definirChar(p);

  const alterado = sheetMigracoes.migrarCopiasCustomizadasDoGrimorio();

  assert.equal(alterado, false, 'a origem é ambígua -- a migração não chuta');
  assert.equal(p.grimorio.length, 1,
    'apagar aqui destruiria a cópia do LIVRO que o jogador pagou para ter');
});

// Mesma disciplina do par em `magias_preparadas` (acima): nome que diz QUAL
// migração, e uma segunda entrada NÃO-CANDIDATA no fixture.
//
// Sem a "Bênção", a primeira passagem esvazia o grimório e a segunda chamada
// volta na saída barata (`grimorio.length === 0`) -- o teste passaria com uma
// implementação que grava a cada passagem. Com ela, a segunda chamada passa
// pelas três guardas baratas, indexa o acervo, roda o `filter` e só então
// conclui que nada mudou.
test('idempotente no grimório: a segunda passagem percorre a lógica e não altera nada', () => {
  const p = ficha({
    grimorio: [
      { nome: 'Névoa de Nimb', circulo: 1 },
      { nome: 'Bênção', circulo: 1 },
    ],
    magias_customizadas: [
      { nome: 'Névoa de Nimb', circulo: 1 },
      { nome: 'Bênção', circulo: 1 },
    ],
  });
  sheetEstado.definirChar(p);

  assert.equal(sheetMigracoes.migrarCopiasCustomizadasDoGrimorio(), true);
  assert.deepEqual(p.grimorio.map(m => m.nome), ['Bênção'],
    'a cópia inequívoca sai; a homônima do acervo é ambígua e fica -- é ela que mantém '
    + 'a segunda passagem fora da saída barata');

  assert.equal(sheetMigracoes.migrarCopiasCustomizadasDoGrimorio(), false);
  assert.deepEqual(p.grimorio.map(m => m.nome), ['Bênção'],
    'a segunda passagem não pode remover a página que a primeira preservou');
});

test('sem grimório ou sem customizada de círculo, sai barato e não lança', () => {
  sheetEstado.definirChar(ficha({ grimorio: [], magias_customizadas: [] }));
  assert.equal(sheetMigracoes.migrarCopiasCustomizadasDoGrimorio(), false);

  sheetEstado.definirChar(ficha({
    grimorio: [{ nome: 'Bola de Fogo', circulo: 3 }],
    magias_customizadas: [{ nome: 'Fagulha de Nimb', circulo: 0 }],
  }));
  assert.equal(sheetMigracoes.migrarCopiasCustomizadasDoGrimorio(), false,
    'truque (círculo 0) nunca esteve no grimório -- não há o que consultar no acervo');
});

// ============================================================
// ACERVO INDISPONÍVEL: o "não sei" NÃO pode virar ordem de apagar.
//
// Achado da revisão (Critical 1). A primeira versão desta migração lia o
// acervo por `getMagiasPorCirculo`, que passa por `fetchJSON` (site/js/db.js)
// -- e `fetchJSON` engole num único `catch` a rejeição de rede, o 404 e o
// JSON malformado, devolvendo `null`. Esse `null` virava lista vazia, o
// conjunto de nomes do círculo ficava vazio, e "não existe no acervo" passava
// a ser verdadeiro para TUDO: com a rede caída, o Mago que comprou a "Bênção"
// do livro perdia o grimório inteiro. E como `salvar()` enfileira sync, a
// mesma queda que apagou empurraria a versão mutilada para a nuvem depois.
//
// Por isso a fonte passou a ser `indiceMagiasCache`, onde "não sei" é
// DETECTÁVEL: índice vazio é distinguível de "esse círculo não tem essa
// magia". Numa função que destrói dado pago em PO, todo caminho desconhecido
// tem de preservar.
// ============================================================

test('acervo indisponível (índice vazio): não remove NADA e devolve false', (t) => {
  // Restaura o índice real ao fim, aconteça o que acontecer -- os vizinhos
  // deste arquivo dependem dele.
  t.after(() => sheetEstado.definirIndiceMagias(INDICE_REAL));

  const p = ficha({
    grimorio: [
      { nome: 'Bênção', circulo: 1 },
      { nome: 'Névoa de Nimb', circulo: 1 },
    ],
    magias_customizadas: [
      { nome: 'Bênção', circulo: 1 },
      { nome: 'Névoa de Nimb', circulo: 1 },
    ],
  });
  sheetEstado.definirChar(p);
  sheetEstado.definirIndiceMagias([]);

  const alterado = sheetMigracoes.migrarCopiasCustomizadasDoGrimorio();

  assert.equal(alterado, false,
    'sem acervo carregado a migração não sabe o que o livro tem -- e não pode chutar que não tem');
  assert.deepEqual(p.grimorio.map(m => m.nome), ['Bênção', 'Névoa de Nimb'],
    'índice vazio significa "não sei", não "o acervo não tem nenhuma delas": apagar aqui '
    + 'destruiria toda cópia paga do grimório por causa de uma falha de carga');

  // O índice ausente (null, antes de definirIndiceMagias rodar) tem de se
  // comportar igual ao vazio.
  sheetEstado.definirIndiceMagias(null);
  assert.equal(sheetMigracoes.migrarCopiasCustomizadasDoGrimorio(), false,
    'índice ainda não carregado é o mesmo "não sei"');
  assert.equal(p.grimorio.length, 2);
});
