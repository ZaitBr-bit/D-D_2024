// ============================================================
// Tamanho usado na capacidade de carga. Glossário, "Capacidade de Carga":
// o tamanho e a Força decidem o peso máximo. Traços de espécie que fazem
// contar como um tamanho maior entram aqui (Golias, Porte Poderoso).
// ============================================================

// Do menor para o maior; "um tamanho maior" é o próximo desta lista.
const ORDEM_TAMANHOS = ['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal'];

// Espécie -> traço que a faz contar como um tamanho maior na carga.
const ESPECIES_TAMANHO_MAIOR_NA_CARGA = { 'Golias': 'Porte Poderoso' };

/**
 * Tamanho que vale para a capacidade de carga e o traço responsável.
 * Sem traço, devolve o próprio tamanho (padrão Médio) e `traco: null`;
 * Colossal ou tamanho fora da lista não sobe.
 */
export function tamanhoParaCarga(tamanho, especie) {
  const base = String(tamanho || 'Médio').trim();
  const traco = ESPECIES_TAMANHO_MAIOR_NA_CARGA[especie] || null;
  if (!traco) return { tamanho: base, traco: null };
  const i = ORDEM_TAMANHOS.indexOf(base);
  const maior = i >= 0 && i < ORDEM_TAMANHOS.length - 1 ? ORDEM_TAMANHOS[i + 1] : base;
  return { tamanho: maior, traco };
}

// Perícias do teste para escapar de Imobilizado (glossário, "Imobilizando").
const PERICIAS_ESCAPAR_IMOBILIZADO = ['Atletismo', 'Acrobacia'];

/**
 * Nota de Vantagem situacional do Porte Poderoso (Golias) para a perícia,
 * ou null. Só com a condição Imobilizado; vale só no teste de escapar, por isso não é Vantagem fixa.
 */
export function notaEscaparImobilizado(nomePericia, especie, condicoes = []) {
  if (especie !== 'Golias' || !PERICIAS_ESCAPAR_IMOBILIZADO.includes(nomePericia)) return null;
  if (!condicoes.includes('Imobilizado')) return null;
  return 'Porte Poderoso: Vantagem para encerrar a condição Imobilizado';
}
