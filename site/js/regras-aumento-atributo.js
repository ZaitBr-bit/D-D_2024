// ============================================================
// Aumento permanente de atributo por item (Manuais, Tomos e Livros do
// Livro do Mestre, `dados.aumento_permanente`).
//
// Diferente do bônus passivo (regras-atributos.js), aqui o valor-base da
// ficha é alterado de forma definitiva, pelo mesmo caminho dos ajustes do
// sistema (aplicarDeltaSistema). O item guarda `aumento_aplicado` e não
// aplica o aumento uma segunda vez.
// ============================================================
import { aplicarDeltaSistema } from './ficha-edicoes.js';
import { CHAVES_ATRIBUTO } from './regras-atributos.js';
import { aplicarPvRetroativoPorCon, modConEmJogo } from './levelup.js';
import { calcMod } from './utils.js';

/** Aumento permanente pendente do item (`dados.aumento_permanente`); null sem aumento, já aplicado ou com o item destruído. */
export function aumentoPermanenteDoItem(item) {
  if (item?.aumento_aplicado || item?.destruido) return null;
  return item?.dados?.aumento_permanente || null;
}

/** Valor-base atual do atributo na ficha (0 quando ausente). */
function valorBase(personagem, chave) {
  return Number(personagem?.atributos?.[chave]) || 0;
}

/**
 * Aplica o aumento permanente do item ao valor-base do personagem.
 * `atributo` escolhe o atributo quando o item declara "escolha"; `reduzir`
 * escolhe o atributo reduzido quando o item declara `reducao`. Aumento
 * limitado ao `maximo`; redução limitada ao `minimo`, nunca positiva.
 * Nada é gravado quando a validação falha. Devolve
 * { ok, erro?, aumento?: {atributo, aplicado}, reducao?: {atributo, aplicado} }.
 */
export function aplicarAumentoPermanente(personagem, item, { atributo, reduzir } = {}) {
  const aum = aumentoPermanenteDoItem(item);
  if (!aum) return { ok: false, erro: 'O item não tem aumento de atributo disponível.' };
  const alvo = aum.atributo === 'escolha' ? atributo : aum.atributo;
  if (!CHAVES_ATRIBUTO.includes(alvo)) return { ok: false, erro: 'Escolha o atributo que aumenta.' };
  const red = aum.reducao || null;
  if (red && (!CHAVES_ATRIBUTO.includes(reduzir) || reduzir === alvo)) {
    return { ok: false, erro: 'Escolha outro atributo para reduzir.' };
  }
  const valorAumento = Number(aum.valor);
  if (aum.valor == null || !Number.isFinite(valorAumento) || valorAumento <= 0) {
    return { ok: false, erro: 'O aumento do item não tem um valor válido.' };
  }
  const maximo = Number.isFinite(Number(aum.maximo)) ? Number(aum.maximo) : Infinity;
  const ganho = Math.min(valorAumento, maximo - valorBase(personagem, alvo));
  if (ganho <= 0) return { ok: false, erro: `O atributo já está no máximo (${maximo}).` };

  const modConAntes = calcMod(valorBase(personagem, 'constituicao'));
  const modJogoAntes = modConEmJogo(personagem);
  const aplicadoAumento = aplicarDeltaSistema(personagem, `atributos.${alvo}`, ganho);
  const resultado = { ok: true, aumento: { atributo: alvo, aplicado: aplicadoAumento } };
  if (red) {
    // Redução já no mínimo aplica 0 e o aumento é consumido mesmo assim (o livro limita a redução ao mínimo, não o aumento).
    const perda = Math.min(Number(red.valor) || 0, valorBase(personagem, reduzir) - (Number(red.minimo) || 0));
    const delta = perda > 0 ? -perda : 0;
    const aplicadoReducao = delta ? aplicarDeltaSistema(personagem, `atributos.${reduzir}`, delta) : 0;
    resultado.reducao = { atributo: reduzir, aplicado: aplicadoReducao };
  }
  // Mudança no modificador da Constituição-base vale +/-1 PV por nível (mesma regra da edição manual).
  // O PV atual só muda quando o modificador de Constituição em jogo muda (Amuleto da Saúde absorve o aumento).
  if (personagem.pv_max > 0) {
    aplicarPvRetroativoPorCon(personagem, modConAntes, calcMod(valorBase(personagem, 'constituicao')),
      { antes: modJogoAntes, depois: modConEmJogo(personagem) });
  }
  item.aumento_aplicado = true;
  return resultado;
}
