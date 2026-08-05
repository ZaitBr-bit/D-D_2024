// ============================================================
// ROUND-TRIP DE COMPATIBILIDADE com o baseline `e43c5ea` (Task 37).
//
// Este é o ÚNICO gate de ponta a ponta do plano inteiro para o risco "o
// registro v2 do app novo continua legível e EDITÁVEL pela aplicação legada,
// e nada se perde quando volta" — depois dele o código legado interno foi
// apagado sem caminho de volta. Roda EXCLUSIVAMENTE via
// `playwright.compat.config.js` (npm run test:e2e:compat), com o app novo em
// 127.0.0.1:4173 e o baseline MATERIALIZADO (scripts/materialize-baseline.mjs)
// em 127.0.0.1:4175. Só Chromium desktop.
//
// A narrativa é SERIAL (estado compartilhado entre os testes do describe):
//
//   1. app novo: criar um Clérigo (conjurador preparado) e um Bárbaro
//      (recurso de classe no nível 1: Fúria) pela UI real do criador,
//      aplicar um override de `hp.maximum` pela UI da ficha nova (direção
//      v2 -> baseline da Task 17) e exportar tudo pela home;
//   2. baseline: importar pela UI, e aplicar TODAS as edições exigidas pelo
//      brief pela UI legada:
//        (a) override em CADA path da allowlist de edição da Task 17 —
//            a allowlist (`domain/commands/edit-character.js#
//            ALLOWED_EDIT_PATHS`) contém exatamente UM path, `hp.maximum`,
//            editado aqui pelo modal "Sobrescrever PV Máximo" do baseline;
//        (b) item de inventário customizado com peso TEXTUAL;
//        (c) preparar E despreparar magia;
//        (d) alteração de moeda;
//        (e) uso de recurso de classe (Fúria do Bárbaro);
//        (f) `_local_sync.lastMutationId` injetado no registro sobrevive aos
//            salvamentos do baseline (cenário de storage compartilhado);
//      e exportar tudo de volta;
//   3. app novo: reimportar e conferir, campo a campo, refs canônicas,
//      passthrough, overrides/edições (nas DUAS direções), inventário
//      (incluindo o texto de peso gerado pelo baseline), magias, moedas e
//      recursos — sem perda. A ficha nova abre e reflete os valores.
// ============================================================
import { test, expect } from '@playwright/test';
import fsp from 'node:fs/promises';
import { resetApp, goHome, goCreator, goFicha, expectToast, fichaIdFromUrl } from './helpers/app.js';
import { readCharacters, freezeMathRandom } from './helpers/storage.js';
import {
  selecionarClasse,
  selecionarEspecie,
  selecionarAntecedente,
  primeiroContentId,
  escolherAtributosConjuntoPadrao,
  escolherEquipamentoPadrao,
  escolherMagiasSuficientes,
  preencherDetalhes,
  proximoPasso,
  esperarPasso,
  finalizarCriacao
} from './helpers/creator.js';
import {
  abrirBaselineLimpo,
  irParaHomeBaseline,
  importarNoBaseline,
  abrirFichaBaseline,
  lerPersonagens,
  remendarPersonagem,
  exportarTodosDoBaseline
} from './helpers/baseline-app.js';

const CLERIGO = 'dnd2024:class:clerigo';
const BARBARO = 'dnd2024:class:barbaro';
const ANDARILHO = 'dnd2024:background:andarilho';

// PV máximo definido pela UI NOVA antes do export (direção v2 -> baseline) e
// o valor diferente definido pela UI do BASELINE (direção baseline -> v2).
const PV_MAX_NOVO = 21;
const PV_MAX_BASELINE = 27;
const MARCADOR_SYNC = 'roundtrip-mutation-0001';
const NOME_ITEM_CUSTOM = 'Corda de Seda do Round-Trip';

