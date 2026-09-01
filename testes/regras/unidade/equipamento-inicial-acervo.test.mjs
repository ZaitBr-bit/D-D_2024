// ============================================================
// Equipamento inicial: todo item do pacote tem de casar com o acervo
// (issue #43, causa raiz B).
//
// O criador resolvia o nome do item por igualdade EXATA (sem acento e em
// minúsculas) contra as listas de armas/armaduras/equipamento. As duas
// camadas vêm do mesmo livro, mas escritas por autores diferentes: a
// tabela de Equipamento de Aventura grava "Roupas, Viagem" e "Roupas,
// Finas" (convenção de índice, substantivo primeiro); os antecedentes
// dizem "Roupas de Viagem" e "Roupas Finas". Os pacotes de classe pedem
// "Foco Arcano (orbe)" e "Foco Arcano (Cajado)", enquanto a tabela tem só
// "Foco Arcano". Nada disso casava, e o item caía no ramo genérico com
// `dados: {}` -- sem peso e sem custo. Era o defeito relatado: "itens como
// roupas de viagem, foco arcano cajado, ferramentas de ladrao etc estao
// sem o peso".
//
// A carga do personagem sai de `getPesoTotalInventario`, então toda ficha
// com um desses itens tinha a barra "Peso: X / Y kg" e a sobrecarga
// subestimadas.
//
// Este é o motor que impede a divergência silenciosa de voltar: ele varre
// o pacote inicial das 12 classes e de TODOS os antecedentes chamando as
// MESMAS funções do criador (`parseEquipamentoOpcoes` e
// `montarItensEquipamentoInicial`) sobre o acervo de verdade -- carregado
// pelo MESMO `carregarDadosEquipSheet()` que a tela usa. Reimplementar o
// casamento aqui só provaria que o teste concorda consigo mesmo.
//
// `tipo: 'generico'` é a marca do não-casamento: é o único ramo que grava
// `dados: {}`. A pergunta é sobre o DADO produzido, não sobre a grafia do
// nome.
//
// A varredura roda em DUAS configurações -- sem escolha do jogador e com
// CADA escolha declarada (instrumento, ferramenta de artesão, kit de
// jogos). A rodada 1 de revisão achou que medir só a primeira deixava de
// fora justamente o Bardo/Artista que escolhe um instrumento, que é o
// personagem mais comum a sofrer o defeito relatado.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ, modulosApp } from './harness.mjs';

const { criador } = await modulosApp(); // instala os stubs e o `fetch` de disco
const { carregarDadosEquipSheet } = await import('../../../site/js/itens-seletor.js');
const { INSTRUMENTOS_PASSO_CLASSE, montarItensEquipamentoInicial, parseEquipamentoOpcoes } =
  await import('../../../site/js/creator/passo-equipamento.js');
const { parsePeso } = await import('../../../site/js/utils.js');

const ACERVO = await carregarDadosEquipSheet();
const { ANTECEDENTES_ESCOLHAS, INSTRUMENTOS_MUSICAIS } = criador;

// O app tem TRES listas de instrumento, e elas divergem entre si e do livro:
// `INSTRUMENTOS_MUSICAIS` (comum.js), `ANTECEDENTES_ESCOLHAS['Artista']` e o
// dropdown do passo da classe (`INSTRUMENTOS_PASSO_CLASSE`, sem acento
// nenhum: 'Alaude', 'Oboe', 'Flauta de Pa'). A varredura tem de cobrir as
// TRES -- medir duas deixava as grafias da terceira fora da conta, e elas
// nem apareciam na lista de dívida.
const INSTRUMENTOS_TODAS_AS_LISTAS = [...new Set([
  ...INSTRUMENTOS_MUSICAIS,
  ...INSTRUMENTOS_PASSO_CLASSE,
  ...(ANTECEDENTES_ESCOLHAS['Artista']?.opcoes || []),
])];

// ------------------------------------------------------------
// As duas fontes de pacote inicial.
// ------------------------------------------------------------
const DIR_CLASSES = resolve(RAIZ, 'dados', 'classes');
const ARQUIVOS_CLASSE = readdirSync(DIR_CLASSES)
  .filter(n => n.endsWith('.json') && !n.startsWith('magias_'));

