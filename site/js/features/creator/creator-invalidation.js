// Módulo `features/creator/creator-invalidation`: a MATRIZ DE INVALIDAÇÃO do
// criador.
//
// ## O problema que esta matriz resolve
//
// No criador legado, "voltar um passo" chama `limparDadosDoPasso` para cada
// passo posterior, e essa função apaga campos soltos do personagem por
// posição no wizard. Isso produz dois defeitos estruturais:
//
//  1. Limpa por PROXIMIDADE, não por DEPENDÊNCIA. Trocar de classe apaga o
//     `inventario` inteiro — inclusive os itens que o jogador comprou/
//     acrescentou à mão, que não vieram de classe nenhuma. O mesmo vale para
//     `personagem.moedas`, zerado por `criarCarteiraVazia()`.
//  2. O que é preservado é um SILÊNCIO. Nada no código afirma "isto
//     sobrevive"; o dado apenas não foi citado no `switch`. Um `case` novo
//     escrito por alguém sem esse contexto apaga o dado do jogador sem que
//     nenhum teste perceba.
//
// Aqui a invalidação é uma TABELA declarativa e TOTAL: para cada passo, toda
// fatia conhecida do rascunho está explicitamente em `clearedSlices` ou em
// `preservedSlices`. Preservar é uma decisão positiva, verificada por
// invariante (`assertInvalidationMatrixIsTotal`).
//
// ## `clearedStepIds` NÃO implica limpar fatia
//
// São dois eixos deliberadamente separados:
//
//   - `clearedStepIds`: passos cujo STEP DATA carregado do catálogo deixa de
//     valer (ex.: trocar de classe invalida a lista de perícias de classe
//     que o passo `atributos` tinha carregado) e que precisam ser
//     revisitados/revalidados.
//   - `clearedSlices`: dados do RASCUNHO que deixam de valer.
//
// Confundir os dois é o que faz o legado apagar os valores de atributo do
// jogador só porque a classe mudou. Trocar de classe invalida a lista de
// perícias que o passo `atributos` oferece — não os 15/14/13 que o jogador
// distribuiu.
//
// ## `revokedProvenanceIds` é o inverso EXATO da aplicação
//
// Os IDs não são inventados aqui: são lidos de `draft.provenance[slice]`, que
// guarda exatamente os `sourceInstanceId`s usados por `applyGrantEffects`
// (Task 15) ao materializar as concessões daquela fatia. É por isso que
// `revokeGrantEffects` consegue devolver o personagem em deep equality com o
// estado anterior — a simetria é estrutural, não uma coincidência de nomes.

import { ok, err } from '../../core/result.js';
import { revokeGrantEffects } from '../../domain/effects/apply-grants.js';
import {
  CREATOR_STEP_IDS,
  CREATOR_DRAFT_SLICES,
  PLAYER_OWNED_SLICES,
  creatorStateError,
  isCreatorStepId,
  withDraftSlices,
} from './creator-state.js';

/**
 * Fatias "de identidade" de cada passo — o que o próprio passo escolhe.
 *
 * A fatia de identidade ENTRA em `clearedSlices` do próprio passo sempre que
 * ela carrega proveniência de concessão (classe, espécie, antecedente,
 * equipamento, magias): `invalidate` é chamado quando a escolha do passo está
 * sendo desfeita/substituída, e revogar as concessões da escolha ANTIGA é
 * exatamente o inverso de tê-las aplicado. Deixá-la de fora produziria a
 * assimetria clássica — itens/magias órfãos de uma classe que não existe mais.
 *
 * As exceções são `atributos` (a fatia `abilityScores` não concede nada; o que
 * ela invalida são os DERIVADOS) e `detalhes` (não invalida nada).
 * @type {Readonly<Record<string, string>>}
 */
export const STEP_IDENTITY_SLICE = Object.freeze({
  classe: 'classSelection',
  especie: 'speciesSelection',
  antecedente: 'backgroundSelection',
  atributos: 'abilityScores',
  equipamento: 'startingEquipmentSelection',
  magias: 'spellSelection',
  detalhes: 'details',
});

