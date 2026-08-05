// Passo `magias` do criador (Task 28).
//
// ## O que este passo NÃO recalcula
//
// Nada de mecânica de magia nasce aqui. Quem valida uma seleção é
// `domain/spells/spell-selection.js#validateSpellSelection` (Task 18) e quem
// projeta o estado de conjuração é
// `domain/spells/spellcasting-queries.js#getSpellcastingProjection`. Este passo
// só descobre QUAIS fontes de magia o personagem tem, oferece as magias
// elegíveis e materializa a escolha em `state.spells`.
//
// O criador legado faz o oposto: `renderStepMagias` compara nomes em português
// ("Mago", "Clérigo"), lê a tabela da classe com `getTruquesConhecidos`/
// `getMagiaPreparadas` e reconta limites à mão, num bloco de ~500 linhas
// duplicado em `levelup.js` e em `regras-cobertura.js`.
//
// ## Os números vêm de RECURSO ESTRUTURADO, não de tabela em prosa
//
// A migração da Task 8 levou a tabela de progressão de cada classe para
// EFEITOS `resource` com `when: {kind:'level'}`:
//
//   - `truques`            -> quantos truques o personagem conhece;
//   - `magias-preparadas`  -> limite de magias preparadas;
//   - `spell-slot-<N>`     -> espaços de magia do círculo N.
//
// Eles já foram materializados em `character.state.resources` pelo motor de
// efeitos quando a CLASSE foi escolhida. Este passo apenas LÊ esses máximos —
// não há nenhum `parseInt` sobre `tabela_caracteristicas` neste caminho, e o
// círculo máximo selecionável é derivado dos `spell-slot-*` existentes.
//
// ## Duas LACUNAS de conteúdo declaradas (Task 8/9), visíveis e não inventadas
//
//  1. GRIMÓRIO. Nenhum campo do catálogo diz que uma classe prepara magias a
//     partir de um grimório: `class.spellcasting` só declara `ability` e
//     `progression`. `validateSpellSelection` já documenta isso e exige que o
//     CHAMADOR peça `preparedFrom: 'spellbook'`. Este passo mantém essa decisão
//     numa constante por ContentId (`SPELLBOOK_PREPARERS`) — nunca por nome de
//     exibição — e a declara em `contentGaps`, para que a dívida continue
//     visível em vez de virar folclore.
//  2. INICIADO EM MAGIA. A opção do talento aponta a lista escolhida por um
//     `official-handler` cujo `params.classe` é um NOME em português
//     ("Clérigo"), sem nenhuma referência de conteúdo à `spell-list`
//     correspondente, e o handler não está registrado. Este passo NÃO adivinha
//     a lista a partir do nome: a instância é reportada em `contentGaps`, o
//     jogador é avisado na tela e o passo continua válido. Resolver a lacuna é
//     trabalho de conteúdo (Task 8/9), não deste passo.
//
// ## Simetria apply/revoke
//
// As magias deste passo são REBUILD, não incremento: `materializeSelection`
// remove de `state.spells.*` TODAS as entradas cujo `sourceInstanceId` esteja
// sob gestão deste passo e as recria a partir da fatia. Assim desmarcar uma
// magia remove exatamente a entrada que marcá-la havia criado, e nenhuma magia
// concedida por outra fonte (`grant-spell` de espécie/talento, com
// `sourceInstanceId` próprio) é tocada.

import { ok, err } from '../../../core/result.js';
import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { deriveSourceInstanceId } from '../../../domain/effects/collect-effects.js';
import { validateSpellSelection } from '../../../domain/spells/spell-selection.js';
import { readSpellState } from '../../../domain/spells/spellcasting-queries.js';
import { buildInvalidationPatch, createInvalidationPatch } from '../creator-invalidation.js';
import { withDraftSlices } from '../creator-state.js';
import { createCreatorStep, createStepBinding, stepError } from './creator-step.js';

const STEP_ID = 'magias';

/** Coleções geridas por este passo, na ordem em que aparecem na tela. */
export const SPELL_COLLECTIONS_IN_STEP = Object.freeze(['spellbook', 'prepared', 'known']);

/** Intenções de domínio deste passo. */
export const SPELLS_INTENT_TYPES = Object.freeze({
  toggle: 'creator/spell-toggle',
});

/**
 * Recurso estruturado que carrega o número de TRUQUES conhecidos por nível.
 * @type {string}
 */
const CANTRIPS_RESOURCE = 'truques';

/**
 * Recurso estruturado que carrega o LIMITE de magias preparadas por nível.
 * @type {string}
 */
const PREPARED_RESOURCE = 'magias-preparadas';

/** Prefixo dos recursos de espaço de magia (`spell-slot-1` .. `spell-slot-9`). */
const SLOT_RESOURCE_PREFIX = 'spell-slot-';

/**
 * Prefixo dos `instanceId` de magia criados por ESTE passo. É o que distingue
 * uma escolha do jogador (removível) de uma concessão do motor de efeitos
 * (intocável), mesmo quando as duas vêm da mesma fonte.
 * @type {string}
 */
const MANAGED_INSTANCE_PREFIX = 'creator:';

