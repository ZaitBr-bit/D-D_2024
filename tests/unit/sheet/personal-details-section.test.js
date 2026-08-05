// Teste focal de `features/sheet/sections/personal-details-section.js`
// (Task 32).
//
// As garantias, cada uma com um defeito concreto por trás:
//
//  1. A IMAGEM SÓ CHEGA AO `src` PELA PORTA. `identity.image` é conteúdo
//     arbitrário (localStorage/JSON importado/Firestore). O teste prova que uma
//     data URL de SVG, um `javascript:` e um PNG com bytes mentirosos NÃO viram
//     `src` — e que o motivo da recusa é exibido, não engolido. É o sink real
//     que a Task 24 apontou em `sheet.js` (linhas 3226/7889/8054), fechado aqui.
//  2. TEXTO DO JOGADOR É ESCAPADO. Nome, alinhamento e campos pessoais podem
//     conter markup; nenhum deles pode virar elemento.
//  3. AUSÊNCIA ≠ VALOR PLAUSÍVEL. Campo vazio vira `—`, nunca um texto
//     inventado.
//  4. A EDIÇÃO DE IDENTIDADE FUNCIONA DE PONTA A PONTA (correção I2 da
//     revisão final — este item TROCOU de sinal conscientemente: antes o
//     teste travava a RECUSA `COMMAND_EDIT_PATH_NOT_ALLOWED`, agora prova o
//     EFEITO). O dispatcher REAL aceita `edit-character-field` com todo path
//     de identidade que a seção emite, muta `identity.*` imutavelmente,
//     `revert-character-edit` restaura o original, e `identity.image`
//     CONTINUA recusado por nome (ship-as-debt da porta de imagem).
//  5. CANCELAR NÃO MUTA: fechar o modal não produz comando.
//  6. PARIDADE COM MÚLTIPLAS FIXTURES, não com uma amostra.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ok } from '../../../site/js/core/result.js';
import { createTestDom } from '../../helpers/test-dom.js';
import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { projectLegacyCharacterForQueries, deriveLegacyQueryHints } from '../../../site/js/infra/character/legacy-query-adapter.js';
import { buildSheetViewModel } from '../../../site/js/features/sheet/sheet-view-model.js';
import { executeCharacterCommand } from '../../../site/js/domain/commands/command-dispatcher.js';
import { SHEET_INTENT_TYPES } from '../../../site/js/features/sheet/sheet-state.js';
import {
  IMAGE_EDIT_UNAVAILABLE_REASON,
  IMAGE_REJECTED_REASON,
  PERSONAL_DETAILS_COMMAND_TYPES,
  PERSONAL_DETAILS_FLOW_ACTIONS,
  PERSONAL_DETAILS_MODAL_ID,
  PERSONAL_DETAILS_SECTION_ID,
  PERSONAL_DETAIL_FIELDS,
  createPersonalDetailsSection,
  identityEditPath,
  personalDetailsToIntent,
  renderPersonalDetails,
  selectPersonalDetails,
} from '../../../site/js/features/sheet/sections/personal-details-section.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const NOW = '2026-08-04T00:00:00.000Z';

// PNG 1x1 VÁLIDO (mesma amostra de `tests/unit/ui/html.test.js`): magic bytes
// coerentes com o MIME declarado, que é o que `resolveSafeUrl` exige.
const PNG_VALIDO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/**
 * Catálogo mínimo (a seção não usa catálogo; o ViewModel usa).
 * @returns {Readonly<object>}
 */
function fakeRegistry() {
  return Object.freeze({
    get: () => null,
    resolve: (reference) => {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return ok(Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }));
    },
    list: () => Object.freeze([]),
  });
}