// --- Estado compartilhado da narrativa serial -------------------------------
/** @type {string} */ let clerigoId;
/** @type {string} */ let barbaroId;
/** @type {Array<object>} */ let registrosAntesDoExport = [];
/** @type {Array<object>} */ let exportadoDoNovo = [];
/** @type {Array<object>} */ let exportadoDoBaseline = [];
/** @type {string} */ let magiaPreparadaNoBaseline = '';
/** @type {string} */ let magiaDespreparadaNoBaseline = '';
/** @type {{po: number}} */ let moedasAntes = { po: 0 };

test.describe.configure({ mode: 'serial' });

/**
 * Cria um personagem completo pela UI real do criador novo e devolve o id.
 * @param {import('@playwright/test').Page} page
 * @param {string} classeId
 * @param {string} nome
 * @returns {Promise<string>}
 */
async function criarPersonagem(page, classeId, nome) {
  await goCreator(page);
  await esperarPasso(page, 'classe');
  await selecionarClasse(page, classeId);
  await proximoPasso(page);
  const especie = await primeiroContentId(page, 'grid-especies');
  await selecionarEspecie(page, especie);
  await proximoPasso(page);
  await selecionarAntecedente(page, ANDARILHO);
  await proximoPasso(page);
  await esperarPasso(page, 'atributos');
  await escolherAtributosConjuntoPadrao(page);
  await proximoPasso(page);
  await escolherEquipamentoPadrao(page);
  await proximoPasso(page);
  await escolherMagiasSuficientes(page);
  await proximoPasso(page);
  await preencherDetalhes(page, { nome });
  await finalizarCriacao(page);
  const id = fichaIdFromUrl(page.url());
  expect(id).toBeTruthy();
  return id;
}

