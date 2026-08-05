// Módulo `domain/commands/rest`: comandos de descanso curto/longo. Reflete
// `tests/fixtures/expected/command-transitions.json` (categoria
// "descansos", commit e43c5ea):
//   - descanso CURTO não restaura dados de vida usados, não restaura PV, não
//     mexe em salvaguardas contra morte. Restaura apenas os recursos cujo
//     conteúdo declara `recovery: "short-rest"`.
//   - descanso LONGO restaura PV atual ao máximo, zera dados de vida usados,
//     zera salvaguardas contra morte, zera espaços de magia extras
//     concedidos (`state.spells.slots[*].extra`) e restaura os recursos cujo
//     conteúdo declara `recovery: "short-rest"` OU `"long-rest"` (um
//     descanso longo sempre inclui o benefício de um curto).
//
// ## Determinação de "quem recupera o quê" (regra do brief)
//
// A decisão de QUAIS recursos restauram em qual descanso vem SEMPRE do campo
// declarativo `resourceEffect.recovery` do conteúdo (Task 15,
// `dados/schemas/v1/effect.schema.json#/$defs/resourceEffect`), coletado via
// `collectCharacterEffects` (motor da Task 15) — nunca de comparação de nome
// de talento/classe nem de busca em texto de descrição. Isto significa que
// um recurso só é restaurado por este comando quando `context.registry`
// resolve a fonte que o concedeu E essa fonte declara `recovery` no efeito
// `resource` correspondente (fix round 1, achado I2: o pacote `dnd2024` já
// declara `recovery` em 20+ pontos — classes/*.json, species/catalog.json —
// e o talento "Dádiva do Destino" ganhou o efeito `resource`/`recovery`
// correspondente em `dados/pacotes/dnd2024/feats/catalog.json`).
//
// ## Teto de restauração (`effect.max`) — fix round 1, achado I3
//
// A restauração usa o `max` DECLARADO pelo efeito `resource` (resolvido via
// `resolveNumericValue`, que aceita inteiro literal ou nome de variável como
// `"proficiency-bonus"` via `context.variables`) como teto — nunca um `1`
// hardcoded. Um recurso PARCIALMENTE gasto (ex.: 2 de 6 usos) também é
// restaurado ao teto, não só quando `current === 0`. Quando `max` não é
// resolvível numericamente, o comando devolve erro explícito
// (`COMMAND_REST_RESOURCE_MAX_UNRESOLVED`) — nunca um teto inventado.

import { getHitPointProjection } from '../character/queries/hit-points.js';
import { collectDeclaredResourceMaxima } from '../character/queries/resources.js';
import { commandOk, commandErr, commandError } from './command-result.js';
import { applyClassRest, resolveDeclaredClassHandlers } from './class-actions.js';

const SCOPE_HP_CURRENT = 'hp.current';
const SCOPE_HP_TEMPORARY = 'hp.temporary';
const SCOPE_HIT_DICE = 'state.hitDice.used';
const SCOPE_DEATH_SAVES = 'state.deathSaves';
const SCOPE_RESOURCES = 'state.resources';
const SCOPE_SPELL_SLOTS = 'state.spells.slots';
const SCOPE_PACT_SLOTS = 'state.spells.pactSlots';

/**
 * Devolve o `pactSlots` com `used` zerado, ou `null` quando nada muda.
 *
 * ## Por que aqui, e não no handler do Bruxo
 *
 * O comentário do próprio handler já dizia que o descanso curto do Bruxo
 * "devolve os espaços de pacto (domínio de magias)" — mas a lista `rest.short`
 * dele NÃO tinha nenhuma entrada para isso, e nenhum outro ponto do domínio
 * tocava `state.spells.pactSlots.used`. Resultado: `cast-spell` incrementava e
 * ninguém decrementava. `restore-resource` não serve: espaço de pacto não é um
 * `state.resources[<ContentId>]`, é um campo próprio do canônico. O baseline
 * chama `recuperarEspacosMagiaBruxo(false)` no descanso CURTO
 * (`tests/helpers/legacy-sheet-source.js:4430`), e é essa a semântica
 * reproduzida.
 *
 * Para quem não é Bruxo o campo já é `0` e a função devolve `null` — nenhum
 * `affected` espúrio, nenhuma escrita.
 * @param {object} character - CanonicalCharacter.
 * @returns {Readonly<object>|null}
 */
function restorePactSlots(character) {
  const pactSlots = character?.state?.spells?.pactSlots;
  if (pactSlots === null || typeof pactSlots !== 'object') {
    return null;
  }
  if (!Number.isInteger(pactSlots.used) || pactSlots.used === 0) {
    return null;
  }
  return Object.freeze({ ...pactSlots, used: 0 });
}

