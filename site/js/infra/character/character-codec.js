// Módulo `infra/character/character-codec`: converte entre o registro
// plano persistido (`PersistedCharacterV2`, mesmo vocabulário de campos do
// baseline v1 mais `_schema`/`content_refs`/`content_scopes`/`choice_refs`/
// `overrides` reservados) e o modelo canônico v2 em memória
// (`domain/character/model.js`).
//
// `decodeCharacterRecord` detecta a versão via
// `migration-runner.js` e, em ambos os casos v1 (legado) e v2 (atual),
// reconstrói o canônico rodando o MESMO mapeamento determinístico de
// campos planos (site/js/infra/character/migrations/v1-to-v2.js) — um
// registro v2 recém-codificado por este módulo mantém o mesmo vocabulário
// plano de campos por design (ver comentário do schema
// character-record-v2), então decodificar de novo é idempotente por
// construção. Para um registro v2, os canais reservados `overrides`/
// `choice_refs` (escritos pela última codificação) prevalecem sobre a
// reconciliação `edicoes`/`pv_max_override` derivada dos campos planos —
// eles são a fonte de verdade mais recente.
//
// `encodeCharacterRecord` é a direção inversa: projeta o canônico de volta
// para o vocabulário plano do baseline, usando o alias resolvido "às
// avessas" (`reverseResolve`) para reconstruir os nomes de exibição em
// português que o app legado lê diretamente.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { validateCanonicalCharacter } from '../../domain/character/validation.js';
import {
  BUILD_REF_LIST_FIELDS,
  SPELL_COLLECTION_FIELDS,
  visitCharacterContentReferences,
} from '../../domain/character/model.js';
import { validatePersistedCharacterRecordV2 } from '../../content/validation.js';
import {
  detectCharacterRecordVersion,
  migrateCharacterRecord,
} from './migration-runner.js';
import { STRUCTURED_V1_FIELDS, LEGACY_TALENT_RESOURCE_SOURCE_PREFIX } from './migrations/v1-to-v2.js';

const SCOPE = 'infra.character.character-codec';

// Chaves reservadas pelo codec v2 no registro plano — nunca podem vir de
// `extensions.legacyPassthrough` sem colisão (ver checklist: "teste de
// colisão entre passthrough e campo reservado v2").
const RESERVED_RECORD_KEYS = Object.freeze([
  '_schema',
  '_local_sync',
  'content_refs',
  'content_scopes',
  'choice_refs',
  'overrides',
  // Task 23: histórico de PV por nível (`state.hitPointRolls`). É um canal
  // RESERVADO do codec v2, não um campo do baseline v1 — o legado só guardava
  // o `pv_max` final, nunca as rolagens. Por isso ele NÃO é reconstruído por
  // `migrateV1ToV2`: um registro v1 simplesmente não tem histórico, e a
  // ausência é preservada (inventar entradas plausíveis é o default de
  // migração proibido pelas Global Constraints).
  'pv_rolagens',
  // Correção I1 da revisão final: alvo ATUAL de concentração
  // (`state.spells.concentration`, um ContentId). Canal reservado próprio —
  // a `concentracao` LEGADA era uma flag por entrada de `efeitos_magicos`
  // (outra forma, deliberadamente NÃO migrada — decisão registrada como fora
  // de escopo); esta chave persiste apenas a forma canônica nova, e a
  // ausência é preservada (sem concentração não se fabrica a chave).
  'concentracao_ativa',
]);

// Chaves de `escolhas_classe` cujo valor é sempre array no baseline, mesmo
// com uma única seleção — levantado por grep exaustivo de todo uso de
// `escolhas_classe.<chave>` em site/js/**:
//   - especialista/academico: site/js/pages/sheet.js:3047,3056,
//     site/js/pages/creator.js:826-844 (sempre `.forEach()`/`|| []`).
//   - estilo_luta: site/js/pages/creator.js:982 (`.length`/`[0]`),
//     site/js/levelup.js:1559 (atribuído como `[opcoes.estilo_luta]`).
//   - ordem_divina/ordem_primal: site/js/pages/creator.js:1232,1236
//     (atribuídos como `[valor]`).
// Usada só para decidir a FORMA na projeção de volta build.choices ->
// escolhas_classe (ver comentário no encoder); qualquer outra chave de
// escolhas_classe é tratada como escalar por chave quando tem exatamente
// um valor (ex.: "dadiva_epica_nivel_19", atribuída como string única em
// site/js/levelup.js:256,1406).
const ARRAY_SHAPED_CLASS_CHOICE_KEYS = Object.freeze(
  new Set(['especialista', 'academico', 'estilo_luta', 'ordem_divina', 'ordem_primal']),
);

// Pointers de content_refs que apontam para um único ContentRef fixo em
// `build` (não uma coleção indexada) — usados para sobrepor o resultado de
// `migrateV1ToV2` (que sempre re-resolve por alias a partir dos campos
// planos de exibição) com a referência JÁ RESOLVIDA e persistida, evitando
// re-resolver por alias um id que pode já ter sido migrado de versão (e
// portanto não tem mais alias de nome de exibição correspondente).
const DIRECT_BUILD_REF_POINTERS = Object.freeze({
  'build.rulesetRef': 'rulesetRef',
  'build.classRef': 'classRef',
  'build.subclassRef': 'subclassRef',
  'build.speciesRef': 'speciesRef',
  'build.backgroundRef': 'backgroundRef',
});

