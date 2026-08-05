// Teste focal de `features/sheet/sections/resources-features-section.js`
// (Task 30) — o item mais arriscado do brief.
//
// ## A garantia central: cobertura EXAUSTIVA, não amostra
//
// O checklist item 3 é literal: "toda ação registrada no catálogo, não uma
// amostra". Aqui isso é levado ao pé da letra, contra o catálogo REAL
// (`dados/pacotes/dnd2024/**`) e o composition root REAL:
//
//   1. os `handlerId` de classe saem de
//      `tests/helpers/declared-official-handlers.js` — a MESMA função que
//      `tests/contract/official-handler-coverage.test.js` usa. As duas
//      coberturas (handler registrado / interface) não podem divergir porque
//      não existe uma segunda varredura;
//   2. para CADA um dos doze handlers, um personagem daquela classe é montado e
//      projetado, e `projection.actions` dá a lista COMPLETA de ações daquele
//      handler (é a única fonte que já respeita subclasse e nível);
//   3. o markup renderizado precisa ter um elemento carregando CADA `actionId`;
//   4. disparar CADA um deles pelo `toIntent` + dispatcher REAL precisa devolver
//      `ok: true` OU um erro de validação DECLARADO. Especificamente: nunca
//      `COMMAND_TYPE_UNKNOWN` e nunca `HANDLER_ACTION_UNKNOWN` — os dois códigos
//      que significam "esse clique não casou com handler nenhum".
//
// O bug que isto torna impossível é o "bypass silencioso": um `data-action` no
// markup sem nada do outro lado, que produz um clique inerte, sem erro, sem log
// e sem teste vermelho.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { createTestDom } from '../../helpers/test-dom.js';
import { createDiskFetch } from '../../helpers/disk-fetch.js';
import { collectDeclaredClassHandlers } from '../../helpers/declared-official-handlers.js';
import { createAppContext } from '../../../site/js/app-context.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';
import { buildSheetViewModel } from '../../../site/js/features/sheet/sheet-view-model.js';
import { SHEET_INTENT_TYPES } from '../../../site/js/features/sheet/sheet-state.js';
import {
  CLASS_ACTION,
  RESOURCES_FEATURES_COMMAND_TYPES,
  RESOURCES_FEATURES_SECTION_ID,
  createResourcesFeaturesSection,
  renderResourcesFeatures,
  resourcesFeaturesToIntent,
  selectResourcesFeatures,
} from '../../../site/js/features/sheet/sections/resources-features-section.js';

const NOW = '2026-08-04T00:00:00.000Z';
const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

// Códigos que significam "nenhum handler casou com este clique". São os únicos
// veredictos proibidos: qualquer outra recusa é validação declarada e legítima.
const CODIGOS_DE_BYPASS = Object.freeze(['COMMAND_TYPE_UNKNOWN', 'HANDLER_ACTION_UNKNOWN', 'COMMAND_CLASS_ACTION_HANDLER_NOT_DECLARED']);

let registry;
let officialHandlerInvoker;
/** @type {Array<{handlerId: string, entityId: string}>} */
let handlersDeclarados = [];

before(async () => {
  const { fetchFn } = createDiskFetch();
  const appContext = createAppContext({ fetchFn });
  const activation = await appContext.initializeContent();
  assert.equal(activation.ok, true, `ativação do catálogo falhou: ${JSON.stringify(activation.error ?? null)}`);
  registry = activation.value;
  officialHandlerInvoker = appContext.getOfficialHandlerInvoker();
  assert.ok(officialHandlerInvoker, 'o composition root deveria publicar o OfficialHandlerInvoker');

  handlersDeclarados = collectDeclaredClassHandlers();
  assert.equal(
    handlersDeclarados.length,
    12,
    `esperados 12 handlers de classe declarados no catálogo, vieram ${handlersDeclarados.length}`,
  );
});

/**
 * Contexto de consulta/comando com o catálogo e a porta REAIS.
 * @returns {object}
 */
function contexto() {
  return { registry, officialHandlerInvoker, now: NOW, maximumHitPoints: 100 };
}

