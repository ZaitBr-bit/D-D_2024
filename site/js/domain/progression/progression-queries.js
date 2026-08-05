// Módulo `domain/progression/progression-queries`: consultas PURAS da matriz
// de progressão 1-20 e do PV máximo derivado do histórico de rolagens
// (Task 23).
//
// ## De onde vem a matriz
//
// NÃO existe tabela de progressão codificada aqui. Cada linha da matriz é
// DERIVADA do catálogo (`dados/pacotes/dnd2024/classes/*.json`), que já modela
// a progressão como efeitos ESTRUTURADOS gated por nível:
//
//   - `type: "resource"` com `when: {kind: "level", min, max}` -> colunas de
//     recurso da tabela legada (Fúrias, Maestria em Arma, espaços de magia
//     `spell-slot-N`, truques, ...);
//   - `type: "modifier"` gated por nível -> colunas numéricas (Dano da Fúria);
//   - entidades `feature` com `level` -> coluna "Características de Classe";
//   - `type: "official-handler"` com `handlerId: "asi-or-feat"` -> os níveis de
//     Aumento no Valor de Atributo, e `params.epicBoon === true` marca a
//     Dádiva Épica (nível 19 na maioria das classes).
//
// Isso é uma exigência dura, não uma preferência: a mecânica de um nível é
// decidida SOMENTE por campo estruturado (`level`, `when`, `handlerId`,
// `params`), nunca por nome de exibição nem por prosa de descrição. Um nível
// não "concede ASI" porque a característica se chama "Aumento no Valor de
// Atributo" — concede porque existe um efeito `asi-or-feat` naquele nível.
//
// ## PV máximo
//
// `getMaximumHitPoints` recomputa SEMPRE a partir de `state.hitPointRolls`
// (fonte, acrescida a cada level-up) + modificador de Constituição por nível +
// bônus vindos de efeitos de conteúdo. Nunca lê um máximo congelado, e nunca
// escreve um `override`: `overrides["hp.maximum"]` é exclusivamente o ajuste
// manual do usuário (mesmo contrato de
// `domain/character/queries/hit-points.js`). Consequência desejada: subir
// Constituição por ASI recalcula retroativamente o máximo, sem tocar em
// `hitPointRolls`.
//
// Ausência de `hitPointRolls` é ERRO EXPLÍCITO, não média presumida — um
// registro migrado de v1 não tem histórico, e inventar um valor plausível é
// exatamente o default de migração proibido pelas Global Constraints.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import {
  collectCharacterEffects,
  resolveNumericTarget,
  resolveNumericValue,
  sortResolvedEffects,
  filterByStackKey,
} from '../effects/index.js';
import { getAbilityModifier } from '../character/queries/index.js';
import { withEffectContextVariables } from '../character/queries/index.js';

const SCOPE = 'domain.progression.queries';

/** Menor e maior nível de personagem que o modelo canônico admite. */
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 20;

/** `handlerId` estruturado que marca um nível de Aumento de Atributo/Talento. */
const ASI_HANDLER_ID = 'asi-or-feat';

/**
 * `handlerId` que carrega a TABELA de espaços de Magia de Pacto do Bruxo.
 *
 * O Bruxo é a única classe cujos espaços NÃO são efeitos `resource`
 * `spell-slot-N`: a migração da Task 8 os guardou como uma tabela
 * `{nível: {slots, circulo}}` dentro de `params` deste marcador. Sem ler isto,
 * a matriz devolveria `spellSlots: {}` para o Bruxo nos 20 níveis — foi
 * exatamente a divergência que o contrato `level-up-parity` mediu contra a
 * tabela legada (20 de 20 níveis, e nenhuma outra em nenhuma outra classe).
 *
 * É DADO lido, não handler invocado — a mesma classificação formalizada em
 * `tests/contract/official-handler-coverage.test.js` (Decisão B).
 */
const PACT_MAGIC_HANDLER_ID = 'pact-magic-slots';

