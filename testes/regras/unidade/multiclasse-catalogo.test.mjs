// ============================================================
// Guardas estruturais do catálogo de multiclasse.
//
// Não confrontam o app -- confrontam a TRANSCRIÇÃO consigo mesma. Uma
// tabela transcrita à mão erra por omissão: uma linha esquecida não
// quebra nada, só desaparece. Estas guardas pegam isso.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRE_REQUISITOS, PROFICIENCIAS_MULTICLASSE, CATEGORIA_CONJURACAO,
  TABELA_CONJURADOR_MULTICLASSE,
} from '../catalogo/multiclasse.mjs';
import { lerConteudoLivro } from './harness.mjs';

const CLASSES = [
  'Bárbaro', 'Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro',
  'Guardião', 'Guerreiro', 'Ladino', 'Mago', 'Monge', 'Paladino',
];

const ARQUIVO_LIVRO = 'D&D 5.5 - Livro do Jogador (2024) 5.3.7.md';
const LEGENDA_TABELA = 'Conjurador Multiclasse: Espaços de Magia por Círculo de Magia';

// Lê a tabela "Conjurador Multiclasse" direto do arquivo do livro (não do
// catálogo) e devolve { nivel: [9 valores] }, com 0 onde o livro traz "—".
// Existe para dar à guarda de monotonicidade uma segunda guarda
// independente: monotonicidade só pega erro para BAIXO -- um dígito trocado
// que ainda cresce (ex.: nível 5/3º círculo virar 3 em vez de 2, com nível 4
// em 0 e nível 6 em 3) escapa ileso, achado comprovado na Rodada 1 de
// revisão. Um checksum escrito à mão não serviria: erraria junto com a
// mesma transcrição que ele deveria auditar. Ler o livro de novo, em tempo
// de teste, é a única fonte de fato independente do catálogo.
//
// Falha ALTO (assert, não retorno silencioso) se a legenda sumir do livro
// ou se o parser encontrar menos de 20 linhas de dados -- um parser que
// devolvesse [] compararia vazio contra vazio e passaria sem provar nada.
function extrairTabelaConjuradorDoLivro() {
  const texto = lerConteudoLivro(ARQUIVO_LIVRO);
  const linhas = texto.split('\n');

  const idxLegenda = linhas.findIndex((l) => l.includes(LEGENDA_TABELA));
  assert.ok(idxLegenda >= 0,
    `não achei a legenda "${LEGENDA_TABELA}" no livro -- o arquivo mudou de forma?`);

  // Colhe as linhas de tabela markdown (começam com "|") logo após a
  // legenda, parando na primeira linha que não é mais tabela.
  const linhasTabela = [];
  for (let i = idxLegenda + 1; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (l.startsWith('|')) linhasTabela.push(l);
    else if (linhasTabela.length > 0) break;
  }

  // As duas primeiras linhas coletadas são cabeçalho e separador
  // ("|---|---|..."); o resto são as linhas de dados (nível 1 a 20).
  assert.ok(linhasTabela.length >= 3,
    `achei só ${linhasTabela.length} linha(s) de tabela markdown após a legenda -- ` +
    'esperava cabeçalho + separador + 20 linhas de dados');
  const [cabecalho, separador, ...linhasDados] = linhasTabela;
  assert.match(cabecalho, /\*\*Nível\*\*/,
    'a primeira linha de tabela não parece o cabeçalho esperado (sem "**Nível**")');
  assert.match(separador, /^\|[-:\s|]+\|$/,
    'a segunda linha de tabela não parece o separador markdown esperado ("|---|---|...")');
  assert.equal(linhasDados.length, 20,
    `extraí ${linhasDados.length} linha(s) de dados do livro, esperava exatamente 20 -- ` +
    'parser ou arquivo do livro divergem do formato conhecido');

  const tabela = {};
  for (const linha of linhasDados) {
    // A linha começa e termina com "|"; split produz um elemento vazio em
    // cada ponta -- slice(1, -1) descarta as duas pontas, sobrando
    // [nível, 9 células de círculo].
    const celulas = linha.split('|').slice(1, -1).map((c) => c.trim());
    assert.equal(celulas.length, 10,
      `linha "${linha}" tem ${celulas.length} célula(s), esperava 10 (nível + 9 círculos)`);
    const nivel = Number(celulas[0]);
    assert.ok(Number.isInteger(nivel) && nivel >= 1 && nivel <= 20,
      `não consegui ler o nível da linha "${linha}"`);
    const circulos = celulas.slice(1).map((v) => (v === '—' ? 0 : Number(v)));
    assert.ok(circulos.every((n) => Number.isInteger(n) && n >= 0),
      `nível ${nivel}: célula não numérica e diferente de "—" na linha "${linha}"`);
    tabela[nivel] = circulos;
  }

  // Prova final de que a extração não é vazia nem parcial: exatamente os
  // níveis 1..20, cada um com 9 valores -- só então a comparação seguinte
  // deixa de ser vácua.
  const niveisExtraidos = Object.keys(tabela).map(Number).sort((a, b) => a - b);
  assert.deepEqual(niveisExtraidos, Array.from({ length: 20 }, (_, i) => i + 1),
    'os níveis extraídos do livro não cobrem exatamente 1..20');
  for (const [nivel, circulos] of Object.entries(tabela)) {
    assert.equal(circulos.length, 9, `nível ${nivel}: extraí ${circulos.length} círculos, esperava 9`);
  }

  return tabela;
}

