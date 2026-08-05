// Passo `detalhes` do criador (Task 28) — o último passo do wizard: nome,
// imagem, tamanho, alinhamento e os campos pessoais (aparência, personalidade,
// ideais, vínculos, defeitos, história, anotações).
//
// ## Uma fatia só, e nenhuma concessão
//
// Tudo o que este passo escreve mora na fatia `details`. Ele não materializa
// concessão nenhuma (`provenance.details` é sempre vazia) e a matriz de
// invalidação registra que `detalhes` não invalida nada — nome e história não
// alimentam regra. Por isso `reduce` nunca devolve `invalidation` com
// revogação: não há o que revogar.
//
// ## Tamanho: escolha ESTRUTURADA ou nada
//
// O criador legado decide o tamanho lendo prosa: `getTamanho(texto_completo)`
// procura "Tamanho:" no texto da espécie e, se o texto disser "Médio ou
// Pequeno", oferece a escolha; senão devolve `'Médio'` como default.
//
// Aqui não existe nenhuma das duas coisas. A escolha só é oferecida quando a
// entidade `species` declarar `sizeOptions` (campo estruturado); nenhuma
// espécie do pacote oficial declara hoje, então NENHUMA escolha é oferecida e
// `details.size` fica `null` — que a finalização traduz para `identity.size:
// ""`. O tamanho EXIBIDO é sempre a projeção derivada de `species.size`
// (`domain/character/queries/movement.js`, Task 16), mostrada aqui em modo
// leitura, nunca congelada no personagem.
//
// ## Imagem pela PORTA injetada
//
// O passo não toca `FileReader`, `Image` nem `canvas`. Ele traduz a escolha de
// arquivo numa intenção com o `File` cru e o `reduce` chama
// `context.imageProcessor.process(file)` — a porta que o composition root
// monta. Sem a porta, a intenção FALHA com erro nomeado; sem ela o passo não
// tem como produzir data URL nenhuma e fingir que tem seria pior.
//
// A data URL devolvida pela porta passa pelo MESMO sink seguro do resto do app
// (`resolveSafeUrl`, `kind: 'character-image'`), aqui e de novo na finalização:
// bytes de imagem raster, magic bytes coerentes com o MIME e dentro do teto
// derivado do limite de documento do Firestore (Task 24).

import { ok, err } from '../../../core/result.js';
import { escapeHtml, escapeHtmlAttribute, resolveSafeUrl, SAFE_URL_KINDS } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { buildInvalidationPatch, createInvalidationPatch } from '../creator-invalidation.js';
import { withDraftSlices } from '../creator-state.js';
import { createCreatorStep, createStepBinding, stepError } from './creator-step.js';

const STEP_ID = 'detalhes';

/** Intenções de domínio deste passo. */
export const DETAILS_INTENT_TYPES = Object.freeze({
  field: 'creator/details-field',
  size: 'creator/details-size',
  alignment: 'creator/details-alignment',
  image: 'creator/details-image',
  removeImage: 'creator/details-image-remove',
});

/**
 * Campos de TEXTO LIVRE editáveis neste passo, com o id do controle no DOM.
 *
 * A lista é FECHADA e espelha `$defs.identity` do schema canônico menos `id`,
 * `image` e `size` (que têm intenções próprias). Um campo fora dela é recusado
 * pelo `reduce` — assim uma intenção forjada não consegue escrever chave nova
 * na fatia.
 * @type {ReadonlyArray<Readonly<{field: string, elementId: string, label: string, multiline: boolean}>>}
 */
export const DETAILS_TEXT_FIELDS = Object.freeze([
  Object.freeze({ field: 'name', elementId: 'det-nome', label: 'Nome do personagem', multiline: false }),
  Object.freeze({ field: 'appearance', elementId: 'det-aparencia', label: 'Aparência', multiline: true }),
  Object.freeze({ field: 'personality', elementId: 'det-personalidade', label: 'Traços de personalidade', multiline: true }),
  Object.freeze({ field: 'ideals', elementId: 'det-ideais', label: 'Ideais', multiline: true }),
  Object.freeze({ field: 'bonds', elementId: 'det-lacos', label: 'Vínculos', multiline: true }),
  Object.freeze({ field: 'flaws', elementId: 'det-defeitos', label: 'Defeitos', multiline: true }),
  Object.freeze({ field: 'backstory', elementId: 'det-historia', label: 'História', multiline: true }),
  Object.freeze({ field: 'notes', elementId: 'det-notas', label: 'Anotações', multiline: true }),
]);

