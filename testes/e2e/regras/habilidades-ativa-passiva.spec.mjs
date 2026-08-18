// ============================================================
// A ficha imprime cada característica na seção certa, e não oferece
// controle de uso a quem não se esgota.
//
// Os motores de unidade (classes-passivas.test.mjs, subclasses-recursos.
// test.mjs) já confrontam ehHabilidadeAtiva/detectarRecarga/
// detectarUsosMaximos contra o livro, característica a característica. O
// que só o navegador prova é a consequência que o jogador encontra: em
// qual das duas listas o nome aparece, e se existe um botão clicável ao
// lado dele.
//
// PHB 2024, Ataque Extra do Guerreiro (Classes.md:3852): "...sempre que
// executar a ação Atacar no seu turno" -- benefício contínuo, sem custo. O
// app o colocava em "Habilidades Ativas" porque 'no seu turno' estava na
// lista de gatilhos de ehHabilidadeAtiva.
//
// PHB 2024, Maestria em Arma do Guerreiro (Classes.md:3816): "Sempre que
// completar um Descanso Longo, você pode praticar movimentos com armas e
// alterar uma dessas escolhas" -- troca de escolha permanente, não recarga
// de uso. O app a punha em "Ativas" pelo curto-circuito `if (recarga)
// return true`, e ainda lhe pendurava o selo "🌙 Desc. Longo".
//
// PHB 2024, Fúria Implacável do Bárbaro (Classes.md:153): a CD volta a 10
// no descanso, mas a característica não tem limite de uso. O app lhe dava
// um botão "Usar / ✗ Esgotado" com 2 usos, porque detectarUsosMaximos lia
// "duas vezes seu nível de Bárbaro" -- a fórmula de PV recuperado -- como
// contagem de usos.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha } from './helpers-regras.mjs';

const GUERREIRO = {
  classe: 'Guerreiro', nivel: 5, xp: 14000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
};

const BARBARO = {
  classe: 'Bárbaro', nivel: 11, xp: 100000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'Intimidação'],
};

/**
 * Devolve os nomes de característica listados em cada uma das duas seções
 * do card "Características de Classe". A estrutura é plana: um
 * `<div class="section-divider">` com o título, seguido dos `<details>` de
 * cada característica como IRMÃOS, até o divisor seguinte
 * (site/js/sheet/caracteristicas.js:41-51).
 */
async function secoesDeHabilidade(page) {
  // Espera os divisores existirem antes de varrer. Sem isto o spec lia o DOM
  // antes de renderFichaCompleta terminar e devolvia duas listas vazias --
  // flake real, que so aparecia com a suite inteira rodando em paralelo.
  await page.waitForSelector('.section-divider', { state: 'attached', timeout: 15_000 });
  return page.evaluate(() => {
    const saida = { ativas: [], passivas: [] };
    for (const divisor of document.querySelectorAll('.section-divider')) {
      const titulo = (divisor.textContent || '').trim();
      const alvo = titulo === 'Habilidades Ativas' ? 'ativas'
        : titulo === 'Habilidades Passivas' ? 'passivas' : null;
      if (!alvo) continue;
      let el = divisor.nextElementSibling;
      while (el && !el.classList.contains('section-divider')) {
        const resumo = el.querySelector?.(':scope > summary');
        if (resumo) saida[alvo].push(resumo.textContent.replace(/\s+/g, ' ').trim());
        el = el.nextElementSibling;
      }
    }
    return saida;
  });
}

test('ficha: Ataque Extra e Maestria em Arma aparecem em Habilidades Passivas', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-ativa-guerreiro');

  const { ativas, passivas } = await secoesDeHabilidade(page);

  // Guarda contra asserção vazia: se o seletor deixar de casar, as duas
  // listas vêm vazias e todo `not.toContain` abaixo passaria por vacuidade.
  expect(ativas.length + passivas.length,
    'a ficha de um Guerreiro nível 5 deveria listar características em alguma das duas seções')
    .toBeGreaterThan(0);

  const contem = (lista, nome) => lista.some((n) => n.includes(nome));

  for (const nome of ['Ataque Extra', 'Maestria em Arma']) {
    expect(contem(passivas, nome),
      `${nome} deveria estar em Passivas. Ativas: ${ativas.join(' | ')}`).toBe(true);
    expect(contem(ativas, nome),
      `${nome} não deveria estar em Ativas -- o livro não lhe dá custo nenhum`).toBe(false);
  }

  // Surto de Ação é o contraste que prova que a seção "Ativas" não secou:
  // ela TEM custo (uso limitado que volta no descanso) e continua lá.
  expect(contem(ativas, 'Surto de Ação'),
    `Surto de Ação deveria continuar em Ativas. Passivas: ${passivas.join(' | ')}`).toBe(true);

  // A Maestria em Arma também não pode mais ostentar selo de recarga: ela
  // nunca se esgota, só permite trocar a escolha no Descanso Longo.
  const maestria = passivas.find((n) => n.includes('Maestria em Arma')) || '';
  expect(maestria, 'Maestria em Arma não deveria ter selo de recarga de Descanso')
    .not.toMatch(/Desc\.|Curto\/Longo/);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: Fúria Implacável não ganha contador de usos', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BARBARO, 'regras-ativa-barbaro');

  const card = page.locator('details', { hasText: 'Fúria Implacável' }).first();
  await expect(card, 'a ficha de um Bárbaro nível 11 deveria listar Fúria Implacável')
    .toHaveCount(1);

  // O contador do fallback genérico renderiza como "0/2"/"2/2" no summary,
  // e o botão de uso como [data-usar-habilidade]. Nenhum dos dois cabe numa
  // capacidade sem limite de uso.
  await expect(card, 'Fúria Implacável não deveria mostrar contador de usos -- ela não se esgota')
    .not.toContainText('/2');
  await expect(card.locator('[data-usar-habilidade]'),
    'Fúria Implacável não deveria ganhar botão "Usar / ✗ Esgotado"')
    .toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
