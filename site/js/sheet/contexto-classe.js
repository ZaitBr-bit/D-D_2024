// ============================================================
// Contexto de classe com escopo.
//
// Um contexto por classe do personagem, para os renderizadores da ficha
// deixarem de supor "uma classe so". O contexto e um objeto SIMPLES,
// passado por parametro -- nunca estado de modulo. Trocar `classeData`
// no meio de um laco de render criaria reentrancia: qualquer funcao
// chamada la dentro leria um valor que muda debaixo dela.
// ============================================================
import { char, classesData, definirClassesData } from './estado.js';
import { classesDe } from '../regras-multiclasse.js';
import { superficiesDeConjuracao } from '../regras-multiclasse-conjuracao.js';
import { getClasse } from '../db.js';

/**
 * Monta um contexto por classe do personagem, na ordem de aquisicao.
 * PURA: recebe o personagem e o mapa de dados por parametro, e nao le
 * `char` nem `classesData` como global.
 *
 * `classesDe` normaliza ficha legada nao migrada, entao um personagem
 * que nunca abriu a ficha produz um contexto de uma classe, e nao
 * undefined.
 *
 * Classe cujo dado nao esta no mapa entra com `dados: null` -- explicito,
 * para o consumidor decidir. O mecanismo nao engole nem inventa.
 *
 * @param {object} personagem
 * @param {Map<string, object>} mapaDados - dados por nome de classe.
 * @returns {Array<{classe: string, subclasse: string, nivelClasse: number, ordem: number, dados: object|null}>}
 */
export function montarContextos(personagem, mapaDados) {
  return classesDe(personagem)
    .map((c) => ({
      classe: c.classe,
      subclasse: c.subclasse,
      nivelClasse: c.nivel,
      ordem: c.ordem,
      dados: mapaDados?.get?.(c.classe) || null,
    }))
    .sort((a, b) => a.ordem - b.ordem);
}

/**
 * Casca no idioma da ficha: le os live bindings de estado.js.
 * A logica esta em montarContextos, que e pura e testavel fora do navegador.
 */
export function contextosDeClasse() {
  return montarContextos(char, classesData);
}

/**
 * Casca no idioma da ficha: le os live bindings de estado.js.
 * A logica esta em superficiesDeConjuracao, que e pura e testavel fora do
 * navegador (site/js/regras-multiclasse-conjuracao.js).
 */
export function superficiesDaFicha(personagem = char) {
  return superficiesDeConjuracao(personagem, classesData);
}

// --- Seletor de superficie de conjuracao (Tarefa 4, sub-projeto "tela
// magias por classe") -----------------------------------------------------

// Classe da superficie de conjuracao ESCOLHIDA no seletor de classe
// (sheet/magias.js). Guarda o NOME DA CLASSE, nao um indice no array: um
// indice sobreviveria a uma subida de nivel que reordena/abre uma classe
// nova e passaria a apontar para a superficie ERRADA sem avisar ninguem --
// o nome, nao. `null` = "nenhuma escolha ainda", resolvido para a PRIMEIRA
// superficie (a classe inicial) em superficieAtivaDaFicha, logo abaixo --
// o mesmo que a tela sempre mostrou antes do seletor existir.
//
// Sobrevive a re-renders da MESMA ficha (mesmo padrao de
// `_truquesColapsados`, sheet/colapso.js: variavel de modulo, nao estado
// de componente) e e resetada na abertura de OUTRA ficha por
// `resetarSuperficieSelecionada` (chamada por renderSheet, pages/sheet.js)
// -- sem isso, abrir um segundo personagem que por coincidencia tem uma
// classe do mesmo nome herdaria a escolha feita no personagem anterior.
let _classeSuperficieSelecionada = null;

/**
 * Marca a superficie de conjuracao escolhida no seletor de classe. Chamada
 * pelo clique na aba (sheet/magias.js, `data-tab-superficie`). `null`
 * volta ao padrao (a primeira superficie).
 * @param {string|null} classe
 */
export function definirSuperficieSelecionada(classe) {
  _classeSuperficieSelecionada = classe || null;
}

