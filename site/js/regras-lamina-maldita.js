// ============================================================
// Regras puras da Lâmina Maldita (Bruxo, Xanathar). Sem DOM; recebe o
// personagem. Não importa utils.js.
// ============================================================
import { nivelNa, nivelTotal, subclasseDe } from './regras-multiclasse.js';
import { estaIncapacitado } from './regras-condicoes.js';
import { atributoEfetivo } from './regras-atributos.js';

export const SUBCLASSE_LAMINA_MALDITA = 'Patrono Lâmina Maldita';

/** Se o personagem é Bruxo do Patrono Lâmina Maldita de nível 3 ou mais. */
export function ehLaminaMaldita(p) {
  return subclasseDe(p, 'Bruxo') === SUBCLASSE_LAMINA_MALDITA && (nivelNa(p, 'Bruxo') || 0) >= 3;
}

/** Estado em recursos.lamina_maldita (chave própria), criado com guarda. */
export function estadoLaminaMaldita(p) {
  if (!p.recursos) p.recursos = {};
  const s = p.recursos.lamina_maldita || (p.recursos.lamina_maldita = {});
  for (const k of ['maldicao_ativa', 'maldicao_usada', 'espectro_usado', 'espectro_ativo']) {
    if (typeof s[k] !== 'boolean') s[k] = false;
  }
  return s;
}

/** Modificador de Carisma em jogo. */
function modCarisma(p) {
  return Math.floor(((atributoEfetivo(p, 'carisma') ?? 10) - 10) / 2);
}

/** Maldição valendo agora: estado ativo, patrono, não Incapacitado e com mais de 0 PV. */
export function maldicaoAtiva(p) {
  return ehLaminaMaldita(p) && !!p?.recursos?.lamina_maldita?.maldicao_ativa && !estaIncapacitado(p.condicoes || []) && (p.pv_atual ?? 1) > 0;
}

/** Bônus de dano da Maldição: proficiência do nível total; 0 sem maldição ativa. */
export function bonusDanoMaldicao(p) {
  if (!maldicaoAtiva(p)) return 0;
  return 2 + Math.floor(((nivelTotal(p) || 1) - 1) / 4);
}

/** Lança a Maldição (uma por descanso); recusa sem patrono, Incapacitado, já ativa ou uso gasto. */
export function amaldicoar(p) {
  if (!ehLaminaMaldita(p)) return { ok: false, motivo: 'Exige Patrono Lâmina Maldita de nível 3.' };
  if (estaIncapacitado(p.condicoes || [])) return { ok: false, motivo: 'Incapacitado: não é possível lançar a Maldição.' };
  const e = estadoLaminaMaldita(p);
  if (e.maldicao_ativa) return { ok: false, motivo: 'A Maldição já está ativa.' };
  if (e.maldicao_usada) return { ok: false, motivo: 'Sem uso: recupere com um Descanso Curto ou Longo.' };
  e.maldicao_usada = true;
  e.maldicao_ativa = true;
  return { ok: true };
}

/** Encerra a Maldição; o uso continua gasto. */
export function encerrarMaldicao(p) {
  estadoLaminaMaldita(p).maldicao_ativa = false;
}

/** PV recuperados quando o alvo amaldiçoado morre: nível de Bruxo + mod. Car, mínimo 1. */
export function curaAlvoMorreu(p) {
  return Math.max(1, (nivelNa(p, 'Bruxo') || 0) + modCarisma(p));
}

/** Pode passar a Maldição a outra criatura: Maldição ativa e Bruxo 14+. */
export function podePassarMaldicao(p) {
  return maldicaoAtiva(p) && (nivelNa(p, 'Bruxo') || 0) >= 14;
}

/** Alvo morreu: sem Maldição ativa nada ocorre; passar mantém sem cura; senão encerra e cura. */
export function alvoMorreu(p, passar) {
  if (!maldicaoAtiva(p)) return { cura: 0, passou: false };
  if (passar && podePassarMaldicao(p)) return { cura: 0, passou: true };
  const cura = curaAlvoMorreu(p);
  encerrarMaldicao(p);
  return { cura, passou: false };
}

/** Encerra a Maldição gravada como ativa quando Incapacitado ou com 0 PV; true se encerrou. */
export function encerrarMaldicaoSeIncapacitado(p) {
  if (!p?.recursos?.lamina_maldita?.maldicao_ativa) return false;
  if (!estaIncapacitado(p.condicoes || []) && (p.pv_atual ?? 1) > 0) return false;
  encerrarMaldicao(p);
  return true;
}

/** Armadura de Maldições disponível: Maldição ativa e Bruxo 10+. */
export function podeArmaduraMaldicoes(p) {
  return maldicaoAtiva(p) && (nivelNa(p, 'Bruxo') || 0) >= 10;
}

/** Resultado do d6 da Armadura de Maldições: 4 ou mais erra o ataque. */
export function resultadoArmaduraMaldicoes(d6) {
  return d6 >= 4 ? 'erra' : 'acerta';
}

/** Espectro Amaldiçoado disponível: patrono, Bruxo 6+ e uso não gasto. */
export function podeLevantarEspectro(p) {
  return ehLaminaMaldita(p) && (nivelNa(p, 'Bruxo') || 0) >= 6 && !p?.recursos?.lamina_maldita?.espectro_usado;
}

/** Levanta o Espectro gastando o uso; recusa sem requisito ou com uso gasto. */
export function levantarEspectro(p) {
  if (!podeLevantarEspectro(p)) return { ok: false, motivo: 'Exige Bruxo 6 do Patrono Lâmina Maldita e uso disponível.' };
  const e = estadoLaminaMaldita(p);
  e.espectro_usado = true;
  e.espectro_ativo = true;
  return { ok: true };
}

/** Dispensa o Espectro; o uso continua gasto. */
export function dispensarEspectro(p) {
  estadoLaminaMaldita(p).espectro_ativo = false;
}

/** PV temporários do Espectro: metade do nível de Bruxo, arredondado para baixo. */
export function pvTemporariosEspectro(p) {
  return Math.floor((nivelNa(p, 'Bruxo') || 0) / 2);
}

/** Bônus de ataque do Espectro: mod. Car, mínimo 0. */
export function bonusAtaqueEspectro(p) {
  return Math.max(0, modCarisma(p));
}

/** Descanso Curto: encerra a Maldição e devolve seu uso; não toca no Espectro. */
export function descansoCurtoLaminaMaldita(p) {
  if (!p?.recursos?.lamina_maldita) return;
  const e = estadoLaminaMaldita(p);
  e.maldicao_ativa = false;
  e.maldicao_usada = false;
}

/** Descanso Longo: encerra a Maldição, devolve os dois usos e dispensa o Espectro. */
export function descansoLongoLaminaMaldita(p) {
  if (!p?.recursos?.lamina_maldita) return;
  const e = estadoLaminaMaldita(p);
  e.maldicao_ativa = false;
  e.maldicao_usada = false;
  e.espectro_usado = false;
  e.espectro_ativo = false;
}
