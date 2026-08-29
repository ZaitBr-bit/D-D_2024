// ============================================================
// Proficiencias de equipamento por classe, com o subconjunto de
// multiclasse do livro:2051.
//
// POR QUE ESTE MODULO EXISTE. Ate aqui, armadura e arma saiam de
// `CLASSES_INFO[personagem.classe]` -- o ESPELHO da classe INICIAL --
// em quatro lugares independentes (regras-equipamento.js, levelup.js,
// sheet/ficha.js, sheet/impressao.js). Num Mago 5/Guerreiro 1 isso
// significa que a ficha nao reconhecia NENHUMA proficiencia vinda do
// Guerreiro, e o portao de talentos recusava "Treinamento com armadura
// pesada" para quem tinha direito a pedir por ele.
//
// A DERIVACAO E DE PROPOSITO. Armadura e arma NAO sao gravadas na ficha:
// sao recalculadas a partir de `classes[]` a cada leitura. Isso dispensa
// migracao e faz as fichas multiclasse que ja existem no disco ficarem
// corretas no primeiro render, sem tocar em disco. Pericia, ferramenta e
// instrumento sao arrays GRAVADOS e continuam sendo escritos -- mas so no
// instante em que a classe entra em `classes[]` (levelup.js), porque sao
// escolhas do jogador e nao dao para derivar.
//
// MODULO PURO: sem DOM, sem estado global, personagem sempre por
// parametro -- mesma disciplina de regras-equipamento.js, cujo cabecalho
// registra que duas fontes da verdade para a mesma regra foi o bug raiz.
// ============================================================
import { CLASSES_INFO, PERICIAS } from './dados-classes.js';
import { classesDe, classeInicial } from './regras-multiclasse.js';

/**
 * Concessoes de UMA classe da ficha, ja decidindo entre o conjunto
 * COMPLETO (classe inicial, ordem 0) e o REDUZIDO (qualquer classe
 * adquirida depois, livro:2051).
 *
 * Classe fora do catalogo falha FECHADA (tudo vazio/zero), como
 * `podeEntrarEm` e `contextoDeSubida` ja fazem.
 *
 * @param {object} personagem Ficha inteira -- precisa dela para saber
 *   qual classe e a inicial.
 * @param {string} nomeClasse Classe cujas concessoes se quer.
 * @returns {{armaduras: string[], armas: string[], pericias: number,
 *   ferramentas: string[], instrumentos: number}}
 */
export function concessoesDaClasse(personagem, nomeClasse) {
  const info = CLASSES_INFO[nomeClasse];
  if (!info) return { armaduras: [], armas: [], pericias: 0, ferramentas: [], instrumentos: 0 };

  // A comparacao e pelo NOME da entrada de ordem 0, nunca por
  // `personagem.classe`: o espelho pode estar dessincronizado numa ficha
  // legada, e `classeInicial` ja avisa no console quando o dado esta
  // malformado. `classeInicial` devolve a ENTRADA, nao uma string.
  const inicial = classeInicial(personagem)?.classe;
  if (nomeClasse === inicial) {
    return {
      armaduras: [...(info.armaduras || [])],
      armas: [...(info.armas || [])],
      pericias: info.num_pericias || 0,
      ferramentas: [...(info.ferramentas || [])],
      instrumentos: info.instrumentos || 0,
    };
  }

  const mc = info.proficiencias_multiclasse || {};
  return {
    armaduras: [...(mc.armaduras || [])],
    armas: [...(mc.armas || [])],
    pericias: mc.pericias || 0,
    ferramentas: [...(mc.ferramentas || [])],
    instrumentos: mc.instrumentos || 0,
  };
}

/**
 * Junta uma chave de `concessoesDaClasse` em TODAS as classes da ficha,
 * sem repetir e preservando a ordem de `classes[]` (que e a ordem em que
 * o jogador adquiriu as classes -- previsivel na tela).
 *
 * Existe para `armadurasDoPersonagem` e `armasDoPersonagem` nao repetirem
 * o mesmo laco: era exatamente essa duplicacao que espalhou a leitura do
 * espelho por quatro arquivos.
 */
function unirEntreClasses(personagem, chave) {
  const saida = [];
  for (const entrada of classesDe(personagem)) {
    for (const item of concessoesDaClasse(personagem, entrada.classe)[chave]) {
      if (!saida.includes(item)) saida.push(item);
    }
  }
  return saida;
}

/**
 * Todas as categorias de ARMADURA que o personagem domina pelas classes.
 * Rotulos do livro ("Leve", "Media", "Pesada", "Escudo").
 *
 * NAO inclui `proficiencias_extra` (talento/subclasse) de proposito: esse
 * array e uma fonte SEPARADA, com rotulo diferente ("Armadura Media" com
 * prefixo), e cada consumidor ja tem a sua propria forma de mescla-lo.
 * Juntar os dois aqui obrigaria este modulo a escolher um formato de
 * rotulo e quebraria os consumidores que esperam o outro.
 */
