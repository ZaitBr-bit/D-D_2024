// Módulo `content/reference-migrations`: resolve e aplica cadeias de
// migração de referências de conteúdo entre versões de um mesmo pacote.
//
// Quando um personagem foi salvo apontando para `pacote@1.0.0` e o pacote
// ativo agora é `1.2.0`, cada referência (ContentId) e cada escolha guardada
// na ficha precisa ser traduzida. O manifesto declara essas traduções em
// `manifest.referenceMigrations`, uma lista de arestas versão->versão:
//
// ```json
// {
//   "from": "1.0.0",
//   "to": "1.1.0",
//   "entities": { "ns:spell:antigo": "ns:spell:novo" },
//   "choices":  { "opcao-antiga": "opcao-nova" },
//   "removed":  ["ns:feat:extinto"]
// }
// ```
//
// `entities` traduz ContentIds; `choices` traduz slugs locais de escolha;
// `removed` marca referências que deixaram de existir — nesse caso não há
// migração possível e a ficha deve ficar somente leitura com
// `CONTENT_VERSION_MIGRATION_REQUIRED`.
//
// Regras deliberadamente conservadoras (uma migração errada corrompe fichas
// já salvas):
//   - identidade (`from === to`) devolve cadeia vazia, sem tocar em nada;
//   - só existe cadeia se houver caminho declarado; lacuna devolve erro;
//   - ciclos entre versões nunca travam a busca;
//   - duas cadeias mínimas distintas são AMBÍGUAS e recusadas — escolher uma
//     "por sorte" produziria resultados diferentes conforme a ordem de
//     declaração;
//   - a cadeia é aplicada estritamente em ordem, e `migrateContentReference`
//     exige que ela seja contígua (`to` de um passo é o `from` do seguinte).

import { ok, err } from '../core/result.js';
import { createAppError } from '../core/errors.js';
import { parseContentId } from '../core/content-id.js';
import { parseSemVer } from '../core/semver.js';

const SCOPE = 'content.reference-migrations';

// Teto de arestas aceitas de um manifesto. `manifest.referenceMigrations` é
// JSON não confiável e a busca é O(V+E): mesmo linear, um manifesto com
// centenas de milhares de arestas seria um vetor de negação de serviço no
// carregamento de personagem (Task 12 chama esta função por referência de
// ficha). Um pacote real tem uma aresta por salto de versão publicado —
// 1000 é ordens de grandeza acima de qualquer histórico plausível.
const MAX_DECLARED_MIGRATIONS = 1000;

/**
 * Cria o AppError padrão de "não há cadeia de migração utilizável".
 * @param {string} message
 * @param {object} context
 */
function migrationRequired(message, context) {
  return createAppError({
    code: 'CONTENT_VERSION_MIGRATION_REQUIRED',
    scope: SCOPE,
    message,
    context,
  });
}

/**
 * Cria o AppError de manifesto de migrações malformado.
 * @param {string} message
 * @param {object} context
 */
function manifestInvalid(message, context) {
  return createAppError({
    code: 'CONTENT_MIGRATION_MANIFEST_INVALID',
    scope: SCOPE,
    message,
    context,
  });
}

/**
 * Verifica se `value` é um mapa simples de string->string com chaves e
 * valores não vazios, opcionalmente exigindo que ambos sejam ContentIds.
 * @param {*} value
 * @param {boolean} requireContentIds
 * @returns {boolean}
 */
