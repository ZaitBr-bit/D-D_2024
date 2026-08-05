// Módulo `domain/rulesets/dnd2024/handlers/class-handler`: a FÁBRICA comum
// dos handlers de classe do ruleset dnd2024 (Tasks 20/21/22).
//
// ## Contrato (verbatim do brief da Task 20 — nenhuma tarefa reinterpreta)
//
//   {
//     id: string,
//     project(character, context): Result<HandlerProjection, AppError>,
//     contributeEffects(character, context): Result<ReadonlyArray<Effect>, AppError>,
//     execute(character, { actionId, payload }, context): CommandResult,
//     onRest(character, { kind: "short" | "long" }, context): CommandResult
//   }
//
// `kind` é SEMPRE a string inglesa `"short"`/`"long"` — nunca `"curto"`,
// `"longo"` nem `"descanso-curto"`.
//
// ## Propriedade por proveniência de `state.resources`/`state.usageFlags`
//
// Os dois mapas são COMPARTILHADOS por proveniência (classe, subclasse,
// espécie, antecedente, talento, item), não por classe. Um handler só pode
// ler/escrever as chaves que pertencem à SUA proveniência:
//
//   - `state.resources[id]`: pertence ao handler quando `id` é um dos
//     recursos declarados na configuração DELE **e** a entrada existente tem
//     `sourceInstanceId` igual ao `sourceInstanceId` determinístico da fonte
//     que a concede (`deriveSourceInstanceId({collection:'class'|'subclass',
//     index:0, key:<contentId>})`, Task 15). Uma entrada com o mesmo id de
//     recurso mas `sourceInstanceId` de OUTRA fonte NUNCA é sobrescrita: o
//     handler devolve `HANDLER_RESOURCE_FOREIGN_PROVENANCE` e não muda nada.
//   - `state.usageFlags[chave]`: `usageFlags` é um mapa aberto
//     (`nonEmptyString -> qualquer coisa`) e, ao contrário de
//     `resourceState`, NÃO tem campo `sourceInstanceId` no schema canônico
//     v2. A proveniência é então carregada pela PRÓPRIA CHAVE, no formato
//     `"<sourceInstanceId>:<slug-da-flag>"`. Chaves fora desse formato (ex.:
//     as de `talentos_flags` migradas por `infra/character/migrations/v1-to-v2.js`,
//     que são nomes crus como `versatil_escolhido`) nunca colidem e nunca são
//     tocadas. Isto é uma DECISÃO deste módulo por falta de vocabulário
//     declarativo de proveniência em `usageFlags` — está registrada como
//     concern no relatório da Task 20, não como fato consumado.
//
// Nenhum handler substitui o mapa inteiro: toda escrita parte do mapa
// anterior e reescreve APENAS as chaves próprias, preservando as demais por
// REFERÊNCIA (o teste de isolamento compara identidade, não só igualdade).
//
// ## Recurso ausente em `project`
//
// Personagem migrado que não tem entrada para um recurso que a classe
// concede projeta `{ current: null, missing: true }`. O handler NUNCA infere
// um valor plausível (nem "máximo = descansado", nem "zero = nunca usado").
// Só comandos de progressão/migração materializam o valor inicial. Pela
// mesma razão, `execute`/`onRest` sobre um recurso ausente FALHAM com
// `HANDLER_RESOURCE_NOT_INITIALIZED` em vez de criar a entrada.
//
// ## Por que existe código aqui em vez de só dados
//
// O vocabulário declarativo (`resourceEffect.recovery`) só sabe dizer
// "restaura ao máximo em descanso curto/longo". As quatro classes marciais
// têm recargas PARCIAIS ("Bárbaro recupera 1 uso de Fúria no descanso
// curto", `site/js/pages/sheet.js:4357`) e ações que combinam gasto de
// recurso com flag de uso — fora do vocabulário. Os máximos, os degraus de
// nível e todo texto de apresentação continuam NOS DADOS
// (`dados/pacotes/dnd2024/classes/*.json`); aqui fica só o algoritmo.
//
// A Task 21 (Clérigo, Druida, Guardião, Paladino) reutiliza esta mesma
// fábrica sem fork: os quatro handlers divinos/primitivos são configuração,
// não código novo. A ÚNICA extensão que a Task 21 precisou foi
// `action.recoverResource` (recarga parcial disparada por AÇÃO, e não por
// descanso — Arquidruida do Druida, `sheet.js:6229-6243`), que herda
// literalmente a disciplina de falha de `restoreResource`.
//
// O que NÃO entra aqui, por decisão do brief da Task 21: conjuração. Gasto de
// espaço de magia, magia sempre preparada e concentração são do domínio de
// magias (`site/js/domain/spells/*`, Task 18). Nenhum destes handlers lê ou
// escreve `state.spellSlots`/`state.concentration`, e nenhum recurso
// `spell-slot-N`/`magias-preparadas`/`truques` é declarado na configuração
// deles — ainda que as entidades de classe declarem esses recursos, eles
// pertencem ao domínio de magias, não ao handler de classe.

import { ok, err } from '../../../../core/result.js';
import { createAppError } from '../../../../core/errors.js';
import {
  collectCharacterEffects,
  filterByStackKey,
  deriveSourceInstanceId,
  resolveNumericValue,
} from '../../../effects/index.js';
import { commandOk, commandErr } from '../../../commands/command-result.js';

const SCOPE = 'domain.rulesets.dnd2024.handlers';

// Os dois únicos literais aceitos por `onRest({kind})`.
export const REST_KINDS = Object.freeze(['short', 'long']);

// Operações expostas pelo adapter de `OfficialHandlerRegistry`
// (`register-martial-handlers.js`), uma por método do contrato.
export const HANDLER_OPERATIONS = Object.freeze(['project', 'contribute-effects', 'execute', 'rest']);

// Coleções de fonte que um handler de classe pode possuir.
const OWNER_COLLECTIONS = Object.freeze(['class', 'subclass']);

const PATH_RESOURCES = 'state.resources';
const PATH_USAGE_FLAGS = 'state.usageFlags';

/**
 * Cria um AppError deste escopo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
export function handlerError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Extrai o `id` de um ContentRef (`{id, packageVersion}`) ou de um ContentId
 * cru, devolvendo `null` quando a referência é ausente/malformada.
 * @param {*} reference
 * @returns {string | null}
 */
function refId(reference) {
  if (typeof reference === 'string' && reference.length > 0) {
    return reference;
  }
  if (reference !== null && typeof reference === 'object' && typeof reference.id === 'string') {
    return reference.id;
  }
  return null;
}

