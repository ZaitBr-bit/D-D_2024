// Magias em uso na ficha: secao renderizada, conjuracao e espacos gastos.
//
// O bloqueio aqui nunca foi o clique -- foi PREPARAR o estado. Um conjurador
// sem magias preparadas renderiza uma secao vazia nos dois sites, e o teste
// passaria sem medir nada. Por isso o primeiro teste do arquivo verifica a
// propria fixture antes de qualquer comparacao.
import { test, expect } from '@playwright/test';
import {
  abrirParelha, abrirFichaSemeada, instantaneoFicha, primeiraDivergencia,
  relatorioErros,
} from './helpers.mjs';
import { conjuradorPreparado } from './fixtures.mjs';
import { conjuradoras } from './dados.mjs';

const slug = (s) => s.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase();

test('a fixture do conjurador produz magias conjuraveis na tela', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, conjuradorPreparado('Mago', 5), 'mag-fix');

  for (const l of lados) {
    const conjuraveis = await l.page.locator('[data-conjurar]').count();
    expect(conjuraveis,
      `${l.nome}: nenhuma magia conjuravel; a fixture nao esta preparando o estado`)
      .toBeGreaterThan(0);
  }
});

// Este teste ficou pulado com a justificativa de que semear nao produzia
// estado conjuravel. Estava errado: a causa era o `grimorio` da fixture
// guardar strings em vez de objetos `{nome, circulo}`, o que fazia o render
// da secao de magias lancar ANTES de criar os botoes de conjurar. Corrigida
// a fixture, semear basta -- nao foi preciso passar pelo wizard.
test('conjurar uma magia gasta o mesmo espaco nos dois', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, conjuradorPreparado('Mago', 5), 'mag-conj');

  for (const l of lados) {
    await l.page.evaluate(() => document.querySelector('[data-conjurar]')?.click());
    await l.page.waitForTimeout(800);
    // Alguns caminhos abrem modal de circulo ou de alvo; confirmar o primeiro
    // botao primario disponivel.
    if (await l.page.locator('#modal-overlay').isVisible()) {
      await l.page.evaluate(() => {
        document.querySelector(
          '#modal-acoes .btn-primary, #modal-acoes .btn-success')?.click();
      });
      await l.page.waitForTimeout(600);
    }
  }

  const espacos = await Promise.all(lados.map((l) => l.page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    return store.listarPersonagens()[0]?.espacos_magia;
  })));
  expect(espacos[1], 'espacos de magia divergiram apos conjurar').toEqual(espacos[0]);

  const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
  expect(primeiraDivergencia(a, b), 'ficha divergiu apos conjurar').toBeNull();
  expect(relatorioErros(lados), 'erros ao conjurar').toBe('');
});

for (const classe of conjuradoras()) {
  test(`${classe}: ficha com magias preparadas renderiza igual`, async ({ context }) => {
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, conjuradorPreparado(classe, 5), `mag-${slug(classe)}`);

    const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
    expect(primeiraDivergencia(a, b), `${classe}: ficha com magias difere`).toBeNull();

    // Comparativo, nao absoluto: com esta fixture o app lanca
    // `localeCompare` sobre undefined em Guardiao, Mago e Paladino -- IGUAL
    // nos dois sites. E limitacao da fixture (ver PERGUNTAS-PARA-REVISAO),
    // nao regressao. O que se afirma e que o refatorado nao erra nada que o
    // original nao erre.
    // Agora a fixture nao leva mais o app a lancar (o grimorio passou a ser
    // objetos `{nome, circulo}` em vez de strings), entao a ausencia de erros
    // volta a ser exigivel -- e o ORIGINAL tambem a satisfaz.
    expect(relatorioErros(lados), `erros na ficha de ${classe}`).toBe('');
  });
}
