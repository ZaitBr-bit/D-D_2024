// Módulo `features/creator/finalize-character`: a FINALIZAÇÃO do criador — a
// função PURA que transforma o rascunho (as escolhas dos sete passos) no
// `CanonicalCharacter` que será persistido.
//
// ## Por que uma função pura, separada do controller
//
// No criador legado a finalização (`finalizar()`, site/js/pages/creator.js)
// mistura três coisas num mesmo corpo assíncrono: montar o registro, salvar em
// `localStorage` e navegar. Não há como testar "o personagem produzido está
// certo" sem passar por storage e router, e não há como saber se um campo
// errado veio da montagem ou da gravação.
//
// Aqui a montagem é uma função `(rascunho, contexto) -> Result<personagem>`
// sem I/O, sem relógio próprio e sem aleatoriedade: `context.now` é
// OBRIGATÓRIO e vem de fora. Duas chamadas com a mesma entrada produzem
// resultados em deep equality, e a entrada pode estar congelada — as duas
// coisas são testadas.
//
// ## `identity.size` NUNCA é "medium"
//
// Esta é a regra mais importante do módulo, e é a mesma "Regra de defaults de
// migração" das Global Constraints que já produziu um defeito Critical na
// Task 13 (`v1-to-v2.js` materializava `tamanho` ausente como `'medium'` e o
// codec regravava esse chute no registro a cada save).
//
// `identity.size` só recebe valor quando o jogador ESCOLHEU um tamanho — e
// hoje nenhuma espécie do pacote oficial oferece escolha estruturada de
// tamanho (`species.size` é um campo único, sem `sizeOptions`), então o valor
// finalizado é `""` para todas elas. Isso é CORRETO e deliberado: o tamanho
// exibido na ficha é a PROJEÇÃO derivada da espécie
// (`domain/character/queries/movement.js`, Task 16), que lê `species.size` do
// catálogo. Congelar "medium" aqui não acrescentaria informação nenhuma —
// apenas transformaria "não escolhido" em uma afirmação falsa que sobrevive à
// troca de espécie.
//
// `createEmptyCharacter` (domain/character/model.js) TAMBÉM nascia com
// `identity.size: 'medium'` — a última ocorrência do literal em produção, e
// corrigida junto com esta task (hoje nasce `''`, como todo o resto da
// identidade).
//
// A normalização daqui NÃO ficou redundante com aquela correção: ela cobre
// qualquer personagem que chegue ao rascunho por outro caminho (um registro
// legado decodificado, outro construtor, uma regressão futura no model). Este
// módulo não confia na origem — ele garante a saída.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { resolveSafeUrl, SAFE_URL_KINDS } from '../../ui/html.js';
import { deepFreezeValue } from './creator-state.js';

const SCOPE = 'features.creator.finalize';

/**
 * Campos de texto livre de `identity` que o passo `detalhes` preenche. A lista
 * é FECHADA e espelha exatamente `$defs.identity` de
 * `dados/schemas/v1/character-canonical-v2.schema.json` menos `id` (que nunca
 * vem do formulário) e menos `size` (que tem regra própria, ver abaixo).
 * @type {ReadonlyArray<string>}
 */
export const FINALIZED_IDENTITY_TEXT_FIELDS = Object.freeze([
  'name',
  'alignment',
  'appearance',
  'personality',
  'ideals',
  'bonds',
  'flaws',
  'backstory',
  'notes',
]);

/**
 * Valor de `identity.size` de um personagem SEM escolha explícita de tamanho.
 *
 * É a string vazia — nunca `"medium"`, nunca o tamanho da espécie. Exportado
 * para que o teste afirme a constante em vez de repetir o literal, e para que
 * qualquer tentativa de "só desta vez" fique visível num único lugar.
 * @type {string}
 */
export const UNCHOSEN_SIZE = '';

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
export function finalizeError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Lê a fatia `details` do rascunho de forma tolerante: ausência vira objeto
 * vazio, nunca um conjunto de valores plausíveis.
 * @param {object} draftSelections
 * @returns {object}
 */
function readDetailsSlice(draftSelections) {
  const slice = draftSelections?.slices?.details;
  return slice !== null && typeof slice === 'object' && !Array.isArray(slice) ? slice : {};
}

/**
 * Normaliza um campo de texto livre: só string conta; qualquer outra coisa
 * (inclusive número ou objeto vindo de um rascunho corrompido) vira `""`.
 * @param {*} value
 * @returns {string}
 */
