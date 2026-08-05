// Módulo `features/creator/creator-ruleset-ref`: a referência de RULESET com
// que um personagem NOVO nasce.
//
// ## Por que uma constante, e por que ela não é um default inventado
//
// `createEmptyCharacter({id, now, rulesetRef})` (domain/character/model.js)
// exige `{id, packageVersion}`: é a única referência de conteúdo obrigatória
// do personagem canônico, porque dela saem `build.rulesetRef` e
// `build.contentScopes` — e é `contentScopes` que os passos leem para
// qualificar TODA referência que gravam (ver `catalog-selection-step.js#packageVersionFor`).
//
// O `ContentRegistry` publica entidades, não a versão ativa do pacote: seus
// sete métodos aprovados (`content/registry.js`) não expõem
// `activeVersionByNamespace`. Então a versão precisa ser DECLARADA por quem
// monta o personagem. O mesmo fato já é declarado assim em produção desde a
// Task 13 (`infra/character/migrations/v1-to-v2.js`), para os personagens que
// sobem do formato legado.
//
// O que impede isso de virar um default silencioso é o USO: o composition root
// público (`pages/creator.js`) RESOLVE esta referência no catálogo antes de
// montar qualquer coisa. Se a versão publicada em
// `dados/pacotes/dnd2024/manifest.json` mudar e esta constante ficar para
// trás, `registry.resolve` devolve `CONTENT_VERSION_MIGRATION_REQUIRED` e o
// criador RECUSA abrir, em vez de gravar personagens presos a uma versão que
// não existe mais.

/**
 * Ruleset com que todo personagem criado pelo criador nasce.
 * @type {Readonly<{id: string, packageVersion: string}>}
 */
export const CREATOR_RULESET_REF = Object.freeze({
  id: 'dnd2024:ruleset:core',
  packageVersion: '1.0.0',
});