const PACOTES = [];
for (const arquivo of ARQUIVOS_CLASSE) {
  const dados = JSON.parse(readFileSync(resolve(DIR_CLASSES, arquivo), 'utf-8'));
  PACOTES.push({
    tipoOrigem: 'classe',
    nomeOrigem: dados.nome || arquivo.replace('.json', ''),
    texto: dados?.tracos_basicos?.['Equipamento Inicial'] || '',
  });
}
const ANTECEDENTES = JSON.parse(
  readFileSync(resolve(RAIZ, 'dados', 'origens', 'antecedentes.json'), 'utf-8')).antecedentes || [];
for (const antecedente of ANTECEDENTES) {
  PACOTES.push({
    tipoOrigem: 'antecedente',
    nomeOrigem: antecedente.nome,
    texto: (antecedente.equipamento || '').replace(/\*/g, ''),
  });
}

// ------------------------------------------------------------
// As configurações de escolha do jogador que cada pacote pode receber.
//
// `montarItensEquipamentoInicial` recebe `{ instrumento,
// escolhasAntecedente }`. O instrumento vem do passo da classe (Bardo) ou
// do popup do antecedente (Artista); as demais escolhas vêm de
// `ANTECEDENTES_ESCOLHAS`, uma por antecedente.
// ------------------------------------------------------------
/** Todas as escolhas que um pacote pode receber, uma configuração por opção. */
function configuracoesDe({ tipoOrigem, nomeOrigem }) {
  const configs = [{ rotulo: 'sem escolha do jogador', escolhas: {} }];
  for (const instrumento of INSTRUMENTOS_TODAS_AS_LISTAS) {
    configs.push({ rotulo: `instrumento "${instrumento}"`, escolhas: { instrumento } });
  }
  const declarada = tipoOrigem === 'antecedente' ? ANTECEDENTES_ESCOLHAS[nomeOrigem] : null;
  for (const opcao of declarada?.opcoes || []) {
    configs.push({
      rotulo: `${declarada.titulo} = "${opcao}"`,
      escolhas: { escolhasAntecedente: { [declarada.campo]: opcao } },
    });
  }
  return configs;
}

/** Monta o inventário de todas as opções de um pacote, numa configuração. */
function itensDoPacote({ tipoOrigem, nomeOrigem, texto }, escolhas = {}) {
  const opcoes = parseEquipamentoOpcoes(texto);
  if (!opcoes) return null;
  return opcoes.flatMap(op =>
    montarItensEquipamentoInicial(op, tipoOrigem, nomeOrigem, ACERVO, escolhas));
}

/** Todos os itens que um pacote monta, em TODAS as configurações de escolha. */
function itensEmTodasAsConfiguracoes(pacote) {
  return configuracoesDe(pacote).flatMap(({ rotulo, escolhas }) =>
    (itensDoPacote(pacote, escolhas) || []).map(item => ({ ...item, rotulo })));
}

// ------------------------------------------------------------
// Dívida congelada: os nomes que continuam sem par no acervo e POR QUÊ.
//
// Nenhum deles é variação de escrita do mesmo item -- que é o defeito que
// esta tarefa conserta. Todos são divergências de OUTRA natureza, listadas
// com o motivo E a consequência visível, no mesmo espírito de
// `lacunas-conhecidas.mjs`: dívida declarada é decisão, dívida invisível é
// o mesmo defeito de novo.
// ------------------------------------------------------------
const SEM_PAR_NO_ACERVO = new Map([
  ['Ferramentas de Artesão',
    'categoria do livro ("## Ferramentas de Artesão"), não uma ferramenta: ' +
    'o item real é a escolha do jogador (Ferramentas de Ferreiro, de Oleiro...). ' +
    'CONSEQUÊNCIA: só aparece para quem ainda não abriu o popup do antecedente ' +
    'Artesão -- feita a escolha, ela casa'],
  ['Ferramentas de Artesão ou Instrumento Musical escolhido para a proficiência com ferramenta acima',
    'frase de ESCOLHA no pacote do Monge que parseEquipamentoOpcoes não sabe ' +
    'quebrar em duas opções -- defeito de parse do texto da classe, não de ' +
    'casamento de nome. CONSEQUÊNCIA: o Monge recebe um item cujo nome é a ' +
    'frase inteira, sem peso'],
  ['Livro de Magias',
    'não existe na tabela de Equipamento de Aventura do livro; o peso (1,5 kg) ' +
    'só aparece na prosa da característica do Mago. CONSEQUÊNCIA: o Mago carrega ' +
    'o livro de magias sem peso'],
  ['Balde de Ferro',
    'o livro chama de "Balde" na tabela de equipamento e de "Balde de Ferro" no ' +
    'antecedente Fazendeiro -- dois nomes, não duas grafias; casar exigiria ' +
    'descartar uma palavra, que é justamente o que a normalização se proíbe. ' +
    'CONSEQUÊNCIA: o Fazendeiro carrega o balde sem peso'],
  // Erros da LISTA DE OPÇÕES do app, não do livro: a seção "Ferramentas de
  // Artesão" traz "Suprimentos de Pintor" (não "Ferramentas de Pintor") e
  // não tem Marceneiro nenhum. Entradas literais, e não de família, para
  // que cada uma possa sair da lista quando for corrigida.
  ['Ferramentas de Pintor',
    'opção do antecedente Artesão que o livro não tem: a ferramenta do livro é ' +
    '"Suprimentos de Pintor". CONSEQUÊNCIA: quem escolhe essa opção fica sem peso'],
  ['Ferramentas de Marceneiro',
    'opção do antecedente Artesão que não existe no livro em nenhuma grafia. ' +
    'CONSEQUÊNCIA: quem escolhe essa opção fica sem peso'],
]);

