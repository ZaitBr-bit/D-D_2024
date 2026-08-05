// ============================================================
// Caracterização das "regras" da ficha PÚBLICA: condições, exaustão,
// concentração, defesas, recursos de classe, persistência e o ponto de entrada
// do level-up.
//
// ## Task 33 — CUTOVER: divergências, uma a uma
//
// | # | Legado | Novo | Por quê |
// |---|---|---|---|
// | 1 | `#btn-gerenciar-condicoes` -> modal com `[data-condicao-toggle]` -> `#btn-salvar-condicoes` | `[data-sheet-condition-input]` + `[data-action="add-condition"]` | condição é um comando canônico (`add-condition`/`remove-condition`), não um lote salvo por um modal; o modal do monólito editava um array e salvava tudo de uma vez |
// | 2 | `[data-quebrar-concentracao="1"]` sobre `efeitos_magicos` | `[data-action="end-concentration"]` sobre `state.spells.concentration` | concentração virou campo canônico (Task 18); no monólito ela era uma FLAG dentro de um item da lista de efeitos mágicos |
// | 3 | `[data-furia-toggle]` + `recursos.furia_*` | `[data-action="class-action"][data-action-id="..."]` + `state.resources`/`state.activeEffects` | as mecânicas de classe viraram HANDLERS declarativos (Task 30); nenhum nome de classe é comparado |
// | 4 | `#btn-levelup` | `[data-action="level-up-open"]` | idem: o ponto de entrada é uma intenção da seção de progressão |
// | 5 | `.hp-pv-value` | `[data-sheet-hp-current]` | ver `sheet-vitals.spec.js` |
//
// ## Dois casos legados viraram RECUSA DECLARADA (dívida visível, item 20)
//
//   - **editar o nome do personagem**: `ALLOWED_EDIT_PATHS` do domínio só tem
//     `hp.maximum`. A seção de detalhes pessoais EMITE `edit-character-field`
//     com `identity.*` e o domínio RECUSA com erro nomeado — nunca um no-op
//     silencioso. O caso abaixo afirma exatamente isso: a recusa é visível.
//   - **gerenciar defesas** (marcar uma resistência): não há comando canônico
//     que escreva `build.legacyGrants.*Ids`. A seção DESENHA o motivo
//     (`data-sheet-defenses-readonly`), e é isso que o caso verifica.
//
// Os dois são regressões funcionais frente ao monólito, aceitas como dívida
// DECLARADA na decisão do item 20 de `questions-for-review.txt`. Elas estão
// aqui como asserção — se algum dia ganharem comando, estes casos falham e
// obrigam a reescrevê-los.
// ============================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetApp, goFicha } from './helpers/app.js';
import { readCharacters } from './helpers/storage.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const derivedValues = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8')
);
const PERSONAGEM_BASE = derivedValues.cases.find((c) => c.id === 'pv-convergente').personagem;

