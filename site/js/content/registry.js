// Módulo `content/registry`: o catálogo de conteúdo ativo da aplicação.
//
// ## Duas portas, não uma
//
// Este módulo exporta duas coisas:
//
//   - `ContentRegistry({ validator })` — a porta pública de CONSULTA de
//     conteúdo. Recebe SOMENTE o validador: nunca um handler registry, nunca
//     a função `issue` do canal de autorização. Tem exatamente sete métodos
//     e nenhum deles executa código de handler.
//   - `createContentRuntime({ validator, handlerRegistry,
//     issueOfficialHandlerAuthorization })` — a fábrica usada pelo
//     composition root, que devolve `{ registry, officialHandlerInvoker }`
//     como portas separadas.
//
// A associação fonte->capacidade fica num "ledger" privado criado pela
// fábrica interna `buildContentRegistry` (não exportada). O
// `ContentRegistry` público descarta esse ledger; só `createContentRuntime`
// o mantém em fechamento e o compartilha com o `OfficialHandlerInvoker`. Não
// há como obter o ledger a partir de um registry.
//
// ## Ativação atômica
//
// `initialize()` monta TUDO numa área de staging privada — carrega manifesto,
// índice e todas as entidades de todas as fontes, valida o pacote inteiro,
// confere namespace e unicidade de id — e só publica os mapas/listas
// congelados quando tudo passa. Qualquer falha (entidade inválida,
// referência quebrada, id duplicado, pacote `"building"`) aborta a ativação
// inteira sem deixar nada ativo.

import { ok, err, isResult } from '../core/result.js';
import { createAppError } from '../core/errors.js';
import { parseContentId } from '../core/content-id.js';
import { mergeValidationResults } from '../core/validation.js';
import { assertContentSource } from './source.js';
import { describeCapabilities, hasOfficialHandlersCapability } from './capabilities.js';

const SCOPE = 'content.registry';

// Único status de manifesto que pode ser ativado em runtime. Pacotes
// `"building"` existem para as ferramentas de staging validarem, mas nunca
// entram no catálogo da aplicação.
const READY_STATUS = 'ready';

const VALIDATOR_METHODS = Object.freeze([
  'validateManifest',
  'validateIndex',
  'validateEntity',
  'validateReferences',
]);

/**
 * Congela `value` recursivamente (objetos simples e arrays), protegendo
 * contra ciclos. As entidades publicadas precisam ser imutáveis: uma
 * consulta jamais pode alterar o catálogo.
 * @param {*} value
 * @param {WeakSet<object>} [seen]
 * @returns {*}
 */
function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key], seen);
  }
  return value;
}

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function registryError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Chama um método da fonte e garante que o retorno é um Result. Uma fonte
 * que devolve outra coisa está violando o contrato — isso é reportado como
 * erro estruturado em vez de explodir com TypeError adiante.
 * @param {object} source
 * @param {string} method
 * @param {string} namespace
 * @param {Array<*>} args
 * @returns {Promise<import('../core/result.js').Result>}
 */
async function callSource(source, method, namespace, args = []) {
  let result;
  try {
    result = await source[method](...args);
  } catch (cause) {
    return err(
      createAppError({
        code: 'CONTENT_SOURCE_CONTRACT_VIOLATION',
        scope: SCOPE,
        message: `A fonte "${namespace}" lançou uma exceção em ${method}(); o contrato exige Result.`,
        context: { namespace, method },
        cause,
      }),
    );
  }
  if (!isResult(result)) {
    return err(
      registryError(
        'CONTENT_SOURCE_CONTRACT_VIOLATION',
        `A fonte "${namespace}" não devolveu um Result em ${method}().`,
        { namespace, method, receivedType: typeof result },
      ),
    );
  }
  return result;
}

/**
 * Extrai o namespace de um ContentId, ou `null` quando malformado.
 * @param {*} id
 * @returns {string | null}
 */