/** Prefixo dos recursos de espaço de magia no catálogo (`spell-slot-3`). */
const SPELL_SLOT_RESOURCE_PREFIX = 'spell-slot-';

/**
 * Notação de dado que a migração da Task 8 gravou em `max` de alguns efeitos
 * `resource` (Bardo: `dados-de-inspiracao` = "D6"/"D8"/"D10"/"D12"). É uma
 * COLUNA DE DADO da tabela legada, não uma quantidade — o campo `max` foi
 * reaproveitado para isso.
 *
 * DEFEITO DE MODELAGEM DO CATÁLOGO, registrado como concern da Task 23: o
 * lugar certo seria um campo estruturado próprio. Enquanto não existe, a
 * matriz separa essas colunas em `diceProgression` em vez de (a) explodir com
 * `EFFECT_VALUE_NOT_NUMERIC` — o que tornaria a matriz do Bardo inutilizável —
 * ou (b) descartá-las em silêncio. O reconhecimento é por REGEX ESTRITA sobre
 * o valor estruturado, nunca por nome do recurso nem por prosa.
 */
const DIE_NOTATION = /^[dD](4|6|8|10|12|20)$/;

/**
 * Cria um AppError do escopo de consultas de progressão.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {Readonly<object>}
 */
export function progressionError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Confere a forma mínima de um CanonicalCharacter, como as consultas da
 * Task 16 fazem.
 * @param {*} character
 * @returns {boolean}
 */
function hasCharacterShape(character) {
  return (
    character !== null &&
    typeof character === 'object' &&
    character.identity !== null &&
    typeof character.identity === 'object' &&
    character.build !== null &&
    typeof character.build === 'object' &&
    character.state !== null &&
    typeof character.state === 'object'
  );
}

/**
 * Devolve uma VISÃO do personagem com `state.level` trocado, sem mutar o
 * original. Usada para projetar a matriz nível a nível reaproveitando as
 * consultas existentes, que leem `state.level`.
 * @param {object} character
 * @param {number} level
 * @returns {object}
 */
function characterAtLevel(character, level) {
  return { ...character, state: { ...character.state, level } };
}

/**
 * Devolve o namespace de um ContentId (`dnd2024:class:mago` -> `dnd2024`).
 * Mesma regra de `domain/commands/rest.js`.
 * @param {*} id
 * @returns {string | null}
 */
function namespaceOf(id) {
  return typeof id === 'string' && id.length > 0 ? id.split(':')[0] : null;
}

/**
 * Qualifica o slug de recurso de um efeito com o namespace da FONTE, no mesmo
 * formato que `state.resources` usa (`dnd2024:resource:furias`) — o vocabulário
 * de `apply-grants.js`/`rest.js`. Devolve `null` quando a fonte não tem
 * ContentId (nunca inventa um namespace padrão).
 * @param {object} resolved - ResolvedEffect
 * @returns {{resourceId: string, slug: string} | null}
 */
function resourceIdOf(resolved) {
  const effect = resolved?.effect ?? resolved;
  const slug = typeof effect?.resource === 'string' ? effect.resource : null;
  if (slug === null) {
    return null;
  }
  const namespace = namespaceOf(resolved?.sourceId);
  if (namespace === null) {
    return null;
  }
  return { resourceId: `${namespace}:resource:${slug}`, slug };
}

/**
 * Diz se uma FEATURE concede Aumento no Valor de Atributo/Talento, e se é a
 * Dádiva Épica (`params.epicBoon === true`).
 *
 * Decisão SOMENTE por campo estruturado: `type`, `handlerId` e `params`. O
 * nome da característica é irrelevante aqui de propósito — um nível não
 * "concede ASI" porque a feature se chama "Aumento no Valor de Atributo".
 * @param {object} feature
 * @returns {{isAsi: boolean, isEpicBoon: boolean}}
 */