// Dívida de FAMÍLIA: as VARIANTES de uma categoria.
//
// O livro dá a "Instrumento Musical" e a "Kit de Jogos" uma entrada
// própria, mas SEM peso utilizável: "Varia" e "—", que valem 0 kg na
// balança (as duas estão declaradas em ZERO_NO_LIVRO, mais abaixo). O peso
// de verdade -- quando existe -- está nas variantes, e o livro só as traz
// como prosa `**Variantes:** Alaúde (35 PO, 1 kg), Flauta (2 PO, 0,5 kg)...`
// dentro dessa entrada, nunca como linha própria de tabela.
// `parse_ferramentas_md` (_extrair_json.py) lê os cabeçalhos `####`, não
// essa prosa, então nenhuma variante chega ao acervo.
//
// É o contraste com "Foco Arcano": lá o livro dá uma TABELA por forma, e
// por isso a Tarefa 9 conseguiu resolver "Foco Arcano (Cajado)" para 2 kg.
// Aqui não há tabela, e a categoria genérica pesa zero de qualquer jeito.
//
// CONSEQUÊNCIA VISÍVEL, e é a mais cara desta lista: o Bardo ou o Artista
// que escolhe um instrumento -- o personagem mais comum a fazer essa
// escolha -- recebe "Alaúde" com `dados: {}`, sem peso, exatamente o
// sintoma que a issue #43 relata. O mesmo vale para o Guarda/Nobre/Soldado
// que escolhe um kit de jogos.
//
// CONSERTO CONHECIDO, fora do escopo desta tarefa: estender
// `parse_ferramentas_md` para ler a linha `**Variantes:**` (que traz custo
// E peso para os instrumentos; para os kits de jogo, só custo) e emitir uma
// segunda tabela no ferramentas.json -- o mesmo movimento que
// `parse_focos_md` já fez para as formas de foco. Ver o relatório da
// Tarefa 9.
const MOTIVO_VARIANTE =
  'variante de categoria: o livro só a traz na prosa "**Variantes:**" dentro da ' +
  'entrada da categoria (Instrumento Musical / Kit de Jogos), nunca como linha ' +
  'própria de tabela, e o extrator lê só os cabeçalhos "####". CONSEQUÊNCIA: o ' +
  'jogador que escolhe esta variante recebe o item sem peso e sem custo';

for (const instrumento of INSTRUMENTOS_TODAS_AS_LISTAS) {
  SEM_PAR_NO_ACERVO.set(instrumento, MOTIVO_VARIANTE);
}
for (const antecedente of Object.values(ANTECEDENTES_ESCOLHAS)) {
  if (!/instrumento|jogos/i.test(antecedente.titulo)) continue;
  for (const opcao of antecedente.opcoes) SEM_PAR_NO_ACERVO.set(opcao, MOTIVO_VARIANTE);
}