/**
 * Classes que preparam magias A PARTIR DO GRIMÓRIO, por ContentId, com o
 * tamanho do grimório INICIAL.
 *
 * ## Por que isto é uma constante, e por que ela é honesta
 *
 * Não existe campo no catálogo que declare "esta classe usa grimório":
 * `class.spellcasting` só tem `ability` e `progression` (ver
 * dados/schemas/v1/class.schema.json), e `state.spells.spellbook` existe no
 * modelo canônico sem nenhuma fonte que o alimente. `validateSpellSelection`
 * (Task 18) tomou a mesma decisão e por isso exige `preparedFrom: 'spellbook'`
 * vindo do chamador, em vez de inferir do id da classe dentro do domínio.
 *
 * A chave é o ContentId — ESTÁVEL e versionado —, jamais o nome de exibição
 * ("Mago"), que é justamente o que o criador legado compara. E a lacuna é
 * DECLARADA em `contentGaps` do step data: quando o catálogo ganhar o campo,
 * esta constante some e o teste que afirma a lacuna falha, obrigando a
 * atualização em vez de deixar a decisão escondida aqui para sempre.
 * @type {Readonly<Record<string, {initialSpellbookSize: number}>>}
 */
export const SPELLBOOK_PREPARERS = Object.freeze({
  'dnd2024:class:mago': Object.freeze({ initialSpellbookSize: 6 }),
});

/**
 * `handlerId` que o talento "Iniciado em Magia" usa para apontar a lista de
 * magias escolhida — sem nenhuma referência de conteúdo, só um nome em
 * português em `params.classe`. Reconhecê-lo aqui é o que permite DECLARAR a
 * lacuna; nada é resolvido a partir dele.
 * @type {string}
 */
export const UNRESOLVED_SPELL_LIST_HANDLER = 'choose-cantrips-from-class-list';

/**
 * @param {*} registry
 * @returns {boolean}
 */
function isUsableRegistry(registry) {
  return (
    registry !== null &&
    typeof registry === 'object' &&
    typeof registry.list === 'function' &&
    typeof registry.resolve === 'function' &&
    typeof registry.get === 'function'
  );
}

/**
 * Registros de recurso materializados em `state.activeEffects` por uma fonte.
 *
 * ## Por que `activeEffects` e não `state.resources`
 *
 * `applyGrantEffects` (Task 15) grava DUAS coisas para um efeito `resource`: o
 * ESTADO em `state.resources["<ns>:resource:<slug>"]`, que guarda só
 * `{current, sourceInstanceId}`, e o REGISTRO em `state.activeEffects`, que
 * guarda `{kind:'resource', resource, max, ...}` com proveniência.
 *
 * O `max` — que é o número que este passo precisa — só existe no REGISTRO.
 * Ler `current` no lugar dele funcionaria hoje por coincidência (um personagem
 * recém-criado tem `current === max`) e passaria a mentir no instante em que
 * qualquer coisa gastasse o recurso.
 * @param {object} character
 * @param {string} sourceInstanceId
 * @returns {ReadonlyArray<object>} os `data` dos registros de recurso da fonte.
 */
function resourceRecordsOf(character, sourceInstanceId) {
  const active = Array.isArray(character?.state?.activeEffects) ? character.state.activeEffects : [];
  return active
    .filter((entry) => entry?.data?.kind === 'resource' && entry.sourceInstanceId === sourceInstanceId)
    .map((entry) => entry.data);
}

/**
 * Lê o `max` de um recurso materializado por uma fonte.
 *
 * `null` (e não `0`) para ausente: zero significaria "não tem nenhum", uma
 * afirmação de jogo que a ausência do recurso não autoriza — a mesma
 * disciplina de `spellcasting-queries.js#optionalCount`.
 * @param {object} character
 * @param {string} sourceInstanceId
 * @param {string} resourceSlug - slug NÃO qualificado (`truques`, ...).
 * @returns {number|null}
 */
export function readResourceMaximum(character, sourceInstanceId, resourceSlug) {
  for (const data of resourceRecordsOf(character, sourceInstanceId)) {
    if (data.resource === resourceSlug && Number.isInteger(data.max) && data.max >= 0) {
      return data.max;
    }
  }
  return null;
}

/**
 * Máximos de espaço de magia por círculo, lidos dos recursos `spell-slot-<N>`
 * materializados pela fonte.
 * @param {object} character
 * @param {string} sourceInstanceId
 * @returns {Readonly<Record<string, number>>}
 */
export function readSlotMaximums(character, sourceInstanceId) {
  const slots = {};
  for (const data of resourceRecordsOf(character, sourceInstanceId)) {
    const slug = typeof data.resource === 'string' ? data.resource : '';
    if (!slug.startsWith(SLOT_RESOURCE_PREFIX)) {
      continue;
    }
    const level = Number.parseInt(slug.slice(SLOT_RESOURCE_PREFIX.length), 10);
    if (!Number.isInteger(level) || level < 1 || level > 9) {
      continue;
    }
    if (Number.isInteger(data.max) && data.max > 0) {
      slots[String(level)] = data.max;
    }
  }
  return Object.freeze(slots);
}

/**
 * Espaços de MAGIA DE PACTO declarados pela entidade de classe.
 *
 * O Bruxo não tem recursos `spell-slot-<N>`: os espaços dele vêm do marcador
 * `official-handler` `pact-magic-slots`, cujo `params.table` é uma tabela
 * ESTRUTURADA por nível (`{"1": {slots, circulo}, ...}`) — a MESMA que
 * `domain/progression/progression-queries.js` lê para projetar a progressão.
 *
 * Sem isto o Bruxo ficaria com `maxSpellLevel: null`, nenhuma magia de 1º
 * círculo seria oferecida e o passo seria impossível de satisfazer: o
 * personagem não poderia ser criado.
 * @param {object} classEntity
 * @param {number|null} level
 * @returns {Readonly<Record<string, number>>}
 */
