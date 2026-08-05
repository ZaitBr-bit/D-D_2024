// Módulo `content/official-handler-authorization`: cria o canal de
// autorização de handlers oficiais.
//
// ## Modelo de segurança
//
// O canal separa deliberadamente quem EMITE de quem VERIFICA:
//
//   - `issue` vai somente para o `OfficialHandlerInvoker` interno criado por
//     `createContentRuntime` (via `issueOfficialHandlerAuthorization`);
//   - `verify` vai somente para o `OfficialHandlerRegistry`, que executa os
//     handlers.
//
// Assim o executor nunca consegue emitir a própria autorização, e o emissor
// nunca consegue executar nada. Quem faz essa divisão é o composition root
// (`site/js/app-context.js`), o único módulo de produção autorizado a chamar
// `createOfficialHandlerAuthorizationChannel()` — regra verificada
// estaticamente por `scripts/check-architecture.mjs`.
//
// A autorização emitida é:
//   - OPACA: um objeto congelado sem nenhuma propriedade. `JSON.stringify`
//     produz `{}`, `Object.keys` produz `[]`. Não há nada para ler, copiar
//     ou reproduzir. O escopo concedido vive num `WeakMap` privado do canal.
//   - INFALSIFICÁVEL: `verify` compara por IDENTIDADE de referência no
//     `WeakMap`, nunca por formato. Um objeto literal com "cara" de
//     autorização é rejeitado exatamente como qualquer outro valor.
//   - PRESA A UM ESCOPO EXATO: `{entityId, handlerId, operation}`. Trocar
//     qualquer um dos três invalida a autorização.
//   - DE USO ÚNICO: a primeira verificação consome a autorização,
//     independentemente de aprovar ou reprovar (uma tentativa fora de escopo
//     não pode ser refeita "no escopo certo").
//   - PRESA AO CANAL: cada canal tem seu próprio `WeakMap`, então uma
//     autorização de outro canal nunca é aceita.

/**
 * Valida o escopo `{entityId, handlerId, operation}`. Escopo malformado é
 * defeito de programação de quem chama (o invoker), não conteúdo não
 * confiável, por isso lança.
 * @param {*} scope
 * @returns {{entityId: string, handlerId: string, operation: string}}
 */
function requireScope(scope) {
  if (scope === null || typeof scope !== 'object') {
    throw new TypeError('A autorização exige um escopo { entityId, handlerId, operation }.');
  }
  const { entityId, handlerId, operation } = scope;
  for (const [name, value] of [
    ['entityId', entityId],
    ['handlerId', handlerId],
    ['operation', operation],
  ]) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(`A autorização exige "${name}" como string não vazia.`);
    }
  }
  return { entityId, handlerId, operation };
}

/**
 * Cria um canal de autorização de handlers oficiais.
 *
 * RESTRITO AO COMPOSITION ROOT (`site/js/app-context.js`).
 *
 * @returns {Readonly<{issue: Function, verify: Function}>}
 */
export function createOfficialHandlerAuthorizationChannel() {
  // Estado privado do canal: autorização (identidade) -> escopo concedido.
  const grantedScopes = new WeakMap();

  /**
   * Emite uma autorização opaca, de uso único, presa ao escopo informado.
   * @param {{entityId: string, handlerId: string, operation: string}} scope
   * @returns {object} valor opaco, sem propriedades
   */
  function issue(scope) {
    const granted = requireScope(scope);
    // Objeto sem protótipo e sem propriedades: nada a inspecionar, nada a
    // serializar, nada a reproduzir.
    const authorization = Object.freeze(Object.create(null));
    grantedScopes.set(authorization, Object.freeze(granted));
    return authorization;
  }

  /**
   * Verifica e CONSOME uma autorização. Devolve `true` somente quando o
   * valor foi emitido por este canal, ainda não foi usado e o escopo
   * confere exatamente.
   * @param {*} authorization
   * @param {*} scope
   * @returns {boolean}
   */
  function verify(authorization, scope) {
    if (authorization === null || typeof authorization !== 'object') {
      return false;
    }
    if (!grantedScopes.has(authorization)) {
      return false;
    }
    const granted = grantedScopes.get(authorization);
    // Uso único: consome antes de comparar, para que uma tentativa fora de
    // escopo não possa ser repetida com o escopo correto.
    grantedScopes.delete(authorization);

    if (scope === null || typeof scope !== 'object') {
      return false;
    }
    return (
      granted.entityId === scope.entityId &&
      granted.handlerId === scope.handlerId &&
      granted.operation === scope.operation
    );
  }

  return Object.freeze({ issue, verify });
}