/**
 * Monta um personagem canônico da classe indicada, no nível 20 (o nível mais
 * alto é o que destrava o maior número de ações; as demais aparecem na
 * projeção mesmo assim, com `available: false` e o motivo).
 * @param {string} classId
 * @param {number} [level]
 * @returns {object}
 */
function personagemDaClasse(classId, level = 20) {
  const base = createEmptyCharacter({ id: 'res0-feat-0001', now: NOW, rulesetRef: RULESET_REF });
  return Object.freeze({
    ...base,
    build: Object.freeze({ ...base.build, classRef: Object.freeze({ id: classId, packageVersion: '1.0.0' }) }),
    state: Object.freeze({ ...base.state, level }),
  });
}

/**
 * Constrói o ViewModel de um personagem com o catálogo real.
 * @param {object} character
 * @returns {object}
 */
function viewModelDe(character) {
  const built = buildSheetViewModel(character, contexto());
  assert.equal(built.ok, true, `ViewModel falhou: ${JSON.stringify(built.error ?? null)}`);
  return built.value;
}

/**
 * Renderiza a seção dentro do contêiner de seção real.
 * @param {object} dom
 * @param {object} viewModel
 * @returns {object}
 */
function montar(dom, viewModel) {
  const raiz = dom.document.createElement('div');
  raiz.setAttribute('data-sheet-section', RESOURCES_FEATURES_SECTION_ID);
  raiz.innerHTML = renderResourcesFeatures(selectResourcesFeatures(viewModel));
  dom.document.body.appendChild(raiz);
  return raiz;
}