// ------------------------------------------------------------
// Os itens do pacote inicial que pesam ZERO -- e pesam zero porque o LIVRO
// diz zero, não porque o casamento perdeu o dado.
//
// Esta lista existe por causa da rodada 3 de revisão: o motor
// `todo item casado carrega peso` media `typeof peso === 'string' &&
// trim() !== ''`, e "—" e "Varia" passam nisso valendo 0 kg em `parsePeso`.
// Era a MESMA forma do defeito que a issue relata -- oráculo verde sobre
// item sem peso --, só que aplicada à família inteira em vez do caso
// nomeado.
//
// Agora o motor exige QUILO de verdade, e a única saída é estar aqui, com
// a grafia exata do livro. Um item que perca o peso por erro de casamento
// não está nesta lista e fica vermelho; um item que o livro dispensa de
// peso está, e o zero dele é visível para quem lê a suíte em vez de ficar
// escondido atrás de uma asserção de texto.
//
// "—" é o traço do livro para item de peso desprezível. "Varia" aparece
// quando o peso depende de uma FORMA que o pacote inicial não nomeia:
//   - `Instrumento Musical`: o Bardo pede "à sua escolha" e o Artista pede
//     "(o mesmo que acima)"; sem escolha feita, sobra a categoria. As
//     formas só existem como prosa `**Variantes:**` (ver a dívida de
//     família acima).
//   - `Símbolo Sagrado`: o livro TEM tabela de formas (Amuleto 0,5 kg,
//     Emblema —, Relicário 1 kg), mas Clérigo e Paladino pedem só "Símbolo
//     Sagrado", sem forma -- não há o que resolver a partir do texto do
//     pacote, ao contrário de "Foco Arcano (Cajado)".
// ------------------------------------------------------------
const ZERO_NO_LIVRO = new Map([
  ['Caneta Tinteiro', '—'],
  ['Foco Druídico (Ramo de visco)', '—'],
  ['Instrumento Musical', 'Varia'],
  ['Kit de Jogos', '—'],
  ['Perfume', '—'],
  ['Pergaminho', '—'],
  ['Sino', '—'],
  ['Símbolo Sagrado', 'Varia'],
  ['Tinta', '—'],
  ['Vela', '—'],
]);

// Guarda contra o motor virar vacuamente verde: 12 classes + 16
// antecedentes, todos com pacote parseável e um acervo carregado de fato.
test('a varredura enxerga os pacotes iniciais e o acervo', () => {
  assert.equal(ARQUIVOS_CLASSE.length, 12,
    `esperados 12 arquivos de classe, encontrados ${ARQUIVOS_CLASSE.length}`);
  assert.ok(ANTECEDENTES.length >= 16,
    `esperados ao menos 16 antecedentes, encontrados ${ANTECEDENTES.length}`);
  assert.ok((ACERVO.armas || []).length > 0, 'acervo de armas vazio');
  assert.ok((ACERVO.armaduras || []).length > 0, 'acervo de armaduras vazio');
  assert.ok((ACERVO.equipAvent || []).length > 0, 'acervo de equipamento vazio');
  assert.ok((ACERVO.municao || []).length > 0, 'acervo de munição vazio');
  assert.ok((ACERVO.ferramentas || []).length > 0,
    'acervo de ferramentas vazio: sem ele "Ferramentas de Ladrão" nunca tem peso');

  const semPacote = PACOTES.filter(p => itensDoPacote(p) === null)
    .map(p => `${p.tipoOrigem} ${p.nomeOrigem}`);
  assert.deepEqual(semPacote, [], `pacote inicial que não parseou: ${semPacote.join(', ')}`);

  const total = PACOTES.reduce((n, p) => n + (itensDoPacote(p) || []).length, 0);
  assert.ok(total > 200, `só ${total} itens montados na varredura inteira`);
});

// Guarda contra o motor varrer uma configuração só: o Bardo tem de receber
// o instrumento escolhido, e o Artesão a ferramenta escolhida.
test('a varredura cobre as configurações de escolha do jogador', () => {
  assert.ok(INSTRUMENTOS_MUSICAIS.length >= 10,
    `esperados ao menos 10 instrumentos, ${INSTRUMENTOS_MUSICAIS.length}`);
  const bardo = PACOTES.find(p => p.nomeOrigem === 'Bardo');
  const comAlaude = itensDoPacote(bardo, { instrumento: 'Alaúde' }) || [];
  assert.ok(comAlaude.some(i => i.nome === 'Alaúde'),
    'a configuração com instrumento escolhido precisa chegar ao inventário do Bardo; ' +
    'se não chega, varrer com escolha não mede nada. Montado: ' +
    comAlaude.map(i => i.nome).join(', '));

  const artesao = PACOTES.find(p => p.nomeOrigem === 'Artesão');
  const comFerramenta = itensDoPacote(artesao,
    { escolhasAntecedente: { ferramenta_escolhida: 'Ferramentas de Ferreiro' } }) || [];
  assert.ok(comFerramenta.some(i => i.nome === 'Ferramentas de Ferreiro'),
    'a escolha de ferramenta do antecedente Artesão precisa chegar ao inventário. ' +
    'Montado: ' + comFerramenta.map(i => i.nome).join(', '));
});

