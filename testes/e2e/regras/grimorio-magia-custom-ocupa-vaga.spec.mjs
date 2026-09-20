// ============================================================
// Issue #77 -- modelo da 3.0.1: magia personalizada do Mago que "ocupa
// vaga" (sempre_preparada:false, issue #71) e SAI do grimório precisa
// voltar pela lista de "Copiar Magia para o Grimório" (pagando PO/tempo),
// não só pelo toggle grátis do formulário de edição. A issue #46 excluiu
// a personalizada dessa lista, mas só previu o caso "sempre preparada"
// (derivada, nunca sai do grimório de verdade) -- a "ocupa vaga" PODE
// sair, e ficava sem caminho de volta nenhum além do toggle.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

const ATRIBUTOS_MAGO = {
  forca: 10, destreza: 14, constituicao: 14,
  inteligencia: 16, sabedoria: 10, carisma: 10,
};

const NOME_MAGIA = 'Lufada Arcana Esquecida';

const CAMPOS_MAGIA_CUSTOM = {
  nome: NOME_MAGIA, circulo: 1, sempre_preparada: false,
  escola: 'Evocação', tempo_conjuracao: '1 ação', alcance: '9 metros',
  componentes: 'V', duracao: 'Instantânea', descricao: 'Uma lufada arcana.',
  ritual: false,
};

test('Mago: magia personalizada "ocupa vaga" que caiu do grimório volta pela lista paga de Copiar Magia (issue #77)', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 5, xp: 6500,
    atributos: ATRIBUTOS_MAGO,
    pericias_proficientes: ['Arcanismo', 'Investigação'],
    moedas: { pl: 0, po: 200, pe: 0, pp: 0, pc: 0 },
    magias_customizadas: [CAMPOS_MAGIA_CUSTOM],
    // Nem em magias_preparadas, nem em grimorio -- exatamente o estado de
    // "caiu do grimório" que o issue #77 descreve.
    magias_preparadas: [], grimorio: [],
  }, 'regras-issue77-magia-ocupa-vaga-volta');
  await assentar(page).catch(() => {});

  // Abre "Copiar Magia para o Grimório" (clique real).
  await page.locator('#btn-add-grimorio').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  const grupo1 = page.locator('[data-grimorio-circulo="1"]');
  await expect(grupo1, 'precisa existir grupo de 1º círculo na lista').toHaveCount(1);
  await grupo1.locator('summary').click();

  const linhaMagia = page.locator(`[data-grim-nome="${NOME_MAGIA}"]`);
  await expect(linhaMagia,
    'a personalizada "ocupa vaga" que caiu do grimório precisa aparecer na lista paga')
    .toHaveCount(1);
  await expect(linhaMagia, 'a linha precisa avisar que é uma magia personalizada')
    .toContainText('Personalizada');

  // Clique real: comprar a cópia.
  await linhaMagia.click();
  await expect(page.locator('#toast-container')).toContainText('copiada para o grimório');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo?.grimorio?.some(m => m?.nome === NOME_MAGIA),
    'depois de pagar, a magia precisa estar de volta em char.grimorio')
    .toBe(true);

  // totalEmCobre (não o campo .po): retirarValor redistribui as
  // denominações, então o campo .po sozinho não é confiável -- mesmo
  // padrão de grimorio-mago.spec.mjs.
  const cobreDepois = await page.evaluate(async () => {
    const estado = await import(new URL('./js/sheet/estado.js', location.href).href);
    const moedas = await import(new URL('./js/moedas.js', location.href).href);
    return moedas.totalEmCobre(estado.char.moedas);
  });
  expect(cobreDepois, 'o custo (50 PO, 1º círculo) precisa ter sido descontado da carteira (200 PO iniciais)')
    .toBe(150 * 100);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Mago: magia personalizada "sempre preparada" (não ocupa vaga) continua FORA da lista paga -- o contraste', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 5, xp: 6500,
    atributos: ATRIBUTOS_MAGO,
    pericias_proficientes: ['Arcanismo', 'Investigação'],
    magias_customizadas: [{ ...CAMPOS_MAGIA_CUSTOM, nome: 'Sempre Preparada de Teste', sempre_preparada: true }],
  }, 'regras-issue77-sempre-preparada-contraste');
  await assentar(page).catch(() => {});

  await page.locator('#btn-add-grimorio').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  const grupo1 = page.locator('[data-grimorio-circulo="1"]');
  await grupo1.locator('summary').click();

  await expect(page.locator('[data-grim-nome="Sempre Preparada de Teste"]'),
    'issue #46 continua valendo para quem NUNCA sai do grimório: não pode entrar na lista paga')
    .toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
