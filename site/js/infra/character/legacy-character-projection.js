// Módulo `infra/character/legacy-character-projection`: ponte entre o
// repositório transacional (que fala em `CharacterEnvelope`/modelo canônico)
// e o criador/ficha legados (`site/js/pages/creator.js`, `sheet.js`), que só
// conhecem o objeto plano do baseline (mesmo vocabulário de
// `criarPersonagemVazio`/`salvarPersonagem` do antigo `store.js`) e o mutam
// diretamente em memória antes de "salvar de volta".
//
// `createLegacyStoreFacade` reproduz a assinatura síncrona histórica
// (list/get/save/remove devolvendo objetos planos, nunca `Result`/`Promise`)
// exigida pelas páginas legadas, mas por baixo passa por
// `acceptLegacyCharacterMutation` -> `repository.save/remove`, preservando
// concorrência otimista via dois mapas privados:
//
//   - `objectTokenMap` (WeakMap<object, string|null>): liga cada objeto
//     plano DEVOLVIDO por `list/get/save` ao seu `revisionToken` no momento
//     da leitura. Só `save()` consulta este mapa.
//   - `idTokenMap` (Map<string, string>): liga cada id observado por
//     `list/get` ao seu `revisionToken` mais recente. Só `remove(id)`
//     consulta este mapa (a assinatura histórica de remoção não recebe o
//     objeto, só o id).
//
// Um objeto passado para `save()` que NÃO está em `objectTokenMap` (nunca
// veio de `list/get`, ou é uma cópia/clone) só é aceito se seu `id` ainda
// não existir no repositório (criação legítima — o "objeto novo" do
// `criarPersonagemVazio()` do `store.js`, que nunca precisa de um passo de
// registro à parte: um id inédito já É o sinal de criação). Se o `id` já
// existir no repositório, é recusado como conflito — nunca relê o token
// atual silenciosamente em nome do chamador.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { decodeCharacterRecord } from './character-codec.js';

const SCOPE = 'infra.character.legacy-character-projection';

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Projeta um `CharacterEnvelope` (editável ou read-only) para o objeto plano
 * legado — uma cópia rasa do registro persistido exato (`rawRecord`), nunca
 * uma reconstrução via encode: o criador/ficha legados leem campos por nome
 * direto (`nome`, `nivel`, `atributos`, ...), presentes em ambos os modos.
 * @param {object} envelope - CharacterEnvelope
 * @returns {object} LegacyCharacterRecord (cópia rasa; mutar não afeta o repositório)
 */
export function projectLegacyCharacterEnvelope(envelope) {
  if (!isPlainObject(envelope) || (envelope.mode !== 'editable' && envelope.mode !== 'read-only')) {
    throw new TypeError('projectLegacyCharacterEnvelope: "envelope" deve ser um CharacterEnvelope.');
  }
  // `rawRecord` é o mesmo campo em ambos os modos (ver comentário do
  // repositório sobre `buildEnvelope`) — não há ramificação real aqui além
  // da checagem de forma acima.
  return { ...envelope.rawRecord };
}

/**
 * Decodifica um objeto plano legado (possivelmente mutado em memória pelo
 * criador/ficha) de volta para o personagem canônico v2. Só aceita registros
 * que decodificam em modo editável — um registro de schema futuro/colisão
 * reservada nunca pode ser "salvo de volta" pelo caminho legado (ele nunca
 * deveria ter sido oferecido para edição em primeiro lugar).
 * @param {object} record - LegacyCharacterRecord (possivelmente mutado)
 * @param {{aliasResolver: object, now: string}} context
 * @returns {import('../../core/result.js').Result} Result<CanonicalCharacter, AppError>
 */
export function acceptLegacyCharacterMutation(record, context = {}) {
  const decoded = decodeCharacterRecord(record, context);
  if (!decoded.ok) {
    return decoded;
  }
  if (decoded.value.mode !== 'editable') {
    return err(
      createAppError({
        code: 'CHARACTER_LEGACY_MUTATION_UNSUPPORTED_SCHEMA',
        scope: SCOPE,
        message: 'Este registro não pode ser editado pelo criador/ficha legados (schema futuro ou colisão de campo reservado).',
        context: { detectedVersion: decoded.value.detectedVersion ?? null },
      }),
    );
  }
  return ok(decoded.value.character);
}

/**
 * Cria a fachada legada síncrona (list/get/save/remove com objetos planos,
 * nunca `Result`) usada por `site/js/store.js` enquanto criador/ficha não
 * migraram para o modelo canônico (Task 25+).
 * @param {{repository: object, aliasResolver: object, clock?: {now: () => string}}} params
 * @returns {Readonly<{list: Function, get: Function, save: Function, remove: Function}>}
 */
