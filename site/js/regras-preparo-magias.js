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
//
// MULTICLASSE (sub-projeto 2026-08-29-troca-por-classe-descanso): a regra
// acima é POR CLASSE -- "toda classe conjuradora troca UMA magia e UM
// truque" fala da classe, não do personagem. `trocaNoDescansoLongo` recebe
// UM nome de classe DE PROPÓSITO: um personagem com duas classes
// conjuradoras (ex.: Clérigo 5/Druida 5) tem direito a UMA troca de magia e
// UMA de truque POR CLASSE -- duas no total, não uma só. Quem tem mais de
// uma superfície de conjuração chama `trocasDoDescansoLongo`, mais abaixo,
// em vez de repetir `trocaNoDescansoLongo(char.classe)` para a classe
// inicial e ignorar as demais.
// ============================================================
import { SUBCLASSES_CONJURADORAS } from './regras-conjuracao-subclasse.js';

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

/**
 * Quais trocas de magia e de truque este personagem tem DIREITO a fazer ao
 * terminar um Descanso Longo -- uma entrada por SUPERFÍCIE DE CONJURAÇÃO
 * (`superficiesDeConjuracao`, `site/js/regras-multiclasse-conjuracao.js`),
 * na mesma ordem em que `superficies` chegou (por `ordem`, classe inicial
 * primeiro).
 *
 * É a peça pura do defeito descrito no topo deste arquivo: hoje
 * `site/js/sheet/hp-descanso.js` decide a troca com
 * `trocaNoDescansoLongo(char.classe)`, o ESPELHO da classe INICIAL, que não
 * muda quando o personagem multiclassa -- um Clérigo 5/Druida 5 tem direito
 * a duas trocas e o código hoje só oferece uma, da classe que veio primeiro.
 *
 * RECEBE AS SUPERFÍCIES JÁ PRONTAS, em vez de calculá-las a partir do
 * personagem: assim esta função continua PURA (sem DOM, sem `fetch`, sem
 * estado global) e testável fora do navegador, e não duplica a regra de
 * "quais classes conjuram" -- que já mora em `superficiesDeConjuracao` e não
 * precisa de uma segunda cópia aqui.
 *
 * RESPONDE SÓ O DIREITO -- se a classe (ou a subclasse, para Cavaleiro
 * Místico/Trapaceiro Arcano) pode trocar, pela regra --, NUNCA se HÁ uma
 * magia ou um truque candidato para a troca de verdade: isso depende do
 * estado da ficha (quantas preparadas sobram para trocar, quantos truques
 * trocáveis existem) e é responsabilidade de quem consome esta função em
 * conjunto com `preparadasPorClasse` (regras-magia-classe.js) e
 * `truquesTrocaveis` (sheet/grimorio.js) -- misturar as duas perguntas aqui
 * faria esta função deixar de ser pura (teria de ler `char.magias_preparadas`
 * / `char.magias_conhecidas`) e faria "tem direito" e "tem candidata" virarem
 * uma coisa só, que é exatamente o que a Tarefa 3 deste sub-projeto existe
 * para separar.
 *
 * @param {object} personagem Personagem -- não lido diretamente aqui (toda a
 *   resposta vem de `superficies`); mantido na assinatura para simetria com
 *   as demais funções deste domínio, que recebem o personagem.
 * @param {Array<{classe: string, subclasse: string, nivelClasse: number,
 *   ordem: number, tipo: 'preparadas'|'conhecidas'}>} superficies
 *   Superfícies de conjuração já calculadas (`superficiesDeConjuracao`), na
 *   ordem de `ordem`.
 * @returns {Array<{classe: string, subclasse: string, tipo: string,
 *   rotuloMagia: 'preparada'|'conhecida', podeTrocarMagia: boolean,
 *   podeTrocarTruque: boolean}>} Array vazio para `superficies` ausente,
 *   não-array, ou vazio -- nunca lança.
 */
export function trocasDoDescansoLongo(personagem, superficies) {
  if (!Array.isArray(superficies)) return [];
  return superficies.map((s) => {
    // Cavaleiro Místico e Trapaceiro Arcano conjuram pela característica da
    // SUBCLASSE, não da classe -- `trocaNoDescansoLongo(classe)` devolve
    // `null` para Guerreiro e Ladino DE PROPÓSITO (ver docblock dela, acima),
    // porque a regra deles vem do texto da subclasse. Checar o NOME da
    // subclasse contra `SUBCLASSES_CONJURADORAS` basta aqui, sem recalcular
    // `getConjuracaoSubclasse(classe, subclasse, nivel)`: `superficies` já
    // veio filtrada por `superficiesDeConjuracao`, que só inclui uma entrada
    // de Guerreiro/Ladino quando a subclasse conjura de verdade NAQUELE
    // nível -- o teste de nível já foi feito por quem montou a superfície.
    const porSubclasseConjuradora = SUBCLASSES_CONJURADORAS.includes(s.subclasse);
    const podeTrocarMagia = trocaNoDescansoLongo(s.classe) === 'uma' || porSubclasseConjuradora;
    return {
      classe: s.classe,
      subclasse: s.subclasse,
      tipo: s.tipo,
      // Mesma expressão de hp-descanso.js:1476 -- reproduzida, não
      // reinventada.
      rotuloMagia: s.tipo === 'preparadas' ? 'preparada' : 'conhecida',
      podeTrocarMagia,
      // Decisão do dono do produto (2026-08-13, ver docblock de
      // mostrarTrocaTruque em sheet/grimorio.js): a troca de truque no
      // Descanso Longo vale para toda classe conjuradora, na MESMA
      // elegibilidade da troca de magia -- por isso a mesma condição.
      // `truquesTrocaveis()` (sheet/grimorio.js) decide se HÁ candidata; até
      // aqui só o direito.
      podeTrocarTruque: podeTrocarMagia,
    };
  });
}
