// ============================================================
// Módulo de sincronização em nuvem — FACHADA
//
// Toda a lógica de fila (persistência, migração do formato legado, escopo
// por uid, protocolo de preparo, merge, retry, status) vive agora em
// `infra/sync/sync-queue.js`, testável sem rede/DOM/SDK. Este arquivo
// preserva exatamente as exportações que o app legado já consome
// (`enfileirarSync`, `enfileirarRemocao`, `obterIdsPendentesRemocao`,
// `processarFilaSync`, `inicializarSync`, `getSyncStatus`,
// `onSyncStatusChange`) e os mesmos status observáveis
// (`idle | sincronizando | ok | erro | offline`).
//
// A fila só existe quando há um usuário autenticado E o armazenamento
// local de personagens já foi inicializado (é `store.js` que registra o
// contexto via `registrarContextoPersonagens`). Sem uma das duas coisas o
// status permanece `idle`, exatamente como antes.
//
// O gateway é PREGUIÇOSO: seu `uid` é lido de forma síncrona da sessão
// atual (para a fila decidir na hora o que é dela e o que está em
// quarentena), mas o SDK do Firestore só é carregado da CDN quando uma
// operação de rede acontece de fato. É isso que mantém `enfileirarSync`
// síncrono e durável (persiste antes de retornar) mesmo estando offline.
// ============================================================
import { getUsuario, obterGatewayPersonagens } from './auth.js';
import { createSyncQueue } from './infra/sync/sync-queue.js';
import { ok, err } from './core/result.js';
import { createAppError } from './core/errors.js';

const SCOPE = 'sync';

// Status possíveis: 'idle' | 'sincronizando' | 'ok' | 'erro' | 'offline'
let _status = 'idle';
let _statusCallbacks = [];

let _contexto = null; // {repository, codec} registrado por store.js
let _queue = null;
let _uidDaFila = null;
let _cancelarAssinatura = null;

/** Retorna o status atual de sincronização */
export function getSyncStatus() {
  return _status;
}

/** Registra callback chamado a cada mudança de status. Retorna função para cancelar. */
export function onSyncStatusChange(cb) {
  _statusCallbacks.push(cb);
  return () => { _statusCallbacks = _statusCallbacks.filter(c => c !== cb); };
}

/** Atualiza o status e notifica os callbacks registrados */
function _setStatus(novoStatus) {
  if (novoStatus === _status) return;
  _status = novoStatus;
  _statusCallbacks.forEach(cb => cb(novoStatus));
}

/**
 * Registra o repositório de personagens e o codec já configurados por
 * `store.js`. Sem isto a fila não é construída (ela precisa do repositório
 * para reconciliar preparos e adotar merges remotos com token de revisão).
 * Chamado uma vez, ao fim de `initializeCharacterStorage()`.
 */
export function registrarContextoPersonagens(contexto) {
  _contexto = contexto ?? null;
  _descartarFila();
}

/** Descarta a fila atual (troca de usuário, novo contexto, logout). */
function _descartarFila() {
  if (_cancelarAssinatura) _cancelarAssinatura();
  _cancelarAssinatura = null;
  if (_queue) _queue.dispose();
  _queue = null;
  _uidDaFila = null;
}

/**
 * Gateway preguiçoso: expõe o `uid` da sessão de forma síncrona e só
 * carrega o SDK da CDN quando uma operação de rede realmente ocorre.
 * Firebase indisponível (offline/bloqueado) vira um erro estruturado
 * retryable, nunca uma exceção.
 */
function _criarGatewayPreguicoso() {
  const indisponivel = () => err(createAppError({
    code: 'REMOTE_UNAVAILABLE',
    scope: SCOPE,
    message: 'Firebase indisponível no momento (offline, bloqueado ou não inicializado).',
  }));

  const comGateway = async (executar) => {
    let gateway = null;
    try {
      gateway = await obterGatewayPersonagens(_contexto?.codec);
    } catch (cause) {
      console.warn('sync.js: falha ao obter o gateway do Firestore:', cause?.message ?? cause);
      return indisponivel();
    }
    if (!gateway) return indisponivel();
    return executar(gateway);
  };

  return {
    get uid() {
      return getUsuario()?.uid ?? null;
    },
    list: () => comGateway((g) => g.list()),
    upsert: (envelope) => comGateway((g) => g.upsert(envelope)),
    remove: (characterId) => comGateway((g) => g.remove(characterId)),
  };
}

