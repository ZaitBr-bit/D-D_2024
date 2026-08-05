// Seção `summary-combat` (Task 30): o RESUMO e o BLOCO DE COMBATE da ficha —
// cabeçalho, pontos de vida, dados de vida, testes de morte, atributos,
// salvaguardas, perícias, ataques, CA, iniciativa e deslocamento.
//
// ## O que esta seção é (e o que ela deliberadamente não é)
//
// Ela é um RENDERIZADOR DE PROJEÇÃO mais um TRADUTOR DE EVENTO. Nada mais:
//
//   - `select(viewModel)` recorta de `viewModel.derived`/`viewModel.data` a
//     fatia que a seção mostra. Não calcula NADA. Todo número de jogo já veio
//     pronto de `buildSheetViewModel` (que por sua vez delega às consultas de
//     `domain/character/queries/**`). Se um valor não existe em `derived`, ele
//     NÃO é recomputado aqui — é exibido como ausente. Recalcular regra dentro
//     do renderizador é exatamente o defeito do `sheet.js` legado que esta
//     refatoração existe para eliminar;
//   - `render(projection, uiState)` devolve markup (string), com todo texto
//     passando por `escapeHtml`/`escapeHtmlAttribute` (`ui/html.js`);
//   - `toIntent(event, ctx)` devolve uma `UiEventDecision`. A seção não chama
//     `preventDefault`, não registra listener, não abre modal e não recebe
//     repositório nem registro persistido — quem faz isso é o controller
//     (`sheet-controller.js`), uma vez só, na raiz.
//
// ## `data-action` É o tipo de comando canônico (anti-bypass silencioso)
//
// A decisão de projeto mais importante deste arquivo: o valor de `data-action`
// de todo controle é LITERALMENTE o `type` de um comando de
// `domain/commands/command-dispatcher.js`. A seção não tem tabela própria de
// tradução "nome de botão -> comando".
//
// A consequência é a que interessa: um `data-action` que o dispatcher não
// conhece NÃO vira um clique que não faz nada. Ele vira um comando com `type`
// desconhecido, e o dispatcher responde `COMMAND_TYPE_UNKNOWN` — um erro de
// validação DECLARADO, que a sessão propaga e o controller notifica. O "clique
// que silenciosamente não faz nada porque nenhum handler casa com o
// `data-action`" é o padrão de bug mais caro deste projeto, e aqui ele é
// estruturalmente impossível: não existe caminho entre "elemento clicado com
// `data-action`" e "nada acontece".
//
// `SUMMARY_COMBAT_COMMAND_TYPES` (abaixo) é a lista dos tipos que esta seção
// emite, e o teste focal a compara com as chaves reais do dispatcher — de modo
// que renomear um comando no domínio quebra o teste em vez de apagar um botão
// da ficha em silêncio.
//
// ## Testes de morte: exibidos, não editáveis (lacuna DECLARADA)
//
// `state.deathSaves` é LIDO e mostrado, mas não há controle para marcar um
// sucesso/falha: o vocabulário de comandos da Task 17 tem quem ZERE os testes
// de morte (`apply-healing`, `spend-hit-die`, `long-rest`) e não tem quem os
// REGISTRE. Desenhar um botão sem comando por trás seria precisamente o bypass
// descrito acima, então o marcador é apresentado como leitura e a lacuna está
// registrada no relatório da Task 30 — não disfarçada de recurso funcional.

import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';
import { createUiEventDecision, NO_UI_EVENT_DECISION } from '../../../ui/event-delegation.js';
import { ABILITY_KEYS } from '../../../domain/character/queries/index.js';
import { SHEET_INTENT_TYPES, createSheetIntent } from '../sheet-state.js';
import { createSheetSection } from './section-registry.js';

/** Id canônico desta seção (uma das sete de `SHEET_SECTION_IDS`). */
export const SUMMARY_COMBAT_SECTION_ID = 'summary-combat';

/**
 * Tipos de comando canônico que esta seção emite, na ordem em que aparecem no
 * markup. Cada um é o valor literal de um `data-action`.
 *
 * A lista é EXPORTADA para que o teste focal a confronte com o vocabulário do
 * dispatcher (`domain/commands/command-dispatcher.js`): se um tipo sumir ou
 * mudar de nome no domínio, o teste falha aqui, em vez de a ficha passar a
 * emitir um comando que ninguém atende.
 * @type {ReadonlyArray<string>}
 */
export const SUMMARY_COMBAT_COMMAND_TYPES = Object.freeze([
  'apply-damage',
  'apply-healing',
  'grant-temporary-hp',
  'spend-hit-die',
  'short-rest',
  'long-rest',
  'edit-character-field',
  'revert-character-edit',
]);

