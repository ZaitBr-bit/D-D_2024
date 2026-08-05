// Módulo `app-context`: o COMPOSITION ROOT da aplicação.
//
// Este é o único módulo de produção autorizado a chamar
// `createOfficialSourceCapabilities()` e
// `createOfficialHandlerAuthorizationChannel()` — a regra é verificada
// estaticamente por `scripts/check-architecture.mjs`
// (`official-capability-restricted-*`) e coberta por
// `tests/unit/architecture/official-capability-imports.test.js`.
//
// ## Separação issue/verify
//
// O canal de autorização devolve `{issue, verify}` e este módulo os entrega a
// lados OPOSTOS do sistema:
//
//   - `issue`  -> somente para `createOfficialContentRuntime`, como
//                 `issueOfficialHandlerAuthorization`. Quem emite não executa.
//   - `verify` -> somente para o handler registry, que executa handlers.
//                 Quem executa não emite.
//
// Nenhuma das duas funções é exposta pelo objeto devolvido por
// `createAppContext()`: elas ficam presas no fechamento desta fábrica.
//
// ## Estado desta tarefa (Tasks 20, 21 e 22a)
//
// Os DOZE handlers de classe com implementação oficial — quatro marciais
// (Task 20), quatro divinos/primitivos (Task 21) e quatro arcanos
// (`class-bardo`, `class-bruxo`, `class-feiticeiro`, `class-mago`, Task 22a) —
// são registrados AQUI, por `createAllClassHandlerRegistrations()`
// (`domain/rulesets/dnd2024/handlers/register-all.js`), o default de
// `officialHandlers` e único ponto de registro. Nenhum manifesto ou entidade
// JSON escolhe o que é registrado; o conteúdo só DECLARA (via efeito
// `official-handler`) que quer acionar um handler, e o invoker confere a
// declaração antes de emitir a autorização. Um `handlerId` não declarado por
// nenhuma entidade continua sendo código inalcançável — a checagem executável
// disso é `verifyAllClassHandlerDeclarations(contentRegistry)`, que precisa do
// catálogo já ativo e por isso vive nos testes/boot, não neste construtor
// (aqui o catálogo ainda nem foi buscado).
//
// ## Estado da Task 15
//
// O adapter deny-all placeholder da Task 11 foi SUBSTITUÍDO pelo
// `OfficialHandlerRegistry` real (`domain/effects/official-handler-registry.js`),
// construído aqui com o `verify` do canal. `issue` continua indo SOMENTE para o
// runtime de conteúdo/invoker e nunca é exportado nem alcançável pelo domínio.
//
// Nenhum handler oficial concreto é registrado ainda: implementar a mecânica de
// cada handler declarado pelo conteúdo (`asi-or-feat`, magia de pacto, ...) é
// trabalho das tarefas de comando. Com o registry vazio, uma invocação
// legítima falha com `OFFICIAL_HANDLER_NOT_REGISTERED` — falha estruturada e
// diagnosticável, nem crash nem no-op silencioso. O parâmetro
// `officialHandlers` é o único ponto de registro, para que o registro continue
// centralizado no composition root.
//
// Repositório, sincronização e controllers entram aqui nas tarefas seguintes.
//
// ## Estado da Task 22b (cutover de `db.js`) — FEITO
//
// O runtime público NÃO lê mais os JSON legados de `dados/**`. `site/js/db.js`
// virou uma FACHADA FINA que delega para
// `infra/content/legacy-db-projection.js#createLegacyDbProjection`, alimentada
// pelo `ContentRegistry` que ESTE módulo ativa em `initializeContent()`. Ou
// seja: todo conteúdo do app vivo vem de `dados/pacotes/dnd2024/**`, por aqui.
//
// Duas consequências para quem for mexer nisto (Tasks 25-32):
//
//   - Um consumidor novo deve ligar no catálogo/domínio direto, nunca em
//     `db.js` — a fachada só existe enquanto `levelup*.js`, `pages/creator.js`
//     e `pages/sheet.js` não forem reescritos, e some com eles.
//   - Os JSON legados de `dados/**` fora de `dados/pacotes/` NÃO PODEM SER
//     APAGADOS, mesmo sem nenhum leitor em produção: junto com
//     `tests/helpers/legacy-db-source.js` (o antigo `db.js`, congelado), eles
//     são o ORÁCULO de `tests/contract/legacy-db-projection.test.js` e de
//     `tests/e2e/legacy-db-shadow.spec.js`. Sem eles, as duas suítes passariam
//     a comparar a projeção consigo mesma e ficariam verdes sem provar nada.