export function readPactSlotMaximums(classEntity, level) {
  if (!Number.isInteger(level)) {
    return Object.freeze({});
  }
  const marker = (Array.isArray(classEntity?.effects) ? classEntity.effects : []).find(
    (effect) => effect?.type === 'official-handler' && effect?.handlerId === 'pact-magic-slots',
  );
  const row = marker?.params?.table?.[String(level)];
  if (row === null || row === undefined || !Number.isInteger(row.slots) || !Number.isInteger(row.circulo)) {
    return Object.freeze({});
  }
  return Object.freeze({ [String(row.circulo)]: row.slots });
}

/**
 * Maior círculo selecionável: o maior `spell-slot-<N>` com máximo > 0, ou
 * `null` quando o personagem não tem espaço nenhum (não-conjurador).
 * @param {Readonly<Record<string, number>>} slotMaximums
 * @returns {number|null}
 */
export function maxSpellLevelOf(slotMaximums) {
  let max = null;
  for (const key of Object.keys(slotMaximums)) {
    const level = Number(key);
    if (Number.isInteger(level) && (max === null || level > max)) {
      max = level;
    }
  }
  return max;
}

/**
 * Fatia `spellSelection` normalizada: um mapa `sourceInstanceId -> coleções`.
 * @param {object} draft
 * @returns {Readonly<Record<string, Readonly<Record<string, ReadonlyArray<string>>>>>}
 */
export function readSpellSelection(draft) {
  const slice = draft?.slices?.spellSelection;
  const raw = slice !== null && typeof slice === 'object' && !Array.isArray(slice) ? slice.sources : null;
  const sources = {};
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [sourceInstanceId, collections] of Object.entries(raw)) {
      const normalized = {};
      for (const collection of SPELL_COLLECTIONS_IN_STEP) {
        const ids = collections?.[collection];
        normalized[collection] = Object.freeze(
          Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id.length > 0) : [],
        );
      }
      sources[sourceInstanceId] = Object.freeze(normalized);
    }
  }
  return Object.freeze(sources);
}

/**
 * Coleções vazias de uma fonte ainda sem escolha.
 * @returns {Record<string, ReadonlyArray<string>>}
 */
function emptyCollections() {
  const empty = {};
  for (const collection of SPELL_COLLECTIONS_IN_STEP) {
    empty[collection] = Object.freeze([]);
  }
  return empty;
}

/**
 * Descobre as FONTES de magia do personagem.
 *
 * Hoje há exatamente uma família resolvível estruturalmente: a CLASSE, quando
 * a entidade declara `spellcasting`. As instâncias de "Iniciado em Magia" são
 * detectadas e devolvidas como lacuna (`resolved: false`), nunca adivinhadas.
 *
 * @param {object} context
 * @returns {Readonly<{sources: ReadonlyArray<object>, gaps: ReadonlyArray<object>}>}
 */
export function collectSpellSources(context) {
  const character = context.draft?.character ?? null;
  const registry = context.registry;
  const sources = [];
  const gaps = [];
  if (character === null || !isUsableRegistry(registry)) {
    return Object.freeze({ sources: Object.freeze(sources), gaps: Object.freeze(gaps) });
  }

  // --- Fonte de CLASSE ---------------------------------------------------
  const classId = typeof character.build?.classRef?.id === 'string' ? character.build.classRef.id : null;
  if (classId !== null) {
    const resolved = registry.resolve(classId, 'class');
    if (resolved.ok === true && resolved.value?.spellcasting !== null && typeof resolved.value?.spellcasting === 'object') {
      const entity = resolved.value;
      const sourceInstanceId = deriveSourceInstanceId({ collection: 'class', index: 0, key: classId });
      const resourceSlots = readSlotMaximums(character, sourceInstanceId);
      // Espaços normais OU de pacto — as duas fontes são estruturadas e
      // mutuamente exclusivas no pacote oficial; unir as duas evita um `if`
      // por identidade de classe.
      const slotMaximums =
        Object.keys(resourceSlots).length > 0
          ? resourceSlots
          : readPactSlotMaximums(resolved.value, Number.isInteger(character.state?.level) ? character.state.level : null);
      const spellbook = Object.hasOwn(SPELLBOOK_PREPARERS, classId) ? SPELLBOOK_PREPARERS[classId] : null;
      sources.push(
        Object.freeze({
          kind: 'class',
          sourceInstanceId,
          contentId: classId,
          name: typeof entity.name === 'string' ? entity.name : classId,
          abilityId: typeof entity.spellcasting.ability === 'string' ? entity.spellcasting.ability : null,
          // Limites lidos do RECURSO materializado, nunca de tabela em prosa.
          //
          // TRUQUES: a ausência do recurso `truques` é uma DECLARAÇÃO, não uma
          // lacuna. A migração da Task 8 emite `truques` para toda classe que
          // conhece truques; Paladino e Guardião — os dois conjuradores 2024
          // sem truque nenhum — simplesmente não têm o efeito. Por isso, e só
          // aqui, ausência vira `0`: exigir o recurso tornaria essas duas
          // classes impossíveis de criar. `magias-preparadas`, que TODA classe
          // conjuradora declara, continua exigido (ausência bloqueia).
          cantripLimit: readResourceMaximum(character, sourceInstanceId, CANTRIPS_RESOURCE) ?? 0,
          preparedLimit: readResourceMaximum(character, sourceInstanceId, PREPARED_RESOURCE),
          slotMaximums,
          maxSpellLevel: maxSpellLevelOf(slotMaximums),
          preparedFrom: spellbook === null ? null : 'spellbook',
          spellbookLimit: spellbook === null ? null : spellbook.initialSpellbookSize,
          spellListIds: null,
        }),
      );
      if (spellbook !== null) {
        gaps.push(
          Object.freeze({
            kind: 'spellbook-not-declared',
            contentId: classId,
            detail: 'O catálogo não declara preparação por grimório; o valor vem de SPELLBOOK_PREPARERS.',
          }),
        );
      }
    }
  }

  // --- Fontes de TALENTO (Iniciado em Magia e afins) ----------------------
  for (const featRef of Array.isArray(character.build?.featRefs) ? character.build.featRefs : []) {
    const featId = typeof featRef?.id === 'string' ? featRef.id : null;
    if (featId === null) {
      continue;
    }
    const resolved = registry.resolve(featId, 'feat');
    if (resolved.ok !== true) {
      continue;
    }
    const unresolvable = collectUnresolvedSpellListHandlers(resolved.value);
    if (unresolvable.length > 0) {
      gaps.push(
        Object.freeze({
          kind: 'spell-list-reference-missing',
          contentId: featId,
          handlerIds: Object.freeze(unresolvable),
          detail:
            'A opção do talento aponta a lista de magias por nome de exibição em params.classe, sem referência de conteúdo; ' +
            'este passo não resolve listas por nome.',
        }),
      );
    }
  }

  return Object.freeze({ sources: Object.freeze(sources), gaps: Object.freeze(gaps) });
}

