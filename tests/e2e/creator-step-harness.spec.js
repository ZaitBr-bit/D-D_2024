// ============================================================
// Harness E2E da arquitetura NOVA do criador (Tasks 25-26).
//
// Roda contra `tests/e2e/harness/creator.html`, servido pelo mesmo servidor
// estático dos demais specs mas FORA de `site/` — ou seja, fora do artifact
// publicado no Pages. O criador público continua sendo o monólito legado até
// a Task 28; este spec prova, num navegador real, que a arquitetura nova
// funciona antes de qualquer cutover:
//
//   - o DOM identifica QUAL módulo está montado (`data-creator-module`);
//   - duas sessões simultâneas na MESMA página não trocam estado;
//   - a delegação de eventos é real (nenhum `onclick` inline, um só conjunto
//     de listeners) e sobrevive a re-render — inclusive DENTRO do modal;
//   - escolher no modal não grava nada; CANCELAR não grava nada; só confirmar;
//   - o Draconato (linhagem com escolha) funciona ponta a ponta;
//   - o disposer deixa a página inerte;
//   - conteúdo malicioso passando pelo `render` dos três passos REAIS nunca
//     executa.
//
// Desde a Task 27 os passos `classe`/`especie`/`antecedente`/`atributos`/
// `equipamento` são os reais, sobre o catálogo oficial; `magias`/`detalhes`
// continuam placeholders.
// ============================================================
import { test, expect } from '@playwright/test';

const HARNESS_URL = '/tests/e2e/harness/creator.html';

const BARBARO = 'dnd2024:class:barbaro';
const MAGO = 'dnd2024:class:mago';
const DRACONATO = 'dnd2024:species:draconato';
const ANAO = 'dnd2024:species:anao';
const ANDARILHO = 'dnd2024:background:andarilho';

/**
 * Abre o harness e monta as duas sessões.
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 */
async function abrirHarness(page, options = {}) {
  await page.goto(HARNESS_URL);
  await page.evaluate(() => {
    window.__xss = undefined;
  });
  await page.waitForFunction(() => typeof window.__creatorHarness?.start === 'function');
  await page.evaluate((opcoes) => window.__creatorHarness.start(opcoes), options);
  await page.waitForSelector('body[data-harness-ready="true"]');
}

/**
 * Clica no card de uma entidade e espera o modal abrir.
 * @param {import('@playwright/test').Page} page
 * @param {string} sessao - `#creator-a` ou `#creator-b`
 * @param {string} contentId
 */
async function abrirModal(page, sessao, contentId) {
  await page.click(`${sessao} .selection-card[data-content-id="${contentId}"]`);
  await expect(page.locator(`#modal-corpo [data-content-id="${contentId}"]`)).toBeVisible();
}

/**
 * Preenche as escolhas do Bárbaro no nível 1 (duas perícias + equipamento).
 * @param {import('@playwright/test').Page} page
 * @param {ReadonlyArray<string>} pericias
 */
async function escolherBarbaro(page, pericias = ['atletismo', 'intimidacao']) {
  for (const pericia of pericias) {
    await page.check(`#modal-corpo [data-choice-group="pericias-de-classe"] input[data-option-id="${pericia}"]`);
  }
  await page.selectOption('#modal-corpo [data-choice-group="equipamento-inicial"] select', 'opcao-a');
}

