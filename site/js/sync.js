// ============================================================
// Módulo de sincronização em nuvem
// Gerencia fila persistente, retry automático e status de sync
// ============================================================
import { getUsuario, salvarPersonagemCloud, removerPersonagemCloud } from './auth.js';

const SYNC_QUEUE_KEY = 'dnd_sync_queue';
const MAX_TENTATIVAS = 3;
const RETRY_DELAY_MS = 5000;

// Status possíveis: 'idle' | 'sincronizando' | 'ok' | 'erro' | 'offline'
let _status = 'idle';
let _statusCallbacks = [];
let _processando = false;

/** Retorna o status atual de sincronização */
export function getSyncStatus() {
  return _status;
}

/** Registra callback chamado a cada mudança de status. Retorna função para cancelar. */
export function onSyncStatusChange(cb) {
  _statusCallbacks.push(cb);
  return () => { _statusCallbacks = _statusCallbacks.filter(c => c !== cb); };
}

/** Lê a fila de sync do localStorage */
function _lerFila() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Persiste a fila de sync no localStorage */
function _salvarFila(fila) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(fila));
}

/** Atualiza o status e notifica os callbacks registrados */
function _setStatus(novoStatus) {
  _status = novoStatus;
  _statusCallbacks.forEach(cb => cb(novoStatus));
}

/**
 * Enfileira um personagem para sincronização com a nuvem.
 * Faz upsert na fila (substitui versão anterior do mesmo personagem).
 * Não enfileira se o usuário não estiver logado.
 * Se estiver online, inicia processamento imediato.
 */
export function enfileirarSync(personagem) {
  if (!getUsuario()) return;

  const fila = _lerFila();
  const idx = fila.findIndex(e => e.id === personagem.id);
  const entrada = {
    id: personagem.id,
    dados: JSON.parse(JSON.stringify(personagem)),
    tentativas: 0
  };
  if (idx >= 0) {
    fila[idx] = entrada;
  } else {
    fila.push(entrada);
  }
  _salvarFila(fila);

  if (!navigator.onLine) {
    _setStatus('offline');
    return;
  }

  _processarFilaSync();
}

/**
 * Enfileira a remoção de um personagem na nuvem.
 * Cancela qualquer upsert pendente para o mesmo id.
 * Não enfileira se o usuário não estiver logado.
 */
export function enfileirarRemocao(id) {
  if (!getUsuario()) return;

  // Remover qualquer upsert pendente para o mesmo id antes de enfileirar a remoção
  const fila = _lerFila().filter(e => e.id !== id);
  fila.push({ id, acao: 'remover', tentativas: 0 });
  _salvarFila(fila);

  if (!navigator.onLine) {
    _setStatus('offline');
    return;
  }

  _processarFilaSync();
}

/**
 * Retorna o conjunto de IDs com remoção pendente na fila.
 * Usado pela reconciliação de home.js para não readicionar localmente
 * personagens que foram deletados offline.
 */
export function obterIdsPendentesRemocao() {
  return new Set(
    _lerFila()
      .filter(e => e.acao === 'remover')
      .map(e => e.id)
  );
}

/** Exportado para uso externo (ex: app.js ao detectar reconexão) */
export async function processarFilaSync() {
  await _processarFilaSync();
}

async function _processarFilaSync() {
  if (_processando) return;

  const fila = _lerFila();
  if (fila.length === 0) {
    if (_status !== 'ok') _setStatus('idle');
    return;
  }

  const usuario = getUsuario();
  if (!usuario) return;

  _processando = true;
  _setStatus('sincronizando');

  const filaAtual = [..._lerFila()];
  let houveErro = false;

  for (const entrada of filaAtual) {
    try {
      if (entrada.acao === 'remover') {
        await removerPersonagemCloud(entrada.id);
      } else {
        await salvarPersonagemCloud(entrada.dados);
      }
      // Remover da fila após sucesso
      const f = _lerFila();
      _salvarFila(f.filter(e => e.id !== entrada.id));
    } catch (err) {
      console.warn(`Sync falhou para ${entrada.id} (tentativa ${(entrada.tentativas || 0) + 1}):`, err.message);
      const f = _lerFila();
      const e = f.find(x => x.id === entrada.id);
      if (e) {
        e.tentativas = (e.tentativas || 0) + 1;
        _salvarFila(f);
        if (e.tentativas >= MAX_TENTATIVAS) {
          console.warn(`Sync falhou após ${MAX_TENTATIVAS} tentativas para ${entrada.id} — item permanece na fila`);
        }
      }
      houveErro = true;
    }
  }

  _processando = false;
  const filaRestante = _lerFila();
  if (filaRestante.length === 0) {
    _setStatus(houveErro ? 'erro' : 'ok');
  } else {
    _setStatus('erro');
    // Agendar retry com backoff
    setTimeout(() => _processarFilaSync(), RETRY_DELAY_MS);
  }
}

/**
 * Inicializa o módulo: registra eventos online/offline
 * e processa fila pendente se houver conectividade.
 * Deve ser chamado uma única vez no boot da aplicação.
 */
export function inicializarSync() {
  window.addEventListener('online', () => {
    _processarFilaSync();
  });

  window.addEventListener('offline', () => {
    if (_lerFila().length > 0) {
      _setStatus('offline');
    }
  });

  // Processar pendências da sessão anterior ao abrir o app
  if (navigator.onLine && _lerFila().length > 0) {
    _processarFilaSync();
  } else if (!navigator.onLine && _lerFila().length > 0) {
    _setStatus('offline');
  }
}
