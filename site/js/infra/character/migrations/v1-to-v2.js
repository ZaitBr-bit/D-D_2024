// Módulo `infra/character/migrations/v1-to-v2`: converte um registro de
// personagem legado (v1 — o objeto plano que `site/js/store.js#criarPersonagemVazio`
// produz e o app monolítico lê/escreve em `dnd_personagens`) no modelo
// canônico v2 (`domain/character/model.js`).
//
// Estratégia de cobertura de campo: o conjunto de campos v1 listado em
// `STRUCTURED_V1_FIELDS` é modelado estruturalmente (vira identity/build/
// state/overrides no canônico). Todo campo v1 restante — presente no
// registro bruto mas fora dessa lista — é preservado verbatim em
// `extensions.legacyPassthrough`, indexado pelo próprio nome do campo; é
// assim que os ~25 campos "monólito" de contabilidade interna (recursos
// por talento, escolhas de classe/antecedente/talento livres, flags/
// parâmetros de talento, maestrias/manobras não resolvidas por alias etc.)
// sobrevivem ao round-trip v1->v2->v1 sem que este módulo precise modelar
// exaustivamente a semântica de cada uma das 12 classes agora — ver
// concern correspondente no relatório da Task 12.

import { ok, err } from '../../../core/result.js';
import { createAppError } from '../../../core/errors.js';
import { deriveLegacyInstanceId } from '../legacy-instance-id.js';

const SCOPE = 'infra.character.migrations.v1-to-v2';

// Pacote de conteúdo ativo assumido por esta migração (única fonte de
// conteúdo hoje — dados/pacotes/dnd2024, ver Tasks 7-10). Uma futura tarefa
// multi-pacote precisará generalizar isto; não há registry vivo disponível
// nesta camada (Task 12 não conecta ContentRegistry/app-context).
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });
const NAMESPACE = 'dnd2024';

const ABILITY_KEYS = Object.freeze(['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma']);

// Nomes de exibição das 18 perícias (mesma lista de
// site/js/regras-cobertura.js#PERICIAS_TODAS, duplicada aqui — não
// importada — para não criar dependência de infra/character/** sobre o
// monólito plano em site/js/*.js). Usada só para filtrar
// `escolhas_talento` (que mistura nomes de perícia com outras escolhas,
// ex.: ferramentas) antes de decidir o que é proficiência de perícia.
const SKILL_DISPLAY_NAMES = new Set([
  'Acrobacia',
  'Arcanismo',
  'Atletismo',
  'Atuação',
  'Enganação',
  'Furtividade',
  'História',
  'Intimidação',
  'Intuição',
  'Investigação',
  'Lidar com Animais',
  'Medicina',
  'Natureza',
  'Percepção',
  'Persuasão',
  'Prestidigitação',
  'Religião',
  'Sobrevivência',
]);

// Campos v1 modelados estruturalmente — nunca duplicados em
// extensions.legacyPassthrough. Mantido em módulo para ser reutilizado
// pelo codec (character-codec.js) ao decidir o que passa por
// legacyPassthrough puro.
export const STRUCTURED_V1_FIELDS = Object.freeze([
  'id',
  'nome',
  'imagem',
  'alinhamento',
  'tamanho',
  'aparencia',
  'personalidade',
  'ideais',
  'lacos',
  'defeitos',
  'historia_personagem',
  'notas',
  'nivel',
  'xp',
  'exaustao',
  'classe',
  'subclasse',
  'especie',
  'antecedente',
  'atributos',
  'atributos_base',
  'pv_atual',
  'pv_temporario',
  'dados_vida_usados',
  'morte_sucessos',
  'morte_falhas',
  'pericias_proficientes',
  'pericias_expertise',
  'salvaguardas_proficientes',
  'idiomas',
  'proficiencias_ferramentas',
  'proficiencias_instrumentos',
  'proficiencias_extra',
  'resistencias',
  'vulnerabilidades',
  'imunidades',
  'talentos',
  'maestrias_arma',
  'inventario',
  'moedas',
  'po',
  'magias_conhecidas',
  'magias_preparadas',
  'condicoes',
  'config',
  'criado_em',
  'atualizado_em',
  '_slots_magia_livre',
  'espacos_magia_extras',
  'escolhas_classe',
  'escolhas_antecedente',
  'adepto_elemental_tipos',
  'adepto_elemental_tipo',
]);

// Prefixo de `sourceInstanceId` usado para os recursos de talento em formato
// `{usado: boolean}` reconciliados estruturalmente em `state.resources` (ver
// comentário abaixo, "Recursos de talento"). Exportado para que
// `character-codec.js#encodeCharacterRecord` faça o write-back inverso.
export const LEGACY_TALENT_RESOURCE_SOURCE_PREFIX = 'legacy:resources:talentos:';