/**
 * A MATRIZ. Cada entrada é o efeito de MUDAR a escolha daquele passo.
 *
 * `preservedSlices` é calculado como o complemento exato de `clearedSlices`
 * sobre `CREATOR_DRAFT_SLICES` — nenhuma fatia fica de fora e nenhuma aparece
 * nos dois lados. As fatias do jogador (`manualInventoryChanges`,
 * `walletChanges`) nunca podem entrar em `clearedSlices`; isso é verificado
 * na carga do módulo por `assertInvalidationMatrixIsTotal`.
 * @type {Readonly<Record<string, {clearedStepIds: ReadonlyArray<string>, clearedSlices: ReadonlyArray<string>}>>}
 */
const RAW_MATRIX = Object.freeze({
  // Trocar de CLASSE invalida as escolhas, perícias, progressão e recursos de
  // classe, mais o equipamento e as moedas INICIAIS concedidos pela classe, e
  // as magias que vinham da lista de classe. NUNCA os itens e moedas que o
  // jogador acrescentou à mão — nem em troca de opção dentro da mesma classe,
  // nem em troca completa de classe.
  classe: {
    clearedStepIds: Object.freeze(['atributos', 'equipamento', 'magias']),
    clearedSlices: Object.freeze([
      'classSelection',
      'classChoices',
      'classSkills',
      'classResources',
      'progression',
      'startingEquipmentSelection',
      'startingCurrencyGrant',
      'spellSelection',
    ]),
  },

  // Trocar de ESPÉCIE invalida apenas as concessões da própria espécie.
  // Nenhum outro passo depende de espécie no 2024 (os bônus de atributo são
  // do antecedente), então nenhum step data é descartado.
  especie: {
    clearedStepIds: Object.freeze([]),
    clearedSlices: Object.freeze(['speciesSelection', 'speciesChoices']),
  },

  // Trocar de ANTECEDENTE invalida bônus de atributo, perícias, proficiência
  // de ferramenta, talento de origem e o equipamento de antecedente. O passo
  // `atributos` é revisitado porque o bônus de origem entra na distribuição.
  antecedente: {
    clearedStepIds: Object.freeze(['atributos']),
    clearedSlices: Object.freeze([
      'backgroundSelection',
      'backgroundAbilityBonus',
      'backgroundSkills',
      'backgroundToolProficiency',
      'backgroundFeat',
      'backgroundEquipmentSelection',
    ]),
  },

  // Mudar ATRIBUTOS invalida os DERIVADOS (CA, iniciativa, PV, CD de magia,
  // ...). Não invalida escolha nenhuma de outro passo: uma perícia continua
  // sendo a mesma perícia com outro modificador.
  atributos: {
    clearedStepIds: Object.freeze([]),
    clearedSlices: Object.freeze(['derivedStats']),
  },

  // EQUIPAMENTO invalida somente a própria proveniência: a seleção inicial e
  // a concessão de moedas iniciais. O que o jogador acrescentou à mão fica.
  equipamento: {
    clearedStepIds: Object.freeze([]),
    clearedSlices: Object.freeze(['startingEquipmentSelection', 'startingCurrencyGrant']),
  },

  // MAGIAS invalida somente a própria proveniência.
  magias: {
    clearedStepIds: Object.freeze([]),
    clearedSlices: Object.freeze(['spellSelection']),
  },

  // DETALHES não invalida nada: nome, aparência e história não alimentam
  // regra nenhuma.
  detalhes: {
    clearedStepIds: Object.freeze([]),
    clearedSlices: Object.freeze([]),
  },
});

/**
 * Monta o complemento (`preservedSlices`) de `clearedSlices`, preservando a
 * ordem canônica de `CREATOR_DRAFT_SLICES`.
 * @param {ReadonlyArray<string>} clearedSlices
 * @returns {ReadonlyArray<string>}
 */
function complementOf(clearedSlices) {
  const cleared = new Set(clearedSlices);
  return Object.freeze(CREATOR_DRAFT_SLICES.filter((slice) => !cleared.has(slice)));
}