/** @type {Array<{fixture: string, caseId: string, character: object, context: object}>} */
const personagens = [];

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  const ctx = { aliasResolver: createLegacyAliasResolver(aliases), now: NOW };

  const dir = path.join(repoRoot, 'tests/fixtures/characters');
  for (const name of await readdir(dir)) {
    if (!name.startsWith('legacy-') && !name.startsWith('near-') && !name.startsWith('v2-')) {
      continue;
    }
    const parsed = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    for (const entry of parsed.cases ?? []) {
      if (entry.personagem === null || typeof entry.personagem !== 'object') {
        continue;
      }
      const projected = projectLegacyCharacterForQueries(entry.personagem, ctx);
      if (projected.ok !== true) {
        continue;
      }
      const hints = deriveLegacyQueryHints(entry.personagem);
      if (!Number.isFinite(hints?.maximumHitPoints)) {
        continue;
      }
      personagens.push({
        fixture: name,
        caseId: entry.id,
        character: projected.value,
        context: { registry: fakeRegistry(), ...hints },
      });
    }
  }
  assert.ok(personagens.length >= 10, `apenas ${personagens.length} fixtures decodificáveis — a paridade seria de amostra única`);
});

/**
 * Personagem com os campos de identidade sobrescritos.
 * @param {object} [identity]
 * @returns {object}
 */
function personagemCom(identity = {}) {
  const base = personagens[0].character;
  return Object.freeze({ ...base, identity: Object.freeze({ ...base.identity, ...identity }) });
}

/**
 * ViewModel de um personagem.
 * @param {object} character
 * @returns {object}
 */
function viewModelDe(character) {
  const built = buildSheetViewModel(character, personagens[0].context);
  assert.equal(built.ok, true, `ViewModel falhou: ${built.error?.code}`);
  return built.value;
}

/**
 * Renderiza a seção dentro de um contêiner de seção real.
 * @param {object} dom
 * @param {object} viewModel
 * @returns {{raiz: object, projection: object}}
 */
function montar(dom, viewModel) {
  const projection = selectPersonalDetails(viewModel);
  const raiz = dom.document.createElement('div');
  raiz.setAttribute('data-sheet-section', PERSONAL_DETAILS_SECTION_ID);
  raiz.innerHTML = renderPersonalDetails(projection);
  dom.document.body.appendChild(raiz);
  return { raiz, projection };
}

/**
 * Dispara um clique sintético e devolve a decisão.
 * @param {object} elemento
 * @param {object} contexto
 * @returns {object}
 */
function clicar(elemento, contexto) {
  return personalDetailsToIntent({ type: 'click', target: elemento }, contexto);
}

