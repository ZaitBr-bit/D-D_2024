// ============================================================
// Page Object do criador de personagem — arquitetura NOVA (Task 28b).
//
// O criador público deixou de ser o monólito de `site/js/pages/creator.js` e
// passou a ser `features/creator/**` montado por um composition root fino. Os
// seletores abaixo são os do DOM novo, levantados do código dos sete passos
// reais (os MESMOS que `tests/e2e/creator-step-harness.spec.js` já exercitava
// no harness desde as Tasks 26-28).
//
// ## Divergências deliberadas em relação ao page object legado
//
// Cada uma existe porque a arquitetura nova mudou ONDE o fato mora, não
// porque "deu diff":
//
//  1. **Entidades por ContentId, não por nome de exibição.** Antes:
//     `[data-classe="Mago"]`. Agora: `[data-content-id="dnd2024:class:mago"]`.
//     Comparar por nome traduzido era exatamente o acoplamento que as Tasks
//     26-27 tiraram do código de produção; o teste não pode reintroduzi-lo.
//  2. **Passo identificado por id, não por índice.** Antes:
//     `.wizard-step[data-step="0"]`. Agora `data-step="classe"` no chip e
//     `data-creator-step="classe"` na raiz. A sessão nunca navegou por índice
//     (`creator-state.js#CREATOR_STEP_IDS`).
//  3. **Navegação por intenção, não por id de botão.** Antes `#btn-prev`,
//     `#btn-next`, `#btn-finalizar`. Agora `[data-creator-nav="previous"|
//     "next"|"finalize"]`, o contrato de delegação do controller (Task 25).
//  4. **Escolhas do catálogo dentro do modal, com min/max no DOM.** Antes,
//     cada tipo de escolha tinha seu id próprio (`#popup-confirmar-classe`,
//     `data-escolha-classe`, `#popup-tracos-escolha`) e o helper precisava
//     adivinhar a saciedade clicando até o contador parar de crescer. Agora
//     todo grupo é `[data-choice-group][data-choice-min][data-choice-max]`
//     (`catalog-selection-step.js`), então a saciedade é LIDA. Confirmar e
//     cancelar são `[data-creator-modal="commit"|"cancel"]`.
//  5. **Perícias de classe no modal da classe, não no passo de atributos.**
//     O legado tinha `#pericias-content` no passo `atributos`; as perícias são
//     um `choice` da CLASSE no catálogo, e é lá que elas aparecem agora.
//  6. **Atributos por atributo, não por índice de select.** `[data-attr-mode]`,
//     `[data-attr-assign="<chave>"]`, `[data-pb-key][data-pb-delta]`,
//     `[data-roll-all]` — no lugar de `input[name="attr-mode"]`,
//     `#attr-content select[data-attr-key]`, `.counter-btn[data-dir="+1"]` e
//     `#btn-rolar-todos`.
//  7. **Magias sem abas de círculo.** O legado tinha `#tabs-magias
//     [data-tab-circ]` e um `#magias-contadores` único. Agora cada FONTE tem
//     seus contadores (`[data-magias-contador="<fonte>:<coleção>"]`) e cada
//     card declara fonte/coleção/círculo — a ausência das abas está
//     registrada como dívida no relatório da Task 28 (C4).
//  8. **Idiomas não estão em Detalhes.** No catálogo, idiomas adicionais são
//     um `choice` do ANTECEDENTE (`idiomas-adicionais`), resolvido no modal
//     dele; o `#det-idiomas-grid` do legado guardava o mesmo fato num segundo
//     lugar.
//  9. **"Iniciado em Magia" não tem widget próprio.** O talento aponta uma
//     lista de magias que o catálogo ainda não referencia de forma
//     estruturada; o passo declara a lacuna na tela
//     (`[data-magias-lacuna]`) e não bloqueia (Task 28, C2).
// ============================================================
import { expect } from '@playwright/test';

export const STEPS = ['classe', 'especie', 'antecedente', 'atributos', 'equipamento', 'magias', 'detalhes'];

/** As seis chaves de atributo, na ordem canônica do domínio. */
export const ATRIBUTOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];

/** Raiz do criador montado (o marcador que diz QUAL módulo está no DOM). */
export function raizDoCriador(page) {
  return page.locator('#app-content [data-creator-module]');
}

/** Id do passo ativo (`classe`, `especie`, ...), ou `null`. */
export async function passoAtual(page) {
  return raizDoCriador(page).getAttribute('data-creator-step');
}

/** Espera o wizard estar num passo específico. */
export async function esperarPasso(page, stepId) {
  await expect(raizDoCriador(page)).toHaveAttribute('data-creator-step', stepId);
}

