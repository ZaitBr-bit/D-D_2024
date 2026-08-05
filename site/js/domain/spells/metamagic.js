// Módulo `domain/spells/metamagic`: regras PURAS de Metamagia (Feiticeiro).
//
// Hoje isto vive em `site/js/pages/sheet.js` como a constante hardcoded
// `OPCOES_METAMAGIA` (linha 12311) mais o modal
// `mostrarModalMetamagiaConjuracao` (linha 12467), onde cada opção carrega uma
// função `validar(info)` que faz REGEX sobre a prosa do índice de magias
// (`/^Ação$/` em `tempo_conjuracao`, `/concentra/i` em `duracao`,
// `/[VS]/` em `componentes`, `/pessoal/i` em `alcance`).
//
// ## Por que as opções entram por `context.metamagic`
//
// O pacote oficial `dados/pacotes/dnd2024` NÃO tem entidade de opção de
// Metamagia: as dez opções aparecem apenas como PROSA dentro da descrição de
// `dnd2024:feature:feiticeiro-metamagia-2` (Task 8 modelou as features, não as
// opções). Não há, portanto, "campo mecânico do catálogo" de onde tirar custo
// em Pontos de Feitiçaria nem compatibilidade. Em vez de reimplementar as
// regexes de prosa dentro do domínio (o que esta refatoração existe para
// eliminar), este módulo recebe os DESCRITORES já estruturados por
// `context.metamagic` — o mesmo canal-de-números-já-resolvidos usado por
// `context.talentPassives` na Task 16. Ver CONCERN no relatório da Task 18:
// a modelagem definitiva pede entidades `metamagic-option` no catálogo.
//
// O vocabulário de pré-requisito é FECHADO e avaliado somente contra campos
// mecânicos da entidade `spell` (dados/schemas/v1/spell.schema.json):
// `level`, `ritual`, `concentration`, `components.{verbal,somatic,material}`,
// `castingTime`, `range`. Um `kind` desconhecido é ERRO, nunca "requisito
// satisfeito" — um bypass silencioso aqui deixaria qualquer opção aplicável a
// qualquer magia.

import { ok, err } from '../../core/result.js';
import { spellError } from './spellcasting-queries.js';

// `kind`s fechadas de pré-requisito de opção de metamagia.
export const METAMAGIC_REQUIREMENT_KINDS = Object.freeze([
  'concentration',
  'ritual',
  'component',
  'casting-time',
  'range-not-in',
  'min-level',
]);
const REQUIREMENT_KIND_SET = new Set(METAMAGIC_REQUIREMENT_KINDS);
const COMPONENT_KEYS = Object.freeze(['verbal', 'somatic', 'material']);

/**
 * Avalia UM pré-requisito contra a entidade de magia.
 * @param {object} requirement
 * @param {object} spellEntity
 * @returns {import('../../core/result.js').Result} Result<boolean, AppError>
 */
function evaluateRequirement(requirement, spellEntity) {
  const kind = requirement?.kind;
  if (typeof kind !== 'string' || !REQUIREMENT_KIND_SET.has(kind)) {
    return err(
      spellError('METAMAGIC_REQUIREMENT_UNKNOWN', `Pré-requisito de metamagia com "kind" desconhecido: ${String(kind)}.`, {
        kind: typeof kind === 'string' ? kind : null,
        allowed: [...METAMAGIC_REQUIREMENT_KINDS],
      }),
    );
  }
  if (kind === 'concentration') {
    return ok(spellEntity.concentration === true);
  }
  if (kind === 'ritual') {
    return ok(spellEntity.ritual === true);
  }
  if (kind === 'component') {
    const component = requirement.component;
    if (!COMPONENT_KEYS.includes(component)) {
      return err(
        spellError('METAMAGIC_REQUIREMENT_UNKNOWN', `Componente desconhecido em pré-requisito: ${String(component)}.`, {
          component: typeof component === 'string' ? component : null,
        }),
      );
    }
    return ok(spellEntity?.components?.[component] === true);
  }
  if (kind === 'casting-time') {
    return ok(typeof requirement.equals === 'string' && spellEntity.castingTime === requirement.equals);
  }
  if (kind === 'range-not-in') {
    const values = Array.isArray(requirement.values) ? requirement.values : [];
    return ok(typeof spellEntity.range === 'string' && !values.includes(spellEntity.range));
  }
  // 'min-level'
  const level = requirement.level;
  if (!Number.isInteger(level)) {
    return err(
      spellError('METAMAGIC_REQUIREMENT_UNKNOWN', '"min-level" exige "level" inteiro.', { level: null }),
    );
  }
  return ok(Number.isInteger(spellEntity.level) && spellEntity.level >= level);
}

