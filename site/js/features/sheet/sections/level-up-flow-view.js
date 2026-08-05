// Módulo `features/sheet/sections/level-up-flow-view` (Task 30): a VISTA do
// fluxo de subir de nível, nos seus DOIS modos.
//
// ## Um fluxo, dois modos, os MESMOS comandos canônicos
//
// A feature flag `feature.levelup.flow.v2` (chave de localStorage exportada
// por `infra/preferences/local-storage-preferences-repository.js` como
// `LEVELUP_FLOW_V2_KEY`, resolvida por `resolveLevelUpFlowV2` e publicada no
// snapshot da sessão como `preferences.levelUpFlowV2`) escolhe QUAL vista é
// desenhada:
//
//   - `true`  -> o fluxo em CARDS, que projeta `getLevelUpOptions` (Task 23) em
//     um cartão por decisão (PV do nível, subclasse, ASI/talento);
//   - `false` -> o fluxo LEGADO COMPATÍVEL: o aviso "Level Up V2 desativado",
//     com a chave local citada e o botão que religa a flag e continua.
//
// Os dois modos terminam no MESMO comando canônico (`level-up`, roteado por
// `domain/commands/command-dispatcher.js` para `domain/progression/level-up.js`).
// Não existe um segundo caminho de mutação: o modo legado religa a flag e cai
// no modo em cards, e é o modo em cards que confirma. Isso é o que torna a
// Task 37 capaz de remover os ARQUIVOS legados (`site/js/levelup*.js`) sem
// remover o MODO `false` — que não é código legado, é uma vista desta seção.
//
// ## Por que o modo `false` é comparado por DOM, e não só "executado"
//
// O brief da Task 37 proíbe explicitamente remover o legado com base em "a
// suíte E2E não travou". Por isso o modo `false` tem um ORÁCULO: a variante
// `levelup-flow-v2-false` de `tests/fixtures/dom-baseline/sheet-sections.json`,
// capturada da ficha REAL no commit-baseline `e43c5ea` com a flag semeada como
// `"false"` (ver o comentário correspondente em `tests/e2e/dom-baseline.spec.js`;
// aquela captura nunca tinha sido feita na Task 3 porque a flag ainda não era
// um conceito do plano). `tests/unit/sheet/level-up-flow-view.test.js` monta o
// `#modal-container` com o markup real de `site/index.html`, injeta o que este
// módulo devolve, normaliza com as MESMAS regras do capturador e compara com a
// variante. Uma divergência estrutural quebra o teste.
//
// Consequência prática para quem editar este arquivo: no modo `false`, tag,
// classe, texto e ordem são CONTRATO. Os únicos atributos que este módulo pode
// acrescentar ali são `data-action` (a denylist do normalizador o remove, por
// ser exatamente o ponto em que a arquitetura nova difere do `onclick` inline
// do baseline) — qualquer outro atributo apareceria na captura e quebraria a
// comparação.
//
// ## Este módulo não abre modal, não lê preferência e não muta nada
//
// Ele devolve STRINGS de markup e descreve intenções. Quem abre o modal é o
// controller (`sheet-controller.js`); quem lê a preferência é a sessão; quem
// muta o personagem é o comando canônico.

import { escapeHtml, escapeHtmlAttribute } from '../../../ui/html.js';

/**
 * `modalId` do fluxo de level-up. É o mesmo nos dois modos: abrir o fluxo é
 * uma coisa só, e o modo é uma decisão de RENDERIZAÇÃO, não uma segunda
 * identidade de modal.
 * @type {string}
 */
export const LEVEL_UP_MODAL_ID = 'sheet/level-up';

/**
 * Chave de localStorage da flag. Repetida aqui como CONSTANTE DE APRESENTAÇÃO
 * porque o modo legado a EXIBE ao jogador (é o texto "Chave local: ..." do
 * oráculo), não porque este módulo leia storage — ele não lê. O teste focal
 * amarra este literal ao `LEVELUP_FLOW_V2_KEY` do repositório de preferências.
 * @type {string}
 */
