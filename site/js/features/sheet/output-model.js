// Módulo `features/sheet/output-model`: a SELEÇÃO ÚNICA do que a ficha emite
// para fora da tela — impressão (`print/print-view.js`) e PDF
// (`pdf/pdf-drawing-plan.js`).
//
// ## Por que este módulo existe (ele não está na lista de arquivos do brief)
//
// O brief da Task 33 pede `renderPrintHtml(viewModel, ports)` e
// `createPdfDrawingPlan(viewModel)` como duas funções independentes. Escritas
// de forma independente, cada uma faria a SUA leitura do `SheetViewModel` — e o
// checklist da task exige, no mesmo fôlego, que print e PDF emitam exatamente
// os mesmos valores. Duas listas de campos paralelas que "precisam concordar"
// são o padrão de bug que este projeto já pegou repetidas vezes: uma delas
// muda, a outra não, e o teste de paridade vira o único aviso — depois de a
// divergência já ter sido escrita.
//
// Aqui a paridade é ESTRUTURAL, não verificada a posteriori: existe UMA lista
// de blocos semânticos, e print e PDF são dois renderizadores dela. O teste de
// contrato continua existindo (ele prova que a tela também converge, e que os
// valores batem com `expectedUnified` da Task 2), mas ele deixa de ser o que
// SEGURA a paridade entre print e PDF.
//
// ## Nenhuma regra de jogo mora aqui
//
// Todo NÚMERO vem pronto de `viewModel.derived` (Tasks 16/18/19/23, projetados
// por `sheet-view-model.js`); todo TEXTO do jogador vem de `viewModel.data`,
// que é eco literal do registro canônico. Este módulo só ESCOLHE, ROTULA e
// FORMATA. Não há tabela de progressão, comparação por nome de exibição, regex
// sobre prosa nem cálculo — o teste focal varre o fonte.
//
// ## Ausência permanece ausência
//
// Um valor que o ViewModel não sabe (`null`) vira o texto "—" e mantém
// `value: null` na entrada. Ele NUNCA vira `0`: zero é uma afirmação de jogo
// ("o personagem não tem esse bônus") que esta camada não tem base para fazer.
// É a mesma disciplina de `sheet-view-model.js#pick` e das seções das
// Tasks 30-32.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { ABILITY_KEYS } from '../../domain/character/queries/index.js';

const SCOPE = 'features.sheet.output-model';

/**
 * Texto usado para um valor DESCONHECIDO. Nunca "0", nunca vazio: a ausência
 * precisa ser visível na folha impressa.
 * @type {string}
 */
export const ABSENT_TEXT = '—';

/** Rótulos de exibição dos seis atributos, na ordem canônica de `ABILITY_KEYS`. */
export const ABILITY_LABELS = Object.freeze({
  forca: 'Força',
  destreza: 'Destreza',
  constituicao: 'Constituição',
  inteligencia: 'Inteligência',
  sabedoria: 'Sabedoria',
  carisma: 'Carisma',
});

/**
 * Campos pessoais impressos, na ordem de apresentação. Espelha
 * `sections/personal-details-section.js#PERSONAL_DETAIL_FIELDS` — os mesmos
 * campos que a TELA mostra, para que a folha impressa não tenha nem mais nem
 * menos do que a ficha.
 * @type {ReadonlyArray<Readonly<{field: string, label: string}>>}
 */
export const PERSONAL_PRINT_FIELDS = Object.freeze([
  Object.freeze({ field: 'appearance', label: 'Aparência' }),
  Object.freeze({ field: 'personality', label: 'Personalidade' }),
  Object.freeze({ field: 'ideals', label: 'Ideais' }),
  Object.freeze({ field: 'bonds', label: 'Vínculos' }),
  Object.freeze({ field: 'flaws', label: 'Defeitos' }),
  Object.freeze({ field: 'backstory', label: 'História' }),
  Object.freeze({ field: 'notes', label: 'Anotações' }),
]);

/**
 * Denominações da carteira, na ordem de apresentação, com o rótulo curto.
 * @type {ReadonlyArray<Readonly<{key: string, label: string}>>}
 */
export const WALLET_ENTRIES = Object.freeze([
  Object.freeze({ key: 'pl', label: 'PL' }),
  Object.freeze({ key: 'po', label: 'PO' }),
  Object.freeze({ key: 'pe', label: 'PE' }),
  Object.freeze({ key: 'pp', label: 'PP' }),
  Object.freeze({ key: 'pc', label: 'PC' }),
]);

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function outputError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Formata um número COM sinal explícito (formato de modificador/bônus).
 * Ausência vira `ABSENT_TEXT` — nunca "+0".
 * @param {*} value
 * @returns {string}
 */