/**
 * Reseta a escolha do seletor de classe. Chamada pela abertura de ficha
 * (renderSheet) -- sem isso, a classe escolhida na ficha ANTERIOR vazaria
 * para a proxima aberta na mesma sessao do navegador.
 */
export function resetarSuperficieSelecionada() {
  _classeSuperficieSelecionada = null;
}

/**
 * Superficie de conjuracao ATIVA da ficha: a escolhida no seletor de
 * classe, se ela ainda existir entre as superficies atuais do personagem,
 * ou a PRIMEIRA (a classe inicial) por padrao -- o mesmo comportamento de
 * antes do seletor existir (Tarefas 2 e 3). O `find` (em vez de confiar
 * cegamente na escolha) e barato e cobre o personagem que, por algum
 * caminho fora de `resetarSuperficieSelecionada`, deixou de ter aquela
 * classe entre as superficies.
 *
 * Toda funcao de sheet/magias.js e sheet/grimorio.js que decidia "de que
 * classe" chamando `superficiesDaFicha(char)[0]` (a primeira, fixa) passa
 * a chamar esta -- ver o comentario de `superficieAtiva()` nos dois
 * arquivos. E a UNICA variavel que muda: nenhuma das funcoes que a chamam
 * foi reescrita.
 * @param {object} [personagem]
 * @returns {object|null}
 */
export function superficieAtivaDaFicha(personagem = char) {
  const superficies = superficiesDaFicha(personagem);
  if (superficies.length === 0) return null;
  const escolhida = _classeSuperficieSelecionada
    && superficies.find((s) => s.classe === _classeSuperficieSelecionada);
  return escolhida || superficies[0];
}

/**
 * Dados de UMA classe do personagem, pelo nome.
 * Devolve null explicito quando a classe nao esta carregada -- o consumidor
 * decide, como em montarContextos. Existe para os 12 modulos de classe nao
 * repetirem `classesData?.get(...)` doze vezes.
 * @param {string} nomeClasse
 * @returns {object|null}
 */
export function dadosDe(nomeClasse) {
  return classesData?.get?.(nomeClasse) || null;
}

/**
 * Garante que `classesData` tem os dados de TODA classe do personagem.
 *
 * O mapa era montado UMA VEZ, na abertura da ficha. Depois de uma subida
 * de nivel que ABRE uma classe nova, `confirmarLevelUp` re-renderiza a
 * ficha (levelup-ui.js) com o mapa da abertura -- sem a classe nova
 * dentro. O modo de falha nao e erro, e "sumiu": zero espacos de magia
 * quando a classe nova e a unica conjuradora (montarReservasDeEspacos ->
 * getEspacosMagia(undefined, n) -> {}), nenhuma caracteristica e nenhuma
 * subclasse dela (montarContextos devolve `dados: null` e os
 * renderizadores degradam para vazio), reserva de pacto ausente para um
 * Bruxo recem-aberto e Descanso sem restaurar os usos dela. Um F5
 * consertava tudo -- justamente por isso passava despercebido.
 *
 * `getClasse` tem cache em memoria (db.js), entao repetir a chamada para
 * uma classe ja carregada custa zero rede.
 *
 * @param {object} [personagem] Personagem; por padrao o `char` da ficha.
 * @param {boolean} [doZero] `true` na ABERTURA da ficha -- monta um mapa
 *   NOVO, para nao herdar as classes do personagem aberto antes. `false`
 *   (padrao) completa o mapa atual, que e o caso da re-renderizacao
 *   depois de uma subida de nivel.
 * @returns {Promise<Map<string, object>>} o mapa ja em `classesData`.
 */
export async function garantirDadosDeClasses(personagem = char, doZero = false) {
  const anterior = doZero ? null : classesData;
  const mapa = anterior instanceof Map ? anterior : new Map();
  for (const c of classesDe(personagem)) {
    // `mapa.get` e nao `mapa.has`: uma entrada que ficou null (busca que
    // falhou numa abertura anterior) tem de ser tentada de novo, senao a
    // classe fica sem dados para sempre naquela sessao.
    if (!c.classe || mapa.get(c.classe)) continue;
    mapa.set(c.classe, await getClasse(c.classe));
  }
  if (mapa !== classesData) definirClassesData(mapa);
  return mapa;
}
