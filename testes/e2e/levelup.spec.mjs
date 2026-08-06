// Subida de nivel em lockstep.
//
// classes.spec.mjs ja renderiza as 12 classes em todos os 20 niveis. O que
// ESTE arquivo acrescenta e a TRANSICAO entre niveis: o fluxo de escolhas que
// roda ao subir, e que classes.spec.mjs nunca exercita porque semeia a ficha
// ja no nivel final.
import { test, expect } from '@playwright/test';
import {
  abrirParelha, abrirFichaSemeada, instantaneoFicha, primeiraDivergencia,
  relatorioErros, resolverModalAberto,
} from './helpers.mjs';

const ATRIBUTOS = { forca: 15, destreza: 14, constituicao: 14,
                    inteligencia: 13, sabedoria: 12, carisma: 10 };

/** Nivel atual do unico personagem no localStorage. */
async function nivelAtual(page) {
  return page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    return store.listarPersonagens()[0]?.nivel ?? -1;
  });
}

/** Sobe UM nivel pela interface, resolvendo as escolhas que aparecerem. */
async function subirUmNivel(page) {
  await page.evaluate(() => {
    // Garante o fluxo v2 ligado: o modal da feature flag desviaria o teste.
    localStorage.setItem('feature.levelup.flow.v2', '1');
    document.getElementById('btn-levelup')?.click();
  });
  await page.waitForTimeout(700);

  // O fluxo em cards pode encadear varias telas (ASI/talento, subclasse,
  // magias). `resolverModalAberto` faz as escolhas e confirma cada uma.
  for (let i = 0; i < 12; i++) {
    if (!await page.locator('#modal-overlay').isVisible()) break;
    const antes = await page.evaluate(
      () => document.getElementById('modal-corpo')?.innerHTML.length ?? 0);
    await resolverModalAberto(page, 6);
    if (!await page.locator('#modal-overlay').isVisible()) break;
    const depois = await page.evaluate(
      () => document.getElementById('modal-corpo')?.innerHTML.length ?? 0);
    if (antes === depois) break;  // tela nao mudou: nao ha mais o que fazer
  }
  await page.evaluate(() => window.fecharModal?.());
  await page.waitForTimeout(500);
  return nivelAtual(page);
}

test('subir de nivel funciona no site ORIGINAL', async ({ context }) => {
  // Provar o mecanismo no site que sabidamente funciona ANTES de compara-lo.
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, {
    nome: 'Sobe Nivel', classe: 'Guerreiro', especie: 'Humano',
    antecedente: 'Soldado', nivel: 1, atributos: ATRIBUTOS,
  }, 'lvl-orig');

  const depois = await subirUmNivel(lados[0].page);
  expect(depois, 'o original nao subiu do nivel 1').toBeGreaterThan(1);
});

for (const classe of ['Guerreiro', 'Mago', 'Paladino']) {
  // Tres classes, nao as 12: cada subida 1->20 leva minutos, e o que muda
  // ENTRE classes ja e coberto por classes.spec.mjs, que renderiza todas as
  // 12 em todos os 20 niveis. As tres cobrem as formas distintas de
  // progressao -- marcial puro, conjurador pleno e meio-conjurador.
  test(`${classe}: subir do nivel 1 ao 20 mantendo paridade`, async ({ context }) => {
    test.setTimeout(600_000);
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, {
      nome: `Escalada ${classe}`, classe, especie: 'Humano',
      antecedente: 'Soldado', nivel: 1, atributos: ATRIBUTOS,
    }, `lvl-${classe.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}`);

    let ultimo = 1;
    for (let alvo = 2; alvo <= 20; alvo++) {
      const niveis = [];
      for (const l of lados) niveis.push(await subirUmNivel(l.page));

      expect(niveis[1],
        `${classe}: nivel divergiu ao subir para ${alvo} ` +
        `(original ${niveis[0]}, refatorado ${niveis[1]})`).toBe(niveis[0]);

      const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
      expect(primeiraDivergencia(a, b),
        `${classe}: ficha divergiu no nivel ${niveis[0]}`).toBeNull();

      if (niveis[0] <= ultimo) break;  // empacou igual nos dois lados
      ultimo = niveis[0];
    }

    // NAO se afirma "chegou ao nivel 20". O resolvedor generico nao completa
    // as escolhas de magia do fluxo de subida, entao conjuradores param cedo
    // -- no ORIGINAL tambem. Afirmar um alvo absoluto seria inventar uma
    // expectativa que o proprio original nao cumpre (foi o erro que este
    // arquivo ja cometeu). As asserções que valem sao as de dentro do laco:
    // os dois lados sobem para o MESMO nivel, com a MESMA ficha, sempre.
    console.log(`  ${classe}: os dois sites chegaram ao nivel ${ultimo}`);
    expect(relatorioErros(lados), `erros subindo ${classe}`).toBe('');
  });
}
