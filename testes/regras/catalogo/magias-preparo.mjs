// ============================================================
// A tabela "Magias Preparadas por Classe" do livro, e a regra das magias
// sempre preparadas.
//
// Magias.md:19-28 -- tabela com duas colunas por classe: "Altere Quando
// Você…" e "Número de Magias". São as duas únicas variáveis da regra.
//
// ATENÇÃO AO LER ESTE ARQUIVO: desde 2026-08-19 o app NÃO segue esta tabela,
// e isso é decisão do dono do produto, não bug. A regra que o app aplica está
// em DECISAO_PRODUTO, mais abaixo, e cada diferença entre as duas está
// declarada em AFASTAMENTOS_DO_LIVRO com o motivo. A tabela do livro continua
// aqui porque é ela que dá sentido à comparação -- sem ela, "o app faz X"
// seria o oráculo medindo a própria saída.
//
// Magias.md:41 -- "Se você também tiver uma lista de magias preparadas que
// pode alterar, uma magia que você sempre tem preparada não conta no número
// de magias dessa lista."
// ============================================================

/**
 * Quando e quantas magias preparadas cada classe pode trocar.
 *
 * `ocasiao`: 'nivel' (Avança um nível) ou 'descanso-longo' (Termina um
 * Descanso Longo) -- as duas únicas formas que a tabela usa.
 * `quantas`: 'uma' ou 'qualquer' -- idem.
 */
export const TROCA_POR_CLASSE = [
  { classe: 'Bardo', ocasiao: 'nivel', quantas: 'uma', livro: 'Magias.md:21' },
  { classe: 'Bruxo', ocasiao: 'nivel', quantas: 'uma', livro: 'Magias.md:22' },
  { classe: 'Clérigo', ocasiao: 'descanso-longo', quantas: 'qualquer', livro: 'Magias.md:23' },
  { classe: 'Druida', ocasiao: 'descanso-longo', quantas: 'qualquer', livro: 'Magias.md:24' },
  { classe: 'Feiticeiro', ocasiao: 'nivel', quantas: 'uma', livro: 'Magias.md:25' },
  { classe: 'Guardião', ocasiao: 'descanso-longo', quantas: 'uma', livro: 'Magias.md:26' },
  { classe: 'Mago', ocasiao: 'descanso-longo', quantas: 'qualquer', livro: 'Magias.md:27' },
  { classe: 'Paladino', ocasiao: 'descanso-longo', quantas: 'uma', livro: 'Magias.md:28' },
];

/**
 * A REGRA QUE O APP APLICA (decisão do dono do produto, 2026-08-19),
 * transcrita aqui à mão a partir da decisão -- NÃO lida de
 * `site/js/regras-preparo-magias.js`. Ler do app faria este catálogo
 * concordar com ele por construção, e o motor deixaria de medir qualquer
 * coisa.
 *
 * A decisão, na íntegra:
 *   - Descanso Longo: toda classe conjuradora troca UMA magia e UM truque.
 *   - Subida de nível: troca QUANTAS quiser, magias e truques.
 *   - Nas duas, o que o personagem sempre tem preparado fica de fora.
 */
export const DECISAO_PRODUTO = [
  { classe: 'Bardo', descansoLongo: 'uma', nivel: 'todas' },
  { classe: 'Bruxo', descansoLongo: 'uma', nivel: 'todas' },
  { classe: 'Clérigo', descansoLongo: 'uma', nivel: 'todas' },
  { classe: 'Druida', descansoLongo: 'uma', nivel: 'todas' },
  { classe: 'Feiticeiro', descansoLongo: 'uma', nivel: 'todas' },
  { classe: 'Guardião', descansoLongo: 'uma', nivel: 'todas' },
  { classe: 'Mago', descansoLongo: 'uma', nivel: 'todas' },
  { classe: 'Paladino', descansoLongo: 'uma', nivel: 'todas' },
];

/**
 * Cada afastamento da tabela do livro, com o motivo. O motor exige que TODA
 * diferença entre `TROCA_POR_CLASSE` e `DECISAO_PRODUTO` apareça aqui -- é o
 * que separa "decidimos isso" de "ninguém percebeu".
 *
 * A chave é `<classe>|<eixo>`, com eixo em { 'descanso-longo', 'nivel' }.
 */
