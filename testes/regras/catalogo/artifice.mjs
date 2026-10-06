// ============================================================
// Artífice (Tasha's; PDF Eberron: Forge of the Artificer, p. 10-13):
// traços e progressão transcritos do livro. Oráculo dos motores de
// artifice-classe.test.mjs; nada aqui foi copiado de dados/tasha/.
// ============================================================
export const TRACOS_ARTIFICE = {
  dadoVida: 8,
  atributoPrimario: 'Inteligência',
  salvaguardas: ['Constituição', 'Inteligência'],
  numPericias: 2,
  periciasOpcoes: ['Arcanismo', 'História', 'Investigação', 'Medicina', 'Natureza', 'Percepção', 'Prestidigitação'],
  armaduras: ['Leve', 'Média', 'Escudo'],
  armas: ['Simples'],
  atributoConjuracao: 'Inteligência',
};

// [nivel, pb, planos, itens, truques, preparadas, [espaços 1º..5º]]
const T = [
  [1, 2, 0, 0, 2, 2, [2, 0, 0, 0, 0]], [2, 2, 4, 2, 2, 3, [2, 0, 0, 0, 0]],
  [3, 2, 4, 2, 2, 4, [3, 0, 0, 0, 0]], [4, 2, 4, 2, 2, 5, [3, 0, 0, 0, 0]],
  [5, 3, 4, 2, 2, 6, [4, 2, 0, 0, 0]], [6, 3, 5, 3, 2, 6, [4, 2, 0, 0, 0]],
  [7, 3, 5, 3, 2, 7, [4, 3, 0, 0, 0]], [8, 3, 5, 3, 2, 7, [4, 3, 0, 0, 0]],
  [9, 4, 5, 3, 2, 9, [4, 3, 2, 0, 0]], [10, 4, 6, 4, 3, 9, [4, 3, 2, 0, 0]],
  [11, 4, 6, 4, 3, 10, [4, 3, 3, 0, 0]], [12, 4, 6, 4, 3, 10, [4, 3, 3, 0, 0]],
  [13, 5, 6, 4, 3, 11, [4, 3, 3, 1, 0]], [14, 5, 7, 5, 4, 11, [4, 3, 3, 1, 0]],
  [15, 5, 7, 5, 4, 12, [4, 3, 3, 2, 0]], [16, 5, 7, 5, 4, 12, [4, 3, 3, 2, 0]],
  [17, 6, 7, 5, 4, 14, [4, 3, 3, 3, 1]], [18, 6, 8, 6, 4, 14, [4, 3, 3, 3, 1]],
  [19, 6, 8, 6, 4, 15, [4, 3, 3, 3, 2]], [20, 6, 8, 6, 4, 15, [4, 3, 3, 3, 2]],
];
export const PROGRESSAO_ARTIFICE = T.map(([nivel, pb, planos, itens, truques, preparadas, espacos]) =>
  ({ nivel, pb, planos, itens, truques, preparadas, espacos }));
export const NIVEIS_ASI_ARTIFICE = [4, 8, 12, 16];
export const NIVEL_DADIVA_EPICA_ARTIFICE = 19;
export const NIVEL_SUBCLASSE_ARTIFICE = 3;
export const SUBCLASSES_ARTIFICE = ['Alquimista', 'Armeiro', 'Artilheiro', 'Cartógrafo', 'Ferreiro de Batalha'];
