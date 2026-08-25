// ============================================================
// Fonte única das salvaguardas em que um personagem é proficiente.
//
// `personagem.salvaguardas_proficientes` responde "o que foi GRAVADO":
// a dupla da classe (creator/wizard.js:442), o talento Resiliente
// (levelup.js:1641, regras-cobertura.js:557) e escolhas de subclasse
// (regras-subclasse-escolhas.js:232). Este módulo responde outra
// pergunta -- "em quais ele é proficiente AGORA" -- somando as
// características de classe que concedem proficiência sem escolha do
// jogador.
//
// O valor é DERIVADO de propósito, nunca gravado de volta: quem já está
// no nível 14 não sobe de nível outra vez, e um efeito aplicado só em
// subirDeNivel jamais alcançaria essas fichas (issue #21).
// ============================================================

// nivelNa: o nível do personagem NAQUELA classe. Este módulo não importava
// nada até o sub-projeto 3d -- era o único do app totalmente isolado.
import { nivelNa } from './regras-multiclasse.js';

/** Os seis atributos, no formato usado por char.salvaguardas_proficientes */
export const TODAS_AS_SALVAGUARDAS = ['Força', 'Destreza', 'Constituição',
                                      'Inteligência', 'Sabedoria', 'Carisma'];

/**
 * Salvaguardas concedidas por característica de classe, sem escolha do
 * jogador.
 *
 * Hoje há uma só no livro: Sobrevivente Disciplinado, do Monge --
 * "Sua disciplina física e mental lhe concede proficiência em todas as
 * salvaguardas" (Classes.md:5266). Características de nível alto são
 * implementadas uma a uma, no braço; a próxima entra aqui, e não como um
 * `if` novo dentro de cada render.
 */
function salvaguardasConcedidasPorClasse(personagem) {
  // Sobrevivente Disciplinado é característica de MONGE 14 (Classes.md:5266),
  // e o nível que manda é o de Monge -- não o total do personagem.
  // Os espelhos `personagem.classe` (a classe INICIAL) cruzados com
  // `personagem.nivel` (o TOTAL) erravam nos DOIS sentidos: um
  // Monge 10/Ladino 4 (total 14) ganhava as seis quatro níveis de Monge
  // antes da hora, e um Ladino 1/Monge 14 (total 15) perdia as seis que
  // conquistou, porque a classe inicial dele é Ladino.
  // nivelNa devolve 0 para classe ausente, e 0 >= 14 é falso -- não há
  // guarda de `temClasse` a acrescentar aqui.
  if (nivelNa(personagem, 'Monge') >= 14) {
    return TODAS_AS_SALVAGUARDAS;
  }

  // Mente Escorregadia e caracteristica de LADINO 15 (Classes.md:4284):
  // "Voce adquire proficiencia em salvaguardas de Sabedoria e Carisma".
  //
  // NAO e defeito de multiclasse -- atingia todo Ladino 15 de classe unica.
  // O app ja mostrava o TEXTO da caracteristica na ficha (via ladino.js), e a
  // grade de salvaguardas nunca marcava nada: o app se contradizia na mesma
  // tela. Achado ao converter Sobrevivente Disciplinado, que e da mesma
  // familia (concessao automatica, sem escolha do jogador).
  if (nivelNa(personagem, 'Ladino') >= 15) {
    return ['Sabedoria', 'Carisma'];
  }

  return [];
}

/**
 * Lista de salvaguardas proficientes do personagem: as gravadas na ficha
 * mais as concedidas por característica de classe, sem duplicata.
 * Devolve sempre um array novo -- o personagem não é modificado.
 */
export function salvaguardasProficientes(personagem) {
  const lista = [...(personagem?.salvaguardas_proficientes || [])];
  for (const nome of salvaguardasConcedidasPorClasse(personagem)) {
    if (!lista.includes(nome)) lista.push(nome);
  }
  return lista;
}

/**
 * Diz se o personagem é proficiente na salvaguarda de nome `nome`.
 * É o que os três renders (ficha, impressão e PDF) chamam, um atributo
 * por vez.
 */
export function ehProficienteEmSalvaguarda(personagem, nome) {
  return salvaguardasProficientes(personagem).includes(nome);
}