/**
 * Comandos desta seção que consomem a quantidade digitada no campo único de
 * PV (`data-sheet-amount`). Os demais não têm parâmetro numérico.
 * @type {ReadonlyArray<string>}
 */
const AMOUNT_COMMAND_TYPES = Object.freeze(['apply-damage', 'apply-healing', 'grant-temporary-hp']);

/**
 * Comandos que consomem o MESMO campo, mas sob o nome de parâmetro
 * `healAmount` — hoje só `spend-hit-die`.
 *
 * Achado do CUTOVER (Task 33): o botão "Gastar dado de vida" estava MORTO. Ele
 * não constava de `AMOUNT_COMMAND_TYPES` (que emite `amount`) e o comando
 * canônico exige `healAmount` (`domain/commands/hit-points.js:218` — a ficha
 * não rola dado pelo jogador, o valor rolado é informado). O clique sempre
 * caía na recusa `"healAmount" deve ser um inteiro >= 0`, num toast com texto
 * de validação interna. Nenhum teste via: os focais da seção montavam o
 * comando com o parâmetro correto à mão.
 * @type {ReadonlyArray<string>}
 */
const HEAL_AMOUNT_COMMAND_TYPES = Object.freeze(['spend-hit-die']);

/**
 * Comandos desta seção que operam sobre um path de edição manual
 * (`data-sheet-path`), hoje só o override de PV máximo.
 * @type {ReadonlyArray<string>}
 */
const PATH_COMMAND_TYPES = Object.freeze(['edit-character-field', 'revert-character-edit']);

/** Rótulos de exibição dos seis atributos, na ordem canônica de `ABILITY_KEYS`. */
const ABILITY_LABELS = Object.freeze({
  forca: 'Força',
  destreza: 'Destreza',
  constituicao: 'Constituição',
  inteligencia: 'Inteligência',
  sabedoria: 'Sabedoria',
  carisma: 'Carisma',
});

/**
 * Formata um número com sinal explícito (o formato que a ficha usa para
 * modificadores e bônus). Ausência (`null`/`undefined`) vira "—" — NUNCA um
 * zero plausível, que afirmaria "o bônus é zero" quando o valor é
 * desconhecido.
 * @param {*} value
 * @returns {string}
 */
function signed(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return value >= 0 ? `+${value}` : String(value);
}

/**
 * Formata um valor simples para exibição, marcando a ausência de forma
 * distinguível de zero.
 * @param {*} value
 * @returns {string}
 */
function plain(value) {
  return value === null || value === undefined ? '—' : String(value);
}

/**
 * Recorta do ViewModel a projeção desta seção.
 *
 * Função PURA e sem cálculo: cada campo é uma leitura direta de
 * `viewModel.derived` (valores já calculados pelo domínio) ou de
 * `viewModel.data` (eco dos campos do personagem). Um ViewModel ausente
 * (ficha em modo somente-leitura, ou ainda carregando) produz uma projeção
 * `available: false` — que o `render` apresenta explicitamente, em vez de uma
 * seção vazia que pareceria "personagem sem nada".
 *
 * @param {object|null} viewModel
 * @returns {Readonly<object>}
 */
export function selectSummaryCombat(viewModel) {
  if (viewModel === null || typeof viewModel !== 'object') {
    return Object.freeze({ available: false });
  }
  const derived = viewModel.derived ?? {};
  const data = viewModel.data ?? {};
  const printable = derived.printable ?? {};

  return Object.freeze({
    available: true,
    headline: Object.freeze({ ...(printable.headline ?? {}) }),
    hitPoints: Object.freeze({ ...(derived.hitPoints ?? {}) }),
    armorClass: derived.armorClass ?? null,
    initiative: derived.initiative ?? null,
    movement: Object.freeze({ ...(derived.movement ?? {}) }),
    proficiencyBonus: derived.proficiencyBonus ?? null,
    abilities: Object.freeze({ ...(derived.abilities ?? {}) }),
    savingThrows: Object.freeze({ ...(derived.savingThrows ?? {}) }),
    skills: Object.freeze({ ...(derived.skills ?? {}) }),
    attacks: Object.freeze([...(derived.attacks ?? [])]),
    // Eco literal do estado: quantos testes de morte já foram marcados. Não é
    // derivado (não há conta nenhuma), então vem de `data`, não de `derived`.
    deathSaves: Object.freeze({ ...(data.state?.deathSaves ?? {}) }),
    // Override manual ATIVO de PV máximo, se houver. É o que permite ao render
    // oferecer "reverter" apenas quando existe algo a reverter.
    maximumHitPointsOverride: data.overrides?.['hp.maximum'] ?? null,
  });
}