/**
 * Executa uma ação e espera o RE-RENDER que ela provoca terminar.
 *
 * Toda intenção do criador novo é assíncrona (`session.dispatch` -> `reduce`
 * -> `notify` -> `render`), e o `render` do controller substitui todo o
 * conteúdo do contêiner. Sem esperar, o passo seguinte do teste resolve um nó
 * que a montagem está prestes a descartar — e um clique despachado num nó já
 * destacado não borbulha até a raiz de delegação, virando um no-op SILENCIOSO
 * (foi exatamente assim que o clique em "Finalizar" se perdia depois de
 * preencher o nome).
 *
 * A espera é DETERMINÍSTICA, não um tempo fixo: carimbamos a raiz atual e
 * esperamos o carimbo desaparecer com ela.
 * @param {import('@playwright/test').Page} page
 * @param {() => Promise<void>} acao
 */
export async function comRerender(page, acao) {
  await page.evaluate(() => {
    document.querySelector('#app-content #wizard-content > *')?.setAttribute('data-e2e-render-stamp', '1');
  });
  await acao();
  await expect(page.locator('#app-content [data-e2e-render-stamp]')).toHaveCount(0);
}

/**
 * Preenche um campo de texto do passo `detalhes` e espera o re-render.
 *
 * O `blur` explícito é necessário: os campos de texto são ouvidos em `change`
 * (nunca `input`, para não re-renderizar a cada tecla e destruir o cursor), e
 * `fill()` do Playwright NÃO dispara `change` — o evento só sai quando o campo
 * perde o foco. Sem o `blur` aqui, o valor ficaria no DOM sem NUNCA chegar ao
 * rascunho, e o teste seguiria com um estado que o app não tem.
 */
async function preencherCampoDeTexto(page, campo, valor) {
  const input = page.locator(`#app-content [data-det-field="${campo}"]`);
  await comRerender(page, async () => {
    await input.fill(valor);
    await input.blur();
  });
}

/** ContentId da primeira entidade de um grid (`#grid-especies`, ...). */
export async function primeiroContentId(page, gridId) {
  return page.locator(`#${gridId} .selection-card[data-content-id]`).first().getAttribute('data-content-id');
}

/** Abre o modal de uma entidade do catálogo pelo ContentId. */
export async function abrirSelecao(page, contentId) {
  await page.locator(`#app-content .selection-card[data-content-id="${contentId}"]`).click();
  await expect(page.locator(`#modal-corpo [data-content-id="${contentId}"]`)).toBeVisible();
}

/** Confirma o modal de seleção (grava a escolha na sessão). */
export async function confirmarModal(page) {
  await page.locator('#modal-acoes [data-creator-modal="commit"]').click();
  await expect(page.locator('#modal-overlay')).toHaveCSS('display', 'none');
}

/** Cancela o modal de seleção (não grava nada). */
export async function cancelarModal(page) {
  await page.locator('#modal-acoes [data-creator-modal="cancel"]').click();
  await expect(page.locator('#modal-overlay')).toHaveCSS('display', 'none');
}

/**
 * Resolve TODAS as escolhas obrigatórias do modal aberto.
 *
 * A saciedade não é adivinhada: cada grupo publica `data-choice-min`/
 * `data-choice-max` (`catalog-selection-step.js#appendChoiceControl`), então o
 * helper preenche exatamente o necessário. `preferencias` permite fixar a
 * opção de um grupo específico (ex.: a linhagem do Draconato), pelo `choiceId`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, string|ReadonlyArray<string>>} [preferencias]
 */