// Pointers de content_refs para coleções indexadas em `build`. Construído a
// partir de `BUILD_REF_LIST_FIELDS` (domain/character/model.js — a MESMA
// lista que `visitCharacterContentReferences` usa) em vez de uma lista
// separada hardcoded, para que um campo novo (`build.*Refs`) não possa
// voltar a ficar de fora do overlay silenciosamente, como aconteceu com
// `maneuverRefs` (achado do 3º review independente da Task 12).
const BUILD_REF_LIST_POINTER_PATTERN = new RegExp(`^build\\.(${BUILD_REF_LIST_FIELDS.join('|')})\\[(\\d+)\\]$`);
// Pointers de content_refs para state.inventory[i].itemRef.
const INVENTORY_REF_POINTER_PATTERN = /^state\.inventory\[(\d+)\]\.itemRef$/;
// Pointers de content_refs para state.spells.{known,prepared,spellbook}[i].spellRef.
// Construído a partir de `SPELL_COLLECTION_FIELDS` pelo mesmo motivo acima
// — o gap original também incluía `state.spells.spellbook`.
const SPELL_REF_POINTER_PATTERN = new RegExp(`^state\\.spells\\.(${SPELL_COLLECTION_FIELDS.join('|')})\\[(\\d+)\\]\\.spellRef$`);

/**
 * Sobrepõe, num personagem já re-derivado por `migrateV1ToV2`, cada
 * referência de conteúdo persistida em `content_refs` (o canal reservado
 * escrito pelo último `encodeCharacterRecord`) — SEM re-resolver por alias
 * a partir dos campos planos de exibição. Necessário porque, depois de uma
 * migração de versão de pacote (`migration-runner.js#migrateContentVersions`),
 * o id de uma referência pode ter mudado (ex.: "dnd2024:class:guerreiro-2")
 * e não existe alias de nome de exibição para esse id novo — re-resolver
 * pelo campo plano `classe` (que guarda só o NOME de exibição reprojetado
 * via reverseResolve, não o id) falharia com
 * CHARACTER_LEGACY_ALIAS_NOT_FOUND numa ficha que só passou por uma
 * migração de conteúdo real. `content_refs` é sempre a fonte de verdade
 * mais recente quando presente.
 * @param {object} character
 * @param {*} contentRefs
 * @returns {object} personagem com as referências sobrepostas (nova cópia; não muta o parâmetro)
 */