// ## Estado da Task 25 (portas de persistência)
//
// O composition root passa a montar também as portas de PERSISTÊNCIA que a
// arquitetura nova do criador (`features/creator/**`) consome:
//
//   - `initializeCharacterRepository()` -> `LocalStorageCharacterRepository`
//     (Task 13), montado UMA única vez e memoizado. Depende do catálogo (o
//     resolvedor de aliases legados é uma ENTIDADE do pacote oficial), então
//     é assíncrono e reaproveita `initializeContent()`.
//   - `initializeSyncQueue({gateway, ...})` -> `createSyncQueue` (Task 14),
//     também uma única vez.
//
// Duas decisões que valem registrar:
//
//   1. Nada aqui inventa um default de ambiente. Sem `storage` utilizável a
//      inicialização devolve `APP_CONTEXT_STORAGE_UNAVAILABLE`; sem gateway
//      (o caso REAL de usuário não autenticado) devolve
//      `APP_CONTEXT_SYNC_GATEWAY_UNAVAILABLE`. Um stub silencioso faria o app
//      "salvar" para lugar nenhum.
//   2. As portas continuam SEM expor token de confiança: `capabilities`,
//      `issue` e `verify` permanecem presos ao fechamento, e nem o repositório
//      nem a fila os recebem.

import { ok, err } from './core/result.js';
import { createAppError } from './core/errors.js';
import { LocalStorageCharacterRepository } from './infra/character/local-storage-character-repository.js';
import { createLegacyAliasResolver } from './infra/character/legacy-alias-resolver.js';
import { createPreMigrationBackupService } from './infra/character/pre-migration-backup.js';
import { decodeCharacterRecord } from './infra/character/character-codec.js';
import { createSyncQueue } from './infra/sync/sync-queue.js';
import { createOfficialSourceCapabilities } from './content/capabilities.js';
import { createOfficialHandlerAuthorizationChannel } from './content/official-handler-authorization.js';
import { OfficialHandlerRegistry } from './domain/effects/official-handler-registry.js';
import { createAllClassHandlerRegistrations } from './domain/rulesets/dnd2024/handlers/register-all.js';
import { createOfficialContentRuntime } from './infra/content/official-content-registry.js';

const SCOPE = 'app-context';

/**
 * ContentId da entidade de aliases legados, necessária para montar o
 * repositório. É a MESMA usada por `site/js/store.js` — o valor não é
 * duplicado como "constante nova", é o mesmo fato declarado no pacote.
 * @type {string}
 */
export const LEGACY_ALIAS_ENTITY_ID = 'dnd2024:migration-map:character-v1-aliases';

/**
 * `fetchFn` padrão de produção: um wrapper fino sobre o `fetch` do ambiente,
 * resolvido só na hora da chamada (nunca no carregamento do módulo), para que
 * os testes possam injetar o próprio `fetchFn` sem depender de global nenhum.
 * @param {*} input
 * @param {*} init
 * @returns {Promise<*>}
 */
function defaultFetch(input, init) {
  return fetch(input, init);
}

/**
 * Cria o registry REAL de handlers oficiais desta tarefa.
 *
 * Recebe SOMENTE `verify` (nunca `issue`): quem executa handler não consegue
 * emitir a própria autorização. O registry devolvido não tem `invoke()`
 * público — só `register` e `invokeAuthorized` (ver
 * `domain/effects/official-handler-registry.js`).
 *
 * @param {Function} verify - `verify(authorization, scope)` do canal.
 * @param {ReadonlyArray<{handlerId: string, handler: Function}>} [handlers]
 * @returns {Readonly<{register: Function, invokeAuthorized: Function}>}
 */