function namespaceOf(id) {
  const parsed = parseContentId(id);
  return parsed.ok ? parsed.value.namespace : null;
}

/**
 * Fábrica interna (NÃO exportada) que constrói o registry junto com o ledger
 * privado fonte->capacidade. Só `ContentRegistry` e `createContentRuntime`
 * a chamam; o ledger nunca é alcançável a partir do registry devolvido.
 * @param {{validator: object}} params
 * @returns {{registry: object, ledger: object}}
 */
function buildContentRegistry({ validator } = {}) {
  if (
    validator === null ||
    typeof validator !== 'object' ||
    VALIDATOR_METHODS.some((method) => typeof validator[method] !== 'function')
  ) {
    throw new TypeError(
      `ContentRegistry: "validator" deve ser um objeto com ${VALIDATOR_METHODS.join(', ')}.`,
    );
  }

  // --- Estado privado ------------------------------------------------------
  const registrations = [];
  const registeredNamespaces = new Set();
  let initialized = false;
  let initializing = false;

  // Mapas publicados (substituídos de uma vez só no fim de initialize()).
  let entitiesById = new Map();
  let entitiesByType = new Map();
  let activeVersionByNamespace = new Map();

  // Ledger compartilhado por fechamento com o OfficialHandlerInvoker do
  // runtime. Nunca é exposto por nenhum método do registry.
  const ledger = { capabilitiesByEntityId: new Map() };

  /**
   * Registra uma fonte com as capacidades concedidas pelo composition root.
   * @param {*} source
   * @param {*} capabilities
   * @returns {import('../core/result.js').Result}
   */
  function registerSource(source, capabilities) {
    if (initialized) {
      return err(
        registryError(
          'CONTENT_REGISTRY_ALREADY_INITIALIZED',
          'Não é possível registrar fontes depois da inicialização do catálogo.',
        ),
      );
    }

    const sourceValidation = assertContentSource(source);
    if (!sourceValidation.valid) {
      return err(
        registryError('CONTENT_SOURCE_INVALID', 'A fonte de conteúdo não implementa o contrato ContentSource.', {
          errors: sourceValidation.errors.map((error) => ({ code: error.code, message: error.message })),
        }),
      );
    }

    const described = describeCapabilities(capabilities);
    if (!described.ok) {
      return err(described.error);
    }
    if (registeredNamespaces.has(described.namespace)) {
      return err(
        registryError(
          'CONTENT_NAMESPACE_ALREADY_REGISTERED',
          `O namespace "${described.namespace}" já foi concedido a outra fonte; não há sobrescrita implícita.`,
          { namespace: described.namespace },
        ),
      );
    }

    registeredNamespaces.add(described.namespace);
    registrations.push({ source, capabilities, namespace: described.namespace });
    return ok(undefined);
  }

  /**
   * Valida um pacote inteiro (manifesto, índice e entidades) delegando ao
   * validador injetado.
   * @param {*} manifest
   * @param {*} index
   * @param {*} entities
   * @returns {import('../core/validation.js').ValidationResult}
   */
  function validatePackage(manifest, index, entities) {
    const results = [validator.validateManifest(manifest), validator.validateIndex(index)];
    const list = Array.isArray(entities) ? entities : [];
    for (const entity of list) {
      results.push(validator.validateEntity(entity));
    }
    results.push(validator.validateReferences({ manifest, index, entities: list }));
    return mergeValidationResults(results);
  }

  /**
   * Confere que todo id do pacote pertence ao namespace concedido: nem o
   * manifesto nem as entidades podem reivindicar namespace alheio.
   * @param {string} namespace
   * @param {*} manifest
   * @param {ReadonlyArray<object>} entries
   * @param {ReadonlyArray<object>} entities
   * @returns {object | null} AppError, ou null quando tudo confere.
   */
  function checkNamespaceOwnership(namespace, manifest, entries, entities) {
    /** Monta o erro padrão de namespace não concedido. */
    const deny = (field, id) =>
      registryError(
        'CONTENT_NAMESPACE_NOT_GRANTED',
        `O pacote da fonte "${namespace}" usa o id "${id}" em ${field}, fora do namespace concedido.`,
        { namespace, field, id, claimedNamespace: namespaceOf(id) },
      );

    if (typeof manifest.ruleset === 'string' && namespaceOf(manifest.ruleset) !== namespace) {
      return deny('manifest.ruleset', manifest.ruleset);
    }
    for (const [position, entry] of entries.entries()) {
      if (namespaceOf(entry?.id) !== namespace) {
        return deny(`index.entries[${position}].id`, String(entry?.id));
      }
    }
    for (const [position, entity] of entities.entries()) {
      if (namespaceOf(entity?.id) !== namespace) {
        return deny(`entities[${position}].id`, String(entity?.id));
      }
    }
    return null;
  }

  /**
   * Carrega e valida um pacote inteiro em memória, sem publicar nada.
   * @param {{source: object, capabilities: object, namespace: string}} registration
   * @returns {Promise<import('../core/result.js').Result>}
   */
  async function stagePackage({ source, capabilities, namespace }) {
    const manifestResult = await callSource(source, 'loadManifest', namespace);
    if (!manifestResult.ok) {
      return manifestResult;
    }
    const manifest = manifestResult.value;
    if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
      return err(
        registryError('CONTENT_PACKAGE_INVALID', `O manifesto da fonte "${namespace}" não é um objeto.`, {
          namespace,
        }),
      );
    }

    // Regra dura: só pacote "ready" entra no catálogo runtime.
    if (manifest.status !== READY_STATUS) {
      return err(
        registryError(
          'CONTENT_PACKAGE_NOT_READY',
          `O pacote da fonte "${namespace}" não está pronto para ativação (status "${String(manifest.status)}").`,
          { namespace, status: typeof manifest.status === 'string' ? manifest.status : null },
        ),
      );
    }

    const indexResult = await callSource(source, 'loadIndex', namespace);
    if (!indexResult.ok) {
      return indexResult;
    }
    const index = indexResult.value;
    if (index === null || typeof index !== 'object' || !Array.isArray(index.entries)) {
      return err(
        registryError('CONTENT_PACKAGE_INVALID', `O índice da fonte "${namespace}" não tem um array "entries".`, {
          namespace,
        }),
      );
    }

    const entities = [];
    for (const entry of index.entries) {
      const entityResult = await callSource(source, 'loadEntity', namespace, [entry?.id]);
      if (!entityResult.ok) {
        return entityResult;
      }
      entities.push(entityResult.value);
    }

    const validation = validatePackage(manifest, index, entities);
    if (!validation.valid) {
      return err(
        registryError('CONTENT_PACKAGE_INVALID', `O pacote da fonte "${namespace}" não passou na validação.`, {
          namespace,
          errors: validation.errors.map((error) => ({ code: error.code, message: error.message })),
        }),
      );
    }

    const namespaceError = checkNamespaceOwnership(namespace, manifest, index.entries, entities);
    if (namespaceError !== null) {
      return err(namespaceError);
    }

    // Unicidade de id dentro do próprio pacote.
    const seen = new Set();
    for (const entity of entities) {
      if (seen.has(entity.id)) {
        return err(
          registryError(
            'CONTENT_ENTITY_DUPLICATE_ID',
            `O pacote da fonte "${namespace}" declara o id "${entity.id}" mais de uma vez.`,
            { namespace, id: entity.id },
          ),
        );
      }
      seen.add(entity.id);
    }

    return ok({ manifest, entities, capabilities, namespace, version: manifest.version });
  }

  /**
   * Carrega todas as fontes registradas e publica o catálogo apenas quando
   * o conjunto inteiro é válido.
   * @returns {Promise<import('../core/result.js').Result>}
   */
  async function initialize() {
    if (initialized || initializing) {
      return err(
        registryError('CONTENT_REGISTRY_ALREADY_INITIALIZED', 'O catálogo de conteúdo já foi inicializado.'),
      );
    }
    if (registrations.length === 0) {
      return err(
        registryError('CONTENT_REGISTRY_NO_SOURCES', 'Nenhuma fonte de conteúdo foi registrada.'),
      );
    }

    initializing = true;
    try {
      // --- Staging privado: nada disso é observável até a publicação. ---
      const stagedById = new Map();
      const stagedByType = new Map();
      const stagedCapabilities = new Map();
      const stagedVersions = new Map();

      for (const registration of registrations) {
        const staged = await stagePackage(registration);
        if (!staged.ok) {
          return staged;
        }
        const { manifest, entities, capabilities, namespace, version } = staged.value;
        void manifest;

        for (const entity of entities) {
          if (stagedById.has(entity.id)) {
            return err(
              registryError(
                'CONTENT_ENTITY_DUPLICATE_ID',
                `O id "${entity.id}" já foi publicado por outra fonte; não há sobrescrita implícita entre fontes.`,
                { id: entity.id, namespace },
              ),
            );
          }
          const frozen = deepFreeze(entity);
          stagedById.set(entity.id, frozen);
          if (!stagedByType.has(entity.type)) {
            stagedByType.set(entity.type, []);
          }
          stagedByType.get(entity.type).push(frozen);
          stagedCapabilities.set(entity.id, capabilities);
        }
        stagedVersions.set(namespace, typeof version === 'string' ? version : null);
      }

      // --- Publicação: troca atômica das estruturas congeladas. ---
      entitiesById = stagedById;
      entitiesByType = new Map(
        [...stagedByType.entries()].map(([type, list]) => [type, Object.freeze(list)]),
      );
      activeVersionByNamespace = stagedVersions;
      ledger.capabilitiesByEntityId = stagedCapabilities;
      initialized = true;
      return ok(undefined);
    } finally {
      initializing = false;
    }
  }

  /**
   * Lista as entidades ativas de um tipo. O array devolvido é congelado.
   * Sem `type`, lista todas as entidades ativas.
   * @param {string} [type]
   * @returns {ReadonlyArray<object>}
   */
  function list(type) {
    if (type === undefined) {
      return Object.freeze([...entitiesById.values()]);
    }
    return entitiesByType.get(type) ?? Object.freeze([]);
  }

  /**
   * Devolve a entidade ativa com o ContentId informado, ou `null`.
   * @param {*} id
   * @returns {object | null}
   */
  function get(id) {
    if (typeof id !== 'string') {
      return null;
    }
    return entitiesById.get(id) ?? null;
  }

  /**
   * Resolve uma referência de conteúdo (ContentId nu ou
   * `{id, packageVersion}`) para a entidade ativa correspondente.
   * @param {*} reference
   * @param {string} [expectedType]
   * @returns {import('../core/result.js').Result}
   */
  function resolve(reference, expectedType) {
    if (!initialized) {
      return err(
        registryError(
          'CONTENT_REGISTRY_NOT_INITIALIZED',
          'O catálogo de conteúdo ainda não foi inicializado.',
        ),
      );
    }

    const isRef = reference !== null && typeof reference === 'object' && !Array.isArray(reference);
    const rawId = isRef ? reference.id : reference;
    const parsed = parseContentId(rawId);
    if (!parsed.ok) {
      return err(
        registryError('CONTENT_REFERENCE_INVALID', 'A referência de conteúdo não é um ContentId válido.', {
          reference: typeof rawId === 'string' ? rawId : null,
        }),
      );
    }

    // Uma única versão ativa por namespace: uma referência presa a outra
    // versão exige migração explícita (ver content/reference-migrations.js).
    const requestedVersion = isRef && typeof reference.packageVersion === 'string' ? reference.packageVersion : null;
    if (requestedVersion !== null) {
      const activeVersion = activeVersionByNamespace.get(parsed.value.namespace) ?? null;
      if (activeVersion !== requestedVersion) {
        return err(
          registryError(
            'CONTENT_VERSION_MIGRATION_REQUIRED',
            `A referência "${rawId}" aponta para a versão ${requestedVersion} do namespace "${parsed.value.namespace}", mas a versão ativa é ${String(activeVersion)}.`,
            {
              id: rawId,
              namespace: parsed.value.namespace,
              requestedVersion,
              activeVersion,
            },
          ),
        );
      }
    }

    const entity = entitiesById.get(rawId) ?? null;
    if (entity === null) {
      return err(
        registryError('CONTENT_REFERENCE_NOT_FOUND', `Nenhuma entidade ativa com o id "${rawId}".`, {
          id: rawId,
        }),
      );
    }
    if (typeof expectedType === 'string' && entity.type !== expectedType) {
      return err(
        registryError(
          'CONTENT_REFERENCE_TYPE_MISMATCH',
          `A entidade "${rawId}" é do tipo "${entity.type}", mas o esperado era "${expectedType}".`,
          { id: rawId, expectedType, actualType: entity.type },
        ),
      );
    }
    return ok(entity);
  }

  /**
   * Valida uma entidade isolada, delegando ao validador injetado.
   * @param {*} entity
   * @returns {import('../core/validation.js').ValidationResult}
   */
  function validateEntity(entity) {
    return validator.validateEntity(entity);
  }

  // Exatamente os sete métodos aprovados. Nada aqui invoca handler.
  const registry = Object.freeze({
    registerSource,
    initialize,
    list,
    get,
    resolve,
    validateEntity,
    validatePackage,
  });

  return { registry, ledger };
}