export function createLegacyStoreFacade({ repository, aliasResolver, clock } = {}) {
  if (repository === null || typeof repository !== 'object' || typeof repository.list !== 'function') {
    throw new TypeError('createLegacyStoreFacade: "repository" é obrigatório.');
  }
  if (aliasResolver === null || typeof aliasResolver !== 'object' || typeof aliasResolver.reverseResolve !== 'function') {
    throw new TypeError('createLegacyStoreFacade: "aliasResolver" é obrigatório.');
  }
  const now = typeof clock?.now === 'function' ? clock.now : () => new Date().toISOString();

  /** @type {WeakMap<object, string|null>} */
  const objectTokenMap = new WeakMap();
  /** @type {Map<string, string>} */
  const idTokenMap = new Map();

  /**
   * @param {object} envelope
   * @returns {object}
   */
  function projectAndTrack(envelope) {
    const projected = projectLegacyCharacterEnvelope(envelope);
    objectTokenMap.set(projected, envelope.revisionToken);
    const id = envelope.mode === 'editable' ? envelope.character.identity.id : envelope.rawRecord?.id;
    if (typeof id === 'string' && id.length > 0) {
      idTokenMap.set(id, envelope.revisionToken);
    }
    return projected;
  }

  /**
   * @returns {import('../../core/result.js').Result} Result<Array<object>, AppError> (uso interno; o retorno público é sempre um array simples — ver `list`)
   */
  function list() {
    const result = repository.list();
    if (!result.ok) {
      throw new LegacyStoreFacadeError(result.error);
    }
    return result.value.characters.map(projectAndTrack);
  }

  /**
   * @param {string} id
   * @returns {object | null}
   */
  function get(id) {
    const result = repository.get(id);
    if (!result.ok) {
      throw new LegacyStoreFacadeError(result.error);
    }
    if (result.value === null) {
      return null;
    }
    return projectAndTrack(result.value);
  }

  /**
   * @param {object} record - LegacyCharacterRecord (possivelmente mutado em memória).
   * @param {{localSyncMutationId?: string}} [options] - `localSyncMutationId` é
   *   repassado INTACTO ao repositório para que o registro gravado carregue o
   *   marcador `_local_sync.lastMutationId` da mutação em curso. É o que
   *   permite ao protocolo durável (`infra/sync/durable-character-mutation`)
   *   reconhecer, num boot seguinte, que a escrita local deste `mutationId`
   *   realmente foi adotada. Ausente, o repositório preserva o marcador que
   *   já estava no registro (comportamento anterior, inalterado).
   * @returns {object} o próprio registro salvo (projeção atualizada).
   */
  function save(record, { localSyncMutationId } = {}) {
    if (!isPlainObject(record) || typeof record.id !== 'string' || record.id.length === 0) {
      throw new LegacyStoreFacadeError(
        createAppError({ code: 'CHARACTER_LEGACY_FACADE_INVALID_INPUT', scope: SCOPE, message: 'save() exige um objeto com "id".' }),
      );
    }

    let expectedRevisionToken;
    if (objectTokenMap.has(record)) {
      expectedRevisionToken = objectTokenMap.get(record);
    } else {
      const existing = repository.get(record.id);
      if (!existing.ok) {
        throw new LegacyStoreFacadeError(existing.error);
      }
      if (existing.value !== null) {
        // Existe no repositório mas este objeto não veio de list/get (é uma
        // cópia/clone, ou foi construído à mão com um id existente): nunca
        // relemos o token atual em nome do chamador — força reload explícito.
        throw new LegacyStoreFacadeError(
          createAppError({
            code: 'CHARACTER_LEGACY_FACADE_STALE_OBJECT',
            scope: SCOPE,
            message: `O objeto passado para save() não foi obtido de list()/get() e já existe um personagem com id "${record.id}"; recarregue antes de salvar.`,
            context: { id: record.id },
          }),
        );
      }
      expectedRevisionToken = null; // id inédito: criação legítima.
    }

    const decoded = acceptLegacyCharacterMutation(record, { aliasResolver, now: now() });
    if (!decoded.ok) {
      throw new LegacyStoreFacadeError(decoded.error);
    }

    const saved = repository.save(decoded.value, {
      expectedRevisionToken,
      reason: 'user',
      // `undefined` mantém a semântica histórica (o repositório preserva o
      // `_local_sync` existente); só um id real é repassado.
      ...(typeof localSyncMutationId === 'string' && localSyncMutationId.length > 0 ? { localSyncMutationId } : {}),
    });
    if (!saved.ok) {
      throw new LegacyStoreFacadeError(saved.error);
    }

    // O criador/ficha legados mutam `record` (= `char`) IN PLACE e chamam
    // `salvar()` repetidas vezes sobre a MESMA referência, sem nunca
    // reatribuir `char` ao retorno de `salvarPersonagem` (ver
    // site/js/pages/sheet.js#salvar). Sem isto, a segunda chamada usaria o
    // token PRÉ-escrita (agora obsoleto) e seria recusada como conflito de
    // revisão consigo mesma. Também atualiza a projeção nova devolvida (caso
    // o chamador prefira usar o valor de retorno em vez do objeto original).
    objectTokenMap.set(record, saved.value.revisionToken);
    idTokenMap.set(record.id, saved.value.revisionToken);
    return projectAndTrack(saved.value);
  }

  /**
   * @param {string} id
   * @returns {void}
   */
  function remove(id) {
    if (!idTokenMap.has(id)) {
      throw new LegacyStoreFacadeError(
        createAppError({
          code: 'CHARACTER_LEGACY_FACADE_REMOVE_TOKEN_MISSING',
          scope: SCOPE,
          message: `remove("${id}") exige que o personagem tenha sido observado por list()/get() nesta sessão.`,
          context: { id },
        }),
      );
    }
    const token = idTokenMap.get(id);
    const result = repository.remove(id, { expectedRevisionToken: token });
    if (!result.ok) {
      throw new LegacyStoreFacadeError(result.error);
    }
    idTokenMap.delete(id);
  }

  return Object.freeze({ list, get, save, remove });
}

/**
 * Erro lançado pela fachada legada (síncrona, sem `Result`) para preservar a
 * assinatura histórica de `store.js` (funções que ou devolvem o dado ou
 * lançam) — `site/js/store.js` é responsável por capturar e traduzir para o
 * comportamento exato que cada função pública antiga já tinha (ex.:
 * `listarPersonagens()` nunca lançava — devolvia `[]`).
 */
export class LegacyStoreFacadeError extends Error {
  /** @param {object} appError */
  constructor(appError) {
    super(appError?.message ?? 'Falha na fachada legada de personagens.');
    this.name = 'LegacyStoreFacadeError';
    this.appError = appError;
  }
}