describe('unit/sheet/personal-details — registro e contrato de seção', () => {
  test('a seção é aceita pelo registro com o id canônico', () => {
    const criada = createPersonalDetailsSection();
    assert.equal(criada.ok, true, criada.error?.code);
    assert.equal(criada.value.id, PERSONAL_DETAILS_SECTION_ID);
  });

  test('`select` é ECO de `data.identity`, sem derivar nada', () => {
    const vm = viewModelDe(personagemCom({ name: 'Alfa', alignment: 'Leal e Bom', notes: 'nota' }));
    const projection = selectPersonalDetails(vm);
    assert.equal(projection.fields.name, vm.data.identity.name);
    assert.equal(projection.fields.alignment, vm.data.identity.alignment);
    assert.equal(projection.fields.notes, vm.data.identity.notes);
    assert.equal(Object.isFrozen(projection), true);
  });

  test('ViewModel ausente vira estado declarado, nunca uma seção em branco', () => {
    assert.match(renderPersonalDetails(selectPersonalDetails(null)), /data-sheet-details-unavailable/);
  });

  test('`toIntent` não toca no evento: só DESCREVE', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemCom({ name: 'Alfa' })));
      let tocou = false;
      personalDetailsToIntent(
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
        { root: raiz, projection, uiState: {} },
      );
      assert.equal(tocou, false);
    } finally {
      dom.restore();
    }
  });

  test('o markup não registra handler inline', () => {
    const dom = createTestDom();
    try {
      const { raiz } = montar(dom, viewModelDe(personagemCom({ name: 'Alfa' })));
      assert.equal(/\son[a-z]+=/i.test(raiz.innerHTML), false, 'a seção não pode emitir handler inline');
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/personal-details — a imagem só passa pela porta de segurança', () => {
  test('imagem VÁLIDA vira `src`; nenhuma outra chega ao atributo', () => {
    const dom = createTestDom();
    try {
      const { raiz } = montar(dom, viewModelDe(personagemCom({ image: PNG_VALIDO })));
      const img = raiz.querySelector('[data-sheet-character-image]');
      assert.ok(img !== null, 'a imagem válida deveria ser exibida');
      assert.equal(img.getAttribute('src'), PNG_VALIDO);
    } finally {
      dom.restore();
    }
  });

  test('SVG, `javascript:` e PNG com bytes mentirosos são RECUSADOS com motivo exibido', () => {
    const dom = createTestDom();
    const perigosas = [
      'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+',
      'javascript:alert(1)',
      // MIME de PNG com payload que NÃO começa com os magic bytes de PNG.
      'data:image/png;base64,PHN2Zz48L3N2Zz4=',
      'https://exemplo.invalido/imagem.png',
    ];
    try {
      for (const imagem of perigosas) {
        const projection = selectPersonalDetails(viewModelDe(personagemCom({ image: imagem })));
        assert.equal(projection.safeImageUrl, null, `"${imagem.slice(0, 32)}" jamais pode virar src`);
        assert.notEqual(projection.imageRejectedCode, null, 'a recusa precisa ter código nomeado');
        const raiz = dom.document.createElement('div');
        raiz.innerHTML = renderPersonalDetails(projection);
        assert.equal(raiz.querySelector('[data-sheet-character-image]'), null);
        assert.equal(raiz.querySelector('script'), null);
        assert.ok(raiz.querySelector(`[data-sheet-image-rejected="${IMAGE_REJECTED_REASON}"]`) !== null);
      }
    } finally {
      dom.restore();
    }
  });

  test('sem imagem nenhuma o estado é VAZIO, não recusa', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemCom({ image: null })));
      assert.equal(projection.hasImage, false);
      assert.equal(projection.imageRejectedCode, null);
      assert.ok(raiz.querySelector('[data-sheet-image-empty]') !== null);
    } finally {
      dom.restore();
    }
  });

  test('o FONTE nunca interpola a imagem crua num `src`', async () => {
    const fonte = await readFile(path.join(repoRoot, 'site/js/features/sheet/sections/personal-details-section.js'), 'utf8');
    // O sink real do baseline é `src="${char.imagem}"`. Aqui só pode existir o
    // `src` alimentado por `safeImageUrl` (já resolvido pela porta).
    assert.equal(/src="\$\{escapeHtmlAttribute\((?!projection\.safeImageUrl)/.test(fonte), false);
    assert.match(fonte, /resolveSafeUrl\(/);
    assert.match(fonte, /SAFE_URL_KINDS\.characterImage/);
  });
});

