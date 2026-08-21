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
  if (personagem?.classe === 'Monge' && (personagem?.nivel || 0) >= 14) {
    return TODAS_AS_SALVAGUARDAS;
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