/**
 * A matriz pública, com `preservedSlices` já resolvido.
 * @type {Readonly<Record<string, Readonly<{clearedStepIds: ReadonlyArray<string>, clearedSlices: ReadonlyArray<string>, preservedSlices: ReadonlyArray<string>}>>>}
 */
export const CREATOR_INVALIDATION_MATRIX = Object.freeze(
  Object.fromEntries(
    CREATOR_STEP_IDS.map((stepId) => {
      const entry = RAW_MATRIX[stepId];
      return [
        stepId,
        Object.freeze({
          clearedStepIds: entry.clearedStepIds,
          clearedSlices: entry.clearedSlices,
          preservedSlices: complementOf(entry.clearedSlices),
        }),
      ];
    }),
  ),
);

/**
 * Verifica, na carga do módulo, as invariantes que dão sentido à matriz:
 * cobertura total das fatias, ausência de interseção entre limpas e
 * preservadas, e a proibição absoluta de limpar fatias do jogador.
 * Uma violação aqui é defeito de programação e derruba o módulo — o inverso
 * (descobrir em produção que a carteira do jogador foi zerada) é pior.
 * @returns {void}
 */
export function assertInvalidationMatrixIsTotal() {
  for (const stepId of CREATOR_STEP_IDS) {
    const entry = CREATOR_INVALIDATION_MATRIX[stepId];
    if (!entry) {
      throw new TypeError(`Matriz de invalidação: passo "${stepId}" não tem entrada.`);
    }
    const cleared = new Set(entry.clearedSlices);
    const preserved = new Set(entry.preservedSlices);
    if (cleared.size + preserved.size !== CREATOR_DRAFT_SLICES.length) {
      throw new TypeError(`Matriz de invalidação: o passo "${stepId}" não classifica todas as fatias.`);
    }
    for (const slice of CREATOR_DRAFT_SLICES) {
      if (cleared.has(slice) === preserved.has(slice)) {
        throw new TypeError(`Matriz de invalidação: a fatia "${slice}" do passo "${stepId}" está nos dois lados (ou em nenhum).`);
      }
    }
    for (const slice of PLAYER_OWNED_SLICES) {
      if (cleared.has(slice)) {
        throw new TypeError(`Matriz de invalidação: o passo "${stepId}" tenta limpar a fatia do jogador "${slice}".`);
      }
    }
    for (const target of entry.clearedStepIds) {
      if (!isCreatorStepId(target)) {
        throw new TypeError(`Matriz de invalidação: o passo "${stepId}" cita o passo desconhecido "${target}".`);
      }
    }
  }
}

assertInvalidationMatrixIsTotal();

/**
 * Cria um `InvalidationPatch` congelado com EXATAMENTE as três chaves do
 * contrato: `{clearedStepIds, revokedProvenanceIds, preservedSlices}`.
 *
 * ## Por que NÃO existe uma quarta chave `clearedSlices`
 *
 * As fatias limpas são sempre o complemento exato de `preservedSlices` sobre
 * `CREATOR_DRAFT_SLICES`. Guardar as duas listas seria guardar o mesmo fato
 * duas vezes — e duas fontes do mesmo fato divergem. Pior: um passo escrito a
 * partir do contrato de três chaves devolveria um patch sem `clearedSlices`,
 * `revokeGrantEffects` removeria as concessões do personagem e NENHUMA fatia
 * do rascunho seria limpa. Assimetria apply/revoke silenciosa, sem erro nem
 * log — exatamente o defeito que esta task existe para impedir.
 *
 * Por isso `preservedSlices` é a única entrada e a limpeza é DERIVADA dela.
 *
 * @param {{clearedStepIds?: ReadonlyArray<string>, revokedProvenanceIds?: ReadonlyArray<string>, preservedSlices?: ReadonlyArray<string>}} [params]
 * @returns {Readonly<object>}
 */
