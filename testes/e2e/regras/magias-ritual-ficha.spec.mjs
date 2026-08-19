// ============================================================
// A opção de conjurar como Ritual, na ficha, para uma magia do catálogo.
//
// O motor de unidade (testes/regras/unidade/magias-conjuracao.test.mjs) prova
// pela varredura de código que toda rota de conjuração ritual em site/js/ tem
// o sufixo `-custom`, ou seja, é de magia PERSONALIZADA. Este spec mostra a
// mesma coisa do lado de quem joga: a magia está na ficha, visível, e não tem
// como ser conjurada como Ritual.
//
// PHB 2024, Magias.md:62: "A magia pode ser conjurada conforme as regras
// normais de conjuração ou como um Ritual. A versão Ritual de uma magia leva
// 10 minutos a mais para ser conjurada, mas não utiliza um espaço de magia."
//
// Detectar Magia (`tempo_conjuracao: "Ação ou Ritual"`) é uma das 31 magias
// do acervo com o marcador.
//
// Escrito como afirmação do ESTADO ATUAL, e não como `test.fail`: se alguém
// implementar a rota de ritual do catálogo, este spec fica vermelho apontando
// exatamente onde, e vira a prova da correção sem precisar ser reescrito.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

const MAGO = {
  classe: 'Mago', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
  grimorio: [{ nome: 'Detectar Magia', circulo: 1 }],
  magias_preparadas: [{ nome: 'Detectar Magia', circulo: 1 }],
};

test('ficha: Detectar Magia aparece preparada e não oferece conjuração como Ritual', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO, 'regras-mago-ritual');
  await assentar(page).catch(() => {});

  // GUARDA CONTRA VACUIDADE: sem esta asserção, "não tem botão de Ritual"
  // passaria numa ficha vazia, numa aba errada, ou com a magia ausente.
  const linha = page.locator('body');
  await expect(linha, 'a magia precisa estar visível na ficha antes de afirmar o que ela NÃO tem')
    .toContainText('Detectar Magia');

  // Nenhum gatilho de conjuração ritual em toda a ficha. O do app é
  // `data-conjurar-ritual-custom`, montado só para magia personalizada
  // (sheet/magias.js:134,146) -- e esta veio do catálogo.
  await expect(page.locator('[data-conjurar-ritual-custom]'),
    'o botão de Ritual existente é o de magia personalizada, e esta magia veio do catálogo')
    .toHaveCount(0);

  const qualquerRitual = await page.evaluate(() =>
    document.querySelectorAll('[data-conjurar-ritual], [data-conjurar-ritual-catalogo]').length);
  expect(qualquerRitual,
    'não existe rota de conjuração ritual para magia do catálogo (Magias.md:62) -- se passou a ' +
    'existir, atualize este spec e remova a lacuna magias-ritual-sem-rota')
    .toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