/**
 * Devolve a fila do usuário atual, construindo-a (e carregando/migrando a
 * fila persistida) na primeira necessidade. Devolve `null` quando não há
 * usuário logado, quando o storage de personagens ainda não foi
 * inicializado, ou quando a fila persistida está corrompida — neste último
 * caso os bytes são preservados e o erro é logado, nunca apagado.
 */
function _obterFila() {
  const usuario = getUsuario();
  if (!usuario || !_contexto) {
    if (_queue) _descartarFila();
    return null;
  }
  if (_queue && _uidDaFila === usuario.uid) {
    return _queue;
  }

  _descartarFila();

  let queue;
  try {
    queue = createSyncQueue({
      storage: localStorage,
      gateway: _criarGatewayPreguicoso(),
      characterRepository: _contexto.repository,
      connectivity: { isOnline: () => navigator.onLine },
      scheduler: {
        schedule: (fn, delay) => setTimeout(fn, delay),
        cancel: (handle) => clearTimeout(handle),
      },
      codec: _contexto.codec,
    });
  } catch (cause) {
    console.error('sync.js: não foi possível construir a fila de sincronização:', cause?.message ?? cause);
    return null;
  }

  const inicializada = queue.initialize();
  if (!inicializada.ok) {
    // Fila corrompida: os bytes originais permanecem intactos (a fila
    // nunca limpa o que não conseguiu interpretar) e nenhuma sincronização
    // acontece até o problema ser resolvido.
    console.error('sync.js: fila de sincronização não pôde ser carregada:', inicializada.error.message);
    queue.dispose();
    return null;
  }

  _cancelarAssinatura = queue.subscribe((snapshot) => {
    _setStatus(snapshot.status);
    _publicarSnapshotDaFila(snapshot);
  });
  _queue = queue;
  _uidDaFila = usuario.uid;
  _setStatus(inicializada.value.status);
  return queue;
}

/** @type {Array<Function>} assinantes do snapshot da fila (Task 33). */
let _assinantesDaFila = [];

/**
 * Publica o snapshot da fila para quem assinou por `portaDeFilaDaFicha`.
 * Um assinante que lança não derruba os demais nem a fila.
 * @param {object} snapshot - snapshot publicado pela fila.
 * @returns {void}
 */
function _publicarSnapshotDaFila(snapshot) {
  for (const assinante of [..._assinantesDaFila]) {
    try {
      assinante(snapshot);
    } catch (cause) {
      console.warn('sync.js: assinante da fila lançou durante a notificação:', cause?.message ?? cause);
    }
  }
}

/**
 * Porta da fila usada pela SESSÃO DA FICHA (`features/sheet/sheet-session.js`,
 * cutover da Task 33).
 *
 * Ela precisa de três coisas que `portaDeMutacaoDuravel` não expõe: assinar o
 * snapshot (para mostrar as falhas REMOTAS assíncronas com botão de "tentar
 * novamente"), `retry(failureId)` e `reconcilePrepared()`.
 *
 * É uma porta ESTÁVEL sobre uma fila INSTÁVEL, e essa é a razão de existir: a
 * instância da fila nasce, morre e é trocada conforme o usuário entra e sai
 * (`_obterFila` a reconstrói por uid). Uma sessão de ficha que tivesse
 * guardado a instância diretamente continuaria assinando uma fila morta depois
 * de um logout — sem erro e sem aviso, só parando de mostrar falha de
 * sincronização. Aqui a resolução é feita A CADA CHAMADA, e a assinatura vive
 * neste módulo, que é quem sabe quando a fila trocou.
 *
 * Sem fila (deslogado, storage não inicializado, fila corrompida) as operações
 * RECUSAM com erro nomeado — nunca fingem sucesso.
 */
