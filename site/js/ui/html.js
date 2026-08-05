// Módulo `ui/html`: os sinks seguros de texto/atributo/URL da fronteira de
// interface. Todo valor derivado de conteúdo NÃO CONFIÁVEL (pacotes em
// `dados/pacotes/**`, personagens importados, campos digitados pelo usuário,
// perfil do provedor de autenticação) que for parar no DOM tem de passar por
// uma das funções deste módulo.
//
// Princípios (não negociáveis, ver Task 24 do plano de refatoração):
//
//  1. ALLOWLIST, nunca blacklist. Nada aqui procura "o que é perigoso" para
//     remover; tudo aqui descreve exatamente o que é aceito e rejeita o resto.
//  2. Nenhuma string de conteúdo pode virar handler de evento, esquema de URL
//     executável (`javascript:`), markup, ou nome de atributo.
//  3. Falhas são valores (`Result`), não exceções: quem chama decide se
//     esconde o elemento, usa um placeholder ou registra o problema.

import { ok, err } from '../core/result.js';
import { createAppError } from '../core/errors.js';

const SCOPE = 'ui/html';

const HTML_TEXT_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

// Contexto de atributo é mais frágil que contexto de texto: além dos cinco
// caracteres acima, um valor injetado pode fechar um atributo sem aspas
// (espaço, tabulação, quebra de linha), abrir um novo atributo (`=`) ou
// iniciar um template literal em atributos processados por frameworks
// (crase). Por isso o conjunto de escape de atributo é ESTRITAMENTE MAIOR
// que o de texto — nunca reutilize `escapeHtml` para montar atributos.
const HTML_ATTRIBUTE_EXTRA_ESCAPES = Object.freeze({
  '`': '&#96;',
  '=': '&#61;',
  '/': '&#47;',
  ' ': '&#32;',
  '\t': '&#9;',
  '\n': '&#10;',
  '\r': '&#13;',
  '\f': '&#12;',
});

const HTML_ATTRIBUTE_ESCAPES = Object.freeze({ ...HTML_TEXT_ESCAPES, ...HTML_ATTRIBUTE_EXTRA_ESCAPES });

