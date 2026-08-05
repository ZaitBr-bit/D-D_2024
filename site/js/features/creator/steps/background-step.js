// Passo `antecedente` do criador.
//
// O que este passo NÃO usa: `a.talento.split('(')[0].trim()`. O talento de
// origem é descoberto pelo efeito `official-handler` com
// `handlerId === 'grant-feat'`, cujo `params.featId` é resolvido no catálogo —
// o NOME do talento vem da entidade `feat`, não de um recorte de string. Os 16
// antecedentes do pacote oficial produzem exatamente os mesmos textos que o
// wizard legado exibe hoje, mas por identidade de conteúdo em vez de por
// posição de parêntese.

import { createCatalogSelectionStep } from './catalog-selection-step.js';

/** `handlerId` oficial que concede o talento de origem de um antecedente. */
const GRANT_FEAT_HANDLER_ID = 'grant-feat';

/** `choiceId` do bônus de atributo de origem. */
const ABILITY_BONUS_CHOICE_ID = 'bonus-de-atributo';

/** `choiceId` do equipamento inicial do antecedente. */
const EQUIPMENT_CHOICE_ID = 'equipamento-inicial';

/**
 * ContentId do talento de origem declarado pelo antecedente, ou `null`.
 * @param {object} entity
 * @returns {string|null}
 */
export function originFeatId(entity) {
  const effects = Array.isArray(entity?.effects) ? entity.effects : [];
  for (const effect of effects) {
    if (effect?.type === 'official-handler' && effect.handlerId === GRANT_FEAT_HANDLER_ID) {
      const featId = effect.params?.featId;
      if (typeof featId === 'string' && featId.length > 0) {
        return featId;
      }
    }
  }
  return null;
}

/**
 * Nome do talento de origem, resolvido no catálogo. Sem talento declarado (ou
 * sem entidade correspondente) o texto fica vazio — nunca um talento presumido.
 * @param {object} entity
 * @param {object} registry
 * @returns {string}
 */
function originFeatName(entity, registry) {
  const featId = originFeatId(entity);
  if (featId === null) {
    return '';
  }
  const resolved = registry.resolve(featId, 'feat');
  return resolved.ok === true && typeof resolved.value.name === 'string' ? resolved.value.name : '';
}

/**
 * Texto do card do antecedente: o nome do talento de origem.
 * @param {{entity: object, registry: object}} params
 * @returns {{details: ReadonlyArray<string>, summary: string}}
 */
function describeBackground({ entity, registry }) {
  const talento = originFeatName(entity, registry);
  return { details: Object.freeze([talento]), summary: talento };
}

/**
 * Fatias DERIVADAS do antecedente escolhido: as perícias fixas que ele concede,
 * a proficiência de ferramenta e o talento de origem.
 *
 * As perícias saem dos efeitos `type: 'proficiency'` (campo `target`), não de
 * uma string de apresentação. A ferramenta sai de
 * `legacyPresentation.ferramentas`, que é o campo de apresentação do catálogo —
 * o efeito correspondente é `type: 'manual'` (prosa), e prosa não é identidade.
 * `backgroundSkills` é ao mesmo tempo fatia de ESCOLHA (idiomas e demais
 * escolhas do antecedente) e fatia DERIVADA (as perícias fixas). Por isso ela é
 * fundida com o que já está no rascunho: derivar não pode apagar o que o
 * jogador acabou de confirmar no modal.
 * `slices` é o conjunto já REESCRITO pelo `reduce` (só as escolhas desta
 * seleção), e não o rascunho anterior: derivar a partir do rascunho traria de
 * volta as escolhas do antecedente substituído.
 * @param {{entity: object, slices: object}} params
 * @returns {object}
 */
function backgroundDerivedSlices({ entity, slices }) {
  const effects = Array.isArray(entity?.effects) ? entity.effects : [];
  const skills = effects
    .filter((effect) => effect?.type === 'proficiency' && typeof effect.target === 'string')
    .map((effect) => effect.target);
  const ferramenta = entity?.legacyPresentation?.ferramentas;
  const atual = slices?.backgroundSkills;
  const base = atual !== null && typeof atual === 'object' && !Array.isArray(atual) ? atual : {};
  return {
    backgroundToolProficiency: typeof ferramenta === 'string' && ferramenta.length > 0 ? ferramenta : null,
    backgroundFeat: originFeatId(entity),
    backgroundSkills: Object.freeze({ ...base, granted: Object.freeze([...skills]) }),
  };
}

/**
 * Cria o passo `antecedente`.
 * @returns {import('../../../core/result.js').Result} `ok(step)`
 */
export function createBackgroundStep() {
  return createCatalogSelectionStep({
    id: 'antecedente',
    contentType: 'background',
    collection: 'background',
    heading: 'Escolha seu Antecedente',
    gridId: 'grid-antecedentes',
    cardAttribute: 'data-antecedente',
    introBox: 'O antecedente define suas pericias, ferramentas, talento de origem e distribuicao de atributos.',
    tailMarkup: '<div id="antecedente-distribuicao" class="mt-2"></div>',
    refField: 'backgroundRef',
    identitySlice: 'backgroundSelection',
    // As escolhas do antecedente moram nas fatias que a matriz de invalidação
    // já nomeia: bônus de atributo e equipamento têm fatia própria; idiomas e
    // demais escolhas ficam na fatia de perícias/treinamentos do antecedente.
    choiceSlices: Object.freeze(['backgroundAbilityBonus', 'backgroundEquipmentSelection', 'backgroundSkills']),
    defaultChoiceSlice: 'backgroundSkills',
    choiceSliceById: Object.freeze({
      [ABILITY_BONUS_CHOICE_ID]: 'backgroundAbilityBonus',
      [EQUIPMENT_CHOICE_ID]: 'backgroundEquipmentSelection',
    }),
    describe: describeBackground,
    derivedSlices: backgroundDerivedSlices,
  });
}