// ------------------------------------------------------------
// A propriedade em que TODA a normalização se apoia: nenhum nome do acervo
// pode ser entregue no lugar de outro.
//
// Medida pelo comportamento, não pela chave: cada um dos 163 nomes do
// acervo é devolvido ao casamento como se fosse um item do pacote, e a
// entrada resolvida tem de ser ELE MESMO. Não resolver é aceitável (não é
// colisão); resolver para um IRMÃO não é. Foi assim que a regra de apelido
// ("Fantasia" -> "Roupas, Fantasia") pôde entrar sem risco: "Balas, Funda"
// apelidaria "funda", que é a arma Funda, e o guarda de `indiceApelidos`
// recusa exatamente esse apelido.
// ------------------------------------------------------------
// Os kits ficam de fora: "Kit de Artista" é uma COLEÇÃO, e
// `KITS_EXPANSAO` manda o casamento devolver os componentes dele (Caixa
// para Fogo, Cantil...) em vez de uma linha só. Devolver algo com outro
// nome ali é o comportamento correto, não uma troca.
//
// `ACERVO.focos` também fica de fora, e por outro motivo: uma variante não
// é pedida pelo nome dela ("Cajado (também um Bastão)"), e sim pela forma
// dentro da categoria ("Foco Arcano (Cajado)"). Devolver o nome cru da
// variante ao casamento mediria uma pergunta que nenhum pacote faz. As
// variantes são confrontadas com o livro em CASOS_DA_ISSUE, uma a uma.
const NOMES_DO_ACERVO = [
  ...(ACERVO.armas || []), ...(ACERVO.armaduras || []), ...(ACERVO.equipAvent || []),
  ...(ACERVO.municao || []), ...(ACERVO.ferramentas || []),
].map(e => e.nome).filter(nome => nome && !criador.KITS_EXPANSAO[nome]);

test('nenhum nome do acervo é entregue no lugar de outro', () => {
  assert.ok(NOMES_DO_ACERVO.length >= 150,
    `esperados ao menos 150 nomes não-kit no acervo, ${NOMES_DO_ACERVO.length}`);

  const trocados = [];
  let resolvidos = 0;
  for (const nome of NOMES_DO_ACERVO) {
    const [montado] = montarItensEquipamentoInicial(
      { itens: [nome] }, 'classe', 'Confronto', ACERVO, {});
    if (!montado || montado.tipo === 'generico') continue;
    resolvidos++;
    if (montado.nome !== nome) trocados.push(`"${nome}" -> "${montado.nome}"`);
  }

  assert.deepEqual(trocados, [],
    'a normalização entregou um item DIFERENTE do pedido -- casar itens ' +
    'diferentes é um defeito pior que o não-casamento que ela conserta:\n  ' +
    trocados.join('\n  '));
  assert.ok(resolvidos >= 150,
    `só ${resolvidos} de ${NOMES_DO_ACERVO.length} nomes do acervo se resolveram; ` +
    'com poucos resolvidos o confronto acima passa por vacuidade');
});