function asText(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * Resolve `identity.size` do personagem finalizado.
 *
 * A ÚNICA fonte é a escolha explícita registrada na fatia `details`
 * (`details.size`). Ausência, string vazia, `null` ou qualquer valor
 * não textual resultam em `""` — o personagem fica declaradamente "sem tamanho
 * escolhido", e a ficha deriva o tamanho da espécie.
 *
 * Note que o `identity.size` que já esteja no personagem do rascunho NÃO é
 * aproveitado. Herdá-lo seria exatamente o default hardcoded que esta função
 * existe para impedir — e não bastaria `createEmptyCharacter` ter sido
 * corrigido para `''`, porque um rascunho pode carregar um personagem vindo de
 * registro legado ou de outro construtor.
 * @param {object} details - fatia `details` do rascunho.
 * @returns {string}
 */
export function resolveFinalizedSize(details) {
  const chosen = details?.size;
  if (typeof chosen !== 'string' || chosen.length === 0) {
    return UNCHOSEN_SIZE;
  }
  return chosen;
}

/**
 * Valida a imagem do personagem pelo MESMO sink seguro do resto do app
 * (`resolveSafeUrl` com `kind: 'character-image'`, Task 24): data URL de
 * imagem raster, base64, magic bytes coerentes com o MIME e dentro do teto de
 * bytes derivado do limite de documento do Firestore.
 *
 * Imagem AUSENTE é legítima (`""`); imagem PRESENTE e recusada é ERRO, nunca
 * descartada em silêncio — engolir a recusa produziria um personagem "salvo
 * com sucesso" cuja foto o jogador escolheu e que simplesmente sumiu.
 * @param {*} value
 * @returns {import('../../core/result.js').Result} `ok(string)`
 */
export function resolveFinalizedImage(value) {
  if (value === null || value === undefined || value === '') {
    return ok('');
  }
  if (typeof value !== 'string') {
    return err(finalizeError('CREATOR_FINALIZE_IMAGE_INVALID', 'A imagem do personagem precisa ser uma data URL em texto.', {}));
  }
  const resolved = resolveSafeUrl(value, { kind: SAFE_URL_KINDS.characterImage });
  if (resolved.ok !== true) {
    return err(
      finalizeError('CREATOR_FINALIZE_IMAGE_REJECTED', 'A imagem do personagem foi recusada pelo validador de URL segura.', {
        reason: resolved.error?.code ?? null,
      }),
    );
  }
  return ok(resolved.value.href);
}

/**
 * Lê um timestamp ISO já existente, ou `null` quando ausente/inválido.
 * @param {*} value
 * @returns {string|null}
 */
function existingTimestamp(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Finaliza o personagem: aplica ao `CanonicalCharacter` do rascunho os campos
 * pessoais escolhidos no passo `detalhes` e carimba os timestamps.
 *
 * É PURA e IDEMPOTENTE:
 *
 *   - não muta `draftSelections` (que pode chegar congelado);
 *   - não lê relógio, `Math.random`, storage nem DOM — `context.now` é
 *     obrigatório;
 *   - `finalizeCharacter(d, c)` e `finalizeCharacter(d, c)` produzem objetos em
 *     deep equality, e re-finalizar o resultado não muda mais nada além de
 *     `metadata.updatedAt` (que é o mesmo `now`).
 *
 * O que ela NÃO faz, de propósito: não recalcula concessão nenhuma. Perícias,
 * inventário, magias e recursos já foram materializados pelos passos, pelo
 * motor de efeitos (Task 15) — refazer isso aqui criaria uma segunda
 * implementação da mesma regra, com a divergência de sempre.
 *
 * @param {object} draftSelections - rascunho do criador (`{character, slices, provenance}`).
 * @param {{now: string}} context
 * @returns {import('../../core/result.js').Result} `Result<CanonicalCharacter, AppError>`
 */
export function finalizeCharacter(draftSelections, context = {}) {
  if (draftSelections === null || typeof draftSelections !== 'object') {
    return err(finalizeError('CREATOR_FINALIZE_DRAFT_INVALID', 'A finalização exige o rascunho do criador.', {}));
  }
  const character = draftSelections.character;
  if (
    character === null ||
    typeof character !== 'object' ||
    character.identity === null ||
    typeof character.identity !== 'object' ||
    character.build === null ||
    typeof character.build !== 'object' ||
    character.state === null ||
    typeof character.state !== 'object'
  ) {
    return err(
      finalizeError('CREATOR_FINALIZE_CHARACTER_INVALID', 'O rascunho não contém um CanonicalCharacter com identity/build/state.', {}),
    );
  }
  const now = context?.now;
  if (typeof now !== 'string' || now.length === 0) {
    return err(
      finalizeError('CREATOR_FINALIZE_NOW_REQUIRED', 'A finalização exige "context.now" (timestamp ISO); ela não lê relógio próprio.', {}),
    );
  }
  if (typeof character.identity.id !== 'string' || character.identity.id.length === 0) {
    return err(finalizeError('CREATOR_FINALIZE_ID_MISSING', 'O personagem do rascunho não tem "identity.id".', {}));
  }

  const details = readDetailsSlice(draftSelections);

  const name = asText(details.name).trim();
  if (name.length === 0) {
    // Mesma exigência do wizard legado ("Digite um nome para o personagem"),
    // agora como falha estruturada em vez de `toast` + `return`.
    return err(finalizeError('CREATOR_FINALIZE_NAME_REQUIRED', 'O personagem precisa de um nome para ser finalizado.', {}));
  }

  const image = resolveFinalizedImage(details.image);
  if (image.ok !== true) {
    return image;
  }

  const identity = { id: character.identity.id };
  for (const field of FINALIZED_IDENTITY_TEXT_FIELDS) {
    identity[field] = field === 'name' ? name : asText(details[field]);
  }
  identity.image = image.value;
  // A regra do módulo: sem escolha explícita, `""`.
  identity.size = resolveFinalizedSize(details);

  const metadata = {
    createdAt: existingTimestamp(character.metadata?.createdAt) ?? now,
    updatedAt: now,
    creationConfig:
      character.metadata?.creationConfig !== null && typeof character.metadata?.creationConfig === 'object'
        ? { ...character.metadata.creationConfig }
        : {},
  };

  const finalized = {
    ...character,
    identity,
    metadata,
  };
  // Congelamos o que MONTAMOS. `build`/`state`/`overrides`/`extensions` vêm do
  // rascunho, que a sessão já mantém imutável; nunca são mutados aqui.
  deepFreezeValue(identity);
  deepFreezeValue(metadata);
  Object.freeze(finalized);
  return ok(finalized);
}
