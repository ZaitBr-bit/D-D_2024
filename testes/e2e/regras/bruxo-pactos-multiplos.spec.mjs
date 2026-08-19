// ============================================================
// Os três Pactos do Bruxo são invocações místicas comuns -- dá para levar
// mais de um.
//
// PHB 2024, Classes.md (Bruxo, seção "Opções de Invocações Místicas"):
// `Pacto da Corrente`, `Pacto da Lâmina` e `Pacto do Tomo` aparecem como
// três entradas `###` iguais às demais invocações, e são as únicas da lista
// SEM linha de pré-requisito (as vizinhas trazem "*Pré-requisito: Bruxo
// Nível 5 ou superior*"). A única restrição da característica Invocações
// Místicas é: "Você não pode escolher a mesma invocação mais de uma vez, a
// menos que a descrição da invocação indique o contrário." Não existe
// cláusula de exclusividade entre eles, e a característica "Dádiva de
// Pacto" de 2014 -- que mandava escolher UM -- não existe mais na tabela de
// 2024 (o nível 1 traz apenas Invocações Místicas, Opções de Invocações
// Místicas e Magia de Pacto).
//
// O app aplicava a regra de 2014: ao marcar um pacto, o código removia
// SILENCIOSAMENTE o outro já marcado (sem toast, sem aviso), e guardava o
// pacto num campo único `recursos.bruxo.pacto`, derivado com
// `PACTOS.find(...)` -- o primeiro da lista vencia. Issue #16.
//
// Os três testes medem as três consequências distintas do campo único, e
// não só a da tela:
//   1. a seleção (o sintoma relatado);
//   2. o pré-requisito de OUTRAS invocações, que consultava o pacto
//      derivado em vez das invocações selecionadas -- com Corrente+Lâmina,
//      `Lâmina Sedenta` era recusada por "requer Pacto da Lâmina";
//   3. as Dádivas do Pacto na ficha, que só rendiam as do pacto derivado --
//      quem tivesse Corrente e Tomo perdia o Livro das Sombras da tela.
//
// Todos CLICAM: o que o livro promete é poder escolher, e só o clique mede
// isso. Afirmar sobre o HTML renderizado a partir de uma semente já pronta
// deixaria passar exatamente o bug relatado, que vive no handler do clique.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

// Nível 5: a tabela do Bruxo dá 5 invocações (folga para dois pactos mais
// uma invocação dependente) e é o nível mínimo de `Lâmina Sedenta`, usada
// no teste de pré-requisito.
const BRUXO = {
  classe: 'Bruxo', nivel: 5, xp: 14000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Arcanismo', 'Enganação'],
};

/** Semente do Bruxo com invocações já escolhidas (pula a tela de seleção). */
function bruxoCom(...nomes) {
  return { ...BRUXO, recursos: { bruxo: { invocacoes: nomes.map(nome => ({ nome })) } } };
}

/** Abre o modal "Recursos do Bruxo" pelo botão da ficha. */
async function abrirRecursosBruxo(page) {
  await clicarSeletorFicha(page, '[data-bruxo-recursos]', { esperar: '#bruxo-inv-grid' });
  await assentar(page).catch(() => {});
}

/** Marca uma invocação pelo checkbox do card e espera o grid re-renderizar. */
async function marcarInvocacao(page, nome) {
  await page.locator(`[data-inv-toggle="${nome}"]`).click();
  await assentar(page).catch(() => {});
}

/** Nomes das invocações do personagem salvo. */
async function invocacoesSalvas(page) {
  const p = await personagemSalvo(page);
  return (p?.recursos?.bruxo?.invocacoes || []).map(i => (typeof i === 'string' ? i : i.nome));
}