for (const pacote of PACOTES) {
  test(`${pacote.tipoOrigem} ${pacote.nomeOrigem}: todo item do pacote casa com o acervo`, () => {
    const orfaos = itensEmTodasAsConfiguracoes(pacote)
      .filter(i => i.tipo === 'generico' && !SEM_PAR_NO_ACERVO.has(i.nome))
      .map(i => `${i.nome}  (${i.rotulo})`);
    assert.deepEqual([...new Set(orfaos)], [],
      `${pacote.nomeOrigem}: item do pacote inicial que não casou com nenhuma ` +
      'entrada do acervo -- entra no inventário com `dados: {}`, sem peso e sem ' +
      'custo, e some da conta de carga da ficha:\n  ' +
      [...new Set(orfaos)].join('\n  '));
  });

  test(`${pacote.tipoOrigem} ${pacote.nomeOrigem}: todo item casado PESA no acervo`, () => {
    const itens = itensEmTodasAsConfiguracoes(pacote).filter(i => i.tipo !== 'generico');

    // 1. O campo tem de existir. Casar com a lista errada -- ou com a chave
    //    errada dentro dela -- devolve um item sem `peso` nenhum.
    const semCampo = itens
      .filter(i => typeof i.dados?.peso !== 'string' || i.dados.peso.trim() === '')
      .map(i => `${i.nome} (${i.tipo}, ${i.rotulo})`);
    assert.deepEqual([...new Set(semCampo)], [],
      `${pacote.nomeOrigem}: item casado com o acervo mas SEM o campo peso:\n  ` +
      [...new Set(semCampo)].join('\n  '));

    // 2. E tem de valer QUILO. "—" e "Varia" são strings não-vazias que
    //    `parsePeso` lê como 0 -- passavam na conferência de texto e saíam
    //    da conta de carga assim mesmo. Só escapa quem está declarado em
    //    ZERO_NO_LIVRO, com a grafia exata do livro.
    const zeradosNaoDeclarados = itens
      .filter(i => parsePeso(i.dados.peso) <= 0)
      .filter(i => ZERO_NO_LIVRO.get(i.nome) !== i.dados.peso)
      .map(i => `${i.nome} (peso "${i.dados.peso}" = 0 kg, ${i.rotulo})`);
    assert.deepEqual([...new Set(zeradosNaoDeclarados)], [],
      `${pacote.nomeOrigem}: item que entra na ficha pesando 0 kg sem estar ` +
      'declarado em ZERO_NO_LIVRO. Ou o casamento perdeu o peso, ou o livro ' +
      'realmente não dá peso a ele -- no segundo caso, declare com a grafia do ' +
      'livro para que o zero fique visível:\n  ' +
      [...new Set(zeradosNaoDeclarados)].join('\n  '));
  });
}

test('a lista de zeros legítimos não tem entrada morta', () => {
  // Mesma barganha da dívida congelada: um item que voltou a pesar precisa
  // SAIR daqui, senão a lista vira uma isenção permanente que ninguém
  // revisa -- e o dia em que ele perder o peso de novo, ninguém fica sabendo.
  const zerados = new Map();
  for (const item of PACOTES.flatMap(itensEmTodasAsConfiguracoes)) {
    if (item.tipo === 'generico') continue;
    if (parsePeso(item.dados?.peso) > 0) continue;
    zerados.set(item.nome, item.dados?.peso);
  }
  const mortas = [...ZERO_NO_LIVRO.keys()]
    .filter(nome => !zerados.has(nome))
    .map(nome => `${nome} (declarado "${ZERO_NO_LIVRO.get(nome)}")`);
  assert.deepEqual(mortas, [],
    'entrada de ZERO_NO_LIVRO que não aparece mais zerada na varredura -- ' +
    'remova-a da lista:\n  ' + mortas.join('\n  '));

  const grafiaErrada = [...zerados]
    .filter(([nome, peso]) => ZERO_NO_LIVRO.has(nome) && ZERO_NO_LIVRO.get(nome) !== peso)
    .map(([nome, peso]) => `${nome}: declarado "${ZERO_NO_LIVRO.get(nome)}", acervo diz "${peso}"`);
  assert.deepEqual(grafiaErrada, [],
    'a grafia declarada em ZERO_NO_LIVRO não é mais a do acervo:\n  ' +
    grafiaErrada.join('\n  '));
});

test('a lista de dívida congelada não tem entrada morta', () => {
  // Mesma barganha de `lacunas-conhecidas.mjs`: uma entrada que já casa
  // sozinha precisa SAIR da lista, senão ela vira uma isenção permanente
  // que ninguém revisa -- e o próximo item que divergir com esse nome
  // passaria despercebido.
  const orfaos = new Set(
    PACOTES.flatMap(itensEmTodasAsConfiguracoes)
      .filter(i => i.tipo === 'generico')
      .map(i => i.nome));
  const mortas = [...SEM_PAR_NO_ACERVO.keys()].filter(nome => !orfaos.has(nome));
  assert.deepEqual(mortas, [],
    'entrada de SEM_PAR_NO_ACERVO que já casa com o acervo -- remova-a da lista:\n  ' +
    mortas.join('\n  '));
});