/**
 * Cria o catálogo público de conteúdo. Recebe SOMENTE o validador: nem
 * handler registry, nem a função de emissão de autorizações.
 * @param {{validator: object}} params
 * @returns {Readonly<object>} ContentRegistry com sete métodos
 */
export function ContentRegistry({ validator } = {}) {
  // O ledger é descartado de propósito: um ContentRegistry criado por esta
  // porta pública não participa de nenhuma decisão de capacidade.
  const { registry } = buildContentRegistry({ validator });
  return registry;
}

/**
 * Verifica se a entidade declara EXATAMENTE aquele handler oficial, via um
 * efeito `official-handler` com o mesmo `handlerId`.
 * @param {*} entity
 * @param {string} handlerId
 * @returns {boolean}
 */
function declaresHandler(entity, handlerId) {
  if (entity === null || typeof entity !== 'object' || !Array.isArray(entity.effects)) {
    return false;
  }
  return entity.effects.some(
    (effect) =>
      effect !== null &&
      typeof effect === 'object' &&
      effect.type === 'official-handler' &&
      effect.handlerId === handlerId,
  );
}

/**
 * Cria o runtime de conteúdo do composition root: o catálogo e a porta
 * separada de invocação de handlers oficiais.
 *
 * `issueOfficialHandlerAuthorization` deve ser o `issue` do canal criado em
 * `app-context.js`; o `verify` correspondente vai SOMENTE para o
 * `handlerRegistry`. Este módulo nunca vê `verify`, e o `handlerRegistry`
 * nunca vê `issue`.
 *
 * @param {{validator: object, handlerRegistry: object, issueOfficialHandlerAuthorization: Function}} params
 * @returns {Readonly<{registry: object, officialHandlerInvoker: object}>}
 */