const TEXT_FIELD_SET = new Set(DETAILS_TEXT_FIELDS.map((entry) => entry.field));

/**
 * Os nove alinhamentos, com o CÓDIGO que o registro persiste.
 *
 * Não vêm do catálogo porque não existem lá: `dnd2024:ruleset:core` declara
 * atributos, perícias, condições, tipos de dano e idiomas — alinhamento não é
 * uma tabela do pacote. É apresentação pura (nenhum efeito do jogo o consulta),
 * e os códigos são exatamente os que o registro legado já grava em
 * `personagem.alinhamento`, para que a ficha continue lendo o mesmo valor.
 * @type {ReadonlyArray<Readonly<{code: string, label: string}>>}
 */
export const ALIGNMENTS = Object.freeze([
  Object.freeze({ code: 'OB', label: 'Ordeiro e Bom' }),
  Object.freeze({ code: 'NB', label: 'Neutro e Bom' }),
  Object.freeze({ code: 'CB', label: 'Caótico e Bom' }),
  Object.freeze({ code: 'ON', label: 'Ordeiro e Neutro' }),
  Object.freeze({ code: 'N', label: 'Neutro' }),
  Object.freeze({ code: 'CN', label: 'Caótico e Neutro' }),
  Object.freeze({ code: 'OM', label: 'Ordeiro e Mau' }),
  Object.freeze({ code: 'NM', label: 'Neutro e Mau' }),
  Object.freeze({ code: 'CM', label: 'Caótico e Mau' }),
]);

const ALIGNMENT_CODES = new Set(ALIGNMENTS.map((entry) => entry.code));

/**
 * Rótulos de exibição dos slugs de tamanho do catálogo. É tradução de
 * APRESENTAÇÃO: o valor mecânico continua sendo o slug.
 * @type {Readonly<Record<string, string>>}
 */
const SIZE_LABELS = Object.freeze({
  tiny: 'Minúsculo',
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
  huge: 'Enorme',
  gargantuan: 'Imenso',
});

/**
 * @param {*} registry
 * @returns {boolean}
 */
function isUsableRegistry(registry) {
  return registry !== null && typeof registry === 'object' && typeof registry.resolve === 'function';
}

/**
 * Lê a fatia `details` normalizada. Ausência vira objeto com todos os campos
 * em `""` e `size: null` — "não escolhido" é um fato observável, nunca a
 * ausência da chave.
 * @param {object} draft
 * @returns {Readonly<object>}
 */
export function readDetails(draft) {
  const slice = draft?.slices?.details;
  const safe = slice !== null && typeof slice === 'object' && !Array.isArray(slice) ? slice : {};
  const normalized = {};
  for (const entry of DETAILS_TEXT_FIELDS) {
    normalized[entry.field] = typeof safe[entry.field] === 'string' ? safe[entry.field] : '';
  }
  normalized.alignment = typeof safe.alignment === 'string' ? safe.alignment : '';
  normalized.image = typeof safe.image === 'string' ? safe.image : '';
  // `null` (e não `''`) para distinguir "não escolhido" de "escolhido vazio".
  normalized.size = typeof safe.size === 'string' && safe.size.length > 0 ? safe.size : null;
  return Object.freeze(normalized);
}

/**
 * Descreve o TAMANHO da espécie escolhida: o slug declarado pelo catálogo e as
 * opções estruturadas, quando existirem.
 *
 * `options` sai vazio para todo o pacote oficial de hoje (nenhuma espécie
 * declara `sizeOptions`), e é por isso que `details.size` fica `null` e
 * `identity.size` finalizado fica `""`.
 * @param {object} context
 * @returns {Readonly<{contentId: string|null, speciesName: string|null, speciesSize: string|null, options: ReadonlyArray<string>}>}
 */