// Campos deliberadamente FORA de STRUCTURED_V1_FIELDS mesmo tendo lógica de
// leitura dedicada abaixo — o valor bruto exato precisa sobreviver ao
// round-trip via extensions.legacyPassthrough porque a redução para o
// modelo canônico é range-lossy (não há forma canônica que reconstrua o
// byte original):
//   - "edicoes": só o sub-campo pv_max é reconciliado como override
//     (hp.maximum); demais sub-campos (ex.: edição de
//     atributos_base) não têm alvo canônico modelado nesta tarefa.
//   - "pv_max"/"pv_max_override": PV máximo é um campo DERIVADO (não fonte
//     no canônico); sem motor de regras conectado (Task 12 não liga
//     ContentRegistry), o valor bruto é preservado como projeção
//     descartável em vez de recalculado.
//   - "inspiracao_heroica": contador legado (int) reduzido para
//     `state.heroicInspiration` (boolean, regra 2024); o contador exato
//     sobrevive só via passthrough.

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normaliza a carteira de moedas replicando `site/js/store.js#migrarMoedasLegado`
 * + `site/js/moedas.js#normalizarCarteira`: se `moedas` já é objeto, usa-o
 * como base (ignorando `po` residual); senão, parte de `{po: raw.po ?? 0}`.
 * Cada denominação é coagida para número (strings numéricas aceitas),
 * padrão 0.
 * @param {*} rawMoedas
 * @param {*} rawPo
 * @returns {{pc: number, pp: number, pe: number, po: number, pl: number}}
 */
function normalizeWallet(rawMoedas, rawPo) {
  const base = isPlainObject(rawMoedas) ? rawMoedas : { po: typeof rawPo === 'number' ? rawPo : 0 };
  const coerce = (value) => {
    const num = typeof value === 'string' ? Number(value) : value;
    return typeof num === 'number' && Number.isFinite(num) ? num : 0;
  };
  return {
    pc: coerce(base.pc),
    pp: coerce(base.pp),
    pe: coerce(base.pe),
    po: coerce(base.po),
    pl: coerce(base.pl),
  };
}

/**
 * Resolve um nome legado para ContentId via o resolver injetado; devolve
 * `null` quando o resolver não tem alias exato (chamador decide o que
 * fazer — descartar ou preservar como texto bruto).
 * @param {import('../legacy-alias-resolver.js').LegacyAliasResolver} aliasResolver
 * @param {string} name
 * @returns {string | null}
 */
function tryResolve(aliasResolver, name) {
  const result = aliasResolver.resolve(name);
  return result.ok ? result.value : null;
}

/**
 * Resolve uma lista de nomes legados para ContentIds via alias, coletando
 * as falhas separadamente em vez de abortar na primeira.
 * @param {import('../legacy-alias-resolver.js').LegacyAliasResolver} aliasResolver
 * @param {ReadonlyArray<string>} names
 * @returns {{resolved: string[], unresolved: string[]}}
 */
function resolveAll(aliasResolver, names) {
  const resolved = [];
  const unresolved = [];
  for (const name of names ?? []) {
    const id = tryResolve(aliasResolver, name);
    if (id !== null) {
      resolved.push(id);
    } else {
      unresolved.push(name);
    }
  }
  return { resolved, unresolved };
}

/**
 * Constrói o ContentRef {id, packageVersion} para um id já resolvido no
 * namespace ativo.
 * @param {string} id
 * @returns {{id: string, packageVersion: string}}
 */
function ref(id) {
  return { id, packageVersion: '1.0.0' };
}

/**
 * Reconcilia `edicoes.campos.pv_max` (mecanismo genérico de edição do
 * baseline) e `pv_max_override` (mecanismo paralelo específico de PV
 * máximo) num único override canônico `hp.maximum` (vocabulário fechado de
 * alvos derivados da Task 15). Quando os
 * dois mecanismos discordam (reparo ambíguo), cria o override mesmo assim
 * — nunca escolhe silenciosamente — mas anexa `warning` explicando a
 * divergência, dando preferência a `pv_max_override` por ser o mecanismo
 * mais específico.
 * @param {*} raw
 * @returns {{overrides: object, warnings: string[]}}
 */