function asiInfoOf(feature) {
  let isAsi = false;
  let isEpicBoon = false;
  for (const effect of Array.isArray(feature?.effects) ? feature.effects : []) {
    if (effect?.type !== 'official-handler' || effect?.handlerId !== ASI_HANDLER_ID) {
      continue;
    }
    isAsi = true;
    isEpicBoon = isEpicBoon || effect?.params?.epicBoon === true;
  }
  return { isAsi, isEpicBoon };
}

/**
 * Espaços de Magia de Pacto vigentes num nível, lidos da tabela estruturada
 * do marcador `pact-magic-slots` presente nos efeitos coletados.
 *
 * Devolve `{}` quando o personagem não tem o marcador (as outras 11 classes) —
 * ausência de marcador é ausência de Magia de Pacto, não um caso de erro. Mas
 * marcador PRESENTE com tabela ilegível é erro explícito: um Bruxo sem espaço
 * nenhum seria um bug silencioso.
 * @param {ReadonlyArray<object>} effects
 * @param {number} level
 * @returns {import('../../core/result.js').Result} Result<Record<string, number>, AppError>
 */
function pactMagicSlots(effects, level) {
  const marcador = (Array.isArray(effects) ? effects : []).find((entrada) => {
    const efeito = entrada?.effect ?? entrada;
    return efeito?.type === 'official-handler' && efeito?.handlerId === PACT_MAGIC_HANDLER_ID;
  });
  if (marcador === undefined) {
    return ok({});
  }
  const tabela = (marcador.effect ?? marcador)?.params?.table;
  if (tabela === null || typeof tabela !== 'object') {
    return err(
      progressionError(
        'PROGRESSION_PACT_MAGIC_TABLE_INVALID',
        'O marcador "pact-magic-slots" não traz "params.table"; os espaços de Magia de Pacto não são inventados.',
        { level },
      ),
    );
  }
  const linha = tabela[String(level)];
  if (linha === undefined) {
    // Nível fora da tabela é ausência legítima (a tabela cobre 1..20).
    return ok({});
  }
  if (!Number.isInteger(linha.slots) || !Number.isInteger(linha.circulo)) {
    return err(
      progressionError(
        'PROGRESSION_PACT_MAGIC_ROW_INVALID',
        `A linha ${level} de "pact-magic-slots" não traz "slots"/"circulo" inteiros.`,
        { level, row: linha },
      ),
    );
  }
  // Mesma forma do restante de `spellSlots`: círculo -> quantidade. O Bruxo tem
  // todos os espaços no MESMO círculo, que é o que a tabela legada mostra.
  return ok({ [String(linha.circulo)]: linha.slots });
}

/**
 * Coleta os efeitos do personagem projetados em um nível específico.
 * @param {object} character
 * @param {number} level
 * @param {object} context - precisa de `context.registry`.
 * @returns {import('../../core/result.js').Result} Result<Array<ResolvedEffect>, AppError>
 */
function effectsAtLevel(character, level, context) {
  return collectCharacterEffects(characterAtLevel(character, level), { ...context, level });
}

/**
 * Monta o mapa `recurso -> máximo` vigente num nível, já resolvido pelo motor
 * de efeitos (que aplica precedência e `stackKey`, então uma ladder
 * `furias-1/3/6/12/17` colapsa no degrau correto do nível).
 * @param {ReadonlyArray<object>} effects
 * @param {object} context
 * @returns {import('../../core/result.js').Result} Result<Record<string, number>, AppError>
 */
