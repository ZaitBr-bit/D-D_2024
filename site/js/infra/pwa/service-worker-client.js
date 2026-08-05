// ============================================================
// Módulo `infra/pwa/service-worker-client`: registro e ciclo de
// atualização do Service Worker (site/sw.js), extraído de site/js/app.js
// (Task 36) para isolar a integração com a API do navegador do restante do
// bootstrap da aplicação. Preserva o comportamento existente: atualização
// automática (sem exigir clique do usuário), aplicada via `SKIP_WAITING` e
// recarga adiada enquanto um modal estiver aberto.
// ============================================================
import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';

/**
 * Dispara a troca de controlador para o Service Worker novo (`waiting` ou
 * `installing` já `installed`), enviando `SKIP_WAITING`. Idempotente por
 * instância de worker (marca `_dndAtualizacaoAplicada` para nunca disparar
 * duas vezes pro mesmo objeto).
 * @param {ServiceWorker} sw
 */
function aplicarAtualizacao(sw) {
  if (sw._dndAtualizacaoAplicada) return;
  sw._dndAtualizacaoAplicada = true;
  // NAO apagar caches aqui. O proprio SW (evento 'activate') decide quando é
  // seguro remover caches de versões antigas. Apagar tudo do cliente
  // destruiria o cache que o novo SW acabou de popular no 'install'.
  sw.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Observa o ciclo de vida do registro para detectar quando um Service
 * Worker novo termina de instalar, e aplica a atualização automaticamente
 * (sem exigir interação do usuário) assim que já existir um controller
 * ativo (ou seja: não é a primeira instalação, é uma atualização de fato).
 * @param {ServiceWorkerRegistration} registration
 */
function verificarAtualizacaoSW(registration) {
  const novoSW = registration.waiting || registration.installing;

  if (novoSW) {
    if (novoSW.state === 'installed') {
      if (navigator.serviceWorker.controller) aplicarAtualizacao(novoSW);
    } else {
      novoSW.addEventListener('statechange', () => {
        if (novoSW.state === 'installed' && navigator.serviceWorker.controller) {
          aplicarAtualizacao(novoSW);
        }
      });
    }
  }

  registration.addEventListener('updatefound', () => {
    const instalando = registration.installing;
    if (instalando) {
      instalando.addEventListener('statechange', () => {
        if (instalando.state === 'installed' && navigator.serviceWorker.controller) {
          aplicarAtualizacao(instalando);
        }
      });
    }
  });
}

/**
 * Registra `./sw.js` e conecta o ciclo de atualização automática. Quando o
 * controlador muda (novo SW assumiu), recarrega a página assim que for
 * seguro — `canReload()` decide isso (tipicamente: nenhum modal aberto). Se
 * não for seguro no momento da troca, `onUpdate()` é chamado (tipicamente
 * para mostrar um toast) e a recarga é adiada via polling de `canReload()`
 * até ficar seguro.
 * @param {{
 *   canReload: () => boolean,
 *   onUpdate?: (mensagem: string) => void,
 *   onError?: (error: unknown) => void
 * }} params
 * @returns {Promise<{ok: true, value: ServiceWorkerRegistration} | {ok: false, error: object}>}
 */
export async function registerServiceWorker({ canReload, onUpdate, onError } = {}) {
  if (typeof canReload !== 'function') {
    return err(createAppError({
      code: 'PWA_INVALID_ARGS',
      scope: 'infra/pwa/service-worker-client',
      message: 'registerServiceWorker requer a função canReload().',
    }));
  }

  if (!('serviceWorker' in navigator)) {
    return err(createAppError({
      code: 'PWA_UNSUPPORTED',
      scope: 'infra/pwa/service-worker-client',
      message: 'Este navegador não suporta Service Worker.',
    }));
  }

  let registration;
  try {
    registration = await navigator.serviceWorker.register('./sw.js');
  } catch (cause) {
    if (typeof onError === 'function') onError(cause);
    return err(createAppError({
      code: 'PWA_REGISTER_FAILED',
      scope: 'infra/pwa/service-worker-client',
      message: 'Falha ao registrar o Service Worker.',
      cause,
    }));
  }

  verificarAtualizacaoSW(registration);

  // Verificar atualizações periodicamente (a cada 5 min) e ao voltar para a aba.
  setInterval(() => registration.update(), 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration.update();
  });

  // Recarregar a página quando o novo SW assumir controle (pós-atualização).
  // hadController evita reload desnecessário na primeira instalação.
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    recarregarQuandoSeguro({ canReload, onUpdate });
  });

  return ok(registration);
}

/**
 * Recarrega a página assim que `canReload()` indicar que é seguro (ex.: sem
 * modal aberto), pra não interromper o usuário no meio de uma edição. Se já
 * estiver seguro, recarrega na hora; senão, notifica via `onUpdate()` e faz
 * polling até ficar seguro.
 * @param {{canReload: () => boolean, onUpdate?: (mensagem: string) => void}} params
 */
function recarregarQuandoSeguro({ canReload, onUpdate }) {
  if (canReload()) {
    window.location.reload();
    return;
  }

  if (typeof onUpdate === 'function') {
    onUpdate('Nova versão disponível — será aplicada ao fechar esta janela.');
  }

  // Polling: o chamador não expõe um callback de "fechou o modal" genérico
  // (ver app.js — o slot de onClose do ModalService já pode estar ocupado
  // pelo próprio wizard/modal em andamento).
  const interval = setInterval(() => {
    if (canReload()) {
      clearInterval(interval);
      window.location.reload();
    }
  }, 500);
}
