// Teste focal de `features/sheet/sections/level-up-flow-view.js` (Task 30).
//
// O teste central deste arquivo é o do MODO LEGADO (flag `false`): ele não se
// contenta em "renderizou alguma coisa" — ele monta o `#modal-container` com o
// markup real de `site/index.html`, injeta título/corpo/ações produzidos pelo
// módulo, normaliza a árvore com AS MESMAS regras do capturador de baseline
// (`tests/e2e/dom-baseline.spec.js`) e compara com a variante
// `levelup-flow-v2-false` de `tests/fixtures/dom-baseline/sheet-sections.json`
// — capturada da ficha REAL no commit-baseline `e43c5ea`.
//
// É essa comparação que a Task 37 precisa: sem ela, "remover o legado" poderia
// ser justificado por "a suíte E2E não travou", que é exatamente o que o brief
// daquela task proíbe.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createTestDom } from '../../helpers/test-dom.js';
import { LEVELUP_FLOW_V2_KEY } from '../../../site/js/infra/preferences/local-storage-preferences-repository.js';
import {
  LEVEL_UP_FLOW_ACTIONS,
  LEVEL_UP_MODAL_ID,
  LEVEL_UP_TITLES,
  LEVELUP_FLOW_V2_KEY_LABEL,
  describeLevelUpModal,
  renderLegacyLevelUpActions,
  renderLegacyLevelUpContent,
  renderLevelUpCards,
} from '../../../site/js/features/sheet/sections/level-up-flow-view.js';

const repoRoot = new URL('../../../', import.meta.url);
const ORACLE = JSON.parse(
  readFileSync(fileURLToPath(new URL('tests/fixtures/dom-baseline/sheet-sections.json', repoRoot)), 'utf8'),
);
const VARIANTE = 'levelup-flow-v2-false';

// Markup do modal, copiado de `site/index.html` (linhas 34-46). O corpo e as
// ações ficam vazios: são eles que o módulo sob teste preenche.
const MODAL_HTML = `<!doctype html><html><body>
<div id="modal-overlay" class="modal-overlay">
  <div id="modal-container" class="modal-container">
    <div id="modal-header" class="modal-header">
      <h2 id="modal-titulo"></h2>
      <button class="modal-fechar">&times;</button>
    </div>
    <div id="modal-corpo" class="modal-corpo"></div>
    <div id="modal-acoes" class="modal-acoes"></div>
  </div>
</div>
</body></html>`;

// --- Normalizador: as MESMAS regras do capturador -------------------------
//
// Reimplementado aqui (e não importado) porque o capturador roda DENTRO do
// navegador — ele é serializado por `Function.prototype.toString` e por isso
// não pode ser um módulo compartilhado. A duplicação é amarrada pelo próprio
// oráculo: se as regras divergirem, a comparação abaixo falha.
const ALLOW_EXACT = new Set([
  'id', 'name', 'type', 'value', 'checked', 'disabled', 'required', 'readonly', 'selected',
  'min', 'max', 'step', 'maxlength', 'minlength', 'placeholder', 'size', 'multiple', 'for', 'accept',
  'rows', 'cols',
  'title', 'alt', 'target', 'rel', 'colspan', 'rowspan', 'tabindex', 'role', 'href', 'src',
  'width', 'height', 'viewbox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'fill-rule', 'clip-rule', 'd', 'points', 'cx', 'cy', 'r', 'x', 'y',
  'x1', 'x2', 'y1', 'y2', 'xmlns',
]);
const DENY_EXACT = new Set(['style', 'data-action', 'data-command', 'data-intent']);

/**
 * Classifica um atributo em `allow`/`deny`/desconhecido, igual ao capturador.
 * @param {string} nome
 * @returns {string|null}
 */
function classificarAtributo(nome) {
  if (DENY_EXACT.has(nome)) return 'deny';
  if (ALLOW_EXACT.has(nome)) return 'allow';
  if (/^on/i.test(nome)) return 'deny';
  if (/^aria-/.test(nome)) return 'allow';
  if (/^data-/.test(nome)) return 'allow';
  return null;
}

/**
 * Normaliza um nó DOM na mesma árvore semântica que o oráculo guarda.
 * @param {object} no
 * @returns {object|null}
 */
function normalizarNo(no) {
  if (no.nodeType === 3) {
    const texto = no.textContent.replace(/\s+/g, ' ').trim();
    return texto ? { text: texto } : null;
  }
  if (no.nodeType !== 1) return null;

  const attrs = {};
  for (const attr of Array.from(no.attributes)) {
    const nome = attr.name.toLowerCase();
    if (nome === 'class') continue;
    const categoria = classificarAtributo(nome);
    if (categoria === 'deny') continue;
    assert.notEqual(categoria, null, `atributo não classificado em <${no.tagName.toLowerCase()}>: "${nome}"`);
    attrs[nome] = attr.value;
  }

  return {
    tag: no.tagName.toLowerCase(),
    classes: Array.from(no.classList).sort(),
    attrs,
    children: Array.from(no.childNodes).map(normalizarNo).filter(Boolean),
  };
}

/** @type {{document: object, restore: () => void}|null} */
let dom = null;

before(() => {
  dom = createTestDom({ html: MODAL_HTML });
});

after(() => {
  dom?.restore();
  dom = null;
});

