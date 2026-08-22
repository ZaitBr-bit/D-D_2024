// ============================================================
// Edição manual de atributos na ficha pronta (issue #13).
//
// O modal de edição sempre governou a REDISTRIBUIÇÃO dos valores do método
// usado na criação (sheet/edicao.js). O que não existia é o caminho livre: ver
// 16 e digitar 17. Este spec exercita esse caminho de ponta a ponta, com
// clique de verdade no gatilho -- "o botão aparece" não vale como asserção
// neste repositório.
//
// Semente: Guerreiro nível 5, Destreza 16 (base 15 + 1 de antecedente),
// Constituição 14. Nível 5 é escolhido de propósito: torna o efeito do PV
// retroativo grande o bastante para não se confundir com arredondamento.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, lerToastErro, personagemSalvo } from './helpers-regras.mjs';

const SEMENTE = {
  classe: 'Guerreiro', nivel: 5, antecedente: 'Soldado',
  bonus_antecedente: { destreza: 1 },
  atributos_base: { forca: 12, destreza: 15, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 8 },
  atributos: { forca: 12, destreza: 16, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 8 },
  configuracao_criacao: { atributos: { metodo: 'rolagem', valoresBase: { forca: 12, destreza: 15, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 8 }, rolagens: { forca: 12, destreza: 15, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 8 } } },
  pericias_proficientes: ['Atletismo', 'História'],
  pv_max: 44, pv_atual: 44,
};

/** Abre a ficha da semente e entra no modo de edição manual do modal. */
async function abrirEdicaoManual(context, id) {
  const lado = await abrirFicha(context, SEMENTE, id);
  await lado.page.click('#btn-editar-ficha');
  await lado.page.waitForSelector('#modal-overlay', { state: 'visible' });
  await lado.page.click('#btn-edicao-modo-manual');
  await assentar(lado.page).catch(() => {});
  return lado;
}

test('ficha: o modo manual aceita um valor livre e persiste o total', async ({ context }) => {
  const { page, erros } = await abrirEdicaoManual(context, 'regras-edicao-manual-1');

  const campos = page.locator('[data-edicao-manual-atributo]');
  await expect(campos.first(), 'o modo manual deveria montar os seis campos livres').toBeVisible();
  expect(await campos.count(), 'seis atributos, seis campos').toBe(6);
  expect(await page.inputValue('[data-edicao-manual-atributo="destreza"]'),
    'o campo deveria abrir com o TOTAL exibido na ficha, não com a base').toBe('16');

  await page.fill('[data-edicao-manual-atributo="destreza"]', '17');
  await page.locator('[data-edicao-manual-atributo="destreza"]').dispatchEvent('change');
  await assentar(page).catch(() => {});
  await page.click('#btn-salvar-edicao-ficha');
  await page.waitForTimeout(400);

  expect(await page.locator('#modal-overlay').isVisible(),
    'o modal deveria fechar após um ajuste válido').toBe(false);

  const salvo = await personagemSalvo(page);
  expect(salvo?.atributos?.destreza, 'o total deveria ter ido para 17').toBe(17);
  expect(salvo?.atributos_base?.destreza, 'a base NÃO pode ser tocada pela edição livre').toBe(15);
  expect(salvo?.configuracao_criacao?.atributos?.metodo,
    'o método usado na criação tem de continuar registrado').toBe('rolagem');
  expect(salvo?.edicoes?.campos?.atributos?.manual, 'o delta manual deveria ter sido gravado')
    .toEqual({ destreza: 1 });

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: a composição do modo manual declara o ganho de nível e soma o total exibido', async ({ context }) => {
  // Destreza 17 com base 15 e +1 de antecedente só fecha com mais um termo:
  // +1 de ganho de sistema (Aumento de Atributo/capstone). Sem esse termo a
  // composição exibida não bate com o total mostrado logo abaixo, para
  // qualquer personagem que já subiu de nível (achado da revisão da Task 4).
  const comGanhoDeNivel = { ...SEMENTE, atributos: { ...SEMENTE.atributos, destreza: 17 } };
  const lado = await abrirFicha(context, comGanhoDeNivel, 'regras-edicao-manual-ganho-nivel');
  await lado.page.click('#btn-editar-ficha');
  await lado.page.waitForSelector('#modal-overlay', { state: 'visible' });
  await lado.page.click('#btn-edicao-modo-manual');
  await assentar(lado.page).catch(() => {});

  const composicao = await lado.page.locator('.atributo-box[data-key="destreza"] div[style*="0.65rem"]').innerText();
  expect(composicao, 'a composição deveria declarar o ganho de nível').toContain('nível');

  const termos = composicao.split(' · ').map(termo => Number(termo.match(/-?\+?\d+/)[0]));
  const soma = termos.reduce((total, valor) => total + valor, 0);
  expect(soma, `os termos de "${composicao}" deveriam somar o total exibido (17)`).toBe(17);
});

