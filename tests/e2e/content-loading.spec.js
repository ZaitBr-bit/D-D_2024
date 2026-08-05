// ============================================================
// Carga do catálogo oficial NO NAVEGADOR (Task 22a).
//
// Os testes de nó exercitam os handlers contra um catálogo em memória montado
// a partir dos mesmos arquivos JSON. Este spec fecha o outro lado: prova que,
// no runtime real da página (mesmo `fetch`, mesmo `import`, mesmo composition
// root que `site/js/store.js` carrega em tempo de avaliação de módulo), o
// catálogo `dados/pacotes/dnd2024` é buscado com sucesso e que os DOZE
// handlers de classe registrados por `app-context.js` são de fato declarados
// pelas entidades de classe do pacote.
//
// É a defesa executável contra o padrão de bug "o handler existe, os testes
// passam, mas ele nunca é alcançado em produção".
// ============================================================
import { test, expect } from '@playwright/test';
import { resetApp, goHome } from './helpers/app.js';

/**
 * Carrega o composition root REAL na página e devolve um retrato do que ele
 * conseguiu montar. Tudo roda no contexto do navegador, com o `fetch` de
 * verdade da origem servida por `scripts/serve-static.mjs`.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<object>}
 */
async function carregarCatalogoNaPagina(page) {
  return page.evaluate(async () => {
    const [appContextModule, registerAllModule, queriesModule] = await Promise.all([
      import('/site/js/app-context.js'),
      import('/site/js/domain/rulesets/dnd2024/handlers/register-all.js'),
      import('/site/js/domain/character/queries/index.js'),
    ]);

    const context = appContextModule.createAppContext();
    const initialized = await context.initializeContent();
    if (initialized.ok !== true) {
      return { erro: initialized.error?.code ?? 'SEM_CODIGO' };
    }
    const registry = initialized.value;

    const verificacao = registerAllModule.verifyAllClassHandlerDeclarations(registry);

    const classesArcanas = ['bardo', 'bruxo', 'feiticeiro', 'mago'].map((slug) => {
      const resolved = registry.resolve(`dnd2024:class:${slug}`);
      const declarados = resolved.ok
        ? (resolved.value.effects ?? [])
            .filter((effect) => effect?.type === 'official-handler')
            .map((effect) => effect.handlerId)
        : [];
      return { slug, resolvida: resolved.ok === true, declarados };
    });

    return {
      handlerIds: registerAllModule.ALL_CLASS_HANDLERS.map((handler) => handler.id),
      verificacaoOk: verificacao.ok === true,
      verificados: verificacao.ok === true ? [...verificacao.value].sort() : verificacao.error?.code,
      classesArcanas,
      // A plumbing de `context.variables` também precisa existir no bundle da
      // página, não só nos testes de nó.
      exportaVariaveis: typeof queriesModule.withEffectContextVariables === 'function',
    };
  });
}

test.describe('Carga do catálogo oficial', () => {
  test('o pacote dnd2024 é carregado pelo runtime real da página', { tag: '@critical' }, async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goHome(page);

    const retrato = await carregarCatalogoNaPagina(page);
    expect(retrato.erro, `initializeContent falhou: ${retrato.erro}`).toBeUndefined();
    expect(retrato.exportaVariaveis).toBe(true);
  });

  test('os doze handlers de classe registrados são declarados pelo conteúdo real', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goHome(page);

    const retrato = await carregarCatalogoNaPagina(page);
    expect(retrato.erro).toBeUndefined();
    expect(retrato.handlerIds).toHaveLength(12);
    expect(retrato.verificacaoOk, `verificação recusou: ${retrato.verificados}`).toBe(true);
    expect(retrato.verificados).toEqual([...retrato.handlerIds].sort());
  });

  test('as quatro classes arcanas declaram o próprio handler de classe', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goHome(page);

    const retrato = await carregarCatalogoNaPagina(page);
    expect(retrato.erro).toBeUndefined();
    for (const classe of retrato.classesArcanas) {
      expect(classe.resolvida, `${classe.slug} não resolveu no catálogo`).toBe(true);
      expect(classe.declarados, `${classe.slug} não declara class-${classe.slug}`).toContain(`class-${classe.slug}`);
    }
  });
});