function isRenameMap(value, requireContentIds) {
  if (value === undefined) {
    return true;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  for (const [from, to] of Object.entries(value)) {
    if (typeof to !== 'string' || from.length === 0 || to.length === 0) {
      return false;
    }
    if (requireContentIds && (!parseContentId(from).ok || !parseContentId(to).ok)) {
      return false;
    }
  }
  return true;
}

/**
 * Normaliza e valida uma declaração de migração do manifesto, devolvendo uma
 * cópia congelada ou `null` quando malformada.
 * @param {*} migration
 * @returns {Readonly<object> | null}
 */
function normalizeMigration(migration) {
  if (migration === null || typeof migration !== 'object' || Array.isArray(migration)) {
    return null;
  }
  const { from, to, entities, choices, removed } = migration;
  if (!parseSemVer(from).ok || !parseSemVer(to).ok || from === to) {
    return null;
  }
  if (!isRenameMap(entities, true) || !isRenameMap(choices, false)) {
    return null;
  }
  if (removed !== undefined) {
    if (!Array.isArray(removed) || removed.some((id) => !parseContentId(id).ok)) {
      return null;
    }
  }
  return Object.freeze({
    from,
    to,
    entities: Object.freeze({ ...(entities ?? {}) }),
    choices: Object.freeze({ ...(choices ?? {}) }),
    removed: Object.freeze([...(removed ?? [])]),
  });
}

/**
 * Busca em largura da menor cadeia de `from` até `to`, contando quantas
 * cadeias mínimas distintas existem.
 *
 * BFS (e não enumeração de caminhos): as arestas são todas de peso 1, então a
 * primeira vez que uma versão é alcançada já é pela menor distância. Isso é
 * O(V+E) e, por não visitar caminhos, é imune tanto a ciclos quanto à
 * explosão combinatória de um grafo denso — o grafo vem de
 * `manifest.referenceMigrations`, isto é, de JSON NÃO CONFIÁVEL, e enumerar
 * caminhos simples num DAG completo de ~20 versões já estoura a pilha.
 *
 * A contagem de cadeias mínimas (`shortestCount`) preserva a semântica de
 * ambiguidade: nós são retirados da fila em ordem não decrescente de
 * distância, então toda contribuição da camada `d` é somada antes de a camada
 * `d+1` ser processada. A contagem é saturada em 2 — só interessa saber se é
 * 1 ou "mais de 1".
 *
 * @param {Map<string, Array<Readonly<object>>>} edgesByFrom
 * @param {string} from
 * @param {string} to
 * @returns {{reachable: boolean, shortestCount: number, path: Array<Readonly<object>>}}
 */
function findShortestChain(edgesByFrom, from, to) {
  const distance = new Map([[from, 0]]);
  const shortestCount = new Map([[from, 1]]);
  // Aresta pela qual a versão foi alcançada na menor distância, para
  // reconstruir a cadeia sem guardar caminhos inteiros.
  const arrivalEdge = new Map();

  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    const currentDistance = distance.get(current);
    for (const edge of edgesByFrom.get(current) ?? []) {
      if (!distance.has(edge.to)) {
        distance.set(edge.to, currentDistance + 1);
        shortestCount.set(edge.to, shortestCount.get(current));
        arrivalEdge.set(edge.to, edge);
        queue.push(edge.to);
      } else if (distance.get(edge.to) === currentDistance + 1) {
        shortestCount.set(edge.to, Math.min(2, shortestCount.get(edge.to) + shortestCount.get(current)));
      }
    }
  }

  if (!distance.has(to)) {
    return { reachable: false, shortestCount: 0, path: [] };
  }

  const path = [];
  let cursor = to;
  while (cursor !== from) {
    const edge = arrivalEdge.get(cursor);
    path.push(edge);
    cursor = edge.from;
  }
  path.reverse();
  return { reachable: true, shortestCount: shortestCount.get(to), path };
}

/**
 * Encontra a cadeia de migrações de referência que leva de `fromVersion` a
 * `toVersion` no pacote descrito por `manifest`.
 *
 * @param {*} manifest - manifesto do pacote (usa `referenceMigrations`).
 * @param {*} fromVersion - SemVer de origem.
 * @param {*} toVersion - SemVer de destino.
 * @returns {import('../core/result.js').Result} Result<ReadonlyArray<ReferenceMigration>, AppError>
 */