export function createOfficialHandlerRegistry(verify, handlers = []) {
  if (typeof verify !== 'function') {
    throw new TypeError('createOfficialHandlerRegistry: "verify" deve ser uma função.');
  }
  const registry = OfficialHandlerRegistry({ verifyAuthorization: verify });
  for (const entry of handlers) {
    const registered = registry.register(entry?.handlerId, entry?.handler);
    // Registro é configuração do composition root, não conteúdo: um registro
    // recusado é defeito de programação e precisa falhar alto.
    if (registered.ok !== true) {
      throw new TypeError(
        `createOfficialHandlerRegistry: registro recusado (${registered.error.code}) para "${String(entry?.handlerId)}".`,
      );
    }
  }
  return registry;
}

/**
 * Cria um contexto de aplicação.
 *
 * A inicialização do catálogo é LAZY (só acontece na primeira chamada de
 * `initializeContent()`) e memoizada; uma falha invalida a memoização, para que
 * um erro transitório de rede possa ser retentado.
 *
 * @param {{
 *   fetchFn?: Function,
 *   createContentRuntime?: Function,
 *   createHandlerRegistry?: Function,
 *   officialHandlers?: ReadonlyArray<{handlerId: string, handler: Function}>
 * }} [options] - pontos de injeção para teste. Em produção nada é passado.
 * @returns {Readonly<object>}
 */
