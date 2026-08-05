// Passo `especie` do criador.
//
// O que este passo NÃO usa: `ESPECIES_TRACOS_ESCOLHA`. A linhagem do Draconato
// (Herança Dracônica) não é um caso especial codificado por nome de espécie —
// é um efeito `choice` como qualquer outro, e as concessões de cada opção
// (`grants`, com `when` próprio) são expandidas pelo motor de efeitos. É por
// isso que o Voo Dracônico (`when: {kind:'level', min:5}`) não cai num
// personagem de nível 1 só porque a linhagem foi escolhida.

import { createCatalogSelectionStep } from './catalog-selection-step.js';

/**
 * Texto do card: a contagem de traços, exatamente como no baseline
 * ("5 tracos", sem acento — é o texto do wizard legado).
 *
 * A contagem vem de `legacyPresentation.tracos`, o registro de apresentação do
 * catálogo. Deliberadamente NÃO é `effects.length`: efeito e traço não são a
 * mesma coisa (um traço pode render dois efeitos, e efeitos gated por nível não
 * são traços a menos no nível 1), então usar `effects` mudaria os números
 * exibidos hoje.
 * @param {{entity: object}} params
 * @returns {{details: ReadonlyArray<string>, summary: string}}
 */
function describeSpecies({ entity }) {
  const tracos = Array.isArray(entity?.legacyPresentation?.tracos) ? entity.legacyPresentation.tracos.length : 0;
  const texto = `${tracos} tracos`;
  return { details: Object.freeze([texto]), summary: texto };
}

/**
 * Cria o passo `especie`.
 * @returns {import('../../../core/result.js').Result} `ok(step)`
 */
export function createSpeciesStep() {
  return createCatalogSelectionStep({
    id: 'especie',
    contentType: 'species',
    collection: 'species',
    heading: 'Escolha sua Especie',
    gridId: 'grid-especies',
    cardAttribute: 'data-especie',
    refField: 'speciesRef',
    identitySlice: 'speciesSelection',
    choiceSlices: Object.freeze(['speciesChoices']),
    defaultChoiceSlice: 'speciesChoices',
    describe: describeSpecies,
  });
}