export function createInvalidationPatch(params = {}) {
  const { clearedStepIds = [], revokedProvenanceIds = [], preservedSlices = [] } = params ?? {};
  return Object.freeze({
    clearedStepIds: Object.freeze([...clearedStepIds]),
    revokedProvenanceIds: Object.freeze([...revokedProvenanceIds]),
    preservedSlices: Object.freeze([...preservedSlices]),
  });
}

/**
 * Diz se `value` tem o shape pinado de `InvalidationPatch` (as três chaves,
 * todas arrays, com `preservedSlices` citando apenas fatias conhecidas).
 * @param {*} value
 * @returns {boolean}
 */
export function isInvalidationPatch(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray(value.clearedStepIds) &&
    Array.isArray(value.revokedProvenanceIds) &&
    Array.isArray(value.preservedSlices) &&
    value.preservedSlices.every((slice) => CREATOR_DRAFT_SLICES.includes(slice))
  );
}

/**
 * Deriva as fatias que o patch LIMPA: o complemento de `preservedSlices`.
 * @param {object} patch
 * @returns {ReadonlyArray<string>}
 */
export function clearedSlicesOf(patch) {
  const preserved = new Set(patch.preservedSlices);
  return Object.freeze(CREATOR_DRAFT_SLICES.filter((slice) => !preserved.has(slice)));
}

/**
 * Monta o `InvalidationPatch` do passo `stepId` a partir da matriz e da
 * PROVENIÊNCIA registrada no rascunho.
 *
 * Os `revokedProvenanceIds` são exatamente os `sourceInstanceId`s guardados em
 * `draft.provenance` das fatias que serão limpas — deduplicados, mas na ordem
 * canônica das fatias, para que o patch seja determinístico e comparável em
 * teste.
 *
 * @param {string} stepId
 * @param {{draft: object}} context
 * @returns {import('../../core/result.js').Result} `ok(InvalidationPatch)`
 */
export function buildInvalidationPatch(stepId, context = {}) {
  if (!isCreatorStepId(stepId)) {
    return err(
      creatorStateError('CREATOR_INVALIDATION_STEP_UNKNOWN', `Passo desconhecido na matriz de invalidação: "${String(stepId)}".`, {
        stepId: typeof stepId === 'string' ? stepId : null,
      }),
    );
  }
  const draft = context?.draft;
  if (draft === null || typeof draft !== 'object' || draft.provenance === null || typeof draft.provenance !== 'object') {
    return err(
      creatorStateError('CREATOR_INVALIDATION_DRAFT_INVALID', 'A invalidação exige um rascunho com "provenance".', { stepId }),
    );
  }

  const entry = CREATOR_INVALIDATION_MATRIX[stepId];
  const revoked = [];
  const seen = new Set();
  for (const slice of entry.clearedSlices) {
    for (const id of draft.provenance[slice] ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        revoked.push(id);
      }
    }
  }

  return ok(
    createInvalidationPatch({
      clearedStepIds: entry.clearedStepIds,
      revokedProvenanceIds: revoked,
      preservedSlices: entry.preservedSlices,
    }),
  );
}

/**
 * Remove de `build.choices` as escolhas cuja CHAVE QUALIFICADA pertence a uma
 * das proveniências revogadas.
 *
 * ## Por que isso não podia ficar por conta de `revokeGrantEffects`
 *
 * `revokeGrantEffects` (Task 15) desfaz o que foi MATERIALIZADO — entradas de
 * `state.activeEffects`, `inventory`, `spells` e `resources`. As ESCOLHAS não
 * são materialização: são a entrada que o motor lê para decidir o que
 * materializar, e vivem em `build.choices`, que aquele módulo não conhece. O
 * resultado era um resíduo silencioso: depois de Acólito -> Andarilho,
 * `build.choices` guardava as chaves dos DOIS.
 *
 * O resíduo não é inerte. `readChoiceSelection` (collect-effects) resolve a
 * chave qualificada com prioridade máxima, então voltar para o antecedente
 * antigo RESSUSCITAVA escolhas que nunca foram reapresentadas ao jogador —
 * exatamente o oposto de "remover apenas as concessões da seleção
 * substituída".
 *
 * A limpeza mora AQUI, e não no passo, pelo mesmo motivo que a revogação mora
 * aqui: é a sessão que aplica o patch, e este é o único ponto por onde toda
 * revogação passa (navegação para trás E troca dentro do passo). Fazer no passo
 * daria dois lugares para esquecer.
 *
 * A chave é `<sourceInstanceId>:<choiceId>` (`qualifiedChoiceKey`), então o
 * teste é por prefixo exato seguido de `:` — nunca por `includes`, que casaria
 * uma fonte cujo id fosse prefixo de outra.
 *
 * @param {object|null} character
 * @param {ReadonlyArray<string>} revokedIds
 * @returns {object|null} personagem novo, ou o MESMO quando nada muda.
 */