export const AFASTAMENTOS_DO_LIVRO = {
  'Bardo|descanso-longo':
    'O livro dá a ocasião "Avança um nível" e não prevê troca no Descanso Longo. O app oferece ' +
    'UMA troca aqui, como conveniência A MAIS -- a troca por nível continua existindo. Decisão ' +
    'do dono do produto (2026-08-19): a regra de troca é a mesma para toda classe conjuradora.',
  'Bruxo|descanso-longo':
    'Mesmo caso do Bardo: o livro dá "Avança um nível", e o app acrescenta UMA troca no Descanso ' +
    'Longo sem tirar a do nível. Decisão do dono do produto (2026-08-19).',
  'Feiticeiro|descanso-longo':
    'Mesmo caso do Bardo: o livro dá "Avança um nível", e o app acrescenta UMA troca no Descanso ' +
    'Longo sem tirar a do nível. Decisão do dono do produto (2026-08-19).',
  'Clérigo|descanso-longo':
    'O livro dá "Qualquer uma" no Descanso Longo, e o app dá UMA. É mais RESTRITIVO que o livro. ' +
    'Decisão do dono do produto (2026-08-19): remontar a lista inteira passou a ser da subida de ' +
    'nível, e o descanso ficou uniforme em uma troca para todo mundo.',
  'Druida|descanso-longo':
    'Mesmo caso do Clérigo: o livro dá "Qualquer uma" e o app dá UMA, mais restritivo. Decisão do ' +
    'dono do produto (2026-08-19).',
  'Mago|descanso-longo':
    'Mesmo caso do Clérigo: o livro dá "Qualquer uma" e o app dá UMA, mais restritivo. Decisão do ' +
    'dono do produto (2026-08-19). Não confundir com Memorizar Magia (nível 5), que é do Descanso ' +
    'CURTO e vem do texto da característica, não desta tabela.',
  'Bardo|nivel':
    'O livro dá "Uma" ao avançar de nível, e o app deixa trocar QUANTAS quiser. Decisão do dono ' +
    'do produto (2026-08-19): a subida de nível é a ocasião de remontar a lista.',
  'Bruxo|nivel':
    'Mesmo caso do Bardo: o livro dá "Uma" no nível e o app deixa trocar quantas quiser. Decisão ' +
    'do dono do produto (2026-08-19).',
  'Feiticeiro|nivel':
    'Mesmo caso do Bardo: o livro dá "Uma" no nível e o app deixa trocar quantas quiser. Decisão ' +
    'do dono do produto (2026-08-19).',
  'Clérigo|nivel':
    'O livro não prevê troca ao avançar de nível para esta classe -- a ocasião dele é o Descanso ' +
    'Longo. O app oferece, e sem limite de quantidade. Decisão do dono do produto (2026-08-19), ' +
    'que substitui a de 2026-08-13 (quando a troca de nível foi aberta a toda classe conjuradora).',
  'Druida|nivel':
    'Mesmo caso do Clérigo: o livro não prevê a ocasião, e o app oferece sem limite. Decisão do ' +
    'dono do produto (2026-08-19).',
  'Guardião|nivel':
    'Mesmo caso do Clérigo: o livro não prevê a ocasião, e o app oferece sem limite. Decisão do ' +
    'dono do produto (2026-08-19).',
  'Mago|nivel':
    'Mesmo caso do Clérigo: o livro não prevê a ocasião, e o app oferece sem limite. Decisão do ' +
    'dono do produto (2026-08-19).',
  'Paladino|nivel':
    'Mesmo caso do Clérigo: o livro não prevê a ocasião, e o app oferece sem limite. Decisão do ' +
    'dono do produto (2026-08-19).',
};


/**
 * Origens de magia que o app trata como ISENTAS do limite de preparadas, por
 * PAPEL. A distinção é real e não deriva: a lista de TRUQUE usa `especie`
 * (truque concedido pela espécie) onde a de MAGIA usa `dominio` (magia de
 * domínio de subclasse) -- são coisas diferentes, em campos diferentes do
 * personagem (`magias_conhecidas` × `magias_preparadas`).
 *
 * O motor não transcreve o conteúdo esperado destas listas: ele exige que
 * todas as cópias do MESMO papel sejam idênticas entre si. Transcrever o
 * conteúdo aqui criaria uma décima primeira cópia -- exatamente o problema
 * que este catálogo existe para medir.
 */
export const PAPEIS_LISTA_ORIGEM = {
  magia: { marcador: 'dominio', descricao: 'isentas do limite de magias PREPARADAS' },
  truque: { marcador: 'especie', descricao: 'truques que não podem ser trocados' },
};

/**
 * Cópias que existem de propósito e NÃO precisam bater com as do seu papel.
 * Cada uma com o motivo escrito -- mesmo contrato de `EXCECOES` em
 * recursos-restaurados.test.mjs: exceção sem motivo é lacuna disfarçada.
 */
export const EXCECOES_LISTA_ORIGEM = {
  // A exceção 'levelup-flow.js:466' vivia aqui, descrita como "lista de um item
  // só (`dominio`), usada para outra pergunta". A descrição estava ERRADA, e o
  // erro era do instrumento: aquela lista era `['dominio', ...origensEspeciais]`
  // -- espalhava a lista de TRUQUE --, e o extrator, que só colhia strings entre
  // aspas, enxergava `['dominio']`. Era a MESMA pergunta, respondida com a lista
  // errada. Corrigida na Correção B (2026-08-19), junto com a cegueira do
  // extrator, que hoje registra os `...espalha` e tem asserção própria.
  'sheet/migracoes.js:67': 'Migração de dado legado: classifica origens de personagens ' +
    'salvos por versões antigas do app, incluindo `telecinetico`, que nenhuma das listas ' +
    'vivas usa. Não governa o limite de nenhum personagem novo.',
};