/**
 * Varre uma entidade atrás de `official-handler`s que apontariam uma lista de
 * magias sem referência de conteúdo. É uma VARREDURA sobre campo estruturado
 * (`handlerId`), não um casamento de texto livre.
 * @param {object} entity
 * @returns {Array<string>}
 */
function collectUnresolvedSpellListHandlers(entity) {
  const found = new Set();
  /**
   * @param {*} node
   * @returns {void}
   */
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const child of node) {
        walk(child);
      }
      return;
    }
    if (node === null || typeof node !== 'object') {
      return;
    }
    if (node.type === 'official-handler' && node.handlerId === UNRESOLVED_SPELL_LIST_HANDLER) {
      found.add(node.handlerId);
    }
    for (const value of Object.values(node)) {
      walk(value);
    }
  };
  walk(Array.isArray(entity?.effects) ? entity.effects : []);
  return [...found];
}

/**
 * Magias elegíveis para uma fonte: as que declaram a classe dela em
 * `spell.classes` (campo mecânico do catálogo), até o círculo máximo.
 * @param {object} registry
 * @param {object} source
 * @returns {ReadonlyArray<Readonly<object>>}
 */
export function eligibleSpellsFor(registry, source) {
  const spells = [];
  for (const entity of registry.list('spell') ?? []) {
    if (!Number.isInteger(entity.level)) {
      continue;
    }
    if (entity.level > 0 && (source.maxSpellLevel === null || entity.level > source.maxSpellLevel)) {
      continue;
    }
    if (!Array.isArray(entity.classes) || !entity.classes.includes(source.contentId)) {
      continue;
    }
    spells.push(
      Object.freeze({
        id: entity.id,
        name: typeof entity.name === 'string' ? entity.name : entity.id,
        level: entity.level,
        school: typeof entity.school === 'string' ? entity.school : null,
        ritual: entity.ritual === true,
        concentration: entity.concentration === true,
      }),
    );
  }
  spells.sort((a, b) => (a.level === b.level ? a.name.localeCompare(b.name, 'pt-BR') : a.level - b.level));
  return Object.freeze(spells);
}

/**
 * Limite da coleção para uma fonte, ou `null` quando não há limite conhecido.
 *
 * Truques e magias de 1º círculo ou mais compartilham a mesma coleção no
 * canônico, mas limites DIFERENTES: o truque conta contra `truques` e a magia
 * contra `magias-preparadas`. Por isso o limite é calculado por coleção E por
 * círculo, e o `render` mostra os dois contadores separados.
 * @param {object} source
 * @param {string} collection
 * @returns {number|null}
 */
export function limitFor(source, collection) {
  if (collection === 'spellbook') {
    return source.spellbookLimit;
  }
  if (collection === 'prepared') {
    return source.preparedLimit;
  }
  return null;
}

/**
 * `packageVersion` do namespace de `contentId`, lido de `build.contentScopes`.
 * O mesmo que `apply-grants.js#packageVersionFor` faz — nenhuma versão é
 * inventada; ausente vira `null` e o schema aceita a referência sem versão.
 * @param {object} character
 * @param {string} contentId
 * @returns {string|null}
 */
function packageVersionFor(character, contentId) {
  const namespace = typeof contentId === 'string' && contentId.includes(':') ? contentId.slice(0, contentId.indexOf(':')) : null;
  const scopes = character?.build?.contentScopes;
  if (namespace === null || scopes === null || typeof scopes !== 'object' || !Object.hasOwn(scopes, namespace)) {
    return null;
  }
  const version = scopes[namespace]?.packageVersion;
  return typeof version === 'string' ? version : null;
}

