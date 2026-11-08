// Regra pura: ordenação das perícias exibidas na ficha. Sem DOM e sem ler `char`.

// Ordem padrão de exibição das perícias (a ordem fixa original da ficha).
export const ORDEM_PERICIAS_PADRAO = [
  'Percepção', 'Intuição', 'Investigação', 'Religião', 'História',
  'Prestidigitação', 'Furtividade', 'Persuasão', 'Atletismo', 'Medicina',
  'Acrobacia', 'Enganação', 'Arcanismo', 'Sobrevivência', 'Natureza',
  'Atuação', 'Intimidação', 'Lidar com Animais'
];

// Modos de ordenação oferecidos ao jogador (valor interno e rótulo).
export const MODOS_ORDEM_PERICIAS = [
  { valor: 'padrao', rotulo: 'Padrão' },
  { valor: 'atributo', rotulo: 'Atributo' },
  { valor: 'bonus', rotulo: 'Maior bônus' },
  { valor: 'alfabetica', rotulo: 'A–Z' }
];

// Ordem dos grupos de atributo no modo 'atributo'.
const ORDEM_ATRIBUTOS = ['Força', 'Destreza', 'Inteligência', 'Sabedoria', 'Carisma'];

// Posição de um índice no array; valor ausente (-1) vai para o fim.
function posicaoOuFim(lista, valor) {
  const i = lista.indexOf(valor);
  return i === -1 ? lista.length : i;
}

// Compara nomes em ordem alfabética pt-BR.
function compararNome(a, b) {
  return a.nome.localeCompare(b.nome, 'pt-BR');
}

// Devolve uma cópia da lista ordenada pelo modo; modo desconhecido usa 'padrao'.
export function ordenarPericias(lista, modo) {
  const copia = [...lista];
  switch (modo) {
    case 'atributo':
      return copia.sort((a, b) =>
        posicaoOuFim(ORDEM_ATRIBUTOS, a.atributo) - posicaoOuFim(ORDEM_ATRIBUTOS, b.atributo)
        || compararNome(a, b));
    case 'bonus':
      return copia.sort((a, b) => (b.bonus - a.bonus) || compararNome(a, b));
    case 'alfabetica':
      return copia.sort(compararNome);
    default:
      return copia.sort((a, b) =>
        posicaoOuFim(ORDEM_PERICIAS_PADRAO, a.nome) - posicaoOuFim(ORDEM_PERICIAS_PADRAO, b.nome));
  }
}