export function createContentRuntime({ validator, handlerRegistry, issueOfficialHandlerAuthorization } = {}) {
  if (typeof issueOfficialHandlerAuthorization !== 'function') {
    throw new TypeError('createContentRuntime: "issueOfficialHandlerAuthorization" deve ser uma função.');
  }
  if (
    handlerRegistry === null ||
    typeof handlerRegistry !== 'object' ||
    typeof handlerRegistry.invokeAuthorized !== 'function'
  ) {
    throw new TypeError('createContentRuntime: "handlerRegistry" deve oferecer invokeAuthorized().');
  }

  // O ledger fica APENAS neste fechamento, compartilhado com o invoker.
  const { registry, ledger } = buildContentRegistry({ validator });

  /**
   * Invoca um handler oficial declarado por uma entidade ativa.
   *
   * A autorização só é emitida quando as três condições valem ao mesmo
   * tempo: a entidade está ativa no catálogo, veio de uma fonte com a
   * capacidade `officialHandlers` de verdade (identidade de objeto, nunca
   * dado JSON) e declara exatamente aquele `handlerId`.
   *
   * @param {*} request - `{entityId, handlerId, operation, payload?, context?}`
   * @returns {import('../core/result.js').Result}
   */
  function invoke(request) {
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
      return err(
        registryError('OFFICIAL_HANDLER_INVALID_REQUEST', 'A requisição de handler deve ser um objeto.', {
          receivedType: Array.isArray(request) ? 'array' : typeof request,
        }),
      );
    }
    const { entityId, handlerId, operation, payload, context } = request;
    for (const [name, value] of [
      ['entityId', entityId],
      ['handlerId', handlerId],
      ['operation', operation],
    ]) {
      if (typeof value !== 'string' || value.length === 0) {
        return err(
          registryError(
            'OFFICIAL_HANDLER_INVALID_REQUEST',
            `A requisição de handler exige "${name}" como string não vazia.`,
            { field: name },
          ),
        );
      }
    }

    const entity = registry.get(entityId);
    if (entity === null) {
      return err(
        registryError(
          'OFFICIAL_HANDLER_ENTITY_NOT_FOUND',
          `Não há entidade ativa com o id "${entityId}".`,
          { entityId, handlerId, operation },
        ),
      );
    }

    const capabilities = ledger.capabilitiesByEntityId.get(entityId) ?? null;
    if (!hasOfficialHandlersCapability(capabilities)) {
      return err(
        registryError(
          'OFFICIAL_HANDLER_NOT_AUTHORIZED',
          `A entidade "${entityId}" não veio de uma fonte com a capacidade de handlers oficiais.`,
          { entityId, handlerId, operation },
        ),
      );
    }

    if (!declaresHandler(entity, handlerId)) {
      return err(
        registryError(
          'OFFICIAL_HANDLER_NOT_DECLARED',
          `A entidade "${entityId}" não declara o handler oficial "${handlerId}".`,
          { entityId, handlerId, operation },
        ),
      );
    }

    const authorization = issueOfficialHandlerAuthorization({ entityId, handlerId, operation });

    let result;
    try {
      result = handlerRegistry.invokeAuthorized({
        authorization,
        entityId,
        handlerId,
        operation,
        payload,
        context,
      });
    } catch (cause) {
      // O `cause` fica fora do contexto serializável; nenhum AppError deste
      // módulo carrega a autorização.
      return err(
        createAppError({
          code: 'OFFICIAL_HANDLER_INVOCATION_FAILED',
          scope: SCOPE,
          message: `O handler oficial "${handlerId}" lançou uma exceção.`,
          context: { entityId, handlerId, operation },
          cause,
        }),
      );
    }

    if (!isResult(result)) {
      return err(
        registryError(
          'OFFICIAL_HANDLER_INVOCATION_FAILED',
          `O handler oficial "${handlerId}" não devolveu um Result.`,
          { entityId, handlerId, operation, receivedType: typeof result },
        ),
      );
    }
    return result;
  }

  const officialHandlerInvoker = Object.freeze({ invoke });
  return Object.freeze({ registry, officialHandlerInvoker });
}
