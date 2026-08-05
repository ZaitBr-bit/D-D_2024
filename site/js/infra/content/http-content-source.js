// Módulo `infra/content/http-content-source`: a `ContentSource` que lê um
// pacote de conteúdo servido por HTTP (ou por `file:` em desenvolvimento).
//
// ## O que esta fonte NÃO faz
//
// Ela é apenas um provedor de bytes: não valida schema (isso é do
// `ContentRegistry` + `content/validation.js`), não concede capacidade nenhuma
// e não conhece a fábrica do token de confiança oficial. `capabilities` é
// concedida pelo composition root em `registry.registerSource(...)`; este
// arquivo nem importa `content/capabilities.js`.
//
// ## Modelo de ameaça do caminho de arquivo
//
// `manifest.json` e `index.json` são caminhos fixos, mas o `path`/`pointer` de
// cada entidade vem de `index.json` — isto é, de JSON NÃO CONFIÁVEL, mesmo
// dentro do pacote oficial (ver docs/superpowers/plans, "Global Constraints").
// Um `path` hostil poderia sair do diretório do pacote e fazer a aplicação
// buscar qualquer URL do mesmo host (ou de outro), transformando o índice num
// SSRF/exfiltração via `fetch`.
//
// A defesa tem DUAS camadas independentes, e as duas são obrigatórias:
//
//   1. `assertSafeContentPath` — allowlist textual fechada: só caminho POSIX
//      relativo em ASCII minúsculo, segmentos `[a-z0-9]` com `-`/`_`
//      internos, terminado em `.json`. Isso já recusa `..`, `.`, `\`, `%`
//      (portanto TODA forma percent-encoded, inclusive `%2e%2e/`, `.%2e/`,
//      `%2e./`, `..%2f`, `%2E%2E%2F` e escapes malformados como `%zz`), `?`,
//      `#`, `:` (portanto URL absoluta), barra inicial/dupla e não-ASCII.
//
//   2. `resolveContentUrl` — depois de `new URL(path, baseUrl)`, exige
//      protocolo, host e origin iguais aos da base, ausência de
//      credenciais/query/fragmento, e `pathname` estritamente contido no
//      `pathname` da base (por SEGMENTO, e conferido também por igualdade
//      exata com `base.pathname + path`).
//
// Por que as duas: a camada 1 é textual e não sabe nada de normalização de
// URL — se um dia ela for afrouxada (novo tipo de arquivo, novo separador), a
// camada 2 continua sendo a fronteira real. E a camada 2, sozinha, aceitaria
// coisas que só a camada 1 vê: `new URL` normaliza `%2e%2e` para `..` DEPOIS
// de resolver, aceita nomes com `%20`/unicode e não tem opinião sobre
// extensão — casos em que a URL final até "cai dentro" da base, mas o caminho
// não é um arquivo canônico do pacote. Nenhuma das duas cobre a outra.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { INDEX_FILE_NAME, MANIFEST_FILE_NAME } from '../config.js';

const SCOPE = 'infra.content.http-source';

// Protocolos aceitos para a base: HTTP(S) em produção/servidor local e
// `file:` em desenvolvimento/testes Node. Qualquer outro (`data:`,
// `javascript:`, `blob:`) é recusado na construção.
const ALLOWED_PROTOCOLS = Object.freeze(['http:', 'https:', 'file:']);

// Um segmento de caminho: ASCII minúsculo/dígito, com `-` ou `_` somente
// entre grupos alfanuméricos (nunca no início/fim, nunca repetido).
const SEGMENT = '[a-z0-9]+(?:[-_][a-z0-9]+)*';

// Caminho completo: um ou mais segmentos separados por `/`, terminado em
// `.json`. Ancorado nas duas pontas; sem alternância que aceite vazio.
const SAFE_PATH_PATTERN = new RegExp(`^(?:${SEGMENT}/)*${SEGMENT}\\.json$`);

// Limite de tamanho: nenhum caminho legítimo do pacote passa de ~60 chars.
const MAX_PATH_LENGTH = 128;