test('os quatro mapas cobrem exatamente as 12 classes', () => {
  for (const [nome, mapa] of Object.entries({
    PRE_REQUISITOS, PROFICIENCIAS_MULTICLASSE, CATEGORIA_CONJURACAO,
  })) {
    assert.deepEqual(Object.keys(mapa).sort(), [...CLASSES].sort(),
      `${nome}: chaves divergem das 12 classes`);
  }
});

test('a tabela de Conjurador Multiclasse tem 20 níveis × 9 círculos', () => {
  const niveis = Object.keys(TABELA_CONJURADOR_MULTICLASSE).map(Number).sort((a, b) => a - b);
  assert.deepEqual(niveis, Array.from({ length: 20 }, (_, i) => i + 1),
    'faltam ou sobram níveis na tabela');
  for (const [nivel, linha] of Object.entries(TABELA_CONJURADOR_MULTICLASSE)) {
    assert.equal(linha.length, 9, `nível ${nivel}: a linha tem de ter 9 círculos`);
    assert.ok(linha.every((n) => Number.isInteger(n) && n >= 0),
      `nível ${nivel}: só inteiros não negativos (use 0 onde o livro traz "—")`);
  }
});

test('a tabela é monotônica: nenhum círculo perde espaços ao subir de nível', () => {
  // Propriedade estrutural da tabela do livro. Um dígito trocado na
  // transcrição quase sempre a viola -- é a guarda mais barata contra erro
  // de digitação, e não depende de reconferir os 180 valores um a um.
  for (let nivel = 2; nivel <= 20; nivel++) {
    const antes = TABELA_CONJURADOR_MULTICLASSE[nivel - 1];
    const agora = TABELA_CONJURADOR_MULTICLASSE[nivel];
    for (let c = 0; c < 9; c++) {
      assert.ok(agora[c] >= antes[c],
        `nível ${nivel}, ${c + 1}º círculo: ${agora[c]} é menor que ${antes[c]} do nível anterior`);
    }
  }
});

test('a tabela bate célula a célula com a tabela lida do livro em tempo de teste', () => {
  // Fonte independente da transcrição: relê o livro agora, não confia no
  // que foi digitado em multiclasse.mjs. Monotonicidade (teste acima) só
  // pega erro para baixo -- esta guarda pega qualquer dígito trocado, para
  // cima ou para baixo, porque compara valor a valor contra o livro.
  const tabelaLivro = extrairTabelaConjuradorDoLivro();
  for (let nivel = 1; nivel <= 20; nivel++) {
    assert.deepEqual(TABELA_CONJURADOR_MULTICLASSE[nivel], tabelaLivro[nivel],
      `nível ${nivel}: catálogo diverge da tabela lida do livro`);
  }
});

test('conector só pode ser "e" ou "ou", e Guerreiro é a única com "ou"', () => {
  const comOu = [];
  for (const [nome, pre] of Object.entries(PRE_REQUISITOS)) {
    assert.ok(['e', 'ou'].includes(pre.conector), `${nome}: conector inválido`);
    assert.ok(pre.lista.length >= 1, `${nome}: lista de atributos vazia`);
    if (pre.conector === 'ou') comOu.push(nome);
  }
  assert.deepEqual(comOu, ['Guerreiro'],
    'no PHB 2024 só o Guerreiro tem pré-requisito alternativo ("Força ou Destreza")');
});