export function stripRevokedChoices(character, revokedIds) {
  const choices = character?.build?.choices;
  if (character === null || choices === null || typeof choices !== 'object' || revokedIds.length === 0) {
    return character;
  }
  const prefixos = revokedIds.map((id) => `${id}:`);
  const mantidas = {};
  let removeu = false;
  for (const [chave, valor] of Object.entries(choices)) {
    if (prefixos.some((prefixo) => chave.startsWith(prefixo))) {
      removeu = true;
      continue;
    }
    mantidas[chave] = valor;
  }
  if (!removeu) {
    return character;
  }
  return { ...character, build: { ...character.build, choices: Object.freeze(mantidas) } };
}

/**
 * Aplica um `InvalidationPatch` a um rascunho: limpa as fatias indicadas
 * (valor `null` explícito e proveniência vazia) e revoga, no personagem
 * canônico, exatamente as concessões daqueles `sourceInstanceId`s.
 *
 * Uma fatia listada em `preservedSlices` NUNCA é tocada — nem o valor, nem a
 * proveniência.
 *
 * @param {object} draft
 * @param {object} patch - `InvalidationPatch`
 * @returns {import('../../core/result.js').Result} `ok({draft, removed})`
 */
export function applyInvalidationPatch(draft, patch) {
  if (!isInvalidationPatch(patch)) {
    return err(creatorStateError('CREATOR_INVALIDATION_PATCH_INVALID', 'O patch de invalidação não tem o shape esperado.'));
  }

  const clearedSlices = clearedSlicesOf(patch);

  // Rede de segurança FINAL: as fatias do jogador só podem ser limpas se
  // alguém as tiver deixado fora de `preservedSlices`. Como isso significaria
  // apagar itens/moedas que o jogador acrescentou à mão, é recusado aqui —
  // mesmo que a matriz tenha sido contornada por um patch construído à mão.
  const apagariaDoJogador = PLAYER_OWNED_SLICES.filter((slice) => clearedSlices.includes(slice));
  if (apagariaDoJogador.length > 0) {
    return err(
      creatorStateError(
        'CREATOR_INVALIDATION_PATCH_CLEARS_PLAYER_SLICE',
        `O patch limparia fatias do jogador (${apagariaDoJogador.join(', ')}); elas precisam estar em "preservedSlices".`,
        { slices: apagariaDoJogador },
      ),
    );
  }

  const slices = {};
  const provenance = {};
  for (const slice of clearedSlices) {
    slices[slice] = null;
    provenance[slice] = [];
  }

  let character = draft?.character ?? null;
  let removed = Object.freeze([]);
  if (character !== null && patch.revokedProvenanceIds.length > 0) {
    const revocation = revokeGrantEffects(character, { sourceInstanceIds: [...patch.revokedProvenanceIds] });
    if (revocation.ok !== true) {
      return revocation;
    }
    character = revocation.value.character;
    removed = revocation.value.removed;
    // Revogar as concessões sem revogar as ESCOLHAS que as produziram deixaria
    // a entrada do motor apontando para uma fonte que não existe mais.
    character = stripRevokedChoices(character, patch.revokedProvenanceIds);
  }

  const next = withDraftSlices(draft, { character, slices, provenance });
  if (next.ok !== true) {
    return next;
  }
  return ok(Object.freeze({ draft: next.value, removed }));
}
