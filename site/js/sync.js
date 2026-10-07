// ============================================================
// Módulo de sincronização em nuvem
// Gerencia fila persistente, retry automático e status de sync
// ============================================================
import { getUsuario, salvarPersonagemCloud, removerPersonagemCloud } from './auth.js';
import { VERSAO_ATUAL } from './versao.js';
import { getPersonagem, substituirPersonagemLocal } from './store.js';
import { ehLapide } from './sync-merge.js';

/**
 * A nuvem recusou a cópia da fila por ter versão mais nova: este aparelho adota a da nuvem
 * (ou remove a cópia, se for lápide), a menos que a cópia local tenha sido editada depois
 * dela. Avisa a ficha aberta pelo evento `personagem-atualizado-da-nuvem`.
 * @param {string} id Id do personagem.
 * @param {object} remoto Documento da nuvem.
 */
function _adotarVersaoDaNuvem(id, remoto) {
  const local = getPersonagem(id);
  const marca = (p) => new Date(p?.atualizado_em || 0).getTime();
  if (local && marca(local) > marca(remoto)) return;
  substituirPersonagemLocal(ehLapide(remoto) ? null : remoto, id);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent('personagem-atualizado-da-nuvem', { detail: { id } }));
}

const SYNC_QUEUE_KEY = 'dnd_sync_queue';
const MAX_TENTATIVAS = 3;
const RETRY_DELAY_MS = 5000;

// Status possíveis: 'idle' | 'sincronizando' | 'ok' | 'erro' | 'offline'
let _status = 'idle';
let _statusCallbacks = [];
let _processando = false;

// Detalhe da última falha de sync (mostrado no popup de "Erro ao salvar"); também fica no
// localStorage para sobreviver a um F5.
const ULTIMO_ERRO_KEY = 'dnd_sync_ultimo_erro';
let _ultimoErro = null;

/**
 * Guarda o detalhe de uma falha de sync: o que falhou, o código e a mensagem do erro, o
 * tamanho do documento e os campos que mais pesam (limite de 1 MB do Firestore).
 * @param {object|null} entrada Item da fila (`{id, acao, dados, tentativas}`) ou null.
 * @param {*} err Erro capturado.
 */
function _registrarErro(entrada, err) {
  let tamanho = 0;
  let maiores = [];
  try {
    const d = entrada?.dados;
    if (d) {
      tamanho = JSON.stringify(d).length;
      maiores = Object.entries(d)
        .map(([campo, valor]) => [campo, (JSON.stringify(valor) || '').length])
        .sort((a, b) => b[1] - a[1]).slice(0, 3);
    }
  } catch { /* documento não serializável: o tamanho fica 0 */ }
  _ultimoErro = {
    quando: new Date().toISOString(),
    acao: entrada?.acao || 'salvar',
    id: entrada?.id || '',
    nome: entrada?.dados?.nome || '',
    tentativas: (entrada?.tentativas || 0) + 1,
    erro: err?.name || 'Error',
    codigo: err?.code || '',
    mensagem: String(err?.message ?? err ?? ''),
    pilha: String(err?.stack || '').split('\n').slice(0, 6).join('\n'),
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    tamanho,
    maiores,
    versao: VERSAO_ATUAL,
    agente: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    pendentes: _lerFila().length,
  };
  try { localStorage.setItem(ULTIMO_ERRO_KEY, JSON.stringify(_ultimoErro)); } catch { /* sem armazenamento */ }
}

/**
 * Registra uma falha de salvamento e muda o status para 'erro'. Usado pelo próprio sync e por
 * quem precisar sinalizar que o salvamento falhou.
 * @param {*} err Erro capturado.
 * @param {object|null} [entrada] Item da fila relacionado, se houver.
 */
export function reportarFalhaSync(err, entrada = null) {
  _registrarErro(entrada, err);
  _setStatus('erro');
}

/** Detalhe da última falha de sync (memória ou localStorage), ou null. */
export function getUltimoErroSync() {
  if (_ultimoErro) return _ultimoErro;
  try { return JSON.parse(localStorage.getItem(ULTIMO_ERRO_KEY) || 'null'); } catch { return null; }
}

/**
 * Texto copiável da última falha de sync, para colar num relato de problema.
 * @returns {string} Texto em linhas "campo: valor"; aviso quando nada foi registrado.
 */
export function textoDoErroSync() {
  const e = getUltimoErroSync();
  if (!e) return 'Nenhum detalhe registrado para este erro.';
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  return [
    `Quando: ${e.quando}`,
    `Versão do app: ${e.versao}`,
    `Ação: ${e.acao} (tentativa ${e.tentativas})`,
    `Personagem: ${e.nome || '(sem nome)'} [${e.id}]`,
    `Erro: ${e.erro}${e.codigo ? ` / código ${e.codigo}` : ''}`,
    `Mensagem: ${e.mensagem}`,
    `Online: ${e.online}`,
    `Pendentes na fila: ${e.pendentes}`,
    `Tamanho do documento: ${kb(e.tamanho)} (limite da nuvem: 1024 KB)`,
    e.maiores?.length ? `Maiores campos: ${e.maiores.map(([c, n]) => `${c} ${kb(n)}`).join(', ')}` : '',
    `Navegador: ${e.agente}`,
    e.pilha ? `Pilha:\n${e.pilha}` : '',
  ].filter(Boolean).join('\n');
}

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
        const resultado = await salvarPersonagemCloud(entrada.dados);
        if (resultado && !resultado.gravado && resultado.remoto) _adotarVersaoDaNuvem(entrada.id, resultado.remoto);
      }
      // Remover da fila após sucesso
      const f = _lerFila();
      _salvarFila(f.filter(e => e.id !== entrada.id));
    } catch (err) {
      console.warn(`Sync falhou para ${entrada.id} (tentativa ${(entrada.tentativas || 0) + 1}):`, err.message);
      _registrarErro(entrada, err);
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