function resourceMaximums(effects, context) {
  // Um efeito `resource` NÃO é um `modifier`: seu teto está em `effect.max`
  // (mesma leitura de `commands/rest.js` e `effects/apply-grants.js`), não num
  // alvo numérico `resource.<id>`. Resolver isto por `resolveNumericTarget`
  // devolveria silenciosamente o baseValue para TODOS os recursos — é
  // exatamente o "bypass silencioso" que este projeto proíbe.
  const relevantes = (Array.isArray(effects) ? effects : []).filter(
    (entrada) => (entrada?.effect ?? entrada)?.type === 'resource',
  );
  // A ladder do catálogo (`furias-1/3/6/12/17`) compartilha `stackKey` com
  // `stackable: false`: só o degrau de maior precedência do nível sobrevive.
  const vencedores = filterByStackKey(sortResolvedEffects(relevantes));

  const maximos = {};
  const slugs = {};
  const dados = {};
  for (const resolvido of vencedores) {
    const efeito = resolvido?.effect ?? resolvido;
    const identificacao = resourceIdOf(resolvido);
    if (identificacao === null) {
      return err(
        progressionError(
          'PROGRESSION_RESOURCE_ID_UNQUALIFIED',
          'Um efeito de recurso não pôde ser qualificado (fonte sem ContentId ou "resource" ausente); ' +
            'a matriz não inventa um namespace nem descarta o recurso em silêncio.',
          { resource: typeof efeito?.resource === 'string' ? efeito.resource : null, sourceId: resolvido?.sourceId ?? null },
        ),
      );
    }
    if (typeof efeito.max === 'string' && DIE_NOTATION.test(efeito.max)) {
      dados[identificacao.resourceId] = efeito.max.toLowerCase();
      slugs[identificacao.resourceId] = identificacao.slug;
      continue;
    }
    const max = resolveNumericValue(efeito.max, context);
    if (!max.ok) {
      return max;
    }
    if (!Number.isInteger(max.value) || max.value < 0) {
      return err(
        progressionError(
          'PROGRESSION_RESOURCE_MAX_UNRESOLVED',
          `O "max" do recurso "${identificacao.resourceId}" não resolveu para um inteiro >= 0; um teto não é inventado.`,
          { resourceId: identificacao.resourceId, declaredMax: efeito.max },
        ),
      );
    }
    // Dois efeitos de recurso com o MESMO id e sem `stackKey` comum acumulam
    // (contrato de `filterByStackKey`: ausência de stackKey = sempre acumula).
    maximos[identificacao.resourceId] = (maximos[identificacao.resourceId] ?? 0) + max.value;
    slugs[identificacao.resourceId] = identificacao.slug;
  }
  return ok({ maximos, slugs, dados });
}

/**
 * Separa o mapa de recursos entre espaços de magia (`spell-slot-N`) e demais
 * recursos de classe, sem reinterpretar nome de exibição: a distinção é o
 * prefixo estruturado que a migração usa para espaços de magia.
 * @param {Record<string, number>} maximos
 * @returns {{spellSlots: Record<string, number>, resources: Record<string, number>}}
 */
function splitSpellSlots({ maximos, slugs, dados }) {
  const spellSlots = {};
  const resources = {};
  for (const id of Object.keys(maximos).sort()) {
    const slug = slugs[id];
    if (typeof slug === 'string' && slug.startsWith(SPELL_SLOT_RESOURCE_PREFIX)) {
      spellSlots[slug.slice(SPELL_SLOT_RESOURCE_PREFIX.length)] = maximos[id];
    } else {
      resources[id] = maximos[id];
    }
  }
  const diceProgression = {};
  for (const id of Object.keys(dados).sort()) {
    diceProgression[id] = dados[id];
  }
  return { spellSlots, resources, diceProgression };
}

/**
 * Lista TODAS as features que as fontes de build do personagem
 * (classe/subclasse/espécie/antecedente/talentos) concedem, lidas do catálogo
 * pelo campo estruturado `grantedBy` — exatamente a mesma regra de
 * `domain/effects/collect-effects.js#buildSources`.
 *
 * Não deriva das features da lista de ResolvedEffects: um ResolvedEffect não
 * carrega a entidade de origem (só `sourceId`), e uma feature SEM efeitos
 * (puramente narrativa) precisa aparecer na tabela de progressão mesmo assim.
 * @param {object} character
 * @param {object} registry
 * @returns {Array<object>}
 */