/**
 * Markup das caixas de estatística de combate (CA, iniciativa, deslocamento,
 * bônus de proficiência). Todas são LEITURA — nenhuma delas é editável por
 * esta seção.
 * @param {object} projection
 * @returns {string}
 */
function renderStatBoxes(projection) {
  const caixas = [
    ['armor-class', 'CA', plain(projection.armorClass)],
    ['initiative', 'Iniciativa', signed(projection.initiative)],
    ['speed', 'Deslocamento', plain(projection.movement.effective)],
    ['proficiency-bonus', 'Proficiência', signed(projection.proficiencyBonus)],
  ];
  return (
    '<ul class="sheet-stat-boxes" data-sheet-stat-boxes>' +
    caixas
      .map(
        ([slug, rotulo, valor]) =>
          `<li data-sheet-stat="${escapeHtmlAttribute(slug)}">` +
          `<span class="sheet-stat-label">${escapeHtml(rotulo)}</span>` +
          `<span class="sheet-stat-value">${escapeHtml(valor)}</span>` +
          '</li>',
      )
      .join('') +
    '</ul>'
  );
}

/**
 * Markup do bloco de pontos de vida: valores, o campo único de quantidade e os
 * controles de dano/cura/PV temporário/dado de vida/descansos.
 * @param {object} projection
 * @returns {string}
 */
function renderHitPoints(projection) {
  const hp = projection.hitPoints;
  const botao = (tipo, rotulo) =>
    `<button type="button" data-action="${escapeHtmlAttribute(tipo)}">${escapeHtml(rotulo)}</button>`;

  return (
    '<div class="sheet-hit-points" data-sheet-hit-points>' +
    `<p data-sheet-hp-current>${escapeHtml(plain(hp.current))}</p>` +
    `<p data-sheet-hp-maximum>${escapeHtml(plain(hp.maximum))}</p>` +
    `<p data-sheet-hp-temporary>${escapeHtml(plain(hp.temporary))}</p>` +
    `<p data-sheet-hit-dice>${escapeHtml(plain(hp.hitDiceRemaining))}/${escapeHtml(plain(hp.hitDiceTotal))}</p>` +
    // Campo ÚNICO de quantidade, compartilhado pelos três comandos que pedem
    // um número. Um campo por botão multiplicaria estado de tela sem
    // necessidade e tornaria o rerender parcial mais frágil.
    '<input type="number" min="0" step="1" data-sheet-amount value="1">' +
    botao('apply-damage', 'Aplicar dano') +
    botao('apply-healing', 'Curar') +
    botao('grant-temporary-hp', 'PV temporário') +
    botao('spend-hit-die', 'Gastar dado de vida') +
    botao('short-rest', 'Descanso curto') +
    botao('long-rest', 'Descanso longo') +
    '</div>'
  );
}

/**
 * Markup do marcador de testes de morte. LEITURA apenas — ver o cabeçalho
 * deste módulo sobre a lacuna declarada de comando.
 * @param {object} projection
 * @returns {string}
 */
function renderDeathSaves(projection) {
  const saves = projection.deathSaves;
  return (
    '<div class="sheet-death-saves" data-sheet-death-saves>' +
    `<span data-sheet-death-successes>${escapeHtml(plain(saves.successes))}</span>` +
    `<span data-sheet-death-failures>${escapeHtml(plain(saves.failures))}</span>` +
    '</div>'
  );
}

/**
 * Markup da edição manual permitida nesta seção: o override de PV máximo. O
 * botão de reverter só é emitido quando existe override ativo — oferecer
 * "reverter" sem edição ativa seria um controle que não faz nada.
 * @param {object} projection
 * @returns {string}
 */
function renderAllowedEdit(projection) {
  const override = projection.maximumHitPointsOverride;
  const reverter =
    override === null || override === undefined
      ? ''
      : '<button type="button" data-action="revert-character-edit" data-sheet-path="hp.maximum">Reverter PV máximo</button>';
  return (
    '<div class="sheet-allowed-edit" data-sheet-allowed-edit>' +
    `<input type="number" step="1" data-sheet-edit-value="hp.maximum" value="${escapeHtmlAttribute(
      plain(override?.value ?? projection.hitPoints.maximum),
    )}">` +
    '<button type="button" data-action="edit-character-field" data-sheet-path="hp.maximum">Editar PV máximo</button>' +
    reverter +
    '</div>'
  );
}