/**
 * Projeção LEGADA de uma magia escolhida, gravada em `customDefinition`.
 *
 * ## Por que uma magia do catálogo carrega um blob legado (Task 28b)
 *
 * `state.spells[*]` só tem quatro campos (o schema canônico é
 * `additionalProperties: false`): `instanceId`, `spellRef`, `customDefinition`
 * e `sourceInstanceId` — não há onde guardar nome nem círculo. E
 * `character-codec.js#encodeCharacterRecord` projeta cada magia para o
 * registro persistido como `{...customDefinition, instanceId}`: é
 * `customDefinition` o ÚNICO canal por onde nome e círculo chegam ao registro.
 *
 * Enquanto todo personagem vinha do formato legado isso já acontecia sem
 * ninguém reparar: `migrations/v1-to-v2.js` grava o objeto bruto da magia em
 * `customDefinition` para TODA magia, resolvida no catálogo ou não. O criador
 * novo é o primeiro a criar magias direto no modelo canônico — e, com
 * `customDefinition: null`, o Mago recém-criado gravava
 * `magias_preparadas: [{instanceId}]`: sem `nome`, a ficha legada quebrava ao
 * ordenar a lista (`a.nome.localeCompare` sobre `undefined`) e o personagem
 * ficava inabrível. Confirmado em navegador antes da correção.
 *
 * Só os dois campos que o registro legado usa como CHAVE são projetados
 * (`nome` e `circulo`); descrição, escola e o resto continuam sendo lidos do
 * catálogo por quem exibe — duplicá-los aqui criaria uma cópia que envelhece.
 *
 * @param {Map<string, object>|null} spellsById - metadados das magias
 *   elegíveis (`eligibleSpellsFor`), indexados por ContentId.
 * @param {string} spellId
 * @returns {object|null} `null` quando a magia não está no índice — nunca um
 *   nome inventado a partir do id.
 */
function legacyPresentationOf(spellsById, spellId) {
  const spell = spellsById instanceof Map ? spellsById.get(spellId) : null;
  if (spell === null || spell === undefined) {
    return null;
  }
  return Object.freeze({ nome: spell.name, circulo: spell.level });
}

/**
 * Reconstrói `state.spells.{known,prepared,spellbook}` a partir da fatia.
 *
 * REBUILD, nunca incremento: toda entrada cujo `sourceInstanceId` pertença às
 * fontes geridas por este passo é removida e recriada. É o que torna a
 * remoção o inverso EXATO da adição, sem depender de acertar um `splice`.
 *
 * As entradas de OUTRAS fontes (`grant-spell` de espécie/talento, ou magias
 * customizadas do jogador com `sourceInstanceId: null`) nunca são tocadas.
 *
 * @param {object} character
 * @param {ReadonlyArray<object>} sources
 * @param {Record<string, Record<string, ReadonlyArray<string>>>} selection
 * @returns {object} personagem novo.
 */
export function materializeSelection(character, sources, selection, spellsById = null) {
  const managed = new Set(sources.map((source) => source.sourceInstanceId));
  const state = readSpellState(character);
  const rebuilt = {};
  for (const collection of ['known', 'prepared', 'spellbook']) {
    // O critério de remoção é o PREFIXO do `instanceId` (`creator:`) E a
    // fonte gerida — não a fonte sozinha. Filtrar só por `sourceInstanceId`
    // apagaria uma magia que a PRÓPRIA classe conceda por `grant-spell`
    // (mesma fonte, `instanceId` do motor de efeitos): o jogador perderia uma
    // magia automática só por marcar outra na tela. Hoje nenhuma classe do
    // pacote concede magia diretamente — as concessões vêm de `feature`, com
    // fonte própria —, então o defeito seria invisível até o dia em que uma
    // concedesse.
    rebuilt[collection] = state[collection].filter(
      (entry) =>
        !(
          typeof entry?.instanceId === 'string' &&
          entry.instanceId.startsWith(MANAGED_INSTANCE_PREFIX) &&
          managed.has(typeof entry?.sourceInstanceId === 'string' ? entry.sourceInstanceId : '')
        ),
    );
  }
  for (const source of sources) {
    const collections = selection[source.sourceInstanceId] ?? emptyCollections();
    for (const collection of SPELL_COLLECTIONS_IN_STEP) {
      for (const spellId of collections[collection] ?? []) {
        rebuilt[collection].push({
          // O id é DERIVADO da fonte, da coleção e da magia: reconstruir a
          // mesma seleção produz exatamente o mesmo id, o que torna a
          // materialização idempotente.
          instanceId: `${MANAGED_INSTANCE_PREFIX}${source.sourceInstanceId}:${collection}:${spellId}`,
          spellRef: Object.freeze({ id: spellId, packageVersion: packageVersionFor(character, spellId) }),
          customDefinition: legacyPresentationOf(spellsById, spellId),
          sourceInstanceId: source.sourceInstanceId,
        });
      }
    }
  }
  const spells = {
    ...(character.state?.spells !== null && typeof character.state?.spells === 'object' ? character.state.spells : {}),
    known: Object.freeze(rebuilt.known.map((entry) => Object.freeze(entry))),
    prepared: Object.freeze(rebuilt.prepared.map((entry) => Object.freeze(entry))),
    spellbook: Object.freeze(rebuilt.spellbook.map((entry) => Object.freeze(entry))),
  };
  return Object.freeze({ ...character, state: Object.freeze({ ...character.state, spells: Object.freeze(spells) }) });
}

// --- Renderização ---------------------------------------------------------

/**
 * Contador "X/Y" de uma coleção.
 * @param {string} label
 * @param {number} current
 * @param {number|null} limit
 * @param {string} key
 * @returns {string}
 */
function renderCounter(label, current, limit, key) {
  return (
    `<span class="magias-contador" data-magias-contador="${escapeHtmlAttribute(key)}">` +
    `${escapeHtml(label)}: ${escapeHtml(String(current))}/${escapeHtml(limit === null ? '—' : String(limit))}</span>`
  );
}

/**
 * Card de uma magia.
 * @param {object} spell
 * @param {string} sourceInstanceId
 * @param {string} collection
 * @param {boolean} selected
 * @returns {string}
 */