export function signedText(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ABSENT_TEXT;
  }
  return value >= 0 ? `+${value}` : String(value);
}

/**
 * Formata um valor simples (número ou texto). Ausência vira `ABSENT_TEXT`.
 * @param {*} value
 * @returns {string}
 */
export function plainText(value) {
  if (value === null || value === undefined || value === '') {
    return ABSENT_TEXT;
  }
  return String(value);
}

/**
 * Cria uma ENTRADA de bloco: o par (valor bruto, texto de exibição) mais o
 * nome SEMÂNTICO estável pelo qual o teste de paridade a identifica.
 *
 * `semantic` é o contrato entre tela, impressão e PDF: os três precisam falar
 * do mesmo campo pelo mesmo nome para que a comparação seja possível sem
 * inferir texto de bytes de PDF.
 * @param {string} semantic
 * @param {string} label
 * @param {*} value - valor BRUTO projetado (número, string ou `null`).
 * @param {string} [text] - texto de exibição; padrão `plainText(value)`.
 * @returns {Readonly<object>}
 */
function entry(semantic, label, value, text = undefined) {
  return Object.freeze({
    semantic,
    label,
    value: value === undefined ? null : value,
    text: text === undefined ? plainText(value) : text,
  });
}

/**
 * Bloco de saída (uma "seção" da folha).
 * @param {string} id
 * @param {string} title
 * @param {ReadonlyArray<object>} entries
 * @returns {Readonly<object>}
 */
function block(id, title, entries) {
  return Object.freeze({ kind: 'section', id, title, entries: Object.freeze(entries) });
}

/**
 * Subtítulo do cabeçalho: espécie/classe (subclasse) — Nível N | antecedente |
 * alinhamento, montado só a partir dos nomes JÁ RESOLVIDOS em
 * `derived.printable.headline` (que é quem consulta o catálogo). Partes
 * ausentes são OMITIDAS; nenhuma delas é substituída por um texto plausível.
 * @param {object} headline
 * @returns {string}
 */
export function buildSubtitle(headline) {
  const classe = [headline.className, headline.subclassName === null ? null : `(${headline.subclassName})`]
    .filter((parte) => typeof parte === 'string' && parte.length > 0)
    .join(' ');
  const principal = [headline.speciesName, classe].filter((parte) => typeof parte === 'string' && parte.length > 0).join(' ');
  const nivel = typeof headline.level === 'number' ? `Nível ${headline.level}` : null;
  const cabeca = [principal, nivel].filter((parte) => typeof parte === 'string' && parte.length > 0).join(' — ');
  const cauda = [headline.backgroundName, headline.alignment].filter((parte) => typeof parte === 'string' && parte.length > 0);
  return [cabeca, ...cauda].filter((parte) => parte.length > 0).join(' | ');
}

/**
 * Monta os blocos de COMBATE (as caixas de estatística do topo).
 * @param {object} derived
 * @returns {Readonly<object>}
 */