/**
 * Devolve o namespace (primeiro segmento) de um ContentId, ou `null`.
 * @param {*} id
 * @returns {string | null}
 */
function namespaceOf(id) {
  return typeof id === 'string' && id.includes(':') ? id.split(':')[0] : null;
}

/**
 * Monta o ContentId de um recurso a partir do namespace da classe e do slug
 * declarado no efeito `resource` do conteúdo. Mesma fórmula de
 * `domain/commands/rest.js` (`<ns>:resource:<slug>`), para que os dois
 * caminhos apontem para a MESMA chave de `state.resources`.
 * @param {string} namespace
 * @param {string} slug
 * @returns {string}
 */
export function resourceContentId(namespace, slug) {
  return `${namespace}:resource:${slug}`;
}

/**
 * Monta a chave de `state.usageFlags` de uma flag possuída por uma fonte.
 * Ver comentário de topo: a proveniência de `usageFlags` mora na chave
 * porque o schema canônico v2 não tem campo para ela.
 * @param {string} sourceInstanceId
 * @param {string} flagSlug
 * @returns {string}
 */
export function usageFlagKey(sourceInstanceId, flagSlug) {
  return `${sourceInstanceId}:${flagSlug}`;
}

/**
 * Valida (e congela) a configuração de um handler de classe. Configuração
 * malformada é defeito de programação de quem escreve o handler, não dado de
 * conteúdo — por isso lança em vez de devolver Result.
 * @param {object} config
 * @returns {Readonly<object>}
 */
function requireConfig(config) {
  if (config === null || typeof config !== 'object') {
    throw new TypeError('createClassHandler: a configuração deve ser um objeto.');
  }
  const { id, classId, resources = [], flags = [], actions = [], rest = {} } = config;
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new TypeError('createClassHandler: "id" deve ser um slug ASCII minúsculo.');
  }
  if (typeof classId !== 'string' || namespaceOf(classId) === null) {
    throw new TypeError('createClassHandler: "classId" deve ser um ContentId qualificado.');
  }
  // `label` (correção I3 da revisão final): rótulo de EXIBIÇÃO em pt-BR de um
  // recurso/ação, vindo do vocabulário do monólito congelado
  // (`tests/helpers/legacy-sheet-source.js`) — nunca inventado pela vista.
  // Quando presente, deve ser uma string não vazia; a projeção o repassa como
  // `label` (ou `null`, sinalizando à seção que só existe o slug).
  const requireOptionalLabel = (entry, kind) => {
    if (entry.label !== undefined && (typeof entry.label !== 'string' || entry.label.length === 0)) {
      throw new TypeError(`createClassHandler(${id}): "label" de ${kind} deve ser uma string não vazia quando declarado.`);
    }
  };
  for (const resource of resources) {
    if (typeof resource?.key !== 'string' || !OWNER_COLLECTIONS.includes(resource?.owner)) {
      throw new TypeError(`createClassHandler(${id}): recurso deve ser {key, owner: 'class'|'subclass'}.`);
    }
    if (resource.owner === 'subclass' && typeof resource.ownerId !== 'string') {
      throw new TypeError(`createClassHandler(${id}): recurso de subclasse exige "ownerId".`);
    }
    requireOptionalLabel(resource, `recurso "${resource.key}"`);
  }
  for (const flag of flags) {
    if (typeof flag?.key !== 'string' || !OWNER_COLLECTIONS.includes(flag?.owner)) {
      throw new TypeError(`createClassHandler(${id}): flag deve ser {key, owner: 'class'|'subclass'}.`);
    }
  }
  for (const action of actions) {
    if (typeof action?.id !== 'string') {
      throw new TypeError(`createClassHandler(${id}): toda ação precisa de "id".`);
    }
    requireOptionalLabel(action, `ação "${action.id}"`);
    if (action.recoverResource !== undefined) {
      const recover = action.recoverResource;
      // Task 22a: `amount` aceita, além do inteiro >= 1, um NOME DE VARIÁVEL
      // (string) resolvido por `resolveNumericValue` contra
      // `context.variables` — a Restauração Feiticeira recupera
      // `floor(nível / 2)` pontos (`site/js/pages/sheet.js:5676`), quantidade
      // que depende do personagem e não cabe num literal.
      const amountOk =
        (Number.isInteger(recover.amount) && recover.amount >= 1) ||
        (typeof recover.amount === 'string' && recover.amount.length > 0);
      if (recover === null || typeof recover !== 'object' || typeof recover.resource !== 'string' || !amountOk) {
        throw new TypeError(
          `createClassHandler(${id}): "recoverResource" da ação "${action.id}" deve ser {resource, amount: inteiro >= 1 | nome de variável}.`,
        );
      }
    }
  }
  for (const kind of REST_KINDS) {
    if (rest[kind] !== undefined && !Array.isArray(rest[kind])) {
      throw new TypeError(`createClassHandler(${id}): rest.${kind} deve ser um array de operações.`);
    }
  }
  return Object.freeze({
    id,
    classId,
    resources: Object.freeze(resources.map((r) => Object.freeze({ ...r }))),
    flags: Object.freeze(flags.map((f) => Object.freeze({ ...f }))),
    actions: Object.freeze(actions.map((a) => Object.freeze({ ...a }))),
    rest: Object.freeze({
      short: Object.freeze([...(rest.short ?? [])].map((o) => Object.freeze({ ...o }))),
      long: Object.freeze([...(rest.long ?? [])].map((o) => Object.freeze({ ...o }))),
    }),
  });
}

/**
 * Cria um handler de classe a partir de uma configuração declarativa.
 *
 * @param {object} config - ver comentário de `requireConfig`.
 * @returns {Readonly<{id: string, classId: string, project: Function,
 *   contributeEffects: Function, execute: Function, onRest: Function}>}
 */