// ------------------------------------------------------------
// Os itens que a issue #43 nomeia, medidos em QUILOS -- não na string.
//
// A versão anterior deste bloco afirmava `peso === 'Varia'` sob o título
// "entra com o peso do livro". Passava verde sobre um item que continuava
// pesando 0 kg na balança: `parsePeso` devolve 0 para "Varia" e para "—".
// Era o oráculo verde por cima do buraco, consagrado justamente no caso
// que o relator citou por escrito ("foco arcano cajado").
//
// Agora cada caso declara os QUILOS que o livro dá, e a asserção passa por
// `parsePeso` -- a mesma função que `getPesoTotalInventario` usa para
// montar a barra "Peso: X / Y kg". O que o teste afirma é o que o jogador
// vê na ficha.
// ------------------------------------------------------------
/** Acha um item montado pelo pacote inicial de uma origem. */
function itemDe(tipoOrigem, nomeOrigem, nomeItem) {
  const pacote = PACOTES.find(p => p.tipoOrigem === tipoOrigem && p.nomeOrigem === nomeOrigem);
  assert.ok(pacote, `pacote não encontrado: ${tipoOrigem} ${nomeOrigem}`);
  return (itensDoPacote(pacote) || []).find(i => i.nome === nomeItem);
}

const CASOS_DA_ISSUE = [
  { tipoOrigem: 'classe', nomeOrigem: 'Ladino', nomeItem: 'Ferramentas de Ladrão',
    peso: '0,5 kg', kg: 0.5, pedido: 'Ferramentas de Ladrão' },
  // "Foco Arcano" e "Foco Druídico" pesam "Varia" na tabela principal: o
  // peso real é por FORMA, e a forma vem escrita no próprio pacote.
  { tipoOrigem: 'classe', nomeOrigem: 'Bruxo', nomeItem: 'Foco Arcano (Orbe)',
    peso: '1,5 kg', kg: 1.5, pedido: 'Foco Arcano (orbe)' },
  { tipoOrigem: 'classe', nomeOrigem: 'Mago', nomeItem: 'Foco Arcano (Cajado)',
    peso: '2 kg', kg: 2, pedido: 'Foco Arcano (Cajado)' },
  { tipoOrigem: 'classe', nomeOrigem: 'Feiticeiro', nomeItem: 'Foco Arcano (Cristal)',
    peso: '0,5 kg', kg: 0.5, pedido: 'Foco Arcano (cristal)' },
  { tipoOrigem: 'classe', nomeOrigem: 'Druida', nomeItem: 'Foco Druídico (Cajado de madeira)',
    peso: '2 kg', kg: 2, pedido: 'Foco Druídico (Cajado)' },
  { tipoOrigem: 'antecedente', nomeOrigem: 'Andarilho', nomeItem: 'Roupas, Viagem',
    peso: '2 kg', kg: 2, pedido: 'Roupas de Viagem' },
  { tipoOrigem: 'antecedente', nomeOrigem: 'Nobre', nomeItem: 'Roupas, Finas',
    peso: '3 kg', kg: 3, pedido: 'Roupas Finas' },
  { tipoOrigem: 'antecedente', nomeOrigem: 'Charlatão', nomeItem: 'Roupas, Fantasia',
    peso: '2 kg', kg: 2, pedido: 'Fantasia' },
  { tipoOrigem: 'antecedente', nomeOrigem: 'Artista', nomeItem: 'Roupas, Fantasia',
    peso: '2 kg', kg: 2, pedido: '2 Fantasias' },
];

for (const caso of CASOS_DA_ISSUE) {
  test(`issue #43: "${caso.pedido}" (${caso.nomeOrigem}) pesa ${caso.kg} kg na ficha`, () => {
    const item = itemDe(caso.tipoOrigem, caso.nomeOrigem, caso.nomeItem);
    assert.ok(item,
      `o pacote de ${caso.nomeOrigem} pede "${caso.pedido}" e o acervo tem ` +
      `"${caso.nomeItem}", mas nenhum item com esse nome foi montado`);
    assert.notEqual(item.tipo, 'generico',
      `"${caso.pedido}" caiu no ramo genérico: entra sem peso e sem custo`);
    assert.equal(item.dados?.peso, caso.peso,
      `o livro dá ${caso.peso} a "${caso.nomeItem}"`);
    assert.ok(caso.kg > 0, `caso mal escrito: ${caso.pedido} declara 0 kg`);
    assert.equal(parsePeso(item.dados?.peso), caso.kg,
      `"${caso.pedido}" tem de PESAR ${caso.kg} kg na conta de carga -- uma string ` +
      'como "Varia" ou "—" passaria por qualquer asserção de texto e mesmo assim ' +
      'valeria 0 kg na balança');
  });
}