function combatBlock(derived) {
  const hp = derived.hitPoints;
  const entradas = [
    entry('armorClass', 'CA', derived.armorClass),
    entry('initiative', 'Iniciativa', derived.initiative, signedText(derived.initiative)),
    // O deslocamento é apresentado COM a unidade, como o baseline faz ("9
    // metros"). O valor bruto de `derived.movement.effective` é o número em
    // metros; o par (valor, texto) do modelo carrega a forma FORMATADA porque
    // é ela que tela, impressão e PDF mostram — e é ela que `expectedUnified`
    // do oráculo da Task 2 registra. Mesma decisão de `hitPoints` ("20/38").
    entry(
      'speed',
      'Deslocamento',
      typeof derived.movement.effective === 'number' ? `${derived.movement.effective} metros` : null,
    ),
    entry(
      'hitPoints',
      'PV',
      hp.current === null || hp.maximum === null ? null : `${hp.current}/${hp.maximum}`,
      hp.current === null || hp.maximum === null ? ABSENT_TEXT : `${hp.current}/${hp.maximum}`,
    ),
    entry('hitPoints.maximum', 'PV Máximo', hp.maximum),
    // PV temporário é o campo que o baseline ERRAVA em print e PDF (lia
    // `char.pv_temp`, inexistente). Aqui existe UMA leitura — a de
    // `derived.hitPoints.temporary` — e por construção os três meios mostram o
    // mesmo número. Ver `baselineDifferences` do caso
    // `pv-temporario-divergente` em `tests/fixtures/expected/derived-values.json`.
    entry('hitPoints.temporary', 'PV Temporário', hp.temporary),
    // Mesma história para os Dados de Vida RESTANTES (o baseline imprimia
    // `dados_vida_disponiveis`, inexistente, e o PDF simplesmente omitia).
    entry(
      'hitDice.remaining',
      'Dados de Vida',
      hp.hitDiceRemaining,
      hp.hitDiceRemaining === null || hp.hitDiceTotal === null ? plainText(hp.hitDiceRemaining) : `${hp.hitDiceRemaining}/${hp.hitDiceTotal}`,
    ),
    entry('proficiencyBonus', 'Proficiência', derived.proficiencyBonus, signedText(derived.proficiencyBonus)),
  ];
  // CD e ataque de magia só entram quando o personagem TEM conjuração: uma
  // caixa "CD Magia —" num Bárbaro é ruído, não informação.
  if (derived.defenses.spellSaveDC !== null) {
    entradas.push(entry('spellSaveDC', 'CD Magia', derived.defenses.spellSaveDC));
  }
  if (derived.defenses.spellAttackBonus !== null) {
    entradas.push(entry('spellAttackBonus', 'Atq. Magia', derived.defenses.spellAttackBonus, signedText(derived.defenses.spellAttackBonus)));
  }
  return block('combat', 'Combate', entradas);
}

/**
 * Blocos de atributos e salvaguardas.
 * @param {object} derived
 * @param {object} data
 * @returns {ReadonlyArray<object>}
 */
function abilityBlocks(derived, data) {
  const atributos = ABILITY_KEYS.map((key) => {
    const modificador = derived.abilities?.[key]?.modifier ?? null;
    const score = data?.state?.abilities?.[key] ?? null;
    return entry(
      `ability.${key}`,
      ABILITY_LABELS[key] ?? key,
      modificador,
      score === null ? signedText(modificador) : `${signedText(modificador)} (${score})`,
    );
  });
  const salvaguardas = ABILITY_KEYS.map((key) => {
    const projecao = derived.savingThrows?.[key] ?? null;
    const bonus = projecao?.bonus ?? null;
    return entry(
      `save.${key}`,
      ABILITY_LABELS[key] ?? key,
      bonus,
      `${signedText(bonus)}${projecao?.proficient === true ? ' •' : ''}`,
    );
  });
  return [block('abilities', 'Atributos', atributos), block('saving-throws', 'Salvaguardas', salvaguardas)];
}

/**
 * Bloco de perícias. A ORDEM é a das chaves de `derived.skills`, que por sua
 * vez é a ordem em que o catálogo as lista — nunca uma lista de perícias
 * embutida aqui (isso seria conteúdo de jogo dentro do renderizador, o defeito
 * que `sheet.js` legado tem em `listaBase`).
 * @param {object} derived
 * @returns {Readonly<object>}
 */
function skillsBlock(derived) {
  const entradas = Object.entries(derived.skills ?? {}).map(([skillId, projecao]) =>
    entry(
      `skill.${skillId}`,
      skillId,
      projecao?.bonus ?? null,
      `${signedText(projecao?.bonus ?? null)}${projecao?.expert === true ? ' ◆' : projecao?.proficient === true ? ' •' : ''}`,
    ),
  );
  return block('skills', 'Perícias', entradas);
}

/**
 * Blocos de sentidos passivos e defesas.
 * @param {object} derived
 * @returns {ReadonlyArray<object>}
 */
