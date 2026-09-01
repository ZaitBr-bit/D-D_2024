// ============================================================
// Prova por navegador: "Copiar Magia para o Grimório" (Mago) precisa
// oferecer TODO círculo que o personagem já pode preparar -- não só os
// primeiros que couberem num teto de itens.
//
// Achado do debug de 2026-08-08 (systematic-debugging): renderGrimorio()
// em site/js/sheet/grimorio.js ordenava a lista inteira por círculo e
// cortava em .slice(0, 50) ANTES de agrupar por círculo. Com o grimório
// vazio, só o 1º e o 2º círculo de Mago já somam mais de 50 magias no
// catálogo -- o corte esgotava o teto antes de chegar ao 3º círculo, que
// desaparecia da lista inteiro, mesmo com espaços de magia de 3º círculo
// disponíveis. Reproduzido com um Mago nível 5 limpo (sem grimório prévio):
// o modal mostrava só "1º Círculo (31)" e "2º Círculo (19)" -- 31+19=50,
// a assinatura exata do corte. Corrigido: o limite agora é por círculo.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar } from './helpers-regras.mjs';

const ATRIBUTOS_MAGO = {
  forca: 10, destreza: 14, constituicao: 14,
  inteligencia: 16, sabedoria: 10, carisma: 10,
};

test('Mago nível 5, grimório vazio: o modal de cópia oferece o 1º, o 2º E o 3º círculo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 5, xp: 6500,
    atributos: ATRIBUTOS_MAGO,
    pericias_proficientes: ['Arcanismo', 'Investigação'],
  }, 'regras-mago-grimorio-1');

  await page.locator('#btn-add-grimorio').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  // O personagem tem espaços de 1º, 2º e 3º círculo (tabela do Mago,
  // nível 5) -- os três precisam aparecer como grupo, cada um com a
  // contagem completa do catálogo (grimório vazio, nada descontado).
  const grupos = page.locator('[data-grimorio-circulo]');
  await expect(grupos, 'deveria haver um grupo para cada círculo que o personagem pode preparar (1º, 2º, 3º)')
    .toHaveCount(3);

  const grupo3 = page.locator('[data-grimorio-circulo="3"]');
  await expect(grupo3, 'o 3º círculo não deveria desaparecer da lista mesmo com o 1º e o 2º somando mais de 50 magias')
    .toHaveCount(1);
  await expect(grupo3.locator('summary')).toContainText('3º Círculo (32)');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Mago nível 5: uma magia de 3º círculo pode ser copiada de verdade para o grimório', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 5, xp: 6500,
    atributos: ATRIBUTOS_MAGO,
    pericias_proficientes: ['Arcanismo', 'Investigação'],
    moedas: { pl: 0, po: 200, pe: 0, pp: 0, pc: 0 },
  }, 'regras-mago-grimorio-2');

  await page.locator('#btn-add-grimorio').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  const grupo3 = page.locator('[data-grimorio-circulo="3"]');
  await grupo3.locator('summary').click();
  await grupo3.locator('[data-grim-nome="Bola de Fogo"]').click();

  await expect(page.locator('.toast, [class*="toast"]').last(), 'deveria confirmar a cópia por toast')
    .toContainText('Bola de Fogo');

  const grimorioAtualizado = await page.evaluate(async () => {
    const estado = await import(new URL('./js/sheet/estado.js', location.href).href);
    return (estado.char.grimorio || []).some((m) => m.nome === 'Bola de Fogo' && m.circulo === 3);
  });
  expect(grimorioAtualizado, 'Bola de Fogo (3º círculo) deveria ter sido registrada no grimório do personagem')
    .toBe(true);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// Issue #42: criar uma magia PERSONALIZADA de círculo empurrava ela direto
