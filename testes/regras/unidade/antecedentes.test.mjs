// ============================================================
// Motor de unidade do domínio Antecedentes.
//
// Diferente dos motores de talentos, aqui o confronto de maior retorno
// não é "o app RECONHECE a regra" (não existe função pura equivalente a
// obterAtributosASITalento/REGRAS_TALENTOS para antecedentes -- ver
// docs/superpowers/plans/2026-08-07-regras-antecedentes.md, seção
// "Pré-voo") -- é "os DADOS que o app lê batem com o livro". Se
// dados/origens/antecedentes.json divergir do livro, todo fluxo que o
// consome está errado na origem, e isso é detectável sem navegador.
//
// Três confrontos, na ordem do plano:
//   1. Completude -- bijeção catálogo × dados/, citação real, schema.
//   2. Conteúdo -- as cinco partes do livro (atributos, talento,
//      perícias, ferramenta, equipamento) batem com dados/.
//   3. Coerência cruzada -- o talento de origem de cada antecedente
//      existe em talentos.mjs com categoria 'de Origem'.
//
// dados/origens/antecedentes.json guarda várias dessas partes como
// prosa (ex.: "talento": "Iniciado em Magia (Clérigo) (veja o capítulo
// 5)", "ferramentas": "*Escolha um tipo de Kit de Jogos* (veja o
// capítulo 6)", "equipamento": "*Escolha A ou B:* (A) ..., 8 PO; ou (B)
// 50 PO") -- as funções parseX abaixo normalizam essa prosa para a
// mesma forma estruturada do catálogo, e nada além disso. Cada uma
// documenta, no próprio comentário, o que tolera e o que não tolera.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGO_ANTECEDENTES, TIPOS_FERRAMENTA, CATEGORIA_FERRAMENTA,
  MESMA_FERRAMENTA_ESCOLHIDA,
} from '../catalogo/antecedentes.mjs';
import { CATALOGO_TALENTOS } from '../catalogo/talentos.mjs';
import { comLacuna, lerAntecedentesDados, lerHeadingsAntecedente } from './harness.mjs';

const dados = lerAntecedentesDados();
const headings = lerHeadingsAntecedente();
const dadosPorNome = new Map(dados.map((a) => [a.nome, a]));
const nomesDados = new Set(dados.map((a) => a.nome));
const nomesCatalogo = new Set(Object.keys(CATALOGO_ANTECEDENTES));
const ATRIBUTOS_VALIDOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];

// Tabela fechada dos seis nomes de atributo em português (como o livro
// e dados/ escrevem, com acento e maiúscula inicial) para o código que
// o catálogo usa. Tabela fechada em vez de striping genérico de acento
// -- mais conservador: um nome que não é um dos seis vira `undefined`
// (e a asserção que consome isto acusa o valor bruto), em vez de um
// algoritmo genérico "adivinhar" uma correspondência para qualquer
// string. Não tolera nome de atributo fora desta lista de seis.
const NOME_ATRIBUTO_PARA_CODIGO = {
  'Força': 'forca',
  'Destreza': 'destreza',
  'Constituição': 'constituicao',
  'Inteligência': 'inteligencia',
  'Sabedoria': 'sabedoria',
  'Carisma': 'carisma',
};
function normalizarAtributo(nomePt) {
  const bruto = nomePt.trim();
  return NOME_ATRIBUTO_PARA_CODIGO[bruto] ?? `?${bruto}`;
}