export async function resolverEscolhasDoModal(page, preferencias = {}) {
  await page.evaluate((prefs) => {
    const escolhida = (choiceId) => {
      const valor = prefs?.[choiceId];
      if (valor === undefined || valor === null) return [];
      return Array.isArray(valor) ? valor : [valor];
    };

    for (const grupo of document.querySelectorAll('#modal-corpo [data-choice-group]')) {
      const choiceId = grupo.getAttribute('data-choice-group');
      const max = Number(grupo.getAttribute('data-choice-max') || '1');
      const preferidas = escolhida(choiceId);

      const select = grupo.querySelector('select');
      if (select) {
        const opcoes = Array.from(select.options).filter((o) => o.value);
        const alvo = opcoes.find((o) => preferidas.includes(o.value)) ?? (select.value ? null : opcoes[0]);
        if (alvo) {
          select.value = alvo.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        continue;
      }

      const checks = Array.from(grupo.querySelectorAll('input[type="checkbox"]'));
      // Preferidas primeiro, depois as demais na ordem do catálogo.
      const ordenadas = [
        ...checks.filter((c) => preferidas.includes(c.getAttribute('data-option-id'))),
        ...checks.filter((c) => !preferidas.includes(c.getAttribute('data-option-id'))),
      ];
      let marcadas = checks.filter((c) => c.checked).length;
      for (const check of ordenadas) {
        if (marcadas >= max) break;
        if (check.checked || check.disabled) continue;
        check.checked = true;
        check.dispatchEvent(new Event('change', { bubbles: true }));
        marcadas += 1;
      }
    }
  }, preferencias);
}

/** Passo Classe: abre a classe, resolve as escolhas e confirma. */
export async function selecionarClasse(page, contentId, preferencias = {}) {
  await abrirSelecao(page, contentId);
  await resolverEscolhasDoModal(page, preferencias);
  await confirmarModal(page);
  await expect(page.locator(`#app-content .selection-card[data-content-id="${contentId}"]`)).toHaveClass(/selected/);
}

/** Passo Espécie: idem (a linhagem, quando existir, é um `choice` do catálogo). */
export async function selecionarEspecie(page, contentId, preferencias = {}) {
  await abrirSelecao(page, contentId);
  await resolverEscolhasDoModal(page, preferencias);
  await confirmarModal(page);
  await expect(page.locator(`#app-content .selection-card[data-content-id="${contentId}"]`)).toHaveClass(/selected/);
}

/** Passo Antecedente: idem (bônus de atributo e idiomas são `choice` dele). */
export async function selecionarAntecedente(page, contentId, preferencias = {}) {
  await abrirSelecao(page, contentId);
  await resolverEscolhasDoModal(page, preferencias);
  await confirmarModal(page);
  await expect(page.locator(`#app-content .selection-card[data-content-id="${contentId}"]`)).toHaveClass(/selected/);
}

/**
 * Método "Conjunto Padrão": distribui os seis valores do array, um por
 * atributo, na ordem canônica. O `<select>` de cada atributo guarda o ÍNDICE
 * do valor no array (`abilities-step.js`), então não há reutilização possível.
 */
export async function escolherAtributosConjuntoPadrao(page) {
  await expect(page.locator('#app-content #attr-content')).toHaveAttribute('data-attr-method', 'standard');
  for (const [indice, chave] of ATRIBUTOS.entries()) {
    await page.selectOption(`#app-content [data-attr-assign="${chave}"]`, String(indice));
  }
}

/**
 * Método "Compra de Pontos": leva três atributos de 8 a 15 (7 incrementos
 * cada), gastando exatamente os 27 pontos do ruleset.
 */
export async function escolherAtributosPointBuy(page) {
  await page.check('#app-content [data-attr-mode="pointbuy"]');
  await expect(page.locator('#app-content #attr-content')).toHaveAttribute('data-attr-method', 'pointbuy');
  for (const chave of ['forca', 'destreza', 'constituicao']) {
    for (let passo = 0; passo < 7; passo += 1) {
      await page.click(`#app-content [data-pb-key="${chave}"][data-pb-delta="1"]`);
    }
  }
}

/** Método "Rolagem 4d6": rola os seis atributos de uma vez. */
export async function escolherAtributosRolagem(page) {
  await page.check('#app-content [data-attr-mode="rolagem"]');
  await expect(page.locator('#app-content #attr-content')).toHaveAttribute('data-attr-method', 'rolagem');
  await page.click('#app-content [data-roll-all]');
  // O dispatch da intenção é assíncrono (creator-session.js) e o `click` do
  // Playwright não aguarda essa promise, só o listener síncrono — sem esta
  // espera com retry automático, uma leitura logo em seguida (ex.:
  // `evaluateAll`) pode pegar o DOM antes da re-renderização, vendo "--" num
  // atributo ainda não repintado (achado ao depurar falha intermitente em
  // chromium-desktop sob carga real de CI).
  await expect(page.locator('#app-content .atributo-dados')).toHaveCount(ATRIBUTOS.length);
}

/** Confirma que o modo "Manual" continua visível e desabilitado. */
export async function assertModoManualDesabilitado(page) {
  const manual = page.locator('#app-content [data-attr-mode="manual"]');
  await expect(manual, 'a opção manual não pode sumir da interface').toHaveCount(1);
  await expect(manual).toBeDisabled();
  await expect(manual).not.toBeChecked();
}

/**
 * Passo Equipamento: escolhe a primeira opção estruturada de cada origem
 * (classe e antecedente) que ainda não esteja marcada.
 */
export async function escolherEquipamentoPadrao(page) {
  for (const origem of ['class', 'background']) {
    const bloco = page.locator(`#app-content [data-equip-origem="${origem}"]`);
    if ((await bloco.count()) === 0) continue;
    const jaSelecionada = bloco.locator('[data-equip-option].selected');
    if ((await jaSelecionada.count()) > 0) continue;
    const opcao = bloco.locator('[data-equip-option]').first();
    if ((await opcao.count()) === 0) continue;
    await opcao.click();
    await expect(opcao).toHaveClass(/selected/);
  }
}

/**
 * Passo Magias: sacia TODOS os contadores de TODAS as fontes de conjuração.
 *
 * A ordem entre coleções não é arbitrária: o grimório precisa estar cheio
 * antes das preparadas, porque uma preparada de 1º círculo tem de estar no
 * grimório (`spells-step.js`, invariante reconferida no `validate`).
 *
 * Uma combinação sem conjuração renderiza `[data-magias-sem-conjuracao]` e
 * este helper não faz nada — que é o comportamento certo, e é verificado.
 */
export async function escolherMagiasSuficientes(page) {
  await expect(
    page.locator('#app-content [data-magias-fonte], #app-content [data-magias-sem-conjuracao]').first(),
  ).toBeVisible();

  const fontes = await page
    .locator('#app-content [data-magias-fonte]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-magias-fonte')));

  for (const fonte of fontes) {
    for (const [colecao, contador] of [
      ['known', 'cantrips'],
      ['spellbook', 'spellbook'],
      ['prepared', 'prepared'],
    ]) {
      await saciarColecaoDeMagias(page, fonte, colecao, contador);
    }
  }
}