export function describeSizeChoice(context) {
  const selection = context.draft?.slices?.speciesSelection;
  const contentId = selection !== null && typeof selection === 'object' ? selection.contentId : null;
  if (typeof contentId !== 'string' || contentId.length === 0 || !isUsableRegistry(context.registry)) {
    return Object.freeze({ contentId: null, speciesName: null, speciesSize: null, options: Object.freeze([]) });
  }
  const resolved = context.registry.resolve(contentId, 'species');
  if (resolved.ok !== true) {
    return Object.freeze({ contentId, speciesName: null, speciesSize: null, options: Object.freeze([]) });
  }
  const entity = resolved.value;
  const declared = Array.isArray(entity.sizeOptions)
    ? entity.sizeOptions.filter((slug) => typeof slug === 'string' && slug.length > 0)
    : [];
  return Object.freeze({
    contentId,
    speciesName: typeof entity.name === 'string' ? entity.name : contentId,
    speciesSize: typeof entity.size === 'string' && entity.size.length > 0 ? entity.size : null,
    options: Object.freeze([...declared]),
  });
}

// --- Renderização ---------------------------------------------------------

/**
 * Markup de um campo de texto livre.
 * @param {object} entry - item de `DETAILS_TEXT_FIELDS`.
 * @param {string} value
 * @returns {string}
 */
function renderTextField(entry, value) {
  const id = escapeHtmlAttribute(entry.elementId);
  const field = escapeHtmlAttribute(entry.field);
  const label = escapeHtml(entry.label);
  if (entry.multiline) {
    return (
      `<div class="form-group"><label class="form-label" for="${id}">${label}</label>` +
      `<textarea class="form-input" id="${id}" data-det-field="${field}" rows="3">${escapeHtml(value)}</textarea></div>`
    );
  }
  return (
    `<div class="form-group"><label class="form-label" for="${id}">${label}</label>` +
    `<input class="form-input" type="text" id="${id}" data-det-field="${field}" value="${escapeHtmlAttribute(value)}"></div>`
  );
}

/**
 * Markup do bloco de tamanho: cards quando há escolha estruturada, leitura
 * quando o catálogo declara um tamanho único.
 * @param {object} sizeInfo - saída de `describeSizeChoice`.
 * @param {string|null} chosen
 * @returns {string}
 */
function renderSizeBlock(sizeInfo, chosen) {
  if (sizeInfo.options.length > 0) {
    const cards = sizeInfo.options
      .map((slug) => {
        const selected = slug === chosen ? ' selected' : '';
        return (
          `<div class="selection-card${selected}" data-det-size="${escapeHtmlAttribute(slug)}">` +
          `<div class="card-nome">${escapeHtml(SIZE_LABELS[slug] ?? slug)}</div></div>`
        );
      })
      .join('');
    return (
      '<div class="card mb-2"><div class="card-header"><h3>Tamanho</h3></div>' +
      `<div class="selection-grid" id="det-tamanho-grid">${cards}</div></div>`
    );
  }
  const derived = sizeInfo.speciesSize;
  const texto =
    derived === null
      ? 'O tamanho é derivado da espécie escolhida.'
      : `Tamanho derivado da espécie${sizeInfo.speciesName === null ? '' : ` (${sizeInfo.speciesName})`}: ${SIZE_LABELS[derived] ?? derived}.`;
  return (
    '<div class="card mb-2"><div class="card-header"><h3>Tamanho</h3></div>' +
    `<div class="info-box info" data-det-size-derivado="${escapeHtmlAttribute(derived ?? '')}">${escapeHtml(texto)}</div>` +
    '<div class="info-box info">Esta espécie não oferece escolha de tamanho; nada é gravado no personagem.</div>' +
    '</div>'
  );
}

/**
 * Markup do bloco de imagem. A prévia só é renderizada quando a data URL
 * atravessa `resolveSafeUrl` — uma imagem recusada nunca chega ao `src`.
 * @param {string} image
 * @returns {string}
 */