/**
 * Fecha o modal confirmando.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
const confirmar = (page) => page.click('#modal-acoes [data-creator-modal="commit"]');

/**
 * Fecha o modal cancelando.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
const cancelar = (page) => page.click('#modal-acoes [data-creator-modal="cancel"]');

test.describe('harness do criador novo @critical', () => {
  test('o DOM identifica o módulo montado, o passo atual e os cards reais do catálogo', async ({ page }) => {
    await abrirHarness(page);
    const raiz = page.locator('#creator-a [data-creator-module]');
    await expect(raiz).toHaveAttribute('data-creator-module', 'features/creator (harness)');
    await expect(raiz).toHaveAttribute('data-creator-step', 'classe');

    // As DOZE classes do pacote oficial, com os textos do baseline.
    await expect(page.locator('#creator-a #grid-classes .selection-card')).toHaveCount(12);
    const barbaro = page.locator(`#creator-a .selection-card[data-content-id="${BARBARO}"]`);
    await expect(barbaro.locator('.card-nome')).toHaveText('Bárbaro');
    await expect(barbaro.locator('.card-detalhe').first()).toHaveText('d12 · Força');
  });

  test('escolher no modal não grava; CANCELAR descarta tudo', async ({ page }) => {
    await abrirHarness(page);
    await abrirModal(page, '#creator-a', BARBARO);
    await escolherBarbaro(page);

    // Enquanto o modal está aberto o card ainda não está selecionado.
    await expect(page.locator(`#creator-a .selection-card[data-content-id="${BARBARO}"]`)).not.toHaveClass(/selected/);

    await cancelar(page);
    await expect(page.locator(`#creator-a .selection-card[data-content-id="${BARBARO}"]`)).not.toHaveClass(/selected/);
    await expect(page.locator('#creator-a .selecao-resumo')).toHaveCount(0);
  });

  test('confirmar o modal grava a seleção e materializa as concessões', async ({ page }) => {
    await abrirHarness(page);
    await abrirModal(page, '#creator-a', BARBARO);
    await escolherBarbaro(page);
    await confirmar(page);

    await expect(page.locator(`#creator-a .selection-card[data-content-id="${BARBARO}"]`)).toHaveClass(/selected/);
    await expect(page.locator('#creator-a .selecao-resumo .resumo-titulo')).toHaveText('Bárbaro');

    const estado = await page.evaluate(() => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      const fontes = [...draft.character.state.activeEffects, ...draft.character.state.inventory]
        .map((entrada) => entrada.sourceInstanceId)
        .filter(Boolean);
      return {
        classe: draft.slices.classSelection?.contentId ?? null,
        proveniencia: [...draft.provenance.classSelection],
        fontes: [...new Set(fontes)],
      };
    });
    expect(estado.classe).toBe(BARBARO);
    expect(estado.proveniencia).toEqual(['source:class:0000:dnd2024-class-barbaro']);
    expect(estado.fontes).toEqual(['source:class:0000:dnd2024-class-barbaro']);
  });

  test('trocar de classe revoga exatamente as concessões da classe substituída', async ({ page }) => {
    await abrirHarness(page);
    await abrirModal(page, '#creator-a', BARBARO);
    await escolherBarbaro(page);
    await confirmar(page);

    await abrirModal(page, '#creator-a', MAGO);
    await page.check('#modal-corpo [data-choice-group="pericias-de-classe"] input[data-option-id="arcanismo"]');
    await page.check('#modal-corpo [data-choice-group="pericias-de-classe"] input[data-option-id="historia"]');
    await page.selectOption('#modal-corpo [data-choice-group="equipamento-inicial"] select', 'opcao-a');
    await confirmar(page);

    const fontes = await page.evaluate(() => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      const entradas = [
        ...draft.character.state.activeEffects,
        ...draft.character.state.inventory,
        ...draft.character.state.spells.known,
      ];
      return [...new Set(entradas.map((entrada) => entrada.sourceInstanceId).filter(Boolean))];
    });
    expect(fontes).toEqual(['source:class:0000:dnd2024-class-mago']);
    await expect(page.locator(`#creator-a .selection-card[data-content-id="${MAGO}"]`)).toHaveClass(/selected/);
    await expect(page.locator(`#creator-a .selection-card[data-content-id="${BARBARO}"]`)).not.toHaveClass(/selected/);
  });

  test('trocar de classe SEM tocar no modal não herda escolha, não concede nada por acaso e não valida', async ({ page }) => {
    await abrirHarness(page);
    await abrirModal(page, '#creator-a', BARBARO);
    await escolherBarbaro(page, ['atletismo', 'sobrevivencia']);
    await confirmar(page);

    // Abre o Mago e confirma sem tocar em NADA.
    await abrirModal(page, '#creator-a', MAGO);
    // O modal do Mago abre VAZIO: nada pré-preenchido com as escolhas do Bárbaro.
    await expect(page.locator('#modal-corpo [data-choice-group="pericias-de-classe"] input:checked')).toHaveCount(0);
    await expect(page.locator('#modal-corpo [data-choice-group="equipamento-inicial"] select')).toHaveValue('');
    await confirmar(page);

    const estado = await page.evaluate(() => {
      const snapshot = window.__creatorHarness.mounted[0].session.getSnapshot();
      const draft = snapshot.draft;
      return {
        classe: draft.slices.classSelection?.contentId ?? null,
        pericias: draft.character.state.activeEffects
          .filter((e) => e.data?.kind === 'proficiency' && String(e.data.id).startsWith('dnd2024:skill:'))
          .map((e) => e.data.id),
        inventario: draft.character.state.inventory.length,
        escolhas: Object.keys(draft.character.build.choices),
        valido: snapshot.validation.valid,
      };
    });
    expect(estado.classe).toBe(MAGO);
    expect(estado.pericias, 'nenhuma perícia herdada do Bárbaro').toEqual([]);
    expect(estado.inventario, 'nenhum equipamento herdado').toBe(0);
    expect(estado.escolhas, 'nenhuma escolha da classe substituída sobrevive').toEqual([]);
    expect(estado.valido, 'o passo precisa se declarar incompleto').toBe(false);

    // E avançar é RECUSADO enquanto as escolhas do Mago não forem feitas.
    await page.click('#creator-a [data-creator-nav="next"]');
    await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'classe');
  });

  test('reconfirmar a MESMA classe pelo botão Alterar mantém as concessões e só troca o que mudou', async ({ page }) => {
    await abrirHarness(page);
    await abrirModal(page, '#creator-a', BARBARO);
    await escolherBarbaro(page);
    await confirmar(page);

    const antes = await page.evaluate(() => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      return {
        pericias: draft.character.state.activeEffects
          .filter((e) => e.data?.kind === 'proficiency' && String(e.data.id).startsWith('dnd2024:skill:'))
          .map((e) => e.data.id)
          .sort(),
        itens: draft.character.state.inventory.length,
      };
    });
    expect(antes.pericias).toEqual(['dnd2024:skill:atletismo', 'dnd2024:skill:intimidacao']);
    expect(antes.itens).toBeGreaterThan(0);

    // "Alterar" reabre o MESMO Bárbaro — mesmo `sourceInstanceId`.
    await page.click('#creator-a .selecao-resumo [data-creator-reopen]');
    await expect(page.locator(`#modal-corpo [data-content-id="${BARBARO}"]`)).toBeVisible();
    // O modal reabre com o que já foi escolhido para ESTA entidade.
    await expect(page.locator('#modal-corpo [data-choice-group="pericias-de-classe"] input:checked')).toHaveCount(2);
    await page.selectOption('#modal-corpo [data-choice-group="equipamento-inicial"] select', 'opcao-b');
    await confirmar(page);

    const depois = await page.evaluate(() => {
      const snapshot = window.__creatorHarness.mounted[0].session.getSnapshot();
      const draft = snapshot.draft;
      return {
        classe: draft.slices.classSelection?.contentId ?? null,
        pericias: draft.character.state.activeEffects
          .filter((e) => e.data?.kind === 'proficiency' && String(e.data.id).startsWith('dnd2024:skill:'))
          .map((e) => e.data.id)
          .sort(),
        itens: draft.character.state.inventory.length,
        progressao: draft.slices.progression,
        valido: snapshot.validation.valid,
      };
    });
    expect(depois.classe).toBe(BARBARO);
    expect(depois.pericias, 'as perícias da classe não podem sumir na reconfirmação').toEqual(antes.pericias);
    expect(depois.itens, 'a opção B do Bárbaro não concede itens; os da opção A saem').toBe(0);
    expect(depois.progressao, 'a fatia derivada reescrita com valor igual não pode ser limpa').not.toBeNull();
    expect(depois.valido).toBe(true);

    // E o wizard avança de verdade — o estado é real, não só reportado.
    await page.click('#creator-a [data-creator-nav="next"]');
    await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'especie');
  });

  test('duas sessões simultâneas não trocam estado', async ({ page }) => {
    await abrirHarness(page);
    await abrirModal(page, '#creator-a', MAGO);
    await page.check('#modal-corpo [data-choice-group="pericias-de-classe"] input[data-option-id="arcanismo"]');
    await page.check('#modal-corpo [data-choice-group="pericias-de-classe"] input[data-option-id="historia"]');
    await page.selectOption('#modal-corpo [data-choice-group="equipamento-inicial"] select', 'opcao-a');
    await confirmar(page);

    await expect(page.locator(`#creator-a .selection-card[data-content-id="${MAGO}"]`)).toHaveClass(/selected/);
    await expect(page.locator(`#creator-b .selection-card[data-content-id="${MAGO}"]`)).not.toHaveClass(/selected/);
    await expect(page.locator('#creator-b .selecao-resumo')).toHaveCount(0);
  });

  test('Draconato: a linhagem é escolhida no modal e concede resistência ao confirmar', async ({ page }) => {
    await abrirHarness(page);
    await abrirModal(page, '#creator-a', BARBARO);
    await escolherBarbaro(page);
    await confirmar(page);
    await page.click('#creator-a [data-creator-nav="next"]');
    await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'especie');
    await expect(page.locator('#creator-a #grid-especies .selection-card')).toHaveCount(11);

    await abrirModal(page, '#creator-a', DRACONATO);
    // A escolha existe porque o CATÁLOGO a declara, não porque o passo conhece
    // "Draconato": dez linhagens mais o placeholder "Selecione uma opção".
    await expect(page.locator('#modal-corpo [data-choice-group="heranca-draconica"] option')).toHaveCount(11);
    await page.selectOption('#modal-corpo [data-choice-group="heranca-draconica"] select', 'ouro');
    await confirmar(page);

    const estado = await page.evaluate(() => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      return {
        especie: draft.slices.speciesSelection?.contentId ?? null,
        linhagem: draft.slices.speciesChoices,
        defesas: draft.character.state.activeEffects.filter((e) => e.data?.kind === 'defense').map((e) => e.data.id),
      };
    });
    expect(estado.especie).toBe(DRACONATO);
    // A chave da escolha é QUALIFICADA pela fonte da espécie — é o que impede
    // que uma escolha de mesmo `choiceId` de outra entidade seja lida como
    // desta (o `tamanho`, por exemplo, é declarado por 4 espécies).
    expect(estado.linhagem).toEqual({ 'source:species:0000:dnd2024-species-draconato:heranca-draconica': ['ouro'] });
    expect(estado.defesas).toEqual(['dnd2024:damage-type:fogo']);
  });

  test('voltar invalida a espécie abandonada e preserva a classe do passo de destino', async ({ page }) => {
    await abrirHarness(page);
    await abrirModal(page, '#creator-a', BARBARO);
    await escolherBarbaro(page);
    await confirmar(page);
    await page.click('#creator-a [data-creator-nav="next"]');
    await abrirModal(page, '#creator-a', DRACONATO);
    await page.selectOption('#modal-corpo [data-choice-group="heranca-draconica"] select', 'ouro');
    await confirmar(page);

    await page.click('#creator-a [data-creator-nav="previous"]');
    await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'classe');
    await expect(page.locator(`#creator-a .selection-card[data-content-id="${BARBARO}"]`)).toHaveClass(/selected/);

    const estado = await page.evaluate(() => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      const entradas = [...draft.character.state.activeEffects, ...draft.character.state.inventory];
      return {
        especie: draft.slices.speciesSelection,
        fontes: [...new Set(entradas.map((entrada) => entrada.sourceInstanceId).filter(Boolean))],
      };
    });
    expect(estado.especie).toBeNull();
    expect(estado.fontes).toEqual(['source:class:0000:dnd2024-class-barbaro']);
  });

  test('nenhum onclick inline: a interação é toda delegada', async ({ page }) => {
    await abrirHarness(page);
    await abrirModal(page, '#creator-a', BARBARO);
    const inline = await page.evaluate(
      () =>
        [...document.querySelectorAll('#creator-a *, #creator-b *, #modal-container *')].filter((el) =>
          [...el.attributes].some((attr) => attr.name.startsWith('on')),
        ).length,
    );
    expect(inline, 'nenhum atributo de evento inline no markup do criador novo').toBe(0);
  });

  test('a delegação sobrevive a abrir e fechar o modal várias vezes sem duplicar efeito', async ({ page }) => {
    await abrirHarness(page);
    for (let volta = 0; volta < 3; volta += 1) {
      await abrirModal(page, '#creator-a', BARBARO);
      await cancelar(page);
    }
    await abrirModal(page, '#creator-a', BARBARO);
    await escolherBarbaro(page);
    await confirmar(page);

    // Uma única aplicação, não três: nenhum listener duplicado.
    const quantidade = await page.evaluate(() => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      return draft.character.state.activeEffects.filter((e) => e.data?.id === 'dnd2024:skill:atletismo').length;
    });
    expect(quantidade).toBe(1);
    await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'classe');
  });

  test('o disposer deixa a página inerte', async ({ page }) => {
    await abrirHarness(page);
    await abrirModal(page, '#creator-a', BARBARO);
    await escolherBarbaro(page);
    await confirmar(page);

    await page.evaluate(() => window.__creatorHarness.disposeAll());
    await page.waitForSelector('body[data-harness-disposed="true"]');
    await page.click(`#creator-a .selection-card[data-content-id="${MAGO}"]`);
    await expect(page.locator(`#creator-a .selection-card[data-content-id="${BARBARO}"]`)).toHaveClass(/selected/);
  });
});

test.describe('harness do criador novo: conteúdo hostil pelo render dos passos REAIS @critical', () => {
  test('nenhum payload de catálogo executa, cria tag ou vira handler', async ({ page }) => {
    const payloads = [
      { name: '<script>window.__xss="nome"</script>', description: 'ok' },
      { name: '"><img src=x onerror="window.__xss=\'atributo\'">', description: 'ok' },
      { name: 'ok', description: '<svg/onload=window.__xss="descricao">' },
      { name: '</title><script>window.__xss="titulo"</script>', description: 'ok' },
      { name: 'ok2', description: 'javascript:window.__xss="url"' },
    ];
    await abrirHarness(page, { hostilePayloads: payloads });

    const relatorio = await page.evaluate(() => {
      const problemas = [];
      const raiz = document.getElementById('creator-a');
      for (const elemento of raiz.querySelectorAll('*')) {
        if (['SCRIPT', 'IMG', 'SVG', 'IFRAME'].includes(elemento.tagName)) {
          problemas.push(`tag criada: ${elemento.tagName}`);
        }
        for (const atributo of elemento.attributes) {
          if (atributo.name.startsWith('on')) {
            problemas.push(`handler criado: ${atributo.name}`);
          }
          if (['href', 'src', 'action', 'formaction'].includes(atributo.name) && /javascript:/i.test(atributo.value)) {
            problemas.push(`destino navegável: ${atributo.name}`);
          }
        }
      }
      return { problemas, xss: window.__xss };
    });

    expect(relatorio.problemas, relatorio.problemas.join('; ')).toEqual([]);
    expect(relatorio.xss, 'um payload conseguiu executar código pelo render de um passo').toBeUndefined();

    // E os payloads continuam VISÍVEIS como texto — escapar não pode virar
    // "sumir com o conteúdo".
    await expect(page.locator('#creator-a #grid-classes')).toContainText('<script>window.__xss="nome"</script>');
  });

  test('o corpo do MODAL também é construído com nós seguros', async ({ page }) => {
    const payloads = [
      { name: '<script>window.__xss="modal"</script>', description: '<img src=x onerror=window.__xss="corpo">' },
    ];
    await abrirHarness(page, { hostilePayloads: payloads });
    await page.click('#creator-a .selection-card[data-content-id="dnd2024:class:hostil-0"]');
    await expect(page.locator('#modal-corpo [data-content-id="dnd2024:class:hostil-0"]')).toBeVisible();

    const relatorio = await page.evaluate(() => {
      const problemas = [];
      for (const elemento of document.getElementById('modal-container').querySelectorAll('*')) {
        if (['SCRIPT', 'IMG', 'SVG', 'IFRAME'].includes(elemento.tagName)) {
          problemas.push(`tag criada: ${elemento.tagName}`);
        }
        for (const atributo of elemento.attributes) {
          if (atributo.name.startsWith('on')) {
            problemas.push(`handler criado: ${atributo.name}`);
          }
        }
      }
      return { problemas, xss: window.__xss, titulo: document.getElementById('modal-titulo').textContent };
    });
    expect(relatorio.problemas, relatorio.problemas.join('; ')).toEqual([]);
    expect(relatorio.xss).toBeUndefined();
    expect(relatorio.titulo).toBe('<script>window.__xss="modal"</script>');
  });
});

// ============================================================
// Passos `atributos` e `equipamento` (Task 27).
// ============================================================

/**
 * Leva a sessão A até o passo `atributos`, com classe, espécie e antecedente
 * confirmados no catálogo oficial.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function ateAtributos(page) {
  await abrirHarness(page);
  await abrirModal(page, '#creator-a', BARBARO);
  await escolherBarbaro(page);
  await confirmar(page);
  await page.click('#creator-a [data-creator-nav="next"]');

  await abrirModal(page, '#creator-a', ANAO);
  await confirmar(page);
  await page.click('#creator-a [data-creator-nav="next"]');

  await abrirModal(page, '#creator-a', ANDARILHO);
  await page.selectOption('#modal-corpo [data-choice-group="bonus-de-atributo"] select', 'destreza-mais2-sabedoria-mais1');
  await page.selectOption('#modal-corpo [data-choice-group="equipamento-inicial"] select', 'opcao-a');
  await page.check('#modal-corpo [data-choice-group="idiomas-adicionais"] input[data-option-id="anao"]');
  await page.check('#modal-corpo [data-choice-group="idiomas-adicionais"] input[data-option-id="elfico"]');
  await confirmar(page);
  await page.click('#creator-a [data-creator-nav="next"]');
  await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'atributos');
}

/**
 * Distribui o conjunto padrão inteiro pelos seis selects, na ordem.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function distribuirConjuntoPadrao(page) {
  const chaves = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
  for (const [indice, chave] of chaves.entries()) {
    await page.selectOption(`#creator-a [data-attr-assign="${chave}"]`, String(indice));
  }
}

/**
 * Lê algo do rascunho da sessão A.
 * @param {import('@playwright/test').Page} page
 * @param {Function} projecao
 * @returns {Promise<*>}
 */
