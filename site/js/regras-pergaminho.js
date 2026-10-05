// ============================================================
// Regra pura do Pergaminho Mágico (issue #103): círculo, tabela de
// CD/ataque, nome com a magia e troca da magia depois de adicionado.
// Sem DOM: a grade de escolha mora em pergaminho-ui.js.
// ============================================================

/** CD da salvaguarda e bônus de ataque por círculo (Guia do Mestre, p. 305). */
export const TABELA_PERGAMINHO = {
  0: { cd: 13, ataque: 5 }, 1: { cd: 13, ataque: 5 }, 2: { cd: 13, ataque: 5 },
  3: { cd: 15, ataque: 7 }, 4: { cd: 15, ataque: 7 },
  5: { cd: 17, ataque: 9 }, 6: { cd: 17, ataque: 9 },
  7: { cd: 18, ataque: 10 }, 8: { cd: 18, ataque: 10 },
  9: { cd: 19, ataque: 11 },
};

const REGEX_NOME = /^Pergaminho Mágico \((?:(Truque)|(\d)º Círculo)\)/;

/** Círculo (0 = truque) de uma variante do acervo, lido do id; null se não for do Pergaminho Mágico. */
export function circuloDoPergaminho(variante) {
  const m = /^pergaminho-magico-(?:(truque)|(\d)-circulo)$/.exec(variante?.id || '');
  if (!m) return null;
  return m[1] ? 0 : Number(m[2]);
}

/**
 * Círculo de um item do inventário que é Pergaminho Mágico: `dados.pergaminho`
 * quando existe; senão o nome ("Pergaminho Mágico (3º Círculo): ..."), o que
 * cobre o pergaminho comprado antes como Equipamento. null para outros itens.
 */
export function circuloDoItemPergaminho(item) {
  const guardado = item?.dados?.pergaminho?.circulo;
  if (Number.isInteger(guardado)) return guardado;
  const m = REGEX_NOME.exec(String(item?.nome || ''));
  if (!m) return null;
  return m[1] ? 0 : Number(m[2]);
}

/** Nome do pergaminho sem a magia: o guardado em `dados.pergaminho.nome_base` ou o nome antes de ":". */
export function nomeBaseDoPergaminho(item) {
  const guardado = item?.dados?.pergaminho?.nome_base;
  if (guardado) return guardado;
  return String(item?.nome || '').split(':')[0].trim();
}

/** Nome do item: "<nomeBase>: <magia>", ou só `nomeBase` quando em branco (`magia` null). */
export function nomeDoPergaminho(nomeBase, magia) {
  return magia ? `${nomeBase}: ${magia.nome}` : nomeBase;
}

/** Entrada de `dados.magias` do pergaminho: a magia escolhida, consumida ao conjurar, com a CD/ataque da tabela do círculo. */
export function magiaDoPergaminho({ nome, circulo }) {
  return { nome, custo: 'consome', conjuracao: { ...TABELA_PERGAMINHO[circulo] }, circulo_base: circulo };
}

/**
 * Troca a magia de um pergaminho que já está no inventário (`magia` null =
 * Em branco). Recusa (false, nada muda) se o item não é pergaminho, não está
 * no inventário ou a magia é de outro círculo. Com quantidade > 1 separa UMA
 * unidade numa linha nova logo abaixo e muda só ela.
 * @param {object} personagem Ficha (lê e altera `inventario`).
 * @param {object} item Item do inventário.
 * @param {{nome: string, circulo: number} | null} magia
 * @returns {boolean}
 */
export function aplicarMagiaNoPergaminho(personagem, item, magia) {
  const circulo = circuloDoItemPergaminho(item);
  if (circulo === null) return false;
  if (magia && Number(magia.circulo) !== circulo) return false;
  const inventario = personagem?.inventario || [];
  const idx = inventario.indexOf(item);
  if (idx < 0) return false;
  const nomeBase = nomeBaseDoPergaminho(item);
  let alvo = item;
  if ((item.quantidade || 1) > 1) {
    item.quantidade -= 1;
    alvo = structuredClone(item);
    alvo.quantidade = 1;
    inventario.splice(idx + 1, 0, alvo);
  }
  alvo.nome = nomeDoPergaminho(nomeBase, magia);
  alvo.dados = { ...(alvo.dados || {}), pergaminho: { circulo, nome_base: nomeBase }, magias: magia ? [magiaDoPergaminho(magia)] : [] };
  return true;
}
