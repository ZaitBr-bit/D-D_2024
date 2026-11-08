// ============================================================
// Bônus concedidos pela espécie.
// Eberron: Forge of the Artificer (Warforged, Proteção Integrada e Projeto Especializado).
// ============================================================
import { INSTRUMENTOS_MUSICAIS } from './regras-cobertura.js';

/**
 * Bônus fixo de CA que a espécie concede.
 * Warforged (Proteção Integrada) soma +1; qualquer outra espécie, 0.
 */
export function bonusCADaEspecie(especie) {
  return especie === 'Warforged' ? 1 : 0;
}

/**
 * Soma a ferramenta de `personagem.ferramenta_especie` às proficiências:
 * instrumento vai para `proficiencias_instrumentos`, o resto para `proficiencias_ferramentas`.
 * Cria o array se faltar, não duplica e não faz nada sem o campo.
 */
export function aplicarFerramentaDaEspecie(personagem) {
  const ferramenta = personagem?.ferramenta_especie;
  if (!ferramenta) return;
  const campo = INSTRUMENTOS_MUSICAIS.includes(ferramenta) ? 'proficiencias_instrumentos' : 'proficiencias_ferramentas';
  if (!Array.isArray(personagem[campo])) personagem[campo] = [];
  if (!personagem[campo].includes(ferramenta)) personagem[campo].push(ferramenta);
}