function reconcileHitPointMaximumOverride(raw) {
  const edicoesEntry = raw?.edicoes?.campos?.pv_max;
  const hasEdicao = isPlainObject(edicoesEntry);
  const hasOverrideField = raw?.pv_max_override !== null && raw?.pv_max_override !== undefined;

  if (!hasEdicao && !hasOverrideField) {
    return { overrides: {}, warnings: [] };
  }

  const warnings = [];
  let value;
  let original;
  let editedAt;

  if (hasOverrideField && hasEdicao) {
    value = raw.pv_max_override;
    original = edicoesEntry.original;
    editedAt = edicoesEntry.editadoEm;
    if (edicoesEntry.original !== raw.pv_max_override && typeof raw.pv_max === 'number') {
      warnings.push(
        `Reparo ambíguo: "edicoes.campos.pv_max" (original ${JSON.stringify(edicoesEntry.original)}) e "pv_max_override" (${JSON.stringify(raw.pv_max_override)}) discordam; usando pv_max_override.`,
      );
    }
  } else if (hasOverrideField) {
    value = raw.pv_max_override;
    original = typeof raw.pv_max === 'number' ? raw.pv_max : null;
    editedAt = raw.atualizado_em ?? null;
  } else {
    value = typeof raw.pv_max === 'number' ? raw.pv_max : null;
    original = edicoesEntry.original ?? null;
    editedAt = edicoesEntry.editadoEm ?? null;
  }

  const entry = {
    value,
    original,
    editedAt: typeof editedAt === 'string' ? editedAt : (raw?.atualizado_em ?? null),
    source: 'manual',
  };
  if (warnings.length > 0) {
    entry.warning = warnings[0];
  }

  return { overrides: { 'hp.maximum': entry }, warnings };
}

/**
 * Constrói `extensions.legacyPassthrough` a partir de todo campo do
 * registro bruto que não está em `STRUCTURED_V1_FIELDS`.
 * @param {object} raw
 * @returns {object}
 */
function buildLegacyPassthrough(raw) {
  const structured = new Set(STRUCTURED_V1_FIELDS);
  const passthrough = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!structured.has(key)) {
      passthrough[key] = value;
    }
  }
  return passthrough;
}

/**
 * Migra um registro de personagem v1 (bruto, não confiável) para o modelo
 * canônico v2.
 * @param {object} raw - registro v1 (já identificado como tal por detectCharacterRecordVersion).
 * @param {{aliasResolver: object, now: string}} context
 * @returns {import('../../../core/result.js').Result} Result<{character: object, warnings: string[]}, AppError>
 */