function sensesAndDefensesBlocks(derived) {
  const sentidos = [
    entry('passivePerception', 'Percepção Passiva', derived.senses.passivePerception),
    entry('passiveInsight', 'Intuição Passiva', derived.senses.passiveInsight),
    entry('passiveInvestigation', 'Investigação Passiva', derived.senses.passiveInvestigation),
    entry('darkvision', 'Visão no Escuro', derived.senses.darkvision),
  ];
  /**
   * Lista de defesa: `null` (desconhecido) e `[]` (sabidamente nenhuma) são
   * textos DIFERENTES.
   * @param {*} lista
   * @returns {string}
   */
  const listaTexto = (lista) => (Array.isArray(lista) ? (lista.length === 0 ? 'Nenhuma' : lista.join(', ')) : ABSENT_TEXT);
  // Task 33: o VALOR semântico das defesas é o rótulo resolvido no catálogo, não
  // o ContentId. Impressão e PDF são saídas para o JOGADOR — imprimir
  // `dnd2024:damage-type:fogo` num papel é o mesmo defeito que mostrá-lo na
  // tela. O id continua sendo a fonte da verdade no ViewModel
  // (`derived.defenses.resistances`), que é onde a mecânica o compara.
  const defesas = [
    entry('defenses.resistances', 'Resistências', derived.defenses.resistanceLabels, listaTexto(derived.defenses.resistanceLabels)),
    entry('defenses.vulnerabilities', 'Vulnerabilidades', derived.defenses.vulnerabilityLabels, listaTexto(derived.defenses.vulnerabilityLabels)),
    entry('defenses.immunities', 'Imunidades', derived.defenses.immunityLabels, listaTexto(derived.defenses.immunityLabels)),
  ];
  return [block('senses', 'Sentidos Passivos', sentidos), block('defenses', 'Defesas', defesas)];
}

/**
 * Bloco de ataques. Uma entrada por ARMA projetada por
 * `sheet-view-model.js#projectAttacks` — equipada ou não, como o baseline faz.
 * @param {object} derived
 * @returns {Readonly<object>}
 */
function attacksBlock(derived) {
  const entradas = (derived.attacks ?? []).map((ataque) =>
    entry(
      `attack.${ataque.instanceId}`,
      ataque.name ?? '',
      ataque.attackBonus,
      `${signedText(ataque.attackBonus)} | ${plainText(ataque.damageDice)}${
        typeof ataque.damageBonus === 'number' && ataque.damageBonus !== 0 ? signedText(ataque.damageBonus) : ''
      }${ataque.damageType === null || ataque.damageType === undefined ? '' : ` ${ataque.damageType}`}`,
    ),
  );
  return block('attacks', 'Ataques', entradas);
}

/**
 * Bloco de recursos (`derived.resources`), incluindo os recursos de talento
 * que o baseline NÃO imprimia (`recursos-de-talento-convergente` em
 * `derived-values.json` registra a omissão como diferença aceita do baseline).
 * @param {object} derived
 * @returns {Readonly<object>}
 */
function resourcesBlock(derived) {
  const entradas = Object.entries(derived.resources ?? {}).map(([resourceId, projecao]) =>
    entry(
      `resource.${resourceId}`,
      resourceId,
      projecao?.available ?? null,
      projecao?.maximum === null || projecao?.maximum === undefined
        ? plainText(projecao?.available ?? null)
        : `${plainText(projecao?.available ?? null)}/${projecao.maximum}`,
    ),
  );
  return block('resources', 'Recursos', entradas);
}

/**
 * Bloco de espaços de magia (por círculo e o pool separado de pacto).
 * @param {object} derived
 * @returns {Readonly<object>}
 */
function spellSlotsBlock(derived) {
  const porCirculo = Object.entries(derived.spellSlots?.byLevel ?? {})
    .map(([nivel, slot]) => ({ nivel: Number(nivel), slot }))
    .sort((a, b) => a.nivel - b.nivel)
    .map(({ nivel, slot }) =>
      entry(
        `spellSlot.${nivel}`,
        `${nivel}º círculo`,
        slot?.available ?? null,
        slot?.maximum === null || slot?.maximum === undefined
          ? plainText(slot?.available ?? null)
          : `${plainText(slot?.available ?? null)}/${slot.maximum}`,
      ),
    );
  const pacto = derived.spellSlots?.pact ?? null;
  if (pacto !== null && pacto.maximum !== null && pacto.maximum !== undefined) {
    porCirculo.push(entry('spellSlot.pact', 'Magia de Pacto', pacto.available ?? null, `${plainText(pacto.available)}/${pacto.maximum}`));
  }
  return block('spell-slots', 'Espaços de Magia', porCirculo);
}

/**
 * Bloco de inventário + carga.
 *
 * `derived.inventory` é um ENVELOPE `{available, reason, items}` (Task 32): sem
 * catálogo a lista não foi calculada, e imprimir "nenhum item" seria MENTIR. O
 * bloco declara o motivo em `unavailableReason` e não emite entrada nenhuma.
 * @param {object} derived
 * @returns {Readonly<object>}
 */