describe('unit/sheet/personal-details — texto do jogador e ausência', () => {
  test('markup em qualquer campo é ESCAPADO, nunca elemento', () => {
    const dom = createTestDom();
    try {
      const { raiz } = montar(
        dom,
        viewModelDe(personagemCom({ name: '<img src=x onerror=alert(1)>', backstory: '<b>negrito</b>', notes: '"><script>x</script>' })),
      );
      assert.equal(raiz.querySelector('script'), null);
      assert.equal(raiz.querySelector('b'), null);
      assert.equal(raiz.querySelector('img[onerror]'), null);
      assert.equal(
        raiz.querySelector('[data-sheet-detail-field="name"] [data-sheet-detail-value]').textContent,
        '<img src=x onerror=alert(1)>',
      );
    } finally {
      dom.restore();
    }
  });

  test('campo ausente vira "—", nunca um valor plausível', () => {
    const dom = createTestDom();
    try {
      const vazio = {};
      for (const { field } of PERSONAL_DETAIL_FIELDS) {
        vazio[field] = null;
      }
      const { raiz, projection } = montar(dom, viewModelDe(personagemCom(vazio)));
      for (const { field } of PERSONAL_DETAIL_FIELDS) {
        assert.equal(projection.fields[field], null, `${field} deveria permanecer ausente`);
        assert.equal(raiz.querySelector(`[data-sheet-detail-field="${field}"] [data-sheet-detail-value]`).textContent, '—');
      }
    } finally {
      dom.restore();
    }
  });

  test('o modal de edição nasce com os valores ATUAIS, escapados', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemCom({ name: 'Alfa "o Bravo"', backstory: '<b>x</b>' })));
      const decisao = clicar(raiz.querySelector(`[data-action="${PERSONAL_DETAILS_FLOW_ACTIONS.editOpen}"]`), {
        root: raiz,
        projection,
        uiState: {},
      });
      const modal = dom.document.createElement('div');
      modal.innerHTML = `${decisao.intent.content}${decisao.intent.actions}`;
      dom.document.body.appendChild(modal);
      assert.equal(modal.querySelector('[data-sheet-detail-input="name"]').getAttribute('value'), 'Alfa "o Bravo"');
      // Dentro do `<textarea>` o texto viaja ESCAPADO no markup (um navegador
      // real o decodifica de volta ao valor original); o que não pode acontecer
      // em hipótese alguma é ele virar ELEMENTO.
      assert.match(decisao.intent.content, /&lt;b&gt;x&lt;\/b&gt;/);
      assert.equal(modal.querySelector('b'), null);
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/personal-details — edição: comando canônico e lacuna DECLARADA', () => {
  test('gravar um campo emite `edit-character-field` com o path de identidade e o texto digitado', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemCom({ name: 'Alfa' })));
      const decisao = clicar(raiz.querySelector(`[data-action="${PERSONAL_DETAILS_FLOW_ACTIONS.editOpen}"]`), {
        root: raiz,
        projection,
        uiState: {},
      });
      const modal = dom.document.createElement('div');
      modal.innerHTML = `${decisao.intent.content}${decisao.intent.actions}`;
      dom.document.body.appendChild(modal);
      modal.querySelector('[data-sheet-detail-input="alignment"]').value = 'Caótico e Bom';

      const gravar = clicar(modal.querySelector('[data-action="edit-character-field"][data-path="identity.alignment"]'), {
        root: modal,
        projection,
        uiState: {},
      });
      assert.deepEqual(gravar.intent.command, {
        type: 'edit-character-field',
        path: 'identity.alignment',
        value: 'Caótico e Bom',
      });
    } finally {
      dom.restore();
    }
  });

  // ATUALIZAÇÃO CONSCIENTE (correção I2 da revisão final): o teste que aqui
  // travava a RECUSA (`COMMAND_EDIT_PATH_NOT_ALLOWED` para todo path de
  // identidade) foi INVERTIDO — a allowlist do domínio agora cobre esses
  // paths, e travar a recusa congelaria o defeito. O que fica travado é o
  // EFEITO completo (mutação imutável + reversão) e a recusa que PERMANECE
  // (imagem).
  test('o dispatcher REAL aceita todo path de identidade da seção e produz o EFEITO (imutável)', () => {
    const character = personagemCom({ name: 'Alfa' });
    for (const { field } of PERSONAL_DETAIL_FIELDS) {
      const resultado = executeCharacterCommand(
        character,
        { type: 'edit-character-field', path: identityEditPath(field), value: `novo:${field}` },
        { registry: fakeRegistry(), now: NOW },
      );
      assert.equal(resultado.ok, true, `${field}: ${resultado.error?.code}`);
      assert.equal(resultado.character.identity[field], `novo:${field}`);
      assert.deepEqual(resultado.affected, [identityEditPath(field)]);
      // Imutabilidade: o personagem de ENTRADA não foi tocado.
      assert.equal(character.identity[field] === `novo:${field}`, false);
      // O override de reversão guarda o original.
      assert.equal(resultado.character.overrides[identityEditPath(field)].original, character.identity[field] ?? '');
    }
  });

  test('revert-character-edit restaura o texto ORIGINAL do campo (simetria de efeito)', () => {
    const character = personagemCom({ name: 'Alfa' });
    const editado = executeCharacterCommand(
      character,
      { type: 'edit-character-field', path: 'identity.name', value: 'Beta' },
      { registry: fakeRegistry(), now: NOW },
    );
    assert.equal(editado.ok, true);
    const revertido = executeCharacterCommand(editado.character, { type: 'revert-character-edit', path: 'identity.name' }, {});
    assert.equal(revertido.ok, true);
    assert.equal(revertido.character.identity.name, 'Alfa');
    assert.equal(Object.hasOwn(revertido.character.overrides, 'identity.name'), false);
  });

  test('identity.image e paths de prototype-pollution CONTINUAM recusados por nome', () => {
    const character = personagemCom({ name: 'Alfa' });
    for (const path of ['identity.image', 'identity.id', '__proto__.polluted', 'identity.__proto__']) {
      const resultado = executeCharacterCommand(
        character,
        { type: 'edit-character-field', path, value: 'x' },
        { registry: fakeRegistry(), now: NOW },
      );
      assert.equal(resultado.ok, false, `${path}: deveria continuar recusado`);
      assert.equal(resultado.error.code, 'COMMAND_EDIT_PATH_NOT_ALLOWED');
      assert.equal(resultado.character.identity, character.identity);
    }
    assert.equal(Object.prototype.polluted, undefined);
  });

  test('a lacuna de IMAGEM continua exibida na seção e no modal, com o motivo nomeado', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemCom({ name: 'Alfa' })));
      assert.ok(raiz.querySelector(`[data-sheet-image-edit-unavailable="${IMAGE_EDIT_UNAVAILABLE_REASON}"]`) !== null);
      // A nota de identidade SAIU do markup: a allowlist cobre os campos.
      assert.equal(raiz.querySelector('[data-sheet-identity-edit-unavailable]'), null);
      const decisao = clicar(raiz.querySelector(`[data-action="${PERSONAL_DETAILS_FLOW_ACTIONS.editOpen}"]`), {
        root: raiz,
        projection,
        uiState: {},
      });
      assert.match(decisao.intent.content, new RegExp(IMAGE_EDIT_UNAVAILABLE_REASON));
    } finally {
      dom.restore();
    }
  });

  test('reverter emite o comando canônico com o MESMO path (simetria aplicar/revogar)', () => {
    const dom = createTestDom();
    try {
      const character = personagemCom({ name: 'Alfa' });
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const decisao = clicar(raiz.querySelector(`[data-action="${PERSONAL_DETAILS_FLOW_ACTIONS.editOpen}"]`), {
        root: raiz,
        projection,
        uiState: {},
      });
      const modal = dom.document.createElement('div');
      modal.innerHTML = `${decisao.intent.content}${decisao.intent.actions}`;
      dom.document.body.appendChild(modal);
      const gravar = modal.querySelector('[data-action="edit-character-field"][data-path="identity.name"]');
      const reverter = modal.querySelector('[data-action="revert-character-edit"][data-path="identity.name"]');
      assert.equal(gravar.getAttribute('data-path'), reverter.getAttribute('data-path'));
      const decisaoReverter = clicar(reverter, { root: modal, projection, uiState: {} });
      assert.deepEqual(decisaoReverter.intent.command, { type: 'revert-character-edit', path: 'identity.name' });
    } finally {
      dom.restore();
    }
  });

  test('CANCELAR o modal não emite comando e não muta nada', () => {
    const dom = createTestDom();
    try {
      const character = personagemCom({ name: 'Alfa' });
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const decisao = clicar(raiz.querySelector(`[data-action="${PERSONAL_DETAILS_FLOW_ACTIONS.editOpen}"]`), {
        root: raiz,
        projection,
        uiState: {},
      });
      const modal = dom.document.createElement('div');
      modal.innerHTML = `${decisao.intent.content}${decisao.intent.actions}`;
      dom.document.body.appendChild(modal);
      const fechar = clicar(modal.querySelector(`[data-action="${PERSONAL_DETAILS_FLOW_ACTIONS.editClose}"]`), {
        root: modal,
        projection,
        uiState: {},
      });
      assert.equal(fechar.intent.type, SHEET_INTENT_TYPES.modalClose);
      assert.equal(fechar.intent.modalId, PERSONAL_DETAILS_MODAL_ID);
      assert.equal(Object.hasOwn(fechar.intent, 'command'), false);
      // Identidade preservada: abrir e cancelar não tocam no personagem.
      assert.equal(personagemCom({ name: 'Alfa' }).identity.name, character.identity.name);
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/personal-details — anti-bypass do vocabulário', () => {
  test('todo `data-action` do markup e do modal é comando conhecido ou fluxo declarado', () => {
    const dom = createTestDom();
    try {
      const { raiz, projection } = montar(dom, viewModelDe(personagemCom({ name: 'Alfa' })));
      const fluxos = new Set(Object.values(PERSONAL_DETAILS_FLOW_ACTIONS));
      const acoes = new Set();
      for (const elemento of raiz.querySelectorAll('[data-action]')) {
        acoes.add(elemento.getAttribute('data-action'));
      }
      const decisao = clicar(raiz.querySelector(`[data-action="${PERSONAL_DETAILS_FLOW_ACTIONS.editOpen}"]`), {
        root: raiz,
        projection,
        uiState: {},
      });
      const modal = dom.document.createElement('div');
      modal.innerHTML = `${decisao.intent.content}${decisao.intent.actions}`;
      for (const elemento of modal.querySelectorAll('[data-action]')) {
        acoes.add(elemento.getAttribute('data-action'));
      }
      assert.ok(acoes.size >= 4, `apenas ${acoes.size} ações — a varredura estaria vazia`);
      for (const acao of acoes) {
        assert.ok(
          fluxos.has(acao) || PERSONAL_DETAILS_COMMAND_TYPES.includes(acao),
          `"${acao}" não é comando canônico nem ação de fluxo declarada`,
        );
      }
    } finally {
      dom.restore();
    }
  });

  test('todo tipo de `PERSONAL_DETAILS_COMMAND_TYPES` existe no dispatcher', () => {
    const character = personagemCom({ name: 'Alfa' });
    for (const type of PERSONAL_DETAILS_COMMAND_TYPES) {
      const resultado = executeCharacterCommand(character, { type }, { registry: fakeRegistry(), now: NOW });
      assert.notEqual(resultado.error?.code, 'COMMAND_TYPE_UNKNOWN', `"${type}" não está registrado no dispatcher`);
    }
  });

  test('um `data-action` inventado vira comando RECUSADO, nunca um clique inerte', () => {
    const dom = createTestDom();
    try {
      const character = personagemCom({ name: 'Alfa' });
      const { raiz, projection } = montar(dom, viewModelDe(character));
      const botao = dom.document.createElement('button');
      botao.setAttribute('data-action', 'renomear-magicamente');
      raiz.appendChild(botao);
      const decisao = clicar(botao, { root: raiz, projection, uiState: {} });
      assert.equal(decisao.intent.command.type, 'renomear-magicamente');
      const resultado = executeCharacterCommand(character, decisao.intent.command, {});
      assert.equal(resultado.ok, false);
      assert.equal(resultado.error.code, 'COMMAND_TYPE_UNKNOWN');
    } finally {
      dom.restore();
    }
  });
});

describe('unit/sheet/personal-details — paridade em várias fixtures', () => {
  test('a seção renderiza TODAS as fixtures decodificáveis sem lançar e sem imagem crua', () => {
    const dom = createTestDom();
    try {
      let renderizadas = 0;
      for (const { character, context, fixture, caseId } of personagens) {
        const built = buildSheetViewModel(character, context);
        if (built.ok !== true) {
          continue;
        }
        const projection = selectPersonalDetails(built.value);
        const markup = renderPersonalDetails(projection);
        const raiz = dom.document.createElement('div');
        raiz.innerHTML = markup;
        assert.equal(/\son[a-z]+=/i.test(markup), false, `${fixture}#${caseId}: handler inline`);
        const img = raiz.querySelector('[data-sheet-character-image]');
        if (img !== null) {
          // Se há `src`, ele é EXATAMENTE o resolvido pela porta.
          assert.equal(img.getAttribute('src'), projection.safeImageUrl, `${fixture}#${caseId}: src fora da porta`);
        }
        renderizadas += 1;
      }
      assert.ok(renderizadas >= 10, `apenas ${renderizadas} fixtures renderizadas`);
    } finally {
      dom.restore();
    }
  });
});
