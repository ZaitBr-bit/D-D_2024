// Módulo `infra/content/official-content-registry`: monta o runtime de
// conteúdo do pacote oficial (`dados/pacotes/dnd2024/`) — fonte HTTP +
// validador real + `ContentRegistry` — e o entrega já inicializado.
//
// ## O que este módulo deliberadamente NÃO sabe
//
// Ele NÃO importa `content/capabilities.js` nem
// `content/official-handler-authorization.js`, e não tem como fabricar
// privilégio: recebe `capabilities` e `issueOfficialHandlerAuthorization`
// prontos, por injeção, do composition root (`site/js/app-context.js`), que é
// o único módulo de produção autorizado a criá-los (regra de arquitetura
// `official-capability-restricted-*`, verificada por
// `scripts/check-architecture.mjs`).
//
// Consequência prática: chamar `createOfficialContentRuntime` com um objeto
// de capacidades forjado (`{namespace: 'dnd2024', officialHandlers: Symbol()}`)
// NÃO concede nada — `describeCapabilities` recusa o namespace oficial de quem
// não passa por `hasOfficialHandlersCapability`, e o registro falha.
//
// ## Ativação
//
// A ativação é atômica e delegada ao `ContentRegistry.initialize()`: se
// qualquer entidade do pacote falhar validação de schema/referência, nada é
// publicado e o erro sobe como `Result` de erro.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { createContentRuntime } from '../../content/registry.js';
import {
  validateManifest,
  validateIndex,
  validateEntity,
  validateReferences,
} from '../../content/validation.js';
import { OFFICIAL_CONTENT_BASE_URL } from '../config.js';
import { HttpContentSource } from './http-content-source.js';

const SCOPE = 'infra.content.official-registry';

/**
 * Adaptador que expõe os validadores reais de `content/validation.js` no
 * formato de porta esperado pelo `ContentRegistry`.
 * @returns {Readonly<{validateManifest: Function, validateIndex: Function, validateEntity: Function, validateReferences: Function}>}
 */
export function createOfficialContentValidator() {
  return Object.freeze({ validateManifest, validateIndex, validateEntity, validateReferences });
}

/**
 * Cria e inicializa o runtime de conteúdo oficial.
 *
 * @param {{
 *   fetchFn: Function,
 *   handlerRegistry: object,
 *   capabilities: object,
 *   issueOfficialHandlerAuthorization: Function,
 *   baseUrl?: URL|string,
 *   validator?: object
 * }} params
 * @returns {Promise<import('../../core/result.js').Result>} `ok({registry, officialHandlerInvoker})`
 */
export async function createOfficialContentRuntime({
  fetchFn,
  handlerRegistry,
  capabilities,
  issueOfficialHandlerAuthorization,
  baseUrl = OFFICIAL_CONTENT_BASE_URL,
  validator = createOfficialContentValidator(),
} = {}) {
  if (capabilities === null || typeof capabilities !== 'object') {
    throw new TypeError(
      'createOfficialContentRuntime: "capabilities" deve ser injetado pelo composition root.',
    );
  }

  // `createContentRuntime` já lança TypeError para `handlerRegistry` sem
  // `invokeAuthorized` e para `issueOfficialHandlerAuthorization` que não é
  // função — defeitos de composição, não falhas de conteúdo.
  const { registry, officialHandlerInvoker } = createContentRuntime({
    validator,
    handlerRegistry,
    issueOfficialHandlerAuthorization,
  });

  const source = HttpContentSource({ baseUrl, fetchFn });

  const registered = registry.registerSource(source, capabilities);
  if (!registered.ok) {
    return registered;
  }

  const initialized = await registry.initialize();
  if (!initialized.ok) {
    return err(
      createAppError({
        code: 'OFFICIAL_CONTENT_ACTIVATION_FAILED',
        scope: SCOPE,
        message: 'O pacote de conteúdo oficial não pôde ser ativado.',
        context: {
          baseUrl: String(baseUrl),
          cause: { code: initialized.error?.code ?? null, message: initialized.error?.message ?? null },
        },
        cause: initialized.error,
      }),
    );
  }

  // Duas portas distintas, como no `createContentRuntime`: consulta de
  // conteúdo de um lado, invocação de handler oficial do outro.
  return ok(Object.freeze({ registry, officialHandlerInvoker }));
}