export function migrateV1ToV2(raw, { aliasResolver, now } = {}) {
  if (!isPlainObject(raw)) {
    return err(
      createAppError({
        code: 'CHARACTER_MIGRATION_INVALID_INPUT',
        scope: SCOPE,
        message: 'O registro v1 a migrar deve ser um objeto.',
        context: { receivedType: typeof raw },
      }),
    );
  }
  if (aliasResolver === undefined || aliasResolver === null || typeof aliasResolver.resolve !== 'function') {
    throw new TypeError('migrateV1ToV2: context.aliasResolver é obrigatório.');
  }
  if (typeof now !== 'string' || now.length === 0) {
    throw new TypeError('migrateV1ToV2: context.now deve ser uma string de timestamp ISO.');
  }

  const warnings = [];
  const unresolvedIssues = [];

  // --- Referências de classe/subclasse/espécie/antecedente -------------
  const resolveOptionalRef = (fieldName, value) => {
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }
    const id = tryResolve(aliasResolver, value);
    if (id === null) {
      unresolvedIssues.push({ field: fieldName, value });
      return undefined; // sentinela de "não resolvido" != null ("não escolhido")
    }
    return ref(id);
  };

  const classRef = resolveOptionalRef('classe', raw.classe);
  const subclassRef = resolveOptionalRef('subclasse', raw.subclasse);
  const speciesRef = resolveOptionalRef('especie', raw.especie);
  const backgroundRef = resolveOptionalRef('antecedente', raw.antecedente);

  if (unresolvedIssues.length > 0) {
    return err(
      createAppError({
        code: 'CHARACTER_LEGACY_ALIAS_NOT_FOUND',
        scope: SCOPE,
        message: `Não há alias exato para ${unresolvedIssues.length} campo(s) de conteúdo do personagem.`,
        context: { issues: unresolvedIssues },
      }),
    );
  }

  // --- Talentos (feats) e maestrias de arma: melhor esforço -------------
  // talento_versatil (Versátil do Humano): migrarTalentoVersatilHumano
  // (site/js/pages/sheet.js) garante presença em `talentos`, mas não pode
  // ser assumida já aplicada sobre o registro bruto recebido — mesclado
  // aqui antes de resolver, para o talento não se perder quando só
  // `talento_versatil` está preenchido e `talentos` ainda não o inclui.
  const featNames = Array.from(
    new Set([
      ...(raw.talentos ?? []),
      ...(typeof raw.talento_versatil === 'string' && raw.talento_versatil.length > 0 ? [raw.talento_versatil] : []),
    ]),
  );
  const featResolution = resolveAll(aliasResolver, featNames);
  if (featResolution.unresolved.length > 0) {
    warnings.push(
      `${featResolution.unresolved.length} talento(s) sem alias de conteúdo, preservados em extensions.legacyPassthrough.talentos_nao_resolvidos: ${featResolution.unresolved.join(', ')}`,
    );
  }
  const masteryResolution = resolveAll(aliasResolver, raw.maestrias_arma);
  if (masteryResolution.unresolved.length > 0) {
    warnings.push(
      `${masteryResolution.unresolved.length} maestria(s) de arma sem alias de conteúdo, preservadas em extensions.legacyPassthrough.maestrias_arma_nao_resolvidas: ${masteryResolution.unresolved.join(', ')}`,
    );
  }

  // --- legacyGrants: perícias/idiomas/salvaguardas/resistências --------
  // Perícias de espécie/talento: os formatos legado (`pericia_especie`,
  // string única) e atual (`pericias_especie`, array — ex.: Kenku) são
  // mesclados aqui em vez de assumidos já reconciliados em
  // `pericias_proficientes` — `migrarPericiaEspecie`/`migrarPericiasEspecie`
  // (site/js/pages/sheet.js) copiam para lá, mas esta migração não pode
  // assumir que essa sub-migração do monólito já rodou sobre o registro
  // bruto recebido.
  const speciesSkillNames = [
    ...(typeof raw.pericia_especie === 'string' && raw.pericia_especie.length > 0 ? [raw.pericia_especie] : []),
    ...(Array.isArray(raw.pericias_especie) ? raw.pericias_especie : []),
  ];
  const skillProficiencyNames = Array.from(
    new Set([...(raw.pericias_proficientes ?? []), ...speciesSkillNames]),
  );
  // migrarPericiasTalentos (site/js/pages/sheet.js): para cada contexto em
  // `escolhas_talento` (antecedente/versátil/levelup_N), toda escolha cujo
  // nome é uma perícia real (filtra ferramentas/outras escolhas não-perícia
  // pela lista fixa abaixo) é concedida como proficiência — mesclado aqui
  // pela mesma razão que pericia_especie/talento_versatil acima.
  const skillNamesFromTalentChoices = Object.values(isPlainObject(raw.escolhas_talento) ? raw.escolhas_talento : {})
    .flatMap((selections) => (Array.isArray(selections) ? selections : []))
    .filter((value) => typeof value === 'string' && SKILL_DISPLAY_NAMES.has(value));
  const skillProficiency = resolveAll(
    aliasResolver,
    Array.from(new Set([...skillProficiencyNames, ...skillNamesFromTalentChoices])),
  );
  // migrarEscolhasClasseLegadas (site/js/pages/sheet.js): as escolhas de
  // "especialista" (Ladino/Guardião) e "acadêmico" (Mago) em escolhas_classe
  // viram expertise mecanicamente.
  const expertiseFromClassChoices = [
    ...(Array.isArray(raw.escolhas_classe?.especialista) ? raw.escolhas_classe.especialista : []),
    ...(Array.isArray(raw.escolhas_classe?.academico) ? raw.escolhas_classe.academico : []),
  ];
  const skillExpertise = resolveAll(
    aliasResolver,
    Array.from(new Set([...(raw.pericias_expertise ?? []), ...expertiseFromClassChoices])),
  );
  const savingThrow = resolveAll(aliasResolver, raw.salvaguardas_proficientes);
  const languages = resolveAll(aliasResolver, raw.idiomas);
  const resistances = resolveAll(aliasResolver, raw.resistencias);
  const vulnerabilities = resolveAll(aliasResolver, raw.vulnerabilidades);

  const strictFailures = [
    ...skillProficiency.unresolved.map((v) => ({ field: 'pericias_proficientes', value: v })),
    ...skillExpertise.unresolved.map((v) => ({ field: 'pericias_expertise', value: v })),
    ...savingThrow.unresolved.map((v) => ({ field: 'salvaguardas_proficientes', value: v })),
    ...languages.unresolved.map((v) => ({ field: 'idiomas', value: v })),
    ...resistances.unresolved.map((v) => ({ field: 'resistencias', value: v })),
    ...vulnerabilities.unresolved.map((v) => ({ field: 'vulnerabilidades', value: v })),
  ];
  if (strictFailures.length > 0) {
    return err(
      createAppError({
        code: 'CHARACTER_LEGACY_ALIAS_NOT_FOUND',
        scope: SCOPE,
        message: `Não há alias exato para ${strictFailures.length} concessão(ões) legada(s).`,
        context: { issues: strictFailures },
      }),
    );
  }

  // Ferramentas/instrumentos/outras proficiências: melhor esforço, sem
  // exigir resolução (o schema aceita texto bruto para estes campos).
  const toolIds = (raw.proficiencias_ferramentas ?? []).map((name) => tryResolve(aliasResolver, name) ?? name);
  const instrumentIds = (raw.proficiencias_instrumentos ?? []).map(
    (name) => tryResolve(aliasResolver, name) ?? name,
  );
  const otherProficiencies = [...(raw.proficiencias_extra ?? [])];

  // --- Inventário --------------------------------------------------------
  const inventory = (raw.inventario ?? []).map((item, index) => {
    const instanceId = deriveLegacyInstanceId({
      collection: 'inventory',
      originalIndex: index,
      normalizedName: item?.nome ?? '',
    });
    const resolvedId = typeof item?.nome === 'string' ? tryResolve(aliasResolver, item.nome) : null;
    return {
      instanceId,
      itemRef: resolvedId !== null ? ref(resolvedId) : null,
      // customDefinition SEMPRE guarda o item bruto (mesmo quando itemRef
      // resolve): o v1 carrega campos livres (tipo/dados) sem home
      // estrutural equivalente no canônico ainda, e preservá-los aqui é o
      // que garante round-trip fiel do baseline sem precisar modelar
      // `tipo`/`dados` de cada tipo de item nesta tarefa.
      // `instanceId`/`quantidade`/`equipado` são removidos da cópia porque
      // já têm campo canônico próprio (evita reaparecerem duplicados dentro
      // de customDefinition numa segunda migração do mesmo registro já
      // codificado — ver character-codec.js#encodeCharacterRecord, que
      // escreve instanceId/quantidade/equipado de volta no item plano).
      customDefinition: item ? stripKnownItemFields(item) : null,
      quantity: typeof item?.quantidade === 'number' ? item.quantidade : 1,
      equipped: Boolean(item?.equipado),
      expended: 0,
      // O v1 nunca registrou proveniência de item de inventário (nenhum
      // campo "origem"/equivalente existe nos itens gerados pelo
      // monólito, conferido em site/js/pages/*.js); null aqui é fiel à
      // ausência real do dado, não uma lacuna de implementação.
      sourceInstanceId: null,
    };
  });

  // --- Magias --------------------------------------------------------
  // Magias concedidas por talento (Iniciado em Magia, Tocado por
  // Fadas/Sombras, Conjurador Ritualista, Telecinético) chegam em
  // `magias_conhecidas`/`magias_preparadas` como objetos com um campo
  // `origem` (site/js/regras-cobertura.js#aplicarEfeitoTalento, ex.:
  // `{nome, circulo, origem: 'iniciado_em_magia'}`) — é a ÚNICA
  // proveniência que o v1 de fato registra para magias, e vira
  // `sourceInstanceId` aqui de forma determinística, sem inventar dado.
  const buildSpellEntries = (collectionName, list) =>
    (list ?? []).map((spell, index) => {
      const name = typeof spell === 'string' ? spell : spell?.nome;
      const instanceId = deriveLegacyInstanceId({
        collection: collectionName,
        originalIndex: index,
        normalizedName: name ?? '',
      });
      const resolvedId = typeof name === 'string' ? tryResolve(aliasResolver, name) : null;
      const origem =
        typeof spell === 'object' && spell !== null && typeof spell.origem === 'string' ? spell.origem : null;
      return {
        instanceId,
        ...(resolvedId !== null ? { spellRef: ref(resolvedId) } : {}),
        // Mesma lógica do inventário logo acima: customDefinition preserva
        // o bruto sempre (menos `instanceId`, que já tem campo próprio).
        customDefinition:
          typeof spell === 'object' && spell !== null ? stripInstanceId(spell) : { nome: name },
        sourceInstanceId: origem !== null ? `legacy:spell-origin:${origem.replace(/_/g, '-')}` : null,
      };
    });
  const known = buildSpellEntries('spells-known', raw.magias_conhecidas);
  const prepared = buildSpellEntries('spells-prepared', raw.magias_preparadas);
  const spellbook = buildSpellEntries('spells-spellbook', raw.grimorio);

  // --- Condições: melhor esforço --------------------------------------
  const conditions = (raw.condicoes ?? []).map((name) => tryResolve(aliasResolver, name) ?? name);

  // --- Manobras de combate: melhor esforço (mesmo padrão de talentos/maestrias) ---
  const maneuverResolution = resolveAll(aliasResolver, raw.manobras_conhecidas);
  if (maneuverResolution.unresolved.length > 0) {
    warnings.push(
      `${maneuverResolution.unresolved.length} manobra(s) de combate sem alias de conteúdo, preservadas em extensions.legacyPassthrough.manobras_conhecidas_nao_resolvidas: ${maneuverResolution.unresolved.join(', ')}`,
    );
  }

  // --- Escolhas de classe/antecedente/Adepto Elemental (build.choices) ---
  // Chaves prefixadas por "classe:"/"antecedente:" para nunca colidir entre
  // as duas origens (ex.: as duas poderiam coincidentemente usar a mesma
  // chave local). Valores são sempre normalizados para array (o v1 usa ora
  // string única — escolhas_antecedente —, ora array — escolhas_classe).
  const choices = {};
  for (const [key, value] of Object.entries(raw.escolhas_classe ?? {})) {
    choices[`classe:${key}`] = Array.isArray(value) ? value : [value];
  }
  for (const [key, value] of Object.entries(raw.escolhas_antecedente ?? {})) {
    choices[`antecedente:${key}`] = Array.isArray(value) ? value : [value];
  }
  // migrarAdeptoElementalTipos (site/js/pages/sheet.js): formato legado
  // (`adepto_elemental_tipo`, string única) mesclado com o formato atual
  // (`adepto_elemental_tipos`, array), pela mesma razão de não assumir que
  // a sub-migração do monólito já rodou sobre o bruto recebido.
  const adeptoElementalTipos = Array.from(
    new Set([
      ...(Array.isArray(raw.adepto_elemental_tipos) ? raw.adepto_elemental_tipos : []),
      ...(typeof raw.adepto_elemental_tipo === 'string' && raw.adepto_elemental_tipo.length > 0
        ? [raw.adepto_elemental_tipo]
        : []),
    ]),
  );
  if (adeptoElementalTipos.length > 0) {
    choices['talento:adepto-elemental'] = adeptoElementalTipos.map((tipo) => tryResolve(aliasResolver, tipo) ?? tipo);
  }

  // --- Recursos de talento (state.resources): só o subconjunto de forma
  // uniforme "{usado: boolean}" (site/js/regras-cobertura.js#recursoTalento)
  // é modelado estruturalmente — current:1 (disponível) ou 0 (usado). Os
  // demais formatos multi-campo (ex.: dadiva_recuperacao com dois campos
  // heterogêneos) não têm uma redução honesta para {current} e continuam
  // só em extensions.legacyPassthrough.recursos (preservados verbatim).
  //
  // `LEGACY_TALENT_RESOURCE_SOURCE_PREFIX` é exportado para que
  // `character-codec.js#encodeCharacterRecord` reconheça essas entradas de
  // `state.resources` e projete `current` de volta para
  // `recursos.talentos.<chave>.usado` (write-back — fix round 1 da Task 17,
  // achado I2: sem isto, uma restauração feita por `domain/commands/rest.js`
  // sobre `state.resources` nunca chegava ao registro plano, porque o
  // encoder só reemitia a cópia ORIGINAL/obsoleta de `recursos` vinda de
  // `extensions.legacyPassthrough`).
  const resources = {};
  const talentResources = raw?.recursos?.talentos;
  if (isPlainObject(talentResources)) {
    for (const [key, value] of Object.entries(talentResources)) {
      if (isPlainObject(value) && typeof value.usado === 'boolean' && Object.keys(value).length === 1) {
        resources[`dnd2024:resource:${slugifyLocal(key)}`] = {
          current: value.usado ? 0 : 1,
          sourceInstanceId: `${LEGACY_TALENT_RESOURCE_SOURCE_PREFIX}${slugifyLocal(key)}`,
        };
      }
    }
  }

  // --- Espaços de magia (state.spells.slots), a partir de espacos_magia:
  // {"<circulo>": {usados, total}} -> {"<circulo>": {used}}. `total` NÃO é
  // copiado (é o máximo, derivado do ruleset/classe — não é fonte no
  // canônico, ver brief). `espacos_magia_extras[circulo]` (slots extras
  // concedidos, ex.: Fonte de Magia — site/js/pages/sheet.js:5730-5731) É
  // fonte no canônico (é uma concessão registrada, não um máximo derivado)
  // e vira `slots[circulo].extra`; um círculo com extra mas sem entrada em
  // `espacos_magia` ainda ganha uma entrada aqui (used:0).
  const slots = {};
  for (const [circle, value] of Object.entries(raw.espacos_magia ?? {})) {
    if (isPlainObject(value)) {
      slots[circle] = { used: typeof value.usados === 'number' ? value.usados : 0, extra: 0 };
    }
  }
  for (const [circle, value] of Object.entries(isPlainObject(raw.espacos_magia_extras) ? raw.espacos_magia_extras : {})) {
    const extra = typeof value === 'number' ? value : 0;
    if (slots[circle]) {
      slots[circle].extra = extra;
    } else {
      slots[circle] = { used: 0, extra };
    }
  }

  // --- Vagas de magia conhecida livres (_slots_magia_livre) ------------
  const freeKnownSlots = typeof raw._slots_magia_livre === 'number' ? raw._slots_magia_livre : 0;

  // --- Overrides: edicoes (projeção compatível) + pv_max_override -------
  const hpMaxReconciliation = reconcileHitPointMaximumOverride(raw);
  warnings.push(...hpMaxReconciliation.warnings);

  // --- extensions.legacyPassthrough ------------------------------------
  const legacyPassthrough = buildLegacyPassthrough(raw);
  if (featResolution.unresolved.length > 0) {
    legacyPassthrough.talentos_nao_resolvidos = featResolution.unresolved;
  }
  if (masteryResolution.unresolved.length > 0) {
    legacyPassthrough.maestrias_arma_nao_resolvidas = masteryResolution.unresolved;
  }
  if (maneuverResolution.unresolved.length > 0) {
    legacyPassthrough.manobras_conhecidas_nao_resolvidas = maneuverResolution.unresolved;
  }
  if (typeof raw.dados_vida_total === 'number') {
    legacyPassthrough.dados_vida_total = raw.dados_vida_total;
  }
  if (typeof raw.pv_max === 'number' && hpMaxReconciliation.overrides['hp.maximum'] === undefined) {
    legacyPassthrough.pv_max = raw.pv_max;
  }
  // inspiracao_heroica é sempre fixado aqui (mesmo quando ausente do bruto,
  // caso em que assume 0) para que a primeira migração e uma migração
  // repetida do mesmo registro já codificado (que sempre tem o campo,
  // porque o encoder sempre o emite) produzam legacyPassthrough idêntico —
  // ver character-codec.js#encodeCharacterRecord.
  legacyPassthrough.inspiracao_heroica = typeof raw.inspiracao_heroica === 'number' ? raw.inspiracao_heroica : 0;

  const namespaceOfClass = NAMESPACE;

  const character = {
    schemaVersion: 2,
    identity: {
      id: raw.id,
      name: typeof raw.nome === 'string' ? raw.nome : '',
      image: typeof raw.imagem === 'string' ? raw.imagem : '',
      alignment: typeof raw.alinhamento === 'string' ? raw.alinhamento : '',
      // Preserva o texto legado tal como está (ex.: "Médio ou Pequeno",
      // derivado da espécie pelo baseline) OU string vazia quando ausente —
      // NUNCA um default hardcoded como "medium". `identity.size` não é um
      // enum canônico com tradução reversa (ver character-codec.js#encode);
      // um default diferente de vazio seria persistido de volta como texto
      // errado no primeiro encode v2 (achado do review independente da
      // Task 13: corrompia `tamanho` de todo personagem que passasse pelo
      // codec, inclusive um `criarPersonagemVazio()` recém-criado com
      // `tamanho: ''`).
      size: typeof raw.tamanho === 'string' ? raw.tamanho : '',
      appearance: typeof raw.aparencia === 'string' ? raw.aparencia : '',
      personality: typeof raw.personalidade === 'string' ? raw.personalidade : '',
      ideals: typeof raw.ideais === 'string' ? raw.ideais : '',
      bonds: typeof raw.lacos === 'string' ? raw.lacos : '',
      flaws: typeof raw.defeitos === 'string' ? raw.defeitos : '',
      backstory: typeof raw.historia_personagem === 'string' ? raw.historia_personagem : '',
      notes: typeof raw.notas === 'string' ? raw.notas : '',
    },
    build: {
      contentScopes: { [namespaceOfClass]: { packageVersion: '1.0.0' } },
      rulesetRef: RULESET_REF,
      classRef: classRef ?? null,
      subclassRef: subclassRef ?? null,
      speciesRef: speciesRef ?? null,
      backgroundRef: backgroundRef ?? null,
      choices,
      abilityGeneration: {
        method: raw?.configuracao_criacao?.atributos?.metodo ?? 'standard',
        base: pickAbilities(raw.atributos_base ?? raw.atributos),
        rolls: Array.isArray(raw?.configuracao_criacao?.atributos?.rolagens)
          ? raw.configuracao_criacao.atributos.rolagens
          : [],
      },
      featRefs: featResolution.resolved.map(ref),
      weaponMasteryRefs: masteryResolution.resolved.map(ref),
      maneuverRefs: maneuverResolution.resolved.map(ref),
      legacyGrants: {
        skillProficiencyIds: skillProficiency.resolved,
        skillExpertiseIds: skillExpertise.resolved,
        savingThrowProficiencyIds: savingThrow.resolved,
        languageIds: languages.resolved,
        toolProficiencyIds: toolIds,
        instrumentProficiencyIds: instrumentIds,
        otherProficiencies,
        resistanceIds: resistances.resolved,
        vulnerabilityIds: vulnerabilities.resolved,
        immunityIds: [...(raw.imunidades ?? [])],
      },
      options: {
        encumbranceAffectsMovement: Boolean(raw?.config?.sobrecarga_afeta_deslocamento),
      },
    },
    state: {
      level: typeof raw.nivel === 'number' ? raw.nivel : 1,
      xp: typeof raw.xp === 'number' ? raw.xp : 0,
      abilities: pickAbilities(raw.atributos),
      hitPoints: {
        current: typeof raw.pv_atual === 'number' ? raw.pv_atual : 0,
        temporary: typeof raw.pv_temporario === 'number' ? raw.pv_temporario : 0,
      },
      hitDice: { used: typeof raw.dados_vida_usados === 'number' ? raw.dados_vida_usados : 0 },
      deathSaves: {
        successes: typeof raw.morte_sucessos === 'number' ? raw.morte_sucessos : 0,
        failures: typeof raw.morte_falhas === 'number' ? raw.morte_falhas : 0,
      },
      exhaustion: typeof raw.exaustao === 'number' ? raw.exaustao : 0,
      heroicInspiration: Boolean(raw.inspiracao_heroica),
      resources,
      spells: {
        known,
        prepared,
        spellbook,
        slots,
        pactSlots: { used: 0 },
        concentration: null,
        freeKnownSlots,
      },
      inventory,
      wallet: normalizeWallet(raw.moedas, raw.po),
      conditions,
      activeEffects: [],
      // talentos_flags já é um mapa "nome -> boolean" (site/js/pages/sheet.js),
      // encaixe direto e sem perda no formato aberto de state.usageFlags.
      usageFlags: isPlainObject(raw.talentos_flags) ? { ...raw.talentos_flags } : {},
    },
    overrides: hpMaxReconciliation.overrides,
    extensions: { legacyPassthrough },
    metadata: {
      createdAt: typeof raw.criado_em === 'string' ? raw.criado_em : now,
      updatedAt: typeof raw.atualizado_em === 'string' ? raw.atualizado_em : now,
      creationConfig: isPlainObject(raw.configuracao_criacao) ? raw.configuracao_criacao : {},
    },
  };

  return ok({ character, warnings });
}