describe('unit/sheet/level-up-flow-view — o modo LEGADO é comparado por DOM contra o oráculo', () => {
  test('a variante `levelup-flow-v2-false` existe no oráculo da Task 3/30', () => {
    // Se alguém apagar a variante, o teste abaixo passaria por vacuidade.
    assert.ok(
      Object.hasOwn(ORACLE, VARIANTE),
      `a variante "${VARIANTE}" precisa existir em tests/fixtures/dom-baseline/sheet-sections.json`,
    );
    assert.equal(ORACLE[VARIANTE].attrs.id, 'modal-container');
  });

  test('o modal montado com a vista LEGADA reproduz a variante capturada, nó a nó', () => {
    const documento = dom.document;
    const descricao = describeLevelUpModal({ levelUpFlowV2: false });

    documento.getElementById('modal-titulo').textContent = descricao.title;
    documento.getElementById('modal-corpo').innerHTML = descricao.content;
    documento.getElementById('modal-acoes').innerHTML = descricao.actions;

    const capturado = normalizarNo(documento.getElementById('modal-container'));
    assert.deepEqual(capturado, ORACLE[VARIANTE]);
  });

  test('a chave exibida ao jogador é a MESMA que o repositório de preferências usa', () => {
    // O rótulo é literal de apresentação; se ele divergisse da chave real, a
    // ficha ensinaria ao jogador uma chave de localStorage que não existe.
    assert.equal(LEVELUP_FLOW_V2_KEY_LABEL, LEVELUP_FLOW_V2_KEY);
    assert.equal(LEVELUP_FLOW_V2_KEY_LABEL, 'feature.levelup.flow.v2');
  });

  test('o corpo legado não carrega classe, id nem atributo fora do contrato', () => {
    // Guarda direta contra a regressão mais provável: alguém acrescentar um
    // `class="..."` "só para estilizar" e quebrar a comparação acima de um
    // jeito difícil de ler no diff.
    const conteudo = renderLegacyLevelUpContent();
    assert.equal(/\sclass=/.test(conteudo), false);
    assert.equal(/\sid=/.test(conteudo), false);
    const acoes = renderLegacyLevelUpActions();
    assert.match(acoes, /class="btn btn-secondary"/);
    assert.match(acoes, /id="btn-enable-levelup-v2"/);
  });
});

describe('unit/sheet/level-up-flow-view — o modo v2 desenha cards, e a ausência é declarada', () => {
  test('a flag `true` produz o fluxo em cards, com o mesmo `modalId` do modo legado', () => {
    const v2 = describeLevelUpModal({
      levelUpFlowV2: true,
      options: {
        fromLevel: 4,
        toLevel: 5,
        hitPoints: { die: 8, average: 5 },
        requiresSubclass: false,
        requiresAbilityScoreImprovement: false,
        requiresEpicBoon: false,
        featuresGained: [{ id: 'dnd2024:feature:ataque-extra', name: 'Ataque Extra' }],
      },
    });
    const legado = describeLevelUpModal({ levelUpFlowV2: false });

    assert.equal(v2.mode, 'v2');
    assert.equal(legado.mode, 'legacy');
    // MESMO modal: os dois modos são vistas do mesmo fluxo, não dois fluxos.
    assert.equal(v2.modalId, LEVEL_UP_MODAL_ID);
    assert.equal(legado.modalId, LEVEL_UP_MODAL_ID);
    assert.equal(v2.title, LEVEL_UP_TITLES.v2);

    assert.match(v2.content, /data-levelup-card="hit-points"/);
    assert.match(v2.content, /data-levelup-from="4"/);
    assert.match(v2.content, /data-levelup-to="5"/);
    assert.match(v2.content, /Ataque Extra/);
    // O nível não exige subclasse nem ASI: os cartões correspondentes NÃO
    // existem (a projeção manda, não uma suposição da vista).
    assert.equal(/data-levelup-card="subclass"/.test(v2.content), false);
    assert.equal(/data-levelup-card="ability-score-improvement"/.test(v2.content), false);
  });

  test('cada decisão exigida pela projeção ganha o seu cartão', () => {
    const conteudo = renderLevelUpCards({
      fromLevel: 3,
      toLevel: 4,
      hitPoints: { die: 10, average: 6 },
      requiresSubclass: true,
      requiresAbilityScoreImprovement: true,
      requiresEpicBoon: true,
      featuresGained: [],
    });
    for (const slug of ['hit-points', 'subclass', 'ability-score-improvement', 'epic-boon', 'features']) {
      assert.match(conteudo, new RegExp(`data-levelup-card="${slug}"`), `faltou o cartão "${slug}"`);
    }
  });

  test('projeção AUSENTE vira estado de erro DECLARADO, nunca um conjunto de cartões vazio', () => {
    // O bug que este caso previne: sem opções, renderizar `<div>` vazio faria a
    // tela dizer "este nível não pede nada", que é uma afirmação falsa.
    const conteudo = renderLevelUpCards(null, { code: 'LEVEL_UP_REGISTRY_REQUIRED', message: 'Catálogo ausente.' });
    assert.match(conteudo, /data-levelup-error="LEVEL_UP_REGISTRY_REQUIRED"/);
    assert.match(conteudo, /Catálogo ausente\./);
    assert.equal(/data-levelup-card=/.test(conteudo), false);
  });

  test('as ações do fluxo têm vocabulário fechado e o confirmar é o comando canônico', () => {
    // `level-up` é literalmente o `type` do comando de
    // `domain/commands/command-dispatcher.js` — é isso que garante que os dois
    // modos terminem no MESMO comando.
    assert.equal(LEVEL_UP_FLOW_ACTIONS.confirm, 'level-up');
    assert.deepEqual(Object.keys(LEVEL_UP_FLOW_ACTIONS).sort(), ['close', 'confirm', 'enableV2']);
  });
});