function applyContentRefsOverlay(character, contentRefs) {
  if (!isPlainObject(contentRefs) || Object.keys(contentRefs).length === 0) {
    return character;
  }

  const next = {
    ...character,
    build: {
      ...character.build,
      legacyGrants: character.build.legacyGrants,
      ...Object.fromEntries(BUILD_REF_LIST_FIELDS.map((field) => [field, [...character.build[field]]])),
    },
    state: {
      ...character.state,
      inventory: character.state.inventory.map((entry) => ({ ...entry })),
      spells: {
        ...character.state.spells,
        ...Object.fromEntries(
          SPELL_COLLECTION_FIELDS.map((field) => [field, character.state.spells[field].map((entry) => ({ ...entry }))]),
        ),
      },
    },
  };

  const isValidRef = (value) =>
    isPlainObject(value) && typeof value.id === 'string' && typeof value.packageVersion === 'string';

  for (const [pointer, ref] of Object.entries(contentRefs)) {
    if (!isValidRef(ref)) {
      continue;
    }
    const frozenRef = Object.freeze({ id: ref.id, packageVersion: ref.packageVersion });

    if (Object.hasOwn(DIRECT_BUILD_REF_POINTERS, pointer)) {
      next.build[DIRECT_BUILD_REF_POINTERS[pointer]] = frozenRef;
      continue;
    }

    const listMatch = BUILD_REF_LIST_POINTER_PATTERN.exec(pointer);
    if (listMatch) {
      const [, field, indexText] = listMatch;
      const index = Number(indexText);
      if (index < next.build[field].length) {
        next.build[field][index] = frozenRef;
      }
      continue;
    }

    const inventoryMatch = INVENTORY_REF_POINTER_PATTERN.exec(pointer);
    if (inventoryMatch) {
      const index = Number(inventoryMatch[1]);
      if (index < next.state.inventory.length) {
        next.state.inventory[index] = { ...next.state.inventory[index], itemRef: frozenRef };
      }
      continue;
    }

    const spellMatch = SPELL_REF_POINTER_PATTERN.exec(pointer);
    if (spellMatch) {
      const [, field, indexText] = spellMatch;
      const index = Number(indexText);
      if (index < next.state.spells[field].length) {
        next.state.spells[field][index] = { ...next.state.spells[field][index], spellRef: frozenRef };
      }
      continue;
    }
    // Pointer desconhecido (ex.: de um schema futuro): ignorado, não é erro
    // — content_refs é um canal auxiliar best-effort, não fonte única.
  }

  return next;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {object} rawRecord
 * @returns {boolean}
 */
function hasValidSchemaMarker(rawRecord) {
  return isPlainObject(rawRecord._schema) && typeof rawRecord._schema.version === 'number';
}

/**
 * Decodifica um registro de personagem persistido (bruto, não confiável)
 * para um envelope editável (canônico v2 pronto para uso) ou somente
 * leitura (schema futuro, ou falha ao reconciliar versão de conteúdo).
 * @param {*} rawRecord
 * @param {{aliasResolver: object, now: string, contentManifests?: object}} context
 * @returns {import('../../core/result.js').Result} Result<EditableCharacterEnvelope | ReadOnlyCharacterEnvelope, AppError>
 */
export function decodeCharacterRecord(rawRecord, context = {}) {
  // Colisão entre passthrough e campo reservado v2, checada ANTES da
  // detecção de versão: um registro sem `_schema` reconhecível (seria
  // tratado como v1 legado) que já contém uma das chaves reservadas do
  // codec v2 (`_schema` malformado incluso — outra origem que não este
  // codec pode ter escrito algo com esse nome) não pode ser
  // migrado/decodificado com segurança — fica somente leitura/exportável,
  // preservando o bruto integralmente, em vez de arriscar sobrescrever o
  // que quer que aquele campo já significasse.
  if (isPlainObject(rawRecord) && !hasValidSchemaMarker(rawRecord)) {
    for (const key of RESERVED_RECORD_KEYS) {
      if (Object.hasOwn(rawRecord, key)) {
        return ok(
          Object.freeze({
            mode: 'read-only',
            rawRecord,
            detectedVersion: 1,
            reason: `CHARACTER_RESERVED_FIELD_COLLISION:${key}`,
          }),
        );
      }
    }
  }

  const detection = detectCharacterRecordVersion(rawRecord);
  if (!detection.ok) {
    return detection;
  }

  if (detection.value.kind === 'future') {
    return ok(
      Object.freeze({ mode: 'read-only', rawRecord, detectedVersion: detection.value.version }),
    );
  }

  const migrated = migrateCharacterRecord(rawRecord, context);
  if (!migrated.ok) {
    return migrated;
  }

  if (migrated.value.mode === 'read-only') {
    return ok(migrated.value);
  }

  // `_local_sync` NUNCA entra no personagem canônico (não é campo do
  // schema — validateCanonicalCharacter roda com additionalProperties:false
  // na raiz e rejeitaria qualquer chave extra). Fica num campo próprio do
  // ENVELOPE, ao lado de `character`, para sobreviver ao round-trip sem
  // tocar a validação canônica.
  const localSync = isPlainObject(rawRecord) && isPlainObject(rawRecord._local_sync) ? rawRecord._local_sync : null;

  let character;
  let warnings;
  if (migrated.value.mode === 'migrated') {
    character = migrated.value.character;
    warnings = migrated.value.warnings;
  } else {
    // mode === 'up-to-date': o registro já está no schema v2. Reconstrói o
    // canônico com o mesmo mapeamento determinístico de campos planos
    // (idempotente por construção — ver comentário do módulo), e então
    // sobrepõe os canais reservados como fonte de verdade mais recente.
    const strippedRecord = { ...rawRecord };
    for (const key of RESERVED_RECORD_KEYS) {
      delete strippedRecord[key];
    }
    const reDecoded = migrateCharacterRecord(strippedRecord, context);
    if (!reDecoded.ok) {
      return reDecoded;
    }
    character =
      reDecoded.value.mode === 'migrated' ? reDecoded.value.character : null;
    if (character === null) {
      return err(
        createAppError({
          code: 'CHARACTER_DECODE_FAILED',
          scope: SCOPE,
          message: 'Falha inesperada ao decodificar registro v2 (re-derivação retornou modo inesperado).',
          context: { mode: reDecoded.value.mode },
        }),
      );
    }
    if (isPlainObject(rawRecord.overrides)) {
      // MESCLA, não substituição cega — achado do round-trip da Task 37.
      //
      // O canal reservado `overrides` é escrito pelo encode v2 e fica
      // OBSOLETO se o baseline editar depois o campo plano correspondente:
      // o modal "Sobrescrever PV Máximo" do app legado escreve
      // `pv_max_override` (e o "Resetar" o remove) sem saber que
      // `overrides['hp.maximum']` existe. Substituir `character.overrides`
      // pelo canal reservado inteiro revertia silenciosamente essa edição —
      // exatamente o defeito já corrigido para `edicoes` (Addendum 2,
      // achado #3) e para `choice_refs` (nota acima), agora no terceiro
      // canal. Para `hp.maximum`, a reconciliação derivada dos CAMPOS PLANOS
      // (`migrations/v1-to-v2.js#reconcileHitPointMaximumOverride`, já
      // aplicada em `character.overrides` neste ponto) é a autoridade:
      //   - flat sem override => a chave NÃO ressuscita do canal reservado;
      //   - valores divergentes => vence o flat (o encode v2 sempre espelha
      //     o próprio override no flat, logo divergência == edição do
      //     baseline posterior à última codificação);
      //   - valores iguais => vence a entrada reservada (metadados mais
      //     ricos da última edição v2).
      // As DEMAIS chaves de override não têm campo plano espelhado e vêm do
      // canal reservado como antes.
      const derivadoDoFlat = isPlainObject(character.overrides) ? character.overrides['hp.maximum'] : undefined;
      const reservado = rawRecord.overrides;
      const mesclado = { ...reservado };
      if (derivadoDoFlat === undefined) {
        delete mesclado['hp.maximum'];
      } else if (!isPlainObject(reservado['hp.maximum']) || reservado['hp.maximum'].value !== derivadoDoFlat.value) {
        mesclado['hp.maximum'] = derivadoDoFlat;
      }
      // Overrides de IDENTIDADE (correção I2): os campos planos (`nome`,
      // `alinhamento`, ...) são a autoridade — o app legado os edita sem
      // conhecer o canal reservado. Um override cujo `value` não bate com o
      // campo plano decodificado ficou OBSOLETO (edição do baseline posterior
      // à última codificação v2) e é DESCARTADO: mantê-lo faria um
      // `revert-character-edit` restaurar um `original` de antes da edição do
      // baseline — a reversão silenciosa que este codec já corrigiu três
      // vezes em outros canais.
      for (const [key, entry] of Object.entries(mesclado)) {
        if (!key.startsWith('identity.')) {
          continue;
        }
        const campo = key.slice('identity.'.length);
        const valorFlat = typeof character.identity?.[campo] === 'string' ? character.identity[campo] : '';
        if (!isPlainObject(entry) || entry.value !== valorFlat) {
          delete mesclado[key];
        }
      }
      character = { ...character, overrides: mesclado };
    }
    // `pv_rolagens` -> `state.hitPointRolls` (Task 23). Canal reservado do
    // codec v2: é a ÚNICA fonte do histórico, porque `migrateV1ToV2` não tem
    // de onde derivá-lo. Ausente ou não-array => o campo continua AUSENTE no
    // canônico (não vira `[]`, que significaria "zero PV rolado" em vez de
    // "histórico desconhecido" — a distinção que
    // `progression-queries.js#requireHitPointRolls` usa para falhar explícito
    // em vez de presumir a média).
    if (Array.isArray(rawRecord.pv_rolagens)) {
      character = {
        ...character,
        state: { ...character.state, hitPointRolls: rawRecord.pv_rolagens },
      };
    }
    // `concentracao_ativa` -> `state.spells.concentration` (correção I1 da
    // revisão final). Canal reservado do codec v2: `migrateV1ToV2` não tem de
    // onde derivá-lo (a forma legada era outra — flag por entrada de
    // `efeitos_magicos`, fora de escopo). Chave ausente/malformada => a
    // concentração continua `null` no canônico (ausência preservada; nunca um
    // alvo inventado).
    if (typeof rawRecord.concentracao_ativa === 'string' && rawRecord.concentracao_ativa.length > 0) {
      character = {
        ...character,
        state: {
          ...character.state,
          spells: { ...character.state.spells, concentration: rawRecord.concentracao_ativa },
        },
      };
    }
    // NOTA: `choice_refs` (ao contrário de `content_refs`/`content_scopes`)
    // deliberadamente NÃO sobrepõe `build.choices` aqui. `build.choices` é
    // sempre re-derivado, fresco, dos campos planos `escolhas_classe`/
    // `escolhas_antecedente`/`adepto_elemental_tipos` por migrateV1ToV2 —
    // e esses campos planos (ao contrário de classe/subclasse/etc.) não
    // ficam "presos" a uma versão de pacote sem alias depois de uma
    // migração de conteúdo (as chaves de build.choices desta modelagem,
    // ex. "classe:especialista", não são ContentIds qualificados — só o
    // valor de "talento:adepto-elemental" pode ser, e mesmo esse é só uma
    // string solta sem estrutura ContentRef que perderia alias). Sobrepor
    // `choice_refs` aqui reintroduziria o mesmo defeito já corrigido em
    // "edicoes" (Addendum 2, achado #3 do 1º review): uma edição do
    // baseline em `escolhas_classe`/`escolhas_antecedente` seria
    // silenciosamente revertida pelo `choice_refs` obsoleto da última
    // codificação. `choice_refs` continua sendo EMITIDO no encode (canal
    // informativo best-effort para uma futura sincronização remota), só
    // não é mais lido de volta aqui.
    // build.contentScopes: sem isto, todo decode reassumiria a versão
    // padrão hardcoded de migrateV1ToV2 (dnd2024@1.0.0), revertendo
    // silenciosamente uma migração de versão de conteúdo já concluída.
    // `content_scopes` é o espelho persistido, escrito por
    // encodeCharacterRecord.
    if (isPlainObject(rawRecord.content_scopes)) {
      character = { ...character, build: { ...character.build, contentScopes: rawRecord.content_scopes } };
    }
    // content_refs: sobrepõe cada referência de conteúdo JÁ RESOLVIDA (e
    // possivelmente já migrada de versão) por cima da re-derivação por
    // alias de migrateV1ToV2 — ver applyContentRefsOverlay para o porquê
    // (um id migrado não tem mais alias de nome de exibição).
    character = applyContentRefsOverlay(character, rawRecord.content_refs);
    warnings = [];
  }

  const validation = validateCanonicalCharacter(character);
  if (!validation.valid) {
    return err(
      createAppError({
        code: 'CHARACTER_DECODE_INVALID_RESULT',
        scope: SCOPE,
        message: 'A decodificação produziu um personagem canônico inválido.',
        context: { errors: validation.errors.map((e) => ({ code: e.code, message: e.message })) },
      }),
    );
  }

  return ok(
    Object.freeze({
      mode: 'editable',
      character,
      warnings: Object.freeze(warnings ?? []),
      localSync: localSync ? Object.freeze({ ...localSync }) : null,
    }),
  );
}

/**
 * Reverse-resolve uma lista de ContentIds para nomes de exibição legados,
 * mantendo o id como fallback quando não há alias (nunca deveria acontecer
 * para conteúdo migrado por este mesmo codec, mas evita perder dado por
 * `undefined` silencioso).
 * @param {object} aliasResolver
 * @param {ReadonlyArray<string>} ids
 * @returns {string[]}
 */
function reverseAll(aliasResolver, ids) {
  return (ids ?? []).map((id) => aliasResolver.reverseResolve(id) ?? id);
}

/**
 * Codifica um personagem canônico v2 de volta para o registro plano
 * persistido, reaproveitando o vocabulário de campos do baseline. Nunca
 * duplica inventário/magias/recursos (cada um existe uma única vez no
 * registro plano, na respectiva coleção).
 * @param {object} character
 * @param {{aliasResolver: object}} context
 * @returns {import('../../core/result.js').Result} Result<PersistedCharacterV2, AppError>
 */
export function encodeCharacterRecord(character, context = {}) {
  const validation = validateCanonicalCharacter(character);
  if (!validation.valid) {
    return err(
      createAppError({
        code: 'CHARACTER_ENCODE_INVALID_INPUT',
        scope: SCOPE,
        message: 'O personagem canônico a codificar é inválido.',
        context: { errors: validation.errors.map((e) => ({ code: e.code, message: e.message })) },
      }),
    );
  }
  const aliasResolver = context.aliasResolver;
  if (aliasResolver === undefined || aliasResolver === null || typeof aliasResolver.reverseResolve !== 'function') {
    throw new TypeError('encodeCharacterRecord: context.aliasResolver é obrigatório.');
  }

  const legacyPassthrough = isPlainObject(character.extensions?.legacyPassthrough)
    ? character.extensions.legacyPassthrough
    : {};

  for (const key of RESERVED_RECORD_KEYS) {
    if (Object.hasOwn(legacyPassthrough, key)) {
      return err(
        createAppError({
          code: 'CHARACTER_ENCODE_RESERVED_FIELD_COLLISION',
          scope: SCOPE,
          message: `extensions.legacyPassthrough contém a chave reservada "${key}"; não pode ser codificado sem sobrescrever um canal do codec v2.`,
          context: { key },
        }),
      );
    }
  }

  const record = { ...legacyPassthrough };

  record._schema = { version: 2 };
  record.id = character.identity.id;
  record.nome = character.identity.name;
  record.imagem = character.identity.image;
  record.alinhamento = character.identity.alignment;
  record.tamanho = character.identity.size;
  record.aparencia = character.identity.appearance;
  record.personalidade = character.identity.personality;
  record.ideais = character.identity.ideals;
  record.lacos = character.identity.bonds;
  record.defeitos = character.identity.flaws;
  record.historia_personagem = character.identity.backstory;
  record.notas = character.identity.notes;

  record.nivel = character.state.level;
  record.xp = character.state.xp;
  record.exaustao = character.state.exhaustion;
  record.atributos = { ...character.state.abilities };
  record.atributos_base = { ...character.build.abilityGeneration.base };

  record.classe = character.build.classRef ? (aliasResolver.reverseResolve(character.build.classRef.id) ?? '') : '';
  record.subclasse = character.build.subclassRef
    ? (aliasResolver.reverseResolve(character.build.subclassRef.id) ?? '')
    : '';
  record.especie = character.build.speciesRef
    ? (aliasResolver.reverseResolve(character.build.speciesRef.id) ?? '')
    : '';
  record.antecedente = character.build.backgroundRef
    ? (aliasResolver.reverseResolve(character.build.backgroundRef.id) ?? '')
    : '';

  record.pv_atual = character.state.hitPoints.current;
  record.pv_temporario = character.state.hitPoints.temporary;
  record.dados_vida_usados = character.state.hitDice.used;
  record.morte_sucessos = character.state.deathSaves.successes;
  record.morte_falhas = character.state.deathSaves.failures;

  const legacyGrants = character.build.legacyGrants;
  record.pericias_proficientes = reverseAll(aliasResolver, legacyGrants.skillProficiencyIds);
  record.pericias_expertise = reverseAll(aliasResolver, legacyGrants.skillExpertiseIds);
  record.salvaguardas_proficientes = reverseAll(aliasResolver, legacyGrants.savingThrowProficiencyIds);
  record.idiomas = reverseAll(aliasResolver, legacyGrants.languageIds);
  record.resistencias = reverseAll(aliasResolver, legacyGrants.resistanceIds);
  record.vulnerabilidades = reverseAll(aliasResolver, legacyGrants.vulnerabilityIds);
  record.imunidades = [...legacyGrants.immunityIds];
  record.proficiencias_ferramentas = [...legacyGrants.toolProficiencyIds];
  record.proficiencias_instrumentos = [...legacyGrants.instrumentProficiencyIds];
  record.proficiencias_extra = [...legacyGrants.otherProficiencies];

  const resolvedFeatNames = character.build.featRefs.map((r) => aliasResolver.reverseResolve(r.id) ?? r.id);
  record.talentos = [...resolvedFeatNames, ...(legacyPassthrough.talentos_nao_resolvidos ?? [])];

  const resolvedMasteryNames = character.build.weaponMasteryRefs.map(
    (r) => aliasResolver.reverseResolve(r.id) ?? r.id,
  );
  record.maestrias_arma = [...resolvedMasteryNames, ...(legacyPassthrough.maestrias_arma_nao_resolvidas ?? [])];

  // escolhas_classe/escolhas_antecedente/adepto_elemental_tipos: projetados
  // de volta de build.choices (fonte de verdade), nunca deixados como a
  // cópia bruta herdada de legacyPassthrough — sem isto, uma edição no
  // lado v2 (build.choices) seria silenciosamente revertida no próximo
  // decode, porque o registro plano ainda traria a cópia obsoleta (mesmo
  // defeito que a reconciliação edicoes/overrides já corrigia, agora no
  // canal de escolhas). As chaves usam os prefixos determinísticos que
  // migrations/v1-to-v2.js já atribui (`classe:`/`antecedente:`/
  // `talento:adepto-elemental`), tornando a projeção inversa mecânica.
  const escolhasClasse = {};
  const escolhasAntecedente = {};
  let adeptoElementalTipos = null;
  for (const [key, values] of Object.entries(character.build.choices)) {
    if (key.startsWith('classe:')) {
      const shortKey = key.slice('classe:'.length);
      // Ao contrário de escolhas_antecedente (sempre escalar por chave),
      // escolhas_classe mistura chaves de forma ARRAY (ex.: "especialista"/
      // "academico" — sheet.js/creator.js sempre leem com .forEach()/
      // default [], nunca esperam escalar) com chaves de forma ESCALAR
      // (ex.: "dadiva_epica_nivel_19", atribuída como string única em
      // levelup.js:256,1406). Desembrulhar por comprimento (como em
      // escolhas_antecedente) quebraria "especialista"/"academico" com
      // exatamente 1 seleção — o caso mais comum — trocando um array por
      // uma string e quebrando o primeiro .forEach() do baseline sobre ela.
      // Por isso a forma é decidida por uma whitelist de chaves conhecidas
      // como array, não por comprimento.
      escolhasClasse[shortKey] = ARRAY_SHAPED_CLASS_CHOICE_KEYS.has(shortKey)
        ? [...values]
        : values.length === 1
          ? values[0]
          : [...values];
    } else if (key.startsWith('antecedente:')) {
      // escolhas_antecedente usa valor escalar por chave no v1 (ex.:
      // pericia_extra: "Atletismo", não um array) — desembrulha um array
      // de um único elemento para preservar a forma original; múltiplos
      // valores (caso não observado no v1, mas possível numa edição v2)
      // continuam array.
      const shortKey = key.slice('antecedente:'.length);
      escolhasAntecedente[shortKey] = values.length === 1 ? values[0] : [...values];
    } else if (key === 'talento:adepto-elemental') {
      adeptoElementalTipos = values.map((value) => aliasResolver.reverseResolve(value) ?? value);
    }
    // Outros prefixos (nenhum existe hoje) não têm campo plano de destino
    // conhecido — permanecem representados só em build.choices/choice_refs.
  }
  record.escolhas_classe = escolhasClasse;
  record.escolhas_antecedente = escolhasAntecedente;
  if (adeptoElementalTipos !== null) {
    record.adepto_elemental_tipos = adeptoElementalTipos;
  } else if (!Object.hasOwn(record, 'adepto_elemental_tipos')) {
    record.adepto_elemental_tipos = [];
  }

  record.inventario = character.state.inventory.map((entry) => {
    const base = isPlainObject(entry.customDefinition) ? { ...entry.customDefinition } : {};
    return {
      ...base,
      quantidade: entry.quantity,
      equipado: entry.equipped,
      instanceId: entry.instanceId,
    };
  });

  const spellLevelOf = typeof context.spellLevelOf === 'function' ? context.spellLevelOf : null;
  const encodeSpellList = (list) =>
    list.map((entry) => {
      const base = isPlainObject(entry.customDefinition) ? { ...entry.customDefinition } : {};
      // NOME pelo mesmo canal de classe/espécie/talento (Task 28b).
      //
      // Uma magia CONCEDIDA por efeito (`apply-grants.js#grant-spell`) nasce
      // com `customDefinition: null` — e tem de nascer: `apply-grants` é
      // domínio puro, não conhece catálogo e não teria como saber o nome. Até
      // o cutover do criador isso nunca aparecia, porque todo personagem vinha
      // do formato legado e carregava o objeto bruto da magia no
      // `customDefinition`. Num personagem criado direto no modelo canônico, a
      // magia concedida chegava ao registro como `{instanceId}` puro: a ficha
      // legada ordena por `nome` e quebrava (`localeCompare` sobre
      // `undefined`).
      //
      // `reverseResolve` é a MESMA tradução ContentId -> nome legado usada em
      // `classe`, `especie`, `talentos` e `pericias_*` logo acima. Quando ela
      // não conhece o id, nada é inventado: o campo continua ausente.
      const spellId = entry.spellRef?.id ?? null;
      if (typeof base.nome !== 'string' || base.nome.length === 0) {
        const nome = spellId === null ? null : aliasResolver.reverseResolve(spellId);
        if (typeof nome === 'string' && nome.length > 0) {
          base.nome = nome;
        }
      }
      // CÍRCULO pela porta opcional `spellLevelOf` (Task 28b).
      //
      // O nível de uma magia é dado de CATÁLOGO e o codec não conhece
      // catálogo — daí uma porta injetada em vez de um import. Sem ela o campo
      // continua ausente (nunca um círculo chutado), e a ficha legada
      // simplesmente não agrupa aquela magia; com ela, uma magia concedida por
      // espécie/classe aparece no círculo certo como qualquer outra.
      if (!Number.isInteger(base.circulo) && spellId !== null && spellLevelOf !== null) {
        const nivel = spellLevelOf(spellId);
        if (Number.isInteger(nivel)) {
          base.circulo = nivel;
        }
      }
      return { ...base, instanceId: entry.instanceId };
    });
  record.magias_conhecidas = encodeSpellList(character.state.spells.known);
  // ORIGEM legada de magias SEMPRE PREPARADAS — achado do round-trip da Task
  // 37. Uma magia concedida com `alwaysPrepared: true`
  // (`domain/effects/apply-grants.js#grant-spell`) entra em
  // `state.spells.prepared` com o marcador `:prepared` no fim do
  // `instanceId` e SEM `customDefinition` — logo o encode acima não emitia
  // `origem` nenhuma, e o baseline (`magiaContaNoLimite`) contava essa magia
  // no LIMITE de preparadas do jogador: um Clérigo Aasimar recém-criado
  // chegava ao app legado com "Luz" ocupando uma vaga de preparada para
  // sempre. O vocabulário legado para exatamente esse conceito é
  // `origem: 'sempre'` ("magias sempre preparadas", excluída do limite e
  // não-removível) — emiti-la aqui restaura a paridade. Entradas que já
  // carregam `origem` via `customDefinition` (registros vindos do legado)
  // nunca são tocadas, e após o primeiro encode a origem passa a viajar no
  // próprio registro (o decode a preserva em `customDefinition`).
  record.magias_preparadas = encodeSpellList(character.state.spells.prepared).map((entrada, indice) => {
    const canonico = character.state.spells.prepared[indice];
    const ehGrantSemprePreparada =
      typeof canonico?.instanceId === 'string' && canonico.instanceId.endsWith(':prepared');
    if (ehGrantSemprePreparada && typeof entrada.origem !== 'string') {
      return { ...entrada, origem: 'sempre' };
    }
    return entrada;
  });
  // `grimorio` (Task 28b): a TERCEIRA coleção de magias, pelo mesmo canal das
  // outras duas.
  //
  // Ela era a única lida na entrada (`migrations/v1-to-v2.js` popula
  // `state.spells.spellbook` a partir de `raw.grimorio`) e nunca escrita na
  // saída. Enquanto todo personagem nascia do formato legado, isso era
  // invisível: `grimorio` também está fora de `STRUCTURED_V1_FIELDS`, então o
  // array bruto voltava intacto por `extensions.legacyPassthrough`.
  //
  // O criador novo (Task 28b) é o primeiro caminho que cria um personagem
  // DIRETO no modelo canônico — sem passthrough nenhum. Sem esta linha, o
  // grimório escolhido no passo `magias` existia no canônico e simplesmente
  // não chegava ao registro persistido: o Mago recém-criado abria a ficha com
  // o grimório vazio. Confirmado em navegador antes da correção.
  record.grimorio = encodeSpellList(character.state.spells.spellbook);

  // espacos_magia_extras/_slots_magia_livre: fonte é state.spells.slots[*].extra
  // e state.spells.freeKnownSlots (canônicos) — nunca a cópia bruta
  // herdada de legacyPassthrough (que ficaria obsoleta após uma edição do
  // lado v2).
  const espacosMagiaExtras = {};
  for (const [circle, slot] of Object.entries(character.state.spells.slots)) {
    if (slot.extra > 0) {
      espacosMagiaExtras[circle] = slot.extra;
    }
  }
  record.espacos_magia_extras = espacosMagiaExtras;

  // WRITE-BACK de `espacos_magia[*].usados` — achado do CUTOVER (Task 33).
  //
  // A versão anterior deixava `espacos_magia` vir de `legacyPassthrough`
  // INALTERADO, com a justificativa de que ele "é derivado". Só `total` é: o
  // decodificador (`migrations/v1-to-v2.js:588`) lê `usados` para dentro de
  // `state.spells.slots[c].used`, e `domain/spells/cast-spell.js` o
  // INCREMENTA. Sem esta metade, o round-trip era assimétrico e todo espaço
  // conjurado — e, depois da correção do descanso longo, toda recuperação —
  // se perdia no reload. É o MESMO defeito, e a mesma correção, do write-back
  // de recursos de talento logo abaixo (fix round 1 da Task 17, achado I2).
  //
  // `total` NÃO é inventado: quando o círculo já existe no registro, o valor
  // existente é preservado (é o máximo que o baseline recalcula ao renderizar,
  // `legacy-sheet-source.js:2780-2790`); quando o círculo só existe por
  // concessão extra, o total é a própria concessão — exatamente o que o
  // baseline escreve nesse caso (`legacy-sheet-source.js:2793-2795`).
  //
  // Um círculo que só existia por concessão extra e cuja concessão foi
  // ZERADA (o que o descanso longo faz) NÃO ganha entrada: escrever
  // `{total: 0, usados: 0}` inventaria um círculo de zero espaços onde o
  // baseline simplesmente não tem nada — é a divergência que o caso
  // `descanso-longo-reseta-dados-de-vida-morte-e-pv` do oráculo mede.
  const espacosMagiaAtuais = isPlainObject(record.espacos_magia) ? record.espacos_magia : null;
  const espacosMagia = {};
  for (const [circle, slot] of Object.entries(character.state.spells.slots)) {
    const anterior = isPlainObject(espacosMagiaAtuais?.[circle]) ? espacosMagiaAtuais[circle] : null;
    if (anterior === null && !(slot.extra > 0)) {
      continue;
    }
    const total = typeof anterior?.total === 'number' ? anterior.total : slot.extra;
    espacosMagia[circle] = { ...(anterior ?? {}), total, usados: slot.used };
  }
  if (Object.keys(espacosMagia).length > 0 || espacosMagiaAtuais !== null) {
    record.espacos_magia = espacosMagia;
  }
  // O baseline deleta este campo ao chegar a 0 em vez de manter `0`
  // (site/js/pages/sheet.js:14723) — replicado aqui para não deixar um
  // `_slots_magia_livre: 0` residual em toda ficha sem vagas livres
  // (inofensivo para os `|| 0` do baseline, mas evita ruído no registro).
  if (character.state.spells.freeKnownSlots > 0) {
    record._slots_magia_livre = character.state.spells.freeKnownSlots;
  } else {
    delete record._slots_magia_livre;
  }

  // `concentracao_ativa` (correção I1 da revisão final): persiste o alvo
  // ATUAL de concentração (`state.spells.concentration`). Sem concentração a
  // chave simplesmente NÃO é emitida — ausência preservada, nunca `null`
  // fabricado (o decode trataria os dois igual, mas o registro não ganha
  // ruído). A forma legada (`concentracao: true` dentro de `efeitos_magicos`)
  // não é tocada: continua viajando por `extensions.legacyPassthrough`.
  if (typeof character.state.spells.concentration === 'string' && character.state.spells.concentration.length > 0) {
    record.concentracao_ativa = character.state.spells.concentration;
  }

  record.condicoes = character.state.conditions.map((value) => aliasResolver.reverseResolve(value) ?? value);

  // Write-back de recursos de talento migrados estruturalmente (fix round 1
  // da Task 17, achado I2): toda entrada de `state.resources` cujo
  // `sourceInstanceId` tem o prefixo `legacy:resources:talentos:` (ver
  // `migrations/v1-to-v2.js`) é projetada de volta para
  // `recursos.talentos.<chave>.usado` — sem isto, uma restauração feita por
  // `domain/commands/rest.js` sobre `state.resources` (current: 0 -> 1)
  // nunca chegava ao registro plano, porque `record.recursos` só carregava a
  // cópia ORIGINAL/obsoleta herdada de `extensions.legacyPassthrough`
  // (spread no topo desta função). A chave (`dadiva_destino`) é reconstruída
  // pelo inverso EXATO de `slugifyLocal` (troca "-" por "_") — determinístico,
  // não uma heurística de nome; outras chaves de `recursos.talentos` (formas
  // multi-campo sem home estrutural) permanecem como estavam.
  const existingRecursos = isPlainObject(record.recursos) ? record.recursos : {};
  const existingTalentos = isPlainObject(existingRecursos.talentos) ? { ...existingRecursos.talentos } : {};
  for (const [resourceId, resourceState] of Object.entries(character.state.resources)) {
    if (
      typeof resourceState?.sourceInstanceId !== 'string' ||
      !resourceState.sourceInstanceId.startsWith(LEGACY_TALENT_RESOURCE_SOURCE_PREFIX)
    ) {
      continue;
    }
    const slug = resourceState.sourceInstanceId.slice(LEGACY_TALENT_RESOURCE_SOURCE_PREFIX.length);
    const key = slug.replace(/-/g, '_');
    if (!Number.isInteger(resourceState.current)) {
      continue; // estado corrompido: nunca inventa "usado" a partir de um current inválido.
    }
    existingTalentos[key] = { usado: resourceState.current === 0 };
  }
  if (Object.keys(existingTalentos).length > 0 || Object.hasOwn(existingRecursos, 'talentos')) {
    record.recursos = { ...existingRecursos, talentos: existingTalentos };
  }

  record.moedas = { ...character.state.wallet };
  delete record.po; // superado por `moedas`, nunca reemitido pelo encoder v2.

  record.config = { sobrecarga_afeta_deslocamento: character.build.options.encumbranceAffectsMovement };

  record.criado_em = character.metadata.createdAt;
  record.atualizado_em = character.metadata.updatedAt;

  // heroicInspiration é uma redução com perda do contador legado
  // (`inspiracao_heroica`, numérico) para um booleano (2024: "você tem ou
  // não tem inspiração"). O valor NUMÉRICO original, quando existente, já
  // está preservado em extensions.legacyPassthrough.inspiracao_heroica
  // (ver migrations/v1-to-v2.js) e por isso já foi copiado para `record`
  // no spread de `legacyPassthrough` acima — só emitimos um fallback
  // derivado (0 ou 1) quando não havia valor legado a preservar.
  if (!Object.hasOwn(record, 'inspiracao_heroica')) {
    record.inspiracao_heroica = character.state.heroicInspiration ? 1 : 0;
  }

  // pv_max: projeção descartável — o override manual (quando existe) é a
  // fonte de verdade; sem override, reemitimos o último valor bruto
  // conhecido (preservado em legacyPassthrough.pv_max por
  // migrations/v1-to-v2.js) já que esta tarefa não implementa o motor de
  // derivação por ruleset (ver concern no relatório da Task 12).
  const hpMaxOverride = character.overrides['hp.maximum'];
  if (hpMaxOverride) {
    record.pv_max = hpMaxOverride.value;
    record.pv_max_override = hpMaxOverride.source === 'manual' ? hpMaxOverride.value : null;
  } else if (!Object.hasOwn(record, 'pv_max')) {
    record.pv_max = character.state.hitPoints.current;
  }

  // "edicoes" como projeção compatível de "overrides" (brief): o override
  // canônico de hp.maximum é projetado de volta para
  // edicoes.campos.pv_max, no MESMO formato que
  // site/js/ficha-edicoes.js#aplicarEdicao grava ({original, editadoEm,
  // origem} — sem "valor", que é lido do campo plano pv_max separadamente),
  // preservando autoria (`origem`)/data (`editadoEm`) em vez de perdê-las
  // numa edição feita pelo v2. Demais entradas de `edicoes.campos` (que só
  // sobrevivem via legacyPassthrough, nunca reconciliadas por esta tarefa —
  // ver STRUCTURED_V1_FIELDS) são preservadas como estavam. Sem override,
  // uma entrada `pv_max` pré-existente é removida (reflete uma reversão de
  // edição feita no lado canônico).
  const existingEdicoes = isPlainObject(record.edicoes) ? record.edicoes : { versao: 1, campos: {} };
  const existingCampos = isPlainObject(existingEdicoes.campos) ? { ...existingEdicoes.campos } : {};
  if (hpMaxOverride && hpMaxOverride.source === 'manual') {
    existingCampos.pv_max = {
      original: hpMaxOverride.original,
      editadoEm: hpMaxOverride.editedAt,
      origem: hpMaxOverride.source,
    };
  } else {
    delete existingCampos.pv_max;
  }
  record.edicoes = { versao: existingEdicoes.versao ?? 1, campos: existingCampos };

  record.overrides = { ...character.overrides };
  record.choice_refs = { ...character.build.choices };

  // pv_rolagens: histórico de PV por nível (Task 23). Só é escrito quando
  // EXISTE — um personagem sem histórico (todo registro migrado de v1) não
  // ganha um `[]` aqui, porque array vazio significaria "subiu 0 níveis
  // rolando", e não "histórico desconhecido". A distinção é o que permite a
  // `getMaximumHitPoints` falhar explicitamente em vez de somar zero.
  if (Array.isArray(character.state.hitPointRolls)) {
    record.pv_rolagens = character.state.hitPointRolls.map((entry) => ({
      level: entry.level,
      rolled: entry.rolled,
      method: entry.method,
    }));
  }

  // content_refs: canal auxiliar com toda referência de conteúdo EXPLÍCITA
  // (ContentRef {id, packageVersion}, não ContentId nu) do personagem,
  // indexada pelo mesmo esquema de "pointer" de
  // domain/character/model.js#visitCharacterContentReferences — permite a
  // uma futura camada de sincronização remota traduzir referências sem
  // precisar reimplementar a resolução de alias, e é a fonte que
  // `applyContentRefsOverlay()` usa para sobreviver a uma migração de
  // versão de conteúdo (ver decodeCharacterRecord). Derivado diretamente
  // do MESMO visitor usado para validação/migração — não uma lista de
  // pointers mantida à mão em paralelo — para que um campo novo nunca
  // possa ficar de fora silenciosamente (achado do 3º review independente:
  // a lista manual anterior não cobria `build.maneuverRefs`/
  // `state.spells.spellbook`). IDs nus (packageVersion null — legacyGrants,
  // choices, condições, chaves de resources) não entram aqui: herdam a
  // versão do namespace via `content_scopes`, não precisam de entrada
  // própria.
  const content_refs = {};
  for (const reference of visitCharacterContentReferences(character)) {
    if (reference.packageVersion !== null) {
      content_refs[reference.pointer] = { id: reference.id, packageVersion: reference.packageVersion };
    }
  }
  record.content_refs = content_refs;

  // content_scopes: espelho persistido de build.contentScopes — sem isto,
  // uma migração de versão de conteúdo já concluída seria revertida
  // silenciosamente no próximo decode (que assumiria a versão padrão
  // hardcoded de migrations/v1-to-v2.js).
  record.content_scopes = { ...character.build.contentScopes };

  // `_local_sync` é dado do REPOSITÓRIO (reconciliação de outbox), não do
  // personagem canônico — passado por fora, nunca lido de `character` (que
  // é validado contra um schema fechado que não conhece este campo).
  // Exportação/gateway remoto simplesmente não passam `context.localSync`.
  if (isPlainObject(context.localSync) && typeof context.localSync.lastMutationId === 'string') {
    record._local_sync = { lastMutationId: context.localSync.lastMutationId };
  }

  const recordValidation = validatePersistedCharacterRecordV2(record);
  if (!recordValidation.valid) {
    return err(
      createAppError({
        code: 'CHARACTER_ENCODE_INVALID_OUTPUT',
        scope: SCOPE,
        message: 'O registro plano codificado não passou na validação do schema persistido.',
        context: { errors: recordValidation.errors.map((e) => ({ code: e.code, message: e.message })) },
      }),
    );
  }

  return ok(record);
}
