// Passo `classe` do criador.
//
// O que este passo NÃO usa (e por quê): `NIVEL_SUBCLASSE`, `CLASSES_ESCOLHAS`
// e o parsing por nome de exibição do criador legado. O nível em que a
// subclasse fica disponível é o `when: {kind:'level', min:N}` do próprio efeito
// `choice` da classe, e as "escolhas obrigatórias" (Ordem Divina, Estilo de
// Luta, perícias de classe) são os efeitos `choice` que a entidade declara —
// com `min`/`max` vindos do catálogo. Uma classe nova entra no jogo publicando
// conteúdo, sem tocar em código.

import { createCatalogSelectionStep } from './catalog-selection-step.js';

/** `choiceId` do catálogo que representa as perícias de classe. */
const CLASS_SKILLS_CHOICE_ID = 'pericias-de-classe';

/**
 * Atributo primário como TEXTO de apresentação.
 *
 * Vem de `legacyPresentation.tracos_basicos["Atributo Primário"]`, que é um
 * registro chaveado do catálogo — não uma frase interpretada. É o único campo
 * que distingue "Força E Destreza" (Monge) de "Força OU Destreza" (Guerreiro);
 * o array `primaryAbility` guarda os dois ids e perde o conectivo. Quando o
 * campo não existe, os ids são resolvidos no catálogo e unidos por " e " — e,
 * se nem isso for possível, o texto fica vazio em vez de inventado.
 * @param {object} entity
 * @param {object} registry
 * @returns {string}
 */
function primaryAbilityText(entity, registry) {
  const declared = entity?.legacyPresentation?.tracos_basicos?.['Atributo Primário'];
  if (typeof declared === 'string' && declared.length > 0) {
    return declared;
  }
  const ids = Array.isArray(entity?.primaryAbility) ? entity.primaryAbility : [];
  const names = ids
    .map((abilityId) => {
      const resolved = registry.resolve(abilityId);
      return resolved.ok === true ? resolved.value.name : null;
    })
    .filter((name) => typeof name === 'string' && name.length > 0);
  return names.join(' e ');
}

/**
 * "Conjurador" ou "Marcial", decidido pela PRESENÇA do bloco `spellcasting` da
 * entidade — nunca por lista de nomes.
 * @param {object} entity
 * @returns {string}
 */
function castingText(entity) {
  return entity?.spellcasting !== null && entity?.spellcasting !== undefined ? 'Conjurador' : 'Marcial';
}

/**
 * Textos do card e do resumo, na ordem do baseline:
 * `d12 · Força` e depois `Marcial`.
 * @param {{entity: object, registry: object}} params
 * @returns {{details: ReadonlyArray<string>, summary: string}}
 */
function describeClass({ entity, registry }) {
  const hitDie = typeof entity?.hitDie === 'string' ? entity.hitDie : '';
  const primary = primaryAbilityText(entity, registry);
  const casting = castingText(entity);
  return {
    details: Object.freeze([`${hitDie} · ${primary}`, casting]),
    summary: `${hitDie} | ${primary} | ${casting}`,
  };
}

/**
 * Fatias DERIVADAS da entidade escolhida (não escolhas do jogador): os
 * recursos que a classe concede e a linha de progressão.
 *
 * `classResources` sai dos efeitos `type: 'resource'` declarados pela classe —
 * é a lista dos recursos que passam a existir por causa dela. `progression`
 * guarda o dado de vida e a classe da linha corrente, que é o que os passos
 * seguintes (`atributos`, com PV) consultam.
 * @param {{entity: object}} params
 * @returns {object}
 */
function classDerivedSlices({ entity }) {
  const effects = Array.isArray(entity?.effects) ? entity.effects : [];
  const resources = effects.filter((effect) => effect?.type === 'resource' && typeof effect.resource === 'string').map((effect) => effect.resource);
  return {
    classResources: resources.length > 0 ? Object.freeze([...new Set(resources)]) : null,
    progression: Object.freeze({ classId: entity.id, hitDie: typeof entity.hitDie === 'string' ? entity.hitDie : null }),
  };
}

/**
 * Cria o passo `classe`.
 * @returns {import('../../../core/result.js').Result} `ok(step)`
 */
export function createClassStep() {
  return createCatalogSelectionStep({
    id: 'classe',
    contentType: 'class',
    collection: 'class',
    heading: 'Escolha sua Classe',
    gridId: 'grid-classes',
    cardAttribute: 'data-classe',
    refField: 'classRef',
    identitySlice: 'classSelection',
    choiceSlices: Object.freeze(['classChoices', 'classSkills']),
    defaultChoiceSlice: 'classChoices',
    choiceSliceById: Object.freeze({ [CLASS_SKILLS_CHOICE_ID]: 'classSkills' }),
    describe: describeClass,
    derivedSlices: classDerivedSlices,
  });
}