/**
 * Copia um item de inventário legado sem as chaves que já têm campo
 * canônico próprio (`instanceId`/`quantidade`/`equipado`).
 * @param {object} item
 * @returns {object}
 */
function stripKnownItemFields(item) {
  const { instanceId, quantidade, equipado, ...rest } = item;
  void instanceId;
  void quantidade;
  void equipado;
  return rest;
}

/**
 * Copia uma entrada de magia legada sem `instanceId` (já tem campo
 * canônico próprio).
 * @param {object} spell
 * @returns {object}
 */
function stripInstanceId(spell) {
  const { instanceId, ...rest } = spell;
  void instanceId;
  return rest;
}

/**
 * Normaliza uma chave local (ex.: "dadiva_destino") para o segmento slug
 * ASCII minúsculo kebab-case exigido pelo formato de ContentId
 * (site/js/core/content-id.js) — troca "_" por "-", mantém apenas
 * alfanuméricos/hífen.
 * @param {string} key
 * @returns {string}
 */
function slugifyLocal(key) {
  return String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extrai o subconjunto de seis habilidades de um objeto legado de
 * atributos, com padrão 10 para chaves ausentes.
 * @param {*} source
 * @returns {object}
 */
function pickAbilities(source) {
  const result = {};
  for (const key of ABILITY_KEYS) {
    const value = source?.[key];
    result[key] = typeof value === 'number' ? value : 10;
  }
  return result;
}