/**
 * Normaliza o canal `context.metamagic`. Ausente devolve `null` — quem chama
 * decide se isso é erro (só é, quando o request de fato pede metamagia).
 * @param {object} [context]
 * @returns {Readonly<object> | null}
 */
export function readMetamagicContext(context = {}) {
  const raw = context?.metamagic;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const options = raw.options !== null && typeof raw.options === 'object' && !Array.isArray(raw.options) ? raw.options : {};
  return Object.freeze({
    knownIds: Object.freeze(Array.isArray(raw.knownIds) ? [...raw.knownIds] : []),
    options,
    // Regra base do baseline: uma opção por conjuração (duas com Feitiçaria
    // Encarnada). O número vem do chamador; ausente, o mínimo da regra base.
    maxPerCast: Number.isInteger(raw.maxPerCast) && raw.maxPerCast >= 1 ? raw.maxPerCast : 1,
    // Apoteose Arcana (nível 20): N aplicações sem custo. Ausente = 0, que é
    // a regra base — não é um default de jogo inventado, é a ausência da
    // característica.
    freeUses: Number.isInteger(raw.freeUses) && raw.freeUses >= 0 ? raw.freeUses : 0,
    pointsResourceId: typeof raw.pointsResourceId === 'string' && raw.pointsResourceId.length > 0 ? raw.pointsResourceId : null,
  });
}

/**
 * Valida o uso de um conjunto de opções de metamagia numa conjuração e
 * calcula o custo total em Pontos de Feitiçaria.
 *
 * @param {object} character - CanonicalCharacter.
 * @param {{spellEntity: object, metamagicIds: ReadonlyArray<string>}} params
 * @param {object} [context] - precisa de `context.metamagic` quando `metamagicIds` não é vazio.
 * @returns {import('../../core/result.js').Result} Result<{totalCost, freeApplied, pointsResourceId, availablePoints, optionIds}, AppError>
 */