function featuresOfBuild(character, registry) {
  const build = character?.build ?? {};
  const donos = new Set();
  for (const chave of ['classRef', 'subclassRef', 'speciesRef', 'backgroundRef']) {
    const referencia = build[chave];
    const id = typeof referencia === 'string' ? referencia : referencia?.id;
    if (typeof id === 'string') {
      donos.add(id);
    }
  }
  for (const referencia of Array.isArray(build.featRefs) ? build.featRefs : []) {
    const id = typeof referencia === 'string' ? referencia : referencia?.id;
    if (typeof id === 'string') {
      donos.add(id);
    }
  }
  if (donos.size === 0) {
    return [];
  }
  return [...registry.list('feature')].filter(
    (feature) => typeof feature?.grantedBy === 'string' && donos.has(feature.grantedBy),
  );
}

/**
 * Filtra as features concedidas EXATAMENTE em `level`, em ordem determinística
 * de id.
 *
 * Feature sem `level` inteiro não entra em nenhum nível: a ausência é
 * preservada, nunca tratada como nível 1.
 * @param {ReadonlyArray<object>} features
 * @param {number} level
 * @returns {Array<{id: string, name: string, level: number}>}
 */
function featuresGainedAt(features, level) {
  return features
    .filter((feature) => Number.isInteger(feature?.level) && feature.level === level)
    .map((feature) => Object.freeze({ id: feature.id, name: feature.name, level: feature.level }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Projeta a matriz de progressão do personagem para os níveis 1..20.
 *
 * Consulta PURA: não muta o personagem, não persiste, não faz I/O. Cada linha
 * é `{level, proficiencyBonus, features, resources, spellSlots,
 * diceProgression, grantsAbilityScoreImprovement, grantsEpicBoon}`.
 *
 * `resources`/`diceProgression` são chaveados pelo ContentId qualificado do
 * recurso (`dnd2024:resource:furias`), o MESMO vocabulário de
 * `state.resources` (`effects/apply-grants.js`). `spellSlots` é chaveado pelo
 * círculo ("1".."9"), derivado do prefixo estruturado `spell-slot-`.
 *
 * @param {object} character - CanonicalCharacter (Task 12).
 * @param {{registry: object}} context - `registry` é OBRIGATÓRIO: sem catálogo
 *   não há progressão a derivar, e devolver uma matriz vazia seria um bypass
 *   silencioso.
 * @returns {import('../../core/result.js').Result} Result<ReadonlyArray<object>, AppError>
 */
export function getProgressionMatrix(character, context = {}) {
  if (!hasCharacterShape(character)) {
    return err(
      progressionError(
        'PROGRESSION_CHARACTER_INVALID',
        'A consulta de progressão exige um CanonicalCharacter com identity/build/state.',
        {},
      ),
    );
  }
  if (context?.registry === null || typeof context?.registry !== 'object') {
    return err(
      progressionError(
        'PROGRESSION_REGISTRY_REQUIRED',
        'A matriz de progressão é derivada do catálogo: "context.registry" é obrigatório.',
        {},
      ),
    );
  }

  // `context.variables` que o CHAMADOR fixou têm precedência (contrato de
  // `withEffectContextVariables`: um simulador de "e se" pode congelar um
  // valor). Só quando ele não fixou nada é que a matriz resolve as variáveis
  // POR LINHA — ver o comentário dentro do loop.
  const variaveisFixadasPeloChamador =
    context.variables !== undefined && context.variables !== null && typeof context.variables === 'object';
  const featuresDoCatalogo = featuresOfBuild(character, context.registry);

  const linhas = [];
  for (let level = MIN_LEVEL; level <= MAX_LEVEL; level += 1) {
    // As variáveis (`proficiency-bonus`, `level`, `levelHalfDown`,
    // `<atributo>Modifier*`) são resolvidas PARA O NÍVEL DESTA LINHA, a partir
    // de uma VISÃO do personagem naquele nível.
    //
    // Resolvê-las uma vez fora do loop era um bug real: `getProficiencyBonus`
    // lê `character.state.level` (não `context.level`), então toda linha da
    // matriz recebia o bônus de proficiência do nível ATUAL do personagem. Um
    // Draconato nível 1 projetava "ataque-de-sopro" (`max: "proficiency-bonus"`)
    // como 2 nos 20 níveis; no nível 20, como 6 nos 20 níveis — enquanto a
    // coluna `proficiencyBonus` da MESMA linha crescia 2→6 corretamente. Seis
    // espécies do catálogo (aasimar, anão, draconato, golias, orc, kenku)
    // dependem disso.
    const contextoParaVariaveis = { ...context, level, registry: context.registry };
    let contextoNivel;
    if (variaveisFixadasPeloChamador) {
      contextoNivel = { ...context, level };
    } else {
      const comVariaveis = withEffectContextVariables(
        characterAtLevel(character, level),
        contextoParaVariaveis,
      );
      if (!comVariaveis.ok) {
        return comVariaveis;
      }
      contextoNivel = comVariaveis.value;
    }

    const efeitos = effectsAtLevel(character, level, contextoNivel);
    if (!efeitos.ok) {
      return efeitos;
    }

    const pb = resolveNumericTarget({
      target: 'proficiency-bonus',
      baseValue: Math.ceil(level / 4) + 1,
      effects: efeitos.value,
      context: contextoNivel,
    });
    if (!pb.ok) {
      return pb;
    }

    const maximos = resourceMaximums(efeitos.value, contextoNivel);
    if (!maximos.ok) {
      return maximos;
    }
    const { spellSlots, resources, diceProgression } = splitSpellSlots(maximos.value);

    // Magia de Pacto (Bruxo): tabela estruturada em vez de efeitos `resource`.
    const pacto = pactMagicSlots(efeitos.value, level);
    if (!pacto.ok) {
      return pacto;
    }
    for (const [circulo, quantidade] of Object.entries(pacto.value)) {
      // Um Bruxo multiclasse teria as duas fontes; somar é o certo, e hoje
      // nenhuma classe declara as duas ao mesmo tempo.
      spellSlots[circulo] = (spellSlots[circulo] ?? 0) + quantidade;
    }

    // ASI/Dádiva Épica: só conta quando o efeito estruturado está numa feature
    // DESTE nível — um `asi-or-feat` de nível 4 continua ativo no nível 8, e
    // contá-lo de novo faria todo nível posterior parecer um nível de ASI.
    const doNivel = featuresDoCatalogo.filter(
      (feature) => Number.isInteger(feature?.level) && feature.level === level,
    );
    let grantsAbilityScoreImprovement = false;
    let grantsEpicBoon = false;
    for (const feature of doNivel) {
      const { isAsi, isEpicBoon } = asiInfoOf(feature);
      if (isAsi) {
        grantsAbilityScoreImprovement = true;
        grantsEpicBoon = grantsEpicBoon || isEpicBoon;
      }
    }

    linhas.push(
      Object.freeze({
        level,
        proficiencyBonus: pb.value,
        features: Object.freeze(featuresGainedAt(featuresDoCatalogo, level)),
        resources: Object.freeze(resources),
        spellSlots: Object.freeze(spellSlots),
        diceProgression: Object.freeze(diceProgression),
        grantsAbilityScoreImprovement,
        grantsEpicBoon,
      }),
    );
  }
  return ok(Object.freeze(linhas));
}

/**
 * Devolve a linha da matriz correspondente a um nível.
 * @param {object} character
 * @param {number} level
 * @param {object} context
 * @returns {import('../../core/result.js').Result} Result<object, AppError>
 */
export function getProgressionRow(character, level, context = {}) {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    return err(
      progressionError('PROGRESSION_LEVEL_OUT_OF_RANGE', `Nível fora de ${MIN_LEVEL}..${MAX_LEVEL}.`, { level }),
    );
  }
  const matriz = getProgressionMatrix(character, context);
  if (!matriz.ok) {
    return matriz;
  }
  return ok(matriz.value[level - MIN_LEVEL]);
}

/**
 * Valida `state.hitPointRolls` e devolve as entradas ordenadas por nível.
 *
 * Regras (todas explícitas, nenhuma preenchida por default):
 *  - o campo é obrigatório para DERIVAR o máximo (ausente => erro, porque um
 *    registro migrado de v1 não tem histórico e presumir a média seria
 *    inventar dado de jogo);
 *  - precisa cobrir exatamente os níveis 1..`level`, sem buraco e sem
 *    duplicata;
 *  - `rolled: null` é histórico incompleto: também é erro para o cálculo, e
 *    não vira média silenciosamente.
 * @param {object} character
 * @param {number} level
 * @returns {import('../../core/result.js').Result} Result<Array<object>, AppError>
 */
export function requireHitPointRolls(character, level) {
  const rolls = character?.state?.hitPointRolls;
  if (!Array.isArray(rolls)) {
    return err(
      progressionError(
        'PROGRESSION_HIT_POINT_ROLLS_MISSING',
        'PV máximo é derivado de "state.hitPointRolls", que não existe neste personagem. ' +
          'Um registro migrado de v1 não tem histórico de rolagens: use o ajuste manual ' +
          'em overrides["hp.maximum"] ou registre o histórico — a média NÃO é presumida.',
        { level },
      ),
    );
  }

  const porNivel = new Map();
  for (const entrada of rolls) {
    if (!Number.isInteger(entrada?.level)) {
      return err(
        progressionError('PROGRESSION_HIT_POINT_ROLL_INVALID', 'Cada entrada de hitPointRolls precisa de "level" inteiro.', {}),
      );
    }
    if (porNivel.has(entrada.level)) {
      return err(
        progressionError('PROGRESSION_HIT_POINT_ROLL_DUPLICATE', 'hitPointRolls tem mais de uma entrada para o mesmo nível.', {
          level: entrada.level,
        }),
      );
    }
    porNivel.set(entrada.level, entrada);
  }

  const ordenadas = [];
  for (let nivel = MIN_LEVEL; nivel <= level; nivel += 1) {
    const entrada = porNivel.get(nivel);
    if (entrada === undefined) {
      return err(
        progressionError('PROGRESSION_HIT_POINT_ROLL_GAP', `hitPointRolls não cobre o nível ${nivel}.`, { level: nivel }),
      );
    }
    if (!Number.isInteger(entrada.rolled)) {
      return err(
        progressionError(
          'PROGRESSION_HIT_POINT_ROLL_UNKNOWN',
          `hitPointRolls tem "rolled: null" no nível ${nivel}: o valor rolado é desconhecido e não é substituído pela média.`,
          { level: nivel },
        ),
      );
    }
    ordenadas.push(entrada);
  }
  return ok(ordenadas);
}

/**
 * Recomputa o PV MÁXIMO do personagem.
 *
 * `soma(hitPointRolls[1..nível].rolled) + modCon * nível`, com os efeitos de
 * conteúdo sobre o alvo `hp.maximum` aplicados por cima pelo motor da Task 15.
 *
 * Sempre recomputado: subir Constituição por ASI muda o resultado
 * retroativamente, e NENHUM `override` é criado por isso —
 * `overrides["hp.maximum"]` continua reservado ao ajuste manual explícito do
 * usuário, que quando existe tem precedência (mesmo contrato de
 * `domain/character/queries/hit-points.js`).
 *
 * ## Como alimentar `getHitPointProjection` (Task 16) sem contar duas vezes
 *
 * `domain/character/queries/hit-points.js` recebe o máximo JÁ CALCULADO em
 * `context.maximumHitPoints` e aplica por cima os efeitos de conteúdo sobre
 * `hp.maximum`. Portanto o valor a repassar é `base` (rolagens + Constituição,
 * SEM efeitos), nunca `maximum` — repassar `maximum` aplicaria os efeitos de
 * conteúdo duas vezes. Os dois campos existem por isso, e o teste focal
 * "não conta os efeitos de hp.maximum duas vezes" trava o contrato.
 *
 * @param {object} character - CanonicalCharacter.
 * @param {{registry: object}} context - `registry` é OBRIGATÓRIO (os efeitos de
 *   conteúdo sobre `hp.maximum` vêm do catálogo).
 * @returns {import('../../core/result.js').Result} Result<{maximum: number, base: number, fromRolls: number, fromConstitution: number, hasManualOverride: boolean}, AppError>
 */
export function getMaximumHitPoints(character, context = {}) {
  if (!hasCharacterShape(character)) {
    return err(
      progressionError('PROGRESSION_CHARACTER_INVALID', 'A consulta de PV máximo exige um CanonicalCharacter.', {}),
    );
  }
  // Mesma guarda explícita de `getProgressionMatrix`/`getLevelUpOptions`/
  // `validateFeatChoice`. Sem ela, `collectCharacterEffects` LANÇAVA um
  // `TypeError` cru — uma consulta que devolve `Result` não pode escapar pela
  // exceção só porque o chamador esqueceu o catálogo.
  if (context?.registry === null || typeof context?.registry !== 'object') {
    return err(
      progressionError(
        'PROGRESSION_REGISTRY_REQUIRED',
        'O PV máximo depende dos efeitos de conteúdo sobre "hp.maximum": "context.registry" é obrigatório.',
        {},
      ),
    );
  }
  const level = character.state.level;
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    return err(progressionError('PROGRESSION_LEVEL_INVALID', '"state.level" deve ser um inteiro de 1 a 20.', { level }));
  }

  const rolls = requireHitPointRolls(character, level);
  if (!rolls.ok) {
    return rolls;
  }
  const fromRolls = rolls.value.reduce((soma, entrada) => soma + entrada.rolled, 0);

  const comVariaveis = withEffectContextVariables(character, context);
  if (!comVariaveis.ok) {
    return comVariaveis;
  }
  const contexto = comVariaveis.value;

  const modCon = getAbilityModifier(character, 'constituicao', contexto);
  if (!modCon.ok) {
    return modCon;
  }
  const fromConstitution = modCon.value * level;
  const base = fromRolls + fromConstitution;

  const efeitos = collectCharacterEffects(character, contexto);
  if (!efeitos.ok) {
    return efeitos;
  }
  const resolvido = resolveNumericTarget({
    target: 'hp.maximum',
    baseValue: base,
    effects: efeitos.value,
    context: contexto,
  });
  if (!resolvido.ok) {
    return resolvido;
  }

  // `maximum` JÁ inclui o ajuste manual quando existe: `collectCharacterEffects`
  // sintetiza `character.overrides` como efeitos do grupo `manual`, que é o de
  // MAIOR precedência (Task 15) — mesma semântica de `getHitPointProjection`.
  // Isso é o certo: um override é uma decisão explícita do usuário.
  //
  // O que esta task proíbe é o MOTOR escrever esse override sozinho para
  // congelar um valor que ele deveria recomputar (ver `applyLevelUp`). Por isso
  // `base` existe e é reportado separadamente: é a derivação pura
  // (rolagens + Constituição), imune ao ajuste manual, e `hasManualOverride`
  // deixa explícito para o chamador que `maximum` e `base` podem divergir por
  // decisão do usuário — nunca por acidente do motor.
  const override = character.overrides?.['hp.maximum'];
  const hasManualOverride = override !== null && typeof override === 'object' && typeof override.value === 'number';

  return ok(Object.freeze({ maximum: resolvido.value, base, fromRolls, fromConstitution, hasManualOverride }));
}