export function findReferenceMigrationPath(manifest, fromVersion, toVersion) {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return err(
      manifestInvalid('O manifesto de migrações deve ser um objeto.', {
        receivedType: Array.isArray(manifest) ? 'array' : typeof manifest,
      }),
    );
  }
  if (!parseSemVer(fromVersion).ok || !parseSemVer(toVersion).ok) {
    return err(
      createAppError({
        code: 'CONTENT_VERSION_INVALID',
        scope: SCOPE,
        message: 'As versões de origem e destino devem ser SemVer estritos.',
        context: {
          fromVersion: typeof fromVersion === 'string' ? fromVersion : null,
          toVersion: typeof toVersion === 'string' ? toVersion : null,
        },
      }),
    );
  }

  // Identidade: nada a migrar, mesmo que existam migrações declaradas.
  if (fromVersion === toVersion) {
    return ok(Object.freeze([]));
  }

  const declared = manifest.referenceMigrations;
  if (declared !== undefined && !Array.isArray(declared)) {
    return err(
      manifestInvalid('manifest.referenceMigrations deve ser um array quando presente.', {
        receivedType: typeof declared,
      }),
    );
  }

  if ((declared ?? []).length > MAX_DECLARED_MIGRATIONS) {
    return err(
      manifestInvalid(
        `manifest.referenceMigrations declara ${declared.length} migrações, acima do limite de ${MAX_DECLARED_MIGRATIONS}.`,
        { declared: declared.length, limit: MAX_DECLARED_MIGRATIONS },
      ),
    );
  }

  const edgesByFrom = new Map();
  const seenEdges = new Set();
  for (const [position, raw] of (declared ?? []).entries()) {
    const migration = normalizeMigration(raw);
    if (migration === null) {
      return err(
        manifestInvalid(
          `A migração de referência na posição ${position} é malformada (from/to SemVer distintos e mapas de renomeação válidos são obrigatórios).`,
          { position },
        ),
      );
    }
    const edgeKey = `${migration.from}=>${migration.to}`;
    if (seenEdges.has(edgeKey)) {
      return err(
        manifestInvalid(
          `A migração de referência ${migration.from} -> ${migration.to} está declarada mais de uma vez.`,
          { position, from: migration.from, to: migration.to },
        ),
      );
    }
    seenEdges.add(edgeKey);
    if (!edgesByFrom.has(migration.from)) {
      edgesByFrom.set(migration.from, []);
    }
    edgesByFrom.get(migration.from).push(migration);
  }

  const search = findShortestChain(edgesByFrom, fromVersion, toVersion);

  if (!search.reachable) {
    return err(
      migrationRequired(
        `Não há cadeia de migração de referência declarada de ${fromVersion} para ${toVersion}.`,
        { reason: 'no-path', fromVersion, toVersion },
      ),
    );
  }

  if (search.shortestCount > 1) {
    return err(
      migrationRequired(
        `Há mais de uma cadeia mínima de migração de ${fromVersion} para ${toVersion}; a escolha seria arbitrária.`,
        { reason: 'ambiguous-path', fromVersion, toVersion },
      ),
    );
  }

  return ok(Object.freeze(search.path));
}

/**
 * Cria o AppError de cadeia de migração malformada.
 * @param {string} message
 * @param {object} context
 */
function pathInvalid(message, context) {
  return createAppError({
    code: 'CONTENT_MIGRATION_PATH_INVALID',
    scope: SCOPE,
    message,
    context,
  });
}

/**
 * Cria o AppError de referência de entrada inválida.
 * @param {string} message
 * @param {object} context
 */
function referenceInvalid(message, context) {
  return createAppError({
    code: 'CONTENT_REFERENCE_INVALID',
    scope: SCOPE,
    message,
    context,
  });
}

/**
 * Valida a cadeia recebida: array de migrações normalizadas e contígua
 * (o `to` de cada passo é o `from` do seguinte). A contiguidade é exigida
 * porque uma cadeia fora de ordem seria aplicada em silêncio e produziria um
 * id final diferente do esperado.
 * @param {*} migrationPath
 * @returns {object | null} AppError, ou null quando válida.
 */
function validateMigrationPath(migrationPath) {
  if (!Array.isArray(migrationPath)) {
    return pathInvalid('A cadeia de migração deve ser um array.', {
      receivedType: typeof migrationPath,
    });
  }
  let previous = null;
  for (const [position, step] of migrationPath.entries()) {
    if (normalizeMigration(step) === null) {
      return pathInvalid(`O passo ${position} da cadeia de migração é malformado.`, { position });
    }
    if (previous !== null && previous.to !== step.from) {
      return pathInvalid(
        `A cadeia de migração é descontínua: o passo ${position} parte de ${step.from}, mas o anterior chega em ${previous.to}.`,
        { position, expectedFrom: previous.to, receivedFrom: step.from },
      );
    }
    previous = step;
  }
  return null;
}

/**
 * Aplica um passo de migração a uma referência, respeitando `removed`.
 * @param {string} value
 * @param {Readonly<object>} step
 * @param {boolean} isContentId
 * @returns {{removed: true} | {removed: false, value: string}}
 */