// Motivos explícitos conferidos ANTES da allowlist, só para dar diagnóstico
// útil (a allowlist sozinha já recusaria todos eles).
const EXPLICIT_REJECTIONS = Object.freeze([
  [/%/, 'contém "%": percent-encoding não é aceito em nenhuma forma'],
  [/\\/, 'contém barra invertida'],
  [/[?#]/, 'contém query ou fragmento'],
  [/:/, 'contém ":": parece URL absoluta ou caminho de dispositivo'],
  [/^\//, 'começa com "/": caminho absoluto'],
  [/\/\//, 'contém "//": segmento vazio'],
  [/(?:^|\/)\.{1,2}(?:\/|$)/, 'contém segmento "." ou ".."'],
  // eslint-disable-next-line no-control-regex -- recusa explícita de controles
  [/[\u0000-\u001f\u007f-\uffff]/, 'contém caractere de controle ou não-ASCII'],
  [/\s/, 'contém espaço em branco'],
]);

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {*} [cause]
 * @returns {object}
 */
function sourceError(code, message, context = {}, cause = undefined) {
  return createAppError({ code, scope: SCOPE, message, context, cause });
}

/**
 * CAMADA 1 — allowlist textual de caminho relativo dentro do pacote.
 *
 * Devolve `Result<string, AppError>`: `ok(path)` só para caminho POSIX
 * relativo, ASCII minúsculo, com segmentos allowlisted e extensão `.json`.
 *
 * @param {*} path
 * @returns {import('../../core/result.js').Result}
 */
export function assertSafeContentPath(path) {
  if (typeof path !== 'string' || path.length === 0) {
    return err(
      sourceError('CONTENT_PATH_REJECTED', 'O caminho de conteúdo deve ser uma string não vazia.', {
        reason: 'não é string não vazia',
        receivedType: path === null ? 'null' : typeof path,
      }),
    );
  }
  if (path.length > MAX_PATH_LENGTH) {
    return err(
      sourceError('CONTENT_PATH_REJECTED', 'O caminho de conteúdo é longo demais.', {
        reason: `excede ${MAX_PATH_LENGTH} caracteres`,
        length: path.length,
      }),
    );
  }
  for (const [pattern, reason] of EXPLICIT_REJECTIONS) {
    if (pattern.test(path)) {
      return err(
        sourceError('CONTENT_PATH_REJECTED', `O caminho de conteúdo foi recusado: ${reason}.`, { reason, path }),
      );
    }
  }
  if (!SAFE_PATH_PATTERN.test(path)) {
    return err(
      sourceError(
        'CONTENT_PATH_REJECTED',
        'O caminho de conteúdo não corresponde ao formato allowlisted (segmentos ASCII minúsculos e extensão .json).',
        { reason: 'fora da allowlist de formato', path },
      ),
    );
  }
  return ok(path);
}

/**
 * Normaliza uma base recebida do composition root para uma `URL` absoluta
 * terminada em `/`. Base inválida é defeito de programação de quem compõe a
 * aplicação (não é dado de conteúdo), por isso lança.
 * @param {*} baseUrl
 * @returns {URL}
 */
function requireBaseUrl(baseUrl) {
  let url;
  if (baseUrl instanceof URL) {
    url = new URL(baseUrl.href);
  } else if (typeof baseUrl === 'string' && baseUrl.length > 0) {
    try {
      url = new URL(baseUrl);
    } catch {
      throw new TypeError('HttpContentSource: "baseUrl" deve ser uma URL absoluta.');
    }
  } else {
    throw new TypeError('HttpContentSource: "baseUrl" deve ser uma URL absoluta (URL ou string).');
  }
  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    throw new TypeError(
      `HttpContentSource: protocolo "${url.protocol}" não é aceito em "baseUrl" (use ${ALLOWED_PROTOCOLS.join(', ')}).`,
    );
  }
  if (!url.pathname.endsWith('/')) {
    throw new TypeError('HttpContentSource: "baseUrl" deve terminar em "/" para conter o pacote.');
  }
  if (url.search !== '' || url.hash !== '') {
    throw new TypeError('HttpContentSource: "baseUrl" não pode ter query nem fragmento.');
  }
  if (url.username !== '' || url.password !== '') {
    throw new TypeError('HttpContentSource: "baseUrl" não pode carregar credenciais.');
  }
  return url;
}

/**
 * CAMADA 2 — resolve `path` contra `baseUrl` e exige que a URL final continue
 * dentro do pacote.
 *
 * Confere, sobre o resultado de `new URL(path, baseUrl)`: mesmo protocolo,
 * mesmo host, mesmo origin, sem credenciais, sem query, sem fragmento, e
 * `pathname` estritamente dentro do `pathname` da base — tanto por prefixo de
 * SEGMENTO (a base sempre termina em `/`, então `.../pacote-malicioso/` nunca
 * conta como dentro de `.../pacote/`) quanto por igualdade exata com
 * `base.pathname + path`, o que também recusa qualquer renormalização
 * inesperada feita pelo parser de URL.
 *
 * Esta checagem é obrigatória mesmo depois da allowlist textual.
 *
 * @param {string} path
 * @param {URL|string} baseUrl
 * @returns {import('../../core/result.js').Result}
 */
export function resolveContentUrl(path, baseUrl) {
  const base = requireBaseUrl(baseUrl);

  if (typeof path !== 'string' || path.length === 0) {
    return err(
      sourceError('CONTENT_URL_OUT_OF_BOUNDS', 'Não é possível resolver um caminho vazio contra a base.', {
        reason: 'caminho vazio',
      }),
    );
  }

  let resolved;
  try {
    resolved = new URL(path, base);
  } catch (cause) {
    return err(
      sourceError(
        'CONTENT_URL_OUT_OF_BOUNDS',
        'O caminho de conteúdo não pôde ser resolvido contra a base do pacote.',
        { reason: 'URL inválida', path },
        cause,
      ),
    );
  }

  /** Monta a rejeição padrão desta camada. */
  const deny = (reason) =>
    err(
      sourceError('CONTENT_URL_OUT_OF_BOUNDS', `A URL resolvida saiu do pacote oficial: ${reason}.`, {
        reason,
        path,
        base: base.href,
        resolved: resolved.href,
      }),
    );

  if (resolved.protocol !== base.protocol) {
    return deny('protocolo diferente do da base');
  }
  if (resolved.host !== base.host) {
    return deny('host diferente do da base');
  }
  if (resolved.origin !== base.origin) {
    return deny('origin diferente do da base');
  }
  if (resolved.username !== '' || resolved.password !== '') {
    return deny('a URL resolvida carrega credenciais');
  }
  if (resolved.search !== '' || resolved.hash !== '') {
    return deny('a URL resolvida tem query ou fragmento');
  }
  // A base sempre termina em "/", então este prefixo é um limite de segmento:
  // "/pacote/" nunca é prefixo de "/pacote-malicioso/x.json".
  if (!resolved.pathname.startsWith(base.pathname)) {
    return deny('o pathname resolvido não está dentro do pathname da base');
  }
  if (resolved.pathname.length <= base.pathname.length) {
    return deny('o pathname resolvido é o próprio diretório da base');
  }
  const relative = resolved.pathname.slice(base.pathname.length);
  // Um separador percent-encoded (`..%2f`) sobrevive à normalização do parser
  // de URL e pode ser decodificado pelo servidor depois — a camada 2 recusa
  // qualquer percent-encoding no trecho relativo, sem depender da camada 1.
  if (relative.includes('%')) {
    return deny('o pathname resolvido contém percent-encoding');
  }
  if (resolved.pathname !== `${base.pathname}${path}`) {
    return deny('o pathname resolvido não corresponde exatamente a base + caminho');
  }

  return ok(resolved);
}

/**
 * Resolve um JSON Pointer (RFC 6901) restrito dentro de `document`.
 *
 * O pointer vem do índice (JSON não confiável), então:
 *   - deve ser string não vazia começando em `/`;
 *   - segmentos são conferidos com `hasOwnProperty` (nunca herdados), e
 *     `__proto__`/`prototype`/`constructor` são recusados de forma explícita,
 *     fechando qualquer caminho de poluição de protótipo;
 *   - o resultado `undefined` é tratado como "não resolveu".
 *
 * @param {*} document
 * @param {string} pointer
 * A falha devolve um CÓDIGO estruturado (`POINTER_MALFORMED`,
 * `POINTER_SEGMENT_FORBIDDEN`, `POINTER_NOT_FOUND`, ...), nunca só prosa: a
 * decisão de quem chama entre "pointer inaceitável" (rejeição relevante para
 * segurança) e "pointer não resolveu" (dado ausente) precisa ser tomada sobre
 * um valor estável, não sobre a redação da mensagem em português.
 *
 * @returns {{ok: true, value: *} | {ok: false, code: string, reason: string}}
 */
function resolveJsonPointer(document, pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) {
    return {
      ok: false,
      code: 'POINTER_MALFORMED',
      reason: 'o pointer deve ser uma string começando com "/"',
    };
  }
  const segments = pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current = document;
  for (const segment of segments) {
    if (segment === '__proto__' || segment === 'prototype' || segment === 'constructor') {
      return {
        ok: false,
        code: 'POINTER_SEGMENT_FORBIDDEN',
        reason: `segmento de pointer proibido: "${segment}"`,
      };
    }
    if (current === null || typeof current !== 'object') {
      return {
        ok: false,
        code: 'POINTER_TRAVERSES_NON_OBJECT',
        reason: 'o pointer atravessa um valor que não é objeto/array',
      };
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return {
        ok: false,
        code: 'POINTER_NOT_FOUND',
        reason: `o segmento "${segment}" não existe no documento`,
      };
    }
    current = current[segment];
  }
  if (current === undefined) {
    return { ok: false, code: 'POINTER_NOT_FOUND', reason: 'o pointer resolveu para undefined' };
  }
  return { ok: true, value: current };
}

// Códigos de falha de pointer que significam "o índice pediu algo inaceitável"
// (e não "o alvo não existe"). Trocar a redação de uma mensagem não pode
// reclassificar uma rejeição relevante para segurança como benigna.
const UNACCEPTABLE_POINTER_CODES = Object.freeze(['POINTER_MALFORMED', 'POINTER_SEGMENT_FORBIDDEN']);

/**
 * Cria uma `ContentSource` que lê um pacote de conteúdo por HTTP.
 *
 * `fetchFn` é SEMPRE injetado: este módulo nunca toca no `fetch` global, o que
 * mantém a fonte testável sem rede e deixa o controle de política
 * (cabeçalhos, `AbortSignal`, retry) com o composition root.
 *
 * @param {{baseUrl: URL|string, fetchFn: Function}} params
 * @returns {Readonly<{loadManifest: Function, loadIndex: Function, loadEntity: Function}>}
 */
export function HttpContentSource({ baseUrl, fetchFn } = {}) {
  const base = requireBaseUrl(baseUrl);
  if (typeof fetchFn !== 'function') {
    throw new TypeError('HttpContentSource: "fetchFn" deve ser uma função injetada (nunca o fetch global).');
  }

  // Cache de PROMESSAS por caminho: chamadas concorrentes ao mesmo arquivo
  // compartilham uma única requisição, e um arquivo-coleção referenciado por
  // dezenas de entries de índice (via `pointer`) é buscado uma só vez.
  // A entrada é REMOVIDA quando o carregamento falha, para permitir retry.
  /** @type {Map<string, Promise<import('../../core/result.js').Result>>} */
  const cacheByPath = new Map();

  // Mapa id -> entry do índice, montado uma vez por índice carregado.
  /** @type {Map<string, object> | null} */
  let entriesById = null;

  /**
   * Busca e faz o parse de um JSON do pacote, com cache por caminho.
   * @param {string} path - caminho relativo dentro do pacote.
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  function loadJson(path) {
    const cached = cacheByPath.get(path);
    if (cached !== undefined) {
      return cached;
    }
    const pending = fetchJson(path);
    cacheByPath.set(path, pending);
    // Invalida a entrada quando o carregamento falha (Result de erro ou
    // rejeição inesperada), para que uma falha transitória de rede não
    // "congele" o pacote inteiro num estado quebrado.
    pending.then(
      (result) => {
        if (result === null || typeof result !== 'object' || result.ok !== true) {
          cacheByPath.delete(path);
        }
      },
      () => {
        cacheByPath.delete(path);
      },
    );
    return pending;
  }

  /**
   * Faz a requisição de um caminho já validado nas duas camadas.
   * @param {string} path
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function fetchJson(path) {
    const safePath = assertSafeContentPath(path);
    if (!safePath.ok) {
      return safePath;
    }
    const url = resolveContentUrl(safePath.value, base);
    if (!url.ok) {
      return url;
    }

    let response;
    try {
      response = await fetchFn(url.value.href, { cache: 'no-store', credentials: 'omit' });
    } catch (cause) {
      return err(
        sourceError(
          'CONTENT_HTTP_REQUEST_FAILED',
          `A requisição de "${path}" falhou (rede indisponível ou requisição abortada).`,
          { path, url: url.value.href },
          cause,
        ),
      );
    }

    if (response === null || typeof response !== 'object' || typeof response.json !== 'function') {
      return err(
        sourceError('CONTENT_HTTP_INVALID_RESPONSE', `A resposta de "${path}" não é uma Response utilizável.`, {
          path,
          receivedType: response === null ? 'null' : typeof response,
        }),
      );
    }
    if (response.ok !== true) {
      return err(
        sourceError('CONTENT_HTTP_STATUS', `A requisição de "${path}" respondeu com status ${response.status}.`, {
          path,
          url: url.value.href,
          status: typeof response.status === 'number' ? response.status : null,
        }),
      );
    }

    let parsed;
    try {
      parsed = await response.json();
    } catch (cause) {
      return err(
        sourceError('CONTENT_HTTP_INVALID_JSON', `O conteúdo de "${path}" não é JSON válido.`, { path }, cause),
      );
    }
    return ok(parsed);
  }

  /**
   * Carrega o manifesto do pacote (caminho fixo).
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function loadManifest() {
    return loadJson(MANIFEST_FILE_NAME);
  }

  /**
   * Carrega o índice do pacote (caminho fixo) e memoriza o mapa id -> entry.
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function loadIndex() {
    return loadJson(INDEX_FILE_NAME);
  }

  /**
   * Devolve o mapa id -> entry do índice, carregando o índice se necessário.
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function getEntries() {
    if (entriesById !== null) {
      return ok(entriesById);
    }
    const indexResult = await loadJson(INDEX_FILE_NAME);
    if (!indexResult.ok) {
      return indexResult;
    }
    const index = indexResult.value;
    if (index === null || typeof index !== 'object' || !Array.isArray(index.entries)) {
      return err(
        sourceError('CONTENT_INDEX_MALFORMED', 'O índice do pacote não tem um array "entries".', {
          path: INDEX_FILE_NAME,
        }),
      );
    }
    const map = new Map();
    for (const entry of index.entries) {
      if (entry === null || typeof entry !== 'object' || typeof entry.id !== 'string') {
        continue;
      }
      if (!map.has(entry.id)) {
        map.set(entry.id, entry);
      }
    }
    entriesById = map;
    return ok(map);
  }

  /**
   * Carrega uma entidade pelo ContentId declarado no índice.
   *
   * O `path`/`pointer` da entry é dado NÃO CONFIÁVEL: passa pelas duas camadas
   * de validação de caminho e pelo resolvedor restrito de JSON Pointer.
   *
   * @param {*} id
   * @returns {Promise<import('../../core/result.js').Result>}
   */
  async function loadEntity(id) {
    if (typeof id !== 'string' || id.length === 0) {
      return err(
        sourceError('CONTENT_ENTITY_ID_INVALID', 'O id da entidade deve ser uma string não vazia.', {
          receivedType: id === null ? 'null' : typeof id,
        }),
      );
    }

    const entries = await getEntries();
    if (!entries.ok) {
      return entries;
    }
    const entry = entries.value.get(id) ?? null;
    if (entry === null) {
      return err(
        sourceError('CONTENT_ENTITY_NOT_INDEXED', `O índice do pacote não declara a entidade "${id}".`, { id }),
      );
    }

    const safePath = assertSafeContentPath(entry.path);
    if (!safePath.ok) {
      return err(
        sourceError(
          'CONTENT_PATH_REJECTED',
          `O índice declara um caminho inaceitável para a entidade "${id}".`,
          { id, path: typeof entry.path === 'string' ? entry.path : null, reason: safePath.error.context.reason },
        ),
      );
    }

    const fileResult = await loadJson(safePath.value);
    if (!fileResult.ok) {
      return fileResult;
    }

    if (entry.pointer === undefined) {
      return ok(fileResult.value);
    }

    const resolvedPointer = resolveJsonPointer(fileResult.value, entry.pointer);
    if (!resolvedPointer.ok && UNACCEPTABLE_POINTER_CODES.includes(resolvedPointer.code)) {
      return err(
        sourceError('CONTENT_ENTITY_POINTER_INVALID', `O pointer da entidade "${id}" é inaceitável.`, {
          id,
          path: safePath.value,
          pointer: typeof entry.pointer === 'string' ? entry.pointer : null,
          pointerCode: resolvedPointer.code,
          reason: resolvedPointer.reason,
        }),
      );
    }
    if (!resolvedPointer.ok) {
      return err(
        sourceError(
          'CONTENT_ENTITY_POINTER_UNRESOLVED',
          `O pointer "${String(entry.pointer)}" não resolveu nenhuma entidade em "${safePath.value}" (id "${id}").`,
          {
          id,
          path: safePath.value,
          pointer: String(entry.pointer),
          pointerCode: resolvedPointer.code,
          reason: resolvedPointer.reason,
        },
        ),
      );
    }
    return ok(resolvedPointer.value);
  }

  // Exatamente os três métodos do contrato ContentSource.
  return Object.freeze({ loadManifest, loadIndex, loadEntity });
}
