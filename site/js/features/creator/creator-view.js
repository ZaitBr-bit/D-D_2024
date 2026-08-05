// Módulo `features/creator/creator-view`: a projeção PURA do snapshot em
// markup do wizard (a barra de passos e o slot de conteúdo).
//
// Nada aqui toca o DOM: a função devolve string e o controller decide como
// inseri-la. Isso mantém a apresentação testável sem navegador e impede que a
// view crie listeners próprios.
//
// ## Escape
//
// Todo valor que possa vir do CATÁLOGO (rótulo de passo, título, mensagem de
// erro) passa por `escapeHtml`/`escapeHtmlAttribute` antes de entrar na
// string. Os rótulos de hoje são literais nossos, mas o caminho já é o seguro:
// quando as Tasks 26-28 trocarem os rótulos por nomes de classe/espécie vindos
// do JSON, não há um "só desta vez" a corrigir.

import { escapeHtml, escapeHtmlAttribute } from '../../ui/html.js';
import { CREATOR_STEP_IDS } from './creator-state.js';

/**
 * Rótulos exibidos na barra de passos. Iguais aos do wizard legado.
 * @type {Readonly<Record<string, string>>}
 */
export const CREATOR_STEP_LABELS = Object.freeze({
  classe: 'Classe',
  especie: 'Espécie',
  antecedente: 'Antecedente',
  atributos: 'Atributos',
  equipamento: 'Equipamento',
  magias: 'Magias',
  detalhes: 'Detalhes',
});

/**
 * Atributo `data-*` com o qual o harness (e os testes E2E) identificam QUAL
 * implementação do criador está montada no DOM.
 * @type {string}
 */
export const CREATOR_MODULE_MARKER = 'data-creator-module';

/**
 * Renderiza a barra de passos.
 * @param {object} snapshot
 * @returns {string}
 */
export function renderStepBar(snapshot) {
  const visited = new Set(snapshot.visitedStepIds);
  const currentIndex = CREATOR_STEP_IDS.indexOf(snapshot.currentStepId);
  const items = CREATOR_STEP_IDS.map((stepId, index) => {
    const classes = ['wizard-step'];
    if (stepId === snapshot.currentStepId) {
      classes.push('active');
    }
    if (index < currentIndex && visited.has(stepId)) {
      classes.push('done');
    }
    const label = escapeHtml(CREATOR_STEP_LABELS[stepId] ?? stepId);
    return (
      `<div class="${escapeHtmlAttribute(classes.join(' '))}" data-step="${escapeHtmlAttribute(stepId)}" ` +
      `data-step-index="${escapeHtmlAttribute(String(index))}">` +
      `<div class="wizard-step-num">${escapeHtml(String(index + 1))}</div>` +
      `<div class="wizard-step-label">${label}</div>` +
      '</div>'
    );
  }).join('');
  return `<div class="wizard-steps wizard-steps-sticky">${items}</div>`;
}

/**
 * Renderiza o shell do wizard em torno do markup já produzido pelo passo
 * ativo. `stepMarkup` é a string devolvida por `step.render(context)` — que,
 * por contrato, já escapou tudo que veio de conteúdo.
 *
 * @param {object} snapshot
 * @param {string} stepMarkup
 * @param {{moduleName?: string}} [options]
 * @returns {string}
 */
export function renderCreatorShell(snapshot, stepMarkup, { moduleName = 'features/creator' } = {}) {
  const currentIndex = CREATOR_STEP_IDS.indexOf(snapshot.currentStepId);
  const isLast = currentIndex === CREATOR_STEP_IDS.length - 1;
  const errorBlock =
    snapshot.error === null || snapshot.error === undefined
      ? ''
      : `<div class="info-box erro" data-creator-error="${escapeHtmlAttribute(String(snapshot.error.code ?? ''))}">${escapeHtml(
          String(snapshot.error.message ?? ''),
        )}</div>`;

  return (
    `<div ${CREATOR_MODULE_MARKER}="${escapeHtmlAttribute(moduleName)}" ` +
    `data-creator-step="${escapeHtmlAttribute(snapshot.currentStepId)}" ` +
    `data-creator-status="${escapeHtmlAttribute(String(snapshot.status))}" ` +
    `data-creator-generation="${escapeHtmlAttribute(String(snapshot.generation))}">` +
    renderStepBar(snapshot) +
    errorBlock +
    `<div id="wizard-content" data-creator-content="true">${typeof stepMarkup === 'string' ? stepMarkup : ''}</div>` +
    '<div class="wizard-nav">' +
    `<button class="btn btn-secondary" data-creator-nav="previous"${currentIndex === 0 ? ' disabled' : ''}>Voltar</button>` +
    `<span class="wizard-progress">${escapeHtml(String(currentIndex + 1))} de ${escapeHtml(String(CREATOR_STEP_IDS.length))}</span>` +
    `<button class="btn btn-primary" data-creator-nav="${isLast ? 'finalize' : 'next'}">${isLast ? 'Finalizar' : 'Continuar'}</button>` +
    '</div>' +
    '</div>'
  );
}
