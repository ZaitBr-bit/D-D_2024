// ============================================================
// Invocacoes Misticas PASSIVAS: o bonus que elas dao, na tela.
//
// Relato: "mente mistica nao da a magia e bonus corretamente".
//
// Mente Mistica (Classes.md:1030) nao concede magia nenhuma -- concede um
// BONUS: "Voce tem Vantagem em salvaguardas de Constituicao que realiza
// para manter a Concentracao". Ate aqui NAO EXISTIA mecanismo de
// invocacao-vira-bonus: a unica invocacao com efeito ligado era "Licoes
// dos Grandes Antigos" (concede talento) e as duas Laminas (combate.js).
// Todas as demais eram texto exibido, e o jogador nao tinha onde ler o que
// a invocacao passiva lhe dava.
//
// Sao QUATRO as invocacoes puramente passivas do PHB 2024 -- sem escolha,
// sem acao, beneficio permanente: Mente Mistica, Visao da Bruxa, Visao
// Diabolica e a metade passiva de Presente das Profundezas.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

/** Semeia um Bruxo com as invocacoes pedidas e abre a ficha. */
async function bruxoCom(context, nomes, id) {
  const lado = await abrirFicha(context, {
    nome: 'B', especie: 'Humano', classe: 'Bruxo', subclasse: 'Corruptor',
    nivel: 5, atributos: ATRIBUTOS_REGRAS,
    classes: [{ classe: 'Bruxo', subclasse: 'Corruptor', nivel: 5, ordem: 0 }],
    schema_versao: 2,
    recursos: { bruxo: { invocacoes: nomes.map((nome) => ({ nome })) } },
  }, id);
  await assentar(lado.page).catch(() => {});
  await lado.page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  return lado.page;
}

test('Mente Mistica: a Vantagem em Constituicao para Concentracao aparece na ficha', async ({ context }) => {
  const page = await bruxoCom(context, ['Pacto do Tomo', 'Mente Mística'], 'inv-passiva-1');

  // GUARDA CONTRA VACUIDADE: sem o bloco de recursos do Bruxo nao ha onde ler.
  await expect(page.locator('body'), 'o bloco de recursos do Bruxo precisa existir')
    .toContainText('Recursos do Bruxo');

  // O texto do BENEFICIO, nao o nome da invocacao: o nome ja aparecia no
  // badge da lista de invocacoes, entao procurar por ele nasceria verde
  // com o defeito presente.
  await expect(page.locator('body'),
    'o bonus de Mente Mistica nao e mostrado em lugar nenhum -- o jogador nao '
    + 'tem como saber que tem Vantagem na salvaguarda de Concentracao')
    .toContainText(/Vantagem.*Constitui[çc][ãa]o.*Concentra[çc][ãa]o/i);
});

test('Visao da Bruxa e Visao Diabolica tambem declaram o que dao', async ({ context }) => {
  const page = await bruxoCom(
    context, ['Pacto do Tomo', 'Visão da Bruxa', 'Visão Diabólica'], 'inv-passiva-2');

  await expect(page.locator('body'), 'Visao da Bruxa concede Visao Verdadeira 9 m')
    .toContainText(/Vis[ãa]o Verdadeira/i);
  await expect(page.locator('body'), 'Visao Diabolica: enxergar no escuro ate 36 m')
    .toContainText(/36 m/i);
});

test('sem invocacao passiva nenhuma, nada de passiva e inventado na tela', async ({ context }) => {
  const page = await bruxoCom(context, ['Pacto do Tomo', 'Armadura de Sombras'], 'inv-passiva-3');

  await expect(page.locator('body'), 'o bloco de recursos do Bruxo precisa existir')
    .toContainText('Recursos do Bruxo');
  // Armadura de Sombras concede MAGIA, nao bonus passivo: nao pode aparecer
  // como se desse Vantagem em coisa nenhuma.
  await expect(page.locator('#bruxo-invocacoes-passivas'),
    'sem invocacao passiva o bloco de passivas nao deve existir')
    .toHaveCount(0);
});