export function createAppContext({
  fetchFn = defaultFetch,
  createContentRuntime = createOfficialContentRuntime,
  createHandlerRegistry = createOfficialHandlerRegistry,
  officialHandlers = createAllClassHandlerRegistrations(),
  storage,
  clock,
  createCharacterRepository = LocalStorageCharacterRepository,
  createSyncQueuePort = createSyncQueue,
} = {}) {
  // --- Capacidade e canal: criados aqui e em nenhum outro lugar ------------
  const capabilities = createOfficialSourceCapabilities();
  const { issue, verify } = createOfficialHandlerAuthorizationChannel();

  // O executor recebe só `verify`; o emissor (`issue`) nunca chega até ele.
  const handlerRegistry = createHandlerRegistry(verify, officialHandlers);

  /** @type {Promise<import('./core/result.js').Result> | null} */
  let pendingInitialization = null;
  /** @type {object | null} */
  let registry = null;
  /** @type {object | null} */
  let officialHandlerInvoker = null;

  /**
   * Ativa o catálogo de conteúdo oficial (idempotente).
   *
   * @param {{signal?: AbortSignal}} [params] - `signal` é repassado ao
   *   `fetchFn`; a fonte de conteúdo não conhece `AbortSignal` diretamente.
   * @returns {Promise<import('./core/result.js').Result>} `ok(ContentRegistry)`
   */
  function initializeContent({ signal } = {}) {
    if (registry !== null) {
      return Promise.resolve({ ok: true, value: registry });
    }
    if (pendingInitialization !== null) {
      return pendingInitialization;
    }

    /**
     * `fetchFn` desta ativação: injeta o `AbortSignal` sem que a fonte precise
     * saber que ele existe.
     * @param {*} input
     * @param {*} init
     * @returns {Promise<*>}
     */
    const fetchWithSignal = (input, init) =>
      fetchFn(input, signal === undefined ? init : { ...(init ?? {}), signal });

    const pending = (async () => {
      let result;
      try {
        result = await createContentRuntime({
          fetchFn: fetchWithSignal,
          handlerRegistry,
          capabilities,
          issueOfficialHandlerAuthorization: issue,
        });
      } catch (cause) {
        return err(
          createAppError({
            code: 'APP_CONTEXT_CONTENT_INITIALIZATION_FAILED',
            scope: SCOPE,
            message: 'A montagem do runtime de conteúdo oficial lançou uma exceção.',
            context: {},
            cause,
          }),
        );
      }
      if (!result || result.ok !== true) {
        return result ?? err(
          createAppError({
            code: 'APP_CONTEXT_CONTENT_INITIALIZATION_FAILED',
            scope: SCOPE,
            message: 'A montagem do runtime de conteúdo oficial não devolveu um Result.',
            context: {},
          }),
        );
      }
      registry = result.value.registry;
      officialHandlerInvoker = result.value.officialHandlerInvoker;
      return { ok: true, value: registry };
    })();

    pendingInitialization = pending;
    // Falha não fica memoizada: libera a memoização para permitir retry.
    pending.then(
      (result) => {
        if (!result || result.ok !== true) {
          pendingInitialization = null;
        }
      },
      () => {
        pendingInitialization = null;
      },
    );
    return pending;
  }

  /**
   * Devolve o catálogo já ativo, ou `null` antes da inicialização.
   * @returns {object | null}
   */
  function getContentRegistry() {
    return registry;
  }

  /**
   * Devolve a porta de invocação de handlers oficiais (separada do catálogo),
   * ou `null` antes da inicialização.
   * @returns {object | null}
   */
  function getOfficialHandlerInvoker() {
    return officialHandlerInvoker;
  }

  // --- Portas de persistência (Task 25) -----------------------------------
  //
  // Cada uma é montada UMA única vez. `pending*` memoiza a inicialização em
  // curso; uma falha NÃO fica memoizada (mesma disciplina de
  // `initializeContent`), para que um erro transitório possa ser retentado.

  /** @type {Promise<import('./core/result.js').Result> | null} */
  let pendingRepository = null;
  /** @type {object | null} */
  let characterRepository = null;
  /** @type {object | null} */
  let aliasResolver = null;
  /** @type {Promise<import('./core/result.js').Result> | null} */
  let pendingSyncQueue = null;
  /** @type {object | null} */
  let syncQueue = null;

  /**
   * Resolve o storage a usar: o injetado, ou o `localStorage` do ambiente
   * (lido só na hora da chamada, nunca na carga do módulo). A ausência é um
   * erro nomeado — nunca um stub silencioso.
   * @returns {object | null}
   */
  function resolveStorage() {
    if (storage !== undefined && storage !== null) {
      return storage;
    }
    return typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null;
  }

  /**
   * Monta (uma única vez) o repositório local de personagens.
   *
   * @param {{signal?: AbortSignal, safetyExportAuthorization?: object}} [params]
   * @returns {Promise<import('./core/result.js').Result>} `ok(repository)`
   */
  function initializeCharacterRepository({ signal, safetyExportAuthorization } = {}) {
    if (characterRepository !== null) {
      return Promise.resolve(ok(characterRepository));
    }
    if (pendingRepository !== null) {
      return pendingRepository;
    }

    const pending = (async () => {
      const activeStorage = resolveStorage();
      if (activeStorage === null || typeof activeStorage.getItem !== 'function') {
        return err(
          createAppError({
            code: 'APP_CONTEXT_STORAGE_UNAVAILABLE',
            scope: SCOPE,
            message: 'Nenhum storage utilizável: o repositório local de personagens não pode ser montado.',
            context: {},
          }),
        );
      }
      const contentResult = await initializeContent({ signal });
      if (!contentResult || contentResult.ok !== true) {
        return contentResult;
      }
      const aliasEntity = contentResult.value?.get?.(LEGACY_ALIAS_ENTITY_ID) ?? null;
      if (aliasEntity === null) {
        return err(
          createAppError({
            code: 'APP_CONTEXT_ALIAS_ENTITY_MISSING',
            scope: SCOPE,
            message: `Entidade de aliases legados "${LEGACY_ALIAS_ENTITY_ID}" ausente no catálogo.`,
            context: { entityId: LEGACY_ALIAS_ENTITY_ID },
          }),
        );
      }

      let repository;
      try {
        aliasResolver = createLegacyAliasResolver(aliasEntity);
        repository = createCharacterRepository({
          storage: activeStorage,
          aliasResolver,
          backupService: createPreMigrationBackupService({ storage: activeStorage }),
          clock,
        });
      } catch (cause) {
        aliasResolver = null;
        return err(
          createAppError({
            code: 'APP_CONTEXT_REPOSITORY_INITIALIZATION_FAILED',
            scope: SCOPE,
            message: 'A montagem do repositório local de personagens lançou uma exceção.',
            context: {},
            cause,
          }),
        );
      }

      if (typeof repository.initialize === 'function') {
        const initialized = repository.initialize({ safetyExportAuthorization });
        if (!initialized || initialized.ok !== true) {
          aliasResolver = null;
          return initialized;
        }
      }
      characterRepository = repository;
      return ok(repository);
    })();

    pendingRepository = pending;
    pending.then(
      (result) => {
        if (!result || result.ok !== true) {
          pendingRepository = null;
        }
      },
      () => {
        pendingRepository = null;
      },
    );
    return pending;
  }

  /**
   * Monta (uma única vez) a fila de sincronização.
   *
   * O `gateway` é obrigatório e vem de fora: ele carrega o `uid` da sessão
   * autenticada, que este módulo não conhece e não deve inventar. Sem ele a
   * fila não existe — e dizer isso é mais honesto do que enfileirar mutações
   * que nunca sairiam.
   *
   * @param {{gateway: object, connectivity: object, scheduler: object, signal?: AbortSignal}} params
   * @returns {Promise<import('./core/result.js').Result>} `ok(syncQueue)`
   */
  function initializeSyncQueue({ gateway, connectivity, scheduler, signal } = {}) {
    if (syncQueue !== null) {
      return Promise.resolve(ok(syncQueue));
    }
    // A memoização precisa cobrir a inicialização EM CURSO, não só o
    // resultado. Esta função tem um `await` no meio (o repositório): checar
    // apenas `syncQueue !== null` deixaria duas chamadas concorrentes
    // atravessarem a guarda antes de qualquer uma atribuir, e o app acabaria
    // com DUAS filas sobre o mesmo storage e o mesmo gateway — cada uma
    // agendando flush do mesmo backlog, duplicando mutações no remoto.
    // Mesmo padrão de `pendingRepository`/`pendingInitialization`.
    if (pendingSyncQueue !== null) {
      return pendingSyncQueue;
    }
    if (!gateway || typeof gateway.upsert !== 'function') {
      return Promise.resolve(
        err(
          createAppError({
            code: 'APP_CONTEXT_SYNC_GATEWAY_UNAVAILABLE',
            scope: SCOPE,
            message: 'A fila de sincronização exige um gateway remoto (sessão autenticada).',
            context: {},
          }),
        ),
      );
    }

    const pending = (async () => {
      const repositoryResult = await initializeCharacterRepository({ signal });
      if (repositoryResult.ok !== true) {
        return repositoryResult;
      }
      const activeStorage = resolveStorage();
      const resolvedAliasResolver = aliasResolver;
      let queue;
      try {
        queue = createSyncQueuePort({
          storage: activeStorage,
          gateway,
          characterRepository: repositoryResult.value,
          connectivity,
          scheduler,
          codec: {
            /**
             * @param {*} rawRecord
             * @returns {object}
             */
            decode: (rawRecord) =>
              decodeCharacterRecord(rawRecord, {
                aliasResolver: resolvedAliasResolver,
                now: typeof clock?.now === 'function' ? clock.now() : new Date().toISOString(),
              }),
          },
          clock,
        });
      } catch (cause) {
        return err(
          createAppError({
            code: 'APP_CONTEXT_SYNC_QUEUE_INITIALIZATION_FAILED',
            scope: SCOPE,
            message: 'A montagem da fila de sincronização lançou uma exceção.',
            context: {},
            cause,
          }),
        );
      }
      syncQueue = queue;
      return ok(queue);
    })();

    pendingSyncQueue = pending;
    // Falha não fica memoizada: libera para retry, igual ao repositório.
    pending.then(
      (result) => {
        if (!result || result.ok !== true) {
          pendingSyncQueue = null;
        }
      },
      () => {
        pendingSyncQueue = null;
      },
    );
    return pending;
  }

  /**
   * Devolve o repositório já montado, ou `null`.
   * @returns {object | null}
   */
  function getCharacterRepository() {
    return characterRepository;
  }

  /**
   * Devolve a fila de sincronização já montada, ou `null`.
   * @returns {object | null}
   */
  function getSyncQueue() {
    return syncQueue;
  }

  // `issue`, `verify` e `capabilities` NÃO são expostos: ficam no fechamento.
  return Object.freeze({
    initializeContent,
    getContentRegistry,
    getOfficialHandlerInvoker,
    initializeCharacterRepository,
    getCharacterRepository,
    initializeSyncQueue,
    getSyncQueue,
  });
}

/**
 * Contexto padrão da aplicação, usado pelas páginas. Criá-lo não faz I/O
 * nenhum: o catálogo só é carregado no primeiro `initializeContent()`.
 * @type {Readonly<object>}
 */
export const appContext = createAppContext();
