// ============================================================
// Domínio Magias, Plano 1: as 391 magias do livro × dados/magias/.
//
// O que este motor prova: o dado de magias do app não divergiu do livro em
// nenhum dos 7 campos, e as duas fontes do app concordam entre si.
//
// O que ele NÃO prova: nada sobre COMPORTAMENTO -- quem pode preparar o quê,
// quantas, quando trocar, ritual, concentração, conjurar em círculo superior.
// Isso são os Planos 2-4 do domínio.
//
// Este motor nasceu VERDE, e isso está declarado de propósito: o pré-voo
// mediu zero divergências ANTES de escrevê-lo. Ele existe como guarda de
// regressão -- até aqui nenhum teste da suíte olhava para dados/magias/, e
// uma edição errada ali passava despercebida --, não como caça a bug. É por
// isso que o teste de mutação (Task 4 do plano) não é opcional aqui: um motor
// que nasce verde e nunca poderia falhar é pior que motor nenhum.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './harness.mjs';
import { lerMagiasDoLivro, TOTAL_MAGIAS_LIVRO } from '../catalogo/magias.mjs';

const LIVRO = lerMagiasDoLivro(
  readFileSync(join(RAIZ, 'Informacoes Separadas', 'Magias.md'), 'utf-8'));
// FONTE PRIMÁRIA: os arquivos por círculo (truques.json + circulo_1..9.json)
// guardam as 391 magias com o schema completo, `descricao` inclusive.
// `_indice.json` é derivado deles, e `por_classe/*.json` é a lista inversa --
// as três precisam concordar entre si e com o livro.
//
// Confrontar só o índice foi o primeiro desenho deste motor, e o teste de
// mutação o derrubou: estragar o `alcance` de uma magia num arquivo de
// círculo não fazia asserção nenhuma ficar vermelha, porque nada olhava para
// lá. O achado foi sobre o próprio motor, não sobre o app.
const POR_CIRCULO = new Map();
const DUPLICADAS = [];
for (const arquivo of readdirSync(join(RAIZ, 'dados', 'magias'))) {
  if (!/^(truques|circulo_\d)\.json$/.test(arquivo)) continue;
  const j = JSON.parse(readFileSync(join(RAIZ, 'dados', 'magias', arquivo), 'utf-8'));
  for (const m of (j.magias || j)) {
    // Duplicata entre arquivos seria SILENCIOSA num Map: o último lido ganha,
    // e o motor passaria a afirmar sobre uma magia que não é a que o app usa.
    // Guardada aqui em vez de conferida depois, para o erro aparecer no lugar
    // onde ele nasce.
    if (POR_CIRCULO.has(m.nome)) {
      DUPLICADAS.push(`${m.nome} (em ${POR_CIRCULO.get(m.nome)._arquivo} e ${arquivo})`);
    }
    POR_CIRCULO.set(m.nome, { ...m, _arquivo: arquivo });
  }
}

const INDICE = JSON.parse(
  readFileSync(join(RAIZ, 'dados', 'magias', '_indice.json'), 'utf-8'));
const NO_INDICE = new Map((INDICE.magias || INDICE).map((m) => [m.nome, m]));
const NO_APP = POR_CIRCULO;

// ============================================================
// Guardas do próprio leitor
// ============================================================

test('sanity: nenhuma magia aparece em dois arquivos por círculo', () => {
  assert.deepEqual(DUPLICADAS, [],
    'magia repetida entre arquivos de círculo -- o Map por nome guarda só a última lida, ' +
    'então as asserções de campo passariam a falar de uma entrada que o app talvez não use');
});

test('sanity: o leitor encontra as 391 magias do livro', () => {
  assert.equal(LIVRO.size, TOTAL_MAGIAS_LIVRO,
    `o leitor encontrou ${LIVRO.size} magias. Se o livro não mudou, alguma regra do leitor ` +
    `quebrou -- e um leitor que encontra menos do que existe faz a suíte inteira passar por ` +
    `vacuidade`);
});

test('sanity: nenhum campo ficou ilegível para o leitor', () => {
  const incompletas = [...LIVRO]
    .filter(([, v]) => Object.values(v).some((x) => x === null))
    .map(([n]) => n);
  assert.deepEqual(incompletas, [],
    'magia(s) com campo que o leitor não entendeu -- corrija o LEITOR (ver as armadilhas ' +
    'medidas no plano), nunca relaxe a asserção');
});