/**
 * Coleta o `max` declarado (já resolvido a inteiro) de cada `resourceId` cujo
 * efeito `resource` declara `recovery` num dos valores de `allowedRecoveries`.
 *
 * A LEITURA é compartilhada com o ViewModel da ficha
 * (`domain/character/queries/resources.js#collectDeclaredResourceMaxima`) —
 * eram duas cópias do mesmo mecanismo até a revisão da Task 29 (achado
 * Important 6), e elas discordavam justamente no dado inválido.
 *
 * A REAÇÃO ao dado inválido continua sendo deste comando, e é deliberada:
 * restaurar até um teto desconhecido inventaria estado do jogador, então o
 * descanso RECUSA com erro explícito. (A ficha, que só exibe, mostra o recurso
 * sem teto em vez de não abrir.)
 * @param {object} character
 * @param {object} context
 * @param {ReadonlyArray<string>} allowedRecoveries
 * @returns {{ok: true, value: Map<string, number>} | {ok: false, error: object}}
 */
function collectRecoverableResourceMaxima(character, context, allowedRecoveries) {
  const declarado = collectDeclaredResourceMaxima(character, context, { recoveries: allowedRecoveries });
  if (!declarado.ok) {
    return { ok: false, error: declarado.error };
  }
  const primeiroSemTeto = declarado.value.unresolved[0];
  if (primeiroSemTeto !== undefined) {
    return {
      ok: false,
      error: commandError(
        'COMMAND_REST_RESOURCE_MAX_UNRESOLVED',
        `O "max" do recurso "${primeiroSemTeto.resourceId}" não é resolvível como inteiro >= 0; a restauração não pode inventar um teto.`,
        {
          resourceId: primeiroSemTeto.resourceId,
          declaredMax: primeiroSemTeto.declaredMax,
          sourceInstanceId: primeiroSemTeto.sourceInstanceId,
        },
      ),
    };
  }
  const maxima = new Map();
  for (const [resourceId, entrada] of declarado.value.maxima) {
    maxima.set(resourceId, entrada.maximum);
  }
  return { ok: true, value: maxima };
}

/**
 * Restaura cada entrada de `state.resources` cujo id está em `maxima` até o
 * teto declarado (mesmo quando parcialmente gasto, não só em `current === 0`),
 * preservando as demais como estão. Devolve `null` quando nada muda.
 * Erro explícito quando `entry.current` não é um inteiro (nunca tenta
 * "consertar" silenciosamente um estado corrompido).
 * @param {object} state
 * @param {Map<string, number>} maxima
 * @returns {{ok: true, value: object | null} | {ok: false, error: object}}
 */
function restoreResources(state, maxima) {
  const previous = state.resources ?? {};
  if (maxima.size === 0) {
    return { ok: true, value: null };
  }
  let changed = false;
  const next = {};
  for (const [resourceId, entry] of Object.entries(previous)) {
    if (!maxima.has(resourceId)) {
      next[resourceId] = entry;
      continue;
    }
    if (!Number.isInteger(entry?.current)) {
      return {
        ok: false,
        error: commandError(
          'COMMAND_REST_RESOURCE_STATE_INVALID',
          `O recurso "${resourceId}" tem "current" que não é um inteiro; a restauração foi recusada.`,
          { resourceId, current: entry?.current },
        ),
      };
    }
    const max = maxima.get(resourceId);
    if (entry.current < max) {
      next[resourceId] = { ...entry, current: max };
      changed = true;
    } else {
      next[resourceId] = entry;
    }
  }
  return { ok: true, value: changed ? next : null };
}

/**
 * Descanso curto: restaura apenas recursos com `recovery: "short-rest"`.
 * Nunca toca PV, dados de vida ou salvaguardas contra morte.
 * @param {object} character
 * @param {object} [params] - sem parâmetros hoje; recebido por simetria com os demais comandos.
 * @param {{registry?: object}} [context]
 * @returns {import('./command-result.js').CommandResult}
 */