export function validateMetamagicUse(character, { spellEntity, metamagicIds } = {}, context = {}) {
  const ids = Array.isArray(metamagicIds) ? metamagicIds : [];
  if (ids.some((id) => typeof id !== 'string' || id.length === 0)) {
    return err(spellError('METAMAGIC_IDS_INVALID', '"metamagicIds" deve ser um array de ContentId não vazios.', {}));
  }
  if (ids.length === 0) {
    return ok(
      Object.freeze({ totalCost: 0, freeApplied: 0, pointsResourceId: null, availablePoints: null, optionIds: Object.freeze([]) }),
    );
  }
  if (spellEntity === null || typeof spellEntity !== 'object') {
    return err(
      spellError('METAMAGIC_SPELL_REQUIRED', 'A validação de metamagia exige a entidade de magia resolvida do catálogo.', {}),
    );
  }

  const meta = readMetamagicContext(context);
  if (meta === null) {
    return err(
      spellError(
        'METAMAGIC_CONTEXT_REQUIRED',
        'O uso de metamagia exige "context.metamagic" (opções conhecidas, custos e recurso de Pontos de Feitiçaria).',
        { metamagicIds: [...ids] },
      ),
    );
  }

  const seen = new Set();
  const options = [];
  for (const id of ids) {
    if (seen.has(id)) {
      return err(spellError('METAMAGIC_DUPLICATE', `A opção de metamagia "${id}" foi selecionada duas vezes.`, { id }));
    }
    seen.add(id);

    if (!meta.knownIds.includes(id)) {
      return err(
        spellError('METAMAGIC_NOT_KNOWN', `O personagem não conhece a opção de metamagia "${id}".`, { id }),
      );
    }
    const option = Object.hasOwn(meta.options, id) ? meta.options[id] : undefined;
    if (option === null || typeof option !== 'object' || !Number.isInteger(option.cost) || option.cost < 0) {
      return err(
        spellError(
          'METAMAGIC_OPTION_UNKNOWN',
          `A opção de metamagia "${id}" não tem descritor mecânico (custo inteiro) em "context.metamagic.options".`,
          { id },
        ),
      );
    }

    for (const requirement of Array.isArray(option.requires) ? option.requires : []) {
      const evaluated = evaluateRequirement(requirement, spellEntity);
      if (!evaluated.ok) {
        return evaluated;
      }
      if (evaluated.value !== true) {
        return err(
          spellError(
            'METAMAGIC_INCOMPATIBLE',
            `A opção de metamagia "${id}" não é aplicável a esta magia.`,
            { id, spellId: typeof spellEntity.id === 'string' ? spellEntity.id : null, requirement: requirement?.kind ?? null },
          ),
        );
      }
    }
    options.push({ id, cost: option.cost, combines: option.combines === true });
  }

  // Limite por conjuração. Acima do limite base, o baseline só permite a
  // combinação quando TODAS as opções envolvidas são combináveis (Buscadora/
  // Potencializada) e o total não passa de duas
  // (site/js/pages/sheet.js#podeAdicionarOpcao).
  if (options.length > meta.maxPerCast) {
    const allCombine = options.every((option) => option.combines);
    if (!allCombine || options.length > 2) {
      return err(
        spellError(
          'METAMAGIC_TOO_MANY',
          `São permitidas no máximo ${meta.maxPerCast} opção(ões) de metamagia por conjuração.`,
          { selected: options.length, maxPerCast: meta.maxPerCast },
        ),
      );
    }
  }

  // Aplicações gratuitas (Apoteose Arcana) consomem as PRIMEIRAS opções na
  // ordem informada pelo chamador — mesma ordem de inserção do baseline,
  // e determinística por construção.
  let freeRemaining = meta.freeUses;
  let totalCost = 0;
  let freeApplied = 0;
  for (const option of options) {
    if (freeRemaining > 0) {
      freeRemaining -= 1;
      freeApplied += 1;
      continue;
    }
    totalCost += option.cost;
  }

  let availablePoints = null;
  if (totalCost > 0) {
    if (meta.pointsResourceId === null) {
      return err(
        spellError(
          'METAMAGIC_POINTS_RESOURCE_REQUIRED',
          'O custo em Pontos de Feitiçaria exige "context.metamagic.pointsResourceId".',
          { totalCost },
        ),
      );
    }
    const resources = character?.state?.resources ?? {};
    const entry = Object.hasOwn(resources, meta.pointsResourceId) ? resources[meta.pointsResourceId] : undefined;
    if (entry === undefined || !Number.isInteger(entry.current)) {
      return err(
        spellError(
          'METAMAGIC_POINTS_RESOURCE_MISSING',
          `O recurso de Pontos de Feitiçaria "${meta.pointsResourceId}" não existe (ou tem "current" não inteiro) neste personagem.`,
          { pointsResourceId: meta.pointsResourceId },
        ),
      );
    }
    availablePoints = entry.current;
    if (entry.current < totalCost) {
      return err(
        spellError(
          'METAMAGIC_POINTS_INSUFFICIENT',
          `Pontos de Feitiçaria insuficientes: ${entry.current} disponível(is), ${totalCost} necessário(s).`,
          { pointsResourceId: meta.pointsResourceId, available: entry.current, totalCost },
        ),
      );
    }
  }

  return ok(
    Object.freeze({
      totalCost,
      freeApplied,
      pointsResourceId: meta.pointsResourceId,
      availablePoints,
      optionIds: Object.freeze(options.map((option) => option.id)),
    }),
  );
}

/**
 * Debita `totalCost` do recurso de Pontos de Feitiçaria. Pura; devolve o
 * novo `state.resources` (ou `null` quando não há custo). Pré-condições já
 * verificadas por `validateMetamagicUse` — esta função não revalida saldo,
 * mas também nunca cria o recurso do nada.
 * @param {object} character
 * @param {{pointsResourceId: string|null, totalCost: number}} params
 * @returns {object | null} novo mapa `state.resources`, ou `null` se nada muda.
 */
export function debitMetamagicPoints(character, { pointsResourceId, totalCost }) {
  if (totalCost <= 0 || pointsResourceId === null) {
    return null;
  }
  const resources = character?.state?.resources ?? {};
  const entry = Object.hasOwn(resources, pointsResourceId) ? resources[pointsResourceId] : undefined;
  if (entry === undefined || !Number.isInteger(entry.current)) {
    return null;
  }
  return Object.freeze({
    ...resources,
    [pointsResourceId]: Object.freeze({ ...entry, current: entry.current - totalCost }),
  });
}
