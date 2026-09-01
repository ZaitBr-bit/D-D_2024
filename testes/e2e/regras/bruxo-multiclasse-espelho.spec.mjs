// ============================================================
// A interface do Bruxo quando ele NAO e a classe inicial.
//
// Relato (parte de "Bruxo nao aparecendo em tela"): quatro lugares
// decidiam "isto e um Bruxo?" lendo o espelho legado `char.classe`, que
// `sincronizarEspelhos` define como a classe INICIAL. Num Mago 5/Bruxo 3 o
// espelho e "Mago", e some tudo: os truques modificados por invocacao na
// secao Magias, e tres blocos do HTML de impressao (truques do Livro das
// Sombras, espacos de pacto, e a lista do Livro das Sombras).
//
// `getEstadoRecursosBruxo()` ja usa `temClasse` e devolve null para quem
// nao e Bruxo -- entao a guarda pelo espelho nao protegia nada que a
// funcao chamada logo abaixo nao protegesse melhor. Ela so escondia a
// tela do Bruxo multiclasse.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

/** HTML que a ficha manda para a impressao. */
async function htmlDeImpressao(page) {
  return page.evaluate(async () => {
    const mod = await import(new URL('./js/sheet/impressao.js', location.href).href);
    return mod.gerarHtmlImpressao();
  });
}

/**
 * Mago 5 / Bruxo 3 -- o Bruxo NAO e a classe inicial, entao o espelho
 * `char.classe` vale "Mago" e nenhuma guarda por espelho o enxerga.
 */
async function magoBruxo(context, extras, id) {
  const lado = await abrirFicha(context, {
    nome: 'MB', especie: 'Humano', classe: 'Mago', subclasse: 'Evocação',
    nivel: 8, xp: 34000, atributos: ATRIBUTOS_REGRAS,
    classes: [
      { classe: 'Mago', subclasse: 'Evocação', nivel: 5, ordem: 0 },
      { classe: 'Bruxo', subclasse: 'Corruptor', nivel: 3, ordem: 1 },
    ],
    schema_versao: 2,
    ...extras,
  }, id);
  await assentar(lado.page).catch(() => {});
  await lado.page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  return lado.page;
}

test('secao Magias: a invocacao que modifica truque aparece no Bruxo multiclasse', async ({ context }) => {
  const page = await magoBruxo(context, {
    magias_conhecidas: [{ nome: 'Rajada Mística', circulo: 0, classe: 'Bruxo' }],
    recursos: {
      bruxo: {
        invocacoes: [
          { nome: 'Pacto do Tomo' },
          { nome: 'Explosão Agonizante', truque: 'Rajada Mística' },
        ],
      },
    },
  }, 'bruxo-esp-1');

  // GUARDA CONTRA VACUIDADE: sem o truque na tela nao ha onde a marca cair.
  await expect(page.locator('[data-magia-nome="Rajada Mística"]').first(),
    'o truque precisa estar na secao Magias para o cenario valer')
    .toBeVisible({ timeout: 10_000 });

  // Afirma o TEXTO DA MARCA, nao o nome da invocacao: o nome tambem
  // aparece na lista de invocacoes da secao do Pacto, entao procurar por
  // ele deixaria este oraculo verde mesmo com o defeito presente -- foi
  // exatamente o que aconteceu na primeira versao deste teste.
  await expect(page.locator('body'),
    'a marca "+Carisma ao dano" no truque some quando o Bruxo nao e a classe inicial')
    .toContainText('+Carisma ao dano');
});

test('impressao: os espacos de Pacto saem na folha do Bruxo multiclasse', async ({ context }) => {
  const page = await magoBruxo(context, {
    recursos: { bruxo: { invocacoes: [{ nome: 'Pacto do Tomo' }] } },
  }, 'bruxo-esp-2');

  const html = await htmlDeImpressao(page);
  expect(html, 'a folha precisa ter sido gerada').toBeTruthy();
  // "Espacos de Pacto:" e emitido SO por este bloco. Procurar por /Pacto/i
  // casava com "Pacto do Tomo" da lista de invocacoes e nascia verde.
  expect(html, 'os espacos de Magia de Pacto somem da impressao quando o Bruxo nao e a inicial')
    .toContain('Espaços de Pacto:');
});

test('impressao: o Livro das Sombras sai na folha do Bruxo multiclasse', async ({ context }) => {
  const page = await magoBruxo(context, {
    recursos: {
      bruxo: {
        invocacoes: [{ nome: 'Pacto do Tomo' }],
        livro_sombras: { truques: ['Orientação'], rituais: [] },
      },
    },
  }, 'bruxo-esp-3');

  const html = await htmlDeImpressao(page);
  expect(html, 'o truque do Livro das Sombras some da impressao do Bruxo multiclasse')
    .toContain('Orientação');
});

test('Bruxo de classe unica continua com tudo na folha, como sempre esteve', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    nome: 'B', especie: 'Humano', classe: 'Bruxo', subclasse: 'Corruptor',
    nivel: 3, atributos: ATRIBUTOS_REGRAS,
    classes: [{ classe: 'Bruxo', subclasse: 'Corruptor', nivel: 3, ordem: 0 }],
    schema_versao: 2,
    recursos: {
      bruxo: {
        invocacoes: [{ nome: 'Pacto do Tomo' }],
        livro_sombras: { truques: ['Orientação'], rituais: [] },
      },
    },
  }, 'bruxo-esp-solo');
  await assentar(page).catch(() => {});

  const html = await htmlDeImpressao(page);
  expect(html, 'classe unica nunca dependeu desta correcao -- nao pode ter regredido')
    .toContain('Orientação');
});