export function armadurasDoPersonagem(personagem) {
  return unirEntreClasses(personagem, 'armaduras');
}

/**
 * Descarta os rotulos QUALIFICADOS cuja categoria NUA ja esta na lista.
 *
 * POR QUE ISTO E PRECISO. O catalogo nao usa vocabulario fechado: dois dos
 * doze conjuntos COMPLETOS trazem rotulo composto -- "Marcial (Acuidade ou
 * Leve)" (Ladino) e "Marcial (Leve)" (Monge). Enquanto a leitura era de UMA
 * classe o vocabulario era coerente; a uniao de multiclasse mistura os dois
 * e a dedup por igualdade exata de `unirEntreClasses` nao tem como saber que
 * "Marcial" ENGLOBA "Marcial (Acuidade ou Leve)". Um Ladino 5/Guerreiro 1
 * saia daqui com ["Simples", "Marcial (Acuidade ou Leve)", "Marcial"], e a
 * ficha e a folha impressa mostravam as duas afirmacoes lado a lado -- uma
 * delas (a restrita) ja nao valendo.
 *
 * O conserto mora AQUI e nao nas telas de proposito: ficha.js e impressao.js
 * precisariam de uma copia identica da mesma normalizacao, que e o bug raiz
 * registrado no cabecalho de regras-equipamento.js.
 *
 * A REGRA NAO MUDA: `temProficienciaArma` ja concedia todas as Marciais a
 * quem tem "Marcial" nu (comparacao por igualdade exata), e os ramos de
 * Acuidade/Leve dela so importam quando o rotulo nu NAO esta presente --
 * exatamente o caso em que este filtro nao descarta nada.
 *
 * @param {string[]} lista Rotulos ja unidos, na ordem de `classes[]`.
 * @returns {string[]} a mesma lista sem as variantes ja englobadas.
 */
function descartarVariantesEnglobadas(lista) {
  const nuas = lista.filter((rotulo) => !rotulo.includes('('));
  return lista.filter((rotulo) => {
    if (!rotulo.includes('(')) return true;
    return !nuas.includes(rotulo.split('(')[0].trim());
  });
}

/**
 * Todas as categorias de ARMA que o personagem domina pelas classes.
 *
 * Passa pelo filtro de variantes englobadas (acima); `armadurasDoPersonagem`
 * nao passa porque os rotulos de armadura do catalogo sao um vocabulario
 * fechado de quatro palavras nuas ("Leve", "Media", "Pesada", "Escudo") --
 * nao ha variante qualificada que possa se contradizer.
 */
export function armasDoPersonagem(personagem) {
  return descartarVariantesEnglobadas(unirEntreClasses(personagem, 'armas'));
}

/**
 * O que uma classe entrega a quem entra nela COMO CLASSE NOVA -- a
 * pergunta que o assistente de nivel faz antes de gravar. Nao depende de
 * personagem nenhum: e a linha do livro daquela classe.
 *
 * `opcoesPericia` resolve a divergencia entre as tres classes que
 * concedem escolha de pericia. O livro trata os casos de forma diferente
 * e a diferenca e real:
 *   - Bardo (Classes.md:366): "uma pericia a sua escolha" -- QUALQUER
 *     uma. `pericias_opcoes` e null, e a convencao "null = qualquer" ja
 *     existe em creator/comum.js:205.
 *   - Guardiao (Classes.md:3246) e Ladino (Classes.md:4172): "da lista de
 *     pericias de X" -- restrito.
 * Devolver a lista JA RESOLVIDA evita que cada tela repita esse `||`, que
 * e onde a divergencia entre Bardo e os outros dois se perderia.
 *
 * @returns {{armaduras: string[], armas: string[], pericias: number,
 *   ferramentas: string[], instrumentos: number, opcoesPericia: string[]}}
 */
export function concessoesAoEntrarEm(nomeClasse) {
  const info = CLASSES_INFO[nomeClasse];
  if (!info) {
    return { armaduras: [], armas: [], pericias: 0, ferramentas: [], instrumentos: 0, opcoesPericia: [] };
  }
  const mc = info.proficiencias_multiclasse || {};
  return {
    armaduras: [...(mc.armaduras || [])],
    armas: [...(mc.armas || [])],
    pericias: mc.pericias || 0,
    ferramentas: [...(mc.ferramentas || [])],
    instrumentos: mc.instrumentos || 0,
    opcoesPericia: info.pericias_opcoes || PERICIAS.map((p) => p.nome),
  };
}