const HTML_TEXT_PATTERN = /[&<>"']/g;
const HTML_ATTRIBUTE_PATTERN = /[&<>"'`=/ \t\n\r\f]/g;

/**
 * Modos aceitos por `resolveSafeUrl`. É um enum FECHADO: um `kind` fora desta
 * lista é rejeitado, nunca tratado como "modo permissivo padrão".
 * @type {Readonly<{characterImage: 'character-image', googleAvatar: 'google-avatar', appLink: 'app-link'}>}
 */
export const SAFE_URL_KINDS = Object.freeze({
  characterImage: 'character-image',
  googleAvatar: 'google-avatar',
  appLink: 'app-link',
});

const SAFE_URL_KIND_VALUES = Object.freeze(Object.values(SAFE_URL_KINDS));

// --- Allowlist 1: imagem persistida do personagem -------------------------
//
// O campo `personagem.imagem` é produzido por `processarImagemArquivo`
// (site/js/utils.js) como data URL e viaja junto do personagem por
// localStorage, exportação/importação de JSON e Firestore. Ou seja: chega de
// volta como conteúdo arbitrário controlável pelo usuário (basta editar o
// JSON exportado). Só data URLs de imagem raster, em base64, com bytes
// coerentes com o MIME declarado, são aceitas.
//
// SVG fica DE FORA de propósito: `image/svg+xml` é um documento XML que pode
// conter `<script>` e handlers, e o navegador o executa em vários contextos.
const CHARACTER_IMAGE_MIME_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);

// Assinaturas de arquivo (magic bytes) exigidas por MIME. Sem esta checagem,
// `data:image/png;base64,<qualquer coisa>` passaria só por declarar um MIME
// aceito — inclusive um documento SVG/HTML renomeado.
const CHARACTER_IMAGE_MAGIC_BYTES = Object.freeze({
  'image/png': Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': Object.freeze([0xff, 0xd8, 0xff]),
  // WebP é um contêiner RIFF: "RIFF" + 4 bytes de tamanho + "WEBP".
  'image/webp': Object.freeze([0x52, 0x49, 0x46, 0x46]),
});

const WEBP_CONTAINER_TAG = Object.freeze([0x57, 0x45, 0x42, 0x50]);

const CHARACTER_IMAGE_DATA_URL_PATTERN = /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Teto de bytes de uma imagem de personagem persistida.
 *
 * PROVENIÊNCIA (não é um literal inventado nem duplicado): a Task 2 congelou
 * em `tests/fixtures/characters/near-limits.json` o maior data URL aceito
 * pelo fluxo de baseline e, no caso `imagem-proximo-do-limite`, registrou
 * explicitamente de onde esse teto vem no campo `cotaAceitaDerivadaDe`:
 * `"firestoreDocumentLimitBytes (ver caso limites-de-payload-conhecidos)"`.
 * Aquela fixture NÃO tem uma chave chamada `characterImageMaxBytes` — o app
 * baseline não faz nenhuma checagem de tamanho de imagem, então o único teto
 * real e nomeado é o limite de documento do Firestore (1 MiB), que é quem de
 * fato barra a persistência.
 *
 * O valor daqui é amarrado à fixture por `tests/unit/ui/html.test.js`, que
 * falha se este número divergir de `firestoreDocumentLimitBytes` OU se a
 * imagem de baseline (1.046.575 bytes) deixar de ser aceita. É assim que o
 * limite não pode ser reduzido nem apagado silenciosamente.
 *
 * A comparação é feita sobre o comprimento do data URL em bytes; como o
 * padrão aceito é 100% ASCII (`CHARACTER_IMAGE_DATA_URL_PATTERN`), o
 * comprimento da string em UTF-16 é igual ao número de bytes em UTF-8.
 * @type {number}
 */
export const CHARACTER_IMAGE_MAX_BYTES = 1048576;

// --- Allowlist 2: avatar do provedor Google -------------------------------
//
// `usuario.photoURL` vem do SDK do Firebase Auth; é conteúdo de terceiro e
// não deve poder apontar para um host arbitrário (vazamento de referer,
// rastreamento, ou pixel de origem controlada pelo atacante em conta
// comprometida). Bate com o `img-src https://*.googleusercontent.com` do CSP
// de `site/index.html`.
const GOOGLE_AVATAR_HOST_SUFFIX = '.googleusercontent.com';
const GOOGLE_AVATAR_HOST_EXACT = 'googleusercontent.com';

// --- Allowlist 3: links fixos da aplicação --------------------------------
//
// Links externos da aplicação são uma lista FECHADA de URLs exatas — os dois
// destinos de "Reportar Problema" (site/js/app.js). Qualquer outro destino
// externo tem de ser adicionado aqui conscientemente; nenhum link externo
// pode nascer de conteúdo.
const APP_EXTERNAL_LINK_ALLOWLIST = Object.freeze([
  'https://www.reddit.com/r/rpgbrasil/comments/1sgrj1j/criador_de_ficha_dd_55_2024_web_e_mobile_gratuito/',
  'https://www.reddit.com/user/ZaitBrz/',
]);

const APP_LINK_LOCAL_PROTOCOLS = Object.freeze(['http:', 'https:']);

/**
 * Cria o AppError padronizado deste módulo.
 * @param {string} code - código estável do erro.
 * @param {string} message - mensagem legível em português.
 * @param {object} [context] - dados estruturados do erro (nunca o valor bruto completo).
 * @returns {Readonly<object>}
 */
function urlError(code, message, context) {
  return createAppError({ code, scope: SCOPE, message, context: context ?? null });
}

/**
 * Escapa os cinco caracteres significativos de HTML em CONTEXTO DE TEXTO.
 * Mantém exatamente o mesmo mapeamento do `escHtml` legado de
 * `site/js/utils.js` (inclusive `'` -> `&#39;`), porque aquela função passa a
 * delegar para esta e nenhum consumidor legado pode ver saída diferente.
 *
 * NÃO é adequada para montar atributos (use `escapeHtmlAttribute`) nem para
 * validar URLs (use `resolveSafeUrl`).
 * @param {*} value - qualquer valor; `null`/`undefined` viram string vazia.
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(HTML_TEXT_PATTERN, (character) => HTML_TEXT_ESCAPES[character]);
}

/**
 * Escapa um valor para uso dentro de um VALOR DE ATRIBUTO HTML. Além dos
 * cinco caracteres de texto, neutraliza os caracteres que permitiriam
 * encerrar um atributo sem aspas e começar outro (espaço, tabulação, quebras
 * de linha, `=`, `/`, crase) — de modo que o valor seja inerte mesmo em
 * markup mal formado.
 * @param {*} value - qualquer valor; `null`/`undefined` viram string vazia.
 * @returns {string}
 */
export function escapeHtmlAttribute(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(HTML_ATTRIBUTE_PATTERN, (character) => HTML_ATTRIBUTE_ESCAPES[character]);
}

/**
 * Escreve `value` como TEXTO dentro de `element`, sem nunca interpretar o
 * conteúdo como markup. É o sink preferencial: não existe caminho de escape
 * possível a partir de `textContent`, ao contrário de `innerHTML` + escape
 * manual (que depende de o escape estar correto em todos os pontos).
 * @param {object} element - elemento DOM alvo.
 * @param {*} value - qualquer valor; `null`/`undefined` viram string vazia.
 * @returns {void}
 */
export function setSafeText(element, value) {
  if (!element || typeof element !== 'object' || !('textContent' in element)) {
    throw new TypeError('setSafeText: "element" deve ser um nó DOM com textContent.');
  }
  element.textContent = value === null || value === undefined ? '' : String(value);
}

/**
 * Decodifica base64 para bytes. Devolve `null` quando a string não é base64
 * válido (payload truncado, caractere fora do alfabeto, comprimento que não é
 * múltiplo de 4) — nunca lança.
 * @param {string} base64
 * @returns {Uint8Array | null}
 */
function decodeBase64(base64) {
  if (base64.length === 0 || base64.length % 4 !== 0) {
    return null;
  }
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Verifica se `bytes` começa com a assinatura exigida pelo `mimeType`
 * declarado (e, no caso de WebP, também com a tag "WEBP" na posição 8).
 * @param {string} mimeType
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
function magicBytesMatchMime(mimeType, bytes) {
  const expected = CHARACTER_IMAGE_MAGIC_BYTES[mimeType];
  if (!expected || bytes.length < expected.length) {
    return false;
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[index] !== expected[index]) {
      return false;
    }
  }
  if (mimeType === 'image/webp') {
    if (bytes.length < 12) {
      return false;
    }
    for (let index = 0; index < WEBP_CONTAINER_TAG.length; index += 1) {
      if (bytes[8 + index] !== WEBP_CONTAINER_TAG[index]) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Valida o modo `character-image`: data URL, base64, MIME raster da
 * allowlist, bytes coerentes com o MIME e tamanho dentro do teto.
 * @param {string} value
 * @returns {{ok: true, value: object} | {ok: false, error: object}}
 */
function resolveCharacterImageUrl(value) {
  const match = CHARACTER_IMAGE_DATA_URL_PATTERN.exec(value);
  if (!match) {
    return err(
      urlError(
        'UI_URL_CHARACTER_IMAGE_FORMAT',
        'Imagem de personagem deve ser um data URL base64 de image/png, image/jpeg ou image/webp.',
        { comprimento: value.length, prefixo: value.slice(0, 32) },
      ),
    );
  }

  const [, mimeType, base64] = match;
  if (!CHARACTER_IMAGE_MIME_TYPES.includes(mimeType)) {
    // Inalcançável enquanto o padrão e a lista estiverem sincronizados; fica
    // como trava explícita caso alguém edite só um dos dois.
    return err(
      urlError('UI_URL_CHARACTER_IMAGE_MIME', `MIME "${mimeType}" não está na allowlist de imagem de personagem.`, {
        mimeType,
      }),
    );
  }

  if (value.length > CHARACTER_IMAGE_MAX_BYTES) {
    return err(
      urlError('UI_URL_CHARACTER_IMAGE_TOO_LARGE', 'Imagem de personagem excede o tamanho máximo permitido.', {
        bytes: value.length,
        maximoBytes: CHARACTER_IMAGE_MAX_BYTES,
      }),
    );
  }

  const bytes = decodeBase64(base64);
  if (bytes === null) {
    return err(
      urlError('UI_URL_CHARACTER_IMAGE_BASE64', 'Payload base64 da imagem de personagem é inválido ou está truncado.', {
        mimeType,
        comprimentoBase64: base64.length,
      }),
    );
  }

  if (!magicBytesMatchMime(mimeType, bytes)) {
    return err(
      urlError('UI_URL_CHARACTER_IMAGE_MIME_MISMATCH', 'Bytes da imagem não correspondem ao MIME declarado.', {
        mimeType,
        primeirosBytes: Array.from(bytes.slice(0, 8)),
      }),
    );
  }

  return ok(new URL(value));
}

/**
 * Valida o modo `google-avatar`: somente https em `*.googleusercontent.com`,
 * sem credenciais embutidas.
 * @param {string} value
 * @returns {{ok: true, value: object} | {ok: false, error: object}}
 */
function resolveGoogleAvatarUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return err(urlError('UI_URL_MALFORMED', 'URL de avatar não pôde ser interpretada.', { prefixo: value.slice(0, 64) }));
  }

  if (parsed.protocol !== 'https:') {
    return err(
      urlError('UI_URL_GOOGLE_AVATAR_PROTOCOL', 'Avatar do Google só é aceito por https.', { protocolo: parsed.protocol }),
    );
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return err(urlError('UI_URL_GOOGLE_AVATAR_CREDENTIALS', 'URL de avatar não pode conter credenciais.', {}));
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== GOOGLE_AVATAR_HOST_EXACT && !host.endsWith(GOOGLE_AVATAR_HOST_SUFFIX)) {
    return err(
      urlError('UI_URL_GOOGLE_AVATAR_HOST', 'Host do avatar não está na allowlist do provedor Google.', { host }),
    );
  }
  return ok(parsed);
}

/**
 * Valida o modo `app-link`: ou é uma das URLs externas fixas da allowlist da
 * aplicação, ou é um link LOCAL que continua dentro da raiz servida
 * (`baseUrl`), sem sair dela por travessia de caminho.
 * @param {string} value
 * @param {*} baseUrl
 * @returns {{ok: true, value: object} | {ok: false, error: object}}
 */
function resolveAppLinkUrl(value, baseUrl) {
  if (APP_EXTERNAL_LINK_ALLOWLIST.includes(value)) {
    return ok(new URL(value));
  }

  if (baseUrl === undefined || baseUrl === null || baseUrl === '') {
    return err(
      urlError('UI_URL_APP_LINK_NOT_ALLOWED', 'Link não está na allowlist fixa e nenhuma baseUrl local foi informada.', {
        prefixo: value.slice(0, 64),
      }),
    );
  }

  let base;
  try {
    base = baseUrl instanceof URL ? baseUrl : new URL(String(baseUrl));
  } catch {
    return err(urlError('UI_URL_APP_LINK_BASE', 'baseUrl informada não é uma URL válida.', {}));
  }

  // Separador de caminho CODIFICADO (`%2f`, `%5c`): `new URL` não o
  // normaliza, então `/site/..%2f..%2fetc/passwd` continuaria "dentro" da
  // raiz para a checagem de prefixo abaixo — mas vários servidores decodificam
  // antes de resolver o caminho, e aí a travessia acontece de verdade. Como a
  // allowlist é fechada, o caso é simplesmente rejeitado.
  if (/%2f|%5c/i.test(value)) {
    return err(
      urlError('UI_URL_APP_LINK_ENCODED_SEPARATOR', 'Link local não pode conter separador de caminho codificado.', {
        prefixo: value.slice(0, 64),
      }),
    );
  }

  let parsed;
  try {
    parsed = new URL(value, base);
  } catch {
    return err(urlError('UI_URL_MALFORMED', 'Link não pôde ser interpretado.', { prefixo: value.slice(0, 64) }));
  }

  if (!APP_LINK_LOCAL_PROTOCOLS.includes(parsed.protocol)) {
    return err(
      urlError('UI_URL_APP_LINK_PROTOCOL', 'Link local só pode usar http ou https.', { protocolo: parsed.protocol }),
    );
  }
  if (parsed.origin !== base.origin) {
    return err(
      urlError('UI_URL_APP_LINK_ORIGIN', 'Link local aponta para outra origem.', { origem: parsed.origin }),
    );
  }

  // Confinamento à raiz: o caminho resolvido tem de continuar dentro do
  // diretório da base. `new URL` já normaliza `..`/`.`, então uma tentativa de
  // travessia (`../../etc/passwd`, `..%2f..%2f`) chega aqui com o caminho já
  // reduzido e simplesmente não passa neste teste.
  const baseDirectory = base.pathname.endsWith('/') ? base.pathname : base.pathname.replace(/[^/]*$/, '');
  if (!parsed.pathname.startsWith(baseDirectory)) {
    return err(
      urlError('UI_URL_APP_LINK_ESCAPES_ROOT', 'Link local sai da raiz da aplicação.', {
        caminho: parsed.pathname,
        raiz: baseDirectory,
      }),
    );
  }

  return ok(parsed);
}

/**
 * Resolve e valida uma URL de acordo com o modo (`kind`) pedido, devolvendo
 * `Result<URL, AppError>`. Nunca lança para entrada inválida: URL malformada,
 * esquema não permitido, host fora da allowlist e payload de imagem inválido
 * são todos falhas de domínio representadas por `err(...)`.
 *
 * Cada modo tem a SUA allowlist, deliberadamente separada das outras:
 *  - `character-image`: data URL raster (png/jpeg/webp) em base64, com bytes
 *    coerentes com o MIME e dentro de `CHARACTER_IMAGE_MAX_BYTES`.
 *  - `google-avatar`: https em `*.googleusercontent.com`.
 *  - `app-link`: URLs externas fixas da aplicação, ou links locais confinados
 *    à raiz de `baseUrl`.
 *
 * @param {*} value - valor bruto (tipicamente conteúdo não confiável).
 * @param {{kind: string, baseUrl?: (string|URL)}} options
 * @returns {{ok: true, value: URL} | {ok: false, error: object}}
 */
export function resolveSafeUrl(value, options) {
  const kind = options && typeof options === 'object' ? options.kind : undefined;
  if (!SAFE_URL_KIND_VALUES.includes(kind)) {
    return err(
      urlError('UI_URL_UNKNOWN_KIND', 'Modo de URL desconhecido; "kind" é um enum fechado.', {
        kind: kind === undefined ? null : String(kind),
        modosAceitos: SAFE_URL_KIND_VALUES,
      }),
    );
  }

  if (typeof value !== 'string' || value === '') {
    return err(urlError('UI_URL_EMPTY', 'Valor de URL ausente ou não textual.', { tipo: typeof value }));
  }

  switch (kind) {
    case SAFE_URL_KINDS.characterImage:
      return resolveCharacterImageUrl(value);
    case SAFE_URL_KINDS.googleAvatar:
      return resolveGoogleAvatarUrl(value);
    case SAFE_URL_KINDS.appLink:
      return resolveAppLinkUrl(value, options.baseUrl);
    default:
      // Inalcançável: o enum já foi validado acima.
      return err(urlError('UI_URL_UNKNOWN_KIND', 'Modo de URL desconhecido.', { kind }));
  }
}

/**
 * Lista (congelada) das URLs externas fixas aceitas pelo modo `app-link`.
 * Exportada para que os testes possam provar que a allowlist é fechada e para
 * que o shell monte seus links a partir da MESMA fonte que os valida.
 * @returns {ReadonlyArray<string>}
 */
export function getAppExternalLinkAllowlist() {
  return APP_EXTERNAL_LINK_ALLOWLIST;
}
