// Módulo `features/sheet/sheet-session`: a SESSÃO da ficha — o personagem
// carregado, o ViewModel projetado, o estado de UI, a fila serial de comandos
// e o protocolo durável de persistência.
//
// É o análogo de `features/creator/creator-session.js` para uma ficha que JÁ
// existe, com três diferenças de fundo:
//
//  1. o criador constrói um rascunho; a ficha MUTA um registro persistido. Por
//     isso todo comando bem-sucedido passa pelo protocolo durável
//     (`infra/sync/durable-character-mutation.js`) desde o primeiro dia, e não
//     só na finalização;
//  2. a navegação por passos vira REDESENHO PARCIAL: `CommandResult.affected`
//     é traduzido por `sheet-command-map.js` em `dirtySections`, e só essas
//     seções são repintadas;
//  3. um registro que o repositório não conseguiu decodificar (schema FUTURO)
//     abre em modo `read-only` — exibível, nunca editável.
//
// ## Generation + AbortSignal
//
// Mesma disciplina da Task 25, e pelo mesmo motivo: `AbortSignal` cancela o
// TRABALHO, mas não impede que uma promise já resolvida entregue seu `.then`.
// Entrar na ficha A, voltar e entrar na ficha B faz o carregamento de A chegar
// depois do de B. A GERAÇÃO é o que garante a correção — o resultado só é
// adotado se a geração ainda for a corrente e a sessão não tiver sido
// descartada.
//
// ## Fila SERIAL de comandos
//
// `dispatch` encadeia em `chain`: dois comandos disparados no MESMO
// milissegundo executam um depois do outro, cada um lendo o
// `expectedRevisionToken` do envelope adotado pelo anterior. Sem isso, os dois
// leriam o mesmo token e o segundo save morreria em
// `CHARACTER_SAVE_REVISION_CONFLICT` — ou, pior, um deles sobrescreveria o
// outro se a precondição fosse relaxada. Serializar aqui é o que torna a
// precondição do repositório suficiente em vez de uma corrida.
//
// ## Falhas: três cenários, três respostas
//
//   a) comando inválido / falha do save LOCAL -> o candidato é DESCARTADO, o
//      estado confirmado permanece, NADA vai para a sincronização, e a falha
//      fica registrada como retentável;
//   b) save local OK + `confirmPrepared` falhando -> `dispatch` devolve
//      SUCESSO local com `syncState: "reconciliation-needed"`. O estado é
//      adotado e renderizado; a sessão NUNCA alega que sincronizou; o retry
//      reconcilia o intent preparado (que continua durável);
//   c) save local OK + enqueue OK + falha REMOTA assíncrona -> chega pela
//      subscription da fila. Não há rollback nenhum: o estado local é válido.
//      A falha entra na lista de retentáveis.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { executeCharacterCommand } from '../../domain/commands/command-dispatcher.js';
import {
  SHEET_MODE,
  SHEET_STATUS,
  SHEET_SYNC_STATES,
  createEmptySheetUiState,
  createSheetSnapshot,
  mergeSheetUiState,
} from './sheet-state.js';
import { resolveDirtySections } from './sheet-command-map.js';
import { buildSheetViewModel } from './sheet-view-model.js';
import { declaresSpellcasting } from './spellcasting-table.js';

const SCOPE = 'features.sheet.session';

/**
 * Motivo registrado no repositório para toda escrita vinda da ficha. O enum é
 * FECHADO pelo repositório (`user` | `migration` | `sync`); editar a ficha é
 * ação do usuário.
 * @type {string}
 */
export const SHEET_SAVE_REASON = 'user';

/**
 * Tipos de falha que a sessão sabe retentar.
 * @type {Readonly<Record<string, string>>}
 */
export const SHEET_FAILURE_KINDS = Object.freeze({
  localCommand: 'local-command',
  reconciliation: 'reconciliation',
  sync: 'sync',
});

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function sessionError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * Cria uma sessão de ficha.
 *
 * @param {{
 *   characterId: string,
 *   registry?: object|null,
 *   officialHandlerInvoker?: object|null,
 *   spellcastingTable?: Function|null,
 *   maximumHitPoints?: Function|null,
 *   repository: {get: Function},
 *   syncQueue?: object|null,
 *   durableMutation?: object|null,
 *   commandDispatcher?: Function,
 *   projectSheet?: Function,
 *   preferences?: object|null,
 *   clock?: {now: () => string}|null,
 *   projectionContext?: (character: object, session: object) => object
 * }} params
 * @returns {Readonly<object>}
 */