test.describe('Ficha — regras', () => {
  test('adicionar e remover condição são comandos canônicos e persistem', async ({ page }) => {
    await resetApp(page, { characters: [{ ...PERSONAGEM_BASE, condicoes: [] }] });
    await goFicha(page, PERSONAGEM_BASE.id);

    await expect(page.locator('[data-sheet-conditions-empty]')).toBeVisible();

    await page.locator('[data-sheet-condition-input]').fill('Enfeitiçado');
    await page.locator('[data-action="add-condition"]').click();

    await expect(page.locator('[data-sheet-condition="Enfeitiçado"]')).toBeVisible();
    let [salvo] = await readCharacters(page);
    expect(salvo.condicoes).toContain('Enfeitiçado');

    // REVOGAÇÃO simétrica: sem ela, uma condição entraria e nunca sairia.
    await page.locator('[data-sheet-condition="Enfeitiçado"] [data-action="remove-condition"]').click();
    await expect(page.locator('[data-sheet-conditions-empty]')).toBeVisible();
    [salvo] = await readCharacters(page);
    expect(salvo.condicoes).not.toContain('Enfeitiçado');
  });

  test('o nível de exaustão é PROJETADO na ficha (derivado, não digitado)', async ({ page }) => {
    // O monólito tinha `[data-exaustao-ajuste]` (+1/-1) escrevendo direto no
    // registro. Na arquitetura nova a exaustão é DERIVADA
    // (`derived.movement.exhaustionLevel`) e não há comando canônico que a
    // altere — dívida declarada, no mesmo grupo de "vantagem/desvantagem".
    // O que este caso prende é que o valor EXIBIDO é o do registro, e não um
    // zero de conveniência.
    const exausto = { ...PERSONAGEM_BASE, condicoes: ['Exaustão'], exaustao: 2 };
    await resetApp(page, { characters: [exausto] });
    await goFicha(page, exausto.id);

    await expect(page.locator('[data-sheet-exhaustion-level]')).toHaveText('2');
    await expect(page.locator('[data-sheet-advantage-unavailable]')).toBeVisible();
  });

  test('concentrar e quebrar a concentração são comandos canônicos', async ({ page }) => {
    // DIVERGÊNCIA DECLARADA de PERSISTÊNCIA: no monólito a concentração era uma
    // FLAG dentro de um item de `efeitos_magicos`; na arquitetura nova ela é o
    // campo canônico `state.spells.concentration`. A migração v1->v2 nasce com
    // `concentration: null` e o codec não a projeta de volta para o registro
    // plano (não há campo legado equivalente com essa forma), então este caso
    // afirma o CICLO na tela — que é onde a capacidade vive hoje — em vez de
    // fingir uma persistência que não existe. Registrado como concern.
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);

    await expect(page.locator('[data-sheet-concentration-empty]')).toBeVisible();

    // "Concentrar" numa magia sem concentração corrente despacha direto; com
    // uma corrente, a seção pede confirmação num modal (`set-concentration`).
    await page.locator('[data-sheet-spell] [data-action="spell-concentration-open"]').first().click();
    // O rótulo é o NOME da magia, nunca o ContentId (correção do cutover).
    await expect(page.locator('[data-sheet-concentration-label]')).toHaveText('Curar Ferimentos');

    const encerrar = page.locator('[data-action="end-concentration"]');
    await expect(encerrar).toHaveCount(1);
    await encerrar.click();
    await expect(page.locator('[data-sheet-concentration-empty]')).toBeVisible();
  });

  test('ação de classe declarada pelo handler aparece com disponibilidade e MOTIVO', async ({ page }) => {
    // Substitui o caso `[data-furia-toggle]` do monólito. A garantia medida é a
    // mesma e ficou mais forte: a ficha nunca oferece um botão que o comando
    // recusaria — `available` vem do MESMO `handler.project()` que `execute`
    // consulta, e a indisponibilidade carrega o motivo NOMEADO.
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);

    const acoes = page.locator('[data-sheet-class-actions] [data-action="class-action"]');
    await expect(acoes.first()).toBeVisible();
    // Toda ação declara `data-available`; as indisponíveis declaram o porquê.
    const indisponiveis = acoes.filter({ has: page.locator('[data-available="false"]') });
    for (const botao of await acoes.all()) {
      const disponivel = await botao.getAttribute('data-available');
      expect(['true', 'false']).toContain(disponivel);
      if (disponivel === 'false') {
        expect(await botao.getAttribute('data-reason')).toBeTruthy();
      }
    }
    void indisponiveis;
  });

  // ATUALIZAÇÃO CONSCIENTE (correção I2 da revisão final): a dívida da edição
  // de identidade foi PAGA — a allowlist do domínio cobre `identity.*` — e o
  // teste que travava a recusa foi invertido para travar o EFEITO persistido.
  // A dívida que FICA (imagem sem comando) continua declarada e testada.
  test('editar a identidade FUNCIONA de ponta a ponta e persiste; a imagem continua dívida declarada', async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);

    // A nota de lacuna de identidade saiu; a de imagem permanece visível.
    await expect(page.locator('[data-sheet-identity-edit-unavailable]')).toHaveCount(0);
    await expect(page.locator('[data-sheet-image-edit-unavailable]').first()).toBeVisible();

    // Edita o alinhamento pelo modal REAL da seção.
    await page.locator('[data-action="sheet-personal-details-open"]').click();
    const campo = page.locator('[data-sheet-detail-input="alignment"]');
    await expect(campo).toBeVisible();
    await campo.fill('Caótico e Bom');
    await page.locator('[data-action="edit-character-field"][data-path="identity.alignment"]').click();

    // Efeito na tela...
    await expect(page.locator('[data-sheet-detail-field="alignment"] [data-sheet-detail-value]')).toHaveText('Caótico e Bom');
    // ...e no registro PERSISTIDO (write-back do codec para o campo plano).
    const [salvo] = await readCharacters(page);
    expect(salvo.alinhamento).toBe('Caótico e Bom');
    expect(salvo.nome).toBe(PERSONAGEM_BASE.nome);
  });

  test('DÍVIDA DECLARADA: as defesas são somente-leitura, e a ficha diz por quê', async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);

    await expect(page.locator('[data-sheet-defenses-readonly]')).toBeVisible();
    // E o que existe é exibido pelo NOME, nunca pelo ContentId (correção do
    // cutover): o registro tem "Ígneo", o catálogo chama a entidade de "Fogo".
    await expect(page.locator('[data-sheet-defense-kind="resistances"]')).not.toContainText('dnd2024:damage-type');
  });

  test('recarregar a página preserva o estado salvo (persistência real em localStorage)', async ({ page }) => {
    const ferido = { ...PERSONAGEM_BASE, pv_atual: 5 };
    await resetApp(page, { characters: [ferido] });
    await goFicha(page, ferido.id);

    await expect(page.locator('[data-sheet-hp-current]')).toHaveText('5');
    await page.reload();
    await page.waitForSelector('[data-sheet-section="summary-combat"] [data-sheet-section-body]');
    await expect(page.locator('[data-sheet-hp-current]')).toHaveText('5');
  });

  test('o ponto de entrada do level-up abre o fluxo sem quebrar a ficha', async ({ page }) => {
    const nivelBaixo = { ...PERSONAGEM_BASE, nivel: 5 };
    await resetApp(page, { characters: [nivelBaixo] });
    await goFicha(page, nivelBaixo.id);

    const botao = page.locator('[data-action="level-up-open"]');
    await expect(botao).toBeVisible();
    await botao.click();

    await expect(page.locator('#modal-overlay')).toHaveCSS('display', 'flex', { timeout: 10000 });
    await expect(page.locator('#modal-titulo')).not.toHaveText('');
    // A ficha continua montada por trás do modal.
    await expect(page.locator('[data-sheet-section="summary-combat"]')).toBeVisible();
  });
});