test('ficha: o modo manual grampeia (não recusa) o valor digitado acima de 20', async ({ context }) => {
  const { page } = await abrirEdicaoManual(context, 'regras-edicao-manual-2');

  // O `max` do input impede a digitação em navegador; o `change` do módulo
  // GRAMPEIA o valor em 20 -- não há recusa nem toast, o campo é corrigido
  // silenciosamente. A força da semente é 12, então o grampeio em 20 tem de
  // se refletir também no delta manual gravado (+8), prova de que o 20
  // salvo veio desse grampeio e não de outro caminho.
  await page.fill('[data-edicao-manual-atributo="forca"]', '25');
  await page.locator('[data-edicao-manual-atributo="forca"]').dispatchEvent('change');
  await assentar(page).catch(() => {});
  await page.click('#btn-salvar-edicao-ficha');
  await page.waitForTimeout(400);

  const salvo = await personagemSalvo(page);
  expect(salvo?.atributos?.forca, 'o teto de 20 tem de segurar mesmo no modo sem regras').toBe(20);
  expect(salvo?.edicoes?.campos?.atributos?.manual?.forca,
    'o delta manual gravado deveria refletir o valor grampeado (12 -> 20), não os 25 digitados').toBe(8);
});

test('ficha: o método da criação continua acessível ao lado do modo manual', async ({ context }) => {
  const lado = await abrirFicha(context, SEMENTE, 'regras-edicao-manual-3');
  await lado.page.click('#btn-editar-ficha');
  await lado.page.waitForSelector('#modal-overlay', { state: 'visible' });

  expect(await lado.page.locator('[data-edicao-atributo]').count(),
    'com o modo manual DESLIGADO a tela é a de sempre').toBe(6);
  expect(await lado.page.locator('[data-edicao-manual-atributo]').count(),
    'os campos livres só aparecem depois do clique no toggle').toBe(0);

  await lado.page.click('#btn-edicao-modo-manual');
  await assentar(lado.page).catch(() => {});
  expect(await lado.page.locator('[data-edicao-manual-atributo]').count()).toBe(6);

  await lado.page.click('#btn-edicao-modo-manual');
  await assentar(lado.page).catch(() => {});
  expect(await lado.page.locator('[data-edicao-atributo]').count(),
    'clicar de novo deveria devolver a tela do método da criação').toBe(6);
});

test('ficha antiga sem método de criação pode ser ajustada à mão', async ({ context }) => {
  // O modal com regras exige "Informe o método de criação" antes de qualquer
  // edição (sheet/edicao.js). Ficha criada antes de o app registrar o método —
  // ou montada pelo inspetor, como a do autor da issue — fica presa nessa
  // exigência. O modo livre não a aplica, e é essa a saída.
  const semMetodo = { ...SEMENTE, configuracao_criacao: { atributos: { metodo: null, valoresBase: null, rolagens: null } } };
  const lado = await abrirFicha(context, semMetodo, 'regras-edicao-manual-sem-metodo');
  await lado.page.click('#btn-editar-ficha');
  await lado.page.waitForSelector('#modal-overlay', { state: 'visible' });
  await lado.page.click('#btn-edicao-modo-manual');
  await assentar(lado.page).catch(() => {});

  await lado.page.fill('[data-edicao-manual-atributo="carisma"]', '12');
  await lado.page.locator('[data-edicao-manual-atributo="carisma"]').dispatchEvent('change');
  await lado.page.click('#btn-salvar-edicao-ficha');
  await lado.page.waitForTimeout(400);

  expect(await lerToastErro(lado.page),
    'o modo livre não pode cobrar o método de criação').toBe(null);
  const salvo = await personagemSalvo(lado.page);
  expect(salvo?.atributos?.carisma, 'o ajuste deveria ter sido salvo mesmo sem método').toBe(12);
});