function applyStep(value, step, isContentId) {
  if (isContentId && step.removed.includes(value)) {
    return { removed: true };
  }
  const map = isContentId ? step.entities : step.choices;
  return { removed: false, value: Object.hasOwn(map, value) ? map[value] : value };
}

/**
 * Migra uma referência de conteúdo e as escolhas associadas a ela por uma
 * cadeia de migrações já resolvida por `findReferenceMigrationPath`.
 *
 * `reference` aceita o ContentId nu (`"ns:spell:x"`) ou o `ContentRef`
 * estruturado (`{id, packageVersion}`). Cada item de `choiceRefs` é migrado
 * pelo mapa de entidades quando é um ContentId qualificado, ou pelo mapa de
 * escolhas quando é um slug local.
 *
 * @param {*} reference
 * @param {*} choiceRefs
 * @param {*} migrationPath
 * @returns {import('../core/result.js').Result} Result<MigratedContentReference, AppError>
 */
export function migrateContentReference(reference, choiceRefs, migrationPath) {
  const rawId = typeof reference === 'string' ? reference : reference?.id;
  const parsed = parseContentId(rawId);
  if (
    reference === null ||
    (typeof reference !== 'string' && typeof reference !== 'object') ||
    Array.isArray(reference) ||
    !parsed.ok
  ) {
    return err(
      referenceInvalid('A referência a migrar deve ser um ContentId ou um ContentRef {id, packageVersion}.', {
        reference: typeof rawId === 'string' ? rawId : null,
      }),
    );
  }

  const inputChoices = choiceRefs ?? [];
  if (!Array.isArray(inputChoices) || inputChoices.some((choice) => typeof choice !== 'string' || choice.length === 0)) {
    return err(
      referenceInvalid('choiceRefs deve ser um array de strings não vazias.', {
        receivedType: Array.isArray(inputChoices) ? 'array' : typeof inputChoices,
      }),
    );
  }

  const pathError = validateMigrationPath(migrationPath);
  if (pathError !== null) {
    return err(pathError);
  }

  const originalId = parsed.value.namespace + ':' + parsed.value.type + ':' + parsed.value.slug;
  let currentId = originalId;
  let currentChoices = [...inputChoices];

  for (const step of migrationPath) {
    const migratedId = applyStep(currentId, step, true);
    if (migratedId.removed) {
      return err(
        migrationRequired(
          `A referência "${currentId}" foi removida na migração ${step.from} -> ${step.to}; não há destino equivalente.`,
          { reason: 'reference-removed', reference: currentId, from: step.from, to: step.to },
        ),
      );
    }
    currentId = migratedId.value;

    const nextChoices = [];
    for (const choice of currentChoices) {
      const isContentId = parseContentId(choice).ok;
      const migratedChoice = applyStep(choice, step, isContentId);
      if (migratedChoice.removed) {
        return err(
          migrationRequired(
            `A escolha "${choice}" foi removida na migração ${step.from} -> ${step.to}; não há destino equivalente.`,
            { reason: 'reference-removed', reference: choice, from: step.from, to: step.to },
          ),
        );
      }
      nextChoices.push(migratedChoice.value);
    }
    currentChoices = nextChoices;
  }

  // Colisão pós-migração: duas escolhas distintas viraram a mesma. Recusar é
  // obrigatório — sobrescrever silenciosamente perderia uma escolha do
  // jogador.
  const uniqueChoices = new Set(currentChoices);
  if (uniqueChoices.size !== currentChoices.length) {
    return err(
      createAppError({
        code: 'CONTENT_REFERENCE_MIGRATION_COLLISION',
        scope: SCOPE,
        message: 'A migração faria duas escolhas distintas colidirem no mesmo destino.',
        context: { reference: currentId, choiceRefs: currentChoices },
      }),
    );
  }

  const lastStep = migrationPath.length > 0 ? migrationPath[migrationPath.length - 1] : null;
  const packageVersion =
    lastStep !== null
      ? lastStep.to
      : (typeof reference === 'object' && typeof reference.packageVersion === 'string'
          ? reference.packageVersion
          : null);

  const changed =
    currentId !== originalId ||
    currentChoices.length !== inputChoices.length ||
    currentChoices.some((choice, position) => choice !== inputChoices[position]);

  return ok(
    Object.freeze({
      id: currentId,
      packageVersion,
      choiceRefs: Object.freeze(currentChoices),
      changed,
    }),
  );
}
