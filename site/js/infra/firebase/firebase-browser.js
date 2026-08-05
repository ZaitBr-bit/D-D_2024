// Módulo `infra/firebase/firebase-browser`: a fachada de NAVEGADOR que
// carrega os módulos do Firebase pela CDN e monta o objeto `api` injetado
// no `firestore-character-gateway`.
//
// Este é o único lugar do caminho novo que conhece uma URL de CDN. O
// gateway recebe as funções por injeção e não importa SDK nenhum — é essa
// separação que permite testá-lo contra o Firestore Emulator (onde o SDK
// vem do `node_modules`) e manter a fila de sync (`infra/sync/`) 100%
// livre de Firebase.
//
// A versão da CDN é EXATAMENTE a mesma já usada por `site/js/auth.js`
// (11.4.0): esta tarefa não altera a configuração de produção nem o login
// Google, apenas reaproveita os mesmos módulos.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';

const SCOPE = 'infra.firebase.firebase-browser';

export const FIREBASE_CDN_VERSION = '11.4.0';
export const FIRESTORE_MODULE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-firestore.js`;

// As funções do SDK de que o gateway depende. Listadas explicitamente para
// que a ausência de qualquer uma falhe aqui, com nome, em vez de virar um
// `undefined is not a function` lá dentro no meio de uma escrita.
const REQUIRED_FIRESTORE_EXPORTS = ['collection', 'doc', 'getDocs', 'deleteDoc', 'runTransaction'];

/**
 * Extrai do módulo Firestore carregado exatamente o objeto `api` esperado
 * pelo gateway. Função pura (recebe o módulo já carregado), separada do
 * `import()` para poder ser exercitada sem rede.
 * @param {object} firestoreModule - o módulo `firebase-firestore.js`.
 * @returns {import('../../core/result.js').Result} Result<object, AppError>
 */
export function buildFirestoreApi(firestoreModule) {
  if (firestoreModule === null || typeof firestoreModule !== 'object') {
    return err(
      createAppError({ code: 'FIREBASE_MODULE_INVALID', scope: SCOPE, message: 'O módulo Firestore carregado não é um objeto.' }),
    );
  }

  const faltando = REQUIRED_FIRESTORE_EXPORTS.filter((name) => typeof firestoreModule[name] !== 'function');
  if (faltando.length > 0) {
    return err(
      createAppError({
        code: 'FIREBASE_MODULE_INCOMPLETE',
        scope: SCOPE,
        message: `O módulo Firestore não exporta as funções necessárias: ${faltando.join(', ')}.`,
        context: { faltando },
      }),
    );
  }

  const api = {};
  for (const name of REQUIRED_FIRESTORE_EXPORTS) {
    api[name] = firestoreModule[name];
  }
  return ok(Object.freeze(api));
}

/**
 * Carrega o módulo Firestore da CDN e devolve o `api` pronto para
 * injeção. Nunca lança: uma falha de rede/CSP vira um `AppError`
 * estruturado, porque estar offline é um estado esperado deste app.
 * @param {{importModule?: (url: string) => Promise<object>}} [params] -
 *   `importModule` existe para testes; o padrão é o `import()` dinâmico.
 * @returns {Promise<import('../../core/result.js').Result>} Promise<Result<object, AppError>>
 */
export async function loadFirestoreApi({ importModule } = {}) {
  const load = typeof importModule === 'function' ? importModule : (url) => import(/* @vite-ignore */ url);
  let firestoreModule;
  try {
    firestoreModule = await load(FIRESTORE_MODULE_URL);
  } catch (cause) {
    return err(
      createAppError({
        code: 'FIREBASE_MODULE_LOAD_FAILED',
        scope: SCOPE,
        message: 'Não foi possível carregar o módulo Firestore da CDN (offline, bloqueado ou indisponível).',
        context: { url: FIRESTORE_MODULE_URL },
        cause,
      }),
    );
  }
  return buildFirestoreApi(firestoreModule);
}
