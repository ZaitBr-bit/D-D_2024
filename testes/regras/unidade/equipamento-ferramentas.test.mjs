// ============================================================
// Ferramentas: peso e custo têm de existir na camada do DADO, não só na
// do livro (issue #43, causa raiz A).
//
// `dados/equipamento/ferramentas.json` nasceu com `"tabelas": []`. O
// extrator (`_extrair_json.py::extrair_ferramentas`) só procurava TABELAS
// markdown na seção "# Ferramentas" do livro -- e essa seção não tem
// nenhuma: cada ferramenta é um `#### Nome (custo)` seguido de linhas
// `**Atributo:**` e `**Peso:**`. Resultado: todo o peso das ferramentas
// existia apenas dentro de `texto_completo`, como prosa, e nenhuma tela
// conseguia lê-lo. "Ferramentas de Ladrão" entrava no inventário do Ladino
// sem os 0,5 kg que o livro dá a ela, e a barra "Peso: X / Y kg" da ficha
// saía subestimada.
//
// A asserção é de PARIDADE ENTRE AS DUAS CAMADAS: a lista estruturada tem
// de conter exatamente as mesmas ferramentas que o texto do livro declara,
// com os mesmos custo, peso e atributo. Escrita assim, ela não pode ser
// satisfeita por uma tabela chumbada à mão que diverja da prosa -- e volta
// a ficar vermelha se um dia o livro for reextraído e o extrator perder as
// ferramentas de novo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

const ARQUIVO = resolve(RAIZ, 'dados', 'equipamento', 'ferramentas.json');
const DADOS = JSON.parse(readFileSync(ARQUIVO, 'utf-8'));

// A camada do LIVRO: `#### Ferramentas de Ladrão (25 PO)` abre o bloco de
// uma ferramenta, e as linhas `**Atributo:**` / `**Peso:**` até o próximo
// cabeçalho são os dados dela.
const RE_CABECALHO_FERRAMENTA = /^####\s+(.+?)\s*\(([^()]*)\)\s*$/;

/** Lê do `texto_completo` a lista de ferramentas que o livro declara. */
function ferramentasDoLivro(texto) {
  const linhas = String(texto || '').split('\n');
  const achadas = [];
  for (let i = 0; i < linhas.length; i++) {
    const cabecalho = linhas[i].match(RE_CABECALHO_FERRAMENTA);
    if (!cabecalho) continue;
    let peso = '';
    let atributo = '';
    for (let j = i + 1; j < linhas.length && !linhas[j].startsWith('#'); j++) {
      const mPeso = linhas[j].match(/^\*\*Peso:\*\*\s*(.+)$/);
      const mAtributo = linhas[j].match(/^\*\*Atributo:\*\*\s*(.+)$/);
      if (mPeso) peso = mPeso[1].trim();
      if (mAtributo) atributo = mAtributo[1].trim();
    }
    achadas.push({ nome: cabecalho[1].trim(), custo: cabecalho[2].trim(), peso, atributo });
  }
  return achadas;
}

/** Lê a camada do DADO: a tabela estruturada de ferramentas do JSON. */
function ferramentasEstruturadas(dados) {
  const tabela = (dados.tabelas || [])
    .find(t => (t.cabecalhos || []).includes('Ferramenta'));
  return (tabela?.dados || []).map(d => ({
    nome: (d.Ferramenta || '').trim(),
    custo: (d.Custo || '').trim(),
    peso: (d.Peso || '').trim(),
    atributo: (d.Atributo || '').trim(),
  }));
}

const DO_LIVRO = ferramentasDoLivro(DADOS.texto_completo);

// Guarda contra o motor virar vacuamente verde se `texto_completo` sumir
// ou o formato do livro mudar: são 25 ferramentas na seção (17 de artesão
// + 8 outras), todas com peso declarado.
test('o texto do livro declara as 25 ferramentas, com peso', () => {
  assert.equal(DO_LIVRO.length, 25,
    `esperadas 25 ferramentas no texto do livro, lidas ${DO_LIVRO.length}`);
  const semPeso = DO_LIVRO.filter(f => !f.peso).map(f => f.nome);
  assert.deepEqual(semPeso, [],
    `ferramenta sem "**Peso:**" no texto do livro: ${semPeso.join(', ')}`);
});

test('toda ferramenta do livro existe na tabela estruturada', () => {
  const estruturadas = ferramentasEstruturadas(DADOS);
  const nomes = new Set(estruturadas.map(f => f.nome));
  const faltando = DO_LIVRO.filter(f => !nomes.has(f.nome)).map(f => f.nome);
  assert.deepEqual(faltando, [],
    'ferramenta que só existe na prosa de `texto_completo` e nunca foi extraída ' +
    `para \`tabelas\` -- nenhuma tela consegue ler o peso dela:\n  ${faltando.join('\n  ')}`);
});

test('a tabela estruturada não inventa ferramenta que o livro não tem', () => {
  const estruturadas = ferramentasEstruturadas(DADOS);
  const nomesLivro = new Set(DO_LIVRO.map(f => f.nome));
  const sobrando = estruturadas.filter(f => !nomesLivro.has(f.nome)).map(f => f.nome);
  assert.deepEqual(sobrando, [],
    `ferramenta na tabela estruturada sem par no texto do livro: ${sobrando.join(', ')}`);
});

for (const doLivro of DO_LIVRO) {
  test(`${doLivro.nome}: custo, peso e atributo batem com o livro`, () => {
    const estruturada = ferramentasEstruturadas(DADOS).find(f => f.nome === doLivro.nome);
    assert.ok(estruturada, `"${doLivro.nome}" não está em \`tabelas\``);
    assert.equal(estruturada.custo, doLivro.custo, `custo de ${doLivro.nome}`);
    assert.equal(estruturada.peso, doLivro.peso, `peso de ${doLivro.nome}`);
    assert.equal(estruturada.atributo, doLivro.atributo, `atributo de ${doLivro.nome}`);
  });
}