// para char.grimorio (grimorio.js, dentro de mostrarFormMagiaCustom),
// pulando o custo de cópia (50 PO / 2h por círculo) que toda outra magia
// paga para entrar no grimório. Como Mago e Ladino/Mago são a MESMA
// classe/rotina por trás, um único Mago puro já reproduz o defeito: cria a
// magia pela tela e ela nasce registrada no grimório sem custar nada.
//
// Este teste clica nos DOIS botões envolvidos (memória do projeto: botão
// novo só está entregue com spec que clica nele) -- "Magia Personalizada"
// para criar, e "+ Copiar Magia para Grimório" para copiar de verdade -- e
// lê o personagem salvo entre os dois passos, não o DOM: é a gravação que
// pulava o custo, e só o estado salvo mede isso.
// ============================================================
test('Mago: magia customizada de círculo NÃO entra sozinha no grimório -- precisa ser copiada e paga (issue #42)', async ({ context }) => {
  const NOME_MAGIA = 'Lufada Arcana de Nimb';
  const { page, erros } = await abrirFicha(context, {
    classe: 'Mago', nivel: 5, xp: 6500,
    atributos: ATRIBUTOS_MAGO,
    pericias_proficientes: ['Arcanismo', 'Investigação'],
    moedas: { pl: 0, po: 200, pe: 0, pp: 0, pc: 0 },
  }, 'regras-mago-grimorio-magia-custom');

  // Cria a magia personalizada de 1º círculo pela tela, como o jogador faria.
  await page.click('#btn-add-magia-custom');
  await page.waitForSelector('#mc-nome', { state: 'visible', timeout: 20_000 });
  await page.fill('#mc-nome', NOME_MAGIA);
  await page.selectOption('#mc-circulo', '1');
  await page.selectOption('#mc-escola', '__personalizado__');
  await page.fill('#mc-escola-personalizada', 'Evocação');
  await page.selectOption('#mc-tempo', '1 ação');
  await page.fill('#mc-alcance', '9 metros');
  await page.check('#mc-comp-v');
  await page.selectOption('#mc-duracao', '__personalizado__');
  await page.fill('#mc-duracao-texto', 'Instantânea');
  await page.click('#btn-salvar-mc');
  await expect(page.locator('#toast-container'),
    'a magia precisa ter sido gravada antes de medir o que foi gravado')
    .toContainText('adicionada');
  await assentar(page).catch(() => {});

  // VERMELHO hoje na próxima asserção: o contorno empurrava a magia direto
  // para char.grimorio ao salvar. Recém-criada, ela não pode estar lá --
  // copiar é uma ação à parte, que custa PO e tempo.
  const antesDaCopia = await page.evaluate(async () => {
    const estado = await import(new URL('./js/sheet/estado.js', location.href).href);
    const moedas = await import(new URL('./js/moedas.js', location.href).href);
    return {
      magiasCustomizadas: estado.char.magias_customizadas || [],
      grimorio: estado.char.grimorio || [],
      totalEmCobre: moedas.totalEmCobre(estado.char.moedas),
    };
  });
  expect(antesDaCopia.magiasCustomizadas.some((m) => m.nome === NOME_MAGIA),
    'a magia precisa ter sido salva em magias_customizadas antes de medir o grimório')
    .toBe(true);
  expect(antesDaCopia.grimorio.some((m) => m?.nome === NOME_MAGIA),
    'recém-criada, a magia customizada NÃO pode estar no grimório ainda -- criar não é copiar, e ' +
    'copiar custa 50 PO / 2h por círculo')
    .toBe(false);

  // Copia pelo botão "+ Copiar Magia para Grimório": a magia personalizada
  // precisa aparecer aqui como copiável, como qualquer outra do acervo.
  await page.locator('#btn-add-grimorio').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  const grupo1 = page.locator('[data-grimorio-circulo="1"]');
  await grupo1.locator('summary').click();
  await grupo1.locator(`[data-grim-nome="${NOME_MAGIA}"]`).click();
  await expect(page.locator('.toast, [class*="toast"]').last(), 'deveria confirmar a cópia por toast')
    .toContainText(NOME_MAGIA);
  await assentar(page).catch(() => {});

  const depoisDaCopia = await page.evaluate(async () => {
    const estado = await import(new URL('./js/sheet/estado.js', location.href).href);
    const moedas = await import(new URL('./js/moedas.js', location.href).href);
    return {
      grimorio: estado.char.grimorio || [],
      totalEmCobre: moedas.totalEmCobre(estado.char.moedas),
    };
  });
  expect(depoisDaCopia.grimorio.some((m) => m?.nome === NOME_MAGIA && m.circulo === 1),
    'depois de pagar a cópia, a magia customizada precisa entrar no grimório')
    .toBe(true);
  // totalEmCobre (não o campo .po) porque retirarValor redistribui a
  // carteira nas MENOS moedas possíveis (site/js/moedas.js,
  // distribuirCobre) -- 200 PO menos 50 PO vira 15 PL, não 150 PO. Só o
  // valor total é estável entre as duas leituras.
  expect(antesDaCopia.totalEmCobre - depoisDaCopia.totalEmCobre,
    'copiar 1 magia de 1º círculo custa 50 PO')
    .toBe(50 * 100); // VALOR_EM_COBRE.po (site/js/moedas.js) = 100

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
