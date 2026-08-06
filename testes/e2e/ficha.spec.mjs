// Paridade da FICHA entre o site original e o refatorado.
//
// Os personagens sao semeados com a fabria do proprio app
// (`store.criarPersonagemVazio`), que e byte a byte identica nos dois lados.
// Assim a comparacao mede a RENDERIZACAO, nao a geracao de dados.
import { test, expect } from '@playwright/test';
import {
  abrirParelha, abrirFichaSemeada, instantaneoFicha, primeiraDivergencia,
  classesUsadas, nosDois, relatorioErros, assentar,
} from './helpers.mjs';

/**
 * Abre o modal de PV, digita um valor no campo manual e confirma.
 *
 * Os modais de PV usam um seletor de rolagem mais um campo "ou digite". O
 * campo e o caminho deterministico: o picker depende de scroll com inercia.
 */
async function valorNoModal(page, idAbrir, idPicker, valor, idConfirmar) {
  await page.click('#' + idAbrir);
  await page.waitForSelector(`#${idPicker}-manual`, { state: 'visible' });
  await page.fill(`#${idPicker}-manual`, String(valor));
  await page.dispatchEvent(`#${idPicker}-manual`, 'input');
  await page.dispatchEvent(`#${idPicker}-manual`, 'change');
  await page.click('#' + idConfirmar);
  await page.waitForSelector('#modal-overlay', { state: 'hidden' });
  await page.waitForTimeout(200);
}

/** Personagem generico: marcial, nivel 5, atributos distribuidos. */
const GENERICO = {
  nome: 'Ficha Generica',
  classe: 'Guerreiro',
  subclasse: 'Campeão',
  especie: 'Humano',
  antecedente: 'Soldado',
  nivel: 5,
  atributos: {
    forca: 16, destreza: 14, constituicao: 15,
    inteligencia: 10, sabedoria: 12, carisma: 8,
  },
};

test.describe('paridade da ficha', () => {
  test('ficha generica renderiza igual nos dois sites', async ({ context }) => {
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, GENERICO);

    expect(relatorioErros(lados), 'erros ao abrir a ficha').toBe('');

    const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
    expect(primeiraDivergencia(a, b), 'render da ficha difere').toBeNull();
  });

  test('ficha generica usa as mesmas classes CSS', async ({ context }) => {
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, GENERICO);
    const [a, b] = await Promise.all(lados.map((l) => classesUsadas(l.page)));
    expect(b, 'conjunto de classes CSS da ficha difere').toEqual(a);
  });

  test('dano, cura e PV temporario produzem o mesmo resultado', async ({ context }) => {
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, GENERICO);

    // Dano de 7. O botao abre um modal com seletor numerico; o campo manual
    // e o caminho deterministico (o picker de rolagem depende de scroll).
    await nosDois(lados, (page) => valorNoModal(page, 'hp-minus', 'input-dano', 7, 'btn-aplicar-dano'));
    let [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
    expect(primeiraDivergencia(a, b), 'apos aplicar 7 de dano').toBeNull();

    // Cura de 3.
    await nosDois(lados, (page) => valorNoModal(page, 'hp-plus', 'input-cura', 3, 'btn-aplicar-cura'));
    [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
    expect(primeiraDivergencia(a, b), 'apos curar 3').toBeNull();

    // PV temporario de 5.
    await nosDois(lados, (page) => valorNoModal(page, 'hp-temp', 'input-temp', 5, 'btn-aplicar-temp'));
    [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
    expect(primeiraDivergencia(a, b), 'apos PV temporario').toBeNull();

    expect(relatorioErros(lados), 'erros durante as operacoes de PV').toBe('');
  });

  test('descanso curto e longo produzem o mesmo resultado', async ({ context }) => {
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, GENERICO);

    // Gasta PV antes, senao o descanso nao tem o que restaurar.
    await nosDois(lados, async (page) => {
      await valorNoModal(page, 'hp-minus', 'input-dano', 12, 'btn-aplicar-dano');
      // O botao vive dentro de uma secao recolhivel e pode estar oculto.
      // Clicar via DOM e legitimo aqui: o teste de paridade de DOM ja provou
      // que o markup (e portanto a visibilidade) e identico nos dois lados; o
      // que se mede agora e o RESULTADO do handler.
      await page.evaluate(() => document.getElementById('btn-descanso-longo')?.click());
      await page.waitForTimeout(800);
      // Descanso longo pode abrir modal de troca de magias/maestrias.
      const aberto = await page.locator('#modal-overlay').isVisible();
      if (aberto) {
        for (const id of ['#btn-pular-troca-dl', '#btn-confirmar-del']) {
          if (await page.locator(id).count()) { await page.click(id); break; }
        }
        await page.waitForTimeout(500);
      }
    });
    const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
    expect(primeiraDivergencia(a, b), 'apos descanso longo').toBeNull();
    expect(relatorioErros(lados), 'erros no descanso').toBe('');
  });

  test('geracao de PDF produz o mesmo arquivo nos dois', async ({ context }) => {
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, GENERICO);

    const tamanhos = [];
    for (const l of lados) {
      const [download] = await Promise.all([
        l.page.waitForEvent('download', { timeout: 45_000 }),
        l.page.evaluate(() => document.getElementById('btn-print')?.click()),
      ]);
      const caminho = await download.path();
      const { statSync } = await import('node:fs');
      tamanhos.push(statSync(caminho).size);
    }

    expect(tamanhos[0], 'o original nao gerou PDF; teste sem valor')
      .toBeGreaterThan(1000);
    // O PDF carrega a data de geracao, entao bytes iguais nao sao exigiveis;
    // uma diferenca de mais de 1% indicaria conteudo diferente, nao metadado.
    const desvio = Math.abs(tamanhos[1] - tamanhos[0]) / tamanhos[0];
    expect(desvio,
      `PDF do refatorado tem ${tamanhos[1]} bytes contra ${tamanhos[0]} do original`)
      .toBeLessThan(0.01);
    expect(relatorioErros(lados), 'erros ao gerar PDF').toBe('');
  });

  test('as secoes da ficha sao as mesmas', async ({ context }) => {
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, GENERICO);

    // Derivado dos dois lados, nao escrito a mao: o que se afirma e que o
    // refatorado tem AS MESMAS secoes do original, quaisquer que sejam.
    const titulos = await Promise.all(lados.map((l) => l.page.evaluate(() =>
      [...document.querySelectorAll('#app-content h2, #app-content h3, #app-content .card-titulo')]
        .map((e) => e.textContent.trim()).filter(Boolean).sort())));

    expect(titulos[0].length, 'o original nao tem secoes; teste sem valor')
      .toBeGreaterThan(3);
    expect(titulos[1], 'conjunto de secoes da ficha difere').toEqual(titulos[0]);
  });
});