/**
 * Compõe, sobre o resultado JÁ produzido pela parte canônica do descanso, o
 * `onRest` de cada handler de classe declarado pelo personagem (Task 30,
 * decisão registrada em `questions-for-review.txt` item 15).
 *
 * ## Por que dentro do MESMO comando
 *
 * `onRest(character, {kind}, context)` é gancho de CICLO DE VIDA do descanso —
 * o nome já diz isso, e é assim que a Task 20 o desenhou. Um comando
 * `class-rest` separado permitiria à interface disparar só uma das metades,
 * deixando o personagem com PV restaurado e Fúrias não recarregadas (ou o
 * contrário) sem erro nenhum. Um comando, um `CommandResult`, uma lista de
 * `affected`.
 *
 * ## Ordem: canônico primeiro, handlers depois
 *
 * A parte canônica restaura o que o CONTEÚDO declara por
 * `resourceEffect.recovery`; os handlers fazem as recargas PARCIAIS que o
 * vocabulário declarativo não expressa (o Bárbaro recupera exatamente 1 uso de
 * Fúria no descanso curto) e limpam as flags de uso. Os dois conjuntos não se
 * cruzam no catálogo atual — nenhum recurso de classe com handler (`furias`,
 * `pontos-de-foco`, `surto-de-acao`, ...) declara `recovery`, e os que
 * declaram (`spell-slot-N`) não pertencem a handler nenhum. E, mesmo se
 * cruzassem, a composição seria idempotente: `restore-resource` leva ao teto e
 * `recover-resource` é limitado ao teto, então aplicar o handler DEPOIS do
 * canônico nunca ultrapassa nem desfaz.
 *
 * ## Dependência ausente é ERRO, e só quando há o que invocar
 *
 * Personagem sem classe não tem handler de classe: não há o que compor, e nada
 * é exigido. Personagem COM classe exige `context.registry` e
 * `context.officialHandlerInvoker`; sem eles o descanso FALHA com erro nomeado,
 * em vez de pular o `onRest` em silêncio — que é como as recargas de classe
 * ficaram invisíveis até esta task.
 *
 * @param {object} character - personagem já processado pela parte canônica.
 * @param {'short'|'long'} kind
 * @param {object} context
 * @returns {import('../../core/result.js').Result} `ok({character, events, affected})`
 */
function composeClassRest(character, kind, context) {
  const declarados = resolveDeclaredClassHandlers(character, context);
  if (!declarados.ok) {
    // Só é erro quando o personagem TEM classe; `resolveDeclaredClassHandlers`
    // já devolve `ok([])` para quem não tem.
    return declarados;
  }
  if (declarados.value.length === 0) {
    return { ok: true, value: { character, events: [], affected: [] } };
  }
  return applyClassRest(character, { kind }, context);
}

/**
 * Diz se o personagem tem classe — e portanto se a composição de `onRest` é
 * exigível. Um personagem sem `build.classRef` não declara handler nenhum.
 * @param {object} character
 * @returns {boolean}
 */
function hasClass(character) {
  const reference = character?.build?.classRef;
  if (typeof reference === 'string') {
    return reference.length > 0;
  }
  return reference !== null && typeof reference === 'object' && typeof reference.id === 'string' && reference.id.length > 0;
}

export function shortRest(character, params = {}, context = {}) {
  void params;
  const maxima = collectRecoverableResourceMaxima(character, context, ['short-rest']);
  if (!maxima.ok) {
    return commandErr({ character, error: maxima.error });
  }
  const restored = restoreResources(character.state, maxima.value);
  if (!restored.ok) {
    return commandErr({ character, error: restored.error });
  }

  // Espaços de Magia de Pacto voltam no descanso CURTO (ver `restorePactSlots`).
  const pactoCurto = restorePactSlots(character);

  const canonico =
    restored.value === null && pactoCurto === null
      ? character
      : Object.freeze({
          ...character,
          state: Object.freeze({
            ...character.state,
            ...(restored.value === null ? {} : { resources: Object.freeze(restored.value) }),
            ...(pactoCurto === null ? {} : { spells: Object.freeze({ ...character.state.spells, pactSlots: pactoCurto }) }),
          }),
        });

  const daClasse = hasClass(character) ? composeClassRest(canonico, 'short', context) : { ok: true, value: { character: canonico, events: [], affected: [] } };
  if (!daClasse.ok) {
    // Meio descanso é pior que nenhum: o personagem ORIGINAL é devolvido.
    return commandErr({ character, error: daClasse.error });
  }

  const affected = new Set(restored.value === null ? [] : [SCOPE_RESOURCES]);
  if (pactoCurto !== null) {
    affected.add(SCOPE_PACT_SLOTS);
  }
  for (const path of daClasse.value.affected) {
    affected.add(path);
  }
  if (affected.size === 0) {
    return commandOk({ character, events: [], affected: [] });
  }

  return commandOk({
    character: daClasse.value.character,
    events: [{ type: 'short-rest-taken' }, ...daClasse.value.events],
    affected: [...affected],
  });
}

/**
 * Descanso longo: PV atual volta ao máximo, dados de vida usados voltam a 0,
 * salvaguardas contra morte voltam a 0, espaços de magia extras são zerados,
 * e restaura recursos com `recovery` "short-rest" OU "long-rest".
 * @param {object} character
 * @param {object} [params]
 * @param {{maximumHitPoints?: number, registry?: object}} [context]
 * @returns {import('./command-result.js').CommandResult}
 */