// Compara duas listas como CONJUNTOS, não sequências. Usado para
// atributos, perícias e itens de pacote porque o livro não atribui
// ordem/ranking a nenhum dos três: "três dos valores de atributo",
// "duas perícias específicas" e a lista de itens de um pacote são
// coleções, não passos sequenciais -- reordenar não é uma divergência
// do livro. Ainda exige os MESMOS elementos, na mesma quantidade
// (incluindo duplicatas): não é uma comparação frouxa, é uma
// equivalência que a própria regra do livro justifica.
function mesmoConjunto(a, b) {
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

// Extrai o nome canônico do talento e, quando existe, o parâmetro entre
// parênteses (só usado por Iniciado em Magia -- o parêntese não é
// citação de capítulo, é a lista de magias escolhida; ver
// tarefa-1-report.md, seção "O talento e o parêntese"). Tolera: o
// sufixo de citação "(veja o capítulo N)" e espaçamento. Não tolera:
// nome de talento diferente do que sobra depois de remover a citação,
// nem um parâmetro que o catálogo não espera (ou vice-versa).
function parseTalento(bruto) {
  const semCitacao = bruto.replace(/\s*\(veja o capítulo \d+\)\s*$/, '').trim();
  const comParametro = semCitacao.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (comParametro) return { nome: comParametro[1].trim(), parametro: comParametro[2].trim() };
  return { nome: semCitacao, parametro: null };
}

// Extrai a ferramenta: específica (nome literal) ou por categoria
// ("Escolha um tipo de X"). Tolera: marcação de ênfase em markdown
// ('*'), em QUALQUER posição -- dados/ usa as duas formas
// ("*Escolha um tipo de X*" e "Escolha um tipo de *X*") -- e o sufixo
// "(veja o capítulo N)". Não tolera: nome de ferramenta específica ou
// de categoria diferente do que sobra depois de normalizar.
function parseFerramenta(bruto) {
  const semCitacao = bruto.replace(/\s*\(veja o capítulo \d+\)\s*$/, '').trim();
  const semAsteriscos = semCitacao.replace(/\*/g, '').trim();
  const categoria = semAsteriscos.match(/^Escolha um tipo de\s+(.+)$/i);
  if (categoria) return { tipo: 'categoria', categoria: categoria[1].trim() };
  return { tipo: 'especifica', nome: semAsteriscos };
}

// Extrai o pacote de equipamento (itens + PO embutido) e a alternativa
// em PO do texto "*Escolha A ou B:* (A) item1, item2, ..., N PO; ou (B)
// M PO". Tolera: marcação markdown ao redor de "Escolha A ou B", e a
// frase "(a mesma/o mesmo que acima)" dentro de um item -- mapeada para
// o mesmo marcador de sentinela que o catálogo usa
// (MESMA_FERRAMENTA_ESCOLHIDA), porque essa frase é uma referência à
// escolha de ferramenta do próprio antecedente, não um nome de item.
// Não tolera: item, quantidade textual embutida no item (ex. "2
// Adagas") ou valor de PO (do pacote ou da alternativa) diferentes.
function parseEquipamento(bruto) {
  const m = bruto.match(/\(A\)\s*(.+?)\s*;\s*ou\s*\(B\)\s*(\d+)\s*PO/);
  assert.ok(m, `formato de equipamento não reconhecido: "${bruto}"`);
  const [, itensEOuro, poAlternativo] = m;
  const partes = itensEOuro.split(/,\s*/);
  const ultima = partes[partes.length - 1];
  const ouroMatch = ultima.match(/^(\d+)\s*PO$/);
  assert.ok(ouroMatch, `pacote sem PO incluído reconhecível: "${bruto}"`);
  const itens = partes.slice(0, -1).map((item) => (
    /\((?:a mesma|o mesmo) que acima\)/i.test(item) ? MESMA_FERRAMENTA_ESCOLHIDA : item.trim()
  ));
  return {
    poAlternativo: Number(poAlternativo),
    pacote: { itens, ouroIncluido: Number(ouroMatch[1]) },
  };
}

// ============================================================
// 1. Completude: bijeção catálogo × dados/, citação real, schema.
// ============================================================

test('todo antecedente de dados/ tem entrada no catálogo', () => {
  const faltam = [...nomesDados].filter((n) => !nomesCatalogo.has(n));
  assert.deepEqual(faltam, [], `sem entrada no catálogo: ${faltam.join(', ')}`);
});

test('todo antecedente do catálogo existe em dados/ (sem órfãos)', () => {
  const orfaos = [...nomesCatalogo].filter((n) => !nomesDados.has(n));
  assert.deepEqual(orfaos, [], `órfãos no catálogo: ${orfaos.join(', ')}`);
});

test('completude: os 16 antecedentes do livro estão cobertos, sem amostragem', () => {
  assert.equal(nomesCatalogo.size, 16, `catálogo tem ${nomesCatalogo.size} entradas, esperado 16`);
  assert.equal(nomesDados.size, 16, `dados/ tem ${nomesDados.size} entradas, esperado 16`);
});

for (const [nome, e] of Object.entries(CATALOGO_ANTECEDENTES)) {
  test(`schema: ${nome}`, () => {
    assert.match(e.livro || '', /^Antecedente\.md §.+/, 'campo livro ausente ou fora do formato');
    const titulo = e.livro.replace('Antecedente.md §', '');
    assert.ok(headings.has(titulo), `citação quebrada: "## ${titulo}" não existe em Antecedente.md`);

    assert.ok(Array.isArray(e.atributos) && e.atributos.length === 3,
      'atributos deve ser array de 3 elementos (regra do livro: três atributos nomeados)');
    assert.ok(e.atributos.every((a) => ATRIBUTOS_VALIDOS.includes(a)),
      `atributos contém código inválido: ${JSON.stringify(e.atributos)}`);
    assert.equal(new Set(e.atributos).size, 3, 'atributos não pode repetir um valor');

    assert.ok(typeof e.talento === 'string' && e.talento.length > 0, 'talento ausente ou vazio');
    if (e.talentoParametro !== undefined) {
      assert.equal(e.talento, 'Iniciado em Magia',
        'talentoParametro só é esperado para o talento Iniciado em Magia');
      assert.ok(['Clérigo', 'Druida', 'Mago'].includes(e.talentoParametro),
        `talentoParametro fora da lista de magias de Iniciado em Magia: ${e.talentoParametro}`);
    }

    assert.ok(Array.isArray(e.pericias) && e.pericias.length === 2,
      'pericias deve ser array de 2 elementos (regra do livro: duas perícias específicas)');
    assert.ok(e.pericias.every((p) => typeof p === 'string' && p.length > 0),
      'pericias deve conter só strings não-vazias');
    assert.equal(new Set(e.pericias).size, 2, 'pericias não pode repetir uma perícia');

    assert.ok(TIPOS_FERRAMENTA.includes(e.ferramenta?.tipo),
      `ferramenta.tipo desconhecido: ${e.ferramenta?.tipo}`);
    if (e.ferramenta.tipo === 'especifica') {
      assert.ok(typeof e.ferramenta.nome === 'string' && e.ferramenta.nome.length > 0,
        'ferramenta.nome ausente para tipo "especifica"');
    } else {
      assert.ok(Object.values(CATEGORIA_FERRAMENTA).includes(e.ferramenta.categoria),
        `ferramenta.categoria fora da whitelist: ${e.ferramenta.categoria}`);
    }

    assert.equal(e.equipamento?.poAlternativo, 50,
      'equipamento.poAlternativo deve ser 50 (regra do livro: escolha entre pacote ou 50 PO)');
    assert.ok(Array.isArray(e.equipamento?.pacote?.itens) && e.equipamento.pacote.itens.length > 0,
      'equipamento.pacote.itens deve ser array não-vazio');
    assert.ok(Number.isInteger(e.equipamento?.pacote?.ouroIncluido),
      'equipamento.pacote.ouroIncluido deve ser inteiro');

    // O marcador só pode aparecer quando a ferramenta é por categoria
    // (senão não haveria "a mesma escolhida" para resolver).
    const usaMarcador = e.equipamento.pacote.itens.includes(MESMA_FERRAMENTA_ESCOLHIDA);
    assert.equal(usaMarcador, e.ferramenta.tipo === 'categoria',
      'uso de MESMA_FERRAMENTA_ESCOLHIDA no pacote deve coincidir com ferramenta.tipo === "categoria"');
  });
}

// ============================================================
// 2. Conteúdo: as cinco partes do livro, catálogo × dados/.
// ============================================================

for (const [nome, e] of Object.entries(CATALOGO_ANTECEDENTES)) {
  const d = dadosPorNome.get(nome);

  test(`atributos: ${nome}`, async () => {
    await comLacuna(nome, 'antecedentes-atributos', async () => {
      assert.ok(d, `${nome}: sem entrada em dados/origens/antecedentes.json`);
      const doDados = d.valores_atributo.split(/,\s*/).map(normalizarAtributo);
      assert.ok(mesmoConjunto(doDados, e.atributos),
        `${nome}: livro pede ${JSON.stringify(e.atributos)}, dados/ tem ` +
        `${JSON.stringify(doDados)} (bruto: "${d.valores_atributo}")`);
    });
  });

  test(`talento: ${nome}`, async () => {
    await comLacuna(nome, 'antecedentes-talento', async () => {
      assert.ok(d, `${nome}: sem entrada em dados/origens/antecedentes.json`);
      const { nome: talentoNome, parametro } = parseTalento(d.talento);
      assert.equal(talentoNome, e.talento,
        `${nome}: livro concede o talento "${e.talento}", dados/ tem ` +
        `"${talentoNome}" (bruto: "${d.talento}")`);
      assert.equal(parametro, e.talentoParametro ?? null,
        `${nome}: parâmetro do talento diverge -- livro "${e.talentoParametro ?? '(nenhum)'}", ` +
        `dados/ "${parametro ?? '(nenhum)'}" (bruto: "${d.talento}")`);
    });
  });

  test(`pericias: ${nome}`, async () => {
    await comLacuna(nome, 'antecedentes-pericias', async () => {
      assert.ok(d, `${nome}: sem entrada em dados/origens/antecedentes.json`);
      const doDados = d.pericias.split(/,\s*/).map((p) => p.trim());
      assert.ok(mesmoConjunto(doDados, e.pericias),
        `${nome}: livro concede ${JSON.stringify(e.pericias)}, dados/ tem ` +
        `${JSON.stringify(doDados)} (bruto: "${d.pericias}")`);
    });
  });

  test(`ferramenta: ${nome}`, async () => {
    await comLacuna(nome, 'antecedentes-ferramenta', async () => {
      assert.ok(d, `${nome}: sem entrada em dados/origens/antecedentes.json`);
      const doDados = parseFerramenta(d.ferramentas);
      assert.deepEqual(doDados, e.ferramenta,
        `${nome}: livro pede ${JSON.stringify(e.ferramenta)}, dados/ tem ` +
        `${JSON.stringify(doDados)} (bruto: "${d.ferramentas}")`);
    });
  });

  test(`equipamento: ${nome}`, async () => {
    await comLacuna(nome, 'antecedentes-equipamento', async () => {
      assert.ok(d, `${nome}: sem entrada em dados/origens/antecedentes.json`);
      const doDados = parseEquipamento(d.equipamento);
      assert.equal(doDados.poAlternativo, e.equipamento.poAlternativo,
        `${nome}: alternativa em PO diverge -- livro ${e.equipamento.poAlternativo}, ` +
        `dados/ ${doDados.poAlternativo} (bruto: "${d.equipamento}")`);
      assert.equal(doDados.pacote.ouroIncluido, e.equipamento.pacote.ouroIncluido,
        `${nome}: PO incluído no pacote diverge -- livro ${e.equipamento.pacote.ouroIncluido}, ` +
        `dados/ ${doDados.pacote.ouroIncluido} (bruto: "${d.equipamento}")`);
      assert.ok(mesmoConjunto(doDados.pacote.itens, e.equipamento.pacote.itens),
        `${nome}: itens do pacote divergem -- livro ${JSON.stringify(e.equipamento.pacote.itens)}, ` +
        `dados/ ${JSON.stringify(doDados.pacote.itens)} (bruto: "${d.equipamento}")`);
    });
  });
}

// ============================================================
// 3. Coerência cruzada com o domínio de talentos: o talento de origem
// de cada antecedente precisa existir em talentos.mjs como categoria
// 'de Origem'. Pega uma classe de erro que nenhum dos dois catálogos
// pega sozinho (nome errado, ou talento certo mas categoria errada).
// ============================================================

for (const [nome, e] of Object.entries(CATALOGO_ANTECEDENTES)) {
  test(`coerência com talentos: ${nome}`, async () => {
    await comLacuna(nome, 'antecedentes-coerencia-talento', async () => {
      const talento = CATALOGO_TALENTOS[e.talento];
      assert.ok(talento, `${nome}: talento de origem "${e.talento}" não existe em talentos.mjs`);
      assert.equal(talento.categoria, 'de Origem',
        `${nome}: talento "${e.talento}" existe em talentos.mjs mas com categoria ` +
        `"${talento.categoria}", não "de Origem"`);
    });
  });
}