export const portaDeFilaDaFicha = Object.freeze({
  /**
   * Assina o snapshot da fila. Devolve o disposer, idempotente.
   * @param {Function} listener - recebe o snapshot da fila.
   * @returns {() => void}
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('portaDeFilaDaFicha.subscribe: "listener" deve ser uma função.');
    }
    _assinantesDaFila.push(listener);
    // A fila pode já existir e já ter falhas: publicar o estado atual na
    // assinatura evita que a ficha só descubra a pendência no próximo evento.
    const queue = _obterFila();
    if (queue) {
      try {
        listener(queue.getSnapshot());
      } catch (cause) {
        console.warn('sync.js: assinante da fila lançou na assinatura:', cause?.message ?? cause);
      }
    }
    let removido = false;
    return () => {
      if (removido) return;
      removido = true;
      _assinantesDaFila = _assinantesDaFila.filter((entrada) => entrada !== listener);
    };
  },

  /**
   * Retenta uma falha registrada pela fila.
   * @param {string} failureId - id da falha.
   * @returns {import('./core/result.js').Result}
   */
  retry(failureId) {
    const queue = _obterFila();
    if (!queue) {
      return err(createAppError({ code: 'SYNC_QUEUE_UNAVAILABLE', scope: SCOPE, message: 'Não há fila de sincronização ativa para retentar.' }));
    }
    return queue.retry(failureId);
  },

  /**
   * Promove os jobs preparados que ficaram sem confirmação.
   * @returns {import('./core/result.js').Result}
   */
  reconcilePrepared() {
    const queue = _obterFila();
    if (!queue) {
      return err(createAppError({ code: 'SYNC_QUEUE_UNAVAILABLE', scope: SCOPE, message: 'Não há fila de sincronização ativa para reconciliar.' }));
    }
    return queue.reconcilePrepared();
  },
});

/**
 * Porta da fila usada pelo PROTOCOLO DE MUTAÇÃO DURÁVEL de `store.js`
 * (`infra/sync/durable-character-mutation`). Expõe exatamente
 * `prepareMutation`/`confirmPrepared` da fila, com uma única adaptação: sem
 * usuário logado (ou com a fila persistida corrompida) não há o que
 * preparar, e a preparação devolve `preparationId: null` — um "no-op
 * durável". Isso preserva a regra histórica de que salvar deslogado é uma
 * operação puramente local e nunca falha por causa de sincronização.
 *
 * `confirmPrepared` é também o ponto onde o flush imediato acontece (era o
 * fim de `enfileirarSync`): só depois de o job virar enviável.
 */
export const portaDeMutacaoDuravel = Object.freeze({
  /**
   * Grava o job `prepared` (não enviável) ANTES da escrita local.
   * @param {object} params - repassados intactos para a fila.
   * @returns {import('./core/result.js').Result} Result<{preparationId}, AppError>
   */
  prepareMutation(params) {
    const queue = _obterFila();
    if (!queue) return ok(Object.freeze({ preparationId: null }));
    return queue.prepareMutation(params);
  },

  /**
   * Torna o job enviável depois de a escrita local ter sido adotada e, se
   * online, dispara o envio.
   * @param {string|null} preparationId
   * @returns {import('./core/result.js').Result} Result<{jobId}, AppError>
   */
  confirmPrepared(preparationId) {
    if (preparationId === null) return ok(Object.freeze({ jobId: null }));
    const queue = _obterFila();
    if (!queue) return ok(Object.freeze({ jobId: null }));

    const confirmado = queue.confirmPrepared(preparationId);
    if (!confirmado.ok) {
      // O save local já aconteceu e é válido: NÃO é revertido. O job fica
      // preparado e a reconciliação do próximo boot o promove pelo marcador
      // de mutação. Ver durable-character-mutation.js.
      console.warn('sync.js: preparo não pôde ser confirmado; será reconciliado no próximo boot:', confirmado.error.message);
      return confirmado;
    }

    if (navigator.onLine) queue.flush();
    return confirmado;
  },

  /**
   * Desfaz o preparo quando a escrita local falhou, restaurando o job que
   * ele havia deslocado (por exemplo, um upsert já confirmado e pendente
   * offline). Sem isso a fila ficaria com um `prepared` órfão, que o
   * snapshot mostra como "sincronizando" sem falha visível até o próximo
   * boot.
   * @param {string|null} preparationId
   * @returns {import('./core/result.js').Result} Result<{jobId}, AppError>
   */
  abortPrepared(preparationId) {
    if (preparationId === null) return ok(Object.freeze({ jobId: null }));
    const queue = _obterFila();
    if (!queue) return ok(Object.freeze({ jobId: null }));
    return queue.abortPrepared(preparationId);
  },
});

