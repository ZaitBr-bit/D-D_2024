// ============================================================
// Resistências a dano concedidas pela espécie na criação do personagem.
// Livro do Jogador 2024 (Aasimar, Anão, Draconato, Tiferino) e
// Ravenloft: Horrors Within (Renascido, Resistência Estranha).
// ============================================================

// Herança Dracônica: dragão escolhido -> tipo de dano.
const HERANCA_DRACONICA = {
  'Azul': 'Elétrico', 'Branco': 'Gélido', 'Bronze': 'Elétrico',
  'Cobre': 'Ácido', 'Latão': 'Ígneo', 'Negro': 'Ácido',
  'Ouro': 'Ígneo', 'Prata': 'Gélido', 'Verde': 'Venenoso', 'Vermelho': 'Ígneo',
};

// Legado Ínfero: legado escolhido -> tipo de dano.
const LEGADO_INFERO = { 'Abissal': 'Venenoso', 'Ctônico': 'Necrótico', 'Infernal': 'Ígneo' };

// Resistência Estranha (Renascido): tipos que o livro permite escolher.
export const RESISTENCIA_ESTRANHA = ['Gélido', 'Necrótico', 'Venenoso'];

/**
 * Tipos de dano a que a espécie dá Resistência, considerando a escolha
 * gravada em `tracos_escolhidos` (dragão, legado ou tipo do Renascido).
 * Devolve lista vazia para espécie sem resistência ou escolha inválida.
 */
export function resistenciasDaEspecie(especie, tracosEscolhidos = []) {
  const escolha = tracosEscolhidos[0];
  switch (especie) {
    case 'Aasimar': return ['Necrótico', 'Radiante'];
    case 'Anão': return ['Venenoso'];
    case 'Draconato': return HERANCA_DRACONICA[escolha] ? [HERANCA_DRACONICA[escolha]] : [];
    case 'Tiferino': return LEGADO_INFERO[escolha] ? [LEGADO_INFERO[escolha]] : [];
    case 'Renascido': return RESISTENCIA_ESTRANHA.includes(escolha) ? [escolha] : [];
    default: return [];
  }
}