export function createSheetSession({
  characterId,
  registry = null,
  // Porta de invocação dos handlers oficiais (Task 30). É parâmetro NOMEADO,
  // ao lado de `registry`, e não uma "dica" enfiada em `projectionContext`:
  // desde que `short-rest`/`long-rest` compõem o `onRest` dos handlers de
  // classe, ela é uma DEPENDÊNCIA REAL da ficha de qualquer personagem que
  // tenha classe — não um extra opcional de projeção. Um composition root que
  // esquecesse de injetá-la faria um descanso que funcionava antes da Task 30
  // passar a falhar com `COMMAND_CLASS_HANDLER_REGISTRY_REQUIRED`, e o lugar
  // certo para tornar isso impossível de esquecer é a assinatura.
  officialHandlerInvoker = null,
  // Porta que produz `context.spellcasting` (Task 33). É parâmetro NOMEADO
  // pelo MESMO motivo que `officialHandlerInvoker` deixou de ser uma "dica" de
  // `projectionContext` na Task 30: os máximos de espaço de magia, o teto de
  // truques e o de magias preparadas são DEPENDÊNCIA REAL da ficha de qualquer
  // conjurador — sem eles todo espaço aparece como desconhecido e `cast-spell`
  // recusa com `SPELL_SLOT_MAXIMUM_UNKNOWN`. Até a Task 33 o único produtor era
  // o harness de teste, injetando por `projectionContext`; um composition root
  // de produção não tinha o que injetar ali. O lugar certo para tornar isso
  // impossível de esquecer é a assinatura.
  //
  // FIX ROUND 1 (revisão independente): a assinatura sozinha não bastava —
  // era um parâmetro OPCIONAL com default `null`, e um composition root novo
  // (ou alternativo) que a omitisse produzia exatamente esta lacuna de novo,
  // em silêncio. `warnMissingSpellcastingProducer` (abaixo) fecha esse
  // silêncio: se o personagem tem classe conjuradora e nem esta porta nem
  // uma dica de `projectionContext` produziram `context.spellcasting`, um
  // `AppError` NOMEADO (`SHEET_SPELLCASTING_PRODUCER_MISSING`) entra em
  // `snapshot.warnings`. Não virou parâmetro OBRIGATÓRIO (que quebraria toda
  // ficha de personagem SEM classe conjuradora, que legitimamente não tem o
  // que injetar aqui) — a recusa é do PERSONAGEM CONJURADOR sem produtor, não
  // da sessão sem porta.
  spellcastingTable = null,
  // Porta que resolve o PV MÁXIMO (Task 33). Mesma classe de
  // `spellcastingTable`, e achada pelo mesmo caminho: era uma dica que só o
  // harness injetava por `projectionContext`, e sem ela a ficha de QUALQUER
  // personagem legado simplesmente não abre
  // (`CHARACTER_QUERY_HP_MAXIMUM_UNKNOWN`). A sessão carrega pelo repositório
  // e nunca vê o registro plano de onde `pv_max` vem, então quem sabe resolvê-lo
  // é o adapter de `infra/character/**`.
  maximumHitPoints = null,
  repository,
  syncQueue = null,
  durableMutation = null,
  commandDispatcher = executeCharacterCommand,
  projectSheet = buildSheetViewModel,
  preferences = null,
  clock = null,
  projectionContext = null,
} = {}) {
  if (typeof characterId !== 'string' || characterId.length === 0) {
    throw new TypeError('createSheetSession: "characterId" é obrigatório.');
  }
  if (repository === null || typeof repository !== 'object' || typeof repository.get !== 'function') {
    throw new TypeError('createSheetSession: "repository" é obrigatório.');
  }
  if (typeof commandDispatcher !== 'function' || typeof projectSheet !== 'function') {
    throw new TypeError('createSheetSession: "commandDispatcher"/"projectSheet" precisam ser funções.');
  }

  // --- Estado PRÓPRIO desta sessão -----------------------------------------
  //
  // Nada aqui é variável de módulo: duas sessões abertas ao mesmo tempo (duas
  // fichas, ou a mesma ficha em dois pontos da tela) não compartilham
  // personagem, ViewModel, UI state, preferências nem listeners.
  /** @type {object|null} */
  let envelope = null;
  /** @type {object|null} */
  let character = null;
  /** @type {object|null} */
  let viewModel = null;
  let mode = SHEET_MODE.editable;
  let status = SHEET_STATUS.idle;
  let uiState = createEmptySheetUiState();
  /** @type {Readonly<object>} */
  let preferenceValues = Object.freeze({ currencyRates: null, purchaseEquippedDefault: false, levelUpFlowV2: false });
  /** @type {ReadonlyArray<string>} */
  let dirtySections = Object.freeze([]);
  let syncState = SHEET_SYNC_STATES.none;
  /** @type {Array<object>} falhas locais retentáveis (cenários a/b). */
  let localFailures = [];
  /** @type {Map<string, () => (Promise<object>|object)>} */
  const retryHandlers = new Map();
  /** @type {ReadonlyArray<object>} falhas vindas da fila (cenário c). */
  let queueFailures = Object.freeze([]);
  /** @type {Array<object>} */
  let warnings = [];
  /** @type {object|null} */
  let lastError = null;
  /** @type {object|null} */
  let readOnlyRecord = null;
  let generation = 0;
  let disposed = false;
  let failureCounter = 0;
  /** @type {AbortController|null} */
  let inFlightController = null;
  /** @type {Array<Function>} */
  let listeners = [];
  /** @type {(() => void)|null} */
  let unsubscribeQueue = null;
  /** Encadeamento SERIAL dos comandos. */
  let chain = Promise.resolve();
  /** @type {Readonly<object>} */
  let snapshot;

  /**
   * Recalcula o snapshot congelado publicado pela sessão.
   * @returns {Readonly<object>}
   */
  function rebuildSnapshot() {
    snapshot = createSheetSnapshot({
      characterId,
      status,
      mode,
      viewModel,
      uiState,
      preferences: preferenceValues,
      dirtySections,
      syncState,
      syncFailures: [...localFailures, ...queueFailures],
      revisionToken: envelope?.revisionToken ?? null,
      generation,
      error: lastError,
      warnings,
    });
    // `readOnlyRecord` viaja fora de `createSheetSnapshot` porque só existe no
    // modo somente-leitura: um registro que não decodificou não tem ViewModel,
    // e a UI precisa de ALGO para exibir sem fingir que é canônico.
    snapshot = Object.freeze({ ...snapshot, readOnlyRecord });
    return snapshot;
  }
  rebuildSnapshot();

  /**
   * Publica o snapshot a todos os inscritos. Um listener que lança não derruba
   * os demais nem a sessão.
   * @returns {Readonly<object>}
   */
  function notify() {
    const published = rebuildSnapshot();
    for (const listener of [...listeners]) {
      try {
        listener(published);
      } catch {
        // Um consumidor quebrado não pode quebrar a sessão nem os outros.
      }
    }
    return published;
  }

  /**
   * `AppError` padrão para uso após `dispose()`.
   * @returns {object}
   */
  function disposedError() {
    return sessionError('SHEET_SESSION_DISPOSED', 'A sessão da ficha já foi descartada.', { characterId });
  }

  /**
   * Registra uma falha RETENTÁVEL e o que fazer para retentá-la.
   * @param {string} kind
   * @param {object} error
   * @param {() => (Promise<object>|object)} handler
   * @returns {string} o `failureId` gerado.
   */
  function registerFailure(kind, error, handler) {
    failureCounter += 1;
    const failureId = `${kind}:${characterId}:${failureCounter}`;
    localFailures = [
      ...localFailures,
      Object.freeze({
        failureId,
        kind,
        characterId,
        code: error?.code ?? 'SHEET_UNKNOWN_FAILURE',
        message: error?.message ?? '',
        retryable: true,
      }),
    ];
    retryHandlers.set(failureId, handler);
    return failureId;
  }

  /**
   * Remove uma falha local já resolvida.
   * @param {string} failureId
   * @returns {void}
   */
  function clearFailure(failureId) {
    localFailures = localFailures.filter((failure) => failure.failureId !== failureId);
    retryHandlers.delete(failureId);
  }

  /**
   * Aborta o carregamento em voo (se houver) e avança a geração, de modo que
   * qualquer resposta ainda a caminho seja descartada ao chegar.
   * @returns {number} a nova geração corrente.
   */
  function invalidateInFlight() {
    if (inFlightController !== null) {
      inFlightController.abort();
      inFlightController = null;
    }
    generation += 1;
    return generation;
  }

  /**
   * Timestamp da porta de relógio (ou do ambiente, quando não há porta).
   * @returns {string}
   */
  function nowIso() {
    return typeof clock?.now === 'function' ? clock.now() : new Date().toISOString();
  }

  /**
   * Lê as preferências do usuário. Uma preferência corrompida NÃO derruba a
   * ficha: o repositório devolve `warnings` e um valor nulo, e é isso que
   * chega ao snapshot — nunca um default de jogo inventado aqui.
   * @returns {void}
   */
  function loadPreferences() {
    if (preferences === null) {
      return;
    }
    const coletados = [];
    /**
     * @param {string} nome
     * @param {*} fallback
     * @returns {*}
     */
    const ler = (nome, fallback) => {
      const fn = preferences[nome];
      if (typeof fn !== 'function') {
        return fallback;
      }
      const result = nome === 'getSheetCollapse' ? fn.call(preferences, characterId) : fn.call(preferences);
      if (!result || result.ok !== true) {
        return fallback;
      }
      coletados.push(...(result.value.warnings ?? []));
      return result.value.value ?? fallback;
    };

    const currencyRates = ler('getCurrencyRates', null);
    const purchaseEquippedDefault = ler('getPurchaseEquippedDefault', false);
    const levelUpFlowV2 = ler('getLevelUpFlowV2', false);
    const collapse = ler('getSheetCollapse', null);

    preferenceValues = Object.freeze({ currencyRates, purchaseEquippedDefault, levelUpFlowV2 });
    warnings = [...warnings, ...coletados];

    // A flag de fluxo de level-up entra TAMBÉM no UI state (Task 30).
    //
    // Não é duplicação por descuido: `createEmptySheetUiState` já documentava
    // que as preferências persistidas "entram por [...] a partir do repositório
    // de preferências", e uma SEÇÃO só recebe `viewModel` e `uiState` — nunca
    // `snapshot.preferences`. Sem esta linha, `feats-progression-section.js`
    // não teria como saber qual das duas vistas de `level-up-flow-view.js`
    // descrever, e escolher uma delas por omissão seria inventar um default de
    // apresentação. `snapshot.preferences` continua sendo a fonte de verdade
    // para quem lê preferências; o UI state carrega a MESMA leitura para quem
    // só enxerga a tela.
    //
    // `purchaseEquippedDefault` entra pelo MESMO canal e pela mesma razão
    // (Task 32): o modal de compra de `inventory-load-coins-section.js` precisa
    // nascer com a caixa "já equipado" no estado que o jogador escolheu
    // (`dnd_comprar_ativo_padrao`), e uma seção não enxerga
    // `snapshot.preferences`. Sem isto, a caixa nasceria sempre desmarcada —
    // um default de apresentação inventado pela vista, contradizendo a
    // preferência gravada.
    const comFlag = mergeSheetUiState(uiState, {
      levelUpFlowV2: levelUpFlowV2 === true,
      purchaseEquippedDefault: purchaseEquippedDefault === true,
    });
    if (comFlag.ok === true) {
      uiState = comFlag.value;
    }

    if (collapse !== null && typeof collapse === 'object') {
      // O colapso persistido é PREFERÊNCIA, e entra no UI state — nunca no
      // personagem. É por isso que ele sobrevive a um reload sem tocar em
      // nenhum byte do registro, e por isso a chave é `sheet_collapse_<id>`:
      // uma ficha não herda o colapso de outra.
      const merged = mergeSheetUiState(uiState, { collapsed: filtrarColapso(collapse) });
      if (merged.ok === true) {
        uiState = merged.value;
      }
    }
  }

  /**
   * Mantém do mapa de colapso persistido apenas as chaves que são seções
   * conhecidas. Uma chave desconhecida (resíduo de versão antiga) é
   * descartada em vez de virar erro — mas nunca cria seção nova.
   * @param {object} collapse
   * @returns {object}
   */
  function filtrarColapso(collapse) {
    const filtrado = {};
    for (const [key, value] of Object.entries(collapse)) {
      const teste = mergeSheetUiState(createEmptySheetUiState(), { collapsed: { [key]: value === true } });
      if (teste.ok === true) {
        filtrado[key] = value === true;
      }
    }
    return filtrado;
  }

  /**
   * Contexto entregue às consultas/comandos. É sempre um objeto NOVO e
   * congelado: nenhum handler consegue guardar a referência e mutar o estado
   * da sessão por ela.
   * @returns {Readonly<object>}
   */
  function buildContext() {
    // `projectionContext` ACRESCENTA ao contexto base em vez de substituí-lo:
    // o que ele traz são as dicas que só o composition root sabe (hoje,
    // `maximumHitPoints` — a derivação por ruleset ainda não existe, ver
    // concern da Task 16), não uma segunda definição de registry/relógio.
    const extras = typeof projectionContext === 'function' ? projectionContext(character, { characterId, preferences: preferenceValues }) : null;
    const base = {
      registry,
      officialHandlerInvoker,
      now: nowIso(),
      currencyRates: preferenceValues.currencyRates,
    };
    // A tabela de conjuração entra ANTES dos extras: um teste (ou o harness)
    // que fixe `spellcasting` por `projectionContext` continua vencendo, mesma
    // precedência que todas as demais dicas já têm.
    const table = resolveSpellcastingTable();
    if (table !== null) {
      base.spellcasting = table;
    }
    if (typeof maximumHitPoints === 'function' && character !== null) {
      const resolvido = maximumHitPoints(character, base);
      if (typeof resolvido === 'number' && Number.isFinite(resolvido)) {
        base.maximumHitPoints = resolvido;
      }
    }
    const merged = Object.freeze({
      ...base,
      ...(extras !== null && typeof extras === 'object' ? extras : {}),
    });
    warnMissingSpellcastingProducer(merged);
    return merged;
  }

  /**
   * Achado da revisão do Fix round 1 (Task 33): a ausência de PORTA para
   * `context.spellcasting` (nem `spellcastingTable`, nem uma dica de
   * `projectionContext`) não podia ficar sem sinal nenhum para um personagem
   * de classe CONJURADORA — o jogador via os espaços de magia como
   * "desconhecidos" sem NADA no snapshot explicando o motivo. Um personagem
   * SEM classe conjuradora (`declaresSpellcasting` devolve `false`) continua
   * mudo aqui: para ele a ausência é o comportamento correto, não uma lacuna
   * de wiring.
   *
   * Não lança nem recusa o comando — mesma disciplina de
   * `resolveSpellcastingTable`: a ficha continua utilizável (espaços
   * indisponíveis, nunca um crash), só que agora com um `AppError` NOMEADO em
   * `snapshot.warnings`, registrado uma única vez por código.
   * @param {Readonly<object>} context - o contexto já mesclado (porta + dicas).
   * @returns {void}
   */
  function warnMissingSpellcastingProducer(context) {
    if (context.spellcasting !== undefined || character === null) {
      return;
    }
    if (!declaresSpellcasting(character, registry)) {
      return;
    }
    const problem = sessionError(
      'SHEET_SPELLCASTING_PRODUCER_MISSING',
      'O personagem tem classe conjuradora, mas nenhuma porta produziu "context.spellcasting" (nem "spellcastingTable", nem uma dica de "projectionContext"); os espaços de magia, truques e magias preparadas aparecerão como desconhecidos.',
      { characterId },
    );
    if (!warnings.some((aviso) => aviso?.code === problem.code)) {
      warnings = [...warnings, problem];
    }
  }

  /**
   * Executa a porta `spellcastingTable`, se houver.
   *
   * Uma FALHA aqui não derruba a ficha: sem tabela, os espaços aparecem como
   * desconhecidos (que é o comportamento honesto), e o motivo entra em
   * `snapshot.warnings` uma única vez por código — nunca um bypass silencioso,
   * nunca um aviso repetido a cada comando.
   * @returns {object|null} a tabela, ou `null` quando não há porta/tabela.
   */
  function resolveSpellcastingTable() {
    if (typeof spellcastingTable !== 'function' || character === null) {
      return null;
    }
    let produced;
    try {
      produced = spellcastingTable(character);
    } catch (cause) {
      produced = err(sessionError('SHEET_SPELLCASTING_TABLE_THREW', 'O produtor da tabela de conjuração lançou uma exceção.', { characterId }, cause));
    }
    if (produced && produced.ok === true) {
      return produced.value ?? null;
    }
    const problem =
      produced?.error ?? sessionError('SHEET_SPELLCASTING_TABLE_FAILED', 'O produtor da tabela de conjuração não devolveu um Result.', { characterId });
    if (!warnings.some((aviso) => aviso?.code === problem.code)) {
      warnings = [...warnings, problem];
    }
    return null;
  }

  /**
   * Reprojeta o ViewModel a partir do personagem confirmado.
   * @returns {import('../../core/result.js').Result}
   */
  function reproject() {
    const projected = projectSheet(character, buildContext());
    if (!projected || projected.ok !== true) {
      return projected ?? err(sessionError('SHEET_PROJECTION_FAILED', 'A projeção da ficha não devolveu um Result.', { characterId }));
    }
    viewModel = projected.value;
    return ok(viewModel);
  }

  /**
   * Liga a sessão à fila de sincronização para receber as falhas REMOTAS
   * assíncronas (cenário c). Elas nunca provocam rollback: o estado local já
   * é válido e adotado; o que a fila traz é a informação de que o envio não
   * chegou, mais o `failureId` para retentar.
   * @returns {void}
   */
  function bindSyncQueue() {
    if (syncQueue === null || typeof syncQueue.subscribe !== 'function' || unsubscribeQueue !== null) {
      return;
    }
    unsubscribeQueue = syncQueue.subscribe((queueSnapshot) => {
      if (disposed) {
        return;
      }
      queueFailures = Object.freeze(
        (queueSnapshot?.failures ?? [])
          .filter((failure) => failure.characterId === characterId)
          .map((failure) => Object.freeze({ ...failure, kind: SHEET_FAILURE_KINDS.sync })),
      );
      notify();
    });
  }

  // --- API pública ---------------------------------------------------------

  /**
   * Carrega o personagem e projeta a ficha.
   *
   * Quatro desfechos, todos explícitos:
   *   - registro editável -> `status: ready`, `mode: editable`, ViewModel pronto;
   *   - registro ausente  -> `SHEET_CHARACTER_NOT_FOUND`;
   *   - schema FUTURO     -> `status: ready`, `mode: read-only`, sem ViewModel
   *                          (o registro cru viaja em `snapshot.readOnlyRecord`);
   *   - referência quebrada (uma consulta não resolve algo do catálogo) ->
   *     `status: error` com o `AppError` original da consulta, nunca um
   *     ViewModel parcial.
   * @param {{signal?: AbortSignal}} [options]
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function initialize({ signal } = {}) {
    if (disposed) {
      return err(disposedError());
    }

    const myGeneration = invalidateInFlight();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    inFlightController = controller;
    if (signal && typeof signal.addEventListener === 'function' && controller !== null) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    status = SHEET_STATUS.loading;
    lastError = null;
    notify();

    loadPreferences();

    let loaded;
    try {
      loaded = await Promise.resolve(repository.get(characterId));
    } catch (cause) {
      loaded = err(sessionError('SHEET_CHARACTER_LOAD_THREW', 'A leitura do personagem lançou uma exceção.', { characterId }, cause));
    }

    // --- A GUARDA. Nada depois daqui vale para uma geração antiga. ---------
    if (disposed || myGeneration !== generation) {
      return err(
        sessionError('SHEET_INIT_STALE', 'O carregamento da ficha foi descartado por ser de uma geração anterior.', {
          characterId,
          loadGeneration: myGeneration,
          currentGeneration: generation,
        }),
      );
    }
    inFlightController = null;

    if (!loaded || loaded.ok !== true) {
      lastError = loaded?.error ?? sessionError('SHEET_CHARACTER_LOAD_FAILED', 'A leitura do personagem não devolveu um Result.', { characterId });
      status = SHEET_STATUS.error;
      notify();
      return err(lastError);
    }
    if (loaded.value === null || loaded.value === undefined) {
      lastError = sessionError('SHEET_CHARACTER_NOT_FOUND', `Não há personagem com id "${characterId}".`, { characterId });
      status = SHEET_STATUS.error;
      notify();
      return err(lastError);
    }

    envelope = loaded.value;
    warnings = [...warnings, ...(envelope.warnings ?? [])];

    if (envelope.mode !== SHEET_MODE.editable) {
      mode = SHEET_MODE.readOnly;
      character = null;
      viewModel = null;
      readOnlyRecord = envelope.rawRecord ?? null;
      status = SHEET_STATUS.ready;
      dirtySections = Object.freeze([]);
      bindSyncQueue();
      return ok(notify());
    }

    mode = SHEET_MODE.editable;
    character = envelope.character;
    readOnlyRecord = null;
    const projected = reproject();
    if (projected.ok !== true) {
      lastError = projected.error;
      status = SHEET_STATUS.error;
      viewModel = null;
      notify();
      return err(lastError);
    }

    status = SHEET_STATUS.ready;
    dirtySections = Object.freeze([]);
    bindSyncQueue();
    return ok(notify());
  }

  /**
   * @returns {Readonly<object>} o snapshot congelado atual.
   */
  function getSnapshot() {
    return snapshot;
  }

  /**
   * Despacha um comando canônico (`domain/commands/**`).
   *
   * SERIAL por construção: o comando entra no fim de `chain` e só executa
   * quando o anterior terminou de adotar (ou de falhar). É isso que faz o
   * `expectedRevisionToken` lido em `runDispatch` ser sempre o do estado
   * confirmado mais recente.
   * @param {object} command
   * @returns {Promise<import('../../core/result.js').Result>} Result<{snapshot, dirtySections, events}, AppError>
   */
  function dispatch(command) {
    const executar = () => runDispatch(command);
    const resultado = chain.then(executar, executar);
    // `chain` nunca carrega rejeição: uma falha de um comando não pode
    // envenenar a fila e impedir os seguintes de rodarem.
    chain = resultado.then(
      () => undefined,
      () => undefined,
    );
    return resultado;
  }

  /**
   * Corpo de um `dispatch` (já serializado).
   * @param {object} command
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function runDispatch(command) {
    if (disposed) {
      return err(disposedError());
    }
    if (mode !== SHEET_MODE.editable || character === null) {
      return err(
        sessionError('SHEET_READ_ONLY', 'Esta ficha está em modo somente leitura; nenhum comando é aceito.', {
          characterId,
          mode,
          status,
        }),
      );
    }

    let commandResult;
    try {
      commandResult = commandDispatcher(character, command, buildContext());
    } catch (cause) {
      return err(sessionError('SHEET_COMMAND_THREW', 'O despacho do comando lançou uma exceção.', { characterId }, cause));
    }
    if (!commandResult || typeof commandResult.ok !== 'boolean' || !Array.isArray(commandResult.affected)) {
      return err(sessionError('SHEET_COMMAND_CONTRACT_VIOLATION', 'O dispatcher não devolveu um CommandResult.', { characterId }));
    }
    if (commandResult.ok !== true) {
      // CANDIDATO DESCARTADO. O personagem confirmado continua exatamente como
      // estava, nada é salvo e nada vai para a fila.
      return err(commandResult.error ?? sessionError('SHEET_COMMAND_FAILED', 'O comando falhou sem erro estruturado.', { characterId }));
    }

    // O mapa é consultado ANTES de qualquer escrita: um path canônico sem
    // seção registrada é falha explícita, nunca um `dirtySections` vazio que
    // salvaria a mudança e deixaria a tela mentindo.
    const dirty = resolveDirtySections(commandResult.affected);
    if (dirty.ok !== true) {
      return dirty;
    }

    if (commandResult.affected.length === 0) {
      // No-op idempotente (ex.: reverter uma edição inexistente). Nada mudou,
      // então nada é salvo — mas é SUCESSO, não erro.
      return ok(Object.freeze({ snapshot: getSnapshot(), dirtySections: Object.freeze([]), events: commandResult.events }));
    }

    const mutation = durableMutation;
    if (mutation === null || typeof mutation.save !== 'function') {
      return err(
        sessionError(
          'SHEET_PERSISTENCE_UNAVAILABLE',
          'A ficha exige o protocolo durável (repositório + fila) para aceitar comandos; sem ele nada é salvo.',
          { characterId },
        ),
      );
    }

    let saved;
    try {
      saved = mutation.save(commandResult.character, {
        expectedRevisionToken: envelope?.revisionToken ?? null,
        reason: SHEET_SAVE_REASON,
      });
    } catch (cause) {
      saved = err(sessionError('SHEET_SAVE_THREW', 'A persistência do personagem lançou uma exceção.', { characterId }, cause));
    }

    if (!saved || saved.ok !== true) {
      // Falha de PREPARO ou de gravação LOCAL. O candidato é descartado, o
      // estado confirmado é mantido e nenhum job enviável existe — o protocolo
      // durável já abortou o preparo. O retry redispara o MESMO comando sobre
      // o estado confirmado (nunca sobre o candidato perdido).
      const problem = saved?.error ?? sessionError('SHEET_SAVE_FAILED', 'A persistência não devolveu um Result.', { characterId });
      const failureId = registerFailure(SHEET_FAILURE_KINDS.localCommand, problem, () => dispatch(command));
      lastError = problem;
      notify();
      return err(
        sessionError(problem.code, problem.message, { ...(problem.context ?? {}), characterId, failureId, retryable: true }, problem.cause),
      );
    }

    // --- ADOÇÃO -------------------------------------------------------------
    envelope = saved.value.envelope;
    character = envelope.character;
    syncState = saved.value.syncState;
    lastError = null;

    const projected = reproject();
    if (projected.ok !== true) {
      lastError = projected.error;
      status = SHEET_STATUS.error;
      notify();
      return err(lastError);
    }

    if (syncState === SHEET_SYNC_STATES.reconciliationNeeded) {
      // Salvo LOCALMENTE, sincronização pendente. O estado é adotado e
      // renderizado; a sessão não alega em momento nenhum que sincronizou. O
      // retry reconcilia o intent PREPARADO (que continua durável) — nunca
      // regrava o personagem, que já está salvo.
      registerFailure(
        SHEET_FAILURE_KINDS.reconciliation,
        sessionError('SHEET_SYNC_RECONCILIATION_NEEDED', 'Alteração salva localmente; a sincronização ficou pendente.', { characterId }),
        () =>
          typeof syncQueue?.reconcilePrepared === 'function'
            ? syncQueue.reconcilePrepared()
            : err(
                sessionError(
                  'SHEET_RETRY_UNAVAILABLE',
                  'A fila não oferece reconciliação; a retomada acontecerá no próximo boot.',
                  { characterId },
                ),
              ),
      );
    }

    dirtySections = dirty.value;
    status = SHEET_STATUS.ready;
    const published = notify();
    return ok(Object.freeze({ snapshot: published, dirtySections, events: commandResult.events }));
  }

  /**
   * Retenta uma falha registrada.
   *
   * Três origens, um só ponto de entrada: falha de comando local (redispara o
   * comando), reconciliação pendente (promove o intent preparado) e falha
   * remota da fila (`syncQueue.retry`).
   * @param {string} failureId
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function retry(failureId) {
    if (disposed) {
      return err(disposedError());
    }
    const local = retryHandlers.get(failureId);
    if (local !== undefined) {
      const resultado = await local();
      if (resultado && resultado.ok === true) {
        clearFailure(failureId);
        notify();
      }
      return resultado && resultado.ok === true ? ok(getSnapshot()) : resultado;
    }

    const daFila = queueFailures.find((failure) => failure.failureId === failureId);
    if (daFila !== undefined && typeof syncQueue?.retry === 'function') {
      const resultado = await syncQueue.retry(failureId);
      // Sem rollback: o estado local permanece adotado, dê no que der.
      return resultado && resultado.ok === true ? ok(getSnapshot()) : resultado;
    }

    return err(sessionError('SHEET_RETRY_NOT_FOUND', `Não há falha retentável com o id "${String(failureId)}".`, { characterId, failureId }));
  }

  /**
   * Aplica um patch ao estado de UI (colapso de seção, foco, modal aberto).
   *
   * TRÊS chaves do patch são PERSISTIDAS como preferência, nunca no personagem
   * (uma preferência de tela não pode virar byte do registro nem disparar
   * sincronização):
   *
   *   - `collapsed` -> `sheet_collapse_<id>`;
   *   - `levelUpFlowV2` -> `feature.levelup.flow.v2` (Task 30);
   *   - `purchaseEquippedDefault` -> `dnd_comprar_ativo_padrao` (Task 32).
   *
   * A segunda existe porque o botão "Ativar V2 e continuar" do fluxo de
   * level-up PRECISA gravar de verdade: no baseline
   * (`site/js/pages/sheet.js#salvarFlagLevelUpFlowV2`) ele escreve no
   * localStorage, e sem isso o jogador religa a flag, fecha o modal, clica
   * "Subir de Nível" outra vez e volta ao aviso "V2 desativado" — um botão que
   * PARECE funcionar (o modal reabre em cards) e não funciona. O oráculo de DOM
   * não pegaria isso, porque compara árvore e não efeito.
   * @param {object} patch
   * @returns {import('../../core/result.js').Result} Result<SheetSnapshot, AppError>
   */
  function setUiState(patch) {
    if (disposed) {
      return err(disposedError());
    }
    const merged = mergeSheetUiState(uiState, patch);
    if (merged.ok !== true) {
      return merged;
    }
    uiState = merged.value;

    if (patch !== null && typeof patch === 'object' && Object.hasOwn(patch, 'collapsed') && typeof preferences?.setSheetCollapse === 'function') {
      const written = preferences.setSheetCollapse(characterId, uiState.collapsed);
      if (written.ok !== true) {
        warnings = [...warnings, written.error];
      }
    }

    // Simetria com a leitura acima (Task 32): a preferência de "comprar já
    // equipado" é PERSISTIDA quando muda, como o baseline faz
    // (`dnd_comprar_ativo_padrao`). Sem esta metade, o UI state e o
    // `localStorage` divergiriam no primeiro clique — exatamente o defeito que
    // a Task 30 corrigiu para `levelUpFlowV2`.
    if (patch !== null && typeof patch === 'object' && Object.hasOwn(patch, 'purchaseEquippedDefault')) {
      const valor = patch.purchaseEquippedDefault === true;
      preferenceValues = Object.freeze({ ...preferenceValues, purchaseEquippedDefault: valor });
      if (typeof preferences?.setPurchaseEquippedDefault === 'function') {
        const written = preferences.setPurchaseEquippedDefault(valor);
        if (written !== null && written !== undefined && written.ok !== true) {
          warnings = [...warnings, written.error];
        }
      }
    }

    if (patch !== null && typeof patch === 'object' && Object.hasOwn(patch, 'levelUpFlowV2')) {
      const valor = patch.levelUpFlowV2 === true;
      // `snapshot.preferences` é a fonte de verdade para quem lê preferências;
      // ela não pode ficar contando uma história diferente do UI state.
      preferenceValues = Object.freeze({ ...preferenceValues, levelUpFlowV2: valor });
      if (typeof preferences?.setLevelUpFlowV2 === 'function') {
        const written = preferences.setLevelUpFlowV2(valor);
        if (written !== null && written !== undefined && written.ok !== true) {
          warnings = [...warnings, written.error];
        }
      }
    }
    // Mudança de UI não suja seção nenhuma por comando: o controller repinta
    // o que ele mesmo decidir a partir do UI state. E é por isso que
    // `dirtySections` é ZERADO aqui.
    //
    // Sem esta linha o campo era só "não acrescentado": ele continuava com a
    // lista do ÚLTIMO comando, e o snapshot publicado por uma simples mudança
    // de tela mandava o controller repintar aquelas seções de novo. Isso
    // quebrava um GESTO em andamento: `dragstart` emite `sheet/ui-state` para
    // guardar o item arrastado, e o repaint que vinha junto trocava o corpo da
    // seção de inventário NO MEIO do arrasto — o `dragend` disparava num nó já
    // desmontado, não chegava à delegação da raiz, e `draggingInstanceId`
    // ficava ÓRFÃO. O próximo `drop` (mesmo de um payload que não é nosso:
    // arquivo, texto, arrasto de outra origem) reaproveitava esse id e emitia
    // um `reorder-inventory` real e errado.
    //
    // É a mesma lição da Task 28b: estado de tela não pode ser perdido nem
    // provocar repaint no meio de um gesto de ponteiro.
    dirtySections = Object.freeze([]);
    return ok(notify());
  }

  /**
   * Inscreve um listener. Devolve o disposer, idempotente.
   * @param {Function} listener
   * @returns {() => void}
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('SheetSession.subscribe: "listener" deve ser uma função.');
    }
    listeners.push(listener);
    let removed = false;
    return () => {
      if (removed) {
        return;
      }
      removed = true;
      listeners = listeners.filter((entry) => entry !== listener);
    };
  }

  /**
   * Descarta a sessão: aborta o carregamento em voo, avança a geração (o que
   * faz qualquer comando em fila recusar), solta a assinatura da fila e todos
   * os listeners. Idempotente.
   * @returns {void}
   */
  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    invalidateInFlight();
    if (unsubscribeQueue !== null) {
      unsubscribeQueue();
      unsubscribeQueue = null;
    }
    listeners = [];
    retryHandlers.clear();
  }

  /**
   * @returns {boolean} `true` depois de `dispose()`.
   */
  function isDisposed() {
    return disposed;
  }

  return Object.freeze({
    initialize,
    getSnapshot,
    dispatch,
    retry,
    setUiState,
    subscribe,
    dispose,
    isDisposed,
  });
}
