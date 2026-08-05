// Módulo `domain/character/queries/resources`: leitura ÚNICA do que o conteúdo
// declara sobre os recursos de um personagem (teto e recuperação), e a
// projeção de uso derivada dela.
//
// ## Por que isto existe (fix da revisão da Task 29, achado Important 6)
//
// A mesma leitura — coletar os efeitos do personagem, filtrar `type:
// 'resource'`, qualificar o `resourceId` pelo namespace da fonte e resolver o
// `max` — existia em DOIS lugares: em `domain/commands/rest.js` (para saber a
// que teto restaurar num descanso) e, duplicada, no ViewModel da ficha (para
// exibir "x de y"). Duas cópias do mesmo mecanismo divergiram exatamente onde
// mais importa: no dado INVÁLIDO. O comando devolvia erro estruturado quando
// `max` não resolvia; o ViewModel devolvia `maximum: null` e seguia.
//
// A leitura passa a ser uma só, com UM contrato explícito:
//
//   - `maxima`: `Map<resourceId, {maximum: number|null, recovery: string|null}>`
//     com TODOS os recursos declarados. `maximum: null` significa "o conteúdo
//     declara um `max` que não resolve para inteiro >= 0" — nunca um teto
//     inventado;
//   - `unresolved`: a lista desses mesmos ids, separada, para que quem NÃO
//     pode conviver com um teto desconhecido falhe de propósito.
//
// As duas reações continuam diferentes, mas agora são uma DECISÃO de cada
// consumidor sobre o mesmo dado, e não duas leituras que discordam:
// restaurar até um teto desconhecido inventaria estado (o descanso recusa);
// exibir um recurso sem teto conhecido não inventa nada (a ficha mostra o
// gasto atual e omite o teto). Ambas as escolhas estão documentadas no ponto
// de uso.
//
// ## `current` é USO RESTANTE, não uso gasto
//
// `state.resources[id].current` conta os usos que AINDA existem: um recurso
// nasce com `current = max` (`domain/effects/apply-grants.js`), gastar
// DECREMENTA (`domain/commands/conditions.js#useResource`) e descansar
// RESTAURA até o teto (`domain/commands/rest.js`). Por isso
// `ResourceUsageProjection.available` é o próprio `current`, e quem quiser
// "quantos já foram gastos" usa `spent`. Confundir os dois inverte a
// contagem na tela — foi o que a revisão da Task 29 pegou.

import { ok } from '../../../core/result.js';
import { collectCharacterEffects, resolveNumericValue } from '../../effects/index.js';

/**
 * Extrai o namespace (primeiro segmento) de um ContentId, ou `null`.
 * @param {*} id
 * @returns {string|null}
 */
function namespaceOf(id) {
  return typeof id === 'string' && id.length > 0 ? id.split(':')[0] : null;
}

/**
 * Coleta o `max`/`recovery` DECLARADOS pelo conteúdo para cada recurso do
 * personagem.
 *
 * Sem `context.registry` não há como resolver as fontes, e a coleta devolve
 * vazio — nunca uma tabela de recursos embutida no código.
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {object} [context] - `{registry, variables, ...}` do motor de efeitos.
 * @param {{recoveries?: ReadonlyArray<string>}} [options] - quando informado,
 *   restringe a coleta aos recursos cujo `recovery` está na lista (é o que o
 *   descanso curto/longo precisa); sem ele, todos os recursos declarados.
 * @returns {import('../../../core/result.js').Result} Result<{maxima: Map, unresolved: Array<string>}, AppError>
 */
export function collectDeclaredResourceMaxima(character, context = {}, { recoveries = null } = {}) {
  /** @type {Map<string, {maximum: number|null, recovery: string|null}>} */
  const maxima = new Map();
  /** @type {Array<{resourceId: string, declaredMax: *, sourceInstanceId: *}>} */
  const unresolved = [];

  // Sem catálogo não há fonte para resolver. `null` conta como ausente tanto
  // quanto `undefined`: a ficha injeta a porta de catálogo como `null` quando
  // ela não foi montada, e tratar só `undefined` fazia o motor de efeitos ser
  // chamado com um registry inválido e lançar `TypeError`.
  if (context === null || typeof context !== 'object' || context.registry === undefined || context.registry === null) {
    return ok({ maxima, unresolved });
  }

  const collected = collectCharacterEffects(character, context);
  if (!collected.ok) {
    return collected;
  }

  for (const entry of collected.value) {
    const effect = entry.effect;
    if (effect?.type !== 'resource' || typeof effect.resource !== 'string') {
      continue;
    }
    if (recoveries !== null && (typeof effect.recovery !== 'string' || !recoveries.includes(effect.recovery))) {
      continue;
    }
    const namespace = namespaceOf(entry.sourceId);
    if (namespace === null) {
      continue;
    }
    const resourceId = `${namespace}:resource:${effect.resource}`;
    const resolved = resolveNumericValue(effect.max, context);
    const maximum = resolved.ok && Number.isInteger(resolved.value) && resolved.value >= 0 ? resolved.value : null;
    if (maximum === null) {
      unresolved.push({ resourceId, declaredMax: effect.max, sourceInstanceId: entry.sourceInstanceId ?? null });
    }
    maxima.set(resourceId, { maximum, recovery: typeof effect.recovery === 'string' ? effect.recovery : null });
  }

  return ok({ maxima, unresolved });
}

/**
 * Projeta o uso de cada recurso: quanto ainda há, qual o teto, quanto já foi
 * gasto e como se recupera.
 *
 * A projeção cobre a UNIÃO do que está gravado em `state.resources` com o que
 * o conteúdo declara — um recurso concedido cujo estado ainda não foi
 * materializado aparece com `available: null` (e o teto conhecido) em vez de
 * sumir da tela.
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {object} [context]
 * @returns {import('../../../core/result.js').Result} Result<Record<string, ResourceUsageProjection>, AppError>
 *   ResourceUsageProjection: `{current, maximum, available, spent, recovery}`
 */
export function getResourceProjection(character, context = {}) {
  const declarado = collectDeclaredResourceMaxima(character, context);
  if (!declarado.ok) {
    return declarado;
  }
  const { maxima } = declarado.value;

  const estado = character?.state?.resources ?? {};
  /** @type {Record<string, object>} */
  const projetado = {};
  for (const resourceId of new Set([...Object.keys(estado), ...maxima.keys()])) {
    const entry = estado[resourceId];
    const current = Number.isInteger(entry?.current) ? entry.current : null;
    const { maximum = null, recovery = null } = maxima.get(resourceId) ?? {};
    projetado[resourceId] = Object.freeze({
      current,
      maximum,
      // `current` JÁ É o que resta. Não se subtrai nada dele.
      available: current === null ? null : Math.max(0, current),
      // Quanto já foi consumido, quando os dois lados são conhecidos. Um
      // `current` maior que o teto (estado herdado, teto que encolheu) não
      // vira "gasto negativo": vira 0.
      spent: current === null || maximum === null ? null : Math.max(0, maximum - current),
      recovery,
    });
  }
  return ok(projetado);
}