test('seleção: dois pactos podem ser marcados ao mesmo tempo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BRUXO, 'regras-bruxo-dois-pactos');
  await assentar(page).catch(() => {});
  await abrirRecursosBruxo(page);

  // GUARDA CONTRA VACUIDADE: os dois cards precisam existir na tela antes de
  // qualquer afirmação sobre marcá-los.
  await expect(page.locator('[data-inv-card="Pacto da Lâmina"]')).toBeVisible();
  await expect(page.locator('[data-inv-card="Pacto do Tomo"]')).toBeVisible();

  await marcarInvocacao(page, 'Pacto da Lâmina');
  await expect(page.locator('[data-inv-card="Pacto da Lâmina"]'),
    'marcar o primeiro pacto precisa funcionar, senão o teste seguinte não mede nada')
    .toHaveClass(/selecionada/);

  await marcarInvocacao(page, 'Pacto do Tomo');

  // O ponto da issue #16: marcar o segundo não pode desmarcar o primeiro.
  await expect(page.locator('[data-inv-card="Pacto do Tomo"]'),
    'o livro não limita a um pacto: os três são invocações comuns')
    .toHaveClass(/selecionada/);
  await expect(page.locator('[data-inv-card="Pacto da Lâmina"]'),
    'marcar Pacto do Tomo não pode desmarcar o Pacto da Lâmina já escolhido')
    .toHaveClass(/selecionada/);
  await expect(page.locator('#bruxo-inv-grid'),
    'o contador precisa cobrar as duas invocações do limite do nível')
    .toContainText('Selecionadas: 2');

  // E a escolha precisa sobreviver ao Salvar -- é o array salvo que a ficha
  // inteira lê depois.
  await clicarSeletorFicha(page, '#btn-salvar-bruxo-recursos');
  await assentar(page).catch(() => {});
  const salvas = await invocacoesSalvas(page);
  expect(salvas, 'os dois pactos precisam persistir no personagem salvo')
    .toEqual(expect.arrayContaining(['Pacto da Lâmina', 'Pacto do Tomo']));

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('pré-requisito: com dois pactos, a invocação dependente do segundo continua liberada', async ({ context }) => {
  // Corrente vem ANTES de Lâmina na lista interna de pactos: era exatamente
  // essa ordem que fazia o app "esquecer" a Lâmina ao avaliar o
  // pré-requisito de Lâmina Sedenta ("Bruxo Nível 5 ou superior, Pacto da
  // Lâmina").
  const { page, erros } = await abrirFicha(
    context, bruxoCom('Pacto da Corrente', 'Pacto da Lâmina'), 'regras-bruxo-prereq');
  await assentar(page).catch(() => {});
  await abrirRecursosBruxo(page);

  // GUARDA CONTRA VACUIDADE: a semente precisa ter chegado à tela com os
  // dois pactos marcados; sem isso o pré-requisito abaixo não estaria sendo
  // exercitado no cenário certo.
  await expect(page.locator('[data-inv-card="Pacto da Corrente"]')).toHaveClass(/selecionada/);
  await expect(page.locator('[data-inv-card="Pacto da Lâmina"]')).toHaveClass(/selecionada/);

  const sedenta = page.locator('[data-inv-card="Lâmina Sedenta"]');
  await expect(sedenta, 'o pré-requisito de Lâmina Sedenta está atendido: nível 5 e Pacto da Lâmina')
    .not.toHaveClass(/bloqueada/);

  await marcarInvocacao(page, 'Lâmina Sedenta');
  await expect(sedenta, 'com o Pacto da Lâmina em mãos, Lâmina Sedenta precisa poder ser escolhida')
    .toHaveClass(/selecionada/);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: as dádivas dos dois pactos aparecem, e a do segundo também é operável', async ({ context }) => {
  const { page, erros } = await abrirFicha(
    context, bruxoCom('Pacto da Corrente', 'Pacto do Tomo'), 'regras-bruxo-dadivas');
  await assentar(page).catch(() => {});
  await page.evaluate(() => { document.querySelectorAll('details').forEach(d => { d.open = true; }); });
  await assentar(page).catch(() => {});

  // Corrente: a magia concedida, com o botão de conjurar sem gastar espaço.
  await expect(page.locator('[data-conjurar-pacto="Convocar Familiar"]'),
    'o Pacto da Corrente concede Convocar Familiar')
    .toBeVisible();

  // Tomo: o Livro das Sombras não pode sumir só porque outro pacto veio
  // antes na lista.
  await expect(page.locator('body'),
    'as dádivas do Pacto do Tomo precisam aparecer junto com as do outro pacto')
    .toContainText('Livro das Sombras');

  // E operável de ponta a ponta: o botão abre a escolha dos truques/rituais,
  // e o que se escolhe ali precisa ser gravado -- com o segundo pacto em
  // mãos, o Livro das Sombras tem de funcionar igual a quem só tem o Tomo.
  await clicarSeletorFicha(page, '[data-pacto-tomo-gerenciar]', { esperar: '#btn-salvar-tomo' });
  await expect(page.locator('#tomo-conteudo')).toBeVisible();

  const primeiroTruque = page.locator('#tomo-truques-grid .opcao-card:not(.bloqueada)').first();
  await expect(primeiroTruque, 'a tela precisa oferecer truques para escolher').toBeVisible();
  const nomeTruque = await primeiroTruque.getAttribute('data-tomo-truque');
  await primeiroTruque.click();
  await clicarSeletorFicha(page, '#btn-salvar-tomo');
  await assentar(page).catch(() => {});

  const p = await personagemSalvo(page);
  expect((p?.recursos?.bruxo?.pacto_tomo?.truques || []).map(t => t.nome),
    'o truque escolhido no Livro das Sombras precisa ser gravado')
    .toContain(nomeTruque);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