function renderSpellCard(spell, sourceInstanceId, collection, selected) {
  return (
    `<div class="magia-card${selected ? ' selecionada' : ''}" data-magia-circ="${escapeHtmlAttribute(String(spell.level))}" ` +
    `data-magia-fonte="${escapeHtmlAttribute(sourceInstanceId)}" ` +
    `data-magia-colecao="${escapeHtmlAttribute(collection)}" ` +
    `data-magia-id="${escapeHtmlAttribute(spell.id)}">` +
    `<div class="card-nome">${escapeHtml(spell.name)}</div>` +
    `<div class="card-detalhe">${escapeHtml(spell.level === 0 ? 'Truque' : `${spell.level}º círculo`)}` +
    `${spell.school === null ? '' : escapeHtml(` · ${spell.school}`)}</div>` +
    '</div>'
  );
}

/**
 * Aviso VISÍVEL de lacuna de conteúdo. A lacuna aparece na TELA, e não só no
 * step data: uma lacuna que só um teste enxerga é uma lacuna escondida.
 * @param {ReadonlyArray<object>} gaps
 * @returns {string}
 */
function renderGaps(gaps) {
  if (gaps.length === 0) {
    return '';
  }
  return gaps
    .map(
      (gap) =>
        `<div class="info-box warning" data-magias-lacuna="${escapeHtmlAttribute(gap.kind)}">` +
        escapeHtml(
          gap.kind === 'spell-list-reference-missing'
            ? 'Um talento concede magias de uma lista que o catálogo ainda não referencia de forma estruturada. ' +
              'Essas magias não são oferecidas aqui; acrescente-as à mão na ficha.'
            : 'O catálogo ainda não declara a preparação por grimório desta classe; o comportamento vem de uma decisão registrada no código.',
        ) +
        '</div>',
    )
    .join('');
}

/**
 * Cria o passo `magias`.
 * @returns {import('../../../core/result.js').Result} `ok(step)`
 */
