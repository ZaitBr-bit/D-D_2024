// Módulo `infra/character/legacy-instance-id`: deriva o `instanceId`
// determinístico atribuído, na primeira migração v1->v2, a cada entrada de
// inventário/magia/fonte/concessão que o registro legado guardava sem
// identidade própria (o v1 só tinha listas posicionais). O ID usa o índice
// no array BRUTO (antes de qualquer ordenação/filtragem) para que migrar o
// mesmo registro duas vezes produza sempre o mesmo `instanceId`, mesmo para
// duplicatas com o mesmo nome (o índice, não o nome, desambigua).

const PAD_WIDTH = 4;

/**
 * Normaliza um nome legado em um slug determinístico (minúsculo, ASCII,
 * kebab-case): remove diacríticos, troca qualquer sequência de caracteres
 * não alfanuméricos por um único hífen, e apara hífens nas pontas. Uma
 * string vazia após a normalização vira "item" (nunca um `instanceId` com
 * segmento vazio).
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  const stripped = String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return stripped.length > 0 ? stripped : 'item';
}

/**
 * Deriva o `instanceId` legado determinístico de uma entrada de uma
 * coleção plana v1 (inventário, magias conhecidas/preparadas, fontes de
 * concessão etc.), no formato
 * `legacy:<collection>:<originalIndex-padded>:<normalized-slug>`.
 * @param {{characterId?: string, collection: string, originalIndex: number, normalizedName: string}} params
 * @returns {string}
 */
export function deriveLegacyInstanceId({ characterId, collection, originalIndex, normalizedName } = {}) {
  void characterId; // O instanceId só precisa ser único dentro do próprio registro do personagem.
  if (typeof collection !== 'string' || collection.length === 0) {
    throw new TypeError('deriveLegacyInstanceId: "collection" deve ser uma string não vazia.');
  }
  if (!Number.isInteger(originalIndex) || originalIndex < 0) {
    throw new TypeError('deriveLegacyInstanceId: "originalIndex" deve ser um inteiro >= 0.');
  }
  const paddedIndex = String(originalIndex).padStart(PAD_WIDTH, '0');
  const slug = slugify(normalizedName ?? '');
  return `legacy:${collection}:${paddedIndex}:${slug}`;
}
