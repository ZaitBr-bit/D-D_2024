// ============================================================
// Contexto de classe com escopo.
//
// Um contexto por classe do personagem, para os renderizadores da ficha
// deixarem de supor "uma classe so". O contexto e um objeto SIMPLES,
// passado por parametro -- nunca estado de modulo. Trocar `classeData`
// no meio de um laco de render criaria reentrancia: qualquer funcao
// chamada la dentro leria um valor que muda debaixo dela.
// ============================================================
import { char, classesData } from './estado.js';
import { classesDe } from '../regras-multiclasse.js';

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
