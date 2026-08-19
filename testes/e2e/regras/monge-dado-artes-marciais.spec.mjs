// ============================================================
// Dado de Artes Marciais do Monge: a ficha tem de mostrar o dado do
// livro (d6, d8, d10, d12), não um número inventado.
//
// PHB 2024, Classes.md (tabela do Monge): a coluna "Artes Marciais"
// traz "1d6" no nível 1, "1d8" no 5, "1d10" no 11 e "1d12" no 17 --
// e é assim que o acervo (dados/) guarda o valor.
//
// O defeito relatado (2026-08-19): a ficha exibia "d16". A leitura da
// tabela fazia `parseInt("1d6".replace(/[^\d]/g, ''))`, que apaga o
// "d" e cola os dois números -- 1d6 virava 16, 1d8 virava 18, 1d10
// virava 110 e 1d12 virava 112. O número contaminava também a cura de
// Integridade Corporal ("cure 1d16 + SAB").
//
// Por isso o teste varre NÍVEIS DIFERENTES: com só o nível 1, trocar o
// dado por uma constante "6" passaria no teste sem ler a tabela.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

// Nível → dado que a tabela do livro dá ao Monge.
const DADO_POR_NIVEL = [
  { nivel: 1, xp: 0, dado: 'd6' },
  { nivel: 5, xp: 6500, dado: 'd8' },
  { nivel: 11, xp: 85000, dado: 'd10' },
  { nivel: 17, xp: 225000, dado: 'd12' },
];

for (const { nivel, xp, dado } of DADO_POR_NIVEL) {
  test(`ficha do Monge nível ${nivel}: Artes Marciais mostra ${dado}`, async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      classe: 'Monge', nivel, xp, atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Acrobacia', 'Furtividade'],
    }, `regras-monge-dado-${nivel}`);
    await assentar(page).catch(() => {});

    // Abrir os `<details>` E ler no MESMO passo, dentro de um poll: a ficha
    // se re-renderiza depois do primeiro `assentar` (fechando o que foi
    // aberto), e abrir uma vez só dava falha intermitente sob 4 workers --
    // "hidden" num elemento cujo texto já estava certo. Spec intermitente é
    // pior que spec nenhum: ensina a ignorar vermelho.
    const textoDaFichaAberta = () => page.evaluate(() => {
      document.querySelectorAll('details').forEach((d) => { d.open = true; });
      return document.body.innerText;
    });

    // GUARDA CONTRA VACUIDADE: a característica precisa estar na tela antes
    // de qualquer afirmação sobre o dado que ela anuncia.
    await expect.poll(textoDaFichaAberta, {
      message: 'a característica Artes Marciais precisa aparecer na ficha do Monge',
    }).toContain('Dado de dano:');

    await expect.poll(textoDaFichaAberta, {
      message: `no nível ${nivel} a tabela do livro dá ${dado} de Artes Marciais`,
    }).toContain(`Dado de dano: ${dado}`);

    // E nenhum dado impossível pode sobrar em lugar nenhum da ficha: d16,
    // d18, d110 e d112 são o sintoma exato que o jogador relatou.
    const textoFicha = await textoDaFichaAberta();
    expect(textoFicha.match(/\bd1(6|8|10|12)\b/g) || [],
      'a ficha não pode exibir dados inexistentes (d16/d18/d110/d112) -- é o "1d6" da tabela '
      + 'com o "d" apagado e os números colados')
      .toEqual([]);

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });
}