/**
 * Markup dos atributos e das salvaguardas correspondentes.
 * @param {object} projection
 * @returns {string}
 */
function renderAbilities(projection) {
  return (
    '<ul class="sheet-abilities" data-sheet-abilities>' +
    ABILITY_KEYS.map((key) => {
      const modificador = projection.abilities[key]?.modifier ?? null;
      const salvaguarda = projection.savingThrows[key] ?? {};
      return (
        `<li data-sheet-ability="${escapeHtmlAttribute(key)}">` +
        `<span class="sheet-ability-label">${escapeHtml(ABILITY_LABELS[key] ?? key)}</span>` +
        `<span data-sheet-ability-modifier>${escapeHtml(signed(modificador))}</span>` +
        `<span data-sheet-saving-throw="${escapeHtmlAttribute(key)}" ` +
        `data-proficient="${salvaguarda.proficient === true ? 'true' : 'false'}">${escapeHtml(signed(salvaguarda.bonus))}</span>` +
        '</li>'
      );
    }).join('') +
    '</ul>'
  );
}

/**
 * Markup das perícias, na ordem em que o ViewModel as projeta (que é a ordem
 * do catálogo — a seção não reordena nem filtra).
 * @param {object} projection
 * @returns {string}
 */
function renderSkills(projection) {
  const entradas = Object.entries(projection.skills);
  if (entradas.length === 0) {
    return '<p class="sheet-empty" data-sheet-skills-empty>Nenhuma perícia projetada.</p>';
  }
  return (
    '<ul class="sheet-skills" data-sheet-skills>' +
    entradas
      .map(
        ([skillId, skill]) =>
          `<li data-sheet-skill="${escapeHtmlAttribute(skillId)}" ` +
          `data-proficient="${skill.proficient === true ? 'true' : 'false'}" ` +
          `data-expert="${skill.expert === true ? 'true' : 'false'}">` +
          `<span data-sheet-skill-bonus>${escapeHtml(signed(skill.bonus))}</span>` +
          `<span data-sheet-skill-passive>${escapeHtml(plain(skill.passive))}</span>` +
          '</li>',
      )
      .join('') +
    '</ul>'
  );
}

/**
 * Markup dos ataques. Toda arma do inventário vira uma entrada, equipada ou
 * não (paridade com o oráculo legado, restaurada na revisão da Task 29); o
 * estado `equipped` viaja como atributo para a apresentação distinguir as
 * duas.
 * @param {object} projection
 * @returns {string}
 */
function renderAttacks(projection) {
  if (projection.attacks.length === 0) {
    return '<p class="sheet-empty" data-sheet-attacks-empty>Nenhum ataque projetado.</p>';
  }
  return (
    '<ul class="sheet-attacks" data-sheet-attacks>' +
    projection.attacks
      .map(
        (attack) =>
          `<li data-sheet-attack="${escapeHtmlAttribute(attack.instanceId ?? '')}" ` +
          `data-equipped="${attack.equipped === true ? 'true' : 'false'}">` +
          `<span data-sheet-attack-name>${escapeHtml(attack.name ?? '')}</span>` +
          `<span data-sheet-attack-bonus>${escapeHtml(signed(attack.attackBonus))}</span>` +
          `<span data-sheet-attack-damage>${escapeHtml(plain(attack.damageDice))}${escapeHtml(
            Number.isFinite(attack.damageBonus) && attack.damageBonus !== 0 ? signed(attack.damageBonus) : '',
          )}</span>` +
          '</li>',
      )
      .join('') +
    '</ul>'
  );
}

/**
 * Renderiza o miolo da seção.
 *
 * @param {object} projection - saída de `selectSummaryCombat`.
 * @param {object} [uiState] - estado de tela (não usado hoje; a seção não tem
 *   estado próprio, e recebê-lo é parte do contrato do registro).
 * @returns {string}
 */
export function renderSummaryCombat(projection, uiState = {}) {
  void uiState;
  if (projection === null || typeof projection !== 'object' || projection.available !== true) {
    return '<p class="sheet-empty" data-sheet-summary-unavailable>Resumo indisponível: a ficha não tem projeção canônica.</p>';
  }

  const headline = projection.headline;
  return (
    '<div class="sheet-summary" data-sheet-summary>' +
    `<h3 data-sheet-character-name>${escapeHtml(headline.name ?? '')}</h3>` +
    `<p data-sheet-headline>${escapeHtml(plain(headline.speciesName))} ${escapeHtml(plain(headline.className))}` +
    ` &middot; Nível ${escapeHtml(plain(headline.level))}</p>` +
    renderStatBoxes(projection) +
    renderHitPoints(projection) +
    renderDeathSaves(projection) +
    renderAllowedEdit(projection) +
    renderAbilities(projection) +
    renderSkills(projection) +
    renderAttacks(projection) +
    '</div>'
  );
}