test.describe('Round-trip app novo <-> baseline e43c5ea', () => {
  test('1. app novo: cria Clérigo e Bárbaro, aplica override v2 de hp.maximum e exporta', async ({ page }) => {
    test.setTimeout(240_000);
    await resetApp(page, { characters: [] });

    clerigoId = await criarPersonagem(page, CLERIGO, 'Round-Trip Clérigo');
    // `resetApp` congela Math.random (0.42) e o relógio: sem re-semear, o
    // `gerarId()` do segundo personagem produziria o MESMO id do primeiro.
    await freezeMathRandom(page, 0.87);
    barbaroId = await criarPersonagem(page, BARBARO, 'Round-Trip Bárbaro');
    expect(barbaroId).not.toBe(clerigoId);

    // Direção v2 -> baseline (Task 17): override de hp.maximum pela UI NOVA.
    await goFicha(page, clerigoId);
    const editor = page.locator('[data-sheet-edit-value="hp.maximum"]');
    await editor.fill(String(PV_MAX_NOVO));
    await page.locator('[data-action="edit-character-field"][data-sheet-path="hp.maximum"]').click();
    await expect(page.locator('[data-sheet-hp-maximum]')).toHaveText(String(PV_MAX_NOVO));

    // Retrato dos registros v2 como o app novo os grava (com refs canônicas).
    registrosAntesDoExport = await readCharacters(page);
    expect(registrosAntesDoExport.map((p) => p.id).sort()).toEqual([barbaroId, clerigoId].sort());
    const clerigoV2 = registrosAntesDoExport.find((p) => p.id === clerigoId);
    expect(clerigoV2.content_refs, 'o registro v2 precisa carregar refs canônicas').toBeTruthy();
    expect(clerigoV2.pv_max_override, 'o override novo precisa chegar ao campo plano legado').toBe(PV_MAX_NOVO);
    expect(clerigoV2.edicoes?.campos?.pv_max, 'espelho edicoes.campos.pv_max (Task 17)').toBeTruthy();
    moedasAntes.po = clerigoV2.moedas?.po ?? 0;

    // Exporta TODOS pela UI da home nova.
    await goHome(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btn-exportar').click()
    ]);
    exportadoDoNovo = JSON.parse(await fsp.readFile(await download.path(), 'utf8'));
    expect(exportadoDoNovo).toHaveLength(2);
    // `_local_sync` NUNCA viaja num export do app novo.
    for (const registro of exportadoDoNovo) {
      expect(registro._local_sync).toBeUndefined();
    }
  });

  test('2. baseline: importa, aplica todas as edições pela UI legada e exporta', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    expect(exportadoDoNovo.length, 'o teste 1 precisa ter exportado').toBe(2);

    await abrirBaselineLimpo(page);
    await importarNoBaseline(page, testInfo, exportadoDoNovo);
    await irParaHomeBaseline(page);

    // (f) cenário de storage compartilhado: o registro ganhou um marcador de
    // sincronização local do app novo; ele precisa sobreviver a TODOS os
    // salvamentos do baseline abaixo.
    await remendarPersonagem(page, clerigoId, { _local_sync: { lastMutationId: MARCADOR_SYNC } });

    // Direção v2 -> baseline: o override feito na UI NOVA é visível e ativo
    // no registro que o baseline carrega.
    const importados = await lerPersonagens(page);
    const clerigoImportado = importados.find((p) => p.id === clerigoId);
    expect(clerigoImportado.pv_max_override).toBe(PV_MAX_NOVO);

    // --- (a) override do ÚNICO path da allowlist da Task 17 (hp.maximum) ---
    await abrirFichaBaseline(page, clerigoId);
    await page.locator('#hp-max-override').click();
    // O picker do baseline guarda o valor num input HIDDEN (`-val`); o campo
    // digitável é o `-manual`, sincronizado no evento `change` (disparado ao
    // perder o foco).
    const manualPvMax = page.locator('#input-pv-max-manual');
    await manualPvMax.fill(String(PV_MAX_BASELINE));
    await manualPvMax.blur();
    await expect(page.locator('#input-pv-max-val')).toHaveValue(String(PV_MAX_BASELINE));
    await page.locator('#btn-aplicar-pv-max').click();
    // O valor sobrescrito aparece no mostrador "atual / máximo" da ficha.
    await expect(page.locator('.hp-pv-value')).toContainText(`/ ${PV_MAX_BASELINE}`);

    // --- (b) item customizado com peso TEXTUAL -----------------------------
    await page.locator('#btn-add-inv-custom').click();
    await page.locator('#ic-nome').fill(NOME_ITEM_CUSTOM);
    await page.locator('#ic-peso').fill('0.5');
    await page.locator('#btn-add-ic').click();
    await expect(page.locator('#sheet-inventario')).toContainText(NOME_ITEM_CUSTOM);

    // --- (c) preparar E despreparar magia pela UI legada -------------------
    await page.locator('#btn-add-magia').click();
    await page.waitForSelector('#tabs-gerenciar-magias');
    // Despreparar: remove uma magia PREPARADA DE CÍRCULO (>= 1º) vinda do
    // criador novo — só elas contam no limite de preparadas do baseline
    // (truques também moram em `magias_preparadas`, mas não liberam vaga).
    const antesDaRemocao = await lerPersonagens(page);
    const preparadaDeCirculo = (antesDaRemocao.find((p) => p.id === clerigoId).magias_preparadas || [])
      .find((m) => (m.circulo || 0) >= 1);
    expect(preparadaDeCirculo, 'o Clérigo criado no app novo precisa ter magia preparada de 1º círculo').toBeTruthy();
    magiaDespreparadaNoBaseline = preparadaDeCirculo.nome;
    const remocao = page.locator(`[data-remover-check="${magiaDespreparadaNoBaseline}"]`);
    await remocao.waitFor();
    await remocao.click();
    await expect(page.locator(`[data-remover-check="${magiaDespreparadaNoBaseline}"]`)).toHaveCount(0);
    // O contador de preparadas do modal do baseline é calculado na ABERTURA
    // (fica obsoleto após remover): fecha e reabre antes de preparar, como o
    // jogador faria ao ver todos os cards bloqueados. O fechamento re-renderiza
    // a ficha inteira (onClose), então espera o overlay sumir e o botão voltar.
    await page.locator('#modal-overlay .modal-fechar').click();
    await expect(page.locator('#modal-overlay')).toBeHidden();
    await page.waitForSelector('#btn-add-magia');
    await page.locator('#btn-add-magia').click();
    await page.waitForSelector('#tabs-gerenciar-magias');
    // Preparar: entra na aba do 1º Círculo e marca a primeira magia livre.
    await page.locator('[data-tab-mg="1"]').click();
    // Exclui a magia recém-despreparada: preparar OUTRA prova mais (troca
    // efetiva) do que re-preparar a mesma.
    const primeiroCheckLivre = page
      .locator(
        `.magia-card:not(.selecionada):not(.magia-card-bloqueada) [data-circ-check]:not([data-circ-check="${magiaDespreparadaNoBaseline}"])`,
      )
      .first();
    await primeiroCheckLivre.waitFor();
    magiaPreparadaNoBaseline = await primeiroCheckLivre.getAttribute('data-circ-check');
    expect(magiaPreparadaNoBaseline).not.toBe(magiaDespreparadaNoBaseline);
    await primeiroCheckLivre.click();
    await expect(page.locator('#toast-container .toast.success').last()).toBeVisible();
    await page.locator('#modal-overlay .modal-fechar').click();
    await expect(page.locator('#modal-overlay')).toBeHidden();

    // --- (d) alteração de moeda: +3 PO pela Carteira -----------------------
    await page.waitForSelector('#btn-edit-po');
    await page.locator('#btn-edit-po').click();
    await page.locator('#edit-moeda-po').fill('3');
    await page.locator('[data-moeda-add="po"]').click();
    await expect(page.locator('#toast-container .toast.success').last()).toBeVisible();
    await page.locator('#modal-overlay .modal-fechar').click();
    await expect(page.locator('#modal-overlay')).toBeHidden();

    // --- (e) uso de recurso de classe: Fúria do Bárbaro --------------------
    await abrirFichaBaseline(page, barbaroId);
    // O baseline renderiza o painel de Fúria duas vezes (layouts desktop e
    // compacto): agir sobre o primeiro botão é suficiente — os dois refletem
    // o mesmo estado.
    await page.locator('[data-furia-toggle="ativar"]').first().click();
    await expect(page.locator('[data-furia-toggle="desativar"]').first()).toBeVisible();

    // --- (f) o marcador local sobreviveu a todos os salvamentos ------------
    const aposEdicoes = await lerPersonagens(page);
    const clerigoEditado = aposEdicoes.find((p) => p.id === clerigoId);
    expect(clerigoEditado._local_sync?.lastMutationId, '_local_sync.lastMutationId precisa sobreviver ao salvar() do baseline').toBe(MARCADOR_SYNC);
    expect(clerigoEditado.pv_max_override).toBe(PV_MAX_BASELINE);
    expect(clerigoEditado.moedas.po).toBe(moedasAntes.po + 3);
    const nomesPreparadas = (clerigoEditado.magias_preparadas || []).map((m) => m.nome);
    expect(nomesPreparadas).toContain(magiaPreparadaNoBaseline);
    expect(nomesPreparadas).not.toContain(magiaDespreparadaNoBaseline);
    const barbaroEditado = aposEdicoes.find((p) => p.id === barbaroId);
    expect(barbaroEditado.recursos?.furia_ativa).toBe(true);
    expect(barbaroEditado.recursos?.furia_usos_gastos).toBe(1);

    // Exporta tudo de volta pela UI da home do baseline.
    await irParaHomeBaseline(page);
    exportadoDoBaseline = await exportarTodosDoBaseline(page);
    expect(exportadoDoBaseline).toHaveLength(2);
  });

  test('3. app novo: reimporta e confere refs, passthrough, overrides, inventário, magias e recursos', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    expect(exportadoDoBaseline.length, 'o teste 2 precisa ter exportado').toBe(2);

    await resetApp(page, { characters: [] });
    await goHome(page);
    const filePath = testInfo.outputPath('roundtrip-volta.json');
    await fsp.writeFile(filePath, JSON.stringify(exportadoDoBaseline, null, 2));
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('#btn-importar').click()
    ]);
    await chooser.setFiles(filePath);
    await expectToast(page, { type: 'success', text: 'importado' });

    const reimportados = await readCharacters(page);
    expect(reimportados.map((p) => p.id).sort()).toEqual([barbaroId, clerigoId].sort());
    const clerigo = reimportados.find((p) => p.id === clerigoId);
    const barbaro = reimportados.find((p) => p.id === barbaroId);
    const clerigoOriginal = registrosAntesDoExport.find((p) => p.id === clerigoId);

    // Refs canônicas preservadas byte a byte através do baseline — EXCETO os
    // pointers de `state.spells.prepared`, que o baseline legitimamente
    // editou (despreparar/preparar muda a coleção; a troca em si é conferida
    // adiante pelas listas de nomes). Tudo o mais (classe, espécie,
    // antecedente, perícias, inventário de catálogo, truques...) precisa
    // voltar intacto.
    const semPrepared = (refs) =>
      Object.fromEntries(Object.entries(refs || {}).filter(([k]) => !k.startsWith('state.spells.prepared')));
    expect(semPrepared(clerigo.content_refs)).toEqual(semPrepared(clerigoOriginal.content_refs));
    // A magia preparada no BASELINE ganhou ref canônica ao reimportar (o
    // alias resolve o nome legado para ContentId — nada fica sem origem).
    const refsPreparadas = Object.entries(clerigo.content_refs || {})
      .filter(([k]) => k.startsWith('state.spells.prepared'))
      .map(([, ref]) => ref.id);
    expect(refsPreparadas.some((id) => typeof id === 'string' && id.startsWith('dnd2024:spell:'))).toBe(true);
    // Passthrough legado intacto (identidade e progressão).
    expect(clerigo.nome).toBe('Round-Trip Clérigo');
    expect(clerigo.classe).toBe(clerigoOriginal.classe);
    expect(clerigo.nivel).toBe(clerigoOriginal.nivel);
    // Direção baseline -> v2: o override do baseline venceu e o espelho de
    // edições veio junto (Task 17, nas duas direções).
    expect(clerigo.pv_max_override).toBe(PV_MAX_BASELINE);
    // Inventário: o item customizado veio com o texto de peso GERADO pelo
    // baseline (fmtPeso: "0,5 kg"), sem normalização silenciosa.
    const itemCustom = (clerigo.inventario || []).find((i) => i.nome === NOME_ITEM_CUSTOM);
    expect(itemCustom, 'o item customizado do baseline precisa sobreviver').toBeTruthy();
    expect(itemCustom.tipo).toBe('customizado');
    expect(itemCustom.dados?.peso).toBe('0,5 kg');
    // Magias: preparar/despreparar do baseline preservados.
    const nomes = (clerigo.magias_preparadas || []).map((m) => m.nome);
    expect(nomes).toContain(magiaPreparadaNoBaseline);
    expect(nomes).not.toContain(magiaDespreparadaNoBaseline);
    // Moedas.
    expect(clerigo.moedas.po).toBe(moedasAntes.po + 3);
    // Recurso de classe do Bárbaro.
    expect(barbaro.recursos?.furia_ativa).toBe(true);
    expect(barbaro.recursos?.furia_usos_gastos).toBe(1);

    // A ficha NOVA abre os dois personagens e reflete os valores do baseline.
    await goFicha(page, clerigoId);
    await expect(page.locator('[data-sheet-hp-maximum]')).toHaveText(String(PV_MAX_BASELINE));
    await expect(page.locator('[data-action="revert-character-edit"][data-sheet-path="hp.maximum"]')).toBeVisible();
    await goFicha(page, barbaroId);
    await expect(page.locator('[data-sheet-section="summary-combat"]')).toBeVisible();
  });
});