export function longRest(character, params = {}, context = {}) {
  void params;
  const projection = getHitPointProjection(character, context);
  if (!projection.ok) {
    return commandErr({ character, error: projection.error });
  }

  const hitPoints = character.state.hitPoints;
  const affected = [];

  const nextCurrent = projection.value.maximum;
  if (nextCurrent !== hitPoints.current) {
    affected.push(SCOPE_HP_CURRENT);
  }
  // O baseline não zera PV temporário num descanso longo nos casos
  // observados no fixture — só reflete o campo se algum dia divergir.
  const nextTemporary = hitPoints.temporary;
  if (nextTemporary !== hitPoints.temporary) {
    affected.push(SCOPE_HP_TEMPORARY);
  }

  const nextHitDiceUsed = 0;
  if (nextHitDiceUsed !== character.state.hitDice.used) {
    affected.push(SCOPE_HIT_DICE);
  }

  const deathSaves = character.state.deathSaves;
  const nextDeathSaves = { successes: 0, failures: 0 };
  if (deathSaves.successes !== 0 || deathSaves.failures !== 0) {
    affected.push(SCOPE_DEATH_SAVES);
  }

  // ESPAÇOS DE MAGIA: `used` volta a 0 e os `extra` concedidos são zerados.
  //
  // A primeira versão deste comando só zerava `extra`, e o defeito ficou
  // invisível por dois motivos que se reforçavam: o único caso de descanso
  // longo do oráculo (`descanso-longo-reseta-dados-de-vida-morte-e-pv`) tem
  // `espacos_magia: {}`, e até a Task 33 a ficha pública era o monólito. Do
  // lado do domínio a assimetria era gritante: `cast-spell` INCREMENTA
  // `slots[c].used` e nada nunca o decrementava — todo conjurador gastaria os
  // espaços uma vez e nunca mais os recuperaria. O baseline zera
  // (`tests/helpers/legacy-sheet-source.js:4628-4631`: "Restaurar espaços de
  // magia" -> `char.espacos_magia[k].usados = 0`).
  const previousSlots = character.state.spells.slots ?? {};
  let slotsChanged = false;
  const nextSlots = {};
  for (const [circle, slot] of Object.entries(previousSlots)) {
    const usedAtual = typeof slot?.used === 'number' ? slot.used : 0;
    const extraAtual = typeof slot?.extra === 'number' ? slot.extra : 0;
    if (usedAtual !== 0 || extraAtual !== 0) {
      nextSlots[circle] = { ...slot, used: 0, extra: 0 };
      slotsChanged = true;
    } else {
      nextSlots[circle] = slot;
    }
  }
  if (slotsChanged) {
    affected.push(SCOPE_SPELL_SLOTS);
  }

  // MAGIA DE PACTO: um descanso longo inclui o benefício de um curto, e é o
  // curto que devolve os espaços de pacto (ver `restorePactSlots`).
  const pactoLongo = restorePactSlots(character);
  if (pactoLongo !== null) {
    affected.push(SCOPE_PACT_SLOTS);
  }

  const maxima = collectRecoverableResourceMaxima(character, context, ['short-rest', 'long-rest']);
  if (!maxima.ok) {
    return commandErr({ character, error: maxima.error });
  }
  const restored = restoreResources(character.state, maxima.value);
  if (!restored.ok) {
    return commandErr({ character, error: restored.error });
  }
  if (restored.value !== null) {
    affected.push(SCOPE_RESOURCES);
  }

  const canonico =
    affected.length === 0
      ? character
      : Object.freeze({
          ...character,
          state: Object.freeze({
            ...character.state,
            hitPoints: Object.freeze({ current: nextCurrent, temporary: nextTemporary }),
            hitDice: Object.freeze({ used: nextHitDiceUsed }),
            deathSaves: Object.freeze(nextDeathSaves),
            spells: Object.freeze({
              ...character.state.spells,
              slots: Object.freeze(nextSlots),
              ...(pactoLongo === null ? {} : { pactSlots: pactoLongo }),
            }),
            resources: Object.freeze(restored.value ?? character.state.resources),
          }),
        });

  // O `onRest` dos handlers de classe compõe DENTRO deste comando — ver
  // `composeClassRest`. Ele roda mesmo quando a parte canônica não mudou nada
  // (um Bárbaro com PV cheio ainda recupera Fúrias num descanso longo).
  const daClasse = hasClass(character) ? composeClassRest(canonico, 'long', context) : { ok: true, value: { character: canonico, events: [], affected: [] } };
  if (!daClasse.ok) {
    return commandErr({ character, error: daClasse.error });
  }

  const todosAfetados = new Set(affected);
  for (const path of daClasse.value.affected) {
    todosAfetados.add(path);
  }
  if (todosAfetados.size === 0) {
    return commandOk({ character, events: [], affected: [] });
  }

  return commandOk({
    character: daClasse.value.character,
    events: [{ type: 'long-rest-taken' }, ...daClasse.value.events],
    affected: [...todosAfetados],
  });
}
