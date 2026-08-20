// ============================================================
// A FONTE ÚNICA das origens de magia e truque que o jogador não escolheu.
//
// PHB 2024, Magias.md:41 -- "uma magia que você sempre tem preparada não
// conta no número de magias dessa lista". A regra tem duas consequências, e
// as duas saem da MESMA lista: a magia não gasta vaga do limite de
// preparadas, e não pode ser trocada (não foi escolha do jogador, então não
// há o que trocar).
//
// POR QUE ESTE ARQUIVO EXISTE: esta lista vivia COPIADA EM DEZ LUGARES de
// site/js/, e não havia duas iguais. As diferenças não eram inofensivas --
// eram bugs que ninguém via, porque nenhuma tela mostra a lista de outra:
//
//   - `maestria_magias` e `assinatura_magica` só existiam na cópia de
//     sheet/magias.js. Na de levelup-ui.js, que monta o "qual magia sai?" da
//     troca de nível, faltavam -- e o Mago de nível 18/20 podia trocar fora
//     uma magia que o livro diz que ele SEMPRE tem preparada.
//   - `subclasse_fixa` estava em três das quatro cópias de truque e faltava
//     na de levelup-ui.js: Mãos Mágicas aparecia como trocável na subida de
//     nível, e era corretamente proibida no Descanso Longo.
//
// É a mesma forma do "terceiro vocabulário de Estilo de Luta" já registrado
// neste repositório: dado derivado copiado à mão, divergindo em silêncio.
// O comentário de sheet/grimorio.js chegava a dizer "as três precisam
// concordar" -- e elas não concordavam. Pedir concordância por comentário não
// funciona; ter um lugar só, sim.
// ============================================================

/**
 * Origens de MAGIA (círculo 1+) que o jogador não escolheu: não contam no
 * limite de preparadas e não entram numa troca.
 */
export const ORIGENS_MAGIA_ISENTA = [
  'dominio',                // magia de domínio/subclasse, concedida automaticamente
  'sempre',                 // "você sempre tem X preparada", da prosa da subclasse
  'especie_legado',         // Linhagem Élfica, Legado Ínfero
  'iniciado_em_magia',      // talento Iniciado em Magia
  'tocado_por_fadas',       // talento Tocado por Fadas
  'tocado_pelas_sombras',   // talento Tocado pelas Sombras
  'conjurador_ritualista',  // talento Conjurador Ritualista
  'subclasse_escolha',      // Descobertas Mágicas (Classes.md:770) -- o jogador
                            // escolhe QUAIS, mas depois "sempre as tem preparadas"
  'maestria_magias',        // Mago nível 18
  'assinatura_magica',      // Mago nível 20
];

/**
 * Origens de TRUQUE (círculo 0) que o jogador não escolheu: não entram numa
 * troca de truque.
 *
 * A lista difere da de magia DE PROPÓSITO, e a diferença não é descuido:
 * truque de espécie tem origem `especie` (onde a magia usa `dominio`), e as
 * duas origens de truque concedido por subclasse não têm par do lado das
 * magias.
 */
export const ORIGENS_TRUQUE_NAO_TROCAVEL = [
  'especie',                // truque de espécie (Alto Elfo, Tiferino)
  'sempre',
  'especie_legado',
  'iniciado_em_magia',
  'tocado_por_fadas',
  'tocado_pelas_sombras',
  'conjurador_ritualista',
  'subclasse_fixa',         // Mãos Mágicas: o livro deixa trocar os truques da
                            // subclasse "exceto Mãos Mágicas". Diferente das
                            // demais, esta CONTA no limite de truques da tabela.
  'subclasse_automatica',   // truque concedido por característica de subclasse
];

/**
 * Diz se o personagem tem alguma magia ou truque na ficha, venha de onde vier.
 *
 * Existe para o portão de renderização da seção de Magias (sheet/ficha.js).
 * Antes da issue #20 aquele portão era uma lista de casos -- conjurador de
 * classe, subclasse conjuradora, Iniciado em Magia, magias personalizadas --
 * e toda origem fora dela era invisível na ficha: um Monge com Tocado Por
 * Fadas tinha as duas magias gravadas no personagem e a seção inteira não era
 * montada. Perguntar "tem magia?" em vez de "é conjurador de que jeito?" não
 * tem lista para manter em dia: a próxima origem que alguém criar já nasce
 * coberta.
 */
export function possuiAlgumaMagia(char) {
  return [char?.magias_conhecidas, char?.magias_preparadas,
          char?.magias_customizadas, char?.grimorio]
    .some(lista => Array.isArray(lista) && lista.length > 0);
}

/** Diz se uma magia preparada gasta uma vaga do limite de preparadas. */
export function magiaContaNoLimite(magia) {
  return !ORIGENS_MAGIA_ISENTA.includes(magia?.origem);
}

/** O inverso de `magiaContaNoLimite`: a magia veio de uma origem especial. */
export function magiaEhEspecial(magia) {
  return !magiaContaNoLimite(magia);
}

/**
 * Diz se um truque pode entrar numa troca. Truque que o jogador não escolheu
 * (espécie, talento, ou característica que o concede fixo) não pode.
 */
export function truqueEhTrocavel(magia) {
  return !ORIGENS_TRUQUE_NAO_TROCAVEL.includes(magia?.origem);
}