// ------------------------------------------------------------
// O contraste: os itens que pesam ZERO porque o LIVRO diz zero.
//
// Nem todo peso 0 é defeito. A lista completa dos que entram zerados no
// pacote inicial está em `ZERO_NO_LIVRO`, e o motor `todo item casado PESA
// no acervo` cobra que nenhum outro apareça. Os casos abaixo são os que a
// issue #43 alcança de perto, cada um amarrado à ORIGEM que o pede -- para
// que ninguém "conserte" um zero legítimo, e para que o zero fique escrito
// com o nome de quem o carrega.
//
// `Instrumento Musical` e `Kit de Jogos` estão aqui porque são o outro lado
// da dívida de família: quando o jogador NÃO escolhe uma variante, o item
// que sobra é a categoria, e a categoria pesa "Varia"/"—" = 0 kg. Escolher
// uma variante hoje é pior ainda (cai no ramo genérico) -- é o que a
// dívida declara.
// ------------------------------------------------------------
const PESO_ZERO_NO_LIVRO = [
  { tipoOrigem: 'classe', nomeOrigem: 'Guardião', nomeItem: 'Foco Druídico (Ramo de visco)',
    peso: '—', pedido: 'Foco Druídico (ramo de visco)' },
  // "Kit de Jogos (qualquer um)" no Andarilho e "(o mesmo que acima)" no
  // Nobre: o livro escreve `**Peso:** —` para a categoria.
  { tipoOrigem: 'antecedente', nomeOrigem: 'Andarilho', nomeItem: 'Kit de Jogos',
    peso: '—', pedido: 'Kit de Jogos (qualquer um)' },
  { tipoOrigem: 'antecedente', nomeOrigem: 'Nobre', nomeItem: 'Kit de Jogos',
    peso: '—', pedido: 'Kit de Jogos (o mesmo que acima)' },
  // Sem instrumento escolhido, o Bardo cai no fallback "Instrumento
  // Musical" e o Artista no "(o mesmo que acima)" -- os dois na categoria,
  // que o livro marca como "Varia".
  { tipoOrigem: 'classe', nomeOrigem: 'Bardo', nomeItem: 'Instrumento Musical',
    peso: 'Varia', pedido: 'Instrumento Musical à sua escolha (sem escolha feita)' },
  { tipoOrigem: 'antecedente', nomeOrigem: 'Artista', nomeItem: 'Instrumento Musical',
    peso: 'Varia', pedido: 'Instrumento Musical (o mesmo que acima)' },
];

for (const caso of PESO_ZERO_NO_LIVRO) {
  test(`issue #43: "${caso.pedido}" (${caso.nomeOrigem}) pesa 0 kg -- e é o livro que diz`, () => {
    const item = itemDe(caso.tipoOrigem, caso.nomeOrigem, caso.nomeItem);
    assert.ok(item, `nenhum item "${caso.nomeItem}" foi montado para ${caso.nomeOrigem}`);
    assert.notEqual(item.tipo, 'generico',
      `"${caso.pedido}" caiu no ramo genérico -- o zero tem de vir do livro, não da ` +
      'falta de casamento');
    assert.equal(item.dados?.peso, caso.peso,
      `o livro escreve "${caso.peso}" para "${caso.nomeItem}"`);
    assert.equal(parsePeso(item.dados?.peso), 0,
      `e "${caso.peso}" vale 0 kg na balança, de propósito`);
    assert.equal(ZERO_NO_LIVRO.get(caso.nomeItem), caso.peso,
      `"${caso.nomeItem}" precisa estar declarado em ZERO_NO_LIVRO com a mesma ` +
      'grafia -- as duas listas não podem divergir');
  });
}

// A entrada GENÉRICA de foco continua existindo (o seletor de itens da loja
// a usa) e continua pesando "Varia" = 0 kg. Este teste existe para que o
// zero dela não seja confundido com o dos itens acima: quem cai nela não
// escolheu forma nenhuma.
test('a entrada genérica "Foco Arcano" pesa 0 kg -- por isso a variante importa', () => {
  const generico = (ACERVO.equipAvent || []).find(i => i.nome === 'Foco Arcano');
  assert.ok(generico, '"Foco Arcano" sumiu da tabela de equipamento de aventura');
  assert.equal(generico.peso, 'Varia');
  assert.equal(parsePeso(generico.peso), 0,
    'se "Varia" um dia passar a valer kg, a resolução por variante pode ser revista');

  const variantes = (ACERVO.focos || []).filter(f => f.categoria === 'Foco Arcano');
  assert.ok(variantes.length >= 5,
    `esperadas ao menos 5 formas de Foco Arcano no acervo, ${variantes.length}`);
  assert.ok(variantes.every(f => typeof f.peso === 'string' && f.peso.trim() !== ''),
    'toda forma de foco precisa trazer o campo peso');
});