export const LEVELUP_FLOW_V2_KEY_LABEL = 'feature.levelup.flow.v2';

/**
 * Título do modal em cada modo. No modo legado o título é CONTRATO de DOM
 * (`h2#modal-titulo` do oráculo).
 * @type {Readonly<Record<string, string>>}
 */
export const LEVEL_UP_TITLES = Object.freeze({
  v2: 'Subir de Nível',
  legacy: 'Level Up V2 desativado',
});

/**
 * `data-action` emitidos pelo fluxo. `enable-level-up-v2` e `close` NÃO são
 * comandos canônicos: o primeiro é preferência (religar a flag), o segundo é
 * fechamento de modal. Eles são traduzidos pelo `toIntent` da seção dona
 * (`feats-progression-section.js`) para `sheet/ui-state` e `sheet/modal-close`
 * — nunca para um comando que o dispatcher não conhece.
 * @type {Readonly<Record<string, string>>}
 */
export const LEVEL_UP_FLOW_ACTIONS = Object.freeze({
  close: 'level-up-close',
  enableV2: 'level-up-enable-v2',
  confirm: 'level-up',
});

/**
 * Markup do CORPO do modal no modo legado (flag `false`).
 *
 * Reproduz, nó a nó, a variante `levelup-flow-v2-false` do oráculo: um `div`
 * externo com dois `div` filhos; o primeiro com o texto quebrado por um
 * `<strong>`, o segundo com a chave local dentro de um `<code>`. Nenhuma
 * classe, nenhum id, nenhum atributo além dos que o normalizador descarta.
 * @returns {string}
 */
export function renderLegacyLevelUpContent() {
  return (
    '<div>' +
    `<div>O fluxo de <strong>Level Up V2</strong> está desativado pela feature flag de migração.</div>` +
    `<div>Chave local: <code>${escapeHtml(LEVELUP_FLOW_V2_KEY_LABEL)}</code></div>` +
    '</div>'
  );
}

/**
 * Markup das AÇÕES do modal no modo legado.
 *
 * O baseline emite os dois botões com `onclick` inline; aqui eles carregam
 * `data-action` (que o normalizador do oráculo remove, junto com o `onclick`
 * do baseline — é por isso que os dois markups são comparáveis). Classes,
 * ordem, id e texto são idênticos.
 * @returns {string}
 */
export function renderLegacyLevelUpActions() {
  return (
    `<button class="btn btn-secondary" data-action="${escapeHtmlAttribute(LEVEL_UP_FLOW_ACTIONS.close)}">Cancelar</button>` +
    `<button class="btn btn-accent" id="btn-enable-levelup-v2" data-action="${escapeHtmlAttribute(
      LEVEL_UP_FLOW_ACTIONS.enableV2,
    )}">Ativar V2 e continuar</button>`
  );
}

/**
 * Um cartão do fluxo v2.
 * @param {string} slug
 * @param {string} titulo
 * @param {string} corpo
 * @returns {string}
 */
function card(slug, titulo, corpo) {
  return (
    `<section class="levelup-card" data-levelup-card="${escapeHtmlAttribute(slug)}">` +
    `<h4>${escapeHtml(titulo)}</h4>` +
    corpo +
    '</section>'
  );
}

/**
 * Markup do CORPO do modal no modo v2 (fluxo em cards).
 *
 * Um cartão por DECISÃO que `getLevelUpOptions` declara necessária. Nada é
 * inferido: se a projeção não diz que o nível exige subclasse, o cartão de
 * subclasse não existe; se ela não traz o dado de vida, o cartão de PV mostra
 * a ausência em vez de um "d8" plausível.
 *
 * @param {object|null} options - projeção de `getLevelUpOptions` (Task 23), ou
 *   `null` quando ela não pôde ser derivada.
 * @param {object|null} [error] - `AppError` da projeção, quando houver.
 * @returns {string}
 */