/**
 * Lê um inteiro >= 0 de um campo do DOM. Devolve `null` quando o campo não
 * existe ou não contém um inteiro — e `null` faz o comando ser emitido SEM
 * `amount`, de modo que a validação (`COMMAND_HP_AMOUNT_INVALID`) aconteça no
 * domínio, num único lugar, em vez de a seção inventar um "1" de conveniência.
 * @param {object|null} element
 * @returns {number|null}
 */
function readIntegerValue(element) {
  if (element === null || element === undefined) {
    return null;
  }
  const bruto = typeof element.value === 'string' ? element.value.trim() : '';
  if (bruto === '' || !/^-?\d+$/.test(bruto)) {
    return null;
  }
  return Number.parseInt(bruto, 10);
}

/**
 * Traduz um evento em `UiEventDecision`.
 *
 * Só reage a cliques em elementos com `data-action`. O valor do atributo é o
 * `type` do comando canônico — sem tabela de tradução intermediária, e sem
 * "ação desconhecida vira no-op": um `data-action` fora do vocabulário do
 * dispatcher produz um comando que o dispatcher recusa com
 * `COMMAND_TYPE_UNKNOWN`.
 *
 * @param {object} event
 * @param {{root: object, projection: object, uiState: object}} context
 * @returns {Readonly<object>} UiEventDecision
 */
export function summaryCombatToIntent(event, context = {}) {
  if (event?.type !== 'click') {
    return NO_UI_EVENT_DECISION;
  }
  const target = event.target;
  const acionado = typeof target?.closest === 'function' ? target.closest('[data-action]') : null;
  if (acionado === null || acionado === undefined) {
    return NO_UI_EVENT_DECISION;
  }
  const type = acionado.getAttribute('data-action');
  if (typeof type !== 'string' || type.length === 0) {
    return NO_UI_EVENT_DECISION;
  }

  // ESCOPO por seção, e não pela raiz: com duas fichas montadas na mesma
  // página, ler o campo de quantidade a partir de `root` pegaria o da outra
  // ficha. O contêiner da seção é a menor fronteira que contém os dois.
  const escopo =
    typeof acionado.closest === 'function'
      ? acionado.closest(`[data-sheet-section="${SUMMARY_COMBAT_SECTION_ID}"]`) ?? context.root ?? null
      : context.root ?? null;

  /** @type {Record<string, *>} */
  const command = { type };

  if (AMOUNT_COMMAND_TYPES.includes(type) || HEAL_AMOUNT_COMMAND_TYPES.includes(type)) {
    const campo = escopo === null || typeof escopo.querySelector !== 'function' ? null : escopo.querySelector('[data-sheet-amount]');
    const amount = readIntegerValue(campo);
    if (amount !== null) {
      // O NOME do parâmetro é o que o comando canônico declara; a seção não
      // renomeia parâmetro de domínio.
      command[HEAL_AMOUNT_COMMAND_TYPES.includes(type) ? 'healAmount' : 'amount'] = amount;
    }
  }

  if (PATH_COMMAND_TYPES.includes(type)) {
    const path = acionado.getAttribute('data-sheet-path');
    // O path viaja SEMPRE, mesmo ausente/vazio: o comando é recusado por
    // `COMMAND_EDIT_PATH_NOT_ALLOWED` (erro declarado), nunca engolido aqui.
    command.path = typeof path === 'string' ? path : null;
    if (type === 'edit-character-field') {
      const campo =
        escopo === null || typeof escopo.querySelector !== 'function'
          ? null
          : escopo.querySelector(`[data-sheet-edit-value="${path}"]`);
      const value = readIntegerValue(campo);
      if (value !== null) {
        command.value = value;
      }
    }
  }

  return createUiEventDecision({
    intent: createSheetIntent(SHEET_INTENT_TYPES.command, { command }),
    preventDefault: true,
  });
}

/**
 * Cria a seção `summary-combat` validada pelo registro.
 * @returns {import('../../../core/result.js').Result} Result<Section, AppError>
 */
export function createSummaryCombatSection() {
  return createSheetSection({
    id: SUMMARY_COMBAT_SECTION_ID,
    select: selectSummaryCombat,
    render: renderSummaryCombat,
    toIntent: summaryCombatToIntent,
    eventTypes: ['click'],
  });
}
