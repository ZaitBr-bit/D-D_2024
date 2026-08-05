// ============================================================
// Harness E2E da arquitetura NOVA da ficha (Task 29).
//
// Roda contra `tests/e2e/harness/sheet.html`, servido pelo mesmo servidor
// estático dos demais specs mas FORA de `site/` — ou seja, fora do artifact
// publicado no Pages. A ficha pública continua sendo o monólito legado até a
// Task 33; este spec prova, num navegador real, que a arquitetura nova
// funciona antes de qualquer cutover:
//
//   - o DOM identifica QUAL módulo está montado (`data-sheet-module`);
//   - duas fichas simultâneas na MESMA página não trocam estado, nem UI state,
//     nem preferência de colapso;
//   - a delegação de eventos é real (nenhum `onclick` inline) e sobrevive ao
//     rerender parcial — inclusive DENTRO do modal;
//   - o rerender é PARCIAL de verdade: só o miolo da seção suja é reescrito, e
//     os contêineres das demais seções mantêm a mesma identidade de nó;
//   - dois comandos no mesmo tick serializam com o `expectedRevisionToken`
//     correto (a corrida real, num navegador real);
//   - uma falha de save local descarta o candidato e deixa retry disponível;
//   - o disposer deixa a página inerte.
//
// Task 30: as três primeiras seções (`summary-combat`, `resources-features`,
// `feats-progression`) passaram a ser as REAIS, de uma vez só. As quatro
// restantes continuam placeholders até as Tasks 31/32 — por isso os seletores
// abaixo são de dois vocabulários: `data-sheet-*` para as reais e
// `data-placeholder-*` para as que ainda não migraram.
// ============================================================
import { test, expect } from '@playwright/test';

const HARNESS_URL = '/tests/e2e/harness/sheet.html';

const FICHA_A = '#sheet-a';
const FICHA_B = '#sheet-b';

/**
 * Abre o harness e monta as duas fichas.
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 */
async function abrirHarness(page, options = {}) {
  await page.goto(HARNESS_URL);
  await page.waitForFunction(() => typeof window.__sheetHarness?.start === 'function');
  await page.evaluate((opcoes) => window.__sheetHarness.start(opcoes), options);
  await page.waitForSelector('body[data-harness-ready="true"]');
}

/**
 * Snapshot serializável de uma das fichas.
 * @param {import('@playwright/test').Page} page
 * @param {number} indice
 * @returns {Promise<object>}
 */
function snapshot(page, indice) {
  return page.evaluate((i) => window.__sheetHarness.snapshot(i), indice);
}