/**
 * Clica cards até o contador `<fonte>:<chave>` atingir o alvo. Cada clique
 * provoca re-render do criador, então o estado é relido a cada volta.
 */
async function saciarColecaoDeMagias(page, fonte, colecao, chaveDoContador) {
  const contador = page.locator(`#app-content [data-magias-contador="${fonte}:${chaveDoContador}"]`);
  if ((await contador.count()) === 0) return;

  for (let volta = 0; volta < 40; volta += 1) {
    const texto = (await contador.textContent()) || '';
    const par = /(\d+)\s*\/\s*(\d+)/.exec(texto);
    // "X/—" é limite desconhecido declarado: não há o que saciar.
    if (!par) return;
    const [, atual, alvo] = par.map(Number);
    if (atual >= alvo) return;

    const candidato = page
      .locator(`#app-content [data-magia-fonte="${fonte}"][data-magia-colecao="${colecao}"]:not(.selecionada)`)
      .first();
    if ((await candidato.count()) === 0) {
      throw new Error(`sem magia disponível para saciar ${fonte}:${chaveDoContador} (${atual}/${alvo})`);
    }
    await candidato.click();
    await expect
      .poll(async () => {
        const novo = /(\d+)\s*\/\s*(\d+)/.exec((await contador.textContent()) || '');
        return novo ? Number(novo[1]) : atual;
      })
      .toBeGreaterThan(atual);
  }
  throw new Error(`contador ${fonte}:${chaveDoContador} não saciou em 40 cliques`);
}

/**
 * Passo Detalhes: preenche o nome (único campo obrigatório para finalizar) e,
 * opcionalmente, alinhamento e demais campos de texto.
 */
export async function preencherDetalhes(page, { nome, alinhamento, campos = {} } = {}) {
  if (nome !== undefined) {
    await preencherCampoDeTexto(page, 'name', nome);
    await expect(page.locator('#app-content [data-det-field="name"]')).toHaveValue(nome);
  }
  for (const [campo, valor] of Object.entries(campos)) {
    await preencherCampoDeTexto(page, campo, valor);
  }
  if (alinhamento !== undefined) {
    await page.locator(`#app-content [data-det-alignment="${alinhamento}"]`).click();
    await expect(page.locator(`#app-content [data-det-alignment="${alinhamento}"]`)).toHaveClass(/selected/);
  }
}

/** Avança um passo e confirma que o wizard de fato mudou de passo. */
export async function proximoPasso(page) {
  const antes = await passoAtual(page);
  await page.locator('#app-content [data-creator-nav="next"]').click();
  await expect
    .poll(async () => passoAtual(page), { timeout: 15000 })
    .not.toBe(antes);
}

/** Volta um passo. */
export async function passoAnterior(page) {
  await page.locator('#app-content [data-creator-nav="previous"]').click();
}

/** Salta para um passo JÁ VISITADO clicando no chip da barra de passos. */
export async function irParaPassoVisitado(page, stepId) {
  await page.locator(`#app-content .wizard-step[data-step="${stepId}"]`).click();
  await esperarPasso(page, stepId);
}

/** Clica em "Finalizar" e aguarda a navegação para `#ficha/<id>`. */
export async function finalizarCriacao(page) {
  await page.locator('#app-content [data-creator-nav="finalize"]').click();
  await page.waitForURL(/#ficha\//, { timeout: 20000 });
}