const lerRascunho = (page, projecao) => page.evaluate(projecao);

test.describe('harness do criador novo: passo de atributos @critical', () => {
  test('conjunto padrão distribui os seis valores sem reutilização e libera o avanço', async ({ page }) => {
    await ateAtributos(page);
    await expect(page.locator('#creator-a #attr-content')).toHaveAttribute('data-attr-method', 'standard');
    await distribuirConjuntoPadrao(page);

    const estado = await lerRascunho(page, () => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      return { base: { ...draft.character.state.abilities }, metodo: draft.character.build.abilityGeneration.method };
    });
    expect(estado.base).toEqual({ forca: 15, destreza: 14, constituicao: 13, inteligencia: 12, sabedoria: 10, carisma: 8 });
    expect(estado.metodo).toBe('standard');

    await page.click('#creator-a [data-creator-nav="next"]');
    await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'equipamento');
  });

  test('compra de pontos gasta os 27 pontos do ruleset e recusa estourar o orçamento', async ({ page }) => {
    await ateAtributos(page);
    await page.check('#creator-a [data-attr-mode="pointbuy"]');
    await expect(page.locator('#creator-a #attr-content')).toHaveAttribute('data-attr-method', 'pointbuy');

    for (const chave of ['forca', 'destreza', 'constituicao']) {
      for (let passo = 0; passo < 7; passo += 1) {
        await page.click(`#creator-a [data-pb-key="${chave}"][data-pb-delta="1"]`);
      }
    }
    const base = await lerRascunho(page, () => ({
      ...window.__creatorHarness.mounted[0].session.getSnapshot().draft.character.state.abilities,
    }));
    expect(base).toEqual({ forca: 15, destreza: 15, constituicao: 15, inteligencia: 8, sabedoria: 8, carisma: 8 });

    // Os botões das três já no máximo ficam desabilitados; gastar mais um ponto
    // em outro atributo estouraria o orçamento e é RECUSADO — o estado não muda.
    await expect(page.locator('#creator-a [data-pb-key="forca"][data-pb-delta="1"]')).toBeDisabled();
    await page.click('#creator-a [data-pb-key="inteligencia"][data-pb-delta="1"]');
    const depois = await lerRascunho(page, () => ({
      ...window.__creatorHarness.mounted[0].session.getSnapshot().draft.character.state.abilities,
    }));
    expect(depois, 'estourar o orçamento não pode alterar a distribuição').toEqual(base);

    await page.click('#creator-a [data-creator-nav="next"]');
    await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'equipamento');
  });

  test('rolagem 4d6 usa o RNG injetado e é determinística', async ({ page }) => {
    await ateAtributos(page);
    await page.check('#creator-a [data-attr-mode="rolagem"]');
    await expect(page.locator('#creator-a #attr-content')).toHaveAttribute('data-attr-method', 'rolagem');
    await page.click('#creator-a [data-roll-all]');

    const estado = await lerRascunho(page, () => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      return { base: { ...draft.character.state.abilities }, metodo: draft.character.build.abilityGeneration.method };
    });
    // Faces 6, 1, 4, 5 -> descarta o 1 -> 15 em todos.
    expect(estado.base).toEqual({ forca: 15, destreza: 15, constituicao: 15, inteligencia: 15, sabedoria: 15, carisma: 15 });
    expect(estado.metodo).toBe('rolled');
    await page.click('#creator-a [data-creator-nav="next"]');
    await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'equipamento');
  });

  test('o modo MANUAL continua visível e DESABILITADO', async ({ page }) => {
    await ateAtributos(page);
    const manual = page.locator('#creator-a [data-attr-mode="manual"]');
    await expect(manual, 'a opção manual não pode sumir da interface').toHaveCount(1);
    await expect(manual).toBeDisabled();
    await expect(manual).not.toBeChecked();

    // Forçar o evento não muda o método: a desabilitação não é só visual.
    await page.evaluate(() => {
      document.querySelector('#creator-a [data-attr-mode="manual"]').dispatchEvent(new Event('change', { bubbles: true }));
    });
    const fatia = await lerRascunho(
      page,
      () => window.__creatorHarness.mounted[0].session.getSnapshot().draft.slices.abilityScores,
    );
    expect(fatia, 'nada é gravado pelo modo desabilitado').toBeNull();
  });
});