test.describe('harness da ficha (features/sheet)', () => {
  test('monta as duas fichas, identifica o módulo e desenha as sete seções @critical', async ({ page }) => {
    await abrirHarness(page);

    const raiz = page.locator(`${FICHA_A} [data-sheet-module]`);
    await expect(raiz).toHaveAttribute('data-sheet-module', 'features/sheet (harness)');
    await expect(raiz).toHaveAttribute('data-sheet-mode', 'editable');
    await expect(page.locator(`${FICHA_A} [data-sheet-section]`)).toHaveCount(7);
    await expect(page.locator(`${FICHA_B} [data-sheet-section]`)).toHaveCount(7);

    // Cada ficha mostra o SEU personagem.
    await expect(page.locator(`${FICHA_A} [data-sheet-character-name]`).first()).toHaveText('Alfa');
    await expect(page.locator(`${FICHA_B} [data-sheet-character-name]`).first()).toHaveText('Beta');
  });

  test('nenhum handler inline: o markup da ficha não tem on*= @critical', async ({ page }) => {
    await abrirHarness(page);
    const markup = await page.locator(FICHA_A).innerHTML();
    expect(markup).not.toMatch(/\son[a-z]+\s*=/i);
  });

  test('um comando numa ficha não altera a outra @critical', async ({ page }) => {
    await abrirHarness(page);
    await page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-action="apply-damage"]`).click();
    await expect(page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-sheet-hp-current]`)).toHaveText('9');
    await expect(page.locator(`${FICHA_B} [data-sheet-section="summary-combat"] [data-sheet-hp-current]`)).toHaveText('20');

    const a = await snapshot(page, 0);
    const b = await snapshot(page, 1);
    expect(a.hitPointsCurrent).toBe(9);
    expect(b.hitPointsCurrent).toBe(20);
    expect(a.dirtySections).toEqual(['summary-combat']);
  });

  test('o rerender é PARCIAL: só o miolo da seção suja é reescrito', async ({ page }) => {
    await abrirHarness(page);

    // Marca cada miolo com um atributo próprio; um rerender total apagaria as
    // marcas de TODAS as seções, e não só a da seção suja.
    await page.evaluate(() => {
      for (const body of document.querySelectorAll('#sheet-a [data-sheet-section-body]')) {
        body.setAttribute('data-marca', 'antes');
      }
    });

    await page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-action="apply-damage"]`).click();
    await expect(page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-sheet-hp-current]`)).toHaveText('9');

    // As marcas continuam TODAS lá: o controller reescreve o CONTEÚDO do
    // miolo sujo, nunca recria os contêineres.
    const marcas = await page.locator('#sheet-a [data-sheet-section-body][data-marca="antes"]').count();
    expect(marcas).toBe(7);
  });

  test('dois comandos no MESMO tick serializam com o token correto @critical', async ({ page }) => {
    await abrirHarness(page);

    const resultados = await page.evaluate(() =>
      window.__sheetHarness.dispatchConcurrent(0, { type: 'apply-damage', amount: 2 }, { type: 'apply-damage', amount: 3 }),
    );
    expect(resultados.every((entrada) => entrada.ok)).toBe(true);

    const escritas = await page.evaluate(() => window.__sheetHarness.writes());
    expect(escritas.map((entrada) => entrada.expectedRevisionToken)).toEqual(['harn-essa-0001-0', 'harn-essa-0001-1']);

    // Os dois danos foram aplicados: nenhum sobrescreveu o outro.
    expect((await snapshot(page, 0)).hitPointsCurrent).toBe(5);
  });

  test('colapsar uma seção é preferência da ficha e não vaza para a outra', async ({ page }) => {
    await abrirHarness(page);
    await page.locator(`${FICHA_A} [data-sheet-toggle="spells-spellbook"]`).click();
    await expect(page.locator(`${FICHA_A} [data-sheet-section="spells-spellbook"]`)).toHaveAttribute('data-collapsed', 'true');
    await expect(page.locator(`${FICHA_B} [data-sheet-section="spells-spellbook"]`)).toHaveAttribute('data-collapsed', 'false');

    const guardado = await page.evaluate(() => ({
      a: window.__sheetHarness.preferences.porFicha.get('harn-essa-0001') ?? null,
      b: window.__sheetHarness.preferences.porFicha.get('harn-essb-0002') ?? null,
    }));
    expect(guardado.a).toEqual({ 'spells-spellbook': true });
    expect(guardado.b).toBeNull();
  });

  test('o modal é efeito do controller e cliques dentro dele chegam à seção', async ({ page }) => {
    // Task 30: agora com o modal REAL — o fluxo de level-up de
    // `feats-progression`. A preferência do harness devolve
    // `getLevelUpFlowV2: false`, então o modo desenhado é o LEGADO, o mesmo
    // que o oráculo `levelup-flow-v2-false` congela.
    await abrirHarness(page);
    await page.locator(`${FICHA_A} [data-sheet-section="feats-progression"] [data-action="level-up-open"]`).click();

    await expect(page.locator('#modal-titulo')).toHaveText('Level Up V2 desativado');
    const cancelar = page.locator('#modal-acoes [data-action="level-up-close"]');
    await expect(cancelar).toBeVisible();

    // Cancelar é fechamento puro: nenhum comando, nenhuma alteração no
    // personagem. O PV continua exatamente onde estava.
    await cancelar.click();
    await expect(page.locator('#modal-overlay')).toBeHidden();
    await expect(page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-sheet-hp-current]`)).toHaveText('10');
  });

  test('falha de save local: candidato descartado e retry disponível @critical', async ({ page }) => {
    await abrirHarness(page);
    await page.evaluate(() => window.__sheetHarness.setFalharSave(true));

    const falhou = await page.evaluate(() => window.__sheetHarness.dispatch(0, { type: 'apply-damage', amount: 4 }));
    expect(falhou.ok).toBe(false);
    expect(falhou.code).toBe('HARNESS_SAVE_FAILED');
    expect(typeof falhou.failureId).toBe('string');

    // Nada foi adotado: a tela continua no estado confirmado.
    await expect(page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-sheet-hp-current]`)).toHaveText('10');
    const comFalha = await snapshot(page, 0);
    expect(comFalha.failures.some((falha) => falha.failureId === falhou.failureId)).toBe(true);

    // O aviso com botão de retry está no DOM, desenhado pelo controller.
    await expect(page.locator(`${FICHA_A} [data-sheet-retry="${falhou.failureId}"]`)).toBeVisible();

    // Retry pelo próprio botão, depois que o local volta.
    await page.evaluate(() => window.__sheetHarness.setFalharSave(false));
    await page.locator(`${FICHA_A} [data-sheet-retry="${falhou.failureId}"]`).click();
    await expect(page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-sheet-hp-current]`)).toHaveText('6');
  });

  test('o disposer deixa a página inerte @critical', async ({ page }) => {
    await abrirHarness(page);
    await page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-action="apply-damage"]`).click();
    await expect(page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-sheet-hp-current]`)).toHaveText('9');

    await page.evaluate(() => window.__sheetHarness.disposeAll());
    await page.waitForSelector('body[data-harness-disposed="true"]');

    // O markup continua na tela, mas nenhum clique faz mais nada.
    await page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-action="apply-damage"]`).click();
    await page.waitForTimeout(50);
    await expect(page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-sheet-hp-current]`)).toHaveText('9');
  });

  test('as ações de classe são projetadas e EXECUTAM num navegador real @critical', async ({ page }) => {
    // Correção do achado Important 2 da revisão: antes, o personagem do harness
    // não tinha classe e a sessão não recebia a porta de handlers — então a
    // única cobertura em navegador da seção mais arriscada desta task era o
    // estado "indisponível". Agora as ações do Bárbaro aparecem e uma delas é
    // executada de verdade, contra o catálogo real.
    await abrirHarness(page);

    const secao = `${FICHA_A} [data-sheet-section="resources-features"]`;
    await expect(page.locator(`${secao} [data-sheet-class-actions-unavailable]`)).toHaveCount(0);
    const acoes = page.locator(`${secao} [data-action="class-action"]`);
    expect(await acoes.count()).toBeGreaterThan(5);

    // Fúria começa em 2 usos materializados; entrar em Fúria gasta 1.
    const furias = page.locator(`${secao} [data-sheet-resource$=":resource:furias"] [data-sheet-resource-current]`);
    await expect(furias).toHaveText('2');
    await page.locator(`${secao} [data-action-id="entrar-em-furia"]`).click();
    await expect(furias).toHaveText('1');

    // E a outra ficha não foi tocada: o isolamento vale para ações de classe.
    await expect(
      page.locator(`${FICHA_B} [data-sheet-section="resources-features"] [data-sheet-resource$=":resource:furias"] [data-sheet-resource-current]`),
    ).toHaveText('2');
  });

  test('o descanso curto aplica o `onRest` da classe no MESMO comando', async ({ page }) => {
    // O Bárbaro recupera EXATAMENTE 1 uso de Fúria num descanso curto — regra
    // que só existe no handler. Se `short-rest` não compusesse o `onRest`, este
    // número não mudaria e nada acusaria.
    await abrirHarness(page);
    const secao = `${FICHA_A} [data-sheet-section="resources-features"]`;
    const furias = page.locator(`${secao} [data-sheet-resource$=":resource:furias"] [data-sheet-resource-current]`);

    await page.locator(`${secao} [data-action-id="entrar-em-furia"]`).click();
    await expect(furias).toHaveText('1');
    await page.locator(`${secao} [data-action="short-rest"]`).click();
    await expect(furias).toHaveText('2');
  });

  test('"Ativar V2 e continuar" PERSISTE a preferência (não só reabre o modal) @critical', async ({ page }) => {
    // Achado Important 1 da revisão: o botão reproduzia o DOM do baseline mas
    // não o EFEITO. A asserção decisiva é a última — fechar e reabrir do zero
    // tem de continuar em cards.
    await abrirHarness(page);
    const abrir = `${FICHA_A} [data-sheet-section="feats-progression"] [data-action="level-up-open"]`;

    await page.locator(abrir).click();
    await expect(page.locator('#modal-titulo')).toHaveText('Level Up V2 desativado');

    await page.locator('#btn-enable-levelup-v2').click();
    await expect(page.locator('#modal-titulo')).toHaveText('Subir de Nível');

    // A preferência foi gravada de verdade, não só usada para redesenhar.
    expect(await page.evaluate(() => window.__sheetHarness.preferences.flags.levelUpFlowV2)).toBe(true);

    await page.locator('#modal-acoes [data-action="level-up-close"]').click();
    await page.locator(abrir).click();
    await expect(page.locator('#modal-titulo')).toHaveText('Subir de Nível');
    await expect(page.locator('#btn-enable-levelup-v2')).toHaveCount(0);
  });

  // --- Task 31: magias/concentração e condições, em navegador REAL ---------

  test('conjurar gasta o espaço escolhido e a tela reflete, sem tocar o pool de pacto @critical', async ({ page }) => {
    await abrirHarness(page);
    const secao = `${FICHA_A} [data-sheet-section="spells-spellbook"]`;
    const disponivel = page.locator(`${secao} [data-sheet-slot-level="1"] [data-sheet-slot-available]`);
    await expect(disponivel).toHaveText('4');

    await page.locator(`${secao} [data-action="spell-cast-open"][data-spell-id="dnd2024:spell:misseis-magicos"]`).click();
    await page.locator('#modal-corpo [data-sheet-cast-slot-source][value="spell-slot:1"]').check();
    await page.locator('#modal-acoes [data-action="cast-spell"]').click();

    await expect(disponivel).toHaveText('3');
    // A OUTRA ficha não foi tocada: o isolamento entre sessões continua valendo.
    await expect(page.locator(`${FICHA_B} [data-sheet-section="spells-spellbook"] [data-sheet-slot-level="1"] [data-sheet-slot-available]`)).toHaveText('4');
  });

  test('CANCELAR a substituição de concentração não muda nada; CONFIRMAR troca de uma vez @critical', async ({ page }) => {
    await abrirHarness(page);
    const secao = `${FICHA_A} [data-sheet-section="spells-spellbook"]`;
    const MISSEIS = 'dnd2024:spell:misseis-magicos';
    const TEIA = 'dnd2024:spell:teia';

    // Passa a concentrar na primeira magia (sem concentração ativa, é comando direto).
    await page.locator(`${secao} [data-action="spell-concentration-open"][data-spell-id="${MISSEIS}"]`).click();
    await expect(page.locator(`${secao} [data-sheet-concentration="${MISSEIS}"]`)).toHaveCount(1);
    const escritasAntes = (await page.evaluate(() => window.__sheetHarness.writes())).length;

    // Agora a segunda exige confirmação — e CANCELAR não pode mudar nada.
    await page.locator(`${secao} [data-action="spell-concentration-open"][data-spell-id="${TEIA}"]`).click();
    await expect(page.locator('#modal-corpo [data-sheet-concentration-current]')).toHaveText(MISSEIS);
    await page.locator('#modal-acoes [data-action="spell-concentration-close"]').click();
    await expect(page.locator(`${secao} [data-sheet-concentration="${MISSEIS}"]`)).toHaveCount(1);
    expect((await page.evaluate(() => window.__sheetHarness.writes())).length).toBe(escritasAntes);

    // CONFIRMAR: uma escrita só, e a troca completa.
    await page.locator(`${secao} [data-action="spell-concentration-open"][data-spell-id="${TEIA}"]`).click();
    await page.locator('#modal-acoes [data-action="set-concentration"]').click();
    await expect(page.locator(`${secao} [data-sheet-concentration="${TEIA}"]`)).toHaveCount(1);
    expect((await page.evaluate(() => window.__sheetHarness.writes())).length).toBe(escritasAntes + 1);
  });

  test('REABRIR o modal de conjuração para outra magia não vaza o formulário @critical', async ({ page }) => {
    // Cenário que a revisão da Task 30 previu para o segundo produtor de modal.
    //
    // Achado desta task: com o modal REAL aberto, o overlay cobre a ficha e
    // intercepta o ponteiro — então a reabertura do MESMO `modalId` a partir de
    // um botão da ficha é INALCANÇÁVEL num navegador (o clique nem chega ao
    // botão). O caminho de reabertura direta continua coberto em memória por
    // `tests/integration/sheet-spells-conditions.test.js`; aqui o percurso é o
    // que o jogador de fato consegue fazer: fechar e abrir para outra magia.
    await abrirHarness(page);
    const secao = `${FICHA_A} [data-sheet-section="spells-spellbook"]`;

    await page.locator(`${secao} [data-action="spell-cast-open"][data-spell-id="dnd2024:spell:misseis-magicos"]`).click();
    await page.locator('#modal-corpo [data-sheet-cast-slot-source][value="spell-slot:2"]').check();

    await page.locator('#modal-acoes [data-action="spell-cast-close"]').click();
    await page.locator(`${secao} [data-action="spell-cast-open"][data-spell-id="dnd2024:spell:teia"]`).click();
    await expect(page.locator('#modal-corpo [data-sheet-cast-form]')).toHaveAttribute('data-spell-id', 'dnd2024:spell:teia');
    await expect(page.locator('#modal-corpo [data-sheet-cast-slot-source][value="spell-slot:2"]')).not.toBeChecked();
    // Nenhuma opção nasce marcada: pré-marcar "à vontade" fazia um confirmar
    // sem escolha conjurar de graça uma magia de círculo.
    await expect(page.locator('#modal-corpo [data-sheet-cast-slot-source][value="at-will"]')).not.toBeChecked();
    await expect(page.locator('#modal-corpo [data-sheet-cast-slot-source]:checked')).toHaveCount(0);
  });

  test('adicionar e remover condição são exatamente inversos na tela e no registro', async ({ page }) => {
    await abrirHarness(page);
    const secao = `${FICHA_A} [data-sheet-section="conditions-defenses-senses"]`;
    await expect(page.locator(`${secao} [data-sheet-condition="enfeiticado"]`)).toHaveCount(1);

    await page.locator(`${secao} [data-sheet-condition-input]`).fill('atordoado');
    await page.locator(`${secao} [data-action="add-condition"]`).click();
    await expect(page.locator(`${secao} [data-sheet-condition="atordoado"]`)).toHaveCount(1);

    await page.locator(`${secao} [data-action="remove-condition"][data-condition-id="atordoado"]`).click();
    await expect(page.locator(`${secao} [data-sheet-condition="atordoado"]`)).toHaveCount(0);
    await expect(page.locator(`${secao} [data-sheet-condition="enfeiticado"]`)).toHaveCount(1);
    // A outra ficha nunca viu nada disso.
    await expect(page.locator(`${FICHA_B} [data-sheet-section="conditions-defenses-senses"] [data-sheet-condition="atordoado"]`)).toHaveCount(0);
  });

  // ------------------------------------------------------------------
  // Task 32 — inventário/carga/moedas e detalhes pessoais, as duas últimas
  // seções. Com elas o harness passa a montar SETE seções reais.
  // ------------------------------------------------------------------

  test('o inventário mostra os três grupos e equipar/desequipar funciona na tela @critical', async ({ page }) => {
    await abrirHarness(page);
    const secao = `${FICHA_A} [data-sheet-section="inventory-load-coins"]`;
    await expect(page.locator(`${secao} [data-sheet-item-group="equipped"]`)).toHaveAttribute('data-count', '1');
    await expect(page.locator(`${secao} [data-sheet-item-group="backpack"]`)).toHaveAttribute('data-count', '1');
    await expect(page.locator(`${secao} [data-sheet-item-group="depleted"]`)).toHaveAttribute('data-count', '1');

    // Equipar move o item de grupo: é a prova de que o comando chegou ao
    // domínio e a projeção voltou pela sessão.
    await page.locator(`${secao} [data-sheet-item="inv-2"] [data-action="equip-item"]`).click();
    await expect(page.locator(`${secao} [data-sheet-item-group="equipped"]`)).toHaveAttribute('data-count', '2');
    await expect(page.locator(`${secao} [data-sheet-item-group="backpack"]`)).toHaveAttribute('data-count', '0');
    // A outra ficha nunca viu nada disso.
    await expect(page.locator(`${FICHA_B} [data-sheet-section="inventory-load-coins"] [data-sheet-item-group="equipped"]`)).toHaveAttribute(
      'data-count',
      '1',
    );
  });

  test('quantidade e remoção operam por instanceId, e o esgotado volta a ativo', async ({ page }) => {
    await abrirHarness(page);
    const secao = `${FICHA_A} [data-sheet-section="inventory-load-coins"]`;
    // O item esgotado (quantidade 0) volta para a mochila ao ganhar 1.
    await page.locator(`${secao} [data-sheet-item="inv-3"] [data-action="change-item-quantity"][data-delta="1"]`).click();
    await expect(page.locator(`${secao} [data-sheet-item-group="backpack"] [data-sheet-item="inv-3"]`)).toHaveCount(1);
    await expect(page.locator(`${secao} [data-sheet-item-group="depleted"]`)).toHaveAttribute('data-count', '0');

    await page.locator(`${secao} [data-sheet-item="inv-3"] [data-action="remove-inventory-item"]`).click();
    await expect(page.locator(`${secao} [data-sheet-item="inv-3"]`)).toHaveCount(0);
  });

  test('a carteira opera por denominação e o total só existe com taxa de câmbio', async ({ page }) => {
    await abrirHarness(page);
    const secao = `${FICHA_A} [data-sheet-section="inventory-load-coins"]`;
    await expect(page.locator(`${secao} [data-sheet-wallet-denomination="po"] [data-sheet-wallet-value]`)).toHaveText('12');

    await page.locator(`${secao} [data-sheet-wallet-quantity="po"]`).fill('3');
    await page.locator(`${secao} [data-sheet-wallet-denomination="po"] [data-wallet-operation="add"]`).click();
    await expect(page.locator(`${secao} [data-sheet-wallet-denomination="po"] [data-sheet-wallet-value]`)).toHaveText('15');

    // A prata não foi tocada: cada botão lê o campo da SUA denominação.
    await expect(page.locator(`${secao} [data-sheet-wallet-denomination="pp"] [data-sheet-wallet-value]`)).toHaveText('4');
    // Com o ruleset oficial ativo, as taxas existem e o total é um número.
    await expect(page.locator(`${secao} [data-sheet-wallet]`)).toHaveAttribute('data-rates-available', 'true');
    await expect(page.locator(`${secao} [data-sheet-wallet-total-copper]`)).not.toHaveText('—');
  });

  test('o modal de compra adiciona item e cancelar não muda nada', async ({ page }) => {
    await abrirHarness(page);
    const secao = `${FICHA_A} [data-sheet-section="inventory-load-coins"]`;

    // 1) Cancelar: nada é criado.
    await page.locator(`${secao} [data-action="sheet-inventory-purchase-open"]`).click();
    await page.locator('#modal-corpo [data-sheet-purchase-item-id]').fill('dnd2024:weapon:adaga');
    await page.locator('#modal-acoes [data-action="sheet-inventory-purchase-close"]').click();
    await expect(page.locator(`${secao} [data-sheet-item]`)).toHaveCount(3);

    // 2) Confirmar: exatamente um item novo, com id determinístico.
    await page.locator(`${secao} [data-action="sheet-inventory-purchase-open"]`).click();
    await page.locator('#modal-corpo [data-sheet-purchase-item-id]').fill('dnd2024:weapon:adaga');
    // A VERSÃO DO PACOTE é campo do formulário desde a Task 33: `contentRef`
    // exige `id` E `packageVersion`, e sem ela o personagem resultante ficava
    // inválido — o item era aceito pelo comando e sumia ao salvar.
    await page.locator('#modal-corpo [data-sheet-purchase-item-version]').fill('1.0.0');
    await page.locator('#modal-corpo [data-sheet-purchase-quantity]').fill('2');
    await page.locator('#modal-acoes [data-action="add-inventory-item"]').click();
    await expect(page.locator(`${secao} [data-sheet-item="sheet-item-1"]`)).toHaveCount(1);
  });

  // ATUALIZAÇÃO CONSCIENTE (correção I2 da revisão final): este teste travava
  // a RECUSA da edição de identidade. A allowlist do domínio agora cobre
  // `identity.*`, então gravar precisa PRODUZIR o efeito — e o escape do
  // texto do jogador continua garantido, inclusive para o texto EDITADO.
  test('os detalhes pessoais escapam o texto do jogador e a edição de identidade produz efeito', async ({ page }) => {
    await abrirHarness(page);
    const secao = `${FICHA_A} [data-sheet-section="personal-details"]`;
    await expect(page.locator(`${secao} [data-sheet-detail-field="alignment"] [data-sheet-detail-value]`)).toHaveText('Caótico Neutro');
    // O campo com HTML cru é TEXTO, nunca elemento.
    await expect(page.locator(`${secao} [data-sheet-detail-field="appearance"] [data-sheet-detail-value]`)).toHaveText(
      '<b>markup</b> & "aspas"',
    );
    expect(await page.locator(`${secao} b`).count()).toBe(0);

    // A nota de identidade saiu (a dívida foi paga); a de imagem permanece.
    await expect(page.locator(`${secao} [data-sheet-identity-edit-unavailable]`)).toHaveCount(0);
    await expect(page.locator(`${secao} [data-sheet-image-edit-unavailable]`)).toHaveCount(1);
    await page.locator(`${secao} [data-action="sheet-personal-details-open"]`).click();
    await page.locator('#modal-corpo [data-sheet-detail-input="alignment"]').fill('Leal e Mau');
    await page.locator('#modal-corpo [data-action="edit-character-field"][data-path="identity.alignment"]').click();
    await page.locator('#modal-acoes [data-action="sheet-personal-details-close"]').click();
    await expect(page.locator(`${secao} [data-sheet-detail-field="alignment"] [data-sheet-detail-value]`)).toHaveText('Leal e Mau');

    // Texto editado HOSTIL continua escapado (o escape não depende do valor
    // vir do registro: o caminho de edição também passa por ele).
    await page.locator(`${secao} [data-action="sheet-personal-details-open"]`).click();
    await page.locator('#modal-corpo [data-sheet-detail-input="alignment"]').fill('<i>italico</i>');
    await page.locator('#modal-corpo [data-action="edit-character-field"][data-path="identity.alignment"]').click();
    await page.locator('#modal-acoes [data-action="sheet-personal-details-close"]').click();
    await expect(page.locator(`${secao} [data-sheet-detail-field="alignment"] [data-sheet-detail-value]`)).toHaveText('<i>italico</i>');
    expect(await page.locator(`${secao} i`).count()).toBe(0);
  });

  test('as QUATRO preferências legadas voltam depois de remontar as fichas @critical', async ({ page }) => {
    await abrirHarness(page);
    // Colapso (por ficha), compra equipada e flag de level-up passam pelo UI
    // state; as taxas de moeda são lidas da porta. As quatro compõem o
    // vocabulário do repositório legado.
    await page.locator(`${FICHA_A} [data-sheet-toggle="inventory-load-coins"]`).click();
    await page.locator(`${FICHA_A} [data-sheet-toggle="personal-details"]`).click();
    await page.evaluate(() => window.__sheetHarness.setUiState(0, { purchaseEquippedDefault: true }));
    await page.evaluate(() => window.__sheetHarness.setUiState(0, { levelUpFlowV2: true }));

    await page.evaluate(() => window.__sheetHarness.remount());
    await page.waitForSelector('body[data-harness-remounted="true"]');

    const preferencias = await page.evaluate(() => window.__sheetHarness.preferenceSnapshot());
    expect(preferencias.purchaseEquippedDefault).toBe(true);
    expect(preferencias.levelUpFlowV2).toBe(true);
    expect(preferencias.collapse.a).toEqual({ 'inventory-load-coins': true, 'personal-details': true });
    expect(preferencias.collapse.b).toBeNull();

    // O colapso voltou para a TELA, não só para o objeto de preferências.
    await expect(page.locator(`${FICHA_A} [data-sheet-section="inventory-load-coins"]`)).toHaveAttribute('data-collapsed', 'true');
    await expect(page.locator(`${FICHA_A} [data-sheet-section="personal-details"]`)).toHaveAttribute('data-collapsed', 'true');
    await expect(page.locator(`${FICHA_B} [data-sheet-section="inventory-load-coins"]`)).toHaveAttribute('data-collapsed', 'false');

    // E a preferência de compra chega ao modal: a caixa nasce marcada. (A seção
    // está colapsada — o corpo vem com `hidden` —, então ela é reaberta antes.)
    await page.locator(`${FICHA_A} [data-sheet-toggle="inventory-load-coins"]`).click();
    await expect(page.locator(`${FICHA_A} [data-sheet-section="inventory-load-coins"]`)).toHaveAttribute('data-collapsed', 'false');
    await page.locator(`${FICHA_A} [data-sheet-section="inventory-load-coins"] [data-action="sheet-inventory-purchase-open"]`).click();
    await expect(page.locator('#modal-corpo [data-sheet-purchase-equipped]')).toBeChecked();
  });

  test('conteúdo hostil no nome do personagem nunca executa', async ({ page }) => {
    await abrirHarness(page, { nameA: '<img src=x onerror="window.__xss=1">' });
    await page.waitForTimeout(50);
    const executou = await page.evaluate(() => window.__xss === 1);
    expect(executou).toBe(false);
    await expect(page.locator(`${FICHA_A} [data-sheet-section="summary-combat"] [data-sheet-character-name]`)).toHaveText(
      '<img src=x onerror="window.__xss=1">',
    );
    expect(await page.locator(`${FICHA_A} img`).count()).toBe(0);
  });
});