/**
 * Enfileira um personagem para sincronização com a nuvem.
 * Faz upsert na fila (substitui a versão anterior do mesmo personagem).
 * Não enfileira se o usuário não estiver logado.
 * Se estiver online, inicia o processamento imediato.
 *
 * Continua sendo o caminho da IMPORTAÇÃO em massa (`store.js#importarDados`),
 * onde os registros já foram adotados no repositório em bloco e o que resta
 * é propagá-los. O save individual do criador/ficha passa pelo protocolo
 * durável (`portaDeMutacaoDuravel`), não por aqui.
 */
export function enfileirarSync(personagem) {
  const queue = _obterFila();
  if (!queue) return;

  // `personagem` é o registro plano legado já persistido; ele é embrulhado
  // como envelope editável e será passado pelo codec (migrando v1->v2)
  // antes de qualquer envio.
  const resultado = queue.enqueueUpsert({ mode: 'editable', rawRecord: personagem });
  if (!resultado.ok) {
    console.warn('sync.js: não foi possível enfileirar o personagem:', resultado.error.message);
    return;
  }

  if (!navigator.onLine) return;
  queue.flush();
}

/**
 * Enfileira a remoção de um personagem na nuvem.
 * Cancela qualquer upsert pendente para o mesmo id.
 * Não enfileira se o usuário não estiver logado.
 */
export function enfileirarRemocao(id) {
  const queue = _obterFila();
  if (!queue) return;

  const resultado = queue.enqueueRemoval({ characterId: id });
  if (!resultado.ok) {
    console.warn('sync.js: não foi possível enfileirar a remoção:', resultado.error.message);
    return;
  }

  if (!navigator.onLine) return;
  queue.flush();
}

/**
 * Retorna o conjunto de IDs com remoção pendente na fila.
 * Usado pela reconciliação de home.js para não readicionar localmente
 * personagens que foram deletados offline.
 */
export function obterIdsPendentesRemocao() {
  const queue = _obterFila();
  return new Set(queue ? queue.getPendingRemovalIds() : []);
}

/** Exportado para uso externo (ex: app.js ao detectar reconexão) */
export async function processarFilaSync() {
  const queue = _obterFila();
  if (!queue) return;
  await queue.flush();
}

/**
 * Busca a lista remota, faz o merge por `atualizado_em` e adota o
 * resultado no repositório local com precondição de revisão. Os
 * vencedores locais são reenfileirados automaticamente pela fila.
 * @returns {Promise<boolean>} true se o merge foi adotado com sucesso.
 */
export async function sincronizarComNuvem() {
  const queue = _obterFila();
  if (!queue) return false;

  const adotado = await queue.adoptRemoteMerge();
  if (!adotado.ok) {
    console.warn('sync.js: merge remoto não pôde ser adotado:', adotado.error.message);
    return false;
  }
  await queue.flush();
  return true;
}

/**
 * Inicializa o módulo: registra eventos online/offline e processa a fila
 * pendente se houver conectividade. Deve ser chamado uma única vez no boot
 * da aplicação (depois de `initializeCharacterStorage()`).
 */
export function inicializarSync() {
  window.addEventListener('online', () => {
    processarFilaSync();
  });

  window.addEventListener('offline', () => {
    const queue = _obterFila();
    if (queue) _setStatus(queue.getSnapshot().status);
  });

  // Processar pendências da sessão anterior ao abrir o app.
  if (navigator.onLine) {
    processarFilaSync();
  } else {
    const queue = _obterFila();
    if (queue) _setStatus(queue.getSnapshot().status);
  }
}
