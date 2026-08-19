// ============================================================
// A tabela "Magias Preparadas por Classe" do livro, e a regra das magias
// sempre preparadas.
//
// Magias.md:19-28 -- tabela com duas colunas por classe: "Altere Quando
// Você…" e "Número de Magias". São as duas únicas variáveis da regra, e o
// app não lê nenhuma das duas: despacha por `tipo_conjuracao` de
// dados-classes.js (hp-descanso.js:1093-1095), que só tem dois valores.
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
  'levelup-flow.js:466': 'Lista de um item só (`dominio`), usada para outra pergunta -- ' +
    'quais magias já vêm concedidas no contexto do nível, não quais são isentas do limite.',
  'sheet/migracoes.js:66': 'Migração de dado legado: classifica origens de personagens ' +
    'salvos por versões antigas do app, incluindo `telecinetico`, que nenhuma das listas ' +
    'vivas usa. Não governa o limite de nenhum personagem novo.',
};
