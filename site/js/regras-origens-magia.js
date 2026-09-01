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
  'telecinetico',           // Mãos Mágicas do talento Telecinético, ou o truque
                            // substituto quando o personagem já a conhece
                            // (regras-cobertura.js:643 e 647). Não foi escolhido
                            // da tabela da classe, como os demais truques de
                            // talento -- faltava aqui por descuido.
  'subclasse_fixa',         // Mãos Mágicas: o livro deixa trocar os truques da
                            // subclasse "exceto Mãos Mágicas". Diferente das
                            // demais, esta CONTA no limite de truques da tabela.
  'subclasse_automatica',   // truque concedido por característica de subclasse
  'subclasse_escolha',      // Descobertas Mágicas (Classes.md:770): o livro deixa
                            // escolher "um truque ou uma magia", e o truque escolhido
                            // é um GANHO da subclasse -- não sai do orçamento de
                            // truques da tabela da classe, e não entra na troca comum
                            // (a substituição que o livro permite é a da própria
                            // característica, ao ganhar nível de Bardo). Está também
                            // em ORIGENS_MAGIA_ISENTA, acima: a mesma escolha pode
                            // cair dos dois lados, conforme o círculo.
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

/**
 * Diz se um truque gasta uma vaga do limite de truques da tabela da classe.
 *
 * O limite é da CLASSE: truque concedido por espécie, talento ou
 * característica de subclasse não sai desse orçamento. A exceção é
 * `subclasse_fixa` (Mãos Mágicas do Trapaceiro Arcano), que o próprio livro
 * inclui na conta -- "Você conhece três truques: Mãos Mágicas e dois outros
 * truques à sua escolha". O Ilusionista tem a frase oposta e explícita ("O
 * truque não conta para o seu número de truques conhecidos"), por isso
 * `subclasse_automatica` fica de fora.
 *
 * Existe para que o critério pare de viver como lista literal dentro de
 * sheet/magias.js. Aquela lista tinha quatro origens e esquecia
 * `telecinetico` e `subclasse_automatica`, então o contador da ficha
 * acusava "Truques 3 / 2" em vermelho por um truque concedido de graça.
 */
export function truqueContaNoLimite(magia) {
  if (magia?.origem === 'subclasse_fixa') return true;
  return !ORIGENS_TRUQUE_NAO_TROCAVEL.includes(magia?.origem);
}

/**
 * Os truques do personagem que gastam vaga do limite de truques da tabela
 * da classe -- a resposta a "quanto do orçamento já foi gasto?".
 *
 * Varre as DUAS listas onde truque mora: `magias_conhecidas` (truque do
 * livro, escolhido da tabela ou concedido por espécie/talento/subclasse) e
 * `magias_customizadas` (truque que o próprio jogador inventou no
 * formulário "Magia Personalizada"). Cada entrada passa por
 * `truqueContaNoLimite` (acima), que é quem sabe quais origens o livro
 * concede de graça.
 *
 * TRUQUE PERSONALIZADO CONTA. Decisão do dono do produto, registrada em
 * docs/PERGUNTAS-PENDENTES.txt ("MAGIA CUSTOMIZADA DEVE GASTAR VAGA DO
 * ORCAMENTO DA CLASSE?"): vaga é vaga, venha de onde vier -- a mesma
 * resposta que a magia de círculo personalizada sempre teve. Até essa
 * decisão o app respondia as duas coisas ao mesmo tempo: um Bardo criava
 * um truque homebrew de graça e pagava vaga por uma magia homebrew de 1º
 * círculo, sem razão escrita para a diferença.
 *
 * POR QUE UMA FUNÇÃO, e não o filtro escrito nas duas telas: o predicado
 * `truqueContaNoLimite` SEMPRE devolveu `true` para o truque
 * personalizado -- ele não tem `origem` de concessão, e nada em
 * ORIGENS_TRUQUE_NAO_TROCAVEL o alcança. Quem o excluía eram os dois
 * CHAMADORES, cada um por um caminho diferente: a seção Magias da ficha
 * (sheet/magias.js) filtrava `!m.personalizada`, e o modal "+ Magia"
 * (sheet/grimorio.js) lia só `magias_conhecidas`, onde o truque
 * personalizado nunca mora. Duas telas, duas exclusões, nenhuma escrita
 * como regra. Essas mesmas duas telas já haviam divergido em silêncio por
 * contagem copiada à mão -- um Mago 5 com Iniciado em Magia via "Truques
 * 3 / 4" na ficha e "Truques: 4/4" no modal, com o clique no quarto
 * truque DE CLASSE recusado. Uma função só é o que impede a terceira
 * divergência.
 *
 * CÍRCULO, e por que os dois filtros não são iguais: em
 * `magias_conhecidas` o campo é sempre numérico, e `=== 0` é o que as
 * telas sempre usaram. Em `magias_customizadas` ele pode ser string
 * (ficha antiga), por isso o `Number(...) || 0` -- o MESMO saneamento de
 * `normalizarMagiaPersonalizada` (sheet/magias.js), e o complemento exato
 * de `personalizadasDeCirculoDaFicha` (sheet/grimorio.js), que separa as
 * de círculo 1+ com `Number(...) > 0`.
 *
 * @param {object} personagem Ficha (`char`, ou qualquer personagem).
 * @returns {Array<object>} As entradas que gastam vaga, na ordem
 *   "livro primeiro, personalizados depois". São os objetos da própria
 *   ficha, não cópias.
 */
export function truquesQueContamNoLimite(personagem) {
  const doLivro = (personagem?.magias_conhecidas || []).filter(m => m?.circulo === 0);
  const personalizados = (personagem?.magias_customizadas || [])
    .filter(m => (Number(m?.circulo) || 0) === 0);
  return [...doLivro, ...personalizados].filter(truqueContaNoLimite);
}