// ============================================================
// Bijeção
// ============================================================

test('bijeção: os arquivos por círculo têm exatamente as magias do livro', () => {
  assert.deepEqual([...POR_CIRCULO.keys()].sort(), [...LIVRO.keys()].sort(),
    'os arquivos dados/magias/{truques,circulo_N}.json divergiram do livro');
});

test('bijeção: o índice tem exatamente as magias dos arquivos por círculo', () => {
  assert.deepEqual([...NO_INDICE.keys()].sort(), [...POR_CIRCULO.keys()].sort(),
    '_indice.json divergiu dos arquivos por círculo -- ele é DERIVADO deles');
});

for (const [nome, doCirculo] of POR_CIRCULO) {
  test(`índice × arquivo por círculo: ${nome}`, () => {
    const doIndice = NO_INDICE.get(nome);
    assert.ok(doIndice, `${nome} está num arquivo por círculo e não em _indice.json`);
    for (const campo of ['circulo', 'escola', 'tempo_conjuracao', 'alcance', 'componentes', 'duracao']) {
      assert.equal(doIndice[campo], doCirculo[campo],
        `${nome} — ${campo}: _indice.json tem ${JSON.stringify(doIndice[campo])} e ` +
        `${doCirculo._arquivo} tem ${JSON.stringify(doCirculo[campo])}`);
    }
    assert.deepEqual([...(doIndice.classes || [])].sort(), [...(doCirculo.classes || [])].sort(),
      `${nome} — classes: _indice.json e ${doCirculo._arquivo} divergiram`);
  });
}

// ============================================================
// Os 7 campos, magia a magia
// ============================================================

const CAMPOS = ['circulo', 'escola', 'tempo_conjuracao', 'alcance', 'componentes', 'duracao'];

for (const [nome, L] of LIVRO) {
  test(`magia × livro: ${nome}`, () => {
    const A = NO_APP.get(nome);
    assert.ok(A, `${nome} existe no livro e não nos arquivos dados/magias/ por círculo`);
    for (const campo of CAMPOS) {
      assert.equal(A[campo], L[campo],
        `${nome} — ${campo}: o livro diz ${JSON.stringify(L[campo])} e o app tem ` +
        `${JSON.stringify(A[campo])}`);
    }
    assert.deepEqual([...(A.classes || [])].sort(), [...L.classes].sort(),
      `${nome} — classes: o livro diz ${JSON.stringify(L.classes)} e o app tem ` +
      `${JSON.stringify(A.classes)}`);
  });
}

// ============================================================
// As duas fontes do app concordam
// ============================================================
//
// `_indice.json` guarda `classes` por magia; `por_classe/*.json` guarda a
// lista inversa. São o MESMO fato escrito duas vezes -- exatamente o padrão
// que já deu errado três vezes neste repositório (os dois nomes de subclasse
// do Clérigo, a guarda de Juramento do Paladino, o terceiro vocabulário de
// Estilo de Luta). Duas fontes só são seguras com um teste que as confronte.

const NOME_ARQUIVO_CLASSE = {
  bardo: 'Bardo', bruxo: 'Bruxo', clerigo: 'Clérigo', druida: 'Druida',
  feiticeiro: 'Feiticeiro', guardiao: 'Guardião', mago: 'Mago', paladino: 'Paladino',
};

for (const arquivo of readdirSync(join(RAIZ, 'dados', 'magias', 'por_classe'))) {
  const classe = NOME_ARQUIVO_CLASSE[arquivo.replace('.json', '')];
  test(`duas fontes concordam: ${classe || arquivo}`, () => {
    assert.ok(classe, `arquivo por_classe/${arquivo} sem classe conhecida no mapa deste motor`);
    const j = JSON.parse(
      readFileSync(join(RAIZ, 'dados', 'magias', 'por_classe', arquivo), 'utf-8'));
    const doArquivo = (j.magias || j).map((m) => m.nome || m).sort();
    const daFonte = [...POR_CIRCULO.values()]
      .filter((m) => (m.classes || []).includes(classe)).map((m) => m.nome).sort();
    assert.deepEqual(doArquivo, daFonte,
      `por_classe/${arquivo} e o campo 'classes' dos arquivos por círculo divergiram para ${classe}`);
  });
}