function renderImageBlock(image) {
  const resolved = image.length === 0 ? null : resolveSafeUrl(image, { kind: SAFE_URL_KINDS.characterImage });
  const preview =
    resolved !== null && resolved.ok === true
      ? `<img id="det-imagem-preview" src="${escapeHtmlAttribute(resolved.value.href)}" alt="">`
      : '<div id="det-imagem-preview" class="char-avatar"></div>';
  const aviso =
    resolved !== null && resolved.ok !== true
      ? `<div class="info-box warning" data-det-imagem-erro="${escapeHtmlAttribute(String(resolved.error?.code ?? ''))}">` +
        escapeHtml('A imagem guardada não passou na validação de segurança e não será usada.') +
        '</div>'
      : '';
  return (
    '<div class="card mb-2"><div class="card-header"><h3>Imagem</h3></div>' +
    preview +
    aviso +
    '<input type="file" accept="image/*" id="det-imagem-input" data-det-imagem-input="true">' +
    `<button class="btn btn-sm btn-danger" type="button" id="det-imagem-remover" data-det-imagem-remover="true"${
      image.length === 0 ? ' disabled' : ''
    }>Remover imagem</button>` +
    '</div>'
  );
}

/**
 * Cria o passo `detalhes`.
 * @returns {import('../../../core/result.js').Result} `ok(step)`
 */
