// ============================================================
// Atributo efetivo: o valor que vale EM JOGO.
//
// Item que define um atributo (efeito `atributo` com `minimo`, Livro do
// Mestre) vale quando o item está equipado e sintonizado e o mínimo dele é
// maior que o valor-base da ficha ("não tem efeito se o seu valor for igual
// ou maior"). `atributo_minimo_bonus` soma ao mínimo (Martelo dos Trovões)
// até o teto próprio. `atributo_bonus` soma ao valor depois do mínimo, até o
// teto próprio, e não reduz valor que já passa do teto (Pedras Ioun). O
// valor-base continua em personagem.atributos e é o que criação, subida de
// nível e edição leem; este módulo nunca grava nele.
// ============================================================
import { efeitosAtivos } from './regras-itens-magicos.js';

export const CHAVES_ATRIBUTO = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];

/**
 * Itens do acervo (`dados.magico_id`) cujo mínimo de Força o Martelo dos
 * Trovões aumenta: Cinturão de Força do Gigante (pai e as cinco variantes) e
 * Manoplas de Poder do Ogro. Clava Grande Trovejante e Mão de Vecna fixam a
 * Força, mas o livro não manda somar o bônus a elas.
 */
export const MAGICO_IDS_BASE_DO_MARTELO = [
  'cinturao-de-forca-do-gigante',
  'cinturao-de-forca-do-gigante-das-colinas',
  'cinturao-de-forca-do-gigante-do-gelo-ou-das-pedras',
  'cinturao-de-forca-do-gigante-do-fogo',
  'cinturao-de-forca-do-gigante-das-nuvens',
  'cinturao-de-forca-do-gigante-das-tempestades',
  'manoplas-de-poder-do-ogro',
];

/** Há item ativo de MAGICO_IDS_BASE_DO_MARTELO que fixa o atributo (o bônus do Martelo só vale com ele). */
export function temBaseDoMartelo(personagem, chave) {
  return efeitosAtivos(personagem).some(ef => ef.alvo === 'atributo' && ef.atributo === chave
    && Number.isInteger(ef.minimo) && MAGICO_IDS_BASE_DO_MARTELO.includes(ef.origem_magico_id));
}

/**
 * Maior mínimo ativo de item para o atributo, com o nome do item; null sem nenhum.
 * Efeitos `atributo_minimo_bonus` ativos somam ao maior mínimo entre os itens
 * de MAGICO_IDS_BASE_DO_MARTELO, limitados ao maior teto deles; sem um desses
 * itens, o bônus não faz nada.
 */
export function fonteAtributoItem(personagem, chave) {
  let melhor = null;
  let base = null;
  const bonus = [];
  for (const ef of efeitosAtivos(personagem)) {
    if (ef.atributo !== chave) continue;
    if (ef.alvo === 'atributo_minimo_bonus' && Number.isFinite(Number(ef.valor))) bonus.push(ef);
    if (ef.alvo !== 'atributo' || !Number.isInteger(ef.minimo)) continue;
    if (!melhor || ef.minimo > melhor.minimo) melhor = { minimo: ef.minimo, origem: ef.origem };
    if (MAGICO_IDS_BASE_DO_MARTELO.includes(ef.origem_magico_id) && (!base || ef.minimo > base.minimo)) {
      base = { minimo: ef.minimo, origem: ef.origem };
    }
  }
  if (!melhor || !base || !bonus.length) return melhor;
  const soma = bonus.reduce((s, e) => s + Number(e.valor), 0);
  const teto = Math.max(...bonus.map(e => Number(e.maximo) || 0));
  const comBonus = Math.max(base.minimo, Math.min(base.minimo + soma, teto));
  return comBonus > melhor.minimo ? { minimo: comBonus, origem: base.origem } : melhor;
}

/** Aumentos passivos ativos do atributo ({valor, maximo, origem}), do menor teto para o maior. */
function aumentosPassivos(personagem, chave) {
  return efeitosAtivos(personagem)
    .filter(e => e.alvo === 'atributo_bonus' && e.atributo === chave && Number.isFinite(Number(e.valor)) && Number.isFinite(Number(e.maximo)))
    .map(e => ({ valor: Number(e.valor), maximo: Number(e.maximo), origem: e.origem }))
    .sort((a, b) => a.maximo - b.maximo);
}

/**
 * Valor em jogo com a origem do último item que o mudou, ou null quando
 * nenhum item mudou o valor-base.
 */
function valorDeItens(personagem, chave) {
  const base = Number(personagem?.atributos?.[chave]);
  let valor = base;
  let origem = null;
  let origemAumento = null;
  let soAumento = false;
  const fonte = fonteAtributoItem(personagem, chave);
  // Base ausente ou não numérico perde para o mínimo do item (comportamento anterior).
  if (fonte && !(base >= fonte.minimo)) { valor = fonte.minimo; origem = fonte.origem; }
  else soAumento = true;
  for (const aum of aumentosPassivos(personagem, chave)) {
    // Sem valor numérico, o aumento não tem a que somar.
    if (!Number.isFinite(valor) || valor >= aum.maximo) continue;
    valor = Math.min(aum.maximo, valor + aum.valor);
    origemAumento = aum.origem;
  }
  if (origem === null && origemAumento === null) return null;
  // `origem` é o item que fixa o valor; sem item fixando, é o último que aumentou (`aumento: true`).
  // `origemAumento` aparece só quando um item fixa o valor e outro ainda o aumenta.
  return {
    valor, base, origem: origem ?? origemAumento,
    ...(soAumento ? { aumento: true } : {}),
    ...(origem !== null && origemAumento !== null ? { origemAumento } : {}),
  };
}

/** Valor do atributo em jogo: o base, o mínimo de item ativo e os aumentos passivos até o teto. */
export function atributoEfetivo(personagem, chave) {
  const mudou = valorDeItens(personagem, chave);
  return mudou ? mudou.valor : personagem?.atributos?.[chave];
}

/** Os seis atributos em jogo, sem tocar em personagem.atributos. */
export function atributosEfetivos(personagem) {
  return Object.fromEntries(CHAVES_ATRIBUTO.map(k => [k, atributoEfetivo(personagem, k)]));
}

/**
 * Textos da marca do atributo mudado por item (resultado de atributoDefinidoPorItem):
 * `titulo` (dica) e `rotulo` (texto visível). O valor-base só aparece quando é numérico.
 * "Definido por <item>" quando um item fixa o valor, "Aumentado por <item>" quando só aumenta,
 * e os dois quando um item fixa e outro aumenta.
 */
export function textosAtributoPorItem(porItem) {
  let titulo = porItem.aumento ? `Aumentado por ${porItem.origem}` : `Definido por ${porItem.origem}`;
  if (porItem.origemAumento) titulo += ` e aumentado por ${porItem.origemAumento}`;
  const temBase = Number.isFinite(porItem.base);
  return { titulo: temBase ? `${titulo}; valor-base ${porItem.base}` : titulo, rotulo: temBase ? `base ${porItem.base}` : '' };
}

/** Quando um item muda o atributo (mínimo ou aumento): {valor, base, origem}; senão null. */
export function atributoDefinidoPorItem(personagem, chave) {
  return valorDeItens(personagem, chave);
}