export function createClassHandler(config) {
  const spec = requireConfig(config);
  const namespace = namespaceOf(spec.classId);

  // -- Proveniência ---------------------------------------------------------

  /**
   * Deriva o `sourceInstanceId` da fonte `owner` para este personagem.
   * Devolve `null` quando o personagem não tem a referência correspondente
   * (ex.: subclasse ainda não escolhida) — ausência não é erro, só significa
   * "esta fatia não existe neste personagem".
   * @param {object} character
   * @param {'class' | 'subclass'} owner
   * @returns {string | null}
   */
  function ownerInstanceId(character, owner) {
    const reference = owner === 'class' ? character?.build?.classRef : character?.build?.subclassRef;
    const id = refId(reference);
    return id === null ? null : deriveSourceInstanceId({ collection: owner, index: 0, key: id });
  }

  /**
   * Diz se o personagem tem a subclasse exigida por um recurso/ação/operação
   * de descanso (`undefined` = sem exigência).
   * @param {object} character
   * @param {string | undefined} requiredSubclassId
   * @returns {boolean}
   */
  function matchesSubclass(character, requiredSubclassId) {
    if (requiredSubclassId === undefined) {
      return true;
    }
    return refId(character?.build?.subclassRef) === requiredSubclassId;
  }

  /**
   * Diz se o personagem é da classe deste handler.
   * @param {object} character
   * @returns {boolean}
   */
  function matchesClass(character) {
    return refId(character?.build?.classRef) === spec.classId;
  }

  /**
   * Recursos declarados que estão ATIVOS para este personagem (a subclasse
   * exigida, quando houver, é a escolhida). Cada entrada já traz o ContentId
   * do recurso e o `sourceInstanceId` da fonte dona.
   * @param {object} character
   * @returns {Array<{key: string, resourceId: string, owner: string, sourceInstanceId: string}>}
   */
  function activeResources(character) {
    const out = [];
    for (const resource of spec.resources) {
      if (!matchesSubclass(character, resource.owner === 'subclass' ? resource.ownerId : undefined)) {
        continue;
      }
      const sourceInstanceId = ownerInstanceId(character, resource.owner);
      if (sourceInstanceId === null) {
        continue;
      }
      out.push({
        key: resource.key,
        resourceId: resourceContentId(namespace, resource.key),
        owner: resource.owner,
        sourceInstanceId,
        // Rótulo de exibição declarado (correção I3); `null` quando não há.
        label: typeof resource.label === 'string' ? resource.label : null,
      });
    }
    return out;
  }

  /**
   * Flags declaradas ativas para este personagem, com a chave já namespaceada
   * pela proveniência.
   * @param {object} character
   * @returns {Array<{key: string, flagKey: string, sourceInstanceId: string}>}
   */
  function activeFlags(character) {
    const out = [];
    for (const flag of spec.flags) {
      if (!matchesSubclass(character, flag.owner === 'subclass' ? flag.ownerId : undefined)) {
        continue;
      }
      const sourceInstanceId = ownerInstanceId(character, flag.owner);
      if (sourceInstanceId === null) {
        continue;
      }
      out.push({ key: flag.key, flagKey: usageFlagKey(sourceInstanceId, flag.key), sourceInstanceId });
    }
    return out;
  }

  // -- Máximos vindos do CONTEÚDO ------------------------------------------

  /**
   * Coleta, via motor de efeitos da Task 15, o `max` declarado de cada
   * recurso deste handler. NUNCA usa tabela embutida: se o conteúdo não
   * declara o recurso naquele nível, ele simplesmente não aparece no mapa
   * (e o `project` o reporta como não concedido).
   *
   * Exige `context.registry`: sem catálogo não há como saber o máximo, e
   * devolver "sem recurso nenhum" seria um bypass silencioso de dependência
   * ausente (padrão de bug já pego nas Tasks 15/17).
   *
   * @param {object} character
   * @param {object} context
   * @returns {{ok: true, value: Map<string, {max: number, sourceInstanceId: string}>} | {ok: false, error: object}}
   */
  function collectResourceMaxima(character, context) {
    if (context === null || typeof context !== 'object' || context.registry === undefined) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_REGISTRY_REQUIRED',
          `O handler "${spec.id}" exige "context.registry" para resolver os máximos declarados no conteúdo.`,
          { handlerId: spec.id },
        ),
      };
    }
    const collected = collectCharacterEffects(character, context);
    if (!collected.ok) {
      return { ok: false, error: collected.error };
    }
    const owned = new Map(activeResources(character).map((r) => [`${r.sourceInstanceId} ${r.key}`, r]));
    const maxima = new Map();
    for (const entry of filterByStackKey(collected.value)) {
      const effect = entry.effect;
      if (effect?.type !== 'resource') {
        continue;
      }
      const match = owned.get(`${entry.sourceInstanceId} ${effect.resource}`);
      if (match === undefined) {
        continue;
      }
      const resolved = resolveNumericValue(effect.max, context);
      if (!resolved.ok || !Number.isInteger(resolved.value) || resolved.value < 0) {
        return {
          ok: false,
          error: handlerError(
            'HANDLER_RESOURCE_MAX_UNRESOLVED',
            `O "max" do recurso "${match.resourceId}" não é resolvível como inteiro >= 0; o handler não inventa um teto.`,
            { handlerId: spec.id, resourceId: match.resourceId, declaredMax: effect.max },
          ),
        };
      }
      maxima.set(match.resourceId, { max: resolved.value, sourceInstanceId: entry.sourceInstanceId });
    }
    return { ok: true, value: maxima };
  }

  // -- Leitura/escrita respeitando proveniência ----------------------------

  /**
   * Lê a entrada de `state.resources` de um recurso deste handler.
   * Devolve `{missing: true}` quando não existe (nunca inventa valor) e
   * `{foreign: true}` quando existe mas pertence a outra proveniência.
   * @param {object} character
   * @param {string} resourceId
   * @param {string} sourceInstanceId
   * @returns {{missing: true} | {foreign: true, sourceInstanceId: *} | {entry: object}}
   */
  function readOwnedResource(character, resourceId, sourceInstanceId) {
    const map = character?.state?.resources ?? {};
    if (!Object.hasOwn(map, resourceId)) {
      return { missing: true };
    }
    const entry = map[resourceId];
    // `sourceInstanceId` ausente/null numa entrada migrada NÃO é tratado como
    // "é minha": a migração v1->v2 só materializa proveniência para recursos
    // de talento, e adivinhar dono é exatamente o padrão de bug que este
    // módulo evita. Uma entrada sem dono é reportada como alheia.
    if (entry?.sourceInstanceId !== sourceInstanceId) {
      return { foreign: true, sourceInstanceId: entry?.sourceInstanceId ?? null };
    }
    return { entry };
  }

  /**
   * Aplica um conjunto de escritas de recurso/flag ao personagem,
   * PRESERVANDO por referência toda chave que não pertence a este handler.
   * @param {object} character
   * @param {Map<string, object>} resourceWrites - resourceId -> nova entrada
   * @param {Map<string, *>} flagWrites - chave namespaceada -> novo valor
   * @returns {{character: object, affected: Array<string>}}
   */
  function applyWrites(character, resourceWrites, flagWrites) {
    const affected = [];
    const state = character.state;
    let nextState = state;

    if (resourceWrites.size > 0) {
      const previous = state.resources ?? {};
      const next = { ...previous };
      let changed = false;
      for (const [resourceId, entry] of resourceWrites) {
        const before = previous[resourceId];
        if (before !== undefined && before.current === entry.current && before.sourceInstanceId === entry.sourceInstanceId) {
          continue;
        }
        next[resourceId] = Object.freeze(entry);
        changed = true;
      }
      if (changed) {
        nextState = { ...nextState, resources: Object.freeze(next) };
        affected.push(PATH_RESOURCES);
      }
    }

    if (flagWrites.size > 0) {
      const previous = state.usageFlags ?? {};
      const next = { ...previous };
      let changed = false;
      for (const [key, value] of flagWrites) {
        if (Object.hasOwn(previous, key) && previous[key] === value) {
          continue;
        }
        next[key] = value;
        changed = true;
      }
      if (changed) {
        nextState = { ...nextState, usageFlags: Object.freeze(next) };
        affected.push(PATH_USAGE_FLAGS);
      }
    }

    if (affected.length === 0) {
      return { character, affected };
    }
    return { character: Object.freeze({ ...character, state: Object.freeze(nextState) }), affected };
  }

  // -- project --------------------------------------------------------------

  /**
   * Projeta o estado observável deste handler: nível, subclasse, recursos
   * (com `{current, max, missing}`), flags e disponibilidade de cada ação.
   * NUNCA cria estado ausente — `project` é puramente de leitura.
   * @param {object} character
   * @param {object} [context]
   * @returns {import('../../../../core/result.js').Result}
   */
  function project(character, context = {}) {
    if (!matchesClass(character)) {
      return err(
        handlerError('HANDLER_CLASS_MISMATCH', `O handler "${spec.id}" só projeta personagens de "${spec.classId}".`, {
          handlerId: spec.id,
          expectedClassId: spec.classId,
          actualClassId: refId(character?.build?.classRef),
        }),
      );
    }
    const maxima = collectResourceMaxima(character, context);
    if (!maxima.ok) {
      return err(maxima.error);
    }

    const level = Number.isInteger(context?.level) ? context.level : character?.state?.level;
    const subclassId = refId(character?.build?.subclassRef);

    const resources = {};
    for (const resource of activeResources(character)) {
      const declared = maxima.value.get(resource.resourceId);
      if (declared === undefined) {
        // O conteúdo não concede este recurso neste nível: não é "faltando",
        // é "não concedido". Não entra na projeção.
        continue;
      }
      const read = readOwnedResource(character, resource.resourceId, resource.sourceInstanceId);
      if ('missing' in read) {
        resources[resource.resourceId] = Object.freeze({
          current: null,
          missing: true,
          max: declared.max,
          sourceInstanceId: resource.sourceInstanceId,
          label: resource.label,
        });
        continue;
      }
      if ('foreign' in read) {
        resources[resource.resourceId] = Object.freeze({
          current: null,
          missing: true,
          foreign: true,
          max: declared.max,
          sourceInstanceId: resource.sourceInstanceId,
          label: resource.label,
        });
        continue;
      }
      resources[resource.resourceId] = Object.freeze({
        current: read.entry.current,
        missing: false,
        max: declared.max,
        sourceInstanceId: resource.sourceInstanceId,
        label: resource.label,
      });
    }

    const flags = {};
    for (const flag of activeFlags(character)) {
      const map = character?.state?.usageFlags ?? {};
      flags[flag.flagKey] = Object.hasOwn(map, flag.flagKey) ? map[flag.flagKey] === true : false;
    }

    const actions = spec.actions.map((action) => {
      const availability = describeAvailability(character, action, resources, flags, level, subclassId);
      return Object.freeze({
        actionId: action.id,
        // Rótulo de exibição (correção I3): `null` quando o handler não o
        // declara — a seção então humaniza o slug COM sinalização, nunca em
        // silêncio.
        label: typeof action.label === 'string' ? action.label : null,
        available: availability.available,
        reason: availability.reason,
      });
    });

    return ok(
      Object.freeze({
        handlerId: spec.id,
        classId: spec.classId,
        subclassId,
        level,
        resources: Object.freeze(resources),
        flags: Object.freeze(flags),
        actions: Object.freeze(actions),
      }),
    );
  }

  /**
   * Calcula, para a projeção, se uma ação está disponível e (quando não) por
   * quê. Usa exatamente as mesmas condições de `execute`, para que a UI nunca
   * ofereça um botão que o comando recusaria.
   * @param {object} character
   * @param {object} action
   * @param {object} resources - fatia já projetada
   * @param {object} flags
   * @param {number} level
   * @param {string | null} subclassId
   * @returns {{available: boolean, reason: string | null}}
   */
  function describeAvailability(character, action, resources, flags, level, subclassId) {
    if (action.subclassId !== undefined && action.subclassId !== subclassId) {
      return { available: false, reason: 'HANDLER_ACTION_SUBCLASS_REQUIRED' };
    }
    if (Number.isInteger(action.minLevel) && !(Number.isInteger(level) && level >= action.minLevel)) {
      return { available: false, reason: 'HANDLER_ACTION_LEVEL_TOO_LOW' };
    }
    if (action.requireFlag !== undefined) {
      const sourceInstanceId = ownerInstanceId(character, action.requireFlag.owner ?? 'class');
      const key = sourceInstanceId === null ? null : usageFlagKey(sourceInstanceId, action.requireFlag.key);
      const current = key !== null && Object.hasOwn(flags, key) ? flags[key] === true : false;
      if (current !== action.requireFlag.value) {
        return { available: false, reason: 'HANDLER_ACTION_FLAG_STATE_INVALID' };
      }
    }
    if (action.spend !== undefined) {
      const resourceId = resourceContentId(namespace, action.spend.resource);
      const projected = resources[resourceId];
      if (projected === undefined) {
        return { available: false, reason: 'HANDLER_RESOURCE_NOT_GRANTED' };
      }
      if (projected.missing === true) {
        return { available: false, reason: 'HANDLER_RESOURCE_NOT_INITIALIZED' };
      }
      if (projected.current < action.spend.amount) {
        return { available: false, reason: 'HANDLER_RESOURCE_INSUFFICIENT' };
      }
    }
    // Uma ação que RESTAURA um recurso (Metabolismo Incomum, Fúria
    // Persistente) é tão indisponível quanto uma que gasta, quando o recurso
    // não é concedido no nível atual ou não tem valor materializado: deixá-la
    // "disponível" faria a UI oferecer um botão que queima um uso único de
    // descanso longo sem restaurar nada.
    if (action.restoreResource !== undefined) {
      const resourceId = resourceContentId(namespace, action.restoreResource);
      const projected = resources[resourceId];
      if (projected === undefined) {
        return { available: false, reason: 'HANDLER_RESOURCE_NOT_GRANTED' };
      }
      if (projected.missing === true) {
        return { available: false, reason: 'HANDLER_RESOURCE_NOT_INITIALIZED' };
      }
    }
    // `recoverResource` (Task 21, Arquidruida do Druida): recarga PARCIAL de
    // um recurso próprio. Mesma disciplina de `restoreResource` — recurso não
    // concedido/não materializado torna a ação indisponível em vez de
    // "disponível e sem efeito" — mais a condição `requireExhausted`, que o
    // baseline verifica antes de deixar o botão agir.
    if (action.recoverResource !== undefined) {
      const resourceId = resourceContentId(namespace, action.recoverResource.resource);
      const projected = resources[resourceId];
      if (projected === undefined) {
        return { available: false, reason: 'HANDLER_RESOURCE_NOT_GRANTED' };
      }
      if (projected.missing === true) {
        return { available: false, reason: 'HANDLER_RESOURCE_NOT_INITIALIZED' };
      }
      if (action.recoverResource.requireExhausted === true && projected.current !== 0) {
        return { available: false, reason: 'HANDLER_RESOURCE_NOT_EXHAUSTED' };
      }
      if (projected.current >= projected.max) {
        return { available: false, reason: 'HANDLER_RESOURCE_ALREADY_FULL' };
      }
    }
    return { available: true, reason: null };
  }

  // -- contributeEffects ----------------------------------------------------

  /**
   * Efeitos SINTÉTICOS deste handler. As quatro classes marciais declaram
   * toda a sua superfície derivada (recursos, proficiências, degraus de
   * nível) no próprio conteúdo — por isso a lista é vazia por construção, e
   * não por omissão. Devolver efeitos aqui recriaria, em código, dados que
   * `dados/pacotes/dnd2024/classes/*.json` já expressa.
   *
   * Também é aqui que se cumpre a regra "project/contributeEffects não criam
   * estado ausente": este método não lê nem escreve `state.*`.
   * @param {object} character
   * @param {object} [context]
   * @returns {import('../../../../core/result.js').Result}
   */
  function contributeEffects(character, context = {}) {
    void context;
    if (!matchesClass(character)) {
      return err(
        handlerError(
          'HANDLER_CLASS_MISMATCH',
          `O handler "${spec.id}" só contribui efeitos para personagens de "${spec.classId}".`,
          { handlerId: spec.id, expectedClassId: spec.classId, actualClassId: refId(character?.build?.classRef) },
        ),
      );
    }
    return ok(Object.freeze([]));
  }

  // -- execute --------------------------------------------------------------

  /**
   * Executa uma ação do handler. Valida, em ordem: forma do comando, classe,
   * ação conhecida, subclasse exigida, nível mínimo, estado de flag exigido,
   * proveniência do recurso, recurso inicializado e recurso suficiente.
   * @param {object} character
   * @param {{actionId: string, payload?: object}} command
   * @param {object} [context]
   * @returns {import('../../../commands/command-result.js').CommandResult}
   */
  function execute(character, command, context = {}) {
    if (command === null || typeof command !== 'object' || Array.isArray(command)) {
      return commandErr({
        character,
        error: handlerError('HANDLER_COMMAND_INVALID', 'A execução exige um comando {actionId, payload}.', {
          handlerId: spec.id,
        }),
      });
    }
    const { actionId, payload } = command;
    if (typeof actionId !== 'string' || actionId.length === 0) {
      return commandErr({
        character,
        error: handlerError('HANDLER_ACTION_ID_INVALID', 'A execução exige "actionId" como string não vazia.', {
          handlerId: spec.id,
        }),
      });
    }
    if (payload !== undefined && (payload === null || typeof payload !== 'object' || Array.isArray(payload))) {
      return commandErr({
        character,
        error: handlerError('HANDLER_PAYLOAD_INVALID', `O "payload" de "${actionId}" deve ser um objeto.`, {
          handlerId: spec.id,
          actionId,
        }),
      });
    }
    if (!matchesClass(character)) {
      return commandErr({
        character,
        error: handlerError('HANDLER_CLASS_MISMATCH', `O handler "${spec.id}" só executa em "${spec.classId}".`, {
          handlerId: spec.id,
          expectedClassId: spec.classId,
          actualClassId: refId(character?.build?.classRef),
        }),
      });
    }

    const action = spec.actions.find((candidate) => candidate.id === actionId);
    if (action === undefined) {
      return commandErr({
        character,
        error: handlerError('HANDLER_ACTION_UNKNOWN', `O handler "${spec.id}" não conhece a ação "${actionId}".`, {
          handlerId: spec.id,
          actionId,
          knownActionIds: spec.actions.map((candidate) => candidate.id),
        }),
      });
    }
    if (!matchesSubclass(character, action.subclassId)) {
      return commandErr({
        character,
        error: handlerError('HANDLER_ACTION_SUBCLASS_REQUIRED', `A ação "${actionId}" exige a subclasse declarada.`, {
          handlerId: spec.id,
          actionId,
          requiredSubclassId: action.subclassId,
          actualSubclassId: refId(character?.build?.subclassRef),
        }),
      });
    }
    const level = Number.isInteger(context?.level) ? context.level : character?.state?.level;
    if (Number.isInteger(action.minLevel) && !(Number.isInteger(level) && level >= action.minLevel)) {
      return commandErr({
        character,
        error: handlerError('HANDLER_ACTION_LEVEL_TOO_LOW', `A ação "${actionId}" exige nível ${action.minLevel}.`, {
          handlerId: spec.id,
          actionId,
          minLevel: action.minLevel,
          level: Number.isInteger(level) ? level : null,
        }),
      });
    }

    const flagWrites = new Map();
    if (action.requireFlag !== undefined) {
      const sourceInstanceId = ownerInstanceId(character, action.requireFlag.owner ?? 'class');
      if (sourceInstanceId === null) {
        return commandErr({
          character,
          error: handlerError('HANDLER_ACTION_FLAG_STATE_INVALID', `A ação "${actionId}" exige uma fonte resolvida.`, {
            handlerId: spec.id,
            actionId,
          }),
        });
      }
      const key = usageFlagKey(sourceInstanceId, action.requireFlag.key);
      const map = character?.state?.usageFlags ?? {};
      const current = Object.hasOwn(map, key) ? map[key] === true : false;
      if (current !== action.requireFlag.value) {
        return commandErr({
          character,
          error: handlerError(
            'HANDLER_ACTION_FLAG_STATE_INVALID',
            `A ação "${actionId}" exige a flag "${action.requireFlag.key}" em ${action.requireFlag.value}.`,
            { handlerId: spec.id, actionId, flagKey: key, expected: action.requireFlag.value, actual: current },
          ),
        });
      }
    }

    const resourceWrites = new Map();
    if (action.spend !== undefined) {
      const maxima = collectResourceMaxima(character, context);
      if (!maxima.ok) {
        return commandErr({ character, error: maxima.error });
      }
      const owned = activeResources(character).find((candidate) => candidate.key === action.spend.resource);
      if (owned === undefined || !maxima.value.has(owned.resourceId)) {
        return commandErr({
          character,
          error: handlerError(
            'HANDLER_RESOURCE_NOT_GRANTED',
            `O recurso "${action.spend.resource}" não é concedido a este personagem no nível atual.`,
            { handlerId: spec.id, actionId, resource: action.spend.resource, level: Number.isInteger(level) ? level : null },
          ),
        });
      }
      const amount = resolveSpendAmount(action, payload);
      if (!amount.ok) {
        return commandErr({ character, error: amount.error });
      }
      const read = readOwnedResource(character, owned.resourceId, owned.sourceInstanceId);
      if ('foreign' in read) {
        return commandErr({
          character,
          error: handlerError(
            'HANDLER_RESOURCE_FOREIGN_PROVENANCE',
            `A entrada "${owned.resourceId}" pertence a outra proveniência; o handler não a sobrescreve.`,
            {
              handlerId: spec.id,
              actionId,
              resourceId: owned.resourceId,
              expectedSourceInstanceId: owned.sourceInstanceId,
              actualSourceInstanceId: read.sourceInstanceId,
            },
          ),
        });
      }
      if ('missing' in read) {
        return commandErr({
          character,
          error: handlerError(
            'HANDLER_RESOURCE_NOT_INITIALIZED',
            `O recurso "${owned.resourceId}" não tem valor materializado; só progressão/migração pode criá-lo.`,
            { handlerId: spec.id, actionId, resourceId: owned.resourceId },
          ),
        });
      }
      if (!Number.isInteger(read.entry.current)) {
        return commandErr({
          character,
          error: handlerError(
            'HANDLER_RESOURCE_STATE_INVALID',
            `O recurso "${owned.resourceId}" tem "current" que não é inteiro.`,
            { handlerId: spec.id, actionId, resourceId: owned.resourceId, current: read.entry.current ?? null },
          ),
        });
      }
      if (read.entry.current < amount.value) {
        return commandErr({
          character,
          error: handlerError(
            'HANDLER_RESOURCE_INSUFFICIENT',
            `O recurso "${owned.resourceId}" tem ${read.entry.current}, menos que os ${amount.value} exigidos.`,
            { handlerId: spec.id, actionId, resourceId: owned.resourceId, current: read.entry.current, required: amount.value },
          ),
        });
      }
      resourceWrites.set(owned.resourceId, {
        ...read.entry,
        current: read.entry.current - amount.value,
        sourceInstanceId: owned.sourceInstanceId,
      });
    }

    // `restoreResource`: ações que RECARREGAM um recurso próprio (ex.:
    // Metabolismo Incomum do Monge e Fúria Persistente do Bárbaro). Falha
    // aqui aborta a ação INTEIRA — nenhuma flag é escrita (`flagWrites` só é
    // aplicado depois deste bloco), então o uso único não é queimado à toa.
    if (action.restoreResource !== undefined) {
      const restored = restoreOwnedResource(character, action.restoreResource, context, resourceWrites, actionId);
      if (!restored.ok) {
        return commandErr({ character, error: restored.error });
      }
    }

    // `recoverResource`: recarga PARCIAL por ação (Arquidruida). Mesma
    // posição no fluxo que `restoreResource` — antes de qualquer `setFlags` —
    // para que a falha aborte a ação inteira sem escrever flag.
    if (action.recoverResource !== undefined) {
      const recovered = recoverOwnedResource(character, action.recoverResource, context, resourceWrites, actionId);
      if (!recovered.ok) {
        return commandErr({ character, error: recovered.error });
      }
    }

    for (const [key, value] of Object.entries(action.setFlags ?? {})) {
      const sourceInstanceId = ownerInstanceId(character, action.flagOwner ?? 'class');
      if (sourceInstanceId !== null) {
        flagWrites.set(usageFlagKey(sourceInstanceId, key), value);
      }
    }

    const applied = applyWrites(character, resourceWrites, flagWrites);
    return commandOk({
      character: applied.character,
      events: [{ type: 'class-action-executed', handlerId: spec.id, actionId }],
      affected: applied.affected,
    });
  }

  /**
   * Resolve quantos pontos do recurso a ação gasta: o valor fixo declarado ou
   * o `payload.amount` quando a ação o permite (`amountFromPayload: true`).
   * Payload fora do intervalo é erro, nunca um valor "arredondado".
   * @param {object} action
   * @param {object | undefined} payload
   * @returns {{ok: true, value: number} | {ok: false, error: object}}
   */
  function resolveSpendAmount(action, payload) {
    if (action.spend.amountFromPayload !== true) {
      return { ok: true, value: action.spend.amount };
    }
    const raw = payload?.amount;
    if (raw === undefined) {
      return { ok: true, value: action.spend.amount };
    }
    if (!Number.isInteger(raw) || raw < 1) {
      return {
        ok: false,
        error: handlerError('HANDLER_PAYLOAD_INVALID', `O "payload.amount" de "${action.id}" deve ser inteiro >= 1.`, {
          handlerId: spec.id,
          actionId: action.id,
          amount: typeof raw === 'number' ? raw : null,
        }),
      };
    }
    const limit = Number.isInteger(action.spend.maxAmount) ? action.spend.maxAmount : null;
    if (limit !== null && raw > limit) {
      return {
        ok: false,
        error: handlerError('HANDLER_PAYLOAD_INVALID', `O "payload.amount" de "${action.id}" excede ${limit}.`, {
          handlerId: spec.id,
          actionId: action.id,
          amount: raw,
          maxAmount: limit,
        }),
      };
    }
    return { ok: true, value: raw };
  }

  /**
   * Coloca no mapa de escritas a restauração de um recurso próprio ao teto
   * declarado pelo conteúdo.
   *
   * Recurso NÃO CONCEDIDO no nível atual, ou concedido mas sem valor
   * materializado, é ERRO — não um sucesso silencioso. Uma ação de restauração
   * é sempre de uso único por descanso (Metabolismo Incomum do Monge, Fúria
   * Persistente do Bárbaro): devolver `ok` aqui e deixar `execute` marcar a
   * flag mesmo assim QUEIMARIA o uso sem restaurar nada — e o estado
   * "não materializado" é o estado comum de todo personagem migrado
   * (`infra/character/migrations/v1-to-v2.js` não materializa recurso de
   * classe). A regra de "recurso ausente" proíbe INVENTAR o valor inicial;
   * ela não pede que a ação finja ter funcionado. Simétrico ao caminho de
   * gasto, que já falha com `HANDLER_RESOURCE_NOT_INITIALIZED`.
   *
   * @param {object} character
   * @param {string} resourceKey
   * @param {object} context
   * @param {Map<string, object>} resourceWrites
   * @param {string} actionId
   * @returns {{ok: true} | {ok: false, error: object}}
   */
  function restoreOwnedResource(character, resourceKey, context, resourceWrites, actionId) {
    const maxima = collectResourceMaxima(character, context);
    if (!maxima.ok) {
      return { ok: false, error: maxima.error };
    }
    const owned = activeResources(character).find((candidate) => candidate.key === resourceKey);
    const declared = owned === undefined ? undefined : maxima.value.get(owned.resourceId);
    if (owned === undefined || declared === undefined) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_RESOURCE_NOT_GRANTED',
          `O recurso "${resourceKey}" não é concedido a este personagem no nível atual; não há o que restaurar.`,
          { handlerId: spec.id, actionId, resource: resourceKey },
        ),
      };
    }
    const read = readOwnedResource(character, owned.resourceId, owned.sourceInstanceId);
    if ('foreign' in read) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_RESOURCE_FOREIGN_PROVENANCE',
          `A entrada "${owned.resourceId}" pertence a outra proveniência; o handler não a sobrescreve.`,
          {
            handlerId: spec.id,
            actionId,
            resourceId: owned.resourceId,
            expectedSourceInstanceId: owned.sourceInstanceId,
            actualSourceInstanceId: read.sourceInstanceId,
          },
        ),
      };
    }
    if ('missing' in read) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_RESOURCE_NOT_INITIALIZED',
          `O recurso "${owned.resourceId}" não tem valor materializado; a restauração não pode inventá-lo nem consumir o uso da ação.`,
          { handlerId: spec.id, actionId, resourceId: owned.resourceId },
        ),
      };
    }
    resourceWrites.set(owned.resourceId, {
      ...read.entry,
      current: declared.max,
      sourceInstanceId: owned.sourceInstanceId,
    });
    return { ok: true };
  }

  /**
   * Coloca no mapa de escritas a recarga PARCIAL de um recurso próprio
   * (`current + amount`, limitado ao teto declarado pelo conteúdo).
   *
   * Herda, deliberadamente, TODA a disciplina de falha de
   * `restoreOwnedResource` (corrigida na rodada 2 da Task 20): recurso não
   * concedido, de outra proveniência ou sem valor materializado é ERRO, nunca
   * um `ok` silencioso — do contrário uma ação de uso único marcaria a flag
   * sem recarregar nada. `requireExhausted` reproduz a condição do baseline
   * ("só recupera se você NÃO tiver usos restantes",
   * `site/js/pages/sheet.js:6234-6237`); não satisfazê-la é recusa explícita,
   * e não uma recarga a mais.
   *
   * @param {object} character
   * @param {{resource: string, amount: number, requireExhausted?: boolean}} spec_
   * @param {object} context
   * @param {Map<string, object>} resourceWrites
   * @param {string} actionId
   * @returns {{ok: true} | {ok: false, error: object}}
   */
  function recoverOwnedResource(character, spec_, context, resourceWrites, actionId) {
    const maxima = collectResourceMaxima(character, context);
    if (!maxima.ok) {
      return { ok: false, error: maxima.error };
    }
    const owned = activeResources(character).find((candidate) => candidate.key === spec_.resource);
    const declared = owned === undefined ? undefined : maxima.value.get(owned.resourceId);
    if (owned === undefined || declared === undefined) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_RESOURCE_NOT_GRANTED',
          `O recurso "${spec_.resource}" não é concedido a este personagem no nível atual; não há o que recarregar.`,
          { handlerId: spec.id, actionId, resource: spec_.resource },
        ),
      };
    }
    const read = readOwnedResource(character, owned.resourceId, owned.sourceInstanceId);
    if ('foreign' in read) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_RESOURCE_FOREIGN_PROVENANCE',
          `A entrada "${owned.resourceId}" pertence a outra proveniência; o handler não a sobrescreve.`,
          {
            handlerId: spec.id,
            actionId,
            resourceId: owned.resourceId,
            expectedSourceInstanceId: owned.sourceInstanceId,
            actualSourceInstanceId: read.sourceInstanceId,
          },
        ),
      };
    }
    if ('missing' in read) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_RESOURCE_NOT_INITIALIZED',
          `O recurso "${owned.resourceId}" não tem valor materializado; a recarga não pode inventá-lo nem consumir o uso da ação.`,
          { handlerId: spec.id, actionId, resourceId: owned.resourceId },
        ),
      };
    }
    if (!Number.isInteger(read.entry.current)) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_RESOURCE_STATE_INVALID',
          `O recurso "${owned.resourceId}" tem "current" que não é inteiro.`,
          { handlerId: spec.id, actionId, resourceId: owned.resourceId, current: read.entry.current ?? null },
        ),
      };
    }
    if (spec_.requireExhausted === true && read.entry.current !== 0) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_RESOURCE_NOT_EXHAUSTED',
          `A ação "${actionId}" só recarrega "${owned.resourceId}" quando não resta nenhum uso.`,
          { handlerId: spec.id, actionId, resourceId: owned.resourceId, current: read.entry.current },
        ),
      };
    }
    if (read.entry.current >= declared.max) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_RESOURCE_ALREADY_FULL',
          `O recurso "${owned.resourceId}" já está no teto declarado (${declared.max}); não há o que recarregar.`,
          { handlerId: spec.id, actionId, resourceId: owned.resourceId, current: read.entry.current, max: declared.max },
        ),
      };
    }
    // `amount` pode ser um nome de variável (Task 22a): resolvido contra
    // `context.variables` pelo MESMO caminho que resolve o `max` declarado no
    // conteúdo. Variável ausente é erro explícito — a recarga nunca cai num
    // "1" de conveniência.
    const amount = resolveNumericValue(spec_.amount, context);
    if (!amount.ok || !Number.isInteger(amount.value) || amount.value < 1) {
      return {
        ok: false,
        error: handlerError(
          'HANDLER_RESOURCE_RECOVER_AMOUNT_UNRESOLVED',
          `A quantidade recarregada por "${actionId}" não é resolvível como inteiro >= 1; o handler não inventa um valor.`,
          { handlerId: spec.id, actionId, resourceId: owned.resourceId, declaredAmount: spec_.amount },
        ),
      };
    }
    resourceWrites.set(owned.resourceId, {
      ...read.entry,
      current: Math.min(declared.max, read.entry.current + amount.value),
      sourceInstanceId: owned.sourceInstanceId,
    });
    return { ok: true };
  }

  // -- onRest ---------------------------------------------------------------

  /**
   * Aplica a recarga de descanso deste handler.
   *
   * `kind` é comparado contra os literais EXATOS `"short"` e `"long"` — nunca
   * traduzido. Um descanso longo NÃO reexecuta automaticamente as operações
   * de curto: cada lista é declarada por inteiro na configuração do handler,
   * refletindo o que o baseline faz (ex.: no Bárbaro, curto devolve 1 uso e
   * longo devolve todos — não 1 + todos).
   *
   * @param {object} character
   * @param {{kind: 'short' | 'long'}} params
   * @param {object} [context]
   * @returns {import('../../../commands/command-result.js').CommandResult}
   */
  function onRest(character, params, context = {}) {
    const kind = params?.kind;
    if (!REST_KINDS.includes(kind)) {
      return commandErr({
        character,
        error: handlerError('HANDLER_REST_KIND_INVALID', 'O descanso exige kind: "short" | "long".', {
          handlerId: spec.id,
          kind: typeof kind === 'string' ? kind : null,
        }),
      });
    }
    if (!matchesClass(character)) {
      // Handler de outra classe simplesmente não participa deste descanso —
      // não é erro: o dispatcher chama todos os handlers registrados.
      return commandOk({ character, events: [], affected: [] });
    }

    const operations = spec.rest[kind];
    if (operations.length === 0) {
      return commandOk({ character, events: [], affected: [] });
    }

    const maxima = collectResourceMaxima(character, context);
    if (!maxima.ok) {
      return commandErr({ character, error: maxima.error });
    }

    const resourceWrites = new Map();
    const flagWrites = new Map();
    const resourcesByKey = new Map(activeResources(character).map((r) => [`${r.owner} ${r.key}`, r]));

    const restLevel = Number.isInteger(context?.level) ? context.level : character?.state?.level;

    for (const operation of operations) {
      if (!matchesSubclass(character, operation.subclassId)) {
        continue;
      }
      // `minLevel` (Task 22a): há recargas de descanso que só passam a existir
      // a partir de um nível — "Fonte de Inspiração" devolve a Inspiração de
      // Bardo no descanso CURTO só do nível 5 em diante
      // (`site/js/pages/sheet.js:4362-4365`, commit e43c5ea), e a Assinatura
      // Mágica do Mago só existe no nível 20 (`sheet.js:4508-4512`). Sem este
      // filtro, o descanso curto de um Bardo de nível 4 recarregaria um recurso
      // que o baseline não recarrega.
      if (Number.isInteger(operation.minLevel) && !(Number.isInteger(restLevel) && restLevel >= operation.minLevel)) {
        continue;
      }
      if (operation.kind === 'clear-flag') {
        const sourceInstanceId = ownerInstanceId(character, operation.owner ?? 'class');
        if (sourceInstanceId !== null) {
          const key = usageFlagKey(sourceInstanceId, operation.flag);
          const map = character?.state?.usageFlags ?? {};
          // Só REESCREVE uma flag que já existe e está marcada. Criar a chave
          // com `false` num personagem que nunca a teve seria materializar
          // estado ausente num comando de descanso — exatamente o que a regra
          // de "recurso ausente" proíbe.
          if (Object.hasOwn(map, key) && map[key] !== false) {
            flagWrites.set(key, false);
          }
        }
        continue;
      }

      const owner = operation.owner ?? 'class';
      const owned = resourcesByKey.get(`${owner} ${operation.resource}`);
      if (owned === undefined) {
        continue;
      }
      const declared = maxima.value.get(owned.resourceId);
      if (declared === undefined) {
        continue;
      }
      const read = readOwnedResource(character, owned.resourceId, owned.sourceInstanceId);
      if ('foreign' in read) {
        return commandErr({
          character,
          error: handlerError(
            'HANDLER_RESOURCE_FOREIGN_PROVENANCE',
            `A entrada "${owned.resourceId}" pertence a outra proveniência; o descanso não a sobrescreve.`,
            {
              handlerId: spec.id,
              resourceId: owned.resourceId,
              expectedSourceInstanceId: owned.sourceInstanceId,
              actualSourceInstanceId: read.sourceInstanceId,
            },
          ),
        });
      }
      if ('missing' in read) {
        // Recurso não inicializado continua não inicializado depois do
        // descanso. Materializá-lo aqui seria inventar o default de jogo que
        // a Global Constraint proíbe.
        continue;
      }
      if (!Number.isInteger(read.entry.current)) {
        return commandErr({
          character,
          error: handlerError(
            'HANDLER_RESOURCE_STATE_INVALID',
            `O recurso "${owned.resourceId}" tem "current" que não é inteiro; o descanso foi recusado.`,
            { handlerId: spec.id, resourceId: owned.resourceId, current: read.entry.current ?? null },
          ),
        });
      }

      let next;
      if (operation.kind === 'restore-resource') {
        next = declared.max;
      } else if (operation.kind === 'recover-resource') {
        next = Math.min(declared.max, read.entry.current + operation.amount);
      } else {
        return commandErr({
          character,
          error: handlerError('HANDLER_REST_OPERATION_UNKNOWN', `Operação de descanso desconhecida: "${operation.kind}".`, {
            handlerId: spec.id,
            operation: String(operation.kind),
          }),
        });
      }
      if (next !== read.entry.current) {
        resourceWrites.set(owned.resourceId, {
          ...read.entry,
          current: next,
          sourceInstanceId: owned.sourceInstanceId,
        });
      }
    }

    const applied = applyWrites(character, resourceWrites, flagWrites);
    if (applied.affected.length === 0) {
      return commandOk({ character, events: [], affected: [] });
    }
    return commandOk({
      character: applied.character,
      events: [{ type: 'class-rest-applied', handlerId: spec.id, kind }],
      affected: applied.affected,
    });
  }

  return Object.freeze({
    id: spec.id,
    classId: spec.classId,
    project,
    contributeEffects,
    execute,
    onRest,
  });
}