export function renderLevelUpCards(options, error = null) {
  if (options === null || typeof options !== 'object') {
    const codigo = error?.code ?? 'LEVEL_UP_OPTIONS_UNAVAILABLE';
    const mensagem = error?.message ?? 'As opções de nível não puderam ser derivadas do catálogo.';
    return (
      `<div class="levelup-cards" data-levelup-cards data-levelup-error="${escapeHtmlAttribute(codigo)}">` +
      `<p>${escapeHtml(mensagem)}</p>` +
      '</div>'
    );
  }

  const cartoes = [];

  cartoes.push(
    card(
      'hit-points',
      'Pontos de Vida',
      `<p data-levelup-hit-die>${escapeHtml(options.hitPoints?.die ?? '—')}</p>` +
        `<p data-levelup-hit-average>${escapeHtml(options.hitPoints?.average ?? '—')}</p>` +
        '<input type="number" step="1" data-levelup-hit-points>',
    ),
  );

  if (options.requiresSubclass === true) {
    cartoes.push(card('subclass', 'Subclasse', '<input type="text" data-levelup-subclass>'));
  }
  if (options.requiresAbilityScoreImprovement === true) {
    cartoes.push(
      card(
        'ability-score-improvement',
        'Aumento no Valor de Atributo ou Talento',
        '<input type="text" data-levelup-asi>',
      ),
    );
  }
  if (options.requiresEpicBoon === true) {
    cartoes.push(card('epic-boon', 'Dádiva Épica', '<input type="text" data-levelup-epic-boon>'));
  }

  const caracteristicas = Array.isArray(options.featuresGained) ? options.featuresGained : [];
  cartoes.push(
    card(
      'features',
      'Características do nível',
      '<ul data-levelup-features>' +
        caracteristicas
          .map((feature) => {
            const id = typeof feature === 'string' ? feature : (feature?.id ?? '');
            const nome = typeof feature === 'string' ? feature : (feature?.name ?? id);
            return `<li data-levelup-feature="${escapeHtmlAttribute(id)}">${escapeHtml(nome)}</li>`;
          })
          .join('') +
        '</ul>',
    ),
  );

  return (
    '<div class="levelup-cards" data-levelup-cards ' +
    `data-levelup-from="${escapeHtmlAttribute(options.fromLevel ?? '')}" ` +
    `data-levelup-to="${escapeHtmlAttribute(options.toLevel ?? '')}">` +
    cartoes.join('') +
    '</div>'
  );
}

/**
 * Markup das AÇÕES do modal no modo v2.
 * @returns {string}
 */
export function renderLevelUpCardsActions() {
  return (
    `<button class="btn btn-secondary" data-action="${escapeHtmlAttribute(LEVEL_UP_FLOW_ACTIONS.close)}">Cancelar</button>` +
    `<button class="btn btn-accent" data-action="${escapeHtmlAttribute(LEVEL_UP_FLOW_ACTIONS.confirm)}">Confirmar nível</button>`
  );
}

/**
 * Descreve o modal do fluxo de level-up no modo correspondente à flag.
 *
 * Devolve `{modalId, title, content, actions, mode}` — uma DESCRIÇÃO, não um
 * modal aberto. Quem abre é o controller, a partir da intenção
 * `sheet/modal-open` que a seção dona produz.
 *
 * @param {{levelUpFlowV2: boolean, options?: object|null, error?: object|null}} params
 * @returns {Readonly<{modalId: string, mode: string, title: string, content: string, actions: string}>}
 */
export function describeLevelUpModal({ levelUpFlowV2, options = null, error = null } = {}) {
  if (levelUpFlowV2 !== true) {
    return Object.freeze({
      modalId: LEVEL_UP_MODAL_ID,
      mode: 'legacy',
      title: LEVEL_UP_TITLES.legacy,
      content: renderLegacyLevelUpContent(),
      actions: renderLegacyLevelUpActions(),
    });
  }
  return Object.freeze({
    modalId: LEVEL_UP_MODAL_ID,
    mode: 'v2',
    title: LEVEL_UP_TITLES.v2,
    content: renderLevelUpCards(options, error),
    actions: renderLevelUpCardsActions(),
  });
}