function inventoryBlock(derived) {
  const envelope = derived.inventory ?? { available: false, reason: null, items: [] };
  const entradas = envelope.available !== true
    ? []
    : envelope.items.map((item) =>
        entry(
          `inventory.${item.instanceId}`,
          item.name ?? '',
          item.quantity ?? null,
          `${plainText(item.quantity)}× ${item.name ?? ''}${item.equipped === true ? ' (equipado)' : ''}`,
        ),
      );
  entradas.push(entry('load.totalWeightKg', 'Peso Total', derived.load?.totalWeightKg ?? null));
  // O baseline NÃO imprimia capacidade de carga (`carga-somente-na-tela`, em
  // `derived-values.json`, registra a omissão). A saída unificada a imprime:
  // é o mesmo valor da tela, e a omissão era uma lacuna de feature, não regra.
  entradas.push(entry('load.carryingCapacityKg', 'Capacidade', derived.load?.carryingCapacityKg ?? null));
  return Object.freeze({
    ...block('inventory', 'Inventário', entradas),
    unavailableReason: envelope.available === true ? null : (envelope.reason ?? null),
  });
}

/**
 * Bloco de moedas.
 * @param {object} derived
 * @returns {Readonly<object>}
 */
function coinsBlock(derived) {
  const carteira = derived.wallet ?? {};
  const entradas = WALLET_ENTRIES.map(({ key, label }) => entry(`wallet.${key}`, label, carteira[key] ?? null));
  // Sem tabela de conversão o total é DESCONHECIDO (`ratesAvailable: false`),
  // nunca zero.
  entradas.push(entry('wallet.totalCopper', 'Total (PC)', carteira.totalCopper ?? null));
  return block('coins', 'Moedas', entradas);
}

/**
 * Bloco de detalhes pessoais (texto do jogador, eco de `data.identity`).
 * Campos vazios são OMITIDOS — imprimir sete rótulos vazios não ajuda ninguém.
 * @param {object} data
 * @returns {Readonly<object>}
 */
function personalBlock(data) {
  const identidade = data?.identity ?? {};
  const entradas = PERSONAL_PRINT_FIELDS.filter(({ field }) => typeof identidade[field] === 'string' && identidade[field].length > 0).map(
    ({ field, label }) => entry(`identity.${field}`, label, identidade[field]),
  );
  return block('personal', 'Detalhes', entradas);
}

/**
 * Monta o MODELO DE SAÍDA da ficha a partir do `SheetViewModel`.
 *
 * @param {object} viewModel - `SheetViewModel` (`sheet-view-model.js`).
 * @returns {import('../../core/result.js').Result} Result<{headline, blocks}, AppError>
 */
export function buildSheetOutputModel(viewModel) {
  if (viewModel === null || typeof viewModel !== 'object' || typeof viewModel.derived !== 'object' || viewModel.derived === null) {
    return err(outputError('SHEET_OUTPUT_VIEW_MODEL_INVALID', 'A saída da ficha exige um SheetViewModel com "derived".', {}));
  }
  const derived = viewModel.derived;
  const data = viewModel.data ?? {};
  const headline = derived.printable?.headline ?? null;
  if (headline === null || typeof headline !== 'object') {
    return err(
      outputError('SHEET_OUTPUT_PRINTABLE_MISSING', 'O ViewModel não traz "derived.printable.headline"; nada pode ser impresso.', {
        characterId: viewModel.characterId ?? null,
      }),
    );
  }

  const blocks = [
    combatBlock(derived),
    ...abilityBlocks(derived, data),
    skillsBlock(derived),
    ...sensesAndDefensesBlocks(derived),
    attacksBlock(derived),
    resourcesBlock(derived),
    spellSlotsBlock(derived),
    inventoryBlock(derived),
    coinsBlock(derived),
    personalBlock(data),
  ];

  return ok(
    Object.freeze({
      characterId: viewModel.characterId ?? null,
      headline: Object.freeze({
        name: typeof headline.name === 'string' && headline.name.length > 0 ? headline.name : 'Sem Nome',
        subtitle: buildSubtitle(headline),
      }),
      blocks: Object.freeze(blocks),
    }),
  );
}

/**
 * Índice `semantic -> valor bruto` de um modelo de saída. É o que o teste de
 * paridade compara entre tela, impressão e PDF sem precisar inferir texto de
 * bytes de PDF.
 * @param {object} outputModel
 * @returns {Readonly<Record<string, *>>}
 */
export function indexOutputValues(outputModel) {
  /** @type {Record<string, *>} */
  const indice = {};
  for (const bloco of outputModel?.blocks ?? []) {
    for (const entrada of bloco.entries ?? []) {
      indice[entrada.semantic] = entrada.value;
    }
  }
  return Object.freeze(indice);
}
