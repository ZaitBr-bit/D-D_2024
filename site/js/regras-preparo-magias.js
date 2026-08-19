// ============================================================
// Quando e quanto a lista de magias pode mudar.
//
// ESTA É UMA DECISÃO DE PRODUTO, e ela SE AFASTA DA TABELA DO LIVRO de
// propósito. O afastamento está escrito aqui embaixo, item por item, porque
// divergência declarada é decisão -- divergência silenciosa é bug.
//
// A REGRA DO APP (decisão do dono do produto, 2026-08-19):
//   - Descanso Longo: TODA classe conjuradora pode trocar UMA magia e UM
//     truque. Uma só, nunca a lista inteira.
//   - Subida de nível: pode trocar QUANTAS quiser, magias e truques.
//   - Nas duas ocasiões, magia ou truque que o personagem SEMPRE TEM
//     preparado fica de fora -- não foi escolha dele, não há o que trocar.
//     Quem decide isso é `regras-origens-magia.js`.
//
// A TABELA DO LIVRO (PHB 2024, Magias.md:19-28), para comparação:
//
// | Classe     | Altere Quando Você…       | Número de Magias |
// | Bardo      | Avança um nível           | Uma              |
// | Bruxo      | Avança um nível           | Uma              |
// | Clérigo    | Termina um Descanso Longo | Qualquer uma     |
// | Druida     | Termina um Descanso Longo | Qualquer uma     |
// | Feiticeiro | Avança um nível           | Uma              |
// | Guardião   | Termina um Descanso Longo | Uma              |
// | Mago       | Termina um Descanso Longo | Qualquer uma     |
// | Paladino   | Termina um Descanso Longo | Uma              |
//
// ONDE O APP SE AFASTA DELA, e por quê:
//   1. Bardo, Bruxo e Feiticeiro ganham a troca no Descanso Longo, que o
//      livro só dá ao avançar de nível. É uma conveniência A MAIS: a troca
//      por nível continua existindo para eles.
//   2. Clérigo, Druida e Mago passam a trocar UMA no Descanso Longo, e não
//      "Qualquer uma". É mais RESTRITIVO que o livro, e uniformiza a regra:
//      remontar a lista inteira é da subida de nível.
//   3. Todos podem trocar QUANTAS quiserem ao subir de nível. O livro dá
//      "Uma" a Bardo/Bruxo/Feiticeiro e nem prevê a ocasião para os demais.
//
// O motor testes/regras/unidade/magias-preparo.test.mjs confronta o app
// contra esta decisão, e SEPARADAMENTE exige que cada afastamento da tabela
// do livro esteja declarado no catálogo -- para um afastamento novo não
// entrar de carona no que já foi decidido.
// ============================================================

/** As oito classes conjuradoras que a tabela do livro cobre. */
export const CLASSES_CONJURADORAS = [
  'Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro', 'Guardião', 'Mago', 'Paladino',
];

/**
 * O que a classe pode trocar ao terminar um Descanso Longo: `'uma'` para toda
 * classe conjuradora, `null` para quem não conjura.
 *
 * Devolve `null` para Guerreiro e Ladino, que só conjuram por subclasse: a
 * regra deles vem do texto da subclasse, e quem chama trata esse caso à parte.
 */
export function trocaNoDescansoLongo(classe) {
  return CLASSES_CONJURADORAS.includes(classe) ? 'uma' : null;
}

/**
 * O que a classe pode trocar ao avançar um nível: `'todas'` para toda classe
 * conjuradora. Mesma convenção de retorno.
 */
export function trocaAoAvancarNivel(classe) {
  return CLASSES_CONJURADORAS.includes(classe) ? 'todas' : null;
}