export function createDetailsStep() {
  return createCreatorStep({
    id: STEP_ID,

    /**
     * Carrega o vocabulário de apresentação do passo e o tamanho declarado
     * pela espécie escolhida. Não faz rede: tudo sai do catálogo já ativo.
     * @param {object} context
     * @returns {Promise<import('../../../core/result.js').Result>}
     */
    async load(context) {
      const sizeInfo = describeSizeChoice(context);
      return ok(
        Object.freeze({
          stepId: STEP_ID,
          textFields: DETAILS_TEXT_FIELDS,
          alignments: ALIGNMENTS,
          size: sizeInfo,
          // DECLARADO, não presumido: quem lê o step data sabe que a ausência
          // de escolha de tamanho é uma propriedade do conteúdo, não um
          // esquecimento do passo.
          sizeChoiceAvailable: sizeInfo.options.length > 0,
        }),
      );
    },

    /**
     * Markup do passo. Todo valor livre é escapado.
     * @param {object} context
     * @returns {string}
     */
    render(context) {
      const details = readDetails(context.draft);
      const sizeInfo = isUsableRegistry(context.registry) ? describeSizeChoice(context) : context.data?.size ?? null;
      const alinhamentos = ALIGNMENTS.map((entry) => {
        const selected = entry.code === details.alignment ? ' selected' : '';
        return (
          `<div class="selection-card${selected}" data-det-alignment="${escapeHtmlAttribute(entry.code)}">` +
          `<div class="card-nome">${escapeHtml(entry.label)}</div>` +
          `<div class="card-detalhe">${escapeHtml(entry.code)}</div></div>`
        );
      }).join('');

      return (
        '<h3>Detalhes</h3>' +
        '<div class="card mb-2"><div class="card-header"><h3>Identidade</h3></div>' +
        DETAILS_TEXT_FIELDS.filter((entry) => entry.field === 'name')
          .map((entry) => renderTextField(entry, details[entry.field]))
          .join('') +
        '</div>' +
        renderImageBlock(details.image) +
        (sizeInfo === null ? '' : renderSizeBlock(sizeInfo, details.size)) +
        '<div class="card mb-2"><div class="card-header"><h3>Alinhamento</h3></div>' +
        `<div class="selection-grid" id="det-alinhamento-grid">${alinhamentos}</div></div>` +
        '<div class="card mb-2"><div class="card-header"><h3>Personagem</h3></div>' +
        DETAILS_TEXT_FIELDS.filter((entry) => entry.field !== 'name')
          .map((entry) => renderTextField(entry, details[entry.field]))
          .join('') +
        '</div>'
      );
    },

    /**
     * Descritor DECLARATIVO.
     *
     * Os campos de texto são ouvidos em `change` (não em `input`) de propósito:
     * cada intenção provoca um re-render do controller, e re-renderizar a cada
     * TECLA destruiria o foco e o cursor do campo que está sendo digitado.
     * `change` dispara ao sair do campo — e é o que `fill()`/digitação humana
     * produzem ao final.
     * @param {object} context
     * @returns {Readonly<object>}
     */
    bind(context) {
      return createStepBinding({
        eventTypes: ['click', 'change'],
        /**
         * @param {object} event
         * @returns {Readonly<object>}
         */
        toIntent(event) {
          const target = event.target;
          if (!target || typeof target.closest !== 'function') {
            return NO_UI_EVENT_DECISION;
          }

          if (event.type === 'change') {
            const campo = target.closest('[data-det-field]');
            if (campo !== null) {
              const field = campo.getAttribute('data-det-field');
              return createUiEventDecision({
                intent: { type: DETAILS_INTENT_TYPES.field, field, value: typeof target.value === 'string' ? target.value : '' },
                preventDefault: false,
              });
            }
            if (target.closest('[data-det-imagem-input]') !== null) {
              // O `File` cru viaja na intenção; quem sabe processá-lo é a
              // PORTA, no `reduce`. O passo não abre `FileReader`.
              const files = target.files ?? null;
              const file = files !== null && files.length > 0 ? files[0] : null;
              if (file === null) {
                return NO_UI_EVENT_DECISION;
              }
              return createUiEventDecision({ intent: { type: DETAILS_INTENT_TYPES.image, file }, preventDefault: false });
            }
            return NO_UI_EVENT_DECISION;
          }

          const alinhamento = target.closest('[data-det-alignment]');
          if (alinhamento !== null) {
            return createUiEventDecision({
              intent: { type: DETAILS_INTENT_TYPES.alignment, alignment: alinhamento.getAttribute('data-det-alignment') },
              preventDefault: true,
            });
          }

          const tamanho = target.closest('[data-det-size]');
          if (tamanho !== null) {
            return createUiEventDecision({
              intent: { type: DETAILS_INTENT_TYPES.size, size: tamanho.getAttribute('data-det-size') },
              preventDefault: true,
            });
          }

          if (target.closest('[data-det-imagem-remover]') !== null) {
            return createUiEventDecision({ intent: { type: DETAILS_INTENT_TYPES.removeImage }, preventDefault: true });
          }
          void context;
          return NO_UI_EVENT_DECISION;
        },
      });
    },

    /**
     * Válido quando há NOME. É a mesma (e única) exigência do wizard legado
     * para finalizar; os demais campos são opcionais por regra de jogo.
     * @param {object} context
     * @returns {object} ValidationResult
     */
    validate(context) {
      const details = readDetails(context.draft);
      const errors = [];
      if (details.name.trim().length === 0) {
        errors.push({ code: 'CREATOR_DETAILS_NAME_REQUIRED', stepId: STEP_ID });
      }
      // Uma imagem gravada que não passa no validador seguro BLOQUEIA: a
      // finalização a recusaria de qualquer forma, e descobrir isso só no
      // clique de "Finalizar" seria pior do que descobrir aqui.
      if (details.image.length > 0 && resolveSafeUrl(details.image, { kind: SAFE_URL_KINDS.characterImage }).ok !== true) {
        errors.push({ code: 'CREATOR_DETAILS_IMAGE_REJECTED', stepId: STEP_ID });
      }
      // Um tamanho escolhido precisa estar entre as opções ESTRUTURADAS da
      // espécie; um valor fora delas seria exatamente o default inventado que
      // este passo existe para não produzir.
      if (details.size !== null) {
        const sizeInfo = describeSizeChoice(context);
        if (!sizeInfo.options.includes(details.size)) {
          errors.push({ code: 'CREATOR_DETAILS_SIZE_NOT_OFFERED', stepId: STEP_ID, size: details.size });
        }
      }
      return { valid: errors.length === 0, errors };
    },

    /**
     * `detalhes` não invalida nada (linha `detalhes` da matriz).
     * @param {object} context
     * @returns {import('../../../core/result.js').Result}
     */
    invalidate(context) {
      return buildInvalidationPatch(STEP_ID, { draft: context.draft });
    },

    /**
     * Aplica a intenção de domínio.
     * @param {object} context
     * @param {object} intent
     * @returns {Promise<import('../../../core/result.js').Result>}
     */
    async reduce(context, intent) {
      if (!Object.values(DETAILS_INTENT_TYPES).includes(intent?.type)) {
        return ok(Object.freeze({ draft: context.draft }));
      }
      const details = { ...readDetails(context.draft) };

      switch (intent.type) {
        case DETAILS_INTENT_TYPES.field: {
          if (!TEXT_FIELD_SET.has(intent.field)) {
            return err(
              stepError('CREATOR_DETAILS_FIELD_UNKNOWN', `O passo "${STEP_ID}" não escreve o campo "${String(intent.field)}".`, {
                stepId: STEP_ID,
                field: typeof intent.field === 'string' ? intent.field : null,
              }),
            );
          }
          details[intent.field] = typeof intent.value === 'string' ? intent.value : '';
          break;
        }

        case DETAILS_INTENT_TYPES.alignment: {
          if (!ALIGNMENT_CODES.has(intent.alignment)) {
            return err(
              stepError('CREATOR_DETAILS_ALIGNMENT_UNKNOWN', `"${String(intent.alignment)}" não é um alinhamento conhecido.`, {
                stepId: STEP_ID,
              }),
            );
          }
          details.alignment = intent.alignment;
          break;
        }

        case DETAILS_INTENT_TYPES.size: {
          const sizeInfo = describeSizeChoice(context);
          if (!sizeInfo.options.includes(intent.size)) {
            return err(
              stepError('CREATOR_DETAILS_SIZE_NOT_OFFERED', `A espécie escolhida não oferece o tamanho "${String(intent.size)}".`, {
                stepId: STEP_ID,
                offered: [...sizeInfo.options],
              }),
            );
          }
          details.size = intent.size;
          break;
        }

        case DETAILS_INTENT_TYPES.image: {
          const processor = context.imageProcessor;
          if (processor === null || processor === undefined || typeof processor.process !== 'function') {
            return err(
              stepError('CREATOR_DETAILS_IMAGE_PROCESSOR_MISSING', 'Processar a imagem exige a porta "imageProcessor" injetada.', {
                stepId: STEP_ID,
              }),
            );
          }
          let processed;
          try {
            processed = await processor.process(intent.file);
          } catch (cause) {
            return err(
              stepError('CREATOR_DETAILS_IMAGE_PROCESSING_FAILED', 'O processamento da imagem lançou uma exceção.', { stepId: STEP_ID }, cause),
            );
          }
          if (!processed || processed.ok !== true) {
            return (
              processed ??
              err(stepError('CREATOR_DETAILS_IMAGE_PROCESSING_FAILED', 'A porta de imagem não devolveu um Result.', { stepId: STEP_ID }))
            );
          }
          const dataUrl = processed.value;
          const safe = resolveSafeUrl(typeof dataUrl === 'string' ? dataUrl : '', { kind: SAFE_URL_KINDS.characterImage });
          if (safe.ok !== true) {
            return err(
              stepError('CREATOR_DETAILS_IMAGE_REJECTED', 'A imagem processada foi recusada pelo validador de URL segura.', {
                stepId: STEP_ID,
                reason: safe.error?.code ?? null,
              }),
            );
          }
          details.image = safe.value.href;
          break;
        }

        case DETAILS_INTENT_TYPES.removeImage:
          details.image = '';
          break;

        default:
          return ok(Object.freeze({ draft: context.draft }));
      }

      const updated = withDraftSlices(context.draft, {
        slices: { details: Object.freeze({ ...details }) },
        // Sem proveniência: este passo não materializa concessão nenhuma, e
        // declarar uma fonte aqui faria a matriz revogar concessões alheias.
        provenance: { details: [] },
      });
      if (updated.ok !== true) {
        return updated;
      }
      const patch = buildInvalidationPatch(STEP_ID, { draft: context.draft });
      if (patch.ok !== true) {
        return patch;
      }
      const invalidation = createInvalidationPatch({
        clearedStepIds: patch.value.clearedStepIds,
        revokedProvenanceIds: patch.value.revokedProvenanceIds,
        // `details` é declarada como escrita mesmo quando o valor sai idêntico
        // (reconfirmar o mesmo alinhamento): sem isso a composição da sessão
        // limparia a fatia que o passo acabou de reafirmar.
        preservedSlices: [...new Set([...patch.value.preservedSlices, 'details'])],
      });
      return ok(Object.freeze({ draft: updated.value, invalidation }));
    },
  });
}