describe('unit/sheet/resources-features-section — registro e delegação', () => {
  test('a seção é aceita pelo registro com o id canônico', () => {
    const criada = createResourcesFeaturesSection();
    assert.equal(criada.ok, true, criada.error?.code);
    assert.equal(criada.value.id, RESOURCES_FEATURES_SECTION_ID);
  });

  test('`select` não calcula: `classActions` é o eco do que o handler projetou', () => {
    const vm = viewModelDe(personagemDaClasse('dnd2024:class:barbaro'));
    const projection = selectResourcesFeatures(vm);
    assert.equal(projection.classActions.available, true);
    assert.deepEqual(
      projection.classActions.handlers.map((h) => h.handlerId),
      vm.derived.classActions.handlers.map((h) => h.handlerId),
    );
    assert.equal(Object.isFrozen(projection), true);
  });

  test('sem a porta de handlers, a seção DECLARA o motivo em vez de listar nada', () => {
    // Sem `officialHandlerInvoker` o ViewModel devolve
    // `{available:false, unavailableReason}` — e a seção precisa mostrar isso.
    // Uma lista vazia e silenciosa faria o jogador concluir que a Fúria sumiu.
    const built = buildSheetViewModel(personagemDaClasse('dnd2024:class:barbaro'), { registry, now: NOW, maximumHitPoints: 100 });
    assert.equal(built.ok, true);
    const markup = renderResourcesFeatures(selectResourcesFeatures(built.value));
    assert.match(markup, /data-sheet-class-actions-unavailable="COMMAND_CLASS_HANDLER_INVOKER_REQUIRED"/);
  });

  test('ViewModel ausente vira estado declarado', () => {
    assert.match(renderResourcesFeatures(selectResourcesFeatures(null)), /data-sheet-resources-unavailable/);
  });

  test('a seção não toca no evento: `toIntent` só DESCREVE', () => {
    const dom = createTestDom();
    try {
      const raiz = montar(dom, viewModelDe(personagemDaClasse('dnd2024:class:monge')));
      let tocou = false;
      resourcesFeaturesToIntent(
        {
          type: 'click',
          target: raiz.querySelector('[data-action]'),
          preventDefault: () => {
            tocou = true;
          },
          stopPropagation: () => {
            tocou = true;
          },
        },
        { root: raiz, projection: {}, uiState: {} },
      );
      assert.equal(tocou, false);
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/resources-features-section — recurso AUSENTE nunca é inferido', () => {
  test('recurso não materializado aparece como "—" com `data-missing="true"`', () => {
    // Um personagem recém-montado não tem `state.resources` materializado; o
    // handler projeta `{current: null, missing: true}` e a seção precisa
    // MOSTRAR a ausência — nem "máximo" (parece descansado) nem "0" (parece
    // esgotado). As duas invenções são plausíveis e ambas erradas.
    const dom = createTestDom();
    try {
      const raiz = montar(dom, viewModelDe(personagemDaClasse('dnd2024:class:barbaro')));
      const ausentes = [...raiz.querySelectorAll('[data-sheet-resource][data-missing="true"]')];
      assert.ok(ausentes.length > 0, 'o Bárbaro deveria projetar ao menos um recurso não materializado');
      for (const entrada of ausentes) {
        assert.equal(entrada.querySelector('[data-sheet-resource-current]').textContent, '—');
        // O TETO continua sendo mostrado: ele vem do conteúdo, não do estado.
        assert.notEqual(entrada.querySelector('[data-sheet-resource-max]').textContent, '—');
      }
    } finally {
      dom.restore();
    }
  });

  test('gastar um recurso não materializado é recusado com erro NOMEADO', () => {
    const character = personagemDaClasse('dnd2024:class:barbaro');
    const resultado = executeCharacterCommand(
      character,
      { type: CLASS_ACTION, handlerId: 'class-barbaro', entityId: 'dnd2024:class:barbaro', actionId: 'entrar-em-furia' },
      contexto(),
    );
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'HANDLER_RESOURCE_NOT_INITIALIZED');
  });
});

describe('unit/sheet/resources-features-section — COBERTURA EXAUSTIVA de toda ação do catálogo', () => {
  test('a fonte de ids é a MESMA da cobertura de handler (Task 22a)', () => {
    // Guarda do guarda: se alguém reintroduzir uma varredura local aqui, as
    // duas listas voltam a poder divergir. O teste afirma a propriedade que
    // importa — os doze ids vêm do helper compartilhado.
    assert.deepEqual(
      handlersDeclarados.map((entry) => entry.handlerId).sort(),
      [
        'class-barbaro', 'class-bardo', 'class-bruxo', 'class-clerigo',
        'class-druida', 'class-feiticeiro', 'class-guardiao', 'class-guerreiro',
        'class-ladino', 'class-mago', 'class-monge', 'class-paladino',
      ],
    );
  });

  test('TODA ação de TODO handler tem um elemento no markup carregando o seu actionId', () => {
    const dom = createTestDom();
    const falhas = [];
    let totalDeAcoes = 0;
    try {
      for (const handler of handlersDeclarados) {
        const vm = viewModelDe(personagemDaClasse(handler.entityId));
        const classActions = vm.derived.classActions;
        if (classActions.available !== true) {
          falhas.push(`${handler.handlerId}: projeção indisponível (${classActions.unavailableReason})`);
          continue;
        }
        const raiz = montar(dom, vm);
        for (const entrada of classActions.handlers) {
          const acoes = entrada.projection.actions ?? [];
          if (acoes.length === 0) {
            falhas.push(`${entrada.handlerId}: nenhuma ação projetada — a varredura ou o handler está quebrado`);
          }
          for (const action of acoes) {
            totalDeAcoes += 1;
            const seletor = `[data-action="${CLASS_ACTION}"][data-handler-id="${entrada.handlerId}"][data-action-id="${action.actionId}"]`;
            if (raiz.querySelector(seletor) === null) {
              falhas.push(`${entrada.handlerId}/${action.actionId}: sem elemento no markup`);
            }
          }
        }
        raiz.remove();
      }
    } finally {
      dom.restore();
    }
    assert.deepEqual(falhas, []);
    // Âncora contra uma varredura que silenciosamente pare de achar ações.
    // Piso observado na execução desta task: 119 ações, somando os doze
    // handlers. O piso de 100 é uma âncora contra uma varredura que
    // silenciosamente pare de achar ações (e transforme a cobertura exaustiva
    // numa amostra sem ninguém perceber).
    assert.ok(totalDeAcoes >= 100, `apenas ${totalDeAcoes} ações cobertas — a cobertura virou amostra`);
  });

  test('NENHUM botão de ação renderiza o slug cru quando o handler declara label (correção I3)', () => {
    const dom = createTestDom();
    const falhas = [];
    let rotuladas = 0;
    try {
      for (const handler of handlersDeclarados) {
        const vm = viewModelDe(personagemDaClasse(handler.entityId));
        if (vm.derived.classActions.available !== true) {
          falhas.push(`${handler.handlerId}: projeção indisponível`);
          continue;
        }
        const raiz = montar(dom, vm);
        for (const entrada of vm.derived.classActions.handlers) {
          for (const action of entrada.projection.actions ?? []) {
            const botao = raiz.querySelector(
              `[data-action="${CLASS_ACTION}"][data-handler-id="${entrada.handlerId}"][data-action-id="${action.actionId}"]`,
            );
            if (botao === null) {
              falhas.push(`${entrada.handlerId}/${action.actionId}: sem botão`);
              continue;
            }
            if (typeof action.label === 'string' && action.label.length > 0) {
              rotuladas += 1;
              if (botao.textContent !== action.label) {
                falhas.push(`${entrada.handlerId}/${action.actionId}: texto "${botao.textContent}" != label "${action.label}"`);
              }
              if (botao.hasAttribute('data-label-fallback')) {
                falhas.push(`${entrada.handlerId}/${action.actionId}: fallback sinalizado com label declarado`);
              }
            } else if (botao.textContent === action.actionId || !botao.hasAttribute('data-label-fallback')) {
              // Sem label declarado: o slug HUMANIZADO aparece, com a
              // sinalização honesta — nunca o slug cru em silêncio.
              falhas.push(`${entrada.handlerId}/${action.actionId}: slug cru ou fallback sem sinalização`);
            }
          }
          // Recursos: o rótulo pt-BR aparece, nunca o ContentId cru.
          for (const [resourceId, recurso] of Object.entries(entrada.projection.resources ?? {})) {
            const item = raiz.querySelector(`[data-sheet-resource="${resourceId}"]`);
            if (item === null) {
              falhas.push(`${entrada.handlerId}/${resourceId}: recurso sem elemento`);
              continue;
            }
            const rotulo = item.querySelector('[data-sheet-resource-label]');
            if (rotulo === null || rotulo.textContent.includes(':resource:')) {
              falhas.push(`${entrada.handlerId}/${resourceId}: rótulo ausente ou com ContentId cru`);
            } else if (typeof recurso.label === 'string' && rotulo.textContent !== recurso.label) {
              falhas.push(`${entrada.handlerId}/${resourceId}: rótulo "${rotulo.textContent}" != label "${recurso.label}"`);
            }
          }
        }
        raiz.remove();
      }
    } finally {
      dom.restore();
    }
    assert.deepEqual(falhas, []);
    // Âncora: os doze handlers declaram label hoje (107 ações rotuladas na
    // correção I3); se a propagação regredir para `null`, este piso acusa.
    assert.ok(rotuladas >= 100, `apenas ${rotuladas} ações com label declarado — a propagação regrediu`);
  });

  test('disparar TODA ação devolve ok:true OU erro de validação DECLARADO — nunca no-op', () => {
    // Esta é a asserção que o brief chama de mais grave. Cada ação é disparada
    // pelo caminho REAL (`toIntent` -> comando canônico -> dispatcher), com o
    // catálogo e a porta reais.
    const dom = createTestDom();
    const falhas = [];
    let disparadas = 0;
    try {
      for (const handler of handlersDeclarados) {
        const character = personagemDaClasse(handler.entityId);
        const vm = viewModelDe(character);
        const raiz = montar(dom, vm);
        for (const botao of raiz.querySelectorAll(`[data-action="${CLASS_ACTION}"]`)) {
          const decision = resourcesFeaturesToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
          const identidade = `${botao.getAttribute('data-handler-id')}/${botao.getAttribute('data-action-id')}`;

          if (decision.intent === null || decision.intent.type !== SHEET_INTENT_TYPES.command) {
            falhas.push(`${identidade}: o clique não produziu intenção de comando`);
            continue;
          }
          const resultado = executeCharacterCommand(character, decision.intent.command, contexto());
          disparadas += 1;

          if (resultado.ok === true) {
            continue;
          }
          const codigo = resultado.error?.code ?? null;
          if (typeof codigo !== 'string' || codigo.length === 0) {
            falhas.push(`${identidade}: recusa SEM código de erro`);
            continue;
          }
          if (CODIGOS_DE_BYPASS.includes(codigo)) {
            falhas.push(`${identidade}: ${codigo} — nenhum handler casou com este clique`);
          }
        }
        raiz.remove();
      }
    } finally {
      dom.restore();
    }
    assert.deepEqual(falhas, []);
    assert.ok(disparadas >= 100, `apenas ${disparadas} ações disparadas — a cobertura virou amostra`);
  });

  test('o elemento de uma ação INDISPONÍVEL continua clicável e explica o motivo', () => {
    // `disabled` faria o navegador engolir o clique antes de qualquer handler —
    // a experiência exata que este projeto persegue. `aria-disabled` mantém a
    // ação acionável, e o comando volta com o motivo nomeado.
    const dom = createTestDom();
    try {
      const raiz = montar(dom, viewModelDe(personagemDaClasse('dnd2024:class:barbaro', 1)));
      const indisponiveis = [...raiz.querySelectorAll('[data-available="false"]')];
      assert.ok(indisponiveis.length > 0, 'um Bárbaro de nível 1 deveria ter ações indisponíveis');
      for (const botao of indisponiveis) {
        assert.equal(botao.hasAttribute('disabled'), false, 'ação indisponível não pode usar o atributo `disabled`');
        assert.equal(botao.getAttribute('aria-disabled'), 'true');
        assert.ok((botao.getAttribute('data-reason') ?? '').length > 0, 'ação indisponível sem motivo declarado');
      }
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/resources-features-section — descansos e anti-bypass', () => {
  test('os comandos declarados existem no dispatcher canônico', () => {
    const character = personagemDaClasse('dnd2024:class:guerreiro');
    const desconhecidos = RESOURCES_FEATURES_COMMAND_TYPES.filter((type) => {
      const resultado = executeCharacterCommand(character, { type }, contexto());
      return resultado.ok !== true && resultado.error?.code === 'COMMAND_TYPE_UNKNOWN';
    });
    assert.deepEqual(desconhecidos, []);
  });

  test('o descanso da seção é o comando CANÔNICO, que já compõe o `onRest` da classe', () => {
    // Não existe um "descanso de classe" a disparar em separado: é isso que
    // impede a interface de aplicar meio descanso.
    const dom = createTestDom();
    try {
      const raiz = montar(dom, viewModelDe(personagemDaClasse('dnd2024:class:barbaro')));
      for (const type of ['short-rest', 'long-rest']) {
        const botao = raiz.querySelector(`[data-action="${type}"]`);
        assert.ok(botao, `faltou o botão de "${type}"`);
        const decision = resourcesFeaturesToIntent({ type: 'click', target: botao }, { root: raiz, projection: {}, uiState: {} });
        assert.deepEqual(decision.intent.command, { type });
      }
    } finally {
      dom.restore();
    }
  });

  test('`data-action` desconhecido vira erro DECLARADO, nunca no-op', () => {
    const dom = createTestDom();
    try {
      const raiz2 = dom.document.createElement('div');
      raiz2.setAttribute('data-sheet-section', RESOURCES_FEATURES_SECTION_ID);
      raiz2.innerHTML = '<button data-action="acao-inexistente">x</button>';
      dom.document.body.appendChild(raiz2);
      const botao = raiz2.querySelector('[data-action]');
      const decision = resourcesFeaturesToIntent({ type: 'click', target: botao }, { root: raiz2, projection: {}, uiState: {} });
      const resultado = executeCharacterCommand(personagemDaClasse('dnd2024:class:mago'), decision.intent.command, contexto());
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'COMMAND_TYPE_UNKNOWN');
    } finally {
      dom.restore();
    }
  });

  test('um botão de ação de classe FORJADO para outro handler é recusado com erro nomeado', () => {
    // Defesa de proveniência: um `data-handler-id` de outra classe não pode
    // executar. O erro é de DOMÍNIO (legível), não um erro de autorização
    // vindo do fundo do invoker.
    const resultado = executeCharacterCommand(
      personagemDaClasse('dnd2024:class:mago'),
      { type: CLASS_ACTION, handlerId: 'class-barbaro', entityId: 'dnd2024:class:barbaro', actionId: 'entrar-em-furia' },
      contexto(),
    );
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'COMMAND_CLASS_ACTION_HANDLER_NOT_DECLARED');
  });
});