export function createSpellsStep() {
  return createCreatorStep({
    id: STEP_ID,

    /**
     * Carrega as fontes de magia e as magias elegíveis de cada uma.
     * @param {object} context
     * @returns {Promise<import('../../../core/result.js').Result>}
     */
    async load(context) {
      if (!isUsableRegistry(context.registry)) {
        return err(
          stepError('CREATOR_STEP_REGISTRY_MISSING', `O passo "${STEP_ID}" exige um ContentRegistry em "context.registry".`, {
            stepId: STEP_ID,
          }),
        );
      }
      const { sources, gaps } = collectSpellSources(context);
      return ok(
        Object.freeze({
          stepId: STEP_ID,
          sources,
          // `spellcaster: false` é um FATO derivado (nenhuma fonte resolvível),
          // não um atalho por nome de classe.
          spellcaster: sources.length > 0,
          eligibleBySource: Object.freeze(
            Object.fromEntries(sources.map((source) => [source.sourceInstanceId, eligibleSpellsFor(context.registry, source)])),
          ),
          contentGaps: gaps,
        }),
      );
    },

    /**
     * Markup do passo.
     * @param {object} context
     * @returns {string}
     */
    render(context) {
      const data = context.data;
      if (data === null || data === undefined) {
        return '<h3>Magias</h3>';
      }
      const selection = readSpellSelection(context.draft);
      if (data.sources.length === 0) {
        return (
          '<h3>Magias</h3>' +
          renderGaps(data.contentGaps) +
          '<div class="info-box info" data-magias-sem-conjuracao="true">' +
          escapeHtml('Esta combinação não concede conjuração no nível atual. Você pode pular este passo.') +
          '</div>'
        );
      }

      const blocos = data.sources
        .map((source) => {
          const escolhidas = selection[source.sourceInstanceId] ?? emptyCollections();
          const elegiveis = data.eligibleBySource[source.sourceInstanceId] ?? [];
          const truques = (escolhidas.known ?? []).filter((id) => elegiveis.find((spell) => spell.id === id)?.level === 0);

          const colecoes = SPELL_COLLECTIONS_IN_STEP.filter(
            (collection) => collection !== 'spellbook' || source.preparedFrom === 'spellbook',
          );

          const contadores =
            renderCounter('Truques', truques.length, source.cantripLimit, `${source.sourceInstanceId}:cantrips`) +
            colecoes
              .filter((collection) => collection !== 'known')
              .map((collection) =>
                renderCounter(
                  collection === 'spellbook' ? 'Grimório' : 'Magias preparadas',
                  (escolhidas[collection] ?? []).length,
                  limitFor(source, collection),
                  `${source.sourceInstanceId}:${collection}`,
                ),
              )
              .join('');

          const listas = colecoes
            .map((collection) => {
              const selecionadas = new Set(escolhidas[collection] ?? []);
              const candidatas = elegiveis.filter((spell) => (collection === 'known' ? spell.level === 0 : spell.level > 0));
              if (candidatas.length === 0) {
                return '';
              }
              const titulo = collection === 'known' ? 'Truques' : collection === 'spellbook' ? 'Grimório' : 'Magias preparadas';
              return (
                `<div class="card mb-2" data-magias-colecao-bloco="${escapeHtmlAttribute(collection)}">` +
                `<div class="card-header"><h3>${escapeHtml(titulo)}</h3></div>` +
                `<div class="magias-lista">${candidatas
                  .map((spell) => renderSpellCard(spell, source.sourceInstanceId, collection, selecionadas.has(spell.id)))
                  .join('')}</div></div>`
              );
            })
            .join('');

          return (
            `<div class="card mb-2" data-magias-fonte="${escapeHtmlAttribute(source.sourceInstanceId)}">` +
            `<div class="card-header"><h3>${escapeHtml(source.name)}</h3></div>` +
            `<div class="magias-contadores">${contadores}</div></div>` +
            listas
          );
        })
        .join('');

      return '<h3>Magias</h3>' + renderGaps(data.contentGaps) + blocos;
    },

    /**
     * Descritor DECLARATIVO.
     * @param {object} context
     * @returns {Readonly<object>}
     */
    bind(context) {
      return createStepBinding({
        eventTypes: ['click'],
        /**
         * @param {object} event
         * @returns {Readonly<object>}
         */
        toIntent(event) {
          const target = event.target;
          if (!target || typeof target.closest !== 'function') {
            return NO_UI_EVENT_DECISION;
          }
          const card = target.closest('[data-magia-id]');
          if (card === null) {
            return NO_UI_EVENT_DECISION;
          }
          void context;
          return createUiEventDecision({
            intent: {
              type: SPELLS_INTENT_TYPES.toggle,
              sourceInstanceId: card.getAttribute('data-magia-fonte'),
              collection: card.getAttribute('data-magia-colecao'),
              spellId: card.getAttribute('data-magia-id'),
            },
            preventDefault: true,
          });
        },
      });
    },

    /**
     * Válido quando toda fonte atingiu EXATAMENTE os limites conhecidos.
     *
     * Um limite `null` (desconhecido, porque o recurso não foi materializado)
     * NÃO é tratado como zero nem como "qualquer coisa serve": ele produz um
     * erro nomeado, porque avançar sem saber quantas magias o personagem deve
     * ter é o mesmo defeito de inventar o número.
     * @param {object} context
     * @returns {object} ValidationResult
     */
    validate(context) {
      const data = context.data;
      if (data === null || data === undefined) {
        return { valid: false, errors: [{ code: 'CREATOR_SPELLS_NOT_LOADED', stepId: STEP_ID }] };
      }
      const selection = readSpellSelection(context.draft);
      const errors = [];
      for (const source of data.sources) {
        const escolhidas = selection[source.sourceInstanceId] ?? emptyCollections();
        const elegiveis = data.eligibleBySource[source.sourceInstanceId] ?? [];
        const nivelDe = (id) => elegiveis.find((spell) => spell.id === id)?.level ?? null;
        const truques = (escolhidas.known ?? []).filter((id) => nivelDe(id) === 0);
        if (source.cantripLimit === null) {
          errors.push({ code: 'CREATOR_SPELLS_CANTRIP_LIMIT_UNKNOWN', stepId: STEP_ID, sourceInstanceId: source.sourceInstanceId });
        } else if (truques.length !== source.cantripLimit) {
          errors.push({
            code: 'CREATOR_SPELLS_CANTRIP_COUNT',
            stepId: STEP_ID,
            sourceInstanceId: source.sourceInstanceId,
            expected: source.cantripLimit,
            actual: truques.length,
          });
        }
        for (const collection of SPELL_COLLECTIONS_IN_STEP) {
          if (collection === 'known' || (collection === 'spellbook' && source.preparedFrom !== 'spellbook')) {
            continue;
          }
          const limit = limitFor(source, collection);
          const atual = (escolhidas[collection] ?? []).length;
          if (limit === null) {
            errors.push({ code: 'CREATOR_SPELLS_LIMIT_UNKNOWN', stepId: STEP_ID, sourceInstanceId: source.sourceInstanceId, collection });
          } else if (atual !== limit) {
            errors.push({
              code: 'CREATOR_SPELLS_COUNT',
              stepId: STEP_ID,
              sourceInstanceId: source.sourceInstanceId,
              collection,
              expected: limit,
              actual: atual,
            });
          }
        }

        // INVARIANTE do grimório, reconferida no PORTÃO.
        //
        // Contar quantidades não é validar: `SPELL_SELECTION_NOT_IN_SPELLBOOK`
        // (domain/spells/spell-selection.js) só é aplicado no instante da
        // marcação, e uma sequência de cliques legítima consegue desfazer a
        // relação depois — tirar do grimório uma magia já preparada e repor
        // outra devolve as CONTAGENS ao esperado com a preparação órfã.
        //
        // O `reduce` já cascateia essa remoção, então na prática o estado não
        // chega aqui quebrado. A reconferência existe porque um portão que
        // confia na construção não é um portão: rascunho vindo de storage,
        // fatia montada por outro caminho ou uma regressão futura no `reduce`
        // passariam direto, e o preço é um personagem finalizado com
        // `state.spells.prepared` inconsistente com `spellbook`.
        if (source.preparedFrom === 'spellbook') {
          const noGrimorio = new Set(escolhidas.spellbook ?? []);
          for (const spellId of escolhidas.prepared ?? []) {
            // Truques não passam pelo grimório (a regra vale para 1º círculo
            // ou mais) — o mesmo recorte de `spell-selection.js`.
            if (nivelDe(spellId) === 0 || noGrimorio.has(spellId)) {
              continue;
            }
            errors.push({
              code: 'CREATOR_SPELLS_PREPARED_NOT_IN_SPELLBOOK',
              stepId: STEP_ID,
              sourceInstanceId: source.sourceInstanceId,
              spellId,
            });
          }
        }
      }
      return { valid: errors.length === 0, errors };
    },

    /**
     * `magias` invalida somente a própria proveniência (linha `magias`).
     * @param {object} context
     * @returns {import('../../../core/result.js').Result}
     */
    invalidate(context) {
      return buildInvalidationPatch(STEP_ID, { draft: context.draft });
    },

    /**
     * Aplica a intenção de domínio.
     * @param {object} context
     * @param {object} intent
     * @returns {import('../../../core/result.js').Result}
     */
    reduce(context, intent) {
      if (intent?.type !== SPELLS_INTENT_TYPES.toggle) {
        return ok(Object.freeze({ draft: context.draft }));
      }
      if (!isUsableRegistry(context.registry)) {
        return err(stepError('CREATOR_STEP_REGISTRY_MISSING', `O passo "${STEP_ID}" exige "context.registry".`, { stepId: STEP_ID }));
      }
      const character = context.draft?.character ?? null;
      if (character === null || typeof character !== 'object') {
        return err(
          stepError('CREATOR_SPELLS_CHARACTER_MISSING', 'O rascunho ainda não tem personagem canônico para receber magias.', {
            stepId: STEP_ID,
          }),
        );
      }
      const { sources } = collectSpellSources(context);
      const source = sources.find((entry) => entry.sourceInstanceId === intent.sourceInstanceId) ?? null;
      if (source === null) {
        return err(
          stepError('CREATOR_SPELLS_SOURCE_UNKNOWN', `Nenhuma fonte de magia com id "${String(intent.sourceInstanceId)}".`, {
            stepId: STEP_ID,
          }),
        );
      }
      if (!SPELL_COLLECTIONS_IN_STEP.includes(intent.collection)) {
        return err(
          stepError('CREATOR_SPELLS_COLLECTION_UNKNOWN', `"${String(intent.collection)}" não é uma coleção deste passo.`, {
            stepId: STEP_ID,
          }),
        );
      }

      // Índice de metadados das magias de TODAS as fontes (não só da fonte do
      // clique): `materializeSelection` reconstrói as três coleções inteiras,
      // então uma magia de outra fonte precisa continuar encontrando seu nome
      // e círculo. Prefere o step data já carregado; sem ele, recalcula do
      // catálogo em vez de gravar magia sem nome.
      const spellsById = new Map();
      for (const entry of sources) {
        const elegiveis = context.data?.eligibleBySource?.[entry.sourceInstanceId] ?? eligibleSpellsFor(context.registry, entry);
        for (const spell of elegiveis) {
          spellsById.set(spell.id, spell);
        }
      }

      const selection = { ...readSpellSelection(context.draft) };
      const atual = { ...(selection[source.sourceInstanceId] ?? emptyCollections()) };
      const lista = [...(atual[intent.collection] ?? [])];
      const indice = lista.indexOf(intent.spellId);

      if (indice >= 0) {
        // DESMARCAR é sempre permitido: o inverso exato de marcar.
        lista.splice(indice, 1);
        atual[intent.collection] = Object.freeze(lista);
        // ...mas remover uma magia do GRIMÓRIO derruba junto a preparação que
        // dependia dela.
        //
        // `SPELL_SELECTION_NOT_IN_SPELLBOOK` só é conferido no instante da
        // MARCAÇÃO. Sem esta cascata, a sequência "preparar A -> tirar A do
        // grimório -> pôr G no grimório" devolvia as contagens ao esperado com
        // A preparada e fora do grimório — um personagem finalizado com
        // `state.spells.prepared` inconsistente com `spellbook`, alcançável só
        // com cliques legítimos na ordem certa.
        //
        // A cascata mantém o estado coerente POR CONSTRUÇÃO; o portão de
        // `validate` reconfere a mesma invariante por desconfiança (ver lá).
        if (intent.collection === 'spellbook' && source.preparedFrom === 'spellbook') {
          atual.prepared = Object.freeze((atual.prepared ?? []).filter((id) => id !== intent.spellId));
        }
      } else {
        // MARCAR passa pelo validador do DOMÍNIO (Task 18), sobre um
        // personagem cujas entradas desta fonte/coleção já foram removidas —
        // caso contrário a própria seleção corrente seria contada como
        // duplicata da fonte.
        const semEsta = materializeSelection(character, sources, {
          ...selection,
          [source.sourceInstanceId]: Object.freeze({ ...atual, [intent.collection]: Object.freeze([]) }),
        });
        const validated = validateSpellSelection(
          semEsta,
          {
            collection: intent.collection,
            spellIds: [...lista, intent.spellId],
            sourceInstanceId: source.sourceInstanceId,
            spellListIds: source.spellListIds,
            maxSpellLevel: source.maxSpellLevel ?? undefined,
            limit: limitFor(source, intent.collection) ?? undefined,
            preparedFrom: intent.collection === 'prepared' ? source.preparedFrom : null,
            abilityId: source.abilityId,
          },
          { registry: context.registry, spellcasting: { slotMaximums: source.slotMaximums } },
        );
        if (validated.ok !== true) {
          return validated;
        }
        lista.push(intent.spellId);
      }

      atual[intent.collection] = Object.freeze(lista);
      selection[source.sourceInstanceId] = Object.freeze(atual);
      const updatedCharacter = materializeSelection(character, sources, selection, spellsById);

      const updated = withDraftSlices(context.draft, {
        character: updatedCharacter,
        slices: { spellSelection: Object.freeze({ sources: Object.freeze({ ...selection }) }) },
        // PROVENIÊNCIA VAZIA: as magias deste passo não são concessão de
        // efeito. Repetir aqui o `sourceInstanceId` da classe faria a linha
        // `magias` da matriz (que limpa `spellSelection`) revogar a CLASSE
        // inteira ao voltar um passo — perícias, equipamento e tudo o mais.
        provenance: { spellSelection: [] },
      });
      if (updated.ok !== true) {
        return updated;
      }
      const patch = buildInvalidationPatch(STEP_ID, { draft: context.draft });
      if (patch.ok !== true) {
        return patch;
      }
      const invalidation = createInvalidationPatch({
        clearedStepIds: patch.value.clearedStepIds,
        revokedProvenanceIds: patch.value.revokedProvenanceIds,
        preservedSlices: [...new Set([...patch.value.preservedSlices, 'spellSelection'])],
      });
      return ok(Object.freeze({ draft: updated.value, invalidation }));
    },
  });
}