test.describe('harness do criador novo: passo de equipamento @critical', () => {
  /**
   * Vai até o passo de equipamento com o conjunto padrão distribuído.
   * @param {import('@playwright/test').Page} page
   * @returns {Promise<void>}
   */
  async function ateEquipamento(page) {
    await ateAtributos(page);
    await distribuirConjuntoPadrao(page);
    await page.click('#creator-a [data-creator-nav="next"]');
    await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'equipamento');
  }

  test('as opções estruturadas da classe e do antecedente aparecem, com a escolhida marcada', async ({ page }) => {
    await ateEquipamento(page);
    await expect(page.locator('#creator-a [data-equip-origem="class"]')).toHaveCount(1);
    await expect(page.locator('#creator-a [data-equip-origem="background"]')).toHaveCount(1);
    await expect(page.locator('#creator-a [data-equip-origem="class"] [data-equip-option="opcao-a"]')).toHaveClass(/selected/);
  });

  test('a lacuna de conteúdo (rótulo promete moeda sem concessão estruturada) fica VISÍVEL no card', async ({ page }) => {
    await ateEquipamento(page);
    // A opção B do Bárbaro é "75 PO" e não concede nada: o jogador precisa ver
    // que aquele ouro não entra sozinho, em vez de escolher e não receber nada.
    const aviso = page.locator(
      '#creator-a [data-equip-origem="class"] [data-equip-option="opcao-b"] [data-equip-lacuna="currency"]',
    );
    await expect(aviso).toHaveCount(1);
    await expect(aviso).toContainText('não é adicionada automaticamente');
  });

  test('comprar item customizado e mexer na carteira e depois TROCAR DE CLASSE preserva o do jogador', async ({ page }) => {
    await ateEquipamento(page);

    await page.fill('#creator-a [data-inv-custom-name]', 'Amuleto de Família');
    await page.fill('#creator-a [data-inv-custom-cost]', '25 PO');
    await page.click('#creator-a [data-inv-add-custom]');
    for (let clique = 0; clique < 3; clique += 1) {
      await page.click('#creator-a [data-moeda-op="add"][data-moeda-denominacao="po"]');
    }

    const antes = await lerRascunho(page, () => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      return {
        manual: [...draft.slices.manualInventoryChanges.instanceIds],
        carteira: { ...draft.slices.walletChanges },
        iniciais: draft.character.state.inventory.filter((item) => item.sourceInstanceId !== null).length,
      };
    });
    expect(antes.manual).toHaveLength(1);
    expect(antes.carteira.copper).toBe(300);
    expect(antes.iniciais).toBeGreaterThan(0);

    // Volta ao primeiro passo e troca de CLASSE INTEIRA.
    await page.click('#creator-a [data-step="classe"]');
    await expect(page.locator('#creator-a [data-creator-module]')).toHaveAttribute('data-creator-step', 'classe');
    await abrirModal(page, '#creator-a', MAGO);
    await page.check('#modal-corpo [data-choice-group="pericias-de-classe"] input[data-option-id="arcanismo"]');
    await page.check('#modal-corpo [data-choice-group="pericias-de-classe"] input[data-option-id="historia"]');
    await page.selectOption('#modal-corpo [data-choice-group="equipamento-inicial"] select', 'opcao-a');
    await confirmar(page);

    const depois = await lerRascunho(page, () => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      return {
        manual: [...draft.slices.manualInventoryChanges.instanceIds],
        carteira: { ...draft.slices.walletChanges },
        selecaoInicial: draft.slices.startingEquipmentSelection,
        concessaoMoeda: draft.slices.startingCurrencyGrant,
        fontes: [...new Set(draft.character.state.inventory.map((item) => item.sourceInstanceId))],
        instancias: draft.character.state.inventory.map((item) => item.instanceId),
      };
    });
    expect(depois.manual, 'o ledger manual sobrevive à troca de classe').toEqual(antes.manual);
    expect(depois.carteira, 'as moedas do jogador sobrevivem à troca de classe').toEqual(antes.carteira);
    expect(depois.selecaoInicial, 'a seleção inicial é fatia do passo e é limpa pela troca de classe').toBeNull();
    expect(depois.concessaoMoeda).toBeNull();
    expect(depois.instancias).toContain(antes.manual[0]);
    expect(depois.fontes, 'nada do Bárbaro sobrevive').not.toContain('source:class:0000:dnd2024-class-barbaro');
  });

  test('trocar a OPÇÃO inicial pelo próprio passo troca só os itens daquela fonte', async ({ page }) => {
    await ateEquipamento(page);
    await page.fill('#creator-a [data-inv-custom-name]', 'Corda de Seda');
    await page.click('#creator-a [data-inv-add-custom]');

    await page.click('#creator-a [data-equip-origem="class"] [data-equip-option="opcao-b"]');
    await expect(page.locator('#creator-a [data-equip-origem="class"] [data-equip-option="opcao-b"]')).toHaveClass(/selected/);

    const estado = await lerRascunho(page, () => {
      const draft = window.__creatorHarness.mounted[0].session.getSnapshot().draft;
      return {
        daClasse: draft.character.state.inventory.filter(
          (item) => item.sourceInstanceId === 'source:class:0000:dnd2024-class-barbaro',
        ).length,
        manual: [...draft.slices.manualInventoryChanges.instanceIds],
        instancias: draft.character.state.inventory.map((item) => item.instanceId),
        pericias: draft.character.state.activeEffects
          .filter((e) => e.data?.kind === 'proficiency' && String(e.data.id).startsWith('dnd2024:skill:'))
          .map((e) => e.data.id),
      };
    });
    expect(estado.daClasse, 'a opção B do Bárbaro não concede item').toBe(0);
    expect(estado.instancias).toContain(estado.manual[0]);
    expect(estado.pericias, 'trocar a opção não pode revogar as perícias da classe').toEqual(
      expect.arrayContaining(['dnd2024:skill:atletismo', 'dnd2024:skill:intimidacao']),
    );
  });
});