test('ficha: o ajuste manual fica visível e a cascata acompanha', async ({ context }) => {
  const { page, erros } = await abrirEdicaoManual(context, 'regras-edicao-manual-4');

  // Salvaguarda de Destreza ANTES: mod +3 (16), Guerreiro não é proficiente em
  // Destreza, então o valor exibido é o modificador puro.
  await page.fill('[data-edicao-manual-atributo="destreza"]', '18');
  await page.locator('[data-edicao-manual-atributo="destreza"]').dispatchEvent('change');
  await page.click('#btn-salvar-edicao-ficha');
  await page.waitForTimeout(400);
  await assentar(page).catch(() => {});

  const caixaDestreza = page.locator('.atributo-box', { hasText: 'Destreza' }).first();
  const textoCaixa = await caixaDestreza.innerText();
  expect(textoCaixa, 'a caixa da Destreza deveria mostrar o quanto foi ajustado à mão').toContain('+2 manual');
  expect(textoCaixa, 'o total novo deveria estar na caixa').toContain('18');
  expect(textoCaixa, 'o modificador deveria ter subido de +3 para +4').toContain('+4');

  // A composição completa mora no title da marca -- os termos (exceto a data)
  // têm de somar o total exibido na caixa, o mesmo cuidado que a Task 4 já
  // garante para a composição do modal (achado da revisão daquela task).
  const composicao = await caixaDestreza.locator('div[style*="0.65rem"]').getAttribute('title');
  const termos = composicao.split(' · ').filter(termo => !termo.includes('/'));
  const soma = termos.reduce((total, termo) => total + Number(termo.match(/-?\+?\d+/)[0]), 0);
  expect(soma, `os termos de "${composicao}" deveriam somar o total exibido (18)`).toBe(18);

  // Cascata: iniciativa é calculada no render a partir de char.atributos, sem
  // código novo. Guerreiro nível 5 sem talento de iniciativa: o valor exibido
  // é o modificador puro de Destreza.
  const iniciativa = page.locator('.stat-box', { hasText: 'Iniciativa' }).first().locator('.stat-value');
  expect((await iniciativa.innerText()).trim(),
    'a iniciativa deveria refletir o novo modificador de Destreza').toBe('+4');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: a marca de ajuste manual declara o ganho de nível quando o personagem já subiu de nível', async ({ context }) => {
  // Destreza 17 com base 15 e +1 de antecedente só fecha com o termo de ganho
  // de sistema (+1, um Aumento de Atributo/capstone qualquer). Esta é a
  // contraparte, na FICHA, do que o teste "a composição do modo manual
  // declara..." já cobre no MODAL -- sem ela o ramo `+N nível` de
  // marcaAjusteManual (estado.js) nunca roda com um valor diferente de zero
  // (achado da revisão da Task 5).
  const comGanhoDeNivel = { ...SEMENTE, atributos: { ...SEMENTE.atributos, destreza: 17 } };
  const { page, erros } = await abrirFicha(context, comGanhoDeNivel, 'regras-edicao-manual-5-ganho-nivel');
  await page.click('#btn-editar-ficha');
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  await page.click('#btn-edicao-modo-manual');
  await assentar(page).catch(() => {});

  await page.fill('[data-edicao-manual-atributo="destreza"]', '19');
  await page.locator('[data-edicao-manual-atributo="destreza"]').dispatchEvent('change');
  await page.click('#btn-salvar-edicao-ficha');
  await page.waitForTimeout(400);
  await assentar(page).catch(() => {});

  const caixaDestreza = page.locator('.atributo-box', { hasText: 'Destreza' }).first();
  const textoCaixa = await caixaDestreza.innerText();
  expect(textoCaixa, 'a marca deveria mostrar o delta manual (17 -> 19)').toContain('+2 manual');
  expect(textoCaixa, 'o total novo deveria estar na caixa').toContain('19');

  const composicao = await caixaDestreza.locator('div[style*="0.65rem"]').getAttribute('title');
  expect(composicao, 'a composição deveria declarar o ganho de nível').toContain('nível');

  const termos = composicao.split(' · ').filter(termo => !termo.includes('/'));
  const soma = termos.reduce((total, termo) => total + Number(termo.match(/-?\+?\d+/)[0]), 0);
  expect(soma, `os termos de "${composicao}" deveriam somar o total exibido (19)`).toBe(19);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: editar Constituição move o PV máximo, e reverter devolve', async ({ context }) => {
  const { page, erros } = await abrirEdicaoManual(context, 'regras-edicao-manual-5');

  // CON 14 -> 16 é +1 de modificador; nível 5 vale +5 PV máximos.
  await page.fill('[data-edicao-manual-atributo="constituicao"]', '16');
  await page.locator('[data-edicao-manual-atributo="constituicao"]').dispatchEvent('change');
  await page.click('#btn-salvar-edicao-ficha');
  await page.waitForTimeout(400);

  const depois = await personagemSalvo(page);
  expect(depois?.atributos?.constituicao).toBe(16);
  expect(depois?.pv_max, '+1 de modificador de CON vale +1 PV por nível (5 níveis)').toBe(49);
  expect(depois?.pv_atual, 'o PV atual acompanha o ganho').toBe(49);

  // Reverter tem de desfazer TAMBÉM o PV -- sem isso o personagem fica com PV
  // inflado para sempre, e a origem some junto com a marca.
  await page.click('#btn-editar-ficha');
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  await page.click('[data-reverter-atributos]');
  await page.waitForTimeout(400);

  const revertido = await personagemSalvo(page);
  expect(revertido?.atributos?.constituicao, 'a reversão devolve o atributo').toBe(14);
  expect(revertido?.pv_max, 'a reversão devolve o PV que a edição concedeu').toBe(44);
  expect(revertido?.pv_atual).toBe(44);
  expect(revertido?.edicoes?.campos?.atributos, 'a marca manual sai junto').toBe(undefined);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: um único clique em Salvar no modo manual roda o salvamento uma única vez (achado Important 1)', async ({ context }) => {
  // O botão Salvar mora no RODAPÉ do modal, fora de #edicao-ficha-corpo, e
  // por isso NUNCA é recriado pelos re-renders do corpo. Antes da correção
  // o listener dele morava em vincular() -- chamada de novo a cada
  // `change` de campo no modo manual -- e por isso acumulava um listener
  // POR re-render: editar três atributos e clicar em Salvar uma vez rodava
  // o handler QUATRO vezes (quatro toasts empilhados, quatro
  // renderFichaCompleta(), quatro escritas em localStorage). Este teste
  // edita três atributos (três re-renders) e conta os toasts de sucesso
  // depois de UM clique -- tem de sobrar exatamente um.
  const { page, erros } = await abrirEdicaoManual(context, 'regras-edicao-manual-listener-unico');

  for (const [atributo, valor] of [['forca', '13'], ['destreza', '17'], ['sabedoria', '11']]) {
    await page.fill(`[data-edicao-manual-atributo="${atributo}"]`, valor);
    await page.locator(`[data-edicao-manual-atributo="${atributo}"]`).dispatchEvent('change');
    await assentar(page).catch(() => {});
  }

  await page.click('#btn-salvar-edicao-ficha');
  await page.waitForTimeout(400);

  const toasts = await page.locator('.toast', { hasText: 'Alterações salvas.' }).count();
  expect(toasts, 'um único clique deveria produzir um único toast de sucesso -- ' +
    'mais de um é o listener duplicado voltando').toBe(1);

  const salvo = await personagemSalvo(page);
  expect(salvo?.atributos?.forca, 'os três ajustes têm de ter sido persistidos').toBe(13);
  expect(salvo?.atributos?.destreza).toBe(17);
  expect(salvo?.atributos?.sabedoria).toBe(11);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: reverter uma redistribuição do método com regras não inventa PV -- só a edição manual concede PV para desfazer', async ({ context }) => {
  // [data-reverter-atributos] é COMPARTILHADO com o método com regras: os
  // <select> desta tela redistribuem os mesmos seis valores rolados entre os
  // atributos, sem passar pelo modo manual. Trocar Força (12) com
  // Constituição (14) muda o modificador de CON tanto quanto uma edição
  // manual mudaria -- mas esse caminho NUNCA chamou aplicarPvRetroativoPorCon
  // ao salvar (é despropositado, e segue fora do escopo desta tarefa). Se o
  // handler de reverter aplicasse o inverso sem distinguir a origem, ele
  // concederia PV que a redistribuição nunca tirou.
  const { page, erros } = await abrirFicha(context, SEMENTE, 'regras-edicao-manual-6-redistribuicao');

  await page.click('#btn-editar-ficha');
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  // O <select> recusa (via disabled) atribuir a um atributo um valor já
  // ocupado por outro -- a troca exige um passo intermediário: liberar o
  // índice de Força, ocupá-lo com Constituição, e só então mover Força para
  // o índice que Constituição acabou de liberar.
  await page.selectOption('[data-edicao-atributo="forca"]', '');
  await page.selectOption('[data-edicao-atributo="constituicao"]', '0');
  await page.selectOption('[data-edicao-atributo="forca"]', '2');
  await page.click('#btn-salvar-edicao-ficha');
  await page.waitForTimeout(400);

  const depois = await personagemSalvo(page);
  expect(depois?.atributos?.forca, 'a redistribuição deveria ter movido Força para 14').toBe(14);
  expect(depois?.atributos?.constituicao, 'e Constituição para 12 -- mod caiu de +2 para +1').toBe(12);
  expect(depois?.pv_max, 'o caminho com regras não mexe em PV ao salvar (fora do escopo desta tarefa)').toBe(44);

  await page.click('#btn-editar-ficha');
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  await page.click('[data-reverter-atributos]');
  await page.waitForTimeout(400);

  const revertido = await personagemSalvo(page);
  expect(revertido?.atributos?.constituicao, 'a reversão devolve o atributo').toBe(14);
  expect(revertido?.pv_max, 'reverter uma redistribuição não pode inventar PV: ela nunca concedeu PV nenhum').toBe(44);
  expect(revertido?.pv_atual).toBe(44);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
