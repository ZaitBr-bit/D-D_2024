// ============================================================
// Conjurar uma magia do CATÁLOGO como Ritual, na ficha.
//
// PHB 2024, Magias.md:62: "A magia pode ser conjurada conforme as regras
// normais de conjuração ou como um Ritual. A versão Ritual de uma magia leva
// 10 minutos a mais para ser conjurada, mas não utiliza um espaço de magia."
//
// Detectar Magia (`tempo_conjuracao: "Ação ou Ritual"`) é uma das 31 magias
// do acervo com o marcador.
//
// A ROTA NÃO EXISTIA. O único botão de ritual era o de magia PERSONALIZADA
// (`data-conjurar-ritual-custom`), e o do grimório do Mago estava ligado ao
// handler do Pacto do Bruxo -- dizia "Conjurar como Ritual (sem gastar
// espaço)" e só emitia um toast "via Pacto", sem conjurar nada. Corrigido na
// Correção D (2026-08-19).
//
// Este spec CLICA no botão, e é isso que o separa de uma verificação de
// marcação: o que o livro promete é que o espaço de magia NÃO seja gasto, e
// só a asserção depois do clique mede isso. O par com o botão "Conjurar"
// normal é o que dá sentido à medida -- sem ele, "os espaços não mudaram"
// passaria numa tela em que nenhum botão faz nada.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

const MAGO = {
  classe: 'Mago', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'História'],
  grimorio: [{ nome: 'Detectar Magia', circulo: 1 }],
  magias_preparadas: [{ nome: 'Detectar Magia', circulo: 1 }],
};

/** Lê quantos espaços de 1º círculo já foram usados, do personagem salvo. */
async function espacosUsados(page) {
  const p = await personagemSalvo(page);
  return p?.espacos_magia?.['1']?.usados ?? null;
}

/**
 * Abre os `<details>` da seção de magias. Os botões de conjuração vivem
 * dentro do bloco "1º Círculo", que nasce fechado -- e o Playwright não
 * clica no que está escondido.
 */
async function abrirCirculos(page) {
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  await assentar(page).catch(() => {});
}

test('ficha: Detectar Magia pode ser conjurada como Ritual, sem gastar espaço', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO, 'regras-mago-ritual');
  await assentar(page).catch(() => {});

  // GUARDA CONTRA VACUIDADE: a magia precisa estar visível na ficha antes de
  // qualquer afirmação sobre os botões dela.
  await expect(page.locator('body'),
    'a magia precisa estar na ficha antes de afirmar o que os botões dela fazem')
    .toContainText('Detectar Magia');

  await abrirCirculos(page);
  const botaoRitual = page.locator('[data-conjurar-ritual="Detectar Magia"]').first();
  await expect(botaoRitual,
    'Detectar Magia tem o marcador Ritual (tempo_conjuracao "Ação ou Ritual"), e o livro ' +
    '(Magias.md:62) permite conjurá-la sem gastar espaço -- o botão precisa existir')
    .toBeVisible();

  const antes = await espacosUsados(page);
  expect(antes,
    'o spec precisa conseguir ler os espaços de 1º círculo do personagem salvo; sem isso a ' +
    'asserção seguinte não mede nada')
    .not.toBeNull();

  await botaoRitual.click();

  // Esperar o TOAST antes de medir, e não um `assentar` genérico: a gravação é
  // assíncrona, e ler os espaços logo depois do clique já produziu falha
  // intermitente -- o spec passava sozinho e falhava na suíte cheia. Um spec
  // intermitente é pior que spec nenhum: ensina a ignorar vermelho.
  await expect(page.locator('#toast-container'),
    'a conjuração ritual precisa ter acontecido antes de medir os espaços')
    .toContainText('conjurada como Ritual');
  await assentar(page).catch(() => {});

  expect(await espacosUsados(page),
    'a versão Ritual NÃO utiliza um espaço de magia (Magias.md:62) -- se o número subiu, o ' +
    'botão de Ritual está gastando espaço como o de conjuração normal')
    .toBe(antes);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: o botão Conjurar normal GASTA espaço -- o contraste do Ritual', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO, 'regras-mago-ritual-contraste');
  await assentar(page).catch(() => {});

  await abrirCirculos(page);
  const antes = await espacosUsados(page);
  expect(antes, 'o spec precisa ler os espaços antes de medir a diferença').not.toBeNull();

  // Sem este contraste, "o Ritual não gastou espaço" passaria numa ficha em
  // que nenhum botão gasta -- ou em que o gasto nem é gravado.
  await page.locator('[data-conjurar="Detectar Magia"]').first().click();

  // Esperar o TOAST da conjuração antes de medir. `expect.poll` sozinho não
  // bastava: se a conjuração for barrada (sem espaço, conflito de
  // Concentração pedindo confirmação), nada nunca muda e o teste falha
  // dizendo "não gastou espaço" -- acusando a regra quando o problema é que
  // a ação não chegou a acontecer. Com o toast, os dois casos se distinguem.
  await expect(page.locator('#toast-container'),
    'a conjuração normal precisa ter acontecido antes de medir os espaços')
    .toContainText('conjurada');

  // `expect.poll` em vez de leitura única, pelo mesmo motivo do teste acima: a
  // gravação é assíncrona e a leitura imediata era uma corrida.
  await expect.poll(() => espacosUsados(page), {
    message: 'a conjuração normal gasta um espaço de magia; se este número não subiu, o oráculo '
      + 'do spec do Ritual não mede nada',
  }).toBe(antes + 1);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
